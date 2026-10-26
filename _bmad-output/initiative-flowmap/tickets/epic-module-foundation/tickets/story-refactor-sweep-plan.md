---
title: 'Refactor sweep'
type: 'refactor'
ticket: '8'
created: '2026-10-26'
status: 'in-progress'
baseline_revision: '51104c889817dc9d01136807786963e58d8172b8'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: ''
review_source: ''
lenses_ran: []
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
