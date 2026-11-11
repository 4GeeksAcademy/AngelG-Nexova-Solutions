"""Explicit response contracts for weekly reporting endpoints."""

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict


class WeeklyPerformanceEntryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    office: Literal["valencia", "miami"]
    programme_id: str
    total_material_cost: Decimal
    kits_delivered_count: int
    shortage_events_count: int
    cost_variance_events_count: int
    currency: Literal["EUR", "USD"]


class WeeklyPerformanceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    week_start: date
    entries: list[WeeklyPerformanceEntryResponse]