---
title: "Tracer: Edit mode's docked studio, one pad added, linked, undone and seen by the page"
type: 'feature'
ticket: '2'
created: '2026-11-04'
status: 'draft'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'high'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/handoff-epic-4.md', '{project-root}/docs/contract.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Edit mode today is the spike's Draw a line button over the plain map. Epic 4's studio (rail, item list, properties panel, draw toolbar, undo, save status) and its page contract (props the component writes, component events) have never been proved on this module, so the first slice must cut through every layer: the Perspective SDK claims, the contract bump, the write path, the undo stack and the docked layout.

**Approach:** The thinnest Edit mode that adds one pad, links it, undoes it and tells the page. First a live check of three SDK claims on the dev 8.3 Gateway, recorded. Then: the Edit switch for level `full` and a bidirectional `editMode`; the rail with Items live and Kinds and Layers as empty surfaces; one flat item list with live state badges; the Details tab with name, kind, location and the asset picker, each field saving when finished; a Point tool (click to place, drag to fine-tune); Undo and Redo naming the step over one undo stack per session; the save status; `selectedItem` written by the component and `onItemSelected` fired; contract 0.4.0. Every later studio story extends a module this one creates.

## Boundaries & Constraints

**Always:** Saves go through `edits.apply` batches on the existing sender and queue (AD-2, AD-10); the Gateway is called when an edit is finished, never per click or drag frame. Role from `map.load.reply.level`: no switch, no tools and no prop write for `phone` or `none`. The model in `studio.ts` is the one truth for mode, tool and selection; every write goes through `drawingState` and `selectionState`. View mode draws and behaves exactly as 0.3.0 (the whole e2e suite stays green with no edit to an existing test's expectation except where the Edit page's status line moved). Colours from theme tokens only; the bottom-right corner stays clear; no em dashes. The three SDK checks are recorded in `docs/platform-checks.md` before anything builds on them. Commit at each milestone with the configured git identity and the two trailer lines the session's attribution reminder gives.

**Never:** Lines, areas, snapping, kind buttons, the Style tab, the Kinds screen's content, the first-run checklist, multi-select, Recent changes, the conflict card or banners (later entries). A change to the Gateway's write service, the map store or any message type. The page writing `selectedItem` or the `viewport` prop and the other events (entry 14). Phone widths (below 768 px keep View mode). A dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Viewer | level `none` or `phone`, `editMode` true | View mode, no switch, no studio; the prop left as written | No error expected |
| Prop off | level `full`, the page writes `editMode` false | View mode, the studio gone, the tool put down, the selection kept | No error expected |
| Own write back | the component wrote `selectedItem` or `editMode` and the prop change comes back | Nothing re-enters the model when the prop already matches it | No error expected |
| Add a pad | the Point tool, one click | A create batch saves at once as the kind list's first point kind with that kind's name as placeholder; Details opens with Name focused; the pill reads "Add a well pad - click the map, then drag to fine-tune" | A refused save shows the save status with the reason |
| Fine-tune | the new pin dragged, or not | One update batch per drag end with the new geometry; no drag, no batch | No error expected |
| Undo | Undo pressed after the link, the name, the add | One saved edit per press, last first: the link, then the name, then the pad, each a reverse batch and each named on the button ("Undo: link P31", "Undo: rename P31", "Undo: add Well pad"); Redo replays in order | A reverse refused `conflict` names who changed it in the save status |

</frozen-after-approval>

## Code Map

