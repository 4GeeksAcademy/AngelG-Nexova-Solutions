# Auditoría inicial de caché y rendimiento

**Fase:** 1 — Auditoría inicial y diagnóstico del proyecto  
**Estado:** diagnóstico preliminar; sin cambios funcionales  
**Alcance:** repositorio Nexova, con foco en `uis/backoffice`, `uis/website` y la API principal de `services/api`.

> Esta auditoría documenta lo que puede verificarse en el código y separa hechos de hipótesis. No se han hecho benchmarks, pruebas de carga ni mediciones de latencia. Las oportunidades descritas son candidatas para investigar, no una selección definitiva de endpoints ni una autorización para implementar caché.

## 1. Resumen ejecutivo

El repositorio es un monorepo con dos frontends Next.js y una API Python/FastAPI. La API combina almacenamiento TinyDB en JSON para varios dominios con SQLModel/PostgreSQL opcional para inventario, incidencias gestionadas, reporting y telemetría. El backoffice solicita datos autenticados y desactiva explícitamente el caché del navegador en varias capas de cliente (`fetch(..., { cache: "no-store" })`). La configuración de Next.js reescribe `/api/*` hacia la API; no se observó en las áreas inspeccionadas una capa Redis/Memcached, un mecanismo general de caché HTTP ni `unstable_cache`/`revalidate`.

Hay trabajo potencial en la carga inicial, el filtrado de listas, las lecturas/agrupaciones de datos y el análisis de telemetría. Sin embargo, buena parte de las respuestas contiene información personal, depende del usuario o cambia con operaciones recientes. Antes de cachear habrá que fijar reglas de autorización, aislamiento por usuario/rol, invalidación, frescura y comportamiento multiinstancia, y medir primero el coste real.

## 2. Arquitectura observada

### 2.1 Frontends

| Aplicación | Evidencia/configuración | Función observada |
| --- | --- | --- |
| `uis/backoffice` | Next.js `16.2.10`, React `19.2.4`, TypeScript, Tailwind CSS 4; Vitest, jsdom y Testing Library según su manifiesto | Aplicación interna autenticada para pipeline de candidatos, incidencias, administración de usuarios/perfiles, inventario, proveedores, reporting y telemetría. |
| `uis/website` | Next.js `16.2.10`, React `19.2.4`, TypeScript, Tailwind CSS 4 | Sitio público con `/` y `/application`; el formulario utiliza un proxy de servidor para enviar solicitudes públicas a la API. |

El backoffice ejecuta solicitudes desde componentes cliente mediante bibliotecas `lib/*-api`. `uis/backoffice/next.config.ts` configura una reescritura de `/api/:path*` al origen servidor definido por `API_INTERNAL_URL` (con alternativas de configuración y fallback a `http://backend:8000`). La ruta es un proxy de red, no una caché.

Se observaron componentes React de cliente para varias vistas. `CandidateList` obtiene los candidatos y filtra en memoria por texto/estado/etapa; ya utiliza `useMemo` para el resultado derivado. `IncidentsAnalyzerPanel` calcula una suma con `useMemo`. No se localizaron usos de `next/dynamic`, `React.lazy` ni `lazy(` en la búsqueda realizada. El analizador CSV es una vista independiente y podría investigarse como candidato a carga diferida, sujeto a medir tamaño del módulo y coste de navegación. Esto no constituye una recomendación cerrada.

### 2.2 Backend y persistencia

La aplicación principal se instancia en `services/api/main.py` y registra routers de usuarios, perfiles, autenticación, candidatos, incidencias legacy y gestionadas, inventario (canónico y adaptador legacy), proveedores, reporting y telemetría. Compose ejecuta el módulo principal con Uvicorn desde `services/api`.

`services/api/database.py` usa TinyDB para usuarios, perfiles, tokens de recuperación, candidatos, notas e incidencias legacy. El motor SQLModel se configura condicionalmente mediante `DATABASE_URL`; `get_db` depende de esa configuración. Los routers de inventario, incidencias gestionadas, reporting y telemetría usan el almacenamiento SQL. La API ejecuta comprobaciones/creación de esquema al iniciar si hay motor PostgreSQL configurado.

Un módulo adicional, `services/api/app/main.py`, define una app de análisis CSV distinta, con `POST /api/incidents/analyze` y `GET /api/incidents/results/export`. Su inclusión en el Compose/deployment activo no ha quedado confirmada; no se debe asumir que forma parte del proceso principal. El resultado del análisis se guarda como estado en memoria del proceso, por lo que no equivale a un resultado persistido o aislado por usuario.

### 2.3 Versiones y entorno

Las versiones anteriores proceden de los manifiestos del frontend. `services/api/pyproject.toml` exige Python `>=3.12` y declara FastAPI, SQLModel, TinyDB, psycopg2, python-jose, libpass/bcrypt y otras dependencias con rangos mínimos; no se fijó aquí una versión instalada/efectiva. No se instalaron dependencias ni se ejecutó ninguna aplicación durante esta fase.

## 3. Inventario de rutas frontend

### Backoffice

- `/` — panel/pipeline y lista de candidatos (`CandidateList`).
- `/candidates/[id]`, `/candidates/new` — detalle y alta de candidato.
- `/incidents`, `/incidents/[id]`, `/incidents/new` — incidencias legacy; la lista compone `IncidentList` y `IncidentSummaryPanel`.
- `/incidents/analyzer` — análisis de CSV (`IncidentsAnalyzerPanel`).
- `/account/profile` — perfil y, con rol de administrador, administración de usuarios.
- `/backoffice/inventory`, `/backoffice/inventory/[id]`, `/backoffice/inventory/new`, `/backoffice/inventory/[id]/[operation]/new` — inventario, detalle y operaciones de lotes/movimientos (`ManagedInventory`/componentes relacionados).
- `/backoffice/inventory/reporting` — reporte semanal (`WeeklyInventoryReport`).
- `/backoffice/inventory/telemetry` — reporte técnico (`TechnicalTelemetryReport`).
- `/backoffice/suppliers`, `/backoffice/suppliers/[id]`, `/backoffice/suppliers/new` — directorio, detalle y alta de proveedores.
- `/login`, `/register`, `/forgot-password`, `/reset-password` — flujos de identidad.

### Sitio público

- `/` — página principal.
- `/application` — formulario público de candidatura.
- `/api/application` — route handler de Next.js usado como proxy server-side con destino permitido a `/records/public` (no es una página navegable).

La enumeración corresponde a los archivos de rutas encontrados y no sustituye un inventario generado en runtime.

## 4. Inventario de endpoints backend

Las rutas siguientes están montadas por `services/api/main.py`, salvo que se indique expresamente lo contrario. Las operaciones de escritura se incluyen para identificar invalidación y riesgo; no se propone cachearlas.

