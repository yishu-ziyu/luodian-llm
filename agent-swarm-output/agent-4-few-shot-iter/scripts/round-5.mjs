// Round 5: 综合最优 = user-verbose-T0 + 多 query 验证泛化能力
// 5 个不同 query，统计 span 长度分布 + 起点重合度

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

const baseline = JSON.parse(fs.readFileSync("/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/experiments/baseline-capture/outputs/2026-06-13T13-13-43-865Z-tillglance-baseline-5new.json","utf8"));

const queries = [
  "深秋的街道铺满落叶，远处传来咖啡店轻柔的音乐。",
  "城市的清晨从一碗热粥开始，街角的早餐店冒着蒸汽。",
  "写作是一种与未来读者的对话，作者写下文字，期望有人愿意倾听。",
  "海边的礁石上长满了贝类，潮水退去后留下海盐结晶。",
  "夜读时一盏台灯就足够，书页翻动的声音让整个房间变得安静。"
];

async function fetchQueryBaseline(text) {
  const response = await fetch("https://api.tillglance.com/nlphl", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ "0": text })
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`TillGlance failed: ${response.status}`);
  const hl = JSON.parse(responseText);
  const arr = hl["0"] || [];
  const starts = [];
  for (let i = 0; i < arr.length; i += 2) starts.push(arr[i]);
  return { starts, raw: arr };
}

function buildUserContent(queryText) {
  const lines = [
    "RULE: Each highlight span should match an eye-saccade landing point and typically span exactly 2 visible Unicode characters. Density target: roughly one span every 4-6 characters, never continuous highlighting.",
    "You are TillGlance's semantic reading-guide highlighter.",
    "Return only JSON: {\"highlight\":{\"<paragraphId>\":[start,length,start,length,...]}}",
    "",
    "Examples (input text -> output highlight array):"
  ];
  for (const [pid, text] of Object.entries(baseline.contentDict)) {
    lines.push(`Paragraph ${pid}: ${text}`);
    lines.push(`Highlight ${pid}: ${JSON.stringify(baseline.highlight[pid])}`);
  }
  lines.push("", "Now produce the highlight for:", `Paragraph 0: ${queryText}`, "Highlight 0:");
  return lines.join("\n");
}

async function runOne(queryText, temperature) {
  const baselineQuery = await fetchQueryBaseline(queryText);
  const userContent = buildUserContent(queryText);
  const body = {
    model, max_tokens: 4096, temperature,
    system: "Return final JSON only, no explanation.",
    messages: [{ role: "user", content: [{ type: "text", text: userContent }] }]
  };
  const t0 = Date.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body)
  });
  const json = await response.json();
  const blocks = Array.isArray(json.content) ? json.content : [];
  const text = blocks.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n").trim();
  const thinkingLen = blocks.filter((b) => b?.type === "thinking").reduce((s, b) => s + (b.thinking?.length || 0), 0);

  const result = {
    query: queryText,
    queryBaselineStarts: baselineQuery.starts,
    latencyMs: Date.now() - t0,
    usage: json.usage || null,
    thinkingChars: thinkingLen,
    rawText: text,
    lengths: null,
    starts: null,
    overlap1: null,
    overlap2: null
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
    result.overlap1 = `${o1}/${starts.length}`;
    result.overlap2 = `${o2}/${starts.length}`;
    result.length2Count = lengths.filter((l) => l === 2).length;
    result.lengthTotalCount = lengths.length;
  }
  console.log(JSON.stringify(result, null, 2));
  return result;
}

console.log(`# endpoint: ${endpoint}, model: ${model}, temperature=0 (best from round 4)`);

const results = [];
for (const [i, q] of queries.entries()) {
  if (i > 0) await new Promise((r) => setTimeout(r, 1500));
  results.push(await runOne(q, 0));
}

// 聚合
const summary = {
  totalQueries: queries.length,
  successfulQueries: results.filter((r) => r.starts).length,
  avgLatency: Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length),
  totalLength2Spans: results.reduce((s, r) => s + (r.length2Count || 0), 0),
  totalSpans: results.reduce((s, r) => s + (r.lengthTotalCount || 0), 0),
  length2Ratio: results.reduce((s, r) => s + (r.length2Count || 0), 0) /
    Math.max(1, results.reduce((s, r) => s + (r.lengthTotalCount || 0), 0))
};
console.log(`\n# summary: ${JSON.stringify(summary, null, 2)}`);

const outPath = "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/rounds/round-5.json";
fs.writeFileSync(outPath, JSON.stringify({
  ranAt: new Date().toISOString(), model, temperature: 0,
  config: "user-verbose-T0 + 5 examples (best from round 4)",
  summary,
  results
}, null, 2));
console.log(`# saved: ${outPath}`);
