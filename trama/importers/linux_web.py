"""Telemetría de Linux y web: auditd, logs de acceso (nginx, Apache) y Suricata EVE JSON."""
import json
import os
import re

from .common import (MAX_EVENTS, UNKNOWN_HOST, clean_ip, clip, host_tag, ImportError_, iso, iso_from_ms,
                     lines_of, to_int, url_decode)

# --------------------------------------------------------------------------- auditd

_AUDIT_LINE = re.compile(r"^(?:node=(\S+) )?type=(\w+) msg=audit\((\d+)\.(\d+):(\d+)\):\s?(.*)$")
_KV = re.compile(r"(\w+)=(\"(?:[^\"\\]|\\.)*\"|\S+)")
_HEX = re.compile(r"^[0-9A-F]+$")
UNSET = ("4294967295", "-1", "unset")
ELEVATORS = {"sudo", "su", "pkexec", "doas", "runuser", "login", "sshd", "cron", "crond", "systemd"}


def _kv(text):
    out = {}
    for k, v in _KV.findall(text.replace("\x1d", " ")):
        out[k] = v[1:-1] if v.startswith('"') else v
    return out


def _arg(value):
    """auditd escribe en hexadecimal los argumentos con espacios o caracteres no imprimibles."""
    if value and len(value) % 2 == 0 and _HEX.match(value):
        try:
            return bytes.fromhex(value).decode("utf-8", "replace").replace("\x00", " ")
        except ValueError:
            return value
    return value


def parse_auditd(text, source_file, asset=None):
    groups, order = {}, []
    for line in lines_of(text):
        m = _AUDIT_LINE.match(line.strip())
        if not m:
            continue
        node, rtype, sec, frac, serial, rest = m.groups()
        key = (sec, frac, serial)
        if key not in groups:
            groups[key] = {"node": node, "records": {}, "lines": []}
            order.append(key)
        g = groups[key]
        g["lines"].append(line.strip())
        g["records"].setdefault(rtype, _kv(rest))
    events, skipped, exe_by_pid = [], 0, {}
    for key in order:
        g = groups[key]
        sc = g["records"].get("SYSCALL")
        ex = g["records"].get("EXECVE")
        if not sc and not ex:
            skipped += 1
            continue
        sc = sc or {}
        pid, ppid = sc.get("pid"), sc.get("ppid")
        exe = sc.get("exe", "")
        parent = exe_by_pid.get(ppid) or {}
        if not ex and sc.get("syscall") not in ("59", "322", "execve", "execveat"):
            skipped += 1
            continue
        argc = to_int((ex or {}).get("argc")) or 0
        argv = [_arg((ex or {}).get("a%d" % i, "")) for i in range(argc)]
        uid, euid, auid = sc.get("uid", ""), sc.get("euid", ""), sc.get("auid", "")
        name = sc.get("UID") or ("uid:%s" % uid if uid else None)
        legit = os.path.basename(parent.get("exe", "")) in ELEVATORS
        if euid == "0" and uid not in ("", "0"):
            # euid 0 con uid sin privilegios: binario SUID o capability en uso.
            action, category = "setuid_root_transition", "privilege_escalation"
        elif euid == "0" and parent.get("uid") not in (None, "", "0") and not legit:
            # El padre no era root y no es sudo/su/pkexec: el proceso cambió de UID a 0
            # (setuid con capability). Se atribuye a la cuenta del padre.
            action, category = "setuid_root_transition", "privilege_escalation"
            name = parent.get("name") or name
        elif euid == "0" and auid not in ("", "0") + UNSET:
            action, category = "privileged_execution", "privilege_escalation"
            name = sc.get("AUID") or name
        else:
            action, category = "execve_syscall", "process_creation"
        if pid:
            exe_by_pid[pid] = {"exe": exe, "uid": uid, "name": name}
        sec, frac, serial = key
        host = g["node"] or asset or UNKNOWN_HOST
        events.append({
            "event_id": "aud-%s-%s" % (host_tag(host), serial),
            "timestamp_utc": iso_from_ms(int(sec) * 1000 + int((frac + "000")[:3])),
            "source_type": "linux_auditd",
            "source_file": source_file,
            "record_number": int(serial),
            "event": {"category": category, "action": action,
                      "outcome": "success" if sc.get("success", "yes") == "yes" else "failure"},
            "actor": {k: v for k, v in {"user_name": name, "uid": uid or None, "euid": euid or None,
                                        "auid": auid if auid not in UNSET else None,
                                        "domain": host}.items() if v},
            "source": {"hostname": host},
            "target": {"hostname": host},
            "process_or_artifact": {k: v for k, v in {
                "process_name": exe or None,
                "command_line": " ".join(a for a in argv if a) or sc.get("comm") or None,
                "parent_process_name": parent.get("exe")}.items() if v},
            "native": {"format": "auditd", "record": "\n".join(g["lines"])},
        })
    if not events and not order:
        raise ImportError_("no hay registros de auditd (type=… msg=audit(…))")
    return events[:MAX_EVENTS], skipped + max(0, len(events) - MAX_EVENTS)


# --------------------------------------------------------------------------- logs de acceso web

_ACCESS = re.compile(r'^(\S+) \S+ (\S+) \[([^\]]+)\] "((?:[^"\\]|\\.)*)" (\d{3}) (\S+)(?: "((?:[^"\\]|\\.)*)" "((?:[^"\\]|\\.)*)")?')
_MONTHS = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}
_CLF_TIME = re.compile(r"^(\d{2})/(\w{3})/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$")


def _clf_time(text):
    m = _CLF_TIME.match(text)
    if not m or m.group(2) not in _MONTHS:
        raise ImportError_("fecha de log no válida: %r" % text)
    d, mon, y, h, mi, s, tz = m.groups()
    return iso("%s-%02d-%sT%s:%s:%s%s" % (y, _MONTHS[mon], d, h, mi, s, tz))


def parse_access_log(text, source_file, asset=None):
    events, skipped = [], 0
    host = asset or UNKNOWN_HOST
    for n, line in enumerate(lines_of(text), 1):
        line = line.rstrip("\r")
        m = _ACCESS.match(line)
        if not m:
            if line.strip():
                skipped += 1
            continue
        ip, user, when, request, status, _size, _ref, ua = m.groups()
        parts = request.split(" ")
        method = parts[0] if len(parts) >= 2 else "-"
        url = parts[1] if len(parts) >= 2 else request
        path = url.split("?")[0]
        decoded = url_decode(url)
        code = int(status)
        events.append({
            "event_id": "web-%s-%d" % (host_tag(host), n),
            "timestamp_utc": _clf_time(when),
            "source_type": "web_access_log",
            "source_file": source_file,
            "record_number": n,
            "event": {"category": "web_request", "action": "http_%s" % method.lower(), "http_status": code,
                      "outcome": "success" if code < 400 else "failure"},
            "actor": {"user_name": user if user != "-" else "anonymous"},
            "source": {k: v for k, v in {"ip": clean_ip(ip)}.items() if v},
            "target": {"hostname": host, "resource_path": clip(path, 2000)},
            "process_or_artifact": {"command_line": clip("%s %s (User-Agent: %s)" % (method, decoded, ua or "-"), 4000)},
            "native": {"format": "access_log", "record": line},
        })
    if not events:
        raise ImportError_("no hay líneas con formato de log de acceso (combined o common)")
    return events[:MAX_EVENTS], skipped + max(0, len(events) - MAX_EVENTS)


# --------------------------------------------------------------------------- Suricata EVE JSON

def parse_suricata(text, source_file, asset=None):
    events, skipped, seen = [], 0, 0
    for i, raw in enumerate(l.strip() for l in lines_of(text)):
        if not raw:
            continue
        try:
            obj = json.loads(raw)
        except ValueError:
            skipped += 1
            continue
        if not isinstance(obj, dict):
            skipped += 1
            continue
        seen += 1
        kind = obj.get("event_type")
        if kind not in ("http", "alert") or not obj.get("timestamp"):
            skipped += 1
            continue
        http = obj.get("http") or {}
        dest = clean_ip(obj.get("dest_ip"))
        host = clip(http.get("hostname"), 255) or asset or dest or UNKNOWN_HOST
        base = {
            "timestamp_utc": iso(obj["timestamp"]),
            "source_file": source_file,
            "record_number": i + 1,
            "actor": {"user_name": "anonymous"},
            "source": {k: v for k, v in {"ip": clean_ip(obj.get("src_ip")), "port": to_int(obj.get("src_port"))}.items() if v},
            "native": {"format": "suricata_eve", "record": raw},
        }
        if kind == "http":
            code = to_int(http.get("status"))
            url = clip(http.get("url"), 4000)
            method = clip(http.get("http_method"), 20) or "-"
            base.update({
                "event_id": "eve-%s-%d" % (host_tag(host), i + 1),
                "source_type": "web_access_log",
                "event": {"category": "web_request", "action": "http_%s" % method.lower(), "http_status": code,
                          "outcome": "success" if code and code < 400 else "failure"},
                "target": {k: v for k, v in {"hostname": host, "ip": dest, "port": to_int(obj.get("dest_port")),
                                             "resource_path": url.split("?")[0]}.items() if v},
                "process_or_artifact": {"command_line": "%s %s (User-Agent: %s)" % (
                    method, url_decode(url), clip(http.get("http_user_agent"), 400) or "-")},
            })
        else:
            alert = obj.get("alert") or {}
            base.update({
                "event_id": "ids-%s-%d" % (host_tag(host), i + 1),
                "source_type": "network_ids",
                "event": {"category": "network_alert", "action": "ids_alert", "outcome": "unknown",
                          "signature_id": to_int(alert.get("signature_id")),
                          "severity_base": {1: 90, 2: 70, 3: 40}.get(to_int(alert.get("severity")), 50)},
                "target": {k: v for k, v in {"hostname": host, "ip": dest, "port": to_int(obj.get("dest_port"))}.items() if v},
                "process_or_artifact": {"command_line": clip(alert.get("signature"), 400) or None},
            })
        events.append(base)
    if not seen:
        raise ImportError_("no hay eventos EVE JSON de Suricata")
    return events[:MAX_EVENTS], skipped + max(0, len(events) - MAX_EVENTS)
