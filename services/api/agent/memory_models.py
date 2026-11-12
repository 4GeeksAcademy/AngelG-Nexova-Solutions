"""Relational schema for consent-gated agent memory, isolated from RAG tables."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, Enum as SAEnum, Index, text
from sqlmodel import Field, SQLModel

from agent.memory_contract import (
    AuditEventType,
    MemoryCategory,
    MemoryScope,
    ProposalStatus,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _enum_column(enum_type: type, name: str) -> SAEnum:
    """Persist stable enum values (not Python member names) on every SQL backend."""
    return SAEnum(
        enum_type,
        name=name,
        native_enum=False,
        values_callable=lambda members: [member.value for member in members],
    )


class AgentMemoryProposal(SQLModel, table=True):
    """A proposed memory, awaiting an explicit decision in its conversation."""

    __tablename__ = "agent_memory_proposals"
    __table_args__ = (
        CheckConstraint(
            "scope != 'client' OR tenant_id IS NOT NULL",
            name="ck_agent_memory_proposal_client_tenant",
        ),
        Index(
            "uq_agent_memory_one_pending_per_thread",
            "thread_id",
            unique=True,
            postgresql_where=text("status = 'pending'"),
            sqlite_where=text("status = 'pending'"),
        ),
        Index("ix_agent_memory_proposal_owner_status", "owner_id", "status"),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    thread_id: str = Field(index=True, max_length=128)
    owner_id: str = Field(index=True, max_length=128)
    tenant_id: str | None = Field(default=None, index=True, max_length=128)
    scope: MemoryScope = Field(sa_type=_enum_column(MemoryScope, "agent_memory_scope"))
    category: MemoryCategory = Field(
        sa_type=_enum_column(MemoryCategory, "agent_memory_category")
    )
    content: str = Field(max_length=1000)
    justification: str = Field(max_length=500)
    reason_code: str = Field(default="candidate_pending_review", max_length=64)
    status: ProposalStatus = Field(
        default=ProposalStatus.PENDING,
        index=True,
        sa_type=_enum_column(ProposalStatus, "agent_memory_proposal_status"),
    )
    created_at: datetime = Field(default_factory=_utc_now, sa_type=DateTime(timezone=True))
    resolved_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    resolved_by: str | None = Field(default=None, max_length=128)
    version: int = Field(default=1, ge=1)


class AgentMemoryEntry(SQLModel, table=True):
    """Approved memory fact; no RAG/Qdrant relationship or vector field."""

    __tablename__ = "agent_memory_entries"
    __table_args__ = (
        CheckConstraint(
            "scope != 'client' OR tenant_id IS NOT NULL",
            name="ck_agent_memory_entry_client_tenant",
        ),
        Index("ix_agent_memory_entry_owner_category", "owner_id", "category"),
        Index("ix_agent_memory_entry_tenant_category", "tenant_id", "category"),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    owner_id: str = Field(index=True, max_length=128)
    tenant_id: str | None = Field(default=None, index=True, max_length=128)
    scope: MemoryScope = Field(sa_type=_enum_column(MemoryScope, "agent_memory_scope"))
    category: MemoryCategory = Field(
        sa_type=_enum_column(MemoryCategory, "agent_memory_category")
    )
    content: str = Field(max_length=1000)
    source_proposal_id: str = Field(foreign_key="agent_memory_proposals.id", index=True)
    created_at: datetime = Field(default_factory=_utc_now, sa_type=DateTime(timezone=True))
    last_confirmed_at: datetime = Field(default_factory=_utc_now, sa_type=DateTime(timezone=True))
    expires_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    revoked_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    corroboration_count: int = Field(default=1, ge=1)


class AgentMemoryAudit(SQLModel, table=True):
    """Append-only decision metadata; policy rejections must not store raw content."""

    __tablename__ = "agent_memory_audit"
    __table_args__ = (
        CheckConstraint(
            "scope IS NULL OR scope != 'client' OR tenant_id IS NOT NULL",
            name="ck_agent_memory_audit_client_tenant",
        ),
        Index("ix_agent_memory_audit_owner_time", "owner_id", "occurred_at"),
        Index("ix_agent_memory_audit_proposal_time", "proposal_id", "occurred_at"),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    proposal_id: str | None = Field(
        default=None, foreign_key="agent_memory_proposals.id", index=True
    )
    owner_id: str = Field(index=True, max_length=128)
    tenant_id: str | None = Field(default=None, index=True, max_length=128)
    scope: MemoryScope | None = Field(
        default=None, sa_type=_enum_column(MemoryScope, "agent_memory_scope")
    )
    event_type: AuditEventType = Field(
        sa_type=_enum_column(AuditEventType, "agent_memory_audit_event_type")
    )
    # Deliberately metadata-only: never persist rejected candidate text or model prompts.
    reason_code: str = Field(max_length=64)
    occurred_at: datetime = Field(default_factory=_utc_now, sa_type=DateTime(timezone=True), index=True)
