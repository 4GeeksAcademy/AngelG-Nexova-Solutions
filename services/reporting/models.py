from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Date, DateTime, Integer, Numeric, String, UniqueConstraint, Uuid
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class WeeklyPerformance(Base):
    __tablename__ = "weekly_office_program_performance"
    __table_args__ = (
        UniqueConstraint("office", "programme_id", "week_start"),
        {"schema": "reporting"},
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    office: Mapped[str] = mapped_column(String)
    programme_id: Mapped[str] = mapped_column(String)
    week_start: Mapped[date] = mapped_column(Date)
    total_material_cost: Mapped[Decimal] = mapped_column(Numeric, default=0)
    kits_delivered_count: Mapped[int] = mapped_column(Integer, default=0)
    shortage_events_count: Mapped[int] = mapped_column(Integer, default=0)
    cost_variance_events_count: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"
    __table_args__ = {"schema": "reporting"}

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    week_start: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source_cutoff: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    events_read: Mapped[int] = mapped_column(Integer, default=0)
    rows_written: Mapped[int] = mapped_column(Integer, default=0)
    error_code: Mapped[str | None] = mapped_column(String)
