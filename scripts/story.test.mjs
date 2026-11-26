import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  RejectedReply,
  emptyState,
  nextStep,
  authorFor,
  parseSections,
  applyArcPlan,
  applyChapterPlan,
  applyArcClose,
  parsePassage,
  applyPassage,
  parseVerdict,
  writePrompt,
  arcPlanPrompt,
  MAX_PASSAGE_CHARS,
} from "./story.mjs";

const firstArcPlan = ({
  cast = "- Noor Achterberg | she | cooling engineer | wants: her brother home alive | flaw: lies to protect people\n- Tavish Okonkwo | he | network tech | wants: to prove he isn't a kid | flaw: reckless",
  chapters = "1. The Cancelled Sub: Noor learns the sub isn't coming.\n2. Load: Tavish overloads the loop.\n3. Rising: The crew votes to surface.",
  threads = "- Who cancelled the sub?",
  title = "Rated for Forty Years",
} = {}) =>
  `SETTING: Meridian Deep, a data center 3 km under the Pacific in 2071.
HEART: A sister lying to keep her brother alive, in a station no one is coming for.
CAST:
${cast}
ARC TITLE: ${title}
ARC GOAL: The crew learns no one is coming and saves itself.
CHAPTERS:
${chapters}
THREADS:
${threads}`;

const beatsReply = (previous) =>
  `${previous ? `PREVIOUS CHAPTER: ${previous}\n` : ""}BEATS:\n- Noor reads the cancellation.\n- She lies to Tavish.\n- The hull rings.\n- Tavish goes outside.`;

const prose = (seed) => `${seed} checked the coolant loop twice and swore at the pressure gauge. `.repeat(25).trim();
const writeReply = ({ passage = prose("Noor"), happened = "Noor lies to Tavish.", changes = "" } = {}) =>
  `PASSAGE:\n${passage}\nHAPPENED: ${happened}\nCHANGES:\n${changes}`;

const emptyBook = { chapters: [] };

// A book with an arc planned and its first chapter's beats ready.
function plannedBook() {
  let state = applyArcPlan(firstArcPlan(), emptyState(), "author-one");
  state = applyChapterPlan(beatsReply(), state, 1);
  return { state, book: emptyBook };
}

function writeBeat({ state, book }, seed) {
  const written = applyPassage(parsePassage(writeReply({ passage: prose(seed) })), state, book);
  return { state: written.state, book: written.book };
}

describe("deciding what to do next", () => {
  test("plans an arc for an empty book", () => {
    assert.equal(nextStep(emptyState()), "plan-arc");
  });

  test("plans the first chapter once the arc exists", () => {
    assert.equal(nextStep(applyArcPlan(firstArcPlan(), emptyState(), "author-one")), "plan-chapter");
  });

  test("writes while the chapter has beats left", () => {
    assert.equal(nextStep(plannedBook().state), "write");
  });

  test("plans the next chapter once every beat is written", () => {
    let progress = plannedBook();
    for (const seed of ["Ana", "Ben", "Cyd", "Dov"]) progress = writeBeat(progress, seed);
    assert.equal(nextStep(progress.state), "plan-chapter");
  });

  test("closes the arc after its last planned chapter, then plans a new one", () => {
    let progress = plannedBook();
    for (let chapter = 1; chapter <= 3; chapter++) {
      if (chapter > 1) progress.state = applyChapterPlan(beatsReply("Things happened."), progress.state, chapter);
      for (const seed of ["Ana", "Ben", "Cyd", "Dov"]) progress = writeBeat(progress, `${seed}${chapter}`);
    }
    assert.equal(nextStep(progress.state), "close-arc");
    const closed = applyArcClose("LAST CHAPTER: They surfaced.\nARC SUMMARY: The crew saved itself.\nSTATUS:\n- Noor: on the surface\nRESOLVED: 1", progress.state);
    assert.equal(nextStep(closed), "plan-arc");
    assert.equal(progress.book.chapters.length, 3);
  });
});

