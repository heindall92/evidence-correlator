#!/usr/bin/env python3
"""Auditor de redacción de TRAMA: detecta los marcadores de texto generado en español e inglés.

Adapta al español las reglas de `linkedin-humanizer` (sergebulaev/linkedin-skills, V3):

- El vocabulario se puntúa por densidad por párrafo: 1 marcador es lengua normal, 2 es un aviso
  y 3 o más es una firma que obliga a reescribir el párrafo.
- Las revelaciones («El resultado:»), el paralelismo negativo («no es X, es Y»), las falsas
  muestras de sinceridad, las frases cortadas para dar efecto, las tríadas escalonadas
  («sin X, sin Y y sin Z»), los clichés y las fugas de herramientas fallan con una sola aparición.
- Raya: como máximo una por cada 100 palabras. Emojis típicos de texto generado: ninguno.
- En la interfaz, además: sin preguntas ni exclamaciones, sin tuteo (ES) ni «you» (EN).

Uso: python3 scripts/redaccion.py            # informe de toda la plataforma
     python3 scripts/redaccion.py --avisos   # incluye también los avisos (2 marcadores)
Código de salida 1 si hay fallos.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# --------------------------------------------------------------------------- un solo caso basta
SINGLE = [
    # Fugas de herramientas y plantillas sin rellenar (nivel forense).
    ("fuga", r"\boaicite\b|\bcontentReference\b|\bturn\d+search\d+\b|\bgrok_card\b|\[(?:Tu|Your) (?:nombre|name|empresa|company)\]|\b20\d\d-XX-XX\b|\[(?:Insertar|Insert|Describe|Describir) [^\]]+\]"),
    ("corte", r"(?i)\b(?:a fecha de mi (?:última actualización|corte)|as of my (?:last update|knowledge cutoff)|my (?:knowledge|training data) (?:cuts off|extends to))\b"),
    # Revelaciones y puentes («El resultado:», «Aquí está el truco»).
    ("revelación", r"(?i)(?:^|[.!?]\s+)(?:el|la|lo) (?:resultado|clave|truco|lección|respuesta|verdad|moraleja|mejor|sorpresa)\s*[?:]|"
                   r"(?:^|[.!?]\s+)the (?:result|outcome|answer|lesson|catch|kicker|truth)\?|"
                   r"(?i:\baquí (?:está|tienes|va) (?:lo que|cómo|por qué|el truco|la clave)|\bhere'?s (?:what|how|why|the thing)\b|"
                   r"\b(?:spoiler|giro de guion|plot twist)\s*:|\bstop \w+[^.\n]{0,40}[.,] ?start\b|\bdeja de \w+[^.\n]{0,40}[.,] ?empieza a\b)"),
    # Paralelismo negativo en sus formas habituales.
    ("paralelismo negativo", r"(?i)\bno (?:es|son|se trata|va)(?: solo| solamente| simplemente| sólo)?(?: de)? [^,.;\n]{1,40}, (?:sino|es|son|se trata de|va de)\b|"
                             r"\bno solo [^.;\n]{1,60}\bsino\b|\bno solamente [^.;\n]{1,60}\bsino\b|"
                             r"\b(?:it'?s|this) (?:isn'?t|is not) (?:just |about )?[^,.;\n]{1,40}, (?:it'?s|but)\b|\bnot just [^,.;\n]{1,40}, (?:it'?s|but)\b|"
                             r"\bnot \w+(?: \w+){0,4}, but \w+"),
    # Falsas muestras de sinceridad y matices fingidos.
    ("sinceridad impostada", r"(?i)\b(?:seamos (?:sinceros|honestos|claros)|para ser (?:sincer[oa]|honest[oa]|claro)|siendo (?:sincer[oa]|honest[oa])|"
                             r"te (?:soy|seré) sincer[oa]|la verdad es que|opinión impopular|con total transparencia|hablando claro|"
                             r"let me be (?:honest|real|direct|clear)|i'?ll be (?:honest|real)|to be (?:honest|direct|transparent)|real talk|"
                             r"full transparency|unpopular opinion|not gonna lie)\b"),
    # Frases cortadas para dar efecto.
    ("staccato", r"(?i)\b(?:sin|no) \w+\. (?:sin|no) \w+\. (?:solo|sólo|just|only) \w+|\btodo (?:el|la|lo) \w+\. nada de\b|\ball (?:of )?the \w+\. none of the\b|"
                 r"^(?:[A-ZÁÉÍÓÚ]\w+\. ){2,}[A-ZÁÉÍÓÚ]\w+\.$|\b(?:¿por qué|why)\? (?:porque|because|simple)\b"),
    # Tríada escalonada: «sin X, sin Y y sin Z», «no X, no Y, no Z».
    ("tríada escalonada", r"(?i)\bsin [^,.;\n]{1,30}, sin [^,.;\n]{1,30},? (?:y|ni|o) sin\b|\bno [^,.;\n]{1,25}, no [^,.;\n]{1,25},? (?:y |ni )?no\b|"
                          r"\bno \w+(?: \w+)?, no \w+(?: \w+)?,? (?:and|or) no\b|\bfaster, cheaper,? and better\b|\bmás rápido, más barato y mejor\b"),
    # Clichés de apertura, cierre y relleno.
    ("cliché", r"(?i)\b(?:en el (?:panorama|mundo|entorno) (?:actual|de hoy|digital)|en la era (?:de la ia|digital)|in today'?s (?:fast-paced )?world|in the age of ai|"
               r"cambio de paradigma|paradigm shift|un antes y un después|punto de inflexión|pivotal moment|sin precedentes|"
               r"(?:al |a )?(?:otro|siguiente|próximo) nivel|next level|de vanguardia|vanguardista|cutting-edge|revolucion\w*|game.?changer|"
               r"cambia las reglas del juego|al final del día|at the end of the day|a fin de cuentas|en definitiva|en resumen,|en conclusión|"
               r"in conclusion|to summarize|in summary,|cabe destacar|es importante (?:destacar|señalar|recordar|tener en cuenta)|"
               r"it'?s (?:important|worth) (?:to note|noting)|vale la pena (?:destacar|mencionar|señalar)|dicho esto|that said,|"
               r"sumérge\w*|sumergirse|adéntrate|adentrarse|delve|deep dive|análisis en profundidad|piedra angular|pieza clave|"
               r"testament to|tapestry|tapiz de|mundo real|real world|sigue el hilo|follow the thread|de un vistazo|at a glance|"
               r"en un (?:solo )?clic|with (?:a single|one) click|sin fisuras|seamless|magia|\bmagic\b|potente|powerful|poderos[oa]|"
               r"imprescindible|must-have|let that sink in|deja que eso cale|that'?s the real story|lo que (?:de verdad|realmente) importa|"
               r"what really matters|move the needle|mover la aguja|built different|doing the heavy lifting|el trabajo pesado|"
               r"what do you think\?|qué opinas\?|thoughts\?|agree or disagree|tag someone|etiqueta a alguien)\b"),
    # Anuncios y autobombo.
    ("anuncio", r"(?i)\b(?:me (?:complace|enorgullece|emociona) (?:anunciar|compartir|presentar)|i'?m (?:excited|thrilled|delighted|proud) to (?:announce|share)|"
                r"honored to|es un honor)\b"),
    # Emojis que la skill asocia a texto generado.
    ("emoji", "[\U0001F4A1\U0001F680\u2728\u267B\U0001F3AF\U0001F4C8\U0001F511\U0001F4AA\U0001F525]"),
]

# --------------------------------------------------------------------------- marcadores por densidad
DENSITY = [
    ("vocabulario", r"(?i)\b(?:significativ\w*|crucial\w*|fundamentalmente|notablemente|particularmente|exhaustiv\w*|robust\w*|"
                    r"aprovech\w*|apalanc\w*|foment\w*|panorama|matices|matizad\w*|multifacétic\w*|holístic\w*|optimiz\w*|agiliz\w*|"
                    r"potencia(?:r|n|ndo)?\b|empodera\w*|utiliz\w*|facilit\w*|desbloque\w*|naveg(?:ar|a|ando)\b|sinergi\w*|"
                    r"transformaci\w*|ecosistema|insights?|valor añadido|esencialmente|en última instancia|ciertamente|"
                    r"definitivamente|indudablemente|sin duda|profundiz\w*|trayectoria|viaje|"
                    r"significant\w*|notably|particularly|comprehensive|leverag\w*|foster\w*|landscape|nuanced|multifaceted|"
                    r"holistic|streamlin\w*|elevat\w*|empower\w*|utiliz\w*|facilitat\w*|harness\w*|unlock\w*|navigat\w*|"
                    r"ecosystem|fundamentally|essentially|ultimately|arguably|certainly|definitely|undoubtedly|journey|realm|"
                    r"paradigm|intricate|cultivat\w*|quietly|compound(?:s|ing)?)\b"),
    ("clave", r"(?i)\b(?:es clave|son clave|(?:aspecto|factor|elemento|punto|papel|rol|paso)s? clave)\b"),
    # Relleno de producto típico del español generado: promesas vagas y adverbios de manera.
    ("relleno de producto", r"(?i)\b(?:garantiz\w*|intuitiv\w*|eficient\w*|eficaz\w*|óptim\w*|fácil(?:mente)?|sencill\w*|"
                            r"integral(?:es)?|esencial(?:es)?|vital(?:es)?|diversos|diversas|amplia (?:gama|variedad)|variedad de|"
                            r"abord\w*|impuls\w*|escalab\w*|de (?:forma|manera) (?!que\b)\w+|permiten? (?:\w+ )?\w+(?:ar|er|ir)\b|"
                            r"list[oa]s? para|de extremo a extremo|sin esfuerzo|todo en uno|experiencia de usuario|a medida|"
                            r"ensur\w*|seamlessly|effortless\w*|intuitive|efficient\w*|ready to|end-to-end|"
                            r"allows? (?:you )?to|enables?|empowers?|cutting-edge)\b"),
    # Conectores de transición al inicio de frase, firma estructural del texto generado.
    ("conector", r"(?:^|[.!?]\s+)(?:Además|Asimismo|Por otro lado|Por otra parte|En este sentido|De este modo|Adicionalmente|"
                 r"Furthermore|Moreover|Additionally|In addition|Overall|Importantly),"),
    ("gerundio inicial", r"(?:^|[.!?]\s+)[A-ZÁÉÍÓÚ][a-záéíóú]+(?:ando|endo|iendo)\b[^.\n]{0,60},|(?:^|[.!?]\s+)[A-Z][a-z]+ing\b[^.\n]{0,60},"),
    ("nominalización", r"(?i)\b(?:la|el) (?:implementaci|optimizaci|utilizaci|realizaci|potenciaci|transformaci|integraci|facilitaci)\w* de\b|"
                       r"\bthe (?:implementation|utilization|optimization|realization|facilitation) of\b"),
    ("matiz fingido", r"(?i)\b(?:quizás?|tal vez|posiblemente|potencialmente|parece que|podría decirse|perhaps|it seems|might be wrong|could potentially)\b"),
]

# --------------------------------------------------------------------------- solo interfaz
QUESTION = r"[¿?¡!]"
TUTEO = r"(?i)\b(?:tu|tus|te|ti|contigo|tienes|puedes|quieres|necesitas|ver[aá]s|elige|pulsa|suelta|arrastra|descubre|conoce)\b"
YOU = r"(?i)\b(?:you|your|yours|you're)\b"


def strip_markdown(text):
    """Quita bloques de código, código en línea, HTML, URL y enlaces para no auditar sintaxis."""
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"`[^`\n]*`", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\]\([^)]*\)", "]", text)
    text = re.sub(r"https?://\S+", " ", text)
    return text


def paragraphs(text):
    """Párrafos separados por línea en blanco; cada fila de tabla y cada viñeta cuenta como uno."""
    out = []
    for block in re.split(r"\n\s*\n", text):
        lines = [l for l in block.split("\n") if l.strip()]
        if not lines:
            continue
        if any(re.match(r"\s*(?:[|*#>-]|\d+\.)", l) for l in lines):
            out.extend(lines)
        else:
            out.append(" ".join(lines))
    return out


def audit_paragraph(p, ui=False, lang="es"):
    """Devuelve (fallos, avisos) de un párrafo como listas de (regla, fragmento)."""
    fails, warns = [], []
    raw = p
    # Lo citado entre comillas se menciona, no se usa: «no es X, es Y» en una guía de estilo no cuenta.
    p = re.sub(r"«[^»]*»|“[^”]*”", "«»", p)
    for name, pat in SINGLE:
        for m in re.finditer(pat, p, re.M):
            fails.append((name, m.group(0)))
    hits = []
    for name, pat in DENSITY:
        for m in re.finditer(pat, p, re.M):
            hits.append((name, m.group(0)))
    if len(hits) >= 3:
        fails.append(("densidad %d" % len(hits), " · ".join(h[1] for h in hits)))
    elif len(hits) == 2:
        warns.append(("densidad 2", " · ".join(h[1] for h in hits)))
    words = len(p.split())
    dashes = p.count("\u2014")
    if dashes > max(1, min(2, round(words / 100.0))):
        fails.append(("rayas", "%d rayas en %d palabras" % (dashes, words)))
    if ui:
        if re.search(QUESTION, p):
            fails.append(("pregunta o exclamación", p))
        m = re.search(TUTEO if lang == "es" else YOU, p)
        if m:
            fails.append(("tuteo" if lang == "es" else "you", m.group(0)))
        # Fragmento final para dar efecto: «Ningún otro dato.» tras otra frase.
        sents = [s for s in re.split(r"(?<=[.])\s+", raw.strip()) if s]
        if len(sents) >= 2 and len(sents[-1].split()) < 4 and not re.search(r"\d|\{", sents[-1]):
            fails.append(("fragmento", sents[-1]))
    triads = re.findall(r"\b[\wÁÉÍÓÚáéíóúñ/.-]+(?: [\wÁÉÍÓÚáéíóúñ/.-]+)?, [\wÁÉÍÓÚáéíóúñ/.-]+(?: [\wÁÉÍÓÚáéíóúñ/.-]+)?,? (?:y|e|o|and|or) [\wÁÉÍÓÚáéíóúñ]", p)
    if len(triads) >= 3:
        warns.append(("tríadas", "%d enumeraciones de tres en un párrafo" % len(triads)))
    return fails, warns


def read(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as fh:
        return fh.read()


def load_i18n():
    s = read("docs", "assets", "i18n.js")
    return json.loads(s[s.index("{"):s.rindex("}") + 1])


def sources():
    """Todos los textos de la plataforma: (origen, párrafo, es_interfaz, idioma)."""
    i18n = load_i18n()
    for lang in ("es", "en"):
        for k, v in i18n[lang].items():
            yield "i18n.js %s:%s" % (lang, k), v, True, lang
    # Todos los documentos de la raíz; el historial se audita aparte (solo la última versión).
    for name in sorted(f for f in os.listdir(ROOT) if f.endswith(".md") and f != "CHANGELOG.md"):
        text = strip_markdown(read(name))
        for i, p in enumerate(paragraphs(text)):
            yield "%s §%d" % (name, i + 1), p, False, "es"
    log = strip_markdown(read("CHANGELOG.md"))
    latest = log.split("\n## ")[1] if "\n## " in log else log  # solo la versión más reciente
    for i, p in enumerate(paragraphs(latest)):
        yield "CHANGELOG.md (última) §%d" % (i + 1), p, False, "es"
    html = read("docs", "index.html")
    for m in re.finditer(r'<meta name="description" content="([^"]+)"', html):
        yield "index.html meta", m.group(1), False, "es"
    rules_dir = os.path.join(ROOT, "trama", "rules")
    for fn in sorted(os.listdir(rules_dir)):
        r = json.loads(read("trama", "rules", fn))
        yield "%s title" % fn, r["title"], False, "es"
        yield "%s description" % fn, r.get("description", ""), False, "es"
        for items in r.get("grc_compliance_mapping", {}).values():
            for it in items:
                for key in ("control_name", "topic", "evidence_summary"):
                    if it.get(key):
                        yield "%s %s" % (fn, key), it[key], False, "es"
    for f in json.loads(read("trama", "sample_data", "offensive_findings.json")):
        yield "offensive_findings %s" % f["finding_id"], f["description"], False, "es"
    # Mensajes y ayuda de la CLI y del motor: toda cadena con texto en español.
    import ast
    pyfiles = sorted(os.path.relpath(os.path.join(d, f), os.path.join(ROOT, "trama"))
                     for d, _, fs in os.walk(os.path.join(ROOT, "trama")) for f in fs if f.endswith(".py"))
    for fn in pyfiles:
        if fn.endswith(".py"):
            tree = ast.parse(read("trama", fn))
            for node in ast.walk(tree):
                if isinstance(node, ast.Constant) and isinstance(node.value, str) and re.search(r"[a-záéíóúñ]{3,} [a-záéíóúñ]{2,}", node.value):
                    yield "trama/%s:%d" % (fn, node.lineno), node.value, False, "es"
    from_branding = re.search(r'TAGLINE = "([^"]+)"', read("trama", "branding.py"))
    yield "branding TAGLINE", from_branding.group(1), False, "es"


def audit():
    fails, warns = [], []
    for origin, text, ui, lang in sources():
        f, w = audit_paragraph(text, ui=ui, lang=lang)
        fails += [(origin, r, x) for r, x in f]
        warns += [(origin, r, x) for r, x in w]
    return fails, warns


def main(argv):
    fails, warns = audit()
    for origin, rule, frag in fails:
        print("FALLO  %-34s %-24s %s" % (origin[:34], rule, frag[:110]))
    if "--avisos" in argv:
        for origin, rule, frag in warns:
            print("aviso  %-34s %-24s %s" % (origin[:34], rule, frag[:110]))
    print("%d fallos · %d avisos" % (len(fails), len(warns)))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
