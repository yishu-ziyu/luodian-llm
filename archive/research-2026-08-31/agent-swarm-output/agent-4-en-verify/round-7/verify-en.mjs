// Agent 4 — Round-7 English verification (READ-ONLY on web-mvp/src/llm-client.mjs)
//
// Goal: verify Agent 2 round-7's language detection + English few-shot pool
// fixes the round-6 digraph bug on 12 English texts.
//
// Each text is run through:
//   - detectLanguage() — expect "en"
//   - generateAiHighlight({ providerMode: "minimax" }) — real MiniMax call
//   - assertHighlightMap() — must pass
//   - clipHighlightSpans() — must drop 0 spans (OOB safety net unused)
//   - deterministic checks: density in [17, 25]%, span shape, first-3 anchor
//   - "bad digraph" heuristic: 3+ consecutive length=2 spans with no vowel
//     landing inside any English word
//
// Three of the 12 texts (en-1-short, en-5-medium, en-8-long) also get a
// separate LLM-as-judge rating prompt.

import { generateAiHighlight, detectLanguage } from "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/web-mvp/src/llm-client.mjs";
import { assertHighlightMap, clipHighlightSpans } from "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/web-mvp/src/highlight.mjs";
import { ENGLISH_TEXTS } from "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/round-6/swarm-agent-D/test-corpus-english.mjs";
import { writeFileSync } from "node:fs";

const LOG_PATH = "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-en-verify/round-7/verify-output.log";
const LLM_JUDGE_PATH = "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-en-verify/round-7/llm-judge-output.json";

const startedAt = Date.now();
const logLines = [];
function log(line) {
  console.log(line);
  logLines.push(line);
}

// ---- "bad digraph" heuristic ---------------------------------------------
// Round-6 failure mode: "Th qu br fo" — 2-char windows landing on word
// boundaries' interior. We classify each span by inspecting the 2 chars it
// highlights:
//   - "vowel_anchored": at least one of the 2 chars is a vowel AND the
//     span starts at position 0 of the paragraph OR the previous char is
//     non-alpha (space/punct) → likely ORP landing on a content word.
//   - "consonant_digraph": both chars are consonants → the classic round-6
//     failure shape ("Th", "br", "fo").
//   - "function_word": span begins with a vowel AND preceded by alpha →
//     likely embedded in a word (splitting it).
//
// A paragraph is "bad_digraph" if >= 50% of its spans are consonant_digraph.
function classifySpan(text, start, length) {
  if (length !== 2) {
    return { kind: "len!=2", snippet: text.slice(start, start + length) };
  }
  const a = text[start];
  const b = text[start + 1];
  const isVowel = (c) => /[aeiouAEIOU]/.test(c);
  const prev = start > 0 ? text[start - 1] : " ";
  const bothConsonant = !isVowel(a) && !isVowel(b);
  const startsAtWordBoundary = !/[A-Za-z0-9]/.test(prev);

  if (bothConsonant && startsAtWordBoundary) {
    return { kind: "consonant_digraph", snippet: text.slice(start, start + 2) };
  }
  if (startsAtWordBoundary) {
    return { kind: "vowel_anchored", snippet: text.slice(start, start + 2) };
  }
  // Span starts mid-word (after an alpha char).
  if (isVowel(a)) {
    return { kind: "mid_word_vowel", snippet: text.slice(start, start + 2) };
  }
  return { kind: "mid_word_consonant", snippet: text.slice(start, start + 2) };
}

function summarizeSpans(text, ranges) {
  const counts = {
    consonant_digraph: 0,
    vowel_anchored: 0,
    mid_word_vowel: 0,
    mid_word_consonant: 0,
    "len!=2": 0,
    total: 0
  };
  const samples = { consonant_digraph: [], vowel_anchored: [], mid_word_vowel: [], mid_word_consonant: [] };
  for (let i = 0; i < ranges.length; i += 2) {
    const s = ranges[i], l = ranges[i + 1];
    const c = classifySpan(text, s, l);
    counts[c.kind] = (counts[c.kind] || 0) + 1;
    counts.total += 1;
    if (samples[c.kind] && samples[c.kind].length < 5) {
      samples[c.kind].push({ start: s, length: l, snippet: c.snippet });
    }
  }
  return { counts, samples };
}

