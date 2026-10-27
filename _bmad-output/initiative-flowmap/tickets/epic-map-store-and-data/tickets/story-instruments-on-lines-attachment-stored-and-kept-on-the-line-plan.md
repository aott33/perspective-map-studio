---
title: 'Instruments on lines: attachment stored and kept on the line'
type: 'feature'
ticket: '14'
created: '2026-10-27'
status: 'draft'
baseline_revision: '8e08240c41dac2ad126681278b0805b221c0ff09'
route: 'full'
route_source: 'auto'
risk: 'high'
review: ''
review_source: ''
lenses_ran: []
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
- [ ] `G/../migrations/0002_instrument_attachment.sql` (new), `Migrations.java` -- `ALTER TABLE mapstudio_item ADD COLUMN attachment jsonb`; partial index on `(project, (attachment->>'lineId'))` where attachment is not null and not deleted; also story 2's suggested `mapstudio_edit (project, entity, entity_id)` index.
- [ ] `C/Attachment.java` (new) -- record `{lineId, distanceM}`: parse (exactly those keys, `lineId` a UUID in lower-case form, `distanceM` finite and not negative, rounded to 0.1 m), `toJson`.
- [ ] `C/LineMeasure.java` (new) -- pure `lengthM(coords)` and `pointAt(coords, distanceM)` with turf 7.4.0's formulas (`length`, `along`); `distanceM(a, b)`.
- [ ] `C/MapItemRecord.java`, `C/ItemCheck.java`, `C/Kind.java`, `C/KindSetup.java` -- as in Code Map.
- [ ] `G/write/AttachmentRules.java` (new) -- `check(tx, project, ops, written)` on the batch's end state: each live written record with an attachment points at a live line item (written in this batch, else `tx.lockItem`) of a line kind, `distanceM` at most length + 1 m, point per Open Question 3; each line in the batch whose geometry changed or that was deleted has no live attached instrument (`tx.liveAttached`) left without an op in this batch carrying `attachment`.
- [ ] `G/store/{MapStore,JdbcMapStore}.java`, `T/write/FakeMapStore.java` -- `attachment` column; `liveAttached(project, lineId)` (prepared, uses the index, ordered by `distanceM`).
- [ ] `G/write/{WriteService,RoleMatrix}.java` -- call `AttachmentRules`; phone rule.
- [ ] Tests: `common` `AttachmentTest`, `LineMeasureTest` (vectors shared with Jest), `KindListTest`, `ItemCheckTest`, `KindSetupTest` additions; `T/write/WriteServiceInstrumentTest.java` (new, every matrix row, op order, restore together, phone), `MigrationsTest`, `MigratorTest`, `MapLoaderTest`, `GatewayScriptModuleTest`.
- [ ] `web/package.json`, `package-lock.json` -- `@turf/helpers`, `@turf/length`, `@turf/along`, `@turf/nearest-point-on-line` at exactly 7.4.0; `NOTICE` -- Turf (MIT) entry.
- [ ] `W/geometry.ts` (new) -- `lengthM`, `pointAt`, `project(line, point)` (nearest place, `distanceM` to 0.1 m), `instrumentsOn(items, lineId)` ordered, and batch builders `lineGeometryBatch(line, newCoords, items)`, `lineSplitBatch(line, partA, newLine, items)` (each instrument to the part it projects onto, measured from that part's start), `lineDeleteBatch(line, items)`.
- [ ] `W/undo.ts` (new) -- `reverseBatch(before, batch, results)`: an update reverses to the old fields at the new version, a delete to a create at the tombstone's version, a create to a delete; one batch for one undo step.
- [ ] `W/contract.ts`, `W/adapters.ts`, `W/unsaved.ts`; Jest `geometry.test.ts`, `undo.test.ts` (new) on L-SWD-like data (PT-1 at 1,143 m, PT-2 at 2,841 m of 2,922 m), `contract.test.ts`, `adapters.test.ts`.
- [ ] `mapstudio_dev/code.py`, `MapStudioEdit/view.json` (`instrumentSave`, `instrumentFromGetMap`), `e2e/tests/instruments.spec.mjs` (new) -- the verify line live through `applyEdits` and `window.__mapStudioTest` `edits.apply`, batches as fixed JSON.
- [ ] `docs/contract.md` (record, attachment rules, a line batch example, schema version 2), `docs/kinds-and-assets.md` (`instrument`), `docs/kind-setup.md` (`instruments` source), `docs/operations.md` (upgrading to schema 2 runs `ALTER TABLE`, which needs the tables' owner role) -- with examples.

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

## Open Questions

1. **Shape of an instruments style rule.** (a) `{"source": {"instruments": "worst"}}` alone, with `type`, `cases` and `expression` refused, since the worst instrument already gives a preset; (b) also require `type: "states"` with cases mapping presets to presets. Recommended: (a).
2. **Which line changes need the instruments in the batch.** (a) a changed geometry and a delete only (a rename or property change needs nothing); (b) any update of the line. Recommended: (a); (b) would make a phone editor's property edit of a line fail.
3. **Must the instrument's point match its attachment.** (a) yes, the Gateway refuses a point more than 1 m from the place at `distanceM` on the line; (b) no, only the range of `distanceM`. Recommended: (a), so the point and the distance can never disagree.
4. **Is an attachment required on an instrument kind.** (a) optional: an instrument kind item may be saved with `attachment` null (a free point until an editor places it); (b) required on every create and update. Recommended: (a), robust to a kind list that changes; a non-instrument kind must always have null.
5. **Phone editors and instruments.** (a) a phone editor's geometry change of an instrument is refused `role` ("An instrument moves along its line; only full editing can move it"); (b) phone editing may also send `attachment` for an instrument staying on the same line. Recommended: (a) now, (b) as a backlog entry for epic-phone.
6. **Area kinds.** (a) an attachment to an area item and an `instruments` source on an area kind are refused; (b) allowed. Recommended: (a); an area is not a pipeline.
7. **Plan size.** About 3,000 tokens, above the 1,600 guide. (a) keep one story, as the owner sliced it and as story 9 did; (b) split the web geometry module and `reverseBatch` into their own entry. Recommended: (a); the Gateway rule and the module are tested against each other.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build` -- expected: green, new and changed tests passing.
- `cd web && npm test` -- expected: all suites pass, `geometry.test.ts` and `undo.test.ts` new.
- `ops/up.sh` on the existing volume (upgrade 1 to 2), then `ops/up.sh --fresh`, each followed by `cd e2e && npm test` and `ops/store-checks.sh` -- expected: all pass (worktree `.env`: `MAPSTUDIO_CONTAINER=ms-e2s14`, `GATEWAY_HTTP_PORT=9134`).

**Manual checks:**
- psql: `\d mapstudio_item` shows `attachment jsonb` and the index; `SELECT max(version) FROM mapstudio_schema_version` is 2; `EXPLAIN` of the `liveAttached` query uses the index.
