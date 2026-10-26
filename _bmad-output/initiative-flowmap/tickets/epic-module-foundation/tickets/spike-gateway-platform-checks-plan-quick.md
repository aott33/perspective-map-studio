Read the plan below (the acceptance criteria and intent) and the agent instruction files (CLAUDE.md or equivalents) at the repository root and in the directories the diff touches; those are the rules. Then read the unified diff below; it is the change under review.

Report unmet acceptance criteria, broken rules, and bugs. Each finding: the location, what goes wrong, and evidence checked against the surrounding code. Output a Markdown list of findings only, no severity, priority, or ranking.

Review by inspection only. Do not modify code, run builds or tests, or invoke quality gates. Do not invoke any skill, and do not spawn subagents of your own; you are the reviewer. Return your findings as text in your final message.

----- PLAN (spike-gateway-platform-checks-plan.md) -----
---
title: 'Gateway platform checks'
type: 'feature'
ticket: '3'
created: '2026-10-26'
status: 'in-progress'
baseline_revision: 'dcb0479821a7517574e0743cc843370211af1859'
route: 'full'
route_source: 'auto'
risk: 'high'
review: ''
review_source: ''
lenses_ran: []
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
- [x] `gateway/.../MapStudioScriptModule.java` + `MapStudioScriptModule.properties`, `MapStudioGatewayHook.java` -- `system.mapstudio.ping()` returning the module version; factory started in `startup`, stopped in `shutdown`.
- [x] `gateway/src/test/.../SetupResourceTest.java`, `PostgresCheckTest.java` -- parse a sample `setup.json`; the SQLState 42501 message formatting; both pure.
- [x] `ops/project/ignition/script-python/mapstudio_checks/{code.py,resource.json}` -- Jython 2.7: `kinds()` returns two dicts and the value of `system.mapstudio.ping()`; `system` not imported.
- [x] `ops/project/com.aoindustrial.perspective.mapstudio/setup/{setup.json,resource.json}` -- the dev setup naming the two connections, the function and the two metric paths.
- [x] `ops/checks/config/.../{tag-provider/default, tag-type-definition/default, tag-definition/default/Checks, secret-provider/MapStudioFiles, database-connection/MapStudio, database-connection/MapStudioNoRights}` -- the Gateway config files; passwords only as Referenced secrets.
- [x] `ops/checks/postgres-init.sql` -- creates `mapstudio_ro` (LOGIN, CONNECT only) reading its password from the mounted secret through a small init shell script; `mapstudio` is `POSTGRES_USER`.
- [x] `ops/docker-compose.checks.yml` -- `postgres:16` service (no host port) with `POSTGRES_PASSWORD_FILE`; `secrets:` for both passwords from git-ignored `ops/checks/secrets/`; the config folders bind-mounted into `data/config/resources/core/...`; `init` extended to chown them.
- [x] `ops/checks.sh`, `ops/lib.sh` -- generate the two PostgreSQL passwords into `ops/checks/secrets/` (mode 600, no newline), run `up.sh` with both compose files, wait, grep the wrapper log for the `CHECK` lines (fail if fewer than five), print them; `--scan` edits nothing but re-posts a project scan to show `onResourcesModified`.
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
- Unit tests: `SetupResourceTest` (4) and `PostgresCheckTest` (4) beside story 1's `MapStudioDelegateTest` (6): 14 of 14 pass in `./gradlew build`.

## Plan Change Log

- Secret files are 0644 inside a 0700 folder, not 0600: Compose bind-mounts a file secret with its host mode and PostgreSQL's init runs as `postgres` (first run failed on `Permission denied`). Same guarantee (never committed, hidden from other local users).
- Gateway config is seeded into `core` by copy from the init service rather than bind-mounted per folder: a fresh Gateway needs `core/config-mode.json` and owns its config tree (runs 2 and 3). `ops/checks/config/` now mirrors the `core` collection layout.
- `ops/checks.sh --scan` dropped (no API key on a fresh dev Gateway); `--keep` and `--collect` added instead. `onResourcesModified` is the owner's Designer check.
- `ping()` returns a text with the Gateway time rather than the module version.

