import { JSDOM } from "jsdom";

const DROP_WITH_CONTENT = new Set([
  "audio",
  "button",
  "canvas",
  "embed",
  "form",
  "iframe",
  "input",
  "noscript",
  "object",
  "script",
  "select",
  "source",
  "style",
  "svg",
  "template",
  "textarea",
  "video"
]);

const ALLOWED_ELEMENTS = new Set([
  "a",
  "abbr",
  "article",
  "b",
  "blockquote",
  "br",
  "cite",
  "code",
  "dd",
  "del",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "main",
  "ol",
  "p",
  "pre",
  "q",
  "s",
  "section",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul"
]);

const PARAGRAPH_SELECTOR =
  "[data-reader-direct-text], h2, h3, h4, h5, h6, p, pre, li, dt, dd, figcaption, blockquote, th, td";
const LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const IMAGE_PROTOCOLS = new Set(["http:", "https:"]);

function normalizeBlockText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function resolveSafeUrl(value, baseUrl, protocols, allowFragment = false) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("#")) return allowFragment ? raw : null;

  try {
    const resolved = new URL(raw, baseUrl);
    return protocols.has(resolved.protocol) ? resolved.href : null;
  } catch {
    return null;
  }
}

function unwrap(element) {
  element.replaceWith(...element.childNodes);
}

function normalizeTextNodeWhitespace(element) {
  const view = element.ownerDocument.defaultView;
  const walker = element.ownerDocument.createTreeWalker(element, view.NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node);
    node = walker.nextNode();
  }

  let started = false;
  let pendingSpace = false;
  for (const textNode of nodes) {
    let normalized = "";
    for (const character of Array.from(textNode.data)) {
      if (/\s/u.test(character)) {
        if (started) pendingSpace = true;
        continue;
      }
      if (pendingSpace) normalized += " ";
      normalized += character;
      started = true;
      pendingSpace = false;
    }
    textNode.data = normalized;
  }
}

function trimTextNodeEdges(element) {
  const view = element.ownerDocument.defaultView;
  const walker = element.ownerDocument.createTreeWalker(element, view.NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node);
    node = walker.nextNode();
  }
  if (nodes.length === 0) return;
  nodes[0].data = nodes[0].data.replace(/^\s+/u, "");
  nodes.at(-1).data = nodes.at(-1).data.replace(/\s+$/u, "");
}

function sanitizeElement(element, baseUrl, anchorMap) {
  const tag = element.tagName.toLowerCase();
  if (DROP_WITH_CONTENT.has(tag)) {
    element.remove();
    return;
  }

  if (!ALLOWED_ELEMENTS.has(tag)) {
    unwrap(element);
    return;
  }

  const original = {
    alt: element.getAttribute("alt"),
    href: element.getAttribute("href"),
    id: element.getAttribute("id"),
    src: element.getAttribute("src"),
    title: element.getAttribute("title")
  };
  for (const attribute of Array.from(element.attributes)) {
    element.removeAttribute(attribute.name);
  }

  const safeId = anchorMap.get(original.id);
  if (safeId) element.setAttribute("id", safeId);

  if (tag === "a") {
    const href = original.href?.startsWith("#")
      ? anchorMap.get(original.href.slice(1)) ? `#${anchorMap.get(original.href.slice(1))}` : null
      : resolveSafeUrl(original.href, baseUrl, LINK_PROTOCOLS);
    if (href) {
      element.setAttribute("href", href);
      if (!href.startsWith("#")) {
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noreferrer noopener");
      }
    }
    if (original.title) element.setAttribute("title", original.title.slice(0, 300));
  }

  if (tag === "img") {
    const src = resolveSafeUrl(original.src, baseUrl, IMAGE_PROTOCOLS);
    if (!src) {
      element.remove();
      return;
    }
    element.setAttribute("src", `/api/image?url=${encodeURIComponent(src)}`);
    element.setAttribute("alt", String(original.alt || "").slice(0, 500));
    element.setAttribute("loading", "lazy");
    element.setAttribute("decoding", "async");
    element.setAttribute("referrerpolicy", "no-referrer");
  }
}

function createAnchorMap(root) {
  const anchorMap = new Map();
  for (const element of root.querySelectorAll("[id]")) {
    const id = element.getAttribute("id");
    if (/^[A-Za-z][A-Za-z0-9_:.-]{0,127}$/.test(id || "") && !anchorMap.has(id)) {
      anchorMap.set(id, `reader-anchor-${id}`);
    }
  }
  return anchorMap;
}

function wrapNestedBlockDirectText(root) {
  for (const item of root.querySelectorAll("li")) {
    const hasNestedBlock = Array.from(item.children).some((child) =>
      child.matches("p, ul, ol, dl, table, blockquote")
    );
    if (!hasNestedBlock) continue;
    let run = [];
    const flush = () => {
      if (!normalizeBlockText(run.map((node) => node.textContent).join(""))) {
        run = [];
        return;
      }
      const wrapper = item.ownerDocument.createElement("span");
      wrapper.setAttribute("data-reader-direct-text", "");
      item.insertBefore(wrapper, run[0]);
      wrapper.append(...run);
      run = [];
    };

    for (const child of Array.from(item.childNodes)) {
      const isNestedBlock = child.nodeType === 1 && child.matches("p, ul, ol, dl, table, blockquote");
      if (isNestedBlock) flush();
      else run.push(child);
    }
    flush();
  }
}

function assignParagraphIds(root) {
  const paragraphTexts = [];
  wrapNestedBlockDirectText(root);
  const candidates = Array.from(root.querySelectorAll(PARAGRAPH_SELECTOR));

  for (const element of candidates) {
    if (element.matches("blockquote") && element.querySelector("p, li, figcaption")) continue;
    if (element.matches("li") && element.querySelector(PARAGRAPH_SELECTOR)) continue;

    if (element.matches("pre")) trimTextNodeEdges(element);
    else normalizeTextNodeWhitespace(element);
    const text = element.matches("pre") ? element.textContent : normalizeBlockText(element.textContent);
    if (!text) continue;

    element.setAttribute("data-reader-paragraph-id", String(paragraphTexts.length));
    paragraphTexts.push(text);
  }

  return paragraphTexts;
}

export function sanitizeArticleContent(html, baseUrl) {
  const dom = new JSDOM(`<main id="reader-content-root">${String(html || "")}</main>`, {
    url: baseUrl
  });
  const root = dom.window.document.querySelector("#reader-content-root");
  const anchorMap = createAnchorMap(root);

  for (const element of Array.from(root.querySelectorAll("*"))) {
    if (element.isConnected) sanitizeElement(element, baseUrl, anchorMap);
  }

  const paragraphTexts = assignParagraphIds(root);
  return {
    html: root.innerHTML.trim(),
    paragraphTexts
  };
}
