import { CandidateList } from "@/components/CandidateList";
import { ErrorMessage } from "@/components/ErrorMessage";
import { getRecords } from "@/lib/api";

async function loadCandidates() {
  try {
    const records = await getRecords();
    return { records, error: null };
  } catch (error) {
    return {
      records: [],
      error:
        error instanceof Error
          ? error.message
          : "Error inesperado al consultar candidaturas.",
    };
  }
}

export default async function Home() {
  const { records, error } = await loadCandidates();

  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <section className="mx-auto w-full max-w-6xl rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur md:p-8">
        <header className="mb-6 flex flex-col gap-2">
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
        </header>

        {error ? (
          <ErrorMessage
            title="No se pudo cargar el pipeline"
            message={error}
          />
        ) : (
          <CandidateList initialCandidates={records} />
        )}
      </section>
    </main>
  );
}
