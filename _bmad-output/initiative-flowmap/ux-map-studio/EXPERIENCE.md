---
name: Map Studio
status: final
created: 2026-10-26
updated: 2026-10-27
sources:
  - ../prd-map-studio/prd-map-studio.md
  - ../architecture-map-studio/architecture-map-studio.md
  - .memlog.md
  - .working/sources-digest.md
  - mockups/key-screens.html
  - ../../../docs/setup.md
  - ../../../docs/setup-editor.md
  - mockups/designer-setup-form.html
---

# Map Studio - Experience Spine

How Map Studio works: one Perspective component that is the operator's map in View mode and a map studio in Edit mode. `DESIGN.md` is the visual identity; this file is the behaviour. Decisions trace to `.memlog.md`; requirement and journey names are the PRD's (`FR-n`, `UJ-n`).

## Foundation

- **Spines win.** `DESIGN.md` and this file win on any conflict with a mock, screenshot or import in `mockups/`, `.working/` or `imports/`. Known places where the mocks differ and the spines are right: the properties panel has two tabs, Details and Style (the mocks show a third, Link); the list's filter chips sit behind a Filter button (the mocks show them open); Layers offers None, OpenStreetMap and Satellite only (the mocks show Blank, Show toggles and reference layers); the Kinds section order puts Style rule last (the earlier Direction A mock puts it second); the Kinds preview item sits in the kind's header and every tag path has its own tag button (the earlier Direction A mock shows a Browse tags button and the preview item in the style rule).
- **Host.** A Map Studio component inside an Ignition 8.3 Perspective page, under the project's own header, with the Perspective App Bar. The **bottom-right corner is reserved** for the App Bar toggle at every width: no control, toast, sheet edge or footer button goes there (`{spacing.app-bar-clearance}`).
- **UI system.** None of its own. Colours, font and light or dark come from the host project's Perspective theme; Map Studio ships no colour (AD-11). In the ign-scada-template host, state tokens resolve to its `--st-*` set.
- **Form factors.**

| Form factor | Who | What it does |
|---|---|---|
| Wide desktop (1440 and up) | Map editors, viewers | View mode and full Edit mode, Direction A |
| Laptop (1366) | Map editors (usual), viewers | Full Edit mode; the owner found the Atlist-like docked layout fine on a laptop |
| Phone (390) | Operators with phone editing, viewers | View mode; one-item editing from the item's bottom sheet (move a point, edit properties); no drawing |

- **Roles** (PRD 2.1): map editor (admin or integrator), operator (phone editing), viewer. The tools appear only for editing roles and every save is checked on the Gateway (FR-7).
- **Designer.** The project's Map Studio setup is edited in the Ignition 8.3 Designer as a project resource tab (owner, 2026-10-27), in the Designer's own Swing look, not the component's. It has its own section below, Designer Setup Form.
- **Layout direction.** Direction A, Docked studio, simplified at the owner's request: the filter chips go behind a Filter button and the properties tabs fold to Details and Style.

## Information Architecture

Two modes on one component. **No Publish step** (owner, confirmed): every finished edit saves live and viewers see it within seconds; Undo and Recent changes cover mistakes (FR-29).

