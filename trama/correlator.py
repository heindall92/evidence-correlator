"""Motor de correlación temporal multi-etapa (máquina de estados finitos).

Cada regla define una secuencia de etapas dentro de una ventana temporal. Un
evento que cumple la etapa 0 abre un estado; los eventos posteriores lo hacen
avanzar hasta completar la secuencia y emitir un incidente con su paquete de
evidencias sellado (raíz de Merkle), MITRE ATT&CK y no conformidades GRC.
"""
from .custody import merkle_root
from .timeutil import parse_utc, parse_window

DANGEROUS_CAPS = {"cap_setuid", "cap_setgid", "cap_dac_override", "cap_sys_admin",
                  "cap_sys_ptrace", "cap_sys_module"}


def get_nested(data, path):
    """Valor anidado por notación de punto. Si atraviesa una lista, devuelve
    la lista de valores resultantes de aplicar el resto de la ruta a cada
    elemento (``known_exposures.finding_id`` -> lista de ids)."""
    parts = path.split(".") if isinstance(path, str) else list(path)
    current = data
    for i, part in enumerate(parts):
        if isinstance(current, dict):
            current = current.get(part)
        elif isinstance(current, list):
            rest = parts[i:]
            return [v for v in (get_nested(item, rest) for item in current) if v is not None]
        else:
            return None
    return current


def _norm(value):
    """Comparación tolerante a tipos: 3 == '3', True == 'true'."""
    if isinstance(value, bool):
        return str(value).lower()
    return "" if value is None else str(value)


def _resolve(value, variables):
    if isinstance(value, str) and value.startswith("$"):
        return variables.get(value[1:])
    return value


def _in(actual, allowed):
    allowed_n = {_norm(a) for a in allowed}
    if isinstance(actual, list):
        return any(_norm(a) in allowed_n for a in actual)
    return _norm(actual) in allowed_n


