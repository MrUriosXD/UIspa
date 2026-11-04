// UIspa · conector de Plex (segundo plano).
// Devuelve los datos en el formato común que usa media-bg.js.
(() => {
  const servers = (globalThis.__uispaServers = globalThis.__uispaServers || {});
  const TTL = 10 * 60 * 1000; // la biblioteca se vuelve a leer cada 10 min
  const mem = { sections: null, lists: new Map() };

  async function get(cfg, path, params = {}) {
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

  const fresh = (entry) => entry && Date.now() - entry.at < TTL;

  // Archivos de un elemento: solo tamaño exacto y resolución (no se envían
  // rutas de tu servidor a la página)
  const filesOf = (m) => (m.Media || []).flatMap((x) =>
    (x.Part || []).map((p) => ({ size: Number(p.size) || 0, res: x.videoResolution || "" })));

  async function sections(cfg) {
    if (fresh(mem.sections)) return mem.sections.data;
    const mc = await get(cfg, "/library/sections");
    const data = (mc.Directory || []).map((d) => ({ key: d.key, type: d.type, title: d.title }));
    mem.sections = { at: Date.now(), data };
    return data;
  }

  async function list(cfg, section) {
    const hit = mem.lists.get(section.key);
    if (fresh(hit)) return hit.data;
    const mc = await get(cfg, `/library/sections/${section.key}/all`, {
      type: section.type === "show" ? 2 : 1,
      includeGuids: 1
    });
    const data = (mc.Metadata || []).map((m) => ({
      id: m.ratingKey,
      title: m.title,
      originalTitle: m.originalTitle,
      year: m.year,
      imdb: ((m.Guid || []).map((g) => g.id).find((g) => g.startsWith("imdb://")) || "").slice(7) || null,
      resolutions: (m.Media || []).map((x) => x.videoResolution).filter(Boolean),
      files: filesOf(m)
    }));
    mem.lists.set(section.key, { at: Date.now(), data });
    return data;
  }

  servers.plex = {
    name: "Plex",
    configured: (s) => !!(s.plexUrl && s.plexToken),
    config: (s) => ({ url: String(s.plexUrl).replace(/\/+$/, ""), token: String(s.plexToken).trim() }),

    // Todos los títulos del tipo pedido ("show" | "movie")
    async catalog(cfg, type) {
      const out = [];
      for (const s of await sections(cfg)) if (s.type === type) out.push(...(await list(cfg, s)));
      return out;
    },

    async episodes(cfg, item) {
      const mc = await get(cfg, `/library/metadata/${item.id}/allLeaves`);
      return (mc.Metadata || []).map((e) => ({
        s: e.parentIndex, e: e.index,
        res: (e.Media || []).map((x) => x.videoResolution).filter(Boolean),
        files: filesOf(e)
      }));
    },

    async movieFiles(_cfg, item) {
      return { resolutions: item.resolutions, files: item.files };
    },

    async test(cfg) {
      const root = await get(cfg, "/");
      const secs = (await get(cfg, "/library/sections")).Directory || [];
      return {
        name: root.friendlyName || "Plex",
        sections: secs.filter((s) => s.type === "show" || s.type === "movie").map((s) => ({ title: s.title, type: s.type }))
      };
    },

    reset() { mem.sections = null; mem.lists.clear(); },
    mem
  };
})();
