-- Map Studio map store, migration 3: what each change did (epic-editing entry 11a, R18, R45).
-- Applied like migrations 1 and 2: one transaction under pg_advisory_xact_lock(hashtext('mapstudio_migrations')),
-- recording version 3 in the same transaction. ALTER TABLE needs the role that owns mapstudio_edit
-- (docs/operations.md); existing edit rows are untouched and read back with before, after, name and kind null.
-- This file never changes once released.

-- The op's values: a create keeps after (the written record), a delete before (the stored record), an update
-- before and after holding only the top-level fields whose values differ. Read by edits.history.
ALTER TABLE mapstudio_edit ADD COLUMN before jsonb;
ALTER TABLE mapstudio_edit ADD COLUMN after jsonb;

-- The item's name and kind as written (the stored record's for a delete), so an old change reads the name it had then.
ALTER TABLE mapstudio_edit ADD COLUMN name text;
ALTER TABLE mapstudio_edit ADD COLUMN kind text;
