# Instrucciones para asistentes

## Autoría

- El autor de todo el trabajo es **Yoandy Ramírez Delgado** (`yoandyramirezdelgado@gmail.com`). Siempre debe aparecer él.
- Antes del primer commit en cualquier clon: `git config user.name "Yoandy Ramírez Delgado"` y `git config user.email "yoandyramirezdelgado@gmail.com"`. Comprueba con `git log -1 --format='%an <%ae>'`.
- Ninguna línea de coautoría ni atribución a IA en commits, PR, código o documentación.

## Flujo

- **Una PR por versión:** rama `version/X.Y.Z` desde `main`, pruebas y axe en verde, PR hacia `main`. La fusiona Yoandy.
- La siguiente versión está en `ROADMAP.md` (sección 4). Márcala al avanzar.
- Antes de cada push: `python3 -W error::SyntaxWarning -m unittest discover -s tests -t .` (incluye las de navegador si Playwright está instalado), `python3 -m trama run -o output/bundle.json --dashboard-js docs/data/bundle.js` si cambian el motor o los datos, y `python3 scripts/screenshots.py` si cambia la consola. Revisa las capturas.

## Reglas

- `trama/`: solo librería estándar, Python 3.8+.
- Consola: sin red, funciona en `file://`, CSP estricta sin `unsafe-inline`, datos del paquete solo con `textContent`, todo texto en `docs/assets/i18n.js` (ES y EN).
- Diseño del ecosistema (skill `estilo-yoandy`): iconos solo Lucide, 7 acentos con azul eléctrico por defecto, movimiento de Emil Kowalski (escala 0,97, muelles, movimiento reducido = fundido), WCAG 2.2 AA verificado con axe. La visualización propia es **El Hilo**; nada de anillos (Rosetta) ni franjas por activo (CTEM-Nexus).
- Nunca texto de normas ISO/IEC: solo número de control. Los mapeos son orientativos.
