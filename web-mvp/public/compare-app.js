const state = {
  article: null,
  selectedFile: null,
  result: null
};

const elements = {
  urlInput: document.querySelector("#compare-url-input"),
  importUrlButton: document.querySelector("#compare-url-button"),
  fileInput: document.querySelector("#compare-file-input"),
  importFileButton: document.querySelector("#compare-file-button"),
  fileName: document.querySelector("#compare-file-name"),
  statusLine: document.querySelector("#compare-status-line"),
  rerunButton: document.querySelector("#rerun-compare-button"),
  baselineReader: document.querySelector("#baseline-reader"),
  aiReader: document.querySelector("#ai-reader"),
  diffReader: document.querySelector("#diff-reader"),
  modelNote: document.querySelector("#compare-model-note"),
  metricPosition: document.querySelector("#metric-position"),
  metricCoverage: document.querySelector("#metric-coverage"),
  metricDensity: document.querySelector("#metric-density"),
  metricRecall: document.querySelector("#metric-recall")
};

function selectedDensity() {
  return document.querySelector('input[name="compare-density"]:checked')?.value || "medium";
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

function percent(value) {
  return `${Math.round((value || 0) * 100)}%`;
}

function signedPercent(value) {
  const rounded = Math.round((value || 0) * 100);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function rangeSet(ranges = []) {
  const set = new Set();
  for (let index = 0; index < ranges.length; index += 2) {
    const start = ranges[index];
    const length = ranges[index + 1];
    for (let offset = 0; offset < length; offset += 1) {
      set.add(start + offset);
    }
  }
  return set;
}

function appendHighlightedText(container, text, ranges, className) {
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
    mark.className = className;
    mark.textContent = chars.slice(start, Math.min(start + length, chars.length)).join("");
    container.append(mark);
    cursor = Math.min(start + length, chars.length);
  }

  if (cursor < chars.length) {
    container.append(document.createTextNode(chars.slice(cursor).join("")));
  }
}

function appendDiffText(container, paragraph, baselineRanges, aiRanges) {
  const chars = Array.from(paragraph.text);
  const baseline = rangeSet(baselineRanges);
  const ai = rangeSet(aiRanges);
  let cursor = 0;

  while (cursor < chars.length) {
    const inBaseline = baseline.has(cursor);
    const inAi = ai.has(cursor);
    const className =
      inBaseline && inAi ? "diff-mark diff-both" : inBaseline ? "diff-mark diff-baseline-only" : inAi ? "diff-mark diff-ai-only" : "";
    let end = cursor + 1;
    while (end < chars.length) {
      const nextBaseline = baseline.has(end);
      const nextAi = ai.has(end);
      const nextClass =
        nextBaseline && nextAi
          ? "diff-mark diff-both"
          : nextBaseline
            ? "diff-mark diff-baseline-only"
            : nextAi
              ? "diff-mark diff-ai-only"
              : "";
      if (nextClass !== className) break;
      end += 1;
    }

    const text = chars.slice(cursor, end).join("");
    if (className) {
      const mark = document.createElement("mark");
      mark.className = className;
      mark.textContent = text;
      container.append(mark);
    } else {
      container.append(document.createTextNode(text));
    }
    cursor = end;
  }
}

function readerChrome(titleText, article) {
  const fragment = document.createDocumentFragment();
  const label = document.createElement("div");
  label.className = "compare-reader-title";
  label.textContent = titleText;
  fragment.append(label);

  if (article) {
    const title = document.createElement("h2");
    title.textContent = article.title;
    fragment.append(title);

    const meta = document.createElement("div");
    meta.className = "reader-meta";
    meta.textContent = `${article.sourceType} · ${article.paragraphs.length} 段 · ${article.extraction.method}`;
    fragment.append(meta);
  }

  return fragment;
}

function renderSingleReader(reader, title, highlight, markClass) {
  reader.replaceChildren(readerChrome(title, state.article));

  if (!state.article || !highlight) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "导入文章后显示高亮。";
    reader.append(empty);
    return;
  }

  for (const paragraph of state.article.paragraphs) {
    const p = document.createElement("p");
    appendHighlightedText(p, paragraph.text, highlight[paragraph.id], markClass);
    reader.append(p);
  }
}

function renderDiffReader() {
  elements.diffReader.replaceChildren(readerChrome("差异视图", state.article));

  const legend = document.createElement("div");
  legend.className = "diff-legend";
  legend.innerHTML =
    '<span><i class="legend-swatch both"></i>两者重合</span><span><i class="legend-swatch baseline-only"></i>参考算法独有</span><span><i class="legend-swatch ai-only"></i>AI 独有</span>';
  elements.diffReader.append(legend);

  if (!state.article || !state.result) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "这里会显示两套高亮的重合与偏差。";
    elements.diffReader.append(empty);
    return;
  }

  for (const paragraph of state.article.paragraphs) {
    const p = document.createElement("p");
    appendDiffText(
      p,
      paragraph,
      state.result.baselineHighlight[paragraph.id],
      state.result.aiHighlight[paragraph.id]
    );
    elements.diffReader.append(p);
  }
}

function renderMetrics() {
  const metrics = state.result?.metrics;
  elements.metricPosition.textContent = metrics ? percent(metrics.positionHitRate) : "-";
  elements.metricCoverage.textContent = metrics ? percent(metrics.coverageSimilarity) : "-";
  elements.metricDensity.textContent = metrics ? signedPercent(metrics.densityDelta) : "-";
  elements.metricRecall.textContent = metrics ? percent(metrics.baselineRecall) : "-";
}

function renderComparison() {
  renderMetrics();
  renderSingleReader(elements.baselineReader, "参考算法", state.result?.baselineHighlight, "baseline-highlight");
  renderSingleReader(elements.aiReader, "MiniMax-M3", state.result?.aiHighlight, "reading-highlight");
  renderDiffReader();
}

async function runCompare() {
  if (!state.article) return;

  const paragraphCount = state.article.paragraphs.length;
  setStatus(
    paragraphCount > 12
      ? `生成对照实验中... 正在请求参考算法与 AI，并分批处理 ${paragraphCount} 段。`
      : "生成对照实验中..."
  );
  elements.rerunButton.disabled = true;

  const result = await postJson("/api/compare", {
    article: state.article,
    paragraphs: state.article.paragraphs,
    density: selectedDensity()
  });

  state.result = result;
  elements.modelNote.textContent = `${result.baselineInfo.provider} / ${result.modelInfo.model || result.modelInfo.provider}`;
  elements.rerunButton.disabled = false;
  renderComparison();
  setStatus(`已生成对照实验，并保存记录：${result.experiment.id}`);
}

async function importArticle(importer) {
  try {
    state.result = null;
    elements.rerunButton.disabled = true;
    setStatus("导入文章中...");
    const data = await importer();
    state.article = data.article;
    renderComparison();
    await runCompare();
  } catch (error) {
    setStatus(error.message || "对照实验失败。", "error");
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

elements.rerunButton.addEventListener("click", () => {
  runCompare().catch((error) => {
    setStatus(error.message || "对照实验失败。", "error");
  });
});

document.querySelectorAll('input[name="compare-density"]').forEach((input) => {
  input.addEventListener("change", () => {
    if (!state.article) return;
    elements.rerunButton.disabled = false;
  });
});

renderComparison();
