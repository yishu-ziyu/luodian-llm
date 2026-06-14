# TillGlance 反编译分析

> 反编译对象：`~/Downloads/眺览/{app,ext,background,tut}.bundle.js`
> 工具：`npx js-beautify`（格式化到 `beautified/*.beauty.js`）
> 目的：定位 NLP highlight 调用的三段关键逻辑——POST 构造、DOM 注入、contentDict 构造

---

## 0. 整体调用链概览

```
用户点工具栏图标
  → background.bundle.js 收到 click，状态置 pending → complete 后调用 y(tabId, apiUrl)
  → content_scripts（app.bundle.js）dispatch "nlphl" CustomEvent 到 #tillglance-container
  → app.bundle.js 监听 "nlphl" → chrome.runtime.sendMessage(action="nlphl", api, body)
  → background.bundle.js 监听 onMessage → fetch(api, POST, body=contentDict) → 返回 result 给 content
  → app.bundle.js 把 result 写到 #tillglance-container 的 data-hl 属性 + 触发 change
  → ext.bundle.js 监听 container 属性变化 → 调 ne() → 注入 <span class="hl-..."><hl></hl></span>
```

整个 ext.bundle.js 是个 React-style 单页 app，包裹在 Shadow DOM（`#tillglance-root`）里。

---

## 1. nlphl POST 构造 + 响应解析

**位置**：`background.bundle.beauty.js:218-237`（`chrome.runtime.onMessage` 里的 `case "nlphl"` 分支）

**做了什么**：

- 接收 content 端通过 `chrome.runtime.sendMessage` 发来的 `{action, tabId, api, body}`
- 用 `fetch(api, {method:"POST", headers:{"Content-Type":"application/json"}, body})` 把 body 原文发出
- **响应头解析**：从 `e.headers.get("X-Tg-Version")` 读出 NLP 模型版本号 `p`（这是和服务端约好的自定义 header）
- **响应体解析**：`e.json()` 拿到 result 后回传 `{result, serverVersion}`；网络失败回传 `{error:{title:"error_load_highlight", msg:"error_load_net"}}`

**API 域名怎么来的**（`background.bundle.beauty.js:130-141`）：

- 启动时 `fetch(h + "/api.json")`，`h` 是 `h = chrome.runtime.getURL("/")`（extension 自身根目录）
- 拿 `api.json` 里的 `base` + `nlphl` 拼出 endpoint；拿不到就 fallback `https://api.tillglance.com/nlphl`
- `api.json` 是 dist 目录下的一个静态配置文件（不在四个 bundle 里）

**Body 内容**：直接是 `JSON.stringify(q.contentDict)`——也就是从可读性清洗后的文章里抽出的 `{paragraphId: paragraphText}` 字典。`api` 字段在 content 端组装时是 `e.api`，看起来就是上面 `y(e, t, o)` 传进来的 endpoint URL。

**伪代码**：

```javascript
// background.bundle.js
async function handleNlphl(req, sender, sendResponse) {
  try {
    const res = await fetch(req.api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: req.body,  // 原文发，content 端已 JSON.stringify
    });
    const serverVersion = res.headers.get("X-Tg-Version");
    const result = await res.json();
    sendResponse({ result, serverVersion });
  } catch (e) {
    sendResponse({ error: { title: "error_load_highlight", msg: "error_load_net" } });
  }
}

// 启动时拉 endpoint
fetch(extensionRoot + "/api.json")
  .then(r => r.json())
  .then(cfg => { apiUrl = cfg.base + cfg.nlphl })
  .catch(() => { apiUrl = "https://api.tillglance.com/nlphl" });
```

**响应 shape（推断）**：

```json
{
  "0": [start1, len1, start2, len2, ...],
  "1": [start1, len1, ...],
  ...
}
```

外层 key 是 paragraphId（数字字符串，"0"/"1"/"2"...），value 是 `[start, length, start, length, ...]` 扁平数组的字节偏移量。详细消费逻辑见 §2。

---

## 2. 高亮注入到 DOM（怎么把 highlight 数组变成 span 标签）

**位置**：`ext.bundle.beauty.js:399-441`，函数名 `ne()`。

**触发链**：

1. container 的 `data-hl` 属性被 content 端写入（`ext.bundle.beauty.js:646`）
2. `MutationObserver` 触发 change 回调，把 `data-hl` JSON.parse 到全局变量 `O`
3. 调用 `ne()` 走动画注入流程

