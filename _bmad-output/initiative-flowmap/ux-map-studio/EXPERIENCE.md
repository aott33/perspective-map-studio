---
name: Map Studio
status: draft
created: 2026-10-26
updated: 2026-10-27
sources:
  - ../prd-map-studio/prd-map-studio.md
  - ../architecture-map-studio/architecture-map-studio.md
  - .memlog.md
  - .working/sources-digest.md
---

# Map Studio - Experience Spine

How Map Studio works: one Perspective component that is the operator's map in View mode and a map studio in Edit mode. `DESIGN.md` is the visual identity; this file is the behaviour. Both win on conflict with any mock, screenshot or import. Decisions trace to `.memlog.md`; requirement and journey names are the PRD's (`FR-n`, `UJ-n`).

## Foundation

- **Host.** A Map Studio component inside an Ignition 8.3 Perspective page, under the project's own header, with the Perspective App Bar. The **bottom-right corner is reserved** for the App Bar toggle at every width: no control, toast, sheet edge or footer button goes there (`{spacing.app-bar-clearance}`).
- **UI system.** None of its own. Colours, font and light or dark come from the host project's Perspective theme; Map Studio ships no colour (AD-11). In the ign-scada-template host, state tokens resolve to its `--st-*` set.
- **Form factors.**

| Form factor | Who | What it does |
|---|---|---|
| Wide desktop (1440 and up) | Map editors, viewers | View mode and full Edit mode, Direction A |
| Laptop (1366) | Map editors (usual), viewers | Full Edit mode; the owner found the Atlist-like docked layout fine on a laptop |
| Phone (390) | Operators with phone editing, viewers | View mode; one-item editing from the item's bottom sheet (move a point, edit properties); no drawing |

- **Roles** (PRD 2.1): map editor (admin or integrator), operator (phone editing), viewer. The tools appear only for editing roles and every save is checked on the Gateway (FR-7).
- **Layout direction.** Direction A, Docked studio, chosen as a starting point; the owner notes it is busy and may be simplified.

## Information Architecture

Two modes on one component. **No Publish step**: every finished edit saves live and viewers see it within seconds (owner, tentative; FR-29).

| Surface | Mode | Reached from | Purpose |
|---|---|---|---|
| Map (view) | View | Page load (default) | The operator map: search, Needs you, legend, popups |
| Needs you list | View | Needs you bar | Ranked list of sites in alarm, comms lost or stale |
| Popup | View and Edit | Click or tap an item | Comms, key values, alarms, page link |
| Line popup | View and Edit | Click or tap a line | The line's instruments in order, opened at the clicked line segment |
| Legend | View | Legend button, bottom-left | Glyph key, Lines and Names toggles |
| Items | Edit | Rail, Items (default in Edit) | Grouped item list, properties panel, bulk form |
| Properties panel (Details, Style, Link) | Edit | Select an item on the map or in the list | Edit one item |
| Bulk form | Edit | Select several items | Shared fields, Mixed values |
| Kinds | Edit | Rail, Kinds | Set up each kind the project defines |
| Layers | Edit | Rail, Layers | Basemap switch only: None, OpenStreetMap, Satellite |
| Import | Edit | Rail, Import | Guided import, CSV templates, export [ASSUMPTION: export lives here, as in the mock] |
| Recent changes | Edit | Save status | The edit record with Revert per change |
| Conflict card | Edit | Save status in conflict | The other editor's change and the choice |
| First-run checklist | Edit | Empty map | The way in for a new map |
| Phone bottom sheet | View and Edit (phone) | Tap an item | Popup; Edit button opens the item's properties |

**Entering Edit mode** - two ways (owner): the Edit switch on the map, shown only to users with an editing role, or the integrator opens the component straight into Edit mode with a prop. View on the rail returns to View mode. On the phone there is no map-wide Edit switch.

**Rail order** - View, Items, Kinds, Layers, Import. Reference layers and land grids are later, not in Layers now.

Composition references (not yet promoted to `mockups/`): edit mode `.working/editor-direction-a-1366.png` and `.working/editor-direction-a-1440.png`; Kinds `.working/editor-direction-a-kinds-1366.png`; bulk `.working/editor-direction-a-bulk-1440.png`; view mode `.working/view-mode-1440.png` and `.working/view-mode-needs-you-1440.png`; the interactive mock `.working/editor-directions.html` (Direction A only is current). Rejected directions: `.working/editor-direction-b-1366.png`, `-b-1440.png`, `-c-1366.png`, `-c-1440.png`. Spines win on conflict; where the mock differs from a memlog decision (for example Kinds section order, Layers content), this file is right.

