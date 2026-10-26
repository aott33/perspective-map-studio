You are a code reviewer with no prior context. This prompt stands alone: the plan and the unified diff are inline below.

Read the plan (it holds the acceptance criteria and intent). There are no AGENTS.md or CLAUDE.md files in this repository; the rules are the plan's Boundaries and Constraints (Always and Never), plus: no em dashes anywhere, no secrets in the repository, claims about the Perspective client or the Ignition SDK are marked unverified until seen live. Then read the unified diff, which is the change under review. It excludes the plan itself, `e2e/package-lock.json`, binary screenshots and `docs/spike-measures.json` (a machine-written file whose sections are described in docs/platform-checks.md, section "Story 7").

Report unmet acceptance criteria, broken rules, and bugs. Each finding: the location, what goes wrong, and evidence checked against the surrounding code. Output a Markdown list of findings only - no severity, priority, or ranking.

Review by inspection only. Do not modify code, run builds or tests, or invoke quality gates. Do not invoke any skill, and do not spawn subagents of your own - you are the reviewer. Return your findings as text in your final message; do not route them through any findings-reporting tool the host may offer.

Context the plan does not repeat: the suite was run live against an Ignition 8.3.10 dev Gateway: 10 Playwright tests passed, 7 node unit tests passed, 32 Jest tests passed, tsc clean, Gradle build green. The CI job `e2e` has not run on a runner.

===== PLAN (story 7) =====

---
title: "Playwright smoke suite and the spike's measures"
type: 'feature'
ticket: '7'
created: '2026-10-26'
status: 'in-progress'
baseline_revision: '0c6a191c0550beaa9aff02c2610bc16b87ab6541'
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

**Problem:** The tracer is checked by two ad-hoc scripts in `ops/` that need a hand-started Gateway, and the spike's measures (bundle size, frame rate on the 30-pad scale set, the size of a value batch, what broke on the phone) are recorded nowhere. AD-15 wants a Playwright suite whose screenshots the docs embed, and story 9 needs the measures to write the go or no-go.

