---
title: 'Gateway platform checks'
type: 'feature'
ticket: '3'
created: '2026-10-26'
status: 'built'
baseline_revision: 'dcb0479821a7517574e0743cc843370211af1859'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** AD-5, AD-6, AD-18 and AD-21 rest on five SDK claims nobody has seen work on an 8.3 Gateway; a wrong one changes the design of three epics, so the spike must answer each with evidence before the go or no-go (story 9).

**Approach:** Add a spike package to the module's Gateway scope that runs five checks against the dev Gateway when a project holds a `setup` resource, logging one `CHECK <name> PASS|FAIL <evidence>` line each; a second compose file adds PostgreSQL and bind-mounted config to the ops Gateway, and `ops/checks.sh` runs it end to end and collects the log into a dated record in `docs/`.

## Boundaries & Constraints

**Always:** Java 17, SDK 8.3.0 jars; story 1's build, ops scripts and module ids untouched in behaviour; dev Gateway `MAPSTUDIO_CONTAINER=ms-s3`, `GATEWAY_HTTP_PORT=9103` in the git-ignored `.env`; every password generated into `.env` or a git-ignored secret file and reaching the Gateway only through a File secret provider (Referenced secret) and PostgreSQL through `POSTGRES_PASSWORD_FILE`; the Gateway's default connection settings (pool 0/8/8/0, `SELECT 1`, test on borrow) left as they are; loggers `MapStudio.check.<name>`; each recorded answer carries its evidence and label `[live 8.3.10]` and, where a check fails, the fallback taken; no em dashes; the claude-ignition-skills repository is not edited in this story (its entry is drafted in the record for the owner to land).

**Decisions (owner, 2026-10-26):** the setup resource is read on the Gateway only; the Designer editor's cost is estimated from IA's example and the decision deferred to epic-map-store-and-data. The record is one shared file `docs/platform-checks.md`, section "Story 3 - Gateway platform checks" (stories 2 and 4 add their own sections; keep to this one), holding the drafted `Finding | Where it went` table that targets a new `ignition-dev/references/module-sdk.md` for story 9 to land. The plan is kept whole despite its length.

**Never:** a Designer resource editor or workspace; writes to tags, devices or UDT instances; reading Alarm Metrics with `system.tag.read*`; passwords, API keys or tokens in any committed file; changes to `MapStudioDelegate`, `web/`, `common/` schemas or the `MapStudioDev` view; a `.modl` or JDBC driver in git (8.3.10 ships `PostgreSQL JDBC Driver Module.modl`); production code paths: the spike package is removed by the refactor sweep (story 8).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Alarm Metrics on a folder and a UDT instance | `subscribeAsync` on `[default]Checks/Alarm Metrics.HasActive` and `[default]Checks/Pump1/Alarm Metrics.HasActive`; the UDT's alarm toggles every 30 s from an expression | Two `TagChangeEvent`s per path within 90 s, Good quality, values true then false; `readAsync` of the same paths logged for the record (expected not Good: "direct reads are not supported") | Bad quality or no event in 90 s logs FAIL with the quality; fallback recorded: a Reference tag per metric |
| Project script function | setup names `mapstudio_checks.kinds`; module gets the project `ScriptManager` and runs it | Returns the list the script builds; the script also calls `system.mapstudio.ping()`, so one PASS line proves checks 2 and 3 | `JythonExecException` or a missing module logs FAIL with the Python error; fallback recorded: a named query |
| `system.mapstudio` registration | `initializeScriptManager` adds `system.mapstudio` with `ping()` and a `PropertiesFileDocProvider` | `ping()` returns the module version; Designer autocomplete shows the doc (manual check) | A missing attribute logs FAIL |
| Custom project resource | `ops/project/com.aoindustrial.perspective.mapstudio/setup/{setup.json,resource.json}` read by a `ResourceCollectionLifecycleFactory` | Lifecycle `onStartup` receives the resource; parsed fields logged; editing the file and `POST /scan/projects` fires `onResourcesModified` | A project without the resource runs no check |
| PostgreSQL, owner role | connection `MapStudio`, user `mapstudio` | Connect, `CREATE TABLE IF NOT EXISTS mapstudio_schema_version (version integer not null)`, insert 1, read back; PASS with the server version | `SQLException` logs FAIL with SQLState |
| PostgreSQL, missing rights | connection `MapStudioNoRights`, user `mapstudio_ro` with CONNECT only (PostgreSQL 16 gives no CREATE on `public`) | Connection `Valid` (`SELECT 1` passes); the CREATE fails; one error line names the connection, the statement kind and SQLState `42501`; no stack trace at error level | Any other SQLState logs FAIL |

