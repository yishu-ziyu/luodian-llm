// Round 2 准备：抓 5 篇新短文的 TillGlance baseline
import fs from "node:fs";
import path from "node:path";

const fixturePath = "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/scripts/round-2-fixture.json";
const contentDict = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const endpoint = process.env.TILLGLANCE_NLPHL_ENDPOINT || "https://api.tillglance.com/nlphl";

const t0 = Date.now();
const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(contentDict)
});
const responseText = await response.text();
const latencyMs = Date.now() - t0;

if (!response.ok) {
  throw new Error(`TillGlance nlphl failed: HTTP ${response.status} ${responseText}`);
}

const highlight = JSON.parse(responseText);

function assertHighlightShape(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Highlight response must be a JSON object keyed by paragraph id.");
  }
  for (const [pid, ranges] of Object.entries(value)) {
    if (!Array.isArray(ranges)) throw new Error(`Paragraph ${pid} must map to an array.`);
    if (ranges.length % 2 !== 0) throw new Error(`Paragraph ${pid} range array must have even length.`);
    for (const item of ranges) {
      if (!Number.isInteger(item) || item < 0) throw new Error(`Paragraph ${pid} contains invalid range value: ${item}`);
    }
  }
}

assertHighlightShape(highlight);

const outDir = "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/experiments/baseline-capture/outputs";
fs.mkdirSync(outDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = path.join(outDir, `${ts}-tillglance-baseline-5new.json`);
const output = {
  capturedAt: new Date().toISOString(),
  endpoint,
  fixturePath,
  contentDict,
  highlight,
  captureLatencyMs: latencyMs
};
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log(`# saved: ${outPath}`);
console.log(`# latencyMs: ${latencyMs}`);
console.log(`# highlight:\n${JSON.stringify(highlight, null, 2)}`);

// 打印每段 span 分布
for (const [pid, arr] of Object.entries(highlight)) {
  const spans = [];
  for (let i = 0; i < arr.length; i += 2) spans.push({ start: arr[i], length: arr[i + 1] });
  const text = contentDict[pid];
  const lengthChars = Array.from(text).length;
  const lengthCounts = {};
  for (const s of spans) lengthCounts[s.length] = (lengthCounts[s.length] || 0) + 1;
  const totalHl = spans.reduce((s, x) => s + x.length, 0);
  console.log(`# p${pid} chars=${lengthChars} spans=${spans.length} lengthDist=${JSON.stringify(lengthCounts)} hlRatio=${((totalHl/lengthChars)*100).toFixed(1)}%`);
}
