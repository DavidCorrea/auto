import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseTurn,
  applyTurn,
  renderPrompt,
  lastPage,
  summarize,
  RejectedTurn,
  MIN_CHAPTER_CHARS,
  MAX_CHAPTER_CHARS,
  MAX_PASSAGE_CHARS,
  MAX_BIBLE_CHARS,
} from "./grow.mjs";

const paragraph = (seed) => `${seed} walked down to the harbour and counted the boats twice. `.repeat(6).trim();
const passage = paragraph("Ottoline");

const bible = "Heart:\n- Whether Ottoline keeps the light on\nCharacters:\n- Ottoline, she, keeps the lighthouse; wants: the letter's sender; flaw: proud\nPlaces:\n- The harbour\nThings and rules:\n- The boats\nOpen threads:\n- Who sent the letter?";

const bookWith = (chapterText) => ({
  chapters: [{ title: "The Desk", passages: [chapterText] }],
  bible,
  synopsis: "An agent at a desk.",
  note: "Open the box.",
});
const book = bookWith("x".repeat(MIN_CHAPTER_CHARS));

const reply = ({ newChapter, body = passage, bibleText = bible, synopsis = "Ottoline counts boats.", next = "Let a storm arrive." } = {}) =>
  [newChapter && `NEW CHAPTER: ${newChapter}`, "PASSAGE:", body, "BIBLE:", bibleText, "SYNOPSIS:", synopsis, "NEXT:", next]
    .filter(Boolean)
    .join("\n");

describe("reading the model's reply", () => {
  test("reads each section", () => {
    assert.deepEqual(parseTurn(reply({ newChapter: "Low Tide" })), {
      newChapterTitle: "Low Tide",
      passage,
      bible,
      synopsis: "Ottoline counts boats.",
      note: "Let a storm arrive.",
    });
  });

  test("tolerates code fences, bold labels and text on the label line", () => {
    const messy = "Sure!\n```\n**PASSAGE:**\nShe ran.\n\nThen stopped.\n**SYNOPSIS:** Running.\n**NEXT:** Stop.\n```";
    const turn = parseTurn(messy);
    assert.equal(turn.passage, "She ran.\n\nThen stopped.");
    assert.equal(turn.synopsis, "Running.");
    assert.equal(turn.note, "Stop.");
    assert.equal(turn.newChapterTitle, null);
  });

  test("drops a chapter heading the model put inside the passage", () => {
    const turn = parseTurn(reply({ newChapter: '"Chapter 2: Low Tide"', body: `Chapter II: Low Tide\n\n${passage}` }));
    assert.equal(turn.passage, passage);
    assert.equal(turn.newChapterTitle, "Low Tide");
  });

  test("drops a bare chapter number the model put in the title", () => {
    for (const title of ["IV. The Ink Below", "4: The Ink Below", "Chapter IV — The Ink Below"]) {
      assert.equal(parseTurn(reply({ newChapter: title })).newChapterTitle, "The Ink Below");
    }
    assert.equal(parseTurn(reply({ newChapter: "Vigil" })).newChapterTitle, "Vigil");
  });

  test("keeps a passage that merely starts with the word chapter", () => {
    assert.match(parseTurn(reply({ body: `Chapter and verse, she said.\n\n${passage}` })).passage, /^Chapter and verse/);
  });

  test("removes lines that would split the passage in the chapter file", () => {
    assert.equal(parseTurn(reply({ body: "One.\n~\nTwo." })).passage, "One.\n\nTwo.");
  });
});

