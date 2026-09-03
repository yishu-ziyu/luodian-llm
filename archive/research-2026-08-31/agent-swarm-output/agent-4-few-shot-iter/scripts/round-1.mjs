// Round 1: 复用 first-round 脚本 + 量化起点重合度
// Baseline 起点（取 start 列）：0 -> [2,6,10,13,16,21,24,29,32,39,43,50]；1 -> [4,8,13,16,21,24,27,30,34,39,48]
// Query text 长度 24 chars："今天天气真好，阳光明媚，适合出门散步。我们一起去看海吧。"

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

const baselinePath = "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/experiments/baseline-capture/outputs/2026-06-02T12-34-03-340Z-tillglance-baseline.json";
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

const queryText = "今天天气真好，阳光明媚，适合出门散步。我们一起去看海吧。";

function buildPrompt({ withShots, withLengthConstraint }) {
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
  for (const [pid, text] of Object.entries(baseline.contentDict)) {
    const hl = baseline.highlight[pid];
    lines.push(`Paragraph ${pid}: ${text}`);
    lines.push(`Highlight ${pid}: ${JSON.stringify(hl)}`);
  }
  lines.push("", "Now produce the highlight for:", `Paragraph 0: ${queryText}`, "Highlight 0:");
  return lines.join("\n");
}

async function callOnce({ withShots, withLengthConstraint, label }) {
  const prompt = buildPrompt({ withShots, withLengthConstraint });
  const body = {
    model,
    max_tokens: 4096,
    temperature: 0.1,
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
  const text = (json.content || [])
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const result = {
    label,
    latencyMs: Date.now() - t0,
    usage: json.usage || null,
    rawText: text,
    spans: null,
    starts: null,
    lengths: null,
    totalChars: null,
    density: null,
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
    const spans = [];
    for (let i = 0; i < arr.length; i += 2) spans.push({ start: arr[i], length: arr[i + 1] });
    const starts = spans.map((s) => s.start);
    const lengths = spans.map((s) => s.length);
    const totalChars = spans.reduce((s, x) => s + x.length, 0);
    const baselineStarts = [2, 6, 10, 13, 16, 21, 24, 29, 32, 39, 43, 50];
    const overlap1 = starts.filter((s) => baselineStarts.some((b) => Math.abs(s - b) <= 1)).length;
    const overlap2 = starts.filter((s) => baselineStarts.some((b) => Math.abs(s - b) <= 2)).length;
    result.spans = spans;
    result.starts = starts;
    result.lengths = lengths;
    result.totalChars = totalChars;
    result.density = +((totalChars / queryText.length) * 100).toFixed(1);
    result.overlap1 = `${overlap1}/${starts.length} starts within ±1 char of baseline`;
    result.overlap2 = `${overlap2}/${starts.length} starts within ±2 char of baseline`;
  }

  console.log(JSON.stringify(result, null, 2));
  return result;
}

console.log(`# endpoint: ${endpoint}`);
console.log(`# model: ${model}`);

const a = await callOnce({ withShots: true, withLengthConstraint: false, label: "round1-few-shot-only-no-length-rule" });
await new Promise((r) => setTimeout(r, 1500));
const b = await callOnce({ withShots: true, withLengthConstraint: true, label: "round1-few-shot-with-length-rule" });

const outPath = "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/rounds/round-1.json";
fs.writeFileSync(outPath, JSON.stringify({ ranAt: new Date().toISOString(), model, results: [a, b] }, null, 2));
console.log(`\n# saved: ${outPath}`);
