// UIspa (Safari) · segundo plano: menús contextuales, atajos, botón de la
// barra y consultas a Plex/Jellyfin.
importScripts("plex-bg.js", "jellyfin-bg.js", "media-bg.js", "synology-bg.js");

const PATTERNS = [
  "*://hispashare.org/*", "*://*.hispashare.org/*",
  "*://hispashare.com/*", "*://*.hispashare.com/*"
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "hc-copy-all",
      title: "Copiar todos los enlaces ed2k de la página",
      contexts: ["page", "link", "selection"],
      documentUrlPatterns: PATTERNS
    });
    chrome.contextMenus.create({
      id: "hc-copy-selected",
      title: "Copiar los capítulos marcados",
      contexts: ["page", "link", "selection"],
      documentUrlPatterns: PATTERNS
    });
  });
});

const send = (tabId, msg) => chrome.tabs.sendMessage(tabId, msg).catch(() => {});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === "hc-copy-all") send(tab.id, { action: "copy-all" });
  if (info.menuItemId === "hc-copy-selected") send(tab.id, { action: "copy-selected" });
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) send(tab.id, { action: command });
});

chrome.action.onClicked.addListener((tab) => {
  if (tab?.id) send(tab.id, { action: "copy-all" });
});

// ------------------------------------------------------------ portapapeles
// Safari no tiene documentos offscreen: se intenta copiar desde el propio
// segundo plano. Si Safari no lo permite, los botones de la página siguen
// funcionando (copian dentro del clic); solo los atajos y el menú contextual
// pueden fallar.
async function copyFromBackground(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    return false;
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.action === "open-options") { chrome.runtime.openOptionsPage(); return; }
  if (msg?.action !== "bg-copy") return;
  copyFromBackground(msg.text).then((ok) => sendResponse({ ok }), () => sendResponse({ ok: false }));
  return true; // respuesta asíncrona
});
