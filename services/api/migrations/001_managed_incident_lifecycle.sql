BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Refuse to create a replacement table or modify an unexpected schema.
DO $$
BEGIN
    IF to_regclass('public.managed_incident') IS NULL THEN
        RAISE EXCEPTION 'public.managed_incident is missing; verify the database and schema';
    END IF;
END
$$;

LOCK TABLE public.managed_incident IN ACCESS EXCLUSIVE MODE;

ALTER TABLE public.managed_incident
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

-- Validate every mapped column before committing, including pre-existing ones.
DO $$
DECLARE
    incompatible_columns TEXT;
BEGIN
    SELECT string_agg(expected.name, ', ' ORDER BY expected.name)
    INTO incompatible_columns
    FROM (
        VALUES
            ('id', ARRAY['text', 'varchar']),
            ('client_name', ARRAY['text', 'varchar']),
            ('channel', ARRAY['text', 'varchar']),
            ('type', ARRAY['text', 'varchar']),
            ('severity', ARRAY['text', 'varchar']),
            ('responsible_area', ARRAY['text', 'varchar']),
            ('title', ARRAY['text', 'varchar']),
            ('description', ARRAY['text', 'varchar']),
            ('status', ARRAY['text', 'varchar']),
            ('assigned_to', ARRAY['text', 'varchar']),
            ('sla_deadline', ARRAY['timestamptz']),
            ('resolved_at', ARRAY['timestamptz']),
            ('closed_at', ARRAY['timestamptz']),
            ('created_at', ARRAY['timestamptz']),
            ('updated_at', ARRAY['timestamptz']),
            ('is_archived', ARRAY['bool'])
    ) AS expected(name, allowed_types)
    LEFT JOIN pg_attribute AS column_info
        ON column_info.attrelid = 'public.managed_incident'::regclass
        AND column_info.attname = expected.name
        AND column_info.attnum > 0
        AND NOT column_info.attisdropped
    LEFT JOIN pg_type AS column_type ON column_type.oid = column_info.atttypid
    WHERE column_info.attname IS NULL
        OR NOT (column_type.typname::TEXT = ANY(expected.allowed_types))
        OR (
            expected.name IN ('resolved_at', 'closed_at')
            AND column_info.attnotnull
        );

    IF incompatible_columns IS NOT NULL THEN
        RAISE EXCEPTION 'Incompatible managed_incident columns: %. Migration rolled back; inspect the schema before proceeding.',
            incompatible_columns;
    END IF;
END
$$;

COMMIT;