| Grupo | Método y ruta | Acceso/observaciones relevantes |
| --- | --- | --- |
| Salud | `GET /health`, `GET /` | Públicos; respuestas simples. |
| Autenticación | `POST /auth/login` | Público; consulta usuario y verifica bcrypt, emite JWT. No cachear credenciales ni respuestas de autenticación. |
| | `GET /auth/me` | Bearer; devuelve identidad y perfil del usuario actual. Personalizado por usuario. |
| | `POST /auth/forgot-password` | Público; respuesta genérica para evitar enumeración, puede enviar correo. Efecto externo. |
| | `POST /auth/reset-password` | Público con token de un solo uso; mutación de credenciales. |
| | `POST /auth/change-password` | Autenticado; mutación de credenciales. |
| Perfiles | `GET /profiles/me`, `PUT /profiles/me` | Autenticado; información personal y dependiente del usuario. La segunda ruta modifica datos. |
| Usuarios | `POST /users` | Registro público; crea usuario y perfil, hash bcrypt. |
| | `GET /users` | Admin; enumera usuarios y busca perfil por usuario. |
| | `POST /users/admin` | Admin; crea usuario y emite correo de configuración de contraseña. |
| | `GET /users/{user_id}` | Propietario o admin; información individual. |
| | `PUT /users/{user_id}`, `DELETE /users/{user_id}` | Admin; cambios o borrado, con restricciones para conservar un admin activo. |
| | `POST /users/{user_id}/force-password-reset` | Admin; invalida credenciales y envía correo. |
| Candidatos (`/records`) | `GET /records?page=&limit=` | Autenticado. Lee todos los registros TinyDB y luego pagina en memoria; la paginación HTTP no reduce la lectura actual del almacén. Datos personales. |
| | `GET /records/{record_id}` | Autenticado; detalle personal. |
| | `POST /records`, `POST /records/public` | Alta autenticada y alta pública respectivamente; la pública tiene honeypot y límite en memoria por email hash. Escrituras. |
| | `PUT /records/{record_id}`, `PATCH /records/{record_id}`, `DELETE /records/{record_id}` | Autenticado; cambia o elimina candidato. |
| | `GET /records/{record_id}/notes`, `POST /records/{record_id}/notes`, `DELETE /records/{record_id}/notes/{note_id}` | Autenticado; notas asociadas, potencialmente sensibles; escrituras actualizan el contador de notas. |
| Incidencias legacy (`/incidents`) | `POST /incidents`, `GET /incidents`, `GET /incidents/{incident_id}`, `PATCH /incidents/{incident_id}/status` | Router autenticado. TinyDB; `GET /incidents` filtra después de cargar registros. Incluye escrituras. |
| | `GET /incidents/summary` | Autenticado; cálculo agregado a partir de registros. Candidato de lectura, sujeto a medir coste/frescura. |
| Incidencias gestionadas (`/v2/incidents`) | `POST /v2/incidents`, `GET /v2/incidents`, `GET /v2/incidents/summary` | Autenticado; SQLModel. El resumen carga filas activas/no archivadas y agrega en Python según inspección inicial. |
| | `GET /v2/incidents/{incident_id}`, `GET /v2/incidents/{incident_id}/history` | Autenticado; detalle e historial de auditoría. |
| | `PATCH /v2/incidents/{incident_id}`, `PATCH /v2/incidents/{incident_id}/status`, `DELETE /v2/incidents/{incident_id}`, `DELETE /v2/incidents/{incident_id}/permanent` | Autenticado; mutaciones, historial y/o borrado. Requieren invalidación si en futuro se cachea una lectura derivada. |
| Inventario canónico (`/inventory`) | `GET /inventory/items`, `POST /inventory/items`, `GET/PATCH/DELETE /inventory/items/{item_id}`, `DELETE /inventory/items/{item_id}/permanent` | Requiere autenticación. El listado calcula stock agrupando movimientos SQL; stock es derivado de movimientos. Incluye escrituras y borrados. |
| | `GET/POST /inventory/lots`, `DELETE /inventory/lots/{lot_id}` | Autenticado; listado/alta/borrado de lotes. |
| | `GET/POST /inventory/movements` | Autenticado; el historial de movimientos y nuevas operaciones afectan stock derivado y reportes. |
| Adaptador legacy (`/inventory`) | `GET/POST /inventory/products`, `GET /inventory/products/{id}` | Autenticado; productos sobre inventario canónico/contrato anterior. |
| | `POST /inventory/orders/inbound`, `POST /inventory/orders/outbound`, `GET /inventory/orders` | Autenticado; entradas/salidas escriben movimientos y el listado presenta historial/derivados. |
| Proveedores (`/suppliers`) | `POST /suppliers`, `GET /suppliers`, `GET /suppliers/{supplier_id}` | Autenticado; TinyDB. Directorio y detalle cambian por altas/actualizaciones. |
| | `PATCH /suppliers/{supplier_id}/rate`, `PATCH /suppliers/{supplier_id}/status`, `DELETE /suppliers/{supplier_id}` | Autenticado; mutaciones de proveedor. |
| Reporting (`/reporting`) | `GET /reporting/pipeline-runs/latest` | Autenticado; metadatos de la última ejecución. |
| | `POST /reporting/pipeline-runs` | Admin/manager; ejecuta pipeline y escribe resultados agregados. Operación no cacheable. |
| | `GET /reporting/weekly-office-program-performance?week_start=` | Autenticado; obtiene filas agregadas persistidas por semana; puede devolver la última semana calculada. Conserva precisión decimal en la respuesta. |
| Telemetría | `GET /telemetry/report?start=&end=` | Admin/manager; cálculo de conteos técnicos agregados sobre intervalo opcional. El procesamiento interno y su coste no se han medido. |
| App CSV separada | `POST /api/incidents/analyze`, `GET /api/incidents/results/export` | Definida en `services/api/app/main.py`, no confirmada como montada en la API principal/despliegue. La exportación establece `Cache-Control: no-store`; el resultado analizado vive en memoria del proceso. |

**Nota de seguridad:** varias rutas autenticadas dependen de rol, usuario, estado actual o contienen datos personales. La presencia de un token bearer y de un proxy compartido no convierte una respuesta en segura para caché compartida. También se observó `Cache-Control: no-store` en la exportación del analizador CSV y opciones `cache: "no-store"` en los clientes fetch del backoffice; esto describe el comportamiento actual observado, no una política completa comprobada para todos los proxies/CDN.

## 5. Estado actual de caché y frontend

- Búsqueda en `services` y `uis` de `Cache-Control`, `lru_cache`, Redis/Memcached, `unstable_cache` y `revalidate`: no se identificó una implementación general. La búsqueda no demuestra ausencia en cualquier infraestructura externa.
- Los clientes del backoffice (`lib/api-client.ts`, `lib/api.ts`, `lib/incidents-api.ts`) especifican `cache: "no-store"` en fetch inspeccionados. Esta política puede ser deliberada por autenticación/consistencia y debe revisarse por endpoint; no se debe quitar globalmente.
- `CandidateList` ya memoiza el filtrado local con `useMemo`; la lista de origen se carga desde API y luego se filtra en cliente. El backend actualmente carga la tabla completa antes de paginar, pero se necesita medición para valorar el cuello de botella.
- `IncidentsAnalyzerPanel` ya memoiza el total de incidencias inválidas calculado del resultado. No hay base para añadir memoización adicional sin identificar renders/costes.
- No se observaron cargas diferidas explícitas en la búsqueda de patrones indicada. La viabilidad de separar componentes depende del tamaño real del bundle y del impacto en interacción/navegación.

## 6. Oportunidades preliminares para medir

| Área candidata | Hecho observado | Pregunta para fases posteriores; no decisión de caché |
| --- | --- | --- |
| Candidatos | Lectura TinyDB completa y paginación posterior en Python; filtrado cliente de lista cargada. | ¿Cuántos registros hay y qué parte del tiempo corresponde a TinyDB, serialización, red y render? Comparar paginación/filtrado de origen antes de decidir caché. |
| Resumen de incidencias gestionadas | Carga de filas no archivadas y agregación Python. | ¿Cardinalidad, frecuencia de consulta y coste medido? ¿Qué escrituras invalidan los conteos? |
| Inventario | El stock se deriva de movimientos; el listado usa agregación SQL y el detalle consulta movimientos/lotes. | Medir planes SQL/volumen y concurrencia. Toda escritura de movimiento, lote o artículo puede afectar resultados relacionados. |
| Telemetría técnica | Reporte agregado SQL con rango temporal opcional y acceso de rol elevado. | Medir rango/volumen, patrones de consulta y frescura requerida; segmentar claves por parámetros y autorización. |
| Reporte semanal | Lectura de resultados agregados persistidos por semana, con pipeline de escritura explícito. | Comparar coste de lectura con el tamaño pequeño del resultado; definir validez respecto a estado de pipeline y semana solicitada. |
| Componentes de carga opcional | Analizador CSV en ruta propia; existen vistas complejas de inventario/reporting. | Medir bundle inicial y navegación con herramientas de Next antes de plantear dynamic import/lazy loading. |

