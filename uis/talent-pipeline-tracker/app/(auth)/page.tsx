"use client";

import { useState } from "react";

import { CandidateList } from "@/components/CandidateList";

export default function Home() {
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);

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
              <button
                type="button"
                onClick={() => setIsCreateFormOpen((current) => !current)}
                className="rounded-xl bg-cyan-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800"
              >
                {isCreateFormOpen ? "Ocultar registro" : "Registrar candidatura"}
              </button>
              <button
                type="button"
                aria-pressed={isDeleteMode}
                onClick={() => setIsDeleteMode((current) => !current)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  isDeleteMode
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-slate-300 text-slate-700 hover:border-red-300 hover:text-red-700"
                }`}
              >
                Eliminar candidaturas
              </button>
            </div>
          </div>
        </header>

        <CandidateList
          isCreateFormOpen={isCreateFormOpen}
          onToggleCreateForm={() =>
            setIsCreateFormOpen((current) => !current)
          }
          isDeleteMode={isDeleteMode}
        />
      </section>
    </main>
  );
}