## Voice and Tone

Plain words a pumper or an admin reads at a glance. States are nouns, actions are verbs, counts come first. No exclamation marks, no jargon a viewer has to learn.

| Do | Don't |
|---|---|
| "Saved" / "Saving..." | "Changes successfully persisted" |
| "Not saved - conflict with Sam's change" | "Error 409" |
| "Needs you 3: 1 alarm, 1 comms lost, 1 stale" | "3 issues detected" |
| "Comms lost", "Stale", "Unlinked" | A coloured dot with no word |
| "Click the map, then drag the pin to fine-tune. Type here as a backup." | "Set geometry" |
| "Mixed - 3 values" / "Pick a value to set it on all 20" | A blank field for differing values |
| "One change, one undo step" / "Undo: edit 20 pads" | "Batch operation complete" |
| "Shared fields only - a change applies to all 20" | Silent bulk edits |
| "Name, location and asset link belong to one item and are not shown." | Hiding fields without saying why |
| "Alarm wins over the rule. A stale value shows only as Stale." | Rules the editor must guess |
| "Not linked. Pick an asset to show live values." | "No data" |
| "PT-1 to PT-2" for a line segment | Internal ids |

No em dashes in any label or message: use " - ". Ellipsis only on progress ("Saving...").

## Component Patterns

Behavioural rules. Visual specs are in `DESIGN.md`, Components.

