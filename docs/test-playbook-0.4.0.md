# Test playbook: Map Studio 0.4.0 (epic 4) on your local stack

A walk through what epic 4 has built so far, grouped by what you do, on the local development stack. Tick each box and note anything that looks or feels off in the Notes line under each section (a screenshot helps). Each note goes into `_bmad-output/initiative-flowmap/tickets/epic-editing/epic-editing.md` Notes or a new entry. The playbook grows as entries land; entry 18 (the 0.4.0 release) finishes it for the release test and the 30-minute test.

Built so far (2026-11-09): entries 1 to 6, 21 to 27, 14, 15, 16, 7a (the item list as designed), 7c (the layout), 7b (the checklist), 8 (selecting several) and 9 (instruments). Still to come: 10 (save problems), 11 (Recent changes and History), 12 and 13 (the Kinds screen, the tag browser), 19 and 20 (units), 17 (sweep), 18 (release).

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
| 8b. Directions, Nearest and distances | | |
| 8c. The item list | | |
| 8d. The layout | | |
| 8e. First run | | |
| 8g. Instruments | | |
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
- [ ] Hover the controls: each names its key (Undo (Ctrl+Z), Redo (Ctrl+Shift+Z), Delete (Del), Select (Shift-drag for a box, Shift+Alt-drag for a lasso), Close (Esc), Clear the search (Esc)).

Notes:

## 5. A click opens Details

- [ ] In Edit mode a click on CTB1 selects it and opens Details, no popup; the pad stays under the pointer, so you can drag it straight away.
- [ ] A click on L-SWD selects it with its handles and Details; a click on an area (the North fence) does the same.
- [ ] A shared spot opens its pick list; a row selects that item with Details; with Details already open for another item, nothing on the map moves.
- [ ] With the Line tool in hand and Details open, Esc puts the tool down and Details stays; a second Esc closes Details.
- [ ] A point placed with the Point tool, and closing Details, no longer shift the map sideways (entry 7c, section 8d).

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

Browsers give a position only on `https` or `localhost`: `http://localhost:9088` works on the machine running the stack; a phone opening `http://<your LAN address>:9088` gets no position (Locate me stays "no location fix yet" or off), so test the phone through the Perspective mobile app or an `https` address, or use the browser's device emulation with a sensor override at 390 px.

- [ ] The line under the toolbar shows your position (`latitude`, `longitude`, `accuracy`) and `"enabled":true`; in a browser `permissionGranted` reads `null` (only the Perspective mobile app sets it), which counts.
- [ ] In a browser and in the Perspective mobile app: a violet dot with a white ring sits at your position over a soft circle the size of the accuracy; with a heading (moving, on a phone) a wedge points your way and turns as the map turns.
- [ ] The zoom card's last button, after Return, is Locate me (a navigation arrow). Pan away and press it: the map centres on you at zoom 15, or keeps a closer zoom. The map never follows you on its own.
- [ ] Open the Legend: States end with the dot and "You are here". In Edit mode, the rail's Layers, Legend tab ends the same way.
- [ ] Click the dot: nothing is selected and no popup opens; search for "You are here": nothing; the item list in Edit mode has no row for it; the Needs you bar's counts are the same with the location on and off.
- [ ] Tick Location off: the marker and the legend row go; Locate me fades, its hover text "Locate me - location is off for this session", and a press does nothing. Untick: it comes back.
- [ ] Chrome DevTools, Sensors, Location set to another city: the dot moves there and the camera stays; press Locate me to follow it.
- [ ] Block the site's location permission in the browser and reload: Locate me says the location is off (the client turns it off when the browser refuses).
- [ ] At 390 px: the marker shows, Locate me is a 44 px target, and the Legend sheet's States end with "You are here".

Notes:

## 8b. Directions, Nearest and distances

On `/locate` (Directions on, the template field empty) with your position as in 8a; `/` has Directions on too, `/live` has it off. Make a pad's alarm on `/live` (pressure high on P12, which is Point 1) for the View alarms rows, and put it back after (pressure low, ack).

- [ ] Click Point 1: the card ends in a footer under a rule, **Directions** (a route glyph and the word, a plain button) then **View alarms** (the filled button), side by side, the same height and width. View alarms is no longer inside the red alarm block.
- [ ] Press Directions on a computer: a new tab opens Google Maps with the route to Point 1 from where you are, ready to start. Nothing on the map changes and no route is drawn.
- [ ] Click the Tracer line: its popup has no Directions. Click a pad with no alarm: Directions alone fills the footer. On `/live`, Point 1's footer is View alarms alone, filling the row.
- [ ] Type `https://www.openstreetmap.org/directions?route=;{lat},{lng}` in the template field, press Tab, open Point 1 again and press Directions: that link opens with Point 1's coordinates. Type `javascript:alert(1)` instead: the Google route opens, and the browser console has one Map Studio warning that the template is ignored. Empty the field.
- [ ] Open the search's chevron with no text: an **A-Z | Nearest** switch sits at the top, A-Z chosen. Press Nearest: ten items, the nearest first, each with its distance at the right in grey (miles and feet in an en-US browser, kilometres and metres otherwise). Choose one: the map zooms to it and opens it, as a search result does. Type a letter: the usual results, no switch; clear it: Nearest is still chosen.
- [ ] Keyboard only: in the empty field, ArrowRight and ArrowLeft turn the switch; Tab reaches it; ArrowDown goes back to the list; Enter chooses.
- [ ] Open Needs you: every row ends with its distance at the right; the order is still alarms, then comms lost, then stale.
- [ ] Tick Location off: no switch on the search list and no distances on Needs you; Directions still shows in the popup.
- [ ] At 390 px: the sheet's footer is Directions and View alarms at 44 px, with no Edit button; the switch parts are 44 px tall.
- [ ] **On a real iPhone or iPad** (the Perspective mobile app, or Safari on an `https` address): Directions opens Apple Maps with the route to the pad, named. **On an Android phone**: Google Maps opens with the route. Note what opens (the app, or a browser tab) and whether the route starts from where you are; this hand-over is not checked by the suite.
- [ ] Your browser's language set to English (UK) or another language: distances read in metres and kilometres ("430 m", "1.1 km"); English (US): feet and miles ("330 ft", "2.3 mi").

Notes:

## 8c. The item list

On `/edit`, at 1366 or 1440 px, after **Seed the dev map** (it adds `P14 lease`, the one child on the dev map). Make Point 1's alarm on `/live` (pressure high) for the Needs attention check, and put it back after (pressure low, ack).

