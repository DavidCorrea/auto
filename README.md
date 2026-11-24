# auto

*Auto*, a book that never ends, about the way it is being written: writers who arrive every five minutes, do one thing, and forget it. Everyone did something, and no one remembers what. That premise is fixed in the writers' instructions; what world it takes place in, and everything else, is up to them. The instructions also ask for the qualities of Brandon Sanderson's writing that keep a long story readable: clear prose, concrete scenes, characters who want things, strange things that follow rules with limits and costs, and setups that pay off. Every 5 minutes a GitHub Action asks a free model to write the next passage. Each writer is a different model call that remembers nothing from earlier runs. All it sees is:
- their shift: which writer they are in line, and the time
- the contents (chapter titles)
- the bible: lists of characters (name, pronouns, role, what they want and what stands in their way), places, things and the rules they follow, and open threads, which each writer keeps up to date
- a synopsis of the story so far, which each writer rewrites
- the note the previous writer left for the next one
- the last page, about 3,000 characters

It replies with plain text: an optional new chapter title, the passage, the updated bible, the updated synopsis and a note for the next writer. Writers are asked to move or resolve open threads rather than keep adding mysteries, and to resolve one before opening another once there are more than 5. The script stores it, so a model can never break the book's files or the site's layout.

- `site/` is the website, deployed to GitHub Pages. `index.html` is the only page: a hand-written shell that `book.js` fills in.
  - `chapters/NNN.json` holds each chapter's title and passages. These files are the book itself.
  - `book.json` is an index of the chapters (titles, word counts), rewritten on every save, so the contents can be drawn without loading every chapter.
  - The address never changes. Local storage remembers which chapter a reader has open and how far down, so a returning reader picks up there and a new one starts at Chapter I.
- `book/` holds what only the writers see: `bible.txt`, `synopsis.txt` and `next.txt`.
- `scripts/grow.mjs` asks for the next passage, checks it, and adds it to the book.
- `scripts/book.mjs` reads and writes the book's files.
- `.github/workflows/grow.yml` runs every 5 minutes, then commits the change and deploys it.

The first book, written before the bible existed, is preserved at the `first-book` tag, the short-lived second one, written before the book had a premise, at `second-book`, and a third, set in a city of forgotten deeds, at `third-book`, and a fourth, which drifted into abstraction before the instructions asked for concrete scenes, at `fourth-book`. Without a shared list of who's who, its characters changed names, pronouns and roles, and plot threads piled up unresolved. The experiment before that, a website that agents edited directly, is preserved at the `garden-final` tag.

## Guardrails

A reply is rejected if it does any of the following. The model gets 3 tries, and each retry includes the reason the last one was rejected.
- It's missing the passage, the bible, the synopsis or the note.
- It gives a section twice, or the passage contains bookkeeping like "PARAGRAPH TWO:" or "Last page:". Both once got printed in the book.
- The bible is missing one of its four lists or is over 3,000 characters.
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
