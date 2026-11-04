// Documento offscreen de UIspa: única forma de escribir en el portapapeles
// desde el service worker en Manifest V3.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== "uispa-offscreen" || msg.action !== "copy") return;
  const ta = document.getElementById("buf");
  ta.value = msg.text;
  ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
  ta.value = "";
  sendResponse({ ok });
});
