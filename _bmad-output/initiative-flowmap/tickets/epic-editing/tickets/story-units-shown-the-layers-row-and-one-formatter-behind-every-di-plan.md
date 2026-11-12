---
title: "20a: one formatter behind every distance, following the units in force"
type: 'feature'
ticket: '20'
created: '2026-11-12'
status: 'draft'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/docs/contract.md', '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-editing/tickets/story-the-tag-browser-one-tree-for-every-tag-pick-asset-relative-p-plan-13b.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The project can name its units (19a) and an editor's override is kept and sent to every map (19b), but nothing is drawn by either: the line popup and the drawing bar always read kilometres, the typed distance is always metres, and Nearest to me follows only the browser's locale (R27).

**Approach:** One formatter in the shared geometry module renders every distance from the units in force: the store's live override, else the setup's `units`, else the browser's locale. Every place that shows or reads a distance goes through it, and an open map redraws its distances when `map.changed` brings a new units setting. Proposed as the first half of entry 20; the Layers surface's Units row is 20b, so until then the override is set by a script.

Planner's picks, proposed for the owner's checkpoint (not yet decisions): (1) In force: the live override's `system` and `labels`; with no override the setup's `units` and short labels; `auto`, from either, is the browser's locale (miles for en-US, kilometres otherwise). (2) One rounding rule everywhere, as the ticket has it: under one large unit the small one, rounded to 10 ("700 m", "3,750 ft"; a true 0 is "0 m" or "0 ft"); from one large unit, tenths under 10 and whole numbers above ("1.1 km", "1.8 mi", "12 km"). So Nearest to me under US reads feet up to a mile ("1,580 ft"), where entry 16 read "0.3 mi". (3) Short labels are km, m, mi, ft; long are kilometres, metres, miles, feet, singular at exactly 1 ("1 mile"). (4) Where a distance is typed, the exact form: whole metres or whole feet, never the large unit ("of 9,588 ft", "Type a distance from 0 to 9,588 ft"). A bare number is in the shown unit; a typed `m` or `ft` is honoured whichever is shown. The field shows the stored metres converted, and stores metres to one decimal as now. (5) Recent changes, the save card and the Undo and Revert labels follow the setting too. (6) The line popup's segment span names its unit once ("1.1 to 2 km"; "700 m to 1.1 km" when the units differ). (7) The map carries `data-units` (`metric` or `us`) and `data-unit-labels` for tests. (8) `directions.spec`'s locale tests set the setup's units to `auto` for themselves, so the locale fallback stays proven; their expectations follow pick 2.

## Boundaries & Constraints

**Always:** Every distance shown goes through the one formatter: the line popup's subline, rows and segment span (the phone sheet with it), the drawing bar's length, an instrument's place ("On L-SWD at ..."), the Instruments row and the typed distance along a line in Details and in the drawing bar (label, range words, placeholder, value), Nearest to me, the Needs you rows, Recent changes, the save card, the Undo and Revert labels. Stored values stay metres: `attachment.distanceM`, its one-decimal rounding and every `data-distance-m` are unchanged. A `map.changed` with a units record redraws every distance on an editor's and a viewer's open map with no reload, an open popup and an open Nearest list included. With the dev setup at `metric` and no override, a distance of a kilometre or more reads as it does today. Docs: `docs/contract.md`, `docs/setup.md`, `docs/instruments.md`, `CHANGELOG.md`, DESIGN.md and EXPERIENCE.md's distance examples, playbook section 8u and its lines that assume the locale decides. Words brief and plain; no em dashes.

**Never:** The Layers surface's Units row or any control that sends a settings op (20b); a change to the Gateway, the store, the contract's messages or 19b's Undo rule; the pipe size ("6 in") or any coordinate; a third unit system; a change to what the View-mode legend or the phone sheet shows beyond their distances; backlog 36's neutral words.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| F1 Metric, short | 2,922 m; 1,143 m; 700 m; 0 m; 12,400 m | "2.9 km"; "1.1 km"; "700 m"; "0 m"; "12 km" | No error expected |
| F2 US, short | 2,922 m; 1,143 m; 30 m; 0 m | "1.8 mi"; "3,750 ft"; "100 ft"; "0 ft" | No error expected |
| F3 Long | 2,922 m metric; 1,609.3 m US; 1,143 m US | "2.9 kilometres"; "1 mile"; "3,750 feet" | No error expected |
| F4 In force | Override `us`; none with setup `metric`; none with setup `auto`, locale en-US; override `auto` over setup `metric`, locale en-GB | US; metric; US; metric | A cleared override falls back to the setup |
| F5 Exact | A 2,922.35 m line, metric; US | "of 2,922 m"; "of 9,588 ft" | No error expected |
| F6 Typed, US | "3750" typed with feet shown; "3750 ft"; "1143 m" | Stores 1143 m each time; the field reads 3,750 | No error expected |
| F7 Typed, bad | "abc"; beyond the line's length | Refused | The range words in the shown unit |
| F8 Live | A second editor and a viewer with the line popup open; a settings op sets `us`, `long` | Both read "1.8 miles" with no reload; `data-units` is `us` | No error expected |
| F9 Cleared | The override deleted | Both read kilometres again | No error expected |
| F10 Span | Instruments at 1,143 m and 2,000 m; at 700 m and 1,143 m (metric) | "1.1 to 2 km"; "700 m to 1.1 km" | No error expected |
| F11 Nearest | Setup `auto`, locale en-US, an item 480 m away | "1,570 ft" | No position: as today |

