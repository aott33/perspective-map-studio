-- Map Studio map store, migration 1: the first schema (epic-map-store-and-data, entry 1).
-- Applied by the module in one transaction under pg_advisory_xact_lock(hashtext('mapstudio_migrations')),
-- after mapstudio_schema_version exists; the migrator records version 1 in the same transaction.
-- Every row is keyed by the Ignition project name; geometry is GeoJSON text; no spatial SQL (AD-3).
-- A later entry that needs a change adds 0002_<name>.sql; this file never changes once released.

-- The per-project change sequence: every committed batch takes the project's next seq (AD-17).
-- Its row lock serialises a project's batches.
CREATE TABLE mapstudio_project (
    project text PRIMARY KEY,
    seq bigint NOT NULL DEFAULT 0
);

-- Map items: the closed, typed record of AD-20. Deleted items stay as tombstones (entry 2).
CREATE TABLE mapstudio_item (
    project text NOT NULL,
    id uuid NOT NULL,
    kind text NOT NULL,
    name text NOT NULL DEFAULT '',
    geometry text NOT NULL,
    properties jsonb NOT NULL DEFAULT '{}'::jsonb,
    asset_id text,
    overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
    ends jsonb,
    version integer NOT NULL CHECK (version >= 1),
    deleted boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project, id)
);

-- Kind setups: one versioned row per project and kind id (AD-16), written from entry 3.
CREATE TABLE mapstudio_kind_setup (
    project text NOT NULL,
    kind_id text NOT NULL,
    setup jsonb NOT NULL,
    version integer NOT NULL CHECK (version >= 1),
    deleted boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project, kind_id)
);

-- The edit record: one row per saved op, who and when (AD-2).
CREATE TABLE mapstudio_edit (
    edit_id bigserial PRIMARY KEY,
    project text NOT NULL,
    batch_id uuid NOT NULL,
    seq bigint NOT NULL,
    entity text NOT NULL CHECK (entity IN ('item', 'kindSetup')),
    entity_id text NOT NULL,
    op text NOT NULL CHECK (op IN ('create', 'update', 'delete')),
    version integer NOT NULL,
    actor text NOT NULL,
    source text NOT NULL CHECK (source IN ('session', 'script')),
    at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mapstudio_edit_project_seq ON mapstudio_edit (project, seq);

-- Batch results: one row per committed batch, so a retried batchId returns the first result (entry 2).
CREATE TABLE mapstudio_batch (
    project text NOT NULL,
    batch_id uuid NOT NULL,
    seq bigint NOT NULL,
    actor text NOT NULL,
    result jsonb NOT NULL,
    committed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project, batch_id)
);
