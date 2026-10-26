# Quick lens - story 8 refactor sweep (standalone prompt)

You are a context-free reviewer. Review by inspection only. Do not modify code, run builds or tests, or invoke quality gates. Do not invoke any skill, and do not spawn subagents of your own - you are the reviewer. Return your findings as text in your final message.

Below are: the plan (its acceptance criteria and intent), the repository rules, and the unified diff of the change under review. This repository has no CLAUDE.md or AGENTS.md; the rules that apply are in the "Rules" section.

Report unmet acceptance criteria, broken rules, and bugs. Each finding: the location, what goes wrong, and evidence checked against the surrounding code. Output a Markdown list of findings only - no severity, priority, or ranking.

Things worth a close look (not an exhaustive list): (1) anything the deletion of the spike package, `ops/checks*`, the `setup` resource or `SETUP_RESOURCE_TYPE` left dangling (references, docs, scripts, `.gitignore`); (2) the `build.gradle.kts` license staging rewrite (task ordering with `assembleModlStructure`, `writeModuleXml` and `zipModule`; the release signing path); (3) the dependency moves in `web/package.json`; (4) the merged `_bmad-output/deferred-work.md` against the two original files (every original entry present or folded, no content lost); (5) claims in README and docs that the code no longer supports, and Ignition claims not marked unverified.

## Rules

- Cleanup only: no feature, no change to a prop, a message type, or a documented script function. Public props follow semantic versioning (AD-9, below).
- No em dashes anywhere (use " - "). Unverified claims about Ignition must be marked unverified. No secrets in git. No `.modl` in git.
- Jython rules and Ignition script rules do not apply to this change (no Ignition scripts are added).

### AD-9 - The public contract is versioned [ADOPTED]

- **Binds:** all
- **Prevents:** a host project breaking on a module upgrade without warning.
- **Rule:** Component props and events, the message contract, the map item record and object, LiveValue, the asset contract, the kind list, the setup schema, the scripting API and the CSV formats are documented in `docs/` and follow semantic versioning; a breaking change is a new major version. The component's props are a closed list in `common/`.


### AD-13 - Build, release and upgrade gate [ADOPTED]

- **Binds:** all
- **Prevents:** a release that breaks on a Gateway version it claims to support, or an unsigned or unpinned module on a Gateway.
- **Rule:** The Perspective client packages are pinned to exact versions and the module declares its lowest supported 8.3.x. A release claims a new 8.3.x only after the template's test stack and the module's Playwright suite pass on it. Releases are signed `.modl` files on GitHub, installed through the host's module lock by SHA-256 and certificate fingerprint; never a `.modl` in git.



## Deleted files (bodies omitted from the diff below)

_bmad-output/initiative-flowmap/deferred-work.md
gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/AlarmMetricsCheck.java
gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/CheckResult.java
gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ChecksLifecycle.java
gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ChecksLifecycleFactory.java
gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/PostgresCheck.java
gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ProjectScriptCheck.java
gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/SetupResource.java
gateway/src/test/java/com/aoindustrial/perspective/mapstudio/gateway/spike/AlarmMetricsCheckTest.java
gateway/src/test/java/com/aoindustrial/perspective/mapstudio/gateway/spike/PostgresCheckTest.java
gateway/src/test/java/com/aoindustrial/perspective/mapstudio/gateway/spike/SetupResourceTest.java
ops/checks.sh
ops/checks/config/core/config-mode.json
ops/checks/config/core/ignition/database-connection/MapStudio/config.json
ops/checks/config/core/ignition/database-connection/MapStudio/resource.json
ops/checks/config/core/ignition/database-connection/MapStudioNoRights/config.json
ops/checks/config/core/ignition/database-connection/MapStudioNoRights/resource.json
ops/checks/config/core/ignition/secret-provider/MapStudioFiles/config.json
ops/checks/config/core/ignition/secret-provider/MapStudioFiles/resource.json
ops/checks/config/core/ignition/tag-definition/default/Checks/udts.json
ops/checks/config/core/ignition/tag-definition/default/Checks/unary-resource.json
ops/checks/config/core/ignition/tag-provider/default/config.json
ops/checks/config/core/ignition/tag-provider/default/resource.json
ops/checks/config/core/ignition/tag-type-definition/default/Checks/udts.json
ops/checks/config/core/ignition/tag-type-definition/default/Checks/unary-resource.json
ops/checks/postgres-init.sh
ops/docker-compose.checks.yml
ops/project/com.aoindustrial.perspective.mapstudio/setup/resource.json
ops/project/com.aoindustrial.perspective.mapstudio/setup/setup.json
ops/project/ignition/script-python/mapstudio_checks/code.py
ops/project/ignition/script-python/mapstudio_checks/resource.json


## package-lock.json (body omitted)

 web/package-lock.json | 1447 ++++++++++++++++++++-----------------------------
 1 file changed, 594 insertions(+), 853 deletions(-)


## The plan

---
title: 'Refactor sweep'
type: 'refactor'
ticket: '8'
created: '2026-10-26'
status: 'in-review'
baseline_revision: '51104c889817dc9d01136807786963e58d8172b8'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Stories 1 to 7 left deferred work in two stray `deferred-work.md` files, a spike package that still runs inside the shipped module, Gradle 10 deprecations in our build scripts, webpack peer warnings and build-tool audit findings.

**Approach:** Sweep what is cleanup (the table in Design Notes decides every item), change no public prop, message or documented script function, and prove the build, the Playwright suite and the template stack still pass.

## Boundaries & Constraints

**Decisions (owner, approved 2026-10-26):** (1) `testSet` and `popupView` stay until the map store seeds the 30 pads; this supersedes the owner's earlier 2026-10-26 decision (story 7, question 4) to remove `testSet` in the sweep, because `scale30` is the only source of the 30-pad frame-rate measure and the headed run needs it before story 9, and the component has no other way to receive data until `map.load` exists. (2) The PostgreSQL dev stack goes with the checks, recoverable at `51104c8`. (3) No release for the sweep; the next release is 0.1.1. (4) Signature verification stays deferred.

**Always:** Cleanup only. Keep `popupView`, `testSet`, the four dev views and their e2e specs, `MapStudioScriptModule` (`system.mapstudio.ping` and `echo`). Compare the built `.modl` contents before and after. No em dashes, no secret in git. Every Ignition claim not seen live is marked unverified.

**Never:** Add a feature, change a prop, a message type or `ops/project` page URLs. Edit `tickets.toml`, a ticket file or another story's plan. Touch `ign-scada-template` (its race is its owner's) or push, tag or release. Implement signature verification in `modl-verify.sh`. Rewrite `docs/spike-measures.json` or the screenshots (story 9 compiles them).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Upgrade with a leftover `setup` resource | A project holds `com.aoindustrial.perspective.mapstudio/setup` | Module starts, no `CHECK` line, no Map Studio error | Unverified on a Gateway; check on the dev Gateway before merge |
| Dev machine with the old checks stack | PostgreSQL volume from `ops/checks.sh` exists | `ops/down.sh --purge` still runs; README names the leftover volume to remove | Orphan container removed by `--remove-orphans` |
| Release build | `-Pignition.signing.*` set | `license.html` is in the `.modl` and `<license>` is in `module.xml`, as before | `test-signing.sh` fails the build |

</frozen-after-approval>

## Code Map