| Surface | Mode | Reached from | Purpose |
|---|---|---|---|
| Map (view) | View | Page load (default) | The operator map: search, Needs you, legend, popups |
| Needs you list | View | Needs you bar | Ranked list of sites in alarm, comms lost or stale |
| Popup | View and Edit | Click or tap an item | Comms, key values, alarms, page link |
| Line popup | View and Edit | Click or tap a line | The line's instruments in order, opened at the clicked line segment |
| Legend | View | Legend button, bottom-left | Glyph key, Lines and Names toggles |
| Items | Edit | Rail, Items (default in Edit) | Grouped item list, properties panel, bulk form |
| Properties panel (Details, Style) | Edit | Select an item on the map or in the list | Edit one item |
| Bulk form | Edit | Select several items | Shared fields, Mixed values |
| Kinds | Edit | Rail, Kinds | Set up each kind the project defines |
| Tag browser | Edit (full editing role) | The tag button on any tag path: Kinds (key values, comms, alarms, style rule value, popup params) and an item's override in Details | Pick a tag from one provider's tree; in a kind's setup it opens at the preview item's asset folder |
| Layers | Edit | Rail, Layers | Basemap switch only: None, OpenStreetMap, Satellite |
| Import | Edit | Rail, Import | Guided import, CSV templates, export [ASSUMPTION: export lives here, as in the mock] |
| Recent changes | Edit | Save status | The edit record with Revert per change |
| Conflict card | Edit | Save status in conflict | The other editor's change and the choice |
| Save banner | Edit | Store unreachable or busy | What was kept, Try again |
| First-run checklist | Edit | Empty map | The way in for a new map |
| Phone top bar | View (phone) | Always shown | Search and Needs you; expands into the ranked list |
| Phone bottom sheet | View and Edit (phone) | Tap an item | Popup; Edit opens the item's edit sheet |
| Phone move | Edit (phone) | Edit sheet, Move | Fixed centre crosshair; Done or Cancel |
| Map Studio Setup tab | Ignition 8.3 Designer (not the component) | Project Browser, Map Studio Setup node (double-click opens the tab; a project has exactly one setup, so the node has no menu of its own; a project with none opens the tab's empty state, with Create setup there) | The project's setup: map store, who can edit, kinds and assets, map. See Designer Setup Form below |

**Entering Edit mode** - two ways (owner): the Edit switch on the map, shown only to users with an editing role, or the integrator opens the component straight into Edit mode with a prop. View on the rail returns to View mode. On the phone there is no map-wide Edit switch.

**Rail order** - View, Items, Kinds, Layers, Import.

**Deferred, not dropped** - FR-32's Mapbox vector style and FR-26's reference layers (land grids among them) stay out of Layers for now (owner, 2026-10-27).

Visual references in `mockups/`: the interactive key screens [key-screens.html](mockups/key-screens.html) (nine screens with a picker; `?s=N&v=STATE&bare=1` renders one) and the Direction A workshop mock [editor-directions.html](mockups/editor-directions.html) (Direction A only is current). Edit mode [editor-direction-a-1366.png](mockups/editor-direction-a-1366.png), [editor-direction-a-1440.png](mockups/editor-direction-a-1440.png), [key-screen-4-edit-items.png](mockups/key-screen-4-edit-items.png); view mode [view-mode-1440.png](mockups/view-mode-1440.png), [view-mode-needs-you-1440.png](mockups/view-mode-needs-you-1440.png), [key-screen-1-view-desktop-popup.png](mockups/key-screen-1-view-desktop-popup.png), [key-screen-1-view-desktop-needs.png](mockups/key-screen-1-view-desktop-needs.png). Rejected directions stay in `.working/`: `editor-direction-b-1366.png`, `-b-1440.png`, `-c-1366.png`, `-c-1440.png`.

## Voice and Tone

Plain words a pumper or an admin reads at a glance. States are nouns, actions are verbs, counts come first. No exclamation marks, no jargon a viewer has to learn.

| Do | Don't |
|---|---|
| "Saved" / "Saving..." | "Changes successfully persisted" |
| "Not saved - conflict with Sam's change" | "Error 409" |
| "Map Studio is busy with other map requests; nothing was saved. Try again in a moment." | "Request failed" |
| "Needs you 3: 1 alarm, 1 comms lost, 1 stale" / "All OK" | "3 issues detected" / "0 issues" |
| "Comms lost", "Stale", "Unlinked" | A coloured dot with no word |
| "Click the map, then drag the pin to fine-tune. Type here as a backup." | "Set geometry" |
| "Mixed - 3 values" / "Pick a value to set it on all 20" | A blank field for differing values |
| "One change, one undo step" / "Undo: edit 20 pads" | "Batch operation complete" |
| "Shared fields only - a change applies to all 20" | Silent bulk edits |
| "Name, location and asset link belong to one item and are not shown." | Hiding fields without saying why |
| "Alarm wins over the rule. A stale value shows only as Stale." | Rules the editor must guess |
| "Not linked. Pick an asset to show live values." | "No data" |
| "PT-1 to PT-2" for a line segment | Internal ids |
| "Preview - not on the map yet" / "Nothing changes until you import." | Changing the map before the user confirms |
| "Same tag for every well pad" | "Absolute path" / "Not asset-relative" |
| "Resolves for 3 of 3 well pads" | "Validation passed" |
| "Can't browse edge-p12 - the Gateway cannot reach this tag provider right now." | "Browse failed" |

No em dashes in any label or message: use " - ". Ellipsis only on progress ("Saving...").

## Component Patterns

Behavioural rules. Visual specs are in `DESIGN.md`, Components.

| Component | Use | Behavioural rules |
|---|---|---|
| Mode rail | Edit mode | One click switches surface; the map and selection stay. View leaves Edit mode. |
| Item list | Items | Grouped by place: field, then site, then what is on it (wells, laterals, lines); a "Field-wide" group for areas. Items needing attention first, then an "All normal" divider. **Sort by** dropdown: Needs attention (default), Place, Kind, Name, Last changed (Last changed shows when and who on each row). **Filter** button opens the kind chips; a chosen kind filters the list and "Select all in filter" follows it. Search items. Footer: Add item and the unlinked count ("1 unlinked", opens the unlinked list). New items show in a "Just added" group. Below about 1280 px the list collapses to a button. |
| List row | Item list | Click selects and opens properties; the map pans to the item. Checkbox adds to selection; Shift-click selects a range; "Select all in Mesa field", "Select all in filter", "Select all in group". |
| State badge | List rows, Needs you list | Shows the worst state: alarm (glyph, digit), Comms lost, Stale, Unlinked. Updates live. |
| Properties panel | Items | Opens on select, closes with close or Esc. Two tabs. **Details**: name, kind, location (place line, "Zoom to location"), kind fields, asset link (Change, Unlink, or "Link to an asset"), page link and View alarms link, popup parts, then Live now from the kind. **Style**: icon, size, label, style rule now with "Edit the kind's rule"; overrides marked Override with Reset. Footer: "Add another like this", Delete. Every field saves when it is finished (blur or Enter). |
| Override mark | Details, Style, Kinds | Any per-item value that differs from the kind setup shows Override and a Reset (FR-13); others show "From kind". The kind header counts overrides ("1 override (P14 label)"). |
| Bulk form | Several selected | Replaces the properties panel, with the same two tabs. Shows only fields every selected item shares; differing values show Mixed; a changed field applies to all selected and its hint reads what it was ("Set on all 20 - was Mixed (Route 2, Route 3)"); name, location and asset link are never shown ("Asset links are per item. Use Import to match many by name."); geometry is never bulk edited. One undo step. "Clear" drops the selection. |
| Floating draw toolbar | Edit mode, map | Select; Box select (hold Alt for a lasso); kind buttons for common kinds (Well pad, Tank battery, Pipeline); generic Point, Line, Area (kind picked in the form after); Snap toggle, off by default. An "add instrument on this line" tool places taps, meters and line valves (FR-40) [ASSUMPTION: its place in the toolbar; the key-screens mock has none]. Paused, with no input, while the store is unreachable. |
| Mode pill | Under the toolbar | Always names the current mode in words and glyph (FR-8). Esc returns to Select. |
| Drawing bar | While drawing a line or area | Shows points, length, whether the start is snapped or floating, snapping state; Finish by double-click, Enter or Finish; Cancel or Esc; Backspace removes the last vertex. |
| Editing switch | Top-right | Visible only to editing roles. Off: View mode; on: Edit mode, opens Items. |
| Save status | Panel header, beside Undo and Redo | Saved, Saving..., or a problem (conflict, store unreachable, busy) in words on its own row. Click opens Recent changes, or the conflict card when in conflict. |
| Undo and Redo | Panel header; Ctrl+Z, Ctrl+Shift+Z | Undo this session's changes, even after they saved. A bulk change, an import and a line delete with its instruments each undo as one step. The tooltip names the step ("Undo: edit 3 pads"). |
| Recent changes | From save status | The edit record: who, what, when, Revert per change. Names the next undo step with an Undo button. Revert undoes that one change, including someone else's, and saves like any edit. |
| Conflict card | Save conflict | Shows who changed what and when, and "Your change, kept here and not saved". Two choices: "Use Sam's version" and "Apply mine on top" [ASSUMPTION: from the mock; FR-31 only requires refusing and showing the other change]. |
| Save banner | Store unreachable, busy | Unreachable: says the edits are kept on this computer and save when the store is back, that drawing and editing are paused and live values still update; "Try again" and "Show my 2 edits". Busy: says nothing was saved, shows the change kept here; "Try again" and "Discard my change". |
| Toast / Undo bar | After an add, bulk edit, import, phone move | Message plus Undo, bottom-centre, auto-hides [ASSUMPTION: timing open]. Examples: "Pipeline added and saved", "Route set on 20 well pads" with "Undo: edit 20 pads", "P14 moved 38 m. Saved". |
| Popup card | Click or tap an item | Order: header (kind glyph, name, subline, pop-out icon to the item's page, close), comms with data age, 2 to 3 key values, alarms (summary, most important in words, "View alarms"). The page link is the header icon, not a body button. "View alarms" shows only while there are alarms. Parts follow the kind setup; no parts, no popup (FR-4). Live while open; stale values marked. Map Studio acknowledges nothing (FR-5). |
| Line popup | Click or tap a line | Opens at the clicked point. Order: header (glyph, name, subline with service, size and length, pop-out, close); the **segment box** for the clicked line segment between its nearest instruments ("Segment PT-1 to PT-2", its span, and its end values or its stale state); comms for the line ("OK - 4 instruments, oldest 9 s ago", or which instrument is stale); the instruments in order along the line between the items its ends snap to, each with distance and live value (for example CTB1 outlet 0 km, PT-1 1.1 km, LV-1 2.0 km "No value", PT-2 2.8 km, SWD1 inlet 2.9 km); then the line's own key values, if its kind sets any, and alarms. The instruments at the segment's ends are highlighted on the map and in the list (FR-40). |
| Bottom sheet | Phone | Popup and edit form open as a bottom sheet with a visible 44 px close; it stops above the App Bar toggle. The popup sheet keeps the popup order and ends with "View alarms" and, for phone-editing roles, **Edit**. Edit turns the sheet into the edit sheet for that one item: Location with **Move**, Name, kind fields, Undo and Done; fields save as they are finished. Done closes the edit sheet. |
| Phone top bar | Phone, view | Search and Needs you share one bar; tapping Needs you expands the ranked list inside the bar and closes any sheet; tapping a row opens that item's sheet. |
| Needs you bar | View mode | Count of sites in alarm, comms lost or stale, with a glyph per state. Click lists them, ranked: alarms by priority, then comms lost, then stale; click a row zooms to and selects the site. With nothing to attend to it stays and reads **"All OK"** in neutral. |
| Search | View mode top-left (always visible); Items list | Search by name or asset as you type, results with kind; choosing zooms and selects (lines and areas fitted). Works keyboard only and at 390 px (FR-33). |
| Legend | View mode bottom-left | Collapsed to a button; opens on request. Holds the Lines and Names toggles and the zoom 14 note. |
| Kind setup | Kinds | Lists only the kinds the project defines (read-only list from the host adapter, AD-4/AD-16); no adding kinds. Sections in order: **Icon, Key values, Comms, Alarms, Popup, Style rule** (last, it builds on the key values). Each key value has an on/off switch that sets what the popup shows; one key value is the icon value. Comms takes one heartbeat path, the clock for data age, Stale and Comms lost. Alarms takes the alarm source and the View alarms link. The popup order is fixed: comms, values, alarms. Each path reports how many items it resolves for. Style rule: States, Bands or Expression on a key value; each state maps to a preset with its preview tile. The **preview item** is chosen once, in the kind's header: the tag browser opens at its asset folder and the style rule previews on it, on the map too with a "Preview" word; the note says what the preview item shows now and when its alarm wins over the rule. Every tag path has a tag button that opens the tag browser. |
| Tag browser | Every tag pick (owner, 2026-10-27) | One browser for every tag pick: key values, comms path, alarms path, a style rule's value, popup params, and a path on one item's override. Shown only to the full editing role; the Gateway refuses anyone else (`tags.browse`, AD-8). A **Provider** dropdown lists the Gateway's tag providers, the default marked "Default" and selected first; the tree shows that one provider, navigated by expanding folders and UDT instances, each row with name, type and data type. **In a kind's setup** it opens at the preview item's asset folder (for example `[default]Mesa/P14`), expanded, with the folder marked "Asset folder"; the editor can go up and out of it, into any folder or any provider, and a "P14 folder" button returns there. **A pick inside the asset folder** is saved as `{asset.path}/...` and shows "Resolves for N of M well pads" (M counts the kind's items with a base path; `tags.resolve`). **A pick outside it** is saved as the full path with the warning "Same tag for every well pad", which also stays on the key value row; it is allowed. **On one item's override** every pick is saved as the full path, with no conversion, marked Override with Reset [ASSUMPTION: it opens at that item's own asset folder]. **Popup params**: a tag picked inside the asset folder for a custom popup view's param gives `{asset.path}/<suffix>`, the one param form beside a literal and one placeholder (owner, 2026-10-27); outside it, the full path as a literal. **Typed paths** go in the Path field and are converted the same way. "Use this tag" (or "Use for P14") is inert until a tag is picked; Cancel or Esc changes nothing. A folder is not a pick. |
| Import steps | Import | Drop CSV, KML or GeoJSON ("You see a preview first. Nothing changes until you add."); then guided steps. **1 Preview**: map plus table, rows drawn as preview rings on the map, rows with problems flagged with the reason ("No location", "repeats row 40") and left for step 3. **2 Map columns**: pick the kind for the file when it has no kind column; each column goes to a field or "Do not import"; columns are matched by heading first; name and location are required. **3 Match to assets**: confident matches ticked, doubtful flagged with the reason ("Letter O, not zero", "Name differs"), existing items update in place, rows that cannot import are skipped with the reason; tick a flagged row to accept it or pick another asset; unmatched rows import unlinked. **4 Summary**: new, updated, skipped, the matches you confirmed, how many stay unlinked, and the undo step; then **Import 123 items**. Back at any step; Cancel at any step changes nothing. An import undoes as one step. CSV template per kind downloads here. |
| First-run checklist | Empty map, Edit mode | The only first-run aid (FR-36's tour is dropped). Card "Get Mesa on the map": "Set up your kinds" (Open Kinds), "Add or import items" (Import a file), "Check the operator view" (Open view mode); each opens its surface and ticks as done; the footer counts "0 of 3 done" and offers "Hide checklist". A viewer on an empty map sees the empty map and a short note. |
| Phone crosshair | Phone Move | A card names the item and the distance from where it was; the old place stays as a faded "Was here" marker; the map moves under a fixed centre crosshair; Done saves the point there and returns to the edit sheet with an Undo toast; Cancel leaves it and returns to the edit sheet. |

## State Patterns

### Item states on the map

| State | Treatment |
|---|---|
| Normal | Neutral (`{colors.glyph-normal}`, `{components.map-marker.dot}`): below zoom 14 a neutral dot, from zoom 14 the kind glyph in a neutral disc (owner, zoom 14 rule). No hue. All live values off: plain icon, no tag reads. |
| Alarm | `{components.alarm-glyph}`, per ER-27: priority 1 triangle, 2 circle, 3 outlined square; unacknowledged, acknowledged (filled with "!"), rectified (check); digit beside the glyph; fade 55 % only when the alarm is not live; dim 35 % when out of scope, dim wins. Glyphs stack above dots. Lines: hue of the highest alarm, glyph and digit at the midpoint. Instruments: glyph at the instrument's place on the line. A cleared unacknowledged alarm draws no hue on a line. Diagnostic never shows. Nothing blinks. |
| Comms lost | The comms-lost glyph, a dashed ring (`{components.map-marker.comms-lost-border}`), the word "Comms lost" beside the name and in the popup; values shown as stale. Lines: dashed. No hue. |
| Stale | The hourglass glyph and "Stale"; values marked "Stale - " with their age. The item drops its last value style until a fresh value arrives (FR-38). No hue. |
| Value style | From the kind's style rule through presets: normal, attention (`{colors.attention}` heavier outline plus the word, no hue), warning, fault, dimmed. Alarm wins over style; style over area tint. |
| Line look with instruments | **Per line segment**, drawn from the instruments at that segment's two ends, as the template's map does (owner, 2026-10-27). A segment takes the worst of its two ends: dashed when either is stale, attention when either value is outside its band; a stale PT-2 dashes only the two segments touching PT-2, and the line's name chip adds "Stale". **A segment with no instrument at either end draws normal**, a thin neutral line (owner, 2026-10-27). See [key-screen-3-line-instruments-stale.png](mockups/key-screen-3-line-instruments-stale.png). |
| Unlinked | "Unlinked" badge in the list; no live values; counted in the list footer. Vanished asset shows unlinked with the reason. Unknown kind shows an "Unknown kind" marker (FR-11). |
| Selected | Selection ring (`{colors.selection}`) and name; flow arrow on a selected line only. |

### Save and store states

See [key-screen-9-save-states-saved.png](mockups/key-screen-9-save-states-saved.png), [-saving](mockups/key-screen-9-save-states-saving.png), [-conflict](mockups/key-screen-9-save-states-conflict.png), [-unreachable](mockups/key-screen-9-save-states-unreachable.png) and [-busy](mockups/key-screen-9-save-states-busy.png).

| State | Surface | Treatment |
|---|---|---|
| Saved | Save status | Check and "Saved", inline beside Undo and Redo; opens Recent changes. |
| Saving | Save status | Spinner and "Saving...", inline. |
| Not saved | Save status, item | "Not saved" with the reason on its own row; the edit is kept in the browser until it saves or the user discards it (FR-29, AD-10). |
| Conflict | Save status, conflict card | `{components.save-status.problem-foreground}`, "Not saved - conflict with Sam's change"; the card shows the other change and keeps yours (FR-31). |
| Store unreachable | Save status, save banner, whole component | "Store unreachable - 2 edits not saved". The banner says the edits are kept on this computer and save when the store is back. Drawing and editing are paused (the toolbar fades), live values still update, nothing stale is drawn as current (FR-29, AD-10). "Try again", "Show my 2 edits". |
| Busy | Save status, save banner | "Not saved - Map Studio is busy"; the banner reads "Map Studio is busy with other map requests; nothing was saved. Try again in a moment." and shows the change kept here; "Try again", "Discard my change". |
| Undo refused | Toast | Undo of a saved edit that another editor has since changed is refused, saying who changed it (FR-17). |
| Live edits from others | Map, list | Saved edits from other sessions appear without reload within a few seconds. |

### Surface states

| State | Surface | Treatment |
|---|---|---|
| Empty map, editor | Edit mode | First-run checklist; the list reads "No items yet - Items you add or import are listed here, grouped by place." |
| Empty map, viewer | View mode | Empty map and a short note. |
| No asset list or incomplete | Item form, Kinds | Says where the asset list comes from and that it is empty or incomplete (FR-10). |
| Path does not resolve | Kinds | Per path "Resolves for N of M items", listing the items it fails for. |
| Tag browser: opened | Kinds, item override | Opens at the preview item's asset folder (on an override, at that item's) with its tags listed and a note: "Opened at P14's asset folder, the preview item. A tag in it is saved for every well pad as {asset.path}/.... Go up to pick a tag anywhere else." See [key-screen-6-kinds-tags-open.png](mockups/key-screen-6-kinds-tags-open.png). |
| Tag browser: pick inside | Tag browser | `{asset.path}/GasRate` and "Resolves for 3 of 3 well pads" with a check. See [key-screen-6-kinds-tags-inside.png](mockups/key-screen-6-kinds-tags-inside.png). |
| Tag browser: pick outside | Tag browser, key value row | The full path with the shared-tag note on `{colors.warning-tint}`: "Same tag for every well pad - AmbientTemp is outside P14's asset folder, so it is saved as the full path and all 3 well pads show this one tag." The key value row keeps the "Same tag for every well pad" tag. See [key-screen-6-kinds-tags-outside.png](mockups/key-screen-6-kinds-tags-outside.png). |
| Tag browser: item override | Items, Details | "Saved for P14 only, as the full path"; the row in Live now shows the full path and Override with Reset; the other items keep the kind's path. See [key-screen-6-kinds-tags-override.png](mockups/key-screen-6-kinds-tags-override.png). |
| Tag browser: empty folder | Tag browser | "No tags in this folder" under it; a folder picked shows "Pick a tag, not a folder." and "Use this tag" stays inert. See [key-screen-6-kinds-tags-empty.png](mockups/key-screen-6-kinds-tags-empty.png). |
| Tag browser: loading | Tag browser | A "Loading..." row with the spinner under the folder being opened; the rest of the tree stays usable. See [key-screen-6-kinds-tags-loading.png](mockups/key-screen-6-kinds-tags-loading.png). |
| Tag browser: provider unreachable | Tag browser | The tree is replaced by "Can't browse edge-p12" (cloud glyph, `{colors.warning}`), "The Gateway cannot reach this tag provider right now. Try again, pick another provider, or type the path below." and "Try again"; the Path field still works and typed paths are converted as usual. See [key-screen-6-kinds-tags-unreachable.png](mockups/key-screen-6-kinds-tags-unreachable.png). |
| Busy (loading) | Map, list, import preview | [ASSUMPTION] the save-status spinner pattern on the busy surface; no skeletons specified yet. |
| No search results | Search | "No matches" [ASSUMPTION: wording]. |
| Nothing needs you | Needs you bar | "All OK" in neutral; the bar stays. |
| Import preview | Import, map | Preview rows on the map as rings with "Preview - not on the map yet"; existing items that will change carry "Updated". |
| Import errors | Import, Preview | Count found, rows with problems flagged with reasons and decided in Match; cancel changes nothing. |
| Permission | Whole component | No editing role: no Edit switch, no tools, no affordance (FR-7). |
| Phone, below 768 px | Edit | No drawing tools and no Kinds; move a point and edit properties only (FR-28). |

## Interaction Primitives

- **Select.** Click or tap an item on the map or a row in the list. In View mode it opens the popup; in Edit mode it opens properties. Click empty map to clear. Shared spot within 20 m opens a pick list (FR-34).
- **Multi-select.** In the list: checkboxes, Shift-click range, Select all in a group or filter. On the map: Box select, hold Alt for a lasso; Shift-click adds. The mode pill reads "N selected - Shift-click to add".
- **Draw.** Kind buttons for common kinds, or generic Point, Line, Area with the kind picked in the form after. Lines and areas finish by double-click, Enter or Finish; Backspace removes the last vertex; Esc cancels. "Add another like this" copies kind and properties, not the asset link (FR-18).
- **Instruments.** An instrument is placed by clicking the line or typing its distance along line, and moves only along the line by dragging or typing a new distance (FR-40). Moving, reshaping or splitting a line keeps its instruments on it in the same save. **Deleting a line deletes its instruments in the same save, and one undo restores both** (owner, 2026-10-27); Recent changes records it as one change ("Deleted line L-TEST and its 2 instruments in one change").
- **Snap.** A toggle on the toolbar, **off by default** (owner overrides the earlier snap-by-default idea; FR-16 still holds). When on, a visible indicator ("Snap to CTB1 - click to connect"); snapped and floating ends look different.
- **Place a point.** Click the map, then drag to fine-tune (the main way); a hint at the new pin reads "Drag to fine-tune, or type latitude and longitude". Typed latitude and longitude in Details is the backup, with the place check (country, province or state, city) and "Zoom to location". Address or legal land description search is not offered.
- **Change geometry.** Drag a point or vertex, midpoint handle to insert, delete a vertex, split a line at a point; every one also doable without a drag (Move then tap, typed values) (FR-15).
- **Delete.** No confirmation; undo restores (FR-17).
- **Undo and redo.** Buttons and Ctrl+Z, Ctrl+Shift+Z for this session's changes, even after they saved. A bulk change, an import and a line delete are one step each. Recent changes holds the record with Revert per change.
- **Bulk edit.** Shared fields only, Mixed where values differ, a change applies to all selected, one undo step.
- **Phone move.** Tap the item, tap Edit in its bottom sheet, tap Move beside Location: the map moves under a fixed centre crosshair while a card shows the distance from where it was; tap Done (or Cancel). After Done an Undo toast reads "P14 moved 38 m. Saved". This replaces the PRD's long-press and drag (UJ-4, FR-27); the PRD is updated to match (owner, 2026-10-27). Typed coordinates in the edit sheet's Location field are the non-drag way.
- **Keyboard.** Esc to Select; Enter to finish; Backspace removes a vertex; Ctrl+Z / Ctrl+Shift+Z; Shift-click; Alt for lasso; `?` opens the shortcut panel (FR-18).
- **Banned.** A Publish or release step; free colour pickers; a save button; blinking; controls in the bottom-right corner; a first-run tour.