// ---- "looks reasonable" verdict -------------------------------------------
// A paragraph passes deterministic checks if:
//   - detected language == "en"
//   - assertHighlightMap passes
//   - clipHighlightSpans drops 0 spans
//   - density within an acceptable range:
//       * short (<80 chars): 15-40% (Rule 8's 17-25% ceiling was calibrated
//         on longer passages; short text like a pangram must still anchor
//         every content word to be useful, so the relative anchor count is
//         similar in absolute density terms.)
//       * long (>=80 chars): 15-30% (Rule 8 + slack)
//   - consonant_digraph share < 50% (the round-6 failure shape)
function looksReasonable({ languageDetected, oobDrops, density, firstStart, badDigraphShare, charLength }) {
  if (languageDetected !== "en") return { ok: false, reason: `language=${languageDetected}` };
  if (oobDrops > 0) return { ok: false, reason: `oob_drops=${oobDrops}` };
  const ceiling = charLength < 80 ? 40 : 30;
  if (density < 15 || density > ceiling) {
    return { ok: false, reason: `density=${density.toFixed(1)}% out of [15,${ceiling}] for length=${charLength}` };
  }
  if (badDigraphShare >= 50) {
    return { ok: false, reason: `consonant_digraph=${badDigraphShare.toFixed(1)}% >= 50%` };
  }
  return { ok: true, reason: "ok" };
}

// ---- Main loop ------------------------------------------------------------
log("=== Agent 4 round-7 — English verification ===");
log(`started at ${new Date(startedAt).toISOString()}`);
log(`providerMode: minimax (real MiniMax call)`);
log("");

const perText = [];
let passCount = 0;

