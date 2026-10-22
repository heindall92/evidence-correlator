// Arnés de paridad CLI ↔ consola. Lee por stdin {mode, files, assets, events, findings} y escribe el resultado.
// mode "import": importFiles; "files": runFiles; "pipeline": runPipeline sobre eventos y hallazgos ya en JSON.
// El reloj de custodia es el mismo que usa tests/test_parity.py: 2026-10-22T10:00:00.NNNNNNZ con NNNNNN = 0, 1, 2…
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..", "..", "docs", "assets");
const ctx = { console, TextEncoder, TextDecoder };
ctx.globalThis = ctx;
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ["sha256.js", "importers.js", "rules.js", "engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
}
const input = JSON.parse(fs.readFileSync(0, "utf8"));
let tick = 0;
const opts = { clock: () => "2026-10-22T10:00:00." + String(tick++).padStart(6, "0") + "Z", now: Date.UTC(2026, 9, 22, 10) };
let out;
if (input.mode === "import") {
  const r = ctx.TRAMA_IMPORT.importFiles(input.files, input.assets || {});
  out = { events: r[0], findings: r[1], report: r[2] };
} else if (input.mode === "files") {
  out = ctx.TRAMA_ENGINE.runFiles(input.files, input.assets || {}, opts);
} else {
  out = ctx.TRAMA_ENGINE.runPipeline(input.events, input.findings, ctx.TRAMA_RULES, opts);
}
process.stdout.write(JSON.stringify(out));
