"use client";

import Link from "next/link";
import { useState } from "react";

import { IncidentForm } from "@/components/IncidentForm";
import { createIncident } from "@/lib/incidents-api";
import { CreateIncidentPayload } from "@/types/incident";

export default function NewIncidentPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(payload: CreateIncidentPayload) {
    setIsSubmitting(true);
    setSuccess(false);
    setError(null);
    setFieldErrors({});

    try {
      await createIncident(payload);
      setSuccess(true);
    } catch (requestError) {
      const errorWithFields = requestError as Error & { fields?: Record<string, string> };
      setError(errorWithFields.message || "No se pudo crear la incidencia. Inténtalo de nuevo.");
      setFieldErrors(errorWithFields.fields ?? {});
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <section className="mx-auto w-full max-w-4xl rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur md:p-8">
        <header className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6">
          <Link href="/" className="text-sm font-semibold text-cyan-700 hover:text-cyan-900">
            ← Volver al pipeline
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Nexova · Incidencias</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Registrar incidencia</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Registra un problema técnico u operativo con la información necesaria para darle seguimiento.
            </p>
          </div>
        </header>

        {success ? (
          <div role="status" className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
            <h2 className="font-semibold">Incidencia creada correctamente.</h2>
            <p className="mt-1 text-sm">El registro quedó guardado con estado open.</p>
            <button
              type="button"
              onClick={() => setSuccess(false)}
              className="mt-4 rounded-lg bg-emerald-900 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Registrar otra incidencia
            </button>
          </div>
        ) : null}

        {!success ? <IncidentForm isSubmitting={isSubmitting} error={error} fieldErrors={fieldErrors} onSubmit={handleSubmit} /> : null}
      </section>
    </main>
  );
}