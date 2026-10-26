---
title: "Playwright smoke suite and the spike's measures"
type: 'feature'
ticket: '7'
created: '2026-10-26'
status: 'draft'
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

## Open Questions

1. **The 30-pad scale set.** The template checkout has 6 Mesa pads and no PV-29 harness. (a) Synthetic seeded 30 pads (default; labelled stand-in). (b) You point to the real set; its pads and routes replace the generator and the label becomes `measured`.
2. **Phone probe failures.** (a) Record only (default; the suite stays green, findings feed story 9). (b) Fail the suite on a probe, so the phone must be fixed before merge, which later stories (bottom sheet, 44 px) would need anyway.
3. **Frame rate for NFR-1.** CI and the cloud box only give software WebGL. (a) Record that and mark NFR-1 unverified for story 9 (default). (b) You run `E2E_HEADED=1` once on a laptop and its result joins the file.
4. **How the 30 pads reach the component.** (a) Spike-only `testSet` prop in the closed schema (default; precedent `popupView`; removed in the sweep). (b) URL parameter read by the bundle (no schema change, but a hidden switch in shipped code).
5. **When the CI job runs.** (a) Every push and pull request, after `build` (default; about 8 to 12 minutes more plus the 8.3.10 image pull, **[unverified]** timings). (b) Pull requests to `main` and manual runs only.