**做了什么（核心 8 行逻辑）**：

```javascript
let r = Object.keys(O).length;                                  // 段落数
let o = document.querySelector("#hl-template").innerHTML;       // "<span class="hl-XXX"><hl></hl></span>"
let t = o.substr(0, o.indexOf(">") + 1);                        // 开标签 "<span class="hl-XXX">"
let n = o.substr(o.indexOf(">") + 1);                           // 闭标签 "</span>"

function applyOne(i) {
  let e = readabilityPage.querySelector("#rr" + i);             // 找第 i 段（contentDict 里 id=rr0,rr1...）
  let text = e.textContent;
  let offsets = O[i];                                            // [start, len, start, len, ...]
  let r = 0;                                                     // 累计 wrapper 字符偏移
  for (let h = 0; h < offsets.length; h += 2) {
    let start = offsets[h] + r;
    let end = start + offsets[h + 1];
    let slice = text.slice(start, end);                          // 原文片段（可能多字符）
    let [rest, anchor, isLast] = s(text, end);
    let wrapped = "";
    for (let p = 0; p < slice.length; p++) {
      // 每个字符单独包一层 wrapper（高亮粒度是「字」，不是「词」）
      if (isLast && p === slice.length - 1) {
        wrapped += t + slice[p] + anchor + n;                    // 最后一段需要把 anchor 文本再拼回去
      } else {
        wrapped += t + slice[p] + n;
      }
    }
    text = text.slice(0, start) + wrapped + text.slice(end);
    r += o.length * slice.length;                                // wrapper 长度累计
  }
  e.innerHTML = text;
  spacingEngine(e);                                              // heti 自动间距
}

// 用 requestAnimationFrame 逐段应用，避免一次性 reflow
requestAnimationFrame(function loop() {
  applyOne(i++);
  if (i < r) requestAnimationFrame(loop);
});
```

**关键观察**：

- **不用 `<mark>`**，用 `<span class="hl-XXX"><hl></hl></span>`（从 `#hl-template` 取模板）
- 高亮粒度是**单字**，不是词——循环里逐个字符包 wrapper
- 用 `requestAnimationFrame` 串行处理每段，UI 不卡顿
- 处理完一段后调 `te()` + `d.spacingElement(e)` 重跑 heti 排版引擎（保字间距）
- `s(text, end)` 是个 helper，意图是检测「slice 之后还有没有正文」——如果 slice 一直延伸到段尾就标记 isLast，把 anchor 拼回避免吞字

**hl-template 真身**（`ext.bundle.html` 1769 行）：

```html
<div id="hl-template" style="display:none">
  <span class="hl-35pKkp"><hl></hl></span>
</div>
```

class 名 `hl-35pKkp` 是 webpack 编译产物 hash，不是高亮颜色。颜色走 CSS 变量 `--highlight-color` + 主题切换。

---

## 3. contentDict 构造（段落提取成 `{paragraphId: text}`）

**位置**：`ext.bundle.beauty.js:1495-1581`，`_postProcessContent` + `_idForHighlight`（这是从 Mozilla Readability 抄来再改的版本）。

**调用链**：

1. `ext.bundle.beauty.js:2289-2319` 的 `parse()` 调 `this._postProcessContent(i)`，把可读性清洗后的 article DOM 节点 `i` 传进去
2. `_postProcessContent` 创建 `{tagId: 0, contentDict: {}, firstChar: ""}` 状态对象，递归调 `_idForHighlight(node, state)`
3. `_idForHighlight` 走 DOM 树，对每个符合条件的文本节点打 `id="rr{tagId}"` 并把 textContent 塞进 `contentDict[tagId]`

**`_idForHighlight` 详细规则**（`ext.bundle.beauty.js:1562-1581`）：

```javascript
_idForHighlight(node, state) {
  let [text, textNodeCount] = this._processTextNodes(node);  // 收集所有 text node 的拼接 text
  if (textNodeCount === node.childNodes.length) {            // 该节点只含文本（无元素子节点）
    let trimmedLen = text.trim().length;
    if (HIGHLIGHT_ELEMS.has(node.tagName) && (!node.id || !node.id.startsWith("rr"))) {
      let allowed = !text.match(REGEXPS.tagBlacklist);        // 过滤掉 code/script/style 等
      let passLength = (
        (allowed && node.tagName !== "P" && trimmedLen >= 20) ||
        (allowed && node.tagName === "P" && trimmedLen >= 10) ||
        (!allowed && trimmedLen >= 30)
      );
      if (passLength) {
        node.id = "rr" + state.tagId;
        state.contentDict[state.tagId] = text;                 // ← 关键：text 不是 textContent，是 raw textNode 拼接
        if (!state.firstChar) {
          const m = text.match(REGEXPS.chineseChars);
          if (m) state.firstChar = m[0];                      // 抓第一个汉字做首字下沉用
        }
        state.tagId += 1;
      }
    }
  }
  for (let child = node.firstElementChild; child; child = child.nextElementSibling) {
    this._idForHighlight(child, state);                       // 递归
  }
}
```

