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
- **Map** - one saved set of map items with its basemap and view settings, shown by one Map Studio component. [ASSUMPTION: a project can hold several maps, for example one per field; a component shows one map at a time]
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
