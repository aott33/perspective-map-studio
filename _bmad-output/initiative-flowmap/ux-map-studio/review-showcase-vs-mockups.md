# Review: the showcase renders against the mockups (epic 3 entry 15, 2026-10-29)

Reviewer: Sally (UX), unattended. DESIGN.md is the authority; where DESIGN.md and a mockup disagree the item says which wins and why, and DESIGN.md wins unless an owner decision in `epic-viewing.md` says otherwise. Read only on DESIGN.md (no edit).

Sources: the five showcase renders (`docs/screenshots/showcase-*.png`, from `e2e/tests/showcase.spec.mjs` on the dev stack, `E2E_DOCS=1`) and their mockups (`mockups/view-mode-1440.png`, `view-mode-needs-you-1440.png`, `key-screen-1-view-desktop-popup.png`, `key-screen-3-line-instruments-live.png`, `key-screen-2-phone-sheet.png`), looked at side by side in the composites `docs/screenshots/showcase-compare-*.png` (`scripts/showcase-compare.mjs`); DESIGN.md `colors`, `typography`, `rounded`, `spacing`, `components` (`map-marker`, `instrument-marker`, `alarm-glyph`, `map-line`, `state-word-chip`, `popup-card`, `line-popup`, `bottom-sheet`, `needs-you-bar`, `legend`, `zoom-control`, `search-field`); the owner's decisions of 2026-10-28 (D1 to D5, the comms-lost token, the zoom card with Return); `web/typescript/mapstudio.css`, `markers.ts`, `features.ts`, `MapStudio.tsx`, `LegendControl.ts`, `NeedsYouControl.ts`, `DefaultPopup.tsx`, `LinePopup.tsx`; the seed `ops/project/ignition/script-python/mapstudio_showcase_seed`.

The showcase page itself: the `mapstudio-showcase` project (`ops/showcase/project`), the component alone at zoom 15 on the mockups' Mesa field, seeded by the dev `/edit` page's Seed the dev map (P14 in a priority 1 unacknowledged alarm "Casing pressure high - P14-2H" with 1,240 psi, 410 psi and 1.8 MMcf/d; P21 comms lost; SWD1 stale; CTB1, CS01, P12; L-SWD with PT-1, LV-1 and PT-2; L-GL21; the P14 and P12 laterals; the Mesa lease geofence), Basemap None. The places are the mockups' pixel places at zoom 15, so the renders frame as the mockups do; the mockups' distances ("2.9 km") were not drawn to scale and follow the geometry here (0.45 km).

## Summary

| | Count |
| --- | --- |
| Differences found | 42 |
| Fixed in this entry (theme tokens only, behaviour unchanged) | 17 |
| Recorded: DESIGN.md or an owner decision wins over the mockup | 13 |
| Recorded: data of the demo field, host chrome or the host theme, not Map Studio's look | 6 |
| Backlog: not polish (a feature, a format, or a review item), listed at the end | 6 |

Two of the fixes change alarm presentation on the map (items 3 and 4) and go to entry 12's engineering review (ER-27) with the hue tokens, as every alarm presentation change does.

## The punch list

Status: **fixed** (built here, the code named), **recorded** (left as it is, the reason named), **backlog** (not polish; a row in the backlog list below).

### A. Surfaces and depth