class EvidenceCorrelationEngine:
    def __init__(self, rules):
        self.rules = list(rules)

    # ------------------------------------------------------------------ etapas
    @staticmethod
    def matches_stage(event, stage, variables):
        expected_source = stage.get("source_type")
        if expected_source and event["forensic_chain"]["source_type"] != expected_source:
            return False

        for field, expected in stage.get("match", {}).items():
            expected = _resolve(expected, variables)
            actual = get_nested(event, field)
            if isinstance(expected, list):
                if not _in(actual, expected):
                    return False
            elif _norm(actual) != _norm(expected):
                return False

        for field, expected in stage.get("posture_condition", {}).items():
            actual = get_nested(event, field)
            if not _in(actual if isinstance(actual, list) else [actual],
                       expected if isinstance(expected, list) else [expected]):
                return False

        preds = stage.get("predicates", {})
        for field, subs in preds.get("field_contains_any", {}).items():
            text = _norm(get_nested(event, field)).lower()
            if not any(str(s).lower() in text for s in subs):
                return False
        for field, ref in preds.get("equals_ref", {}).items():
            if _norm(get_nested(event, field)) != _norm(_resolve(ref if str(ref).startswith("$") else "$" + ref, variables)):
                return False
        for field, forbidden in preds.get("not_equals", {}).items():
            if _norm(get_nested(event, field)) == _norm(forbidden):
                return False
        for field, allowed in preds.get("field_in_list", {}).items():
            if not _in(get_nested(event, field), allowed):
                return False
        if preds.get("require_suid_or_capabilities"):
            suid = bool(get_nested(event, "process_or_artifact.suid_bit"))
            caps = {str(c).split("+")[0].lower()
                    for c in (get_nested(event, "process_or_artifact.capabilities") or [])}
            if not (suid or caps & DANGEROUS_CAPS):
                return False
        return True

    @staticmethod
    def _extract(event, stage, variables):
        for name, field in stage.get("extract", {}).items():
            value = get_nested(event, field)
            variables["%s.%s" % (stage["stage_id"], name)] = value
            variables[name] = value

    @staticmethod
    def _group_key(rule, event, variables):
        keys = rule["correlation"].get("group_by") or []
        return tuple(_norm(variables[k]) if k in variables else _norm(get_nested(event, k))
                     for k in keys)

    # ---------------------------------------------------------------- grafo
    @staticmethod
    def build_entity_graph(events):
        nodes, edges = {}, []
        for ev in events:
            gk = ev["graph_keys"]
            exposed = bool(ev["offensive_posture_context"]["known_exposures"])
            for role, node_id in gk.items():
                node = nodes.setdefault(node_id, {
                    "id": node_id, "type": node_id.split(":", 1)[0],
                    "events_count": 0, "has_offensive_exposure": False,
                })
                node["events_count"] += 1
                if exposed and role == "target_node":
                    node["has_offensive_exposure"] = True
            edges.append({
                "event_id": ev["event_id"], "timestamp_utc": ev["timestamp_utc"],
                "from": gk["source_node"], "actor": gk["actor_node"], "to": gk["target_node"],
                "action": ev["event"]["action"],
            })
        return {"nodes": list(nodes.values()), "edges": edges}

    # ----------------------------------------------------------- evaluación
    def _incident(self, rule, state, last_time, seq):
        matched = state["events"]
        return {
            "incident_id": "INC-%s-%02d" % (rule["id"], seq),
            "rule_id": rule["id"],
            "title": rule["title"],
            "description": rule.get("description", ""),
            "severity": rule["severity"],
            "confidence": rule["confidence"],
            "detected_at_utc": matched[-1]["timestamp_utc"],
            "attack_duration_seconds": int((last_time - state["start"]).total_seconds()),
            "correlation_vars": dict(state["vars"]),
            "evidence_merkle_root_sha256": merkle_root(
                [m["forensic_chain"]["raw_log_sha256"] for m in matched]),
            "correlated_events": [{
                "stage_id": stage_id,
                "event_id": m["event_id"],
                "timestamp_utc": m["timestamp_utc"],
                "source_type": m["forensic_chain"]["source_type"],
                "action": m["event"]["action"],
                "actor": m["actor"]["user_name"],
                "source_ip": m["source"]["ip"],
                "target_host": m["target"]["hostname"],
                "command_line": m["process_or_artifact"]["command_line"],
                "raw_log_sha256": m["forensic_chain"]["raw_log_sha256"],
                "chain_seal_sha256": m["forensic_chain"]["chain_seal_sha256"],
                "offensive_exposures": m["offensive_posture_context"]["known_exposures"],
            } for stage_id, m in zip(state["stage_ids"], matched)],
            "mitre_attack": rule["mitre_attack"],
            "grc_compliance_mapping": rule["grc_compliance_mapping"],
        }

    def evaluate_rule(self, rule, timeline):
        stages = rule["correlation"]["stages"]
        window = parse_window(rule["correlation"]["window"])
        active = {}  # group_key -> estado (uno por grupo: evita incidentes duplicados)
        incidents = []
        for ts, ev in timeline:
            for key, state in list(active.items()):
                if ts - state["start"] > window:
                    del active[key]
                    continue
                stage = stages[state["next"]]
                if ev is state["events"][-1] or not self.matches_stage(ev, stage, state["vars"]):
                    continue
                state["events"].append(ev)
                state["stage_ids"].append(stage["stage_id"])
                self._extract(ev, stage, state["vars"])
                state["next"] += 1
                if state["next"] >= len(stages):
                    incidents.append((rule, state, ts))
                    del active[key]
            if self.matches_stage(ev, stages[0], {}):
                variables = {}
                self._extract(ev, stages[0], variables)
                key = self._group_key(rule, ev, variables)
                if len(stages) == 1:
                    incidents.append((rule, {"start": ts, "events": [ev], "vars": variables,
                                             "stage_ids": [stages[0]["stage_id"]], "next": 1}, ts))
                elif key not in active:
                    active[key] = {"start": ts, "events": [ev], "vars": variables,
                                   "stage_ids": [stages[0]["stage_id"]], "next": 1}
        return incidents

    def evaluate_events(self, normalized_events):
        timeline = sorted(((parse_utc(e["timestamp_utc"]), e) for e in normalized_events),
                          key=lambda pair: pair[0])
        ordered = [e for _, e in timeline]
        incidents = []
        for rule in self.rules:
            for seq, (rule_, state, ts) in enumerate(self.evaluate_rule(rule, timeline), 1):
                incidents.append(self._incident(rule_, state, ts, seq))
        return {
            "total_events_analyzed": len(ordered),
            "total_incidents_correlated": len(incidents),
            "incidents": incidents,
            "entity_graph": self.build_entity_graph(ordered),
        }
