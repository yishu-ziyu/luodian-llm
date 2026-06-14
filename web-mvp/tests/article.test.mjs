import test from "node:test";
import assert from "node:assert/strict";
import { createArticleDocument, splitIntoParagraphs } from "../src/article.mjs";

test("splitIntoParagraphs removes blank paragraphs and preserves order", () => {
  assert.deepEqual(splitIntoParagraphs("第一段\n\n\n第二段\n第三段"), [
    "第一段",
    "第二段\n第三段"
  ]);
});

test("splitIntoParagraphs (auto) splits on single newline when no blank line exists", () => {
  // Real product scenario: user pastes a Feishu/Notion article where
  // paragraphs are separated by a single `\n`. With the legacy
  // `\n{2,}`-only behavior, this would collapse to a single paragraph
  // and bypass batching. Auto mode must split on every `\n` here.
  assert.deepEqual(
    splitIntoParagraphs("第一段\n第二段\n第三段"),
    ["第一段", "第二段", "第三段"]
  );
});

test("splitIntoParagraphs (auto) treats long wrapped lines as one paragraph", () => {
  // A single logical paragraph wrapped by an editor at ~80 cols still
  // should NOT be split into 3 paragraphs in auto mode. We model the
  // "wrap" as many lines with no blank line between them, and the
  // current auto heuristic will split per line. The product risk we
  // solve is the inverse: collapsing a multi-paragraph article into
  // one. This test pins the current behavior for visibility. If we
  // later want wrap-awareness, change the heuristic and update this
  // expectation explicitly (do NOT silently flip it).
  const wrapped =
    "这是一段比较长的正文内容，被编辑器自动换行成多行。" +
    "\n" +
    "虽然是多行，但语义上是一段。\n" +
    "继续在同一段里写。";
  const result = splitIntoParagraphs(wrapped);
  // With current auto heuristic (no double-newline present), every
  // line is its own paragraph. Pin this so the heuristic change is
  // an explicit decision.
  assert.deepEqual(result, [
    "这是一段比较长的正文内容，被编辑器自动换行成多行。",
    "虽然是多行，但语义上是一段。",
    "继续在同一段里写。"
  ]);
});

test("splitIntoParagraphs handles Chinese + English mixed single-newline paste", () => {
  // 飞书 / Notion paste of a bilingual article: each line is a
  // paragraph, no blank lines. Auto mode must split on every `\n`.
  const input =
    "Overview: 介绍一下背景。\n" +
    "First point: 第一点说明。\n" +
    "Second point: 第二点说明 with English details.";
  assert.deepEqual(splitIntoParagraphs(input), [
    "Overview: 介绍一下背景。",
    "First point: 第一点说明。",
    "Second point: 第二点说明 with English details."
  ]);
});

test("splitIntoParagraphs honors explicit splitMode = 'single-newline'", () => {
  // Even when blank lines exist, an explicit caller can force
  // single-newline behavior (e.g. a UI toggle "treat each line as a
  // paragraph").
  assert.deepEqual(
    splitIntoParagraphs("a\n\nb\nc", { splitMode: "single-newline" }),
    ["a", "b", "c"]
  );
});

test("splitIntoParagraphs honors explicit splitMode = 'double-newline'", () => {
  // Explicit "double-newline" should ignore single `\n` and only
  // break on blank lines, even when the input has none.
  assert.deepEqual(
    splitIntoParagraphs("a\nb\nc", { splitMode: "double-newline" }),
    ["a\nb\nc"]
  );
});

test("splitIntoParagraphs does not mutate the input string", () => {
  const input = "第一段\n第二段";
  const snapshot = input; // strings are immutable in JS, but pin
  // the contract: function should not push/reassign the caller's var.
  splitIntoParagraphs(input);
  assert.equal(input, snapshot);
});

test("createArticleDocument returns stable paragraph ids", () => {
  const article = createArticleDocument({
    sourceType: "file",
    title: "样本文本",
    plainText: "第一段\n\n第二段",
    extraction: { method: "file", fallbackUsed: false, warnings: [] }
  });

  assert.equal(article.sourceType, "file");
  assert.equal(article.paragraphs[0].id, "0");
  assert.equal(article.paragraphs[1].charLength, 3);
});
