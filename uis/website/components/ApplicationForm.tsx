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
  position: string;
  experience_years: string;
  linkedin_url: string;
  cv_url: string;
  acceptTerms: boolean;
};

const emptyValues: Values = {
  full_name: "",
  email: "",
  phone: "",
  position: "",
  experience_years: "",
  linkedin_url: "",
  cv_url: "",
  acceptTerms: false,
};

const copy = {
  es: {
    home: "Inicio", form: "Candidatura", title: "Únete al equipo Nexova",
    intro: "Comparte tus datos profesionales para que nuestro equipo pueda revisar tu candidatura.",
    full_name: "Nombre completo", email: "Correo electrónico", phone: "Teléfono",
    position: "Puesto al que aplicas", experience_years: "Años de experiencia",
    linkedin_url: "URL de LinkedIn", cv_url: "URL de tu CV",
    optional: "(opcional)", consentIntro: "He leído y acepto la",
    privacy: "política de tratamiento de datos",
    privacyIntro: "Nexova Solutions tratará tus datos para gestionar la candidatura, evaluar tu perfil y contactar contigo sobre procesos de selección actuales o futuros. Puedes ejercer tus derechos escribiendo a hola@nexovasolutions.com.",
    consentEnd: "y autorizo el uso de mis datos para gestionar esta candidatura.",
    submit: "Enviar candidatura", sending: "Enviando…", clear: "Limpiar",
    thanks: "¡Gracias por tu interés en Nexova!",
    received: "Hemos recibido tu candidatura. Nuestro equipo de selección la revisará.",
    backHome: "Volver al inicio", errorTitle: "No se pudo enviar la candidatura",
    error: "Inténtalo de nuevo más tarde. Si el problema continúa, ponte en contacto con Nexova.",
    errors: {
      full_name: "Ingresa tu nombre y apellido.", email: "Ingresa un email válido.",
      phone: "Ingresa un teléfono de contacto.", position: "Indica el puesto al que aplicas.",
      experience_years: "Ingresa un número entero entre 0 y 50.",
      linkedin_url: "Introduce una URL válida.", cv_url: "Introduce una URL válida.",
      acceptTerms: "Debes aceptar la política de tratamiento de datos.",
    },
  },
  en: {
    home: "Home", form: "Application", title: "Join the Nexova team",
    intro: "Share your professional details so our recruitment team can review your application.",
    full_name: "Full name", email: "Email address", phone: "Phone",
    position: "Position you are applying for", experience_years: "Years of experience",
    linkedin_url: "LinkedIn URL", cv_url: "CV URL",
    optional: "(optional)", consentIntro: "I have read and accept the",
    privacy: "data processing policy",
    privacyIntro: "Nexova Solutions will process your data to manage your application, assess your profile, and contact you about current or future recruitment processes. You may exercise your data rights by writing to hola@nexovasolutions.com.",
    consentEnd: "and authorize the use of my data to manage this application.",
    submit: "Submit application", sending: "Sending…", clear: "Clear",
    thanks: "Thanks for your interest in Nexova!",
    received: "We have received your application. Our recruitment team will review it.",
    backHome: "Back to home", errorTitle: "We couldn't submit your application",
    error: "Please try again later. If the problem continues, contact Nexova.",
    errors: {
      full_name: "Enter your first and last name.", email: "Enter a valid email address.",
      phone: "Enter a contact phone number.", position: "Enter the position you are applying for.",
      experience_years: "Enter a whole number between 0 and 50.",
      linkedin_url: "Enter a valid URL.", cv_url: "Enter a valid URL.",
      acceptTerms: "You must accept the data processing policy.",
    },
  },
} as const;

