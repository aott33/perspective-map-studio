# Test playbook: Map Studio 0.3.0 on your local stack

A walk through everything 0.3.0 does, in order, on the local development stack. Tick each box, and note anything that looks or feels off in the Notes line under each section (a screenshot helps). Each note goes into `_bmad-output/backlog/story-owner-review-notes-on-the-0-3-0-map.md`.

## Results so far

| Section | Result | Date |
|---|---|---|
| 0. Before you start | passed: stack up, seeded, private window, trial time | 2026-10-30 |
| 13. Satellite | passed: imagery with the owner's Mapbox token; more Mapbox styles go to the backlog after 0.3.0 | 2026-10-30 |
| 1. First look | passed: lines and chips fine; opens at zoom 15 (by design); neutral discs confirmed; P14 red triangle confirmed; P21 comms lost and SWD1 stale confirmed on `mapstudio-showcase` (the first check was on the dev map, which has no P21); notes: dots too small (bigger dots, item 6), the instrument icon does not read well (item 7) | 2026-10-30 |
| 3. The popup card | reviewed with notes (pop-out, View alarms and live values with the card open work): layout option A chosen (item 13); a click on empty map closes it, Esc does not (bug, item 14); "Bad_NotFound" shown to the operator (item 15) | 2026-10-30 |
| 4. Live state | passed (with notes): the alarm raises, acknowledges ("!" in the triangle) and clears; the card updates while open; comms off and on, pressure bad and good, status 0 to 4, L3 flow, an alarm over a style and comms lost dropping the style work; comms on, pressure 400 and status 0 reset Point 1; notes: a selected marker's rings are cut off (item 16) | 2026-11-02 |
| 5. Lines and instruments | passed (with notes): instruments in place, the shared marker's pick list, the segment popup, comms off dashing, PT-2's alarm, L-SWD quiet and the flow arrow work; notes: the popup over the top bar and cut off (item 18), the line popup's layout (item 19) | 2026-11-02 |
| 6. Zoom card, Legend and basemaps | passed (with notes): zoom card, legend keyboard, toggles kept after a reload and basemap switching work; notes: the legend over the top bar (item 23), kinds in the legend (item 24), OpenStreetMap readability (item 25) | 2026-11-02 |
| 7. Phone | passed (with notes): the top bar, the bottom sheet and tap targets; notes: the list under the zoom card (item 26), centring under the sheet (item 27), the legend (items 3, 23) | 2026-11-02 |
| 8. Custom popup view | passed: SWD1's custom view with the close row, on the phone sheet; the hidden link is covered by the automated test | 2026-11-02 |
| 9. Dark theme and the review states | passed (with notes): every state reads in the dark theme; the ER-27 review passed with changes (docs/review-er27.md); notes: thin scroll bars (item 28), the map light on `/dark` until a reload (item 29) | 2026-11-02 |
| 10. Designer setup form | passed (with notes): reads well, saves, a change applies without a restart (the wrong-value messages not checked); notes: the Map token rows (item 31) | 2026-11-02 |
| 11. When things go wrong | in progress: the adapter statuses work; a drawn line shows in the other window at once; a viewer cannot draw | 2026-11-02 |
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
- [x] Values update while the card is open (on the dev map use `/live`: "P12 pressure 400" / "950" with Point 1's card open).
- [ ] A click on empty map closes the card (works); Esc closes it (fails: item 14).

Notes:

- Layout reworked as option A (item 13): comms status right-aligned with its age, stale values as the hourglass alone with a tooltip, full labels, no check mark, the hourglass before "No active alarms" when stale; the same on the phone sheet.
- Esc does not close the popup (bug, item 14).
- "Bad_NotFound" shown to the operator on Point 3 (item 15).

## 4. Live state: the dev map with `/live`

Open http://localhost:9088/data/perspective/client/mapstudio-dev/live and sign in (**Log in** at the top left). The buttons are the rows across the top, starting with **P12 pressure 400** and **P12 pressure 950** right after Log in; the page's own dev map is under them, so one window is enough. The buttons are named after the **asset**; the dev map's points have their own names:

| Button names | Point on the dev map | Find it |
|---|---|---|
| P12 | **Point 1** | search "Point 1" |
| P14 | **Point 2** | search "Point 2" |
| L3 | **Tracer line** (Point 1 to Point 2) | search "Tracer" |

Values reach the map within the refresh interval (10 s), so give each press a moment.

- [x] **P12 pressure 400 / 950**: Point 1's value changes.
- [x] At 950, Point 1 raises its "High pressure" alarm: triangle and digit on the marker, Needs you counts it. **Acknowledge P12**: the triangle's sounding mark (a small speaker) becomes "!" and the popup says "acknowledged"; **P12 pressure 400** clears it.
- [x] **P12 comms off**: Point 1 shows comms lost in magenta with its chip, Needs you counts it; **P12 comms on** restores it.
- [x] **P14 pressure bad**: Point 2 goes stale (hourglass, no colour, value marked stale); **P14 pressure good** restores it.
- [x] **P12 status 0 to 4**: Point 1's style changes (Attention, Warning, Fault rings with words, Out of service faded).
- [x] **L3 flow 20 / 120 / 300**: the Tracer line's look follows its Bands rule.
- [x] An alarm always draws over a style; stale drops the style until a fresh value.

Notes:

- A selected marker's selection ring is cut off at its edges, with a style ring or a dashed state ring (item 16).
- The popup of a line with no instruments shows a meaningless segment block, "Segment Line start to Line end / No value to No value" (item 17).
- With comms lost the alarm block's heading reads "Stale - 1 alarm - Priority 1, unacknowledged" and wraps (goes with item 13).
- Stale values say "(Bad)" or "(comms lost)" after the value: goes with the popup rework (item 13) and plain words (item 15).

## 5. Lines and instruments

On the dev map (`/`), find L-SWD (CTB1 to SWD1) or on the showcase.

- [x] PT-1, LV-1 and PT-2 sit at their places on the line.
- [x] Click the line between PT-1 and PT-2: the line popup opens at "Segment PT-1 to PT-2", lists the instruments in order with distances and values, and highlights the two ends on the map and in the list.
- [x] `/live` **PT1 comms off**: the segments either side of PT-1 dash; **PT2 pressure 500**: the segments either side of PT-2 show attention; **PT2 pressure 950** raises PT-2's alarm at its place on the line.
- [x] A selected line shows the flow arrow; only the selected one.
- [x] Two sites within 20 m (Shared A and Shared B on the dev map) are one marker that opens a pick list.

Notes:

- The line popup can sit over the top bar, and near the top of the map it is cut off (item 18).
- Keep the segment, comms, the line's values and alarms at the top and scroll only the instrument list (item 19, render).
- Opened from search, Shared A's popup points beside the shared marker at a high zoom (item 20); a site with no data shows check marks beside "No value yet" (item 21); more than one flow arrow on a long line (item 22).
- PT1 comms off dashes the line, PT2 pressure 950 shows the alarm, L-SWD quiet resets everything.

## 6. Zoom card, Legend and basemaps

- [x] Zoom card top-right: plus, the zoom level, minus, Fit (fits the field), Return (disabled with nothing selected; recentres on a selection).
- [x] Legend bottom-left: opens and closes by click, Enter/Space and Esc; the key matches what the map draws; Lines and Names toggles hide and show, and are remembered when the page reloads.
- [x] Basemaps: None, OpenStreetMap (real tiles here), Satellite (needs a Mapbox token, below); attribution shown.
- [ ] Labels stay readable over OpenStreetMap (halos), lines stay visible. (Fine over Satellite, hard over OpenStreetMap: item 25, a quiet OpenStreetMap.)

Notes:

- The open legend grows over the top bar (item 23); whether to list every kind (item 24); hard to read over OpenStreetMap, fine over Satellite (item 25). Basemap and the Show toggles move to the gear after 0.3.0 (story 12).

## 7. Phone (390 px)

Your phone (see `docs/development.md` for binding the Gateway to your LAN) or the browser's device mode at 390 px.

- [x] One top bar: search and Needs you; it expands on tap.
- [x] Tapping a site opens a bottom sheet (handle, close, values, alarm block, View alarms), clear of the App Bar button; no pointer.
- [x] Every button is comfortably tappable (44 px).
- [ ] The legend, the zoom card and the attribution fit without covering what you need.

Notes:

- The bottom sheet looks good.
- The Needs you list opens under the zoom card (item 26); Return and search choices centre the item under the sheet (item 27); the legend grows over the top bar and cuts off Show (item 23, the bottom sheet of item 3).

## 8. Custom popup view, links, alarm page

- [x] On the showcase, click SWD1: its kind uses a custom popup view (`Popups/SiteCard`) with Map Studio's close row above it, on desktop and as the phone sheet.
- [ ] Optional: the page link icon hides instead of opening a broken link when its placeholder has no value. Not a Designer step in 0.3.0 (kind setups have no editor until epic-editing, and every seeded link uses `{item.name}`, which always has a value); the automated test covers it (`e2e/tests/popup.spec.mjs`, "the page link ... hidden with no value": the pad link set to `/pad/{asset.id}`, then Pad 1, which has no asset, shows no icon).

Notes:

## 9. Dark theme and the review states

- [x] Showcase `/dark` (reload once after it opens, item 29): the same map in Perspective's dark theme; every state still reads (magenta comms lost, alarm hues, chips).
- [x] `/styles`, **Showcase review alarms / stale / off**: the showcase shows every alarm priority and acknowledgement state, the stale states, then quiet again. Compare with `docs/review-er27.md` while you do the ER-27 review.

Notes:

- The scroll bars are wide and loud, mostly in the dark theme (item 28).
- The map stays light on `/dark` until a reload: the map reads the theme once when it opens (item 29).

## 10. Designer: the setup form

Open the Designer on the dev project, Project Browser, **Map Studio Setup**.

- [x] Database connection, roles, kind and asset functions, refresh interval, basemaps, alarm page and map token read sensibly and save; a change applies without a Gateway restart.
- [ ] A wrong value (an unknown role, an empty connection) is explained beside its field.

Notes:

- Map token's two combo boxes (provider and secret name) become two labelled rows (item 31).

## 11. When things go wrong

- [x] `/adapters` (signed in): **Adapter: empty / broken / slow / incomplete** each give a plain-words status in the result line at the bottom of the page (the map itself shows no status in 0.3.0: showing it to people is epic-editing's; the map keeps drawing from the last good list); **Adapter: ok** recovers. **Adapter: unknown icon** draws that kind as a plain point.
- [x] Two windows on `/edit`: draw a line in one (the spike's "Draw a line", Enter to finish); it shows in the other within seconds, with no reload.
- [x] A viewer (not signed in) cannot save: drawing is not offered on `/`.
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
