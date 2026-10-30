# Test playbook: Map Studio 0.3.0 on your local stack

A walk through everything 0.3.0 does, in order, on the local development stack. Tick each box, and note anything that looks or feels off in the Notes line under each section (a screenshot helps). Each note goes into `_bmad-output/backlog/story-owner-review-notes-on-the-0-3-0-map.md`.

## Results so far

| Section | Result | Date |
|---|---|---|
| 0. Before you start | passed: stack up, seeded, private window, trial time | 2026-10-30 |
| 13. Satellite | passed: imagery with the owner's Mapbox token; more Mapbox styles go to the backlog after 0.3.0 | 2026-10-30 |
| 1. First look | passed: lines and chips fine; opens at zoom 15 (by design); neutral discs confirmed; P14 red triangle confirmed; P21 comms lost and SWD1 stale confirmed on `mapstudio-showcase` (the first check was on the dev map, which has no P21); notes: dots too small (bigger dots, item 6), the instrument icon does not read well (item 7) | 2026-10-30 |
| 3. The popup card | reviewed with notes (pop-out and View alarms work; live values with the card open checked in section 4): layout option A chosen (item 13); a click on empty map closes it, Esc does not (bug, item 14); "Bad_NotFound" shown to the operator (item 15) | 2026-10-30 |
| 2. Search and Needs you | passed (with notes): typing, Esc, search by asset name and Tab order work; search works and zooms to zoom 15; notes: a chevron opens a simple alphabetical list of every item, typing filters it (item 8); hovering Needs you makes its background disappear (bug, item 9), also over OpenStreetMap on the showcase; the list shows the items correctly; on a phone the counts as glyph and number only and the placeholder "Search assets" (item 12) | 2026-10-30 |

## 0. Before you start

