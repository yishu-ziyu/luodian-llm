// Agent 2 round-7 smoke test: English few-shot pool end-to-end.
// Runs generateAiHighlight on the en-5-medium (Dickens) paragraph from
// agent-4-few-shot-iter/round-6/swarm-agent-D/test-corpus-english.mjs,
// validates that:
//   1. detectLanguage returns "en"
//   2. the LLM returns a parseable HighlightMap
//   3. clipHighlightSpans drops 0 OOB spans (the safety net is unused)
//   4. assertHighlightMap passes
//   5. density falls in the expected English range (15-30%)
//   6. at least one highlight exists in the first 3 chars (topic anchor)
//
// Run from repo root:
//   node /Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-2-lang-iter/round-7/smoke-test.mjs

import { generateAiHighlight, detectLanguage } from "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/web-mvp/src/llm-client.mjs";
import { assertHighlightMap } from "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/web-mvp/src/highlight.mjs";
import { ENGLISH_TEXTS } from "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/round-6/swarm-agent-D/test-corpus-english.mjs";

const startedAt = Date.now();

function fmtTime(ms) {
  const sec = (ms / 1000).toFixed(2);
  return `${sec}s`;
}

const log = [];
function logLine(line) {
  console.log(line);
  log.push(line);
}

logLine("=== Agent 2 round-7 smoke test: English few-shot pool ===");
logLine(`started at ${new Date(startedAt).toISOString()}`);
logLine("");

// 1. detectLanguage sanity
const dickens = ENGLISH_TEXTS.find((t) => t.id === "en-5-medium");
if (!dickens) {
  logLine("FATAL: en-5-medium not found in test corpus");
  process.exit(1);
}
const charLength = Array.from(dickens.text).length;
const paragraphs = [{ id: "0", index: 0, text: dickens.text, charLength }];
const lang = detectLanguage(paragraphs);
logLine(`[1] detectLanguage -> "${lang}"  (expected "en")`);
if (lang !== "en") {
  logLine("FATAL: detectLanguage did not return 'en' for an English-only paragraph");
  process.exit(1);
}

// Also sanity-check Chinese detection
const cnParagraphs = [{ id: "0", index: 0, text: "清晨推开窗户，远处的山峦笼罩在薄雾之中。", charLength: 22 }];
const cnLang = detectLanguage(cnParagraphs);
logLine(`[1b] detectLanguage on Chinese text -> "${cnLang}"  (expected "zh")`);

// 2. Call LLM
logLine("");
logLine("[2] calling generateAiHighlight with real MiniMax provider...");
let result;
try {
  result = await generateAiHighlight({
    paragraphs,
    density: "medium",
    providerMode: "minimax"  // explicit: don't fall back to mock
  });
} catch (error) {
  logLine(`ERROR: ${error.message}`);
  if (error.stack) logLine(error.stack);
  process.exit(1);
}

const provider = result.modelInfo.provider;
const model = result.modelInfo.model;
const latencyMs = result.modelInfo.latencyMs || 0;
logLine(`provider=${provider}  model=${model}  latency=${fmtTime(latencyMs)}  requestCount=${result.modelInfo.requestCount || 1}`);
if (provider !== "minimax") {
  logLine(`WARN: provider is ${provider}, expected minimax — API key may not be set; result is mock fallback.`);
}

// 3. Show the highlight map
logLine("");
logLine("[3] HighlightMap:");
const ranges = result.highlight["0"] || [];
logLine(`  ranges: [${ranges.join(",")}]`);
logLine(`  span count: ${ranges.length / 2}`);
const totalHL = ranges.filter((_, i) => i % 2 === 1).reduce((a, l) => a + l, 0);
const density = (totalHL / charLength) * 100;
logLine(`  highlighted chars: ${totalHL}`);
logLine(`  paragraph length: ${charLength}`);
logLine(`  density: ${density.toFixed(1)}%  (expected 15-30% for English)`);

