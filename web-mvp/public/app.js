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
  modelNote: document.querySelector("#model-note"),
  sourceTabs: document.querySelectorAll("[data-source-mode]"),
  sourcePanels: document.querySelectorAll("[data-source-panel]"),
  statChars: document.querySelector("#stat-chars"),
  statMinutes: document.querySelector("#stat-minutes"),
  statAnchors: document.querySelector("#stat-anchors")
};

function selectedDensity() {
  return document.querySelector('input[name="density"]:checked')?.value || "medium";
}

function setStatus(message, level = "info") {
  elements.statusLine.textContent = message;
  elements.statusLine.classList.toggle("error", level === "error");
  if (level === "error") {
    elements.statusLine.classList.remove("fallback");
    elements.modelNote.classList.remove("fallback");
  }
}

function setSourceMode(mode) {
  elements.sourceTabs.forEach((tab) => {
    const active = tab.dataset.sourceMode === mode;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  elements.sourcePanels.forEach((panel) => {
    const active = panel.dataset.sourcePanel === mode;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
}

function countHighlightAnchors(highlight) {
  if (!highlight) return 0;
  return Object.values(highlight).reduce((total, ranges) => total + Math.floor((ranges?.length || 0) / 2), 0);
}

function updateStats() {
  const chars = state.article?.paragraphs?.reduce((total, paragraph) => total + (paragraph.charLength || Array.from(paragraph.text || "").length), 0) || 0;
  const minutes = chars > 0 ? Math.max(1, Math.ceil(chars / 500)) : "--";
  const anchors = state.highlight ? countHighlightAnchors(state.highlight) : "--";

  elements.statChars.textContent = String(chars);
  elements.statMinutes.textContent = String(minutes);
  elements.statAnchors.textContent = String(anchors);
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
    empty.innerHTML = `
      <div class="saccade-ruler" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="sample-document">
        <h2>示例文本</h2>
        <p>导入公开网页或本地文本后，系统会在文章中标出读者视线最可能落下的<span class="sample-highlight">关键位置</span>。</p>
        <p>这些短促的<span class="sample-highlight">语义落点</span>会形成一条温和的阅读轨道，帮助你更快回到句子的主干。</p>
        <p>右侧纸面会保留原文节奏，只在必要位置加入<span class="sample-highlight">柔和高亮</span>。</p>
      </div>
    `;
    elements.reader.append(empty);
    updateStats();
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
  updateStats();
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

  const fallbackUsed = result.modelInfo?.fallbackUsed === true;
  elements.modelNote.textContent = fallbackUsed
    ? `${result.modelInfo.model || result.modelInfo.provider} (fallback)`
    : result.modelInfo.model || result.modelInfo.provider;
  elements.modelNote.classList.toggle("fallback", fallbackUsed);
  elements.statusLine.classList.toggle("fallback", fallbackUsed);
  elements.regenerateButton.disabled = false;
  renderReader();

  const saved = await postJson("/api/experiments", {
    article: state.article,
    aiHighlight: state.highlight,
    modelInfo: state.modelInfo
  });

  if (fallbackUsed) {
    setStatus("已切换参考算法高亮（LLM 不可用）");
  } else {
    setStatus(`已生成高亮，并保存实验记录：${saved.experiment.id}`);
  }
}

async function importArticle(importer) {
  try {
    elements.regenerateButton.disabled = true;
    state.highlight = null;
    updateStats();
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

elements.sourceTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setSourceMode(tab.dataset.sourceMode);
  });
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
