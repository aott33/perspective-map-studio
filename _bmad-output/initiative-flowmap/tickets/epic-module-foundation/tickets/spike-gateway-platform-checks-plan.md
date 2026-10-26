---
title: 'Gateway platform checks'
type: 'feature'
ticket: '3'
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
  - '{project-root}/_bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** AD-5, AD-6, AD-18 and AD-21 rest on five SDK claims nobody has seen work on an 8.3 Gateway; a wrong one changes the design of three epics, so the spike must answer each with evidence before the go or no-go (story 9).

**Approach:** Add a spike package to the module's Gateway scope that runs five checks against the dev Gateway when a project holds a `setup` resource, logging one `CHECK <name> PASS|FAIL <evidence>` line each; a second compose file adds PostgreSQL and bind-mounted config to the ops Gateway, and `ops/checks.sh` runs it end to end and collects the log into a dated record in `docs/`.

## Boundaries & Constraints

**Always:** Java 17, SDK 8.3.0 jars; story 1's build, ops scripts and module ids untouched in behaviour; dev Gateway `MAPSTUDIO_CONTAINER=ms-s3`, `GATEWAY_HTTP_PORT=9103` in the git-ignored `.env`; every password generated into `.env` or a git-ignored secret file and reaching the Gateway only through a File secret provider (Referenced secret) and PostgreSQL through `POSTGRES_PASSWORD_FILE`; the Gateway's default connection settings (pool 0/8/8/0, `SELECT 1`, test on borrow) left as they are; loggers `MapStudio.check.<name>`; each recorded answer carries its evidence and label `[live 8.3.10]` and, where a check fails, the fallback taken; no em dashes; the claude-ignition-skills repository is not edited in this story (its entry is drafted in the record for the owner to land).

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
- [ ] `common/.../MapStudioModule.java` -- add `SETUP_RESOURCE_TYPE = new ResourceType(MODULE_ID, "setup")` -- shared by gateway now, designer later.
- [ ] `gateway/.../spike/SetupResource.java` -- record parsed from `setup.json` (`connection`, `connectionNoRights`, `adapterFunction`, `alarmMetricPaths`) with `fromResource(Resource)` -- the custom resource check.
- [ ] `gateway/.../spike/ChecksLifecycleFactory.java`, `ChecksLifecycle.java` -- filter on `SETUP_RESOURCE_TYPE`; `onStartup` runs the checks on a bounded executor and logs one `CHECK <name> PASS|FAIL <evidence>` line each; `onResourcesModified` logs the re-read; `onShutdown` unsubscribes -- checks 1, 2, 4, 5 need a loaded project.
- [ ] `gateway/.../spike/AlarmMetricsCheck.java` -- subscribe to the two paths, collect events for 90 s, also `readAsync` them; result and qualities in the log line.
- [ ] `gateway/.../spike/ProjectScriptCheck.java` -- `getProjectScriptManager(project)`, `runCode` importing the module and calling `adapterFunction`, result read from the locals map; record which of `runCode` and `runFunction(getGlobals()...)` works.
- [ ] `gateway/.../spike/PostgresCheck.java` -- the two connections of the matrix; the rights failure logged with `errorf("Map Studio cannot create its tables on connection %s: %s (SQLState %s)")`.
- [ ] `gateway/.../MapStudioScriptModule.java` + `MapStudioScriptModule.properties`, `MapStudioGatewayHook.java` -- `system.mapstudio.ping()` returning the module version; factory started in `startup`, stopped in `shutdown`.
- [ ] `gateway/src/test/.../SetupResourceTest.java`, `PostgresCheckTest.java` -- parse a sample `setup.json`; the SQLState 42501 message formatting; both pure.
- [ ] `ops/project/ignition/script-python/mapstudio_checks/{code.py,resource.json}` -- Jython 2.7: `kinds()` returns two dicts and the value of `system.mapstudio.ping()`; `system` not imported.
- [ ] `ops/project/com.aoindustrial.perspective.mapstudio/setup/{setup.json,resource.json}` -- the dev setup naming the two connections, the function and the two metric paths.
- [ ] `ops/checks/config/.../{tag-provider/default, tag-type-definition/default, tag-definition/default/Checks, secret-provider/MapStudioFiles, database-connection/MapStudio, database-connection/MapStudioNoRights}` -- the Gateway config files; passwords only as Referenced secrets.
- [ ] `ops/checks/postgres-init.sql` -- creates `mapstudio_ro` (LOGIN, CONNECT only) reading its password from the mounted secret through a small init shell script; `mapstudio` is `POSTGRES_USER`.
- [ ] `ops/docker-compose.checks.yml` -- `postgres:16` service (no host port) with `POSTGRES_PASSWORD_FILE`; `secrets:` for both passwords from git-ignored `ops/checks/secrets/`; the config folders bind-mounted into `data/config/resources/core/...`; `init` extended to chown them.
- [ ] `ops/checks.sh`, `ops/lib.sh` -- generate the two PostgreSQL passwords into `ops/checks/secrets/` (mode 600, no newline), run `up.sh` with both compose files, wait, grep the wrapper log for the `CHECK` lines (fail if fewer than five), print them; `--scan` edits nothing but re-posts a project scan to show `onResourcesModified`.
- [ ] `docs/spike/platform-checks.md` -- the record: environment (8.3.10, PostgreSQL version, date), one section per check with the log lines, the SDK calls that worked, fallbacks taken, and a drafted `Finding | Where it went` table for claude-ignition-skills (`ignition-architect/references/system-architectures.md` or a new `ignition-dev/references/module-sdk.md`, owner's call).
- [ ] `.gitignore`, `README.md` -- ignore `ops/checks/secrets/` and write-back noise; a short "Platform checks" paragraph.

**Acceptance Criteria:**
- Given a fresh clone with `.env` holding `MAPSTUDIO_CONTAINER=ms-s3` and `GATEWAY_HTTP_PORT=9103`, when `ops/checks.sh` runs, then the Gateway reaches RUNNING, the module starts without error, and the log holds five `CHECK` lines, each PASS or FAIL with evidence.
- Given the record in `docs/spike/platform-checks.md`, when read against the architecture's open questions, then each of the five has an answer, its evidence and, for a FAIL, the fallback the architecture names, all labelled `[live 8.3.10]`.
- Given `./gradlew build`, when it runs, then it succeeds and the new unit tests pass; `ops/up.sh` alone (story 1's path) still works without PostgreSQL.
- Given the Designer connected to `ms-s3` (manual, owner), when `system.mapstudio.` is typed in the script console, then `ping` appears with its description.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

The checks run from a `ResourceCollectionLifecycle`, not from `startup()`, because project scripts and resources load after module startup; the lifecycle hands over the loaded resources, which is also the resource-type check itself. The expression-tag alarm toggles by the clock so no tag is written (AD-1 says Map Studio never writes tags). PostgreSQL 16 was chosen because, since PostgreSQL 15, a plain role has no CREATE on `public`, which gives the rights failure without a GRANT dance. Config goes in as bind-mounted files read at start (the skills verified tag files, providers and connections load that way) rather than through the REST API, which would need an API key on a fresh Gateway.

## Verification

**Commands:**
- `./gradlew build` -- expected: success, `build/Map-Studio.unsigned.modl`, new tests pass.
- `ops/checks.sh` -- expected: five `CHECK` lines printed; `ops/logs.sh -n 400 | grep MapStudio` shows no stack trace at error level beyond the planned rights error.
- `ops/checks.sh --scan` -- expected: a `CHECK setup` line after `onResourcesModified`.
- `ops/down.sh --purge` then `ops/up.sh --fresh` -- expected: story 1's path still passes without the checks compose file.
- `grep -rnP '\xE2\x80\x94' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=build` -- expected: nothing (no em dash anywhere).

**Manual checks (if no CLI):**
- Owner opens the Designer on `ms-s3`, confirms `system.mapstudio.ping()` autocompletes and returns the version, and the Alarm Metrics folders exist under `Checks` and `Checks/Pump1`.

## Open Questions

1. **Designer side of the setup resource.** The spike reads the resource on the Gateway only and sizes the Designer editor from IA's example (about 300 lines of Swing: workspace, editor, search provider, icon). Options: (a) Gateway-only now, record the estimate, decide in epic-map-store-and-data (the plan above); (b) build a minimal Designer editor in this spike (adds a day and a `designer/` dependency on the SDK's `designer` jar). (a) keeps the two-day gate; (b) answers AD-5's "too costly" with code.
2. **Where the skills entry lands.** The record drafts the `Finding | Where it went` rows, but the skills repository has no reference file for the module SDK. Options: (a) a new `ignition-dev/references/module-sdk.md`; (b) rows in `ignition-architect/references/system-architectures.md` and `ignition-ui/references/perspective-components.md` (Alarm Metrics). The owner lands it later either way; the draft names the chosen file.
