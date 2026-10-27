---
title: 'Conflicts, retries, deletes and the phone role'
type: 'feature'
ticket: '2'
created: '2026-10-26'
status: 'in-review'
baseline_revision: 'eb7e576bd6566be057ae37aee17a1521baadaa68'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/story-tracer-one-edit-saved-through-the-write-path-and-read-back-plan.md'
  - '{project-root}/_bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** After entry 1 the write service saves creates and updates for full editors only: a stale `baseVersion` is refused without the other editor's record, a resent batch would save twice, deletes are refused, and a phone editor (`MapOperator`) can save nothing. Entry 8 (the replay queue), entry 9 (kind setups) and the editing and phone epics need all four before they start.

**Approach:** Complete entry 1's write service on its contracts, with no schema change: every stale op in a batch is returned in one `conflict` refusal carrying the stored record; a committed `batchId` replays its stored reply; `delete` writes a tombstone with a version bump and a `create` at the tombstone's version restores it; the role matrix gains the phone level. A test-only browser hook lets the e2e suite send `edits.apply` through the real session path, so the live run proves the role matrix from two signed-in browsers.

## Boundaries & Constraints

**Always:**
- Build on entry 1's contracts unchanged: migration 1, envelope `v` 1, op `{op, entity, id, baseVersion, data}`, error `{code, message, batchId?, op?}` (`MapStudioException.toErrorBody`), update `data` replaces only the top-level fields it carries; additions are new optional fields, documented in `docs/contract.md` (0.2.0 draft).
- Refusals stay all or none: nothing written, no `seq` taken, change hook not called, no edit or batch row.
- Check order: parse, retry lookup, role matrix (op shape), then in the transaction: lock project row, retry lookup again, lock items, role matrix (stored geometry), conflicts. A batch refused for role is never reported as a conflict.
- Levels come only from the Gateway's view of the session user (entry 1's proved API); scripts run as `full` under their actor.
- Map item properties never in a log line; no em dashes; unverified Ignition behaviour marked so.

**Never:**
- A new migration or table change. Kind setup ops (entry 9), the browser's conflict display or replay queue (entry 8), `map.changed` (entry 4), store states (entry 5), the AD-19 snapped-ends check (epic-editing), any phone UI (epic-phone).
- A role decided from anything the browser sends; the test hook adds no right the websocket does not already give.

**Decisions (owner, "approve 2 to 7, recommendations", 2026-10-26):**
- Restore shape: a `create` at the tombstone's version with full data; no new op, `deleted` never in `data`.
- Who changed it: each conflict carries `changedBy` and `changedAt` from the edit record, and the message names them (FR-31).
- Test hook: `window.__mapStudioTest` is always registered; the Gateway decides everything, so it grants nothing.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Second editor saves stale | A saved item X v1 to v2; B sends update X `baseVersion` 1 | nothing written | `conflict`; `conflicts:[{index, entity, id, baseVersion:1, current: X v2, changedBy, changedAt}]`; message names X and says nothing was saved |
| Several stale ops | 3 ops, ops 0 and 2 stale | nothing written | one `conflict` listing both |
| Create on an existing id | create X `baseVersion` 0, X live or tombstoned | nothing written | `conflict` with X's current record |
| Retry after commit | same `batchId`, same actor, sent again (also both at once) | the first reply, same `seq`; one set of edit rows; hook called once | none |
| Batch id reused by another actor | committed `batchId`, other actor | nothing written | `invalid`, "this save id was already used" |
| Retry of a refused batch | refused before | evaluated afresh | as the batch's own checks |
| Delete | delete X `baseVersion` = stored | X `deleted` true, version +1, edit op `delete`; gone from `map.load` | stale `baseVersion`: `conflict` |
| Restore | create X with full data, `baseVersion` = tombstone version | X live with that data, version +1, edit op `create` | `baseVersion` other than the tombstone's: `conflict` |
| Update or delete of a tombstone | X deleted | nothing written | `conflict`, current shows `deleted: true` |
| Two ops on one id | one batch | nothing written | `invalid`, names the second op |
| Phone: move a point | `MapOperator`; update point P `data:{geometry: Point}` | saved | none |
| Phone: properties | update any item `data:{properties}` | saved | none |
| Phone: anything else | create, delete, restore, a line's geometry, a point to a non-Point, `name`, `assetId`, `overrides`, `ends`, kindSetup | nothing written | `role`, says what phone editing may change |
| `map.load` as phone editor | `MapOperator` only | `level: phone` | none |

</frozen-after-approval>

## Code Map

