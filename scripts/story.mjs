// The story's logic, kept free of network and files so it can be tested directly.
//
// The book is written in arcs: complete stories of a few chapters, each told by one author model, all set in
// one world. A showrunner model plans each arc and, chapter by chapter, the beats to write; the arc's author
// writes one beat per turn; the showrunner, acting as editor, approves or sends back each passage. The story's
// state (world, cast, threads, plans) is owned by this code: models propose small changes, never rewrite it.

import { toRoman, BOOK_TITLE } from "./book.mjs";

export const MIN_PASSAGE_CHARS = 1200;
export const MAX_PASSAGE_CHARS = 6000;
export const MIN_ARC_CHAPTERS = 3;
export const MAX_ARC_CHAPTERS = 8;
export const MIN_BEATS = 4;
export const MAX_BEATS = 8;
export const MAX_THREADS = 6;
// A full list on the first turn left writers no room, and the extras were outcomes the arc hadn't reached.
export const MAX_ARC_THREADS = 3;
// Facts each arc settles, shown to every later prompt so reveals aren't contradicted or replayed as news.
export const MAX_FACTS = 40;
const MAX_TITLE_CHARS = 80;
const MAX_LINE_CHARS = 600;
// The whole chapter fits comfortably in today's context windows; beyond this only its end is shown.
const CHAPTER_CONTEXT_CHARS = 40000;

export class RejectedReply extends Error {}

export const emptyState = () => ({ setting: "", heart: "", cast: [], threads: [], facts: [], arcs: [], chapter: null });

const currentArc = (state) => state.arcs.at(-1);

// What the next model call should be.
export function nextStep(state) {
  const arc = currentArc(state);
  if (!arc || arc.isClosed) return "plan-arc";
  const chapter = state.chapter;
  if (!chapter || chapter.arc !== state.arcs.length) return "plan-chapter";
  if (chapter.events.length < chapter.beats.length) return "write";
  return arc.chapterSummaries.length + 1 >= arc.plan.length ? "close-arc" : "plan-chapter";
}

export function authorFor(arcNumber, authors) {
  return authors[(arcNumber - 1) % authors.length];
}

// ---------------------------------------------------------------------------------------------- reading replies

