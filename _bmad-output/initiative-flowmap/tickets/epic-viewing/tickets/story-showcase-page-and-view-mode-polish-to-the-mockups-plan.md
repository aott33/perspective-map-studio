---
title: 'Showcase page and View mode polish to the mockups'
type: 'story'
ticket: '15'
created: '2026-10-29'
status: 'built'
baseline_revision: '785e8d0207695dc6a51d83e1a779931d2d57b1f5'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/handoff-epic-3.md'
  - '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md'
  - '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/review-showcase-vs-mockups.md'
  - '{project-root}/docs/contract.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The owner looked at the merged renders of entries 5 to 11 and found the UX mockups far better (2026-10-29). Part of that is the dev pages (test buttons, readouts, no basemap, zoomed out, test names such as "Point 1" and "Pad 16"); part is real polish: the panels did not lift off the map, the alarm badge was a red disc, the geofence a grey wash, the laterals the pipeline grey, the spike's status line across every page.

**Approach:** First a showcase page nobody has to squint past: a second bind-mounted project, `mapstudio-showcase`, one page with the component alone, seeded through the existing seed path with the mockups' Mesa field (names, kinds, places at zoom 15, states and values) from the dev project's `/edit` page. Then a committed browser check that renders the same five views as the mockups, a UX comparison of each render against its mockup with DESIGN.md as the authority (a punch list with the code for each difference), the polish built with theme tokens only and no behaviour change, and side-by-side images for the owner's acceptance (the hitl step, recorded later in the epic's Notes).

## Boundaries & Constraints

**Always:** Theme tokens only, never a colour literal; behaviour unchanged (no feature; anything that is not polish is a backlog row in the punch list); Jython 2.7 rules in every project script (no `import system`, java.lang.Throwable and Exception caught); the seed safe to re-run; the showcase page with no test control or readout; the e2e suite's existing assertions keep their meaning; no em dashes; no model ids outside the commit trailers; contract 0.3.0 unchanged (no message type, field, error code, prop or schema added or removed).

