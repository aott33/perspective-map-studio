---
title: "The legend in the rail's Layers surface in Edit mode"
type: 'feature'
ticket: '22'
created: '2026-11-05'
status: 'in-progress'
baseline_revision: 'ad74df19dfaf65aa2b7152963d8f6c14b9088fd2'
route: 'full'
route_source: 'auto'
risk: 'low'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** In Edit mode the Legend button and its panel float over the map bottom-left, one more thing over the map while the rail's Layers surface says "Nothing here yet".

**Approach:** Decision (owner, 2026-11-05): render C of the legend review. In Edit mode the Legend button and its floating panel leave the map, the scale bar staying bottom-left alone, and the Layers surface shows the legend's desktop content in the dock: the key (States, Kinds, Lines, Styles, Areas), Show (the Lines and Names toggles) and the Basemap choice when more than one basemap is offered. View mode and phone widths keep the Legend button and its panel as today.

## Boundaries & Constraints

**Always:** One legend: the Layers surface shows the same content the panel draws, from the same state (key, toggles, offered and selected basemaps, the basemap status), and a toggle or a basemap picked there goes through the same callbacks, so it acts and is remembered exactly as in the panel and the panel shows it after leaving Edit mode. A floating panel open when Edit mode is entered closes. The legend in the dock is not "open" for the map-click close (`selection.tsx`) or `data-legend-open`. Colours from theme tokens; no em dashes. Every existing spec keeps its expectation, except the studio spec's "the Legend button stays", which the owner's decision reverses.

**Never:** Change the Gateway, `common/`, a message, a prop or the contract version. Change the legend's View-mode or phone look. Add the Units row (entry 19) or any new Layers content. Add a dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Edit mode | 1366 px, the studio on | No Legend button over the map; the scale bar bottom-left | No error expected |
| Layers | The rail's Layers | The dock titled Layers holds the key, Show and Basemap (with more than one basemap) | No error expected |
| Toggle there | Lines off in Layers | Lines hide on the map; still off after a reload and in View mode's panel | No error expected |
| Basemap there | Another basemap picked | The map switches, as from the panel | The basemap status as in the panel |
| Panel open on entry | View mode with the panel open, then the switch on | The panel closes; Layers shows the content | No error expected |
| Leave Edit mode | The switch off | The Legend button back, the panel as before | No error expected |
| Map click | A click on the map with Layers showing | The dock's legend stays | No error expected |
| Phone | 390 px | The Legend sheet as today | No error expected |

</frozen-after-approval>

## Code Map

