---
title: 'Tracer: one edit saved through the write path and read back'
type: 'feature'
ticket: '1'
created: '2026-10-26'
status: 'built'
baseline_revision: 'a7fc0ba428c75bb96791653fe58e9c293b82c2c2'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md'
  - '{project-root}/docs/platform-checks.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Map Studio has no map store: the component draws fixed test data, a finished line goes nowhere, and entries 2 to 11 of the epic cannot start in parallel until the schema, message and op shapes, error codes, setup schema and change sequence exist and one edit has gone the whole way.

**Approach:** Bring PostgreSQL 16 back into `ops/` with a `MapStudio` connection fed by a File secret provider and a seeded `MapEditor` dev user; on the Gateway add a setup loader, a migration runner (migration 1 under an advisory lock, after a connection wait), one write service with the role check and edit record, a no-op change hook, `map.load` assembly, and `system.mapstudio.getMap` and `applyEdits`; the browser loads the map with `map.load` and saves the finished line with `edits.apply`. The shared contracts go into `common/` and a draft `docs/contract.md` marked 0.2.0 draft. The session-roles API is proved live before the role check is built on it.

## Boundaries & Constraints

**Always:**
- Roles come only from the Gateway's view of the session user; nothing the browser sends decides a level.
- One write service for the browser and the scripting API; every batch all or none in one transaction; every saved op recorded (project, batchId, seq, entity, id, op, new version, actor, source, UTC time); every committed batch takes the project's next `seq` and calls the change hook.
- Prepared statements only; no value formatted into SQL; PostgreSQL only; no spatial SQL; geometry stored as GeoJSON text rounded to 6 decimals.
- No password in git, in a Gateway log line or in a browser console line; generated secrets live in git-ignored files (0644 files in a 0700 folder where a container reads them).
- Each worktree its own containers and volumes through `MAPSTUDIO_CONTAINER` and `GATEWAY_HTTP_PORT`.
- Every SDK or Ignition behaviour not seen live is marked unverified in code comments and docs until seen.
- Logs through `MapStudio.<area>`; no map item properties in a log line; no em dashes anywhere.
- `map.load` and `edits.apply` replies never change the point-click reply text, and map store messages log to the browser console at info only (the popup specs count `[MapStudio]` warnings).

**Never:**
- Change `testSet`, `popupView`, the point-click round trip, or the existing e2e specs; touch `ign-scada-template`.
- Carry out a delete or any `kindSetup` op (refused `invalid`, "not supported in this version"), retried `batchId`s, the conflict reply's other record, the phone role matrix, kind-list validation, `map.changed` delivery, schema-newer or rights handling beyond the AD-21 error line, live setup change, the Designer setup editor, the unsaved-edit queue, or removal of `testSet` (entries 2 to 11).
- Flyway, Liquibase or any new Gateway-wide module setting.
- Keep `system.mapstudio.echo` (removed; `ping` stays as the health check).

