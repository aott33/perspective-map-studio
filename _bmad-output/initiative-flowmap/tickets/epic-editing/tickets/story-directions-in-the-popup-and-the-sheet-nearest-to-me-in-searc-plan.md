---
title: "Directions in the popup and the sheet, Nearest to me in search, the distance on Needs you rows"
type: 'feature'
ticket: '16'
created: '2026-11-07'
status: 'built'
baseline_revision: 'f2a2522f6e0a45296f457c2b33eb5bf1e922b3c6'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A field user who has found a pad on the map still has to work out how to drive there, and with a position known the map still cannot say what is nearest or how far each item needing attention is.

**Approach:** Decisions (owner, 2026-11-03: R51 and R52, `directions {enabled, urlTemplate}` a prop, nothing sent to any service by Map Studio; 2026-11-06, entry 3: the popup footer as the sheet's, Directions and View alarms side by side, the route not the pin, A-Z | Nearest, distances right-aligned on Needs you rows; phone editing parked, so the sheet's Edit goes; 2026-11-07, "Approved and continue" on the planner's five picks: a custom popup view gets the footer, a line's or area's distance to its nearest point, the switch on the open list before typing with A-Z first, a template that is not a web or maps link ignored with a warning, Directions shown with no position). A `directions` prop, a popup footer, distances from entry 15's position in search and Needs you, contract 0.4.0 and the dev pages.

## Boundaries & Constraints

**Always:** `directions` is `{enabled, urlTemplate}`, null or `enabled` not true meaning off. **Footer:** the default popup, card and sheet, ends in a footer holding Directions (secondary, a route glyph) then View alarms (primary), the same height, equal widths, one alone filling it, none with neither; 44 px on the phone. View alarms leaves the card's alarm block and shows as today (alarms and an alarm page set). Directions shows for a point while `directions.enabled`, never for a line or an area, whether or not a position is known; a custom popup view gets the same footer under its body. The sheet's Edit button and `canEdit` go. **The link:** the destination is the item record's own coordinates (not a shared marker's anchor): with `urlTemplate` a non-empty string starting `https://`, `http://`, `geo:` or `maps:`, its `{lat}`, `{lng}` and `{name}` filled (name URL-encoded, coordinates to 6 decimals); any other template is ignored with one `console.warn` and the platform link used. Platform link: iOS and iPadOS (an iPhone, iPad or iPod user agent, or Macintosh with touch points above 1) `https://maps.apple.com/?daddr={lat},{lng}&q={name}`; otherwise `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}`. Opened with `window.open(url, '_blank', 'noopener')` on the press; no request made by the module. **Distances:** geodesic in the shared geometry module (`geometry.ts`): a point to the position, a line to its nearest point, an area 0 inside and else to its edge. Words: browser locale `en-US` (`navigator.language`) in miles, under 0.1 mi in feet ("850 ft", "2.3 mi", "12 mi"); otherwise kilometres, under 1 km in metres ("420 m", "1.1 km", "12 km"); feet and metres rounded to 10, tenths below 10 of the large unit, whole above. **Nearest:** with a position (`fix` from entry 15), the search field's open list (the chevron list, no text typed) starts with an A-Z | Nearest switch, A-Z chosen at first and the choice kept while the component lives; Nearest lists the ten nearest items, distance right-aligned, chosen as any result; typing returns to the usual results; keyboard reachable; no switch without a position. **Needs you:** with a position every row ends with its distance right-aligned in `text-secondary` `small`, the order by state unchanged; none without. Distances update when the position changes. View mode at 1366 and 390 px. No em dashes; Ignition files pass ignition-lint.

**Never:** Draw a route, fetch anything, or send coordinates anywhere from the module; read the session or the browser's location (entry 15's rule and `noGeolocation.test.ts` stand). Add units settings (entry 19). Change the line popup, Edit mode, `gateway/`, `designer/` main code or a message to the Gateway. Weaken a test beyond the expectations of the View alarms placement and the sheet's Edit, which this entry changes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Card | Directions on, P14 clicked, an alarm | Footer: Directions, View alarms, equal widths; no View alarms in the alarm block | No error expected |
| Link | Directions pressed, a desktop or Android agent | A new tab on the Google link with P14's coordinates | No error expected |
| Apple | An iPhone or iPad agent | The Apple link with P14's coordinates and name | No error expected |
| Template | `urlTemplate` `https://x.example/r?to={lat},{lng}&n={name}` | Filled, name encoded | No error expected |
| Bad template | `javascript:alert(1)` | Platform link, one warning | The warning |
| Line | L-SWD clicked | No Directions | No error expected |
| Off | `directions` null | No Directions; View alarms alone fills the footer | No error expected |
| Sheet | P14 at 390 px | Footer 44 px, no Edit | No error expected |
| Nearest | A position near CTB1, the chevron list, Nearest | Ten rows by distance with words; choosing one zooms as a result does | No error expected |
| Needs you | The same position | Every row ends with its distance; order by state | No error expected |
| No position | Location off | No switch, no distances | No error expected |
| Units | Locale en-US vs en-GB | "0.4 mi" vs "650 m" | No error expected |

</frozen-after-approval>

## Code Map

- `web/typescript/DefaultPopup.tsx` -- props 17-38 (`canEdit` goes, `directionsUrl: string | null` and `onDirections` added); `renderAlarms` 107-110 puts View alarms in the card's block (goes); footer 162-170, sheet only today, becomes card and sheet. `PointPopup.tsx` 78-107: the same footer after `.mapstudio-popup-view-body`.
- `web/typescript/selection.tsx` -- `popupContentFor` 808-893 (DefaultPopup 853-868, `canEdit={false}` 865, `PointPopup` 878-892): pass the link built from `host.liveItem(id)` coordinates (`MapStudio.tsx:869` pattern), never `open.lngLat`; `navigate` 472-486 is the in-app route, Directions uses `window.open`.
- New `web/typescript/directions.ts` -- pure: the prop read, the platform from `(userAgent, maxTouchPoints)`, the template check and fill, the link. `popupParams.ts` `fill()` may be reused; `fillLink` only takes page paths.
- `web/typescript/geometry.ts` (the shared geometry module, AD-19, Turf, metres) -- add `itemDistanceM(position, geometry, area)`; `shared.ts:58` `distanceM` and `placeCheck.ts:448` stay. `linePopup.ts:31` `distanceText` (km only) stays; new `distanceWords(metres, locale)` beside it or in `geometry.ts`'s neighbour `units`-free helper.
- `web/typescript/search.ts` (`SearchEntry` 33-47 gains the geometry it needs; `allEntries` 158) and `SearchControl.ts` (`renderList` 264-329: the switch prepended to the panel before the list near 289; `keepFocus` 249 must cover it; keys 447-496; `setPosition` new) -- Nearest; entries fed at `itemsLayer.ts:114-117`.
- `web/typescript/needsyou.ts` (`NeedsYouRow` 18-35) and `NeedsYouControl.ts` (`renderList` 215-292, the distance span after `text` near 285; `setPosition` new) -- fed at `itemsLayer.ts:118-123`.
- `web/typescript/MapStudio.tsx` -- `applyUserLocation` 950-978 also calls the two `setPosition`; `getPropsReducer` 1548-1556 reads `directions` as `userLocation` is read.
- `web/typescript/mapstudio.css` -- footer 691-702 (card too), popup buttons 611-631, search 1144-1179 and 1489, Needs you 1382-1466, phone rules 1741-1752.
- `common/src/main/resources/mapstudio.props.json` -- `directions` after `userLocation`; `MapStudioComponentTest.java:97-98` key order.
- Dev project: `views/MapStudioLocate/view.json` and `views/MapStudioDev/view.json` (the map at `/`) set `directions.enabled` true; `/locate` also a `urlTemplate` field off by default. ignition-lint in a scratch venv.
- Tests: Jest `defaultPopup.test.ts` (68-91 View alarms placement, 162-178 the sheet footer and Edit: changed by this entry), new `directions.test.ts`, `search.test.ts`, `needsyou.test.ts`, geometry and words tests. e2e: `live.spec.mjs` 120-130 and 255-300, `showcase.spec.mjs` 265-275 and 313, `retest.spec.mjs` 204-219 follow the move; new `directions.spec.mjs` at 1366 and 390 px (copy `openLocate`, `mobileGrant`, `BIND_MS` from `locate.spec.mjs`; the user agent set on the context; `window.open` captured).
- Docs: `docs/contract.md` line 3 and the props table (146-156); `docs/platform-checks.md` "Epic 4 entry 16"; `CHANGELOG.md` 0.4.0; `docs/test-playbook-0.4.0.md` a section "Directions, Nearest and distances".

## Tasks & Acceptance

**Execution:**
- [x] `common/` schema and test -- the prop.
- [x] `directions.ts`, `geometry.ts` and the distance words, with Jest -- the link, the platform, the template, every distance and unit row.
- [x] `DefaultPopup.tsx`, `PointPopup.tsx`, `selection.tsx`, CSS, Jest -- the footer.
- [x] `search.ts`, `SearchControl.ts`, `needsyou.ts`, `NeedsYouControl.ts`, `itemsLayer.ts`, `MapStudio.tsx`, CSS, Jest -- Nearest and the distances.
- [x] `ops/project/` -- the two views, ignition-lint clean.
- [x] e2e: the changed specs and `directions.spec.mjs` at 1366 and 390 px, screenshots for the owner.
- [x] Docs, CHANGELOG, the playbook section.

