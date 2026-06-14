import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { Defuddle } from "defuddle/node";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createArticleDocument } from "./article.mjs";

function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function htmlToText(html) {
  const dom = new JSDOM(`<main>${html || ""}</main>`);
  return normalizeText(dom.window.document.body.textContent || "");
}

function parseReadability(html, url) {
  const readabilityDom = new JSDOM(html, { url });
  return new Readability(readabilityDom.window.document).parse();
}

export function scoreExtractedText(text) {
  const length = Array.from(String(text || "").trim()).length;
  if (length >= 800) return 3;
  if (length >= 300) return 2;
  if (length >= 120) return 1;
  return 0;
}

function isPrivateIpv4(address) {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isPrivateIp(address) {
  if (isIP(address) === 4) return isPrivateIpv4(address);

  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4(normalized.slice("::ffff:".length));
  }

  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function normalizeLookupResult(result) {
  const entries = Array.isArray(result) ? result : [result];
  return entries.map((entry) => (typeof entry === "string" ? entry : entry?.address)).filter(Boolean);
}

async function assertFetchablePublicHttpUrl(parsedUrl, options, hasCustomFetch) {
  const hostname = parsedUrl.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("URL resolves to a private or local network address.");
  }

  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("URL resolves to a private or local network address.");
    return;
  }

  const lookupImpl = options.lookupImpl || (!hasCustomFetch ? dnsLookup : null);
  if (!lookupImpl) return;

  const addresses = normalizeLookupResult(await lookupImpl(hostname, { all: true, verbatim: true }));
  if (!addresses.length || addresses.some(isPrivateIp)) {
    throw new Error("URL resolves to a private or local network address.");
  }
}

export async function extractUrlArticle(url, options = {}) {
  const parsedUrl = new URL(url);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Only http and https URLs are supported.");
  }

  const hasCustomFetch = typeof options === "function" || Boolean(options.fetchImpl);
  const fetchImpl = typeof options === "function" ? options : options.fetchImpl || fetch;
  const defuddleImpl = typeof options === "function" ? Defuddle : options.defuddleImpl || Defuddle;
  const readabilityImpl =
    typeof options === "function" ? parseReadability : options.readabilityImpl || parseReadability;

  await assertFetchablePublicHttpUrl(parsedUrl, typeof options === "function" ? {} : options, hasCustomFetch);

  const response = await fetchImpl(parsedUrl.href);
  if (!response.ok) {
    throw new Error(`Fetch failed with HTTP ${response.status}.`);
  }

  const html = await response.text();
  const defuddleResult = await defuddleImpl(html, parsedUrl.href, {
    markdown: true,
    removeImages: true
  });
  const defuddleText = htmlToText(defuddleResult?.content || defuddleResult?.contentMarkdown || "");

  let selected = {
    method: "defuddle",
    title: defuddleResult?.title || parsedUrl.hostname,
    text: defuddleText,
    fallbackUsed: false,
    warnings: []
  };

  if (scoreExtractedText(defuddleText) < 2) {
    const readable = readabilityImpl(html, parsedUrl.href);
    const readabilityText = normalizeText(readable?.textContent || "");
    if (scoreExtractedText(readabilityText) > scoreExtractedText(defuddleText)) {
      selected = {
        method: "readability",
        title: readable?.title || selected.title,
        text: readabilityText,
        fallbackUsed: true,
        warnings: ["Defuddle output was too short; Readability fallback selected."]
      };
    }
  }

  return createArticleDocument({
    sourceType: "url",
    sourceUrl: parsedUrl.href,
    title: selected.title,
    plainText: normalizeText(selected.text),
    extraction: {
      method: selected.method,
      fallbackUsed: selected.fallbackUsed,
      qualityScore: scoreExtractedText(selected.text),
      warnings: selected.warnings
    }
  });
}
