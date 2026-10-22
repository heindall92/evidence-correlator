# Política de seguridad

TRAMA procesa logs reales y hallazgos de auditoría: nombres de usuario, IP internas, comandos ejecutados y vulnerabilidades sin corregir. Un fallo aquí expone información sensible de una organización.

## Versiones con soporte

| Versión | Soporte |
|---|---|
| 0.2.x (rama principal) | ✅ |
| 0.1.x | ❌ (actualiza a 0.2.x) |

## Cómo informar de una vulnerabilidad

**Las vulnerabilidades no deben comunicarse en una *issue* pública.** Vías disponibles:

1. Aviso de seguridad privado de GitHub (*Security → Report a vulnerability*), preferida.
2. Correo a **yoandyramirezdelgado@gmail.com** con el asunto `[SEGURIDAD] TRAMA`.

El informe debe incluir la versión o el *commit*, los pasos para reproducirlo, el impacto y, si existe, un paquete JSON o una regla de ejemplo.

| Plazo | Compromiso |
|---|---|
| 72 h | Acuse de recibo |
| 7 días | Evaluación inicial y severidad (CVSS 4.0) |
| 30 días | Corrección o mitigación para severidad alta o crítica |
| Tras la corrección | Divulgación coordinada y reconocimiento, si quien informa lo desea |

## Alcance

Dentro: el paquete `trama/`, la consola de `docs/`, los scripts de `scripts/` y los flujos de `.github/workflows/`. En especial: evasión de la verificación de custodia, colisiones o ambigüedades en el sellado, XSS o ejecución de código al abrir un paquete, inyección de fórmulas en el CSV, fugas de datos a terceros y cadena de suministro.

Fuera: ataques que requieren acceso al equipo desbloqueado, extensiones maliciosas del navegador e ingeniería social.

## Modelo de amenazas resumido

| Activo | Amenaza | Defensa actual |
|---|---|---|
| Paquete exportado | Alteración de un evento, un sello o un incidente | Cadena SHA-256, raíz de Merkle RFC 6962, `verify` en CLI y navegador |
| Paquete exportado | Sustitución completa por otro paquete coherente | **No cubierto aún** (firma Ed25519 prevista en la 0.4.0): firmar el JSON (minisign, GPG) o anclar el sello final en un registro externo |
| Verificación en el navegador | Discrepancia de serialización entre Python y JavaScript | Números canónicos como en JavaScript; prueba con `1.0`, `1e-7` y `1e21` en Chromium |
| Consola web | Paquete malicioso con HTML o scripts | `textContent` en todo dato del paquete (el único `innerHTML` es para iconos Lucide vendorizados), CSP `default-src 'none'` sin `unsafe-inline`, sin `eval`; prueba de XSS en Chromium |
| Consola web | Paquete con forma no válida | Validación de la estructura antes de mostrarlo; se rechaza con un aviso |
| Consola web | Fuga de datos a terceros | Sin recursos remotos; `connect-src 'none'` |
| CSV exportado (no conformidades, IOC) | Inyección de fórmulas | Prefijo `'` en celdas que empiezan por `= + - @`, tabulador o retorno |
| Cadena de suministro | Dependencias o acciones comprometidas | Cero dependencias en tiempo de ejecución; acciones de CI fijadas por SHA; `persist-credentials: false` |

## Buenas prácticas de uso

- No publicar en GitHub Pages paquetes con datos reales.
- El perfil (nombre, organización, rol) y las preferencias se guardan solo en `localStorage` del navegador y se borran desde Ajustes.
- El último análisis importado (que puede contener registros reales de la organización) se guarda en IndexedDB solo si se marca «Recordar este análisis» al importar; Ajustes → «Olvidar el último análisis» lo elimina. En equipos compartidos conviene desmarcarlo.
- Los ficheros importados se tratan como hostiles: XML sin DTD ni entidades, textos recortados, límite de 50 MB por fichero y de 200 000 eventos y 20 000 hallazgos, y todo su contenido se muestra con `textContent`.
- Conservar el sello final y la raíz de Merkle del paquete en un registro independiente (ticket, acta o correo firmado).
- Ejecutar `verify` antes de entregar un paquete como evidencia.
