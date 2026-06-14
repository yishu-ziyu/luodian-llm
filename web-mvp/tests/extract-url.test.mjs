import test from "node:test";
import assert from "node:assert/strict";
import { extractUrlArticle, scoreExtractedText } from "../src/extract-url.mjs";

function okHtmlResponse(html) {
  return {
    ok: true,
    status: 200,
    text: async () => html
  };
}

test("scoreExtractedText grades longer text higher", () => {
  assert.equal(scoreExtractedText("短文本"), 0);
  assert.equal(scoreExtractedText("甲".repeat(130)), 1);
  assert.equal(scoreExtractedText("甲".repeat(330)), 2);
  assert.equal(scoreExtractedText("甲".repeat(830)), 3);
});

test("rejects non-http urls", async () => {
  await assert.rejects(
    () => extractUrlArticle("file:///tmp/article.html"),
    /Only http and https/
  );
});

test("rejects localhost and private network urls before fetching", async () => {
  let fetched = false;
  const fetchImpl = async () => {
    fetched = true;
    return okHtmlResponse("<article>unused</article>");
  };

  await assert.rejects(
    () => extractUrlArticle("http://localhost:8080/story", { fetchImpl }),
    /private or local network/
  );
  await assert.rejects(
    () => extractUrlArticle("http://127.0.0.1/story", { fetchImpl }),
    /private or local network/
  );

  assert.equal(fetched, false);
});

test("rejects hostnames that resolve to private network addresses", async () => {
  await assert.rejects(
    () =>
      extractUrlArticle("https://example.com/story", {
        fetchImpl: async () => okHtmlResponse("<article>unused</article>"),
        lookupImpl: async () => [{ address: "192.168.1.10", family: 4 }]
      }),
    /private or local network/
  );
});

test("selects Defuddle when primary extraction is good enough", async () => {
  const article = await extractUrlArticle("https://example.com/story", {
    fetchImpl: async () => okHtmlResponse("<article>unused</article>"),
    defuddleImpl: async () => ({
      title: "Defuddle title",
      content: `<article>${"正文".repeat(180)}</article>`
    })
  });

  assert.equal(article.sourceType, "url");
  assert.equal(article.title, "Defuddle title");
  assert.equal(article.extraction.method, "defuddle");
  assert.equal(article.extraction.fallbackUsed, false);
});

test("selects Readability fallback when Defuddle output is too short", async () => {
  const article = await extractUrlArticle("https://example.com/story", {
    fetchImpl: async () => okHtmlResponse("<article>unused</article>"),
    defuddleImpl: async () => ({
      title: "Defuddle title",
      content: "<p>短</p>"
    }),
    readabilityImpl: () => ({
      title: "Readability title",
      textContent: "可读正文".repeat(120)
    })
  });

  assert.equal(article.title, "Readability title");
  assert.equal(article.extraction.method, "readability");
  assert.equal(article.extraction.fallbackUsed, true);
  assert.match(article.extraction.warnings[0], /Defuddle output was too short/);
});
