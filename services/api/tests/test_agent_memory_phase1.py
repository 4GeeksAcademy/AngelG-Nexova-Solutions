from __future__ import annotations

from datetime import timedelta

import pytest
from sqlalchemy import inspect
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from agent.memory_contract import (
    AgentStructuredResponse,
    AuditEventType,
    DecisionLabel,
    MemoryCategory,
    MemoryDecision,
    MemoryProposal,
    MemoryScope,
    ProposalStatus,
    validate_scope_identity,
)
from agent.memory_models import (
    AgentMemoryAudit,
    AgentMemoryEntry,
    AgentMemoryProposal,
    _utc_now,
)


@pytest.fixture
def memory_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


def test_structured_response_accepts_optional_allowed_proposal():
    result = AgentStructuredResponse.model_validate(
        {
            "answer": "Entendido.",
            "memory_proposal": {
                "content": "Prefiero respuestas breves con viñetas.",
                "category": "response_preference",
                "scope": "user",
                "justification": "Procedimiento corregido y repetible.",
            },
        }
    )
    assert result.memory_proposal is not None
    assert result.memory_proposal.category is MemoryCategory.RESPONSE_PREFERENCE


def test_contract_rejects_unknown_fields_and_blank_proposals():
    with pytest.raises(ValueError):
        MemoryProposal.model_validate(
            {
                "content": " ",
                "category": "client_preference",
                "scope": "client",
                "justification": "Preferencia recurrente.",
                "raw_candidate_data": "must not be accepted",
            }
        )


def test_decision_is_bound_to_proposal_and_confidence_is_bounded():
    decision = MemoryDecision(
        proposal_id="proposal-1",
        label=DecisionLabel.APPROVE,
        confidence=0.99,
    )
    assert decision.proposal_id == "proposal-1"
    with pytest.raises(ValueError):
        MemoryDecision(proposal_id="proposal-1", label="approve", confidence=1.1)


def test_client_scope_fails_closed_without_trusted_tenant():
    with pytest.raises(ValueError, match="disabled"):
        validate_scope_identity(MemoryScope.CLIENT, "user-1", "client-1")
    with pytest.raises(ValueError, match="required"):
        validate_scope_identity(MemoryScope.USER, "", None)
    validate_scope_identity(MemoryScope.USER, "user-1", None)


def test_memory_schema_uses_its_own_tables_not_rag_collections(memory_engine):
    table_names = set(inspect(memory_engine).get_table_names())
    assert {
        "agent_memory_proposals",
        "agent_memory_entries",
        "agent_memory_audit",
    } <= table_names
    assert not any("knowledge" in table_name or "qdrant" in table_name for table_name in table_names)
    assert "uq_agent_memory_one_pending_per_thread" in {
        index["name"] for index in inspect(memory_engine).get_indexes("agent_memory_proposals")
    }


def test_pending_proposal_is_unique_per_thread_and_client_scope_requires_tenant(memory_engine):
    with Session(memory_engine) as session:
        proposal = AgentMemoryProposal(
            thread_id="thread-1",
            owner_id="user-1",
            scope=MemoryScope.USER,
            category=MemoryCategory.RESPONSE_PREFERENCE,
            content="Escalar de acuerdo con el nuevo SLA.",
            justification="Cambio repetible.",
        )
        session.add(proposal)
        session.commit()
        session.add(
            AgentMemoryProposal(
                thread_id="thread-1",
                owner_id="user-1",
                scope=MemoryScope.USER,
                category=MemoryCategory.RESPONSE_PREFERENCE,
                content="Una segunda propuesta pendiente.",
                justification="No debe coexistir.",
            )
        )
        with pytest.raises(Exception):
            session.commit()
        session.rollback()
        session.add(
            AgentMemoryProposal(
                thread_id="thread-client",
                owner_id="user-1",
                scope=MemoryScope.CLIENT,
                category=MemoryCategory.RESPONSE_PREFERENCE,
                content="Preferencia cliente.",
                justification="Recurrente.",
            )
        )
        with pytest.raises(Exception):
            session.commit()


def test_approved_entry_and_metadata_only_audit(memory_engine):
    now = _utc_now()
    with Session(memory_engine) as session:
        proposal = AgentMemoryProposal(
            thread_id="thread-2",
            owner_id="user-2",
            scope=MemoryScope.USER,
            category=MemoryCategory.RESPONSE_PREFERENCE,
            content="Patrón recurrente de tickets.",
            justification="Repetido en el helpdesk.",
            status=ProposalStatus.APPROVED,
            resolved_at=now,
            resolved_by="user-2",
        )
        session.add(proposal)
        session.flush()
        entry = AgentMemoryEntry(
            owner_id="user-2",
            scope=MemoryScope.USER,
            category=MemoryCategory.RESPONSE_PREFERENCE,
            content=proposal.content,
            source_proposal_id=proposal.id,
            expires_at=now + timedelta(days=90),
        )
        audit = AgentMemoryAudit(
            proposal_id=proposal.id,
            owner_id="user-2",
            scope=MemoryScope.USER,
            event_type=AuditEventType.APPROVED,
            reason_code="explicit_consent",
        )
        session.add(entry)
        session.add(audit)
        session.commit()

        stored_audit = session.get(AgentMemoryAudit, audit.id)
        assert stored_audit is not None
        assert stored_audit.reason_code == "explicit_consent"
        assert not hasattr(stored_audit, "content")
        assert entry.source_proposal_id == proposal.id
