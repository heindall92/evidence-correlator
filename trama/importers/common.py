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
from datetime import datetime, timezone

MAX_BYTES = 50 * 1024 * 1024
MAX_EVENTS = 200000
MAX_FINDINGS = 20000
UNKNOWN_HOST = "UNKNOWN_HOST"

SEVERITIES = ("INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL")


class ImportError_(ValueError):
    """Fichero que no se puede importar (formato, tamaño o contenido)."""


# Espacios: los mismos que ``str.isspace`` de Python, escritos a mano para que JavaScript use la misma
# lista (su ``\\s`` no incluye \\x1c-\\x1f y sí \\ufeff).
WS = "\t\n\x0b\x0c\r\x1c\x1d\x1e\x1f \x85\xa0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000"
_WS_RUN = re.compile("[%s]+" % WS)


def clip(value, size=400):
    if value is None:
        return ""
    text = value if isinstance(value, str) else str(value)
    return _WS_RUN.sub(" ", text).strip(WS)[:size]


def to_int(value):
    try:
        text = str(value).strip()
        if re.match(r"^-?[0-9]+$", text):
            return int(text)
    except Exception:
        pass
    return None


_TS = re.compile(r"^([0-9]{4})-([0-9]{2})-([0-9]{2})[T ]([0-9]{2}):([0-9]{2}):([0-9]{2})(?:[.,]([0-9]+))?\s*(Z|z|[+-][0-9]{2}:?[0-9]{2})?$")


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
    return bool(re.match(r"^[0-9]{1,3}(\.[0-9]{1,3}){3}$", text or "")) or (":" in (text or "") and bool(re.match(r"^[0-9a-fA-F:]+$", text)))


def host_tag(name):
    """Parte del host que va en los identificadores: el nombre corto o la IP completa."""
    return name if is_ip(name) else (name or "").split(".")[0]


def short_host(name):
    return (name or "").split(".")[0].lower()


MAX_XML_NODES = 1000000
_XML_NAMED = {"lt": "<", "gt": ">", "amp": "&", "quot": '"', "apos": "'"}
_XML_ATTR = re.compile(r"""([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')""")
_XML_ENT = re.compile(r"&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);")


def _xml_entities(text):
    if "&" not in text:
        return text

    def rep(m):
        e = m.group(1)
        if e[0] == "#":
            code = int(e[2:], 16) if e[1] in "xX" else int(e[1:])
            return chr(code) if 0 < code <= 0x10FFFF and not 0xD800 <= code <= 0xDFFF else ""
        return _XML_NAMED.get(e.lower(), m.group(0))
    return _XML_ENT.sub(rep, text)


def _xml_local(name):
    i = name.find(":")
    return (name[i + 1:] if i >= 0 else name).lower()


def parse_xml(text):
    """Analizador XML mínimo, el mismo algoritmo que ``docs/assets/importers.js`` (y que CTEM-Nexus).

    - Rechaza DTD y entidades declaradas (XXE, expansión exponencial) antes de analizar.
    - Solo resuelve las cinco entidades predefinidas y las referencias numéricas.
    - Nodos ``{"name", "attrs", "children", "text"}`` con nombres y atributos locales en minúscula;
      el texto es la concatenación de los fragmentos directos que no son solo espacios.
    Devuelve un nodo raíz virtual ``#document``.
    """
    if re.search(r"<!ENTITY", text, re.I) or re.search(r"<!DOCTYPE[^>]*(\[|SYSTEM|PUBLIC)", text, re.I):
        raise ImportError_("XML con DTD o entidades: rechazado por seguridad")
    root = {"name": "#document", "attrs": {}, "children": [], "text": ""}
    stack = [root]
    count, i, n = 0, 0, len(text)
    while i < n:
        lt = text.find("<", i)
        end_text = n if lt == -1 else lt
        if end_text > i:
            raw = text[i:end_text]
            if raw.strip():
                stack[-1]["text"] += _xml_entities(raw)
        if lt == -1:
            break
        if text.startswith("<!--", lt):
            end = text.find("-->", lt + 4)
            i = n if end == -1 else end + 3
        elif text.startswith("<![CDATA[", lt):
            end = text.find("]]>", lt + 9)
            stack[-1]["text"] += text[lt + 9:n if end == -1 else end]
            i = n if end == -1 else end + 3
        elif text.startswith("<?", lt):
            end = text.find("?>", lt + 2)
            i = n if end == -1 else end + 2
        elif text.startswith("<!", lt):
            end = text.find(">", lt + 2)
            i = n if end == -1 else end + 1
        elif lt + 1 < n and text[lt + 1] == "/":
            end = text.find(">", lt + 2)
            name = _xml_local(text[lt + 2:n if end == -1 else end].strip())
            for k in range(len(stack) - 1, 0, -1):  # tolera etiquetas mal anidadas
                if stack[k]["name"] == name:
                    del stack[k:]
                    break
            i = n if end == -1 else end + 1
        else:
            j, q = lt + 1, None
            while j < n:
                c = text[j]
                if q:
                    if c == q:
                        q = None
                elif c in "\"'":
                    q = c
                elif c == ">":
                    break
                j += 1
            body = text[lt + 1:j]
            closing = body.endswith("/")
            inner = body[:-1] if closing else body
            m = re.match(r"[^\s/>]+", inner)
            if m:
                count += 1
                if count > MAX_XML_NODES:
                    raise ImportError_("el XML tiene demasiados elementos")
                attrs = {}
                for a in _XML_ATTR.finditer(inner[m.end():]):
                    attrs[_xml_local(a.group(1))] = _xml_entities(a.group(3) if a.group(3) is not None else a.group(4) or "")
                node = {"name": _xml_local(m.group(0)), "attrs": attrs, "children": [], "text": ""}
                stack[-1]["children"].append(node)
                if not closing:
                    stack.append(node)
            i = j + 1
    return root


def child(node, name):
    for c in (node or {}).get("children", []):
        if c["name"] == name:
            return c
    return None


def children(node, name):
    return [c for c in (node or {}).get("children", []) if c["name"] == name]


def descendants(node, name):
    out, stack = [], list(reversed(node["children"]))
    while stack:
        cur = stack.pop()
        if cur["name"] == name:
            out.append(cur)
        stack.extend(reversed(cur["children"]))
    return out


def text_of(node, name=None):
    target = child(node, name) if name else node
    return clip(target["text"] if target else "", 4000)


def attr(node, name):
    return (node or {}).get("attrs", {}).get(name, "") if node else ""


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
