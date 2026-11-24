// Asks a model to write the next passage of a book that never ends, and saves it into the site.
// The model sees only the contents, the bible (who and what is in the story), a synopsis of
// the story so far, the note the previous writer left, and the last page. It has no memory of
// earlier runs beyond those.

import { appendFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readBook, writeBook, toRoman, BOOK_TITLE } from "./book.mjs";

const PLACES = {
  bookDir: path.resolve(process.env.BOOK_DIR || "book"),
  siteDir: path.resolve(process.env.SITE_DIR || "site"),
};
const API_URL = process.env.API_URL || "https://openrouter.ai/api/v1/chat/completions";
// Routes to whichever free model is available, so the default survives individual models being retired.
const MODEL = process.env.MODEL || "openrouter/free";
const API_KEY = process.env.API_KEY;

const MAX_ATTEMPTS = 3;
export const MIN_PASSAGE_CHARS = 300;
export const MAX_PASSAGE_CHARS = 3500;
export const MAX_SYNOPSIS_CHARS = 2000;
export const MAX_BIBLE_CHARS = 3000;
// Every writer keeps these lists in the bible; open threads are what push the story to resolve things.
export const BIBLE_HEADINGS = ["Characters", "Places", "Things and rules", "Open threads"];
const MAX_NOTE_CHARS = 500;
const MAX_TITLE_CHARS = 80;
// Keeps chapters from being one passage long, and from growing forever.
export const MIN_CHAPTER_CHARS = 3000;
export const MAX_CHAPTER_CHARS = 15000;
const LAST_PAGE_CHARS = 3000;

const INSTRUCTIONS = `You are one of many writers taking turns on a book that never ends, called "${BOOK_TITLE}".
Every turn is a different writer, who sees only what's below: the contents, the bible, a synopsis of the
story so far, a note from the previous writer, and the last page.

1. Write the next passage.
   - Continue directly from the last sentence. Don't recap, retell or repeat anything already on the page.
   - 2 to 5 paragraphs, about 150 to 400 words. Plain prose: *asterisks* for italics, nothing else.
     No headings, labels or notes inside the passage.
   - The bible is the truth. Never contradict it: a character's name, pronouns, role and history stay as written.
   - Make something happen, change, or come to light. Characters make decisions; don't end on someone
     merely facing a choice.
   - Prefer moving an open thread forward or resolving one over opening a new mystery. When there are more
     than 5 open threads, resolve one before opening another.
   - Treat the previous writer's note as a suggestion. You may take the story somewhere else.
   - You may start a new chapter when the story reaches a natural turn, once the current one has at least
     ${MIN_CHAPTER_CHARS} characters. When it reaches ${MAX_CHAPTER_CHARS}, you must start one.
2. Update the bible: add anyone or anything new, correct what changed, remove resolved threads. Keep these
   four headings, one short line per entry, under ${MAX_BIBLE_CHARS} characters in all:
   ${BIBLE_HEADINGS.join(", ")}.
   Characters: name, pronouns, who they are. Things and rules: objects that matter and how they work.
3. Rewrite the synopsis: what has happened and where things stand now, so the next writer can carry on
   without reading the book. Under ${MAX_SYNOPSIS_CHARS - 500} characters; drop what no longer matters.
4. Leave a note for the next writer: where the story could go next. Now and then, suggest a surprise.

Reply with only this, nothing else:

NEW CHAPTER: <title>   ← include this line only to start a new chapter
PASSAGE:
<your passage>
BIBLE:
<the updated bible>
SYNOPSIS:
<the updated synopsis>
NEXT:
<one or two sentences for the next writer>`;

