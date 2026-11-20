// Asks a model for one small edit to the website and applies it.
// The model sees only the site: the note the previous run left in next.txt, a map
// of every file, and the full source of index.html plus one randomly chosen file.
// It has no memory of earlier runs beyond that note.

import { readFile, writeFile, readdir, appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SITE_DIR = path.resolve(process.env.SITE_DIR || "site");
const API_URL = process.env.API_URL || "https://openrouter.ai/api/v1/chat/completions";
// Routes to whichever free model is available, so the default survives individual models being retired.
const MODEL = process.env.MODEL || "openrouter/free";
const API_KEY = process.env.API_KEY;

const MAX_ATTEMPTS = 3;
const MAX_EDIT_CHARS = 4000;
// Caps each file so the site grows wider (more files) rather than a few files growing
// without bound, which keeps what the model reads each run roughly constant.
export const MAX_FILE_CHARS = 20000;
const ENTRANCE = "index.html";
// Written only through the NEXT line of a reply, so each run hands a different direction to the next.
export const HANDOFF_FILE = "next.txt";
const EDITABLE_EXTENSIONS = new Set([".html", ".css", ".js", ".svg", ".txt", ".md", ".json"]);

const INSTRUCTIONS = `You tend a website that grows by itself, one small change at a time.
Each change is made by someone new who sees only the site and the note the previous one left.
Below is that note, a map of every file in the site, and the full source of a few files.

1. Make exactly one small change, using the previous note as your starting point:
   edit one of the files shown in full, or create a new file.
   Prefer changes a visitor would notice. Don't just add another line like the ones already there.
2. Leave a note for the next person suggesting a change of a totally different kind from yours.
   If you wrote words, suggest something visual, interactive, structural, a new page, or removing something — and so on.

Keep the site working. Each file can hold at most ${MAX_FILE_CHARS} characters; when one is full, grow the site with new files instead.

Reply with only this, nothing else:

FILE: <path relative to the site root>
SUMMARY: <one short line describing the change>
NEXT: <one or two sentences for the next person: a totally different kind of change to make>
<<<<<<< FIND
<text copied exactly from the file, unique within it; leave empty to create a new file>
=======
<the text that replaces it>
>>>>>>> REPLACE`;

const EDIT_PATTERN =
  /FILE:[ \t]*(.+?)[ \t]*\nSUMMARY:[ \t]*(.+?)[ \t]*\nNEXT:[ \t]*(.+?)[ \t]*\n<<<<<<< FIND\n([\s\S]*?)\n?=======\n([\s\S]*?)\n?>>>>>>> REPLACE/;

export class RejectedEdit extends Error {}

export async function readSite(siteDir) {
  const entries = await readdir(siteDir, { recursive: true, withFileTypes: true });
  const files = new Map();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const absolutePath = path.join(entry.parentPath, entry.name);
    if (!EDITABLE_EXTENSIONS.has(path.extname(absolutePath))) continue;
    const relativePath = path.relative(siteDir, absolutePath).split(path.sep).join("/");
    files.set(relativePath, await readFile(absolutePath, "utf8"));
  }
  return new Map([...files].sort(([a], [b]) => a.localeCompare(b)));
}

function firstMatch(content, pattern) {
  const text = content.match(pattern)?.[1]?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > 120 ? `${text.slice(0, 119)}…` : text;
}

