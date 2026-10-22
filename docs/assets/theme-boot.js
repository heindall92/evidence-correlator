/* Aplica tema, acento, densidad, movimiento e idioma antes del primer pintado (sin parpadeo). */
(function () {
  var p = {};
  try { p = JSON.parse(localStorage.getItem("trama-prefs") || "{}") || {}; } catch (e) { /* file:// o modo privado */ }
  var d = document.documentElement;
  var theme = p.theme === "light" || p.theme === "dark" ? p.theme
    : (window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  var accents = ["azul", "rosa", "solar", "glaciar", "orquidea", "verde", "rojo"];
  d.setAttribute("data-theme", theme);
  d.setAttribute("data-accent", accents.indexOf(p.accent) >= 0 ? p.accent : "azul");
  d.setAttribute("data-density", p.density === "compact" ? "compact" : "comfortable");
  if (p.motion === "reduce") d.setAttribute("data-motion", "reduce");
  d.setAttribute("lang", p.lang === "en" ? "en" : "es");
})();