- `common/.../MapStudioComponent.java` -- the descriptor builder; add `.setEvents(List.of(new ComponentEventDescriptor(name, description, MapStudioModule.schema("/mapstudio.events.json"))))` beside `.setSchema` (both in perspective-common 3.3.0).
- `common/src/main/resources/mapstudio.props.json` -- the closed prop list: `editMode` reworded bidirectional, `selectedItem` (string or null) added; new `mapstudio.events.json` for the event payload.
- Contract 0.4.0 places `scripts/ci/check-contract-versions.sh` compares: `CONTRACT_VERSION` in `common/.../Messages.java` and `web/typescript/contract.ts`, the first lines of `docs/contract.md`, `docs/kinds-and-assets.md`, `docs/kind-setup.md`, the comment line of `docs/examples/adapters/*.py`, `## 0.4.0` in `CHANGELOG.md`.
- `web/typescript/MapStudio.tsx` -- `getPropsReducer` (add `selectedItem`), `state.studio`, `drawingState(prev, state)`, `selectionState(prev, selected)`, `render` (`div.mapstudio` with `.mapstudio-map`; the rail, list and panel mount beside it in a flex row, the map last). Prop write: `this.props.store.props.write(path, value)`; event: `this.props.store.componentEvents.fireComponentEvent(name, object)` (perspective-client 2.3.10 typings).
- `web/typescript/studio.ts` -- the model; `StudioTool` gains `'point'`.
- `web/typescript/selection.tsx` -- `SelectionHost`, `openPopup`, `selectLine`, `clearSelection`, `publishSelection` (every selection path ends here: the prop write and the event go in it); `popupPoint` builds the AD-7 object's inputs.
- `web/typescript/editing.ts` -- `startTerraDraw` (line mode only), `toggleDrawing`, `onDrawFinish`, `setDrawState`; terra-draw 1.38.0 has `TerraDrawPointMode` (`editable` drags a point) and `TerraDrawSelectMode`. `DrawControl.tsx` is the spike's toggle the toolbar replaces.
- `web/typescript/MapStudioStoreDelegate.ts` -- `sendLineCreate` is the pattern (`newId()`, a batch from `save.ts`, `save = {saving, itemId}`, `sender.enqueueAndSend`; `onSave` sets `saved` or `refused`): generalise to `sendBatch(batch, itemId, label)`. State: `level`, `lists.assets` (`{id, name, kind, basePath}`, level `phone` or `full` only), `lists.kinds`, `items`, `save`.
- `web/typescript/undo.ts` `reverseBatch(batchId, before, batch, results)` -- needs the pre-edit record of every update or delete; no stack exists yet (new `undoStack.ts`, pure, tested).
- `web/typescript/save.ts` `SaveState`, `saveStatusText`; `render`'s `.mapstudio-save-status` -- reuse in the panel header.
- `web/typescript/ZoomControl.ts`, `viewControls.ts` -- the `IControl` pattern for the Edit switch top-right above the zoom card; `mapstudio.css` tokens on `.mapstudio` (lines 5 to 7, 99 to 113), `.mapstudio-ctrl-button` (151 to 190).
- `ux-map-studio/mockups/key-screen-4-edit-items.png`, `editor-direction-a-1366.png` -- the layout; EXPERIENCE.md Component Patterns (rail, list, row, panel, switch, save status, undo, pill) and DESIGN.md Components and Layout & Spacing (the widths at 1366 and 1440).
- `ops/project/com.inductiveautomation.perspective/views/MapStudioEdit/view.json` -- the `/edit` page; labels bind with `propConfig["props.text"].binding {type: 'expr'}`, buttons carry `events.component.onActionPerformed` scripts.
- `e2e/tests/fixtures.mjs` (`openMap`, `editorTest` as `mapeditor`, `send`), `e2e/tests/tracer.spec.mjs` (the `/edit` round trip) -- the pattern for `studio.spec.mjs`; `docs/platform-checks.md` gets "Epic 4 entry 2".

## Tasks & Acceptance

