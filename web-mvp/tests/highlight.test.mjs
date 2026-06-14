import test from "node:test";
import assert from "node:assert/strict";
import { assertHighlightMap, generateMockHighlightMap } from "../src/highlight.mjs";

const paragraphs = [{ id: "0", text: "中文阅读需要视觉落点。", charLength: 11 }];

test("validates legal highlight ranges", () => {
  assert.doesNotThrow(() => assertHighlightMap({ "0": [0, 2, 4, 2] }, paragraphs));
});

test("rejects odd-length range arrays", () => {
  assert.throws(() => assertHighlightMap({ "0": [0, 2, 4] }, paragraphs), /even length/);
});

test("rejects out-of-bounds ranges", () => {
  assert.throws(() => assertHighlightMap({ "0": [10, 2] }, paragraphs), /out of bounds/);
});

test("mock generator returns a valid map", () => {
  const highlight = generateMockHighlightMap(paragraphs, "medium");
  assertHighlightMap(highlight, paragraphs);
});
