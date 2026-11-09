---
title: "11a: The edit record keeps what each change did, read by edits.history"
type: 'feature'
ticket: '11'
created: '2026-11-09'
status: 'draft'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'high'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The map store's edit record (`mapstudio_edit`) keeps who changed which entity, when and to which version, but not what changed, and nothing reads it for the browser, so Recent changes has nothing to list and Revert nothing to reverse (R18).

**Approach:** Entry 11 split by the owner (2026-11-09, "Go with recommendations"): 11a, this plan, is the Gateway half; 11b (`...-plan-11b.md`, `part_of: '11'`) builds the rail's History surface and Revert on it. Migration 0003 adds each op's values before and after, and the item's name and kind, to its edit row, written by the write service in the same transaction from the records it already holds; a new `edits.history` request and reply in contract 0.4.0 reads the record newest first in pages, for the phone and full levels only.

Decisions (owner, 2026-11-09, "yes, I am good with those changes" after the round table): the planner's six picks stand (changed fields only on an update; one entry per batch; pages of 50 entries or fewer once a page reaches 1,000 ops, a batch never split; rows from before the migration listed with no values; `map.changed` unchanged, 11b asking for the first page again; a schema-2-with-edit-rows upgrade in `ops/store-checks.sh`), with the room's changes: each edit row keeps the item's `name` and `kind` as written (the stored record's for a delete), so an old change reads the name it had then (Sally); the page rule is stated against `EditBatch.MAX_OPS` 1,000 (Amelia); the store's size after repeated imports is measured in entry 18's performance run and the record's retention is backlog 37 (Mary, Sofia).

## Boundaries & Constraints

**Always:** Additive: the store schema goes 2 to 3, the contract stays 0.4.0 (unreleased), no existing message changes. **Values:** a create keeps `after` (the written record), a delete `before` (the stored record), an update `before` and `after` holding only the top-level fields whose values differ (geometry, name, kind, properties, overrides, attachment, ...), each field's whole value; kind setup ops the same way; written in `WriteService.apply`'s transaction from `stored`/`current` and `written` (no extra read). **Request** `edits.history {before?: seq, limit?: 1-50, default 50}`; **reply** `edits.history.reply {entries: [{seq, batchId, actor, at, source, ops: [{op, entity, id, name, kind, version, before, after}]}], more}`: one entry per batch, newest first, `before` returning only batches with a lower `seq`; `name` and `kind` from the edit row's own columns (the written record's, the stored record's for a delete), else, for rows from before the migration, from the entity's stored record; rows from before the migration carry `before` and `after` null. A page closes at 50 entries or once adding the next batch would take it past 1,000 ops (`EditBatch.MAX_OPS`, so no batch alone exceeds it), always with at least one whole entry, `more` true when older batches remain. Level `none` is refused `role` (as `tags.*`), so a viewer never learns names. The migration's header in 0002's style; existing rows untouched. No em dashes.

