---
title: "Playwright smoke suite and the spike's measures"
type: 'feature'
ticket: '7'
created: '2026-10-26'
status: done
baseline_revision: '0c6a191c0550beaa9aff02c2610bc16b87ab6541'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
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

- Review pass 1 patches (see the Review Triage Log), 2026-10-26: after them the suite passed three complete times on `ms-s7` (10 of 10 each, 1.8 to 2.1 min; the second with `E2E_DOCS=1`, which rewrote `docs/spike-measures.json` and the screenshots); Jest 32 of 32, `node --test` 9 of 9, `tsc` clean, Gradle build green. The Gateway log again shows no Map Studio warning or error. `docs/platform-checks.md` "Story 7" carries the new numbers: frame rates 7.5 to 13.1 fps for the 30-pad view and 9.8 to 10.8 for the tracer across the two recorded runs, the `.modl` SHA-256 and the new phone probe wording.

## Plan Change Log

## Review Triage Log

Pass 1 (quick lens, 2026-10-26, run context-free by the coordinator from the standalone prompt written beside this plan, against `dca34fc`): high 0, medium 7, low 3, false 0, maybe-false 0. All ten patched; none rejected or deferred. Verified by reading each cited location before patching.

| # | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|
| 1 | Two references to `ops/popup-check.mjs` remain in `_bmad-output/deferred-work.md` | low | patch | Real: lines 3 and 14 named a deleted script. Both now name `e2e/tests/popup.spec.mjs`; the plan's grep now excludes the ticket folder, whose plans name the old scripts by history. |
| 2 | `playwright.config.mjs` says `playwright install` is never run, but CI runs it | low | patch | Real, the comment contradicted the workflow. Now: CI installs Chromium, the cloud box never does. |
| 3 | `data-feature-count` comes from the constructor, so the counts prove nothing | medium | patch | Real: `featureCount` was computed from the input data. Removed. The component now sets `data-map-ready` and `data-points-loaded` and `data-lines-loaded` after MapLibre's first `idle`, counted with `querySourceFeatures`, unique by feature id; the tracer, scale and measures specs assert them (3 points and 1 line; 30 and 30). |
| 4 | Fixed sleeps: 1500 ms first-frame wait and others; no retry policy | medium | patch | Real. `openMap` waits for `data-map-ready`; screenshots wait two animation frames (`nextFrames`); the phone pan and pinch and the touch-draw finish poll their state; the remaining pauses (between two vertex clicks; the "no warning" settle `WARNING_SETTLE_MS`, 500 ms) have no observable state and say so in comments. `retries: 1` in CI only, recorded as `env.retriesConfigured` and `env.attempt`. |
| 5 | `afterAll` overwrote the docs measures after a failure and could throw on an undefined `m.env` | medium | patch | Real. The docs file is written only with `E2E_DOCS=1` and when the last attempt of all four measure tests passed; `e2e/out` always, marked `incomplete` after a failure; `m.env` is guarded; `generatedAt` is left out of the docs copy. |
| 6 | `env` only on some sections; `validateMeasures` did not enforce it | medium | patch | Real. Every section carries `env` (with viewport and attempt); `validateMeasures` enforces label, method and env per section, with a unit test over every section and field. |
| 7 | `frameRate.comparison` states a judgment as a result | medium | patch | Real. Replaced by a neutral `note` that points at `docs/platform-checks.md` for the run-to-run spread. |
| 8 | Frame rate method omits the driver's input load and the unfixed zoom event rate | medium | patch | Real. Pan moves capped at 60 per second and wheel events at 25 per second (a pause after each call), both said in the method with the shared main thread. First attempt with a catch-up schedule made `mouse.wheel` hang for the 300 s timeout once; the schedule no longer makes up missed slots and the wheel keeps a 40 ms pause. |
| 9 | Phone pan and pinch pass on any pixel change | medium | patch | Real. Both probes now read the open popup's tip (anchored to p1): pan needs under -72 px for a 120 px drag (saw -120), pinch needs a distance factor over 1.5 (saw 2.4); the detail says the tip stands in for the map position. |
| 10 | `bundle.modl` is the first `.modl` found in `ops/modules` or `build` | low | patch | Real. Now exactly one `.modl` in `ops/modules` (the folder the Gateway reads), else `unavailable` naming what was found; name and SHA-256 recorded. |

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
- `python3 -c "import yaml,sys;yaml.safe_load(open('.github/workflows/ci.yml'))"` and `git grep -nE 'screenshot\.mjs|popup-check' -- . ':(exclude)_bmad-output/initiative-flowmap/tickets'` -- expected: valid; no hits
- `git grep -I -nE 'BEGIN [A-Z ]*PRIVATE KEY|GATEWAY_ADMIN_PASSWORD=.+'` -- expected: no hits

**Manual checks (if no CLI):**
- Owner reads the screenshots and `docs/spike-measures.json` labels; the CI run, once Actions works.