## Accessibility Floor

Behavioural. Visual contrast lives in `DESIGN.md` (3:1 non-text in both themes).

- Every touch target on the phone is at least 44 px (`{spacing.target-touch}`): zoom buttons, popup close and pop-out, sheet buttons, Needs you, Move, Done, Cancel, Undo. The tracer spike failed at 29 px zoom buttons and a 21 px popup close; both must pass.
- Colour is never the only signal: every state has a glyph or a word (ISA-101, ER-27); comms lost and stale have no colour at all; save problems and import flags carry words.
- Every drag has a non-drag way: typed coordinates, typed distance along line, Move then tap (FR-14, FR-15, FR-40).
- Search (`{components.search-field}`) and its results work keyboard only (FR-33). Every tool has a keyboard path; Esc always returns to Select.
- The current mode is always named in words (FR-8).
- Selection uses `{colors.selection}`, distinct from every state hue.
- [ASSUMPTION] Glyphs carry text alternatives matching their legend words ("Priority 1 alarm, unacknowledged", "Comms lost").
- [ASSUMPTION] The tag browser's tree works keyboard only, as a tree: Up and Down move, Right expands, Left collapses or goes to the parent, Enter picks a tag; the shared-tag warning and the resolve count are words, never colour alone.

## Responsive & Platform

| Width | Behaviour |
|---|---|
| 1440 and up | Direction A: rail `{spacing.rail-width}`, list `{spacing.list-panel-1440}`, properties `{spacing.properties-panel-1440}`, map about 748 px with a selection. |
| 1366 | Direction A: list `{spacing.list-panel-1366}`, properties `{spacing.properties-panel-1366}`; map about 718 px with a selection, 1038 px without. The top row (toolbar plus Editing switch) is full. Opening properties pans the map to keep the selection in view. |
| 768 to 1365 | Direction A as at 1366 down to about 1280 px; below that the list panel collapses to a button, leaving the rail, properties and map (owner, 2026-10-27). |
| Below 768 | No drawing tools (FR-28). Phone editing from the bottom sheet only. |
| 390 (phone, view) | Map fills the page. One top bar holds search and Needs you and expands on tap. Zoom top-right at 44 px, Legend bottom-left, popups as bottom sheets with a visible close. Bottom-right clear for the App Bar toggle. See [key-screen-2-phone-sheet.png](mockups/key-screen-2-phone-sheet.png), [key-screen-2-phone-needs.png](mockups/key-screen-2-phone-needs.png), [key-screen-2-phone-edit.png](mockups/key-screen-2-phone-edit.png), [key-screen-2-phone-move.png](mockups/key-screen-2-phone-move.png). |

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

## Designer Setup Form

