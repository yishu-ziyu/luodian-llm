// Round 6 — Swarm Agent B runner: multi-paragraph article validation.
//
// For each article:
//   1) POST /api/import/file with paragraphs joined by \n (gets charLength back)
//   2) POST /api/compare with density=medium (gets baseline + AI + metrics)
//   3) Save raw response + compute per-article metrics
//
// Read-only experiment: never modifies web-mvp/src/ or runner.mjs.

import fs from "node:fs";
import path from "node:path";
import { TEST_CORPUS, SUMMARY } from "./test-corpus-multi.mjs";

const BASE_URL = process.env.WEB_MVP_URL || "http://localhost:4173";
const OUT_DIR = "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/round-6/swarm-agent-B";
const RAW_DIR = path.join(OUT_DIR, "raw");
const SLEEP_MS = 1500;
const MAX_RETRIES = 2;

fs.mkdirSync(RAW_DIR, { recursive: true });

async function importArticle(article) {
  // CRITICAL: web-mvp's splitIntoParagraphs splits on /\n{2,}/, so we need \n\n
  // between paragraphs to actually create multiple server-side paragraphs.
  // Otherwise they collapse into one block and splitParagraphsForMiniMax
  // never gets to exercise the multi-batch path.
  const text = article.paragraphs.map((p) => p.text).join("\n\n");
  const r = await fetch(`${BASE_URL}/api/import/file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: `${article.id}.txt`, text })
  });
  if (!r.ok) throw new Error(`import failed ${r.status}: ${await r.text()}`);
  const json = await r.json();
  return json.article.paragraphs;
}

async function compareArticle(article, paragraphs) {
  const body = JSON.stringify({ paragraphs, density: "medium" });
  const attempts = [];
  let lastError = null;
  for (let i = 0; i <= MAX_RETRIES; i += 1) {
    if (i > 0) await new Promise((r) => setTimeout(r, 800));
    const r = await fetch(`${BASE_URL}/api/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });
    const text = await r.text();
    if (r.ok) {
      attempts.push({ attempt: i, ok: true, status: r.status });
      try {
        return { ok: true, body: JSON.parse(text), attempts };
      } catch (e) {
        throw new Error(`compare returned 200 but invalid JSON: ${text.slice(0, 200)}`);
      }
    }
    lastError = { status: r.status, text: text.slice(0, 300) };
    attempts.push({ attempt: i, ok: false, status: r.status, error: lastError.text });
  }
  return { ok: false, error: lastError, attempts };
}

