# TRAMA · Roadmap

> **Sigue el hilo.** Del hallazgo del pentest a la alerta del SOC y a la no conformidad, con una cadena de custodia que nadie puede cortar sin que se note.

TRAMA es la **trama** de un ataque (el plan que hay detrás) y la **trama** de un tejido: el punto donde se cruzan los hilos de la ofensiva, la detección y el cumplimiento. Herramienta local, en español e inglés, de código abierto (GPLv2), del ecosistema de Yoandy Ramírez Delgado.

---

## 1. La idea: una evidencia, cinco lecturas

Un mismo paquete de evidencias responde preguntas distintas según quién lo mire. La consola se abre con la **lente** del rol de la persona (se elige en el perfil) y cada lente pone delante lo que ese perfil necesita y hoy no tiene.

| Lente | La pregunta que responde | Qué enseña |
|---|---|---|
| **Pentester** | ¿Mis hallazgos se explotaron en el mundo real? | Cada hallazgo con su estado: explotado (incidente, etapa y hora), sin explotación observada. Evidencia sellada lista para el informe: hash del evento y raíz de Merkle. |
| **Red Team** | ¿Cómo fue mi ruta y cuánto tardaron en verme? | Ruta de ataque ordenada con tácticas ATT&CK, tiempo de permanencia (primera a última etapa) y tiempo hasta la detección. |
| **Blue Team** | ¿Qué vi, qué se me escapó y qué IOC tengo? | Incidentes detectados y su tiempo de detección, exposiciones conocidas sin detección asociada (huecos) e indicadores (IP, cuentas, hosts, binarios) para copiar o exportar. |
| **Purple** | ¿Qué técnicas ejercitamos y cuáles detectamos? | Cobertura ATT&CK: técnicas con regla y con detección, técnicas expuestas sin regla y siguiente ejercicio sugerido. |
| **GRC** | ¿Qué incumplo, con qué prueba y cuánto me queda para notificar? | No conformidades ENS, ISO/IEC 27001 y NIS2 con su evidencia sellada, y los **plazos del art. 23 de NIS2** desde la detección: alerta temprana (24 h), notificación (72 h) e informe final (1 mes). |

## 2. Identidad

- **Nombre:** TRAMA. Comprobado que no choca con productos de seguridad. *QUIMERA* se descartó: QuimeraX es un producto de ciberseguridad, Chimera es un ofuscador ofensivo de PowerShell y G0114 «Chimera» es un grupo de amenazas en MITRE ATT&CK.
- **Logo:** cuadrado con el icono Lucide `waypoints` (nodos unidos por un hilo) en el acento.
- **Submarca:** `SIGUE EL HILO` en monoespaciada mayúscula.
- **Firma visual: El Hilo.** Tres carriles horizontales (Ofensiva, Detección y Cumplimiento) sobre el eje del tiempo. Cada incidente es un hilo que baja del hallazgo a sus eventos y de ahí a los controles que incumple. El hilo seleccionado se dibuja en el acento y con trazo animado, y el resto queda en tinta tenue. No usa anillos (Rosetta), franjas por activo (CTEM-Nexus), la matriz (LemonByte) ni la constelación (Astrolabio).
- **Custodia como eslabones:** cada bloque sellado es un eslabón. Al verificar, un pulso recorre la cadena; al simular una manipulación, el eslabón alterado se rompe.

## 3. Diseño (estilo del ecosistema)

- **Shell:**
  - **Lateral flotante:** logo, píldora del paquete abierto, navegación, acentos y perfil.
  - **Barra superior de cristal:** búsqueda `Ctrl K`, `ES | EN`, interruptor de tema y ayuda.
  - **Móvil:** barra inferior con 4 destinos más «Más».
- **Color:** los 7 acentos de Rosetta con azul eléctrico por defecto, y bandas de severidad con la rampa ocre → coral → carmesí en claro.
- **Movimiento** (Emil Kowalski, estilo Apple):
  - `:active` con escala 0,97 y muelles sin rebote;
  - mismo camino de entrada y salida;
  - cambio de tema con un único fundido coordinado (0,32 s);
  - movimiento reducido = fundido.
- **Ajustes:** tema, acento, densidad, idioma y movimiento.
- **Perfil:** nombre, rol (que fija la lente) y organización (va como autor en los informes).
- **Centro de ayuda:** pestañas de guía, método (generado desde las constantes de la consola), datos y CLI, atajos, glosario y acerca de (autor, independencia, ecosistema y soporte).
- **Accesibilidad:** WCAG 2.2 AA verificado con axe (0 infracciones) en claro, oscuro, 1440 y 390 px.
- **Seguridad:** CSP estricta (`default-src 'none'`, sin `unsafe-inline`), sin red y datos del paquete siempre como texto.

## 4. Fases