| # | Difference | Authority | Code | Status |
| --- | --- | --- | --- | --- |
| 1 | Every floating control, card, chip and marker disc sat on `--container` and the blank map on `--containerRoot`. In Perspective's light theme `--container` (depth 1, `#F4F4F4`) is darker than `--containerRoot` (`#FAFAFA`), so the panels sank into the map instead of lifting off it; the mockups' white panels on a light grey map are the opposite. DESIGN.md: `surface-panel` is `--neutral-10`, `basemap-blank` is `--neutral-20` (Perspective's `--containerRoot` and `--container`). | DESIGN.md (the mockups agree) | `mapstudio.css`: `--mapstudio-surface: var(--neutral-10)` and `--mapstudio-blank: var(--neutral-20)` on `.mapstudio`, every `var(--container)` and `var(--containerRoot)` replaced; `markers.ts` `MARKER_TOKENS.disc` and `.halo`; `MapStudio.tsx` the map background and the draw tool's outline; `docs/basemaps.md` | fixed |
| 2 | A site's disc ring was `--neutral-60` (the pipeline grey); DESIGN.md `map-marker.disc-border` is 1.5 px `line-lateral` (`--neutral-50`); an instrument's ring stays `line-pipeline`. | DESIGN.md | `markers.ts` `markerSvg` (the normal ring by `spec.instrument`); `docs/styles.md` | fixed |

### B. State glyphs

| # | Difference | Authority | Code | Status |
| --- | --- | --- | --- | --- |
| 3 | The alarm badge was a filled disc in the priority hue with the glyph cut out of it in white, so a priority 1 alarm read as a red circle; the mockup and DESIGN.md `alarm-glyph` draw the glyph itself (the triangle) in the hue, 18 px, with the digit beside it, and reserve the circle for priority 2. | DESIGN.md (the mockup agrees) | `markers.ts` `badgeAt`: the glyph at `BADGE_GLYPH_SIZE` (18) in its token on a halo disc (`BADGE_HALO_RADIUS` 10, the blank-map token), solid or hollow by the glyph the state names; `docs/contract.md`, `docs/map-parity.md`. **ER-27**: alarm presentation | fixed |
| 4 | The comms-lost and stale badges sat in a ringed disc; the mockup shows the bare glyph at the top-right of the disc. The legend's States rows drew the same discs and rings. | mockup (DESIGN.md: "state glyph at the top-right", no disc named) | `markers.ts` `badgeAt` (the same halo and glyph); `LegendControl.ts` States rows (the glyph through `<use>`, 18 px, no circle); the legend badge CSS removed. **ER-27** with item 3 | fixed |
| 5 | P21's dashed ring, glyph and badge are in the comms-lost token (magenta or purple); the mockup draws comms lost grey. | Owner, 2026-10-28: comms lost takes its own token `comms-lost`, never an alarm hue, always with the glyph and the words; DESIGN.md's "comms lost and stale have no colour" is superseded. Goes to ER-27 (entry 12). | none | recorded |

### C. Lines and areas

| # | Difference | Authority | Code | Status |
| --- | --- | --- | --- | --- |
| 6 | The laterals (no instrument, 2 px) drew in the pipeline grey (`--neutral-60`); DESIGN.md `map-line.lateral` is `line-lateral` (`--neutral-50`), and the mockup's laterals are lighter than L-SWD. | DESIGN.md | `markers.ts` `lineProperties`: an untapped line takes `chipEdge` (`--neutral-50`); `legend.ts` and `LegendControl.ts`: the "Thin: no instruments" row and the geofence sample in the `lateral` token class; `mapstudio.css` `.mapstudio-legend-token--lateral`; `docs/contract.md`, `docs/styles.md` | fixed |
| 7 | The geofence with no category tint drew a grey fill at 22 % with a solid outline; the mockup and DESIGN.md (`area-tint` for area categories only; `line-lateral` for the geofence outline; the legend's dashed box) give a dashed outline and no fill. | DESIGN.md (the mockup agrees) | `MapStudio.tsx`: `fill-opacity` 0 for an untinted area, the untinted outline in a dashed layer (`AREA_DASH`, `markers.ts`), tinted areas unchanged; `markers.ts` `areaProperties` colour; `docs/contract.md` | fixed |
| 8 | L-GL21 is drawn 4 px in the mockup; it has no instrument, so DESIGN.md `map-line` draws it as the 2 px untapped line. | DESIGN.md | none | recorded |
| 9 | The laterals carry name chips ("P12 lateral") at zoom 15; the mockup has no lateral label at 15 and plain text at 16. DESIGN.md: a line's name sits in a small chip at the midpoint. | DESIGN.md | none | recorded |
| 10 | The mockup's map has faint roads and road names (a light vector basemap); the render is Basemap None, the theme's blank background. No external tiles reach the renders; a committed raster stub could only repeat one tile. The Legend panel offers OpenStreetMap for a live look. | decision (entry 15): None in the renders | none | recorded |

### D. Markers and their labels

| # | Difference | Authority | Code | Status |
| --- | --- | --- | --- | --- |
| 11 | Every marker shows its icon KPI under the name ("1240 psi") at zoom 15; the mockup shows names only. | Owner, 2026-10-28, D4: the KPI line from zoom 15 | none | recorded |
| 12 | PT-2 and SWD1 drew as one shared marker "PT-2 and SWD1" (the first seed put PT-2 16 m from SWD1, inside the 20 m shared distance); the mockup shows both. | the seed | `mapstudio_showcase_seed`: PT-2 at 395 m along L-SWD, 59 m from SWD1 | fixed |
| 13 | Values read "1240 psi" where the mockup reads "1,240 psi": `valueText` writes a number with no thousands separator. The separator depends on the session's locale (a fixed comma is wrong for most of the world), so this is number formatting by locale, a feature. | backlog | `live.ts` `valueText` | backlog |
| 14 | The marker glyph strokes are a little heavier than the mockup's and the halo disc behind the badge is wider than the mockup's thin halo; both are the icon set and the halo token as DESIGN.md names them. | DESIGN.md | none | recorded |

### E. Needs you and the legend

| # | Difference | Authority | Code | Status |
| --- | --- | --- | --- | --- |
| 15 | The counts read "1  alarm" with a double space: a 4 px flex gap on top of the word's own leading space (kept so the bar's text reads "1 alarm"). | DESIGN.md `needs-you-bar` ("triangle 1 alarm") | `mapstudio.css` `.mapstudio-needs-count`: no gap, the glyph carries a 4 px margin | fixed |
| 16 | An alarm row's detail reads "1 alarm - 10 s ago"; the mockup names the alarm ("Casing pressure high - 4 min"). DESIGN.md says "the state in words, detail and age"; the count tells several alarms apart and the alarm's name is one click away in the popup. | DESIGN.md (wording kept) | none | recorded |
| 17 | The mockup's legend is one flat list under "LEGEND"; the render's has sections (Kinds, States, Lines, Styles, Show) with `section-label` headings, every glyph and line look the map draws (R14, entry 3, `docs/contract.md`). The built design is richer than the mockup and DESIGN.md's `legend` names the same content. | DESIGN.md and R14 | none | recorded |
| 18 | The legend panel ran under the Legend button at 900 px (its max height was the map less 100 px, measured from the top). | DESIGN.md (floating controls 12 px from the edge, nothing under another) | `mapstudio.css` `.mapstudio-legend-panel`: max-height from the map less the button, its two insets and the gap | fixed |
| 19 | The Styles section (Attention, Warning, Fault, Out of service) shows on the showcase although no kind there draws a preset: the pipeline's instruments rule counts as a style rule. Hiding Styles when the only rule is an instruments source is a rule change in the legend's key. | backlog | `legend.ts` `legendKey` | backlog |

### F. The popup card

| # | Difference | Authority | Code | Status |
| --- | --- | --- | --- | --- |
| 20 | The page link icon (and the line popup's close) wore a focus ring on every open: MapLibre's popup focuses its first button when it opens and Chromium shows `:focus-visible` for a script focus. The mockup shows plain icons. | mockup (DESIGN.md: a ring only marks the keyboard's place) | `MapStudio.tsx` `makePopup`: `focusAfterOpen: false`, the card root (`tabindex -1`) takes the focus in `showPopupAt`, so Tab still reaches the link and close; `mapstudio.css` `.mapstudio-popup-root:focus` no outline | fixed |
| 21 | The header's kind disc was a filled `--neutral-20` disc; the mockup's is the panel surface with a thin ring. DESIGN.md says "kind glyph in a disc" and no more. | mockup | `mapstudio.css` `.mapstudio-popup-disc`: the surface with a 1 px `--neutral-40` ring | fixed |
| 22 | The comms row reads "OK - 12 s ago" without the mockup's check glyph before OK (the line popup's too). DESIGN.md names the check for "No active alarms" only. | mockup | `DefaultPopup.tsx`, `LinePopup.tsx`: the `check` chrome glyph before an OK comms word (the comms-lost glyph stays for a lost one) | fixed |
| 23 | The subline reads "Well pad"; the mockup reads "Well pad - P14-2H", the kind and the pad's wells. A kind field in the subline needs a setup choice of which field; a feature. | backlog | `DefaultPopup.tsx` header | backlog |
| 24 | The card is 320 px wide; the mockup's is 290. | Owner, 2026-10-28, D1: 320 | none | recorded |
| 25 | "View alarms" is the host's `--callToAction` (`#0C7BB3` in the dev stack's theme); the mockup's blue is a stand-in. | DESIGN.md: `selection` is `--callToAction` | none | recorded |
| 26 | The alarm's age ("16 s ago" against "4 min ago") and the comms age are the seed's moment. | data | none | recorded |

### G. The line popup

| # | Difference | Authority | Code | Status |
| --- | --- | --- | --- | --- |
| 27 | The subline reads "Pipeline - 6 in, 0.5 km"; the mockup's "Pipeline - Produced water, 6 in, 2.9 km". The product is the same kind-field-in-the-subline feature as item 23; the length is the showcase geometry (item 10's note: the places follow the picture at zoom 15). | backlog (the product); data (the length) | `linePopup.ts` `lineSubline` | backlog |
| 28 | The card ended at the instruments; the mockup ends in "No active alarms". The pipeline kind setup had no alarms path. | the seed | `mapstudio_showcase_seed`: the pipeline setup's `alarms` on `{asset.path}`, L-SWD linked to the asset `LSWD` (`mapstudio_showcase`, the tag folder `Showcase/Lines/LSWD`) | fixed |
| 29 | "Comms OK - 3 instruments" against the mockup's 4: LV-1 has no icon KPI, so it has no value to be fresh and is not counted. | data | none | recorded |
| 30 | The close button's focus ring on open: item 20. | | | fixed |

