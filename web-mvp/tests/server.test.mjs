import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import assert from "node:assert/strict";
import { handleWebMvpRequest } from "../server.mjs";

function jsonRequest(url, body) {
  const request = Readable.from([JSON.stringify(body)]);
  request.method = "POST";
  request.url = url;
  return request;
}

function getRequest(url) {
  const request = Readable.from([]);
  request.method = "GET";
  request.url = url;
  return request;
}

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(value = "") {
      this.body += value;
    }
  };
}

test("GET /api/health returns ok", async () => {
  const response = responseRecorder();
  await handleWebMvpRequest(getRequest("/api/health"), response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true });
});

test("GET /compare serves the comparison page", async () => {
  const response = responseRecorder();
  await handleWebMvpRequest(getRequest("/compare"), response);

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /Saccade 高亮对照/);
});

test("POST /api/import/file returns an ArticleDocument", async () => {
  const response = responseRecorder();
  await handleWebMvpRequest(
    jsonRequest("/api/import/file", { filename: "sample.md", text: "第一段\n\n第二段" }),
    response
  );

  const parsed = JSON.parse(response.body);
  assert.equal(parsed.article.sourceType, "file");
  assert.equal(parsed.article.paragraphs.length, 2);
});

test("POST /api/highlight uses the configured highlight generator", async () => {
  const response = responseRecorder();
  await handleWebMvpRequest(
    jsonRequest("/api/highlight", {
      paragraphs: [{ id: "0", index: 0, text: "第一段正文用于高亮。", charLength: 10 }],
      density: "medium"
    }),
    response,
    {
      highlightGenerator: async ({ paragraphs }) => ({
        highlight: { [paragraphs[0].id]: [0, 2] },
        modelInfo: { provider: "test-provider", model: "test-model" }
      })
    }
  );

  const parsed = JSON.parse(response.body);
  assert.deepEqual(Object.keys(parsed.highlight), ["0"]);
  assert.equal(parsed.modelInfo.provider, "test-provider");
});

test("POST /api/highlight forwards enableFallback query param", async () => {
  const generatorCalls = [];
  const response = responseRecorder();

  await handleWebMvpRequest(
    jsonRequest("/api/highlight?enableFallback=false", {
      paragraphs: [{ id: "0", index: 0, text: "第一段正文用于高亮。", charLength: 10 }],
      density: "medium"
    }),
    response,
    {
      highlightGenerator: async ({ paragraphs, fallbackOnFailure }) => {
        generatorCalls.push({ fallbackOnFailure });
        return {
          highlight: { [paragraphs[0].id]: [0, 2] },
          modelInfo: { provider: "test-provider", model: "test-model" }
        };
      }
    }
  );

  assert.equal(generatorCalls.length, 1);
  assert.equal(generatorCalls[0].fallbackOnFailure, false);
  assert.equal(response.statusCode, 200);
});

test("POST /api/compare returns baseline, AI highlight, metrics, and experiment record", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "saccade-api-compare-"));
  const response = responseRecorder();
  const article = {
    id: "article_compare",
    sourceType: "file",
    title: "compare.md",
    paragraphs: [{ id: "0", index: 0, text: "0123456789", charLength: 10 }],
    extraction: { method: "file", fallbackUsed: false, warnings: [] },
    createdAt: "2026-06-02T00:00:00.000Z"
  };

  await handleWebMvpRequest(
    jsonRequest("/api/compare", {
      article,
      paragraphs: article.paragraphs,
      density: "medium"
    }),
    response,
    {
      experimentOutputDir: outputDir,
      baselineGenerator: async () => ({
        highlight: { "0": [2, 2, 7, 2] },
        baselineInfo: { provider: "reference-mock" }
      }),
      highlightGenerator: async () => ({
        highlight: { "0": [3, 2, 7, 2] },
        modelInfo: { provider: "minimax", model: "MiniMax-M3" }
      })
    }
  );

  const parsed = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(parsed.baselineHighlight, { "0": [2, 2, 7, 2] });
  assert.deepEqual(parsed.aiHighlight, { "0": [3, 2, 7, 2] });
  assert.equal(parsed.metrics.coverageSimilarity, 0.6);
  assert.equal(parsed.modelInfo.model, "MiniMax-M3");
  assert.match(parsed.experiment.id, /^experiment_/);

  const saved = JSON.parse(await fs.readFile(parsed.path, "utf8"));
  assert.deepEqual(saved.baselineHighlight, { "0": [2, 2, 7, 2] });
  assert.equal(saved.metrics.coverageSimilarity, 0.6);
});

test("POST /api/experiments saves a record", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "saccade-api-experiment-"));
  const response = responseRecorder();

  await handleWebMvpRequest(
    jsonRequest("/api/experiments", {
      article: {
        id: "article_test",
        sourceType: "file",
        title: "sample.md",
        paragraphs: [{ id: "0", index: 0, text: "第一段", charLength: 3 }],
        extraction: { method: "file", fallbackUsed: false, warnings: [] },
        createdAt: "2026-06-02T00:00:00.000Z"
      },
      aiHighlight: { "0": [0, 2] },
      modelInfo: { provider: "mock", model: "mock-semantic-reading-guide" }
    }),
    response,
    { experimentOutputDir: outputDir }
  );

  const parsed = JSON.parse(response.body);
  assert.match(parsed.experiment.id, /^experiment_/);
  assert.match(parsed.path, /experiment_/);
});
