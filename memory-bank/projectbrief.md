# Project Brief — Nexova

> Banco de memoria del proyecto. No sustituye los contextos empresariales originales ni los README. Mantener separados los hechos confirmados, las decisiones explícitas y los objetivos aún futuros.

## Estado de certeza

- **Hecho confirmado:** aparece expresamente en una fuente del repositorio o en el código/configuración comprobado.
- **Objetivo/requisito documentado:** figura en un brief, ticket o contexto; no implica que esté implementado.
- **Pendiente de aclaración:** hay fuentes incompatibles o no existe información suficiente.

## Identidad de la empresa

**Hechos confirmados por `CONTEXT.md` y `CONTEXT-company.md`:** Nexova es una consultora de recursos humanos y adquisición de talento, con sede en Valencia y oficina en Miami, 120 empleados y tres líneas de negocio: headhunting, externalización de atención al cliente y formación corporativa. El contexto general detalla áreas como selección, RR. HH., ventas, soporte, marketing, formación, tecnología e infraestructura y dirección ejecutiva.

`company-choice.md` confirma la elección de Nexova Solutions y documenta interés en Atención al Cliente y Tecnología e Infraestructura. Describe los problemas de herramientas desconectadas, tareas manuales, falta de base de conocimiento central y telemetría, pero su propuesta de agente de soporte/monitorización es una iniciativa de interés, no prueba de que sea el alcance actual del código.

## Contexto operativo del hito actual

En la inspección inicial, `CONTEXT-company.md` estaba disponible y se leyó; está titulado **Hito 5: Gestión de Inventario Backend**. Describe que IT y Operaciones no pueden ver con fiabilidad existencias, asignaciones ni consumos de activos; menciona portátiles desaparecidos o duplicados y materiales que se agotan sin aviso. Atribuye la solicitud a Sergio Molina, CTO, mediante ticket NXV-0201. El usuario confirmó el 12-10-2026 que esta eliminación, junto con las demás eliminaciones locales, es permanente. No se restauró.

El archivo `CONTEXT-nexova.es.md`, que documentaba en otra iteración el directorio de proveedores (hito 09), figura como eliminación local intencional en el estado de Git de esta sesión. No se restauró. La referencia a él en código/README y sus datos no reemplazan al contexto actualmente disponible.

## Alcance y objetivos

### Requisitos confirmados del hito 5

El brief requiere una API de inventario bajo `/inventory`, con activos y movimientos de entrada/salida:

- `Asset`: `id`, `name`, `sku`, `category`, `office`. `current_stock` se calcula y solo se expone en respuestas.
- `AssetEntry`: activo, cantidad recibida, proveedor, oficina receptora, timestamp automático y `user_uuid` del responsable.
- `AssetExit`: activo, cantidad, tipo (`allocation` o `consumption`), destinatario según tipo, oficina, timestamp y `user_uuid`.
- Rutas previstas: listado/creación/lectura de activos; creación de entradas y salidas; listado de movimientos con el activo asociado.
- El stock es siempre suma de entradas menos suma de salidas, no editable directamente. Debe rechazarse una salida que exceda el disponible sin persistirla.
- `assigned_to` debe existir para una asignación y ser nulo para consumo.
- `user_uuid` corresponde a una identidad de TinyDB; el brief prohíbe crear una tabla de usuarios en Supabase/SQLModel para ese propósito.
- Las ubicaciones de los modelos y schemas son `Valencia` y `Miami` según el brief, aunque se menciona que Nexova tiene seis oficinas. Las otras oficinas no están especificadas.
- Se piden al menos seis activos, cuatro entradas y tres salidas de desarrollo; el detalle concreto está en `CONTEXT-company.md` y el seeder del inventario.

### Implementación existente comprobada

El backend contiene modelos y schemas de inventario, router `/inventory`, cálculos de stock, comprobación de stock insuficiente, validaciones, datos de prueba y `services/api/seed_inventory.py`. El router se incluye en `services/api/main.py`. La evidencia está en `services/api/models.py`, `schemas.py`, `routers/inventory.py`, `main.py`, `seed_inventory.py` y `tests/test_inventory_*.py`.

Esto acredita código y pruebas escritas, pero no que la suite completa pase: la ejecución observada de pytest no pudo cargar `conftest.py` por un error de sintaxis (ver `progress.md`).

## Usuarios y áreas documentados

- **Sergio Molina — CTO:** solicitante del hito de inventario; Tecnología e Infraestructura.
- **IT y Operaciones:** registran activos y movimientos; son los usuarios operativos inferibles directamente del ticket, no se han verificado roles de autorización organizativos adicionales.
- **Empleados de Nexova:** pueden figurar como destinatarios de asignaciones (`assigned_to`), sin más permisos o procesos definidos en el brief.
- **Patricia Solís — HR Manager:** pertenece al contexto previo del directorio de proveedores (hito 09); no asumir que es responsable del inventario.

## Restricciones de negocio confirmadas

1. No guardar `current_stock` como dato editable; calcularlo desde movimientos.
2. Rechazar salidas con stock insuficiente antes de escribir y responder HTTP 400 con el mensaje especificado en `CONTEXT-company.md`.
3. Validar la relación entre `exit_type` y `assigned_to`.
4. Conservar la identidad del usuario de TinyDB en cada orden; no inventar una tabla de usuarios SQL.
5. Registrar entradas y salidas de ambas oficinas en las mismas tablas, con el campo `office`.
6. Respetar los nombres `Asset`, `AssetEntry`, `AssetExit` del brief para modelos y respuestas, pese a terminología histórica de README o comentarios.

## Requisitos no funcionales / técnicos pertinentes

- La persistencia prevista para inventario usa SQLModel y PostgreSQL cuando hay `DATABASE_URL`; el arranque crea tablas al configurar motor. TinyDB persiste otras entidades en JSON local.
- El seeder de inventario es idempotente, usa un `user_uuid` existente y no crea/modifica usuarios (docstring en `services/api/seed_inventory.py`).
- Hay pruebas de integración FastAPI con base SQLite efímera para inventario (`services/api/tests/test_inventory_api.py`). El resultado real actual de ejecución está bloqueado por error de sintaxis en el `conftest.py` compartido.

## Funcionalidades futuras o fuera del alcance confirmado

**Objetivos empresariales generales, no requisitos de este ticket:** agentes de IA, RAG, dashboards, automatización de soporte, telemetría centralizada, gestión de candidatos, herramientas de RR. HH. y análisis de sentimiento. Están en `company-choice.md`/`CONTEXT.md`, pero el brief del hito actual no los incluye.

No se encontró en el brief una decisión sobre interfaz de inventario, autenticación concreta de cada endpoint, auditoría adicional, migraciones, despliegue de producción, multi-tenancy, ni soporte para oficinas distintas de Valencia/Miami. No asumirlos como requisitos ya acordados.

## Contradicciones y aclaraciones necesarias

1. `CONTEXT-company.md` (leído antes de su desaparición local) especifica inventario (hito 5); `company-choice.md` propone soporte/monitorización; el contexto antiguo de proveedores era hito 09. Tratar inventario como el ticket técnico evidenciado por ese brief, sin convertir los otros objetivos en alcance de este hito. El usuario confirmó que la eliminación local de `CONTEXT-company.md` es intencional y permanente.
2. `CONTEXT.md` indica seis oficinas, mientras las entidades del hito limitan `office` a Valencia o Miami. Confirmar si el modelo debe ampliarse antes de añadir más ubicaciones.
3. `CONTEXT-company.md` documenta órdenes con identidad TinyDB y, a la vez, inventario relacional; no se debe inferir una tabla SQL para usuarios.
4. `CONTEXT-nexova.es.md` está eliminado intencionalmente en esta copia de trabajo. No restaurar ni tratar su contenido histórico como una fuente presente sin autorización.

## Mantenimiento de este documento

Al cambiar requisitos empresariales o alcance, actualizar este brief en el mismo cambio que los artefactos afectados, citando el archivo/ticket que respalda el cambio. Marcar expresamente **Hecho confirmado**, **Decisión**, **Hipótesis** o **Tarea futura**. Si fuentes difieren, conservar la discrepancia y pedir aclaración; no reescribir los documentos fuente ni convertir una hipótesis en requisito.