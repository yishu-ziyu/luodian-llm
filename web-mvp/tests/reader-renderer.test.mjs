import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { renderArticleContent } from "../public/reader-renderer.js";

function fixture() {
  const dom = new JSDOM('<article id="reader"></article>');
  return { dom, reader: dom.window.document.querySelector("#reader") };
}

test("renderArticleContent preserves links and highlights across text nodes", () => {
  const { reader } = fixture();
  const article = {
    contentHtml:
      '<p data-reader-paragraph-id="0">开<a href="https://example.com/notes">始链接</a>结束</p>',
    paragraphs: [{ id: "0", text: "开始链接结束" }]
  };

  renderArticleContent(reader, article, { highlight: { "0": [2, 3] }, showHighlight: true });

  assert.equal(reader.querySelector("a")?.getAttribute("href"), "https://example.com/notes");
  assert.equal(
    Array.from(reader.querySelectorAll("mark")).map((mark) => mark.textContent).join(""),
    "链接结"
  );
  assert.equal(reader.textContent, "开始链接结束");
});

test("renderArticleContent can render rich content without presentation marks", () => {
  const { reader } = fixture();
  const article = {
    contentHtml:
      '<p data-reader-paragraph-id="0">正文<a href="https://example.com">来源</a></p><figure><img src="https://example.com/a.jpg" alt="图"></figure>',
    paragraphs: [{ id: "0", text: "正文来源" }]
  };

  renderArticleContent(reader, article, { highlight: { "0": [0, 2] }, showHighlight: false });

  assert.equal(reader.querySelectorAll("mark").length, 0);
  assert.equal(reader.querySelector("img")?.getAttribute("alt"), "图");
  assert.equal(reader.textContent, "正文来源");
});

test("renderArticleContent shows imported content before highlights arrive", () => {
  const { reader } = fixture();
  const article = {
    contentHtml: '<p data-reader-paragraph-id="0">正文</p>',
    paragraphs: [{ id: "0", text: "正文" }]
  };

  assert.doesNotThrow(() => renderArticleContent(reader, article, { highlight: null }));
  assert.equal(reader.textContent, "正文");
});

test("renderArticleContent falls back to paragraphs for local files", () => {
  const { reader } = fixture();
  const article = {
    paragraphs: [
      { id: "0", text: "第一段" },
      { id: "1", text: "第二段" }
    ]
  };

  renderArticleContent(reader, article, { highlight: { "1": [0, 2] }, showHighlight: true });

  assert.equal(reader.querySelectorAll("p").length, 2);
  assert.equal(reader.querySelector("mark")?.textContent, "第二");
});

test("applyHighlightRanges accepts a later range after discarding an overlapping range", () => {
  const { reader } = fixture();
  reader.textContent = "abcdefghijklmnopq";

  renderArticleContent(reader, {
    paragraphs: [{ id: "0", text: "abcdefghijklmnopq" }]
  }, { highlight: { "0": [0, 10, 2, 20, 15, 2] } });

  assert.deepEqual(
    Array.from(reader.querySelectorAll("mark"), (mark) => mark.textContent),
    ["abcdefghij", "pq"]
  );
});

test("renderArticleContent uses Unicode code-point offsets across a link", () => {
  const { reader } = fixture();
  const article = {
    contentHtml: '<p data-reader-paragraph-id="0">甲😀<a href="https://example.com">乙丙</a>丁</p>',
    paragraphs: [{ id: "0", text: "甲😀乙丙丁" }]
  };

  renderArticleContent(reader, article, { highlight: { "0": [1, 3] } });

  assert.equal(Array.from(reader.querySelectorAll("mark"), (mark) => mark.textContent).join(""), "😀乙丙");
  assert.equal(reader.querySelector("a")?.textContent, "乙丙");
  assert.equal(reader.textContent, "甲😀乙丙丁");
});