describe("planning an arc", () => {
  test("sets up the world, cast, chapters and threads on the first arc", () => {
    const state = applyArcPlan(firstArcPlan(), emptyState(), "author-one");
    assert.match(state.setting, /Meridian Deep/);
    assert.match(state.heart, /sister/);
    assert.deepEqual(state.cast.map((character) => [character.name, character.wants]), [
      ["Noor Achterberg", "her brother home alive"],
      ["Tavish Okonkwo", "to prove he isn't a kid"],
    ]);
    assert.deepEqual(state.arcs[0].plan.map((chapter) => chapter.title), ["The Cancelled Sub", "Load", "Rising"]);
    assert.equal(state.arcs[0].author, "author-one");
    assert.deepEqual(state.threads, ["Who cancelled the sub?"]);
  });

  test("keeps the world and heart on later arcs", () => {
    const first = { ...applyArcPlan(firstArcPlan(), emptyState(), "one"), arcs: [] };
    const cast = "- Dagny Prell | she | chief | wants: the contract | flaw: cold";
    const second = applyArcPlan(firstArcPlan({ cast }).replace("Meridian Deep", "Somewhere Else"), first, "two");
    assert.match(second.setting, /Meridian Deep/);
  });

  test("rejects a character without a want and a flaw", () => {
    assert.throws(() => applyArcPlan(firstArcPlan({ cast: "- Noor | she | engineer\n- Tavish | he | tech | wants: x | flaw: y" }), emptyState(), "a"), /wants: … \| flaw/);
  });

  test("rejects names that start alike", () => {
    const cast = "- Mara Voss | she | medic | wants: x | flaw: y\n- Mari Lund | she | pilot | wants: x | flaw: y";
    assert.throws(() => applyArcPlan(firstArcPlan({ cast }), emptyState(), "a"), /too close to "Mara Voss"/);
  });

  test("rejects an arc with too few chapters", () => {
    assert.throws(() => applyArcPlan(firstArcPlan({ chapters: "1. Only: One chapter." }), emptyState(), "a"), /plan 3 to 8/);
  });

  test("rejects a chapter title in capitals", () => {
    const chapters = "1. THE SUB: x.\n2. Load: y.\n3. Rising: z.";
    assert.throws(() => applyArcPlan(firstArcPlan({ chapters }), emptyState(), "a"), /all capitals/);
  });

  test("rejects an arc that opens too many threads at once", () => {
    const threads = Array.from({ length: 4 }, (_, index) => `- Thread ${index}`).join("\n");
    assert.throws(() => applyArcPlan(firstArcPlan({ threads }), emptyState(), "a"), /open at most 3/);
  });

  test("rejects an arc that would push the open threads past the limit", () => {
    const crowded = { ...emptyState(), setting: "x", heart: "y", threads: ["a", "b", "c", "d", "e"] };
    assert.throws(() => applyArcPlan(firstArcPlan({ threads: "- f\n- g" }), crowded, "a"), /6 open threads|7 open threads/);
  });

  test("asks the first showrunner to invent the world", () => {
    assert.match(arcPlanPrompt(emptyState(), emptyBook).user, /The book is empty\. Invent its world/);
  });
});

describe("planning a chapter", () => {
  test("titles the arc's first chapter from the plan and marks where the arc starts", () => {
    const { state } = plannedBook();
    assert.equal(state.chapter.title, "The Cancelled Sub");
    assert.equal(state.chapter.beats.length, 4);
    assert.equal(state.arcs[0].firstChapter, 1);
  });

  test("records the finished chapter and moves to the next title", () => {
    let progress = plannedBook();
    for (const seed of ["Ana", "Ben", "Cyd", "Dov"]) progress = writeBeat(progress, seed);
    const state = applyChapterPlan(beatsReply("Noor lied."), progress.state, 2);
    assert.equal(state.chapter.title, "Load");
    assert.deepEqual(state.arcs[0].chapterSummaries, ["Noor lied."]);
    assert.equal(state.arcs[0].firstChapter, 1);
  });

  test("requires a summary of the chapter just finished", () => {
    let progress = plannedBook();
    for (const seed of ["Ana", "Ben", "Cyd", "Dov"]) progress = writeBeat(progress, seed);
    assert.throws(() => applyChapterPlan(beatsReply(), progress.state, 2), /PREVIOUS CHAPTER/);
  });

  test("rejects too few beats", () => {
    const { state } = plannedBook();
    assert.throws(() => applyChapterPlan("BEATS:\n- One.\n- Two.", { ...state, chapter: null }, 1), /plan 4 to 8/);
  });
});