describe("adding a turn to the book", () => {
  test("appends the passage to the current chapter and replaces bible, synopsis and note", () => {
    const { book: grown, changedChapterNumbers } = applyTurn(parseTurn(reply()), book);
    assert.deepEqual(grown.chapters[0].passages.at(-1), passage);
    assert.equal(grown.bible, bible);
    assert.equal(grown.synopsis, "Ottoline counts boats.");
    assert.equal(grown.note, "Let a storm arrive.");
    assert.deepEqual(changedChapterNumbers, [1]);
  });

  test("starts a new chapter when asked", () => {
    const { book: grown, changedChapterNumbers } = applyTurn(parseTurn(reply({ newChapter: "Low Tide" })), book);
    assert.deepEqual(grown.chapters[1], { title: "Low Tide", passages: [passage] });
    assert.deepEqual(changedChapterNumbers, [2]);
  });

  test("leaves the original book untouched", () => {
    applyTurn(parseTurn(reply()), book);
    assert.equal(book.chapters[0].passages.length, 1);
  });

  test("rejects a placeholder chapter title", () => {
    assert.throws(() => applyTurn(parseTurn(reply({ newChapter: "xx" })), book), /placeholder/);
    assert.equal(applyTurn(parseTurn(reply({ newChapter: "Ash" })), book).book.chapters[1].title, "Ash");
  });

  test("rejects a chapter title in all capitals", () => {
    assert.throws(() => applyTurn(parseTurn(reply({ newChapter: "THE LOOP UNFOLDS" })), book), /all capitals/);
    assert.equal(applyTurn(parseTurn(reply({ newChapter: "The Loop at 5 AM" })), book).book.chapters[1].title, "The Loop at 5 AM");
  });

  test("rejects a new chapter before the current one is long enough", () => {
    assert.throws(() => applyTurn(parseTurn(reply({ newChapter: "Too Soon" })), bookWith("short")), /keep writing/);
  });

  test("requires a new chapter once the current one is full", () => {
    assert.throws(() => applyTurn(parseTurn(reply()), bookWith("x".repeat(MAX_CHAPTER_CHARS))), /full/);
  });

  test("requires a first chapter for an empty book", () => {
    const empty = { chapters: [], bible: "", synopsis: "", note: "" };
    assert.throws(() => applyTurn(parseTurn(reply()), empty), /empty/);
    assert.equal(applyTurn(parseTurn(reply({ newChapter: "One" })), empty).book.chapters.length, 1);
  });

  test("rejects missing sections", () => {
    assert.throws(() => applyTurn(parseTurn(`PASSAGE:\n${passage}\nBIBLE:\n${bible}\nSYNOPSIS:\nx`), book), /NEXT/);
    assert.throws(() => applyTurn(parseTurn(`PASSAGE:\n${passage}\nSYNOPSIS:\nx\nNEXT:\ny`), book), /BIBLE/);
    assert.throws(() => applyTurn(parseTurn("Once upon a time."), book), /PASSAGE/);
  });

  test("rejects passages that are too short or too long", () => {
    assert.throws(() => applyTurn(parseTurn(reply({ body: "She left." })), book), /at least/);
    assert.throws(() => applyTurn(parseTurn(reply({ body: "a ".repeat(MAX_PASSAGE_CHARS) })), book), /under/);
  });

  test("rejects bookkeeping that slipped into the passage", () => {
    for (const leak of ["PARAGRAPH TWO:\nThen rain.", "Last page: approximately 380 words."]) {
      assert.throws(() => applyTurn(parseTurn(reply({ body: `${passage}\n\n${leak}` })), book), /only story text/);
    }
  });

  test("rejects a reply that gives a section twice", () => {
    assert.throws(() => parseTurn(`${reply()}\nSYNOPSIS:\nAgain.\nNEXT:\nAgain.`), /more than one SYNOPSIS/);
  });

  test("keeps a passage where a character says next or passage mid-sentence", () => {
    const body = `${passage}\n\nThe passage was narrow. Next: the stairs, she thought.`;
    assert.equal(applyTurn(parseTurn(reply({ body })), book).book.chapters[0].passages.at(-1), body);
  });

  test("rejects a bible without its four lists", () => {
    assert.throws(() => applyTurn(parseTurn(reply({ bibleText: bible.replace("Places:", "Sites:") })), book), /missing these headings: Places/);
  });

  test("rejects a character without a want and a flaw", () => {
    const flat = bible.replace("; wants: the letter's sender; flaw: proud", "");
    assert.throws(() => applyTurn(parseTurn(reply({ bibleText: flat })), book), /"wants:" and "flaw:".*Ottoline/);
  });

  test("rejects a bible with no character on its own line", () => {
    const crammed = bible.replace("Characters:\n- Ottoline", "Characters: Ottoline");
    assert.throws(() => applyTurn(parseTurn(reply({ bibleText: crammed })), book), /lists no characters/);
  });

  test("rejects a bible that has grown too long", () => {
    assert.throws(() => applyTurn(parseTurn(reply({ bibleText: `${bible}\n${"- x\n".repeat(MAX_BIBLE_CHARS)}` })), book), /bible is/);
  });

  test("rejects a bible that rewrites the heart", () => {
    const drifted = bible.replace("Whether Ottoline keeps the light on", "Whether the boats sail");
    assert.throws(() => applyTurn(parseTurn(reply({ bibleText: drifted })), book), /Heart.*Whether Ottoline keeps the light on/);
  });

  test("keeps a heart copied with different case, punctuation or layout", () => {
    const restyled = bible.replace("Heart:\n- Whether Ottoline keeps the light on", "**Heart:** whether Ottoline keeps the light on.");
    assert.doesNotThrow(() => applyTurn(parseTurn(reply({ bibleText: restyled })), book));
  });

  test("lets the first writer set the heart", () => {
    const blank = { ...book, bible: "" };
    assert.doesNotThrow(() => applyTurn(parseTurn(reply()), blank));
  });

  test("rejects a passage that repeats the last page", () => {
    const repeating = bookWith(`Before that, ${passage}`);
    assert.throws(() => applyTurn(parseTurn(reply()), repeating), RejectedTurn);
  });
});

describe("what the model sees", () => {
  test("shows contents, synopsis, note and the chapter's length", () => {
    const prompt = renderPrompt(book);
    assert.match(prompt, /## Contents\nI\. The Desk/);
    assert.match(prompt, /## The bible\nHeart:\n- Whether Ottoline/);
    assert.match(prompt, /## The story so far\nAn agent at a desk\./);
    assert.match(prompt, /## Note from the previous writer\nOpen the box\./);
    assert.match(prompt, new RegExp(`Chapter I has ${MIN_CHAPTER_CHARS} of at most ${MAX_CHAPTER_CHARS}`));
  });

  test("tells the writer its place in line and the time of its shift", () => {
    const prompt = renderPrompt(book, new Date("2026-11-24T19:05:00Z"));
    assert.match(prompt, /## Your shift\nYou are writer number 2\. Your shift began at 19:05 UTC on 2026-11-24\./);
  });

  test("says when the chapter is full", () => {
    assert.match(renderPrompt(bookWith("x".repeat(MAX_CHAPTER_CHARS))), /must start a new chapter/);
  });

  test("shows only the end of a long chapter, starting at a paragraph", () => {
    const long = bookWith(`${"a".repeat(5000)}\n\nThe last paragraph.`);
    assert.equal(lastPage(long), "…\n\nThe last paragraph.");
  });
});

test("summarizes a turn by its chapter and opening words", () => {
  const { book: grown } = applyTurn(parseTurn(reply({ body: `*Rain* came. ${passage}` })), book);
  assert.equal(summarize(grown), "Chapter I: Rain came. Ottoline walked down to the harbour and counted…");
});
