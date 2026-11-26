// Reads and writes the book. Chapters live in site/chapters/NNN.json, where the reader
// (site/book.js) loads them; site/book.json is an index of them for the contents.
// The story's state (world, cast, threads, arc and chapter plans) stays in book/state.json, off the site.

import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";

export const BOOK_TITLE = "Auto";
const CHAPTER_FILE_PATTERN = /^(\d+)\.json$/;

export const chapterSlug = (number) => String(number).padStart(3, "0");

async function readStateOptional(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(`Reading the story state from ${filePath} failed: ${error.message}`);
  }
}

// A new book has no chapters folder until its first chapter is saved.
async function readdirOptional(directory) {
  try {
    return await readdir(directory);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function readBook({ bookDir, siteDir }) {
  const chaptersDir = path.join(siteDir, "chapters");
  const names = (await readdirOptional(chaptersDir))
    .filter((name) => CHAPTER_FILE_PATTERN.test(name))
    .sort((a, b) => Number(a.match(CHAPTER_FILE_PATTERN)[1]) - Number(b.match(CHAPTER_FILE_PATTERN)[1]));
  const chapters = [];
  for (const name of names) {
    const filePath = path.join(chaptersDir, name);
    const { title, passages } = JSON.parse(await readFile(filePath, "utf8"));
    if (typeof title !== "string" || !Array.isArray(passages)) {
      throw new Error(`Chapter file ${filePath} needs a "title" string and a "passages" array.`);
    }
    chapters.push({ title, passages });
  }
  // A book that hasn't been started has no state; the caller supplies an empty one.
  return { chapters, state: await readStateOptional(path.join(bookDir, "state.json")) };
}

const countWords = (text) => text.split(/\s+/).filter(Boolean).length;

// What the reader needs to draw the contents and counts without loading every chapter.
export function bookIndex(book) {
  // Arcs appear once their first chapter has been planned.
  const arcs = (book.state?.arcs ?? [])
    .map((arc, index) => ({ number: index + 1, title: arc.title, author: authorName(arc.author), firstChapter: arc.firstChapter }))
    .filter((arc) => arc.firstChapter);
  const chapters = book.chapters.map((chapter, index) => ({
    number: index + 1,
    numeral: toRoman(index + 1),
    title: chapter.title,
    words: countWords(chapter.passages.join(" ")),
    passages: chapter.passages.length,
  }));
  return {
    title: BOOK_TITLE,
    words: chapters.reduce((total, chapter) => total + chapter.words, 0),
    passages: chapters.reduce((total, chapter) => total + chapter.passages, 0),
    arcs,
    chapters,
  };
}

const toJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

export async function writeBook({ bookDir, siteDir }, book, changedChapterNumbers) {
  const chaptersDir = path.join(siteDir, "chapters");
  await mkdir(chaptersDir, { recursive: true });
  await mkdir(bookDir, { recursive: true });
  for (const number of changedChapterNumbers) {
    const { title, passages } = book.chapters[number - 1];
    await writeFile(path.join(chaptersDir, `${chapterSlug(number)}.json`), toJson({ title, passages }));
  }
  await writeFile(path.join(siteDir, "book.json"), toJson(bookIndex(book)));
  await writeFile(path.join(bookDir, "state.json"), toJson(book.state));
}

// "baidu/ernie-5.5-flash-preview:free" reads as "ernie-5.5-flash-preview" on the site.
export const authorName = (model) => model.replace(/^.*\//, "").replace(/:free$/, "");

export function toRoman(number) {
  const numerals = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let remaining = number;
  let roman = "";
  for (const [value, numeral] of numerals) {
    while (remaining >= value) {
      roman += numeral;
      remaining -= value;
    }
  }
  return roman;
}
