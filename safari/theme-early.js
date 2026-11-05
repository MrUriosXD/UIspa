// Se ejecuta en document_start: activa el tema antes de que se pinte la web
// para evitar el "parpadeo" del diseño antiguo.
(() => {
  // Si hay otra copia de UIspa instalada (p. ej. una versión antigua), solo
  // trabaja la primera que llegó a la página; las demás se apartan.
  {
    const ext = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : null);
    const me = ext?.runtime?.id || "uispa";
    const owner = document.documentElement.dataset.uispaOwner;
    if (owner && owner !== me) return;
    document.documentElement.dataset.uispaOwner = me;
  }
  let off = false;
  try { off = localStorage.getItem("hcm-off") === "1"; } catch (_) {}
  if (off) return;
  document.documentElement.classList.add("hcm", "hcm-loading");
  // Red de seguridad: si el rediseño falla, se vuelve a mostrar la web original.
  setTimeout(() => {
    if (!document.getElementById("hcm-root")) document.documentElement.classList.remove("hcm", "hcm-loading");
  }, 5000);
})();
