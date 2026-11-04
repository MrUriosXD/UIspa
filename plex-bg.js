// UIspa · consulta a tu servidor Plex (se ejecuta en segundo plano).
// Las peticiones salen del fondo de la extensión, no de la página de
// Hispashare, así que tu token nunca llega a la web.
(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;
  const TTL = 10 * 60 * 1000; // la biblioteca se vuelve a leer cada 10 min
  const mem = { sections: null, lists: new Map() };

  async function config() {
    const { plexUrl, plexToken } = await api.storage.local.get(["plexUrl", "plexToken"]);
    if (!plexUrl || !plexToken) return null;
    return { url: String(plexUrl).replace(/\/+$/, ""), token: String(plexToken).trim() };
  }

  async function plexGet(cfg, path, params = {}) {
    const u = new URL(cfg.url + path);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    let res;
    try {
      res = await fetch(u, {
        headers: {
          Accept: "application/json",
          "X-Plex-Token": cfg.token,
          "X-Plex-Product": "UIspa",
          "X-Plex-Client-Identifier": "uispa-extension"
        }
      });
    } catch (e) {
      throw new Error("No se puede conectar con el servidor Plex");
    }
    if (res.status === 401) throw new Error("El token de Plex no es válido");
    if (!res.ok) throw new Error("Plex respondió con el error " + res.status);
    return (await res.json()).MediaContainer || {};
  }

  // Archivos de un elemento: solo tamaño exacto y resolución (no se envían
  // rutas de tu servidor a la página)
  const filesOf = (m) => (m.Media || []).flatMap((x) =>
    (x.Part || []).map((p) => ({ size: Number(p.size) || 0, res: x.videoResolution || "" })));

  const fresh = (entry) => entry && Date.now() - entry.at < TTL;

  async function sections(cfg) {
    if (fresh(mem.sections)) return mem.sections.data;
    const mc = await plexGet(cfg, "/library/sections");
    const data = (mc.Directory || []).map((d) => ({ key: d.key, type: d.type, title: d.title }));
    mem.sections = { at: Date.now(), data };
    return data;
  }

  async function list(cfg, section) {
    const hit = mem.lists.get(section.key);
    if (fresh(hit)) return hit.data;
    const mc = await plexGet(cfg, `/library/sections/${section.key}/all`, {
      type: section.type === "show" ? 2 : 1,
      includeGuids: 1
    });
    const data = (mc.Metadata || []).map((m) => ({
      ratingKey: m.ratingKey,
      title: m.title,
      originalTitle: m.originalTitle,
      year: m.year,
      guids: (m.Guid || []).map((g) => g.id),
      resolutions: (m.Media || []).map((x) => x.videoResolution).filter(Boolean),
      files: filesOf(m)
    }));
    mem.lists.set(section.key, { at: Date.now(), data });
    return data;
  }

  const norm = (s) => (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\(.*?\)/g, " ").replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, " ").trim();

  // Puntuación de coincidencia: IMDb exacto > título+año > solo título
  function score(item, q) {
    if (q.imdb && item.guids.includes("imdb://" + q.imdb)) return 3;
    const names = [q.title, q.originalTitle].map(norm).filter(Boolean);
    const mine = [item.title, item.originalTitle].map(norm).filter(Boolean);
    if (!names.some((n) => mine.includes(n))) return 0;
    if (q.year && item.year) return Math.abs(item.year - q.year) <= 1 ? 2 : 0;
    return 1;
  }

  async function lookup(q) {
    const cfg = await config();
    if (!cfg) return { configured: false };
    const wanted = q.type === "movie" ? "movie" : "show";
    let best = null, bestScore = 0;
    for (const s of await sections(cfg)) {
      if (s.type !== wanted) continue;
      for (const item of await list(cfg, s)) {
        const sc = score(item, q);
        if (sc > bestScore) { best = item; bestScore = sc; if (sc === 3) break; }
      }
      if (bestScore === 3) break;
    }
    if (!best) return { configured: true, found: false };
    const out = { configured: true, found: true, title: best.title, year: best.year, by: bestScore === 3 ? "imdb" : "title" };
    if (wanted === "show") {
      const mc = await plexGet(cfg, `/library/metadata/${best.ratingKey}/allLeaves`);
      out.episodes = (mc.Metadata || []).map((e) => ({
        s: e.parentIndex, e: e.index,
        res: (e.Media || []).map((x) => x.videoResolution).filter(Boolean),
        files: filesOf(e)
      }));
    } else {
      out.resolutions = best.resolutions;
      out.files = best.files;
    }
    return out;
  }

  async function test(url, token) {
    const cfg = { url: String(url).replace(/\/+$/, ""), token: String(token).trim() };
    const root = await plexGet(cfg, "/");
    const secs = (await plexGet(cfg, "/library/sections")).Directory || [];
    return {
      name: root.friendlyName || "Plex",
      sections: secs.filter((s) => s.type === "show" || s.type === "movie").map((s) => ({ title: s.title, type: s.type }))
    };
  }

  api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.action === "plex-lookup") {
      lookup(msg.query).then(sendResponse, (e) => sendResponse({ configured: true, error: e.message }));
      return true;
    }
    if (msg?.action === "plex-test") {
      test(msg.url, msg.token).then((r) => sendResponse({ ok: true, ...r }), (e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    if (msg?.action === "plex-reset") {
      mem.sections = null; mem.lists.clear();
      sendResponse({ ok: true });
    }
  });

  // para pruebas
  globalThis.__uispaPlex = { lookup, test, mem };
})();