No hay clasificación de endpoint ganador ni estimación de ahorro en esta fase. Las frecuencias, cardinalidades y latencias reales son desconocidas.

## 7. Riesgos, restricciones y cuestiones pendientes

1. **Privacidad y autorización:** candidatos/notas, perfiles y administración de usuarios contienen datos personales. No cachear compartidamente ni reutilizar una clave sin definir identidad, rol y alcance.
2. **Consistencia e invalidación:** cambios de candidatos, notas, incidencias, movimientos, lotes y proveedores afectan listados, detalles y agregados. Se requieren reglas explícitas para cada escritura y lectura derivada.
3. **Inventario derivado:** el stock depende del historial de movimientos, con vínculos a lotes y artículos. Una caché parcial puede presentar stock incorrecto incluso si el item base no cambió.
4. **Procesos múltiples:** rate limiting público, resultado CSV y algunos estados viven en memoria. El comportamiento cambia entre workers/instancias; añadir una caché local no proporcionaría coherencia distribuida.
5. **Dependencias de datos:** TinyDB realiza lecturas de colecciones y filtros en memoria en algunos servicios; PostgreSQL se configura condicionalmente. No se conoce el volumen representativo ni el modo de persistencia de producción.
6. **Datos no cacheables por naturaleza:** login, tokens/reset de contraseña, escrituras, exportaciones sensibles y endpoints sujetos a autorización no deben recibir políticas de caché genéricas. Debe mantenerse el `no-store` donde corresponda.
7. **Detalles de proxy/deployment:** confirmar reglas de caché CDN/reverse proxy, número de workers, despliegue real del analizador separado y configuración de base de datos usando configuración no secreta. No se inspeccionaron valores de `.env`.
8. **Ausencia de mediciones:** no se ejecutaron pruebas, profiling, benchmarks, load tests ni llamadas a endpoints en esta fase. No hay cifras de latencia, throughput ni mejora.

### Discrepancia documental

Los README raíz contienen afirmaciones propias de un starter/template y señalan que no hay aplicaciones ejecutables, mientras que en el repositorio existen implementaciones Next.js/FastAPI, pruebas y configuración de despliegue. Para este diagnóstico se ha priorizado el código y los manifiestos observados sobre esas afirmaciones generales; la discrepancia queda pendiente de normalización documental fuera del alcance de esta tarea.

## 8. Archivos que probablemente se revisarían más adelante

Esta lista es orientativa y no autoriza modificaciones; las rutas finales dependerán del plan aprobado y de resultados medidos.

- Frontend/API cliente: `uis/backoffice/lib/api-client.ts`, `lib/api.ts`, `lib/incidents-api.ts`, `lib/managed-inventory-api.ts`, `lib/reporting-api.ts`, `lib/suppliers-api.ts`.
- Componentes/vistas: `uis/backoffice/components/CandidateList.tsx`, `IncidentSummaryPanel.tsx`, `IncidentsAnalyzerPanel.tsx`, `ManagedInventory.tsx`, `WeeklyInventoryReport.tsx`, `TechnicalTelemetryReport.tsx`, y las páginas que los montan.
- Proxy y sitio público: `uis/backoffice/next.config.ts`, `uis/website/app/api/application/route.ts`; solo si se identifican requisitos concretos de transporte/cache.
- API: `services/api/records.py`, `services/api/incidents.py`, `services/api/managed_incidents.py`, `services/api/routers/inventory_v2.py`, `services/api/routers/inventory.py`, `services/api/routes/suppliers.py`, `services/reporting/router.py`, `services/telemetry/router.py` y los servicios/modelos correspondientes.
- Infraestructura/configuración: archivos de despliegue y configuración de proxy/cache que se identifiquen como activos. No se identificó todavía un backend de caché ni se recomienda incorporarlo sin medición y diseño.
- Pruebas: suites frontend en `uis/backoffice/lib/__tests__/` y backend en `services/api/tests/`, ampliadas solo conforme a la solución acordada.

## 9. Comprobaciones realizadas y límite de la fase

Se inspeccionaron entrypoints, registro de routers, persistencia/servicios, configuración de proxy, páginas/componentes representativos, manifiestos y documentación de testing. No se ejecutaron comandos de aplicación o de testing para evitar confundir pruebas funcionales con medidas de rendimiento; no se editaron archivos de producción ni se cambiaron autenticación, autorización, rutas o dependencias.

**Conclusión:** la arquitectura ofrece varias áreas medibles, pero en esta fase no se selecciona un endpoint para cachear ni se propone una política TTL. La decisión requiere evidencia de carga/coste, semántica de frescura, permisos e invalidación. Cualquier trabajo posterior debe esperar aprobación explícita.

## 10. Análisis de optimización del frontend (Fase 2)

**Estado:** implementada la propuesta descrita abajo; pruebas, TypeScript, build de producción y lint focalizado completaron correctamente. El lint global reporta dos errores en archivos no modificados por esta tarea. No se dispone de una comparación de bundle ni de profiling React con datos representativos, por lo que no se atribuyen ahorros cuantitativos.

### 10.1 Candidatos a carga diferida

La página `/account/profile` (`uis/backoffice/app/(auth)/account/profile/page.tsx`) es un componente cliente que presenta dos componentes solo en sus respectivas pestañas. Se aplicó `next/dynamic` con imports explícitos de cada export nombrado y un fallback de estado accesible. No se especifica `ssr: false`: no es necesario para esos módulos y los componentes no dependen de APIs del navegador al inicializarse.

| Candidato y ubicación | Función, dependencias y complejidad observada | Uso y presencia actual en carga inicial | Beneficio potencial | Costes y riesgos |
| --- | --- | --- | --- | --- |
| `UserAdministration` — `uis/backoffice/components/UserAdministration.tsx`, montado desde la pestaña “Administrar usuarios” de `app/(auth)/account/profile/page.tsx` | Componente de administración de unas 270 líneas; lista, creación, cambio de rol, eliminación y restablecimiento de contraseñas. Depende de varias operaciones de `@/lib/api-client`, estado local y confirmaciones del navegador. | Solo se renderiza si la sección activa es `users` **y** el rol es `admin`; su importación ahora se difiere hasta que Next resuelve el componente al seleccionarse esa pestaña. El efecto de carga de usuarios ya esperaba al montaje, así que la petición API sigue ocurriendo al mostrarlo, no antes. | Evitar incluir el módulo como dependencia inmediata del perfil y descargarlo al seleccionar la pestaña. No se ha medido el tamaño del chunk. | Primera selección puede mostrar fallback; mantener accesible el estado de carga. La condición de rol admin se conserva y la separación de chunks no es control de autorización: la autorización backend sigue siendo imprescindible. |
| `ChangePasswordForm` — `uis/backoffice/components/ChangePasswordForm.tsx`, montado desde la pestaña “Cambiar contraseña” de `app/(auth)/account/profile/page.tsx` | Formulario de unas 161 líneas con validación, estados de envío/errores y uso de `changePasswordRequest` y `useAuth().logout`. | Solo se renderiza con `activeSection === "password"`; el import ahora es dinámico y el formulario se descarga al seleccionarlo. No solicita datos hasta enviar el formulario. | Evitar cargar el módulo antes de usar la pestaña. Ganancia exacta y peso separado no medidos. | Primera selección puede mostrar fallback; se preservan formulario y sesión/auth context. |

Se implementaron ambos imports diferidos por sus puntos de montaje condicionales. La pantalla `IncidentsAnalyzerPanel` (unas 239 líneas, selección/análisis CSV y descarga con APIs del navegador) no se añadió como un `dynamic` adicional: está en `/incidents/analyzer`, una ruta independiente para la que Next.js ya puede generar chunks por ruta, por lo que el beneficio incremental dentro de la página no está demostrado.

### 10.2 Oportunidad de `useMemo`

**Candidato:** derivaciones de la lista en `ManagedInventory`, en `uis/backoffice/components/ManagedInventory.tsx`.

- En cada render, `items.filter(...)` vuelve a recorrer los artículos aplicando oficina, categoría, alertas y búsqueda localizada sobre ID/SKU/nombre/oficina/categoría/unidad. La búsqueda se normaliza también en cada render. Además, el mensaje de estado ejecuta otro `visible.filter(...)` para contar las alertas, aunque `visible` ya sea una derivación del filtrado anterior.
- El array procede de `getInventoryItems` y se reemplaza al cargar/eliminar; los filtros y el término de búsqueda cambian por interacción. La dependencia candidata para memoizar la lista es `[items, office, category, reorderOnly, term]` (o el texto normalizado, derivado también con sus propias dependencias). El conteo de alertas debe derivarse de forma coherente de esa lista memorizada, evitando recorrerla dos veces si se puede calcular junto con el filtrado.
- Hoy ambas operaciones se repiten en cualquier render que no cambie esos datos, por ejemplo ante cambios de estado local de eliminación/errores. Una memoización correcta podría evitar esos recorridos y comparaciones de texto mientras las dependencias permanezcan iguales.
- No se conoce la cardinalidad de inventario en producción ni el coste de `toLocaleLowerCase`/`includes` en datos representativos. Las pruebas observadas usan 12 artículos, lo que valida paginación/filtrado funcional, pero no demuestra que exista un cuello de botella de rendimiento. El beneficio esperado es condicional y no cuantificable sin profiling; `useMemo` añade complejidad y no reduce el coste cuando cambian filtros o datos.

No se recomienda añadir otro `useMemo` al pequeño `Object.values(...).reduce(...)` de `IncidentsAnalyzerPanel`: ya está memoizado en el código actual y no hay evidencia de que esa suma sea costosa. `CandidateList` ya memoiza su filtrado, por lo que tampoco es una nueva oportunidad.

### 10.3 Plan de implementación propuesto y validación

Solo tras aprobación explícita:

1. Se cambiaron las importaciones estáticas de `ChangePasswordForm` y `UserAdministration` por `next/dynamic` en `uis/backoffice/app/(auth)/account/profile/page.tsx`. Los fallbacks son mensajes visibles con `role="status"`. Se preservaron estados de pestaña, estructura e IDs existentes y la guardia `user?.role === "admin"`.
2. En `uis/backoffice/components/ManagedInventory.tsx`, se añadió un `useMemo` cuya derivación retorna la lista filtrada y el total de alertas calculado sobre esa lista. Dependencias: `[items, office, category, reorderOnly, term]`. `items` es el array actualmente cargado, los filtros se usan directamente y `term` es la búsqueda normalizada para comparación localizada. Mantiene criterios, orden, paginación y comportamiento de actualización/eliminación; los resultados se recalculan al cambiar cualquier dato relevante. El conteo sigue recorriendo los resultados filtrados una vez adicional dentro de la misma derivación memoizada.
3. Se ampliaron las pruebas de inventario para verificar el total de alertas con datos de prueba mixtos y el filtrado combinado. Se añadió `uis/backoffice/app/(auth)/account/profile/__tests__/page.test.tsx` para comprobar selección diferida de contraseña, presencia de administración solo para admin y carga al entrar a su pestaña.
4. Validación ejecutada desde `uis/backoffice`: suite Vitest completa, **24 archivos y 91 pruebas pasaron**; `npx tsc --noEmit`, pasó; `npm run build`, pasó (Next.js 16.2.10 compiló y generó páginas/rutas). `npx eslint 'app/(auth)/account/profile/page.tsx' 'app/(auth)/account/profile/__tests__/page.test.tsx' components/ManagedInventory.tsx components/__tests__/inventoryProtectedRoutes.test.tsx`, pasó. `npm run lint` global no pasó: encontró `react-hooks/set-state-in-effect` en `components/AuthenticatedNavigation.tsx:92` y `lib/auth-context.tsx:70`; ninguno de esos archivos forma parte de esta implementación y no se modificaron para evitar ampliar el alcance. El build emitió un aviso por lockfiles en raíz y backoffice. No se obtuvo un reporte comparable del tamaño de chunks ni se utilizó React DevTools Profiler; el build solo confirma producción/compilación, no cuantifica la mejora. Las pruebas usan fixtures pequeños y no son benchmark.

**Archivos modificados por esta implementación:** `uis/backoffice/app/(auth)/account/profile/page.tsx`, `uis/backoffice/components/ManagedInventory.tsx`, `uis/backoffice/components/__tests__/inventoryProtectedRoutes.test.tsx`, `uis/backoffice/app/(auth)/account/profile/__tests__/page.test.tsx` y este documento. No se cambiaron dependencias. La página de perfil ya contenía modificaciones previas del usuario para las pestañas; se conservaron y se añadieron únicamente los imports diferidos/fallbacks. El worktree contiene otros cambios preexistentes ajenos a esta tarea.

**Limitaciones:** las mediciones comparativas de bundle/profiling y datos de inventario representativos siguen pendientes. El build de producción no permite inferir una mejora cuantitativa, y no se midieron latencias, renders evitados ni tamaño ahorrado. No se cambiaron dependencias ni se alteraron autenticación/autorización.

## 11. Fase 3 — Análisis de rendimiento del backend

**Estado:** instrumentación de duración implementada; inventario revisado desde el registro de rutas y handlers. No se han ejecutado pruebas de carga, no se han medido latencias/throughput y no se ha implementado caché.

### 11.1 Punto de entrada e instrumentación

La aplicación principal activa es `services/api/main.py` (`app = FastAPI(...)`), que monta los routers indicados abajo y además declara `/` y `/health`. El Compose de desarrollo ejecuta `main:app` desde `services/api`; el healthcheck consulta `/health`. `services/api/app/main.py` crea otra aplicación independiente para análisis CSV: no está montada en la app principal según el código inspeccionado.

Se añadió `RequestTimingMiddleware` como middleware ASGI exterior a CORS. Registra un evento INFO por solicitud HTTP con los campos estructurados `http_method`, `route`, `status_code` y `duration_ms`, calculado con reloj monotónico. La escritura ocurre en `finally` y se intenta capturar el estado enviado; si la excepción impide iniciar una respuesta, registra 500. Se usa el patrón de ruta FastAPI (por ejemplo, `/users/{user_id}`), nunca el path concreto como fallback; se omiten query string, headers, body, IP, usuario, tokens y contenido de excepciones. Para rutas no resueltas se registra `<unmatched>`. No se modifica el cuerpo ni el status de la respuesta. El logger es `api.request_timing`; el despliegue debe configurar la recolección/retención de logs y comprobar que sus formatters preservan estos campos estructurados sin serializar datos de la solicitud.

Los tiempos generados por middleware, una vez desplegado y observados, incluirán aplicación y middleware interno, pero no equivalen a tiempo de base de datos ni a latencia de extremo a extremo vista por el cliente. No hay todavía muestras de producción ni línea base. Las pruebas focalizadas de middleware están en `services/api/tests/test_request_timing.py`; sus comprobaciones son funcionales, no benchmarks.

### 11.2 Inventario completo de rutas registradas

La frecuencia de cada ruta **no está medida**; en toda la tabla se considera desconocida. Los costes son inferencias estáticas del camino de código, no duraciones observadas ni un ranking. “Bearer” significa usuario activo autenticado; restricciones adicionales se indican aparte. Las escrituras se incluyen para dejar visibles efectos e invalidaciones potenciales, no como candidatas a caché.

#### Salud, identidad, usuarios y perfiles

