# Architecture Proposal

## 1. Contexto del proyecto

### Hechos observados en el repositorio

- El repositorio sigue estructura de monorepo, con carpetas de primer nivel para interfaces ([uis/](uis/)), servicios ([services/](services/)), documentación ([docs/](docs/)) y paquetes compartidos ([packages/](packages/)).
- No existe backend implementado actualmente dentro de [services/](services/); hoy solo hay documentación de intención de carpeta.
- Existen dos frentes de UI relevantes:
1. Sitio estático y formulario en [index.html](index.html) y [application.html](application.html).
2. Aplicación Next.js en [uis/talent-pipeline-tracker/](uis/talent-pipeline-tracker/), centrada en pipeline de selección.
- El frontend Next.js consume una API HTTP externa a través de variable de entorno NEXT_PUBLIC_API_URL en [uis/talent-pipeline-tracker/lib/api.ts](uis/talent-pipeline-tracker/lib/api.ts#L16).
- Los recursos API usados de forma real por el frontend son:
1. GET /records
2. GET /records/{id}
3. POST /records
4. PUT /records/{id}
5. PATCH /records/{id}
6. GET /records/{id}/notes
7. POST /records/{id}/notes
8. DELETE /records/{id}/notes/{noteId}
- El dominio funcional actualmente implementado en UI y tipos está centrado en candidaturas y notas internas (no en toda la operación completa de Nexova).
- No se encontraron implementaciones existentes de CORS ni configuración backend (no hay FastAPI, SQLAlchemy, Alembic o código Python de API en el estado actual).

### Naturaleza del negocio inferida

- El contexto de empresa en [CONTEXT.md](CONTEXT.md) describe múltiples áreas (selección, formación, soporte, ventas, RRHH), pero el artefacto funcional más concreto en código es el seguimiento de candidaturas (Talent Pipeline Tracker).
- Por lo tanto, la propuesta backend se enfoca en el dominio confirmado por código: pipeline de candidaturas para operaciones de selección.

### Supuestos explícitos

- Supuesto A: el backend a diseñar cubrirá primero el caso de uso de Talent Pipeline Tracker antes de extenderse a otros dominios de Nexova.
- Supuesto B: la persistencia será relacional (por la naturaleza transaccional de records y notes), aunque la tecnología exacta de base de datos no está definida aún.
- Supuesto C: se mantendrá el contrato principal ya consumido por el frontend para evitar roturas inmediatas.

## 2. Análisis arquitectónico

Necesidades detectadas a partir del estado actual:

1. Formalizar un backend inexistente que ya tiene contrato implícito desde frontend.
2. Evitar acoplar lógica de negocio con capa HTTP desde el inicio.
3. Separar claramente validaciones de entrada/salida (schemas) de modelos de persistencia.
4. Facilitar evolución incremental: arrancar con candidaturas/notas y agregar dominios futuros sin reescritura.
5. Mantener coherencia con monorepo: frontend y backend conviven, pero con límites técnicos explícitos.
6. Habilitar testeo por capas (unitario de negocio e integración de API).

Restricciones reales:

- Proyecto en etapa temprana, sin backend productivo actual.
- Dominio funcional implementado en código todavía acotado.
- Requerimiento de no sobrearquitecturar.

## 3. Arquitectura propuesta

Se propone una arquitectura de monolito modular en capas, orientada a dominio, implementada con FastAPI.

Patrón combinado:

1. Modular por dominio: cada dominio (por ejemplo records, notes) encapsula su lógica.
2. Capas internas por módulo:
	- API (routers + DTOs/schemas)
	- Aplicación (casos de uso)
	- Dominio (entidades/reglas)
	- Infraestructura (repositorios, ORM, adaptadores externos)

Este enfoque permite un único despliegue al inicio, sin coste operativo de microservicios, manteniendo separación suficiente para escalar el código.

## 4. Justificación de la arquitectura

### Por qué es adecuada para este proyecto

1. Existe un solo frontend consumidor con un conjunto pequeño y claro de endpoints; un monolito modular reduce fricción de arranque.
2. El dominio real actual (candidaturas y notas) es acotado; no justifica arquitectura distribuida.
3. La separación por capas protege al proyecto de mezclar validación HTTP, reglas de negocio y acceso a datos en un único archivo.
4. El monorepo ya separa intencionalmente UI y servicios; esta propuesta respeta esa separación y la hace ejecutable.

### Problemas concretos que resuelve

1. Contrato API implícito sin implementación oficial.
2. Riesgo de crecimiento desordenado cuando se agreguen más rutas y dominios.
3. Dificultad de pruebas si todo se implementa directamente en routers.

### Responsabilidades que separa

1. Routers: protocolo HTTP y serialización.
2. Servicios de aplicación: reglas de casos de uso.
3. Repositorios: persistencia.
4. Schemas: contrato de entrada/salida.
5. Modelos ORM: representación de base de datos.

### Por qué otras alternativas son menos apropiadas ahora

1. MVC clásico puro: tiende a concentrar lógica en controllers/services sin límites de dominio explícitos; menos alineado con crecimiento por módulos de negocio.
2. Microservicios desde inicio: complejidad operativa alta (deploy, observabilidad, consistencia, coordinación) sin evidencia de volumen o equipos que lo justifiquen hoy.
3. Arquitectura hexagonal estricta en su versión más completa: válida, pero excesiva para el estado actual; se toma una versión pragmática en capas con puertos/adaptadores donde aporte valor real.

### Ventajas para el equipo

1. Onboarding más rápido: estructura predecible de FastAPI por dominios.
2. Menos regresiones: contratos y casos de uso aislados.
3. Evolución incremental: nuevos dominios sin tocar módulos existentes.

### Impacto en mantenimiento y escalabilidad

1. Mantenimiento: menor costo de cambio al localizar responsabilidades.
2. Escalabilidad funcional: permite añadir dominios sin convertir el backend en archivo monolítico.
3. Escalabilidad técnica: habilita extraer módulos a servicios independientes en el futuro solo si aparecen señales reales (carga, equipos separados, requisitos de aislamiento).

## 5. Estructura propuesta del backend

Árbol propuesto (coherente con el monorepo actual):

```text
services/
└── talent-pipeline-api/
	 ├── README.md
	 ├── pyproject.toml
	 ├── .env.example
	 ├── app/
	 │   ├── main.py
	 │   ├── core/
	 │   │   ├── config.py
	 │   │   ├── logging.py
	 │   │   └── security.py
	 │   ├── api/
	 │   │   ├── deps.py
	 │   │   └── v1/
	 │   │       ├── router.py
	 │   │       ├── health.py
	 │   │       ├── records.py
	 │   │       └── notes.py
	 │   ├── schemas/
	 │   │   ├── common.py
	 │   │   ├── record.py
	 │   │   └── note.py
	 │   ├── domain/
	 │   │   ├── records/
	 │   │   │   ├── entities.py
	 │   │   │   ├── value_objects.py
	 │   │   │   └── rules.py
	 │   │   └── notes/
	 │   │       ├── entities.py
	 │   │       └── rules.py
	 │   ├── application/
	 │   │   ├── records/
	 │   │   │   ├── commands.py
	 │   │   │   ├── queries.py
	 │   │   │   └── services.py
	 │   │   └── notes/
	 │   │       ├── commands.py
	 │   │       ├── queries.py
	 │   │       └── services.py
	 │   ├── infrastructure/
	 │   │   ├── db/
	 │   │   │   ├── base.py
	 │   │   │   ├── session.py
	 │   │   │   └── models/
	 │   │   │       ├── record.py
	 │   │   │       └── note.py
	 │   │   └── repositories/
	 │   │       ├── record_repository.py
	 │   │       └── note_repository.py
	 │   └── tests/
	 │       ├── unit/
	 │       └── integration/
	 └── migrations/
```

Alcance de implementación incremental (para evitar sobrearquitectura):

1. Fase 1 (mínimo viable): `main.py`, `api/v1` con `records` y `notes`, `schemas` de entrada/salida, persistencia básica y pruebas de integración de endpoints críticos.
2. Fase 2 (cuando aumente complejidad de negocio): profundizar separación en `domain` y `application` (por ejemplo `commands`/`queries`) para reglas más complejas o nuevos dominios.

## 6. Responsabilidades de módulos y carpetas

### app/main.py

- Responsabilidad: punto de entrada FastAPI, registro de routers y middleware.
- Debe contener: creación de la instancia de app, inclusión de router principal.
- No debe contener: lógica de negocio ni consultas a base de datos.

### app/core/

- Responsabilidad: configuración transversal (settings, logging, seguridad básica).
- Debe contener: lectura tipada de variables de entorno y configuración central.
- No debe contener: endpoints ni reglas de dominio.

### app/api/

- Responsabilidad: interfaz HTTP.
- Debe contener: routers, dependencias de autenticación/autorización, versionado.
- No debe contener: lógica de negocio compleja ni acceso ORM directo.

### app/schemas/

- Responsabilidad: contratos de entrada/salida de API.
- Debe contener: modelos de request/response alineados con el frontend.
- No debe contener: comportamiento de persistencia ni reglas de repositorio.

### app/domain/

- Responsabilidad: reglas de negocio puras del dominio.
- Debe contener: entidades y validaciones de negocio no dependientes de framework.
- No debe contener: dependencias de FastAPI, SQL o infraestructura externa.

### app/application/

- Responsabilidad: casos de uso (crear record, actualizar etapa, listar notas).
- Debe contener: orquestación entre dominio y repositorios.
- No debe contener: detalles HTTP ni SQL embebido.

### app/infrastructure/

- Responsabilidad: detalles técnicos de persistencia e integraciones.
- Debe contener: sesión DB, modelos ORM, implementación de repositorios.
- No debe contener: decisiones de flujo de negocio.

### app/tests/

- Responsabilidad: pruebas unitarias por dominio y pruebas de integración API.
- Debe contener: pruebas aisladas por capa.
- No debe contener: datos hardcodeados no trazables al contrato real.

## 7. Organización de FastAPI

Convenciones de FastAPI aplicadas explícitamente en la propuesta:

1. Separación de routers por responsabilidad:
	- records.py para recursos de candidaturas.
	- notes.py para subrecurso de notas.
	- health.py para salud operativa.
2. Router agregador versionado en api/v1/router.py para consolidar prefijos y tags.
3. Configuración centralizada en core/config.py con variables de entorno tipadas.
4. Dependencias compartidas en api/deps.py (por ejemplo sesión de base de datos y contexto de request).
5. Diferenciación entre schemas API y modelos de persistencia ORM.
6. Punto de entrada único en main.py para middleware CORS, logging y registro de rutas.

Cómo influyen estas convenciones en esta propuesta:

- Evitan que el backend replique el acoplamiento de interfaces a implementación.
- Facilitan mantener contrato estable con el frontend existente.
- Permiten evolución de versión de API sin romper consumidores tempranos.

Fuentes técnicas utilizadas para estas convenciones:

1. FastAPI Official Docs - Bigger Applications (Multiple Files): organización modular con `APIRouter`, separación de routers y composición por módulos. https://fastapi.tiangolo.com/tutorial/bigger-applications/
2. FastAPI Official Docs - Dependencies: definición y reutilización de dependencias compartidas. https://fastapi.tiangolo.com/tutorial/dependencies/
3. FastAPI Official Docs - CORS Middleware: registro de middleware en el punto de entrada y configuración conceptual de CORS. https://fastapi.tiangolo.com/tutorial/cors/
4. FastAPI Official Docs - Request Body y Response Model + Pydantic Docs: separación de modelos de entrada/salida respecto a detalles de persistencia. https://fastapi.tiangolo.com/tutorial/body/ https://fastapi.tiangolo.com/tutorial/response-model/ https://docs.pydantic.dev/

Nota de trazabilidad: estas fuentes se usan como referencia de convención de framework, no como evidencia del estado actual del repositorio.

## 8. Dominios y endpoints

### Dominio: records (candidaturas)

- Responsabilidad: ciclo de vida de candidaturas del pipeline (alta, consulta, actualización parcial y total).
- Router propuesto: /api/v1/records
- Recursos principales:
1. Candidate record
2. Estado de candidatura
3. Etapa de proceso

Endpoints conceptuales:

```text
GET    /api/v1/records
GET    /api/v1/records/{record_id}
POST   /api/v1/records
PUT    /api/v1/records/{record_id}
PATCH  /api/v1/records/{record_id}
```

### Dominio: notes (notas internas de candidatura)

- Responsabilidad: registrar y consultar notas asociadas a una candidatura.
- Router propuesto: /api/v1/records/{record_id}/notes
- Recursos principales:
1. Note

Endpoints conceptuales:

```text
GET    /api/v1/records/{record_id}/notes
POST   /api/v1/records/{record_id}/notes
DELETE /api/v1/records/{record_id}/notes/{note_id}
```

### Dominio transversal: health

- Responsabilidad: estado básico del servicio.
- Router propuesto: /api/v1/health

Endpoint conceptual:

```text
GET /api/v1/health
```

### Nota de compatibilidad con frontend actual

- El frontend existente consume rutas sin prefijo /api/v1 (ejemplo: /records).
- Decisión recomendada de transición:
1. Mantener temporalmente compatibilidad con rutas actuales.
2. Introducir versionado /api/v1 como ruta objetivo.
3. Migrar frontend de forma controlada.

## 9. Separación Frontend / Backend

### Comunicación entre sistemas

- Frontend y backend deben comunicarse exclusivamente por API HTTP con contrato explícito.
- El frontend Next.js ya está preparado para ello mediante NEXT_PUBLIC_API_URL.

### Responsabilidades por sistema

Frontend:

1. Renderizado de vistas y experiencia de usuario.
2. Validaciones de formulario orientadas a UX.
3. Manejo de estado de interfaz y filtros.

Backend:

1. Reglas de negocio de candidaturas/notas.
2. Persistencia y consistencia de datos.
3. Validación de integridad de datos.
4. Exposición de API y control de errores.

### Variables de entorno

Frontend (observado):

- NEXT_PUBLIC_API_URL: URL base de la API.

Backend (propuesto):

- APP_ENV
- APP_HOST
- APP_PORT
- DATABASE_URL
- CORS_ALLOW_ORIGINS
- LOG_LEVEL

Nota: estos nombres son una propuesta técnica; deben cerrarse en la definición operativa del servicio.

### CORS

- CORS resuelve una restricción del navegador: cuando frontend y backend operan en orígenes distintos, el navegador bloquea solicitudes cruzadas si el backend no autoriza explícitamente esos orígenes.
- No hay configuración CORS actual en backend porque no existe implementación.
- Recomendación:
1. Definir lista explícita de orígenes permitidos por entorno (dev/stage/prod).
2. Evitar comodín * en producción.
3. Versionar y documentar la política CORS junto con la API.

### Acoplamiento a evitar

- Evitar compartir modelos internos de DB con el frontend.
- Mantener contrato por schemas API, no por estructura de tablas.
- Evitar lógica de negocio en componentes de frontend.

### Monorepo vs repos separados

- Evidencia actual: monorepo único con separación por carpetas de responsabilidad.
- Implicación: se puede compartir documentación, tipos y CI, manteniendo independencia de despliegue entre UI y backend.

## 10. Decisiones técnicas

1. Elegir monolito modular en capas sobre microservicios.
	- Justificación: dominio actual acotado y ausencia de backend previo.
2. Diseñar routers por dominio (records/notes) y no un router único global.
	- Justificación: reduce archivos monolíticos y simplifica pruebas.
3. Separar schemas API de modelos ORM.
	- Justificación: evita acoplar contrato público a persistencia.
4. Introducir versionado de API.
	- Justificación: evolución del contrato sin romper frontend.
5. Centralizar configuración y dependencias.
	- Justificación: consistencia operativa y menor duplicación.

## 11. Riesgos y puntos de atención

### Riesgo 1: Mezclar lógica de negocio con routers

1. Qué podría ocurrir: endpoints largos y difíciles de modificar.
2. Por qué ocurriría: implementar casos de uso directamente en funciones HTTP.
3. Impacto: baja testabilidad, regresiones frecuentes y alto costo de mantenimiento.
4. Prevención en la propuesta: capa application y domain separadas de api.

### Riesgo 2: Acoplar frontend a estructura interna de persistencia

1. Qué podría ocurrir: cualquier cambio en tablas rompería el frontend.
2. Por qué ocurriría: exponer modelos ORM como respuesta pública.
3. Impacto: releases coordinados forzosos y menor velocidad de entrega.
4. Prevención en la propuesta: uso de schemas dedicados de request/response.

### Riesgo 3: Crecimiento desordenado en un único módulo de API

1. Qué podría ocurrir: archivo API gigante con múltiples responsabilidades.
2. Por qué ocurriría: no separar routers por dominio.
3. Impacto: fricción de desarrollo, conflictos de merge y errores de integración.
4. Prevención en la propuesta: segmentación records, notes y health por módulos.

### Riesgo 4: Configuración insegura de CORS y entornos

1. Qué podría ocurrir: exposición de API a orígenes no autorizados o fallos entre entornos.
2. Por qué ocurriría: configuración ad hoc por endpoint o uso indiscriminado de comodines.
3. Impacto: riesgo de seguridad y errores intermitentes de integración.
4. Prevención en la propuesta: configuración centralizada en core/config y política por entorno.

## 12. Conclusión

La arquitectura propuesta (monolito modular en capas orientado a dominio con FastAPI) es adecuada para el estado real del proyecto porque:

1. Parte de un backend hoy inexistente pero con contrato frontend ya definido.
2. Se ajusta al tamaño actual del dominio implementado (candidaturas y notas) sin sobrearquitectura.
3. Crea límites claros entre API, negocio y persistencia para permitir crecimiento controlado.
4. Mantiene separación correcta entre frontend y backend dentro del monorepo.

Esta base habilita una implementación incremental y profesional del backend, priorizando mantenibilidad, coherencia técnica y compatibilidad con los consumidores actuales.