| Component | Use | Behavioural rules |
|---|---|---|
| Mode rail | Edit mode | One click switches surface; the map and selection stay. View leaves Edit mode. |
| Item list | Items | Grouped by place: field, then site, then what is on it (wells, laterals, lines); a "Field-wide" group for areas. Items needing attention first. **Sort by** dropdown: Needs attention (default), Place, Kind, Name, Last changed. Kind filter chips. Search items. Footer: Add item and the unlinked count ("1 unlinked", opens the unlinked list). New items show in a "Just added" group. |
| List row | Item list | Click selects and opens properties; the map pans to the item. Checkbox adds to selection; Shift-click selects a range; "Select all in Mesa field", "Select all in filter", "Select all in group". |
| State badge | List rows, Needs you list | Shows the worst state: alarm (glyph, digit), Comms lost, Stale, Unlinked. Updates live. |
| Properties panel | Items | Opens on select, closes with close or Esc. Tabs: **Details** (name, kind, location, kind fields, Live now from kind), **Style** (icon size, label, style rule now; overrides marked Override with Reset), **Link** (asset link, page link, alarms link, popup parts). Footer: "Add another like this", Delete. Every field saves when it is finished (blur or Enter). |
| Override mark | Style, Link, Kinds | Any per-item value that differs from the kind setup shows Override and a Reset (FR-13). The kind header counts overrides ("1 override (P14 label)"). |
| Bulk form | Several selected | Replaces the properties panel. Shows only fields every selected item shares; differing values show Mixed; a changed field applies to all selected; name, location and asset link are never shown; geometry is never bulk edited. One undo step. "Clear" drops the selection. |
| Floating draw toolbar | Edit mode, map | Select; Box select (hold Alt for a lasso); kind buttons for common kinds (Well pad, Tank battery, Pipeline); generic Point, Line, Area (kind picked in the form after); Snap toggle, off by default. An "add instrument on this line" tool places taps, meters and line valves (FR-40) [ASSUMPTION: its place in the toolbar]. |
| Mode pill | Under the toolbar | Always names the current mode in words and glyph (FR-8). Esc returns to Select. |
| Drawing bar | While drawing a line or area | Shows points, length, whether the start is snapped or floating, snapping state; Finish by double-click, Enter or Finish; Cancel or Esc; Backspace removes the last vertex. |
| Editing switch | Top-right | Visible only to editing roles. Off: View mode; on: Edit mode, opens Items. |
| Save status | Panel header, beside Undo and Redo | Saved, Saving..., Not saved with reason, conflict. Click opens Recent changes, or the conflict card when in conflict. |
| Undo and Redo | Panel header; Ctrl+Z, Ctrl+Shift+Z | Undo this session's changes, even after they saved. A bulk change and an import each undo as one step. |
| Recent changes | From save status | The edit record: who, what, when, Revert per change. Revert undoes that one change, including someone else's, and saves like any edit. Names the next undo step. |
| Conflict card | Save conflict | Shows who changed what and when, and "Your change, kept here and not saved". Two choices: "Use Sam's version" and "Apply mine on top" [ASSUMPTION: from the mock; FR-31 only requires refusing and showing the other change]. |
| Toast / Undo bar | After an add, bulk edit, import, phone move | Message plus Undo, bottom-centre, auto-hides [ASSUMPTION: timing open]. |
| Popup card | Click or tap an item | Order: header (kind glyph, name, subline, pop-out icon to the item's page, close), comms with data age, 2 to 3 key values, alarms (summary, most important in words, "View alarms"). The page link is the header icon, not a body button. Parts follow the kind setup; no parts, no popup (FR-4). Live while open; stale values marked. Map Studio acknowledges nothing (FR-5). |
| Line popup | Click or tap a line | Lists the line's instruments in order along it, between the items its ends snap to, each with live values, distance and alarm state (for example CTB1 outlet, PT-1 at 1.1 km, PT-2 at 2.8 km, SWD1 inlet), then the line's own key values and alarms. Opens at the clicked line segment ("PT-1 to PT-2") with the instruments at its ends highlighted on the map and in the list (FR-40). |
| Bottom sheet | Phone | Popup and properties open as a bottom sheet with a visible 44 px close; it stops above the App Bar toggle. The popup sheet has an **Edit** button for phone-editing roles. |
| Needs you bar | View mode | Count of sites in alarm, comms lost or stale, with a glyph per state. Click lists them, ranked: alarms by priority, then comms lost, then stale; click a row zooms to and selects the site. What it shows when nothing needs you is an Open Question. |
| Search | View mode top-left (always visible); Items list | Search by name or asset as you type, results with kind; choosing zooms and selects (lines and areas fitted). Works keyboard only and at 390 px (FR-33). |
| Legend | View mode bottom-left | Collapsed to a button; opens on request. Holds the Lines and Names toggles and the zoom 14 note. |
| Kind setup | Kinds | Lists only the kinds the project defines (read-only list from the host adapter, AD-4/AD-16); no adding kinds. Sections in order: **Icon, Key values, Comms, Alarms, Popup, Style rule** (last, it builds on the key values). Each live value has an on/off switch; one key value is the icon value. Paths come from a **tag browser** showing one example asset's tags, turned into a path relative to the asset; typed paths still work. Each path reports how many items it resolves for. A **live preview** uses an item the editor chooses. Style rule: States, Bands or Expression; each state maps to a preset with its preview tile. |
| Import steps | Import | Drop CSV, KML or GeoJSON; then guided steps: **Preview** (map plus table, unreadable rows with reasons), **Map columns** to fields, **Match to assets** (confident matches ticked, doubtful flagged), **Summary** (new, updated, skipped), then **Import**. Cancel at any step changes nothing. An import undoes as one step. CSV template per kind downloads here. |
| First-run checklist | Empty map, Edit mode | Three steps: "Set up your kinds", "Add or import items", "Check the operator view"; each opens its surface; ticks as done. A viewer on an empty map sees the empty map and a short note (FR-36). |
| Phone crosshair | Phone Move | The map moves under a fixed centre crosshair; Done saves the point there, Cancel leaves it. |

## State Patterns

### Item states on the map

| State | Treatment |
|---|---|
| Normal | Neutral (`{colors.glyph-normal}`, `{components.map-marker.dot}`): below zoom 14 a neutral dot, from zoom 14 the kind glyph in a neutral disc (owner, zoom 14 rule). No hue. All live values off: plain icon, no tag reads. |
| Alarm | `{components.alarm-glyph}`, per ER-27: priority 1 triangle, 2 circle, 3 outlined square; unacknowledged, acknowledged (filled with "!"), rectified (check); digit beside the glyph; fade 55 % only when the alarm is not live; dim 35 % when out of scope, dim wins. Glyphs stack above dots. Lines: hue of the highest alarm, glyph and digit at the midpoint. Instruments: glyph at the instrument's place on the line. A cleared unacknowledged alarm draws no hue on a line. Diagnostic never shows. Nothing blinks. |
| Comms lost | The comms-lost glyph, a dashed ring (`{components.map-marker.comms-lost-border}`), the word "Comms lost" beside the name and in the popup; values shown as stale. Lines: dashed. No hue. |
| Stale | The hourglass glyph and "Stale"; values marked "Stale - " with their age. The item drops its last value style until a fresh value arrives (FR-38). No hue. |
| Value style | From the kind's style rule through presets: normal, attention (`{colors.attention}` heavier outline plus the word, no hue), warning, fault, dimmed. Alarm wins over style; style over area tint. |
| Line look with instruments | **Per line segment**, drawn from the instruments at that segment's two ends, as the template's map does (owner, 2026-10-27). A line with no instruments draws from its own values. A line's style rule may use the worst of its instruments: dashed when any is stale, attention when any value is outside its band. |
| Unlinked | "Unlinked" badge in the list; no live values; counted in the list footer. Vanished asset shows unlinked with the reason. Unknown kind shows an "Unknown kind" marker (FR-11). |
| Selected | Selection ring (`{colors.selection}`) and name; flow arrow on a selected line only. |

### Save and store states

| State | Surface | Treatment |
|---|---|---|
| Saved | Save status | Check and "Saved". |
| Saving | Save status | Spinner and "Saving...". |
| Not saved | Save status, item | "Not saved" with the reason; the edit is kept in the browser until it saves or the user discards it (FR-29, AD-10). |
| Conflict | Save status, conflict card | `{components.save-status.conflict-foreground}`, "Not saved - conflict with Sam's change"; the card shows the other change and keeps yours (FR-31). |
| Undo refused | Toast | Undo of a saved edit that another editor has since changed is refused, saying who changed it (FR-17). |
| Store unreachable | Whole component | The map says so, draws nothing stale as current, and the tools are disabled until it can reach the store (FR-29, AD-10). |
| Live edits from others | Map, list | Saved edits from other sessions appear without reload within a few seconds. |

### Surface states

| State | Surface | Treatment |
|---|---|---|
| Empty map, editor | Edit mode | First-run checklist. |
| Empty map, viewer | View mode | Empty map and a short note. |
| No asset list or incomplete | Item form, Kinds | Says where the asset list comes from and that it is empty or incomplete (FR-10). |
| Path does not resolve | Kinds | Per path "Resolves for N of M items", listing the items it fails for. |
| Busy (loading) | Map, list, import preview | [ASSUMPTION] the save-status spinner pattern on the busy surface; no skeletons specified yet. |
| No search results | Search | "No matches" [ASSUMPTION: wording]. |
| Nothing needs you | Needs you bar | Open Question (see below). |
| Import errors | Import, Preview | Count found, unreadable rows with reasons; cancel changes nothing. |
| Permission | Whole component | No editing role: no Edit switch, no tools, no affordance (FR-7). |
| Phone, below 768 px | Edit | No drawing tools; move a point and edit properties only (FR-28). |

## Interaction Primitives

- **Select.** Click or tap an item on the map or a row in the list. In View mode it opens the popup; in Edit mode it opens properties. Click empty map to clear. Shared spot within 20 m opens a pick list (FR-34).
- **Multi-select.** In the list: checkboxes, Shift-click range, Select all in a group or filter. On the map: Box select, hold Alt for a lasso; Shift-click adds. The mode pill reads "N selected - Shift-click to add".
- **Draw.** Kind buttons for common kinds, or generic Point, Line, Area with the kind picked in the form after. Lines and areas finish by double-click, Enter or Finish; Backspace removes the last vertex; Esc cancels. "Add another like this" copies kind and properties, not the asset link (FR-18).
- **Instruments.** An instrument is placed by clicking the line or typing its distance along line, and moves only along the line by dragging or typing a new distance (FR-40). Moving, reshaping or splitting a line keeps its instruments on it in the same save. **Deleting a line deletes its instruments in the same save, and one undo restores both** (owner, 2026-10-27).
- **Snap.** A toggle on the toolbar, **off by default** (owner overrides the earlier snap-by-default idea; FR-16 still holds). When on, a visible indicator ("Snap to CTB1 - click to connect"); snapped and floating ends look different.
- **Place a point.** Click the map, then drag to fine-tune (the main way). Typed latitude and longitude in Details is the backup, with the place check (country, province or state, city) and "Zoom to location". Address or legal land description search is not offered.
- **Change geometry.** Drag a point or vertex, midpoint handle to insert, delete a vertex, split a line at a point; every one also doable without a drag (Move then tap, typed values) (FR-15).
- **Delete.** No confirmation; undo restores (FR-17).
- **Undo and redo.** Buttons and Ctrl+Z, Ctrl+Shift+Z for this session's changes, even after they saved. A bulk change and an import are one step each. Recent changes holds the record with Revert per change.
- **Bulk edit.** Shared fields only, Mixed where values differ, a change applies to all selected, one undo step.
- **Phone move.** Tap the item, tap Edit in its bottom sheet, tap Move: the map moves under a fixed centre crosshair; tap Done (or Cancel). An Undo bar follows [ASSUMPTION: FR-27's Undo bar carries over to Done].
- **Keyboard.** Esc to Select; Enter to finish; Backspace removes a vertex; Ctrl+Z / Ctrl+Shift+Z; Shift-click; Alt for lasso; `?` opens the shortcut panel (FR-18).
- **Banned.** A Publish or release step; free colour pickers; a save button; blinking; controls in the bottom-right corner.

## Accessibility Floor

Behavioural. Visual contrast lives in `DESIGN.md` (3:1 non-text in both themes).

- Every touch target on the phone is at least 44 px (`{spacing.target-touch}`): zoom buttons, popup close, sheet buttons, Move, Done, Cancel. The tracer spike failed at 29 px zoom buttons and a 21 px popup close; both must pass.
- Colour is never the only signal: every state has a glyph or a word (ISA-101, ER-27); comms lost and stale have no colour at all.
- Every drag has a non-drag way: typed coordinates, typed distance along line, Move then tap (FR-14, FR-15, FR-40).
- Search (`{components.search-field}`) and its results work keyboard only (FR-33). Every tool has a keyboard path; Esc always returns to Select.
- The current mode is always named in words (FR-8).
- Selection uses `{colors.selection}`, distinct from every state hue.
- [ASSUMPTION] Glyphs carry text alternatives matching their legend words ("Priority 1 alarm, unacknowledged", "Comms lost").

## Responsive & Platform

| Width | Behaviour |
|---|---|
| 1440 and up | Direction A: rail `{spacing.rail-width}`, list `{spacing.list-panel-1440}`, properties `{spacing.properties-panel-1440}`, map about 748 px with a selection. |
| 1366 | Direction A: list `{spacing.list-panel-1366}`, properties `{spacing.properties-panel-1366}`; map about 718 px with a selection, 1038 px without. The top row (toolbar plus Editing switch) is full. Opening properties pans the map to keep the selection in view. |
| 768 to 1365 | Open Question: how Direction A narrows (properties over the map, or list collapses). |
| Below 768 | No drawing tools (FR-28). Phone editing from the bottom sheet only. |
| 390 (phone, view) | Map fills the page. One top bar holds search and Needs you and expands on tap. Zoom top-right at 44 px, Legend bottom-left, popups as bottom sheets with a visible close. Bottom-right clear for the App Bar toggle. |

## Inspiration & Anti-patterns

Atlist (`imports/atlist-1.webp` to `imports/atlist-4.webp`) is a reference and a starting point, not something to copy; it is more complex than needed.

- **Taken - View and Build split** (`imports/atlist-1.webp`): see the map, then edit it. Map Studio's View mode and Edit mode.
- **Taken - docked panels and a mode rail** (`imports/atlist-1.webp`, `imports/atlist-3.webp`): rail, list, properties with tabs, map beside them, a light floating draw toolbar top-centre.
- **Taken - per-item override** (`imports/atlist-2.webp`, "Individual Styles override global and group styles"): the kind setup is the default; an item may override it, marked and resettable.
- **Not taken - free colour pickers, size sliders and custom marker uploads** (`imports/atlist-2.webp`): looks come from host theme presets only.
- **Not taken - Publish** (`imports/atlist-1.webp` rail): saves are live.
- **Not taken - Directions and Google Maps buttons** (`imports/atlist-4.webp`): the popup links to the item's page and the alarm page only.
- **Not taken - address search as a main way to place** (`imports/atlist-3.webp`): click then drag, typed coordinates as backup.
- **Rejected from the template's map and editor** (the owner's pain: "cobbled together, not connected"): chip-row actions with Save draft and Discard, one Gateway call per vertex, "Open the editor on a laptop" below 768 px, popup forms on the map.

## Engineering Review Items

Alarm presentation changes go to the template's engineering review (ER-27, template `docs/ux.md` section 11) before release. Each is a deliberate change or addition:

1. **Bottom sheets on the phone** for popups and properties, replacing the template's chip row and top sheets (PRD FR-4, FR-28).
2. **Kind glyph from zoom 14**, a neutral dot below, replacing the template's state-only markers that never show kind.
3. **Blink**: the icon catalogue proposes blinking an unacknowledged Critical at draw time; the template map never blinks. This spine keeps "nothing blinks" until the review decides.
4. **Style presets** (normal, attention without hue, warning, fault, dimmed; line patterns) and their previews (FR-38).
5. **Alarm glyphs** and their hue tokens in both themes, including the unacknowledged mark at 16 px and triangle-like kind outlines (line valve, compressor station).
6. **Instruments on lines**: instrument alarm glyphs at their place on the line, the per-segment line look from the instruments at each segment's ends, and the worst-of-instruments line style (FR-40).
7. **Area category tints** (FR-39).
8. **Popup alarm block** in the alarm-1 tint and the Needs you counts.

## Key Flows

### UJ-1. Sam lays out a field that has no map.

Sam, map editor, laptop at 1366, empty map, a spreadsheet of researched items beside the browser.

1. Sam turns on the Edit switch; the first-run checklist shows "Set up your kinds", "Add or import items", "Check the operator view".
2. Sam picks a kind button, Well pad. The mode pill reads "Add a well pad - click the map, then drag to fine-tune".
3. Sam clicks near the pad, drags the pin onto it; properties open on Details. Sam types the name and, from the spreadsheet, the latitude and longitude; the place check shows "Lea County, New Mexico, US"; "Zoom to location" confirms.
4. On Link, Sam picks the asset; Live now fills in from the kind.
5. Sam picks Pipeline, clicks from CTB1 to SWD1 (Snap turned on for this), and finishes with a double-click. The toast says the pipeline was added and saved.
6. Sam picks the instrument tool and clicks the pipeline at PT-1's spot, then types its distance along line, 1,143 m.
7. Sam switches Layers to Satellite and checks the layout.
8. **Climax:** every item is on the map and linked; the unlinked count reads 0, and someone in View mode sees the same field while Sam keeps working.

Failure: a pipeline end left floating is allowed and drawn as floating. A duplicate name gets a red underline and a tooltip. Sam closes the laptop halfway; unsaved edits wait in the browser and the saved ones are on any computer.

### UJ-2. Sam keeps a running field's map right.

Sam, map editor, laptop, live field showing in View mode.

1. Sam turns on the Edit switch; Items opens with the list grouped by place.
2. Sam clicks the lateral, drags two vertices to the new route and inserts a third with a midpoint handle.
3. Sam selects a neighbouring pad and uses "Add another like this", clicks the map for P31 and drags the pin, then links it to the P31 asset.
4. Sam picks Area, draws the lease geofence vertex by vertex and double-clicks to finish.
5. **Climax:** P31's icon shows its comms and pressure the moment it is linked, and viewers see the new route and geofence with no release step.
6. Sam turns the Edit switch off; the page is the plain map again.

Failure: Sam drags the wrong vertex; Ctrl+Z puts it back. If another editor moved the same lateral meanwhile, the save status reads "Not saved - conflict with ..." and the conflict card shows their change.

### UJ-3. Jordan provisions a field from files.

Jordan, integrator, laptop, Map Studio opened straight into Edit mode on an empty map, 120 pads.

1. In Import, Jordan downloads the meter CSV template and fills it.
2. Jordan drops the GIS export: Preview shows the features on the map and in a table, with any unreadable rows and reasons. Jordan maps columns to fields.
3. Match to assets: most rows are ticked by name; doubtful ones are flagged; Jordan fixes those one by one. Summary: new, updated, skipped. Import. The same for the CSV.
4. In Kinds, Jordan opens Well pad: picks the icon, sets key values from the tag browser on an example pad, turns comms on, sets the alarms path, the popup parts and the link `/pad/{asset.id}`, and last a style rule; the preview pad shows each state.
5. Back in Items, Jordan box-selects twenty pads on one route; the bulk form shows shared fields, Operator reads "Mixed - 3 values"; Jordan picks one. The toast says "Undo: edit 20 pads".
6. **Climax:** every pad on the map shows comms, pressure and its alarm count, all from one kind setup.

Failure: rows with no matching asset stay on the map as Unlinked, and the list footer counts them until they are matched or deleted. The whole import undoes as one step.

### UJ-4. Alex fixes a pin from the field.

Alex, operator with phone editing, at pad P12, 390 px phone, gloves.

1. Alex taps P12; its popup opens as a bottom sheet with an Edit button.
2. Alex taps Edit, then Move. The map now moves under a fixed centre crosshair; Alex pans until the crosshair sits on the pad and taps Done.
3. An Undo bar appears.
4. In the same sheet Alex corrects the access road note; it saves when finished.
5. **Climax:** in the satellite view the pin sits on the pad, and everyone sees it there.

Failure: the crosshair landed on the wrong spot; Undo puts it back. Cancel during Move leaves the pin where it was.

Note: this flow follows the owner's crosshair decision, which replaces the PRD's long-press and drag in UJ-4 and FR-27 (see Open Questions).

### UJ-5. Riley follows an alarm from the map.

Riley, viewer, desktop, View mode, no tools.

1. The Needs you bar reads "Needs you 1: 1 alarm". CTB1's icon shows a normal comms glyph, an alarm glyph and the digit 2 beside it.
2. Riley clicks CTB1: the popup shows comms with its data age, two key values, then "2 alarms" with the most important in words and "View alarms".
3. Riley clicks "View alarms" and lands on the alarm page filtered to CTB1, acknowledges one there; later Riley opens CTB1's page with the pop-out icon in the popup header.
4. Riley clicks L-SWD between PT-1 and PT-2: the line popup opens at "PT-1 to PT-2", lists CTB1 outlet, PT-1, PT-2 and SWD1 inlet with live values, and PT-2 shows its own alarm badge, as its glyph does at its place on the line.
5. **Climax:** Riley sees CTB1's alarms in the alarm table, or its page, within two clicks of seeing the alarm.

Failure: CTB1's comms are lost: the icon has a dashed ring and "Comms lost", the popup says "Comms lost", and values show as stale with their age, never as current.

## Open Questions

1. **Phone move vs PRD.** The owner chose tap Move plus a fixed crosshair; PRD UJ-4 and FR-27 say long-press and drag with the pin drawn above the finger. The PRD needs updating (Sofia), or the owner confirms both.
2. **First run vs PRD.** The owner chose a three-step checklist; PRD FR-36 names "Draw your first site", "Import CSV" and a skippable tour on a throwaway layer. Does the tour stay?
3. **Layers vs PRD.** Layers offers None, OpenStreetMap and Satellite only; PRD FR-32 also lists Mapbox and FR-26 reference layers. Are Mapbox and reference layers deferred?
4. **Publish.** No Publish step is a tentative owner call ("I don't think at least"). Confirm.
5. **Alarm hue tokens.** Which host Perspective theme variables carry priority 1, 2 and 3 (epic-viewing's call; the mock used `--error` for priority 1)?
6. **Area tint palette.** Which theme tokens make the FR-39 palette?
7. **Widths between 768 and 1365.** How Direction A narrows.
8. **Nothing needs you.** Does the Needs you bar hide, or read "Needs you 0"?
9. **Kinds tag browser.** Needs a Gateway tag-browse lookup (new need, unverified).
10. **Style rule Expression.** Where it is evaluated and in which language (PRD FR-38, AD-16).
11. **Legend.** A new need with no FR yet; Sofia to add one.
12. **Simplifying Direction A.** The owner may trim it; what goes first?
13. **Instrument tool placement** on the draw toolbar and the instrument marker look.
14. **Toast timing** and Undo bar lifetime.

The two owner decisions of 2026-10-27 (per-segment line look; deleting a line deletes its instruments, one undo restores both) are applied above and close PRD section 9 questions 9 and 10.
