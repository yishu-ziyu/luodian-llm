import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { saveReadingExperiment } from "../src/experiments.mjs";

test("saveReadingExperiment writes a reproducible JSON record", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "saccade-experiment-"));
  const article = {
    id: "article_test",
    sourceType: "file",
    title: "sample.md",
    paragraphs: [{ id: "0", index: 0, text: "第一段", charLength: 3 }],
    extraction: { method: "file", fallbackUsed: false, warnings: [] },
    createdAt: "2026-06-02T00:00:00.000Z"
  };

  const saved = await saveReadingExperiment({
    article,
    aiHighlight: { "0": [0, 2] },
    baselineHighlight: { "0": [1, 2] },
    baselineInfo: { provider: "reference-mock" },
    metrics: { coverageSimilarity: 0.5 },
    modelInfo: { provider: "mock", model: "mock-semantic-reading-guide" },
    outputDir
  });

  const parsed = JSON.parse(await fs.readFile(saved.path, "utf8"));
  assert.match(parsed.id, /^experiment_/);
  assert.equal(parsed.article.id, "article_test");
  assert.deepEqual(parsed.aiHighlight, { "0": [0, 2] });
  assert.deepEqual(parsed.baselineHighlight, { "0": [1, 2] });
  assert.equal(parsed.baselineInfo.provider, "reference-mock");
  assert.equal(parsed.metrics.coverageSimilarity, 0.5);
  assert.equal(parsed.modelInfo.provider, "mock");
});
