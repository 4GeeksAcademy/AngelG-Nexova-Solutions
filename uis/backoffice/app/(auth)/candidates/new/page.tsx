"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CandidateForm } from "@/components/CandidateForm";
import { createRecord } from "@/lib/api";
import type { CreateCandidatePayload } from "@/types/candidate";

export default function NewCandidatePage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  async function submit(payload: CreateCandidatePayload) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try {
      const candidate = await createRecord(payload);
      router.push(`/candidates/${encodeURIComponent(candidate.id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar la candidatura.");
    } finally { pending.current = false; setBusy(false); }
  }
  return <main className="min-h-screen px-4 py-8 md:px-10">
    <section className="mx-auto grid max-w-3xl gap-6 rounded-2xl border bg-white/90 p-6">
      <Link href="/" className="font-semibold text-cyan-800">← Volver al pipeline</Link>
      <h1 className="text-2xl font-bold">Registrar candidatura</h1>
      {error && <p role="alert" className="text-red-900">{error}</p>}
      <fieldset disabled={busy}><CandidateForm isSubmitting={busy} onSubmit={submit} /></fieldset>
    </section>
  </main>;
}
