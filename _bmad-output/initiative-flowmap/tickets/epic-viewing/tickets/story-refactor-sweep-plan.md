---
title: 'Refactor sweep'
type: 'refactor'
ticket: '11'
created: '2026-10-29'
status: 'built'
baseline_revision: '342590d777734f907282e5645c07cff53b07c43e'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/handoff-epic-3.md'
  - '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/story-refactor-sweep-plan.md'
  - '{project-root}/docs/contract.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Entries 5, 6, 7, 1, 14, 2, 8, 9 and 3 were built in parallel by unattended agents and merged by the coordinator; the merges left duplicated code between the point and line popups (the close button, the comms and KPI rows, four copies of the alarm glyph rule, dead CSS the merge notes name), nine copies of the e2e `send` helper and thirteen of `shot`, a dev page label that names a deleted view, two doc screenshots that do not show what their docs say, a search test that fails on a used stack because other specs leave items, and one deferred cleanup of entry 7 (a shared marker's label lists every member).

**Approach:** Sweep only what is cleanup, the disposition table in Design Notes deciding every candidate (a) to (g) the coordinator named plus what the code reading found; the one visible change is (a), the shared marker's label; everything else keeps behaviour identical, and the hand-off's whole check chain runs green in one final run on a fresh stack.

## Boundaries & Constraints

**Always:** Cleanup only. The only visible change is the shared marker's label (a). Every colour a theme token; no em dashes; no model ids outside the commit trailers; contract stays 0.3.0 with no message type, field, error code, prop or schema added or removed; Jython 2.7 rules in any project script; the e2e suite's assertions keep their meaning (a helper moves, it does not weaken); every deferred-work entry this sweep closes gets a `resolved:` line.

**Never:** Add a feature or a test gate; raise a committed timeout; tighten or loosen a validation rule; edit `tickets.toml`, a ticket file or another story's plan; touch `ign-scada-template`; push, tag or release; change a stored setup, kind setup or seed shape; hand-edit a committed screenshot (the docs run refreshes them).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Shared marker, two members | pads `shared/a`, `shared/b` 15 m apart | the label "shared/a and shared/b" (unchanged; the template's rule for two) | none |
| Shared marker, three members | A, B, C within 20 m | the label "A, B +1 more"; the pick list lists A, B and C | none |
| Shared marker, five members | the suite's script-check pads on one spot | "X, Y +3 more"; the chip offset follows the shorter label; the pick list keeps five rows | none |
| Line popup close | the header's close on the card at 1440 and 390 px | closes the popup as before; 32 px with a mouse, 44 px below 768 px | none |
| Point popup, KPI rows | a kind with three KPIs on, one stale | the same rows, words and `data-` attributes as before | none |
| Search on a used stack | `tags.spec` ran before `search.spec` | "Pad 14" lists Pad 14, Point 2, Line to Pad 14 only (the strays removed first, and `tags.spec` deletes its pads) | none |
| Dark preview shot | `/styles` reloaded in the dark theme | the shot is taken after the map's first idle publish and the sprite, so the canvases are painted | none |
| Phone sheet shot | the sheet open on `/live` at 390 px | the shot shows the alarm block (scrolled into view) | none |

## Decisions (recorded for the owner, 2026-10-29; the session is unattended)

1. **Shared marker label (a):** one or two members read as before ("A", "A and B"); three or more read the first two and the rest counted, "A, B +N more" (the popup's own "+ N more" wording, tightened for a map label), members sorted by name as before; the pick list keeps every member. Closes the deferred-work entry of entry 7.
2. **Line popup close button (f):** takes the point card's `mapstudio-popup-icon` class and `Chrome` glyph, so its own CSS block goes (its hover tint becomes the card's `--neutral-30` in place of `--containerRoot`; the size and place are unchanged, 32 px, 44 px below 768 px). The one cosmetic consequence of removing the duplicate, recorded here.
3. **Scope kept out (g and the rest):** no committed timeout, wait or sign-in rule changes for the suite's run time unless the baseline's per-test durations show a cheap, safe saving (see Design Notes); the unused exported types stay (harmless public shapes), as do exports used only inside their module (churn).

</frozen-after-approval>

## Code Map

Paths: `W` = `web/typescript`, `E` = `e2e/tests`, `V` = `ops/project/com.inductiveautomation.perspective/views`.

