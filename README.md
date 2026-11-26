# auto

*Auto*, a book that never ends, set in the future and written by free AI models that each write one scene and forget it. Every 15 minutes a GitHub Action takes one turn.

## How it's written

The book is told in **arcs**: complete stories of 3 to 8 chapters, all set in one world. Each arc builds to an ending that resolves its main conflict; the world, its people and its unresolved threads carry on into the next arc. The book never ends, but every story inside it does.

Three roles, each a model call that remembers nothing between turns:
- **The showrunner** plans. When the book starts it invents the world, the heart of the book and the first cast. At the start of each arc it plans the arc's goal and chapters; at the start of each chapter, 4 to 8 beats, each a concrete event; at the end of an arc, it records what happened and resolves threads.
- **The author** writes one beat per turn, about 400 to 800 words, seeing the world, the cast, the open threads, the arc's plan, summaries of earlier chapters and arcs, and the whole current chapter. Each arc has its own author model, in rotation, so each story has one voice and the book reads like a shared-world anthology. The contents name each arc's author.
- **The editor** (the showrunner's model) reads each passage against its beat and sends it back if it misses the beat, contradicts the cast, replays something already on the page, goes abstract, or changes nothing. The author gets one more try.

The story's state is owned by the code, not the models: the world, the heart and every character's name and pronouns are fixed once written. Authors only propose small changes ("status: Noor: hurt", "new character: …", "resolved: 2", "new thread: …"), which the code applies. That replaced a bible every writer rewrote, which drifted until the story lost its premise, its characters' wants and, once, its protagonist's body.

The instructions ask for clear prose, concrete scenes, characters who want things and keep their bodies, strange things that follow rules with limits and costs, technical terms explained when they first appear, stakes about people rather than paperwork, sass, suspense, and setups that pay off. The world may echo how the book is made (shifts, handoffs, forgetting), but the story is never about writers or drafts: every time it was, it turned abstract.

## Files

- `site/` is the website, deployed to GitHub Pages. `index.html` is the only page: a hand-written shell that `book.js` fills in.
  - `chapters/NNN.json` holds each chapter's title and passages. These files are the book itself.
  - `book.json` is an index of the arcs and chapters, rewritten on every save, so the contents can be drawn without loading every chapter.
  - The address never changes. Local storage remembers which chapter a reader has open and how far down, so a returning reader picks up there and a new one starts at Chapter I.
- `book/state.json` holds what only the models see: the world, the cast, open threads, and the arc and chapter plans.
- `scripts/story.mjs` is the book's logic: what to do next, the prompts, and checking and applying each reply.
- `scripts/grow.mjs` takes one turn: it calls the models, with fallbacks, and saves the result.
- `scripts/book.mjs` reads and writes the book's files.
- `scripts/audition.mjs` gives candidate models the same writing tasks, to pick them by what they write.
- `.github/workflows/grow.yml` takes a turn, then commits the change and deploys it. `audition.yml` runs an audition by hand.

The experiment before this book, a website that agents edited directly, is preserved at the `garden-final` tag.

## Guardrails

Besides the editor, a reply is rejected, and sent back with the reason, if:
- A section is missing or given twice, or the passage contains bookkeeping like "Beat 3:" or "Last page:". Both once got printed in the book.
- The passage is under 1,200 or over 6,000 characters, or repeats text already in the chapter.
- A character lacks a want and a flaw, or has a name starting like an existing one's (one cast had Lira, Rylia, Mira and Mara).
- An arc has fewer than 3 or more than 8 chapters, a chapter fewer than 4 or more than 8 beats, or there would be more than 6 open threads.
- A title is a placeholder or in all capitals.

## Models

Picked with the Audition workflow, all free on [OpenRouter](https://openrouter.ai):
- Showrunner and editor: `baidu/ernie-5.5-flash-preview:free`, falling back to `nvidia/nemotron-3.5-super-vl:free`.
- Authors, one per arc in this order: `baidu/ernie-5.5-flash-preview:free`, `nvidia/nemotron-3-ultra-550b-a55b:free`, `nvidia/nemotron-3.5-super-vl:free`. When an arc's author is rate-limited or down, the next one fills in for that turn.

Store your OpenRouter key as the repo secret `MODEL_API_KEY`. To change the lineup, set the repo variables `SHOWRUNNER_MODELS` and `AUTHOR_MODELS` to comma-separated model ids. To use another OpenAI-compatible endpoint, set `MODEL_API_URL`.

## Tests

```sh
node --test scripts/*.test.mjs
```
