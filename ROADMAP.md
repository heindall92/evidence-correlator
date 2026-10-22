# TRAMA · Roadmap

> Correlación de hallazgos de pentest, telemetría del SOC y no conformidades en un único paquete, con cadena de custodia verificable.

TRAMA alude a la trama de un tejido, donde se cruzan los hilos de la ofensiva, la detección y el cumplimiento. Herramienta local, en español e inglés y de código abierto (GPLv2), del ecosistema de Yoandy Ramírez Delgado.

---

## 1. Perspectivas por rol

Un mismo paquete de evidencias admite lecturas distintas según el perfil. La consola abre la **perspectiva** del rol configurado en el perfil, y cada una presenta primero la información que ese perfil necesita.

| Perspectiva | Uso | Contenido |
|---|---|---|
| **Pentester** · Impacto de los hallazgos | Demostrar en el informe qué hallazgos se explotaron | Estado de cada hallazgo (explotado, con incidente, etapa y hora, o sin explotación observada) y evidencia sellada: hash del evento y raíz de Merkle. |
| **Red Team** · Ruta de ataque | Reconstruir la ruta y medir la detección | Etapas ordenadas con tácticas ATT&CK, tiempo de permanencia (de la primera a la última etapa) y tiempo hasta la detección. |
| **Blue Team** · Detección y exposición | Localizar huecos de detección y obtener IOC | Incidentes detectados con su tiempo de detección, exposiciones conocidas sin detección asociada e indicadores (IP, cuentas, hosts y comandos) para copiar o exportar. |
| **Purple Team** · Cobertura ATT&CK | Planificar el siguiente ejercicio | Técnicas con regla y con detección, técnicas expuestas sin regla y ejercicio recomendado. |
| **GRC y auditoría** · Cumplimiento y notificación | Sustentar el dictamen y cumplir los plazos | No conformidades del ENS, la ISO/IEC 27001 y NIS2 con su evidencia sellada, y los **plazos del art. 23 de NIS2** desde la detección: alerta temprana (24 h), notificación (72 h) e informe final (1 mes). |

## 2. Identidad

- **Nombre:** TRAMA. Se comprobó que no coincide con productos de seguridad. *QUIMERA* se descartó: QuimeraX es un producto de ciberseguridad, Chimera es un ofuscador ofensivo de PowerShell y G0114 «Chimera» es un grupo de amenazas en MITRE ATT&CK.
- **Logotipo:** marca propia, no un icono de Lucide (`waypoints` es el logotipo de CTEM-Nexus). Una «T» cuyo trazo vertical cruza tres carriles, como la urdimbre de un tejido; se dibuja en el color de acento.
- **Submarca:** «Correlación de evidencias».
- **Visualización propia: Trazabilidad.** Tres carriles horizontales (ofensiva, detección y cumplimiento) sobre el orden de los eventos. Cada incidente se traza desde el hallazgo, por sus eventos, hasta los controles afectados. El incidente seleccionado se resalta en el acento con trazo animado y el resto queda atenuado. No usa anillos (Rosetta), franjas por activo (CTEM-Nexus), la matriz (LemonByte) ni la constelación (Astrolabio).
- **Custodia bloque a bloque:** al verificar, un pulso recorre la cadena; al simular una manipulación, el bloque alterado se marca como roto.
- **Redacción:** registro profesional e impersonal, títulos nominales, sin preguntas retóricas, tuteo, revelaciones («El resultado:») ni fórmulas del tipo «no es X, es Y». `scripts/redaccion.py` lo audita en la interfaz, la documentación, las reglas, los datos y la CLI, y forma parte de las pruebas.

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
- **Perfil:** nombre, rol (fija la perspectiva inicial) y organización (figura como autor en los informes).
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
  - estructura de interfaz común a las demás herramientas del autor, ES/EN, tema, 7 acentos, ajustes, perfil y centro de ayuda con «Acerca de» y herramientas relacionadas;
  - vistas: Inicio por perspectiva, Trazabilidad, Incidentes, Cumplimiento con plazos NIS2, Custodia, Eventos y Entidades;
  - móvil con barra inferior y «Más».
