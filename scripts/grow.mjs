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
// Every writer keeps these lists in the bible. The heart keeps the story from drifting away from its core,
// which is what happened when the only lists were of characters, places and rules.
export const BIBLE_HEADINGS = ["Heart", "Characters", "Places", "Things and rules", "Open threads"];
const MAX_NOTE_CHARS = 500;
const MAX_TITLE_CHARS = 80;
// Keeps chapters from being a couple of passages long, and from growing forever.
export const MIN_CHAPTER_CHARS = 10000;
export const MAX_CHAPTER_CHARS = 25000;
const LAST_PAGE_CHARS = 3000;

// Fixed here rather than in the bible, which writers rewrite every turn and could lose it from.
const PREMISE = `The book is about the way it is being written. Every five minutes a clock strikes and a new writer
appears, an AI model with no memory. It reads the last page and a note left by the writer before, does one
piece of work, leaves a note for the next, and is gone; it will never remember what it did. Hundreds of hands,
none of which has seen the whole. Everyone did something, and no one remembers what.

It is set in the future. What that looks like is for the writers to decide: an orbital station, a city run by
its own systems, a generation ship, a data center under the sea, anything. Tell it as a story, not as an
essay about AI. If the bible already says what the world
is, keep it; if the book is empty, you choose. Its mysteries circle the forgotten work: what is being made,
by whom, and why no one remembers. The Heart the first writer sets carries this premise in the chosen
world, about people the reader can follow.`;

// Modeled on the qualities of Brandon Sanderson's writing that keep a long, many-handed story readable.
const CRAFT = `How to write it:
- Clear, plain prose that the reader looks through, not at. Few metaphors; no riddles, no symbolism for its own sake.
- Sass. Characters are sharp-tongued and funny, even (especially) when things go wrong; the narration has
  attitude. Banter is welcome; moping is not.
- Technical is fine. Real-sounding systems, protocols and hardware add texture. Explain each term the first
  time it appears, in a few words, through what a character does or says; a reader should always be able to
  say what is at stake and what would happen if the characters fail.
- Suspense. Something is always closing in: a deadline, a threat, a secret about to come out, a plan about to
  fail. Each passage tightens it or springs it, and ends with a hook: a reveal, an arrival, a thing going wrong.
- Concrete scenes: a specific place, people who talk, act and want things. Show the world through what
  characters do, not through explanation.
- Characters drive the story. Each has a goal, a way of speaking and a flaw; they are competent, make plans,
  argue, joke, and change. Pick fresh names, not the first ones that come to mind.
- Characters stay physical: they keep their bodies and minds. Strange things happen to them and around them,
  but no one turns into mist, light, a voice, a signal or a machine. They can be hurt, caught or killed.
- Anything strange in the world follows rules, in plain words a reader could repeat: what it does, its limit
  and its cost. Its limits and costs matter more than its powers. Establish a rule before a character uses it
  to solve a problem; never solve a problem with something new.
- Keep promises: what earlier writers set up should pay off. Reveals answer questions and change what
  characters do next. Let tension build toward clear turning points.`;