The Map Studio Setup tab in the Ignition 8.3 Designer (owner, 2026-10-27, after testing epic 2 story 7's editor live: it worked but looked unfinished, with a plain label column, full-width text fields across a 2000 px tab, everything typed by hand and the schema version in an editable-looking field). The setup stays a project resource tab. The look is the Designer's own, matched to Ignition's Project Properties dialog (DESIGN.md, Designer setup form). Field meanings and the Gateway's messages are `docs/setup.md` and `docs/setup-editor.md`; this section adds the form's behaviour. Mock: [designer-setup-form.html](mockups/designer-setup-form.html) with [-normal](mockups/designer-setup-form-normal.png), [-reasons](mockups/designer-setup-form-reasons.png), [-inherited](mockups/designer-setup-form-inherited.png), [-newer](mockups/designer-setup-form-newer.png), [-picker](mockups/designer-setup-form-picker.png), [-empty](mockups/designer-setup-form-empty.png), [-new](mockups/designer-setup-form-new.png). The mock predates fix 16 (owner, 2026-10-27): its combo boxes, chevrons and footer link, and its Gateway-not-reachable state, are superseded by the rules below.

**One form, one place** (owner, 2026-10-27, after testing story 7's Create setup dialog live: a modal holding the old full-width form in a scroll pane with both scroll bars, Create enabled with the connection empty, and a second error dialog repeating the reason shown under the field). Creating and editing a setup are the same tab and the same form. There is **no create dialog**.

**A quiet form** (owner, 2026-10-27: the form was too busy; it reads like Ignition's Project Properties, labels, fields and section headings, with text only when it means something). No help line under a field: each label carries its help as a tooltip. A mark shows beside a field only when something is wrong. One "Refresh lists" link in the header replaces the per-field refresh buttons. The footer shows only when it has something to say. Reasons and warnings keep their wording.

**The Designer's own controls** (owner, 2026-10-27, after the Designer session of story 16's form, comparing it with Project Properties > Project > General: Default Provider, Default Database, Identity Provider, User Source and the Client Poll Rate spinner). Every dropdown is the Designer's own editable combo box and the refresh interval its own number spinner, drawn by the Designer's look and feel: no arrow button, edge or background of Map Studio's. The role picker adds roles through the same combo box, so its arrow matches. Colours and fonts were already right and stay.

**Only the setup is held back** (owner, 2026-10-27). A File > Save with reasons left saves the rest of the project; the setup is not written, and its tab keeps the changes and the reasons, with "(unsaved)" on the tab and the node.

### Layout

- **Header**: "Map Studio Setup" alone (no subline: the tab names the project), and on the right a "Refresh lists" link next to the schema version, which is small read-only text ("Schema version 1") and never a field. Refresh lists reads every list again (the Gateway's connections, roles and secret providers; the project's functions and pages); it is not shown in the empty and read-only states, which have no lists.
- **No section list** (owner, 2026-10-27). The tab holds the form alone, left aligned in the tab with the tab's padding: the form is short (it fits one Designer window) and the footer already counts reasons and warnings, so a list of sections would only add a column.
- **Form**: the four sections Map store, Who can edit, Kinds and assets, Map, in that order, each with its heading inside the form as Project Properties' "Tag Settings"; left aligned, at most 760 px wide; fields keep their width on any tab width.
- **Footer only when it has something to say** (owner, 2026-10-27). It shows for: reasons left ("N reasons left - this setup is not saved until they are fixed." and "N warnings do not stop a save."); a new unsaved setup (see New setup under States, with "Discard new setup"). The plain normal, inherited, empty and read-only states have no footer: "Saves with the project" and "Read only" are not repeated there (the read-only banner and the status bar say it). The reason count is plain text, not a link (owner, 2026-10-27: the form is short, so there is nothing to scroll to). There is no Gateway-not-reachable footer: the Designer already shows when it has no Gateway connection. The tab has no OK, Apply, Create or Cancel: it saves with the project, as now.
- **No horizontal scroll bar, ever.** The form is at most 760 px wide and wraps: reasons, warnings and the one note wrap at 560 px, and on a tab narrower than the form a field pair (Map token) and a row's label and control stack instead of overflowing. Only the form scrolls, vertically, when the window is short; the header's new-setup marker and the footer stay in view.

### Fields

Every list is a suggestion: **typing is always allowed**, and what is typed is saved as typed. A list from the Gateway loads when the tab opens and again with the header's **Refresh lists** link; a list from the project (functions, pages) is read from the open project, so it works without the Gateway. A list that fails (no Gateway, a refusal, an identity provider that does not list its roles) stays empty and says nothing, as any Ignition dropdown does (owner, 2026-10-27).

| Section | Field | Control | List from | Label tooltip (no line under the field) | Reasons (stop the save; wording from `docs/setup.md`) | Warnings (never stop the save) |
|---|---|---|---|---|---|---|
| Map store | Database connection | The Designer's editable combo box, "Select one..." | The Gateway's database connections, each with its type | "The Gateway database connection (PostgreSQL) the map is stored in. Pick one or type a name." | "Name the database connection Map Studio stores the map in." | "MapStore is not a database connection of this Gateway yet. Map Studio waits for it; add it on the Gateway under Connections > Databases." [ASSUMPTION] "MES is a Microsoft SQL Server connection; Map Studio stores maps in PostgreSQL." |
| Who can edit | Full-editing roles | Chips (one per role, with a remove cross) above the Designer's editable combo box "Add a role...", whose list is the roles | The project's identity provider (Perspective project properties) | "Edit everything: drawing, kinds, import. Roles of the identity provider default, compared exactly." | "MapEditor is listed twice." | "MapEdtor is not a role of the identity provider default. It is saved as typed; nobody holds it until the provider has it." |
| Who can edit | Phone-editing roles | As full-editing roles | As above | "Move points and edit properties from a phone. A role in both lists gets full editing." | "MapOperator is listed twice." | As above |
| Kinds and assets | Kinds function | Editable combo, monospace | The project library's functions (inherited ones too), as `package.function` | "The project library function that returns the kind list, as package.function." | "Name a project library function as package.function, for example mapstudio_adapter.kinds." and the Gateway's `kindsFunction must be empty or a project script function name ...` | "mapstudio_adapter.kind is not a function in this project's library. It is saved as typed." |
| Kinds and assets | Assets function | As kinds function | As above | "The project library function that returns the asset list, as package.function." | As kinds function, for `assetsFunction` | As kinds function |
| Kinds and assets | Refresh interval | The Designer's number spinner, 1 to 3600, with "seconds"; any text can be typed (the reason says what is wrong) | none | "How often kinds and assets are read again. 1 to 3600." | "Refresh interval must be a whole number of seconds, for example 10." (not a whole number); the Gateway's "refreshIntervalSeconds must be a whole number from 1 to 3600, not 0." (out of range) | none |
| Map | Basemaps | Four checkboxes: None, OpenStreetMap, Satellite, Mapbox (`none`, `osm`, `satellite`, `mapbox`) | fixed | "The basemaps the map offers. At least one. Mapbox needs the map token below." | "basemaps must name at least one of none, osm, satellite, mapbox." | [ASSUMPTION] "Mapbox needs a map token. Name its secret below." while Mapbox is ticked and the token is empty |
| Map | Alarm page | Editable combo, monospace; the list's last item is "Insert placeholder..." (nothing beside the field) | The project's Perspective pages (page configuration URLs) | "The Perspective page View alarms opens. Add a placeholder such as {item.name} to filter it to the item." | The Gateway's `alarmPage must be empty or a page path starting with /, not "alarms"` and the placeholder message | "/alarm is not a page of this project. It is saved as typed." |
| Map | Map token | Secret provider combo ("Select one...") and secret name combo side by side; the form's one visible note under them: "Names only - the Designer never reads the token." | The Gateway's secret providers, then the chosen provider's secret names [unverified: whether the Designer can list names] | "The secret that holds the basemap token: a provider and a secret name. Names only - the Designer never reads, shows or logs the token." | The Gateway's `tokenSecret must be the name of a secret as text (its value is not shown)` | "No secret named mapbox-token in Internal. It is saved as typed." |

Rules:

- **Dialogs only for what is not on screen.** A reason or warning lives beside its field and in the footer count; it is **never repeated in a dialog**. A Map Studio dialog appears only for something the tab cannot show: a write that failed on disk, Start from defaults asking first. A save with reasons left holds back only the setup (owner, 2026-10-27): the rest of the project saves with no error, the setup's tab comes forward with its changes and reasons, and the tab and node read "(unsaved)".
- **Reasons and warnings.** A reason stops the save and keeps the Gateway's wording (the input checks and `Setup.read`'s messages, unchanged, beside the field they name; a message naming no field shows under the header). A warning says something the Gateway would accept but that will not work yet; it never stops a save. Warnings are the form's only new words; they come from the lists, so they show only when the list loaded.
- **Marks only on problems** (owner, 2026-10-27). A field found in its list, an empty field and a field whose list is unavailable show nothing beside them; there is no found check. A mark appears only when something is wrong: the warning glyph after the field (value not in its list) and the reason or warning under it.
- **Help is the label's tooltip** (owner, 2026-10-27): the text in the table's tooltip column, shown on hovering the label, as Project Properties does. The one visible line is Map token's "Names only - the Designer never reads the token.", kept because it is a promise, not help. See the open tooltip on Phone-editing roles in [designer-setup-form-normal.png](mockups/designer-setup-form-normal.png).
- **Reasons update as you type**, as now; the footer counts follow.
- **Role picker.** The combo box lists the provider's roles, those already in the field marked "added"; picking a role adds its chip, Enter adds what is typed, Backspace in the empty input removes the last chip, each chip's cross removes it. A role listed twice in the file shows both chips, the second with the reason glyph, until one is removed. An identity provider that cannot list its roles (an OIDC or SAML provider gives roles in its claims) leaves the list empty, with no message and no unknown-role warnings [ASSUMPTION: which 8.3 providers can list roles].
- **Connection list** shows each connection with its type; a connection that does not exist yet can be typed and is kept with the warning, since Map Studio waits for it (`docs/contract.md`, the map store).
- **Function list** shows every function of the project library (`ignition/script-python`), inherited scripts included [unverified], as its full dotted path (`mapstudio.kinds.get`); picking one fills the field. Fix 16 (owner, seen in the Designer 2026-10-27): the list read another resource type and came back empty, so the dev setup's own functions were warned as missing; it now reads the project library.
- **Alarm page list** shows the page URLs from the project's page configuration. Picking a URL with a `:param` puts it in with each `:param` turned into `{item.name}`, selected so the next pick from "Insert placeholder..." or typing replaces it [ASSUMPTION]. **Insert placeholder...**, the last item of the Alarm page list (owner, 2026-10-27, replacing the "{ }" button), opens the placeholders at the caret: `{item.id}`, `{item.name}`, `{asset.id}`, `{asset.path}` and `{item.properties.<field key>}`.
- **Map token**: the form shows and saves names only. No control reads a secret's value, and no warning or log line holds one.
- **A setup file with a basemap listed twice** shows the box ticked and the reason "osm is listed twice."; unticking and ticking it writes it once.

### States

| State | Treatment |
|---|---|
| Normal | Values only: no marks, no help lines, no footer; the Map token note is the one line of text. The mock draws the Phone-editing roles tooltip open. See [designer-setup-form-normal.png](mockups/designer-setup-form-normal.png). |
| Reasons and warnings | Each under its field (reason in `{colors.designer-error}`, warning in `{colors.designer-warning}`, each with its glyph; a warning also puts its glyph beside the field); the control keeps the Designer's look, with no coloured edge. The footer counts the reasons and the warnings as plain text. A project save with reasons left holds back only the setup: the rest of the project saves, nothing of the setup is written, the tab keeps its changes and reasons and reads "(unsaved)", as does the node; no dialog. See [designer-setup-form-reasons.png](mockups/designer-setup-form-reasons.png) (refresh 0, a role listed twice, a connection the Gateway does not have, a role the provider does not have). |
| A list that fails | No Gateway (the Designer shows that itself), a refusal, or a list that cannot be read: the combo box opens empty and typing works; no message, no mark, no warnings from that list (nothing to compare with). Functions and pages still list and check. Refresh lists asks again (owner, 2026-10-27: no Gateway-not-reachable footer, banner or Try again). |
| Inherited | An info banner: "Inherited from template-base. Saving makes this project's own copy." (existing wording); the Project Browser node reads "(inherited)"; the form is editable. See [designer-setup-form-inherited.png](mockups/designer-setup-form-inherited.png). |
| Inherited, not overridable | A lock banner: "Inherited from template-base, and that project does not allow overriding it. Read only." Fields show their values, disabled; Refresh lists stays; no footer. |
| Newer schema | A lock banner: "Read only. This setup was written by a newer Map Studio (schema 2). This Designer edits schema 1. It is shown as written and never rewritten here."; the header reads "Schema 2 - read only"; the form is replaced by "setup.json as written" in a read-only monospace box, since this Designer cannot be sure what a newer field means. No Refresh lists link and no footer. See [designer-setup-form-newer.png](mockups/designer-setup-form-newer.png). |
| Unreadable file | As newer schema, with "This setup cannot be read: <reason>" and the **Start from defaults** button, which asks first (existing wording). |
| No setup (empty) | Opening Map Studio Setup opens the tab in an empty state: "No Map Studio setup", "This project has no Map Studio setup yet. The map store is unavailable until it has one.", one primary button **Create setup**, and the help "Create setup fills this tab with the defaults. Nothing is written until File > Save."; the node reads "(none)"; no footer and no header link. See [designer-setup-form-empty.png](mockups/designer-setup-form-empty.png). |
| New setup | Create setup fills the same tab with the defaults (full-editing role MapEditor, phone-editing role MapOperator, refresh 10 seconds, basemaps None and OpenStreetMap, everything else empty) and focuses Database connection. The header carries the marker "New setup - saves with the project"; the node reads "(new, unsaved)". Reasons show beside their fields as in any edit (an empty connection: "Name the database connection Map Studio stores the map in."). Nothing is written until File > Save. With reasons left the footer reads "1 reason left - this setup is not saved until it is fixed." with "File > Save saves the rest of the project without it.": the save creates nothing and the tab stays "(new, unsaved)", reopened if it was closed. The footer (it shows for a new setup even with no reasons left, as "New setup - not saved yet.") carries the **Discard new setup** link, which returns the tab to the empty state (nothing was written, so it asks nothing). After a successful save the marker goes and the tab is the normal state. See [designer-setup-form-new.png](mockups/designer-setup-form-new.png). |

### Accessibility

- Every control has its label bound to it (Swing `setLabelFor`), so a screen reader names it; the label's tooltip text is also set as the control's accessible description, so the help is read without hovering.
- Tab order starts at the header's Refresh lists link, then follows the form top to bottom; "Insert placeholder..." is reached in the Alarm page list. The footer's reason count is text, not in the tab order.
- Reasons and warnings are a glyph and words, never colour alone. A tooltip also shows on keyboard focus of the label's control (Ctrl+F1, Swing's standard) [ASSUMPTION].
- Everything is doable by keyboard: combos open as the Designer's do (Alt+Down), chips add with Enter and remove with Backspace.

