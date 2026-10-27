---
title: Map Studio for Ignition Perspective - PRD
status: final
created: 2026-10-25
updated: 2026-10-27
---

# PRD: Map Studio for Ignition Perspective

## 0. Document purpose

This PRD defines the first version of Map Studio for its owner and for the downstream BMAD steps: the initiative requirements (Sofia), the UX specification, the architecture and the epics. It builds on the final product brief (`../brief-flowmap/brief-flowmap.md`) and its addendum, and on the source idea (`docs/idea.md`), and does not repeat them. Section 3's Glossary sets the vocabulary every later section and document uses exactly. Features in section 4 nest numbered requirements (FR-n) that cite the journeys of section 2.3 (UJ-n); assumptions are tagged inline and indexed in section 10; claims about Perspective or the module SDK are tagged `[UNVERIFIED]` until checked on a live Gateway. Technical choices and reference material are in `addendum.md` beside this file. A two-day spike (6.4) gates the whole plan: a no-go replaces this scope with a better page on the built-in Map.

## 1. Vision

Map Studio is the map of an Ignition 8.3 Perspective project: one component everyone opens. Viewers and operators see their sites and assets on a map, each icon showing its comms state and one key value, and a click opens a popup with the critical information (metadata, comms, a few key values) and, where configured, a link to the asset's own page.

Map editors (admins and integrators) see the same map plus the Map Studio tools. With them they build the map for a new field, map a field that runs in Ignition but has no map yet, and keep an existing map right: add and change map items, draw lines and areas, import files, link each map item to an asset in the project and choose which tags feed its icon and popup. Map Studio saves the map as they work to the map store, a database the project names, which is the map's source of truth.

Linking the map to the project's data is the main benefit: a map that is quick to build and stays connected to live values. It looks modern, minimal and clean, in one minimalist icon style, where the map it replaces looked cobbled together.

**What live editing gives up.** There is no draft to review before others see a change, no Publish step, no approval and no rollback to an earlier map (no Publish step confirmed in the UX workshop, ux-map-studio, 2026-10-27). Undo (FR-17), Recent changes with Revert per change (FR-44), the record of who changed what (FR-30) and export (FR-35) are the safety net.

## 2. Target User

### 2.1 Roles

- **Map editor** - an admin or an integrator. Builds a map for a new field, builds a map for an existing field that has no map yet, and changes an existing map. An integrator who supports a project is a map editor too.
- **Integrator** - a map editor who usually provisions by import. Every map editor can import, so the two roles share one set of rights; "integrator" names the job, not a separate permission.
- **Operator** - on a phone in the field: moves a point and edits a map item's properties. Draws nothing.
- **Viewer** - anyone without an editing role: sees the map, icons and popups, and follows a popup's link.

### 2.2 Key User Journeys

Terms such as map item, kind setup and linked are defined in section 3.

- **UJ-1. Sam lays out a field that has no map.**
  - **Persona + context:** Sam is a map editor bringing a field onto the map: a new field, or an existing one that runs in Ignition but has no map. Before starting, Sam has researched every map item to bring online, with its properties and its latitude and longitude, often already in a spreadsheet laid out like the import template.
  - **Entry state:** signed in on a laptop, on the map page, which is empty or nearly empty; Sam turns on the Edit switch (FR-43) and an empty map shows the first-run checklist (FR-36).
  - **Path:**
    1. Sam picks what to add, in any order, from a kind button or the generic point, line and area tools (FR-14): a pipeline, a pad, a compressor station.
    2. A form asks for the name and properties of that kind of map item, and links it to an existing asset in the project.
    3. Sam sets its location by clicking the map and dragging the pin to fine-tune, or, as the backup, by typing latitude and longitude (FR-21). Typed coordinates show their country, province or state, and city, so Sam sees at once whether they are roughly right; "Zoom to location" shows the spot on the map.
    4. Sam checks the layout against satellite imagery (reference layers are deferred, FR-26).
    5. Sam repeats until the field is laid out, or imports a file instead (UJ-3).
  - **Climax:** the field is on the map and every item is linked to its asset. Others check it against satellite imagery, even while Sam is still working.
  - **Resolution:** nothing to submit: the map is saved as Sam works. Sam shares it by adding the page to the project's navigation or sending its URL.
  - **Edge cases:**
    - A pipeline that did not snap to its pad is allowed and shows as floating (FR-16).
    - A name already in use is allowed for a different asset and is flagged (FR-11).
    - Sam leaves halfway through a large layout and carries on later from any computer, with nothing lost (FR-29).

- **UJ-2. Sam keeps a running field's map right.**
  - **Persona + context:** Sam, a map editor, learns that a lateral was rerouted, a new pad P31 came online and the lease needs a geofence.
  - **Entry state:** signed in on a laptop, on the map page with the live field showing; Sam turns on the Edit switch (FR-43) and the item list opens, grouped by place (FR-45).
  - **Path:**
    1. Sam selects the lateral, drags two vertices to the new route and inserts a third on the line.
    2. Sam adds P31 with "Add another like the last" from a neighbouring pad, sets its location and links it to the P31 asset; its base path comes from the asset, so its icon and popup work at once from the pad kind's setup.
    3. Sam draws the lease geofence vertex by vertex and finishes it with a double-click.
  - **Climax:** P31's icon shows its comms status and pressure as soon as it is linked; viewers see the new route and the geofence without a release step.
  - **Resolution:** the changes are saved; Sam turns the Edit switch off and the page is the plain map again.
  - **Edge case:** Sam drags the wrong vertex; one undo puts it back.

- **UJ-3. Jordan provisions a field from files.**
  - **Persona + context:** Jordan, an integrator, is bringing a 120-pad field onto the map from the engineering team's GIS export and a spreadsheet of meters.
  - **Entry state:** signed in on a laptop, Map Studio opened straight into Edit mode (FR-43) on an empty map.
  - **Path:**
    1. Jordan downloads the CSV template for the meter kind and fills it from the spreadsheet.
    2. Jordan imports the GIS export (KML or GeoJSON) and the CSV through the guided import (FR-23): a preview on the map and in a table, columns mapped to fields.
    3. Jordan matches each feature to an existing asset: confident matches by name are ticked in one pass, doubtful ones are flagged and fixed one by one (FR-24); a summary of new, updated and skipped comes before Import.
    4. Jordan opens the pad kind's setup on the Kinds screen: comms, the pressure KPI and the alarms path picked with the tag browser on an example pad, as paths relative to each pad's base path, the popup's details and a link to `/pad/{asset.id}` (FR-12).
    5. Jordan box-selects twenty pads on one route and changes a shared property at once; a field whose values differ shows Mixed (FR-25).
  - **Climax:** every pad shows comms, pressure and its alarm count, from one kind setup.
  - **Resolution:** the field is saved; Jordan shares the page URL with the operators.
  - **Edge case:** some features have no matching asset; they stay on the map marked unlinked, and a count of unlinked map items shows until they are matched or deleted. The whole import undoes as one step.