const escapeForPattern = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Splits a reply into its labeled sections. Labels may be bold or headings and may carry text on the same line.
export function parseSections(reply, labels) {
  const labelPattern = new RegExp(
    `^\\s*(?:#+\\s*)?(?:\\*\\*)?(${labels.map(escapeForPattern).join("|")})(?:\\*\\*)?\\s*:\\s*(?:\\*\\*)?\\s*(.*)$`,
    "i",
  );
  const sections = {};
  let currentLabel = null;
  for (const line of reply.replace(/\r\n/g, "\n").split("\n")) {
    if (/^\s*```/.test(line)) continue;
    const match = line.match(labelPattern);
    if (match) {
      const label = labels.find((candidate) => candidate.toLowerCase() === match[1].toLowerCase());
      // A second copy of a section is how notes meant for the next writer once got printed in the book.
      if (label in sections) throw new RejectedReply(`The reply has more than one ${label} section; give each section once.`);
      currentLabel = label;
      sections[label] = match[2] ? [match[2]] : [];
      continue;
    }
    if (currentLabel) sections[currentLabel].push(line);
  }
  return Object.fromEntries(labels.map((label) => [label, sections[label]?.join("\n").trim() ?? ""]));
}

const listItems = (text) =>
  text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);

function requireSection(sections, label) {
  if (!sections[label]) throw new RejectedReply(`The reply has no ${label} section.`);
  return sections[label];
}

function checkLine(text, what) {
  if (text.length > MAX_LINE_CHARS) throw new RejectedReply(`${what} is ${text.length} characters; keep it under ${MAX_LINE_CHARS}.`);
  return text;
}

export function checkTitle(title, what) {
  const cleaned = title.replace(/^["'“]|["'”]$/g, "").replace(/^(?:chapter\s+[\divxlc]+\s*[:.—-]?|[\divxlc]+\s*[:.—-])\s*/i, "").trim();
  if ((cleaned.match(/\p{L}/gu) ?? []).length < 3) throw new RejectedReply(`The ${what} "${title}" is a placeholder; give it a real title.`);
  if (/[A-Z]/.test(cleaned) && cleaned === cleaned.toUpperCase()) {
    throw new RejectedReply(`The ${what} "${cleaned}" is in all capitals; write it in normal case.`);
  }
  if (cleaned.length > MAX_TITLE_CHARS) throw new RejectedReply(`The ${what} is ${cleaned.length} characters; keep it under ${MAX_TITLE_CHARS}.`);
  return cleaned;
}

// "Name | pronouns | role | wants: … | flaw: …"
export function parseCharacter(line, cast) {
  const parts = line.split("|").map((part) => part.trim());
  const wants = parts.find((part) => /^wants?\s*:/i.test(part))?.replace(/^wants?\s*:\s*/i, "");
  const flaw = parts.find((part) => /^flaws?\s*:/i.test(part))?.replace(/^flaws?\s*:\s*/i, "");
  if (parts.length < 5 || !wants || !flaw) {
    throw new RejectedReply(`Write each character as "Name | pronouns | role | wants: … | flaw: …"; this isn't: ${line}`);
  }
  const [name, pronouns, role] = parts;
  // Lira, Rylia, Mira and Mara in one cast was hard to follow.
  const lookalike = cast.find((character) => character.name.slice(0, 3).toLowerCase() === name.slice(0, 3).toLowerCase());
  if (lookalike) throw new RejectedReply(`"${name}" is too close to "${lookalike.name}"; pick a name that starts differently.`);
  return { name: checkLine(name, "A name"), pronouns, role: checkLine(role, "A role"), wants, flaw, status: "" };
}

function parseCast(text, cast) {
  const added = [];
  for (const line of listItems(text)) added.push(parseCharacter(line, [...cast, ...added]));
  return added;
}

// ---------------------------------------------------------------------------------------------- applying replies

export const ARC_LABELS = ["SETTING", "HEART", "CAST", "ARC TITLE", "ARC QUESTION", "ARC GOAL", "CHAPTERS", "THREADS"];

export function applyArcPlan(reply, state, author) {
  const sections = parseSections(reply, ARC_LABELS);
  const isFirstArc = !state.setting;
  const setting = isFirstArc ? checkLine(requireSection(sections, "SETTING"), "The setting") : state.setting;
  const heart = isFirstArc ? checkLine(requireSection(sections, "HEART"), "The heart") : state.heart;
  const newCast = parseCast(sections.CAST, state.cast);
  if (isFirstArc && newCast.length < 2) throw new RejectedReply("The first arc needs a CAST of at least 2 characters.");

  const plan = listItems(requireSection(sections, "CHAPTERS")).map((line) => {
    const [title, ...summary] = line.split(":");
    if (summary.length === 0) throw new RejectedReply(`Write each chapter as "Title: what happens"; this isn't: ${line}`);
    return { title: checkTitle(title, "chapter title"), summary: checkLine(summary.join(":").trim(), "A chapter summary") };
  });
  if (plan.length < MIN_ARC_CHAPTERS || plan.length > MAX_ARC_CHAPTERS) {
    throw new RejectedReply(`The arc has ${plan.length} chapters; plan ${MIN_ARC_CHAPTERS} to ${MAX_ARC_CHAPTERS}.`);
  }
  // Two chapters called "Eleven Seconds" in different arcs was a sign the arcs were retelling each other.
  const usedTitles = new Set(state.arcs.flatMap((earlier) => earlier.plan.map((chapter) => chapter.title.toLowerCase())));
  for (const { title } of plan) {
    if (usedTitles.has(title.toLowerCase())) throw new RejectedReply(`The book already has a chapter called "${title}"; every chapter needs its own title.`);
    usedTitles.add(title.toLowerCase());
  }
  const arcThreads = listItems(sections.THREADS).map((thread) => checkLine(thread, "A thread"));
  if (arcThreads.length > MAX_ARC_THREADS) throw new RejectedReply(`The arc opens ${arcThreads.length} threads; open at most ${MAX_ARC_THREADS}.`);
  const threads = [...state.threads, ...arcThreads];
  if (threads.length > MAX_THREADS) throw new RejectedReply(`That makes ${threads.length} open threads; keep it to ${MAX_THREADS}.`);

  const arc = {
    title: checkTitle(requireSection(sections, "ARC TITLE"), "arc title"),
    question: checkLine(requireSection(sections, "ARC QUESTION"), "The arc question"),
    goal: checkLine(requireSection(sections, "ARC GOAL"), "The arc goal"),
    author,
    plan,
    chapterSummaries: [],
    summary: "",
    isClosed: false,
  };
  return { ...state, setting, heart, cast: [...state.cast, ...newCast], threads, arcs: [...state.arcs, arc], chapter: null };
}

export const CHAPTER_LABELS = ["PREVIOUS CHAPTER", "BEATS"];

export function applyChapterPlan(reply, state, chapterNumber) {
  const sections = parseSections(reply, CHAPTER_LABELS);
  const arc = currentArc(state);
  const hasPreviousChapter = state.chapter?.arc === state.arcs.length;
  const beats = listItems(requireSection(sections, "BEATS")).map((beat) => checkLine(beat, "A beat"));
  if (beats.length < MIN_BEATS || beats.length > MAX_BEATS) {
    throw new RejectedReply(`The chapter has ${beats.length} beats; plan ${MIN_BEATS} to ${MAX_BEATS}.`);
  }
  const chapterSummaries = hasPreviousChapter
    ? [...arc.chapterSummaries, checkLine(requireSection(sections, "PREVIOUS CHAPTER"), "The previous chapter's summary")]
    : arc.chapterSummaries;
  const title = arc.plan[chapterSummaries.length].title;
  return {
    ...state,
    arcs: [...state.arcs.slice(0, -1), { ...arc, chapterSummaries, firstChapter: arc.firstChapter ?? chapterNumber }],
    chapter: { arc: state.arcs.length, number: chapterNumber, title, beats, events: [] },
  };
}

export const CLOSE_LABELS = ["LAST CHAPTER", "ARC SUMMARY", "FACTS", "STATUS", "RESOLVED"];

export function applyArcClose(reply, state) {
  const sections = parseSections(reply, CLOSE_LABELS);
  const arc = currentArc(state);
  const closed = {
    ...arc,
    chapterSummaries: [...arc.chapterSummaries, checkLine(requireSection(sections, "LAST CHAPTER"), "The last chapter's summary")],
    summary: checkLine(requireSection(sections, "ARC SUMMARY"), "The arc summary"),
    isClosed: true,
  };
  const facts = listItems(requireSection(sections, "FACTS")).map((fact) => checkLine(fact, "A fact"));
  const changes = [
    ...listItems(sections.STATUS).map((line) => `status: ${line}`),
    ...(/\d/.test(sections.RESOLVED) ? [`resolved: ${sections.RESOLVED}`] : []),
  ];
  const { cast, threads, skipped } = applyChanges(changes, state);
  return {
    state: {
      ...state,
      cast,
      threads,
      facts: [...(state.facts ?? []), ...facts].slice(-MAX_FACTS),
      arcs: [...state.arcs.slice(0, -1), closed],
    },
    skipped,
  };
}

// Models often use one part of a name ("Salas" for Ivo Salas); it counts when exactly one character has it.
function findCharacter(cast, name) {
  const wanted = name.trim().toLowerCase();
  const exact = cast.findIndex((character) => character.name.toLowerCase() === wanted);
  if (exact !== -1) return exact;
  const byPart = cast.flatMap((character, index) => (character.name.toLowerCase().split(/\s+/).includes(wanted) ? [index] : []));
  return byPart.length === 1 ? byPart[0] : -1;
}

// "Name: new status"
function updateStatus(cast, line) {
  const [name, ...rest] = line.split(":");
  const status = rest.join(":").trim();
  const index = findCharacter(cast, name);
  if (index === -1 || !status) throw new RejectedReply(`Status changes are "Name: new status" for someone in the cast; this isn't: ${line}`);
  return cast.map((character, position) => (position === index ? { ...character, status: checkLine(status, "A status") } : character));
}

// Threads are resolved by their number in the list the model was shown.
function removeThreads(threads, text) {
  const numbers = new Set((text.match(/\d+/g) ?? []).map(Number));
  for (const number of numbers) {
    if (number < 1 || number > threads.length) throw new RejectedReply(`There is no open thread ${number}.`);
  }
  return threads.filter((_, index) => !numbers.has(index + 1));
}

export const WRITE_LABELS = ["PASSAGE", "HAPPENED", "CHANGES"];
// Bookkeeping that once ended up printed in the book, like "PARAGRAPH TWO:" or "Last page: 380 words".
const NOT_STORY_PATTERN = /^\s*(?:#+\s*)?(?:\*\*)?(?:paragraph\s+\w+|last page|beat\s*\d*)(?:\*\*)?\s*:/im;
const normalizeForComparison = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function parsePassage(reply) {
  const sections = parseSections(reply, WRITE_LABELS);
  const passage = requireSection(sections, "PASSAGE")
    .replace(/^\s*(?:#+\s.*|chapter\s+[\divxlc]+\b.*)\n+/i, "") // a heading the model added despite instructions
    .replace(/^[ \t]*~[ \t]*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { passage, happened: requireSection(sections, "HAPPENED").replace(/\s+/g, " "), changes: sections.CHANGES };
}

// Checks a written passage and returns the story state and book with it added.
export function applyPassage({ passage, happened, changes }, state, book) {
  if (passage.length < MIN_PASSAGE_CHARS) throw new RejectedReply(`The passage is ${passage.length} characters; write at least ${MIN_PASSAGE_CHARS}.`);
  if (passage.length > MAX_PASSAGE_CHARS) throw new RejectedReply(`The passage is ${passage.length} characters; keep it under ${MAX_PASSAGE_CHARS}.`);
  const leaked = passage.match(NOT_STORY_PATTERN);
  if (leaked) throw new RejectedReply(`The passage contains "${leaked[0].trim()}"; only story text belongs in the passage.`);
  const chapterSoFar = book.chapters[state.chapter.number - 1]?.passages.join("\n\n") ?? "";
  const opening = normalizeForComparison(passage).slice(0, 80);
  if (opening && normalizeForComparison(chapterSoFar).includes(opening)) {
    throw new RejectedReply("The passage repeats text already in the chapter; continue from where it stops instead.");
  }

  const { cast, threads, skipped } = applyChanges(listItems(changes), state);

  const { chapter } = state;
  const isNewChapter = book.chapters.length < chapter.number;
  const chapters = isNewChapter
    ? [...book.chapters, { title: chapter.title, passages: [passage] }]
    : book.chapters.map((existing, index) => (index === chapter.number - 1 ? { ...existing, passages: [...existing.passages, passage] } : existing));
  return {
    state: { ...state, cast, threads, chapter: { ...chapter, events: [...chapter.events, checkLine(happened, "HAPPENED")] } },
    book: { ...book, chapters },
    skipped,
  };
}

// Applies the bookkeeping lines a model proposes. A line that can't be applied is skipped and reported, not
// fatal: it once failed a third of all turns, throwing away good passages over a side note.
function applyChanges(lines, state) {
  let { cast, threads } = state;
  const skipped = [];
  for (const line of lines) {
    const [kind, ...rest] = line.split(":");
    const detail = rest.join(":").trim();
    try {
      switch (kind.trim().toLowerCase()) {
        case "status":
          cast = updateStatus(cast, detail);
          break;
        case "new character":
          cast = [...cast, parseCharacter(detail, cast)];
          break;
        case "resolved":
          threads = removeThreads(threads, detail);
          break;
        case "new thread":
          if (threads.length >= MAX_THREADS) throw new RejectedReply(`there are already ${MAX_THREADS} open threads`);
          threads = [...threads, checkLine(detail, "A thread")];
          break;
        default:
          if (/^none\.?$/i.test(line)) break;
          throw new RejectedReply('changes are "status:", "new character:", "resolved:" or "new thread:" lines');
      }
    } catch (error) {
      if (!(error instanceof RejectedReply)) throw error;
      skipped.push(`${line} (${error.message})`);
    }
  }
  return { cast, threads, skipped };
}

export function parseVerdict(reply) {
  const sections = parseSections(reply, ["VERDICT", "REASON"]);
  const verdict = sections.VERDICT.toUpperCase();
  if (verdict.startsWith("APPROVE")) return { isApproved: true, reason: "" };
  if (verdict.startsWith("REVISE")) return { isApproved: false, reason: sections.REASON || "The editor asked for a revision." };
  throw new RejectedReply('Reply with "VERDICT: APPROVE" or "VERDICT: REVISE" and a REASON.');
}

// ---------------------------------------------------------------------------------------------- prompts

const CRAFT = `The book's voice:
- Clear, plain prose a reader looks through, not at. Few metaphors; no riddles, no symbolism for its own sake.
- Concrete scenes: specific places, people who talk, act and want things. Characters keep their bodies and minds;
  strange things happen to them and around them, but no one turns into mist, light, a voice or a signal.
- Sass. Characters are sharp-tongued and funny, especially when things go wrong. Banter is welcome; moping is not.
- Technical is welcome: real-sounding systems and hardware. Explain each term the first time it appears, in a few
  words, through what someone does or says. A reader can always say what is at stake.
- Suspense. Something is always closing in, and every passage ends on a hook: a reveal, an arrival, a thing going wrong.
- Anything strange follows rules a reader could repeat, with limits and costs. Establish a rule before it solves a problem.
- Stakes are people: lives, loyalties, a body, a home. Never ledgers, tokens, paperwork or abstract costs.
- Setups pay off. Characters make decisions and act on them.`;

const PREMISE = `"${BOOK_TITLE}" is a book that never ends, set in the future. It is written by a rotating cast of AI models,
each of which writes a short passage and forgets it. The world may echo that (shifts, handoffs, people who forget what
they did), but the story is about people in that world, never about writers, authors, drafts or pages.`;

function describeCast(cast) {
  return cast
    .map((character) => `- ${character.name} (${character.pronouns}), ${character.role}; wants: ${character.wants}; flaw: ${character.flaw}${character.status ? `; now: ${character.status}` : ""}`)
    .join("\n");
}

const describeThreads = (threads) => (threads.length ? threads.map((thread, index) => `${index + 1}. ${thread}`).join("\n") : "(none)");

function describeFacts(state) {
  const facts = state.facts ?? [];
  return facts.length ? `\n## Settled facts: never contradict these, and never reveal them again as news\n${facts.map((fact) => `- ${fact}`).join("\n")}\n` : "";
}

function describeWorld(state) {
  const pastArcs = state.arcs.filter((arc) => arc.isClosed);
  return `## The world
${state.setting}

## The heart of the book
${state.heart}

## The cast
${describeCast(state.cast) || "(none yet)"}

## Open threads
${describeThreads(state.threads)}
${describeFacts(state)}${pastArcs.length ? `\n## Earlier arcs\n${pastArcs.map((arc, index) => `${index + 1}. ${arc.title}${arc.question ? ` (${arc.question})` : ""}: ${arc.summary}`).join("\n")}\n` : ""}`;
}

function describeArc(arc) {
  return `## This arc: ${arc.title}
${arc.goal}

Chapters planned:
${arc.plan.map((chapter, index) => `${index + 1}. ${chapter.title}: ${chapter.summary}`).join("\n")}
${arc.chapterSummaries.length ? `\nWhat has happened so far in this arc:\n${arc.chapterSummaries.map((summary, index) => `${index + 1}. ${summary}`).join("\n")}\n` : ""}`;
}

function chapterText(book, number) {
  const text = book.chapters[number - 1]?.passages.join("\n\n") ?? "";
  if (text.length <= CHAPTER_CONTEXT_CHARS) return text;
  const cut = text.slice(-CHAPTER_CONTEXT_CHARS);
  return `…${cut.slice(Math.max(0, cut.indexOf("\n\n")))}`;
}

const lastChapterText = (book) => (book.chapters.length ? chapterText(book, book.chapters.length) : "");

export function arcPlanPrompt(state, book) {
  const isFirstArc = !state.setting;
  const characterFormat = "- Name | pronouns | role | wants: … | flaw: …";
  return {
    system: `You are the showrunner of "${BOOK_TITLE}". ${PREMISE}

The book is told in arcs: complete stories of ${MIN_ARC_CHAPTERS} to ${MAX_ARC_CHAPTERS} chapters set in one world. Each arc has a
clear goal, builds to a turning point, and ends by resolving its main conflict, while the world goes on. You plan
the arc; writers who never see the whole book will turn your plan into prose, one beat at a time, so every chapter
summary must be concrete: who does what, and what changes.

${CRAFT}`,
    user: `${isFirstArc ? "The book is empty. Invent its world: set in the future, anywhere you like, with a handful of people worth following." : describeWorld(state)}
${!isFirstArc && book.chapters.length ? `## The end of the last chapter\n${lastChapterText(book).slice(-3000)}\n` : ""}
Plan the ${isFirstArc ? "first" : "next"} arc. ${isFirstArc ? "" : `It follows from what came before and may bring in new characters and resolve old threads, but it must be
a different kind of story from every earlier arc: a new central question, a new place for its climax, a new
opponent or pressure. Never rerun an earlier arc's engine, such as another race against the same deadline, another
trip to the same place, or another recording revealing who did something.`}
Reply with only this:

${isFirstArc ? "SETTING: <two or three sentences: where and when, and what life there is like>\nHEART: <one or two sentences: what the book is about at its core, about people, and what is at stake>\n" : ""}CAST:
${characterFormat}   ← ${isFirstArc ? "2 to 5 characters with distinct names" : "only new characters, or leave empty"}
ARC TITLE: <title>
ARC QUESTION: <the one question this arc answers, in a single line>
ARC GOAL: <one or two sentences: what this arc is about and how it ends>
CHAPTERS:
1. <chapter title>: <one sentence: what happens and what changes>
… ${MIN_ARC_CHAPTERS} to ${MAX_ARC_CHAPTERS} chapters
THREADS:
- <a question or setup already open as the arc begins, never an event still to come; at most ${Math.min(MAX_ARC_THREADS, MAX_THREADS - state.threads.length)}>`,
  };
}

export function chapterPlanPrompt(state, book) {
  const arc = currentArc(state);
  const hasPreviousChapter = state.chapter?.arc === state.arcs.length;
  const next = arc.plan[arc.chapterSummaries.length + (hasPreviousChapter ? 1 : 0)];
  return {
    system: `You are the showrunner of "${BOOK_TITLE}". ${PREMISE}

You break the next chapter into beats. Each beat is one concrete event a writer turns into a passage of about 500
words: someone does something, something changes. Beats build toward the chapter's turning point and the last one
lands it. Never repeat an event that already happened.

${CRAFT}`,
    user: `${describeWorld(state)}
${describeArc(arc)}
${hasPreviousChapter ? `## The chapter just finished: ${state.chapter.title}\n${chapterText(book, state.chapter.number)}\n` : ""}
## The next chapter: ${next.title}
${next.summary}

Reply with only this:

${hasPreviousChapter ? "PREVIOUS CHAPTER: <two or three sentences: what happened in the chapter just finished and where things stand>\n" : ""}BEATS:
- <${MIN_BEATS} to ${MAX_BEATS} beats, one per line, in order>`,
  };
}

export function arcClosePrompt(state, book) {
  const arc = currentArc(state);
  return {
    system: `You are the showrunner of "${BOOK_TITLE}". ${PREMISE}

An arc has just ended. Record what happened so future arcs can build on it.`,
    user: `${describeWorld(state)}
${describeArc(arc)}
## The last chapter: ${state.chapter.title}
${chapterText(book, state.chapter.number)}

Reply with only this:

LAST CHAPTER: <two or three sentences: what happened in the last chapter>
ARC SUMMARY: <three or four sentences: what happened in the arc, how it ended, and how it changed the people in it>
FACTS:
- <3 to 8 facts this arc settled that later arcs must never contradict or reveal again: who did what, who holds what, who is where>
STATUS:
- <Name: where they stand now, one line per character whose situation changed>
RESOLVED: <numbers of the open threads this arc paid off, separated by commas, or "none">`,
  };
}

export function writePrompt(state, book) {
  const arc = currentArc(state);
  const { chapter } = state;
  const beatIndex = chapter.events.length;
  const beats = chapter.beats
    .map((beat, index) => `${index + 1}. ${beat}${index < beatIndex ? "   (written)" : index === beatIndex ? "   ← YOUR BEAT" : ""}`)
    .join("\n");
  const soFar = chapterText(book, chapter.number);
  return {
    system: `You are the author of this arc of "${BOOK_TITLE}". ${PREMISE}

You write one beat of the chapter: the one marked YOUR BEAT, and only that one. Stop where your beat ends;
the beats after it belong to other writers, and taking them leaves those writers nothing to do. Continue directly from the last sentence of the chapter so far; don't recap
or repeat anything already on the page.

${CRAFT}`,
    user: `${describeWorld(state)}
${describeArc(arc)}
## Chapter ${toRoman(chapter.number)}: ${chapter.title}
Beats:
${beats}

## The chapter so far
${soFar || "(this beat opens the chapter)"}

Reply with only this:

PASSAGE:
<about 400 to 800 words of story, plain prose; *asterisks* for italics, nothing else; no headings or notes>
HAPPENED: <one sentence: what happened in your passage>
CHANGES:
- <only if needed, one per line: "status: Name: where they stand now", "new character: Name | pronouns | role | wants: … | flaw: …", "resolved: <thread number>", "new thread: <a setup that must pay off>">`,
  };
}

export function editorPrompt(state, book, passage) {
  const { chapter } = state;
  const soFar = chapterText(book, chapter.number).slice(-6000);
  return {
    system: `You are the editor of "${BOOK_TITLE}". ${PREMISE}

You approve or send back one passage. Send it back only for a real problem:
- It doesn't carry out its beat, or runs ahead into events of the later beats listed below.
- It contradicts the cast (names, pronouns, who someone is) or what already happened.
- It replays something already on the page: the same event, countdown, alarm, threat or line, in new words.
- It contradicts a settled fact, or reveals one again as if it were news.
- It goes abstract: mist, voices, symbolism or vague dread instead of people doing concrete things.
- A technical term that matters goes unexplained, or the stakes are unclear.
- Nothing changes by the end.
Style preferences are not reasons. When in doubt, approve.

${CRAFT}`,
    user: `## The cast
${describeCast(state.cast)}
${describeFacts(state)}
## The beat
${chapter.beats[chapter.events.length]}

## Later beats, which belong to other writers
${chapter.beats.slice(chapter.events.length + 1).map((beat) => `- ${beat}`).join("\n") || "(none: this beat ends the chapter)"}

## The chapter so far (its end)
${soFar || "(the passage opens the chapter)"}

## The passage
${passage}

Reply with only this:

VERDICT: APPROVE or REVISE
REASON: <if REVISE, one or two sentences the writer can act on>`,
  };
}
