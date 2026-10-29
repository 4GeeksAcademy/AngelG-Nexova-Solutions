"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { useSitePreferences } from "@/lib/site-preferences";

type Values = {
  full_name: string;
  email: string;
  phone: string;
  country: string;
  position: string;
  experience_years: string;
  sector: string;
  english_level: string;
  availability: string;
  linkedin_url: string;
  comments: string;
  acceptTerms: boolean;
};

type Field = Exclude<keyof Values, "acceptTerms">;
type ErrorField = keyof Values;
type Step = 1 | 2 | 3;

const emptyValues: Values = {
  full_name: "",
  email: "",
  phone: "",
  country: "",
  position: "",
  experience_years: "",
  sector: "",
  english_level: "",
  availability: "",
  linkedin_url: "",
  comments: "",
  acceptTerms: false,
};

const copy = {
  es: {
    home: "Inicio", form: "Registro en el banco de talento", title: "Únete a nuestro banco de talento",
    intro: "Comparte tu perfil profesional en unos sencillos pasos. Nuestro equipo de selección lo tendrá en cuenta para oportunidades actuales o futuras.",
    steps: ["Contacto", "Perfil", "Revisión"],
    full_name: "Nombre completo", email: "Correo electrónico", phone: "Teléfono", country: "País de residencia",
    position: "Puesto o perfil profesional",
    experience_years: "Años de experiencia", sector: "Sector de interés", english_level: "Nivel de inglés",
    availability: "Disponibilidad", linkedin_url: "LinkedIn (URL del perfil)", comments: "Comentarios adicionales",
    optional: "(opcional)", select: "Selecciona una opción", countries: ["España", "Estados Unidos", "Otro"],
    sectors: ["Tecnología", "Retail", "Servicios Financieros", "Consultoría", "Otro"],
    englishLevels: ["Básico", "Intermedio", "Avanzado", "Nativo"],
    availabilities: ["Inmediata", "1 mes", "2-3 meses", "Solo explorando"],
    commentsCount: (remaining: number) => `${remaining} caracteres disponibles`,
    consentIntro: "He leído y acepto la", privacy: "política de tratamiento de datos",
    privacyIntro: "Nexova Solutions tratará tus datos para gestionar tu candidatura, evaluar tu perfil y contactar contigo sobre procesos de selección actuales o futuros. Puedes ejercer tus derechos escribiendo a contacto@nexova.com.",
    consentEnd: "y autorizo el uso de mis datos para gestionar mi registro en el banco de talento.",
    back: "Anterior", next: "Continuar", submit: "Enviar perfil", sending: "Enviando…", clear: "Limpiar",
    thanks: "¡Gracias por tu interés en Nexova!",
    received: "Hemos recibido tu información. Nuestro equipo de selección la revisará y te contactaremos en caso de que tu perfil encaje con alguna de nuestras oportunidades actuales o futuras.",
    followLinkedIn: "Mientras tanto, síguenos en LinkedIn para estar al día de nuestras vacantes y contenido sobre desarrollo profesional.",
    backHome: "Volver al inicio", errorTitle: "No se pudo enviar el registro",
    error: "Inténtalo de nuevo más tarde. Si el problema continúa, ponte en contacto con Nexova.",
    company: "¿Eres una empresa buscando talento? Escríbenos a",
    errors: {
      full_name: "El nombre debe contener al menos nombre y apellido",
      email: "Ingresa un email válido (ejemplo: nombre@empresa.com)",
      phone: "El teléfono debe incluir código de país (ejemplo: +34 612 345 678)",
      country: "Selecciona tu país de residencia",
      position: "Indica tu puesto o perfil profesional",
      experience_years: "Los años de experiencia deben estar entre 0 y 50",
      sector: "Selecciona el sector de tu interés",
      english_level: "Indica tu nivel de inglés",
      availability: "Selecciona tu disponibilidad",
      linkedin_url: "Si incluyes LinkedIn, debe ser una URL válida",
      comments: (remaining: number) => `Los comentarios no pueden exceder 500 caracteres (quedan ${remaining})`,
      acceptTerms: "Debes aceptar la política de tratamiento de datos para continuar",
    },
  },
  en: {
    home: "Home", form: "Talent pool registration", title: "Join our talent pool",
    intro: "Share your professional profile in a few simple steps. Our recruitment team will consider it for current or future opportunities.",
    steps: ["Contact", "Profile", "Review"],
    full_name: "Full name", email: "Email address", phone: "Phone", country: "Country of residence",
    position: "Professional role or profile",
    experience_years: "Years of experience", sector: "Sector of interest", english_level: "English level",
    availability: "Availability", linkedin_url: "LinkedIn (profile URL)", comments: "Additional comments",
    optional: "(optional)", select: "Select an option", countries: ["Spain", "United States", "Other"],
    sectors: ["Technology", "Retail", "Financial Services", "Consulting", "Other"],
    englishLevels: ["Basic", "Intermediate", "Advanced", "Native"],
    availabilities: ["Immediate", "1 month", "2-3 months", "Just exploring"],
    commentsCount: (remaining: number) => `${remaining} characters remaining`,
    consentIntro: "I have read and accept the", privacy: "data processing policy",
    privacyIntro: "Nexova Solutions will process your data to manage your registration, assess your profile, and contact you about current or future recruitment processes. You may exercise your data rights by writing to contacto@nexova.com.",
    consentEnd: "and authorize the use of my data to manage my talent pool registration.",
    back: "Back", next: "Continue", submit: "Submit profile", sending: "Submitting…", clear: "Clear",
    thanks: "Thank you for your interest in Nexova!",
    received: "We have received your information. Our selection team will review it and contact you if your profile matches any of our current or future opportunities.",
    followLinkedIn: "In the meantime, follow us on LinkedIn to stay updated on our vacancies and professional development content.",
    backHome: "Back to home", errorTitle: "We couldn't submit your registration",
    error: "Please try again later. If the problem continues, contact Nexova.",
    company: "Are you a company looking for talent? Write to us at",
    errors: {
      full_name: "Name must contain at least first and last name",
      email: "Enter a valid email (example: name@company.com)",
      phone: "Phone must include country code (example: +34 612 345 678)",
      country: "Select your country of residence",
      position: "Enter your professional role or profile",
      experience_years: "Years of experience must be between 0 and 50",
      sector: "Select your sector of interest",
      english_level: "Indicate your English level",
      availability: "Select your availability",
      linkedin_url: "If you include LinkedIn, it must be a valid URL",
      comments: (remaining: number) => `Comments cannot exceed 500 characters (${remaining} remaining)`,
      acceptTerms: "You must accept the data processing policy to continue",
    },
  },
} as const;

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function ApplicationForm() {
  const { language } = useSitePreferences();
  const t = copy[language];
  const [values, setValues] = useState<Values>(emptyValues);
  const [errors, setErrors] = useState<Partial<Record<ErrorField, string>>>({});
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [failed, setFailed] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const validate = (fields: ErrorField[]) => {
    const next: Partial<Record<ErrorField, string>> = {};
    const check = (field: ErrorField, invalid: boolean) => {
      if (fields.includes(field) && invalid) {
        next[field] = field === "comments"
          ? t.errors.comments(500 - values.comments.length)
          : t.errors[field];
      }
    };
    check("full_name", values.full_name.trim().split(/\s+/).filter(Boolean).length < 2);
    check("email", !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim()));
    check("phone", !/^\+\d{1,3}[\s.-]?(?:\(?\d\)?[\s.-]?){6,14}\d$/.test(values.phone.trim()));
    check("country", !values.country);
    check("position", !values.position.trim());
    const years = Number(values.experience_years);
    check("experience_years", values.experience_years === "" || !Number.isInteger(years) || years < 0 || years > 50);
    check("sector", !values.sector);
    check("english_level", !values.english_level);
    check("availability", !values.availability);
    check("linkedin_url", Boolean(values.linkedin_url) && !isValidUrl(values.linkedin_url));
    check("comments", values.comments.length > 500);
    check("acceptTerms", !values.acceptTerms);
    setErrors((current) => ({ ...current, ...next, ...Object.fromEntries(fields.filter((field) => !(field in next)).map((field) => [field, undefined])) }));
    return Object.keys(next).length === 0;
  };

  const update = (field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFailed(false);
  };

  const fieldError = (field: ErrorField) => errors[field] ? (
    <p className="error-message visible" id={`${field}-error`} role="alert">{errors[field]}</p>
  ) : <p className="error-message" id={`${field}-error`} role="alert" />;

  const input = (field: Field, type = "text", optional = false) => (
    <div>
      <label className="field-label" htmlFor={field}>
        {t[field]} {optional ? <span className="optional-label">{t.optional}</span> : <span aria-hidden="true">*</span>}
      </label>
      <input
        className={`field-base${errors[field] ? " error" : ""}`}
        id={field}
        name={field}
        type={type}
        required={!optional}
        min={field === "experience_years" ? 0 : undefined}
        max={field === "experience_years" ? 50 : undefined}
        step={field === "experience_years" ? 1 : undefined}
        maxLength={field === "comments" ? 500 : undefined}
        autoComplete={field === "full_name" ? "name" : field === "email" ? "email" : field === "phone" ? "tel" : undefined}
        value={values[field]}
        onChange={(event) => update(field, event.target.value)}
        aria-describedby={`${field}-error`}
        aria-invalid={Boolean(errors[field])}
      />
      {fieldError(field)}
    </div>
  );

  const select = (field: "country" | "sector" | "english_level", options: readonly string[]) => (
    <div>
      <label className="field-label" htmlFor={field}>{t[field]} <span aria-hidden="true">*</span></label>
      <select
        className={`field-base${errors[field] ? " error" : ""}`}
        id={field}
        name={field}
        required
        value={values[field]}
        onChange={(event) => update(field, event.target.value)}
        aria-describedby={`${field}-error`}
        aria-invalid={Boolean(errors[field])}
      >
        <option value="">{t.select}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {fieldError(field)}
    </div>
  );

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate(["full_name", "email", "phone", "country", "position", "experience_years", "sector", "english_level", "availability", "linkedin_url", "comments", "acceptTerms"])) {
      setStep(3);
      return;
    }

    const website = String(new FormData(formRef.current ?? undefined).get("website") ?? "");
    setSubmitting(true);
    setFailed(false);
    try {
      const response = await fetch("/api/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: values.full_name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          position: values.position.trim(),
          experience_years: Number(values.experience_years),
          linkedin_url: values.linkedin_url.trim() || null,
          cv_url: null,
          country: values.country,
          sector: values.sector,
          english_level: values.english_level,
          availability: values.availability,
          comments: values.comments.trim(),
          accept_terms: values.acceptTerms,
          website,
        }),
      });
      if (!response.ok) throw new Error("Application submission failed");
      setSuccess(true);
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => {
    const fieldsByStep: Record<1 | 2, ErrorField[]> = {
      1: ["full_name", "email", "phone", "country"],
      2: ["position", "experience_years", "sector", "english_level", "availability", "linkedin_url", "comments"],
    };
    if (step < 3 && validate(fieldsByStep[step as 1 | 2])) setStep((step + 1) as Step);
  };

  const selectStep = (newStep: Step) => {
    if (newStep < step) setStep(newStep);
    else if (newStep === step + 1) nextStep();
  };

  return (
    <div className="application-page">
      <a className="skip-link" href="#main-content">{language === "es" ? "Saltar al contenido principal" : "Skip to main content"}</a>
      <SiteHeader page="application" />
      <main id="main-content" className="application-main">
        <section id="form" className="application-form-stage" aria-labelledby="application-title">
          <div className="application-form-container">
            <Link className="application-back" href="/"><span aria-hidden="true">←</span> {t.home}</Link>
            <h1 id="application-title" className="application-form-title">{t.title}</h1>
            <p className="mb-5 text-sm text-slate-600 dark:text-gray-300">{t.intro}</p>
            <ol className="mb-5 grid grid-cols-3 gap-2" aria-label={t.form}>
              {t.steps.map((label, index) => {
                const number = (index + 1) as Step;
                return (
                  <li key={label}>
                    <button type="button" onClick={() => selectStep(number)} aria-current={step === number ? "step" : undefined} className={`w-full border-b-2 px-1 pb-2 text-left text-xs sm:text-sm ${step === number ? "border-gold-400 font-semibold text-gold-500" : "border-slate-300 text-slate-500 dark:border-white/15 dark:text-gray-400"}`}>
                      <span className="mr-1">{number}.</span>{label}
                    </button>
                  </li>
                );
              })}
            </ol>
            <form ref={formRef} noValidate aria-label={t.form} onSubmit={submit}>
              {step === 1 && (
                <fieldset className="form-card space-y-3 rounded-xl border border-slate-300/70 bg-slate-50 p-4 shadow-sm dark:border-white/10 dark:bg-navy-900" aria-labelledby="application-title">
                  <legend className="sr-only">{t.steps[0]}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {input("full_name")}
                    {input("email", "email")}
                    {input("phone", "tel")}
                    {select("country", t.countries)}
                  </div>
                </fieldset>
              )}
              {step === 2 && (
                <fieldset className="form-card space-y-3 rounded-xl border border-slate-300/70 bg-slate-50 p-4 shadow-sm dark:border-white/10 dark:bg-navy-900" aria-labelledby="application-title">
                  <legend className="sr-only">{t.steps[1]}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {input("position")}
                    {input("experience_years", "number")}
                    {select("sector", t.sectors)}
                    {select("english_level", t.englishLevels)}
                    {input("linkedin_url", "url", true)}
                  </div>
                  <fieldset>
                    <legend className="field-label">{t.availability} <span aria-hidden="true">*</span></legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {t.availabilities.map((option) => (
                        <label key={option} className="flex items-center gap-2 text-sm text-slate-700 dark:text-gray-300">
                          <input type="radio" name="availability" value={option} checked={values.availability === option} onChange={(event) => update("availability", event.target.value)} className="accent-gold-400" aria-describedby="availability-error" />
                          {option}
                        </label>
                      ))}
                    </div>
                    {fieldError("availability")}
                  </fieldset>
                  <div>
                    <label className="field-label" htmlFor="comments">{t.comments} <span className="optional-label">{t.optional}</span></label>
                    <textarea className={`field-base min-h-24 resize-y${errors.comments ? " error" : ""}`} id="comments" name="comments" maxLength={500} value={values.comments} onChange={(event) => update("comments", event.target.value)} aria-describedby="comments-error comments-count" aria-invalid={Boolean(errors.comments)} />
                    {fieldError("comments")}
                    <p id="comments-count" className="mt-1 text-right text-xs text-slate-500 dark:text-gray-400" aria-live="polite">{t.commentsCount(500 - values.comments.length)}</p>
                  </div>
                </fieldset>
              )}
              {step === 3 && (
                <fieldset className="form-card space-y-3 rounded-xl border border-slate-300/70 bg-slate-50 p-4 shadow-sm dark:border-white/10 dark:bg-navy-900" aria-labelledby="application-title">
                  <legend className="sr-only">{t.steps[2]}</legend>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    {(["full_name", "email", "phone", "country", "position", "experience_years", "sector", "english_level", "availability", "linkedin_url", "comments"] as const).map((field) => (
                      <div key={field} className="min-w-0 border-b border-slate-200 pb-2 dark:border-white/10">
                        <dt className="font-semibold text-slate-700 dark:text-gray-300">{t[field]}</dt>
                        <dd className="mt-1 break-words text-slate-600 dark:text-gray-400">{field === "comments" ? values.comments || "—" : values[field] || "—"}</dd>
                        {fieldError(field)}
                      </div>
                    ))}
                  </dl>
                  <div>
                    <div className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 ${errors.acceptTerms ? "border-red-500 bg-red-50/40 dark:border-red-400/80 dark:bg-red-500/10" : "border-slate-200/80 dark:border-white/10"}`}>
                      <input className="mt-0.5 h-4 w-4 accent-gold-400" id="acceptTerms" name="acceptTerms" type="checkbox" checked={values.acceptTerms} onChange={(event) => { setValues((current) => ({ ...current, acceptTerms: event.target.checked })); setErrors((current) => ({ ...current, acceptTerms: undefined })); }} aria-describedby="acceptTerms-error" aria-invalid={Boolean(errors.acceptTerms)} />
                      <label className="text-xs leading-relaxed text-slate-700 dark:text-gray-300" htmlFor="acceptTerms">
                        {t.consentIntro} <button type="button" className="font-semibold text-gold-500 underline dark:text-gold-300" onClick={() => setPolicyOpen(true)}>{t.privacy}</button> {t.consentEnd} <span className="text-gold-400">*</span>
                      </label>
                    </div>
                    {fieldError("acceptTerms")}
                  </div>
                </fieldset>
              )}
              <div className="sr-only" aria-hidden="true">
                <label htmlFor="website">Leave this field empty</label>
                <input id="website" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <p className="mt-4 text-sm text-slate-600 dark:text-gray-300">{t.company} <a className="font-semibold underline" href="mailto:contacto@nexova.com">contacto@nexova.com</a>.</p>
              {failed && <p className="error-message visible mt-3" role="alert">{t.errorTitle}. {t.error}</p>}
              <div className="mt-3 flex flex-wrap justify-between gap-3">
                <div className="flex gap-3">
                  {step > 1 && <button type="button" className="form-secondary" onClick={() => setStep((step - 1) as Step)}>{t.back}</button>}
                  <button type="reset" className="form-secondary" onClick={() => { setValues(emptyValues); setErrors({}); setStep(1); setFailed(false); }}>{t.clear}</button>
                </div>
                {step < 3 ? <button type="button" className="form-primary" onClick={nextStep}>{t.next}</button> : <button type="submit" className="form-primary" disabled={submitting}>{submitting ? t.sending : t.submit}</button>}
              </div>
            </form>
          </div>
        </section>
      </main>
      <SiteFooter />
      {policyOpen && (
        <div className="policy-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPolicyOpen(false)}>
          <section className="policy-dialog" role="dialog" aria-modal="true" aria-labelledby="policy-title">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <h2 id="policy-title" className="font-display text-xl font-bold text-slate-900 dark:text-white">{t.privacy}</h2>
              <button type="button" className="form-close" onClick={() => setPolicyOpen(false)} aria-label={language === "es" ? "Cerrar política" : "Close policy"}>×</button>
            </div>
            <p className="px-5 py-4 text-sm leading-relaxed text-slate-700 dark:text-gray-300">{t.privacyIntro}</p>
          </section>
        </div>
      )}
      {success && (
        <div className="success-overlay" role="dialog" aria-modal="true" aria-labelledby="success-title">
          <div className="mx-auto max-w-md px-6 text-center">
            <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full border-2 border-gold-400 bg-gold-400/10 text-4xl text-gold-400" aria-hidden="true">✓</div>
            <h2 id="success-title" className="mb-4 font-display text-3xl font-bold text-white">{t.thanks}</h2>
            <p className="mb-8 leading-relaxed text-slate-300">{t.received}</p>
            <p className="mb-8 leading-relaxed text-slate-300">{t.followLinkedIn} <a className="underline" href="https://linkedin.com/company/nexova" target="_blank" rel="noopener noreferrer">LinkedIn</a></p>
            <Link className="form-primary inline-block" href="/">{t.backHome}</Link>
          </div>
        </div>
      )}
    </div>
  );
}
