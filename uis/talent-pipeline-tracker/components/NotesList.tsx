"use client";

import { Note } from "@/types/note";

interface NotesListProps {
  notes: Note[];
  onDelete: (noteId: string) => Promise<void>;
  deletingNoteId: string | null;
}

export function NotesList({ notes, onDelete, deletingNoteId }: NotesListProps) {
  if (notes.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        Aun no hay notas internas para esta candidatura.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <li key={note.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-sm leading-6 text-slate-800">{note.content}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {new Date(note.created_at).toLocaleString("es-ES")}
            </span>
            <button
              type="button"
              onClick={() => onDelete(note.id)}
              disabled={deletingNoteId === note.id}
              className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletingNoteId === note.id ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