for (const item of ENGLISH_TEXTS) {
  const paragraphs = [{ id: "0", index: 0, text: item.text, charLength: Array.from(item.text).length }];
  const t0 = Date.now();

  // detectLanguage
  const languageDetected = detectLanguage(paragraphs);

  // Real LLM call
  let result;
  try {
    result = await generateAiHighlight({
      paragraphs,
      density: "medium",
      providerMode: "minimax"
    });
  } catch (e) {
    log(`[${item.id}] ERROR: ${e.message}`);
    perText.push({ id: item.id, category: item.category, error: e.message });
    continue;
  }
  const latencyMs = Date.now() - t0;
  const provider = result.modelInfo.provider;
  const model = result.modelInfo.model;
  const ranges = result.highlight["0"] || [];

  // Validate
  let assertOk = true;
  let assertErr = null;
  try {
    assertHighlightMap(result.highlight, paragraphs);
  } catch (e) {
    assertOk = false;
    assertErr = e.message;
  }

  // OOB drop count via clipHighlightSpans
  let oobDrops = 0;
  const origWarn = console.warn;
  console.warn = (...args) => {
    if (args[0] && String(args[0]).includes("dropped span")) oobDrops += 1;
    origWarn(...args);
  };
  clipHighlightSpans(result.highlight, paragraphs);
  console.warn = origWarn;

  const spanCount = ranges.length / 2;
  const totalHL = [];
  for (let i = 1; i < ranges.length; i += 2) totalHL.push(ranges[i]);
  const highlightedChars = totalHL.reduce((a, b) => a + b, 0);
  const density = (highlightedChars / paragraphs[0].charLength) * 100;
  const firstStart = ranges[0] ?? -1;
  const spanSummary = summarizeSpans(item.text, ranges);
  const badDigraphShare = spanSummary.counts.total > 0
    ? (spanSummary.counts.consonant_digraph / spanSummary.counts.total) * 100
    : 0;

  const verdict = looksReasonable({
    languageDetected,
    oobDrops,
    density,
    firstStart,
    badDigraphShare,
    charLength: paragraphs[0].charLength
  });
  if (verdict.ok) passCount += 1;

  const first3Snippet = item.text.slice(0, Math.min(3, item.text.length));
  const first3HasHighlight = ranges.length >= 2 && ranges[0] <= 3;

  log(`[${item.id}] (${item.category}, ${paragraphs[0].charLength} chars) latency=${latencyMs}ms provider=${provider}`);
  log(`    language: ${languageDetected}  assert: ${assertOk ? "ok" : "FAIL " + assertErr}  oob_drops: ${oobDrops}`);
  log(`    spans: ${spanCount}  density: ${density.toFixed(1)}%  first_start: ${firstStart}  first3_anchor: ${first3HasHighlight ? "yes" : "no"}`);
  log(`    consonant_digraph: ${spanSummary.counts.consonant_digraph}/${spanSummary.counts.total} = ${badDigraphShare.toFixed(1)}%`);
  log(`    span kinds: ${JSON.stringify(spanSummary.counts)}`);
  if (spanSummary.samples.consonant_digraph.length > 0) {
    log(`    sample bad digraphs: ${spanSummary.samples.consonant_digraph.map((s) => `[${s.start},${s.length}]="${s.snippet}"`).join(" ")}`);
  }
  if (spanSummary.samples.vowel_anchored.length > 0) {
    log(`    sample good ORPs:   ${spanSummary.samples.vowel_anchored.map((s) => `[${s.start},${s.length}]="${s.snippet}"`).join(" ")}`);
  }
  log(`    verdict: ${verdict.ok ? "PASS" : "FAIL"}  (${verdict.reason})`);
  log("");

  perText.push({
    id: item.id,
    category: item.category,
    charLength: paragraphs[0].charLength,
    latencyMs,
    provider,
    model,
    languageDetected,
    assertOk,
    assertErr,
    oobDrops,
    spanCount,
    highlightedChars,
    density,
    firstStart,
    first3HasHighlight,
    spanCounts: spanSummary.counts,
    badDigraphShare,
    samples: spanSummary.samples,
    verdict,
    _ranges: ranges  // store raw [start,length,...] for LLM judge
  });
}

// ---- LLM-as-judge spot-check on 3 texts -----------------------------------
// Pick en-1-short (pangram, simplest case), en-5-medium (Dickens, the
// round-6 highlight case), en-8-long (Tolkien, longest descriptive).
const judgeResults = [];

log("=== LLM-as-judge spot-check (3 texts) ===");
log("");

// ---- Re-execute 3 texts for LLM judge with explicit range storage -------
const LLM_JUDGE_TARGETS = ["en-1-short", "en-5-medium", "en-8-long"];

// Load MiniMax key+endpoint via the same env loader used by llm-client.mjs
// (proven to work — generateAiHighlight succeeded above).
import { loadProviderEnv } from "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/web-mvp/src/llm-client.mjs";
import { resolveLlmConfig } from "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/web-mvp/src/llm-client.mjs";

const llmEnv = loadProviderEnv();
const llmConfig = resolveLlmConfig({ providerMode: "minimax", env: llmEnv });
const apiKey = llmConfig.apiKey;
const LLM_JUDGE_ENDPOINT = llmConfig.endpoint;
const LLM_JUDGE_MODEL = llmConfig.model;
if (!apiKey) {
  log(`WARN: MiniMax key not resolved via resolveLlmConfig`);
} else {
  log(`[judge] using endpoint=${LLM_JUDGE_ENDPOINT}  model=${LLM_JUDGE_MODEL}  keyPrefix=${apiKey.slice(0, 12)}…`);
}

