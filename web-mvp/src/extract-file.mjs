import { createArticleDocument } from "./article.mjs";

export function importTextFile({ filename, text }) {
  if (!/\.(txt|md)$/i.test(filename || "")) {
    throw new Error("Only .txt and .md files are supported in the Web MVP.");
  }

  if (String(text || "").length > 300_000) {
    throw new Error("File text is too large for the Web MVP limit.");
  }

  return createArticleDocument({
    sourceType: "file",
    title: filename,
    plainText: text,
    extraction: { method: "file", fallbackUsed: false, warnings: [] }
  });
}
