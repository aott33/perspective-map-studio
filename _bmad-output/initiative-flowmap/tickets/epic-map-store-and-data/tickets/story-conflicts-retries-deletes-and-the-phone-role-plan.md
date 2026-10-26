---
title: 'Conflicts, retries, deletes and the phone role'
type: 'feature'
ticket: '2'
created: '2026-10-26'
status: 'draft'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'high'
review: ''
review_source: ''
lenses_ran: []
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
- Build on entry 1's contracts unchanged: migration 1, envelope `v` 1, op `{op, entity, id, baseVersion, data}`, error `{code, message, batchId?, op?}`, update `data` replaces only the top-level fields it carries; additions are new optional fields, documented in `docs/contract.md` (0.2.0 draft).
- Refusals stay all or none: nothing written, no `seq` taken, change hook not called, no edit or batch row.
- Check order: parse, retry lookup, role matrix (op shape), then in the transaction: lock project row, retry lookup again, lock items, role matrix (stored geometry), conflicts. A batch refused for role is never reported as a conflict.
- Levels come only from the Gateway's view of the session user (entry 1's proved API); scripts run as `full` under their actor.
- Map item properties never in a log line; no em dashes; unverified Ignition behaviour marked so.

**Never:**
- A new migration or table change. Kind setup ops (entry 9), the browser's conflict display or replay queue (entry 8), `map.changed` (entry 4), store states (entry 5), the AD-19 snapped-ends check (epic-editing), any phone UI (epic-phone).
- A role decided from anything the browser sends; the test hook adds no right the websocket does not already give.

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

Entry 1 is planned, not built; every path below marked (E1) is created by entry 1 and only extended here. Reconfirm names against entry 1 as merged before starting.

- (E1) `gateway/.../write/WriteService.java` -- order of checks; add retry lookup, delete, restore, all-conflicts collection. Keep the hook call after commit only.
- (E1) `gateway/.../write/RoleMatrix.java` -- today `full` saves, `phone` refused; add the phone rules (op shape before the transaction, stored geometry type inside it).
- (E1) `gateway/.../write/EditRefusal.java`, `EditResult.java` -- add `conflicts` list to the refusal.
- (E1) `gateway/.../store/MapStoreRepository.java` -- add: find batch `(project, batch_id)`, write tombstone, restore row, last edit `(actor, at)` for an entity. Batch row `result` already holds the reply.
- (E1) `common/.../common/contract/EditOp.java`, `EditBatch.java`, `common/.../common/Messages.java` -- `delete` with no `data`; refuse two ops on one id; `Conflict` record (new `common/.../contract/Conflict.java`).
- (E1) `web/typescript/contract.ts`, `messages.ts` -- mirror `Conflict` and `conflicts?`.
- (E1) `web/typescript/MapStudio.tsx` -- one line: register the test hook from the store delegate; nothing else here (entries 4 and 8 edit this file).
- (E1) `ops/users.py`, `ops/lib.sh`, `.gitignore` -- user `mapoperator` in `MapOperator`, `MAPSTUDIO_OPERATOR_PASSWORD` in `.env` (same pattern as the editor).
- (E1) `e2e/tests/fixtures.mjs` -- `signIn(page, user)` takes the user; `e2e/lib/env.mjs` reads one key per user.
- (E1) `docs/contract.md` -- own sections: conflicts, retries, delete and restore, role matrix.
- (E1) test fake repository used by `WriteServiceTest` -- if inner to that test, move it to `gateway/src/test/.../write/FakeMapStore.java` first so entries 2 and 5 do not both edit `WriteServiceTest`.
- Mapstudio_edit has no index on `entity_id`; the `changedBy` lookup scans per conflict, acceptable at this size (Design Notes).

## Tasks & Acceptance

