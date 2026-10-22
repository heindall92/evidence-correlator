"""Interfaz de línea de comandos."""
import argparse
import json
import os
import sys

from . import __version__
from .branding import NAME, SLUG, TAGLINE
from .pipeline import run_files, verify_bundle, write_bundle, write_dashboard_js
from .rules import RuleError, load_rules, rules_js


class Palette:
    def __init__(self, enabled):
        codes = {"accent": "38;2;77;141;255", "ok": "38;2;52;211;153", "bad": "38;2;248;113;113",
                 "warn": "38;2;251;191;36", "dim": "38;2;148;163;184", "bold": "1"}
        for name, code in codes.items():
            setattr(self, name, ("\033[%sm" % code) if enabled else "")
        self.reset = "\033[0m" if enabled else ""


def use_color(flag, stream):
    if flag == "always":
        return True
    if flag == "never" or os.environ.get("NO_COLOR"):
        return False
    return hasattr(stream, "isatty") and stream.isatty()


def banner(c):
    return ("%s%s%s%s %sv%s%s\n%s%s · MITRE ATT&CK · ENS RD 311/2022 · ISO/IEC 27001:2022 · NIS2%s\n"
            % (c.accent, c.bold, NAME, c.reset, c.dim, __version__, c.reset, c.dim, TAGLINE, c.reset))


def _assets(pairs):
    out = {}
    for item in pairs or []:
        name, sep, host = item.partition("=")
        if not sep or not name or not host:
            raise ValueError("--asset espera FICHERO=HOST, no %r" % item)
        out[name] = host
    return out


def _report(report, c, out):
    for r in report:
        if r.get("error"):
            out.write("%s[✗]%s %s · %s\n" % (c.bad, c.reset, r["file"], r["error"]))
            continue
        extra = (" · activo %s" % r["asset"]) if r.get("asset") else ""
        warn = (" %s(%s)%s" % (c.warn, r["warning"], c.reset)) if r.get("warning") else ""
        skipped = (" · omitidos: %d" % r["skipped"]) if r.get("skipped") else ""
        kind = "eventos" if r["kind"] == "events" else "hallazgos"
        out.write("%s[✓]%s %s · %s · %s: %d%s%s%s\n" % (c.ok, c.reset, r["file"], r["label"], kind, r["count"],
                                                        skipped, extra, warn))


def cmd_import(args, c, out):
    from .importers import import_files
    from .pipeline import read_text
    named = [(os.path.basename(p), read_text(p)) for p in args.files]
    _, _, report = import_files(named, _assets(args.asset))
    if args.json:
        json.dump(report, out, ensure_ascii=False, indent=2)
        out.write("\n")
    else:
        _report(report, c, out)
    return 1 if all(r.get("error") for r in report) else 0


def cmd_run(args, c, out):
    bundle = run_files(args.events, args.findings, args.rules, files=args.files, assets=_assets(args.asset),
                       embed_raw=not args.no_raw)
    write_bundle(bundle, args.output)
    if args.dashboard_js:
        write_dashboard_js(bundle, args.dashboard_js)
    if args.json:
        json.dump({"output": args.output, "integrity": bundle["forensic_custody_verification"],
                   "incidents": bundle["correlation_results"]["total_incidents_correlated"]},
                  out, ensure_ascii=False, indent=2)
        out.write("\n")
        return 0 if bundle["forensic_custody_verification"]["valid"] else 2
    integ = bundle["forensic_custody_verification"]
    res = bundle["correlation_results"]
    out.write(banner(c) + "\n")
    if bundle.get("imports"):
        _report(bundle["imports"], c, out)
        out.write("\n")
    out.write("%s[*]%s Reglas: %d · Hallazgos ofensivos: %d · Eventos ingeridos: %d\n\n" % (
        c.accent, c.reset, len(bundle["rules"]), len(bundle["offensive_findings"]),
        res["total_events_analyzed"]))
    state = (c.ok + "ÍNTEGRA" if integ["valid"] else c.bad + "COMPROMETIDA") + c.reset
    out.write("Cadena de custodia: %s%s%s\n" % (c.bold, state, c.reset))
    out.write("  ├─ Eventos sellados : %d\n" % integ["total_sealed_events"])
    out.write("  └─ Raíz de Merkle   : %s%s%s\n\n" % (c.warn, integ["merkle_root_sha256"], c.reset))
    out.write("%sIncidentes correlacionados: %d%s\n\n" % (c.bold, res["total_incidents_correlated"], c.reset))
    for inc in res["incidents"]:
        sev = c.bad if inc["severity"] == "CRITICAL" else c.warn
        out.write("%s%s■ %s%s  %s\n" % (sev, c.bold, inc["incident_id"], c.reset, inc["title"]))
        out.write("  ├─ Severidad / confianza : %s / %d%%\n" % (inc["severity"], round(inc["confidence"] * 100)))
        out.write("  ├─ Duración de la cadena : %d s\n" % inc["attack_duration_seconds"])
        out.write("  ├─ MITRE ATT&CK          : %s\n" % ", ".join(
            "%s (%s)" % (m["technique_id"], m["tactic"]) for m in inc["mitre_attack"]))
        for ctrl in inc["grc_compliance_mapping"].get("ens_rd_311_2022", []):
            out.write("  ├─ ENS %-8s          : %s%s%s\n" % (ctrl["control_id"], c.bad, ctrl["audit_verdict"], c.reset))
        out.write("  ├─ ISO/IEC 27001:2022    : %s\n" % ", ".join(
            x["control_id"] for x in inc["grc_compliance_mapping"].get("iso_27001_2022", [])))
        out.write("  └─ Merkle del paquete    : %s%s%s\n\n" % (c.dim, inc["evidence_merkle_root_sha256"], c.reset))
    out.write("%s[✓]%s Paquete exportado: %s\n" % (c.ok, c.reset, args.output))
    if args.dashboard_js:
        out.write("%s[✓]%s Datos de la consola: %s\n" % (c.ok, c.reset, args.dashboard_js))
    return 0 if integ["valid"] else 2


