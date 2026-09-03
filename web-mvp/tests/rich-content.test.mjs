import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { sanitizeArticleContent } from "../src/rich-content.mjs";

test("sanitizeArticleContent keeps reader structure while removing active content", () => {
  const result = sanitizeArticleContent(
    `
      <article>
        <h2 style="color:red">章节标题</h2>
        <p onclick="steal()">开始<a href="/notes" onclick="steal()">链接</a>结束<script>alert(1)</script></p>
        <figure>
          <img src="/cover.jpg" srcset="/large.jpg 2x" onerror="steal()" alt="正文配图">
          <figcaption>图片说明</figcaption>
        </figure>
        <p><a href="javascript:alert(1)">危险链接</a></p>
      </article>
    `,
    "https://example.com/story"
  );

  assert.deepEqual(result.paragraphTexts, ["章节标题", "开始链接结束", "图片说明", "危险链接"]);
  assert.match(result.html, /data-reader-paragraph-id="0"/);
  assert.match(result.html, /href="https:\/\/example\.com\/notes"/);
  assert.match(result.html, /src="\/api\/image\?url=https%3A%2F%2Fexample\.com%2Fcover\.jpg"/);
  assert.match(result.html, /loading="lazy"/);
  assert.doesNotMatch(result.html, /script|onclick|onerror|srcset|javascript:/i);
});

test("sanitizeArticleContent unwraps unknown containers without losing readable text", () => {
  const result = sanitizeArticleContent(
    '<div class="article-copy"><p>第一段正文。</p><custom-box>保留的说明</custom-box></div>',
    "https://example.com/"
  );

  assert.equal(result.paragraphTexts[0], "第一段正文。");
  assert.match(result.html, /保留的说明/);
  assert.doesNotMatch(result.html, /custom-box|class=/);
});

test("sanitizeArticleContent keeps DOM text aligned with normalized highlight coordinates", () => {
  const result = sanitizeArticleContent(
    "<p>开始  <a href='/notes'> 链接 </a> 结束</p>",
    "https://example.com/"
  );

  const dom = new JSDOM(result.html);
  assert.equal(result.paragraphTexts[0], "开始 链接 结束");
  assert.equal(dom.window.document.querySelector("p")?.textContent, result.paragraphTexts[0]);
});

test("sanitizeArticleContent rejects fragment-only image sources", () => {
  const result = sanitizeArticleContent('<p>正文</p><img src="#preview" alt="无效图">', "https://example.com/");
  assert.doesNotMatch(result.html, /<img/);
});

test("sanitizeArticleContent preserves safe in-reader fragment targets", () => {
  const result = sanitizeArticleContent(
    '<p><a href="#note">脚注</a></p><h2 id="note">说明</h2>',
    "https://example.com/"
  );

  assert.match(result.html, /href="#reader-anchor-note"/);
  assert.match(result.html, /id="reader-anchor-note"/);
  assert.doesNotMatch(result.html, /href="#reader-anchor-note"[^>]*target=/);
  assert.deepEqual(result.paragraphTexts, ["脚注", "说明"]);
});

test("sanitizeArticleContent assigns every visible structured block exactly once", () => {
  const result = sanitizeArticleContent(
    "<h2>标题</h2><dl><dt>术语</dt><dd>定义</dd></dl><ul><li>父项<ul><li>子项</li></ul></li></ul><table><tr><th>列</th><td>值</td></tr></table>",
    "https://example.com/"
  );

  assert.deepEqual(result.paragraphTexts, ["标题", "术语", "定义", "父项", "子项", "列", "值"]);
  assert.equal(new Set(result.paragraphTexts).size, result.paragraphTexts.length);
});

test("sanitizeArticleContent avoids duplicate text for blockquotes nested in list items", () => {
  const result = sanitizeArticleContent(
    "<ul><li>父项<blockquote>引用</blockquote></li></ul>",
    "https://example.com/"
  );

  assert.deepEqual(result.paragraphTexts, ["父项", "引用"]);
});

test("sanitizeArticleContent keeps preformatted text highlightable without collapsing it", () => {
  const result = sanitizeArticleContent("<pre>  const x = 1;\n  return x;  </pre>", "https://example.com/");
  const dom = new JSDOM(result.html);

  assert.equal(result.paragraphTexts[0], "const x = 1;\n  return x;");
  assert.equal(dom.window.document.querySelector("pre")?.textContent, result.paragraphTexts[0]);
  assert.match(result.html, /data-reader-paragraph-id="0"/);
});