- **UJ-4. Alex fixes a pin from the field.**
  - **Persona + context:** Alex, an operator standing at pad P12, sees on a phone that its pin sits 200 m off.
  - **Entry state:** signed in on a 390 px phone, on the map page.
  - **Path:**
    1. Alex taps P12; its popup opens as a bottom sheet with an Edit button (FR-28).
    2. Alex taps Edit, then Move: the map moves under a fixed centre crosshair; Alex pans until the crosshair sits on the pad and taps Done (FR-27).
    3. An Undo bar appears after Done.
    4. In the same bottom sheet Alex corrects P12's access road note.
  - **Climax:** the pin sits on the pad in the satellite view.
  - **Resolution:** both edits are saved; everyone sees the corrected pin.
  - **Edge case:** Alex sets the pin in the wrong place; Undo puts it back. Cancel during Move leaves the pin where it was.

- **UJ-5. Riley follows an alarm from the map.**
  - **Persona + context:** Riley, a viewer on the production team, watches the field map on a desktop.
  - **Entry state:** signed in, on the map page; no editing role, so no Map Studio tools.
  - **Path:**
    1. The Needs you summary reads "Needs you 1: 1 alarm" (FR-42); CTB1's icon shows a normal comms glyph, an alarm glyph and a count of 2.
    2. Riley clicks CTB1: the popup shows comms with its data age, two KPIs and an alarm summary (2 active, the highest in words) (FR-4).
    3. Riley clicks "View alarms" and lands on the project's alarm page filtered to CTB1, acknowledges one alarm there, and then opens CTB1's own page at `/ctb/CTB1` with the page icon in the popup header (FR-6).
  - **Climax:** Riley sees CTB1's alarms in the alarm table, or CTB1's own page through the popup link, within two clicks of seeing the alarm (acknowledging is optional and not counted).
  - **Resolution:** the map shows the new count when Riley comes back.
  - **Edge case:** CTB1's comms are lost; the icon and the popup say "Comms lost" in words, and its values show as stale, not as current.

## 3. Glossary

Every later section, and every document built from this PRD, uses these terms exactly.

**The product and its parts**

- **Map Studio** - the Perspective component module and its component, `ao.mapstudio`.
- **Map** - the one saved set of map items in a project. Every Map Studio component in the project shows the same map, so there is one map to maintain.
- **Starting area** - the part of the map a component opens on, passed to it as a parameter (for example one field). It sets the first view only; the user can pan anywhere.
- **Map Studio tools** - the editing mode of the component, shown only to users with an editing role. Without the tools, the component is the plain map.
- **View mode** and **Edit mode** - (FR-43) the component's two modes: View mode is the plain map everyone sees; Edit mode shows the Map Studio tools. A map editor switches with the Edit switch on the map, or the project opens the component straight into Edit mode.
- **Map store** - the database where Map Studio saves maps, map items and kind setups. The project names the database connection; Map Studio creates its own tables. The map store is the source of truth for a map.

**What is on a map**

- **Map item** - one thing on a map: a point (a pad, a station, a valve), a line (a pipeline, a route) or an area (a geofence, a region). Has a kind, a name, properties and a location, and may be linked to an asset.
- **Kind** - the type of a map item, such as well pad or compressor station. A kind sets the item's geometry (point, line or area), its icon and its form fields. The project supplies the list of kinds.
- **Kind setup** - the configuration shared by every map item of a kind: its comms path, KPIs, alarms path, popup contents, popup link and optional custom popup view, written relative to each item's base path.
- **Override** - a value set on one map item that replaces its kind setup for that item only.
- **Style rule** - (FR-38) an optional part of a kind setup that binds a map item's look to one value, through a value source, a rule type (States or Bands, or an expression) and a style preset for each state or band.
- **Style preset** - (FR-38) one look from Map Studio's fixed list (normal, attention, warning, fault, dimmed or out of service; for lines also solid, dashed, dotted and weight by pipe size), each a theme token plus its glyph or word where it shows abnormal state.
- **Area category** - (FR-39) a category of an area (for example operator area or field) that tints it from a small fixed palette of low-saturation theme tokens.
- **Property** - a named value on a map item, entered in its form or imported.
- **Vertex** - a point on a line or an area. A **midpoint handle** sits between two vertices of the selected item and adds a vertex there.
- **Snapped end** and **floating end** - a line end attached to a map item or a vertex, and one that is not. They look different.
- **Instrument** - (FR-40) a point map item that sits on a line: a tap (a pressure transmitter such as the template's Rangers), a meter (flow) or a line valve. The kind list marks its kind as an instrument kind; it has its own kind setup (comms, KPIs, alarms path) like any point, and stays on its line when the line is moved or reshaped.
- **Distance along line** - (FR-40) where an instrument sits on its line, in metres from the line's start, stored with the instrument together with which line it sits on.
- **Line segment** - (FR-40) the part of a line between two neighbours in order along it (the line's start, its instruments by distance along line, the line's end), for example "PT-1 to PT-2". Drawn and clicked separately; worked out from the stored instruments, never stored itself.

**Links to the project's data**

- **Asset** - a thing that already exists in the project, such as a pad's UDT instance. Map Studio does not create assets.
- **Asset list** - the assets the project offers for linking, supplied in the form the asset contract defines.
- **Asset contract** - what the project must supply for each asset (at least an id, a name, a kind and a base path) and how.
- **Linked** and **unlinked** - a map item is linked when it points to an asset, and unlinked otherwise. Unlinked items are allowed and counted.
- **Base path** - the tag path of an asset, from which the kind setup's relative paths are resolved.
- **Comms path** - the tag whose value is a map item's communication state. The project decides how that tag is computed (in the template, from each source's `Heartbeat`).
- **KPI** - a key value shown in a map item's popup, read from a tag path. A kind setup has up to 4; one of them may be marked as the **icon KPI**, shown on the icon.
- **Alarms path** - the place in the tag hierarchy whose alarms belong to a map item. It drives the alarm count and the popup's alarm summary.
- **Alarm count** - the number of active alarms under an alarms path, optionally shown on the icon.
- **Live value** - any value Map Studio reads from a tag: comms state, a KPI, an alarm count. Each is optional in the kind setup.
- **Stale** - a value whose tag quality is not good, or any value of a map item whose comms are lost. Shown as stale, never as current.

**Viewing**

- **Icon** - how a point map item is drawn: its kind's glyph, with comms state, the icon KPI and the alarm state where configured.
- **Popup** - the panel that opens when a map item is clicked or tapped. By default Map Studio draws it: details, comms, KPIs, the alarm summary and the popup link, each optional.
- **Custom popup view** - a project's own Perspective view that a kind setup names to open instead of the default popup, given the map item object as its parameter.
- **Map item object** - the documented data a custom popup view receives: the map item's id, name, kind, properties, asset id, base path and live values with their quality.
- **Alarm summary** - the alarm part of the default popup: active counts by priority and the most important active alarms in words, with a "View alarms" button.
- **Alarm table** - the built-in Perspective Alarm Status Table, on the project's alarm page or inside a custom popup view; the authoritative place to acknowledge.
- **Popup link** - an optional link in a popup, shown as an open or pop-out icon in its header (FR-6), that goes to a project page or a URL. It may contain placeholders.
- **Placeholder** - a name in braces in a popup link, filled from the clicked map item, for example `{asset.id}` or `{name}`.
- **Basemap** - the map imagery under the map items: none, OpenStreetMap or satellite in the first version; a Mapbox vector style is deferred (FR-32).
- **Reference layer** - an imported KML or GeoJSON file shown under the map items for comparison, not edited. Deferred (FR-26).
- **Needs you** - (FR-42) the View mode summary of map items in alarm, with comms lost or stale, with a count per state, opening a ranked list.
- **Legend** - (FR-41) the key to the map's glyphs and line looks, collapsed to a button until opened.

**Editing**

- **Import** - bringing map items in from a CSV, KML or GeoJSON file, then matching them to assets.
- **CSV template** - the empty CSV for a kind, with the columns its import needs, that Map Studio lets the user download.
- **Bulk edit** - changing a property on several selected map items at once. Geometry is not bulk edited.
- **Mixed** - (FR-25) what the bulk edit form shows for a field whose values differ across the selected map items.
- **Recent changes** - (FR-44) the list of recent saved edits from the edit record (FR-30), each with who, what, when and a Revert.
- **Item list** - (FR-45) the Edit mode list of map items, grouped by place.
- **Place check** - the country, province or state and city shown for typed coordinates.

**Roles** (from 2.1): map editor, integrator, operator, viewer.

## 4. Features

### 4.1 Map view and icons

**Description:** Every user sees the map, its icons and their state, and can search it.

**Engineering review:** icons, lines and popups that show state are alarm presentation. The template's engineering review (ER-27, `docs/ux.md` section 11) applies to FR-2, FR-4 to FR-6, FR-34 and FR-37 before release, to the style presets of FR-38 and the area tints of FR-39, to instrument alarms and the instrument-based line style of FR-40, to the Needs you counts of FR-42 and the legend's glyph key of FR-41, and to the phone's bottom sheets for popups and properties (FR-4, FR-28), a deliberate change from the template's chip row and top sheets (UX workshop, ux-map-studio, 2026-10-27).

#### FR-1: Show the map

A Map Studio component shows the project's map, opening on the starting area it is given. Realizes UJ-5.

**Consequences (testable):**
- Two components on different pages, given different starting areas, show the same map items, each opening on its own area.
- A component with no starting area opens fitted to all map items; on an empty map it opens on a default view.
- Users can pan and zoom past the starting area.

#### FR-2: Draw icons with state

Each point map item is drawn as an icon showing its kind's glyph, its comms state from the comms path, the icon KPI and its alarm state, each only where the kind setup turns it on. Realizes UJ-5.

**Consequences (testable):**
- A map item with comms lost shows a comms-lost glyph and the words "Comms lost" on hover or in its label; its KPI shows as stale.
- A map item with active alarms under its alarms path shows the alarm glyph of its highest priority, solid while unacknowledged and hollow once acknowledged, with the priority digit as a label and, where enabled, the count; all of it follows Ignition's alarm state, not limits set in Map Studio.
- A map item in its normal state is neutral grey; colour appears only for an abnormal state.
- A kind setup with every live value turned off draws a plain icon and reads no tags.
- Lines and areas show their kind's style; a selected map item shows a ring and its name.

#### FR-3: Labels that thin out

Map item names show as labels that give way to each other as the user zooms out; the kind list ranks kinds, and higher-ranked kinds keep their labels. Realizes UJ-5.

**Consequences (testable):**
- At the starting area's zoom, no two labels overlap.
- The project can set, per kind, the zoom below which its labels and icons are hidden.

#### FR-33: Search and zoom

Every user can search map items by name or asset; choosing a result zooms the map to it and selects it. Realizes UJ-5.

**Consequences (testable):**
- Typing part of a name lists matching map items with their kind, as the user types.
- Choosing a result zooms to the map item, selects it and shows its ring; a line or an area is fitted to the view.
- Search works on a 390 px phone and by keyboard alone.

#### FR-34: Match today's map

Map Studio shows everything the template's current map shows, as approved in its engineering review (ER-27), so SM-1 can retire the current map. Realizes UJ-5.

**Consequences (testable):**
- Lines carry state: weight by pipe size, the hue of the highest alarm on the line's alarms path, dashed for no data or comms lost, and the alarm glyph with its digit at the line's midpoint, so a line's alarm never reads by colour alone. An instrument's alarm shows at that instrument's place on the line (FR-40).
- The flow direction shows as an arrow on the selected line only.
- Map items within 20 m of each other draw as one shared marker; a tap lists them to pick from.
- Controls offer Fit to the starting area and Return to the selection, and toggles hide lines and names.
- The template's `docs/map.md` section 5 is the checklist; each entry there is met or listed as a deliberate change for engineering review.

#### FR-38: Value-driven styles

Approved by the owner 2026-10-26. It extends FR-2 and FR-34 and keeps their rule: normal is neutral, hue only for abnormal state, always with a word or glyph (NFR-4, NFR-11, SM-C2).

A kind setup may bind a map item's look to one value through a style rule: the integrator picks the value (a tag relative to the item's base path, or one of the kind setup's KPIs), picks a rule type, and maps each state or band to a style preset. Realizes UJ-3, UJ-5.

**Consequences (testable):**
- Rule type States maps named or enumerated values (for example running, shut-in, testing, bypassed) to presets; rule type Bands maps numeric thresholds (for example pressure normal, above high, above high-high) to presets.
- The presets are a short fixed list: normal (neutral); attention, warning and fault, each a theme token plus its glyph or word, never colour alone; dimmed or out of service; and for lines solid, dashed or dotted, and line weight by pipe size. No colour code can be entered anywhere.
- The kind setup shows a live preview of every state or band in its preset before the rule is saved.
- A map item may override its kind's style rule, marked and resettable as in FR-13.
- An advanced option is an expression that returns one preset name; a result that is not a preset name draws normal and is reported for that map item. [UNVERIFIED: the expression language and where it is evaluated, to check on a live 8.3 Gateway]
- Alarm state wins: a map item with an active alarm shows its alarm presentation (FR-2, FR-34), not its value style.
- A stale value shows only as stale: the map item drops its last value style until a fresh value arrives (owner, 2026-10-26).
- The style rule's value is a live value: read in the icon batch (NFR-9), and not read when the item has no style rule.
- A line's style rule may take as its value an aggregate of its instruments (FR-40), drawn per line segment as the "worst of the instruments at the segment's ends": for example a segment is dashed when either end instrument is stale, attention when either end instrument's value is outside its band (owner, 2026-10-27).
- Every preset is documented with its look in both themes, so every possible look is reviewable; the presets pass the same engineering review as the alarm glyphs (ER-27) before release.

#### FR-39: Area category tints

Approved by the owner 2026-10-26. An area (a region, a geofence, a site footprint) may be tinted by a category (for example operator area or field) from a small fixed palette of low-saturation tints defined as theme tokens, so a tint never reads as an alarm hue. Realizes UJ-1, UJ-5.

**Consequences (testable):**
- The palette is a short fixed list of theme tokens, low saturation in both themes and distinct from every alarm hue and style preset; no colour code can be entered.
- Points and lines never take a category tint.
- An area's alarm presentation and value style (FR-38) draw over its tint.
- The tints pass the engineering review (ER-27) with the style presets before release.