def cmd_verify(args, c, out):
    with open(args.bundle, "r", encoding="utf-8") as fh:
        bundle = json.load(fh)
    rep = verify_bundle(bundle)
    if args.json:
        json.dump(rep, out, ensure_ascii=False, indent=2)
        out.write("\n")
    elif rep["valid"]:
        out.write("%s[✓] Paquete íntegro%s · %d eventos · Merkle %s\n"
                  % (c.ok, c.reset, rep["total_sealed_events"], rep["merkle_root_sha256"]))
    else:
        out.write("%s[✗] Paquete alterado%s en el bloque %s: %s\n"
                  % (c.bad, c.reset, rep["broken_at_index"], rep["reason"]))
    return 0 if rep["valid"] else 2


def cmd_rules(args, c, out):
    rules = load_rules(args.rules)
    for r in rules:
        out.write("%s%-14s%s %-8s %3d%%  %d etapas  %s\n" % (
            c.bold, r["id"], c.reset, r["severity"], round(r["confidence"] * 100),
            len(r["correlation"]["stages"]), r["title"]))
    out.write("%s%d reglas válidas%s\n" % (c.ok, len(rules), c.reset))
    return 0


def cmd_rules_js(args, c, out):
    text = rules_js(load_rules(args.rules))
    with open(args.output, "w", encoding="utf-8") as fh:
        fh.write(text)
    out.write("%s[✓]%s Reglas para la consola: %s\n" % (c.ok, c.reset, args.output))
    return 0


def build_parser():
    p = argparse.ArgumentParser(prog=SLUG, description="%s: %s" % (NAME, TAGLINE))
    p.add_argument("--version", action="version", version="%s %s" % (NAME, __version__))
    p.add_argument("--color", choices=("auto", "always", "never"), default="auto",
                   help="salida en color (respeta NO_COLOR)")
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--color", choices=("auto", "always", "never"), default=argparse.SUPPRESS,
                        help="salida en color (respeta NO_COLOR)")
    sub = p.add_subparsers(dest="command")

    r = sub.add_parser("run", parents=[common], help="correlaciona eventos y exporta el paquete de evidencias")
    r.add_argument("files", nargs="*", metavar="FICHERO",
                   help="ficheros nativos (Nmap, Nessus, Nuclei, Burp, BloodHound, LinPEAS, eventos de Windows, "
                        "auditd, logs web, Suricata) o JSON de TRAMA; el formato se detecta solo. "
                        "Sin ficheros se usan los datos de ejemplo")
    r.add_argument("--events", action="append", help="fichero de eventos (equivale a pasarlo como FICHERO)")
    r.add_argument("--findings", action="append", help="fichero de hallazgos (equivale a pasarlo como FICHERO)")
    r.add_argument("--asset", action="append", metavar="FICHERO=HOST",
                   help="host al que pertenece un fichero que no lo indica (logs web, auditd sin node=, LinPEAS)")
    r.add_argument("--rules", help="directorio o fichero de reglas (por defecto: reglas incluidas)")
    r.add_argument("-o", "--output", default=os.path.join("output", "correlated_evidence_bundle.json"))
    r.add_argument("--dashboard-js", metavar="RUTA",
                   help="escribe además el paquete como .js para la consola (p. ej. docs/data/bundle.js)")
    r.add_argument("--no-raw", action="store_true", help="no incrustar los eventos crudos en el paquete")
    r.add_argument("--json", action="store_true", help="resumen en JSON (para scripts)")

    im = sub.add_parser("import", parents=[common], help="detecta el formato de cada fichero sin correlacionar")
    im.add_argument("files", nargs="+", metavar="FICHERO")
    im.add_argument("--asset", action="append", metavar="FICHERO=HOST")
    im.add_argument("--json", action="store_true")

    v = sub.add_parser("verify", parents=[common], help="verifica la integridad de un paquete exportado")
    v.add_argument("bundle")
    v.add_argument("--json", action="store_true")

    ru = sub.add_parser("rules", parents=[common], help="valida y lista las reglas")
    ru.add_argument("--rules", help="directorio o fichero de reglas")

    rj = sub.add_parser("rules-js", parents=[common], help="escribe las reglas para la consola (docs/assets/rules.js)")
    rj.add_argument("--rules", help="directorio o fichero de reglas")
    rj.add_argument("-o", "--output", default=os.path.join("docs", "assets", "rules.js"))
    return p


def main(argv=None, out=None):
    out = out or sys.stdout
    parser = build_parser()
    argv = list(sys.argv[1:] if argv is None else argv)
    args = parser.parse_args(argv)
    if args.command is None:  # sin subcomando: equivale a "run"
        args = parser.parse_args(argv + ["run"])
    c = Palette(use_color(args.color, out))
    handlers = {"run": cmd_run, "import": cmd_import, "verify": cmd_verify, "rules": cmd_rules,
                "rules-js": cmd_rules_js}
    try:
        return handlers[args.command](args, c, out)
    except (OSError, ValueError, RuleError) as exc:
        sys.stderr.write("%s: error: %s\n" % (SLUG, exc))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
