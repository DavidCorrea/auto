import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseProse, chapterToOpen } from "../site/book.js";

describe("reading a writer's text", () => {
  test("splits paragraphs on blank lines and marks italics", () => {
    assert.deepEqual(parseProse("She said *no* <b>.\n\nThen left."), [
      [[{ text: "She said ", isItalic: false }, { text: "no", isItalic: true }, { text: " <b>.", isItalic: false }]],
      [[{ text: "Then left.", isItalic: false }]],
    ]);
  });

  test("keeps single newlines as line breaks within a paragraph", () => {
    assert.deepEqual(parseProse("One\nTwo"), [[[{ text: "One", isItalic: false }], [{ text: "Two", isItalic: false }]]]);
  });

  test("leaves a lone asterisk as text", () => {
    assert.deepEqual(parseProse("5 * 3"), [[[{ text: "5 * 3", isItalic: false }]]]);
  });
});

describe("where a reader lands", () => {
  test("a first visit starts at Chapter I", () => {
    assert.equal(chapterToOpen(null, 5), 1);
  });

  test("a returning reader reopens the chapter they were reading", () => {
    assert.equal(chapterToOpen("4", 5), 4);
  });

  test("falls back to Chapter I when the remembered chapter doesn't exist", () => {
    for (const stored of ["9", "0", "abc", "", "newest"]) assert.equal(chapterToOpen(stored, 5), 1);
  });
});