#### FR-41: Legend

Added from the UX workshop (ux-map-studio, 2026-10-27); no FR named a legend before. View mode offers a legend of the map's glyphs and line looks, collapsed to a button and opened on request. Realizes UJ-5.

**Consequences (testable):**
- On load the legend is a button only; one click or tap opens it and one closes it, by keyboard as well.
- The legend names every glyph and line look the map can draw (kind glyphs in use, comms lost, stale, each alarm priority and acknowledgement state, the style presets in use) in the same words the map and popups use.
- The legend holds the toggles that hide lines and names (FR-34).
- At 390 px the legend button keeps clear of the bottom-right corner, which the Perspective App Bar toggle uses.

#### FR-42: Needs you summary

Added from the UX workshop (ux-map-studio, 2026-10-27). View mode shows a Needs you summary: how many map items are in alarm, have comms lost or are stale, which opens a ranked list of them. Realizes UJ-5.

**Consequences (testable):**
- The summary shows a count per state, each with its glyph and word (for example "Needs you 3: 1 alarm, 1 comms lost, 1 stale"), updated with the icon batch (NFR-9).
- Clicking or tapping it opens a list ranked alarms first by priority, then comms lost, then stale; choosing a row zooms to the map item and selects it.
- With nothing to attend to it shows "All OK" in neutral, with no hue, and is not hidden.
- At 390 px the Needs you summary and search share one top bar that expands on tap.
- The counts pass the engineering review (ER-27) with the icons.

### 4.2 Popups

**Description:** A click or tap on a map item opens its popup, with the parts its kind setup turns on.

#### FR-4: Open a popup

A user opens a map item's popup by clicking or tapping it; the popup shows the parts its kind setup enables, with live values updating while it is open. Realizes UJ-5.

