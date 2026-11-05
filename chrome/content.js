(() => {
  "use strict";
  // Si hay otra copia de UIspa instalada (p. ej. una versión antigua), solo
  // trabaja la primera que llegó a la página; las demás se apartan.
  {
    const ext = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : null);
    const me = ext?.runtime?.id || "uispa";
    const owner = document.documentElement.dataset.uispaOwner;
    if (owner && owner !== me) return;
    document.documentElement.dataset.uispaOwner = me;
  }
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
      // el segundo plano intenta copiar sin depender del clic
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
  const uiByGroup = new Map(); // id → { last: último botón del grupo, rows: Map(i → botón 📋) }
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
    const ui = { last: buttons[buttons.length - 1], rows: new Map() };
    uiByGroup.set(g.id, ui);
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
      ui.rows.set(i, b);

      // Alt+clic en el nombre = copiar en vez de abrir el popup
      link.addEventListener("click", (e) => {
        if (!e.altKey) return;
        e.preventDefault(); e.stopImmediatePropagation();
        b.click();
      }, true);
    }
  }

  // ---------------------------------------------------------------- Synology
  // Botones 📥 para mandar los enlaces a Download Station (solo si está configurado)
  let nasOn = false;
  const nasDone = new Set();
  // Recuadro para elegir la carpeta de destino, con explorador de carpetas
  // del NAS. Devuelve la carpeta ("" = la predeterminada de Download Station)
  // o null si se cancela.
  let openPop = null;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  async function pickFolder(anchor) {
    openPop?.cancel();
    let st = {};
    try { st = (await api.runtime.sendMessage({ action: "ds-status" })) || {}; } catch (_) {}
    return new Promise((resolve) => {
      const pop = el("div", "hc-nas-pop");
      pop.setAttribute("role", "dialog");
      const label = el("label", null, "Carpeta");
      const input = el("input");
      input.type = "text";
      input.placeholder = "Carpeta predeterminada de Download Station";
      input.spellcheck = false;
      label.append(input);

      // Explorador: ruta (migas) + subcarpetas
      const crumbs = el("div", "hc-nas-crumbs");
      const list = el("div", "hc-nas-list");
      const note = el("div", "hc-nas-note");

      const chips = el("div", "hc-nas-chips");
      const options = [...new Set([st.dest, ...(st.recent || [])].filter(Boolean))].slice(0, 6);
      for (const d of options) {
        const c = el("button", null, d === st.dest ? `${d} (por defecto)` : d);
        c.type = "button";
        c.addEventListener("click", () => browse(d));
        chips.append(c);
      }
      const row = el("div", "hc-nas-actions");
      const cancel = el("button", null, "Cancelar");
      const ok = el("button", "hc-nas-ok", "Enviar aquí");
      cancel.type = ok.type = "button";
      row.append(cancel, ok);
      pop.append(el("div", "hc-nas-title", "📥 Enviar a Download Station"), label, crumbs, list, note, ...(options.length ? [chips] : []), row);

      let seq = 0;
      async function browse(path) {
        const my = ++seq;
        input.value = path;
        crumbs.textContent = "";
        const parts = path ? path.split("/") : [];
        const home = el("button", "hc-nas-crumb", "NAS");
        home.type = "button";
        home.addEventListener("click", () => browse(""));
        crumbs.append(home);
        parts.forEach((part, i) => {
          crumbs.append(el("span", "hc-nas-sep", "›"));
          const b = el("button", "hc-nas-crumb", part);
          b.type = "button";
          b.addEventListener("click", () => browse(parts.slice(0, i + 1).join("/")));
          crumbs.append(b);
        });
        list.textContent = "";
        list.append(el("div", "hc-nas-empty", "Cargando…"));
        note.textContent = "";
        let r;
        try { r = await api.runtime.sendMessage({ action: "ds-list", path }); } catch (e) { r = { ok: false, error: e.message }; }
        if (my !== seq) return; // se pidió otra carpeta mientras tanto
        list.textContent = "";
        if (!r?.ok) {
          list.hidden = true; crumbs.hidden = true;
          note.textContent = r?.error || "No se pudieron leer las carpetas del NAS";
          return;
        }
        list.hidden = false; crumbs.hidden = false;
        if (path) {
          const up = el("button", "hc-nas-item hc-nas-up", "↑ Subir");
          up.type = "button";
          up.addEventListener("click", () => browse(parts.slice(0, -1).join("/")));
          list.append(up);
        }
        for (const f of r.folders) {
          const b = el("button", "hc-nas-item", "📁 " + f.name);
          b.type = "button";
          b.title = f.path;
          b.addEventListener("click", () => browse(f.path));
          list.append(b);
        }
        if (!r.folders.length) list.append(el("div", "hc-nas-empty", path ? "Sin subcarpetas" : "No hay carpetas compartidas accesibles"));
      }

      const close = (value) => {
        document.removeEventListener("pointerdown", outside, true);
        pop.remove();
        if (openPop?.pop === pop) openPop = null;
        resolve(value);
      };
      const outside = (e) => { if (!pop.contains(e.target)) close(null); };
      cancel.addEventListener("click", () => close(null));
      ok.addEventListener("click", () => close(input.value.trim().replace(/^\/+|\/+$/g, "")));
      pop.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); ok.click(); }
        if (e.key === "Escape") { e.preventDefault(); close(null); }
        e.stopPropagation();
      });
      // Si se escribe una ruta a mano y se pulsa Tab o se sale del campo, se explora
      input.addEventListener("change", () => browse(input.value.trim().replace(/^\/+|\/+$/g, "")));

      document.documentElement.append(pop);
      const place = () => {
        const r = anchor.getBoundingClientRect();
        const w = pop.offsetWidth, h = pop.offsetHeight;
        const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
        let top = r.bottom + 6;
        if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
        pop.style.left = left + "px";
        pop.style.top = top + "px";
      };
      place();
      setTimeout(() => document.addEventListener("pointerdown", outside, true), 0);
      openPop = { pop, cancel: () => close(null) };
      // Empieza en la última carpeta usada o en la de por defecto
      browse((st.recent || [])[0] || st.dest || "").then(place);
      input.focus();
    });
  }

  async function sendToNas(g, btn, kind) {
    if (btn.dataset.busy) return;
    if (kind === "sel" && !maskSelected(g).includes("1")) { toast("Marca algún capítulo primero", true); return; }
    prefetch(g); // los enlaces se van pidiendo mientras eliges carpeta
    const dest = await pickFolder(btn);
    if (dest === null) return;
    setBusy(btn, true);
    try {
      const c = getAll(g);
      await c.promise;
      let links = pick(g, c.links, kind);
      if (!links) {
        const mask = kind === "sel" ? maskSelected(g) : kind === "all" ? maskAll(g.count) : "0".repeat(kind) + "1" + "0".repeat(g.count - kind - 1);
        links = await fetchLinks(g.id, mask);
      }
      if (!links.length) { toast("No se han encontrado enlaces", true); return; }
      const r = await api.runtime.sendMessage({ action: "ds-add", links, dest });
      if (r?.ok) {
        toast(`📥 ${r.count === 1 ? "Enviado 1 enlace" : `Enviados ${r.count} enlaces`} a Download Station${r.destination ? " · " + r.destination : ""}`);
        if (btn.classList.contains("hc-copy-btn")) { btn.textContent = "✔"; setTimeout(() => (btn.textContent = "📥"), 1500); }
      } else {
        toast("Download Station: " + (r?.error || "no se pudo enviar"), true);
      }
    } catch (e) {
      toast("Error al enviar a Download Station: " + e.message, true);
    } finally {
      setBusy(btn, false);
    }
  }

  function enhanceNas(g) {
    const ui = uiByGroup.get(g.id);
    if (!nasOn || !ui || nasDone.has(g.id)) return;
    nasDone.add(g.id);
    const hasChecks = g.rows.some((r) => document.getElementById(`elink_${g.id}_${r.i}`));
    const buttons = [];
    if (hasChecks) buttons.push(makeSiteButton("📥 Al NAS (seleccionados)", "Enviar los capítulos marcados a Download Station", (b) => sendToNas(g, b, "sel")));
    buttons.push(g.count === 1
      ? makeSiteButton("📥 Enviar al NAS", "Enviar a Download Station", (b) => sendToNas(g, b, "all"))
      : makeSiteButton("📥 Al NAS (todos)", "Enviar todos los enlaces de esta versión a Download Station", (b) => sendToNas(g, b, "all")));
    buttons.forEach((b) => b.classList.add("hc-nas"));
    ui.last.after(...buttons.flatMap((b) => [document.createTextNode(" "), b]));
    for (const { i } of g.rows) {
      const copy = ui.rows.get(i);
      if (!copy) continue;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "hc-copy-btn hc-nas-btn";
      b.title = "Enviar a Download Station";
      b.textContent = "📥";
      b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); sendToNas(g, b, i); });
      copy.after(b);
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
    findGroups().forEach((g) => { enhanceGroup(g); enhanceNas(g); });
    enhancePopup();
  }
  scan();
  // ¿Está configurado Download Station? Si lo está, se añaden los botones 📥
  try {
    api?.runtime?.sendMessage({ action: "ds-status" })?.then?.((r) => {
      if (r?.configured) { nasOn = true; scan(); }
    }, () => {});
  } catch (_) { /* sin segundo plano: nada que hacer */ }
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
