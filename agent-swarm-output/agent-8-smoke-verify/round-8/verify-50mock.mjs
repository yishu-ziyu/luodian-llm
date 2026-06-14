// Agent 8 round-8 verify-50mock.mjs — Phase 2: mock provider regression.
//
// Goal: confirm Wave-1 changes (rule 3 + extractAnthropicText + thinking:disabled)
// did NOT regress the 50-mock stability baseline from round-7 V3.
//   - Expected: 50/50 success
//   - Expected: 0 OOB
//   - Expected: density / p50 / p95 within V3 ranges
//
// Read-only. Re-uses round-7 V3 corpus at:
//   agent-5-stability/round-7/stability-corpus.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { STABILITY_CORPUS, SUMMARY } from "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-5-stability/round-7/stability-corpus.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..", "..");
const WEB_MVP_SRC = path.join(ROOT, "web-mvp", "src");

const LOG_PATH = path.join(__dirname, "mock-output.log");
const RESULTS_PATH = path.join(__dirname, "mock-results.json");

// ---- Load web-mvp modules (read-only) ----
const articleMod = await import(pathToFileURL(path.join(WEB_MVP_SRC, "article.mjs")).href);
const highlightMod = await import(pathToFileURL(path.join(WEB_MVP_SRC, "highlight.mjs")).href);
const llmClientMod = await import(pathToFileURL(path.join(WEB_MVP_SRC, "llm-client.mjs")).href);

const { splitIntoParagraphs } = articleMod;
const { assertHighlightMap, clipHighlightSpans, generateMockHighlightMap } = highlightMod;
const { generateAiHighlight, detectLanguage } = llmClientMod;

// ---- Log helpers ----
const logLines = [];
function log(...args) {
  const line = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  console.log(line);
  logLines.push(line);
}

function percentile(arr, p) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function buildParagraphs(article) {
  const rawParagraphs = splitIntoParagraphs(article.text, { splitMode: "auto" });
  return rawParagraphs.map((text, index) => ({
    id: String(index),
    index,
    text,
    charLength: Array.from(text).length
  }));
}

async function processOne(article) {
  const startedAt = Date.now();
  const record = {
    id: article.id,
    lang: article.id.startsWith("ZH") ? "zh" : "en",
    format: article.format,
    category: article.category,
    text_length: Array.from(article.text).length,
    paragraph_count: 0,
    detected_language: null,
    highlight_chars: 0,
    span_count: 0,
    density: 0,
    oob_count: 0,
    clip_drops: 0,
    batch_count: 0,
    request_count: 0,
    latency_ms: 0,
    error: null,
    error_msg: null
  };

  let paragraphs;
  try {
    paragraphs = buildParagraphs(article);
  } catch (e) {
    record.error = "SPLIT_ERROR";
    record.error_msg = e.message;
    record.latency_ms = Date.now() - startedAt;
    return record;
  }
  record.paragraph_count = paragraphs.length;

  const detected = detectLanguage(paragraphs);
  record.detected_language = detected;

  let result;
  try {
    result = await generateAiHighlight({
      paragraphs,
      density: "medium",
      providerMode: "mock"
    });
  } catch (error) {
    record.error = "LLM_ERROR";
    record.error_msg = String(error?.message || error);
    record.latency_ms = Date.now() - startedAt;
    return record;
  }

  record.latency_ms = result.modelInfo?.latencyMs || (Date.now() - startedAt);
  record.request_count = result.modelInfo?.requestCount || 0;

  const highlight = result.highlight || {};
  let totalHL = 0;
  let totalChars = 0;
  let totalSpans = 0;

  for (const para of paragraphs) {
    const ranges = highlight[para.id] || [];
    for (let i = 0; i < ranges.length; i += 2) {
      totalHL += ranges[i + 1];
      totalSpans += 1;
    }
    totalChars += para.charLength;
  }

  record.highlight_chars = totalHL;
  record.span_count = totalSpans;
  record.density = totalChars > 0 ? (totalHL / totalChars) * 100 : 0;

  // OOB count via clipHighlightSpans (defensive).
  let dropped = 0;
  const origWarn = console.warn;
  console.warn = (...args) => {
    if (args[0] && String(args[0]).includes("dropped span")) dropped += 1;
    origWarn(...args);
  };
  try {
    clipHighlightSpans(highlight, paragraphs);
  } catch (e) {
    // ignore
  }
  console.warn = origWarn;
  record.clip_drops = dropped;

  return record;
}

