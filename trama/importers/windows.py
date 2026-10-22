"""Eventos de Windows (Security y Sysmon).

Envoltorios admitidos, todos exportables sin herramientas de pago:

- ``evtx_dump`` (crate ``evtx`` de omerbenamram), en JSON Lines (``-o jsonl``) o JSON (``-o json``,
  bloques ``Record N``): ``{"Event": {"System": {...}, "EventData": {...}}}``.
- Winlogbeat o Elastic Agent (ECS) en NDJSON: ``{"@timestamp", "winlog": {"event_id", "event_data"}}``.
- XML de ``wevtutil qe Security /f:xml`` o «Guardar como XML» del Visor de eventos.

Se traducen los identificadores que usan las reglas y los más útiles en una
investigación; el resto entra como ``event_<id>`` con sus datos originales.
"""
import json
import re

from .common import (MAX_EVENTS, UNKNOWN_HOST, child, children, clean_ip, clean_user, clip, descendants,
                     host_tag, ImportError_, iso, lines_of, attr, parse_xml, text_of, to_int)

SYSMON = "microsoft-windows-sysmon"
LOGON_ACTION = {2: "interactive_logon", 3: "network_logon", 7: "unlock_logon", 9: "new_credentials_logon",
                10: "remote_interactive_logon", 11: "cached_interactive_logon"}


def _first(value):
    """En evtx_dump un valor puede venir como {"#text": x, "#attributes": {...}}."""
    if isinstance(value, dict):
        return value.get("#text", "")
    return value


def _evtx_record(obj):
    ev = obj.get("Event") or {}
    sysd = ev.get("System") or {}
    data = ev.get("EventData") or ev.get("UserData") or {}
    if isinstance(data, dict) and isinstance(data.get("Data"), list):  # <Data> sin nombre
        data = {"Data%d" % i: _first(v) for i, v in enumerate(data["Data"])}
    if isinstance(data, dict) and len(data) == 1 and isinstance(next(iter(data.values())), dict) \
            and not data.get("#attributes"):
        inner = next(iter(data.values()))  # UserData envuelve un único elemento
        if all(not isinstance(v, (dict, list)) for v in inner.values()):
            data = inner
    created = sysd.get("TimeCreated") or {}
    attrs = created.get("#attributes", {}) if isinstance(created, dict) else {}
    provider = sysd.get("Provider") or {}
    return {
        "event_id": to_int(_first(sysd.get("EventID"))),
        "time": attrs.get("SystemTime") or "",
        "computer": clip(sysd.get("Computer"), 255),
        "record": to_int(sysd.get("EventRecordID")),
        "channel": clip(sysd.get("Channel"), 120),
        "provider": clip((provider.get("#attributes") or {}).get("Name") if isinstance(provider, dict) else provider, 120),
        "data": {k: _first(v) for k, v in (data.items() if isinstance(data, dict) else []) if k != "#attributes"},
    }


def _ecs_record(obj):
    w = obj.get("winlog") or {}
    host = obj.get("host") or {}
    return {
        "event_id": to_int(w.get("event_id")),
        "time": obj.get("@timestamp") or "",
        "computer": clip(w.get("computer_name") or host.get("name") or host.get("hostname"), 255),
        "record": to_int(w.get("record_id")),
        "channel": clip(w.get("channel"), 120),
        "provider": clip(w.get("provider_name"), 120),
        "data": dict(w.get("event_data") or {}),
    }


def _xml_record(node):
    sysn = child(node, "system")
    data = {}
    for block in ("eventdata", "userdata"):
        holder = child(node, block)
        if holder is None:
            continue
        items = children(holder, "data")
        if items:
            for i, d in enumerate(items):
                data[attr(d, "name") or "Data%d" % i] = d["text"]
        else:  # UserData: <Algo><Campo>valor</Campo></Algo>
            for wrapper in holder["children"]:
                for field in wrapper["children"]:
                    data[field["name"]] = field["text"]
    return {
        "event_id": to_int(text_of(sysn, "eventid")),
        "time": attr(child(sysn, "timecreated"), "systemtime"),
        "computer": text_of(sysn, "computer"),
        "record": to_int(text_of(sysn, "eventrecordid")),
        "channel": text_of(sysn, "channel"),
        "provider": attr(child(sysn, "provider"), "name"),
        "data": data,
    }


def _hex(value):
    v = clip(value, 20).lower()
    n = to_int(v)
    if n is not None:
        return "0x%x" % n
    if re.match(r"^0x[0-9a-f]+$", v):
        return "0x%x" % int(v, 16)
    return v or None


def _port(value):
    n = to_int(value)
    return n if n and 0 < n < 65536 else None


def map_record(rec, source_file, fmt, original):
    eid = rec["event_id"]
    if eid is None or not rec["time"]:
        return None
    d = {k: ("" if v is None else str(v)) for k, v in rec["data"].items()}

    def g(*keys):
        for k in keys:
            v = clip(d.get(k), 2000)
            if v and v != "-":
                return v
        return ""

    computer = rec["computer"] or UNKNOWN_HOST
    sysmon = SYSMON in rec["provider"].lower() or "sysmon" in rec["channel"].lower()
    ev = {"category": "windows_event", "action": "event_%d" % eid, "NativeEventID": eid, "outcome": "success"}
    actor, source, target, proc = {}, {}, {"hostname": computer}, {}

    if sysmon:
        ev["category"] = "sysmon"
        user = g("User")
        actor = {"user_name": clean_user(user), "domain": user.split("\\")[0] if "\\" in user else None}
        if eid == 1:
            ev.update(category="process_creation", action="process_creation")
            proc = {"process_name": g("Image"), "command_line": g("CommandLine"),
                    "parent_process_name": g("ParentImage"), "file_sha256": _sysmon_sha256(g("Hashes"))}
        elif eid == 3:
            ev.update(category="network_connection", action="network_connection")
            proc = {"process_name": g("Image")}
            source = {"ip": clean_ip(g("SourceIp")), "port": _port(g("SourcePort")), "hostname": computer}
            target.update(ip=clean_ip(g("DestinationIp")), port=_port(g("DestinationPort")),
                          service_name=g("DestinationHostname") or None)
        elif eid == 10:
            ev.update(category="process_access",
                      action="lsass_access" if "lsass" in g("TargetImage").lower() else "process_access")
            proc = {"process_name": g("SourceImage"), "command_line": "%s -> %s (%s)" % (
                g("SourceImage"), g("TargetImage"), g("GrantedAccess"))}
        elif eid == 11:
            ev.update(category="file_creation", action="file_creation")
            proc = {"process_name": g("Image")}
            target["resource_path"] = g("TargetFilename") or None
        else:
            ev["action"] = "sysmon_%d" % eid
    elif eid in (4768, 4769):
        ev.update(category="authentication", action="kerberos_tgs_request" if eid == 4769 else "kerberos_tgt_request")
        status = g("Status")
        if status and _hex(status) != "0x0":
            ev["outcome"] = "failure"
        actor = {"user_name": clean_user(g("TargetUserName")), "domain": g("TargetDomainName") or None}
        source = {"ip": clean_ip(g("IpAddress")), "port": _port(g("IpPort"))}
        service = g("ServiceName")
        target.update(service_name=service or None,
                      target_user_or_spn=(service.rstrip("$") if eid == 4769 else clean_user(g("TargetUserName"))) or None)
        proc = {"EffectiveTicketEncryption": _hex(g("TicketEncryptionType"))}
    elif eid in (4624, 4625):
        lt = to_int(g("LogonType"))
        ev.update(category="authentication", LogonType=lt,
                  action=LOGON_ACTION.get(lt, "logon") if eid == 4624 else "logon_failure",
                  outcome="success" if eid == 4624 else "failure")
        actor = {"user_name": clean_user(g("TargetUserName")), "domain": g("TargetDomainName") or None,
                 "user_sid": g("TargetUserSid") or None, "session_id": g("TargetLogonId") or None}
        source = {"ip": clean_ip(g("IpAddress")), "port": _port(g("IpPort")), "hostname": g("WorkstationName") or None}
        proc = {"process_name": g("ProcessName") or None}
    elif eid == 4648:
        ev.update(category="authentication", action="explicit_credential_logon")
        actor = {"user_name": clean_user(g("SubjectUserName")), "domain": g("SubjectDomainName") or None}
        source = {"ip": clean_ip(g("IpAddress")), "port": _port(g("IpPort"))}
        target.update(target_user_or_spn=clean_user(g("TargetUserName")), service_name=g("TargetServerName") or None)
        proc = {"process_name": g("ProcessName") or None}
    elif eid == 4672:
        ev.update(category="privilege_use", action="special_privileges_assigned")
        actor = {"user_name": clean_user(g("SubjectUserName")), "domain": g("SubjectDomainName") or None,
                 "privileges": [p for p in re.split(r"\s+", g("PrivilegeList")) if p]}
    elif eid == 4688:
        ev.update(category="process_creation", action="process_creation")
        actor = {"user_name": clean_user(g("SubjectUserName")), "domain": g("SubjectDomainName") or None}
        proc = {"process_name": g("NewProcessName"), "command_line": g("CommandLine") or None,
                "parent_process_name": g("ParentProcessName") or None}
    elif eid in (5140, 5145):
        ev.update(category="file_share", action="network_share_access")
        actor = {"user_name": clean_user(g("SubjectUserName")), "domain": g("SubjectDomainName") or None}
        source = {"ip": clean_ip(g("IpAddress")), "port": _port(g("IpPort"))}
        share = g("ShareName")
        rel = g("RelativeTargetName")
        target["resource_path"] = (share + ("\\" + rel if rel else "")) or None
    elif eid in (4697, 7045):
        ev.update(category="persistence", action="service_installed")
        actor = {"user_name": clean_user(g("SubjectUserName", "AccountName")), "domain": g("SubjectDomainName") or None}
        target["service_name"] = g("ServiceName") or None
        proc = {"process_name": g("ServiceFileName", "ImagePath") or None}
    elif eid == 4720:
        ev.update(category="account_management", action="user_created")
        actor = {"user_name": clean_user(g("SubjectUserName")), "domain": g("SubjectDomainName") or None}
        target["target_user_or_spn"] = clean_user(g("TargetUserName"))
    elif eid in (4728, 4732, 4756):
        ev.update(category="account_management", action="group_member_added")
        actor = {"user_name": clean_user(g("SubjectUserName")), "domain": g("SubjectDomainName") or None}
        target.update(target_user_or_spn=clean_user(g("MemberName")) or g("MemberSid") or None,
                      service_name=g("TargetUserName") or None)
    elif eid == 1102:
        ev.update(category="defense_evasion", action="audit_log_cleared")
        actor = {"user_name": clean_user(g("SubjectUserName"))}

    raw = {
        "event_id": "win-%s-%s" % (host_tag(computer), rec["record"] if rec["record"] is not None else eid),
        "timestamp_utc": iso(rec["time"]),
        "source_type": "windows_evtx",
        "source_file": source_file,
        "record_number": rec["record"],
        "event": ev,
        "actor": {k: v for k, v in actor.items() if v not in (None, "", [])},
        "source": {k: v for k, v in source.items() if v not in (None, "")},
        "target": {k: v for k, v in target.items() if v not in (None, "")},
        "process_or_artifact": {k: v for k, v in proc.items() if v not in (None, "")},
        "native": {"format": fmt, "record": original},
    }
    if sysmon:
        raw["event_id"] = "sysmon-%s-%s" % (host_tag(computer), rec["record"] if rec["record"] is not None else eid)
    return raw


def _sysmon_sha256(hashes):
    m = re.search(r"SHA256=([0-9A-Fa-f]{64})", hashes or "")
    return m.group(1).lower() if m else None


def _safe_map(rec, source_file, fmt, original):
    """Un registro con fecha ilegible se omite; no invalida el resto del fichero."""
    try:
        return map_record(rec, source_file, fmt, original)
    except ImportError_:
        return None


def _objects(text):
    """(objeto, texto original) de un fichero evtx_dump (-o json con «Record N» o -o jsonl),
    un array JSON o NDJSON. El texto original es lo que se sella; en un array se usa el objeto."""
    stripped = text.lstrip()
    if re.match(r"^Record [0-9]+\s*$", stripped.split("\n", 1)[0]):
        parts = [p.strip() for p in re.split(r"(?m)^Record [0-9]+\s*$", text) if p.strip()]
        return [(json.loads(p), p) for p in parts]
    if stripped.startswith("["):
        data = json.loads(stripped)
        return [(o, None) for o in data if isinstance(o, dict)]
    out = []
    lines = [l.strip() for l in lines_of(text) if l.strip()]
    if len(lines) > 1 and not all(l.startswith("{") and l.endswith("}") for l in lines):
        return [(json.loads(stripped), None)]  # un único objeto con saltos de línea
    for line in lines:
        out.append((json.loads(line), line))
    return out


def parse(text, source_file, asset=None):
    events, skipped = [], 0
    if text.lstrip().startswith("<"):
        root = parse_xml(text)
        nodes = descendants(root, "event")
        chunks = re.findall(r"<Event[\s>][\s\S]*?</Event>", text)
        fmt = "windows-xml"
        for i, node in enumerate(nodes):
            original = chunks[i] if len(chunks) == len(nodes) else node
            ev = _safe_map(_xml_record(node), source_file, fmt, original)
            if ev:
                events.append(ev)
            else:
                skipped += 1
    else:
        try:
            objs = _objects(text)
        except ValueError:
            raise ImportError_("JSON de eventos de Windows no válido")
        for obj, original in objs:
            if not isinstance(obj, dict):
                skipped += 1
                continue
            if "Event" in obj:
                rec, fmt = _evtx_record(obj), "evtx_dump"
            elif "winlog" in obj:
                rec, fmt = _ecs_record(obj), "winlogbeat"
            else:
                skipped += 1
                continue
            ev = _safe_map(rec, source_file, fmt, obj if original is None else original)
            if ev:
                events.append(ev)
            else:
                skipped += 1
    if len(events) > MAX_EVENTS:
        skipped += len(events) - MAX_EVENTS
        events = events[:MAX_EVENTS]
    return events, skipped
