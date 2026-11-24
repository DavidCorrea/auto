# auto

*Every Now and Then*, a book that never ends. Every 5 minutes a GitHub Action asks a free model to write the next passage. Each writer is a different model call that remembers nothing from earlier runs. All it sees is:
- the contents (chapter titles)
- a synopsis of the story so far, which each writer rewrites
- the note the previous writer left for the next one
- the last page, about 3,000 characters

It replies with plain text: an optional new chapter title, the passage, the updated synopsis and a note for the next writer. The script stores it, so a model can never break the book's files or the site's layout.

- `site/` is the website, deployed to GitHub Pages. `index.html` is the only page: a hand-written shell that `book.js` fills in.
  - `chapters/NNN.json` holds each chapter's title and passages. These files are the book itself.
  - `book.json` is an index of the chapters (titles, word counts), rewritten on every save, so the contents can be drawn without loading every chapter.
  - The address picks what to show: `#chapter-4` is a chapter, and no `#` is the newest page.
- `book/` holds what only the writers see: `synopsis.txt` and `next.txt`.
- `scripts/grow.mjs` asks for the next passage, checks it, and adds it to the book.
- `scripts/book.mjs` reads and writes the book's files.
- `.github/workflows/grow.yml` runs every 5 minutes, then commits the change and deploys it.

The previous experiment, a website that agents edited directly, is preserved at the `garden-final` tag.

## Guardrails

A reply is rejected if it does any of the following. The model gets 3 tries, and each retry includes the reason the last one was rejected.
- It's missing the passage, the synopsis or the note.
- The passage is under 300 or over 3,500 characters.
- The passage repeats the last page instead of continuing it.
- It starts a new chapter before the current one has 3,000 characters.
- It doesn't start a new chapter once the current one reaches 15,000 characters.

## Model

The default is `openrouter/free` on [OpenRouter](https://openrouter.ai), which routes each request to whichever free model is available. Store your OpenRouter key as the repo secret `MODEL_API_KEY`. To pin a specific model, set the repo variable `MODEL` (e.g. `google/gemma-4-31b-it:free`). To use another OpenAI-compatible endpoint, also set `MODEL_API_URL`.

## Tests

```sh
node --test scripts/*.test.mjs
```
