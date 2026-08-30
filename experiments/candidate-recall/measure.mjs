import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createHighlightCandidates } from "../../extension/core/highlight-engine.ts";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const gold = JSON.parse(await fs.readFile(path.join(moduleDir, "gold.json"), "utf8"));
const genericWords = new Set([
  "我们", "关于", "之前", "之后", "目前", "现在", "今天", "这里", "这些", "一些",
  "部分", "前部分", "后半部", "后半部分", "内容", "方面", "情况", "时候", "正好",
  "出来", "进行", "相关", "通过", "主要是", "如何", "试着", "看看"
]);
const knownBadBoundaries = new Set(["后半部", "性的", "到底有", "前部分"]);

function normalize(value) {
  return String(value)
    .toLowerCase()
    .replace(/[\s「」『』“”‘’《》〈〉【】()[\]（）]/g, "")
    .replace(/[，。；：、！？,.!?;:]/g, "");
}

const paragraphResults = gold.paragraphs.map((paragraph) => {
  const candidates = createHighlightCandidates(paragraph.text);
  const candidateTexts = new Set(candidates.map((candidate) => normalize(candidate.text)));
  const found = paragraph.gold.filter((phrase) => candidateTexts.has(normalize(phrase)));
  const missing = paragraph.gold.filter((phrase) => !candidateTexts.has(normalize(phrase)));
  return {
    id: paragraph.id,
    textLength: paragraph.text.length,
    goldCount: paragraph.gold.length,
    candidateCount: candidates.length,
    found,
    missing,
    genericCount: candidates.filter((candidate) => genericWords.has(candidate.text)).length,
    knownBadBoundaryCount: candidates.filter((candidate) => knownBadBoundaries.has(candidate.text)).length
  };
});

const totals = paragraphResults.reduce((sum, paragraph) => ({
  textLength: sum.textLength + paragraph.textLength,
  goldCount: sum.goldCount + paragraph.goldCount,
  foundCount: sum.foundCount + paragraph.found.length,
  candidateCount: sum.candidateCount + paragraph.candidateCount,
  genericCount: sum.genericCount + paragraph.genericCount,
  knownBadBoundaryCount: sum.knownBadBoundaryCount + paragraph.knownBadBoundaryCount
}), { textLength: 0, goldCount: 0, foundCount: 0, candidateCount: 0, genericCount: 0, knownBadBoundaryCount: 0 });

const report = {
  source: gold.source,
  measuredAt: new Date().toISOString(),
  metrics: {
    exactPhraseRecall: totals.foundCount / totals.goldCount,
    foundCount: totals.foundCount,
    goldCount: totals.goldCount,
    genericCandidateRate: totals.genericCount / Math.max(totals.candidateCount, 1),
    knownBadBoundaryRate: totals.knownBadBoundaryCount / Math.max(totals.candidateCount, 1),
    candidatesPer100Chars: totals.candidateCount / totals.textLength * 100,
    candidateCount: totals.candidateCount,
    textLength: totals.textLength
  },
  paragraphs: paragraphResults
};

const outputIndex = process.argv.indexOf("--output");
if (outputIndex >= 0 && process.argv[outputIndex + 1]) {
  await fs.writeFile(path.resolve(process.argv[outputIndex + 1]), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(report, null, 2));
