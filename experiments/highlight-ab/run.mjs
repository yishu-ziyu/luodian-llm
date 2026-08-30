import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createHighlightCandidates,
  createHighlightSpans,
  selectHighlightCandidates
} from "../../extension/core/highlight-engine.ts";
import { extractUrlArticle } from "../../web-mvp/src/extract-url.mjs";
import { loadProviderEnv, resolveLlmConfig } from "../../web-mvp/src/llm-client.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const targetUrl = process.env.HIGHLIGHT_AB_URL || "https://read.pmthinking.com/p/178";
const paragraphIndexes = (process.env.HIGHLIGHT_AB_PARAGRAPHS || "0,1,3,6,7,9,17,24,25")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter(Number.isInteger);
const experimentId = process.env.HIGHLIGHT_AB_ID || `article-${paragraphIndexes.join("-")}`;
const outputName = process.env.HIGHLIGHT_AB_OUTPUT || "report.html";
const allowedRoles = new Set([
  "topic",
  "claim",
  "action",
  "cause",
  "contrast",
  "evidence",
  "negation",
  "qualifier"
]);

function extractResponseText(responseJson) {
  return (responseJson.content || [])
    .filter((item) => item?.type === "text")
    .map((item) => item.text || "")
    .join("\n")
    .trim();
}

function parseJsonObject(rawText) {
  const cleaned = String(rawText).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model response did not contain a JSON object.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function buildPrompt(paragraphs) {
  const payload = paragraphs.map((paragraph) => ({
    id: paragraph.id,
    text: paragraph.text,
    candidates: paragraph.candidates.map(({ id, text }) => ({ id, text }))
  }));
  return [
    "你在为中文网页做阅读效率高亮。目标是在不改写原文的前提下，让读者更快看清语义主干。",
    "请给每一个候选词评分，不得省略候选，不得生成新词。",
    "高分对象：主题实体、主要判断或动作、因果、转折、证据、数字、否定和范围限定。",
    "低分对象：之前、部分、内容、目前、这里等脱离上下文后信息量很低的泛词。",
    "role 只能是 topic/claim/action/cause/contrast/evidence/negation/qualifier。",
    "score 是 0 到 100 的整数。只返回 JSON。",
    "输出格式：{\"paragraphs\":[{\"id\":\"p0\",\"candidates\":[{\"id\":\"c0\",\"role\":\"topic\",\"score\":80}]}]}",
    JSON.stringify(payload)
  ].join("\n\n");
}

async function rankWithMiniMax(paragraphs) {
  const config = resolveLlmConfig({ providerMode: "minimax", env: loadProviderEnv() });
  const startedAt = Date.now();
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": config.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 8192,
      temperature: 0,
      thinking: { type: "disabled" },
      system: "Disable thinking. Return only valid JSON without markdown or explanation.",
      messages: [{ role: "user", content: [{ type: "text", text: buildPrompt(paragraphs) }] }]
    })
  });
  if (!response.ok) throw new Error(`MiniMax ranking failed with HTTP ${response.status}.`);
  const responseJson = await response.json();
  const parsed = parseJsonObject(extractResponseText(responseJson));
  const rankedParagraphs = Array.isArray(parsed.paragraphs) ? parsed.paragraphs : [];
  for (const expected of paragraphs) {
    const ranked = rankedParagraphs.find((item) => item?.id === expected.id);
    if (!ranked || !Array.isArray(ranked.candidates)) {
      throw new Error(`Model omitted paragraph ${expected.id}.`);
    }
    const expectedIds = new Set(expected.candidates.map((candidate) => candidate.id));
    const returnedIds = new Set(ranked.candidates.map((candidate) => candidate.id));
    if (expectedIds.size !== returnedIds.size || [...expectedIds].some((id) => !returnedIds.has(id))) {
      throw new Error(`Model did not score every candidate in ${expected.id}.`);
    }
    for (const candidate of ranked.candidates) {
      if (!allowedRoles.has(candidate.role)) throw new Error(`Invalid role for ${expected.id}/${candidate.id}.`);
      if (!Number.isInteger(candidate.score) || candidate.score < 0 || candidate.score > 100) {
        throw new Error(`Invalid score for ${expected.id}/${candidate.id}.`);
      }
    }
  }
  return {
    model: responseJson.model || config.model,
    latencyMs: Date.now() - startedAt,
    usage: responseJson.usage || null,
    paragraphs: rankedParagraphs
  };
}

function modelMapFor(paragraphId, ranking) {
  const paragraph = ranking.paragraphs.find((item) => item?.id === paragraphId);
  return new Map(
    (paragraph?.candidates || []).map((candidate) => [candidate.id, {
      score: Math.max(0, Math.min(100, Number(candidate.score) || 0)),
      role: allowedRoles.has(candidate.role) ? candidate.role : "topic"
    }])
  );
}

function coverage(text, spans) {
  return spans.reduce((total, span) => total + span.end - span.start, 0) / Math.max(text.length, 1);
}

function charSet(spans) {
  const set = new Set();
  for (const span of spans) {
    for (let index = span.start; index < span.end; index += 1) set.add(index);
  }
  return set;
}

function jaccard(left, right) {
  const a = charSet(left);
  const b = charSet(right);
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 1;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / union.size;
}

function hashParity(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 2;
}

function cleanParagraphText(text) {
  return String(text).replace(/\*\*/g, "").trim();
}

const article = await extractUrlArticle(targetUrl);
const selectedParagraphs = article.paragraphs
  .filter((paragraph) => paragraphIndexes.includes(paragraph.index))
  .map((paragraph, index) => ({
    id: `p${index}`,
    sourceIndex: paragraph.index,
    text: cleanParagraphText(paragraph.text),
    candidates: createHighlightCandidates(cleanParagraphText(paragraph.text))
  }));

const ranking = await rankWithMiniMax(selectedParagraphs);
const results = selectedParagraphs.map((paragraph) => {
  const localSpans = createHighlightSpans(paragraph.text);
  const modelScores = modelMapFor(paragraph.id, ranking);
  const rankedCandidates = paragraph.candidates.map((candidate) => {
    const model = modelScores.get(candidate.id);
    return {
      ...candidate,
      score: model ? model.score / 10 + candidate.score * 0.08 : 0
    };
  });
  const modelSpans = selectHighlightCandidates(paragraph.text.length, rankedCandidates);
  const roles = Object.fromEntries(
    modelSpans.map((span) => {
      const candidate = paragraph.candidates.find((item) => item.start === span.start && item.end === span.end);
      const model = candidate ? modelScores.get(candidate.id) : null;
      return [`${span.start}:${span.end}`, model?.role || "topic"];
    })
  );
  const leftMethod = hashParity(`${paragraph.id}:${paragraph.text}`) === 0 ? "local" : "model";
  return {
    id: paragraph.id,
    sourceIndex: paragraph.sourceIndex,
    text: paragraph.text,
    localSpans,
    modelSpans,
    modelRoles: roles,
    leftMethod,
    metrics: {
      localCoverage: coverage(paragraph.text, localSpans),
      modelCoverage: coverage(paragraph.text, modelSpans),
      localAnchors: localSpans.length,
      modelAnchors: modelSpans.length,
      overlap: jaccard(localSpans, modelSpans)
    }
  };
});

const experiment = {
  id: experimentId,
  generatedAt: new Date().toISOString(),
  source: { title: article.title, url: targetUrl },
  methods: {
    local: "纯本地算法",
    model: "MiniMax 语义排序 + 同一套本地约束"
  },
  model: {
    name: ranking.model,
    latencyMs: ranking.latencyMs,
    usage: ranking.usage,
    scoredCandidates: selectedParagraphs.reduce((total, paragraph) => total + paragraph.candidates.length, 0)
  },
  paragraphs: results
};

const template = await fs.readFile(path.join(moduleDir, "template.html"), "utf8");
const safeData = JSON.stringify(experiment).replace(/<\/script/gi, "<\\/script");
const outputPath = path.join(moduleDir, outputName);
await fs.writeFile(outputPath, template.replace("__EXPERIMENT_DATA__", safeData));
console.log(JSON.stringify({
  report: outputPath,
  experimentId,
  source: experiment.source,
  paragraphs: results.length,
  model: experiment.model
}, null, 2));
