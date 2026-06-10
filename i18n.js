(function () {
  'use strict';

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
        title: 'Banco de Talento - Nexova Solutions',
        description: 'Unete al banco de talento de Nexova Solutions. Registranos tus datos y te contactaremos cuando tengamos una oportunidad que encaje con tu perfil.'
      },
      en: {
        title: 'Talent Pool - Nexova Solutions',
        description: 'Join Nexova Solutions talent pool. Share your profile and we will contact you when there is an opportunity that matches your background.'
      }
    }
  };

  const TRANSLATION_PAIRS = [
    ['Saltar al contenido principal', 'Skip to main content'],
    ['Nexova Solutions — Inicio', 'Nexova Solutions — Home'],
    ['Inicio', 'Home'],
    ['Servicios', 'Services'],
    ['Como funciona', 'How it works'],
    ['Cómo funciona', 'How it works'],
    ['Sectores', 'Industries'],
    ['IA', 'AI'],
    ['Aplica', 'Apply'],
    ['Aplica ahora', 'Apply now'],
    ['Aplica ahora →', 'Apply now →'],
    ['Formulario', 'Form'],
    ['Volver', 'Back'],
    ['Seleccionar idioma', 'Select language'],
    ['Cambiar tema', 'Change theme'],
    ['Modo oscuro', 'Dark mode'],
    ['Modo claro', 'Light mode'],
    ['Banco de Talento', 'Talent Pool'],
    ['Desde 2011 · Valencia & Miami', 'Since 2011 · Valencia & Miami'],
    ['Lo que hacemos', 'What we do'],
    ['El proceso', 'The process'],
    ['Experiencia sectorial', 'Sector expertise'],
    ['Ventaja competitiva', 'Competitive advantage'],
    ['Unete al equipo Nexova', 'Join the Nexova team'],
    ['Únete al equipo Nexova', 'Join the Nexova team'],
    ['Regístrate en nuestro banco de talento y te contactaremos cuando tengamos una oportunidad que encaje con tu perfil.', 'Register in our talent pool and we will contact you when we have an opportunity that matches your profile.'],
    ['Nexova Solutions lleva doce años ayudando a medianas empresas a encontrar, formar y retener el talento que necesitan para crecer — ahora potenciado con inteligencia artificial.', 'Nexova Solutions has spent twelve years helping mid-sized companies find, train, and retain the talent they need to grow — now powered by artificial intelligence.'],
    ['Trabaja con nosotros', 'Work with us'],
    ['Ver servicios', 'View services'],
    ['Profesionales', 'Professionals'],
    ['Años de experiencia', 'Years of experience'],
    ['países', 'countries'],
    ['🎯 CV Scoring con IA', '🎯 AI CV scoring'],
    ['📊 Dashboard en tiempo real', '📊 Real-time dashboard'],
    ['Tres líneas de negocio,', 'Three business lines,'],
    ['un único objetivo.', 'one common goal.'],
    ['Headhunting & Selección', 'Headhunting & Selection'],
    ['Identificamos y reclutamos perfiles de mandos medios y directivos con scoring automatizado de CVs y matching inteligente candidato–vacante.', 'We identify and recruit mid-level and executive profiles using automated CV scoring and intelligent candidate-role matching.'],
    ['Pipeline de selección con IA', 'AI-powered recruiting pipeline'],
    ['Portal de candidatos en tiempo real', 'Real-time candidate portal'],
    ['Comunicación automatizada', 'Automated communication'],
    ['Outsourcing de Soporte', 'Support Outsourcing'],
    ['Equipos de atención al cliente dedicados para empresas tech, retail y finanzas. Con chatbot IA de primera línea y dashboards en tiempo real.', 'Dedicated customer support teams for tech, retail, and finance companies, with frontline AI chatbot and real-time dashboards.'],
    ['Chatbot RAG — 40% resolución automática', 'RAG chatbot — 40% automated resolution'],
    ['SLA 24h garantizado', 'Guaranteed 24h SLA'],
    ['Análisis de sentimiento', 'Sentiment analysis'],
    ['Formación Corporativa', 'Corporate Training'],
    ['Programas de liderazgo, comunicación y gestión de equipos con recomendación personalizada y seguimiento de progreso por alumno.', 'Leadership, communication, and team management programs with personalized recommendations and learner progress tracking.'],
    ['Catálogo con inscripción online', 'Catalog with online enrollment'],
    ['Motor de recomendación IA', 'AI recommendation engine'],
    ['Portal del alumno', 'Student portal'],
    ['Cómo trabajamos', 'How we work'],
    ['Transformamos procesos manuales en flujos operativos con IA, datos y visibilidad en tiempo real. Cada fase tiene entregables concretos para generar impacto desde el primer sprint.', 'We transform manual processes into operational workflows with AI, data, and real-time visibility. Each phase includes concrete deliverables to generate impact from the first sprint.'],
    ['Briefing', 'Briefing'],
    ['Entendemos tus necesidades específicas de talento o formación.', 'We understand your specific talent or training needs.'],
    ['Análisis IA', 'AI analysis'],
    ['Nuestra IA procesa candidatos y genera rankings explicables.', 'Our AI processes candidates and generates explainable rankings.'],
    ['Selección', 'Selection'],
    ['Los consultores validan y presentan los mejores perfiles.', 'Consultants validate and present the best profiles.'],
    ['Seguimiento', 'Follow-up'],
    ['Portal en tiempo real con visibilidad total del proceso.', 'Real-time portal with full process visibility.'],
    ['Fase 1', 'Phase 1'],
    ['Diagnóstico de operación', 'Operational diagnostics'],
    ['Mapa de herramientas, brechas y cuellos de botella por área.', 'Map of tools, gaps, and bottlenecks by area.'],
    ['Fase 2', 'Phase 2'],
    ['Diseño técnico de solución', 'Technical solution design'],
    ['Arquitectura, integraciones y criterios de calidad/seguridad.', 'Architecture, integrations, and quality/security criteria.'],
    ['Fase 3', 'Phase 3'],
    ['Implementación guiada', 'Guided implementation'],
    ['Automatizaciones, agentes IA y paneles listos para producción.', 'Automations, AI agents, and dashboards ready for production.'],
    ['Fase 4', 'Phase 4'],
    ['Escalado y optimización', 'Scaling and optimization'],
    ['Métricas, mejora continua y entrenamiento de equipos.', 'Metrics, continuous improvement, and team training.'],
    ['Doce años de red.', 'Twelve years of network.'],
    ['Tres sectores clave.', 'Three key sectors.'],
    ['Nexova trabaja exclusivamente con medianas empresas de tecnología, retail y servicios financieros que han decidido externalizar parte o la totalidad de su gestión de talento.', 'Nexova works exclusively with mid-sized technology, retail, and financial services companies that have chosen to outsource part or all of their talent management.'],
    ['Inicia tu proceso →', 'Start your process →'],
    ['Tecnología', 'Technology'],
    ['Startups y scale-ups que necesitan talento técnico y soporte de calidad a escala.', 'Startups and scale-ups that need technical talent and high-quality support at scale.'],
    ['Retail', 'Retail'],
    ['Cadenas con alta rotación que requieren procesos de selección rápidos y eficientes.', 'Chains with high turnover that require fast and efficient hiring processes.'],
    ['Servicios Financieros', 'Financial Services'],
    ['Entidades que necesitan perfiles especializados y cumplimiento normativo en selección.', 'Organizations that need specialized profiles and regulatory compliance in hiring.'],
    ['En Nexova, la IA no es un complemento — es el núcleo.', 'At Nexova, AI is not an add-on — it is the core.'],
    ['Desde el scoring de CVs hasta el análisis de sentimiento en soporte: construimos sistemas inteligentes que hacen el trabajo de manera más rápida, precisa y a mayor escala.', 'From CV scoring to sentiment analysis in support, we build intelligent systems that make work faster, more accurate, and more scalable.'],
    ['Búsqueda semántica sobre base de datos de candidatos', 'Semantic search over candidate database'],
    ['Tickets de soporte resueltos automáticamente', 'Support tickets automatically resolved'],
    ['SLA de resolución garantizado con monitoreo en tiempo real', 'Guaranteed resolution SLA with real-time monitoring'],
    ['Dashboard ejecutivo con KPIs actualizados al instante', 'Executive dashboard with instantly updated KPIs'],
    ['¿Listo para formar parte', 'Ready to become part'],
    ['del equipo Nexova?', 'of the Nexova team?'],
    ['Completa el formulario de aplicación y cuéntanos tu visión.', 'Complete the application form and tell us your vision.'],
    ['¿Eres una empresa buscando talento? Escríbenos a', 'Are you a company looking for talent? Contact us at'],
    ['Ir al formulario', 'Go to form'],
    ['Progreso del formulario', 'Form progress'],
    ['Datos de contacto', 'Contact details'],
    ['Perfil profesional', 'Professional profile'],
    ['Nombre completo', 'Full name'],
    ['Correo electronico', 'Email address'],
    ['Correo electrónico', 'Email address'],
    ['Telefono', 'Phone'],
    ['Teléfono', 'Phone'],
    ['Pais de residencia', 'Country of residence'],
    ['País de residencia', 'Country of residence'],
    ['LinkedIn', 'LinkedIn'],
    ['(opcional)', '(optional)'],
    ['https://linkedin.com/in/tu-perfil', 'https://linkedin.com/in/your-profile'],
    ['Selecciona tu país', 'Select your country'],
    ['Selecciona tu pais', 'Select your country'],
    ['España', 'Spain'],
    ['Estados Unidos', 'United States'],
    ['Otro', 'Other'],
    ['Selecciona tu nivel', 'Choose your level'],
    ['Básico', 'Basic'],
    ['Intermedio', 'Intermediate'],
    ['Avanzado', 'Advanced'],
    ['Nativo', 'Native'],
    ['Selecciona un sector', 'Choose a sector'],
    ['tecnologia', 'technology'],
    ['retail', 'retail'],
    ['servicios-financieros', 'financial-services'],
    ['consultoria', 'consulting'],
    ['Consultoría', 'Consulting'],
    ['Años de experiencia', 'Years of experience'],
    ['Nivel de ingles', 'English level'],
    ['Nivel de inglés', 'English level'],
    ['Sector de interes', 'Preferred industry'],
    ['Sector de interés', 'Preferred industry'],
    ['Disponibilidad', 'Availability'],
    ['Inmediata', 'Immediate'],
    ['1 mes', '1 month'],
    ['2-3 meses', '2-3 months'],
    ['Solo explorando', 'Just exploring'],
    ['Comentarios adicionales', 'Additional comments'],
    ['Cuéntanos más sobre tu trayectoria, motivaciones o cualquier otro detalle...', 'Tell us more about your background, motivations, or any other details...'],
    ['AI-Powered', 'AI-Powered'],
    ['Popular', 'Popular'],
    ['Acepto la', 'I accept the'],
    ['politica de tratamiento de datos', 'Data Processing Policy'],
    ['política de tratamiento de datos', 'Data Processing Policy'],
    ['de Nexova Solutions y autorizo el uso de mi informacion para el proceso de seleccion.', 'of Nexova Solutions and authorize the use of my information for the recruitment process.'],
    ['de Nexova Solutions y autorizo el uso de mi información para el proceso de selección.', 'of Nexova Solutions and authorize the use of my information for the recruitment process.'],
    ['Debes aceptar la politica de tratamiento de datos para continuar.', 'You must accept the Data Processing Policy to continue.'],
    ['Debes aceptar la política de tratamiento de datos para continuar.', 'You must accept the Data Processing Policy to continue.'],
    ['El nombre debe contener al menos nombre y apellido.', 'Your full name must include at least first and last name.'],
    ['Ingresa un email valido (ejemplo: nombre@empresa.com).', 'Enter a valid email address (example: name@company.com).'],
    ['Ingresa un email válido (ejemplo: nombre@empresa.com).', 'Enter a valid email address (example: name@company.com).'],
    ['El telefono debe incluir codigo de pais (ejemplo: +34 612 345 678).', 'Phone number must include country code (example: +34 612 345 678).'],
    ['El teléfono debe incluir código de país (ejemplo: +34 612 345 678).', 'Phone number must include country code (example: +34 612 345 678).'],
    ['Selecciona tu pais de residencia.', 'Select your country of residence.'],
    ['Selecciona tu país de residencia.', 'Select your country of residence.'],
    ['Si incluyes LinkedIn, debe ser una URL valida (https://linkedin.com/in/...).', 'If you provide LinkedIn, it must be a valid URL (https://linkedin.com/in/...).'],
    ['Si incluyes LinkedIn, debe ser una URL válida (https://linkedin.com/in/...).', 'If you provide LinkedIn, it must be a valid URL (https://linkedin.com/in/...).'],
    ['Los años de experiencia deben estar entre 0 y 50.', 'Years of experience must be between 0 and 50.'],
    ['Indica tu nivel de ingles.', 'Select your English level.'],
    ['Indica tu nivel de inglés.', 'Select your English level.'],
    ['Selecciona el sector de tu interes.', 'Select your preferred industry.'],
    ['Selecciona el sector de tu interés.', 'Select your preferred industry.'],
    ['Selecciona tu disponibilidad.', 'Select your availability.'],
    ['Los comentarios no pueden exceder 500 caracteres.', 'Comments cannot exceed 500 characters.'],
    ['Limpiar formulario', 'Clear form'],
    ['Limpiar paso', 'Clear step'],
    ['Limpiar', 'Clear'],
    ['Siguiente →', 'Next →'],
    ['← Anterior', '← Previous'],
    ['Enviar registro', 'Submit registration'],
    ['Politica de tratamiento de datos', 'Data Processing Policy'],
    ['Política de tratamiento de datos', 'Data Processing Policy'],
    ['Cerrar politica de tratamiento de datos', 'Close Data Processing Policy'],
    ['Cerrar política de tratamiento de datos', 'Close Data Processing Policy'],
    ['1. Responsable del tratamiento', '1. Data controller'],
    ['2. Finalidad', '2. Purpose'],
    ['3. Base legal', '3. Legal basis'],
    ['4. Conservacion', '4. Retention'],
    ['4. Conservación', '4. Retention'],
    ['5. Derechos', '5. Rights'],
    ['6. Seguridad', '6. Security'],
    ['En Nexova Solutions tratamos tus datos personales con la finalidad de gestionar tu candidatura, evaluar tu perfil profesional y contactar contigo para procesos de seleccion actuales o futuros.', 'At Nexova Solutions, we process your personal data to manage your application, evaluate your professional profile, and contact you about current or future recruitment processes.'],
    ['En Nexova Solutions tratamos tus datos personales con la finalidad de gestionar tu candidatura, evaluar tu perfil profesional y contactar contigo para procesos de selección actuales o futuros.', 'At Nexova Solutions, we process your personal data to manage your application, evaluate your professional profile, and contact you about current or future recruitment processes.'],
    ['Nexova Solutions S.L., con oficinas en Valencia (España) y Miami (EE. UU.), actua como responsable del tratamiento de la informacion que compartes en este formulario.', 'Nexova Solutions S.L., with offices in Valencia (Spain) and Miami (U.S.), acts as the data controller for the information you share in this form.'],
    ['Nexova Solutions S.L., con oficinas en Valencia (España) y Miami (EE. UU.), actúa como responsable del tratamiento de la información que compartes en este formulario.', 'Nexova Solutions S.L., with offices in Valencia (Spain) and Miami (U.S.), acts as the data controller for the information you share in this form.'],
    ['Usaremos tus datos para analizar tu experiencia, validar tu encaje con vacantes, mantenerte en nuestro banco de talento y enviarte comunicaciones relacionadas con oportunidades laborales.', 'We will use your data to analyze your experience, assess your fit for vacancies, keep you in our talent pool, and send communications related to job opportunities.'],
    ['La base legal del tratamiento es tu consentimiento explicito al aceptar esta politica y enviar voluntariamente tu solicitud.', 'The legal basis for processing is your explicit consent when accepting this policy and voluntarily submitting your application.'],
    ['La base legal del tratamiento es tu consentimiento explícito al aceptar esta política y enviar voluntariamente tu solicitud.', 'The legal basis for processing is your explicit consent when accepting this policy and voluntarily submitting your application.'],
    ['Conservaremos tus datos durante el tiempo necesario para cumplir la finalidad indicada o hasta que solicites su supresion, salvo obligaciones legales que exijan su conservacion por mas tiempo.', 'We will retain your data for as long as necessary to fulfill the stated purpose or until you request deletion, unless legal obligations require longer retention.'],
    ['Conservaremos tus datos durante el tiempo necesario para cumplir la finalidad indicada o hasta que solicites su supresión, salvo obligaciones legales que exijan su conservación por más tiempo.', 'We will retain your data for as long as necessary to fulfill the stated purpose or until you request deletion, unless legal obligations require longer retention.'],
    ['Puedes ejercer tus derechos de acceso, rectificacion, supresion, oposicion, limitacion y portabilidad escribiendo a hola@nexovasolutions.com, indicando en el asunto "Proteccion de datos".', 'You may exercise your rights of access, rectification, deletion, objection, restriction, and portability by writing to hola@nexovasolutions.com and including "Data protection" in the subject line.'],
    ['Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a hola@nexovasolutions.com, indicando en el asunto "Protección de datos".', 'You may exercise your rights of access, rectification, deletion, objection, restriction, and portability by writing to hola@nexovasolutions.com and including "Data protection" in the subject line.'],
    ['Aplicamos medidas tecnicas y organizativas apropiadas para proteger tus datos frente a accesos no autorizados, alteracion, perdida o destruccion.', 'We apply appropriate technical and organizational measures to protect your data against unauthorized access, alteration, loss, or destruction.'],
    ['Aplicamos medidas técnicas y organizativas apropiadas para proteger tus datos frente a accesos no autorizados, alteración, pérdida o destrucción.', 'We apply appropriate technical and organizational measures to protect your data against unauthorized access, alteration, loss, or destruction.'],
    ['¡Gracias por tu interes en Nexova!', 'Thanks for your interest in Nexova!'],
    ['¡Gracias por tu interés en Nexova!', 'Thanks for your interest in Nexova!'],
    ['Hemos recibido tu informacion. Nuestro equipo de seleccion la revisara y te contactaremos en caso de que tu perfil encaje con alguna de nuestras oportunidades actuales o futuras.', 'We have received your information. Our recruitment team will review it and contact you if your profile matches any of our current or future opportunities.'],
    ['Hemos recibido tu información. Nuestro equipo de selección la revisará y te contactaremos en caso de que tu perfil encaje con alguna de nuestras oportunidades actuales o futuras.', 'We have received your information. Our recruitment team will review it and contact you if your profile matches any of our current or future opportunities.'],
    ['Mientras tanto, siguenos en', 'In the meantime, follow us on'],
    ['Mientras tanto, síguenos en', 'In the meantime, follow us on'],
    ['para estar al dia de nuestras vacantes y contenido sobre desarrollo profesional.', 'to stay updated on new openings and professional development content.'],
    ['para estar al día de nuestras vacantes y contenido sobre desarrollo profesional.', 'to stay updated on new openings and professional development content.'],
    ['Volver al inicio', 'Back to home page'],
    ['Navegación principal', 'Main navigation'],
    ['Menú móvil', 'Mobile menu'],
    ['Abrir menú', 'Open menu'],
    ['Navegacion del formulario', 'Form navigation'],
    ['Navegación del formulario', 'Form navigation'],
    ['Volver a Nexova Solutions', 'Back to Nexova Solutions'],
    ['Enlaces', 'Links'],
    ['Pagina principal', 'Main page'],
    ['Página principal', 'Main page'],
    ['Contacto', 'Contact'],
    ['Consultoría de RRHH y selección de talento potenciada con inteligencia artificial. Desde 2011, con presencia en Valencia y Miami.', 'HR consulting and talent acquisition powered by artificial intelligence. Since 2011, with presence in Valencia and Miami.'],
    ['Valencia, Espana', 'Valencia, Spain'],
    ['Valencia, España', 'Valencia, Spain'],
    ['© 2024 Nexova Solutions S.L. Todos los derechos reservados.', '© 2024 Nexova Solutions S.L. All rights reserved.'],
    ['Valencia · España | Miami · USA', 'Valencia · Spain | Miami · USA']
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

  const updateLanguageBlocks = (lang) => {
    const showEnglish = lang === 'en';
    document.querySelectorAll('.lang-es').forEach((el) => {
      el.style.display = showEnglish ? 'none' : '';
    });
    document.querySelectorAll('.lang-en').forEach((el) => {
      el.style.display = showEnglish ? '' : 'none';
    });
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

  const translateAttributes = (dictionary) => {
    const attrNames = ['placeholder', 'aria-label', 'title'];

    document.querySelectorAll('*').forEach((el) => {
      attrNames.forEach((attr) => {
        if (!el.hasAttribute(attr)) return;
        const value = el.getAttribute(attr);
        if (!value) return;
        const translated = translateString(value, dictionary);
        if (translated) {
          el.setAttribute(attr, translated);
        }
      });
    });
  };

  const updateLanguageControlLabels = (lang) => {
    const desktop = document.getElementById('languageToggle');
    const mobile = document.getElementById('languageToggleMobile');

    const updateOptions = (control) => {
      if (!control) return;
      const options = control.querySelectorAll('option');
      if (options[0]) {
        options[0].textContent = lang === 'en' ? '🇪🇸 Spanish' : '🇪🇸 Español';
      }
      if (options[1]) {
        options[1].textContent = '🇺🇸 English';
      }
    };

    updateOptions(desktop);
    updateOptions(mobile);
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
    if (!schemaScript) return;

    try {
      const data = JSON.parse(schemaScript.textContent || '{}');
      if (window.location.pathname.includes('application')) {
        data.title = lang === 'en' ? 'Talent Pool Registration - Nexova Solutions' : 'Registro de talento - Nexova Solutions';
        data.description = lang === 'en'
          ? 'Join the Nexova Solutions talent pool and apply to future opportunities.'
          : 'Únete al banco de talento de Nexova Solutions y aplica a futuras oportunidades.';
      }
      schemaScript.textContent = JSON.stringify(data, null, 2);
    } catch (_) {
      // Ignore invalid schema content.
    }
  };

  const syncControls = (lang) => {
    document.querySelectorAll('#languageToggle, #languageToggleMobile').forEach((control) => {
      control.value = lang;
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
