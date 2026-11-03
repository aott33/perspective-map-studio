# Short re-test: 0.3.0 after the owner's review notes

About 25 minutes. Only what the review notes changed and what the automated suite cannot see (it ran 109 end-to-end checks green on the merged build). The full walk-through stays in [test-playbook-0.3.0.md](test-playbook-0.3.0.md).

Setup: `git pull`, `./gradlew clean`, `ops/up.sh --fresh`, sign in as `mapeditor` on `/edit` and press **Seed the dev map**. Showcase: http://localhost:9088/data/perspective/client/mapstudio-showcase. Dev map: `.../mapstudio-dev/` (`/live` for the buttons).

## 1. Showcase at a laptop size (5 min)

- [x] Top bar: "Search assets" with a chevron (opens an A to Z list, typing filters); the bar shows a red bell 1, comms lost 1, stale 1 and no words; hovering it keeps its background.
- [x] Dots below zoom 14 are bigger; the tap, meter and valve icons read clearly; L-GL21 is now as thick as its size says.
- [x] Click P14: option A card (comms right-aligned, values right-aligned, the alarm block). Esc closes it.
- [x] Click P21: the hourglass before each value (hover one for the reason), the hourglass before the alarm words.
- [x] Click L-SWD near the top of the map: the card stays inside the map, clear of the top bar and the zoom card; only the instrument list scrolls; selected, the arrows repeat along the line.
- [x] L-SWD's Comms row is one line, "OK - 3, oldest 39 min" (or "Comms lost - 1 of 3"); hover it for the full sentence, and on the phone tap it to see the sentence under the row.
- [x] Legend: stops below the top bar, States first, thin scroll bar; the scale bar sits level with the Legend button; the attribution is small, bottom-right.

Notes (owner, 2026-11-03):

- The top bar looks better. Closing a popup makes the Needs you icons flash (R1).
- With L-SWD's popup open, panning the map carries the card over the top bar and the zoom card; the card should go under the controls (R2).
- The legend stops below the top bar; make it as wide as the search field so fewer rows wrap (R3).

## 2. Dev map with `/live` (5 min)

- [x] Point 3: comms reads "No data" (hover for the reason), no check mark, "Alarm state unknown".
- [x] **P12 pressure 950**, then **Acknowledge P12**: the badge turns to the outlined triangle with "!"; select Point 1: its rings are not cut off.
- [x] Tracer line: its popup has no segment block.
- [x] Shared A at zoom 18: two markers; at zoom 16 one marker whose popup points at it.
- [x] OpenStreetMap: quieter, labels and lines easy to read. Satellite (with your token): the Mapbox logo bottom-right with the four attribution links (beside them on a wide map; on a phone the logo left of the App Bar toggle and the links one line above it), nothing covering the App Bar toggle, the zoom card or the Legend button.

Notes (owner, 2026-11-03):

- All as expected; P12 pressure 400 clears the alarm.
- View alarms leaves the map for the alarm page, and coming back loses the map's place (R4).
- Close markers could look like a stack (R5).
- Satellite: the logo and the attribution are both required by Mapbox's guide.

## 3. Phone, 390 px device mode (4 min)

- [x] Tap a site, then Return: the site sits above the sheet, not under it.
- [x] Needs you list opens over the zoom card; Legend opens as a bottom sheet with the toggles first and no basemap section.

Notes (owner, 2026-11-03):

- Return keeps the site above the sheet. The open Needs you list works, but the bar's open (grey) state keeps its rounded bottom-right corner over the list, which looks unfinished (R6).

## 4. Dark (3 min)

- [x] Open the showcase's `/dark` with no reload: the map itself turns dark (not only the panels); thin scroll bars.

## 5. By hand only (8 min)

- [ ] Gateway stopped: with a map open, `docker stop <gateway container>`: a chip says the connection is lost, values show as stale, the bell shows "?"; `docker start`: it recovers by itself. Then re-seed.
- [ ] Designer, Map Studio Setup: Map token is two labelled rows (provider, secret), saves as before.
- [ ] After a restart, the showcase still shows SWD1 stale without re-seeding (item 10).

Notes:
