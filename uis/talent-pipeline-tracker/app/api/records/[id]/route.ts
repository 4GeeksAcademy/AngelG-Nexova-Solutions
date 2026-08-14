import { NextResponse } from "next/server";

import { db } from "../store";

function findCandidate(id: string) {
  return db.candidates.find((candidate) => candidate.id === id);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const candidate = findCandidate(id);

  if (!candidate) {
    return NextResponse.json({ detail: "Not Found" }, { status: 404 });
  }

  return NextResponse.json(candidate);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const candidate = findCandidate(id);

  if (!candidate) {
    return NextResponse.json({ detail: "Not Found" }, { status: 404 });
  }

  const payload = await request.json();
  if (payload.status !== undefined) {
    candidate.status = payload.status;
  }
  if (payload.stage !== undefined) {
    candidate.stage = payload.stage;
  }
  candidate.updated_at = new Date().toISOString();

  return NextResponse.json(candidate);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const candidate = findCandidate(id);

  if (!candidate) {
    return NextResponse.json({ detail: "Not Found" }, { status: 404 });
  }

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

  candidate.full_name = String(payload.full_name);
  candidate.email = String(payload.email);
  candidate.phone = String(payload.phone);
  candidate.position = String(payload.position);
  candidate.linkedin_url = payload.linkedin_url ? String(payload.linkedin_url) : null;
  candidate.cv_url = payload.cv_url ? String(payload.cv_url) : null;
  candidate.experience_years = Number(payload.experience_years);
  candidate.updated_at = new Date().toISOString();

  return NextResponse.json(candidate);
}
