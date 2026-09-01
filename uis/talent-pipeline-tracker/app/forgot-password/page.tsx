"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { forgotPasswordRequest } from "@/lib/api-client";

const CONFIRMATION_MESSAGE =
  "Si esa dirección está registrada, recibirás un enlace para restablecer tu contraseña.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Evita reenvíos accidentales mientras hay una petición en curso.
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await forgotPasswordRequest(email.trim());
      // El mensaje es siempre el mismo, exista o no el email (anti-enumeration).
      setIsSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al procesar la solicitud. Intenta nuevamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section className="w-full max-w-md rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl backdrop-blur">
        <header className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Nexova · Talent Pipeline
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            Recuperar contraseña
          </h1>
        </header>

        {isSubmitted ? (
          <div className="grid gap-4">
            <p
              role="status"
              className="rounded-xl bg-cyan-50 px-3 py-2 text-sm text-cyan-900"
            >
              {CONFIRMATION_MESSAGE}
            </p>
            <Link
              href="/login"
              className="text-center text-sm font-medium text-cyan-700 hover:text-cyan-600"
            >
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Enviando…" : "Enviar enlace de restablecimiento"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          <Link
            href="/login"
            className="font-medium text-cyan-700 hover:text-cyan-600"
          >
            Volver a iniciar sesión
          </Link>
        </p>
      </section>
    </main>
  );
}
