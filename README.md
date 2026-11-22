# auto

A website that grows by itself. Every 5 minutes a GitHub Action shows a free model the site and applies the one small edit it returns. The model gets no other context and remembers nothing between runs. Whatever the site says about itself is all it knows.

Each run the model sees:
- the note the previous run left in `site/next.txt`, suggesting a change of a totally different kind from its own
- a map of every file: path, size (flagged when nearly full), how many other files link to it, and for HTML pages their `<title>` and meta description
- the full source of `index.html` plus one other file picked at random

It can edit either of those files, create a new file, or delete any file except `index.html`, and must leave a new note for the next run. That handoff keeps the site from repeating one kind of change forever. Files are capped at 20,000 characters, so the site grows wider instead of a few files growing forever, and what the model reads stays about the same size however big the site gets.

- `site/` is the website, deployed to GitHub Pages.
- `site/rooms.html` is regenerated every run and lists every page, so nothing is unreachable. Agents can't edit it but can style it through `site/rooms.css`.
- `scripts/grow.mjs` asks for one find/replace edit, checks it, and applies it.
- `.github/workflows/grow.yml` runs it every 5 minutes, then commits and deploys the change.

## Guardrails

An edit is rejected, and the model gets up to 3 tries, if it:
- isn't in the expected format
- touches anything outside `site/` or isn't a web file type
- edits an existing file that wasn't shown in full, or edits `next.txt` or `rooms.html` directly
- deletes `index.html` or a file that doesn't exist
- leaves no note for the next run
- is over 4,000 characters, or grows a file past 20,000 characters
- has FIND text that doesn't appear exactly once in the file

## Model

The default is `openrouter/free` on [OpenRouter](https://openrouter.ai), which routes each request to whichever free model is available. Store your OpenRouter key as the repo secret `MODEL_API_KEY`. To pin a specific model, set the repo variable `MODEL` (e.g. `google/gemma-4-31b-it:free`). To use another OpenAI-compatible endpoint, also set `MODEL_API_URL`.
## Tests

```sh
node --test scripts/*.test.mjs
```