- `_bmad-output/deferred-work.md` (6 entries) and `_bmad-output/initiative-flowmap/deferred-work.md` (7) -- the two files; the root one is where `bmad-build` appends, so it is the survivor.
- `gateway/src/main/java/.../gateway/spike/` (7 files), `gateway/src/test/java/.../spike/` (3 tests, 12 tests) -- the story 3 checks; only `MapStudioGatewayHook` uses them (import, field, `setup`, `startup`, `shutdown`).
- `common/.../MapStudioModule.java` -- `SETUP_RESOURCE_TYPE`, used only by the spike. `MapStudioScriptModule` stays (the Designer autocomplete check needs it).
- `ops/checks.sh`, `ops/checks/`, `ops/docker-compose.checks.yml`, `ops/project/ignition/script-python/mapstudio_checks/`, `ops/project/com.aoindustrial.perspective.mapstudio/setup/`; `ops/lib.sh` (lines 57 to 90), `up.sh` and `down.sh` headers; `.gitignore` line 48.
- `build.gradle.kts` line 15 (`by extra`), lines 83 to 98 (`copy {}` in `doLast`, `layout` in `doFirst`); `web/build.gradle.kts` lines 31 and 42 (`by registering`); `web/package.json` (`webpack` 5.101.3, `perspective-client` under `dependencies`) and its lock.
- `e2e/` has no reference to the checks (grep), so the spike removal cannot break it. `popup.spec`, `scale.spec`, `tracer.spec` and `measures.spec` depend on `popupView`, `testSet` and the four dev pages: untouched.
- `README.md` (Status, Layout, "Platform checks"), `docs/architecture.md` ("Still open"), `docs/platform-checks.md`, `scripts/ci/modl-verify.sh` (header names `deferred-work.md`), `common/.../mapstudio.props.json` (`testSet` description says "Removed in the refactor sweep").

## Tasks & Acceptance

**Execution:**
- [x] Baseline (before any change) -- build once, record `unzip -l` of `build/Map-Studio.unsigned.modl`, its `module.xml`, bundle sizes, Jest 32, Java 18, `npm audit` count (12), and `./gradlew help --warning-mode all` output, in Implementation Notes.
- [x] `_bmad-output/deferred-work.md` -- merge the 7 initiative entries, fold the duplicate story 4 entry, add `resolved:` or `goes_to:` per the table, `git rm` the initiative copy; `scripts/ci/modl-verify.sh` header names the surviving path.
- [x] `gateway/.../spike/**`, `gateway/src/test/.../spike/**`, `MapStudioGatewayHook.java`, `MapStudioModule.java` -- delete the package and its tests, remove the hook wiring and `SETUP_RESOURCE_TYPE`; the Gateway tests drop from 18 to 6.
- [x] `ops/**` and `.gitignore` -- delete the checks harness, PostgreSQL compose file, checks config, project script and `setup` resource; strip `lib.sh`, `up.sh`, `down.sh` of the checks logic (keep `--remove-orphans`).
- [x] `build.gradle.kts`, `web/build.gradle.kts` -- `extra["sdk_version"]`, `tasks.register<NpmTask>`, license staging as a `Copy` task and providers captured at configuration time (no `copy {}` or `layout` inside an action); drop the empty `moduleDependencies` line if a warning names it. Fix only what our scripts own.
- [x] `web/package.json`, lock -- webpack 5.112.2; `npm audit fix` without `--force`; leftover `serialize-javascript` findings via a plugin bump only if the build and bundle hold, else an `overrides` entry or a recorded exception; move `@inductiveautomation/perspective-client` to `devDependencies` (webpack externalises it).
- [x] `README.md`, `docs/architecture.md`, `docs/platform-checks.md` (new "Story 8" section and one sentence in its intro), `mapstudio.props.json` description text -- match the code; the platform-checks section lists the removed paths, the recovery commit `51104c8`, the bundle delta and the unfixable audit findings.
- [x] Verify (below) and append the results to Implementation Notes.

**Acceptance Criteria:**
- Given the sweep branch, when `./gradlew build --warning-mode all` runs, then it succeeds with Jest 32 and Java 6 passing and no deprecation names `build.gradle.kts` or `web/build.gradle.kts`.
- Given the baseline and sweep `.modl`, when the file lists and `module.xml` are diffed, then only the spike classes, the bundle bytes and `MapStudioModule` differ, and `license.html` and `<license>` remain.
- Given a dev Gateway from `ops/up.sh --fresh`, when `npm test` runs in `e2e/`, then 10 of 10 pass and the Gateway log has no `CHECK` line and no Map Studio warning or error.
- Given a throwaway-signed build in a scratch clone of `ign-scada-template` (the story 6 rehearsal), when `scripts/test/stack.sh` runs, then it prints `test stack: PASS`.
- Given the repository, then one `deferred-work.md` exists, all 13 original entries are present or folded, and `git diff 51104c8 -- common/src/main/resources/mapstudio.props.json` changes description text only.
- Given `grep -rn` for em dashes and for key material in the diff, then both find nothing.

## Implementation Notes

Implemented directly in this session (no coding subagent available), 2026-10-26, on `ms-s8` (port 9108).

- Baseline captured before any change: unsigned `.modl` 510,041 bytes; files `common`, `designer`, `gateway`, `web` jars, `license.html`, `module.xml`; `MapStudio.js` 1,179,848, `MapStudio.css` 72,208; Jest 32; Gateway tests 18; `npm audit` 12; Gradle warnings as in `docs/platform-checks.md` "Story 8".
- Deviation: `.gitignore` keeps `ops/checks/secrets/` (comment reworded) instead of dropping it. A developer's old generated PostgreSQL passwords are untracked there and must never be committed; the plan said to remove the line.
- Deviation: `ops/lib.sh` also lost `COMPOSE_PROJECT` (only the checks code used it). `--remove-orphans` stays in `up.sh --fresh` and `down.sh`.
- The `stageLicense` `Copy` task runs `finalizedBy` of `assembleModlStructure` and `zipModule` depends on it. Built `module.xml` is identical to the baseline (`<license>` kept) and the `.modl` file list is identical.
- A release-version build (`-PreleaseVersion`) leaves `common-0.1.0.jar` in `build/moduleContent`; a later plain `./gradlew build` then fails with "Library 'common' exists in multiple versions" until `clean`. Plugin behaviour, present before the sweep (`assembleModlStructure` was never cleaned); not touched.
- `docs/platform-checks.md` got a "Story 8" section and one sentence in its intro; Story 2 to 7 sections are untouched. The deferred-work merge adds `resolved:`, `folded:` and `goes_to:` lines and two new entries (triage leftovers; unrun CI steps and linters).

**Results.** `./gradlew clean build --warning-mode all`: success, Jest 32, Gateway tests 6 (was 18); remaining warnings are the plugin's `Project.getProperties` and `Task.project` (`:common:collectModlDependencies`). `npm ci` prints no peer warning; `npm audit` 12 to 8 (all through `perspective-client`), `--omit=dev` 0. `.modl` comparison: `module.xml` and file list identical; the only jar entries removed are the eight `gateway/.../spike` classes; `MapStudio.js` -34 bytes, `MapStudio.css` +310; unsigned `.modl` 510,041 to 488,266. `ops/up.sh --fresh` then `npm test` in `e2e/`: 10 of 10, no `CHECK` line and no Map Studio warning or error in the Gateway log. `scripts/ci/test-signing.sh`: OK. Dev Gateway restarted with a leftover `setup` resource copied into `ops/project` (then removed): project and module started, no `CHECK` line, no Map Studio warning or error **[live 8.3.10]**. Throwaway-signed build (`build-signed.sh`, 30-day throwaway certificate, scratch clone `tpl8` of `ign-scada-template` with only the Map Studio lock entry swapped, never pushed): `verify-lock` ok, `modl.py fetch` ok for all six modules, `modl.py inspect` 6 signatures, none bad.