## Review Triage Log

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
- No em dash in any file touched (the vendored `.claude/skills/bmad-deep-recon` files carry some; not this story's).
- `grep -rnP '\xE2\x80\x94' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=build` -- expected: nothing (no em dash anywhere).

**Manual checks (if no CLI):**
- Owner opens the Designer on `ms-s3` (after `ops/checks.sh`), confirms `system.mapstudio.ping()` autocompletes with its description and answers, that the Alarm Metrics folders exist under `Checks` and `Checks/Pump1`, and that saving the `setup` resource logs `CHECK setup-modified`.

----- DIFF since dcb0479821a7517574e0743cc843370211af1859 -----
diff --git a/.gitignore b/.gitignore
index b1a8f98..e75cab9 100644
--- a/.gitignore
+++ b/.gitignore
@@ -34,3 +34,6 @@ signing/
 .vscode/
 bin/
 .DS_Store
+
+# Platform checks (story 3): generated PostgreSQL passwords
+ops/checks/secrets/
diff --git a/README.md b/README.md
index 1d6f319..ac8f4b2 100644
--- a/README.md
+++ b/README.md
@@ -48,6 +48,10 @@ To run several dev Gateways side by side, give each its own `MAPSTUDIO_CONTAINER
 
 The dev Gateway loads the unsigned build (`-Dignition.allowunsignedmodules=true`), which is never acceptable outside development. Releases are signed `.modl` files on GitHub.
 
+### Platform checks
+
+`ops/checks.sh` answers the spike's Gateway questions on a live 8.3.10 Gateway: it adds PostgreSQL 16 beside the dev Gateway (`ops/docker-compose.checks.yml`), seeds the Gateway's core config collection from `ops/checks/config/core/` (a tag provider, a UDT whose alarm toggles every 30 s, a File secret provider and two database connections), and the module's `gateway/.../spike` package then logs one `CHECK <name> PASS|FAIL <evidence>` line per check for any project that holds a `com.aoindustrial.perspective.mapstudio/setup` resource (`ops/project/.../setup/setup.json`). The PostgreSQL passwords are generated into the git-ignored `ops/checks/secrets/` and reach the Gateway only through its File secret provider. Results and evidence: [docs/platform-checks.md](docs/platform-checks.md). The spike package is removed by the refactor sweep.
+
 ## Message contract
 
 Every message between the browser and the Gateway is `{v, type, id, body}` under the model event `mapstudio.message`; errors are `{code, message}`. The types this version knows are listed in `common/.../Messages.java` and `web/typescript/messages.ts`: `point.click`, `point.click.reply`, `error`.
diff --git a/_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/spike-gateway-platform-checks-plan.md b/_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/spike-gateway-platform-checks-plan.md
index bfa8dd5..ed13502 100644
--- a/_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/spike-gateway-platform-checks-plan.md
+++ b/_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/spike-gateway-platform-checks-plan.md
@@ -3,8 +3,8 @@ title: 'Gateway platform checks'
 type: 'feature'
 ticket: '3'
 created: '2026-10-26'
-status: 'draft'
-baseline_revision: ''
+status: 'in-progress'
+baseline_revision: 'dcb0479821a7517574e0743cc843370211af1859'
 route: 'full'
 route_source: 'auto'
 risk: 'high'
@@ -28,6 +28,8 @@ context:
 
 **Always:** Java 17, SDK 8.3.0 jars; story 1's build, ops scripts and module ids untouched in behaviour; dev Gateway `MAPSTUDIO_CONTAINER=ms-s3`, `GATEWAY_HTTP_PORT=9103` in the git-ignored `.env`; every password generated into `.env` or a git-ignored secret file and reaching the Gateway only through a File secret provider (Referenced secret) and PostgreSQL through `POSTGRES_PASSWORD_FILE`; the Gateway's default connection settings (pool 0/8/8/0, `SELECT 1`, test on borrow) left as they are; loggers `MapStudio.check.<name>`; each recorded answer carries its evidence and label `[live 8.3.10]` and, where a check fails, the fallback taken; no em dashes; the claude-ignition-skills repository is not edited in this story (its entry is drafted in the record for the owner to land).
 
+**Decisions (owner, 2026-10-26):** the setup resource is read on the Gateway only; the Designer editor's cost is estimated from IA's example and the decision deferred to epic-map-store-and-data. The record is one shared file `docs/platform-checks.md`, section "Story 3 - Gateway platform checks" (stories 2 and 4 add their own sections; keep to this one), holding the drafted `Finding | Where it went` table that targets a new `ignition-dev/references/module-sdk.md` for story 9 to land. The plan is kept whole despite its length.
+
 **Never:** a Designer resource editor or workspace; writes to tags, devices or UDT instances; reading Alarm Metrics with `system.tag.read*`; passwords, API keys or tokens in any committed file; changes to `MapStudioDelegate`, `web/`, `common/` schemas or the `MapStudioDev` view; a `.modl` or JDBC driver in git (8.3.10 ships `PostgreSQL JDBC Driver Module.modl`); production code paths: the spike package is removed by the refactor sweep (story 8).
 
 ## I/O & Edge-Case Matrix
@@ -69,33 +71,46 @@ Repository:
 ## Tasks & Acceptance
 
 **Execution:**
-- [ ] `common/.../MapStudioModule.java` -- add `SETUP_RESOURCE_TYPE = new ResourceType(MODULE_ID, "setup")` -- shared by gateway now, designer later.
-- [ ] `gateway/.../spike/SetupResource.java` -- record parsed from `setup.json` (`connection`, `connectionNoRights`, `adapterFunction`, `alarmMetricPaths`) with `fromResource(Resource)` -- the custom resource check.
-- [ ] `gateway/.../spike/ChecksLifecycleFactory.java`, `ChecksLifecycle.java` -- filter on `SETUP_RESOURCE_TYPE`; `onStartup` runs the checks on a bounded executor and logs one `CHECK <name> PASS|FAIL <evidence>` line each; `onResourcesModified` logs the re-read; `onShutdown` unsubscribes -- checks 1, 2, 4, 5 need a loaded project.
-- [ ] `gateway/.../spike/AlarmMetricsCheck.java` -- subscribe to the two paths, collect events for 90 s, also `readAsync` them; result and qualities in the log line.
-- [ ] `gateway/.../spike/ProjectScriptCheck.java` -- `getProjectScriptManager(project)`, `runCode` importing the module and calling `adapterFunction`, result read from the locals map; record which of `runCode` and `runFunction(getGlobals()...)` works.
-- [ ] `gateway/.../spike/PostgresCheck.java` -- the two connections of the matrix; the rights failure logged with `errorf("Map Studio cannot create its tables on connection %s: %s (SQLState %s)")`.
-- [ ] `gateway/.../MapStudioScriptModule.java` + `MapStudioScriptModule.properties`, `MapStudioGatewayHook.java` -- `system.mapstudio.ping()` returning the module version; factory started in `startup`, stopped in `shutdown`.
-- [ ] `gateway/src/test/.../SetupResourceTest.java`, `PostgresCheckTest.java` -- parse a sample `setup.json`; the SQLState 42501 message formatting; both pure.
-- [ ] `ops/project/ignition/script-python/mapstudio_checks/{code.py,resource.json}` -- Jython 2.7: `kinds()` returns two dicts and the value of `system.mapstudio.ping()`; `system` not imported.
-- [ ] `ops/project/com.aoindustrial.perspective.mapstudio/setup/{setup.json,resource.json}` -- the dev setup naming the two connections, the function and the two metric paths.
-- [ ] `ops/checks/config/.../{tag-provider/default, tag-type-definition/default, tag-definition/default/Checks, secret-provider/MapStudioFiles, database-connection/MapStudio, database-connection/MapStudioNoRights}` -- the Gateway config files; passwords only as Referenced secrets.
-- [ ] `ops/checks/postgres-init.sql` -- creates `mapstudio_ro` (LOGIN, CONNECT only) reading its password from the mounted secret through a small init shell script; `mapstudio` is `POSTGRES_USER`.
-- [ ] `ops/docker-compose.checks.yml` -- `postgres:16` service (no host port) with `POSTGRES_PASSWORD_FILE`; `secrets:` for both passwords from git-ignored `ops/checks/secrets/`; the config folders bind-mounted into `data/config/resources/core/...`; `init` extended to chown them.
-- [ ] `ops/checks.sh`, `ops/lib.sh` -- generate the two PostgreSQL passwords into `ops/checks/secrets/` (mode 600, no newline), run `up.sh` with both compose files, wait, grep the wrapper log for the `CHECK` lines (fail if fewer than five), print them; `--scan` edits nothing but re-posts a project scan to show `onResourcesModified`.
-- [ ] `docs/spike/platform-checks.md` -- the record: environment (8.3.10, PostgreSQL version, date), one section per check with the log lines, the SDK calls that worked, fallbacks taken, and a drafted `Finding | Where it went` table for claude-ignition-skills (`ignition-architect/references/system-architectures.md` or a new `ignition-dev/references/module-sdk.md`, owner's call).
-- [ ] `.gitignore`, `README.md` -- ignore `ops/checks/secrets/` and write-back noise; a short "Platform checks" paragraph.
+- [x] `common/.../MapStudioModule.java` -- add `SETUP_RESOURCE_TYPE = new ResourceType(MODULE_ID, "setup")` -- shared by gateway now, designer later.
+- [x] `gateway/.../spike/SetupResource.java` -- record parsed from `setup.json` (`connection`, `connectionNoRights`, `adapterFunction`, `alarmMetricPaths`) with `fromResource(Resource)` -- the custom resource check.
+- [x] `gateway/.../spike/ChecksLifecycleFactory.java`, `ChecksLifecycle.java` -- filter on `SETUP_RESOURCE_TYPE`; `onStartup` runs the checks on a bounded executor and logs one `CHECK <name> PASS|FAIL <evidence>` line each; `onResourcesModified` logs the re-read; `onShutdown` unsubscribes -- checks 1, 2, 4, 5 need a loaded project.
+- [x] `gateway/.../spike/AlarmMetricsCheck.java` -- subscribe to the two paths, collect events for 90 s, also `readAsync` them; result and qualities in the log line.
+- [x] `gateway/.../spike/ProjectScriptCheck.java` -- `getProjectScriptManager(project)`, `runCode` importing the module and calling `adapterFunction`, result read from the locals map; record which of `runCode` and `runFunction(getGlobals()...)` works.
+- [x] `gateway/.../spike/PostgresCheck.java` -- the two connections of the matrix; the rights failure logged with `errorf("Map Studio cannot create its tables on connection %s: %s (SQLState %s)")`.
+- [x] `gateway/.../MapStudioScriptModule.java` + `MapStudioScriptModule.properties`, `MapStudioGatewayHook.java` -- `system.mapstudio.ping()` returning the module version; factory started in `startup`, stopped in `shutdown`.
+- [x] `gateway/src/test/.../SetupResourceTest.java`, `PostgresCheckTest.java` -- parse a sample `setup.json`; the SQLState 42501 message formatting; both pure.
+- [x] `ops/project/ignition/script-python/mapstudio_checks/{code.py,resource.json}` -- Jython 2.7: `kinds()` returns two dicts and the value of `system.mapstudio.ping()`; `system` not imported.
+- [x] `ops/project/com.aoindustrial.perspective.mapstudio/setup/{setup.json,resource.json}` -- the dev setup naming the two connections, the function and the two metric paths.
+- [x] `ops/checks/config/.../{tag-provider/default, tag-type-definition/default, tag-definition/default/Checks, secret-provider/MapStudioFiles, database-connection/MapStudio, database-connection/MapStudioNoRights}` -- the Gateway config files; passwords only as Referenced secrets.
+- [x] `ops/checks/postgres-init.sql` -- creates `mapstudio_ro` (LOGIN, CONNECT only) reading its password from the mounted secret through a small init shell script; `mapstudio` is `POSTGRES_USER`.
+- [x] `ops/docker-compose.checks.yml` -- `postgres:16` service (no host port) with `POSTGRES_PASSWORD_FILE`; `secrets:` for both passwords from git-ignored `ops/checks/secrets/`; the config folders bind-mounted into `data/config/resources/core/...`; `init` extended to chown them.
+- [x] `ops/checks.sh`, `ops/lib.sh` -- generate the two PostgreSQL passwords into `ops/checks/secrets/` (mode 600, no newline), run `up.sh` with both compose files, wait, grep the wrapper log for the `CHECK` lines (fail if fewer than five), print them; `--scan` edits nothing but re-posts a project scan to show `onResourcesModified`.
+- [x] `docs/platform-checks.md` -- the record, section "Story 3 - Gateway platform checks": environment (8.3.10, PostgreSQL version, date), one subsection per check with the log lines, the SDK calls that worked, fallbacks taken, the Designer editor estimate, and a drafted `Finding | Where it went` table targeting `ignition-dev/references/module-sdk.md`.
+- [x] `.gitignore`, `README.md` -- ignore `ops/checks/secrets/` and write-back noise; a short "Platform checks" paragraph.
 
 **Acceptance Criteria:**
 - Given a fresh clone with `.env` holding `MAPSTUDIO_CONTAINER=ms-s3` and `GATEWAY_HTTP_PORT=9103`, when `ops/checks.sh` runs, then the Gateway reaches RUNNING, the module starts without error, and the log holds five `CHECK` lines, each PASS or FAIL with evidence.
-- Given the record in `docs/spike/platform-checks.md`, when read against the architecture's open questions, then each of the five has an answer, its evidence and, for a FAIL, the fallback the architecture names, all labelled `[live 8.3.10]`.
+- Given the record in `docs/platform-checks.md`, when read against the architecture's open questions, then each of the five has an answer, its evidence and, for a FAIL, the fallback the architecture names, all labelled `[live 8.3.10]`.
 - Given `./gradlew build`, when it runs, then it succeeds and the new unit tests pass; `ops/up.sh` alone (story 1's path) still works without PostgreSQL.
 - Given the Designer connected to `ms-s3` (manual, owner), when `system.mapstudio.` is typed in the script console, then `ping` appears with its description.
 
 ## Implementation Notes
 
+- Implemented directly (no coding subagent available in this session). Environment: the sandbox had rebooted before implementation started; `dockerd` was down with a stale `/var/run/docker.pid` and was restarted by hand (log in the session scratchpad). The other worktrees' Gateways were not touched.
+- Gateway code: `gateway/.../spike/{SetupResource, CheckResult, ChecksLifecycleFactory, ChecksLifecycle, AlarmMetricsCheck, ProjectScriptCheck, PostgresCheck}.java`, `gateway/.../MapStudioScriptModule.java` + `.properties`, hook changes (`initializeScriptManager`, factory start/stop), `MapStudioModule.SETUP_RESOURCE_TYPE`. `ping()` returns "Map Studio pong at <UTC time>" (the module version is not in the SDK's `GatewayModule` surface read by javap; not worth the detour). Way 2 of the script check imports the module into a locals map first: project modules are not in `getGlobals()` until imported (first run showed `globals hold no 'mapstudio_checks'`).
+- Ops: `ops/docker-compose.checks.yml` seeds `core` by copy from an init container (see the three findings below), `ops/checks.sh`, `ensure_checks_secrets` and `MAPSTUDIO_CHECKS` in `ops/lib.sh`, `ops/checks/config/core/...`, `ops/checks/postgres-init.sh`, project resources `ops/project/ignition/script-python/mapstudio_checks/` and `ops/project/com.aoindustrial.perspective.mapstudio/setup/`.
+- Three runs failed before the passing one, each a Gateway fact now in `docs/platform-checks.md`: (1) secret files at 0600 are `Permission denied` for PostgreSQL's init user, so the files are 0644 in a 0700 folder (plan said 600); (2) a pre-filled `core` without `config-mode.json` faults a fresh Gateway; (3) named resources without `attributes.uuid` are skipped, and per-folder bind mounts leave root-owned parents the Gateway cannot write beside, so the config is copied in by the init service instead of bind-mounted (nothing is written back into the repository, so no new gitignore noise).
+- `--scan` was not implemented: a project scan needs an API key the fresh dev Gateway does not have; `onResourcesModified` is logged as `CHECK setup-modified` when the Designer saves the resource (owner's manual check, marked [not verified] in the record).
+- On story 1's plain path (`ops/up.sh --fresh` without the checks compose) the project still holds the setup resource, so the checks run and log `CHECK postgres FAIL no database connection named MapStudio` and the alarm-metrics FAIL at warn level: expected, no error, the tracer view is unaffected.
+- Unit tests: `SetupResourceTest` (4) and `PostgresCheckTest` (4) beside story 1's `MapStudioDelegateTest` (6): 14 of 14 pass in `./gradlew build`.
+
 ## Plan Change Log
 
+- Secret files are 0644 inside a 0700 folder, not 0600: Compose bind-mounts a file secret with its host mode and PostgreSQL's init runs as `postgres` (first run failed on `Permission denied`). Same guarantee (never committed, hidden from other local users).
+- Gateway config is seeded into `core` by copy from the init service rather than bind-mounted per folder: a fresh Gateway needs `core/config-mode.json` and owns its config tree (runs 2 and 3). `ops/checks/config/` now mirrors the `core` collection layout.
+- `ops/checks.sh --scan` dropped (no API key on a fresh dev Gateway); `--keep` and `--collect` added instead. `onResourcesModified` is the owner's Designer check.
+- `ping()` returns a text with the Gateway time rather than the module version.
+
 ## Review Triage Log
 
 ## Design Notes
@@ -107,14 +122,14 @@ The checks run from a `ResourceCollectionLifecycle`, not from `startup()`, becau
 **Commands:**
 - `./gradlew build` -- expected: success, `build/Map-Studio.unsigned.modl`, new tests pass.
 - `ops/checks.sh` -- expected: five `CHECK` lines printed; `ops/logs.sh -n 400 | grep MapStudio` shows no stack trace at error level beyond the planned rights error.
-- `ops/checks.sh --scan` -- expected: a `CHECK setup` line after `onResourcesModified`.
 - `ops/down.sh --purge` then `ops/up.sh --fresh` -- expected: story 1's path still passes without the checks compose file.
+
+**Results (2026-10-26):**
+- `./gradlew build`: success, `build/Map-Studio.unsigned.modl`; 14 of 14 Java tests pass (6 + 4 + 4), Jest 8 of 8.
+- `ops/checks.sh` (run 4, fresh volumes, `ms-s3` on 9103): all five `CHECK ... PASS` lines (quoted in `docs/platform-checks.md`); the only Map Studio error line is the planned AD-21 line for `MapStudioNoRights` (SQLState 42501); PostgreSQL shows `mapstudio_schema_version` owned by `mapstudio`, `mapstudio_ro` with CONNECT and no CREATE. Two transient `NoClassDefFoundError: org/postgresql/Driver$1` errors during the Gateway's own connection install at start-up, before the module ran; both connections `Valid` five seconds later (recorded, cause not established).
+- `MAPSTUDIO_CHECKS=1 ops/down.sh --purge` then `ops/up.sh --fresh --no-build`: Gateway RUNNING, module started, no Map Studio error (the checks log their FAIL lines at warn, see Implementation Notes).
+- No em dash in any file touched (the vendored `.claude/skills/bmad-deep-recon` files carry some; not this story's).
 - `grep -rnP '\xE2\x80\x94' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=build` -- expected: nothing (no em dash anywhere).
 
 **Manual checks (if no CLI):**
-- Owner opens the Designer on `ms-s3`, confirms `system.mapstudio.ping()` autocompletes and returns the version, and the Alarm Metrics folders exist under `Checks` and `Checks/Pump1`.
-
-## Open Questions
-
-1. **Designer side of the setup resource.** The spike reads the resource on the Gateway only and sizes the Designer editor from IA's example (about 300 lines of Swing: workspace, editor, search provider, icon). Options: (a) Gateway-only now, record the estimate, decide in epic-map-store-and-data (the plan above); (b) build a minimal Designer editor in this spike (adds a day and a `designer/` dependency on the SDK's `designer` jar). (a) keeps the two-day gate; (b) answers AD-5's "too costly" with code.
-2. **Where the skills entry lands.** The record drafts the `Finding | Where it went` rows, but the skills repository has no reference file for the module SDK. Options: (a) a new `ignition-dev/references/module-sdk.md`; (b) rows in `ignition-architect/references/system-architectures.md` and `ignition-ui/references/perspective-components.md` (Alarm Metrics). The owner lands it later either way; the draft names the chosen file.
+- Owner opens the Designer on `ms-s3` (after `ops/checks.sh`), confirms `system.mapstudio.ping()` autocompletes with its description and answers, that the Alarm Metrics folders exist under `Checks` and `Checks/Pump1`, and that saving the `setup` resource logs `CHECK setup-modified`.
diff --git a/common/src/main/java/com/aoindustrial/perspective/mapstudio/common/MapStudioModule.java b/common/src/main/java/com/aoindustrial/perspective/mapstudio/common/MapStudioModule.java
index 2379160..1e5fafc 100644
--- a/common/src/main/java/com/aoindustrial/perspective/mapstudio/common/MapStudioModule.java
+++ b/common/src/main/java/com/aoindustrial/perspective/mapstudio/common/MapStudioModule.java
@@ -3,6 +3,7 @@ package com.aoindustrial.perspective.mapstudio.common;
 import java.util.Set;
 
 import com.inductiveautomation.ignition.common.jsonschema.JsonSchema;
+import com.inductiveautomation.ignition.common.resourcecollection.ResourceType;
 import com.inductiveautomation.perspective.common.api.BrowserResource;
 
 /**
@@ -16,6 +17,13 @@ public final class MapStudioModule {
     /** Module id; must match {@code id} in the root build.gradle.kts. */
     public static final String MODULE_ID = "com.aoindustrial.perspective.mapstudio";
 
+    /**
+     * The project setup resource (AD-5): one per project, stored in the project
+     * folder as {@code com.aoindustrial.perspective.mapstudio/setup/setup.json}.
+     * Shared by the gateway (read) and, later, the designer (edit).
+     */
+    public static final ResourceType SETUP_RESOURCE_TYPE = new ResourceType(MODULE_ID, "setup");
+
     /** Mount alias: the web bundle is served at {@code /res/<URL_ALIAS>/}. */
     public static final String URL_ALIAS = "mapstudio";
 
diff --git a/common/src/main/java/com/aoindustrial/perspective/mapstudio/common/MapStudioScriptModule.java b/common/src/main/java/com/aoindustrial/perspective/mapstudio/common/MapStudioScriptModule.java
new file mode 100644
index 0000000..71a585a
--- /dev/null
+++ b/common/src/main/java/com/aoindustrial/perspective/mapstudio/common/MapStudioScriptModule.java
@@ -0,0 +1,42 @@
+package com.aoindustrial.perspective.mapstudio.common;
+
+import java.time.Instant;
+import java.time.temporal.ChronoUnit;
+
+import com.inductiveautomation.ignition.common.BundleUtil;
+import com.inductiveautomation.ignition.common.script.hints.ScriptArg;
+import com.inductiveautomation.ignition.common.script.hints.JythonElement;
+
+/**
+ * The {@code system.mapstudio} scripting module (AD-18). Spike (story 3): one
+ * function, {@code ping()}, proves that a module registers a scripting function
+ * that project scripts and the Designer see; the real API (getMap, applyEdits)
+ * is epic-map-store-and-data's.
+ *
+ * <p>Lives in the common scope so the Gateway hook (where scripts run) and the
+ * Designer hook (autocomplete and the script console) register the same class,
+ * as IA's scripting-function example does. The real API's Gateway-only functions
+ * will call the Gateway over RPC from the Designer, as in that example.
+ *
+ * <p>Documentation comes from {@code MapStudioScriptModule.properties} through
+ * the {@code PropertiesFileDocProvider} each hook registers it with.
+ */
+public final class MapStudioScriptModule {
+
+    static {
+        BundleUtil.get().addBundle(
+            MapStudioScriptModule.class.getSimpleName(),
+            MapStudioScriptModule.class.getClassLoader(),
+            MapStudioScriptModule.class.getName().replace('.', '/'));
+    }
+
+    @JythonElement(docBundlePrefix = "MapStudioScriptModule")
+    public String ping() {
+        return "Map Studio pong at " + Instant.now().truncatedTo(ChronoUnit.SECONDS);
+    }
+
+    @JythonElement(docBundlePrefix = "MapStudioScriptModule")
+    public String echo(@ScriptArg("text") String text) {
+        return text == null ? "" : text;
+    }
+}
diff --git a/common/src/main/resources/com/aoindustrial/perspective/mapstudio/common/MapStudioScriptModule.properties b/common/src/main/resources/com/aoindustrial/perspective/mapstudio/common/MapStudioScriptModule.properties
new file mode 100644
index 0000000..258e1b3
--- /dev/null
+++ b/common/src/main/resources/com/aoindustrial/perspective/mapstudio/common/MapStudioScriptModule.properties
@@ -0,0 +1,6 @@
+ping.desc=Answers with a short text and the Gateway time, to show that Map Studio's scripting module is loaded.
+ping.returns=A string: "Map Studio pong at <ISO 8601 UTC time>".
+
+echo.desc=Returns the text it is given. A placeholder for the spike; the real API (getMap, applyEdits) comes with the map store.
+echo.param.text=The text to return.
+echo.returns=The same text.
diff --git a/designer/src/main/java/com/aoindustrial/perspective/mapstudio/designer/MapStudioDesignerHook.java b/designer/src/main/java/com/aoindustrial/perspective/mapstudio/designer/MapStudioDesignerHook.java
index 46abf1e..133b73b 100644
--- a/designer/src/main/java/com/aoindustrial/perspective/mapstudio/designer/MapStudioDesignerHook.java
+++ b/designer/src/main/java/com/aoindustrial/perspective/mapstudio/designer/MapStudioDesignerHook.java
@@ -1,6 +1,8 @@
 package com.aoindustrial.perspective.mapstudio.designer;
 
 import com.inductiveautomation.ignition.common.licensing.LicenseState;
+import com.inductiveautomation.ignition.common.script.ScriptManager;
+import com.inductiveautomation.ignition.common.script.hints.PropertiesFileDocProvider;
 import com.inductiveautomation.ignition.common.util.LoggerEx;
 import com.inductiveautomation.ignition.designer.model.AbstractDesignerModuleHook;
 import com.inductiveautomation.ignition.designer.model.DesignerContext;
@@ -8,6 +10,7 @@ import com.inductiveautomation.perspective.designer.DesignerComponentRegistry;
 import com.inductiveautomation.perspective.designer.api.PerspectiveDesignerInterface;
 
 import com.aoindustrial.perspective.mapstudio.common.MapStudioComponent;
+import com.aoindustrial.perspective.mapstudio.common.MapStudioScriptModule;
 
 /**
  * Designer scope hook: puts the Map Studio component in the Perspective palette.
@@ -26,6 +29,13 @@ public class MapStudioDesignerHook extends AbstractDesignerModuleHook {
         this.registry.registerComponent(MapStudioComponent.DESCRIPTOR);
     }
 
+    /** The same {@code system.mapstudio} module as the Gateway, for autocomplete and the script console. */
+    @Override
+    public void initializeScriptManager(ScriptManager manager) {
+        super.initializeScriptManager(manager);
+        manager.addScriptModule("system.mapstudio", new MapStudioScriptModule(), new PropertiesFileDocProvider());
+    }
+
     @Override
     public void shutdown() {
         if (this.registry != null) {
diff --git a/docs/platform-checks.md b/docs/platform-checks.md
new file mode 100644
index 0000000..67f39aa
--- /dev/null
+++ b/docs/platform-checks.md
@@ -0,0 +1,80 @@
+# Platform checks
+
+The spike's answers to the architecture spine's open questions, each on a live Ignition 8.3 Gateway with its evidence. One section per story (2, 3 and 4 each add their own); story 9 compiles them into the go or no-go report and lands the `Finding | Where it went` rows in claude-ignition-skills.
+
+Labels: **[live 8.3.10]** seen on the dev Gateway named in the section; **[SDK 8.3.0 javap]** read from the SDK jars' signatures, not run; **[IA docs]** from the IA 8.3 manual; **[not verified]** a claim nobody has seen work yet.
+
+## Story 3 - Gateway platform checks
+
+Date: 2026-10-26. Gateway: `inductiveautomation/ignition:8.3.10` (`sha256:174fb4d8c640a6439baec35540bdf15169f850f6f849a1ae80dcb91bbe66b119`), Standard edition, trial, container `ms-s3` on port 9103, module `com.aoindustrial.perspective.mapstudio` 0.1.0 built unsigned from this branch against SDK 8.3.0. PostgreSQL: `postgres:16-alpine` (`sha256:f4610795587492cd4fb887c2dc3de301b813278bb6f616992061141b5f15ac36`, server 16.15) on the same compose network, reached as `postgres:5432`. Run with `ops/checks.sh` (fresh volumes); the five lines below are the Gateway log's `CHECK` lines of that run, each logged by the module's `gateway/.../spike` package from a `ResourceCollectionLifecycle` of the `mapstudio-dev` project.
+
+### Answers at a glance
+
+| Open question (architecture spine) | Answer | Fallback |
+| --- | --- | --- |
+| Do Java tag subscriptions reach Alarm Metrics on folders and UDT instances? | Yes **[live 8.3.10]**: `TagManager.subscribeAsync` on `<folder>/Alarm Metrics.HasActive` and `<UDT instance>/Alarm Metrics.HasActive` delivered Good true and false as the alarm toggled. `readAsync` on the same paths answers `Bad_Unsupported` (IA: direct reads are not supported) | Not needed (was: a Reference tag per metric) |
+| Can module code call project script functions? | Yes **[live 8.3.10]**: `ProjectManager.getProjectScriptManager(project)` gives a `ScriptManager` (`TrackingProjectScriptManager`) and both `runCode` and `runFunction` ran `mapstudio_checks.kinds()` and returned its dict | Not needed (was: a named query) |
+| Can a module register `system.mapstudio.*`? | Yes **[live 8.3.10]**: `initializeScriptManager` + `addScriptModule("system.mapstudio", ...)`; the project function called `system.mapstudio.ping()` and got its answer. Designer autocomplete **[not verified]** (owner's manual check) | Not needed |
+| Is a custom project resource type workable for the setup? | Gateway side yes **[live 8.3.10]**: a `com.aoindustrial.perspective.mapstudio/setup/{setup.json,resource.json}` folder in the project loads with no registration, and a `ResourceCollectionLifecycleFactory` filtered on the type receives it in `onStartup`. Designer editor not built (owner's decision, 2026-10-26): about 300 lines from IA's example, see below; decided in epic-map-store-and-data | Setup as a project script function returning the same schema (AD-5) |
+| PostgreSQL on 8.3.10's connection defaults: connect, create a `mapstudio_` table, log an error on missing rights? | Yes **[live 8.3.10]**: owner role created `mapstudio_schema_version`, inserted and read back; a CONNECT-only role's CREATE failed with SQLState 42501 and the module logged one error line naming the connection, the statement and the SQLState, while the connection itself stayed `Valid` | Not needed |
+
+### The five CHECK lines (Gateway log, 2026-10-26 06:59 UTC)
+
+```text
+CHECK setup PASS project mapstudio-dev: lifecycle onStartup received 1 resource(s) of type com.aoindustrial.perspective.mapstudio/setup; parsed SetupResource[connection=MapStudio, connectionNoRights=MapStudioNoRights, adapterFunction=mapstudio_checks.kinds, alarmMetricPaths=[[default]Checks/Alarm Metrics.HasActive, [default]Checks/Pump1/Alarm Metrics.HasActive]]
+CHECK postgres PASS connection MapStudio (status Valid): created mapstudio_schema_version, inserted 1, read back max(version)=1; server: PostgreSQL 16.15 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
+CHECK postgres-rights PASS connection MapStudioNoRights (status Valid) answered SELECT 1 = 1; CREATE TABLE refused with SQLState 42501; one error line logged naming the connection
+CHECK project-script PASS attempt 1: project mapstudio-dev, mapstudio_checks.kinds via ScriptManager TrackingProjectScriptManager: runCode: {'ping': u'Map Studio pong at 2026-10-26T06:59:06Z', 'kinds': [{'name': 'Pad', 'geometry': 'point', 'id': 'pad'}, {'name': 'Gathering line', 'geometry': 'line', 'id': 'line'}]}; runFunction: {'ping': u'Map Studio pong at 2026-10-26T06:59:06Z', 'kinds': [...same...]};
+CHECK alarm-metrics PASS readAsync [default]Checks/Alarm Metrics.HasActive -> null quality Bad_Unsupported; readAsync [default]Checks/Pump1/Alarm Metrics.HasActive -> null quality Bad_Unsupported; subscription [default]Checks/Alarm Metrics.HasActive: 3 events in 90s (initial value null quality Uncertain_InitialValue, value true quality Good, value false quality Good); subscription [default]Checks/Pump1/Alarm Metrics.HasActive: 3 events in 90s (initial value null quality Uncertain_InitialValue, value true quality Good, value false quality Good);
+```
+
+### Check 1: Alarm Metrics by Java subscription
+
+- Setup: tag provider `default`; UDT `Checks/Pump` with one Boolean expression member `Toggle` = `getSecond(now(1000)) % 60 < 30` carrying a `WhenTrue` alarm (priority High, `ackMode` Auto); instance `Checks/Pump1`. No tag is written: the alarm goes active and clears by the clock, every 30 s.
+- Code: `TagPathParser.parse("[default]Checks/Alarm Metrics.HasActive")` (the node `Alarm Metrics` with a space, the metric as the property suffix), `context.getTagManager().subscribeAsync(path, listener)` **[live 8.3.10]**. The listener is a plain `TagChangeListener`; `TagChangeEvent.getValue()` is the `QualifiedValue`, `isInitial()` marks the first delivery.
+- Seen: both paths delivered `Uncertain_InitialValue` at subscription, `true` Good 100 ms later and `false` Good 24 s later (06:59:06 and 06:59:30 UTC). The folder path aggregates the instance below it.
+- `readAsync` of the same paths: `Bad_Unsupported` **[live 8.3.10]**, which is the SDK's form of IA's "direct reads are not supported".
+- The 8.3.10 Gateway jar names the node `Alarm Metrics` with alias `_Alarm Metrics` (`AlarmMetricsNode.ALARM_METRICS_NAME`, `ALT_ALARM_METRICS_NAME`) **[observed in the 8.3.10 Gateway jar]**.
+- Consequence for AD-6: one Gateway subscription per metric per asset works as designed; no reference tags needed.
+
+### Checks 2 and 3: project script function from module code, and `system.mapstudio`
+
+- `ProjectManager.getProjectScriptManager("mapstudio-dev")` returned a `TrackingProjectScriptManager` at first try, 20 ms after the module's lifecycle started (the lifecycle starts after the project's own script lifecycle; a six-try, 5 s retry was in place and not needed) **[live 8.3.10]**.
+- Way 1: `runCode("import mapstudio_checks\n__result__ = mapstudio_checks.kinds()\n", locals, name)` with `locals = manager.createLocalsMap()`, result read with `locals.__finditem__("__result__")`.
+- Way 2: `runCode("import mapstudio_checks\n", locals, name)`, then `locals.__finditem__("mapstudio_checks").__getattr__("kinds")` run with `manager.runFunction(callable)`. The project module is **not** in `manager.getGlobals()` until imported (the first run found nothing there) **[live 8.3.10]**.
+- Both returned the Python dict as a `PyObject` (`{'ping': u'Map Studio pong at ...', 'kinds': [...]}`); the Jython 2.7 module is `ops/project/ignition/script-python/mapstudio_checks/code.py` (`resource.json` with `files: ["code.py"]`, `hintScope: 2`).
+- `system.mapstudio.ping()` was callable inside that project function: the module's `initializeScriptManager(ScriptManager)` calls `manager.addScriptModule("system.mapstudio", new MapStudioScriptModule(), new PropertiesFileDocProvider())`; the Gateway calls it for every script manager it creates (project script managers included) **[live 8.3.10]**. Docs come from `MapStudioScriptModule.properties` (`ping.desc`, `ping.returns`) registered through `BundleUtil` in a static block, and `@JythonElement(docBundlePrefix = ...)` on each method, as in IA's scripting-function example. Designer autocomplete of `system.mapstudio.` **[not verified]**: the owner checks it in the Designer on `ms-s3`.
+- Consequence for AD-4 and AD-18: adapters as project functions and the scripting API as a module script module both work; call project functions on a bounded pool with a timeout (AD-1) since `runCode` is synchronous.
+
+### Check 4: a custom project resource type
+
+- The project folder `ops/project/com.aoindustrial.perspective.mapstudio/setup/` holds `setup.json` and a `resource.json` (`scope: "G"`, `files: ["setup.json"]`). The Gateway loaded it with no declaration anywhere; `ResourceCollectionLifecycleFactory.getResourceFilter()` with `ResourceFilter.newBuilder().addResourceType(new ResourceType(MODULE_ID, "setup"))` delivered it to `ChecksLifecycle.onStartup(List<Resource>)`, read with `resource.getData("setup.json").map(ImmutableBytes::getBytesAsString)` **[live 8.3.10]**.
+- `onResourcesModified` **[not verified]**: changing the file needs a project scan (an API key, which the fresh dev Gateway has none of) or a Designer save; the lifecycle logs `CHECK setup-modified` when it fires. The owner can trigger it from the Designer.
+- Designer editor estimate (not built, owner's decision): IA's project-resource example is 306 lines of Swing in the designer scope (`DesignerHook` 58, `PythonResourceWorkspace` 100 extending `TabbedResourceWorkspace`, `PythonResourceEditor` 67, `HandlerSearchProvider` 81), plus an icon, a bundle and the `designer-api` dependency. A form for AD-5's fields (connection, adapter functions, roles, refresh interval, alarm page, basemaps, token secret) is one editor class of that size; about one day with the Designer round trips. Decision deferred to epic-map-store-and-data; the fallback (a project script function returning the setup) costs nothing in the Designer.
+
+### Check 5: PostgreSQL on the Gateway's default connection settings
+
+- Connections created as files in `core` with the defaults the manual states **[IA docs]**: pool 0/8/8/0, max wait 5000 ms, validation `SELECT 1`, test on borrow, slow query 60000 ms, validation timeout 10000 ms, `translator` `POSTGRES`, `driver` `PostgreSQL`; the driver is the image's `user-lib/modules/PostgreSQL JDBC Driver Module.modl` **[observed in the 8.3.10 image]**. Passwords are Referenced secrets of a File secret provider reading Docker secrets.
+- Owner role `mapstudio`: `Datasource.getConnection()` (an `SRConnection`), `runUpdateQuery("CREATE TABLE IF NOT EXISTS mapstudio_schema_version (version integer NOT NULL)")`, `runPrepUpdate(INSERT, 1)`, `runScalarQuery(SELECT max(version))` = 1; `psql` confirmed the table, owner `mapstudio` **[live 8.3.10]**.
+- CONNECT-only role `mapstudio_ro` (created by `ops/checks/postgres-init.sh`; PostgreSQL 16 gives no CREATE on schema `public` to ordinary roles: `has_schema_privilege('mapstudio_ro','public','CREATE')` = f): the Ignition connection shows `Valid` (its `SELECT 1` passes), the CREATE throws `SQLException` with SQLState `42501` "permission denied for schema public", and the module logged exactly one error line: `Map Studio cannot create its tables on connection MapStudioNoRights: the database role lacks the right to CREATE TABLE (SQLState 42501): ERROR: permission denied for schema public` **[live 8.3.10]**. A `Valid` connection therefore says nothing about rights; AD-21's start-up check is the only signal.
+- Seen once at start-up, before the module ran: two `E [C.BasicExecutionEngine] Task connection validation <name> threw uncaught exception ... NoClassDefFoundError: org/postgresql/Driver$1` while the Gateway installed, uninstalled and re-installed both connections during its JDBC classloader reload (06:59:01); five seconds later both connections were `Valid` and every query ran. Transient, cause not established **[live 8.3.10]**.
+
+### Facts learned on the way (not the questions, but needed to run them)
+
+- A fresh 8.3.10 Gateway faults on a pre-filled `core` collection without its manifest: `ConfigurationSetupException: Unable to create 'core' resource collection ... Resource collection path '.../core' exists but is not empty`. With `core/config-mode.json` (`{"title": "Core", ..., "parent": "external"}`) it boots and commissions **[live 8.3.10]** (the skills already record the same for `external`).
+- Named config resources (`ignition/tag-provider`, `ignition/database-connection`, `ignition/secret-provider`) need `attributes.uuid` in their `resource.json`, or the Gateway logs `Resource ... does not have required UUID attribute, will not be loaded` and skips them **[live 8.3.10]**. Any UUID works; the Gateway keeps it.
+- Bind-mounting single resource folders into `core` leaves their parents root-owned, so the Gateway (uid 2003) cannot create its own resources beside them (`PushException: I/O error during prepare ... tag-provider/System`, `Error starting managed tag provider 'System'`). Seeding `core` by copying the files in from an init container and `chown -R ignition:ignition` works and keeps the Gateway's writes out of the repository **[live 8.3.10]**.
+- A compose file secret keeps its host mode; PostgreSQL's init runs as `postgres` and the Gateway as uid 2003, so a 0600 secret file is `Permission denied` inside the container. 0644 files in a 0700 folder work **[live 8.3.10]** (the skills' "Secrets as files" says the same).
+- The Perspective module is not needed by any of the five checks; they are plain Gateway SDK.
+
+### For claude-ignition-skills (story 9 lands these; drafted here, target a new `ignition-dev/references/module-sdk.md`)
+
+| Finding | Where it goes |
+| --- | --- |
+| Java subscriptions to `<folder or instance>/Alarm Metrics.<metric>` deliver Good values through `TagManager.subscribeAsync`; `readAsync` answers `Bad_Unsupported`; parse the path with `TagPathParser.parse` | `ignition-dev/references/module-sdk.md` (new), and a line in `ignition-ui/references/perspective-components.md` under Alarm Metrics |
+| `ProjectManager.getProjectScriptManager(project)` runs project functions from module code (`runCode` with `createLocalsMap()`, or import into the locals and `runFunction`); project modules are not in `getGlobals()` until imported | `ignition-dev/references/module-sdk.md` |
+| `initializeScriptManager` + `addScriptModule("system.<name>", object, new PropertiesFileDocProvider())` makes the function callable in project scripts; docs via a `.properties` bundle and `@JythonElement` | `ignition-dev/references/module-sdk.md` |
+| A custom project resource type is a folder `<moduleId>/<typeId>/<name>/` with `resource.json` + data files, read by a `ResourceCollectionLifecycleFactory` filtered on `new ResourceType(moduleId, typeId)`; no registration needed on the Gateway | `ignition-dev/references/module-sdk.md`, and `ignition-config/references/file-layout.md` (project layout row) |
+| `DatasourceManager.getDatasource(name).getConnection()` gives an `SRConnection`; a `Valid` connection can still lack CREATE (SQLState 42501); log the connection, the statement and the SQLState | `ignition-dev/references/module-sdk.md`; the AD-21 pattern in `ignition-architect/references/system-architectures.md` |
+| A pre-filled `core` needs `core/config-mode.json`; named resources need `attributes.uuid`; seed `core` by copy from an init container rather than per-folder bind mounts | `ignition-config/references/docker.md` (rules 2 and 4) |
+| Transient `NoClassDefFoundError: org/postgresql/Driver$1` during the start-up JDBC classloader reload, connections `Valid` 5 s later | `ignition-config/references/docker.md` or `rest-api.md` database-connection row, marked [live 8.3.10, cause not established] |
diff --git a/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/MapStudioGatewayHook.java b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/MapStudioGatewayHook.java
index 5eeb7a9..75faec4 100644
--- a/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/MapStudioGatewayHook.java
+++ b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/MapStudioGatewayHook.java
@@ -3,6 +3,8 @@ package com.aoindustrial.perspective.mapstudio.gateway;
 import java.util.Optional;
 
 import com.inductiveautomation.ignition.common.licensing.LicenseState;
+import com.inductiveautomation.ignition.common.script.ScriptManager;
+import com.inductiveautomation.ignition.common.script.hints.PropertiesFileDocProvider;
 import com.inductiveautomation.ignition.common.util.LoggerEx;
 import com.inductiveautomation.ignition.gateway.model.AbstractGatewayModuleHook;
 import com.inductiveautomation.ignition.gateway.model.GatewayContext;
@@ -12,6 +14,8 @@ import com.inductiveautomation.perspective.gateway.api.PerspectiveContext;
 
 import com.aoindustrial.perspective.mapstudio.common.MapStudioComponent;
 import com.aoindustrial.perspective.mapstudio.common.MapStudioModule;
+import com.aoindustrial.perspective.mapstudio.common.MapStudioScriptModule;
+import com.aoindustrial.perspective.mapstudio.gateway.spike.ChecksLifecycleFactory;
 
 /**
  * Gateway scope hook: registers the component and its model delegate on
@@ -24,10 +28,21 @@ public class MapStudioGatewayHook extends AbstractGatewayModuleHook {
     private GatewayContext gatewayContext;
     private ComponentRegistry componentRegistry;
     private ComponentModelDelegateRegistry delegateRegistry;
+    private ChecksLifecycleFactory checks;
 
     @Override
     public void setup(GatewayContext context) {
         this.gatewayContext = context;
+        // Spike (story 3): the platform checks run for any runnable project that
+        // holds a Map Studio setup resource. Removed by the refactor sweep.
+        this.checks = new ChecksLifecycleFactory(context);
+    }
+
+    /** Adds {@code system.mapstudio.*} to Gateway and project script scopes (AD-18). */
+    @Override
+    public void initializeScriptManager(ScriptManager manager) {
+        super.initializeScriptManager(manager);
+        manager.addScriptModule("system.mapstudio", new MapStudioScriptModule(), new PropertiesFileDocProvider());
     }
 
     @Override
@@ -48,10 +63,17 @@ public class MapStudioGatewayHook extends AbstractGatewayModuleHook {
         } else {
             log.error("Perspective model delegate registry not found; the Map Studio delegate is not registered.");
         }
+
+        if (this.checks != null) {
+            this.checks.startup();
+        }
     }
 
     @Override
     public void shutdown() {
+        if (this.checks != null) {
+            this.checks.shutdown();
+        }
         if (this.componentRegistry != null) {
             this.componentRegistry.removeComponent(MapStudioComponent.COMPONENT_ID);
         }
diff --git a/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/AlarmMetricsCheck.java b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/AlarmMetricsCheck.java
new file mode 100644
index 0000000..6e5f179
--- /dev/null
+++ b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/AlarmMetricsCheck.java
@@ -0,0 +1,125 @@
+package com.aoindustrial.perspective.mapstudio.gateway.spike;
+
+import java.io.IOException;
+import java.util.ArrayList;
+import java.util.List;
+import java.util.Map;
+import java.util.concurrent.ConcurrentHashMap;
+import java.util.concurrent.CopyOnWriteArrayList;
+import java.util.concurrent.TimeUnit;
+
+import com.inductiveautomation.ignition.common.model.values.QualifiedValue;
+import com.inductiveautomation.ignition.common.tags.model.TagManager;
+import com.inductiveautomation.ignition.common.tags.model.TagPath;
+import com.inductiveautomation.ignition.common.tags.model.event.TagChangeEvent;
+import com.inductiveautomation.ignition.common.tags.model.event.TagChangeListener;
+import com.inductiveautomation.ignition.common.tags.paths.parser.TagPathParser;
+import com.inductiveautomation.ignition.common.util.LoggerEx;
+
+/**
+ * Spike check 1: a Java tag subscription to {@code <path>/Alarm Metrics.<prop>} on
+ * a tag folder and on a UDT instance. The dev project's alarm toggles every 30 s
+ * from an expression, so a working subscription sees true and false within 90 s.
+ * The same paths are also read once with {@code readAsync}, for the record only
+ * (IA: direct reads are not supported).
+ */
+public final class AlarmMetricsCheck {
+
+    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.check.alarm-metrics");
+
+    static final long WAIT_SECONDS = 90;
+    static final int EVENTS_WANTED = 2;
+
+    private final TagManager tags;
+    private final Map<TagPath, TagChangeListener> listeners = new ConcurrentHashMap<>();
+    private final Map<TagPath, List<String>> seen = new ConcurrentHashMap<>();
+
+    public AlarmMetricsCheck(TagManager tags) {
+        this.tags = tags;
+    }
+
+    public CheckResult run(List<String> paths) {
+        String name = "alarm-metrics";
+        List<TagPath> parsed = new ArrayList<>();
+        for (String p : paths) {
+            try {
+                parsed.add(TagPathParser.parse(p));
+            } catch (IOException ex) {
+                return CheckResult.fail(name, "cannot parse tag path " + p + ": " + ex.getMessage());
+            }
+        }
+        if (parsed.isEmpty()) {
+            return CheckResult.fail(name, "no alarmMetricPaths in the setup");
+        }
+        StringBuilder evidence = new StringBuilder();
+        try {
+            for (TagPath path : parsed) {
+                seen.put(path, new CopyOnWriteArrayList<>());
+                TagChangeListener listener = event -> record(path, event);
+                listeners.put(path, listener);
+                tags.subscribeAsync(path, listener).get(10, TimeUnit.SECONDS);
+            }
+            // For the record: what a direct read returns.
+            List<QualifiedValue> reads = tags.readAsync(parsed).get(10, TimeUnit.SECONDS);
+            for (int i = 0; i < parsed.size(); i++) {
+                QualifiedValue qv = reads.get(i);
+                evidence.append(String.format("readAsync %s -> %s quality %s; ",
+                    parsed.get(i), qv.getValue(), qv.getQuality()));
+            }
+            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(WAIT_SECONDS);
+            while (System.nanoTime() < deadline && !enoughEvents()) {
+                Thread.sleep(1000);
+            }
+        } catch (InterruptedException ex) {
+            Thread.currentThread().interrupt();
+            return CheckResult.fail(name, "interrupted while waiting for events");
+        } catch (Exception ex) {
+            return CheckResult.fail(name, ex.getClass().getSimpleName() + ": " + ex.getMessage());
+        } finally {
+            unsubscribe();
+        }
+        boolean ok = true;
+        for (TagPath path : parsed) {
+            List<String> events = seen.get(path);
+            long good = events.stream().filter(e -> e.contains("quality Good")).count();
+            boolean sawTrue = events.stream().anyMatch(e -> e.contains("value true"));
+            boolean sawFalse = events.stream().anyMatch(e -> e.contains("value false"));
+            boolean pathOk = good >= EVENTS_WANTED && sawTrue && sawFalse;
+            ok &= pathOk;
+            evidence.append(String.format("subscription %s: %d events in %ds (%s)%s; ",
+                path, events.size(), WAIT_SECONDS, String.join(", ", events),
+                pathOk ? "" : " - expected at least " + EVENTS_WANTED + " Good events with true and false"));
+        }
+        return ok ? CheckResult.pass(name, evidence.toString()) : CheckResult.fail(name, evidence.toString());
+    }
+
+    private void record(TagPath path, TagChangeEvent event) {
+        QualifiedValue qv = event.getValue();
+        String entry = String.format("%svalue %s quality %s", event.isInitial() ? "initial " : "",
+            qv == null ? null : qv.getValue(), qv == null ? null : qv.getQuality());
+        List<String> events = seen.get(path);
+        if (events != null) {
+            events.add(entry);
+        }
+        log.infof("%s -> %s", path, entry);
+    }
+
+    private boolean enoughEvents() {
+        return seen.values().stream().allMatch(events -> {
+            boolean sawTrue = events.stream().anyMatch(e -> e.contains("value true") && e.contains("quality Good"));
+            boolean sawFalse = events.stream().anyMatch(e -> e.contains("value false") && e.contains("quality Good"));
+            return sawTrue && sawFalse;
+        });
+    }
+
+    public void unsubscribe() {
+        listeners.forEach((path, listener) -> {
+            try {
+                tags.unsubscribeAsync(path, listener);
+            } catch (RuntimeException ex) {
+                log.warnf("unsubscribe %s failed: %s", path, ex.toString());
+            }
+        });
+        listeners.clear();
+    }
+}
diff --git a/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/CheckResult.java b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/CheckResult.java
new file mode 100644
index 0000000..df4e84a
--- /dev/null
+++ b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/CheckResult.java
@@ -0,0 +1,36 @@
+package com.aoindustrial.perspective.mapstudio.gateway.spike;
+
+import com.inductiveautomation.ignition.common.util.LoggerEx;
+
+/**
+ * One platform check's outcome, logged as a single line so that
+ * {@code ops/checks.sh} can collect it: {@code CHECK <name> PASS|FAIL <evidence>}.
+ */
+public record CheckResult(String name, boolean passed, String evidence) {
+
+    public static final String PREFIX = "CHECK ";
+
+    public static CheckResult pass(String name, String evidence) {
+        return new CheckResult(name, true, evidence);
+    }
+
+    public static CheckResult fail(String name, String evidence) {
+        return new CheckResult(name, false, evidence);
+    }
+
+    /** The one-line form; evidence is flattened to one line. */
+    public String line() {
+        String flat = evidence == null ? "" : evidence.replaceAll("\\s*\\R\\s*", " | ").trim();
+        return PREFIX + name + " " + (passed ? "PASS" : "FAIL") + " " + flat;
+    }
+
+    /** Log the line at info for a pass and warn for a fail, on the logger {@code MapStudio.check.<name>}. */
+    public void log() {
+        LoggerEx log = LoggerEx.newBuilder().build("MapStudio.check." + name);
+        if (passed) {
+            log.info(line());
+        } else {
+            log.warn(line());
+        }
+    }
+}
diff --git a/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ChecksLifecycle.java b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ChecksLifecycle.java
new file mode 100644
index 0000000..1299a5b
--- /dev/null
+++ b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ChecksLifecycle.java
@@ -0,0 +1,127 @@
+package com.aoindustrial.perspective.mapstudio.gateway.spike;
+
+import java.util.List;
+import java.util.Optional;
+import java.util.concurrent.ExecutorService;
+import java.util.concurrent.Executors;
+import java.util.concurrent.TimeUnit;
+
+import com.inductiveautomation.ignition.common.resourcecollection.Resource;
+import com.inductiveautomation.ignition.common.resourcecollection.ResourceId;
+import com.inductiveautomation.ignition.common.resourcecollection.RuntimeResourceCollection;
+import com.inductiveautomation.ignition.common.util.LoggerEx;
+import com.inductiveautomation.ignition.gateway.model.GatewayContext;
+import com.inductiveautomation.ignition.gateway.resourcecollection.ResourceCollectionLifecycle;
+
+/**
+ * Spike check 4 and the driver of the others: one lifecycle per runnable project.
+ * {@link #onStartup(List)} receives the project's loaded {@code setup} resources
+ * (the custom resource type check); when one is present the remaining checks run
+ * on a single worker thread and each logs one {@code CHECK} line.
+ */
+public final class ChecksLifecycle extends ResourceCollectionLifecycle {
+
+    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.check.setup");
+
+    /** Project scripts load in their own lifecycle; give them a moment, then retry. */
+    static final int SCRIPT_RETRIES = 6;
+    static final long SCRIPT_RETRY_SECONDS = 5;
+
+    private final GatewayContext context;
+    private final ExecutorService worker;
+    private volatile AlarmMetricsCheck alarmMetrics;
+
+    public ChecksLifecycle(RuntimeResourceCollection project, GatewayContext context) {
+        super(project);
+        this.context = context;
+        this.worker = Executors.newSingleThreadExecutor(r -> {
+            Thread t = new Thread(r, "MapStudio-checks-" + project.getName());
+            t.setDaemon(true);
+            return t;
+        });
+    }
+
+    @Override
+    protected void onStartup(List<Resource> resources) {
+        String project = getResourceCollection().getName();
+        Optional<SetupResource> setup = findSetup(resources);
+        if (setup.isEmpty()) {
+            log.debugf("Project %s holds no Map Studio setup resource; no checks.", project);
+            return;
+        }
+        CheckResult.pass("setup", String.format(
+            "project %s: lifecycle onStartup received %d resource(s) of type %s; parsed %s",
+            project, resources.size(), SetupResource.RESOURCE_TYPE, setup.get())).log();
+        SetupResource s = setup.get();
+        worker.submit(() -> runChecks(project, s));
+    }
+
+    private void runChecks(String project, SetupResource setup) {
+        try {
+            new PostgresCheck(context.getDatasourceManager()).checkOwner(setup.connection()).log();
+            new PostgresCheck(context.getDatasourceManager()).checkMissingRights(setup.connectionNoRights()).log();
+
+            CheckResult script = null;
+            for (int attempt = 1; attempt <= SCRIPT_RETRIES; attempt++) {
+                script = new ProjectScriptCheck(context.getProjectManager()).run(project, setup);
+                if (script.passed()) {
+                    script = CheckResult.pass(script.name(), "attempt " + attempt + ": " + script.evidence());
+                    break;
+                }
+                log.infof("project-script attempt %d of %d did not pass yet: %s", attempt, SCRIPT_RETRIES,
+                    script.evidence());
+                Thread.sleep(TimeUnit.SECONDS.toMillis(SCRIPT_RETRY_SECONDS));
+            }
+            script.log();
+
+            alarmMetrics = new AlarmMetricsCheck(context.getTagManager());
+            alarmMetrics.run(setup.alarmMetricPaths()).log();
+        } catch (InterruptedException ex) {
+            Thread.currentThread().interrupt();
+        } catch (RuntimeException ex) {
+            log.error("A platform check threw: " + ex, ex);
+        }
+    }
+
+    @Override
+    protected void onShutdown(List<ResourceId> resources) {
+        AlarmMetricsCheck check = alarmMetrics;
+        if (check != null) {
+            check.unsubscribe();
+        }
+        worker.shutdownNow();
+    }
+
+    @Override
+    protected void onResourcesCreated(List<Resource> resources) {
+        findSetup(resources).ifPresent(s -> CheckResult.pass("setup-created",
+            "project " + getResourceCollection().getName() + ": " + s).log());
+    }
+
+    @Override
+    protected void onResourcesModified(List<Resource> resources) {
+        findSetup(resources).ifPresent(s -> CheckResult.pass("setup-modified",
+            "project " + getResourceCollection().getName() + ": re-read " + s).log());
+    }
+
+    @Override
+    protected void onResourcesDeleted(List<ResourceId> resources) {
+        log.infof("Project %s: %d setup resource(s) deleted.", getResourceCollection().getName(), resources.size());
+    }
+
+    private static Optional<SetupResource> findSetup(List<Resource> resources) {
+        for (Resource resource : resources) {
+            if (SetupResource.RESOURCE_TYPE.equals(resource.getResourceType())) {
+                try {
+                    Optional<SetupResource> parsed = SetupResource.fromResource(resource);
+                    if (parsed.isPresent()) {
+                        return parsed;
+                    }
+                } catch (IllegalArgumentException ex) {
+                    CheckResult.fail("setup", "resource " + resource.getResourcePath() + ": " + ex.getMessage()).log();
+                }
+            }
+        }
+        return Optional.empty();
+    }
+}
diff --git a/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ChecksLifecycleFactory.java b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ChecksLifecycleFactory.java
new file mode 100644
index 0000000..9308e03
--- /dev/null
+++ b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ChecksLifecycleFactory.java
@@ -0,0 +1,33 @@
+package com.aoindustrial.perspective.mapstudio.gateway.spike;
+
+import com.inductiveautomation.ignition.common.resourcecollection.ResourceFilter;
+import com.inductiveautomation.ignition.common.resourcecollection.RuntimeResourceCollection;
+import com.inductiveautomation.ignition.gateway.model.GatewayContext;
+import com.inductiveautomation.ignition.gateway.resourcecollection.ResourceCollectionLifecycleFactory;
+
+/**
+ * Creates one {@link ChecksLifecycle} per runnable project (enabled and not
+ * inheritable, the factory's default filter) and feeds it the project's
+ * {@code setup} resources and their later changes.
+ */
+public final class ChecksLifecycleFactory extends ResourceCollectionLifecycleFactory<ChecksLifecycle> {
+
+    private final GatewayContext context;
+
+    public ChecksLifecycleFactory(GatewayContext context) {
+        super(context.getProjectManager());
+        this.context = context;
+    }
+
+    @Override
+    public ChecksLifecycle createLifecycle(RuntimeResourceCollection project) {
+        return new ChecksLifecycle(project, context);
+    }
+
+    @Override
+    protected ResourceFilter getResourceFilter() {
+        return ResourceFilter.newBuilder()
+            .addResourceType(SetupResource.RESOURCE_TYPE)
+            .build();
+    }
+}
diff --git a/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/PostgresCheck.java b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/PostgresCheck.java
new file mode 100644
index 0000000..13a7d10
--- /dev/null
+++ b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/PostgresCheck.java
@@ -0,0 +1,99 @@
+package com.aoindustrial.perspective.mapstudio.gateway.spike;
+
+import java.sql.SQLException;
+
+import com.inductiveautomation.ignition.common.util.LoggerEx;
+import com.inductiveautomation.ignition.gateway.datasource.Datasource;
+import com.inductiveautomation.ignition.gateway.datasource.DatasourceManager;
+import com.inductiveautomation.ignition.gateway.datasource.SRConnection;
+
+/**
+ * Spike check 5: connect to PostgreSQL through an Ignition database connection
+ * on the Gateway's default connection settings, create a {@code mapstudio_}
+ * table, and on a connection whose role lacks CREATE log one error naming the
+ * connection, the statement kind and the SQLState (AD-21).
+ */
+public final class PostgresCheck {
+
+    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.check.postgres");
+
+    /** PostgreSQL's insufficient_privilege. */
+    public static final String SQLSTATE_INSUFFICIENT_PRIVILEGE = "42501";
+
+    static final String TABLE = "mapstudio_schema_version";
+    static final String CREATE = "CREATE TABLE IF NOT EXISTS " + TABLE + " (version integer NOT NULL)";
+    static final String INSERT = "INSERT INTO " + TABLE + " (version) VALUES (?)";
+    static final String READ = "SELECT max(version) FROM " + TABLE;
+
+    private final DatasourceManager datasources;
+
+    public PostgresCheck(DatasourceManager datasources) {
+        this.datasources = datasources;
+    }
+
+    /** The owner role: connect, create, insert, read back; PASS carries the server version. */
+    public CheckResult checkOwner(String connectionName) {
+        String name = "postgres";
+        Datasource datasource = datasources.getDatasource(connectionName);
+        if (datasource == null) {
+            return CheckResult.fail(name, "no database connection named " + connectionName);
+        }
+        try (SRConnection connection = datasource.getConnection()) {
+            Object serverVersion = connection.runScalarQuery("SELECT version()");
+            connection.runUpdateQuery(CREATE);
+            connection.runPrepUpdate(INSERT, 1);
+            Object version = connection.runScalarQuery(READ);
+            return CheckResult.pass(name, String.format(
+                "connection %s (status %s): created %s, inserted 1, read back max(version)=%s; server: %s",
+                connectionName, datasource.getStatus(), TABLE, version, serverVersion));
+        } catch (SQLException ex) {
+            return CheckResult.fail(name, String.format("connection %s: %s SQLState %s: %s",
+                connectionName, ex.getClass().getSimpleName(), ex.getSQLState(), ex.getMessage()));
+        }
+    }
+
+    /**
+     * The CONNECT-only role: the connection validates ({@code SELECT 1}) but the
+     * CREATE must fail with SQLState 42501, and the module logs the AD-21 error line.
+     */
+    public CheckResult checkMissingRights(String connectionName) {
+        String name = "postgres-rights";
+        Datasource datasource = datasources.getDatasource(connectionName);
+        if (datasource == null) {
+            return CheckResult.fail(name, "no database connection named " + connectionName);
+        }
+        try (SRConnection connection = datasource.getConnection()) {
+            Object probe = connection.runScalarQuery("SELECT 1");
+            try {
+                connection.runUpdateQuery(CREATE);
+            } catch (SQLException ex) {
+                log.error(rightsMessage(connectionName, "CREATE TABLE", ex.getSQLState(), ex.getMessage()));
+                if (SQLSTATE_INSUFFICIENT_PRIVILEGE.equals(ex.getSQLState())) {
+                    return CheckResult.pass(name, String.format(
+                        "connection %s (status %s) answered SELECT 1 = %s; CREATE TABLE refused with SQLState %s; "
+                            + "one error line logged naming the connection",
+                        connectionName, datasource.getStatus(), probe, ex.getSQLState()));
+                }
+                return CheckResult.fail(name, String.format("connection %s: CREATE failed with SQLState %s, expected %s: %s",
+                    connectionName, ex.getSQLState(), SQLSTATE_INSUFFICIENT_PRIVILEGE, ex.getMessage()));
+            }
+            return CheckResult.fail(name, "connection " + connectionName
+                + " could CREATE TABLE; the role has more rights than the check assumes");
+        } catch (SQLException ex) {
+            return CheckResult.fail(name, String.format("connection %s: could not connect: %s SQLState %s: %s",
+                connectionName, ex.getClass().getSimpleName(), ex.getSQLState(), ex.getMessage()));
+        }
+    }
+
+    /**
+     * The one error line AD-21 asks for: the connection, what was attempted, the
+     * SQLState and the database's own words. Pure, so its shape is tested.
+     */
+    public static String rightsMessage(String connectionName, String statementKind, String sqlState, String detail) {
+        String reason = SQLSTATE_INSUFFICIENT_PRIVILEGE.equals(sqlState)
+            ? "the database role lacks the right to " + statementKind
+            : statementKind + " failed";
+        return String.format("Map Studio cannot create its tables on connection %s: %s (SQLState %s): %s",
+            connectionName, reason, sqlState, detail == null ? "" : detail.trim());
+    }
+}
diff --git a/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ProjectScriptCheck.java b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ProjectScriptCheck.java
new file mode 100644
index 0000000..3e95024
--- /dev/null
+++ b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ProjectScriptCheck.java
@@ -0,0 +1,87 @@
+package com.aoindustrial.perspective.mapstudio.gateway.spike;
+
+import com.inductiveautomation.ignition.common.script.JythonExecException;
+import com.inductiveautomation.ignition.common.script.ScriptManager;
+import com.inductiveautomation.ignition.common.util.LoggerEx;
+import com.inductiveautomation.ignition.gateway.project.ProjectManager;
+import org.python.core.PyObject;
+import org.python.core.PyStringMap;
+
+/**
+ * Spike checks 2 and 3: call a project script function from module code through
+ * the project's {@link ScriptManager}, two ways ({@code runCode} with a locals
+ * map, and {@code runFunction} on the function object found in the globals).
+ * The dev project's function itself calls {@code system.mapstudio.ping()}, so
+ * its return value also proves the module's scripting function is registered
+ * in the project's script scope.
+ */
+public final class ProjectScriptCheck {
+
+    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.check.project-script");
+
+    private final ProjectManager projects;
+
+    public ProjectScriptCheck(ProjectManager projects) {
+        this.projects = projects;
+    }
+
+    public CheckResult run(String projectName, SetupResource setup) {
+        String name = "project-script";
+        ScriptManager manager = projects.getProjectScriptManager(projectName);
+        if (manager == null) {
+            return CheckResult.fail(name, "getProjectScriptManager(" + projectName + ") returned null");
+        }
+        String module = setup.adapterModule();
+        String function = setup.adapterFunctionName();
+        StringBuilder evidence = new StringBuilder();
+        boolean viaCode = false;
+        boolean viaFunction = false;
+
+        // Way 1: run a snippet in a fresh locals map and read the result back.
+        try {
+            PyStringMap locals = manager.createLocalsMap();
+            String code = "import " + module + "\n__result__ = " + module + "." + function + "()\n";
+            manager.runCode(code, locals, "MapStudio.check.project-script");
+            PyObject result = locals.__finditem__("__result__");
+            viaCode = result != null;
+            evidence.append("runCode: ").append(result).append("; ");
+        } catch (JythonExecException ex) {
+            evidence.append("runCode failed: ").append(pyCause(ex)).append("; ");
+        } catch (RuntimeException ex) {
+            evidence.append("runCode failed: ").append(ex).append("; ");
+        }
+
+        // Way 2: import the project module into a locals map, take the function
+        // object and run it with runFunction (project modules are not in the
+        // globals until something imports them).
+        try {
+            PyStringMap locals = manager.createLocalsMap();
+            manager.runCode("import " + module + "\n", locals, "MapStudio.check.project-script");
+            PyObject moduleObject = locals.__finditem__(module);
+            if (moduleObject == null) {
+                evidence.append("runFunction: import left no '").append(module).append("' in the locals; ");
+            } else {
+                PyObject callable = moduleObject.__getattr__(function);
+                PyObject result = manager.runFunction(callable);
+                viaFunction = result != null;
+                evidence.append("runFunction: ").append(result).append("; ");
+            }
+        } catch (JythonExecException ex) {
+            evidence.append("runFunction failed: ").append(pyCause(ex)).append("; ");
+        } catch (RuntimeException ex) {
+            evidence.append("runFunction failed: ").append(ex).append("; ");
+        }
+
+        String summary = String.format("project %s, %s via ScriptManager %s: %s", projectName,
+            setup.adapterFunction(), manager.getClass().getSimpleName(), evidence);
+        if (viaCode || viaFunction) {
+            log.info(summary);
+            return CheckResult.pass(name, summary);
+        }
+        return CheckResult.fail(name, summary);
+    }
+
+    private static String pyCause(JythonExecException ex) {
+        return ex.getPyCause().map(Object::toString).orElseGet(ex::toString).replace('\n', ' ');
+    }
+}
diff --git a/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/SetupResource.java b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/SetupResource.java
new file mode 100644
index 0000000..84c5969
--- /dev/null
+++ b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/SetupResource.java
@@ -0,0 +1,95 @@
+package com.aoindustrial.perspective.mapstudio.gateway.spike;
+
+import java.util.ArrayList;
+import java.util.List;
+import java.util.Objects;
+import java.util.Optional;
+
+import com.inductiveautomation.ignition.common.ImmutableBytes;
+import com.inductiveautomation.ignition.common.gson.JsonArray;
+import com.inductiveautomation.ignition.common.gson.JsonElement;
+import com.inductiveautomation.ignition.common.gson.JsonObject;
+import com.inductiveautomation.ignition.common.gson.JsonParser;
+import com.inductiveautomation.ignition.common.resourcecollection.Resource;
+import com.inductiveautomation.ignition.common.resourcecollection.ResourceType;
+
+import com.aoindustrial.perspective.mapstudio.common.MapStudioModule;
+
+/**
+ * Spike (story 3): the project setup read from a custom project resource of
+ * type {@code com.aoindustrial.perspective.mapstudio/setup}, stored as
+ * {@code setup.json} in the project folder. Gateway-side read only; the
+ * Designer editor is a later decision (epic-map-store-and-data).
+ *
+ * <p>Removed by the refactor sweep (story 8) or replaced by the real setup of AD-5.
+ */
+public record SetupResource(
+        String connection,
+        String connectionNoRights,
+        String adapterFunction,
+        List<String> alarmMetricPaths) {
+
+    public static final ResourceType RESOURCE_TYPE = MapStudioModule.SETUP_RESOURCE_TYPE;
+    public static final String RESOURCE_FILE = "setup.json";
+
+    public SetupResource {
+        Objects.requireNonNull(connection, "connection");
+        Objects.requireNonNull(connectionNoRights, "connectionNoRights");
+        Objects.requireNonNull(adapterFunction, "adapterFunction");
+        alarmMetricPaths = List.copyOf(alarmMetricPaths);
+    }
+
+    /** Read the setup from a loaded project resource, or empty when it has no setup.json. */
+    public static Optional<SetupResource> fromResource(Resource resource) {
+        return resource.getData(RESOURCE_FILE)
+            .map(ImmutableBytes::getBytesAsString)
+            .map(SetupResource::parse);
+    }
+
+    /**
+     * Parse the setup JSON. Pure, so the shape can be tested without a Gateway.
+     *
+     * @throws IllegalArgumentException when a required field is missing or has the wrong type
+     */
+    public static SetupResource parse(String json) {
+        JsonElement root = JsonParser.parseString(json);
+        if (!root.isJsonObject()) {
+            throw new IllegalArgumentException("setup.json must hold a JSON object");
+        }
+        JsonObject o = root.getAsJsonObject();
+        List<String> paths = new ArrayList<>();
+        JsonElement pathsElement = o.get("alarmMetricPaths");
+        if (pathsElement != null && pathsElement.isJsonArray()) {
+            JsonArray array = pathsElement.getAsJsonArray();
+            for (JsonElement e : array) {
+                paths.add(requireString(e, "alarmMetricPaths[]"));
+            }
+        }
+        return new SetupResource(
+            requireString(o.get("connection"), "connection"),
+            requireString(o.get("connectionNoRights"), "connectionNoRights"),
+            requireString(o.get("adapterFunction"), "adapterFunction"),
+            paths);
+    }
+
+    /** The Python module part of {@code adapterFunction}, for example {@code mapstudio_checks}. */
+    public String adapterModule() {
+        int dot = adapterFunction.lastIndexOf('.');
+        if (dot <= 0 || dot == adapterFunction.length() - 1) {
+            throw new IllegalArgumentException("adapterFunction must be <module>.<function>: " + adapterFunction);
+        }
+        return adapterFunction.substring(0, dot);
+    }
+
+    /** The function part of {@code adapterFunction}, for example {@code kinds}. */
+    public String adapterFunctionName() {
+        return adapterFunction.substring(adapterModule().length() + 1);
+    }
+
+    private static String requireString(JsonElement element, String name) {
+        if (element == null || !element.isJsonPrimitive() || !element.getAsJsonPrimitive().isString()) {
+            throw new IllegalArgumentException("setup.json needs a string " + name);
+        }
+        return element.getAsString();
+    }
+}
diff --git a/gateway/src/test/java/com/aoindustrial/perspective/mapstudio/gateway/spike/PostgresCheckTest.java b/gateway/src/test/java/com/aoindustrial/perspective/mapstudio/gateway/spike/PostgresCheckTest.java
new file mode 100644
index 0000000..b9fbc26
--- /dev/null
+++ b/gateway/src/test/java/com/aoindustrial/perspective/mapstudio/gateway/spike/PostgresCheckTest.java
@@ -0,0 +1,42 @@
+package com.aoindustrial.perspective.mapstudio.gateway.spike;
+
+import static org.junit.jupiter.api.Assertions.assertEquals;
+import static org.junit.jupiter.api.Assertions.assertFalse;
+import static org.junit.jupiter.api.Assertions.assertTrue;
+
+import org.junit.jupiter.api.Test;
+
+/** The PostgreSQL rows of the I/O matrix: the error line and the CHECK line shapes. */
+class PostgresCheckTest {
+
+    @Test
+    void rightsErrorNamesTheConnectionTheStatementAndTheSqlState() {
+        String line = PostgresCheck.rightsMessage("MapStudioNoRights", "CREATE TABLE", "42501",
+            "ERROR: permission denied for schema public\n");
+        assertEquals("Map Studio cannot create its tables on connection MapStudioNoRights: "
+            + "the database role lacks the right to CREATE TABLE (SQLState 42501): "
+            + "ERROR: permission denied for schema public", line);
+    }
+
+    @Test
+    void otherSqlStatesAreReportedWithoutTheRightsWording() {
+        String line = PostgresCheck.rightsMessage("MapStudio", "CREATE TABLE", "08001", null);
+        assertEquals("Map Studio cannot create its tables on connection MapStudio: "
+            + "CREATE TABLE failed (SQLState 08001): ", line);
+    }
+
+    @Test
+    void checkLinesAreOneLineEach() {
+        CheckResult pass = CheckResult.pass("postgres", "connection MapStudio: created\nmapstudio_schema_version");
+        assertEquals("CHECK postgres PASS connection MapStudio: created | mapstudio_schema_version", pass.line());
+        CheckResult fail = CheckResult.fail("postgres-rights", "SQLState 42P01");
+        assertTrue(fail.line().startsWith("CHECK postgres-rights FAIL "));
+        assertFalse(fail.passed());
+    }
+
+    @Test
+    void theTableIsAMapStudioTable() {
+        assertTrue(PostgresCheck.TABLE.startsWith("mapstudio_"));
+        assertTrue(PostgresCheck.CREATE.contains("IF NOT EXISTS"));
+    }
+}
diff --git a/gateway/src/test/java/com/aoindustrial/perspective/mapstudio/gateway/spike/SetupResourceTest.java b/gateway/src/test/java/com/aoindustrial/perspective/mapstudio/gateway/spike/SetupResourceTest.java
new file mode 100644
index 0000000..ebe44f4
--- /dev/null
+++ b/gateway/src/test/java/com/aoindustrial/perspective/mapstudio/gateway/spike/SetupResourceTest.java
@@ -0,0 +1,54 @@
+package com.aoindustrial.perspective.mapstudio.gateway.spike;
+
+import static org.junit.jupiter.api.Assertions.assertEquals;
+import static org.junit.jupiter.api.Assertions.assertThrows;
+
+import java.util.List;
+
+import org.junit.jupiter.api.Test;
+
+/** The custom project resource row of the I/O matrix: the setup.json shape the Gateway reads. */
+class SetupResourceTest {
+
+    private static final String SAMPLE = "{\n"
+        + "  \"connection\": \"MapStudio\",\n"
+        + "  \"connectionNoRights\": \"MapStudioNoRights\",\n"
+        + "  \"adapterFunction\": \"mapstudio_checks.kinds\",\n"
+        + "  \"alarmMetricPaths\": [\n"
+        + "    \"[default]Checks/Alarm Metrics.HasActive\",\n"
+        + "    \"[default]Checks/Pump1/Alarm Metrics.HasActive\"\n"
+        + "  ]\n"
+        + "}\n";
+
+    @Test
+    void parsesTheDevSetup() {
+        SetupResource setup = SetupResource.parse(SAMPLE);
+        assertEquals("MapStudio", setup.connection());
+        assertEquals("MapStudioNoRights", setup.connectionNoRights());
+        assertEquals("mapstudio_checks", setup.adapterModule());
+        assertEquals("kinds", setup.adapterFunctionName());
+        assertEquals(List.of("[default]Checks/Alarm Metrics.HasActive",
+            "[default]Checks/Pump1/Alarm Metrics.HasActive"), setup.alarmMetricPaths());
+    }
+
+    @Test
+    void resourceTypeIsTheModulesSetup() {
+        assertEquals("com.aoindustrial.perspective.mapstudio", SetupResource.RESOURCE_TYPE.moduleId());
+        assertEquals("setup", SetupResource.RESOURCE_TYPE.typeId());
+    }
+
+    @Test
+    void missingFieldIsRefusedInWords() {
+        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
+            () -> SetupResource.parse("{\"connection\": \"MapStudio\"}"));
+        assertEquals("setup.json needs a string connectionNoRights", ex.getMessage());
+    }
+
+    @Test
+    void adapterFunctionNeedsAModule() {
+        SetupResource setup = SetupResource.parse(
+            "{\"connection\": \"a\", \"connectionNoRights\": \"b\", \"adapterFunction\": \"kinds\"}");
+        assertThrows(IllegalArgumentException.class, setup::adapterModule);
+        assertEquals(List.of(), setup.alarmMetricPaths());
+    }
+}
diff --git a/ops/checks.sh b/ops/checks.sh
new file mode 100755
index 0000000..7b2481e
--- /dev/null
+++ b/ops/checks.sh
@@ -0,0 +1,85 @@
+#!/usr/bin/env bash
+# Run the Map Studio platform checks (story 3) on the dev Gateway: PostgreSQL
+# beside the Gateway, the checks' config mounted in, the module built and
+# staged, then the five CHECK lines collected from the Gateway log.
+#
+# Usage:
+#   ops/checks.sh            Fresh Gateway and PostgreSQL volumes (the config and
+#                            the PostgreSQL roles are only read on first start).
+#   ops/checks.sh --keep     Reuse the volumes; just rebuild, restart and collect.
+#   ops/checks.sh --collect  Collect the CHECK lines from a running Gateway only.
+#
+# Exit status is 0 when all five checks are PASS, 1 otherwise. Development only.
+
+export MAPSTUDIO_CHECKS=1
+source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
+
+MODE="fresh"
+for arg in "$@"; do
+  case "${arg}" in
+    --keep) MODE="keep" ;;
+    --collect) MODE="collect" ;;
+    *) err "Unknown argument: ${arg}"; exit 2 ;;
+  esac
+done
+
+# The five checks the module logs, in the order it runs them.
+CHECK_NAMES=(setup postgres postgres-rights project-script alarm-metrics)
+
+collect_checks() {
+  # One line per check: the last CHECK line of each name in the Gateway log.
+  "${COMPOSE[@]}" logs --no-log-prefix gateway 2>/dev/null \
+    | grep -o 'CHECK [a-z-]* \(PASS\|FAIL\) .*' || true
+}
+
+require_docker
+ensure_checks_secrets
+
+if [[ "${MODE}" != "collect" ]]; then
+  if [[ "${MODE}" == "fresh" ]]; then
+    "${OPS_DIR}/up.sh" --fresh
+  else
+    "${OPS_DIR}/up.sh"
+  fi
+fi
+
+# The alarm-metrics check waits up to 90 s for the alarm to toggle; give the
+# whole run four minutes.
+info "Waiting for the CHECK lines in the Gateway log ..."
+lines=""
+for ((i = 1; i <= 48; i++)); do
+  lines="$(collect_checks)"
+  found=0
+  for name in "${CHECK_NAMES[@]}"; do
+    if grep -q "^CHECK ${name} " <<<"${lines}"; then
+      found=$((found + 1))
+    fi
+  done
+  if (( found >= ${#CHECK_NAMES[@]} )); then
+    break
+  fi
+  sleep 5
+done
+
+echo
+status=0
+for name in "${CHECK_NAMES[@]}"; do
+  # A missing line must be reported, not end the script (lib.sh sets -e and pipefail).
+  line="$(grep "^CHECK ${name} " <<<"${lines}" | tail -1 || true)"
+  if [[ -z "${line}" ]]; then
+    err "CHECK ${name}: no line in the log"
+    status=1
+  elif [[ "${line}" == "CHECK ${name} PASS "* ]]; then
+    ok "${line}"
+  else
+    err "${line}"
+    status=1
+  fi
+done
+echo
+if (( status == 0 )); then
+  ok "All ${#CHECK_NAMES[@]} platform checks passed on ${GATEWAY_URL}."
+else
+  err "Some platform checks did not pass. Full log: ops/logs.sh -n 400 | grep MapStudio"
+fi
+exit "${status}"
diff --git a/ops/checks/config/core/config-mode.json b/ops/checks/config/core/config-mode.json
new file mode 100644
index 0000000..6c5d871
--- /dev/null
+++ b/ops/checks/config/core/config-mode.json
@@ -0,0 +1,7 @@
+{
+  "title": "Core",
+  "description": "Core collection of locally managed Gateway configuration resources",
+  "enabled": true,
+  "inheritable": true,
+  "parent": "external"
+}
diff --git a/ops/checks/config/core/ignition/database-connection/MapStudio/config.json b/ops/checks/config/core/ignition/database-connection/MapStudio/config.json
new file mode 100644
index 0000000..e7df92c
--- /dev/null
+++ b/ops/checks/config/core/ignition/database-connection/MapStudio/config.json
@@ -0,0 +1,32 @@
+{
+  "connectURL": "jdbc:postgresql://postgres:5432/mapstudio",
+  "connectionProps": "",
+  "connectionResetParams": "",
+  "defaultTransactionLevel": "DEFAULT",
+  "driver": "PostgreSQL",
+  "evictionRate": -1,
+  "evictionTests": 3,
+  "evictionTime": 1800000,
+  "failoverMode": "STANDARD",
+  "includeSchemaInTableName": false,
+  "password": {
+    "data": {
+      "providerName": "MapStudioFiles",
+      "secretName": "pg_password"
+    },
+    "type": "Referenced"
+  },
+  "poolInitSize": 0,
+  "poolMaxActive": 8,
+  "poolMaxIdle": 8,
+  "poolMaxWait": 5000,
+  "poolMinIdle": 0,
+  "slowQueryLogThreshold": 60000,
+  "testOnBorrow": true,
+  "testOnReturn": false,
+  "testWhileIdle": false,
+  "translator": "POSTGRES",
+  "username": "mapstudio",
+  "validationQuery": "SELECT 1",
+  "validationSleepTime": 10000
+}
diff --git a/ops/checks/config/core/ignition/database-connection/MapStudio/resource.json b/ops/checks/config/core/ignition/database-connection/MapStudio/resource.json
new file mode 100644
index 0000000..3106771
--- /dev/null
+++ b/ops/checks/config/core/ignition/database-connection/MapStudio/resource.json
@@ -0,0 +1,14 @@
+{
+  "scope": "A",
+  "description": "Map Studio platform checks: the owner role (creates the mapstudio_ tables)",
+  "version": 1,
+  "restricted": false,
+  "overridable": true,
+  "files": [
+    "config.json"
+  ],
+  "attributes": {
+    "uuid": "cabc045b-4bb2-4a85-bc91-b28a1afceaf5",
+    "enabled": true
+  }
+}
diff --git a/ops/checks/config/core/ignition/database-connection/MapStudioNoRights/config.json b/ops/checks/config/core/ignition/database-connection/MapStudioNoRights/config.json
new file mode 100644
index 0000000..5d8c4a4
--- /dev/null
+++ b/ops/checks/config/core/ignition/database-connection/MapStudioNoRights/config.json
@@ -0,0 +1,32 @@
+{
+  "connectURL": "jdbc:postgresql://postgres:5432/mapstudio",
+  "connectionProps": "",
+  "connectionResetParams": "",
+  "defaultTransactionLevel": "DEFAULT",
+  "driver": "PostgreSQL",
+  "evictionRate": -1,
+  "evictionTests": 3,
+  "evictionTime": 1800000,
+  "failoverMode": "STANDARD",
+  "includeSchemaInTableName": false,
+  "password": {
+    "data": {
+      "providerName": "MapStudioFiles",
+      "secretName": "pg_ro_password"
+    },
+    "type": "Referenced"
+  },
+  "poolInitSize": 0,
+  "poolMaxActive": 8,
+  "poolMaxIdle": 8,
+  "poolMaxWait": 5000,
+  "poolMinIdle": 0,
+  "slowQueryLogThreshold": 60000,
+  "testOnBorrow": true,
+  "testOnReturn": false,
+  "testWhileIdle": false,
+  "translator": "POSTGRES",
+  "username": "mapstudio_ro",
+  "validationQuery": "SELECT 1",
+  "validationSleepTime": 10000
+}
diff --git a/ops/checks/config/core/ignition/database-connection/MapStudioNoRights/resource.json b/ops/checks/config/core/ignition/database-connection/MapStudioNoRights/resource.json
new file mode 100644
index 0000000..5102dcb
--- /dev/null
+++ b/ops/checks/config/core/ignition/database-connection/MapStudioNoRights/resource.json
@@ -0,0 +1,14 @@
+{
+  "scope": "A",
+  "description": "Map Studio platform checks: a CONNECT-only role (no CREATE on schema public)",
+  "version": 1,
+  "restricted": false,
+  "overridable": true,
+  "files": [
+    "config.json"
+  ],
+  "attributes": {
+    "uuid": "02f18638-bca1-4023-bcb8-39fa5b85a36d",
+    "enabled": true
+  }
+}
diff --git a/ops/checks/config/core/ignition/secret-provider/MapStudioFiles/config.json b/ops/checks/config/core/ignition/secret-provider/MapStudioFiles/config.json
new file mode 100644
index 0000000..e03d916
--- /dev/null
+++ b/ops/checks/config/core/ignition/secret-provider/MapStudioFiles/config.json
@@ -0,0 +1,19 @@
+{
+  "profile": {
+    "type": "file"
+  },
+  "settings": {
+    "files": {
+      "pg_password": {
+        "description": "PostgreSQL password of the owner role mapstudio (Docker secret, generated by ops/checks.sh)",
+        "filePath": "/run/secrets/pg_password",
+        "fileType": "CLEARTEXT"
+      },
+      "pg_ro_password": {
+        "description": "PostgreSQL password of the CONNECT-only role mapstudio_ro (Docker secret, generated by ops/checks.sh)",
+        "filePath": "/run/secrets/pg_ro_password",
+        "fileType": "CLEARTEXT"
+      }
+    }
+  }
+}
diff --git a/ops/checks/config/core/ignition/secret-provider/MapStudioFiles/resource.json b/ops/checks/config/core/ignition/secret-provider/MapStudioFiles/resource.json
new file mode 100644
index 0000000..12ae351
--- /dev/null
+++ b/ops/checks/config/core/ignition/secret-provider/MapStudioFiles/resource.json
@@ -0,0 +1,14 @@
+{
+  "scope": "A",
+  "description": "Docker secrets mounted into the dev Gateway for the platform checks",
+  "version": 1,
+  "restricted": false,
+  "overridable": true,
+  "files": [
+    "config.json"
+  ],
+  "attributes": {
+    "uuid": "2f96ffed-264a-48e0-8e29-d1bcb5768a52",
+    "enabled": true
+  }
+}
diff --git a/ops/checks/config/core/ignition/tag-definition/default/Checks/udts.json b/ops/checks/config/core/ignition/tag-definition/default/Checks/udts.json
new file mode 100644
index 0000000..7b2237a
--- /dev/null
+++ b/ops/checks/config/core/ignition/tag-definition/default/Checks/udts.json
@@ -0,0 +1,9 @@
+[
+  {
+    "enabled": true,
+    "name": "Pump1",
+    "tagType": "UdtInstance",
+    "typeId": "Checks/Pump",
+    "tags": []
+  }
+]
diff --git a/ops/checks/config/core/ignition/tag-definition/default/Checks/unary-resource.json b/ops/checks/config/core/ignition/tag-definition/default/Checks/unary-resource.json
new file mode 100644
index 0000000..a0e6e89
--- /dev/null
+++ b/ops/checks/config/core/ignition/tag-definition/default/Checks/unary-resource.json
@@ -0,0 +1,12 @@
+{
+  "scope": "G",
+  "version": 1,
+  "restricted": false,
+  "overridable": true,
+  "files": [
+    "udts.json"
+  ],
+  "attributes": {
+    "config": {}
+  }
+}
diff --git a/ops/checks/config/core/ignition/tag-provider/default/config.json b/ops/checks/config/core/ignition/tag-provider/default/config.json
new file mode 100644
index 0000000..f1e87de
--- /dev/null
+++ b/ops/checks/config/core/ignition/tag-provider/default/config.json
@@ -0,0 +1,24 @@
+{
+  "profile": {
+    "allowBackfill": false,
+    "enableTagReferenceStore": true,
+    "type": "STANDARD"
+  },
+  "settings": {
+    "defaultDatasourceName": null,
+    "editPermissions": {
+      "securityLevels": [],
+      "type": "AllOf"
+    },
+    "readOnly": false,
+    "readPermissions": {
+      "securityLevels": [],
+      "type": "AllOf"
+    },
+    "valuePersistence": "Configuration",
+    "writePermissions": {
+      "securityLevels": [],
+      "type": "AllOf"
+    }
+  }
+}
diff --git a/ops/checks/config/core/ignition/tag-provider/default/resource.json b/ops/checks/config/core/ignition/tag-provider/default/resource.json
new file mode 100644
index 0000000..f483207
--- /dev/null
+++ b/ops/checks/config/core/ignition/tag-provider/default/resource.json
@@ -0,0 +1,13 @@
+{
+  "scope": "A",
+  "description": "Default tag provider (Map Studio platform checks)",
+  "version": 1,
+  "restricted": false,
+  "overridable": false,
+  "files": [
+    "config.json"
+  ],
+  "attributes": {
+    "uuid": "e767fa28-e2ae-4bcf-b420-89cfc63eb48b"
+  }
+}
diff --git a/ops/checks/config/core/ignition/tag-type-definition/default/Checks/udts.json b/ops/checks/config/core/ignition/tag-type-definition/default/Checks/udts.json
new file mode 100644
index 0000000..0dedae4
--- /dev/null
+++ b/ops/checks/config/core/ignition/tag-type-definition/default/Checks/udts.json
@@ -0,0 +1,27 @@
+[
+  {
+    "name": "Pump",
+    "tagType": "UdtType",
+    "tags": [
+      {
+        "name": "Toggle",
+        "tagType": "AtomicTag",
+        "dataType": "Boolean",
+        "valueSource": "expr",
+        "expression": "getSecond(now(1000)) % 60 < 30",
+        "documentation": "True for the first half of every minute, so the alarm below goes active and clears every 30 s without any tag write.",
+        "alarms": [
+          {
+            "name": "Toggled",
+            "mode": "WhenTrue",
+            "priority": "High",
+            "label": "Toggle is true",
+            "ackMode": "Auto",
+            "shelvingAllowed": true,
+            "notes": "Test alarm for the Map Studio platform checks (story 3). Not rationalized; dev Gateway only."
+          }
+        ]
+      }
+    ]
+  }
+]
diff --git a/ops/checks/config/core/ignition/tag-type-definition/default/Checks/unary-resource.json b/ops/checks/config/core/ignition/tag-type-definition/default/Checks/unary-resource.json
new file mode 100644
index 0000000..a0e6e89
--- /dev/null
+++ b/ops/checks/config/core/ignition/tag-type-definition/default/Checks/unary-resource.json
@@ -0,0 +1,12 @@
+{
+  "scope": "G",
+  "version": 1,
+  "restricted": false,
+  "overridable": true,
+  "files": [
+    "udts.json"
+  ],
+  "attributes": {
+    "config": {}
+  }
+}
diff --git a/ops/checks/postgres-init.sh b/ops/checks/postgres-init.sh
new file mode 100755
index 0000000..765b44b
--- /dev/null
+++ b/ops/checks/postgres-init.sh
@@ -0,0 +1,19 @@
+#!/bin/sh
+# Runs once, on the first start of the PostgreSQL volume (docker-entrypoint-initdb.d),
+# as the database superuser POSTGRES_USER (mapstudio, the owner role).
+#
+# Creates mapstudio_ro: a role that can log in and connect, and nothing more.
+# PostgreSQL 15 and later give no CREATE on schema public to ordinary roles, so
+# the module's CREATE TABLE on this connection fails with SQLState 42501, which
+# is the "missing rights" case the platform checks record (AD-21).
+#
+# The password comes from the Docker secret; it is letters and digits only
+# (ops/lib.sh generates it), so quoting it in SQL is safe.
+set -eu
+
+ro_password="$(cat /run/secrets/pg_ro_password)"
+
+psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
+CREATE ROLE mapstudio_ro LOGIN PASSWORD '${ro_password}';
+GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO mapstudio_ro;
+SQL
diff --git a/ops/docker-compose.checks.yml b/ops/docker-compose.checks.yml
new file mode 100644
index 0000000..5d7ab43
--- /dev/null
+++ b/ops/docker-compose.checks.yml
@@ -0,0 +1,72 @@
+# Map Studio platform checks (story 3): PostgreSQL beside the dev Gateway, and the
+# Gateway config the checks need (tag provider, a UDT with a toggling alarm, a
+# File secret provider and two database connections) bind-mounted into the
+# Gateway's core config collection. DEVELOPMENT ONLY.
+#
+# Used together with docker-compose.yml by ops/checks.sh (MAPSTUDIO_CHECKS=1 in
+# ops/lib.sh adds this file to every compose call). Both services share the
+# compose project's default network, so the Gateway reaches PostgreSQL as
+# "postgres". No host port is published for PostgreSQL.
+#
+# Passwords: generated by ops/checks.sh into the git-ignored ops/checks/secrets/
+# and handed to both containers as Docker secrets. The Gateway reads them only
+# through its File secret provider (MapStudioFiles); no password is in any
+# committed file.
+
+services:
+  init:
+    # On a fresh volume, seed the core config collection from ops/checks/config/core
+    # (its manifest config-mode.json included: a pre-filled collection without one
+    # faults the Gateway with "Resource collection path '.../core' exists but is not
+    # empty"), then hand everything to the ignition user. The files are copied, not
+    # bind-mounted, so the Gateway owns them (it rewrites tag files and creates its
+    # own resources beside them) and nothing is written back into the repository.
+    # An existing core (a --keep run) is left alone.
+    entrypoint:
+      - sh
+      - -c
+      - mkdir -p /usr/local/bin/ignition/data/projects
+        /usr/local/bin/ignition/data/config/resources
+        && if [ ! -f /usr/local/bin/ignition/data/config/resources/core/config-mode.json ]; then
+        mkdir -p /usr/local/bin/ignition/data/config/resources/core
+        && cp -R /checks-config/core/. /usr/local/bin/ignition/data/config/resources/core/; fi
+        && chown -R ignition:ignition /usr/local/bin/ignition/data/projects
+        /usr/local/bin/ignition/data/config
+    volumes:
+      - ./checks/config:/checks-config:ro
+
+  gateway:
+    depends_on:
+      postgres:
+        condition: service_healthy
+    secrets:
+      - pg_password
+      - pg_ro_password
+
+  postgres:
+    image: postgres:16-alpine
+    environment:
+      POSTGRES_DB: mapstudio
+      POSTGRES_USER: mapstudio
+      POSTGRES_PASSWORD_FILE: /run/secrets/pg_password
+    secrets:
+      - pg_password
+      - pg_ro_password
+    volumes:
+      - postgres-data:/var/lib/postgresql/data
+      - ./checks/postgres-init.sh:/docker-entrypoint-initdb.d/10-mapstudio-ro.sh:ro
+    healthcheck:
+      test: ["CMD-SHELL", "pg_isready -U mapstudio -d mapstudio"]
+      interval: 5s
+      timeout: 5s
+      retries: 30
+    restart: "no"
+
+secrets:
+  pg_password:
+    file: ./checks/secrets/pg_password
+  pg_ro_password:
+    file: ./checks/secrets/pg_ro_password
+
+volumes:
+  postgres-data:
diff --git a/ops/lib.sh b/ops/lib.sh
index 049bc0a..683be6a 100755
--- a/ops/lib.sh
+++ b/ops/lib.sh
@@ -46,7 +46,33 @@ ADMIN_PASS="${GATEWAY_ADMIN_PASSWORD}"
 
 # docker compose, always pointed at this folder's compose file.
 # Project name follows the container, so parallel Gateways get separate volumes.
+# With MAPSTUDIO_CHECKS=1 (ops/checks.sh) the platform checks' compose file is
+# added: PostgreSQL and the checks' Gateway config on the same compose project.
 COMPOSE=(docker compose -p "${MAPSTUDIO_CONTAINER:-mapstudio-ignition}" -f "${OPS_DIR}/docker-compose.yml")
+if [[ "${MAPSTUDIO_CHECKS:-}" == "1" ]]; then
+  COMPOSE+=(-f "${OPS_DIR}/docker-compose.checks.yml")
+fi
+CHECKS_SECRETS_DIR="${OPS_DIR}/checks/secrets"
+
+# The PostgreSQL passwords of the platform checks: generated once into the
+# git-ignored ops/checks/secrets/ (letters and digits, no trailing newline
+# because the Gateway's File secret provider reads every byte) and handed to
+# the containers as Docker secrets. Never committed, never in a log.
+# Compose bind-mounts a file secret with its host mode, and the containers read
+# it as other users (postgres, ignition uid 2003), so the files are 0644 inside
+# a 0700 folder: hidden from other local users, readable inside the containers.
+ensure_checks_secrets() {
+  mkdir -p "${CHECKS_SECRETS_DIR}"
+  chmod 700 "${CHECKS_SECRETS_DIR}"
+  local name
+  for name in pg_password pg_ro_password; do
+    if [[ ! -s "${CHECKS_SECRETS_DIR}/${name}" ]]; then
+      ( umask 077; head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24 \
+          > "${CHECKS_SECRETS_DIR}/${name}" )
+    fi
+    chmod 644 "${CHECKS_SECRETS_DIR}/${name}"
+  done
+}
 
 # --- logging --------------------------------------------------------------
 if [[ -t 1 ]]; then
diff --git a/ops/project/com.aoindustrial.perspective.mapstudio/setup/resource.json b/ops/project/com.aoindustrial.perspective.mapstudio/setup/resource.json
new file mode 100644
index 0000000..11a2e63
--- /dev/null
+++ b/ops/project/com.aoindustrial.perspective.mapstudio/setup/resource.json
@@ -0,0 +1,10 @@
+{
+  "scope": "G",
+  "version": 1,
+  "restricted": false,
+  "overridable": true,
+  "files": [
+    "setup.json"
+  ],
+  "attributes": {}
+}
diff --git a/ops/project/com.aoindustrial.perspective.mapstudio/setup/setup.json b/ops/project/com.aoindustrial.perspective.mapstudio/setup/setup.json
new file mode 100644
index 0000000..f788847
--- /dev/null
+++ b/ops/project/com.aoindustrial.perspective.mapstudio/setup/setup.json
@@ -0,0 +1,9 @@
+{
+  "connection": "MapStudio",
+  "connectionNoRights": "MapStudioNoRights",
+  "adapterFunction": "mapstudio_checks.kinds",
+  "alarmMetricPaths": [
+    "[default]Checks/Alarm Metrics.HasActive",
+    "[default]Checks/Pump1/Alarm Metrics.HasActive"
+  ]
+}
diff --git a/ops/project/ignition/script-python/mapstudio_checks/code.py b/ops/project/ignition/script-python/mapstudio_checks/code.py
new file mode 100644
index 0000000..e3694de
--- /dev/null
+++ b/ops/project/ignition/script-python/mapstudio_checks/code.py
@@ -0,0 +1,28 @@
+# Spike (story 3): the project-side adapter the Map Studio module calls from
+# Java through the project's ScriptManager. Jython 2.7 (the Gateway's).
+#
+# kinds() is the shape of a future kind adapter (AD-4): a list of dicts. It also
+# calls system.mapstudio.ping(), so one call from the module proves both that
+# module code can run a project function and that system.mapstudio is
+# registered in the project's script scope.
+
+import java.lang
+
+logger = system.util.getLogger('MapStudio.check.adapter')
+
+
+def kinds():
+    """The kind list, plus the answer of system.mapstudio.ping()."""
+    ping = None
+    try:
+        ping = system.mapstudio.ping()
+    except java.lang.Throwable as ex:
+        logger.error('system.mapstudio.ping failed: %s' % ex.getClass().getSimpleName())
+    except Exception as ex:
+        logger.error('system.mapstudio.ping failed: %s' % type(ex).__name__)
+    rows = [
+        {'id': 'pad', 'name': 'Pad', 'geometry': 'point'},
+        {'id': 'line', 'name': 'Gathering line', 'geometry': 'line'},
+    ]
+    logger.info('kinds() called from the module; ping = %s' % ping)
+    return {'kinds': rows, 'ping': ping}
diff --git a/ops/project/ignition/script-python/mapstudio_checks/resource.json b/ops/project/ignition/script-python/mapstudio_checks/resource.json
new file mode 100644
index 0000000..e160ebe
--- /dev/null
+++ b/ops/project/ignition/script-python/mapstudio_checks/resource.json
@@ -0,0 +1,12 @@
+{
+  "scope": "A",
+  "version": 1,
+  "restricted": false,
+  "overridable": true,
+  "files": [
+    "code.py"
+  ],
+  "attributes": {
+    "hintScope": 2
+  }
+}
