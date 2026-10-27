---
title: 'Instruments on lines: attachment stored and kept on the line'
type: 'feature'
ticket: '14'
created: '2026-10-27'
status: 'built'
baseline_revision: '8e08240c41dac2ad126681278b0805b221c0ff09'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/docs/contract.md'
  - '{project-root}/docs/kind-setup.md'
  - '{project-root}/_bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md'
  - '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/story-kind-setups-in-the-map-store-and-items-checked-against-the-k-plan.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A tap, meter or line valve is saved today as a free point: the record has no `attachment`, the kind list cannot mark an instrument kind, and nothing stops a save that moves or deletes a line and leaves its instruments off it (initiative R41, prd FR-40, AD-16, AD-19, AD-20, epic R16).

**Approach:** Migration 2 adds `attachment {lineId, distanceM}` to the map item record; `instrument: true` marks a point kind; the write service checks every attachment and refuses a batch that changes or deletes a line without its instruments; a new shared geometry module in `web/` builds the one batch (line plus its instruments) for a move, reshape, vertex change, split or delete, and its undo; a line kind's style rule may take `{instruments: "worst"}`. Stored and validated only.

## Boundaries & Constraints

**Always:** All or none in the one existing transaction; every refusal is `invalid` (or `role`/`conflict` as today), names the op `{index, id}` in plain words, writes nothing and takes no `seq`. Checks run on the state the whole batch leaves (a line and its instruments restored or created together pass in any op order). Deleting a line deletes its instruments in the same batch; one reverse batch restores both (owner, 2026-10-27). A line batch that carries its instruments is one batch, so story 8's queue replays it whole with its `baseVersion`s. Same distance formulas in Java and TypeScript (turf 7.4.0's haversine, radius 6371008.8 m), shared test vectors. Jython 2.7 in doc examples. No em dashes. Contract stays 0.2.0 draft, every change in docs.

**Never:** No drawing, popup, instrument tool, snapping UI or undo stack (epic-viewing entry 2, epic-editing). No spatial SQL. No change to stories 2 to 10 and 15 beyond the files named here. Never infer an attachment from nearness. No down migration.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Error |
|---|---|---|---|
| Save | line L-SWD 2,922 m; create `tap` PT-1 `attachment {lineId: L, distanceM: 1143}`, point at 1,143 m | v1; `map.load`, `getMap`, `map.changed` return the attachment unchanged | none |
| Bad attachment | on `pad` (not instrument); to a deleted, missing or point item; `distanceM` -1 or 2,924; point 5 m off its place | refused | `invalid`, names the instrument and the line |
| Line without instruments | update L geometry (or delete L) with no op for PT-1, PT-2 | refused | `invalid` "line L-SWD has 2 instruments (PT-1, PT-2) this save does not move or delete" |
| Line with instruments | Jest: move, reshape, vertex insert, split of L-SWD-like data | one batch: line op(s) plus each instrument `{geometry, attachment}` at its nearest place | none |
| Delete and undo | delete L and PT-1, PT-2; then the reverse batch | one seq each; the reverse restores all three at their tombstone versions | none |
| Concurrent | PT-1 updated by another editor before the line's batch | whole batch refused | `conflict`, `current` PT-1 |
| Style source | `{instruments: "worst"}` on a line kind; on `pad` | first saved; second refused | `invalid` |
| Kind list | `instrument: true` on a line kind | that kind row left out with its reason | adapter status `incomplete` |

## Decisions

**2026-10-27, owner ("agree with all recommendations, start building"):**
1. An instruments style rule is only `{"source": {"instruments": "worst"}}`; `type`, `cases` and `expression` beside it are refused.
2. Only a changed geometry or a delete of a line needs its instruments in the batch; a rename or property change of a line needs nothing.
3. An instrument's point must be within 1 m of the place its `distanceM` puts it on the line; the Gateway refuses it otherwise.
4. `attachment` is optional on an instrument kind (null is a free point) and never allowed on any other kind.
5. A phone editor may not move an instrument: a geometry or attachment change of an instrument kind item is refused `role`, "An instrument moves along its line; only full editing can move it". Phone editing that sends `attachment` is a backlog entry for epic-phone.
6. No instruments on area kinds: an attachment to an area item and an `instruments` source on an area kind are refused.
7. One story, kept whole (about 3,000 tokens).

</frozen-after-approval>

## Code Map

`C` = `common/src/main/java/com/aoindustrial/perspective/mapstudio/common/contract`, `G` = `gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway`, `T` = `gateway/src/test/java/com/aoindustrial/perspective/mapstudio/gateway`, `W` = `web/typescript`.

- `G/../resources/.../store/migrations/0001_first_schema.sql`, `G/store/Migrations.java` (`FILES`) -- only `0001` exists in any branch, so this story adds `0002_instrument_attachment.sql` (verified). `MigrationsTest` asserts `latest() == 1`: becomes 2.
- `C/MapItemRecord.java` -- closed record, `DATA_FIELDS`, `merge` switch, `toJson`; add the `attachment` component (null, never `JsonNull` in Java) between `ends` and `version`; every `new MapItemRecord(...)` call (WriteService, ItemCheck, JdbcMapStore, FakeMapStore, tests) gains it.
- `C/ItemCheck.java` -- the field-by-field seam story 9 left: attachment present needs `kind.instrument()`.
- `C/Kind.java` -- mirror `area`: `instrument` component, keep the 6- and 7-argument constructors, `toJson` writes it only when true, on a non-point kind the row is left out.
- `C/KindSetup.java` `source(...)` -- the one switch story 9 left; add `instruments` (line kinds only).
- `G/write/WriteService.java` -- transaction body after the per-op writes and before `insertBatch`: call the new batch-level check; `kindList` stays skipped for delete-only batches (the line rule needs no kind list).
- `G/write/RoleMatrix.java` `checkStored` -- phone rule per Open Question 5.
- `G/store/MapStore.java`, `JdbcMapStore.java` (`ITEM_COLUMNS`, `insertItem`, `updateItem`, `item(rs)`), `T/write/FakeMapStore.java` -- the column and one new read.
- `G/load/MapLoader.java`, `G/script/MapList.java`, `G/MapStudioDelegate.java` `bodyFor`, `G/change/ChangeEvent.java` -- all send `record.toJson()`: no code change, tests only. `common/src/main/resources/.../MapStudioScriptModule.properties` `getMap.returns` names `attachment`.
- `W/contract.ts` (`MapItemRecord`, `readMapItem`), `W/adapters.ts` (`Kind`, `readKind`), `W/unsaved.ts` (`unsavedItems` builds records) -- add the field and flag. No `W/geometry` module exists yet (AD-19 names it): this story creates it. `web/package.json` has no turf.
- `T/write/WriteFixture.java`, `T/adapter/TestKinds.java`, `common/src/test/.../KindFixtures.java` -- kind fixtures gain a `tap` instrument kind.
- `ops/project/ignition/script-python/mapstudio_dev/code.py` `kinds()` -- add `tap` (`icon: tap`, `instrument: True`); `ops/project/.../views/MapStudioEdit/view.json` "Run script checks"; `e2e/tests/*.spec.mjs` that count kinds may need the new row.

## Tasks & Acceptance

