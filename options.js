// UIspa · página de ajustes (conexión con Plex)
const api = typeof browser !== "undefined" ? browser : chrome;
const $ = (id) => document.getElementById(id);
const status = $("status");

function say(msg, cls = "") {
  status.className = cls;
  status.textContent = msg;
}

function normalizeUrl(raw) {
  let v = (raw || "").trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = "http://" + v;
  try {
    const u = new URL(v);
    if (!u.port && u.protocol === "http:" && !/plex\.direct$/i.test(u.hostname)) u.port = "32400";
    return u.origin;
  } catch (_) { return null; }
}

// Pide permiso para hablar con el servidor (solo esa dirección).
// Debe llamarse directamente desde un clic.
function requestAccess(origin) {
  return api.permissions.request({ origins: [origin + "/*"] });
}

async function withServer(fn) {
  const origin = normalizeUrl($("url").value);
  const token = $("token").value.trim();
  if (!origin) { say("Escribe una dirección válida, por ejemplo http://192.168.1.50:32400", "err"); return; }
  if (!token) { say("Falta el token de Plex.", "err"); return; }
  let granted = false;
  try { granted = await requestAccess(origin); } catch (e) { say("No se pudo pedir permiso: " + e.message, "err"); return; }
  if (!granted) { say("Sin permiso para acceder a " + origin + ", la extensión no puede consultar tu Plex.", "err"); return; }
  $("url").value = origin;
  await fn(origin, token);
}

async function testConnection(origin, token) {
  say("Conectando…");
  const r = await api.runtime.sendMessage({ action: "plex-test", url: origin, token });
  if (!r?.ok) { say(r?.error || "No se pudo conectar.", "err"); return false; }
  status.className = "ok";
  status.textContent = `Conectado a «${r.name}». Bibliotecas encontradas:`;
  const ul = document.createElement("ul");
  for (const s of r.sections) {
    const li = document.createElement("li");
    li.textContent = `${s.title} (${s.type === "show" ? "series" : "películas"})`;
    ul.append(li);
  }
  if (!r.sections.length) {
    const li = document.createElement("li");
    li.textContent = "Ninguna biblioteca de películas o series.";
    ul.append(li);
  }
  status.append(ul);
  return true;
}

$("test").addEventListener("click", () => withServer(testConnection));

$("save").addEventListener("click", () => withServer(async (origin, token) => {
  await api.storage.local.set({ plexUrl: origin, plexToken: token });
  await api.runtime.sendMessage({ action: "plex-reset" });
  if (await testConnection(origin, token)) {
    status.prepend("Guardado. ");
  }
}));

$("clear").addEventListener("click", async () => {
  const { plexUrl } = await api.storage.local.get("plexUrl");
  await api.storage.local.remove(["plexUrl", "plexToken"]);
  await api.runtime.sendMessage({ action: "plex-reset" });
  if (plexUrl) { try { await api.permissions.remove({ origins: [plexUrl + "/*"] }); } catch (_) {} }
  $("url").value = ""; $("token").value = "";
  say("Plex desconectado. Se han borrado la dirección y el token.");
});

$("show").addEventListener("click", () => {
  $("token").type = $("token").type === "password" ? "text" : "password";
});

api.storage.local.get(["plexUrl", "plexToken"]).then(({ plexUrl, plexToken }) => {
  if (plexUrl) $("url").value = plexUrl;
  if (plexToken) $("token").value = plexToken;
  if (plexUrl && plexToken) say("Plex configurado. Puedes probar la conexión cuando quieras.", "ok");
});

// Título según la extensión (UIspa en Chrome, el nombre que tenga en Firefox)
{
  const name = api.runtime.getManifest().name;
  if (name !== "UIspa") { $("title").textContent = name + " · Ajustes"; document.title = name + " · Ajustes"; }
}
