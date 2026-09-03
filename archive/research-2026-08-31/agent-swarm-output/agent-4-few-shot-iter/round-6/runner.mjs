// Round 6 comparison: 20-article test of new buildHighlightPrompt vs TillGlance baseline.
// Uses web-mvp's /api/import/file + /api/compare so charLength is computed correctly.
import fs from "node:fs";
import { TEST_CORPUS } from "./test-corpus.mjs";

const BASE_URL = process.env.WEB_MVP_URL || "http://localhost:4173";
const OUT_DIR = "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/round-6";
const SLEEP_MS = 1200; // gentle throttle so M3 doesn't drop into a thinking loop

async function importParagraph(par) {
  const body = JSON.stringify({ filename: `${par.id}.txt`, text: par.text });
  const r = await fetch(`${BASE_URL}/api/import/file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  });
  if (!r.ok) throw new Error(`import failed ${r.status}: ${await r.text()}`);
  const json = await r.json();
  return json.article.paragraphs[0];
}

async function compareOne(par, { maxRetries = 3 } = {}) {
  const t0 = Date.now();
  const paragraph = await importParagraph(par);
  const body = JSON.stringify({ paragraphs: [paragraph], density: "medium" });
  const attempts = [];
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 800));
    const r = await fetch(`${BASE_URL}/api/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });
    if (r.ok) {
      const out = await r.json();
      attempts.push({ attempt, ok: true, latencyMs: out.modelInfo?.latencyMs || 0 });
      return {
        id: par.id,
        source: par.source,
        category: par.category,
        text: par.text,
        charLength: paragraph.charLength,
        baseline: out.baselineHighlight?.[paragraph.id] || null,
        ai: out.aiHighlight?.[paragraph.id] || null,
        baselineInfo: out.baselineInfo,
        modelInfo: out.modelInfo,
        metrics: out.metrics?.totals
          ? { ...out.metrics, tolerance: out.metrics.tolerance, positionHitRate: out.metrics.positionHitRate, coverageSimilarity: out.metrics.coverageSimilarity, aiDensity: out.metrics.aiDensity, baselineDensity: out.metrics.baselineDensity, densityDelta: out.metrics.densityDelta, baselineRecall: out.metrics.baselineRecall }
          : null,
        attempts,
        wallMs: Date.now() - t0
      };
    }
    const errText = await r.text();
    attempts.push({ attempt, ok: false, status: r.status, error: errText.slice(0, 200) });
    // Only retry transient out-of-bounds errors (LLM occasionally drifts past the paragraph end).
    if (!/Range out of bounds/.test(errText)) break;
  }
  const err = new Error(`compare failed after ${attempts.length} attempts`);
  err.attempts = attempts;
  throw err;
}

function rangePairs(arr = []) {
  const pairs = [];
  for (let i = 0; i < arr.length; i += 2) pairs.push([arr[i], arr[i + 1]]);
  return pairs;
}

function rangeStarts(arr = []) {
  return rangePairs(arr).map(([s]) => s);
}

function lengthDistribution(arr = []) {
  const out = {};
  for (const [, len] of rangePairs(arr)) out[len] = (out[len] || 0) + 1;
  return out;
}

function inTolerance(start, baselineStarts, tolerance) {
  return baselineStarts.some((b) => Math.abs(start - b) <= tolerance);
}

