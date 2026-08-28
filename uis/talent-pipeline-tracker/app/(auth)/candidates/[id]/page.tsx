import { CandidateDetail } from "@/components/CandidateDetail";
import { ErrorMessage } from "@/components/ErrorMessage";
import { getNotes, getRecordById } from "@/lib/api";
import { Candidate } from "@/types/candidate";
import { Note } from "@/types/note";

interface CandidateDetailPageProps {
  params: Promise<{ id: string }>;
}

interface CandidateDetailData {
  candidate: Candidate | null;
  notes: Note[];
  error: string | null;
}

async function loadCandidateDetail(id: string): Promise<CandidateDetailData> {
  try {
    const [candidate, notes] = await Promise.all([getRecordById(id), getNotes(id)]);
    return { candidate, notes, error: null };
  } catch (error) {
    return {
      candidate: null,
      notes: [],
      error:
        error instanceof Error
          ? error.message
          : "Error inesperado al consultar el detalle.",
    };
  }
}

export default async function CandidateDetailPage({
  params,
}: CandidateDetailPageProps) {
  const { id } = await params;
  const result = await loadCandidateDetail(id);

  if (!result.candidate || result.error) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-10">
        <section className="mx-auto w-full max-w-4xl rounded-3xl border border-red-200 bg-white p-6 shadow-lg md:p-8">
          <ErrorMessage
            title="No se pudo cargar la candidatura"
            message={result.error ?? "No se encontro informacion de la candidatura."}
          />
        </section>
      </main>
    );
  }

  return (
    <CandidateDetail initialCandidate={result.candidate} initialNotes={result.notes} />
  );
}
