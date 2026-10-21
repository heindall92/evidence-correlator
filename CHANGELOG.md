# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según [SemVer](https://semver.org/lang/es/).

## 0.1.0 · octubre de 2026

Primera versión pública, a partir del prototipo inicial del motor (nombre provisional `PROYECTO`).

### Añadido
- Paquete instalable (`pyproject.toml`) con comando `proyecto` y `python3 -m proyecto`.
- CLI con subcomandos `run`, `verify` y `rules`; opciones `--events`, `--findings`, `--rules`, `--output`, `--dashboard-js`, `--no-raw`, `--json` y `--color` (respeta `NO_COLOR`); códigos de salida 0, 1 y 2.
- `verify` sobre paquetes exportados: sellos, enlaces, hash de cada evento crudo, sello final (detecta truncado), raíz global y raíz de Merkle de cada incidente.
- Validación de reglas al cargarlas (campos, severidad, confianza, ventana, etapas y predicados).
- Resumen GRC por marco con los incidentes que sustentan cada no conformidad.
- Consola web nueva: seis secciones, búsqueda global, atajos, ajustes, privacidad, temas claro y oscuro, diseño adaptable, verificación de la custodia en el navegador y simulación de manipulación. CSP estricta, sin recursos remotos, iconos Lucide y fuente Geist vendorizados.
- `scripts/rename.sh` para fijar el nombre definitivo en un paso; `scripts/screenshots.py`; `scripts/vendor_icons.py`.
- 94 pruebas con `unittest` y 6 de navegador (axe-core, Playwright). CI en Python 3.8 a 3.12 con acciones fijadas por SHA.

### Corregido
- **SyntaxWarning** por secuencias de escape no válidas en el banner de la CLI (error en futuras versiones de Python).
- **XSS en el dashboard:** los paquetes abiertos por el usuario se insertaban con `innerHTML`.
- La CLI fallaba con `KeyError` al informar de una cadena rota (el informe de error no tenía las mismas claves) y si no existía `output/`.
- `parse_window` aplicaba 15 minutos en silencio ante un formato desconocido; ahora es un error.
- `get_nested` ignoraba el resto de la ruta al atravesar una lista.
- `group_by` se declaraba en las reglas pero no se usaba: una etapa 1 repetida generaba incidentes duplicados.
- Comparaciones inconsistentes entre tipos (`"5985"` frente a `5985`) en `match` con listas y en `field_in_list`.
- Los eventos se ordenaban como texto: fallaba con zonas horarias distintas o fracciones de segundo de otra longitud. `fromisoformat` no admite `Z` en Python < 3.11.
- `require_suid_or_capabilities` no reconocía capabilities con sufijo (`cap_setuid+ep`).
- La verificación solo comprobaba la coherencia interna de la cadena: no detectaba un log crudo modificado ni la eliminación del último bloque.
- El árbol de Merkle duplicaba el nodo impar y no separaba hojas de nodos (CVE-2012-2459).
- La semilla del génesis dependía del nombre de la herramienta; ahora es fija.
- El normalizador asumía `outcome = success` y la IP `127.0.0.1` cuando faltaban.
- `has_offensive_exposure` en el grafo marcaba también al actor y al origen del evento, no solo al activo expuesto.

### Cambiado
- Reglas en JSON, una por fichero (solo librería estándar); YAML sigue siendo opcional con PyYAML.
- Identificadores de incidente numerados por regla (`INC-CORR-AD-001-01`).
- Las raíces de Merkle cambian respecto al prototipo por el nuevo esquema.