const LABEL_PATTERN = /^\s*(?:#+\s*)?(?:\*\*)?(NEW CHAPTER|PASSAGE|BIBLE|SYNOPSIS|NEXT)(?:\*\*)?\s*:\s*(?:\*\*)?\s*(.*)$/i;
// Bookkeeping that once ended up printed in the book, like "PARAGRAPH TWO:" or "Last page: 380 words".
const NOT_STORY_PATTERN = /^\s*(?:#+\s*)?(?:\*\*)?(?:paragraph\s+\w+|last page)(?:\*\*)?\s*:/im;

export class RejectedTurn extends Error {}

const chapterLength = (chapter) => chapter.passages.join("\n\n").length;
const normalizeForComparison = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function lastPage(book) {
  const recentText = book.chapters.at(-1)?.passages.join("\n\n") ?? "";
  if (recentText.length <= LAST_PAGE_CHARS) return recentText;
  const cut = recentText.slice(-LAST_PAGE_CHARS);
  const paragraphStart = cut.indexOf("\n\n");
  return `…${paragraphStart === -1 ? cut : cut.slice(paragraphStart)}`;
}

export function renderPrompt(book) {
  const { chapters } = book;
  const current = chapters.at(-1);
  const contents = chapters.map((chapter, index) => `${toRoman(index + 1)}. ${chapter.title}`).join("\n");
  const length = current ? chapterLength(current) : 0;
  const status = !current
    ? "The book has no chapters yet; start the first one."
    : length >= MAX_CHAPTER_CHARS
      ? `Chapter ${toRoman(chapters.length)} is full (${length} characters): you must start a new chapter.`
      : `Chapter ${toRoman(chapters.length)} has ${length} of at most ${MAX_CHAPTER_CHARS} characters.`;

  return `## Contents
${contents || "(empty)"}

## The bible
${book.bible || "(empty — start it)"}

## The story so far
${book.synopsis || "(nothing yet)"}

## Note from the previous writer
${book.note || "(none yet — you are the first)"}

## The last page
${status}

${lastPage(book) || "(blank)"}`;
}

export function parseTurn(reply) {
  const sections = {};
  let currentLabel = null;
  for (const line of reply.replace(/\r\n/g, "\n").split("\n")) {
    if (/^\s*```/.test(line)) continue;
    const match = line.match(LABEL_PATTERN);
    const label = match?.[1].toUpperCase();
    if (label) {
      // A second copy of a section is how notes to the next writer once ended up printed in the book.
      if (label in sections) throw new RejectedTurn(`The reply has more than one ${label} section; give each section once.`);
      currentLabel = label;
      sections[label] = match[2] ? [match[2]] : [];
      continue;
    }
    if (currentLabel) sections[currentLabel].push(line);
  }
  const section = (label) => sections[label]?.join("\n").trim() ?? "";

  const passage = section("PASSAGE")
    .replace(/^\s*(?:#+\s.*|chapter\s+[\divxlc]+\b.*)\n+/i, "") // a heading the model added despite instructions
    .replace(/^[ \t]*~[ \t]*$/gm, "") // the passage separator in chapter files
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const newChapterTitle = section("NEW CHAPTER")
    .split("\n")[0]
    .replace(/^["'“]|["'”]$/g, "")
    // The site numbers chapters itself, so drop "Chapter IV:", "IV." or "4:" the model may have added.
    .replace(/^(?:chapter\s+[\divxlc]+\s*[:.—-]?|[\divxlc]+\s*[:.—-])\s*/i, "")
    .trim();

  return {
    newChapterTitle: newChapterTitle || null,
    passage,
    bible: section("BIBLE"),
    synopsis: section("SYNOPSIS"),
    note: section("NEXT").replace(/\s+/g, " "),
  };
}

// Returns the book with the turn added, and which chapters changed.
export function applyTurn(turn, book) {
  const { newChapterTitle, passage, bible, synopsis, note } = turn;
  const current = book.chapters.at(-1);

  if (!passage) throw new RejectedTurn("The reply has no PASSAGE section.");
  if (!bible) throw new RejectedTurn("The reply has no BIBLE section.");
  if (!synopsis) throw new RejectedTurn("The reply has no SYNOPSIS section.");
  if (!note) throw new RejectedTurn("The reply has no NEXT note for the next writer.");
  if (passage.length < MIN_PASSAGE_CHARS) {
    throw new RejectedTurn(`The passage is ${passage.length} characters; write at least ${MIN_PASSAGE_CHARS}.`);
  }
  if (passage.length > MAX_PASSAGE_CHARS) {
    throw new RejectedTurn(`The passage is ${passage.length} characters; keep it under ${MAX_PASSAGE_CHARS}.`);
  }
  const leaked = passage.match(NOT_STORY_PATTERN);
  if (leaked) {
    throw new RejectedTurn(`The passage contains "${leaked[0].trim()}"; only story text belongs in the passage.`);
  }
  const missingHeadings = BIBLE_HEADINGS.filter((heading) => !bible.toLowerCase().includes(heading.toLowerCase()));
  if (missingHeadings.length > 0) {
    throw new RejectedTurn(`The bible is missing these headings: ${missingHeadings.join(", ")}.`);
  }
  if (bible.length > MAX_BIBLE_CHARS) {
    throw new RejectedTurn(`The bible is ${bible.length} characters; keep it under ${MAX_BIBLE_CHARS}.`);
  }
  if (synopsis.length > MAX_SYNOPSIS_CHARS) {
    throw new RejectedTurn(`The synopsis is ${synopsis.length} characters; keep it under ${MAX_SYNOPSIS_CHARS}.`);
  }
  if (note.length > MAX_NOTE_CHARS) {
    throw new RejectedTurn(`The NEXT note is ${note.length} characters; keep it under ${MAX_NOTE_CHARS}.`);
  }
  if (newChapterTitle && newChapterTitle.length > MAX_TITLE_CHARS) {
    throw new RejectedTurn(`The chapter title is ${newChapterTitle.length} characters; keep it under ${MAX_TITLE_CHARS}.`);
  }

  const opening = normalizeForComparison(passage).slice(0, 80);
  if (opening && normalizeForComparison(lastPage(book)).includes(opening)) {
    throw new RejectedTurn("The passage repeats text from the last page; continue from where it stops instead.");
  }

  if (!current && !newChapterTitle) throw new RejectedTurn("The book is empty; start with a NEW CHAPTER line.");
  if (current && !newChapterTitle && chapterLength(current) >= MAX_CHAPTER_CHARS) {
    throw new RejectedTurn("The current chapter is full; add a NEW CHAPTER line with a title.");
  }
  if (current && newChapterTitle && chapterLength(current) < MIN_CHAPTER_CHARS) {
    throw new RejectedTurn(
      `The current chapter has only ${chapterLength(current)} characters; keep writing it until it has ${MIN_CHAPTER_CHARS} before starting a new one.`,
    );
  }

  const chapters = newChapterTitle
    ? [...book.chapters, { title: newChapterTitle, passages: [passage] }]
    : [...book.chapters.slice(0, -1), { ...current, passages: [...current.passages, passage] }];
  return {
    book: { chapters, bible, synopsis, note },
    changedChapterNumbers: [chapters.length],
  };
}

export function summarize(book) {
  const number = book.chapters.length;
  const opening = book.chapters.at(-1).passages.at(-1).replace(/\s+/g, " ").replace(/\*/g, "");
  return `Chapter ${toRoman(number)}: ${opening.length > 60 ? `${opening.slice(0, 59).trimEnd()}…` : opening}`;
}

async function askModel(messages) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Model request to ${API_URL} (${MODEL}) failed with ${response.status}: ${text}`);
  }
  const content = parseJsonOrNull(text)?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error(`Model request to ${API_URL} (${MODEL}) returned no completion: ${text.slice(0, 500)}`);
  }
  return content;
}

function parseJsonOrNull(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function grow() {
  if (!API_KEY) throw new Error("API_KEY is not set; in GitHub Actions it comes from the MODEL_API_KEY repo secret.");

  const book = await readBook(PLACES);
  const messages = [
    { role: "system", content: INSTRUCTIONS },
    { role: "user", content: renderPrompt(book) },
  ];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const reply = await askModel(messages);
    try {
      const { book: grown, changedChapterNumbers } = applyTurn(parseTurn(reply), book);
      await writeBook(PLACES, grown, changedChapterNumbers);
      const summary = summarize(grown);
      console.log(`Wrote: ${summary}`);
      console.log(`Next: ${grown.note}`);
      if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `summary=${summary}\n`);
      return;
    } catch (error) {
      if (!(error instanceof RejectedTurn)) throw error;
      console.log(`Attempt ${attempt} rejected: ${error.message}`);
      messages.push({ role: "assistant", content: reply });
      messages.push({ role: "user", content: `That was rejected: ${error.message} Try again, replying in the same format.` });
    }
  }
  throw new Error(`No valid passage after ${MAX_ATTEMPTS} attempts.`);
}

const isRunDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isRunDirectly) {
  await grow();
}
