---
id: 1
type: story
title: "Tracer: one edit saved through the write path and read back"
parent: epic-map-store-and-data
covers: [R1, R3, R4, R12, R13]
after: ["1.1"]
refined: true
hitl: true
risk: high
---

# Tracer: one edit saved through the write path and read back

## Description

The first end-to-end slice of the map store, which every later story of this epic builds on in parallel: the project setup names a PostgreSQL connection, Map Studio creates its tables there, and one map item edit is saved through the one write service from the browser and from a Gateway script, role-checked, recorded, and drawn again from the store after a reload. It proves the thin path of epic R1, R3, R4, R12 and R13, and fixes the contracts entries 2 to 11 share, so they never edit the same contract at once. The person's step: the owner reviews the screenshots and the edit record and says whether they show what the criteria say.

## Requirements

1. **The dev stack has a map store** (R1)
   **Given** a fresh clone and `ops/up.sh --fresh`
   **When** the dev stack starts
   **Then** it also runs PostgreSQL 16 with an empty database, and the Gateway has a database connection `MapStudio` whose password reaches it through a secret provider from a generated, git-ignored file
   **And** no password appears in any committed file or in any Gateway or browser log line
   **And** two worktrees with different `MAPSTUDIO_CONTAINER` values get separate PostgreSQL containers and volumes

2. **The setup is read at project start** (R12)
   **Given** the dev project holds a Map Studio setup resource with schema version 1, naming the connection `MapStudio`, a full-editing role list and a phone-editing role list, and every other AD-5 field with its default
   **When** the project starts on the Gateway
   **Then** the Gateway reads the setup and uses its connection for the map store
   **And** a project with no setup, or a setup naming a connection the Gateway does not have, gets no tables, logs one plain-words warning naming the project (and the connection), and its `map.load` answers an error with code `store-unreachable` and that reason

3. **Tables are created once the connection is usable** (R1)
   **Given** the empty database of criterion 1
   **When** the module starts
   **Then** it waits while the connection is not usable (the transient `Driver$1` error at Gateway start included), creates the whole first schema (map items, kind setups, the edit record, batch results, a per-project change sequence, the schema version) and records schema version 1, all in one transaction
   **And** a restart on the same database changes nothing and logs no error
   **And** when the connection never becomes usable within the wait, one error line names the connection, and the map store is unavailable (`store-unreachable`) instead of half created

4. **A map editor's line is saved and comes back** (R3, R4)
   **Given** a user logged in to the dev session with a full-editing role
   **When** they finish a line with the spike's "Draw a line" tool
   **Then** the browser sends one `edits.apply` with a new `batchId` and one create op for a map item (a new UUID id, `baseVersion` 0, kind, name and GeoJSON geometry), and the reply says it saved at version 1
   **And** after a page reload the line is drawn from `map.load`, not from the browser's memory
   **And** an update op with the stored `baseVersion` saves version 2, while an update with any other `baseVersion` is refused with code `conflict` and nothing is written

5. **A viewer's save is refused on the Gateway** (R4)
   **Given** a session with no editing role
   **When** a line is finished and `edits.apply` reaches the Gateway
   **Then** the save is refused with code `role` and a plain-words message, the line is shown as not saved, and the database is unchanged
   **And** `map.load` reports level `none` to that session and `full` to the map editor of criterion 4
   **And** the roles come from the Gateway's own view of the session user, never from anything the browser sends

6. **Every save is all or none, and recorded** (R3)
   **Given** a batch with one valid op and one op that cannot be applied (an update of an id that does not exist)
   **When** it is saved
   **Then** nothing in it is written and the reply names the failing op
   **And** for every saved op the edit record holds the project, the `batchId`, the batch's change sequence number, the entity, the id, the op, the new version, who made it (the Ignition user name, or the script's actor) and when (UTC)
   **And** every committed batch takes the project's next change sequence number and calls the change hook, which does nothing yet (entry 4 delivers `map.changed`)