### H. The zoom card, the scale bar and the status line

| # | Difference | Authority | Code | Status |
| --- | --- | --- | --- | --- |
| 31 | The zoom card has five buttons (plus, the level, minus, Fit, Return); the mockup's four. | Owner, 2026-10-28, entry 14: Return in the card | none | recorded |
| 32 | The scale bar was a boxed "100 m" with 2 px sides on a translucent fill; the mockup's is small secondary text over a thin rule with end ticks. | mockup (DESIGN.md names no scale bar) | `mapstudio.css` `.maplibregl-ctrl-scale`: 1 px `--neutral-70` rule and ticks, 11 px `--label--disabled`, no fill | fixed |
| 33 | The spike's status line ("Click a point.", "Gateway received click on ...") sat across the bottom of every View-mode page; neither the mockup nor DESIGN.md has it. It also carries real statuses (a save status, a failed load, a read-only store, unsaved edits), which stay. | decision for the owner (entry 15): the click echo is Edit mode's, as the line tool is since entry 14 | `MapStudio.tsx` render: `mapstudio-reply--quiet` in View mode when the line has no status; `mapstudio.css`; `e2e/tests/fixtures.mjs` `openMap` waits for the line attached, not visible; `docs/development.md` | fixed |

### I. The phone

| # | Difference | Authority | Code | Status |
| --- | --- | --- | --- | --- |
| 34 | The sheet's footer has "View alarms" alone; the mockup adds "Edit". | epic-editing (`canEdit` is off until it) | none | recorded |
| 35 | The sheet, the handle, the 44 px icons, the top bar with "Needs you 3" and the three glyphs, the zoom card under it: as the mockup, but for items 11 and 31. | | | recorded |

