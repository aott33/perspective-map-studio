---
title: 'Map store operations: rights, failed and newer schemas, redundancy'
type: 'feature'
ticket: '5'
created: '2026-10-26'
status: 'draft'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'medium'
review: ''
review_source: ''
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

</frozen-after-approval>

## Code Map

Story 1 files this story extends (paths under `gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/` unless shown):
- `store/Migrator.java` -- run each migration through `SqlScript`, catch per statement, rollback, `MigrationFailure` line; newer-version check before applying.
- `store/StoreRegistry.java` -- the state story 1 defines gains `READ_ONLY(reason)`; exposes `writeRefusal(connection)` combining state and `RedundancyGate`.
- `write/WriteService.java` -- one change: where story 1 refuses `store-unreachable`, call `writeRefusal` (also yields `read-only`).
- `load/MapLoader.java` -- add `readOnly` (reason or null) to the reply and to `getMap`'s result.
- `MapStudioGatewayHook.java` -- build `RedundancyGate` from `getRedundancyManager()`, add and remove its listener.
- `common/.../common/Messages.java`, the `map.load` reply type in `common/.../common/contract/`, `web/typescript/contract.ts`, `messages.ts` -- code `read-only`, field `readOnly`.
- `web/typescript/MapStudio.tsx` -- `data-store-state` (`ready|read-only|unavailable`) from the `map.load` reply or error; save status reuses "Not saved: <message>".
- `ops/docker-compose.yml` (postgres: mount `ops/postgres-init/`), `ops/lib.sh` (`MAPSTUDIO_STORE_CHECKS=1` adds the overlay, as the spike's `MAPSTUDIO_CHECKS` did at `51104c8`).
- `docs/contract.md`, `docs/architecture.md` (Operations links `docs/operations.md`), `docs/platform-checks.md`.

Reuse: `rightsMessage` from story 1 (itself from `51104c8` `PostgresCheck.java`); `ops/psql.sh`; e2e `signIn`.

## Tasks & Acceptance

**Execution:**
- [ ] `gateway/.../store/SqlScript.java`, `store/MigrationFailure.java` (new, pure) -- split a migration on `;` at line end (comment in `migrations/` forbids `;` inside a statement); build the AD-21 line and the user reason.
- [ ] `store/Migrator.java`, `store/StoreRegistry.java` -- as Code Map; newer version check reads `max(version)` before the lock work.
- [ ] `gateway/.../redundancy/RedundancyGate.java` (new: `ActiveNode` interface, adapter over `RedundancyManager`, `!isRedundancyEnabled() || isActive()`, info line once per state change), `MapStudioGatewayHook.java`.
- [ ] `write/WriteService.java`, `load/MapLoader.java`, contract files, `MapStudio.tsx` -- as Code Map.
- [ ] Tests (new files only): `gateway/src/test/.../store/{SqlScriptTest,MigrationFailureTest,MigratorFailureTest}.java` (fake JDBC: failing statement N rolls back, no commit, later statements not run, one line, state `unavailable`; newer version: no statement run, `READ_ONLY`), `redundancy/RedundancyGateTest.java`, `write/WriteServiceStoreStateTest.java` (read-only and standby: nothing written, no hook), `web/typescript/__tests__/storeState.test.ts`.
- [ ] `ops/postgres-init/20-store-checks.sh` (new: database `mapstudio_check`, role `mapstudio_check` with CONNECT only, password from the existing `pg_password` secret via `psql -v`), `ops/config/core/ignition/database-connection/MapStudioCheck/{config,resource}.json` (new, beside story 1's `MapStudio`), `ops/docker-compose.store-checks.yml` (new: mounts `ops/store-checks/project` as `mapstudio-check`), `ops/store-checks/project/**` (new: setup naming `MapStudioCheck`, one map view, page `/`).
- [ ] `ops/store-checks.sh` (new) -- per scenario: set the check database with psql, restart the Gateway, wait, grep the log, run the spec: `rights` (no grant), `partial` (grant CREATE; superuser pre-creates `mapstudio_kind_setup`), `migrated` (blocker dropped), `newer` (insert version 999); restores `rights` at the end.
- [ ] `e2e/tests/store-ops.spec.mjs` (new; skipped unless `MAPSTUDIO_STORE_SCENARIO` is set) -- `unavailable`: state and message; `read-only`: editor's line refused `read-only`, item count unchanged after reload; screenshots `mapstudio-store-{unavailable,readonly}-{1440,390}.png`.
- [ ] `docs/operations.md` (new) -- backups (site PostgreSQL backups, `pg_dump -t 'mapstudio_*'` example, export later), rights (first start and upgrades need CREATE; the error line; recovery), schema versions and downgrade, redundancy (unverified marks), screenshots; `docs/contract.md`, `docs/architecture.md`, `docs/platform-checks.md` section "Epic 2 story 5 - map store states" (live results, independent-node gate).

**Acceptance Criteria:**
- Given `ops/store-checks.sh` on a fresh stack, when scenario `rights` runs, then the Gateway log has exactly one Map Studio error line naming `MapStudioCheck`, statement 1, SQLState 42501, and the spec sees `unavailable`.
- Given scenario `partial`, then the log names migration 1's `mapstudio_kind_setup` statement and its SQLState, and `pg_tables` in `mapstudio_check` lists only the pre-created table.
- Given scenario `newer`, then the log has one warning naming both versions and the spec sees `read-only` with the save refused; `mapstudio_edit` in `mapstudio_check` gains no row.
- Given the plain dev stack (no overlay), when story 1's checks run, then they still pass and no Map Studio error is logged.

## Implementation Notes

Starts after story 1 is merged; set `baseline_revision` then. No migration (frees the slot for another group A story).

## Plan Change Log

## Review Triage Log

## Design Notes

Error line, 42501: `Map Studio cannot prepare its map store on connection MapStudioCheck: migration 1, statement 1 (CREATE TABLE IF NOT EXISTS mapstudio_schema_version) failed with SQLState 42501, the database role lacks CREATE on schema public: ERROR: permission denied for schema public`. The right is derived from the statement verb (`CREATE TABLE|INDEX` -> CREATE on the schema; `ALTER` -> ownership), else omitted. User reason: "The map store is unavailable: the database role cannot create Map Studio's tables. Ask an administrator (see the Gateway log)."

Read-only reasons: "The map store was upgraded by a newer Map Studio (schema 3, this module knows 1); saving is off until the module is upgraded." and "This Gateway is the standby of a redundant pair; saving is off here."

The check harness is always present (database, role, connection: harmless, `Valid`); only the project that names it is gated, so the plain stack logs no error.

## Verification

**Commands:**
- `./gradlew build` -- expected: green with the new tests.
- `MAPSTUDIO_STORE_CHECKS=1 ops/store-checks.sh` -- expected: four scenarios pass as in Acceptance.
- `cd e2e && npm test` -- expected: all pass; `store-ops` skipped.
- `git grep -nP '\x{2014}'` -- expected: no match.

**Manual checks (hitl, the owner):**
- The four `mapstudio-store-*` screenshots and the scenario log excerpts in `docs/platform-checks.md`.
- `docs/operations.md` reads as an operator page; redundancy is marked unverified.

## Open Questions

1. **Recovery from `unavailable`.** (a) Recommended: re-run the migrator lazily on `map.load` or `applyEdits`, at most once per 60 s, logging the error line again only when the reason changes, so fixing the grant heals without a restart. (b) Only at Gateway or module restart (and story 6's setup change): simplest, but an operator must restart after fixing rights. (c) A 60 s timer while unavailable: heals with no map open, one more background task.
2. **Error code for read only.** (a) Recommended: one new code `read-only` for both newer schema and standby, distinct messages; additive to the 0.2.0 draft. (b) Two codes, `read-only` and `standby`: the browser can tell them apart, one more code to keep stable. (c) Reuse `store-unreachable`: no contract change, but the browser cannot tell a readable map from a missing one.
3. **Migrations on a standby.** (a) Recommended: only an independent or active node migrates; a standby reads the version only and runs the migrator on becoming active. (b) Both nodes migrate under the advisory lock: simpler, but a standby with a different module build could upgrade the schema under the active node.
4. **Where the store checks run.** (a) Recommended: by hand (`ops/store-checks.sh`, about five Gateway restarts), results recorded in `docs/platform-checks.md`. (b) Also a CI job: catches regressions, adds about 5 minutes per run.
