const CONTENT_SCRIPT_FILE = "/highlighter.js";
const CONTEXT_MENU_ID = "luodian-toggle-highlight";

async function toggleTab(tabId: number): Promise<void> {
  const [result] = await browser.scripting.executeScript({
    target: { tabId },
    files: [CONTENT_SCRIPT_FILE]
  });
  const metrics = result?.result as
    | { enabled?: boolean; highlightCount?: number; durationMs?: number }
    | undefined;
  const enabled = Boolean(metrics?.enabled);
  await browser.action.setBadgeText({ tabId, text: enabled ? "ON" : "" });
  if (enabled) {
    await browser.action.setBadgeBackgroundColor({ tabId, color: "#9A6A00" });
  }
  console.info("[luodian] toggle-complete", {
    tabId,
    enabled,
    highlightCount: metrics?.highlightCount || 0,
    durationMs: Math.round(metrics?.durationMs || 0)
  });
}

function reportToggleFailure(tabId: number, error: unknown): void {
  console.error("[luodian] toggle-failed", {
    tabId,
    message: error instanceof Error ? error.message : "Unknown error"
  });
  browser.action.setBadgeText({ tabId, text: "!" });
  browser.action.setBadgeBackgroundColor({ tabId, color: "#A12B2B" });
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.removeAll().then(() => {
      browser.contextMenus.create({
        id: CONTEXT_MENU_ID,
        title: "切换原页高亮",
        contexts: ["page", "selection"]
      });
    });
  });

  browser.action.onClicked.addListener((tab) => {
    if (typeof tab.id !== "number") return;
    toggleTab(tab.id).catch((error) => reportToggleFailure(tab.id as number, error));
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID || typeof tab?.id !== "number") return;
    toggleTab(tab.id).catch((error) => reportToggleFailure(tab.id as number, error));
  });
});
