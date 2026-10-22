# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según [SemVer](https://semver.org/lang/es/).

## 0.2.3 · octubre de 2026

### Corregido
- **Las hojas del móvil quedaban arriba** («Más», Ajustes, Perfil, Ayuda), con un hueco vacío debajo. El diálogo tenía `inset: 0` y altura automática, así que ocupaba toda la pantalla y la tarjeta quedaba pegada arriba. Ahora se ancla abajo (`inset: auto 0 0`), mide lo que su contenido y llega como máximo al 92 % de la altura.
- **El móvil seguía mostrando la versión anterior** tras publicar una nueva: GitHub Pages guarda los ficheros hasta 10 minutos. Los estilos y scripts de la consola llevan ahora la versión (`app.js?v=0.2.3`), así que cada publicación invalida la caché.

### Añadido
- Asa de arrastre en las hojas del móvil, como en iOS.
- Pruebas: la hoja queda pegada al borde inferior y sin ocupar toda la pantalla; todos los estilos y scripts llevan la versión actual.

## 0.2.2 · octubre de 2026

### Cambiado
- **Menú «Más» en móvil reorganizado** según las pautas de iOS. Antes era una lista de botones a ancho completo, con el idioma y los acentos alineados a la izquierda y huecos sin usar. Ahora tiene tres secciones con antetítulo:
  - **Vistas:** rejilla de tres casillas con el icono sobre el nombre; la vista actual se marca con el acento.
  - **Cuenta y ayuda:** lista agrupada con separadores y chevrones; el perfil muestra nombre y rol.
  - **Preferencias:** idioma en un control segmentado a la derecha y los siete acentos repartidos de borde a borde.
- Por debajo de 360 px de ancho, las vistas pasan a filas para que ningún nombre se corte.

### Añadido
- Prueba de navegador del menú «Más» a 320 y 390 px: estructura, sin textos cortados, acentos repartidos, axe sin infracciones y cierre al elegir una vista.
- Capturas `mas-light.png` y `mas-dark.png`.

## 0.2.1 · octubre de 2026

Revisión editorial de toda la plataforma para un registro de producto profesional, y marca propia.

### Cambiado
- **Textos de la consola en español e inglés** reescritos con registro impersonal y títulos nominales. Se eliminan las preguntas retóricas y el tuteo, y frases como «Hasta que te vieron», «Qué viste y qué se te escapó», «Explotados en el mundo real» o «Sigue el hilo». Criterio: catálogo de marcadores de texto generado de `linkedin-humanizer` (sergebulaev/linkedin-skills), adaptado al español.
- «El Hilo» pasa a llamarse **Trazabilidad**; las «lentes», **perspectivas**; y la submarca, «Correlación de evidencias».
- Reglas y hallazgos de ejemplo: títulos en minúscula según la norma española, sin gerundios de posterioridad ni anglicismos («crackeo», «Hardening»), nombres de controles ISO/IEC 27001 en español y herramientas de origen reales (BloodHound CE, LinPEAS, Burp Suite Professional).
- README, hoja de ruta, CONTRIBUTING, lema de la CLI y metadatos alineados con la nueva redacción. El caso de uso del README usa las cifras reales de los datos de ejemplo (11 min 52 s entre la petición TGS y el inicio de sesión WinRM).
- Tríadas escalonadas eliminadas («Sin red, sin analítica y sin cookies», «sin servidor, sin red y sin servicios de terceros»), frases cortadas al final de un texto («Ningún otro dato.») y el anglicismo «dashboard» en la CLI, que pasa a «consola».
- En móvil, los metadatos de cada fila (severidad y tiempo de detección) pasan debajo del texto en lugar de estrecharlo.

### Añadido
- **Logotipo propio**: una «T» cuyo trazo cruza tres carriles, en SVG y sin depender de un icono de Lucide. Sustituye a `waypoints`, que es el logotipo de CTEM-Nexus. Nuevo favicon.
- **Auditor de redacción** `scripts/redaccion.py`, sin dependencias. Traslada al español y al inglés las reglas de `linkedin-humanizer`:
  - vocabulario puntuado por densidad por párrafo («significativo», «robusto», «aprovechar», «optimizar», «garantiza», «de forma sencilla», «permite + infinitivo», conectores como «Además,» o «Asimismo,» al inicio de frase…);
  - con una sola aparición: revelaciones («El resultado:»), paralelismo negativo («no es X, es Y», «no solo…, sino…»), tríadas escalonadas («sin X, sin Y y sin Z»), frases cortadas, clichés, falsa sinceridad, fugas de herramientas y emojis típicos;
  - en la interfaz, además: sin preguntas, exclamaciones, tuteo ni «you».

  Recorre la consola, los documentos, las reglas, los datos de ejemplo y los mensajes de la CLI, y sobre los textos de la 0.2.0 detecta 71 cadenas.
- `ProfessionalCopyTest` (4 pruebas): la plataforma no tiene fallos, el detector sigue encontrando giros conocidos, deja pasar la redacción técnica normal y el logotipo no vuelve a ser `waypoints`. 120 pruebas en total.
- Paso de la CI que imprime el informe de redacción.

