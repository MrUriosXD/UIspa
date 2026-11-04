// Se ejecuta en document_start: activa el tema antes de que se pinte la web
// para evitar el "parpadeo" del diseño antiguo.
(() => {
  let off = false;
  try { off = localStorage.getItem("hcm-off") === "1"; } catch (_) {}
  if (off) return;
  document.documentElement.classList.add("hcm", "hcm-loading");
  // Red de seguridad: si el rediseño falla, se vuelve a mostrar la web original.
  setTimeout(() => {
    if (!document.getElementById("hcm-root")) document.documentElement.classList.remove("hcm", "hcm-loading");
  }, 5000);
})();
