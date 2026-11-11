"use client";

import { FormEvent, useState } from "react";
import { ErrorMessage } from "@/components/ErrorMessage";
import {
  CreateManagedIncidentPayload,
  ManagedIncident,
  INCIDENT_CHANNELS,
  INCIDENT_CHANNEL_LABELS,
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_LABELS,
  MANAGED_INCIDENT_TYPES,
  MANAGED_INCIDENT_TYPE_LABELS,
  RESPONSIBLE_AREAS,
  RESPONSIBLE_AREA_LABELS,
} from "@/types/managed-incident";

interface IncidentFormProps {
  isSubmitting?: boolean;
  error?: string | null;
  fieldErrors?: Record<string, string>;
  initialIncident?: ManagedIncident;
  submitLabel?: string;
  onSubmit: (payload: CreateManagedIncidentPayload) => Promise<void>;
}
type Values = Omit<CreateManagedIncidentPayload, "sla_deadline"> & { sla_deadline: string };
const initialValues: Values = {
  client_name: "", channel: "email", type: "client_escalation", severity: "medium",
  responsible_area: "customer_support", title: "", description: "", assigned_to: "", sla_deadline: "",
};
const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100";

function localDeadline(value: string): string {
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function IncidentForm({ isSubmitting = false, error, fieldErrors = {}, initialIncident, submitLabel, onSubmit }: IncidentFormProps) {
  const [values, setValues] = useState<Values>(() => initialIncident ? {
    client_name: initialIncident.client_name ?? "", channel: initialIncident.channel, type: initialIncident.type,
    severity: initialIncident.severity, responsible_area: initialIncident.responsible_area,
    title: initialIncident.title, description: initialIncident.description,
    assigned_to: initialIncident.assigned_to ?? "",
    sla_deadline: initialIncident.sla_deadline ? localDeadline(initialIncident.sla_deadline) : "",
  } : initialValues);
  const [validationError, setValidationError] = useState<string | null>(null);
  const needsDeadline = values.type === "sla_breach";

  function setValue<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.title.trim() || !values.description.trim()) {
      setValidationError("Completa el título y la descripción.");
      return;
    }
    if (needsDeadline && !values.sla_deadline) {
      setValidationError("Indica la fecha límite del SLA para este tipo de incidencia.");
      return;
    }
    setValidationError(null);
    await onSubmit({
      client_name: (values.client_name ?? "").trim() || null,
      channel: values.channel,
      type: values.type,
      severity: values.severity,
      responsible_area: values.responsible_area,
      title: values.title.trim(),
      description: values.description.trim(),
      assigned_to: (values.assigned_to ?? "").trim() || null,
      sla_deadline: needsDeadline
        ? initialIncident?.sla_deadline && values.sla_deadline === localDeadline(initialIncident.sla_deadline)
          ? initialIncident.sla_deadline
          : new Date(values.sla_deadline).toISOString()
        : null,
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      {error ? <ErrorMessage title="No se pudo guardar la incidencia" message={error} /> : null}
      {validationError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{validationError}</p> : null}
      <Field label="Título" id="incident-title" error={fieldErrors.title}>
        <input id="incident-title" className={inputClass} maxLength={200} required value={values.title} onChange={(e) => setValue("title", e.target.value)} />
      </Field>
      <Field label="Descripción" id="incident-description" error={fieldErrors.description}>
        <textarea id="incident-description" className={inputClass} rows={5} required value={values.description} onChange={(e) => setValue("description", e.target.value)} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField id="incident-channel" label="Canal de entrada" value={values.channel} onChange={(v) => setValue("channel", v as Values["channel"])} options={INCIDENT_CHANNELS.map((v) => [v, INCIDENT_CHANNEL_LABELS[v]])} />
        <SelectField id="incident-type" label="Tipo" value={values.type} onChange={(v) => setValue("type", v as Values["type"])} options={MANAGED_INCIDENT_TYPES.map((v) => [v, MANAGED_INCIDENT_TYPE_LABELS[v]])} />
        <SelectField id="incident-severity" label="Severidad" value={values.severity} onChange={(v) => setValue("severity", v as Values["severity"])} options={INCIDENT_SEVERITIES.map((v) => [v, INCIDENT_SEVERITY_LABELS[v]])} />
        <SelectField id="incident-area" label="Área responsable" value={values.responsible_area} onChange={(v) => setValue("responsible_area", v as Values["responsible_area"])} options={RESPONSIBLE_AREAS.map((v) => [v, RESPONSIBLE_AREA_LABELS[v]])} />
        <Field label="Cliente (opcional)" id="incident-client"><input id="incident-client" className={inputClass} value={values.client_name ?? ""} onChange={(e) => setValue("client_name", e.target.value)} /></Field>
        <Field label="Asignar a (opcional)" id="incident-assignee" error={fieldErrors.assigned_to}><input id="incident-assignee" className={inputClass} value={values.assigned_to ?? ""} onChange={(e) => setValue("assigned_to", e.target.value)} /></Field>
        {needsDeadline ? <Field label="Fecha límite del SLA" id="incident-deadline" error={fieldErrors.sla_deadline}><input id="incident-deadline" type="datetime-local" required className={inputClass} value={values.sla_deadline} onChange={(e) => setValue("sla_deadline", e.target.value)} /></Field> : null}
      </div>
      <button type="submit" disabled={isSubmitting} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? "Guardando…" : submitLabel ?? "Crear incidencia"}</button>
    </form>
  );
}

function Field({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
  const errorId = `${id}-error`;
  return <div className="grid gap-2"><label htmlFor={id} className="text-sm font-semibold text-slate-800">{label}</label>{children}{error ? <p id={errorId} className="text-sm text-red-700">{error}</p> : null}</div>;
}
function SelectField({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return <Field id={id} label={label}><select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></Field>;
}
