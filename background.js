// UIspa · service worker: menús contextuales, atajos, botón de la barra y
// copia al portapapeles mediante un documento offscreen (en Manifest V3 el
// service worker no tiene acceso al portapapeles).
importScripts("plex-bg.js");

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
let creating = null;
async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  if (!creating) {
    creating = chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["CLIPBOARD"],
      justification: "Copiar los enlaces ed2k al portapapeles"
    }).finally(() => { creating = null; });
  }
  await creating;
}

async function copyViaOffscreen(text) {
  await ensureOffscreen();
  const r = await chrome.runtime.sendMessage({ target: "uispa-offscreen", action: "copy", text });
  return !!r?.ok;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.action === "open-options") { chrome.runtime.openOptionsPage(); return; }
  if (msg?.action !== "bg-copy") return;
  copyViaOffscreen(msg.text).then(
    (ok) => sendResponse({ ok }),
    () => sendResponse({ ok: false })
  );
  return true; // respuesta asíncrona
});