- `web/typescript/LegendControl.ts` -- one control holds the legend's state (`key`, `toggles`, `offered`, `selected`, `statusText`) and draws it into `this.panel` (`fill()`: desktop key, `renderShow`, Basemap; the phone sheet); `setKey`, `setToggles`, `setOffered`, `setSelected`, `setStatus` redraw an open panel; `open`, `close`, `isOpen`; the callbacks `onChoose`, `onToggle` (`data-legend-open`), `onSwitch`. The dock's copy belongs here as a second host the same `fill` draws into (always the desktop layout), so every setter redraws both; it calls neither `onToggle` nor counts for `isOpen`.
- `web/typescript/MapStudio.tsx` -- `renderDock` (about 1059: the empty Kinds or Layers surface with "Nothing here yet"), `legendControl`, `onLegendSwitch` (634, remembers per session), `onBasemapChoose` (621), `applyTopBar` (closes the View-mode lists as the studio comes on: the floating legend panel closes there too).
- `web/typescript/selection.tsx` (about 194) -- a map click closes an open legend panel; the dock's copy must stay.
- `web/typescript/mapstudio.css` -- `.mapstudio-legend`, `-row` (the button and the scale bar share the row, about 930-956), `.mapstudio-legend-panel` (1061, 1580: floating sizes the dock's copy must not take), `.mapstudio-dock`, `.mapstudio-dock-note` (2553). Edit mode hides the button under `.mapstudio--editing` from 768 px, as entry 21 hides the top bar.
- e2e: `studio.spec.mjs` 451 asserts the Legend button visible in Edit mode (reversed by the owner's decision); `basemaps`, `needsyou`, `showcase`, `measures` use the legend on View pages only. Renders under `E2E_DOCS=1`.
- Docs: `docs/contract.md` (the Legend paragraph and the studio's test hooks), `CHANGELOG.md` 0.4.0.

## Tasks & Acceptance

**Execution:**
- [x] `web/typescript/LegendControl.ts` -- a docked host the content draws into and leaves (desktop layout, its own focus keys, no `onToggle`, not `isOpen`), redrawn by every setter -- one legend, two places.
- [x] `web/typescript/MapStudio.tsx` -- the Layers surface renders the dock's host and hands it to the control as it mounts and unmounts; the floating panel closes as the studio comes on.
- [x] `web/typescript/mapstudio.css` -- the Legend button hidden in Edit mode from 768 px, the scale bar kept; the docked legend's look in the dock (no card, full width, scrolling with the dock).
- [x] `e2e/tests/studio.spec.mjs` -- the matrix at 1366 px (and the Layers surface at 1440 px), the old "Legend button stays" check reversed; a render of the Layers surface under `E2E_DOCS=1`.
- [x] `docs/contract.md`, `CHANGELOG.md` -- the legend in Layers in Edit mode, its test hooks.

**Acceptance Criteria:**
- Given the dev Gateway as `mapeditor`, when the matrix runs in `studio.spec.mjs`, then each row holds.
- Given the whole e2e suite on a fresh dev stack, when it runs, then every spec passes.

## Implementation Notes

- Approval (owner, 2026-11-05): "legend C", taken as the plan's approval; the plan builds render C of the legend review.
- Planner, 2026-11-05: the environment, commit and identity rules are entry 4's plan's (Docker started by hand after a container restart, `ops/up.sh --fresh` before a whole-suite run, the two trailer lines from the session's attribution reminder, no em dashes, no model identifier, never a bare `git stash`, never a push).

## Plan Change Log

- 2026-11-05 (implementer): no change to the frozen intent. Readings and small additions, for the reviewer:
  - One legend, two places (`LegendControl.ts`): the state (key, toggles, offered and selected basemaps, the status text and the Kinds disclosure) stays the control's, once; the panel and the docked copy are two `LegendHost`s, each with its own controls and listeners, which the same `fill` draws (the docked one always the desktop layout). Every setter redraws or updates both; a toggle in one place sets the other's checkbox too. `dock(el)` appends a wrapper `.mapstudio-legend-dock` to a child-less React element (`.mapstudio-dock-legend`, handed over through a ref callback as the Layers surface mounts, `dock(null)` as it unmounts; also in `componentDidMount` and `onRemove`), so React never renders into what the control draws. Each rail surface's section is keyed, so Kinds to Layers remounts instead of React reusing the note's `div` as the host.
  - Its own focus keys: the same `data-focus-key` values, looked up inside each host alone, so each keeps its own focused control across a redraw; the dock takes no focus when drawn.
  - As the studio comes on (`applyTopBar`), the focus leaves the Legend as it leaves the top bar, then an open panel closes (`close(false)`, so `data-legend-open` reads false); the map click (`selection.tsx`) still closes the panel only, since `isOpen` is the panel's (a comment there says so).
  - `docs/basemaps.md` (not in the Code Map, one sentence): it said Edit mode's Layers "keeps its own switch when epic-editing builds it" (owner, 2026-10-28); render C makes it this same legend and switch, so the sentence now says so.
  - Camera padding (not changed, noted): in Edit mode the bottom-left row is the 18 px scale bar alone instead of the 32 px button, so `cameraPadding`'s bottom inset there is 14 px smaller and a row pick centres 7 px lower; no spec measures it in Edit mode.
  - The renders: beside `mapstudio-studio-layers-1366.png` and `-1440.png`, `mapstudio-studio-layers-end-1366.png` and `-1440.png` scrolled to the dock's end, so Show and Basemap are in view for the owner's comparison with render C. The basemap row stubs the OpenStreetMap tiles as `basemaps.spec.mjs` does (a local copy of its stub: the box may not reach the provider), and serves broken tiles for the status row. The 390 px row is a new test in the 390 px block.

## Review Triage Log

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` -- expected: BUILD SUCCESSFUL.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: green (the review 390 px flake may fail once; rerun it alone).

**Manual checks (if no CLI):**
- The owner compares the Layers render with render C of the legend review.