**Execution:**
- [ ] `docs/platform-checks.md` -- first, the live check on the dev Gateway: an event declared with `setEvents` reaches a Perspective event script on `/edit`; `props.write` of `selectedItem` reaches a label bound to it; whether `ClientStore.location` (the session's geolocation) is reachable from a component -- the SDK claims recorded before the rest builds on them (hitl: the owner sees the page run).
- [ ] `common/...MapStudioComponent.java`, `mapstudio.props.json`, `mapstudio.events.json`, `Messages.java`, `contract.ts`, the docs and CHANGELOG lines above -- `editMode` bidirectional, `selectedItem`, `onItemSelected` declared, contract 0.4.0 -- the version check passes.
- [ ] `web/typescript/studio.ts` -- the `'point'` tool -- the model names the tracer's tool.
- [ ] `web/typescript/undoStack.ts` + `__tests__/undoStack.test.ts` -- pure stack of saved batches with their `before` records, undo and redo cursors and a label per step ("Undo: add Well pad", "Undo: move P31", "Undo: rename P31", "Undo: link P31"); one step per saved edit, nothing grouped (owner, 2026-11-04) -- one undo model for the epic.
- [ ] `web/typescript/MapStudioStoreDelegate.ts` -- `sendBatch(batch, itemId, label)` generalising `sendLineCreate`; on `saved` the stack gains the entry; a reverse batch is sent the same way -- every tool and undo share one send.
- [ ] `web/typescript/EditSwitch.ts` -- the top-right switch (DESIGN.md editing-switch: eye glyph and "Edit map" off, kinds glyph and "Editing" on) shown at level `full`, writing `editMode` and entering or leaving the model -- the way in.
- [ ] `web/typescript/studio/Rail.tsx`, `ItemList.tsx`, `PropertiesPanel.tsx`, `DrawToolbar.tsx` (the component decides the folder; keep the header-comment pattern) -- the docked layout (rail, list, panel, map) at 1366 and 1440 px, the panel header with the map name, Undo, Redo and the save status, the flat list with live badges from the batch, Details with name, kind (read-only text in this slice), location (latitude and longitude, typed) and the asset picker (the kind's assets, Unlink), the floating toolbar with Select and Point and the mode pill, which names the kind ("Add a well pad - click the map, then drag to fine-tune") -- the studio's skeleton.
- [ ] `web/typescript/editing.ts` -- `TerraDrawPointMode` with `editable` for the fine-tune drag beside the line mode; a placed point saves at once as the kind list's first point kind with that kind's name as its placeholder name (the kind picker is entry 4's), a drag end saves an update; the tool stays in hand until Esc or Select -- the first drawing tool with no drag needed.
- [ ] `web/typescript/selection.tsx`, `MapStudio.tsx` -- `selectedItem` written and `onItemSelected` fired on every selection change (the AD-7 object from `popupPoint` and the item's record; null when cleared); `editMode` prop changes after mount enter or leave the model; `componentDidUpdate` reads both and does nothing when the prop already matches the model, so the component's own write coming back never re-enters it -- the page sees the selection.
- [ ] `ops/project/.../MapStudioEdit/view.json` -- the two labels and the event script -- the SDK check and the e2e read.
- [ ] `e2e/tests/studio.spec.mjs` -- the matrix rows at 1366 px as `mapeditor` and as a viewer; `tracer.spec.mjs` updated only where the status line moved.

**Acceptance Criteria:**
- Given the dev Gateway as `mapeditor` at 1366 px, when the Edit switch is turned on, then the rail, the list and the map show, `data-editing` reads on, and the `/edit` label bound to `editMode` reads true; turned off, View mode is back and the label reads false.
- Given a viewer, when the page loads with `editMode` true, then no switch and no studio render and the prop is left as written.
- Given Edit mode, when the Point tool places a pad by one click, its name is typed and an asset chosen, then three batches save (`map.changed` in a second browser within a few seconds) and the pad's icon shows the kind setup's live values after the next batch.
- Given those three saves, when Undo is pressed three times, then the link, the name and the pad go in that order with each reverse batch saved, the button naming each step, and Redo brings the pad back.
- Given a selection by a row, a marker click and a ground tap, when the `/edit` page's labels are read, then `selectedItem` and the `onItemSelected` script's label follow each change and read empty after the tap.
- Given `docs/platform-checks.md`, when the "Epic 4 entry 2" section is read, then the three SDK checks carry a live verdict with the Gateway version.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

The studio surfaces are React components rendered by `MapStudio.render` beside the map, reading `state.studio` and `this.props.delegate` and calling the component's thin methods (`openPopup`, `clearSelection`, `drawingState`, the delegate's `sendBatch`); the map's `IControl`s stay MapLibre controls. The prop write and the event sit in `publishSelection`, which every selection path already reaches, so a later story (entry 14) only adds the page-to-component direction. The undo stack keeps `before` records taken from `delegate.items` at send time, so `reverseBatch` has what it needs without a new message. Settled with the owner in the room on 2026-11-04: a click saves the point at once (FR-29, every finished edit saves) and a fine-tune drag, when there is one, saves an update; undo is one step per saved edit, last first, with no grouping of a new item's edits; this slice's Point tool takes the kind list's first point kind, named in the pill, since the kind buttons and the form's kind pick are entry 4's; the plan stays whole, the page contract proved here.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean; every suite green including `undoStack.test.ts`.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build` -- expected: BUILD SUCCESSFUL (the Java tests cover the descriptor's events and the props schema).
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0.
- `ops/up.sh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: the whole suite green with `studio.spec.mjs` (the review 390 px flake of deferred-work.md may fail once; rerun it alone).

**Manual checks (if no CLI):**
- The owner opens `/edit` on the dev stack as `mapeditor`, adds a pad, links it, undoes it, and sees the `/edit` labels follow the selection; the three checks in `docs/platform-checks.md` match what the page shows.
