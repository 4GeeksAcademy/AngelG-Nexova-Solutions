BEGIN;

ALTER TABLE inventory_item ADD COLUMN IF NOT EXISTS telemetry_category text;
ALTER TABLE inventory_item ADD COLUMN IF NOT EXISTS programme_id text;
ALTER TABLE inventory_movement ADD COLUMN IF NOT EXISTS supplier_id integer;
ALTER TABLE inventory_movement ADD COLUMN IF NOT EXISTS unit_cost numeric(12,2);
ALTER TABLE inventory_movement ADD COLUMN IF NOT EXISTS currency text;

CREATE TABLE IF NOT EXISTS telemetry_events (
    event_id uuid PRIMARY KEY,
    event_type text NOT NULL,
    event_version integer NOT NULL DEFAULT 1,
    occurred_at timestamptz NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    source text NOT NULL DEFAULT 'inventory',
    source_id text NOT NULL,
    actor_id text,
    properties json NOT NULL,
    CONSTRAINT uq_telemetry_origin_type UNIQUE (source_id, event_type)
);
ALTER TABLE telemetry_events ADD COLUMN IF NOT EXISTS actor_id text;
CREATE INDEX IF NOT EXISTS ix_telemetry_events_occurred_at ON telemetry_events (occurred_at);
CREATE INDEX IF NOT EXISTS ix_telemetry_events_event_type ON telemetry_events (event_type);
CREATE INDEX IF NOT EXISTS ix_inventory_item_programme_id ON inventory_item (programme_id);

CREATE SCHEMA IF NOT EXISTS reporting;
CREATE TABLE IF NOT EXISTS reporting.weekly_office_program_performance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office text NOT NULL,
    programme_id text NOT NULL,
    week_start date NOT NULL,
    total_material_cost numeric NOT NULL DEFAULT 0,
    kits_delivered_count integer NOT NULL DEFAULT 0,
    shortage_events_count integer NOT NULL DEFAULT 0,
    cost_variance_events_count integer NOT NULL DEFAULT 0,
    currency text NOT NULL,
    computed_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (office, programme_id, week_start)
);
CREATE TABLE IF NOT EXISTS reporting.pipeline_runs (
    id uuid PRIMARY KEY,
    week_start date NOT NULL,
    status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
    started_at timestamptz NOT NULL,
    finished_at timestamptz,
    source_cutoff timestamptz,
    events_read integer NOT NULL DEFAULT 0,
    rows_written integer NOT NULL DEFAULT 0,
    error_code text
);
CREATE INDEX IF NOT EXISTS ix_pipeline_runs_started_at ON reporting.pipeline_runs (started_at);
CREATE INDEX IF NOT EXISTS ix_weekly_performance_week_start
    ON reporting.weekly_office_program_performance (week_start);

COMMIT;
