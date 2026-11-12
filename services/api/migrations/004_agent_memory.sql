-- Dedicated episodic memory tables. No RAG/Qdrant collection is touched.
-- Apply once to PostgreSQL deployments before enabling memory writes.
CREATE TABLE IF NOT EXISTS agent_memory_proposals (
    id VARCHAR(36) PRIMARY KEY,
    thread_id VARCHAR(128) NOT NULL,
    owner_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128),
    scope VARCHAR(16) NOT NULL,
    category VARCHAR(40) NOT NULL,
    content VARCHAR(1000) NOT NULL,
    justification VARCHAR(500) NOT NULL,
    reason_code VARCHAR(64) NOT NULL DEFAULT 'candidate_pending_review',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(128),
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT ck_agent_memory_proposal_client_tenant
        CHECK (scope <> 'client' OR tenant_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_agent_memory_proposals_thread_id
    ON agent_memory_proposals(thread_id);
CREATE INDEX IF NOT EXISTS ix_agent_memory_proposals_owner_id
    ON agent_memory_proposals(owner_id);
CREATE INDEX IF NOT EXISTS ix_agent_memory_proposal_owner_status
    ON agent_memory_proposals(owner_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_memory_one_pending_per_thread
    ON agent_memory_proposals(thread_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS agent_memory_entries (
    id VARCHAR(36) PRIMARY KEY,
    owner_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128),
    scope VARCHAR(16) NOT NULL,
    category VARCHAR(40) NOT NULL,
    content VARCHAR(1000) NOT NULL,
    source_proposal_id VARCHAR(36) NOT NULL REFERENCES agent_memory_proposals(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    corroboration_count INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT ck_agent_memory_entry_client_tenant
        CHECK (scope <> 'client' OR tenant_id IS NOT NULL),
    CONSTRAINT ck_agent_memory_entry_corroboration
        CHECK (corroboration_count >= 1)
);
CREATE INDEX IF NOT EXISTS ix_agent_memory_entries_owner_id
    ON agent_memory_entries(owner_id);
CREATE INDEX IF NOT EXISTS ix_agent_memory_entry_owner_category
    ON agent_memory_entries(owner_id, category);
CREATE INDEX IF NOT EXISTS ix_agent_memory_entry_tenant_category
    ON agent_memory_entries(tenant_id, category);
CREATE INDEX IF NOT EXISTS ix_agent_memory_entries_source_proposal_id
    ON agent_memory_entries(source_proposal_id);

CREATE TABLE IF NOT EXISTS agent_memory_audit (
    id VARCHAR(36) PRIMARY KEY,
    proposal_id VARCHAR(36) REFERENCES agent_memory_proposals(id),
    owner_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128),
    scope VARCHAR(16),
    event_type VARCHAR(32) NOT NULL,
    reason_code VARCHAR(64) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_agent_memory_audit_client_tenant
        CHECK (scope IS NULL OR scope <> 'client' OR tenant_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_agent_memory_audit_owner_id
    ON agent_memory_audit(owner_id);
CREATE INDEX IF NOT EXISTS ix_agent_memory_audit_proposal_id
    ON agent_memory_audit(proposal_id);
CREATE INDEX IF NOT EXISTS ix_agent_memory_audit_owner_time
    ON agent_memory_audit(owner_id, occurred_at);
CREATE INDEX IF NOT EXISTS ix_agent_memory_audit_proposal_time
    ON agent_memory_audit(proposal_id, occurred_at);

-- Down migration (manual): drop agent_memory_audit, agent_memory_entries,
-- then agent_memory_proposals, only after retention/export requirements are met.