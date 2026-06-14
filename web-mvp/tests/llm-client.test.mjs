import test from "node:test";
import assert from "node:assert/strict";
import { generateAiHighlight, loadProviderEnv, resolveLlmConfig } from "../src/llm-client.mjs";
import { assertHighlightMap } from "../src/highlight.mjs";

function parsePromptParagraphs(prompt) {
  // The prompt renders paragraphs in two places: the few-shot examples block
  // (which we want to ignore) and the "Now produce the highlight" footer
  // (which is what the test is asserting on). Slice to the footer first.
  const footerMarker = "## Now produce the highlight for these paragraphs:";
  const footerStart = prompt.indexOf(footerMarker);
  if (footerStart < 0) return [];
  const footer = prompt.slice(footerStart);
  const matches = [...footer.matchAll(/^Paragraph\s+(\S+):\s+(.*)$/gm)];
  return matches.map(([, id, text]) => ({ id, text }));
}

test("generateAiHighlight defaults to deterministic mock provider", async () => {
  const paragraphs = [{ id: "0", index: 0, text: "第一段正文用于测试高亮。", charLength: 12 }];
  const result = await generateAiHighlight({ paragraphs, density: "medium", providerMode: "mock" });

  assert.equal(result.modelInfo.provider, "mock");
  assert.equal(result.modelInfo.model, "mock-semantic-reading-guide");
  assertHighlightMap(result.highlight, paragraphs);
});

test("resolveLlmConfig selects MiniMax when a server key is configured", () => {
  const config = resolveLlmConfig({
    providerMode: "auto",
    env: {
      MINIMAX_TOKEN_PLAN_KEY: "test-token-plan-key",
      MINIMAX_ANTHROPIC_BASE_URL: "https://example.test/anthropic",
      MINIMAX_MODEL: "MiniMax-M3"
    }
  });

  assert.equal(config.provider, "minimax");
  assert.equal(config.model, "MiniMax-M3");
  assert.equal(config.endpoint, "https://example.test/anthropic/v1/messages");
});

test("resolveLlmConfig defaults MiniMax to M3", () => {
  const config = resolveLlmConfig({
    providerMode: "minimax",
    env: { MINIMAX_TOKEN_PLAN_KEY: "test-token-plan-key" }
  });

  assert.equal(config.model, "MiniMax-M3");
});

test("loadProviderEnv lets project env override global provider env", () => {
  const files = new Map([
    ["/home/.config/ai-providers/env.local", "MINIMAX_MODEL=MiniMax-M2.7\nMINIMAX_TOKEN_PLAN_KEY=global-key"],
    ["/project/.env.local", "MINIMAX_MODEL=MiniMax-M3"],
    ["/project/web-mvp/.env.local", ""]
  ]);

  const env = loadProviderEnv({
    env: {},
    envFilePaths: [
      "/home/.config/ai-providers/env.local",
      "/project/.env.local",
      "/project/web-mvp/.env.local"
    ],
    readFileSync: (filePath) => {
      if (!files.has(filePath)) {
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      }
      return files.get(filePath);
    }
  });

  assert.equal(env.MINIMAX_TOKEN_PLAN_KEY, "global-key");
  assert.equal(env.MINIMAX_MODEL, "MiniMax-M3");
});

test("generateAiHighlight calls MiniMax and validates the returned HighlightMap", async () => {
  const paragraphs = [{ id: "0", index: 0, text: "第一段正文用于测试高亮。", charLength: 12 }];
  let capturedRequest;

  const result = await generateAiHighlight({
    paragraphs,
    density: "medium",
    providerMode: "minimax",
    env: {
      MINIMAX_API_KEY: "test-minimax-key",
      MINIMAX_BASE_URL: "https://example.test/anthropic",
      MINIMAX_MODEL: "MiniMax-M3"
    },
    fetchImpl: async (url, options) => {
      capturedRequest = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            model: "MiniMax-M3",
            content: [{ type: "text", text: "{\"highlight\":{\"0\":[0,2,6,2]}}" }],
            usage: { input_tokens: 100, output_tokens: 20 }
          };
        }
      };
    }
  });

  assert.equal(capturedRequest.url, "https://example.test/anthropic/v1/messages");
  assert.equal(capturedRequest.options.headers["X-Api-Key"], "test-minimax-key");
  assert.equal(capturedRequest.options.headers["anthropic-version"], "2023-06-01");
  assert.equal(capturedRequest.body.model, "MiniMax-M3");
  assert.equal(capturedRequest.body.max_tokens, 4096);
  assert.equal(capturedRequest.body.messages[0].role, "user");
  assert.deepEqual(result.highlight, { "0": [0, 2, 6, 2] });
  assert.equal(result.modelInfo.provider, "minimax");
  assert.equal(result.modelInfo.model, "MiniMax-M3");
  assert.equal(result.modelInfo.requestCount, 1);
  assert.equal(result.modelInfo.usage.input_tokens, 100);
});

test("generateAiHighlight batches long MiniMax requests and merges HighlightMaps", async () => {
  const paragraphs = Array.from({ length: 7 }, (_, index) => ({
    id: String(index),
    index,
    text: `第${index + 1}段正文用于测试长文分批高亮。`,
    charLength: Array.from(`第${index + 1}段正文用于测试长文分批高亮。`).length
  }));
  const requestedBatchIds = [];

  const result = await generateAiHighlight({
    paragraphs,
    providerMode: "minimax",
    env: { MINIMAX_API_KEY: "test-minimax-key" },
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      const prompt = body.messages[0].content[0].text;
      const batch = parsePromptParagraphs(prompt);
      requestedBatchIds.push(batch.map((paragraph) => paragraph.id));
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            model: "MiniMax-M3",
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  highlight: Object.fromEntries(batch.map((paragraph) => [paragraph.id, [0, 2]]))
                })
              }
            ],
            usage: { input_tokens: 10, output_tokens: 2 }
          };
        }
      };
    }
  });

  assert.deepEqual(requestedBatchIds, [
    ["0", "1", "2", "3"],
    ["4", "5", "6"]
  ]);
  assert.equal(result.modelInfo.requestCount, 2);
  assert.equal(result.modelInfo.usage.input_tokens, 20);
  assert.deepEqual(Object.keys(result.highlight).sort(), paragraphs.map((paragraph) => paragraph.id));
  assertHighlightMap(result.highlight, paragraphs);
});

test("generateAiHighlight splits a structured-output failure into smaller MiniMax retries", async () => {
  const paragraphs = Array.from({ length: 4 }, (_, index) => ({
    id: String(index),
    index,
    text: `第${index + 1}段正文用于测试失败重试。`,
    charLength: Array.from(`第${index + 1}段正文用于测试失败重试。`).length
  }));
  const requestedBatchIds = [];

  const result = await generateAiHighlight({
    paragraphs,
    providerMode: "minimax",
    env: { MINIMAX_API_KEY: "test-minimax-key" },
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      const prompt = body.messages[0].content[0].text;
      const batch = parsePromptParagraphs(prompt);
      requestedBatchIds.push(batch.map((paragraph) => paragraph.id));

      if (batch.length === 4) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              model: "MiniMax-M3",
              stop_reason: "max_tokens",
              content: [{ type: "thinking", thinking: "no final text" }]
            };
          }
        };
      }

      return {
        ok: true,
        status: 200,
        async json() {
          return {
            model: "MiniMax-M3",
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  highlight: Object.fromEntries(batch.map((paragraph) => [paragraph.id, [0, 2]]))
                })
              }
            ],
            usage: { input_tokens: 10, output_tokens: 2 }
          };
        }
      };
    }
  });

  assert.deepEqual(requestedBatchIds, [
    ["0", "1", "2", "3"],
    ["0", "1"],
    ["2", "3"]
  ]);
  assert.deepEqual(Object.keys(result.highlight).sort(), paragraphs.map((paragraph) => paragraph.id));
  assertHighlightMap(result.highlight, paragraphs);
});

test("generateAiHighlight clips out-of-bounds MiniMax spans instead of falling back to mock", async () => {
  const paragraphs = [{ id: "0", index: 0, text: "第一段", charLength: 3 }];

  // The model produced a span that is clearly out of bounds ([8, 2] for a
  // 3-char paragraph). The current behavior is to clip the bad span in
  // clipHighlightSpans (drop, console.warn) and return an empty valid
  // HighlightMap. We assert (a) the call resolves (does not throw), (b) the
  // result has the bad span removed, and (c) the provider is still minimax
  // — i.e. we did NOT silently fall back to the mock algorithm.
  const result = await generateAiHighlight({
    paragraphs,
    providerMode: "minimax",
    env: { MINIMAX_API_KEY: "test-minimax-key" },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          content: [{ type: "text", text: "{\"highlight\":{\"0\":[8,2]}}" }]
        };
      }
    })
  });

  assert.deepEqual(result.highlight, { "0": [] });
  assert.equal(result.modelInfo.provider, "minimax");
});

test("generateAiHighlight recovers JSON-like MiniMax pair arrays before validation", async () => {
  const paragraphs = [{ id: "0", index: 0, text: "第一段正文用于测试高亮。", charLength: 12 }];
  const result = await generateAiHighlight({
    paragraphs,
    providerMode: "minimax",
    env: { MINIMAX_API_KEY: "test-minimax-key" },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          model: "MiniMax-M3",
          content: [{ type: "text", text: "{\"highlight\":{\"0\":[[0,2],[6,2]}}" }]
        };
      }
    })
  });

  assert.deepEqual(result.highlight, { "0": [0, 2, 6, 2] });
});
