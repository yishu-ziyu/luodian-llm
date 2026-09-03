# TillGlance 关键代码段摘录

> 来源：`~/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-1-decompile/beautified/*.beauty.js`
> 注释：中文

---

## 一、nlphl POST 构造 + 响应解析

### 1.1 background.bundle.js 收到 "nlphl" action 后的 fetch

**文件**：`background.bundle.beauty.js`
**位置**：第 218-237 行

```javascript
case "nlphl":
    return fetch(e.api, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: e.body  // 直接是 content 端 JSON.stringify(q.contentDict) 的字符串
    }).then(e => (p = e.headers.get("X-Tg-Version"), e.json()))  // 读自定义响应头拿 NLP 版本
    .then(e => {
        n({                          // n 是 sendResponse
            result: e,               // NLP 返回的高亮偏移数组
            serverVersion: p         // 来自 X-Tg-Version header
        })
    }).catch(e => {
        n({
            error: {
                title: "error_load_highlight",
                msg: "error_load_net"
            }
        })
    }), !0;
```

### 1.2 API endpoint 解析（启动时拉 api.json）

**文件**：`background.bundle.beauty.js`
**位置**：第 130-141 行（`I` 函数内）

```javascript
// e=tabId, t=null
"complete" === n.get(e) && (function(e, t) {
    // 拉 extension 自带的 api.json 配置
    fetch(h + "/api.json").then(e => e.json()).then(n => {
        var o = n.base + n.nlphl;            // 拼 endpoint
        y(e, t, o)                            // 触发 content 脚本发起 highlight
    }).catch(n => {
        // 拿不到配置走 hardcode fallback
        y(e, t, "https://api.tillglance.com/nlphl")
    })
}(e, t), c.set(e, "finished"))
```

> `h` 是 `chrome.runtime.getURL("/")`（extension 根 URL）。`api.json` 是 dist 里一个静态文件，4 个 bundle 里都看不到，靠 `n.base` + `n.nlphl` 拼出 endpoint。

### 1.3 app.bundle.js 监听 "nlphl" CustomEvent → 转发给 background

**文件**：`app.bundle.beauty.js`
**位置**：第 149-163 行

```javascript
t.addEventListener("nlphl", (function(s) {
    // s.detail.body = 已 JSON.stringify 的 contentDict
    chrome.runtime.sendMessage({
        action: "nlphl",
        tabId: e.tabId,
        api: e.api,                  // 来自 background 推过来的 endpoint
        body: s.detail.body
    }, e => {
        if (e.result) {
            // 成功：把 result 写到 container 的 data-hl 属性
            t.setAttribute("data-hl", JSON.stringify(e.result));
            t.children[0].shadowRoot.querySelector("#hl-ver").innerText = e.serverVersion;
        } else {
            // 失败：累计到 data-bgerrors，等下个 change 一起展示
            var s = t.getAttribute("data-bgerrors");
            (s = s && "undefined" !== s && void 0 !== s ? JSON.parse(s) : []).push(e.error);
            t.setAttribute("data-bgerrors", JSON.stringify(s));
        }
        t.dispatchEvent(new CustomEvent("change"));  // 通知 ext 那边
    })
})),
```

### 1.4 ext.bundle.js 触发 nlphl 请求（首次没有 data-hl 时）

**文件**：`ext.bundle.beauty.js`
**位置**：第 429-437 行（`ne()` 函数末尾）

```javascript
} else {
    if (O) return;                                              // 已经有结果就不重发
    if (!document.querySelector("#tillglance-container")) return;
    // 派发 nlphl 事件，body 字段 = z = JSON.stringify(q.contentDict)
    document.querySelector("#tillglance-container").dispatchEvent(new CustomEvent("nlphl", {
        detail: {
            body: z
        }
    }))
}
```

> `z` 是全局变量，在 `ext.bundle.beauty.js:953` 赋值：`z = JSON.stringify(q.contentDict)`，其中 `q` 是 Mozilla Readability 解析后的 article 对象。

---

## 二、高亮注入 DOM（怎么把 highlight 数组变成 span 标签）

### 2.1 核心注入函数 `ne()`

**文件**：`ext.bundle.beauty.js`
**位置**：第 399-441 行

