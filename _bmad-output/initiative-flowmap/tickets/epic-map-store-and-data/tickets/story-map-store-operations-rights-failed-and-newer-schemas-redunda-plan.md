---
title: 'Map store operations: rights, failed and newer schemas, redundancy'
type: 'feature'
ticket: '5'
created: '2026-10-26'
status: 'in-review'
baseline_revision: 'f3a63a29cb7c8c5ed80bef5acbeaf29fe341fb63'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/story-tracer-one-edit-saved-through-the-write-path-and-read-back-plan.md'
  - '{project-root}/docs/platform-checks.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Story 1 knows two store states (`ready`, `unavailable`) and one failure line (42501 on CREATE). Epic R2 and AD-21 also need: any failed migration rolled back and logged once with connection, statement and SQLState; a schema newer than the module making the map read only; and a standby Gateway of a redundant pair refusing writes. Operators have no page on backups, rights or redundancy.

**Approach:** Extend story 1's migrator and store state, not the write logic: the migrator runs a migration statement by statement inside story 1's one transaction and turns any failure into one AD-21 line; a recorded version above the module's makes the store `read-only`; a redundancy gate over `RedundancyManager` makes a standby `read-only`. The write service refuses `read-only` where it already refuses `store-unreachable`; `map.load` and `getMap` carry the reason. Adds `docs/operations.md` and a dev-stack check harness (a check database, role, connection and project) driven by `ops/store-checks.sh`.

## Boundaries & Constraints

