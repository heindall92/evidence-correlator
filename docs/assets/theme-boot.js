/* Aplica tema y preferencias antes del primer pintado (evita parpadeo). */
(function () {
  var p = {};
  try { p = JSON.parse(localStorage.getItem("prefs") || "{}"); } catch (e) { /* file:// o modo privado */ }
  var theme = p.theme || "system";
  if (theme === "system") theme = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  var d = document.documentElement;
  d.setAttribute("data-theme", theme);
  d.setAttribute("data-accent", p.accent || "blue");
  d.setAttribute("data-density", p.density || "comfortable");
})();
