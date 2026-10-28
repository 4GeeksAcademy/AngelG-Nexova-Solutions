"use client";

import { useEffect } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionTitle } from "@/components/SectionTitle";
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
    heroDescription: "Consultora de recursos humanos y adquisición de talento con experiencia desde 2011 ayudando a empresas de tecnología, retail y servicios financieros a encontrar y desarrollar talento.",
    apply: "Únete a nuestro banco de talento",
    servicesLink: "Ver servicios",
    statLabels: ["Profesionales", "Fundación", "Presencia"],
    orbitLabels: ["Headhunting", "Atención al cliente", "Formación corporativa"],
    servicesEyebrow: "Lo que hacemos",
    servicesHeading: ["Tres líneas de negocio,", "un único objetivo."],
    servicesNote: "Acompañamos a las organizaciones a encontrar, desarrollar y cuidar el talento que necesitan.",
    services: [
      {
        title: "Headhunting",
        accent: "ejecutivo",
        description: "Búsqueda y selección personalizada de perfiles ejecutivos y mandos medios, desde el briefing hasta la presentación de candidatos.",
        bullets: ["Perfiles ejecutivos y mandos medios", "Proceso de selección personalizado", "Acompañamiento durante la búsqueda"],
        link: "Explora oportunidades",
      },
      {
        title: "Outsourcing",
        accent: "de atención al cliente",
        description: "Equipos especializados de atención al cliente para organizaciones que externalizan parte o toda su operación de soporte.",
        bullets: ["Equipos dedicados", "Atención para empresas de tecnología, retail y finanzas", "Formación y supervisión del equipo"],
        link: "Conoce el servicio",
      },
      {
        title: "Formación",
        accent: "corporativa",
        description: "Programas de soft skills y liderazgo adaptados a las necesidades de cada organización.",
        bullets: ["Liderazgo y comunicación", "Gestión de equipos", "Cursos presenciales y en línea"],
        link: "Conoce el servicio",
      },
    ],
    processEyebrow: "El proceso",
    processHeading: ["Cómo trabajamos", "con tu equipo."],
    processDescription: "Acompañamos cada búsqueda de talento con un proceso personalizado, desde la comprensión de la necesidad hasta la presentación de perfiles y el seguimiento.",
    steps: [
      { title: "Briefing", description: "Entendemos tus necesidades específicas de talento o formación." },
      { title: "Análisis", description: "Definimos el perfil y los criterios de búsqueda junto con la organización." },
      { title: "Selección", description: "El equipo de consultoría identifica y presenta perfiles relevantes." },
      { title: "Seguimiento", description: "Acompañamos a la organización durante las etapas del proceso." },
    ],
    phases: [
      { title: "Necesidad", description: "Alineamos el objetivo y el perfil con la organización." },
      { title: "Búsqueda", description: "Iniciamos un proceso de selección adaptado al encargo." },
      { title: "Presentación", description: "Compartimos perfiles para su valoración por el cliente." },
      { title: "Acompañamiento", description: "Damos seguimiento a las siguientes etapas del proceso." },
    ],
    sectorEyebrow: "Experiencia sectorial",
    sectorHeading: ["Doce años de red.", "Tres sectores clave."],
    sectorDescription: "Nexova acompaña principalmente a empresas medianas de tecnología, retail y servicios financieros en sus necesidades de talento.",
    sectorLink: "Inicia una conversación",
    sectors: [
      { title: "Tecnología", description: "Startups y scale-ups que necesitan talento técnico y soporte de calidad a escala." },
      { title: "Retail", description: "Cadenas con alta rotación que requieren procesos de selección rápidos y eficientes." },
      { title: "Servicios financieros", description: "Entidades que necesitan perfiles especializados y cumplimiento normativo en selección." },
    ],
    technologyEyebrow: "Por qué Nexova",
    technologyHeading: ["Experiencia en talento.", "Presencia internacional."],
    technologyDescription: "Combinamos conocimiento de selección y formación con una presencia en España y Estados Unidos para acompañar a empresas y profesionales.",
    technologyPoints: ["Tecnología", "Retail", "Servicios financieros"],
    technologyStats: [
      { value: "2011", description: "Año de fundación de Nexova." },
      { value: "≈120", description: "Profesionales en el equipo, según el contexto de empresa." },
      { value: "3", description: "Líneas de negocio: selección, soporte y formación." },
      { value: "ES · USA", description: "Presencia en Valencia y Miami." },
    ],
    ctaEyebrow: "Hablemos",
    ctaHeading: ["¿Listo para formar parte", "del equipo Nexova?"],
    ctaDescription: "Únete a nuestro banco de talento y comparte tu perfil para futuras oportunidades.",
    backToTop: "Volver al inicio",
    footerDescription: "Consultoría de recursos humanos y adquisición de talento, con presencia en Valencia y Miami.",
    servicesTitle: "Servicios",
    contactTitle: "Contacto",
  },
  en: {
    heroEyebrow: "Since 2011 · Valencia & Miami",
    heroDescription: "A human resources and talent acquisition consultancy with experience dating back to 2011, helping technology, retail, and financial services companies find and develop talent.",
    apply: "Join our talent pool",
    servicesLink: "View services",
    statLabels: ["Professionals", "Founded", "Presence"],
    orbitLabels: ["Executive search", "Customer support", "Corporate training"],
    servicesEyebrow: "What we do",
    servicesHeading: ["Three business lines,", "one common goal."],
    servicesNote: "We help organizations find, develop, and support the talent they need.",
    services: [
      {
        title: "Executive",
        accent: "headhunting",
        description: "Personalized search and recruitment for executive and mid-level profiles, from briefing through candidate presentation.",
        bullets: ["Executive and mid-level profiles", "Tailored recruitment process", "Support throughout the search"],
        link: "Explore opportunities",
      },
      {
        title: "Customer",
        accent: "support outsourcing",
        description: "Specialized customer support teams for organizations outsourcing part or all of their support operations.",
        bullets: ["Dedicated teams", "Support for technology, retail, and finance companies", "Team training and supervision"],
        link: "Explore the service",
      },
      {
        title: "Corporate",
        accent: "training",
        description: "Soft skills and leadership programs tailored to each organization's needs.",
        bullets: ["Leadership and communication", "Team management", "In-person and online courses"],
        link: "Explore the service",
      },
    ],
    processEyebrow: "The process",
    processHeading: ["How we work", "with your team."],
    processDescription: "We support each talent search through a tailored process, from understanding the need to presenting profiles and following up.",
    steps: [
      { title: "Briefing", description: "We understand your specific talent or training needs." },
      { title: "Analysis", description: "We define the profile and search criteria with the organization." },
      { title: "Selection", description: "Our consultants identify and present relevant profiles." },
      { title: "Follow-up", description: "We support the organization throughout the process." },
    ],
    phases: [
      { title: "Needs", description: "We align goals and profiles with the organization." },
      { title: "Search", description: "We begin a recruitment process tailored to the brief." },
      { title: "Presentation", description: "We share profiles for the client to consider." },
      { title: "Support", description: "We follow up through the next stages of the process." },
    ],
    sectorEyebrow: "Industry experience",
    sectorHeading: ["Twelve years of reach.", "Three key industries."],
    sectorDescription: "Nexova primarily supports mid-sized technology, retail, and financial services companies with their talent needs.",
    sectorLink: "Start a conversation",
    sectors: [
      { title: "Technology", description: "Startups and scale-ups that need technical talent and high-quality support at scale." },
      { title: "Retail", description: "Retail chains with high turnover that need fast, efficient hiring processes." },
      { title: "Financial services", description: "Organizations that need specialized profiles and compliant hiring." },
    ],
    technologyEyebrow: "Why Nexova",
    technologyHeading: ["Talent experience.", "International presence."],
    technologyDescription: "We combine recruitment and training expertise with a presence in Spain and the United States to support companies and professionals.",
    technologyPoints: ["Technology", "Retail", "Financial services"],
    technologyStats: [
      { value: "2011", description: "The year Nexova was founded." },
      { value: "≈120", description: "Team members, according to the company context." },
      { value: "3", description: "Business lines: recruitment, support, and training." },
      { value: "ES · USA", description: "Presence in Valencia and Miami." },
    ],
    ctaEyebrow: "Get in touch",
    ctaHeading: ["Ready to join", "the Nexova team?"],
    ctaDescription: "Join our talent pool and share your profile for future opportunities.",
    backToTop: "Back to top",
    footerDescription: "Human resources and talent acquisition consultancy, with a presence in Valencia and Miami.",
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
    let animationFrame = 0;
    try {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("is-visible", entry.isIntersecting);
        });
      }, { threshold: 0.01, rootMargin: "0px 0px 48px 0px" });
      elements.forEach((element) => element.classList.remove("is-visible"));
      document.documentElement.classList.add("has-reveal");
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = window.requestAnimationFrame(() => {
          elements.forEach((element) => observer.observe(element));
        });
      });
    } catch {
      elements.forEach((element) => element.classList.add("is-visible"));
      document.documentElement.classList.remove("has-reveal");
      return;
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      elements.forEach((element) => element.classList.remove("is-visible"));
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
                {language === "es" ? <>Construimos equipos <em>excepcionales</em> para empresas en crecimiento</> : <>We build <em>exceptional teams</em> for growing businesses</>}
              </h1>
              <p className="hero-intro">{t.heroDescription}</p>
              <div className="hero-actions">
                <Link className="button button-gold" href="/application">{t.apply}<span aria-hidden="true">↗</span></Link>
                <a className="button button-outline" href="#servicios">{t.servicesLink}</a>
              </div>
              <div className="stats" aria-label={language === "es" ? "Nexova en cifras" : "Nexova in numbers"}>
                <div><strong>120<span>+</span></strong><span>{t.statLabels[0]}</span></div>
                <div><strong>2011</strong><span>{t.statLabels[1]}</span></div>
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
              <div><SectionTitle eyebrow={t.servicesEyebrow} id="services-title">{t.servicesHeading[0]}<br /><em>{t.servicesHeading[1]}</em></SectionTitle></div>
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
              <SectionTitle eyebrow={t.processEyebrow} id="process-title">{t.processHeading[0]}<br /><em>{t.processHeading[1]}</em></SectionTitle>
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
              <SectionTitle eyebrow={t.sectorEyebrow} id="industry-title">{t.sectorHeading[0]}<br /><em>{t.sectorHeading[1]}</em></SectionTitle>
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
            <div data-reveal><SectionTitle eyebrow={t.technologyEyebrow} id="technology-title">{t.technologyHeading[0]}<br /><em>{t.technologyHeading[1]}</em></SectionTitle></div>
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
            <div><SectionTitle eyebrow={language === "es" ? "Banco de Talento" : "Talent Pool"} id="cta-title">{language === "es" ? "Únete al equipo Nexova" : "Join the Nexova team"}</SectionTitle></div>
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