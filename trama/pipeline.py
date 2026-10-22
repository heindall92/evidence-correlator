"""Orquestación: ingesta -> normalización + custodia -> correlación -> paquete."""
import json
import os
from datetime import datetime, timezone

from . import __version__
from .branding import NAME
from .correlator import EvidenceCorrelationEngine
from .custody import CustodyChain, verify_chain
from .normalizer import EvidenceNormalizer, SCHEMA_VERSION
from .rules import load_rules

PKG_DIR = os.path.dirname(os.path.abspath(__file__))
SAMPLE_DIR = os.path.join(PKG_DIR, "sample_data")
SAMPLE_FINDINGS = os.path.join(SAMPLE_DIR, "offensive_findings.json")
SAMPLE_EVENTS = os.path.join(SAMPLE_DIR, "raw_telemetry_events.json")


def load_json_list(path, what):
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, list):
        raise ValueError("%s: se esperaba una lista JSON de %s" % (path, what))
    return data


def summarize_grc(incidents):
    """Agrega las no conformidades por marco normativo."""
    out = {"ens_rd_311_2022": {}, "iso_27001_2022": {}, "nis2_directive": {}}
    for inc in incidents:
        mapping = inc.get("grc_compliance_mapping", {})
        for framework, bucket in out.items():
            for ctrl in mapping.get(framework, []):
                cid = ctrl.get("control_id") or ctrl.get("article")
                entry = bucket.setdefault(cid, dict(ctrl, incidents=[]))
                entry["incidents"].append(inc["incident_id"])
    return {k: list(v.values()) for k, v in out.items()}


def rule_summary(rule):
    """Lo que la consola necesita de cada regla: identidad, técnicas ATT&CK que
    detecta y hallazgos ofensivos que exige (para la cobertura de la perspectiva Purple)."""
    findings = set()
    for stage in rule.get("correlation", {}).get("stages", []):
        for value in (stage.get("posture_condition") or {}).values():
            findings.update(value if isinstance(value, list) else [value])
    out = {k: rule.get(k) for k in ("id", "title", "severity", "confidence", "description")}
    out["mitre_attack"] = [{k: m.get(k) for k in ("tactic", "technique_id", "technique_name")}
                           for m in rule.get("mitre_attack", [])]
    out["posture_findings"] = sorted(str(f) for f in findings)
    return out


def run_pipeline(raw_events, offensive_findings, rules, clock=None, embed_raw=True):
    chain = CustodyChain(clock=clock)
    normalizer = EvidenceNormalizer(chain, offensive_findings)
    normalized = [normalizer.normalize(ev, i) for i, ev in enumerate(raw_events)]
    integrity = chain.verify(raw_events=raw_events)
    correlation = EvidenceCorrelationEngine(rules).evaluate_events(normalized)
    bundle = {
        "generator": {"name": NAME, "version": __version__, "schema_version": SCHEMA_VERSION},
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "forensic_custody_verification": integrity,
        "custody_chain": chain.chain,
        "offensive_findings": offensive_findings,
        "rules": [rule_summary(r) for r in rules],
        "normalized_events": normalized,
        "correlation_results": correlation,
        "grc_summary": summarize_grc(correlation["incidents"]),
    }
    if embed_raw:
        bundle["raw_events"] = raw_events
    return bundle


def run_files(events_path=None, findings_path=None, rules_path=None, **kw):
    raw = load_json_list(events_path or SAMPLE_EVENTS, "eventos")
    findings = load_json_list(findings_path or SAMPLE_FINDINGS, "hallazgos")
    bundle = run_pipeline(raw, findings, load_rules(rules_path), **kw)
    # La consola usa la marca para fijar un reloj de referencia en los plazos
    # (NIS2) en vez de mostrar como vencidos los de unos datos de ejemplo.
    bundle["dataset"] = "demo" if events_path is None and findings_path is None else "real"
    return bundle


def verify_bundle(bundle):
    """Re-verifica un paquete exportado: cadena, eventos crudos (si están),
    raíz global y raíz de Merkle de cada incidente."""
    stored = bundle.get("forensic_custody_verification", {})
    chain = bundle.get("custody_chain")
    if chain is None:
        chain = [e["forensic_chain"] for e in bundle.get("normalized_events", [])]
    report = verify_chain(chain, stored.get("genesis_hash"), bundle.get("raw_events"),
                          stored.get("head_seal_hash"), stored.get("merkle_root_sha256"))
    by_id = {e["event_id"]: e["forensic_chain"]["raw_log_sha256"]
             for e in bundle.get("normalized_events", [])}
    from .custody import merkle_root
    bad = []
    for inc in bundle.get("correlation_results", {}).get("incidents", []):
        hashes = [by_id.get(ev["event_id"]) for ev in inc["correlated_events"]]
        if None in hashes or [ev["raw_log_sha256"] for ev in inc["correlated_events"]] != hashes \
                or merkle_root(hashes) != inc["evidence_merkle_root_sha256"]:
            bad.append(inc["incident_id"])
    report["incidents_failed"] = bad
    if bad and report["valid"]:
        report.update(valid=False, reason="raíz de Merkle de incidente no coincide: " + ", ".join(bad))
    return report


def write_bundle(bundle, path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(bundle, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def write_dashboard_js(bundle, path):
    """Escribe el paquete como script para que el dashboard funcione en file://
    (los navegadores bloquean fetch() de ficheros locales)."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    payload = json.dumps(bundle, ensure_ascii=False, indent=1).replace("</", "<\\/")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("/* Generado por la CLI. No editar a mano. */\nwindow.EVIDENCE_BUNDLE = ")
        fh.write(payload)
        fh.write(";\n")
