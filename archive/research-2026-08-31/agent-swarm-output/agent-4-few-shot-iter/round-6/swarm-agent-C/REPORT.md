# Swarm Agent C — Round 6b Density Tightening Report

**Date**: 2026-06-13
**Agent**: C (density target tuning)
**Target file**: `web-mvp/src/llm-client.mjs` (`buildHighlightPrompt`)
**Goal**: lift AI density closer to TillGlance baseline (47.31%) by relaxing the spacing rule and raising the lower bound on the density range.

## Diff (exactly 2 lines changed)

```diff
-    "5. Distance between adjacent highlight starts should be 6-10 characters (saccade distance effect); never less than 4.",
+    "5. Distance between adjacent highlight starts should be 5-8 characters (saccade distance effect); never less than 3.",

-    "8. Density: highlighted chars / paragraph length ≈ 25-45% (TillGlance empirical baseline range).",
+    "8. Density: highlighted chars / paragraph length ≈ 35-50% (TillGlance empirical baseline range).",
```

No other code in the file was modified. `FEW_SHOT_EXAMPLES`, system message, request body, and rules #1–#4, #6–#7, #9–#10 are untouched.

## Round-6b summary (copied from `runner-b.log`)

```json
{
  "total": 20,
  "successful": 17,
  "failed": 3,
  "avgLatencyMs": 2950,
  "avgPositionHitRate": 0.872,
  "avgBaselineRecall": 0.9046,
  "avgCoverageSimilarity": 0.3598,
  "avgAiDensity": 0.4665,
  "avgBaselineDensity": 0.4736,
  "avgDensityDelta": -0.0071,
  "totalSpans": 142,
  "totalBaselineSpans": 144,
  "hitRate": {
    "±0": 0.2676,
    "±1": 0.6408,
    "±2": 0.8521
  },
  "lengthDistribution": { "2": 137, "3": 5 }
}
```

Failure breakdown: B0 (transient `fetch failed` right after server restart), B2 + B6 (LLM produced a range past paragraph end → "Range out of bounds" / `fetch failed`). The two OOB failures look like real model behavior under the new tighter spacing (more spans to misplace, occasional drift past the end).

## Comparison

| Metric | Old (round-6) | New (round-6b) | Delta |
|---|---|---|---|
| ±2 char hit rate | 87.88% | 85.21% | **−2.67pp** |
| AI density | 44.02% | 46.65% | **+2.63pp** (closer to 47.31%) |
| Density delta vs baseline | −3.29pp | −0.71pp | **+2.58pp** (target met) |
| Success rate | 19/20 | 17/20 | −2 (1 transient + 1–2 OOB) |
| Length distribution | {2:164, 4:1} | {2:137, 3:5} | 3-char spans emerged (compound terms) |
| Coverage similarity | 0.3394 | 0.3598 | +0.020 |
| Avg latency (ms) | 2085 | 2950 | +865 (LLM think-time on the tightest paragraphs) |

## One-line verdict

**⚠️ Density target hit (46.65% vs 47.36% baseline, Δ −0.71pp), but hit rate dropped 2.67pp and success rate fell to 17/20. NOT a clean win — recommend NOT reverting yet, but DO run one more iteration that re-tweaks only the lower bound on rule #5 (e.g. `4-8` / `never less than 3`) to give the model back a bit of safety margin without losing the density gain.**

The −2.67pp hit-rate drop is below the 5pp revert threshold set in the brief, so a hard revert is not warranted. The primary objective (lift density to within ~1pp of baseline) is met. The secondary cost (hit rate + 2 OOB failures) is real but small enough to attribute to the spacing change being slightly too aggressive on the 1–2 densest paragraphs in the corpus (F4/F5/F6 短句/对话: hit 50%–100% but density spiked to 57%–75%).

## Recommendation for the next round

- Keep rule #8 at `35-50%` (working as intended).
- Loosen rule #5 back slightly to `5-9 characters` (keep the "never less than 3" floor) — that gives 1–2 more chars of safety on tight paragraphs and should drop the OOB count back to ~0 without pulling density back below 45%.
- Alternative: leave #5 at `5-8` and instead add a #11 rule "if a paragraph has fewer than 30 chars, cap at 3 spans total" to guard short paragraphs.

## Artifacts

- Edited source: `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/web-mvp/src/llm-client.mjs`
- Full results: `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/round-6/round-6b-results.json`
- Runner log: `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/round-6/runner-b.log`
