! function(t) {
    var a = {};
    function e(n) {
        if (a[n]) return a[n].exports;
        var i = a[n] = {
            i: n,
            l: !1,
            exports: {}
        };
        return t[n].call(i.exports, i, i.exports, e), i.l = !0, i.exports
    }
    e.m = t, e.c = a, e.d = function(t, a, n) {
        e.o(t, a) || Object.defineProperty(t, a, {
            enumerable: !0,
            get: n
        })
    }, e.r = function(t) {
        "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(t, Symbol.toStringTag, {
            value: "Module"
        }), Object.defineProperty(t, "__esModule", {
            value: !0
        })
    }, e.t = function(t, a) {
        if (1 & a && (t = e(t)), 8 & a) return t;
        if (4 & a && "object" == typeof t && t && t.__esModule) return t;
        var n = Object.create(null);
        if (e.r(n), Object.defineProperty(n, "default", {
                enumerable: !0,
                value: t
            }), 2 & a && "string" != typeof t)
            for (var i in t) e.d(n, i, function(a) {
                return t[a]
            }.bind(null, i));
        return n
    }, e.n = function(t) {
        var a = t && t.__esModule ? function() {
            return t.default
        } : function() {
            return t
        };
        return e.d(a, "a", a), a
    }, e.o = function(t, a) {
        return Object.prototype.hasOwnProperty.call(t, a)
    }, e.p = "", e(e.s = 2)
}({
    "../Tutorial/tut.css": function(t, a, e) {
        t.exports = {
            "ph-item": "ph-item-1rHI92",
            phAnimation: "phAnimation-281nJK",
            "ph-row": "ph-row-kUEoqc",
            big: "big-2qxMKz",
            empty: "empty-1c8nWv",
            "ph-col-2": "ph-col-2-3WxDZi",
            "ph-col-4": "ph-col-4-3vV6bb",
            "ph-col-6": "ph-col-6-2Oihbd",
            "ph-col-8": "ph-col-8-2Bh-aX",
            "ph-col-10": "ph-col-10-cOQuRq",
            "ph-col-12": "ph-col-12-UK1ByS",
            "ph-avatar": "ph-avatar-haXqii",
            "ph-picture": "ph-picture-2GIXnH",
            tutorial: "tutorial-2Uf3e_",
            wrapper: "wrapper-3zVg8k",
            page: "page-2-eg8D",
            hlcolor: "hlcolor-18jI9e",
            question: "question-3CjySF",
            leftPanel: "leftPanel-IDk_MG",
            maincontentanimated1: "maincontentanimated1-3_h-yh",
            maincontent1: "maincontent1-2fok69",
            rightPanel: "rightPanel-XB2Tp2",
            footer: "footer-wdiRrS",
            hlanimate: "hlanimate-3IHEkL",
            hlanimatebefore: "hlanimatebefore-3eYGLG",
            hlanimateafter: "hlanimateafter-3-fEjs",
            hl: "hl-1aqB17",
            paibibox: "paibibox-1DUdak",
            animate: "animate-1-L4Gh",
            "ads-bg": "ads-bg-27KmW1",
            "ads-border": "ads-border-3IfrUC",
            radio: "radio-1Mo6pN",
            maincontent21: "maincontent21-3eJxcH",
            maincontent22: "maincontent22-1h1YBw",
            maincontent3: "maincontent3-14jTV_",
            firstbadge: "firstbadge-2PoRTi",
            wordCarousel: "wordCarousel-4fjxX9",
            wordCarouselMask: "wordCarouselMask-3yagdb",
            wordCarouselMaskCell: "wordCarouselMaskCell-1hpSrW",
            wordCarouselMask1: "wordCarouselMask1-1FKP6g",
            wordCarouselMask2: "wordCarouselMask2-1nfmem",
            flip2: "flip2-2h0g3r",
            flip3: "flip3-WoGnSa",
            flip4: "flip4-iyfeP_"
        }
    },
    "../Tutorial/tut.js": function(t, a, e) {
        "use strict";
        e.r(a);
        e("./styles/animate.css"), e("./styles/placeholder-loading.css"), e("../Tutorial/tut.css")
    },
    "./styles/animate.css": function(t, a, e) {
        t.exports = {
            animate__animated: "animate__animated-uw-gRH",
            animate__infinite: "animate__infinite-1W3eyb",
            "animate__repeat-1": "animate__repeat-1-sydrfk",
            "animate__repeat-2": "animate__repeat-2-ni5CWu",
            "animate__repeat-3": "animate__repeat-3-xFFmzX",
            "animate__delay-1s": "animate__delay-1s-2UBfTd",
            "animate__delay-2s": "animate__delay-2s-1uK3s8",
            "animate__delay-3s": "animate__delay-3s-5r0Jys",
            "animate__delay-4s": "animate__delay-4s-3Cxz8B",
            "animate__delay-5s": "animate__delay-5s-1ztj37",
            animate__faster: "animate__faster-3Jihot",
            animate__fast: "animate__fast-2Y4OKN",
            animate__slow: "animate__slow-n4N2Ha",
            animate__slower: "animate__slower-3qJhQX",
            animate__bounce: "animate__bounce-pWeUmI",
            bounce: "bounce-66J4fp",
            animate__flash: "animate__flash-3-jAex",
            flash: "flash-1wmhgz",
            animate__pulse: "animate__pulse-oPC2Lv",
            pulse: "pulse-2NTyMl",
            animate__rubberBand: "animate__rubberBand-2VIYJd",
            rubberBand: "rubberBand-2XSunq",
            animate__shakeX: "animate__shakeX-3Wdp7B",
            shakeX: "shakeX-q8126f",
            animate__shakeY: "animate__shakeY-3ALf1b",
            shakeY: "shakeY-J7fKqe",
            animate__headShake: "animate__headShake-185Erg",
            headShake: "headShake-vrUamt",
            animate__swing: "animate__swing-2TW12Q",
            swing: "swing-1WRoPt",
            animate__tada: "animate__tada-3kcHGn",
            tada: "tada-3qdRKH",
            animate__wobble: "animate__wobble-26_eP0",
            wobble: "wobble-DSphnh",
            animate__jello: "animate__jello-1MxcUS",
            jello: "jello-22nQ6R",
            animate__heartBeat: "animate__heartBeat-lxMa2P",
            heartBeat: "heartBeat-IV6nfD",
            animate__backInDown: "animate__backInDown-2VAper",
            backInDown: "backInDown-3VXVbo",
            animate__backInLeft: "animate__backInLeft-3UWLLw",
            backInLeft: "backInLeft-bbUxuD",
            animate__backInRight: "animate__backInRight-2NTNDq",
            backInRight: "backInRight-32kqqZ",
            animate__backInUp: "animate__backInUp-3neQus",
            backInUp: "backInUp-1JkrTO",
            animate__backOutDown: "animate__backOutDown-3hArST",
            backOutDown: "backOutDown-3vJ1sI",
            animate__backOutLeft: "animate__backOutLeft-d0-dmX",
            backOutLeft: "backOutLeft-13Dvty",
            animate__backOutRight: "animate__backOutRight-pModAG",
            backOutRight: "backOutRight-2zLkZ0",
            animate__backOutUp: "animate__backOutUp--SIjDb",
            backOutUp: "backOutUp-38mBce",
            animate__bounceIn: "animate__bounceIn-2BmIBD",
            bounceIn: "bounceIn-35TRe7",
            animate__bounceInDown: "animate__bounceInDown-IBghfC",
            bounceInDown: "bounceInDown-2eK4jn",
            animate__bounceInLeft: "animate__bounceInLeft-20oJeQ",
            bounceInLeft: "bounceInLeft-3XXy5l",
            animate__bounceInRight: "animate__bounceInRight-2_bs2E",
            bounceInRight: "bounceInRight-2C4D-0",
            animate__bounceInUp: "animate__bounceInUp-3XEHqv",
            bounceInUp: "bounceInUp-3zK1KD",
            animate__bounceOut: "animate__bounceOut-29dxxe",
            bounceOut: "bounceOut-2zel4a",
            animate__bounceOutDown: "animate__bounceOutDown-UqaSrL",
            bounceOutDown: "bounceOutDown-18iE9p",
            animate__bounceOutLeft: "animate__bounceOutLeft-3LZ2mX",
            bounceOutLeft: "bounceOutLeft-1GXpdN",
            animate__bounceOutRight: "animate__bounceOutRight-3GfKXc",
            bounceOutRight: "bounceOutRight-1h1Rv4",
            animate__bounceOutUp: "animate__bounceOutUp-1x22vS",
            bounceOutUp: "bounceOutUp-Ya6YXS",
            animate__fadeIn: "animate__fadeIn-2mP59K",
            fadeIn: "fadeIn-1vMUzt",
            animate__fadeInDown: "animate__fadeInDown-2YPL2c",
            fadeInDown: "fadeInDown-3IgizD",
            animate__fadeInDownBig: "animate__fadeInDownBig-3KdWSi",
            fadeInDownBig: "fadeInDownBig-GoZ8qJ",
            animate__fadeInLeft: "animate__fadeInLeft-XaFvjP",
            fadeInLeft: "fadeInLeft-3eX-vr",
            animate__fadeInLeftBig: "animate__fadeInLeftBig-9c5y9W",
            fadeInLeftBig: "fadeInLeftBig-EC4oz2",
            animate__fadeInRight: "animate__fadeInRight-3XiDKH",
            fadeInRight: "fadeInRight-1YmOFX",
            animate__fadeInRightBig: "animate__fadeInRightBig-2va6Yp",
            fadeInRightBig: "fadeInRightBig-1mtGwK",
            animate__fadeInUp: "animate__fadeInUp-3i_lpl",
            fadeInUp: "fadeInUp-3HsGfw",
            animate__fadeInUpBig: "animate__fadeInUpBig-35t7_G",
            fadeInUpBig: "fadeInUpBig-1TG7w7",
            animate__fadeInTopLeft: "animate__fadeInTopLeft-2dTD6M",
            fadeInTopLeft: "fadeInTopLeft-3yRCE4",
            animate__fadeInTopRight: "animate__fadeInTopRight-2G9spj",
            fadeInTopRight: "fadeInTopRight-1fzq0-",
            animate__fadeInBottomLeft: "animate__fadeInBottomLeft-YJ5ygr",
            fadeInBottomLeft: "fadeInBottomLeft-vQCuCW",
            animate__fadeInBottomRight: "animate__fadeInBottomRight-1unJMo",
            fadeInBottomRight: "fadeInBottomRight-3OS7_F",
            animate__fadeOut: "animate__fadeOut-i5Tmti",
            fadeOut: "fadeOut-swtpSQ",
            animate__fadeOutDown: "animate__fadeOutDown-1YVZXg",
            fadeOutDown: "fadeOutDown-3Krk-t",
            animate__fadeOutDownBig: "animate__fadeOutDownBig-3XCCvA",
            fadeOutDownBig: "fadeOutDownBig-arSpow",
            animate__fadeOutLeft: "animate__fadeOutLeft-3xuQ4R",
            fadeOutLeft: "fadeOutLeft-2uB4Gp",
            animate__fadeOutLeftBig: "animate__fadeOutLeftBig-3-zJI_",
            fadeOutLeftBig: "fadeOutLeftBig-2EcrcY",
            animate__fadeOutRight: "animate__fadeOutRight-22yKDl",
            fadeOutRight: "fadeOutRight-3UpYHR",
            animate__fadeOutRightBig: "animate__fadeOutRightBig-stvnHX",
            fadeOutRightBig: "fadeOutRightBig-3YHdxA",
            animate__fadeOutUp: "animate__fadeOutUp-2HtZW2",
            fadeOutUp: "fadeOutUp-1rBY19",
            animate__fadeOutUpBig: "animate__fadeOutUpBig-1FnafA",
            fadeOutUpBig: "fadeOutUpBig-GmvRjK",
            animate__fadeOutTopLeft: "animate__fadeOutTopLeft-GURnU0",
            fadeOutTopLeft: "fadeOutTopLeft-2wOpqu",
            animate__fadeOutTopRight: "animate__fadeOutTopRight-3-55An",
            fadeOutTopRight: "fadeOutTopRight-2Yv5jM",
            animate__fadeOutBottomRight: "animate__fadeOutBottomRight-3pzmRu",
            fadeOutBottomRight: "fadeOutBottomRight-3FS_CD",
            animate__fadeOutBottomLeft: "animate__fadeOutBottomLeft-WdHwv0",
            fadeOutBottomLeft: "fadeOutBottomLeft-12DiQ2",
            animate__flip: "animate__flip-1R4Aoj",
            flip: "flip-ChHilT",
            animate__flipInX: "animate__flipInX-3i4e7z",
            flipInX: "flipInX-3s0Gx0",
            animate__flipInY: "animate__flipInY-3l5Eql",
            flipInY: "flipInY-3GKN_o",
            animate__flipOutX: "animate__flipOutX-3VMgJQ",
            flipOutX: "flipOutX-25ebH3",
            animate__flipOutY: "animate__flipOutY-NQbi3s",
            flipOutY: "flipOutY-16lhb4",
            animate__lightSpeedInRight: "animate__lightSpeedInRight-1BxdCj",
            lightSpeedInRight: "lightSpeedInRight-1V3bGY",
            animate__lightSpeedInLeft: "animate__lightSpeedInLeft-yPPaW0",
            lightSpeedInLeft: "lightSpeedInLeft-1Zq-83",
            animate__lightSpeedOutRight: "animate__lightSpeedOutRight-2fmLLd",
            lightSpeedOutRight: "lightSpeedOutRight-3XDPPR",
            animate__lightSpeedOutLeft: "animate__lightSpeedOutLeft-367i9r",
            lightSpeedOutLeft: "lightSpeedOutLeft-3dsEjm",
            animate__rotateIn: "animate__rotateIn-15Nu8Z",
            rotateIn: "rotateIn-qzsZ7J",
            animate__rotateInDownLeft: "animate__rotateInDownLeft-3BSirO",
            rotateInDownLeft: "rotateInDownLeft-1QNY7q",
            animate__rotateInDownRight: "animate__rotateInDownRight-IX3hlm",
            rotateInDownRight: "rotateInDownRight-DmRJyY",
            animate__rotateInUpLeft: "animate__rotateInUpLeft-2_w6xs",
            rotateInUpLeft: "rotateInUpLeft-Umqt_j",
            animate__rotateInUpRight: "animate__rotateInUpRight-FKcgAj",
            rotateInUpRight: "rotateInUpRight-3eYSCB",
            animate__rotateOut: "animate__rotateOut-lwP7Si",
            rotateOut: "rotateOut-1BWxAX",
            animate__rotateOutDownLeft: "animate__rotateOutDownLeft-3xyvyE",
            rotateOutDownLeft: "rotateOutDownLeft-n-y2Dr",
            animate__rotateOutDownRight: "animate__rotateOutDownRight-2AM7L0",
            rotateOutDownRight: "rotateOutDownRight-fIQ-ns",
            animate__rotateOutUpLeft: "animate__rotateOutUpLeft-Q_YIWD",
            rotateOutUpLeft: "rotateOutUpLeft-1_80FY",
            animate__rotateOutUpRight: "animate__rotateOutUpRight-1_eFif",
            rotateOutUpRight: "rotateOutUpRight-1VWTGx",
            animate__hinge: "animate__hinge-2kswF5",
            hinge: "hinge-2Gx8v4",
            animate__jackInTheBox: "animate__jackInTheBox-2zex9z",
            jackInTheBox: "jackInTheBox-1VGEP3",
            animate__rollIn: "animate__rollIn-374Fjs",
            rollIn: "rollIn-2noCdy",
            animate__rollOut: "animate__rollOut-3P3uGz",
            rollOut: "rollOut-nYASMN",
            animate__zoomIn: "animate__zoomIn-3KoyDR",
            zoomIn: "zoomIn-r3InFT",
            animate__zoomInDown: "animate__zoomInDown-3MIDo_",
            zoomInDown: "zoomInDown-QDAiFZ",
            animate__zoomInLeft: "animate__zoomInLeft-34rP3-",
            zoomInLeft: "zoomInLeft-1DBfzQ",
            animate__zoomInRight: "animate__zoomInRight-xBdHi9",
            zoomInRight: "zoomInRight-2cFZZC",
            animate__zoomInUp: "animate__zoomInUp-1aFUMv",
            zoomInUp: "zoomInUp-1B15hM",
            animate__zoomOut: "animate__zoomOut-2L6EU8",
            zoomOut: "zoomOut-zzKr41",
            animate__zoomOutDown: "animate__zoomOutDown-39WWds",
            zoomOutDown: "zoomOutDown-3AAqBv",
            animate__zoomOutLeft: "animate__zoomOutLeft-1LuP2K",
            zoomOutLeft: "zoomOutLeft-1iKvMQ",
            animate__zoomOutRight: "animate__zoomOutRight-YDzlpp",
            zoomOutRight: "zoomOutRight-151Gw7",
            animate__zoomOutUp: "animate__zoomOutUp-1cpK3d",
            zoomOutUp: "zoomOutUp-2cj_e1",
            animate__slideInDown: "animate__slideInDown-3DNtoQ",
            slideInDown: "slideInDown-1e-r_b",
            animate__slideInLeft: "animate__slideInLeft-1ZDndQ",
            slideInLeft: "slideInLeft-2kxK6e",
            animate__slideInRight: "animate__slideInRight-3HQciR",
            slideInRight: "slideInRight-2L1nD6",
            animate__slideInUp: "animate__slideInUp-30ws3o",
            slideInUp: "slideInUp-1WMa-E",
            animate__slideOutDown: "animate__slideOutDown-3qwk59",
            slideOutDown: "slideOutDown-1mtxJc",
            animate__slideOutLeft: "animate__slideOutLeft-1Gh3eX",
            slideOutLeft: "slideOutLeft-1Oy59o",
            animate__slideOutRight: "animate__slideOutRight-ogpbJC",
            slideOutRight: "slideOutRight-3buGO7",
            animate__slideOutUp: "animate__slideOutUp-cene6Y",
            slideOutUp: "slideOutUp-2RdK76"
        }
    },
    "./styles/placeholder-loading.css": function(t, a, e) {
        t.exports = {
            "ph-item": "ph-item-27oafd",
            "ph-row": "ph-row-2cABoJ",
            big: "big-3-vkrm",
            empty: "empty-3GNfqs",
            "ph-col-2": "ph-col-2-B3d3RT",
            "ph-col-4": "ph-col-4-1S8ezS",
            "ph-col-6": "ph-col-6-tluFZ_",
            "ph-col-8": "ph-col-8-28oEvm",
            "ph-col-10": "ph-col-10-GxMUL4",
            "ph-col-12": "ph-col-12-3i0LmY",
            "ph-avatar": "ph-avatar-12G0tr",
            "ph-picture": "ph-picture-1dq5MB",
            "ph-picture-sm": "ph-picture-sm-1R-urP",
            "ph-mask": "ph-mask-1X-ebf",
            phAnimation: "phAnimation-1Piba7"
        }
    },
    2: function(t, a, e) {
        t.exports = e("../Tutorial/tut.js")
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