**Execution:**
- [x] `G/../migrations/0002_instrument_attachment.sql` (new), `Migrations.java` -- `ALTER TABLE mapstudio_item ADD COLUMN attachment jsonb`; partial index on `(project, (attachment->>'lineId'))` where attachment is not null and not deleted; also story 2's suggested `mapstudio_edit (project, entity, entity_id)` index.
- [x] `C/Attachment.java` (new) -- record `{lineId, distanceM}`: parse (exactly those keys, `lineId` a UUID in lower-case form, `distanceM` finite and not negative, rounded to 0.1 m), `toJson`.
- [x] `C/LineMeasure.java` (new) -- pure `lengthM(coords)` and `pointAt(coords, distanceM)` with turf 7.4.0's formulas (`length`, `along`); `distanceM(a, b)`.
- [x] `C/MapItemRecord.java`, `C/ItemCheck.java`, `C/Kind.java`, `C/KindSetup.java` -- as in Code Map.
- [x] `G/write/AttachmentRules.java` (new) -- `check(tx, project, ops, written)` on the batch's end state: each live written record with an attachment points at a live line item (written in this batch, else `tx.lockItem`) of a line kind, `distanceM` at most length + 1 m, point per Open Question 3; each line in the batch whose geometry changed or that was deleted has no live attached instrument (`tx.liveAttached`) left without an op in this batch carrying `attachment`.
- [x] `G/store/{MapStore,JdbcMapStore}.java`, `T/write/FakeMapStore.java` -- `attachment` column; `liveAttached(project, lineId)` (prepared, uses the index, ordered by `distanceM`).
- [x] `G/write/{WriteService,RoleMatrix}.java` -- call `AttachmentRules`; phone rule.
- [x] Tests: `common` `AttachmentTest`, `LineMeasureTest` (vectors shared with Jest), `KindListTest`, `ItemCheckTest`, `KindSetupTest` additions; `T/write/WriteServiceInstrumentTest.java` (new, every matrix row, op order, restore together, phone), `MigrationsTest`, `MigratorTest`, `MapLoaderTest`, `GatewayScriptModuleTest`.
- [x] `web/package.json`, `package-lock.json` -- `@turf/helpers`, `@turf/length`, `@turf/along`, `@turf/nearest-point-on-line` at exactly 7.4.0; `NOTICE` -- Turf (MIT) entry.
- [x] `W/geometry.ts` (new) -- `lengthM`, `pointAt`, `project(line, point)` (nearest place, `distanceM` to 0.1 m), `instrumentsOn(items, lineId)` ordered, and batch builders `lineGeometryBatch(line, newCoords, items)`, `lineSplitBatch(line, partA, newLine, items)` (each instrument to the part it projects onto, measured from that part's start), `lineDeleteBatch(line, items)`.
- [x] `W/undo.ts` (new) -- `reverseBatch(before, batch, results)`: an update reverses to the old fields at the new version, a delete to a create at the tombstone's version, a create to a delete; one batch for one undo step.
- [x] `W/contract.ts`, `W/adapters.ts`, `W/unsaved.ts`; Jest `geometry.test.ts`, `undo.test.ts` (new) on L-SWD-like data (PT-1 at 1,143 m, PT-2 at 2,841 m of 2,922 m), `contract.test.ts`, `adapters.test.ts`.
- [x] `mapstudio_dev/code.py`, `MapStudioEdit/view.json` (`instrumentSave`, `instrumentFromGetMap`), `e2e/tests/instruments.spec.mjs` (new) -- the verify line live through `applyEdits` and `window.__mapStudioTest` `edits.apply`, batches as fixed JSON.
- [x] `docs/contract.md` (record, attachment rules, a line batch example, schema version 2), `docs/kinds-and-assets.md` (`instrument`), `docs/kind-setup.md` (`instruments` source), `docs/operations.md` (upgrading to schema 2 runs `ALTER TABLE`, which needs the tables' owner role) -- with examples.

**Acceptance Criteria:**
- Given a dev database at schema 1 with saved items, when the new module starts, then `mapstudio_schema_version` holds 2, existing items read back with `attachment` null, and nothing else changed.
- Given the e2e run, when psql lists the line delete batch, then one `seq` holds the line and both instruments, and the reverse batch's `seq` restores all three.
- Given the existing Gateway, Jest and e2e suites, when run after this story, then they pass unchanged except where this plan names a change.

## Design Notes

```json
{"batchId": "...", "ops": [
 {"op": "update", "entity": "item", "id": "<L-SWD>", "baseVersion": 4, "data": {"geometry": {"type": "LineString", "coordinates": [...]}}},
 {"op": "update", "entity": "item", "id": "<PT-1>", "baseVersion": 2,
  "data": {"geometry": {"type": "Point", "coordinates": [-103.51, 31.92]}, "attachment": {"lineId": "<L-SWD>", "distanceM": 1150.2}}}]}
```

The Gateway does not project; it only checks that the browser's result is on the line. The batch-level check runs after the per-op writes inside the transaction, so it sees the batch's end state; a refusal rolls everything back. The project row lock taken by `nextSeq` serialises the project's batches, so no instrument can be attached to a line between the check and the commit. Turf is used as separate 7.4.0 packages (the same code as `@turf/turf` 7.4.0 in the architecture's Stack, smaller bundle).

## Implementation Notes

- Implemented directly from the plan (no subagent tool in this session), 2026-10-27.
- `AttachmentRules` checks the lines first (a changed or deleted line with an instrument left behind), then each written attachment, both on the state the batch leaves; so a batch that reshapes a line and forgets an instrument is refused naming the line, not the instrument's now-wrong point. The instrument named in that message is the one as the batch leaves it (a renamed one by its new name).
- The phone rule refuses a geometry change of a point whose kind is an instrument kind, or of any stored point with an attachment (a kind that stopped being an instrument), and any phone update carrying `attachment`, with the owner's words.
- Distances: `LineMeasure` ports Turf 7.4.0's `distance`, `bearing`, `destination`, `length` and `along`, including Turf's `% 360` and `% 2 pi` normalisation; the shared vectors (`common/src/test/resources/.../line-measure-vectors.json`) were generated by Turf itself and Java agrees to 1e-6 m and 1e-11 degrees.
- `web/typescript/geometry.ts` adds `lineMoveBatch` (a whole-line move by an offset, each instrument's point moved by the same offset before projecting), beside the plan's `lineGeometryBatch`, `lineSplitBatch` and `lineDeleteBatch`; projection uses `nearestPointOnLine`'s `lineDistance`, rounded to 0.1 m, and stores the point Turf's `along` gives at that rounded distance, so the Gateway's 1 m check always holds.
- Nothing in the component imports `geometry.ts` or `undo.ts` yet, so Turf is not in the browser bundle (MapStudio.js 1,209,165 to 1,209,432 bytes, the contract and adapter reader changes); NOTICE says so.
- `StoreRegistry` logs "upgraded" instead of "created" when the first applied migration is not 1.
- The dev adapter gained `tap` (instrument); e2e kind counts went from 3 to 4, and the /edit script checks add a line and a tap (placed before story 9's checks so the script's last save is still the CSV pad), so `changes.spec.mjs` counts +5 and `store.spec.mjs` +4.
- `ops/store-checks.sh` gained scenario `upgrade` (schema 1 with an item, tables owned by another role: refused 42501 on `ALTER TABLE`, then upgraded after the ownership is given, no restart); `store-ops.spec.mjs` gained scenario `upgraded`.
- Phone editing that sends `attachment` (Open Question 5, option b) is in `_bmad-output/deferred-work.md` for epic-phone.

## Plan Change Log

- 2026-10-27, implementation: added `lineMoveBatch` to `W/geometry.ts`, the `upgrade` scenario to `ops/store-checks.sh` (with `upgraded` in `e2e/tests/store-ops.spec.mjs`), the "upgraded" log wording in `G/store/StoreRegistry.java`, and count updates in `e2e/tests/{adapters,icons,changes,store}.spec.mjs` and `WriteServiceKindCheckTest` caused by the new `tap` kind and script checks. No frozen content changed.
- 2026-10-27, review (lens quick): added `web/typescript/__tests__/batch-replay.test.ts`, `gateway/src/test/resources/.../write/instrument-batches.json` and `WriteServiceBatchReplayTest.java`; the getMap answer of `ops/store-checks/project/.../MapStudioCheck/view.json` also lists the records it read. No frozen content changed.

## Review Triage Log

**2026-10-27, lens quick (context-free), iteration 0.** Five findings: four patched in code and tests, one (2) patched by documenting the behaviour, its code option rejected.

| # | Finding | Triage | Fix |
| --- | --- | --- | --- |
| 1 | A line's kind changed to an area kind (same LineString) saves with its instruments still attached; an attachment to a line whose kind is not in the kind list passes | Patched (real defect, owner decision 6) | `AttachmentRules`: a live line whose `kind` changes, or whose kind is not a line kind that is not an area, needs every attached instrument in the batch, like a moved line ("Its new kind geofence is not a line instruments go on; delete or detach its instruments in the same save."); an attachment to a line whose kind is not in the kind list is refused. Tests `aLineTurnedIntoAnAreaWithItsInstrumentsStillAttachedIsRefused` (alone, with the taps moved along it, and saved with the taps detached) and `anAttachmentToALineWhoseKindIsNotInTheKindListIsRefused`; docs/contract.md. |
| 2 | Racing editors: a line batch that misses an instrument another editor just attached is refused `invalid`, not `conflict` | Patched by documentation; the `conflict` option rejected | The line's version does not change when an instrument is attached to it, so no op of the batch is stale and there is no `current` to send: reporting the unseen instrument as a conflict would need a conflict entry for an id the batch has no op for (a contract change), and "attached after the batch's base" has no reliable test (an attachment carries no time, and a line's `baseVersion` is not a time). docs/contract.md now says this race comes back `invalid` naming the instrument, and the browser reloads (`map.load`) and builds the batch again. Nothing is corrupted (the project row lock serialises both saves). |
| 3 | No test sends what `geometry.ts` or `undo.ts` produce to the Gateway; the e2e restore comment overclaims; PT-2 not checked gone | Patched (real gap) | New Jest `batch-replay.test.ts` builds a run (create, reshape, its `reverseBatch`, vertex insert, move, split, its `reverseBatch`, delete with the taps, its `reverseBatch`, with the `attachment: null` and `ends: null` it sends) on a store model and must match the committed `gateway/src/test/resources/.../write/instrument-batches.json` (`UPDATE_FIXTURES=1` rewrites it); new `WriteServiceBatchReplayTest` replays every batch through the real `WriteService` and checks each version and the final records. `instruments.spec.mjs` checks PT-2 is gone and its comment says the restore is hand-built and where `reverseBatch` itself is replayed. |
| 4 | Shared vectors have no closed ring, repeated vertex or zero-length line | Patched (real gap) | `closed-ring`, `repeated-vertex` (distances before, at and after it) and `zero-length` generated by Turf 7.4.0 into `line-measure-vectors.json`, read by both suites; `LineMeasureTest.aRingARepeatedVertexAndAZeroLengthLineMeasureAsTurfDoes` and Jest `project()` cases for each. |
| 5 | Acceptance criterion 1 ("read back with `attachment` null") not checked through the module | Patched (real gap) | The check view's getMap answer also lists the records it read; the `upgraded` spec checks the schema 1 pad's whole record from `getMap` and from `map.load` (`attachment` null, every other field as written at schema 1). |

Re-run after the patches: `./gradlew clean build` green (376 JUnit tests: common 84, gateway 258, designer 34; 0 failures); `tsc --noEmit` clean, Jest 150 of 150 in 18 suites; e2e on `ops/up.sh --fresh` 53 passed and 7 skipped (the `store-ops` scenarios and the stopped-Gateway case); `ops/store-checks.sh` all passed (rights, partial, healed, newer, upgrade).

## Verification

**Commands:**
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build` -- expected: green, new and changed tests passing.
- `cd web && npm test` -- expected: all suites pass, `geometry.test.ts` and `undo.test.ts` new.
- `ops/up.sh` on the existing volume (upgrade 1 to 2), then `ops/up.sh --fresh`, each followed by `cd e2e && npm test` and `ops/store-checks.sh` -- expected: all pass (worktree `.env`: `MAPSTUDIO_CONTAINER=ms-e2s14`, `GATEWAY_HTTP_PORT=9134`).

**Manual checks:**
- psql: `\d mapstudio_item` shows `attachment jsonb` and the index; `SELECT max(version) FROM mapstudio_schema_version` is 2; `EXPLAIN` of the `liveAttached` query uses the index.
