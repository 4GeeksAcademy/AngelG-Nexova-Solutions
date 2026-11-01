export const INCIDENT_CHANNELS = [
  "email",
  "slack",
  "helpdesk_ticket",
  "client_call",
  "dashboard",
] as const;
export const MANAGED_INCIDENT_TYPES = [
  "sla_breach",
  "client_escalation",
  "system_outage",
  "data_issue",
  "staffing_gap",
  "compliance_flag",
] as const;
export const INCIDENT_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export const RESPONSIBLE_AREAS = [
  "marketing",
  "sales",
  "hr_internal",
  "talent_selection",
  "corporate_training",
  "customer_support",
  "technology",
] as const;
export const MANAGED_INCIDENT_STATUSES = [
  "open",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
  "reopened",
] as const;

export type IncidentChannel = (typeof INCIDENT_CHANNELS)[number];
export type ManagedIncidentType = (typeof MANAGED_INCIDENT_TYPES)[number];
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type ResponsibleArea = (typeof RESPONSIBLE_AREAS)[number];
export type ManagedIncidentStatus = (typeof MANAGED_INCIDENT_STATUSES)[number];

export interface ManagedIncident {
  id: string;
  client_name: string | null;
  channel: IncidentChannel;
  type: ManagedIncidentType;
  severity: IncidentSeverity;
  responsible_area: ResponsibleArea;
  title: string;
  description: string;
  status: ManagedIncidentStatus;
  assigned_to: string | null;
  sla_deadline: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
}

export type CreateManagedIncidentPayload = Pick<
  ManagedIncident,
  "client_name" | "channel" | "type" | "severity" | "responsible_area" | "title" | "description" | "assigned_to" | "sla_deadline"
>;
export type UpdateManagedIncidentPayload = Partial<CreateManagedIncidentPayload>;

export interface ManagedIncidentListResponse {
  items: ManagedIncident[];
  total: number;
  limit: number;
  offset: number;
}

export interface ManagedIncidentSummary {
  total: number;
  by_status: Partial<Record<ManagedIncidentStatus, number>>;
  by_severity: Record<IncidentSeverity, number>;
  overdue_sla: number;
}

export interface IncidentAuditEvent {
  id: string;
  incident_id: string;
  change_type: string;
  old_value: string | null;
  new_value: string | null;
  occurred_at: string;
  actor_id: string;
  actor_email: string | null;
}

export interface ManagedIncidentFilters {
  search?: string;
  status?: ManagedIncidentStatus;
  severity?: IncidentSeverity;
  type?: ManagedIncidentType;
  responsible_area?: ResponsibleArea;
  overdue_sla?: boolean;
  limit?: number;
  offset?: number;
}

export const INCIDENT_CHANNEL_LABELS: Record<IncidentChannel, string> = {
  email: "Correo electrónico",
  slack: "Slack",
  helpdesk_ticket: "Ticket de soporte",
  client_call: "Llamada de cliente",
  dashboard: "Panel de control",
};
export const MANAGED_INCIDENT_TYPE_LABELS: Record<ManagedIncidentType, string> = {
  sla_breach: "Incumplimiento de SLA",
  client_escalation: "Escalación de cliente",
  system_outage: "Caída de sistema",
  data_issue: "Problema de datos",
  staffing_gap: "Falta de personal",
  compliance_flag: "Alerta de cumplimiento",
};
export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};
export const RESPONSIBLE_AREA_LABELS: Record<ResponsibleArea, string> = {
  marketing: "Marketing",
  sales: "Ventas",
  hr_internal: "RR. HH. interno",
  talent_selection: "Selección de talento",
  corporate_training: "Formación corporativa",
  customer_support: "Atención al cliente",
  technology: "Tecnología",
};
export const MANAGED_INCIDENT_STATUS_LABELS: Record<ManagedIncidentStatus, string> = {
  open: "Abierta",
  assigned: "Asignada",
  in_progress: "En progreso",
  resolved: "Resuelta",
  closed: "Cerrada",
  reopened: "Reabierta",
};
export const INCIDENT_SEVERITY_CLASSES: Record<IncidentSeverity, string> = {
  critical: "border-red-300 bg-red-100 text-red-900",
  high: "border-orange-300 bg-orange-100 text-orange-900",
  medium: "border-amber-300 bg-amber-100 text-amber-900",
  low: "border-sky-300 bg-sky-100 text-sky-900",
};
export const INCIDENT_STATUS_TRANSITIONS: Record<ManagedIncidentStatus, ManagedIncidentStatus[]> = {
  open: ["assigned"],
  assigned: ["in_progress"],
  in_progress: ["resolved"],
  resolved: ["closed", "reopened"],
  reopened: ["assigned"],
  closed: [],
};