### Corregido
- Prueba de navegador inestable en la CI: tres esperas usaban `wait_for_function`, que Playwright evalúa dentro de la página y que la CSP de la consola bloquea («unsafe-eval»). Ahora usan localizadores, que no ejecutan código en la página.
- Desajuste entre el texto visible y el nombre accesible del destino Trazabilidad en la barra inferior móvil (axe `label-content-name-mismatch`).

## 0.2.0 · octubre de 2026

Nombre definitivo y consola rediseñada desde cero en torno a cinco perfiles: pentester, Red Team, Blue Team, Purple y GRC.

### Añadido
- **Nombre definitivo TRAMA** («sigue el hilo»): paquete y comando `trama`, lema en `trama/branding.py`. Se descartó QUIMERA por coincidir con QuimeraX (producto de ciberseguridad), Chimera (ofuscador ofensivo de PowerShell) y el grupo G0114 de MITRE ATT&CK.
- **Consola nueva** (`docs/`), sin dependencias ni red:
  - **Cinco lentes por rol** en Inicio: hallazgos explotados con evidencia sellada (pentester), ruta y tiempos de detección (Red Team), detecciones, huecos e IOC exportables (Blue Team), cobertura ATT&CK y siguiente ejercicio (Purple), no conformidades y plazos NIS2 (GRC).
  - **El Hilo**, la visualización propia: tres carriles (Ofensiva, Detección y Cumplimiento) con cada incidente como un hilo y el seleccionado dibujado en el acento.
  - **Plazos del art. 23 de NIS2** (24 h, 72 h y un mes tras la notificación) en una pista lineal; en la demo el reloj se fija 5 h después de la última detección.
  - **Custodia en eslabones** con pulso de verificación y simulación de manipulación.
  - Vistas Incidentes, Cumplimiento, Eventos y Entidades; búsqueda `Ctrl K` ordenada por relevancia; atajos `1`–`7`, `L`, `J`/`K`, `V`, `T`, `O`, `[` y `?`.
  - Interfaz completa en español e inglés; tema claro y oscuro con fundido coordinado; 7 acentos con azul eléctrico por defecto; ajustes (densidad, movimiento, abrir paquete, volver a la demo, borrado en dos pasos); perfil (nombre, organización y rol); centro de ayuda con guía, método, datos y CLI, atajos, glosario y acerca de con el ecosistema.
  - Móvil con barra inferior y menú «Más» (acentos e idioma incluidos).
- Campo `dataset` (`demo` o `real`) y resumen de reglas (`rules`: técnicas ATT&CK y hallazgos de postura) en el paquete.
- `ROADMAP.md` con las fases hasta la 1.0.0.
- 17 pruebas de navegador nuevas (axe en todas las vistas, lentes, diálogos, temas y móvil; desbordamiento; iconos; XSS; teclado; idioma; perfil; ajustes; fundido de tema; movimiento reducido). 116 pruebas en total.

### Corregido
- **Falso positivo en la verificación del navegador con decimales** (`1.0`, `1e-7`, `1e21`): la serialización canónica escribe ahora los números como `Number.prototype.toString` de JavaScript, así que Python y el navegador calculan el mismo hash. Para datos sin decimales los hashes no cambian.
- Contraste insuficiente del acento verde azulado de la consola anterior: la paleta nueva cumple WCAG 2.2 AA, verificado con axe en claro y oscuro.

### Eliminado
- `scripts/rename.sh` y su prueba: el nombre ya es definitivo.
- La consola anterior (secciones Resumen y Grafo, sustituidas por Inicio y Entidades) y sus capturas.

## 0.1.0 · octubre de 2026

Primera versión pública, a partir del prototipo inicial del motor (con nombre provisional).

### Añadido
- Paquete instalable (`pyproject.toml`) con comando `trama` y `python3 -m trama`.
- CLI con subcomandos `run`, `verify` y `rules`; opciones `--events`, `--findings`, `--rules`, `--output`, `--dashboard-js`, `--no-raw`, `--json` y `--color` (respeta `NO_COLOR`); códigos de salida 0, 1 y 2.
- `verify` sobre paquetes exportados: sellos, enlaces, hash de cada evento crudo, sello final (detecta truncado), raíz global y raíz de Merkle de cada incidente.
- Validación de reglas al cargarlas (campos, severidad, confianza, ventana, etapas y predicados).
- Resumen GRC por marco con los incidentes que sustentan cada no conformidad.
- Consola web nueva: seis secciones, búsqueda global, atajos, ajustes, privacidad, temas claro y oscuro, diseño adaptable, verificación de la custodia en el navegador y simulación de manipulación. CSP estricta, sin recursos remotos, iconos Lucide y fuente Geist vendorizados.
- Script de cambio de nombre (retirado en la 0.2.0); `scripts/screenshots.py`; `scripts/vendor_icons.py`.
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
