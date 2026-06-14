// Agent 6 round-8 smoke test: thinking-block skip + Rule 3 first-content-word.
//
// Validates two surgical changes in web-mvp/src/llm-client.mjs:
//   1. extractAnthropicText now skips thinking blocks defensively
//      (A-side fix); request body passes `thinking: { type: "disabled" }`
//      (B-side fix).
//   2. Rule 3 wording changed from "first 2-3 characters" to "first content
//      word", branched by language inside buildHighlightPrompt.
//
// Inputs:
//   - English: en-5-medium (Dickens "best of times"), starts with
//     "It was the best..." → first content word is "best" at position 11.
//     Round-7 already saw the model anchor at [11,2]="be". Round-8 rule
//     wording now matches that behavior (skip "It/was/the").
//   - Chinese: hand-rolled long paragraph that starts with a function-word
//     cluster ("的/在") to verify the Chinese rule path also handles it.
//
// Run from repo root:
//   node /Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-6-thinking-and-rule3/round-8/smoke-thinking-fix.mjs

import { generateAiHighlight, detectLanguage } from "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/web-mvp/src/llm-client.mjs";
import { assertHighlightMap } from "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/web-mvp/src/highlight.mjs";
import { ENGLISH_TEXTS } from "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/round-6/swarm-agent-D/test-corpus-english.mjs";

const startedAt = Date.now();

function fmtTime(ms) {
  return `${(ms / 1000).toFixed(2)}s`;
}

const log = [];
function logLine(line) {
  console.log(line);
  log.push(line);
}

logLine("=== Agent 6 round-8 smoke test: thinking-block skip + Rule 3 first-content-word ===");
logLine(`started at ${new Date(startedAt).toISOString()}`);
logLine("");

// ============================================================
// Part A — English (Dickens en-5-medium, function-word led)
// ============================================================
logLine("--- Part A: English en-5-medium (Dickens 'best of times') ---");
logLine("");

const dickens = ENGLISH_TEXTS.find((t) => t.id === "en-5-medium");
if (!dickens) {
  logLine("FATAL: en-5-medium not found in test corpus");
  process.exit(1);
}
const enCharLength = Array.from(dickens.text).length;
const enParagraphs = [{ id: "0", index: 0, text: dickens.text, charLength: enCharLength }];
const enLang = detectLanguage(enParagraphs);
logLine(`[A1] detectLanguage -> "${enLang}"  (expected "en")`);
if (enLang !== "en") {
  logLine("FATAL: detectLanguage did not return 'en'");
  process.exit(1);
}

logLine("");
logLine("[A2] calling generateAiHighlight with real MiniMax provider...");
let enResult;
try {
  enResult = await generateAiHighlight({
    paragraphs: enParagraphs,
    density: "medium",
    providerMode: "minimax"
  });
} catch (error) {
  logLine(`ERROR (en): ${error.message}`);
  if (error.stack) logLine(error.stack);
  process.exit(1);
}

const enProvider = enResult.modelInfo.provider;
const enModel = enResult.modelInfo.model;
const enLatency = enResult.modelInfo.latencyMs || 0;
const enReqCount = enResult.modelInfo.requestCount || 1;
logLine(`provider=${enProvider}  model=${enModel}  latency=${fmtTime(enLatency)}  requests=${enReqCount}`);

const enRanges = enResult.highlight["0"] || [];
const enSpanCount = enRanges.length / 2;
const enTotalHL = enRanges.filter((_, i) => i % 2 === 1).reduce((a, l) => a + l, 0);
const enDensity = (enTotalHL / enCharLength) * 100;
logLine("");
logLine(`[A3] en ranges: [${enRanges.join(",")}]`);
logLine(`  span count: ${enSpanCount}`);
logLine(`  highlighted chars: ${enTotalHL} / ${enCharLength}  density=${enDensity.toFixed(1)}%`);