**Decisions (owner, 2026-10-26, answers to the plan's Open Questions):**
- A project without a setup (or naming a missing connection) warns once per Gateway start, at its first `map.load` or `applyEdits`, not at project start.
- If SCIM cannot make the dev user on 8.3.10, the dev setup also lists `Administrator` as a full-editing role and the e2e editor signs in as `admin` (password read from `.env`).
- An update op's `data` replaces only the top-level fields it carries.
- In the Designer, `getMap` and `applyEdits` autocomplete and raise "runs in Gateway scope only" when called; no RPC in this story.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Editor saves a line | session user holds `MapEditor`; `edits.apply {batchId, ops:[create item, baseVersion 0]}` | `edits.apply.reply {batchId, seq, results:[{entity, id, version:1}]}`; one edit row; hook called once | none |
| Update at stored version | update op, `baseVersion` = stored | version 2 saved and recorded | none |
| Update at another version | update op, `baseVersion` != stored | nothing written | `conflict`, names the op (index, id) |
| Update of unknown id in a batch with a valid create | 2 ops | nothing written | `invalid`, names op 1 |
| Viewer saves | session with no editing role | nothing written; line shown as not saved | `role`, plain words |
| Delete or kindSetup op | any level | nothing written | `invalid`, "not supported in this version" |
| Script save | `applyEdits("mapstudio-dev", batch, "seed-script")` | same write service; edit row actor `seed-script`, source `script` | none |
| Script without actor, or project without setup | `applyEdits(p, batch, None)` / unknown project | nothing written | raises an error carrying code and reason |
| Project with no setup, or setup naming a missing connection | `map.load` | no tables; one warning naming the project (and the connection) | `store-unreachable` with that reason |
| Connection not usable at start | `Driver$1` window or PostgreSQL late | retry every 5 s up to 2 min, then migrate | after 2 min one error naming the connection; store `store-unreachable`, no half schema |
| Restart on a migrated database | schema version 1 recorded | nothing changes, no error logged | none |
| Malformed batch | missing batchId, bad UUID, bad GeoJSON, unknown op | nothing written | `invalid`, names the op |

</frozen-after-approval>

## Code Map

- `common/.../common/Messages.java` -- envelope constants, `INBOUND_TYPES`, `OUTBOUND_TYPES`, `CODE_INVALID`; extend, keep `point.click`.
- `common/.../common/MapStudioScriptModule.java` + `MapStudioScriptModule.properties` -- today a concrete class with `ping`, `echo`; becomes the abstract module (IA scripting example shape); docs bundle prefix stays `MapStudioScriptModule`.
- `common/.../common/MapStudioModule.java` -- `MODULE_ID`; add the setup `ResourceType`.
- `gateway/.../gateway/MapStudioGatewayHook.java` -- registers component, delegate (`MapStudioDelegate::new`) and script module; add the setup lifecycle factory, store services, executor, shutdown.
- `gateway/.../gateway/MapStudioDelegate.java` -- `handleEvent`, pure `reply(envelope)`, `envelope`, `error`; keep the pure-function shape and the "no exception escapes" rule.
- `designer/.../MapStudioDesignerHook.java` -- registers the script module for autocomplete (line 36).
- `web/typescript/MapStudio.tsx` -- `MapStudioStoreDelegate` (`lastReply`, `pendingId`, `handleEvent`), `onDrawFinish` (line ~318), sources `mapstudio-points`/`mapstudio-line` counted into `data-points-loaded`/`data-lines-loaded` (do not add store items to these), `.mapstudio-reply` with `data-line-points` and `.mapstudio-draw-status` (tracer.spec asserts "Line drawn with 2 points").
- `web/typescript/messages.ts` -- browser mirror of the contract; `readReply` returns `invalid` for unknown types.
- `ops/docker-compose.yml`, `ops/lib.sh`, `ops/up.sh`, `ops/down.sh` -- the dev stack; compose project follows `MAPSTUDIO_CONTAINER`; `.env` generation pattern for passwords.
- Reuse from commit `51104c8` (`git show 51104c8:<path>`): `ops/docker-compose.checks.yml` (postgres service, secrets, init copy into `core`, `pg_isready -h 127.0.0.1`), `ops/checks/config/core/config-mode.json`, `.../database-connection/MapStudio/{config,resource}.json` (8.3.10 defaults, Referenced secret, `attributes.uuid`), `.../secret-provider/MapStudioFiles/*`, `ops/checks/postgres-init.sh` (psql `-v` variables), `gateway/.../spike/ChecksLifecycleFactory.java` and `ChecksLifecycle.java` (factory over a `ResourceType`, `onStartup(List<Resource>)`, `resource.getData("setup.json")`), `PostgresCheck.java` (`DatasourceManager.getDatasource`, `SRConnection`, SQLState 42501 line `rightsMessage`), `SetupResource.java`.
- Reuse from `ign-scada-template`: `scripts/gw/make_api_key.py` (api-token resource with a SHA-256 `tokenHash`), `scripts/gw/render_users.py` (SCIM users and groups, password never printed), `tests/render/render_all.mjs` `signInAs` (two-step IdP form) - all [live 8.3.9 there], unverified on 8.3.10.
- SDK signatures read here [SDK 8.3.0 javap], not run: `Component.getSession()`, `Session.getProjectName()`, `Session.getWebAuthStatus()`, `WebAuthStatus.getUser(): Optional<WebAuthUser>`, `getSecurityLevels()`, `WebAuthUser.getUserName()`, `getRoles(): ImmutableCollection<String>`; `SRConnection extends java.sql.Connection`; `DatasourceManager.getDatasource(name)`, `addDatasourceListener`; `TypeUtilities.pyToGson(PyObject)`, `gsonToPy(JsonElement)`.
- `e2e/tests/fixtures.mjs` (`openMap`, `watch`, `nextFrames`), `e2e/lib/env.mjs` (`envFileValue` reads one named `.env` key), `e2e/tests/tracer.spec.mjs` (drawing at 1440 and 390 px) -- patterns to follow; existing specs unchanged.
- `ops/project/com.inductiveautomation.perspective/page-config/config.json` -- add a page; existing pages unchanged.
- `.github/workflows/ci.yml` -- e2e job runs `ops/up.sh --no-build`, so the whole stack, user included, must come up unattended there.

## Tasks & Acceptance

**Execution:**
- [x] `ops/docker-compose.yml`, `ops/lib.sh`, `ops/up.sh`, `ops/down.sh`, `ops/psql.sh` (new), `ops/users.py` (new), `ops/config/core/**` (new), `.gitignore`, `README.md` -- add `postgres:16-alpine` (container `${MAPSTUDIO_CONTAINER}-pg`, volume `postgres-data`, health check `pg_isready -h 127.0.0.1`, no host port, `POSTGRES_PASSWORD_FILE`); Gateway `depends_on` it healthy; `init` copies `ops/config/core` (with `config-mode.json`, `database-connection/MapStudio`, `secret-provider/MapStudioFiles`, each with `attributes.uuid`) plus the generated api-token resource into `core` on a fresh volume, then `chown`; `lib.sh` generates into git-ignored `ops/secrets/` (0700; `pg_password` 0644; `api-token` 0600; `core/ignition/api-token/dev/*`) and `MAPSTUDIO_EDITOR_PASSWORD` into `.env`, and refuses with a `--fresh` hint when `pg_password` is missing but the volume exists; `up.sh` runs `python3 -I ops/users.py` after RUNNING (SCIM: user `mapeditor` in `MapEditor`, empty group `MapOperator`; passwords sent from memory, never printed); `psql.sh` runs psql in the PostgreSQL container -- criterion 1, dev login.
- [x] Proof first (no role code built on it before this passes): on the dev Gateway log, at info once per session in `MapStudio.roles`, the user name and roles read through `getSession().getWebAuthStatus().getUser()` for the anonymous session and for `mapeditor`; record the result in `docs/platform-checks.md` as a new section "Epic 2 story 1 - session roles on the Gateway". Fallbacks in order: `getSecurityLevels()` paths `Authenticated/Roles/<role>`; the session's `auth.user.roles` property read on the Gateway. Remove the per-session info line after recording (keep debug).
- [x] `common/.../common/Messages.java`, `common/.../common/contract/*.java` (new: `EditOp`, `EditBatch`, `MapItemRecord`, `Setup` with parse and validate), `web/typescript/contract.ts` (new), `web/typescript/messages.ts` -- the shared contracts (Design Notes), `CONTRACT_VERSION = "0.2.0-draft"`, envelope `v` stays 1 -- criterion 8.
- [x] `ops/project/com.aoindustrial.perspective.mapstudio/setup/{resource.json,setup.json}` (new) and `gateway/.../setup/{SetupLifecycleFactory,SetupLifecycle,SetupRegistry}.java` (new) -- load setup per runnable project at start; registry keyed by project name -- criterion 2.
- [x] `gateway/src/main/resources/.../store/migrations/0001_first_schema.sql` (new), `gateway/.../store/{Migrator,ConnectionWait,StoreRegistry,MapStoreRepository}.java` (new) -- per connection: wait (5 s, up to 2 min), then one transaction: `pg_advisory_xact_lock(hashtext('mapstudio_migrations'))`, create `mapstudio_schema_version` if absent, apply pending migrations, record the version; on 42501 the AD-21 line (reuse `rightsMessage`); state `ready` or `unavailable(reason)` -- criteria 1, 3.
- [x] `gateway/.../write/{WriteService,RoleMatrix,ChangeHook,NoChangeHook,EditResult,EditRefusal}.java`, `gateway/.../load/MapLoader.java` (new) -- order: parse, unsupported ops, role, then one transaction (bump `mapstudio_project.seq` with `INSERT .. ON CONFLICT DO NOTHING` then `UPDATE .. RETURNING`, `SELECT .. FOR UPDATE` per item, version checks, writes, edit rows, batch row), commit, then hook; `MapLoader` returns level, seq, live items -- criteria 4 to 6.
- [x] `gateway/.../gateway/MapStudioDelegate.java`, `MapStudioGatewayHook.java` -- handle `map.load` and `edits.apply` with the project from `getSession().getProjectName()` and roles from the proved API; DB work on a bounded executor owned by the hook, reply with `fireEvent` from it (fireEvent off the event thread unverified; fallback synchronous in `handleEvent`) -- criteria 4, 5.
- [x] `common/.../MapStudioScriptModule.java` (abstract: `ping`, `getMap`, `applyEdits` calling protected impls), `gateway/.../script/GatewayScriptModule.java` (new), `designer/.../DesignerScriptModule.java` (new: `getMap`/`applyEdits` raise "runs in Gateway scope only"), both hooks, `.properties` (drop `echo`, add `getMap`, `applyEdits`) -- `batch` via `pyToGson`, result via `gsonToPy`; refusal raises `MapStudioException` with `code: message` -- criterion 7.
- [x] `web/typescript/MapStudio.tsx`, `web/typescript/save.ts` (new, pure) -- delegate sends `map.load` on mount; draws items in new sources `mapstudio-items-point`/`-line` (theme tokens only); sets `data-edit-level`, `data-items-loaded`; on line finish sends `edits.apply` (new UUID, `baseVersion` 0, kind `line`, name `Line <HH:mm:ss>`); status in a separate `.mapstudio-save-status` (`data-save-state` `saving|saved|refused`, text "Saved as version 1" or "Not saved: <message>"); saved line moves from Terra Draw to the items source; replies routed by id, never into `lastReply` -- criteria 4, 5.
- [x] `ops/project/com.inductiveautomation.perspective/views/MapStudioEdit/*` (new), `page-config/config.json` (add `/edit`) -- label with the session user, a Log in button (`system.perspective.login()`), the map, and a "Run script checks" button whose session script calls `getMap` and `applyEdits` (create point with UUIDv5, update at stored and stale version, delete, no actor, unknown project) and writes one JSON result into a label (Jython 2.7, catches Java and Python exceptions) -- criteria 4, 7, 8.
- [x] `e2e/tests/store.spec.mjs` (new), `e2e/tests/fixtures.mjs` (add `signIn`, reads `MAPSTUDIO_EDITOR_PASSWORD` only) -- editor: level `full`, draw, saved v1, reload, `data-items-loaded` grew by 1; viewer at `/`: level `none`, refused `role`, count unchanged after reload; script checks parsed and asserted; screenshots `mapstudio-store-editor-{1440,390}.png`, `mapstudio-store-viewer-{1440,390}.png` -- criterion 9.
- [x] Unit tests: `common/src/test/...` (contract parse and validate: every matrix row's input), `gateway/src/test/.../{SetupTest,MigratorTest,ConnectionWaitTest,RoleMatrixTest,WriteServiceTest,MapStudioDelegateTest}.java` (write service against an in-memory repository fake: all-or-none, seq, hook once per commit, edit rows), `web/typescript/__tests__/{contract,save}.test.ts`.
- [x] `docs/contract.md` (new, "0.2.0 (draft)": message types, error codes, op shape, map item record, `map.changed`, setup v1, first schema, scripting API with a Jython 2.7 example catching both exception kinds, the caller-trust note), `docs/architecture.md` (link), `docs/platform-checks.md` (the roles section; facts learned for user seeding and login).

**Acceptance Criteria:**
- Given a fresh clone, when `ops/up.sh --fresh` runs twice on fresh volumes and once on a kept volume, then each Gateway log shows the connection wait, schema version 1 created once (not on the kept run), and no Map Studio error; `grep -F` of every generated password over `docker compose logs` and `e2e/out` finds nothing.
- Given two worktrees with `MAPSTUDIO_CONTAINER` `ms-a` and `ms-b`, when both stacks run, then `docker ps` and `docker volume ls` show separate PostgreSQL containers and volumes.
- Given the stack, when `ops/psql.sh -c "select project, batch_id, seq, entity, entity_id, op, version, actor, source, at from mapstudio_edit order by id"` runs after the e2e suite, then it lists the editor's line, the script's point with actor `seed-script`, and no row from a refused batch.
- Given the dev project without its setup resource, when a session opens `/`, then the Gateway logs one warning naming `mapstudio-dev` and the map reports `store-unreachable` (checked once by hand and recorded in Implementation Notes).

## Implementation Notes

Implemented directly in the planning session (no implementation subagent was available), 2026-10-26, on the `ms-e2s1` dev Gateway (port 9121, `inductiveautomation/ignition:8.3.10`, `postgres:16-alpine`).

- **Session roles, proved first** (before any role code; recorded in `docs/platform-checks.md`, "Epic 2 story 1 - session roles on the Gateway"): `component.getSession().getWebAuthStatus().getUser().getRoles()` gave `[MapEditor]` for `mapeditor` and no user for the anonymous session **[live 8.3.10]**. No fallback needed. The delegate reads them on every message.
- **Dev stack facts found on the way** (all recorded in the same section): an API key resource cannot carry `Authenticated/Roles/<role>` (8.3.10 ignores it with a warning and answers 403), so the dev key carries `Authenticated/ApiKeys/MapStudioDev` and `ops/up.sh` patches the Gateway's own `security-properties` after the first RUNNING (commissioning rewrites a seeded copy), then restarts once; the template's `.../find/ignition/identity-provider/<name>` route answers 404 on 8.3.10, so `ops/users.py` uses `.../list/...`; the dev project needed an identity provider for `system.perspective.login()` ("No Identity Provider Configured" otherwise), set once with `PUT /data/api/v1/projects/mapstudio-dev {"identityProvider": "default"}` and committed as the Gateway-written `ops/project/ignition/global-props/` (binary, not hand-edited). One fresh volume got the identity provider `temp` instead of `default` (as the template's GW-1 saw); the later fresh runs got `default`. The SCIM route worked on 8.3.10, so the owner's fallback (Administrator as a full-editing role) was not needed.
- **Pre-existing bug fixed:** `ops/lib.sh` set `CONTAINER_NAME` before reading `.env`, so with `MAPSTUDIO_CONTAINER` only in `.env` it named the default container `mapstudio-ignition`. It is now set after `.env`; the new security step uses `docker compose exec`/`cp` on the `gateway` service, never a container name. (One `docker cp` attempt hit the stopped `mapstudio-ignition` container of another checkout before the fix and failed with "is not running"; nothing was changed there.)
- **Runs and results:**
  - `./gradlew build --warning-mode all`: green; common 8 tests, gateway 40 tests (delegate 7, map loader 3, connection wait 2, migrations 3, migrator 4, store registry 4, role matrix 2, write service 15), Jest 42 (7 suites). Only the two known `io.ia.sdk.modl` plugin warnings.
  - `npm test` in `e2e/` (Playwright 1.63.0, Chromium at `PW_CHROMIUM_PATH`): 15 of 15 on a kept volume, and 15 of 15 again on a second fresh volume; the 10 existing tests unchanged and passing.
  - `ops/up.sh --fresh` three times (one before the module code, two with it) and kept-volume restarts: each fresh Gateway log has exactly one "created its map store schema ... applied version(s) [1]" and each later start "is at schema version 1"; no Map Studio warning or error on those starts.
  - Connection wait, live: PostgreSQL stopped, Gateway restarted, PostgreSQL started 55 s later: one info line "waiting for database connection MapStudio ... every 5 s for up to 2 minutes", then "at schema version 1" 60 s after. With PostgreSQL left stopped: after 2 minutes one error line "could not use database connection MapStudio within 2 minutes (25 attempts; last: ... FAULTED ...)", and `map.load` answered `store-unreachable` with that reason.
  - Missing setup, live (setup folder moved aside, Gateway restarted, `/` opened twice): `map.load` answered `store-unreachable` "Project mapstudio-dev has no Map Studio setup ..." both times and the Gateway logged one warning. Setup naming `NoSuchConnection`: `store-unreachable` naming both, one warning. Setup restored.
  - `system.mapstudio` from a Perspective session script (the `/edit` page's "Run script checks"): create at version 1 (actor `seed-script`), `getMap` shows it, update at the stored version saves version 2, the stale update raises `conflict: ...`, delete raises `invalid: ... not supported in this version`, no actor and an unknown project raise their reasons, all caught in Jython with `except java.lang.Throwable`.
  - `psql` listing of `mapstudio_edit` after the suite: rows for `mapeditor` (source `session`) and `seed-script` (source `script`), one `seq` per batch, versions 1 then 2 for the script's point, no row from a refused batch.
  - No generated secret (admin and editor passwords, PostgreSQL password, API key) in `docker logs` of either container, in `e2e/out`, or in any git-tracked file (a scratch script counted occurrences without printing them).
- **Screenshots** (`e2e/out/screenshots/`, `npm run docs` writes them to `docs/screenshots/`): `mapstudio-store-editor-{1440,390}.png` (saved, "Saved as version 1"), `mapstudio-store-editor-reload-{1440,390}.png` (drawn from `map.load` after a reload), `mapstudio-store-viewer-{1440,390}.png` ("Not saved: You do not have a role ...").
- **Not run:** two worktrees' stacks at once (the separation is by compose project name: this worktree's volumes are `ms-e2s1_gateway-data` and `ms-e2s1_postgres-data`, container `ms-e2s1-pg`, beside other projects' `ms-s3_postgres-data` and `ops_postgres-data`); the Designer autocomplete of `getMap` and `applyEdits` (owner, optional); a CONNECT-only database role on the live Gateway (unit tested; entry 5 owns rights).
- **After the review fixes** (session restarted once by a container restart; work resumed from the uncommitted tree): `./gradlew build` green (Java 51 tests: common 8, gateway 43; Jest 42); `python3 -I ops/tests/test_users.py` 6 tests; `npm run test:unit` in `e2e/` 11 tests; full e2e 16 of 16 on the kept `ms-e2s1` volume (Gateway connected as the least-privilege `mapstudio_rt`) and 16 of 16 on a fresh volume (owner role), each run ending with the teardown's "no file holds the map editor's password"; the fresh log has one schema creation and no Map Studio warning or error; no generated secret in either container's log, `e2e/out` or tracked files. A sign-in saved once in the global setup had been signed out by the time the full suite reached the editor tests (3 failures in the first full run; cause not established), so each editor test now signs in afresh.
- **Known look:** the refused line stays on the map as Terra Draw drew it, the same as a saved line, and the e2e lines of repeated runs overlap at the same place; "not saved" is said in words only. Distinguishing an unsaved line on the map is entry 8's (the unsaved-edit queue).

## Plan Change Log

**Implementation deviations and contract decisions, 2026-10-26 (not a review loopback).** Parallel planners of entries 2 to 7 read these:

- *Refusal type:* one `MapStudioException` in `common/.../common/contract/` (code, plain message, optional op index and id; `toErrorBody()`) replaces the planned gateway `EditRefusal`; the scripting API raises the same exception, message `"<code>: <message>"`.
- *Error body:* `{code, message}` plus `batchId` (edits.apply) and `op: {index, id}` when an op is at fault, as planned.
- *Reply type names:* `map.load.reply`, `edits.apply.reply` (the spike's `.reply` convention).
- *Contract version constant:* `Messages.CONTRACT_VERSION = "0.2.0-draft"`; envelope `v` stays 1.
- *Classes and packages (gateway):* `setup/{SetupRegistry, SetupLifecycle, SetupLifecycleFactory}`; `store/{MapStore (interface, Tx, EditRow), JdbcMapStore, Migrations, Migrator, ConnectionWait, ConnectionSource, DatasourceConnections, StoreRegistry, StoreState, StoreGate}`; `write/{WriteService, RoleMatrix, Actor, ChangeHook, NoChangeHook, EditResult}`; `load/MapLoader`; `script/GatewayScriptModule`; `MapStudioServices` wires them. `StoreGate` (new) is the one "setup present and store ready" check used by the write service and the loader. Common: `contract/{EditOp, EditBatch, MapItemRecord, Setup, MapStudioException}`; `MapStudioScriptModule` is now abstract (`getMapImpl`, `applyEditsImpl`); designer `DesignerScriptModule`.
- *Change hook signature (coordinator's request for entry 4):* `void onCommitted(ChangeHook.CommittedBatch batch)` with `CommittedBatch(String project, long seq, String batchId, Actor actor, List<CommittedOp> ops)` and `CommittedOp(String op, String entity, String id, MapItemRecord record)`, the full stored record after the op; called after commit, outside the transaction; an exception from it is logged and does not undo the batch.
- *Test fake:* `gateway/src/test/.../write/FakeMapStore.java` (public; copy-on-commit, `failNextWrite`, duplicate batch rows as SQLState 23505) for entries 2 and 5 to extend; `gateway/src/test/.../store/FakeJdbc.java` scripts a JDBC connection for the migrator.
- *Schema:* as in Design Notes; `mapstudio_schema_version` is created by the migrator (with `CREATE TABLE IF NOT EXISTS` inside the lock) rather than in `0001_first_schema.sql`, in the same transaction as migration 1; it also records `module_version` (the jar's implementation version, `dev` in a dev build). Times are the database's `now()` (one per transaction), not passed from Java.
- *Validation details fixed here:* map item ids are UUID strings (36 characters); geometry is `Point` or `LineString` only, positions in range, rounded half up to 6 decimals; an update needs at least one field; create `kind` and `geometry` required, unknown data fields refused; at most 1000 ops per batch; a `batchId` already saved is refused `invalid` until entry 2 returns the first result.
- *Ordering in the write service:* store ready, then batch shape, then unsupported ops, then role, then actor; so a viewer's malformed batch answers `invalid`, and a viewer's well-formed batch `role`.
- *Missing connection:* not waited for (the Gateway installs its connections before projects start, seen in the logs); checked again on every use, so a connection added later starts its wait then.
- *Dev stack:* `ops/config/core` seeds `config-mode.json`, the `MapStudio` connection and the `MapStudioFiles` provider; the API key resource is generated into `ops/secrets/core` and copied on every start; the editor password is `MAPSTUDIO_EDITOR_PASSWORD` in `.env`; `ops/dev_security.py`, `ops/gen_secrets.py`, `ops/users.py`, `ops/psql.sh` are new; `ops/project/ignition/global-props/` is committed (Gateway-written).
- *e2e:* the editor test runs on `/edit` (signed in), the viewer test on `/`; the save state is `.mapstudio-save-status` with `data-save-state`, `data-item-id`, `data-version`, `data-code`; the map container carries `data-edit-level`, `data-load-state` and `data-items-loaded` (the count the component put into the items sources).

**Review fixes, 2026-10-26 (Quick lens pass 1, all patches; not a loopback).** Changes later entries should know:

- *Busy answer:* a full or stopping work pool answers `store-unreachable` with "Map Studio is busy ..." (`MapStudioDelegate.busyReply`); no `busy` code was added to 0.2.0.
- *Migrator:* reads the version first (`Migrator.VERSION_TABLE_EXISTS`, then `READ_VERSION`) with no lock and no DDL; lock, `CREATE TABLE IF NOT EXISTS mapstudio_schema_version` and migrations only when one is pending. A later migration must keep that order. A runtime role needs no CREATE once the schema exists.
- *Work pool:* `MapStudioServices.newWorkPool(threads, queue, factory)`, 4 threads, queue 64.
- *e2e:* `signInAsEditor` is gone; editor tests use `editorTest` from `tests/fixtures.mjs` (a fresh sign-in in a separate process, then `storageState`). The global teardown scans `e2e/out` for the password (`e2e/lib/secretScan.mjs`).
- *Dev stack:* every checkout has its own compose project (`MAPSTUDIO_CONTAINER`, derived and written to `.env` when unset); `ops/users.py` ensures the identity provider `default`; `ops/tests/test_users.py` runs in CI.

## Review Triage Log

Pass 1 (lens: quick, context-free, run by the coordinator on commits a7fc0ba..6d99a58, 2026-10-26; the findings came verified by the reviewer and were checked again here against the code): high 1, medium 5, low 1, false 0, maybe-false 0. All seven patched in this session; none rejected or deferred; no loopback (each fix is local and the plan's intent and contracts stand).

| # | Finding | Verdict | Route | Evidence and action |
|---|---|---|---|---|
| 1 | `/edit` "Run script checks" let any session, anonymous included, write through `applyEdits` as full editing under `seed-script` | high | patch | Real: the button's session script called `applyEdits` unconditionally, and the scripting API trusts its caller by design. Patched: the script reads `self.session.props.auth.user.roles` (set by the Gateway at sign-in) and writes nothing unless the user holds `MapEditor`; the e2e scripting test now runs signed in, and a new test clicks the button as the anonymous viewer and sees the refusal with the map store count unchanged. `docs/contract.md` says the dev view does this. |
| 2 | The migrator ran `CREATE TABLE IF NOT EXISTS mapstudio_schema_version` on every start, so a least-privilege role (no CREATE) on a migrated database got 42501 and the store went unavailable | medium | patch | Real: `beginAndReadVersion` ran the CREATE before reading. Patched: `Migrator.migrate` first reads `to_regclass(...)` and `max(version)` with no lock and no DDL and returns when current; lock and CREATE only when a migration is pending. Unit tests `aMigratedDatabaseIsOnlyRead` and `aRoleWithoutCreateComesUpOnAMigratedDatabase`; live check with a `mapstudio_rt` role (SELECT, INSERT, UPDATE, sequence USAGE; no CREATE): available, and `store.spec.mjs` 6 of 6 on it. Recorded in `docs/platform-checks.md`. |
| 3 | `MapStudioServices` work pool was `newFixedThreadPool` with an unbounded queue | medium | patch | Real: `LinkedBlockingQueue` without bound. Patched: `ThreadPoolExecutor` with 4 threads, an `ArrayBlockingQueue` of 64 and the abort policy; the delegate answers a rejected `map.load`/`edits.apply` at once with `store-unreachable` "Map Studio is busy with other map requests; nothing was saved. Try again in a moment." (no new code in 0.2.0; recorded in `docs/contract.md`). `WorkPoolTest` covers the refusal and the reply. |
| 4 | Playwright traces recorded the editor password from `fill()`, and CI uploads `e2e/out` | medium | patch | Real: the sign-in ran inside the test with `trace: 'retain-on-failure'`. Patched: a separate node process (`e2e/lib/signInCli.mjs`, plain Playwright browser, no tracing) signs in right before each editor test and saves the browser state the test starts from; the global teardown deletes the state file (system temp, not `e2e/out`) and scans `e2e/out` with trace zips unzipped, deleting any file holding the password and failing the run. Proved with a throwaway traced `fill()`: caught, deleted, exit 1. CI comment updated. |
| 5 | With `MAPSTUDIO_CONTAINER` unset every checkout shared compose project `ops`, so one checkout's `--fresh`/`--purge` removed another's Gateway and PostgreSQL | medium | patch | Real (compose's default project is the folder name). Patched: `ops/lib.sh` derives `ms-<sha256 of the checkout path, 8 hex>` when unset, records it in `.env` on first run, always passes `-p`; `ensure_secrets` checks only `${MAPSTUDIO_CONTAINER}_postgres-data`; compose requires the variable. Checked in a scratch checkout: the same name on two runs, written once. README says so, with how to remove old `ops` leftovers. |
| 6 | `ops/gen_secrets.py` docstring named a seeded security-properties | low | patch | Real: stale since the after-commissioning copy was replaced. Patched to describe `ensure_dev_security` and `ops/dev_security.py`. |
| 7 | `global-props/data.bin` pins identity provider `default`, but a fresh volume once named it `temp` | medium | patch | Real: on such a volume the dev project's sign-in would have no provider. Patched: `ops/users.py` makes sure `default` exists, copying the system identity provider (internal only) under that name, and creates the editor in `default`'s user source. Unit tested (`ops/tests/test_users.py`, also in CI); a fresh volume ran it (the provider was `default` again, so the copy path is unit tested only, marked unverified in `docs/platform-checks.md`). Also corrected there: the template's `find` route answered 404 because no provider of that name existed, not because the route is missing. |

## Design Notes

**Schema, migration 1** (`0001_first_schema.sql`; every table keyed by `project text`):
- `mapstudio_schema_version (version int PK, applied_at timestamptz NOT NULL DEFAULT now(), module_version text NOT NULL)`
- `mapstudio_project (project text PK, seq bigint NOT NULL DEFAULT 0)` - the per-project change sequence; its row lock serialises a project's batches.
- `mapstudio_item (project, id uuid, kind text NOT NULL, name text NOT NULL DEFAULT '', geometry text NOT NULL, properties jsonb NOT NULL DEFAULT '{}', asset_id text, overrides jsonb NOT NULL DEFAULT '{}', ends jsonb, version int NOT NULL CHECK (version >= 1), deleted boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL, PK (project, id))`
- `mapstudio_kind_setup (project, kind_id text, setup jsonb NOT NULL, version int NOT NULL, deleted boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL, PK (project, kind_id))`
- `mapstudio_edit (edit_id bigserial PK, project, batch_id uuid NOT NULL, seq bigint NOT NULL, entity text CHECK (entity IN ('item','kindSetup')), entity_id text NOT NULL, op text CHECK (op IN ('create','update','delete')), version int NOT NULL, actor text NOT NULL, source text CHECK (source IN ('session','script')), at timestamptz NOT NULL DEFAULT now())`, index `(project, seq)`.
- `mapstudio_batch (project, batch_id uuid, seq bigint NOT NULL, actor text NOT NULL, result jsonb NOT NULL, committed_at timestamptz NOT NULL, PK (project, batch_id))` - written now, read by entry 2 for retries.

**Contracts (0.2.0 draft).** Envelope `{v:1, type, id, body}`. `map.load {}` -> `map.load.reply {level: none|phone|full, seq, items: [MapItemRecord]}`. `edits.apply {batchId, ops:[{op, entity, id, baseVersion, data}]}` -> `edits.apply.reply {batchId, seq, results:[{entity, id, version}]}`. `map.changed {seq, ops}` declared, not sent. Error `{code, message, batchId?, op?: {index, id}}`; codes `conflict`, `role`, `invalid`, `stale`, `store-unreachable`. `MapItemRecord {id, kind, name, geometry, properties, assetId, overrides, ends, version, deleted}`. Create `data` is the record's fields minus `id`, `version`, `deleted`; update `data` replaces only the top-level fields it carries. Setup v1 (`setup.json`):

```json
{"schemaVersion": 1, "connection": "MapStudio",
 "roles": {"full": ["MapEditor"], "phone": ["MapOperator"]},
 "kindsFunction": "", "assetsFunction": "", "refreshIntervalSeconds": 10,
 "alarmPage": "", "basemaps": ["none", "osm"], "tokenSecret": ""}
```

**Levels.** `full` if the user holds a `roles.full` role, else `phone` if a `roles.phone` role, else `none`. In this story only `full` may save; `phone` is reported by `map.load` and refused `role` on save (entry 2 adds its matrix). Scripts run as `full` under their actor (owner decision 2026-10-26).

**Units for parallel entries.** Setup loader, migrator, write service, change hook and `MapLoader` are separate classes in separate packages, so entries 2 to 7 edit different files.

## Verification

**Commands:**
- `./gradlew build` -- expected: green, the new common, gateway and Jest tests included.
- `ops/up.sh --fresh` then `ops/logs.sh -n 400 | grep MapStudio` -- expected: wait lines, "schema version 1 created on connection MapStudio", no error.
- `cd e2e && npm test` -- expected: all pass, the existing ten unchanged.
- `ops/psql.sh -c "select ... from mapstudio_edit order by edit_id"` -- expected: as in Acceptance.
- `git grep -nP '\x{2014}'` (em dash) and a `git grep -F` of each generated password -- expected: no match.

**Manual checks (hitl, the owner):**
- The four `mapstudio-store-*` screenshots: the editor's saved line drawn after reload with "Saved as version 1"; the viewer's line shown as not saved with the role message; readable at 390 px.
- The `psql` listing: who (`mapeditor`, `seed-script`), when (UTC), versions 1 then 2, one `seq` per batch, nothing from refused batches.
- The new "session roles" section of `docs/platform-checks.md` and the Gateway log excerpt of the fresh and kept starts.
- Optional: Designer Script Console shows `getMap`, `applyEdits`, `ping` and no `echo`.
