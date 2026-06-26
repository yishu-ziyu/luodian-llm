import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { importTextFile } from "./src/extract-file.mjs";
import { extractUrlArticle } from "./src/extract-url.mjs";
import { saveReadingExperiment } from "./src/experiments.mjs";
import { generateAiHighlight } from "./src/llm-client.mjs";
import { computeHighlightMetrics } from "./src/compare-metrics.mjs";
import { generateMockHighlightMap } from "./src/highlight.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(moduleDir, "public");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4173);

const contentTypeByExtension = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

async function serveStatic(requestUrl, response) {
  const url = new URL(requestUrl, "http://localhost");
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname === "/compare" ? "/compare.html" : url.pathname;
  const allowedFiles = new Set(["/index.html", "/compare.html", "/styles.css", "/app.js", "/compare-app.js"]);

  if (!allowedFiles.has(pathname)) {
    sendError(response, 404, "Not found.");
    return;
  }

  const filePath = path.join(publicDir, pathname.slice(1));
  const content = await fs.readFile(filePath);
  response.statusCode = 200;
  response.setHeader("Content-Type", contentTypeByExtension[path.extname(filePath)] || "text/plain");
  response.end(content);
}

async function handleApiRequest(request, response, options) {
  const url = new URL(request.url, "http://localhost");

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method !== "POST") {
    sendError(response, 405, "Method not allowed.");
    return;
  }

  const body = await readJsonBody(request);

  if (url.pathname === "/api/import/file") {
    const article = importTextFile({ filename: body.filename, text: body.text });
    sendJson(response, 200, { article });
    return;
  }

  if (url.pathname === "/api/import/url") {
    const article = await extractUrlArticle(body.url);
    sendJson(response, 200, { article });
    return;
  }

  if (url.pathname === "/api/highlight") {
    const highlightGenerator = options.highlightGenerator || generateAiHighlight;
    const enableFallback = url.searchParams.get("enableFallback") !== "false";
    const result = await highlightGenerator({
      paragraphs: body.paragraphs || [],
      density: body.density || "medium",
      fallbackOnFailure: enableFallback
    });
    sendJson(response, 200, result);
    return;
  }

  if (url.pathname === "/api/compare") {
    const paragraphs = body.paragraphs || [];
    const baselineGenerator = options.baselineGenerator || generateReferenceBaseline;
    const highlightGenerator = options.highlightGenerator || generateAiHighlight;
    const [baselineResult, aiResult] = await Promise.all([
      baselineGenerator({ paragraphs }),
      highlightGenerator({
        paragraphs,
        density: body.density || "medium"
      })
    ]);
    const metrics = computeHighlightMetrics({
      paragraphs,
      baselineHighlight: baselineResult.highlight,
      aiHighlight: aiResult.highlight
    });

    const saved = body.article
      ? await saveReadingExperiment({
          article: body.article,
          aiHighlight: aiResult.highlight,
          baselineHighlight: baselineResult.highlight,
          baselineInfo: baselineResult.baselineInfo,
          metrics,
          modelInfo: aiResult.modelInfo,
          outputDir: options.experimentOutputDir
        })
      : null;

    sendJson(response, 200, {
      baselineHighlight: baselineResult.highlight,
      aiHighlight: aiResult.highlight,
      baselineInfo: baselineResult.baselineInfo,
      modelInfo: aiResult.modelInfo,
      metrics,
      ...(saved
        ? {
            experiment: saved.experiment,
            path: saved.path
          }
        : {})
    });
    return;
  }

  if (url.pathname === "/api/experiments") {
    const saved = await saveReadingExperiment({
      article: body.article,
      aiHighlight: body.aiHighlight,
      baselineHighlight: body.baselineHighlight,
      baselineInfo: body.baselineInfo,
      metrics: body.metrics,
      modelInfo: body.modelInfo,
      outputDir: options.experimentOutputDir
    });
    sendJson(response, 200, saved);
    return;
  }

  sendError(response, 404, "Not found.");
}

export async function handleWebMvpRequest(request, response, options = {}) {
  try {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      await handleApiRequest(request, response, options);
      return;
    }

    await serveStatic(request.url, response);
  } catch (error) {
    sendError(response, 500, error.message || "Unexpected server error.");
  }
}

export function createWebMvpServer(options = {}) {
  return http.createServer((request, response) => {
    handleWebMvpRequest(request, response, options);
  });
}

async function generateReferenceBaseline({ paragraphs, density = "medium" }) {
  return {
    highlight: generateMockHighlightMap(paragraphs, density),
    baselineInfo: {
      provider: "reference-mock",
      model: "saccade-reference-algorithm",
      notes: "Deterministic step-based reference used as a structural baseline; the AI provider should be evaluated against an independent ground truth, not this mock."
    }
  };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  createWebMvpServer().listen(port, host, () => {
    console.log(`Web MVP listening on http://localhost:${port}`);
  });
}