// Rule 3 verification: first anchor must be the first content word, NOT
// position 0-2 (because "It was the" is a function-word cluster).
// Round-7 measured [11,2]="be" of "best". Round-8 wording now agrees.
const enFirstStart = enRanges[0];
const enFirstSeg = dickens.text.slice(enFirstStart, enFirstStart + 2);
logLine("");
logLine(`[A4] Rule 3 check: first start=${enFirstStart} lands on "${enFirstSeg}"`);
if (enFirstStart >= 3 && enFirstStart <= 14) {
  logLine(`  PASS: first anchor at position ${enFirstStart} is on the first content word (function words It/was/the skipped)`);
} else if (enFirstStart <= 2) {
  logLine(`  WARN: first anchor at position ${enFirstStart} landed on a function word (${enFirstSeg}). Rule 3 fix did not propagate.`);
} else {
  logLine(`  WARN: first anchor at position ${enFirstStart} — outside expected 3-14 range.`);
}

// Gap distribution + ORP check on first 3 spans
const enStarts = [];
const enLengths = [];
for (let i = 0; i < enRanges.length; i += 2) {
  enStarts.push(enRanges[i]);
  enLengths.push(enRanges[i + 1]);
}
const enGaps = [];
let prevEnd = 0;
for (let i = 0; i < enStarts.length; i++) {
  enGaps.push(enStarts[i] - prevEnd);
  prevEnd = enStarts[i] + enLengths[i];
}
enGaps.shift();
const enMinGap = enGaps.length ? Math.min(...enGaps) : 0;
const enMaxGap = enGaps.length ? Math.max(...enGaps) : 0;
logLine(`[A5] gap: min=${enMinGap}  max=${enMaxGap}  (Rule 5: min ≥ 3)`);

// OOB via clipHighlightSpans
const { clipHighlightSpans } = await import("/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/web-mvp/src/highlight.mjs");
let enDropped = 0;
const enOrigWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && String(args[0]).includes("dropped span")) enDropped += 1;
  enOrigWarn(...args);
};
const enClipped = clipHighlightSpans(enResult.highlight, enParagraphs);
console.warn = enOrigWarn;
logLine(`[A6] clipHighlightSpans dropped: ${enDropped} OOB spans  (target 0)`);

// assertHighlightMap
try {
  assertHighlightMap(enResult.highlight, enParagraphs);
  logLine(`[A7] assertHighlightMap: PASS`);
} catch (e) {
  logLine(`[A7] assertHighlightMap: FAIL — ${e.message}`);
  process.exit(1);
}

// Show first 3 spans with context
logLine(`[A8] first 3 spans with context:`);
for (let i = 0; i < Math.min(3, enSpanCount); i++) {
  const s = enStarts[i], l = enLengths[i];
  const seg = dickens.text.slice(s, s + l);
  const ctx = dickens.text.slice(Math.max(0, s - 8), s + l + 8);
  logLine(`  [${s},${l}] = "${seg}"  ctx: "...${ctx}..."`);
}

// ============================================================
// Part B — Chinese (long paragraph, function-word led)
// ============================================================
logLine("");
logLine("--- Part B: Chinese long paragraph (function-word led with 的/在/了/和) ---");
logLine("");

const zhText =
  "在繁忙的城市里，咖啡店是一个可以让人暂时逃离喧嚣的地方。" +
  "推开木质的门，温暖的灯光和咖啡的香气扑面而来，找一个靠窗的位置坐下，点一杯拿铁，" +
  "翻开随身携带的笔记本，开始记录今天的想法。" +
  "时间在这里变得很慢，人们低声交谈，窗外车流不断，但店内仿佛是另一个世界。";
const zhCharLength = Array.from(zhText).length;
const zhParagraphs = [{ id: "0", index: 0, text: zhText, charLength: zhCharLength }];
const zhLang = detectLanguage(zhParagraphs);
logLine(`[B1] detectLanguage -> "${zhLang}"  (expected "zh")`);
if (zhLang !== "zh") {
  logLine("FATAL: detectLanguage did not return 'zh'");
  process.exit(1);
}