## Engineering Review Items

Alarm presentation changes go to the template's engineering review (ER-27, template `docs/ux.md` section 11) before release. Each is a deliberate change or addition:

1. **Bottom sheets on the phone** for popups and properties, replacing the template's chip row and top sheets (PRD FR-4, FR-28).
2. **Kind glyph from zoom 14**, a neutral dot below, replacing the template's state-only markers that never show kind.
3. **Blink**: the icon catalogue proposes blinking an unacknowledged Critical at draw time; the template map never blinks. This spine keeps "nothing blinks" until the review decides.
4. **Style presets** (normal, attention without hue, warning, fault, dimmed; line patterns) and their previews (FR-38).
5. **Alarm glyphs** and their hue tokens in both themes, including the unacknowledged mark at 16 px and triangle-like kind outlines (line valve, compressor station).
6. **Instruments on lines**: instrument alarm glyphs at their place on the line, the per-segment line look from the worst of each segment's two end instruments, and the normal look of a segment with no instrument at either end (FR-40).
7. **Area category tints** (FR-39).
8. **Popup alarm block** in the alarm-1 tint, the Needs you counts and its neutral "All OK".

## Key Flows

### UJ-1. Sam lays out a field that has no map.

Sam, map editor, laptop at 1366, empty map, a spreadsheet of researched items beside the browser.