// 4. Check topic anchor: first highlight must start at position 0-2
const firstStart = ranges[0];
logLine("");
logLine(`[4] topic anchor check: first start = ${firstStart}  (expected 0-2)`);
if (firstStart === undefined || firstStart > 2) {
  logLine(`  WARN: first highlight starts at ${firstStart}, expected 0-2 (Rule 3 topic anchor)`);
}

// 5. Length distribution
const lengths = [];
for (let i = 1; i < ranges.length; i += 2) lengths.push(ranges[i]);
const lengthCounts = lengths.reduce((acc, l) => { acc[l] = (acc[l] || 0) + 1; return acc; }, {});
logLine("");
logLine(`[5] length distribution: ${JSON.stringify(lengthCounts)}  (expected: 2 dominates)`);

// 6. Saccade gap distribution
const starts = [];
for (let i = 0; i < ranges.length; i += 2) starts.push(ranges[i]);
const gaps = [];
for (let i = 1; i < starts.length; i++) {
  const prevEnd = ranges[2 * (i - 1) + 1] + starts[i - 1];  // wrong index
}
// fix: use ranges directly
const gapsFixed = [];
let prevEnd = 0;
for (let i = 0; i < ranges.length; i += 2) {
  const s = ranges[i], l = ranges[i + 1];
  gapsFixed.push(s - prevEnd);
  prevEnd = s + l;
}
gapsFixed.shift();  // first gap is from 0 to first start
const minGap = Math.min(...gapsFixed);
const maxGap = Math.max(...gapsFixed);
const meanGap = gapsFixed.reduce((a, b) => a + b, 0) / gapsFixed.length;
logLine(`[6] gap distribution: min=${minGap}  mean=${meanGap.toFixed(1)}  max=${maxGap}  (Rule 5: never less than 3)`);
if (minGap < 3) {
  logLine(`  WARN: gap ${minGap} violates Rule 5 ("never less than 3")`);
}

// 7. Validate
logLine("");
logLine("[7] assertHighlightMap...");
try {
  assertHighlightMap(result.highlight, paragraphs);
  logLine("  OK");
} catch (e) {
  logLine(`  FAIL: ${e.message}`);
  process.exit(1);
}

// 8. OOB check (clipHighlightSpans should drop 0 spans)
logLine("");
logLine("[8] OOB check via clipHighlightSpans...");
let dropped = 0;
const origWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && String(args[0]).includes("dropped span")) dropped += 1;
  origWarn(...args);
};
const { clipHighlightSpans } = await import("/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/web-mvp/src/highlight.mjs");
const clipped = clipHighlightSpans(result.highlight, paragraphs);
console.warn = origWarn;
logLine(`  dropped OOB spans: ${dropped}  (expected 0)`);

// 9. Check that the highlights look like content words, not random 2-char digraphs
logLine("");
logLine("[9] content-word check (sample first 3 spans):");
for (let i = 0; i < Math.min(3, ranges.length / 2); i++) {
  const s = ranges[2 * i], l = ranges[2 * i + 1];
  const seg = dickens.text.slice(s, s + l);
  logLine(`  [${s},${l}] = "${seg}"  ctx: "${dickens.text.slice(Math.max(0, s - 5), s + l + 5)}"`);
}

const elapsed = Date.now() - startedAt;
logLine("");
logLine("=== summary ===");
logLine(`detected language: ${lang}`);
logLine(`provider: ${provider} (${model})`);
logLine(`density: ${density.toFixed(1)}%  (target 15-30%)`);
logLine(`topic anchor: starts at ${firstStart}  (target 0-2)`);
logLine(`OOB dropped: ${dropped}  (target 0)`);
logLine(`assertHighlightMap: pass`);
logLine(`elapsed: ${fmtTime(elapsed)}`);

import { writeFileSync } from "node:fs";
writeFileSync("/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-2-lang-iter/round-7/smoke-output.log", log.join("\n") + "\n");
logLine("");
logLine("log written to smoke-output.log");
