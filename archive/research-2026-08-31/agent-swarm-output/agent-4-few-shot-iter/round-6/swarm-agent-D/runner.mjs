// Agent D runner: test English text on Chinese-biased prompt
import fs from "node:fs";
import path from "node:path";
import { ENGLISH_TEXTS } from "./test-corpus-english.mjs";

const BASE_URL = process.env.WEB_MVP_URL || "http://localhost:4173";
const OUT_DIR = "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/round-6/swarm-agent-D";
const RAW_DIR = path.join(OUT_DIR, "raw");
const SLEEP_MS = 1500;

async function importParagraph(par) {
  const body = JSON.stringify({ filename: `${par.id}.txt`, text: par.text });
  const r = await fetch(`${BASE_URL}/api/import/file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  });
  if (!r.ok) throw new Error(`import failed ${r.status}: ${await r.text()}`);
  const json = await r.json();
  return json.article.paragraphs[0];
}

async function compareOne(par) {
  const paragraph = await importParagraph(par);
  const body = JSON.stringify({ paragraphs: [paragraph], density: "medium" });
  const r = await fetch(`${BASE_URL}/api/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  });
  const rawText = await r.text();
  let json = null;
  try { json = JSON.parse(rawText); } catch {}
  return { paragraph, status: r.status, rawText, json };
}

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const startedAt = new Date().toISOString();
  console.log(`# Agent D start ${startedAt} → ${ENGLISH_TEXTS.length} English paragraphs → ${BASE_URL}`);
  const allResults = [];
  for (const [i, par] of ENGLISH_TEXTS.entries()) {
    process.stdout.write(`[${String(i + 1).padStart(2)}/${ENGLISH_TEXTS.length}] ${par.id} (${par.category}, ${par.text.length} chars) ... `);
    try {
      const r = await compareOne(par);
      const rawPath = path.join(RAW_DIR, `${par.id}.json`);
      fs.writeFileSync(rawPath, JSON.stringify({
        id: par.id,
        category: par.category,
        text: par.text,
        charLength: r.paragraph?.charLength,
        status: r.status,
        requestBody: { paragraphs: [{ id: r.paragraph?.id, text: par.text, charLength: r.paragraph?.charLength }], density: "medium" },
        response: r.json,
        rawTextSnippet: r.rawText.slice(0, 800)
      }, null, 2));
      if (r.status !== 200) {
        console.log(`HTTP ${r.status}`);
        allResults.push({ id: par.id, category: par.category, text: par.text, charLength: r.paragraph?.charLength, status: r.status, error: r.rawText.slice(0, 200) });
      } else {
        const ai = r.json?.aiHighlight?.[r.paragraph.id] || null;
        const bl = r.json?.baselineHighlight?.[r.paragraph.id] || null;
        const m = r.json?.metrics;
        console.log(`HTTP 200 aiLen=${ai?.length || 0} blLen=${bl?.length || 0} hit=${m?.positionHitRate ? (m.positionHitRate*100).toFixed(0)+"%" : "?"} den=${m?.aiDensity ? (m.aiDensity*100).toFixed(0)+"%" : "?"}`);
        allResults.push({
          id: par.id, category: par.category, text: par.text,
          charLength: r.paragraph?.charLength,
          baseline: bl, ai, metrics: m,
          modelInfo: r.json?.modelInfo, baselineInfo: r.json?.baselineInfo
        });
      }
    } catch (e) {
      console.log(`THROW: ${e.message.slice(0, 120)}`);
      allResults.push({ id: par.id, category: par.category, text: par.text, error: e.message });
    }
    if (i < ENGLISH_TEXTS.length - 1) await new Promise((r) => setTimeout(r, SLEEP_MS));
  }
  fs.writeFileSync(path.join(OUT_DIR, "all-results.json"), JSON.stringify(allResults, null, 2));
  console.log(`\n# saved → ${path.join(OUT_DIR, "all-results.json")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });