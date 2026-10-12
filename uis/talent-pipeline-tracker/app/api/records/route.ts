import { NextResponse } from "next/server";

import { db } from "./store";

export async function GET() {
  return NextResponse.json({
    total: db.candidates.length,
    page: 1,
    limit: db.candidates.length,
    data: db.candidates,
  });
}

export async function POST(request: Request) {
  const payload = await request.json();

  if (
    !payload ||
    !payload.full_name ||
    !payload.email ||
    !payload.phone ||
    !payload.position ||
    typeof payload.experience_years !== "number"
  ) {
    return new NextResponse("Payload invalido.", { status: 400 });
  }

  const timestamp = new Date().toISOString();
  const candidate = {
    id: crypto.randomUUID(),
    full_name: String(payload.full_name),
    email: String(payload.email),
    phone: String(payload.phone),
    position: String(payload.position),
    linkedin_url: payload.linkedin_url ? String(payload.linkedin_url) : null,
    cv_url: payload.cv_url ? String(payload.cv_url) : null,
    status: "received" as const,
    stage: "pending" as const,
    experience_years: Number(payload.experience_years),
    notes_count: 0,
    applied_at: timestamp,
    updated_at: timestamp,
  };

  db.candidates.unshift(candidate);
  db.notesByRecord[candidate.id] = [];

  return NextResponse.json(candidate, { status: 201 });
}