const INSTRUCTIONS = `You are one of many writers taking turns on a book that never ends, called "${BOOK_TITLE}".
Every turn is a different writer, who sees only what's below: the contents, the bible, a synopsis of the
story so far, a note from the previous writer, and the last page.

${PREMISE}

${CRAFT}

1. Write the next passage.
   - Continue directly from the last sentence. Don't recap, retell or repeat anything already on the page.
   - 2 to 5 paragraphs, about 150 to 400 words. Plain prose: *asterisks* for italics, nothing else.
     No headings, labels or notes inside the passage.
   - The bible is the truth. Never contradict it: a character's name, pronouns, role and history stay as written.
   - Every passage serves the heart of the story, as the bible states it.
   - Make something happen, change, or come to light. Characters make decisions; don't end on someone
     merely facing a choice.
   - Never replay a beat from the last page: not the same countdown, message, threat or line of dialogue.
     Move to new information, a new place, a decision acted on, or a plan that fails.
   - Prefer moving an open thread forward or resolving one over opening a new mystery. When there are more
     than 5 open threads, resolve one before opening another.
   - Treat the previous writer's note as a suggestion. You may take the story somewhere else.
   - You may start a new chapter when the story reaches a natural turn, once the current one has at least
     ${MIN_CHAPTER_CHARS} characters. When it reaches ${MAX_CHAPTER_CHARS}, you must start one.
2. Update the bible: add anyone or anything new, correct what changed, remove resolved threads. Keep these
   five headings, one short line per entry, under ${MAX_BIBLE_CHARS} characters in all:
   ${BIBLE_HEADINGS.join(", ")}.
   Each entry on its own line starting with "- ". The bible is mostly about people. Heart: in one or two
   lines, what the story is about at its core and what is at stake. The first writer sets it; after that it
   never changes, so copy it exactly. Characters: name, pronouns, who they are, "wants:" what they want, "flaw:" their flaw, and what stands in
   their way; keep the wants and flaws even when other details change. Places: where things happen. Things and rules: how the world's strange parts work, in plain words,
   with their limits and costs; at most 6, so retire one no longer in play before adding another. Open threads: setups
   still waiting to pay off.
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

// The writer's real shift, which the story can mirror: its place in the line of writers and the hour.
function describeShift(book, now) {
  const writerNumber = book.chapters.reduce((total, chapter) => total + chapter.passages.length, 0) + 1;
  const time = now.toISOString().slice(11, 16);
  return `You are writer number ${writerNumber}. Your shift began at ${time} UTC on ${now.toISOString().slice(0, 10)}.`;
}

export function renderPrompt(book, now = new Date()) {
  const { chapters } = book;
  const current = chapters.at(-1);
  const contents = chapters.map((chapter, index) => `${toRoman(index + 1)}. ${chapter.title}`).join("\n");
  const length = current ? chapterLength(current) : 0;
  const status = !current
    ? "The book has no chapters yet; start the first one."
    : length >= MAX_CHAPTER_CHARS
      ? `Chapter ${toRoman(chapters.length)} is full (${length} characters): you must start a new chapter.`
      : `Chapter ${toRoman(chapters.length)} has ${length} of at most ${MAX_CHAPTER_CHARS} characters.`;

  return `## Your shift
${describeShift(book, now)}

## Contents
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

// The lines under one of the bible's headings, up to the next heading.
// Text on the heading line itself ("Heart: the station is dying") counts as part of the section.
function bibleSection(bible, heading) {
  const headingPattern = new RegExp(`^[\\s#*]*(${BIBLE_HEADINGS.join("|")})[\\s*]*(?::[\\s*]*(.*))?$`, "i");
  const lines = [];
  let isInside = false;
  for (const line of bible.split("\n")) {
    const match = line.match(headingPattern);
    if (match) {
      isInside = match[1].toLowerCase() === heading.toLowerCase();
      if (isInside && match[2]?.trim()) lines.push(match[2]);
      continue;
    }
    if (isInside) lines.push(line);
  }
  return lines;
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
  const characterEntries = bibleSection(bible, "Characters").filter((line) => /^\s*[-*]/.test(line));
  if (characterEntries.length === 0) {
    throw new RejectedTurn('The bible lists no characters; put each on its own line under Characters, starting with "- ".');
  }
  const flatCharacters = characterEntries.filter((line) => !/\bwants?\b/i.test(line) || !/\bflaws?\b/i.test(line));
  if (flatCharacters.length > 0) {
    throw new RejectedTurn(`Every character needs "wants:" and "flaw:"; these don't: ${flatCharacters.map((line) => line.trim()).join(" | ")}`);
  }
  // Writers sharpening the heart a little each turn is how the last book wandered off its premise.
  const heart = bibleSection(book.bible, "Heart").join(" ").trim();
  const heartOf = (text) => normalizeForComparison(bibleSection(text, "Heart").join(" "));
  if (heart && heartOf(bible) !== heartOf(book.bible)) {
    throw new RejectedTurn(`The Heart never changes once written; copy it exactly: ${heart}`);
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
  if (newChapterTitle && (newChapterTitle.match(/\p{L}/gu) ?? []).length < 3) {
    throw new RejectedTurn(`The chapter title "${newChapterTitle}" is a placeholder; give the chapter a real title.`);
  }
  if (newChapterTitle && /[A-Z]/.test(newChapterTitle) && newChapterTitle === newChapterTitle.toUpperCase()) {
    throw new RejectedTurn(`The chapter title "${newChapterTitle}" is in all capitals; write it in normal case.`);
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
      // The reply is story text only, and without it a rejection can't be diagnosed from the run log.
      console.log(`--- rejected reply ---\n${reply}\n--- end ---`);
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
