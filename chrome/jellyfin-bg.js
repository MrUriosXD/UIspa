// UIspa · conector de Jellyfin (segundo plano).
// Devuelve los datos en el formato común que usa media-bg.js.
(() => {
  const servers = (globalThis.__uispaServers = globalThis.__uispaServers || {});
  const TTL = 10 * 60 * 1000;
  const mem = { lists: new Map() };

  async function get(cfg, path, params = {}) {
    const u = new URL(cfg.url + path);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    let res;
    try {
      res = await fetch(u, {
        headers: {
          Accept: "application/json",
          Authorization: `MediaBrowser Client="UIspa", Device="Navegador", DeviceId="uispa-extension", Version="1.0", Token="${cfg.key}"`
        }
      });
    } catch (e) {
      throw new Error("No se puede conectar con el servidor Jellyfin");
    }
    if (res.status === 401 || res.status === 403) throw new Error("La clave de API de Jellyfin no es válida");
    if (!res.ok) throw new Error("Jellyfin respondió con el error " + res.status);
    return res.json();
  }

  // Resolución a partir de la pista de vídeo (Jellyfin da ancho y alto)
  function resOf(source) {
    const v = (source.MediaStreams || []).find((s) => s.Type === "Video");
    if (!v) return "";
    const w = v.Width || 0, h = v.Height || 0;
    if (w >= 3200 || h >= 1800) return "4k";
    if (w >= 1700 || h >= 1000) return "1080";
    if (w >= 1200 || h >= 700) return "720";
    return w || h ? "sd" : "";
  }
  const filesOf = (item) => (item.MediaSources || []).map((s) => ({ size: Number(s.Size) || 0, res: resOf(s) }));

  const kinds = { show: "Series", movie: "Movie" };

  servers.jellyfin = {
    name: "Jellyfin",
    configured: (s) => !!(s.jfUrl && s.jfKey),
    config: (s) => ({ url: String(s.jfUrl).replace(/\/+$/, ""), key: String(s.jfKey).trim() }),

    async catalog(cfg, type) {
      const hit = mem.lists.get(type);
      if (hit && Date.now() - hit.at < TTL) return hit.data;
      const r = await get(cfg, "/Items", {
        Recursive: "true",
        IncludeItemTypes: kinds[type],
        Fields: "ProviderIds,ProductionYear,OriginalTitle"
      });
      const data = (r.Items || []).map((m) => ({
        id: m.Id,
        title: m.Name,
        originalTitle: m.OriginalTitle,
        year: m.ProductionYear,
        imdb: (m.ProviderIds && (m.ProviderIds.Imdb || m.ProviderIds.IMDB)) || null
      }));
      mem.lists.set(type, { at: Date.now(), data });
      return data;
    },

    async episodes(cfg, item) {
      const r = await get(cfg, `/Shows/${item.id}/Episodes`, { Fields: "MediaSources" });
      return (r.Items || [])
        .filter((e) => e.LocationType !== "Virtual") // episodios que faltan pero Jellyfin conoce
        .map((e) => {
          const files = filesOf(e);
          return { s: e.ParentIndexNumber, e: e.IndexNumber, res: files.map((f) => f.res).filter(Boolean), files };
        });
    },

    async movieFiles(cfg, item) {
      const r = await get(cfg, "/Items", { Ids: item.id, Fields: "MediaSources" });
      const files = filesOf((r.Items || [])[0] || {});
      return { resolutions: files.map((f) => f.res).filter(Boolean), files };
    },

    async test(cfg) {
      const info = await get(cfg, "/System/Info");
      const folders = await get(cfg, "/Library/VirtualFolders");
      const map = { tvshows: "show", movies: "movie" };
      return {
        name: info.ServerName || "Jellyfin",
        sections: (folders || []).filter((f) => map[f.CollectionType]).map((f) => ({ title: f.Name, type: map[f.CollectionType] }))
      };
    },

    reset() { mem.lists.clear(); },
    mem
  };
})();
