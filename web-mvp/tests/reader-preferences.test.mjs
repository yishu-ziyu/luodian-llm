import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_READER_PREFERENCES,
  loadReaderPreferences,
  normalizeReaderPreferences,
  saveReaderPreferences
} from "../public/reader-preferences.js";

function memoryStorage(initialValue = null) {
  let value = initialValue;
  return {
    getItem: () => value,
    setItem: (_key, nextValue) => {
      value = nextValue;
    },
    value: () => value
  };
}

test("normalizeReaderPreferences accepts known styles and clamps layout ranges", () => {
  assert.deepEqual(normalizeReaderPreferences({
    highlightStyle: "bold",
    highlightTone: "blue",
    fontSize: 50,
    lineHeight: 1,
    measure: 100
  }), {
    highlightStyle: "bold",
    highlightTone: "blue",
    fontSize: 24,
    lineHeight: 1.55,
    measure: 78
  });
});

test("loadReaderPreferences recovers from invalid storage", () => {
  assert.deepEqual(loadReaderPreferences(memoryStorage("not json")), DEFAULT_READER_PREFERENCES);
});

test("saveReaderPreferences stores the normalized preference object", () => {
  const storage = memoryStorage();
  const saved = saveReaderPreferences(storage, { highlightStyle: "underline", highlightTone: "rose" });

  assert.equal(saved.highlightStyle, "underline");
  assert.equal(saved.highlightTone, "rose");
  assert.deepEqual(JSON.parse(storage.value()), saved);
});

test("saveReaderPreferences keeps live preferences when storage is unavailable", () => {
  const storage = { setItem: () => { throw new Error("quota exceeded"); } };
  assert.equal(saveReaderPreferences(storage, { fontSize: 23 }).fontSize, 23);
});
