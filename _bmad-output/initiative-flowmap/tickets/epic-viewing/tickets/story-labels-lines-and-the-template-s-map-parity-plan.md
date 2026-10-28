---
title: 'Labels, lines and the template''s map parity'
type: 'feature'
ticket: '7'
created: '2026-10-28'
status: 'built'
baseline_revision: '4845a016369549ffd4d37890192268b8e3aede5b'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/handoff-epic-3.md'
  - '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/review-popup-and-marker-info.md'
  - '{project-root}/docs/contract.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Entry 5's marker bakes the icon KPI and the state words into a 160 by 74 px image, so the text never gives way, carries no halo and crowds neighbours ("950 psi", "Stale - No value", "Comms lost" over each other at 390 px); nothing draws the name; lines are one 3 px stroke whatever their size or state; there is no Fit, no Return, no shared marker and no selection (R3, R5; UX review M1 to M5).

**Approach:** Add a glyph source the module bundles and the Gateway serves beside the bundle, shrink the marker image to the disc, kind glyph, ring and badge with digit, and draw the name, the short state chip and the icon KPI as symbol-layer text that collides and gives way by rank. Then the template's `docs/map.md` section 5 list item by item: line weight by pipe size, hue only from alarms with the glyph at the midpoint, dashed for no data or comms lost, thin neutral with no instruments; the flow arrow on the selected line; items within 20 m as one shared marker with a pick list; Fit and Return; a ground tap clears the selection; Fit keeps until the bounds change; and a checklist in `docs/` mapping every item to met or listed for ER-27.

## Decisions (recorded for the owner, 2026-10-28; the session is unattended)

