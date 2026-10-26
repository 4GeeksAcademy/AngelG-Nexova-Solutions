"use client";

import { useEffect } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useSitePreferences } from "@/lib/site-preferences";

type LandingCopy = {
  heroEyebrow: string;
  heroDescription: string;
  apply: string;
  servicesLink: string;
  statLabels: [string, string, string];
  orbitLabels: [string, string, string];
  servicesEyebrow: string;
  servicesHeading: [string, string];
  servicesNote: string;
  services: { title: string; accent: string; description: string; bullets: string[]; link: string }[];
  processEyebrow: string;
  processHeading: [string, string];
  processDescription: string;
  steps: { title: string; description: string }[];
  phases: { title: string; description: string }[];
  sectorEyebrow: string;
  sectorHeading: [string, string];
  sectorDescription: string;
  sectorLink: string;
  sectors: { title: string; description: string }[];
  technologyEyebrow: string;
  technologyHeading: [string, string];
  technologyDescription: string;
  technologyPoints: string[];
  technologyStats: { value: string; description: string }[];
  ctaEyebrow: string;
  ctaHeading: [string, string];
  ctaDescription: string;
  backToTop: string;
  footerDescription: string;
  servicesTitle: string;
  contactTitle: string;
};

const copy: Record<"es" | "en", LandingCopy> = {
  es: {
    heroEyebrow: "Desde 2011 · Valencia & Miami",
    heroDescription: "Nexova Solutions lleva doce años ayudando a medianas empresas a encontrar, formar y retener el talento que necesitan para crecer, ahora potenciado con inteligencia artificial.",
    apply: "Trabaja con nosotros",
    servicesLink: "Ver servicios",
    statLabels: ["Profesionales", "Años de experiencia", "ES · USA"],
    orbitLabels: ["CV Scoring con IA", "Dashboard en tiempo real", "SLA 24h"],
    servicesEyebrow: "Lo que hacemos",
    servicesHeading: ["Tres líneas de negocio,", "un único objetivo."],
    servicesNote: "Soluciones para acompañar a las personas y a las organizaciones en cada etapa de su crecimiento.",
    services: [
      {
        title: "Headhunting",
        accent: "& Selección",
        description: "Identificamos y reclutamos perfiles de mandos medios y directivos con scoring automatizado de CVs y matching inteligente candidato–vacante.",
        bullets: ["Pipeline de selección con IA", "Portal de candidatos en tiempo real", "Comunicación automatizada"],
        link: "Explora oportunidades",
      },
      {
        title: "Outsourcing",
        accent: "de soporte",
        description: "Equipos de atención al cliente dedicados para empresas tech, retail y finanzas, con chatbot IA de primera línea y dashboards en tiempo real.",
        bullets: ["Chatbot RAG — 40% resolución automática", "SLA 24h", "Análisis de sentimiento"],
        link: "Conoce el servicio",
      },
      {
        title: "Formación",
        accent: "corporativa",
        description: "Programas de liderazgo, comunicación y gestión de equipos con recomendación personalizada y seguimiento de progreso por alumno.",
        bullets: ["Catálogo con inscripción online", "Motor de recomendación IA", "Portal del alumno"],
        link: "Conoce el servicio",
      },
    ],
    processEyebrow: "El proceso",
    processHeading: ["Cómo trabajamos", "con tu equipo."],
    processDescription: "Transformamos procesos manuales en flujos operativos con IA, datos y visibilidad en tiempo real. Cada fase tiene entregables concretos para generar impacto desde el primer sprint.",
    steps: [
      { title: "Briefing", description: "Entendemos tus necesidades específicas de talento o formación." },
      { title: "Análisis IA", description: "Nuestra IA procesa candidatos y genera rankings explicables." },
      { title: "Selección", description: "Los consultores validan y presentan los mejores perfiles." },
      { title: "Seguimiento", description: "Portal en tiempo real con visibilidad total del proceso." },
    ],
    phases: [
      { title: "Diagnóstico de operación", description: "Mapa de herramientas, brechas y cuellos de botella por área." },
      { title: "Diseño técnico de solución", description: "Arquitectura, integraciones y criterios de calidad y seguridad." },
      { title: "Implementación guiada", description: "Automatizaciones, agentes IA y paneles listos para producción." },
      { title: "Escalado y optimización", description: "Métricas, mejora continua y entrenamiento de equipos." },
    ],
    sectorEyebrow: "Experiencia sectorial",
    sectorHeading: ["Doce años de red.", "Tres sectores clave."],
    sectorDescription: "Nexova trabaja con medianas empresas de tecnología, retail y servicios financieros que han decidido externalizar parte o la totalidad de su gestión de talento.",
    sectorLink: "Inicia una conversación",
    sectors: [
      { title: "Tecnología", description: "Startups y scale-ups que necesitan talento técnico y soporte de calidad a escala." },
      { title: "Retail", description: "Cadenas con alta rotación que requieren procesos de selección rápidos y eficientes." },
      { title: "Servicios financieros", description: "Entidades que necesitan perfiles especializados y cumplimiento normativo en selección." },
    ],
    technologyEyebrow: "Ventaja competitiva",
    technologyHeading: ["En Nexova, la IA no es", "un complemento: es el núcleo."],
    technologyDescription: "Desde el scoring de CVs hasta el análisis de sentimiento en soporte: construimos sistemas inteligentes que hacen el trabajo de manera más rápida, precisa y a mayor escala.",
    technologyPoints: ["Scoring de CVs", "Búsqueda semántica", "Análisis de sentimiento"],
    technologyStats: [
      { value: "RAG", description: "Búsqueda semántica sobre perfiles y conocimiento." },
      { value: "40%", description: "Tickets de soporte resueltos automáticamente." },
      { value: "24h", description: "SLA de resolución con monitoreo en tiempo real." },
      { value: "0 retraso", description: "Dashboard ejecutivo con KPIs actualizados al instante." },
    ],
    ctaEyebrow: "Hablemos",
    ctaHeading: ["¿Listo para formar parte", "del equipo Nexova?"],
    ctaDescription: "Completa el formulario de aplicación y cuéntanos tu visión.",
    backToTop: "Volver al inicio",
    footerDescription: "Consultoría de RRHH y selección de talento, con presencia en Valencia y Miami.",
    servicesTitle: "Servicios",
    contactTitle: "Contacto",
  },
  en: {
    heroEyebrow: "Since 2011 · Valencia & Miami",
    heroDescription: "Nexova Solutions has spent twelve years helping mid-sized companies find, train, and retain the talent they need to grow, now enhanced with artificial intelligence.",
    apply: "Work with us",
    servicesLink: "View services",
    statLabels: ["Professionals", "Years of experience", "ES · USA"],
    orbitLabels: ["AI CV scoring", "Real-time dashboard", "24h SLA"],
    servicesEyebrow: "What we do",
    servicesHeading: ["Three business lines,", "one common goal."],
    servicesNote: "Solutions that support people and organizations through every stage of growth.",
    services: [
      {
        title: "Headhunting",
        accent: "& Selection",
        description: "We identify and recruit mid-level and executive profiles using automated CV scoring and intelligent candidate-role matching.",
        bullets: ["AI-powered recruiting pipeline", "Real-time candidate portal", "Automated communication"],
        link: "Explore opportunities",
      },
      {
        title: "Support",
        accent: "outsourcing",
        description: "Dedicated customer support teams for tech, retail, and finance companies, with frontline AI chatbots and real-time dashboards.",
        bullets: ["RAG chatbot — 40% automated resolution", "24h SLA", "Sentiment analysis"],
        link: "Explore the service",
      },
      {
        title: "Corporate",
        accent: "training",
        description: "Leadership, communication, and team management programs with personalized recommendations and learner progress tracking.",
        bullets: ["Catalog with online enrollment", "AI recommendation engine", "Learner portal"],
        link: "Explore the service",
      },
    ],
    processEyebrow: "The process",
    processHeading: ["How we work", "with your team."],
    processDescription: "We turn manual processes into operational workflows with AI, data, and real-time visibility. Each phase has concrete deliverables to make an impact from the first sprint.",
    steps: [
      { title: "Briefing", description: "We understand your specific talent or training needs." },
      { title: "AI analysis", description: "Our AI processes candidates and generates explainable rankings." },
      { title: "Selection", description: "Consultants validate and present the strongest profiles." },
      { title: "Follow-up", description: "A real-time portal provides full visibility into the process." },
    ],
    phases: [
      { title: "Operational assessment", description: "Map tools, gaps, and bottlenecks across teams." },
      { title: "Technical solution design", description: "Architecture, integrations, and quality and security criteria." },
      { title: "Guided implementation", description: "Automations, AI agents, and dashboards ready for production." },
      { title: "Scale and optimize", description: "Metrics, continuous improvement, and team training." },
    ],
    sectorEyebrow: "Industry experience",
    sectorHeading: ["Twelve years of reach.", "Three key industries."],
    sectorDescription: "Nexova works with mid-sized technology, retail, and financial services companies that choose to outsource part or all of their talent management.",
    sectorLink: "Start a conversation",
    sectors: [
      { title: "Technology", description: "Startups and scale-ups that need technical talent and high-quality support at scale." },
      { title: "Retail", description: "Retail chains with high turnover that need fast, efficient hiring processes." },
      { title: "Financial services", description: "Organizations that need specialized profiles and compliant hiring." },
    ],
    technologyEyebrow: "Competitive edge",
    technologyHeading: ["At Nexova, AI is not", "an add-on: it is the core."],
    technologyDescription: "From CV scoring to sentiment analysis in support, we build intelligent systems that make work faster, more accurate, and more scalable.",
    technologyPoints: ["CV scoring", "Semantic search", "Sentiment analysis"],
    technologyStats: [
      { value: "RAG", description: "Semantic search across profiles and knowledge." },
      { value: "40%", description: "Support tickets resolved automatically." },
      { value: "24h", description: "Resolution SLA with real-time monitoring." },
      { value: "0 delay", description: "Executive dashboard with instantly updated KPIs." },
    ],
    ctaEyebrow: "Get in touch",
    ctaHeading: ["Ready to join", "the Nexova team?"],
    ctaDescription: "Complete the application form and tell us your vision.",
    backToTop: "Back to top",
    footerDescription: "HR consulting and talent acquisition, with a presence in Valencia and Miami.",
    servicesTitle: "Services",
    contactTitle: "Contact",
  },
};