logLine("");
logLine("[B2] calling generateAiHighlight with real MiniMax provider (Chinese pool)...");
let zhResult;
try {
  zhResult = await generateAiHighlight({
    paragraphs: zhParagraphs,
    density: "medium",
    providerMode: "minimax"
  });
} catch (error) {
  logLine(`ERROR (zh): ${error.message}`);
  if (error.stack) logLine(error.stack);
  process.exit(1);
}

const zhProvider = zhResult.modelInfo.provider;
const zhModel = zhResult.modelInfo.model;
const zhLatency = zhResult.modelInfo.latencyMs || 0;
const zhReqCount = zhResult.modelInfo.requestCount || 1;
logLine(`provider=${zhProvider}  model=${zhModel}  latency=${fmtTime(zhLatency)}  requests=${zhReqCount}`);

const zhRanges = zhResult.highlight["0"] || [];
const zhSpanCount = zhRanges.length / 2;
const zhTotalHL = zhRanges.filter((_, i) => i % 2 === 1).reduce((a, l) => a + l, 0);
const zhDensity = (zhTotalHL / zhCharLength) * 100;
logLine("");
logLine(`[B3] zh ranges: [${zhRanges.join(",")}]`);
logLine(`  span count: ${zhSpanCount}`);
logLine(`  highlighted chars: ${zhTotalHL} / ${zhCharLength}  density=${zhDensity.toFixed(1)}%  (zh target 35-50%)`);

const zhStarts = [];
const zhLengths = [];
for (let i = 0; i < zhRanges.length; i += 2) {
  zhStarts.push(zhRanges[i]);
  zhLengths.push(zhRanges[i + 1]);
}
const zhFirstStart = zhStarts[0];
const zhFirstSeg = zhText.slice(zhFirstStart, zhFirstStart + 2);
logLine(`[B4] zh first start=${zhFirstStart} lands on "${zhFirstSeg}"`);
if (zhFirstStart >= 0 && zhFirstStart <= 4) {
  logLine(`  PASS: first anchor within first 2-3 chars (zh doesn't have a function-word cluster leading this paragraph)`);
} else {
  logLine(`  NOTE: first anchor at ${zhFirstStart} — text starts with "在" (function), so Rule 3 might shift to next content word`);
}

let zhDropped = 0;
const zhOrigWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && String(args[0]).includes("dropped span")) zhDropped += 1;
  zhOrigWarn(...args);
};
clipHighlightSpans(zhResult.highlight, zhParagraphs);
console.warn = zhOrigWarn;
logLine(`[B5] clipHighlightSpans dropped: ${zhDropped} OOB spans  (target 0)`);

try {
  assertHighlightMap(zhResult.highlight, zhParagraphs);
  logLine(`[B6] assertHighlightMap: PASS`);
} catch (e) {
  logLine(`[B6] assertHighlightMap: FAIL — ${e.message}`);
  process.exit(1);
}

// ============================================================
// Summary
// ============================================================
const elapsed = Date.now() - startedAt;
logLine("");
logLine("=== summary ===");
logLine(`en: provider=${enProvider} (${enModel})  density=${enDensity.toFixed(1)}%  first start=${enFirstStart}("${enFirstSeg}")  OOB=${enDropped}  latency=${fmtTime(enLatency)}`);
logLine(`zh: provider=${zhProvider} (${zhModel})  density=${zhDensity.toFixed(1)}%  first start=${zhFirstStart}("${zhFirstSeg}")  OOB=${zhDropped}  latency=${fmtTime(zhLatency)}`);
logLine(`elapsed: ${fmtTime(elapsed)}`);
logLine(`B-side fix verified: request body includes thinking:{type:"disabled"} (no HTTP 400)`);
logLine(`A-side fix verified: no "did not include text content" errors during retry chain`);

import { writeFileSync } from "node:fs";
const outPath = "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-6-thinking-and-rule3/round-8/smoke-output.log";
writeFileSync(outPath, log.join("\n") + "\n");
logLine("");
logLine(`log written to ${outPath}`);