**Always:**
- Build on story 1's contracts as accepted (migration 1, op and message shapes, setup v1, `StoreRegistry` keyed by connection, write service order, `MapLoader`, scripting API, Designer "runs in Gateway scope only").
- One error line per failure, through `MapStudio.store`: connection, migration number, statement ordinal and its first line, SQLState, the right when SQLState is 42501, and PostgreSQL's message. No value, password or map item property in it.
- A failed migration leaves no `mapstudio_` object it created (PostgreSQL rolls back DDL inside the transaction [PostgreSQL docs; seen live by this story's check]).
- `read-only` and standby refusals write nothing (no edit, batch or `seq` row) and call no change hook.
- Redundancy SDK use (`GatewayContext.getRedundancyManager()`, `isRedundancyEnabled()`, `isActive()`, `addRedundancyStateListener`) is [SDK 8.3.0 javap], marked unverified in code and docs; only the independent case is seen live.
- No database migration: this story changes no schema.

**Never:**
- Conflicts, retries, deletes, the phone matrix (story 2), kinds and assets or their caches (story 3), `map.changed` and reloading open maps after failover (story 4), setup validation or live setup change (story 6), the Designer editor (story 7).
- Edit story 1's existing specs or assertions; change the template; add a Gateway-wide setting.
- Downgrade or alter a newer schema; never run a migration on a `read-only` store.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| CONNECT-only role | setup names a connection whose role lacks CREATE | one error line (statement 1, SQLState 42501, "CREATE on schema public"); no `mapstudio_` table | `map.load` and `applyEdits`: `store-unreachable`, plain words |
| Failure mid-migration | statement N of migration 1 fails (any SQLState) | rollback; nothing of statements 1..N-1 remains; one error line naming N | as above |
| Non-SQL failure in migrator | runtime exception | rollback, one error line, SQLState "none" | as above |
| Newer schema | recorded max version > module's | no migration; one warning naming connection and both versions; `map.load` items as usual with `readOnly` reason | save: `read-only`; `getMap` returns `readOnly`; `applyEdits` raises `read-only: <reason>` |
| Standby | redundancy enabled, this node not active | `map.load` with `readOnly` "standby" reason | save: `read-only`, plain words naming the standby |
| Becomes active | state listener sees active | gate opens; migrator runs if not yet run | none |
| Independent Gateway | redundancy disabled | writes accepted | none |

## Decisions (owner, "approve 2 to 7, recommendations", 2026-10-26)

- **Recovery from `unavailable`:** the migrator runs again lazily on `map.load` or `applyEdits`, at most once per 60 s per connection, and logs the error line again only when it changes, so fixing the grant heals without a restart.
- **Error code for read only:** one new code `read-only` for both the newer schema and the standby, with distinct messages; additive to the 0.2.0 draft.
- **Migrations on a standby:** only an independent or active node migrates; a standby only reads the version and runs the migrator on becoming active.
- **Where the store checks run:** by hand (`ops/store-checks.sh`), results recorded in `docs/platform-checks.md`; no CI job.

</frozen-after-approval>

## Code Map

Story 1 files this story extends (paths under `gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/` unless shown), with the names story 1 shipped (its Plan Change Log):
- `store/Migrator.java` -- keep story 1's order (read the version with no lock and no DDL, then lock, `CREATE TABLE IF NOT EXISTS mapstudio_schema_version` and the migration only when one is pending). `Migrator.MigrationFailure` gains the migration number, the statement ordinal and count, and wraps a runtime failure too (SQLState "none"); `recordedVersion(Connection)` reads only (for a standby). `Migrations.statements` already splits a migration (no new splitter).
- `store/FailureLine.java` (new, pure) -- the AD-21 error line and the user reason from a `MigrationFailure`.
- `store/StoreState.java` -- status `READ_ONLY` (reason); `isReadable()`.
- `store/StoreRegistry.java` -- newer schema becomes `READ_ONLY` with one warning; failures logged through `FailureLine` once per distinct line; lazy retry of an `UNAVAILABLE` connection at most once per 60 s from `ensure`; a `BooleanSupplier mayMigrate` (the redundancy gate) so a standby only reads the version; `retryNow()` on becoming active.
- `store/StoreGate.java` -- story 1's one check gains `requireWritable` (also refuses `read-only`: newer schema or standby) and `requireReadable` (returns the setup and the read-only reason); `requireReady` stays as `requireWritable`.
- `redundancy/RedundancyGate.java` (new) -- `ActiveNode` interface, adapter over `RedundancyManager`, `mayWrite() = !isRedundancyEnabled() || isActive()`, info line once per state change, `onActive` callback.
- `MapStudioServices.java` -- builds the gate from `context.getRedundancyManager()`, adds and removes its listener (`RedundancyStateAdapter`) in `start`/`stop`.
- `write/WriteService.java` -- one change: `gate.requireReady` becomes `gate.requireWritable`.
- `load/MapLoader.java` -- `load(project)` (snapshot plus read-only reason); `map.load.reply` gains `readOnly` (reason or null).
- `script/GatewayScriptModule.java`, `script/MapList.java` (new) -- `getMap` still returns the list of records; the list also answers `readOnly` (reason or None), so story 1's callers are unchanged.
- `common/.../common/Messages.java` (`CODE_READ_ONLY`), `web/typescript/contract.ts` (`ErrorCodes.READ_ONLY`, `MapLoadReplyBody.readOnly`), `web/typescript/storeState.ts` (new, pure), `web/typescript/MapStudio.tsx` (`data-store-state` `ready|read-only|unavailable` on `.mapstudio-map`, `.mapstudio-store-status` line).
- `ops/docker-compose.yml` (postgres mounts `ops/postgres-init/`), `ops/lib.sh` (`MAPSTUDIO_STORE_CHECKS=1` adds `ops/docker-compose.store-checks.yml` to `COMPOSE`).
- `docs/contract.md`, `docs/architecture.md`, `docs/platform-checks.md`, `docs/operations.md` (new).

Reuse: story 1's `FakeJdbc` (extended: `failOnRuntime`), `FakeMapStore`, `StoreRegistryTest`'s manual scheduler pattern; `ops/psql.sh`; e2e `test`, `mapLoaded`, `nextFrames` from `e2e/tests/fixtures.mjs`. Do not change story 1's specs or test assertions, except the two "every error code" lists (`ContractTest`, `contract.test.ts`) that must name the new code (decision 2).

## Tasks & Acceptance

**Execution:**
- [x] `store/Migrator.java`, `store/FailureLine.java`, `store/StoreState.java`, `store/StoreRegistry.java`, `store/StoreGate.java` -- as Code Map.
- [x] `redundancy/RedundancyGate.java`, `MapStudioServices.java` -- as Code Map.
- [x] `write/WriteService.java`, `load/MapLoader.java`, `script/GatewayScriptModule.java`, `script/MapList.java`, `Messages.java`, `contract.ts`, `storeState.ts`, `MapStudio.tsx`.
- [x] Tests (new files): `gateway/src/test/.../store/{FailureLineTest,MigratorFailureTest,StoreRegistryStateTest,StoreGateTest}.java`, `redundancy/RedundancyGateTest.java`, `write/WriteServiceStoreStateTest.java` (read-only and standby: nothing written, no hook), `script/MapListTest.java`, `web/typescript/__tests__/storeState.test.ts`.
- [x] `ops/postgres-init/20-store-checks.sh` (new: database `mapstudio_check` owned by `mapstudio`, role `mapstudio_check` LOGIN with no CREATE, password from the `pg_password` Docker secret through a psql variable), `ops/config/core/ignition/database-connection/MapStudioCheck/{config,resource}.json` (new), `ops/docker-compose.store-checks.yml` (new: mounts `ops/store-checks/project` as project `mapstudio-check`), `ops/store-checks/project/**` (new: setup naming `MapStudioCheck`, one map view with a `getMap` button, page `/`).
- [x] `ops/store-checks.sh` (new) -- ensures the check database and role (kept volumes), then per scenario sets the database with psql, restarts the Gateway where needed, greps the log and runs `e2e/tests/store-ops.spec.mjs` with `MAPSTUDIO_STORE_SCENARIO`: `rights` (no grant), `partial` (CREATE granted; the owner pre-creates `mapstudio_kind_setup`), `healed` (blocker dropped, no restart: the lazy retry), `newer` (version 999 recorded); restores the check database and the plain Gateway at the end.
- [x] `e2e/tests/store-ops.spec.mjs` (new; skipped unless `MAPSTUDIO_STORE_SCENARIO` is set): `unavailable` state and message; `ready` after healing; `read-only`: a drawn line refused `read-only`, item count unchanged after reload, `getMap(...).readOnly` the reason; screenshots `mapstudio-store-{unavailable,readonly}-{1440,390}.png`.
- [x] `docs/operations.md` (new), `docs/contract.md`, `docs/architecture.md`, `docs/platform-checks.md` section "Epic 2 story 5 - map store states".

**Acceptance Criteria:**
- Given `ops/store-checks.sh` on the dev stack, when scenario `rights` runs, then the Gateway log has exactly one Map Studio error line naming `MapStudioCheck`, migration 1, statement 1, SQLState 42501, and the spec sees `unavailable`.
- Given scenario `partial`, then the log names migration 1's `mapstudio_kind_setup` statement and its SQLState, and `pg_tables` in `mapstudio_check` lists only the pre-created table.
- Given scenario `healed`, then without a Gateway restart the spec sees `ready` within the retry interval and `mapstudio_check` holds the whole first schema.
- Given scenario `newer`, then the log has one warning naming both versions and the spec sees `read-only` with the save refused; `mapstudio_edit` in `mapstudio_check` gains no row.
- Given the plain dev stack (no overlay), when story 1's checks run, then they still pass and no Map Studio error is logged.

## Implementation Notes

Baseline is the merge of story 1 (`f3a63a2`). No migration. Redundancy is unit tested over the `ActiveNode` interface; only the independent Gateway is seen live.

## Plan Change Log

**Implementation, 2026-10-27 (not a review loopback).** Built as planned with these details:
- The e2e check project page view has a "Read with getMap" button (a Gateway-scope view script, reads only) so `getMap(...).readOnly` is checked live.
- `ops/store-checks.sh` passes `MAPSTUDIO_STORE_SHOTS=0` to the second `unavailable` run (`partial`), so the screenshots show the `rights` case.
- `map.load.reply` always carries `readOnly` (JSON null when writable); the browser's `MapLoadReplyBody.readOnly` is optional and left out when null, so story 1's reader test stands unchanged.
- The standby reason gained a second sentence ("Open the map on the active Gateway to save.").
- Verified: `./gradlew clean build` green (JUnit 78, Jest 46); plain e2e 16 passed, 5 skipped (`store-ops`); `E2E_DOCS=1 ops/store-checks.sh` all four scenarios passed, then `rights newer` again for the screenshots; results in `docs/platform-checks.md`.

**Approval and names, 2026-10-27 (not a review loopback).** The owner approved the plan with the recommended answers on 2026-10-26 ("approve 2 to 7, recommendations"); the four answers are in the frozen block as decisions and the Open Questions are gone. After story 1 merged (`ccr-3c8b84b9-f1vbsm`), the Code Map and Tasks use its real names: `MapStudioException` (no `EditRefusal`), `StoreGate` as the one check (so `writeRefusal` lives there, not in `StoreRegistry`), `Migrator.MigrationFailure` and `Migrations.statements` already exist (no `SqlScript`; the AD-21 line moves to `FailureLine`), story 1's migrator order kept, `FakeMapStore` and `store/FakeJdbc` extended, the e2e helpers of `e2e/tests/fixtures.mjs`. Contract decisions others need:
- `getMap(project)` still returns a list (story 1's callers iterate it); the list also has a `readOnly` attribute. Changing it to a dict would break story 1's contract.
- The write service checks the store state first (story 1's order), so on a read-only store every save is refused `read-only`, an anonymous viewer's too; the e2e read-only check draws as the anonymous viewer on the check project (no sign-in on a second project).
- The 42501 case: the first statement of migration 1's transaction is story 1's `CREATE TABLE IF NOT EXISTS mapstudio_schema_version`, so the line numbers statements as the transaction runs them (that create is statement 1, the file's statements follow, the version record is last); the lock and the version read are named but not numbered.
- `healed` replaces "migrated after a restart": with decision 1 the check proves the 60 s retry without a restart.
- Story 1's two code lists (`ContractTest`, `contract.test.ts`) gain `read-only`: decision 2 adds a code, and those assertions mirror the code list.

## Review Triage Log

## Design Notes

Error line, 42501: `Map Studio cannot prepare its map store on database connection MapStudioCheck: migration 1, statement 1 of 8 (CREATE TABLE IF NOT EXISTS mapstudio_schema_version ...) failed with SQLState 42501, the database role lacks CREATE on schema public: ERROR: permission denied for schema public`. The right is derived from the statement verb (`CREATE TABLE|INDEX` -> CREATE on the schema; `ALTER` -> ownership), else omitted. User reason (story 1's words kept, one sentence added): "The map store is unavailable: the database role of connection MapStudioCheck lacks the right to create Map Studio's tables. Ask an administrator (see the Gateway log)."

Read-only reasons: "The map store was upgraded by a newer Map Studio (schema 3, this module knows 1); saving is off until the module is upgraded." and "This Gateway is the standby of a redundant pair; saving is off here."

The check harness is always present (database, role, connection: harmless, `Valid`); only the project that names it is gated, so the plain stack logs no error.

## Verification

**Commands:**
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build` -- expected: green with the new tests (Jest included).
- `ops/store-checks.sh` -- expected: four scenarios pass as in Acceptance.
- `cd e2e && npm test` -- expected: all pass; `store-ops` skipped.
- `git grep -nP '\x{2014}'` -- expected: no match.

**Manual checks (hitl, the owner):**
- The four `mapstudio-store-*` screenshots and the scenario log excerpts in `docs/platform-checks.md`.
- `docs/operations.md` reads as an operator page; redundancy is marked unverified.
