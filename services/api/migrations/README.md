# Agent checkpoint migrations

Las migraciones de este directorio son manuales. No se ejecutan desde el
startup de la API. El despliegue debe revisar y aplicar el SQL explícitamente
con el proceso de migraciones del entorno correspondiente.

`001_langgraph_checkpoint_postgres.sql` reproduce las migraciones de esquema
incluidas en `langgraph-checkpoint-postgres==3.2.0` (versiones 0–9). No se debe
invocar `PostgresSaver.setup()` en producción: ese método ejecuta DDL sobre la
conexión actual.

`004_agent_memory.sql` crea las tablas relacionales aisladas para propuestas,
preferencias generales de respuesta aprobadas por el usuario SDR y auditoría de
memoria episódica. El código admite únicamente la categoría
`response_preference`, sin preferencias/datos de clientes o prospectos. Debe
revisarse y aplicarse manualmente antes de habilitar escrituras en un despliegue
PostgreSQL. El arranque de la API con `SQLModel.metadata.create_all` solo cubre tablas nuevas;
no altera tablas existentes ni sustituye esta migración en producción.

Estado de esta entrega: el usuario aplicó `004_agent_memory.sql`. Se comprobó
desde el workspace la conexión a la base y la presencia de las tres tablas,
columnas, restricciones CHECK e índices esperados; las columnas coinciden con
`agent/memory_models.py`. La prueba sintética de persistencia ejercitó propuesta,
aprobación, recuperación y limpieza. Detectó inicialmente un orden de inserción
incompatible con la FK de auditoría en PostgreSQL; el repositorio se corrigió
haciendo flush de la propuesta antes de insertar su auditoría, y la repetición
pasó con limpieza verificada. Revisar la suite y el diff antes de habilitar en
despliegue; esta prueba no valida todavía la compatibilidad del modelo OpenAI
desplegado. La creación concurrente queda serializada por el índice único
parcial de propuestas pendientes y la resolución bloquea la fila en motores que
soportan `SELECT FOR UPDATE`. La auditoría conserva únicamente metadatos y se
purga después de 365 días cuando un proceso invoca `consolidate_memory`; todavía
debe programarse esa operación fuera del ciclo de vida de cada request.