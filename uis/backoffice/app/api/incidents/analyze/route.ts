import { NextResponse } from "next/server";

function getIncidentsBackendUrl(): string {
  return (process.env.INCIDENTS_BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_MULTIPART",
          message: "No se pudo leer el formulario multipart.",
        },
      },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        error: {
          code: "MISSING_FILE",
          message: "Debes enviar un fichero CSV en el campo 'file'.",
        },
      },
      { status: 400 },
    );
  }

  const upstreamForm = new FormData();
  upstreamForm.append("file", file);

  try {
    const upstreamResponse = await fetch(`${getIncidentsBackendUrl()}/api/incidents/analyze`, {
      method: "POST",
      body: upstreamForm,
      cache: "no-store",
    });

    const text = await upstreamResponse.text();
    const contentType = upstreamResponse.headers.get("content-type") ?? "application/json";

    return new Response(text, {
      status: upstreamResponse.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "No se pudo conectar con el servicio de analisis de incidencias.",
        },
      },
      { status: 502 },
    );
  }
}
