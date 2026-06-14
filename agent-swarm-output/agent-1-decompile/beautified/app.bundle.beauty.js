! function(e) {
    var t = {};
    function s(r) {
        if (t[r]) return t[r].exports;
        var i = t[r] = {
            i: r,
            l: !1,
            exports: {}
        };
        return e[r].call(i.exports, i, i.exports, s), i.l = !0, i.exports
    }
    s.m = e, s.c = t, s.d = function(e, t, r) {
        s.o(e, t) || Object.defineProperty(e, t, {
            enumerable: !0,
            get: r
        })
    }, s.r = function(e) {
        "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, {
            value: "Module"
        }), Object.defineProperty(e, "__esModule", {
            value: !0
        })
    }, s.t = function(e, t) {
        if (1 & t && (e = s(e)), 8 & t) return e;
        if (4 & t && "object" == typeof e && e && e.__esModule) return e;
        var r = Object.create(null);
        if (s.r(r), Object.defineProperty(r, "default", {
                enumerable: !0,
                value: e
            }), 2 & t && "string" != typeof e)
            for (var i in e) s.d(r, i, function(t) {
                return e[t]
            }.bind(null, i));
        return r
    }, s.n = function(e) {
        var t = e && e.__esModule ? function() {
            return e.default
        } : function() {
            return e
        };
        return s.d(t, "a", t), t
    }, s.o = function(e, t) {
        return Object.prototype.hasOwnProperty.call(e, t)
    }, s.p = "", s(s.s = 0)
}({
    "./javascripts/app.js": function(e, t, s) {
        "use strict";
        s.r(t);
        var r, i, a, n = s("./locales/_locales/zh_CN/messages.json");
        function o(e) {
            let t = {},
                s = e.attributes.length;
            for (var r = 0; r < s; r++) {
                let s = e.attributes[r];
                t[s.name] = s.value
            }
            return t
        }
        function c(e, t) {
            let s = Object.keys(t),
                r = new Set(s);
            for (var i = e.attributes.length - 1; i >= 0; i--) {
                var a = e.attributes[i];
                r.has(a.name) || e.removeAttribute(a.name)
            }
            let n = s.length;
            for (i = 0; i < n; i++) e.setAttribute(s[i], t[s[i]])
        }
        function l(e) {
            document.body.style.display = e ? "none" : "";
            for (var t = document.head.children.length - 1; t >= 0; t--) {
                "tillglance" === document.head.children[t].getAttribute("rm") && document.head.children[t].remove()
            }
            var s = document.body.parentElement.querySelector("#tillglance-container");
            s && s.remove(), c(document.body.parentElement, r), c(document.head, i), c(document.body, a), document.body.style.display = e ? "none" : ""
        }
        class d {
            constructor(e) {
                this.req = e || {}, this.tabId = e.tabId, this.total = e.total, this.url = e.url, this.version = e.version, this.serverVersion = e.serverVersion, this.config = e.config, this.api = e.api, this.update = e.update, this.lang = e.lang, this.init()
            }
            init() {
                this.initTGReadability(), this.showTGReadability()
            }
            initTGReadability() {
                r = o(document.body.parentElement), i = o(document.head), a = o(document.body), this._createReadabilityContainer(), this._setEventListeners()
            }
            showTGReadability() {
                var e, t, s, r, i;
                e = this.url, t = this.lang, (s = document.createElement("style")).innerHTML = "zh-TW" === t ? `\n    @font-face{\n      font-family: 'subset';\n      src: url("${e}SourceHanSansTC-VF.otf.woff2");\n    }\n    ` : `\n    @font-face{\n      font-family: 'subset';\n      src: url("${e}SourceHanSansSC-VF.otf.woff2");\n    }\n    `, s.charset = "UTF-8", s.setAttribute("rm", "tillglance"), document.head.appendChild(s), r = this.url + "ext.bundle.js", (i = document.createElement("script")).src = r, i.defer = "defer", i.charset = "UTF-8", i.setAttribute("rm", "tillglance"), document.head.appendChild(i)
            }
            updateContainerBaseData(e) {
                e.setAttribute("data-tab", this.tabId), e.setAttribute("data-url", this.url), e.setAttribute("data-api", this.api), e.setAttribute("data-version", this.version), e.setAttribute("data-offline", this.config.offline), e.setAttribute("data-total", this.total), e.setAttribute("data-text", this.req.selectionText ? this.req.selectionText : "");
                for (var t = {}, s = Object.keys(n), r = 0; r < s.length; r++) {
                    var i = s[r];
                    "error" === n[i].description && (t[i] = chrome.i18n.getMessage(i))
                }
                e.setAttribute("data-errors", JSON.stringify(t));
                var a = this.req.storage ? this.req.storage : {},
                    o = Object.keys(a);
                for (r = 0; r < o.length; r++) {
                    var c = o[r],
                        l = a[c];
                    e.setAttribute(c, l)
                }
            }
            _createReadabilityContainer() {
                var e, t, s = (e = {
                    type: "asdfklsnfdnfoew",
                    id: "tillglance-container"
                }, (t = document.createElement(e.type.toUpperCase())).id = e.id || "", t.innerHTML = e.innerHTML || "", t);
                this.updateContainerBaseData(s), document.body.parentElement.appendChild(s)
            }
            _setEventListeners() {
                const e = this,
                    t = document.querySelector("#tillglance-container");
                t.addEventListener("getlocalstorage", (function(e) {
                    chrome.runtime.sendMessage({
                        action: "getlocalstorage",
                        key: e.detail.key
                    }, s => {
                        t.setAttribute(e.detail.key, s[e.detail.key]), t.dispatchEvent(new CustomEvent("change"))
                    })
                })), t.addEventListener("setlocalstorage", (function(e) {
                    chrome.runtime.sendMessage({
                        action: "setlocalstorage",
                        key: e.detail.key,
                        value: e.detail.value
                    }, s => {
                        t.setAttribute(e.detail.key, e.detail.value), t.dispatchEvent(new CustomEvent("change"))
                    })
                })), t.addEventListener("back2original", (function(t) {
                    chrome.runtime.sendMessage({
                        action: "back2original",
                        tabId: e.tabId
                    }, e => {})
                })), t.addEventListener("update", (function(s) {
                    chrome.runtime.sendMessage({
                        action: "update",
                        tabId: e.tabId,
                        update: e.update
                    }, e => {
                        if (e.result) t.setAttribute("data-update", JSON.stringify(e.result));
                        else {
                            var s = t.getAttribute("data-bgerrors");
                            (s = s && "undefined" !== s && void 0 !== s ? JSON.parse(s) : []).push(e.error), t.setAttribute("data-bgerrors", JSON.stringify(s))
                        }
                        t.dispatchEvent(new CustomEvent("change"))
                    })
                })), t.addEventListener("nlphl", (function(s) {
                    chrome.runtime.sendMessage({
                        action: "nlphl",
                        tabId: e.tabId,
                        api: e.api,
                        body: s.detail.body
                    }, e => {
                        if (e.result) {
                            t.setAttribute("data-hl", JSON.stringify(e.result)), t.children[0].shadowRoot.querySelector("#hl-ver").innerText = e.serverVersion
                        } else {
                            var s = t.getAttribute("data-bgerrors");
                            (s = s && "undefined" !== s && void 0 !== s ? JSON.parse(s) : []).push(e.error), t.setAttribute("data-bgerrors", JSON.stringify(s))
                        }
                        t.dispatchEvent(new CustomEvent("change"))
                    })
                })), t.addEventListener("clearlocalstorage", (function(s) {
                    chrome.runtime.sendMessage({
                        action: "clearlocalstorage"
                    }, s => {
                        let r = t.attributes.length;
                        for (var i = 0; i < r; i++) {
                            let e = t.attributes[i];
                            e && "id" !== e.name && !e.name.startsWith("data-") && t.removeAttribute(e.name)
                        }
                        e.updateContainerBaseData(t), t.dispatchEvent(new CustomEvent("change"))
                    })
                })), t.addEventListener("setlocalization", (function(s) {
                    for (var r = t.children[0].shadowRoot, i = Object.keys(n), a = 0; a < i.length; a++) {
                        var o = i[a],
                            c = r.querySelector("#" + o);
                        if (c) {
                            var l = chrome.i18n.getMessage(o).replace(/%\{this\.url\}/g, e.url);
                            "" !== n[o].description && "error" !== n[o].description ? c.setAttribute(n[o].description, l) : c.innerHTML = l
                        }
                    }
                    r.querySelector("#ext-ver").innerText = e.version, r.querySelector("#hl-ver").innerText = e.serverVersion
                }))
            }
        }
        chrome.runtime.onMessage.addListener((function(e, t, s) {
            var r = document.querySelector("#tillglance-container"),
                i = r ? r.getAttribute("data-tab") : "";
            if (i && e.tabId.toString() !== i) s(null);
            else {
                var a, n, o = e.open;
                !e.selectionText || (a = e.selectionText, (n = a.match(/\p{sc=Han}/gu)) && n.length >= 5) || (e.selectionText = ""), o ? (null === document.querySelector("#tillglance-container") || l(!0), new d(e), s({
                    tabId: e.tabId,
                    state: "open"
                })) : (null !== document.querySelector("#tillglance-container") && l(!1), s({
                    tabId: e.tabId,
                    state: "close"
                }))
            }
        }))
    },
    "./locales/_locales/zh_CN/messages.json": function(e) {
        e.exports = JSON.parse('{"appName":{"message":"眺览 TillGlance","description":""},"appDesc":{"message":"一目十行的阅读模式","description":""},"exthlop":{"message":"<b>眺览强度</b>","description":""},"exthloff":{"message":"关闭","description":""},"exthlreco":{"message":"推荐","description":""},"tutorial":{"message":"重看首次使用教程","description":""},"extthemematch":{"message":"<b>更改主题与眺览样式</b>","description":""},"themenormaltext":{"message":"标准","description":""},"themecbtext":{"message":"高对比","description":""},"extthemepapercb":{"message":"仿纸+","description":""},"extthemelightcb":{"message":"纯白+","description":""},"extthemegreycb":{"message":"雾灰+","description":""},"extthemedarkcb":{"message":"炭黑+","description":""},"extthemepaper":{"message":"仿纸","description":""},"extthemelight":{"message":"纯白","description":""},"extthemegrey":{"message":"雾灰","description":""},"extthemedark":{"message":"炭黑","description":""},"extthemegreen":{"message":"竹青","description":""},"extthemeyellow":{"message":"稻黄","description":""},"extthemereset":{"message":"重置所有主题与眺览样式组合","description":""},"extthemeresetcancle":{"message":"取消","description":""},"extthemeresetconfirm":{"message":"确定","description":""},"extfont1":{"message":"系统黑体","description":"value"},"extfont2":{"message":"系统宋体","description":"value"},"extfont3":{"message":"思源黑体","description":"value"},"extfont4":{"message":"系统楷体","description":"value"},"extarchievement":{"message":"<b>成就</b>","description":""},"extmetricname":{"message":"累计阅读篇数","description":""},"abouttitle":{"message":"<b>关于我们</b>","description":""},"extaboutcontent1":{"message":"眺览计划凝聚了我们对阅读的热爱，对开放互联网的热情。我们还有很多要做的，路才刚刚开始。<br>我们会在微信公众号<a>「眺览」<span><img src=\\"%{this.url}wechatQR.png\\"></span></a>（或搜索tillglance）上每周更新一期好文推荐。","description":""},"extaboutcontent2":{"message":"有任何建议与想法，请通过<a>公众号<span><img src=\\"%{this.url}wechatQR.png\\"></span></a>或者邮箱与我们联系！<a id=\\"emaillink\\" href=mailto:tillglance@gmail.com subject=\\"HTML link\\">tillglance@gmail.com</a><br>访问<a href=\\"https://tillglance.com\\" target=\\"_blank\\">官网</a>可以下载其他平台版本。","description":""},"specialthanks":{"message":"<b>特别感谢：</b><br /><a href=\\"https://jquery.com\\">jQuery</a>, <a href=\\"https://github.com/mozilla/readability\\">readability</a>, <a href=\\"https://github.com/sivan/heti/\\">heti</a>, <a href=\\"https://github.com/fxsjy/jieba\\">jieba</a>, <a href=\\"https://github.com/sciactive/pnotify\\">PNotify</a>, <a href=\\"https://www.streamlinehq.com/\\">Streamline</a>, <a href=\\"https://animate.style/\\">Animate.css</a>, <a href=\\"https://github.com/zalog/placeholder-loading\\">Placeholder loading</a>, <a href=\\"https://party.js.org/\\">party.js</a>, 艺术设计Dodo, <a href=\\"https://github.com/adobe-fonts/source-han-sans\\">思源黑体</a><br /><br />软件用于自然语言分析的数据我们不会储存，也不会保留任何用户识别信息或数据，详细请查看<a href=\\"https://tillglance.com/privacy.html\\" target=\\"_blank\\">隐私政策</a><br />请查看<a href=\\"https://tillglance.com/termsservice.html\\" target=\\"_blank\\">软件许可协议</a><br />插件版本 v<span id=\\"ext-ver\\">0.0.1</span><br>NLP版本 v<span id=\\"hl-ver\\">0.0.1</span><br>","description":""},"shortcutdes":{"message":"可以使用 「Alt/Option + 逗号」 快速开启和关闭眺览","description":""},"extresetall":{"message":"重置所有配置信息","description":""},"extresetallcancle":{"message":"取消","description":""},"extresetallconfirm":{"message":"确定","description":""},"tutp1h":{"message":"欢迎使用<br>「眺览」","description":""},"tutp1ques":{"message":"如何挣脱信息茧房？<br>如何在繁杂的网络中快速获取有效信息？","description":""},"tutp1li1":{"message":"加快阅读速度","description":""},"tutp1li2":{"message":"最好汉字排版","description":""},"tutp1li3":{"message":"看到更大世界","description":""},"tutp1li4":{"message":"增强阅读体验","description":""},"tutp1li5":{"message":"加快阅读速度","description":""},"tutp1li6":{"message":"最好汉字排版","description":""},"tutp1li7":{"message":"看到更大世界","description":""},"tutp1li8":{"message":"增强阅读体验","description":""},"tutp1li9":{"message":"加快阅读速度","description":""},"tutp1ed":{"message":"的工具。","description":""},"tutp1op":{"message":"一个","description":""},"nextPage1":{"message":"下一步 (1/4)","description":""},"tutp2h":{"message":"眼动分析以及NLP算法引擎","description":""},"tutp2main":{"message":"（下图为基于人眼视线停留时间生成的热力图）<img src=\\"%{this.url}sample_hl.png\\"><br>通过研究阅读注意力机制与人眼扫视─凝视转换过程，我们开发了全新的NLP算法引擎，预判眼跳位置并用高亮标注。<br>读者在标注引导下，注意力自动快速定位下一眼跳的位置。在达到同样阅读量与理解程度情况下，读者可平均减少21%的阅读时间。<br><br>我们将此技术称为「眺览」。","description":""},"tutp3h":{"message":"眺览速读技术","description":""},"nextPage2":{"message":"下一步 (2/4)","description":""},"maincontent2":{"message":"以下是模拟使用眺览技术的前后对比（标记圈为人眼注意力范围）。按照您的视觉偏好，在眺览设置菜单<img src=\\"%{this.url}flash2_on.svg\\">您可以调节高亮<b>显示强度</b>。","description":""},"hlanimatebefore":{"message":"<b>传统阅读：</b><p>不必说碧绿的菜畦，光滑的石井栏，高大的皂荚树，紫红的桑椹；也不必说鸣蝉在树叶里长吟，肥胖的黄蜂伏在菜花上，轻捷的叫天子忽然从草间直窜向云霄里去了。单是周围的短短的泥墙根一带，就有无限趣味。油蛉在这里低唱，蟋蟀们在这里弹琴。</p>","description":""},"hlanimateafter":{"message":"<b>眺览速读：</b><p id=\\"rr0\\">不必说碧绿的菜畦，光滑的石井栏，高大的皂荚树，紫红的桑椹；也不必说鸣蝉在树叶里长吟，肥胖的黄蜂伏在菜花上，轻捷的叫天子忽然从草间直窜向云霄里去了。单是周围的短短的泥墙根一带，就有无限趣味。油蛉在这里低唱，蟋蟀们在这里弹琴。</p>","description":""},"nextPage3":{"message":"下一步 (3/4)","description":""},"tutp4h":{"message":"恭喜您！","description":""},"tutp4main":{"message":"恭喜您正式开启眺览之旅，我们为您送上一枚勋章！您之后可以在<img src=\\"%{this.url}trophy2.svg\\">成就菜单查看<b>数据统计</b>。<p>您还可以：<br><img src=\\"%{this.url}content.svg\\">调整<b>排版</b><br><img src=\\"%{this.url}brush1.svg\\">改变<b>配色方案</b><br><img src=\\"%{this.url}exit.svg\\">返回<b>原网页</b><br><img src=\\"%{this.url}key_alt.svg\\"> + <img src=\\"%{this.url}key_comma.png\\"> 使用「Alt/Option + 逗号」快捷键，<b>快速开启和关闭眺览原网页</b><br>最后别忘了，点击<img src=\\"%{this.url}flash2_on.svg\\">可以设置<b>眺览强度</b>以及重看<b>使用教程</b>","description":""},"nextPage4":{"message":" 完成!","description":""},"error_load_highlight":{"message":"无法连接到眺览引擎","description":"error"},"error_load_net":{"message":"请检查您的网络连接","description":"error"},"error_load_csp":{"message":"由于该网址的内容安全策略（CSP）配置，无法加载服务","description":"error"},"error_load_update":{"message":"无法获取更新信息","description":"error"},"error_parse_readability":{"message":"无法获取正文","description":"error"},"error_parse_readability_msg":{"message":"无法获取正文","description":"error"},"error_load_ext":{"message":"无法加载插件","description":"error"},"error_load_ext_msg":{"message":"请您尝试更新插件","description":"error"},"appReturn":{"message":"回到原网页","description":""},"appEnter":{"message":"用眺览打开","description":""}}')
    },
    0: function(e, t, s) {
        e.exports = s("./javascripts/app.js")
    }
});
[pi-proxy] undici dispatcher set to http://127.0.0.1:7897 (/tmp/node_modules/undici)
[pi-proxy] globalThis.WebSocket replaced with undici.WebSocket
[pi-proxy] undici dispatcher set to http://127.0.0.1:7897 (/Users/mahaoxuan/.local/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/undici)
[pi-proxy] globalThis.WebSocket replaced with undici.WebSocket
[pi-proxy] undici dispatcher set to http://127.0.0.1:7897 (/tmp/node_modules/undici)
[pi-proxy] globalThis.WebSocket replaced with undici.WebSocket
[pi-proxy] undici dispatcher set to http://127.0.0.1:7897 (/Users/mahaoxuan/.local/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/undici)
[pi-proxy] globalThis.WebSocket replaced with undici.WebSocket
