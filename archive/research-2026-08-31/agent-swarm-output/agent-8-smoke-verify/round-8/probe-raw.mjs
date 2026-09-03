// Agent 8 round-8 — diagnostic probe: capture the raw request body + raw
// response for one thinking-block failure so we can document what
// MiniMax actually returned when thinking:disabled is sent.
//
// Read-only. Writes to /tmp/agent-8-probe-*.json (not in repo).

import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..", "..");
const WEB_MVP_SRC = path.join(ROOT, "web-mvp", "src");

const articleMod = await import(pathToFileURL(path.join(WEB_MVP_SRC, "article.mjs")).href);
const llmClientMod = await import(pathToFileURL(path.join(WEB_MVP_SRC, "llm-client.mjs")).href);

const { splitIntoParagraphs } = articleMod;
const { generateAiHighlight } = llmClientMod;

// Use a multi-paragraph 5-segment ZH text similar to one that failed.
const text =
  "Docker 镜像由多层只读层组成，每一层对应 Dockerfile 里的一条指令。\n" +
  "容器启动时会在镜像之上加一层可写层，所有运行时变更都落在这层。\n" +
  "这种分层结构让镜像复用和分发都变得高效。\n" +
  "开发者之间共享基础镜像时，只需增量推送变更的层。\n" +
  "CI 系统缓存这些层之后，构建速度会显著提升。";

const parts = splitIntoParagraphs(text, { splitMode: "auto" });
const paragraphs = parts.map((t, i) => ({
  id: String(i),
  index: i,
  text: t,
  charLength: Array.from(t).length
}));

// Wrap fetch to capture the body and raw response.
let capturedRequest = null;
let capturedResponse = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const body = options?.body;
  if (typeof body === "string") {
    try {
      capturedRequest = JSON.parse(body);
    } catch {
      capturedRequest = body;
    }
  }
  const response = await realFetch(url, options);
  const cloned = response.clone();
  const text2 = await cloned.text();
  try {
    capturedResponse = JSON.parse(text2);
  } catch {
    capturedResponse = { _raw: text2.slice(0, 5000) };
  }
  // Re-wrap the cloned response so the consumer can still call .json()
  return new Response(text2, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
};

const startedAt = Date.now();
let result;
let error;
try {
  result = await generateAiHighlight({
    paragraphs,
    density: "medium",
    providerMode: "minimax"
  });
} catch (e) {
  error = e;
}
const elapsed = Date.now() - startedAt;
console.log(`elapsed: ${(elapsed / 1000).toFixed(2)}s`);
console.log(`error: ${error ? error.message : "(none)"}`);
if (result) {
  console.log(`result: model=${result.modelInfo?.model} latencyMs=${result.modelInfo?.latencyMs} requestCount=${result.modelInfo?.requestCount}`);
}

// Save captured request + response.
if (capturedRequest) {
  fs.writeFileSync("/tmp/agent-8-probe-request.json", JSON.stringify(capturedRequest, null, 2));
  console.log(`request body length: ${JSON.stringify(capturedRequest).length} chars`);
}
if (capturedResponse) {
  // Strip thinking block content to keep file small, but preserve structure.
  if (Array.isArray(capturedResponse.content)) {
    for (const b of capturedResponse.content) {
      if (b.type === "thinking" && typeof b.thinking === "string") {
        b.thinking = `<<THINKING length=${b.thinking.length}>>` + b.thinking.slice(0, 200) + "<<...truncated...>>";
      }
    }
  }
  fs.writeFileSync("/tmp/agent-8-probe-response.json", JSON.stringify(capturedResponse, null, 2));
  console.log(`response written to /tmp/agent-8-probe-response.json`);

  console.log("\nresponse structure:");
  if (Array.isArray(capturedResponse.content)) {
    for (const [i, b] of capturedResponse.content.entries()) {
      const len = typeof b.thinking === "string" && b.thinking.startsWith("<<THINKING length=")
        ? b.thinking.match(/length=(\d+)/)?.[1]
        : typeof b.text === "string" ? b.text.length : 0;
      console.log(`  block[${i}]: type=${b.type}  content_length=${len}  has_signature=${!!b.signature}`);
    }
  } else {
    console.log(`  no content array: ${JSON.stringify(capturedResponse).slice(0, 500)}`);
  }
  console.log(`stop_reason: ${capturedResponse.stop_reason}`);
  console.log(`usage: ${JSON.stringify(capturedResponse.usage)}`);
}