### J. Host chrome and type

| # | Difference | Authority | Code | Status |
| --- | --- | --- | --- | --- |
| 36 | The mockup has a page header ("Fields / Mesa / Map", "Jordan - map editor") and an "Edit map" switch top-right; the showcase page is the component alone, and the switch is epic-editing's. | the entry (the component alone) and epic-editing | none | recorded |
| 37 | The mockup is set in Inter; the render in the host theme's Noto Sans. | DESIGN.md: the font family is the host theme's | none | recorded |
| 38 | The mockup's map is `#EEF0F2`; the render's blank map is the theme's `--neutral-20` (`#F4F4F4`). | DESIGN.md: tokens only | none | recorded |

### K. Seen again after the fixes

| # | Check | Status |
| --- | --- | --- |
| 39 | The dark theme after item 1: the panels are `--neutral-10` (`#161616`) on a `--neutral-20` (`#323232`) map, the same depth the other way round; the docs run's `mapstudio-styles-preview-dark-1440.png` shows it. | checked in the final run |
| 40 | Every e2e spec that read the status line (`search`, `needsyou`, `measures`, `tracer`) still passes: the line stays in the DOM and `toContainText` reads a hidden element. | checked in the final run |
| 41 | The unit tests that named the old looks (`features.test.ts`, `markers.test.ts`) now name the lateral tone and the bare badge glyph; 254 tests pass. | done |
| 42 | L-SWD's name chip is missing at zoom 15 (the mockup shows it at the midpoint): the chip gives way to PT-1's name, because MapLibre places the names layer before the line chips layer and `symbol-sort-key` ranks within a layer only, so the kind list's rank (pipeline 5 over tap 2) cannot win across the two layers. One rank across every text layer is a layout change, not polish. At zoom 16 the chip shows. | backlog |

## Backlog (not polish)

| Item | What | Where it would go |
| --- | --- | --- |
| 13 | Number formatting by the session's locale (thousands separators, decimals) in values, KPIs and the Needs you details | epic-viewing follow-up or epic-editing's settings; `live.ts` `valueText` |
| 19 | The legend's Styles section only when a kind on the map can draw a preset (an instruments source alone draws none of its own) | `legend.ts` `legendKey` |
| 23, 27 | A kind setup's subline field (a well pad's wells, a pipeline's product) in the popup and sheet headers | the kind setup schema (epic-editing's kind setup screen), `DefaultPopup.tsx`, `linePopup.ts` |
| 16 | The Needs you row's alarm detail naming the alarm when there is one (keeping the count from two up) | `needsyou.ts` `stateDetail`; EXPERIENCE.md wording |
| 33 | Retiring the spike's `point.click` echo altogether once the save status has its own component (epic-editing) | `MapStudio.tsx`, the spike's message types |
| 42 | One label rank across the names, chips, KPI and line chip layers, so a pipeline's name wins over an instrument's by the kind list's rank | `MapStudio.tsx` symbol layers (one layer with a text per feature, or MapLibre's `symbol-z-order`) |

## For the owner

- Accept or name what is still off on the five side-by-sides (`docs/screenshots/showcase-compare-*.png`); accepted renders replace the mockups in the README showcase (the ticket's hitl step).
- Two decisions taken unattended, to confirm: the status line's click echo is Edit mode's (item 33), and the badge is the bare glyph on a halo (items 3 and 4, with entry 12's ER-27).
