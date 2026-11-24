import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseProse, chapterFromHash, chapterHash } from "../site/book.js";

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

describe("the address", () => {
  test("names a chapter after the #", () => {
    assert.equal(chapterFromHash(chapterHash(12)), 12);
  });

  test("means the newest page when empty or unrecognised", () => {
    for (const hash of ["", "#", "#chapter-", "#latest"]) assert.equal(chapterFromHash(hash), null);
  });
});
