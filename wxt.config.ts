import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "extension",
  publicDir: "extension/public",
  manifest: {
    name: "落点 · 原页高亮",
    description: "在当前中文网页中加入可随时撤销的本地阅读落点。",
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png"
    },
    permissions: ["activeTab", "scripting", "contextMenus"],
    action: {
      default_title: "切换落点高亮",
      default_icon: {
        16: "icon/16.png",
        32: "icon/32.png"
      }
    },
    commands: {
      _execute_action: {
        suggested_key: {
          default: "Alt+Comma",
          mac: "Alt+Comma"
        },
        description: "切换当前网页的落点高亮"
      }
    }
  }
});
