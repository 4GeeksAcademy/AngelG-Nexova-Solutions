# Agent checkpoint migrations

Las migraciones de este directorio son manuales. No se ejecutan desde el
startup de la API. El despliegue debe revisar y aplicar el SQL explícitamente
con el proceso de migraciones del entorno correspondiente.

`001_langgraph_checkpoint_postgres.sql` reproduce las migraciones de esquema
incluidas en `langgraph-checkpoint-postgres==3.2.0` (versiones 0–9). No se debe
invocar `PostgresSaver.setup()` en producción: ese método ejecuta DDL sobre la
conexión actual.