</frozen-after-approval>

## Code Map

All under `web/typescript/` unless a root is given.

- `geometry.ts` -- the shared geometry module (AD-19): `lengthM` :44, `haversineM` :600, `itemDistanceM` :627. It formats nothing yet: the formatter, the exact form, the parser and the in-force rule go here.
- `linePopup.ts` -- `distanceText` :31 (always km), `usesMiles` :44 and constants :40, `distanceWords(metres, locale)` :59 (entry 16's rule, to become the one rule), `browserLocale` :75, `lineSubline` :80, `segmentWords` :220 (strips a hard-coded `' km'`), :230.
- `drawing.ts` -- `progressText` :120, `metresText` :264, `distanceRangeText` :283, `readDistance` :291, `instrumentLocationText` :302.
- Callers: `LinePopup.tsx` :156, :199; `selection.tsx` :947 (popup and phone sheet); `studio/PropertiesPanel.tsx` :345, :623 `commitDistance`, :714, :1497 label "(m)", :1504; `studio/DrawingBar.tsx` :155-159; `editing.ts` :1429 `placeTyped`; `SearchControl.ts` :498; `NeedsYouControl.ts` :306; `history.ts` :202, :580, :632; `unsaved.ts` :619 `moveWords`, :743, :824; locale passed at `MapStudio.tsx` :1822, :2428 and `MapStudioStoreDelegate.ts` :2232.
- Inputs: `changes.ts` `liveUnits` :60; `contract.ts` `MapUnits` :98, `UnitsSetting` :117, `MapSetup.units` :179. The delegate drops `setup.units` in `onMapLoad` (`MapStudioStoreDelegate.ts` :2326): keep it, add it to the state (:112) and props (:482); `units` is already at :204, :507.
- Redraw: React parts follow the delegate's props. `SearchControl`, `NeedsYouControl` are fed by setters (`itemsLayer.ts` :127-140; `MapStudio.tsx` :1465 `setPosition`, the pattern for a `setUnits` that redraws an open list). `data-units-override` is at `MapStudio.tsx` :2788.
- Jest naming distances: `distances`, `linePopup`, `drawing`, `itemPanel` :382, `drawToolbar` :225, `history`, `saveCard`, `historyDelegate` :207, :280 (about 65 expectations; jsdom's locale is en-US).
- e2e: stay as they are under the metric setup when a kilometre or more: `linepopup.spec.mjs` :202-236, `drawing.spec.mjs` :128-216, `addinstrument.spec.mjs` :190-362 (the "0 km" and sub-kilometre ones change). `directions.spec.mjs` :250, :253, :304, :329-338, :377 assume the locale decides. Helpers: `e2e/lib/gateway.mjs` :104-142 (`writeSetup`, `scanProject`, `putBackSetup`), `settings.spec.mjs` :37-119 (`firstSet`, `clearUnits`, `openSecond`, the viewer). Seed: L-SWD 2,922.35 m; PT-1 at 1,143 m, LV-1 2,000 m, PT-2 2,841 m.
- Docs: `docs/contract.md` :152, :188, :211, :240, :242, :363, :374; `docs/setup.md` :58, :108; `docs/instruments.md` :49; `docs/platform-checks.md` :1108; playbook :167, :173, a new 8u before "## 9"; DESIGN.md :503, :511; EXPERIENCE.md :123-127. Stale comments: `contract.ts` :115, :176, `changes.ts` :54, `drawing.ts` :263, `linePopup.ts` :57.

## Tasks & Acceptance

**Execution:**
- [ ] `geometry.ts`, a new `__tests__/units.test.ts` -- the formatter, the exact form, the parser, the in-force rule -- F1 to F7, F10, tests first.
- [ ] `linePopup.ts`, `drawing.ts`, `history.ts`, `unsaved.ts` and their tests -- the old formatters removed, every caller on the one formatter.
- [ ] `MapStudioStoreDelegate.ts`, `MapStudio.tsx` -- `setup.units` kept, the units in force in props, `data-units`, `data-unit-labels`.
- [ ] `LinePopup.tsx`, `selection.tsx`, `studio/PropertiesPanel.tsx`, `studio/DrawingBar.tsx`, `editing.ts` -- the popup, the typed distance both ways -- F5 to F7.
- [ ] `SearchControl.ts`, `NeedsYouControl.ts`, `itemsLayer.ts` -- the units by setter, an open list redrawn -- F8, F11.
- [ ] `e2e/tests/units.spec.mjs` -- F2, F6, F8, F9 live with a second editor and a viewer, the setup at `us` and at `metric`; `directions.spec.mjs` and the sub-kilometre expectations updated.
- [ ] Docs as Always lists; playbook 8u.

**Acceptance Criteria:**
- Given the dev setup at `us`, when the line popup of L-SWD opens, then it reads 1.8 mi and PT-1 at 3,750 ft, and a typed 3750 in Details stores 1143 m.
- Given the dev setup at `metric` and no override, when the suite runs, then no expectation of a kilometre or more changed.
- Given the source, when searched, then no distance is formatted outside the one formatter.

## Implementation Notes

- Planner, 2026-11-12: the environment and identity rules are entry 13b's plan's first Implementation Note; they hold here. Leave the work uncommitted; run the specs you touch, not the whole suite. Check `docker ps` before any stack work and start Docker as the hand-off note says if it stopped. Restore the dev setup and clear the override at the end of every spec that changes them.

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK
- `ops/up.sh --fresh`, then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: 0 failed
