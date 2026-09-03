// Round 3: 10 example + 1 query，测试 example 数量增加的边际效应
// 复用 round-2 主体，加 numExamples 变量

import fs from "node:fs";

const envContent = fs.readFileSync("/Users/mahaoxuan/.config/ai-providers/env.local", "utf8");
const env = {};
for (const rawLine of envContent.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const normalized = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
  const m = normalized.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!m) continue;
  env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
}
const baseUrl = (env.MINIMAX_ANTHROPIC_BASE_URL || "https://api.minimaxi.com/anthropic").replace(/\/+$/, "");
const endpoint = baseUrl.endsWith("/v1/messages") ? baseUrl : `${baseUrl}/v1/messages`;
const apiKey = env.MINIMAX_TOKEN_PLAN_KEY || env.MINIMAX_API_KEY;
const model = env.MINIMAX_MODEL || "MiniMax-M2.7";

// 合并 baseline: Round 1 (p0,p1) + Round 2 (p0-4) + Round 3 extra (p5-7)
// 注意 p0/p1 冲突 -> 重新命名
const b1 = JSON.parse(fs.readFileSync("/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/experiments/baseline-capture/outputs/2026-06-02T12-34-03-340Z-tillglance-baseline.json","utf8"));
const b2 = JSON.parse(fs.readFileSync("/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/experiments/baseline-capture/outputs/2026-06-13T13-13-43-865Z-tillglance-baseline-5new.json","utf8"));
const b3 = JSON.parse(fs.readFileSync("/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/experiments/baseline-capture/outputs/2026-06-13T13-14-43-682Z-tillglance-baseline-3extra.json","utf8"));

const merged = { contentDict: {}, highlight: {} };
for (const [pid, t] of Object.entries(b1.contentDict)) {
  merged.contentDict[`a_${pid}`] = t;
  merged.highlight[`a_${pid}`] = b1.highlight[pid];
}
for (const [pid, t] of Object.entries(b2.contentDict)) {
  merged.contentDict[`b_${pid}`] = t;
  merged.highlight[`b_${pid}`] = b2.highlight[pid];
}
for (const [pid, t] of Object.entries(b3.contentDict)) {
  merged.contentDict[`b_${pid}`] = t;
  merged.highlight[`b_${pid}`] = b3.highlight[pid];
}

const queryText = "深秋的街道铺满落叶，远处传来咖啡店轻柔的音乐。";

async function fetchQueryBaseline(text) {
  const t0 = Date.now();
  const response = await fetch("https://api.tillglance.com/nlphl", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ "0": text })
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`TillGlance failed: ${response.status}`);
  const hl = JSON.parse(responseText);
  const arr = hl["0"] || [];
  const starts = [];
  for (let i = 0; i < arr.length; i += 2) starts.push(arr[i]);
  return { starts, latencyMs: Date.now() - t0, raw: arr };
}

const baselineQuery = await fetchQueryBaseline(queryText);
console.log(`# query baseline starts: ${JSON.stringify(baselineQuery.starts)}`);

function buildPrompt({ numExamples, withLengthConstraint }) {
  const lines = [
    "You are TillGlance's semantic reading-guide highlighter.",
    "Return only JSON: {\"highlight\":{\"<paragraphId>\":[start,length,start,length,...]}}"
  ];
  if (withLengthConstraint) {
    lines.push(
      "Each highlight span should match an eye-saccade landing point and typically span exactly 2 visible Unicode characters.",
      "Density target: roughly one span every 4-6 characters, never continuous highlighting."
    );
  }
  lines.push("", "Examples (input text -> output highlight array):");
  const pids = Object.keys(merged.contentDict).sort();
  const picks = pids.slice(0, numExamples);
  for (const pid of picks) {
    lines.push(`Paragraph ${pid}: ${merged.contentDict[pid]}`);
    lines.push(`Highlight ${pid}: ${JSON.stringify(merged.highlight[pid])}`);
  }
  lines.push("", "Now produce the highlight for:", `Paragraph 0: ${queryText}`, "Highlight 0:");
  return lines.join("\n");
}

async function callOnce({ numExamples, withLengthConstraint, label, temperature }) {
  const prompt = buildPrompt({ numExamples, withLengthConstraint });
  const body = {
    model,
    max_tokens: 4096,
    temperature,
    system: "Return final JSON only, no explanation.",
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }]
  };
  const t0 = Date.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  });
  const json = await response.json();
  const blocks = Array.isArray(json.content) ? json.content : [];
  const text = blocks.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n").trim();
  const thinkingLen = blocks.filter((b) => b?.type === "thinking").reduce((s, b) => s + (b.thinking?.length || 0), 0);
  const result = {
    label, numExamples, withLengthConstraint, temperature,
    latencyMs: Date.now() - t0, usage: json.usage || null, rawText: text, thinkingChars: thinkingLen
  };
  let highlight = null;
  try {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(candidate);
    highlight = parsed.highlight || parsed;
  } catch (e) {
    result.parseError = e.message;
  }
  if (highlight && highlight["0"]) {
    const arr = highlight["0"];
    const starts = [];
    const lengths = [];
    for (let i = 0; i < arr.length; i += 2) { starts.push(arr[i]); lengths.push(arr[i + 1]); }
    const totalChars = lengths.reduce((s, x) => s + x, 0);
    const o1 = starts.filter((s) => baselineQuery.starts.some((b) => Math.abs(s - b) <= 1)).length;
    const o2 = starts.filter((s) => baselineQuery.starts.some((b) => Math.abs(s - b) <= 2)).length;
    result.starts = starts;
    result.lengths = lengths;
    result.totalChars = totalChars;
    result.density = +((totalChars / Array.from(queryText).length) * 100).toFixed(1);
    result.overlap1 = `${o1}/${starts.length} starts within ±1 of query baseline`;
    result.overlap2 = `${o2}/${starts.length} starts within ±2 of query baseline`;
  }
  console.log(JSON.stringify(result, null, 2));
  return result;
}

console.log(`# endpoint: ${endpoint}, model: ${model}`);

const r3a = await callOnce({ numExamples: 5, withLengthConstraint: true, label: "round3-5shot-with-length", temperature: 0.1 });
await new Promise((r) => setTimeout(r, 1500));
const r3b = await callOnce({ numExamples: 10, withLengthConstraint: true, label: "round3-10shot-with-length", temperature: 0.1 });
await new Promise((r) => setTimeout(r, 1500));
const r3c = await callOnce({ numExamples: 10, withLengthConstraint: false, label: "round3-10shot-no-length", temperature: 0.1 });

const outPath = "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/rounds/round-3.json";
fs.writeFileSync(outPath, JSON.stringify({
  ranAt: new Date().toISOString(), model, queryText,
  queryBaselineStarts: baselineQuery.starts, queryBaselineRaw: baselineQuery.raw, queryBaselineLatencyMs: baselineQuery.latencyMs,
  mergedExampleCount: Object.keys(merged.contentDict).length,
  results: [r3a, r3b, r3c]
}, null, 2));
console.log(`\n# saved: ${outPath}`);
