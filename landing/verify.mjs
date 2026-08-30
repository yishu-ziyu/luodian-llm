import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { JSDOM } from "jsdom";

const landingDir = path.dirname(fileURLToPath(import.meta.url));
const source = await fs.readFile(path.join(landingDir, "index.html"), "utf8");
const document = new JSDOM(source).window.document;

assert.equal(document.documentElement.lang, "zh-CN");
assert.equal(document.title, "落点 · 原页高亮 Chrome 插件");
assert.equal(document.querySelector("h1")?.textContent?.trim(), "让眼睛更快找到重点。");
assert.deepEqual(
  Array.from(document.querySelectorAll(".hero-line"), (element) => element.textContent?.trim()),
  ["让眼睛更快", "找到重点。"]
);
assert.deepEqual(
  Array.from(document.querySelectorAll(".article-title-line"), (element) => element.textContent?.trim()),
  ["先看见结构，", "再进入细读。"]
);
assert.match(document.body.textContent || "", /阅读效率/);
assert.match(document.body.textContent || "", /主题、判断和因果关系/);
assert.ok(document.querySelector("#demo-toggle"), "landing page must include the live highlight demo");
assert.equal(document.querySelector("#demo-toggle")?.getAttribute("aria-pressed"), "true");
assert.ok(document.querySelector("#install"), "landing page must include a truthful install path");
assert.match(document.body.textContent || "", /重新编译/);
assert.doesNotMatch(source, /\{\{|TBD|TODO|Lorem ipsum/);

for (const element of document.querySelectorAll("img[src], link[href]")) {
  const reference = element.getAttribute(element.hasAttribute("src") ? "src" : "href");
  if (!reference || reference.startsWith("#") || /^https?:/.test(reference)) continue;
  const localPath = path.resolve(landingDir, reference);
  await fs.access(localPath);
}

for (const element of document.querySelectorAll("script[src], iframe[src]")) {
  const reference = element.getAttribute("src") || "";
  assert.ok(!/^https?:/.test(reference), "landing runtime must not depend on remote resources");
}

console.log(JSON.stringify({
  title: document.title,
  sections: document.querySelectorAll("main > section").length,
  assets: Array.from(document.querySelectorAll("img[src], link[href]"))
    .map((element) => element.getAttribute(element.hasAttribute("src") ? "src" : "href"))
    .filter((value) => value?.startsWith("./"))
}));

const holoSource = await fs.readFile(path.join(landingDir, "hololaunch.html"), "utf8");
const holoDocument = new JSDOM(holoSource).window.document;
assert.equal(holoDocument.title, "落点 · Holo 风格实验");
assert.equal(holoDocument.querySelector(".metric-value")?.textContent?.trim(), "90.6%");
assert.deepEqual(
  Array.from(holoDocument.querySelectorAll(".hero-line"), (element) => element.textContent?.trim()),
  ["把每一次阅读，", "变成更快的理解。"]
);
assert.equal(holoDocument.querySelector("#reading-toggle")?.getAttribute("aria-pressed"), "true");
assert.equal(holoDocument.querySelectorAll("[data-panel]").length, 2);
assert.match(holoSource, /attention-field-v2\.png/);
await fs.access(path.join(landingDir, "assets", "attention-field-v2.png"));
assert.doesNotMatch(holoSource, /<canvas|#focus-field|#2c24c8|#171472/);
assert.doesNotMatch(holoSource, /\{\{|TBD|TODO|Lorem ipsum/);
assert.doesNotMatch(holoSource, /hololaunch\.ai|dxtd9akq5mtw7/);
