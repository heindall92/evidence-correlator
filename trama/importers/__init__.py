"""Importación de ficheros nativos: detecta el formato por el contenido y lo traduce a TRAMA.

``detect(texto, nombre)`` devuelve el identificador del formato y ``import_files``
convierte una lista de ficheros en eventos crudos y hallazgos ofensivos listos
para ``pipeline.run_pipeline``. La consola (``docs/assets/importers.js``)
implementa lo mismo en JavaScript y ``tests/test_parity.py`` comprueba que
ambos producen exactamente el mismo resultado.
"""
import json
import re

from . import linux_web, offensive, windows
from .common import (MAX_BYTES, UNKNOWN_HOST, host_tag, ImportError_, is_ip, lines_of, ms_from_iso,
                     short_host)

FORMATS = {
    # id: (etiqueta, tipo, parser, necesita_activo)
    "windows": ("Eventos de Windows (evtx_dump, Winlogbeat o XML)", "events", windows.parse, False),
    "auditd": ("Linux auditd", "events", linux_web.parse_auditd, True),
    "access_log": ("Log de acceso web (nginx, Apache)", "events", linux_web.parse_access_log, True),
    "suricata": ("Suricata EVE JSON", "events", linux_web.parse_suricata, False),
    "nmap": ("Nmap XML", "findings", offensive.parse_nmap, False),
    "nessus": ("Nessus (.nessus)", "findings", offensive.parse_nessus, False),
    "nuclei": ("Nuclei JSONL", "findings", offensive.parse_nuclei, False),
    "burp": ("Burp Suite XML", "findings", offensive.parse_burp, False),
    "bloodhound": ("BloodHound JSON", "findings", offensive.parse_bloodhound, False),
    "linpeas": ("LinPEAS, getcap o find -perm", "findings", offensive.parse_linpeas, True),
    "trama_events": ("Eventos en formato TRAMA", "events", None, False),
    "trama_findings": ("Hallazgos en formato TRAMA", "findings", None, False),
    "trama_bundle": ("Paquete de evidencias de TRAMA", "bundle", None, False),
}


def _first_json_line(text):
    for line in lines_of(text):
        line = line.strip()
        if line:
            try:
                obj = json.loads(line)
            except ValueError:
                return None
            return obj if isinstance(obj, dict) else None
    return None


def detect(text, filename=""):
    head = text[:8000].lstrip("﻿").lstrip()
    low = head.lower()
    if head.startswith("<"):
        if "<nmaprun" in low:
            return "nmap"
        if "<nessusclientdata_v2" in low:
            return "nessus"
        if re.search(r"<issues[\s>]", low):
            return "burp"
        if "<event" in low and ("schemas.microsoft.com/win/2004/08/events" in low or "<system>" in low):
            return "windows"
        return None
    if re.match(r"^Record [0-9]+\s*$", head.split("\n", 1)[0]):
        return "windows"
    if head.startswith(("{", "[")):
        data = None
        try:
            data = json.loads(text.lstrip("﻿"))
        except ValueError:
            pass
        if isinstance(data, dict):
            if "custody_chain" in data and "generator" in data:
                return "trama_bundle"
            if isinstance(data.get("data"), list) and isinstance(data.get("meta"), dict):
                return "bloodhound"
            if "Event" in data or "winlog" in data:
                return "windows"
            if "template-id" in data:
                return "nuclei"
            if "event_type" in data:
                return "suricata"
        if isinstance(data, list) and data and isinstance(data[0], dict):
            first = data[0]
            if "finding_id" in first:
                return "trama_findings"
            if "timestamp_utc" in first and "source_type" in first:
                return "trama_events"
            if "Event" in first or "winlog" in first:
                return "windows"
            if "template-id" in first:
                return "nuclei"
        line = _first_json_line(text.lstrip("﻿"))
        if line:
            if "Event" in line or "winlog" in line:
                return "windows"
            if "template-id" in line or "matched-at" in line:
                return "nuclei"
            if "event_type" in line and "timestamp" in line:
                return "suricata"
        return None
    if re.search(r"^(?:node=\S+ )?type=[A-Za-z0-9_]+ msg=audit\(", head, re.M):
        return "auditd"
    first = next((l for l in lines_of(head) if l.strip()), "")
    if linux_web._ACCESS.match(first):
        return "access_log"
    if "linpeas" in low or "linpeas" in filename.lower() or re.search(r"^/\S+\s+(?:=\s+)?cap_[a-z_]+", head, re.M):
        return "linpeas"
    return None


def guess_asset(filename, known_hosts):
    """Activo para un fichero que no lo indica: el host conocido cuyo nombre aparece en el nombre del fichero."""
    name = (filename or "").lower()
    best, best_len = "", 0
    for host in sorted(known_hosts):
        for cand in ({host.lower()} if is_ip(host) else {host.lower(), short_host(host)}):
            if cand and len(cand) > best_len and re.search(r"(^|[^a-z0-9])%s([^a-z0-9]|$)" % re.escape(cand), name):
                best, best_len = (host if cand == host.lower() else host_tag(host)), len(cand)
    return best or None


def parse_file(text, filename, asset=None, fmt=None):
    """Un fichero a (formato, tipo, elementos, omitidos). Lanza ``ImportError_`` si no se reconoce."""
    if len(text.encode("utf-8")) > MAX_BYTES:
        raise ImportError_("el fichero supera 50 MB")
    fmt = fmt or detect(text, filename)
    if not fmt:
        raise ImportError_("formato no reconocido")
    label, kind, parser, _ = FORMATS[fmt]
    if fmt == "trama_bundle":
        return fmt, kind, json.loads(text), 0
    if parser is None:
        items = json.loads(text)
        return fmt, kind, items, 0
    try:
        items, skipped = parser(text, filename, asset)
    except ImportError_:
        raise
    except (ValueError, KeyError, TypeError, AttributeError):
        raise ImportError_("%s no válido" % label)
    return fmt, kind, items, skipped


def _hosts(items, kind):
    hosts = set()
    for it in items:
        if kind == "findings":
            if it.get("hostname"):
                hosts.add(it["hostname"])
        else:
            h = (it.get("target") or {}).get("hostname")
            if h and h != UNKNOWN_HOST:
                hosts.add(h)
    return hosts


def import_files(files, assets=None):
    """``files``: lista de (nombre, texto). ``assets``: {nombre: activo} para los ficheros sin host.

    Devuelve (eventos, hallazgos, informe). Los eventos se ordenan por tiempo y
    después por orden de fichero y de registro; los identificadores repetidos
    reciben un sufijo ``-2``, ``-3``… Así el resultado no depende del orden en
    que se suelten los ficheros dentro de la misma marca de tiempo.
    """
    assets = dict(assets or {})
    parsed, report, known = [], [], set()
    pending = []
    for idx, (name, text) in enumerate(files):
        try:
            fmt = detect(text, name)
        except Exception:  # pragma: no cover - detect no lanza
            fmt = None
        if fmt and FORMATS[fmt][3] and not assets.get(name):
            pending.append((idx, name, text, fmt))
            continue
        parsed.append(_parse_one(idx, name, text, fmt, assets.get(name), report, known))
    for idx, name, text, fmt in pending:
        asset = guess_asset(name, known)
        parsed.append(_parse_one(idx, name, text, fmt, asset, report, known))
    report.sort(key=lambda r: r["index"])
    events, findings = [], []
    for idx, kind, items in sorted((p for p in parsed if p), key=lambda p: p[0]):
        (events if kind == "events" else findings).extend((idx, n, it) for n, it in enumerate(items))
    events.sort(key=lambda t: (ms_from_iso(t[2]["timestamp_utc"]), t[0], t[1]))
    seen = {}
    out_events = []
    for _, _, ev in events:
        eid = ev.get("event_id") or "evt"
        seen[eid] = seen.get(eid, 0) + 1
        if seen[eid] > 1:
            ev = dict(ev, event_id="%s-%d" % (eid, seen[eid]))
        out_events.append(ev)
    fids = {}
    out_findings = []
    for _, _, f in findings:
        fid = f.get("finding_id") or "F"
        fids[fid] = fids.get(fid, 0) + 1
        if fids[fid] == 1:  # el mismo hallazgo en dos informes cuenta una vez
            out_findings.append(f)
    return out_events, out_findings, report


def _parse_one(idx, name, text, fmt, asset, report, known):
    entry = {"index": idx, "file": name, "format": fmt, "label": FORMATS[fmt][0] if fmt else None,
             "kind": FORMATS[fmt][1] if fmt else None, "count": 0, "skipped": 0, "asset": asset, "error": None}
    report.append(entry)
    try:
        fmt, kind, items, skipped = parse_file(text, name, asset, fmt)
    except ImportError_ as exc:
        entry["error"] = str(exc)
        return None
    if kind == "bundle":
        entry["error"] = "es un paquete ya generado; se abre directamente en la consola"
        return None
    entry.update(count=len(items), skipped=skipped)
    if FORMATS[fmt][3] and not asset and kind == "events" and fmt != "auditd":
        entry["warning"] = "sin activo: falta indicar a qué host pertenece"
    known.update(_hosts(items, kind))
    return idx, kind, items
