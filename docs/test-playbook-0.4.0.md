# Test playbook: Map Studio 0.4.0 (epic 4) on your local stack

A walk through what epic 4 has built so far, grouped by what you do, on the local development stack. Tick each box and note anything that looks or feels off in the Notes line under each section (a screenshot helps). Each note goes into `_bmad-output/initiative-flowmap/tickets/epic-editing/epic-editing.md` Notes or a new entry. The playbook grows as entries land; entry 18 (the 0.4.0 release) finishes it for the release test and the 30-minute test.

Built so far (2026-11-07): entries 1 to 6, 21 to 27, 14 and 15. Still to come: 16 (Directions, Nearest, distances), 7 (the item list as designed, the checklist), 8 (selecting several), 9 (instruments), 10 (save problems), 11 (Recent changes and History), 12 and 13 (the Kinds screen, the tag browser), 19 and 20 (units), 17 (sweep), 18 (release).

## Results so far

| Section | Result | Date |
|---|---|---|
| 0. Before you start | | |
| 1. Edit mode and the studio | | |
| 2. Adding items | | |
| 3. Changing geometry | | |
| 4. Delete, Undo and the keys | | |
| 5. A click opens Details | | |
| 6. The item form | | |
| 7. The place check | | |
| 8. The page's events | | |
| 8a. You are here and Locate me | | |
| 9. View mode, unchanged | | |
| 10. Phone (390 px) | | |
| 11. Designer | | |

## 0. Before you start

- [ ] `git pull`, then `ops/up.sh` (after a pull that changes the dev Gateway's config, or when the stack looks wrong: `ops/up.sh --fresh`, then seed again).
- [ ] Signed in as `mapeditor` (`MAPSTUDIO_EDITOR_PASSWORD` in `.env`), not the Gateway's admin user: admin has no MapEditor role, so the map stays in View mode with no Edit switch.
- [ ] Seeded: http://localhost:9088/data/perspective/client/mapstudio-dev/edit, **Seed the dev map** pressed once (after a `--fresh`).
- [ ] A window at least 1366 px wide for sections 1 to 8 (below 768 px the map keeps View mode).
- [ ] The Gateway trial has time left.

Pages used below, in the dev project: `/` (View mode), `/edit` (opens in Edit mode), `/adapters` (the kind and asset list modes), `/events` (the page's events), `/locate` (you are here), `/styles`, `/live`.

Notes:

## 1. Edit mode and the studio

On `/`, then `/edit`.

- [ ] The Edit switch sits top right ("Edit map"); turning it on opens the docked studio: the rail on the left, the Items list, and the toolbar beside the Editing switch on the top row. Turning it off returns to View mode with the map where it was.
- [ ] In Edit mode the View-mode search and the Needs you bar are gone from the map; the Items list has its own "Search items" field, and typing filters the list.
- [ ] Layers on the rail opens two tabs: Layers (Lines and Names, the basemap) and Legend (the key). The Legend button is not on the map in Edit mode.
- [ ] Undo and Redo sit at the toolbar's end; hovering Undo names the step ("Undo: add Well pad (Ctrl+Z)"); the chevron beside it lists the last ten steps, and choosing one undoes down to it.
- [ ] Nothing pops up to say an edit saved: the save status in the list's header reads Saving..., then Saved. No toast, no mode pill.

Notes:

## 2. Adding items

- [ ] A kind button (Well pad) or the generic Point tool: the bar at the bottom names the tool ("New well pad - Click the map, then drag to fine-tune"); a click places the pad, Details opens with the cursor in Name.
- [ ] The Line tool: click from CTB1 towards SWD1, the bar shows the points and the length; finish with Enter, a double-click or Finish; Backspace removes the last point; Esc cancels.
- [ ] Snap (the magnet) is off by default; turned on, a line end near a pad shows "Snap to CTB1 - click to connect" and the end joins it.
- [ ] The Area tool: an area whose edges cross is refused in words before it finishes.
- [ ] A new item of a kind starts with that kind's last values (see section 6); its name is the kind's name until renamed.

Notes:

## 3. Changing geometry

- [ ] Drag a pad: it moves and saves; a line snapped to it moves its end with it (one undo step puts both back).
- [ ] Move in Details, then a click on the map: the pad goes there. Typing a latitude and longitude in Details moves it too.
- [ ] Select L-SWD: its points show handles; drag a point; insert one from a midpoint handle; choose a point and Delete point (Del); a line keeps at least two points.
- [ ] Split a line at a chosen point: two lines, each keeping the kind, its properties and the instruments on its part.

Notes:

## 4. Delete, Undo and the keys

- [ ] Select CTB1 and press Delete (or the delete icon in Details' footer): CTB1 goes, no "Are you sure?"; Ctrl+Z brings it back with its link and the line ends that named it.
- [ ] Delete L-SWD: its instruments (PT-1, LV-1, PT-2) go with it in one step; one Undo restores all four; Ctrl+Shift+Z deletes them again.
- [ ] With a drawing tool in hand, the delete icon is off and says why ("Off while a tool is in hand - Esc puts it down").
- [ ] Hover the controls: each names its key (Undo (Ctrl+Z), Redo (Ctrl+Shift+Z), Delete (Del), Select (Esc), Close (Esc), Clear the search (Esc)).

Notes:

## 5. A click opens Details

- [ ] In Edit mode a click on CTB1 selects it and opens Details, no popup; the pad stays under the pointer, so you can drag it straight away.
- [ ] A click on L-SWD selects it with its handles and Details; a click on an area (the North fence) does the same.
- [ ] A shared spot opens its pick list; a row selects that item with Details; with Details already open for another item, nothing on the map moves.
- [ ] With the Line tool in hand and Details open, Esc puts the tool down and Details stays; a second Esc closes Details.
- [ ] Known and logged for entry 7: a point placed with the Point tool, and closing Details, still shift the map sideways.

Notes:

## 6. The item form

- [ ] Select a pad: Details shows Operator, Wells and Status after Location; Status reads "Required" and "Missing: Status" shows at the top until it is set; the item still saves what it has.
- [ ] Type "abc" in Wells: "Wells takes a whole number", nothing saved; 3 saves as a number. A choice and a checkbox (a line's Buried) save at once. Each is one undo step.
- [ ] Set Operator to Acme, then place a new pad: it starts with Operator Acme, named "Well pad", not linked.
- [ ] Change a pad's kind to another point kind: the values the new kind defines stay, the rest go; Undo brings them back.
- [ ] Rename a second item to P14 while it is linked to another asset: Name is underlined in red, its tooltip names the other's folder ("Also the name of the item linked to Mesa/P14"); the save still goes through.
- [ ] On `/adapters`, switch the asset list to empty, then incomplete: the message shows under Asset in Details; switch back to ok. The `tank` mode shows an item of a kind no longer in the list as "Unknown kind", its values read only, only Kind editable.
- [ ] Esc in a field puts the saved value back.

Notes:

## 7. The place check

In a point's Details, type into Latitude and Longitude.

- [ ] 32.7, -103.1: "Lea County, New Mexico, US" under the coordinates (the first time, briefly "Looking up the place...").
- [ ] 32.5, -103.07: "Lea County (near the Texas line), New Mexico, US".
- [ ] 29.64, -90.54: "Lafourche Parish, Louisiana, US".
- [ ] 55.17, -118.8: "Near Grande Prairie, Alberta, CA".
- [ ] 28.5, -90.5: "Gulf of Mexico, off Louisiana, US"; 30.0, -40.0: "North Atlantic Ocean".
- [ ] -103.1, 32.7: "Latitude and longitude look swapped", nothing saved until it reads.
- [ ] Hovering the place line names the sources; Zoom to location (beside Move) moves the map to the point.
- [ ] Put the coordinates back (Undo) when done.

Notes:

## 8. The page's events

On `/events`: a table of items beside the map, and a label per event.

- [ ] Choose P14's row: the map selects Point 2 (linked to P14), centres it with its popup; `onItemSelected` shows `mapItem` once.
- [ ] Click CTB1 on the map: the table selects CTB1's row.
- [ ] Choose L-SWD's row: it is fitted with its line popup; `onPopupOpen` shows its id and segment; closing the popup shows `onPopupClose`.
- [ ] Pan the map: `onViewportChanged` and the viewport label change once, when the pan ends, never while panning.
- [ ] `/events/<an item id>` opens with that item chosen once the map loads.
- [ ] In Edit mode, a row chosen while the Line tool is in hand waits until the tool is put down; the drawing is not touched.

Notes:

## 8a. You are here and Locate me

On `/locate`: the map's `userLocation` is bound to `{session.props.geolocation}`; the page turns the location on as it opens and has a Location off checkbox; the line under the toolbar shows the bound value. Your browser asks for location permission: allow it.

- [ ] The line under the toolbar shows your position (`latitude`, `longitude`, `accuracy`) and `"enabled":true`; in a browser `permissionGranted` reads `null` (only the Perspective mobile app sets it), which counts.
- [ ] In a browser and in the Perspective mobile app: a violet dot with a white ring sits at your position over a soft circle the size of the accuracy; with a heading (moving, on a phone) a wedge points your way and turns as the map turns.
- [ ] The zoom card's last button, after Return, is Locate me (a navigation arrow). Pan away and press it: the map centres on you at zoom 15, or keeps a closer zoom. The map never follows you on its own.
- [ ] Open the Legend: States end with the dot and "You are here". In Edit mode, the rail's Layers, Legend tab ends the same way.
- [ ] Click the dot: nothing is selected and no popup opens; search for "You are here": nothing; the item list in Edit mode has no row for it.
- [ ] Tick Location off: the marker and the legend row go; Locate me fades, its hover text "Locate me - location is off for this session", and a press does nothing. Untick: it comes back.
- [ ] Block the site's location permission in the browser and reload: Locate me says the location is off (the client turns it off when the browser refuses).
- [ ] At 390 px: the marker shows, Locate me is a 44 px target, and the Legend sheet's States end with "You are here".

Notes:

## 9. View mode, unchanged

On `/` (View mode), a quick pass over 0.3.0's behaviour.

- [ ] A click on a pad opens its popup card; on a line, the line popup at the clicked segment; Esc closes it.
- [ ] Search and Needs you work as in 0.3.0; the Legend button opens the key.
- [ ] Live values update (use `/live` to change a tag).

Notes:

## 10. Phone (390 px)

- [ ] At 390 px wide (the browser's device mode) the map stays in View mode with no Edit switch.
- [ ] A tap opens the bottom sheet; on `/events`, choosing a row opens the sheet and the events still fire.

Notes:

## 11. Designer

- [ ] In the Designer, the Map Studio component's event list shows four events: `onItemSelected`, `onViewportChanged`, `onPopupOpen` and `onPopupClose`, each with its payload (entry 14; no Designer runs in the build container, so this is the owner's check).
- [ ] The Map Studio Setup tab still reads and saves as in 0.3.0.

Notes:
