import { renderArticleContent } from "./reader-renderer.js";
import {
  applyReaderPreferences,
  loadReaderPreferences,
  READER_PREFERENCES_STORAGE_KEY,
  saveReaderPreferences
} from "./reader-preferences.js";

const state = {
  article: null,
  highlight: null,
  modelInfo: null,
  selectedFile: null,
  showHighlight: true,
  readerPreferences: loadReaderPreferences()
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
  statAnchors: document.querySelector("#stat-anchors"),
  preferenceInputs: document.querySelectorAll("[data-reader-preference]"),
  preferenceOutputs: document.querySelectorAll("[data-preference-output]"),
  highlightPreview: document.querySelector("#highlight-preview")
};

function selectedDensity() {
  return document.querySelector('input[name="density"]:checked')?.value || "medium";
}

function setStatus(message, level = "info") {
  elements.statusLine.textContent = message;
  elements.statusLine.classList.toggle("error", level === "error");
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

function updatePreferenceControls() {
  for (const input of elements.preferenceInputs) {
    const value = state.readerPreferences[input.dataset.readerPreference];
    if (input.type === "radio") input.checked = input.value === value;
    else input.value = String(value);
  }
  for (const output of elements.preferenceOutputs) {
    const key = output.dataset.preferenceOutput;
    const value = state.readerPreferences[key];
    output.value = key === "fontSize" ? `${value}px` : key === "measure" ? `${value} 字` : String(value);
  }
  elements.highlightPreview.dataset.highlightStyle = state.readerPreferences.highlightStyle;
  elements.highlightPreview.dataset.highlightTone = state.readerPreferences.highlightTone;
}

function updatePreferenceOutput(key) {
  const output = Array.from(elements.preferenceOutputs).find(
    (candidate) => candidate.dataset.preferenceOutput === key
  );
  if (!output) return;
  const value = state.readerPreferences[key];
  output.value = key === "fontSize" ? `${value}px` : key === "measure" ? `${value} 字` : String(value);
}

function renderReader() {
  elements.reader.replaceChildren();
  applyReaderPreferences(elements.reader, state.readerPreferences);

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
  const sheet = document.createElement("div");
  sheet.className = "reader-sheet";
  sheet.append(title);

  const meta = document.createElement("div");
  meta.className = "reader-meta";
  const metaText = `${state.article.sourceType} · ${state.article.paragraphs.length} 段 · ${state.article.extraction.method}`;
  if (state.article.sourceUrl) {
    const sourceLink = document.createElement("a");
    sourceLink.href = state.article.sourceUrl;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    sourceLink.textContent = metaText;
    meta.append(sourceLink);
  } else {
    meta.textContent = metaText;
  }
  sheet.append(meta);

  const content = document.createElement("div");
  content.className = "reader-content";
  renderArticleContent(content, state.article, {
    highlight: state.highlight,
    showHighlight: state.showHighlight
  });
  sheet.append(content);
  elements.reader.append(sheet);
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

elements.preferenceInputs.forEach((input) => {
  input.addEventListener("input", () => {
    const key = input.dataset.readerPreference;
    if (input.type === "radio" && !input.checked) return;
    state.readerPreferences = saveReaderPreferences(localStorage, {
      ...state.readerPreferences,
      [key]: input.value
    });
    updatePreferenceOutput(key);
    if (key === "highlightStyle") elements.highlightPreview.dataset.highlightStyle = state.readerPreferences.highlightStyle;
    if (key === "highlightTone") elements.highlightPreview.dataset.highlightTone = state.readerPreferences.highlightTone;
    applyReaderPreferences(elements.reader, state.readerPreferences);
  });
});

window.addEventListener("storage", (event) => {
  if (event.key !== READER_PREFERENCES_STORAGE_KEY) return;
  state.readerPreferences = loadReaderPreferences();
  updatePreferenceControls();
  applyReaderPreferences(elements.reader, state.readerPreferences);
});

updatePreferenceControls();
applyReaderPreferences(elements.reader, state.readerPreferences);
