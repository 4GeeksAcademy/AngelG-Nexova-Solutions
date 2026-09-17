import Link from "next/link";

import { IncidentList } from "@/components/IncidentList";
import { IncidentSummaryPanel } from "@/components/IncidentSummaryPanel";

export default function IncidentsPage() {
  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <section className="mx-auto w-full max-w-6xl rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur md:p-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="text-sm font-semibold text-cyan-700 hover:text-cyan-900">
              ← Volver al pipeline
            </Link>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Nexova · Incidencias
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Incidencias</h1>
          </div>
          <Link
            href="/incidents/new"
            className="rounded-xl bg-cyan-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800"
          >
            Nueva incidencia
          </Link>
        </header>

        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Resumen</h2>
          <IncidentSummaryPanel />
        </div>

        <IncidentList />
      </section>
    </main>
  );
}