1. Sam turns on the Edit switch; the first-run checklist shows "Set up your kinds", "Add or import items", "Check the operator view".
2. Sam picks a kind button, Well pad. The mode pill reads "Add a well pad - click the map, then drag to fine-tune".
3. Sam clicks near the pad, drags the pin onto it; properties open on Details. Sam types the name and, from the spreadsheet, the latitude and longitude; the place check shows "Lea County, New Mexico, US"; "Zoom to location" confirms.
4. Further down Details, Sam picks the asset; Live now fills in from the kind.
5. Sam picks Pipeline, clicks from CTB1 to SWD1 (Snap turned on for this), and finishes with a double-click. The toast says "Pipeline added and saved".
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

Failure: Sam drags the wrong vertex; Ctrl+Z puts it back. If another editor moved the same lateral meanwhile, the save status reads "Not saved - conflict with ..." and the conflict card shows their change. If the store drops, the save banner says the edits are kept and the tools pause until it is back.

### UJ-3. Jordan provisions a field from files.

Jordan, integrator, laptop, Map Studio opened straight into Edit mode on an empty map, 120 pads.

1. In Import, Jordan downloads the meter CSV template and fills it.
2. Jordan drops the GIS export: Preview shows the features on the map and in a table, with rows that have problems flagged and their reasons. Jordan maps columns to fields.
3. Match to assets: most rows are ticked by name; doubtful ones are flagged; Jordan fixes those one by one. Summary: new, updated, skipped. Import. The same for the CSV.
4. In Kinds, Jordan opens Well pad, leaves P14 as the preview item and picks the icon; each key value's tag button opens the tag browser at P14's asset folder, and a pick there is saved as `{asset.path}/...` with "Resolves for 3 of 3 well pads"; Jordan sets the comms heartbeat, the alarms path, the popup parts and the link `/pad/{asset.id}`, and last a style rule; the preview pad shows each state.
5. Back in Items, Jordan box-selects twenty pads on one route; the bulk form shows shared fields, Operator reads "Mixed - 3 values"; Jordan picks one. The toast says "Undo: edit 20 pads".
6. **Climax:** every pad on the map shows comms, pressure and its alarm count, all from one kind setup.

Failure: rows with no matching asset stay on the map as Unlinked, and the list footer counts them until they are matched or deleted. The whole import undoes as one step.

See [key-screen-7-import-1.png](mockups/key-screen-7-import-1.png) to [key-screen-7-import-4.png](mockups/key-screen-7-import-4.png), [key-screen-6-kinds-tags-inside.png](mockups/key-screen-6-kinds-tags-inside.png), [key-screen-5-bulk-edit.png](mockups/key-screen-5-bulk-edit.png).

### UJ-4. Alex fixes a pin from the field.

Alex, operator with phone editing, at pad P12, 390 px phone, gloves.

1. Alex taps P12; its popup opens as a bottom sheet with an Edit button.
2. Alex taps Edit, then Move beside Location. The map now moves under a fixed centre crosshair; the card counts the metres from where it was; Alex pans until the crosshair sits on the pad and taps Done.
3. The edit sheet returns with an Undo toast, "P12 moved 38 m. Saved".
4. In the same sheet Alex corrects the access road note; it saves when finished. Done closes the sheet.
5. **Climax:** in the satellite view the pin sits on the pad, and everyone sees it there.

Failure: the crosshair landed on the wrong spot; Undo puts it back. Cancel during Move leaves the pin where it was.

This flow follows the owner's crosshair decision, which replaces the PRD's long-press and drag in UJ-4 and FR-27.

### UJ-5. Riley follows an alarm from the map.

Riley, viewer, desktop, View mode, no tools.

1. The Needs you bar reads "Needs you 1: 1 alarm". CTB1's icon shows a normal comms glyph, an alarm glyph and the digit 2 beside it.
2. Riley clicks CTB1: the popup shows comms with its data age, two key values, then "2 alarms" with the most important in words and "View alarms".
3. Riley clicks "View alarms" and lands on the alarm page filtered to CTB1, acknowledges one there; later Riley opens CTB1's page with the pop-out icon in the popup header.
4. Riley clicks L-SWD between PT-1 and PT-2: the line popup opens at "Segment PT-1 to PT-2", lists CTB1 outlet, PT-1, LV-1, PT-2 and SWD1 inlet with live values, and PT-2 shows its own alarm badge, as its glyph does at its place on the line.
5. **Climax:** Riley sees CTB1's alarms in the alarm table, or its page, within two clicks of seeing the alarm.

Failure: CTB1's comms are lost: the icon has a dashed ring and "Comms lost", the popup says "Comms lost", and values show as stale with their age, never as current. When the alarms clear and comms return, the bar reads "All OK".

## Open Questions

1. **Alarm hue tokens.** Which host Perspective theme variables carry priority 1, 2 and 3 (epic-viewing's call; the mocks used `--error` for priority 1)?
2. **Area tint palette.** Which theme tokens make the FR-39 palette?
3. **Kinds tag browser.** The design is settled (owner, 2026-10-27); the Gateway's 8.3 tag browse of any provider (`tags.browse`, `tags.resolve`, AD-8) stays unverified until epic-map-store-and-data entry 15 checks it live. Open to the owner: where the browser opens on one item's override (assumed: that item's own asset folder), and whether the shared-tag note may use the `warning` token (assumed yes; DESIGN.md Colors).
4. **Style rule Expression.** Where it is evaluated and in which language (PRD FR-38, AD-16).
5. **Legend.** Resolved: Sofia added it as PRD FR-41 (initiative R42, epic-viewing entry 3.3) on 2026-10-27.
6. **Instrument tool placement** on the draw toolbar and the instrument marker look (the key-screens mock frames the line valve in a rounded square, which the reserved-shapes rule does not allow).
7. **Toast timing** and Undo bar lifetime.
8. **Map token storage (Designer setup form).** Schema 1 has one text field, `tokenSecret`, but the owner's form picks a secret provider and a secret name. Recommended: keep schema 1 and store `"<provider>/<name>"` in `tokenSecret` (the Gateway's rule, text, already accepts it; nothing reads the token yet since Mapbox is deferred), documented in `docs/setup.md`; the alternative, a `tokenSecretProvider` key, is refused by schema 1 and needs schema 2. Owner and architecture to decide.
9. **Designer lists from the Gateway.** Whether the Designer can list database connections with their type, an identity provider's roles, and a secret provider's secret names (names only) is unverified; until it is, those fields fall back to typing with no warnings, as a list that fails does.
10. **Section list.** Resolved by the owner on 2026-10-27: no section list and no page switching. The tab is the form alone; the footer counts reasons and warnings (plain text since 2026-10-27: no link, nothing to scroll to).

**Resolved by the owner on 2026-10-27:** phone move is the crosshair (PRD UJ-4 and FR-27 updated to match); first run is the checklist only, FR-36's tour dropped; Mapbox (FR-32) and reference layers (FR-26) deferred; no Publish step confirmed; Needs you shows "All OK" in neutral; Direction A collapses the list panel below about 1280 px; Direction A simplified first by the Filter button and the Details and Style tabs; line look per segment, deleting a line deletes its instruments with one undo, and a segment with no instruments draws normal (PRD section 9 questions 9 and 10).
