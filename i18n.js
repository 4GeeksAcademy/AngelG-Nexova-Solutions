  // Traducciones adicionales para el formulario
  ['Formulario de aplicación a Nexova Solutions', 'Nexova Solutions application form'],
  ['Formulario de aplicación', 'Application form'],
  ['Formulario de Aplicación', 'Application form'],
  ['Propuesta técnica', 'Technical proposal'],
  ['Cuéntanos tu visión sobre cómo la IA puede transformar Nexova Solutions.', 'Tell us your vision of how AI can transform Nexova Solutions.'],
  ['Correo electrónico', 'Email address'],
  ['Introduce un correo electrónico válido.', 'Enter a valid email address.'],
  ['Teléfono', 'Phone'],
  ['Introduce un número de teléfono válido.', 'Enter a valid phone number.'],
  ['Introduce una fecha de nacimiento válida.', 'Enter a valid date of birth.'],
  ['Introduce una URL de LinkedIn válida (https://linkedin.com/in/...).', 'Enter a valid LinkedIn URL (https://linkedin.com/in/...).'],
  ['Si introduces una URL, debe ser válida.', 'If you provide a URL, it must be valid.'],
  ['¿Por qué elegiste Nexova Solutions?', 'Why did you choose Nexova Solutions?'],
  ['Cuéntanos qué te atrajo de Nexova y por qué quieres trabajar aquí...', 'Tell us what attracted you to Nexova and why you want to work here...'],
  ['Departamentos de interés', 'Departments of interest'],
  ['Atención al Cliente', 'Customer Support'],
  ['Chatbot RAG, base de conocimiento, análisis de sentimiento, dashboards SLA', 'RAG chatbot, knowledge base, sentiment analysis, SLA dashboards'],
  ['Tecnología e Infraestructura', 'Technology and Infrastructure'],
  ['Telemetría, logging centralizado, monitoreo en tiempo real, pipelines de datos', 'Telemetry, centralized logging, real-time monitoring, data pipelines'],
  ['Operaciones de Selección', 'Selection Operations'],
  ['Scoring de CVs, matching IA, portal de candidatos', 'CV scoring, AI matching, candidate portal'],
  ['Formación Corporativa', 'Corporate Training'],
  ['Motor de recomendación, portal del alumno, catálogo inteligente', 'Recommendation engine, student portal, smart catalog'],
  ['Ventas y Desarrollo de Negocio', 'Sales and Business Development'],
  ['CRM automation, pipeline dashboard, agente de propuesta', 'CRM automation, pipeline dashboard, proposal agent'],
  ['Marketing y Comunicación', 'Marketing and Communications'],
  ['SEO/GEO, pipeline de contenido IA, dashboard de métricas', 'SEO/GEO, AI content pipeline, metrics dashboard'],
  ['Reto de automatización elegido', 'Chosen automation challenge'],
  ['Describe el reto de automatización que quieres abordar en Nexova...', 'Describe the automation challenge you want to address at Nexova...'],
  ['Por favor describe el reto (mínimo 80 caracteres).', 'Please describe the challenge (minimum 80 characters).'],
  ['¿Qué haría el agente?', 'What should the agent do?'],
  ['Describe las capacidades y funciones del agente de IA que propondrías...', 'Describe the capabilities and functions of the AI agent you would propose...'],
  ['Por favor describe el agente (mínimo 60 caracteres).', 'Please describe the agent (minimum 60 characters).'],
  ['¿Qué información necesitaría?', 'What inputs would it need?'],
  ['Tickets históricos, documentación técnica, logs, base de conocimiento...', 'Historical tickets, technical documentation, logs, knowledge base...'],
  ['Por favor describe las entradas del agente (mínimo 30 caracteres).', 'Please describe the agent inputs (minimum 30 characters).'],
  ['¿Qué produciría o dispararía?', 'What outputs or actions would it trigger?'],
  ['Respuestas automáticas, alertas, clasificación de tickets, dashboards...', 'Automatic replies, alerts, ticket classification, dashboards...'],
  ['Por favor describe los resultados del agente (mínimo 30 caracteres).', 'Please describe the agent outcomes (minimum 30 characters).'],
  ['Intermedio — He construido proyectos pequeños con IA', 'Intermediate — I have built small AI projects'],
  ['Avanzado — Tengo experiencia en producción con IA', 'Advanced — I have production AI experience'],
  ['Acepto que mis datos sean utilizados para el proceso de selección de Nexova Solutions.', 'I agree that my data may be used for the Nexova Solutions selection process.'],
  ['Debes aceptar los términos para continuar.', 'You must accept the terms to continue.'],
  ['Enviar aplicación', 'Submit application'],
  ['¡Aplicación enviada!', 'Application sent!'],
(function () {
  const LANGUAGE_KEY = 'language';
  const DEFAULT_LANGUAGE = 'es';

  const PAGE_META = {
    index: {
      es: {
        title: 'Nexova Solutions - Talento que transforma empresas',
        description: 'Nexova Solutions - Consultoria de RRHH y seleccion de talento con inteligencia artificial. Headhunting, outsourcing y formacion corporativa desde 2011.'
      },
      en: {
        title: 'Nexova Solutions - Talent that transforms businesses',
        description: 'Nexova Solutions - HR consulting and talent acquisition powered by artificial intelligence. Headhunting, outsourcing, and corporate training since 2011.'
      }
    },
    application: {
      es: {
        title: 'Aplicacion - Nexova Solutions AI Engineering',
        description: 'Formulario de aplicación al equipo de AI Engineering de Nexova Solutions.'
      },
      en: {
        title: 'Application - Nexova Solutions AI Engineering',
        description: 'Application form for the Nexova Solutions AI Engineering team.'
      }
    }
  };

  const TRANSLATION_PAIRS = [
    ['Saltar al contenido principal', 'Skip to main content'],
    ['Inicio', 'Home'],
    ['Servicios', 'Services'],
    ['Como trabajamos', 'How we work'],
    ['Cómo trabajamos', 'How we work'],
    ['Sectores', 'Industries'],
    ['IA', 'AI'],
    ['Aplica', 'Apply'],
    ['Contacto', 'Contact'],
    ['Aplicar ahora', 'Apply now'],
    ['Seleccionar idioma', 'Select language'],
    ['Modo oscuro', 'Dark mode'],
    ['Modo claro', 'Light mode'],
    ['Español', 'Spanish'],
    ['English', 'English'],
    ['Cambiar tema', 'Change theme'],
    ['Cambiar a modo claro', 'Switch to light mode'],
    ['Cambiar a modo oscuro', 'Switch to dark mode'],
    // Nuevas traducciones para asegurar cobertura total del formulario
    ['Empresa e intereses', 'Company and interests'],
    ['Propuesta técnica', 'Technical proposal'],
    ['Datos personales', 'Personal details'],
    ['Nombre', 'First name'],
    ['Apellidos', 'Last name'],
    ['Correo electrónico', 'Email address'],
    ['Teléfono', 'Phone'],
    ['Fecha de nacimiento', 'Date of birth'],
    ['Limpiar formulario', 'Clear form'],
    ['Siguiente →', 'Next →'],
    ['← Anterior', '← Previous'],
    ['Limpiar', 'Clear'],
    ['Enviar aplicación', 'Submit application'],
    ['¡Aplicación enviada!', 'Application sent!'],
    ['Gracias por aplicar a Nexova Solutions. Hemos recibido tu propuesta y nos pondremos en contacto contigo pronto.', 'Thanks for applying to Nexova Solutions. We have received your proposal and will contact you soon.'],
    ['Volver al inicio', 'Back to homepage'],
    ['Volver', 'Back'],
    ['https://linkedin.com/in/tu-perfil', 'https://linkedin.com/in/your-profile'],
    ['https://github.com/tu-usuario', 'https://github.com/your-username'],
    ['Cuéntanos qué te atrajo de Nexova y por qué quieres trabajar aquí...', 'Tell us what attracted you to Nexova and why you want to work here...'],
    ['Describe el reto de automatización que quieres abordar en Nexova...', 'Describe the automation challenge you want to address at Nexova...'],
    ['Describe las capacidades y funciones del agente de IA que propondrías...', 'Describe the capabilities and functions of the AI agent you would propose...'],
    ['Tickets históricos, documentación técnica, logs, base de conocimiento...', 'Historical tickets, technical documentation, logs, knowledge base...'],
    ['Respuestas automáticas, alertas, clasificación de tickets, dashboards...', 'Automatic replies, alerts, ticket classification, dashboards...'],
    // Mensajes de error
    ['El nombre es obligatorio.', 'First name is required.'],
    ['Los apellidos son obligatorios.', 'Last name is required.'],
    ['Introduce un correo electrónico válido.', 'Enter a valid email address.'],
    ['Introduce un número de teléfono válido.', 'Enter a valid phone number.'],
    ['Introduce una fecha de nacimiento válida.', 'Enter a valid date of birth.'],
    ['Introduce una URL de LinkedIn válida (https://linkedin.com/in/...).', 'Enter a valid LinkedIn URL (https://linkedin.com/in/...).'],
    ['Si introduces una URL, debe ser válida.', 'If you provide a URL, it must be valid.'],
    ['Este campo es obligatorio.', 'This field is required.'],
    ['Por favor escribe al menos 50 caracteres.', 'Please write at least 50 characters.'],
    ['Selecciona al menos un departamento.', 'Select at least one department.'],
    ['Por favor describe el reto (mínimo 80 caracteres).', 'Please describe the challenge (minimum 80 characters).'],
    ['Por favor describe el agente (mínimo 60 caracteres).', 'Please describe the agent (minimum 60 characters).'],
    ['Por favor describe las entradas del agente (mínimo 30 caracteres).', 'Please describe the agent inputs (minimum 30 characters).'],
    ['Por favor describe los resultados del agente (mínimo 30 caracteres).', 'Please describe the agent outcomes (minimum 30 characters).'],
    ['Selecciona tu nivel de experiencia.', 'Select your experience level.'],
    ['Debes aceptar los términos para continuar.', 'You must accept the terms to continue.'],
    ['Desde 2011 · Valencia & Miami', 'Since 2011 · Valencia & Miami'],
    ['Creamos automatizaciones y soluciones de IA que convierten operaciones complejas en resultados medibles.', 'We create automation and AI solutions that turn complex operations into measurable results.'],
    ['Hablamos de producto, no solo de tecnologia', 'We talk about product, not just technology'],
    ['Hablamos de producto, no solo de tecnología', 'We talk about product, not just technology'],
    ['Explora servicios', 'Explore services'],
    ['Conoce nuestra forma de trabajo', 'See how we work'],
    ['Diseno de procesos IA', 'AI process design'],
    ['Diseño de procesos IA', 'AI process design'],
    ['Construimos flujos trazables con foco en adopcion, impacto real y mejora continua.', 'We build traceable workflows focused on adoption, real impact, and continuous improvement.'],
    ['Construimos flujos trazables con foco en adopción, impacto real y mejora continua.', 'We build traceable workflows focused on adoption, real impact, and continuous improvement.'],
    ['Casos reales en RRHH, soporte y ventas', 'Real use cases in HR, support, and sales'],
    ['Optimizamos operaciones criticas con equipos de negocio y tecnologia trabajando en sincronía.', 'We optimize critical operations with business and technology teams working in sync.'],
    ['Optimizamos operaciones críticas con equipos de negocio y tecnología trabajando en sincronía.', 'We optimize critical operations with business and technology teams working in sync.'],
    ['Nuestros servicios', 'Our services'],
    ['Arquitectura, desarrollo e integracion de soluciones IA para operaciones empresariales.', 'Architecture, development, and integration of AI solutions for business operations.'],
    ['Arquitectura, desarrollo e integración de soluciones IA para operaciones empresariales.', 'Architecture, development, and integration of AI solutions for business operations.'],
    ['Automatizacion Inteligente', 'Intelligent Automation'],
    ['Automatización Inteligente', 'Intelligent Automation'],
    ['Mapeamos procesos internos y construimos automatizaciones robustas conectadas con tu stack actual.', 'We map internal processes and build robust automations connected to your current stack.'],
    ['Integracion de IA en Canales de Atencion', 'AI Integration in Service Channels'],
    ['Integración de IA en Canales de Atención', 'AI Integration in Service Channels'],
    ['Implementamos asistentes y copilotos para soporte interno, customer service y ventas.', 'We implement assistants and copilots for internal support, customer service, and sales.'],
    ['Plataformas de Seleccion Inteligente', 'Intelligent Recruiting Platforms'],
    ['Plataformas de Selección Inteligente', 'Intelligent Recruiting Platforms'],
    ['Creamos sistemas de matching, scoring y priorizacion para acelerar decisiones de talento.', 'We create matching, scoring, and prioritization systems to accelerate talent decisions.'],
    ['Creamos sistemas de matching, scoring y priorización para acelerar decisiones de talento.', 'We create matching, scoring, and prioritization systems to accelerate talent decisions.'],
    ['Dashboards y Analitica IA', 'AI Dashboards and Analytics'],
    ['Dashboards y Analítica IA', 'AI Dashboards and Analytics'],
    ['Visualizamos KPIs operativos y predictivos para facilitar decisiones en tiempo real.', 'We visualize operational and predictive KPIs to support real-time decisions.'],
    ['Como trabajamos', 'How we work'],
    ['Un proceso claro para llevar ideas de IA a resultados en produccion', 'A clear process to take AI ideas into production results'],
    ['Un proceso claro para llevar ideas de IA a resultados en producción', 'A clear process to take AI ideas into production results'],
    ['Convertimos necesidades de negocio en sistemas de IA utilizables por equipos reales. Cada fase está diseñada para minimizar riesgo, acelerar adopción y asegurar valor medible.', 'We turn business needs into AI systems that real teams can use. Each phase is designed to minimize risk, accelerate adoption, and ensure measurable value.'],
    ['Diagnostico & Priorizacion', 'Assessment & Prioritization'],
    ['Diagnóstico & Priorización', 'Assessment & Prioritization'],
    ['Detectamos oportunidades de mayor impacto y definimos casos de uso viables.', 'We identify the highest-impact opportunities and define viable use cases.'],
    ['Diseno de Solucion', 'Solution Design'],
    ['Diseño de Solución', 'Solution Design'],
    ['Estructuramos datos, flujos y arquitectura para escalar sin perder trazabilidad.', 'We structure data, workflows, and architecture to scale without losing traceability.'],
    ['Desarrollo e Integracion', 'Development and Integration'],
    ['Desarrollo e Integración', 'Development and Integration'],
    ['Construimos, conectamos y validamos la solucion en tu entorno operativo.', 'We build, connect, and validate the solution in your operational environment.'],
    ['Construimos, conectamos y validamos la solución en tu entorno operativo.', 'We build, connect, and validate the solution in your operational environment.'],
    ['Adopcion & Mejora Continua', 'Adoption & Continuous Improvement'],
    ['Adopción & Mejora Continua', 'Adoption & Continuous Improvement'],
    ['Acompañamos al equipo y optimizamos el sistema con datos reales de uso.', 'We support your team and optimize the system using real usage data.'],
    ['Sectores donde aportamos valor', 'Industries where we create value'],
    ['Aplicamos IA con enfoque operativo en organizaciones que necesitan escalar con precision.', 'We apply AI with an operational focus in organizations that need to scale with precision.'],
    ['Aplicamos IA con enfoque operativo en organizaciones que necesitan escalar con precisión.', 'We apply AI with an operational focus in organizations that need to scale with precision.'],
    ['Educacion & Formacion', 'Education & Training'],
    ['Educación & Formación', 'Education & Training'],
    ['Automatizacion de soporte academico y recomendaciones personalizadas.', 'Automation for academic support and personalized recommendations.'],
    ['Automatización de soporte académico y recomendaciones personalizadas.', 'Automation for academic support and personalized recommendations.'],
    ['Recursos Humanos', 'Human Resources'],
    ['Seleccion de talento, ranking de candidatos y pipelines de reclutamiento.', 'Talent selection, candidate ranking, and recruiting pipelines.'],
    ['Selección de talento, ranking de candidatos y pipelines de reclutamiento.', 'Talent selection, candidate ranking, and recruiting pipelines.'],
    ['Atencion al Cliente', 'Customer Support'],
    ['Atención al Cliente', 'Customer Support'],
    ['Asistentes inteligentes omnicanal para reducir tiempos y elevar calidad.', 'Omnichannel intelligent assistants to reduce response time and increase quality.'],
    ['Ventas & Operaciones', 'Sales & Operations'],
    ['Forecasting, priorizacion comercial y automatizacion de reportes.', 'Forecasting, commercial prioritization, and report automation.'],
    ['Forecasting, priorización comercial y automatización de reportes.', 'Forecasting, commercial prioritization, and report automation.'],
    ['Construimos IA para resolver problemas de negocio concretos', 'We build AI to solve concrete business problems'],
    ['No vendemos promesas: diseniamos soluciones reales, medibles y mantenibles, alineadas a tus objetivos operativos.', 'We do not sell promises: we design real, measurable, and maintainable solutions aligned with your operational goals.'],
    ['No vendemos promesas: diseñamos soluciones reales, medibles y mantenibles, alineadas a tus objetivos operativos.', 'We do not sell promises: we design real, measurable, and maintainable solutions aligned with your operational goals.'],
    ['Modelo de entrega iterativo con hitos claros.', 'Iterative delivery model with clear milestones.'],
    ['Acompanamiento tecnico y funcional durante adopcion.', 'Technical and functional support throughout adoption.'],
    ['Acompañamiento técnico y funcional durante adopción.', 'Technical and functional support throughout adoption.'],
    ['Gobierno de datos y calidad de salida de modelos.', 'Data governance and model output quality.'],
    ['Transparencia en KPIs de impacto y evolutivos.', 'Transparency in impact and evolution KPIs.'],
    ['Quieres construir con nosotros?', 'Want to build with us?'],
    ['¿Quieres construir con nosotros?', 'Want to build with us?'],
    ['Comparte tu aplicacion y cuentanos como llevarias la IA al corazon operativo de Nexova Solutions.', 'Share your application and tell us how you would bring AI to the operational core of Nexova Solutions.'],
    ['Comparte tu aplicación y cuéntanos cómo llevarías la IA al corazón operativo de Nexova Solutions.', 'Share your application and tell us how you would bring AI to the operational core of Nexova Solutions.'],
    ['Iniciar aplicacion', 'Start application'],
    ['Iniciar aplicación', 'Start application'],
    ['Correo', 'Email'],
    ['Telefono', 'Phone'],
    ['Teléfono', 'Phone'],
    ['Todos los derechos reservados.', 'All rights reserved.'],
    ['Volver a Nexova Solutions', 'Back to Nexova Solutions'],
    ['Volver', 'Back'],
    ['AI Engineering · 4Geeks Academy', 'AI Engineering · 4Geeks Academy'],
    ['Formulario de Aplicacion', 'Application Form'],
    ['Formulario de Aplicación', 'Application Form'],
    ['Cuentanos tu vision sobre como la IA puede transformar Nexova Solutions.', 'Tell us your vision of how AI can transform Nexova Solutions.'],
    ['Cuéntanos tu visión sobre cómo la IA puede transformar Nexova Solutions.', 'Tell us your vision of how AI can transform Nexova Solutions.'],
    ['Paso 1 · Datos personales', 'Step 1 · Personal details'],
    ['Paso 2 · Seleccion operativa', 'Step 2 · Team fit'],
    ['Paso 2 · Selección operativa', 'Step 2 · Team fit'],
    ['Datos personales', 'Personal details'],
    ['Empresa e intereses', 'Company and interests'],
    ['Paso 3 · Propuesta tecnica', 'Step 3 · Technical proposal'],
    ['Paso 3 · Propuesta técnica', 'Step 3 · Technical proposal'],
    ['Informacion personal', 'Personal details'],
    ['Información personal', 'Personal details'],
    ['Nombre completo', 'Full name'],
    ['Nombre', 'First name'],
    ['Apellidos', 'Last name'],
    ['LinkedIn', 'LinkedIn'],
    ['Portfolio / GitHub', 'Portfolio / GitHub'],
    ['Correo electronico', 'Email address'],
    ['Correo electrónico', 'Email address'],
    ['Telefono de contacto', 'Contact phone'],
    ['Teléfono de contacto', 'Contact phone'],
    ['Pais de residencia', 'Country of residence'],
    ['País de residencia', 'Country of residence'],
    ['Perfil de LinkedIn', 'LinkedIn profile'],
    ['Portafolio o GitHub', 'Portfolio or GitHub'],
    ['Fecha de nacimiento', 'Date of birth'],
    ['Siguiente →', 'Next →'],
    ['← Anterior', '← Previous'],
    ['Limpiar', 'Clear'],
    ['Seleccion operativa', 'Operational selection'],
    ['Selección operativa', 'Operational selection'],
    ['Area de mayor interes', 'Primary area of interest'],
    ['Área de mayor interés', 'Primary area of interest'],
    ['Selecciona una opcion', 'Select an option'],
    ['Selecciona una opción', 'Select an option'],
    ['Automatizacion de Procesos', 'Process automation'],
    ['Automatización de Procesos', 'Process automation'],
    ['Asistentes Inteligentes', 'Intelligent assistants'],
    ['Seleccion y Talent Tech', 'Selection and Talent Tech'],
    ['Selección y Talent Tech', 'Selection and Talent Tech'],
    ['Analitica y BI', 'Analytics and BI'],
    ['Analítica y BI', 'Analytics and BI'],
    ['Aun no lo tengo claro', 'I am still exploring'],
    ['Aún no lo tengo claro', 'I am still exploring'],
    ['Departamento de interes en Nexova', 'Preferred department at Nexova'],
    ['Departamento de interés en Nexova', 'Preferred department at Nexova'],
    ['Empresa elegida', 'Selected company'],
    ['Este campo es obligatorio.', 'This field is required.'],
    ['Por favor escribe al menos 50 caracteres.', 'Please write at least 50 characters.'],
    ['(selecciona al menos uno)', '(select at least one)'],
    ['Operacion Academica', 'Academic Operations'],
    ['Operación Académica', 'Academic Operations'],
    ['Plataforma educativa, soporte al alumno y operaciones internas', 'Educational platform, student support, and internal operations'],
    ['Customer Support', 'Customer Support'],
    ['Chat de soporte, analisis de tickets, base de conocimiento', 'Support chat, ticket analysis, knowledge base'],
    ['análisis', 'analysis'],
    ['Operaciones de Seleccion', 'Selection Operations'],
    ['Operaciones de Selección', 'Selection Operations'],
    ['Scoring de CVs, matching IA, portal de candidatos', 'CV scoring, AI matching, candidate portal'],
    ['Formacion Corporativa', 'Corporate Training'],
    ['Formación Corporativa', 'Corporate Training'],
    ['Motor de recomendacion, portal del alumno, catalogo inteligente', 'Recommendation engine, student portal, smart catalog'],
    ['Motor de recomendación, portal del alumno, catálogo inteligente', 'Recommendation engine, student portal, smart catalog'],
    ['Ventas y Desarrollo de Negocio', 'Sales and Business Development'],
    ['CRM automation, pipeline dashboard, agente de propuesta', 'CRM automation, pipeline dashboard, proposal agent'],
    ['Marketing y Comunicacion', 'Marketing and Communications'],
    ['Marketing y Comunicación', 'Marketing and Communications'],
    ['SEO/GEO, pipeline de contenido IA, dashboard de metricas', 'SEO/GEO, AI content pipeline, metrics dashboard'],
    ['SEO/GEO, pipeline de contenido IA, dashboard de métricas', 'SEO/GEO, AI content pipeline, metrics dashboard'],
    ['Propuesta tecnica', 'Technical proposal'],
    ['Propuesta técnica', 'Technical proposal'],
    ['Reto de automatizacion elegido', 'Chosen automation challenge'],
    ['Reto de automatización elegido', 'Chosen automation challenge'],
    ['Mi agente de IA', 'My AI agent concept'],
    ['¿Que haria el agente?', 'What should the agent do?'],
    ['¿Qué haría el agente?', 'What should the agent do?'],
    ['¿Que informacion necesitaria?', 'What inputs would it need?'],
    ['¿Qué información necesitaría?', 'What inputs would it need?'],
    ['¿Que produciria o dispararia?', 'What outputs or actions would it trigger?'],
    ['¿Qué produciría o dispararía?', 'What outputs or actions would it trigger?'],
    ['Nivel de experiencia en IA', 'AI experience level'],
    ['Selecciona tu nivel', 'Choose your level'],
    ['Principiante — Estoy aprendiendo los fundamentos', 'Beginner — I am learning the fundamentals'],
    ['Intermedio — He construido proyectos pequenos con IA', 'Intermediate — I have built small AI projects'],
    ['Intermedio — He construido proyectos pequeños con IA', 'Intermediate — I have built small AI projects'],
    ['Avanzado — Tengo experiencia en produccion con IA', 'Advanced — I have production AI experience'],
    ['Avanzado — Tengo experiencia en producción con IA', 'Advanced — I have production AI experience'],
    ['Acepto que mis datos sean utilizados para el proceso de seleccion de Nexova Solutions.', 'I agree that my data may be used for the Nexova Solutions selection process.'],
    ['Acepto que mis datos sean utilizados para el proceso de selección de Nexova Solutions.', 'I agree that my data may be used for the Nexova Solutions selection process.'],
    ['Enviar aplicacion', 'Submit application'],
    ['Enviar aplicación', 'Submit application'],
    ['¡Aplicacion enviada!', 'Application sent!'],
    ['¡Aplicación enviada!', 'Application sent!'],
    ['Gracias por aplicar a Nexova Solutions. Hemos recibido tu propuesta y nos pondremos en contacto contigo pronto.', 'Thanks for applying to Nexova Solutions. We have received your proposal and will contact you soon.'],
    ['Volver al inicio', 'Back to homepage'],
    ['Nexova Solutions — Talento que transforma empresas', 'Nexova Solutions - Talent that transforms businesses'],
    ['Nexova', 'Nexova'],
    ['Cómo funciona', 'How it works'],
    ['Aplica ahora', 'Apply now'],
    ['El talento', 'The talent'],
    ['correcto,', 'right when'],
    ['correcto', 'right'],
    ['o retraso', 'or delay'],
    ['0 retraso', '0 delay'],
    ['Nuestra IA procesa candidatos y genera rankings explicables.', 'Our AI processes candidates and generates explainable rankings.'],
    ['Análisis IA', 'AI analysis'],
    ['Experiencia sectorial', 'Sector experience'],
    ['Ventaja competitiva', 'Competitive advantage'],
    ['en el momento', 'your business'],
    ['exacto.', 'needs it.'],
    ['Nexova Solutions lleva doce años ayudando a medianas empresas a encontrar, formar y retener el talento que necesitan para crecer — ahora potenciado con inteligencia artificial.', 'Nexova Solutions has spent twelve years helping mid-sized companies find, train, and retain the talent they need to grow - now powered by artificial intelligence.'],
    ['Trabaja con nosotros', 'Work with us'],
    ['Ver servicios', 'See services'],
    ['Años de experiencia', 'Years of experience'],
    ['países', 'countries'],
    ['🎯 CV Scoring con IA', '🎯 AI CV Scoring'],
    ['📊 Dashboard en tiempo real', '📊 Real-time dashboard'],
    ['Lo que hacemos', 'What we do'],
    ['Tres líneas de negocio,', 'Three business lines,'],
    ['un único objetivo.', 'one common goal.'],
    ['Headhunting & Selección', 'Headhunting & Selection'],
    ['Identificamos y reclutamos perfiles de mandos medios y directivos con scoring automatizado de CVs y matching inteligente candidato–vacante.', 'We identify and recruit mid-level and executive profiles with automated CV scoring and intelligent candidate-to-role matching.'],
    ['Pipeline de selección con IA', 'AI-powered selection pipeline'],
    ['Portal de candidatos en tiempo real', 'Real-time candidate portal'],
    ['Comunicación automatizada', 'Automated communication'],
    ['Outsourcing de Soporte', 'Support Outsourcing'],
    ['Equipos de atención al cliente dedicados para empresas tech, retail y finanzas. Con chatbot IA de primera línea y dashboards en tiempo real.', 'Dedicated customer support teams for tech, retail, and finance companies. With frontline AI chatbot and real-time dashboards.'],
    ['Chatbot RAG — 40% resolución automática', 'RAG chatbot - 40% automated resolution'],
    ['Análisis de sentimiento', 'Sentiment analysis'],
    ['Programas de liderazgo, comunicación y gestión de equipos con recomendación personalizada y seguimiento de progreso por alumno.', 'Leadership, communication, and team management programs with personalized recommendations and progress tracking per learner.'],
    ['Catálogo con inscripción online', 'Catalog with online enrollment'],
    ['Motor de recomendación IA', 'AI recommendation engine'],
    ['El proceso', 'The process'],
    ['Transformamos procesos manuales en flujos operativos con IA, datos y visibilidad en tiempo real. Cada fase tiene entregables concretos para generar impacto desde el primer sprint.', 'We transform manual processes into operational workflows with AI, data, and real-time visibility. Each phase has concrete deliverables to create impact from the first sprint.'],
    ['Entendemos tus necesidades específicas de talento o formación.', 'We understand your specific talent or training needs.'],
    ['Análisis IA', 'AI analysis'],
    ['Selección', 'Selection'],
    ['Los consultores validan y presentan los mejores perfiles.', 'Consultants validate and present the best profiles.'],
    ['Portal en tiempo real con visibilidad total del proceso.', 'Real-time portal with full process visibility.'],
    ['Diagnóstico de operación', 'Operational diagnosis'],
    ['Mapa de herramientas, brechas y cuellos de botella por área.', 'Map of tools, gaps, and bottlenecks by area.'],
    ['Diseño técnico de solución', 'Technical solution design'],
    ['Arquitectura, integraciones y criterios de calidad/seguridad.', 'Architecture, integrations, and quality/security criteria.'],
    ['Implementación guiada', 'Guided implementation'],
    ['Automatizaciones, agentes IA y paneles listos para producción.', 'Automations, AI agents, and dashboards ready for production.'],
    ['Escalado y optimización', 'Scaling and optimization'],
    ['Métricas, mejora continua y entrenamiento de equipos.', 'Metrics, continuous improvement, and team training.'],
    ['Doce años de red.', 'Twelve years of reach.'],
    ['Tres sectores clave.', 'Three key sectors.'],
    ['Nexova trabaja exclusivamente con medianas empresas de tecnología, retail y servicios financieros que han decidido externalizar parte o la totalidad de su gestión de talento.', 'Nexova works exclusively with mid-sized technology, retail, and financial services companies that have chosen to outsource part or all of their talent management.'],
    ['Inicia tu proceso →', 'Start your process →'],
    ['Tecnología', 'Technology'],
    ['Startups y scale-ups que necesitan talento técnico y soporte de calidad a escala.', 'Startups and scale-ups that need technical talent and quality support at scale.'],
    ['Cadenas con alta rotación que requieren procesos de selección rápidos y eficientes.', 'Chains with high turnover that require fast and efficient selection processes.'],
    ['Servicios Financieros', 'Financial Services'],
    ['Entidades que necesitan perfiles especializados y cumplimiento normativo en selección.', 'Organizations that need specialized profiles and regulatory compliance in selection.'],
    ['En Nexova, la IA no es un complemento — es el núcleo.', 'At Nexova, AI is not an add-on - it is the core.'],
    ['Desde el scoring de CVs hasta el análisis de sentimiento en soporte: construimos sistemas inteligentes que hacen el trabajo de manera más rápida, precisa y a mayor escala.', 'From CV scoring to sentiment analysis in support: we build intelligent systems that make work faster, more accurate, and more scalable.'],
    ['Búsqueda semántica sobre base de datos de candidatos', 'Semantic search over candidate database'],
    ['Tickets de soporte resueltos automáticamente', 'Support tickets resolved automatically'],
    ['SLA de resolución garantizado con monitoreo en tiempo real', 'Guaranteed resolution SLA with real-time monitoring'],
    ['Dashboard ejecutivo con KPIs actualizados al instante', 'Executive dashboard with instantly updated KPIs'],
    ['¿Listo para formar parte', 'Ready to become part'],
    ['del equipo Nexova?', 'of the Nexova team?'],
    ['Completa el formulario de aplicación y cuéntanos tu visión.', 'Complete the application form and tell us your vision.'],
    ['Aplica ahora →', 'Apply now →'],
    ['Consultoría de RRHH y selección de talento potenciada con inteligencia artificial. Desde 2011, con presencia en Valencia y Miami.', 'HR consulting and talent selection powered by artificial intelligence. Since 2011, with presence in Valencia and Miami.'],
    ['Outsourcing de soporte', 'Support outsourcing'],
    ['Formación corporativa', 'Corporate training'],
    ['Valencia, España', 'Valencia, Spain'],
    ['Valencia · España | Miami · USA', 'Valencia · Spain | Miami · USA'],
    ['© 2024 Nexova Solutions S.L. Todos los derechos reservados.', '© 2024 Nexova Solutions S.L. All rights reserved.'],
    ['Aplicación — Nexova Solutions AI Engineering', 'Application — Nexova Solutions AI Engineering'],
    ['Progreso del formulario', 'Form progress'],
    ['Formulario de aplicación a Nexova Solutions', 'Nexova Solutions application form'],
    ['El nombre es obligatorio.', 'First name is required.'],
    ['Los apellidos son obligatorios.', 'Last name is required.'],
    ['Introduce un correo electrónico válido.', 'Enter a valid email address.'],
    ['Introduce un número de teléfono válido.', 'Enter a valid phone number.'],
    ['Introduce una fecha de nacimiento válida.', 'Enter a valid date of birth.'],
    ['Introduce una URL de LinkedIn válida (https://linkedin.com/in/...).', 'Enter a valid LinkedIn URL (https://linkedin.com/in/...).'],
    ['Si introduces una URL, debe ser válida.', 'If you provide a URL, it must be valid.'],
    ['https://linkedin.com/in/tu-perfil', 'https://linkedin.com/in/your-profile'],
    ['https://github.com/tu-usuario', 'https://github.com/your-username'],
    ['Cuéntanos qué te atrajo de Nexova y por qué quieres trabajar aquí...', 'Tell us what attracted you to Nexova and why you want to work here...'],
    ['Limpiar formulario', 'Clear form'],
    ['¿Por qué elegiste Nexova Solutions?', 'Why did you choose Nexova Solutions?'],
    ['Departamentos de interés', 'Departments of interest'],
    ['Chatbot RAG, base de conocimiento, análisis de sentimiento, dashboards SLA', 'RAG chatbot, knowledge base, sentiment analysis, SLA dashboards'],
    ['Tecnología e Infraestructura', 'Technology and Infrastructure'],
    ['Telemetría, logging centralizado, monitoreo en tiempo real, pipelines de datos', 'Telemetry, centralized logging, real-time monitoring, data pipelines'],
    ['Por favor ingresa tu nombre completo (minimo 3 caracteres).', 'Please enter your full name (minimum 3 characters).'],
    ['Por favor ingresa tu nombre completo (mínimo 3 caracteres).', 'Please enter your full name (minimum 3 characters).'],
    ['Ingresa un correo electronico valido.', 'Enter a valid email address.'],
    ['Ingresa un correo electrónico válido.', 'Enter a valid email address.'],
    ['Ingresa un numero de telefono valido (minimo 8 digitos).', 'Enter a valid phone number (minimum 8 digits).'],
    ['Ingresa un número de teléfono válido (mínimo 8 dígitos).', 'Enter a valid phone number (minimum 8 digits).'],
    ['Selecciona una fecha de nacimiento valida.', 'Select a valid date of birth.'],
    ['Selecciona una fecha de nacimiento válida.', 'Select a valid date of birth.'],
    ['Ingresa una URL valida de LinkedIn.', 'Enter a valid LinkedIn URL.'],
    ['Ingresa una URL válida de LinkedIn.', 'Enter a valid LinkedIn URL.'],
    ['Ingresa una URL valida para tu portafolio o GitHub.', 'Enter a valid URL for your portfolio or GitHub.'],
    ['Ingresa una URL válida para tu portafolio o GitHub.', 'Enter a valid URL for your portfolio or GitHub.'],
    ['Selecciona un area de interes.', 'Select an area of interest.'],
    ['Selecciona un área de interés.', 'Select an area of interest.'],
    ['Selecciona al menos un departamento.', 'Select at least one department.'],
    ['Por favor describe el reto (minimo 80 caracteres).', 'Please describe the challenge (minimum 80 characters).'],
    ['Por favor describe el reto (mínimo 80 caracteres).', 'Please describe the challenge (minimum 80 characters).'],
    ['Por favor describe el agente (minimo 60 caracteres).', 'Please describe the agent (minimum 60 characters).'],
    ['Por favor describe el agente (mínimo 60 caracteres).', 'Please describe the agent (minimum 60 characters).'],
    ['Por favor describe las entradas del agente (minimo 30 caracteres).', 'Please describe the agent inputs (minimum 30 characters).'],
    ['Por favor describe las entradas del agente (mínimo 30 caracteres).', 'Please describe the agent inputs (minimum 30 characters).'],
    ['Por favor describe los resultados del agente (minimo 30 caracteres).', 'Please describe the agent outcomes (minimum 30 characters).'],
    ['Por favor describe los resultados del agente (mínimo 30 caracteres).', 'Please describe the agent outcomes (minimum 30 characters).'],
    ['Selecciona tu nivel de experiencia.', 'Select your experience level.'],
    ['Debes aceptar los terminos para continuar.', 'You must accept the terms to continue.'],
    ['Debes aceptar los términos para continuar.', 'You must accept the terms to continue.'],
    ['Describe el reto de automatizacion que quieres abordar en Nexova...', 'Describe the automation challenge you want to address at Nexova...'],
    ['Describe el reto de automatización que quieres abordar en Nexova...', 'Describe the automation challenge you want to address at Nexova...'],
    ['Describe las capacidades y funciones del agente de IA que propondrías...', 'Describe the capabilities and functions of the AI agent you would propose...'],
    ['Tickets historicos, documentacion tecnica, logs, base de conocimiento...', 'Historical tickets, technical documentation, logs, knowledge base...'],
    ['Tickets históricos, documentación técnica, logs, base de conocimiento...', 'Historical tickets, technical documentation, logs, knowledge base...'],
    ['Respuestas automaticas, alertas, clasificacion de tickets, dashboards...', 'Automatic replies, alerts, ticket classification, dashboards...'],
    ['Respuestas automáticas, alertas, clasificación de tickets, dashboards...', 'Automatic replies, alerts, ticket classification, dashboards...']
  ];

  const normalize = (text) => text.replace(/\s+/g, ' ').trim();

  const ES_TO_EN = new Map(TRANSLATION_PAIRS.map(([es, en]) => [normalize(es), en]));
  const EN_TO_ES = new Map(TRANSLATION_PAIRS.map(([es, en]) => [normalize(en), es]));

  let currentLanguage = localStorage.getItem(LANGUAGE_KEY);
  if (currentLanguage !== 'en' && currentLanguage !== 'es') {
    currentLanguage = DEFAULT_LANGUAGE;
  }

  const getDictionary = (lang) => (lang === 'en' ? ES_TO_EN : EN_TO_ES);

  const translateString = (input, dictionary) => {
    const cleaned = normalize(input);
    return dictionary.get(cleaned) || null;
  };

  const translateTextNodes = (dictionary) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();

    while (node) {
      const parent = node.parentElement;
      if (parent && !parent.closest('script, style, textarea') && !parent.closest('.lang-es, .lang-en')) {
        const original = node.textContent || '';
        const translated = translateString(original, dictionary);
        if (translated) {
          const match = original.match(/^(\s*)([\s\S]*?)(\s*)$/);
          const leading = match ? match[1] : '';
          const trailing = match ? match[3] : '';
          node.textContent = `${leading}${translated}${trailing}`;
        }
      }
      node = walker.nextNode();
    }
  };

  const updateLanguageBlocks = (lang) => {
    const showEnglish = lang === 'en';

    document.querySelectorAll('.lang-es').forEach((el) => {
      el.style.display = showEnglish ? 'none' : '';
    });

    document.querySelectorAll('.lang-en').forEach((el) => {
      el.style.display = showEnglish ? '' : 'none';
    });
  };

  const translateAttributes = (dictionary) => {
    const attrNames = ['placeholder', 'aria-label', 'title'];

    document.querySelectorAll('*').forEach((el) => {
      attrNames.forEach((attr) => {
        if (!el.hasAttribute(attr)) {
          return;
        }
        const value = el.getAttribute(attr);
        if (!value) {
          return;
        }
        const translated = translateString(value, dictionary);
        if (translated) {
          el.setAttribute(attr, translated);
        }
      });
    });
  };

  const updateMeta = (lang) => {
    const pageKey = window.location.pathname.includes('application') ? 'application' : 'index';
    const meta = PAGE_META[pageKey][lang];

    if (meta) {
      document.title = meta.title;
      const description = document.querySelector('meta[name="description"]');
      if (description) {
        description.setAttribute('content', meta.description);
      }
    }
  };

  const updateStructuredData = (lang) => {
    const schemaScript = document.querySelector('script[type="application/ld+json"]');
    if (!schemaScript) {
      return;
    }

    try {
      const data = JSON.parse(schemaScript.textContent || '{}');
      if (window.location.pathname.includes('application')) {
        if (lang === 'en') {
          data.title = 'AI Engineering Intern - Nexova Solutions';
          data.description = 'Build AI systems applied to HR, talent selection, and customer support at Nexova Solutions.';
        } else {
          data.title = 'AI Engineering Intern - Nexova Solutions';
          data.description = 'Construye sistemas de IA aplicados a RRHH, selección de talento y soporte al cliente en Nexova Solutions.';
        }
      } else {
        if (lang === 'en') {
          data.description = 'Human resources consulting and talent selection specialized in headhunting, support outsourcing, and corporate training.';
        } else {
          data.description = 'Consultoría de recursos humanos y selección de talento especializada en headhunting, outsourcing de soporte y formación corporativa.';
        }
      }
      schemaScript.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
      // Ignore invalid JSON-LD content.
    }
  };

  const updateLanguageControlLabels = (lang) => {
    const desktop = document.getElementById('languageToggle');
    const mobile = document.getElementById('languageToggleMobile');

    if (desktop) {
      const options = desktop.querySelectorAll('option');
      if (options[0]) {
        options[0].textContent = lang === 'en' ? '🇪🇸 Spanish' : '🇪🇸 Español';
      }
      if (options[1]) {
        options[1].textContent = '🇺🇸 English';
      }
    }

    if (mobile) {
      const options = mobile.querySelectorAll('option');
      if (options[0]) {
        options[0].textContent = lang === 'en' ? '🇪🇸 Spanish' : '🇪🇸 Español';
      }
      if (options[1]) {
        options[1].textContent = '🇺🇸 English';
      }
    }
  };

  const syncControls = (lang) => {
    document.querySelectorAll('#languageToggle, #languageToggleMobile').forEach((control) => {
      if (control) {
        control.value = lang;
      }
    });
  };

  const applyLanguage = (lang) => {
    const safeLang = lang === 'en' ? 'en' : 'es';
    const dictionary = getDictionary(safeLang);

    document.documentElement.lang = safeLang;
    updateLanguageBlocks(safeLang);
    translateTextNodes(dictionary);
    translateAttributes(dictionary);
    updateMeta(safeLang);
    updateStructuredData(safeLang);
    updateLanguageControlLabels(safeLang);
    syncControls(safeLang);

    currentLanguage = safeLang;
    localStorage.setItem(LANGUAGE_KEY, safeLang);

    if (typeof window.updateThemeLabels === 'function') {
      window.updateThemeLabels();
    }

    window.dispatchEvent(new CustomEvent('app-language-changed', { detail: { language: safeLang } }));
  };

  const onChangeLanguage = (event) => {
    applyLanguage(event.target.value);
  };

  const initControls = () => {
    document.querySelectorAll('#languageToggle, #languageToggleMobile').forEach((control) => {
      control.removeEventListener('change', onChangeLanguage);
      control.addEventListener('change', onChangeLanguage);
    });
  };

  window.getAppLanguage = function () {
    return currentLanguage;
  };

  window.translateByLanguage = function (spanishText, englishText) {
    return currentLanguage === 'en' ? englishText : spanishText;
  };

  initControls();
  applyLanguage(currentLanguage);
})();
