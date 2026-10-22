/* TRAMA · consola local.
 * Todo dato que viene de un paquete se inserta con textContent (nunca innerHTML): un
 * paquete abierto por el usuario es una entrada no confiable. El único innerHTML es el
 * de los iconos Lucide vendorizados (marcado propio y fijo). */
(function () {
  "use strict";

  var NAME = "TRAMA";
  var ICONS = window.LUCIDE_ICONS || {};
  var SVGNS = "http://www.w3.org/2000/svg";
  var VIEWS = [
    { id: "inicio", icon: "house" },
    { id: "hilo", icon: "chart-no-axes-gantt" },
    { id: "incidentes", icon: "siren" },
    { id: "cumplimiento", icon: "scale" },
    { id: "custodia", icon: "link" },
    { id: "eventos", icon: "list" },
    { id: "entidades", icon: "network" }
  ];
  var MOBILE = ["inicio", "hilo", "incidentes", "custodia"];
  var LENSES = [
    { id: "pentest", icon: "crosshair" },
    { id: "red", icon: "swords" },
    { id: "blue", icon: "shield-half" },
    { id: "purple", icon: "blend" },
    { id: "grc", icon: "scale" }
  ];
  var ACCENTS = ["azul", "rosa", "solar", "glaciar", "orquidea", "verde", "rojo"];
  var FRAMEWORKS = [
    { key: "ens_rd_311_2022", label: "ENS · RD 311/2022", short: "ENS" },
    { key: "iso_27001_2022", label: "ISO/IEC 27001:2022", short: "ISO 27001" },
    { key: "nis2_directive", label: "NIS2", short: "NIS2" }
  ];
  /* Plazos del art. 23 de la Directiva (UE) 2022/2555 (NIS2), desde que se tiene conocimiento
   * del incidente significativo. El informe final es «a más tardar un mes» después de la
   * notificación; aquí se toma la notificación al vencer su plazo (72 h). */
  var NIS2 = { alertaH: 24, notificacionH: 72, finalMeses: 1 };
  /* En los datos de ejemplo el reloj se fija tantas horas después de la última detección,
   * para que los plazos no aparezcan vencidos. */
  var DEMO_CLOCK_H = 5;
  var ECO = [
    ["TRAMA", "eco.trama", null, "https://github.com/heindall92/evidence-correlator", true],
    ["CTEM-Nexus", "eco.ctem", "https://heindall92.github.io/ctem-nexus/", "https://github.com/heindall92/ctem-nexus"],
    ["Rosetta Multinorma", "eco.rosetta", "https://heindall92.github.io/rosetta_multinorma/", "https://github.com/heindall92/rosetta_multinorma"],
    ["ENS AD Auditor", "eco.adaud", "https://heindall92.github.io/ens_ad-auditor/", "https://github.com/heindall92/ens_ad-auditor"],
    ["ENS Compliance Studio", "eco.studio", "https://heindall92.github.io/grc_ens_compliance_studio/app/dist/ens-compliance-studio.html", "https://github.com/heindall92/grc_ens_compliance_studio"],
    ["KAIROS", "eco.kairos", "https://heindall92.github.io/kairos/dist/index.html", "https://github.com/heindall92/kairos"],
    ["ARGOS", "eco.argos", "https://heindall92.github.io/argos-grc/", "https://github.com/heindall92/argos-grc"],
    ["MCP-Shield", "eco.mcp", "https://heindall92.github.io/mcp-shield/", "https://github.com/heindall92/mcp-shield"],
    ["Astrolabio", "eco.astro", "https://heindall92.github.io/astrolabio/", "https://github.com/heindall92/astrolabio"],
    ["LemonByte", "eco.lemon", "https://heindall92.github.io/lemonbyte/", "https://github.com/heindall92/lemonbyte"],
    ["Norvik", "eco.norvik", null, "https://github.com/heindall92/Norvik_Gobernanza"]
  ];

  /* ---------------------------------------------------------------- utilidades */
  var DICT = window.TRAMA_I18N || { es: {}, en: {} };
  var root = document.documentElement;
  function lang() { return root.getAttribute("lang") === "en" ? "en" : "es"; }
  function t(key, vars) {
    var s = (DICT[lang()] || {})[key];
    if (s === undefined) s = DICT.es[key];
    if (s === undefined) return key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] === undefined ? "{" + k + "}" : String(vars[k]); });
    return s;
  }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function icon(name, cls) {
    var svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.9");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", "ico" + (cls ? " " + cls : ""));
    svg.innerHTML = ICONS[name] || "";
    return svg;
  }
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "text") el.textContent = v;
      else if (k === "class") el.className = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function hydrate(ctx) { $$("[data-icon]", ctx).forEach(function (el) { if (!el.firstChild) el.appendChild(icon(el.getAttribute("data-icon"))); }); }
  function svgEl(tag, attrs, text) {
    var e = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function ms(ts) { var n = Date.parse(ts); return isNaN(n) ? 0 : n; }
  function hhmmss(ts) { var m = /T(\d{2}:\d{2}:\d{2})/.exec(ts || ""); return m ? m[1] : String(ts || "—"); }
  function hhmm(ts) { var m = /T(\d{2}:\d{2})/.exec(ts || ""); return m ? m[1] : String(ts || "—"); }
  function fmtDate(msv) {
    try {
      return new Intl.DateTimeFormat(lang() === "en" ? "en-GB" : "es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(msv)) + " UTC";
    } catch (e) { return new Date(msv).toISOString().replace("T", " ").slice(0, 16) + " UTC"; }
  }
  function fmtDur(sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    var d = Math.floor(sec / 86400), hh = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    if (d) return d + " d " + hh + " h";
    if (hh) return hh + " h " + m + " min";
    if (m) return m + " min " + s + " s";
    return s + " s";
  }
  function short(hash, n) { hash = String(hash || ""); n = n || 10; return hash.length > n + 8 ? hash.slice(0, n) + "…" + hash.slice(-6) : hash; }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function initials(name) {
    var p = String(name || "").trim().split(/\s+/).filter(Boolean);
    return p.length ? (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() : "";
  }
  function uniq(arr) { var s = {}; return arr.filter(function (x) { if (!x || s[x]) return false; s[x] = 1; return true; }); }

  function toast(msg, ic) {
    var box = $("#toasts"), el = h("div", { class: "toast" }, icon(ic || "check"), msg);
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () { el.remove(); }, 3200);
  }
  function copyText(text, label) {
    function done() { toast(t("toast.copiado", { x: label || "" })); }
    function fallback() {
      var ta = h("textarea", { class: "sr-only", "aria-hidden": "true" });
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { toast(t("toast.noCopia"), "triangle-alert"); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }
  function copyBtn(text, label) {
    return h("button", { type: "button", class: "copy press", "aria-label": t("ui.copiar") + " " + label, title: t("ui.copiar"), onclick: function () { copyText(text, label); } }, icon("copy"));
  }
  function download(name, text, type) {
    var a = h("a", { href: URL.createObjectURL(new Blob([text], { type: type })), download: name });
    document.body.appendChild(a); a.click(); a.remove();
  }
  function csvCell(v) {
    v = String(v === null || v === undefined ? "" : v);
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; // inyección de fórmulas
    return '"' + v.replace(/"/g, '""') + '"';
  }
  function toCSV(rows) { return "﻿" + rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n"); }

  /* ---------------------------------------------------------------- preferencias y perfil */
  function load(key) { try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (e) { return {}; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  var prefs = load("trama-prefs");
  var profile = load("trama-perfil");
  if (!LENSES.some(function (l) { return l.id === profile.rol; })) profile.rol = "blue";
  function lens() { return profile.rol; }
  function lensDef(id) { return LENSES.filter(function (l) { return l.id === id; })[0] || LENSES[2]; }

  /* ---------------------------------------------------------------- estado y datos derivados */
  var state = { bundle: null, D: null, view: "inicio", incident: 0, framework: FRAMEWORKS[0].key, tampered: false, verify: null, src: "", q: "" };
  var ORIGINAL = window.EVIDENCE_BUNDLE;

  function validBundle(b) {
    return !!(b && typeof b === "object" && b.correlation_results && Array.isArray(b.correlation_results.incidents) &&
      Array.isArray(b.normalized_events) && b.forensic_custody_verification && typeof b.forensic_custody_verification === "object");
  }
  function derive(b) {
    var incs = b.correlation_results.incidents || [];
    var events = b.normalized_events.slice().sort(function (x, y) { return ms(x.timestamp_utc) - ms(y.timestamp_utc); });
    var findings = b.offensive_findings || [];
    var rules = b.rules || [];
    var exploited = {}, incOfEvent = {}, stages = [];
    incs.forEach(function (inc, i) {
      (inc.correlated_events || []).forEach(function (ev, k) {
        (incOfEvent[ev.event_id] = incOfEvent[ev.event_id] || []).push(i);
        var tech = (inc.mitre_attack || [])[Math.min(k, (inc.mitre_attack || []).length - 1)] || null;
        stages.push({ inc: i, k: k, ev: ev, tech: tech });
        (ev.offensive_exposures || []).forEach(function (x) {
          var list = exploited[x.finding_id] = exploited[x.finding_id] || [];
          if (!list.some(function (y) { return y.inc === i; })) list.push({ inc: i, k: k, ts: ev.timestamp_utc, ev: ev });
        });
      });
    });
    stages.sort(function (x, y) { return ms(x.ev.timestamp_utc) - ms(y.ev.timestamp_utc); });
    var ttd = incs.map(function (inc) {
      var first = (inc.correlated_events || [])[0];
      return first ? Math.max(0, (ms(inc.detected_at_utc) - ms(first.timestamp_utc)) / 1000) : 0;
    });
    var ruleTech = {}, obsTech = {};
    rules.forEach(function (r) { (r.mitre_attack || []).forEach(function (m) { if (m && m.technique_id) ruleTech[m.technique_id] = { m: m, rules: (ruleTech[m.technique_id] || { rules: [] }).rules.concat([r.id]) }; }); });
    incs.forEach(function (inc) { (inc.mitre_attack || []).forEach(function (m) { if (m && m.technique_id) obsTech[m.technique_id] = obsTech[m.technique_id] || m; }); });
    var linked = {};
    rules.forEach(function (r) { (r.posture_findings || []).forEach(function (f) { linked[f] = r.id; }); });
    var grc = b.grc_summary || {};
    var ioc = { ips: [], accounts: [], hosts: [], commands: [] };
    stages.forEach(function (s) {
      ioc.ips.push(s.ev.source_ip); ioc.accounts.push(s.ev.actor); ioc.hosts.push(s.ev.target_host);
      if (s.ev.command_line) ioc.commands.push(s.ev.command_line);
    });
    Object.keys(ioc).forEach(function (k) { ioc[k] = uniq(ioc[k].map(String)); });
    var lastDet = incs.reduce(function (m, inc) { return Math.max(m, ms(inc.detected_at_utc)); }, 0);
    var demo = b.dataset === "demo";
    return {
      incs: incs, events: events, findings: findings, rules: rules, exploited: exploited, incOfEvent: incOfEvent,
      stages: stages, ttd: ttd, ruleTech: ruleTech, obsTech: obsTech, linked: linked, grc: grc, ioc: ioc, demo: demo,
      now: demo && lastDet ? lastDet + DEMO_CLOCK_H * 3600e3 : Date.now(),
      chain: b.custody_chain || b.normalized_events.map(function (e) { return e.forensic_chain; }),
      nc: FRAMEWORKS.reduce(function (n, f) { return n + (grc[f.key] || []).length; }, 0),
      crit: incs.filter(function (i) { return i.severity === "CRITICAL"; }).length
    };
  }
  function sevLabel(s) { return t("sev." + s) === "sev." + s ? String(s || "") : t("sev." + s); }
  function sevTag(s) { return h("span", { class: "sev sev-" + s, text: sevLabel(s) }); }
  function verdictLabel(v) { var k = "verdict." + v; return t(k) === k ? String(v || "—") : t(k); }
  function verdictTag(v) { return v ? h("span", { class: "tag " + (/CRITICO|MAJOR/.test(String(v)) ? "bad" : "warn"), text: verdictLabel(v) }) : h("span", { class: "sub", text: "—" }); }

  /* ---------------------------------------------------------------- tema, acento, idioma */
  function setTheme(theme, animate) {
    if (animate && prefs.motion !== "reduce" && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      root.classList.add("theme-anim");
      clearTimeout(setTheme.tm);
      setTheme.tm = setTimeout(function () { root.classList.remove("theme-anim"); }, 420);
    }
    root.setAttribute("data-theme", theme);
    prefs.theme = theme; save("trama-prefs", prefs);
    $("#theme-btn").setAttribute("aria-checked", String(theme === "dark"));
  }
  function setAccent(a) {
    if (ACCENTS.indexOf(a) < 0) a = "azul";
    root.setAttribute("data-accent", a);
    prefs.accent = a; save("trama-prefs", prefs);
    $$(".swatch").forEach(function (s) { s.setAttribute("aria-checked", String(s.getAttribute("data-accent") === a)); });
  }
  function setLang(l) {
    root.setAttribute("lang", l === "en" ? "en" : "es");
    prefs.lang = lang(); save("trama-prefs", prefs);
    renderChrome(); render();
  }
  function swatches() {
    var cur = root.getAttribute("data-accent") || "azul";
    return h("div", { class: "swatches", role: "radiogroup", "aria-label": t("ui.acento") }, ACCENTS.map(function (a) {
      return h("button", { type: "button", role: "radio", class: "swatch press sw-" + a, "data-accent": a, "aria-checked": String(a === cur), "aria-label": t("acc." + a), title: t("acc." + a), onclick: function () { setAccent(a); } });
    }));
  }

  /* ---------------------------------------------------------------- shell */
  function renderChrome() {
    var D = state.D, b = state.bundle;
    $("#skip").textContent = t("ui.saltar");
    $("#brand-sub").textContent = t("ui.submarca");
    $("#side").setAttribute("aria-label", t("ui.navPrincipal"));
    $("#acc-label").textContent = t("ui.acento");
    var sw = swatches(); sw.id = "swatches"; $("#swatches").replaceWith(sw);
    var pkg = clear($("#pkg-btn"));
    pkg.appendChild(icon(b && b.imports ? "file-check" : "file-json"));
    pkg.appendChild(h("span", { class: "sr-only", text: t("ui.importar") + ": " }));
    pkg.appendChild(h("span", { class: "pkg-t" }, h("b", { text: b ? (state.fileName || (D.demo ? t("pkg.demo") : b.imports ? t("pkg.importado") : t("pkg.paquete"))) : t("pkg.ninguno") }),
      h("small", { text: b ? t("pkg.generado", { f: (b.generated_at_utc || "—").replace("T", " ").replace("Z", " UTC") }) : t("pkg.abrir") })));
    pkg.appendChild(icon("chevron-down", "chev"));
    var nav = $("#nav"); nav.setAttribute("aria-label", t("ui.secciones"));
    $$("a", nav).forEach(function (a) { a.remove(); });
    VIEWS.forEach(function (v, i) {
      var count = null;
      if (D && v.id === "incidentes") count = h("span", { class: "count" + (D.crit ? " hot" : ""), text: String(D.incs.length), "aria-label": t("nav.criticos", { n: D.crit }) });
      if (D && v.id === "cumplimiento") count = h("span", { class: "count", text: String(D.nc) });
      if (D && v.id === "eventos") count = h("span", { class: "count", text: String(D.events.length) });
      nav.appendChild(h("a", { href: "#" + v.id, class: "press", "data-view": v.id, title: t("view." + v.id) + " (" + (i + 1) + ")" }, icon(v.icon), h("span", { text: t("view." + v.id) }), count));
    });
    var acc = clear($("#account-btn"));
    acc.appendChild(h("span", { class: "sr-only", text: t("ui.perfil") + ": " }));
    acc.appendChild(profile.nombre ? h("span", { class: "avatar", "aria-hidden": "true", text: initials(profile.nombre) }) : h("span", { class: "avatar", "aria-hidden": "true" }, icon("user-round")));
    acc.appendChild(h("span", { class: "account-t" }, h("b", { text: profile.nombre || t("perfil.anonimo") }), h("small", { text: t("lens." + lens() + ".rol") })));
    acc.appendChild(icon("ellipsis", "more"));
    $("#collapse-btn").setAttribute("aria-label", t("ui.lateral"));
    $("#collapse-btn").setAttribute("aria-expanded", String(!$("#app").classList.contains("collapsed")));
    $("#chip-local-t").textContent = t("ui.local");
    $("#chip-local").setAttribute("title", t("ui.localTitle"));
    $("#search-btn-t").textContent = t("ui.buscar");
    $("#search-kbd").textContent = /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘K" : "Ctrl K";
    $("#lang-seg").setAttribute("aria-label", t("ui.idioma"));
    $$("#lang-seg button").forEach(function (x) { x.setAttribute("aria-pressed", String(x.getAttribute("data-lang") === lang())); });
    $("#theme-btn").setAttribute("aria-label", t("ui.temaOscuro"));
    $("#theme-btn").setAttribute("aria-checked", String(root.getAttribute("data-theme") === "dark"));
    $("#settings-btn").setAttribute("aria-label", t("ui.ajustes"));
    $("#help-btn").setAttribute("aria-label", t("ui.ayuda"));
    var bn = clear($("#bnav")); bn.setAttribute("aria-label", t("ui.secciones"));
    MOBILE.forEach(function (id) {
      var v = VIEWS.filter(function (x) { return x.id === id; })[0];
      bn.appendChild(h("a", { href: "#" + id, class: "press", "data-view": id, "aria-label": t("view." + id) }, icon(v.icon), h("span", { text: t("short." + id) })));
    });
    bn.appendChild(h("button", { type: "button", class: "press", id: "more-btn", "aria-haspopup": "dialog", onclick: function () { openMore(this); } }, icon("ellipsis"), h("span", { text: t("ui.mas") })));
    var foot = clear($("#foot"));
    foot.appendChild(h("span", { text: NAME + " " + version() + " · GPLv2 · Yoandy Ramírez Delgado" }));
    foot.appendChild(h("span", { text: t("foot.local") }));
    foot.appendChild(h("span", { text: t("foot.indep") }));
    markNav();
  }
  function version() { var g = (state.bundle && state.bundle.generator) || {}; return "v" + (g.version || (window.TRAMA_ENGINE ? TRAMA_ENGINE.VERSION : "0.3.0")); }
  function markNav() {
    $$("#nav a, #bnav a").forEach(function (a) {
      if (a.getAttribute("data-view") === state.view) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    var cur = $('#nav a[aria-current="page"]'), pill = $("#nav-pill");
    if (cur && pill) { pill.hidden = false; pill.style.transform = "translateY(" + cur.offsetTop + "px)"; } else if (pill) pill.hidden = true;
  }

  /* ---------------------------------------------------------------- vistas: utilidades */
  function vhead(kickerIcon, kicker, title, lede, actions) {
    return h("header", { class: "vhead" },
      h("div", null, h("div", { class: "kicker" }, icon(kickerIcon), kicker), h("h1", { text: title }), lede ? h("p", { class: "lede", text: lede }) : null),
      actions ? h("div", { class: "btn-row" }, actions) : null);
  }
  function card(title, sub, body, opts) {
    opts = opts || {};
    return h("section", { class: "card" + (opts.cls ? " " + opts.cls : ""), "aria-labelledby": opts.id || null },
      title ? h("div", { class: "card-h" }, h("div", null, h("h2", { id: opts.id || null, text: title }), sub ? h("p", { class: "sub", text: sub }) : null), opts.right || null) : null,
      body);
  }
  function kpis(items) {
    return h("dl", { class: "kpis stagger" }, items.map(function (k) {
      return h("div", { class: "card kpi" }, h("dt", null, icon(k.icon), k.label), h("dd", { class: k.cls || null }, String(k.value), k.small ? h("small", { text: k.small }) : null));
    }));
  }
  function goIncident(i) { state.incident = i; if (state.view === "incidentes") render(); else location.hash = "#incidentes"; }
  function incLink(i) {
    var inc = state.D.incs[i];
    return h("a", { href: "#incidentes", class: "mono", onclick: function (e) { e.preventDefault(); goIncident(i); }, text: inc.incident_id });
  }

  /* ---------------------------------------------------------------- Inicio por lente */
  function lensPicker() {
    var group = h("div", { class: "lenses", role: "radiogroup", "aria-label": t("lens.elige") }, LENSES.map(function (l) {
      return h("button", {
        type: "button", role: "radio", class: "lens-opt press", "data-lens": l.id, "aria-checked": String(l.id === lens()), tabindex: l.id === lens() ? "0" : "-1",
        onclick: function () { setLens(l.id); }
      }, icon(l.icon), h("b", { text: t("lens." + l.id + ".rol") }), h("small", { text: t("lens." + l.id + ".q") }));
    }));
    group.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var i = LENSES.map(function (l) { return l.id; }).indexOf(lens());
      setLens(LENSES[(i + d + LENSES.length) % LENSES.length].id);
      var b = $('.lens-opt[aria-checked="true"]'); if (b) b.focus();
    });
    return group;
  }
  function setLens(id) { profile.rol = id; save("trama-perfil", profile); renderChrome(); if (state.view === "inicio") render(); }

  function viewInicio() {
    var D = state.D, l = lens();
    var wrap = h("div", null);
    wrap.appendChild(vhead(lensDef(l).icon, t("lens.kicker", { rol: t("lens." + l + ".rol") }), t("lens." + l + ".h1"), t("lens." + l + ".lede"),
      [h("a", { href: "#hilo", class: "btn primary press" }, icon("chart-no-axes-gantt"), t("ui.verHilo"))]));
    wrap.appendChild(card(null, null, lensPicker(), { cls: "lens-card" }));
    wrap.appendChild(h("div", { class: "mt" }));
    var fn = { pentest: lensPentest, red: lensRed, blue: lensBlue, purple: lensPurple, grc: lensGrc }[l];
    wrap.appendChild(fn(D));
    return wrap;
  }

  function lensPentest(D) {
    var nExp = D.findings.filter(function (f) { return D.exploited[f.finding_id]; }).length;
    var sealed = uniq(D.stages.map(function (s) { return s.ev.event_id; })).length;
    var box = h("div", null, kpis([
      { icon: "crosshair", label: t("pt.k.hallazgos"), value: D.findings.length },
      { icon: "triangle-alert", label: t("pt.k.explotados"), value: nExp, cls: nExp ? "bad" : "ok" },
      { icon: "eye-off", label: t("pt.k.sinExplotar"), value: D.findings.length - nExp },
      { icon: "fingerprint", label: t("pt.k.sellados"), value: sealed }
    ]));
    var list = h("ul", { class: "list" }, D.findings.map(function (f) {
      var ex = D.exploited[f.finding_id] || [];
      return h("li", { class: "row-item" + (ex.length ? " bad" : "") }, icon(ex.length ? "triangle-alert" : "crosshair"),
        h("div", { class: "grow" }, h("b", { class: "mono", text: f.finding_id }), h("p", { class: "sub", text: f.description || "" }),
          h("p", { class: "sub", text: (f.source_tool || "") + " · " + (f.hostname || "") })),
        h("div", { class: "end" }, sevTag(f.severity),
          ex.length ? h("span", { class: "tag bad" }, t("pt.explotado")) : h("span", { class: "tag" }, t("pt.noObservado")),
          ex.map(function (x) { return h("span", { class: "sub" }, incLink(x.inc), " · " + hhmm(x.ts)); })));
    }));
    var evidence = h("ul", { class: "list" });
    D.incs.forEach(function (inc, i) {
      var fids = uniq((inc.correlated_events || []).reduce(function (a, ev) { return a.concat((ev.offensive_exposures || []).map(function (x) { return x.finding_id; })); }, []));
      if (!fids.length) return;
      var text = evidenceText(inc, fids);
      evidence.appendChild(h("li", { class: "row-item" }, icon("fingerprint"),
        h("div", { class: "grow" }, h("b", null, incLink(i), " · " + inc.title), h("p", { class: "sub", text: t("pt.demuestra", { f: fids.join(", ") }) }),
          h("div", { class: "hashline" }, h("span", { class: "hash", text: "Merkle " + short(inc.evidence_merkle_root_sha256, 16) }), copyBtn(inc.evidence_merkle_root_sha256, t("ui.merkle")))),
        h("div", { class: "end" }, h("button", { type: "button", class: "btn sm press", onclick: function () { copyText(text, t("pt.bloque")); } }, icon("copy"), t("pt.copiarBloque")))));
    });
    box.appendChild(h("div", { class: "grid g-main stagger" },
      card(t("pt.c1"), t("pt.c1s"), list),
      card(t("pt.c2"), t("pt.c2s"), evidence.children.length ? evidence : h("p", { class: "empty", text: t("pt.sinEvidencia") }))));
    return box;
  }
  function evidenceText(inc, fids) {
    var L = [t("pt.md.titulo", { id: inc.incident_id, t: inc.title }), ""];
    L.push(t("pt.md.hallazgos", { f: fids.join(", ") }));
    L.push(t("pt.md.regla", { r: inc.rule_id, c: Math.round((inc.confidence || 0) * 100) }));
    (inc.correlated_events || []).forEach(function (ev, k) {
      L.push("- " + t("pt.md.etapa", { n: k + 1, a: ev.action, ts: ev.timestamp_utc, src: ev.source_ip, dst: ev.target_host }));
      L.push("  SHA-256: " + ev.raw_log_sha256);
    });
    L.push(t("pt.md.merkle", { m: inc.evidence_merkle_root_sha256 }));
    L.push(t("pt.md.pie", { app: NAME }));
    return L.join("\n");
  }

  function lensRed(D) {
    var first = D.stages[0], last = D.stages[D.stages.length - 1];
    var dwell = first && last ? (ms(last.ev.timestamp_utc) - ms(first.ev.timestamp_utc)) / 1000 : 0;
    var minTtd = D.ttd.length ? Math.min.apply(null, D.ttd) : 0;
    var box = h("div", null, kpis([
      { icon: "route", label: t("rt.k.etapas"), value: D.stages.length },
      { icon: "hourglass", label: t("rt.k.permanencia"), value: fmtDur(dwell) },
      { icon: "radar", label: t("rt.k.deteccion"), value: fmtDur(minTtd), small: t("rt.k.min") },
      { icon: "target", label: t("rt.k.tecnicas"), value: Object.keys(D.obsTech).length }
    ]));
    var steps = h("ol", { class: "steps" });
    var detectedAfter = {};
    D.incs.forEach(function (inc, i) { var evs = inc.correlated_events || []; if (evs.length) detectedAfter[evs[evs.length - 1].event_id + "#" + i] = i; });
    D.stages.forEach(function (s, n) {
      steps.appendChild(h("li", null, h("span", { class: "knot", "aria-hidden": "true", text: String(n + 1) }),
        h("div", null, h("div", { class: "st-t", text: s.ev.action + " · " + s.ev.target_host }),
          h("div", { class: "st-m", text: hhmmss(s.ev.timestamp_utc) + " UTC · " + s.ev.actor + " ← " + s.ev.source_ip }),
          s.tech ? h("div", { class: "chips mt" }, h("span", { class: "chip" }, h("span", { class: "mono", text: s.tech.technique_id }), s.tech.tactic)) : null)));
      var key = s.ev.event_id + "#" + s.inc;
      if (detectedAfter[key] !== undefined) {
        var i = detectedAfter[key];
        steps.appendChild(h("li", null, h("span", { class: "knot fnd", "aria-hidden": "true" }, icon("radar")),
          h("div", null, h("div", { class: "st-t" }, t("rt.detectado"), " ", incLink(i)), h("div", { class: "st-m", text: t("rt.trasPrimero", { d: fmtDur(D.ttd[i]) }) }))));
      }
    });
    var max = Math.max.apply(null, D.ttd.concat([1]));
    var bars = h("ul", { class: "list" }, D.incs.map(function (inc, i) {
      return h("li", { class: "row-item" }, icon("timer"), h("div", { class: "grow" }, h("b", null, incLink(i)), h("p", { class: "sub", text: inc.title }),
        h("div", { class: "bar", "aria-hidden": "true" }, h("div", { class: "fill", "data-w": String(pct(D.ttd[i], max)) }))),
        h("div", { class: "end" }, h("span", { class: "num", text: fmtDur(D.ttd[i]) })));
    }));
    box.appendChild(h("div", { class: "grid g-main stagger" }, card(t("rt.c1"), t("rt.c1s"), steps), card(t("rt.c2"), t("rt.c2s"), bars)));
    return box;
  }

  function lensBlue(D) {
    var gaps = D.findings.filter(function (f) { return !D.exploited[f.finding_id]; });
    var avg = D.ttd.length ? D.ttd.reduce(function (a, b) { return a + b; }, 0) / D.ttd.length : 0;
    var nIoc = D.ioc.ips.length + D.ioc.accounts.length + D.ioc.hosts.length + D.ioc.commands.length;
    var box = h("div", null, kpis([
      { icon: "siren", label: t("bt.k.incidentes"), value: D.incs.length, small: t("bt.k.criticos", { n: D.crit }) },
      { icon: "timer", label: t("bt.k.ttd"), value: fmtDur(avg) },
      { icon: "eye-off", label: t("bt.k.huecos"), value: gaps.length, cls: gaps.length ? "bad" : "ok" },
      { icon: "fingerprint", label: t("bt.k.ioc"), value: nIoc }
    ]));
    var gapBody = gaps.length ? h("ul", { class: "list" }, gaps.map(function (f) {
      return h("li", { class: "row-item bad" }, icon("eye-off"), h("div", { class: "grow" }, h("b", { class: "mono", text: f.finding_id }), h("p", { class: "sub", text: f.description || "" }), h("p", { class: "sub", text: t("bt.hueco") })), h("div", { class: "end" }, sevTag(f.severity)));
    })) : h("div", { class: "note" }, icon("shield-check"), t("bt.sinHuecos", { n: D.findings.length }));
    var groups = [["ips", "globe"], ["accounts", "user"], ["hosts", "server"], ["commands", "terminal"]];
    var iocBody = h("div", { class: "grid" }, groups.map(function (g) {
      var vals = D.ioc[g[0]];
      if (!vals.length) return null;
      return h("div", null, h("div", { class: "label", text: t("bt.ioc." + g[0]) }),
        h("ul", { class: "list mt" }, vals.map(function (v) { return h("li", { class: "row-item" }, icon(g[1]), h("div", { class: "grow" }, h("span", { class: "hash", text: v })), copyBtn(v, v)); })));
    }));
    var actions = h("div", { class: "btn-row" },
      h("button", { type: "button", class: "btn sm press", onclick: function () { copyText(iocLines(D), "IOC"); } }, icon("copy"), t("bt.copiarIoc")),
      h("button", { type: "button", class: "btn sm press", onclick: function () { download("trama-ioc.csv", iocCSV(D), "text/csv"); toast(t("toast.exportado")); } }, icon("file-spreadsheet"), t("bt.csvIoc")));
    var det = h("ul", { class: "list" }, D.incs.map(function (inc, i) {
      return h("li", { class: "row-item" }, icon("siren"), h("div", { class: "grow" }, h("b", null, incLink(i)), h("p", { class: "sub", text: inc.title })), h("div", { class: "end" }, sevTag(inc.severity), h("span", { class: "sub num", text: t("bt.ttd", { d: fmtDur(D.ttd[i]) }) })));
    }));
    box.appendChild(h("div", { class: "grid g-main stagger" },
      h("div", { class: "grid" }, card(t("bt.c1"), t("bt.c1s"), gapBody), card(t("bt.c3"), t("bt.c3s"), det)),
      card(t("bt.c2"), t("bt.c2s"), [iocBody, h("div", { class: "mt" }, actions)])));
    return box;
  }
  function iocLines(D) {
    var out = [];
    ["ips", "accounts", "hosts", "commands"].forEach(function (k) { D.ioc[k].forEach(function (v) { out.push(k + "\t" + v); }); });
    return out.join("\n");
  }
  function iocCSV(D) {
    var rows = [["tipo", "valor", "incidentes"]];
    ["ips", "accounts", "hosts", "commands"].forEach(function (k) {
      D.ioc[k].forEach(function (v) {
        var incs = uniq(D.stages.filter(function (s) { return String({ ips: s.ev.source_ip, accounts: s.ev.actor, hosts: s.ev.target_host, commands: s.ev.command_line }[k]) === v; }).map(function (s) { return D.incs[s.inc].incident_id; }));
        rows.push([k, v, incs.join(" ")]);
      });
    });
    return toCSV(rows);
  }

  function lensPurple(D) {
    var ruleIds = Object.keys(D.ruleTech), obsIds = Object.keys(D.obsTech);
    var all = uniq(ruleIds.concat(obsIds)).sort();
    var covered = ruleIds.filter(function (id) { return D.obsTech[id]; }).length;
    var unlinked = D.findings.filter(function (f) { return !D.linked[f.finding_id]; });
    var box = h("div", null, kpis([
      { icon: "list-checks", label: t("pp.k.conRegla"), value: ruleIds.length },
      { icon: "radar", label: t("pp.k.observadas"), value: obsIds.length },
      { icon: "gauge", label: t("pp.k.cobertura"), value: pct(covered, ruleIds.length) + " %" },
      { icon: "unlink", label: t("pp.k.sinRegla"), value: unlinked.length, cls: unlinked.length ? "bad" : "ok" }
    ]));
    var cov = h("div", { class: "cov" }, all.map(function (id) {
      var m = (D.obsTech[id] || (D.ruleTech[id] || {}).m || {}), obs = !!D.obsTech[id], rule = !!D.ruleTech[id];
      return h("div", { class: "cov-row" }, h("span", { class: "mono", text: id }), h("span", null, m.technique_name || "", h("span", { class: "sub", text: " · " + (m.tactic || "") })),
        obs ? h("span", { class: "tag ok" }, icon("check"), t("pp.detectada")) : rule ? h("span", { class: "tag warn", text: t("pp.sinEjercitar") }) : h("span", { class: "tag bad", text: t("pp.sinReglaT") }));
    }));
    var un = unlinked.length ? h("ul", { class: "list" }, unlinked.map(function (f) {
      return h("li", { class: "row-item" }, icon("unlink"), h("div", { class: "grow" }, h("b", { class: "mono", text: f.finding_id }), h("p", { class: "sub", text: f.description || "" }),
        h("p", { class: "sub", text: t("pp.sugerencia", { f: f.finding_id }) })), h("div", { class: "end" }, sevTag(f.severity)));
    })) : h("div", { class: "note" }, icon("check"), t("pp.todoVinculado"));
    var notEx = ruleIds.filter(function (id) { return !D.obsTech[id]; });
    var next = notEx.length ? t("pp.next.tecnica", { id: notEx[0], r: D.ruleTech[notEx[0]].rules.join(", ") })
      : unlinked.length ? t("pp.next.hallazgo", { f: unlinked[0].finding_id, host: unlinked[0].hostname || "—" })
        : t("pp.next.ok");
    box.appendChild(h("div", { class: "grid g-main stagger" },
      card(t("pp.c1"), t("pp.c1s"), cov),
      h("div", { class: "grid" }, card(t("pp.c2"), t("pp.c2s"), un), card(t("pp.c3"), null, h("div", { class: "note" }, icon("flask-conical"), next)))));
    return box;
  }

  function nis2For(inc, D) {
    var det = ms(inc.detected_at_utc);
    var notif = det + NIS2.notificacionH * 3600e3;
    var fin = new Date(notif); fin.setUTCMonth(fin.getUTCMonth() + NIS2.finalMeses);
    return [
      { k: "alerta", at: det + NIS2.alertaH * 3600e3 },
      { k: "notificacion", at: notif },
      { k: "final", at: fin.getTime() }
    ].map(function (x) { x.left = (x.at - D.now) / 1000; return x; });
  }
  function nis2Card(D) {
    var crit = D.incs.map(function (inc, i) { return i; }).sort(function (a, b) { return ms(D.incs[a].detected_at_utc) - ms(D.incs[b].detected_at_utc); });
    if (!crit.length) return card(t("grc.c1"), null, h("p", { class: "empty", text: t("grc.sinIncidentes") }));
    var i = crit[0], inc = D.incs[i], dl = nis2For(inc, D), det = ms(inc.detected_at_utc);
    // Pista por tramos iguales: detección → 24 h → 72 h → informe final (escala no lineal, rotulada).
    var pts = [det].concat(dl.map(function (x) { return x.at; }));
    var pos = function (v) {
      for (var s = 0; s < pts.length - 1; s++) if (v <= pts[s + 1]) return (s + Math.max(0, (v - pts[s]) / (pts[s + 1] - pts[s]))) / (pts.length - 1) * 100;
      return 100;
    };
    var nowP = Math.min(100, Math.max(0, pos(D.now)));
    var track = h("div", { class: "track", role: "img", "aria-label": t("grc.trackAria", { id: inc.incident_id }) },
      h("div", { class: "fill", "data-w": String(nowP) }),
      h("span", { class: "now", "data-l": String(nowP), text: t("grc.ahora") }),
      pts.map(function (v, n) {
        var p = n / (pts.length - 1) * 100;
        return [h("span", { class: "mk" + (n > 0 && dl[n - 1].left < 0 ? " past" : ""), "data-l": String(p) }),
          h("span", { class: "mk-l", "data-l": String(p), text: n === 0 ? t("grc.det") : t("grc.mk." + dl[n - 1].k) })];
      }));
    var cards = h("div", { class: "deadlines" }, dl.map(function (x) {
      return h("div", { class: "deadline" }, h("b", { text: t("grc.dl." + x.k) }), h("div", { class: "when", text: fmtDate(x.at) }),
        x.left < 0 ? h("span", { class: "tag bad" }, icon("bell-ring"), t("grc.vencido", { d: fmtDur(-x.left) })) : h("span", { class: "tag " + (x.left < 6 * 3600 ? "warn" : "ok") }, icon("hourglass"), t("grc.quedan", { d: fmtDur(x.left) })));
    }));
    return card(t("grc.c1"), t("grc.c1s", { id: inc.incident_id }), [track, cards,
      h("div", { class: "note mt" }, icon("info"), D.demo ? t("grc.demoClock", { h: DEMO_CLOCK_H }) : t("grc.realClock")),
      h("p", { class: "sub mt", text: t("grc.base") })], { id: "nis2-h" });
  }
  function lensGrc(D) {
    var critNc = FRAMEWORKS.reduce(function (n, f) { return n + (D.grc[f.key] || []).filter(function (c) { return /CRITICO|MAJOR/.test(String(c.audit_verdict)); }).length; }, 0);
    var nextDl = null;
    D.incs.forEach(function (inc) { nis2For(inc, D).forEach(function (x) { if (x.left >= 0 && (!nextDl || x.left < nextDl.left)) nextDl = x; }); });
    var box = h("div", null, kpis([
      { icon: "scale", label: t("grc.k.nc"), value: D.nc },
      { icon: "triangle-alert", label: t("grc.k.graves"), value: critNc, cls: critNc ? "bad" : "ok" },
      { icon: "layers", label: t("grc.k.marcos"), value: FRAMEWORKS.filter(function (f) { return (D.grc[f.key] || []).length; }).length },
      { icon: "calendar-clock", label: t("grc.k.plazo"), value: nextDl ? fmtDur(nextDl.left) : "—", small: nextDl ? t("grc.mk." + nextDl.k) : null }
    ]));
    var fw = h("ul", { class: "list" }, FRAMEWORKS.map(function (f) {
      var list = D.grc[f.key] || [];
      return h("li", { class: "row-item" }, icon("clipboard-check"), h("div", { class: "grow" }, h("b", { text: f.label }), h("p", { class: "sub", text: list.map(function (c) { return c.control_id || c.article; }).join(" · ") })),
        h("div", { class: "end" }, h("span", { class: "num", text: String(list.length) })));
    }));
    var cust = state.bundle.forensic_custody_verification;
    var proof = h("div", { class: "grid" },
      h("div", { class: "note" }, icon(cust.valid ? "shield-check" : "triangle-alert"), cust.valid ? t("grc.custOk", { n: cust.total_sealed_events }) : t("grc.custBad")),
      h("div", { class: "hashline" }, h("span", { class: "hash", text: "Merkle " + short(cust.merkle_root_sha256, 18) }), copyBtn(cust.merkle_root_sha256, t("ui.merkle"))),
      h("div", { class: "btn-row" }, h("a", { href: "#custodia", class: "btn sm press" }, icon("shield-check"), t("grc.verificar")), h("a", { href: "#cumplimiento", class: "btn sm press" }, icon("scale"), t("grc.verNc"))));
    box.appendChild(h("div", { class: "grid g-main stagger" }, nis2Card(D), h("div", { class: "grid" }, card(t("grc.c2"), t("grc.c2s"), fw), card(t("grc.c3"), t("grc.c3s"), proof))));
    return box;
  }

  /* ---------------------------------------------------------------- El Hilo */
  function viewHilo() {
    var D = state.D;
    var wrap = h("div", null, vhead("chart-no-axes-gantt", t("hilo.kicker"), t("hilo.h1"), t("hilo.lede")));
    if (!D.incs.length) { wrap.appendChild(card(null, null, h("p", { class: "empty", text: t("inc.ninguno") }))); return wrap; }
    var pick = h("div", { class: "inc-pick", role: "group", "aria-label": t("hilo.elige") }, D.incs.map(function (inc, i) {
      return h("button", { type: "button", class: "press", "aria-pressed": String(i === state.incident), onclick: function () { state.incident = i; render(); } },
        sevTag(inc.severity), h("span", { class: "mono", text: inc.incident_id }));
    }));
    var svgBox = h("div", { class: "hilo-wrap", tabindex: "0", role: "region", "aria-label": t("hilo.region") });
    svgBox.appendChild(drawHilo(D, state.incident));
    var inc = D.incs[state.incident];
    wrap.appendChild(card(t("hilo.c1"), t("hilo.c1s"), [pick, svgBox, h("p", { class: "sub mt", text: t("hilo.escala") })]));
    wrap.appendChild(h("div", { class: "grid g2 mt stagger" }, card(t("hilo.c2", { id: inc.incident_id }), inc.title, threadSteps(D, state.incident)),
      card(t("hilo.c3"), t("hilo.c3s"), h("ul", { class: "list" }, D.events.map(function (e) {
        var ii = D.incOfEvent[e.event_id] || [];
        return h("li", { class: "row-item" }, icon(ii.length ? "link-2" : "activity"), h("div", { class: "grow" }, h("b", { text: hhmmss(e.timestamp_utc) + " · " + e.event.action }), h("p", { class: "sub", text: (e.forensic_chain || {}).source_type + " · " + e.target.hostname })),
          h("div", { class: "end" }, ii.map(function (i) { return incLink(i); })));
      })))));
    return wrap;
  }
  function threadSteps(D, i) {
    var inc = D.incs[i], ol = h("ol", { class: "steps", "aria-label": t("hilo.pasos") });
    var fids = uniq((inc.correlated_events || []).reduce(function (a, ev) { return a.concat((ev.offensive_exposures || []).map(function (x) { return x.finding_id; })); }, []));
    fids.forEach(function (fid) {
      var f = D.findings.filter(function (x) { return x.finding_id === fid; })[0] || {};
      ol.appendChild(h("li", null, h("span", { class: "knot fnd", "aria-hidden": "true" }, icon("crosshair")), h("div", null, h("div", { class: "st-t" }, t("hilo.hallazgo"), " ", h("span", { class: "mono", text: fid })), h("div", { class: "st-m", text: f.description || "" }))));
    });
    (inc.correlated_events || []).forEach(function (ev, k) {
      ol.appendChild(h("li", null, h("span", { class: "knot", "aria-hidden": "true", text: String(k + 1) }), h("div", null, h("div", { class: "st-t", text: ev.action + " · " + ev.target_host }), h("div", { class: "st-m", text: hhmmss(ev.timestamp_utc) + " UTC · " + ev.actor + " ← " + ev.source_ip }))));
    });
    var ctrls = controlsOf(inc);
    ol.appendChild(h("li", null, h("span", { class: "knot ctl", "aria-hidden": "true" }, icon("scale")), h("div", null, h("div", { class: "st-t", text: t("hilo.incumple") }), h("div", { class: "chips mt" }, ctrls.map(function (c) { return h("span", { class: "chip" }, h("span", { class: "mono", text: c.fw }), c.id); })))));
    return ol;
  }
  function controlsOf(inc) {
    var out = [];
    FRAMEWORKS.forEach(function (f) { ((inc.grc_compliance_mapping || {})[f.key] || []).forEach(function (c) { out.push({ fw: f.short, code: f.short.split(" ")[0], id: c.control_id || c.article }); }); });
    return out;
  }
  function drawHilo(D, sel) {
    var avail = Math.max(760, (($("#main") || {}).clientWidth || 1000) - 110);
    var N = D.events.length, left = 132, colW = Math.max(132, (avail - left - 24) / Math.max(1, N)), W = Math.max(760, left + N * colW + 24);
    var Y = { off: 70, det: 196, grc: 300 }, chipH = 22, chipGap = 6;
    var maxCtl = D.incs.reduce(function (m, inc) { return Math.max(m, controlsOf(inc).length); }, 0);
    var H = Y.grc + maxCtl * (chipH + chipGap) + 26;
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, width: String(W), height: String(H), class: "hilo", role: "img", "aria-label": t("hilo.aria", { n: D.incs.length, e: N, f: D.findings.length }) });
    var lanes = [["off", Y.off - 44, 88], ["det", Y.det - 48, 96], ["grc", Y.grc - 30, H - (Y.grc - 30) - 6]];
    lanes.forEach(function (l) {
      svg.appendChild(svgEl("rect", { x: "0", y: String(l[1]), width: String(W), height: String(l[2]), rx: "14", class: "lane-bg" }));
      svg.appendChild(svgEl("text", { x: "16", y: String(l[1] + 20), class: "lane-t" }, t("hilo.lane." + l[0]).toUpperCase()));
    });
    var colX = {}; D.events.forEach(function (e, n) { colX[e.event_id] = left + n * colW + colW / 2; });
    D.events.forEach(function (e) {
      var x = colX[e.event_id];
      // Guías verticales por encima y por debajo de las etiquetas, sin tacharlas.
      svg.appendChild(svgEl("line", { x1: String(x), x2: String(x), y1: String(Y.off - 30), y2: String(Y.det - 30), class: "tick-l" }));
      svg.appendChild(svgEl("line", { x1: String(x), x2: String(x), y1: String(Y.det + 46), y2: String(H - 10), class: "tick-l" }));
      svg.appendChild(svgEl("text", { x: String(x), y: String(Y.det + 36), "text-anchor": "middle", class: "tick" }, hhmm(e.timestamp_utc)));
    });
    var fPos = {}, stackLeft = 0;
    D.findings.forEach(function (f) {
      var ex = D.exploited[f.finding_id];
      var x = ex && ex.length ? colX[ex.map(function (x2) { return x2.ev.event_id; }).sort(function (a, b) { return colX[a] - colX[b]; })[0]] : 70;
      fPos[f.finding_id] = { x: x, y: Y.off - 6 + (ex && ex.length ? 0 : 26 * stackLeft++) };
    });
    // Desplaza los hallazgos que caen en la misma columna.
    var byX = {};
    Object.keys(fPos).forEach(function (fid) { var k = Math.round(fPos[fid].x); (byX[k] = byX[k] || []).push(fid); });
    Object.keys(byX).forEach(function (k) { var l = byX[k]; if (l.length > 1) l.forEach(function (fid, n) { fPos[fid].x += (n - (l.length - 1) / 2) * 58; }); });
    var cPos = {};
    D.incs.forEach(function (inc, i) {
      var evs = inc.correlated_events || [], last = evs[evs.length - 1];
      var x = last ? colX[last.event_id] : left;
      controlsOf(inc).forEach(function (c, n) { cPos[i + ":" + n] = { x: x, y: Y.grc + n * (chipH + chipGap), c: c }; });
    });
    function curve(a, b) { var my = (a.y + b.y) / 2; return "M" + a.x + " " + a.y + " C" + a.x + " " + my + " " + b.x + " " + my + " " + b.x + " " + b.y; }
    function hcurve(a, b) { var mx = (a.x + b.x) / 2; return "M" + a.x + " " + a.y + " C" + mx + " " + a.y + " " + mx + " " + b.y + " " + b.x + " " + b.y; }
    var threads = svgEl("g", {}), selThreads = svgEl("g", {});
    D.incs.forEach(function (inc, i) {
      var evs = inc.correlated_events || [], on = i === sel, g = on ? selThreads : threads, segs = [];
      var fids = uniq(evs.reduce(function (a, ev) { return a.concat((ev.offensive_exposures || []).map(function (x) { return x.finding_id; })); }, []));
      var p0 = evs[0] ? { x: colX[evs[0].event_id], y: Y.det } : null;
      fids.forEach(function (fid) { if (fPos[fid] && p0) segs.push(curve({ x: fPos[fid].x, y: fPos[fid].y + 11 }, { x: p0.x, y: p0.y - 7 })); });
      for (var k = 1; k < evs.length; k++) segs.push(hcurve({ x: colX[evs[k - 1].event_id] + 7, y: Y.det }, { x: colX[evs[k].event_id] - 7, y: Y.det }));
      var lastP = evs.length ? { x: colX[evs[evs.length - 1].event_id], y: Y.det + 7 } : null;
      controlsOf(inc).forEach(function (c, n) { var p = cPos[i + ":" + n]; if (lastP) segs.push(curve(lastP, { x: p.x - 46, y: p.y + chipH / 2 })); });
      segs.forEach(function (d) {
        var path = svgEl("path", { d: d, class: "thread" + (on ? " on" : "") });
        g.appendChild(path);
      });
    });
    svg.appendChild(threads); svg.appendChild(selThreads);
    var selInc = D.incs[sel] || { correlated_events: [] };
    var selEv = {}; selInc.correlated_events.forEach(function (e) { selEv[e.event_id] = 1; });
    var selF = {}; selInc.correlated_events.forEach(function (e) { (e.offensive_exposures || []).forEach(function (x) { selF[x.finding_id] = 1; }); });
    D.events.forEach(function (e) {
      var x = colX[e.event_id], on = !!selEv[e.event_id];
      svg.appendChild(svgEl("circle", { cx: String(x), cy: String(Y.det), r: on ? "7" : "6", class: "ev" + (on ? " on" : "") }));
      var label = String(e.event.action || "");
      if (label.length > 18) label = label.slice(0, 17) + "…";
      svg.appendChild(svgEl("text", { x: String(x), y: String(Y.det - 16), "text-anchor": "middle", class: "ev-t" + (on ? " on" : "") }, label));
    });
    D.findings.forEach(function (f) {
      var p = fPos[f.finding_id], wdt = Math.min(140, 16 + String(f.finding_id).length * 6.9), on = !!selF[f.finding_id];
      var g = svgEl("g", { class: "node fnd" + (on ? " on" : ""), transform: "translate(" + (p.x - wdt / 2) + "," + (p.y - 11) + ")" });
      g.appendChild(svgEl("rect", { width: String(wdt), height: "22", rx: "7" }));
      g.appendChild(svgEl("text", { x: String(wdt / 2), y: "15", "text-anchor": "middle" }, f.finding_id));
      svg.appendChild(g);
    });
    Object.keys(cPos).forEach(function (key) {
      var p = cPos[key], on = key.split(":")[0] === String(sel), full = p.c.fw + " " + p.c.id, label = p.c.code + " " + p.c.id;
      if (label.length > 17) label = label.slice(0, 16) + "…";
      var g = svgEl("g", { class: "node" + (on ? " on" : ""), transform: "translate(" + (p.x - 46) + "," + p.y + ")" });
      g.appendChild(svgEl("title", {}, full));
      g.appendChild(svgEl("rect", { width: "124", height: String(chipH), rx: "6" }));
      g.appendChild(svgEl("text", { x: "8", y: "15" }, label));
      svg.appendChild(g);
    });
    requestAnimationFrame(function () { $$(".thread.on", svg).forEach(function (p) { try { p.style.setProperty("--len", String(Math.ceil(p.getTotalLength()))); } catch (e) { /* sin layout */ } }); });
    return svg;
  }

  /* ---------------------------------------------------------------- Incidentes */
  function viewIncidentes() {
    var D = state.D, wrap = h("div", null, vhead("siren", t("inc.kicker"), t("inc.h1"), t("inc.lede")));
    if (!D.incs.length) { wrap.appendChild(card(null, null, h("p", { class: "empty", text: t("inc.ninguno") }))); return wrap; }
    if (state.incident >= D.incs.length) state.incident = 0;
    var list = h("ul", { class: "inc-list", "aria-label": t("inc.lista") }, D.incs.map(function (inc, i) {
      return h("li", null, h("button", { type: "button", class: "inc-btn press", "aria-current": i === state.incident ? "true" : null, onclick: function () { state.incident = i; render(); var b = $('.inc-btn[aria-current="true"]'); if (b) b.focus(); } },
        h("span", { class: "r1" }, h("span", { class: "id", text: inc.incident_id }), sevTag(inc.severity)), h("span", { class: "title", text: inc.title })));
    }));
    wrap.appendChild(h("div", { class: "md" }, list, incidentDetail(D, state.incident)));
    return wrap;
  }
  function incidentDetail(D, i) {
    var inc = D.incs[i], box = h("article", { class: "card", "aria-labelledby": "inc-title" });
    box.appendChild(h("div", { class: "card-h" }, h("div", null, sevTag(inc.severity), h("h2", { id: "inc-title", class: "mt", text: inc.title }), inc.description ? h("p", { class: "lede", text: inc.description }) : null)));
    box.appendChild(h("div", { class: "meta" },
      h("span", null, icon("hash"), h("span", { class: "mono", text: inc.rule_id })),
      h("span", null, icon("target"), t("inc.confianza", { n: Math.round((inc.confidence || 0) * 100) })),
      h("span", null, icon("hourglass"), t("inc.cadena", { d: fmtDur(inc.attack_duration_seconds) })),
      h("span", null, icon("radar"), t("inc.detectado", { h: hhmmss(inc.detected_at_utc) }))));
    box.appendChild(h("h3", { class: "sec-t label", text: t("inc.etapas") }));
    var ol = h("ol", { class: "steps" });
    (inc.correlated_events || []).forEach(function (ev, k) {
      ol.appendChild(h("li", null, h("span", { class: "knot", "aria-hidden": "true", text: String(k + 1) }),
        h("div", null, h("div", { class: "st-t", text: t("inc.etapa", { n: k + 1, a: ev.action }) }),
          h("div", { class: "st-m", text: hhmmss(ev.timestamp_utc) + " UTC · " + ev.actor + " ← " + ev.source_ip + " → " + ev.target_host + " (" + (ev.source_type || "") + ")" }),
          ev.command_line ? h("code", { class: "cmd", text: ev.command_line }) : null,
          (ev.offensive_exposures || []).map(function (x) { return h("div", { class: "expo" }, icon("triangle-alert"), h("span", null, h("b", { class: "mono", text: x.finding_id }), " · " + (x.description || ""))); }),
          h("div", { class: "hashline" }, h("span", { class: "hash", text: "SHA-256 " + ev.raw_log_sha256 }), copyBtn(ev.raw_log_sha256, "SHA-256")))));
    });
    box.appendChild(ol);
    box.appendChild(h("h3", { class: "sec-t label", text: "MITRE ATT&CK" }));
    box.appendChild(h("ul", { class: "chips" }, (inc.mitre_attack || []).map(function (m) { return h("li", { class: "chip" }, h("span", { class: "mono", text: m.technique_id }), m.technique_name || ""); })));
    box.appendChild(h("h3", { class: "sec-t label", text: t("inc.dictamen") }));
    var rows = [];
    FRAMEWORKS.forEach(function (f) {
      ((inc.grc_compliance_mapping || {})[f.key] || []).forEach(function (c) {
        rows.push(h("tr", null, h("td", { "data-label": t("col.marco"), text: f.short }), h("td", { class: "mono", "data-label": t("col.control"), text: c.control_id || c.article }),
          h("td", { "data-label": t("col.descripcion"), text: c.control_name || c.topic || "" }), h("td", { "data-label": t("col.dictamen") }, verdictTag(c.audit_verdict))));
      });
    });
    box.appendChild(h("div", { class: "table-wrap", tabindex: "0", role: "region", "aria-label": t("inc.dictamen") }, h("table", { class: "cards-sm" },
      h("thead", null, h("tr", null, ["col.marco", "col.control", "col.descripcion", "col.dictamen"].map(function (k) { return h("th", { scope: "col", text: t(k) }); }))), h("tbody", null, rows))));
    box.appendChild(h("div", { class: "note mt" }, icon("fingerprint"), h("div", { class: "grow" }, h("b", { text: t("inc.merkle") }), h("div", { class: "hashline" }, h("span", { class: "hash", text: inc.evidence_merkle_root_sha256 }), copyBtn(inc.evidence_merkle_root_sha256, t("ui.merkle"))))));
    return box;
  }

  /* ---------------------------------------------------------------- Cumplimiento */
  function viewCumplimiento() {
    var D = state.D;
    var wrap = h("div", null, vhead("scale", t("cum.kicker"), t("cum.h1"), t("cum.lede"),
      [h("button", { type: "button", class: "btn press", id: "btn-csv", onclick: exportNC }, icon("file-spreadsheet"), t("cum.csv"))]));
    var tabs = h("div", { class: "tabs", role: "tablist", "aria-label": t("cum.marco") }, FRAMEWORKS.map(function (f) {
      var sel = f.key === state.framework;
      return h("button", { type: "button", role: "tab", class: "tab press", id: "tab-" + f.key, "aria-selected": String(sel), "aria-controls": "fw-panel", tabindex: sel ? "0" : "-1", onclick: function () { state.framework = f.key; render(); $("#tab-" + f.key).focus(); } },
        f.label, h("span", { class: "n", text: String((D.grc[f.key] || []).length) }));
    }));
    tabs.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (!d) return;
      var i = FRAMEWORKS.map(function (f) { return f.key; }).indexOf(state.framework);
      state.framework = FRAMEWORKS[(i + d + FRAMEWORKS.length) % FRAMEWORKS.length].key; render(); $("#tab-" + state.framework).focus();
    });
    var list = D.grc[state.framework] || [], nis = state.framework === "nis2_directive";
    var head = nis ? ["col.articulo", "col.ambito", "col.incidentes"] : ["col.control", "col.nombre", "col.dictamen", "col.evidencia", "col.incidentes"];
    var panel = h("div", { class: "table-wrap", id: "fw-panel", role: "tabpanel", tabindex: "0", "aria-labelledby": "tab-" + state.framework },
      list.length ? h("table", { class: "cards-sm" }, h("thead", null, h("tr", null, head.map(function (k) { return h("th", { scope: "col", text: t(k) }); }))),
        h("tbody", null, list.map(function (c) {
          var incCell = h("td", { "data-label": t("col.incidentes") }, (c.incidents || []).map(function (id, k) {
            var i = D.incs.map(function (x) { return x.incident_id; }).indexOf(id);
            return [k ? ", " : "", i >= 0 ? incLink(i) : h("span", { class: "mono", text: id })];
          }));
          return nis ? h("tr", null, h("td", { class: "mono", "data-label": t("col.articulo"), text: c.article || "" }), h("td", { class: "wrap", "data-label": t("col.ambito"), text: c.topic || "" }), incCell)
            : h("tr", null, h("td", { class: "mono", "data-label": t("col.control"), text: c.control_id || "" }), h("td", { "data-label": t("col.nombre"), text: c.control_name || "" }),
              h("td", { "data-label": t("col.dictamen") }, verdictTag(c.audit_verdict)), h("td", { class: "wrap", "data-label": t("col.evidencia"), text: c.evidence_summary || "—" }), incCell);
        }))) : h("p", { class: "empty", text: t("cum.vacio") }));
    wrap.appendChild(h("div", { class: "grid stagger" }, nis2Card(D), card(null, null, [tabs, panel, h("p", { class: "sub mt", text: t("cum.orientativo") })])));
    return wrap;
  }
  function exportNC() {
    var D = state.D, rows = [["marco", "control", "nombre", "dictamen", "evidencia", "incidentes"]];
    FRAMEWORKS.forEach(function (f) { (D.grc[f.key] || []).forEach(function (c) { rows.push([f.short, c.control_id || c.article, c.control_name || c.topic || "", c.audit_verdict || "", c.evidence_summary || "", (c.incidents || []).join(" ")]); }); });
    download("trama-no-conformidades.csv", toCSV(rows), "text/csv");
    toast(t("toast.exportado"), "file-spreadsheet");
  }

  /* ---------------------------------------------------------------- Custodia */
  function verifyInBrowser() {
    var b = state.bundle, chain = JSON.parse(JSON.stringify(state.D.chain)), raws = b.raw_events;
    if (state.tampered && chain.length > 1) chain[1].raw_log_sha256 = chain[1].raw_log_sha256.replace(/^./, function (c) { return c === "0" ? "1" : "0"; });
    var stored = b.forensic_custody_verification, prev = stored.genesis_hash, rows = [], broken = null, reason = "";
    chain.forEach(function (blk, i) {
      if (broken === null) {
        if (blk.previous_node_hash !== prev) reason = "enlace";
        else if (Sha256.hex(blk.previous_node_hash + "|" + blk.raw_log_sha256 + "|" + blk.ingested_at_utc) !== blk.chain_seal_sha256) reason = "sello";
        else if (raws && raws[i] && Sha256.hex(Sha256.canonicalJSON(raws[i])) !== blk.raw_log_sha256) reason = "crudo";
        else reason = "";
        if (reason) broken = i;
        prev = blk.chain_seal_sha256;
      }
      rows.push(broken === null ? "ok" : broken === i ? "bad" : "skip");
    });
    var rootH = Sha256.merkleRoot(chain.map(function (x) { return x.raw_log_sha256; }));
    if (broken === null && stored.merkle_root_sha256 && rootH !== stored.merkle_root_sha256) { broken = chain.length; reason = "merkle"; }
    if (broken === null && stored.head_seal_hash && chain.length && chain[chain.length - 1].chain_seal_sha256 !== stored.head_seal_hash) { broken = chain.length; reason = "final"; }
    return { valid: broken === null, broken: broken, reason: reason, rows: rows, root: rootH, raw: !!raws };
  }
  function viewCustodia() {
    var D = state.D, b = state.bundle, stored = b.forensic_custody_verification, r = state.verify;
    var wrap = h("div", null, vhead("link", t("cus.kicker"), t("cus.h1"), t("cus.lede"), [
      h("button", { type: "button", class: "btn press", id: "btn-tamper", "aria-pressed": String(state.tampered), onclick: function () { state.tampered = !state.tampered; runVerify(); } }, icon("flask-conical"), t("cus.simular")),
      h("button", { type: "button", class: "btn press", id: "btn-export", onclick: exportBundle }, icon("download"), t("ui.exportar")),
      h("button", { type: "button", class: "btn primary press", id: "btn-verify", onclick: runVerify }, icon("shield-check"), t("cus.verificar"))]));
    var v;
    if (!r) v = h("div", { class: "verdict", id: "verdict", role: "status" }, icon("shield-check"), h("div", null, h("b", { text: t("cus.pendiente") }), h("span", { text: t("cus.registrado", { e: stored.valid ? t("cus.integra") : t("cus.rota") }) })));
    else if (r.valid) v = h("div", { class: "verdict ok", id: "verdict", role: "status" }, icon("circle-check"), h("div", null, h("b", { text: t("cus.ok", { n: r.rows.length }) }), h("span", { text: r.raw ? t("cus.okCrudo") : t("cus.okSinCrudo") })));
    else v = h("div", { class: "verdict bad", id: "verdict", role: "status" }, icon("circle-x"), h("div", null, h("b", { text: t("cus.bad", { n: r.broken, r: t("cus.razon." + r.reason) }) }), h("span", { text: state.tampered ? t("cus.simulado") : t("cus.revisa") })));
    wrap.appendChild(v);
    wrap.appendChild(h("dl", { class: "hashes" }, [["cus.genesis", stored.genesis_hash], ["cus.final", stored.head_seal_hash], ["cus.merkle", r ? r.root : stored.merkle_root_sha256]].map(function (x) {
      return h("div", null, h("dt", { text: t(x[0]) }), h("dd", { text: x[1] || "—" }));
    })));
    var links = h("ol", { class: "links" + (r ? " run" : ""), id: "links", "aria-label": t("cus.eslabones") }, D.chain.map(function (blk, i) {
      var st = r ? r.rows[i] : null;
      var li = h("li", { class: "link-blk" + (st ? " " + st : "") },
        h("div", { class: "bi" }, h("span", { text: t("cus.bloque", { n: i }) }), icon(st === "bad" ? "unlink" : "link-2")),
        h("div", { class: "src", text: blk.source_type }),
        h("div", { class: "h" }, h("span", { text: "raw " }), short(blk.raw_log_sha256, 8)),
        h("div", { class: "h" }, h("span", { text: t("cus.sello") + " " }), short(blk.chain_seal_sha256, 8)),
        st === null ? h("span", { class: "tag", text: t("cus.sinVerificar") }) : st === "ok" ? h("span", { class: "tag ok" }, icon("check"), t("cus.valido")) : st === "bad" ? h("span", { class: "tag bad" }, icon("x"), t("cus.alterado")) : h("span", { class: "tag", text: t("cus.noVerificable") }));
      li.style.setProperty("--i", String(i));
      return li;
    }));
    wrap.appendChild(card(t("cus.c1"), t("cus.c1s"), h("div", { class: "hilo-wrap", tabindex: "0", role: "region", "aria-label": t("cus.eslabones") }, links)));
    wrap.appendChild(card(t("cus.c2"), null, h("pre", { class: "formula", text: t("cus.formula") }), { cls: "mt" }));
    return wrap;
  }
  function runVerify() {
    state.verify = verifyInBrowser();
    if (state.view !== "custodia") { location.hash = "#custodia"; return; }
    render();
    toast(state.verify.valid ? t("toast.verificada") : t("toast.manipulada"), state.verify.valid ? "shield-check" : "triangle-alert");
  }

  /* ---------------------------------------------------------------- Eventos */
  function viewEventos() {
    var D = state.D, types = uniq(D.events.map(function (e) { return (e.forensic_chain || {}).source_type; })).sort();
    var wrap = h("div", null, vhead("list", t("ev.kicker"), t("ev.h1"), t("ev.lede")));
    var sel = h("select", { class: "input", id: "src-filter", onchange: function () { state.src = this.value; fillEvents(); } }, h("option", { value: "", text: t("ev.todos") }), types.map(function (x) { return h("option", { value: x, text: x }); }));
    sel.value = state.src;
    var q = h("input", { class: "input", id: "ev-q", type: "search", placeholder: t("ev.filtroPh"), autocomplete: "off", spellcheck: "false", oninput: function () { state.q = this.value; fillEvents(); } });
    q.value = state.q;
    var count = h("p", { class: "sub", id: "ev-count", "aria-live": "polite" });
    var table = h("table", { class: "cards-sm", id: "ev-table" }, h("thead", null, h("tr", null, ["col.hora", "col.origen", "col.accion", "col.actor", "col.destino", "col.exposicion"].map(function (k) { return h("th", { scope: "col", text: t(k) }); }), h("th", { scope: "col" }, h("span", { class: "sr-only", text: t("col.json") })))), h("tbody"));
    wrap.appendChild(card(null, null, [h("div", { class: "toolbar" }, h("div", { class: "field" }, h("label", { for: "src-filter", text: t("ev.fuente") }), sel), h("div", { class: "field" }, h("label", { for: "ev-q", text: t("ev.filtro") }), q), count),
      h("div", { class: "table-wrap", tabindex: "0", role: "region", "aria-label": t("ev.h1") }, table)]));
    if (state.bundle.imports) wrap.appendChild(h("div", { class: "mt" }, sourcesCard(state.bundle.imports)));
    setTimeout(fillEvents, 0);
    return wrap;
  }
  /* Procedencia: qué fichero aportó qué, con su formato, activo y registros omitidos. */
  function sourcesCard(report) {
    return card(t("ev.fuentes"), t("ev.fuentesS", { n: report.length }), h("ul", { class: "list", id: "ev-sources" }, report.map(function (r) {
      var meta = [r.label || t("imp.errFormato")];
      if (!r.error) meta.push(tn(r.kind === "events" ? "imp.nEventos" : "imp.nHallazgos", r.count));
      if (r.skipped) meta.push(tn("imp.nOmitidos", r.skipped));
      if (r.asset) meta.push(t("ev.activo", { a: r.asset }));
      return h("li", { class: "row-item" + (r.error ? " bad" : "") }, icon(r.error ? "file-x" : "file-check"),
        h("div", { class: "grow" }, h("b", { class: "mono", text: r.file }), h("p", { class: "sub", text: meta.join(" · ") }),
          r.error ? h("p", { class: "imp-err", text: errorText(r.error) }) : null));
    })));
  }
  function fillEvents() {
    var D = state.D, tb = $("#ev-table tbody"); if (!tb) return;
    clear(tb);
    var q = state.q.trim().toLowerCase(), shown = 0;
    D.events.forEach(function (e) {
      if (state.src && (e.forensic_chain || {}).source_type !== state.src) return;
      if (q && JSON.stringify(e).toLowerCase().indexOf(q) < 0) return;
      shown++;
      var exp = (e.offensive_posture_context || {}).known_exposures || [];
      var detail = h("tr", { class: "detail-row", hidden: true }, h("td", { colspan: "7" }, h("pre", { text: JSON.stringify(e, null, 2) })));
      var btn = h("button", { type: "button", class: "link-btn press", "aria-expanded": "false", "aria-label": t("ev.verJson", { id: e.event_id }) }, icon("chevron-right"));
      btn.addEventListener("click", function () { var open = detail.hidden; detail.hidden = !open; btn.setAttribute("aria-expanded", String(open)); });
      tb.appendChild(h("tr", { class: D.incOfEvent[e.event_id] ? "hit" : null, id: "ev-" + e.event_id },
        h("td", { class: "mono", "data-label": t("col.hora"), text: hhmmss(e.timestamp_utc) }),
        h("td", { "data-label": t("col.origen"), text: (e.forensic_chain || {}).source_type || "" }),
        h("td", { "data-label": t("col.accion"), text: (e.event || {}).action || "" }),
        h("td", { "data-label": t("col.actor"), text: (e.actor || {}).user_name || "" }),
        h("td", { "data-label": t("col.destino"), text: (e.target || {}).hostname || "" }),
        h("td", { "data-label": t("col.exposicion") }, exp.length ? h("span", { class: "tag warn", title: exp.map(function (x) { return x.finding_id; }).join("\n"), text: exp[0].finding_id + (exp.length > 1 ? " +" + (exp.length - 1) : "") }) : "—"),
        h("td", null, btn)));
      tb.appendChild(detail);
    });
    $("#ev-count").textContent = t("ev.contador", { n: shown, total: D.events.length });
  }

  /* ---------------------------------------------------------------- Entidades */
  function viewEntidades() {
    var D = state.D, g = state.bundle.correlation_results.entity_graph || { nodes: [], edges: [] };
    var wrap = h("div", null, vhead("network", t("ent.kicker"), t("ent.h1"), t("ent.lede")));
    var incByNode = {};
    D.stages.forEach(function (s) {
      ["IP:" + s.ev.source_ip, "USER:" + s.ev.actor, "HOST:" + s.ev.target_host, "SPN:" + s.ev.target_host].forEach(function (k) { (incByNode[k] = incByNode[k] || []).push(s.inc); });
    });
    var cols = [["ent.origenes", function (n) { return n.type === "IP"; }, "globe"], ["ent.actores", function (n) { return n.type === "USER"; }, "user"], ["ent.destinos", function (n) { return n.type === "HOST" || n.type === "SPN"; }, "server"]];
    wrap.appendChild(h("div", { class: "grid g3 stagger" }, cols.map(function (c) {
      var nodes = (g.nodes || []).filter(c[1]);
      return card(t(c[0]), t("ent.n", { n: nodes.length }), h("div", { class: "ent-col" }, nodes.map(function (n) {
        var incs = uniq((incByNode[n.id] || []).map(String)).map(Number);
        return h("div", { class: "ent" + (n.has_offensive_exposure ? " exposed" : "") }, h("b", { text: String(n.id).replace(/^[A-Z]+:/, "") }),
          h("div", { class: "meta" }, h("span", null, icon(c[2]), t("ent.eventos", { n: n.events_count || 0 })), n.has_offensive_exposure ? h("span", { class: "tag bad" }, icon("triangle-alert"), t("ent.expuesto")) : null,
            incs.map(function (i) { return incLink(i); })));
      })));
    })));
    wrap.appendChild(card(t("ent.rel"), t("ent.rels"), h("div", { class: "table-wrap", tabindex: "0", role: "region", "aria-label": t("ent.rel") }, h("table", { class: "cards-sm" },
      h("thead", null, h("tr", null, ["col.hora", "col.origen", "col.actor", "col.destino", "col.accion"].map(function (k) { return h("th", { scope: "col", text: t(k) }); }))),
      h("tbody", null, (g.edges || []).map(function (e) {
        return h("tr", null, h("td", { class: "mono", "data-label": t("col.hora"), text: hhmmss(e.timestamp_utc) }), h("td", { class: "mono", "data-label": t("col.origen"), text: e.from }),
          h("td", { class: "mono", "data-label": t("col.actor"), text: e.actor }), h("td", { class: "mono", "data-label": t("col.destino"), text: e.to }), h("td", { "data-label": t("col.accion"), text: e.action }));
      })))), { cls: "mt" }));
    return wrap;
  }

  /* ---------------------------------------------------------------- Sin datos */
  function viewEmpty() {
    return h("div", null, vhead("file-up", t("vacio.kicker"), t("vacio.h1"), t("vacio.lede")),
      h("div", { class: "grid g2" },
        card(t("vacio.abrir"), t("vacio.abrirS"), h("button", { type: "button", class: "btn primary press", onclick: function () { openImport(this); } }, icon("file-up"), t("ui.importar"))),
        card(t("vacio.cli"), t("vacio.cliS"), h("pre", { class: "formula", text: "python3 -m trama run scan.xml security.jsonl access.log \\\n  --asset access.log=web01 -o caso.json" }))));
  }

  /* ---------------------------------------------------------------- render y navegación */
  var RENDER = { inicio: viewInicio, hilo: viewHilo, incidentes: viewIncidentes, cumplimiento: viewCumplimiento, custodia: viewCustodia, eventos: viewEventos, entidades: viewEntidades };
  function render() {
    var main = clear($("#main"));
    var view = h("section", { class: "view", id: "view-" + state.view, "aria-label": t("view." + state.view) });
    view.appendChild(state.bundle ? RENDER[state.view]() : viewEmpty());
    main.appendChild(view);
    hydrate(main);
    applyWidths(main);
    document.title = t("view." + state.view) + " · " + NAME;
    markNav();
  }
  /* Los anchos y posiciones de las pistas se aplican por CSSOM (permitido por la CSP;
   * los atributos style en el HTML no lo están). */
  function applyWidths(ctx) {
    $$("[data-w]", ctx).forEach(function (el) { el.style.width = el.getAttribute("data-w") + "%"; });
    $$("[data-l]", ctx).forEach(function (el) { el.style.left = el.getAttribute("data-l") + "%"; });
  }
  function onHash() {
    var id = (location.hash || "#inicio").slice(1);
    if (!RENDER[id]) id = "inicio";
    var changed = id !== state.view;
    state.view = id;
    render();
    if (changed) { var m = $("#main"); window.scrollTo(0, 0); if (document.activeElement && document.activeElement.closest && document.activeElement.closest("#nav, #bnav, .tiles")) m.focus({ preventScroll: true }); }
  }

  /* ---------------------------------------------------------------- diálogos */
  var lastFocus = null;
  function openDialog(dlg, opener) {
    closeDialogs();
    lastFocus = opener || document.activeElement;
    hydrate(dlg);
    dlg.showModal();
    var first = dlg.querySelector("[autofocus]") || dlg.querySelector('[role="tab"][aria-selected="true"]') || dlg.querySelector("input, button, a[href]");
    if (first) first.focus();
  }
  function closeDialogs() { $$("dialog[open]").forEach(function (d) { d.close(); }); }
  function dlgFrame(dlg, title, body, foot) {
    var id = dlg.id + "-h";
    dlg.setAttribute("aria-labelledby", id);
    clear(dlg).appendChild(h("div", { class: "dlg" },
      h("div", { class: "dlg-h" }, h("h2", { id: id, text: title }), h("button", { type: "button", class: "icon-btn press", "aria-label": t("ui.cerrar"), onclick: function () { dlg.close(); } }, icon("x"))),
      h("div", { class: "dlg-b" }, body), foot ? h("div", { class: "dlg-f" }, foot) : null));
  }
  function wireDialogs() {
    $$("dialog").forEach(function (d) {
      d.addEventListener("click", function (e) { if (e.target === d) d.close(); });
      d.addEventListener("close", function () { if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); });
    });
  }

  /* Búsqueda (Ctrl K) */
  function searchIndex() {
    var D = state.D, out = [];
    if (!D) return out;
    D.incs.forEach(function (inc, i) { out.push({ k: t("s.incidente"), t: inc.incident_id + " · " + inc.title, s: inc.rule_id, hay: JSON.stringify(inc), go: function () { goIncident(i); } }); });
    D.findings.forEach(function (f) { out.push({ k: t("s.hallazgo"), t: f.finding_id, s: f.description || "", hay: JSON.stringify(f), go: function () { location.hash = "#inicio"; } }); });
    FRAMEWORKS.forEach(function (f) { (D.grc[f.key] || []).forEach(function (c) { out.push({ k: f.short, t: (c.control_id || c.article) + " · " + (c.control_name || c.topic || ""), s: c.evidence_summary || "", hay: JSON.stringify(c), go: function () { state.framework = f.key; location.hash = "#cumplimiento"; if (state.view === "cumplimiento") render(); } }); }); });
    D.events.forEach(function (e) { out.push({ k: t("s.evento"), t: e.event_id + " · " + (e.event || {}).action, s: (e.forensic_chain || {}).raw_log_sha256 || "", hay: JSON.stringify(e), go: function () { state.q = e.event_id; location.hash = "#eventos"; if (state.view === "eventos") render(); } }); });
    VIEWS.forEach(function (v) { out.push({ k: t("s.seccion"), t: t("view." + v.id), s: "", hay: t("view." + v.id), go: function () { location.hash = "#" + v.id; } }); });
    return out;
  }
  function fold(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function openSearch() {
    var dlg = $("#dlg-search"), idx = searchIndex(), cur = 0, res = [];
    var input = h("input", { type: "search", id: "s-input", role: "combobox", "aria-expanded": "true", "aria-controls": "s-list", "aria-autocomplete": "list", "aria-label": t("ui.buscar"), placeholder: t("s.ph"), autocomplete: "off", spellcheck: "false" });
    var ul = h("ul", { class: "s-res", id: "s-list", role: "listbox", "aria-label": t("s.resultados") });
    function paint() {
      var q = fold(input.value.trim());
      // Relevancia: primero lo que empieza por la consulta (un control, un id), después lo que la contiene.
      res = q ? idx.map(function (x, n) { var ti = fold(x.t); return { x: x, n: n, s: ti.indexOf(q) === 0 ? 0 : ti.indexOf(q) >= 0 ? 1 : fold(x.hay).indexOf(q) >= 0 ? 2 : 9 }; })
        .filter(function (r) { return r.s < 9; }).sort(function (a, b) { return a.s - b.s || a.n - b.n; }).slice(0, 40).map(function (r) { return r.x; })
        : idx.filter(function (x) { return x.k === t("s.seccion") || x.k === t("s.incidente"); });
      cur = Math.min(cur, Math.max(0, res.length - 1));
      clear(ul);
      if (!res.length) { ul.appendChild(h("li", { class: "none", role: "presentation", text: t("s.nada") })); input.removeAttribute("aria-activedescendant"); return; }
      res.forEach(function (r, n) {
        ul.appendChild(h("li", { role: "option", id: "s-o" + n, "aria-selected": String(n === cur), onclick: function () { pick(n); }, onmousemove: function () { if (cur !== n) { cur = n; mark(); } } },
          h("span", { class: "k", text: r.k }), h("span", null, h("span", { class: "t", text: r.t }), r.s ? h("span", { class: "s", text: r.s }) : null)));
      });
      mark();
    }
    function mark() {
      $$('[role="option"]', ul).forEach(function (li, n) { li.setAttribute("aria-selected", String(n === cur)); });
      input.setAttribute("aria-activedescendant", "s-o" + cur);
      var el = $("#s-o" + cur); if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
    }
    function pick(n) { var r = res[n]; if (!r) return; dlg.close(); r.go(); }
    input.addEventListener("input", function () { cur = 0; paint(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); cur = Math.min(res.length - 1, cur + 1); mark(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); cur = Math.max(0, cur - 1); mark(); }
      else if (e.key === "Enter") { e.preventDefault(); pick(cur); }
    });
    dlg.setAttribute("aria-label", t("ui.buscar"));
    clear(dlg).appendChild(h("div", { class: "dlg" }, h("div", { class: "s-field" }, icon("search"), input, h("kbd", { text: "Esc" })), ul));
    paint();
    openDialog(dlg, $("#search-btn"));
    input.focus();
  }

  /* Ayuda */
  var HELP_TABS = [["guia", "info"], ["metodo", "fingerprint"], ["datos", "file-json"], ["atajos", "keyboard"], ["glosario", "list"], ["acerca", "user-round"]];
  function openHelp(tab) {
    var dlg = $("#dlg-help"), cur = tab || "guia";
    var tabs = h("div", { class: "htabs", role: "tablist", "aria-label": t("ui.ayuda") });
    var panel = h("div", { class: "hp", role: "tabpanel", tabindex: "0" });
    function paint(focus) {
      clear(tabs);
      HELP_TABS.forEach(function (x) {
        tabs.appendChild(h("button", { type: "button", role: "tab", id: "ht-" + x[0], "aria-selected": String(x[0] === cur), "aria-controls": "hp", tabindex: x[0] === cur ? "0" : "-1", onclick: function () { cur = x[0]; paint(true); } }, icon(x[1]), t("help.tab." + x[0])));
      });
      panel.id = "hp"; panel.setAttribute("aria-labelledby", "ht-" + cur);
      clear(panel).appendChild(helpPanel(cur));
      if (focus) $("#ht-" + cur).focus();
    }
    tabs.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (!d) return;
      var i = HELP_TABS.map(function (x) { return x[0]; }).indexOf(cur);
      cur = HELP_TABS[(i + d + HELP_TABS.length) % HELP_TABS.length][0]; paint(true);
    });
    dlg.setAttribute("aria-labelledby", "dlg-help-h");
    clear(dlg).appendChild(h("div", { class: "dlg" },
      h("div", { class: "dlg-h" }, h("h2", { id: "dlg-help-h", text: t("help.titulo") }), h("button", { type: "button", class: "icon-btn press", "aria-label": t("ui.cerrar"), onclick: function () { dlg.close(); } }, icon("x"))),
      tabs, h("div", { class: "dlg-b" }, panel),
      h("div", { class: "dlg-f" }, h("span", { text: NAME + " · Yoandy Ramírez Delgado" }), h("button", { type: "button", class: "btn primary sm press", onclick: function () { dlg.close(); } }, t("ui.entendido")))));
    paint(false);
    openDialog(dlg, $("#help-btn"));
  }
  function helpPanel(tab) {
    var box = h("div", { class: "hp" });
    function p(k, v) { box.appendChild(h("p", { text: t(k, v) })); }
    function h3(k) { box.appendChild(h("h3", { text: t(k) })); }
    if (tab === "guia") {
      h3("help.guia.t"); p("help.guia.p");
      box.appendChild(h("ol", null, ["1", "2", "3", "4", "5"].map(function (n) { return h("li", { text: t("help.guia." + n) }); })));
      h3("help.lentes.t");
      box.appendChild(h("ul", null, LENSES.map(function (l) { return h("li", null, h("b", { text: t("lens." + l.id + ".rol") + ": " }), t("lens." + l.id + ".q")); })));
    } else if (tab === "metodo") {
      h3("help.metodo.t"); p("help.metodo.p");
      box.appendChild(h("pre", { class: "formula", text: t("cus.formula") }));
      h3("help.nis2.t");
      box.appendChild(h("pre", { class: "formula", text: t("help.nis2.f", { a: NIS2.alertaH, n: NIS2.notificacionH, m: NIS2.finalMeses, d: DEMO_CLOCK_H }) }));
      h3("help.cobertura.t"); p("help.cobertura.p");
    } else if (tab === "datos") {
      h3("help.datos.t"); p("help.datos.p");
      box.appendChild(h("ul", null, GUIDE.map(function (g) { return h("li", null, h("b", { text: TRAMA_IMPORT.FORMATS[g[0]][0] + ": " }), h("span", { class: "mono", text: g[2] })); })));
      p("help.datos.activo");
      h3("help.cli.t"); p("help.cli.p");
      box.appendChild(h("pre", { class: "formula", text: "python3 -m trama import scan.xml security.jsonl access.log\npython3 -m trama run scan.xml security.jsonl access.log \\\n  --asset access.log=web01 -o caso.json\npython3 -m trama verify caso.json" }));
      p("help.datos.abrir");
      h3("help.privacidad.t"); p("help.privacidad.p");
    } else if (tab === "atajos") {
      var keys = [["Ctrl K · /", "k.buscar"], ["1 – 7", "k.vistas"], ["L", "k.lente"], ["J · K", "k.incidentes"], ["V", "k.verificar"], ["T", "k.tema"], ["I", "k.importar"], ["O", "k.abrir"], ["[", "k.lateral"], ["?", "k.ayuda"], ["Esc", "k.cerrar"]];
      box.appendChild(h("div", { class: "keys" }, keys.map(function (k) { return h("div", null, h("span", { text: t(k[1]) }), h("kbd", { text: k[0] })); })));
    } else if (tab === "glosario") {
      var terms = ["custodia", "sello", "merkle", "incidente", "regla", "hallazgo", "ioc", "ttd", "permanencia", "cobertura", "nc", "nis2"];
      box.appendChild(h("dl", { class: "gloss" }, terms.map(function (k) { return [h("dt", { text: t("g." + k + ".t") }), h("dd", { text: t("g." + k + ".d") })]; })));
    } else {
      box.appendChild(h("div", { class: "author" }, h("span", { class: "avatar", "aria-hidden": "true", text: "YR" }),
        h("div", null, h("b", { text: "Yoandy Ramírez Delgado" }), h("small", { text: t("about.rol") }),
          h("div", { class: "btn-row mt" }, h("a", { class: "btn sm press", href: "https://github.com/heindall92", target: "_blank", rel: "noopener noreferrer" }, icon("code"), "GitHub"),
            h("button", { type: "button", class: "btn sm press", onclick: function () { copyText("yoandyramirezdelgado@gmail.com", t("about.correo")); } }, icon("mail"), t("about.copiarCorreo"))))));
      h3("about.sobre"); p("about.sobreP", { v: version(), app: NAME });
      box.appendChild(h("div", { class: "note" }, icon("info"), t("about.indep")));
      h3("about.eco"); p("about.ecoP");
      box.appendChild(h("div", { class: "eco" }, ECO.map(function (e) {
        return h("div", { class: "eco-i" + (e[4] ? " self" : "") }, h("div", null, h("b", { text: e[0] }), h("small", { text: t(e[1]) })),
          e[2] && !e[4] ? h("a", { href: e[2], target: "_blank", rel: "noopener noreferrer", text: t("about.abrir") }) : null,
          h("a", { href: e[3], target: "_blank", rel: "noopener noreferrer", text: t("about.codigo") }));
      })));
      h3("about.dudas");
      box.appendChild(h("div", { class: "btn-row" }, h("a", { class: "btn sm press", href: "https://github.com/heindall92/evidence-correlator/issues", target: "_blank", rel: "noopener noreferrer" }, icon("bug"), t("about.incidencia")),
        h("a", { class: "btn sm press", href: "https://github.com/heindall92/evidence-correlator", target: "_blank", rel: "noopener noreferrer" }, icon("code"), t("about.verCodigo"))));
    }
    return box;
  }

  /* Ajustes */
  function openSettings(opener) {
    var dlg = $("#dlg-settings");
    function radios(name, opts, cur, onPick) {
      return h("div", { class: "opts", role: "radiogroup", "aria-label": t("set." + name) }, opts.map(function (o) {
        var input = h("input", { type: "radio", name: "set-" + name, value: o, checked: o === cur ? true : null, onchange: function () { onPick(o); } });
        return h("label", { class: "opt" }, input, h("span", null, h("b", { text: t("set." + name + "." + o) }), h("small", { text: t("set." + name + "." + o + ".d") })));
      }));
    }
    var reset = h("button", { type: "button", class: "btn sm press", onclick: function () {
      if (reset.getAttribute("data-armed")) {
        try { localStorage.removeItem("trama-prefs"); localStorage.removeItem("trama-perfil"); } catch (e) { /* */ }
        forget();
        prefs = {}; profile = { rol: "blue" }; toast(t("toast.borrado"));
        root.setAttribute("data-density", "comfortable"); root.removeAttribute("data-motion");
        dlg.close(); renderChrome(); render(); return;
      }
      reset.setAttribute("data-armed", "1"); reset.lastChild.textContent = t("set.confirmar");
    } }, icon("x"), h("span", { text: t("set.borrar") }));
    dlgFrame(dlg, t("ui.ajustes"), [
      h("div", { class: "field" }, h("span", { class: "lbl", text: t("set.density") }), radios("density", ["comfortable", "compact"], root.getAttribute("data-density") || "comfortable", function (v) { root.setAttribute("data-density", v); prefs.density = v; save("trama-prefs", prefs); })),
      h("div", { class: "field" }, h("span", { class: "lbl", text: t("set.motion") }), radios("motion", ["system", "reduce"], prefs.motion === "reduce" ? "reduce" : "system", function (v) { prefs.motion = v; save("trama-prefs", prefs); if (v === "reduce") root.setAttribute("data-motion", "reduce"); else root.removeAttribute("data-motion"); })),
      h("div", { class: "field" }, h("span", { class: "lbl", text: t("set.paquete") }), h("div", { class: "btn-row" },
        h("button", { type: "button", class: "btn sm press", onclick: function () { dlg.close(); openImport(opener || $("#settings-btn")); } }, icon("file-up"), t("ui.importar")),
        state.bundle ? h("button", { type: "button", class: "btn sm press", onclick: exportBundle }, icon("download"), t("ui.exportar")) : null,
        validBundle(ORIGINAL) ? h("button", { type: "button", class: "btn sm press", onclick: function () { useBundle(ORIGINAL, null); dlg.close(); toast(t("toast.demo")); } }, icon("play"), t("set.demo")) : null)),
      h("div", { class: "field" }, h("span", { class: "lbl", text: t("set.datos") }), h("p", { class: "sub", text: t("set.datosP") }), h("div", { class: "btn-row" },
        h("button", { type: "button", class: "btn sm press", id: "set-forget", onclick: function () { forget().then(function () { toast(t("toast.olvidado"), "database"); }); } }, icon("database"), t("set.olvidar")), reset))
    ], h("span", { text: t("set.pie") }));
    openDialog(dlg, opener || $("#settings-btn"));
  }

  /* Perfil */
  function openProfile(opener) {
    var dlg = $("#dlg-profile"), rol = lens();
    var name = h("input", { class: "input", id: "pf-nombre", maxlength: "80", autocomplete: "name", value: profile.nombre || "" });
    var org = h("input", { class: "input", id: "pf-org", maxlength: "120", autocomplete: "organization", value: profile.org || "" });
    var group = h("div", { class: "lenses profile-lenses", role: "radiogroup", "aria-labelledby": "pf-rol" }, LENSES.map(function (l) {
      return h("button", { type: "button", role: "radio", class: "lens-opt press", "data-lens": l.id, "aria-checked": String(l.id === rol), onclick: function () {
        rol = l.id; $$(".lens-opt", group).forEach(function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-lens") === rol)); });
      } }, icon(l.icon), h("div", null, h("b", { text: t("lens." + l.id + ".rol") }), h("small", { text: t("lens." + l.id + ".q") })));
    }));
    dlgFrame(dlg, t("perfil.titulo"), [
      h("p", { class: "sub", text: t("perfil.intro") }),
      h("div", { class: "form" }, h("div", { class: "field" }, h("label", { for: "pf-nombre", text: t("perfil.nombre") }), name), h("div", { class: "field" }, h("label", { for: "pf-org", text: t("perfil.org") }), org)),
      h("div", { class: "field" }, h("span", { class: "lbl", id: "pf-rol", text: t("perfil.rol") }), group)
    ], h("button", { type: "button", class: "btn primary press", id: "pf-save", onclick: function () {
      profile.nombre = name.value.trim().slice(0, 80); profile.org = org.value.trim().slice(0, 120); profile.rol = rol;
      save("trama-perfil", profile); dlg.close(); renderChrome(); render(); toast(t("toast.perfil"));
    } }, icon("check"), t("perfil.guardar")));
    openDialog(dlg, opener || $("#account-btn"));
  }

  /* Más (móvil): vistas en rejilla, cuenta y ayuda en lista agrupada, preferencias en una tarjeta. */
  function openMore(opener) {
    var dlg = $("#dlg-more");
    function go() { dlg.close(); }
    var tiles = VIEWS.filter(function (v) { return MOBILE.indexOf(v.id) < 0; }).map(function (v) {
      return h("a", { class: "tile press", href: "#" + v.id, "aria-current": state.view === v.id ? "page" : null, onclick: go },
        icon(v.icon), h("span", { text: t("view." + v.id) }));
    });
    function row(ic, label, sub, fn) {
      return h("li", null, h("button", { type: "button", class: "grow-row", onclick: function () { dlg.close(); fn(); } },
        h("span", { class: "gi" }, icon(ic)),
        h("span", { class: "gt" }, h("b", { text: label }), sub ? h("small", { text: sub }) : null),
        icon("chevron-right")));
    }
    dlgFrame(dlg, t("ui.mas"), [
      h("section", { class: "more-sec", "aria-labelledby": "more-v" }, h("h3", { class: "more-k", id: "more-v", text: t("more.vistas") }),
        h("div", { class: "tiles" }, tiles)),
      h("section", { class: "more-sec", "aria-labelledby": "more-c" }, h("h3", { class: "more-k", id: "more-c", text: t("more.cuenta") }),
        h("ul", { class: "group" },
          row("user-round", t("ui.perfil"), (profile.nombre || t("perfil.anonimo")) + " · " + t("lens." + lens() + ".rol"), function () { openProfile(opener); }),
          row("sliders-horizontal", t("ui.ajustes"), null, function () { openSettings(opener); }),
          row("circle-question-mark", t("ui.ayuda"), null, openHelp),
          row("file-up", t("ui.importar"), t("more.importarS"), function () { openImport(opener); }))),
      h("section", { class: "more-sec", "aria-labelledby": "more-p" }, h("h3", { class: "more-k", id: "more-p", text: t("more.prefs") }),
        h("div", { class: "group prefs" },
          h("div", { class: "pref" }, h("span", { class: "gt", id: "more-lang" }, h("b", { text: t("ui.idioma") })),
            h("div", { class: "seg", role: "group", "aria-labelledby": "more-lang" }, ["es", "en"].map(function (l) {
              return h("button", { type: "button", lang: l, "aria-pressed": String(lang() === l), onclick: function () { setLang(l); openMore(opener); } }, l.toUpperCase());
            }))),
          h("div", { class: "pref col" }, h("span", { class: "gt" }, h("b", { text: t("ui.acento") })), swatches())))
    ]);
    if (!dlg.open) openDialog(dlg, opener); else hydrate(dlg);
  }

  /* ---------------------------------------------------------------- importar datos
   * Los ficheros se leen y se correlacionan en este navegador con importers.js y engine.js,
   * el mismo código que la CLI (tests/test_parity.py). */
  var MAX_FILE = 50 * 1024 * 1024;
  var imp = { items: [], assets: {}, report: [], busy: false };
  var GUIDE = [
    ["windows", "Security.evtx", "evtx_dump -o jsonl Security.evtx > security.jsonl · wevtutil qe Security /f:xml > security.xml · Winlogbeat (NDJSON)"],
    ["auditd", "/var/log/audit/audit.log", "ausearch --raw > audit.log"],
    ["access_log", "access.log", "nginx o Apache, formato combined o common"],
    ["suricata", "eve.json", "/var/log/suricata/eve.json (eventos http y alert)"],
    ["nmap", "scan.xml", "nmap -sV -oX scan.xml objetivo"],
    ["nessus", "scan.nessus", "Export → Nessus"],
    ["nuclei", "nuclei.jsonl", "nuclei -l objetivos.txt -jsonl -o nuclei.jsonl"],
    ["burp", "burp.xml", "Issues → Report selected issues → XML"],
    ["bloodhound", "users.json", "SharpHound o bloodhound-python (users.json)"],
    ["linpeas", "linpeas.txt", "linpeas.sh | tee linpeas.txt · getcap -r / 2>/dev/null · find / -perm -4000 -ls"]
  ];
  /* Plural correcto en ES y EN: clave + "1" para una unidad. */
  function tn(key, n) { return t(key + (n === 1 ? "1" : ""), { n: n }); }
  function fmtSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + "\u00a0MB" : n >= 1024 ? Math.round(n / 1024) + "\u00a0KB" : n + "\u00a0B"; }
  /* Igual que pipeline.read_text: UTF-16 con BOM (exportaciones de Windows) o UTF-8 con o sin BOM. */
  function readText(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onerror = function () { reject(r.error); };
      r.onload = function () {
        var b = new Uint8Array(r.result), enc = "utf-8";
        if (b[0] === 0xFF && b[1] === 0xFE) enc = "utf-16le"; else if (b[0] === 0xFE && b[1] === 0xFF) enc = "utf-16be";
        resolve(new TextDecoder(enc).decode(b));
      };
      r.readAsArrayBuffer(file);
    });
  }
  function isBundleText(text) {
    return /^\s*\{/.test(text) && window.TRAMA_IMPORT && TRAMA_IMPORT.detect(text, "") === "trama_bundle";
  }
  /** Entrada única para ficheros (selector, arrastre, botón del lateral): un paquete ya generado se abre; lo demás va a Importar. */
  function takeFiles(list) {
    var files = Array.prototype.slice.call(list || []);
    if (!files.length) return;
    if (files.length === 1 && files[0].size <= MAX_FILE && /\.json$/i.test(files[0].name)) {
      readText(files[0]).then(function (text) {
        if (isBundleText(text)) { openBundleText(text, files[0].name); return; }
        var b = null; try { b = JSON.parse(text); } catch (e) { b = null; }
        if (b && b.format === "yrd-ecosistema") { toast(t("toast.sobre"), "info"); return; }
        addFiles(files);
      }, function () { toast(t("imp.errLectura"), "triangle-alert"); });
      return;
    }
    addFiles(files);
  }
  function openBundleText(text, name) {
    var b = null;
    try { b = JSON.parse(text); } catch (e) { b = null; }
    if (!validBundle(b)) { toast(t("toast.invalido"), "triangle-alert"); return false; }
    if ($("#dlg-import").open) $("#dlg-import").close();
    useBundle(b, name.slice(0, 60));
    remember(b, name.slice(0, 60));
    toast(t("toast.cargado", { f: name.slice(0, 60) }), "file-json");
    return true;
  }
  function addFiles(files) {
    var pending = files.map(function (f) {
      var item = { name: f.name.slice(0, 200), size: f.size, text: null, error: null };
      if (f.size > MAX_FILE) { item.error = t("imp.errGrande"); return Promise.resolve(item); }
      return readText(f).then(function (text) { item.text = text; return item; }, function () { item.error = t("imp.errLectura"); return item; });
    });
    openImport();
    Promise.all(pending).then(function (items) {
      items.forEach(function (it) {
        imp.items = imp.items.filter(function (x) { return x.name !== it.name; });
        imp.items.push(it);
      });
      analyse();
      paintImport();
      var st = $("#imp-status"); if (st) st.textContent = t("imp.anadidos", { n: items.length });
    });
  }
  /* Vista previa: la misma importación que se correlacionará, para ver formato, recuento y activo de cada fichero. */
  function analyse() {
    var files = imp.items.filter(function (x) { return x.text !== null; }).map(function (x) { return [x.name, x.text]; });
    imp.report = files.length ? TRAMA_IMPORT.importFiles(files, imp.assets)[2] : [];
  }
  function entryOf(name) { return imp.report.filter(function (r) { return r.file === name; })[0] || null; }
  function importable() { return imp.report.filter(function (r) { return !r.error; }); }
  function errorText(msg) {
    if (/^es un paquete/.test(msg)) return t("imp.errPaquete");
    if (/^formato no reconocido/.test(msg)) return t("imp.errFormato");
    if (/DTD o entidades/.test(msg)) return t("imp.errDtd");
    if (/supera 50 MB/.test(msg)) return t("imp.errGrande");
    return lang() === "es" ? msg.charAt(0).toUpperCase() + msg.slice(1) : t("imp.errContenido");
  }
  function fileRow(it) {
    var e = it.error ? null : entryOf(it.name), err = it.error || (e && e.error) || null;
    var def = e && e.format ? TRAMA_IMPORT.FORMATS[e.format] : null;
    var warn = !err && e && e.warning;
    var ic = err ? "file-x" : warn ? "triangle-alert" : "file-check";
    var meta = [];
    if (def) meta.push(e.label);
    meta.push(fmtSize(it.size));
    if (e && !err) {
      meta.push(tn(e.kind === "events" ? "imp.nEventos" : "imp.nHallazgos", e.count));
      if (e.skipped) meta.push(tn("imp.nOmitidos", e.skipped));
    }
    var body = h("div", { class: "grow" }, h("b", { class: "mono", text: it.name }), h("p", { class: "sub", text: meta.join(" · ") }));
    if (err) body.appendChild(h("p", { class: "imp-err", text: errorText(err) }));
    if (err && /^es un paquete/.test(err)) {
      body.appendChild(h("button", { type: "button", class: "btn sm press mt", onclick: function () { openBundleText(it.text, it.name); } }, icon("folder-open"), t("imp.abrirPaquete")));
    }
    if (def && def[3] && !err) {
      var id = "imp-a-" + imp.items.indexOf(it);
      var input = h("input", { class: "input", id: id, type: "text", autocomplete: "off", spellcheck: "false", maxlength: "255",
        placeholder: t("imp.activoPh"), value: imp.assets[it.name] || e.asset || "",
        onchange: function () {
          var v = this.value.trim();
          if (v) imp.assets[it.name] = v; else delete imp.assets[it.name];
          analyse(); paintImport(id);
        } });
      body.appendChild(h("div", { class: "field imp-asset" }, h("label", { for: id, text: t(e.format === "auditd" ? "imp.activoAuditd" : "imp.activo") }), input,
        warn ? h("p", { class: "sub", text: t("imp.sinActivo") }) : null));
    }
    return h("li", { class: "row-item imp-row" + (err ? " bad" : warn ? " warn" : "") }, icon(ic), body,
      h("button", { type: "button", class: "icon-btn press", "aria-label": t("imp.quitar", { f: it.name }), title: t("imp.quitarT"), onclick: function () {
        imp.items = imp.items.filter(function (x) { return x !== it; });
        delete imp.assets[it.name];
        analyse(); paintImport();
        var st = $("#imp-status"); if (st) st.textContent = t("imp.quitado", { f: it.name });
      } }, icon("trash-2")));
  }
  function guideTable() {
    return h("details", { class: "imp-guide" }, h("summary", { class: "press" }, icon("info"), t("imp.guia")),
      h("table", null, h("thead", null, h("tr", null, ["imp.g.fuente", "imp.g.fichero", "imp.g.como"].map(function (k) { return h("th", { scope: "col", text: t(k) }); }))),
        h("tbody", null, GUIDE.map(function (g) {
          return h("tr", null, h("td", { "data-label": t("imp.g.fuente"), text: TRAMA_IMPORT.FORMATS[g[0]][0] }), h("td", { "data-label": t("imp.g.fichero"), class: "mono", text: g[1] }),
            h("td", { "data-label": t("imp.g.como"), class: "mono", text: g[2] }));
        }))),
      h("p", { class: "sub", text: t("imp.g.trama") }));
  }
  function paintImport(focusId) {
    var dlg = $("#dlg-import"), box = $("#imp-body", dlg);
    if (!box) return;
    var hadFocus = box.contains(document.activeElement) || document.activeElement === document.body;
    clear(box);
    var dz = h("div", { class: "dz", id: "imp-dz" }, h("span", { class: "dz-i", "aria-hidden": "true" }, icon("file-up")),
      h("div", null, h("b", { text: t("imp.soltar") }), h("p", { class: "sub", text: t("imp.formatos") })),
      h("button", { type: "button", class: "btn press", id: "imp-pick", autofocus: true, onclick: function () { $("#imp-input").click(); } }, icon("folder-open"), t("imp.elegir")));
    dz.addEventListener("dragover", function (e) { e.preventDefault(); e.stopPropagation(); dz.classList.add("over"); });
    dz.addEventListener("dragleave", function () { dz.classList.remove("over"); });
    dz.addEventListener("drop", function (e) { e.preventDefault(); e.stopPropagation(); dz.classList.remove("over"); if (e.dataTransfer) addFiles(Array.prototype.slice.call(e.dataTransfer.files)); });
    box.appendChild(dz);
    if (imp.items.length) {
      var ok = importable(), ev = 0, fi = 0;
      ok.forEach(function (r) { if (r.kind === "events") ev += r.count; else fi += r.count; });
      box.appendChild(h("div", { class: "imp-sum" }, h("b", { text: t("imp.resumen", { e: ev, f: fi }) }),
        h("span", { class: "sub", text: t("imp.ficheros", { n: ok.length, t: imp.items.length }) })));
      box.appendChild(h("ul", { class: "list", id: "imp-list", "aria-label": t("imp.lista") }, imp.items.map(fileRow)));
    }
    box.appendChild(guideTable());
    box.appendChild(h("label", { class: "check" }, h("input", { type: "checkbox", id: "imp-remember", checked: prefs.remember === false ? null : true,
      onchange: function () { prefs.remember = this.checked; save("trama-prefs", prefs); } }), h("span", null, h("b", { text: t("imp.recordar") }), h("small", { text: t("imp.recordarS") }))));
    box.appendChild(h("ol", { class: "steps", id: "imp-steps", hidden: true }));
    box.appendChild(h("div", { class: "note bad", id: "imp-fail", hidden: true }));
    hydrate(box);
    var go = $("#imp-go", dlg);
    if (go) go.disabled = imp.busy || !importable().length;
    if (focusId && $("#" + focusId)) $("#" + focusId).focus();
    else if (hadFocus && dlg.open) $("#imp-pick", dlg).focus();
  }
  function openImport(opener) {
    var dlg = $("#dlg-import");
    if (dlg.open) { paintImport(); return; }
    dlgFrame(dlg, t("imp.titulo"), [
      h("p", { class: "sub", text: t("imp.intro") }),
      h("div", { id: "imp-body", class: "imp-body" }),
      h("p", { class: "sr-only", id: "imp-status", role: "status", "aria-live": "polite" })
    ], [h("span", { class: "imp-priv" }, icon("lock"), t("imp.privado")),
      h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn press", onclick: function () { dlg.close(); } }, t("imp.cancelar")),
        h("button", { type: "button", class: "btn primary press", id: "imp-go", onclick: correlate }, icon("route"), t("imp.correlacionar")))]);
    paintImport();
    openDialog(dlg, opener || document.activeElement);
  }
  function stepRow(key, st) {
    return h("li", { class: "step " + st, "data-step": key }, icon(st === "done" ? "circle-check" : st === "fail" ? "circle-x" : st === "run" ? "loader-circle" : "clock"),
      h("span", { text: t("imp.paso." + key) }));
  }
  function correlate() {
    if (imp.busy || !importable().length) return;
    imp.busy = true;
    var dlg = $("#dlg-import"), steps = $("#imp-steps", dlg), fail = $("#imp-fail", dlg), go = $("#imp-go", dlg);
    var keys = ["detectar", "sellar", "guardar"], states = ["run", "wait", "wait"];
    go.disabled = true; fail.hidden = true; steps.hidden = false;
    function paint() { clear(steps); keys.forEach(function (k, i) { steps.appendChild(stepRow(k, states[i])); }); hydrate(steps); }
    function next(fn) { paint(); setTimeout(fn, 30); }
    function stop(err) {
      imp.busy = false; states[states.indexOf("run")] = "fail"; paint();
      fail.hidden = false; clear(fail).appendChild(icon("triangle-alert")); fail.appendChild(h("span", { text: t("imp.fallo", { e: String(err && err.message || err) }) }));
      go.disabled = false; hydrate(fail);
    }
    var files = imp.items.filter(function (x) { return x.text !== null; }).map(function (x) { return [x.name, x.text]; }), r, bundle;
    $("#imp-status").textContent = t("imp.procesando");
    next(function () {
      try { r = TRAMA_IMPORT.importFiles(files, imp.assets); } catch (e) { stop(e); return; }
      states = ["done", "run", "wait"];
      next(function () {
        try { bundle = TRAMA_ENGINE.runImported(r[0], r[1], r[2]); } catch (e) { stop(e); return; }
        states = ["done", "done", "run"];
        next(function () {
          var name = null;
          var done = function () {
            states = ["done", "done", "done"]; paint();
            imp.busy = false; imp.items = []; imp.assets = {}; imp.report = [];
            dlg.close();
            useBundle(bundle, name);
            location.hash = "#inicio";
            toast(t("imp.listo", { i: bundle.correlation_results.total_incidents_correlated, e: bundle.normalized_events.length }), "route");
          };
          if (prefs.remember === false) done(); else remember(bundle, name).then(done, done);
        });
      });
    });
  }

  /* El último análisis se guarda solo en este navegador (IndexedDB), si se ha pedido. */
  var IDB = { name: "trama", store: "analisis", key: "ultimo" };
  function idb(mode, fn) {
    return new Promise(function (resolve, reject) {
      var req;
      try { req = indexedDB.open(IDB.name, 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function () { req.result.createObjectStore(IDB.store); };
      req.onerror = function () { reject(req.error); };
      req.onsuccess = function () {
        var db = req.result, tx = db.transaction(IDB.store, mode), out = fn(tx.objectStore(IDB.store));
        tx.oncomplete = function () { db.close(); resolve(out && out.result); };
        tx.onerror = tx.onabort = function () { db.close(); reject(tx.error); };
      };
    });
  }
  function remember(b, name) {
    if (prefs.remember === false || b === ORIGINAL) return Promise.resolve();
    return idb("readwrite", function (s) { return s.put({ bundle: b, name: name, savedAt: new Date().toISOString() }, IDB.key); }).catch(function () { toast(t("imp.noGuardado"), "triangle-alert"); });
  }
  function forget() { return idb("readwrite", function (s) { return s.delete(IDB.key); }).catch(function () { /* sin almacenamiento */ }); }
  function restore() {
    return idb("readonly", function (s) { return s.get(IDB.key); }).then(function (rec) {
      if (rec && validBundle(rec.bundle)) { useBundle(rec.bundle, rec.name); toast(t("imp.restaurado", { f: rec.name }), "history"); }
    }, function () { /* sin IndexedDB (modo privado, file://) */ });
  }
  function exportBundle() {
    var b = state.bundle; if (!b) return;
    var stamp = (b.generated_at_utc || "").replace(/[-:]/g, "").replace("T", "-").slice(0, 13);
    download("trama-paquete-" + (stamp || "export") + ".json", JSON.stringify(b, null, 2) + "\n", "application/json");
    toast(t("toast.exportado"), "download");
  }

  /* ---------------------------------------------------------------- ficheros */
  function useBundle(b, fileName) {
    state.bundle = b; state.D = derive(b); state.fileName = fileName;
    state.incident = 0; state.tampered = false; state.verify = null; state.q = ""; state.src = "";
    renderChrome(); render();
  }
  /* ---------------------------------------------------------------- arranque */
  function toggleTheme() { setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark", true); }
  function toggleSide() {
    var app = $("#app");
    var wide = window.matchMedia && matchMedia("(min-width: 1181px)").matches;
    if (wide) app.classList.toggle("collapsed"); else app.classList.toggle("expanded");
    prefs.side = app.classList.contains("collapsed") ? "c" : "o"; save("trama-prefs", prefs);
    $("#collapse-btn").setAttribute("aria-expanded", String(wide ? !app.classList.contains("collapsed") : app.classList.contains("expanded")));
    setTimeout(markNav, 380);
  }
  function bind() {
    window.addEventListener("hashchange", onHash);
    window.addEventListener("resize", markNav);
    $("#theme-btn").addEventListener("click", toggleTheme);
    $$("#lang-seg button").forEach(function (b) { b.addEventListener("click", function () { setLang(b.getAttribute("data-lang")); }); });
    $("#search-btn").addEventListener("click", openSearch);
    $("#help-btn").addEventListener("click", function () { openHelp(); });
    $("#settings-btn").addEventListener("click", function () { openSettings(this); });
    $("#account-btn").addEventListener("click", function () { openProfile(this); });
    $("#pkg-btn").addEventListener("click", function () { openImport(this); });
    $("#collapse-btn").addEventListener("click", toggleSide);
    $("#file-input").addEventListener("change", function (e) { takeFiles(e.target.files); e.target.value = ""; });
    $("#imp-input").addEventListener("change", function (e) { addFiles(Array.prototype.slice.call(e.target.files)); e.target.value = ""; });
    wireDialogs();
    var drop = $("#drop");
    document.addEventListener("dragover", function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") >= 0) { e.preventDefault(); drop.textContent = t("ui.suelta"); drop.hidden = false; } });
    document.addEventListener("dragleave", function (e) { if (e.relatedTarget === null) drop.hidden = true; });
    document.addEventListener("drop", function (e) { e.preventDefault(); drop.hidden = true; if (e.dataTransfer && e.dataTransfer.files.length) takeFiles(e.dataTransfer.files); });
    document.addEventListener("keydown", function (e) {
      var k = e.key, tag = (e.target.tagName || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === "k" || k === "K")) { e.preventDefault(); if ($("#dlg-search").open) $("#dlg-search").close(); else openSearch(); return; }
      if (tag === "input" || tag === "select" || tag === "textarea" || e.ctrlKey || e.metaKey || e.altKey || $("dialog[open]")) return;
      if (k === "/") { e.preventDefault(); openSearch(); }
      else if (k >= "1" && k <= "7") location.hash = "#" + VIEWS[Number(k) - 1].id;
      else if (k === "t" || k === "T") toggleTheme();
      else if (k === "o" || k === "O") $("#file-input").click();
      else if (k === "i" || k === "I") openImport();
      else if (k === "?") openHelp();
      else if (k === "[") toggleSide();
      else if ((k === "l" || k === "L") && state.bundle) { var i = LENSES.map(function (l) { return l.id; }).indexOf(lens()); setLens(LENSES[(i + 1) % LENSES.length].id); toast(t("toast.lente", { l: t("lens." + lens() + ".rol") }), lensDef(lens()).icon); }
      else if ((k === "v" || k === "V") && state.bundle) runVerify();
      else if ((k === "j" || k === "k" || k === "J" || k === "K") && state.D && state.D.incs.length) {
        var n = state.D.incs.length; state.incident = (state.incident + (k.toLowerCase() === "j" ? 1 : n - 1)) % n;
        if (state.view !== "incidentes" && state.view !== "hilo") location.hash = "#incidentes"; else render();
      }
    });
  }
  function init() {
    hydrate(document);
    if (prefs.side === "c") $("#app").classList.add("collapsed");
    var b = window.EVIDENCE_BUNDLE;
    if (validBundle(b)) { state.bundle = b; state.D = derive(b); }
    renderChrome();
    bind();
    onHash();
    if (prefs.remember !== false) restore();
    if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) { if (!prefs.theme) { root.setAttribute("data-theme", e.matches ? "dark" : "light"); renderChrome(); } });
  }
  window.TRAMA = { t: t, lens: lens };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