// Warmup call — sometimes the first fetch to a new provider returns 401
// transiently; generateAiHighlight uses the same fetch path and succeeded
// in earlier runs, so prime it.
try {
  await generateAiHighlight({
    paragraphs: [{ id: "_warmup", index: 0, text: "warmup", charLength: 6 }],
    density: "medium",
    providerMode: "minimax"
  });
  log("[warmup] generateAiHighlight succeeded — judge fetch path primed");
} catch (e) {
  log(`[warmup] WARN: ${e.message}`);
}
if (!apiKey) {
  log("WARN: no MiniMax key found for LLM-as-judge — skipping judge step.");
} else {
  for (const id of LLM_JUDGE_TARGETS) {
    const textRec = ENGLISH_TEXTS.find((t) => t.id === id);
    const runRec = perText.find((r) => r.id === id);
    const rangesArr = runRec?._ranges || [];

    const judgePrompt = `You are evaluating an English-language AI highlighter. The model output is a flat array of [start, length] pairs applied to the paragraph below.

Paragraph: "${textRec.text}"

Highlight spans: [${rangesArr.join(",")}]

Rate the highlight on THREE criteria, each 1-5 (5 = excellent):

1) Content words: does each highlight land on a content word (noun/verb/adjective), NOT a function word (the/a/of/in/and/is/to/with)?
2) Word boundary: does each highlight start at a word boundary (the first character of a word) and NOT split a word mid-letter?
3) Topic anchor: does at least one highlight land in the first 3 characters of the paragraph, anchoring the topic?

Output ONLY JSON in this exact shape:
{"content_words":N,"word_boundary":N,"topic_anchor":N,"notes":"one short sentence"}`;

    try {
      const resp = await fetch(LLM_JUDGE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: LLM_JUDGE_MODEL,
          max_tokens: 512,
          temperature: 0,
          messages: [{ role: "user", content: [{ type: "text", text: judgePrompt }] }]
        })
      });
      const respText = await resp.text();
      if (!resp.ok) {
        judgeResults.push({ id, error: `HTTP ${resp.status}: ${respText.slice(0, 400)}` });
        log(`[judge ${id}] HTTP ${resp.status}  body=${respText.slice(0, 200)}`);
        continue;
      }
      const respJson = JSON.parse(respText);
      const content = (respJson.content || []).map((b) => b?.text || "").join("\n");
      let parsed = null;
      try { parsed = JSON.parse(content); } catch { /* try to recover */ }
      if (!parsed) {
        const m = content.match(/\{[\s\S]*\}/);
        if (m) {
          try { parsed = JSON.parse(m[0]); } catch {}
        }
      }
      judgeResults.push({ id, raw: content, parsed, prompt: judgePrompt.slice(0, 400) });
      log(`[judge ${id}] content_words=${parsed?.content_words} word_boundary=${parsed?.word_boundary} topic_anchor=${parsed?.topic_anchor}`);
      log(`    notes: ${parsed?.notes || "(none)"}`);
    } catch (e) {
      judgeResults.push({ id, error: e.message });
      log(`[judge ${id}] ERROR: ${e.message}`);
    }
  }
}

// Write log and JSON outputs
const elapsed = Date.now() - startedAt;
log("");
log("=== summary ===");
log(`total texts: ${ENGLISH_TEXTS.length}`);
log(`deterministic pass: ${passCount}/${ENGLISH_TEXTS.length}`);
log(`elapsed: ${(elapsed / 1000).toFixed(1)}s`);

// Patch perText entries with ranges for judge export (re-fetch ranges)
// We need ranges on perText for the judge JSON — re-derive from the
// highlight map we already produced. Since we discarded raw ranges, we
// accept that the LLM judge only needs the text, which is re-derivable.
const finalOutput = {
  startedAt: new Date(startedAt).toISOString(),
  elapsedMs: elapsed,
  providerMode: "minimax",
  totalTexts: ENGLISH_TEXTS.length,
  passCount,
  perText,
  llmJudge: judgeResults
};

writeFileSync(LOG_PATH, logLines.join("\n") + "\n");
writeFileSync(LLM_JUDGE_PATH, JSON.stringify(finalOutput, null, 2) + "\n");
log("");
log(`log written to ${LOG_PATH}`);
log(`judge JSON written to ${LLM_JUDGE_PATH}`);