**Execution:**
- [ ] `common/.../contract/{EditOp,EditBatch,Conflict}.java`, `web/typescript/{contract,messages}.ts` -- delete op, duplicate-id rule, `Conflict {index, entity, id, baseVersion, current, changedBy, changedAt}`.
- [ ] `gateway/.../write/RoleMatrix.java` -- phone rules as the matrix; refusal message lists what phone editing may change.
- [ ] `gateway/.../store/MapStoreRepository.java` -- the four queries, prepared statements only.
- [ ] `gateway/.../write/{WriteService,EditRefusal,ConflictReport}.java` (`ConflictReport` new: builds the conflicts list and the plain-words message) -- the check order of Boundaries; retry lookup again after the project row lock; on SQLState 23505 on the batch row, roll back and return the stored reply.
- [ ] `gateway/src/test/.../write/{WriteServiceRetryTest,WriteServiceDeleteTest,WriteServiceConflictTest,RoleMatrixPhoneTest}.java` (new), `common/src/test/.../contract/EditOpDeleteTest.java` (new), `web/typescript/__tests__/contract.test.ts` -- one test per matrix row.
- [ ] `web/typescript/testHook.ts` (new) -- `window.__mapStudioTest = {send(type, body): Promise<reply>}` over entry 1's id-routed reply path; not in the public contract; per Open Question 3.
- [ ] `ops/users.py`, `ops/lib.sh`, `e2e/lib/env.mjs`, `e2e/tests/fixtures.mjs` -- the operator user.
- [ ] `e2e/tests/writepath.spec.mjs` (new) -- two editor contexts: conflict with the first's record; same batch sent twice and twice at once, same `seq`; delete then restore; operator context: `level` phone, a drawn line refused `role` with "Not saved" shown (screenshot `mapstudio-store-phone-390.png`), a point move and a line's properties saved, a line's geometry refused `role`.
- [ ] `docs/contract.md` -- the four sections with one JSON example each; `docs/platform-checks.md` -- what the live run showed.

**Acceptance Criteria:**
- Given the e2e suite has run, when `ops/psql.sh -c "select batch_id, count(*) from mapstudio_edit group by batch_id having count(*) > 2"` runs, then no row (the retried batch wrote once).
- Given the e2e suite has run, when the `mapstudio_edit` rows of the restored item are listed, then they read create v1, delete v2, create v3 with the actors who did each.
- Given every refused case of the matrix, when it is sent, then `mapstudio_project.seq` is unchanged.
- Given the existing e2e specs and entry 1's `store.spec.mjs`, when the suite runs, then they pass unchanged.

## Design Notes

- Retry: the stored `mapstudio_batch.result` is the reply; the lookup inside the transaction after `UPDATE mapstudio_project ... RETURNING` serialises a project's batches, so two concurrent sends cannot both commit; a found batch rolls back (no `seq` taken).
- Restore needs no new op or column: `create` with `baseVersion` 0 means new, equal to a tombstone's version means restore; the edit row says `create` with version above 1.
- Conflict message: "Pad P12 was changed by alex at 14:02 UTC since you loaded it. Nothing in this save was written." Several: "3 map items were changed by others since you loaded them. Nothing in this save was written."
- Known gap for epic-editing: a phone move of a point that lines snap to cannot carry the line ends a phone editor may not change (AD-19).
- No migration. An index on `mapstudio_edit (project, entity, entity_id)` would speed `changedBy` and could ride the next migration another entry adds.

## Open Questions

1. **Restore shape.** (a) `create` at the tombstone's version, full data (recommended; no new op, `deleted` never in `data`). (b) `update` with `data.deleted = false` (keeps fields; `deleted` becomes writable).
2. **Who changed it, in the conflict reply.** (a) `changedBy` and `changedAt` from the edit record and in the message (recommended; FR-31 "sees the other editor's change"). (b) The current record only; no user name sent to other editors.
3. **Test hook for the live run.** (a) `window.__mapStudioTest` always registered (recommended; the Gateway decides everything, so it grants nothing). (b) Registered only when the page URL carries `?mapstudio-test`. (c) No hook: Gateway tests plus a session-script view; the phone point move is then not proved live, since scripts run as `full`.

## Verification

**Commands:**
- `./gradlew build` -- expected: green with the new Java and Jest tests.
- `ops/up.sh --fresh` then `cd e2e && npm test` -- expected: all pass.
- The two `psql` queries of Acceptance -- expected: as stated.
- `git grep -nP '\x{2014}'` and `git grep -F` of each generated password -- expected: no match.

**Manual checks (if no CLI):**
- `mapstudio-store-phone-390.png`: the operator's line shown as not saved with the role message, readable at 390 px.
