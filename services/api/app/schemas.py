from __future__ import annotations

from pydantic import BaseModel


class AnalysisTotalsResponse(BaseModel):
    processed: int
    valid: int
    invalid: int


class SatisfactionResponse(BaseModel):
    closed_with_score: int
    closed_valid_records: int
    average_closed: float | None
    distribution: dict[str, int]


class RecordErrorResponse(BaseModel):
    row_number: int
    error_type: str
    field: str
    value: str
    message: str


class InvalidRecordResponse(BaseModel):
    row_number: int
    primary_error_type: str
    errors: list[RecordErrorResponse]


class InvalidRecordsResponse(BaseModel):
    by_type: dict[str, int]
    records: list[InvalidRecordResponse]


class ExportMetricResponse(BaseModel):
    section: str
    metric: str
    value: str


class AnalysisResponse(BaseModel):
    totals: AnalysisTotalsResponse
    by_category: dict[str, int]
    by_status: dict[str, int]
    satisfaction: SatisfactionResponse
    invalid: InvalidRecordsResponse
    export_rows: list[ExportMetricResponse]


class AnalysisErrorDetail(BaseModel):
    code: str
    message: str


class AnalysisErrorResponse(BaseModel):
    error: AnalysisErrorDetail