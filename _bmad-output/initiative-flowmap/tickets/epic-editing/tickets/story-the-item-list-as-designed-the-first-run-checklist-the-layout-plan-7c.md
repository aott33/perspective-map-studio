---
title: "7c: The Edit-mode layout at 1440, 1366 and below 1280 px, the map kept still as panels dock"
type: 'feature'
ticket: '7'
created: '2026-11-08'
status: 'in-review'
baseline_revision: '6917ebbef614a0bfe51d3b8668d758d8697cb00d'
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

**Problem:** In Edit mode the map jumps about 160 px when Details docks after a placement and again when Details closes, so the item an editor just placed or was looking at slides away; and below about 1280 px the docked list leaves the map too narrow to work in.

**Approach:** Decisions (owner, 2026-10-27: Direction A, the list collapsing to a button below about 1280 px, the bottom-right corner reserved; 2026-11-08: entry 7 split, this is 7c after 7a; 2026-11-08, "Go with recommendations": option A, the rail's Items button opens the collapsed list over the map, no new button and no render). One rule for every panel that docks or undocks beside the map: the ground stays where it is on the page. Below 1280 px the list leaves the dock and opens from a button.

## Boundaries & Constraints

**Always:** **Keep place.** Whenever the map's page box changes because a studio panel docks, undocks, collapses or opens (Details after a Point, Line or Area placement and after a split; Details closed by a ground click, its close or Esc; the list collapsing or expanding at the 1280 px line), the map pans by the box's page shift so every item keeps its page position, as entry 26's Edit-mode click does (`keepPlace`); a just-placed or selected item the docked panel would cover is then eased into view as entry 26 does. A window resize, a View-mode change and a row choice (which already eases to its item) keep today's behaviour. **Widths:** 1440 and up: rail 72, list 280, properties 340; 1280 to 1439: rail 72, list 256, properties 320 (today's). **Below 1280 px** (768 to 1279): the list is not docked; the rail's Items button opens it as a panel over the map's left edge at the list's width, with the 7a list whole (header, groups, footer); it closes on a row choice (the row's selection and Details as today), on Esc, on the rail's Items again, or on a click on the map; the toolbar returns to the top row beside the Editing switch, clear of it; Details still docks. **Bottom-right:** at 1440, 1366 and 1200 px no control, toast, panel edge or footer button lies within the App Bar clearance (76 px) of the stage's bottom-right corner; the attribution text alone may sit there. No em dashes.

**Never:** Change View mode, the phone (below 768), the panels' contents, the 7a list's logic or the camera of a row choice, Fit, Return, search or Locate me. Move the map on a window resize beyond MapLibre's own. Weaken a test beyond the expectations of the 1200 px dock width and the tracer's drawn place, which this entry changes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Placement | 1366, Point tool, a click at a page spot | The new pad stays at that page spot as Details docks (within 2 px) | No error expected |
| Line placed | A line finished | Its points keep their page spots as Details docks | No error expected |
| Close | Details open on CTB1, then a ground click, then again with close and with Esc | CTB1 and every item keep their page spots as the stage widens | No error expected |
| Covered | A pad placed where the docked panel lands | It is eased into view | No error expected |
| 1440 | Edit mode | Rail 72, list 280, properties 340, map about 748 with a selection | No error expected |
| Below 1280 | 1200 px | No docked list; Items on the rail opens it over the map; a row chosen closes it and opens Details; the toolbar on the top row | No error expected |
| Crossing | The window widened from 1200 to 1366 | The list docks again and the items keep their page spots | No error expected |
| Corner | 1440, 1366, 1200 with Details open | Nothing but the attribution within 76 px of the stage's bottom-right | No error expected |

</frozen-after-approval>

## Code Map

- `web/typescript/selection.tsx` -- `keepPlace` 359-388 (private: resize at once, `panBy(pageShift)`, then `intoView` with `cameraPadding` and `IN_VIEW_MARGIN_PX`), `pagePlace` 339-346, `selectWithDetails` 324-336 (its caller pattern: read the box before `setState`, keep place in the callback); `clearSelection` 439-444 (no pan today), ground click `onMapClick` 300, Esc `onRootKeyDown` 169-195. Export one helper (e.g. `dockChange(host, update, place?)`) that every caller uses; a close keeps the whole ground (shift only, no `intoView`).
- `web/typescript/editing.ts` -- `onPointFinish` 1150-1196 (`setState(... panel: itemId)` at 1195, `lngLat` in scope), line and area finish 1133-1143 (`panel: itemId` at 1141). `MapStudio.tsx` split 1096-1098; `onPanelClose` 1012.
- `web/typescript/popupPlacement.ts` -- `pageShift` 199, `insideMap` 204, `intoView` 214; `camera.ts:245` `cameraPadding`.
- `web/typescript/MapStudio.tsx` -- render 1437-1449 (Rail, `renderDock` 1306-1362, `renderPanel` 1369-1410, `.mapstudio-stage`); ResizeObserver 411-420 (`map.resize()` keeps the centre; the dock change pans before it); the collapse state from a `matchMedia('(max-width: 1279px)')` listener, crossing it treated as a dock change; the rail's Items toggles the overlay list.
- `web/typescript/mapstudio.css` -- layout 2370-2403 (widths, `@media (min-width:1440px)`), dock 2460-2467, panel 3071-3078, the `@media (max-width:1279px)` block 3423-3438 (the toolbar under the switch: goes; the overlay list added; its comment says so); bottom-right 936-962 (attribution only).
- `web/typescript/studio/ItemList.tsx` 212 -- the same component in the overlay (a class or prop for the overlay, closing on choice).
- Tests: Jest `editClick.test.ts` (fake map with `resize` and `panBy` 121, 174-197; keep-place cases 446-519) gains placement, close and crossing cases; `popupPlacement.test.ts` 135-148. e2e: `studio.spec.mjs` 1004-1020 (the 1200 px test: now no docked list), 741-761 width loop, 126 `expectStageWidth`; `tracer.spec.mjs` 71-120 (its line drawn from the box read before the click: now the ground stays, so its expected place changes back); `editclick.spec.mjs` 240-372 (`expectSamePixel`, `pixelNow` 112) is the model for a new `layout.spec.mjs` at 1440, 1366 and 1200; `drawing.spec.mjs` and `details.spec.mjs` place by the map box and must keep passing.
- Docs: `docs/test-playbook-0.4.0.md` a section "The layout"; `CHANGELOG.md` 0.4.0; `_bmad-output/deferred-work.md` the two 160 px entries marked resolved by 7c.

## Tasks & Acceptance

**Execution:**
- [x] `selection.tsx`, `editing.ts`, `MapStudio.tsx` -- one keep-place path for every dock change, with Jest.
- [x] `MapStudio.tsx`, `ItemList.tsx`, CSS -- the collapse below 1280, the toolbar back on the top row, with Jest where pure.
- [x] e2e `layout.spec.mjs` and the changed specs.
- [x] Docs, CHANGELOG, deferred-work, the playbook section.

**Acceptance Criteria:**
- Given the seeded dev map as `mapeditor` at 1440, 1366 and 1200 px, when the matrix runs, then each row holds.
- Given a fresh dev stack, when the whole e2e suite runs, then every spec passes (the review 390 px flake may fail once and pass rerun alone).

## Implementation Notes

- Planner, 2026-11-08: the environment, commit and identity rules are 7a's plan's (Docker by hand after a restart, JDK 17 by apt if gone, `ops/up.sh --fresh` before a whole-suite run, the session's trailers, `git commit --only`, no em dashes, no model identifier, never a bare `git stash`, never a push). Commit at each working milestone.

- Approval (owner, 2026-11-08): "Go with recommendations" (option A, written into the Approach); the plan kept whole.
- Build, 2026-11-08: `selection.tsx` exports `dockChange(host, update, place?)`; the component and the editing host carry it as a method (`editing.ts` stays free of selection.tsx's imports). Callers: an Edit-mode click, the Point tool's placement, a finished line or area (its last point is the place eased into view), a split (the split point), `clearSelection` (ground, close, Esc, a selected item leaving the map) and Details' delete (shift only), the 1280 px crossing and a rail surface change (the selected point, if any). The collapse is component state (`listCollapsed`, `listOpen`) from `matchMedia('(max-width: 1279px)')`; the stylesheet's 1279 px media block is gone. Implementer's reading: below 1280 px only the Items list leaves the dock; Kinds and Layers still dock in its place (the toolbar's row from the map's width, after the review). A map click closes the open list and goes on as a click. The Jest case "the ground closing Details does not pan" now expects the shift (the matrix's Close row). `layout.spec.mjs` waits 1 s before clicking CTB1 again after a close: on the software-GL box MapLibre re-places its symbols over the next frames and an earlier click takes L-SWD under the marker. `docs/contract.md` gains "The Edit-mode layout".
- Verified, 2026-11-08: tsc clean, Jest 646 passed in 62 suites; `./gradlew clean build --offline --rerun-tasks` green; the contract check OK at 0.4.0; on a fresh stack the whole e2e suite 249 passed, 7 skipped, 1 failed (`review.spec.mjs` light 390 px, the known flake: "No Connection to Gateway" in its snapshot, deferred-work.md), which failed twice more alone in either theme, then passed with each theme's group rerun (4 of 4 and 5 of 5); `layout.spec.mjs` 14 of 14.

## Plan Change Log

- 2026-11-08, review fixes: the toolbar's row follows the map's measured width (top row only when it fits 12 px clear of the switch, else under it; `mapstudio--narrow-dock` gone); the list's view (search, Sort by, Filter, unlinked only) held by the component across mounts; a row chosen over the map moves the focus to the map; the open list's Esc skips fields outside it. Jest `itemListPanel.test.ts`, e2e `layout.spec.mjs` at 1024 and 1200 px (16 of 16), `studio.spec.mjs` and `itemlist.spec.mjs` 36 of 36.

## Review Triage Log

Quick lens, 2026-11-08: 6 findings; high 0, medium 4, low 2, false 0.

| Finding | Verdict | Evidence | Route |
| --- | --- | --- | --- |
| Below about 1085 px with Items and Details docked the top-row toolbar runs into the Editing switch | medium | The 1279 px block that held it under the switch is gone; `.mapstudio--narrow-dock` applies only with Kinds or Layers; the toolbar is centred and 396 px wide; only 1200 px is tested | patch (grouped with the next row): the row decided by the map's measured width |
| With only Kinds or Layers docked at 1200 px the toolbar drops a row it does not need | low | `narrowDock` has no Details check; the map is 872 px there; the docs name Details as the condition | patch (same root cause as above) |
| The overlay list forgets its search, Sort by, Filter and unlinked-only on every close and on crossing 1280 px | medium | `ItemList` holds them in its own state (102-129); the overlay unmounts on each close; docked and overlay are different instances | patch: the view state held once, shared |
| A row chosen in the overlay drops focus to the body; Esc, Delete and Ctrl+Z stop working | medium | The focused row unmounts as `listOpen` turns false; nothing moves focus, unlike the Esc close | patch: focus to the map container |
| Esc in a Details select closes the overlay and moves focus to the rail | low | The overlay Esc branch lacks `inField`; the choice selects have no `onKeyDown` | patch: the `inField` guard |
| The Jest crossing cases keep the page width fixed, so the event order the comment claims is untested at unit level | low | `editClick.test.ts` "the 1280 px line crossed"; the e2e Crossing row (1200 to 1366) covers the real path and passes | rejected: covered by `layout.spec.mjs`; a unit test would add a fake window resize |

## Design Notes

A dock change is the only thing that moves the map's box without the user asking for a different view, so pinning the ground to the page at that one moment fixes both jumps and the 1280 px crossing with the same code entry 26 already trusts.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: green (the review 390 px flake may fail once; rerun it alone).
