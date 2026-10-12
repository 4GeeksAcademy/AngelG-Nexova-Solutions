"use client";

import Link from "next/link";

import { CandidateList } from "@/components/CandidateList";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, logout } = useAuth();

  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <section className="mx-auto w-full max-w-6xl rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur md:p-8">
        <header className="mb-6 flex flex-col gap-6 border-b border-slate-200 pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                Nexova · Operaciones de Seleccion
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Talent Pipeline Tracker
              </h1>
              <p className="max-w-3xl text-sm text-slate-600 md:text-base">
                Proceso activo: Executive Assistant en sede Valencia. Monitorea
                estado, etapa y avance de cada candidatura en una sola vista.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <p className="text-sm text-slate-600">{user?.email}</p>
              <nav
                aria-label="Opciones de cuenta"
                className="flex flex-wrap items-center gap-2"
              >
                <Link
                  href="/incidents"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-600 hover:text-cyan-700"
                >
                  Incidencias
                </Link>
                <Link
                  href="/incidents/new"
                  className="rounded-xl bg-cyan-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800"
                >
                  Nueva incidencia
                </Link>
                <Link
                  href="/account/profile"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-600 hover:text-cyan-700"
                >
                  Mi perfil
                </Link>
                <Link
                  href="/account/change-password"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-600 hover:text-cyan-700"
                >
                  Cambiar contraseña
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Cerrar sesión
                </button>
              </nav>
            </div>
          </div>
        </header>

        <CandidateList />
      </section>
    </main>
  );
}
