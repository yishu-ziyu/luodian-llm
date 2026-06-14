! function(e) {
    var t = {};
    function n(o) {
        if (t[o]) return t[o].exports;
        var r = t[o] = {
            i: o,
            l: !1,
            exports: {}
        };
        return e[o].call(r.exports, r, r.exports, n), r.l = !0, r.exports
    }
    n.m = e, n.c = t, n.d = function(e, t, o) {
        n.o(e, t) || Object.defineProperty(e, t, {
            enumerable: !0,
            get: o
        })
    }, n.r = function(e) {
        "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, {
            value: "Module"
        }), Object.defineProperty(e, "__esModule", {
            value: !0
        })
    }, n.t = function(e, t) {
        if (1 & t && (e = n(e)), 8 & t) return e;
        if (4 & t && "object" == typeof e && e && e.__esModule) return e;
        var o = Object.create(null);
        if (n.r(o), Object.defineProperty(o, "default", {
                enumerable: !0,
                value: e
            }), 2 & t && "string" != typeof e)
            for (var r in e) n.d(o, r, function(t) {
                return e[t]
            }.bind(null, r));
        return o
    }, n.n = function(e) {
        var t = e && e.__esModule ? function() {
            return e.default
        } : function() {
            return e
        };
        return n.d(t, "a", t), t
    }, n.o = function(e, t) {
        return Object.prototype.hasOwnProperty.call(e, t)
    }, n.p = "", n(n.s = "./javascripts/background.js")
}({
    "./javascripts/background.js": function(e, t) {
        const n = new Map,
            o = new Map,
            r = new Map,
            c = new Map,
            a = new Map,
            i = new Map,
            s = chrome.runtime.getManifest(),
            l = ["http://*/*", "https://*/*"],
            u = chrome.i18n.getMessage("appEnter"),
            d = chrome.i18n.getMessage("appReturn"),
            h = "https://tillglance.com";
        let p = "0.0.1",
            g = 0;
        function f() {
            chrome.storage.local.set({
                stat_total: g
            })
        }
        function m(e, t) {
            e.linkUrl ? chrome.tabs.create({
                url: e.linkUrl
            }, (function(e) {
                a.set(e.id), M(e.id, null, !0)
            })) : M(t.id, e, !0)
        }
        function b(e, t) {
            M(t.id, null, !1)
        }
        function _(e) {
            "open" === e ? chrome.contextMenus.update("tillglance-open", {
                title: d,
                onclick: b
            }) : chrome.contextMenus.update("tillglance-open", {
                title: u,
                onclick: m
            })
        }
        function v(e) {
            e && (i.set(e.tabId, e.state), _(e.state))
        }
        function y(e, t, n) {
            if (chrome.storage.local.get(["first_time_tutorial", "font_size", "content_width", "content_line_height", "font_id", "theme_id", "highlight_density", "theme_hl_style", "notice_ver", "notice_max_id", "stat_total", "no_img"], (function(o) {
                    g = o.stat_total ? o.stat_total : 0, g += 1, f();
                    let r = h + "/dist/update.json",
                        c = chrome.i18n.getUILanguage();
                    "zh-TW" === c && (r = h + "/dist/update_t.json");
                    let a = chrome.runtime.getURL("");
                    fetch(a + "config.json").then(e => e.json()).then(i => {
                        let l = {
                            tabId: e,
                            open: !0,
                            total: g,
                            version: s.version,
                            api: n,
                            update: r,
                            lang: c,
                            config: i,
                            serverVersion: p,
                            url: a,
                            storage: o
                        };
                        t = t || {}, chrome.tabs.sendMessage(e, {
                            ...t,
                            ...l
                        }, v)
                    })
                })), !r.has(e)) {
                try {
                    chrome.browserAction.setIcon({
                        path: "icon-loading-128.png",
                        tabId: e
                    })
                } catch (e) {}
                r.set(e, setTimeout((function() {
                    try {
                        chrome.browserAction.setIcon({
                            path: "icon-128.png",
                            tabId: e
                        }), r.delete(e)
                    } catch (e) {}
                }), 2e3))
            }
        }
        function I(e, t = null) {
            "pending" === c.get(e) ? (chrome.contextMenus.update("tillglance-open", {
                title: d,
                onclick: b
            }), "complete" === n.get(e) && (! function(e, t) {
                fetch(h + "/api.json").then(e => e.json()).then(n => {
                    var o = n.base + n.nlphl;
                    y(e, t, o)
                }).catch(n => {
                    y(e, t, "https://api.tillglance.com/nlphl")
                })
            }(e, t), c.set(e, "finished"))) : "finished" === c.get(e) && (! function(e, t) {
                let n = {
                    tabId: e,
                    open: !1,
                    total: g,
                    version: s.version
                };
                t = t || {}, chrome.tabs.sendMessage(e, {
                    ...t,
                    ...n
                }, v)
            }(e, t), c.delete(e))
        }
        function M(e, t = null, n = null) {
            null !== n ? n ? c.set(e, "pending") : c.set(e, "finished") : c.has(e) ? "pending" === c.get(e) && c.delete(e) : c.set(e, "pending"), I(e, t)
        }
        function j(e) {
            o.has(e) && (clearInterval(o.get(e)), o.delete(e))
        }
        function w(e) {
            r.has(e) && (clearTimeout(r.get(e)), r.delete(e))
        }
        chrome.tabs.onActivated.addListener((function(e) {
            e && e.tabId && _(i.get(e.tabId))
        })), chrome.tabs.onRemoved.addListener((function(e, t) {
            j(e), w(e), a.delete(e), c.delete(e), i.delete(e)
        })), chrome.tabs.onUpdated.addListener((function(e, t) {
            if (void 0 === t.status) return;
            const s = t.status.toString();
            if (!n.has(e) || n.get(e) !== s) switch (n.set(e, s), s) {
                case "loading":
                    i.delete(e), w(e), a.has(e) || c.delete(e);
                    o.set(e, setInterval((function() {
                        c.has(e) ? chrome.browserAction.setIcon({
                            path: "icon-loading-128.png",
                            tabId: e
                        }) : chrome.browserAction.setIcon({
                            path: "icon-128.png",
                            tabId: e
                        })
                    }), 333));
                    break;
                case "complete":
                    if (a.delete(e), j(e), c.has(e)) {
                        chrome.browserAction.setIcon({
                            path: "icon-finished-128.png",
                            tabId: e
                        });
                        r.set(e, setTimeout((function() {
                            chrome.browserAction.setIcon({
                                path: "icon-128.png",
                                tabId: e
                            }), r.delete(e)
                        }), 3e3))
                    }
                    I(e)
            }
        })), chrome.browserAction.onClicked.addListener((function(e) {
            M(e.id)
        })), chrome.runtime.onMessage.addListener((function(e, t, n) {
            switch (e.action) {
                case "getlocalstorage":
                    return chrome.storage.local.get([e.key], (function(e) {
                        n(e)
                    })), !0;
                case "setlocalstorage":
                    return chrome.storage.local.set({
                        [e.key]: e.value
                    }, (function(e) {
                        n(e)
                    })), !0;
                case "clearlocalstorage":
                    return chrome.storage.local.clear((function() {
                        f(), n(null)
                    })), !0;
                case "back2original":
                    return M(e.tabId, null, !1), !0;
                case "nlphl":
                    return fetch(e.api, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: e.body
                    }).then(e => (p = e.headers.get("X-Tg-Version"), e.json())).then(e => {
                        n({
                            result: e,
                            serverVersion: p
                        })
                    }).catch(e => {
                        n({
                            error: {
                                title: "error_load_highlight",
                                msg: "error_load_net"
                            }
                        })
                    }), !0;
                case "update":
                    return fetch(e.update).then(e => e.json()).then(e => {
                        n({
                            result: e
                        })
                    }).catch(e => {
                        n({
                            error: {
                                title: "error_load_update",
                                msg: "error_load_net"
                            }
                        })
                    }), !0
            }
        })), chrome.contextMenus.create({
            id: "tillglance-open",
            title: u,
            contexts: ["page", "image"],
            documentUrlPatterns: l,
            onclick: m
        }), chrome.contextMenus.create({
            id: "tillglance-open-quick",
            title: u,
            contexts: ["selection", "link"],
            documentUrlPatterns: l,
            onclick: m
        })
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
