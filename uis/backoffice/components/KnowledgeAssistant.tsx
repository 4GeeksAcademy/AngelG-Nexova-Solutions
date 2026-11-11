"use client";

import { FormEvent, useState } from "react";

import { askKnowledge, type KnowledgeAnswer } from "@/lib/knowledge-api";

export function KnowledgeAssistant() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<KnowledgeAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuestion = question.trim();
    if (!normalizedQuestion || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await askKnowledge(normalizedQuestion);
      setResult(response);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo obtener una respuesta. Inténtalo de nuevo.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 md:px-8">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
          Herramienta para SDRs
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
          Conocimiento de Nexova
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
          Consulta servicios, tarifas, procesos y objeciones. Las respuestas se basan
          en la documentación comercial aprobada; confirma con un account manager
          cualquier condición que no esté cubierta.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <label
          htmlFor="knowledge-question"
          className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100"
        >
          ¿Qué necesitas responder al prospecto?
        </label>
        <textarea
          id="knowledge-question"
          name="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={2000}
          rows={4}
          required
          placeholder="Ej.: ¿Cómo funciona la tarifa de headhunting y cuándo se factura?"
          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 dark:border-slate-600 dark:bg-slate-950 dark:text-white dark:focus:ring-cyan-950"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            No se muestran fragmentos internos de recuperación.
          </span>
          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            className="rounded-full bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-600 dark:hover:bg-cyan-500"
          >
            {isLoading ? "Consultando…" : "Consultar"}
          </button>
        </div>
      </form>

      {isLoading ? (
        <p role="status" className="mt-6 text-sm text-slate-600 dark:text-slate-300">
          Buscando información en la base de conocimiento…
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}
      {result ? (
  <section
    aria-labelledby="knowledge-answer-title"
    className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-5 dark:border-cyan-900 dark:bg-cyan-950/30"
  >
    <h2
      id="knowledge-answer-title"
      className="text-lg font-semibold text-slate-900 dark:text-white"
    >
      Respuesta sugerida
    </h2>

    <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-800 dark:text-slate-100">
      {result.answer}
    </p>

    {result.sources.length > 0 ? (
      <div className="mt-4 border-t border-cyan-200 pt-3 dark:border-cyan-900">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Fuentes
        </h3>
        <ul className="mt-2 list-inside list-disc text-sm text-slate-600 dark:text-slate-300">
          {result.sources.map((source) => (
            <li key={`${source.document}:${source.section}`}>
              {source.document} — {source.section}
            </li>
          ))}
        </ul>
      </div>
    ) : null}

    <p className="mt-4 border-t border-cyan-200 pt-3 text-xs text-slate-600 dark:border-cyan-900 dark:text-slate-300">
      Verifica las condiciones comerciales específicas antes de confirmarlas al prospecto.
    </p>
  </section>
) : null}
    </main>
  );
}