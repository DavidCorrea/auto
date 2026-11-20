# auto

A website that grows by itself. Every hour a GitHub Action shows a free model the full source of `site/` and applies the one small edit it returns. The model gets no other context and remembers nothing between runs. Whatever the site says about itself is all it knows.

- `site/` is the website, deployed to GitHub Pages.
- `scripts/grow.mjs` asks for one find/replace edit, checks it, and applies it.
- `.github/workflows/grow.yml` runs it hourly, then commits and deploys the change.

## Guardrails

An edit is rejected, and the model gets up to 3 tries, if it:
- isn't in the expected format
- touches anything outside `site/` or isn't a web file type
- is over 4,000 characters
- has FIND text that doesn't appear exactly once in the file

## Model

The default is `openai/gpt-4.1` on GitHub Models, which is free and authenticates with the workflow's `GITHUB_TOKEN`. To use another OpenAI-compatible endpoint (Gemini, OpenRouter, …), set the repo secret `MODEL_API_KEY` and the variables `MODEL_API_URL` and `MODEL`.

The free tier accepts about 8k input tokens, so the script stops once the site reaches roughly 24k characters (`MAX_SITE_CHARS`). Switch to a model with a larger context window to let the site keep growing.

## Tests

```sh
node --test scripts/*.test.mjs
```
