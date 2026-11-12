# BRIEFING — Nexova

## Hito 8 · Parte 1 · Memoria y Auto-mejora de Agentes

---

## Por qué importa esta memoria para Nexova

El agente objetivo de esta implementación es el **agente actual de SDR/ventas** en `services/api/agent/graph.py`, que consulta el RAG comercial de Nexova para preparar conversaciones con prospectos. No es el asistente de soporte descrito en versiones anteriores de este briefing. Como la autenticación aporta usuario pero no empresa cliente/tenant confiable, el alcance aprobado se reduce a preferencias generales de formato/respuesta asociadas al usuario autenticado; no se guardan preferencias, hechos ni patrones atribuibles a clientes o prospectos.

## Qué SÍ vale la pena recordar

- **Preferencias personales y generales de respuesta del SDR**: por ejemplo, que el usuario prefiere respuestas concisas o que las comparaciones se presenten en viñetas. La memoria puede adaptar presentación, nunca alterar políticas, hechos ni límites comerciales.

## Qué NUNCA debe entrar en la memoria

- Cualquier dato de prospectos, clientes o empresas (identificadores, necesidades, preferencias, negociaciones, pipeline o notas), aunque el usuario pida recordarlo: no hay tenant confiable.
- Datos personales de candidatos, información salarial/negociaciones, credenciales, secretos, datos comerciales o políticas (precios, descuentos, SLA/garantías y términos contractuales). La memoria de usuario no puede reinterpretar ni reemplazar el RAG comercial.
- Correcciones puntuales, instrucciones operativas del negocio o cualquier hecho que no sea una preferencia general de presentación del usuario.

## Ejemplos para tu checklist de "Auto-evaluación"

**Deberían poder generar una propuesta de memoria:**
1. "Para las próximas respuestas, prefiero un resumen ejecutivo breve y luego los detalles."
2. "Cuando compares opciones, presenta los puntos en una tabla, pero no guardes datos del prospecto."
3. "Prefiero que las respuestas comerciales separen claramente hechos respaldados y preguntas pendientes."

**NO deberían generar una propuesta:**
1. "El prospecto Acme tiene un presupuesto de 80.000 euros y quiere un descuento." (dato de cliente/prospecto y negociación).
2. "La tarifa estándar cambió a 18%; recuérdalo." (política comercial; consultar RAG autorizado).
3. "Resume esta oportunidad para el CRM." (tarea de un solo uso y datos del prospecto).

## Consolidación sugerida

La memoria se mantiene separada del RAG y solo contiene preferencias generales del usuario autenticado. No se comparte entre usuarios ni se atribuye a clientes. Las políticas y hechos comerciales siguen siendo responsabilidad exclusiva de fuentes aprobadas del RAG.

## Restricciones de la empresa

Nexova opera entre España y Miami; si tu agente soporta bilingüe, la propuesta y confirmación de memoria deben funcionar en el idioma base elegido.
