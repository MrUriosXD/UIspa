// Menús contextuales, atajo, botón de la barra y copia desde el background.
const api = typeof browser !== "undefined" ? browser : chrome;
const PATTERNS = [
  "*://hispashare.org/*", "*://*.hispashare.org/*",
  "*://hispashare.com/*", "*://*.hispashare.com/*"
];

api.contextMenus.create({
  id: "hc-copy-all",
  title: "Copiar todos los enlaces ed2k de la página",
  contexts: ["page", "link", "selection"],
  documentUrlPatterns: PATTERNS
});
api.contextMenus.create({
  id: "hc-copy-selected",
  title: "Copiar los capítulos marcados",
  contexts: ["page", "link", "selection"],
  documentUrlPatterns: PATTERNS
});

const send = (tabId, msg) => api.tabs.sendMessage(tabId, msg).catch(() => {});

api.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab) return;
  if (info.menuItemId === "hc-copy-all") send(tab.id, { action: "copy-all" });
  if (info.menuItemId === "hc-copy-selected") send(tab.id, { action: "copy-selected" });
});

api.commands.onCommand.addListener(async (command) => {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (tab) send(tab.id, { action: command });
});

api.browserAction.onClicked.addListener((tab) => send(tab.id, { action: "copy-all" }));

// Copia de respaldo: el content script puede perder el "gesto de usuario"
// tras esperar la petición AJAX; el background tiene clipboardWrite.
api.runtime.onMessage.addListener((msg) => {
  if (msg?.action === "open-options") { api.runtime.openOptionsPage(); return; }
  if (msg?.action !== "bg-copy") return;
  return navigator.clipboard.writeText(msg.text).then(() => ({ ok: true }), () => ({ ok: false }));
});
