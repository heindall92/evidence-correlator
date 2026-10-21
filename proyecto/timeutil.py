"""Parseo de marcas de tiempo ISO 8601 compatible con Python 3.8+."""
import re
from datetime import datetime, timedelta, timezone

_ISO_RE = re.compile(
    r"^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})"
    r"(?:\.(\d{1,9}))?"
    r"(Z|[+-]\d{2}:?\d{2})?$"
)


def parse_utc(value):
    """Convierte una cadena ISO 8601 en ``datetime`` consciente de zona (UTC).

    ``datetime.fromisoformat`` en Python < 3.11 no acepta ``Z`` ni fracciones
    de segundo distintas de 3 o 6 dígitos; este parser sí. Sin zona se asume UTC.
    """
    if not isinstance(value, str):
        raise ValueError("marca de tiempo no válida: %r" % (value,))
    m = _ISO_RE.match(value.strip())
    if not m:
        raise ValueError("marca de tiempo no válida: %r" % (value,))
    y, mo, d, h, mi, s, frac, tz = m.groups()
    micro = int((frac or "0").ljust(6, "0")[:6])
    dt = datetime(int(y), int(mo), int(d), int(h), int(mi), int(s), micro)
    if tz in (None, "Z"):
        offset = timedelta(0)
    else:
        sign = 1 if tz[0] == "+" else -1
        digits = tz[1:].replace(":", "")
        offset = sign * timedelta(hours=int(digits[:2]), minutes=int(digits[2:]))
    return dt.replace(tzinfo=timezone(offset)).astimezone(timezone.utc)


def parse_window(window):
    """Convierte ``'45m'``, ``'120s'``, ``'2h'`` o ``'1d'`` en ``timedelta``.

    Lanza ``ValueError`` ante un formato desconocido en lugar de aplicar un
    valor por defecto silencioso.
    """
    m = re.match(r"^\s*(\d+)\s*([smhd])\s*$", str(window), re.IGNORECASE)
    if not m:
        raise ValueError("ventana temporal no válida: %r (usa p. ej. 45m, 120s, 2h)" % (window,))
    val, unit = int(m.group(1)), m.group(2).lower()
    if val <= 0:
        raise ValueError("la ventana temporal debe ser positiva: %r" % (window,))
    return {"s": timedelta(seconds=val), "m": timedelta(minutes=val),
            "h": timedelta(hours=val), "d": timedelta(days=val)}[unit]