```javascript
function ne() {
    if (O) {                                                      // O = JSON.parse(data-hl)，NLP 返回结果
        if (!W) {                                                 // W 是已渲染标志位，防重复
            // 1) 把可读性清洗后的内容塞进 Shadow DOM
            document.querySelector("#tillglance-root").shadowRoot.querySelector("#content").innerHTML = q.content;

            // 2) 拿 highlight 模板（"<span class="hl-XXX"><hl></hl></span>"）
            var e, t, n, i = 0,
                r = Object.keys(O).length,                        // 段落总数
                o = document.querySelector("#tillglance-root").shadowRoot.querySelector("#hl-template");
            o && (o = o.innerHTML,
                  t = o.substr(0, o.indexOf(">") + 1),            // 开标签：<span class="hl-XXX">
                  n = o.substr(o.indexOf(">") + 1)                // 闭标签：</span>
            );

            // 3) 串行处理每段（避免一次性 reflow）
            (function l() {
                let c = !!document.querySelector("#tillglance-root")
                    && document.querySelector("#tillglance-root").shadowRoot.querySelector("#readability-page-1");
                if (!c || !o) return void(e && window.cancelAnimationFrame(e));

                let u = O[i];                                      // 第 i 段的高亮偏移数组
                if (u) {
                    let e = c.querySelector("#rr" + i);            // 找第 i 段（contentDict 里 id=rr0,rr1...）
                    if (e) {
                        let i = e.textContent,
                            r = 0;
                        // 4) 逐对 [start, length] 处理
                        for (var d = new a.a(document.querySelector("#tillglance-root").shadowRoot, ".heti"),
                             h = 0; h < u.length; h += 2) {
                            let e = u[h] + r,                       // 加上前序 wrapper 字符累计
                                a = e + u[h + 1];                   // 区间结束位置
                            const l = i.slice(e, a);                // 原文切片
                            let [c, d, f] = s(i, a),                 // [rest, anchor, isLast]
                                m = "";
                            // 5) 逐字包 wrapper（高亮粒度是字符）
                            for (var p = 0; p < l.length; p++) {
                                f && p === l.length - 1
                                    ? (a = d, m += t + l[p] + c + n)  // 最后一段要拼 anchor
                                    : m += t + l[p] + n;
                            }
                            i = i.slice(0, e) + m + i.slice(a);
                            r += o.length * l.length;                // 累计 wrapper 长度
                        }
                        e.innerHTML = i;
                        te();                                        // 清旧高亮缓存
                        d.spacingElement(e);                         // heti 重算字间距
                    }
                }
                // 6) requestAnimationFrame 串行
                (i += 1) >= r ? e && (W = !0, window.cancelAnimationFrame(e))
                              : e = window.requestAnimationFrame(l);
            })();
        }
    } else {
        // 没结果就发请求（见 1.4）
        if (O) return;
        if (!document.querySelector("#tillglance-container")) return;
        document.querySelector("#tillglance-container").dispatchEvent(new CustomEvent("nlphl", {
            detail: { body: z }
        }));
    }

    function s(e, t) {
        return [e.slice(t), t, !1]
    }
}
```

### 2.2 hl-template 真身

**文件**：`ext.bundle.html`
**位置**：第 1769-1771 行

```html
<div id="hl-template" style="display:none">
  <span class="hl-35pKkp"><hl></hl></span>
</div>
```

> class `hl-35pKkp` 是 webpack 编译产物 hash，颜色走 CSS 变量和主题切换。**不用 `<mark>`**。

### 2.3 响应消费起点：data-hl 属性变化触发 ne()

**文件**：`ext.bundle.beauty.js`
**位置**：第 646 行

```javascript
// data-hl 由 app.bundle.js 写入（见 1.3），这里读取触发渲染
t = J("data-hl", ""),                                       // J = getAttribute
document.querySelector("#tillglance-container").removeAttribute("data-hl"),
t && (O = JSON.parse(t), ne()),                            // 解析响应，调 ne() 注入
```

### 2.4 强度调节也走 ne() 重渲染

**文件**：`ext.bundle.beauty.js`
**位置**：第 891, 1021 行

```javascript
// 用户调"眺览强度"滑块
parseInt(e.target.value) > -17 && Q("highlight_density", 0) <= -17 && ne(),
Z("highlight_density", e.target.value)

// 主题切换后
Q("highlight_density", 0) > -17 ? ne() : new a.a(...).autoSpacing()
```

---

## 三、contentDict 构造（段落提取成 `{paragraphId: text}`）

### 3.1 入口：parse() → _postProcessContent

**文件**：`ext.bundle.beauty.js`
**位置**：第 2289-2319 行