| Método/ruta | Acceso, almacenamiento y comportamiento | Coste inferido; frecuencia |
| --- | --- | --- |
| `GET /`, `GET /health` | Públicos; respuesta fija, sin almacenamiento. | Bajo; desconocida. |
| `POST /users` | Registro público; crea usuario y perfil en TinyDB, hash bcrypt. | Bajo–moderado por hash; desconocida. |
| `GET /users` | Admin; lista usuarios TinyDB y resuelve perfil por usuario. | Moderado y creciente con usuarios; desconocida. |
| `POST /users/admin` | Admin; crea usuario/perfil y solicita email de restablecimiento (Resend). | Moderado y dependiente de servicio externo; desconocida. |
| `GET /users/{user_id}` | Bearer, propietario o admin; lookup de usuario en TinyDB. | Bajo; desconocida. |
| `PUT /users/{user_id}`, `DELETE /users/{user_id}` | Admin; actualización/borrado, con protección del último admin activo. | Bajo–moderado; desconocida. |
| `POST /users/{user_id}/force-password-reset` | Admin; cambia credencial, crea token y llama Resend. | Moderado/externo; desconocida. |
| `GET /profiles/me`, `PUT /profiles/me` | Bearer; lectura/actualización del perfil propio en TinyDB. | Bajo; desconocida. |
| `POST /auth/login` | Público; consulta TinyDB, verifica bcrypt y firma JWT. | Moderado; desconocida. |
| `GET /auth/me` | Bearer; devuelve identidad y lookup de perfil TinyDB. | Bajo; desconocida. |
| `POST /auth/forgot-password` | Público; respuesta antienumeración; invalidación/escritura TinyDB y posible correo. | Moderado y externo; desconocida. |
| `POST /auth/reset-password`, `POST /auth/change-password` | Público con token de un uso / Bearer; validación de token/usuario y hash bcrypt. | Moderado; desconocida. |

#### Candidatos, notas e incidencias

| Método/ruta | Acceso, almacenamiento y comportamiento | Coste inferido; frecuencia |
| --- | --- | --- |
| `GET /records` | Bearer; obtiene toda la tabla TinyDB y pagina en memoria. | Crece con todos los registros; desconocida. |
| `GET /records/{record_id}` | Bearer; lookup TinyDB individual. | Bajo; desconocida. |
| `POST /records` | Bearer; inserta candidato en TinyDB. | Bajo; desconocida. |
| `POST /records/public` | Público; valida consentimiento, honeypot y rate-limit en proceso, inserta en TinyDB. | Bajo; desconocida. |
| `PUT /records/{record_id}`, `PATCH /records/{record_id}` | Bearer; lectura/actualización/lectura TinyDB. | Bajo; desconocida. |
| `DELETE /records/{record_id}` | Bearer; borra candidato y sus notas con búsqueda en TinyDB. | Bajo–moderado; desconocida. |
| `GET /records/{record_id}/notes` | Bearer; busca notas por candidato. | Crece con notas del candidato; desconocida. |
| `POST /records/{record_id}/notes`, `DELETE /records/{record_id}/notes/{note_id}` | Bearer; muta notas y recalcula contador. | Bajo–moderado; desconocida. |
| `POST /incidents` | Bearer por dependencia de router; crea incidencia legacy en TinyDB. | Bajo; desconocida. |
| `GET /incidents` | Bearer; lee toda tabla TinyDB y filtra en Python. | Crece con tabla completa; desconocida. |
| `PATCH /incidents/{incident_id}/status` | Bearer; lookup, transición y actualización TinyDB. | Bajo; desconocida. |
| `GET /incidents/summary` | Bearer; lee toda tabla legacy y agrupa en Python. | Crece con incidencias; desconocida. |
| `GET /incidents/{incident_id}` | Bearer; lookup individual TinyDB. | Bajo; desconocida. |
| `POST /v2/incidents` | Bearer; inserta incidente SQL y registros de auditoría. | Moderado; desconocida. |
| `GET /v2/incidents` | Bearer; cuenta subconsulta y lista SQL paginada con filtros/búsqueda. | Moderado, depende de volumen/índices; desconocida. |
| `GET /v2/incidents/summary` | Bearer; carga incidentes activos y agrega en Python. | Crece con filas activas; desconocida. |
| `GET /v2/incidents/{incident_id}` | Bearer; lookup SQL por clave primaria, excluye archivados. | Bajo; desconocida. |
| `GET /v2/incidents/{incident_id}/history` | Bearer; valida incidente y lista eventos de auditoría ordenados. | Crece con historial; desconocida. |
| `PATCH /v2/incidents/{incident_id}`, `PATCH /v2/incidents/{incident_id}/status` | Bearer; bloqueo de fila, transición/actualización y auditoría. | Moderado; desconocida. |
| `DELETE /v2/incidents/{incident_id}` | Bearer; archivado lógico y evento de auditoría. | Moderado; desconocida. |
| `DELETE /v2/incidents/{incident_id}/permanent` | Bearer; borra eventos y entidad SQL. | Moderado, dependiente del historial; desconocida. |

#### Inventario y proveedores

| Método/ruta | Acceso, almacenamiento y comportamiento | Coste inferido; frecuencia |
| --- | --- | --- |
| `GET /inventory/products` | Bearer y guardia contra edición directa de stock; suma movimientos SQL agrupados y los une a artículos. | Moderado; desconocida. |
| `POST /inventory/products` | Bearer/guardia; adapta a creación canónica de item SQL. | Moderado; desconocida. |
| `GET /inventory/products/{id}` | Bearer/guardia; item SQL y suma de movimientos del artículo. | Moderado; crece con movimientos; desconocida. |
| `POST /inventory/orders/inbound`, `POST /inventory/orders/outbound` | Bearer/guardia; adaptan a movimiento canónico; salida bloquea artículo y valida stock. | Moderado; desconocida. |
| `GET /inventory/orders` | Bearer/guardia; join SQL movimientos-artículos, orden y serialización. | Moderado, crece con resultado; desconocida. |
| `POST /inventory/items` | Bearer/guardia; crea item SQL y calcula stock para respuesta. | Moderado; desconocida. |
| `GET /inventory/items` | Bearer/guardia; filtros SQL y suma agrupada de movimientos; alertas de reposición. | Moderado; desconocida. |
| `GET /inventory/items/{item_id}` | Bearer/guardia; item y suma en Python de sus movimientos. | Moderado, crece con movimientos; desconocida. |
| `PATCH /inventory/items/{item_id}` | Bearer/guardia; bloqueo/actualización y nueva lectura de stock. | Moderado; desconocida. |
| `DELETE /inventory/items/{item_id}` | Bearer/guardia; comprueba lotes/movimientos vinculados antes de borrar. | Bajo–moderado; desconocida. |
| `DELETE /inventory/items/{item_id}/permanent` | Bearer/guardia; borra movimientos, lotes y artículo. | Crece con dependencias; desconocida. |
| `GET /inventory/lots` | Bearer/guardia; selección ordenada con filtro opcional por artículo. | Crece con resultados; desconocida. |
| `POST /inventory/lots` | Bearer/guardia; verifica artículo y crea lote SQL. | Bajo–moderado; desconocida. |
| `DELETE /inventory/lots/{lot_id}` | Bearer/guardia; borrado de lote. | Bajo; desconocida. |
| `POST /inventory/movements` | Bearer/guardia; bloquea item, valida lote/stock, escanea movimientos, lookup TinyDB opcional de proveedor y escribe movimiento/telemetría. | Moderado–alto; desconocida. |
| `GET /inventory/movements` | Bearer/guardia; lista SQL ordenada con filtros opcionales. | Crece con resultados; desconocida. |
| `POST /suppliers` | Bearer por dependencia de router; inserta TinyDB. | Bajo; desconocida. |
| `GET /suppliers` | Bearer; lista/búsqueda por país/categoría en TinyDB. | Crece con proveedores; desconocida. |
| `GET /suppliers/{supplier_id}` | Bearer; lookup por document ID TinyDB. | Bajo; desconocida. |
| `PATCH /suppliers/{supplier_id}/rate`, `PATCH /suppliers/{supplier_id}/status` | Bearer; valida y actualiza proveedor TinyDB. | Bajo; desconocida. |
| `DELETE /suppliers/{supplier_id}` | Bearer; elimina proveedor TinyDB. | Bajo; desconocida. |

#### Reporting y telemetría

| Método/ruta | Acceso, almacenamiento y comportamiento | Coste inferido; frecuencia |
| --- | --- | --- |
| `GET /reporting/pipeline-runs/latest` | Bearer por router; última ejecución SQL. | Bajo; desconocida. |
| `POST /reporting/pipeline-runs` | Admin/manager; lock asesor PostgreSQL, consulta eventos temporales, agrupa en Python y reemplaza snapshots semanales. | Moderado–alto, proporcional a eventos del rango; desconocida. |
| `GET /reporting/weekly-office-program-performance` | Bearer; valida semana/ejecución y lee filas semanales ordenadas. | Bajo–moderado; desconocida. |
| `GET /telemetry/report` | Admin/manager; conteo y extremos temporales SQL agrupados por tipo y rango. | Moderado, depende de eventos/rango e índices; desconocida. |

**Autenticación y restricciones transversales de inventario:** todos los endpoints `/inventory/*` requieren usuario autenticado y ejecutan `reject_direct_stock_edit`; la operación no impone rol específico y la dependencia rechaza escrituras directas al stock. Las búsquedas de proveedor en movimientos consultan TinyDB además de SQL. Reporting requiere bearer en todo el router y el POST de pipeline limita además a admin/manager. Telemetry report limita a admin/manager. Los routers legacy `/incidents` y `/suppliers` tienen dependencia bearer a nivel router; no se observó requisito de rol adicional en esas operaciones. En usuarios y perfiles, las restricciones son por endpoint tal como se anotan en la tabla.

#### Aplicación CSV separada (no montada en la principal)

| Método/ruta | Acceso, almacenamiento y comportamiento | Coste inferido; frecuencia |
| --- | --- | --- |
| `POST /api/incidents/analyze` | Público; multipart CSV analizado en proceso y resultado guardado en memoria; carga configuración JSON. | Moderado–alto, depende del tamaño del archivo; desconocida. |
| `GET /api/incidents/results/export` | Público; exporta resultado del proceso a CSV; `no-store`. | Bajo–moderado, proporcional a filas; desconocida. |

La tabla refleja rutas registradas en los routers inspeccionados, no incluye preflight CORS como endpoint de negocio y no es un reporte de tráfico. `GET /incidents/summary` y `GET /v2/incidents/summary` se registran antes de las rutas dinámicas equivalentes. En cambio, `GET /records/public` no está declarada como estática y puede coincidir con el parámetro dinámico `record_id`; `GET /users/admin` también puede tratar `admin` como ID. Son observaciones del orden/matching actual, no cambios incluidos en esta fase.

### 11.3 Volumen y validez de muestras

No se consultaron las bases configuradas, no se leyó `services/api/data/db.json`, no se inspeccionaron secretos/valores `.env`, no se ejecutaron seeds ni se enviaron solicitudes a un servidor. Por tanto, los conteos reales de TinyDB y PostgreSQL son **desconocidos**. El código de seed/fixtures visible es pequeño y no representativo por sí solo (por ejemplo, muestras de proveedores del orden de 15 documentos y un seed de inventario Hito 4 de 12 artículos, 3 lotes y 36 movimientos); esos números describen datos de ejemplo, no bases activas ni volúmenes de producción. La muestra de seed Hito 6 es variable y tampoco prueba cardinalidad real.

Con la evidencia disponible no puede afirmarse que haya datos representativos para una prueba de carga. Se requiere aprobación previa para este procedimiento propuesto:

1. Acordar un objetivo de volumen/carga a partir de conteos y uso esperados; documentar p50/p95/p99, throughput, errores y concurrencia objetivo por ruta/grupo.
2. Preparar entorno aislado y desechable: PostgreSQL efímero sin URL de producción, TinyDB temporal nuevo fuera de `data/db.json`, usuario ficticio y dataset sintético sin PII. Verificar el host/base destino y abortar por defecto ante destinos no aislados.
3. Diseñar seeder explícito, idempotente y limitado con perfiles escalonados (smoke, mediano, objetivo), transacción/cleanup, límites máximos y bandera afirmativa de ejecución. Separar seed de prueba funcional del generador de carga; nunca apuntar a credenciales o servicios compartidos.
4. Ejecutar una línea base de calentamiento y escenarios de solo lectura/escritura controlada con parámetros documentados, primero en local/CI aislado; comparar logging habilitado y observar que no se emiten identificadores/queries. No ejecutar hasta aprobación del usuario.
5. Limpiar el entorno efímero y registrar versión de código, configuración no secreta, cardinalidades, herramienta, escenario y resultados agregados.

No se creó ni ejecutó ese seeder y no se realizó la carga en esta fase. En particular, la instrumentación recién añadida todavía no produce muestras evaluadas.

### 11.4 Coste, frecuencia, estabilidad y criterio de caching

No hay frecuencia real por endpoint: debe obtenerse de logs/APM con ventana representativa y agregación por método + ruta de plantilla, excluyendo identificadores. No se deben confundir conteos de requests con número de usuarios ni inferencias de tráfico con mediciones. El coste de la tabla previa es cualitativo y estático; las rutas con lecturas completas TinyDB, agregados/resúmenes Python, joins/aggregations SQL, historial o informes por rango son hipótesis de coste a contrastar, no problemas probados.

La estabilidad también es cualitativa: `/` y `/health` son respuestas fijas; lecturas personalizadas (perfil, usuario, candidato, notas) dependen de identidad y autorización; inventario depende de movimientos/lotes y es mutable; incidencias y proveedores pueden cambiar por escrituras; reportes/telemetría dependen de datos nuevos y rangos/semana; auth, tokens, exports y mutaciones tienen efectos sensibles. No se selecciona ningún endpoint para caché. Cualquier decisión futura requerirá coste y frecuencia medidos, frescura requerida, aislamiento por usuario/rol, invalidación, y comportamiento coherente entre workers. No se implementa ni recomienda política TTL en esta fase.

### 11.5 Validación y límites

Se añadieron pruebas de ruta normal y error no controlado para verificar duración no negativa, método/ruta plantilla/estado, ausencia de path/query/exception sensibles en los logs y respuesta 500 conservada. `uv run` con entorno efímero ejecutó `pytest -q tests/test_request_timing.py tests/test_smoke.py` desde `services/api`: **3 passed** (aviso deprecado de Starlette/httpx; sin fallos). El entorno local del proyecto no tenía FastAPI instalado; uv creó un virtualenv para la ejecución, sin cambiar archivos de dependencias. Pylance no reportó errores en los dos archivos Python modificados y `git diff --check` pasó. Estas pruebas no miden throughput ni rendimiento, y la falta de tráfico medido permanece explícita.

## Estrategia de caching del backend

**Estado: estrategia aprobada para implementación por solicitud del usuario en Fase 5.** La instrumentación de Fase 3 está instalada en el código, pero no hay todavía resultados observados de tráfico. Por tanto, no es posible afirmar que dos endpoints cumplan de manera demostrada el criterio obligatorio de frecuencia. La implementación queda condicionada a las limitaciones indicadas abajo; no constituye evidencia de frecuencia suficiente ni calibración empírica de TTL.

### Evaluación de candidatos