**Never:** Any browser UI (11b); changing `map.changed`, `map.load` or `edits.apply`; storing whole records on updates; a Revert message (Revert is an ordinary `edits.apply` batch, 11b); rewriting migration 0001 or 0002.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| H1 Update | An editor moves P14 | Its entry holds one update op, `before` and `after` with `geometry` only | No error expected |
| H2 Create, delete | A pad created, then a line deleted with its 2 instruments | Create: `after`, `before` null; the delete's entry: 3 delete ops with `before`, one entry | No error expected |
| H3 Newest first | Two editors save, A then B | B's entry first, each with its actor, `at` and `source` | No error expected |
| H4 Page | 60 batches; `limit` 50, then `before` the 50th's seq | 50 entries `more` true, then 10 `more` false | `limit` out of 1-50 or `before` not a number: `invalid` |
| H5 Big batch | 40 small batches, then a 1,000-op batch | The first page stops before the 1,000-op batch (`more` true); the next page holds it whole, alone | No error expected |
| H6 Viewer | Level `none` sends `edits.history` | Refused `role`, no names | No error expected |
| H7 Old rows | A schema-2 store with edit rows, upgraded | Version 3 applied once; old rows listed with who, what entity, when, `before`/`after` null, name and kind from the stored record; a move after a rename lists the name it had then | A failed migration leaves version 2 (Migrator's rule) |
| H8 Refused batch | A batch refused (conflict) | No entry: nothing was written | No error expected |

</frozen-after-approval>

## Code Map

G = `gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway`, GT its test tree, C = `common/src/main/java/com/aoindustrial/perspective/mapstudio/common`, W = `web/typescript`.

- `gateway/src/main/resources/.../store/migrations/0003_edit_values.sql` (new; 0002 is the model) and `G/store/Migrations.java:22 FILES`.
- `G/store/MapStore.java` -- `EditRow` record :31 (add before/after `JsonObject`s), Tx methods :44-94 (add a history page read); `G/store/JdbcMapStore.java` -- `insertEdit` :185, `lastEdit` :230, `LAST_EDITS_SQL` :41 (reader pattern).
- `G/write/WriteService.java` -- `apply` :101-197: `stored` :135-138, `current = stored.get(op.index())` :154 beside `written`, `insertEdit` :160. `AttachmentRules` only checks the batch carries ops for attached instruments, so every write is a batch op.
- `C/Messages.java` -- type constants :40-87, `INBOUND_TYPES` :88, `OUTBOUND_TYPES` :92, `CODE_ROLE`/`CODE_INVALID`; `common/src/test/.../contract/ContractTest.java`.
- `G/MapStudioDelegate.java` -- `handleEvent` :265, `isStoreType` :485, `job` :361-371, `storeReply` :413 (`RoleMatrix.level`); role refusal as `G/tags/TagLookups.java:209-217` with `RoleMatrix.isEditor` (`G/write/RoleMatrix.java:63`).
- `W/messages.ts` (`MessageTypes` :23, `Reply` :74, builders ~:110, `readReply` :143, `replyText` :203), `W/contract.ts` (reader pattern :145-163), `W/testHook.ts:17` (allow the type) -- types and reader only, for 11b and e2e.
- Docs: `docs/contract.md` (new `## edits.history` near `## map.changed` :31; the store heading :393 to schema version 3, its text), `CHANGELOG.md` (0.4.0 intro says "map store schema 2 (... no migration)"), `docs/platform-checks.md` (upgrade result), `docs/test-playbook-0.4.0.md` (8i, a short Gateway check).
- `ops/store-checks.sh` scenario `upgrade` :214-250 (inline fixtures; expected log line "now at schema version 2") -- add a schema-2-with-edit-rows upgrade to 3.
- Tests: `GT/store/MigrationsTest.java` (:36 model), `MigratorTest.java`, `GT/store/LastEditsTest.java` (JDBC reader pattern), `GT/write/WriteServiceTest.java` and siblings, `GT/write/FakeMapStore.java`, `GT/TagsReplyTest.java` (role refusal model), `GT/StoreReplyPerCallTest.java`; `W/__tests__/messages.test.ts`; `e2e/tests/` new `history.spec.mjs` through the test hook.

## Tasks & Acceptance

**Execution:**
- [ ] `0003_edit_values.sql`, `Migrations.java` -- `before jsonb`, `after jsonb`, `name text`, `kind text` on `mapstudio_edit`; an index for `(project, seq DESC)` if the page query needs it -- H7.
- [ ] `MapStore.java`, `JdbcMapStore.java`, `FakeMapStore.java` -- write the values; read a page grouped by batch with the 50-entry / 1,000-op rule and `more` -- H4, H5.
- [ ] `WriteService.java` -- compute the values, name and kind per op from `current` and `written` -- H1, H2, H7, H8.
- [ ] `Messages.java`, `MapStudioDelegate.java` -- the types, routing, validation, role refusal, `name`/`kind` -- H3, H6.
- [ ] Gateway and common tests -- every matrix row; the migration and the page cursor.
- [ ] `messages.ts`, `contract.ts`, `testHook.ts`, Jest -- the request builder and the reply reader.
- [ ] `e2e/tests/history.spec.mjs` -- H1 to H6 and H8 on the dev stack through the test hook (two editors, the operator user for H6).
- [ ] `ops/store-checks.sh`, docs -- H7 run once by the orchestrator; contract, CHANGELOG, platform checks, playbook 8i.

**Acceptance Criteria:**
- Given the dev stack, when two editors move P14 and P31, then `edits.history` lists P31's move first with its actor, time and old and new coordinates, then P14's.
- Given `bash scripts/ci/check-contract-versions.sh`, then it passes at contract 0.4.0 and map store schema 3.

## Implementation Notes

- Planner, 2026-11-09: the environment, commit and identity rules are entry 8's plan's (Docker by hand after a restart, JDK 17 by apt if gone, `ops/up.sh --fresh` before a whole-suite run, the session's trailers, `git commit --only`, no em dashes, never a bare `git stash`, never a push). A Gradle download refused 429 passes on a retry with backoff. ignition-lint is the orchestrator's if an Ignition file changes.

## Plan Change Log

## Review Triage Log

## Design Notes

Only changed fields on an update keep the record small and are enough for Revert: an update reverting sends `before`'s fields at the op's `version`, so the Gateway refuses it, naming who, when the item changed since. The op cap keeps an import-sized batch from making every page huge while never splitting one batch, since Revert reverses a batch as one step.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK, map store schema 3
- `ops/up.sh --fresh`, then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: 0 failed
- `ops/store-checks.sh upgrade` -- expected: version 3 applied once, old rows readable
