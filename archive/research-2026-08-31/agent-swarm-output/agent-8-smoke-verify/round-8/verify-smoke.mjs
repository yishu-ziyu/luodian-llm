// Agent 8 round-8 verify-smoke.mjs — Phase 1: real MiniMax on 15 texts.
//
// Goals (per task brief):
//   A. Real MiniMax runs 15 texts (5 ZH short + 5 EN short + 5 multi-paragraph).
//      -> 0 "did not include text content" errors (vs round-7 V3 抽样 2/5).
//   B. Every EN segment's first highlight lands on the first content word
//      (not on a function word like it/was/the/a/an/of/in).
//   C. Every ZH segment's first highlight lands on the first 实词 (content word);
//      the literal position 0-2 is not required.
//   D. Austen en-3 / similar function-word-led paragraphs in the corpus do
//      NOT show "is/was" landing as the first anchor.
//
// Read-only: NEVER writes to web-mvp/src/*. Writes logs + results JSON
// under agent-8-smoke-verify/round-8/.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { TEST_CORPUS, SUMMARY } from "./test-corpus.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..", "..");
const WEB_MVP_SRC = path.join(ROOT, "web-mvp", "src");

const CONCURRENCY = 3;
const LOG_PATH = path.join(__dirname, "smoke-output.log");
const RESULTS_PATH = path.join(__dirname, "smoke-results.json");

// ---- Load web-mvp modules (read-only) ----
const articleMod = await import(pathToFileURL(path.join(WEB_MVP_SRC, "article.mjs")).href);
const highlightMod = await import(pathToFileURL(path.join(WEB_MVP_SRC, "highlight.mjs")).href);
const llmClientMod = await import(pathToFileURL(path.join(WEB_MVP_SRC, "llm-client.mjs")).href);

const { splitIntoParagraphs } = articleMod;
const { assertHighlightMap, clipHighlightSpans } = highlightMod;
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

// ---- Function word sets (Rule 3 anchor candidates) ----
const EN_FUNCTION_WORDS = new Set([
  "a", "an", "the", "it", "its", "is", "was", "are", "were", "be", "been", "being",
  "of", "in", "on", "at", "to", "for", "with", "by", "from", "as", "into", "about",
  "and", "or", "but", "if", "than", "that", "this", "these", "those", "so", "such",
  "i", "you", "he", "she", "we", "they", "me", "him", "her", "us", "them",
  "my", "your", "his", "their", "our",
  "do", "does", "did", "has", "have", "had", "will", "would", "can", "could", "should",
  "not", "no", "nor"
]);

const ZH_FUNCTION_WORDS = new Set([
  "的", "了", "是", "在", "和", "也", "都", "我", "你", "他", "她", "它", "们",
  "把", "被", "从", "到", "对", "而", "或", "及", "以", "于", "与", "之",
  "这", "那", "这个", "那个", "这些", "那些",
  "就", "才", "又", "还", "已", "已经", "可能", "可以", "会", "要",
  "没", "没有", "不", "很", "非常", "比较", "更", "最"
]);

// Tokenize a UTF-16-indexed range start into a word context.
function getFirstWord(text, start) {
  // Latin script: walk whitespace boundaries.
  // CJK: there is no whitespace, so the "word" is typically 1-2 characters;
  // we just take the single CJK character at `start`.
  const ch = text[start] || "";
  if (/[一-鿿]/.test(ch)) {
    return ch;
  }
  // Latin / punctuation: walk whitespace boundaries.
  let s = start;
  let e = start;
  while (s > 0 && /\S/.test(text[s - 1])) s -= 1;
  while (e < text.length && /\S/.test(text[e])) e += 1;
  return text.slice(s, e);
}

function isContentWordEN(word) {
  const w = String(word || "").toLowerCase().replace(/[^a-z']/g, "");
  if (!w) return null; // non-Latin or punctuation
  return !EN_FUNCTION_WORDS.has(w);
}

function isContentWordZH(word) {
  if (!word) return null;
  // For Chinese: take the first character (since each character is a morpheme)
  const ch = word[0];
  if (!ch) return null;
  // Punctuation / ascii → not relevant
  if (/[a-zA-Z0-9]/.test(ch)) return null;
  return !ZH_FUNCTION_WORDS.has(ch);
}

// Build paragraph objects (matches createArticleDocument shape).
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
    lang: article.lang,
    source: article.source,
    category: article.category,
    format: article.format,
    text_chars: Array.from(article.text).length,
    paragraph_count: 0,
    first_anchor_text: null,
    first_anchor_is_content_word: null,
    density: 0,
    span_count: 0,
    oob_count: 0,
    request_count: 0,
    model: null,
    latency_ms: 0,
    error: null,
    error_msg: null,
    per_paragraph: []
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

  let result;
  try {
    result = await generateAiHighlight({
      paragraphs,
      density: "medium",
      providerMode: "minimax"
    });
  } catch (error) {
    record.error = "LLM_ERROR";
    record.error_msg = String(error?.message || error);
    record.latency_ms = Date.now() - startedAt;
    return record;
  }

  record.model = result.modelInfo?.model || null;
  record.request_count = result.modelInfo?.requestCount || 0;
  record.latency_ms = result.modelInfo?.latencyMs || (Date.now() - startedAt);

  const highlight = result.highlight || {};
  let totalHL = 0;
  let totalChars = 0;
  let totalSpans = 0;
  let firstAnchorCaptured = false;

  for (const para of paragraphs) {
    const ranges = highlight[para.id] || [];
    const starts = [];
    const lengths = [];
    for (let i = 0; i < ranges.length; i += 2) {
      starts.push(ranges[i]);
      lengths.push(ranges[i + 1]);
    }
    const hlChars = lengths.reduce((a, l) => a + l, 0);
    totalHL += hlChars;
    totalChars += para.charLength;
    totalSpans += starts.length;
    const paraRecord = {
      pid: para.id,
      char_length: para.charLength,
      span_count: starts.length,
      hl_chars: hlChars
    };
    if (starts.length > 0) {
      const firstStart = starts[0];
      const firstSeg = para.text.slice(firstStart, firstStart + 2);
      const firstWord = getFirstWord(para.text, firstStart);
      const isContent = article.lang === "en" ? isContentWordEN(firstWord) : isContentWordZH(firstWord);
      paraRecord.first_start = firstStart;
      paraRecord.first_seg = firstSeg;
      paraRecord.first_word = firstWord;
      paraRecord.first_is_content = isContent;
      if (!firstAnchorCaptured) {
        record.first_anchor_text = firstSeg;
        record.first_anchor_word = firstWord;
        record.first_anchor_is_content_word = isContent;
        firstAnchorCaptured = true;
      }
    } else {
      paraRecord.first_start = null;
      paraRecord.first_seg = null;
      paraRecord.first_word = null;
      paraRecord.first_is_content = null;
    }
    record.per_paragraph.push(paraRecord);
  }

  record.span_count = totalSpans;
  record.density = totalChars > 0 ? (totalHL / totalChars) * 100 : 0;

  // Re-run clipHighlightSpans to count OOB drops (defensive).
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
  record.oob_count = dropped;

  return record;
}

const startedAt = Date.now();
log("=== Agent 8 round-8 Phase 1: real MiniMax smoke (15 texts) ===");
log(`started at ${new Date(startedAt).toISOString()}`);
log(`SUMMARY: ${JSON.stringify(SUMMARY)}`);
log("");
log("--- per-article pass ---");

// Concurrency 3 per task brief.
const results = await mapWithConcurrency(TEST_CORPUS, CONCURRENCY, async (article) => {
  log(`[start] ${article.id} (${article.lang}, ${article.format}, ${Array.from(article.text).length} chars)`);
  const r = await processOne(article);
  if (r.error) {
    log(`  [ERROR] ${r.error}: ${r.error_msg}`);
  } else {
    log(`  model=${r.model}  paragraphs=${r.paragraph_count}  spans=${r.span_count}  density=${r.density.toFixed(1)}%  first_anchor="${r.first_anchor_text}" word="${r.first_anchor_word}" content=${r.first_anchor_is_content_word}  oob=${r.oob_count}  latency=${r.latency_ms}ms  req=${r.request_count}`);
  }
  return r;
});

// ---- Aggregate ----
const total = results.length;
const empty = results.filter((r) => r.error === "LLM_ERROR" && /did not include text content|contained only thinking blocks/.test(r.error_msg || ""));
const otherErrors = results.filter((r) => r.error && !empty.includes(r));
const success = results.filter((r) => !r.error);
const enResults = success.filter((r) => r.lang === "en");
const zhResults = success.filter((r) => r.lang === "zh");
const enContentAnchors = enResults.filter((r) => r.first_anchor_is_content_word === true);
const enNonContentAnchors = enResults.filter((r) => r.first_anchor_is_content_word === false);
const enUnknown = enResults.filter((r) => r.first_anchor_is_content_word === null);
const zhContentAnchors = zhResults.filter((r) => r.first_anchor_is_content_word === true);
const zhNonContentAnchors = zhResults.filter((r) => r.first_anchor_is_content_word === false);
const zhUnknown = zhResults.filter((r) => r.first_anchor_is_content_word === null);

const latencies = success.map((r) => r.latency_ms);
const oobTotal = success.reduce((a, r) => a + r.oob_count, 0);
const densities = success.map((r) => r.density);

log("");
log("=== aggregate ===");
log(`total texts:        ${total}`);
log(`success:            ${success.length} / ${total}`);
log(`empty-response:     ${empty.length} / ${total}  (target 0 — round-7 V3 抽样 2/5)`);
log(`other errors:       ${otherErrors.length} / ${total}`);
log("");
log(`EN first-anchor:    content=${enContentAnchors.length}  function=${enNonContentAnchors.length}  unknown=${enUnknown.length}  / ${enResults.length}`);
log(`ZH first-anchor:    content=${zhContentAnchors.length}  function=${zhNonContentAnchors.length}  unknown=${zhUnknown.length}  / ${zhResults.length}`);
log("");
log(`density mean:       ${mean(densities).toFixed(1)}%`);
log(`density p50/p95:    ${percentile(densities, 50)?.toFixed(1)}% / ${percentile(densities, 95)?.toFixed(1)}%`);
log(`latency p50/p95:    ${percentile(latencies, 50)}ms / ${percentile(latencies, 95)}ms`);
log(`OOB clip drops:     ${oobTotal}  (target 0)`);

log("");
log("--- EN first-anchor details ---");
for (const r of enResults) {
  const tag = r.first_anchor_is_content_word === true ? "OK" : r.first_anchor_is_content_word === false ? "WARN" : "N/A";
  log(`  [${tag}] ${r.id}: first_seg="${r.first_anchor_text}" word="${r.first_anchor_word}" start=${r.per_paragraph[0]?.first_start}`);
}
log("--- ZH first-anchor details ---");
for (const r of zhResults) {
  const tag = r.first_anchor_is_content_word === true ? "OK" : r.first_anchor_is_content_word === false ? "WARN" : "N/A";
  log(`  [${tag}] ${r.id}: first_seg="${r.first_anchor_text}" word="${r.first_anchor_word}" start=${r.per_paragraph[0]?.first_start}`);
}

if (empty.length > 0) {
  log("");
  log("--- empty-response cases (FAIL) ---");
  for (const r of empty) {
    log(`  [FAIL] ${r.id}: ${r.error_msg}`);
  }
}
if (otherErrors.length > 0) {
  log("");
  log("--- other error cases ---");
  for (const r of otherErrors) {
    log(`  ${r.id}: ${r.error} - ${r.error_msg}`);
  }
}
if (enNonContentAnchors.length > 0) {
  log("");
  log("--- EN first-anchor landed on function word (WARN) ---");
  for (const r of enNonContentAnchors) {
    log(`  [WARN] ${r.id}: first word "${r.first_anchor_word}" is a function word`);
  }
}
if (zhNonContentAnchors.length > 0) {
  log("");
  log("--- ZH first-anchor landed on function word (WARN) ---");
  for (const r of zhNonContentAnchors) {
    log(`  [WARN] ${r.id}: first word "${r.first_anchor_word}" starts with a function character`);
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
      summary: SUMMARY,
      aggregate: {
        total,
        success: success.length,
        empty: empty.length,
        otherErrors: otherErrors.length,
        enContentAnchors: enContentAnchors.length,
        enNonContentAnchors: enNonContentAnchors.length,
        enUnknown: enUnknown.length,
        zhContentAnchors: zhContentAnchors.length,
        zhNonContentAnchors: zhNonContentAnchors.length,
        zhUnknown: zhUnknown.length,
        densityMean: mean(densities),
        densityP50: percentile(densities, 50),
        densityP95: percentile(densities, 95),
        latencyP50: percentile(latencies, 50),
        latencyP95: percentile(latencies, 95),
        oobTotal
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
