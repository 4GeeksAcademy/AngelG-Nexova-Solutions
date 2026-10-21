# Medicion inicial: pendiente de Lighthouse

## Estado comprobado

- Comprobacion HTTP: 2026-10-14T23:27:36Z; no es la fecha de una auditoria Lighthouse.
- Referencia: rama `main`, commit `d1d5df0cdc79d7872c1d0560a439406c93b1e274`.
- Git estaba limpio al inicio. Esta fase solo incorpora archivos auxiliares de auditoria.
- Entorno: contenedor Ubuntu 24.04.5 LTS; Node 24.21.0, npm 11.19.0, Python 3.14.2.
- Website y backoffice son HTML/CSS/JavaScript estaticos, sin build ni instalacion necesaria.
- Chrome/Chromium y Lighthouse no estan en PATH. Lighthouse, Playwright y Puppeteer no son resolubles desde la raiz ni aparecen en el listado global de npm.
- No hubo autorizacion explicita para instalar herramientas. No se instalaron paquetes, no se modificaron aplicaciones y no se ejecuto Lighthouse.
- No existen aun informes Lighthouse, capturas de informes ni puntuaciones verificadas. Este documento no es evidencia de rendimiento.

## Servidor reproducible

Desde la raiz:

```bash
python3 -B audit/before/serve.py --port 8000
```

El servidor escucha solo en `127.0.0.1`. Sirve los directorios publicos existentes y el formulario enlazado, sin servir la raiz completa. Las rutas de entorno, Git, datos y auditoria estan bloqueadas, al igual que los listados de directorios. Para Codespaces, reenviar el puerto 8000 de forma privada y registrar la URL real utilizada. No hacerlo publico.

Se comprobaron por HTTP HTML, CSS y JavaScript de ambas UIs y el formulario (200), y rutas privadas y traversal (404). Las dos paginas tambien respondieron 200 con el servidor persistente. Estas comprobaciones no validan el renderizado del navegador ni las fuentes remotas.

## Tabla inicial

| Objetivo | URL local exacta prevista | Performance | Accessibility | Best Practices | SEO |
| --- | --- | --- | --- | --- | --- |
| Website, inicio | <http://127.0.0.1:8000/uis/website/> | Pendiente | Pendiente | Pendiente | Pendiente |
| Backoffice, resumen | <http://127.0.0.1:8000/uis/backoffice/#inicio> | Pendiente | Pendiente | Pendiente | Pendiente |
| Backoffice, organizacion | <http://127.0.0.1:8000/uis/backoffice/#organizacion> | Pendiente | Pendiente | Pendiente | Pendiente |

No existe una segunda pagina propia del website: las secciones comparten documento. Organizacion aporta ocho tarjetas y busqueda; no contiene tablas ni graficos. Ambas UIs son anonimas y no requieren autenticacion. No incluir el tracker ni sus modulos enlazados en estas mediciones.

LCP, CLS, TTFB, FCP y Speed Index estan pendientes para las tres URLs. INP no esta medido; una navegacion Lighthouse no constituye una medicion valida de INP. TBT no debe registrarse como INP.

## Intervencion manual requerida

1. Abrir cada URL en Chrome del equipo anfitrion, mediante el puerto privado reenviado si es necesario. Comprobar que el titulo y el contenido corresponden a la vista prevista, especialmente `#organizacion`.
2. Abrir DevTools > Lighthouse. Seleccionar modo Navigation, dispositivo Mobile y las categorias Performance, Accessibility, Best Practices y SEO. Mantener el throttling predeterminado y anotar su configuracion efectiva. Usar un perfil limpio sin extensiones y sin otras tareas intensivas.
3. Ejecutar tres pasadas por URL con las mismas opciones y limpieza de almacenamiento. No modificar fuentes, CSS, scripts ni cache de servidor entre pasadas. Las fuentes Google Fonts deben estar accesibles; si fallan, registrar la causa en lugar de comparar esa pasada silenciosamente con otras.
4. Exportar cada informe completo en HTML y JSON. Guardar una captura legible de la cabecera del informe con las cuatro puntuaciones visibles y una captura de la pagina medida. No sustituir las puntuaciones con capturas de las UIs antiguas del repositorio.
5. Repetir tres pasadas con Desktop si se auditan ambos perfiles. No mezclar resultados moviles y de escritorio. Mantener estos mismos perfiles en la fase posterior.
6. Guardar los archivos en esta carpeta con nombres como `website-mobile-01.report.html`, `website-mobile-01.report.json`, `website-mobile-01.scores.png` y `website-mobile-01.page.png`. Para las otras vistas usar `backoffice-inicio` y `backoffice-organizacion`; para Desktop usar `desktop`.
7. Registrar para cada pasada la fecha real, URL solicitada y final (incluido hash), versiones Chrome/Lighthouse, modo, viewport/dispositivo, CPU/red, origen local o reenviado, perfil/cache, sesion anonima, errores y estado de Google Fonts. Si el hash no se conserva o la vista no es correcta, marcar la pasada invalida.
8. Revisar los informes y capturas antes de incorporarlos: no guardar cookies, tokens, credenciales, almacenamiento de sesion ni datos personales reales. Entregar los archivos para extraer las puntuaciones y metricas reales, calcular medianas y documentar el rango. Si hay dispersion alta, investigar las condiciones y conservar pasadas adicionales, sin seleccionar solo la mejor.

La version de Lighthouse, emulacion y throttling aun no estan fijados porque no se ha ejecutado la herramienta. Se deben obtener de los informes reales. El origen reenviado puede afectar TTFB; no mezclarlo posteriormente con una medicion directa local.

## Focos pendientes, no hallazgos medidos

- Fuentes remotas y CSS bloqueante: comprobar su relacion con FCP, LCP, CLS y solicitudes de red.
- Animacion, filtros y desenfoques: evaluar trazas de renderizado y trabajo de CPU, sin atribuir impacto numerico antes de medir.
- Accesibilidad: revisar contraste, estructura de encabezados, nombres accesibles y controles; el estado de la vista puede cambiar el resultado.
- Best Practices y SEO: inspeccionar las auditorias reales y errores de consola/red; no suponer que un portal interno requiere indexacion publica.
- Interacciones de busqueda y cambio de vista: una traza de interaccion adicional puede ser necesaria; Lighthouse Navigation no valida INP de campo.

No se ha creado ni rellenado AUDIT.md con valores estimados. La medicion queda bloqueada hasta recibir informes manuales reales o autorizacion explicita para instalar herramientas de medicion aisladas del proyecto.
