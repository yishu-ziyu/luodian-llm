// Round 3 准备: 抓 3 篇新段落（5/6/7）补到 baseline-10shot
import fs from "node:fs";
import path from "node:path";

const fixturePath = "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/scripts/round-3-fixture-extra.json";
const contentDict = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const endpoint = "https://api.tillglance.com/nlphl";

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(contentDict)
});
const responseText = await response.text();
if (!response.ok) throw new Error(`TillGlance failed: ${response.status} ${responseText}`);
const highlight = JSON.parse(responseText);

const outDir = "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/experiments/baseline-capture/outputs";
fs.mkdirSync(outDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = path.join(outDir, `${ts}-tillglance-baseline-3extra.json`);
fs.writeFileSync(outPath, JSON.stringify({
  capturedAt: new Date().toISOString(),
  endpoint,
  fixturePath,
  contentDict,
  highlight
}, null, 2));
console.log(`# saved: ${outPath}`);
console.log(JSON.stringify(highlight, null, 2));

for (const [pid, arr] of Object.entries(highlight)) {
  const spans = []; for (let i = 0; i < arr.length; i += 2) spans.push({ start: arr[i], length: arr[i + 1] });
  const counts = {}; for (const s of spans) counts[s.length] = (counts[s.length] || 0) + 1;
  const pct = ((spans.filter(s => s.length === 2).length / spans.length) * 100).toFixed(0);
  console.log(`# p${pid} spans=${spans.length} length2_ratio=${pct}% dist=${JSON.stringify(counts)}`);
}
