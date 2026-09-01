"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AddNoteForm } from "@/components/AddNoteForm";
import { CandidateForm } from "@/components/CandidateForm";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Loading } from "@/components/Loading";
import { NotesList } from "@/components/NotesList";
import {
  addNote,
  deleteNote,
  getNotes,
  getRecordById,
  patchRecord,
  updateRecord,
} from "@/lib/api";
import {
  Candidate,
  CandidateStage,
  CandidateStatus,
  CreateCandidatePayload,
  STAGE_LABELS,
  STATUS_LABELS,
} from "@/types/candidate";
import { Note } from "@/types/note";

interface CandidateDetailProps {
  candidateId: string;
}

const STATUS_OPTIONS: CandidateStatus[] = [
  "received",
  "in_progress",
  "selected",
  "discarded",
];

const STAGE_OPTIONS: CandidateStage[] = [
  "pending",
  "review",
  "personal_interview",
  "technical_interview",
  "offer_presented",
];

export function CandidateDetail({ candidateId }: CandidateDetailProps) {
  const searchParams = useSearchParams();
  const backHref = searchParams.toString() ? `/?${searchParams.toString()}` : "/";

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPatching, setIsPatching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [loadedCandidate, loadedNotes] = await Promise.all([
          getRecordById(candidateId),
          getNotes(candidateId),
        ]);
        setCandidate(loadedCandidate);
        setNotes(loadedNotes);
      } catch (loadErr) {
        setLoadError(
          loadErr instanceof Error
            ? loadErr.message
            : "Error inesperado al consultar el detalle.",
        );
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [candidateId]);

  if (isLoading) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-10">
        <section className="mx-auto w-full max-w-4xl rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur md:p-8">
          <Loading />
        </section>
      </main>
    );
  }

  if (loadError || !candidate) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-10">
        <section className="mx-auto w-full max-w-4xl rounded-3xl border border-red-200 bg-white p-6 shadow-lg md:p-8">
          <ErrorMessage
            title="No se pudo cargar la candidatura"
            message={loadError ?? "No se encontro informacion de la candidatura."}
          />
        </section>
      </main>
    );
  }

  async function updateCandidateStatus(status: CandidateStatus) {
    try {
      setError(null);
      setSuccessMessage(null);
      setIsPatching(true);
      const updated = await patchRecord(candidateId, { status });
      setCandidate(updated);
      setSuccessMessage("Estado actualizado correctamente.");
    } catch (patchError) {
      setError(
        patchError instanceof Error
          ? patchError.message
          : "No se pudo actualizar el estado.",
      );
    } finally {
      setIsPatching(false);
    }
  }

  async function updateCandidateStage(stage: CandidateStage) {
    try {
      setError(null);
      setSuccessMessage(null);
      setIsPatching(true);
      const updated = await patchRecord(candidateId, { stage });
      setCandidate(updated);
      setSuccessMessage("Etapa actualizada correctamente.");
    } catch (patchError) {
      setError(
        patchError instanceof Error
          ? patchError.message
          : "No se pudo actualizar la etapa.",
      );
    } finally {
      setIsPatching(false);
    }
  }

  async function handleAddNote(content: string) {
    try {
      setError(null);
      setSuccessMessage(null);
      setIsAddingNote(true);
      const created = await addNote(candidateId, { content });
      setNotes((previous) => [created, ...previous]);
      setSuccessMessage("Nota agregada correctamente.");
    } catch (noteError) {
      setError(
        noteError instanceof Error
          ? noteError.message
          : "No se pudo crear la nota.",
      );
    } finally {
      setIsAddingNote(false);
    }
  }

  async function handleUpdateCandidate(payload: CreateCandidatePayload) {
    try {
      setError(null);
      setSuccessMessage(null);
      setIsUpdating(true);
      const updated = await updateRecord(candidateId, payload);
      setCandidate(updated);
      setShowEditForm(false);
      setSuccessMessage("Candidatura actualizada correctamente.");
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar la candidatura.",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    try {
      setError(null);
      setSuccessMessage(null);
      setDeletingNoteId(noteId);
      await deleteNote(candidateId, noteId);
      setNotes((previous) => previous.filter((note) => note.id !== noteId));
      setSuccessMessage("Nota eliminada correctamente.");
    } catch (noteError) {
      setError(
        noteError instanceof Error
          ? noteError.message
          : "No se pudo eliminar la nota.",
      );
    } finally {
      setDeletingNoteId(null);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <section className="mx-auto w-full max-w-4xl space-y-6 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur md:p-8">
        <header className="space-y-2">
          <Link
            href={backHref}
            className="inline-flex text-sm font-medium text-cyan-700 transition hover:text-cyan-600"
          >
            ← Volver al pipeline
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">{candidate.full_name}</h1>
          <p className="text-sm text-slate-600">
            {candidate.position} · {candidate.email} · {candidate.phone}
          </p>
        </header>

        {error ? <ErrorMessage message={error} /> : null}
        {successMessage ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {successMessage}
          </p>
        ) : null}

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Estado
            <select
              value={candidate.status}
              disabled={isPatching}
              onChange={(event) =>
                updateCandidateStatus(event.target.value as CandidateStatus)
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Etapa
            <select
              value={candidate.stage}
              disabled={isPatching}
              onChange={(event) =>
                updateCandidateStage(event.target.value as CandidateStage)
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
            >
              {STAGE_OPTIONS.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900">
              Datos de candidatura
            </h2>
            <button
              type="button"
              onClick={() => setShowEditForm((value) => !value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              {showEditForm ? "Cancelar edicion" : "Editar candidatura"}
            </button>
          </div>

          {showEditForm ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <CandidateForm
                initialValues={{
                  full_name: candidate.full_name,
                  email: candidate.email,
                  phone: candidate.phone,
                  position: candidate.position,
                  linkedin_url: candidate.linkedin_url,
                  cv_url: candidate.cv_url,
                  experience_years: candidate.experience_years,
                }}
                submitLabel="Guardar cambios"
                isSubmitting={isUpdating}
                onSubmit={handleUpdateCandidate}
              />
            </div>
          ) : (
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-lg bg-white p-3">
                <dt className="font-medium text-slate-600">LinkedIn</dt>
                <dd className="mt-1 text-slate-800">
                  {candidate.linkedin_url || "No disponible"}
                </dd>
              </div>
              <div className="rounded-lg bg-white p-3">
                <dt className="font-medium text-slate-600">CV URL</dt>
                <dd className="mt-1 text-slate-800">{candidate.cv_url || "No disponible"}</dd>
              </div>
              <div className="rounded-lg bg-white p-3">
                <dt className="font-medium text-slate-600">Experiencia</dt>
                <dd className="mt-1 text-slate-800">{candidate.experience_years} anos</dd>
              </div>
              <div className="rounded-lg bg-white p-3">
                <dt className="font-medium text-slate-600">Fecha de aplicacion</dt>
                <dd className="mt-1 text-slate-800">
                  {new Date(candidate.applied_at).toLocaleString("es-ES")}
                </dd>
              </div>
              <div className="rounded-lg bg-white p-3">
                <dt className="font-medium text-slate-600">Actualizado</dt>
                <dd className="mt-1 text-slate-800">
                  {new Date(candidate.updated_at).toLocaleString("es-ES")}
                </dd>
              </div>
            </dl>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Notas internas</h2>
          <AddNoteForm onSubmit={handleAddNote} isSubmitting={isAddingNote} />
          <NotesList
            notes={notes}
            onDelete={handleDeleteNote}
            deletingNoteId={deletingNoteId}
          />
        </section>
      </section>
    </main>
  );
}
