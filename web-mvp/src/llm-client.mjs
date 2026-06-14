import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { assertHighlightMap, generateMockHighlightMap, clipHighlightSpans } from "./highlight.mjs";

const DEFAULT_MINIMAX_BASE_URL = "https://api.minimax.io/anthropic";
const DEFAULT_MINIMAX_MODEL = "MiniMax-M3";
const ANTHROPIC_VERSION = "2023-06-01";
const MINIMAX_MAX_PARAGRAPHS_PER_REQUEST = 4;
const MINIMAX_MAX_CHARS_PER_REQUEST = 1200;
const MINIMAX_MAX_CONCURRENT_REQUESTS = 5;

function defaultEnvFilePaths() {
  return [
    path.join(os.homedir(), ".config/ai-providers/env.local"),
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), "web-mvp", ".env.local")
  ];
}

function parseEnvFile(content) {
  const parsed = {};
  for (const rawLine of String(content).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const normalized = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const match = normalized.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    const value = rawValue.trim().replace(/^['"]|['"]$/g, "");
    parsed[key] = value;
  }
  return parsed;
}

export function loadProviderEnv({ env = process.env, envFilePaths = defaultEnvFilePaths(), readFileSync = fs.readFileSync } = {}) {
  const fileEnv = {};
  for (const envFilePath of envFilePaths) {
    try {
      Object.assign(fileEnv, parseEnvFile(readFileSync(envFilePath, "utf8")));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return { ...fileEnv, ...env };
}

function normalizeAnthropicMessagesEndpoint(rawBaseUrl = DEFAULT_MINIMAX_BASE_URL) {
  const withoutTrailingSlash = String(rawBaseUrl).trim().replace(/\/+$/g, "");
  if (!withoutTrailingSlash) return `${DEFAULT_MINIMAX_BASE_URL}/v1/messages`;
  if (withoutTrailingSlash.endsWith("/v1/messages")) return withoutTrailingSlash;
  if (withoutTrailingSlash.endsWith("/messages")) return withoutTrailingSlash;
  if (withoutTrailingSlash.endsWith("/v1")) return `${withoutTrailingSlash}/messages`;
  return `${withoutTrailingSlash}/v1/messages`;
}

export function resolveLlmConfig({ providerMode = "auto", env = loadProviderEnv() } = {}) {
  const mode = providerMode || env.SACCADE_LLM_PROVIDER || env.WEB_MVP_LLM_PROVIDER || "auto";
  if (mode === "mock") {
    return { provider: "mock", model: "mock-semantic-reading-guide" };
  }

  if (mode !== "auto" && mode !== "minimax") {
    throw new Error(`Unsupported LLM provider mode: ${mode}`);
  }

  const apiKey = env.MINIMAX_TOKEN_PLAN_KEY || env.MINIMAX_API_KEY;
  if (!apiKey) {
    if (mode === "minimax") {
      throw new Error("MiniMax provider is not configured.");
    }
    return { provider: "mock", model: "mock-semantic-reading-guide" };
  }

  return {
    provider: "minimax",
    apiType: "anthropic-compatible",
    apiKey,
    endpoint: normalizeAnthropicMessagesEndpoint(
      env.MINIMAX_ANTHROPIC_BASE_URL || env.MINIMAX_BASE_URL || DEFAULT_MINIMAX_BASE_URL
    ),
    model: env.MINIMAX_MODEL || DEFAULT_MINIMAX_MODEL
  };
}

// Few-shot examples selected to demonstrate the saccade-based highlighting
// pattern. 5 Chinese paragraphs with verified length=2 spans; used as in-context
// demonstrations of ORP landing points, content-word anchors, and the
// 35-50% density target for CJK scripts.
const FEW_SHOT_EXAMPLES_ZH = [
  {
    pid: "0",
    text: "清晨推开窗户，远处山峦还笼着薄雾。楼下早餐铺的香味慢慢飘上来，让人想起家乡的味道。",
    highlight: [0, 2, 4, 2, 9, 2, 14, 2, 19, 2, 25, 2, 28, 2, 35, 5]
  },
  {
    pid: "1",
    text: "写作是一种与未来读者的对话，作者写下文字，期望有人愿意倾听。",
    highlight: [0, 2, 8, 2, 11, 2, 14, 2, 18, 2, 21, 2, 25, 2]
  },
  {
    pid: "2",
    text: "森林里阳光穿过树叶的缝隙，洒在青苔上。鸟鸣声从远处传来，提醒人们自然从未离开。",
    highlight: [0, 2, 5, 2, 10, 2, 15, 3, 19, 2, 25, 2, 28, 2, 32, 2, 36, 2]
  },
  {
    pid: "3",
    text: "每一个程序背后都有一个故事，工程师用代码写下解决现实问题的思考过程。",
    highlight: [3, 2, 11, 2, 14, 3, 18, 2, 22, 2, 26, 2, 31, 2]
  },
  {
    pid: "4",
    text: "夜读时一盏台灯就足够，书页翻动的声音让整个房间变得安静。",
    highlight: [0, 2, 5, 2, 8, 2, 13, 2, 16, 2, 19, 2, 25, 2]
  }
];

// English few-shot pool (Agent 2 round-7, 2026-06-14).
// Hand-crafted to teach the model: do NOT split words mid-digraph, prefer
// content-word ORP landing (left 1/3), skip function words (the/a/of/in),
// allow longer gaps across function-word clusters, density naturally
// 17-25% for English (lower than Chinese's 35-50% because English words
// are 4-8 chars vs Chinese 1-2 chars).
const FEW_SHOT_EXAMPLES_EN = [
  {
    // Pangram (en-1) — short, all-letters, simplest case. Topic anchor
    // "Th" anchors "The" + immediate content "quick" → 8 spans, 36% density.
    // Round-8 fix (Agent 6): retained as a deliberate teaching exception.
    // The new Rule 3 says "first content word, skip function words", which
    // would forbid anchoring "The" here. We keep [0,2]="Th" because:
    //   (a) the pangram is the shortest, simplest test case (44 chars,
    //       every word is well-known) — anchoring every word including
    //       the leading "The" is a denser-than-average demonstration;
    //   (b) the very next span [4,2]="qu" already lands on the first
    //       content word, so the function-word-then-content pattern is
    //       visible in this single example;
    //   (c) changing it would push the first span to [4,2]="qu" and
    //       reduce the example's span count from 8 to 7, weakening the
    //       density-vs-ORP contrast against the longer examples below.
    // Austen (en-3) was the other few-shot with a function-word first
    // anchor; that one was updated to [14,2]="tr" of "truth" because the
    // paragraph is long enough that the function-word exception would
    // dilute the rule rather than demonstrate it.
    pid: "0",
    text: "The quick brown fox jumps over the lazy dog.",
    highlight: [0, 2, 4, 2, 10, 2, 16, 2, 20, 2, 26, 2, 35, 2, 40, 2]
  },
  {
    // Chekhov aphorism (en-7) — multi-clause, content nouns outnumber
    // function words 2:1. 16 spans, 23% density. Demonstrates that
    // "it/is/of/a" (function cluster) gets a gap > 10 chars.
    pid: "1",
    text: "Knowledge is of no value unless you put it into practice. A single conversation with a wise man is better than ten years of solitary study.",
    highlight: [0, 2, 16, 2, 19, 2, 25, 2, 32, 2, 36, 2, 48, 2, 60, 2, 67, 2, 87, 2, 92, 2, 99, 2, 111, 2, 115, 2, 124, 2, 133, 2]
  },
  {
    // Dickens "best of times" (en-5) — parallel structure with repeated
    // "of times, it was the" function cluster. Teaches that even when
    // content words repeat ("times", "age"), each occurrence is a fresh
    // anchor. 15 spans, 18% density.
    pid: "2",
    text: "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness. Cities sprung up and empires fell across the small planet.",
    highlight: [11, 2, 19, 2, 37, 2, 46, 2, 64, 2, 71, 2, 90, 2, 97, 2, 110, 2, 117, 2, 131, 2, 139, 2, 155, 2, 161, 2]
  },
  {
    // Austen "truth universally acknowledged" (en-10) — long, dense content,
    // abstract nouns ("truth/feelings/views/property"). Demonstrates that
    // the "single man in possession of a good fortune" clause still
    // anchors on content words (man, possession, good, fortune). 32
    // spans, 17% density.
    // Round-8 fix (Agent 6): first anchor moved from [8,2]="is" (function
    // word) to [14,2]="tr" of "truth" — the first content word. Old
    // anchor violated the new Rule 3 (first content word, skip function
    // words). Pangram en-1 is the only kept exception (see comment there).
    pid: "3",
    text: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the rightful property of some one or other of their daughters.",
    highlight: [14, 2, 26, 2, 47, 2, 54, 2, 61, 2, 77, 2, 82, 2, 102, 2, 112, 2, 118, 2, 126, 2, 133, 2, 143, 2, 155, 2, 164, 2, 171, 2, 189, 2, 195, 2, 206, 2, 226, 2, 243, 2, 256, 2, 269, 2, 281, 2, 302, 2, 320, 2, 329, 2, 341, 2, 346, 2, 353, 2, 368, 2]
  },
  {
    // Tolkien "hobbit-hole" (en-8) — long descriptive. "hole" appears 3
    // times; model must anchor each occurrence. Compound noun "hobbit-hole"
    // keeps hyphen; rule 10 (length 2) still applies because each
    // sub-word is a clear content anchor. 35 spans, 19% density.
    pid: "4",
    text: "In a hole in the ground there lived a hobbit. Not a nasty, dirty, wet hole, filled with the ends of worms and an oozy smell, nor yet a dry, bare, sandy hole with nothing in it to sit down on or to eat: it was a hobbit-hole, and that means comfort. It had a perfectly round door like a porthole, painted green, with a shiny yellow brass knob in the exact middle.",
    highlight: [5, 2, 17, 2, 30, 2, 38, 2, 46, 2, 52, 2, 59, 2, 66, 2, 76, 2, 92, 2, 100, 2, 113, 2, 118, 2, 135, 2, 140, 2, 146, 2, 152, 2, 162, 2, 179, 2, 197, 2, 211, 2, 233, 2, 239, 2, 257, 2, 267, 2, 273, 2, 285, 2, 295, 2, 303, 2, 317, 2, 323, 2, 330, 2, 336, 2, 348, 2, 354, 2]
  }
];

// Detect whether the paragraph set is mostly Chinese vs mostly English/Latin.
// Used by buildHighlightPrompt to pick the matching few-shot pool and to
// soften the "Chinese wrap-up" rule for English.
// Heuristic: count CJK Unified Ideographs (U+4E00..U+9FFF) vs Latin letters
// (a-z A-Z). If CJK / (CJK + Latin) > 0.3 we treat the text as Chinese.
// Threshold 0.3 was chosen empirically:
//   - Pure English: CJK share ≈ 0%  → English pool.
//   - Chinese with stray English proper nouns (e.g. "OpenAI"): CJK share
//     still > 80% → Chinese pool.
//   - Mixed CN/EN technical blog: usually still > 50% CJK on long
//     passages, so 0.3 errs on the side of Chinese (the pool with
//     higher coverage of the "wrap-up effect" rule).
const ENGLISH_DETECTION_CJK_THRESHOLD = 0.3;

export function detectLanguage(paragraphs) {
  let cjk = 0;
  let latin = 0;
  for (const paragraph of paragraphs || []) {
    const text = paragraph?.text || "";
    for (const ch of text) {
      const code = ch.codePointAt(0);
      if (code >= 0x4e00 && code <= 0x9fff) {
        cjk += 1;
      } else if (
        (code >= 0x41 && code <= 0x5a) ||
        (code >= 0x61 && code <= 0x7a)
      ) {
        latin += 1;
      }
    }
  }
  const total = cjk + latin;
  if (total === 0) return "zh"; // empty / symbols-only → fall back to default pool
  return cjk / total > ENGLISH_DETECTION_CJK_THRESHOLD ? "zh" : "en";
}

// density parameter kept for backward compat; the few-shot examples set the target density empirically.
function buildHighlightPrompt(paragraphs, density) {
  const language = detectLanguage(paragraphs);
  const fewShotPool = language === "en" ? FEW_SHOT_EXAMPLES_EN : FEW_SHOT_EXAMPLES_ZH;
  const isEnglish = language === "en";

  // Rule 2 wording switches by language: skip function words is a universal
  // rule, but the example list must match the input language.
  const rule2FunctionWords = isEnglish
    ? "2. Highlight low-frequency content words (nouns, verbs, adjectives); skip function words like the/a/of/in/and/is/to/with."
    : "2. Highlight low-frequency content words; skip function words like 的/了/是/在/和/也/都.";

  // Round-8 fix (Agent 6): Rule 3 changed from "first 2-3 characters" to
  // "first content word". Rationale: when the paragraph begins with a
  // function-word cluster ("It was the best of times..."), anchoring on
  // chars 0-2 would land on a function word ("It"), which violates Rule 2
  // and produces a low-value highlight. The model in round-7 was already
  // correctly skipping to the first content word (e.g. position 11 "be" of
  // "best") — Rule 3 wording now matches that better behavior. Chinese is
  // kept on the same principle (skip leading particles 的/了/是/在/和/也/都
  // to the first content word) for consistency, even though Chinese rarely
  // opens with a pure-function cluster.
  const rule3TopicAnchor = isEnglish
    ? "3. Topic anchor: highlight the first content word (noun/verb/adjective) of the paragraph. Skip leading function words (it/was/the/a/an/of/in/to/with) — they are not anchors."
    : "3. 段首锚点：高亮段落第一个实词（名词/动词/形容词）。如果开头是虚词/助词（的/了/是/在/和/也/都），跳过直到第一个实词。";

  // Rule 4: Chinese reading has a "wrap-up effect" where the last 1-2
  // characters are visual rest points (low fixation). English reading does
  // NOT show this effect — the closing word is still fixated. So for English
  // we drop the "do not force" clause and add a mild encouragement to
  // anchor the closing clause as well, because the model was over-relying
  // on the "skip last word" rule even for English (Agent 2 round-7 finding).
  const rule4 = isEnglish
    ? "4. Paragraph endings: do NOT skip the closing word by reflex. In English, the last content word is still a fixation target — anchor it when it carries the clause's payoff. (Only abandon it when the closing is purely punctuation or a function word.)"
    : "4. Paragraph endings: do NOT force a highlight. In Chinese reading the wrap-up effect is reversed — the last words are visual rest points, not anchors.";

  // Rule 8: English words average 4-8 chars vs Chinese 1-2 chars, so the
  // physically achievable density ceiling is ~25% on English even when the
  // model is anchoring every content word. The Chinese 35-50% range is
  // unattainable on English without violating ORP / saccade rules.
  const rule8 = isEnglish
    ? "8. Density: highlighted chars / paragraph length ≈ 17-25% (English ceiling, lower than Chinese because English words are longer). Going above 25% means you are splitting words; going below 15% means you are missing content words."
    : "8. Density: highlighted chars / paragraph length ≈ 35-50% (empirical range for CJK scripts based on saccade-distance effect).";

  const lines = [
    // RULE on the first user line (Agent 4 round-4 finding: rule in user beats rule in system).
    `RULE: Each highlight span should match an eye-saccade landing point and typically span exactly 2 visible Unicode characters. Density target: roughly one span every 4-6 characters, never continuous highlighting. Language: ${isEnglish ? "English" : "Chinese"}.`,
    "",
    "You are Saccade, a semantic reading-guide highlighter that predicts eye-saccade landing points.",
    "Return only JSON in this exact shape:",
    "{\"highlight\":{\"<paragraphId>\":[start,length,start,length,...]}}",
    "Example: {\"highlight\":{\"0\":[4,2,6,2,29,2]}}",
    "",
    "## Highlighting rules (priority order, derived from eye-tracking research)",
    "1. Highlight proper nouns, names, places, brands, technical terms (cognitive anchors).",
    rule2FunctionWords,
    rule3TopicAnchor,
    rule4,
    "5. Distance between adjacent highlight starts should be 5-8 characters (saccade distance effect); never less than 3.",
    "6. Land highlights on the left third of a content word (ORP principle); avoid starting at the right edge of a word.",
    "7. Never stack 3+ rare/uncommon characters in a row (foveal preview fails).",
    rule8,
    "9. start and length are visible Unicode character offsets, like JavaScript .slice (UTF-16 code units).",
    "10. Highlight length should be exactly 2 characters (saccade landing point); use 3-4 only for compound terms.",
    "",
    "## Output format",
    "- Flat array of numbers: [start, length, start, length, ...].",
    "- Do NOT return nested arrays like [[4,2],[6,2]].",
    "- No explanation, no markdown, no apology — JSON only.",
    "",
    "## Few-shot examples (input text → output highlight array)"
  ];
  for (const example of fewShotPool) {
    lines.push(`Paragraph ${example.pid}: ${example.text}`);
    lines.push(`Highlight ${example.pid}: ${JSON.stringify(example.highlight)}`);
  }
  lines.push("", "## Now produce the highlight for these paragraphs:");
  for (const paragraph of paragraphs) {
    lines.push(`Paragraph ${paragraph.id}: ${paragraph.text}`);
  }
  lines.push("Highlight:");
  return lines.join("\n");
}

function extractAnthropicText(responseJson) {
  if (!Array.isArray(responseJson?.content)) {
    throw new Error("MiniMax response did not include content blocks.");
  }

  // Round-8 fix (Agent 6): Anthropic-protocol responses may include thinking
  // blocks (type === "thinking"). Round-7 V3 saw 2/50 real MiniMax samples
  // where the only block was thinking (or content was []), causing
  // "did not include text content" + retry-chain failure. We now:
  //   1. Explicitly skip thinking blocks in the filter (defensive — even
  //      when B-side request has `thinking: { type: "disabled" }`, old
  //      model versions may still emit one).
  //   2. Distinguish "all-thinking" from "completely empty" so the retry
  //      layer / future telemetry can tell the two failure modes apart.
  //   3. Preserve stop_reason telemetry if present (used by Agent B for
  //      round-9 stop_reason: "end_turn" vs "thinking" detection).
  const allBlocks = responseJson.content;
  const thinkingBlocks = allBlocks.filter((block) => block?.type === "thinking");
  const textBlocks = allBlocks.filter(
    (block) => block?.type === "text" && typeof block.text === "string" && block.type !== "thinking"
  );

  const text = textBlocks.map((block) => block.text).join("\n").trim();

  if (!text) {
    if (thinkingBlocks.length > 0) {
      const stopReason = responseJson?.stop_reason ? ` (stop_reason: ${responseJson.stop_reason})` : "";
      throw new Error(
        `MiniMax response contained only thinking blocks (${thinkingBlocks.length})${stopReason}; no text block was emitted.`
      );
    }
    throw new Error("MiniMax response did not include text content.");
  }
  return text;
}

function normalizeHighlightMapShape(highlight) {
  return Object.fromEntries(
    Object.entries(highlight).map(([paragraphId, ranges]) => {
      if (Array.isArray(ranges) && ranges.every((range) => Array.isArray(range))) {
        return [paragraphId, ranges.flatMap(([start, length]) => [start, length])];
      }
      return [paragraphId, ranges];
    })
  );
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function recoverHighlightMapFromText(rawText, paragraphs) {
  const recovered = {};

  for (const paragraph of paragraphs) {
    const paragraphIdPattern = escapeRegExp(paragraph.id);
    const match = rawText.match(new RegExp(`["']${paragraphIdPattern}["']\\s*:\\s*\\[([\\s\\S]*?)(?=\\}\\s*(?:\\}|$)|,\\s*["'])`));
    if (!match) continue;

    const numbers = [...match[1].matchAll(/-?\d+/g)].map(([value]) => Number(value));
    if (numbers.length > 0 && numbers.length % 2 === 0) {
      recovered[paragraph.id] = numbers;
    }
  }

  if (Object.keys(recovered).length === 0) {
    throw new Error("MiniMax response did not contain a recoverable HighlightMap.");
  }
  return recovered;
}

function parseHighlightJson(rawText, paragraphs) {
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : rawText.slice(rawText.indexOf("{"), rawText.lastIndexOf("}") + 1);

  if (!candidate.trim()) {
    throw new Error("MiniMax response did not contain JSON.");
  }

  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return recoverHighlightMapFromText(rawText, paragraphs);
  }

  const highlight = normalizeHighlightMapShape(parsed.highlight || parsed);
  if (!highlight || typeof highlight !== "object" || Array.isArray(highlight)) {
    throw new Error("MiniMax response JSON did not include a HighlightMap.");
  }
  return highlight;
}

function splitParagraphsForMiniMax(paragraphs) {
  const batches = [];
  let batch = [];
  let batchChars = 0;

  for (const paragraph of paragraphs) {
    const charLength = paragraph.charLength || Array.from(paragraph.text || "").length;
    const wouldOverflow =
      batch.length > 0 &&
      (batch.length >= MINIMAX_MAX_PARAGRAPHS_PER_REQUEST ||
        batchChars + charLength > MINIMAX_MAX_CHARS_PER_REQUEST);

    if (wouldOverflow) {
      batches.push(batch);
      batch = [];
      batchChars = 0;
    }

    batch.push(paragraph);
    batchChars += charLength;
  }

  if (batch.length > 0) batches.push(batch);
  return batches;
}

function isStructuredOutputError(error) {
  return /did not include text content|did not contain JSON|recoverable HighlightMap|did not include a HighlightMap|contained only thinking blocks/.test(
    error.message || ""
  );
}

function mergeUsage(left, right) {
  if (!left) return right || null;
  if (!right) return left;

  const merged = { ...left };
  for (const [key, value] of Object.entries(right)) {
    if (typeof value === "number" && typeof merged[key] === "number") {
      merged[key] += value;
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function mergeMiniMaxBatchResults(results) {
  return results.reduce(
    (merged, result) => ({
      highlight: { ...merged.highlight, ...result.highlight },
      model: result.model || merged.model,
      usage: mergeUsage(merged.usage, result.usage)
    }),
    { highlight: {}, model: null, usage: null }
  );
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

async function requestMiniMaxHighlightBatch({ paragraphs, density, config, fetchImpl }) {
  // Round-8 fix (Agent 6): pass `thinking: { type: "disabled" }` so the
  // model does not emit a thinking block as the only / first content block.
  // Anthropic Messages API supports this field on compatible providers
  // (including MiniMax M3, which follows the 2023-06-01 protocol).
  // If the provider rejects the field, `response.ok === false` → the
  // existing HTTP error path fires; the A-side `extractAnthropicText` fix
  // is the safety net for old model versions that still emit thinking.
  const response = await fetchImpl(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": config.apiKey,
      "anthropic-version": ANTHROPIC_VERSION
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      temperature: 0,
      thinking: { type: "disabled" },
      system: "Return final JSON only, no explanation.",
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: buildHighlightPrompt(paragraphs, density) }]
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`MiniMax highlight request failed with HTTP ${response.status}.`);
  }

  const responseJson = await response.json();
  const highlight = parseHighlightJson(extractAnthropicText(responseJson), paragraphs);
  const clippedHighlight = clipHighlightSpans(highlight, paragraphs);
  assertHighlightMap(clippedHighlight, paragraphs);

  return {
    highlight: clippedHighlight,
    model: responseJson.model || config.model,
    usage: responseJson.usage || null
  };
}

async function requestMiniMaxHighlightBatchWithRetry({ paragraphs, density, config, fetchImpl }) {
  try {
    return await requestMiniMaxHighlightBatch({ paragraphs, density, config, fetchImpl });
  } catch (error) {
    if (paragraphs.length <= 1 || !isStructuredOutputError(error)) {
      throw error;
    }

    const midpoint = Math.ceil(paragraphs.length / 2);
    const results = await Promise.all([
      requestMiniMaxHighlightBatchWithRetry({
        paragraphs: paragraphs.slice(0, midpoint),
        density,
        config,
        fetchImpl
      }),
      requestMiniMaxHighlightBatchWithRetry({
        paragraphs: paragraphs.slice(midpoint),
        density,
        config,
        fetchImpl
      })
    ]);

    return mergeMiniMaxBatchResults(results);
  }
}

async function callMiniMaxHighlight({ paragraphs, density, config, fetchImpl }) {
  const startedAt = Date.now();
  const batches = splitParagraphsForMiniMax(paragraphs);
  const batchResults = await mapWithConcurrency(batches, MINIMAX_MAX_CONCURRENT_REQUESTS, (batch) =>
    requestMiniMaxHighlightBatchWithRetry({ paragraphs: batch, density, config, fetchImpl })
  );
  const merged = mergeMiniMaxBatchResults(batchResults);
  const clippedHighlight = clipHighlightSpans(merged.highlight, paragraphs);
  assertHighlightMap(clippedHighlight, paragraphs);

  return {
    highlight: merged.highlight,
    modelInfo: {
      provider: "minimax",
      model: merged.model || config.model,
      apiType: config.apiType,
      latencyMs: Date.now() - startedAt,
      requestCount: batchResults.length,
      fallbackUsed: false,
      usage: merged.usage
    }
  };
}

function generateMockResult(paragraphs, density) {
  const highlight = generateMockHighlightMap(paragraphs, density);
  assertHighlightMap(highlight, paragraphs);

  return {
    highlight,
    modelInfo: {
      provider: "mock",
      model: "mock-semantic-reading-guide"
    }
  };
}

export async function generateAiHighlight({
  paragraphs,
  density = "medium",
  providerMode,
  env,
  envFilePaths,
  readFileSync,
  fetchImpl = globalThis.fetch
}) {
  const mergedEnv = env || loadProviderEnv({ envFilePaths, readFileSync });
  const config = resolveLlmConfig({
    providerMode: providerMode || mergedEnv.SACCADE_LLM_PROVIDER || mergedEnv.WEB_MVP_LLM_PROVIDER || "auto",
    env: mergedEnv
  });

  if (config.provider === "mock") {
    return generateMockResult(paragraphs, density);
  }

  if (!fetchImpl) {
    throw new Error("fetch is not available for the configured LLM provider.");
  }

  return callMiniMaxHighlight({ paragraphs, density, config, fetchImpl });
}