const startedAt = Date.now();
log("=== Agent 8 round-8 Phase 2: mock provider regression (50 texts) ===");
log(`started at ${new Date(startedAt).toISOString()}`);
log(`corpus summary: ${JSON.stringify(SUMMARY)}`);
log("");

const CONCURRENCY = 5;
const results = [];
let nextIndex = 0;

async function worker() {
  while (nextIndex < STABILITY_CORPUS.length) {
    const idx = nextIndex;
    nextIndex += 1;
    const r = await processOne(STABILITY_CORPUS[idx]);
    results[idx] = r;
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, STABILITY_CORPUS.length) }, () => worker()));

// ---- Aggregate ----
const total = results.length;
const success = results.filter((r) => !r.error);
const failed = results.filter((r) => r.error);
const oobTotal = success.reduce((a, r) => a + r.clip_drops, 0);
const densities = success.map((r) => r.density);
const latencies = success.map((r) => r.latency_ms);
const detectedCorrect = success.filter((r) => {
  if (r.lang === "zh") return r.detected_language === "zh";
  return r.detected_language === "en";
});

const byFormat = {};
for (const r of success) {
  const key = `${r.lang}×${r.format}`;
  if (!byFormat[key]) byFormat[key] = { n: 0, densities: [] };
  byFormat[key].n += 1;
  byFormat[key].densities.push(r.density);
}

log("=== aggregate ===");
log(`total:           ${total}`);
log(`success:         ${success.length} / ${total}  (target 50/50 — round-7 V3 baseline)`);
log(`failed:          ${failed.length} / ${total}`);
log(`clip drops:      ${oobTotal}  (target 0 — round-7 V3 baseline)`);
log(`detected lang ok:${detectedCorrect.length} / ${success.length}`);
log("");
log(`density mean:    ${mean(densities).toFixed(1)}%  (round-7 V3: zh 23.0% / en 21.0%)`);
log(`density p50/p95: ${percentile(densities, 50)?.toFixed(1)}% / ${percentile(densities, 95)?.toFixed(1)}%`);
log(`latency p50/p95: ${percentile(latencies, 50)}ms / ${percentile(latencies, 95)}ms`);
log("");

log("--- per lang × format ---");
for (const [key, agg] of Object.entries(byFormat).sort()) {
  log(`  ${key.padEnd(28)}  n=${agg.n}  density mean=${mean(agg.densities).toFixed(1)}%  min=${Math.min(...agg.densities).toFixed(1)}%  max=${Math.max(...agg.densities).toFixed(1)}%`);
}

if (failed.length > 0) {
  log("");
  log("--- failures ---");
  for (const r of failed) {
    log(`  [${r.error}] ${r.id}: ${r.error_msg}`);
  }
}

const elapsed = Date.now() - startedAt;
log("");
log(`elapsed: ${(elapsed / 1000).toFixed(2)}s`);

// ---- Persist artifacts ----
fs.writeFileSync(LOG_PATH, logLines.join("\n") + "\n");
fs.writeFileSync(
  RESULTS_PATH,
  JSON.stringify(
    {
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      elapsedMs: elapsed,
      corpus: "round-7 V3 stability-corpus.mjs",
      aggregate: {
        total,
        success: success.length,
        failed: failed.length,
        oobTotal,
        detectedCorrect: detectedCorrect.length,
        densityMean: mean(densities),
        densityP50: percentile(densities, 50),
        densityP95: percentile(densities, 95),
        latencyP50: percentile(latencies, 50),
        latencyP95: percentile(latencies, 95),
        byFormat: Object.fromEntries(
          Object.entries(byFormat).map(([k, v]) => [k, { n: v.n, densityMean: mean(v.densities), densityMin: Math.min(...v.densities), densityMax: Math.max(...v.densities) }])
        )
      },
      results
    },
    null,
    2
  ) + "\n"
);
console.log("");
console.log(`log written to ${LOG_PATH}`);
console.log(`results written to ${RESULTS_PATH}`);