**Never:** External tiles in the renders; a `.modl`, token or password in git; a committed timeout raised; DESIGN.md edited (a difference between DESIGN.md and a mockup is recorded, DESIGN.md wins unless an owner decision says otherwise); the README's mockups replaced before the owner accepts the renders; `ign-scada-template` touched; a push, tag or release.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| The showcase page | `/` of `mapstudio-showcase` at 1440 x 900, after the seed | the component alone fills the view at zoom 15; P14 in a priority 1 unacknowledged alarm, P21 comms lost, SWD1 stale, "Needs you 3: 1 alarm, 1 comms lost, 1 stale" | none |
| The seed, run twice | the dev `/edit` page's "Seed the dev map" (its `showcase` result) | the second run writes no item (unchanged) and sets the 28 demo tags again, the alarm raised afresh | a refusal names the code first; a tag write failure is in `tags.error` |
| A used stack | an editor moved P14 and acknowledged the alarm | the seed puts P14 back and re-raises the alarm (below the setpoint, then above) | none |
| A Gateway restart | memory tags keep their values; SWD1's Bad quality does not | SWD1 reads normal until the seed runs again (documented) | none |
| An area with no tint | the Mesa lease geofence | a dashed outline in the lateral tone, no fill; a tinted area (the dev map's North and South) unchanged | none |
| The status line in View mode | a page with `editMode` off and nothing to report | the line is in the DOM, hidden; a save status, a failed load, a read-only store or unsaved edits show it | none |
| The popup opens | a click on P14 | the card takes the focus; no button wears a ring; Tab reaches the page link and close | none |
| The dark theme | the `/styles` page reloaded dark | the panels on `--neutral-10` over a `--neutral-20` map, the same depth the other way round | none |

## Decisions (recorded for the owner, 2026-10-29; the session is unattended)

1. **A second project, not a second map.** One project holds one map and the Needs you summary counts the whole map, so the showcase is its own bind-mounted project `mapstudio-showcase` (`ops/showcase/project`, mounted by `ops/docker-compose.yml`), with its own kind and asset adapter (`mapstudio_showcase`) and its own tags (`ops/config/core`, the `Showcase` folder). The seed lives in the dev project (`mapstudio_showcase_seed`, calling `mapstudio_seed.run` with its own items and kind setups) and runs from the dev `/edit` page's existing Seed the dev map button (its result under `showcase`), so the showcase page itself has no control and the dev page's toolbar keeps its height (a third toolbar row at 390 px put the "Draw a line" button under a spec's vertex click).
2. **Basemap None in the renders.** No external tiles reach the renders; a committed raster stub could only repeat one tile, so the blank background stands in and the Legend panel offers OpenStreetMap for a live look. Recorded in the punch list (item 10).
3. **Places over distances.** The field is laid out at the mockups' pixel places at zoom 15, so the renders frame as the mockups do; the mockups' "2.9 km" was not drawn to scale, so L-SWD is about 0.45 km and the line popup says so.
4. **The surfaces as DESIGN.md names them.** Every floating control, card, chip and marker disc on `--neutral-10` (surface-panel) and the blank map, the halos and the component behind the panels on `--neutral-20` (basemap-blank): Perspective's `--containerRoot` and `--container`, which the code had the other way round. The largest single change in the renders' look.
5. **The badge is the glyph.** An alarm badge is the priority glyph itself in its token on a halo disc, 18 px, solid or hollow by the glyph; the comms-lost and stale badges likewise; never a disc of its own (a circle round the priority 1 triangle read as priority 2). An alarm presentation change: entry 12's ER-27 review.
6. **The click echo is Edit mode's.** The spike's status line shows in View mode only when it has a status (a save status, a failed load, a read-only store, unsaved edits); the `point.click` echo shows in Edit mode, as the line tool does since entry 14. The line stays in the DOM for every spec that reads it.
7. **The mockup's extras that DESIGN.md or an owner decision overrule stay as built:** the KPI line under names from zoom 15 (D4), the 320 px card (D1), the comms-lost token (owner, 2026-10-28), the zoom card's Return (entry 14), L-GL21 thin with no instrument (map-line), the legend's sections (R14).

</frozen-after-approval>

## Code Map

Paths: `W` = `web/typescript`, `E` = `e2e/tests`, `O` = `ops`.

- `O/showcase/project/` -- the project: `project.json`, the Map Studio setup (`mapstudio_showcase.kinds` and `.assets`, connection MapStudio, basemaps none and osm, alarm page `/alarms/{asset.id}`), the page config (`/` Showcase, `/alarms/:item`, `/site/:name`), the views `Showcase` (the component alone, starting area -104.93, 39.70 at zoom 15), `ShowcaseAlarms`, `ShowcaseSite`, the library `mapstudio_showcase` (KINDS, ASSETS, PREFIX `[default]Showcase/`).
- `O/config/core/ignition/tag-definition/default/Showcase/` -- the demo tags: P14 (Comms, CasingPressure, TubingPressure, GasRate, the alarm tag `P14-2H` with "Casing pressure high" above 1000, High, manual ack), P12, P21, CTB1, CS01, SWD1, PT1, PT2, LV1, Lines/LSWD.
- `O/project/ignition/script-python/mapstudio_showcase_seed/code.py` -- the items (SITES, SWD_LINE, SWD_INSTRUMENTS, GL21_LINE, LATERALS, GEOFENCE), the kind setups, TAG_VALUES, `set_states()` (the alarm raised afresh, SWD1's injection rate at Bad quality), `run()`; `mapstudio_seed.run()` gains `seed` and `kind_setups`; the dev `/edit` view's Seed the dev map script calls it after the dev seed.
- `O/docker-compose.yml` -- the mount; `.gitignore` -- the Designer write-back noise of the new project.
- `E/showcase.spec.mjs` -- the seed in `beforeAll` (`runSeed`, its `showcase` result), four tests, five shots; `E/fixtures.mjs` -- `openMap(page, path, project)`, the status line waited for attached.
- `scripts/showcase-compare.mjs` -- the side-by-sides from an HTML page (Playwright from `e2e/node_modules`).
- `W/mapstudio.css` -- `--mapstudio-surface`, `--mapstudio-blank`; the quiet status line; the legend panel's height; the scale bar; the popup disc ring; the comms row; the Needs you counts; the lateral token class; the legend badge rules removed.
- `W/markers.ts` -- `MARKER_TOKENS` disc and halo; `badgeAt` (`BADGE_GLYPH_SIZE`, `BADGE_HALO_RADIUS`); the site ring in `chipEdge`; `lineProperties` (untapped in `chipEdge`); `areaProperties` (untinted in `chipEdge`); `AREA_DASH`.
- `W/MapStudio.tsx` -- the untinted area's fill at 0 and its dashed outline layer; the blank-map token for the draw tool; `focusAfterOpen: false` and the card root's focus; the `quiet` class.
- `W/LegendControl.ts`, `W/legend.ts` -- the States rows as bare glyphs; the thin line and geofence samples in the lateral token.
- `W/DefaultPopup.tsx`, `W/LinePopup.tsx` -- the check before an OK comms word; the line popup's "No active alarms" check.
- `W/__tests__/features.test.ts`, `markers.test.ts` -- the lateral tone and the bare badge.
- `docs/development.md` (the showcase project), `docs/basemaps.md`, `docs/contract.md`, `docs/map-parity.md`, `docs/styles.md`, `docs/platform-checks.md`, `CHANGELOG.md`.
- `_bmad-output/initiative-flowmap/ux-map-studio/review-showcase-vs-mockups.md` -- the punch list; `docs/screenshots/showcase-*.png` and `showcase-compare-*.png`.

## Tasks & Acceptance

**Execution:**
- [x] The showcase project, its tags, adapter, seed and the dev page's button; the compose mount.
- [x] `showcase.spec.mjs`: the seed, the five renders, no dev control on the page.
- [x] The punch list: 42 differences, each with the code and a status.
- [x] The fixes (17), theme tokens only; Jest and tsc green; the specs that read the status line kept.
- [x] The side-by-sides (`scripts/showcase-compare.mjs`) committed.
- [x] The docs (development, basemaps, contract, map-parity, styles), the CHANGELOG, the platform checks.
- [x] The whole chain green in one final run on a fresh stack; this plan's Results.

**Acceptance Criteria:**
- Given the showcase page at 1440 and 390 px, when the seed has run, then the five views render with no dev control or readout, P14 in alarm, P21 comms lost and SWD1 stale.
- Given the punch list, then every difference found is fixed or recorded with a reason, and the side-by-side images are committed.
- Given the full suite on a fresh stack, then every test passes; `./gradlew clean build`, tsc, Jest and the contract checks pass.
- Given `git diff` against the baseline over `common/src/main/resources` and the contract's version lines, then no message type, field, error code, prop or schema changed.

## Implementation Notes

- **Commits on the worktree branch** (`worktree-agent-a4daf9cf3422346ef`, baseline `785e8d0`): the showcase project, tags and seed; the renders spec; the first polish pass (surfaces, badges, lateral tone, geofence outline, legend height, scale bar, quiet status line); the second (the card takes the focus, the check on an OK comms row, L-SWD linked for its alarms row, the compare script); the third (the comms row's wrap, the line popup's check, the spec waits for placed labels); then the closing commit (the plan, the punch list, the renders, the side-by-sides, the docs, the platform checks).
- **Three render rounds:** round 1 found PT-2 and SWD1 merged into one shared marker (the seed moved PT-2 to 395 m) and the legend panel under its button; round 2 found the line popup's comms row wrapping once the check glyph joined it (the label no longer shrinks, the value no longer wraps its glyph away from the word) and the line popup without its "No active alarms" check; round 3 found a view-mode shot taken before MapLibre had placed the KPI labels of the markers the batch changed (the spec now polls `data-labels` for the names and KPIs it expects).
- **Results:** see docs/platform-checks.md, "Epic 3 entry 15", for the final chain's numbers.

## Plan Change Log

## Review Triage Log

Review pass 1 (quick lens, read by this agent from the diff against the baseline before the final chain; no subagent tool in this session): 0 high, 1 medium, 2 low, 0 false.

| Finding | Verdict | Route | Evidence |
| --- | --- | --- | --- |
| The badge halo disc (`BADGE_HALO_RADIUS` 10) in the blank-map token is invisible on the blank basemap and a light disc on satellite imagery; the mockup's halo is thinner | low | recorded (punch list item 14) | DESIGN.md: markers lift with a halo in basemap-blank; the width is a judgement for ER-27 |
| `focusAfterOpen: false` with the card root focused: a screen reader lands on the card, not its first button | medium | accepted | the card is the region; Tab reaches the link and close in order; the sheet never auto-focused and keeps its behaviour |
| The status line hidden by `display: none` in View mode: a spec that waits for it visible would hang | low | fixed | `openMap` waits for it attached; the four specs that read it use `toContainText` or attributes |

## Design Notes

The punch list is `_bmad-output/initiative-flowmap/ux-map-studio/review-showcase-vs-mockups.md`: 42 differences, 17 fixed, 19 recorded with the authority that settles them, 6 backlog rows (number formatting by locale, the legend's Styles section with an instruments-only rule, a kind setup's subline field, the Needs you row naming the alarm, retiring the spike's click echo, one label rank across the text layers).