export function describeFile(filePath, content) {
  const line = `${filePath}  (${content.length} chars)`;
  if (path.posix.extname(filePath) !== ".html") return line;
  const title = firstMatch(content, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = firstMatch(content, /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  return [line, title && `"${title}"`, description && `— ${description}`].filter(Boolean).join("  ");
}

export function chooseVisibleFiles(files, randomIndex = (count) => Math.floor(Math.random() * count)) {
  const visible = files.has(ENTRANCE) ? [ENTRANCE] : [];
  const others = [...files.keys()].filter((filePath) => filePath !== ENTRANCE && filePath !== HANDOFF_FILE);
  if (others.length > 0) visible.push(others[randomIndex(others.length)]);
  return visible;
}

export function renderPrompt(files, visiblePaths) {
  const note = files.get(HANDOFF_FILE)?.trim() || "(none yet — you are the first)";
  const map = [...files].map(([filePath, content]) => describeFile(filePath, content)).join("\n");
  const sources = visiblePaths.map((filePath) => `===== ${filePath} =====\n${files.get(filePath)}`).join("\n\n");
  return `## Note from the previous change\n${note}\n\n## Site map\n${map}\n\n## Files shown in full\n${sources}`;
}

export function parseEdit(reply) {
  const match = reply.replace(/\r\n/g, "\n").match(EDIT_PATTERN);
  if (!match) throw new RejectedEdit("Reply did not follow the FILE / SUMMARY / NEXT / FIND / REPLACE format.");
  const [, filePath, summary, next, find, replace] = match;
  return { filePath, summary, next, find, replace };
}

export function applyEdit(edit, files, visiblePaths) {
  const { filePath, find, replace } = edit;
  const normalizedPath = path.posix.normalize(filePath);

  if (path.posix.isAbsolute(normalizedPath) || normalizedPath.startsWith("..")) {
    throw new RejectedEdit(`Path "${filePath}" is outside the site.`);
  }
  if (!EDITABLE_EXTENSIONS.has(path.posix.extname(normalizedPath))) {
    throw new RejectedEdit(`Path "${filePath}" must end in one of: ${[...EDITABLE_EXTENSIONS].join(", ")}.`);
  }
  if (normalizedPath === HANDOFF_FILE) {
    throw new RejectedEdit(`"${HANDOFF_FILE}" is written from your NEXT line; change a different file.`);
  }
  if (find.length + replace.length > MAX_EDIT_CHARS) {
    throw new RejectedEdit(`Edit is ${find.length + replace.length} characters; keep it under ${MAX_EDIT_CHARS}.`);
  }
  if (find === replace) throw new RejectedEdit("FIND and REPLACE are identical, so nothing changes.");

  const current = files.get(normalizedPath);

  if (find === "") {
    if (current !== undefined) throw new RejectedEdit(`"${filePath}" already exists; FIND must not be empty.`);
    if (replace.trim() === "") throw new RejectedEdit(`New file "${filePath}" would be empty.`);
    return { filePath: normalizedPath, content: replace };
  }

  if (current === undefined) throw new RejectedEdit(`"${filePath}" does not exist.`);
  if (!visiblePaths.includes(normalizedPath)) {
    throw new RejectedEdit(`"${filePath}" isn't shown in full; edit one of ${visiblePaths.join(", ")} or create a new file.`);
  }
  const occurrences = current.split(find).length - 1;
  if (occurrences !== 1) {
    throw new RejectedEdit(`FIND text appears ${occurrences} times in "${filePath}"; it must appear exactly once.`);
  }
  const content = current.replace(find, () => replace);
  // Shrinking is always allowed, so a file that is already over the limit can still be trimmed.
  if (content.length > MAX_FILE_CHARS && content.length > current.length) {
    throw new RejectedEdit(
      `"${filePath}" would be ${content.length} characters, over the ${MAX_FILE_CHARS} limit; put new content in a new file.`,
    );
  }
  return { filePath: normalizedPath, content };
}

async function askModel(messages) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Model request to ${API_URL} (${MODEL}) failed with ${response.status}: ${text}`);
  }
  const content = parseJsonOrNull(text)?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error(`Model request to ${API_URL} (${MODEL}) returned no completion: ${text.slice(0, 500)}`);
  }
  return content;
}

function parseJsonOrNull(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function grow() {
  if (!API_KEY) throw new Error("API_KEY is not set; in GitHub Actions it comes from the MODEL_API_KEY repo secret.");

  const files = await readSite(SITE_DIR);
  const visiblePaths = chooseVisibleFiles(files);
  console.log(`Showing in full: ${visiblePaths.join(", ")}`);

  const messages = [
    { role: "system", content: INSTRUCTIONS },
    { role: "user", content: renderPrompt(files, visiblePaths) },
  ];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const reply = await askModel(messages);
    try {
      const edit = parseEdit(reply);
      const result = applyEdit(edit, files, visiblePaths);
      const destination = path.join(SITE_DIR, result.filePath);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, result.content);
      await writeFile(path.join(SITE_DIR, HANDOFF_FILE), `${edit.next}\n`);
      console.log(`Applied: ${edit.summary} (${result.filePath})`);
      console.log(`Next: ${edit.next}`);
      if (process.env.GITHUB_OUTPUT) {
        await appendFile(process.env.GITHUB_OUTPUT, `summary=${edit.summary.replace(/\s+/g, " ")}\n`);
      }
      return;
    } catch (error) {
      if (!(error instanceof RejectedEdit)) throw error;
      console.log(`Attempt ${attempt} rejected: ${error.message}`);
      messages.push({ role: "assistant", content: reply });
      messages.push({ role: "user", content: `That edit was rejected: ${error.message} Try again.` });
    }
  }
  throw new Error(`No valid edit after ${MAX_ATTEMPTS} attempts.`);
}

const isRunDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isRunDirectly) {
  await grow();
}
