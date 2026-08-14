import { NextResponse } from "next/server";

function getIncidentsBackendUrl(): string {
  return (process.env.INCIDENTS_BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

export async function GET() {
  try {
    const upstreamResponse = await fetch(`${getIncidentsBackendUrl()}/api/incidents/results/export`, {
      method: "GET",
      cache: "no-store",
    });

    const blob = await upstreamResponse.blob();

    if (!upstreamResponse.ok) {
      const text = await blob.text();
      const contentType = upstreamResponse.headers.get("content-type") ?? "application/json";
      return new Response(text, {
        status: upstreamResponse.status,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-store",
        },
      });
    }

    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="results.csv"',
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