| Método/ruta | Función responsable | Coste de ejecución | Frecuencia | Estabilidad | Beneficio potencial y frescura | Sensibilidad/compartición |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /reporting/weekly-office-program-performance?week_start=...` | `services/reporting/router.py::weekly_report` | Bajo–moderado inferido: valida run y lee/serializa filas semanales. No hay coste cronometrado. | Observada: **desconocida**. Estimada cualitativamente: podría repetirse durante revisión de la semana, pero no hay evidencia para cuantificarla. | Alta para una semana ya calculada; cambia si se vuelve a ejecutar el pipeline para la misma semana. | Reutilizar serialización/SQL de una respuesta limitada por semana. Riesgo: mostrar snapshot antiguo después de una corrida nueva; podría tolerarse hasta invalidación o expiración breve, sujeto a producto. | No es por usuario y el router solo requiere bearer. Aun así, contiene métricas operativas y costes agregados; compartiría una respuesta únicamente entre usuarios autenticados con el mismo alcance autorizado, nunca de forma pública/CDN. Confirmar clasificación antes de cachear. |
| `GET /telemetry/report?start=...&end=...` | `services/telemetry/router.py::get_report` → `telemetry.analysis::technical_report` | Moderado inferido: dos agregaciones SQL (`GROUP BY`, `COUNT`, `MIN/MAX`) sobre el intervalo. No hay coste cronometrado. | Observada: **desconocida**. Estimada cualitativamente: los paneles pueden refrescar reportes, sin medición de su frecuencia. | Media/baja para rangos que incluyen el presente; alta para intervalos cerrados históricos si eventos son inmutables. Captura de telemetría puede agregar eventos por movimientos. | Un hit puede evitar agregaciones repetidas del mismo intervalo. Riesgo de conteos temporalmente incompletos/desactualizados, especialmente para intervalos abiertos o recientes. | No está personalizada por usuario después de autorizar, pero está restringida a admin/manager y es información operativa. Compartición solo dentro del conjunto autorizado, después de resolver auth/rol. Clave no debe permitir saltarse permisos. |
| `GET /inventory/items?...` | `routers/inventory_v2.py::list_items` | Moderado inferido: lee items y agrega movimientos en SQL. No hay coste cronometrado. | Observada: **desconocida**. Estimada cualitativamente: probable consulta de interfaz operativa, no confirmada. | Baja para stock: cada movimiento puede cambiarlo y el resultado incluye alerta derivada. | Potencialmente evita agregación, pero se descarta en esta propuesta: stock requiere frescura y los endpoints de movimiento afectan de inmediato el resultado. | Requiere auth; existencias pueden ser operativamente sensibles. No compartir públicamente. Alto riesgo de respuesta obsoleta. |
| `GET /incidents/summary` y `GET /v2/incidents/summary` | Routers `incidents.py` y `managed_incidents.py` | Crece con filas porque cargan y agregan en Python; coste relevante hipotético, no medido. | Observada: **desconocida**. | Mutable por altas y transiciones de estado; resumen se espera fresco para operación. | Ahorro potencial si se repite, pero no se propone todavía por sensibilidad y frescura. | Resumen agregado, pero parte de un dominio de incidentes autenticado; no hay evidencia suficiente para definir alcance compartible. |
| `GET /records`, `GET /users`, lecturas de perfil/notas | Routers de records/users/profiles | Algunas lecturas completas TinyDB o N+1 lógico; coste inferido variable. | Observada: **desconocida**. | Cambia por escrituras y puede depender de autorización/propietario. | No se seleccionan por PII, personalización, invalidación amplia y riesgo de fuga entre usuarios. | No propuesta para caching compartido. |

**Decisión propuesta:** mantener los dos primeros como candidatos a una prueba de política limitada, condicionada a que instrumentación/APM muestre en una ventana acordada suficiente repetición de claves y coste justificable. No se afirma que ahora cumplan frecuencia. Si no se observa dicha repetición, no cachear y dejar constancia de “ningún endpoint elegible”. Antes de decidir se necesitan, como mínimo, conteos por ruta de plantilla y parámetros normalizados, distribución de repetición de claves, p50/p95 de duración, ventanas temporales representativas, rol autorizado, tasa de actualización de datos y demanda de frescura. No registrar tokens ni valores sensibles en claves/logs.

### Tecnología y comportamiento propuestos

**Alternativa recomendada para el primer experimento, si se aprueba:** diccionario TTL local acotado, encapsulado en un helper pequeño con `time.monotonic()`, máximo de entradas, expiración al leer y lock para proteger lectura/escritura concurrente. Mantenerlo específico del proceso y almacenar solo respuestas ya validadas/serializadas de estos GET. La autenticación y autorización deben ocurrir antes de consultar el cache; ningún hit puede omitir `get_current_user` ni la comprobación admin/manager.

- `dict` + TTL permite claves por parámetros y expiración temporal, funciona con handlers sync y async (aunque debe evitar bloqueo prolongado; estas funciones actuales son sync). El lock solo protege operaciones cortas del mapa, no debe mantenerse durante SQL. Limitar capacidad evita crecimiento ilimitado; definir política LRU/evicción junto con el TTL. El estado se pierde en reinicio y cada worker tendrá copias y expiración potencialmente distintas. En varios workers no hay invalidación distribuida ni garantía de que todos vean el mismo snapshot.
- `functools.lru_cache` no se recomienda para respuestas de endpoints: no implementa TTL/invalidation de forma nativa, puede cachear errores/objetos de sesión por mal uso, y no debe recibir `Session` como argumento. Solo sería apropiado para funciones puras y datos de configuración inmutables, no para los resultados SQL dinámicos de estos candidatos. Tampoco resuelve múltiples procesos.
- No se encontró evidencia de Redis compatible ya desplegado/configurado en el alcance inspeccionado. Añadir Redis y dependencia/operación no se justifica sin medir hit rate y coste, requisito multiworker, o necesidad de invalidación entre procesos; por ahora no se propone.

Para el primer despliegue experimental se requeriría una sola instancia/worker o aceptar formalmente consistencia eventual entre workers. Si producción requiere varias instancias, invalidación inmediata, o coherencia más fuerte que la que permiten los TTL, suspender esta opción y diseñar backend compartido (Redis u otro) por separado, con caso técnico/operativo cuantificado. No habilitar cache local silenciosamente en despliegue multiworker.

### Claves y TTL implementados

Los valores son propuestas iniciales para validación de producto, no TTL calibrados por medición. Aun cuando expire el TTL, la expiración solamente obliga a volver a leer origen; no implica servir stale-on-error.

| Endpoint | Clave implementada | TTL | Frescura, invalidación y expiración |
| --- | --- | --- | --- |
| `GET /reporting/weekly-office-program-performance` | `reporting:weekly-performance:v1:{week_start}`; resolver primero semana por defecto, validar lunes/semana y formar clave con fecha ISO. | **5 min** para respuesta; expiración absoluta (no extender TTL en hit). | Un dato semanal publicado suele permanecer estable salvo rerun. Después de corrida exitosa, invalidar la clave exacta de la semana y la clave de resolución “latest” si se introduce una. Tolerancia máxima propuesta: 5 min solo mientras no haya invalidación exitosa; el pipeline debe invalidar después del commit. Si no se puede garantizar invalidación en misma instancia, TTL puede permitir snapshot antiguo hasta 5 min y debe aprobarse. Si expira, releer y conservar el comportamiento 404/validación actual. |
| `GET /telemetry/report` | `telemetry:report:v1:{start_utc}:{end_utc}` con datetimes parseados y normalizados a UTC, incluyendo límites ausentes con marcadores explícitos. Autorización se ejecuta en cada petición y no forma parte de una identidad de cache; versionar clave evita colisión de esquemas. | **15 s** para rango abierto o que toca el presente; **5 min** para rango cerrado/histórico. | Los eventos nuevos afectan rangos abiertos/recientes; tolerancia propuesta 15 s para esos rangos. Rango histórico cerrado se asume inmutable y admite 5 min. Al insertar evento, invalidar entradas de rangos que cubren su `occurred_at` si las claves/rangos afectados pueden rastrearse; con cache local acotado es más seguro barrer todas las claves `telemetry:report:*` al confirmar escritura que capture evento. TTL de 15 s limita daños si se omite alguna ruta de escritura. Expiración vuelve a consultar agregados SQL; nunca entregar al público. |

**Nota de viabilidad para telemetry:** inserciones ocurren desde `telemetry.capture.capture_movement` en escrituras de inventario y pueden originarse en otros callsites. Inventariar todos los escritores y confirmar el momento post-commit antes de implementar invalidación. La invalidación debe ejecutarse solo después de commit exitoso; invalidar antes de rollback es inocuo para datos viejos pero no garantiza coherencia tras commit. No introducir callbacks/side effects que cambien respuesta de una mutación si falla el cache.

### Plan de invalidación por escrituras y relaciones

1. **Reporte semanal:** `POST /reporting/pipeline-runs` reemplaza snapshots de la semana afectada. Tras éxito/commit, invalidar `reporting:weekly-performance:v1:{week_start}`. Si la petición de lectura sin `week_start` se cachea por alias de “última semana”, invalidar también `reporting:weekly-performance:v1:latest`; alternativa preferida: resolver latest en DB por request y cachear bajo semana concreta, evitando alias persistente. Fallo de pipeline no debe invalidar una semana que no se modificó.
2. **Telemetría:** las escrituras de movimientos (`POST /inventory/movements`, `POST /inventory/orders/inbound`, `POST /inventory/orders/outbound`) pueden generar eventos vía captura; invalidar las claves de reportes intersectados después del commit. Revisar también eventos manuales/otros callsites de `capture_movement` y `direct_stock_edit_rejected`; no asumir que solo los tres endpoints son escritores. No usar invalidación en cada lectura.
3. **Mutaciones de dominio no seleccionadas:** creación/actualización/eliminación de candidato y notas invalida candidatos/notas si esas rutas se consideran en una fase futura; cambios de estado/creación/eliminación de incidencias invalidan resumen/listados asociados; alta/cambio/borrado de proveedor invalida listados/detalles de proveedores; cambios de items/lotes/movimientos invalidan listados de inventario/stock/reportes. No se crean claves para esas rutas en esta propuesta.
4. Si un cambio relacional afecta una respuesta derivada (movimiento modifica stock de item; movimiento asociado a categoría/programa genera telemetría y reporte; rerun semanal modifica filas), invalidar dependientes por clave de entidad/rango o barrer namespace relevante. Una invalidación global de namespace reduce riesgo de claves olvidadas pero disminuye hit ratio; medir y mantenerla acotada.
5. Invalidar solo después de commit. Fallos de invalidación no deben revertir el write; el TTL proporciona recuperación eventual y debe generarse métrica/log operacional sin registrar payload ni token. En sistema multiworker, un diccionario local no propaga invalidaciones: esto es un límite bloqueante salvo aceptación explícita o paso a almacenamiento compartido.

### Riesgos, límites y puerta de aprobación

- Frecuencia, hit ratio y latencias observadas siguen **desconocidos**; coste y estabilidad son inferencias de código. Por ello no se puede sostener aún la obligación de que dos endpoints cumplan simultáneamente coste, frecuencia y estabilidad. La propuesta de dos es condicional, y no autoriza implementar ni desplegar.
- Los agregados de reporting/telemetría pueden ser confidenciales aunque no lleven PII. Mantener auth/rol antes de cache, sin `Cache-Control: public`; definir la clasificación de datos y acceso común a todos los usuarios elegibles.
- Cache local causa resultados diferentes entre workers, pierde contenido en reinicio y puede permitir stale hasta TTL. No habilitar con múltiples workers sin decisión explícita de consistencia y estrategia de invalidación.
- No almacenar sesiones, credenciales, errores 4xx/5xx, respuestas de autorización fallida ni objetos `Session`. No loggear claves completas si contienen parámetros sensibles; el rango de telemetría debe normalizarse y limitarse conforme a validaciones existentes.
- Sin stale-on-error. La expiración puede aumentar carga SQL temporalmente; un límite máximo, lock de mapa y observación de hit/miss/evictions serían requisitos del cambio, no incluidos aquí.
- Antes de aprobar implementación: recolectar evidencia de frecuencia/coste durante una ventana representativa; confirmar número de workers/instancias y clasificación/autorización de agregados; aprobar TTL/tolerancia; verificar todos los callsites de escritura; después implementar pruebas de aislamiento, expiración, invalidación, concurrencia y fallo de origen.

### Implementación Fase 5

Se implementó la política aprobada únicamente para los dos GET seleccionados:

- **Helper:** `services/api/cache.py`. `TTLCache` mantiene como máximo 256 entradas LRU, usa expiración absoluta con `time.monotonic()`, copias profundas al leer/escribir y un `RLock` alrededor de operaciones breves. Una generación global impide que una lectura SQL que comenzó antes de una invalidación repueble el resultado obsoleto después de ella. Fallos al leer/escribir/invalidate cache se tratan como fallo abierto: el endpoint continúa desde origen y una invalidación fallida no revierte una escritura confirmada.
- **Reporte semanal:** `services/reporting/router.py::weekly_report`; clave `reporting:weekly-performance:v1:{week_start ISO}` y TTL 300 s. Cuando no se especifica semana, la semana exitosa más reciente se vuelve a resolver desde SQL por petición y después se usa su clave concreta (no hay alias `latest`). Se guardan los bytes JSON previamente validados para conservar precisión Decimal. `POST /reporting/pipeline-runs` invalida la semana concreta solo cuando `run_pipeline` retorna tras su commit exitoso.
- **Reporte técnico:** `services/telemetry/router.py::get_report`; clave `telemetry:report:v1:{start UTC ISO o <open>}:{end UTC ISO o <open>}`. Offset-equivalentes normalizan a UTC. Se comprueba admin/manager antes del lookup; además, parámetros inválidos conservan 422 y no quedan cacheados. TTL 15 s si algún límite está abierto o el fin es posterior a `ahora - 15 s`; TTL 300 s para rango cerrado antiguo.
- **Invalidación de telemetría:** `services/api/routers/inventory_v2.py` invalida el prefijo completo de reportes después de `commit` exitoso en movimientos instrumentados y después del commit interno de un rechazo de edición directa que haya persistido telemetría. Los adaptadores legacy de inbound/outbound delegan al mismo `create_movement`, por lo que comparten invalidación. Los únicos escritores de `TelemetryEvent` en producción hallados son `capture_movement` y `capture_rejection`; el primero es llamado desde ese movimiento canónico.
- **Protección y alcance:** no se cachean respuestas de autorización fallida, errores, sesiones ni contenido personalizado por usuario; los endpoints conservan autenticación/autorización en cada solicitud. No se añadió `Cache-Control: public`. La caché es local al proceso, acotada, volátil y no distribuida. La configuración actual hallada no declara `--workers`, pero el escalado horizontal/worker futuro no está acreditado; en ese caso la invalidación no se comparte y debe sustituirse por almacenamiento compartido o aceptar explícitamente consistencia eventual antes del despliegue.

**Pruebas agregadas/ejecutadas:** `services/api/tests/test_hito6_reports.py` cubre hit/miss, invalidación y refresco, equivalencia de zonas horarias, claves distintas por rango, autorización antes del cache, copia defensiva, límite LRU, expiración, carrera de relleno frente a invalidación y fallos de cache con fallback a origen; también prueba un hit semanal sin consultas a la base. Se ejecutó `uv run --no-sync pytest -q tests/test_hito6_reports.py tests/test_user_roles_telemetry.py tests/test_inventory_v2_api.py tests/test_request_timing.py tests/test_smoke.py` desde `services/api`: **27 passed**, una advertencia conocida deprecada de Starlette/httpx. `git diff --check` pasó. La limitación de evidencia de frecuencia y latencia permanece: no se hicieron pruebas de carga ni se consultaron bases reales.
