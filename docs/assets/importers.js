/* TRAMA · importadores de formatos nativos en el navegador.
 *
 * Traducción línea a línea de trama/importers/*.py: mismos formatos, mismas
 * reglas de detección, mismos identificadores y marcas de tiempo. Así la consola
 * y la CLI producen el mismo paquete con los mismos ficheros (tests/test_parity.py).
 * Toda entrada se trata como hostil: XML sin DTD ni entidades, textos recortados y
 * límites de tamaño. Nada sale del navegador. */
(function (global) {
  "use strict";

  var MAX_BYTES = 50 * 1024 * 1024, MAX_EVENTS = 200000, MAX_FINDINGS = 20000, MAX_XML_NODES = 1000000;
  var UNKNOWN_HOST = "UNKNOWN_HOST";

  /* ------------------------------------------------------------------ utilidades (common.py) */
  // Los mismos espacios que str.isspace de Python (el \s de JavaScript no incluye \x1c-\x1f y sí \ufeff).
  var WS = "\\t\\n\\x0b\\x0c\\r\\x1c\\x1d\\x1e\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
  var WS_RUN = new RegExp("[" + WS + "]+", "g");
  var WS_EDGE = new RegExp("^[" + WS + "]+|[" + WS + "]+$", "g");
  var WS_LEAD = new RegExp("^[" + WS + "]+");

  function ImportError(message) { var e = new Error(message); e.importError = true; return e; }
  function has(o, k) { return o !== null && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k); }
  /** dict.get(k, d) de Python: el valor por defecto solo si falta la clave. */
  function get(o, k, d) { return has(o, k) ? o[k] : (d === undefined ? null : d); }
  function isDict(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function strip(s) { return s.replace(WS_EDGE, ""); }
  function lstrip(s) { return s.replace(WS_LEAD, ""); }
  function cpSlice(s, n) {
    if (s.length <= n) return s;
    var cps = Array.from(s);
    return cps.length <= n ? s : cps.slice(0, n).join("");
  }
  /** str(v) de Python para los tipos que aparecen en los datos. */
  function pyStr(v) {
    if (v === null || v === undefined) return "None";
    if (typeof v === "boolean") return v ? "True" : "False";
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
    return JSON.stringify(v);
  }
  function truthy(v) {
    return !(v === null || v === undefined || v === false || v === 0 || v === "" ||
             (Array.isArray(v) && v.length === 0) || (isDict(v) && Object.keys(v).length === 0));
  }
  function clip(value, size) {
    if (value === null || value === undefined) return "";
    var text = typeof value === "string" ? value : pyStr(value);
    return cpSlice(strip(text.replace(WS_RUN, " ")), size === undefined ? 400 : size);
  }
  function toInt(value) {
    if (value === null || value === undefined) return null;
    var text = strip(pyStr(value));
    return /^-?[0-9]+$/.test(text) ? parseInt(text, 10) : null;
  }
  var TS = /^([0-9]{4})-([0-9]{2})-([0-9]{2})[T ]([0-9]{2}):([0-9]{2}):([0-9]{2})(?:[.,]([0-9]+))?\s*(Z|z|[+-][0-9]{2}:?[0-9]{2})?$/;
  function isoFromMs(ms) { return new Date(ms).toISOString(); }
  function msFromIso(text) {
    var m = TS.exec(strip(pyStr(text)));
    if (!m) throw ImportError("marca de tiempo no válida: " + JSON.stringify(text));
    var y = +m[1], mo = +m[2], d = +m[3];
    var days = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
    // Fecha imposible (mes 13, 31 de febrero, 25:00) o anterior a 1970 (el 1601 de las fechas nulas de
    // Windows): se rechaza en lugar de desbordarla a otro día.
    if (!(y >= 1970 && mo >= 1 && mo <= 12 && d >= 1 && d <= days && +m[4] <= 23 && +m[5] <= 59 && +m[6] <= 59)) {
      throw ImportError("marca de tiempo no válida: " + JSON.stringify(text));
    }
    var ms = Date.UTC(y, mo - 1, d, +m[4], +m[5], +m[6]);
    ms += parseInt(((m[7] || "") + "000").slice(0, 3), 10);
    var tz = m[8];
    if (tz && tz !== "Z" && tz !== "z") {
      var sign = tz[0] === "+" ? 1 : -1, digits = tz.slice(1).replace(":", "");
      ms -= sign * (parseInt(digits.slice(0, 2), 10) * 60 + parseInt(digits.slice(2), 10)) * 60000;
    }
    return ms;
  }
  function iso(text) { return isoFromMs(msFromIso(text)); }
  function cleanIp(value) {
    var text = clip(value, 80);
    if (text.toLowerCase().indexOf("::ffff:") === 0) text = text.slice(7);
    return text === "" || text === "-" ? null : text;
  }
  function cleanUser(value) {
    var text = clip(value, 200);
    if (text.indexOf("\\") >= 0) text = text.split("\\").pop();
    if (text.indexOf("@") >= 0) text = text.split("@")[0];
    return text || null;
  }
  function linesOf(text) { return text.split("\n").map(function (l) { return l.slice(-1) === "\r" ? l.slice(0, -1) : l; }); }
  function isIp(text) {
    text = text || "";
    return /^[0-9]{1,3}(\.[0-9]{1,3}){3}$/.test(text) || (text.indexOf(":") >= 0 && /^[0-9a-fA-F:]+$/.test(text));
  }
  function hostTag(name) { return isIp(name) ? name : (name || "").split(".")[0]; }
  function shortHost(name) { return (name || "").split(".")[0].toLowerCase(); }
  function basename(p) { return (p || "").split("/").pop(); }

  /* XML: el mismo analizador que common.parse_xml (y que CTEM-Nexus). */
  var XML_NAMED = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
  function xmlEntities(text) {
    if (text.indexOf("&") < 0) return text;
    return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, function (m, e) {
      if (e[0] === "#") {
        var code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return code > 0 && code <= 0x10FFFF && !(code >= 0xD800 && code <= 0xDFFF) ? String.fromCodePoint(code) : "";
      }
      return has(XML_NAMED, e.toLowerCase()) ? XML_NAMED[e.toLowerCase()] : m;
    });
  }
  function xmlLocal(name) { var i = name.indexOf(":"); return (i >= 0 ? name.slice(i + 1) : name).toLowerCase(); }
  function parseXml(text) {
    if (/<!ENTITY/i.test(text) || /<!DOCTYPE[^>]*(\[|SYSTEM|PUBLIC)/i.test(text)) throw ImportError("XML con DTD o entidades: rechazado por seguridad");
    var root = { name: "#document", attrs: {}, children: [], text: "" };
    var stack = [root], count = 0, i = 0, n = text.length;
    var ATTR = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    while (i < n) {
      var lt = text.indexOf("<", i), endText = lt === -1 ? n : lt, end;
      if (endText > i) { var raw = text.slice(i, endText); if (strip(raw)) stack[stack.length - 1].text += xmlEntities(raw); }
      if (lt === -1) break;
      if (text.startsWith("<!--", lt)) { end = text.indexOf("-->", lt + 4); i = end === -1 ? n : end + 3; }
      else if (text.startsWith("<![CDATA[", lt)) {
        end = text.indexOf("]]>", lt + 9);
        stack[stack.length - 1].text += text.slice(lt + 9, end === -1 ? n : end);
        i = end === -1 ? n : end + 3;
      } else if (text.startsWith("<?", lt)) { end = text.indexOf("?>", lt + 2); i = end === -1 ? n : end + 2; }
      else if (text.startsWith("<!", lt)) { end = text.indexOf(">", lt + 2); i = end === -1 ? n : end + 1; }
      else if (lt + 1 < n && text[lt + 1] === "/") {
        end = text.indexOf(">", lt + 2);
        var cname = xmlLocal(strip(text.slice(lt + 2, end === -1 ? n : end)));
        for (var k = stack.length - 1; k > 0; k--) { if (stack[k].name === cname) { stack.length = k; break; } }
        i = end === -1 ? n : end + 1;
      } else {
        var j = lt + 1, q = null;
        while (j < n) {
          var c = text[j];
          if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === ">") break;
          j++;
        }
        var body = text.slice(lt + 1, j), closing = body.slice(-1) === "/", inner = closing ? body.slice(0, -1) : body;
        var mm = /^[^\s/>]+/.exec(inner);
        if (mm) {
          if (++count > MAX_XML_NODES) throw ImportError("el XML tiene demasiados elementos");
          var attrs = {}, a, rest = inner.slice(mm[0].length);
          ATTR.lastIndex = 0;
          while ((a = ATTR.exec(rest))) attrs[xmlLocal(a[1])] = xmlEntities(a[3] !== undefined ? a[3] : (a[4] || ""));
          var node = { name: xmlLocal(mm[0]), attrs: attrs, children: [], text: "" };
          stack[stack.length - 1].children.push(node);
          if (!closing) stack.push(node);
        }
        i = j + 1;
      }
    }
    return root;
  }
  function child(node, name) { var cs = node ? node.children : []; for (var i = 0; i < cs.length; i++) if (cs[i].name === name) return cs[i]; return null; }
  function children(node, name) { return node ? node.children.filter(function (c) { return c.name === name; }) : []; }
  function descendants(node, name) {
    var out = [], stack = node.children.slice().reverse();
    while (stack.length) {
      var cur = stack.pop();
      if (cur.name === name) out.push(cur);
      for (var k = cur.children.length - 1; k >= 0; k--) stack.push(cur.children[k]);
    }
    return out;
  }
  function textOf(node, name) { var t = name ? child(node, name) : node; return clip(t ? t.text : "", 4000); }
  function attr(node, name) { return node && has(node.attrs, name) ? node.attrs[name] : ""; }

  function urlDecode(text) {
    var cps = Array.from(text), bytes = [], enc = new TextEncoder();
    for (var i = 0; i < cps.length; i++) {
      var ch = cps[i];
      if (ch === "%" && i + 2 < cps.length + 0 && /^[0-9a-fA-F]{2}$/.test((cps[i + 1] || "") + (cps[i + 2] || ""))) {
        bytes.push(parseInt(cps[i + 1] + cps[i + 2], 16)); i += 2; continue;
      }
      if (ch === "+") bytes.push(32);
      else { var b = enc.encode(ch); for (var k = 0; k < b.length; k++) bytes.push(b[k]); }
    }
    return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
  }
  function classify(text) {
    var t = (text || "").toLowerCase();
    if (/sql ?injection|\bsqli\b|inyecci[oó]n sql/.test(t)) return "sqli";
    if (/kerberoast/.test(t)) return "kerberoastable_spn";
    if (/as-?rep/.test(t)) return "asrep_roastable";
    if (/remote code execution|\brce\b|command injection|ejecuci[oó]n remota/.test(t)) return "rce";
    if (/default (credential|password|login)|weak password|anonymous (login|access)|default-login/.test(t)) return "weak_credentials";
    if (/cross.site scripting|\bxss\b/.test(t)) return "xss";
    return "vulnerability";
  }
  var SEV_WORD = { critical: "CRITICAL", high: "HIGH", medium: "MEDIUM", moderate: "MEDIUM", low: "LOW", info: "INFO", information: "INFO", informational: "INFO" };
  function sev(word, d) { var w = clip(word, 20).toLowerCase(); return has(SEV_WORD, w) ? SEV_WORD[w] : (d || "MEDIUM"); }
  /** finding(...) de common.py; extra es una lista de pares [clave, valor] en el mismo orden. */
  function finding(fid, fclass, title, tool, hostname, ip, severity, description, extra) {
    var f = { finding_id: clip(fid, 200), finding_class: fclass, title: clip(title, 240), source_tool: tool,
              hostname: clip(hostname || "", 255), ip: clip(ip || "", 80), severity: severity || "MEDIUM",
              description: clip(description, 1000) };
    (extra || []).forEach(function (kv) {
      var v = kv[1];
      if (!(v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0))) f[kv[0]] = v;
    });
    return f;
  }
  function filterNone(o) { var out = {}; Object.keys(o).forEach(function (k) { if (o[k] !== null && o[k] !== undefined && o[k] !== "") out[k] = o[k]; }); return out; }
  function filterEmpty(o) {
    var out = {};
    Object.keys(o).forEach(function (k) { var v = o[k]; if (!(v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0))) out[k] = v; });
    return out;
  }
  function filterTruthy(o) { var out = {}; Object.keys(o).forEach(function (k) { if (truthy(o[k])) out[k] = o[k]; }); return out; }
  function pyHex(n) { return n < 0 ? "-" + (-n).toString(16) : n.toString(16); }

  /* ------------------------------------------------------------------ Windows (windows.py) */
  var SYSMON = "microsoft-windows-sysmon";
  var LOGON_ACTION = { 2: "interactive_logon", 3: "network_logon", 7: "unlock_logon", 9: "new_credentials_logon", 10: "remote_interactive_logon", 11: "cached_interactive_logon" };
  function first(v) { return isDict(v) ? get(v, "#text", "") : v; }

  function evtxRecord(obj) {
    var ev = get(obj, "Event") || {}, sysd = get(ev, "System") || {};
    var data = get(ev, "EventData") || get(ev, "UserData") || {};
    if (isDict(data) && Array.isArray(get(data, "Data"))) {
      var nd = {}; data.Data.forEach(function (v, i) { nd["Data" + i] = first(v); }); data = nd;
    }
    if (isDict(data)) {
      var keys = Object.keys(data);
      if (keys.length === 1 && isDict(data[keys[0]]) && !truthy(get(data, "#attributes"))) {
        var inner = data[keys[0]];
        if (Object.keys(inner).every(function (k) { var v = inner[k]; return !isDict(v) && !Array.isArray(v); })) data = inner;
      }
    }
    var created = get(sysd, "TimeCreated") || {};
    var attrs = isDict(created) ? get(created, "#attributes", {}) : {};
    var provider = get(sysd, "Provider") || {};
    var outData = {};
    if (isDict(data)) Object.keys(data).forEach(function (k) { if (k !== "#attributes") outData[k] = first(data[k]); });
    return {
      event_id: toInt(first(get(sysd, "EventID"))),
      time: get(attrs, "SystemTime") || "",
      computer: clip(get(sysd, "Computer"), 255),
      record: toInt(get(sysd, "EventRecordID")),
      channel: clip(get(sysd, "Channel"), 120),
      provider: clip(isDict(provider) ? get(get(provider, "#attributes") || {}, "Name") : provider, 120),
      data: outData
    };
  }
  function ecsRecord(obj) {
    var w = get(obj, "winlog") || {}, host = get(obj, "host") || {};
    var data = get(w, "event_data") || {}, out = {};
    Object.keys(data).forEach(function (k) { out[k] = data[k]; });
    return {
      event_id: toInt(get(w, "event_id")),
      time: get(obj, "@timestamp") || "",
      computer: clip(get(w, "computer_name") || get(host, "name") || get(host, "hostname"), 255),
      record: toInt(get(w, "record_id")),
      channel: clip(get(w, "channel"), 120),
      provider: clip(get(w, "provider_name"), 120),
      data: out
    };
  }
  function xmlRecord(node) {
    var sysn = child(node, "system"), data = {};
    ["eventdata", "userdata"].forEach(function (block) {
      var holder = child(node, block);
      if (!holder) return;
      var items = children(holder, "data");
      if (items.length) items.forEach(function (d, i) { data[attr(d, "name") || "Data" + i] = d.text; });
      else holder.children.forEach(function (wrapper) { wrapper.children.forEach(function (f) { data[f.name] = f.text; }); });
    });
    return {
      event_id: toInt(textOf(sysn, "eventid")), time: attr(child(sysn, "timecreated"), "systemtime"),
      computer: textOf(sysn, "computer"), record: toInt(textOf(sysn, "eventrecordid")),
      channel: textOf(sysn, "channel"), provider: attr(child(sysn, "provider"), "name"), data: data
    };
  }
  function hexNorm(value) {
    var v = clip(value, 20).toLowerCase(), n = toInt(v);
    if (n !== null) return "0x" + pyHex(n);
    if (/^0x[0-9a-f]+$/.test(v)) return "0x" + parseInt(v, 16).toString(16);
    return v || null;
  }
  function port(value) { var n = toInt(value); return n && n > 0 && n < 65536 ? n : null; }
  function sysmonSha(hashes) { var m = /SHA256=([0-9A-Fa-f]{64})/.exec(hashes || ""); return m ? m[1].toLowerCase() : null; }

  function mapRecord(rec, sourceFile, fmt, original) {
    var eid = rec.event_id;
    if (eid === null || !rec.time) return null;
    var d = {};
    Object.keys(rec.data).forEach(function (k) { var v = rec.data[k]; d[k] = v === null || v === undefined ? "" : pyStr(v); });
    function g() {
      for (var i = 0; i < arguments.length; i++) { var v = clip(has(d, arguments[i]) ? d[arguments[i]] : null, 2000); if (v && v !== "-") return v; }
      return "";
    }
    var computer = rec.computer || UNKNOWN_HOST;
    var sysmon = rec.provider.toLowerCase().indexOf(SYSMON) >= 0 || rec.channel.toLowerCase().indexOf("sysmon") >= 0;
    var ev = { category: "windows_event", action: "event_" + eid, NativeEventID: eid, outcome: "success" };
    var actor = {}, source = {}, target = { hostname: computer }, proc = {}, user, service, status, lt, share, rel;
    if (sysmon) {
      ev.category = "sysmon";
      user = g("User");
      actor = { user_name: cleanUser(user), domain: user.indexOf("\\") >= 0 ? user.split("\\")[0] : null };
      if (eid === 1) {
        ev.category = "process_creation"; ev.action = "process_creation";
        proc = { process_name: g("Image"), command_line: g("CommandLine"), parent_process_name: g("ParentImage"), file_sha256: sysmonSha(g("Hashes")) };
      } else if (eid === 3) {
        ev.category = "network_connection"; ev.action = "network_connection";
        proc = { process_name: g("Image") };
        source = { ip: cleanIp(g("SourceIp")), port: port(g("SourcePort")), hostname: computer };
        target.ip = cleanIp(g("DestinationIp")); target.port = port(g("DestinationPort")); target.service_name = g("DestinationHostname") || null;
      } else if (eid === 10) {
        ev.category = "process_access"; ev.action = g("TargetImage").toLowerCase().indexOf("lsass") >= 0 ? "lsass_access" : "process_access";
        proc = { process_name: g("SourceImage"), command_line: g("SourceImage") + " -> " + g("TargetImage") + " (" + g("GrantedAccess") + ")" };
      } else if (eid === 11) {
        ev.category = "file_creation"; ev.action = "file_creation";
        proc = { process_name: g("Image") };
        target.resource_path = g("TargetFilename") || null;
      } else ev.action = "sysmon_" + eid;
    } else if (eid === 4768 || eid === 4769) {
      ev.category = "authentication"; ev.action = eid === 4769 ? "kerberos_tgs_request" : "kerberos_tgt_request";
      status = g("Status");
      if (status && hexNorm(status) !== "0x0") ev.outcome = "failure";
      actor = { user_name: cleanUser(g("TargetUserName")), domain: g("TargetDomainName") || null };
      source = { ip: cleanIp(g("IpAddress")), port: port(g("IpPort")) };
      service = g("ServiceName");
      target.service_name = service || null;
      target.target_user_or_spn = (eid === 4769 ? service.replace(/\$+$/, "") : cleanUser(g("TargetUserName"))) || null;
      proc = { EffectiveTicketEncryption: hexNorm(g("TicketEncryptionType")) };
    } else if (eid === 4624 || eid === 4625) {
      lt = toInt(g("LogonType"));
      ev.category = "authentication"; ev.LogonType = lt;
      ev.action = eid === 4624 ? (has(LOGON_ACTION, lt) ? LOGON_ACTION[lt] : "logon") : "logon_failure";
      ev.outcome = eid === 4624 ? "success" : "failure";
      actor = { user_name: cleanUser(g("TargetUserName")), domain: g("TargetDomainName") || null, user_sid: g("TargetUserSid") || null, session_id: g("TargetLogonId") || null };
      source = { ip: cleanIp(g("IpAddress")), port: port(g("IpPort")), hostname: g("WorkstationName") || null };
      proc = { process_name: g("ProcessName") || null };
    } else if (eid === 4648) {
      ev.category = "authentication"; ev.action = "explicit_credential_logon";
      actor = { user_name: cleanUser(g("SubjectUserName")), domain: g("SubjectDomainName") || null };
      source = { ip: cleanIp(g("IpAddress")), port: port(g("IpPort")) };
      target.target_user_or_spn = cleanUser(g("TargetUserName")); target.service_name = g("TargetServerName") || null;
      proc = { process_name: g("ProcessName") || null };
    } else if (eid === 4672) {
      ev.category = "privilege_use"; ev.action = "special_privileges_assigned";
      actor = { user_name: cleanUser(g("SubjectUserName")), domain: g("SubjectDomainName") || null,
                privileges: g("PrivilegeList").split(/\s+/).filter(Boolean) };
    } else if (eid === 4688) {
      ev.category = "process_creation"; ev.action = "process_creation";
      actor = { user_name: cleanUser(g("SubjectUserName")), domain: g("SubjectDomainName") || null };
      proc = { process_name: g("NewProcessName"), command_line: g("CommandLine") || null, parent_process_name: g("ParentProcessName") || null };
    } else if (eid === 5140 || eid === 5145) {
      ev.category = "file_share"; ev.action = "network_share_access";
      actor = { user_name: cleanUser(g("SubjectUserName")), domain: g("SubjectDomainName") || null };
      source = { ip: cleanIp(g("IpAddress")), port: port(g("IpPort")) };
      share = g("ShareName"); rel = g("RelativeTargetName");
      target.resource_path = (share + (rel ? "\\" + rel : "")) || null;
    } else if (eid === 4697 || eid === 7045) {
      ev.category = "persistence"; ev.action = "service_installed";
      actor = { user_name: cleanUser(g("SubjectUserName", "AccountName")), domain: g("SubjectDomainName") || null };
      target.service_name = g("ServiceName") || null;
      proc = { process_name: g("ServiceFileName", "ImagePath") || null };
    } else if (eid === 4720) {
      ev.category = "account_management"; ev.action = "user_created";
      actor = { user_name: cleanUser(g("SubjectUserName")), domain: g("SubjectDomainName") || null };
      target.target_user_or_spn = cleanUser(g("TargetUserName"));
    } else if (eid === 4728 || eid === 4732 || eid === 4756) {
      ev.category = "account_management"; ev.action = "group_member_added";
      actor = { user_name: cleanUser(g("SubjectUserName")), domain: g("SubjectDomainName") || null };
      target.target_user_or_spn = cleanUser(g("MemberName")) || g("MemberSid") || null; target.service_name = g("TargetUserName") || null;
    } else if (eid === 1102) {
      ev.category = "defense_evasion"; ev.action = "audit_log_cleared";
      actor = { user_name: cleanUser(g("SubjectUserName")) };
    }
    var recId = rec.record !== null ? rec.record : eid;
    var raw = {
      event_id: (sysmon ? "sysmon-" : "win-") + hostTag(computer) + "-" + recId,
      timestamp_utc: iso(rec.time), source_type: "windows_evtx", source_file: sourceFile, record_number: rec.record,
      event: ev, actor: filterEmpty(actor), source: filterNone(source), target: filterNone(target),
      process_or_artifact: filterNone(proc), native: { format: fmt, record: original }
    };
    return raw;
  }
  function safeMap(rec, file, fmt, original) {
    try { return mapRecord(rec, file, fmt, original); } catch (e) { if (e.importError) return null; throw e; }
  }
  function winObjects(text) {
    var stripped = lstrip(text);
    if (/^Record [0-9]+\s*$/.test(stripped.split("\n")[0])) {
      return text.split(/^Record [0-9]+\s*$/m).map(strip).filter(Boolean).map(function (p) { return [JSON.parse(p), p]; });
    }
    if (stripped[0] === "[") return JSON.parse(stripped).filter(isDict).map(function (o) { return [o, null]; });
    var lines = linesOf(text).map(strip).filter(Boolean);
    if (lines.length > 1 && !lines.every(function (l) { return l[0] === "{" && l.slice(-1) === "}"; })) return [[JSON.parse(stripped), null]];
    return lines.map(function (l) { return [JSON.parse(l), l]; });
  }
  function parseWindows(text, sourceFile) {
    var events = [], skipped = 0;
    if (lstrip(text)[0] === "<") {
      var root = parseXml(text), nodes = descendants(root, "event");
      var chunks = text.match(/<Event[\s>][\s\S]*?<\/Event>/g) || [];
      nodes.forEach(function (node, i) {
        var original = chunks.length === nodes.length ? chunks[i] : node;
        var ev = safeMap(xmlRecord(node), sourceFile, "windows-xml", original);
        if (ev) events.push(ev); else skipped++;
      });
    } else {
      var objs;
      try { objs = winObjects(text); } catch (e) { throw ImportError("JSON de eventos de Windows no válido"); }
      objs.forEach(function (pair) {
        var obj = pair[0], original = pair[1], rec, fmt;
        if (!isDict(obj)) { skipped++; return; }
        if (has(obj, "Event")) { rec = evtxRecord(obj); fmt = "evtx_dump"; }
        else if (has(obj, "winlog")) { rec = ecsRecord(obj); fmt = "winlogbeat"; }
        else { skipped++; return; }
        var ev = safeMap(rec, sourceFile, fmt, original === null ? obj : original);
        if (ev) events.push(ev); else skipped++;
      });
    }
    if (events.length > MAX_EVENTS) { skipped += events.length - MAX_EVENTS; events = events.slice(0, MAX_EVENTS); }
    return [events, skipped];
  }

  /* ------------------------------------------------------------------ auditd, logs web, Suricata (linux_web.py) */
  var AUDIT_LINE = /^(?:node=(\S+) )?type=([A-Za-z0-9_]+) msg=audit\(([0-9]+)\.([0-9]+):([0-9]+)\):\s?(.*)$/;
  var UNSET = ["4294967295", "-1", "unset"];
  var ELEVATORS = ["sudo", "su", "pkexec", "doas", "runuser", "login", "sshd", "cron", "crond", "systemd"];
  function kv(text) {
    var out = {}, re = /([A-Za-z0-9_]+)=("(?:[^"\\]|\\.)*"|\S+)/g, m;
    text = text.split("\x1d").join(" ");
    while ((m = re.exec(text))) out[m[1]] = m[2][0] === '"' ? m[2].slice(1, -1) : m[2];
    return out;
  }
  function auditArg(value) {
    if (value && value.length % 2 === 0 && /^[0-9A-F]+$/.test(value)) {
      var bytes = new Uint8Array(value.length / 2);
      for (var i = 0; i < bytes.length; i++) bytes[i] = parseInt(value.substr(i * 2, 2), 16);
      return new TextDecoder("utf-8").decode(bytes).split("\x00").join(" ");
    }
    return value;
  }
  function parseAuditd(text, sourceFile, asset) {
    var groups = {}, order = [];
    linesOf(text).forEach(function (line) {
      var m = AUDIT_LINE.exec(strip(line));
      if (!m) return;
      var key = m[3] + "." + m[4] + ":" + m[5];
      if (!has(groups, key)) { groups[key] = { node: m[1] || null, records: {}, lines: [], sec: m[3], frac: m[4], serial: m[5] }; order.push(key); }
      var g = groups[key];
      g.lines.push(strip(line));
      if (!has(g.records, m[2])) g.records[m[2]] = kv(m[6]);
    });
    var events = [], skipped = 0, byPid = {};
    order.forEach(function (key) {
      var g = groups[key], sc = get(g.records, "SYSCALL"), ex = get(g.records, "EXECVE");
      if (!sc && !ex) { skipped++; return; }
      sc = sc || {};
      var pid = get(sc, "pid"), ppid = get(sc, "ppid"), exe = get(sc, "exe", "");
      var parent = (ppid !== null && has(byPid, ppid) ? byPid[ppid] : null) || {};
      if (!ex && ["59", "322", "execve", "execveat"].indexOf(get(sc, "syscall")) < 0) { skipped++; return; }
      var argc = toInt(get(ex || {}, "argc")) || 0, argv = [];
      for (var i = 0; i < argc; i++) argv.push(auditArg(get(ex || {}, "a" + i, "")));
      var uid = get(sc, "uid", ""), euid = get(sc, "euid", ""), auid = get(sc, "auid", "");
      var name = get(sc, "UID") || (uid ? "uid:" + uid : null);
      var legit = ELEVATORS.indexOf(basename(get(parent, "exe", ""))) >= 0, action, category;
      var puid = get(parent, "uid");
      if (euid === "0" && uid !== "" && uid !== "0") { action = "setuid_root_transition"; category = "privilege_escalation"; }
      else if (euid === "0" && puid !== null && puid !== "" && puid !== "0" && !legit) {
        action = "setuid_root_transition"; category = "privilege_escalation"; name = get(parent, "name") || name;
      } else if (euid === "0" && ["", "0"].concat(UNSET).indexOf(auid) < 0) {
        action = "privileged_execution"; category = "privilege_escalation"; name = get(sc, "AUID") || name;
      } else { action = "execve_syscall"; category = "process_creation"; }
      if (pid) byPid[pid] = { exe: exe, uid: uid, name: name };
      var host = g.node || asset || UNKNOWN_HOST;
      events.push({
        event_id: "aud-" + hostTag(host) + "-" + g.serial,
        timestamp_utc: isoFromMs(parseInt(g.sec, 10) * 1000 + parseInt((g.frac + "000").slice(0, 3), 10)),
        source_type: "linux_auditd", source_file: sourceFile, record_number: parseInt(g.serial, 10),
        event: { category: category, action: action, outcome: get(sc, "success", "yes") === "yes" ? "success" : "failure" },
        actor: filterTruthy({ user_name: name, uid: uid || null, euid: euid || null, auid: UNSET.indexOf(auid) < 0 ? auid : null, domain: host }),
        source: { hostname: host }, target: { hostname: host },
        process_or_artifact: filterTruthy({ process_name: exe || null, command_line: argv.filter(Boolean).join(" ") || get(sc, "comm") || null,
                                            parent_process_name: get(parent, "exe") }),
        native: { format: "auditd", record: g.lines.join("\n") }
      });
    });
    if (!events.length && !order.length) throw ImportError("no hay registros de auditd (type=… msg=audit(…))");
    var extra = Math.max(0, events.length - MAX_EVENTS);
    return [events.slice(0, MAX_EVENTS), skipped + extra];
  }

  var ACCESS = /^(\S+) \S+ (\S+) \[([^\]]+)\] "((?:[^"\\]|\\.)*)" ([0-9]{3}) (\S+)(?: "((?:[^"\\]|\\.)*)" "((?:[^"\\]|\\.)*)")?/;
  var MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  function clfTime(text) {
    var m = /^([0-9]{2})\/([A-Za-z0-9_]{3})\/([0-9]{4}):([0-9]{2}):([0-9]{2}):([0-9]{2}) ([+-][0-9]{4})$/.exec(text);
    if (!m || !has(MONTHS, m[2])) throw ImportError("fecha de log no válida: " + JSON.stringify(text));
    return iso(m[3] + "-" + String(MONTHS[m[2]]).padStart(2, "0") + "-" + m[1] + "T" + m[4] + ":" + m[5] + ":" + m[6] + m[7]);
  }
  function parseAccessLog(text, sourceFile, asset) {
    var events = [], skipped = 0, host = asset || UNKNOWN_HOST;
    linesOf(text).forEach(function (line, idx) {
      var n = idx + 1, m = ACCESS.exec(line);
      if (!m) { if (strip(line)) skipped++; return; }
      var stamp;
      try { stamp = clfTime(m[3]); } catch (e) { if (!e.importError) throw e; skipped++; return; }
      var request = m[4], parts = request.split(" ");
      var method = parts.length >= 2 ? parts[0] : "-", url = parts.length >= 2 ? parts[1] : request;
      var code = parseInt(m[5], 10), ua = m[8];
      events.push({
        event_id: "web-" + hostTag(host) + "-" + n, timestamp_utc: stamp, source_type: "web_access_log",
        source_file: sourceFile, record_number: n,
        event: { category: "web_request", action: "http_" + method.toLowerCase(), http_status: code, outcome: code < 400 ? "success" : "failure" },
        actor: { user_name: m[2] !== "-" ? m[2] : "anonymous" },
        source: filterTruthy({ ip: cleanIp(m[1]) }),
        target: { hostname: host, resource_path: clip(url.split("?")[0], 2000) },
        process_or_artifact: { command_line: clip(method + " " + urlDecode(url) + " (User-Agent: " + (ua || "-") + ")", 4000) },
        native: { format: "access_log", record: line }
      });
    });
    if (!events.length) throw ImportError("no hay líneas con formato de log de acceso (combined o common)");
    var extra = Math.max(0, events.length - MAX_EVENTS);
    return [events.slice(0, MAX_EVENTS), skipped + extra];
  }

  function parseSuricata(text, sourceFile, asset) {
    var events = [], skipped = 0, seen = 0;
    linesOf(text).forEach(function (l, i) {
      var raw = strip(l), obj;
      if (!raw) return;
      try { obj = JSON.parse(raw); } catch (e) { skipped++; return; }
      if (!isDict(obj)) { skipped++; return; }
      seen++;
      var kind = get(obj, "event_type");
      if ((kind !== "http" && kind !== "alert") || !truthy(get(obj, "timestamp"))) { skipped++; return; }
      var stamp;
      try { stamp = iso(obj.timestamp); } catch (e) { if (!e.importError) throw e; skipped++; return; }
      var http = get(obj, "http") || {}, dest = cleanIp(get(obj, "dest_ip"));
      var host = clip(get(http, "hostname"), 255) || asset || dest || UNKNOWN_HOST;
      var base = { timestamp_utc: stamp, source_file: sourceFile, record_number: i + 1, actor: { user_name: "anonymous" },
                   source: filterTruthy({ ip: cleanIp(get(obj, "src_ip")), port: toInt(get(obj, "src_port")) }),
                   native: { format: "suricata_eve", record: raw } };
      if (kind === "http") {
        var code = toInt(get(http, "status")), url = clip(get(http, "url"), 4000), method = clip(get(http, "http_method"), 20) || "-";
        base.event_id = "eve-" + hostTag(host) + "-" + (i + 1);
        base.source_type = "web_access_log";
        base.event = { category: "web_request", action: "http_" + method.toLowerCase(), http_status: code, outcome: code && code < 400 ? "success" : "failure" };
        base.target = filterTruthy({ hostname: host, ip: dest, port: toInt(get(obj, "dest_port")), resource_path: url.split("?")[0] });
        base.process_or_artifact = { command_line: method + " " + urlDecode(url) + " (User-Agent: " + (clip(get(http, "http_user_agent"), 400) || "-") + ")" };
      } else {
        var alert = get(obj, "alert") || {}, sv = toInt(get(alert, "severity"));
        base.event_id = "ids-" + hostTag(host) + "-" + (i + 1);
        base.source_type = "network_ids";
        base.event = { category: "network_alert", action: "ids_alert", outcome: "unknown", signature_id: toInt(get(alert, "signature_id")),
                       severity_base: sv === 1 ? 90 : sv === 2 ? 70 : sv === 3 ? 40 : 50 };
        base.target = filterTruthy({ hostname: host, ip: dest, port: toInt(get(obj, "dest_port")) });
        base.process_or_artifact = { command_line: clip(get(alert, "signature"), 400) || null };
      }
      events.push(base);
    });
    if (!seen) throw ImportError("no hay eventos EVE JSON de Suricata");
    var extra = Math.max(0, events.length - MAX_EVENTS);
    return [events.slice(0, MAX_EVENTS), skipped + extra];
  }

  /* ------------------------------------------------------------------ hallazgos ofensivos (offensive.py) */
  function cap(items) { return items.slice(0, MAX_FINDINGS); }

  function parseNmap(text) {
    var root = parseXml(text), out = [], skipped = 0;
    descendants(root, "host").forEach(function (h) {
      var status = child(h, "status");
      if (status && ["", "up"].indexOf(attr(status, "state")) < 0) { skipped++; return; }
      var ip = "";
      children(h, "address").some(function (a) { if (["ipv4", "ipv6"].indexOf(attr(a, "addrtype")) >= 0) { ip = attr(a, "addr"); return true; } return false; });
      var names = descendants(h, "hostname").map(function (n) { return attr(n, "name"); }).filter(Boolean);
      var hostname = names.length ? names[0] : ip;
      descendants(h, "port").forEach(function (p) {
        var st = child(p, "state");
        if (!st || attr(st, "state") !== "open") return;
        var portid = attr(p, "portid"), proto = attr(p, "protocol") || "tcp", svc = child(p, "service");
        var sa = svc ? svc.attrs : {};
        var label = [get(sa, "name"), get(sa, "product"), get(sa, "version")].filter(Boolean).join(" ");
        out.push(finding("NMAP-" + (ip || hostname) + "-" + proto + "-" + portid, "exposed_service",
          portid + "/" + proto + " abierto" + (label ? " · " + label : ""), "Nmap", hostname, ip, "INFO", "",
          [["port", toInt(portid)], ["service", clip(label, 200) || null]]));
        children(p, "script").forEach(function (sc) {
          var output = attr(sc, "output");
          if (/\bVULNERABLE\b/.test(output)) {
            var sid = attr(sc, "id") || "nse";
            out.push(finding("NMAP-" + (ip || hostname) + "-" + proto + "-" + portid + "-" + sid, classify(sid + " " + output),
              sid + " en " + portid + "/" + proto, "Nmap NSE", hostname, ip, "HIGH", clip(output, 1000), [["port", toInt(portid)]]));
          }
        });
      });
    });
    return [cap(out), skipped];
  }

  var NESSUS_SEV = { 1: "LOW", 2: "MEDIUM", 3: "HIGH", 4: "CRITICAL" };
  function parseNessus(text) {
    var root = parseXml(text), out = [], skipped = 0;
    descendants(root, "reporthost").forEach(function (rh) {
      var props = {}, hp = child(rh, "hostproperties");
      descendants(hp || rh, "tag").forEach(function (tag) { props[attr(tag, "name")] = strip(tag.text); });
      var ip = get(props, "host-ip") || attr(rh, "name");
      var hostname = get(props, "host-fqdn") || get(props, "netbios-name") || attr(rh, "name") || ip;
      children(rh, "reportitem").forEach(function (ri) {
        var level = toInt(attr(ri, "severity")) || 0;
        if (level === 0) { skipped++; return; }
        var title = attr(ri, "pluginname") || textOf(ri, "plugin_name") || "Plugin " + attr(ri, "pluginid");
        var cves = Array.from(new Set(children(ri, "cve").map(function (c) { return strip(c.text).toUpperCase(); }))).sort();
        var p = toInt(attr(ri, "port"));
        out.push(finding("NESSUS-" + (attr(ri, "pluginid") || "0") + "-" + (ip || hostname) + "-" + (p || 0), classify(title), title,
          "Nessus", hostname, ip, has(NESSUS_SEV, level) ? NESSUS_SEV[level] : "MEDIUM",
          textOf(ri, "synopsis") || textOf(ri, "description"), [["port", p || null], ["cves", cves.length ? cves : null]]));
      });
    });
    return [cap(out), skipped];
  }

  function urlParts(url) {
    var m = /^([a-z][a-z0-9+.-]*):\/\/(\[[^\]]+\]|[^/:?#]+)(?::([0-9]+))?([^?#]*)/i.exec(url || "");
    if (!m) return ["", null, ""];
    var scheme = m[1].toLowerCase();
    var p = m[3] ? parseInt(m[3], 10) : (scheme === "https" ? 443 : scheme === "http" ? 80 : null);
    return [m[2].replace(/^[\[\]]+|[\[\]]+$/g, "").toLowerCase(), p, m[4] || "/"];
  }
  function parseNuclei(text) {
    var stripped = strip(text), rows = [];
    if (stripped[0] === "[") rows = JSON.parse(stripped).filter(isDict);
    else linesOf(stripped).forEach(function (l) { l = strip(l); if (!l) return; try { var o = JSON.parse(l); if (isDict(o)) rows.push(o); } catch (e) { /* línea no JSON */ } });
    if (!rows.length) throw ImportError("no hay resultados de Nuclei (JSONL de -jsonl o JSON de -json-export)");
    var out = [], skipped = 0;
    rows.forEach(function (r) {
      var info = get(r, "info") || {}, level = clip(get(info, "severity"), 20).toLowerCase();
      if (["", "info", "unknown"].indexOf(level) >= 0) { skipped++; return; }
      var tags = get(info, "tags") || [];
      tags = (Array.isArray(tags) ? tags : pyStr(tags).split(",")).map(function (t) { return clip(t, 40).toLowerCase(); });
      var where = clip(get(r, "matched-at") || get(r, "host") || get(r, "url"), 1000);
      var up = urlParts(where.indexOf("://") >= 0 ? where : "http://" + where);
      var ip = clip(get(r, "ip"), 80), tid = clip(get(r, "template-id"), 120), title = clip(get(info, "name"), 200) || tid;
      var fclass = tags.indexOf("sqli") >= 0 ? "sqli" : classify(title + " " + tags.join(" "));
      out.push(finding("NUCLEI-" + tid + "-" + (up[0] || ip) + "-" + (up[1] || 0), fclass, title, "Nuclei", up[0], ip, sev(level),
        get(info, "description"), [["port", up[1]], ["resource_path", up[2] || null], ["template", tid || null]]));
    });
    return [cap(out), skipped];
  }

  function parseBurp(text) {
    var root = parseXml(text), out = [], skipped = 0;
    descendants(root, "issue").forEach(function (issue) {
      var level = textOf(issue, "severity");
      if (["information", "info", "false positive"].indexOf(level.toLowerCase()) >= 0) { skipped++; return; }
      var name = textOf(issue, "name"), hostNode = child(issue, "host"), url = textOf(hostNode), ip = attr(hostNode, "ip");
      var up = urlParts(url), path = textOf(issue, "path");
      out.push(finding("BURP-" + (textOf(issue, "type") || name) + "-" + (up[0] || ip) + "-" + path, classify(name), name, "Burp Suite",
        up[0], ip, sev(level), textOf(issue, "issuebackground") || textOf(issue, "issuedetail"),
        [["port", up[1]], ["resource_path", path || null]]));
    });
    return [cap(out), skipped];
  }

  function parseBloodhound(text) {
    var data = JSON.parse(text), items = isDict(data) ? get(data, "data") : null;
    if (!Array.isArray(items)) throw ImportError("no es una exportación de BloodHound (falta data)");
    var out = [], skipped = 0;
    items.forEach(function (obj) {
      var props = get(obj || {}, "Properties") || get(obj || {}, "properties") || {};
      if (!isDict(props) || get(props, "enabled") === false) { skipped++; return; }
      var name = clip(get(props, "name"), 200);
      var sam = clip(get(props, "samaccountname"), 120) || name.split("@")[0];
      var domain = clip(get(props, "domain"), 200) || (name.indexOf("@") >= 0 ? name.split("@")[1] : "");
      if (!sam) { skipped++; return; }
      var admin = truthy(get(props, "admincount"));
      if (truthy(get(props, "hasspn"))) {
        var spns = (get(props, "serviceprincipalnames") || []).map(function (s) { return clip(s, 200); });
        out.push(finding("BH-KERBEROAST-" + sam.toLowerCase() + "@" + domain.toLowerCase(), "kerberoastable_spn",
          "Cuenta «" + sam + "» con SPN: susceptible de Kerberoasting", "BloodHound", "", "", admin ? "CRITICAL" : "HIGH",
          spns.length ? "SPN: " + spns.join(", ") : "",
          [["scope", "domain"], ["domain", domain], ["target_spn", sam], ["spns", spns.length ? spns : null]]));
      }
      if (truthy(get(props, "dontreqpreauth"))) {
        out.push(finding("BH-ASREP-" + sam.toLowerCase() + "@" + domain.toLowerCase(), "asrep_roastable",
          "Cuenta «" + sam + "» sin preautenticación Kerberos", "BloodHound", "", "", admin ? "CRITICAL" : "HIGH", "",
          [["scope", "domain"], ["domain", domain], ["target_spn", sam]]));
      }
      if (!truthy(get(props, "hasspn")) && !truthy(get(props, "dontreqpreauth"))) skipped++;
    });
    return [cap(out), skipped];
  }

  var GTFOBINS = ("python python2 python3 perl ruby node php bash sh dash zsh ksh csh tcsh ash find vim vi nano less " +
    "more awk gawk nawk mawk tar zip cp mv env nmap gdb docker systemctl base64 xxd tee wget curl openssl rsync socat nc " +
    "ncat strace taskset timeout stdbuf expect lua tclsh wish busybox ed sed git make man flock ionice nice setarch " +
    "start-stop-daemon run-parts xargs time watch dd sqlite3 mysql pip").split(" ");
  var DANGEROUS_CAPS = ["cap_setuid", "cap_setgid", "cap_dac_override", "cap_dac_read_search", "cap_sys_admin",
    "cap_sys_ptrace", "cap_sys_module", "cap_chown", "cap_fowner"];
  var CAP_LINE = /^(\/\S+)\s+(?:=\s+)?(cap_[a-z_]+(?:[,+=][a-z_]+)*(?:[,+=][a-z_]+)*)\s*$/;
  var SUID_LINE = /^-[rwxsS-]{2}[sS][rwxsStT-]{6}\s.*?\s(\/\S+)$/;
  function gtfo(path) { var b = basename(path); return GTFOBINS.indexOf(b) >= 0 || GTFOBINS.indexOf(b.replace(/[0-9.]+$/, "")) >= 0; }
  function parseLinpeas(text, sourceFile, asset) {
    var clean = text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
    var m = /^\s*(?:Hostname|hostname)\s*[:=]\s*(\S+)/m.exec(clean);
    var host = m ? m[1] : (asset || ""), out = [], seen = {};
    linesOf(clean).forEach(function (line) {
      line = strip(strip(line).replace(/^[│║ ]+/, ""));
      var cm = CAP_LINE.exec(line);
      if (cm) {
        var path = cm[1], raw = cm[2];
        var caps = Array.from(new Set(raw.match(/cap_[a-z_]+/g) || [])).sort();
        var bad = caps.filter(function (c) { return DANGEROUS_CAPS.indexOf(c) >= 0; });
        if (bad.length && !seen["cap" + path]) {
          seen["cap" + path] = true;
          out.push(finding("LINPEAS-CAP-" + host + "-" + path, "dangerous_capability", path + " con " + bad.join(", "), "LinPEAS",
            host, "", gtfo(path) ? "CRITICAL" : "HIGH", raw, [["binary_path", path], ["capabilities", caps]]));
        }
        return;
      }
      var sm = SUID_LINE.exec(line);
      if (sm && gtfo(sm[1]) && !seen["suid" + sm[1]]) {
        seen["suid" + sm[1]] = true;
        out.push(finding("LINPEAS-SUID-" + host + "-" + sm[1], "suid_gtfobin", sm[1] + " con bit SUID", "LinPEAS", host, "", "HIGH",
          line, [["binary_path", sm[1]], ["suid", true]]));
      }
    });
    if (!out.length && !/linpeas|cap_[a-z_]+|-rws/i.test(clean)) throw ImportError("no hay resultados de LinPEAS, getcap ni find -perm");
    return [cap(out), 0];
  }

  /* ------------------------------------------------------------------ detección e importación (__init__.py) */
  var FORMATS = {
    windows: ["Eventos de Windows (evtx_dump, Winlogbeat o XML)", "events", parseWindows, false],
    auditd: ["Linux auditd", "events", parseAuditd, true],
    access_log: ["Log de acceso web (nginx, Apache)", "events", parseAccessLog, true],
    suricata: ["Suricata EVE JSON", "events", parseSuricata, false],
    nmap: ["Nmap XML", "findings", parseNmap, false],
    nessus: ["Nessus (.nessus)", "findings", parseNessus, false],
    nuclei: ["Nuclei JSONL", "findings", parseNuclei, false],
    burp: ["Burp Suite XML", "findings", parseBurp, false],
    bloodhound: ["BloodHound JSON", "findings", parseBloodhound, false],
    linpeas: ["LinPEAS, getcap o find -perm", "findings", parseLinpeas, true],
    trama_events: ["Eventos en formato TRAMA", "events", null, false],
    trama_findings: ["Hallazgos en formato TRAMA", "findings", null, false],
    trama_bundle: ["Paquete de evidencias de TRAMA", "bundle", null, false]
  };
  function firstJsonLine(text) {
    var lines = linesOf(text);
    for (var i = 0; i < lines.length; i++) {
      var l = strip(lines[i]);
      if (l) { try { var o = JSON.parse(l); return isDict(o) ? o : null; } catch (e) { return null; } }
    }
    return null;
  }
  function detect(text, filename) {
    var head = lstrip(text.slice(0, 8000).replace(/^\ufeff+/, "")), low = head.toLowerCase();
    if (head[0] === "<") {
      if (low.indexOf("<nmaprun") >= 0) return "nmap";
      if (low.indexOf("<nessusclientdata_v2") >= 0) return "nessus";
      if (/<issues[\s>]/.test(low)) return "burp";
      if (low.indexOf("<event") >= 0 && (low.indexOf("schemas.microsoft.com/win/2004/08/events") >= 0 || low.indexOf("<system>") >= 0)) return "windows";
      return null;
    }
    if (/^Record [0-9]+\s*$/.test(head.split("\n")[0])) return "windows";
    if (head[0] === "{" || head[0] === "[") {
      var data = null, body = text.replace(/^\ufeff+/, "");
      try { data = JSON.parse(body); } catch (e) { data = null; }
      if (isDict(data)) {
        if (has(data, "custody_chain") && has(data, "generator")) return "trama_bundle";
        if (Array.isArray(get(data, "data")) && isDict(get(data, "meta"))) return "bloodhound";
        if (has(data, "Event") || has(data, "winlog")) return "windows";
        if (has(data, "template-id")) return "nuclei";
        if (has(data, "event_type")) return "suricata";
      }
      if (Array.isArray(data) && data.length && isDict(data[0])) {
        var f = data[0];
        if (has(f, "finding_id")) return "trama_findings";
        if (has(f, "timestamp_utc") && has(f, "source_type")) return "trama_events";
        if (has(f, "Event") || has(f, "winlog")) return "windows";
        if (has(f, "template-id")) return "nuclei";
      }
      var line = firstJsonLine(body);
      if (line) {
        if (has(line, "Event") || has(line, "winlog")) return "windows";
        if (has(line, "template-id") || has(line, "matched-at")) return "nuclei";
        if (has(line, "event_type") && has(line, "timestamp")) return "suricata";
      }
      return null;
    }
    if (/^(?:node=\S+ )?type=[A-Za-z0-9_]+ msg=audit\(/m.test(head)) return "auditd";
    var firstLine = linesOf(head).filter(function (l) { return strip(l); })[0] || "";
    if (ACCESS.test(firstLine)) return "access_log";
    if (low.indexOf("linpeas") >= 0 || (filename || "").toLowerCase().indexOf("linpeas") >= 0 || /^\/\S+\s+(?:=\s+)?cap_[a-z_]+/m.test(head)) return "linpeas";
    return null;
  }
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\\/-]/g, "\\$&"); }
  function guessAsset(filename, knownHosts) {
    var name = (filename || "").toLowerCase(), best = "", bestLen = 0;
    Array.from(knownHosts).sort().forEach(function (host) {
      var cands = isIp(host) ? [host.toLowerCase()] : [host.toLowerCase(), shortHost(host)];
      cands.forEach(function (cand) {
        if (cand && cand.length > bestLen && new RegExp("(^|[^a-z0-9])" + escapeRe(cand) + "([^a-z0-9]|$)").test(name)) {
          best = cand === host.toLowerCase() ? host : hostTag(host); bestLen = cand.length;
        }
      });
    });
    return best || null;
  }
  function parseFile(text, filename, asset, fmt) {
    if (new TextEncoder().encode(text).length > MAX_BYTES) throw ImportError("el fichero supera 50 MB");
    fmt = fmt || detect(text, filename);
    if (!fmt) throw ImportError("formato no reconocido");
    var def = FORMATS[fmt], label = def[0], kind = def[1], parser = def[2];
    if (fmt === "trama_bundle") return [fmt, kind, JSON.parse(text), 0];
    if (!parser) return [fmt, kind, JSON.parse(text), 0];
    var r;
    try { r = parser(text, filename, asset || null); }
    catch (e) { if (e.importError) throw e; throw ImportError(label + " no válido"); }
    return [fmt, kind, r[0], r[1]];
  }
  function hostsOf(items, kind) {
    var hosts = new Set();
    items.forEach(function (it) {
      if (kind === "findings") { if (it.hostname) hosts.add(it.hostname); }
      else { var h = (it.target || {}).hostname; if (h && h !== UNKNOWN_HOST) hosts.add(h); }
    });
    return hosts;
  }
  function parseOne(idx, name, text, fmt, asset, report, known) {
    var entry = { index: idx, file: name, format: fmt, label: fmt ? FORMATS[fmt][0] : null, kind: fmt ? FORMATS[fmt][1] : null,
                  count: 0, skipped: 0, asset: asset || null, error: null };
    report.push(entry);
    var r;
    try { r = parseFile(text, name, asset, fmt); } catch (e) { if (!e.importError) throw e; entry.error = e.message; return null; }
    if (r[1] === "bundle") { entry.error = "es un paquete ya generado; se abre directamente en la consola"; return null; }
    entry.count = r[2].length; entry.skipped = r[3];
    if (FORMATS[r[0]][3] && !asset && r[1] === "events" && r[0] !== "auditd") entry.warning = "sin activo: falta indicar a qué host pertenece";
    hostsOf(r[2], r[1]).forEach(function (h) { known.add(h); });
    return [idx, r[1], r[2]];
  }
  /** files: [[nombre, texto], ...]; assets: {nombre: host}. Devuelve [eventos, hallazgos, informe]. */
  function importFiles(files, assets) {
    assets = assets || {};
    var parsed = [], report = [], known = new Set(), pending = [];
    files.forEach(function (f, idx) {
      var fmt = detect(f[1], f[0]);
      if (fmt && FORMATS[fmt][3] && !assets[f[0]]) { pending.push([idx, f[0], f[1], fmt]); return; }
      parsed.push(parseOne(idx, f[0], f[1], fmt, assets[f[0]] || null, report, known));
    });
    pending.forEach(function (p) { parsed.push(parseOne(p[0], p[1], p[2], p[3], guessAsset(p[1], known), report, known)); });
    report.sort(function (a, b) { return a.index - b.index; });
    var events = [], findings = [];
    parsed.filter(Boolean).sort(function (a, b) { return a[0] - b[0]; }).forEach(function (p) {
      p[2].forEach(function (it, n) { (p[1] === "events" ? events : findings).push([p[0], n, it]); });
    });
    events.forEach(function (t) { t.push(msFromIso(t[2].timestamp_utc)); });
    events.sort(function (a, b) { return a[3] - b[3] || a[0] - b[0] || a[1] - b[1]; });
    var seen = {}, outEvents = events.map(function (t) {
      var ev = t[2], eid = ev.event_id || "evt";
      seen[eid] = (seen[eid] || 0) + 1;
      if (seen[eid] > 1) { var copy = {}; Object.keys(ev).forEach(function (k) { copy[k] = ev[k]; }); copy.event_id = eid + "-" + seen[eid]; return copy; }
      return ev;
    });
    var fids = {}, outFindings = [];
    findings.forEach(function (t) { var fid = t[2].finding_id || "F"; fids[fid] = (fids[fid] || 0) + 1; if (fids[fid] === 1) outFindings.push(t[2]); });
    return [outEvents, outFindings, report];
  }

  global.TRAMA_IMPORT = {
    FORMATS: FORMATS, detect: detect, parseFile: parseFile, importFiles: importFiles, guessAsset: guessAsset,
    util: { clip: clip, iso: iso, msFromIso: msFromIso, urlDecode: urlDecode, parseXml: parseXml, classify: classify, get: get, has: has, isIp: isIp }
  };
})(typeof window !== "undefined" ? window : globalThis);
