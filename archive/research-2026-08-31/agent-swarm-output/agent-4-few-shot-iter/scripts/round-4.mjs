// Round 4: 变量 = system-vs-user rule position × temperature × rule detail
// 用 round-2 验证过的"5 shot + length 规则"做基线，扫 3 个变量
// 变量 1: rule 位置 (user vs system)
// 变量 2: temperature (0 / 0.1 / 0.3)
// 变量 3: 规则详细度 (verbose vs concise)
// 每次只动 1 个变量

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
const queryText = "深秋的街道铺满落叶，远处传来咖啡店轻柔的音乐。";

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

const baselineQuery = await fetchQueryBaseline(queryText);
console.log(`# query baseline starts: ${JSON.stringify(baselineQuery.starts)}`);

function buildUserContent({ rule, rulePosition, ruleStyle }) {
  // rule: verbose (默认) or concise
  // rulePosition: 'system' (放 system prompt) or 'user' (放 user prompt 第一行)
  const verboseRule = [
    "Each highlight span should match an eye-saccade landing point and typically span exactly 2 visible Unicode characters.",
    "Density target: roughly one span every 4-6 characters, never continuous highlighting."
  ].join(" ");
  const conciseRule = "Each span = exactly 2 visible Unicode chars; aim for one span per 4-6 chars.";
  const theRule = ruleStyle === "concise" ? conciseRule : verboseRule;

  const lines = [];
  if (rulePosition === "user") {
    lines.push(`RULE: ${theRule}`);
  }
  lines.push("You are TillGlance's semantic reading-guide highlighter.");
  lines.push("Return only JSON: {\"highlight\":{\"<paragraphId>\":[start,length,start,length,...]}}");
  lines.push("", "Examples (input text -> output highlight array):");
  for (const [pid, text] of Object.entries(baseline.contentDict)) {
    lines.push(`Paragraph ${pid}: ${text}`);
    lines.push(`Highlight ${pid}: ${JSON.stringify(baseline.highlight[pid])}`);
  }
  lines.push("", "Now produce the highlight for:", `Paragraph 0: ${queryText}`, "Highlight 0:");
  return lines.join("\n");
}

async function callOnce({ label, rulePosition, ruleStyle, temperature }) {
  const userContent = buildUserContent({ rulePosition, ruleStyle });
  const systemText = rulePosition === "system"
    ? `RULE: ${ruleStyle === "concise" ? "Each span = exactly 2 visible Unicode chars; aim for one span per 4-6 chars." : "Each highlight span should match an eye-saccade landing point and typically span exactly 2 visible Unicode characters. Density target: roughly one span every 4-6 characters, never continuous highlighting."}\nReturn final JSON only, no explanation.`
    : "Return final JSON only, no explanation.";

  const body = {
    model, max_tokens: 4096, temperature,
    system: systemText,
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
    label, rulePosition, ruleStyle, temperature,
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
    result.overlap1 = `${o1}/${starts.length} starts within ±1`;
    result.overlap2 = `${o2}/${starts.length} starts within ±2`;
  }
  console.log(JSON.stringify(result, null, 2));
  return result;
}

console.log(`# endpoint: ${endpoint}, model: ${model}`);

const runs = [
  { label: "r4-system-verbose-T0.1", rulePosition: "system", ruleStyle: "verbose", temperature: 0.1 },
  { label: "r4-user-verbose-T0.1",   rulePosition: "user",   ruleStyle: "verbose", temperature: 0.1 },
  { label: "r4-user-concise-T0.1",   rulePosition: "user",   ruleStyle: "concise", temperature: 0.1 },
  { label: "r4-user-verbose-T0",     rulePosition: "user",   ruleStyle: "verbose", temperature: 0 },
  { label: "r4-user-verbose-T0.3",   rulePosition: "user",   ruleStyle: "verbose", temperature: 0.3 }
];

const results = [];
for (const [i, run] of runs.entries()) {
  if (i > 0) await new Promise((r) => setTimeout(r, 1500));
  results.push(await callOnce(run));
}

const outPath = "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/rounds/round-4.json";
fs.writeFileSync(outPath, JSON.stringify({
  ranAt: new Date().toISOString(), model, queryText,
  queryBaselineStarts: baselineQuery.starts, queryBaselineRaw: baselineQuery.raw,
  results
}, null, 2));
console.log(`\n# saved: ${outPath}`);
