---
title: 'Opening refactor: the component split for the studio'
type: 'refactor'
ticket: '1'
created: '2026-11-03'
status: 'in-review'
baseline_revision: '2d646c1c8464dc49ed66eb2b07a1f629504c3cc7'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/handoff-epic-4.md', '{project-root}/docs/architecture.md', '{project-root}/docs/development.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `web/typescript/MapStudio.tsx` is 3,207 lines holding the Perspective store delegate (453 lines) and the React component (2,341 lines, with popups and selection alone about 540), and epic 4 adds a rail, an item list, a properties panel, the Kinds screen, the tag browser, a draw toolbar, an undo stack and a Recent changes dock on top of it. Every studio story would collide in one file.

**Approach:** Split the file into modules by concern with no change in behaviour, and add one small pure mode and selection model (View or Edit, the current tool, the selected ids) that the component holds and the studio's surfaces will read. Every e2e and unit test passes unchanged; the contract, CSS, data attributes and test hook do not move.

## Boundaries & Constraints

**Always:** Keep every `data-*` attribute, class name, DOM order and `window.__mapStudioTest*` hook exactly as today (e2e reads them). Keep the one delegate-to-component interface: `notify()` to `mapStateToProps` with the same fields and revisions, and the same delegate methods the component calls. Keep `index.ts`'s exports (`MapStudio`, `MapStudioMeta`, the style preview exports). Follow the existing module pattern: pure functions unit tested in node where no DOM or MapLibre is needed, DOM-bound modules with a header comment saying what they own. Commit at each milestone (the delegate out, the map setup out, the popups out, the model in). No em dashes anywhere.

**Never:** Change any message, prop, event, the contract docs, `mapstudio.props.json`, `mapstudio.css`, anything under `e2e/`, `common/` or `gateway/`. Add a dependency. Change what the map draws, when it redraws (the revision gating), or the spike's Draw a line behaviour. Fix a bug or add a feature found on the way: record it in `_bmad-output/deferred-work.md` instead. Let the production bundle grow past 2 percent of the baseline's bytes.

</frozen-after-approval>

## Code Map

