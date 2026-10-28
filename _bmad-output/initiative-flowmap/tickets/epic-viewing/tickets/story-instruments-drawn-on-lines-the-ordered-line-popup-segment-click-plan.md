---
title: 'Instruments drawn on lines, the ordered line popup, segment click and the aggregate line style'
type: 'feature'
ticket: '2'
created: '2026-10-28'
status: 'built'
baseline_revision: '3dd7a8e'
route: 'full'
route_source: 'pinned'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/handoff-epic-3.md'
  - '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md'
  - '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/review-popup-and-marker-info.md'
  - '{project-root}/docs/contract.md'
  - '{project-root}/docs/kind-setup.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** An instrument's attachment is stored and kept on its line (epic 2 entry 14) but nothing draws it: a tap is a free marker, a line is one stroke whatever sits on it, a click on a line only selects it, and a line kind's `{instruments: "worst"}` style rule is accepted and then ignored (R13; AD-7, AD-11, AD-16, AD-19).

**Approach:** Draw each instrument as its kind's marker at its place on its line; split every line that carries instruments into display segments between its measuring instruments; open a line's default popup on a click, at the clicked segment, listing the instruments in order between the items the line's ends snap to with live values and distance, then the line's own KPIs and alarm state, the two end instruments of the open segment highlighted on the map and in the list; push every attached instrument's values while it is open; and work the `{instruments: "worst"}` look out on the Gateway in the shared cache as a `segments` slot of the line's batch item (the worst of the instruments at each segment's ends, dashed when either is stale, the alarm winning), so the map draws each segment as the Gateway says. Seed an L-SWD-like dev line with taps, a line valve, their kinds, kind setups, assets and memory tags so the verify line runs end to end.

## Decisions (recorded for the owner, 2026-10-28; the session is unattended)

1. **Segment ends are the measuring instruments.** A line's nodes, in order, are the item its start snaps to (or the floating start), each attached instrument whose kind setup has an icon KPI, and the item its end snaps to (or the floating end); a segment runs between two consecutive nodes. An instrument whose setup has no icon KPI (a line valve) is listed in the popup at its place and drawn on the line, but bounds no segment: the key-screen-3 mockups show LV-1 at 2.0 km inside the segment "PT-1 to PT-2", and the ticket's verify line reads the same way. The Gateway and the browser apply the same rule (`KindDisplay`: a KPI with `icon` and `on`).
2. **The `segments` slot.** A line with instruments and an `{instruments: "worst"}` rule (the kind's, or the item's own override) carries `segments: [{from, to, preset, stale, reason, alarm}]` in its batch item, one per segment, `from` and `to` the node ids (`start` or `end` for a floating end): `stale` when either end instrument is stale (comms lost, a stale rule source, or no value in its icon KPI), with the first stale instrument named in `reason` ("PT-1: comms lost"); else `preset` the worse of the two instruments' presets in the order fault, warning, attention, normal (dimmed counts as normal; a snapped end item is not an instrument and counts for nothing); `alarm` the worse active alarm of the two end instruments (priority 1 first, unacknowledged first) or null. The line's own `style` slot is the worst over its segments, so the chip at the midpoint says "Stale" or the preset word. Lines without instruments, and lines whose rule is not the instruments source, carry no `segments` (their whole line keeps entry 7's look). The look is read on the Gateway at each batch build, never per session.
3. **The browser splits the geometry, the Gateway grades it.** Segments are cut from the line's coordinates at the measuring instruments' `distanceM` (AD-19: derived, never stored) into one feature each, carrying `from`, `to` and the look the Gateway's `segments` slot gives (matched by `from` and `to`; a segment the batch does not name draws the line's own look). A click on a line therefore lands on a segment feature, whose `from` and `to` are the `popup.open {itemId, segment: {fromId, toId}}` body; the Gateway accepts the optional `segment` (two non-empty strings, else `invalid`) and pushes the line and every instrument attached to it while the popup is open.
4. **The line popup.** Built to the UX review's padding rules (D1 to D3: 350 px wide, 16 px side padding, header `12px 12px 8px 16px`, 32 px icon buttons and 44 px below 768 px, `max-height: min(480px, map - 64px)` with the body scrolling, the tip in the card surface, the floating shadow) so entry 8 need not redo it; the point popup keeps its 0.3.0 look until entry 8. Header: pipeline glyph in a disc, name, subline (kind, diameter, length), the page link slot, a close button in the header (MapLibre's own close button is hidden for this popup). Then the segment box when a segment is open ("Segment PT-1 to PT-2", "1.1 to 2.8 km", the values line "398 to 371 psi - drop 27 psi over 1.7 km" when both ends carry a number in one unit, or the stale glyph and "Stale - drawn dashed until PT-2 updates"), Comms ("OK - 4 instruments, oldest 9 s ago" or "PT-2 stale - last 18 min ago"; the line's own comms row only where its setup turns comms on), "Instruments, CTB1 to SWD1" with one row per node in order (a snapped end as "CTB1 outlet" and "SWD1 inlet" with a filled square, an instrument with its kind glyph, the distance in tiny type, the value right-aligned: the icon KPI, "No value", or the stale glyph and "Stale - 371 psi (last)", an active alarm's glyph and digit), the open segment's two instruments highlighted (`selection-tint`, a 3 px inset `selection` edge), then the line's own KPIs and its alarm block where its setup turns alarms on. Closing the popup clears the line's selection, as it does a point's.
5. **Instrument markers.** An instrument draws as its kind's marker with a 24 px disc (DESIGN.md instrument-marker) in the same image box and anchor, its name below at 11 px, the chip and the KPI as any point; the marker image id gains an eighth element (`instrument`). The two instruments at the open segment's ends take the selection ring. Instruments join the 20 m shared-marker sweep like any point. An instrument's alarm badge and digit draw in its own marker at its place; the line's own alarm keeps the midpoint badge and colours the whole line over any segment look.
6. **The map item object.** `mapItem` of a custom popup view (the spike's `popupView` prop today; entry 8's kind-setup view) gains, for a line, `instruments: [{id, name, kind, distanceM, liveValues}]` in order and the open `segment {fromId, toId}` (AD-7).
7. **Dev seed.** Kinds `valve` (Line valve, icon `line-valve`, instrument), beside `tap`; assets `CTB1` and `SWD1` (pad kind, Pad UDT instances), `PT1` and `PT2` (tap, a new `Tap` UDT: Pressure with the dev-only alarm "High pressure" above 900, Comms, a `Status` for nothing), `LV1` (valve, a `Valve` UDT: Position, Comms), `LSWD` (line, Flow). The seed adds `CTB1` and `SWD1` (pads at the line's ends, linked), `L-SWD` (line, diameter 6, linked to `LSWD`, `ends` snapped to both, an override `styleRule {source: {instruments: "worst"}}` since the line kind's own rule stays entry 1's Bands rule), `PT-1` at 1,143.0 m, `LV-1` at 2,000.0 m and `PT-2` at 2,841.0 m of a 2,922 m line south-west of the geofences; the tap setup (comms, KPI pressure as the icon value, alarms, a Bands rule on pressure: below 450 normal, 450 to 600 attention, 600 and above fault) and the valve setup (comms, KPI position); 74 items and five kind setups. The `/live` page gains buttons: `swd-quiet` (PT-1 398, PT-2 371, LV-1 100, comms on, acknowledged), `pt1-comms-off`, `pt1-comms-on`, `pt2-pressure-500`, `pt2-pressure-950`, `pt2-pressure-371`, `pt2-ack`. A fresh volume once (`ops/up.sh --fresh`).
8. **Phone.** At 390 px the line popup is the same card at `calc(100vw - 32px)` (358 px) with 44 px header buttons; the bottom sheet is entry 8's.
9. **No subagents.** The session has no subagent tool: this agent implements from the plan and runs the quick review lens itself.

## Boundaries & Constraints

**Always:** the segment look worked out on the Gateway once per line per batch build, never per session, from values already in the shared subscription (no new tag path); one subscription per path; every colour a theme token with a Perspective fallback, never a literal; every state said with a word or glyph; no tag path and no expression text in a batch; the popup's words plain; contract 0.3.0 (unreleased) with `docs/contract.md` and `docs/kind-setup.md` updated and `check-contract-versions.sh` green; Jython 2.7 rules in the seed, `mapstudio_live` and the view scripts (no `import system`, both exception types caught, no credentials); no em dash; `README.md` untouched.

**Never:** the alarm summary in words and the View alarms button, the page link filled, the custom popup view by kind setup, the bottom sheet (entry 8); an instrument tool, snapping UI or any editing (epic-editing); the legend (entry 3); the hue review (entry 12); a change to `ign-scada-template`; a write to any Gateway but the local dev stack; a `.modl` or scratch file committed.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Nodes | L-SWD ends snapped to CTB1 and SWD1; PT-1 1,143 m, LV-1 2,000 m (no icon KPI), PT-2 2,841 m | nodes CTB1, PT-1, PT-2, SWD1; segments CTB1 to PT-1, PT-1 to PT-2, PT-2 to SWD1; LV-1 listed between PT-1 and PT-2 | a floating end is `start` or `end` |
| Segments slot | PT-1 398 (normal), PT-2 500 (attention) | `[{normal}, {attention}, {attention}]`, the line's `style` attention | none |
| Stale | PT-1 comms false | CTB1 to PT-1 and PT-1 to PT-2 `stale` with reason "PT-1: comms lost", PT-2 to SWD1 normal; the line's `style` normal, stale | none |
| Alarm | PT-2 950 (the dev alarm, priority 1) | PT-1 to PT-2 and PT-2 to SWD1 `alarm {priority 1, unacked}` and `fault`; the map draws the alarm hue over both, the badge and digit in PT-2's marker | none |
| Line alarm | the line's own alarms slot active | every segment in the line's alarm hue, the badge at the midpoint | none |
| No instruments | a scale-set line | no `segments`, no split, entry 7's look | none |
| Other rule | a line with instruments and a Bands rule | no `segments`; every segment draws the line's own look; the click still names the segment | none |
| Click | between PT-1 and LV-1 | `popup.open {itemId: L-SWD, segment: {fromId: PT-1, toId: PT-2}}`; the popup at "Segment PT-1 to PT-2"; PT-1 and PT-2 highlighted on the map and in the list | a malformed `segment` is `invalid` |
| Push | the popup open, PT-2's pressure changes | PT-2's row within 250 ms (plus the round trip) | none |
| Close | the header close button, the ground | `popup.close`, the selection and the highlight go | none |
| Map item object | the spike's `popupView` on a line | `mapItem.instruments` in order, `mapItem.segment` | none |
| Phone | 390 px | the card inside the viewport, 44 px header buttons | none |

</frozen-after-approval>

## Code Map

- `common/.../contract/KindDisplay.java` -- `measures()` (an icon KPI that is on): the one rule both sides use.
- `gateway/.../live/ValuePlan.java` -- an instruments rule kept as the item's `Style` (no slot); the plan gains `instrumentsByLine` (ordered `{id, distanceM, measures}` of every live attached instrument) and `ends` per line; a line with an instruments rule is planned even with no slot.
- `gateway/.../live/LiveValueCache.java` -- `segments` in `itemJson` for such a line (`Segments.java`, pure: nodes, the worst of two, the line's own style from them); `popupItems` (the item and its attached instruments) and `itemsBatch`.
- `gateway/.../live/LiveSession.java` -- `popupOpen` listens to the item and its instruments and pushes them together.
- `gateway/.../MapStudioDelegate.java` -- the optional `segment` of `popup.open`.
- `web/typescript/live.ts` -- `SegmentSlot`, `ItemValues.segments`, `displayMeasures`; `features.ts` -- the nodes, the split, the per-segment properties, the highlight; `markers.ts` -- the instrument disc, `segmentLook`; `messages.ts` -- `popupOpen(itemId, segment)`; `popupParams.ts` -- the map item object; `LinePopup.tsx` (new); `MapStudio.tsx` -- the line click, the line popup, `data-segment`, `data-highlighted`, `data-segments`; `mapstudio.css` -- the card rules.
- `ops/` -- the UDTs and instances, the dev adapter's kinds and assets, the seed, `mapstudio_live`, the `/live` buttons.
- `e2e/tests/linepopup.spec.mjs` (new); `labels.spec.mjs`, `adapters.spec.mjs`, `icons.spec.mjs`, `scale.spec.mjs`, `tags.spec.mjs` (counts).
- `docs/instruments.md` (new), `docs/contract.md`, `docs/kind-setup.md`, `docs/map-parity.md`, `CHANGELOG.md`, `docs/platform-checks.md`, this plan.

## Tasks & Acceptance

**Execution:**
- [x] `common/`, `gateway/` -- the segments slot, the popup push of the instruments, the `segment` body, tests.
- [x] `web/` -- the split, the instrument marker, the line popup, the map item object, tests.
- [x] `ops/` -- the UDTs, kinds, assets, the seed, the buttons.
- [x] `e2e/tests/linepopup.spec.mjs` and the counts in the other specs.
- [x] docs, CHANGELOG, platform checks, this plan.

**Acceptance Criteria:**
- Given the seeded L-SWD, then PT-1, LV-1 and PT-2 draw at their places on the line and the line is split at PT-1 and PT-2.
- Given a click between PT-1 and PT-2, then the line popup opens at "Segment PT-1 to PT-2" listing CTB1 outlet, PT-1, LV-1, PT-2, SWD1 inlet with live values, PT-1 and PT-2 highlighted, and PT-2's row follows its tag while open.
- Given PT-1 comms lost, then CTB1 to PT-1 and PT-1 to PT-2 dash and nothing else; given PT-2 at 500, then PT-1 to PT-2 and PT-2 to SWD1 show attention and nothing else; given PT-2 at 950, then the alarm draws over both and in PT-2's marker.
- Given 390 px, then the popup stays inside the viewport.
- Given the hand-off's checks, then every one passes.

## Implementation Notes

Built 2026-10-28 over four sessions of one agent (a container restart stopped the first after the Gateway and browser commits, the second while it iterated on the e2e spec against its stack, and the third after the two spec fixes; each later session resumed from the worktree's commits).

- **Gateway** (`1cda202`): `KindDisplay.iconKpi()` and `measures()`; `ValuePlan` keeps each line's ordered instruments (`{id, distanceM, measures}`) and snapped ends and plans a line with an instruments rule even with no slot of its own; `Segments` (pure: nodes, the worst of two grades, the line's own style from its segments); `LiveValueCache.itemJson` adds `segments` and regrades a line when one of its instruments changes; `popupItems` (the line and its instruments) and `itemsBatch`; `LiveSession.popupOpen` follows every item of the set; `MapStudioDelegate` accepts `popup.open`'s optional `segment` (two non-empty strings, else `invalid`). `InstrumentsLiveTest` (seven tests) and a delegate test.
- **Browser** (`5c7ff69`): `live.ts` (`SegmentSlot`, `readSegmentSlot`, `iconKpiOf`, `segmentState`); `features.ts` (`lineNodes`, `segmentNodes`, `segmentAt`, `splitAt`, one feature per segment with `from`, `to` and the graded look, the highlighted ends); `markers.ts` (the 24 px instrument disc, the eighth image id element, `segmentLook`); `linePopup.ts` (the words: subline, rows, distances, the segment box, the comms line, `popupNodes`, `popupInstruments`); `LinePopup.tsx`; `MapStudio.tsx` (the line click opens the popup at the clicked segment, `popup.open {itemId, segment}`, the selection with its segment, the map item object with `instruments` and `segment`, the test attributes `data-segments`, `data-segment`, `data-highlighted`); `mapstudio.css` (the card to the review's D1 to D3). Jest: `linePopup.test.ts`, `segments.test.ts` and the updated marker and message tests.
- **Seed and dev stack** (`63470d8`): the `Tap` and `Valve` UDTs and the instances `CTB1`, `SWD1`, `PT1`, `PT2`, `LV1` and `Lines/LSWD` in `ops/config/core` (a fresh volume once); the `valve` kind and six assets in `mapstudio_dev`; the `swd` seed set (74 items, five kind setups, `ends` and `attachment` now seed fields compared and put back on a re-run); `mapstudio_live` accepts the SWD devices (`set_position`, `swd_quiet`, `swd_status`); the seven `/live` buttons; the seed harness, `scale.spec`, `adapters.spec`, `icons.spec` and `tags.spec` counts.
- **Placement** (this session, after the first live run at 390 px): the `/live` page's button toolbar wraps on a phone and leaves the map 471 px tall, and MapLibre anchors a popup below its point unless the point is lower than the card is tall, so the 460 px card ran 230 px past the viewport. `popupParams.linePopupPlacement` now picks the side (above when the card fits there, the review's preferred side; else below; else the side with more room) and clamps the card's max-height to the chosen room, 480 px or the map less 64 px (P3), and `showPopupAt` applies it for the line popup only (the card measured with the clamp lifted, then the token set on the popup content and MapLibre's anchor set before `setLngLat` places it again); a point's popup keeps MapLibre's anchoring. `.mapstudio .maplibregl-popup` takes `z-index: 3`, above the map's controls (the Legend button drew over the card). Unit tests in `popupParams.test.ts`.
- **The fourth session's fixes** (after the restart, `f92ac11`, `f8d2dbe`): the first line popup of a page opened above its segment and off the map's top because a popup's card measures 0 px tall until the popup's element is in the document (MapLibre hangs the content on the popup's container, which `addTo` appends to the map), so `showPopupAt` now adds the popup to the map before it measures the card and places it again with the anchor chosen; the spec's view centres assumed 256 px tiles where MapLibre's Web Mercator uses 512 (the desktop click landed 114 px above the page) and now put the click 300 px above the centre at zoom 14 and 115 px at zoom 15; the e2e test hook may send `popup.open`, so the spec sees a malformed `segment` refused `invalid` with the Gateway's words (the contract's text for it now matches the Gateway: "popup.open's segment needs fromId and toId."). `docs/platform-checks.md` gained "Epic 3 entry 2".
- **Decisions taken while building**: the valve setup's KPI is Position in `%` with `icon: false`, so LV-1 bounds no segment and reads "No value" in the list as the mockups show; `distanceText` gives "2 km" for 2,000 m (one decimal, trailing zero dropped), where the mockup writes "2.0 km"; the instruments comms line counts instruments (3 on L-SWD), where the mockup's "4 instruments" counted a pad; the dev tag browse order in `tags.spec` is case-insensitive (`CTB1, Lines, LV1, P12, ...`).

## Plan Change Log

- 2026-10-28: the phone placement rule above (a plan-level addition to decision 4: the card's height follows the room on the chosen side; decision 8 unchanged otherwise).

## Review Triage Log

## Design Notes

**Why the Gateway sends segments and the browser cuts geometry.** AD-19 says segments are derived in the browser from the attachments; AD-16 and the owner (2026-10-28) say the aggregate look is worked out where style rules are. Sending the look per segment, keyed by its two node ids, keeps both: no geometry on the Gateway, no rule engine in the browser, and the icon, the line and the popup agree.

## Verification

**Commands:**
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` (with the scratch init script) -- expected: BUILD SUCCESSFUL.
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean, all tests pass.
- `ops/up.sh --fresh --no-build` with the module staged by hand, then `cd e2e && npm ci && E2E_DOCS=1 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: every spec passes, `linepopup.spec.mjs` included.
- `bash scripts/ci/check-contract-versions.sh` and `bash scripts/ci/test-contract-versions.sh` -- expected: OK.
- `grep -rnP '\xE2\x80\x94'` on every changed file -- expected: no match.

**Manual checks:**
- `docs/screenshots/mapstudio-line-popup-1440.png` and `-stale-1440.png` against `ux-map-studio/mockups/key-screen-3-line-instruments-live.png` and `-stale.png`; `mapstudio-line-popup-390.png` inside the phone.

**Results (2026-10-28, the fourth session, the final run on a fresh stack):** see the Results section below.

## Results

RESULTS_PLACEHOLDER
