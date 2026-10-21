# Cómo contribuir

Gracias por el interés. Estas pautas mantienen el repositorio pequeño, auditable y sin dependencias.

## Principios

- **Solo librería estándar** en `proyecto/`, compatible con Python 3.8. Lo opcional (PyYAML, Playwright) nunca es obligatorio.
- **La consola funciona sin red y en `file://`.** Nada de CDN, fuentes remotas ni analítica. Los datos de un paquete se insertan siempre con `textContent`.
- **El nombre se define en un solo lugar** (`proyecto/branding.py` y el marcador `PROYECTO`). No lo escribas a mano en otros módulos.
- **Diseño:** superficies lisas (sin rejillas, puntos ni texturas de fondo), contraste cercano a 7:1, un único acento y solo iconos Lucide.

## Flujo

```bash
python3 -m unittest discover -s tests -t .          # todas las pruebas
python3 -m proyecto run --dashboard-js docs/data/bundle.js   # si cambias el motor o los datos
python3 scripts/screenshots.py                       # si cambias la consola
```

1. Abre una *issue* describiendo el cambio, salvo correcciones triviales.
2. Crea una rama desde la principal.
3. Añade pruebas: cada regla nueva necesita al menos un caso positivo y uno negativo en `tests/test_correlator.py`.
4. Actualiza `CHANGELOG.md` en la sección de la próxima versión.
5. Abre la *pull request*; la CI debe pasar en Python 3.8 a 3.12.

## Reglas nuevas

- Un fichero JSON por regla en `proyecto/rules/`, con `id` único (`CORR-<ÁMBITO>-<NNN>`).
- Técnicas MITRE ATT&CK con identificador válido (`T1234` o `T1234.001`).
- Mapeos ENS, ISO/IEC 27001 y NIS2 con la evidencia que justifica el dictamen. Si no estás seguro de un control, indícalo en la *pull request*.
- Datos de ejemplo sin información real: IP de laboratorio y dominios `.local`.

## Commits

Mensajes en español, en imperativo y concisos (`Corrige el orden de eventos con zonas horarias distintas`).

## Licencia

Al contribuir aceptas que tu aportación se publique bajo la [GPL-2.0](LICENSE).