describe("writing a beat", () => {
  test("opens the chapter with the first beat and records what happened", () => {
    const { state, book } = writeBeat(plannedBook(), "Noor");
    assert.deepEqual(book.chapters, [{ title: "The Cancelled Sub", passages: [prose("Noor")] }]);
    assert.deepEqual(state.chapter.events, ["Noor lies to Tavish."]);
  });

  test("adds later beats to the same chapter", () => {
    const { book } = writeBeat(writeBeat(plannedBook(), "Noor"), "Tavish");
    assert.equal(book.chapters.length, 1);
    assert.equal(book.chapters[0].passages.length, 2);
  });

  test("applies the changes a writer proposes", () => {
    const { state, book } = plannedBook();
    const changes = "- status: Tavish Okonkwo: outside the hull\n- new character: Dagny Prell | she | chief | wants: the contract | flaw: cold\n- resolved: 1\n- new thread: Who rang the hull?";
    const written = applyPassage(parsePassage(writeReply({ changes })), state, book).state;
    assert.equal(written.cast.find((character) => character.name === "Tavish Okonkwo").status, "outside the hull");
    assert.equal(written.cast.at(-1).name, "Dagny Prell");
    assert.deepEqual(written.threads, ["Who rang the hull?"]);
  });

  test("never lets a writer rename or drop a character", () => {
    const { state, book } = plannedBook();
    assert.throws(() => applyPassage(parsePassage(writeReply({ changes: "- rename: Noor: Nora" })), state, book), /Changes are/);
  });

  test("finds a character by first name", () => {
    const { state, book } = plannedBook();
    const written = applyPassage(parsePassage(writeReply({ changes: "- status: Noor: bleeding" })), state, book).state;
    assert.equal(written.cast[0].status, "bleeding");
  });

  test("rejects a status change for someone not in the cast", () => {
    const { state, book } = plannedBook();
    assert.throws(() => applyPassage(parsePassage(writeReply({ changes: "- status: Ghost: gone" })), state, book), /someone in the cast/);
  });

  test("rejects passages that are too short or too long", () => {
    const { state, book } = plannedBook();
    assert.throws(() => applyPassage(parsePassage(writeReply({ passage: "Too short." })), state, book), /at least/);
    assert.throws(() => applyPassage(parsePassage(writeReply({ passage: "x".repeat(MAX_PASSAGE_CHARS + 1) })), state, book), /under/);
  });

  test("rejects bookkeeping in the passage", () => {
    const { state, book } = plannedBook();
    assert.throws(() => applyPassage(parsePassage(writeReply({ passage: `${prose("Noor")}\n\nBeat 3: the hull rings.` })), state, book), /only story text/);
  });

  test("rejects a passage that repeats the chapter", () => {
    const progress = writeBeat(plannedBook(), "Noor");
    assert.throws(() => writeBeat(progress, "Noor"), /repeats text/);
  });

  test("shows the writer which beat is theirs", () => {
    const { state, book } = writeBeat(plannedBook(), "Noor");
    const { user } = writePrompt(state, book);
    assert.match(user, /1\. Noor reads the cancellation\.   \(written\)\n2\. She lies to Tavish\.   ← YOUR BEAT/);
    assert.match(user, /## The chapter so far\nNoor checked/);
  });
});

describe("closing an arc", () => {
  test("records the summary, updates the cast and resolves threads", () => {
    const { state } = plannedBook();
    const closed = applyArcClose("LAST CHAPTER: They surfaced.\nARC SUMMARY: The crew saved itself.\nSTATUS:\n- Noor Achterberg: on the surface\nRESOLVED: 1", state);
    assert.equal(closed.arcs[0].isClosed, true);
    assert.equal(closed.arcs[0].summary, "The crew saved itself.");
    assert.equal(closed.cast[0].status, "on the surface");
    assert.deepEqual(closed.threads, []);
  });

  test("rejects a thread number that doesn't exist", () => {
    const { state } = plannedBook();
    assert.throws(() => applyArcClose("LAST CHAPTER: x\nARC SUMMARY: y\nRESOLVED: 4", state), /no open thread 4/);
  });
});

describe("reading replies", () => {
  test("tolerates bold labels, headings and code fences", () => {
    assert.deepEqual(parseSections("```\n**VERDICT:** APPROVE\n## REASON: fine\n```", ["VERDICT", "REASON"]), { VERDICT: "APPROVE", REASON: "fine" });
  });

  test("rejects a section given twice", () => {
    assert.throws(() => parseSections("VERDICT: APPROVE\nVERDICT: REVISE", ["VERDICT"]), RejectedReply);
  });

  test("reads the editor's verdict", () => {
    assert.deepEqual(parseVerdict("VERDICT: APPROVE"), { isApproved: true, reason: "" });
    assert.deepEqual(parseVerdict("VERDICT: REVISE\nREASON: The countdown repeats."), { isApproved: false, reason: "The countdown repeats." });
    assert.throws(() => parseVerdict("Looks good to me!"), RejectedReply);
  });

  test("keeps a passage where a character says happened mid-sentence", () => {
    const passage = `${prose("Noor")} "What happened: tell me," she said.`;
    assert.equal(parsePassage(writeReply({ passage })).passage, passage);
  });
});

test("gives each arc the next author in turn", () => {
  assert.deepEqual([1, 2, 3, 4].map((arc) => authorFor(arc, ["a", "b", "c"])), ["a", "b", "c", "a"]);
});
