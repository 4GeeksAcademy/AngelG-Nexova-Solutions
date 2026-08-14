import { NextResponse } from "next/server";

import { db } from "../../store";

function ensureRecord(id: string) {
  return db.candidates.find((candidate) => candidate.id === id);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const candidate = ensureRecord(id);

  if (!candidate) {
    return NextResponse.json({ detail: "Not Found" }, { status: 404 });
  }

  const notes = db.notesByRecord[id] ?? [];
  return NextResponse.json({
    data: notes,
    meta: {
      total: notes.length,
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const candidate = ensureRecord(id);

  if (!candidate) {
    return NextResponse.json({ detail: "Not Found" }, { status: 404 });
  }

  const payload = await request.json();
  const content = typeof payload?.content === "string" ? payload.content.trim() : "";
  if (!content) {
    return new NextResponse("El contenido de la nota es obligatorio.", { status: 400 });
  }

  const note = {
    id: crypto.randomUUID(),
    record_id: id,
    content,
    created_at: new Date().toISOString(),
  };

  const list = db.notesByRecord[id] ?? [];
  list.unshift(note);
  db.notesByRecord[id] = list;

  candidate.notes_count = list.length;
  candidate.updated_at = new Date().toISOString();

  return NextResponse.json(note, { status: 201 });
}
