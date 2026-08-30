import { describe, expect, it } from "vitest";

import {
  createHighlightCandidates,
  createHighlightSpans,
  selectHighlightCandidates
} from "../core/highlight-engine";

describe("createHighlightSpans", () => {
  it("exposes stable legal candidates so another ranker can use the same selection budget", () => {
    const text = "人工智能可以分析语义角色，本地算法负责词边界和视觉间距。";
    const candidates = createHighlightCandidates(text);
    const modelRanked = candidates.map((candidate) => ({
      ...candidate,
      score: candidate.text === "语义" || candidate.text === "算法" ? 10 : 0
    }));
    const selected = selectHighlightCandidates(text.length, modelRanked);

    expect(candidates.map((candidate) => candidate.id)).toEqual(candidates.map((_, index) => `c${index}`));
    expect(selected.every((span) => text.slice(span.start, span.end).length > 0)).toBe(true);
    expect(selected.some((span) => ["语义", "算法"].includes(text.slice(span.start, span.end)))).toBe(true);
  });

  it("starts the reading track at the earliest strong anchor instead of skipping ahead", () => {
    const candidates = [
      { id: "c0", text: "核心", start: 0, end: 2, score: 4, kind: "token" as const },
      { id: "c1", text: "判断", start: 4, end: 6, score: 4, kind: "token" as const }
    ];

    expect(selectHighlightCandidates(8, candidates)).toEqual([
      { start: 0, end: 2 },
      { start: 4, end: 6 }
    ]);
  });

  it("keeps Latin, numeric, and mixed-language terms as legal candidates", () => {
    const text = "AI、LLM 和 API 正在改变产品，MiniMax-M3 负责语义排序。";
    const candidates = createHighlightCandidates(text).map((candidate) => candidate.text.replace(/\s/g, ""));

    expect(candidates).toContain("AI");
    expect(candidates).toContain("LLM");
    expect(candidates).toContain("API");
    expect(candidates.some((candidate) => candidate.includes("MiniMax"))).toBe(true);
  });

  it("offers complete compound and relationship phrases without breaking word boundaries", () => {
    const text = "AI 在产品中的应用会影响知识管理，用户反馈表明边际成本有待观察，因此不会选择盲目增加功能。";
    const candidates = createHighlightCandidates(text).map((candidate) => candidate.text.replace(/\s/g, ""));

    for (const phrase of ["产品中的应用", "知识管理", "用户反馈", "边际成本", "有待观察", "不会选择"]) {
      expect(candidates).toContain(phrase);
    }
  });

  it("selects complete Chinese words instead of fixed character intervals", () => {
    const text = "一款真正好用的浏览器阅读插件，应该在当前网页内快速进入阅读状态，并保持排版稳定。";
    const spans = createHighlightSpans(text);
    const selections = spans.map((span) => text.slice(span.start, span.end));

    expect(spans.length).toBeGreaterThan(3);
    expect(selections.some((selection) => ["浏览器", "阅读", "插件"].includes(selection))).toBe(true);
    expect(new Set(selections.map((selection) => selection.length)).size).toBeGreaterThan(1);
  });

  it("never selects punctuation, common function words, overlaps, or broken boundaries", () => {
    const text = "高亮只是引导视线的一层，正文抽取、页面兼容和退出恢复同样重要。";
    const spans = createHighlightSpans(text);

    for (const [index, span] of spans.entries()) {
      const selection = text.slice(span.start, span.end);
      expect(selection).toMatch(/[\p{Script=Han}\p{Letter}\p{Number}]/u);
      expect(["的", "了", "是", "在", "和", "也", "都"].includes(selection)).toBe(false);
      expect(span.start).toBeLessThan(span.end);
      if (index > 0) {
        const previous = spans[index - 1];
        expect(previous).toBeDefined();
        if (previous) expect(span.start).toBeGreaterThanOrEqual(previous.end);
      }
    }
  });

  it("keeps a reference-like anchor density without merging adjacent selections", () => {
    const text = "浏览器阅读插件不应该强迫读者离开当前页面，而应该安静地增强原有文字，同时保留链接和页面布局。";
    const spans = createHighlightSpans(text);
    const highlightedCharacters = spans.reduce((total, span) => total + span.end - span.start, 0);
    const coverage = highlightedCharacters / text.length;

    expect(coverage).toBeGreaterThanOrEqual(0.25);
    expect(coverage).toBeLessThanOrEqual(0.5);
    for (let index = 1; index < spans.length; index += 1) {
      const previous = spans[index - 1];
      const current = spans[index];
      expect(previous).toBeDefined();
      expect(current).toBeDefined();
      if (previous && current) expect(current.start - previous.end).toBeGreaterThanOrEqual(1);
    }
  });

  it("prefers domain-bearing phrases over low-information generic words", () => {
    const text = "主要是两部分，前部分讨论人工智能在产品中的应用，后半部分讨论知识管理的影响，内容有所删减和修改。";
    const selections = createHighlightSpans(text).map((span) => text.slice(span.start, span.end));

    expect(selections.some((selection) => ["人工智能", "产品", "应用", "知识", "管理", "影响"].includes(selection))).toBe(true);
    expect(selections).not.toContain("部分");
    expect(selections).not.toContain("前部分");
    expect(selections).not.toContain("后半部");
    expect(selections).not.toContain("内容");
  });

  it("is deterministic and returns no spans for non-content text", () => {
    const text = "阅读工具应当尊重原网页，同时提供稳定的视觉引导。";

    expect(createHighlightSpans(text)).toEqual(createHighlightSpans(text));
    expect(createHighlightSpans("的了是在和，也都。" )).toEqual([]);
  });
});
