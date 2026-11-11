import Link from "next/link";
import { IncidentDetail } from "@/components/IncidentDetail";

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="min-h-screen px-4 py-8 md:px-10"><section className="mx-auto w-full max-w-5xl rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur md:p-8"><header className="mb-6 border-b border-slate-200 pb-5"><Link href="/incidents" className="text-sm font-semibold text-cyan-700 hover:text-cyan-900">← Volver a incidencias</Link><p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Nexova · Seguimiento</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Detalle de incidencia</h1></header><IncidentDetail incidentId={id} /></section></main>;
}