</frozen-after-approval>

## Code Map

Reference repos (read only) at `/tmp/claude-0/-home-user/d8fcc768-17a3-54cb-a35d-639787b0aa6c/scratchpad/refs/`: `iaex/project-resource` (lifecycle factory, resource record, `Resource.getData(key)`), `iaex/scripting-function` (`addScriptModule`, `@JythonElement`, `.properties` doc bundle via `BundleUtil`), `mustry/gateway/.../MustryPerspectiveComponentsGatewayHook.java` lines 30 to 50 (`system.mustry`). The 8.3.10 Gateway jar for `javap`: `scratchpad/gwjar/gateway-8.3.10.jar`.

SDK facts read from the cached 8.3.0 jars with `javap` (gateway-api, common):
- `GatewayContext`: `getTagManager()` (a `TagManager`: `subscribeAsync(TagPath, TagChangeListener)`, `readAsync(List<TagPath>)`), `getProjectManager()`, `getDatasourceManager()`, `getSecretProviderManager()`.
- `TagPathParser.parse("[default]Checks/Alarm Metrics.HasActive")`; `TagChangeEvent.getValue()` is a `QualifiedValue`, `isInitial()`. 8.3.10's `AlarmMetricsNode` names the node `Alarm Metrics` (alias `_Alarm Metrics`); IA's property list: `HasActive`, `ActiveCount<Pri>`, `HighestActivePriority`, ... (case-insensitive in practice).
- `ProjectManager.getProjectScriptManager(String)` returns `ScriptManager`: `runFunction(PyObject, PyObject...)`, `runCode(String, PyObject locals, String name)`, `createLocalsMap()`, `getGlobals()`. Project script modules are the `ScriptLibrary.RESOURCE_TYPE` resources (`ignition/script-python/<name>/code.py`).
- `GatewayModuleHook.initializeScriptManager(ScriptManager)`: `addScriptModule(String, Object, ScriptFunctionDocProvider)`; `PropertiesFileDocProvider` reads `<Class>.properties` keys `fn.desc`, `fn.returns`.
- `ResourceType(moduleId, typeId)` record in `common.resourcecollection`; `ResourceCollectionLifecycleFactory<T>(context.getProjectManager())` with `getResourceFilter()` (`ResourceFilter.newBuilder().addResourceTypes(...)`), `startup()`/`shutdown()`; `ResourceCollectionLifecycle(RuntimeResourceCollection)` with `onStartup(List<Resource>)`, `onResourcesModified`, `getResourceCollection().getName()`.
- `DatasourceManager.getDatasource(name)` (`Datasource.getConnection()` gives `SRConnection extends java.sql.Connection`: `runUpdateQuery`, `runScalarQuery`, `runPrepUpdate`); `getConnection(name) throws SQLException`.
- `LoggerEx.newBuilder().build("MapStudio.check.<name>")`, `errorf`, `warnf`.

Repository:
- `gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/MapStudioGatewayHook.java` -- add `initializeScriptManager` and start/stop the spike lifecycle factory; keep the component and delegate registration as is.
- `gateway/build.gradle.kts` -- already has gateway-api, ignition-common, perspective jars and JUnit 5; a test needs nothing new.
- `common/.../MapStudioModule.java` -- `MODULE_ID` for the `ResourceType`.
- `ops/lib.sh`, `ops/up.sh`, `ops/docker-compose.yml` -- reuse `COMPOSE`, `wait_for_commissioned`, `.env` generation (`umask 077`, `chmod 600`); compose project name follows `MAPSTUDIO_CONTAINER`, so a second compose file in the same project shares its default network. The `init` service chowns `data/projects`; extend it for the mounted config folders.
- `ops/project/` -- the `mapstudio-dev` project (bind mount, read at Gateway start). Add the script module and the setup resource here; `resource.json` shape as in `views/MapStudioDev/resource.json` (`scope`, `version`, `files`, `attributes`).
- `.gitignore` -- add the dev Gateway's write-back noise for the new folders, as done for `session-props/`.
- Verified recipes in `/home/user/claude-ignition-skills/.claude/skills/`: `ignition-config/references/file-layout.md` (tag provider `tag-provider/<name>/{config,resource}.json`, UDT definitions `tag-type-definition/<provider>/udts.json`, instances `tag-definition/<provider>/<folder>/udts.json`, each with `unary-resource.json`), `ignition-config/references/rest-api.md` row `database-connection` (config keys `driver` `PostgreSQL`, `translator` `POSTGRES`, `connectURL`, `username`, Referenced `password`), `ignition-security/references/secrets.md` (File provider `settings.files.<name>.filePath`, `CLEARTEXT`, no trailing newline), `ignition-architect/references/tag-structure.md` lines 150 to 170 (alarm JSON that imports on 8.3.9; use `mode` `WhenTrue` on a boolean expression tag `getSecond(now()) % 60 < 30`), `ignition-ui/references/perspective-components.md` lines 154 to 160 (Alarm Metrics facts already known).
- Recording conventions: `/home/user/claude-ignition-skills/CLAUDE.md` and `docs/verification.md` (dated heading, a `Finding | Where it went` table naming the reference file; labels `[live 8.3.10]`).

## Tasks & Acceptance

**Execution:**
- [x] `common/.../MapStudioModule.java` -- add `SETUP_RESOURCE_TYPE = new ResourceType(MODULE_ID, "setup")` -- shared by gateway now, designer later.
- [x] `gateway/.../spike/SetupResource.java` -- record parsed from `setup.json` (`connection`, `connectionNoRights`, `adapterFunction`, `alarmMetricPaths`) with `fromResource(Resource)` -- the custom resource check.
- [x] `gateway/.../spike/ChecksLifecycleFactory.java`, `ChecksLifecycle.java` -- filter on `SETUP_RESOURCE_TYPE`; `onStartup` runs the checks on a bounded executor and logs one `CHECK <name> PASS|FAIL <evidence>` line each; `onResourcesModified` logs the re-read; `onShutdown` unsubscribes -- checks 1, 2, 4, 5 need a loaded project.
- [x] `gateway/.../spike/AlarmMetricsCheck.java` -- subscribe to the two paths, collect events for 90 s, also `readAsync` them; result and qualities in the log line.
- [x] `gateway/.../spike/ProjectScriptCheck.java` -- `getProjectScriptManager(project)`, `runCode` importing the module and calling `adapterFunction`, result read from the locals map; record which of `runCode` and `runFunction(getGlobals()...)` works.
- [x] `gateway/.../spike/PostgresCheck.java` -- the two connections of the matrix; the rights failure logged with `errorf("Map Studio cannot create its tables on connection %s: %s (SQLState %s)")`.
- [x] `common/.../MapStudioScriptModule.java` + `MapStudioScriptModule.properties`, `MapStudioGatewayHook.java`, `MapStudioDesignerHook.java` -- `system.mapstudio.ping()` (a pong string with the time) and `echo(text)`, registered by both hooks (the Designer one is an autocomplete registration, not a Designer editor); factory started in `startup`, stopped in `shutdown`. (As built; the first draft said gateway scope and the module version.)
- [x] `gateway/src/test/.../SetupResourceTest.java`, `PostgresCheckTest.java`, `AlarmMetricsCheckTest.java` -- parse a sample `setup.json`; the SQLState 42501 message formatting and the idempotent insert; the exactly-Good true-and-false rule; all pure.
- [x] `ops/project/ignition/script-python/mapstudio_checks/{code.py,resource.json}` -- Jython 2.7: `kinds()` returns two dicts and the value of `system.mapstudio.ping()`; `system` not imported.
- [x] `ops/project/com.aoindustrial.perspective.mapstudio/setup/{setup.json,resource.json}` -- the dev setup naming the two connections, the function and the two metric paths.
- [x] `ops/checks/config/core/{config-mode.json, ignition/tag-provider/default, ignition/tag-type-definition/default/Checks, ignition/tag-definition/default/Checks, ignition/secret-provider/MapStudioFiles, ignition/database-connection/MapStudio, ignition/database-connection/MapStudioNoRights}` -- the Gateway config files as a `core` collection (manifest and `attributes.uuid` included); passwords only as Referenced secrets. The UDT's alarm `Checks/Pump Toggled` (WhenTrue, High, Auto ack) is a dev-only test alarm, flagged for engineering review per CLAUDE.md; never copied to a real Gateway.
- [x] `ops/checks/postgres-init.sh` -- creates `mapstudio_ro` (LOGIN, CONNECT only) with its password from the mounted secret passed as a psql variable; `mapstudio` is `POSTGRES_USER`.
- [x] `ops/docker-compose.checks.yml` -- `postgres:16-alpine` service (no host port, TCP healthcheck) with `POSTGRES_PASSWORD_FILE`; `secrets:` for both passwords from git-ignored `ops/checks/secrets/`; the `init` service seeds `core` by copy from `ops/checks/config` on a fresh volume and chowns the tree.
- [x] `ops/checks.sh`, `ops/lib.sh`, `ops/up.sh`, `ops/down.sh` -- generate the two PostgreSQL passwords into `ops/checks/secrets/` (0644 in a 0700 folder, no newline), run `up.sh` with both compose files, collect the `CHECK` lines logged since the Gateway container's current start (fail if fewer than five), print them; `--keep` and `--collect`; the checks compose file is included automatically while the checks stack exists, so `down.sh --purge` removes PostgreSQL too. (As built; `--scan` was dropped, see the Plan Change Log.)
- [x] `docs/platform-checks.md` -- the record, section "Story 3 - Gateway platform checks": environment (8.3.10, PostgreSQL version, date), one subsection per check with the log lines, the SDK calls that worked, fallbacks taken, the Designer editor estimate, and a drafted `Finding | Where it went` table targeting `ignition-dev/references/module-sdk.md`.
- [x] `.gitignore`, `README.md` -- ignore `ops/checks/secrets/` and write-back noise; a short "Platform checks" paragraph.