```javascript
parse: function() {
    if (this._maxElemsToParse > 0) {
        var e = this._doc.getElementsByTagName("*").length;
        if (e > this._maxElemsToParse) throw new Error("Aborting parsing document; " + e + " elements found")
    }
    this._unwrapNoscriptImages(this._doc);
    var t = this._disableJSONLD ? {} : this._getJSONLD(this._doc);
    this._removeScripts(this._doc), this._prepDocument();
    var n = this._getArticleMetadata(t);
    this._articleTitle = n.title;
    var i = this._grabArticle();                          // Mozilla Readability 主抓取逻辑
    if (!i) return null;
    this.log("Grabbed: " + i.innerHTML);
    var r = this._postProcessContent(i);                  // ← 这里开始改 DOM 加 rr{id}
    if (!n.excerpt) {
        var o = i.getElementsByTagName("p");
        o.length > 0 && (n.excerpt = o[0].textContent.trim())
    }
    var a = i.textContent;
    return {
        title: this._articleTitle,
        byline: n.byline || this._articleByline,
        dir: this._articleDir,
        content: this._serializer(i),
        textContent: a,
        length: a.length,
        excerpt: n.excerpt,
        contentDict: r.contentDict,                        // ← 返回给 q.contentDict
        firstChar: r.firstChar,                            // ← 首字下沉用
        siteName: n.siteName || this._articleSiteName
    }
}
```

### 3.2 _postProcessContent 创建状态对象

**文件**：`ext.bundle.beauty.js`
**位置**：第 1495-1503 行

```javascript
_postProcessContent: function(e) {
    this._fixRelativeUris(e), this._simplifyNestedElements(e), this._keepClasses || this._cleanClasses(e);
    var t = {
        tagId: 0,                  // 段落自增 id
        contentDict: {},           // ← 最终的 {0: text0, 1: text1, ...}
        firstChar: ""              // 首字（汉字）
    };
    return this._idForHighlight(e, t), t
},
```

### 3.3 _idForHighlight 核心逻辑（递归遍历 DOM 打 id）

**文件**：`ext.bundle.beauty.js`
**位置**：第 1562-1581 行

```javascript
_idForHighlight: function(e, t) {
    let [n, i] = this._processTextNodes(e);
    // n = 拼接后的纯文本，i = textNode 数量
    if (i === e.childNodes.length) {                        // 该节点是「纯文本叶子」才进
        let i = n.trim().length;
        if (this.HIGHLIGHT_ELEMS.has(e.tagName) && (!e.id || !e.id.startsWith("rr"))) {
            let r = !n.match(this.REGEXPS.tagBlacklist);     // 过滤 code/script/style 等
            // 长度门槛：P 段 ≥10 字、其他 ≥20 字、黑名单元素 ≥30 字
            let passLength = (
                (r && "P" !== e.tagName && i >= 20) ||
                (r && "P" === e.tagName && i >= 10) ||
                (!r && i >= 30)
            );
            if (passLength) {
                e.id = "rr" + t.tagId;                       // ← 关键：给 DOM 节点打 id="rr{i}"
                t.contentDict[t.tagId] = n;                  // ← 关键：text 进 dict
                if (!t.firstChar) {
                    const e = n.match(this.REGEXPS.chineseChars);
                    for (let n in e) { t.firstChar = e[n]; break; }   // 抓第一个汉字
                }
                t.tagId += 1;
            }
        }
    }
    for (e = e.firstElementChild; e; e = e.nextElementSibling) this._idForHighlight(e, t);  // 递归
},
```

### 3.4 HIGHLIGHT_ELEMS（哪些 tagName 算段落）

**文件**：`ext.bundle.beauty.js`
**位置**：第 1486 行（注释里说类比 Mozilla Readability）

```javascript
PHRASING_ELEMS: ["ABBR", "AUDIO", "B", "BDO", "BR", "BUTTON", "CITE", "CODE", "DATA", "DATALIST", "DFN",
                 "EM", "EMBED", "I", "IMG", "INPUT", "KBD", "LABEL", "MARK", "MATH", "METER", "NOSCRIPT",
                 "OBJECT", "OUTPUT", "PROGRESS", "Q", "RUBY", "SAMP", "SCRIPT", "SELECT", "SMALL", "SPAN",
                 "STRONG", "SUB", "SUP", "TEXTAREA", "TIME", "VAR", "WBR"]
// HIGHLIGHT_ELEMS 应该是 P / H1-H6 / LI / BLOCKQUOTE / FIGCAPTION 等块级元素
// 这块在代码里被引用了，但具体 Set 字面量在更早位置（unminified 后丢了注释）
```

### 3.5 _processTextNodes 收集纯文本

**文件**：`ext.bundle.beauty.js`
**位置**：第 1549-1561 行

```javascript
_processTextNodes: function(e) {
    for (var t = "", n = [], i = e.childNodes.length, r = 0; r < i; ++r)
        e.childNodes[r].nodeType === Node.TEXT_NODE && (t += e.childNodes[r].textContent, n.push(e.childNodes[r]));
    var o = n.length;
    if (o !== e.childNodes.length)
        for (r = 0; r < o; ++r) {
            var a = n[r].textContent;
            if (a.trim().length > 0) {
                var s = document.createElement("span");
                s.innerText = a, n[r].replaceWith(s)
            }
        }
    return [t, o]
},
```

