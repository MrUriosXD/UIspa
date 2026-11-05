// Rediseño de Hispashare: reconstruye la página con un diseño limpio
// reutilizando los elementos originales (para que sigan funcionando
// votar, comentarios, popup de enlaces, búsqueda avanzada…).
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
  // Otra copia (sin esta protección) ya ha montado el rediseño
  if (document.getElementById("hcm-root")) return;
  const html = document.documentElement;

  // Botón para volver al diseño moderno cuando está desactivado
  if (!html.classList.contains("hcm")) {
    const b = document.createElement("button");
    b.id = "hcm-enable";
    b.textContent = "✨ Vista moderna";
    b.title = "Activar el diseño de UIspa";
    b.addEventListener("click", () => {
      try { localStorage.removeItem("hcm-off"); } catch (_) {}
      location.reload();
    });
    document.body.appendChild(b);
    return;
  }

  // ------------------------------------------------------------ utilidades
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k);
    return el;
  }
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const ratingOf = (el) => { const m = txt(el).match(/(\d+(?:[.,]\d+)?)\s*$/); return m ? m[1].replace(",", ".") : null; };
  const ratingClass = (r) => (r == null ? "" : r >= 7.5 ? "hcm-good" : r >= 6 ? "hcm-mid" : "hcm-low");

  // Párrafos INFO → { "Género": <p>, … } y el contenido sin la etiqueta
  function infoMap(root) {
    const map = {};
    $$("p.INFO", root).forEach((p) => {
      const s = $("strong", p);
      if (!s) return;
      map[txt(s).replace(/:$/, "")] = p;
    });
    return map;
  }
  function infoContent(p) {
    if (!p) return null;
    const c = p.cloneNode(true);
    c.querySelector("strong")?.remove();
    return c;
  }
  // "Series > Acción / Drama" → { type, links[] }
  function parseGenre(p) {
    if (!p) return { type: "", links: [] };
    const type = (p.textContent.match(/:\s*([^>]+?)\s*>/) || [])[1] || "";
    return { type, links: $$("a", p).map((a) => ({ href: a.getAttribute("href"), text: txt(a) })) };
  }
  const typeLabel = (t) => ({ "Películas": "Película", "Series": "Serie", "Documentales": "Documental", "Música": "Música" }[t] || t);

  // ------------------------------------------------------------ apariencia
  // Tema (oscuro / claro / automático), tamaño de carátulas y scroll infinito.
  // Se guardan en la extensión y una copia en localStorage para aplicarlos
  // antes de pintar (theme-early.js).
  const ext = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : null);
  const LOOK_DEFAULT = { theme: "dark", size: "m", infinite: true };
  let look = { ...LOOK_DEFAULT };
  try { look = { ...look, ...JSON.parse(localStorage.getItem("uispa-look") || "{}") }; } catch (_) {}
  const lightQuery = window.matchMedia ? matchMedia("(prefers-color-scheme: light)") : null;
  const lookListeners = [];
  function applyLook(next) {
    const prev = look;
    look = { ...LOOK_DEFAULT, ...next };
    const light = look.theme === "light" || (look.theme === "auto" && !!lightQuery?.matches);
    html.classList.toggle("hcm-light", light);
    html.dataset.hcmSize = look.size;
    try { localStorage.setItem("uispa-look", JSON.stringify(look)); } catch (_) {}
    lookListeners.forEach((fn) => fn(look, prev));
  }
  function saveLook(patch) {
    const next = { ...look, ...patch };
    applyLook(next);
    try { ext?.storage?.local.set({ look: next }); } catch (_) {}
  }
  applyLook(look);
  lightQuery?.addEventListener?.("change", () => look.theme === "auto" && applyLook(look));
  try {
    ext?.storage?.local.get("look").then?.((r) => { if (r?.look) applyLook(r.look); }, () => {});
    ext?.storage?.onChanged?.addListener((changes, area) => {
      if (area === "local" && changes.look?.newValue) applyLook(changes.look.newValue);
    });
  } catch (_) {}

  // ------------------------------------------------------------ estructura base
  const container = $(".CONTAINER");
  const center = $(".CENTER");
  if (!container || !center) { html.classList.remove("hcm", "hcm-loading"); return; }

  const root = h("div", { id: "hcm-root" });
  const main = h("main", { class: "hcm-main" });

  // ---------- barra superior
  function buildTopbar() {
    const menuLinks = $$(".LEFT .BLOCK_CONTAINER:first-child .CONTENT a").map((a) =>
      h("a", { href: a.getAttribute("href"), target: a.getAttribute("target") }, txt(a).replace(/^[^\wÁÉÍÓÚáéíóúÑñ]+/u, "")));

    // Desplegables de géneros
    const genreMenus = $$(".EXPAND > div[id^='EXP_']").map((d) => {
      const label = txt($("span", d));
      const list = $("ul", d)?.cloneNode(true);
      return h("div", { class: "hcm-dd" },
        h("button", { type: "button", class: "hcm-dd-btn" }, label, h("span", { class: "hcm-caret" }, "▾")),
        h("div", { class: "hcm-dd-menu hcm-cols" }, list));
    });

    // Lo + popular
    const popBlock = $$(".BLOCK_CONTAINER").find((b) => /popular/i.test(txt($(".TITLE", b))));
    let popular = null;
    if (popBlock) {
      const ul = h("ul", {}, $$(".CONTENT a", popBlock).map((a) => h("li", {}, h("a", { href: a.getAttribute("href"), title: a.title || txt(a) }, txt(a)))));
      popular = h("div", { class: "hcm-dd" },
        h("button", { type: "button", class: "hcm-dd-btn" }, "🔥 Popular", h("span", { class: "hcm-caret" }, "▾")),
        h("div", { class: "hcm-dd-menu hcm-cols" }, ul));
    }

    // Buscador
    const q = new URLSearchParams(location.search).get("q") || "";
    const search = h("form", {
      class: "hcm-search",
      onsubmit: (e) => {
        e.preventDefault();
        const v = e.target.q.value.trim();
        if (v) location.href = "/?view=advsearch&q=" + encodeURIComponent(v);
      }
    }, h("input", { type: "search", name: "q", placeholder: "Buscar películas, series…", value: q, autocomplete: "off" }));

    // Búsqueda avanzada (se mueve el bloque original para que siga funcionando)
    const adv = $("#BLOCK_SEARCH3");
    let advBtn = null, advPanel = null;
    if (adv) {
      advPanel = h("div", { class: "hcm-adv", hidden: true });
      adv.style.display = "block";
      advPanel.append(adv);
      advBtn = h("button", { type: "button", class: "hcm-icon-btn", title: "Búsqueda avanzada",
        onclick: () => (advPanel.hidden = !advPanel.hidden) }, "⚙");
    }

    // Cuenta
    const login = document.forms.form_login;
    const avatar = $(".LEFT .BLOCK_CONTAINER:nth-child(2) img")?.src;
    const user = login ? txt($(".SEPC", login)) : "";
    let account = null;
    if (user) {
      account = h("div", { class: "hcm-dd hcm-dd-right" },
        h("button", { type: "button", class: "hcm-dd-btn hcm-user" },
          avatar ? h("img", { src: avatar, alt: "" }) : null, h("span", { class: "hcm-user-name" }, user), h("span", { class: "hcm-caret" }, "▾")),
        h("div", { class: "hcm-dd-menu" },
          h("a", { href: "?view=profile" }, "Cambiar datos"),
          h("a", { href: "#", onclick: (e) => { e.preventDefault(); login.submit(); } }, "Cerrar sesión")));
    } else {
      // sin sesión: muestra el bloque original de acceso dentro de un desplegable
      const accBlock = $$(".LEFT .BLOCK_CONTAINER")[1];
      if (accBlock) {
        account = h("div", { class: "hcm-dd hcm-dd-right" },
          h("button", { type: "button", class: "hcm-dd-btn" }, "Entrar", h("span", { class: "hcm-caret" }, "▾")),
          h("div", { class: "hcm-dd-menu hcm-login" }, $(".CONTENT", accBlock)));
      }
    }

    const classic = lookMenu();

    const bar = h("header", { class: "hcm-top" },
      h("div", { class: "hcm-top-inner" },
        h("a", { class: "hcm-logo", href: "/" }, h("span", {}, "Hispa"), "Share"),
        h("nav", { class: "hcm-nav" }, genreMenus, popular, h("div", { class: "hcm-dd" },
          h("button", { type: "button", class: "hcm-dd-btn" }, "Más", h("span", { class: "hcm-caret" }, "▾")),
          h("div", { class: "hcm-dd-menu" }, menuLinks, openSettings()))),
        h("div", { class: "hcm-top-right" }, search, advBtn, account, classic)));
    return { bar, advPanel };
  }

  // Icono ◐ dibujado (el carácter no existe en todas las fuentes)
  function halfCircle() {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16"); svg.setAttribute("width", "16"); svg.setAttribute("height", "16");
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", "8"); c.setAttribute("cy", "8"); c.setAttribute("r", "6.5");
    c.setAttribute("fill", "none"); c.setAttribute("stroke", "currentColor"); c.setAttribute("stroke-width", "1.5");
    const half = document.createElementNS(NS, "path");
    half.setAttribute("d", "M8 1.5a6.5 6.5 0 0 1 0 13z"); half.setAttribute("fill", "currentColor");
    svg.append(c, half);
    return svg;
  }

  // Menú ◐ de la barra: tema, tamaño de carátulas, scroll infinito y diseño original
  function lookMenu() {
    const opt = (key, value, label) => h("button", { type: "button", class: "hcm-seg-btn", "data-key": key, "data-value": value,
      onclick: (e) => { e.stopPropagation(); saveLook({ [key]: value }); } }, label);
    const scroll = h("input", { type: "checkbox", onchange: (e) => saveLook({ infinite: e.target.checked }) });
    const menu = h("div", { class: "hcm-dd-menu hcm-look" },
      h("div", { class: "hcm-look-label" }, "Tema"),
      h("div", { class: "hcm-seg" }, opt("theme", "dark", "Oscuro"), opt("theme", "light", "Claro"), opt("theme", "auto", "Automático")),
      h("div", { class: "hcm-look-label" }, "Carátulas"),
      h("div", { class: "hcm-seg" }, opt("size", "s", "Pequeñas"), opt("size", "m", "Medianas"), opt("size", "l", "Grandes")),
      h("label", { class: "hcm-look-check", onclick: (e) => e.stopPropagation() }, scroll, " Cargar más títulos al bajar"),
      h("a", { href: "#", class: "hcm-look-classic", onclick: (e) => {
        e.preventDefault();
        try { localStorage.setItem("hcm-off", "1"); } catch (_) {}
        location.reload();
      } }, "Volver al diseño original"));
    const sync = () => {
      $$(".hcm-seg-btn", menu).forEach((b) => b.classList.toggle("hcm-on", look[b.dataset.key] === b.dataset.value));
      scroll.checked = !!look.infinite;
    };
    lookListeners.push(sync);
    sync();
    return h("div", { class: "hcm-dd hcm-dd-right" },
      h("button", { type: "button", class: "hcm-dd-btn hcm-look-btn", title: "Apariencia", "aria-label": "Apariencia" }, halfCircle()), menu);
  }

  // Enlace a los ajustes de la extensión (conexión con Plex)
  function openSettings() {
    const ext = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : null);
    if (!ext?.runtime?.sendMessage) return null;
    return h("a", { href: "#", class: "hcm-settings-link", onclick: (e) => {
      e.preventDefault();
      ext.runtime.sendMessage({ action: "open-options" });
    } }, "⚙ Ajustes de la extensión");
  }

  // Desplegables: abrir con clic, cerrar al hacer clic fuera
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".hcm-dd-btn");
    $$(".hcm-dd.hcm-open").forEach((d) => { if (!btn || d !== btn.parentElement) d.classList.remove("hcm-open"); });
    if (btn) btn.parentElement.classList.toggle("hcm-open");
  });

  // ------------------------------------------------------------ listado (portada, búsquedas)
  function buildList() {
    const rows = listRows(center);
    if (!rows.length) return false;
    const table = rows[0].closest("table");

    // Barra de ordenación (se mueve el formulario original)
    const sortForm = $("form[name='query_options']", table);
    const headTxt = sortForm ? "" : txt($("th", table));
    const toolbar = h("div", { class: "hcm-toolbar" },
      h("h1", { class: "hcm-page-title" }, pageTitle() || headTxt || "Novedades"),
      sortForm);

    const grid = h("div", { class: "hcm-grid" });
    rows.forEach((tr) => grid.append(card(tr)));

    // Paginación
    const pag = $(".PAGINATION", table);
    main.append(toolbar, grid);
    const pager = pag ? compactPagination(pag) : null;
    if (pager) main.append(pager);
    if (pag) infiniteScroll(grid, pag, pager);
    return true;
  }

  // Filas de un listado (portada, búsqueda…) dentro de un documento
  const listRows = (doc) => $$("tr", doc).filter((tr) => $("td.L1 a[href*='view=title'] img", tr) && $("td.R1 h1", tr));

  function card(tr) {
    const a = $("td.R1 h1 a", tr);
    const href = a.getAttribute("href");
    const smallTxt = txt($("small", a));
    const title = txt(a).replace(smallTxt, "").trim();
    const meta = smallTxt.replace(/^\(|\)$/g, "");
    const yearM = meta.match(/(\d{4})\s*$/);
    const year = yearM ? yearM[1] : "";
    const director = meta.replace(/,?\s*\d{4}\s*$/, "").trim();
    const rating = ratingOf($(".STARS_CONTAINER", tr));
    const info = infoMap(tr);
    const g = parseGenre(info["Género"]);
    const last = txt(infoContent(info["Última publicación"]));
    const isNew = /^hoy|^ayer/i.test(last);
    const img = $("td.L1 img", tr);

    return h("a", { class: "hcm-card", href, title: `${title}${year ? " (" + year + ")" : ""}` },
      h("div", { class: "hcm-poster" },
        h("img", { src: img.getAttribute("src"), alt: title, loading: "lazy" }),
        rating ? h("span", { class: "hcm-rating " + ratingClass(+rating) }, "★ " + rating) : null,
        isNew ? h("span", { class: "hcm-new" }, last.split(" ")[0]) : null),
      h("div", { class: "hcm-card-body" },
        h("h3", {}, title),
        h("div", { class: "hcm-meta" }, [typeLabel(g.type), year].filter(Boolean).join(" · ")),
        h("div", { class: "hcm-sub" }, g.links.map((l) => l.text).slice(0, 3).join(" · ") || director)));
  }

  // Scroll infinito: al llegar al final se pide la página siguiente y se
  // añaden sus títulos. La paginación se queda debajo por si se desactiva.
  function nextPageUrl(pag) {
    const cur = Number(txt($("span", pag))) || 1;
    const a = $$("a", pag).find((x) => Number((x.getAttribute("href").match(/page=(\d+)/) || [])[1]) === cur + 1);
    return a ? new URL(a.getAttribute("href"), location.href).href : null;
  }
  function infiniteScroll(grid, pag, pager) {
    let next = nextPageUrl(pag);
    let busy = false, page = Number(txt($("span", pag))) || 1;
    const seen = new Set($$(".hcm-card", grid).map((c) => c.getAttribute("href")));
    const status = h("div", { class: "hcm-more", role: "status" });
    const sentinel = h("div", { class: "hcm-sentinel" });
    grid.after(status, sentinel);
    const update = () => {
      const on = !!look.infinite && !!next;
      if (pager) pager.hidden = !!look.infinite && !!next;
      status.hidden = !look.infinite;
      if (!look.infinite) return;
      if (!next) status.textContent = page > 1 ? "No hay más títulos" : "";
      if (on) io.observe(sentinel); else io.unobserve(sentinel);
    };
    async function load() {
      if (busy || !next || !look.infinite) return;
      busy = true;
      status.textContent = "Cargando más títulos…";
      try {
        const res = await fetch(next, { credentials: "include" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const doc = new DOMParser().parseFromString(await res.text(), "text/html");
        const rows = listRows(doc);
        for (const tr of rows) {
          const c = card(tr);
          if (seen.has(c.getAttribute("href"))) continue;
          seen.add(c.getAttribute("href"));
          grid.append(c);
        }
        const p2 = $(".PAGINATION", doc);
        page++;
        next = rows.length && p2 ? nextPageUrl(p2) : null;
        status.textContent = next ? "" : "No hay más títulos";
      } catch (e) {
        status.textContent = "";
        status.append("No se pudieron cargar más títulos. ", h("a", { href: "#", onclick: (ev) => { ev.preventDefault(); load(); } }, "Reintentar"));
        busy = false;
        return;
      }
      busy = false;
      update();
      // si la página aún no llena la pantalla, se sigue cargando
      if (next && sentinel.getBoundingClientRect().top < innerHeight + 600) load();
    }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) load(); }, { rootMargin: "800px 0px" });
    lookListeners.push(update);
    update();
  }

  // Paginación compacta: ‹ 1 … 4 5 [6] 7 8 … 1460 › + "Ir a"
  function compactPagination(pag) {
    const links = $$("a", pag);
    const cur = Number(txt($("span", pag))) || 1;
    const tpl = links.map((a) => a.getAttribute("href")).find((u) => /page=\d+/.test(u));
    if (!tpl) { pag.classList.add("hcm-pagination"); return pag; }
    const nums = links.map((a) => Number((a.getAttribute("href").match(/page=(\d+)/) || [])[1])).filter(Boolean);
    const last = Math.max(cur, ...nums);
    const url = (n) => tpl.replace(/page=\d+/, "page=" + n);
    const out = h("nav", { class: "hcm-pagination" });
    if (cur > 1) out.append(h("a", { href: url(cur - 1), class: "hcm-pg-nav" }, "‹ Anterior"));
    const set = new Set([1, last]);
    for (let i = cur - 2; i <= cur + 2; i++) if (i >= 1 && i <= last) set.add(i);
    let prev = 0;
    [...set].sort((a, b) => a - b).forEach((n) => {
      if (n - prev > 1) out.append(h("em", {}, "…"));
      out.append(n === cur ? h("span", {}, String(n)) : h("a", { href: url(n) }, String(n)));
      prev = n;
    });
    if (cur < last) out.append(h("a", { href: url(cur + 1), class: "hcm-pg-nav" }, "Siguiente ›"));
    out.append(h("form", { class: "hcm-pg-go", onsubmit: (e) => {
      e.preventDefault();
      const n = Math.min(last, Math.max(1, parseInt(e.target.p.value, 10) || 0));
      if (n) location.href = url(n);
    } }, h("input", { name: "p", type: "number", min: 1, max: last, placeholder: "Ir a…", title: `Página (1-${last})` })));
    return out;
  }

  function pageTitle() {
    const p = new URLSearchParams(location.search);
    if (p.get("q")) return `Resultados para «${p.get("q")}»`;
    if (p.get("genre")) {
      const a = $(`.EXPAND a[href*="genre=${p.get("genre")}&"], .EXPAND a[href$="genre=${p.get("genre")}"]`);
      if (a) return txt(a.closest("div[id^='EXP_']")?.querySelector("span")) + " · " + txt(a);
    }
    if (p.get("director")) return "Director: " + p.get("director");
    if (p.get("actor")) return "Reparto: " + p.get("actor");
    if (!p.get("view")) return "Novedades";
    return "";
  }

  // ------------------------------------------------------------ ficha de título
  function buildTitle() {
    const cover = $("td.L2 > img", center);
    const r2 = $("td.R2", center);
    if (!cover || !r2) return false;
    const detailWin = cover.closest(".WIN1_CONTAINER");

    const h1 = $("h1", r2);
    const year = txt($("small", h1)).replace(/[()]/g, "");
    const title = txt(h1).replace(txt($("small", h1)), "").trim();
    const info = infoMap(r2);
    const g = parseGenre(info["Género"]);

    // Secciones "Etiqueta:" seguidas de un p.TEXT (Resumen, Reparto, Clasificación)
    const blocks = {};
    $$("p.INFO", r2).forEach((p) => {
      const label = txt($("strong", p)).replace(/:$/, "");
      if (txt(p).replace(/:$/, "") === label) {
        let n = p.nextElementSibling;
        if (n && n.matches("p.TEXT")) blocks[label] = n;
      }
    });

    // Puntuaciones
    const stars = $("#STARS_CONTAINER", r2);
    const scores = stars ? $$(".SEP", stars).map((s) => ({ label: txt($("small", s)).replace(/^Puntuación\s*/i, ""), value: ratingOf(s) })) : [];
    const votes = stars ? txt($$(":scope > small", stars).pop()) : "";
    const voteBtn = stars ? $("a.BUTTON", stars) : null;

    const extLinks = $$("td.L2 a", center).map((a) =>
      h("a", { class: "hcm-chip hcm-ext", href: a.href, target: "_blank", rel: "noopener" },
        /imdb/i.test(a.href) ? "IMDb ↗" : /filmaffinity/i.test(a.href) ? "FilmAffinity ↗" : txt(a)));

    const facts = [
      ["Título original", txt(infoContent(info["Título original"]))],
      ["Director", infoContent(info["Director"])],
      ["Duración", txt(infoContent(info["Duración"])).replace(/\.$/, "")]
    ].filter(([, v]) => v && (typeof v === "string" ? v : txt(v)));

    // Reparto: muestra los primeros y permite desplegar el resto
    let cast = null;
    if (blocks["Reparto"]) {
      const people = $$("a", blocks["Reparto"]).map((a) => h("a", { href: a.getAttribute("href") }, txt(a)));
      const MAX = 8;
      const list = h("div", { class: "hcm-cast" }, people.slice(0, MAX));
      if (people.length > MAX) {
        const more = h("button", { type: "button", class: "hcm-link-btn",
          onclick: () => { list.append(...people.slice(MAX)); more.remove(); } }, `+${people.length - MAX} más`);
        list.append(more);
      }
      cast = h("div", { class: "hcm-block" }, h("h4", {}, "Reparto"), list);
    }

    const ageImg = $("img[src*='mpa_']", r2);
    const age = ageImg ? h("img", { class: "hcm-age", src: ageImg.src, title: txt(blocks["Clasificación por edad"]) }) : null;

    const hero = h("section", { class: "hcm-hero" },
      h("div", { class: "hcm-hero-bg" }),
      h("div", { class: "hcm-hero-inner" },
        h("div", { class: "hcm-hero-cover" }, h("img", { src: cover.getAttribute("src"), alt: title })),
        h("div", { class: "hcm-hero-info" },
          h("div", { class: "hcm-eyebrow" }, [typeLabel(g.type), year].filter(Boolean).join(" · "), age),
          h("h1", { class: "hcm-title" }, title),
          h("div", { class: "hcm-scores" },
            scores.map((s) => h("div", { class: "hcm-score " + ratingClass(+s.value) },
              h("b", {}, s.value ?? "–"), h("span", {}, s.label))),
            votes ? h("span", { class: "hcm-votes" }, votes) : null,
            voteBtn),
          g.links.length ? h("div", { class: "hcm-chips" }, g.links.map((l) => h("a", { class: "hcm-chip", href: l.href }, l.text))) : null,
          facts.length ? h("dl", { class: "hcm-facts" }, facts.map(([k, v]) => [h("dt", {}, k), h("dd", {}, typeof v === "string" ? v : v.childNodes.length ? [...v.childNodes] : txt(v))])) : null,
          blocks["Resumen"] ? h("p", { class: "hcm-plot" }, txt(blocks["Resumen"])) : null,
          cast,
          extLinks.length ? h("div", { class: "hcm-chips" }, extLinks) : null)));
    hero.querySelector(".hcm-hero-bg").style.backgroundImage = `url("${cover.src}")`;

    main.append(hero);

    // Comentarios justo debajo de la ficha, como en la web original
    const comments = $("#COMMENTS_CONTAINER");
    if (comments) main.append(h("section", { class: "hcm-section hcm-comments" }, comments));

    // Descargas (elinks) y demás bloques: se mueven los originales
    const wins = $$(".WIN1_CONTAINER", center).filter((w) => w !== detailWin && !w.closest("#COMMENTS_CONTAINER"));
    wins.forEach((w) => {
      const th = txt($("th", w));
      const isLinks = /elinks/i.test(th);
      const sec = h("section", { class: "hcm-section" + (isLinks ? " hcm-elinks" : "") },
        h("h2", { class: "hcm-h2" }, isLinks ? "Descargas" : th));
      sec.append(w);
      main.append(sec);
      if (isLinks) {
        try { organiseVersions(sec, w); } catch (e) { console.error("[UIspa] versiones:", e); }
      }
    });

    // la ficha original se queda oculta (algunos scripts actualizan #STARS_CONTAINER)
    detailWin.classList.add("hcm-hidden");
    main.append(detailWin);
    document.title = `${title}${year ? " (" + year + ")" : ""} · HispaShare`;
    return true;
  }

  // ------------------------------------------------------------ versiones (ficha)
  // Cada versión (WEBRip 1080p, WEB-DL…) se muestra plegada con un resumen
  // (archivos, tamaño total, calidad, ripeador, fecha) y se abre al hacer
  // clic. En series con varias temporadas, pestañas para filtrar por temporada.
  const GiB = 1024 ** 3;
  function sizeBytes(t) {
    const m = (t || "").replace(/\s+/g, " ").match(/([\d.,]+)\s*([KMGT])B/i);
    if (!m) return 0;
    return parseFloat(m[1].replace(/\./g, "").replace(",", ".")) * 1024 ** { K: 1, M: 2, G: 3, T: 4 }[m[2].toUpperCase()];
  }
  const fmtSize = (b) => b >= 1024 * GiB ? (b / 1024 / GiB).toFixed(2).replace(".", ",") + " TB"
    : b >= GiB ? (b / GiB).toFixed(1).replace(".", ",") + " GB" : Math.round(b / 1024 ** 2) + " MB";
  const seasonOf = (name) => {
    const m = name.match(/\b(\d{1,2})x\d{1,3}\b/i) || name.match(/\bS(\d{1,2})\s*E\d{1,3}\b/i);
    return m ? Number(m[1]) : null;
  };
  // "Ripper: thad91" … dentro de la tabla T3 de la versión
  function versionFacts(td) {
    const facts = {};
    $$("table.T3 td", td).forEach((c) => {
      const label = txt($("strong", c)).replace(/:$/, "");
      if (label) facts[label] = txt(c).replace(/^[^:]*:\s*/, "");
    });
    return facts;
  }

  function organiseVersions(sec, win) {
    const versions = $$("table.T1 > tbody > tr, table.T1 > tr", win)
      .map((tr) => ({ tr, td: $(":scope > td", tr) }))
      .filter((v) => v.td && $(":scope > h2", v.td) && !$(":scope > .hcm-ver-head", v.td));
    if (!versions.length) return;

    for (const v of versions) {
      const files = $$("table.T2 tr", v.td).filter((r) => $("a[href*='Download(']", r));
      v.files = files.length;
      v.bytes = files.reduce((n, r) => n + sizeBytes(txt($("td.SIZE", r))), 0);
      const seasons = new Set(files.map((r) => seasonOf(txt($("a[href*='Download(']", r)))).filter((x) => x != null));
      if (!seasons.size) {
        const m = txt($(".INFOMSG", v.td)).match(/Temporada\s+(\d+)/i);
        if (m) seasons.add(Number(m[1]));
      }
      v.seasons = [...seasons];
      v.title = txt($(":scope > h2", v.td));
      v.facts = versionFacts(v.td);
    }

    // Solo se pliegan las versiones con varios archivos (series); las
    // películas, con un archivo por versión, se dejan como están.
    const foldable = versions.filter((v) => v.files > 1);
    if (foldable.length < 2 && versions.every((v) => v.files <= 1)) return;

    for (const v of foldable) {
      const h2 = $(":scope > h2", v.td);
      const body = h("div", { class: "hcm-ver-body" });
      while (h2.nextSibling) body.append(h2.nextSibling);
      const f = v.facts;
      const date = (f["eLink puesto"] || "").replace(/\s*\(.*\)\s*$/, "");
      const bits = [
        `${v.files} archivos`,
        v.bytes ? fmtSize(v.bytes) : null,
        f["Calidad"] || null,
        f["Ripper"] ? "por " + f["Ripper"] : null,
        date || null
      ].filter(Boolean);
      const head = h("button", { type: "button", class: "hcm-ver-head", "aria-expanded": "false" },
        h("span", { class: "hcm-ver-caret" }, "▸"),
        h("span", { class: "hcm-ver-main" },
          h("span", { class: "hcm-ver-title" }, v.title),
          h("span", { class: "hcm-ver-meta" }, bits.join(" · "))),
        h("span", { class: "hcm-ver-have" }));
      // el h2 original se queda (oculto): media.js lee de él la calidad de la versión
      h2.classList.add("hcm-hidden");
      h2.after(head);
      v.td.append(body);
      v.head = head;
      v.body = body;
      v.td.classList.add("hcm-ver");
      head.addEventListener("click", () => setOpen(v, !v.open, true));
    }
    function setOpen(v, open, byUser) {
      if (!v.head) return;
      v.open = open;
      if (byUser) v.touched = true;
      v.td.classList.toggle("hcm-ver-open", open);
      v.head.setAttribute("aria-expanded", String(open));
      v.head.querySelector(".hcm-ver-caret").textContent = open ? "▾" : "▸";
    }

    // Pestañas por temporada (si hay versiones de dos o más temporadas)
    const all = [...new Set(foldable.flatMap((v) => v.seasons))].sort((a, b) => a - b);
    let tabs = null, current = "all";
    const visible = (v) => current === "all" || !v.seasons.length || v.seasons.includes(current);
    function show(which) {
      current = which;
      for (const v of versions) v.tr.hidden = !visible(v);
      tabs?.querySelectorAll("button").forEach((b) => b.classList.toggle("hcm-on", String(current) === b.dataset.s));
      const shown = foldable.filter(visible);
      if (shown.length === 1 && !shown[0].touched) setOpen(shown[0], true);
    }
    if (all.length >= 2) {
      tabs = h("div", { class: "hcm-seasons", role: "tablist" },
        all.map((n) => h("button", { type: "button", "data-s": String(n), onclick: () => show(n) }, `Temporada ${n}`)),
        h("button", { type: "button", "data-s": "all", onclick: () => show("all") }, "Todas"));
      $(".hcm-h2", sec).after(tabs);
      show(all[0]);
    } else {
      show("all");
    }

    // Resumen de lo que tienes en Plex / Jellyfin (lo marca media.js)
    function haveSummary() {
      for (const v of foldable) {
        const rows = $$("table.T2 tr", v.body).filter((r) => $("a[href*='Download(']", r));
        const missing = rows.filter((r) => r.dataset.uispaMissing === "1").length;
        const box = v.head.querySelector(".hcm-ver-have");
        box.textContent = "";
        box.className = "hcm-ver-have";
        if (!missing) { box.textContent = "✓ Tienes todos"; box.classList.add("hcm-have-all"); }
        else if (missing === rows.length) { box.textContent = "No la tienes"; box.classList.add("hcm-have-none"); }
        else { box.textContent = `Te faltan ${missing}`; box.classList.add("hcm-have-some"); }
      }
      // en las pestañas, un punto si en esa temporada falta algo
      tabs?.querySelectorAll("button[data-s]").forEach((b) => {
        if (b.dataset.s === "all") return;
        const n = Number(b.dataset.s);
        const eps = foldable.filter((v) => v.seasons.includes(n));
        const anyMissing = eps.some((v) => $$("tr[data-uispa-missing='1']", v.body).length);
        b.classList.toggle("hcm-missing", !!anyMissing);
        b.title = anyMissing ? "Te faltan capítulos de esta temporada" : "";
      });
    }
    document.addEventListener("uispa-media", haveSummary);
    if (html.dataset.uispaMedia) haveSummary();
  }

  // ------------------------------------------------------------ montaje
  try {
    const { bar, advPanel } = buildTopbar();
    root.append(bar);
    if (advPanel) root.append(advPanel);

    const ok = buildTitle() || buildList();
    if (!ok) {
      // Otras páginas (noticias, perfil, búsqueda avanzada…): contenido original con estilo
      main.classList.add("hcm-generic");
      [...center.childNodes].forEach((n) => main.append(n));
    }
    root.append(main, h("footer", { class: "hcm-footer" }, "HispaShare · con UIspa"));
    document.body.append(root);
    html.classList.remove("hcm-loading");
  } catch (e) {
    console.error("[UIspa] Error en el rediseño:", e);
    html.classList.remove("hcm", "hcm-loading");
  }
})();
