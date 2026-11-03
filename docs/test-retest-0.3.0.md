# Short re-test: 0.3.0 after the owner's review notes

About 25 minutes. Only what the review notes changed and what the automated suite cannot see (it ran 109 end-to-end checks green on the merged build). The full walk-through stays in [test-playbook-0.3.0.md](test-playbook-0.3.0.md).

Setup: `git pull`, `./gradlew clean`, `ops/up.sh --fresh`, sign in as `mapeditor` on `/edit` and press **Seed the dev map**. Showcase: http://localhost:9088/data/perspective/client/mapstudio-showcase. Dev map: `.../mapstudio-dev/` (`/live` for the buttons).

## 1. Showcase at a laptop size (5 min)

- [ ] Top bar: "Search assets" with a chevron (opens an A to Z list, typing filters); the bar shows a red bell 1, comms lost 1, stale 1 and no words; hovering it keeps its background.
- [ ] Dots below zoom 14 are bigger; the tap, meter and valve icons read clearly; L-GL21 is now as thick as its size says.
- [ ] Click P14: option A card (comms right-aligned, values right-aligned, the alarm block). Esc closes it.
- [ ] Click P21: the hourglass before each value (hover one for the reason), the hourglass before the alarm words.
- [ ] Click L-SWD near the top of the map: the card stays inside the map, clear of the top bar and the zoom card; only the instrument list scrolls; selected, the arrows repeat along the line.
- [ ] L-SWD's Comms row is one line, "OK - 3, oldest 39 min" (or "Comms lost - 1 of 3"); hover it for the full sentence, and on the phone tap it to see the sentence under the row.
- [ ] Legend: stops below the top bar, States first, thin scroll bar; the scale bar sits level with the Legend button; the attribution is small, bottom-right.

## 2. Dev map with `/live` (5 min)

- [ ] Point 3: comms reads "No data" (hover for the reason), no check mark, "Alarm state unknown".
- [ ] **P12 pressure 950**, then **Acknowledge P12**: the badge turns to the outlined triangle with "!"; select Point 1: its rings are not cut off.
- [ ] Tracer line: its popup has no segment block.
- [ ] Shared A at zoom 18: two markers; at zoom 16 one marker whose popup points at it.
- [ ] OpenStreetMap: quieter, labels and lines easy to read. Satellite (with your token): the Mapbox logo bottom-right with the four attribution links (beside them on a wide map; on a phone the logo left of the App Bar toggle and the links one line above it), nothing covering the App Bar toggle, the zoom card or the Legend button.

## 3. Phone, 390 px device mode (4 min)

- [ ] Tap a site, then Return: the site sits above the sheet, not under it.
- [ ] Needs you list opens over the zoom card; Legend opens as a bottom sheet with the toggles first and no basemap section.

## 4. Dark (3 min)

- [ ] Open the showcase's `/dark` with no reload: the map itself turns dark (not only the panels); thin scroll bars.

## 5. By hand only (8 min)

- [ ] Gateway stopped: with a map open, `docker stop <gateway container>`: a chip says the connection is lost, values show as stale, the bell shows "?"; `docker start`: it recovers by itself. Then re-seed.
- [ ] Designer, Map Studio Setup: Map token is two labelled rows (provider, secret), saves as before.
- [ ] After a restart, the showcase still shows SWD1 stale without re-seeding (item 10).

Notes:
