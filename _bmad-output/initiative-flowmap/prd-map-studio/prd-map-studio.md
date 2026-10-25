---
title: Map Studio for Ignition Perspective - PRD
status: draft
created: 2026-10-25
updated: 2026-10-25
---

# PRD: Map Studio for Ignition Perspective

Draft. Sections are filled in on the coaching path.

## 1. Vision

Map Studio is the map of an Ignition 8.3 Perspective project: one component everyone opens. Viewers and operators see their sites and assets on a map, each icon showing its comms status and one key value, and a click opens a popup with the critical information (metadata, comms, a few key values) and, where configured, a link to the asset's own page.

Admins and integrators see the same map plus the Map Studio tools. With them they build the map for a new field, map a field that runs in Ignition but has no map yet, and keep an existing map right: add and change items, draw lines and areas, import files, link each item to an asset in the project and choose which tags feed its icon and popup. Map Studio saves the map as they work, to a database the project names, and that database is the map's source of truth.

Linking the map to the project's data is the main benefit: a map that is quick to build and stays connected to live values.

## 2. Target User

### 2.1 Roles

- **Map editor** - an admin or an integrator. Builds a map for a new field, builds a map for an existing field that has no map yet, and changes an existing map. An integrator who supports a project is a map editor too.
- **Integrator** - everything a map editor does, plus mass provisioning by CSV import.
- **Operator** - on a phone in the field: moves a point and edits an item's properties. Draws nothing.
- **Viewer** - anyone without an editing role: sees the map, icons and popups, and follows a popup's link.

### 2.3 Key User Journeys

- **UJ-1. Sam lays out a field that has no map.**
  - **Persona + context:** Sam is a map editor bringing a field onto the map: a new field, or an existing one that runs in Ignition but has no map. Before starting, Sam has researched every item to bring online, with its properties and its latitude and longitude, often already in a spreadsheet laid out like the import template.
  - **Entry state:** signed in on a laptop, on the map page, which is empty or nearly empty.
  - **Path:**
    1. Sam picks what to add, in any order: a pipeline, a pad, a compressor station.
    2. A form asks for the name and properties of that kind of item, and links it to an existing asset in the host system.
    3. Sam sets its location either by typing latitude and longitude or by picking the point on the map, the way you set a stop in map directions. Typed coordinates show their country, province or state, and city, so Sam sees at once whether they are roughly right; "Zoom to location" shows the spot on the map.
    4. Sam checks the layout against satellite imagery or an imported reference layer.
    5. Sam repeats until the field is laid out, or imports a file instead (UJ-3).
  - **Climax:** the field is on the map and every item is linked to its asset. Others check it against satellite imagery or a reference layer, even while Sam is still working.
  - **Resolution:** nothing to submit: the map is saved as Sam works. Sam shares it by adding the page to the project's navigation or sending its URL.
  - **Edge cases:**
    - A line end that snapped looks different from one left floating. An unconnected pipeline is allowed.
    - A name already in use gets a red underline and a tooltip ("already used by another item"). It is allowed when the items link to different assets.
    - Sam leaves halfway through a large layout. Nothing is lost: the map was saved as Sam worked, and Sam carries on later from any computer.

- **UJ-2. Sam keeps a running field's map right.**
  - **Persona + context:** Sam, a map editor, learns that a lateral was rerouted, a new pad P31 came online and the lease needs a geofence.
  - **Entry state:** signed in on a laptop, on the map page with the live field showing; Sam opens the Map Studio tools.
  - **Path:**
    1. Sam selects the lateral, drags two vertices to the new route and inserts a third on the line.
    2. Sam adds P31 with "Add another like the last" from a neighbouring pad, sets its location and links it to the P31 asset; its base tag path comes from the asset, so its icon and popup work at once from the pad kind's setup.
    3. Sam draws the lease geofence vertex by vertex and finishes it with a double-click.
  - **Climax:** P31's icon shows its comms status and pressure as soon as it is linked; viewers see the new route and the geofence without a release step.
  - **Resolution:** the changes are saved; Sam closes the tools and the page is the plain map again.
  - **Edge case:** Sam drags the wrong vertex; one undo puts it back.

- **UJ-3. Jordan provisions a field from files.**
  - **Persona + context:** Jordan, an integrator, is bringing a 120-pad field onto the map from the engineering team's GIS export and a spreadsheet of meters.
  - **Entry state:** signed in on a laptop, Map Studio tools open on an empty map.
  - **Path:**
    1. Jordan downloads the CSV template for the meter kind and fills it from the spreadsheet.
    2. Jordan imports the GIS export (KML or GeoJSON) and the CSV; the features appear on the map as unlinked.
    3. Jordan matches each feature to an existing asset, most of them by name in one pass, the rest one by one.
    4. Jordan opens the pad kind's setup: comms, the pressure KPI and the alarms path as paths relative to each pad's base path, the popup's details and a link to `/pad/{asset.id}`.
    5. Jordan selects twenty pads on one route and changes a shared property at once.
  - **Climax:** every pad shows comms, pressure and its alarm count, from one kind setup.
  - **Resolution:** the field is saved; Jordan shares the page URL with the operators.
  - **Edge case:** some features have no matching asset; they stay on the map marked unlinked, and a count of unlinked items shows until they are matched or deleted.

- **UJ-4. Alex fixes a pin from the field.**
  - **Persona + context:** Alex, an operator standing at pad P12, sees on a phone that its pin sits 200 m off.
  - **Entry state:** signed in on a 390 px phone, on the map page.
  - **Path:**
    1. Alex taps P12, long-presses its pin and drags it; the pin is drawn above Alex's finger so it stays visible.
    2. An Undo bar appears after the drop.
    3. Alex opens P12's properties in a bottom sheet and corrects its access road note.
  - **Climax:** the pin sits on the pad in the satellite view.
  - **Resolution:** both edits are saved; everyone sees the corrected pin.
  - **Edge case:** Alex drops the pin in the wrong place; Undo puts it back.

- **UJ-5. Riley follows an alarm from the map.**
  - **Persona + context:** Riley, a viewer on the production team, watches the field map on a desktop.
  - **Entry state:** signed in, on the map page; no editing role, so no Map Studio tools.
  - **Path:**
    1. CTB1's icon shows a comms glyph in its normal state, an alarm glyph and a count of 2.
    2. Riley clicks CTB1: the popup shows its details, comms, its KPIs and the built-in alarm table filtered to CTB1.
    3. Riley acknowledges one alarm in the table and clicks "Open CTB1", which goes to `/ctb/CTB1`.
  - **Climax:** Riley is on CTB1's own page within two clicks of seeing the alarm.
  - **Resolution:** the map shows the new count when Riley comes back.
  - **Edge case:** CTB1's comms are lost; the icon and the popup say "Comms lost" in words, and its values show as stale, not as current.

## 3. Glossary

Every later section, and every document built from this PRD, uses these terms exactly.

**The product and its parts**

- **Map Studio** - the Perspective component module and its component, `ao.mapstudio`.
- **Map** - the one saved set of map items in a project. Every Map Studio component in the project shows the same map, so there is one map to maintain.
- **Starting area** - the part of the map a component opens on, passed to it as a parameter (for example one field). It sets the first view only; the user can pan anywhere.
- **Map Studio tools** - the editing mode of the component, shown only to users with an editing role. Without the tools, the component is the plain map.
- **Map store** - the database where Map Studio saves maps, map items and kind setups. The project names the database connection; Map Studio creates its own tables. The map store is the source of truth for a map.

**What is on a map**

- **Map item** - one thing on a map: a point (a pad, a station, a valve), a line (a pipeline, a route) or an area (a geofence, a region). Has a kind, a name, properties and a location, and may be linked to an asset.
- **Kind** - the type of a map item, such as well pad or compressor station. A kind sets the item's geometry (point, line or area), its icon and its form fields. The project supplies the list of kinds.
- **Kind setup** - the configuration shared by every map item of a kind: its comms path, KPIs, alarms path, popup contents and popup link, written relative to each item's base path.
- **Override** - a value set on one map item that replaces its kind setup for that item only.
- **Property** - a named value on a map item, entered in its form or imported.
- **Vertex** - a point on a line or an area. A **midpoint handle** sits between two vertices of the selected item and adds a vertex there.
- **Snapped end** and **floating end** - a line end attached to a map item or a vertex, and one that is not. They look different.

**Links to the project's data**

- **Asset** - a thing that already exists in the project, such as a pad's UDT instance. Map Studio does not create assets.
- **Asset list** - the assets the project offers for linking, supplied in the form the asset contract defines.
- **Asset contract** - what the project must supply for each asset (at least an id, a name, a kind and a base path) and how.
- **Linked** and **unlinked** - a map item is linked when it points to an asset, and unlinked otherwise. Unlinked items are allowed and counted.
- **Base path** - the tag path of an asset, from which the kind setup's relative paths are resolved.
- **Comms path** - the tag that gives a map item's communication state.
- **KPI** - a key value shown on a map item's icon or in its popup, read from a tag path. A kind setup has up to 4.
- **Alarms path** - the place in the tag hierarchy whose alarms belong to a map item. It drives the alarm count and the popup's alarm table.
- **Alarm count** - the number of active alarms under an alarms path, optionally shown on the icon.
- **Stale** - a value whose source has not updated in time, or whose comms are lost. Shown as stale, never as current.

**Viewing**

- **Icon** - how a point map item is drawn: its kind's glyph, with comms state, one KPI and the alarm count where configured.
- **Popup** - the panel that opens when a map item is clicked or tapped: details, comms, KPIs, the alarm table and the popup link, each optional.
- **Alarm table** - the built-in Perspective Alarm Status Table embedded in a popup, filtered to the item's alarms path. Acknowledging follows Ignition's own permissions.
- **Popup link** - an optional button in a popup that goes to a project page or a URL. It may contain placeholders.
- **Placeholder** - a name in braces in a popup link, filled from the clicked map item, for example `{asset.id}` or `{name}`.
- **Basemap** - the map imagery under the map items: none, OpenStreetMap, satellite or Mapbox.
- **Reference layer** - an imported KML or GeoJSON file shown under the map items for comparison, not edited.

**Editing**

- **Import** - bringing map items in from a CSV, KML or GeoJSON file, then matching them to assets.
- **CSV template** - the empty CSV for a kind, with the columns its import needs, that Map Studio lets the user download.
- **Bulk edit** - changing a property on several selected map items at once. Geometry is not bulk edited.
- **Place check** - the country, province or state and city shown for typed coordinates, looked up offline.

**Roles** (from 2.1): map editor, integrator, operator, viewer.

## 4. Features

### 4.1 Map view and icons

**Description:** Every user sees the map: map items on a basemap, opening on the component's starting area. Point map items are drawn as icons that carry their kind's glyph, comms state, one KPI and the alarm count, each where the kind setup configures it. Normal items are neutral; state reads in words and glyphs, never colour alone. Realizes UJ-2, UJ-3, UJ-5.

#### FR-1: Show the map

A Map Studio component shows the project's map, opening on the starting area it is given. Realizes UJ-5.

**Consequences (testable):**
- Two components on different pages, given different starting areas, show the same map items, each opening on its own area.
- A component with no starting area opens fitted to all map items; on an empty map it opens on a default view.
- Users can pan and zoom past the starting area.

#### FR-2: Draw icons with state

Each point map item is drawn as an icon showing its kind's glyph, its comms state from the comms path, one KPI and its alarm count, each only where configured. Realizes UJ-5.

**Consequences (testable):**
- An item with comms lost shows a comms-lost glyph and the words "Comms lost" on hover or in its label; its KPI shows as stale.
- An item with active alarms under its alarms path shows an alarm glyph and, where enabled, the count; the glyph and count follow Ignition's alarm state, not limits set in Map Studio.
- An item in its normal state is neutral grey; colour appears only for an abnormal state.
- Lines and areas show their kind's style; a selected map item shows a ring and its name.

#### FR-3: Labels that thin out

Map item names show as labels that give way to each other as the user zooms out, more important kinds winning. Realizes UJ-5.

**Consequences (testable):**
- At the starting area's zoom no two labels overlap.
- The project can set, per kind, the zoom below which its labels and icons are hidden.

**Feature-specific NFRs:**
- State and selection meet 3:1 contrast against the basemap in both the light and the dark theme (WCAG 1.4.11).
- Colours come only from the host project's theme tokens.

### 4.2 Popups

**Description:** Clicking or tapping a map item opens its popup: details, comms, KPIs, the alarm table and the popup link, each optional and set in the kind setup. Realizes UJ-5.

#### FR-4: Open a popup

A user opens a map item's popup by clicking or tapping it; it shows the parts its kind setup enables, with live values. Realizes UJ-5.

**Consequences (testable):**
- A kind setup with no popup parts enabled opens no popup.
- Values update live while the popup is open; stale values are marked stale.
- On a 390 px phone the popup opens as a bottom sheet with a visible close button.

#### FR-5: Alarm table in the popup

Where enabled, the popup embeds the alarm table filtered to the map item's alarms path. Realizes UJ-5.

**Consequences (testable):**
- The table lists only alarms under the item's alarms path.
- Acknowledging works as in the alarm table anywhere in the project and follows Ignition's acknowledge permissions; Map Studio adds no rules.

#### FR-6: Popup link

Where configured, the popup shows a button that goes to a project page or a URL, with placeholders filled from the clicked map item. Realizes UJ-5.

**Consequences (testable):**
- A link `/ctb/{asset.id}` on CTB1 goes to the project page `/ctb/CTB1`.
- A placeholder with no value (for example `{asset.id}` on an unlinked item) hides the button rather than going to a broken page.
- An outside URL opens as Perspective opens outside URLs.

**Notes:** icons and popups that show state are alarm presentation: the template's engineering review (ER-27, `docs/ux.md` section 11) applies before release.

### 4.3 Roles and the Map Studio tools

**Description:** Users with an editing role see the Map Studio tools on the same component; everyone else sees the plain map. Realizes UJ-1 to UJ-4.

#### FR-7: Show the tools by role

The Map Studio tools appear only for users whose roles the project names as editing roles, and every save checks the role on the Gateway. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- A viewer sees no tools and no editing affordance; a map editor sees them.
- A save attempted without an editing role is refused on the Gateway and nothing is written, whatever the page shows.
- The project names separate roles for full editing and for phone editing (move a point, edit properties). [ASSUMPTION: operators get the phone edits through their own role, without full editing]

#### FR-8: One clear mode

The tools show the current mode in words and a glyph, and Esc returns to Select. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- At any moment exactly one mode is active and named on screen.
- Esc from any drawing mode cancels the unfinished item and returns to Select.

### 4.4 Kinds, kind setup and data links

**Description:** The project supplies its kinds and its asset list. A map editor links map items to assets and writes each kind setup once; items inherit it, with overrides where needed. Realizes UJ-2, UJ-3.

#### FR-9: Kinds from the project

The project supplies the list of kinds, each with its geometry, icon and form fields; a new kind needs no change to Map Studio. Realizes UJ-1, UJ-3.

**Consequences (testable):**
- Adding a kind to the project's list makes it available in the tools without rebuilding the module.
- Map Studio ships a core icon set for the oil and gas kinds; a kind may name any icon from it.

#### FR-10: Asset list through the asset contract

The project supplies its asset list in the form the asset contract defines (at least an id, a name, a kind and a base path). Realizes UJ-1, UJ-3.

**Consequences (testable):**
- The asset contract is documented, with an example list.
- The tools show where the asset list comes from and say clearly when it is empty or missing a required field.

#### FR-11: Link a map item to an asset

A map editor links a map item to an asset from the asset list, and can unlink it. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- A linked item takes its base path from its asset, and its icon and popup work at once from its kind setup.
- Unlinked items are allowed; the tools show how many there are and can list them.
- Two items may share a name when they link to different assets; the name shows a red underline and a tooltip saying it is already in use.

#### FR-12: Write a kind setup

A map editor writes a kind's setup once: comms path, up to 4 KPIs, alarms path, popup parts and popup link, as paths relative to each item's base path. Realizes UJ-3.

**Consequences (testable):**
- Changing a kind setup changes every item of that kind that has no override.
- A tag browser lets the editor pick a tag instead of typing a path.
- A path that does not resolve for an item is reported for that item, not silently left blank.

#### FR-13: Override per item

A map editor overrides any part of the kind setup on one map item. Realizes UJ-3.

**Consequences (testable):**
- An overridden value is marked as an override and can be reset to the kind setup.

### 4.5 Drawing and editing

**Description:** Map editors draw and change points, lines and areas on the map itself, with snapping and undo. Realizes UJ-1, UJ-2.

#### FR-14: Add a map item

A map editor adds a point, a line or an area of a chosen kind, in any order. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- A line or area finishes by double-click, Enter or a Finish button; Backspace removes the last vertex while drawing.
- A point, line or area can be added entirely by taps or typed values, without dragging (WCAG 2.5.7).

#### FR-15: Change geometry

A map editor moves a point, drags a vertex, inserts a vertex with a midpoint handle and deletes a vertex. Realizes UJ-2.

**Consequences (testable):**
- Every drag has a non-drag alternative: Move then tap the destination, or typed coordinates.
- A line can be split at a point into two lines that keep the original's kind and properties.

#### FR-16: Snapping

Line ends and vertices snap to nearby map items and vertices while drawing, with a visible snap indicator and a snap toggle. Realizes UJ-1.

**Consequences (testable):**
- A snapped end and a floating end look different on the map.
- With snapping off, nothing snaps.

#### FR-17: Delete and undo

A map editor deletes map items and undoes or redoes any edit: adds, geometry changes, deletes and property changes. Realizes UJ-2, UJ-4.

**Consequences (testable):**
- Delete asks for no confirmation; one undo restores the item with its link and properties.
- Undo and redo work by buttons and by Ctrl+Z and Ctrl+Shift+Z.

#### FR-18: Fast entry

A map editor duplicates a map item or adds another like the last, which copies the kind and properties but not the asset link. Realizes UJ-2.