- [x] `ops/up.sh` is up (after a version change: `./gradlew clean` first; after a pull that changes the dev Gateway's config: `ops/up.sh --fresh`).
- [x] Seeded: http://localhost:9088/data/perspective/client/mapstudio-dev/edit, signed in as `mapeditor` (`MAPSTUDIO_EDITOR_PASSWORD` in `.env`), **Seed the dev map** pressed once.
- [x] After any Gateway restart (for example `ops/up.sh --no-build` for the Mapbox token), press **Seed the dev map** again: memory tags keep their values across a restart but lose the Bad quality that makes SWD1 stale.
- [x] A second browser or a private window for the "viewer" checks (not signed in).
- [x] The Gateway trial has time left (bottom-right App Bar button, then the session menu); reset it on the Gateway page when it runs out.

Pages used below. Dev project: `/` (View), `/edit` (editing and the seed), `/live` (buttons that change tags), `/styles` (style rules and the review states), `/adapters`, `/two`. Showcase project: http://localhost:9088/data/perspective/client/mapstudio-showcase (`/` and `/dark`).

## 1. First look: the showcase, as an operator sees it

On the showcase page, http://localhost:9088/data/perspective/client/mapstudio-showcase (not the dev map at `.../mapstudio-dev/`, which has its own P14 and SWD1 but no P21 and no showcase states), at a laptop size.

- [x] The map opens on the Mesa field at zoom 15 (by design: the showcase's starting area; the dev map opens at zoom 12), no test buttons, nothing in the bottom-right but Perspective's App Bar button.
- [x] Sites are neutral discs with their kind's glyph and name; a value under the name from zoom 15 (zoom out one step: values go, names stay; below zoom 14 normal sites become small dots).
- [x] P14 shows a red priority 1 alarm triangle with its digit; P21 a magenta comms-lost glyph, dashed ring and "Comms lost" chip; SWD1 the hourglass and "Stale" chip, no colour.
- [x] The geofence is a dashed outline; lines are grey, weight by size, with name chips.
- [x] Nothing reads as an alarm that is not one (the review's question).

Notes:

- Looked at the dev map first, which has no P21; on the showcase, after a re-seed, every state shows (item 10: re-seed after a Gateway restart).
- Dots too small below zoom 14 (item 6); the instrument icon does not read well (item 7).
- Only lines with instruments took their weight from the pipe size: size alone should set the weight (item 11).

## 2. Search and Needs you (top-left)

- [x] Type "p1" in search: matching sites list as you type; arrows and Enter choose one; the map zooms to it and selects it; Esc clears.
- [x] Search by an asset name (for example a pad's asset) finds the site linked to it.
- [x] Needs you reads "Needs you 3: 1 alarm, 1 comms lost, 1 stale" (or the current counts).
- [x] Open it: alarms first by priority, then comms lost, then stale; each row in words with its age; choosing a row zooms to and selects that site; Esc closes and returns focus.
- [x] Keyboard only: Tab reaches search, Needs you, the zoom card and Legend in a sensible order.

Notes:

- Search should open a simple alphabetical list from a chevron, typing filters it (item 8).
- Hovering Needs you makes its background disappear, over Satellite and OpenStreetMap; a stray space before the colon (item 9).
- The bar: no words at any width, a bell with the alarm count, then comms lost and stale with their counts, a grey bell when nothing needs you; the search placeholder "Search assets" (item 12). Choosing which counts show, and Out of service, after 0.3.0 (story 12).

## 3. The popup card (desktop)

Click P14.

- [x] Card order: kind glyph and name, subline, pop-out (page link) and close; Comms with its age; 2 to 3 values; the alarm block with "View alarms".
- [x] Padding even on both sides, nothing cut off, nothing from the map showing through.
- [x] The pop-out icon opens the site's page (`/site/P14` on the showcase); **View alarms** opens the alarm page with the built-in alarm table.
- [ ] Values update while the card is open (on the dev map use `/live`: "P12 pressure 400" / "950" with Point 1's card open).
- [ ] A click on empty map closes the card (works); Esc closes it (fails: item 14).

Notes:

- Layout reworked as option A (item 13): comms status right-aligned with its age, stale values as the hourglass alone with a tooltip, full labels, no check mark, the hourglass before "No active alarms" when stale; the same on the phone sheet.
- Esc does not close the popup (bug, item 14).
- "Bad_NotFound" shown to the operator on Point 3 (item 15).

## 4. Live state: the dev map with `/live`

Open `/live` (signed in) in one window and the dev map (`/`) in another, and watch the map as you press the buttons. The buttons are named after the **asset**; the dev map's points have their own names:

| Button names | Point on the dev map | Find it |
|---|---|---|
| P12 | **Point 1** | search "Point 1" |
| P14 | **Point 2** | search "Point 2" |
| L3 | **Tracer line** (Point 1 to Point 2) | search "Tracer" |

Values reach the map within the refresh interval (10 s), so give each press a moment.

- [ ] **P12 pressure 400 / 950**: Point 1's value changes.
- [ ] At 950, Point 1 raises its "High pressure" alarm: triangle and digit on the marker, Needs you counts it. **Acknowledge P12**: the triangle turns hollow.
- [ ] **P12 comms off**: Point 1 shows comms lost in magenta with its chip, Needs you counts it; **P12 comms on** restores it.
- [ ] **P14 pressure bad**: Point 2 goes stale (hourglass, no colour, value marked stale); **P14 pressure good** restores it.
- [ ] **P12 status 0 to 4**: Point 1's style changes (Attention, Warning, Fault rings with words, Out of service faded).
- [ ] **L3 flow 20 / 120 / 300**: the Tracer line's look follows its Bands rule.
- [ ] An alarm always draws over a style; stale drops the style until a fresh value.

Notes:

## 5. Lines and instruments

On the dev map (`/`), find L-SWD (CTB1 to SWD1) or on the showcase.

- [ ] PT-1, LV-1 and PT-2 sit at their places on the line.
- [ ] Click the line between PT-1 and PT-2: the line popup opens at "Segment PT-1 to PT-2", lists the instruments in order with distances and values, and highlights the two ends on the map and in the list.
- [ ] `/live` **PT1 comms off**: the segments either side of PT-1 dash; **PT2 pressure 500**: the segments either side of PT-2 show attention; **PT2 pressure 950** raises PT-2's alarm at its place on the line.
- [ ] A selected line shows the flow arrow; only the selected one.
- [ ] Two sites within 20 m (Shared A and Shared B on the dev map) are one marker that opens a pick list.

Notes:

## 6. Zoom card, Legend and basemaps

- [ ] Zoom card top-right: plus, the zoom level, minus, Fit (fits the field), Return (disabled with nothing selected; recentres on a selection).
- [ ] Legend bottom-left: opens and closes by click, Enter/Space and Esc; the key matches what the map draws; Lines and Names toggles hide and show, and are remembered when the page reloads.
- [ ] Basemaps: None, OpenStreetMap (real tiles here), Satellite (needs a Mapbox token, below); attribution shown.
- [ ] Labels stay readable over OpenStreetMap (halos), lines stay visible.

Notes:

## 7. Phone (390 px)

Your phone (see `docs/development.md` for binding the Gateway to your LAN) or the browser's device mode at 390 px.

- [ ] One top bar: search and Needs you; it expands on tap.
- [ ] Tapping a site opens a bottom sheet (handle, close, values, alarm block, View alarms), clear of the App Bar button; no pointer.
- [ ] Every button is comfortably tappable (44 px).
- [ ] The legend, the zoom card and the attribution fit without covering what you need.

Notes:

## 8. Custom popup view, links, alarm page

- [ ] On the showcase, click SWD1: its kind uses a custom popup view (`Popups/SiteCard`) with Map Studio's close row above it, on desktop and as the phone sheet.
- [ ] Rename a pad's asset or leave a placeholder empty (Designer, the dev adapter): the page link icon hides instead of opening a broken link.

Notes:

## 9. Dark theme and the review states

- [ ] Showcase `/dark`: the same map in Perspective's dark theme; every state still reads (magenta comms lost, alarm hues, chips).
- [ ] `/styles`, **Showcase review alarms / stale / off**: the showcase shows every alarm priority and acknowledgement state, the stale states, then quiet again. Compare with `docs/review-er27.md` while you do the ER-27 review.

Notes:

## 10. Designer: the setup form

Open the Designer on the dev project, Project Browser, **Map Studio Setup**.

- [ ] Database connection, roles, kind and asset functions, refresh interval, basemaps, alarm page and map token read sensibly and save; a change applies without a Gateway restart.
- [ ] A wrong value (an unknown role, an empty connection) is explained beside its field.

Notes:

## 11. When things go wrong

- [ ] `/adapters` (signed in): **Adapter: empty / broken / slow / incomplete** each show a plain-words status on the map; **Adapter: ok** recovers.
- [ ] Two windows on `/edit`: draw a line in one (the spike's "Draw a line", Enter to finish); it shows in the other within seconds, with no reload.
- [ ] A viewer (not signed in) cannot save: drawing is not offered on `/`.
- [ ] Stop the Gateway (`docker stop` the `ms-...` container) with a map open: the map says so in words and shows nothing stale as current; start it again: the map recovers.

Notes:

## 12. Feel: speed and the frame rate (R11)

In a browser with hardware WebGL (`chrome://gpu`; under WSL use the Windows browser):

- [ ] Pan and zoom the dev map's 30-pad set and the showcase: smooth (60 frames per second). DevTools' frame rendering stats or Performance panel show the rate; write down what you see.
- [ ] Opening a popup, a search result and the legend feels instant.

Notes (with the frame rate you saw):

## 13. Satellite (optional)

Put a public `pk.` Mapbox token in `ops/secrets/map_token` (one line) and restart the Gateway (`ops/up.sh --no-build`); no fresh volume or new seed is needed on a stack started after this release's pull. Satellite is offered on the dev project's map (`/`), not the showcase, whose setup offers None and OpenStreetMap.

- [x] Satellite imagery loads, the attribution shows Mapbox, labels and states stay readable over imagery.

Notes:
