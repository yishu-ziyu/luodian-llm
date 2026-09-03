// Round 7 stability runner — Agent 5
//
// Goals:
//   1. Verify splitIntoParagraphs("auto") default behavior on 50 mixed articles
//   2. Verify generateAiHighlight mock path (no real LLM) succeeds for every article
//   3. Verify clipHighlightSpans keeps output assertHighlightMap-clean
//   4. Verify detectLanguage picks the right pool for ZH vs EN
//   5. Verify batching: splitParagraphsForMiniMax gives a sensible batch count
//
// Read-only: NEVER writes to web-mvp/src/*.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { STABILITY_CORPUS, SUMMARY } from "./stability-corpus.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..", "..");
const WEB_MVP_SRC = path.join(ROOT, "web-mvp", "src");

const CONCURRENCY = 5;
const LOG_PATH = path.join(__dirname, "verify-output.log");
const RESULTS_PATH = path.join(__dirname, "stability-results.json");

// ---- Load web-mvp modules (read-only) ----
const articleMod = await import(pathToFileURL(path.join(WEB_MVP_SRC, "article.mjs")).href);
const highlightMod = await import(pathToFileURL(path.join(WEB_MVP_SRC, "highlight.mjs")).href);
const llmClientMod = await import(pathToFileURL(path.join(WEB_MVP_SRC, "llm-client.mjs")).href);

const { splitIntoParagraphs } = articleMod;
const { assertHighlightMap, clipHighlightSpans, generateMockHighlightMap } = highlightMod;
const { generateAiHighlight, detectLanguage, loadProviderEnv } = llmClientMod;

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

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

// ---- Build paragraph objects (matches createArticleDocument shape) ----
function buildParagraphs(article) {
  const rawParagraphs = splitIntoParagraphs(article.text, { splitMode: "auto" });
  return rawParagraphs.map((text, index) => ({
    id: String(index),
    index,
    text,
    charLength: Array.from(text).length
  }));
}

// ---- Per-article worker ----
async function processOne(article) {
  const startedAt = Date.now();
  const record = {
    id: article.id,
    lang: article.lang || (article.id.startsWith("ZH") ? "zh" : "en"),
    format: article.format,
    category: article.category,
    text_length: Array.from(article.text).length,
    paragraph_count: 0,
    split_paragraphs: 0,
    detected_language: null,
    highlighted_chars: 0,
    span_count: 0,
    density: 0,
    oob_count: 0,
    oob_examples: [],
    clip_drops: 0,
    batch_count: 0,
    request_count: 0,
    latency_ms: 0,
    error: null,
    notes: []
  };

  try {
    // 1. Split test (auto mode)
    const splitParts = splitIntoParagraphs(article.text, { splitMode: "auto" });
    record.split_paragraphs = splitParts.length;

    // 2. Build paragraph objects (immutable charLength)
    const paragraphs = buildParagraphs(article);
    record.paragraph_count = paragraphs.length;

    if (paragraphs.length === 0) {
      record.error = "splitIntoParagraphs returned 0 paragraphs (empty after trim)";
      record.latency_ms = Date.now() - startedAt;
      return record;
    }

    // 3. Detect language (test that path is reachable)
    record.detected_language = detectLanguage(paragraphs);
    if (record.lang === "zh" && record.detected_language !== "zh") {
      record.notes.push(`detectLanguage returned '${record.detected_language}' for Chinese article`);
    }
    if (record.lang === "en" && record.detected_language !== "en") {
      record.notes.push(`detectLanguage returned '${record.detected_language}' for English article`);
    }

    // 4. Estimate batch count using the same logic the real client uses
    // (MINIMAX_MAX_PARAGRAPHS_PER_REQUEST=4, MINIMAX_MAX_CHARS_PER_REQUEST=1200)
    const MAX_PARA = 4;
    const MAX_CHARS = 1200;
    let batches = 0;
    let curPara = 0;
    let curChars = 0;
    for (const paragraph of paragraphs) {
      const charLength = paragraph.charLength;
      const wouldOverflow =
        curPara > 0 && (curPara >= MAX_PARA || curChars + charLength > MAX_CHARS);
      if (wouldOverflow) {
        batches += 1;
        curPara = 0;
        curChars = 0;
      }
      curPara += 1;
      curChars += charLength;
    }
    if (curPara > 0) batches += 1;
    record.batch_count = batches;

    // 5. Run the actual generateAiHighlight (mock provider, no real LLM call)
    const result = await generateAiHighlight({
      paragraphs,
      density: "medium",
      providerMode: "mock"
    });

    // 6. Validate output
    if (!result || !result.highlight) {
      throw new Error("generateAiHighlight returned no highlight map");
    }

    // Count spans BEFORE clip (raw)
    const rawSpanCount = Object.values(result.highlight).reduce(
      (acc, ranges) => acc + (Array.isArray(ranges) ? ranges.length / 2 : 0),
      0
    );
    record.span_count = rawSpanCount;

    // Count highlighted chars
    let totalHighlighted = 0;
    for (const ranges of Object.values(result.highlight)) {
      if (!Array.isArray(ranges)) continue;
      for (let i = 0; i < ranges.length; i += 2) {
        totalHighlighted += ranges[i + 1];
      }
    }
    record.highlighted_chars = totalHighlighted;
    const totalChars = paragraphs.reduce((acc, p) => acc + p.charLength, 0);
    record.density = totalChars > 0 ? totalHighlighted / totalChars : 0;

    // 7. OOB check: try to assert raw highlightMap
    let oobCount = 0;
    let clipDrops = 0;
    let clipped;
    try {
      assertHighlightMap(result.highlight, paragraphs);
    } catch (err) {
      // Mock provider should always produce in-bounds spans, so this should never throw
      record.notes.push(`assertHighlightMap threw on mock output: ${err.message}`);
      oobCount = 1;
    }

    // 8. clipHighlightSpans test (should be no-op for clean mock output)
    clipped = clipHighlightSpans(result.highlight, paragraphs);
    const clippedSpanCount = Object.values(clipped).reduce(
      (acc, ranges) => acc + (Array.isArray(ranges) ? ranges.length / 2 : 0),
      0
    );
    clipDrops = rawSpanCount - clippedSpanCount;
    record.oob_count = oobCount;
    record.clip_drops = clipDrops;

    // 9. Re-assert clipped (must be clean)
    try {
      assertHighlightMap(clipped, paragraphs);
    } catch (err) {
      record.error = `clipped output failed assert: ${err.message}`;
    }

    // 10. Stash batch_count for record
    record.request_count = batches; // mock doesn't actually fire requests; this is the estimated count
  } catch (err) {
    record.error = err && err.message ? err.message : String(err);
  }

  record.latency_ms = Date.now() - startedAt;
  return record;
}

// ---- Main ----
async function main() {
  const t0 = Date.now();
  log(`===== Round 7 Stability Run (${new Date().toISOString()}) =====`);
  log(`Total articles: ${STABILITY_CORPUS.length}`);
  log(`Concurrency: ${CONCURRENCY}`);
  log(`Summary:`, SUMMARY);
  log(`Provider: mock (no real LLM call)`);
  log(``);

  // === Phase 1: splitIntoParagraphs only (sanity) ===
  log(`--- Phase 1: splitIntoParagraphs auto-mode sanity ---`);
  for (const article of STABILITY_CORPUS) {
    const parts = splitIntoParagraphs(article.text, { splitMode: "auto" });
    log(`  ${article.id} [${article.format}]: ${parts.length} paragraph(s) from ${Array.from(article.text).length} chars`);
  }
  log(``);

  // === Phase 2: full pipeline on all 50 ===
  log(`--- Phase 2: full generateAiHighlight(mock) on all 50 ---`);
  const records = await mapWithConcurrency(STABILITY_CORPUS, CONCURRENCY, processOne);
  for (const r of records) {
    const status = r.error ? `ERROR: ${r.error}` : `OK`;
    log(`  ${r.id} [${r.format}] lang=${r.detected_language} parts=${r.paragraph_count} spans=${r.span_count} density=${(r.density * 100).toFixed(1)}% latency=${r.latency_ms}ms batches=${r.batch_count} clipDrops=${r.clip_drops} oob=${r.oob_count} ${status}`);
    if (r.notes && r.notes.length) {
      for (const note of r.notes) log(`    note: ${note}`);
    }
  }
  log(``);

  // === Phase 3: aggregations ===
  log(`--- Phase 3: aggregates ---`);

  const errors = records.filter((r) => r.error);
  const successes = records.filter((r) => !r.error);
  log(`Total: ${records.length}`);
  log(`Successes: ${successes.length}`);
  log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    for (const e of errors) log(`  ERROR ${e.id}: ${e.error}`);
  }

  const latencies = records.map((r) => r.latency_ms);
  log(`Latency p50: ${percentile(latencies, 50)}ms`);
  log(`Latency p95: ${percentile(latencies, 95)}ms`);
  log(`Latency max: ${Math.max(...latencies)}ms`);

  function aggregateBy(predicate) {
    const groups = {};
    for (const r of records) {
      const key = predicate(r);
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return groups;
  }

  log(``);
  log(`By language × format:`);
  const langFormatGroups = aggregateBy((r) => `${r.lang} × ${r.format}`);
  for (const [key, group] of Object.entries(langFormatGroups).sort()) {
    const errs = group.filter((r) => r.error).length;
    const densities = group.map((r) => r.density);
    const lats = group.map((r) => r.latency_ms);
    log(
      `  ${key.padEnd(28)} n=${group.length} errors=${errs} density=${(mean(densities) * 100).toFixed(1)}% (min ${(Math.min(...densities) * 100).toFixed(1)}, max ${(Math.max(...densities) * 100).toFixed(1)}) p50=${percentile(lats, 50)}ms p95=${percentile(lats, 95)}ms`
    );
  }

  log(``);
  log(`By language only:`);
  const langGroups = aggregateBy((r) => r.lang);
  for (const [key, group] of Object.entries(langGroups).sort()) {
    const errs = group.filter((r) => r.error).length;
    const densities = group.map((r) => r.density);
    const lats = group.map((r) => r.latency_ms);
    log(
      `  ${key.padEnd(8)} n=${group.length} errors=${errs} density=${(mean(densities) * 100).toFixed(1)}% (min ${(Math.min(...densities) * 100).toFixed(1)}, max ${(Math.max(...densities) * 100).toFixed(1)}) p50=${percentile(lats, 50)}ms p95=${percentile(lats, 95)}ms`
    );
  }

  log(``);
  log(`By format only:`);
  const formatGroups = aggregateBy((r) => r.format);
  for (const [key, group] of Object.entries(formatGroups).sort()) {
    const errs = group.filter((r) => r.error).length;
    const splitCounts = group.map((r) => r.split_paragraphs);
    const batches = group.map((r) => r.batch_count);
    const densities = group.map((r) => r.density);
    log(
      `  ${key.padEnd(20)} n=${group.length} errors=${errs} split[${Math.min(...splitCounts)}-${Math.max(...splitCounts)}] batches[${Math.min(...batches)}-${Math.max(...batches)}] density=${(mean(densities) * 100).toFixed(1)}%`
    );
  }

  // language detection mismatches
  const detectMismatches = records.filter(
    (r) => !r.error && ((r.lang === "zh" && r.detected_language !== "zh") || (r.lang === "en" && r.detected_language !== "en"))
  );
  log(``);
  log(`Language detection mismatches: ${detectMismatches.length} / ${records.length}`);
  for (const m of detectMismatches) log(`  ${m.id}: expected ${m.lang}, got ${m.detected_language}`);

  // OOB / clip analysis
  const oobCases = records.filter((r) => r.oob_count > 0);
  const clipCases = records.filter((r) => r.clip_drops > 0);
  log(``);
  log(`OOB cases: ${oobCases.length}`);
  log(`Clip-drop cases: ${clipCases.length}`);
  for (const c of clipCases) {
    log(`  ${c.id}: dropped ${c.clip_drops} span(s) (mock: should be 0)`);
  }

  // top 5 anomalies: highest latency, lowest density, highest density, error cases
  log(``);
  log(`--- Top anomalies ---`);
  const byLatency = [...records].sort((a, b) => b.latency_ms - a.latency_ms).slice(0, 5);
  for (const r of byLatency) log(`  slowest: ${r.id} ${r.latency_ms}ms`);

  const cleanRecords = records.filter((r) => !r.error);
  const byLowDensity = [...cleanRecords].sort((a, b) => a.density - b.density).slice(0, 5);
  for (const r of byLowDensity) log(`  lowest density: ${r.id} ${(r.density * 100).toFixed(1)}% (${r.span_count} spans / ${r.highlighted_chars} chars)`);

  const byHighDensity = [...cleanRecords].sort((a, b) => b.density - a.density).slice(0, 5);
  for (const r of byHighDensity) log(`  highest density: ${r.id} ${(r.density * 100).toFixed(1)}% (${r.span_count} spans / ${r.highlighted_chars} chars)`);

  // === Phase 4: optional real-LLM smoke (5 articles, if env key present) ===
  log(``);
  log(`--- Phase 4: real-LLM smoke (5 articles, only if env has MiniMax key) ---`);
  const env = loadProviderEnv();
  const hasKey = !!(env.MINIMAX_TOKEN_PLAN_KEY || env.MINIMAX_API_KEY);
  log(`  hasKey=${hasKey}`);

  let realRecords = [];
  if (hasKey) {
    // Pick 5 representative: 2 ZH single-paragraph, 1 ZH multi-paragraph,
    // 1 EN single-paragraph, 1 EN multi-paragraph
    const realSample = STABILITY_CORPUS.filter((a) =>
      ["ZH-00", "ZH-18", "ZH-21", "EN-07", "EN-13"].includes(a.id)
    );
    log(`  sampling: ${realSample.map((a) => a.id).join(", ")}`);

    async function processOneReal(article) {
      const startedAt = Date.now();
      const record = {
        id: article.id,
        lang: article.id.startsWith("ZH") ? "zh" : "en",
        format: article.format,
        text_length: Array.from(article.text).length,
        paragraph_count: 0,
        span_count: 0,
        density: 0,
        oob_count: 0,
        clip_drops: 0,
        latency_ms: 0,
        error: null
      };
      try {
        const paragraphs = buildParagraphs(article);
        record.paragraph_count = paragraphs.length;
        const result = await generateAiHighlight({
          paragraphs,
          density: "medium",
          providerMode: "minimax",
          env
        });
        // Count spans
        let totalHighlighted = 0;
        let totalSpans = 0;
        for (const ranges of Object.values(result.highlight)) {
          if (!Array.isArray(ranges)) continue;
          for (let i = 0; i < ranges.length; i += 2) {
            totalHighlighted += ranges[i + 1];
            totalSpans += 1;
          }
        }
        record.span_count = totalSpans;
        record.highlighted_chars = totalHighlighted;
        const totalChars = paragraphs.reduce((acc, p) => acc + p.charLength, 0);
        record.density = totalChars > 0 ? totalHighlighted / totalChars : 0;
        // Re-assert with clip
        try {
          assertHighlightMap(result.highlight, paragraphs);
        } catch (err) {
          record.oob_count = 1;
          record.error = `OOB: ${err.message}`;
        }
        record.modelInfo = result.modelInfo;
      } catch (err) {
        record.error = err && err.message ? err.message : String(err);
      }
      record.latency_ms = Date.now() - startedAt;
      return record;
    }

    try {
      realRecords = await mapWithConcurrency(realSample, 2, processOneReal);
      for (const r of realRecords) {
        const status = r.error ? `ERROR: ${r.error}` : `OK`;
        log(
          `  ${r.id} [${r.format}] parts=${r.paragraph_count} spans=${r.span_count} density=${(r.density * 100).toFixed(1)}% latency=${r.latency_ms}ms oob=${r.oob_count} ${status}`
        );
        if (r.modelInfo) {
          log(`    modelInfo: provider=${r.modelInfo.provider} model=${r.modelInfo.model} reqCount=${r.modelInfo.requestCount} latencyMs=${r.modelInfo.latencyMs}`);
        }
      }
    } catch (err) {
      log(`  Phase 4 fatal: ${err.message || String(err)}`);
    }
  } else {
    log(`  Skipped (no MINIMAX_TOKEN_PLAN_KEY / MINIMAX_API_KEY in env).`);
  }

  // === Save artifacts ===
  fs.writeFileSync(
    RESULTS_PATH,
    JSON.stringify(
      {
        summary: SUMMARY,
        records,
        realLlmRecords: realRecords,
        aggregates: {
          total: records.length,
          successes: successes.length,
          errors: errors.length,
          latency: {
            p50: percentile(latencies, 50),
            p95: percentile(latencies, 95),
            max: Math.max(...latencies),
            mean: Math.round(mean(latencies))
          },
          byLangFormat: Object.fromEntries(
            Object.entries(langFormatGroups).map(([k, g]) => [
              k,
              {
                n: g.length,
                errors: g.filter((r) => r.error).length,
                meanDensity: mean(g.map((r) => r.density)),
                p50Latency: percentile(g.map((r) => r.latency_ms), 50),
                p95Latency: percentile(g.map((r) => r.latency_ms), 95)
              }
            ])
          )
        }
      },
      null,
      2
    )
  );

  fs.writeFileSync(LOG_PATH, logLines.join("\n") + "\n");
  const wallSec = ((Date.now() - t0) / 1000).toFixed(1);
  log(``);
  log(`===== Done. Wall time: ${wallSec}s =====`);
  log(`Log: ${LOG_PATH}`);
  log(`Results JSON: ${RESULTS_PATH}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  logLines.push(`FATAL: ${err.stack || err.message || String(err)}`);
  fs.writeFileSync(LOG_PATH, logLines.join("\n") + "\n");
  process.exit(1);
});
