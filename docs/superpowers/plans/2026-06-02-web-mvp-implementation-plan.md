# Web MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Web MVP that imports a public URL or `.txt` / `.md` text, standardizes it into `ArticleDocument`, generates a validated `HighlightMap`, renders a highlighted reader, and saves one reproducible experiment record.

**Architecture:** Use a small Node ESM app under `web-mvp/`. Keep extraction, article normalization, highlight validation, model access, HTTP API, browser UI, and experiment persistence in separate files. Default model mode is `mock` for deterministic local verification; a real LLM provider is added behind an env-configured adapter after official provider docs are checked at implementation time.

**Tech Stack:** Node.js ESM, built-in `node:test`, built-in `node:http`, browser HTML/CSS/JS, `defuddle`, `@mozilla/readability`, `jsdom`.

---

## File Structure

- Modify: `package.json`
  - Add Web MVP scripts: `dev:web-mvp` and `test:web-mvp`.
- Create: `web-mvp/server.mjs`
  - Serves static UI and API routes.
- Create: `web-mvp/src/article.mjs`
  - Builds and validates `ArticleDocument` and paragraph splitting.
- Create: `web-mvp/src/extract-url.mjs`
  - Fetches HTML, runs Defuddle primary extraction, runs Readability fallback when quality is weak.
- Create: `web-mvp/src/extract-file.mjs`
  - Converts uploaded `.txt` / `.md` text into `ArticleDocument`.
- Create: `web-mvp/src/highlight.mjs`
  - Validates `HighlightMap`, enforces bounds, and provides mock-model generation.
- Create: `web-mvp/src/llm-client.mjs`
  - Holds the real model adapter boundary; implementation must check official provider docs first.
- Create: `web-mvp/src/experiments.mjs`
  - Saves and reads local `ReadingExperiment` JSON records.
- Create: `web-mvp/public/index.html`
  - First-screen usable reader UI with URL input and file upload.
- Create: `web-mvp/public/styles.css`
  - Quiet reader styling and visible highlight treatment.
- Create: `web-mvp/public/app.js`
  - Browser flow: import, highlight, render, save status.
- Create: `web-mvp/tests/article.test.mjs`
  - Tests paragraph splitting and document shape.
- Create: `web-mvp/tests/extract-file.test.mjs`
  - Tests `.txt` / `.md` import.
- Create: `web-mvp/tests/highlight.test.mjs`
  - Tests highlight validation and bounds rejection.
- Create: `web-mvp/tests/experiments.test.mjs`
  - Tests experiment save/read shape.
- Modify: `tasks/todo.md`
  - Check off each completed Web MVP task.
- Modify: `notes/session-logs/2026-06-02-saccade-bootstrap.md`
  - Append implementation progress and verification evidence.

## Success Criteria

- `npm run test:web-mvp` exits `0`.
- `npm run dev:web-mvp` starts a local server.
- Browser UI can import one URL or one `.txt` / `.md` sample.
- `/api/highlight` returns legal `Record<string, number[]>`.
- Rendered highlights do not alter text order.
- At least one experiment JSON is saved under `web-mvp/data/experiments/`.

### Task 1: Scaffold Web MVP Scripts

**Files:**
- Modify: `package.json`
- Create: `web-mvp/server.mjs`
- Create: `web-mvp/public/index.html`
- Create: `web-mvp/public/styles.css`
- Create: `web-mvp/public/app.js`

- [ ] **Step 1: Add scripts to `package.json`**

Add these script entries while preserving the existing bake-off script:

```json
{
  "dev:web-mvp": "node web-mvp/server.mjs",
  "test:web-mvp": "node --test web-mvp/tests/*.test.mjs",
  "bakeoff:url-extraction": "node experiments/url-extraction-bakeoff/run-bakeoff.mjs"
}
```

- [ ] **Step 2: Create a minimal server**

Create `web-mvp/server.mjs` with routes for static files and a health API:

