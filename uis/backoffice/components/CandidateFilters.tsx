"use client";

import {
  CandidateStage,
  CandidateStatus,
  STAGE_LABELS,
  STATUS_LABELS,
} from "@/types/candidate";

interface CandidateFiltersProps {
  status: CandidateStatus | "all";
  stage: CandidateStage | "all";
  onStatusChange: (value: CandidateStatus | "all") => void;
  onStageChange: (value: CandidateStage | "all") => void;
}

const STATUS_OPTIONS: Array<CandidateStatus | "all"> = [
  "all",
  "received",
  "in_progress",
  "selected",
  "discarded",
];

const STAGE_OPTIONS: Array<CandidateStage | "all"> = [
  "all",
  "pending",
  "review",
  "personal_interview",
  "technical_interview",
  "offer_presented",
];

function getStatusLabel(value: CandidateStatus | "all"): string {
  if (value === "all") {
    return "Todos los estados";
  }

  return STATUS_LABELS[value];
}

function getStageLabel(value: CandidateStage | "all"): string {
  if (value === "all") {
    return "Todas las etapas";
  }

  return STAGE_LABELS[value];
}

export function CandidateFilters({
  status,
  stage,
  onStatusChange,
  onStageChange,
}: CandidateFiltersProps) {
  return (
    <div className="grid w-full gap-3 md:grid-cols-2">
      <label className="text-sm font-medium text-slate-700">
        Estado
        <select
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          value={status}
          onChange={(event) =>
            onStatusChange(event.target.value as CandidateStatus | "all")
          }
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {getStatusLabel(option)}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-slate-700">
        Etapa
        <select
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          value={stage}
          onChange={(event) =>
            onStageChange(event.target.value as CandidateStage | "all")
          }
        >
          {STAGE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {getStageLabel(option)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