type InputField = Exclude<keyof Values, "acceptTerms">;
type ErrorField = keyof Values;

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function ApplicationForm() {
  const { language } = useSitePreferences();
  const t = copy[language];
  const [values, setValues] = useState<Values>(emptyValues);
  const [errors, setErrors] = useState<Partial<Record<ErrorField, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [failed, setFailed] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const validate = () => {
    const next: Partial<Record<ErrorField, string>> = {};
    if (values.full_name.trim().split(/\s+/).filter(Boolean).length < 2) next.full_name = t.errors.full_name;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) next.email = t.errors.email;
    if (!values.phone.trim()) next.phone = t.errors.phone;
    if (!values.position.trim()) next.position = t.errors.position;
    const years = Number(values.experience_years);
    if (values.experience_years === "" || !Number.isInteger(years) || years < 0 || years > 50) {
      next.experience_years = t.errors.experience_years;
    }
    if (values.linkedin_url && !isValidUrl(values.linkedin_url)) next.linkedin_url = t.errors.linkedin_url;
    if (values.cv_url && !isValidUrl(values.cv_url)) next.cv_url = t.errors.cv_url;
    if (!values.acceptTerms) next.acceptTerms = t.errors.acceptTerms;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const update = (field: InputField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFailed(false);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

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
          cv_url: values.cv_url.trim() || null,
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

  const fieldError = (field: ErrorField) => errors[field] ? (
    <p className="error-message visible" id={`${field}-error`} role="alert">{errors[field]}</p>
  ) : <p className="error-message" id={`${field}-error`} role="alert" />;

  const input = (field: InputField, type = "text", optional = false) => (
    <div>
      <label className="field-label" htmlFor={field}>
        {t[field]} {optional ? <span className="optional-label">{t.optional}</span> : <span>*</span>}
      </label>
      <input
        className={`field-base${errors[field] ? " error" : ""}`}
        id={field}
        type={type}
        required={!optional}
        min={field === "experience_years" ? 0 : undefined}
        max={field === "experience_years" ? 50 : undefined}
        step={field === "experience_years" ? 1 : undefined}
        autoComplete={field === "full_name" ? "name" : field === "email" ? "email" : field === "phone" ? "tel" : undefined}
        value={values[field]}
        onChange={(event) => update(field, event.target.value)}
        aria-describedby={`${field}-error`}
        aria-invalid={Boolean(errors[field])}
      />
      {fieldError(field)}
    </div>
  );

  return (
    <div className="application-page">
      <SiteHeader page="application" />
      <main id="main-content" className="application-main">
        <section id="form" className="application-form-stage" aria-labelledby="application-title">
          <div className="application-form-container">
            <Link className="application-back" href="/"><span aria-hidden="true">←</span> {t.backHome}</Link>
            <h1 id="application-title" className="application-form-title">{t.title}</h1>
            <p className="mb-5 text-sm text-slate-600 dark:text-gray-300">{t.intro}</p>
            <form ref={formRef} noValidate aria-label={t.form} onSubmit={submit}>
              <div className="form-card space-y-3 rounded-xl border border-slate-300/70 bg-slate-50 p-4 shadow-sm dark:border-white/10 dark:bg-navy-900">
                <div className="grid gap-3 sm:grid-cols-2">
                  {input("full_name")}
                  {input("email", "email")}
                  {input("phone", "tel")}
                  {input("position")}
                  {input("experience_years", "number")}
                  {input("linkedin_url", "url", true)}
                </div>
                {input("cv_url", "url", true)}
                <div>
                  <div className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 ${errors.acceptTerms ? "border-red-500 bg-red-50/40 dark:border-red-400/80 dark:bg-red-500/10" : "border-slate-200/80 dark:border-white/10"}`}>
                    <input
                      className="mt-0.5 h-4 w-4 accent-gold-400"
                      id="acceptTerms"
                      type="checkbox"
                      checked={values.acceptTerms}
                      onChange={(event) => {
                        setValues((current) => ({ ...current, acceptTerms: event.target.checked }));
                        setErrors((current) => ({ ...current, acceptTerms: undefined }));
                      }}
                      aria-describedby="acceptTerms-error"
                      aria-invalid={Boolean(errors.acceptTerms)}
                    />
                    <label className="text-xs leading-relaxed text-slate-700 dark:text-gray-300" htmlFor="acceptTerms">
                      {t.consentIntro} <button type="button" className="font-semibold text-gold-500 underline dark:text-gold-300" onClick={() => setPolicyOpen(true)}>{t.privacy}</button> {t.consentEnd} <span className="text-gold-400">*</span>
                    </label>
                  </div>
                  {fieldError("acceptTerms")}
                </div>
                <div className="sr-only" aria-hidden="true">
                  <label htmlFor="website">Leave this field empty</label>
                  <input id="website" name="website" tabIndex={-1} autoComplete="off" />
                </div>
              </div>
              {failed && <p className="error-message visible mt-3" role="alert">{t.errorTitle}. {t.error}</p>}
              <div className="mt-3 flex justify-end gap-3">
                <button type="reset" className="form-secondary" onClick={() => { setValues(emptyValues); setErrors({}); setFailed(false); }}>{t.clear}</button>
                <button type="submit" className="form-primary" disabled={submitting}>{submitting ? t.sending : t.submit}</button>
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
            <Link className="form-primary inline-block" href="/">{t.backHome}</Link>
          </div>
        </div>
      )}
    </div>
  );
}