**Consequences (testable):**
- A kind setup with no popup parts enabled opens no popup.
- Values update live while the popup is open; stale values are marked stale.
- On a 390 px phone the popup opens as a bottom sheet with a visible close button.
- The default popup shows its parts in this order (UX workshop, ux-map-studio, 2026-10-27): a header with the kind glyph, the name and the page link icon (FR-6); comms with the data age; the KPIs the kind setup turns on for the popup (2 to 3 in the UX design, of FR-12's up to 4); the alarm summary (FR-5).
- A line's popup lists its instruments in order along the line, each with its live values, and opens at the line segment that was clicked (FR-40).

#### FR-37: Custom popup view

A kind setup may name a project view to open instead of the default popup, as a table's row subview does; the view receives the map item object as its parameter. Realizes UJ-5. [UNVERIFIED: Perspective or SDK behaviour, to check on a live 8.3 Gateway]

**Consequences (testable):**
- A kind setup with a custom popup view opens that view, with the map item object filled, instead of the default popup.
- The map item object's fields are documented, with an example view that embeds the alarm table filtered to the alarms path; acknowledging there follows Ignition's acknowledge permissions.
- A custom popup view that is missing or fails to load falls back to the default popup with a message.

#### FR-5: Alarm summary in the popup

Where enabled, the default popup shows the alarm summary for the map item's alarms path, with a "View alarms" button to the project's alarm page, which the project setup names and which may take placeholders. Acknowledging happens in the alarm table, never in Map Studio's own popup. Realizes UJ-5.

**Consequences (testable):**
- The summary counts only alarms under the map item's alarms path and names the most important active ones in words.
- "View alarms" goes to the configured alarm page, filled from the map item (for example `/alarms?source={asset.id}`); with no page configured, the button is hidden.
- Map Studio acknowledges nothing itself.
- On a line's popup the summary covers the line's own alarms path; each instrument's alarm state shows on its row in the line's instrument list (FR-40).

#### FR-6: Popup link

Where configured, the popup shows a link that goes to a project page or a URL, with placeholders filled from the clicked map item, using Perspective's navigation. The link is an open or pop-out icon in the popup header, not a button in its body (UX workshop, ux-map-studio, 2026-10-27). Realizes UJ-5. [UNVERIFIED: Perspective or SDK behaviour, to check on a live 8.3 Gateway]

**Consequences (testable):**
- A link `/ctb/{asset.id}` on CTB1 goes to the project page `/ctb/CTB1`.
- A placeholder with no value (for example `{asset.id}` on an unlinked map item) hides the link icon rather than going to a broken page.
- An outside URL opens as Perspective opens outside URLs.

### 4.3 Roles and the Map Studio tools

**Description:** Users with an editing role see the Map Studio tools on the same component; everyone else sees the plain map. Realizes UJ-1 to UJ-4.

#### FR-7: Show the tools by role

The Map Studio tools appear only for users whose roles the project names as editing roles, and every save checks the role on the Gateway. Realizes UJ-1, UJ-2. [UNVERIFIED: Perspective or SDK behaviour, to check on a live 8.3 Gateway]

**Consequences (testable):**
- A viewer sees no tools and no editing affordance; a map editor sees them.
- A save attempted without an editing role is refused on the Gateway and nothing is written, whatever the page shows.
- The project names separate roles for full editing and for phone editing (move a point, edit properties).

#### FR-43: Enter Edit mode

Added from the UX workshop (ux-map-studio, 2026-10-27). A map editor enters Edit mode from an Edit switch on the map, and the project can open the component straight into Edit mode with a prop. Realizes UJ-1 to UJ-3.

**Consequences (testable):**
- The Edit switch shows only to users with a full editing role (FR-7); turned on it opens Edit mode with the item list (FR-45), turned off it returns to the plain map.
- A component whose edit-mode prop is set opens in Edit mode for a user with a full editing role, and in View mode for everyone else.
- On a phone there is no map-wide Edit switch; phone editing starts from the item's bottom sheet (FR-28).

#### FR-8: One clear mode

The tools show the current mode in words and a glyph, and Esc returns to Select. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- At any moment exactly one mode is active and named on screen.
- Esc from any drawing mode cancels the unfinished map item and returns to Select.

#### FR-36: First run

Amended in the UX workshop (ux-map-studio, 2026-10-27): an empty map shows map editors in Edit mode a short checklist as the way in: "Set up your kinds", "Add or import items" and "Check the operator view". The one-time tour this FR named before is dropped. Realizes UJ-1.

**Consequences (testable):**
- On a map with no map items, a map editor in Edit mode sees the three steps; each opens its surface (the Kinds screen, the add tools or import, View mode) and is ticked once done.
- A viewer sees an empty map with a short note.
- No tour or throwaway layer is offered.

#### FR-45: Item list

Added from the UX workshop (ux-map-studio, 2026-10-27). Edit mode shows a list of map items grouped by place (field, then site, then what is on it), with the map items that need attention first, and a Sort by dropdown. Realizes UJ-2, UJ-3.

**Consequences (testable):**
- Groups follow place: field, then site, then what is on it; areas that cover a field sit in a field-wide group.
- By default map items in alarm, with comms lost or stale come first; Sort by changes the order (needs attention, place, kind, name, last changed).
- Each row shows its worst state in a glyph and a word (alarm, Comms lost, Stale, Unlinked), live.
- Choosing a row selects the map item, pans the map to it and opens its properties; the list footer counts unlinked map items and lists them (FR-11).

#### FR-46: Docked layout

Added from the UX workshop (ux-map-studio, 2026-10-27) (direction A, docked studio, as a starting point). Edit mode docks a mode rail, the item list and the properties panel beside the map, with a floating draw toolbar over the map; the list collapses to a button on narrower screens. Realizes UJ-1 to UJ-3.

**Consequences (testable):**
- The rail switches between View, Items, Kinds, Layers and Import; the map and the selection stay when it switches.
- At 1366 px and wider the rail, the list, the properties panel and the map show together, and opening properties keeps the selection in view.
- Below about 1280 px the item list collapses to a button, leaving the rail, the properties panel and the map.
- First simplifications (owner): the list's filter chips sit behind a Filter button, and the properties panel has two tabs, Details and Style, with the asset and page links in Details.
- No control, toast or panel edge sits in the bottom-right corner, which the Perspective App Bar toggle uses.

### 4.4 Kinds, kind setup and data links

**Description:** The project supplies its kinds and its asset list. A map editor links map items to assets and writes each kind setup once; map items inherit it, with overrides where needed. Realizes UJ-2, UJ-3.

#### FR-9: Kinds from the project

The project supplies the list of kinds, each with its geometry, icon and form fields; a new kind needs no change to Map Studio. Realizes UJ-1, UJ-3.

**Consequences (testable):**
- Adding a kind to the project's list makes it available in the tools without rebuilding the module.
- Map Studio ships a core icon set in one minimalist style for the oil and gas kinds: well pad, wellhead, tank battery, compressor station, booster station, meter station, pig launcher or receiver, line valve, tap, meter, RTU or comms tower, pipeline, lateral, lease road, geofence, region and site footprint. A kind may name any icon from it. `meter` (a flow meter on a line, FR-40) was added 2026-10-27 and needs its own instrument glyph, distinct from meter station.
- The kind list marks which point kinds are instrument kinds (for example tap, meter and line valve), which sit on a line (FR-40).

#### FR-10: Asset list through the asset contract

The project supplies its asset list in the form the asset contract defines (at least an id, a name, a kind and a base path). Realizes UJ-1, UJ-3.

**Consequences (testable):**
- The asset contract is documented, with an example list.
- The tools show where the asset list comes from and say clearly when it is empty or missing a required field.

#### FR-11: Link a map item to an asset

A map editor links a map item to an asset from the asset list, and can unlink it. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- A linked item takes its base path from its asset, and its icon and popup work at once from its kind setup.
- Unlinked map items are allowed; the tools show how many there are and can list them.
- Two map items may share a name when they link to different assets; the name shows a red underline and a tooltip saying it is already in use.
- When a linked asset disappears from the asset list or changes its id, the map item shows as unlinked with the reason, and keeps its location and properties.
- A map item whose kind is no longer in the kind list stays on the map, marked "Unknown kind".

#### FR-12: Write a kind setup

A map editor writes a kind's setup once: comms path, up to 4 KPIs, alarms path, popup parts, popup link, an optional custom popup view, an optional style rule and, for areas, category tints (FR-38, FR-39), as paths relative to each map item's base path. Realizes UJ-3.

**Consequences (testable):**
- Changing a kind setup changes every map item of that kind that has no override.
- Each live value (comms, each KPI, the alarm count, the alarm summary) has its own on and off switch.
- A tag browser lets the editor pick a tag instead of typing a path.
- A path that does not resolve for a map item is reported for that map item, not silently left blank.
- Amended in the UX workshop (ux-map-studio, 2026-10-27): the Kinds screen sets up only the kinds the project already defines (FR-9); it adds no kinds.
- The tag browser shows one example asset's tags and turns the pick into a path relative to the asset's base path; typed paths still work. [UNVERIFIED: a Gateway tag-browse lookup for the module, to check on a live 8.3 Gateway]
- The live preview uses a map item the editor chooses.
- The kind setup's sections come in this order: Icon, Key values, Comms, Alarms, Popup, Style rule (last, because it builds on the key values).

#### FR-13: Override per item

A map editor overrides any part of the kind setup on one map item. Realizes UJ-3.

**Consequences (testable):**
- An overridden value is marked as an override and can be reset to the kind setup.

### 4.5 Drawing and editing

**Description:** Map editors draw and change points, lines and areas on the map itself, with snapping and undo. Realizes UJ-1, UJ-2.

#### FR-14: Add a map item

A map editor adds a point, a line or an area of a chosen kind, in any order. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- Amended in the UX workshop (ux-map-studio, 2026-10-27): the draw toolbar offers kind buttons for the common kinds and generic point, line and area tools, whose kind is picked in the form after.
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
- Amended in the UX workshop (ux-map-studio, 2026-10-27): snapping is off by default, so drawing is free; the map editor turns it on with the toggle.
- A snapped end and a floating end look different on the map.
- With snapping off, nothing snaps.
- An instrument (FR-40) snaps onto a line, not to its vertices: it is placed on the line and stays on it.

#### FR-40: Instruments on lines

Approved by the owner 2026-10-27. Pipeline instruments, that is taps (pressure transmitters such as the template's Rangers), meters (flow) and line valves, are their own map items snapped onto a line, because a real line carries several instruments, each with its own comms and alarms. This matches the template's registry, which lists the Rangers as taps of L-SWD (`L-SWD/PT-1` at 1,143 m and `L-SWD/PT-2` at 2,841 m of 2,922 m) and of L-GL21 (the template's `docs/map.md`, section 6). It extends FR-4, FR-5, FR-16, FR-34 and FR-38. Realizes UJ-1, UJ-5.

**Consequences (testable):**
- An instrument is a point map item of an instrument kind, with its own kind setup (comms path, KPIs, alarms path, popup parts), overrides and asset link, like any point.
- Map Studio stores which line an instrument sits on and its distance along line in metres from the line's start. Moving or reshaping the line keeps each instrument on it, at its nearest place on the new shape, in the same save; splitting a line (FR-15) keeps each instrument on the part it sits on, measured from that part's start.
- An instrument is placed by clicking the line or by typing its distance along line, and moved along the line, never off it, by dragging or by typing a new distance (NFR-3).
- The instruments split the line into line segments for display.
- A line's popup lists its instruments in order along the line, between the map items its ends snap to, each with its live values and distance (for example CTB1 outlet, PT-1 at 1.1 km, PT-2 at 2.8 km, SWD1 inlet), plus the line's own KPIs and alarms.
- Clicking or tapping a spot on a line opens the popup at that line segment (for example "PT-1 to PT-2"), with the instruments at its ends highlighted on the map and in the list.
- A line's style rule (FR-38) may use its instruments as its value, and each line segment then draws the worst of the instruments at the segment's ends, as the template's map draws a segment from the taps at its ends: a segment is dashed when either end instrument is stale, attention when either end instrument's value is outside its band (owner, 2026-10-27).
- Deleting a line deletes its instruments in the same save, and one undo restores the line and its instruments (owner, 2026-10-27).
- An instrument's alarm shows at that instrument's place on the line, not only at the line's midpoint; the line's own alarms path keeps its midpoint glyph (FR-34).

#### FR-17: Delete and undo

A map editor deletes map items and undoes or redoes any edit: adds, geometry changes, deletes and property changes. Realizes UJ-2, UJ-4.

**Consequences (testable):**
- Delete asks for no confirmation; one undo restores the map item with its link and properties.
- Undo and redo work by buttons and by Ctrl+Z and Ctrl+Shift+Z.
- Undo covers the user's own edits in the current session. Undoing an edit that is already saved saves the reverse edit, and is refused, as in FR-31, when another map editor has changed the map item since.
- Amended in the UX workshop (ux-map-studio, 2026-10-27): Undo and Redo are visible beside the save status at all times in Edit mode, and name the step they undo (for example "Undo: edit 20 pads"). A bulk change (FR-25) and an import (FR-23) each undo as one step.

#### FR-44: Recent changes

Added from the UX workshop (ux-map-studio, 2026-10-27). A map editor opens Recent changes from the save status: recent saved edits from the edit record (FR-30), each with who, what and when, and a Revert per change. Realizes UJ-2.

**Consequences (testable):**
- Recent changes lists edits by every map editor, newest first, in words (for example "Sam moved P31, 10:42").
- Revert undoes that one change, including another map editor's, and saves like any edit; it is refused, as in FR-31, when the map item has changed since, saying who changed it.
- A reverted bulk change or import reverts as one step.
- It is tucked away behind the save status; Undo (FR-17) stays the everyday way back.

#### FR-18: Fast entry

A map editor duplicates a map item or adds another like the last, which copies the kind and properties but not the asset link. Realizes UJ-2.

**Consequences (testable):**
- "Add another like the last" opens the form prefilled and waits only for the location and the link.
- A `?` key or button shows the keyboard shortcuts.

#### FR-19: Validation while drawing

The tools check a map item while it is drawn and say what is wrong in plain words beside it. Realizes UJ-1.

**Consequences (testable):**
- A self-intersecting area and a line with fewer than two vertices are flagged before they are finished.

### 4.6 Item forms and location entry

**Description:** Adding or editing a map item opens a form with its kind's fields, its asset link and its location. Realizes UJ-1, UJ-4.

#### FR-20: Item form

The form shows the kind's fields, the asset picker and the location, marks required fields, and remembers the last entry per kind. Realizes UJ-1.

**Consequences (testable):**
- Required fields are marked and the form says which are missing.
- Opening the form again for the same kind prefills the last values entered, except the name, the location and the link.

#### FR-21: Location by typing or picking

The location is set by typing latitude and longitude or by picking the point on the map. Realizes UJ-1.

**Consequences (testable):**
- Amended in the UX workshop (ux-map-studio, 2026-10-27): clicking the map, then dragging the pin to fine-tune, is the main way to place a point; typed coordinates are the backup. Address or legal land description search is not offered.
- Typed coordinates show a place check (country, province or state, and city) at once, looked up without any online service.
- Coordinates entered the wrong way round, or outside the valid range, are flagged.
- "Zoom to location" moves the map to the typed point.

### 4.7 Import and bulk edit

**Description:** Map editors, integrators most often, bring map items in from files, match them to assets and change many at once. Realizes UJ-3.

#### FR-22: CSV template

A user downloads the CSV template for a kind, with the columns its import needs. Realizes UJ-3.

**Consequences (testable):**
- A template filled correctly imports with no errors.

#### FR-23: Import files

A map editor imports map items from CSV, KML or GeoJSON. The import is a preview until the user adds it to the map; adding it saves it as one edit that a single undo removes. Realizes UJ-3.

**Consequences (testable):**
- The import shows how many map items it found and lists rows it could not read, with the reason.
- The user can cancel an import with nothing changed.
- Amended in the UX workshop (ux-map-studio, 2026-10-27): the import is guided in steps: Preview (on the map and in a table), Map columns to fields, Match to assets (FR-24), Summary (new, updated, skipped), then Import; Cancel at any step changes nothing.
- An import undoes as one step (FR-17).

#### FR-24: Match imported items to assets

After an import, Map Studio links map items to assets with the same name and lets the user match the rest by hand. Realizes UJ-3.

**Consequences (testable):**
- The match shows how many map items it linked and how many remain unlinked.
- Amended in the UX workshop (ux-map-studio, 2026-10-27): confident matches are ticked and doubtful ones flagged for the user to confirm or fix before Import.

#### FR-25: Bulk edit

A map editor selects several map items (by click, add to selection or a rectangle) and changes a shared property at once. Realizes UJ-3.

**Consequences (testable):**
- The form shows "N selected" and marks fields whose values differ.
- Geometry is not bulk edited.
- Amended in the UX workshop (ux-map-studio, 2026-10-27): map items are selected in the item list (checkboxes, Shift-click for a range, select all in a group or a filter) or on the map (box, or lasso).
- The bulk form shows only the fields every selected map item shares; a field whose values differ shows Mixed with the number of values; a changed field applies to all selected; name, location and asset link are never shown.
- A bulk change undoes as one step (FR-17).

#### FR-26: Reference layer

A map editor shows an imported KML or GeoJSON file as a reference layer under the map items, for comparison only. Realizes UJ-1.

Deferred, not dropped, in the UX workshop (ux-map-studio, 2026-10-27): the first version's Layers offers only the basemap switch (FR-32); reference layers and land grids come later (6.3).

Parked in the backlog (owner, 2026-10-27): FR-26 is not covered by any epic; it is held as `_bmad-output/backlog/story-reference-layers.md` (initiative R29) until the owner brings it back.

**Consequences (testable):**
- A reference layer can be shown, hidden and removed, and is never edited or saved as map items.

### 4.8 Phone

**Description:** On a phone, operators move a point and edit a map item's properties; nobody draws. Realizes UJ-4.

#### FR-27: Move a point on a phone

On a 390 px phone with touch only, a user with phone editing moves a point with a crosshair: tap Move, the map pans under a fixed centre crosshair, then tap Done or Cancel. Amended in the UX workshop (ux-map-studio, 2026-10-27): the crosshair replaces long-press and drag. Realizes UJ-4. [UNVERIFIED: Perspective or SDK behaviour, to check on a live 8.3 Gateway]

**Consequences (testable):**
- Move is offered in the map item's bottom sheet after Edit (FR-28); while moving, the crosshair stays fixed at the centre and the map pans under it.
- Done saves the point at the crosshair; Cancel leaves it where it was.
- An Undo bar appears after Done.
- No drag is needed (NFR-3), and every touch target, Move, Done and Cancel among them, is at least 44 px.

#### FR-28: Edit properties on a phone

On a phone, a user with phone editing edits a map item's properties in a bottom sheet. Realizes UJ-4.

**Consequences (testable):**
- Below 768 px wide, drawing tools are not offered; moving a point and editing properties are.
- Amended in the UX workshop (ux-map-studio, 2026-10-27): phone editing starts from an Edit button in the map item's bottom sheet and edits that one map item (move a point, edit properties); there is no map-wide Edit switch on the phone.
- Popups and properties on the phone are bottom sheets with a visible 44 px close, stopping above the App Bar toggle; this replaces the template's chip row and top sheets and is an engineering review item (ER-27).

### 4.9 Saving

**Description:** Map Studio saves the map to the map store as the user works; nothing is lost when a user leaves halfway. Realizes UJ-1, UJ-2.

#### FR-29: Save as you work

Every finished edit is saved to the map store without a save button. Realizes UJ-1.

**Consequences (testable):**
- There is no Publish step: a saved edit is what viewers see (confirmed in the UX workshop, ux-map-studio, 2026-10-27).
- Closing the browser after an edit and opening the map on another computer shows the edit.
- An edit that fails to save is shown as unsaved, with the reason, and is kept in the browser until it saves or the user discards it.
- Other open components show a saved edit without a page reload, within a few seconds.
- When the map store cannot be reached on load, the map says so, shows nothing stale as current, and the tools are disabled until it can.

#### FR-30: Map store

The project names a database connection; Map Studio creates and upgrades its own tables there. Realizes UJ-1. [UNVERIFIED: Perspective or SDK behaviour, to check on a live 8.3 Gateway]

**Consequences (testable):**
- A new project with an empty database connection works without hand-written SQL.
- Each saved edit records who made it and when.

#### FR-31: Two editors at once

Two map editors working on the map at the same time never overwrite each other silently. Realizes UJ-2.

**Consequences (testable):**
- When both change the same map item, the second save is refused with a message, and the user sees the other editor's change.

#### FR-35: Export

A map editor exports the map, or a selection of it, as GeoJSON or CSV, with each map item's kind, properties and asset link. Realizes UJ-1, UJ-3.

**Consequences (testable):**
- An exported map imported into an empty project's map store gives the same map items, so a map can seed another project; whether and how to do so is the project's choice.
- An export is a file the user saves; Map Studio keeps no copy.

### 4.10 Basemaps

**Description:** The map sits on a basemap the project chooses per Gateway. Realizes UJ-1, UJ-4.

#### FR-32: Basemaps

The project offers none, OpenStreetMap, satellite and Mapbox basemaps; the user switches between those offered. Realizes UJ-1. [UNVERIFIED: Perspective or SDK behaviour, to check on a live 8.3 Gateway]

Amended in the UX workshop (ux-map-studio, 2026-10-27): in the first version Layers offers None, OpenStreetMap and Satellite; the Mapbox vector style option is deferred, not dropped (6.3).

**Consequences (testable):**
- With no basemap, the map items still draw on a blank background, for sites without internet.
- A basemap that needs a token reads it from the project's secret store, never from a view or a file in git. The token still reaches every viewer's browser, so only a public, restricted token may be used.

### 4.11 Cross-cutting requirements

- **NFR-1 Responsiveness.** On the template's 30-pad scale set, panning, zooming and dragging run at 60 frames per second in a laptop browser, and an edit shows on the map within 100 ms, before it is saved. Measured first in the spike. 300 sites and 2,000 segments are a later target; nothing in the first version may rule them out.
- **NFR-2 No Gateway call per click.** Drawing and editing run in the browser; the Gateway is called when an edit is finished, not on every click or vertex.
- **NFR-3 Accessibility.** WCAG 2.2: a non-drag alternative for every drag (2.5.7); targets at least 24 px, 44 px on touch (2.5.8); 3:1 non-text contrast in both themes (1.4.11); the tools usable by keyboard.
- **NFR-4 Theme.** Colours come only from the host project's theme tokens, in both the light and the dark theme; the module carries no colour of its own. With FR-38 and FR-39 (owner, 2026-10-26): the style presets and the area category tints are theme tokens too, and nothing in Map Studio accepts a colour code. [UNVERIFIED: Perspective or SDK behaviour, to check on a live 8.3 Gateway]
- **NFR-5 Security.** Editing rights are checked on the Gateway on every save (FR-7); tokens and credentials come from the project's secret store (FR-32); Map Studio writes only to its map store (section 5), and acknowledging happens only in the alarm table, as Ignition's own write (FR-5, FR-37).
- **NFR-6 Platform and supply chain.** Ignition 8.3 full Gateways only; not Edge Gateways. Java 17 on the Gateway; the host's Jython is untouched. The module ships as a signed `.modl` from a GitHub release, pinned by SHA-256 and certificate fingerprint in the host's module lock and baked into its private Gateway image; never a `.modl` in git. The Perspective client package versions are pinned to the Gateway version, and every 8.3.x upgrade is checked on the test stack before release.
- **NFR-7 Verified claims.** See section 10: claims tagged `[UNVERIFIED]` stay so until checked on a live 8.3 Gateway.
- **NFR-8 Public contract.** The component's parameters and events, the asset contract, the kind list and the CSV template formats are documented and versioned; a breaking change needs a new major version. Versions follow semantic versioning.
- **NFR-9 Live value load.** Icon live values arrive for the whole page in one batch on a refresh interval the project sets (default 10 seconds; a project with less data can set it shorter, a large one longer), never as a tag subscription per map item per session (the template's list rule). A popup's values are live while it is open. A live value the kind setup turns off is not read at all.
- **NFR-10 Licences.** No dependency that charges per deployment (the template's UX-36). Libraries, icon sets and place-check data use permissive licences, with their attributions shipped; no icon is derived from the template's AGPL-window OpenBridge set.
- **NFR-11 Look.** Modern, minimal and clean: one minimalist icon style, neutral normal states, no decoration that carries no information. With FR-38 and FR-39 (owner, 2026-10-26): a value style's normal preset is neutral, and an area's category tint is low saturation and never an alarm hue.

## 5. Non-goals

- Map Studio is not a GIS: no projections, topology editing, spatial analysis or survey-grade accuracy.
- It does not create or change assets, tags or UDT instances; it links to what the project already has.
- It does not write to devices or tags.
- It is not an alarm system: alarm state and limits come from Ignition's alarms, and it does not replace the alarm table or the alarm pages.
- No approval workflow, draft and release split, Publish step, or map version history in the first version (see section 1).
- It does not run on Edge Gateways.

## 6. MVP scope

### 6.1 In scope

- Everything in section 4, including the core icon set (FR-9), and the template's map pages moved onto Map Studio (SM-1), except what 6.3 defers (FR-26, FR-32's Mapbox style option).

### 6.2 Build order

Not a cut line: every item in 6.1 ships. The order makes Map Studio useful on the template early.

1. The spike (6.4).
2. The map store and data: kinds, the asset contract, roles, saving (FR-7, FR-9, FR-10, FR-29 to FR-31), and storing each instrument's line and distance along line (FR-40).
3. Viewing: the map, icons, popups, search, basemaps (FR-1 to FR-6, FR-32 to FR-34, FR-37), drawing value styles and area tints (FR-38, FR-39), drawing instruments on lines with the ordered line popup (FR-40), the legend and the Needs you summary (FR-41, FR-42).
4. Drawing and editing, forms, location, linking and kind setup (FR-8, FR-11 to FR-21, FR-36), placing instruments on lines (FR-40), the Edit switch, Recent changes, the item list and the docked layout (FR-43 to FR-46).
5. Import, bulk edit and export (FR-22 to FR-25, FR-35); the reference layer (FR-26) is deferred.
6. Phone editing (FR-27, FR-28).
7. The template cut-over (SM-1).

These match the initiative's seven epics (2026-10-26).

### 6.3 Out of scope for MVP

- Flow animation (direction and rate along lines). It was the original reason for the project and is the first thing to revisit after the MVP.
- The full icon library and other industries' kinds.
- A time slider replaying history; map version history.
- Clustering of map items at low zoom.
- Offline basemap tiles.
- A second renderer (MapWeave).
- Open-source release (README, examples, Exchange listing): after the owner validates it in the template (open question 1).
- Scale beyond the 30-pad scale set (NFR-1).
- Deferred, not dropped, in the UX workshop (ux-map-studio, 2026-10-27): reference layers and land grids (FR-26, parked in the backlog, initiative R29), and the Mapbox vector style basemap option (FR-32). The first-run tour is dropped (FR-36).

### 6.4 First step: the spike

One to two days before any feature: a blank component module built from an open-source one (see the addendum), a MapLibre canvas on a Perspective view on a live 8.3 Gateway, one edit sent back to the Gateway, and a check that alarm counts aggregate on tag folders and UDT instances.

- **Measures to record:** hours to a green build, bundle size, frame rate on the 30-pad scale set, the size of one batch of icon values, and what broke on the phone.
- **Go** when the module builds and runs within two days and the round trip works.
- **No-go** when the toolchain or the Perspective client API takes most of the two days. Then the answer is a better map page on the built-in Map, and this PRD records why.

## 7. Success metrics

**Primary**

- **SM-1: It replaces the template's map pages.** The template's map and map editing run on Map Studio, the Leaflet map and drawing layer are retired, and the map lives in the map store. Validates FR-1 to FR-46, except the deferred FR-26 and FR-32's Mapbox style option.
- **SM-2: A field from nothing in 30 minutes.** A map editor who has not seen the Mesa demo field (the template's sample field) lays it out (sites, pipelines with their taps as instruments on them, one geofence, every map item linked) with the tools alone, without help, in under 30 minutes. Validates FR-9 to FR-21, FR-36, FR-40 and FR-43 to FR-46.

**Secondary**

- **SM-3: Phone edits.** At 390 px, touch only, a pin is moved and a property edited, and both reach the map store. Validates FR-27, FR-28.
- **SM-4: Nothing lost.** Closing the browser mid-layout and reopening on another computer loses no finished edit. Validates FR-29.
- **SM-5: Alarm to page in two clicks.** From an icon with an alarm count, a viewer reaches the map item's own page in two clicks. Validates FR-2, FR-4 to FR-6, FR-33, FR-37, FR-42.

**Counter-metrics (do not optimize)**

- **SM-C1: Features per release.** Adding tools must not slow SM-2; a feature that makes the 30-minute build slower is a regression. Counterbalances SM-1.
- **SM-C2: Colour on the map.** More colour is not more information: with every map item in its normal state, no map item shows a hue. Counterbalances SM-5. With FR-38 and FR-39 (owner, 2026-10-26): a value style's normal preset counts as normal and shows no hue; an area's low-saturation category tint is the one hue a normal area may show, and no point or line shows one.

Target date for SM-1 to SM-5: end of January 2027, a target and not a deadline.

## 8. Risks

- **Toolchain weight:** Java 17, Gradle with Inductive Automation's module plugin, Node and module signing, kept working by one person. The spike tests it first.
- **Perspective client coupling:** the client bundle compiles against Inductive Automation's Perspective client packages, so an 8.3.x upgrade can break it (NFR-6).
- **Designer props editing:** arrays of objects edit poorly in the Designer; parameters are kept small and the map lives in the map store, not in props.
- **Basemap privacy:** tiles are requested from outside the customer's network, and a Mapbox token reaches every viewer's browser (FR-32).
- **Alarm presentation:** state on icons, lines and popups needs engineering review (see 4.1), and so do the style presets and area tints (FR-38, FR-39).
- **A second product to maintain:** releases kept to a version bump and a test-stack run.

## 9. Open questions

1. Licence: Apache-2.0 chosen 2026-10-26; MIT stays possible until the first outside contribution.
2. Names chosen 2026-10-26: repository `perspective-map-studio`, module id `com.aoindustrial.perspective.mapstudio`, npm `@aoindustrial/perspective-map-studio`.
3. Which satellite basemap provider, on what terms?
4. Answered in the UX workshop (ux-map-studio, 2026-10-27): Edit mode on the same component, entered by an Edit switch or a prop (FR-43), in a docked layout with a mode rail, item list and properties panel and a floating draw toolbar (FR-46).
5. How does the project supply its kinds and asset list (a named query, a script, a file), and in which format? For the architecture.
6. Answered 2026-10-26: Ignition 8.3 has an Alarm Metrics folder on tag folders and UDT instances (IA docs). Its values can be subscribed but not read directly, which the architecture must respect for NFR-9.
7. Answered 2026-10-26: the owner approved value-driven styles (FR-38) and area category tints (FR-39) as written.
8. Answered 2026-10-26: a stale value shows only as stale; the map item drops its last value style until a fresh value arrives (FR-38).
9. Answered 2026-10-27: each line segment draws from the instruments at its two ends, as the template's map draws a segment from the taps at its ends (its `docs/map.md` section 2), not the whole line from all its instruments (FR-40).
10. Answered 2026-10-27: deleting a line deletes its instruments in the same save, and one undo restores the line and its instruments (FR-40).
11. Answered in the UX workshop (ux-map-studio, 2026-10-27): a phone move uses tap Move and a fixed centre crosshair, replacing long-press and drag (UJ-4, FR-27).
12. Answered in the UX workshop (ux-map-studio, 2026-10-27): first run is the checklist only; the tour is dropped (FR-36).
13. Answered in the UX workshop (ux-map-studio, 2026-10-27): reference layers (FR-26) and the Mapbox vector style option (FR-32) are deferred, not dropped.
14. Answered in the UX workshop (ux-map-studio, 2026-10-27): there is no Publish step; live saves, Undo and Recent changes cover it (FR-17, FR-29, FR-44).

## 10. Assumptions index

Figures and limits chosen during discovery and confirmed by the owner (recorded in `.memlog.md`), listed so downstream readers can tell them from measured facts:

- Up to 4 KPIs per kind setup (FR-12).
- 44 px touch targets, a 390 px phone, 768 px as the width below which drawing is not offered (FR-27, FR-28).
- 30 minutes for SM-2; the 30-pad scale set, 60 frames per second and 100 ms for NFR-1.
- 10 seconds as the default icon refresh interval, adjustable by the project (NFR-9); "a few seconds" for live updates across components (FR-29).
- 20 m for a shared marker (FR-34, from the template).
- About 1280 px as the width below which the item list collapses to a button (FR-46, UX workshop).
- 2 to 3 KPIs in the default popup (FR-4, UX workshop).
- The offline place-check data adds a few megabytes to the module (addendum; an estimate).

Unverified platform claims, tagged `[UNVERIFIED]` inline: FR-6, FR-7, FR-12 (the Gateway tag-browse lookup), FR-27, FR-30, FR-32, FR-37, FR-38, NFR-4. Each stays unverified until checked on a live 8.3 Gateway and recorded in claude-ignition-skills (NFR-7).
