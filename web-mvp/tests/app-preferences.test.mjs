import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const publicDir = path.resolve("web-mvp/public");
const appUrl = pathToFileURL(path.join(publicDir, "app.js"));

async function loadApp(savedPreferences = null) {
  const html = await fs.readFile(path.join(publicDir, "index.html"), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost:4173/" });
  if (savedPreferences) dom.window.localStorage.setItem("saccade-reader-preferences-v1", savedPreferences);
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.localStorage = dom.window.localStorage;
  await import(`${appUrl.href}?test=${crypto.randomUUID()}`);
  return dom;
}

test("reader preference controls apply immediately and restore after reload", async () => {
  const first = await loadApp();
  const bold = first.window.document.querySelector('input[value="bold"]');
  const fontSize = first.window.document.querySelector("#font-size-input");
  const lineHeight = first.window.document.querySelector("#line-height-input");
  const measure = first.window.document.querySelector("#measure-input");
  bold.checked = true;
  bold.dispatchEvent(new first.window.Event("input", { bubbles: true }));
  fontSize.value = "24";
  fontSize.dispatchEvent(new first.window.Event("input", { bubbles: true }));
  lineHeight.value = "2";
  lineHeight.dispatchEvent(new first.window.Event("input", { bubbles: true }));
  measure.value = "76";
  measure.dispatchEvent(new first.window.Event("input", { bubbles: true }));

  const firstReader = first.window.document.querySelector("#reader");
  assert.equal(firstReader.dataset.highlightStyle, "bold");
  assert.equal(firstReader.style.getPropertyValue("--reader-font-size"), "24px");
  assert.equal(firstReader.style.getPropertyValue("--reader-line-height"), "2");
  assert.equal(firstReader.style.getPropertyValue("--reader-measure"), "76ch");
  first.window.localStorage.setItem("saccade-reader-preferences-v1", JSON.stringify({
    highlightStyle: "underline",
    highlightTone: "rose",
    fontSize: 22,
    lineHeight: 1.9,
    measure: 64
  }));
  first.window.dispatchEvent(new first.window.StorageEvent("storage", {
    key: "saccade-reader-preferences-v1"
  }));
  assert.equal(firstReader.dataset.highlightStyle, "underline");
  assert.equal(firstReader.dataset.highlightTone, "rose");
  assert.equal(firstReader.style.getPropertyValue("--reader-font-size"), "22px");
  const saved = first.window.localStorage.getItem("saccade-reader-preferences-v1");

  const second = await loadApp(saved);
  const secondReader = second.window.document.querySelector("#reader");
  assert.equal(second.window.document.querySelector('input[value="underline"]').checked, true);
  assert.equal(second.window.document.querySelector("#font-size-input").value, "22");
  assert.equal(secondReader.dataset.highlightStyle, "underline");
  assert.equal(secondReader.style.getPropertyValue("--reader-font-size"), "22px");

  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.localStorage;
});
