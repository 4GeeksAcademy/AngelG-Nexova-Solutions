"use client";

interface CandidateSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function CandidateSearch({ value, onChange }: CandidateSearchProps) {
  return (
    <div className="w-full">
      <label htmlFor="candidate-search" className="mb-2 block text-sm font-medium text-slate-700">
        Buscar por nombre o email
      </label>
      <input
        id="candidate-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ej: Elena Vargas"
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-cyan-200 transition focus:ring"
      />
    </div>
  );
}
