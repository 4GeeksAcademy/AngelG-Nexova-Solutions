"use client";

import { FormEvent, useEffect, useState } from "react";

import { ErrorMessage } from "@/components/ErrorMessage";
import { Loading } from "@/components/Loading";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth-context";
import {
  getMe,
  updateMyProfile,
  type MeResponse,
  type ProfileUpdatePayload,
} from "@/lib/api-client";

function ProfileContent() {
  const { user, logout } = useAuth();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Formulario de edición
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getMe();
        setMe(data);
        setName(data.profile?.name ?? "");
        setPhone(data.profile?.phone ?? "");
        setAddress(data.profile?.address ?? "");
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Error al cargar el perfil.",
        );
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);
    setIsSaving(true);

    try {
      const payload: ProfileUpdatePayload = {};
      if (name.trim()) payload.name = name.trim();
      if (phone.trim()) payload.phone = phone.trim();
      if (address.trim()) payload.address = address.trim();

      await updateMyProfile(payload);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Error al actualizar el perfil.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <Loading />;
  }

  if (loadError) {
    return (
      <ErrorMessage
        title="No se pudo cargar el perfil"
        message={loadError}
      />
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <section className="mx-auto w-full max-w-2xl rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur md:p-8">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Nexova · Mi cuenta
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            Perfil
          </h1>
        </header>

        {/* Información no editable */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Información de la cuenta
          </h2>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium text-slate-900">
                {me?.email ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Rol</dt>
              <dd className="font-medium text-slate-900 capitalize">
                {me?.role ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">ID</dt>
              <dd className="font-mono text-xs text-slate-600">
                {me?.id ?? "—"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Formulario de edición */}
        <form onSubmit={handleSave} className="grid gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Editar perfil
          </h2>

          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Nombre
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Teléfono
            </label>
            <input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+34 600 000 000"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
            />
          </div>

          <div>
            <label
              htmlFor="address"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Dirección
            </label>
            <input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Calle, ciudad, código postal"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
            />
          </div>

          {saveError && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {saveError}
            </p>
          )}

          {saveSuccess && (
            <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">
              Perfil actualizado correctamente.
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Guardando…" : "Guardar cambios"}
            </button>

            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-red-200 px-6 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              Cerrar sesión
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}