1. **Glyph source.** Noto Sans SemiBold (the name and the KPI, map-label 12/600 and 11/600) and Noto Sans Medium (the state chip, state-word 11/500), the Google Fonts static instances of the Noto Sans variable font, SIL Open Font License 1.1, committed as `web/fonts/*.ttf` with `OFL.txt` and credited in `NOTICE`. `web/scripts/glyphs.mjs` (opentype.js 1.3.4 and pbf 4.0.1, build-time dev dependencies, nothing new in the bundle) renders them at build time into signed distance field glyph PBFs with fontnik's parameters (24 px, 3 px border, radius 8, cutoff 0.25), 256 ranges per font stack (empty ranges as empty stacks, so a range request never 404s), served at `/res/mapstudio/glyphs/{fontstack}/{range}.pbf` like the sprite. No external font CDN. Noto Sans is what the Perspective default theme names, so the labels match the host's text; DESIGN.md's "the font family is the host theme's" holds for every DOM surface and the map text takes the bundled face (a MapLibre text layer cannot read a CSS font).
2. **Zoom bands.** Normal items: the disc with the kind glyph from zoom 14, an 11 px dot from 12 to 14, a 7 px dot below 12 (DESIGN.md map-marker and R3 agree below 12; R3's "small dots" is the 7 px one); every dot sits in a 44 px image so the hit area stays. Abnormal items (alarm, comms lost, stale) keep the full marker at every zoom. The name from zoom 14, the KPI from 15 (D4), the chip with the name.
3. **Ranking.** `symbol-sort-key` = -1 selected, 0 alarm priority 1, 1 priority 2, 2 priority 3, 3 comms lost, 4 stale, then 5 + (99 - labelRank) for normal items (the kind list's `labelRank`, higher keeps its label longer). The marker and badge image layer sits above the text layers with `icon-allow-overlap` and never drops; names, chips and KPIs collide (`text-allow-overlap: false`) and give way. The chip sits right of the name through a per-feature offset from a width estimate of the name (the same estimate the e2e overlap check uses); labels under an open popup stay (entry 8 makes the card opaque, P8).
4. **Lines.** Weight by `diameter` (3 px up to 4 in, 4 px to 8 in, 6 px above; 3 px with none) for a line with at least one instrument attached, else the thin neutral 2 px of DESIGN.md's untapped segment; hue only from the line's own alarm (its kind setup's alarms slot) with the badge and digit at the midpoint; dashed `8 6` when the line is comms lost, stale or has no value; the per-segment look from instruments is entry 2. Pipeline grey is `--neutral-60`.
5. **Selection.** A click on a point or a line selects it (the popup opens for a point as before); the selected marker takes the `selection` ring, the selected line a `selection` casing and the one flow arrow at its midpoint (its three-quarter point when the alarm badge holds the midpoint; `bearing` along the line, drawn as an inline chevron, no new icon). A tap on the ground clears the selection and closes the popup. Return pans to the selected point at the current zoom or fits the selected line; disabled with nothing selected. Fit fits every item's bounds (points and lines, 48 px padding) and keeps: a later change of the items' bounds refits, a user pan or zoom ends it.
6. **Shared marker.** Points within 20 m (a sweep by latitude, as the template's) draw as one marker at the first member's place with the worst state, the name "A and B" or "A, B and C", no KPI, and the first member's glyph; a click opens a pick list (a MapLibre popup with one row per member) and a row does what a click on that marker does. The dev seed gains two pads 15 m apart (`shared/a`, `shared/b`) so the e2e sees it.
7. **The template's departures** (listed for ER-27 in `docs/map-parity.md`): the chip row and top sheets (bottom sheets, entry 8), the kind glyph in the marker (the template shows state only), the Lines and Names toggles and the legend (entry 3), Fit and Return as a control group top-right under the zoom (the template's bottom-right is the reserved corner here).
8. **Not here.** Instruments drawn (entry 2), search (9), the legend with the toggles (3), the popup clean-up (8), the hue tokens' review (12).

## Boundaries & Constraints

**Always:** every colour a theme token read from the component root with a Perspective variable fallback, never a literal (AD-11); the state said with a glyph and a word, never colour alone; nothing new in the bottom-right corner; the marker image id carries no KPI text or word; the glyph files are served by the Gateway from the module, no external font or CDN; no em dashes; contract 0.3.0; Jython 2.7 rules for the seed; `README.md` untouched.

**Never:** instruments drawn or the per-segment look, search, the legend, the Lines and Names toggles, the bottom sheet, the popup's opaque surface, a change to `ign-scada-template`, a `.modl` or scratch project committed, a Gateway write outside the local dev stack.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Marker image id | icon `well-pad`, comms lost, alarm 1 unacknowledged, selected | `ms:marker:["well-pad","comms-lost","alarm-1-unacknowledged",1,true,true]`; no KPI or word in the id | an unknown id is refused by `parseImageId` |
| Dot image id | normal item below zoom 14 | `ms:dot:11` from 12 to 14, `ms:dot:7` below 12; the selected dot carries the ring | none |
| Label properties | name "Pad 12", KPI "412 psi" stale, comms lost | `name` "Pad 12", `word` "Comms lost", `kpi` "412 psi", `kpiStale` true, `rank` 3, `chipOffset` from the name width | none |
| Rank | alarm 2 vs comms lost vs normal labelRank 10 vs normal labelRank 0 | 1, 3, 94, 104 | none |
| Line look | diameter 6, one instrument attached, alarm 2 | weight 4, hue alarm-2, solid, badge at the midpoint | none |
| Line look | no instruments, no setup | weight 2, pipeline grey, solid, no badge | none |
| Line look | comms lost or no value | dashed, pipeline grey (hue only from alarms) | none |
| Shared marker | two pads 15 m apart, one stale | one feature, name "A and B", state stale, `members` 2 | a pad 25 m away is its own marker |
| Fit | 33 pads and 31 lines | the map fits their bounds with 48 px padding; `data-fit` "kept"; a pan clears it; a new item outside the bounds refits | no items: Fit disabled |
| Return | a selected point, the map panned away | the map pans back to the point at the current zoom; with nothing selected the button is disabled | none |
| Ground tap | a selected point with its popup open | selection cleared, popup closed, flow arrow gone, Return disabled | none |

</frozen-after-approval>

## Code Map

- `web/fonts/` (new) -- `NotoSans-SemiBold.ttf`, `NotoSans-Medium.ttf`, `OFL.txt`, `sources.json` (where each came from).
- `web/scripts/glyphs.mjs` (new) -- the SDF glyph PBF build (opentype.js paths, a scanline rasteriser, tiny-sdf's distance transform, the glyphs proto); `--check` round-trips one range; wired into `npm run build` and `npm test` beside `icons.mjs`.
- `web/package.json` -- the two dev dependencies, the scripts.
- `web/typescript/markers.ts` -- `markerSpec` loses `kpi` and `word` and gains `selected`; `MARKER_IMAGE` 64 by 56 with `DISC_CENTER`; dot images; `labelProperties` (name, word, kpi, kpiStale, rank, chipOffset, members); `textWidthEm`; the chip 9-slice image; the arrow image; `lineLook` (weight, hue, dashed).
- `web/typescript/live.ts` -- unchanged; `ItemState` is what the marker and the label read.
- `web/typescript/shared.ts` (new, pure) -- the 20 m sweep: groups of points, the merged name and state.
- `web/typescript/MapStudio.tsx` -- the glyph source in the style (`glyphs`), the layer stack (lines solid and dashed, the line badges, the marker images over the text layers, names, chips, KPIs, the selected casing and arrow), selection state and `data-selected`, Fit and Return (`FitControl`), the shared marker's pick list, the label boxes the e2e reads (`data-labels`), the `/res/mapstudio/glyphs` constant.
- `web/typescript/FitControl.ts` (new) -- an `IControl` like `BasemapControl`: Fit and Return buttons with `aria-label`, `disabled`.
- `web/typescript/PickList.tsx` (new) -- the shared marker's rows.
- `web/typescript/mapstudio.css` -- the control, the pick list, tokens only.
- `common/.../contract/Kind.java` -- `labelRank` already there; the doc comment names the rank order.
- `ops/project/ignition/script-python/mapstudio_seed/code.py` -- the `shared` set (two pads 15 m apart); `seed_harness.py` and `DevSeedTest` counts 64 to 66.
- `e2e/tests/labels.spec.mjs` (new) -- 1440 and 390 px: no label box overlaps another, names from 14, thinning when zooming out, the shared marker's pick list, Fit, Return, the ground tap, the flow arrow; screenshots `mapstudio-labels-1440.png`, `mapstudio-labels-390.png`, `mapstudio-scale-390.png`.
- `docs/map-parity.md` (new) -- the section 5 checklist; `docs/icons.md` (the glyphs served), `docs/contract.md` (served resources), `CHANGELOG.md`, `NOTICE`, `docs/platform-checks.md`.

## Tasks & Acceptance

**Execution:**
- [x] `web/fonts/`, `web/scripts/glyphs.mjs`, `web/package.json`, `NOTICE` -- the glyph source.
- [x] `web/typescript/markers.ts`, `shared.ts`, Jest tests -- the pure parts of the matrix.
- [x] `web/typescript/MapStudio.tsx`, `FitControl.ts`, `PickList.tsx`, `mapstudio.css` -- the layers, selection, Fit and Return, the pick list.
- [x] `ops/` seed, `seed_harness.py`, `DevSeedTest` -- the shared pair.
- [x] `e2e/tests/labels.spec.mjs` and the specs that read the old marker id.
- [x] `docs/map-parity.md`, `docs/icons.md`, `docs/contract.md`, `CHANGELOG.md`, `docs/platform-checks.md`, this plan.

**Acceptance Criteria:**
- Given the dev 30-pad set at 1440 and 390 px, when the map is drawn at zoom 14 and 15, then no label box overlaps another and each name reads over the basemap by its halo.
- Given the map at zoom 15, when the user zooms out to 14 then 12, then fewer names are drawn, none overlap, and at 12 none show.
- Given two pads 15 m apart, when their marker is clicked, then a pick list with both opens and a row opens that pad's popup.
- Given a selected line, then the flow arrow draws on it alone; a ground tap clears it.
- Given Fit pressed, then the view fits the items and a later pan ends it; Return is disabled until something is selected.
- Given the hand-off's checks, then every one passes.

## Implementation Notes

- **Commits on the worktree branch** (`worktree-agent-afb33ca9495267228`, baseline `4845a01`): 98ef65e (the glyph source, `markers.ts` without text, `features.ts`, `shared.ts`, `FitControl`, `PickList`, the layers, selection, Fit and Return, the seed's shared pair, the Jest tests), 8fdeeaa (what the first live runs taught, the e2e suite, the docs), then the closing commit (evidence, screenshots, this plan).
- **The glyph source, as built.** `web/scripts/glyphs.mjs` reads the two TTFs with opentype.js, flattens each glyph's path, rasterises it (exact coverage along a scanline, 4 sub-scanlines) and runs TinySDF's distance transform, then writes fontnik's protobuf with `pbf`; `--check` round-trips the Latin range and compares `web/fonts/advances.json` (the ASCII advances at 24 px, which `markers.ts` estimates label widths from) with the fonts; `--write-advances` rewrites that file. 1.5 s for 6,008 glyphs in 512 files, 2.8 MB uncompressed.
- **What the live runs taught (8fdeeaa):** (1) a glyph with no ink must carry no bitmap field: MapLibre refused the empty one, dropped the whole range and rendered the labels with the browser's font at warning level, so the first run looked right for the wrong reason (the spec now fails on that warning); (2) an icon's collision box is its image's box and a touching text box collides, so the marker image is tight (56 by 46) and the name's top sits 4 px under its bottom edge, the KPI 18 px under the name's top; (3) a 9-slice icon's collision box grows by the image border outside `content`, which kept every chip off the map until the content area became the whole image but one pixel; (4) `setMissingStyleImageResolver` (MapLibre 6.16) replaces `styleimagemissing`, so the images are in place when the symbols are laid out and MapLibre stops warning; (5) MapLibre builds no array from a feature value, so the chip's `text-offset` is a `step` over `chipOffset` with literal pairs every 0.25 em; (6) a KPI slot with no value yet showed "No value" under the name, which the popup already says, so the KPI line needs a live value (`hasValue`); (7) the line's name chip sits under the line (1.4 em) so the flow arrow and the badge keep the midpoint.
- **Decision 2 refined:** `MARKER_IMAGE` 56 by 46 with the disc centre at (20, 23); `NAME_TOP_PX` 27, `KPI_TOP_PX` 45, `CHIP_GAP_PX` 9, `TEXT_PADDING` 1. The popup's offset is 22 px (the disc radius and ring), ahead of entry 8's D3.
- **Not done, by scope:** instruments drawn and the per-segment look (entry 2), search (9), the legend and the Lines and Names toggles (3), the popup's opaque surface and the bottom sheet (8), the hue tokens' review (12). A line with its own kind setup, a real instrument on a dev line and a basemap under the labels were not seen live (`docs/platform-checks.md`).

## Plan Change Log

## Review Triage Log

Review pass 1 (quick lens, read by this agent from the diff of both commits; no subagent tool in this session): 0 high, 2 medium, 2 low, 0 false, 0 maybe-false.

| Finding | Verdict | Route | Evidence |
| --- | --- | --- | --- |
| The first live run drew every label through MapLibre's local TinySDF fallback because the glyph range was refused, and nothing failed: the suite watched only `[MapStudio]` warnings | medium | patch | `labels.spec.mjs` collects the console's glyph and image warnings and fails on one; `glyphs.mjs --check` reads the space glyph back and fails on a bitmap field |
| The chip's `textWidthPx` estimate by character class could be 10 % off a real name, placing the chip over or far from it | medium | patch | the fonts' own advances (`web/fonts/advances.json`) at MapLibre's rounding, checked against the fonts by `--check` |
| `onPopupClosed` clears a point's selection but keeps a line's; a line selected after a point's popup closes keeps its arrow until the ground tap | low (by design) | rejected | the line has no popup; its selection ends on the ground tap or another selection, as the plan says |
| `publishLabels` runs on every `idle` and queries four symbol layers over the viewport | low | rejected | a few hundred features at most; `idle` fires after a move settles, not per frame |

## Design Notes

**Why symbol-layer text and not DOM markers.** DOM markers do not collide, cost one element per item on the 30-pad set and the 300-pad field, and sit above every popup; MapLibre's symbol placement gives collision, ranking and halos for free once a glyph source exists (the one thing the blank style lacked).

**Layer order (bottom to top):** basemap, lines dashed, lines solid, selected casing (under its line), unsaved, KPI text, chips, names, line name chips, line badges, markers (icons placed first, so text never covers a disc), arrow.

## Verification

**Commands:**
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` (with the scratch init script that keeps the node plugin from downloading Node) -- expected: BUILD SUCCESSFUL.
- `cd web && npx tsc --noEmit && npx jest` -- expected: no type error, all tests pass.
- `ops/up.sh --fresh --no-build` with the module staged by hand, then `cd e2e && npm ci && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: every spec passes, `labels.spec.mjs` included.
- `bash scripts/ci/check-contract-versions.sh` and `bash scripts/ci/test-contract-versions.sh` -- expected: OK.
- `grep -rnP '\xE2\x80\x94'` on every changed file -- expected: no match.

**Manual checks:**
- The screenshots in `docs/screenshots/` show names below the discs, the chip beside the name, the KPI under it, and no text over another marker's text.

**Results (2026-10-28, 4-CPU agent box, Ignition 8.3.10, fresh stack):** the final chain 19:41 to 19:54 UTC: `./gradlew clean build --offline` BUILD SUCCESSFUL with every Java and Jest test; `tsc --noEmit` clean and `jest` 23 suites, 195 tests pass; `ops/up.sh --fresh --no-build` up; e2e with `E2E_DOCS=1` 70 passed, 0 failed (11.3 min), `labels.spec.mjs` 7/7; `check-contract-versions.sh` and `test-contract-versions.sh` OK; no em dash in a changed file. The first full run's four failures (item count with shared markers, the 390 test's bounds, the phone popup placed before its content) are fixed in f7999c8. Screenshots refreshed by the docs run; the new ones for this entry are `mapstudio-labels-1440.png`, `mapstudio-labels-390.png`, `mapstudio-shared-1440.png`, `mapstudio-line-selected-1440.png` and `mapstudio-scale-390.png`; other new files the docs run wrote that no doc references were left out.
