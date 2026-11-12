---
title: "19b: Edit mode's units override in the map store: the settings entity, store schema 4"
type: 'feature'
ticket: ''
part_of: '19'
created: '2026-11-12'
status: 'built'
baseline_revision: '50504ea58d1dbcdab3a3caf3db67e5ee10f46e1e'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
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
- [x] `.../migrations/0004_settings.sql`, `Migrations.java`, `MigrationsTest` -- the column and the widened check -- S14.
- [x] `CM/EditOp.java`, a new `CM/SettingsRecord.java`, their tests -- the entity, the id, the data rules -- S7, S8, tests first.
- [x] `GW/store/MapStore.java`, `JdbcMapStore.java`, `FakeMapStore.java` -- lock, read and write of the project row's settings.
- [x] `GW/write/WriteService.java`, `ConflictReport.java`, tests -- S1 to S8, S11.
- [x] `GW/load/MapLoader.java`, `MapStudioDelegateTest`, `MapLoaderTest` -- S9, S10, and a viewer's `map.changed`.
- [x] `web/typescript/contract.ts`, `changes.ts`, `unsaved.ts`, `history.ts`, `MapStudioStoreDelegate.ts`, their tests -- S12, S13, S15.
- [x] `e2e/tests/settings.spec.mjs` -- S1, S5, S6, S7, S9 live with two browsers and a viewer, and S12, S13 in Recent changes; leave the store without an override at the end.
- [x] `ops/store-checks.sh`, `e2e/tests/store-ops.spec.mjs` -- schema 4.
- [x] Docs as Always lists; playbook 8t with the script console step and the upgrade from schema 3.

**Acceptance Criteria:**
- Given a dev stack on a schema 3 store, when the module starts, then the store is at schema 4 and every existing e2e expectation holds.
- Given `scripts/ci/check-contract-versions.sh`, when run, then it reports map store schema 4.

## Implementation Notes

- Planner, 2026-11-12: the environment and identity rules are entry 13b's plan's first Implementation Note; they hold here. Leave the work uncommitted; run the specs you touch, not the whole suite. Docker was not running at planning time: start it as the hand-off note says before any stack work.
- Implementer, 2026-11-12: built as planned, left uncommitted. Where the build chose within the plan: (1) a settings update's edit row holds both `system` and `labels` in `before` and in `after`, changed or not (an item's and a kind setup's hold only what differs), so Revert can send the values before whole; a create holds `after` and a delete `before`, each `{system, labels}` and nothing else. (2) The record `map.changed` and a conflict carry is `{id, system, labels, version, deleted}`; the reply's `settings.units` is that without `deleted`. (3) The store has three `Tx` methods, `lockSetting`, `writeSetting`, `liveSettings`; a write merges the one id into the jsonb (`settings || jsonb_build_object`), run by hand on PostgreSQL 16 with migration 4. (4) Several stale ops with the units among them read "2 map items and the units setting were changed by others ...". (5) A missing `system` or `labels` gets the same words as a wrong one. (6) The browser keeps the record in `ChangeState.units`, a cleared one as its tombstone until the next load; the delegate's `units` is the live one, and `.mapstudio-map` carries `data-units-override` for tests (no rule, nothing drawn). (7) A Revert that holds a settings op is sent with no Undo step (the toolbar's stack reverses map items only); it queues, waits its turn and meets the conflict card as any Revert. (8) A row whose units change lacks its values before has no Revert ("The values of this change were not kept ..."). (9) Expanded, a units row shows one field, Units, before and after ("Not set" where there was none). (10) `ops/store-checks.sh upgrade` gained a third upgrade, schema 3 with edit rows and a project row to 4. (11) Playbook 8t says the Designer's own Script Console cannot call `system.mapstudio` (Gateway scope only) and points at a Gateway-scope script; the owner may want other words. Run here: tsc, Jest (1137), the Gradle build, both contract checks, `ops/store-checks.sh newer upgrade` (all three upgrades live), and on the dev stack `settings.spec.mjs` with `store`, `writepath`, `changes`, `kindsetup`, `history`, `recentchanges`, `setup` and `unsaved` (36 passed, 1 skipped). Not run: the whole e2e suite (the orchestrator's), the script console step (the owner's), and `docs/platform-checks.md` has no entry for this run. The stack came up on fresh volumes (no image or volume was left in the container), so the dev store itself was created at schema 4; the upgrade from 3 was seen on the check database. Docker Hub answered 429 for a while before the images came.

## Plan Change Log

## Review Triage Log

Quick review, 2026-11-12 (one reviewer, by inspection). S1 to S15 read as met but for the two bugs below; no em dash, no version bump, `getMap` unchanged, migrations 1 to 3 untouched. Eight findings: 0 high, 2 medium, 5 low, 1 false, 0 maybe-false. Six routed patch, to the implementer; two rejected.

- medium, patch: `ConflictReport.message()` counts every stale op under the first noun, so one stale map item and the stale units setting read "2 map items and the units setting" (pinned by `WriteServiceSettingsTest` :123). Each noun takes its own count; the test's expectation is corrected.
- medium, patch: `MapStudioStoreDelegate.revert()` sends a Revert of a row that holds map items and the units setting with no Undo step, so the item changes lose their step and earlier steps for those items go stale (a script batch can make such a row). Only an all-settings Revert skips the step; a mixed one keeps a step for its map items.
- low, patch: `[live 8.3.10]` on the schema 4 upgrade and the units setting in `docs/operations.md` and `docs/contract.md` with no record in `docs/platform-checks.md`. A section "Epic 4 entry 19b" records what was run and seen, and is cited.
- low, patch: `docs/contract.md`'s rights sentence lost the joiner between its schema 2 and schema 3 items.
- low, patch: `contract.ts`: `KindSetupOp`'s doc comment was left above the moved `MapUnits`.
- low, patch: `StoredRecord`'s javadoc and `changes.ts`'s `ChangedOp.record` comment do not name the setting.
- false, rejected: the first acceptance criterion "is not demonstrated". The upgrade of a schema 3 store with rows was seen by `ops/store-checks.sh upgrade` (its new 3 to 4 case), and the whole e2e suite is the orchestrator's Verification, run after the patches, not the implementer's.
- low, rejected: `SettingsRecord.fromStored` throws on a stored value that lacks a field, failing the project's loads. Only a jsonb edited by hand or by another writer can lack one (the one writer, `writeSetting`, stores all four), and the fix is new guards and a report path, not a correction.

Outcome (2026-11-12): six patches applied, two findings rejected; nothing deferred. Not seen live: a settings op from a Gateway script, migration 4 refused for a role that does not own the tables, and the upgrade of the owner's own schema 3 store (playbook 8t). The orchestrator's Verification on the patched code: tsc clean, Jest 1138 passed, Gradle BUILD SUCCESSFUL, both contract checks OK (map store schema 4), and on a fresh stack the whole suite 334 passed, 9 skipped (the store-check and Gateway-stop scenarios, run by hand), 0 failed in 1.3 h. With 19a this completes entry 19.

## Design Notes

A settings value has no row of its own, so its version and tombstone live in the jsonb beside the data, and the lock is the project row's (`nextSeq` already takes it). Delete keeps the version so a restore is a create at that version, as an item's and a kind setup's is; that is what lets Revert undo the first set.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` and `bash scripts/ci/test-contract-versions.sh` -- expected: OK, map store schema 4
- `ops/up.sh --fresh`, then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: 0 failed
