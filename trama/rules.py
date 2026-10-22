"""Carga y validación de reglas de correlación.

Formato canónico: un fichero JSON por regla (solo librería estándar). Si
PyYAML está instalado también se aceptan ficheros ``.yaml``/``.yml``.
"""
import json
import os

from .timeutil import parse_window

RULES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rules")
REQUIRED = ("id", "title", "severity", "confidence", "correlation", "mitre_attack",
            "grc_compliance_mapping")
SEVERITIES = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
KNOWN_PREDICATES = {"field_contains_any", "equals_ref", "not_equals", "field_in_list",
                    "require_suid_or_capabilities"}


class RuleError(ValueError):
    pass


def validate_rule(rule, origin="<regla>"):
    if not isinstance(rule, dict):
        raise RuleError("%s: la regla debe ser un objeto" % origin)
    missing = [k for k in REQUIRED if k not in rule]
    if missing:
        raise RuleError("%s: faltan campos obligatorios: %s" % (origin, ", ".join(missing)))
    if rule["severity"] not in SEVERITIES:
        raise RuleError("%s: severidad desconocida %r" % (origin, rule["severity"]))
    conf = rule["confidence"]
    if not isinstance(conf, (int, float)) or not 0 <= conf <= 1:
        raise RuleError("%s: confidence debe estar entre 0 y 1" % origin)
    corr = rule["correlation"]
    try:
        parse_window(corr.get("window"))
    except ValueError as exc:
        raise RuleError("%s: %s" % (origin, exc))
    stages = corr.get("stages")
    if not isinstance(stages, list) or not stages:
        raise RuleError("%s: correlation.stages debe ser una lista no vacía" % origin)
    seen = set()
    for st in stages:
        sid = st.get("stage_id")
        if not sid or sid in seen:
            raise RuleError("%s: stage_id ausente o duplicado (%r)" % (origin, sid))
        seen.add(sid)
        unknown = set(st.get("predicates", {})) - KNOWN_PREDICATES
        if unknown:
            raise RuleError("%s: predicados desconocidos en %s: %s"
                            % (origin, sid, ", ".join(sorted(unknown))))
    return rule


def _load_file(path):
    with open(path, "r", encoding="utf-8") as fh:
        if path.endswith((".yaml", ".yml")):
            try:
                import yaml  # opcional
            except ImportError:
                return None
            return yaml.safe_load(fh)
        return json.load(fh)


def load_rules(path=None):
    """Carga reglas desde un directorio o un fichero (JSON con una regla o lista)."""
    path = path or RULES_DIR
    files = ([os.path.join(path, f) for f in sorted(os.listdir(path))
              if f.endswith((".json", ".yaml", ".yml"))]
             if os.path.isdir(path) else [path])
    rules, ids = [], set()
    for fpath in files:
        data = _load_file(fpath)
        if data is None:
            continue
        for rule in (data if isinstance(data, list) else [data]):
            validate_rule(rule, os.path.basename(fpath))
            if rule["id"] in ids:
                raise RuleError("id de regla duplicado: %s" % rule["id"])
            ids.add(rule["id"])
            rules.append(rule)
    if not rules:
        raise RuleError("no se encontraron reglas en %s" % path)
    return rules


def rules_js(rules=None):
    """Las reglas como script para la consola (``docs/assets/rules.js``): la importación
    en el navegador correlaciona con exactamente las mismas reglas que la CLI."""
    payload = json.dumps(rules if rules is not None else load_rules(), ensure_ascii=False, indent=1)
    return ("/* Generado con: python -m trama rules-js. No editar a mano; las reglas viven en trama/rules. */\n"
            "window.TRAMA_RULES = " + payload.replace("</", "<\\/") + ";\n")
