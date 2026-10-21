"""Cadena de custodia forense: SHA-256 encadenado + raíz de Merkle.

Cada evento crudo se serializa de forma canónica, se calcula su SHA-256 y se
encadena con el sello del bloque anterior. La raíz de Merkle resume todas las
hojas y permite demostrar la integridad de un paquete de evidencias.

El árbol de Merkle sigue el esquema de RFC 6962: prefijo ``0x00`` en hojas y
``0x01`` en nodos internos (separación de dominio) y el nodo impar se promueve
sin duplicarse, lo que evita colisiones del tipo CVE-2012-2459.
"""
import hashlib
import json
from datetime import datetime, timezone

GENESIS_SEED = b"EVIDENCE_CUSTODY_GENESIS_v1"


def sha256_hex(data):
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def canonical_json(payload):
    """Serialización canónica usada para el hash de cada evento crudo."""
    return json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def _leaf(hex_hash):
    return hashlib.sha256(b"\x00" + bytes.fromhex(hex_hash)).digest()


def _node(left, right):
    return hashlib.sha256(b"\x01" + left + right).digest()


def merkle_root(hashes):
    """Raíz de Merkle (hex) de una lista de hashes SHA-256 en hexadecimal."""
    if not hashes:
        return sha256_hex(b"")
    level = [_leaf(h) for h in hashes]
    while len(level) > 1:
        nxt = [_node(level[i], level[i + 1]) for i in range(0, len(level) - 1, 2)]
        if len(level) % 2 == 1:
            nxt.append(level[-1])
        level = nxt
    return level[0].hex()


def _utc_now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


class CustodyChain:
    """Cadena de bloques de custodia, uno por evento ingerido."""

    def __init__(self, clock=None):
        self.chain = []
        self.genesis_hash = sha256_hex(GENESIS_SEED)
        self._clock = clock or _utc_now

    @staticmethod
    def seal_of(previous_hash, raw_hash, ingested_at):
        return sha256_hex("%s|%s|%s" % (previous_hash, raw_hash, ingested_at))

    def seal_event(self, raw_payload, source_type, source_file, record_number):
        raw_hash = sha256_hex(canonical_json(raw_payload))
        prev_hash = self.chain[-1]["chain_seal_sha256"] if self.chain else self.genesis_hash
        ingested_at = self._clock()
        block = {
            "index": len(self.chain),
            "source_type": source_type,
            "source_file": source_file,
            "record_number": record_number,
            "raw_log_sha256": raw_hash,
            "previous_node_hash": prev_hash,
            "chain_seal_sha256": self.seal_of(prev_hash, raw_hash, ingested_at),
            "ingested_at_utc": ingested_at,
        }
        self.chain.append(block)
        return block

    def verify(self, raw_events=None, expected_head=None, expected_merkle_root=None):
        return verify_chain(self.chain, self.genesis_hash, raw_events,
                            expected_head, expected_merkle_root)


def verify_chain(chain, genesis_hash=None, raw_events=None,
                 expected_head=None, expected_merkle_root=None):
    """Verifica una cadena de custodia.

    - Enlaces ``previous_node_hash`` y sellos recalculados.
    - Si se pasan ``raw_events``, recalcula el hash de cada evento crudo
      (detecta la alteración del log original, no solo de la cadena).
    - ``expected_head`` / ``expected_merkle_root`` permiten detectar el
      truncado o la sustitución completa de la cadena.

    Devuelve siempre las mismas claves; ``valid`` indica el resultado.
    """
    genesis = genesis_hash or sha256_hex(GENESIS_SEED)
    report = {
        "valid": True,
        "total_sealed_events": len(chain),
        "genesis_hash": genesis,
        "head_seal_hash": None,
        "merkle_root_sha256": None,
        "broken_at_index": None,
        "reason": None,
    }

    def fail(idx, reason):
        report.update(valid=False, broken_at_index=idx, reason=reason)
        return report

    if raw_events is not None and len(raw_events) != len(chain):
        return fail(min(len(raw_events), len(chain)),
                    "número de eventos crudos (%d) distinto del de bloques (%d)"
                    % (len(raw_events), len(chain)))

    prev = genesis
    for idx, block in enumerate(chain):
        if block.get("previous_node_hash") != prev:
            return fail(idx, "previous_node_hash no coincide con el bloque anterior")
        expected = CustodyChain.seal_of(block["previous_node_hash"], block.get("raw_log_sha256"),
                                        block.get("ingested_at_utc"))
        if block.get("chain_seal_sha256") != expected:
            return fail(idx, "chain_seal_sha256 alterado")
        if raw_events is not None:
            if sha256_hex(canonical_json(raw_events[idx])) != block["raw_log_sha256"]:
                return fail(idx, "el evento crudo no coincide con raw_log_sha256")
        prev = block["chain_seal_sha256"]

    report["head_seal_hash"] = prev
    report["merkle_root_sha256"] = merkle_root([b["raw_log_sha256"] for b in chain])
    if expected_head is not None and expected_head != prev:
        return fail(len(chain), "el sello final no coincide (cadena truncada o sustituida)")
    if expected_merkle_root is not None and expected_merkle_root != report["merkle_root_sha256"]:
        return fail(len(chain), "la raíz de Merkle no coincide con la esperada")
    return report