**伪代码**：

```javascript
function extractContentDict(articleDom) {
  const state = { tagId: 0, contentDict: {}, firstChar: "" };
  walkAndTag(articleDom, state);
  return state;  // {tagId, contentDict: {"0": "...", "1": "..."}, firstChar}
}

function walkAndTag(node, state) {
  if (isTextOnlyLeaf(node) && isHighlightable(node) && lengthOk(node)) {
    node.id = "rr" + state.tagId;
    state.contentDict[state.tagId] = collectText(node);
    if (!state.firstChar) state.firstChar = firstChineseChar(collectText(node));
    state.tagId += 1;
  }
  for (let c = node.firstElementChild; c; c = c.nextElementSibling) {
    walkAndTag(c, state);
  }
}
```

**关键设计**：

- **段落边界** = `HIGHLIGHT_ELEMS` 集合里的 tagName（P/H1-H6/LI/BLOCKQUOTE 等 Mozilla Readability 那一套）
- **长度门槛**：P 段 ≥10 字符才进 dict，其他 ≥20，黑名单元素 ≥30
- **黑名单**：含 `code/script/style/pre` 等的不进（不想高亮代码块）
- **id 用 `rr` 前缀**：和 §2 的 `#rr${i}` selector 严格对应
- **text 用 raw textNode 拼接**（不是 textContent）：`_processTextNodes` 显式逐个 textNode 收集，避开元素子节点的干扰

**最终发给 NLP 的 body**（`ext.bundle.beauty.js:953`）：

```javascript
z = JSON.stringify(q.contentDict);  // q 是 readability parse() 的返回值
// z 形如：{"0":"第一段原文","1":"第二段原文",...}
fetch(F + "ext.bundle.html").then(...);  // 拉页面模板拼 Shadow DOM
```

---

## 4. 一些有用的小事实

- **Shadow DOM 是隔离关键**：所有高亮 DOM 操作都在 `#tillglance-root` 的 shadowRoot 里跑，绕开原页面的 CSS 干扰
- **CSP 兜底**：`ext.bundle.beauty.js:209` 监听 `securitypolicyviolation` 事件，碰到 `tillglance.*nlphl` 域名被 CSP 挡了会发 `error_load_csp` 通知
- **可调强度**：highlight 是 35% 透明度（`#hl-template` 里的 class 名 `hl-35pKkp`），用户改 `highlight_density` 会触发 `ne()` 重渲染（`ext.bundle.beauty.js:891, 1021`）
- **Heti 排版**：每段高亮完后调 `new Heti(shadowRoot, ".heti").spacingElement(e)` 重新算中文字间距
- **API endpoint 灵活**：content 端 `e.api` 是从 `api.json` 拉来的，所以同一份代码能切 dev/prod NLP 服务
- **ext.bundle.html 是模板**：`%{this.article.content}` / `%{this.article.firstChar}` / `%{this.url}` 占位符在 `ext.bundle.js:955-965` 用 `String.replace` 填进去

---

## 5. 没看清/没找的地方（标记风险）

- NLP 响应里 `[start, len, start, len, ...]` 的语义：是字符偏移还是字节偏移？以 §2 逻辑看像字符偏移（`text.slice(start, end)` 拿字符串切片），但没找到 server 侧 schema 文档
- 多个 highlight 是否会重叠：单段内 if/else 看着是分段独立，但跨段的情况 `_idForHighlight` 顺序分配 tagId 应该不会跨段
- `s(text, end)` 这个 helper 看着像是有边界 case 处理（最后一段要保留 anchor），但只看 `s(e, t) { return [e.slice(t), t, !1] }`——返回 `[rest, anchor, isLast]`，isLast 永远是 false。怀疑美化后丢了一个分支（mini 版 vs 完整版），需要再回看一遍原 `ext.bundle.js` 确认
