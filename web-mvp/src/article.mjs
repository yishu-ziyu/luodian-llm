import crypto from "node:crypto";

/**
 * Splits article text into paragraphs.
 *
 * Modes (default = "auto"):
 *   - "double-newline": split on `\n{2,}` only (strict blank-line paragraph)
 *   - "single-newline": split on every `\n` (editor-paste friendly)
 *   - "auto": if input contains `\n{2,}`, behave like "double-newline";
 *             otherwise behave like "single-newline"
 *
 * The "auto" mode is the recommended default: it preserves the legacy
 * `\n{2,}` behavior when blank lines are present (e.g. markdown sources)
 * and falls back to single-newline for editor-pasted text (e.g. Feishu /
 * Notion / plain text editors) which usually has no blank lines between
 * paragraphs. This avoids the product risk where a long editor-pasted
 * article is collapsed into a single paragraph and bypasses batching.
 *
 * Pure / immutable: never mutates the input string; returns a new array.
 */
export function splitIntoParagraphs(text, options = {}) {
  const { splitMode = "auto" } = options;
  const normalized = String(text).replace(/\r\n/g, "\n");

  let rawParts;
  if (splitMode === "single-newline") {
    rawParts = normalized.split("\n");
  } else if (splitMode === "double-newline") {
    rawParts = normalized.split(/\n{2,}/);
  } else {
    // auto
    rawParts = /\n{2,}/.test(normalized)
      ? normalized.split(/\n{2,}/)
      : normalized.split("\n");
  }

  return rawParts.map((paragraph) => paragraph.trim()).filter(Boolean);
}

export function createArticleDocument({ sourceType, sourceUrl, title, plainText, extraction }) {
  const normalizedText = String(plainText || "").trim();
  const paragraphs = splitIntoParagraphs(normalizedText).map((text, index) => ({
    id: String(index),
    index,
    text,
    charLength: Array.from(text).length
  }));

  if (paragraphs.length === 0) {
    throw new Error("Article text is empty after normalization.");
  }

  return {
    id: `article_${crypto.randomUUID()}`,
    sourceType,
    ...(sourceUrl ? { sourceUrl } : {}),
    title: title?.trim() || "Untitled",
    plainText: normalizedText,
    paragraphs,
    extraction,
    createdAt: new Date().toISOString()
  };
}
