(() => {
  "use strict";
  if (window.__hispashareCopy) return;
  window.__hispashareCopy = true;

  const api = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : null);
  const ED2K_RE = /(ed2k:\/\/\|file\|[^\n\r]+?\|\/)|(magnet:\?[^\s"'<>]+)/g;

  // ---------------------------------------------------------------- utilidades
  let toastTimer;
  function toast(msg, error = false) {
    let t = document.getElementById("hc-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "hc-toast";
      document.documentElement.appendChild(t);
    }
    t.textContent = msg;
    t.className = error ? "hc-show hc-error" : "hc-show";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = ""), 2400);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) { /* sigue */ }
    try {
      // el service worker copia mediante un documento offscreen, sin depender del clic
      const r = await api?.runtime?.sendMessage({ action: "bg-copy", text });
      if (r?.ok) return true;
    } catch (_) { /* sigue */ }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }

  async function copyLinks(links, what = "", retryHint = false) {
    if (!links.length) { toast("No se han encontrado enlaces", true); return false; }
    const ok = await copyText(links.join("\n"));
    if (ok) {
      toast(`📋 Copiado${links.length === 1 ? "" : "s"} ${links.length} enlace${links.length === 1 ? "" : "s"}${what ? " · " + what : ""}`);
    } else if (retryHint) {
      toast("Enlaces preparados: vuelve a pulsar para copiarlos");
    } else {
      toast("No se pudo copiar al portapapeles", true);
    }
    return ok;
  }

  function extractLinks(text) {
    return (text.match(ED2K_RE) || []).map((s) => s.trim());
  }

  // Pide a Hispashare los enlaces de un grupo con la máscara dada ("101100…")
  async function fetchLinks(groupId, mask) {
    const url = `${location.origin}/ajax/download.php?id=${groupId}&code=${mask}&nocache=${Math.random()}`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const ta = doc.querySelector("#ELINKSLIST, textarea");
    // textarea.value ya decodifica entidades como &oacute;
    return extractLinks(ta ? ta.value : doc.body.textContent || "");
  }

  function setBusy(btn, on) {
    btn.classList.toggle("hc-busy", on);
    if (on) btn.dataset.busy = "1"; else delete btn.dataset.busy;
  }

  // ---------------------------------------------------------------- grupos
  // Cada versión (WEBRip, WEB-DL…) es un grupo. Sus enlaces son
  // javascript:Download(ID, '0100…'): la máscara dice cuántos archivos tiene
  // la versión y cuál es este. Así funciona igual en series (con casillas y
  // "Mostrar seleccionados") que en películas (sin ellos).
  function parseDownload(a) {
    const m = (a.getAttribute("href") || "").match(/Download\(\s*(\d+)\s*,\s*'([01]+)'\s*\)/);
    return m ? { id: m[1], mask: m[2] } : null;
  }
  function findGroups(root = document) {
    const map = new Map();
    root.querySelectorAll('a[href*="Download("]').forEach((a) => {
      const d = parseDownload(a);
      if (!d) return;
      let g = map.get(d.id);
      if (!g) map.set(d.id, (g = { id: d.id, count: d.mask.length, rows: [], btn: null }));
      g.count = Math.max(g.count, d.mask.length);
      const i = d.mask.indexOf("1");
      if (i < 0 || d.mask.lastIndexOf("1") !== i) return; // enlace a varios archivos
      const tr = a.closest("tr");
      const prev = g.rows.find((r) => r.i === i);
      // si la fila tiene icono y nombre enlazados, nos quedamos con el del nombre
      if (prev) { if (!prev.link.textContent.trim() && a.textContent.trim()) prev.link = a; return; }
      g.rows.push({ i, link: a, tr });
    });
    root.querySelectorAll('a[onclick*="DownloadSelected"]').forEach((btn) => {
      const m = btn.getAttribute("onclick").match(/DownloadSelected\((\d+)\s*,\s*(\d+)\)/);
      const g = m && map.get(m[1]);
      if (g) { g.btn = btn; g.count = Math.max(g.count, Number(m[2])); }
    });
    return [...map.values()];
  }
  const maskAll = (n) => "1".repeat(n);
  const isChecked = (g, i) => !!document.getElementById(`elink_${g.id}_${i}`)?.checked;
  function maskSelected(g) {
    let m = "";
    for (let i = 0; i < g.count; i++) m += isChecked(g, i) ? "1" : "0";
    return m;
  }

  // Firefox solo deja escribir en el portapapeles durante el clic. Si se espera
  // a la respuesta del servidor, el permiso caduca. Por eso los enlaces de cada
  // versión se piden antes (al pasar el ratón por los botones) y se guardan, y
  // al hacer clic se copian al instante.
  const cache = new Map(); // id → { links, promise }
  function getAll(g) {
    let c = cache.get(g.id);
    if (!c) {
      c = { links: null };
      c.promise = fetchLinks(g.id, maskAll(g.count)).then(
        (links) => (c.links = links),
        (e) => { cache.delete(g.id); throw e; });
      cache.set(g.id, c);
    }
    return c;
  }
  const prefetch = (g) => getAll(g).promise.catch(() => {});

  // kind: "all" | "sel" | número de fila
  function pick(g, links, kind) {
    if (kind === "all") return links;
    if (links.length !== g.count) return null; // no se puede mapear por posición
    if (kind === "sel") return links.filter((_, i) => isChecked(g, i));
    return links[kind] ? [links[kind]] : [];
  }

  function copyGroup(g, btn, kind, label, onOk) {
    if (btn.dataset.busy) return;
    if (kind === "sel" && !maskSelected(g).includes("1")) { toast("Marca algún capítulo primero", true); return; }
    const c = getAll(g);
    const sel = c.links && pick(g, c.links, kind);
    if (sel) {
      // Enlaces ya disponibles: copia síncrona dentro del clic
      copyLinks(sel, label).then((ok) => ok && onOk?.());
      return;
    }
    // Aún no están: se esperan y se intenta copiar; si Firefox lo bloquea,
    // el siguiente clic ya copia al instante.
    setBusy(btn, true);
    (async () => {
      try {
        await c.promise;
        let links = pick(g, c.links, kind);
        if (!links) {
          const mask = kind === "sel" ? maskSelected(g) : "0".repeat(kind) + "1" + "0".repeat(g.count - kind - 1);
          links = await fetchLinks(g.id, mask);
        }
        if (await copyLinks(links, label, true)) onOk?.();
      } catch (e) {
        toast("Error al obtener los enlaces: " + e.message, true);
      } finally {
        setBusy(btn, false);
      }
    })();
  }

  function makeSiteButton(label, title, onClick) {
    const a = document.createElement("a");
    a.className = "BUTTON hc-site-btn";
    a.title = title;
    for (const cls of ["L", "C", "R"]) {
      const s = document.createElement("span");
      s.className = cls;
      s.textContent = cls === "C" ? label : "\u00a0";
      a.append(s);
    }
    a.addEventListener("click", (e) => { e.preventDefault(); onClick(a); });
    return a;
  }

  const done = new Set();
  function enhanceGroup(g) {
    if (done.has(g.id) || !g.rows.length) return;
    done.add(g.id);
    const warm = () => prefetch(g);
    const hasChecks = g.rows.some((r) => document.getElementById(`elink_${g.id}_${r.i}`));

    // Botones del grupo
    const buttons = [];
    if (hasChecks) {
      buttons.push(makeSiteButton("📋 Copiar seleccionados", "Copiar los enlaces marcados de esta versión",
        (b) => copyGroup(g, b, "sel", "seleccionados")));
    }
    buttons.push(g.count === 1
      ? makeSiteButton("📋 Copiar enlace", "Copiar el enlace ed2k de esta versión", (b) => copyGroup(g, b, "all", ""))
      : makeSiteButton("📋 Copiar todos", "Copiar todos los enlaces ed2k de esta versión", (b) => copyGroup(g, b, "all", "toda la versión")));
    for (const b of buttons) {
      b.addEventListener("pointerenter", warm);
      b.addEventListener("focus", warm);
    }
    if (g.btn) {
      // series: junto a "Mostrar seleccionados"
      g.btn.after(...buttons.flatMap((b) => [document.createTextNode(" "), b]));
    } else {
      // películas: barra propia debajo de la tabla de la versión
      const table = g.rows[0].tr?.closest("table");
      const bar = document.createElement("div");
      bar.className = "hc-btnbar";
      bar.append(...buttons);
      if (table) table.after(bar); else g.rows[0].link.after(bar);
    }

    // Botón 📋 en cada fila
    for (const { i, link, tr } of g.rows) {
      if (link.dataset.hcDone) continue;
      link.dataset.hcDone = "1";
      const b = document.createElement("button");
      b.type = "button";
      b.className = "hc-copy-btn";
      b.title = "Copiar enlace ed2k";
      b.textContent = "📋";
      b.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        copyGroup(g, b, i, "", () => {
          b.textContent = "✔";
          setTimeout(() => (b.textContent = "📋"), 1200);
        });
      });
      (tr || link).addEventListener("pointerenter", warm);
      b.addEventListener("focus", warm);
      link.after(b);

      // Alt+clic en el nombre = copiar en vez de abrir el popup
      link.addEventListener("click", (e) => {
        if (!e.altKey) return;
        e.preventDefault(); e.stopImmediatePropagation();
        b.click();
      }, true);
    }
  }

  async function copyAllPage() {
    const groups = findGroups();
    if (!groups.length) {
      // página sin grupos: busca enlaces sueltos (popup abierto, textos…)
      const loose = [
        ...[...document.querySelectorAll('a[href^="ed2k:" i], a[href^="magnet:" i]')].map((a) => a.href),
        ...[...document.querySelectorAll("textarea")].flatMap((t) => extractLinks(t.value))
      ];
      return copyLinks([...new Set(loose)], "página");
    }
    toast(`Obteniendo enlaces de ${groups.length} versión${groups.length === 1 ? "" : "es"}…`);
    try {
      const all = [];
      for (const g of groups) all.push(...(await getAll(g).promise));
      copyLinks([...new Set(all)], "toda la página", true);
    } catch (e) { toast("Error al obtener los enlaces: " + e.message, true); }
  }

  async function copySelectedPage() {
    const groups = findGroups().map((g) => ({ g, m: maskSelected(g) })).filter((x) => x.m.includes("1"));
    if (!groups.length) { toast("No hay capítulos marcados", true); return; }
    try {
      const all = [];
      for (const { g, m } of groups) {
        await getAll(g).promise;
        all.push(...(pick(g, cache.get(g.id).links, "sel") || (await fetchLinks(g.id, m))));
      }
      copyLinks(all, "seleccionados", true);
    } catch (e) { toast("Error al obtener los enlaces: " + e.message, true); }
  }

  // ---------------------------------------------------------------- popup nativo
  // Cuando la web muestra "Enlaces seleccionados", añade un botón Copiar.
  function enhancePopup() {
    const ta = document.getElementById("ELINKSLIST");
    if (!ta || ta.dataset.hcDone) return;
    ta.dataset.hcDone = "1";
    const exec = ta.parentElement.querySelector('a[onclick*="eMule"]');
    const b = makeSiteButton("📋 Copiar", "Copiar estos enlaces al portapapeles", () => copyLinks(extractLinks(ta.value)));
    if (exec) exec.after(document.createTextNode("\u00a0\u00a0\u00a0\u00a0"), b);
    else ta.after(b);
    ta.addEventListener("focus", () => ta.select());
  }

  // ---------------------------------------------------------------- arranque
  function scan() {
    findGroups().forEach(enhanceGroup);
    enhancePopup();
  }
  scan();
  let pending;
  new MutationObserver(() => {
    clearTimeout(pending);
    pending = setTimeout(scan, 250);
  }).observe(document.body, { childList: true, subtree: true });

  api?.runtime?.onMessage?.addListener((msg) => {
    switch (msg?.action) {
      case "copy-all": copyAllPage(); break;
      case "copy-selected": copySelectedPage(); break;
      case "copy-text": copyLinks([msg.text]); break;
    }
  });

  window.__hcDebug = { findGroups, fetchLinks, copyAllPage, copySelectedPage, cache };
})();
