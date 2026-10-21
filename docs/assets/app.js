/* Consola de evidencias: lógica de la interfaz.
 * Todo el contenido del paquete se inserta con textContent (nunca innerHTML),
 * porque un paquete abierto por el usuario es una entrada no confiable. */
(function () {
  "use strict";

  var ICONS = window.LUCIDE_ICONS || {};
  var SVGNS = "http://www.w3.org/2000/svg";
  var VIEWS = ["resumen", "incidentes", "cumplimiento", "custodia", "eventos", "grafo"];
  var FRAMEWORKS = [
    { key: "ens_rd_311_2022", label: "ENS · RD 311/2022", short: "ENS" },
    { key: "iso_27001_2022", label: "ISO/IEC 27001:2022", short: "ISO 27001" },
    { key: "nis2_directive", label: "NIS2", short: "NIS2" }
  ];

  var state = { bundle: null, incident: 0, framework: FRAMEWORKS[0].key, tampered: false, lastView: "resumen" };

  /* ---------- utilidades ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function icon(name, cls) {
    var svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.75");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", "ico" + (cls ? " " + cls : ""));
    // Marcado propio y fijo (vendorizado), nunca datos del paquete.
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
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) el.appendChild(typeof x === "string" ? document.createTextNode(x) : x); });
      else el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    }
    return el;
  }

  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function hydrateIcons(root) {
    $$("[data-icon]", root).forEach(function (el) {
      if (!el.firstChild) el.appendChild(icon(el.getAttribute("data-icon")));
    });
  }
  function short(hash, n) { hash = String(hash || ""); n = n || 10; return hash.length > n * 2 ? hash.slice(0, n) + "…" + hash.slice(-6) : hash; }
  function hhmmss(ts) { var m = /T(\d{2}:\d{2}:\d{2})/.exec(ts || ""); return m ? m[1] : String(ts || ""); }
  function fmtDuration(s) { s = Number(s) || 0; var m = Math.floor(s / 60); return m ? m + " min " + (s % 60) + " s" : s + " s"; }
  function sevLabel(s) { return { CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Media", LOW: "Baja" }[s] || String(s); }
  function verdictClass(v) { return /CRITICO|MAJOR/.test(String(v)) ? "v-crit" : "v-nc"; }
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  /* ---------- preferencias ---------- */
  function loadPrefs() { try { return JSON.parse(localStorage.getItem("prefs") || "{}"); } catch (e) { return {}; } }
  function savePrefs(p) { try { localStorage.setItem("prefs", JSON.stringify(p)); } catch (e) { /* sin almacenamiento */ } }
  var prefs = loadPrefs();
  function effectiveTheme() {
    var t = prefs.theme || "system";
    return t === "system" ? (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t;
  }
  function applyPrefs() {
    var d = document.documentElement, theme = effectiveTheme();
    d.setAttribute("data-theme", theme);
    d.setAttribute("data-accent", prefs.accent || "blue");
    d.setAttribute("data-density", prefs.density || "comfortable");
    var btn = $("#btn-theme");
    clear(btn).appendChild(icon(theme === "dark" ? "sun" : "moon"));
    btn.setAttribute("aria-label", theme === "dark" ? "Cambiar a tema claro (T)" : "Cambiar a tema oscuro (T)");
    var form = $("#settings-form");
    ["theme", "accent", "density"].forEach(function (k) {
      var def = { theme: "system", accent: "blue", density: "comfortable" }[k];
      var input = form.querySelector('input[name="' + k + '"][value="' + (prefs[k] || def) + '"]');
      if (input) input.checked = true;
    });
  }
  function toggleTheme() { prefs.theme = effectiveTheme() === "dark" ? "light" : "dark"; savePrefs(prefs); applyPrefs(); }

  /* ---------- datos ---------- */
  function validBundle(b) {
    return b && typeof b === "object" && b.correlation_results && Array.isArray(b.correlation_results.incidents) &&
      Array.isArray(b.normalized_events) && b.forensic_custody_verification;
  }
  function chainOf(b) { return b.custody_chain || b.normalized_events.map(function (e) { return e.forensic_chain; }); }
  function incidents() { return state.bundle.correlation_results.incidents; }
  function eventsInIncidents() {
    var map = {};
    incidents().forEach(function (inc, i) { inc.correlated_events.forEach(function (ev) { (map[ev.event_id] = map[ev.event_id] || []).push(i); }); });
    return map;
  }
  function grcSummary() {
    if (state.bundle.grc_summary) return state.bundle.grc_summary;
    var out = {};
    FRAMEWORKS.forEach(function (f) { out[f.key] = []; });
    incidents().forEach(function (inc) {
      FRAMEWORKS.forEach(function (f) {
        (inc.grc_compliance_mapping[f.key] || []).forEach(function (c) {
          var id = c.control_id || c.article, found = out[f.key].filter(function (x) { return (x.control_id || x.article) === id; })[0];
          if (!found) { found = Object.assign({}, c, { incidents: [] }); out[f.key].push(found); }
          found.incidents.push(inc.incident_id);
        });
      });
    });
    return out;
  }

  /* ---------- vistas ---------- */
  function renderAll() {
    var b = state.bundle, gen = b.generator || {};
    $("#brand-version").textContent = gen.version ? "v" + gen.version : (b.engine_version ? "v" + b.engine_version : "");
    $("#bundle-meta").textContent = "Paquete generado " + (b.generated_at_utc || "—").replace("T", " ").replace("Z", " UTC");
    renderSummary(); renderIncidentList(); renderIncident(); renderFrameworkTabs(); renderFramework();
    renderCustody(null); renderEvents(); renderGraph();
  }

  function renderSummary() {
    var b = state.bundle, incs = incidents(), cust = b.forensic_custody_verification, grc = grcSummary();
    var crit = incs.filter(function (i) { return i.severity === "CRITICAL"; }).length;
    var nc = FRAMEWORKS.reduce(function (n, f) { return n + (grc[f.key] || []).length; }, 0);
    $("#summary-lede").textContent = incs.length + " incidentes correlacionados a partir de " +
      b.correlation_results.total_events_analyzed + " eventos y " + (b.offensive_findings || []).length +
      " hallazgos ofensivos. La cadena de custodia " + (cust.valid ? "es íntegra." : "está comprometida.");
    var stats = clear($("#stats"));
    [["Eventos sellados", cust.total_sealed_events, ""],
     ["Incidentes", incs.length, "", crit + " críticos"],
     ["No conformidades", nc, ""],
     ["Custodia", cust.valid ? "Íntegra" : "Rota", cust.valid ? "ok" : "bad"]].forEach(function (s) {
      stats.appendChild(h("div", null, h("dt", { text: s[0] }), h("dd", { class: s[2] }, String(s[1]), s[3] ? h("small", { text: s[3] }) : null)));
    });
    var inInc = eventsInIncidents(), tl = clear($("#timeline"));
    b.normalized_events.slice().sort(function (a, c) { return a.timestamp_utc < c.timestamp_utc ? -1 : 1; }).forEach(function (ev) {
      var refs = inInc[ev.event_id] || [];
      tl.appendChild(h("li", { class: refs.length ? "in-inc" : "" },
        h("time", { datetime: ev.timestamp_utc, text: hhmmss(ev.timestamp_utc) }),
        h("span", { class: "dot", "aria-hidden": "true" }),
        h("div", null,
          h("div", { class: "t-title", text: ev.event.action + " · " + ev.target.hostname }),
          h("div", { class: "t-meta" }, ev.forensic_chain.source_type + " · " + ev.actor.user_name,
            refs.map(function (i) { return [" · ", h("a", { href: "#incidentes", text: incs[i].incident_id, onclick: function () { state.incident = i; } })]; })
              .reduce(function (a, x) { return a.concat(x); }, [])))));
    });
    var fw = clear($("#fw-list"));
    FRAMEWORKS.forEach(function (f) {
      var list = grc[f.key] || [];
      fw.appendChild(h("li", null, h("span", { text: f.label }), h("strong", { text: String(list.length) })));
    });
    var seen = {}, tac = clear($("#tactics"));
    incs.forEach(function (inc) { inc.mitre_attack.forEach(function (m) {
      if (seen[m.technique_id]) return; seen[m.technique_id] = 1;
      tac.appendChild(h("li", { class: "chip", title: m.technique_name }, h("span", { class: "mono", text: m.technique_id }), m.tactic));
    }); });
  }

  function renderIncidentList() {
    var list = clear($("#inc-list"));
    if (!incidents().length) { list.appendChild(h("li", { class: "empty", text: "No hay incidentes en este paquete." })); return; }
    incidents().forEach(function (inc, i) {
      list.appendChild(h("li", null, h("button", {
        type: "button", class: "inc-btn", "aria-pressed": String(i === state.incident),
        onclick: function () { state.incident = i; renderIncidentList(); renderIncident(); }
      },
        h("span", { class: "row1" }, h("span", { class: "id", text: inc.incident_id }), h("span", { class: "sev sev-" + inc.severity, text: sevLabel(inc.severity) })),
        h("span", { class: "title", text: inc.title }))));
    });
  }

  function renderIncident() {
    var box = clear($("#inc-detail")), inc = incidents()[state.incident];
    if (!inc) { box.appendChild(h("p", { class: "empty", text: "Selecciona un incidente." })); return; }
    box.appendChild(h("span", { class: "sev sev-" + inc.severity }, icon("siren"), "Severidad " + sevLabel(inc.severity).toLowerCase()));
    box.appendChild(h("h2", { text: inc.title }));
    if (inc.description) box.appendChild(h("p", { class: "lede", text: inc.description }));
    box.appendChild(h("div", { class: "meta-row" },
      h("span", null, icon("hash"), h("span", { class: "mono", text: inc.rule_id })),
      h("span", null, icon("target"), "Confianza " + Math.round(inc.confidence * 100) + " %"),
      h("span", null, icon("clock"), "Cadena de " + fmtDuration(inc.attack_duration_seconds)),
      h("span", null, icon("check"), "Detectado " + hhmmss(inc.detected_at_utc) + " UTC")));

    box.appendChild(h("h3", { class: "section-label", text: "Etapas correlacionadas" }));
    var ol = h("ol", { class: "stages" });
    inc.correlated_events.forEach(function (ev, i) {
      ol.appendChild(h("li", { class: "stage" },
        h("span", { class: "stage-n", "aria-hidden": "true", text: String(i + 1) }),
        h("div", { class: "stage-body" },
          h("div", { class: "s-top" }, h("strong", { text: "Etapa " + (i + 1) + ": " + ev.action }), h("span", { class: "s-time", text: ev.timestamp_utc })),
          h("div", { class: "t-meta", text: ev.actor + " desde " + ev.source_ip + " → " + ev.target_host + " (" + (ev.source_type || "") + ")" }),
          ev.command_line ? h("code", { class: "cmd", text: ev.command_line }) : null,
          (ev.offensive_exposures || []).map(function (x) {
            return h("div", { class: "exposure" }, icon("triangle-alert"), h("span", null, h("strong", { text: x.finding_id }), " · " + x.description));
          }),
          h("div", { class: "hashline mono", text: "SHA-256 " + ev.raw_log_sha256 }))));
    });
    box.appendChild(ol);

    box.appendChild(h("h3", { class: "section-label", text: "MITRE ATT&CK" }));
    box.appendChild(h("ul", { class: "chips" }, inc.mitre_attack.map(function (m) {
      return h("li", { class: "chip" }, h("span", { class: "mono", text: m.technique_id }), m.technique_name);
    })));

    box.appendChild(h("h3", { class: "section-label", text: "Dictamen de cumplimiento" }));
    var rows = [];
    FRAMEWORKS.forEach(function (f) { (inc.grc_compliance_mapping[f.key] || []).forEach(function (c) {
      rows.push(h("tr", null, h("td", { text: f.short }), h("td", { class: "mono", text: c.control_id || c.article }),
        h("td", { text: c.control_name || c.topic || "" }),
        h("td", null, c.audit_verdict ? h("span", { class: "verdict-tag " + verdictClass(c.audit_verdict), text: c.audit_verdict }) : "—")));
    }); });
    box.appendChild(h("div", { class: "table-wrap", tabindex: "0", role: "region", "aria-label": "Dictamen de cumplimiento" }, h("table", { class: "ctrl-table" },
      h("thead", null, h("tr", null, h("th", { scope: "col", text: "Marco" }), h("th", { scope: "col", text: "Control" }), h("th", { scope: "col", text: "Descripción" }), h("th", { scope: "col", text: "Dictamen" }))),
      h("tbody", null, rows))));
    box.appendChild(h("div", { class: "merkle" }, icon("fingerprint"), h("span", null, "Raíz de Merkle del paquete de evidencias: ", h("span", { class: "mono", text: inc.evidence_merkle_root_sha256 }))));
  }

  function renderFrameworkTabs() {
    var tabs = clear($("#fw-tabs")), grc = grcSummary();
    FRAMEWORKS.forEach(function (f) {
      var sel = f.key === state.framework;
      tabs.appendChild(h("button", {
        type: "button", role: "tab", class: "tab", id: "tab-" + f.key, "aria-selected": String(sel), "aria-controls": "fw-panel", tabindex: sel ? "0" : "-1",
        onclick: function () { state.framework = f.key; renderFrameworkTabs(); renderFramework(); }
      }, f.label, h("span", { class: "n", text: String((grc[f.key] || []).length) })));
    });
  }
  function renderFramework() {
    var panel = clear($("#fw-panel")), list = grcSummary()[state.framework] || [];
    panel.setAttribute("aria-labelledby", "tab-" + state.framework);
    if (!list.length) { panel.appendChild(h("p", { class: "empty", text: "Sin no conformidades en este marco." })); return; }
    var nis = state.framework === "nis2_directive";
    var head = nis ? ["Artículo", "Ámbito", "Incidentes"] : ["Control", "Nombre", "Dictamen", "Evidencia", "Incidentes"];
    panel.appendChild(h("div", { class: "table-wrap", tabindex: "0", role: "region", "aria-label": "Tabla de no conformidades" }, h("table", { class: "data" },
      h("caption", { class: "sr-only", text: "No conformidades" }),
      h("thead", null, h("tr", null, head.map(function (x) { return h("th", { scope: "col", text: x }); }))),
      h("tbody", null, list.map(function (c) {
        var incCell = h("td", null, c.incidents.map(function (id, k) { return h("span", null, k ? ", " : "", h("span", { class: "mono", text: id })); }));
        return nis ? h("tr", null, h("td", { class: "mono", text: c.article }), h("td", { class: "wrap", text: c.topic }), incCell)
          : h("tr", null, h("td", { class: "mono", text: c.control_id }), h("td", { text: c.control_name }),
              h("td", null, h("span", { class: "verdict-tag " + verdictClass(c.audit_verdict), text: c.audit_verdict })),
              h("td", { class: "wrap", text: c.evidence_summary || "—" }), incCell);
      })))));
  }
  function exportCSV() {
    var grc = grcSummary(), lines = [["marco", "control", "nombre", "dictamen", "evidencia", "incidentes"]];
    FRAMEWORKS.forEach(function (f) { (grc[f.key] || []).forEach(function (c) {
      lines.push([f.short, c.control_id || c.article, c.control_name || c.topic || "", c.audit_verdict || "", c.evidence_summary || "", c.incidents.join(" ")]);
    }); });
    var csv = lines.map(function (r) { return r.map(function (v) {
      v = String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; // evita inyección de fórmulas
      return '"' + v.replace(/"/g, '""') + '"';
    }).join(","); }).join("\r\n");
    var a = h("a", { href: URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" })), download: "no_conformidades.csv" });
    document.body.appendChild(a); a.click(); a.remove();
    toast("CSV exportado");
  }

  /* ---------- custodia ---------- */
  function verifyInBrowser() {
    var b = state.bundle, chain = JSON.parse(JSON.stringify(chainOf(b))), raws = b.raw_events;
    if (state.tampered && chain.length > 1) chain[1].raw_log_sha256 = chain[1].raw_log_sha256.replace(/^./, function (c) { return c === "0" ? "1" : "0"; });
    var stored = b.forensic_custody_verification, prev = stored.genesis_hash, rows = [], broken = null, reason = "";
    chain.forEach(function (blk, i) {
      var ok = true;
      if (broken === null) {
        if (blk.previous_node_hash !== prev) { ok = false; reason = "el enlace con el bloque anterior no coincide"; }
        else if (Sha256.hex(blk.previous_node_hash + "|" + blk.raw_log_sha256 + "|" + blk.ingested_at_utc) !== blk.chain_seal_sha256) { ok = false; reason = "el sello del bloque no coincide con su contenido"; }
        else if (raws && raws[i] && Sha256.hex(Sha256.canonicalJSON(raws[i])) !== blk.raw_log_sha256) { ok = false; reason = "el evento crudo no coincide con su hash"; }
        if (!ok) broken = i;
        prev = blk.chain_seal_sha256;
      }
      rows.push(broken === null ? "ok" : (broken === i ? "bad" : "skip"));
    });
    var root = Sha256.merkleRoot(chain.map(function (x) { return x.raw_log_sha256; }));
    if (broken === null && root !== stored.merkle_root_sha256) { broken = chain.length; reason = "la raíz de Merkle no coincide con la registrada"; }
    return { valid: broken === null, broken: broken, reason: reason, rows: rows, root: root, rawChecked: !!raws };
  }
  function renderCustody(result) {
    var b = state.bundle, stored = b.forensic_custody_verification, v = clear($("#verdict"));
    if (!result) {
      v.className = "verdict idle";
      v.appendChild(icon("shield-check"));
      v.appendChild(h("span", null, "Pulsa «Verificar ahora» para recalcular los sellos en este navegador.", h("small", { text: "Estado registrado por la CLI: " + (stored.valid ? "íntegra" : "comprometida") + "." })));
    } else if (result.valid) {
      v.className = "verdict ok";
      v.appendChild(icon("circle-check"));
      v.appendChild(h("span", null, "Cadena íntegra: " + result.rows.length + " sellos y raíz de Merkle verificados.",
        h("small", { text: result.rawChecked ? "También se ha recalculado el hash de cada evento crudo." : "El paquete no incluye eventos crudos; se verifican sellos y raíz." })));
    } else {
      v.className = "verdict bad";
      v.appendChild(icon("circle-x"));
      v.appendChild(h("span", null, "Manipulación detectada en el bloque " + result.broken + ": " + result.reason + ".",
        h("small", { text: state.tampered ? "Resultado de la simulación: se alteró un byte del bloque 1 en memoria." : "Revisa el origen del paquete." })));
    }
    var hs = clear($("#hashes"));
    [["Génesis", stored.genesis_hash], ["Sello final", stored.head_seal_hash], ["Raíz de Merkle", result ? result.root : stored.merkle_root_sha256]].forEach(function (x) {
      hs.appendChild(h("div", null, h("dt", { text: x[0] }), h("dd", { text: x[1] || "—" })));
    });
    var tb = clear($("#chain-table tbody"));
    chainOf(b).forEach(function (blk, i) {
      var st = result ? result.rows[i] : null;
      tb.appendChild(h("tr", { class: st === "bad" ? "bad" : "" },
        h("td", { class: "mono", text: String(i) }), h("td", { text: blk.source_type }),
        h("td", { class: "mono", text: blk.source_file + " #" + blk.record_number }),
        h("td", { class: "hash", title: blk.raw_log_sha256, text: short(blk.raw_log_sha256) }),
        h("td", { class: "hash", title: blk.chain_seal_sha256, text: short(blk.chain_seal_sha256) }),
        h("td", null, st === null ? h("span", { class: "t-meta", text: "Sin verificar" }) :
          st === "ok" ? h("span", { class: "status-ok" }, icon("check"), "Válido") :
          st === "bad" ? h("span", { class: "status-bad" }, icon("x"), "Alterado") : h("span", { class: "t-meta", text: "No verificable" }))));
    });
  }
  function runVerify() { var r = verifyInBrowser(); renderCustody(r); toast(r.valid ? "Cadena verificada" : "Manipulación detectada"); }

  /* ---------- eventos ---------- */
  function renderEvents() {
    var sel = $("#src-filter"), cur = sel.value, types = {};
    state.bundle.normalized_events.forEach(function (e) { types[e.forensic_chain.source_type] = 1; });
    clear(sel).appendChild(h("option", { value: "", text: "Todos" }));
    Object.keys(types).sort().forEach(function (t) { sel.appendChild(h("option", { value: t, text: t })); });
    sel.value = types[cur] ? cur : "";
    var tb = clear($("#ev-table tbody")), inInc = eventsInIncidents(), shown = 0;
    state.bundle.normalized_events.forEach(function (e) {
      if (sel.value && e.forensic_chain.source_type !== sel.value) return;
      shown++;
      var exp = e.offensive_posture_context.known_exposures || [];
      var detail = h("tr", { class: "detail-row", hidden: true }, h("td", { colspan: "7" }, h("pre", { class: "json", text: JSON.stringify(e, null, 2) })));
      var btn = h("button", { type: "button", class: "link-btn", "aria-expanded": "false", "aria-label": "Ver JSON de " + e.event_id }, icon("chevron-right"));
      btn.addEventListener("click", function () {
        var open = detail.hidden; detail.hidden = !open; btn.setAttribute("aria-expanded", String(open));
        btn.firstChild.style.transform = open ? "rotate(90deg)" : "";
      });
      tb.appendChild(h("tr", { class: inInc[e.event_id] ? "hit" : "", id: "ev-" + e.event_id },
        h("td", { class: "mono", "data-label": "Hora", text: hhmmss(e.timestamp_utc) }), h("td", { "data-label": "Origen", text: e.forensic_chain.source_type }),
        h("td", { "data-label": "Acción", text: e.event.action }), h("td", { "data-label": "Actor", text: e.actor.user_name }), h("td", { "data-label": "Destino", text: e.target.hostname }),
        h("td", { "data-label": "Exposición" }, exp.length ? h("span", { class: "sev sev-HIGH", text: exp.map(function (x) { return x.finding_id; }).join(", ") }) : "—"),
        h("td", null, btn)));
      tb.appendChild(detail);
    });
    $("#ev-count").textContent = shown + " de " + state.bundle.normalized_events.length + " eventos";
  }

  /* ---------- grafo ---------- */
  function renderGraph() {
    var g = state.bundle.correlation_results.entity_graph, box = clear($("#graph"));
    var cols = [{ title: "Origen", match: function (n) { return n.type === "IP"; } },
                { title: "Actor", match: function (n) { return n.type === "USER"; } },
                { title: "Destino", match: function (n) { return n.type === "HOST" || n.type === "SPN"; } }];
    var W = 960, colX = [40, 360, 680], nodeW = 240, nodeH = 34, gap = 14, top = 44, pos = {}, maxRows = 0;
    var nodesByCol = cols.map(function (c) { return g.nodes.filter(c.match); });
    nodesByCol.forEach(function (l) { maxRows = Math.max(maxRows, l.length); });
    var H = top + maxRows * (nodeH + gap) + 10;
    var svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Grafo de entidades: " + g.nodes.length + " nodos y " + g.edges.length + " relaciones. La tabla siguiente contiene los mismos datos.");
    function el(tag, attrs, text) { var e = document.createElementNS(SVGNS, tag); Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (text) e.textContent = text; return e; }
    cols.forEach(function (c, i) { svg.appendChild(el("text", { x: colX[i], y: 20, class: "g-col" }, c.title)); });
    nodesByCol.forEach(function (list, ci) {
      list.forEach(function (n, ri) { pos[n.id] = { x: colX[ci], y: top + ri * (nodeH + gap) }; });
    });
    var edgeLayer = el("g", {});
    svg.appendChild(edgeLayer);
    function curve(a, b) {
      var x1 = a.x + nodeW, y1 = a.y + nodeH / 2, x2 = b.x, y2 = b.y + nodeH / 2, mx = (x1 + x2) / 2;
      return "M" + x1 + " " + y1 + " C" + mx + " " + y1 + " " + mx + " " + y2 + " " + x2 + " " + y2;
    }
    g.edges.forEach(function (e) {
      if (pos[e.from] && pos[e.actor]) edgeLayer.appendChild(el("path", { d: curve(pos[e.from], pos[e.actor]), class: "g-edge" }));
      if (pos[e.actor] && pos[e.to]) edgeLayer.appendChild(el("path", { d: curve(pos[e.actor], pos[e.to]), class: "g-edge" }));
    });
    g.nodes.forEach(function (n) {
      var p = pos[n.id]; if (!p) return;
      var label = n.id.replace(/^[A-Z]+:/, ""); if (label.length > 30) label = label.slice(0, 29) + "…";
      var grp = el("g", { class: "g-node" + (n.has_offensive_exposure ? " exposed" : ""), transform: "translate(" + p.x + "," + p.y + ")" });
      grp.appendChild(el("rect", { width: nodeW, height: nodeH, rx: 8 }));
      grp.appendChild(el("text", { x: 12, y: 22 }, label));
      grp.appendChild(el("title", {}, n.id + " · " + n.events_count + " eventos" + (n.has_offensive_exposure ? " · exposición ofensiva conocida" : "")));
      svg.appendChild(grp);
    });
    box.appendChild(svg);
    var tb = clear($("#edge-table tbody"));
    g.edges.forEach(function (e) {
      tb.appendChild(h("tr", null, h("td", { class: "mono", text: hhmmss(e.timestamp_utc) }), h("td", { class: "mono", text: e.from }),
        h("td", { class: "mono", text: e.actor }), h("td", { class: "mono", text: e.to }), h("td", { text: e.action })));
    });
  }

  /* ---------- búsqueda ---------- */
  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) { showView(state.lastView, true); return; }
    var res = [], b = state.bundle;
    incidents().forEach(function (inc, i) {
      if (JSON.stringify(inc).toLowerCase().indexOf(q) >= 0) res.push({ kind: "Incidente", title: inc.incident_id + " · " + inc.title, sub: inc.rule_id, go: function () { state.incident = i; location.hash = "#incidentes"; } });
    });
    var grc = grcSummary();
    FRAMEWORKS.forEach(function (f) { (grc[f.key] || []).forEach(function (c) {
      if (JSON.stringify(c).toLowerCase().indexOf(q) >= 0) res.push({ kind: f.label, title: (c.control_id || c.article) + " · " + (c.control_name || c.topic), sub: c.evidence_summary || "", go: function () { state.framework = f.key; location.hash = "#cumplimiento"; } });
    }); });
    b.normalized_events.forEach(function (e) {
      if (JSON.stringify(e).toLowerCase().indexOf(q) >= 0) res.push({ kind: "Evento", title: e.event_id + " · " + e.event.action, sub: e.forensic_chain.raw_log_sha256, go: function () { location.hash = "#eventos"; } });
    });
    showView("search", true);
    $("#search-lede").textContent = res.length + " resultados para «" + q + "»";
    var ul = clear($("#results"));
    if (!res.length) ul.appendChild(h("li", { class: "empty", text: "Sin coincidencias. Prueba con un id de evento, un control (op.acc.5) o parte de un hash." }));
    res.slice(0, 100).forEach(function (r) {
      ul.appendChild(h("li", null, h("a", { href: "#", onclick: function (ev) { ev.preventDefault(); $("#q").value = ""; r.go(); } },
        h("span", { class: "r-kind", text: r.kind }), h("span", { text: r.title }), r.sub ? h("span", { class: "r-sub mono", text: r.sub }) : null)));
    });
  }

  /* ---------- navegación ---------- */
  function showView(name, keepSearch) {
    if (VIEWS.indexOf(name) < 0 && name !== "search") name = "resumen";
    if (name !== "search") state.lastView = name;
    $$(".view").forEach(function (v) { v.hidden = v.id !== "view-" + name; });
    $$(".sidenav a").forEach(function (a) {
      if (a.getAttribute("data-view") === name) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (name === "incidentes") { renderIncidentList(); renderIncident(); }
    if (name === "cumplimiento") { renderFrameworkTabs(); renderFramework(); }
    if (!keepSearch) $("#q").value = "";
    var title = { search: "Búsqueda" }[name] || name.charAt(0).toUpperCase() + name.slice(1);
    document.title = title + " · PROYECTO";
  }
  function onHash() { showView((location.hash || "#resumen").slice(1)); var m = $("#main"); if (document.activeElement && document.activeElement.closest && document.activeElement.closest(".sidenav")) m.focus({ preventScroll: true }); }

  /* ---------- carga de ficheros ---------- */
  function loadFile(file) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { toast("El fichero supera 50 MB"); return; }
    var r = new FileReader();
    r.onload = function () {
      try {
        var b = JSON.parse(r.result);
        if (!validBundle(b)) throw new Error("estructura");
        state.bundle = b; state.incident = 0; state.tampered = false;
        $("#btn-tamper").setAttribute("aria-pressed", "false");
        renderAll(); toast("Paquete cargado: " + file.name);
      } catch (e) { toast("No es un paquete de evidencias válido"); }
    };
    r.readAsText(file);
  }

  /* ---------- arranque ---------- */
  function init() {
    hydrateIcons(document);
    applyPrefs();
    if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { if ((prefs.theme || "system") === "system") applyPrefs(); });
    var b = window.EVIDENCE_BUNDLE;
    if (!validBundle(b)) {
      clear($("#main")).appendChild(h("section", { class: "view" }, h("h1", { text: "No hay datos" }),
        h("p", { class: "lede" }, "Genera el paquete con ", h("code", { text: "python3 -m proyecto run --dashboard-js docs/data/bundle.js" }), " o abre un fichero JSON con el botón de la barra superior.")));
      bindChrome(); return;
    }
    state.bundle = b;
    renderAll();
    bindChrome();
    onHash();
  }

  function bindChrome() {
    window.addEventListener("hashchange", onHash);
    $("#btn-theme").addEventListener("click", toggleTheme);
    $("#btn-open").addEventListener("click", function () { $("#file-input").click(); });
    $("#file-input").addEventListener("change", function (e) { loadFile(e.target.files[0]); e.target.value = ""; });
    $$("[data-dialog]").forEach(function (btn) { btn.addEventListener("click", function () { $("#" + btn.getAttribute("data-dialog")).showModal(); }); });
    $$("dialog").forEach(function (d) {
      d.addEventListener("click", function (e) { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
    });
    $("#settings-form").addEventListener("change", function (e) { prefs[e.target.name] = e.target.value; savePrefs(prefs); applyPrefs(); });
    if (!state.bundle) return;
    $("#btn-verify").addEventListener("click", runVerify);
    $("#btn-tamper").addEventListener("click", function () {
      state.tampered = !state.tampered; this.setAttribute("aria-pressed", String(state.tampered)); runVerify();
    });
    $("#btn-csv").addEventListener("click", exportCSV);
    $("#src-filter").addEventListener("change", renderEvents);
    var qt; $("#q").addEventListener("input", function (e) { clearTimeout(qt); var v = e.target.value; qt = setTimeout(function () { search(v); }, 120); });
    $("#fw-tabs").addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var i = FRAMEWORKS.map(function (f) { return f.key; }).indexOf(state.framework);
      i = (i + (e.key === "ArrowRight" ? 1 : FRAMEWORKS.length - 1)) % FRAMEWORKS.length;
      state.framework = FRAMEWORKS[i].key; renderFrameworkTabs(); renderFramework(); $("#tab-" + state.framework).focus();
    });
    var net = $("#net-status");
    function updNet() {
      var on = navigator.onLine; clear(net).appendChild(icon(on ? "wifi" : "wifi-off"));
      net.appendChild(h("span", { class: "net-label", text: on ? "Local" : "Sin conexión" }));
      net.title = (on ? "Con conexión, pero" : "Sin conexión:") + " la consola no usa la red";
    }
    window.addEventListener("online", updNet); window.addEventListener("offline", updNet); updNet();
    ["dragenter", "dragover"].forEach(function (t) { document.addEventListener(t, function (e) { e.preventDefault(); $("#drop-hint").hidden = false; }); });
    ["dragleave", "drop"].forEach(function (t) { document.addEventListener(t, function (e) { e.preventDefault(); if (t === "drop" || e.relatedTarget === null) $("#drop-hint").hidden = true; if (t === "drop") loadFile(e.dataTransfer.files[0]); }); });
    document.addEventListener("keydown", function (e) {
      var tag = (e.target.tagName || "").toLowerCase();
      if (e.key === "Escape" && e.target.id === "q") { e.target.value = ""; search(""); e.target.blur(); return; }
      if (tag === "input" || tag === "select" || tag === "textarea" || e.metaKey || e.ctrlKey || e.altKey || $("dialog[open]")) return;
      var k = e.key;
      if (k === "/") { e.preventDefault(); $("#q").focus(); }
      else if (k >= "1" && k <= "6") location.hash = "#" + VIEWS[Number(k) - 1];
      else if (k === "t" || k === "T") toggleTheme();
      else if (k === "o" || k === "O") $("#file-input").click();
      else if (k === "v" || k === "V") { location.hash = "#custodia"; runVerify(); }
      else if (k === "?") $("#dlg-shortcuts").showModal();
      else if ((k === "j" || k === "k") && incidents().length) {
        state.incident = (state.incident + (k === "j" ? 1 : incidents().length - 1)) % incidents().length;
        if (location.hash !== "#incidentes") location.hash = "#incidentes"; else { renderIncidentList(); renderIncident(); }
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