function aggregate(results) {
  const successful = results.filter((r) => r.metrics);
  const totals = {
    total: results.length,
    successful: successful.length,
    failed: results.length - successful.length,
    avgLatencyMs: Math.round(results.reduce((s, r) => s + (r.modelInfo?.latencyMs || 0), 0) / Math.max(1, results.length)),
    avgWallMs: Math.round(results.reduce((s, r) => s + r.wallMs, 0) / Math.max(1, results.length)),
    avgPositionHitRate: successful.length ? +(successful.reduce((s, r) => s + r.metrics.positionHitRate, 0) / successful.length).toFixed(4) : 0,
    avgBaselineRecall: successful.length ? +(successful.reduce((s, r) => s + r.metrics.baselineRecall, 0) / successful.length).toFixed(4) : 0,
    avgCoverageSimilarity: successful.length ? +(successful.reduce((s, r) => s + r.metrics.coverageSimilarity, 0) / successful.length).toFixed(4) : 0,
    avgAiDensity: successful.length ? +(successful.reduce((s, r) => s + r.metrics.aiDensity, 0) / successful.length).toFixed(4) : 0,
    avgBaselineDensity: successful.length ? +(successful.reduce((s, r) => s + r.metrics.baselineDensity, 0) / successful.length).toFixed(4) : 0,
    avgDensityDelta: successful.length ? +(successful.reduce((s, r) => s + r.metrics.densityDelta, 0) / successful.length).toFixed(4) : 0,
    totalSpans: successful.reduce((s, r) => s + (r.metrics.totals?.aiRanges || 0), 0),
    totalBaselineSpans: successful.reduce((s, r) => s + (r.metrics.totals?.baselineRanges || 0), 0)
  };
  // Compute ±1 and ±2 char tolerance per result (more granular than metrics.tolerance=2)
  const toleranceCounts = { "±0": 0, "±1": 0, "±2": 0, total: 0 };
  const perResult = successful.map((r) => {
    const aiStarts = rangeStarts(r.ai || []);
    const blStarts = rangeStarts(r.baseline || []);
    const matched = aiStarts.filter((s) => inTolerance(s, blStarts, 2));
    toleranceCounts.total += aiStarts.length;
    for (const s of aiStarts) {
      if (blStarts.some((b) => b === s)) toleranceCounts["±0"]++;
      if (inTolerance(s, blStarts, 1)) toleranceCounts["±1"]++;
      if (inTolerance(s, blStarts, 2)) toleranceCounts["±2"]++;
    }
    return { id: r.id, source: r.source, aiStarts, blStarts, matched: matched.length, total: aiStarts.length, lengths: lengthDistribution(r.ai || {}) };
  });
  totals.hitRate = {
    "±0": toleranceCounts.total ? +(toleranceCounts["±0"] / toleranceCounts.total).toFixed(4) : 0,
    "±1": toleranceCounts.total ? +(toleranceCounts["±1"] / toleranceCounts.total).toFixed(4) : 0,
    "±2": toleranceCounts.total ? +(toleranceCounts["±2"] / toleranceCounts.total).toFixed(4) : 0
  };
  // Length distribution across all results
  const lenDist = {};
  for (const r of successful) for (const [len, count] of Object.entries(lengthDistribution(r.ai || []))) lenDist[len] = (lenDist[len] || 0) + count;
  totals.lengthDistribution = lenDist;
  return { totals, perResult };
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`# start ${startedAt} → ${TEST_CORPUS.length} paragraphs → ${BASE_URL}`);
  const results = [];
  for (const [i, par] of TEST_CORPUS.entries()) {
    process.stdout.write(`[${String(i + 1).padStart(2)}/${TEST_CORPUS.length}] ${par.id} ${par.category} ... `);
    try {
      const r = await compareOne(par);
      const hit = r.metrics ? r.metrics.positionHitRate : 0;
      const den = r.metrics ? r.metrics.aiDensity : 0;
      const lat = r.modelInfo?.latencyMs || 0;
      const attempts = r.attempts?.length || 1;
      const retryNote = attempts > 1 ? ` (retry x${attempts - 1})` : "";
      console.log(`hit=${(hit * 100).toFixed(0)}% den=${(den * 100).toFixed(0)}% lat=${lat}ms${retryNote}`);
      results.push(r);
    } catch (e) {
      const attempts = e.attempts?.length || 0;
      const lastErr = e.attempts?.[e.attempts.length - 1]?.error || e.message;
      console.log(`ERROR x${attempts} ${lastErr.slice(0, 80)}`);
      results.push({ id: par.id, source: par.source, category: par.category, text: par.text, error: e.message, attempts: e.attempts || [] });
    }
    if (i < TEST_CORPUS.length - 1) await new Promise((r) => setTimeout(r, SLEEP_MS));
  }
  const finishedAt = new Date().toISOString();
  const summary = aggregate(results);
  const out = {
    ranAt: { startedAt, finishedAt },
    endpoint: BASE_URL,
    config: "Agent 2 10 rules + Agent 4 optimal combo (user-verbose-T0) + 5-shot from 5new.json",
    model: "MiniMax-M3 (env: web-mvp/.env.local override)",
    summary: summary.totals,
    perResultSummary: summary.perResult,
    results
  };
  const outPath = `${OUT_DIR}/round-6-results.json`;
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\n# === SUMMARY ===`);
  console.log(JSON.stringify(summary.totals, null, 2));
  console.log(`\n# saved → ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
