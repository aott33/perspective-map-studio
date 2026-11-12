---
title: "19b: Edit mode's units override in the map store: the settings entity, store schema 4"
type: 'feature'
ticket: ''
part_of: '19'
created: '2026-11-12'
status: 'in-progress'
baseline_revision: '50504ea58d1dbcdab3a3caf3db67e5ee10f46e1e'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/docs/contract.md', '{project-root}/docs/operations.md', '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-editing/tickets/story-the-tag-browser-one-tree-for-every-tag-pick-asset-relative-p-plan-13b.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The project setup names the units (19a), but a map editor cannot override them for the whole project (R27): the map store has nowhere to keep the choice, the write path knows only items and kind setups, and no open map is told.

**Approach:** The map store's project row gains `settings` (migration 4, store schema 4). `edits.apply` takes a third entity, `settings`, with the one id `units` and data `{system, labels}`, full editing only, versioned like a kind setup and written to the edit record. `map.load.reply` and `map.changed` carry it at every level. Recent changes lists it with Revert. The browser keeps the value and draws nothing with it: entry 20 adds the Layers row and the distances. This is the second half of entry 19.

Decisions (owner, 2026-11-12, "approve and continue" on the plan kept whole and its nine picks): (1) `system` is `auto`, `metric` or `us`, the setup's three; `labels` is `short` or `long`; both required. (2) Ops are create (at 0, or at a deleted version to restore), update and delete; a delete clears the override, so the setup's units apply again and labels are short. (3) Stored in `mapstudio_project.settings jsonb` as `{"units": {system, labels, version, deleted}}`. (4) The reply's `settings` is `{}` with no live override, else `{"units": {id, system, labels, version}}`, the same at every level. (5) A settings op is allowed when no kind list is in use. (6) Recent changes reads "Set the units to US, words", "Changed the units to Metric, symbols", "Cleared the units setting", with Revert: a create is reverted by a delete, a delete by a create, an update by the values before. A row that also holds a kind setup keeps no Revert. (7) A conflict names "the units setting". (8) `system.mapstudio.getMap` is unchanged; `applyEdits`' description names the third entity. (9) The script console check is the owner's, in playbook 8t; e2e sends the same op over the websocket.

## Boundaries & Constraints

**Always:** **Store:** migration 4 adds `settings jsonb NOT NULL DEFAULT '{}'` to `mapstudio_project` and widens `mapstudio_edit`'s entity check to `settings`; released migrations 1 to 3 unchanged; every place that names store schema 3 names 4. **Write:** `entity: "settings"`, id `units` only; data holds exactly `system` and `labels`; refusals in words as "Op i (units): ..." naming the allowed values; level `full` only, a phone editor and a viewer get `role`; version rule as a kind setup's (a stale `baseVersion` is a `conflict` naming who); one edit row per op with `kind` `units`, no name, and before and after of `system` and `labels`. **Read:** `map.load.reply.settings` at every level, beside `setup.units`; `map.changed` sends the settings record in full to viewers too (the actor still blanked). **Browser:** the entity is read in `edits.apply`, `map.changed`, `edits.history`, conflicts and the unsaved queue; the value is kept in the change state by the version rule; Recent changes lists it with Revert. Docs: `docs/contract.md` (messages, ops, role matrix, the store table, schema 4), `docs/operations.md`, `CHANGELOG.md`, the architecture's AD-2 and AD-3, the script description, playbook section 8t. Words brief and plain; no em dashes.

**Never:** A Layers row, any distance drawn differently, or an effective-units rule in the browser (entry 20); a contract version bump (0.4.0 is unreleased); a second settings id; a change to the setup, the Designer or 19a's `setup.units`; a change to `checkVersion`, the `edits.history` or `map.changed` shapes, or what a viewer is not sent of items and kind setups; Undo of a settings op in the toolbar's stack (no browser control sends one yet).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| S1 First set | Full editor, create `units` at 0, `{system: "us", labels: "long"}` | Saved at version 1; `map.changed` reaches an editor and a viewer with the record | No error expected |
| S2 Change | Update at 1 with `metric`, `short` | Version 2; the edit row holds before and after | No error expected |
| S3 Clear | Delete at 2 | The reply's `settings` is `{}` on the next load | No error expected |
| S4 Set again | Create at 3 after S3 | Version 4, live | No error expected |
| S5 Stale | Update at 1 when stored is 2 | Refused | `conflict`, naming who and "the units setting" |
| S6 Phone, viewer | The same op from a phone editor; from a viewer | Refused | `role` |
| S7 Bad value | `system: "imperial"`; `labels: "tiny"`; a missing or extra field | Refused | "Op 1 (units): system must be one of auto, metric, us" and the like |
| S8 Bad id | id `theme` | Refused | "a settings id must be units" |
| S9 Load | Any level loads after S1 | `settings.units` is `{id, system, labels, version}`; `setup.units` unchanged | No error expected |
| S10 No override | A fresh store | `settings` is `{}` | No error expected |
| S11 No kind list | A settings-only batch, no kind list in use | Saved | No error expected |
| S12 History | Recent changes after S1, S2 | Two rows in words, each with Revert | No error expected |
| S13 Revert | Revert of S2's row | An update at 2 with `us`, `long`; refused as S5 if changed since | `conflict` on the save status row |
| S14 Migration | A schema 3 store with edit rows | Schema 4; old rows kept; `settings` is `{}` | A role that does not own the tables: the failure line of migrations 2 and 3 |
| S15 Older browser state | A queued batch or history entry with `settings` | Read, not dropped | No error expected |

</frozen-after-approval>

## Code Map

Java under `gateway/src/main/java/.../gateway` (GW) and `common/src/main/java/.../common/contract` (CM).

- `gateway/src/main/resources/.../gateway/store/migrations/` -- one PostgreSQL file per version; copy 0003's header. 0001:48 holds the inline check, named `mapstudio_edit_entity_check` by PostgreSQL; 0001:9-12 is `mapstudio_project (project, seq)`. `Migrations.java` :22 `FILES` (the schema number is its size); `statements` :64 splits on `;` at a line's end, so no DO block.
- Schema 3 named in: `MigrationsTest` :18, `ops/store-checks.sh` :203, :249, :275, `e2e/tests/store-ops.spec.mjs` :86, `docs/contract.md` :444 (the heading `scripts/ci/check-contract-versions.sh` :49 needs), `docs/operations.md` :24-27, :56-59, `CHANGELOG.md` :7, :45, `docs/test-playbook-0.4.0.md` :290.
- `CM/EditOp.java` -- `ENTITIES` :25, the refusal :44, id rules :49-60. `CM/KindSetupRecord.java`, `StoredRecord.java` -- the model for a `SettingsRecord`.
- `GW/write/WriteService.java` -- `kindList` :389 (exempt settings), lock :138, write :156, `writeKindSetup` :328 (the template, with `invalid()` :436), `editRow` :206, `what()` :410. `ConflictReport.java` :60-88. `RoleMatrix.java` :167-221 needs no change (prove it by test).
- `GW/store/MapStore.java` :55-114 (`Tx`), `JdbcMapStore.java` -- `nextSeq` :110 locks the project row; kind setup methods :380-432; `HISTORY_ROWS_SQL` :56. Test fake `gateway/src/test/.../write/FakeMapStore.java`.
- `GW/load/MapLoader.java` -- the snapshot :131, `mapLoadReply` :206 (`setup` at every level :239). `GW/MapStudioDelegate.java` `bodyFor` :241 already passes another entity to viewers whole.
- `common/src/main/resources/.../MapStudioScriptModule.properties` :8 (`ScriptDocsTest`).
- `web/typescript/contract.ts` -- entity unions :88, :324, `readHistoryOp` :366, `readConflicts` :430, `readMapLoadReply` :243. `changes.ts` -- `ChangeState` :36, `applyBody` :133, `onLoad` :176. `unsaved.ts` -- `readBatch` :113, `yourChangeText` :830. `history.ts` -- `batchSentence` :303, `reversesOp` :371, `revertBlocked` :428, `revertBatch` :443 (hard-codes `item`), `expandOps` :678. `MapStudioStoreDelegate.ts` entity branches :609, :1983, :2356, :2408.
- Tests to extend: `WriteServiceKindSetupTest` (the template), `WriteServiceConflictTest`, `RoleMatrixTest`, `RoleMatrixPhoneTest`, `MapLoaderTest`, `MapStudioDelegateTest` :353, `EditHistoryTest`, `HistoryJdbcTest`, `MigrationsTest`, `EditOpDeleteTest`; Jest `contract`, `changes`, `history`, `historyDelegate`, `unsaved`. e2e: `send(page, type, body)` and `signedInContext` in `e2e/tests/fixtures.mjs` :177, :221; models `kindsetup.spec.mjs` :188, `writepath.spec.mjs` :59, `setup.spec.mjs` :144.

## Tasks & Acceptance

**Execution:**
- [ ] `.../migrations/0004_settings.sql`, `Migrations.java`, `MigrationsTest` -- the column and the widened check -- S14.
- [ ] `CM/EditOp.java`, a new `CM/SettingsRecord.java`, their tests -- the entity, the id, the data rules -- S7, S8, tests first.
- [ ] `GW/store/MapStore.java`, `JdbcMapStore.java`, `FakeMapStore.java` -- lock, read and write of the project row's settings.
- [ ] `GW/write/WriteService.java`, `ConflictReport.java`, tests -- S1 to S8, S11.
- [ ] `GW/load/MapLoader.java`, `MapStudioDelegateTest`, `MapLoaderTest` -- S9, S10, and a viewer's `map.changed`.
- [ ] `web/typescript/contract.ts`, `changes.ts`, `unsaved.ts`, `history.ts`, `MapStudioStoreDelegate.ts`, their tests -- S12, S13, S15.
- [ ] `e2e/tests/settings.spec.mjs` -- S1, S5, S6, S7, S9 live with two browsers and a viewer, and S12, S13 in Recent changes; leave the store without an override at the end.
- [ ] `ops/store-checks.sh`, `e2e/tests/store-ops.spec.mjs` -- schema 4.
- [ ] Docs as Always lists; playbook 8t with the script console step and the upgrade from schema 3.

**Acceptance Criteria:**
- Given a dev stack on a schema 3 store, when the module starts, then the store is at schema 4 and every existing e2e expectation holds.
- Given `scripts/ci/check-contract-versions.sh`, when run, then it reports map store schema 4.

## Implementation Notes

- Planner, 2026-11-12: the environment and identity rules are entry 13b's plan's first Implementation Note; they hold here. Leave the work uncommitted; run the specs you touch, not the whole suite. Docker was not running at planning time: start it as the hand-off note says before any stack work.

## Plan Change Log

## Review Triage Log

## Design Notes

A settings value has no row of its own, so its version and tombstone live in the jsonb beside the data, and the lock is the project row's (`nextSeq` already takes it). Delete keeps the version so a restore is a create at that version, as an item's and a kind setup's is; that is what lets Revert undo the first set.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` and `bash scripts/ci/test-contract-versions.sh` -- expected: OK, map store schema 4
- `ops/up.sh --fresh`, then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: 0 failed
