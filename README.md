<p align="center"><img src="docs/assets/favicon.svg" width="72" alt="Logotipo de TRAMA"/></p>

<h1 align="center">TRAMA</h1>

<p align="center"><b>Correlación de evidencias ofensivas, de detección y de cumplimiento con cadena de custodia.</b></p>

<p align="center">
  TRAMA reúne en un único paquete los hallazgos de un pentest, la telemetría del SOC y las no conformidades del ENS, la ISO/IEC 27001 y NIS2. Cada evento queda sellado con SHA-256 y cada incidente, con la raíz de Merkle de sus evidencias. La consola ofrece cinco perspectivas de análisis: pentester, Red Team, Blue Team, Purple Team y GRC.
</p>

<p align="center">
  <a href="https://heindall92.github.io/evidence-correlator/"><img alt="Demo" src="https://img.shields.io/badge/demo-GitHub%20Pages-1A4FE0?style=flat"/></a>
  <a href="LICENSE"><img alt="Licencia GPLv2" src="https://img.shields.io/badge/licencia-GPLv2-4169A1?style=flat"/></a>
  <img alt="Python 3.8 a 3.12" src="https://img.shields.io/badge/Python-3.8%E2%80%933.12-1A3DB8?style=flat&logo=python&logoColor=white"/>
  <img alt="Sin dependencias" src="https://img.shields.io/badge/dependencias-0-2E8B57?style=flat"/>
  <img alt="121 pruebas" src="https://img.shields.io/badge/pruebas-121-2E8B57?style=flat"/>
  <img alt="axe-core: 0 infracciones" src="https://img.shields.io/badge/axe--core-0%20infracciones-2E8B57?style=flat"/>
  <img alt="MITRE ATT&CK" src="https://img.shields.io/badge/MITRE-ATT%26CK-B42318?style=flat"/>
  <img alt="ENS RD 311/2022" src="https://img.shields.io/badge/ENS-RD%20311%2F2022-E07B39?style=flat"/>
  <img alt="NIS2" src="https://img.shields.io/badge/NIS2-art.%2023-7B4FD1?style=flat"/>
  <img alt="Iconos Lucide" src="https://img.shields.io/badge/iconos-Lucide-F56565?style=flat&logo=lucide&logoColor=white"/>
</p>

<p align="center">
  <img src="docs/img/hilo-dark.png" alt="Vista Trazabilidad: carriles de ofensiva, detección y cumplimiento con el incidente seleccionado resaltado en azul eléctrico" width="880"/>
</p>

## Caso de uso

Un pentest detecta que la cuenta de servicio `svc_sql` admite tickets Kerberos con RC4 (`AD-SPN-RC4-001`). Más tarde, el SOC registra una petición TGS con RC4 sobre esa cuenta desde 10.10.14.22 y, 11 minutos y 52 segundos después, un inicio de sesión WinRM de `svc_sql` desde la misma IP. Auditoría necesita saber si se cumple la medida op.acc.5 del ENS, y el responsable de seguridad, si el incidente obliga a notificar conforme a NIS2. Sin correlación, esas tres piezas acaban en tres informes distintos.

TRAMA las une en un incidente con tres capas:

1. **Ofensiva.** Hallazgos de auditoría (BloodHound, LinPEAS, Burp Suite, SQLMap) que describen la exposición conocida de cada activo.
2. **Detección.** Eventos de Windows (EVTX), Linux (auditd) y servidores web, normalizados al esquema `UnifiedEvidenceEvent` v1 (inspirado en OCSF y ECS) y correlacionados con reglas multietapa.
3. **Cumplimiento.** No conformidades sobre el **ENS (RD 311/2022)**, la **ISO/IEC 27001:2022** y la **Directiva NIS2**, con la evidencia sellada que las sustenta y los plazos de notificación del artículo 23.

Cada evento crudo se sella con SHA-256 y se encadena al anterior. Si se modifica un registro, un sello o el paquete exportado, la verificación (en la CLI y en el navegador) lo detecta e indica el bloque afectado.

Requiere **Python 3.8 o superior y solo la librería estándar**. La consola es HTML estático: se abre con doble clic (`file://`) y funciona sin servidor ni conexión a servicios externos.

> **Demo:** <https://heindall92.github.io/evidence-correlator/> (datos de laboratorio ficticios).

---

## Índice

