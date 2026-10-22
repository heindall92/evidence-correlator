# Cómo contribuir

Gracias por el interés. Estas pautas mantienen el repositorio pequeño, auditable y sin dependencias.

## Principios

- **Solo librería estándar** en `trama/`, compatible con Python 3.8. Lo opcional (PyYAML, Playwright) nunca es obligatorio.
- **La consola funciona sin red y en `file://`.** Nada de CDN, fuentes remotas ni analítica. Los datos de un paquete se insertan siempre con `textContent`.
- **El nombre se define en un solo lugar** (`trama/branding.py`). No se escribe a mano en otros módulos de Python.
- **Todo texto visible de la consola va en `docs/assets/i18n.js`** en español y en inglés; una prueba exige las mismas claves en los dos idiomas.
- **Diseño:** superficies lisas (sin rejillas, puntos ni texturas de fondo), WCAG 2.2 AA con axe, un único acento de los 7 del ecosistema, solo iconos Lucide (vendorizados con `scripts/vendor_icons.py`) y nada de anillos ni gráficos circulares. La visualización propia es Trazabilidad y el logotipo es una marca propia (no un icono de Lucide).
- **Redacción:** registro profesional e impersonal, títulos nominales, sin preguntas retóricas, tuteo, exclamaciones ni fórmulas de relleno. `ProfessionalCopyTest` lo comprueba.
- **Sin estilos ni scripts en línea:** la CSP no admite `unsafe-inline`.

## Flujo

```bash
python3 -m unittest discover -s tests -t .          # todas las pruebas
python3 -m trama run --dashboard-js docs/data/bundle.js   # si cambias el motor o los datos
python3 scripts/screenshots.py                       # si cambias la consola
python3 -m unittest tests.browser.test_dashboard_browser  # axe y e2e (requiere Playwright)
```

1. Abrir una *issue* que describa el cambio, salvo correcciones triviales.
2. Crear una rama `version/X.Y.Z` desde la principal: una *pull request* por versión.
3. Añadir pruebas: cada regla nueva necesita al menos un caso positivo y uno negativo en `tests/test_correlator.py`.
4. Actualizar `CHANGELOG.md` en la sección de la próxima versión.
5. Abrir la *pull request*; la CI debe pasar en Python 3.8 a 3.12 y axe sin infracciones.

## Reglas nuevas

- Un fichero JSON por regla en `trama/rules/`, con `id` único (`CORR-<ÁMBITO>-<NNN>`).
- Técnicas MITRE ATT&CK con identificador válido (`T1234` o `T1234.001`).
- Mapeos ENS, ISO/IEC 27001 y NIS2 con la evidencia que justifica el dictamen. De las normas ISO/IEC, solo el número de control y un nombre breve propio, nunca su texto. Las dudas sobre un control se indican en la *pull request*.
- Datos de ejemplo sin información real: IP de laboratorio y dominios `.local`.

## Commits

Mensajes en español, en imperativo y concisos (`Corrige el orden de eventos con zonas horarias distintas`). Sin líneas de coautoría automáticas.

## Licencia

Toda contribución se publica bajo la [GPL-2.0](LICENSE).
