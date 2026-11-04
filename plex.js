// UIspa · marca en la ficha qué episodios (o qué película) ya están en tu Plex
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

  function badge(cls, text, title) {
    const b = document.createElement("span");
    b.className = "hc-plex " + cls;
    b.textContent = text;
    if (title) b.title = title;
    return b;
  }
  function putHero(el) {
    $$(".hc-plex-hero").forEach((x) => x.remove());
    el.classList.add("hc-plex-hero");
    const slot = $(".hcm-eyebrow") || $("td.R2 h1");
    if (!slot) return;
    if (slot.matches("h1")) slot.after(el); else slot.append(el);
  }

  const sameFile = (row, files) => row.size && files.some((f) => f.size && Math.abs(f.size - row.size.bytes) <= row.size.tol);

  // Decide la marca de una fila frente a los archivos que tienes en Plex
  function verdict(row, files) {
    if (!files) return { cls: "hc-plex-no", text: "Falta", title: "No está en tu Plex" };
    if (sameFile(row, files)) return { cls: "hc-plex-yes", text: "✓ En Plex", title: "Tienes exactamente este archivo", exact: true };
    const resList = [...new Set(files.map((f) => normRes(f.res)).filter(Boolean))];
    const label = resList.map(resLabel).join(", ");
    if (row.res && resList.includes(row.res)) {
      return { cls: "hc-plex-same", text: `≈ En Plex (${label})`, title: "Tienes este episodio en la misma calidad, pero en otro archivo" };
    }
    return { cls: "hc-plex-other", text: label ? `En Plex en ${label}` : "En Plex (otra versión)", title: "Tienes este episodio, pero en otra versión" };
  }

  const key = (s, e) => `${s}x${e}`;

  async function run() {
    const info = titleInfo();
    if (!info) return;
    let res;
    try { res = await api.runtime.sendMessage({ action: "plex-lookup", query: info }); } catch (_) { return; }
    if (!res || !res.configured) return; // Plex sin configurar: no se muestra nada

    if (res.error) { putHero(badge("hc-plex-err", "Plex: sin conexión", res.error)); return; }
    const all = rows();
    if (!res.found) {
      putHero(badge("hc-plex-no", "No está en tu Plex"));
      all.forEach((r) => r.ep && r.link.parentElement.append(badge("hc-plex-no", "Falta")));
      return;
    }

    const exactByGroup = new Map();
    const countExact = (r) => exactByGroup.set(r.group, (exactByGroup.get(r.group) || 0) + 1);

    if (info.type === "movie") {
      const files = res.files || [];
      // Si alguna versión coincide exactamente, solo se marca esa; si no, se
      // indica en cada versión si la tienes en la misma u otra calidad.
      const exact = all.filter((r) => sameFile(r, files));
      if (exact.length) {
        exact.forEach((r) => { r.link.parentElement.append(badge("hc-plex-yes", "✓ La tienes", "Tienes exactamente este archivo en Plex")); countExact(r); });
      } else {
        all.forEach((r) => {
          const v = verdict(r, files);
          const text = v.cls === "hc-plex-same" ? v.text.replace("En Plex", "La tienes") : v.text.replace("En Plex en", "La tienes en").replace("En Plex (otra versión)", "La tienes (otra versión)");
          r.link.parentElement.append(badge(v.cls, text, v.title.replace("este episodio", "esta película")));
        });
      }
      const q = [...new Set((res.resolutions || []).map(resLabel))].join(", ");
      const which = [...exactByGroup.keys()][0];
      putHero(badge("hc-plex-yes", "✓ En tu Plex" + (which ? ` · ${which}` : q ? ` (${q})` : ""),
        which ? `Tienes la versión «${which}»` : `En tu Plex${q ? " en " + q : ""}, pero no ninguna de estas versiones exactas`));
      return;
    }

    const have = new Map((res.episodes || []).map((x) => [key(x.s, x.e), x.files || []]));
    const pageEps = new Set();
    all.forEach((r) => {
      if (!r.ep) return;
      const k = key(r.ep.s, r.ep.e);
      pageEps.add(k);
      const v = verdict(r, have.get(k));
      if (v.exact) countExact(r);
      r.link.parentElement.append(badge(v.cls, v.text, v.title));
    });

    const got = [...pageEps].filter((k) => have.has(k)).length;
    const cls = got === pageEps.size && got > 0 ? "hc-plex-yes" : got ? "hc-plex-part" : "hc-plex-no";
    // Versión(es) que tienes, según los archivos idénticos
    const groups = [...exactByGroup.entries()].sort((a, b) => b[1] - a[1]);
    const n = (x) => `${x} archivo${x === 1 ? "" : "s"} idéntico${x === 1 ? "" : "s"}`;
    const suffix = groups.length === 1 ? ` · ${groups[0][0]}` : groups.length > 1 ? " · varias versiones" : "";
    const detail = groups.length ? ". Versiones que tienes: " + groups.map(([g, c]) => `«${g}» (${n(c)})`).join(", ") : "";
    putHero(badge(cls, pageEps.size ? `En tu Plex: ${got} de ${pageEps.size}${suffix}` : "✓ En tu Plex",
      `«${res.title}» en tu Plex: ${have.size} episodio${have.size === 1 ? "" : "s"} en total${detail}`));
  }

  run();
})();