export function LandingContent() {
  const { language } = useSitePreferences();
  const t = copy[language];

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    let observer: IntersectionObserver;
    try {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.01, rootMargin: "0px 0px 48px 0px" });
      elements.forEach((element) => observer.observe(element));
      document.documentElement.classList.add("has-reveal");
    } catch {
      elements.forEach((element) => element.classList.add("is-visible"));
      document.documentElement.classList.remove("has-reveal");
      return;
    }

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("has-reveal");
    };
  }, []);

  return (
    <>
      <SiteHeader />
      <a className="skip-link" href="#main">{language === "es" ? "Saltar al contenido principal" : "Skip to main content"}</a>
      <main id="main">
        <section className="hero" id="inicio" aria-labelledby="hero-title">
          <div className="hero-glow" aria-hidden="true" />
          <div className="container hero-layout">
            <div className="hero-copy" data-reveal>
              <p className="eyebrow">{t.heroEyebrow}</p>
              <h1 id="hero-title">
                {language === "es" ? <>El talento <em>correcto</em>,<br />en el momento<br />exacto.</> : <>The <em>right</em> talent,<br />when your business<br />needs it.</>}
              </h1>
              <p className="hero-intro">{t.heroDescription}</p>
              <div className="hero-actions">
                <Link className="button button-gold" href="/application">{t.apply}<span aria-hidden="true">↗</span></Link>
                <a className="button button-outline" href="#servicios">{t.servicesLink}</a>
              </div>
              <div className="stats" aria-label={language === "es" ? "Nexova en cifras" : "Nexova in numbers"}>
                <div><strong>120<span>+</span></strong><span>{t.statLabels[0]}</span></div>
                <div><strong>12<span>+</span></strong><span>{t.statLabels[1]}</span></div>
                <div><strong>2 <small>{language === "es" ? "países" : "countries"}</small></strong><span>{t.statLabels[2]}</span></div>
              </div>
            </div>
            <div className="hero-art" aria-hidden="true" data-reveal data-reveal-delay="1">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="orbit orbit-three" />
              <div className="core"><span className="brand-mark large">N</span><small>AI-POWERED</small></div>
              <div className="float-card float-top"><span className="float-icon">✳</span><b>{t.orbitLabels[0]}</b></div>
              <div className="float-card float-right"><span className="float-icon">▥</span><b>{t.orbitLabels[1]}</b></div>
              <div className="float-card float-bottom"><span className="float-icon">✓</span><b>{t.orbitLabels[2]}</b></div>
            </div>
          </div>
        </section>

        <section className="section services" id="servicios" aria-labelledby="services-title">
          <div className="container">
            <div className="section-heading" data-reveal>
              <div><p className="eyebrow">{t.servicesEyebrow}</p><h2 id="services-title">{t.servicesHeading[0]}<br /><em>{t.servicesHeading[1]}</em></h2></div>
              <p className="heading-note">{t.servicesNote}</p>
            </div>
            <div className="service-grid">
              {t.services.map((service, index) => (
                <article className={`service-card${index === 1 ? " featured" : ""}`} key={service.title} data-reveal data-reveal-delay={index}>
                  <div className="service-card-heading">
                    <h3>{service.title} <span>{service.accent}</span></h3>
                    <div className="service-card-tools">
                      <span className="service-symbol" aria-hidden="true">
                        {index === 0 ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="9" cy="7" r="3" />
                            <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 4.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 5" />
                          </svg>
                        ) : index === 1 ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 13v-1a9 9 0 0 1 18 0v1" />
                            <rect x="3" y="12" width="4" height="7" rx="2" />
                            <rect x="17" y="12" width="4" height="7" rx="2" />
                            <path d="M17 19a5 5 0 0 1-5 3h-2" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 7v14M12 7C9.8 5.5 6.5 5 3 6v14c3.5-1 6.8-.5 9 1m0-14c2.2-1.5 5.5-2 9-1v14c-3.5-1-6.8-.5-9 1" />
                          </svg>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="service-card-body">
                    <p>{service.description}</p>
                    <ul>{service.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
                  </div>
                  <Link href="/application" className="text-link">{service.link}<span aria-hidden="true"> →</span></Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section process" id="proceso" aria-labelledby="process-title">
          <div className="container">
            <div className="center-heading" data-reveal>
              <p className="eyebrow">{t.processEyebrow}</p>
              <h2 id="process-title">{t.processHeading[0]}<br /><em>{t.processHeading[1]}</em></h2>
              <p>{t.processDescription}</p>
            </div>
            <ol className="steps">
              {t.steps.map((step, index) => <li key={step.title} data-reveal data-reveal-delay={index}><span className="step-index">0{index + 1}</span><h3>{step.title}</h3><p>{step.description}</p></li>)}
            </ol>
            <div className="phase-grid">
              {t.phases.map((phase, index) => <article key={phase.title} data-reveal data-reveal-delay={index}><p>{language === "es" ? "Fase" : "Phase"} {index + 1}</p><h3>{phase.title}</h3><span>{phase.description}</span></article>)}
            </div>
          </div>
        </section>

        <section className="section industries" id="sectores" aria-labelledby="industry-title">
          <div className="container industry-layout">
            <div className="industry-copy" data-reveal>
              <p className="eyebrow">{t.sectorEyebrow}</p>
              <h2 id="industry-title">{t.sectorHeading[0]}<br /><em>{t.sectorHeading[1]}</em></h2>
              <p>{t.sectorDescription}</p>
              <a className="text-link" href="#contacto">{t.sectorLink}<span aria-hidden="true"> →</span></a>
            </div>
            <div className="industry-list">
              {t.sectors.map((sector, index) => (
                <article key={sector.title} data-reveal data-reveal-delay={index}>
                  <span className="industry-icon" aria-hidden="true">
                    {index === 0 ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M3 9h18M9 3v18" />
                      </svg>
                    ) : index === 1 ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 8h14l1 13H4L5 8Z" />
                        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M15 9.5c-.5-.8-1.4-1.2-2.7-1.2-1.3 0-2.3.7-2.3 1.7 0 2.8 5.3 1.2 5.3 4.1 0 1.1-1.1 1.9-2.6 1.9-1.2 0-2.3-.5-2.9-1.4M12.7 6.8v1.5m-1.4 8.1v1.4" />
                      </svg>
                    )}
                  </span>
                  <div><h3>{sector.title}</h3><p>{sector.description}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="tech" id="ia" aria-labelledby="technology-title">
          <div className="container tech-layout">
            <div data-reveal><p className="eyebrow">{t.technologyEyebrow}</p><h2 id="technology-title">{t.technologyHeading[0]}<br /><em>{t.technologyHeading[1]}</em></h2></div>
            <div className="tech-copy" data-reveal data-reveal-delay="1">
              <p>{t.technologyDescription}</p>
              <div className="tech-points">{t.technologyPoints.map((point, index) => <span key={point}><b>0{index + 1}</b>{point}</span>)}</div>
            </div>
          </div>
          <div className="container technology-stats">
            {t.technologyStats.map((stat, index) => <article key={stat.value} data-reveal data-reveal-delay={index}><p>{stat.value}</p><span>{stat.description}</span></article>)}
          </div>
        </section>

        <section className="cta" id="aplica" aria-labelledby="cta-title">
          <div className="container cta-inner" data-reveal>
            <div><p className="eyebrow">{language === "es" ? "Banco de Talento" : "Talent Pool"}</p><h2 id="cta-title">{language === "es" ? "Únete al equipo Nexova" : "Join the Nexova team"}</h2></div>
            <div className="cta-action">
              <p>{language === "es" ? "Regístrate en nuestro banco de talento y te contactaremos cuando tengamos una oportunidad que encaje con tu perfil." : "Register in our talent pool and we will contact you when an opportunity matches your profile."}</p>
              <p>{language === "es" ? "¿Eres una empresa buscando talento? Escríbenos a " : "Are you a company looking for talent? Write to us at "}<a href="mailto:hola@nexovasolutions.com">hola@nexovasolutions.com</a></p>
              <Link className="button button-dark" href="/application">{language === "es" ? "Ir al formulario" : "Go to form"}<span aria-hidden="true">↗</span></Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter onHome />
    </>
  );
}