**Template stack.** `scripts/test/stack.sh --here` in that scratch clone (template main with Cirrus Link MQTT Engine in the lock; render limits `RENDER_PASSES=native-day,phone-native-night`, `RENDER_ROLES=engineer`, as the template's CI uses for its fieldsim job) printed `test stack: PASS`, exit 0, and `smoke.sh` reported `ok module com.aoindustrial.perspective.mapstudio` **[live 8.3.9]**. Two things happened first: the first attempt stopped at the image pull (Docker Hub answered 429 for the HiveMQ image; a retry loop pulled it on the sixth try), and the second stopped at the render suite because `--here` had no `tests/render/node_modules` (the default mode links them); `npm install` there and a full rerun passed. Not run: the full render matrix (all passes and roles), as in the story 6 rehearsal. The stack was built from the earlier throwaway `.modl` (before the `mapstudio.props.json` description text changed); the final tree was rebuilt and `./gradlew clean build` passes again, so the only difference is that description string.

## Plan Change Log

## Review Triage Log

## Design Notes

Why `testSet` and `popupView` stay (the owner's 2026-10-26 decision asked to remove `testSet`; this superseded it, see Decisions): `scale30` is the only source of the 30-pad frame-rate measure and the owner's headed run (item 3) needs it before story 9; without a prop the component has no way to receive data until `map.load` exists (epic-map-store-and-data). `popupView` is the only way to name a popup view until the kind setup does (AD-7, epic-viewing); removing it orphans `PointPopup`, `popupParams`, 9 Jest tests and the popup spec. The four dev views each fix one prop combination; merging them needs view-param bindings whose timing is unverified (the component reads its props once at mount).

`ops/checks.sh` is not kept as a harness: it only greps `CHECK` lines that the removed package writes, and keeping the package keeps spike code in every shipped `.modl`. The harness, PostgreSQL compose file and checks config stay readable at `51104c8` and in the v0.1.0 tag (not present in this clone, unverified here); the evidence stays in `docs/platform-checks.md`.

Gradle: the owner's `moduleDependencies` warning did not reproduce with `--warning-mode all` on Gradle 9.8.0 (this session). `Project.getProperties` and possibly `Task.project` warnings may come from the `io.ia.sdk.modl` 0.5.0 or node plugin (unverified); list them as plugin-owned. Audit: `npm audit` reports 12 (1 low, 7 moderate, 4 high); `axios`, `lodash`, `moment`, `@babel/runtime` come only through `perspective-client` (a Gateway-provided external, not bundled), whose "fix" is a downgrade to 2.3.9 (no); `serialize-javascript` comes through two webpack plugins (major bumps 14.0.0 and 8.0.0, compatibility unverified).

Disposition of every deferred item (G = this plan, O = owner, 9 = story 9):

| # | Item (file) | Decision | Where |
|---|---|---|---|
| 1 | Merge the two deferred-work files | In the sweep | G |
| 2 | Squash `web/node_modules` from history (initiative file) | Already done (`resolved:` 2026-10-26) | keep the entry |
| 3 | Gradle 10 deprecations | In the sweep | G |
| 4 | webpack to 5.112 or later | In the sweep (5.112.2 exists, npm metadata) | G |
| 5 | npm audit of build tools | In the sweep: fix or record; client findings stay | G |
| 6 | Remove spike package, project script, `setup` resource | In the sweep (remove, no harness) | G |
| 7 | Remove `testSet`, `Scale` and two fallback views | Not in the sweep: keep as e2e fixtures | epic-map-store-and-data (seed the 30 pads through `applyEdits`), owner decision 1 |
| 8 | Remove `popupView` | Not in the sweep | epic-viewing (kind setup, AD-7) |
| 9 | Real signature verification in `modl-verify.sh` | Not in the sweep: a new verification feature; signed-bytes format unchecked against `io.ia.sdk.modl` 0.5.0 | owner decision 4; Gateway verifies at install |
| 10 | Headed frame-rate run on a real GPU | Owner action | O, then 9 |
| 11 | Designer: `system.mapstudio.` autocomplete; `CHECK setup-modified` | Owner action; run on the v0.1.0 module, since the sweep removes the second check's code | O, then 9 |
| 12 | Gateway-side view stop on popup close (two entries: story 4 and story 7) | Not in the sweep: a live Gateway check, no code | 9 (an agent session can do it); the two entries are folded into one |
| 13 | Real `values.batch` replaces the stand-in | Not in the sweep | epic-viewing |
| 14 | Designer editor for the `setup` resource (300 lines) | Not in the sweep | epic-map-store-and-data (AD-5) |
| 15 | ign-scada-template trends race | Not in the sweep | `ign-scada-template` owner; its backlog row is theirs |
| 16 | Triage leftovers: late reply clears pending (story 1), theme switch repaint (story 1), phone targets under 44 px and the 21 x 22 px popup close (story 7), dash arrays and `access-denied` unverified | Not in the sweep: features or unverified platform facts | epic-viewing, epic-phone |
| 17 | CI steps and `shellcheck`, `actionlint` never run (story 5, 7) | Not in the sweep: a new CI gate; the GitHub run status is not visible from this session | O |

Version: no prop, message type or documented function changes, so the next release is a patch, 0.1.1 (the sweep needs no release alone). Removing `testSet` would be a breaking prop change: 0.2.0 by pre-1.0 practice, 1.0.0 by the literal AD-9 text.

## Verification

**Commands:**
- `./gradlew build --warning-mode all --console plain -Dorg.gradle.java.installations.auto-download=false` -- expected: success, Jest 32, Java 6, no deprecation from our scripts
- `cd web && npm ci && npm audit` -- expected: no peer warning; remaining findings listed in `docs/platform-checks.md`
- `unzip -l build/Map-Studio.unsigned.modl` against the baseline -- expected: only the spike classes and the bundle differ
- `scripts/ci/test-signing.sh` -- expected: passes (license and signing path intact)
- `ops/up.sh --fresh`, then `cd e2e && npm test` -- expected: 10 of 10, log clean
- Story 6 rehearsal in a scratch clone of `ign-scada-template` (throwaway keystore, `build-signed.sh`, `modl.py fetch`, `scripts/test/stack.sh`) -- expected: `test stack: PASS`
- `grep -rn $'\xe2\x80\x94'` over the diff -- expected: none

**Manual checks (if no CLI):**
- Install the sweep build on a dev Gateway whose project still holds a `setup` resource: expected, no error (unverified until done).


## The diff (git diff -D 51104c889817dc9d01136807786963e58d8172b8..HEAD, lock file and plan excluded)

```diff
diff --git a/.gitignore b/.gitignore
index 0725613..f61ab1e 100644
--- a/.gitignore
+++ b/.gitignore
@@ -44,5 +44,6 @@ bin/
 # Playwright suite output (story 7); docs/ gets screenshots and measures only with E2E_DOCS=1
 e2e/out/
 
-# Platform checks (story 3): generated PostgreSQL passwords
+# Removed platform checks (story 3, removed in story 8): a developer's old generated
+# PostgreSQL passwords must never be committed, so the folder stays ignored.
 ops/checks/secrets/
diff --git a/README.md b/README.md
index 8ae5999..1e01df0 100644
--- a/README.md
+++ b/README.md
@@ -13,7 +13,7 @@ The tracer: a MapLibre map on a blank style with three fixed points and one line
 
 The platform checks the spike answered, with their evidence, are in [docs/platform-checks.md](docs/platform-checks.md) (toolchain pins: MapLibre GL JS 6.16.0, Terra Draw 1.38.0, adapter 1.5.0).
 
-Story 4 (spike): a point click also opens a popup that renders a project view by path, the way the built-in Perspective Map renders a view from a `path`. The spike-only prop `popupView` (`path`, `params`) names the view; it receives the point as its `mapItem` parameter (`{id, name}`) beside `params`, and an empty or failing path falls back to a text popup. Its evidence is in the same file.
+Story 4 (spike): a point click also opens a popup that renders a project view by path, the way the built-in Perspective Map renders a view from a `path`. The spike-only prop `popupView` (`path`, `params`) names the view; it receives the point as its `mapItem` parameter (`{id, name}`) beside `params`, and an empty or failing path falls back to a text popup. Its evidence is in the same file. Story 7 (spike): the spike-only prop `testSet` (`tracer` or `scale30`) picks the fixed data the map draws; `scale30` is the seeded 30-pad stand-in the frame-rate measure uses. Both props stay until the map store and the kind setup replace them.
 
 ![mapstudio-dev at 1440 px](docs/screenshots/mapstudio-dev-1440.png)
 
@@ -33,7 +33,7 @@ Layout:
 | Folder | What lives there |
 | --- | --- |
 | `common/` | component descriptor, props schema (`mapstudio.props.json`), the message contract (`Messages.java`) |
-| `gateway/` | gateway hook and the component model delegate (`MapStudioDelegate`) |
+| `gateway/` | gateway hook and the component model delegate (`MapStudioDelegate`); `system.mapstudio` script functions are in `common/` (`MapStudioScriptModule`: `ping`, `echo`) |
 | `designer/` | the Designer palette entry |
 | `web/` | the TypeScript and React component, MapLibre map, Terra Draw line tool (`DrawControl.tsx`, `draw.ts`), message client (`messages.ts`), the point popup (`PointPopup.tsx`, `popupParams.ts`) and their tests |
 | `e2e/` | the Playwright suite (pinned `@playwright/test`): smoke tests at 1440 and 390 px, the popup checks and the spike's measures |
@@ -54,7 +54,7 @@ The dev Gateway loads the unsigned build (`-Dignition.allowunsignedmodules=true`
 
 ### Platform checks
 
-`ops/checks.sh` answers the spike's Gateway questions on a live 8.3.10 Gateway: it adds PostgreSQL 16 beside the dev Gateway (`ops/docker-compose.checks.yml`), seeds the Gateway's core config collection from `ops/checks/config/core/` (a tag provider, a UDT whose alarm toggles every 30 s, a File secret provider and two database connections), and the module's `gateway/.../spike` package then logs one `CHECK <name> PASS|FAIL <evidence>` line per check for any project that holds a `com.aoindustrial.perspective.mapstudio/setup` resource (`ops/project/.../setup/setup.json`). The PostgreSQL passwords are generated into the git-ignored `ops/checks/secrets/` and reach the Gateway only through its File secret provider. While the checks stack exists, `ops/up.sh`, `down.sh` and `logs.sh` include it automatically and `ops/down.sh --purge` removes it, PostgreSQL volume included. The UDT's alarm is a dev-only test alarm, flagged for engineering review and never for a real Gateway. Results and evidence: [docs/platform-checks.md](docs/platform-checks.md). The spike package is removed by the refactor sweep.
+The spike's Gateway questions (Alarm Metrics subscription, a project script called from module code, `system.mapstudio` functions, a custom project resource, PostgreSQL rights) were answered by a spike package and `ops/checks.sh`, which the refactor sweep removed. Results and evidence are in [docs/platform-checks.md](docs/platform-checks.md); the harness itself is in the history at commit `51104c8`. If you ran it on your machine, its leftovers are yours to remove: the PostgreSQL volume (`docker volume ls`, then `docker volume rm <project>_postgres-data`) and the git-ignored `ops/checks/secrets/` folder.
 
 ## Tests and proof
 
diff --git a/_bmad-output/deferred-work.md b/_bmad-output/deferred-work.md
index 92d05af..c492418 100644
--- a/_bmad-output/deferred-work.md
+++ b/_bmad-output/deferred-work.md
@@ -1,18 +1,65 @@
 - source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/spike-render-a-project-view-by-path-as-a-popup-plan.md`
   summary: Confirm on the Gateway that the popup view's view model stops when the popup closes (and that a p1 to p2 switch, which reuses one mount path, stops the old one).
   evidence: Review finding 2 (quick lens): only the browser side was seen; the Gateway logs nothing at info for a view stop. Settle it with the Perspective session page's view count or a debug logger on `perspective.ViewModel` during `e2e/tests/popup.spec.mjs`, and record it under "Story 4" in `docs/platform-checks.md`.
+  folded: the story 7 entry for the same item (the popup check now lives in `e2e/tests/popup.spec.mjs`; the Gateway side still needs a view count on the Perspective session page or a debug logger on `perspective.ViewModel`) was merged into this one by story 8.
+  goes_to: story 9 (a live Gateway check, no code change; an agent session with a dev Gateway can do it).
+
 - source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-playwright-smoke-suite-and-the-spike-s-measures-plan.md`
   summary: For the epic 1 refactor sweep (story 8) - remove the spike-only `testSet` prop (`common/.../mapstudio.props.json`, `web/typescript/{testSet,scaleData}.ts`) and the dev views `MapStudioScale`, `MapStudioFallbackEmpty` and `MapStudioFallbackMissing`, or keep them as e2e fixtures once the map store supplies test data.
   evidence: Owner's decision 2026-10-26 (story 7, question 4): the 30 pads reach the component through a spike-only prop that is removed in the sweep. The e2e specs `scale.spec.mjs` and `popup.spec.mjs` and the frame rate measure depend on them.
+  resolved: 2026-10-26 story 8 - decided to keep, not remove. The owner's earlier decision (story 7, question 4) to remove `testSet` in the sweep is superseded by the owner's approval of the story 8 plan on 2026-10-26: `scale30` is the only source of the 30-pad frame-rate measure and the owner's headed run needs it before story 9, and the component has no other way to receive data until `map.load` exists. `popupView` stays for the same reason (it is the only way to name a popup view until the kind setup, AD-7).
+  goes_to: epic-map-store-and-data (seed the 30 pads through `system.mapstudio.applyEdits`, then remove `testSet`, `scaleData.ts` and the Scale view) and epic-viewing (the kind setup replaces `popupView`).
+
 - source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-playwright-smoke-suite-and-the-spike-s-measures-plan.md`
   summary: Run `E2E_HEADED=1 npm test` in `e2e/` once on a laptop with a real GPU and add its renderer string and frame rates to the record, before story 9 judges NFR-1.
   evidence: The recorded frame rate is software WebGL on a shared 4-CPU box (5.8 to 15.8 fps for the same view across two runs); NFR-1 asks for 60 fps in a laptop browser and is not decided by it.
+  goes_to: owner action, before story 9 judges NFR-1. Needs `testSet` and the Scale view, which story 8 kept.
+
 - source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-playwright-smoke-suite-and-the-spike-s-measures-plan.md`
   summary: Replace the `values.batch` stand-in (`e2e/lib/valueBatch.mjs`) with a measurement of the real message when epic-viewing builds it.
   evidence: The item layout and the websocket compression are unverified guesses; only the LiveValue fields are fixed by AD-6.
-- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-playwright-smoke-suite-and-the-spike-s-measures-plan.md`
-  summary: Settle the story 4 deferred item (view model stops on popup close) in the e2e suite; the popup check that entry names now lives in `e2e/tests/popup.spec.mjs`.
-  evidence: The browser side of close and the p1 to p2 switch are tested; the Gateway side still needs a view count on the Perspective session page or a debug logger on `perspective.ViewModel`.
+  goes_to: epic-viewing.
+
 - source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-install-through-the-template-s-module-lock-plan.md`
   summary: Possible race in the ign-scada-template (its owner to look): the phone-native-night render of `/well/Mesa/P12/P12-3H/trends` failed once with `Cannot subscribe to "ProjectDefinition" state. "Parts/Asset/Trends/" does not exist`, an embed path whose type segment was still empty.
   evidence: Seen once in the first `scripts/test/stack.sh` run of the story 6 rehearsal; the same page passed in native-day, a re-run of the whole phone-native-night pass passed, and a fresh stack run passed (exit 0). Map Studio is not on that page. Not reproduced on a stack without the module, so unverified whether it predates Map Studio. Owner: `ign-scada-template` (generator `scripts/gen/hmi/pages/asset.py`, `Parts/Asset/Trends/<Type>` embed).
+  goes_to: `ign-scada-template` (its owner; its backlog row is theirs to open). Out of scope for Map Studio.
+
+- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-tracer-a-maplibre-map-on-a-perspective-view-with-one-round-t-plan.md`
+  summary: Remove the 15,704 `web/node_modules` files from the branch history by squashing the story 1 work-in-progress commits before the branch becomes a pull request.
+  evidence: An early WIP commit (13f7a34) swept `web/node_modules` in before it was ignored; `git ls-files` shows none now, but history carries them. Needs the owner's approval for a force-push on the session branch.
+  resolved: 2026-10-26 owner approved; the eleven WIP commits were squashed into one and force-pushed; no commit on the branch contains web/node_modules.
+
+- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-tracer-a-maplibre-map-on-a-perspective-view-with-one-round-t-plan.md`
+  summary: For the epic 1 refactor sweep (story 8) - clear the Gradle 10 deprecations in the build scripts, bump webpack to 5.112 or later to end the npm peer warnings, and fix the build-tool npm audit findings.
+  evidence: The owner's fresh-clone build on 2026-10-26 printed Gradle deprecation warnings (`by extra(...)`, `tasks.registering`, `moduleDependencies`) and npm peer warnings (webpack 5.101.3 pinned, plugins want ^5.112). `npm audit --omit=dev` findings (axios, lodash, moment, @babel/runtime) all come through `@inductiveautomation/perspective-client`, which webpack treats as an external the Gateway provides, so none of them ship in Map Studio's bundle; the rest are build tools only.
+  resolved: 2026-10-26 story 8 - Gradle: `by extra`, `by registering` (3 places) and the `copy {}` and `layout` calls inside task actions are gone, and the empty `moduleDependencies` line (deprecated for `moduleDependencySpecs`) is dropped; webpack 5.112.2, copy-webpack-plugin 14.0.0 and css-minimizer-webpack-plugin 8.0.0 end the peer warnings and the `serialize-javascript` findings; `@inductiveautomation/perspective-client` moved to devDependencies so `npm audit --omit=dev` reports 0. Left, recorded in docs/platform-checks.md (Story 8): the `Project.getProperties` and `Task.project` (`:common:collectModlDependencies`) warnings from the `io.ia.sdk.modl` 0.5.0 plugin (origin read from the task name in the build log, plugin source not read), and 8 `npm audit` findings that come only through the Gateway-provided `perspective-client` (its offered fix is a downgrade to 2.3.9).
+
+- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-ci-builds-signs-and-releases-the-module-plan.md`
+  summary: Real signature verification in `scripts/ci/modl-verify.sh`.
+  evidence: Review found the script only checks that `certificates.p7b` and `signatures.properties` exist, that every file has an entry, and the certificate fingerprint; a forged module carrying the genuine p7b would pass. Before implementing, confirm the plugin's signed-bytes format: `signatures.properties` values are base64 and look like RSA signatures per file (key = `/<archive path>`), probably SHA256withRSA over the file bytes, but this was not checked against the `io.ia.sdk.modl` 0.5.0 / module-signer source. Until then the Gateway's install-time check is the cryptographic one (stated in README and RELEASING.md).
+  goes_to: not scheduled. Owner decision 2026-10-26 (story 8 plan): stays deferred; the Gateway verifies the signatures at install. A ticket entry that first reads the `io.ia.sdk.modl` signing source is the owner's call.
+
+- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/spike-gateway-platform-checks-plan.md`
+  summary: Verify in the Designer on the ms-s3 Gateway that `system.mapstudio.` autocompletes with its description and that saving the `setup` project resource logs `CHECK setup-modified` (the `onResourcesModified` path).
+  evidence: Both are claims the spike could not exercise without a Designer or an API key; the record marks them [not verified]. One Designer session settles both.
+  goes_to: owner action, then story 9. Run it on the released v0.1.0 module or on commit 51104c8: story 8 removes the code behind `CHECK setup-modified`; `system.mapstudio.ping` and `echo` stay, so the autocomplete check still works on a current build.
+
+- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/spike-gateway-platform-checks-plan.md`
+  summary: For the epic 1 refactor sweep (story 8) - remove the `gateway/.../spike` package, the `mapstudio_checks` project script and the `setup` resource of the dev project, or keep `ops/checks.sh` as a regression harness; decide once story 9 has compiled the record.
+  evidence: The spike code runs on every runnable project that holds a setup resource and logs FAIL warnings on story 1's plain dev Gateway; the real setup (AD-5), scripting API (AD-18) and migrations (AD-21) replace it in epic-map-store-and-data.
+  resolved: 2026-10-26 story 8 - removed: the `gateway/.../spike` package and its tests, the `mapstudio_checks` project script, the `setup` resource, `MapStudioModule.SETUP_RESOURCE_TYPE`, `ops/checks.sh`, `ops/checks/`, `ops/docker-compose.checks.yml` (the PostgreSQL dev stack) and their `lib.sh` hooks. No harness is kept: it only read the removed package's `CHECK` lines. Recoverable at commit 51104c8 and in the v0.1.0 tag (the tag is not in the clone this was done in, unverified); the evidence stays in docs/platform-checks.md.
+
+- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/spike-gateway-platform-checks-plan.md`
+  summary: Decide the Designer editor for the setup resource in epic-map-store-and-data (about 300 lines of Swing from IA's project-resource example, or the script-function fallback of AD-5).
+  evidence: Owner's decision 2026-10-26 (Open Question 1, option a); the estimate is in `docs/platform-checks.md`, check 4.
+
+- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-refactor-sweep-plan.md`
+  summary: Triage leftovers of stories 1, 2 and 7 that need features: a late reply clears the pending state of a newer click, a theme switch does not repaint the map, two phone probes fail (44 px targets, the 21 x 22 px popup close button), Terra Draw dash arrays and the `access-denied` view state were never exercised.
+  evidence: Review Triage Logs of stories 1 and 7 and `docs/platform-checks.md` (stories 2, 4, 7). All unverified or tracer-only.
+  goes_to: epic-viewing (reply correlation via `map.changed`, theme following AD-11, dash arrays), epic-phone (touch targets), and a view-permission test in the story 9 list for `access-denied`.
+
+- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-refactor-sweep-plan.md`
+  summary: CI steps never executed in a runner when written (`download-artifact`, `setup-node`, the Playwright browser cache and `playwright install --with-deps`), and `shellcheck` and `actionlint` were never run on the scripts and workflows.
+  evidence: Story 5 and 7 Implementation Notes marked them unverified. Story 8 could not read the GitHub run status (the repository is not attached to its session). Adding shellcheck or actionlint to CI is a new gate, not cleanup.
+  goes_to: owner (check the Actions run on `main`; decide on the two linters).
diff --git a/_bmad-output/initiative-flowmap/deferred-work.md b/_bmad-output/initiative-flowmap/deferred-work.md
deleted file mode 100644
index 14e1bf3..0000000
diff --git a/build.gradle.kts b/build.gradle.kts
index 2ed0db1..8fcd971 100644
--- a/build.gradle.kts
+++ b/build.gradle.kts
@@ -12,7 +12,8 @@ plugins {
 
 // The lowest Ignition the module supports. Java compiles against this SDK so
 // that nothing newer than the minimum is used by accident.
-val sdk_version by extra("8.3.0")
+val sdk_version = "8.3.0"
+extra["sdk_version"] = sdk_version
 
 allprojects {
     // Release builds pass -PreleaseVersion=<tag>; local builds carry a SNAPSHOT.
@@ -46,8 +47,6 @@ ignitionModule {
         ":gateway" to "G"
     ))
 
-    moduleDependencies.set(mapOf<String, String>())
-
     moduleDependencySpecs {
         register("com.inductiveautomation.perspective") {
             scope = "GD"
@@ -70,19 +69,25 @@ ignitionModule {
 
 // The licence notice ships inside the .modl and is shown at install time. The
 // plugin has no property for it, so the file is staged into the module content
-// and referenced from module.xml.
+// and referenced from module.xml. Both steps use values captured here at
+// configuration time (no project access inside a task action, which Gradle 10
+// refuses).
+val moduleContentDir = layout.buildDirectory.dir("moduleContent")
+val moduleXmlFile = layout.buildDirectory.file("moduleContent/module.xml")
+
+val stageLicense = tasks.register<Copy>("stageLicense") {
+    from("license.html")
+    into(moduleContentDir)
+}
+
 tasks.named("assembleModlStructure") {
-    doLast {
-        copy {
-            from("license.html")
-            into(layout.buildDirectory.dir("moduleContent"))
-        }
-    }
+    finalizedBy(stageLicense)
 }
 
 tasks.named("zipModule") {
+    dependsOn(stageLicense)
     doFirst {
-        val moduleXml = layout.buildDirectory.file("moduleContent/module.xml").get().asFile
+        val moduleXml = moduleXmlFile.get().asFile
         val content = moduleXml.readText()
         if (!content.contains("<license>")) {
             moduleXml.writeText(
diff --git a/common/src/main/java/com/aoindustrial/perspective/mapstudio/common/MapStudioModule.java b/common/src/main/java/com/aoindustrial/perspective/mapstudio/common/MapStudioModule.java
index 1e5fafc..2379160 100644
--- a/common/src/main/java/com/aoindustrial/perspective/mapstudio/common/MapStudioModule.java
+++ b/common/src/main/java/com/aoindustrial/perspective/mapstudio/common/MapStudioModule.java
@@ -3,7 +3,6 @@ package com.aoindustrial.perspective.mapstudio.common;
 import java.util.Set;
 
 import com.inductiveautomation.ignition.common.jsonschema.JsonSchema;
-import com.inductiveautomation.ignition.common.resourcecollection.ResourceType;
 import com.inductiveautomation.perspective.common.api.BrowserResource;
 
 /**
@@ -17,13 +16,6 @@ public final class MapStudioModule {
     /** Module id; must match {@code id} in the root build.gradle.kts. */
     public static final String MODULE_ID = "com.aoindustrial.perspective.mapstudio";
 
-    /**
-     * The project setup resource (AD-5): one per project, stored in the project
-     * folder as {@code com.aoindustrial.perspective.mapstudio/setup/setup.json}.
-     * Shared by the gateway (read) and, later, the designer (edit).
-     */
-    public static final ResourceType SETUP_RESOURCE_TYPE = new ResourceType(MODULE_ID, "setup");
-
     /** Mount alias: the web bundle is served at {@code /res/<URL_ALIAS>/}. */
     public static final String URL_ALIAS = "mapstudio";
 
diff --git a/common/src/main/resources/mapstudio.props.json b/common/src/main/resources/mapstudio.props.json
index f4ff893..5b4472a 100644
--- a/common/src/main/resources/mapstudio.props.json
+++ b/common/src/main/resources/mapstudio.props.json
@@ -34,7 +34,7 @@
     "testSet": {
       "type": "string",
       "enum": ["tracer", "scale30"],
-      "description": "Spike-only (story 7): the fixed test data the map draws. 'tracer' is three points and a line; 'scale30' is a seeded 30-pad stand-in for the template's scale set, used to measure frame rate. Removed in the refactor sweep.",
+      "description": "Spike-only (story 7): the fixed test data the map draws. 'tracer' is three points and a line; 'scale30' is a seeded 30-pad stand-in for the template's scale set, used to measure frame rate. Removed when the map store supplies the data (epic-map-store-and-data).",
       "default": "tracer"
     },
     "style": {
diff --git a/docs/architecture.md b/docs/architecture.md
index 929a4ca..56f65a1 100644
--- a/docs/architecture.md
+++ b/docs/architecture.md
@@ -121,4 +121,4 @@ CI builds and signs the `.modl` and publishes it as a GitHub release. Projects i
 
 ## Still open
 
-The spike checks four platform questions before feature work starts: whether Java subscriptions reach Alarm Metrics, whether a component can open a project view as a popup, whether module code can call project scripts and add `system.mapstudio` functions, and whether MapLibre 6 builds with Perspective's toolchain. A fifth, whether Mapbox's terms allow satellite tiles in MapLibre (AD-12), is for the owner to settle. The spine lists each question with its fallback.
+The spike's four platform questions are answered, with evidence and fallbacks, in `docs/platform-checks.md`: whether Java subscriptions reach Alarm Metrics, whether a component can open a project view as a popup, whether module code can call project scripts and add `system.mapstudio` functions, and whether MapLibre 6 builds with Perspective's toolchain. The go or no-go report (story 9) judges them. Whether Mapbox's terms allow satellite tiles in MapLibre (AD-12) is for the owner to settle. The spine lists each question with its fallback.
diff --git a/docs/platform-checks.md b/docs/platform-checks.md
index b9536ea..0d46857 100644
--- a/docs/platform-checks.md
+++ b/docs/platform-checks.md
@@ -1,6 +1,6 @@
 # Platform checks
 
-The spike's platform questions (epic-module-foundation R3), each answered on a live Ignition 8.3.10 Gateway with its evidence and the fallback taken where it failed. One section per spike story; a story edits only its own section. Story 9 compiles these into the go or no-go report and carries the answers into claude-ignition-skills.
+The spike's platform questions (epic-module-foundation R3), each answered on a live Ignition 8.3.10 Gateway with its evidence and the fallback taken where it failed. One section per spike story; a story edits only its own section. Story 9 compiles these into the go or no-go report and carries the answers into claude-ignition-skills. The code and scripts that produced the Story 3 evidence were removed by Story 8 (see its section); they stay readable at commit `51104c8`.
 
 Labels: **[live 8.3.10]** seen on the `ops/` dev Gateway (`inductiveautomation/ignition:8.3.10`); **[build]** seen in this repository's build or tests; **[npm metadata]** read from the package registry; **[client typings]** read from `@inductiveautomation/perspective-client` 2.3.10, the package matching 8.3.10; **[bundle]** read from Perspective's own `PerspectiveMap` browser bundle inside the 8.3.10 Perspective module; **[SDK 8.3.0 javap]** read from the SDK jars' signatures, not run; **[IA docs]** from the IA 8.3 manual; **[unverified]** or **[not verified]** not checked here.
 
@@ -227,3 +227,31 @@ Findings feed the phone epic and the viewing epic's bottom sheet (PRD: touch tar
 ### Not covered
 
 Hours to a green build (story 9 compiles it); the 60 fps NFR-1 verdict on a real GPU; a value batch from a real `values.batch`; real touch hardware.
+
+## Story 8 - Refactor sweep
+
+Cleanup only; no platform question here. Date: 2026-10-26.
+
+**Removed:** the Story 3 spike code (`gateway/.../spike/` and its three test classes, `MapStudioModule.SETUP_RESOURCE_TYPE`), the `mapstudio_checks` project script, the `setup` project resource, `ops/checks.sh`, `ops/checks/`, `ops/docker-compose.checks.yml` (the PostgreSQL 16 dev stack) and the checks hooks in `ops/lib.sh`. Nothing in `e2e/` used them. The module no longer logs `CHECK` lines. Kept: `MapStudioScriptModule` (`system.mapstudio.ping` and `echo`) and its registration in both hooks, because the Designer autocomplete check is still open (see below). Recovery: commit `51104c8` and the v0.1.0 release tag (not in the clone the sweep ran in, **[unverified]** here). The Story 3 section above remains the record of the answers.
+
+**Kept on purpose:** `popupView`, `testSet` (`scale30`), the dev views `MapStudioScale`, `MapStudioFallbackEmpty` and `MapStudioFallbackMissing` and their pages, so the popup, scale and measures specs keep their coverage. The owner's earlier decision to remove `testSet` in the sweep was superseded on 2026-10-26 (the 30-pad measure and the headed run need it; the component has no other way to receive data until the map store exists). They go with epic-map-store-and-data and epic-viewing.
+
+**Build tools** (Gradle 9.8.0, `./gradlew build --warning-mode all`, JDK 21 running Gradle with a JDK 17 toolchain) **[build]**:
+
+| Warning or finding | Before | After |
+| --- | --- | --- |
+| `val x by extra(...)` (`build.gradle.kts`) | deprecated, fails in Gradle 10 | `extra["sdk_version"] = ...` |
+| `val x by tasks.registering(...)` (`web/build.gradle.kts` twice) | deprecated | `tasks.register<NpmTask>(...)` |
+| `Task.project` at execution time from our `copy {}` in `doLast` and `layout` in `doFirst` | deprecated | a `Copy` task and values captured at configuration time; `module.xml` and the file list are unchanged |
+| `moduleDependencies` (owner's fresh clone) | not reproduced with `--warning-mode all` on the first run; appeared as a compile warning after the script changed | line removed; `moduleDependencySpecs` already declares the Perspective dependency |
+| `Project.getProperties` and `Task.project` in `:common:collectModlDependencies` | present | **left**: raised by the `io.ia.sdk.modl` 0.5.0 plugin as far as the build log shows (plugin source not read) |
+| npm peer warnings (webpack 5.101.3 against `^5.112`) | 4 `ERESOLVE` blocks | none; webpack 5.112.2 |
+| `npm audit` | 12 (1 low, 7 moderate, 4 high) | 8 (5 moderate, 3 high); `npm audit --omit=dev` reports 0 |
+
+The 8 remaining findings (`axios`, `lodash`, `moment`, `@babel/runtime` and the `react-swipeable-views` packages) all come through `@inductiveautomation/perspective-client`, which webpack treats as an external the Gateway provides, so none of them is in the bundle; npm's offered fix is a downgrade to 2.3.9, which does not match 8.3.10 and was not taken. The client moved to `devDependencies` (it is used at build time only) **[build]**; whether any other tool reads `dependencies` was not checked. The `serialize-javascript` findings went with `copy-webpack-plugin` 14.0.0 and `css-minimizer-webpack-plugin` 8.0.0 (both accept Node 20.9 or later and webpack 5 **[npm metadata]**).
+
+**Bundle** (production, served by the dev Gateway): `MapStudio.js` 1,179,848 to 1,179,814 bytes, `MapStudio.css` 72,208 to 72,518, worker unchanged at 517,065. The unsigned `.modl` went from 510,041 to 488,266 bytes: the only entries removed are the eight `gateway/.../spike` classes; `module.xml` is identical, including `<license>`. `docs/spike-measures.json` and the screenshots were not rewritten (Story 9 compiles them from the v0.1.0 run).
+
+**Verification:** `./gradlew build` green with Jest 32 and 6 Gateway tests (was 18); `npm test` in `e2e/` 10 of 10 on a fresh dev Gateway (`ms-s8`), no `CHECK` line and no Map Studio warning or error in the Gateway log; `scripts/ci/test-signing.sh` passes. A dev Gateway restarted with a leftover `setup` resource in the project started the project and the module, with no `CHECK` line and no Map Studio warning or error **[live 8.3.10]**.
+
+**Still with the owner (listed for Story 9):** the headed frame-rate run; the Designer checks for `system.mapstudio.` autocomplete and `CHECK setup-modified` (run the second on the v0.1.0 module or on `51104c8`: the code behind it is gone from the current tree).
diff --git a/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/MapStudioGatewayHook.java b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/MapStudioGatewayHook.java
index 75faec4..b50a508 100644
--- a/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/MapStudioGatewayHook.java
+++ b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/MapStudioGatewayHook.java
@@ -15,7 +15,6 @@ import com.inductiveautomation.perspective.gateway.api.PerspectiveContext;
 import com.aoindustrial.perspective.mapstudio.common.MapStudioComponent;
 import com.aoindustrial.perspective.mapstudio.common.MapStudioModule;
 import com.aoindustrial.perspective.mapstudio.common.MapStudioScriptModule;
-import com.aoindustrial.perspective.mapstudio.gateway.spike.ChecksLifecycleFactory;
 
 /**
  * Gateway scope hook: registers the component and its model delegate on
@@ -28,14 +27,10 @@ public class MapStudioGatewayHook extends AbstractGatewayModuleHook {
     private GatewayContext gatewayContext;
     private ComponentRegistry componentRegistry;
     private ComponentModelDelegateRegistry delegateRegistry;
-    private ChecksLifecycleFactory checks;
 
     @Override
     public void setup(GatewayContext context) {
         this.gatewayContext = context;
-        // Spike (story 3): the platform checks run for any runnable project that
-        // holds a Map Studio setup resource. Removed by the refactor sweep.
-        this.checks = new ChecksLifecycleFactory(context);
     }
 
     /** Adds {@code system.mapstudio.*} to Gateway and project script scopes (AD-18). */
@@ -63,17 +58,10 @@ public class MapStudioGatewayHook extends AbstractGatewayModuleHook {
         } else {
             log.error("Perspective model delegate registry not found; the Map Studio delegate is not registered.");
         }
-
-        if (this.checks != null) {
-            this.checks.startup();
-        }
     }
 
     @Override
     public void shutdown() {
-        if (this.checks != null) {
-            this.checks.shutdown();
-        }
         if (this.componentRegistry != null) {
             this.componentRegistry.removeComponent(MapStudioComponent.COMPONENT_ID);
         }
diff --git a/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/AlarmMetricsCheck.java b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/AlarmMetricsCheck.java
deleted file mode 100644
index 403a9b2..0000000
diff --git a/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/CheckResult.java b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/CheckResult.java
deleted file mode 100644
index df4e84a..0000000
diff --git a/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ChecksLifecycle.java b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ChecksLifecycle.java
deleted file mode 100644
index 1299a5b..0000000
diff --git a/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ChecksLifecycleFactory.java b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ChecksLifecycleFactory.java
deleted file mode 100644
index 9308e03..0000000
diff --git a/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/PostgresCheck.java b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/PostgresCheck.java
deleted file mode 100644
index b5f5086..0000000
diff --git a/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ProjectScriptCheck.java b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ProjectScriptCheck.java
deleted file mode 100644
index 5a8404b..0000000
diff --git a/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/SetupResource.java b/gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/SetupResource.java
deleted file mode 100644
index 84c5969..0000000
diff --git a/gateway/src/test/java/com/aoindustrial/perspective/mapstudio/gateway/spike/AlarmMetricsCheckTest.java b/gateway/src/test/java/com/aoindustrial/perspective/mapstudio/gateway/spike/AlarmMetricsCheckTest.java
deleted file mode 100644
index c7c31ea..0000000
diff --git a/gateway/src/test/java/com/aoindustrial/perspective/mapstudio/gateway/spike/PostgresCheckTest.java b/gateway/src/test/java/com/aoindustrial/perspective/mapstudio/gateway/spike/PostgresCheckTest.java
deleted file mode 100644
index a55e70c..0000000
diff --git a/gateway/src/test/java/com/aoindustrial/perspective/mapstudio/gateway/spike/SetupResourceTest.java b/gateway/src/test/java/com/aoindustrial/perspective/mapstudio/gateway/spike/SetupResourceTest.java
deleted file mode 100644
index ebe44f4..0000000
diff --git a/ops/checks.sh b/ops/checks.sh
deleted file mode 100755
index 0a00e57..0000000
diff --git a/ops/checks/config/core/config-mode.json b/ops/checks/config/core/config-mode.json
deleted file mode 100644
index 6c5d871..0000000
diff --git a/ops/checks/config/core/ignition/database-connection/MapStudio/config.json b/ops/checks/config/core/ignition/database-connection/MapStudio/config.json
deleted file mode 100644
index e7df92c..0000000
diff --git a/ops/checks/config/core/ignition/database-connection/MapStudio/resource.json b/ops/checks/config/core/ignition/database-connection/MapStudio/resource.json
deleted file mode 100644
index 3106771..0000000
diff --git a/ops/checks/config/core/ignition/database-connection/MapStudioNoRights/config.json b/ops/checks/config/core/ignition/database-connection/MapStudioNoRights/config.json
deleted file mode 100644
index 5d8c4a4..0000000
diff --git a/ops/checks/config/core/ignition/database-connection/MapStudioNoRights/resource.json b/ops/checks/config/core/ignition/database-connection/MapStudioNoRights/resource.json
deleted file mode 100644
index 5102dcb..0000000
diff --git a/ops/checks/config/core/ignition/secret-provider/MapStudioFiles/config.json b/ops/checks/config/core/ignition/secret-provider/MapStudioFiles/config.json
deleted file mode 100644
index e03d916..0000000
diff --git a/ops/checks/config/core/ignition/secret-provider/MapStudioFiles/resource.json b/ops/checks/config/core/ignition/secret-provider/MapStudioFiles/resource.json
deleted file mode 100644
index 12ae351..0000000
diff --git a/ops/checks/config/core/ignition/tag-definition/default/Checks/udts.json b/ops/checks/config/core/ignition/tag-definition/default/Checks/udts.json
deleted file mode 100644
index 7b2237a..0000000
diff --git a/ops/checks/config/core/ignition/tag-definition/default/Checks/unary-resource.json b/ops/checks/config/core/ignition/tag-definition/default/Checks/unary-resource.json
deleted file mode 100644
index a0e6e89..0000000
diff --git a/ops/checks/config/core/ignition/tag-provider/default/config.json b/ops/checks/config/core/ignition/tag-provider/default/config.json
deleted file mode 100644
index f1e87de..0000000
diff --git a/ops/checks/config/core/ignition/tag-provider/default/resource.json b/ops/checks/config/core/ignition/tag-provider/default/resource.json
deleted file mode 100644
index f483207..0000000
diff --git a/ops/checks/config/core/ignition/tag-type-definition/default/Checks/udts.json b/ops/checks/config/core/ignition/tag-type-definition/default/Checks/udts.json
deleted file mode 100644
index 0dedae4..0000000
diff --git a/ops/checks/config/core/ignition/tag-type-definition/default/Checks/unary-resource.json b/ops/checks/config/core/ignition/tag-type-definition/default/Checks/unary-resource.json
deleted file mode 100644
index a0e6e89..0000000
diff --git a/ops/checks/postgres-init.sh b/ops/checks/postgres-init.sh
deleted file mode 100755
index cc3bbf7..0000000
diff --git a/ops/docker-compose.checks.yml b/ops/docker-compose.checks.yml
deleted file mode 100644
index 3317628..0000000
diff --git a/ops/down.sh b/ops/down.sh
index 293e4b2..47d4b48 100755
--- a/ops/down.sh
+++ b/ops/down.sh
@@ -3,9 +3,6 @@
 # (trial state, commissioning, module acceptance). The committed project in
 # ops/project is a bind mount and is never touched.
 #
-# While the platform checks stack exists (ops/checks.sh), it is included
-# automatically: --purge then removes the PostgreSQL container and volume too.
-#
 # Usage: ops/down.sh [--purge]
 
 source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
diff --git a/ops/lib.sh b/ops/lib.sh
index b0a6d56..73f9843 100755
--- a/ops/lib.sh
+++ b/ops/lib.sh
@@ -53,43 +53,6 @@ if [[ -n "${MAPSTUDIO_CONTAINER:-}" ]]; then
   COMPOSE+=(-p "${MAPSTUDIO_CONTAINER}")
 fi
 COMPOSE+=(-f "${OPS_DIR}/docker-compose.yml")
-COMPOSE_PROJECT="${MAPSTUDIO_CONTAINER:-$(basename "${OPS_DIR}")}"
-
-# The platform checks' compose file (PostgreSQL and the checks' Gateway config on
-# the same compose project) is added with MAPSTUDIO_CHECKS=1 (ops/checks.sh), and
-# automatically while the checks stack exists for this project (its PostgreSQL
-# volume is there), so that up.sh, down.sh and logs.sh see the whole stack and
-# down.sh --purge removes it. The volume probe needs Docker; when Docker is down
-# it simply finds nothing.
-CHECKS_SECRETS_DIR="${OPS_DIR}/checks/secrets"
-checks_stack_exists() {
-  docker volume inspect "${COMPOSE_PROJECT}_postgres-data" >/dev/null 2>&1
-}
-if [[ "${MAPSTUDIO_CHECKS:-}" == "1" ]] || checks_stack_exists; then
-  COMPOSE+=(-f "${OPS_DIR}/docker-compose.checks.yml")
-  MAPSTUDIO_CHECKS=1
-fi
-
-# The PostgreSQL passwords of the platform checks: generated once into the
-# git-ignored ops/checks/secrets/ (letters and digits, no trailing newline
-# because the Gateway's File secret provider reads every byte) and handed to
-# the containers as Docker secrets. Never committed, never in a log.
-# Compose bind-mounts a file secret with its host mode, and the containers read
-# it as other users (postgres, ignition uid 2003), so the files are 0644 inside
-# a 0700 folder: hidden from other local users, readable inside the containers.
-ensure_checks_secrets() {
-  mkdir -p "${CHECKS_SECRETS_DIR}"
-  chmod 700 "${CHECKS_SECRETS_DIR}"
-  local name
-  for name in pg_password pg_ro_password; do
-    if [[ ! -s "${CHECKS_SECRETS_DIR}/${name}" ]]; then
-      # Letters and digits only, so the file is safe anywhere it is quoted.
-      ( umask 077; head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24 \
-          > "${CHECKS_SECRETS_DIR}/${name}" )
-    fi
-    chmod 644 "${CHECKS_SECRETS_DIR}/${name}"
-  done
-}
 
 # --- logging --------------------------------------------------------------
 if [[ -t 1 ]]; then
diff --git a/ops/project/com.aoindustrial.perspective.mapstudio/setup/resource.json b/ops/project/com.aoindustrial.perspective.mapstudio/setup/resource.json
deleted file mode 100644
index 11a2e63..0000000
diff --git a/ops/project/com.aoindustrial.perspective.mapstudio/setup/setup.json b/ops/project/com.aoindustrial.perspective.mapstudio/setup/setup.json
deleted file mode 100644
index f788847..0000000
diff --git a/ops/project/ignition/script-python/mapstudio_checks/code.py b/ops/project/ignition/script-python/mapstudio_checks/code.py
deleted file mode 100644
index e3694de..0000000
diff --git a/ops/project/ignition/script-python/mapstudio_checks/resource.json b/ops/project/ignition/script-python/mapstudio_checks/resource.json
deleted file mode 100644
index e160ebe..0000000
diff --git a/ops/up.sh b/ops/up.sh
index c687635..05170e3 100755
--- a/ops/up.sh
+++ b/ops/up.sh
@@ -7,10 +7,6 @@
 #                       (ACCEPT_MODULE_* in docker-compose.yml); no browser wizard.
 #   ops/up.sh --fresh   Wipe the Gateway data first (fresh trial, fresh acceptance).
 #   ops/up.sh --no-build  Skip the Gradle build; stage nothing, just (re)start.
-#
-# While the platform checks stack exists (ops/checks.sh), its compose file is
-# included automatically, so the restart covers PostgreSQL too; --fresh then
-# wipes both volumes. Without it, this is the plain tracer Gateway.
 
 source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
 
diff --git a/scripts/ci/modl-verify.sh b/scripts/ci/modl-verify.sh
index 89ed48a..b1e1849 100755
--- a/scripts/ci/modl-verify.sh
+++ b/scripts/ci/modl-verify.sh
@@ -11,7 +11,7 @@
 # certificate in the archive has the expected fingerprint and that module.xml
 # has the expected version. A forged module that carries the genuine
 # certificates.p7b would pass. The cryptographic check is the Gateway's, when
-# the module is installed (see deferred-work.md: real signature verification
+# the module is installed (see _bmad-output/deferred-work.md: real signature verification
 # is a deferred item).
 #
 # certificates.p7b must be a PKCS#7 bundle (DER or PEM), not a bare certificate:
diff --git a/web/build.gradle.kts b/web/build.gradle.kts
index 4621e8b..64aca32 100644
--- a/web/build.gradle.kts
+++ b/web/build.gradle.kts
@@ -28,7 +28,7 @@ node {
 // Production build by default so every .modl is ship quality; -PwebDev gives
 // the unminified build with source maps for debugging.
 val webDev = project.hasProperty("webDev")
-val webpack by tasks.registering(NpmTask::class) {
+val webpack = tasks.register<NpmTask>("webpack") {
     group = "Ignition Module"
     description = "Builds the web bundle with webpack (-PwebDev for a development build)."
     args.set(listOf("run", if (webDev) "build:dev" else "build"))
@@ -39,7 +39,7 @@ val webpack by tasks.registering(NpmTask::class) {
     outputs.dir(projectOutput)
 }
 
-val jestTest by tasks.registering(NpmTask::class) {
+val jestTest = tasks.register<NpmTask>("jestTest") {
     group = "verification"
     description = "Runs the web unit tests with Jest."
     args.set(listOf("test"))
diff --git a/web/package.json b/web/package.json
index 54c3670..ec5d2af 100644
--- a/web/package.json
+++ b/web/package.json
@@ -11,7 +11,6 @@
         "typecheck": "tsc --noEmit"
     },
     "dependencies": {
-        "@inductiveautomation/perspective-client": "2.3.10",
         "maplibre-gl": "6.16.0",
         "react": "16.14.0",
         "react-dom": "16.14.0",
@@ -19,20 +18,21 @@
         "terra-draw-maplibre-gl-adapter": "1.5.0"
     },
     "devDependencies": {
+        "@inductiveautomation/perspective-client": "2.3.10",
         "@types/geojson": "7946.0.16",
         "@types/jest": "29.5.14",
         "@types/node": "22.19.1",
         "@types/react": "16.14.65",
         "@types/react-dom": "16.9.25",
-        "copy-webpack-plugin": "12.0.2",
+        "copy-webpack-plugin": "14.0.0",
         "css-loader": "6.11.0",
-        "css-minimizer-webpack-plugin": "5.0.1",
+        "css-minimizer-webpack-plugin": "8.0.0",
         "jest": "29.7.0",
         "mini-css-extract-plugin": "2.9.2",
         "ts-jest": "29.4.4",
         "ts-loader": "9.5.2",
         "typescript": "4.9.5",
-        "webpack": "5.101.3",
+        "webpack": "5.112.2",
         "webpack-cli": "5.1.4"
     }
 }

```
