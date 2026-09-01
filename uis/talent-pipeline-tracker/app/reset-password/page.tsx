"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Loading } from "@/components/Loading";
import { resetPasswordRequest } from "@/lib/api-client";

interface FieldErrors {
  newPassword?: string;
  confirmPassword?: string;
  general?: string;
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isTokenInvalid, setIsTokenInvalid] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    setFieldErrors({});
    setIsTokenInvalid(false);

    if (!token) {
      setIsTokenInvalid(true);
      return;
    }

    const errors: FieldErrors = {};

    if (!newPassword.trim()) {
      errors.newPassword = "La nueva contraseña es obligatoria.";
    } else if (newPassword.length < 6) {
      errors.newPassword = "La contraseña debe tener al menos 6 caracteres.";
    }

    if (!confirmPassword.trim()) {
      errors.confirmPassword = "Confirma la nueva contraseña.";
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = "Las contraseñas no coinciden.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPasswordRequest(token, newPassword);
      setIsSuccess(true);
      router.push("/login");
    } catch {
      // No exponemos el detalle del backend: el token puede estar inválido o expirado.
      setIsTokenInvalid(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token || isTokenInvalid) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-8">
        <section className="w-full max-w-md rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl backdrop-blur">
          <header className="mb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Nexova · Talent Pipeline
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              Restablecer contraseña
            </h1>
          </header>

          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            El enlace de restablecimiento no es válido o ha expirado.
          </p>

          <p className="mt-6 text-center text-sm text-slate-600">
            <Link
              href="/forgot-password"
              className="font-medium text-cyan-700 hover:text-cyan-600"
            >
              Solicitar un nuevo enlace
            </Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section className="w-full max-w-md rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl backdrop-blur">
        <header className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Nexova · Talent Pipeline
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            Restablecer contraseña
          </h1>
        </header>

        {isSuccess ? (
          <p
            role="status"
            className="rounded-xl bg-cyan-50 px-3 py-2 text-sm text-cyan-900"
          >
            Tu contraseña ha sido restablecida correctamente. Ya puedes
            iniciar sesión.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div>
              <label
                htmlFor="new-password"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Nueva contraseña
              </label>
              <input
                id="new-password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
              />
              {fieldErrors.newPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.newPassword}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Confirmar nueva contraseña
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
              />
              {fieldErrors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            {fieldErrors.general && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {fieldErrors.general}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Guardando…" : "Restablecer contraseña"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

// useSearchParams requiere un límite de Suspense para el prerenderizado.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
