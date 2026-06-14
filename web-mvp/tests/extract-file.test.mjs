import test from "node:test";
import assert from "node:assert/strict";
import { importTextFile } from "../src/extract-file.mjs";

test("imports txt content as an ArticleDocument", () => {
  const article = importTextFile({
    filename: "sample.txt",
    text: "第一段\n\n第二段"
  });

  assert.equal(article.sourceType, "file");
  assert.equal(article.title, "sample.txt");
  assert.equal(article.extraction.method, "file");
  assert.equal(article.paragraphs.length, 2);
});

test("rejects unsupported file extensions", () => {
  assert.throws(
    () => importTextFile({ filename: "sample.pdf", text: "正文" }),
    /Only .txt and .md/
  );
});
