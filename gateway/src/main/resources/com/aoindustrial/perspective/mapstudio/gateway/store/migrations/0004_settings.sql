-- Map Studio map store, migration 4: the project's settings (epic-editing entry 19b, R27).
-- Applied like migrations 1 to 3: one transaction under pg_advisory_xact_lock(hashtext('mapstudio_migrations')),
-- recording version 4 in the same transaction. ALTER TABLE needs the role that owns mapstudio_project and
-- mapstudio_edit (docs/operations.md); existing rows are untouched and every project reads back with settings {}.
-- This file never changes once released.

-- A project's settings, by settings id: {"units": {"system", "labels", "version", "deleted"}}. A settings value has
-- no row of its own, so its version and tombstone live beside its data; the project row's lock (taken with the
-- project's next seq) is its lock.
ALTER TABLE mapstudio_project ADD COLUMN settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- The edit record takes a third entity. Migration 1 wrote the check inline, which PostgreSQL named
-- mapstudio_edit_entity_check.
ALTER TABLE mapstudio_edit DROP CONSTRAINT mapstudio_edit_entity_check;
ALTER TABLE mapstudio_edit ADD CONSTRAINT mapstudio_edit_entity_check
    CHECK (entity IN ('item', 'kindSetup', 'settings'));