function mean(arr) {
  if (!arr.length) return 0;
  return +(arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(4);
}

function rangeStarts(arr = []) {
  const starts = [];
  for (let i = 0; i < arr.length; i += 2) starts.push(arr[i]);
  return starts;
}

function inTolerance(start, baselineStarts, tolerance) {
  return baselineStarts.some((b) => Math.abs(start - b) <= tolerance);
}

function lengthDist(arr = []) {
  const out = {};
  for (let i = 0; i < arr.length; i += 2) {
    const len = arr[i + 1];
    out[len] = (out[len] || 0) + 1;
  }
  return out;
}

function summarizeArticle(article, importResp, compareResp) {
  const metrics = compareResp.body?.metrics;
  const modelInfo = compareResp.body?.modelInfo;
  const baselineInfo = compareResp.body?.baselineInfo;
  const baselineHighlight = compareResp.body?.baselineHighlight;
  const aiHighlight = compareResp.body?.aiHighlight;

  const perParagraph = (metrics?.perParagraph || []).map((p) => ({
    id: p.paragraphId,
    index: p.index,
    charLength: p.charLength,
    baselineRanges: p.baselineRanges,
    aiRanges: p.aiRanges,
    positionHitRate: p.positionHitRate,
    coverageSimilarity: p.coverageSimilarity,
    baselineDensity: p.baselineDensity,
    aiDensity: p.aiDensity,
    densityDelta: p.densityDelta,
    aiStarts: rangeStarts(aiHighlight?.[p.paragraphId] || []),
    blStarts: rangeStarts(baselineHighlight?.[p.paragraphId] || []),
    lengths: lengthDist(aiHighlight?.[p.paragraphId] || [])
  }));

  // ±0/±1/±2 tolerance hits across paragraphs
  const toleranceCounts = { "±0": 0, "±1": 0, "±2": 0, total: 0 };
  for (const pp of perParagraph) {
    for (const s of pp.aiStarts) {
      toleranceCounts.total += 1;
      if (pp.blStarts.some((b) => b === s)) toleranceCounts["±0"] += 1;
      if (inTolerance(s, pp.blStarts, 1)) toleranceCounts["±1"] += 1;
      if (inTolerance(s, pp.blStarts, 2)) toleranceCounts["±2"] += 1;
    }
  }

  return {
    id: article.id,
    source: article.source,
    category: article.category,
    paragraphCount: article.paragraphs.length,
    totalChars: importResp.reduce((s, p) => s + (p.charLength || 0), 0),
    requestCount: modelInfo?.requestCount ?? null,
    latencyMs: modelInfo?.latencyMs ?? null,
    modelUsage: modelInfo?.usage ?? null,
    baselineInfo,
    modelInfo,
    aggregateMetrics: metrics?.totals
      ? {
          aiDensity: metrics.aiDensity,
          baselineDensity: metrics.baselineDensity,
          densityDelta: metrics.densityDelta,
          positionHitRate: metrics.positionHitRate,
          baselineRecall: metrics.baselineRecall,
          coverageSimilarity: metrics.coverageSimilarity,
          totalAiRanges: metrics.totals.aiRanges,
          totalBaselineRanges: metrics.totals.baselineRanges
        }
      : null,
    hitRate: {
      "±0": toleranceCounts.total ? +(toleranceCounts["±0"] / toleranceCounts.total).toFixed(4) : 0,
      "±1": toleranceCounts.total ? +(toleranceCounts["±1"] / toleranceCounts.total).toFixed(4) : 0,
      "±2": toleranceCounts.total ? +(toleranceCounts["±2"] / toleranceCounts.total).toFixed(4) : 0,
      total: toleranceCounts.total
    },
    lengthDistribution: perParagraph.reduce((acc, pp) => {
      for (const [len, c] of Object.entries(pp.lengths)) acc[len] = (acc[len] || 0) + c;
      return acc;
    }, {}),
    perParagraph
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`# start ${startedAt} → ${TEST_CORPUS.length} articles → ${BASE_URL}`);
  console.log(`# corpus: ${SUMMARY.totalArticles} articles, ${SUMMARY.totalParagraphs} paragraphs total\n`);

  const articleResults = [];

  for (const [i, article] of TEST_CORPUS.entries()) {
    process.stdout.write(`[${i + 1}/${TEST_CORPUS.length}] ${article.id} ${article.category} (${article.paragraphs.length}p) ... `);
    const articleT0 = Date.now();
    try {
      const paragraphs = await importArticle(article);
      const compareResp = await compareArticle(article, paragraphs);
      const raw = {
        articleId: article.id,
        source: article.source,
        category: article.category,
        importedParagraphs: paragraphs,
        compareResponse: compareResp.ok ? compareResp.body : null,
        error: compareResp.ok ? null : compareResp.error,
        attempts: compareResp.attempts,
        wallMs: Date.now() - articleT0
      };
      fs.writeFileSync(path.join(RAW_DIR, `${article.id}.json`), JSON.stringify(raw, null, 2));

      if (!compareResp.ok) {
        console.log(`FAIL status=${compareResp.error?.status} wall=${raw.wallMs}ms (raw saved)`);
        articleResults.push({
          id: article.id,
          source: article.source,
          category: article.category,
          paragraphCount: article.paragraphs.length,
          totalChars: paragraphs.reduce((s, p) => s + (p.charLength || 0), 0),
          error: compareResp.error,
          attempts: compareResp.attempts,
          wallMs: raw.wallMs
        });
        continue;
      }

      const summary = summarizeArticle(article, paragraphs, compareResp);
      const hit = summary.aggregateMetrics?.positionHitRate ?? 0;
      const den = summary.aggregateMetrics?.aiDensity ?? 0;
      const req = summary.requestCount ?? "?";
      const cacheHit = summary.modelUsage?.cache_read_input_tokens ?? 0;
      console.log(
        `hit=${(hit * 100).toFixed(0)}% den=${(den * 100).toFixed(0)}% req=${req} cache_read=${cacheHit} wall=${raw.wallMs}ms`
      );
      articleResults.push(summary);
    } catch (e) {
      console.log(`THROW ${e.message}`);
      articleResults.push({
        id: article.id,
        source: article.source,
        category: article.category,
        paragraphCount: article.paragraphs.length,
        error: { text: e.message },
        wallMs: Date.now() - articleT0
      });
    }

    if (i < TEST_CORPUS.length - 1) await new Promise((r) => setTimeout(r, SLEEP_MS));
  }

  const finishedAt = new Date().toISOString();
  const successful = articleResults.filter((r) => r.aggregateMetrics);
  const failed = articleResults.filter((r) => !r.aggregateMetrics);

  const aggregate = {
    total: articleResults.length,
    successful: successful.length,
    failed: failed.length,
    totalParagraphs: successful.reduce((s, r) => s + r.paragraphCount, 0),
    totalChars: successful.reduce((s, r) => s + r.totalChars, 0),
    totalSpans: successful.reduce((s, r) => s + (r.aggregateMetrics?.totalAiRanges || 0), 0),
    totalBaselineSpans: successful.reduce((s, r) => s + (r.aggregateMetrics?.totalBaselineRanges || 0), 0),
    avgHitRate: mean(successful.map((r) => r.aggregateMetrics.positionHitRate)),
    avgBaselineRecall: mean(successful.map((r) => r.aggregateMetrics.baselineRecall)),
    avgCoverageSimilarity: mean(successful.map((r) => r.aggregateMetrics.coverageSimilarity)),
    avgAiDensity: mean(successful.map((r) => r.aggregateMetrics.aiDensity)),
    avgBaselineDensity: mean(successful.map((r) => r.aggregateMetrics.baselineDensity)),
    avgDensityDelta: mean(successful.map((r) => r.aggregateMetrics.densityDelta)),
    hitRate: {
      "±0": mean(successful.map((r) => r.hitRate["±0"])),
      "±1": mean(successful.map((r) => r.hitRate["±1"])),
      "±2": mean(successful.map((r) => r.hitRate["±2"]))
    },
    lengthDistribution: successful.reduce((acc, r) => {
      for (const [len, c] of Object.entries(r.lengthDistribution)) acc[len] = (acc[len] || 0) + c;
      return acc;
    }, {}),
    batching: {
      requestCountByArticle: Object.fromEntries(
        successful.map((r) => [r.id, { requestCount: r.requestCount, latencyMs: r.latencyMs }])
      ),
      articlesWithMultipleBatches: successful.filter((r) => (r.requestCount || 0) > 1).map((r) => r.id),
      articlesWithSingleBatch: successful.filter((r) => r.requestCount === 1).map((r) => r.id),
      cacheHits: successful.map((r) => ({
        id: r.id,
        cache_read_input_tokens: r.modelUsage?.cache_read_input_tokens || 0,
        cache_creation_input_tokens: r.modelUsage?.cache_creation_input_tokens || 0,
        input_tokens: r.modelUsage?.input_tokens || 0,
        output_tokens: r.modelUsage?.output_tokens || 0
      }))
    }
  };

  const out = {
    ranAt: { startedAt, finishedAt },
    endpoint: BASE_URL,
    config: "Swarm Agent B: 5 multi-paragraph articles (3-5 paragraphs each)",
    model: "MiniMax-M3 (server-side, env: web-mvp/.env.local)",
    summary: aggregate,
    articles: articleResults
  };

  fs.writeFileSync(path.join(OUT_DIR, "aggregate.json"), JSON.stringify(out, null, 2));
  console.log(`\n# === AGGREGATE ===`);
  console.log(JSON.stringify({ aggregate, failed: failed.map((f) => ({ id: f.id, error: f.error })) }, null, 2));
  console.log(`\n# saved → ${path.join(OUT_DIR, "aggregate.json")}`);
  console.log(`# raw responses → ${RAW_DIR}/`);
}

main().catch((e) => { console.error(e); process.exit(1); });