// Asks a model for one small edit to the website and applies it.
// The model sees only the site's files; it has no memory of earlier runs.

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
// Keeps each request well inside free-tier tokens-per-minute quotas.
const MAX_SITE_CHARS = Number(process.env.MAX_SITE_CHARS || 100000);
const EDITABLE_EXTENSIONS = new Set([".html", ".css", ".js", ".svg", ".txt", ".md", ".json"]);

const INSTRUCTIONS = `You tend a website that grows by itself, one small change at a time.
Below is the website's complete source. Make exactly one small change to it.
It can be anything — add, remove, fix, restyle, rewrite — as long as it is small and the site keeps working.

Reply with only this, nothing else:

FILE: <path relative to the site root>
SUMMARY: <one short line describing the change>
<<<<<<< FIND
<text copied exactly from the file, unique within it; leave empty to create a new file>
=======
<the text that replaces it>
>>>>>>> REPLACE`;

const EDIT_PATTERN =
  /FILE:[ \t]*(.+?)[ \t]*\nSUMMARY:[ \t]*(.+?)[ \t]*\n<<<<<<< FIND\n([\s\S]*?)\n?=======\n([\s\S]*?)\n?>>>>>>> REPLACE/;

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

export function renderSite(files) {
  return [...files].map(([filePath, content]) => `===== ${filePath} =====\n${content}`).join("\n\n");
}

export function parseEdit(reply) {
  const match = reply.replace(/\r\n/g, "\n").match(EDIT_PATTERN);
  if (!match) throw new RejectedEdit("Reply did not follow the FILE / SUMMARY / FIND / REPLACE format.");
  const [, filePath, summary, find, replace] = match;
  return { filePath, summary, find, replace };
}

export function applyEdit(edit, files) {
  const { filePath, find, replace } = edit;
  const normalizedPath = path.posix.normalize(filePath);

  if (path.posix.isAbsolute(normalizedPath) || normalizedPath.startsWith("..")) {
    throw new RejectedEdit(`Path "${filePath}" is outside the site.`);
  }
  if (!EDITABLE_EXTENSIONS.has(path.posix.extname(normalizedPath))) {
    throw new RejectedEdit(`Path "${filePath}" must end in one of: ${[...EDITABLE_EXTENSIONS].join(", ")}.`);
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
  const occurrences = current.split(find).length - 1;
  if (occurrences !== 1) {
    throw new RejectedEdit(`FIND text appears ${occurrences} times in "${filePath}"; it must appear exactly once.`);
  }
  return { filePath: normalizedPath, content: current.replace(find, () => replace) };
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
  const site = renderSite(files);
  if (site.length > MAX_SITE_CHARS) {
    throw new Error(`Site is ${site.length} characters, over the ${MAX_SITE_CHARS} limit the model can take in.`);
  }

  const messages = [
    { role: "system", content: INSTRUCTIONS },
    { role: "user", content: site },
  ];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const reply = await askModel(messages);
    try {
      const edit = parseEdit(reply);
      const result = applyEdit(edit, files);
      const destination = path.join(SITE_DIR, result.filePath);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, result.content);
      console.log(`Applied: ${edit.summary} (${result.filePath})`);
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
