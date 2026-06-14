import test from "node:test";
import assert from "node:assert/strict";
import { computeHighlightMetrics } from "../src/compare-metrics.mjs";

test("computeHighlightMetrics scores position, coverage, and density differences", () => {
  const paragraphs = [{ id: "0", index: 0, text: "0123456789", charLength: 10 }];
  const metrics = computeHighlightMetrics({
    paragraphs,
    baselineHighlight: { "0": [2, 2, 7, 2] },
    aiHighlight: { "0": [3, 2, 7, 2] },
    tolerance: 2
  });

  assert.equal(metrics.positionHitRate, 1);
  assert.equal(metrics.baselineRecall, 1);
  assert.equal(metrics.coverageSimilarity, 0.6);
  assert.equal(metrics.baselineDensity, 0.4);
  assert.equal(metrics.aiDensity, 0.4);
  assert.equal(metrics.densityDelta, 0);
  assert.equal(metrics.totals.overlapChars, 3);
});

test("computeHighlightMetrics exposes missed teacher anchors", () => {
  const paragraphs = [{ id: "0", index: 0, text: "0123456789", charLength: 10 }];
  const metrics = computeHighlightMetrics({
    paragraphs,
    baselineHighlight: { "0": [2, 2, 7, 2] },
    aiHighlight: { "0": [0, 2] },
    tolerance: 1
  });

  assert.equal(metrics.positionHitRate, 0);
  assert.equal(metrics.baselineRecall, 0);
  assert.equal(metrics.aiDensity, 0.2);
  assert.equal(metrics.densityDelta, -0.2);
});
