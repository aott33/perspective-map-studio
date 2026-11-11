# Test playbook: Map Studio 0.4.0 (epic 4) on your local stack

A walk through what epic 4 has built so far, grouped by what you do, on the local development stack. Tick each box and note anything that looks or feels off in the Notes line under each section (a screenshot helps). Each note goes into `_bmad-output/initiative-flowmap/tickets/epic-editing/epic-editing.md` Notes or a new entry. The playbook grows as entries land; entry 18 (the 0.4.0 release) finishes it for the release test and the 30-minute test.

Built so far (2026-11-10): entries 1 to 6, 21 to 27, 14, 15, 16, 7a (the item list as designed), 7c (the layout), 7b (the checklist), 8 (selecting several), 9 (instruments), 10 (save problems) and 11a (the edit record, Gateway only). Also built: 11b (Recent changes and History), 12a (the Kinds surface and a kind's setup), 12b1 (the style rule editor and area tints, section 8l) 12b2 (the preview item on the map and the Live now note, section 8m) 12c1 (Details' Live now block and path overrides, section 8n) and 12c2 (the Style tab and an item's own style rule, section 8o). Still to come: 13 (the tag browser), 19 and 20 (units), 17 (sweep), 18 (release).

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
| 8h. Save problems | | |
| 8i. The edit record | | |
| 8j. Recent changes | | |
| 8k. Kinds and a kind's setup | | |
| 8l. The style rule editor and area tints | | |
| 8m. The preview item on the map | | |
| 8n. Live now and path overrides | | |
| 8o. The Style tab and an item's own style rule | | |
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

## 8h. Save problems

On `/edit` at 1366 px after **Seed the dev map**, in Edit mode as the map editor, with a second browser (a private window) signed in as the phone editor `mapoperator` on `/edit`. One card at a time shows on the map under the toolbar; the save status row in the list's header keeps its words and its list. No toasts.

- [ ] **Conflict.** In the first browser select P14 and leave Details open. In the second, move P14 (its sheet's Edit, Move). Before the first browser shows it moved, type an Operator in P14's Details and press Enter (if it already moved, unplug the network for a moment while the second saves, or use the store-checks conflict). The row reads "Not saved - conflict with mapoperator's change" and a card under the toolbar reads "Not saved - conflict with mapoperator's change", "mapoperator moved P14 about ... north at <time>, while you were editing it." and "Your change, kept here and not saved: Operator ...", with **Use mapoperator's version** and **Apply mine on top**. Compare it with [key-screen-9 conflict](../_bmad-output/initiative-flowmap/ux-map-studio/mockups/key-screen-9-save-states-conflict.png).
- [ ] The card took no focus: Tab from the toolbar reaches its buttons. Esc in it closes it and the edit stays on the row (open the row: Try again and Discard).
- [ ] Make another conflict and press **Use mapoperator's version**: the card and the row go, the header says Saved, P14 stays where the phone editor put it, with no Operator.
- [ ] Make another and press **Apply mine on top**: it saves (Saved), P14 keeps the phone editor's place and shows your Operator. The Undo button reads "Undo: edit P14"; Undo puts the phone editor's version back.
- [ ] In the second browser delete an item the first has a pending edit on (the same way): the card offers only **Use mapoperator's version**, saying "It was deleted, so your change cannot go on top of it."
- [ ] **Store unreachable.** Open `/edit` in a second tab too. Stop the store: `docker stop <MAPSTUDIO_CONTAINER>-pg` (the name in `.env`). Change one pad's Operator in the first tab and another pad's in the second (the first answer pauses that tab's editing within a second, so the second edit is made in the other tab). Within seconds a card reads "Store unreachable" and "Your 2 edits are kept on this computer, not saved yet, and save when the store is back. Drawing and editing are paused; live values still update."; the toolbar fades, its buttons and Details' fields do nothing and say "Paused - the map store is unreachable" on hover; the items stay on the map and live values keep moving; Esc does not close the card. Compare it with [key-screen-9 unreachable](../_bmad-output/initiative-flowmap/ux-map-studio/mockups/key-screen-9-save-states-unreachable.png).
- [ ] Press **Show my 2 edits**: the row's list opens in the dock with both edits, the focus in it.
- [ ] Start the store (`docker start <MAPSTUDIO_CONTAINER>-pg`) and press **Try again** (or wait 15 s): both save, the card goes, the toolbar comes back.
- [ ] **A lost connection is unchanged**: stop the Gateway container instead (`docker stop <MAPSTUDIO_CONTAINER>`) and draw a line: the chip says no connection, the toolbar stays on, and the line waits on the row; no card. Start it again.
- [ ] **Busy** is hard to make by hand (the Gateway's work pool full); the suite fakes it (`savestates.spec.mjs`). Check its screenshot `docs/screenshots/mapstudio-savestates-busy-1366.png` against [key-screen-9 busy](../_bmad-output/initiative-flowmap/ux-map-studio/mockups/key-screen-9-save-states-busy.png): "Not saved - Map Studio is busy", the sentence, "Your change, kept here: ...", **Try again** and **Discard my change**.
- [ ] **Second tab.** A tab that cannot send a batch leaves it in the browser's queue, and another open tab of the same browser now replays it within 15 s with no reload. The suite makes it (`savestates.spec.mjs`, R8: tab A's saves dropped by the test, tab B saves the line, both lists empty after). By hand: open `/edit` in two tabs, draw a line in one; both tabs' rows stay empty and the line shows in both.

Notes:

## 8i. The edit record (Gateway only)

Entry 11a keeps what each change did and reads it with `edits.history`; entry 11b shows it in the studio (History in the rail, Revert, section 8j). A short check in the browser's developer console on `/edit`, signed in as the map editor, after **Seed the dev map**. The test hook (`window.__mapStudioTest`) sends through the component's own session, so the Gateway decides with your roles.

- [ ] Move P14 (Edit mode, Select, drag it), then in the console run `(await window.__mapStudioTest.send('edits.history', {limit: 3})).body.entries[0]`: the newest entry is your move, `actor` your user name, `at` the time in UTC, and one op with `name` "P14", `kind`, and `before` and `after` holding only `geometry` (the old and the new coordinates).
- [ ] Rename P14 in Details, then run the same line: the newest op's `before` and `after` hold only `name`, and the entry below it (your move) still reads `name` "P14", the name it had then.
- [ ] Delete a line with an instrument on it, then run the same line: one entry, its ops one delete per item, each with `before` (the record as it was) and `after` null.
- [ ] Page back: `(await window.__mapStudioTest.send('edits.history', {before: <the last entry's seq>, limit: 3})).body` lists the three older batches and `more`.
- [ ] Open `/` in a private window (no sign-in) and run `(await window.__mapStudioTest.send('edits.history', {})).body`: `{code: "role", ...}` and no names.
- [ ] A store from before this build (schema 2) is upgraded once on the Gateway's start: the log says "applied version(s) [3], now at schema version 3", and the older changes are listed with `before` and `after` null.

Notes:

## 8j. Recent changes (History)

On `/edit` at 1366 px after **Seed the dev map**, in Edit mode as the map editor, with a second browser (a private window) signed in as the phone editor `mapoperator` on `/edit`, and a third (another private window) signed in as the map editor on `/edit` at 1366 px. Compare the surface with DESIGN.md's Recent changes panel: a note box at the top, rows of an initial avatar, a sentence, who and when in tiny text and a ghost Revert, and a footer line.

- [ ] The rail lists View, Items, Kinds, Layers, **History** (a clock) and Import is not there yet. Press **History**: the rail item reads active and the dock shows "Recent changes", the save status row under its title, a note box "Nothing to undo yet" with a disabled **Undo**, then the changes newest first, and the footer "Revert undoes that one change, including someone else's, and saves like any edit." In the third browser press **Saved** beside the map's name in the Items list: History opens there too.
- [ ] Move P14 (Select, drag it); in the second browser move P31 (its sheet's Edit, Move). Within seconds both the first and the third browser list "Moved P31 about ... north" by mapoperator (the avatar "M", "mapoperator - 10:42") above "Moved P14 ..." by mapeditor, with no reload. A change from an earlier day reads its date, "Nov 7, 10:42".
- [ ] Tab to P31's row and press Enter: it expands to "Location" with the latitude and longitude before and after; Space closes it.
- [ ] Press **Revert** on P31's row: P31 moves back in every browser, and a new row "Reverted "Moved P31 about ... north"" shows on top in the first and the third. The note box reads "Next undo is one step: Undo: revert "Moved P31 ..."", as the toolbar's Undo names it on hover; press the note box's **Undo**: P31 goes where the phone editor put it.
- [ ] In the second browser move P31 again, then in the first press **Revert** on the phone editor's first move of P31: refused, the conflict card reads "Not saved - conflict with mapoperator's change" with one button, **Use mapoperator's version** (no "Apply mine on top"), and nothing moves. Reload the page: the card is back with the same one button. Press it.
- [ ] Rename a pad, then delete a line with its instruments: the rows read "Renamed P12 to ..." and "Deleted ... and its 2 instruments in one change"; the delete's **Revert** brings the line and its instruments back in one change and one undo step.
- [ ] Select twenty pads and set one field on all of them: one row "Changed 20 well pads in one change". A kind setup saved by **Seed the dev map** reads "Changed the well pad kind setup" with no Revert and "Kind setups change from the Kinds screen, so this change has no Revert." under it.
- [ ] Scroll to the end of the rows: **Show older** adds the next 50 below; at the end of the record it goes.
- [ ] Stop the store (`docker stop <MAPSTUDIO_CONTAINER>-pg`) and make an edit: the note box's Undo and every Revert are off, saying "Paused - the map store is unreachable" on hover. Start it again.
- [ ] Turn the Edit switch off: View mode shows no History.

Notes:

## 8k. Kinds and a kind's setup

On `/edit` at 1366 px after **Seed the dev map**, in Edit mode as the map editor, with a second browser (a private window) signed in as the second map editor `mapeditor2` on `/edit`, and a third in View mode on `/live`. Compare the surface with DESIGN.md's Kind setup and key screen 6 ([key-screen-6-kinds-style.png](../_bmad-output/initiative-flowmap/ux-map-studio/mockups/key-screen-6-kinds-style.png)): the list of kinds in the dock, the kind's setup beside it with its header, the Preview item and the numbered sections. The style rule editor is section 8l; the tag button and the tag browser are a later entry (13).

- [ ] Select a pad, then press **Kinds** on the rail: the dock lists the note "Setup applies to every item of a kind. Items can override." and six kinds (Well pad, Gathering line, Geofence, Tap, Line valve, Meter), each with its glyph, "Point", "Line" or "Area" and its item count. Well pad is chosen and its setup shows where the pad's Details was. Press **Items**: the pad's Details is back.
- [ ] The setup's header reads "Well pad", "Point - applies to 37 items - 1 override (Point 2 style rule)" and **Preview item** "CTB1 - [default]Mesa/CTB1", the folder again in monospace under it. The sections read 1 ICON, 2 KEY VALUES, 3 COMMS, 4 ALARMS, 5 POPUP, 6 STYLE RULE ("Builds on key values"), in that order.
- [ ] Under Pressure's path: "Resolves for 4 of 5 well pads" in the warning colour with its glyph (Pad 15 has no Pressure tag); under Flow's: "Resolves for 5 of 5 well pads" in grey. Choose Point 2 as the preview item: the notes are asked again. Reload the page and open Kinds: the preview item is still Point 2.
- [ ] Change Pressure's path to `{asset.path}/Flow` and press Enter: the header says "Saving..." then "Saved", and within ten seconds every linked pad's icon value on the map (and in the third browser) is its flow, with no reload. 6 Style rule still shows States on the tag path `{asset.path}/Status` with its four cases. Hover the toolbar's Undo: it names the same step as before. Open **History**: the top row reads "Changed the well pad kind setup" with no Revert. Put the path back.
- [ ] **Add a key value**, type the label "Gas price" and press Enter: "Type a tag path. This row is not saved yet." and nothing is saved. Type `[default]Shared/GasPrice` and press Enter: saved, and under it "Same tag for every well pad" in the warning colour. Add a fourth row: **Add a key value** is gone. Press its **Icon value** star: Pressure's star goes. Switch Flow's **In popup** off: in the third browser a pad's popup no longer lists Flow.
- [ ] In 5 Popup untick **Comms**: the Comms section's switch goes off too, and the third browser's popup has no Comms row. The line "Order is fixed: comms, values, alarms" stands under the three checkboxes.
- [ ] Type the link `//x` and press Enter: under Link, on the warning tint with its glyph, "link is a Perspective page path starting with one / (/pad/{item.name}), not //x."; the field still reads `//x`, the header says "Not saved" and nothing says Saved. Press Esc in the field: the stored link is back and the words go.
- [ ] Type the popup view `Popups/PadDetails`, press **Add a param**, name it `mapItem` with any value and press Enter: the Gateway's words under that row ("... no param may be named mapItem."). Name it `padName` with the value `a {item.name}`: "... mixes text and placeholders ..." under the row. Press the row's **{ }**, choose `{item.name}` and press Enter: saved. Now empty the popup view's path and press Enter: "Remove its params first. The popup view is kept." under it and nothing is saved; press Esc. (With its params removed first, an emptied path removes the popup view; an emptied heartbeat or alarm source path removes its part at once.)
- [ ] Choose **Gathering line**: Flow's Remove is off and says "Used by the style rule" on hover. Choose **Meter** (no item, no setup): under Preview item "No meter is linked to an asset yet, so its tag paths cannot be checked."; type a heartbeat path: saved, with no note under it.
- [ ] Two editors: in the first browser click in Well pad's Link and type `/mine` without leaving the field. In the second browser open Kinds and change the heartbeat path. In the first, the heartbeat path changes at once and Link still reads `/mine`; press Enter: the conflict card reads "Not saved - conflict with mapeditor2's change" with one button, **Use mapeditor2's version**; the fields are paused with the same words. Press it: Link shows the stored link.
- [ ] Tab through the whole panel: every field, switch, star, picker and Remove is reached and worked by the keyboard (Enter saves a field, Esc puts it back, Esc closes the picker).
- [ ] On `/adapters` press **incomplete**, reload `/edit` and open Kinds: the kind list's message stands above the rows. Press **ok** again.
- [ ] Press **Seed the dev map** to put the seed's kind setups back.

Notes:

## 8l. The style rule editor and area tints

On `/edit` at 1366 px after **Seed the dev map**, in Edit mode as the map editor, with a second browser in View mode on `/live`. Open **Kinds** and scroll a kind's setup to **6 STYLE RULE**. Compare it with DESIGN.md's Kind setup and key screen 6 ([key-screen-6-kinds-style.png](../_bmad-output/initiative-flowmap/ux-map-studio/mockups/key-screen-6-kinds-style.png)): the type, the value, then a row per case with its preset and a preview tile. The preview item's "Preview" word on the map and the note box are section 8m.

- [ ] Well pad: the type row reads None, States, Bands, Expression, with **States** underlined; Value reads "A tag path" with `{asset.path}/Status` and its resolve note; four rows "When the value is" 1 to 4, each with its preset by name and a tile of the pad's icon in that preset with its word (Attention, Warning, Fault, Out of service). No colour is offered anywhere.
- [ ] Press **Bands**: "Not saved yet. Add a band." and the header still says Saved. Choose the value **Pressure**, press **Add a band**, type from `900` and to `600`: "Not saved yet. Band 1: its from (900) is not below its to (600). Band 1 has no preset." Press **States**: the four cases are back; press **Bands**: the band is as you typed it. Nothing was saved (History has no new row).
- [ ] Empty the from, type to `0` and pick **normal**: saved. **Add a band**, from `0`: "Not saved yet. Band 2 has no preset."; pick **fault**: saved, and within ten seconds every pad with a pressure draws the fault ring and the word "Fault", in the second browser too, with no reload. Pressure's row in 2 Key values reads "Used by style rule" and its Remove is off.
- [ ] Press **Expression** and type `if({value} > 600, 'warning', 'normal')`, then click elsewhere: saved, with two tiles (warning, normal) under the hint. Change it to `if(` and click elsewhere: the Gateway's reason stands under the field on the warning tint ("the expression could not be read: ..."), the field still reads `if(`, the header says "Not saved". Put it right: saved, and the reason goes.
- [ ] Press **States**, add a fifth case with the value `2` and a preset: "Not saved yet. Case 5 has the same value as case 2 (2): each value has one case." Change its value to `"2"` (with the quotes): saved, the text 2 being another case than the number 2. Remove it with its delete icon.
- [ ] Choose **Gathering line**: the type row ends with **From its instruments**, and a preset select lists solid, dashed and dotted too. Press **From its instruments**: saved, one line "Each segment takes the worst of the instruments at its ends.", no value and no rows; Flow no longer reads "Used by style rule". Press **Bands**: the three bands are back and saved. Press **None**: "No style rule", saved, and Flow's Remove is on.
- [ ] Choose **Well pad** and **Geofence**: neither offers From its instruments.
- [ ] Geofence: under the rule, **Area tints by** reads Operator, with the rows North tint-1 and South tint-4, each with its swatch. Change South to tint-2: saved, and the South fence changes its tint on the map with no reload. Press **Add a category**, type `West` and press Enter: "Not saved yet. West has no tint."; pick a tint: saved. Choose **No tints**: saved, and both fences draw the neutral dashed outline; choose Operator again: the three rows are back and saved. Well pad and Gathering line show no tints.
- [ ] Tab through section 6: every type, select, field, Add and delete icon is reached and worked by the keyboard (Enter finishes a typed field).
- [ ] Press **Seed the dev map** to put the seed's kind setups back.

Notes:

## 8m. The preview item on the map

On `/edit` at 1366 px after **Seed the dev map**, in Edit mode as the map editor, with a second browser on `/live` (its dev buttons drive P12, the asset of **Point 1**, and it is another open map to compare with). Compare the map and the note with key screen 6 ([key-screen-6-kinds-style.png](../_bmad-output/initiative-flowmap/ux-map-studio/mockups/key-screen-6-kinds-style.png)). Nothing here is saved.

- [ ] Before Kinds is open, no item on the map reads "Preview". Open **Kinds** and choose **Well pad**: the Preview item is CTB1, and the line under the select reads "[default]Mesa/CTB1 - each tag path is checked for this item's asset, and it carries the word Preview on the map." The map has not moved.
- [ ] Choose the preview item **Point 1**: the map still has not moved. Press **Show on map**: the map goes to Point 1 at zoom 15, and its chip beside its name reads "Preview". Nothing is selected by the move. Scroll section 6 to its foot: the note box reads "Live now: Point 1 is Normal."
- [ ] On `/live` press **P12 status 2**: within ten seconds, with no reload and the map still, the note reads "Live now: Point 1 is Warning." and Point 1 draws the warning ring, its chip still reading "Preview"; the `/live` map draws the same ring with the word "Warning". Press **P12 status 3**: "Live now: Point 1 is Fault."
- [ ] On `/live` press **P12 pressure 950**: Point 1 shows its priority 1 alarm glyph and the note reads "Live now: Point 1 is Fault, but its priority 1 alarm wins over the rule." Press **P12 pressure 400** and **Acknowledge P12**.
- [ ] On `/live` press **P12 comms off**: Point 1's chip reads "Comms lost" (not "Preview") and the note reads "Live now: Point 1 shows only as Comms lost until a fresh value comes." Press **P12 comms on** and **P12 status 0**.
- [ ] Choose the preview item **Point 2**: the word moves to Point 2, and the note reads "Point 2 has its own style rule, so this kind's rule does not draw on it. Choose another preview item." Choose Point 1 again.
- [ ] Press **Bands** in section 6: under "Not saved yet. ..." the Live now note ends "The map shows the stored rule until this one is whole." Press **States**: the note says only what Point 1 is. Nothing was saved (History has no new row).
- [ ] Choose **Geofence**: no item on the map reads "Preview", the line under the select does not mention the word, and the note reads "An area draws its category tint, not a preset, so the style rule has no preview on the map."
- [ ] Choose **Gathering line** and the preview item **Tracer line**, then **Show on map**: the line's label reads "Tracer line Preview".
- [ ] Choose **Meter**: Show on map is off, its hover text "No meter is linked to an asset yet, so there is no preview item to show.", and the note says the kind has no item to show the rule on.
- [ ] Choose **Well pad** again (Point 1 reads "Preview"), then open **Items**: the word is gone. Open **Kinds**: it is back. Turn **Editing** off: it is gone.
- [ ] Tab from the Preview item select: Show on map is next, and Enter presses it.

Notes:


## 8n. Live now and path overrides

On `/edit` at 1366 px after **Seed the dev map**, in Edit mode as the map editor, with a second browser on `/live` (its dev buttons drive P12, the asset of **Point 1**, and P14, the asset of **Point 2**, and it is another open map to compare with). Compare the block with DESIGN.md's Properties panel and Override tag and the Details panel of key screen 6 ([key-screen-6-kinds-tags-override.png](../_bmad-output/initiative-flowmap/ux-map-studio/mockups/key-screen-6-kinds-tags-override.png); the tag button and the tag browser in it are entry 13). First press **P12 pressure 400** and **P14 pressure 700** on `/live`.

- [ ] Select **Point 1** and scroll Details to its foot: after Asset stands **LIVE NOW** with a grey "From kind" tag, then Comms, Pressure (a star after it, its value bold), Flow and Alarms. Each value is right-aligned ("OK - ...", "400 psi", "... bbl/d", "No active alarms") and each path is in monospace under its name: `[default]Mesa/P12/Comms`, `[default]Mesa/P12/Pressure`, `[default]Mesa/P12/Flow`, `[default]Mesa/P12`. Every row reads "From kind" and has an **Override** button.
- [ ] On `/live` press **P12 pressure 950**: within ten seconds, with no reload, Pressure reads "950 psi" and Alarms "1 alarm - Priority 1, unacknowledged". Press **P12 pressure 400** and **Acknowledge P12**: both go back.
- [ ] Press **Override** on Pressure: the path becomes a text field holding `[default]Mesa/P12/Pressure`, selected. Type `[default]Mesa/P14/Pressure` and press Enter: the header says Saved, the row reads **Override** with a **Reset** link, its path is P14's, and the focus is on the row's Change button. Within ten seconds Pressure reads "700 psi", Point 1's icon on this map and on `/live` shows 700 psi, and Point 3 is as it was. There was no save button and no toast.
- [ ] Hover **Undo**: "Undo: change Point 1's Pressure path". Open **Kinds** and choose **Well pad**: the subline counts it, "... - 2 overrides (Point 1 key values, Point 2 style rule)". Open **Items**: Point 1's Details are back.
- [ ] Press **Override** on Flow, type `[default]Mesa/P14/Flow` and click into Name: it saves on leaving the field, and both rows read Override.
- [ ] Press **Override** on Comms, type `{asset.path}/X` and press Enter: under the field, "an override's tag path is a full path such as [default]Mesa/P12/Pressure, not {asset.path}/X." Type `Mesa/X` and press Enter: "Mesa/X is not a tag path; use a full path such as [default]Shared/GasPrice." Nothing was saved (History has no new row). Press Esc: the field closes, Comms reads "From kind" with its own path, and Details is still open.
- [ ] Press **Override** on Comms, type `[default]` and press Enter: under the field, "[default] is not a tag path; use a full path such as [default]Shared/GasPrice.", and nothing was saved. Pressure and Flow still read Override. Press Esc.
- [ ] Press **Undo**: Flow reads "From kind" again and Pressure is still overridden. Press **Redo**: Flow is overridden again. Open **History**: rows read "Changed Point 1's Flow path" and "Changed Point 1's Pressure path", each with Revert; expand one to see the path before ("From kind") and after. Open **Items**.
- [ ] Override Comms with `[default]Mesa/P14/Comms` and Alarms with `[default]Mesa/P14`: each saves and reads Override. Press **Reset** on each: each reads "From kind" with Point 1's own path, and Undo reads "Undo: reset Point 1's alarms path".
- [ ] Press **Reset** on Pressure: it reads "From kind", Flow is still overridden, and within ten seconds Pressure reads "400 psi" here and on `/live`. Press **Reset** on Flow: no row reads Override, and the Well pad header in Kinds counts one override again.
- [ ] Select **Pad 1** (a pad with no asset): the paths read as the kind has them (`{asset.path}/Comms`, ...) with the note "Not linked, so the paths show as the kind has them. Linking an asset fills them." Override Comms with `[default]Mesa/P14/Comms`: it saves and reads Override. Reset it.
- [ ] Select **Point 2** (it has its own style rule): no row of its Live now block reads Override, since the block shows tag paths only (the item's own rule is the Style tab's, section 8o).
- [ ] Select **PT-1** (a tap) and override its Comms with `[default]Mesa/PT2/Comms`. Change **Kind** to Meter: Live now reads "Meter has no setup yet, so its items show no live values." with the button **Open Meter's setup**. Press it: Kinds opens at Meter. Open **Items**: PT-1 is still selected. Press **Undo** once: the kind is Tap again and Comms reads Override, so the kind change took the override with it and one Undo brought both back. Reset Comms.
- [ ] Tab through the block: every Override, Change and Reset is reached in order and pressed with Enter or Space, and the focus ring is visible.

## 8o. The Style tab and an item's own style rule

On `/edit` at 1366 px after **Seed the dev map**, in Edit mode as the map editor, with a second browser on `/live` (its **Status** buttons drive P12, the asset of **Point 1**, and it is another open map to compare with). There is no mock of the Style tab: compare it with DESIGN.md's Properties panel and tabs and Override tag, and with the renders of [the read-only rows](screenshots/mapstudio-itemstyle-rows-1366.png), the rule [from the kind](screenshots/mapstudio-itemstyle-fromkind-1366.png), [overridden](screenshots/mapstudio-itemstyle-override-1366.png) and [not saved yet](screenshots/mapstudio-itemstyle-unsaved-1366.png). First press **Status 0** on `/live`.

- [ ] Select **Point 1**: under the header stand two tabs, **Details** (underlined) and **Style**. Press **Style**: it is underlined and Details' fields give way to the Style tab. Click the Style tab, then press the Left and Right arrow keys: the tabs change with the keys and the focus ring follows; Tab leaves the tab list in one press.
- [ ] Select **Point 3**: its panel opens on Style. Open **Kinds**, then **Items**: Point 3's panel is back, still on Style. Select **Point 1** again.
- [ ] The tab reads Icon (the well pad glyph and `well-pad`), Size ("One size: every point's marker is the same size.") and Label ("Point 1"), each with a line saying it comes from the project's kind list and is not changed here; none of them is a field.
- [ ] Under **STYLE RULE** with a grey "From kind" tag: "States on the tag {asset.path}/Status" and four rows, each a tile of the pad in its preset with "When the value is 1" to "4" (attention, warning, fault, dimmed). Under them a line: "Shows now: Point 1 is Normal by the well pad rule. An alarm wins over the rule; a stale value shows only as Stale."
- [ ] Press **Edit the kind's rule**: Kinds opens at Well pad with "6 STYLE RULE" in view. Open **Items**: Point 1 is still selected, on Style.
- [ ] Press **Override**: the header says Saved at once, the rule reads **Override** with a **Reset** link, and the rule editor shows States, the value "A tag path" with `[default]Mesa/P12/Status`, and the kind's four cases. There is no None type, no save button and no toast. Hover **Undo**: "Undo: change Point 1's style rule".
- [ ] Change the preset of the first case (value 1) to **fault**: it saves at once. On `/live` press **Status 1**: within ten seconds Point 1 draws as Fault on this map and on `/live`, and the line reads "Shows now: Point 1 is Fault by its own rule. ..." The other pads are as they were.
- [ ] Open **Kinds** and choose **Well pad**: the subline counts it, "... - 2 overrides (Point 1 style rule, Point 2 style rule)". Open **Items**.
- [ ] In the tag path field type `{asset.path}/Status` and press Enter: under it, "an override's tag path is a full path such as [default]Mesa/P12/Pressure, not {asset.path}/Status.", and the note "Not saved yet. The tag path is not a full path." Nothing was saved. Press Esc in the field: the panel stays open. Type `[default]Mesa/P12/Status` back and press Enter: both notes go.
- [ ] Press **Add a case**, type 5 as its value and press Enter: "Not saved yet. Case 5 has no preset.", and the line under the rule ends "The map shows the stored rule until this one is whole." Press **Details**, then **Style**: the fifth case is still there. Press **Bands**, then **States**: the five cases are back as typed. Pick **warning** for case 5: it saves at once.
- [ ] Press **Undo**: case 5 goes. Press **Redo**: it is back. Open **History**: rows read "Changed Point 1's style rule", each with Revert. Open **Items**.
- [ ] Press **Reset**: the rule reads "From kind" again with the kind's rule in words, the focus is on Override, Undo reads "Undo: reset Point 1's style rule", and within ten seconds Point 1 draws as Attention (the kind's rule for status 1) here and on `/live`. Press **Status 0** on `/live`.
- [ ] Select **Point 2**: its Style tab shows its own rule marked Override: Expression, the tag path `[default]Mesa/P14/Pressure`, the text `if({value} > 600, 'warning', 'normal')` and the tiles of the presets it names.
- [ ] Select **L-SWD**: Size reads "Its width follows its diameter; a line with no diameter draws thin.", and its own rule is **From its instruments**, marked Override, with "Each segment takes the worst of the instruments at its ends."
- [ ] Select **Pad 1** (a pad with no asset) and press **Override**: nothing is saved; the editor opens empty with "Not saved yet. Pick the value the rule reads. Add a case." and **Keep the kind's rule**. Press it: the rule reads "From kind" again.
- [ ] Tab through the Style tab with an own rule open: Reset, the types, the value, every case's field, preset and Remove are reached in order, and the focus ring is visible.

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
