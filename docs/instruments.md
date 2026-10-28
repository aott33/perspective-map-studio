# Instruments on lines: the map and the line popup (contract 0.3.0)

How Map Studio draws a tap, meter or line valve on its line, splits the line into segments, grades each segment and opens a line's popup (epic 3 entry 2, R13; architecture AD-7, AD-11, AD-16, AD-19; DESIGN.md line-popup, map-line, instrument-marker). Storing the attachment is [contract.md](contract.md), "Instruments on lines"; the `segments` slot of `values.batch` is there too, "The segments slot"; the kind setup's instruments source is [kind-setup.md](kind-setup.md). Labels: **[live 8.3.10]** seen on the dev stack (`e2e/tests/linepopup.spec.mjs`; [platform-checks.md](platform-checks.md), "Epic 3 entry 2"); **[build]** the unit tests; **[ER-27]** goes to the engineering review of entry 12.

## Nodes and segments

A line's **nodes**, in order from its first vertex, are the item its start snaps to (`ends.start.itemId`, or the floating start), each attached instrument that **measures**, in order of its `attachment.distanceM`, and the item its end snaps to (`ends.end.itemId`, or the floating end). An instrument measures when its kind setup has an icon KPI that is on (`KindDisplay.iconKpi`, the same rule in `web/typescript/live.ts`): a tap with a pressure KPI measures; a line valve whose setup has comms and a position KPI with `icon: false` does not. A **segment** runs between two consecutive nodes. On the dev stack's L-SWD (CTB1 to SWD1, PT-1 at 1,143 m, LV-1 at 2,000 m, PT-2 at 2,841 m of 2,922 m) the nodes are CTB1, PT-1, PT-2, SWD1 and the segments CTB1 to PT-1, PT-1 to PT-2 and PT-2 to SWD1; LV-1 sits inside PT-1 to PT-2 **[live 8.3.10]**.

Both sides apply the same rule, and each does its part (plan decision 3):

- **The Gateway grades.** Once per line per batch build, in the shared live-value cache, a line with instruments whose style rule is the instruments source gets a `segments` slot: per segment the worse of the two end instruments' presets, `stale` when either end is stale (the first named in `reason`), and the worse active end alarm; the line's own `style` slot is the worst over them. No geometry is measured on the Gateway for this, and no session does the work **[live 8.3.10]**, **[build]** (`Segments`, `InstrumentsLiveTest`).
- **The browser cuts the geometry.** `features.ts` cuts the line's coordinates at the measuring instruments' distances into one feature per segment (derived from the attachments, never stored), carrying `from` and `to` and the look its `segments` entry gives, matched by those ids; a segment the batch does not name, and every segment of a line without a `segments` slot, draws the line's own look. A click on a line therefore lands on a segment feature **[live 8.3.10]**, **[build]** (`segments.test.ts`).

## What the map draws

| Part | Look |
| --- | --- |
| An instrument | Its kind's marker at the point its attachment stores: a 24 px neutral disc with the kind glyph (DESIGN.md instrument-marker, the same image box and anchor as a point marker, the image id with an eighth element), its name below at 11 px, the state chip, the icon KPI, and its own alarm badge and digit: **an instrument's alarm draws at its place on the line**; the line's own alarm keeps the midpoint badge. The two instruments at an open segment's ends take the selection ring. Instruments join the 20 m shared-marker sweep like any point **[live 8.3.10]** |
| A segment | The line's weight by pipe size (3, 4, 6 px by `diameter`). With the instruments source: the preset's hue and word for the worse end instrument, dashed with the stale look when either end is stale, the segment's end alarm's hue over both; the line's own alarm over everything. The line's chip at the midpoint carries the worst word ("L-SWD Stale", "L-SWD Attention") **[live 8.3.10]** |
| The open segment | Firmer selection casing than the rest of the selected line; the map's `data-segment` and `data-highlighted` say which **[live 8.3.10]** |

Comms lost and stale: a stale end instrument dashes its two segments and nothing else; its own marker carries the comms-lost or stale chip. The hue of a segment's preset and alarm are the tokens of [styles.md](styles.md); instrument alarms and the aggregate look are **[ER-27]** items.

## The line popup

A click on a line whose kind setup shows anything, or that carries an instrument, opens the line's default popup at the clicked segment, 350 px wide (`line-popup-width`), built to the padding rules of the popup review (16 px sides, the header `12px 12px 8px 16px`, 32 px icon buttons and 44 px below 768 px, `max-height: min(480px, map - 64px)` with the body scrolling, the tip in the card surface, the floating shadow); the point popup keeps its look until entry 8. In order:

1. **Header**: the pipeline glyph in a disc, the name, the subline (kind, pipe size, length: "Gathering line - 6 in, 2.9 km"), the page link slot, a close button (MapLibre's own close button is hidden for this popup).
2. **The segment box** (when a segment is open; `selection-tint` with a `selection` edge): "Segment PT-1 to PT-2", its span "1.1 to 2.8 km", and one line: "398 to 371 psi - drop 27 psi over 1.7 km" when both ends carry a number in one unit (rise, drop or no change), the stale glyph and "Stale - drawn dashed until PT-1 updates" when an end is stale, else the two values as words.
3. **Comms** over the instruments: "OK - 3 instruments, oldest 9 s ago", or the first stale or comms-lost instrument, "PT-1 comms lost - last 18 min ago"; with no instrument on the line the line's own comms row where its setup turns comms on.
4. **Instruments, CTB1 to SWD1**: one row per node in order: a snapped end as "CTB1 outlet" or "SWD1 inlet" with a filled square (a floating end "Line start" or "Line end"), an instrument with its kind glyph; the distance in tiny type ("0 km", "1.1 km", "2 km"); the value right-aligned: the icon KPI ("398 psi"), "No value" (no icon KPI, or none yet), or the stale glyph and "Stale - 371 psi (last)"; an active alarm's glyph and digit before it. The open segment's two instruments are highlighted (`selection-tint`, a 3 px `selection` edge), the same two that carry the ring on the map.
5. **The line's own KPIs** (up to three) and, where its setup turns alarms on, its **alarm block** (the counts; the summary in words and the View alarms button are entry 8's).

While it is open the Gateway pushes the line and every listed instrument within 250 ms of a change (PT-2's row followed its tag in under a second on the dev stack), the popup clock refreshes the ages, and a new click on another segment of the same line sends a new `popup.open` with that segment. Closing it (the header button, the ground) sends `popup.close` and clears the line's selection and the highlight **[live 8.3.10]**. At 390 px the card is the same, `calc(100vw - 32px)` wide with 44 px header buttons, inside the viewport; the bottom sheet is entry 8's.

A custom popup view (the spike's `popupView` prop today, the kind setup's view from entry 8) gets the line's map item object with `instruments: [{id, name, kind, distanceM, liveValues}]` in order along the line and the open `segment: {fromId, toId}` (AD-7).

## Screenshots

`docs/screenshots/mapstudio-line-popup-1440.png` (the quiet L-SWD at PT-1 to PT-2), `mapstudio-line-popup-stale-1440.png` (PT-1 comms lost: CTB1 to PT-1 and PT-1 to PT-2 dashed) and `mapstudio-line-popup-390.png`, against the mockups `_bmad-output/initiative-flowmap/ux-map-studio/mockups/key-screen-3-line-instruments-live.png` and `-stale.png`.

## Not here

Editing an instrument (the tool, snapping, moving along the line: epic-editing); the legend (entry 3); the alarm summary in words, the View alarms button, the page link and the phone bottom sheet (entry 8); the hue review (entry 12).
