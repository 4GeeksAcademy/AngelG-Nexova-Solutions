"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { changePasswordRequest } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

interface FieldErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  general?: string;
}

function ChangePasswordContent() {
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    setFieldErrors({});
    setSuccessMessage(null);

    const errors: FieldErrors = {};

    if (!currentPassword.trim()) {
      errors.currentPassword = "La contraseña actual es obligatoria.";
    }

    if (!newPassword.trim()) {
      errors.newPassword = "La nueva contraseña es obligatoria.";
    } else if (newPassword.length < 8) {
      errors.newPassword = "La contraseña debe tener al menos 8 caracteres.";
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
      await changePasswordRequest(currentPassword, newPassword);
      logout();
    } catch (err) {
      setFieldErrors({
        general:
          err instanceof Error
            ? err.message
            : "Error al actualizar la contraseña.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <section className="mx-auto w-full max-w-2xl rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur md:p-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Nexova · Mi cuenta
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              Cambiar contraseña
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-600 hover:text-cyan-700"
          >
            Volver al panel
          </Link>
        </header>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div>
            <label
              htmlFor="current-password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Contraseña actual
            </label>
            <input
              id="current-password"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
            />
            {fieldErrors.currentPassword && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.currentPassword}
              </p>
            )}
          </div>

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

          {successMessage && (
            <p
              role="status"
              className="rounded-xl bg-cyan-50 px-3 py-2 text-sm text-cyan-900"
            >
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Guardando…" : "Actualizar contraseña"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function ChangePasswordPage() {
  return (
    <ProtectedRoute>
      <ChangePasswordContent />
    </ProtectedRoute>
  );
}
