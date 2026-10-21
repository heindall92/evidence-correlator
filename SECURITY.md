# Política de seguridad

PROYECTO procesa logs reales y hallazgos de auditoría: nombres de usuario, IP internas, comandos ejecutados y vulnerabilidades sin corregir. Un fallo aquí expone información sensible de una organización.

## Versiones con soporte

| Versión | Soporte |
|---|---|
| 0.1.x (rama principal) | ✅ |

## Cómo informar de una vulnerabilidad

**No abras una *issue* pública.** Usa una de estas vías:

1. Aviso de seguridad privado de GitHub (*Security → Report a vulnerability*), preferida.
2. Correo a **yoandyramirezdelgado@gmail.com** con el asunto `[SEGURIDAD] PROYECTO`.

Incluye versión o *commit*, pasos para reproducirlo, impacto y, si lo tienes, un paquete JSON o una regla de ejemplo.

| Plazo | Compromiso |
|---|---|
| 72 h | Acuse de recibo |
| 7 días | Evaluación inicial y severidad (CVSS 4.0) |
| 30 días | Corrección o mitigación para severidad alta o crítica |
| Tras la corrección | Divulgación coordinada y reconocimiento, si lo deseas |

## Alcance

Dentro: el paquete `proyecto/`, la consola de `docs/`, los scripts de `scripts/` y los flujos de `.github/workflows/`. En especial: evasión de la verificación de custodia, colisiones o ambigüedades en el sellado, XSS o ejecución de código al abrir un paquete, inyección de fórmulas en el CSV, fugas de datos a terceros y cadena de suministro.

Fuera: ataques que requieren acceso al equipo desbloqueado, extensiones maliciosas del navegador e ingeniería social.

## Modelo de amenazas resumido

| Activo | Amenaza | Defensa actual |
|---|---|---|
| Paquete exportado | Alteración de un evento, un sello o un incidente | Cadena SHA-256, raíz de Merkle RFC 6962, `verify` en CLI y navegador |
| Paquete exportado | Sustitución completa por otro paquete coherente | **No cubierto**: firma el JSON (minisign, GPG) o ancla el sello final fuera |
| Consola web | Paquete malicioso con HTML o scripts | `textContent` en todo dato del paquete, CSP `default-src 'none'`, sin `eval` |
| Consola web | Fuga de datos a terceros | Sin recursos remotos; `connect-src 'none'` |
| CSV exportado | Inyección de fórmulas | Prefijo `'` en celdas que empiezan por `= + - @` |
| Cadena de suministro | Dependencias o acciones comprometidas | Cero dependencias en tiempo de ejecución; acciones de CI fijadas por SHA; `persist-credentials: false` |

## Buenas prácticas de uso

- No publiques en GitHub Pages paquetes con datos reales.
- Conserva el sello final y la raíz de Merkle del paquete en un registro independiente (ticket, acta o correo firmado).
- Ejecuta `verify` antes de entregar un paquete como evidencia.
