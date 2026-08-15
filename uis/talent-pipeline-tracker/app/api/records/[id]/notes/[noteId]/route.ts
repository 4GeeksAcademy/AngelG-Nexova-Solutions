import { NextResponse } from "next/server";

import { db } from "../../../store";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; noteId: string }> },
) {
  const { id, noteId } = await context.params;
  const candidate = db.candidates.find((item) => item.id === id);

  if (!candidate) {
    return NextResponse.json({ detail: "Not Found" }, { status: 404 });
  }

  const notes = db.notesByRecord[id] ?? [];
  const nextNotes = notes.filter((note) => note.id !== noteId);

  if (nextNotes.length === notes.length) {
    return NextResponse.json({ detail: "Not Found" }, { status: 404 });
  }

  db.notesByRecord[id] = nextNotes;
  candidate.notes_count = nextNotes.length;
  candidate.updated_at = new Date().toISOString();

  return new Response(null, { status: 204 });
}
