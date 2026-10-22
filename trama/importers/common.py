"""Utilidades compartidas por los importadores.

Toda entrada se trata como hostil: XML sin DTD ni entidades, textos recortados,
límites de tamaño y de elementos. Las marcas de tiempo se normalizan a UTC con
milisegundos (``2026-10-21T08:42:11.412Z``) y los identificadores son
deterministas, para que la CLI y la consola produzcan exactamente el mismo
paquete con los mismos ficheros (lo comprueba ``tests/test_parity.py``).
"""
import calendar
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

MAX_BYTES = 50 * 1024 * 1024
MAX_EVENTS = 200000
MAX_FINDINGS = 20000
UNKNOWN_HOST = "UNKNOWN_HOST"

SEVERITIES = ("INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL")


class ImportError_(ValueError):
    """Fichero que no se puede importar (formato, tamaño o contenido)."""


def clip(value, size=400):
    if value is None:
        return ""
    text = value if isinstance(value, str) else str(value)
    return re.sub(r"\s+", " ", text).strip()[:size]


def to_int(value):
    try:
        text = str(value).strip()
        if re.match(r"^-?\d+$", text):
            return int(text)
    except Exception:
        pass
    return None


_TS = re.compile(r"^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d+))?\s*(Z|z|[+-]\d{2}:?\d{2})?$")


def iso_from_ms(ms):
    """Milisegundos desde 1970 a ISO 8601 UTC, igual que ``Date.prototype.toISOString``."""
    sec, rem = divmod(int(ms), 1000)
    dt = datetime.fromtimestamp(sec, timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S") + ".%03dZ" % rem


def ms_from_iso(text):
    """Cadena ISO 8601 (con o sin zona, con cualquier número de decimales) a milisegundos UTC."""
    m = _TS.match(str(text).strip())
    if not m:
        raise ImportError_("marca de tiempo no válida: %r" % (text,))
    y, mo, d, h, mi, s, frac, tz = m.groups()
    ms = calendar.timegm((int(y), int(mo), int(d), int(h), int(mi), int(s), 0, 0, 0)) * 1000
    ms += int(((frac or "") + "000")[:3])
    if tz and tz not in ("Z", "z"):
        sign = 1 if tz[0] == "+" else -1
        digits = tz[1:].replace(":", "")
        ms -= sign * (int(digits[:2]) * 60 + int(digits[2:])) * 60000
    return ms


def iso(text):
    return iso_from_ms(ms_from_iso(text))


def clean_ip(value):
    text = clip(value, 80)
    if text.lower().startswith("::ffff:"):
        text = text[7:]
    return None if text in ("", "-") else text


def clean_user(value):
    """``DOMINIO\\usuario`` o ``usuario@dominio`` a ``usuario``."""
    text = clip(value, 200)
    if "\\" in text:
        text = text.split("\\")[-1]
    if "@" in text:
        text = text.split("@")[0]
    return text or None


def lines_of(text):
    """Líneas separadas solo por \\n (o \\r\\n). ``str.splitlines`` también corta en \\x1d, el
    separador del formato enriquecido de auditd, y JavaScript no lo hace."""
    return [l[:-1] if l.endswith("\r") else l for l in text.split("\n")]


def is_ip(text):
    return bool(re.match(r"^\d{1,3}(\.\d{1,3}){3}$", text or "")) or (":" in (text or "") and bool(re.match(r"^[0-9a-fA-F:]+$", text)))


def host_tag(name):
    """Parte del host que va en los identificadores: el nombre corto o la IP completa."""
    return name if is_ip(name) else (name or "").split(".")[0]


def short_host(name):
    return (name or "").split(".")[0].lower()


def parse_xml(text):
    """XML sin DTD: evita entidades externas y expansión exponencial (XXE, billion laughs)."""
    if re.search(r"<!DOCTYPE|<!ENTITY", text[:200000], re.I):
        raise ImportError_("XML con DTD o entidades: rechazado por seguridad")
    try:
        return ET.fromstring(text)
    except ET.ParseError as exc:
        raise ImportError_("XML no válido: %s" % exc)


def local(tag):
    return tag.rsplit("}", 1)[-1].lower() if isinstance(tag, str) else ""


def children(node, name):
    return [c for c in list(node) if local(c.tag) == name]


def child(node, name):
    for c in list(node) if node is not None else []:
        if local(c.tag) == name:
            return c
    return None


def descendants(node, name):
    return [c for c in node.iter() if local(c.tag) == name]


def text_of(node, name=None):
    if node is None:
        return ""
    target = child(node, name) if name else node
    return clip("".join(target.itertext()) if target is not None else "", 4000)


def json_lines(text):
    """Objetos de un JSON Lines; las líneas vacías o no JSON se cuentan aparte."""
    rows, bad = [], 0
    for line in lines_of(text):
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except ValueError:
            bad += 1
            continue
        if isinstance(obj, dict):
            rows.append(obj)
        else:
            bad += 1
    return rows, bad


def url_decode(text):
    """Decodifica ``%XX`` y ``+`` igual en Python y en JavaScript (bytes UTF-8 con sustitución)."""
    out = bytearray()
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        if ch == "%" and re.match(r"[0-9a-fA-F]{2}$", text[i + 1:i + 3]):
            out.append(int(text[i + 1:i + 3], 16))
            i += 3
            continue
        out.extend(b" " if ch == "+" else ch.encode("utf-8", "surrogatepass"))
        i += 1
    return out.decode("utf-8", "replace")


def classify(text):
    """Clase de hallazgo a partir de su título o etiquetas; la usan las reglas (posture_condition)."""
    t = (text or "").lower()
    if re.search(r"sql ?injection|\bsqli\b|inyecci[oó]n sql", t):
        return "sqli"
    if re.search(r"kerberoast", t):
        return "kerberoastable_spn"
    if re.search(r"as-?rep", t):
        return "asrep_roastable"
    if re.search(r"remote code execution|\brce\b|command injection|ejecuci[oó]n remota", t):
        return "rce"
    if re.search(r"default (credential|password|login)|weak password|anonymous (login|access)|default-login", t):
        return "weak_credentials"
    if re.search(r"cross.site scripting|\bxss\b", t):
        return "xss"
    return "vulnerability"


SEV_WORD = {"critical": "CRITICAL", "high": "HIGH", "medium": "MEDIUM", "moderate": "MEDIUM",
            "low": "LOW", "info": "INFO", "information": "INFO", "informational": "INFO"}


def sev(word, default="MEDIUM"):
    return SEV_WORD.get(clip(word, 20).lower(), default)


def finding(fid, fclass, title, tool, hostname="", ip="", severity="MEDIUM", description="", **extra):
    f = {"finding_id": clip(fid, 200), "finding_class": fclass, "title": clip(title, 240),
         "source_tool": tool, "hostname": clip(hostname, 255), "ip": clip(ip, 80),
         "severity": severity, "description": clip(description, 1000)}
    for k, v in extra.items():
        if v not in (None, "", []):
            f[k] = v
    return f
