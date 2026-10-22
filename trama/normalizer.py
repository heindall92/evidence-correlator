"""Normalizador al esquema ``UnifiedEvidenceEvent`` v1 (inspirado en OCSF/ECS).

Transforma eventos crudos (Windows EVTX, Linux auditd, logs web) en un esquema
común, los sella en la cadena de custodia y los enriquece con la postura
ofensiva conocida (hallazgos de pentest previos sobre el mismo activo).
"""
import re

from .timeutil import parse_utc

SCHEMA_VERSION = "1.0.0"


def _is_ip(text):
    return bool(text) and (bool(re.match(r"^[0-9]+$", text.replace(".", ""))) or ":" in text)


def _section(raw, key):
    value = raw.get(key)
    return value if isinstance(value, dict) else {}


def _str_or_empty(value):
    return "" if value is None else str(value)


class EvidenceNormalizer:
    def __init__(self, custody_chain, offensive_findings=None):
        self.custody = custody_chain
        self.offensive_findings = list(offensive_findings or [])
        # Equivalencias entre nombre e IP de un activo, sacadas de los hallazgos que
        # traen ambos (Nmap, Nessus): así casa un hallazgo de Nuclei por IP con un
        # log web que solo conoce el nombre.
        self.aliases = {}
        for f in self.offensive_findings:
            names = {x.lower() for x in (f.get("hostname"), f.get("ip")) if x}
            names |= {n.split(".")[0] for n in list(names) if not _is_ip(n)}
            if len(names) > 1:
                group = set(names)
                for n in names:
                    group |= self.aliases.get(n, set())
                for n in group:
                    self.aliases[n] = group

    def _keys(self, *names):
        keys = set()
        for n in names:
            if not n:
                continue
            n = n.lower()
            keys.add(n)
            if not _is_ip(n):
                keys.add(n.split(".")[0])
            keys |= self.aliases.get(n, set())
        keys.discard("unknown_host")
        return keys

    def match_offensive_context(self, target_host, target_spn=None, target_bin=None, target_ip=None,
                                domain=None, parent_bin=None):
        """Hallazgos ofensivos que afectan al mismo activo.

        - Host: mismo nombre (sin distinguir mayúsculas), mismo nombre corto
          (``DC01`` frente a ``DC01.CORP.LOCAL``), misma IP o equivalencia
          nombre-IP conocida por otro informe.
        - Hallazgos de dominio (BloodHound, ``scope: domain``): cualquier evento
          de un host o un actor de ese dominio.
        - Un hallazgo con SPN o cuenta solo casa con eventos sobre esa cuenta o
          ese SPN; uno con binario, con eventos de ese binario o de un proceso
          hijo suyo; uno genérico de host, con cualquier evento del host.
        """
        matches = []
        host = (target_host or "").lower()
        event_keys = self._keys(target_host, target_ip)
        dom = (domain or "").lower()
        spn = (target_spn or "").lower()
        for finding in self.offensive_findings:
            if finding.get("scope") == "domain":
                f_dom = (finding.get("domain") or "").lower()
                if not f_dom or not (host == f_dom or host.endswith("." + f_dom) or dom == f_dom
                                     or dom == f_dom.split(".")[0]):
                    continue
            else:
                if not (self._keys(finding.get("hostname"), finding.get("ip")) & event_keys):
                    continue
            f_spn = finding.get("target_spn")
            f_bin = finding.get("binary_path")
            if f_spn:
                names = {f_spn.lower()} | {x.lower() for x in finding.get("spns") or []}
                if spn and spn in names:
                    matches.append(finding)
            elif f_bin:
                if f_bin in (target_bin, parent_bin):
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
        parent_bin = proc.get("parent_process_name")
        exposures = self.match_offensive_context(target_host, target_spn, target_bin, tgt.get("ip"),
                                                 actor.get("domain"), parent_bin)
        # El log de auditd no trae las capabilities ni el bit SUID: se toman del
        # hallazgo que describe ese binario (o el de su proceso padre).
        capabilities = list(proc.get("capabilities") or [])
        suid = bool(proc.get("suid_bit", False))
        for f in exposures:
            if f.get("binary_path") and f["binary_path"] in (target_bin, parent_bin):
                capabilities += [c for c in f.get("capabilities") or [] if c not in capabilities]
                suid = suid or bool(f.get("suid"))

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
                "parent_process_name": parent_bin,
                "command_line": proc.get("command_line"),
                "EffectiveTicketEncryption": proc.get("EffectiveTicketEncryption"),
                "suid_bit": suid,
                "capabilities": capabilities,
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
