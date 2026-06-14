import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { Defuddle } from "defuddle/node";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "../..");
const bakeoffDir = path.join(projectRoot, "experiments/url-extraction-bakeoff");
const urlsPath = path.join(bakeoffDir, "urls.json");
const outputRoot = path.join(bakeoffDir, "outputs");
const userAgent =
  "SaccadeUrlExtractionBakeoff/0.1 (+local user-initiated research)";
const noisePatterns = [
  "advertisement",
  "cookie",
  "privacy policy",
  "terms of service",
  "sign in",
  "subscribe",
  "share this",
  "skip to",
  "navigation",
  "广告",
  "登录",
  "注册",
  "订阅",
  "分享",
  "版权",
  "隐私",
  "导航",
];

function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function htmlToText(html) {
  const dom = new JSDOM(`<main>${html || ""}</main>`);
  return normalizeText(dom.window.document.body.textContent || "");
}

function countCjk(text) {
  return (text.match(/[\u3400-\u9fff]/g) || []).length;
}

function countNoise(text) {
  const lower = text.toLowerCase();
  return noisePatterns.reduce((count, pattern) => {
    return count + (lower.match(new RegExp(escapeRegExp(pattern), "g")) || []).length;
  }, 0);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function preview(text, length = 420) {
  const normalized = normalizeText(text).replace(/\n/g, " ");
  return normalized.length <= length ? normalized : `${normalized.slice(0, length)}...`;
}

function scoreExtraction(text) {
  const normalized = normalizeText(text);
  const charCount = normalized.length;
  const blankLineParagraphs = normalized
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 40);
  const lineParagraphs = normalized
    .split(/\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 40);
  const paragraphs =
    blankLineParagraphs.length >= 2 ? blankLineParagraphs : lineParagraphs;
  const lineCount = normalized.split(/\n+/).filter(Boolean).length;
  const cjkCount = countCjk(normalized);
  const noiseHits = countNoise(normalized);
  const noisePerThousand = charCount ? (noiseHits / charCount) * 1000 : 20;

  const lengthScore = Math.min(charCount / 2600, 1) * 35;
  const paragraphScore = Math.min(paragraphs.length / 8, 1) * 25;
  const lineScore = Math.min(lineCount / 18, 1) * 10;
  const cjkBonus = cjkCount > 100 ? 5 : 0;
  const noisePenalty = Math.min(noisePerThousand * 8, 25);
  const score = Math.max(0, Math.round(lengthScore + paragraphScore + lineScore + cjkBonus - noisePenalty));

  return {
    score,
    charCount,
    paragraphCount: paragraphs.length,
    lineCount,
    cjkCount,
    noiseHits,
    noisePerThousand: Number(noisePerThousand.toFixed(2)),
    usable: charCount >= 500 && paragraphs.length >= 2,
  };
}

