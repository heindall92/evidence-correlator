import copy
import json
import os

from proyecto.custody import CustodyChain
from proyecto.normalizer import EvidenceNormalizer
from proyecto.pipeline import SAMPLE_EVENTS, SAMPLE_FINDINGS
from proyecto.rules import load_rules

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def sample_events():
    return load(SAMPLE_EVENTS)


def sample_findings():
    return load(SAMPLE_FINDINGS)


def sample_rules():
    return load_rules()


def fixed_clock():
    """Reloj determinista para que los sellos sean reproducibles."""
    state = {"n": 0}

    def clock():
        state["n"] += 1
        return "2026-10-21T10:00:%02d.000000Z" % state["n"]
    return clock


def normalize_all(events=None, findings=None):
    chain = CustodyChain(clock=fixed_clock())
    norm = EvidenceNormalizer(chain, sample_findings() if findings is None else findings)
    events = sample_events() if events is None else events
    return chain, [norm.normalize(e, i) for i, e in enumerate(events)]


def deep(obj):
    return copy.deepcopy(obj)