7. **A Gateway script saves through the same path** (R13)
   **Given** a Gateway script on the dev Gateway
   **When** it calls `system.mapstudio.applyEdits("mapstudio-dev", batch, "seed-script")` with a create op for a point
   **Then** the point is written by the same write service, its edit record names `seed-script`, and a browser reload draws it
   **And** `system.mapstudio.getMap("mapstudio-dev")` returns the stored map items with their versions
   **And** a call with no actor, or a project with no setup, raises an error the script can catch, with the reason, and writes nothing

8. **The shared contracts are written down** (R3, R12)
   **Given** the build
   **When** a contributor reads `common/` and the draft contract page in `docs/`
   **Then** they find the message types `map.load`, `map.changed`, `edits.apply` and its reply, the error codes `conflict`, `role`, `invalid`, `stale` and `store-unreachable`, the op shape (create, update, delete on `item` and `kindSetup`), the map item record of AD-20, `map.changed {seq, ops}`, the setup schema version 1 and the first database schema, each marked as version 0.2.0 in draft
   **And** an op this story does not carry out (delete, any `kindSetup` op) is refused with code `invalid` and a message saying this version does not support it, never half applied

9. **Proof** (R3, R4)
   **Given** the running dev stack
   **When** the e2e suite runs
   **Then** new tests save a line as the map editor and see it after a reload, and see a viewer's save refused, and capture screenshots at 1440 px and 390 px
   **And** the existing e2e tests still pass (`testSet` and `popupView` unchanged)
   **And** the owner confirms the screenshots and one `psql` listing of the edit record match criteria 4 to 6

## Boundaries

- Not in this story: the other editor's record in a conflict reply, retried `batchId`s, deletes and the phone role (entry 2); kinds, assets and validation against the kind list (entries 3 and 9); `map.changed` delivery (entry 4); missing rights, failed and newer schemas and redundancy (entry 5); setup validation messages and live setup change (entry 6); the Designer editor (entry 7); the unsaved-edit queue and the store-unreachable view (entry 8); removing `testSet` (entry 11).
- Must not change: the `testSet` and `popupView` props and the e2e tests that use them; the point-click round trip; anything in `ign-scada-template`.

## References

- parent - _bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/epic-map-store-and-data.md, section Requirements (R1, R3, R4, R12, R13) and Notes
- architecture - _bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md, AD-2, AD-3, AD-5, AD-8, AD-17, AD-18, AD-20, AD-21, Consistency Conventions
- platform checks - docs/platform-checks.md, story 3 (checks 3, 4 and 5, and "Facts learned on the way")

## Notes

- Check beyond the criteria (high risk): run `ops/up.sh --fresh` twice on fresh volumes and once on a kept volume, and read the Gateway log of each for the connection wait, the single schema creation and no Map Studio error.
- Known steps for the dev stack, each seen in the spike (docs/platform-checks.md, story 3): a pre-filled `core` needs `core/config-mode.json`; named config resources need `attributes.uuid`; seed `core` by copying from an init container and `chown`, not by per-folder bind mounts; secret files 0644 in a 0700 folder; PostgreSQL's health check on `127.0.0.1`, not the socket; passwords passed to `psql` as variables, never interpolated into SQL.
- Known step (hitl): the dev Gateway needs a user source with one map editor user holding `MapEditor` and the dev project needs login for that user; the anonymous session is the viewer. Its password is generated into the git-ignored `.env`. Seeding users as config files is unverified.
- Open question: how the delegate reads the session user's roles on the Gateway (from the Perspective session's authenticated user, or its `auth` session props read on the Gateway) is unverified; answer it live first and record it in docs/platform-checks.md as a new section.
- Open question: whether `system.mapstudio.ping` and `echo` are removed here or kept as a health check (epic Notes).
- Assumption: the line's kind is the fixed value the dev line tool sends; checking kinds against the kind list is entry 9's.
- Assumption: the connection wait retries every 5 s for up to 2 minutes (epic Notes).
- Parallel work: keep `map.load` assembly, the write service, the change hook, the migrations and the setup loader in separate units, so entries 2 to 7 do not edit the same file.
- Assumption: `refined: true` is set so the story can go to bmad-build unattended, at the coordinator's request (2026-10-26); the owner has not yet approved these criteria and may reopen them.