- [ ] The list opens grouped by place, sorted by **Needs attention**: a `MESA FIELD` header (with "N NEED ATTENTION" on its right while something needs attention), the sites (CTB1, SWD1, Point 1, Point 2, Point 3, PT-1, PT-2, LV-1), then a **Field-wide** sub-group with L-SWD and the Tracer line, then **Not linked** with the 30 scale pads, their lines, the shared pair and the North and South fences.
- [ ] `P14 lease` sits indented under Point 2 with "on Point 2" under its name (its asset folder `Mesa/P14/Lease` is inside P14's).
- [ ] With Point 1 in alarm: Point 1 is the first row under `MESA FIELD`, Point 3 (comms lost) after it, then an **All normal** divider and the rest by name. When the alarm clears the divider and the count go.
- [ ] **Sort by** Place: the same groups by name, no divider. Kind: one header per kind ("Gathering line", "Geofence", ...). Name: one flat list A-Z. Last changed: newest first, each row with who and when under its name ("seed-script - Today 10:42"; Yesterday, or a date, for older changes).
- [ ] **Filter**: the button opens the kind chips ("All 75", "Well pad 37", ...). Pick Well pad: only pads are listed, in every sort, and the button reads "Well pad". All brings everything back.
- [ ] Type "swd" in Search items: SWD1 under `MESA FIELD` and L-SWD under Field-wide, nothing else. Type "lease": Point 2 shows too (in grey) with P14 lease under it.
- [ ] The footer: **Add item** picks up the Point tool (the toolbar's Point lights up); click the map: the new pad heads a **Just added** group at the top, in every sort. Undo removes it from the list. A page reload empties Just added.
- [ ] "N unlinked" in the footer: pressing it leaves only the Not linked rows, with a cross to show everything again.
- [ ] Rename an item, then sort by Last changed: it is first, with your user name and "Today" and the time.
- [ ] Badges still change live (an alarm, comms lost, stale) and a row click still selects the item, opens Details and pans the map.

Notes:

## 8d. The layout

On `/edit` after **Seed the dev map**, in a browser window you can resize (or the browser's device toolbar at a fixed width). The rule: whenever a panel docks or undocks beside the map, nothing on the map moves on the page.

- [ ] At 1440 px or wider: the rail 72 px, the list 280 px, Details 340 px; the map about 748 px wide with an item selected.
- [ ] At 1366 px: the list 256 px and Details 320 px; the map about 718 px with a selection, 1038 px without.
- [ ] Pick the Point tool and click the ground: Details opens beside the map and the new pad stays exactly where you clicked (no jump of about 160 px). Undo.
- [ ] Place a pad near the map's left edge, where Details lands: it slides just into view, about 48 px inside the map's left edge.
- [ ] Draw a two-point line and press Enter: its points stay where you clicked as Details opens. Undo.
- [ ] Click CTB1, then close Details three ways (a click on the ground, its close, Esc): each time CTB1 and every other item stay where they are as the map widens.
- [ ] Narrow the window below 1280 px (1200): the list leaves the dock, the map widens, and nothing on the map moves. The toolbar is on the top row beside the Editing switch, clear of it, with or without Details open.
- [ ] Below 1280 px, the rail's **Items** opens the list over the map's left edge (header, groups, footer, the same list). Items again closes it; so do Esc (the focus back on Items) and a click on the map. Choose a row: the list closes and that item opens in Details; press Esc straight away and Details closes (no click needed). Sort the open list by Name, choose a row, open the list again: still by Name.
- [ ] Below 1280 px, Layers and Kinds still dock in the list's place (the map moves nothing as they come and go); at 1200 px with Layers alone the toolbar stays on the top row.
- [ ] At 1024 px, open an item in Details: the map is too narrow for the toolbar beside the Editing switch, so it drops to the row under the switch and never covers it; close Details and it goes back up.
- [ ] Widen the window past 1280 px again: the list docks, and the items stay where they were on the page.
- [ ] At 1440, 1366 and 1200 px with Details open: nothing but the small attribution text in the map's bottom-right corner (the Perspective App Bar toggle's spot).

Notes:

## 8e. First run

On the empty project `mapstudio-empty` (the dev project mounted a second time, with a map of its own; `ops/up.sh` mounts it, a stack from before entry 7b is recreated once): `http://localhost:9088/data/perspective/client/mapstudio-empty/empty`, at 1366 or 1440 px. Sign in as the map editor first with **Log in** on that project's `/edit` page. If the map is not empty (an earlier try), delete its items in Edit mode and press **Delete the kind setup**. The kept flags are per project and user in this browser: a private window starts fresh.

- [ ] In Edit mode the card **Get mapstudio-empty on the map** sits centred over the map (never bottom-right): "Three steps. Edits save as you go.", the three steps with their buttons, "0 of 3 done" and **Hide checklist**. The list says "No items yet - Items you add or import are listed here, grouped by place."
- [ ] **Open Kinds** opens the rail's Kinds surface (still "Nothing here yet"). Press **Save a kind setup** on the page: step 1 gets a check and the footer reads "1 of 3 done" within a second or two, with no reload. **Delete the kind setup**: it unticks.
- [ ] **Open view mode**: View mode, and a small note "Nothing on this map yet." in the middle of the map. Turn the Edit switch on: step 3 is ticked.
- [ ] **Add an item**: the Point tool is in hand and the card goes; **Done** on the bar brings it back. Pick it up again and click the map: the pad is placed and saved, and the card does not come back. Delete the pad: the card is back.
- [ ] Tab moves through the card's four buttons; Esc does not hide the card. **Hide checklist**, then reload the page: no card. (A private window, or another user, still sees it.)
- [ ] Sign out (or a private window, not signed in): View mode only, the empty map and "Nothing on this map yet.", no Edit switch.
- [ ] Narrow the window to 1200 px: the card still fits the map, centred.
- [ ] On the dev project's `/edit` after **Seed the dev map**: no card in Edit mode, no note in View mode.

Notes:

## 8f. Selecting several

On `/edit` at 1366 px after **Seed the dev map**, in Edit mode as the map editor.

- [ ] Each list row starts with a checkbox. Tick Point 1, Point 2 and CTB1: the panel beside the list reads **3 selected** with **Clear** and the delete icon in its footer, no fields; the three rows are tinted and the three markers ringed on the map. A plain row click selects that one item alone with Details, as before.
- [ ] Click Point 1's row, then Shift-click SWD1's row: every row between them, in the order shown, is selected.
- [ ] Under the MESA FIELD header, **Select all in MESA FIELD** selects that field's rows; other group headers carry **Select all in group**. Filter on Well pad (or type in Search items): **Select all in filter** appears above the list and selects every row shown.
- [ ] With Select in hand (no tool), Shift-drag a box over CTB1 and SWD1: a dashed box over a light tint follows the pointer; on release both join, and L-SWD joins as it crosses the box. The map does not zoom. Esc during the drag cancels it with nothing selected.
- [ ] Shift+Alt-drag a lasso round the Mesa pads (Point 1 to 3): every pad inside joins, and every line crossing it.
- [ ] Shift-click CTB1 on the map while it is selected: it leaves the set; Shift-click again brings it back.
- [ ] With three pads selected press Delete (or the footer's delete icon): all three go as one change; the Undo button reads "Undo: delete 3 items"; one Undo restores them all.
- [ ] Select L-SWD and PT-1 and delete them: the line goes with all its instruments in one change ("Undo: delete 2 items"); Undo restores the line and its instruments.
- [ ] With three selected, switch the rail to Kinds and back: still three. A click on the empty map, **Clear**, or Esc empties the set and closes the panel.
- [ ] On `/events`, turn Edit mode on and select three: the **selectedItems** label lists their ids in the order they joined and **onSelectionChanged** counts one more per change; Clear: `selectedItems:` empty, one more event.
- [ ] Turn Edit mode off and Shift-drag on the map: MapLibre zooms into the box, as before; nothing is selected.

Notes:

## 8g. Instruments

On `/edit` at 1366 px after **Seed the dev map**, in Edit mode as the map editor. An instrument is only added from its line (no toolbar tool) and only moves along it.

- [ ] Select L-SWD: its Details show **Instruments** after Location: PT-1 1.1 km, LV-1 2 km, PT-2 2.8 km, in that order. Click PT-1 in the row: PT-1 is selected with its Details.
- [ ] Back on L-SWD, press **Add an instrument**: a short list offers Tap, Line valve and Meter (the Meter glyph is new: a flow meter on the line). Pick Tap: the bar at the bottom reads "New tap on L-SWD - click the line or type its distance", with a distance field, "of 2,922 m", Place and Cancel; the map shows a crosshair.
- [ ] Click the empty map, then another item: the bar says "Click on L-SWD: an instrument sits on its line" and nothing saves. Click L-SWD near PT-1: a tap appears there, its Details open with the cursor in Name ("Tap"); Location reads "On L-SWD at ...". The Undo button reads "Undo: add Tap".
- [ ] Add a Meter and type 99999, Enter: "Type a distance from 0 to 2,922 m", nothing saved. Type 2841 and press Place: the meter sits at 2.8 km, listed in L-SWD's Instruments row and in its line popup (View mode, click the line).
- [ ] Add an instrument and press Esc (or Cancel): the bar goes, nothing saves, L-SWD's Details stay.
- [ ] Select PT-1: Location reads "On L-SWD at 1.1 km" with **Distance along the line (m)**; latitude and longitude are read only and there is no Move; the Kind select lists Tap, Line valve and Meter only.
- [ ] Drag PT-1 along the line: a disc follows the pointer on the line; pull the pointer off to the side: the disc stays on the line. Release: PT-1 lands where the disc was, one change ("Undo: move PT-1"); the map did not pan.
- [ ] Type 1143 in PT-1's distance and press Enter: PT-1 goes back to 1.1 km, one change. Undo twice: the drag's place, then 1.1 km again.
- [ ] Reshape L-SWD (drag its bend), delete it (Delete key), then Undo: the instruments, a tap you added among them, stay on the reshaped line, go with the delete, and come back with the one Undo.
- [ ] The toolbar's kind buttons are Well pad, Gathering line and Geofence; the Point tool adds a well pad, and a pad's Kind select offers no Tap, Line valve or Meter.

Notes:

## 9. View mode, unchanged

On `/` (View mode), a quick pass over 0.3.0's behaviour.

- [ ] A click on a pad opens its popup card (View alarms in its footer since entry 16, with Directions where the page turns it on); on a line, the line popup at the clicked segment; Esc closes it.
- [ ] Search and Needs you work as in 0.3.0; the Legend button opens the key.
- [ ] Live values update (use `/live` to change a tag).

Notes:

## 10. Phone (390 px)

- [ ] At 390 px wide (the browser's device mode) the map stays in View mode with no Edit switch.
- [ ] A tap opens the bottom sheet; on `/events`, choosing a row opens the sheet and the events still fire.

Notes:

## 11. Designer

- [ ] In the Designer, the Map Studio component's event list shows five events: `onItemSelected`, `onViewportChanged`, `onPopupOpen`, `onPopupClose` and `onSelectionChanged` (entry 8), each with its payload, and the props list `selectedItems` read-only after `selectedItem` (entries 14 and 8; no Designer runs in the build container, so this is the owner's check).
- [ ] The Map Studio Setup tab still reads and saves as in 0.3.0.

Notes:
