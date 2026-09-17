export const INCIDENT_CATEGORIES = [
  "technical_failure",
  "process_error",
  "client_complaint",
  "candidate_issue",
  "staff_issue",
  "sla_breach",
  "data_quality",
  "other",
] as const;

export const INCIDENT_STATUSES = ["open", "in_progress", "resolved", "discarded"] as const;

export const INCIDENT_ORIGINS = ["customer", "branch", "internal"] as const;

export const INCIDENT_BRANCHES = [
  "central",
  "valencia_operations",
  "miami_office",
  "remote",
] as const;

export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type IncidentOrigin = (typeof INCIDENT_ORIGINS)[number];
export type IncidentBranch = (typeof INCIDENT_BRANCHES)[number];

export interface Incident {
  id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  status: IncidentStatus;
  origin: IncidentOrigin;
  branch: IncidentBranch;
  created_at: string;
  updated_at: string;
}

export interface CreateIncidentPayload {
  title: string;
  description: string;
  category: IncidentCategory;
  status: IncidentStatus;
  origin: IncidentOrigin;
  branch: IncidentBranch;
}

export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
  technical_failure: "Fallo de sistema o herramienta tecnológica",
  process_error: "Error en un proceso operativo",
  client_complaint: "Queja o reclamación de cliente",
  candidate_issue: "Problema relacionado con candidato",
  staff_issue: "Incidencia interna de RRHH",
  sla_breach: "Incumplimiento de SLA",
  data_quality: "Error o inconsistencia en datos",
  other: "Otra",
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  open: "Abierta",
  in_progress: "En progreso",
  resolved: "Resuelta",
  discarded: "Descartada",
};

export const INCIDENT_ORIGIN_LABELS: Record<IncidentOrigin, string> = {
  customer: "Cliente",
  branch: "Sede",
  internal: "Interna",
};

export const INCIDENT_BRANCH_LABELS: Record<IncidentBranch, string> = {
  central: "Central — Sede Valencia",
  valencia_operations: "Valencia — Operaciones",
  miami_office: "Miami Office",
  remote: "Remoto",
};

export const INCIDENT_STATUS_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open: ["in_progress", "discarded"],
  in_progress: ["resolved", "discarded"],
  resolved: [],
  discarded: [],
};

export interface IncidentSummary {
  total: number;
  by_status: Record<IncidentStatus, number>;
  by_category: Record<IncidentCategory, number>;
  by_origin: Record<IncidentOrigin, number>;
  by_branch: Record<IncidentBranch, number>;
}