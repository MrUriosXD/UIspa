// UIspa · página de ajustes (conexión con Plex o Jellyfin)
const api = typeof browser !== "undefined" ? browser : chrome;
const $ = (id) => document.getElementById(id);
const status = $("status");

const SERVERS = {
  plex: {
    name: "Plex", port: "32400", urlKey: "plexUrl", tokenKey: "plexToken",
    tokenLabel: "Token de Plex", missing: "Falta el token de Plex.", placeholder: "http://192.168.1.50:32400", tokenPlaceholder: "xxxxxxxxxxxxxxxxxxxx"
  },
  jellyfin: {
    name: "Jellyfin", port: "8096", urlKey: "jfUrl", tokenKey: "jfKey",
    tokenLabel: "Clave de API de Jellyfin", missing: "Falta la clave de API de Jellyfin.", placeholder: "http://192.168.1.50:8096", tokenPlaceholder: "clave de 32 caracteres"
  }
};
let stored = {};

const current = () => document.querySelector("input[name=server]:checked").value;

function say(msg, cls = "") {
  status.className = cls;
  status.textContent = msg;
}

function normalizeUrl(raw, port) {
  let v = (raw || "").trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = "http://" + v;
  try {
    const u = new URL(v);
    if (!u.port && u.protocol === "http:" && !/plex\.direct$/i.test(u.hostname)) u.port = port;
    // se conserva la ruta por si Jellyfin está en un subdirectorio (/jellyfin)
    return (u.origin + u.pathname).replace(/\/+$/, "");
  } catch (_) { return null; }
}

// Muestra los campos del servidor elegido con lo que haya guardado
function showServer() {
  const s = SERVERS[current()];
  $("url").placeholder = s.placeholder;
  $("token").placeholder = s.tokenPlaceholder;
  $("tokenLabel").textContent = s.tokenLabel;
  $("url").value = stored[s.urlKey] || "";
  $("token").value = stored[s.tokenKey] || "";
  document.querySelectorAll("details[data-for]").forEach((d) => (d.hidden = d.dataset.for !== current()));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.querySelector("input").checked));
  say(isSet(current()) ? `${s.name} conectado. Puedes probar la conexión cuando quieras.` : "", isSet(current()) ? "ok" : "");
  dots();
}

const isSet = (id) => !!(stored[SERVERS[id].urlKey] && stored[SERVERS[id].tokenKey]);

// Punto verde en la pestaña de cada servidor conectado
function dots() {
  for (const id of Object.keys(SERVERS)) {
    const d = document.querySelector(`[data-dot=${id}]`);
    d.classList.toggle("set", isSet(id));
    d.title = isSet(id) ? "Conectado" : "Sin configurar";
  }
}

// Patrón de permiso para el servidor. Sin puerto: Safari no admite puertos en
// los patrones, y en Chrome y Firefox un patrón sin puerto cubre todos.
function hostPattern(url) {
  const u = new URL(url);
  return `${u.protocol}//${u.hostname}/*`;
}

// Pide permiso para hablar con el servidor (solo esa dirección).
// Debe llamarse directamente desde un clic.
async function withServer(fn) {
  const id = current();
  const s = SERVERS[id];
  const url = normalizeUrl($("url").value, s.port);
  const token = $("token").value.trim();
  if (!url) { say(`Escribe una dirección válida, por ejemplo ${s.placeholder}`, "err"); return; }
  if (!token) { say(s.missing, "err"); return; }
  const origin = new URL(url).origin;
  let granted = false;
  try { granted = await api.permissions.request({ origins: [hostPattern(url)] }); }
  catch (e) { say("No se pudo pedir permiso: " + e.message, "err"); return; }
  if (!granted) { say(`Sin permiso para acceder a ${origin}, la extensión no puede consultar tu ${s.name}.`, "err"); return; }
  $("url").value = url;
  await fn(id, url, token);
}

async function testConnection(id, url, token) {
  say("Conectando…");
  const r = await api.runtime.sendMessage({ action: "media-test", server: id, url, token });
  if (!r?.ok) { say(r?.error || "No se pudo conectar.", "err"); return false; }
  status.className = "ok";
  status.textContent = `Conectado a «${r.name}». Bibliotecas encontradas:`;
  const ul = document.createElement("ul");
  const items = r.sections.length ? r.sections.map((x) => `${x.title} (${x.type === "show" ? "series" : "películas"})`) : ["Ninguna biblioteca de películas o series."];
  for (const t of items) {
    const li = document.createElement("li");
    li.textContent = t;
    ul.append(li);
  }
  status.append(ul);
  return true;
}

$("test").addEventListener("click", () => withServer(testConnection));

$("save").addEventListener("click", () => withServer(async (id, url, token) => {
  const s = SERVERS[id];
  const data = { [s.urlKey]: url, [s.tokenKey]: token };
  await api.storage.local.set(data);
  await api.storage.local.remove("server"); // ya no hay un único servidor activo
  Object.assign(stored, data);
  dots();
  await api.runtime.sendMessage({ action: "media-reset" });
  const others = Object.keys(SERVERS).filter((k) => k !== id && isSet(k)).map((k) => SERVERS[k].name);
  if (await testConnection(id, url, token)) status.prepend(`Guardado. ${others.length ? `UIspa consultará ${s.name} y ${others.join(" y ")}. ` : ""}`);
}));

$("clear").addEventListener("click", async () => {
  const s = SERVERS[current()];
  const url = stored[s.urlKey];
  const remove = [s.urlKey, s.tokenKey];
  await api.storage.local.remove(remove);
  remove.forEach((k) => delete stored[k]);
  dots();
  await api.runtime.sendMessage({ action: "media-reset" });
  if (url) { try { await api.permissions.remove({ origins: [hostPattern(url)] }); } catch (_) {} }
  $("url").value = ""; $("token").value = "";
  say(`${s.name} desconectado. Se han borrado la dirección y la clave.`);
});

$("show").addEventListener("click", () => {
  $("token").type = $("token").type === "password" ? "text" : "password";
});

document.querySelectorAll("input[name=server]").forEach((r) => r.addEventListener("change", showServer));

api.storage.local.get(["server", "plexUrl", "plexToken", "jfUrl", "jfKey"]).then((s) => {
  stored = s;
  // Se abre en Plex salvo que solo esté configurado Jellyfin
  const id = !isSet("plex") && isSet("jellyfin") ? "jellyfin" : "plex";
  document.querySelector(`input[name=server][value=${id}]`).checked = true;
  showServer();
});

// Título según la extensión
{
  const name = api.runtime.getManifest().name;
  if (name !== "UIspa") { $("title").textContent = name + " · Ajustes"; document.title = name + " · Ajustes"; }
}