```js
import http from "node:http";

const port = Number(process.env.PORT || 4173);

const server = http.createServer(async (request, response) => {
  if (request.url === "/api/health") {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  response.statusCode = 200;
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end("<!doctype html><title>Saccade 阅读加速</title><main id=\"app\"></main>");
});

server.listen(port, () => {
  console.log(`Web MVP listening on http://localhost:${port}`);
});
```

- [ ] **Step 3: Verify the server starts**

Run:

```bash
npm run dev:web-mvp
```

Expected: stdout includes `Web MVP listening on http://localhost:4173`.

Stop the process after confirming startup.

### Task 2: Build Article Normalization

**Files:**
- Create: `web-mvp/src/article.mjs`
- Create: `web-mvp/tests/article.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `web-mvp/tests/article.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createArticleDocument, splitIntoParagraphs } from "../src/article.mjs";

test("splitIntoParagraphs removes blank paragraphs and preserves order", () => {
  assert.deepEqual(splitIntoParagraphs("第一段\n\n\n第二段\n第三段"), [
    "第一段",
    "第二段\n第三段"
  ]);
});

test("createArticleDocument returns stable paragraph ids", () => {
  const article = createArticleDocument({
    sourceType: "file",
    title: "样本文本",
    plainText: "第一段\n\n第二段",
    extraction: { method: "file", fallbackUsed: false, warnings: [] }
  });

  assert.equal(article.sourceType, "file");
  assert.equal(article.paragraphs[0].id, "0");
  assert.equal(article.paragraphs[1].charLength, 3);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```bash
npm run test:web-mvp
```

Expected: FAIL because `web-mvp/src/article.mjs` does not exist yet.

- [ ] **Step 3: Implement `article.mjs`**

Create `web-mvp/src/article.mjs` with:

```js
import crypto from "node:crypto";

export function splitIntoParagraphs(text) {
  return String(text)
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function createArticleDocument({ sourceType, sourceUrl, title, plainText, extraction }) {
  const normalizedText = String(plainText || "").trim();
  const paragraphs = splitIntoParagraphs(normalizedText).map((text, index) => ({
    id: String(index),
    index,
    text,
    charLength: Array.from(text).length
  }));

  if (paragraphs.length === 0) {
    throw new Error("Article text is empty after normalization.");
  }

  return {
    id: `article_${crypto.randomUUID()}`,
    sourceType,
    ...(sourceUrl ? { sourceUrl } : {}),
    title: title?.trim() || "Untitled",
    plainText: normalizedText,
    paragraphs,
    extraction,
    createdAt: new Date().toISOString()
  };
}
```

- [ ] **Step 4: Run tests and confirm GREEN**

Run:

```bash
npm run test:web-mvp
```

Expected: PASS for `article.test.mjs`.

### Task 3: Build File Import

**Files:**
- Create: `web-mvp/src/extract-file.mjs`
- Create: `web-mvp/tests/extract-file.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `web-mvp/tests/extract-file.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { importTextFile } from "../src/extract-file.mjs";

test("imports txt content as an ArticleDocument", () => {
  const article = importTextFile({
    filename: "sample.txt",
    text: "第一段\n\n第二段"
  });

  assert.equal(article.sourceType, "file");
  assert.equal(article.title, "sample.txt");
  assert.equal(article.extraction.method, "file");
  assert.equal(article.paragraphs.length, 2);
});

test("rejects unsupported file extensions", () => {
  assert.throws(() => importTextFile({ filename: "sample.pdf", text: "正文" }), /Only .txt and .md/);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```bash
npm run test:web-mvp
```

Expected: FAIL because `extract-file.mjs` does not exist yet.

- [ ] **Step 3: Implement file import**

Create `web-mvp/src/extract-file.mjs`:

```js
import { createArticleDocument } from "./article.mjs";

export function importTextFile({ filename, text }) {
  if (!/\.(txt|md)$/i.test(filename || "")) {
    throw new Error("Only .txt and .md files are supported in the Web MVP.");
  }

  if (String(text || "").length > 300_000) {
    throw new Error("File text is too large for the Web MVP limit.");
  }

  return createArticleDocument({
    sourceType: "file",
    title: filename,
    plainText: text,
    extraction: { method: "file", fallbackUsed: false, warnings: [] }
  });
}
```

- [ ] **Step 4: Run tests and confirm GREEN**

Run:

```bash
npm run test:web-mvp
```

Expected: PASS for article and file-import tests.

### Task 4: Build URL Extraction

**Files:**
- Create: `web-mvp/src/extract-url.mjs`

- [ ] **Step 1: Implement Defuddle primary and Readability fallback**

Create `web-mvp/src/extract-url.mjs` with exports:

```js
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { Defuddle } from "defuddle/node";
import { createArticleDocument } from "./article.mjs";

function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function htmlToText(html) {
  const dom = new JSDOM(`<main>${html || ""}</main>`);
  return normalizeText(dom.window.document.body.textContent || "");
}

export function scoreExtractedText(text) {
  const length = Array.from(String(text || "").trim()).length;
  if (length >= 800) return 3;
  if (length >= 300) return 2;
  if (length >= 120) return 1;
  return 0;
}

export async function extractUrlArticle(url, fetchImpl = fetch) {
  const parsedUrl = new URL(url);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Only http and https URLs are supported.");
  }

  const html = await fetchImpl(parsedUrl.href).then(async (response) => {
    if (!response.ok) throw new Error(`Fetch failed with HTTP ${response.status}.`);
    return response.text();
  });

  const defuddleResult = await Defuddle(html, parsedUrl.href, {
    markdown: true,
    removeImages: true
  });
  const defuddleText = htmlToText(defuddleResult?.content || defuddleResult?.contentMarkdown || "");

  let selected = {
    method: "defuddle",
    title: defuddleResult?.title || parsedUrl.hostname,
    text: defuddleText,
    fallbackUsed: false,
    warnings: []
  };

  if (scoreExtractedText(defuddleText) < 2) {
    const readabilityDom = new JSDOM(html, { url: parsedUrl.href });
    const readable = new Readability(readabilityDom.window.document).parse();
    const readabilityText = normalizeText(readable?.textContent || "");
    if (scoreExtractedText(readabilityText) > scoreExtractedText(defuddleText)) {
      selected = {
        method: "readability",
        title: readable?.title || selected.title,
        text: readabilityText,
        fallbackUsed: true,
        warnings: ["Defuddle output was too short; Readability fallback selected."]
      };
    }
  }

  return createArticleDocument({
    sourceType: "url",
    sourceUrl: parsedUrl.href,
    title: selected.title,
    plainText: normalizeText(selected.text),
    extraction: {
      method: selected.method,
      fallbackUsed: selected.fallbackUsed,
      qualityScore: scoreExtractedText(selected.text),
      warnings: selected.warnings
    }
  });
}
```

- [ ] **Step 2: Verify with one public URL**

Run:

```bash
node -e 'import("./web-mvp/src/extract-url.mjs").then(async ({extractUrlArticle}) => { const a = await extractUrlArticle("https://example.com/"); console.log(a.title, a.paragraphs.length, a.extraction.method); })'
```

Expected: command exits `0` and prints title, paragraph count, and extraction method. If the sample is too short, use one URL from `experiments/url-extraction-bakeoff/urls.json`.

### Task 5: Build Highlight Validation And Mock Generation

**Files:**
- Create: `web-mvp/src/highlight.mjs`
- Create: `web-mvp/tests/highlight.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `web-mvp/tests/highlight.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { assertHighlightMap, generateMockHighlightMap } from "../src/highlight.mjs";

const paragraphs = [{ id: "0", text: "中文阅读需要视觉落点。", charLength: 10 }];

test("validates legal highlight ranges", () => {
  assert.doesNotThrow(() => assertHighlightMap({ "0": [0, 2, 4, 2] }, paragraphs));
});

test("rejects odd-length range arrays", () => {
  assert.throws(() => assertHighlightMap({ "0": [0, 2, 4] }, paragraphs), /even length/);
});

test("rejects out-of-bounds ranges", () => {
  assert.throws(() => assertHighlightMap({ "0": [9, 2] }, paragraphs), /out of bounds/);
});

test("mock generator returns a valid map", () => {
  const highlight = generateMockHighlightMap(paragraphs, "medium");
  assertHighlightMap(highlight, paragraphs);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```bash
npm run test:web-mvp
```

Expected: FAIL because `highlight.mjs` does not exist yet.

- [ ] **Step 3: Implement highlight module**

Create `web-mvp/src/highlight.mjs`:

```js
export function assertHighlightMap(highlightMap, paragraphs) {
  if (!highlightMap || typeof highlightMap !== "object" || Array.isArray(highlightMap)) {
    throw new Error("HighlightMap must be an object.");
  }

  const paragraphById = new Map(paragraphs.map((paragraph) => [paragraph.id, paragraph]));

  for (const [paragraphId, ranges] of Object.entries(highlightMap)) {
    const paragraph = paragraphById.get(paragraphId);
    if (!paragraph) throw new Error(`Unknown paragraph id: ${paragraphId}`);
    if (!Array.isArray(ranges)) throw new Error(`Ranges for paragraph ${paragraphId} must be an array.`);
    if (ranges.length % 2 !== 0) throw new Error(`Ranges for paragraph ${paragraphId} must have even length.`);

    for (let index = 0; index < ranges.length; index += 2) {
      const start = ranges[index];
      const length = ranges[index + 1];
      if (!Number.isInteger(start) || !Number.isInteger(length) || start < 0 || length <= 0) {
        throw new Error(`Invalid range at paragraph ${paragraphId}.`);
      }
      if (start + length > paragraph.charLength) {
        throw new Error(`Range out of bounds at paragraph ${paragraphId}.`);
      }
    }
  }
}

export function generateMockHighlightMap(paragraphs, density = "medium") {
  const stepByDensity = { low: 14, medium: 10, high: 7 };
  const step = stepByDensity[density] || stepByDensity.medium;

  return Object.fromEntries(
    paragraphs.map((paragraph) => {
      const chars = Array.from(paragraph.text);
      const ranges = [];
      for (let index = 0; index < chars.length; index += step) {
        ranges.push(index, Math.min(2, chars.length - index));
      }
      return [paragraph.id, ranges];
    })
  );
}
```

- [ ] **Step 4: Run tests and confirm GREEN**

Run:

```bash
npm run test:web-mvp
```

Expected: PASS for highlight tests.

### Task 6: Build HTTP API

**Files:**
- Modify: `web-mvp/server.mjs`
- Create: `web-mvp/src/experiments.mjs`
- Create: `web-mvp/tests/experiments.test.mjs`

- [ ] **Step 1: Add API routes**

Update `web-mvp/server.mjs` to expose:

```text
POST /api/import/url
POST /api/import/file
POST /api/highlight
POST /api/experiments
GET /api/health
```

Request format for file import is JSON:

```json
{
  "filename": "sample.md",
  "text": "第一段\n\n第二段"
}
```

The browser may still use a normal file picker; `app.js` reads the file text and sends this JSON. This avoids multipart parsing in the first MVP while preserving the user-facing upload workflow.

- [ ] **Step 2: Verify API with curl**

Run:

```bash
npm run dev:web-mvp
```

In another shell, run:

```bash
curl -s http://localhost:4173/api/health
```

Expected:

```json
{"ok":true}
```

Also run:

```bash
curl -s -X POST http://localhost:4173/api/import/file -H 'Content-Type: application/json' -d '{"filename":"sample.md","text":"第一段\n\n第二段"}'
```

Expected: JSON response includes `"sourceType":"file"` and two paragraphs.

### Task 7: Build Reader UI

**Files:**
- Modify: `web-mvp/public/index.html`
- Modify: `web-mvp/public/styles.css`
- Modify: `web-mvp/public/app.js`

- [ ] **Step 1: Implement first-screen workflow**

`index.html` must show the actual tool on first load:

```text
URL input
file picker
density segmented control
import button
status line
reader article region
```

Privacy prompt must be visible before import:

```text
你导入的文章文本会发送给大模型服务，用于生成语义高亮。请不要上传敏感、机密、未授权或付费受限内容。
```

- [ ] **Step 2: Render highlights without changing source text**

`app.js` should render each paragraph by slicing `Array.from(paragraph.text)` and wrapping highlighted ranges in:

```html
<mark class="reading-highlight">...</mark>
```

Text outside highlight ranges must remain escaped text nodes.

- [ ] **Step 3: Verify in browser**

Run:

```bash
npm run dev:web-mvp
```

Open:

```text
http://localhost:4173
```

Manual checks:

- Import a `.txt` or `.md` sample.
- Confirm status moves through import and highlight generation.
- Confirm the article text order is unchanged.
- Toggle highlight off and on.
- Change density and regenerate.

### Task 8: Save One Reproducible Experiment

**Files:**
- Create: `web-mvp/data/experiments/.gitkeep`
- Modify: `web-mvp/src/experiments.mjs`
- Modify: `web-mvp/server.mjs`
- Modify: `notes/session-logs/2026-06-02-saccade-bootstrap.md`
- Modify: `tasks/todo.md`

- [ ] **Step 1: Save experiment JSON**

`saveReadingExperiment` must write one JSON file shaped as:

```json
{
  "id": "experiment_...",
  "article": {},
  "aiHighlight": {},
  "modelInfo": {
    "provider": "mock",
    "model": "mock-semantic-reading-guide"
  },
  "createdAt": "2026-06-02T00:00:00.000Z"
}
```

- [ ] **Step 2: Verify saved record**

Run:

```bash
find web-mvp/data/experiments -type f -name '*.json' -maxdepth 1
```

Expected: at least one experiment JSON file.

Run:

```bash
node -e 'const fs=require("fs"); const p=process.argv[1]; const d=JSON.parse(fs.readFileSync(p,"utf8")); if(!d.article||!d.aiHighlight||!d.modelInfo) process.exit(1); console.log(d.id, d.modelInfo.provider);' web-mvp/data/experiments/<experiment-file>.json
```

Expected: prints experiment id and provider.

### Task 9: Final Verification

**Files:**
- Modify: `tasks/todo.md`
- Modify: `notes/session-logs/2026-06-02-saccade-bootstrap.md`

- [ ] **Step 1: Run automated tests**

Run:

```bash
npm run test:web-mvp
```

Expected: exit `0`.

- [ ] **Step 2: Run smoke test**

Run:

```bash
npm run dev:web-mvp
```

Verify:

```text
http://localhost:4173/api/health
```

Expected:

```json
{"ok":true}
```

- [ ] **Step 3: Update durable state**

Update:

- `tasks/todo.md`: check completed Web MVP items.
- `notes/session-logs/2026-06-02-saccade-bootstrap.md`: record test commands, manual checks, saved experiment path, and remaining risks.
- `docs/HANDOFF.md`: record next step after the MVP loop.

## Self-Review

- Spec coverage: URL import, file import, standardized article document, highlight generation API, reader rendering, privacy prompt, errors, and experiment record all map to tasks above.
- Placeholder scan: no forbidden placeholder terms remain in the task bodies.
- Type consistency: `ArticleDocument`, `ArticleParagraph`, `HighlightMap`, and `ReadingExperiment` names match the design document.
