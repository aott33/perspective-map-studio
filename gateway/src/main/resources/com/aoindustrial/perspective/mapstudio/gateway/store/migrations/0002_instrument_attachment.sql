-- Map Studio map store, migration 2: instruments on lines (epic-map-store-and-data, epic 2 story 14).
-- Applied like migration 1: one transaction under pg_advisory_xact_lock(hashtext('mapstudio_migrations')),
-- recording version 2 in the same transaction. ALTER TABLE needs the role that owns mapstudio_item
-- (docs/operations.md); existing map items read back with attachment null. This file never changes once released.

-- An instrument's place on its line, {"lineId": uuid text, "distanceM": metres}, null on every other map item (AD-19, AD-20).
ALTER TABLE mapstudio_item ADD COLUMN attachment jsonb;

-- The live instruments of one line: the write service reads them for every line a batch moves or deletes.
CREATE INDEX mapstudio_item_attached_line ON mapstudio_item (project, (attachment->>'lineId'))
    WHERE attachment IS NOT NULL AND NOT deleted;

-- Who last changed one entity, for a conflict reply (suggested by entry 2).
CREATE INDEX mapstudio_edit_project_entity ON mapstudio_edit (project, entity, entity_id);