- `web/typescript/MapStudio.tsx` -- the whole thing today: imports 1-86; `MapStudioProps`, `MapStudioState` (extends `DrawState`), `BasemapState`, `MapStudioDelegateState`, `browserStorage`, `clientOf` 100-254; `MapStudioStoreDelegate` 256-708 (messages, `MapChanges`, unsaved queue and sender, live, connection, basemap; `handleEvent` 581-621; `notify()` is the only flow to the component); component constants 710-835 (layer ids, sprite and glyph URLs, `markerColors`, `THEME_TOKENS`, `chipOffsetExpression`, `LabelBox`); `MapStudio` 841-3181; `MapStudioMeta` 3183-3207.
- Component concerns, by line: map creation, controls and layers in `componentDidMount` 938-1223 and `addTextLayers` 1398-1545, `applyTheme` 1239-1287, unmount 2223-2266; starting area, place memory and restore 929, 1300-1386, 1548-1561; basemap 1567-1688; labels and toggles 1704-1754, 1939-1969; zoom card and camera 1777-1870, 1971-2004; search and Needs you choices 1878-1931; items drawing and marker images 2029-2123, 2142-2221; drawing 2014, 2126, 2276-2303, 2340-2411; selection, popups and pick list 2413-2955; keyboard 2374-2404; unsaved and status render 2006, 3027-3056, 3095-3180; readiness and test attributes 2306-2338, 2961-3024, 3063-3089.
- `web/typescript/index.ts` -- the only importer (`MapStudio`, `MapStudioMeta`); registers the component; re-exports `StylePreview`, `PresetPalette`, `TintPalette`. Keep its imports working.
- Controls already in their own modules and wired from `componentDidMount` 992-1030 with constructor callbacks and setters: `ZoomControl.ts`, `SearchControl.ts`, `NeedsYouControl.ts`, `LegendControl.ts`, `DrawControl.tsx`, `mapboxLogo.ts`. Reuse as they are.
- Pure modules the component already delegates to (keep, do not fold back): `draw.ts` (`DrawState`), `features.ts` (`Selection`, `SegmentRef`), `live.ts`, `markers.ts`, `search.ts`, `needsyou.ts`, `place.ts`, `startingArea.ts`, `basemaps.ts`, `unsaved.ts`, `unsavedSender.ts` (already pulled out of the delegate, the pattern to follow), `changes.ts`, `connection.ts`, `popupPlacement.ts`, `linePopup.ts`, `popupParams.ts`, `theme.ts`, `themeWatch.ts`.
- `web/typescript/testHook.ts` -- `window.__mapStudioTest.send` and `__mapStudioTestView`; registered by the delegate's constructor. Unchanged.
- `web/jest.config.js`, `web/tsconfig.test.json` -- node tests under `typescript/__tests__/*.test.ts`; no test imports `MapStudio.tsx`. New model tests go here.
- `web/webpack.config.js` -- entry `typescript/index.ts`, output `web/build/generated-resources/mounted/MapStudio.js` and `.css`; the bundle baseline is a production build at `baseline_revision` (0.3.0's docs run recorded `MapStudio.js` 1,319,758 bytes, `docs/spike-measures.json`).
- `_bmad-output/initiative-flowmap/tickets/epic-viewing/tickets/story-refactor-sweep-plan.md` -- the last sweep's conventions: `liveItem(id)`, `displayShows`, `popupParts.tsx`; "exports used only in their module stay".

## Tasks & Acceptance

**Execution:**
- [x] `web/typescript/MapStudioStoreDelegate.ts` -- move `MapStudioStoreDelegate`, `MapStudioDelegateState`, `BasemapState`, `BASEMAP_INITIAL`, `browserStorage` and `clientOf` here unchanged -- the delegate becomes its own module (first milestone, commit).
- [x] `web/typescript/mapLayers.ts` -- move the layer and source ids, sprite and glyph URLs, `markerColors`, `THEME_TOKENS`, `chipOffsetExpression`, `LabelBox`, the load handler's sources and layers (1044-1198) and `addTextLayers` into functions taking the map -- the map's drawing, out of the component.
- [x] `web/typescript/viewControls.ts` -- move the construction and wiring of the zoom card, search, Needs you, legend and Mapbox logo controls (992-1030 and their setters) into one function returning the handles -- the View-mode controls' wiring in one place.
- [x] `web/typescript/camera.ts` -- move `controlRect`, `cameraPadding`, `onFit`, `fitTo`, `onReturn`, `publishFit`, `publishView`, the starting area, place memory and restore helpers -- camera and place in one module.
- [x] `web/typescript/itemsLayer.ts` -- move `drawItems`, `drawUnsaved`, `dropQueuedFeatures`, `loadSprite`, `makeImage`, `publishItemCounts` -- the items on the map, with the revision gating kept as is.
- [x] `web/typescript/selection.tsx` -- move `onPointClick`, `onMapClick`, `selectLine`, `openLinePopup`, the pick list and popup opening, closing and rendering (2413-2955) into a module the component delegates to -- the largest block, a milestone commit of its own.
- [x] `web/typescript/editing.ts` -- move `startTerraDraw`, `applyEditing`, `toggleDrawing`, `onDrawFinish`, `setDrawState` and the Esc handling of drawing -- the spike's line tool, unchanged in behaviour.
- [x] `web/typescript/studio.ts` -- new, pure: `StudioState {mode: 'view' | 'edit', tool, selected: string[]}` with `enterEdit`, `leaveEdit`, `pickTool`, `select`, `toggleSelect`, `clearSelection` and `fromProps(editMode)`; the component holds it in state and derives today's `editing`, `drawing` and `selected` from it -- the model the studio's surfaces will read.
- [x] `web/typescript/__tests__/studio.test.ts` -- unit tests of every transition and of the derivation matching today's `editMode` and selection behaviour.
- [x] `web/typescript/MapStudio.tsx` -- what remains: props, state, `componentDidMount` and `componentWillUnmount` as thin wiring of the modules above, `render`, `MapStudioMeta`; under 800 lines.
- [x] `docs/architecture.md` -- the contributor guide's `web/` layout updated with the new modules in one short table -- so the next story finds them.

**Acceptance Criteria:**
- Given the dev stack with the 30-pad seed, when the whole e2e suite runs on the refactored bundle, then every test passes with no edit under `e2e/`.
- Given the web unit tests, when `jest` runs, then every existing test passes unchanged and the new `studio.test.ts` passes.
- Given a production build at `baseline_revision` and one at the result, when the bytes of `MapStudio.js` and `MapStudio.css` are compared, then each is within 2 percent of its baseline.
- Given `git diff baseline_revision`, when the changed paths are listed, then none is under `e2e/`, `common/`, `gateway/`, `docs/contract.md` or `mapstudio.css`, and `mapstudio.props.json` is unchanged.
- Given `web/typescript/MapStudio.tsx` after the split, when its lines are counted, then it is under 800 and the delegate lives in its own module.
- Given the dev map in a browser, when a viewer opens it, an editor opens `/edit`, draws a line and presses Esc, and a popup opens and closes, then every `data-*` attribute, class name and the test hook read as before.

## Implementation Notes

- Environment (planner, 2026-11-03): a fresh container. Java 17 is at `/usr/lib/jvm/java-17-openjdk-amd64` (installed today; Gradle's toolchain wants it). The Docker daemon was started by hand (`dockerd`, log in the session scratchpad) and has no images yet: `ops/up.sh` pulls `inductiveautomation/ignition:8.3.10` and `postgres:16-alpine` on first use and reads an optional git-ignored `.env` (defaults in `ops/lib.sh`); if `docker info` fails after a container restart, start `dockerd` again. `web/node_modules` and `e2e/node_modules` are installed; Chromium for Playwright is at `/opt/pw-browsers/chromium` (never run `playwright install`). The first Gradle run fetches Gradle 9.8 and the dependencies through the proxy, so no `--offline` that time.
- Commits (planner): one commit per milestone on the current branch, never a push; each commit message ends with the two trailer lines `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01F9eVq2qqbKx1YxrgoxuWT6`; no em dashes and no model identifier anywhere in files or messages apart from that trailer; never a bare `git stash`.
- Commits (implementer, 2026-11-04), one per milestone: af7c3e6 the delegate out (`MapStudioStoreDelegate.ts`); 6252d3e the map setup out (`mapLayers.ts`, `viewControls.ts`); 69d88ce the camera and the items layer out (`camera.ts`, `itemsLayer.ts`); d9fce8f the popups out (`selection.tsx`); 98fac61 the line tool and the basemap out and the model in (`editing.ts`, `basemapLayer.ts`, `studio.ts`, `studio.test.ts`); then the docs and this plan.
- How the modules take the component (implementer): each DOM-bound module exports plain functions whose first argument is the component typed as that module's `*Host` interface (`CameraHost`, `ItemsHost`, `BasemapHost`, `SelectionHost`, `EditingHost`, `ViewControlsHost`), which names exactly the fields and callbacks the module reads, as `SenderHost` does for the sender; so the fields the modules read and write (`map`, `mapContainer`, the controls, the revision gating, the popup's element and clock, the place) are no longer `private` on the component, and the component passes `this`. Calls that cross a module go through the host (a thin public method or stable arrow field on the component: `fitTo`, `publishFit`, `publishSelection`, `openPopup`, `popupPoint`, `openLinePopup`, `selectLine`, `controlRect`, `dropQueuedFeatures`, `closePopup`, `navigate`, `onPick`, `onPopupClosed`, `onDrawFinish`, `onKeyDown`); calls inside a module are direct. Every moved method keeps its name; `mapLayers.ts` is the one module of pure map functions (no host), with the load handler split into `addItemLayers`, `addUnsavedLayers` and `addTextLayers` so the missing image resolver and the sprite fetch sit between them exactly where they were.
- Beyond the plan's list (implementer): `basemapLayer.ts` (applyBasemap, updateFeedbackLinks, publishBasemap, onMapError) was needed to get the component under 800 lines (777); `onMapIdle`, `applyTheme`, `applyLayerToggles`, `publishLabels` and the four render helpers (adapter status, live state, unsaved, style panel) stay in the component as thin wiring or render. The only non-moves: `boundsOf(coordinates)` in `camera.ts` replaces the loop `onReturn` and `goToItem` each carried (the same arithmetic); `createMap` and `startCamera` name the map construction and its first camera; `dropImages` names applyTheme's image drop; `blankColors` names the mount's four-token read (its `line` token, `--neutral-70`, was unused before and is unused now).
- The model as wired (implementer): `MapStudioState.studio` is initialised from `editMode` in the state initialiser (once, as the plan says); the Draw a line control is added and the echo line rendered when `isEditing(studio)` (the component read the prop live in `render` before, a difference only if the prop changed after mount, which no page does); `drawingState(state)` and `selectionState(selected)` on the component write the `DrawState` or the `Selection` together with the model (`pickTool`, `select`, `clearSelection`), and every `selected` write in `selection.tsx` and `camera.ts` goes through `selectionState`, so `state.drawing === isDrawing(studio)` and `state.selected?.id === selectedId(studio)` hold at every render. `pickTool` leaves a View-mode state unchanged (View mode has no tool); `toggleSelect` is for the studio's multi-select and has no caller yet.
- Bundle (implementer): production `webpack --mode production` at the baseline gave `MapStudio.js` 1,352,177 bytes and `MapStudio.css` 108,962; after the split 1,351,289 (888 bytes fewer, -0.066 percent) and 108,962 (identical).

- Baseline (main session, 2026-11-04): the branch's commits were rewritten to the repository's Claude identity at the owner's request; the baseline commit `4d75bd6` became `2d646c1` with the same tree and message, and the frontmatter follows it.

## Plan Change Log

## Review Triage Log

## Design Notes

Move, do not rewrite: each module takes the map and the component's callbacks as arguments or as a small context object, and the component keeps owning the state so `setState` and the revision gating (`drawnRevision`, `drawnLive`, `drawnUnsaved`, `drawnBasemap`, `drawnFulls`) stay where they are. A moved method keeps its name so `git log -L` and the e2e comments still point at it. The model's `fromProps` reads `editMode` once at mount, as today (entry 14 makes it bidirectional later).

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean types, every test green including `studio.test.ts`.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build` -- expected: BUILD SUCCESSFUL (the first run in this container fetches Gradle and the dependencies; later runs may add `--offline`).
- `stat -c %s web/build/generated-resources/mounted/MapStudio.js web/build/generated-resources/mounted/MapStudio.css` at `baseline_revision` and after -- expected: each within 2 percent.
- `ops/up.sh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: the whole suite green (about 30 minutes; the first run pulls the Gateway and PostgreSQL images).
- `bash scripts/ci/check-contract-versions.sh` -- expected: pass, nothing changed.
- `git diff --stat <baseline_revision> -- e2e common gateway docs/contract.md web/typescript/mapstudio.css common/src/main/resources/mapstudio.props.json` -- expected: empty.
- `wc -l web/typescript/MapStudio.tsx` -- expected: under 800.

**Results (implementer, 2026-11-04, the cloud container, Ignition 8.3.10, compose project `ms-2a5e1993` on port 9088, fresh volumes, the only stack on the box):**
- `cd web && npx tsc --noEmit && npx jest`: no type error; 36 suites, 305 tests pass (the baseline's 35 suites and 290 tests, plus `studio.test.ts` with 15).
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build`: BUILD SUCCESSFUL in 2m 23s with every Java test and the Jest run (36 suites, 305 tests); `build/Map-Studio.unsigned.modl` 1,971,678 bytes. The first two attempts failed before any compile on HTTP 429 from the agent proxy (too many dependency downloads at once on the container's first fetch of Gradle 9.8 and the plugins, `/root/.ccr/README.md` "429 / 503 from the proxy"); the third, run with `--max-workers=2`, passed, and later builds download nothing.
- Bundle bytes, `webpack --mode production` at the baseline and after: `MapStudio.js` 1,352,177 then 1,351,289 (888 bytes fewer, -0.066 percent); `MapStudio.css` 108,962 both times (identical). Within 2 percent.
- `ops/up.sh` (Docker started by hand as the environment note says; both images pulled first), then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test`: 125 tests, 118 passed, 7 skipped, 0 failed, in 28.1 minutes; no edit under `e2e/`, no tracked file changed by the run. The suite's own bundle measure read the served `MapStudio.js` as 1,351,289 bytes and `MapStudio.css` as 108,962, the build's bytes.
- `bash scripts/ci/check-contract-versions.sh`: OK (contract 0.3.0, setup schema 1, map store schema 2).
- `git diff --stat 4d75bd6 -- e2e common gateway docs/contract.md web/typescript/mapstudio.css common/src/main/resources/mapstudio.props.json`: empty.
- `wc -l web/typescript/MapStudio.tsx`: 777; the delegate is `MapStudioStoreDelegate.ts` (583 lines). The other modules: `selection.tsx` 684, `mapLayers.ts` 629, `camera.ts` 404, `itemsLayer.ts` 326, `editing.ts` 136, `basemapLayer.ts` 128, `viewControls.ts` 107, `studio.ts` 92.
- No em dash in any changed file; no model identifier in a file or a commit message outside the trailer.
- The browser criterion (a viewer opens the dev map, an editor opens `/edit`, draws a line and presses Esc, a popup opens and closes, the attributes and the hook read as before) is covered by the suite on the refactored bundle: `tracer.spec.mjs` (the View page with no echo and no tool; `/edit`, the round trip, a drawn line), `popup.spec.mjs` (Esc closes the card and returns the focus, item 14; the 390 px sheet), `basemaps.spec.mjs` (the View-mode controls, no Draw a line), `linepopup.spec.mjs`, `search.spec.mjs`, `needsyou.spec.mjs`, `review.spec.mjs` (the theme re-read, item 29), and every spec's `send` through `window.__mapStudioTest`.
- Not verified: a person in a browser (the suite's assertions stand in, as the plan's route allows); `toggleSelect` of the model has no caller yet (unit tested only).
- The dev stack is left running for the review (`ops/down.sh` stops it).
