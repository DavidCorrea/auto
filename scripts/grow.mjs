// One turn of the book: plans whatever needs planning (an arc, a chapter's beats), then has the arc's author
// write the next beat and the editor approve it. See story.mjs for how the book is organized.

import { appendFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readBook, writeBook, toRoman } from "./book.mjs";
import {
  RejectedReply,
  emptyState,
  nextStep,
  authorFor,
  arcPlanPrompt,
  chapterPlanPrompt,
  arcClosePrompt,
  writePrompt,
  editorPrompt,
  applyArcPlan,
  applyChapterPlan,
  applyArcClose,
  parsePassage,
  applyPassage,
  parseVerdict,
} from "./story.mjs";

const PLACES = {
  bookDir: path.resolve(process.env.BOOK_DIR || "book"),
  siteDir: path.resolve(process.env.SITE_DIR || "site"),
};
const API_URL = process.env.API_URL || "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = process.env.API_KEY;
const modelList = (value, fallback) => (value || fallback).split(",").map((model) => model.trim()).filter(Boolean);
// Chosen by the audition workflow: the showrunner plans and edits; authors take turns, one per arc.
// The models after the first are fallbacks for when a free model is rate-limited or down.
const SHOWRUNNERS = modelList(process.env.SHOWRUNNER_MODELS, "baidu/ernie-5.5-flash-preview:free,nvidia/nemotron-3.5-super-vl:free");
const AUTHORS = modelList(
  process.env.AUTHOR_MODELS,
  "baidu/ernie-5.5-flash-preview:free,nvidia/nemotron-3-ultra-550b-a55b:free,nvidia/nemotron-3.5-super-vl:free",
);
const ATTEMPTS_PER_MODEL = 2;
const REQUEST_TIMEOUT_MS = 300_000;

// A model that can't be reached right now, as opposed to one that answered badly.
class UnavailableModel extends Error {}

async function askModel(model, messages) {
  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new UnavailableModel(`${model} could not be reached: ${error.message}`);
  }
  const text = await response.text();
  if (response.status === 429 || response.status >= 500) {
    throw new UnavailableModel(`${model} answered ${response.status}: ${text.slice(0, 300)}`);
  }
  if (!response.ok) throw new Error(`Model request to ${API_URL} (${model}) failed with ${response.status}: ${text.slice(0, 500)}`);
  const content = parseJsonOrNull(text)?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new UnavailableModel(`${model} returned no completion: ${text.slice(0, 300)}`);
  return content;
}

function parseJsonOrNull(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Asks each model in turn until one gives a reply that `accept` takes, and returns what `accept` returned.
// A rejected reply goes back to the same model with the reason; an unreachable model is skipped.
async function askUntilAccepted(models, { system, user }, accept, what) {
  for (const model of models) {
    const messages = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];
    for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
      let reply;
      try {
        reply = await askModel(model, messages);
      } catch (error) {
        if (!(error instanceof UnavailableModel)) throw error;
        console.log(`${what}: ${error.message}`);
        break;
      }
      try {
        const result = await accept(reply);
        console.log(`${what}: done by ${model}.`);
        return result;
      } catch (error) {
        if (!(error instanceof RejectedReply)) throw error;
        console.log(`${what}: ${model}'s reply was rejected: ${error.message}`);
        // The reply is story text only, and without it a rejection can't be diagnosed from the run log.
        console.log(`--- rejected reply ---\n${reply}\n--- end ---`);
        messages.push({ role: "assistant", content: reply });
        messages.push({ role: "user", content: `That was rejected: ${error.message} Try again, replying in the same format.` });
      }
    }
  }
  throw new Error(`${what}: no model gave an acceptable reply (tried ${models.join(", ")}).`);
}

// When no editor can be reached the passage goes in unreviewed, so a rate-limited showrunner doesn't stop the book.
async function review(state, book, passage) {
  try {
    return await askUntilAccepted(SHOWRUNNERS, editorPrompt(state, book, passage), parseVerdict, "Editing");
  } catch (error) {
    console.log(`Editing skipped: ${error.message}`);
    return { isApproved: true, reason: "" };
  }
}

// The arc's author first, then the others as fallbacks.
const authorsFor = (arcAuthor) => [arcAuthor, ...AUTHORS.filter((model) => model !== arcAuthor)];

async function write(state, book) {
  return askUntilAccepted(
    authorsFor(state.arcs.at(-1).author),
    writePrompt(state, book),
    async (reply) => {
      const parsed = parsePassage(reply);
      const written = applyPassage(parsed, state, book);
      const verdict = await review(state, book, parsed.passage);
      if (!verdict.isApproved) throw new RejectedReply(`The editor sent it back: ${verdict.reason}`);
      return written;
    },
    `Writing chapter ${toRoman(state.chapter.number)}, beat ${state.chapter.events.length + 1}`,
  );
}

export function summarize(book) {
  const number = book.chapters.length;
  const opening = book.chapters.at(-1).passages.at(-1).replace(/\s+/g, " ").replace(/\*/g, "");
  return `Chapter ${toRoman(number)}: ${opening.length > 60 ? `${opening.slice(0, 59).trimEnd()}…` : opening}`;
}

const PLANNERS = {
  "plan-arc": (state, book) => ({
    prompt: arcPlanPrompt(state, book),
    accept: (reply) => applyArcPlan(reply, state, authorFor(state.arcs.length + 1, AUTHORS)),
    what: "Planning an arc",
  }),
  "plan-chapter": (state, book) => ({
    prompt: chapterPlanPrompt(state, book),
    accept: (reply) => applyChapterPlan(reply, state, book.chapters.length + 1),
    what: "Planning a chapter",
  }),
  "close-arc": (state, book) => ({
    prompt: arcClosePrompt(state, book),
    accept: (reply) => applyArcClose(reply, state),
    what: "Closing the arc",
  }),
};

async function grow() {
  if (!API_KEY) throw new Error("API_KEY is not set; in GitHub Actions it comes from the MODEL_API_KEY repo secret.");

  const stored = await readBook(PLACES);
  let book = { chapters: stored.chapters, state: stored.state ?? emptyState() };

  // Each plan is saved as soon as it's made, so a failure while writing doesn't throw it away.
  for (let step = nextStep(book.state); step !== "write"; step = nextStep(book.state)) {
    const { prompt, accept, what } = PLANNERS[step](book.state, book);
    book = { ...book, state: await askUntilAccepted(SHOWRUNNERS, prompt, accept, what) };
    await writeBook(PLACES, book, []);
  }

  const written = await write(book.state, book);
  book = { chapters: written.book.chapters, state: written.state };
  await writeBook(PLACES, book, [book.chapters.length]);

  const summary = summarize(book);
  console.log(`Wrote: ${summary}`);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `summary=${summary}\n`);
}

const isRunDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isRunDirectly) {
  await grow();
}
