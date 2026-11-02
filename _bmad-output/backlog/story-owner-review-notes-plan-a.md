---
title: 'Owner review notes on the 0.3.0 map: group a (popups)'
type: 'plan'
story: '10'
group: 'a'
created: '2026-11-02'
status: 'built'
items: [13, 14, 15, 17, 18, 19, 20, 21, 27]
---

# Group a: popups (owner review notes items 13, 14, 15, 17, 18, 19, 20, 21, 27)

The spec is each item's text in `story-owner-review-notes-on-the-0-3-0-map.md` and the renders
`renders/popup-options-2026-10-30.png` (option A) and `renders/line-popup-2026-11-02.png`. Built in the
worktree `/home/user/wt-notes-a`, branch `ccr-e1048b93-r2p8l4-notes-a`, dev stack on port 9101.

## What is built, per item

| Item | Build | Files | Tests | Renders |
|---|---|---|---|---|
| 13 | Option A rows: the comms row's status right-aligned with its age (the check stays there); a stale KPI shows the hourglass alone before the value, the reason in a tooltip (`title`; a tap on the row shows the same words under it on the phone sheet); labels no longer cut by an ellipsis; no check before "No active alarms"; with comms lost or stale the hourglass before "No active alarms" or before "1 alarm - Priority 1, unacknowledged" (no "Stale - " words), the reason in the heading's tooltip ("Alarm state may be out of date: comms lost 3 h ago") | `web/typescript/live.ts` (`staleWords`, `alarmStaleNote`), `popupParts.tsx`, `DefaultPopup.tsx`, `LinePopup.tsx`, `mapstudio.css` | unit `live.test.ts`, `defaultPopup.test.ts`; e2e `live.spec.mjs` (the stale and comms-lost cards) | before/after P14 and P21 (showcase), the dev map's Point 2 stale |
| 14 | Esc closes the card or the sheet (and a pick list) and returns the focus to the map canvas, or to the search field or the Needs you bar when they opened it | `MapStudio.tsx` (one keydown handler on the component root; `openedBy`) | e2e `popup.spec.mjs` (card and sheet) | none (behaviour) |
| 15 | Ignition's quality codes in plain words: `qualityWords` ("Bad_NotFound" is "tag not found", "Bad_Stale" "stale", ...; an unknown code is split into words); used by the popup's comms row ("No data yet - tag not found"), the KPI tooltips ("Bad quality", "Comms lost") and the Needs you list's detail; the code kept in `data-quality` and the tooltip | `live.ts` (`qualityWords`), `needsyou.ts` (`slotReason`), `DefaultPopup.tsx`, `popupParts.tsx` | unit `live.test.ts`, `needsyou.test.ts` | the dev map's Point 3 before/after |
| 17 | A line with no instruments shows no segment block: `segmentWords` is null without an instrument node, the popup's segment is null, and the map highlights nothing | `linePopup.ts`, `MapStudio.tsx` (`openLinePopup`) | unit `linePopup.test.ts`; e2e `linepopup.spec.mjs` (the Tracer line) | the Tracer line before/after |
| 18 | A popup card is placed inside the map less the top bar and the zoom card: a pure `placePopup` picks the first anchor (above, left, right, below, then the corners) whose card misses the controls and the edges; if none fits the card is clamped on the side with room and the map pans by the overflow; point and line cards alike; a card keeps its own width near an edge (`placedMaxWidth`; the old centred rule squeezed Point 1's card to 225 px under the zoom card) | new `web/typescript/popupPlacement.ts`, `MapStudio.tsx` (`showPopupAt`), `popupParams.ts` (`linePopupPlacement` and `popupMaxWidth` removed) | unit `popupPlacement.test.ts`; e2e `popup.spec.mjs` (Point 1 near each edge and under each control) | L-SWD under the top bar before/after |
| 19 | The line popup pins the header, the segment box, comms, the line's own values and an alarm summary naming the instrument in alarm ("1 alarm on the line - PT-2, Priority 1, unacknowledged"); only the instrument list scrolls (four rows), the highlighted ends scrolled into view; rows in option A style (the hourglass alone, the reason in the tooltip) | `linePopup.ts` (`lineAlarms`), `LinePopup.tsx`, `mapstudio.css` | unit `linePopup.test.ts`; e2e `linepopup.spec.mjs` | L-SWD with PT-2 in alarm before/after |
| 20 | A grouped item's popup anchors to the marker drawn (the group's centroid), published as `data-popup-anchor`; a group splits once its members are a marker apart on screen: `sharedWithinM(zoom, lat)` = min(20 m, 44 px at that zoom), the features rebuilt on `zoomend` when it changes | `shared.ts`, `features.ts`, `MapStudio.tsx` | unit `shared.test.ts`; e2e `labels.spec.mjs` (zoom 18 splits, the anchor) | Shared A at zoom 18 before/after |
| 21 | No data: the comms row reads "No data yet" in the secondary colour with no glyph, the alarm line "Alarm state unknown" with no glyph, a KPI "No data yet"; the marker stays normal (see the decision below) | `live.ts` (`commsText`, `alarmsText`), `DefaultPopup.tsx`, `popupParts.tsx`, `mapstudio.css` | unit `live.test.ts`; e2e `labels.spec.mjs` (Shared A's card) | Shared A before/after |
| 27 | Camera padding from the visible area: the top bar, the zoom card, an open sheet (phone) or card (desktop) and the legend row, applied to Return, a search choice, a Needs you choice and Fit through MapLibre's `padding` | `MapStudio.tsx` (`cameraPadding`), `popupPlacement.ts` (`visibleArea`) | unit `popupPlacement.test.ts`; e2e `popup.spec.mjs` (Return under the sheet at 390 px) | P14 under the sheet before/after |

## Decisions taken here (for the coordinator and the owner)

- Item 13, an alarm while comms are lost: the heading keeps the alarm glyph and adds the hourglass before the words.
- Item 19, the alarm summary: the instruments' alarms come from `values.batch` (priority and acknowledgement), not from the popup detail, which the Gateway pushes for the line only; so the second line names the instruments in alarm with their priorities, not the alarm's name. The line's own alarms, where its setup turns them on, keep the detail's words.
- Item 20, the drawn place of a shared marker is the members' centroid (was the first member's own place, which depends on the store's order).
- Item 21, the marker: the contract reports no data as a stale slot (`no value yet`), which draws the hourglass; an item whose slot could not be resolved at all (no asset linked) has no slot and draws normal, as the contract's "problems" rule says. Unchanged.
- Item 27, MapLibre's `padding` is set on each camera move and stays until the next, so `getCenter()` (and `data-center`) is the centre of the visible area; the e2e view hook clears it.

## Resumed session (the second agent)

- Verified the first agent's code against each item's text and its renders: tsc and jest green, the code read in full.
- Fixed at render review: the point card's comms status was not right-aligned (option A); the glyph-less "No active alarms" and "Alarm state unknown" sat indented off the label column; the line popup's alarm block was a flex row (an "Also: ..." line would sit beside the heading); the instrument list showed five rows before scrolling (now about four and a half, 144 px; 180 px on a phone); a card near the right edge was narrowed to 225 px (item 18, above).
- Added the 0.3.0 CHANGELOG entry and item 27 in EXPERIENCE.md's popup row.
- Renders: `renders/notes-a/` with its README (items 13, 15, 17, 18, 19, 20, 21, 27).

## Status

Built.
