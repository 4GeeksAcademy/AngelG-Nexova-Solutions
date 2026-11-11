"use client";

import { FormEvent, useState } from "react";

import { CreateCandidatePayload } from "@/types/candidate";

interface CandidateFormProps {
  initialValues?: Partial<CreateCandidatePayload>;
  submitLabel?: string;
  isSubmitting?: boolean;
  onSubmit: (payload: CreateCandidatePayload) => Promise<void>;
}

export function CandidateForm({
  initialValues,
  submitLabel = "Guardar candidatura",
  isSubmitting = false,
  onSubmit,
}: CandidateFormProps) {
  const [fullName, setFullName] = useState(initialValues?.full_name ?? "");
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [phone, setPhone] = useState(initialValues?.phone ?? "");
  const [position, setPosition] = useState(initialValues?.position ?? "Executive Assistant");
  const [linkedinUrl, setLinkedinUrl] = useState(initialValues?.linkedin_url ?? "");
  const [cvUrl, setCvUrl] = useState(initialValues?.cv_url ?? "");
  const [experienceYears, setExperienceYears] = useState(
    initialValues?.experience_years?.toString() ?? "0",
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      position: position.trim(),
      linkedin_url: linkedinUrl.trim() || null,
      cv_url: cvUrl.trim() || null,
      experience_years: Number(experienceYears),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <input
        required
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        aria-label="Nombre completo"
        placeholder="Nombre completo"
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        required
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        aria-label="Email"
        placeholder="Email"
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        required
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        aria-label="Teléfono"
        placeholder="Telefono"
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        required
        value={position}
        onChange={(event) => setPosition(event.target.value)}
        aria-label="Puesto"
        placeholder="Puesto"
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        value={linkedinUrl}
        onChange={(event) => setLinkedinUrl(event.target.value)}
        aria-label="LinkedIn URL"
        placeholder="LinkedIn URL"
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        value={cvUrl}
        onChange={(event) => setCvUrl(event.target.value)}
        aria-label="CV URL"
        placeholder="CV URL"
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        required
        type="number"
        min={0}
        step={1}
        value={experienceYears}
        onChange={(event) => setExperienceYears(event.target.value)}
        aria-label="Años de experiencia"
        placeholder="Anos de experiencia"
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Guardando..." : submitLabel}
      </button>
    </form>
  );
}
