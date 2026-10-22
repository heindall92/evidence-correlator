"""Hallazgos ofensivos: Nmap, Nessus, Nuclei, Burp Suite, BloodHound y LinPEAS.

Cada hallazgo lleva ``finding_class``, que es lo que leen las reglas
(``posture_condition``), en lugar de un identificador fijo. Así una regla sirve
para cualquier informe que detecte la misma debilidad.
"""
import json
import os
import re

from .common import (MAX_FINDINGS, child, children, classify, clip, descendants, finding, ImportError_,
                     lines_of, parse_xml, sev, text_of, to_int)


def _cap(items):
    return items[:MAX_FINDINGS], max(0, len(items) - MAX_FINDINGS)


# --------------------------------------------------------------------------- Nmap

def parse_nmap(text, source_file, asset=None):
    root = parse_xml(text)
    out, skipped = [], 0
    for h in descendants(root, "host"):
        status = child(h, "status")
        if status is not None and status.attrib.get("state") not in (None, "up"):
            skipped += 1
            continue
        ip = ""
        for a in children(h, "address"):
            if a.attrib.get("addrtype") in ("ipv4", "ipv6"):
                ip = a.attrib.get("addr", "")
                break
        names = [n.attrib.get("name", "") for n in descendants(h, "hostname") if n.attrib.get("name")]
        hostname = names[0] if names else ip
        for p in descendants(h, "port"):
            st = child(p, "state")
            if st is None or st.attrib.get("state") != "open":
                continue
            port, proto = p.attrib.get("portid", ""), p.attrib.get("protocol", "tcp")
            svc = child(p, "service")
            sa = svc.attrib if svc is not None else {}
            label = " ".join(x for x in (sa.get("name"), sa.get("product"), sa.get("version")) if x)
            out.append(finding("NMAP-%s-%s-%s" % (ip or hostname, proto, port), "exposed_service",
                               "%s/%s abierto%s" % (port, proto, (" · " + label) if label else ""), "Nmap",
                               hostname, ip, "INFO", port=to_int(port), service=clip(label, 200) or None))
            for sc in children(p, "script"):
                output = sc.attrib.get("output", "")
                if re.search(r"\bVULNERABLE\b", output):
                    sid = sc.attrib.get("id", "nse")
                    out.append(finding("NMAP-%s-%s-%s-%s" % (ip or hostname, proto, port, sid), classify(sid + " " + output),
                                       "%s en %s/%s" % (sid, port, proto), "Nmap NSE", hostname, ip, "HIGH",
                                       clip(output, 1000), port=to_int(port)))
    return _cap(out)[0], skipped


# --------------------------------------------------------------------------- Nessus

_NESSUS_SEV = {1: "LOW", 2: "MEDIUM", 3: "HIGH", 4: "CRITICAL"}


def parse_nessus(text, source_file, asset=None):
    root = parse_xml(text)
    out, skipped = [], 0
    for rh in descendants(root, "reporthost"):
        props = {}
        for tag in descendants(child(rh, "hostproperties") if child(rh, "hostproperties") is not None else rh, "tag"):
            props[tag.attrib.get("name", "")] = "".join(tag.itertext()).strip()
        ip = props.get("host-ip") or rh.attrib.get("name", "")
        hostname = props.get("host-fqdn") or props.get("netbios-name") or rh.attrib.get("name", "") or ip
        for ri in children(rh, "reportitem"):
            level = to_int(ri.attrib.get("severity")) or 0
            if level == 0:
                skipped += 1
                continue
            title = ri.attrib.get("pluginName") or text_of(ri, "plugin_name") or "Plugin %s" % ri.attrib.get("pluginID")
            cves = sorted({"".join(c.itertext()).strip().upper() for c in children(ri, "cve")})
            port = to_int(ri.attrib.get("port"))
            out.append(finding("NESSUS-%s-%s-%s" % (ri.attrib.get("pluginID", "0"), ip or hostname, port or 0),
                               classify(title), title, "Nessus", hostname, ip, _NESSUS_SEV.get(level, "MEDIUM"),
                               text_of(ri, "synopsis") or text_of(ri, "description"), port=port or None,
                               cves=cves or None))
    return _cap(out)[0], skipped


# --------------------------------------------------------------------------- Nuclei

def _url_parts(url):
    m = re.match(r"^([a-z][a-z0-9+.-]*)://(\[[^\]]+\]|[^/:?#]+)(?::(\d+))?([^?#]*)", url or "", re.I)
    if not m:
        return "", None, ""
    scheme, host, port, path = m.groups()
    port = int(port) if port else {"https": 443, "http": 80}.get(scheme.lower())
    return host.strip("[]").lower(), port, path or "/"


def parse_nuclei(text, source_file, asset=None):
    stripped = text.strip()
    if stripped.startswith("["):
        rows = [r for r in json.loads(stripped) if isinstance(r, dict)]
    else:
        rows = []
        for line in lines_of(stripped):
            line = line.strip()
            if line:
                try:
                    obj = json.loads(line)
                except ValueError:
                    continue
                if isinstance(obj, dict):
                    rows.append(obj)
    if not rows:
        raise ImportError_("no hay resultados de Nuclei (JSONL de -jsonl o JSON de -json-export)")
    out, skipped = [], 0
    for r in rows:
        info = r.get("info") or {}
        level = clip(info.get("severity"), 20).lower()
        if level in ("", "info", "unknown"):
            skipped += 1
            continue
        tags = info.get("tags") or []
        tags = [clip(t, 40).lower() for t in (tags if isinstance(tags, list) else str(tags).split(","))]
        where = clip(r.get("matched-at") or r.get("host") or r.get("url"), 1000)
        host, port, path = _url_parts(where if "://" in where else "http://" + where)
        ip = clip(r.get("ip"), 80)
        tid = clip(r.get("template-id"), 120)
        title = clip(info.get("name"), 200) or tid
        fclass = "sqli" if "sqli" in tags else classify("%s %s" % (title, " ".join(tags)))
        out.append(finding("NUCLEI-%s-%s-%s" % (tid, host or ip, port or 0), fclass, title, "Nuclei",
                           host, ip, sev(level), info.get("description"), port=port, resource_path=path or None,
                           template=tid or None))
    return _cap(out)[0], skipped


# --------------------------------------------------------------------------- Burp Suite

def parse_burp(text, source_file, asset=None):
    root = parse_xml(text)
    out, skipped = [], 0
    for issue in descendants(root, "issue"):
        level = text_of(issue, "severity")
        if level.lower() in ("information", "info", "false positive"):
            skipped += 1
            continue
        name = text_of(issue, "name")
        host_node = child(issue, "host")
        url = text_of(host_node)
        ip = host_node.attrib.get("ip", "") if host_node is not None else ""
        host, port, _ = _url_parts(url)
        path = text_of(issue, "path")
        out.append(finding("BURP-%s-%s-%s" % (text_of(issue, "type") or name, host or ip, path), classify(name),
                           name, "Burp Suite", host, ip, sev(level), text_of(issue, "issueBackground") or
                           text_of(issue, "issueDetail"), port=port, resource_path=path or None))
    return _cap(out)[0], skipped


# --------------------------------------------------------------------------- BloodHound

def parse_bloodhound(text, source_file, asset=None):
    data = json.loads(text)
    items = data.get("data") if isinstance(data, dict) else None
    if not isinstance(items, list):
        raise ImportError_("no es una exportación de BloodHound (falta data)")
    out, skipped = [], 0
    for obj in items:
        props = (obj or {}).get("Properties") or (obj or {}).get("properties") or {}
        if not isinstance(props, dict) or props.get("enabled") is False:
            skipped += 1
            continue
        name = clip(props.get("name"), 200)
        sam = clip(props.get("samaccountname"), 120) or name.split("@")[0]
        domain = clip(props.get("domain"), 200) or (name.split("@")[1] if "@" in name else "")
        if not sam:
            skipped += 1
            continue
        admin = bool(props.get("admincount"))
        if props.get("hasspn"):
            spns = [clip(s, 200) for s in props.get("serviceprincipalnames") or []]
            out.append(finding("BH-KERBEROAST-%s@%s" % (sam.lower(), domain.lower()), "kerberoastable_spn",
                               "Cuenta «%s» con SPN: susceptible de Kerberoasting" % sam, "BloodHound",
                               "", "", "CRITICAL" if admin else "HIGH",
                               "SPN: %s" % ", ".join(spns) if spns else "", scope="domain", domain=domain,
                               target_spn=sam, spns=spns or None))
        if props.get("dontreqpreauth"):
            out.append(finding("BH-ASREP-%s@%s" % (sam.lower(), domain.lower()), "asrep_roastable",
                               "Cuenta «%s» sin preautenticación Kerberos" % sam, "BloodHound", "", "",
                               "CRITICAL" if admin else "HIGH", "", scope="domain", domain=domain, target_spn=sam))
        if not props.get("hasspn") and not props.get("dontreqpreauth"):
            skipped += 1
    return _cap(out)[0], skipped


# --------------------------------------------------------------------------- LinPEAS / getcap / find -perm

GTFOBINS = set("""python python2 python3 perl ruby node php bash sh dash zsh ksh csh tcsh ash find vim vi nano less
more awk gawk nawk mawk tar zip cp mv env nmap gdb docker systemctl base64 xxd tee wget curl openssl rsync socat nc
ncat strace taskset timeout stdbuf expect lua tclsh wish busybox ed sed git make man flock ionice nice setarch
start-stop-daemon run-parts xargs time watch dd sqlite3 mysql pip""".split())
DANGEROUS_CAPS = {"cap_setuid", "cap_setgid", "cap_dac_override", "cap_dac_read_search", "cap_sys_admin",
                  "cap_sys_ptrace", "cap_sys_module", "cap_chown", "cap_fowner"}
_ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
_CAP_LINE = re.compile(r"^(/\S+)\s+(?:=\s+)?(cap_[a-z_]+(?:[,+=][a-z_]+)*(?:[,+=][a-z_]+)*)\s*$")
_SUID_LINE = re.compile(r"^-[rwxsS-]{2}[sS][rwxsStT-]{6}\s.*?\s(/\S+)$")


def _gtfo(path):
    base = os.path.basename(path)
    return base in GTFOBINS or re.sub(r"[\d.]+$", "", base) in GTFOBINS


def parse_linpeas(text, source_file, asset=None):
    clean = _ANSI.sub("", text)
    m = re.search(r"^\s*(?:Hostname|hostname)\s*[:=]\s*(\S+)", clean, re.M)
    host = m.group(1) if m else (asset or "")
    out, seen = [], set()
    for line in lines_of(clean):
        line = line.strip().lstrip("│║ ").strip()
        cm = _CAP_LINE.match(line)
        if cm:
            path, raw = cm.groups()
            caps = sorted({c for c in re.findall(r"cap_[a-z_]+", raw)})
            bad = [c for c in caps if c in DANGEROUS_CAPS]
            if bad and ("cap", path) not in seen:
                seen.add(("cap", path))
                out.append(finding("LINPEAS-CAP-%s-%s" % (host, path), "dangerous_capability",
                                   "%s con %s" % (path, ", ".join(bad)), "LinPEAS", host, "",
                                   "CRITICAL" if _gtfo(path) else "HIGH", raw, binary_path=path, capabilities=caps))
            continue
        sm = _SUID_LINE.match(line)
        if sm:
            path = sm.group(1)
            if _gtfo(path) and ("suid", path) not in seen:
                seen.add(("suid", path))
                out.append(finding("LINPEAS-SUID-%s-%s" % (host, path), "suid_gtfobin", "%s con bit SUID" % path,
                                   "LinPEAS", host, "", "HIGH", line, binary_path=path, suid=True))
    if not out and not re.search(r"linpeas|cap_[a-z_]+|-rws", clean, re.I):
        raise ImportError_("no hay resultados de LinPEAS, getcap ni find -perm")
    return _cap(out)[0], 0
