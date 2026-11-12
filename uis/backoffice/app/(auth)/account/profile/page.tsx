"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

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

const ChangePasswordForm = dynamic(
  () => import("@/components/ChangePasswordForm").then((module) => module.ChangePasswordForm),
  {
    loading: () => <p role="status" className="py-4 text-sm text-slate-600">Cargando formulario de contraseña…</p>,
  },
);

const UserAdministration = dynamic(
  () => import("@/components/UserAdministration").then((module) => module.UserAdministration),
  {
    loading: () => <p role="status" className="py-4 text-sm text-slate-600">Cargando administración de usuarios…</p>,
  },
);

function ProfileContent() {
  const { updateProfileName, user } = useAuth();
  const [activeSection, setActiveSection] = useState<"profile" | "password" | "users">(() =>
    user?.role === "admin" && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("section") === "users" ? "users" : "profile",
  );

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

  async function loadProfile() {
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

  useEffect(() => {
    let isMounted = true;
    getMe()
      .then((data) => {
        if (!isMounted) return;
        setMe(data);
        setName(data.profile?.name ?? "");
        setPhone(data.profile?.phone ?? "");
        setAddress(data.profile?.address ?? "");
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : "Error al cargar el perfil.");
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
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

      const updatedProfile = await updateMyProfile(payload);
      updateProfileName(updatedProfile.name);
      setMe((current) =>
        current ? { ...current, profile: updatedProfile } : current,
      );
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
      <main className="min-h-screen px-4 py-8 md:px-10">
        <section className="mx-auto w-full max-w-2xl rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur md:p-8">
          <div className="space-y-3">
            <ErrorMessage
              title="No se pudo cargar el perfil"
              message={loadError}
            />
            <button
              type="button"
              onClick={loadProfile}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Reintentar
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <section className="mx-auto w-full max-w-4xl rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur md:p-8">
        <header className="mb-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/"
              className="text-sm font-semibold text-cyan-700 hover:text-cyan-900"
            >
              ← Volver al panel
            </Link>
            <nav aria-label="Secciones de cuenta" className="flex flex-wrap justify-end gap-2">
          {[
            { id: "profile" as const, title: "Mi perfil" },
            { id: "password" as const, title: "Cambiar contraseña" },
            ...(user?.role === "admin" ? [{ id: "users" as const, title: "Administrar usuarios" }] : []),
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              aria-pressed={activeSection === item.id}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                activeSection === item.id
                  ? "border-cyan-700 bg-cyan-700 text-white hover:bg-cyan-800"
                  : "border-cyan-700 bg-white text-cyan-900 hover:bg-cyan-50"
              }`}
            >
              {item.title}
            </button>
          ))}
            </nav>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Nexova · Mi cuenta
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              Perfil
            </h1>
            <p className="mt-1 text-sm text-slate-600">Gestiona tus datos y la seguridad de tu cuenta.</p>
          </div>
        </header>

        <div key={activeSection} className="profile-section-enter rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm md:p-6">
        {activeSection === "profile" ? <div id="profile-section" aria-labelledby="profile-section-heading">
        {/* Información no editable */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Información de la cuenta
          </h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="text-slate-500">Email</dt><dd className="break-all font-medium text-slate-900">{me?.email ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Rol</dt><dd className="font-medium capitalize text-slate-900">{me?.role ?? "—"}</dd></div>
            <div><dt className="text-slate-500">ID</dt><dd className="break-all font-mono text-xs text-slate-600">{me?.id ?? "—"}</dd></div>
          </dl>
        </div>

        {/* Formulario de edición */}
        <form onSubmit={handleSave} className="grid gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            <span id="profile-section-heading">Editar perfil</span>
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

          </div>
        </form>
        </div> : null}
        {activeSection === "password" ? <div id="password-section" aria-label="Cambiar contraseña"><ChangePasswordForm /></div> : null}
        {activeSection === "users" && user?.role === "admin" ? <div id="users-section" aria-label="Administración de usuarios"><UserAdministration /></div> : null}
        </div>
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