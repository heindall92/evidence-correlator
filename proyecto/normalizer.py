"""Normalizador al esquema ``UnifiedEvidenceEvent`` v1 (inspirado en OCSF/ECS).

Transforma eventos crudos (Windows EVTX, Linux auditd, logs web) en un esquema
común, los sella en la cadena de custodia y los enriquece con la postura
ofensiva conocida (hallazgos de pentest previos sobre el mismo activo).
"""
from .timeutil import parse_utc

SCHEMA_VERSION = "1.0.0"


def _section(raw, key):
    value = raw.get(key)
    return value if isinstance(value, dict) else {}


def _str_or_empty(value):
    return "" if value is None else str(value)


class EvidenceNormalizer:
    def __init__(self, custody_chain, offensive_findings=None):
        self.custody = custody_chain
        self.offensive_findings = list(offensive_findings or [])

    def match_offensive_context(self, target_host, target_spn=None, target_bin=None):
        """Hallazgos ofensivos que afectan al mismo activo.

        Un hallazgo con SPN o binario concreto solo casa si el evento afecta a
        ese SPN/binario; un hallazgo genérico de host casa con cualquier evento
        de ese host.
        """
        matches = []
        host = (target_host or "").lower()
        for finding in self.offensive_findings:
            f_host = (finding.get("hostname") or "").lower()
            if not f_host or f_host != host:
                continue
            f_spn = finding.get("target_spn")
            f_bin = finding.get("binary_path")
            if f_spn:
                if target_spn and f_spn.lower() == target_spn.lower():
                    matches.append(finding)
            elif f_bin:
                if target_bin and f_bin == target_bin:
                    matches.append(finding)
            else:
                matches.append(finding)
        return matches

    def normalize(self, raw_event, index):
        if not isinstance(raw_event, dict):
            raise ValueError("evento %d: se esperaba un objeto JSON" % index)
        ts = raw_event.get("timestamp_utc")
        try:
            parse_utc(ts)
        except ValueError:
            raise ValueError("evento %d: timestamp_utc ausente o no válido (%r)" % (index, ts))

        source_type = raw_event.get("source_type", "generic_log")
        custody_block = self.custody.seal_event(
            raw_payload=raw_event,
            source_type=source_type,
            source_file=raw_event.get("source_file", "unknown.log"),
            record_number=raw_event.get("record_number", index + 1),
        )

        ev, actor, src, tgt, proc = (_section(raw_event, k) for k in
                                     ("event", "actor", "source", "target", "process_or_artifact"))
        target_host = tgt.get("hostname", "UNKNOWN_HOST")
        target_spn = tgt.get("target_user_or_spn")
        target_bin = proc.get("process_name")
        exposures = self.match_offensive_context(target_host, target_spn, target_bin)

        actor_user = actor.get("user_name", "anonymous")
        actor_domain = actor.get("domain", "LOCAL")
        source_ip = src.get("ip") or "0.0.0.0"

        return {
            "schema_version": SCHEMA_VERSION,
            "event_id": raw_event.get("event_id", "evt-%04d" % (index + 1)),
            "timestamp_utc": ts,
            "forensic_chain": custody_block,
            "event": {
                "category": ev.get("category", "unknown"),
                "action": ev.get("action", "unknown"),
                "NativeEventID": ev.get("NativeEventID"),
                "LogonType": ev.get("LogonType"),
                "http_status": ev.get("http_status"),
                "outcome": ev.get("outcome", "unknown"),
                "severity_base": ev.get("severity_base", 50),
            },
            "actor": {
                "user_name": actor_user,
                "user_sid": actor.get("user_sid"),
                "uid": _str_or_empty(actor.get("uid")),
                "euid": _str_or_empty(actor.get("euid")),
                "domain": actor_domain,
                "session_id": actor.get("session_id"),
                "privileges": list(actor.get("privileges") or []),
            },
            "source": {
                "ip": source_ip,
                "port": src.get("port"),
                "hostname": src.get("hostname", "UNKNOWN"),
            },
            "target": {
                "hostname": target_host,
                "ip": tgt.get("ip"),
                "port": tgt.get("port"),
                "service_name": tgt.get("service_name"),
                "target_user_or_spn": target_spn,
                "resource_path": tgt.get("resource_path"),
            },
            "process_or_artifact": {
                "process_name": target_bin,
                "command_line": proc.get("command_line"),
                "EffectiveTicketEncryption": proc.get("EffectiveTicketEncryption"),
                "suid_bit": bool(proc.get("suid_bit", False)),
                "capabilities": list(proc.get("capabilities") or []),
                "file_sha256": proc.get("file_sha256"),
            },
            "offensive_posture_context": {
                "asset_criticality": "HIGH" if exposures else "MEDIUM",
                "known_exposures": exposures,
            },
            "graph_keys": {
                "actor_node": "USER:%s\\%s" % (actor_domain, actor_user),
                "source_node": "IP:%s" % source_ip,
                "target_node": ("SPN:%s" % target_spn) if target_spn else ("HOST:%s" % target_host),
            },
        }
