"use client";

import { FormEvent, useState } from "react";

interface AddNoteFormProps {
  onSubmit: (content: string) => Promise<void>;
  isSubmitting: boolean;
}

export function AddNoteForm({ onSubmit, isSubmitting }: AddNoteFormProps) {
  const [content, setContent] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return;
    }

    await onSubmit(trimmedContent);
    setContent("");
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4">
      <label htmlFor="note-content" className="mb-2 block text-sm font-medium text-slate-700">
        Nueva nota interna
      </label>
      <textarea
        id="note-content"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        rows={3}
        placeholder="Ej: Entrevista personal completada, buen nivel de ingles y alta disponibilidad."
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-200 transition focus:ring"
      />
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-cyan-700 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Guardando..." : "Agregar nota"}
        </button>
      </div>
    </form>
  );
}
