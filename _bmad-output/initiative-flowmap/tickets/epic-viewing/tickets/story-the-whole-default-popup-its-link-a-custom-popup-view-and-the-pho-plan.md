---
title: 'The whole default popup, its link, a custom popup view and the phone bottom sheet'
type: 'feature'
ticket: '8'
created: '2026-10-28'
status: 'built'
baseline_revision: '05a0921887101706a4e4617465a0cbebb8dc9612'
route: 'full'
route_source: 'pinned'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/handoff-epic-3.md'
  - '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/review-popup-and-marker-info.md'
  - '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md'
  - '{project-root}/docs/contract.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Entry 5's tracer popup showed comms, KPIs and the alarm counts and nothing more: no alarm in words, no View alarms, an empty page link slot, the spike's `popupView` prop still winning over the kind setup, MapLibre's own close button over the card's corner, content-driven width, no height rule, a grey pointer on the badge, and at 390 px a card that map labels showed through, an alarm row with a gap beside its glyph and values truncated under the close button (owner, 2026-10-28; the UX review P1 to P8 and Phone).

**Approach:** The Gateway reads the open popup's alarm summary from Ignition's alarm status (`AlarmManager.queryStatus`, active states only, matched on the source's provider and tag path below the item's alarms path) and pushes it with the item's base path and alarms path as `popup` on the one session's `popup.open` push, so the browser can fill the link, the alarm page and a custom view's params with no path ever leaving the Gateway's batches. The browser draws the design's card at 768 px and above (320 px, at most 480 or the map less 64, header fixed and body scrolling, its own close, 16 px padding, a 10 px pointer 22 px off the marker in the card's surface, opaque above every layer, the floating shadow, radius 10) and a bottom sheet below (8 px insets, above the App Bar toggle, a handle, 44 px icons, the footer with View alarms and Edit for phone-editing roles), with the pop-out hidden when a placeholder has no value, the alarm block as the mockup, and a kind setup's `popupView` rendered with Perspective's View (`mapItem` live, params filled, fallback on a missing or failing view). The spike's prop is retired with an upgrade note. Map Studio acknowledges nothing.

## Decisions (recorded for the owner, 2026-10-28; the session is unattended)

1. **Alarm status API.** `AlarmManager.queryStatus(AlarmFilter)` with `AlarmFilter.STATE` as an `EnumCondition(ActiveUnacked, ActiveAcked)`, the source matched in module code on the `prov` and `tag` components of each event's `QualifiedPath` (the same tags the path's Alarm Metrics aggregate), not on a source wildcard: a wildcard would match `Mesa/P120` for `Mesa/P12`. One query per push of an open popup (at most every 250 ms, for one session), never per interval batch.
2. **The popup detail is per session.** `popup: {basePath, alarmsPath, alarms}` rides only on the `popup.open` push to the session that opened it (`popup.open` now pushes at once); interval batches stay path-free for every level (`none` included).
3. **Priority counts and the listed alarms** follow the map's priorities (1 to 3 from `AlarmMetrics.priority`), three listed at most: priority 1 first, unacknowledged before acknowledged, newest first; the alarm's label or name, its source below the alarms path in words (`Pressure`, `""` on the path itself), and its active time. A status that cannot be read gives `reason` "the alarm status could not be read" with the counts zero (the Alarm Metrics heading still says how many).
4. **Width 320, height 480 or the map less 64, offset 22, tip 10, radius 10, 16 px padding** (D1 to D3, DESIGN.md tokens updated); `popupMaxWidth` returns the token when it fits and the room the point has otherwise (the phone case of entry 5 is now the sheet). The tip's colour is the card surface (`--container`, falling back to `--neutral-10`), the surface tokens staying as every control's until entry 12 reviews them against `surface-panel`.
5. **Sheet below 768 px** for every point popup (the line popup is entry 2's), in the component, not a MapLibre popup: no pointer, the map pans so the selected marker stays 48 px above the sheet's top; `data-popup-mode` on `.mapstudio-map` says `card`, `sheet` or `''`.
6. **The link opens in the session** through the Perspective client's page navigation, after a second check that the filled text is a page path (`web/typescript/placeholders.ts`); the icon is hidden, not disabled, when a placeholder has no value or the fill is not a page path. The alarm page is filled the same way.
7. **A custom view's params** are filled when the popup detail arrives (a custom view waits briefly, 2 s at most, for the base path before it opens without it); a param whose placeholder has no value is left out so the view sees its own default; `mapItem` is `{id, name, kind, assetId, properties, basePath, alarmsPath, values: {comms, kpis, alarms}}` and re-renders on every push. A missing, errored or denied view falls back with one console warning naming the path.
8. **Retired prop.** `popupView` leaves `mapstudio.props.json` and the component reads nothing from it; a view that read `mapItem.id` and `mapItem.name` still works (upgrade note in CHANGELOG and `docs/contract.md`). The dev project's `Popups/PointDetails` and the two fallback pages go; `Popups/PadAlarms` (the alarm table for the item's folder), `/alarms/:item` and `/pad/:name` come.
9. **No subagents.** This agent implements from the plan and runs the quick review lens itself over the diff.

## Boundaries & Constraints

**Always:** every colour a theme token (AD-11); every state in words or a glyph with `aria-label`; the popup live while open (NFR-9) and stale values marked; no tag path in any batch to a viewer (the popup detail goes to the one session that opened the popup); Map Studio acknowledges nothing (FR-5); contract 0.3.0 (`check-contract-versions.sh` green); no em dashes; `README.md` untouched; the existing e2e attributes kept.

**Never:** the line popup and its instruments (entry 2, which shares `MapStudio.tsx` and `mapstudio.css`: edits there stay in the point popup's parts); the edit sheet behind the Edit button (epic-editing); the kind setup screen (epic-editing); a change to `ign-scada-template`; a `.modl` or scratch project committed; a Gateway write outside the local dev stack; a change to the alarm presentation beyond what goes to entry 12's ER-27 review (the alarm words, the tint, the sheet).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Popup opened | `popup.open {itemId}` | the item pushed at once with `popup: {basePath, alarmsPath, alarms}`; then on change within 250 ms | an unplanned item pushes nothing |
| Alarm active | one High alarm on `Pressure` below `[default]Mesa/P12` | counts `1,0,0`; list one entry `High pressure`, source `Pressure`, priority 1, unacked, its active time; the card shows "1 alarm - Priority 1, unacknowledged", "High pressure - Pressure, N s ago", View alarms | the status unreadable: `reason` set, counts zero, the block says the alarms could not be listed |
| Acknowledged | `system.alarm.acknowledge` | the heading says acknowledged, the glyph hollow, View alarms stays | none |
| No alarm | the alarm cleared | a check and "No active alarms", no tint, no button | none |
| Link | `link: /pad/{asset.id}`, item with asset P12 | pop-out with `data-link="/pad/P12"`; a click opens the page in the session | no asset: the icon absent |
| Link not a page | a property fills `//host` | the icon absent | none |
| View alarms | `alarmPage: /alarms/{asset.id}` | opens `/alarms/P12` | no page or no value: the button absent |
| Custom view | `popupView {path: Popups/PadAlarms, params: {padName: {item.name}, alarmsPath: {asset.path}}}` | the view in the popup with `mapItem` and `padName` "Point 1", `alarmsPath` `[default]Mesa/P12`; re-rendered on every push | none |
| Missing view | `path: Popups/Nope` | the default popup, one warning naming `Popups/Nope` | none |
| No parts, no view | a kind whose setup turns everything off | no popup; the item selected | none |
| 1440 px | a click on a point | a 320 px card, at most 480 px tall, its own close, no MapLibre close button, radius 10, an opaque surface, a 10 px tip, z-index above the controls | none |
| 390 px | a tap on a point | a sheet 8 px from the sides, at least 56 px above the bottom, at most 60 % of the map, a 36 px handle, 44 px icons and buttons, 16 px padding, the alarm line under its glyph, nothing of the map through its surface (render check), the marker above it | none |

</frozen-after-approval>

## Code Map

- `gateway/.../live/AlarmStatus.java` (new, interface), `IgnitionAlarmStatus.java` (new, `AlarmManager.queryStatus`), `FakeAlarmStatus.java` (test) -- the alarm summary source.
- `gateway/.../live/LiveValueCache.java` -- `popupDetail`, the at-once push on `popup.open`, the alarm status wired in `MapStudioServices`; `ValuePlan.java` -- the alarms path and base path kept per item; `LiveSession.java` -- `popup.open` pushes at once.
- `common/.../contract/KindDisplay.java` -- `popupView` in the display; `mapstudio.props.json` -- `popupView` removed.
- `web/typescript/live.ts` -- `PopupDetail`, `alarmCountsText`, `alarmLineText`, the popup detail kept beside the live state; `popupParams.ts` -- `fillLink`, `fillParams`, `popupItemView`, `popupViewParams`, `isSheetWidth`, `popupMaxWidth`, `popupMaxHeight`, `isFailedViewState`; `placeholders.ts` -- the closed list and the page path check; `DefaultPopup.tsx` -- the card and the sheet body; `PointPopup.tsx` -- the custom view with the fallback; `MapStudio.tsx` -- `openPopup` (card or sheet), `showSheetFor`, `popupContentFor`, `navigateTo`; `mapstudio.css` -- the card, the tip, the sheet, the alarm block, the footer.
- `web/typescript/__tests__/{defaultPopup,popupParams,live}.test.ts` -- the words, the fills and the layouts.
- `ops/project/.../views/MapStudioAlarms`, `MapStudioPad`, `Popups/PadAlarms`, `page-config/config.json`, `setup/setup.json` (`alarmPage`); the spike's `Popups/PointDetails` and the fallback pages removed; every dev view without the retired prop.
- `e2e/tests/popup.spec.mjs` (rewritten), `live.spec.mjs` (the summary, View alarms, the sheet, the render check), `measures.spec.mjs` and `tracer.spec.mjs` (the sheet in place of the spike's view), `e2e/lib/png.mjs` (new, the PNG reader for the render check).
- `docs/contract.md` ("The popup", the props table), `docs/kind-setup.md`, `docs/development.md`, `docs/platform-checks.md` ("Epic 3 entry 8"), `CHANGELOG.md`, DESIGN.md (the D1 to D3 tokens), this plan.

## Tasks & Acceptance

**Execution:**
- [x] Gateway: the alarm status, the popup detail, the at-once push, the display's `popupView`.
- [x] Browser: the card, the sheet, the link, the alarm block, the custom view with the fallback, the retired prop.
- [x] Dev project: the alarm page, the pad page, the example view, the setup's alarm page, the spike's views removed.
- [x] Tests: Java, Jest, the four e2e specs and the PNG reader.
- [x] Docs, the changelog, the design tokens, the platform checks, this plan.

**Acceptance Criteria:**
- Given the dev Gateway with the dev alarm raised, when Point 1's popup opens, then it shows the counts and the alarm in words with its source and age, and View alarms opens `/alarms/P12` with the built-in alarm table.
- Given `link: /pad/{asset.id}`, then the pop-out opens `/pad/P12` for Point 1 and is absent for a pad with no asset.
- Given the pad setup's `popupView` `Popups/PadAlarms`, then the view opens with `mapItem` and `padName`; given `Popups/Nope`, then the default popup opens with one warning.
- Given 390 px, then the popup is a bottom sheet with nothing of the map through it and the alarm line under its glyph.
- Given the hand-off's checks, then every one passes (build, tsc, jest, e2e on a fresh stack, the contract version checks).

## Implementation Notes

- **Commits on the worktree branch** (`worktree-agent-ae75b6d669305115e`, baseline `05a0921`): e0f85dc (the Gateway and browser slice), 128993d (the changelog, the design tokens, the props schema, the dev views, the specs), then this session's commits (the platform checks, this plan, the evidence).
- **A container restart** stopped the first agent after 128993d's content was written; this session committed it as it stood, read the diff, wrote this plan and ran the verification.
- **Not done, by scope:** the edit sheet behind Edit (epic-editing; `canEdit` is false, so the sheet's Edit button is not drawn yet), the surface token review (entry 12), the line popup (entry 2), the per-item param override and URL-encoding of link values (backlog, AD-7).

## Plan Change Log

## Review Triage Log

Review pass 1 (quick lens, read by this agent from the diff against the baseline; no subagent tool in this session): 0 high, 0 medium, 2 low, 0 false, 0 maybe-false.

| Finding | Verdict | Route | Evidence |
| --- | --- | --- | --- |
| The sheet's Edit button is in the component for phone-editing roles but never drawn yet: `canEdit` is false until epic-editing's edit sheet exists | low (by design) | rejected | `DefaultPopup.tsx` footer; `MapStudio.tsx` passes `canEdit={false}` |
| `popupMaxHeight` reads the map's height once when the card is placed; a window resized while the card is open keeps the old cap until the next open | low | rejected | the card re-places on the next click; the sheet uses a percentage cap |

## Design Notes

**Why the alarm summary is a Gateway read, not a browser one.** The browser never holds a tag path (NFR, the batches are path-free); the alarms path is only known on the Gateway, where `AlarmManager` lives, and the one session whose popup is open is the only one that needs the words. The Alarm Metrics subscription still carries the counts to every map, so the icon and the heading need no query.

## Verification

**Commands:**
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` (with the scratch init script that keeps the node plugin from downloading Node) -- expected: BUILD SUCCESSFUL.
- `cd web && npx tsc --noEmit && npx jest` -- expected: no type error, all tests pass.
- `ops/up.sh --fresh --no-build` with the module staged by hand, then `cd e2e && npm ci && E2E_DOCS=1 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: every spec passes.
- `bash scripts/ci/check-contract-versions.sh` and `bash scripts/ci/test-contract-versions.sh` -- expected: OK.
- `grep -rnP '\xE2\x80\x94'` on every changed file -- expected: no match.

**Manual checks:**
- `docs/screenshots/mapstudio-live-1440.png` against `ux-map-studio/mockups/key-screen-1-view-desktop-popup.png` and `mapstudio-live-390.png` against `key-screen-2-phone-sheet.png`.

**Results:** see the end of this file.