Una PR por versión (`version/X.Y.Z` → `main`), con las pruebas y axe en verde. La fusiona Yoandy.

### v0.2.0 · Identidad y consola nueva
- [x] Nombre definitivo TRAMA (paquete `trama`, comando `trama`) y retirada del script de cambio de nombre.
- [x] Paquete marcado como `demo` o `real` (`dataset`) para que los plazos de la demo no aparezcan vencidos.
- [x] Serialización canónica con los números como en JavaScript: la verificación del navegador ya no da un falso positivo con decimales como `1.0`.
- [x] Consola desde cero:
  - shell del ecosistema, ES/EN, tema, 7 acentos, Ajustes, Perfil y centro de ayuda con Acerca de y ecosistema;
  - vistas: Inicio por lente, El Hilo, Incidentes, Cumplimiento con plazos NIS2, Custodia en eslabones, Eventos y Entidades;
  - móvil con barra inferior y «Más».
- [x] Pruebas de navegador nuevas (axe en todas las vistas, temas y móvil, lentes, hilo, custodia, idioma, teclado y XSS) y capturas.

### v0.3.0 · Firma del paquete y sesiones interactivas
- [ ] **Firma Ed25519** (RFC 8032) en Python puro, sin dependencias: `trama keygen`, `trama sign` y `trama verify --pubkey`. La cadena prueba la integridad; la firma prueba la autoría. Verificación también en la consola con WebCrypto cuando el navegador la ofrezca.
- [ ] Verificación de firmas externas de `minisign` y `gpg --detach-sign` si las herramientas están instaladas.

Ejercicios guiados que se resuelven **con los datos del paquete abierto**, uno por lente, con pasos, pistas, comprobación de la respuesta y progreso guardado en el navegador.
- [ ] Pentester: «Demuestra el impacto»: encuentra qué hallazgo se explotó y aporta su hash sellado.
- [ ] Red Team: «Reconstruye tu ruta»: ordena las etapas y calcula el tiempo de permanencia.
- [ ] Blue Team: «Encuentra el hueco»: qué exposición no tiene detección y qué IOC bloquearías.
- [ ] Purple: «Cierra la cobertura»: qué técnica necesita regla nueva.
- [ ] GRC: «Notifica a tiempo»: qué plazo de NIS2 vence primero y con qué evidencia notificas.
- [ ] Sesión de custodia: manipula un bloque y explica por qué falla la verificación.

### v0.4.0 · Correlación con el ecosistema
- [ ] Importar hallazgos ofensivos de **CTEM-Nexus** y **ENS AD Auditor** desde el sobre `yrd-ecosistema` (tipo `hallazgos`), en la CLI y en la consola.
- [ ] Exportar a **Rosetta** las no conformidades como `controles` (estado y evidencia) y a **CTEM-Nexus** los incidentes como `indicadores`.
- [ ] Añadir `trama` al esquema común (`heindall92/ctem-nexus/shared/schemas`), con fichero de ida y vuelta y prueba en los dos repositorios.

### v0.5.0 · Entregables por rol
- [ ] Dossier de auditoría imprimible (GRC): portada, no conformidades, evidencia sellada y verificación.
- [ ] Informe de impacto (pentester) y línea de tiempo del ejercicio (red y purple).
- [ ] Exportación de IOC (CSV y STIX 2.1 básico) y de reglas de correlación como borrador Sigma (blue y purple).

### v0.6.0 · Más fuentes y reglas
- [ ] Importadores de EVTX exportado a JSON, Sysmon, auditd y registros de nginx o Apache.
- [ ] Reglas nuevas: AS-REP Roasting, DCSync, abuso de ADCS (ESC1), persistencia por cron y webshell.
- [ ] Plazos de **DORA** para banca y seguros (además de NIS2).

### v1.0.0 · Lanzamiento
- [ ] Cifras reales en el README, capturas, GIF de El Hilo y dossier de ejemplo en PDF.
- [ ] Revisión con perfiles reales: un pentester, un analista SOC y un auditor.
- [ ] Publicación en LinkedIn, espaciada al menos 3 o 4 días de otros lanzamientos y mencionando banca y LATAM.

## 5. Reglas para cualquier asistente

1. Autoría siempre de **Yoandy Ramírez Delgado** (`yoandyramirezdelgado@gmail.com`), sin atribuciones a IA.
2. Solo librería estándar en `trama/`, compatible con Python 3.8.
3. Consola sin red, en `file://`, con CSP estricta y sin `innerHTML` para datos del paquete.
4. Solo iconos Lucide (vendorizados con `scripts/vendor_icons.py`), solo la fuente Geist y nada de anillos.
5. Nunca texto de normas ISO: solo número y nombre breve propio del control. El BOE y los diarios oficiales de la UE se pueden citar.
6. Las pruebas y axe en verde antes de cada push. Las cifras del README, recontadas.
