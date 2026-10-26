"use client";

import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { useEffect, useRef, useState } from "react";
import { useSitePreferences, type Language } from "@/lib/site-preferences";

type Values = {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  linkedin: string;
  yearsExp: string;
  englishLevel: string;
  sector: string;
  availability: string;
  comments: string;
  acceptTerms: boolean;
};
type Field = keyof Values;
type Errors = Partial<Record<Field, string>>;

const emptyValues: Values = {
  fullName: "",
  email: "",
  phone: "",
  country: "",
  linkedin: "",
  yearsExp: "",
  englishLevel: "",
  sector: "",
  availability: "",
  comments: "",
  acceptTerms: false,
};

const text = {
  es: {
    home: "Inicio", form: "Formulario", dark: "Modo oscuro", light: "Modo claro",
    talentPool: "Banco de Talento", title: "Únete al equipo Nexova",
    intro: "Regístrate en nuestro banco de talento y te contactaremos cuando tengamos una oportunidad que encaje con tu perfil.",
    employer: "¿Eres una empresa buscando talento? Escríbenos a", goToForm: "Ir al formulario",
    contactStep: "Datos de contacto", profileStep: "Perfil profesional", fullName: "Nombre completo",
    email: "Correo electrónico", phone: "Teléfono", country: "País de residencia", linkedin: "LinkedIn",
    optional: "(opcional)", selectCountry: "Selecciona tu país", spain: "España", usa: "Estados Unidos", other: "Otro",
    years: "Años de experiencia", english: "Nivel de inglés", selectLevel: "Selecciona tu nivel",
    basic: "Básico", intermediate: "Intermedio", advanced: "Avanzado", native: "Nativo",
    sector: "Sector de interés", selectSector: "Selecciona un sector", technology: "Tecnología",
    retail: "Retail", finance: "Servicios Financieros", consulting: "Consultoría", availability: "Disponibilidad",
    immediate: "Inmediata", oneMonth: "1 mes", twoThreeMonths: "2-3 meses", exploring: "Solo explorando",
    comments: "Comentarios adicionales", commentPlaceholder: "Cuéntanos más sobre tu trayectoria, motivaciones o cualquier otro detalle...",
    accept: "Acepto la", privacy: "política de tratamiento de datos",
    consent: "de Nexova Solutions y autorizo el uso de mi información para el proceso de selección.",
    clear: "Limpiar", previous: "← Anterior", next: "Siguiente →", submit: "Enviar registro", sending: "Enviando...",
    emailForCompanies: "hola@nexovasolutions.com", closePolicy: "Cerrar política de tratamiento de datos",
    policy: "Política de tratamiento de datos", policyIntro: "En Nexova Solutions tratamos tus datos personales con la finalidad de gestionar tu candidatura, evaluar tu perfil profesional y contactar contigo para procesos de selección actuales o futuros.",
    policySections: [
      ["1. Responsable del tratamiento", "Nexova Solutions S.L., con oficinas en Valencia (España) y Miami (EE. UU.), actúa como responsable del tratamiento de la información que compartes en este formulario."],
      ["2. Finalidad", "Usaremos tus datos para analizar tu experiencia, validar tu encaje con vacantes, mantenerte en nuestro banco de talento y enviarte comunicaciones relacionadas con oportunidades laborales."],
      ["3. Base legal", "La base legal del tratamiento es tu consentimiento explícito al aceptar esta política y enviar voluntariamente tu solicitud."],
      ["4. Conservación", "Conservaremos tus datos durante el tiempo necesario para cumplir la finalidad indicada o hasta que solicites su supresión, salvo obligaciones legales que exijan su conservación por más tiempo."],
      ["5. Derechos", "Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a hola@nexovasolutions.com, indicando en el asunto ‘Protección de datos’."],
      ["6. Seguridad", "Aplicamos medidas técnicas y organizativas apropiadas para proteger tus datos frente a accesos no autorizados, alteración, pérdida o destrucción."],
    ],
    thanks: "¡Gracias por tu interés en Nexova!", received: "Hemos recibido tu información. Nuestro equipo de selección la revisará y te contactaremos en caso de que tu perfil encaje con alguna de nuestras oportunidades actuales o futuras.",
    follow: "Mientras tanto, síguenos en", forUpdates: "para estar al día de nuestras vacantes y contenido sobre desarrollo profesional.",
    backHome: "Volver al inicio", errors: {
      fullName: "El nombre debe contener al menos nombre y apellido.",
      email: "Ingresa un email válido (ejemplo: nombre@empresa.com).",
      phone: "El teléfono debe incluir código de país (ejemplo: +34 612 345 678).",
      country: "Selecciona tu país de residencia.", linkedin: "Introduce una URL válida de LinkedIn.",
      yearsExp: "Los años de experiencia deben estar entre 0 y 50.", englishLevel: "Indica tu nivel de inglés.",
      sector: "Selecciona el sector de tu interés.", availability: "Selecciona tu disponibilidad.",
      comments: "Los comentarios no pueden exceder 500 caracteres.", acceptTerms: "Debes aceptar la política de tratamiento de datos para continuar.",
    },
  },
  en: {
    home: "Home", form: "Form", dark: "Dark mode", light: "Light mode",
    talentPool: "Talent Pool", title: "Join the Nexova team",
    intro: "Register in our talent pool and we will contact you when an opportunity matches your profile.",
    employer: "Are you a company looking for talent? Write to us at", goToForm: "Go to form", contactStep: "Contact details",
    profileStep: "Professional profile", fullName: "Full name", email: "Email address", phone: "Phone",
    country: "Country of residence", linkedin: "LinkedIn", optional: "(optional)", selectCountry: "Select your country",
    spain: "Spain", usa: "United States", other: "Other", years: "Years of experience", english: "English level",
    selectLevel: "Choose your level", basic: "Basic", intermediate: "Intermediate", advanced: "Advanced", native: "Native",
    sector: "Industry of interest", selectSector: "Choose an industry", technology: "Technology", retail: "Retail",
    finance: "Financial services", consulting: "Consulting", availability: "Availability", immediate: "Immediate",
    oneMonth: "1 month", twoThreeMonths: "2-3 months", exploring: "Just exploring", comments: "Additional comments",
    commentPlaceholder: "Tell us more about your background, motivations, or anything else...", accept: "I accept the",
    privacy: "data processing policy", consent: "of Nexova Solutions and authorize the use of my information for recruitment.",
    clear: "Clear", previous: "← Previous", next: "Next →", submit: "Submit application", sending: "Sending...",
    emailForCompanies: "hola@nexovasolutions.com", closePolicy: "Close data processing policy", policy: "Data processing policy",
    policyIntro: "At Nexova Solutions, we process your personal data to manage your application, evaluate your professional profile, and contact you about current or future recruitment processes.",
    policySections: [
      ["1. Data controller", "Nexova Solutions S.L., with offices in Valencia (Spain) and Miami (U.S.), acts as the data controller for the information you share in this form."],
      ["2. Purpose", "We use your data to review your experience, assess your fit for vacancies, keep you in our talent pool, and contact you about job opportunities."],
      ["3. Legal basis", "The legal basis for processing is your consent when accepting this policy and voluntarily submitting your application."],
      ["4. Retention", "We retain your data for as long as necessary to fulfill the stated purpose or until you request deletion, unless legal obligations require longer retention."],
      ["5. Your rights", "You may exercise your data rights by writing to hola@nexovasolutions.com with ‘Data protection’ in the subject line."],
      ["6. Security", "We apply appropriate technical and organizational measures to protect your data against unauthorized access, alteration, loss, or destruction."],
    ],
    thanks: "Thanks for your interest in Nexova!", received: "We have received your information. Our recruitment team will review it and contact you if your profile matches one of our current or future opportunities.",
    follow: "In the meantime, follow us on", forUpdates: "for updates about our vacancies and professional development content.",
    backHome: "Back to home", errors: {
      fullName: "Enter at least your first and last name.", email: "Enter a valid email address (example: name@company.com).",
      phone: "Include a country code in your phone number (example: +1 305 555 0100).", country: "Select your country of residence.",
      linkedin: "Enter a valid LinkedIn URL.", yearsExp: "Years of experience must be between 0 and 50.",
      englishLevel: "Select your English level.", sector: "Select your industry of interest.", availability: "Select your availability.",
      comments: "Comments cannot exceed 500 characters.", acceptTerms: "You must accept the data processing policy to continue.",
    },
  },
} as const;

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function ApplicationForm() {
  const { language, theme, setLanguage, toggleTheme } = useSitePreferences();
  const isDark = theme === "dark";
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<Values>(emptyValues);
  const [errors, setErrors] = useState<Errors>({});
  const [policyOpen, setPolicyOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const closePolicyRef = useRef<HTMLButtonElement>(null);
  const t = text[language];

  useEffect(() => {
    if (!policyOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    closePolicyRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPolicyOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("overflow-hidden");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("overflow-hidden");
      previousFocus?.focus();
    };
  }, [policyOpen]);

  const update = (field: Field, value: string | boolean) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validateContact = () => {
    const next: Errors = {};
    if (values.fullName.trim().split(/\s+/).filter(Boolean).length < 2) next.fullName = t.errors.fullName;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) next.email = t.errors.email;
    if (!/^\+\d[\d\s().-]{6,}$/.test(values.phone.trim())) next.phone = t.errors.phone;
    if (!values.country) next.country = t.errors.country;
    if (values.linkedin && !isValidUrl(values.linkedin)) next.linkedin = t.errors.linkedin;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateProfile = () => {
    const next: Errors = {};
    const years = Number(values.yearsExp);
    if (values.yearsExp === "" || !Number.isFinite(years) || years < 0 || years > 50) next.yearsExp = t.errors.yearsExp;
    if (!values.englishLevel) next.englishLevel = t.errors.englishLevel;
    if (!values.sector) next.sector = t.errors.sector;
    if (!values.availability) next.availability = t.errors.availability;
    if (values.comments.length > 500) next.comments = t.errors.comments;
    if (!values.acceptTerms) next.acceptTerms = t.errors.acceptTerms;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const clearContact = () => {
    setValues((current) => ({ ...current, fullName: "", email: "", phone: "", country: "", linkedin: "" }));
    setErrors((current) => ({ ...current, fullName: undefined, email: undefined, phone: undefined, country: undefined, linkedin: undefined }));
  };

  const clearProfile = () => {
    setValues((current) => ({ ...current, yearsExp: "", englishLevel: "", sector: "", availability: "", comments: "", acceptTerms: false }));
    setErrors((current) => ({ ...current, yearsExp: undefined, englishLevel: undefined, sector: undefined, availability: undefined, comments: undefined, acceptTerms: undefined }));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateProfile()) return;
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      setSuccess(true);
    }, 1200);
  };

  const fieldError = (field: Field) => errors[field] ? (
    <p className="error-message visible" id={`${field}-error`} role="alert" aria-live="polite">{errors[field]}</p>
  ) : <p className="error-message" id={`${field}-error`} role="alert" aria-live="polite" />;

  return (
    <div className="application-page">
      <header className="application-header border-b border-slate-300/80 bg-slate-100/90 backdrop-blur-md dark:border-white/5 dark:bg-navy-950/90">
        <div className="mx-auto flex h-16 max-w-[92rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
          <Link className="brand" href="/" aria-label="Nexova Solutions — Inicio">
            <span className="brand-mark">N</span><span>Nexova <b>Solutions</b></span>
          </Link>
          <nav className="flex items-center gap-3 text-xs font-medium text-slate-700 dark:text-gray-300 sm:gap-5 sm:text-sm" aria-label="Navegación del formulario">
            <Link href="/">{t.home}</Link><a href="#form">{t.form}</a>
          </nav>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="languageToggle">Seleccionar idioma</label>
            <select id="languageToggle" className="rounded-sm border border-slate-300 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-700 dark:border-white/15 dark:bg-navy-900 dark:text-gray-200" value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
              <option value="es">🇪🇸 {language === "es" ? "Español" : "Spanish"}</option>
              <option value="en">🇺🇸 English</option>
            </select>
            <button className="inline-flex items-center gap-2 rounded-sm border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-gold-400 hover:text-gold-500 dark:border-white/15 dark:text-gray-200" type="button" onClick={toggleTheme} aria-pressed={isDark} aria-label={isDark ? t.light : t.dark}>
              <span aria-hidden="true">{isDark ? "☼" : "☾"}</span><span className="hidden sm:inline">{isDark ? t.light : t.dark}</span>
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="application-main">
        <section id="form" className="application-form-stage" aria-labelledby="application-title">
          <div className="application-form-container">
            <Link className="application-back" href="/"><span aria-hidden="true">←</span> {t.backHome}</Link>
            <h1 id="application-title" className="application-form-title">{t.form}</h1>
            <div className="mb-2 flex items-center px-2" role="progressbar" aria-label={t.form} aria-valuenow={step} aria-valuemin={1} aria-valuemax={2}>
              <div className={`step-dot ${step === 1 ? "active" : "done"}`}>{step > 1 ? "✓" : "1"}</div><div className={`step-line ${step > 1 ? "done" : ""}`} /><div className={`step-dot ${step === 2 ? "active" : "pending"}`}>2</div>
            </div>
            <div className="mb-3 flex justify-between px-1 text-xs text-slate-500 dark:text-gray-400"><span className={step === 1 ? "font-semibold text-slate-700 dark:text-gray-200" : ""}>{t.contactStep}</span><span className={step === 2 ? "font-semibold text-slate-700 dark:text-gray-200" : ""}>{t.profileStep}</span></div>

            <form noValidate aria-label="Formulario de registro de talento Nexova Solutions" onSubmit={submit}>
              {step === 1 ? (
                <div className="step-panel active">
                  <div className="form-card space-y-3 rounded-xl border border-slate-300/70 bg-slate-50 p-4 shadow-sm dark:border-white/10 dark:bg-navy-900">
                    <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">{t.contactStep}</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><label className="field-label" htmlFor="fullName">{t.fullName} <span>*</span></label><input className={`field-base${errors.fullName ? " error" : ""}`} id="fullName" autoComplete="name" value={values.fullName} onChange={(event) => update("fullName", event.target.value)} onBlur={() => values.fullName && setErrors((current) => ({ ...current, fullName: values.fullName.trim().split(/\s+/).length < 2 ? t.errors.fullName : undefined }))} aria-describedby="fullName-error" aria-invalid={Boolean(errors.fullName)} placeholder={language === "es" ? "Laura Mendoza García" : "Laura Mendoza"} />{fieldError("fullName")}</div>
                      <div><label className="field-label" htmlFor="email">{t.email} <span>*</span></label><input className={`field-base${errors.email ? " error" : ""}`} id="email" type="email" autoComplete="email" value={values.email} onChange={(event) => update("email", event.target.value)} onBlur={() => values.email && setErrors((current) => ({ ...current, email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim()) ? undefined : t.errors.email }))} aria-describedby="email-error" aria-invalid={Boolean(errors.email)} placeholder="laura@ejemplo.com" />{fieldError("email")}</div>
                      <div><label className="field-label" htmlFor="phone">{t.phone} <span>*</span></label><input className={`field-base${errors.phone ? " error" : ""}`} id="phone" type="tel" autoComplete="tel" value={values.phone} onChange={(event) => update("phone", event.target.value)} onBlur={() => values.phone && setErrors((current) => ({ ...current, phone: /^\+\d[\d\s().-]{6,}$/.test(values.phone.trim()) ? undefined : t.errors.phone }))} aria-describedby="phone-error" aria-invalid={Boolean(errors.phone)} placeholder={language === "es" ? "+34 612 345 678" : "+1 305 555 0100"} />{fieldError("phone")}</div>
                      <div><label className="field-label" htmlFor="country">{t.country} <span>*</span></label><select className={`field-base${errors.country ? " error" : ""}`} id="country" value={values.country} onChange={(event) => update("country", event.target.value)} aria-describedby="country-error" aria-invalid={Boolean(errors.country)}><option value="">{t.selectCountry}</option><option value="españa">{t.spain}</option><option value="estados-unidos">{t.usa}</option><option value="otro">{t.other}</option></select>{fieldError("country")}</div>
                    </div>
                    <div><label className="field-label" htmlFor="linkedin">{t.linkedin} <span className="optional-label">{t.optional}</span></label><input className={`field-base${errors.linkedin ? " error" : ""}`} id="linkedin" type="url" value={values.linkedin} onChange={(event) => update("linkedin", event.target.value)} onBlur={() => values.linkedin && setErrors((current) => ({ ...current, linkedin: isValidUrl(values.linkedin) ? undefined : t.errors.linkedin }))} aria-describedby="linkedin-error" aria-invalid={Boolean(errors.linkedin)} placeholder="https://linkedin.com/in/tu-perfil" />{fieldError("linkedin")}</div>
                  </div>
                  <div className="mt-3 flex justify-between">
                    <button type="button" className="form-secondary" onClick={clearContact}>{t.clear}</button>
                    <button type="button" className="form-primary" onClick={() => validateContact() && setStep(2)}>{t.next}</button>
                  </div>
                </div>
              ) : (
                <div className="step-panel active">
                  <div className="form-card space-y-3 rounded-xl border border-slate-300/70 bg-slate-50 p-4 shadow-sm dark:border-white/10 dark:bg-navy-900">
                    <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">{t.profileStep}</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><label className="field-label" htmlFor="yearsExp">{t.years} <span>*</span></label><input className={`field-base${errors.yearsExp ? " error" : ""}`} id="yearsExp" type="number" min="0" max="50" value={values.yearsExp} onChange={(event) => update("yearsExp", event.target.value)} aria-describedby="yearsExp-error" aria-invalid={Boolean(errors.yearsExp)} placeholder="5" />{fieldError("yearsExp")}</div>
                      <div><label className="field-label" htmlFor="englishLevel">{t.english} <span>*</span></label><select className={`field-base${errors.englishLevel ? " error" : ""}`} id="englishLevel" value={values.englishLevel} onChange={(event) => update("englishLevel", event.target.value)} aria-describedby="englishLevel-error" aria-invalid={Boolean(errors.englishLevel)}><option value="">{t.selectLevel}</option><option value="basico">{t.basic}</option><option value="intermedio">{t.intermediate}</option><option value="avanzado">{t.advanced}</option><option value="nativo">{t.native}</option></select>{fieldError("englishLevel")}</div>
                    </div>
                    <div><label className="field-label" htmlFor="sector">{t.sector} <span>*</span></label><select className={`field-base${errors.sector ? " error" : ""}`} id="sector" value={values.sector} onChange={(event) => update("sector", event.target.value)} aria-describedby="sector-error" aria-invalid={Boolean(errors.sector)}><option value="">{t.selectSector}</option><option value="tecnologia">{t.technology}</option><option value="retail">{t.retail}</option><option value="servicios-financieros">{t.finance}</option><option value="consultoria">{t.consulting}</option><option value="otro">{t.other}</option></select>{fieldError("sector")}</div>
                    <fieldset>
                      <legend className="field-label">{t.availability} <span>*</span></legend>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {[["inmediata", t.immediate], ["1-mes", t.oneMonth], ["2-3-meses", t.twoThreeMonths], ["solo-explorando", t.exploring]].map(([value, label]) => <label className="availability-choice" key={value}><input type="radio" name="availability" value={value} checked={values.availability === value} onChange={(event) => update("availability", event.target.value)} /><span>{label}</span></label>)}
                      </div>{fieldError("availability")}
                    </fieldset>
                    <div>
                      <div className="mb-1 flex items-baseline justify-between"><label className="field-label mb-0" htmlFor="comments">{t.comments} <span className="optional-label">{t.optional}</span></label><span className="text-xs tabular-nums text-slate-400">{values.comments.length}/500</span></div>
                      <textarea className={`field-base min-h-12 resize-none${errors.comments ? " error" : ""}`} id="comments" rows={1} maxLength={500} value={values.comments} onChange={(event) => update("comments", event.target.value)} aria-describedby="comments-error" aria-invalid={Boolean(errors.comments)} placeholder={t.commentPlaceholder} />{fieldError("comments")}
                    </div>
                    <div>
                      <div className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 ${errors.acceptTerms ? "border-red-500 bg-red-50/40 dark:border-red-400/80 dark:bg-red-500/10" : "border-slate-200/80 dark:border-white/10"}`}>
                        <input className="mt-0.5 h-4 w-4 accent-gold-400" id="acceptTerms" type="checkbox" checked={values.acceptTerms} onChange={(event) => update("acceptTerms", event.target.checked)} aria-describedby="acceptTerms-error" aria-invalid={Boolean(errors.acceptTerms)} />
                        <label className="text-xs leading-relaxed text-slate-700 dark:text-gray-300" htmlFor="acceptTerms">{t.accept} <button type="button" className="font-semibold text-gold-500 underline dark:text-gold-300" onClick={() => setPolicyOpen(true)}>{t.privacy}</button> {t.consent} <span className="text-gold-400">*</span></label>
                      </div>{fieldError("acceptTerms")}
                    </div>
                  </div>
                  <div className="mt-3 flex justify-between">
                    <button type="button" className="form-secondary" onClick={() => setStep(1)}>{t.previous}</button>
                    <div className="flex gap-3"><button type="button" className="form-secondary" onClick={clearProfile}>{t.clear}</button><button type="submit" className="form-primary" disabled={submitting}>{submitting ? t.sending : t.submit}</button></div>
                  </div>
                </div>
              )}
            </form>
          </div>
        </section>
      </main>

      <SiteFooter />

      {policyOpen && (
        <div className="policy-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPolicyOpen(false)}>
          <section className="policy-dialog" role="dialog" aria-modal="true" aria-labelledby="policy-title" aria-describedby="policy-description">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-white/10"><h2 id="policy-title" className="font-display text-xl font-bold text-slate-900 dark:text-white">{t.policy}</h2><button ref={closePolicyRef} type="button" className="form-close" onClick={() => setPolicyOpen(false)} aria-label={t.closePolicy}>×</button></div>
            <div id="policy-description" className="max-h-[calc(85vh-5rem)] space-y-4 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-slate-700 dark:text-gray-300"><p>{t.policyIntro}</p>{t.policySections.map(([heading, body]) => <div key={heading}><h3 className="mb-1 font-semibold text-slate-900 dark:text-white">{heading}</h3><p>{body}</p></div>)}</div>
          </section>
        </div>
      )}

      {success && (
        <div className="success-overlay" role="dialog" aria-modal="true" aria-labelledby="success-title">
          <div className="mx-auto max-w-md px-6 text-center">
            <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full border-2 border-gold-400 bg-gold-400/10 text-4xl text-gold-400" aria-hidden="true">✓</div>
            <h2 id="success-title" className="mb-4 font-display text-3xl font-bold text-white">{t.thanks}</h2>
            <p className="mb-3 leading-relaxed text-slate-300">{t.received}</p>
            <p className="mb-8 text-sm text-slate-400">{t.follow} <a className="text-gold-400 underline" href="https://linkedin.com/company/nexova-solutions" target="_blank" rel="noopener noreferrer">LinkedIn</a> {t.forUpdates}</p>
            <Link className="form-primary inline-block" href="/">{t.backHome}</Link>
          </div>
        </div>
      )}
    </div>
  );
}