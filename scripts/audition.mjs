// Gives each candidate model the same two tasks, so we can read their work side by side and pick
// the book's showrunner and authors by what they write rather than by reputation.
// Writes one Markdown file per model to AUDITION_DIR; the workflow uploads them as an artifact.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const API_URL = process.env.API_URL || "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = process.env.API_KEY;
const MODELS = (process.env.MODELS || "").split(",").map((model) => model.trim()).filter(Boolean);
const OUTPUT_DIR = path.resolve(process.env.AUDITION_DIR || "audition");
const REQUEST_TIMEOUT_MS = 240_000;

const WORLD = `The setting: Meridian Deep, a data center built into a trench 3 km under the Pacific in 2071, cooled by the
ocean and staffed by a crew of six on rotating shifts. The station's pressure hull is rated for 40 more years;
the company that built it went bankrupt last month, and no one has told the crew whether the supply sub is coming.

The cast:
- Noor Achterberg (she), cooling engineer. Wants to get her brother, also on the crew, home alive. Flaw: lies to
  protect people, then gets trapped by the lie.
- Tavish Okonkwo-Reyes (he), Noor's younger brother, network tech. Wants to prove he isn't a kid. Flaw: reckless.
- Dagny Prell (she), station chief. Wants to keep the servers running because the clients still pay her. Flaw: puts
  the contract before the crew.`;

const AUTHOR_TASK = `${WORLD}

Write the opening scene of a novel set here, 500 to 700 words. In it, Noor finds out that the supply sub has
been cancelled, and decides not to tell Tavish. End on a hook.

Style: clear, plain prose a reader looks through, not at; few metaphors. Concrete action and dialogue. The
characters are sharp-tongued and funny even when scared. Technical detail is welcome, but explain each term the
first time it appears. Reply with only the scene: no title, no notes.`;

const SHOWRUNNER_TASK = `${WORLD}

You are the showrunner of a long serialized novel set here, written by a rotating team of writers who each
write one short passage and never see the whole book. Plan the first arc: a complete story of about 6 chapters
that ends by resolving its main conflict, while leaving the world open for the next arc.

Reply in exactly this format and nothing else:

ARC TITLE: <title>
ARC GOAL: <one or two sentences: what this arc is about and how it ends>
CHAPTERS:
1. <chapter title>: <one sentence on what happens and what changes>
... through the last chapter
CHAPTER 1 BEATS:
- <one beat per line: a concrete event a writer can turn into a 500-word passage; 5 to 8 beats>`;

async function ask(model, prompt) {
  const startedAt = Date.now();
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await response.text();
  const seconds = Math.round((Date.now() - startedAt) / 1000);
  if (!response.ok) return { failure: `HTTP ${response.status}: ${body.slice(0, 300)}`, seconds };
  let content;
  try {
    content = JSON.parse(body).choices?.[0]?.message?.content;
  } catch {
    return { failure: `Unreadable response: ${body.slice(0, 300)}`, seconds };
  }
  if (typeof content !== "string" || !content.trim()) return { failure: "Empty completion", seconds };
  return { content: content.trim(), seconds };
}

async function askOrDescribeFailure(model, prompt) {
  try {
    return await ask(model, prompt);
  } catch (error) {
    return { failure: `${error.name}: ${error.message}`, seconds: null };
  }
}

function section(title, result) {
  const timing = result.seconds === null ? "" : ` (${result.seconds}s)`;
  if (result.failure) return `## ${title}${timing}\n\nFailed: ${result.failure}\n`;
  const words = result.content.split(/\s+/).length;
  return `## ${title}${timing}, ${words} words\n\n${result.content}\n`;
}

if (!API_KEY) throw new Error("API_KEY is not set; in GitHub Actions it comes from the MODEL_API_KEY repo secret.");
if (MODELS.length === 0) throw new Error("MODELS is empty; pass a comma-separated list of model ids.");

await mkdir(OUTPUT_DIR, { recursive: true });
for (const model of MODELS) {
  const author = await askOrDescribeFailure(model, AUTHOR_TASK);
  const showrunner = await askOrDescribeFailure(model, SHOWRUNNER_TASK);
  const fileName = `${model.replace(/[^a-z0-9.-]+/gi, "_")}.md`;
  await writeFile(path.join(OUTPUT_DIR, fileName), `# ${model}\n\n${section("Opening scene", author)}\n${section("Arc plan", showrunner)}`);
  console.log(`${model}: scene ${author.failure ? "failed" : "ok"}, plan ${showrunner.failure ? "failed" : "ok"}`);
}
