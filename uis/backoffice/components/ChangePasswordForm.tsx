"use client";

import { FormEvent, useState } from "react";

import { changePasswordRequest } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

interface FieldErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  general?: string;
}

export function ChangePasswordForm() {
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    setFieldErrors({});
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
    } catch (error) {
      setFieldErrors({
        general:
          error instanceof Error
            ? error.message
            : "Error al actualizar la contraseña.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mt-8 border-t border-slate-200 pt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Cambiar contraseña
      </h2>
      <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
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
            onChange={(event) => setCurrentPassword(event.target.value)}
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
            onChange={(event) => setNewPassword(event.target.value)}
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
            onChange={(event) => setConfirmPassword(event.target.value)}
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
          {isSubmitting ? "Guardando…" : "Actualizar contraseña"}
        </button>
      </form>
    </section>
  );
}