async function fetchHtml(url) {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });
    const html = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      html,
      ms: Math.round(performance.now() - startedAt),
      error: response.ok ? "" : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      html: "",
      ms: Math.round(performance.now() - startedAt),
      error: `${error.name}: ${error.message}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function extractReadability(html, url) {
  const startedAt = performance.now();
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document.cloneNode(true));
    const article = reader.parse();
    const text = normalizeText(article?.textContent || "");
    return {
      ok: Boolean(text),
      title: article?.title || "",
      text,
      ms: Math.round(performance.now() - startedAt),
      error: text ? "" : "No article text",
    };
  } catch (error) {
    return {
      ok: false,
      title: "",
      text: "",
      ms: Math.round(performance.now() - startedAt),
      error: `${error.name}: ${error.message}`,
    };
  }
}

async function extractDefuddle(html, url) {
  const startedAt = performance.now();
  try {
    const result = await Defuddle(html, url, { markdown: true, removeImages: true });
    const text = normalizeText(htmlToText(result.content || result.contentMarkdown || ""));
    return {
      ok: Boolean(text),
      title: result.title || "",
      text,
      ms: Math.round(performance.now() - startedAt),
      error: text ? "" : "No article text",
    };
  } catch (error) {
    return {
      ok: false,
      title: "",
      text: "",
      ms: Math.round(performance.now() - startedAt),
      error: `${error.name}: ${error.message}`,
    };
  }
}

function buildExtractionResult(extractor, extraction) {
  const text = normalizeText(extraction.text);
  return {
    extractor,
    ok: extraction.ok,
    title: extraction.title,
    error: extraction.error,
    ms: extraction.ms,
    ...scoreExtraction(text),
    preview: preview(text),
    text,
  };
}

function runTrafilatura(inputs, outputDir) {
  if (!inputs.length) {
    return new Map();
  }

  const scriptPath = path.join(bakeoffDir, "scripts/extract-trafilatura.py");
  let tempDir = "";

  return fs
    .mkdtemp(path.join(os.tmpdir(), "saccade-trafilatura-"))
    .then((dir) => {
      tempDir = dir;
      const inputPath = path.join(tempDir, "input.json");
      const outputPath = path.join(tempDir, "output.json");
      return fs.writeFile(inputPath, `${JSON.stringify(inputs, null, 2)}\n`, "utf8").then(() => ({
        inputPath,
        outputPath,
      }));
    })
    .then(({ inputPath, outputPath }) => {
      const run = spawnSync(
        "uv",
        ["run", "--with", "trafilatura", "python", scriptPath, inputPath, outputPath],
        {
          cwd: projectRoot,
          encoding: "utf8",
          maxBuffer: 10 * 1024 * 1024,
        },
      );

      if (run.status !== 0) {
        const errorText = `${run.stderr || run.stdout || "uv trafilatura run failed"}`.trim();
        return new Map(
          inputs.map((item) => [
            item.id,
            {
              ok: false,
              title: "",
              text: "",
              ms: 0,
              error: errorText,
            },
          ]),
        );
      }

      return fs.readFile(outputPath, "utf8").then((raw) => {
        const parsed = JSON.parse(raw);
        return new Map(
          parsed.map((item) => [
            item.id,
            {
              ok: item.ok,
              title: item.title || "",
              text: item.text || "",
              ms: 0,
              error: item.error || "",
            },
          ]),
        );
      });
    })
    .finally(() => {
      if (tempDir) {
        return fs.rm(tempDir, { recursive: true, force: true });
      }
    });
}

function chooseWinner(extractions) {
  const usable = extractions.filter((item) => item.ok && item.usable);
  const candidates = usable.length ? usable : extractions.filter((item) => item.ok);
  if (!candidates.length) {
    return "";
  }
  return candidates.toSorted((a, b) => b.score - a.score)[0].extractor;
}

function countWins(results) {
  const wins = { readability: 0, defuddle: 0, trafilatura: 0, none: 0 };
  for (const result of results) {
    wins[result.best || "none"] += 1;
  }
  return wins;
}

function buildSummary({ runId, results, fetchFailures, wins }) {
  const lines = [
    `# URL Extraction Bake-Off Summary`,
    "",
    `Run: \`${runId}\``,
    "",
    "## Overall",
    "",
    `- URLs tested: ${results.length}`,
    `- Fetch failures: ${fetchFailures.length}`,
    `- Readability wins: ${wins.readability}`,
    `- Defuddle wins: ${wins.defuddle}`,
    `- Trafilatura wins: ${wins.trafilatura}`,
    `- No winner: ${wins.none}`,
    "",
    "Scores are heuristic: length, paragraph structure, and low boilerplate. Manual reading QA is still required before product decisions.",
    "",
    "## Matrix",
    "",
    "| URL | Category | Fetch | Readability | Defuddle | Trafilatura | Heuristic best |",
    "|---|---:|---:|---:|---:|---:|---|",
  ];

  for (const item of results) {
    const byName = Object.fromEntries(item.extractions.map((entry) => [entry.extractor, entry]));
    lines.push(
      `| ${item.label} | ${item.category} | ${item.fetch.ok ? `${item.fetch.status}/${item.fetch.ms}ms` : item.fetch.error} | ${formatCell(byName.readability)} | ${formatCell(byName.defuddle)} | ${formatCell(byName.trafilatura)} | ${item.best || "none"} |`,
    );
  }

  lines.push("", "## Failure Notes", "");
  if (!fetchFailures.length) {
    lines.push("- No fetch failures.");
  } else {
    for (const item of fetchFailures) {
      lines.push(`- ${item.label}: ${item.fetch.error}`);
    }
  }

  lines.push(
    "",
    "## Product Notes",
    "",
    "- Server-side URL import should use a mature extractor instead of custom DOM scraping.",
    "- Any extractor can fail on dynamic, login-only, or anti-bot pages; these should fall back to a user-triggered browser extension path.",
    "- Do not use private, paid, unpublished, login-only, or sensitive pages in this server-side bake-off.",
  );

  return `${lines.join("\n")}\n`;
}