> 把节点里所有 textNode 拼起来返回 `[拼接文本, textNode数量]`。
> 如果节点里混了元素子节点（o !== childNodes.length），把每个 textNode 包成 `<span>` 让结构变纯文本+span。

### 3.6 串起来：z = JSON.stringify(q.contentDict)

**文件**：`ext.bundle.beauty.js`
**位置**：第 953 行

```javascript
// U = new Readability(document.cloneNode(true))
// U._noImg = "true" == e  (用户关掉图片)
q = U.parse(),                                // 走 §3.1-3.5
c(),                                          // 关 loading 图标
z = JSON.stringify(q.contentDict),            // ← 最终发给 NLP 的 body
fetch(F + "ext.bundle.html").then(e => e.text()).then((function(e) {
    // 拉 HTML 模板，填占位符，构造 Shadow DOM
    var n = e;
    n = (n = (n = (n = (n = n.replace(/url\((?!data)/g, "url(" + F))
                       .replace(/%\{this\.url\}/g, F))
               .replace(/%\{this\.article\.firstChar\}/g, q.firstChar))
       .replace(/%\{this\.toTitleCase\(this\.article\.title\)\}/g, q.title.replace(/\w\S*/g, ...))
    ).replace(/%\{this\.article\.content\}/g, q.content);
    // ...
});
```

> `z` 长这样：`{"0":"第一段原文","1":"第二段原文","2":"第三段原文",...}`
> key 是字符串数字（`tagId` 自增后转字符串），value 是段落原文。
> 段落在 DOM 里对应 `<p id="rr0">`、`<h2 id="rr1">` 等，selectable 通过 `#rr${i}`。

---

## 四、其他有用的小片段

### 4.1 CSP 违规监听（防 API 被 CSP 挡）

**文件**：`ext.bundle.beauty.js`
**位置**：第 209 行

```javascript
function N(e) {
    e.blockedURI.toString().match(/tillglance.*nlphl/g)
        && E("error_load_highlight", "error_load_csp"),
    e.blockedURI.toString().match(/update\.json/g)
        && E("error_load_update", "error_load_csp")
}
```

### 4.2 容器构建入口（用户点图标后整个 extension 启动）

**文件**：`ext.bundle.beauty.js`
**位置**：第 432-436 行

```javascript
if (!document.querySelector("#tillglance-container")) return;
document.querySelector("#tillglance-container").dispatchEvent(new CustomEvent("nlphl", {
    detail: { body: z }
}));
```

### 4.3 message handler 入口（background 推 tabId/open 给 content）

**文件**：`app.bundle.beauty.js`
**位置**：第 188-202 行

```javascript
chrome.runtime.onMessage.addListener((function(e, t, s) {
    var r = document.querySelector("#tillglance-container"),
        i = r ? r.getAttribute("data-tab") : "";
    if (i && e.tabId.toString() !== i) s(null);              // tab 不匹配就不响应
    else {
        var a, n, o = e.open;
        // 选择文字含 5+ 汉字才识别成"用户想看高亮"
        !e.selectionText || (a = e.selectionText, (n = a.match(/\p{sc=Han}/gu)) && n.length >= 5) || (e.selectionText = "");
        o ? (null === document.querySelector("#tillglance-container") || l(!0), new d(e), s({ tabId: e.tabId, state: "open" }))
          : (null !== document.querySelector("#tillglance-container") && l(!1), s({ tabId: e.tabId, state: "close" }));
    }
}));
```

---

## 五、文件位置速查

| 用途 | 文件 | 关键行 |
|---|---|---|
| NLP POST 构造 | `beautified/background.bundle.beauty.js` | 218-237 |
| API endpoint 解析 | `beautified/background.bundle.beauty.js` | 130-141 |
| content → background 转发 | `beautified/app.bundle.beauty.js` | 149-163 |
| 高亮 DOM 注入 `ne()` | `beautified/ext.bundle.beauty.js` | 399-441 |
| hl-template 定义 | `~/Desktop/黑客松/眺览二次开发/original-tillglance-extension/ext.bundle.html` | 1769-1771 |
| `data-hl` → `ne()` 触发 | `beautified/ext.bundle.beauty.js` | 646 |
| contentDict 提取 parse() | `beautified/ext.bundle.beauty.js` | 2289-2319 |
| `_postProcessContent` | `beautified/ext.bundle.beauty.js` | 1495-1503 |
| `_idForHighlight` | `beautified/ext.bundle.beauty.js` | 1562-1581 |
| `_processTextNodes` | `beautified/ext.bundle.beauty.js` | 1549-1561 |
| `z = JSON.stringify(q.contentDict)` | `beautified/ext.bundle.beauty.js` | 953 |
