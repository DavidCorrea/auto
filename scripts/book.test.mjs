import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseChapter, serializeChapter, renderProse, renderIndex, renderChapter, toRoman } from "./book.mjs";

const book = {
  chapters: [
    { title: "The Desk", passages: ["First.", "Second."] },
    { title: "A <Box>", passages: ["Third."] },
  ],
  synopsis: "Someone waved.",
  note: "Open the *box*.",
};

describe("storing chapters as text", () => {
  test("round-trips a chapter through its file format", () => {
    const chapter = { title: "The Desk", passages: ["One.\n\nTwo.", "Three."] };
    assert.deepEqual(parseChapter(serializeChapter(chapter)), chapter);
  });

  test("reads a chapter with only a title", () => {
    assert.deepEqual(parseChapter("Empty\n"), { title: "Empty", passages: [] });
  });
});

describe("rendering prose", () => {
  test("turns blank-line paragraphs and asterisks into HTML, escaping the rest", () => {
    assert.equal(renderProse("She said *no* <b>.\n\nThen left."), "<p>She said <em>no</em> &#60;b&#62;.</p>\n<p>Then left.</p>");
  });

  test("numbers chapters in Roman numerals", () => {
    assert.deepEqual([1, 4, 9, 14, 40, 1999].map(toRoman), ["I", "IV", "IX", "XIV", "XL", "MCMXCIX"]);
  });
});

describe("rendering pages", () => {
  test("the front page opens on the newest passages and lists every chapter, without the writers' note or synopsis", () => {
    const index = renderIndex(book);
    assert.match(index, /The newest page · Chapter II/);
    assert.match(index, /<p>Third\.<\/p>/);
    assert.doesNotMatch(index, /<p>First\.<\/p>/);
    assert.match(index, /href="chapters\/001\.html">\s*<span class="contents-number">I</);
    assert.match(index, /A &#60;Box&#62;/);
    assert.doesNotMatch(index, /Open the|Someone waved/);
    assert.match(index, /2 chapters · 3 words · 3 hands/);
  });

  test("the front page points back to earlier passages when the chapter has more", () => {
    const longer = { ...book, chapters: [{ title: "Only", passages: ["One.", "Two.", "Three."] }] };
    const index = renderIndex(longer);
    assert.match(index, /earlier in this chapter/);
    assert.doesNotMatch(index, /<p>One\.<\/p>/);
    assert.match(index, /<p>Two\.<\/p>[\s\S]*<p>Three\.<\/p>/);
  });

  test("an earlier chapter links onward and has no newest page", () => {
    const chapter = renderChapter(book, 1);
    assert.match(chapter, /href="002\.html" rel="next"/);
    assert.doesNotMatch(chapter, /id="latest"|To be continued/);
  });

  test("every page carries the contents, marking the chapter being read", () => {
    const chapter = renderChapter(book, 2);
    assert.match(chapter, /href="\.\.\/chapters\/002\.html" aria-current="page"/);
    assert.match(chapter, /href="\.\.\/chapters\/001\.html">/);
    assert.doesNotMatch(renderIndex(book), /aria-current/);
  });

  test("the latest chapter marks its last passage and promises more", () => {
    const chapter = renderChapter(book, 2);
    assert.match(chapter, /<section class="passage" id="latest">\n<p>Third\.<\/p>/);
    assert.match(chapter, /To be continued/);
    assert.match(chapter, /href="001\.html" rel="prev"/);
  });
});