- `W/shared.ts:85` -- `sharedName(names)`: "A, B and C" for any count; `W/features.ts:238` the one caller (sorted by name); `W/__tests__/shared.test.ts:37`; `docs/contract.md:157` and `docs/map-parity.md:21` say "A and B"; `CHANGELOG.md` 0.3.0 entry 7 line.
- `W/DefaultPopup.tsx` -- `Glyph`, `Chrome`, `alarmGlyphId`, the comms row and the KPI rows; `W/LinePopup.tsx` -- its own `alarmGlyph`, an inline close SVG, the same comms and KPI rows; `W/markers.ts:267`, `W/needsyou.ts:66`, `W/NeedsYouControl.ts:44` -- the alarm glyph rule again. One `alarmGlyphId(priority, unacked)` in `W/live.ts`; `Glyph`, `Chrome`, `KpiRows` in a new `W/popupParts.tsx`.
- `W/MapStudio.tsx` -- `display.comms || display.alarms.on || display.kpis.some((k) => k.on)` at 2058, 2384, 2431 (`displayShows` in `live.ts`); `onSheetClose` (2121) only calls `closePopup`; `delegate.items.find((i) => i.id === id && !i.deleted)` eight times (`liveItem(id)`).
- `W/mapstudio.css:1605-1634` -- the line popup's `.maplibregl-popup-close-button {display: none}` (dead: `closeButton: false`) and its five tip colour rules (the generic rules at 231-253 already give the same surface); `1694-1712` and `1856-1860` the close button block the shared class replaces.
- `W/placeholders.ts:15` -- `FIXED_PLACEHOLDERS`, never read.
- `E/*.spec.mjs` -- `send` in nine specs, `shot` in thirteen, `view` in four; `E/needsyou.spec.mjs:77` `removeStrays`; `E/fixtures.mjs` is the shared home. `E/tags.spec.mjs:84` creates three "Tag check" pads and leaves them; `E/search.spec.mjs:189` expects three rows for "Pad 14" and `:36` says "no popupView prop".
- `E/styles.spec.mjs:243-248` -- the dark shot right after `data-sprite`; `data-labels-zoom` is written on the map's idle publish (`MapStudio.tsx:1399`). `E/live.spec.mjs:299` -- the 390 shot with the alarm block below the body's fold.
- `V/MapStudioDev/view.json:26` -- "click a point to open the project view Popups/PointDetails as a popup" (the view went with entry 8).
- `_bmad-output/deferred-work.md` -- the shared-marker entry (entry 7) and the `values.batch` stand-in entry, which entry 5 closed in fact (`e2e/lib/valueBatch.mjs` reads the real frame) without a `resolved:` line.

## Tasks & Acceptance

**Execution:**
- [x] Baseline -- the chain on the baseline commit (build, fresh stack, the whole suite with its per-test durations) recorded in Implementation Notes.
- [x] `W/shared.ts`, `shared.test.ts`, `docs/contract.md`, `docs/map-parity.md`, `CHANGELOG.md` -- (a).
- [x] `W/live.ts` (`alarmGlyphId`, `displayShows`), `W/popupParts.tsx` (`Glyph`, `Chrome`, `KpiRows`), `W/DefaultPopup.tsx`, `W/LinePopup.tsx`, `W/markers.ts`, `W/needsyou.ts`, `W/NeedsYouControl.ts`, `W/MapStudio.tsx`, `W/mapstudio.css`, `W/placeholders.ts` -- (f); Jest green with the existing tests.
- [x] `E/fixtures.mjs` (`send`, `shot`, `view`, `removeStrays`), the specs that held copies, `E/tags.spec.mjs` (deletes its pads), `E/search.spec.mjs` (strays removed in `beforeAll`, the stale comment) -- (e).
- [x] `E/styles.spec.mjs` (b), `E/live.spec.mjs` (c).
- [x] `V/MapStudioDev/view.json` -- (d).
- [x] `_bmad-output/deferred-work.md` -- `resolved:` lines; `docs/platform-checks.md` -- "Epic 3 entry 11" section.
- [x] The final chain on a fresh stack; the referenced screenshots committed; this plan's Results.

**Acceptance Criteria:**
- Given three points within 20 m, when the map draws them, then the marker's label reads "A, B +1 more" and its pick list has three rows; given two, "A and B" as before.
- Given the e2e suite on a fresh stack, then every test passes with the same assertions as the baseline, `search.spec.mjs`'s asset test among them after `tags.spec.mjs` ran.
- Given `git diff <baseline> -- common/src/main/resources docs/contract.md`, then no message type, field, error code, prop or schema is added or removed.
- Given `docs/screenshots/mapstudio-styles-preview-dark-1440.png` and `mapstudio-live-390.png` from the docs run, then the first shows the map and every swatch painted and the second shows the sheet's alarm block.
- Given `grep` for em dashes and model ids over the diff, then both find nothing.

