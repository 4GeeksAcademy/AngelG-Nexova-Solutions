"""Typed contract and strict user-only preference policy for SDR memory."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class MemoryCategory(StrEnum):
    RESPONSE_PREFERENCE = "response_preference"


class MemoryScope(StrEnum):
    USER = "user"
    CLIENT = "client"


class ProposalStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REJECTED_DEFAULT = "rejected_default"
    EXPIRED = "expired"


class DecisionLabel(StrEnum):
    APPROVE = "approve"
    REJECT = "reject"
    EDIT = "edit"
    UNCLEAR = "unclear"


class AuditEventType(StrEnum):
    PROPOSED = "proposed"
    EDITED = "edited"
    APPROVED = "approved"
    REJECTED = "rejected"
    REJECTED_DEFAULT = "rejected_default"
    EXPIRED = "expired"
    REVOKED = "revoked"
    POLICY_REJECTED = "policy_rejected"
    CONSOLIDATED = "consolidated"


class MemoryProposal(BaseModel):
    """Candidate fact returned by generation; existence is not consent."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    content: str = Field(min_length=1, max_length=1000)
    category: MemoryCategory
    scope: MemoryScope
    justification: str = Field(min_length=1, max_length=500)

    @field_validator("content", "justification")
    @classmethod
    def reject_blank_values(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value


class AgentStructuredResponse(BaseModel):
    """Structured generation result; a proposal remains pending until consent."""

    model_config = ConfigDict(extra="forbid")

    answer: str
    memory_proposal: MemoryProposal | None = None


class MemoryDecision(BaseModel):
    """Decision classification tied to a specific proposal and message."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    proposal_id: str = Field(min_length=1, max_length=64)
    label: DecisionLabel
    edited_content: str | None = Field(default=None, min_length=1, max_length=1000)
    confidence: float = Field(ge=0.0, le=1.0)


class MemoryDecisionClassification(BaseModel):
    """Model-classified follow-up; caller supplies trusted proposal/thread IDs."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    label: DecisionLabel
    edited_content: str | None = Field(default=None, min_length=1, max_length=1000)
    confidence: float = Field(ge=0.0, le=1.0)
    followup_question: str | None = Field(default=None, max_length=2000)


class ApprovedMemory(BaseModel):
    """Validated memory candidate with explicit ownership/scope."""

    model_config = ConfigDict(extra="forbid")

    owner_id: str = Field(min_length=1, max_length=128)
    tenant_id: str | None = Field(default=None, min_length=1, max_length=128)
    category: MemoryCategory
    scope: MemoryScope
    content: str = Field(min_length=1, max_length=1000)


# The current authenticated contract supplies a user id but no trusted client/tenant id.
# Consequently client-scoped writes are disabled until authentication establishes that claim.
CLIENT_SCOPED_WRITES_ENABLED = False

# Reduced, user-only scope approved for the SDR agent while no trusted tenant
# identity exists. The repository enforces this too; a model cannot broaden it.
MEMORIZABLE_CATEGORIES = frozenset({MemoryCategory.RESPONSE_PREFERENCE})
FORBIDDEN_DATA_CLASSES = frozenset(
    {
        "prospect_or_client_data",
        "commercial_facts_or_policies",
        "candidate_personal_data",
        "active_headhunting_salary_negotiation",
        "one_off_ticket_correction",
        "credentials_or_tokens",
    }
)

# Conservative bounds for the reduced user-preference scope.
MAX_ACTIVE_PROPOSALS_PER_THREAD = 1
MAX_MEMORY_ENTRIES_PER_OWNER = 100
MAX_MEMORY_CONTENT_CHARS = 1000
MAX_MEMORY_ENTRIES_PER_RETRIEVAL = 10
MEMORY_RETENTION_DAYS = 90
PROPOSAL_RETENTION_DAYS = 30
MEMORY_AUDIT_RETENTION_DAYS = 365
MIN_DECISION_CONFIDENCE = 0.85


def validate_scope_identity(scope: MemoryScope, owner_id: str, tenant_id: str | None) -> None:
    """Fail closed unless required authenticated ownership is present."""
    if not owner_id.strip():
        raise ValueError("owner_id is required")
    if scope is MemoryScope.CLIENT:
        if not CLIENT_SCOPED_WRITES_ENABLED:
            raise ValueError("client-scoped memory is disabled: no trusted tenant identity")
        if tenant_id is None or not tenant_id.strip():
            raise ValueError("tenant_id is required for client-scoped memory")
    elif tenant_id is not None:
        raise ValueError("user-scoped memory must not carry tenant_id")
