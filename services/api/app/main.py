from __future__ import annotations

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse, Response

from .incidents_service import (
    analysis_result_to_csv,
    analyze_csv_content,
    get_last_result,
)
from packages.incidents_analysis.models import AnalysisInputError


app = FastAPI(title="Nexova Incidents API", version="1.0.0")


@app.post("/api/incidents/analyze")
async def analyze_incidents(file: UploadFile | None = File(default=None)) -> Response:
    if file is None:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "MISSING_FILE",
                    "message": "Debes enviar un fichero CSV en el campo 'file'.",
                }
            },
        )

    if not file.filename or not file.filename.lower().endswith(".csv"):
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_FILE_TYPE",
                    "message": "El fichero debe tener extension .csv.",
                }
            },
        )

    raw_content = await file.read()
    if len(raw_content) == 0:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "EMPTY_FILE",
                    "message": "El fichero CSV esta vacio.",
                }
            },
        )

    try:
        csv_text = raw_content.decode("utf-8")
    except UnicodeDecodeError:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_ENCODING",
                    "message": "El fichero CSV debe estar codificado en UTF-8.",
                }
            },
        )

    try:
        payload = analyze_csv_content(csv_text)
    except AnalysisInputError as error:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": error.code,
                    "message": error.message,
                }
            },
        )

    return JSONResponse(status_code=200, content=payload)


@app.get("/api/incidents/results/export")
async def export_incidents_results() -> Response:
    result = get_last_result()
    if result is None:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "NO_RESULTS",
                    "message": "No existe un analisis previo para exportar.",
                }
            },
        )

    csv_content = analysis_result_to_csv(result)
    filename = "results.csv"
    return Response(
        content=csv_content,
        status_code=200,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )
