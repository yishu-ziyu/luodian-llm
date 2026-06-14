# URL Extraction Bake-Off

This experiment compares three single-page article extraction approaches:

- Mozilla Readability
- Defuddle
- Trafilatura

It tests the product question: if a user enters a public URL, which extractor gives the cleanest article text for the AI highlighter pipeline?

## Run

Install Node dependencies once:

```bash
npm install
```

Run the bake-off:

```bash
npm run bakeoff:url-extraction
```

Trafilatura is executed through `uv run --with trafilatura`, so it does not require a checked-in Python virtual environment.

## Data Boundary

Only use public URLs that the user intentionally submits for testing. Do not use private, login-only, paid, unpublished, or sensitive pages.

The experiment fetches each URL once, keeps extraction outputs locally, and does not send page text to any large model.

## Outputs

Each run creates `outputs/<timestamp>/` with:

- `results.json`: full extraction metrics and text previews.
- `summary.md`: comparison matrix and recommendation notes.

The score is heuristic. It estimates whether extracted text is long enough, paragraph-like, and low in boilerplate. It is not a substitute for manual reading QA.