**Acceptance Criteria:**
- Given a fresh clone with `.env` holding `MAPSTUDIO_CONTAINER=ms-s3` and `GATEWAY_HTTP_PORT=9103`, when `ops/checks.sh` runs, then the Gateway reaches RUNNING, the module starts without error, and the log holds five `CHECK` lines, each PASS or FAIL with evidence.
- Given the record in `docs/platform-checks.md`, when read against the architecture's open questions, then each of the five has an answer, its evidence and, for a FAIL, the fallback the architecture names, all labelled `[live 8.3.10]`.
- Given `./gradlew build`, when it runs, then it succeeds and the new unit tests pass; `ops/up.sh` alone (story 1's path) still works without PostgreSQL.
- Given the Designer connected to `ms-s3` (manual, owner), when `system.mapstudio.` is typed in the script console, then `ping` appears with its description.

## Implementation Notes

- Implemented directly (no coding subagent available in this session). Environment: the sandbox had rebooted before implementation started; `dockerd` was down with a stale `/var/run/docker.pid` and was restarted by hand (log in the session scratchpad). The other worktrees' Gateways were not touched.
- Gateway code: `gateway/.../spike/{SetupResource, CheckResult, ChecksLifecycleFactory, ChecksLifecycle, AlarmMetricsCheck, ProjectScriptCheck, PostgresCheck}.java`, `gateway/.../MapStudioScriptModule.java` + `.properties`, hook changes (`initializeScriptManager`, factory start/stop), `MapStudioModule.SETUP_RESOURCE_TYPE`. `ping()` returns "Map Studio pong at <UTC time>" (the module version is not in the SDK's `GatewayModule` surface read by javap; not worth the detour). Way 2 of the script check imports the module into a locals map first: project modules are not in `getGlobals()` until imported (first run showed `globals hold no 'mapstudio_checks'`).
- Ops: `ops/docker-compose.checks.yml` seeds `core` by copy from an init container (see the three findings below), `ops/checks.sh`, `ensure_checks_secrets` and `MAPSTUDIO_CHECKS` in `ops/lib.sh`, `ops/checks/config/core/...`, `ops/checks/postgres-init.sh`, project resources `ops/project/ignition/script-python/mapstudio_checks/` and `ops/project/com.aoindustrial.perspective.mapstudio/setup/`.
- Three runs failed before the passing one, each a Gateway fact now in `docs/platform-checks.md`: (1) secret files at 0600 are `Permission denied` for PostgreSQL's init user, so the files are 0644 in a 0700 folder (plan said 600); (2) a pre-filled `core` without `config-mode.json` faults a fresh Gateway; (3) named resources without `attributes.uuid` are skipped, and per-folder bind mounts leave root-owned parents the Gateway cannot write beside, so the config is copied in by the init service instead of bind-mounted (nothing is written back into the repository, so no new gitignore noise).
- `--scan` was not implemented: a project scan needs an API key the fresh dev Gateway does not have; `onResourcesModified` is logged as `CHECK setup-modified` when the Designer saves the resource (owner's manual check, marked [not verified] in the record).
- On story 1's plain path (`ops/up.sh --fresh` without the checks compose) the project still holds the setup resource, so the checks run and log `CHECK postgres FAIL no database connection named MapStudio` and the alarm-metrics FAIL at warn level: expected, no error, the tracer view is unaffected.
- Unit tests: `SetupResourceTest` (4), `PostgresCheckTest` (4) and `AlarmMetricsCheckTest` (4) beside story 1's `MapStudioDelegateTest` (6): 18 of 18 pass in `./gradlew build`.
- Review pass 2 (context-free Quick lens run by the owner's coordinator on 7c4e32b) led to the patches listed at the end of the Plan Change Log; the checks were re-run from fresh volumes afterwards (run 6, results in Verification).

## Plan Change Log

- Secret files are 0644 inside a 0700 folder, not 0600: Compose bind-mounts a file secret with its host mode and PostgreSQL's init runs as `postgres` (first run failed on `Permission denied`). Same guarantee (never committed, hidden from other local users).
- Gateway config is seeded into `core` by copy from the init service rather than bind-mounted per folder: a fresh Gateway needs `core/config-mode.json` and owns its config tree (runs 2 and 3). `ops/checks/config/` now mirrors the `core` collection layout.
- `ops/checks.sh --scan` dropped (no API key on a fresh dev Gateway); `--keep` and `--collect` added instead. `onResourcesModified` is the owner's Designer check.
- `ping()` returns a text with the Gateway time rather than the module version.
- Deviations from the frozen block, stated plainly for the owner (the frozen text is not rewritten): the matrix's "Designer autocomplete shows the doc (manual check)" and the Verification's `--scan` and `onResourcesModified` rows are **[not verified]**: `--scan` was dropped (no API key on a fresh dev Gateway) and `onResourcesModified` fires only on a Designer save or a project scan, which the owner does by hand; `ping()` returns the pong string, not the module version; `MapStudioScriptModule` lives in `common/` with a second function `echo(text)`, and the Designer hook registers it so the Designer's script manager sees `system.mapstudio` (an autocomplete registration, not a Designer resource editor, which the Boundaries forbid and the owner deferred); the test alarm `Checks/Pump Toggled` in the dev config is flagged for engineering review per CLAUDE.md (dev Gateway only).
- After the context-free Quick lens (pass 2): the project-script check passes only when the adapter's result has a non-empty `ping` string and a non-empty `kinds` list; the alarm-metrics check requires quality exactly `Good` (`QualityCode.isGood()` and name `Good`) on a Boolean true and false; the version insert is idempotent; `postgres-init.sh` passes the password as a psql variable; the PostgreSQL healthcheck probes TCP; `ops/checks.sh` collects only lines since the Gateway container's current start; `ops/lib.sh` includes the checks compose file automatically while the checks stack exists (and keeps `-p` only when `MAPSTUDIO_CONTAINER` is set, as on `main`), with `--remove-orphans` on `down`.

## Review Triage Log

Pass 1 (2026-10-26). No reviewer subagent was available in this session, so the Quick lens was staged as a standalone prompt beside this plan (since removed: the coordinator ran the context-free lens on 7c4e32b, pass 2 below). The rows below are the implementer's own inspection of the diff against the plan and CLAUDE.md, marked `self`.

| # | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|
| 1 (self) | `ops/checks.sh`: `line="$(grep ... \| tail -1)"` under lib.sh's `set -e` and `pipefail` ends the script when a CHECK line is missing, instead of reporting "no line in the log" | medium | patch | Real: `grep` exits 1, `pipefail` makes the substitution fail, `set -e` exits on the assignment. Patched with `\|\| true`; `bash -n` passes; the "missing line" branch now reports. |
| 2 (self) | Acceptance criterion 4 (Designer autocomplete of `system.mapstudio.`) could not pass: the script module was registered only in the Gateway hook; the Designer's own script manager never saw it | medium | patch | Real: IA's scripting-function example registers the module in every scope. Patched: `MapStudioScriptModule` moved to `common/` and registered in `MapStudioDesignerHook.initializeScriptManager` too; build and tests pass; the final `ops/checks.sh` run (run 5) covers the Gateway side again. The Designer check itself stays with the owner. |
| 3 (self) | `ops/checks.sh --keep` restarts the Gateway and collects from the whole container log, so lines of the previous start can satisfy the wait loop early | low | reject | Real but everyday use is the fresh run (the default); the fix (time-window the log) adds logic to a dev script. `tail -1` per name still shows the newest line. |
| 4 (self) | `PostgresCheck.checkOwner` inserts a row into `mapstudio_schema_version` on every start, so the table grows with each run | low | reject | Real, spike only; the real migration (epic-map-store-and-data) owns that table's semantics. |
| 5 (self) | On story 1's plain Gateway the checks log FAIL warnings (no connections, no provider) because the project carries the setup resource | low | reject | Expected by the plan's design (any project with a setup resource runs the checks); warn level, no error, the tracer view unaffected; the sweep removes the package. |
| 6 (self) | `onResourcesModified` and the Designer autocomplete are unverified claims | maybe-false | defer | Marked [not verified] in `docs/platform-checks.md`; a Designer save of the setup resource and a look at the script console settle both. |

Pass 2 (lens: quick, context-free, run on commit 7c4e32b by the owner's coordinator, 2026-10-26): high 0, medium 5, low 4, false 0, maybe-false 0. Patched 9, rejected 0, deferred 0.

| # | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|
| 1 | Check 3 cannot fail: `kinds()` swallows a `ping()` failure (returns `ping` None) and `ProjectScriptCheck` passes on any non-null result | medium | patch | Real: `code.py` catches the exception and returns the dict regardless; the check only tested `result != null`. Patched: `ProjectScriptCheck.validate` requires a dict with a non-empty `kinds` list and a non-empty `ping` string, both ways. |
| 2 | `ops/checks.sh --keep` and re-runs collect the previous start's CHECK lines (compose logs persist across restarts) | medium | patch | Real (also row 3 of pass 1). Patched: lines are collected with `logs --since <container StartedAt>`; `--collect` uses the same window. |
| 3 | The PostgreSQL healthcheck probes the unix socket, which the image's temporary init server answers, so the Gateway can start before `mapstudio_ro` exists | medium | patch | Real: the init-time server listens on the socket only. Patched: `pg_isready -h 127.0.0.1`. |
| 4 | `postgres-init.sh` interpolates the password into SQL | medium | patch | Real (the generated value is letters and digits, which is why it worked). Patched: `psql -v pw=...` and `PASSWORD :'pw'`, database name as `:"db"`. |
| 5 | `checkOwner` inserts a row at every lifecycle start | low | patch | Real (row 4 of pass 1, rejected there as spike-only). Patched since asked: `INSERT ... SELECT ? WHERE NOT EXISTS (... version = ?)`; the PASS line now reports rows inserted and rows in the table. |
| 6 | After a checks run, `ops/down.sh` and `up.sh --fresh` without `MAPSTUDIO_CHECKS=1` leave the PostgreSQL container and volume behind | medium | patch | Real: compose only manages services of the files it is given. Patched: `lib.sh` adds the checks compose file while `<project>_postgres-data` exists (and with `MAPSTUDIO_CHECKS=1`), `down`/`--fresh` pass `--remove-orphans`, the script help says so; the `COMPOSE` line keeps `main`'s rule (`-p` only when `MAPSTUDIO_CONTAINER` is set). |
| 7 | alarm-metrics PASS matched the substring "Good" (which `Good_...` sub-codes would also match) | low | patch | Real: the string filter was `contains("quality Good")`. Patched: a `Seen` record with `quality.isGood() && "Good".equals(quality.getName())` on a Boolean value; `AlarmMetricsCheckTest` covers it. |
| 8 | Plan text still described `--scan`, `onResourcesModified` and `ping()` returning the version; task lines and notes did not match the diff | low | patch | Real. Patched: a Plan Change Log entry states each deviation plainly; the non-frozen task lines and Implementation Notes now match the diff; the frozen block is untouched. |
| 9 | The test alarm needs an explicit engineering-review flag per CLAUDE.md | low | patch | Real. Patched: a flag line in `docs/platform-checks.md` (story 3 section) and in this plan (task list and Plan Change Log): dev-only test alarm, never copied to a real Gateway. |

## Design Notes

The checks run from a `ResourceCollectionLifecycle`, not from `startup()`, because project scripts and resources load after module startup; the lifecycle hands over the loaded resources, which is also the resource-type check itself. The expression-tag alarm toggles by the clock so no tag is written (AD-1 says Map Studio never writes tags). PostgreSQL 16 was chosen because, since PostgreSQL 15, a plain role has no CREATE on `public`, which gives the rights failure without a GRANT dance. Config goes in as bind-mounted files read at start (the skills verified tag files, providers and connections load that way) rather than through the REST API, which would need an API key on a fresh Gateway.

## Verification

**Commands:**
- `./gradlew build` -- expected: success, `build/Map-Studio.unsigned.modl`, new tests pass.
- `ops/checks.sh` -- expected: five `CHECK` lines printed; `ops/logs.sh -n 400 | grep MapStudio` shows no stack trace at error level beyond the planned rights error.
- `ops/down.sh --purge` then `ops/up.sh --fresh` -- expected: story 1's path still passes without the checks compose file.

**Results (2026-10-26):**
- `./gradlew build`: success, `build/Map-Studio.unsigned.modl`; 14 of 14 Java tests pass (6 + 4 + 4), Jest 8 of 8.
- `ops/checks.sh` (run 4, fresh volumes, `ms-s3` on 9103): all five `CHECK ... PASS` lines (quoted in `docs/platform-checks.md`); the only Map Studio error line is the planned AD-21 line for `MapStudioNoRights` (SQLState 42501); PostgreSQL shows `mapstudio_schema_version` owned by `mapstudio`, `mapstudio_ro` with CONNECT and no CREATE. Two transient `NoClassDefFoundError: org/postgresql/Driver$1` errors during the Gateway's own connection install at start-up, before the module ran; both connections `Valid` five seconds later (recorded, cause not established).
- `MAPSTUDIO_CHECKS=1 ops/down.sh --purge` then `ops/up.sh --fresh --no-build`: Gateway RUNNING, module started, no Map Studio error (the checks log their FAIL lines at warn, see Implementation Notes).
- After the review patches (`ops/checks.sh` exit bug, script module in `common/` + Designer registration): `./gradlew build` green, 14 of 14 tests; `ops/checks.sh` run 5 (fresh, 07:06 UTC): all five PASS again.
- After the pass 2 patches: `./gradlew build` green, 18 of 18 Java tests; `ops/checks.sh` run 6 (fresh volumes, Gateway started 07:15:04 UTC, lines collected since that start): all five PASS, the postgres line now reads `inserted 1 row(s) for version 1 (1 row(s) in the table)`; `ops/checks.sh --collect` reports the same five from the running Gateway; `ops/lib.sh` sourced without `MAPSTUDIO_CHECKS` builds `docker compose -p ms-s3 -f docker-compose.yml -f docker-compose.checks.yml` while the `ms-s3_postgres-data` volume exists; `psql` counts one row in `mapstudio_schema_version`. The `ms-s3` checks stack is left running for the owner's Designer check.
- No em dash in any file touched (the vendored `.claude/skills/bmad-deep-recon` files carry some; not this story's).
- `grep -rnP '\xE2\x80\x94' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=build` -- expected: nothing (no em dash anywhere).

**Manual checks (if no CLI):**
- Owner opens the Designer on `ms-s3` (after `ops/checks.sh`), confirms `system.mapstudio.ping()` autocompletes with its description and answers, that the Alarm Metrics folders exist under `Checks` and `Checks/Pump1`, and that saving the `setup` resource logs `CHECK setup-modified`.