**Consequences (testable):**
- "Add another like the last" opens the form prefilled and waits only for the location and the link.
- A `?` key or button shows the keyboard shortcuts.

#### FR-19: Validation while drawing

The tools check an item while it is drawn and say what is wrong in plain words beside it. Realizes UJ-1.

**Consequences (testable):**
- A self-intersecting area and a line with fewer than two vertices are flagged before they are finished.

### 4.6 Item forms and location entry

**Description:** Adding or editing a map item opens a form with its kind's fields, its asset link and its location. Realizes UJ-1, UJ-4.

#### FR-20: Item form

The form shows the kind's fields, the asset picker and the location, marks required fields, and remembers the last entry per kind. Realizes UJ-1.

**Consequences (testable):**
- Required fields are marked and the form says which are missing.

#### FR-21: Location by typing or picking

The location is set by typing latitude and longitude or by picking the point on the map. Realizes UJ-1.

**Consequences (testable):**
- Typed coordinates show a place check (country, province or state, and city) at once, looked up without any online service.
- Coordinates entered the wrong way round, or outside the valid range, are flagged.
- "Zoom to location" moves the map to the typed point.

### 4.7 Import and bulk edit

**Description:** Integrators bring map items in from files, match them to assets and change many at once. Realizes UJ-3.

#### FR-22: CSV template

A user downloads the CSV template for a kind, with the columns its import needs. Realizes UJ-3.

**Consequences (testable):**
- A template filled correctly imports with no errors.

#### FR-23: Import files

A map editor imports map items from CSV, KML or GeoJSON; they appear on the map, unlinked, before anything is saved. Realizes UJ-3.

**Consequences (testable):**
- The import shows how many items it found and lists rows it could not read, with the reason.
- The user can cancel an import with nothing changed.

#### FR-24: Match imported items to assets

After an import, Map Studio links items to assets with the same name and lets the user match the rest by hand. Realizes UJ-3.

**Consequences (testable):**
- The match shows how many items it linked and how many remain unlinked.

#### FR-25: Bulk edit

A map editor selects several map items (by click, add to selection or a rectangle) and changes a shared property at once. Realizes UJ-3.

**Consequences (testable):**
- The form shows "N selected" and marks fields whose values differ.
- Geometry is not bulk edited.

#### FR-26: Reference layer

A map editor shows an imported KML or GeoJSON file as a reference layer under the map items, for comparison only. Realizes UJ-1.

**Consequences (testable):**
- A reference layer can be shown, hidden and removed, and is never edited or saved as map items.

### 4.8 Phone

**Description:** On a phone, operators move a point and edit a map item's properties; nobody draws. Realizes UJ-4.

#### FR-27: Move a point on a phone

On a 390 px phone with touch only, a user with phone editing moves a point by long-press and drag. Realizes UJ-4.

**Consequences (testable):**
- The point is drawn above the finger while dragging, so it stays visible.
- An Undo bar appears after the drop.
- Every touch target is at least 44 px.

#### FR-28: Edit properties on a phone

On a phone, a user with phone editing edits a map item's properties in a bottom sheet. Realizes UJ-4.

**Consequences (testable):**
- Drawing tools are not offered below a set screen width.

### 4.9 Saving

**Description:** Map Studio saves the map to the map store as the user works; nothing is lost when a user leaves halfway. Realizes UJ-1, UJ-2.

#### FR-29: Save as you work

Every finished edit is saved to the map store without a save button. Realizes UJ-1.

**Consequences (testable):**
- Closing the browser after an edit and opening the map on another computer shows the edit.
- An edit that fails to save is shown as unsaved, with the reason, and is kept in the browser until it saves or the user discards it.
- Other open components show a saved edit without a page reload. [ASSUMPTION: within a few seconds]

#### FR-30: Map store

The project names a database connection; Map Studio creates and upgrades its own tables there. Realizes UJ-1.

**Consequences (testable):**
- A new project with an empty database connection works without hand-written SQL.
- Each saved edit records who made it and when.

#### FR-31: Two editors at once

Two map editors working on the map at the same time never overwrite each other silently. Realizes UJ-2.

**Consequences (testable):**
- When both change the same map item, the second save is refused with a message, and the user sees the other's change.

### 4.10 Basemaps

**Description:** The map sits on a basemap the project chooses per Gateway. Realizes UJ-1, UJ-4.

#### FR-32: Basemaps

The project offers none, OpenStreetMap, satellite and Mapbox basemaps; the user switches between those offered. Realizes UJ-1.

**Consequences (testable):**
- With no basemap, the map items still draw on a blank background, for sites without internet.
- A basemap that needs a token reads it from the project's secret store, never from a view or a file in git.
