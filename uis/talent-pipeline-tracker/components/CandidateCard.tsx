import Link from "next/link";

import { Candidate, STAGE_LABELS, STATUS_LABELS } from "@/types/candidate";

interface CandidateCardProps {
  candidate: Candidate;
  detailHref?: string;
  isDeleteMode?: boolean;
  isDeleting?: boolean;
  onDelete?: () => void;
}

export function CandidateCard({
  candidate,
  detailHref,
  isDeleteMode = false,
  isDeleting = false,
  onDelete,
}: CandidateCardProps) {
  const targetHref = detailHref ?? `/candidates/${candidate?.id ?? ""}`;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {candidate?.full_name ?? "Sin nombre"}
          </h3>
          <p className="text-sm text-slate-600">{candidate?.email ?? "—"}</p>
        </div>
        <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-800">
          {candidate?.position ?? "—"}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
        <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-700">
          <span className="font-medium">Estado:</span> {STATUS_LABELS[candidate?.status ?? "received"]}
        </p>
        <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-700">
          <span className="font-medium">Etapa:</span> {STAGE_LABELS[candidate?.stage ?? "pending"]}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={targetHref}
          className="inline-flex rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Ver detalle
        </Link>
        {isDeleteMode ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            aria-label={`Eliminar candidatura de ${candidate.full_name}`}
            title="Eliminar candidatura"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-red-200 text-lg font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            X
          </button>
        ) : null}
      </div>
    </article>
  );
}
