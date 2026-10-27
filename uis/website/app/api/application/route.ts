const MAX_BODY_BYTES = 16_384;

const candidateFields = [
  "full_name",
  "email",
  "phone",
  "position",
  "experience_years",
  "linkedin_url",
  "cv_url",
] as const;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ message: "Solicitud demasiado grande." }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Solicitud inválida." }, { status: 400 });
  }

  if (typeof body.website === "string" && body.website.trim()) {
    return Response.json({ ok: true });
  }

  const payload = Object.fromEntries(candidateFields.map((field) => [field, body[field]]));
  const apiBaseUrl = (process.env.API_INTERNAL_URL ?? process.env.API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

  try {
    const upstream = await fetch(`${apiBaseUrl}/records/public`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, website: "" }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });

    if (upstream.ok) return Response.json({ ok: true }, { status: 201 });
    if (upstream.status === 400 || upstream.status === 422 || upstream.status === 429) {
      return Response.json({ message: "No se pudo validar la candidatura." }, { status: upstream.status });
    }
    return Response.json({ message: "Servicio de candidaturas no disponible." }, { status: 502 });
  } catch {
    return Response.json({ message: "Servicio de candidaturas no disponible." }, { status: 502 });
  }
}