import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readBook, writeBook, bookIndex, toRoman } from "./book.mjs";

const book = {
  chapters: [
    { title: "The Desk", passages: ["First words here.", "Second."] },
    { title: "A Box", passages: ["Third."] },
  ],
  bible: "Characters:\n- The agent",
  synopsis: "Someone waved.",
  note: "Open the box.",
};

async function emptyPlaces() {
  const root = await mkdtemp(path.join(tmpdir(), "book-"));
  return { bookDir: path.join(root, "book"), siteDir: path.join(root, "site") };
}

describe("storing the book", () => {
  test("reads a book that hasn't been started as empty", async () => {
    assert.deepEqual(await readBook(await emptyPlaces()), { chapters: [], bible: "", synopsis: "", note: "" });
  });

  test("round-trips chapters, bible, synopsis and note", async () => {
    const places = await emptyPlaces();
    await writeBook(places, book, [1, 2]);
    assert.deepEqual(await readBook(places), book);
  });

  test("keeps chapters on the site and the writers' notes and bible off it", async () => {
    const places = await emptyPlaces();
    await writeBook(places, book, [1, 2]);
    const chapter = JSON.parse(await readFile(path.join(places.siteDir, "chapters", "002.json"), "utf8"));
    assert.deepEqual(chapter, { title: "A Box", passages: ["Third."] });
    assert.equal(await readFile(path.join(places.bookDir, "next.txt"), "utf8"), "Open the box.\n");
    assert.equal(await readFile(path.join(places.bookDir, "bible.txt"), "utf8"), "Characters:\n- The agent\n");
  });

  test("reads chapters in numeric order", async () => {
    const places = await emptyPlaces();
    const chapters = Array.from({ length: 11 }, (_, index) => ({ title: `T${index + 1}`, passages: ["x"] }));
    await writeBook(places, { ...book, chapters }, chapters.map((_, index) => index + 1));
    assert.equal((await readBook(places)).chapters.at(-1).title, "T11");
  });

  test("names the chapter file that is malformed", async () => {
    const places = await emptyPlaces();
    await mkdir(path.join(places.siteDir, "chapters"), { recursive: true });
    await writeFile(path.join(places.siteDir, "chapters", "001.json"), `{"title": "x"}`);
    await assert.rejects(readBook(places), /001\.json needs/);
  });
});

describe("the index the reader loads", () => {
  test("numbers chapters and counts words and hands", () => {
    assert.deepEqual(bookIndex(book), {
      title: "Auto",
      words: 5,
      passages: 3,
      chapters: [
        { number: 1, numeral: "I", title: "The Desk", words: 4, passages: 2 },
        { number: 2, numeral: "II", title: "A Box", words: 1, passages: 1 },
      ],
    });
  });

  test("numbers chapters in Roman numerals", () => {
    assert.deepEqual([1, 4, 9, 14, 40, 1999].map(toRoman), ["I", "IV", "IX", "XIV", "XL", "MCMXCIX"]);
  });

  test("is rewritten on every save", async () => {
    const places = await emptyPlaces();
    await writeBook(places, book, [1, 2]);
    const index = JSON.parse(await readFile(path.join(places.siteDir, "book.json"), "utf8"));
    assert.equal(index.chapters.length, 2);
  });
});