## Implementation Notes

- **Commits on the worktree branch** (`worktree-agent-a2568c90fc3808333`, baseline `342590d`): b435f5a (this plan), d19fe28 (the shared marker's label; `popupParts.tsx`, `alarmGlyphId`, `displayShows`, `liveItem`, the CSS and the dead export), 319aacc (the e2e helpers into `fixtures.mjs`, the tag spec's cleanup, the search spec's `beforeAll`, the two shots, the dev label, the deferred-work lines), then the closing commit (the platform checks, the screenshots, this plan).
- **Baseline** (the chain on `342590d`, fresh stack, port 9088, the only stack on the box): `./gradlew clean build --offline` BUILD SUCCESSFUL; Jest 31 suites, 254 tests; e2e 82 passed, 7 skipped, 0 failed in 18.8 min, 14.5 min of it inside the tests (`unsaved.spec` 2.0 min in all; the longest single tests 39.8 s `unsaved`, 37.5 s `adapters`, 36.9 s `needsyou`, 34.4 s `popup`, 29.3 s the frame-rate measure) and about 4 min outside them (the per-test editor sign-in, the global setup).
- **(g) judged and dropped:** the time is spread over 21 specs and sits in waits on the 10 s refresh interval and the deliberate measures; the one saving worth a look is the sign-in process before each of the 40 editor tests, whose cause (`fixtures.mjs`: a sign-in saved once was signed out by the time the suite reached the editor tests) was never established, so it is a harness change, not cleanup. No timeout changed.
- **(a) as built:** `sharedName` keeps "A" and "A and B"; three or more read "A, B +N more" (`SHARED_NAMES_SHOWN` 2); the chip offset follows the shorter label through `textWidthPx` as before; `features.ts` unchanged.
- **(f) as built:** `popupParts.tsx` holds `Glyph`, `Chrome`, `CloseButton` and `KpiRows`; `DefaultPopup`, `LinePopup` and `PointPopup` (the custom view's close row) use them; `live.ts` gains `alarmGlyphId` (used by `markers.ts`, `needsyou.ts`, `NeedsYouControl.ts` and both popups in place of four copies) and `displayShows` (three sites in `MapStudio.tsx`); `MapStudio.tsx` gains `liveItem(id)` for the eight `items.find(... && !i.deleted)` and loses `onSheetClose` (every close goes through `closePopup`); `mapstudio.css` loses the line popup's hidden MapLibre close button rule, its five tip colour rules and its own close button block (the shared `.mapstudio-popup-icon` with `margin-top: -4px`, and `--mapstudio-popup-icon: 44px` under 768 px); `placeholders.ts` loses the unread `FIXED_PLACEHOLDERS`. The comms rows stay in each popup: the line popup's carries the instruments' summary and its own-comms variant, so they are not one component.
- **(e) as built:** `fixtures.mjs` exports `send`, `shot`, `DRAW_MS`, `view(page, map, center, zoom)` and `removeStrays`; seventeen specs lost their copies (`store-ops.spec` keeps its `SHOTS` guard around the shared `shot`; `needsyou.spec`'s `view` took an object and now takes the two arguments); `tags.spec.mjs` deletes its three pads in a `finally`; `search.spec.mjs` removes strays in `beforeAll` through an editor context, as `ensureSeeded` opens one.
- **(b), (c), (d) as built:** `styles.spec` waits for `data-labels-zoom` and a visible preview sample before the dark shot; `live.spec` scrolls the sheet's alarm block into view before the 390 shot; the dev page's label reads "Map Studio: the dev map in View mode. Click a point for its popup, a line for the line popup; editing is on /edit."
- **Deferred-work:** the shared-marker entry (entry 7) resolved here; the `values.batch` stand-in entry (epic 1 story 7), which entry 5 closed in fact, gets its `resolved:` line too.
## Plan Change Log

## Review Triage Log

Review pass 1 (quick lens, read by this agent from the diff against the baseline after the unit tests and before the final chain; no subagent tool in this session): 0 high, 0 medium, 3 low, 0 false.

| Finding | Verdict | Route | Evidence |
| --- | --- | --- | --- |
| The line popup's close button takes the card's hover tint (`--neutral-30` for `--containerRoot`) with the shared class | low (decision 2) | recorded | `mapstudio.css`; the size, place and 44 px phone target are unchanged and `linepopup.spec.mjs` measures them at both widths |
| `tags.spec.mjs` deletes its pads in a `finally`, so a failure inside the resolve checks still cleans up; a failure of the delete itself would now hide the first failure's message | low | rejected | the delete is the same `edits.apply` the test just used to create them; Playwright reports both errors when the `finally` throws |
| `KpiRows` passes `size={16}` to the stale glyph where the line popup passed none (24) | low (no change) | rejected | `.mapstudio-popup-state-glyph` fixes the box at 16 px in `mapstudio.css`, so both drew 16 px before |

## Design Notes

Disposition of every candidate (S = this sweep):

| # | Item | Decision | Why |
|---|---|---|---|
| a | Shared marker label: the first two and "+N more" | S | the deferred-work entry of entry 7; the pick list keeps every member |
| b | The dark preview shot half-painted under load | S (test only) | wait for the map's idle publish before the shot |
| c | `mapstudio-live-390.png` without the alarm block | S (test only) | scroll the block into view before the shot; the dev page keeps its toolbar |
| d | `MapStudioDev` label names `Popups/PointDetails` | S | the view went with entry 8 |
| e | `search.spec` fails after `tags.spec` on a used stack | S | `removeStrays` shared and run before the search tests; `tags.spec` deletes what it made |
| f | Popup duplicates, dead CSS, dead export, stale comment, repeated finds | S | the merges' leftovers; behaviour identical but decision 2's hover tint |
| g | The suite's 20 minutes | judged from the baseline durations (Implementation Notes) | no timeout change; a saving must be cheap and safe |
| h | Unused exported types; exports used only in their module | not in the sweep | harmless shapes; dropping `export` is churn |
| i | The editor sign-in per test (`editorTest`) | not in the sweep | the sign-out cause was never established (fixtures.mjs); a harness change, not cleanup |
| j | The `[not verified]` lists of entries 5 to 3 | unchanged owners | need hardware, a second provider or the owner |

## Verification

**Commands:**
- `./gradlew clean build --offline` (JDK 17, the scratch node init script) -- expected: BUILD SUCCESSFUL.
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean; every suite green.
- `ops/up.sh --fresh --no-build` with the module staged by hand, then `cd e2e && npm ci && E2E_DOCS=1 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: every spec passes.
- `bash scripts/ci/check-contract-versions.sh` and `bash scripts/ci/test-contract-versions.sh` -- expected: OK.
- `grep -rnP '\xE2\x80\x94'` on every changed file -- expected: no match.

**Manual checks:**
- The two refreshed screenshots looked at (the painted dark preview, the sheet's alarm block); a shared marker of three or more members read in the docs run if the suite leaves one.

**Results (2026-10-29, 4-CPU agent box, Ignition 8.3.10, container `ms-05798e55` on port 9088, fresh volumes, the only stack on the box; the whole chain in one run, the second of two):**
- `./gradlew clean build --offline` (JDK 17, the scratch init script, the box's Node 22): BUILD SUCCESSFUL in 45 s with every Java and Jest test.
- `cd web && npx tsc --noEmit && npx jest`: no type error; 31 suites, 254 tests pass (the baseline's counts; `shared.test.ts` carries the two new label cases in its existing test).
- Full e2e on the fresh stack with `E2E_DOCS=1`: 82 passed, 0 failed, 7 skipped (18.1 min; the baseline on `342590d` was 82 passed in 18.8 min). The first full run after the sweep failed 3 tests on one cause (a `path` import pruned from `basemaps.spec.mjs` and `writepath.spec.mjs` with their `shot` copies, f85283a); the chain then ran again from the build on a fresh stack and was green.
- `check-contract-versions.sh`: `OK (contract 0.3.0, setup schema 1, map store schema 2)`; `test-contract-versions.sh`: OK.
- Em dashes: none in any changed file; no model id outside the commit trailers.
- Manual: `mapstudio-styles-preview-dark-1440.png` shows the dark page with the map, the lines, the two tinted fences and every swatch painted; `mapstudio-live-390.png` shows the sheet with the Flow row, the alarm block ("1 alarm - Priority 1, unacknowledged", "High pressure - Pressure, 10 s ago") and View alarms. The screenshots refreshed by the docs run that a doc references are committed with `docs/spike-measures.json` (rewritten by the bundle measure, as earlier entries did); the tracked ones no doc references were restored and the untracked ones deleted.
- Not verified: a shared marker of three or more members drawn live (unit tested; the dev seed's pair has two); the line popup's close hover tint on a real pointer device.

