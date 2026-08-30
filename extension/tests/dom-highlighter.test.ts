// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  HIGHLIGHT_CLASS,
  startHighlightSession,
  toggleDocumentHighlight
} from "../core/dom-highlighter";

function fixtureDocument(): Document {
  document.body.innerHTML = `
    <header><nav>首页 产品 定价 联系我们</nav></header>
    <main>
      <article>
        <h1>浏览器中的原页阅读增强</h1>
        <p id="first">一款真正好用的浏览器阅读插件，应当在当前网页内快速工作，并且尊重原有排版。</p>
        <p id="second">它需要保留<a id="source-link" href="/source">原始链接</a>、<strong id="existing-bold">已有粗体强调</strong>和文字选择能力。</p>
        <p id="third">普通正文旁边还有<span id="existing-color" style="color: rgb(20, 90, 180)">已有彩色强调</span>，插件不应重复争夺注意力。</p>
        <pre><code>const highlighted = false;</code></pre>
      </article>
    </main>
    <footer>版权信息和网站导航不会被处理</footer>
  `;
  return document;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("toggleDocumentHighlight", () => {
  it("highlights only readable content and restores the exact page on the second toggle", () => {
    const doc = fixtureDocument();
    const beforeHtml = doc.body.innerHTML;
    const beforeText = doc.body.textContent;
    const beforeHref = doc.querySelector<HTMLAnchorElement>("#source-link")?.getAttribute("href");

    const enabled = toggleDocumentHighlight(doc);

    expect(enabled.enabled).toBe(true);
    expect(enabled.highlightCount).toBeGreaterThan(0);
    expect(doc.querySelectorAll(`main .${HIGHLIGHT_CLASS}`).length).toBeGreaterThan(0);
    expect(doc.querySelectorAll(`h1 .${HIGHLIGHT_CLASS}, h2 .${HIGHLIGHT_CLASS}, h3 .${HIGHLIGHT_CLASS}`)).toHaveLength(0);
    expect(doc.querySelectorAll(`nav .${HIGHLIGHT_CLASS}, footer .${HIGHLIGHT_CLASS}, code .${HIGHLIGHT_CLASS}`)).toHaveLength(0);
    expect(doc.querySelectorAll(`a .${HIGHLIGHT_CLASS}, strong .${HIGHLIGHT_CLASS}, b .${HIGHLIGHT_CLASS}, mark .${HIGHLIGHT_CLASS}`)).toHaveLength(0);
    expect(doc.querySelectorAll(`#existing-color .${HIGHLIGHT_CLASS}`)).toHaveLength(0);
    expect(doc.body.textContent).toBe(beforeText);
    expect(doc.querySelector<HTMLAnchorElement>("#source-link")?.getAttribute("href")).toBe(beforeHref);

    const disabled = toggleDocumentHighlight(doc);

    expect(disabled).toMatchObject({ enabled: false, highlightCount: 0 });
    expect(doc.querySelectorAll(`.${HIGHLIGHT_CLASS}`)).toHaveLength(0);
    expect(doc.body.innerHTML).toBe(beforeHtml);
  });

  it("processes newly inserted article paragraphs without observing its own wrappers forever", async () => {
    vi.useFakeTimers();
    const doc = fixtureDocument();
    const session = startHighlightSession(doc);
    const initialCount = doc.querySelectorAll(`.${HIGHLIGHT_CLASS}`).length;
    const article = doc.querySelector("article");
    const dynamic = doc.createElement("p");
    dynamic.id = "dynamic";
    dynamic.textContent = "动态加载的正文同样应该获得本地落点，同时不能触发无限处理循环。";
    article?.append(dynamic);

    await vi.advanceTimersByTimeAsync(120);
    const afterDynamic = doc.querySelectorAll(`.${HIGHLIGHT_CLASS}`).length;
    await vi.advanceTimersByTimeAsync(500);

    expect(dynamic.querySelectorAll(`.${HIGHLIGHT_CLASS}`).length).toBeGreaterThan(0);
    expect(afterDynamic).toBeGreaterThan(initialCount);
    expect(doc.querySelectorAll(`.${HIGHLIGHT_CLASS}`).length).toBe(afterDynamic);

    session.stop();
    expect(doc.querySelectorAll(`.${HIGHLIGHT_CLASS}`)).toHaveLength(0);
  });

  it("does not process nested paragraph containers twice", () => {
    document.body.innerHTML = `
      <main><article><blockquote><p id="quoted">嵌套在引用块里的中文段落只能被处理一次，不能形成重复包裹。</p></blockquote></article></main>
    `;
    const before = document.body.innerHTML;

    const result = toggleDocumentHighlight(document);

    expect(result.enabled).toBe(true);
    expect(document.querySelectorAll(`.${HIGHLIGHT_CLASS} .${HIGHLIGHT_CLASS}`)).toHaveLength(0);
    toggleDocumentHighlight(document);
    expect(document.body.innerHTML).toBe(before);
  });

  it("uses a full-glyph irregular brush field rather than a flat band or uniform dots", () => {
    const doc = fixtureDocument();
    toggleDocumentHighlight(doc);
    const style = doc.querySelector<HTMLStyleElement>("#luodian-original-page-highlight-style")?.textContent || "";

    expect((style.match(/radial-gradient/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(style).toContain("ellipse 96% 88%");
    expect(style).not.toContain("linear-gradient");
  });
});
