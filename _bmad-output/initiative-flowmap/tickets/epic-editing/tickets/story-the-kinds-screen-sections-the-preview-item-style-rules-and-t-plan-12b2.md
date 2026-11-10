---
title: "12b2: the preview item on the map and the Live now note"
type: 'feature'
ticket: ''
part_of: '12'
created: '2026-11-10'
status: 'draft'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'high'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A kind's setup names a preview item, but nothing on the map says which item it is, and section 6 does not say what the rule makes that item show now, nor that its alarm wins over the rule (EXPERIENCE.md, Kind setup).

**Approach:** While a kind's setup is open, its preview item carries a "Preview" word on the map, a "Show on map" button beside the Preview item select goes to it, and a note box at the foot of section 6 says what it shows now, from what the Gateway already sends.

Decisions (owner, 2026-11-10, "go with recommended"): option A, slim: no TypeScript port of the rule and no drawing from an unsaved draft. Since 12b1 a rule saves as soon as it is whole and the Gateway draws it at the next live update, so the port would cover only that gap; this replaces the 2026-11-09 decision that States and Bands preview through a port. (1) The chip reads "Preview"; an item that is Stale or Comms lost keeps that word. (2) The map never moves on its own; "Show on map" does it. (3) A preview item with its own style rule gets a note saying the kind's rule does not draw on it and to choose another. (4) An area kind has no map preview; the note says an area draws its tint, not a preset.

## Boundaries & Constraints

**Always:** Browser only: no Gateway, `common/` or contract version change. **The word:** only in Edit mode with Kinds open and a kind chosen, on that kind's preview item: a point's chip reads "Preview" in place of its state word (the ring, the badge and the preset drawn as ever), a line's label reads its name and "Preview"; Stale and Comms lost keep their own word; an item sharing its marker with others keeps the group's chip. It is gone when Kinds closes, the kind or the preview item changes, or Editing goes off, at the next draw. **Show on map:** beside the select, moves as Details' "Zoom to location" does and nothing else moves the map; off with its reason when there is no preview item. **The line under the select** says both things the preview item does today: each tag path is checked for its asset, and it carries the Preview word on the map. **The note box** (DESIGN.md's note box, last in section 6, a live region that is polite): "Live now: <name> is <state word>." from the item's live state; with an active alarm ", but its priority N alarm wins over the rule."; Stale or Comms lost: that it shows only as that until a fresh value comes; no rule: that it draws as Normal; "Not saved yet": that the map shows the stored rule until this one is whole; its own rule (decision 3); an area kind (decision 4); no preview item: that the kind has no item to show it on. It follows each live update with no reload. Keyboard, 24 px targets, tokens only, no em dashes.

**Never:** Working a rule out in the browser; drawing an unsaved draft; marking which case row holds the value; moving the map without the button; a new token or chip look; the Style tab and overrides (12c).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| P1 Open | Kinds, Well pad, preview item CTB1 | CTB1's chip reads "Preview"; the note says what it is now | No error expected |
| P2 Another item | Preview item changed to P12 | The word moves to P12; the note follows | No error expected |
| P3 Value changes | P12's Status driven to a case | The note names the new state at the next live update | No error expected |
| P4 Alarm | P12's alarm raised | The note adds that its alarm wins over the rule | No error expected |
| P5 Comms lost | P12's comms off | The chip reads "Comms lost"; the note says it shows only as that | No error expected |
| P6 Own rule | Preview item Point 2 | The note says it has its own rule and to choose another | No error expected |
| P7 Area kind | Geofence | No word on the map; the note says an area draws its tint | No error expected |
| P8 Line kind | Gathering line | The line's label reads its name and "Preview" | No error expected |
| P9 Leave | Kind changed, Kinds closed, Editing off | The word gone each time | No error expected |
| P10 Show on map | The button pressed | The map goes to the item; before it, the map had not moved | Off with its reason with no preview item |
| P11 Not saved yet | A half-built rule | The note says the map shows the stored rule | No error expected |

</frozen-after-approval>

## Code Map

- `web/typescript/studio/KindSetupPanel.tsx` -- props :64-92 (`previewId`, `onPreview`; no live data yet: add the preview item's state and a show-on-map callback), `preview()` :225, the line under the select :1562, section 6's foot, `ruleNow` :946 and `checkRule` for "Not saved yet".
- `web/typescript/kindSetup.ts` -- `previewOptions`, `previewOf`, `PreviewOption` :543; the note's words belong here (pure, Jest).
- `web/typescript/MapStudio.tsx` -- `renderKindSetup` :1964-1994, `onKindPreview` :1935, the hidden test rows :1653-1668 (add `data-preview`), the Details panel's Zoom to location handler (reuse), the selection ring :1158.
- `web/typescript/itemsLayer.ts` -- the redraw guard :95-97 (add a preview key) and `buildFeatures` :102.
- `web/typescript/features.ts` -- `stateOf` :222, `markerProperties` :248, `sharedState` :257, line label :337, `areaProperties` :288 (areas ignore the style).
- `web/typescript/markers.ts` -- `stateWord` :335 (Comms lost, Stale, then the preset's word), `PRESET_WORDS` :65-68; `mapLayers.ts` `LAYER_ITEM_CHIPS` :516-542 (the `word` property), the line label layer :563.
- `web/typescript/live.ts` -- `itemState` :573-621 (alarm, stale, comms lost, preset), `ItemValues` :105; an item's own rule is `MapItemRecord.overrides.styleRule` (`contract.ts` :59).
- Tests: `e2e/tests/kindstyle.spec.mjs` helpers (`liveItem` :98), the `/live` page buttons through `press` (`live.spec.mjs` :26-35: `status-0` to `status-4`, `pressure-high`, `comms-off` for P12); seed: Point 2 has its own rule, Geofence is the area kind.
- Docs: `docs/contract.md` (the Kinds surface, test hooks), `docs/styles.md`, `CHANGELOG.md`, `docs/test-playbook-0.4.0.md` section 8m after 8l.

## Tasks & Acceptance

**Execution:**
- [ ] `web/typescript/kindSetup.ts`, with Jest -- the note's words for every state of the matrix -- P1, P3 to P7, P11.
- [ ] `features.ts`, `itemsLayer.ts`, `MapStudio.tsx` -- the Preview word for one item, the guard's key, the hidden rows' `data-preview`, cleared as the Always says -- P1, P2, P5, P8, P9.
- [ ] `studio/KindSetupPanel.tsx`, `mapstudio.css` -- the note box (`.mapstudio-rule-live`), "Show on map" (`.mapstudio-kindsetup-show`), the line under the select -- P1 to P11.
- [ ] Jest -- the features for a point, a line, a shared marker and an area with the preview set.
- [ ] `e2e/tests/kindpreview.spec.mjs` (new) -- P1 to P11 at 1366 px, the dev tags and the seed put back after; screenshots of the map with the word and of the note box.
- [ ] Docs and playbook 8m.

**Acceptance Criteria:**
- Given a kind's setup open, when the preview item's state changes on the Gateway, then the note and the map agree with every other open map at the next live update, and the map has not moved.

## Implementation Notes

- Planner, 2026-11-10: the environment, commit and identity rules are entry 8's plan's (Docker by hand after a restart, JDK 17 by apt if gone, `ops/up.sh --fresh` before a whole-suite run, the session's trailers, no em dashes, never a bare `git stash`, never a push). Leave the work uncommitted: the orchestrator commits after the whole suite.

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK
- `ops/up.sh --fresh`, then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: 0 failed

**Manual checks (if no CLI):**
- The map and note screenshots against key screen 6 (kinds-style); any departure goes to the owner before it is final.
