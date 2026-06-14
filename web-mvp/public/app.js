const state = {
  article: null,
  highlight: null,
  modelInfo: null,
  selectedFile: null,
  showHighlight: true
};

const elements = {
  urlInput: document.querySelector("#url-input"),
  importUrlButton: document.querySelector("#import-url-button"),
  fileInput: document.querySelector("#file-input"),
  importFileButton: document.querySelector("#import-file-button"),
  fileName: document.querySelector("#file-name"),
  statusLine: document.querySelector("#status-line"),
  reader: document.querySelector("#reader"),
  regenerateButton: document.querySelector("#regenerate-button"),
  highlightToggle: document.querySelector("#highlight-toggle"),
  modelNote: document.querySelector("#model-note")
};

function selectedDensity() {
  return document.querySelector('input[name="density"]:checked')?.value || "medium";
}

function setStatus(message, level = "info") {
  elements.statusLine.textContent = message;
  elements.statusLine.classList.toggle("error", level === "error");
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

function appendHighlightedText(container, text, ranges) {
  const chars = Array.from(text);
  const sortedRanges = [...(ranges || [])]
    .reduce((pairs, value, index, source) => {
      if (index % 2 === 0) pairs.push([value, source[index + 1]]);
      return pairs;
    }, [])
    .filter(([start, length]) => Number.isInteger(start) && Number.isInteger(length) && length > 0)
    .sort(([left], [right]) => left - right);

  let cursor = 0;
  for (const [start, length] of sortedRanges) {
    if (start < cursor || start >= chars.length) continue;
    if (start > cursor) {
      container.append(document.createTextNode(chars.slice(cursor, start).join("")));
    }

    const mark = document.createElement("mark");
    mark.className = "reading-highlight";
    mark.textContent = chars.slice(start, Math.min(start + length, chars.length)).join("");
    container.append(mark);
    cursor = Math.min(start + length, chars.length);
  }

  if (cursor < chars.length) {
    container.append(document.createTextNode(chars.slice(cursor).join("")));
  }
}

function renderReader() {
  elements.reader.replaceChildren();

  if (!state.article) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "导入公开网页、txt 或 md 后，这里会显示清洗后的文章和高亮。";
    elements.reader.append(empty);
    return;
  }

  const title = document.createElement("h2");
  title.textContent = state.article.title;
  elements.reader.append(title);

  const meta = document.createElement("div");
  meta.className = "reader-meta";
  meta.textContent = `${state.article.sourceType} · ${state.article.paragraphs.length} 段 · ${state.article.extraction.method}`;
  elements.reader.append(meta);

  for (const paragraph of state.article.paragraphs) {
    const p = document.createElement("p");
    if (state.showHighlight && state.highlight?.[paragraph.id]) {
      appendHighlightedText(p, paragraph.text, state.highlight[paragraph.id]);
    } else {
      p.textContent = paragraph.text;
    }
    elements.reader.append(p);
  }
}

async function generateHighlightAndSave() {
  if (!state.article) return;

  const paragraphCount = state.article.paragraphs.length;
  setStatus(
    paragraphCount > 12
      ? `生成语义高亮中... 正在分批处理 ${paragraphCount} 段，请保持页面打开。`
      : "生成语义高亮中..."
  );
  const result = await postJson("/api/highlight", {
    articleId: state.article.id,
    paragraphs: state.article.paragraphs,
    density: selectedDensity()
  });

  state.highlight = result.highlight;
  state.modelInfo = result.modelInfo;
  elements.modelNote.textContent = result.modelInfo.model || result.modelInfo.provider;
  elements.regenerateButton.disabled = false;
  renderReader();

  const saved = await postJson("/api/experiments", {
    article: state.article,
    aiHighlight: state.highlight,
    modelInfo: state.modelInfo
  });
  setStatus(`已生成高亮，并保存实验记录：${saved.experiment.id}`);
}

async function importArticle(importer) {
  try {
    elements.regenerateButton.disabled = true;
    state.highlight = null;
    setStatus("导入文章中...");

    const data = await importer();
    state.article = data.article;
    renderReader();
    await generateHighlightAndSave();
  } catch (error) {
    setStatus(error.message || "处理失败。", "error");
  }
}

elements.importUrlButton.addEventListener("click", () => {
  const url = elements.urlInput.value.trim();
  if (!url) {
    setStatus("请输入公开网页 URL。", "error");
    return;
  }

  importArticle(() => postJson("/api/import/url", { url }));
});

elements.fileInput.addEventListener("change", () => {
  state.selectedFile = elements.fileInput.files?.[0] || null;
  elements.fileName.textContent = state.selectedFile ? state.selectedFile.name : "未选择文件";
});

elements.importFileButton.addEventListener("click", () => {
  if (!state.selectedFile) {
    setStatus("请选择 .txt 或 .md 文件。", "error");
    return;
  }

  importArticle(async () => {
    const text = await state.selectedFile.text();
    return postJson("/api/import/file", {
      filename: state.selectedFile.name,
      text
    });
  });
});

elements.regenerateButton.addEventListener("click", () => {
  generateHighlightAndSave().catch((error) => {
    setStatus(error.message || "高亮生成失败。", "error");
  });
});

elements.highlightToggle.addEventListener("change", () => {
  state.showHighlight = elements.highlightToggle.checked;
  renderReader();
});

document.querySelectorAll('input[name="density"]').forEach((input) => {
  input.addEventListener("change", () => {
    if (!state.article) return;
    elements.regenerateButton.disabled = false;
  });
});