**Acceptance Criteria:**
- Given the dev Gateway as `mapeditor` with a mocked position, when the matrix runs at 1366 and 390 px, then each row holds.
- Given a fresh dev stack, when the whole e2e suite runs, then every spec passes (the known review 390 px flake may fail once and pass rerun alone).

## Implementation Notes

- Planner, 2026-11-07: the environment, commit and identity rules are entry 15's plan's (Docker started by hand after a container restart, `ops/up.sh --fresh` before a whole-suite run with nothing else against the stack, the trailers from the session's attribution reminder, `git commit --only` your paths, no em dashes, no model identifier, never a bare `git stash`, never a push). JDK 17 may need `apt-get install openjdk-17-jdk-headless` after a restart. Commit at each working milestone.
- Planner: a real phone and the Perspective mobile app handing the link to the maps app are the owner's check (playbook), not this build's; record them as not verified in `docs/platform-checks.md`.

- Approval (owner, 2026-11-07): "Approved and continue" with the five picks, written into the Approach; the plan, over size, kept whole.
- Build, 2026-11-07: tsc and Jest clean (615), Gradle build successful, contract check OK at 0.4.0, ignition-lint zero errors and warnings (style notes only, as before); on a fresh stack the whole e2e suite 220 passed, 7 skipped, 0 failed, directions.spec 10 of 10. A real phone and the mobile app are not verified (playbook 8b).

## Plan Change Log

- Build, 2026-11-07: the distance words follow the Boundaries' rule (under 0.1 mi, 528 ft, in feet); the example "850 ft" is past it and reads "0.2 mi". Recorded in `docs/platform-checks.md` for the owner. A line's custom popup view gets no footer (a line has no Directions, and the line popup is not changed); a point's and an area's custom view get it. The Nearest switch is reached by keyboard with Tab or ArrowLeft and ArrowRight from the empty field (the panel sits after the Needs you bar in the DOM, so plain tab order would close the list).
- 2026-11-07 (owner, "Keep the rule as built"): feet only under 0.1 mi; the Boundaries' example "850 ft" reads "0.2 mi".

- Review fix, 2026-11-07: a new position redraws an open search list only while it shows Nearest or the switch must come or go (`positionRedraws`, Jest), keeping its scroll, so an A-Z list or typed results no longer jump to the top on each fix; Tab and the arrows reach the switch on the same trimmed empty-text test that shows it.

## Review Triage Log

Quick lens, 2026-11-07: 2 findings; high 0, medium 1, low 1, false 0.

| Finding | Verdict | Evidence | Route |
| --- | --- | --- | --- |
| Each new position rebuilds an open search list, A-Z or typed results included, and sends it back to the top | medium | `SearchControl.ts` `setPosition` (183) calls `search()` whenever the panel is open; `renderList` empties the panel; `showMore` keeps `scrollTop`, `setPosition` does not; a phone sends a fix every few seconds | patch: redraw only for Nearest or the switch appearing, the scroll kept |
| With spaces typed the switch shows but Tab and the arrows cannot reach it | low | The keys test `input.value === ''` (665, 673); the switch shows on `value.trim() === ''` (314) | patch: the same trimmed test |

Outcome, 2026-11-08: both patches applied (a035b38) and verified by the orchestrator: `tsc` clean, Jest 616 passed in 60 suites, `./gradlew clean build --offline --rerun-tasks` green, the contract check OK at 0.4.0, ignition-lint on `MapStudioDev` and `MapStudioLocate` 0 errors and 0 warnings (naming hints only), and `ops/up.sh --fresh` with the whole e2e suite: 220 passed, 7 skipped, 0 failed in 39.9 min (`directions.spec.mjs` 10 of 10). The scroll kept on a new position is covered by Jest only (`positionRedraws`): Chromium's emulation cannot send a new fix with the location on. A real phone and the Perspective mobile app opening the maps app are the owner's playbook check; the distance rows and View alarms' move go to entry 18's ER-27 review.

## Design Notes

One footer component serves the card, the sheet and a custom view, so the three never drift. The distance for a line or area is to its nearest point because "how far is the pipeline" means how far to reach it, not to its middle.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0.
- `ignition-lint --files` on the changed views -- expected: zero errors and warnings.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: green (the review 390 px flake may fail once; rerun it alone).
