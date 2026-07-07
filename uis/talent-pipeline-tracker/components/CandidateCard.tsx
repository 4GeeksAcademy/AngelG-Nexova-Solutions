import Link from "next/link";

import { Candidate, STAGE_LABELS, STATUS_LABELS } from "@/types/candidate";

interface CandidateCardProps {
  candidate: Candidate;
  detailHref?: string;
}

export function CandidateCard({ candidate, detailHref }: CandidateCardProps) {
  const targetHref = detailHref ?? `/candidates/${candidate.id}`;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {candidate.full_name}
          </h3>
          <p className="text-sm text-slate-600">{candidate.email}</p>
        </div>
        <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-800">
          {candidate.position}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
        <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-700">
          <span className="font-medium">Estado:</span> {STATUS_LABELS[candidate.status]}
        </p>
        <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-700">
          <span className="font-medium">Etapa:</span> {STAGE_LABELS[candidate.stage]}
        </p>
      </div>

      <Link
        href={targetHref}
        className="inline-flex rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        Ver detalle
      </Link>
    </article>
  );
}