Real names after entry 1 (merged at `192c91a`; its plan's Change Log). `G` = `gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway`, `C` = `common/src/main/java/com/aoindustrial/perspective/mapstudio/common`, `T` = `gateway/src/test/java/com/aoindustrial/perspective/mapstudio/gateway`.

- `G/write/WriteService.java` -- `apply(project, batchJson, actor, level)`: today gate, parse, `requireSupported`, `RoleMatrix.check`, actor, then one `store.inTransaction` with `tx.nextSeq` (locks the project row), `applyOp` per op, `insertEdit`, `insertBatch`; 23505 is `invalid` "already saved"; hook after commit. Rework here; keep the hook call after commit only and the `SQLException` logging (class name and SQLState only).
- `G/write/RoleMatrix.java` -- `level(setup, roles)` stays; `check(level, op)` gains the phone rules; new `checkStored(level, op, stored)` inside the transaction.
- `C/contract/MapStudioException.java` -- the one refusal type (replaces the planned `EditRefusal`); add an optional `conflicts` array to it and to `toErrorBody()`.
- `C/contract/EditOp.java` -- `parse` refuses a create with `baseVersion` other than 0: relax to 0 or more (restore); a delete's `data` must be absent or `{}`.
- `C/contract/EditBatch.java` -- `parse` adds the two-ops-on-one-id rule; `requireSupported` keeps only the kind setup refusal.
- `C/contract/MapItemRecord.java` -- `fromCreate`, `updatedWith`; add `deletedAt(version)` style helpers in the write service rather than new fields (record is closed).
- `G/store/MapStore.java`, `G/store/JdbcMapStore.java` -- `Tx`: add `findBatch(project, batchId)` and `lastEdit(project, entity, entityId)`; tombstone and restore use the existing `updateItem` (it writes `deleted`). Prepared statements only.
- `T/write/FakeMapStore.java` -- public fake to extend: add the two reads, a fixed `now`, and serialise transactions (`synchronized`, as the project row lock does).
- `T/write/WriteServiceTest.java` -- entry 1's tests: `deleteAndKindSetupOpsAreRefusedAsNotSupported` and `aBatchIdAlreadySavedIsRefusedAndNothingIsWritten` change meaning in this story (delete is supported; a resent batch replays).
- `G/MapStudioDelegate.java` -- `storeReply` already turns `MapStudioException.toErrorBody()` into `error` with `batchId`; no change expected.
- `web/typescript/contract.ts`, `messages.ts` -- mirror `Conflict` and `ErrorBody.conflicts`.
- `web/typescript/MapStudio.tsx` -- `MapStudioStoreDelegate` (constructor, `handleEvent`): register the test hook and hand it its replies first; nothing else.
- `ops/users.py`, `ops/lib.sh`, `ops/up.sh` -- `mapoperator` in `MapOperator`, `MAPSTUDIO_OPERATOR_PASSWORD` in `.env`, same pattern as the editor.
- `e2e/lib/editorAuth.mjs`, `e2e/lib/signInCli.mjs`, `e2e/tests/fixtures.mjs`, `e2e/global-teardown.mjs` -- sign-in per user (`editorTest` stays), an operator context helper, the teardown scans both passwords.
- `ops/project/.../views/MapStudioEdit/view.json` + `e2e/tests/store.spec.mjs` -- the dev script check `delete` expects "not supported"; it becomes a stale delete expecting `conflict` (the only change to entry 1's specs).
- `docs/contract.md`, `docs/platform-checks.md`, `README.md`.

## Tasks & Acceptance

**Execution:**
- [x] `C/contract/{EditOp,EditBatch,MapStudioException}.java`, new `C/contract/Conflict.java`; `common/src/test/.../contract/EditOpDeleteTest.java` (new) -- delete and restore shapes, duplicate ids, `Conflict {index, entity, id, baseVersion, current, changedBy, changedAt}`.
- [x] `G/store/{MapStore,JdbcMapStore}.java`, `T/write/FakeMapStore.java` -- `findBatch`, `lastEdit`.
- [x] `G/write/RoleMatrix.java` -- phone rules; the refusal says what phone editing may change.
- [x] `G/write/WriteService.java`, new `G/write/ConflictReport.java` -- order: gate, parse, retry lookup (when there is an actor), role (op shape), supported, actor (entry 1's role-before-actor kept); in the transaction: `nextSeq` (project row lock), retry lookup again (found: roll back, replay), lock items, role (stored geometry), conflicts (all at once), write; 23505 on the batch row: read the stored batch and replay.
- [x] `T/write/{WriteServiceRetryTest,WriteServiceDeleteTest,WriteServiceConflictTest,RoleMatrixPhoneTest}.java` (new), the two changed `WriteServiceTest` cases -- one test per matrix row.
- [x] `web/typescript/{contract,messages}.ts`, new `web/typescript/testHook.ts`, `MapStudio.tsx`; Jest `contract.test.ts`, new `testHook.test.ts`.
- [x] ops and e2e plumbing for the operator user.
- [x] `e2e/tests/writepath.spec.mjs` (new) -- editor and operator contexts through `window.__mapStudioTest`: conflict with the operator's record and `changedBy`; one batch sent twice in turn and twice at once, same `seq`; delete then restore; operator: `level` phone, a drawn line refused `role` with "Not saved" shown (screenshot `mapstudio-store-phone-390.png`), a point move and a line's properties saved, a line's geometry refused `role`.
- [x] `docs/contract.md` -- conflicts, retries, delete and restore, role matrix, each with one JSON example; `docs/platform-checks.md` -- what the live run showed.

**Acceptance Criteria:**
- Given the e2e suite has run, when `ops/psql.sh -c "select batch_id, count(*) from mapstudio_edit group by batch_id having count(*) > 2"` runs, then no row (the retried batch wrote once).
- Given the e2e suite has run, when the `mapstudio_edit` rows of the restored item are listed, then they read create v1, delete v2, create v3 with the actors who did each.
- Given every refused case of the matrix, when it is sent, then `mapstudio_project.seq` is unchanged.
- Given the existing e2e specs and entry 1's `store.spec.mjs` (its dev script check's delete now expecting `conflict`), when the suite runs, then they pass.

## Design Notes

- Retry: the stored `mapstudio_batch.result` is the reply. The lookup after `nextSeq` serialises a project's batches, so two concurrent sends cannot both commit; a found batch rolls the transaction back (no `seq` taken) by throwing a private replay signal caught outside. The first lookup (before the role check) is a read-only transaction; a replay never calls the hook again. Same actor means the same actor name (the batch row stores the name).
- Check order inside the transaction: role on stored geometry for every op, then conflicts for every op (a missing item for update, delete or restore is `invalid` at once), then each op's data. A stale op's malformed data is reported as the conflict.
- Restore: `create` with `baseVersion` 0 means new (an existing id, live or tombstoned, is a conflict); equal to a tombstone's version means restore, full data as a create, version +1; any other value is a conflict, and a restore of an id never stored is `invalid`.
- Phone rules (op shape): only `update` of an `item`, `data` keys within `{geometry, properties}`, `geometry` a `Point`; inside the transaction a `geometry` op needs a stored `Point`.
- Conflict message: one: "<name> was changed by <actor> at HH:mm UTC since you loaded it. Nothing in this save was written." (a create on an existing id: "<name> already exists ..."); several: "N map items were changed by others since you loaded them. Nothing in this save was written." `op` in the error body names the first conflicting op, as in entry 1.
- Known gap for epic-editing: a phone move of a point that lines snap to cannot carry the line ends a phone editor may not change (AD-19).
- No migration. An index on `mapstudio_edit (project, entity, entity_id)` would speed `changedBy` and could ride the next migration another entry adds.

## Plan Change Log

- 2026-10-26: entry 1 merged (`192c91a`); Code Map, Tasks and Design Notes moved to its real names (`MapStudioException` for `EditRefusal`, `map.load.reply` and `edits.apply.reply`, `ChangeHook.onCommitted(CommittedBatch)`, `FakeMapStore` and `FakeJdbc` in their own files, `StoreGate`, the bounded work pool, `editorTest`). Owner approved with the recommended answers; Open Questions resolved into the frozen block; status in-progress.
- Implementation, 2026-10-27: the unsupported-op check (`requireSupported`) moved after the role check, so a phone editor's or viewer's kind setup op answers `role` as the matrix says (a full editor's still answers `invalid` until entry 3). The retry lookup runs only when there is an actor, and the actor check stays after the role check (entry 1's order): the live run showed the anonymous viewer's save answering `invalid` ("needs an actor") before this. Entry 1's `WriteServiceTest` helpers moved to `WriteFixture` (shared by the new tests); `FakeMapStore` serialises its transactions and gained `racingBatch`. `e2e/lib/editorAuth.mjs` signs in any dev user (`stateFile(user)`, `userPassword(user)`); `fixtures.mjs` adds `signedInContext(browser, user)`; the teardown scans every dev password.
- The dev `/edit` script check's `delete` (entry 1) expected "not supported"; deletes are supported now, so it sends a stale delete and expects `conflict` (view and `store.spec.mjs`).

## Verification

**Commands:**
- `./gradlew build` -- expected: green with the new Java and Jest tests.
- `ops/up.sh --fresh` then `cd e2e && npm test` -- expected: all pass.
- The two `psql` queries of Acceptance -- expected: as stated.
- `git grep -nP '\x{2014}'` and `git grep -F` of each generated password -- expected: no match.

**Manual checks (if no CLI):**
- `mapstudio-store-phone-390.png`: the operator's line shown as not saved with the role message, readable at 390 px.
