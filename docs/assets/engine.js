/* TRAMA · motor de correlación en el navegador.
 *
 * Traducción de trama/normalizer.py, custody.py, correlator.py y pipeline.py:
 * normaliza los eventos, los sella en la cadena de custodia (SHA-256 encadenado y
 * Merkle RFC 6962), evalúa las reglas y arma el mismo paquete que la CLI. Con el
 * mismo reloj, la CLI y la consola producen un paquete idéntico byte a byte
 * (tests/test_parity.py). Depende de sha256.js, importers.js y rules.js. */
(function (global) {
  "use strict";

  var VERSION = "0.3.0", SCHEMA_VERSION = "1.0.0", NAME = "TRAMA";
  var GENESIS_SEED = "EVIDENCE_CUSTODY_GENESIS_v1";
  var DANGEROUS_CAPS = ["cap_setuid", "cap_setgid", "cap_dac_override", "cap_sys_admin", "cap_sys_ptrace", "cap_sys_module"];
  var Sha = global.Sha256;

  function has(o, k) { return o !== null && typeof o === "object" && !Array.isArray(o) && Object.prototype.hasOwnProperty.call(o, k); }
  function get(o, k, d) { return has(o, k) ? o[k] : (d === undefined ? null : d); }
  function isDict(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function truthy(v) {
    return !(v === null || v === undefined || v === false || v === 0 || v === "" ||
             (Array.isArray(v) && v.length === 0) || (isDict(v) && Object.keys(v).length === 0));
  }
  function pyList(v) {
    if (!truthy(v)) return [];
    if (Array.isArray(v)) return v.slice();
    if (typeof v === "string") return Array.from(v);
    if (isDict(v)) return Object.keys(v);
    return [];
  }
  /** repr() de Python para los tipos de JSON (lo usa str() dentro de listas y objetos). */
  function pyRepr(v) {
    if (v === null || v === undefined) return "None";
    if (typeof v === "boolean") return v ? "True" : "False";
    if (typeof v === "number") return pyNum(v);
    if (typeof v === "string") {
      var q = v.indexOf("'") >= 0 && v.indexOf('"') < 0 ? '"' : "'";
      var body = v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
      if (q === "'") body = body.replace(/'/g, "\\'");
      return q + body + q;
    }
    if (Array.isArray(v)) return "[" + v.map(pyRepr).join(", ") + "]";
    return "{" + Object.keys(v).map(function (k) { return pyRepr(k) + ": " + pyRepr(v[k]); }).join(", ") + "}";
  }
  function pyNum(n) { return String(n); }
  function pyStr(v) { return typeof v === "string" ? v : pyRepr(v); }
  function lower(v) { return pyStr(v).toLowerCase(); }

  /* ------------------------------------------------------------------ tiempo (timeutil.py), en microsegundos */
  var ISO_RE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})[T ]([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]{1,9}))?(Z|[+-][0-9]{2}:?[0-9]{2})?$/;
  var WS_CLASS = "[\\t\\n\\x0b\\x0c\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]";
  var PY_WS = new RegExp("^" + WS_CLASS + "+|" + WS_CLASS + "+$", "g");
  function parseUtc(value) {
    var m = typeof value === "string" ? ISO_RE.exec(value.replace(PY_WS, "")) : null;
    if (!m) throw new Error("marca de tiempo no válida: " + JSON.stringify(value));
    var mo = +m[2], d = +m[3], h = +m[4], mi = +m[5], s = +m[6];
    var dt = new Date(Date.UTC(+m[1], mo - 1, d, h, mi, s));
    // datetime() de Python rechaza fechas imposibles (31 de febrero, hora 24...).
    if (mo < 1 || mo > 12 || dt.getUTCDate() !== d || h > 23 || mi > 59 || s > 59 || +m[1] < 1) throw new Error("marca de tiempo no válida: " + JSON.stringify(value));
    var micro = dt.getTime() * 1000 + parseInt(((m[7] || "0") + "000000").slice(0, 6), 10);
    var tz = m[8];
    if (tz && tz !== "Z") {
      var sign = tz[0] === "+" ? 1 : -1, digits = tz.slice(1).replace(":", "");
      micro -= sign * (parseInt(digits.slice(0, 2), 10) * 3600 + parseInt(digits.slice(2), 10) * 60) * 1e6;
    }
    return micro;
  }
  function parseWindow(window) {
    var m = /^\s*([0-9]+)\s*([smhd])\s*$/i.exec(pyStr(window));
    if (!m) throw new Error("ventana temporal no válida: " + JSON.stringify(window));
    var val = parseInt(m[1], 10);
    if (val <= 0) throw new Error("la ventana temporal debe ser positiva");
    return val * { s: 1, m: 60, h: 3600, d: 86400 }[m[2].toLowerCase()] * 1e6;
  }

  /* ------------------------------------------------------------------ custodia (custody.py) */
  function nowMicroIso() { return new Date().toISOString().replace("Z", "000Z"); }
  function sealOf(prev, rawHash, ingestedAt) { return Sha.hex(prev + "|" + rawHash + "|" + ingestedAt); }
  function CustodyChain(clock) {
    this.chain = [];
    this.genesis_hash = Sha.hex(GENESIS_SEED);
    this.clock = clock || nowMicroIso;
  }
  CustodyChain.prototype.sealEvent = function (raw, sourceType, sourceFile, recordNumber) {
    var rawHash = Sha.hex(Sha.canonicalJSON(raw));
    var prev = this.chain.length ? this.chain[this.chain.length - 1].chain_seal_sha256 : this.genesis_hash;
    var at = this.clock();
    var block = { index: this.chain.length, source_type: sourceType, source_file: sourceFile, record_number: recordNumber,
                  raw_log_sha256: rawHash, previous_node_hash: prev, chain_seal_sha256: sealOf(prev, rawHash, at), ingested_at_utc: at };
    this.chain.push(block);
    return block;
  };
  function verifyChain(chain, genesis, rawEvents, expectedHead, expectedRoot) {
    genesis = genesis || Sha.hex(GENESIS_SEED);
    var report = { valid: true, total_sealed_events: chain.length, genesis_hash: genesis, head_seal_hash: null,
                   merkle_root_sha256: null, broken_at_index: null, reason: null };
    function fail(i, reason) { report.valid = false; report.broken_at_index = i; report.reason = reason; return report; }
    if (rawEvents && rawEvents.length !== chain.length) {
      return fail(Math.min(rawEvents.length, chain.length), "número de eventos crudos (" + rawEvents.length + ") distinto del de bloques (" + chain.length + ")");
    }
    var prev = genesis;
    for (var i = 0; i < chain.length; i++) {
      var b = chain[i];
      if (get(b, "previous_node_hash") !== prev) return fail(i, "previous_node_hash no coincide con el bloque anterior");
      if (get(b, "chain_seal_sha256") !== sealOf(b.previous_node_hash, pyStr(get(b, "raw_log_sha256")), pyStr(get(b, "ingested_at_utc")))) return fail(i, "chain_seal_sha256 alterado");
      if (rawEvents && Sha.hex(Sha.canonicalJSON(rawEvents[i])) !== b.raw_log_sha256) return fail(i, "el evento crudo no coincide con raw_log_sha256");
      prev = b.chain_seal_sha256;
    }
    report.head_seal_hash = prev;
    report.merkle_root_sha256 = Sha.merkleRoot(chain.map(function (x) { return x.raw_log_sha256; }));
    if (expectedHead !== undefined && expectedHead !== null && expectedHead !== prev) return fail(chain.length, "el sello final no coincide (cadena truncada o sustituida)");
    if (expectedRoot !== undefined && expectedRoot !== null && expectedRoot !== report.merkle_root_sha256) return fail(chain.length, "la raíz de Merkle no coincide con la esperada");
    return report;
  }

  /* ------------------------------------------------------------------ normalizador (normalizer.py) */
  function isIp(text) { return !!text && (/^[0-9]+$/.test(text.split(".").join("")) || text.indexOf(":") >= 0); }
  function section(raw, key) { var v = get(raw, key); return isDict(v) ? v : {}; }
  function strOrEmpty(v) { return v === null || v === undefined ? "" : pyStr(v); }
  function pad4(n) { var s = String(n); return s.length >= 4 ? s : ("0000" + s).slice(-4); }

  function Normalizer(chain, findings) {
    var self = this;
    this.custody = chain;
    this.findings = (findings || []).slice();
    this.aliases = {};
    this.findings.forEach(function (f) {
      var names = new Set();
      [get(f, "hostname"), get(f, "ip")].forEach(function (x) { if (truthy(x)) names.add(lower(x)); });
      Array.from(names).forEach(function (n) { if (!isIp(n)) names.add(n.split(".")[0]); });
      if (names.size > 1) {
        var group = new Set(names);
        names.forEach(function (n) { (self.aliases[n] || new Set()).forEach(function (x) { group.add(x); }); });
        group.forEach(function (n) { self.aliases[n] = group; });
      }
    });
  }
  Normalizer.prototype.keys = function () {
    var keys = new Set(), self = this;
    Array.prototype.forEach.call(arguments, function (n) {
      if (!truthy(n)) return;
      n = lower(n);
      keys.add(n);
      if (!isIp(n)) keys.add(n.split(".")[0]);
      (has(self.aliases, n) ? self.aliases[n] : new Set()).forEach(function (x) { keys.add(x); });
    });
    keys.delete("unknown_host");
    return keys;
  };
  Normalizer.prototype.match = function (targetHost, targetSpn, targetBin, targetIp, domain, parentBin) {
    var out = [], self = this;
    var host = lower(targetHost || ""), eventKeys = this.keys(targetHost, targetIp);
    var dom = lower(domain || ""), spn = lower(targetSpn || "");
    this.findings.forEach(function (f) {
      if (get(f, "scope") === "domain") {
        var fd = lower(get(f, "domain") || "");
        if (!fd || !(host === fd || host.endsWith("." + fd) || dom === fd || dom === fd.split(".")[0])) return;
      } else {
        var fk = self.keys(get(f, "hostname"), get(f, "ip")), hit = false;
        fk.forEach(function (k) { if (eventKeys.has(k)) hit = true; });
        if (!hit) return;
      }
      var fSpn = get(f, "target_spn"), fBin = get(f, "binary_path");
      if (truthy(fSpn)) {
        var names = [lower(fSpn)].concat(pyList(get(f, "spns")).map(lower));
        if (spn && names.indexOf(spn) >= 0) out.push(f);
      } else if (truthy(fBin)) {
        if (fBin === targetBin || fBin === parentBin) out.push(f);
      } else out.push(f);
    });
    return out;
  };
  Normalizer.prototype.normalize = function (raw, index) {
    if (!isDict(raw)) throw new Error("evento " + index + ": se esperaba un objeto JSON");
    var ts = get(raw, "timestamp_utc");
    try { parseUtc(ts); } catch (e) { throw new Error("evento " + index + ": timestamp_utc ausente o no válido (" + JSON.stringify(ts) + ")"); }
    var block = this.custody.sealEvent(raw, get(raw, "source_type", "generic_log"), get(raw, "source_file", "unknown.log"),
                                       get(raw, "record_number", index + 1));
    var ev = section(raw, "event"), actor = section(raw, "actor"), src = section(raw, "source"),
        tgt = section(raw, "target"), proc = section(raw, "process_or_artifact");
    var targetHost = get(tgt, "hostname", "UNKNOWN_HOST"), targetSpn = get(tgt, "target_user_or_spn");
    var targetBin = get(proc, "process_name"), parentBin = get(proc, "parent_process_name");
    var exposures = this.match(targetHost, targetSpn, targetBin, get(tgt, "ip"), get(actor, "domain"), parentBin);
    var caps = pyList(get(proc, "capabilities")), suid = truthy(get(proc, "suid_bit", false));
    exposures.forEach(function (f) {
      var bp = get(f, "binary_path");
      if (truthy(bp) && (bp === targetBin || bp === parentBin)) {
        pyList(get(f, "capabilities")).forEach(function (c) { if (caps.indexOf(c) < 0) caps.push(c); });
        suid = suid || truthy(get(f, "suid"));
      }
    });
    var user = get(actor, "user_name", "anonymous"), dom = get(actor, "domain", "LOCAL");
    var srcIp = get(src, "ip") || "0.0.0.0";
    return {
      schema_version: SCHEMA_VERSION,
      event_id: get(raw, "event_id", "evt-" + pad4(index + 1)),
      timestamp_utc: ts,
      forensic_chain: block,
      event: { category: get(ev, "category", "unknown"), action: get(ev, "action", "unknown"), NativeEventID: get(ev, "NativeEventID"),
               LogonType: get(ev, "LogonType"), http_status: get(ev, "http_status"), outcome: get(ev, "outcome", "unknown"),
               severity_base: get(ev, "severity_base", 50) },
      actor: { user_name: user, user_sid: get(actor, "user_sid"), uid: strOrEmpty(get(actor, "uid")), euid: strOrEmpty(get(actor, "euid")),
               domain: dom, session_id: get(actor, "session_id"), privileges: pyList(get(actor, "privileges")) },
      source: { ip: srcIp, port: get(src, "port"), hostname: get(src, "hostname", "UNKNOWN") },
      target: { hostname: targetHost, ip: get(tgt, "ip"), port: get(tgt, "port"), service_name: get(tgt, "service_name"),
                target_user_or_spn: targetSpn, resource_path: get(tgt, "resource_path") },
      process_or_artifact: { process_name: targetBin, parent_process_name: parentBin, command_line: get(proc, "command_line"),
                             EffectiveTicketEncryption: get(proc, "EffectiveTicketEncryption"), suid_bit: suid, capabilities: caps,
                             file_sha256: get(proc, "file_sha256") },
      offensive_posture_context: { asset_criticality: exposures.length ? "HIGH" : "MEDIUM", known_exposures: exposures },
      graph_keys: { actor_node: "USER:" + pyStr(dom) + "\\" + pyStr(user), source_node: "IP:" + pyStr(srcIp),
                    target_node: truthy(targetSpn) ? "SPN:" + pyStr(targetSpn) : "HOST:" + pyStr(targetHost) }
    };
  };

  /* ------------------------------------------------------------------ correlador (correlator.py) */
  function getNested(data, path) {
    var parts = typeof path === "string" ? path.split(".") : path.slice(), cur = data;
    for (var i = 0; i < parts.length; i++) {
      if (isDict(cur)) cur = get(cur, parts[i]);
      else if (Array.isArray(cur)) {
        var rest = parts.slice(i);
        return cur.map(function (it) { return getNested(it, rest); }).filter(function (v) { return v !== null && v !== undefined; });
      } else return null;
    }
    return cur === undefined ? null : cur;
  }
  function norm(v) {
    if (typeof v === "boolean") return v ? "true" : "false";
    return v === null || v === undefined ? "" : pyStr(v);
  }
  function resolve(v, vars) { return typeof v === "string" && v[0] === "$" ? get(vars, v.slice(1)) : v; }
  function inList(actual, allowed) {
    var set = (Array.isArray(allowed) ? allowed : [allowed]).map(norm);
    if (Array.isArray(actual)) return actual.some(function (a) { return set.indexOf(norm(a)) >= 0; });
    return set.indexOf(norm(actual)) >= 0;
  }
  function entries(o) { return isDict(o) ? Object.keys(o).map(function (k) { return [k, o[k]]; }) : []; }

  function matchesStage(ev, stage, vars) {
    var expSrc = get(stage, "source_type");
    if (truthy(expSrc) && ev.forensic_chain.source_type !== expSrc) return false;
    var ok = entries(get(stage, "match", {})).every(function (kv) {
      var exp = resolve(kv[1], vars), act = getNested(ev, kv[0]);
      return Array.isArray(exp) ? inList(act, exp) : norm(act) === norm(exp);
    });
    if (!ok) return false;
    ok = entries(get(stage, "posture_condition", {})).every(function (kv) {
      var act = getNested(ev, kv[0]);
      return inList(Array.isArray(act) ? act : [act], Array.isArray(kv[1]) ? kv[1] : [kv[1]]);
    });
    if (!ok) return false;
    var p = get(stage, "predicates", {});
    ok = entries(get(p, "field_contains_any", {})).every(function (kv) {
      var text = norm(getNested(ev, kv[0])).toLowerCase();
      return kv[1].some(function (s) { return text.indexOf(pyStr(s).toLowerCase()) >= 0; });
    }) && entries(get(p, "equals_ref", {})).every(function (kv) {
      var ref = pyStr(kv[1]);
      return norm(getNested(ev, kv[0])) === norm(resolve(ref[0] === "$" ? kv[1] : "$" + ref, vars));
    }) && entries(get(p, "not_equals", {})).every(function (kv) {
      return norm(getNested(ev, kv[0])) !== norm(kv[1]);
    }) && entries(get(p, "field_in_list", {})).every(function (kv) {
      return inList(getNested(ev, kv[0]), kv[1]);
    });
    if (!ok) return false;
    if (truthy(get(p, "require_suid_or_capabilities"))) {
      var suid = truthy(getNested(ev, "process_or_artifact.suid_bit"));
      var caps = pyList(getNested(ev, "process_or_artifact.capabilities")).map(function (c) { return pyStr(c).split("+")[0].toLowerCase(); });
      if (!(suid || caps.some(function (c) { return DANGEROUS_CAPS.indexOf(c) >= 0; }))) return false;
    }
    return true;
  }
  function extract(ev, stage, vars) {
    entries(get(stage, "extract", {})).forEach(function (kv) {
      var v = getNested(ev, kv[1]);
      vars[stage.stage_id + "." + kv[0]] = v;
      vars[kv[0]] = v;
    });
  }
  function groupKey(rule, ev, vars) {
    var keys = rule.correlation.group_by || [];
    return JSON.stringify(keys.map(function (k) { return has(vars, k) ? norm(vars[k]) : norm(getNested(ev, k)); }));
  }
  function buildGraph(events) {
    var nodes = new Map(), edges = [];
    events.forEach(function (ev) {
      var gk = ev.graph_keys, exposed = ev.offensive_posture_context.known_exposures.length > 0;
      ["actor_node", "source_node", "target_node"].forEach(function (role) {
        var id = gk[role];
        if (!nodes.has(id)) nodes.set(id, { id: id, type: id.split(":")[0], events_count: 0, has_offensive_exposure: false });
        var node = nodes.get(id);
        node.events_count += 1;
        if (exposed && role === "target_node") node.has_offensive_exposure = true;
      });
      edges.push({ event_id: ev.event_id, timestamp_utc: ev.timestamp_utc, from: gk.source_node, actor: gk.actor_node, to: gk.target_node, action: ev.event.action });
    });
    return { nodes: Array.from(nodes.values()), edges: edges };
  }
  function pad2(n) { return n < 10 ? "0" + n : String(n); }
  function incident(rule, state, last, seq) {
    var m = state.events, vars = {};
    Object.keys(state.vars).forEach(function (k) { vars[k] = state.vars[k]; });
    return {
      incident_id: "INC-" + rule.id + "-" + pad2(seq), rule_id: rule.id, title: rule.title, description: get(rule, "description", ""),
      severity: rule.severity, confidence: rule.confidence, detected_at_utc: m[m.length - 1].timestamp_utc,
      attack_duration_seconds: Math.trunc((last - state.start) / 1e6),
      correlation_vars: vars,
      evidence_merkle_root_sha256: Sha.merkleRoot(m.map(function (e) { return e.forensic_chain.raw_log_sha256; })),
      correlated_events: m.map(function (e, i) {
        return { stage_id: state.stage_ids[i], event_id: e.event_id, timestamp_utc: e.timestamp_utc, source_type: e.forensic_chain.source_type,
                 action: e.event.action, actor: e.actor.user_name, source_ip: e.source.ip, target_host: e.target.hostname,
                 command_line: e.process_or_artifact.command_line, raw_log_sha256: e.forensic_chain.raw_log_sha256,
                 chain_seal_sha256: e.forensic_chain.chain_seal_sha256, offensive_exposures: e.offensive_posture_context.known_exposures };
      }),
      mitre_attack: rule.mitre_attack, grc_compliance_mapping: rule.grc_compliance_mapping
    };
  }
  function evaluateRule(rule, timeline) {
    var stages = rule.correlation.stages, window = parseWindow(rule.correlation.window);
    var active = new Map(), out = [];
    timeline.forEach(function (pair) {
      var ts = pair[0], ev = pair[1];
      Array.from(active.entries()).forEach(function (kv) {
        var key = kv[0], st = kv[1];
        if (ts - st.start > window) { active.delete(key); return; }
        var stage = stages[st.next];
        if (ev === st.events[st.events.length - 1] || !matchesStage(ev, stage, st.vars)) return;
        st.events.push(ev); st.stage_ids.push(stage.stage_id);
        extract(ev, stage, st.vars);
        st.next += 1;
        if (st.next >= stages.length) { out.push([rule, st, ts]); active.delete(key); }
      });
      if (matchesStage(ev, stages[0], {})) {
        var vars = {};
        extract(ev, stages[0], vars);
        var key = groupKey(rule, ev, vars), fresh = { start: ts, events: [ev], vars: vars, stage_ids: [stages[0].stage_id], next: 1 };
        if (stages.length === 1) out.push([rule, fresh, ts]);
        else if (!active.has(key)) active.set(key, fresh);
      }
    });
    return out;
  }
  function evaluateEvents(rules, events) {
    var timeline = events.map(function (e, i) { return [parseUtc(e.timestamp_utc), e, i]; });
    timeline.sort(function (a, b) { return a[0] - b[0] || a[2] - b[2]; });
    var incidents = [];
    rules.forEach(function (rule) {
      evaluateRule(rule, timeline).forEach(function (r, i) { incidents.push(incident(r[0], r[1], r[2], i + 1)); });
    });
    return { total_events_analyzed: timeline.length, total_incidents_correlated: incidents.length, incidents: incidents,
             entity_graph: buildGraph(timeline.map(function (p) { return p[1]; })) };
  }

  /* ------------------------------------------------------------------ paquete (pipeline.py) */
  function summarizeGrc(incidents) {
    var out = { ens_rd_311_2022: new Map(), iso_27001_2022: new Map(), nis2_directive: new Map() };
    incidents.forEach(function (inc) {
      var mapping = get(inc, "grc_compliance_mapping", {});
      Object.keys(out).forEach(function (fw) {
        (get(mapping, fw) || []).forEach(function (ctrl) {
          var cid = get(ctrl, "control_id") || get(ctrl, "article"), bucket = out[fw];
          if (!bucket.has(cid)) { var e = {}; Object.keys(ctrl).forEach(function (k) { e[k] = ctrl[k]; }); e.incidents = []; bucket.set(cid, e); }
          bucket.get(cid).incidents.push(inc.incident_id);
        });
      });
    });
    var res = {};
    Object.keys(out).forEach(function (k) { res[k] = Array.from(out[k].values()); });
    return res;
  }
  function ruleSummary(rule) {
    var found = new Set();
    (get(get(rule, "correlation", {}), "stages") || []).forEach(function (st) {
      entries(get(st, "posture_condition") || {}).forEach(function (kv) { (Array.isArray(kv[1]) ? kv[1] : [kv[1]]).forEach(function (f) { found.add(pyStr(f)); }); });
    });
    var out = {};
    ["id", "title", "severity", "confidence", "description"].forEach(function (k) { out[k] = get(rule, k); });
    out.mitre_attack = (get(rule, "mitre_attack") || []).map(function (m) { return { tactic: get(m, "tactic"), technique_id: get(m, "technique_id"), technique_name: get(m, "technique_name") }; });
    out.posture_findings = Array.from(found).sort(cpCompare);
    return out;
  }
  function cpCompare(a, b) {
    var ia = 0, ib = 0;
    while (ia < a.length && ib < b.length) {
      var ca = a.codePointAt(ia), cb = b.codePointAt(ib);
      if (ca !== cb) return ca - cb;
      ia += ca > 0xffff ? 2 : 1; ib += cb > 0xffff ? 2 : 1;
    }
    return (a.length - ia) - (b.length - ib);
  }
  function nowStamp(clockNow) { return (clockNow ? new Date(clockNow) : new Date()).toISOString().slice(0, 19) + "Z"; }

  /** Igual que pipeline.run_pipeline. opts: {clock: fn que da ingested_at, now: ms para generated_at_utc, embedRaw}. */
  function runPipeline(rawEvents, findings, rules, opts) {
    opts = opts || {};
    var chain = new CustodyChain(opts.clock), normalizer = new Normalizer(chain, findings);
    var normalized = rawEvents.map(function (ev, i) { return normalizer.normalize(ev, i); });
    var integrity = verifyChain(chain.chain, chain.genesis_hash, rawEvents);
    var correlation = evaluateEvents(rules, normalized);
    var bundle = {
      generator: { name: NAME, version: VERSION, schema_version: SCHEMA_VERSION },
      generated_at_utc: nowStamp(opts.now),
      forensic_custody_verification: integrity,
      custody_chain: chain.chain,
      offensive_findings: findings,
      rules: rules.map(ruleSummary),
      normalized_events: normalized,
      correlation_results: correlation,
      grc_summary: summarizeGrc(correlation.incidents)
    };
    if (opts.embedRaw !== false) bundle.raw_events = rawEvents;
    return bundle;
  }
  /** Igual que pipeline.run_files con ficheros: files = [[nombre, texto]], assets = {nombre: host}. */
  function runFiles(files, assets, opts) {
    var r = global.TRAMA_IMPORT.importFiles(files, assets || {}), report = r[2];
    var failed = report.filter(function (x) { return x.error; });
    if (failed.length === report.length) {
      var e = new Error("ningún fichero se pudo importar: " + failed.map(function (x) { return x.file + " (" + x.error + ")"; }).join("; "));
      e.report = report;
      throw e;
    }
    var bundle = runPipeline(r[0], r[1], (opts && opts.rules) || global.TRAMA_RULES, opts);
    bundle.dataset = "real";
    bundle.imports = report;
    return bundle;
  }

  global.TRAMA_ENGINE = {
    VERSION: VERSION, runPipeline: runPipeline, runFiles: runFiles, verifyChain: verifyChain,
    parseUtc: parseUtc, getNested: getNested, matchesStage: matchesStage
  };
})(typeof window !== "undefined" ? window : globalThis);
