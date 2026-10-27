"use client";

import { FormEvent, useState } from "react";

import { ErrorMessage } from "@/components/ErrorMessage";
import {
  CreateIncidentPayload,
  INCIDENT_BRANCHES,
  INCIDENT_BRANCH_LABELS,
  INCIDENT_CATEGORIES,
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_ORIGINS,
  INCIDENT_ORIGIN_LABELS,
  INCIDENT_STATUSES,
  INCIDENT_STATUS_LABELS,
  IncidentBranch,
  IncidentCategory,
  IncidentOrigin,
  IncidentStatus,
} from "@/types/incident";

interface IncidentFormProps {
  isSubmitting?: boolean;
  error?: string | null;
  fieldErrors?: Record<string, string>;
  onSubmit: (payload: CreateIncidentPayload) => Promise<void>;
}

interface FormValues {
  title: string;
  description: string;
  category: IncidentCategory | "";
  status: IncidentStatus;
  origin: IncidentOrigin | "";
  branch: IncidentBranch | "";
}

type FormErrors = Partial<Record<keyof FormValues, string>>;

const initialValues: FormValues = {
  title: "",
  description: "",
  category: "",
  status: "open",
  origin: "",
  branch: "",
};

const inputClassName =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100";

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.title.trim()) errors.title = "El título es obligatorio.";
  if (!values.description.trim()) errors.description = "La descripción es obligatoria.";
  if (!values.category) errors.category = "Selecciona una categoría.";
  if (!values.status) errors.status = "Selecciona un estado.";
  if (!values.origin) errors.origin = "Selecciona un origen.";
  if (!values.branch) errors.branch = "Selecciona una sede.";
  return errors;
}

export function IncidentForm({
  isSubmitting = false,
  error,
  fieldErrors = {},
  onSubmit,
}: IncidentFormProps) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});

  function updateValue<Field extends keyof FormValues>(field: Field, value: FormValues[Field]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0 || !values.category || !values.origin || !values.branch) {
      return;
    }

    await onSubmit({
      title: values.title.trim(),
      description: values.description.trim(),
      category: values.category,
      status: values.status,
      origin: values.origin,
      branch: values.branch,
    });
  }

  const branchNeedsAttention = values.origin === "branch";

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-6">
      {error ? <ErrorMessage title="No se pudo crear la incidencia" message={error} /> : null}

      <div className="grid gap-2">
        <label htmlFor="incident-title" className="text-sm font-semibold text-slate-800">
          Título
        </label>
        <input
          id="incident-title"
          value={values.title}
          maxLength={120}
          onChange={(event) => updateValue("title", event.target.value)}
          aria-invalid={Boolean(errors.title || fieldErrors.title)}
          aria-describedby={errors.title || fieldErrors.title ? "incident-title-error" : undefined}
          className={inputClassName}
        />
        {errors.title || fieldErrors.title ? <p id="incident-title-error" className="text-sm text-red-700">{errors.title ?? fieldErrors.title}</p> : null}
      </div>

      <div className="grid gap-2">
        <label htmlFor="incident-description" className="text-sm font-semibold text-slate-800">
          Descripción
        </label>
        <textarea
          id="incident-description"
          value={values.description}
          rows={5}
          onChange={(event) => updateValue("description", event.target.value)}
          aria-invalid={Boolean(errors.description || fieldErrors.description)}
          aria-describedby={errors.description || fieldErrors.description ? "incident-description-error" : undefined}
          className={inputClassName}
        />
        {errors.description || fieldErrors.description ? <p id="incident-description-error" className="text-sm text-red-700">{errors.description ?? fieldErrors.description}</p> : null}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <SelectField
          id="incident-category"
          label="Categoría"
          value={values.category}
          placeholder="Selecciona una categoría"
          options={INCIDENT_CATEGORIES.map((value) => ({ value, label: INCIDENT_CATEGORY_LABELS[value] }))}
          error={errors.category ?? fieldErrors.category}
          onChange={(value) => updateValue("category", value as IncidentCategory)}
        />

        <SelectField
          id="incident-status"
          label="Estado"
          value={values.status}
          options={INCIDENT_STATUSES.map((value) => ({ value, label: INCIDENT_STATUS_LABELS[value] }))}
          error={errors.status ?? fieldErrors.status}
          onChange={(value) => updateValue("status", value as IncidentStatus)}
        />

        <SelectField
          id="incident-origin"
          label="Origen"
          value={values.origin}
          placeholder="Selecciona un origen"
          options={INCIDENT_ORIGINS.map((value) => ({ value, label: INCIDENT_ORIGIN_LABELS[value] }))}
          error={errors.origin ?? fieldErrors.origin}
          onChange={(value) => updateValue("origin", value as IncidentOrigin)}
        />

        <div className={branchNeedsAttention ? "rounded-2xl border-2 border-cyan-500 bg-cyan-50 p-3" : ""}>
          {branchNeedsAttention ? (
            <p className="mb-3 text-sm font-semibold text-cyan-950">Selecciona la sede desde la que se reporta la incidencia.</p>
          ) : null}
          <SelectField
            id="incident-branch"
            label="Sede"
            value={values.branch}
            placeholder="Selecciona una sede"
            options={INCIDENT_BRANCHES.map((value) => ({ value, label: INCIDENT_BRANCH_LABELS[value] }))}
            error={errors.branch ?? fieldErrors.branch}
            onChange={(value) => updateValue("branch", value as IncidentBranch)}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Creando incidencia..." : "Crear incidencia"}
      </button>
    </form>
  );
}

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
  error?: string;
  onChange: (value: string) => void;
}

function SelectField({ id, label, value, placeholder, options, error, onChange }: SelectFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-slate-800">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={inputClassName}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p id={errorId} className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}