import { createHighlightSpans } from "./highlight-engine";

export const HIGHLIGHT_CLASS = "luodian-original-page-highlight";
const STYLE_ID = "luodian-original-page-highlight-style";
const BLOCK_SELECTOR = "p, blockquote, li";
const BLOCK_EXCLUDED_SELECTOR = [
  "nav",
  "header",
  "footer",
  "aside",
  "pre",
  "code",
  "button",
  "input",
  "textarea",
  "select",
  "script",
  "style",
  "[role='navigation']",
  "[role='button']",
  "[aria-hidden='true']",
  "[hidden]",
  "[contenteditable='true']",
  `.${HIGHLIGHT_CLASS}`
].join(",");
const INLINE_EMPHASIS_SELECTOR = "a, strong, b, em, mark";

interface TextNodeEntry {
  node: Text;
  highlightable: boolean;
}

export interface HighlightResult {
  enabled: boolean;
  highlightCount: number;
  durationMs: number;
}

export interface HighlightSession {
  readonly highlightCount: number;
  stop(): void;
}

interface RuntimeSessionSlot {
  __luodianOriginalPageSession__?: HighlightSession;
}

const sessions = new WeakMap<Document, HighlightSession>();

function hasEnoughChineseText(text: string): boolean {
  return (text.match(/\p{Script=Han}/gu) || []).length >= 6;
}

function isVisible(element: Element, doc: Document): boolean {
  if (element.hasAttribute("hidden") || element.getAttribute("aria-hidden") === "true") return false;
  const style = doc.defaultView?.getComputedStyle(element);
  return !style || (style.display !== "none" && style.visibility !== "hidden");
}

function findContentRoot(doc: Document): Element | null {
  const candidates = Array.from(doc.querySelectorAll("article, main, [role='main']"))
    .filter((element) => isVisible(element, doc))
    .filter((element) => hasEnoughChineseText(element.textContent || ""));
  if (candidates.length > 0) {
    return candidates.reduce((best, candidate) => {
      const bestIsArticle = best.tagName === "ARTICLE";
      const candidateIsArticle = candidate.tagName === "ARTICLE";
      if (candidateIsArticle !== bestIsArticle) return candidateIsArticle ? candidate : best;
      return (candidate.textContent?.length || 0) > (best.textContent?.length || 0) ? candidate : best;
    });
  }

  const blocks = Array.from(doc.querySelectorAll(BLOCK_SELECTOR)).filter(
    (element) => !element.closest(BLOCK_EXCLUDED_SELECTOR) && hasEnoughChineseText(element.textContent || "")
  );
  const firstBlock = blocks[0];
  if (!firstBlock) return null;

  const scores = new Map<Element, number>();
  for (const block of blocks) {
    let ancestor: Element | null = block.parentElement;
    for (let depth = 0; ancestor && ancestor !== doc.body && depth < 4; depth += 1) {
      scores.set(ancestor, (scores.get(ancestor) || 0) + (block.textContent?.length || 0));
      ancestor = ancestor.parentElement;
    }
  }
  return Array.from(scores.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || firstBlock.parentElement;
}

function eligibleBlocks(root: Element, doc: Document): Element[] {
  const blocks = [
    ...(root.matches(BLOCK_SELECTOR) ? [root] : []),
    ...Array.from(root.querySelectorAll(BLOCK_SELECTOR))
  ];
  const eligible = blocks.filter((block) => {
    if (block.closest(BLOCK_EXCLUDED_SELECTOR)) return false;
    if (!isVisible(block, doc)) return false;
    return hasEnoughChineseText(block.textContent || "");
  });
  return eligible.filter(
    (block) => !eligible.some((other) => other !== block && block.contains(other))
  );
}

function numericFontWeight(value: string): number {
  if (value === "bold" || value === "bolder") return 700;
  if (value === "normal" || value === "lighter") return 400;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 400;
}

function alreadyEmphasized(node: Text, block: Element, doc: Document): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  if (parent.closest(INLINE_EMPHASIS_SELECTOR)) return true;

  const parentStyle = doc.defaultView?.getComputedStyle(parent);
  const blockStyle = doc.defaultView?.getComputedStyle(block);
  if (!parentStyle || !blockStyle || parent === block) return false;
  if (numericFontWeight(parentStyle.fontWeight) >= numericFontWeight(blockStyle.fontWeight) + 150) return true;
  return parentStyle.color !== blockStyle.color;
}

function textNodesFor(element: Element, doc: Document): TextNodeEntry[] {
  const walker = doc.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest(BLOCK_EXCLUDED_SELECTOR)) return NodeFilter.FILTER_REJECT;
      return (node as Text).data.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const nodes: TextNodeEntry[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    nodes.push({ node, highlightable: !alreadyEmphasized(node, element, doc) });
  }
  return nodes;
}

function wrapTextRange(node: Text, start: number, end: number, doc: Document): void {
  if (start < 0 || end <= start || end > node.data.length) return;
  node.splitText(end);
  const selected = node.splitText(start);
  const wrapper = doc.createElement("span");
  wrapper.className = HIGHLIGHT_CLASS;
  selected.parentNode?.insertBefore(wrapper, selected);
  wrapper.append(selected);
}

function highlightBlock(block: Element, doc: Document): number {
  const entries = textNodesFor(block, doc);
  const offsets: Array<{ node: Text; start: number; end: number; highlightable: boolean }> = [];
  let cursor = 0;
  for (const entry of entries) {
    offsets.push({
      node: entry.node,
      start: cursor,
      end: cursor + entry.node.data.length,
      highlightable: entry.highlightable
    });
    cursor += entry.node.data.length;
  }
  const text = entries.map((entry) => entry.node.data).join("");
  const excludedRanges = offsets
    .filter((offset) => !offset.highlightable)
    .map((offset) => ({ start: offset.start, end: offset.end }));
  const spans = createHighlightSpans(text, { excludedRanges });
  let wrapperCount = 0;

  for (const offset of offsets.filter((entry) => entry.highlightable)) {
    const localRanges = spans
      .map((span) => ({
        start: Math.max(span.start, offset.start) - offset.start,
        end: Math.min(span.end, offset.end) - offset.start
      }))
      .filter((range) => range.end > range.start)
      .sort((left, right) => right.start - left.start);
    for (const range of localRanges) {
      wrapTextRange(offset.node, range.start, range.end, doc);
      wrapperCount += 1;
    }
  }
  return wrapperCount;
}

function ensureStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      background-color: transparent !important;
      background-image:
        radial-gradient(
          ellipse 96% 88% at 46% 52%,
          rgb(225 146 28 / 42%) 0%,
          rgb(235 161 39 / 30%) 58%,
          transparent 100%
        ),
        radial-gradient(
          ellipse 74% 94% at 68% 45%,
          rgb(246 180 55 / 24%) 0%,
          transparent 88%
        ),
        radial-gradient(
          ellipse 82% 72% at 27% 63%,
          rgb(255 198 74 / 22%) 0%,
          transparent 90%
        ) !important;
      background-size: 1.07em 1.18em, 0.93em 1.08em, 1.13em 1.26em !important;
      background-position: 0.02em 52%, -0.08em 45%, 0.11em 58% !important;
      background-repeat: repeat-x !important;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
      display: inline !important;
      position: static !important;
      float: none !important;
      transform: none !important;
      vertical-align: baseline !important;
      color: inherit !important;
      font: inherit !important;
      letter-spacing: inherit !important;
      line-height: inherit !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      text-decoration: inherit !important;
    }
  `;
  (doc.head || doc.documentElement).append(style);
}

function removeHighlights(doc: Document): void {
  const parents = new Set<Node>();
  for (const wrapper of Array.from(doc.querySelectorAll(`.${HIGHLIGHT_CLASS}`))) {
    if (wrapper.parentNode) parents.add(wrapper.parentNode);
    wrapper.replaceWith(...Array.from(wrapper.childNodes));
  }
  for (const parent of parents) parent.normalize();
  doc.getElementById(STYLE_ID)?.remove();
}

export function startHighlightSession(doc: Document): HighlightSession {
  const existing = sessions.get(doc);
  if (existing) return existing;

  ensureStyle(doc);
  const processed = new WeakSet<Element>();
  let count = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const process = () => {
    if (stopped) return;
    const root = findContentRoot(doc);
    if (!root) return;
    for (const block of eligibleBlocks(root, doc)) {
      if (processed.has(block)) continue;
      processed.add(block);
      count += highlightBlock(block, doc);
    }
  };

  process();
  const observer = new MutationObserver(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(process, 80);
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true });

  const session: HighlightSession = {
    get highlightCount() {
      return count;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      observer.disconnect();
      if (timer) clearTimeout(timer);
      removeHighlights(doc);
      sessions.delete(doc);
    }
  };
  sessions.set(doc, session);
  return session;
}

export function toggleDocumentHighlight(doc: Document): HighlightResult {
  const startedAt = performance.now();
  const existing = sessions.get(doc);
  if (existing) {
    existing.stop();
    return { enabled: false, highlightCount: 0, durationMs: performance.now() - startedAt };
  }
  const session = startHighlightSession(doc);
  return {
    enabled: true,
    highlightCount: session.highlightCount,
    durationMs: performance.now() - startedAt
  };
}

export function toggleHighlightSession(doc: Document): HighlightResult {
  const runtime = globalThis as typeof globalThis & RuntimeSessionSlot;
  const startedAt = performance.now();
  if (runtime.__luodianOriginalPageSession__) {
    runtime.__luodianOriginalPageSession__.stop();
    delete runtime.__luodianOriginalPageSession__;
    return { enabled: false, highlightCount: 0, durationMs: performance.now() - startedAt };
  }

  const session = startHighlightSession(doc);
  runtime.__luodianOriginalPageSession__ = session;
  return {
    enabled: true,
    highlightCount: session.highlightCount,
    durationMs: performance.now() - startedAt
  };
}
