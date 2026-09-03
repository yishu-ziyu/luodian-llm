function normalizedRanges(ranges, textLength) {
  const pairs = [];
  for (let index = 0; index < (ranges || []).length; index += 2) {
    const start = ranges[index];
    const length = ranges[index + 1];
    if (!Number.isInteger(start) || !Number.isInteger(length) || length <= 0) continue;
    if (start < 0 || start >= textLength) continue;
    pairs.push({ start, end: Math.min(start + length, textLength) });
  }

  const accepted = [];
  for (const range of pairs.sort((left, right) => left.start - right.start)) {
    if (accepted.length === 0 || range.start >= accepted.at(-1).end) accepted.push(range);
  }
  return accepted;
}

function codeUnitOffsets(text) {
  const offsets = [0];
  let offset = 0;
  for (const character of text) {
    offset += character.length;
    offsets.push(offset);
  }
  return offsets;
}

function collectTextNodes(element) {
  const nodes = [];
  const view = element.ownerDocument.defaultView;
  const walker = element.ownerDocument.createTreeWalker(element, view.NodeFilter.SHOW_TEXT);
  let cursor = 0;
  let node = walker.nextNode();

  while (node) {
    const length = Array.from(node.data).length;
    nodes.push({ node, start: cursor, end: cursor + length, codeUnitOffsets: codeUnitOffsets(node.data) });
    cursor += length;
    node = walker.nextNode();
  }

  return { nodes, length: cursor };
}

function wrapNodeSlice(entry, start, end) {
  if (start >= end) return;
  const { node, codeUnitOffsets: offsets } = entry;
  const startCodeUnit = offsets[start];
  const endCodeUnit = offsets[end];
  const selected = node.splitText(startCodeUnit);
  selected.splitText(endCodeUnit - startCodeUnit);

  const mark = node.ownerDocument.createElement("mark");
  mark.className = "reading-highlight";
  selected.replaceWith(mark);
  mark.append(selected);
}

export function applyHighlightRanges(element, ranges) {
  const { nodes, length } = collectTextNodes(element);
  const validRanges = normalizedRanges(ranges, length).reverse();

  for (const range of validRanges) {
    for (const entry of [...nodes].reverse()) {
      const overlapStart = Math.max(range.start, entry.start);
      const overlapEnd = Math.min(range.end, entry.end);
      if (overlapStart >= overlapEnd) continue;
      wrapNodeSlice(entry, overlapStart - entry.start, overlapEnd - entry.start);
    }
  }
}

function richFragment(container, html) {
  const template = container.ownerDocument.createElement("template");
  template.innerHTML = html;
  return template.content.cloneNode(true);
}

export function renderArticleContent(container, article, options = {}) {
  const { highlight = {}, showHighlight = true } = options;
  container.replaceChildren();

  if (article.contentHtml) {
    container.append(richFragment(container, article.contentHtml));
  } else {
    for (const paragraph of article.paragraphs || []) {
      const element = container.ownerDocument.createElement("p");
      element.dataset.readerParagraphId = paragraph.id;
      element.textContent = paragraph.text;
      container.append(element);
    }
  }

  if (!showHighlight) return;
  const paragraphElements = new Map(
    Array.from(container.querySelectorAll("[data-reader-paragraph-id]"), (element) => [
      element.dataset.readerParagraphId,
      element
    ])
  );
  for (const paragraph of article.paragraphs || []) {
    const element = paragraphElements.get(paragraph.id);
    if (element && highlight?.[paragraph.id]) applyHighlightRanges(element, highlight[paragraph.id]);
  }
}
