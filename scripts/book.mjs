// Reads and writes the book. Chapters live in site/chapters/NNN.json, where the reader
// (site/book.js) loads them; site/book.json is an index of them for the contents.
// The bible, the synopsis and the note between writers stay in book/, off the site.

import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";

export const BOOK_TITLE = "Every Now and Then";
const CHAPTER_FILE_PATTERN = /^(\d+)\.json$/;

export const chapterSlug = (number) => String(number).padStart(3, "0");

async function readOptional(filePath) {
  try {
    return (await readFile(filePath, "utf8")).trim();
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
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
  return {
    chapters,
    bible: await readOptional(path.join(bookDir, "bible.txt")),
    synopsis: await readOptional(path.join(bookDir, "synopsis.txt")),
    note: await readOptional(path.join(bookDir, "next.txt")),
  };
}

const countWords = (text) => text.split(/\s+/).filter(Boolean).length;

// What the reader needs to draw the contents and counts without loading every chapter.
export function bookIndex(book) {
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
  await writeFile(path.join(bookDir, "bible.txt"), `${book.bible}\n`);
  await writeFile(path.join(bookDir, "synopsis.txt"), `${book.synopsis}\n`);
  await writeFile(path.join(bookDir, "next.txt"), `${book.note}\n`);
}

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
