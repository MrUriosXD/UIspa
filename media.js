// UIspa · marca en la ficha qué episodios (o qué película) ya están en tu
// servidor multimedia (Plex o Jellyfin)
// y, si puede, qué versión exacta tienes.
(() => {
  "use strict";
  if (window.__uispaPlex) return;
  window.__uispaPlex = true;
  if (!/[?&]view=title\b/.test(location.search)) return;

  const api = typeof browser !== "undefined" ? browser : chrome;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");

  // "Brothers 1x01 …", "S01E02", "1x01-02" → { s, e }
  function parseEpisode(name) {
    const m = name.match(/\b(\d{1,2})x(\d{1,3})\b/i) || name.match(/\bS(\d{1,2})\s*E(\d{1,3})\b/i);
    return m ? { s: Number(m[1]), e: Number(m[2]) } : null;
  }

  // "1,44 GB" / "700 MB" → bytes aproximados. Hispashare usa GB de 1024³.
  function parseSize(s) {
    const m = (s || "").replace(/\s+/g, " ").match(/([\d.,]+)\s*([KMGT])B/i);
    if (!m) return null;
    const n = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
    const pow = { K: 1, M: 2, G: 3, T: 4 }[m[2].toUpperCase()];
    const decimals = (m[1].split(",")[1] || "").length;
    // margen = media unidad del último decimal mostrado (redondeo de la web)
    return { bytes: n * 1024 ** pow, tol: (0.5 * 10 ** -decimals + 0.001) * 1024 ** pow };
  }

  // Resolución de una versión a partir de su título ("WEB-DL 2160p HDR DV: mkv…")
  function groupRes(name) {
    const m = (name || "").match(/\b(2160|1080|720|576|480)p\b|\b(4k|uhd)\b/i);
    if (!m) return null;
    return m[2] || m[1] === "2160" ? "4k" : m[1] === "576" || m[1] === "480" ? "sd" : m[1];
  }
  const normRes = (r) => {
    r = String(r || "").toLowerCase();
    return r === "2160" || r === "uhd" ? "4k" : r === "480" || r === "576" ? "sd" : r;
  };
  const resLabel = (r) => {
    r = normRes(r);
    return r === "4k" ? "4K" : r === "sd" ? "SD" : /^\d+$/.test(r) ? r + "p" : r.toUpperCase();
  };

  // Datos del título a partir de la ficha original (también existe con el rediseño)
  function titleInfo() {
    const r2 = $("td.R2");
    if (!r2) return null;
    const h1 = $("h1", r2);
    const small = txt($("small", h1));
    let title = txt(h1).replace(small, "").trim();
    title = title.replace(/\s*\((?:\d+[ªº]?\s*)?(?:Temporadas?|Miniserie|Serie|Completa|Parte)[^)]*\)\s*$/i, "").trim();
    const year = Number((small.match(/\d{4}/) || [])[0]) || null;
    const origP = $$("p.INFO", r2).find((p) => /T[íi]tulo original/i.test(txt($("strong", p))));
    const originalTitle = origP ? txt(origP).replace(/^.*?:\s*/, "").replace(/\s*\([^)]*\)\s*$/, "") : "";
    const imdb = (($("a[href*='imdb.com/title/']")?.href || "").match(/tt\d+/) || [])[0] || null;
    const genreP = $$("p.INFO", r2).find((p) => /G[ée]nero/i.test(txt($("strong", p))));
    const isShow = /Series\s*>/i.test(txt(genreP)) || rows().some((r) => r.ep);
    return { title, originalTitle, year, imdb, type: isShow ? "show" : "movie" };
  }

  // Filas de descarga con su episodio, tamaño y versión. Se localizan por el
  // enlace javascript:Download(ID,'0010…'), que existe tanto en series como en
  // películas (estas últimas no tienen casillas).
  function rows() {
    const seen = new Map();
    $$("a[href*='Download(']").forEach((a) => {
      const m = (a.getAttribute("href") || "").match(/Download\(\s*(\d+)\s*,\s*'([01]+)'/);
      if (!m) return;
      const i = m[2].indexOf("1");
      if (i < 0 || m[2].lastIndexOf("1") !== i) return;
      const k = m[1] + ":" + i;
      const prev = seen.get(k);
      if (prev) { if (!txt(prev.link) && txt(a)) prev.link = a; return; }
      seen.set(k, { link: a });
    });
    return [...seen.values()].map(({ link }) => {
      const row = link.closest("tr");
      const box = row?.closest("td[colspan]") || row?.closest("table")?.parentElement;
      const head = txt(box?.querySelector("h2"));
      return {
        row, link,
        group: head.replace(/:.*$/, ""),
        ep: parseEpisode(txt(link)),
        size: parseSize(txt(row?.querySelector("td.SIZE"))),
        res: groupRes(head)
      };
    });
  }

  function badge(cls, text, title, srvId) {
    const b = document.createElement("span");
    b.className = "hc-plex " + cls + (srvId ? " hc-srv-" + srvId : "");
    b.textContent = text;
    if (title) b.title = title;
    return b;
  }
  function heroSlot() {
    const slot = $(".hcm-eyebrow") || $("td.R2 h1");
    if (slot && slot.matches("h1")) {
      // sin rediseño: contenedor propio debajo del título
      let box = $(".hc-plex-herobox");
      if (!box) { box = document.createElement("div"); box.className = "hc-plex-herobox"; slot.after(box); }
      return box;
    }
    return slot;
  }
  function putHero(el) {
    el.classList.add("hc-plex-hero");
    heroSlot()?.append(el);
  }

  const sameFile = (row, files) => row.size && files.some((f) => f.size && Math.abs(f.size - row.size.bytes) <= row.size.tol);
  const what = (info) => (info.type === "movie" ? "esta película" : "este episodio");

  // Marca de una fila frente a los archivos que tienes en un servidor.
  // kind: yes (archivo idéntico) | same (misma calidad) | other (otra calidad) | missing
  function verdict(row, files, S, info) {
    if (!files) return { kind: "missing" };
    if (sameFile(row, files)) return { kind: "yes", cls: "hc-plex-yes", text: `✓ En ${S}`, title: `Tienes exactamente este archivo en ${S}` };
    const resList = [...new Set(files.map((f) => normRes(f.res)).filter(Boolean))];
    const label = resList.map(resLabel).join(", ");
    if (row.res && resList.includes(row.res)) {
      return { kind: "same", cls: "hc-plex-same", text: `≈ En ${S} (${label})`, title: `Tienes ${what(info)} en ${S} en la misma calidad, pero en otro archivo` };
    }
    return { kind: "other", cls: "hc-plex-other", text: label ? `En ${S} en ${label}` : `En ${S} (otra versión)`, title: `Tienes ${what(info)} en ${S}, pero en otra versión` };
  }

  const key = (s, e) => `${s}x${e}`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  // Calcula las marcas de un servidor: veredicto por fila + resumen para la cabecera
  function analyse(res, info, all) {
    const S = res.server;
    if (res.error) return { hero: badge("hc-plex-err", `${S}: sin conexión`, res.error, res.id), rows: null };
    if (!res.found) return { hero: badge("hc-plex-no", `No está en tu ${S}`, "", res.id), rows: all.map((r) => (r.ep ? { kind: "missing" } : null)) };

    const exactByGroup = new Map();
    const count = (r) => exactByGroup.set(r.group, (exactByGroup.get(r.group) || 0) + 1);

    if (info.type === "movie") {
      const files = res.files || [];
      const anyExact = all.some((r) => sameFile(r, files));
      // Si alguna versión coincide exactamente, solo se marca esa
      const rows = all.map((r) => {
        if (anyExact) return sameFile(r, files) ? (count(r), verdict(r, files, S, info)) : null;
        return verdict(r, files, S, info);
      });
      const q = [...new Set((res.resolutions || []).map(resLabel))].join(", ");
      const which = [...exactByGroup.keys()][0];
      const hero = badge("hc-plex-yes", `✓ En tu ${S}` + (which ? ` · ${which}` : q ? ` (${q})` : ""),
        which ? `Tienes la versión «${which}» en ${S}` : `En tu ${S}${q ? " en " + q : ""}, pero no ninguna de estas versiones exactas`, res.id);
      return { hero, rows };
    }

    const have = new Map((res.episodes || []).map((x) => [key(x.s, x.e), x.files || []]));
    const pageEps = new Set();
    const rows = all.map((r) => {
      if (!r.ep) return null;
      const k = key(r.ep.s, r.ep.e);
      pageEps.add(k);
      const v = verdict(r, have.get(k), S, info);
      if (v.kind === "yes") count(r);
      return v;
    });
    const got = [...pageEps].filter((k) => have.has(k)).length;
    const cls = got === pageEps.size && got > 0 ? "hc-plex-yes" : got ? "hc-plex-part" : "hc-plex-no";
    const groups = [...exactByGroup.entries()].sort((a, b) => b[1] - a[1]);
    const suffix = groups.length === 1 ? ` · ${groups[0][0]}` : groups.length > 1 ? " · varias versiones" : "";
    const detail = groups.length ? ". Versiones que tienes: " + groups.map(([g, c]) => `«${g}» (${plural(c, "archivo")} idéntico${c === 1 ? "" : "s"})`).join(", ") : "";
    const hero = badge(cls, pageEps.size ? `En tu ${S}: ${got} de ${pageEps.size}${suffix}` : `✓ En tu ${S}`,
      `«${res.title}» en tu ${S}: ${plural(have.size, "episodio")} en total${detail}`, res.id);
    return { hero, rows };
  }

  async function run() {
    const info = titleInfo();
    if (!info) return;
    let res;
    try { res = await api.runtime.sendMessage({ action: "media-lookup", query: info }); } catch (_) { return; }
    if (!res || !res.configured || !res.results?.length) return; // sin servidores configurados: no se muestra nada

    const all = rows();
    const per = res.results.map((r) => ({ res: r, ...analyse(r, info, all) }));
    per.forEach((p) => putHero(p.hero));

    // Fila a fila: una marca por cada servidor que lo tiene; "Falta" si no está en ninguno
    const answered = per.filter((p) => p.rows);
    all.forEach((r, i) => {
      const vs = answered.map((p) => ({ v: p.rows[i], p }));
      const have = vs.filter(({ v }) => v && v.kind !== "missing");
      if (have.length) {
        have.forEach(({ v, p }) => r.link.parentElement.append(badge(v.cls, v.text, v.title, p.res.id)));
      } else if (vs.some(({ v }) => v && v.kind === "missing")) {
        const names = answered.map((p) => p.res.server).join(" ni en ");
        r.link.parentElement.append(badge("hc-plex-no", "Falta", `No está en ${names}`));
      }
    });
  }

  run();
})();
