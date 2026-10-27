# Project Brief — Nexova Solutions

> Contexto empresarial activo para el proyecto. `CONTEXT.md` es el briefing disponible en esta copia; `company-choice.md` complementa el contexto de negocio con la iniciativa escogida. Este documento resume ambos sin sustituirlos.

## Estado de certeza

- **Hecho de negocio documentado:** explícito en `CONTEXT.md` o `company-choice.md`; no implica funcionalidad de software.
- **Iniciativa elegida:** prioridad expresada en `company-choice.md`; requiere definición técnica antes de implementarse.
- **Implementado:** existe evidencia en código/configuración; no implica que esté probado o desplegado.
- **Pendiente:** requiere aclaración, diseño o validación.

## Identidad y contexto de empresa

`CONTEXT.md` describe Nexova Solutions como una consultora de RR. HH. y selección de talento fundada en 2011, con sede en Valencia, expansión en Miami y 120 empleados. Sus líneas de negocio son headhunting, outsourcing de atención al cliente y formación corporativa. También describe las áreas empresariales, sus responsables, procesos y problemas operativos.

La situación transversal es una operación apoyada en procesos manuales, hojas de cálculo y herramientas desconectadas. En particular, el área de Atención al Cliente no cuenta con una base de conocimiento central ni visibilidad operativa adecuada; `CONTEXT.md` indica un tiempo medio de resolución de 48 horas frente a un SLA comprometido de 24 horas. Tecnología e Infraestructura carece de telemetría/logging centralizados y de monitoreo con alertas.

## Iniciativa elegida

`company-choice.md` prioriza una plataforma centralizada de soporte y monitoreo interno que combina dos áreas:

- **Atención al Cliente:** Roberto Díaz lidera un equipo de 30 agentes que atiende incidencias de clientes de outsourcing.
- **Tecnología e Infraestructura:** Sergio Molina es el CTO y lidera un equipo de seis personas.

El objetivo propuesto es reducir tiempos de resolución y mejorar el cumplimiento de SLA, además de aportar visibilidad inmediata sobre incidentes, carga de trabajo y estado de servicios.

Las capacidades propuestas incluyen base de conocimiento centralizada, RAG, chatbot/agente de soporte de primera línea, asistencia a agentes, clasificación y análisis de sentimiento de tickets, telemetría, logging, dashboards, monitoreo y alertas. Son objetivos/propuestas, no evidencia de que dichas funciones estén implementadas.

## Datos, seguridad y límites

`company-choice.md` menciona como posibles fuentes tickets históricos, documentación técnica, preguntas frecuentes, conversaciones, logs, métricas, estado de servicios e información de herramientas como HubSpot, Zendesk y Google Workspace. Su mención no confirma acceso, integración ni autorización para procesar esos datos.

Antes de diseñar o implementar integraciones, concretar fuentes autorizadas, permisos, tratamiento/retención de datos, controles de acceso y criterios de éxito. Antes de automatizar respuestas a clientes o acciones en sistemas, definir límites, supervisión humana y comportamiento ante incertidumbre. No almacenar secretos, credenciales, conversaciones reales ni datos personales en este banco de memoria, documentación o tests.

## Arquitectura de producto en este monorepo

Seguir la estructura de la plantilla y los README locales; no inventar un árbol paralelo:

- `uis/website/`: sitio público de Nexova.
- `uis/backoffice/`: aplicación e interfaces internas.
- `services/`: APIs y servicios backend; consultar `services/README.md` y el README del servicio específico antes de añadir código.
- Reutilizar los módulos y contratos existentes; verificar entrypoints y consumidores antes de afirmar que un servicio o integración está activo.

La estructura anterior describe dónde debe vivir el futuro código correspondiente; no autoriza por sí sola a crear aplicaciones ni a modificar las existentes.

## Implementación existente y alcance

El repositorio contiene, entre otros dominios, API FastAPI, backoffice Next.js, sitio web y código de inventario. Su existencia no prueba despliegue, integración o suite verde. El inventario es un dominio presente que proviene de trabajo previo; no es la iniciativa priorizada por `company-choice.md`. Para estado y verificaciones observadas, consultar `memory-bank/progress.md`; para arquitectura y limitaciones técnicas, consultar `memory-bank/techContext.md`.

No se debe inferir que el primer alcance de la iniciativa incluye todas las áreas de Nexova, ni decidir por cuenta propia arquitectura de RAG, proveedor de modelos, integraciones, roles/permisos, despliegue o métricas de producto. Esos puntos siguen pendientes hasta su definición y autorización.

## Fuentes y mantenimiento

- `CONTEXT.md`: briefing de empresa disponible en esta copia. El usuario aclaró que cumple el papel referido como `BRIEFING.md` en `Tarea.md`; no crear un `BRIEFING.md` duplicado.
- `company-choice.md`: empresa e iniciativa elegidas para el proyecto.
- `memory-bank/techContext.md`: arquitectura/stack comprobados y limitaciones.
- `memory-bank/progress.md`: estado de implementación y verificaciones.

Actualizar este documento junto con los artefactos afectados cuando cambien decisiones o contexto duradero. Citar las fuentes vigentes y mantener separados los hechos, las decisiones, las hipótesis y las tareas futuras. Si las fuentes empresariales difieren o no bastan para decidir, documentar la duda y preguntar; no convertir una propuesta en requisito ni reescribir los documentos fuente.
