// UIspa · capa común para servidores multimedia (Plex y/o Jellyfin).
// Busca el título en todos los servidores configurados y responde a la página con un
// formato único. Las peticiones salen del segundo plano de la extensión, así
// que tus credenciales nunca llegan a la web.
(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;
  const servers = globalThis.__uispaServers || {};
  const KEYS = ["server", "plexUrl", "plexToken", "jfUrl", "jfKey"];

  // Servidores configurados: todos los que tengan dirección y credencial.
  async function activeAll() {
    const s = await api.storage.local.get(KEYS);
    return Object.entries(servers)
      .filter(([, srv]) => srv.configured(s))
      .map(([id, srv]) => ({ id, srv, cfg: srv.config(s) }));
  }

  const norm = (s) => (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\(.*?\)/g, " ").replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, " ").trim();

  // Puntuación de coincidencia: IMDb exacto > título+año > solo título
  function score(item, q) {
    if (q.imdb && item.imdb === q.imdb) return 3;
    const names = [q.title, q.originalTitle].map(norm).filter(Boolean);
    const mine = [item.title, item.originalTitle].map(norm).filter(Boolean);
    if (!names.some((n) => mine.includes(n))) return 0;
    if (q.year && item.year) return Math.abs(item.year - q.year) <= 1 ? 2 : 0;
    return 1;
  }

  // Busca el título en un servidor concreto
  async function lookupOne({ id, srv, cfg }, q) {
    const type = q.type === "movie" ? "movie" : "show";
    let best = null, bestScore = 0;
    for (const item of await srv.catalog(cfg, type)) {
      const sc = score(item, q);
      if (sc > bestScore) { best = item; bestScore = sc; if (sc === 3) break; }
    }
    const base = { id, server: srv.name };
    if (!best) return { ...base, found: false };
    const out = { ...base, found: true, title: best.title, year: best.year, by: bestScore === 3 ? "imdb" : "title" };
    if (type === "show") out.episodes = await srv.episodes(cfg, best);
    else Object.assign(out, await srv.movieFiles(cfg, best));
    return out;
  }

  // Consulta todos los servidores configurados a la vez
  async function lookup(q) {
    const list = await activeAll();
    if (!list.length) return { configured: false, results: [] };
    const results = await Promise.all(list.map((a) =>
      lookupOne(a, q).catch((e) => ({ id: a.id, server: a.srv.name, error: e.message }))));
    return { configured: true, results };
  }

  api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.action === "media-lookup") {
      lookup(msg.query).then(sendResponse, (e) => sendResponse({ configured: true, results: [], error: e.message }));
      return true;
    }
    if (msg?.action === "media-test") {
      const srv = servers[msg.server];
      if (!srv) { sendResponse({ ok: false, error: "Servidor desconocido" }); return; }
      const cfg = msg.server === "plex" ? srv.config({ plexUrl: msg.url, plexToken: msg.token }) : srv.config({ jfUrl: msg.url, jfKey: msg.token });
      srv.test(cfg).then((r) => sendResponse({ ok: true, ...r }), (e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    if (msg?.action === "media-reset") {
      Object.values(servers).forEach((s) => s.reset());
      sendResponse({ ok: true });
    }
  });

  globalThis.__uispaMedia = { lookup, activeAll, servers };
})();