function formatCell(entry) {
  if (!entry) {
    return "missing";
  }
  if (!entry.ok) {
    return `fail: ${entry.error.replace(/\|/g, "/").slice(0, 60)}`;
  }
  return `${entry.score} (${entry.charCount} chars, ${entry.paragraphCount} paras)`;
}

async function main() {
  const runId = timestampForPath();
  const outputDir = path.join(outputRoot, runId);
  await fs.mkdir(outputDir, { recursive: true });

  const urls = JSON.parse(await fs.readFile(urlsPath, "utf8"));
  const pageResults = [];
  const trafilaturaInputs = [];

  for (const sample of urls) {
    console.log(`fetch ${sample.id}`);
    const fetchResult = await fetchHtml(sample.url);
    const item = {
      ...sample,
      fetch: {
        ok: fetchResult.ok,
        status: fetchResult.status,
        finalUrl: fetchResult.finalUrl,
        htmlBytes: Buffer.byteLength(fetchResult.html || "", "utf8"),
        ms: fetchResult.ms,
        error: fetchResult.error,
      },
      extractions: [],
      best: "",
    };

    if (fetchResult.ok && fetchResult.html) {
      const [readability, defuddle] = await Promise.all([
        extractReadability(fetchResult.html, fetchResult.finalUrl),
        extractDefuddle(fetchResult.html, fetchResult.finalUrl),
      ]);
      item.extractions.push(buildExtractionResult("readability", readability));
      item.extractions.push(buildExtractionResult("defuddle", defuddle));
      trafilaturaInputs.push({
        id: sample.id,
        url: fetchResult.finalUrl,
        html: fetchResult.html,
      });
    }

    pageResults.push(item);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const trafilaturaResults = await runTrafilatura(trafilaturaInputs, outputDir);
  for (const item of pageResults) {
    if (item.fetch.ok) {
      const result = trafilaturaResults.get(item.id) || {
        ok: false,
        title: "",
        text: "",
        ms: 0,
        error: "Missing trafilatura result",
      };
      item.extractions.push(buildExtractionResult("trafilatura", result));
      item.best = chooseWinner(item.extractions);
    }
  }

  const publicResults = pageResults.map((item) => ({
    ...item,
    extractions: item.extractions.map((entry) => {
      const { text, ...withoutText } = entry;
      return withoutText;
    }),
  }));
  const wins = countWins(publicResults);
  const fetchFailures = publicResults.filter((item) => !item.fetch.ok);

  await fs.writeFile(
    path.join(outputDir, "results.json"),
    `${JSON.stringify(publicResults, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(outputDir, "summary.md"),
    buildSummary({ runId, results: publicResults, fetchFailures, wins }),
    "utf8",
  );

  console.log(path.join(outputDir, "summary.md"));
}

await main();