- [Perspectivas por rol](#perspectivas-por-rol)
- [Arranque rápido](#arranque-rápido)
- [Consola](#consola)
- [Capturas](#capturas)
- [Cómo funciona](#cómo-funciona)
- [Cadena de custodia](#cadena-de-custodia)
- [Reglas de correlación](#reglas-de-correlación)
- [CLI](#cli)
- [Calidad](#calidad)
- [Seguridad y privacidad](#seguridad-y-privacidad)
- [Limitaciones conocidas](#limitaciones-conocidas)
- [Estructura](#estructura)
- [Hoja de ruta](#hoja-de-ruta)
- [Ecosistema](#ecosistema)
- [Historial de versiones](#historial-de-versiones)
- [Licencia y avisos](#licencia-y-avisos)
- [Autor y contribuciones](#autor-y-contribuciones)

---

## Perspectivas por rol

Un mismo paquete admite cinco lecturas. La consola abre la perspectiva del rol configurado en el perfil; se cambia desde Inicio o con la tecla `L`.

| Perspectiva | Contenido |
|---|---|
| **Pentester** · Impacto de los hallazgos | Estado de cada hallazgo (explotado, con incidente, etapa y hora, o sin explotación observada) y un bloque de evidencia en Markdown con hashes y raíz de Merkle, listo para el informe. |
| **Red Team** · Ruta de ataque | Cronología de las etapas con su táctica ATT&CK, tiempo de permanencia y tiempo hasta la detección de cada incidente. |
| **Blue Team** · Detección y exposición | Incidentes detectados con su tiempo de detección, exposiciones conocidas sin detección asociada e indicadores (IP, cuentas, hosts y comandos) exportables a CSV. |
| **Purple Team** · Cobertura ATT&CK | Técnicas con regla de correlación, técnicas detectadas en el paquete, hallazgos sin regla asociada y ejercicio recomendado. |
| **GRC y auditoría** · Cumplimiento y notificación | No conformidades por marco con su evidencia sellada y los **plazos del artículo 23 de NIS2** desde la detección: alerta temprana (24 h), notificación (72 h) e informe final (un mes después de la notificación). |

| Pentester | Red Team | Blue Team | Purple Team | GRC y auditoría |
|---|---|---|---|---|
| <img src="docs/img/perspectiva-pentest.png" width="170" alt="Perspectiva pentester: hallazgos explotados y evidencia sellada"/> | <img src="docs/img/perspectiva-red.png" width="170" alt="Perspectiva Red Team: ruta de ataque y tiempos de detección"/> | <img src="docs/img/perspectiva-blue.png" width="170" alt="Perspectiva Blue Team: detecciones, exposiciones sin detección e IOC"/> | <img src="docs/img/perspectiva-purple.png" width="170" alt="Perspectiva Purple Team: cobertura ATT&CK"/> | <img src="docs/img/perspectiva-grc.png" width="170" alt="Perspectiva GRC: no conformidades y plazos NIS2"/> |

## Arranque rápido

```bash
git clone https://github.com/heindall92/evidence-correlator.git && cd evidence-correlator

# 1. Correlacionar los datos de ejemplo y exportar el paquete de evidencias
python3 -m trama run --dashboard-js docs/data/bundle.js

# 2. Verificar el paquete exportado (cadena, eventos crudos y raíces de Merkle)
python3 -m trama verify output/correlated_evidence_bundle.json

# 3. Abrir la consola
xdg-open docs/index.html        # Linux / Kali
open docs/index.html            # macOS

# 4. Pruebas
python3 -m unittest discover -s tests -t .
```

Con datos propios:

```bash
python3 -m trama run \
  --events mis_eventos.json \
  --findings hallazgos_pentest.json \
  --rules reglas/ \
  -o output/caso-2026-10.json \
  --dashboard-js docs/data/bundle.js
```

También se instala como comando: `pip install .` y después `trama run`.

## Consola

`docs/index.html` carga `docs/data/bundle.js`. Los navegadores bloquean `fetch()` en `file://`, de modo que la CLI escribe también el paquete como script. Otro paquete se abre con **Abrir** (`O`) o arrastrándolo a la ventana; los datos no salen del navegador.

| Vista | Qué muestra |
|---|---|
| **Inicio** | Perspectiva del rol configurado en el perfil. |
| **Trazabilidad** | Visualización propia de TRAMA: tres carriles (ofensiva, detección y cumplimiento) sobre el orden de los eventos. Cada incidente se traza desde el hallazgo, por sus eventos, hasta los controles afectados; el seleccionado se resalta con el color de acento. |
| **Incidentes** | Etapas encadenadas con comando, exposición ofensiva y hash de cada evento; técnicas ATT&CK; dictamen por marco; raíz de Merkle. `J` / `K` para recorrerlos. |
| **Cumplimiento** | No conformidades por marco (ENS, ISO/IEC 27001, NIS2) con evidencia e incidentes, plazos NIS2 en una pista lineal y exportación a CSV protegida contra inyección de fórmulas. |
| **Custodia** | La cadena bloque a bloque. **Verificar** (`V`) recalcula en el navegador cada sello, el hash de cada evento crudo y las raíces de Merkle; **Simular manipulación** altera un bloque en memoria para mostrar cómo se detecta. |
| **Eventos** | Tabla filtrable de eventos normalizados con el JSON completo de cada uno. |
| **Entidades** | Origen → actor → destino de cada evento, con los activos expuestos marcados. |

**Estructura de la interfaz.** Lateral con el paquete abierto, la navegación, los 7 colores de acento (azul eléctrico por defecto) y el perfil; barra superior con búsqueda `Ctrl K`, selector `ES | EN`, tema, ajustes y ayuda. En móvil, barra inferior con cuatro destinos y menú «Más».

- **Ajustes:** tema, acento, densidad, movimiento (sistema o reducido), abrir paquete, volver a la demo y borrado de preferencias en dos pasos.
- **Perfil:** nombre, organización y rol, que fija la perspectiva inicial. Se guarda solo en este navegador.
- **Ayuda:** guía, método (generado desde las constantes de la consola, como los plazos NIS2), datos y CLI, atajos, glosario y acerca de (autor, avisos de independencia, ecosistema y soporte).
- **Movimiento:** criterios de Emil Kowalski para interfaces de Apple. Escala 0,97 al pulsar, muelles sin rebote y un único fundido coordinado de 0,32 s al cambiar de tema. Con movimiento reducido, todas las transiciones pasan a fundido.

| Atajo | Acción |
|---|---|
| `Ctrl K` · `/` | Buscar incidentes, eventos, controles, técnicas o hashes |
| `1`–`7` | Ir a una vista |
| `L` | Cambiar de perspectiva |
| `J` / `K` | Incidente siguiente / anterior |
| `V` | Verificar la cadena de custodia |
| `T` | Alternar tema |
| `O` | Abrir un paquete JSON |
| `[` | Plegar el lateral |
| `?` | Ayuda |

**GitHub Pages.** La consola está en `docs/`: en *Settings → Pages* se selecciona la rama principal y la carpeta `/docs`. Solo deben publicarse paquetes de ejemplo, ya que un paquete real contiene registros de la organización.

## Capturas

Generadas con `python3 scripts/screenshots.py` (Playwright, Chromium headless, 1440 y 390 px).

| Vista | Claro | Oscuro | Móvil |
|---|---|---|---|
| Inicio | <img src="docs/img/inicio-light.png" width="300" alt="Inicio en tema claro"/> | <img src="docs/img/inicio-dark.png" width="300" alt="Inicio en tema oscuro"/> | <img src="docs/img/inicio-mobile.png" width="110" alt="Inicio en móvil"/> |
| Trazabilidad | <img src="docs/img/hilo-light.png" width="300" alt="Trazabilidad en tema claro"/> | <img src="docs/img/hilo-dark.png" width="300" alt="Trazabilidad en tema oscuro"/> | <img src="docs/img/hilo-mobile.png" width="110" alt="Trazabilidad en móvil"/> |
| Incidentes | <img src="docs/img/incidentes-light.png" width="300" alt="Incidentes en tema claro"/> | <img src="docs/img/incidentes-dark.png" width="300" alt="Incidentes en tema oscuro"/> | <img src="docs/img/incidentes-mobile.png" width="110" alt="Incidentes en móvil"/> |
| Cumplimiento | <img src="docs/img/cumplimiento-light.png" width="300" alt="Cumplimiento en tema claro"/> | <img src="docs/img/cumplimiento-dark.png" width="300" alt="Cumplimiento en tema oscuro"/> | <img src="docs/img/cumplimiento-mobile.png" width="110" alt="Cumplimiento en móvil"/> |
| Custodia | <img src="docs/img/custodia-light.png" width="300" alt="Custodia en tema claro"/> | <img src="docs/img/custodia-dark.png" width="300" alt="Custodia en tema oscuro"/> | <img src="docs/img/custodia-mobile.png" width="110" alt="Custodia en móvil"/> |
| Eventos | <img src="docs/img/eventos-light.png" width="300" alt="Eventos en tema claro"/> | <img src="docs/img/eventos-dark.png" width="300" alt="Eventos en tema oscuro"/> | <img src="docs/img/eventos-mobile.png" width="110" alt="Eventos en móvil"/> |
| Menú «Más» (móvil) | <img src="docs/img/mas-light.png" width="150" alt="Menú Más en tema claro: vistas en rejilla, cuenta y ayuda agrupadas, idioma y acentos"/> | <img src="docs/img/mas-dark.png" width="150" alt="Menú Más en tema oscuro"/> | |
| Entidades | <img src="docs/img/entidades-light.png" width="300" alt="Entidades en tema claro"/> | <img src="docs/img/entidades-dark.png" width="300" alt="Entidades en tema oscuro"/> | <img src="docs/img/entidades-mobile.png" width="110" alt="Entidades en móvil"/> |

## Cómo funciona

```mermaid
flowchart LR
  subgraph Entradas
    F["Hallazgos ofensivos<br/>BloodHound · LinPEAS · Burp"]
    T["Telemetría cruda<br/>EVTX · auditd · nginx"]
    R["Reglas JSON<br/>etapas + ventana"]
  end
  T --> N["Normalizador<br/>UnifiedEvidenceEvent v1"]
  F --> N
  N --> C["Cadena de custodia<br/>SHA-256 encadenado"]
  N --> E["Motor FSM<br/>secuencias multi-etapa"]
  R --> E
  E --> I["Incidentes<br/>MITRE ATT&CK + raíz de Merkle"]
  I --> G["No conformidades<br/>ENS · ISO 27001 · NIS2"]
  C --> B[("Paquete JSON<br/>sellado")]
  I --> B
  G --> B
  B --> D["Consola web local"]
  B --> V["verify"]
```

1. **Normalización.** Cada evento se lleva al esquema común (actor, origen, destino, proceso o artefacto) y se enriquece con los hallazgos ofensivos del mismo activo. Un hallazgo con SPN o binario concreto solo se asocia a eventos sobre ese SPN o binario; uno genérico, a cualquier evento del host.
2. **Sellado.** Antes de correlacionar, el evento crudo se serializa de forma canónica y se encadena en la cadena de custodia.
3. **Correlación.** Cada regla es una máquina de estados: un evento que cumple la etapa 1 abre un estado por grupo (`group_by`), los eventos posteriores lo hacen avanzar y, si la secuencia se completa dentro de la ventana, se emite un incidente.
4. **Cumplimiento.** El incidente hereda las técnicas MITRE ATT&CK y los controles de la regla; el paquete agrega las no conformidades por marco y enlaza cada una con sus incidentes.

## Cadena de custodia

```mermaid
flowchart LR
  G["Génesis<br/>SHA-256(semilla fija)"] --> B0
  subgraph B0["Bloque 0"]
    H0["raw = SHA-256(evento canónico)"]
    S0["sello = SHA-256(anterior | raw | ingesta)"]
  end
  B0 --> B1
  subgraph B1["Bloque 1"]
    H1["raw"]
    S1["sello"]
  end
  B1 --> BN["… bloque n<br/>sello final"]
  H0 -.-> M
  H1 -.-> M
  BN -.-> M["Raíz de Merkle<br/>RFC 6962"]
```

- **Hash del evento.** `SHA-256` de la serialización canónica del evento: claves ordenadas, sin espacios, UTF-8 y **números escritos como los escribe JavaScript** (`1.0` → `1`, `1e21` → `1e+21`). Así el navegador recalcula exactamente el mismo hash que Python. Para datos sin decimales la salida es idéntica a la de la 0.1.0.
- **Sello.** `SHA-256(sello_anterior | hash_evento | instante_de_ingesta)`. El primer bloque enlaza con un génesis fijo que **no depende del nombre de la herramienta**, para que un cambio de nombre no invalide paquetes anteriores.
- **Merkle.** Esquema de RFC 6962: prefijo `0x00` en hojas y `0x01` en nodos internos, y el nodo impar se promueve sin duplicarse (evita colisiones del tipo CVE-2012-2459).
- **Qué detecta `verify`.** Un sello alterado, un enlace roto, bloques reordenados, un evento crudo modificado, la eliminación del último bloque (comparando con el sello final registrado) y la sustitución de la raíz de Merkle de un incidente.

## Reglas de correlación

Una regla por fichero JSON en `trama/rules/` (o el directorio que pases con `--rules`). Con PyYAML instalado también se aceptan `.yaml`. Las reglas se validan al cargarse: campos obligatorios, severidad, confianza entre 0 y 1, ventana, identificadores de etapa únicos y predicados conocidos.

```json
{
  "id": "CORR-AD-001",
  "title": "Kerberoasting seguido de movimiento lateral por WinRM o SMB",
  "severity": "CRITICAL",
  "confidence": 0.96,
  "correlation": {
    "type": "temporal_sequence",
    "window": "45m",
    "group_by": ["target_service_account"],
    "stages": [
      {
        "stage_id": "stage_1_tgs_request",
        "source_type": "windows_evtx",
        "match": { "event.NativeEventID": 4769, "process_or_artifact.EffectiveTicketEncryption": "0x17" },
        "posture_condition": { "offensive_posture_context.known_exposures.finding_id": "AD-SPN-RC4-001" },
        "extract": { "attacker_ip": "source.ip", "target_service_account": "target.target_user_or_spn" }
      },
      {
        "stage_id": "stage_2_lateral_movement",
        "source_type": "windows_evtx",
        "match": { "event.NativeEventID": [4624, 5140], "event.LogonType": 3,
                   "actor.user_name": "$stage_1_tgs_request.target_service_account" },
        "predicates": {
          "equals_ref": { "source.ip": "$stage_1_tgs_request.attacker_ip" },
          "field_in_list": { "target.port": [5985, 5986, 445] }
        }
      }
    ]
  },
  "mitre_attack": [{ "tactic": "Credential Access", "technique_id": "T1558.003", "technique_name": "Kerberoasting" }],
  "grc_compliance_mapping": {
    "ens_rd_311_2022": [{ "control_id": "op.acc.5", "control_name": "Mecanismo de autenticación", "audit_verdict": "NO_CONFORME_CRITICO", "evidence_summary": "…" }],
    "iso_27001_2022": [{ "control_id": "A.8.5", "control_name": "Autenticación segura", "audit_verdict": "NON_CONFORMITY_MAJOR" }],
    "nis2_directive": [{ "article": "Art. 21.2(i) y (j)", "topic": "Control de acceso y autenticación segura" }]
  }
}
```

| Elemento | Significado |
|---|---|
| `window` | Tiempo máximo entre la primera y la última etapa: `120s`, `45m`, `2h`, `1d`. Un formato desconocido es un error, no un valor por defecto. |
| `group_by` | Variables extraídas o rutas del evento que identifican una secuencia. Hay un estado abierto por grupo, así que un mismo ataque no genera incidentes duplicados. |
| `match` | Igualdad por ruta con punto. Una lista significa «cualquiera de». `$etapa.variable` referencia un valor extraído. La comparación tolera tipos (`"5985"` = `5985`). |
| `posture_condition` | Exige que el activo tenga ese hallazgo ofensivo conocido. |
| `extract` | Guarda valores del evento para etapas posteriores (`variable` y `etapa.variable`). |
| `field_contains_any` | Subcadenas, sin distinguir mayúsculas. |
| `equals_ref` / `not_equals` / `field_in_list` | Igual a una variable, distinto de un valor, dentro de una lista. |
| `require_suid_or_capabilities` | Bit SUID o capability peligrosa (`cap_setuid`, `cap_sys_admin`, …; se ignora el sufijo `+ep`). |

Reglas incluidas:

| Id | Secuencia | MITRE ATT&CK | ENS |
|---|---|---|---|
| `CORR-AD-001` | TGS con RC4 sobre cuenta con SPN expuesto → inicio de sesión de red (tipo 3) por WinRM o SMB desde la misma IP | T1558.003, T1021.006 | op.acc.5, op.acc.6 |
| `CORR-LNX-002` | Enumeración de SUID y capabilities sin privilegios → transición a euid 0 con un binario explotable | T1083, T1548.001 | op.exp.2, mp.sw.2 |
| `CORR-WEB-003` | Inyección SQL con respuesta 200 en el login → `www-data` ejecuta comandos en el mismo host | T1190, T1059.004 | mp.s.2 |

## CLI

```text
python3 -m trama run     [--events F] [--findings F] [--rules DIR|F] [-o SALIDA]
                         [--dashboard-js RUTA] [--no-raw] [--json] [--color auto|always|never]
python3 -m trama verify  PAQUETE.json [--json]
python3 -m trama rules   [--rules DIR|F]
```

- Sin subcomando equivale a `run` con los datos de ejemplo.
- Códigos de salida: `0` correcto, `1` error de entrada (fichero, JSON o regla no válidos), `2` integridad comprometida.
- El color se desactiva fuera de una terminal y con `NO_COLOR`.
- `--no-raw` exporta el paquete sin los eventos crudos (más ligero, pero `verify` ya no puede comprobarlos).
- El paquete lleva `dataset: "demo"` cuando se generó con los datos de ejemplo y `"real"` con datos propios. En la demo, el reloj de los plazos NIS2 se fija 5 horas después de la última detección para que no aparezcan vencidos; con datos reales se usa la hora actual.
- El paquete incluye también un resumen de cada regla (`rules`: técnicas ATT&CK y hallazgos de postura que exige) para las perspectivas Purple y Blue.

## Calidad

**121 pruebas** con `unittest` (compatible con pytest), 18 de ellas en un Chromium real con axe-core.

| Conjunto | Pruebas | Qué cubre |
|---|---:|---|
| `tests/test_custody.py` | 23 | Merkle (vacío, orden, nodo impar, separación de dominio), enlaces, sellos, manipulación, truncado y **números canónicos** como en JavaScript (`1.0`, `1e-7`, `1e16`, `1e21`, `5e-324`) sin cambiar los hashes anteriores |
| `tests/test_correlator.py` | 24 | Las tres reglas, ventana, orden, zonas horarias, referencias, postura, cifrado fuerte, puertos como texto, SUID y capabilities, sin duplicados, grupos independientes |
| `tests/test_pipeline_cli.py` | 15 | Paquete, `verify` con manipulaciones, script del dashboard seguro, CLI y `python -m` sin avisos |
| `tests/test_static.py` | 20 | Redacción profesional con `scripts/redaccion.py` sobre interfaz, documentos, reglas, datos de ejemplo y CLI (y su sensibilidad frente a giros conocidos), logotipo propio, consola sin recursos remotos ni `fetch`, CSP estricta, `innerHTML` solo para iconos vendorizados, iconos existentes, tokens claro/oscuro y 7 acentos, movimiento reducido, paridad y cobertura ES/EN (más de 150 claves), constantes NIS2 24/72/1, datos de ejemplo al día |
| `tests/test_normalizer.py` · `test_rules.py` · `test_timeutil.py` | 21 | Esquema y contexto ofensivo, carga y validación de reglas, tiempo compatible con 3.8 |
| `tests/browser/` | 18 | menú «Más» en móvil a 320 y 390 px; axe (0 infracciones) en las 7 vistas, las 5 perspectivas y todos los diálogos, en claro, oscuro y 390 px; sin desbordamiento horizontal ni iconos vacíos; solo peticiones locales; un paquete con HTML no se ejecuta; paquetes no válidos rechazados; verificación y manipulación; decimales verificados en el navegador; reloj NIS2 de la demo; portapapeles; incidente resaltado en Trazabilidad; teclado y búsqueda; inglés; perfil; ajustes; fundido de tema coordinado; movimiento reducido |

**Redacción.** `scripts/redaccion.py` aplica las reglas de `linkedin-humanizer` adaptadas al español: vocabulario puntuado por densidad (3 marcadores en un párrafo obligan a reescribirlo), revelaciones, paralelismo negativo, tríadas escalonadas, frases cortadas para dar efecto, clichés, falsa sinceridad, rayas y emojis. Recorre la interfaz en ES y EN, los documentos, las reglas, los datos de ejemplo y los mensajes de la CLI; `python3 scripts/redaccion.py --avisos` muestra el informe completo.

Las pruebas de navegador se omiten si Playwright no está instalado (`pip install playwright && python3 -m playwright install chromium`). La CI ejecuta el resto en Python 3.8, 3.9, 3.10, 3.11 y 3.12 y las de navegador en un trabajo aparte, con acciones fijadas por SHA.

## Seguridad y privacidad

- **Sin red.** La consola declara `default-src 'none'` sin `unsafe-inline`; scripts, estilos, fuentes (Geist, OFL) e iconos (Lucide, ISC) están en el repositorio. Sin CDN, analítica ni cookies.
- **Datos no confiables.** Todo lo que viene de un paquete se inserta con `textContent`; el único `innerHTML` es para los SVG de Lucide vendorizados, y una prueba lo comprueba. El paquete incrustado escapa `</` para no cerrar la etiqueta `<script>`.
- **CSV.** Las celdas que empiezan por `=`, `+`, `-`, `@`, tabulador o retorno se neutralizan.
- **Almacenamiento.** Solo preferencias (tema, acento, densidad, movimiento, idioma, perspectiva) y el perfil, en `localStorage` de este navegador.

Más detalles y cómo informar de una vulnerabilidad en [SECURITY.md](SECURITY.md).

## Limitaciones conocidas

- La correlación trabaja sobre ficheros JSON ya exportados; no hay conectores en vivo con SIEM ni EDR.
- El sello registra el instante de ingesta: dos ejecuciones sobre los mismos datos producen sellos distintos (las raíces de Merkle sí coinciden).
- La cadena demuestra integridad, no autoría: aún no hay firma asimétrica del paquete (llega en la 0.3.0 con Ed25519). Mientras tanto, se recomienda firmar el JSON con `minisign` o `gpg --detach-sign`, o anclar el sello final en un registro externo.
- Los plazos NIS2 solo aplican a incidentes significativos de entidades esenciales o importantes; la consola los calcula desde la detección como orientación, no como dictamen jurídico.
- Los mapeos a ENS, ISO/IEC 27001 y NIS2 de las reglas de ejemplo son orientativos y deben revisarse con el auditor.

## Estructura

```text
.
├── trama/                        # paquete Python (solo librería estándar)
│   ├── branding.py               # nombre, lema, slug y autor: único lugar donde se definen
│   ├── cli.py · __main__.py      # CLI: run, verify, rules
│   ├── pipeline.py               # orquestación, resumen GRC y de reglas, verificación de paquetes
│   ├── normalizer.py             # esquema UnifiedEvidenceEvent v1 + contexto ofensivo
│   ├── correlator.py             # motor FSM multietapa y grafo de entidades
│   ├── custody.py                # serialización canónica, cadena SHA-256 y Merkle (RFC 6962)
│   ├── rules.py · timeutil.py    # carga y validación de reglas; tiempo compatible con 3.8
│   ├── rules/                    # reglas incluidas (JSON)
│   └── sample_data/              # hallazgos y telemetría de laboratorio
├── docs/                         # consola (también para GitHub Pages)
│   ├── index.html
│   ├── assets/                   # app.js, app.css, i18n.js, theme-boot.js, sha256.js, fuentes e iconos
│   ├── data/bundle.js            # paquete de ejemplo generado por la CLI
│   └── img/                      # capturas
├── tests/                        # unittest + tests/browser (Playwright y axe-core)
├── scripts/                      # redaccion.py (auditor de estilo), screenshots.py, vendor_icons.py
├── ROADMAP.md
└── .github/workflows/ci.yml
```

## Hoja de ruta

Detalle y criterios de aceptación en [ROADMAP.md](ROADMAP.md).

| Versión | Contenido |
|---|---|
| 0.2.0 ✅ | Nombre definitivo, consola nueva con cinco perspectivas, vista de trazabilidad, plazos NIS2 y verificación en el navegador sin falsos positivos con decimales |
| 0.2.1 ✅ | Redacción profesional de toda la interfaz y la documentación, marca propia y prueba de estilo |
| **0.2.2** ✅ | Menú «Más» del móvil reorganizado según las pautas de iOS |
| 0.3.0 | Firma Ed25519 del paquete (Python puro) y ejercicios guiados por perspectiva |
| 0.4.0 | Importar hallazgos de CTEM-Nexus y ENS AD Auditor y exportar a Rosetta con el sobre `yrd-ecosistema` |
| 0.5.0 | Entregables por rol: dossier de auditoría, informe de impacto, IOC en STIX 2.1 y borradores Sigma |
| 0.6.0 | Más fuentes (Sysmon, auditd, nginx/Apache), reglas de AD y web, plazos DORA |

## Ecosistema

TRAMA forma parte de un conjunto de herramientas GRC y de seguridad de código abierto, en español y locales:

| Herramienta | Para qué |
|---|---|
| [CTEM-Nexus](https://github.com/heindall92/ctem-nexus) | Gestión continua de la exposición: de un Nmap a un plan de remediación con SLA |
| [Rosetta Multinorma](https://github.com/heindall92/rosetta_multinorma) | Equivalencias entre ENS, ISO/IEC 27001, NIS2, DORA, RGPD y leyes LATAM |
| [ENS AD Auditor](https://github.com/heindall92/ens_ad-auditor) | Auditoría de Active Directory frente al ENS |
| [ENS Compliance Studio](https://github.com/heindall92/grc_ens_compliance_studio) | Adecuación al ENS paso a paso |
| [KAIROS](https://github.com/heindall92/kairos) | Continuidad de negocio y BIA |
| [ARGOS](https://github.com/heindall92/argos-grc) | Laboratorio de práctica GRC |
| [MCP-Shield](https://github.com/heindall92/mcp-shield) | Seguridad de servidores MCP |

## Historial de versiones

| Versión | Fecha | Cambios |
|---|---|---|
| 0.2.2 | octubre de 2026 | Menú «Más» del móvil reorganizado: vistas en rejilla, cuenta y ayuda en lista agrupada, idioma segmentado y acentos repartidos; filas por debajo de 360 px. |
| 0.2.1 | octubre de 2026 | Textos de la consola (ES y EN) y de la documentación reescritos con registro profesional, sin preguntas retóricas ni tuteo; «El Hilo» pasa a «Trazabilidad» y «lentes», a «perspectivas»; logotipo propio; prueba automática de redacción. |
| 0.2.0 | octubre de 2026 | Nombre definitivo TRAMA; consola nueva con cinco perspectivas por rol, vista de trazabilidad, plazos NIS2, custodia bloque a bloque, ES/EN, 7 acentos, ajustes, perfil y ayuda; serialización canónica con números como en JavaScript, que elimina el falso positivo con `1.0`; `dataset` y resumen de reglas en el paquete. |
| 0.1.0 | octubre de 2026 | Primera versión pública: paquete instalable, CLI con `run`, `verify` y `rules`, Merkle RFC 6962, verificación de eventos crudos y truncado, `group_by` efectivo. |

Detalle en [CHANGELOG.md](CHANGELOG.md).

## Licencia y avisos

[GNU General Public License v2.0](LICENSE). Fuentes Geist bajo SIL Open Font License 1.1 (`docs/assets/fonts/OFL-geist.txt`); iconos Lucide bajo ISC (`docs/assets/vendor/LICENSE-lucide.txt`); axe-core (solo pruebas) bajo MPL-2.0.

Proyecto independiente, sin relación con ISO, IEC, el CCN, la Comisión Europea ni MITRE. ATT&CK® es marca registrada de The MITRE Corporation. De las normas ISO/IEC solo se citan números de control.

## Autor y contribuciones

<table>
<tr>
<td align="center" width="100%" valign="top">
<b>Yoandy Ramírez Delgado</b><br/>
<sub><b>Diseño y desarrollo</b></sub><br/>
<sub>Junior Pentester · eJPTv2 · GRC · SysAdmin</sub><br/><br/>
<a href="https://www.linkedin.com/in/yoandyrd92/"><img alt="LinkedIn" src="https://img.shields.io/badge/LinkedIn-0A66C2?style=flat&logo=linkedin&logoColor=white"/></a>
<a href="https://github.com/heindall92"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-181717?style=flat&logo=github&logoColor=white"/></a>
<a href="https://yoandyramirez.com"><img alt="Portafolio" src="https://img.shields.io/badge/Portafolio-1A3DB8?style=flat&logo=googlechrome&logoColor=white"/></a>
</td>
</tr>
</table>

Las contribuciones son bienvenidas. Antes de abrir una *pull request*, conviene leer [CONTRIBUTING.md](CONTRIBUTING.md).