**Approach:** Move both scripts into an `e2e/` Playwright suite (pinned exactly), add a measures spec that writes `measures.json` with every number labelled `measured` or `stand-in` and its method, add a CI job that boots the dev Gateway in Docker and runs it. Where a feature does not exist yet (`values.batch`, icons, labels, the template's 30-pad set), the stand-in is built from the contract and named as one; no number is invented.

## Boundaries & Constraints

**Always:** `@playwright/test` pinned to `1.63.0` (exact, lock file committed; the cloud box's Chromium 153 at `/opt/pw-browsers` is that release's browser); the suite fails on any browser console error or page error, as the scripts did; each measure carries `label` (`measured` or `stand-in`), `method`, and the environment it ran in (Chromium version, WebGL renderer string, CPU count, viewport, CI or local); a measure that cannot run is `{status: "unavailable", reason}`, never a number; software WebGL results are labelled as such and never presented as the NFR-1 verdict; claims about the Perspective client or the Ignition SDK stay marked unverified until seen live; no secrets, `.modl` or generated password in git or logs; theme tokens only in any CSS; no em dashes.

**Never:** a Gateway Java change; a change to `ign-scada-template` or `claude-ignition-skills`; a `values.batch` message or any new message type; a test hook that reads MapLibre or the component store through React internals; CI committing screenshots; a fix for the CI failure on main (owner is checking); basemaps, icons, labels, signing changes; `retries` that hide a flaky measure.

**Decisions (owner, 2026-10-26):** (1) The 30 pads are a seeded synthetic set, labelled stand-in. (2) Phone probes record only and never fail the suite. (3) The software-WebGL frame rate is recorded as is; NFR-1 stays unverified for story 9. (4) The 30 pads reach the component through a spike-only `testSet` prop in the closed schema, removed in the refactor sweep. (5) The `e2e` CI job runs on every push to `main` and every pull request, after `build`. The plan stays whole. CI on main failed only because the owner's Actions minutes ran out; the repository is going public.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Smoke at 1440 and 390 | Dev Gateway running the build | Map, 3 points, line, reply text, popup view, drawn line; screenshot per width | Console error or page error fails the test |
| Gateway down | No answer on `/StatusPing` or no bundle | Suite stops before any test | One line naming the URL and `ops/up.sh` |
| Scale view | `/scale` page, `testSet: "scale30"` | 30 pads and their lines drawn; `data-feature-count` on the map root matches | Count mismatch fails the test |
| Frame rate | Scripted pan and wheel zoom, 3 runs | fps, p50/p95/max frame interval, share over 20 ms, long tasks, per run and median | No WebGL context: `unavailable` with reason |
| Value batch | 30 pads x 3 slots, AD-6 shape | Raw and gzip bytes, full and 10 % changes-only | Always `stand-in` |
| Phone probe fails | A 390 px check (overflow, 44 px targets, popup in view, touch) | Recorded under `phone.findings`; test passes | Only a console error fails |
| Fallback popup | Pages `/fallback-empty`, `/fallback-missing` | Text popup with the id; empty path no warning; missing path exactly one warning naming the path | Mismatch fails |

</frozen-after-approval>

## Code Map

- `ops/screenshot.mjs`, `ops/popup-check.mjs` -- the logic to move (Web Mercator `project()` click targeting, `.connection-banner.banner-active` wait, `data-drawing` and `data-line-points` waits, swiftshader launch args). Delete both afterwards; refs: `ops/up.sh` line 62, `README.md` lines 46-47, `docs/platform-checks.md` story 2 and 4 evidence.
- `ops/popup-check.mjs --expect-fallback` needed an edit of `view.json` and a Gateway restart per case; the suite instead gets two committed dev views and pages (Gateway reads project files only at start).
- `ops/project/com.inductiveautomation.perspective/{views,page-config/config.json}` -- add views `MapStudioScale`, `MapStudioFallbackEmpty`, `MapStudioFallbackMissing` (copy `MapStudioDev/{view.json,resource.json}`; a view folder is a leaf) and pages `/scale`, `/fallback-empty`, `/fallback-missing`. Session URL for a non-root page `/data/perspective/client/mapstudio-dev/<page>` is **[unverified]**: check live first.
- `common/src/main/resources/mapstudio.props.json` (closed schema), `web/typescript/MapStudio.tsx` (`MapStudioProps`, `getPropsReducer`, `componentDidMount` layers, `render`), `web/typescript/testData.ts` -- add a spike-only `testSet` prop (`tracer` default, `scale30`), same precedent as `popupView`; new `web/typescript/scaleData.ts` makes 30 pads deterministic (seeded, no `Math.random`) with lines to 3 gathering stations; the same two layers, no new layer types.
- `web/webpack.config.js` output `web/build/generated-resources/mounted/{MapStudio.js,MapStudio.css,maplibre-gl-worker.js}`; `.modl` at `build/Map-Studio.unsigned.modl`; story 2 baseline `MapStudio.js` 1,167,572 bytes (`docs/platform-checks.md`).
- `.github/workflows/ci.yml` -- jobs `build` (uploads `map-studio-unsigned-modl`) and `signing-check`; actions pinned by SHA. New pins resolved by `git ls-remote` today: `actions/download-artifact` v4.3.0 `d3f86a106a0bac45b974a628896c90dbdf5c8093`, `actions/setup-node` v4.4.0 `49933ea5288caeca8642d1e84afbd3f7d6820020`; reuse checkout, cache and upload-artifact SHAs already in the file. The header comment says "no Gateway boot or Playwright in CI (story 7)": update it.
- `ops/lib.sh`, `ops/up.sh --no-build`, `ops/logs.sh`, `ops/down.sh --purge` -- the CI job reuses them; `.env` (git-ignored) takes `GATEWAY_HTTP_PORT`, the generated password stays there. The dev Gateway for this plan's implementation: `MAPSTUDIO_CONTAINER=ms-s7`, `GATEWAY_HTTP_PORT=9107`. Docker was not running in the planning box.
- Template check: `/home/user/ign-scada-template/assets/fields/Mesa/pads.csv` has 6 rows; no 30-pad set or PV-29 harness exists in that checkout (grep of `docs/`). Hence the stand-in generator.
- Story 1 note: Perspective tags DOM nodes with `__reactFiber$`; not used here (Never).
- `docs/architecture.md` "Testing and proof", `README.md` Run section, `docs/platform-checks.md` -- document the suite, add section "Story 7 - Smoke suite and measures" with the measures table and labels.

## Tasks & Acceptance

**Execution:**
- [ ] `e2e/package.json`, `e2e/package-lock.json`, `e2e/playwright.config.mjs`, `.gitignore` -- `@playwright/test` 1.63.0 exact; one chromium project, swiftshader launch args, `workers: 1`, `retries: 0`; base URL from `GATEWAY_URL`, else `http://localhost:${GATEWAY_HTTP_PORT}` read from `.env`, else 9088; ignore `e2e/out/`, `e2e/node_modules/`; global setup pings `/StatusPing` and the bundle -- one command runs everything.
- [ ] `e2e/lib/geo.mjs`, `e2e/tests/fixtures.mjs` -- `project()`, `openMap(page, pagePath)`, console and page error collector failing the test -- shared by all specs.
- [ ] `e2e/tests/tracer.spec.mjs` -- click p1, reply text, popup view, Escape cancel, two-vertex line, screenshot `mapstudio-dev-{1440,390}.png` into `e2e/out/screenshots`, or `docs/screenshots` when `E2E_DOCS=1` -- R6 screenshots.
- [ ] `e2e/tests/popup.spec.mjs` -- p1 view with author param, p2 moves the popup, close unmounts; the two fallback pages with their warning rules -- popup-check, minus the restarts.
- [ ] `common/.../mapstudio.props.json`, `web/typescript/{scaleData.ts,MapStudio.tsx}`, `web/typescript/__tests__/scaleData.test.ts` -- `testSet`, 30 pads, `data-test-set` and `data-feature-count` on `.mapstudio-map`; Jest: 30 unique ids, deterministic, all inside the starting 1440 px view -- the scale set.
- [ ] `ops/project/...` -- the three views and pages above -- scale and fallback targets.
- [ ] `e2e/lib/measures.mjs`, `e2e/lib/valueBatch.mjs`, `e2e/tests/measures.spec.mjs`, `e2e/lib/*.test.mjs` (`node --test`) -- the four measures into `e2e/out/measures.json` (`docs/spike-measures.json` with `E2E_DOCS=1`); stats and batch builder unit tested -- see Design Notes.
- [ ] `.github/workflows/ci.yml` -- job `e2e`: `needs: build`, `timeout-minutes: 30`, download the `.modl` into `ops/modules/`, setup-node 22, `ops/up.sh --no-build`, `npm ci`, `npx playwright install --with-deps chromium` (cache `~/.cache/ms-playwright` by lock hash), `npm test`; upload `e2e/out` and the report always; on failure print `ops/logs.sh -n 300`; `ops/down.sh --purge` with `if: always()`; `contents: read` only.
- [ ] `ops/screenshot.mjs`, `ops/popup-check.mjs` (delete), `ops/up.sh`, `README.md`, `docs/architecture.md`, `docs/platform-checks.md`, `_bmad-output/deferred-work.md` -- point at `e2e/`; deferred: remove `testSet` and the fallback pages in the sweep.

**Acceptance Criteria:**
- Given the dev Gateway on a fresh `ops/up.sh --fresh`, when `npm test` runs in `e2e/`, then all specs pass and `e2e/out` holds both screenshots and a `measures.json` with `bundle`, `frameRate`, `valueBatch`, `phone`.
- Given `measures.json`, when read, then every value has `label`, `method` and `env`, `valueBatch` is `stand-in`, and `frameRate.env.renderer` names the WebGL renderer.
- Given `E2E_DOCS=1`, when the suite runs, then `docs/screenshots/mapstudio-dev-{1440,390}.png` and `docs/spike-measures.json` are rewritten and the README embed still resolves.
- Given a branch, when the `e2e` job runs on a GitHub runner, then it passes; **[unverified]** until the Actions failure on main is resolved, so the proof now is the same commands run locally plus a YAML parse.
- Given the repository, when searched, then no reference to the two deleted scripts remains and no password, key or `.modl` is tracked.

## Implementation Notes

- Implemented directly in this session (no subagent tool available), 2026-10-26. Docker daemon was down at the start and was started with `dockerd`; dev Gateway `ms-s7` on 9107 from the ignored `.env`, `ops/up.sh --fresh`, no Map Studio warning or error in its log.
- Suite: `e2e/` (`@playwright/test` 1.63.0 exact, lock committed). It runs on the cloud box's pre-installed Chromium 153 with no `executablePath` and no `playwright install`; `PW_CHROMIUM_PATH` is supported but was not needed. `playwright.config.mjs`, `global-setup.mjs` (stops with one line when the Gateway or the bundle is missing, checked with `GATEWAY_URL=http://localhost:1`), `lib/{env,geo,stats,valueBatch,measures}.mjs`, `lib/lib.test.mjs` (7 `node --test` tests), `tests/{fixtures,tracer,popup,scale,measures}.spec.mjs`. 10 Playwright tests, all pass (2.3 min); an `E2E_DOCS=1` run rewrote `docs/screenshots/*` and wrote `docs/spike-measures.json`.
- App: spike-only `testSet` prop (`tracer` or `scale30`) in `mapstudio.props.json`, `MapStudio.tsx` and `web/typescript/{testSet,scaleData}.ts`; `data-test-set` and `data-feature-count` on `.mapstudio-map`. The scale set is seeded (mulberry32), 30 pads and 30 lines, inside the 1440 x 860 starting view at zoom 12 (Jest asserts it). Jest 32 of 32, `tsc --noEmit` clean, `./gradlew build` green (via `ops/up.sh`).
- Dev project: views `MapStudioScale`, `MapStudioFallbackEmpty`, `MapStudioFallbackMissing` and pages `/scale`, `/fallback-empty`, `/fallback-missing`. The non-root session URL `/data/perspective/client/mapstudio-dev/<page>` works on 8.3.10 **[live 8.3.10]** (was unverified).
- Surprises: Perspective's websocket frames are readable text on 8.3.10 **[live 8.3.10]** (`point.click` 261 bytes sent, reply 327 received). The frame rate varies a lot on the shared 4-CPU box: the same view gave 15.8 and then 5.8 fps pan median in two full runs, so the record states no cost per pad. Playwright reports 0 transferred bytes for the worker script (cause unverified). Phone probes: 7 pass, 2 fail (44 px targets; 21 x 22 px popup close button).
- Deleted `ops/screenshot.mjs` and `ops/popup-check.mjs`; README, `docs/architecture.md`, `docs/platform-checks.md` (section "Story 7"), the story 1 walkthrough link and `ops/up.sh` point at `e2e/`. Deferred entries appended for the sweep, a laptop headed run, the real `values.batch` and the Gateway-side popup stop.
- CI: job `e2e` added (`needs: build`, every push to `main` and pull request); YAML parsed, every step's command run locally except `download-artifact`, `setup-node`, the browser cache and `playwright install --with-deps`, which are **[unverified]** until a runner executes them.

## Plan Change Log

## Review Triage Log

## Design Notes

**Bundle** (`measured`): bytes and gzip bytes of the three files in `web/build/.../mounted` and of the `.modl`, plus the bytes the Gateway actually serves for `/res/mapstudio/*` on page load (Playwright response sizes and `content-encoding`). Recorded with the delta to story 2; no budget exists, so nothing asserts a limit.

**Frame rate** (`measured`, scope-limited): an `addInitScript` rAF sampler plus a `PerformanceObserver` for long tasks, while Playwright drives a 4 s circular drag and a 4 s wheel zoom, after 2 s warm-up, 3 runs, on `/scale` and, for contrast, on the 3-point tracer view. The component's MapLibre is not reachable and the gesture drives the page's real frame cadence, not MapLibre's own render count. Caveats written into the file: headless software WebGL (SwiftShader, CPU), 30 circles and 30 lines only (no icons, labels, KPI, alarms), so it is a floor on rendering cost, not the 60 fps NFR-1 verdict. The same spec run headed on a laptop (`E2E_HEADED=1`) records that renderer string; whether the owner does so is Open Question 3.

**Value batch** (`stand-in`): `values.batch` does not exist. `valueBatch.mjs` builds the AD-6 envelope `{v:1, type:'values.batch', id, body:{seq, full, items}}` for 30 pads with three slots (comms, icon KPI, alarm count), each a `LiveValue {value, quality, t, stale, reason}`; AD-6 fixes only the LiveValue fields, so the item layout is this plan's assumption **[unverified]**. Reports UTF-8 and gzip bytes for the full batch and a 10 % changes-only batch. The one real wire number beside it (`measured`): the size of the `point.click` round trip frames from `page.on('websocket')`; whether Perspective's frames are readable text and compressed is **[unverified]**, else `unavailable`.

**Phone** (`measured` probes, 390x844, `isMobile`, `hasTouch`): horizontal page overflow; map width equals viewport; target sizes of the zoom, draw and popup-close controls against the PRD's 44 px; popup box inside the viewport; touch tap on p1 gives reply and popup; CDP touch pan and pinch move the map; Terra Draw by touch (`Input.dispatchTouchEvent`) **[unverified]**. Each probe writes `{check, ok, detail}` into `phone.findings`; the prose "what broke" in `platform-checks.md` is written from that file, not from memory.

## Verification

**Commands:**
- `ops/up.sh --fresh` (`.env`: `ms-s7`, 9107) then `cd e2e && npm ci && npx playwright test` -- expected: all specs pass, no console error
- `cd e2e && node --test lib/` and `cd web && npx tsc --noEmit && npm test` -- expected: pass
- `./gradlew build` -- expected: success with the new prop in the schema
- `E2E_DOCS=1 npx playwright test` -- expected: docs screenshots and `docs/spike-measures.json` updated
- `python3 -c "import yaml,sys;yaml.safe_load(open('.github/workflows/ci.yml'))"` and `git grep -nE 'screenshot\.mjs|popup-check'` -- expected: valid; no hits
- `git grep -I -nE 'BEGIN [A-Z ]*PRIVATE KEY|GATEWAY_ADMIN_PASSWORD=.+'` -- expected: no hits

**Manual checks (if no CLI):**
- Owner reads the screenshots and `docs/spike-measures.json` labels; the CI run, once Actions works.


===== UNIFIED DIFF (baseline 0c6a191 to HEAD) =====

diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 59e5650..1c6fb2e 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -2,7 +2,9 @@ name: CI
 
 # Builds and tests every push and pull request. Nothing here reads a secret: the
 # module is built unsigned, and the signing path is checked with a throwaway
-# certificate that is generated during the run and never stored.
+# certificate that is generated during the run and never stored. The e2e job
+# boots the dev Gateway in Docker with the unsigned build and runs the
+# Playwright suite in e2e/ (story 7).
 
 on:
   push:
@@ -75,3 +77,63 @@ jobs:
 
       - name: Sign with a throwaway certificate and verify
         run: scripts/ci/test-signing.sh
+
+  e2e:
+    name: Playwright suite on a dev Gateway
+    runs-on: ubuntu-latest
+    needs: build
+    timeout-minutes: 30
+    steps:
+      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
+
+      - name: Download the unsigned module
+        uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4.3.0
+        with:
+          name: map-studio-unsigned-modl
+          path: ops/modules
+
+      - name: Set up Node 22
+        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
+        with:
+          node-version: "22"
+
+      # Starts Ignition 8.3.10 in Docker (EULA, a generated admin password in the
+      # ignored .env, unsigned modules allowed: development only) and waits until
+      # the module's bundle is served. --no-build keeps the build job's module.
+      - name: Start the dev Gateway
+        run: ops/up.sh --no-build
+
+      - name: Install the suite
+        working-directory: e2e
+        run: npm ci --no-audit --no-fund
+
+      - name: Cache Playwright browsers
+        uses: actions/cache@5a3ec84eff668545956fd18022155c47e93e2684 # v4.2.3
+        with:
+          path: ~/.cache/ms-playwright
+          key: playwright-${{ runner.os }}-${{ hashFiles('e2e/package-lock.json') }}
+
+      - name: Install Chromium
+        working-directory: e2e
+        run: npx playwright install --with-deps chromium
+
+      - name: Run the suite
+        working-directory: e2e
+        run: npm test
+
+      - name: Upload screenshots, measures and the report
+        if: always()
+        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
+        with:
+          name: e2e-output
+          path: e2e/out
+          if-no-files-found: warn
+          retention-days: 14
+
+      - name: Gateway log
+        if: failure()
+        run: ops/logs.sh -n 300
+
+      - name: Remove the dev Gateway
+        if: always()
+        run: ops/down.sh --purge
diff --git a/.gitignore b/.gitignore
index 6d65c2c..0725613 100644
--- a/.gitignore
+++ b/.gitignore
@@ -41,5 +41,8 @@ bin/
 # Agent worktrees (parallel stories), never committed
 .claude/worktrees/
 
+# Playwright suite output (story 7); docs/ gets screenshots and measures only with E2E_DOCS=1
+e2e/out/
+
 # Platform checks (story 3): generated PostgreSQL passwords
 ops/checks/secrets/
diff --git a/README.md b/README.md
index 6b71c6a..9468ee3 100644
--- a/README.md
+++ b/README.md
@@ -36,15 +36,14 @@ Layout:
 | `gateway/` | gateway hook and the component model delegate (`MapStudioDelegate`) |
 | `designer/` | the Designer palette entry |
 | `web/` | the TypeScript and React component, MapLibre map, Terra Draw line tool (`DrawControl.tsx`, `draw.ts`), message client (`messages.ts`), the point popup (`PointPopup.tsx`, `popupParams.ts`) and their tests |
-| `ops/` | the local development Gateway (Docker), its `mapstudio-dev` project (`MapStudioDev`, `Popups/PointDetails`) and the screenshot script |
+| `e2e/` | the Playwright suite (pinned `@playwright/test`): smoke tests at 1440 and 390 px, the popup checks and the spike's measures |
+| `ops/` | the local development Gateway (Docker) and its `mapstudio-dev` project (`MapStudioDev`, `MapStudioScale`, two popup fallback pages, `Popups/PointDetails`) |
 | `docs/` | contributor architecture, the platform checks and screenshots |
 
 ## Run the development Gateway
 
 ```bash
 ops/up.sh              # build, stage the .modl, start Ignition 8.3.10 in Docker, accept the module unattended
-node ops/screenshot.mjs   # click a point (popup) and draw a line in headless Chromium at 1440 and 390 px, save docs/screenshots/*.png (--url for another port)
-node ops/popup-check.mjs  # the popup view with its params, a second point, close (--expect-fallback for an empty or missing path)
 ops/logs.sh -n 200     # Gateway log
 ops/down.sh [--purge]  # stop; --purge also wipes the Gateway data (trial, acceptance)
 ```
@@ -57,6 +56,19 @@ The dev Gateway loads the unsigned build (`-Dignition.allowunsignedmodules=true`
 
 `ops/checks.sh` answers the spike's Gateway questions on a live 8.3.10 Gateway: it adds PostgreSQL 16 beside the dev Gateway (`ops/docker-compose.checks.yml`), seeds the Gateway's core config collection from `ops/checks/config/core/` (a tag provider, a UDT whose alarm toggles every 30 s, a File secret provider and two database connections), and the module's `gateway/.../spike` package then logs one `CHECK <name> PASS|FAIL <evidence>` line per check for any project that holds a `com.aoindustrial.perspective.mapstudio/setup` resource (`ops/project/.../setup/setup.json`). The PostgreSQL passwords are generated into the git-ignored `ops/checks/secrets/` and reach the Gateway only through its File secret provider. While the checks stack exists, `ops/up.sh`, `down.sh` and `logs.sh` include it automatically and `ops/down.sh --purge` removes it, PostgreSQL volume included. The UDT's alarm is a dev-only test alarm, flagged for engineering review and never for a real Gateway. Results and evidence: [docs/platform-checks.md](docs/platform-checks.md). The spike package is removed by the refactor sweep.
 
+## Tests and proof
+
+The Playwright suite in `e2e/` runs against a dev Gateway that is already up (`ops/up.sh`); CI starts one in Docker for every push to `main` and every pull request.
+
+```bash
+cd e2e && npm ci
+npm test               # smoke tests, popup checks and measures; output in e2e/out (screenshots, measures.json, HTML report)
+npm run docs           # the same, rewriting docs/screenshots/*.png and docs/spike-measures.json
+npm run test:unit      # the suite's own helper tests (no Gateway needed)
+```
+
+The Gateway URL is `GATEWAY_URL`, else `http://localhost:` and `GATEWAY_HTTP_PORT` from `.env`, else 9088. The suite fails on any browser console or page error. It uses Playwright's own Chromium (`npx playwright install chromium`, run by CI); set `PW_CHROMIUM_PATH` to use a browser already on the machine, and `E2E_HEADED=1` to run with a visible browser (a real GPU gives a real frame rate). The measures it records, with their labels and limits, are in [docs/platform-checks.md](docs/platform-checks.md), section "Story 7".
+
 ## Releases and signing
 
 Releases are signed `.modl` files attached to GitHub releases, built by CI from a `vX.Y.Z` tag on `main` ([RELEASING.md](RELEASING.md)). Every release is signed with one self-signed certificate held by the project owner. Check a download against this fingerprint before you install it (the script checks structure and fingerprint only; the Gateway verifies the signatures cryptographically when you install the module):
diff --git a/_bmad-output/deferred-work.md b/_bmad-output/deferred-work.md
index e825697..2cfbac7 100644
--- a/_bmad-output/deferred-work.md
+++ b/_bmad-output/deferred-work.md
@@ -1,3 +1,15 @@
 - source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/spike-render-a-project-view-by-path-as-a-popup-plan.md`
   summary: Confirm on the Gateway that the popup view's view model stops when the popup closes (and that a p1 to p2 switch, which reuses one mount path, stops the old one).
   evidence: Review finding 2 (quick lens): only the browser side was seen; the Gateway logs nothing at info for a view stop. Settle it with the Perspective session page's view count or a debug logger on `perspective.ViewModel` during `ops/popup-check.mjs`, and record it under "Story 4" in `docs/platform-checks.md`.
+- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-playwright-smoke-suite-and-the-spike-s-measures-plan.md`
+  summary: For the epic 1 refactor sweep (story 8) - remove the spike-only `testSet` prop (`common/.../mapstudio.props.json`, `web/typescript/{testSet,scaleData}.ts`) and the dev views `MapStudioScale`, `MapStudioFallbackEmpty` and `MapStudioFallbackMissing`, or keep them as e2e fixtures once the map store supplies test data.
+  evidence: Owner's decision 2026-10-26 (story 7, question 4): the 30 pads reach the component through a spike-only prop that is removed in the sweep. The e2e specs `scale.spec.mjs` and `popup.spec.mjs` and the frame rate measure depend on them.
+- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-playwright-smoke-suite-and-the-spike-s-measures-plan.md`
+  summary: Run `E2E_HEADED=1 npm test` in `e2e/` once on a laptop with a real GPU and add its renderer string and frame rates to the record, before story 9 judges NFR-1.
+  evidence: The recorded frame rate is software WebGL on a shared 4-CPU box (5.8 to 15.8 fps for the same view across two runs); NFR-1 asks for 60 fps in a laptop browser and is not decided by it.
+- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-playwright-smoke-suite-and-the-spike-s-measures-plan.md`
+  summary: Replace the `values.batch` stand-in (`e2e/lib/valueBatch.mjs`) with a measurement of the real message when epic-viewing builds it.
+  evidence: The item layout and the websocket compression are unverified guesses; only the LiveValue fields are fixed by AD-6.
+- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-playwright-smoke-suite-and-the-spike-s-measures-plan.md`
+  summary: Settle the story 4 deferred item (view model stops on popup close) in the e2e suite; `ops/popup-check.mjs`, which that entry names, is now `e2e/tests/popup.spec.mjs`.
+  evidence: The browser side of close and the p1 to p2 switch are tested; the Gateway side still needs a view count on the Perspective session page or a debug logger on `perspective.ViewModel`.
diff --git a/_bmad-output/initiative-flowmap/walkthrough-story-1-tracer/walkthrough-story-1-tracer.md b/_bmad-output/initiative-flowmap/walkthrough-story-1-tracer/walkthrough-story-1-tracer.md
index ac97395..3cfbb74 100644
--- a/_bmad-output/initiative-flowmap/walkthrough-story-1-tracer/walkthrough-story-1-tracer.md
+++ b/_bmad-output/initiative-flowmap/walkthrough-story-1-tracer/walkthrough-story-1-tracer.md
@@ -75,7 +75,7 @@ A disposable Ignition 8.3.10 Gateway in Docker that loads the freshly built modu
 - [ops/docker-compose.yml](../../../ops/docker-compose.yml) the Gateway, localhost only, generated password.
 - [ops/lib.sh](../../../ops/lib.sh) shared helpers; [ops/up.sh](../../../ops/up.sh) and [ops/down.sh](../../../ops/down.sh).
 - [ops/project/](../../../ops/project/) the dev project and its one view.
-- [ops/screenshot.mjs](../../../ops/screenshot.mjs) the screenshot run.
+- [e2e/tests/tracer.spec.mjs](../../../e2e/tests/tracer.spec.mjs) the screenshot run (story 7 moved it from `ops/`).
 
 ## Block 8 - Periphery
 
diff --git a/common/src/main/resources/mapstudio.props.json b/common/src/main/resources/mapstudio.props.json
index 026decf..f4ff893 100644
--- a/common/src/main/resources/mapstudio.props.json
+++ b/common/src/main/resources/mapstudio.props.json
@@ -31,6 +31,12 @@
         }
       }
     },
+    "testSet": {
+      "type": "string",
+      "enum": ["tracer", "scale30"],
+      "description": "Spike-only (story 7): the fixed test data the map draws. 'tracer' is three points and a line; 'scale30' is a seeded 30-pad stand-in for the template's scale set, used to measure frame rate. Removed in the refactor sweep.",
+      "default": "tracer"
+    },
     "style": {
       "$ref": "urn:ignition-schema:schemas/style-properties.schema.json",
       "default": {
diff --git a/docs/architecture.md b/docs/architecture.md
index 77285a3..929a4ca 100644
--- a/docs/architecture.md
+++ b/docs/architecture.md
@@ -107,7 +107,7 @@ The component's props and events, the message contract, the map item record and
 
 ## Testing and proof
 
-Every documented behaviour has a Playwright test that records a screenshot, and the docs show it (AD-15). A behaviour without a passing test and screenshot is marked unverified. A release claims support for a new Ignition 8.3.x only after the `ign-scada-template` test stack and the Playwright suite pass on it (AD-13).
+Every documented behaviour has a Playwright test that records a screenshot, and the docs show it (AD-15). A behaviour without a passing test and screenshot is marked unverified. The suite lives in `e2e/`, runs against the dev Gateway from `ops/` (CI starts one in Docker), fails on any browser console error, and also writes `measures.json`: bundle size, frame rate, the size of a value batch and phone findings, each labelled `measured` or `stand-in` with its method. `npm run docs` in `e2e/` refreshes the screenshots the docs embed. A release claims support for a new Ignition 8.3.x only after the `ign-scada-template` test stack and the Playwright suite pass on it (AD-13).
 
 ## Releases
 
diff --git a/docs/platform-checks.md b/docs/platform-checks.md
index 99cfbce..15b930a 100644
--- a/docs/platform-checks.md
+++ b/docs/platform-checks.md
@@ -40,9 +40,9 @@ Measures:
 
 The baseline was measured by building the story 1 `web/` folder from commit `0fba47c` with the same webpack settings, outside the repository.
 
-Live run **[live 8.3.10]** (dev Gateway `ms-s2`, fresh volume, module accepted unattended): the Gateway log shows the module starting and the component registering with no Map Studio warning or error. `node ops/screenshot.mjs` at 1440 x 900 and 390 x 844: the point click reply arrived, a one-vertex drawing cancelled with Escape left the tool off with nothing drawn, and a two-vertex line finished with Enter gave "Line drawn with 2 points"; no browser console error or page error in either viewport (the script fails on one). The toggle, the Escape cancel and the finished line were seen through the DOM attributes the component sets (`data-drawing`, `data-line-points`, `aria-pressed`) and in the screenshots.
+Live run **[live 8.3.10]** (dev Gateway `ms-s2`, fresh volume, module accepted unattended): the Gateway log shows the module starting and the component registering with no Map Studio warning or error. the screenshot script (now the `e2e/` suite, story 7) at 1440 x 900 and 390 x 844: the point click reply arrived, a one-vertex drawing cancelled with Escape left the tool off with nothing drawn, and a two-vertex line finished with Enter gave "Line drawn with 2 points"; no browser console error or page error in either viewport (the script fails on one). The toggle, the Escape cancel and the finished line were seen through the DOM attributes the component sets (`data-drawing`, `data-line-points`, `aria-pressed`) and in the screenshots.
 
-Evidence: `docs/screenshots/mapstudio-dev-1440.png` and `docs/screenshots/mapstudio-dev-390.png` (point click reply and one line drawn with Terra Draw), written by `node ops/screenshot.mjs`, which fails on any browser console error.
+Evidence: `docs/screenshots/mapstudio-dev-1440.png` and `docs/screenshots/mapstudio-dev-390.png` (point click reply and one line drawn with Terra Draw), written by `e2e/tests/tracer.spec.mjs`, which fails on any browser console error (the ad-hoc script in `ops/` that first wrote them was replaced in story 7).
 
 Not covered here (later stories): frame rate, value batch size and phone breakage (story 7); saving, undo, snapping, select and edit modes (epic-editing).
 
@@ -163,3 +163,67 @@ One defect was found and fixed during the run: with MapLibre's `closeOnClick`, a
 - Content rendered through `ReactDOM.createPortal` keeps Perspective's React context; a second React root (the built-in Map's custom controls) needs `ClientStoreProviderContext.Provider`. **[bundle]**, portal path **[live 8.3.10]**
 - `View` reports `notFound`, `error` and `access-denied` through `onViewStateChange`; a component can fall back on them. A missing view reported `error` in 8.3.10, so a fallback must treat every failed state alike, not `notFound` alone. **[live 8.3.10]**
 - The `View` typings target `@types/react` 18 while a module built on the 16.14 typings needs one cast (`View as unknown as React.ComponentClass<ViewProps>`) **[client typings]**; the cast element rendered the view at runtime, where React is the one the Perspective client loads **[live 8.3.10]**.
+
+## Story 7 - Smoke suite and measures
+
+The Playwright suite in `e2e/` (`@playwright/test` 1.63.0, exact) replaces the two ad-hoc scripts of `ops/`: it renders the tracer view at 1440 and 390 px, saves the screenshots the docs embed, checks the popup (custom view, second point, close, and the text fallbacks for an empty and a missing view path, each on its own dev page so no Gateway restart is needed) and writes the measures below to `docs/spike-measures.json` (`npm run docs`; a plain `npm test` writes `e2e/out/measures.json`). It fails on any browser console or page error. Date: 2026-10-26; Gateway `inductiveautomation/ignition:8.3.10` (container `ms-s7`), Chromium 153.0.8010.12, 4 CPUs, software WebGL (`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`).
+
+Labels used here: **measured** was read from a running Gateway and browser; **stand-in** was built from a contract or a synthetic data set because the real feature or data does not exist yet; **[unverified]** was not checked. Every number in `docs/spike-measures.json` carries one of the first two and its method.
+
+Evidence: `docs/screenshots/mapstudio-dev-1440.png`, `docs/screenshots/mapstudio-dev-390.png` (the tracer after a point click, its popup view and a drawn line) and `docs/screenshots/mapstudio-scale-1440.png` (the 30-pad stand-in).
+
+### Bundle size (measured)
+
+Production webpack build, unsigned, as the Gateway served it on a page load (bytes decoded, gzip of that body, and delta against story 2):
+
+| File | Bytes | gzip | Story 2 | Delta |
+| --- | --- | --- | --- | --- |
+| `MapStudio.js` | 1,179,583 | 315,995 | 1,167,572 | +12,011 |
+| `MapStudio.css` | 72,208 | 10,591 | 70,976 | +1,232 |
+| `maplibre-gl-worker.js` | 517,065 | 147,896 | 517,065 | 0 |
+
+The staged `Map-Studio.unsigned.modl` is 509,949 bytes. The Gateway answered with `content-encoding: gzip` (transferred `MapStudio.js` body 314,937 bytes). No size budget exists, so none is asserted. Playwright reported 0 transferred body bytes for the worker request; why is **[unverified]**.
+
+### Frame rate on the 30-pad scale set (measured, with limits)
+
+Method: requestAnimationFrame timestamps and long tasks sampled in the page while Playwright drives a 4 s circular drag and a 4 s wheel zoom, after a 2 s warm-up, three runs per view. This is the page's frame cadence during the gesture, not MapLibre's own render count.
+
+| View | Pan median fps (runs) | Zoom median fps (runs) |
+| --- | --- | --- |
+| 30-pad stand-in (30 circles, 30 lines) | 5.8 (4.9, 5.8, 6.3) | 6.0 (6.0, 4.4, 14.3) |
+| Tracer (3 points, 1 line) | 15.2 (12.8, 17.7, 15.2) | 13.7 (15.9, 13.1, 13.7) |
+
+An earlier complete run of the same suite on the same box gave 15.8 fps (pan) and 13.7 fps (zoom) for the 30-pad view and 16.7 and 11.6 for the tracer. That spread, from 5.8 to 15.8 fps for the same view, means no cost per pad can be read from these numbers: the box shares its 4 CPUs and renders WebGL on the CPU.
+
+Limits: (1) software WebGL, so a laptop GPU is expected to do better, **[unverified]**; (2) circle and line layers only, with no icons, labels, KPI values or alarm styling, so this is a floor on the finished map's cost; (3) the pads are a seeded stand-in (`web/typescript/scaleData.ts`) for the template's 30-pad set, which this repository cannot read; (4) no run reached 60 fps. NFR-1 (60 fps in a laptop browser) is therefore **not decided** by this measure. Running `E2E_HEADED=1 npm test` on a laptop records a real renderer string beside its numbers.
+
+### Size of one value batch (stand-in)
+
+`values.batch` does not exist yet. The AD-6 envelope `{v, type, id, body: {seq, full, items}}` was built for 30 pads with three LiveValue slots each (comms, icon KPI, alarm count; `e2e/lib/valueBatch.mjs`):
+
+| Batch | Items | JSON bytes (UTF-8) | gzip bytes |
+| --- | --- | --- | --- |
+| Full (on open, reconnect) | 30 | 9,230 | 707 |
+| Changes only, every 10th pad | 3 | 1,019 | 236 |
+
+AD-6 fixes only the LiveValue fields `{value, quality, t, stale, reason}`; the item layout is this story's guess **[unverified]**. Whether Perspective compresses websocket frames is **[unverified]**, so the gzip figure is the best case, not the wire size. The one real message that exists was measured on the wire (Perspective session socket, readable text frames): `point.click` sent 261 bytes, `point.click.reply` received 327 bytes.
+
+### What broke on the phone (measured probes)
+
+390 x 844 px, device scale factor 2, `isMobile` and `hasTouch`, on the tracer view; touch moves go through the Chrome DevTools Protocol, which may differ from a real device **[unverified]**. Seven probes passed and two failed:
+
+| Probe | Result |
+| --- | --- |
+| No horizontal page overflow; the map fills the width | pass (scrollWidth 390; map 390 x 804) |
+| Tap a point: reply text and popup view | pass |
+| Touch drag pans, pinch zooms (canvas pixels compared before and after; not a read of the map centre) | pass |
+| Line tool finishes by touch alone (two vertex taps and a repeat tap on the last) | pass: 2 points |
+| No console or page errors | pass |
+| Touch targets of 44 px or more (PRD) | **fail**: zoom in and out 29 x 29, "Draw a line" 105 x 29 |
+| Popup inside the viewport with a 44 px close button | **fail**: the popup fits (x 70 to 292 of 390) but its close button is 21 x 22 |
+
+Findings feed the phone epic and the viewing epic's bottom sheet (PRD: touch targets of 44 px, popup as a bottom sheet on a phone); the probes record and never fail the suite.
+
+### Not covered
+
+Hours to a green build (story 9 compiles it); the 60 fps NFR-1 verdict on a real GPU; a value batch from a real `values.batch`; real touch hardware.
diff --git a/e2e/global-setup.mjs b/e2e/global-setup.mjs
new file mode 100644
index 0000000..fc27c33
--- /dev/null
+++ b/e2e/global-setup.mjs
@@ -0,0 +1,25 @@
+// Stop before any test when the Gateway is not there, with one line saying why.
+
+import { gatewayUrl } from './lib/env.mjs';
+
+const BUNDLE_PATH = '/res/mapstudio/MapStudio.js';
+
+async function get(url) {
+    try {
+        return await fetch(url, { signal: AbortSignal.timeout(10_000) });
+    } catch (err) {
+        return { ok: false, status: 0, error: String(err && err.message ? err.message : err) };
+    }
+}
+
+export default async function globalSetup() {
+    const base = gatewayUrl();
+    const ping = await get(`${base}/StatusPing`);
+    if (!ping.ok) {
+        throw new Error(`No Gateway answers at ${base}/StatusPing (${ping.error ?? 'HTTP ' + ping.status}). Start it with ops/up.sh, or set GATEWAY_URL.`);
+    }
+    const bundle = await get(`${base}${BUNDLE_PATH}`);
+    if (!bundle.ok) {
+        throw new Error(`The Gateway at ${base} does not serve ${BUNDLE_PATH} (HTTP ${bundle.status}). Is the Map Studio module installed and running? Run ops/up.sh.`);
+    }
+}
diff --git a/e2e/lib/env.mjs b/e2e/lib/env.mjs
new file mode 100644
index 0000000..7a10c7e
--- /dev/null
+++ b/e2e/lib/env.mjs
@@ -0,0 +1,41 @@
+// Where the suite finds the Gateway and where it writes. No secrets: only the
+// host port is read from the git-ignored .env, never the admin password.
+
+import { existsSync, readFileSync } from 'node:fs';
+import path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+const here = path.dirname(fileURLToPath(import.meta.url));
+export const e2eDir = path.resolve(here, '..');
+export const repoRoot = path.resolve(e2eDir, '..');
+
+/** The value of KEY in the repository's .env, or undefined. Other keys are never read. */
+export function envFileValue(key) {
+    const file = path.join(repoRoot, '.env');
+    if (!existsSync(file)) return undefined;
+    for (const line of readFileSync(file, 'utf8').split('\n')) {
+        const m = line.match(/^\s*([A-Z_]+)=(.*)$/);
+        if (m && m[1] === key) return m[2].trim().replace(/^["']|["']$/g, '');
+    }
+    return undefined;
+}
+
+/** GATEWAY_URL, else http://localhost:<GATEWAY_HTTP_PORT from .env, else 9088>. */
+export function gatewayUrl() {
+    if (process.env.GATEWAY_URL) return process.env.GATEWAY_URL.replace(/\/$/, '');
+    const port = process.env.GATEWAY_HTTP_PORT ?? envFileValue('GATEWAY_HTTP_PORT') ?? '9088';
+    return `http://localhost:${port}`;
+}
+
+/** E2E_DOCS=1 rewrites the committed screenshots and measures under docs/. */
+export const docsMode = process.env.E2E_DOCS === '1';
+export const outDir = path.join(e2eDir, 'out');
+export const screenshotDir = docsMode ? path.join(repoRoot, 'docs', 'screenshots') : path.join(outDir, 'screenshots');
+export const measuresFiles = docsMode
+    ? [path.join(outDir, 'measures.json'), path.join(repoRoot, 'docs', 'spike-measures.json')]
+    : [path.join(outDir, 'measures.json')];
+
+/** The project's session URL for a page path such as '/' or '/scale'. */
+export function sessionUrl(pagePath = '/') {
+    return `${gatewayUrl()}/data/perspective/client/mapstudio-dev${pagePath === '/' ? '' : pagePath}`;
+}
diff --git a/e2e/lib/geo.mjs b/e2e/lib/geo.mjs
new file mode 100644
index 0000000..51a8b06
--- /dev/null
+++ b/e2e/lib/geo.mjs
@@ -0,0 +1,31 @@
+// Web Mercator projection, the formula MapLibre uses (512 px tiles), so a test
+// can click a map feature without a handle on the map object.
+
+export function project([lng, lat], zoom) {
+    const scale = 512 * Math.pow(2, zoom);
+    const x = ((lng + 180) / 360) * scale;
+    const rad = (lat * Math.PI) / 180;
+    const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale;
+    return [x, y];
+}
+
+/** Page pixel of lngLat on a map whose bounding box is `box`, centred on `center` at `zoom`. */
+export function pagePixel(box, lngLat, center, zoom) {
+    const [cx, cy] = project(center, zoom);
+    const [px, py] = project(lngLat, zoom);
+    return [box.x + box.width / 2 + (px - cx), box.y + box.height / 2 + (py - cy)];
+}
+
+// The tracer's fixed view and points (web/typescript/testData.ts).
+export const TRACER = {
+    center: [-104.9725, 39.7445],
+    zoom: 12.5,
+    points: {
+        p1: { lngLat: [-104.9903, 39.7392], name: 'Point 1' },
+        p2: { lngLat: [-104.9750, 39.7500], name: 'Point 2' },
+        p3: { lngLat: [-104.9550, 39.7430], name: 'Point 3' }
+    },
+    // Offsets from the map centre for a drawn line's two vertices, chosen to
+    // miss the three test points at this zoom on both viewports.
+    drawOffsets: [[-60, 120], [110, 40]]
+};
diff --git a/e2e/lib/lib.test.mjs b/e2e/lib/lib.test.mjs
new file mode 100644
index 0000000..8be9140
--- /dev/null
+++ b/e2e/lib/lib.test.mjs
@@ -0,0 +1,88 @@
+// Unit tests for the suite's pure helpers: node --test lib/
+
+import assert from 'node:assert/strict';
+import { test } from 'node:test';
+import { project, pagePixel } from './geo.mjs';
+import { unavailable, validateMeasures } from './measures.mjs';
+import { frameStats, median, percentile } from './stats.mjs';
+import { batchSize, buildValuesBatch } from './valueBatch.mjs';
+
+test('median and percentile', () => {
+    assert.equal(median([3, 1, 2]), 2);
+    assert.equal(median([4, 1, 2, 3]), 2.5);
+    assert.equal(median([]), null);
+    assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95), 10);
+    assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50), 5);
+});
+
+test('frameStats on a steady 60 fps and on a slow window', () => {
+    const steady = Array.from({ length: 61 }, (_, i) => i * (1000 / 60));
+    const s = frameStats(steady);
+    assert.equal(s.frames, 61);
+    assert.ok(Math.abs(s.fps - 60) < 0.1);
+    assert.equal(s.shareOver20msPercent, 0);
+    const slow = frameStats([0, 50, 100, 150, 200], [60, 80]);
+    assert.equal(slow.fps, 20);
+    assert.equal(slow.shareOver20msPercent, 100);
+    assert.deepEqual(slow.longTasks, { count: 2, totalMs: 140 });
+});
+
+test('frameStats with too few frames is unavailable, not a number', () => {
+    assert.equal(frameStats([5]).status, 'unavailable');
+    assert.equal(frameStats([]).status, 'unavailable');
+});
+
+test('values.batch stand-in: full has every pad, changes-only a tenth, gzip is smaller', () => {
+    const full = buildValuesBatch({ pads: 30, full: true });
+    const delta = buildValuesBatch({ pads: 30, full: false, every: 10 });
+    assert.equal(full.type, 'values.batch');
+    assert.deepEqual(Object.keys(full), ['v', 'type', 'id', 'body']);
+    assert.equal(full.body.items.length, 30);
+    assert.equal(delta.body.items.length, 3);
+    const f = batchSize(full);
+    const d = batchSize(delta);
+    assert.ok(f.jsonBytes > d.jsonBytes && f.jsonBytes > 1000);
+    assert.ok(f.gzipBytes < f.jsonBytes);
+    assert.deepEqual(batchSize(buildValuesBatch({ pads: 30, full: true })), f);
+    for (const key of ['value', 'quality', 't', 'stale', 'reason']) {
+        assert.ok(key in full.body.items[0].comms);
+    }
+});
+
+test('project: the map centre lands on the middle of the map', () => {
+    const c = [-104.9725, 39.7445];
+    const [x, y] = pagePixel({ x: 10, y: 20, width: 100, height: 60 }, c, c, 12.5);
+    assert.equal(x, 60);
+    assert.equal(y, 50);
+    const [px] = project([0, 0], 0);
+    assert.equal(px, 256);
+});
+
+const goodEnv = { chromium: '153', renderer: 'SwiftShader' };
+const section = { label: 'measured', method: 'm' };
+
+test('validateMeasures accepts a complete file and an unavailable section', () => {
+    const ok = {
+        env: goodEnv,
+        bundle: section,
+        frameRate: unavailable('no WebGL'),
+        valueBatch: { label: 'stand-in', method: 'm' },
+        phone: section
+    };
+    assert.deepEqual(validateMeasures(ok), []);
+});
+
+test('validateMeasures refuses an unlabelled number, a missing section and a measured values.batch', () => {
+    const bad = {
+        env: goodEnv,
+        bundle: { method: 'm' },
+        frameRate: { status: 'unavailable' },
+        valueBatch: { label: 'measured', method: 'm' }
+    };
+    const problems = validateMeasures(bad).join('|');
+    assert.match(problems, /bundle: label/);
+    assert.match(problems, /frameRate: unavailable without a reason/);
+    assert.match(problems, /valueBatch: must be labelled stand-in/);
+    assert.match(problems, /phone: missing/);
+    assert.match(validateMeasures({}).join('|'), /env needs/);
+});
diff --git a/e2e/lib/measures.mjs b/e2e/lib/measures.mjs
new file mode 100644
index 0000000..9abcbfd
--- /dev/null
+++ b/e2e/lib/measures.mjs
@@ -0,0 +1,50 @@
+// The measures file: shape, validation and writing. Every section is either
+// {status: 'unavailable', reason} or carries a label ('measured' or 'stand-in')
+// and the method that produced it, so nothing in the file can pass for more than
+// it is.
+
+import { mkdirSync, writeFileSync } from 'node:fs';
+import path from 'node:path';
+
+export const SECTIONS = ['bundle', 'frameRate', 'valueBatch', 'phone'];
+export const LABELS = ['measured', 'stand-in'];
+
+/** An empty section for a measure that did not run. */
+export function unavailable(reason) {
+    return { status: 'unavailable', reason };
+}
+
+/** Problems with a measures object, as strings; an empty list means it is valid. */
+export function validateMeasures(m) {
+    const problems = [];
+    if (!m || typeof m !== 'object') return ['measures is not an object'];
+    if (!m.env || typeof m.env.renderer !== 'string' || typeof m.env.chromium !== 'string') {
+        problems.push('env needs chromium and renderer');
+    }
+    for (const name of SECTIONS) {
+        const s = m[name];
+        if (!s || typeof s !== 'object') {
+            problems.push(`${name}: missing`);
+        } else if (s.status === 'unavailable') {
+            if (typeof s.reason !== 'string' || s.reason === '') problems.push(`${name}: unavailable without a reason`);
+        } else {
+            if (!LABELS.includes(s.label)) problems.push(`${name}: label must be one of ${LABELS.join(', ')}`);
+            if (typeof s.method !== 'string' || s.method === '') problems.push(`${name}: method missing`);
+        }
+    }
+    if (m.valueBatch && m.valueBatch.status !== 'unavailable' && m.valueBatch.label !== 'stand-in') {
+        problems.push('valueBatch: must be labelled stand-in until values.batch exists');
+    }
+    return problems;
+}
+
+/** Validate, then write the same JSON to every file; throws on an invalid object. */
+export function writeMeasures(m, files) {
+    const problems = validateMeasures(m);
+    if (problems.length) throw new Error('Invalid measures: ' + problems.join('; '));
+    const text = JSON.stringify(m, null, 2) + '\n';
+    for (const f of files) {
+        mkdirSync(path.dirname(f), { recursive: true });
+        writeFileSync(f, text);
+    }
+}
diff --git a/e2e/lib/stats.mjs b/e2e/lib/stats.mjs
new file mode 100644
index 0000000..ca227e5
--- /dev/null
+++ b/e2e/lib/stats.mjs
@@ -0,0 +1,42 @@
+// Plain statistics for the frame rate measure. No dependencies.
+
+export function median(values) {
+    if (values.length === 0) return null;
+    const s = [...values].sort((a, b) => a - b);
+    const mid = Math.floor(s.length / 2);
+    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
+}
+
+/** Nearest-rank percentile, p in 0..100. */
+export function percentile(values, p) {
+    if (values.length === 0) return null;
+    const s = [...values].sort((a, b) => a - b);
+    const rank = Math.max(1, Math.ceil((p / 100) * s.length));
+    return s[rank - 1];
+}
+
+const round = (n, d = 2) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);
+
+/**
+ * Frame statistics from requestAnimationFrame timestamps (ms) and long task
+ * durations (ms). fps is frames per second over the window; the share is the
+ * percentage of frame intervals longer than 20 ms (below 50 fps).
+ */
+export function frameStats(timestamps, longTasks = []) {
+    if (timestamps.length < 2) return { status: 'unavailable', reason: 'fewer than two animation frames in the window' };
+    const intervals = [];
+    for (let i = 1; i < timestamps.length; i++) intervals.push(timestamps[i] - timestamps[i - 1]);
+    const spanMs = timestamps[timestamps.length - 1] - timestamps[0];
+    return {
+        frames: timestamps.length,
+        spanMs: round(spanMs, 0),
+        fps: round(((timestamps.length - 1) / spanMs) * 1000),
+        intervalMs: {
+            p50: round(percentile(intervals, 50)),
+            p95: round(percentile(intervals, 95)),
+            max: round(Math.max(...intervals))
+        },
+        shareOver20msPercent: round((intervals.filter((i) => i > 20).length / intervals.length) * 100, 1),
+        longTasks: { count: longTasks.length, totalMs: round(longTasks.reduce((a, b) => a + b, 0), 0) }
+    };
+}
diff --git a/e2e/lib/valueBatch.mjs b/e2e/lib/valueBatch.mjs
new file mode 100644
index 0000000..626b3bf
--- /dev/null
+++ b/e2e/lib/valueBatch.mjs
@@ -0,0 +1,38 @@
+// A STAND-IN for the size of one batch of icon values. `values.batch` does not
+// exist yet (epic-viewing); this builds the envelope AD-6 describes so its size
+// can be measured now: {v, type, id, body: {seq, full, items}}, each slot one
+// LiveValue {value, quality, t, stale, reason}. AD-6 fixes only the LiveValue
+// fields; the item layout here (pad id plus three slots: comms, icon KPI, alarm
+// count) is an assumption of the story 7 plan, NOT a verified contract.
+
+import { gzipSync } from 'node:zlib';
+
+const padId = (n) => 'pad-' + String(n).padStart(2, '0');
+
+/** Deterministic LiveValue for pad n and slot name, no randomness. */
+function liveValue(n, slot) {
+    const t = Date.UTC(2026, 0, 1, 0, 0, 0) + n * 1000;
+    const iso = new Date(t).toISOString();
+    if (slot === 'comms') return { value: n % 7 !== 0, quality: 'Good', t: iso, stale: false, reason: '' };
+    if (slot === 'kpi') return { value: Math.round((100 + n * 3.7) * 10) / 10, quality: 'Good', t: iso, stale: false, reason: '' };
+    return { value: n % 5 === 0 ? 2 : 0, quality: 'Good', t: iso, stale: false, reason: '' };
+}
+
+/**
+ * The envelope for `pads` pads. `full` carries every pad; otherwise only the
+ * pads whose number is a multiple of `every` (a deterministic changes-only batch).
+ */
+export function buildValuesBatch({ pads, full, every = 10, seq = 1 }) {
+    const items = [];
+    for (let n = 1; n <= pads; n++) {
+        if (!full && n % every !== 0) continue;
+        items.push({ id: padId(n), comms: liveValue(n, 'comms'), kpi: liveValue(n, 'kpi'), alarms: liveValue(n, 'alarms') });
+    }
+    return { v: 1, type: 'values.batch', id: '00000000-0000-4000-8000-000000000001', body: { seq, full, items } };
+}
+
+/** UTF-8 bytes of the JSON text, and gzip bytes of the same text. */
+export function batchSize(envelope) {
+    const text = JSON.stringify(envelope);
+    return { items: envelope.body.items.length, jsonBytes: Buffer.byteLength(text, 'utf8'), gzipBytes: gzipSync(text).length };
+}
diff --git a/e2e/package.json b/e2e/package.json
new file mode 100644
index 0000000..ac60ec3
--- /dev/null
+++ b/e2e/package.json
@@ -0,0 +1,16 @@
+{
+    "name": "@aoindustrial/perspective-map-studio-e2e",
+    "version": "0.1.0",
+    "description": "Playwright smoke suite and measures for Map Studio, run against a dev Gateway.",
+    "private": true,
+    "license": "Apache-2.0",
+    "type": "module",
+    "scripts": {
+        "test": "playwright test",
+        "test:unit": "node --test lib/lib.test.mjs",
+        "docs": "E2E_DOCS=1 playwright test"
+    },
+    "devDependencies": {
+        "@playwright/test": "1.63.0"
+    }
+}
diff --git a/e2e/playwright.config.mjs b/e2e/playwright.config.mjs
new file mode 100644
index 0000000..84ea652
--- /dev/null
+++ b/e2e/playwright.config.mjs
@@ -0,0 +1,31 @@
+import { defineConfig } from '@playwright/test';
+import { gatewayUrl } from './lib/env.mjs';
+
+// One Chromium, software WebGL (MapLibre needs a GL context and the CI runner
+// and the cloud box have no GPU). PW_CHROMIUM_PATH points at a browser the
+// pinned Playwright cannot find itself; `playwright install` is never run here.
+const launchOptions = {
+    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
+};
+if (process.env.PW_CHROMIUM_PATH) launchOptions.executablePath = process.env.PW_CHROMIUM_PATH;
+
+export default defineConfig({
+    testDir: './tests',
+    testMatch: '**/*.spec.mjs',
+    // Serial, no retries: a flaky measure must show as a failure, not a pass on the second try.
+    fullyParallel: false,
+    workers: 1,
+    retries: 0,
+    timeout: 180_000,
+    expect: { timeout: 15_000 },
+    globalSetup: './global-setup.mjs',
+    outputDir: 'out/results',
+    reporter: [['list'], ['html', { open: 'never', outputFolder: 'out/report' }]],
+    use: {
+        baseURL: gatewayUrl(),
+        headless: process.env.E2E_HEADED !== '1',
+        trace: 'retain-on-failure',
+        launchOptions
+    },
+    projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
+});
diff --git a/e2e/tests/fixtures.mjs b/e2e/tests/fixtures.mjs
new file mode 100644
index 0000000..003a326
--- /dev/null
+++ b/e2e/tests/fixtures.mjs
@@ -0,0 +1,48 @@
+// Shared test plumbing: error watching and opening the Map Studio view.
+
+import { expect, test as base } from '@playwright/test';
+import { sessionUrl } from '../lib/env.mjs';
+
+/** Collect browser page errors and console errors, and Map Studio console warnings. */
+export function watch(page) {
+    const errors = [];
+    const warnings = [];
+    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
+    page.on('console', (msg) => {
+        if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
+        if (msg.type() === 'warning' && msg.text().includes('[MapStudio]')) warnings.push(msg.text());
+    });
+    return { errors, warnings };
+}
+
+/** `test` whose every test fails on any browser console error or page error. */
+export const test = base.extend({
+    watched: [
+        async ({ page }, use) => {
+            const w = watch(page);
+            await use(w);
+            expect(w.errors, 'browser console and page errors').toEqual([]);
+        },
+        { auto: true }
+    ]
+});
+export { expect };
+
+/**
+ * Open a dev project page and wait until the map has drawn its first frame.
+ * Returns the map locator. `waitReply: false` is for the popup fallback pages,
+ * which have the same component and so the same reply box.
+ */
+export async function openMap(page, pagePath = '/') {
+    await page.goto(sessionUrl(pagePath), { waitUntil: 'load' });
+    const map = page.locator('.mapstudio-map');
+    await map.waitFor({ state: 'visible', timeout: 60_000 });
+    await page.locator('.mapstudio-map canvas').waitFor({ state: 'visible', timeout: 30_000 });
+    // Perspective may drop the websocket once right after a Gateway restart;
+    // the banner's active class is the signal that it is reconnecting.
+    await page.waitForSelector('.connection-banner.banner-active', { state: 'detached', timeout: 30_000 }).catch(() => {});
+    await page.locator('.mapstudio-reply').waitFor({ state: 'visible' });
+    // Let MapLibre finish its first frame and add the layers.
+    await page.waitForTimeout(1500);
+    return map;
+}
diff --git a/e2e/tests/measures.spec.mjs b/e2e/tests/measures.spec.mjs
new file mode 100644
index 0000000..e30ce83
--- /dev/null
+++ b/e2e/tests/measures.spec.mjs
@@ -0,0 +1,402 @@
+// The spike's measures (epic-module-foundation R6): bundle size, frame rate on
+// the 30-pad scale set, the size of one value batch, and what breaks on a
+// phone. Writes measures.json (and docs/spike-measures.json with E2E_DOCS=1).
+//
+// Every number is labelled 'measured' or 'stand-in' with its method; a measure
+// that cannot run is {status: 'unavailable', reason}. Nothing here asserts a
+// performance limit: the story records, story 9 judges. Only a browser console
+// or page error fails a test.
+
+import { createRequire } from 'node:module';
+import { existsSync, readdirSync, statSync } from 'node:fs';
+import os from 'node:os';
+import path from 'node:path';
+import { gzipSync } from 'node:zlib';
+import { measuresFiles, repoRoot } from '../lib/env.mjs';
+import { TRACER, pagePixel } from '../lib/geo.mjs';
+import { unavailable, writeMeasures } from '../lib/measures.mjs';
+import { frameStats, median } from '../lib/stats.mjs';
+import { batchSize, buildValuesBatch } from '../lib/valueBatch.mjs';
+import { expect, openMap, test, watch } from './fixtures.mjs';
+
+const require = createRequire(import.meta.url);
+
+test.describe.configure({ mode: 'serial' });
+test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
+
+// Story 2's recorded production bundle (docs/platform-checks.md), for the delta.
+const STORY_2_BUNDLE_BYTES = { 'MapStudio.js': 1167572, 'MapStudio.css': 70976, 'maplibre-gl-worker.js': 517065 };
+
+const m = {};
+
+function playwrightVersion() {
+    try {
+        return require('@playwright/test/package.json').version;
+    } catch {
+        return 'unknown';
+    }
+}
+
+async function webglRenderer(page) {
+    return page.evaluate(() => {
+        const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
+        if (!gl) return null;
+        const ext = gl.getExtension('WEBGL_debug_renderer_info');
+        return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
+    });
+}
+
+test.beforeAll(async ({ browser }) => {
+    const page = await browser.newPage();
+    const renderer = await webglRenderer(page);
+    await page.close();
+    m.schema = 1;
+    m.generatedAt = new Date().toISOString();
+    m.env = {
+        chromium: browser.version(),
+        renderer: renderer ?? 'no WebGL context',
+        softwareWebGL: !renderer || /swiftshader|llvmpipe|software/i.test(renderer),
+        playwright: playwrightVersion(),
+        cpus: os.cpus().length,
+        platform: `${os.platform()} ${os.arch()}`,
+        ci: !!process.env.CI,
+        headed: process.env.E2E_HEADED === '1'
+    };
+});
+
+test.afterAll(() => {
+    for (const name of ['bundle', 'frameRate', 'valueBatch', 'phone']) {
+        if (!m[name]) m[name] = unavailable('the measure did not run to completion; see the test output');
+    }
+    writeMeasures(m, measuresFiles);
+});
+
+test('bundle size', async ({ page }) => {
+    const wire = new Map();
+    page.on('response', (r) => {
+        const p = new URL(r.url()).pathname;
+        if (p.startsWith('/res/mapstudio/')) wire.set(p, r);
+    });
+    await openMap(page, '/');
+    const files = [];
+    for (const [p, r] of [...wire].sort()) {
+        const body = await r.body();
+        const sizes = await r.request().sizes();
+        const name = p.split('/').pop();
+        const baseline = STORY_2_BUNDLE_BYTES[name];
+        files.push({
+            file: name,
+            bytes: body.length,
+            gzipBytes: gzipSync(body).length,
+            transferredBodyBytes: sizes.responseBodySize,
+            contentEncoding: r.headers()['content-encoding'] ?? 'none',
+            ...(baseline ? { story2Bytes: baseline, deltaBytes: body.length - baseline } : {})
+        });
+    }
+    if (!files.some((f) => f.file === 'MapStudio.js')) {
+        m.bundle = unavailable('the Gateway served no /res/mapstudio/MapStudio.js during the page load');
+        return;
+    }
+    const modlDirs = [path.join(repoRoot, 'ops', 'modules'), path.join(repoRoot, 'build')];
+    let modl = null;
+    for (const d of modlDirs) {
+        if (!existsSync(d)) continue;
+        const f = readdirSync(d).find((n) => n.endsWith('.modl'));
+        if (f) {
+            modl = { file: f, bytes: statSync(path.join(d, f)).size };
+            break;
+        }
+    }
+    m.bundle = {
+        label: 'measured',
+        method: 'Bytes of each /res/mapstudio/* file as the dev Gateway served it during a page load of the tracer view (response body decoded, gzip of that body, and the body bytes actually transferred), plus the staged .modl. Production webpack build, unsigned.',
+        files,
+        modl,
+        note: 'transferredBodyBytes 0 on maplibre-gl-worker.js: Playwright reported no body transfer for the worker request (Chromium fetches a worker script outside the page; why is unverified). Use bytes and gzipBytes for that file.',
+        budget: 'none defined; recorded only'
+    };
+});
+
+// --- frame rate -----------------------------------------------------------
+
+async function startSampler(page) {
+    await page.evaluate(() => {
+        const s = { t: [], long: [], stop: false };
+        window.__fr = s;
+        try {
+            new PerformanceObserver((list) => { for (const e of list.getEntries()) s.long.push(e.duration); }).observe({ entryTypes: ['longtask'] });
+        } catch (err) { /* long tasks unsupported: the list stays empty */ }
+        const tick = (ts) => { s.t.push(ts); if (!s.stop) requestAnimationFrame(tick); };
+        requestAnimationFrame(tick);
+    });
+}
+
+async function stopSampler(page) {
+    const r = await page.evaluate(() => { window.__fr.stop = true; return { t: window.__fr.t, long: window.__fr.long }; });
+    return frameStats(r.t, r.long);
+}
+
+/** Drag the map round a circle for `ms`, as fast as input can be sent. */
+async function panGesture(page, box, ms) {
+    const cx = box.x + box.width / 2;
+    const cy = box.y + box.height / 2;
+    const r = Math.min(box.width, box.height) * 0.2;
+    await page.mouse.move(cx + r, cy);
+    await page.mouse.down();
+    const t0 = Date.now();
+    while (Date.now() - t0 < ms) {
+        const a = ((Date.now() - t0) / ms) * 4 * Math.PI;
+        await page.mouse.move(cx + r * Math.cos(a), cy + r * Math.sin(a));
+    }
+    await page.mouse.up();
+}
+
+/** Wheel zoom in for half of `ms`, then out for the other half. */
+async function zoomGesture(page, box, ms) {
+    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
+    const t0 = Date.now();
+    while (Date.now() - t0 < ms) {
+        const inward = Date.now() - t0 < ms / 2;
+        await page.mouse.wheel(0, inward ? -60 : 60);
+        await page.waitForTimeout(40);
+    }
+}
+
+async function measureView(page, pagePath) {
+    const map = await openMap(page, pagePath);
+    const box = await map.boundingBox();
+    await panGesture(page, box, 2000); // warm-up, not sampled
+    const runs = [];
+    for (let i = 0; i < 3; i++) {
+        await startSampler(page);
+        await panGesture(page, box, 4000);
+        const pan = await stopSampler(page);
+        await startSampler(page);
+        await zoomGesture(page, box, 4000);
+        const zoom = await stopSampler(page);
+        runs.push({ pan, zoom });
+        await page.waitForTimeout(1000);
+    }
+    const fps = (key) => runs.map((r) => r[key].fps).filter((v) => typeof v === 'number');
+    return {
+        runs,
+        medianFps: { pan: median(fps('pan')), zoom: median(fps('zoom')) },
+        fpsRange: {
+            pan: [Math.min(...fps('pan')), Math.max(...fps('pan'))],
+            zoom: [Math.min(...fps('zoom')), Math.max(...fps('zoom'))]
+        }
+    };
+}
+
+test('frame rate on the 30-pad scale set', async ({ page }) => {
+    test.setTimeout(300_000);
+    if (m.env.renderer === 'no WebGL context') {
+        m.frameRate = unavailable('Chromium gave no WebGL context, so MapLibre cannot draw');
+        return;
+    }
+    const scale = await measureView(page, '/scale');
+    const tracer = await measureView(page, '/');
+    m.frameRate = {
+        label: 'measured',
+        method: 'requestAnimationFrame timestamps and long tasks sampled in the page while Playwright drives a 4 s circular drag and a 4 s wheel zoom (in, then out) on the map, after a 2 s warm-up; 3 runs per view. Frames are the page\'s frame cadence during the gesture, not MapLibre\'s own render count (the map object is not reachable by design).',
+        views: {
+            scale30: { stage: 'stand-in data: 30 seeded pads and 30 lines, circle and line layers only', ...scale },
+            tracer: { stage: '3 points and 1 line, for contrast', ...tracer }
+        },
+        env: { ...m.env, viewport: '1440x900', deviceScaleFactor: 1 },
+        limits: [
+            m.env.softwareWebGL
+                ? 'Software WebGL (CPU rendered): a laptop GPU is expected to do better, which is unverified here.'
+                : 'Hardware WebGL renderer as named in env.renderer.',
+            'Only circle and line layers: no icons, labels, KPI values or alarm styling, so this is a floor on rendering cost, not a measure of the finished map.',
+            'The pads are a seeded stand-in for the template\'s 30-pad set, which this repository cannot read.'
+        ],
+        comparison: 'Compare scale30 with tracer only through fpsRange: on software WebGL the run-to-run spread is as large as the difference between the views, so no cost per pad can be read from these numbers.',
+        nfr1: 'NFR-1 (60 frames per second in a laptop browser) is NOT decided by this measure; story 9 records it as unverified unless the suite is run headed on a laptop (E2E_HEADED=1).'
+    };
+});
+
+// --- value batch ----------------------------------------------------------
+
+test('size of one value batch', async ({ page }) => {
+    // Real wire sizes of the one round trip that exists: point.click and its reply.
+    const frames = [];
+    page.on('websocket', (ws) => {
+        ws.on('framesent', (f) => frames.push({ dir: 'sent', payload: f.payload }));
+        ws.on('framereceived', (f) => frames.push({ dir: 'received', payload: f.payload }));
+    });
+    const map = await openMap(page, '/scale');
+    const count = Number(await map.getAttribute('data-feature-count'));
+    expect(count, 'the scale view reports its feature count').toBeGreaterThan(0);
+    const pads = count / 2; // one pad point and one line per pad
+
+    const full = batchSize(buildValuesBatch({ pads, full: true }));
+    const changes = batchSize(buildValuesBatch({ pads, full: false, every: 10 }));
+
+    // The round trip on the tracer view, with frames counted from just before the click.
+    const tracerMap = await openMap(page, '/');
+    const box = await tracerMap.boundingBox();
+    frames.length = 0;
+    const [x, y] = pagePixel(box, TRACER.points.p1.lngLat, TRACER.center, TRACER.zoom);
+    await page.mouse.click(x, y);
+    await expect(page.locator('.mapstudio-reply')).toContainText('Gateway received click on p1', { timeout: 15_000 });
+    await page.waitForTimeout(500);
+    const matching = frames
+        .map((f) => ({ dir: f.dir, buf: Buffer.isBuffer(f.payload) ? f.payload : Buffer.from(String(f.payload), 'utf8') }))
+        .filter((f) => f.buf.includes('point.click'))
+        .map((f) => ({ direction: f.dir, bytes: f.buf.length, type: f.buf.includes('point.click.reply') ? 'point.click.reply' : 'point.click' }));
+    const wire = matching.length
+        ? { label: 'measured', method: 'Playwright websocket frame sizes of the Perspective session socket, frames whose bytes contain "point.click", from the click to the reply', frames: matching }
+        : unavailable(`no websocket frame carried point.click in a readable form (${frames.length} frames seen since the click)`);
+
+    m.valueBatch = {
+        label: 'stand-in',
+        method: 'values.batch does not exist yet. The AD-6 envelope {v, type, id, body: {seq, full, items}} is built for the scale view\'s pads with three LiveValue slots per pad (comms, icon KPI, alarm count) and its JSON size is measured (UTF-8 bytes, and gzip of the same text).',
+        assumption: 'AD-6 fixes only the LiveValue fields {value, quality, t, stale, reason}; the item layout (pad id plus three named slots) is this story\'s guess, unverified. Whether Perspective compresses websocket frames is unverified, so gzip is an upper bound on the saving, not the wire size.',
+        pads,
+        slotsPerPad: 3,
+        full,
+        changesOnly: { ...changes, rule: 'every 10th pad changed' },
+        wireRoundTrip: wire
+    };
+});
+
+// --- phone ----------------------------------------------------------------
+
+test('what breaks on a 390 px phone', async ({ browser }) => {
+    test.setTimeout(240_000);
+    const context = await browser.newContext({
+        viewport: { width: 390, height: 844 },
+        deviceScaleFactor: 2,
+        isMobile: true,
+        hasTouch: true
+    });
+    const page = await context.newPage();
+    const w = watch(page);
+    const findings = [];
+    const probe = async (check, fn) => {
+        try {
+            const r = await fn();
+            findings.push({ check, ok: !!r.ok, detail: r.detail });
+        } catch (err) {
+            findings.push({ check, ok: false, detail: 'probe threw: ' + String(err && err.message ? err.message : err).split('\n')[0] });
+        }
+    };
+
+    const map = await openMap(page, '/');
+    const box = await map.boundingBox();
+    const reply = page.locator('.mapstudio-reply');
+    const mapShot = () => map.screenshot();
+    const differs = (a, b) => Buffer.compare(a, b) !== 0;
+
+    await probe('page-has-no-horizontal-overflow', async () => {
+        const d = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
+        return { ok: d.scroll <= d.inner, detail: `scrollWidth ${d.scroll}, innerWidth ${d.inner}` };
+    });
+
+    await probe('map-fills-the-viewport-width', async () => ({
+        ok: Math.abs(box.width - 390) <= 1,
+        detail: `map ${Math.round(box.width)} x ${Math.round(box.height)} px`
+    }));
+
+    await probe('touch-targets-at-least-44-px', async () => {
+        const rects = await page.evaluate(() => [...document.querySelectorAll('.mapstudio .maplibregl-ctrl button')].map((b) => {
+            const r = b.getBoundingClientRect();
+            return { name: b.getAttribute('aria-label') || b.title || b.className, w: Math.round(r.width), h: Math.round(r.height) };
+        }));
+        const small = rects.filter((r) => Math.min(r.w, r.h) < 44);
+        return { ok: rects.length > 0 && small.length === 0, detail: rects.map((r) => `${r.name} ${r.w}x${r.h}`).join('; ') || 'no controls found' };
+    });
+
+    await probe('tap-a-point-gives-reply-and-popup', async () => {
+        const [x, y] = pagePixel(box, TRACER.points.p1.lngLat, TRACER.center, TRACER.zoom);
+        await page.touchscreen.tap(x, y);
+        await expect(reply).toContainText('Gateway received click on p1', { timeout: 10_000 });
+        await expect(page.locator('.maplibregl-popup .mapstudio-popup--view')).toContainText('Id: p1', { timeout: 20_000 });
+        return { ok: true, detail: 'reply text and popup view shown after a touch tap' };
+    });
+
+    await probe('popup-inside-the-viewport-with-a-44-px-close', async () => {
+        const d = await page.evaluate(() => {
+            const pop = document.querySelector('.maplibregl-popup-content');
+            const close = document.querySelector('.maplibregl-popup-close-button');
+            if (!pop || !close) return null;
+            const a = pop.getBoundingClientRect();
+            const c = close.getBoundingClientRect();
+            return { left: a.left, right: a.right, top: a.top, bottom: a.bottom, vw: window.innerWidth, vh: window.innerHeight, closeW: c.width, closeH: c.height };
+        });
+        if (!d) return { ok: false, detail: 'no popup open' };
+        const inside = d.left >= 0 && d.right <= d.vw && d.top >= 0 && d.bottom <= d.vh;
+        const closeOk = Math.min(d.closeW, d.closeH) >= 44;
+        return {
+            ok: inside && closeOk,
+            detail: `popup x ${Math.round(d.left)}..${Math.round(d.right)} of ${d.vw}, y ${Math.round(d.top)}..${Math.round(d.bottom)} of ${d.vh}; close ${Math.round(d.closeW)}x${Math.round(d.closeH)}`
+        };
+    });
+
+    const cdp = await context.newCDPSession(page);
+
+    await probe('touch-drag-pans-the-map', async () => {
+        const before = await mapShot();
+        const sx = box.x + box.width * 0.7;
+        const sy = box.y + box.height * 0.5;
+        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
+        for (let i = 1; i <= 12; i++) {
+            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx - i * 12, y: sy }] });
+            await page.waitForTimeout(16);
+        }
+        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
+        await page.waitForTimeout(1000);
+        const after = await mapShot();
+        return { ok: differs(before, after), detail: 'canvas pixels compared before and after a CDP touch drag of 144 px (a pixel comparison, not a read of the map centre)' };
+    });
+
+    await probe('pinch-zooms-the-map', async () => {
+        const before = await mapShot();
+        await cdp.send('Input.synthesizePinchGesture', {
+            x: Math.round(box.x + box.width / 2),
+            y: Math.round(box.y + box.height / 2),
+            scaleFactor: 2,
+            relativeSpeed: 300,
+            gestureSourceType: 'touch'
+        });
+        await page.waitForTimeout(1000);
+        const after = await mapShot();
+        return { ok: differs(before, after), detail: 'canvas pixels compared before and after a CDP pinch of scale 2 (a pixel comparison)' };
+    });
+
+    await probe('line-tool-finishes-by-touch-alone', async () => {
+        const cx = box.x + box.width / 2;
+        const cy = box.y + box.height / 2;
+        const [a, b] = TRACER.drawOffsets.map(([dx, dy]) => [cx + dx, cy + dy + 140]);
+        await page.touchscreen.tap(...(await page.locator('.mapstudio-draw-button').evaluate((el) => {
+            const r = el.getBoundingClientRect();
+            return [r.x + r.width / 2, r.y + r.height / 2];
+        })));
+        await expect(reply).toHaveAttribute('data-drawing', 'true', { timeout: 5_000 });
+        await page.touchscreen.tap(a[0], a[1]);
+        await page.waitForTimeout(300);
+        await page.touchscreen.tap(b[0], b[1]);
+        await page.waitForTimeout(300);
+        // No Enter key on a phone: tapping the last vertex again is the touch way to finish.
+        await page.touchscreen.tap(b[0], b[1]);
+        await page.waitForTimeout(800);
+        const points = await reply.getAttribute('data-line-points');
+        return { ok: points === '2', detail: `data-line-points after two vertex taps and a repeat tap on the last: '${points}' (whether Terra Draw finishes this way on touch is the thing probed)` };
+    });
+
+    await probe('no-console-or-page-errors', async () => ({
+        ok: w.errors.length === 0,
+        detail: w.errors.length ? w.errors.slice(0, 5).join(' | ') : 'none'
+    }));
+
+    await context.close();
+    m.phone = {
+        label: 'measured',
+        method: 'Chromium with isMobile and hasTouch at 390x844 (device scale factor 2) on the tracer view; each probe records ok and a detail, and a failed probe is a finding, not a test failure. Touch moves go through CDP Input.dispatchTouchEvent and Input.synthesizePinchGesture; whether they match a real device\'s touch handling is unverified.',
+        viewport: '390x844',
+        findings,
+        summary: { ok: findings.filter((f) => f.ok).length, failed: findings.filter((f) => !f.ok).length }
+    };
+    expect(w.errors, 'browser console and page errors on the phone').toEqual([]);
+});
diff --git a/e2e/tests/popup.spec.mjs b/e2e/tests/popup.spec.mjs
new file mode 100644
index 0000000..7772e70
--- /dev/null
+++ b/e2e/tests/popup.spec.mjs
@@ -0,0 +1,51 @@
+// The point popup: a project view by path with its params, a second point
+// moves it, close unmounts it; and the text fallback for an empty and for a
+// missing view path (their own dev pages, so no Gateway restart is needed).
+
+import { TRACER, pagePixel } from '../lib/geo.mjs';
+import { expect, openMap, test } from './fixtures.mjs';
+
+test.use({ viewport: { width: 1440, height: 900 } });
+
+async function clickPoint(page, map, id) {
+    const box = await map.boundingBox();
+    const [x, y] = pagePixel(box, TRACER.points[id].lngLat, TRACER.center, TRACER.zoom);
+    await page.mouse.click(x, y);
+}
+
+test('custom view with author params, a second point, close', async ({ page, watched }) => {
+    const map = await openMap(page, '/');
+    await clickPoint(page, map, 'p1');
+    // The view's label shows the author param "dev" beside mapItem.
+    await expect(page.locator('.mapstudio-popup--view')).toContainText('Name: Point 1 (dev)', { timeout: 30_000 });
+
+    await clickPoint(page, map, 'p2');
+    await expect(page.locator('.mapstudio-popup--view')).toContainText('Id: p2', { timeout: 30_000 });
+    await expect(page.locator('.maplibregl-popup')).toHaveCount(1);
+    expect(watched.warnings, 'Map Studio warnings').toEqual([]);
+
+    await page.locator('.maplibregl-popup-close-button').click();
+    await expect(page.locator('.maplibregl-popup')).toHaveCount(0);
+    await expect(page.locator('.mapstudio-popup')).toHaveCount(0);
+    await page.waitForTimeout(1000);
+    expect(watched.warnings, 'Map Studio warnings after close').toEqual([]);
+});
+
+test('empty view path falls back to a text popup with no warning', async ({ page, watched }) => {
+    const map = await openMap(page, '/fallback-empty');
+    await clickPoint(page, map, 'p1');
+    await expect(page.locator('.mapstudio-popup--text')).toContainText('p1', { timeout: 30_000 });
+    await expect(page.locator('.mapstudio-popup--view')).toHaveCount(0);
+    await page.waitForTimeout(500);
+    expect(watched.warnings, 'Map Studio warnings').toEqual([]);
+});
+
+test('missing view falls back to text with exactly one warning naming the path', async ({ page, watched }) => {
+    const map = await openMap(page, '/fallback-missing');
+    await clickPoint(page, map, 'p1');
+    await expect(page.locator('.mapstudio-popup--text')).toContainText('p1', { timeout: 30_000 });
+    await expect(page.locator('.mapstudio-popup--view')).toHaveCount(0);
+    await page.waitForTimeout(500);
+    expect(watched.warnings).toHaveLength(1);
+    expect(watched.warnings[0]).toContain('"Popups/Nope"');
+});
diff --git a/e2e/tests/scale.spec.mjs b/e2e/tests/scale.spec.mjs
new file mode 100644
index 0000000..1544b2e
--- /dev/null
+++ b/e2e/tests/scale.spec.mjs
@@ -0,0 +1,16 @@
+// The 30-pad scale view draws its seeded stand-in data set (30 pads, 30 lines).
+
+import { mkdirSync } from 'node:fs';
+import path from 'node:path';
+import { screenshotDir } from '../lib/env.mjs';
+import { expect, openMap, test } from './fixtures.mjs';
+
+test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
+
+test('the scale page draws 30 pads and their lines', async ({ page }) => {
+    const map = await openMap(page, '/scale');
+    await expect(map).toHaveAttribute('data-test-set', 'scale30');
+    await expect(map).toHaveAttribute('data-feature-count', '60');
+    mkdirSync(screenshotDir, { recursive: true });
+    await page.screenshot({ path: path.join(screenshotDir, 'mapstudio-scale-1440.png') });
+});
diff --git a/e2e/tests/tracer.spec.mjs b/e2e/tests/tracer.spec.mjs
new file mode 100644
index 0000000..4af857a
--- /dev/null
+++ b/e2e/tests/tracer.spec.mjs
@@ -0,0 +1,64 @@
+// The tracer view at 1440 and 390 px: points, line, the round trip, the popup
+// view and a drawn line; one screenshot per width for the docs (AD-15).
+
+import { mkdirSync } from 'node:fs';
+import path from 'node:path';
+import { screenshotDir } from '../lib/env.mjs';
+import { TRACER, pagePixel } from '../lib/geo.mjs';
+import { expect, openMap, test } from './fixtures.mjs';
+
+for (const [width, height] of [[1440, 900], [390, 844]]) {
+    test.describe(`${width} px`, () => {
+        test.use({ viewport: { width, height }, deviceScaleFactor: 1 });
+
+        test('map, round trip, popup view and a drawn line', async ({ page }) => {
+            const map = await openMap(page, '/');
+            await expect(map).toHaveAttribute('data-test-set', 'tracer');
+            await expect(map).toHaveAttribute('data-feature-count', '4');
+            const box = await map.boundingBox();
+            expect(box, 'map container has a bounding box').not.toBeNull();
+            // The component fills the width of the viewport.
+            expect(Math.abs(box.width - width)).toBeLessThanOrEqual(1);
+
+            // One round trip: click p1, the Gateway answers in the envelope.
+            const [x, y] = pagePixel(box, TRACER.points.p1.lngLat, TRACER.center, TRACER.zoom);
+            await page.mouse.click(x, y);
+            const reply = page.locator('.mapstudio-reply');
+            await expect(reply).toContainText('Gateway received click on p1', { timeout: 15_000 });
+
+            // The click also opens the project view popup with the point id.
+            const popup = page.locator('.maplibregl-popup .mapstudio-popup--view');
+            await expect(popup).toContainText('Id: p1', { timeout: 30_000 });
+
+            // Escape cancels a drawing: one vertex, then nothing is drawn.
+            const cx = box.x + box.width / 2;
+            const cy = box.y + box.height / 2;
+            const [a, b] = TRACER.drawOffsets.map(([dx, dy]) => [cx + dx, cy + dy]);
+            const toggle = page.locator('.mapstudio-draw-button');
+            await toggle.click();
+            await expect(reply).toHaveAttribute('data-drawing', 'true');
+            await page.mouse.click(a[0], a[1]);
+            await page.waitForTimeout(300);
+            await page.keyboard.press('Escape');
+            await expect(reply).toHaveAttribute('data-drawing', 'false');
+            await expect(reply).toHaveAttribute('data-line-points', '');
+            await expect(page.locator('.mapstudio-draw-button[aria-pressed="true"]')).toHaveCount(0);
+
+            // A two-vertex line finished with Enter.
+            await toggle.click();
+            await expect(reply).toHaveAttribute('data-drawing', 'true');
+            await page.mouse.click(a[0], a[1]);
+            await page.waitForTimeout(300);
+            await page.mouse.click(b[0], b[1]);
+            await page.waitForTimeout(300);
+            await page.keyboard.press('Enter');
+            await expect(reply).toHaveAttribute('data-line-points', '2');
+            await expect(reply.locator('.mapstudio-draw-status')).toContainText('Line drawn with 2 points');
+            // Let Terra Draw's layers render the finished line.
+            await page.waitForTimeout(500);
+
+            mkdirSync(screenshotDir, { recursive: true });
+            await page.screenshot({ path: path.join(screenshotDir, `mapstudio-dev-${width}.png`), fullPage: false });
+        });
+    });
+}
diff --git a/ops/popup-check.mjs b/ops/popup-check.mjs
deleted file mode 100644
index 821208a..0000000
--- a/ops/popup-check.mjs
+++ /dev/null
@@ -1,124 +0,0 @@
-#!/usr/bin/env node
-// Check the point popup against the running dev Gateway (story 4): clicking a
-// point opens the project view named by popupView.path with the point as its
-// mapItem parameter beside the author's params; clicking another point moves
-// the popup; the close button removes the view. With --expect-fallback the
-// dev view must point at an empty or missing path and the text fallback is
-// checked instead (edit ops/project/.../MapStudioDev/view.json, restart with
-// ops/up.sh --no-build, run this, then restore the path and restart again):
-// with --missing-view <path> exactly one Map Studio warning naming that path
-// is required; without it (an empty path) no warning may appear.
-//
-// Usage: node ops/popup-check.mjs [--url http://localhost:9088] [--expect-fallback [--missing-view <path>]]
-//
-// Needs Playwright with its Chromium, like ops/screenshot.mjs. Exits 1 on any
-// console error or page error, and when a check fails.
-
-import { createRequire } from 'node:module';
-
-const require = createRequire(import.meta.url);
-const { chromium } = require('playwright');
-
-const argUrl = process.argv.indexOf('--url');
-const baseUrl = argUrl > -1 ? process.argv[argUrl + 1] : (process.env.GATEWAY_URL ?? 'http://localhost:9088');
-const expectFallback = process.argv.includes('--expect-fallback');
-const argMissing = process.argv.indexOf('--missing-view');
-const missingView = argMissing > -1 ? process.argv[argMissing + 1] : null;
-const session = `${baseUrl}/data/perspective/client/mapstudio-dev`;
-
-// The map's fixed view and test data (web/typescript/testData.ts), projected
-// with the Web Mercator formula as in ops/screenshot.mjs.
-const CENTER = [-104.9725, 39.7445];
-const ZOOM = 12.5;
-const POINTS = {
-    p1: { lngLat: [-104.9903, 39.7392], name: 'Point 1' },
-    p2: { lngLat: [-104.9750, 39.7500], name: 'Point 2' }
-};
-
-function project([lng, lat], zoom) {
-    const scale = 512 * Math.pow(2, zoom);
-    const x = ((lng + 180) / 360) * scale;
-    const rad = (lat * Math.PI) / 180;
-    const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale;
-    return [x, y];
-}
-
-async function main() {
-    const browser = await chromium.launch({
-        headless: true,
-        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
-    });
-    const errors = [];
-    const warnings = [];
-    try {
-        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
-        page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
-        page.on('console', (msg) => {
-            if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
-            if (msg.type() === 'warning' && msg.text().includes('[MapStudio]')) warnings.push(msg.text());
-        });
-
-        await page.goto(session, { waitUntil: 'load' });
-        const map = page.locator('.mapstudio-map');
-        await map.waitFor({ state: 'visible', timeout: 60_000 });
-        await page.locator('.mapstudio-map canvas').waitFor({ state: 'visible', timeout: 30_000 });
-        await page.waitForSelector('.connection-banner.banner-active', { state: 'detached', timeout: 30_000 }).catch(() => {});
-        await page.waitForTimeout(1500);
-
-        const box = await map.boundingBox();
-        if (!box) throw new Error('map container has no bounding box');
-        const [cx, cy] = project(CENTER, ZOOM);
-        const click = async (id) => {
-            const [px, py] = project(POINTS[id].lngLat, ZOOM);
-            await page.mouse.click(box.x + box.width / 2 + (px - cx), box.y + box.height / 2 + (py - cy));
-        };
-        const popup = page.locator('.maplibregl-popup .mapstudio-popup');
-        const popupText = async () => (await popup.textContent()).replace(/\s+/g, ' ').trim();
-
-        await click('p1');
-        await popup.waitFor({ timeout: 15_000 });
-        if (expectFallback) {
-            await page.locator('.mapstudio-popup--text').waitFor({ timeout: 30_000 });
-            console.log(`fallback popup: ${await popupText()}`);
-            if (await page.locator('.mapstudio-popup--view').count() !== 0) throw new Error('a view is mounted in the fallback popup');
-            await page.waitForTimeout(500);
-            if (missingView) {
-                if (warnings.length !== 1 || !warnings[0].includes(`"${missingView}"`)) {
-                    throw new Error(`expected one warning naming ${missingView}, got: ${JSON.stringify(warnings)}`);
-                }
-            } else if (warnings.length) {
-                throw new Error(`expected no warning for an empty path, got: ${warnings.join('; ')}`);
-            }
-        } else {
-            // The view's label shows the author param "dev" beside mapItem.
-            await page.locator('.mapstudio-popup--view').filter({ hasText: 'Name: Point 1 (dev)' }).waitFor({ timeout: 30_000 });
-            console.log(`p1 popup: ${await popupText()}`);
-            await click('p2');
-            await page.locator('.mapstudio-popup--view').filter({ hasText: 'Id: p2' }).waitFor({ timeout: 30_000 });
-            console.log(`p2 popup: ${await popupText()}`);
-            const open = await page.locator('.maplibregl-popup').count();
-            if (open !== 1) throw new Error(`expected one popup, found ${open}`);
-            if (warnings.length) throw new Error(`unexpected Map Studio warning: ${warnings.join('; ')}`);
-        }
-
-        await page.locator('.maplibregl-popup-close-button').click();
-        await page.locator('.maplibregl-popup').waitFor({ state: 'detached', timeout: 10_000 });
-        const left = await page.locator('.mapstudio-popup').count();
-        if (left !== 0) throw new Error(`popup content still mounted after close: ${left}`);
-        console.log('closed: popup and view removed');
-        await page.waitForTimeout(1000);
-        console.log(`Map Studio warnings: ${warnings.length ? warnings.join('; ') : 'none'}`);
-    } finally {
-        await browser.close();
-    }
-    if (errors.length) {
-        console.error(`${errors.length} error(s) in the session:`);
-        errors.forEach((e) => console.error(`  ${e}`));
-        process.exit(1);
-    }
-}
-
-main().catch((err) => {
-    console.error(err);
-    process.exit(1);
-});
diff --git a/ops/project/com.inductiveautomation.perspective/page-config/config.json b/ops/project/com.inductiveautomation.perspective/page-config/config.json
index db213f3..06b051c 100644
--- a/ops/project/com.inductiveautomation.perspective/page-config/config.json
+++ b/ops/project/com.inductiveautomation.perspective/page-config/config.json
@@ -3,6 +3,18 @@
   "/": {
    "viewPath": "MapStudioDev",
    "viewParams": {}
+  },
+  "/scale": {
+   "viewPath": "MapStudioScale",
+   "viewParams": {}
+  },
+  "/fallback-empty": {
+   "viewPath": "MapStudioFallbackEmpty",
+   "viewParams": {}
+  },
+  "/fallback-missing": {
+   "viewPath": "MapStudioFallbackMissing",
+   "viewParams": {}
   }
  },
  "shared": {},
diff --git a/ops/project/com.inductiveautomation.perspective/views/MapStudioFallbackEmpty/resource.json b/ops/project/com.inductiveautomation.perspective/views/MapStudioFallbackEmpty/resource.json
new file mode 100644
index 0000000..276dced
--- /dev/null
+++ b/ops/project/com.inductiveautomation.perspective/views/MapStudioFallbackEmpty/resource.json
@@ -0,0 +1,10 @@
+{
+  "scope": "G",
+  "version": 1,
+  "restricted": false,
+  "overridable": true,
+  "files": [
+    "view.json"
+  ],
+  "attributes": {}
+}
diff --git a/ops/project/com.inductiveautomation.perspective/views/MapStudioFallbackEmpty/view.json b/ops/project/com.inductiveautomation.perspective/views/MapStudioFallbackEmpty/view.json
new file mode 100644
index 0000000..51dee4f
--- /dev/null
+++ b/ops/project/com.inductiveautomation.perspective/views/MapStudioFallbackEmpty/view.json
@@ -0,0 +1,62 @@
+{
+ "custom": {},
+ "params": {},
+ "props": {
+  "defaultSize": {
+   "width": 1440,
+   "height": 900
+  }
+ },
+ "root": {
+  "type": "ia.container.flex",
+  "version": 0,
+  "props": {
+   "direction": "column"
+  },
+  "meta": {
+   "name": "root"
+  },
+  "position": {},
+  "custom": {},
+  "children": [
+   {
+    "type": "ia.display.label",
+    "version": 0,
+    "props": {
+     "text": "Map Studio: the popup falls back to text (empty view path).",
+     "style": {
+      "padding": "8px 12px"
+     }
+    },
+    "meta": {
+     "name": "title"
+    },
+    "position": {
+     "basis": "40px",
+     "shrink": 0
+    },
+    "custom": {}
+   },
+   {
+    "type": "ao.mapstudio",
+    "version": 0,
+    "props": {
+     "popupView": {
+      "path": "",
+      "params": {
+       "source": "dev"
+      }
+     }
+    },
+    "meta": {
+     "name": "map"
+    },
+    "position": {
+     "basis": "0px",
+     "grow": 1
+    },
+    "custom": {}
+   }
+  ]
+ }
+}
diff --git a/ops/project/com.inductiveautomation.perspective/views/MapStudioFallbackMissing/resource.json b/ops/project/com.inductiveautomation.perspective/views/MapStudioFallbackMissing/resource.json
new file mode 100644
index 0000000..276dced
--- /dev/null
+++ b/ops/project/com.inductiveautomation.perspective/views/MapStudioFallbackMissing/resource.json
@@ -0,0 +1,10 @@
+{
+  "scope": "G",
+  "version": 1,
+  "restricted": false,
+  "overridable": true,
+  "files": [
+    "view.json"
+  ],
+  "attributes": {}
+}
diff --git a/ops/project/com.inductiveautomation.perspective/views/MapStudioFallbackMissing/view.json b/ops/project/com.inductiveautomation.perspective/views/MapStudioFallbackMissing/view.json
new file mode 100644
index 0000000..0bc4c42
--- /dev/null
+++ b/ops/project/com.inductiveautomation.perspective/views/MapStudioFallbackMissing/view.json
@@ -0,0 +1,62 @@
+{
+ "custom": {},
+ "params": {},
+ "props": {
+  "defaultSize": {
+   "width": 1440,
+   "height": 900
+  }
+ },
+ "root": {
+  "type": "ia.container.flex",
+  "version": 0,
+  "props": {
+   "direction": "column"
+  },
+  "meta": {
+   "name": "root"
+  },
+  "position": {},
+  "custom": {},
+  "children": [
+   {
+    "type": "ia.display.label",
+    "version": 0,
+    "props": {
+     "text": "Map Studio: the popup falls back to text (missing view Popups/Nope).",
+     "style": {
+      "padding": "8px 12px"
+     }
+    },
+    "meta": {
+     "name": "title"
+    },
+    "position": {
+     "basis": "40px",
+     "shrink": 0
+    },
+    "custom": {}
+   },
+   {
+    "type": "ao.mapstudio",
+    "version": 0,
+    "props": {
+     "popupView": {
+      "path": "Popups/Nope",
+      "params": {
+       "source": "dev"
+      }
+     }
+    },
+    "meta": {
+     "name": "map"
+    },
+    "position": {
+     "basis": "0px",
+     "grow": 1
+    },
+    "custom": {}
+   }
+  ]
+ }
+}
diff --git a/ops/project/com.inductiveautomation.perspective/views/MapStudioScale/resource.json b/ops/project/com.inductiveautomation.perspective/views/MapStudioScale/resource.json
new file mode 100644
index 0000000..276dced
--- /dev/null
+++ b/ops/project/com.inductiveautomation.perspective/views/MapStudioScale/resource.json
@@ -0,0 +1,10 @@
+{
+  "scope": "G",
+  "version": 1,
+  "restricted": false,
+  "overridable": true,
+  "files": [
+    "view.json"
+  ],
+  "attributes": {}
+}
diff --git a/ops/project/com.inductiveautomation.perspective/views/MapStudioScale/view.json b/ops/project/com.inductiveautomation.perspective/views/MapStudioScale/view.json
new file mode 100644
index 0000000..8aeab8c
--- /dev/null
+++ b/ops/project/com.inductiveautomation.perspective/views/MapStudioScale/view.json
@@ -0,0 +1,63 @@
+{
+ "custom": {},
+ "params": {},
+ "props": {
+  "defaultSize": {
+   "width": 1440,
+   "height": 900
+  }
+ },
+ "root": {
+  "type": "ia.container.flex",
+  "version": 0,
+  "props": {
+   "direction": "column"
+  },
+  "meta": {
+   "name": "root"
+  },
+  "position": {},
+  "custom": {},
+  "children": [
+   {
+    "type": "ia.display.label",
+    "version": 0,
+    "props": {
+     "text": "Map Studio scale set: 30 pads, for the frame rate measure.",
+     "style": {
+      "padding": "8px 12px"
+     }
+    },
+    "meta": {
+     "name": "title"
+    },
+    "position": {
+     "basis": "40px",
+     "shrink": 0
+    },
+    "custom": {}
+   },
+   {
+    "type": "ao.mapstudio",
+    "version": 0,
+    "props": {
+     "testSet": "scale30",
+         "popupView": {
+      "path": "Popups/PointDetails",
+      "params": {
+       "source": "dev"
+      }
+     }
+    },
+    "meta": {
+     "name": "map"
+    },
+    "position": {
+     "basis": "0px",
+     "grow": 1
+    },
+    "custom": {}
+   }
+  ]
+ }
+}
diff --git a/ops/screenshot.mjs b/ops/screenshot.mjs
deleted file mode 100644
index 409ffd5..0000000
--- a/ops/screenshot.mjs
+++ /dev/null
@@ -1,152 +0,0 @@
-#!/usr/bin/env node
-// Capture the mapstudio-dev view in headless Chromium at 1440 and 390 px wide,
-// after clicking one point (which opens the project view popup) and drawing
-// one line with the line tool, and save the images to docs/screenshots/.
-//
-// Usage: node ops/screenshot.mjs [--url http://localhost:9088]
-// The Gateway URL defaults to GATEWAY_URL, else http://localhost:9088; with a
-// GATEWAY_HTTP_PORT in .env pass --url http://localhost:<port>.
-//
-// Needs Playwright with its Chromium (`npm i -g playwright` plus
-// `npx playwright install chromium`, or an environment that has them). Fails
-// on any console error or page error in the session, and when the Gateway
-// does not answer the click.
-
-import { createRequire } from 'node:module';
-import { mkdir } from 'node:fs/promises';
-import path from 'node:path';
-import { fileURLToPath } from 'node:url';
-
-const require = createRequire(import.meta.url);
-const { chromium } = require('playwright');
-
-const here = path.dirname(fileURLToPath(import.meta.url));
-const outDir = path.resolve(here, '..', 'docs', 'screenshots');
-const argUrl = process.argv.indexOf('--url');
-const baseUrl = argUrl > -1 ? process.argv[argUrl + 1] : (process.env.GATEWAY_URL ?? 'http://localhost:9088');
-const session = `${baseUrl}/data/perspective/client/mapstudio-dev`;
-
-// The map's fixed view and test data (web/typescript/testData.ts). The click
-// target is projected with the Web Mercator formula MapLibre uses, so the
-// script needs no handle on the map object.
-const CENTER = [-104.9725, 39.7445];
-const ZOOM = 12.5;
-const POINT = { id: 'p1', lngLat: [-104.9903, 39.7392] };
-// Pixel offsets from the map centre for the drawn line's two vertices, chosen
-// to miss the three test points at this zoom on both viewports.
-const DRAW_OFFSETS = [[-60, 120], [110, 40]];
-
-function project([lng, lat], zoom) {
-    const scale = 512 * Math.pow(2, zoom);
-    const x = ((lng + 180) / 360) * scale;
-    const rad = (lat * Math.PI) / 180;
-    const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale;
-    return [x, y];
-}
-
-async function capture(browser, width, height) {
-    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
-    const page = await context.newPage();
-    const errors = [];
-    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
-    page.on('console', (msg) => {
-        if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
-    });
-
-    await page.goto(session, { waitUntil: 'load' });
-    const map = page.locator('.mapstudio-map');
-    await map.waitFor({ state: 'visible', timeout: 60_000 });
-    await page.locator('.mapstudio-map canvas').waitFor({ state: 'visible', timeout: 30_000 });
-    // Perspective may drop the websocket once right after a Gateway restart;
-    // the banner's active class is the signal that it is reconnecting.
-    await page.waitForSelector('.connection-banner.banner-active', { state: 'detached', timeout: 30_000 }).catch(() => {});
-    await page.locator('.mapstudio-reply').waitFor({ state: 'visible' });
-    // Let MapLibre finish its first frame and add the layers.
-    await page.waitForTimeout(1500);
-
-    const box = await map.boundingBox();
-    if (!box) throw new Error('map container has no bounding box');
-    const [cx, cy] = project(CENTER, ZOOM);
-    const [px, py] = project(POINT.lngLat, ZOOM);
-    const x = box.x + box.width / 2 + (px - cx);
-    const y = box.y + box.height / 2 + (py - cy);
-    await page.mouse.click(x, y);
-
-    const reply = page.locator('.mapstudio-reply');
-    await reply.filter({ hasText: `Gateway received click on ${POINT.id}` }).waitFor({ timeout: 15_000 });
-    const replyText = await reply.textContent();
-
-    // Story 4: the click also opens a popup rendering the project view
-    // Popups/PointDetails, whose label shows the point id from its mapItem
-    // parameter. The text fallback would also contain the id, so the check
-    // insists on the view's own label text.
-    const popup = page.locator('.maplibregl-popup .mapstudio-popup--view');
-    await popup.waitFor({ state: 'visible', timeout: 15_000 });
-    await popup.filter({ hasText: `Id: ${POINT.id}` }).waitFor({ timeout: 30_000 });
-    const popupText = (await popup.textContent()).replace(/\s+/g, ' ').trim();
-
-    // Draw one line with Terra Draw: toggle the tool, click two spots clear of
-    // the test points, press Enter to finish. The status line reports the count.
-    const toggle = page.locator('.mapstudio-draw-button');
-    const [ax, ay] = [box.x + box.width / 2 + DRAW_OFFSETS[0][0], box.y + box.height / 2 + DRAW_OFFSETS[0][1]];
-    const [bx, by] = [box.x + box.width / 2 + DRAW_OFFSETS[1][0], box.y + box.height / 2 + DRAW_OFFSETS[1][1]];
-
-    // Cancel first: one vertex, then Escape leaves the tool with nothing drawn.
-    await toggle.click();
-    await page.waitForSelector('.mapstudio-reply[data-drawing="true"]', { timeout: 5_000 });
-    await page.mouse.click(ax, ay);
-    await page.waitForTimeout(300);
-    await page.keyboard.press('Escape');
-    await page.waitForSelector('.mapstudio-reply[data-drawing="false"][data-line-points=""]', { timeout: 5_000 });
-    if (await page.locator('.mapstudio-draw-button[aria-pressed="true"]').count() !== 0) {
-        throw new Error('the line tool is still pressed after Escape');
-    }
-
-    await toggle.click();
-    await page.waitForSelector('.mapstudio-reply[data-drawing="true"]', { timeout: 5_000 });
-    await page.mouse.click(ax, ay);
-    await page.waitForTimeout(300);
-    await page.mouse.click(bx, by);
-    await page.waitForTimeout(300);
-    await page.keyboard.press('Enter');
-    await page.waitForSelector('.mapstudio-reply[data-line-points="2"]', { timeout: 5_000 });
-    const text = await reply.locator('.mapstudio-draw-status').textContent();
-    // Let Terra Draw's layers render the finished line.
-    await page.waitForTimeout(500);
-
-    const file = path.join(outDir, `mapstudio-dev-${width}.png`);
-    await page.screenshot({ path: file, fullPage: false });
-    await context.close();
-    return { file, text: `${replyText} | ${text}`, popupText, errors };
-}
-
-async function main() {
-    await mkdir(outDir, { recursive: true });
-    const browser = await chromium.launch({
-        headless: true,
-        // Software WebGL for MapLibre on a machine with no GPU.
-        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
-    });
-    let failed = false;
-    try {
-        for (const [width, height] of [[1440, 900], [390, 844]]) {
-            const { file, text, popupText, errors } = await capture(browser, width, height);
-            console.log(`${width}px: ${file}`);
-            console.log(`  reply: ${text}`);
-            console.log(`  popup: ${popupText}`);
-            if (errors.length) {
-                failed = true;
-                console.error(`  ${errors.length} error(s) in the session:`);
-                errors.forEach((e) => console.error(`    ${e}`));
-            }
-        }
-    } finally {
-        await browser.close();
-    }
-    if (failed) process.exit(1);
-}
-
-main().catch((err) => {
-    console.error(err);
-    process.exit(1);
-});
diff --git a/ops/up.sh b/ops/up.sh
index 622ab42..c687635 100755
--- a/ops/up.sh
+++ b/ops/up.sh
@@ -59,5 +59,5 @@ echo
 ok "Map Studio dev Gateway is running."
 echo "    Gateway:  ${GATEWAY_URL}  (user ${ADMIN_USER}; password in .env)"
 echo "    Session:  ${SESSION_URL}"
-echo "    Logs:     ops/logs.sh        Screenshots: node ops/screenshot.mjs"
+echo "    Logs:     ops/logs.sh        Tests: cd e2e && npm test"
 echo "    Stop:     ops/down.sh        Wipe: ops/down.sh --purge"
diff --git a/web/typescript/MapStudio.tsx b/web/typescript/MapStudio.tsx
index 1655e55..3dfb66a 100644
--- a/web/typescript/MapStudio.tsx
+++ b/web/typescript/MapStudio.tsx
@@ -29,7 +29,7 @@ import {
 import { MESSAGE_EVENT, pointClick, readReply, replyText } from './messages';
 import { PointPopup } from './PointPopup';
 import { AuthorParams, PopupPoint, popupMountPath } from './popupParams';
-import { TEST_LINE, TEST_POINTS } from './testData';
+import { TestData, selectTestData } from './testSet';
 import { drawColor, themeColor } from './theme';
 
 /** Must match MapStudioComponent.COMPONENT_ID on the Java side. */
@@ -54,6 +54,12 @@ export interface MapStudioProps {
         path: string;
         params: AuthorParams;
     };
+    /**
+     * Spike-only (story 7): which fixed test data the map draws, 'tracer' (three
+     * points and a line) or 'scale30' (a seeded 30-pad stand-in for the
+     * template's scale set). Removed in the refactor sweep.
+     */
+    testSet: string;
 }
 
 /** The popup that is open: the clicked point with its map coordinates. */
@@ -129,6 +135,8 @@ const LAYER_POINTS = 'mapstudio-points';
 export class MapStudio extends Component<Props, MapStudioState> {
     state: MapStudioState = { ...DRAW_IDLE, popup: null };
 
+    /** Chosen once from the testSet prop; the map is built from it at mount. */
+    private testData: TestData = selectTestData(this.props.props.testSet);
     private mapContainer: HTMLDivElement | null = null;
     private map: MapLibreMap | null = null;
     private resizeObserver: ResizeObserver | null = null;
@@ -150,6 +158,7 @@ export class MapStudio extends Component<Props, MapStudioState> {
             point: themeColor(root, '--label'),
             pointStroke: themeColor(root, '--containerRoot')
         };
+        const data = this.testData;
         const map = new MapLibreMap({
             container: this.mapContainer,
             style: {
@@ -161,14 +170,14 @@ export class MapStudio extends Component<Props, MapStudioState> {
                     paint: { 'background-color': colors.background }
                 }]
             },
-            center: TEST_LINE.center,
-            zoom: TEST_LINE.zoom,
+            center: data.center,
+            zoom: data.zoom,
             attributionControl: false
         });
         map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
         map.on('load', () => {
-            map.addSource(SOURCE_LINE, { type: 'geojson', data: TEST_LINE.feature });
-            map.addSource(SOURCE_POINTS, { type: 'geojson', data: TEST_POINTS });
+            map.addSource(SOURCE_LINE, { type: 'geojson', data: data.lines });
+            map.addSource(SOURCE_POINTS, { type: 'geojson', data: data.points });
             map.addLayer({
                 id: LAYER_LINE,
                 type: 'line',
@@ -418,7 +427,9 @@ export class MapStudio extends Component<Props, MapStudioState> {
         const replyLine = delegate && delegate.lastReply ? delegate.lastReply : 'Click a point.';
         return (
             <div {...this.props.emit({ classes: ['mapstudio'] })}>
-                <div className="mapstudio-map" ref={this.setMapContainer} />
+                <div className="mapstudio-map" ref={this.setMapContainer}
+                     data-test-set={this.testData.name}
+                     data-feature-count={String(this.testData.featureCount)} />
                 <div className={'mapstudio-reply' + (pending ? ' mapstudio-reply--pending' : '')}
                      data-pending={pending ? 'true' : 'false'}
                      data-drawing={this.state.drawing ? 'true' : 'false'}
@@ -451,6 +462,7 @@ export class MapStudioMeta implements ComponentMeta {
 
     getPropsReducer(tree: PropertyTree): MapStudioProps {
         return {
+            testSet: tree.readString('testSet', 'tracer'),
             popupView: {
                 path: tree.readString('popupView.path', ''),
                 params: tree.readObject<AuthorParams>('popupView.params', {})
diff --git a/web/typescript/__tests__/scaleData.test.ts b/web/typescript/__tests__/scaleData.test.ts
new file mode 100644
index 0000000..ab54f98
--- /dev/null
+++ b/web/typescript/__tests__/scaleData.test.ts
@@ -0,0 +1,43 @@
+import { PAD_COUNT, SCALE_VIEW, buildScaleSet } from '../scaleData';
+
+describe('buildScaleSet', () => {
+    const set = buildScaleSet();
+
+    test('has 30 pads with unique ids and one line each', () => {
+        expect(PAD_COUNT).toBe(30);
+        expect(set.pads.features).toHaveLength(30);
+        expect(set.lines.features).toHaveLength(30);
+        const ids = new Set(set.pads.features.map((f) => f.properties.id));
+        expect(ids.size).toBe(30);
+        expect(set.pads.features[0].properties.id).toBe('pad-01');
+        expect(set.pads.features[29].properties.id).toBe('pad-30');
+    });
+
+    test('is deterministic', () => {
+        expect(JSON.stringify(buildScaleSet())).toBe(JSON.stringify(set));
+    });
+
+    test('every pad is inside the starting 1440 by 860 px view', () => {
+        // Web Mercator at SCALE_VIEW.zoom, the formula MapLibre uses.
+        const scale = 512 * Math.pow(2, SCALE_VIEW.zoom);
+        const proj = ([lng, lat]: number[]): [number, number] => {
+            const rad = (lat * Math.PI) / 180;
+            return [
+                ((lng + 180) / 360) * scale,
+                ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale
+            ];
+        };
+        const [cx, cy] = proj(SCALE_VIEW.center);
+        for (const f of set.pads.features) {
+            const [x, y] = proj(f.geometry.coordinates);
+            expect(Math.abs(x - cx)).toBeLessThan(720);
+            expect(Math.abs(y - cy)).toBeLessThan(430);
+        }
+    });
+
+    test('each line starts at its pad', () => {
+        set.pads.features.forEach((pad, i) => {
+            expect(set.lines.features[i].geometry.coordinates[0]).toEqual(pad.geometry.coordinates);
+        });
+    });
+});
diff --git a/web/typescript/__tests__/testSet.test.ts b/web/typescript/__tests__/testSet.test.ts
new file mode 100644
index 0000000..1b7040b
--- /dev/null
+++ b/web/typescript/__tests__/testSet.test.ts
@@ -0,0 +1,19 @@
+import { selectTestData } from '../testSet';
+
+describe('selectTestData', () => {
+    test('scale30 gives 30 pads and 30 lines', () => {
+        const d = selectTestData('scale30');
+        expect(d.name).toBe('scale30');
+        expect(d.featureCount).toBe(60);
+        expect(d.points.features).toHaveLength(30);
+    });
+
+    test('tracer, empty and unknown values give the tracer data', () => {
+        for (const v of ['tracer', '', 'nope']) {
+            const d = selectTestData(v);
+            expect(d.name).toBe('tracer');
+            expect(d.featureCount).toBe(4);
+            expect(d.points.features).toHaveLength(3);
+        }
+    });
+});
diff --git a/web/typescript/scaleData.ts b/web/typescript/scaleData.ts
new file mode 100644
index 0000000..f1ed5ae
--- /dev/null
+++ b/web/typescript/scaleData.ts
@@ -0,0 +1,90 @@
+import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
+
+/**
+ * The 30-pad scale set (story 7, spike only): a deterministic stand-in for the
+ * template's own 30-pad set, which is not available to this repository. Thirty
+ * pads on a jittered 6 by 5 grid, each joined to its nearest gathering station
+ * (three stations) by a line with one bend. Seeded, so every run draws the same
+ * map. Replaced by the map store in epic-map-store-and-data.
+ */
+
+export type PadProps = { id: string; name: string };
+
+export const PAD_COUNT = 30;
+export const STATIONS: Array<[number, number]> = [
+    [-105.07, 39.7250],
+    [-104.9725, 39.7445],
+    [-104.88, 39.7650]
+];
+
+/** The starting view for the scale set: all 30 pads inside a 1440 by 860 px map. */
+export const SCALE_VIEW: { center: [number, number]; zoom: number } = {
+    center: [-104.9725, 39.7445],
+    zoom: 12
+};
+
+const COLUMNS = 6;
+const ROWS = 5;
+const HALF_WIDTH_DEG = 0.11;
+const HALF_HEIGHT_DEG = 0.05;
+
+/** mulberry32: a small seeded generator, so the set never changes between runs. */
+function seeded(seed: number): () => number {
+    let a = seed >>> 0;
+    return () => {
+        a = (a + 0x6d2b79f5) >>> 0;
+        let t = a;
+        t = Math.imul(t ^ (t >>> 15), t | 1);
+        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
+        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
+    };
+}
+
+function padId(n: number): string {
+    return 'pad-' + (n < 10 ? '0' : '') + n;
+}
+
+/** The 30 pad coordinates and the 30 lines, in id order. */
+export function buildScaleSet(): {
+    pads: FeatureCollection<Point, PadProps>;
+    lines: FeatureCollection<LineString, { id: string }>;
+} {
+    const rand = seeded(30);
+    const cellW = (2 * HALF_WIDTH_DEG) / COLUMNS;
+    const cellH = (2 * HALF_HEIGHT_DEG) / ROWS;
+    const pads: Array<Feature<Point, PadProps>> = [];
+    const lines: Array<Feature<LineString, { id: string }>> = [];
+    for (let i = 0; i < PAD_COUNT; i++) {
+        const col = i % COLUMNS;
+        const row = Math.floor(i / COLUMNS);
+        // Jitter stays inside the middle 60 % of the cell, so pads never touch.
+        const lng = SCALE_VIEW.center[0] - HALF_WIDTH_DEG + (col + 0.2 + 0.6 * rand()) * cellW;
+        const lat = SCALE_VIEW.center[1] - HALF_HEIGHT_DEG + (row + 0.2 + 0.6 * rand()) * cellH;
+        const id = padId(i + 1);
+        pads.push({
+            type: 'Feature',
+            id: i + 1,
+            properties: { id, name: 'Pad ' + (i + 1) },
+            geometry: { type: 'Point', coordinates: [lng, lat] }
+        });
+        let best = STATIONS[0];
+        let bestD = Infinity;
+        for (const s of STATIONS) {
+            const d = (s[0] - lng) * (s[0] - lng) + (s[1] - lat) * (s[1] - lat);
+            if (d < bestD) {
+                bestD = d;
+                best = s;
+            }
+        }
+        const bend: [number, number] = [(lng + best[0]) / 2, lat + (best[1] - lat) * 0.25];
+        lines.push({
+            type: 'Feature',
+            properties: { id: 'line-' + id },
+            geometry: { type: 'LineString', coordinates: [[lng, lat], bend, best] }
+        });
+    }
+    return {
+        pads: { type: 'FeatureCollection', features: pads },
+        lines: { type: 'FeatureCollection', features: lines }
+    };
+}
diff --git a/web/typescript/testSet.ts b/web/typescript/testSet.ts
new file mode 100644
index 0000000..70ccfda
--- /dev/null
+++ b/web/typescript/testSet.ts
@@ -0,0 +1,37 @@
+import type { Feature, FeatureCollection } from 'geojson';
+import { SCALE_VIEW, buildScaleSet } from './scaleData';
+import { TEST_LINE, TEST_POINTS } from './testData';
+
+/** The test data a map draws, chosen from the spike-only `testSet` prop (story 7). */
+export interface TestData {
+    name: 'tracer' | 'scale30';
+    points: FeatureCollection;
+    lines: FeatureCollection | Feature;
+    center: [number, number];
+    zoom: number;
+    /** Points plus lines, written to data-feature-count for the e2e suite. */
+    featureCount: number;
+}
+
+/** 'scale30' gives the 30-pad stand-in; anything else gives the tracer's data. */
+export function selectTestData(testSet: string): TestData {
+    if (testSet === 'scale30') {
+        const set = buildScaleSet();
+        return {
+            name: 'scale30',
+            points: set.pads,
+            lines: set.lines,
+            center: SCALE_VIEW.center,
+            zoom: SCALE_VIEW.zoom,
+            featureCount: set.pads.features.length + set.lines.features.length
+        };
+    }
+    return {
+        name: 'tracer',
+        points: TEST_POINTS,
+        lines: TEST_LINE.feature,
+        center: TEST_LINE.center,
+        zoom: TEST_LINE.zoom,
+        featureCount: TEST_POINTS.features.length + 1
+    };
+}
