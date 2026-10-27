---
title: 'Refactor sweep'
type: 'refactor'
ticket: '12'
created: '2026-10-27'
status: 'built'
baseline_revision: '40298071268fc360260fe568d66369ffb35d5694'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/docs/contract.md'
  - '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-refactor-sweep-plan.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Stories 1 to 11, 14 and 15 were built in parallel and left a known carry-over (story 15's `TagPaths.ASSET_PATH` literal), an owner-accepted polish (a kind setup conflict names the kind by id), duplicated helpers (two ways to echo browser text, a phone-or-full check in three places, nine copies of the dev views' role read, five copies of the e2e `drawLine`, five `isRecord`), three ordering sleeps in `AdapterServiceTest`, docs that disagree with the code or each other, and `[unverified]` lines that a test assertion can close.

**Approach:** Sweep only what is cleanup (the disposition table in Design Notes decides every item), change no message shape, prop, error code list, setup or kind setup schema, migration or documented script function, and prove the build, Jest, Gateway tests, the e2e suite and `ops/store-checks.sh` still pass.

## Boundaries & Constraints

**Always:** Cleanup only. Message text may change only for item M2 (owner, 2026-10-27) and where a shared echo replaces a local one (M3). Keep `popupView`, the spike "Draw a line" tool, the dev fallback views, `system.mapstudio.ping`. Every Ignition claim not seen live is marked **[unverified]**. No em dashes (use " - "), no secret in git. `CONTRACT_VERSION` stays `0.2.0-draft`.

**Never:** Add a feature, a migration, a message type or field, an error code, a setup or kind setup field. Tighten or loosen any validation rule. Edit `tickets.toml`, a ticket file or another story's plan. Touch `ign-scada-template`. Push, tag or release. Remove `CODE_STALE` (kept reserved, Decision 2).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Kind setup conflict, kind in the list | stale update of kind setup `pad`, kind list names it "Well pad" | "The Well pad kind setup was changed by X at HH:mm UTC since you loaded it. Nothing in this save was written." | code `conflict`, body unchanged |
| Kind setup conflict, kind not in the list | stale op on kind id `old` (no kind row) | "The old kind setup ..." (today's wording) | same |
| Kind name with a newline or 10 kB | host kind name | echoed by `Rows.echo` (64 characters, control characters to `?`) | same |
| Tag path echo | `tags.resolve` path with a newline, 200 characters | one line, `Rows.echo` form | code `invalid` |

## Decisions

**2026-10-27, owner ("agree with all recommendations"):** (1) one story, the whole plan is kept (about 4,000 tokens, accepted); (2) `CODE_STALE` stays reserved, and `docs/contract.md` and the `Messages.java` comment say so; (3) both tag path rules stay, the difference is recorded for epic-editing in `_bmad-output/deferred-work.md`; (4) `Rows.echo` is used as it is (64 characters) for tag paths too; (5) the four live e2e assertions are added. Also in this sweep (owner, same day): `docs/setup-editor.md` drops the Gateway-restart wording (story 6 applies a saved change without one) and says `"basemaps": null` is read as the default list (`none`, `osm`), as the Gateway reads it since the group A integration; `docs/setup-editor.md` and `docs/platform-checks.md` record, dated 2026-10-27 and labelled **[owner, seen in the Designer 2026-10-27]**, that the owner opened the Map Studio Setup tab on 8.3.10 and it showed the dev setup's values correctly (the save failed on a dev-stack file permission, fixed in a separate change). The Designer setup form itself is not changed here (a new story redesigns it), and neither is the dev stack's bind mount or `ops/docker-compose.yml`.

</frozen-after-approval>

## Code Map

Paths: `C` = `common/src/main/java/com/aoindustrial/perspective/mapstudio/common`, `G` = `gateway/src/main/java/.../gateway`, `GT` = `gateway/src/test/java/.../gateway`, `W` = `web/typescript`.

- `C/contract/TagPaths.java:30` -- own `ASSET_PATH = "{asset.path}"` (comment "Story 9 owns the closed placeholder list"); `echo` at line 195 (80 characters, no control-character filter). `C/contract/Placeholders.java:37` -- the owning `ASSET_PATH`; `isAssetSuffix`/`checkTagPath` are a separate, looser tag path rule (Decision 3; not touched).
- `C/contract/Rows.java:111` -- `Rows.echo`, the one echo to reuse. `G/tags/TagLookups.java:275` -- second local `echo` (80 characters).
- `G/write/ConflictReport.java:60` -- `"The " + c.id() + " kind setup"`; `G/write/WriteService.java:122,142` -- `kinds` (`Map<String, Kind>`, read once per batch) is in scope where `new ConflictReport()` is made; pass it in. `GT/write/WriteServiceKindSetupTest.java:82` asserts the message start.
- `G/MapStudioDelegate.java:156,329`, `G/load/MapLoader.java:107` -- `LEVEL_PHONE || LEVEL_FULL` written out three times; `G/write/RoleMatrix.java` gets `isEditor(String level)`.
- `G/store/StoreRegistry.java:308-334` -- `rightsMessage`, `firstLine`, `oneLine`: "kept for callers of story 1", only caller `GT/store/MigrationsTest.java:57`; `G/store/FailureLine.java:140,155` has the live copies. `oneLine` is also used by `StoreRegistry.probe` (lines 219, 222): switch it to `FailureLine.oneLine`.
- `GT/adapter/AdapterServiceTest.java:229,511,531` -- `Thread.sleep` then "nothing more happened" asserts (pass vacuously when slow); `waitFor` (line 585) and the fake caller's latches exist to reuse. Other Java timing: latches and bounded `get` (fine); `manyOverlappingRefreshesAllSettle` random sleeps are a stress test (keep).
- `C/Messages.java:85` -- `CODE_STALE` "used from entry 4"; nothing sends it (grep). `GT/change/ChangeBusTest.java:214` -- stale "until entry 3" comment.
- `W/{adapters,changes,contract,messages,unsaved}.ts` -- five identical private `isRecord`.
- `e2e/tests/{changes,unsaved,store-ops,writepath,store}.spec.mjs` -- identical `drawLine` (unsaved adds `dy -200`) and `VERTEX_PAUSE_MS = 300` (also `tracer.spec.mjs`); `e2e/tests/fixtures.mjs` is the shared home. `e2e/tests/adapters.spec.mjs:130` -- a 1 s ordering wait inside the 5 s slow window (keep unless an observable exists; comment the margin). Polling loops in `setup.spec`/`store-ops.spec` are bounded retries (fine).
- `ops/project/com.inductiveautomation.perspective/views/{MapStudioEdit,MapStudioAdapters}/view.json` -- nine script copies of the `self.session.props.auth.user.roles` read and `MapEditor` test; `ops/project/ignition/script-python/mapstudio_dev/code.py` gets one `holdsMapEditor(session)` (both exception handlers, per the repo's Jython rules).
- Docs found stale: `README.md` "Message contract" lists only `point.click`, `point.click.reply`, `error`; README Status still leads with the spike; `docs/setup-editor.md` "Until epic 2 story 6 is merged ..." and `docs/platform-checks.md:412` "(story 6 not merged yet)"; `docs/platform-checks.md:337` gap reload "[unverified live]" although `e2e/tests/unsaved.spec.mjs:292` drives a gap live; `docs/contract.md` messages table has no per-row version and `stale` says "used from entry 4"; `[not verified]` and `[unverified]` both used.
- Epic 1 carry-overs (d): all resolved by epic 1 story 8 and still so: no `spike/` package, no `mapstudio_checks`, no checks harness, webpack 5.112.2, no `by extra`/`by registering`; `npm audit` in `web/` is the recorded 8 (all through `perspective-client`), `--omit=dev` 0, `e2e/` 0 (run 2026-10-27).

## Tasks & Acceptance

**Execution:**
- [x] Baseline -- `./gradlew clean build --warning-mode all` (record test counts and warnings), Jest count, `npm audit` counts, e2e count on a fresh `ops/up.sh --fresh`, in Implementation Notes.
- [x] `C/contract/TagPaths.java` -- drop its `ASSET_PATH`, use `Placeholders.ASSET_PATH`; replace local `echo` with `Rows.echo` (Decision 4) -- carry-over (a), duplicate (e).
- [x] `G/tags/TagLookups.java` -- local `echo` to `Rows.echo`; adjust `TagPathsTest`/`TagLookupsTest` expectations that pin the 80-character cut.
- [x] `G/write/ConflictReport.java`, `G/write/WriteService.java`, `GT/write/WriteServiceKindSetupTest.java` -- `ConflictReport(Map<String, Kind> kinds)`; a kind setup is named "The <Rows.echo(kind.name())> kind setup", id when the kind is unknown or its name blank; tests for both and for a long or multi-line name -- (b).
- [x] `G/write/RoleMatrix.java`, `G/MapStudioDelegate.java`, `G/load/MapLoader.java` -- `RoleMatrix.isEditor(level)` at the three sites.
- [x] `G/store/StoreRegistry.java`, `GT/store/MigrationsTest.java`, `GT/store/FailureLineTest.java` -- remove `rightsMessage` and the two private helpers, `probe` uses `FailureLine.oneLine`; move any assertion `FailureLineTest` lacks.
- [x] `GT/adapter/AdapterServiceTest.java` -- replace the three sleeps with a signal (the late answer delivered; the tick's pool task done) before asserting "nothing more"; then run the class 20 times (`--rerun-tasks`, loop) and record it -- (c).
- [x] `C/Messages.java`, `GT/change/ChangeBusTest.java` -- comments say the code is reserved, never sent today (Decision 2).
- [x] `W/json.ts` (new) and the five modules -- one exported `isRecord`.
- [x] `e2e/tests/fixtures.mjs` and the six specs -- export `VERTEX_PAUSE_MS` and `drawLine(page, map, {dy} = {})`; specs import them.
- [x] `ops/project/.../mapstudio_dev/code.py`, the two `view.json` -- `holdsMapEditor(session)`; each script calls it; behaviour (refusal text) unchanged.
- [x] e2e live closures (assertions in existing specs, no product change; Decision 5): `map.load.reply.user` absent at `none` and present at `phone` (`tags.spec` or `unsaved.spec`); a viewer's `map.changed` for a kind setup op has no `setup` (`changes.spec`); a save refused "The kind list is not available (empty)" in mode `empty` (`adapters.spec`, mode reset in `finally`); a phone editor's map receives `map.changed` (`changes.spec`). Update the matching `docs/platform-checks.md` lines to **[live 8.3.10]** with the date.
- [x] Docs -- `README.md` (Status, Message contract names every 0.2.0 type and points at `docs/contract.md`); `docs/contract.md` (a "Since" column: `point.click` 0.1.0, the rest 0.2.0 draft; same mark on each section; `stale` marked reserved, not sent today (Decision 2); internal "entry N" references kept only where they say where a decision lives); `docs/setup-editor.md` and `docs/platform-checks.md` story 7 step (story 6 merged: no restart); platform-checks story 4 gap line (live through `unsaved.spec.mjs`); one label `[unverified]` repo-wide in docs written by epic 2; a cross-read of `contract.md`, `kinds-and-assets.md`, `kind-setup.md`, `setup.md`, `operations.md`, `README.md` against `Messages.java`, `contract.ts`, `Setup.java`, `KindSetup.java`, `Placeholders.java`, fixing each mismatch found and listing it in Implementation Notes.
- [x] Owner docs fixes (Decisions) -- `docs/setup-editor.md`: no restart after a save; `"basemaps": null` is the default list as the Gateway reads it (`Setup.present` treats null as missing); a dated **[owner, seen in the Designer 2026-10-27]** note that the Setup tab on 8.3.10 showed the dev setup's values correctly and the save failed on a dev-stack file permission fixed separately; the same note in `docs/platform-checks.md` story 7. If the web form reads `null` differently from the Gateway, do not change the form: add a deferred-work entry for the setup form story.
- [x] `docs/platform-checks.md` -- new "Epic 2 story 12 - refactor sweep" section: what changed, warnings and audit counts, the Designer check results once the owner sends them.
- [x] `_bmad-output/deferred-work.md` -- new entries for every "Not in the sweep" row of the disposition table; the Designer autocomplete entry gets `resolved:` after the owner's check.
- [x] Verify (below) and record results.

**Acceptance Criteria:**
- Given the sweep branch, when `./gradlew clean build --warning-mode all` runs, then it succeeds with at least the baseline Java and Jest counts, and no new deprecation names our scripts.
- Given `git grep -n '"{asset.path}"' -- common gateway`, then only `Placeholders.java` defines it.
- Given a stale kind setup update on a fresh dev Gateway, when the e2e suite runs, then the `conflict` message names the kind's display name and the body is as before.
- Given the e2e suite on a fresh `ops/up.sh --fresh`, then every test passes (baseline count plus the new assertions), and `ops/store-checks.sh` passes all scenarios.
- Given `git diff <baseline> -- common/src/main/resources docs/contract.md`, then no message type, field, error code or schema is added or removed.
- Given the docs set, then no line says a merged story "will" do something or is "not merged yet", and every row of the contract's messages table carries its version.
- Given `grep -rn` for em dashes and key material over the diff, then both find nothing.

## Implementation Notes

Implemented directly (no subagent tool in this session), 2026-10-27, on baseline `40298071268fc360260fe568d66369ffb35d5694` (step 1's merge of `ccr-3c8b84b9-f1vbsm` was already up to date).

- **Baseline:** `./gradlew clean build --warning-mode all`: common 86, gateway 267, designer 34; Jest 144; e2e 62 listed; Gradle warnings `Project.getProperties` and `Task.project` at execution time only; `npm audit` web 8 (5 moderate, 3 high), `--omit=dev` 0, e2e 0.
- **After:** common 87, gateway 269 (+2 kind setup conflict tests, +1 `FailureLineTest`, -1 `MigrationsTest` rights line), designer 34; Jest 145 (+`json.test.ts`); e2e 55 passed, 7 skipped (store-ops and the Gateway-stop spec run by their own scripts), with the four new live assertions inside existing tests; `ops/store-checks.sh` all five pass; `AdapterServiceTest` 20 of 20 runs passed (`--rerun-tasks`).
- **(a, e) echo:** `TagPaths` and `TagLookups` use `Rows.echo`; no test pinned the 80-character cut; `TagPathsTest.aRefusedPathIsEchoedOnOneShortLine` covers the matrix's tag path row.
- **(b):** `ConflictReport(Map<String, Kind>)`; kind setups are named by `kindSetupName` before the record's own `name()` (which still says "The <id> kind setup" for other callers). Tests: the existing stale update now asserts "The Well pad kind setup ...", plus `aStaleKindSetupWhoseKindIsNotInTheListIsNamedByItsId` and `aLongOrMultiLineKindNameIsEchoedOnOneShortLine`.
- **(c):** the three sleeps became pool signals: the late answers wait for `getCompletedTaskCount()` to equal the calls made; the tick and refresh cases assert `getTaskCount()` did not grow (a tick or refreshNow hands any call to the pool on its own thread, so no wait is needed). The tick case also waits for the asset call to be slow first, so no earlier chain starts a call in between. The first 20-run loop failed run 19 in a test the plan did not name, `aKindCallSettlingWhileAnAssetCallAnswersDoesNotDeadlock` ("the asset call settled before the second refresh's asset step"): its kind call answered at once, so it could settle before `refreshNow` chained the asset step, which then ran on the test thread instead of the kind call's. The kind answer now waits on a latch counted down after `refreshNow` returns; then the loop ran again from the start. `adapters.spec` keeps its 1 s with a comment (no observable for the call in flight).
- **(e) dev views:** `mapstudio_dev.holdsMapEditor(session)` (both exception handlers, logs class names at debug); nine scripts replaced by a raw-text edit of the two `view.json` files (formatting kept); compiled with Jython 2.7.4. The refusal texts are unchanged; `store.spec` "the dev page's script checks write nothing for a session without MapEditor" passed live.
- **(h):** found already done: migration 2 (story 14) creates `mapstudio_edit_project_entity`, so no deferred entry.
- **Docs cross-read, mismatches fixed:** README Status led with the spike and listed three message types; `setup-editor.md` restart wording and `"basemaps": null` (the form already reads null as the default, `SetupForm.names`, so only the doc was wrong); `setup.md` "The Designer setup form comes with entry 7" and "entry 4 adds that"; `operations.md` "comes with live updates (entry 4)"; README "restart it after editing them by hand" (a scan is enough); `contract.md` `stale` "used from entry 4", the conflict wording, phone `map.changed` and viewer `setup` lines; `platform-checks.md` story 6 "once entry 7 gives it a Designer editor", story 7 "story 6 not merged yet", gap reload, labels. `[not verified]` is left only in epic 1 sections (`platform-checks.md` spike line, `template-install.md`), and the label paragraph says both mean the same. "Since" is one column in the messages table plus a sentence, not a mark repeated on each section.
- **Owner's Designer check:** only the Setup tab opening with correct values is recorded (owner, 2026-10-27); the save failed on a dev-stack permission handled by another change. The other story 7 steps and the autocomplete entry stay open, so its deferred entry gets no `resolved:` yet.
- Not touched, as decided: the Designer setup form, `ops/docker-compose.yml` and the dev bind mount, `CODE_STALE`, `Placeholders.checkTagPath`.

## Plan Change Log

## Review Triage Log

Pass 1 (lens: quick, context-free, on commit 1ea830d against 4029807, 2026-10-27; the reviewer ran `AdapterServiceTest`, `WriteServiceKindSetupTest`, `FailureLineTest` and `TagPathsTest`, all passed, and the findings were checked again here against the code): high 0, medium 1, low 6, false 0, maybe-false 0. All seven patched; no loopback (each fix is a test, a javadoc or a doc line; no product behaviour, message shape or contract field changed).

| # | Finding | Verdict | Route | Evidence and action |
|---|---|---|---|---|
| 1 | No live test covered the kind setup conflict wording, yet `docs/contract.md` labelled it live | medium | patch | Real: `kindsetup.spec.mjs` asserted the code and `conflicts[0]` only. It now asserts `message` matches `^The Well pad kind setup was changed` (passed on the fresh dev Gateway). `contract.md` keeps **[live 8.3.10]** for the display name and says the id fallback and the 64-character cut are unit tested only; `platform-checks.md` story 12 says the same. |
| 2 | The deadlock test's latch ignored its own timeout | low | patch | Real: `chained.await` result was dropped. `AdapterServiceTest` records it in `latched` and asserts it after `second.get` ("refreshNow returned before the kind call answered"). |
| 3 | `poolTasks()` javadoc overstated `getTaskCount()` | low | patch | Real: a task handed straight to a new or idle worker may not be counted yet. The javadoc states the precondition (every worker held, so a new task queues and is counted), and both tests that read `poolTasks()` with no wait first assert `poolBusy()` (`getActiveCount()`) is 2. |
| 4 | `adapters.spec.mjs` said "nothing is saved" but checked only the error | low | patch | Real. The test reads `map.load` before and after the refused save and asserts `seq` and the item count are unchanged (workers 1, so no other test saves meanwhile). |
| 5 | The gap reload line was labelled live though the Gateway's reply to it is faked | low | patch (doc) | Real. `platform-checks.md` now says the gap detection and the `map.load` it sends are **[live 8.3.10]**, the reply is faked `busy` by the test and the reload completes on the 15 s timed retry, so the Gateway's reply to a gap's `map.load` is **[unverified]** live. |
| 6 | Docs did not match the dev library after `holdsMapEditor` | low | patch (doc) | Real. `platform-checks.md` says no `system.mapstudio` function changed and names the new dev library function; `kinds-and-assets.md` and the README say `mapstudio_dev` also holds the dev views' role check, used by `/adapters` and `/edit`, and that a library that fails to load makes those buttons raise and write nothing (fails closed, dev test equipment only, so no separate `mapstudio_devauth` library). |
| 7 | `KindSetupRecord.name()` javadoc was stale | low | patch | Real. The javadoc says conflict messages name a kind setup through `ConflictReport.kindSetupName` and `name()` is the id-based fallback for other callers. |

Outside the code: the owner's "add the setup form story" is recorded in `_bmad-output/deferred-work.md` for the coordinator; this story edits no ticket file (Never list), so the ticket is not created here.

After the patches: Gradle `clean build` common 87, gateway 269, designer 34; Jest 145; e2e 55 passed, 7 skipped on a fresh `ms-e2s12` stack; `ops/store-checks.sh` rights, partial, healed, newer, upgrade pass.

## Design Notes

Disposition of every carried item (S = this sweep; risk L low, M medium; "live" = needs the dev Gateway):

| # | Item | Decision | Risk / live |
|---|---|---|---|
| a | `TagPaths.ASSET_PATH` to `Placeholders` | S | L |
| b | Kind setup conflict names the display name | S (owner accepted id for now, polish here) | M, live |
| c | Sleeps for ordering | S: 3 in `AdapterServiceTest`; e2e 1 s in `adapters.spec` reviewed, kept with a comment unless an observable exists | M (test only) |
| d | Epic 1 sweep items | Already resolved by epic 1 story 8; re-checked (warnings, audit) only | L |
| e | Duplicates: echo, editor check, dev role read, `drawLine`, `isRecord`, `rightsMessage` | S | L to M, live for the dev views and e2e |
| f | Docs consistency | S | L |
| g | Four `[unverified live]` lines closable by e2e assertions | S (Decision 5) | L, live |
| h | Index on `mapstudio_edit (project, entity, entity_id)` (story 2) | Not in the sweep: needs a migration | the entry that adds migration 3 |
| i | `Placeholders.checkTagPath` looser than `TagPaths` (`{asset.path}/a//b`, `[` in a suffix) | Not in the sweep: aligning changes what saves accept | epic-editing (Decision 3) |
| j | `onShutdown` on page close, redundancy pair, two real tabs, real browser reopen, slow tag system, least-privilege kind setup save, example adapters live | Not in the sweep: need new harness or hardware | entry 13 release check or owner; recorded in deferred-work |
| k | `popupView`, spike draw tool, `values.batch`, ER-27 glyph review, GPU run, signature verification, CI linters, template race, phone attachment | Unchanged owners | epic-viewing, epic-editing, owner, epic-phone |

Version: nothing public changes shape, so no version bump; message wording (b, M3) is not versioned.

Owner's Designer check (one session, results into `docs/platform-checks.md` story 7 and this plan): the numbered steps are in the coordinator's report and repeated in Verification.

## Verification

**Commands:**
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --warning-mode all --console plain` -- expected: success, counts at or above baseline, only the two known plugin warnings
- `cd web && npx tsc --noEmit && npx jest && npm audit` -- expected: green; audit still the recorded 8, `--omit=dev` 0
- `for i in $(seq 20); do ./gradlew :gateway:test --tests '*AdapterServiceTest' --rerun-tasks -q || break; done` -- expected: 20 passes
- `ops/up.sh --fresh`, then `cd e2e && npm test` -- expected: all pass, secret scan clean, no Map Studio error in `ops/logs.sh`
- `ops/store-checks.sh` -- expected: rights, partial, healed, newer, upgrade pass
- `git grep -n $'\xe2\x80\x94'` over the diff -- expected: none

**Manual checks (owner, in the Designer, dev Gateway of this branch):**
- The numbered Designer steps (autocomplete text; setup editor open, save, invalid save, role change, create on a scratch project, inherited setup; Designer save reaching `onResourcesModified`). Each result is recorded as **[owner, 8.3.10]** or stays **[unverified]**.
