"use client";

export function NumberedPagination({ page, total, pageSize = 10, onChange }: {
  page: number; total: number; pageSize?: number; onChange: (page: number) => void;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const buttonClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50";
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center gap-2">
      <button type="button" className={buttonClass} disabled={page === 1} onClick={() => onChange(page - 1)}>Anterior</button>
      {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
        <button key={number} type="button" aria-label={`Página ${number}`} aria-current={page === number ? "page" : undefined}
          className={`${buttonClass} ${page === number ? "border-cyan-700 bg-cyan-50 font-bold text-cyan-900" : ""}`}
          onClick={() => onChange(number)}>{number}</button>
      ))}
      <button type="button" className={buttonClass} disabled={page === pages} onClick={() => onChange(page + 1)}>Siguiente</button>
    </nav>
  );
}
