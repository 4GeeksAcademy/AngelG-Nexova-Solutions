"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CandidateCard } from "@/components/CandidateCard";
import { CandidateFilters } from "@/components/CandidateFilters";
import { CandidateForm } from "@/components/CandidateForm";
import { CandidateSearch } from "@/components/CandidateSearch";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Loading } from "@/components/Loading";
import { createRecord, deleteRecord, getRecords } from "@/lib/api";
import { Candidate, CandidateStage, CandidateStatus } from "@/types/candidate";

function isCandidateStatus(value: string): value is CandidateStatus {
  return ["received", "in_progress", "selected", "discarded"].includes(value);
}

function isCandidateStage(value: string): value is CandidateStage {
  return [
    "pending",
    "review",
    "personal_interview",
    "technical_interview",
    "offer_presented",
  ].includes(value);
}

interface CandidateListProps {
  isCreateFormOpen: boolean;
  onToggleCreateForm: () => void;
  isDeleteMode: boolean;
}

export function CandidateList({
  isCreateFormOpen,
  onToggleCreateForm,
  isDeleteMode,
}: CandidateListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialSearch = searchParams.get("search") ?? "";
  const initialStatusParam = searchParams.get("status");
  const initialStageParam = searchParams.get("stage");

  const initialStatus =
    initialStatusParam && isCandidateStatus(initialStatusParam)
      ? initialStatusParam
      : "all";
  const initialStage =
    initialStageParam && isCandidateStage(initialStageParam)
      ? initialStageParam
      : "all";

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<CandidateStatus | "all">(initialStatus);
  const [stageFilter, setStageFilter] = useState<CandidateStage | "all">(initialStage);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const setCandidateLoadError = useCallback((error: unknown) => {
    setLoadError(
      error instanceof Error
        ? error.message
        : "Error inesperado al consultar candidaturas.",
    );
  }, []);

  const loadCandidates = useCallback(async () => {
    try {
      const records = await getRecords();
      setCandidates(records);
    } catch (error) {
      setCandidateLoadError(error);
    } finally {
      setIsLoading(false);
    }
  }, [setCandidateLoadError]);

  function handleRetry() {
    setLoadError(null);
    setIsLoading(true);
    void loadCandidates();
  }

  useEffect(() => {
    let isMounted = true;

    getRecords()
      .then((records) => {
        if (isMounted) setCandidates(records);
      })
      .catch((error: unknown) => {
        if (isMounted) setCandidateLoadError(error);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [setCandidateLoadError]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (search.trim()) {
      params.set("search", search.trim());
    } else {
      params.delete("search");
    }

    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    } else {
      params.delete("status");
    }

    if (stageFilter !== "all") {
      params.set("stage", stageFilter);
    } else {
      params.delete("stage");
    }

    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery !== currentQuery) {
      const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      router.replace(nextUrl, { scroll: false });
    }
  }, [pathname, router, search, searchParams, stageFilter, statusFilter]);

  async function handleCreateCandidate(payload: {
    full_name: string;
    email: string;
    phone: string;
    position: string;
    linkedin_url?: string | null;
    cv_url?: string | null;
    experience_years: number;
  }) {
    try {
      setCreateError(null);
      setSuccessMessage(null);
      setIsCreating(true);
      const created = await createRecord(payload);
      setCandidates((previous) => [created, ...previous]);
      onToggleCreateForm();
      setSuccessMessage("Candidatura registrada correctamente.");
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "No se pudo registrar la candidatura.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteCandidate(candidate: Candidate) {
    if (!window.confirm(`¿Eliminar la candidatura de ${candidate.full_name}?`)) {
      return;
    }

    setDeleteError(null);
    setDeleteSuccess(null);
    setDeletingCandidateId(candidate.id);

    try {
      await deleteRecord(candidate.id);
      setCandidates((previous) =>
        previous.filter((item) => item.id !== candidate.id),
      );
      setDeleteSuccess(`Candidatura de ${candidate.full_name} eliminada.`);
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la candidatura.",
      );
    } finally {
      setDeletingCandidateId(null);
    }
  }

  const filteredCandidates = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return candidates.filter((candidate) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        candidate.full_name.toLowerCase().includes(normalizedSearch) ||
        candidate.email.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" || candidate.status === statusFilter;

      const matchesStage = stageFilter === "all" || candidate.stage === stageFilter;

      return matchesSearch && matchesStatus && matchesStage;
    });
  }, [candidates, search, statusFilter, stageFilter]);

  const detailQuery = searchParams.toString();

  if (isLoading) {
    return <Loading />;
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <ErrorMessage
          title="No se pudo cargar el pipeline"
          message={loadError}
        />
        <button
          type="button"
          onClick={handleRetry}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Registro de candidaturas
            </h2>
            <p className="text-sm text-slate-600">
              Alta rápida de candidaturas recibidas por distintos canales para el proceso Executive Assistant.
            </p>
          </div>
        </div>

        {isCreateFormOpen ? (
          <div className="mt-4 space-y-3 rounded-xl border border-cyan-100 bg-white p-4">
            {successMessage ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                {successMessage}
              </p>
            ) : null}
            {createError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {createError}
              </p>
            ) : null}
            <CandidateForm
              submitLabel="Guardar candidatura"
              isSubmitting={isCreating}
              onSubmit={handleCreateCandidate}
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2">
        <CandidateSearch value={search} onChange={setSearch} />
        <CandidateFilters
          status={statusFilter}
          stage={stageFilter}
          onStatusChange={setStatusFilter}
          onStageChange={setStageFilter}
        />
      </div>

      <p className="text-sm text-slate-600">
        {filteredCandidates.length} candidatura(s) visible(s) para Executive Assistant.
      </p>

      {deleteError ? (
        <ErrorMessage title="No se pudo eliminar la candidatura" message={deleteError} />
      ) : null}
      {deleteSuccess ? (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {deleteSuccess}
        </p>
      ) : null}

      {successMessage && !isCreateFormOpen ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {successMessage}
        </p>
      ) : null}

      {filteredCandidates.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-600">
          No hay candidaturas que cumplan con los filtros actuales.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCandidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              isDeleteMode={isDeleteMode}
              isDeleting={deletingCandidateId === candidate.id}
              onDelete={() => handleDeleteCandidate(candidate)}
              detailHref={
                detailQuery
                  ? `/candidates/${candidate.id}?${detailQuery}`
                  : `/candidates/${candidate.id}`
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