- [x] Pruebas de navegador nuevas (axe en todas las vistas, temas y móvil, perspectivas, trazabilidad, custodia, idioma, teclado y XSS) y capturas.

### v0.2.1 · Redacción y marca
- [x] Textos de la consola (ES y EN), README, hoja de ruta, CLI y metadatos reescritos con registro profesional.
- [x] «El Hilo» pasa a «Trazabilidad» y «lentes», a «perspectivas».
- [x] Logotipo y favicon propios en lugar del icono `waypoints` de CTEM-Nexus.
- [x] Auditor de redacción `scripts/redaccion.py` con las reglas de `linkedin-humanizer` en español e inglés, integrado en las pruebas y en la CI.

### v0.2.2 · Menú móvil
- [x] «Más» en móvil: vistas en rejilla, cuenta y ayuda en lista agrupada, idioma segmentado y acentos repartidos; filas por debajo de 360 px.

### v0.2.3 · Hojas del móvil y caché
- [x] Hojas ancladas abajo, con la altura de su contenido y asa de arrastre.
- [x] `?v=<versión>` en estilos y scripts para que cada publicación invalide la caché.

### v0.2.4 · Ancho en móvil
- [x] La perspectiva pentester ya no ensancha la página; prueba con las cinco perspectivas.

### v0.3.0 · Firma del paquete y ejercicios guiados
- [ ] **Firma Ed25519** (RFC 8032) en Python puro, sin dependencias: `trama keygen`, `trama sign` y `trama verify --pubkey`. La cadena prueba la integridad; la firma prueba la autoría. Verificación también en la consola con WebCrypto cuando el navegador la ofrezca.
- [ ] Verificación de firmas externas de `minisign` y `gpg --detach-sign` si las herramientas están instaladas.

Ejercicios guiados que se resuelven **con los datos del paquete abierto**, uno por perspectiva, con pasos, pistas, comprobación de la respuesta y progreso guardado en el navegador.
- [ ] Pentester · Validación de impacto: identificar el hallazgo explotado y aportar su hash sellado.
- [ ] Red Team · Reconstrucción de la ruta: ordenar las etapas y calcular el tiempo de permanencia.
- [ ] Blue Team · Análisis de huecos: determinar qué exposición carece de detección y qué IOC procede bloquear.
- [ ] Purple Team · Cierre de cobertura: determinar qué técnica requiere una regla nueva.
- [ ] GRC · Notificación en plazo: identificar el primer plazo de NIS2 que vence y la evidencia que acompaña la notificación.
- [ ] Custodia · Análisis de manipulación: alterar un bloque y explicar por qué falla la verificación.

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
- [ ] Cifras reales en el README, capturas, GIF de la vista Trazabilidad y dossier de ejemplo en PDF.
- [ ] Revisión con perfiles reales: un pentester, un analista SOC y un auditor.
- [ ] Publicación en LinkedIn, espaciada al menos 3 o 4 días de otros lanzamientos y mencionando banca y LATAM.

## 5. Reglas para cualquier asistente

1. Autoría siempre de **Yoandy Ramírez Delgado** (`yoandyramirezdelgado@gmail.com`), sin atribuciones a IA.
2. Solo librería estándar en `trama/`, compatible con Python 3.8.
3. Consola sin red, en `file://`, con CSP estricta y sin `innerHTML` para datos del paquete.
4. Solo iconos Lucide (vendorizados con `scripts/vendor_icons.py`), solo la fuente Geist y nada de anillos.
5. Nunca texto de normas ISO: solo número y nombre breve propio del control. El BOE y los diarios oficiales de la UE se pueden citar.
6. Las pruebas y axe en verde antes de cada push. Las cifras del README, recontadas.
