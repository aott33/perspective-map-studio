---
type: initiative
title: "Map Studio for Ignition Perspective"
parent: none
sources: [_bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md]
companions: [_bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md, _bmad-output/initiative-flowmap/prd-map-studio/addendum.md, _bmad-output/initiative-flowmap/brief-flowmap/brief-flowmap.md, _bmad-output/initiative-flowmap/brief-flowmap/addendum.md]
risk: high
---

# Map Studio for Ignition Perspective

## Description

Map Studio becomes the map of an Ignition 8.3 Perspective project: one component everyone opens, showing each site's live comms, a key value and alarms, with role-gated tools to build and edit the map in the browser and link every map item to the project's assets and tags. Its first user is the owner's `ign-scada-template`, whose Leaflet map and editor it replaces; it is built to be open-sourced once proven there. The final PRD is the source; the brief and the idea doc are upstream of it.

## Outcome

Map editors build and keep a field's map in the browser and everyone reads live state from it, shown by Map Studio replacing the template's map pages and by a newcomer laying out the demo field in under 30 minutes (prd SM-1, SM-2).

## Requirements

- R1 (prd FR-1): Every Map Studio component in a project shows the one project map, opening on the starting area it is given; two components given different starting areas show the same map items.
- R2 (prd FR-2): Point map items draw as icons with the kind's glyph, comms state, the icon KPI and alarm state (highest priority glyph, solid or hollow by acknowledgement, digit, optional count), each only where the kind setup turns it on; normal items are neutral grey.
- R3 (prd FR-3): Map item labels give way to each other as the user zooms out, ranked by the kind list, and never overlap at the starting area's zoom.
- R4 (prd FR-33): Any user finds a map item by name or asset in a search field; choosing a result zooms to it and selects it, on a 390 px phone and by keyboard.
- R5 (prd FR-34): The map shows everything the template's current map shows (line state, flow arrow on the selected line, shared markers within 20 m, Fit and Return, line and name toggles), checked against the template's docs/map.md section 5.
- R6 (prd FR-4): A click or tap on a map item opens its popup: Map Studio's default popup with the parts its kind setup turns on, values live while open and stale values marked; a bottom sheet on a 390 px phone.
- R7 (prd FR-5): Where enabled, the default popup shows an alarm summary for the map item's alarms path (counts by priority, the most important alarms in words) with a View alarms button to the project's configured alarm page; Map Studio acknowledges nothing.
- R8 (prd FR-6): Where configured, the popup link goes to a project page or URL with placeholders filled from the clicked map item; a placeholder with no value hides the button.
- R9 (prd FR-7): The Map Studio tools show only for the project's editing roles (full editing and phone editing named separately), and every save is refused on the Gateway without the role.
- R10 (prd FR-8): The tools name exactly one current mode in words and a glyph, and Esc cancels drawing and returns to Select.
- R11 (prd FR-36): An empty map offers map editors "Draw your first site", "Import CSV" and a skippable tour that saves nothing.
- R12 (prd FR-9): The project supplies the kind list (geometry, icon, form fields, label rank); a new kind needs no module change; a core oil and gas icon set in one minimalist style ships with the module.
- R13 (prd FR-10): The project supplies its asset list per a documented asset contract (at least id, name, kind, base path); the tools say where the list comes from and when it is empty or incomplete.
- R14 (prd FR-11): A map editor links or unlinks a map item to an asset; unlinked map items are allowed and counted; duplicate names for different assets are flagged, not blocked; a vanished asset or kind shows its map items as unlinked or unknown kind with the reason.
- R15 (prd FR-12): A map editor writes a kind setup once (comms path, up to 4 KPIs with one icon KPI, alarms path, popup parts, popup link, optional custom popup view) relative to each base path, with a tag browser and an on or off switch per live value; it applies to every map item of the kind without an override; unresolved paths are reported per map item.
- R16 (prd FR-13): A map editor overrides any part of the kind setup on one map item, marked as an override and resettable.
- R17 (prd FR-14): A map editor adds a point, line or area of any kind in any order, finishing by double-click, Enter or Finish, and can do it without dragging.
- R18 (prd FR-15): A map editor moves points, drags, inserts and deletes vertices, and splits a line at a point into two lines that keep kind and properties; every drag has a non-drag alternative.
- R19 (prd FR-16): Line ends and vertices snap to nearby map items and vertices with a visible indicator and a toggle; snapped and floating ends look different.
- R20 (prd FR-17): A map editor deletes without confirmation and undoes or redoes any own edit in the session by buttons or Ctrl+Z and Ctrl+Shift+Z; undoing a saved edit saves the reverse and is refused when another map editor changed the map item since.
- R21 (prd FR-18): A map editor duplicates a map item or adds another like the last (kind and properties copied, not the link); a ? key or button lists shortcuts.
- R22 (prd FR-19): Drawing is checked as it happens (self-intersecting areas, lines under two vertices) with plain-words messages beside the map item.
- R23 (prd FR-20): The item form shows the kind's fields, the asset picker and the location, marks missing required fields, and prefills the last values per kind except name, location and link.
- R24 (prd FR-21): Location is typed or picked on the map; typed coordinates show an offline place check and flag swapped or out-of-range values; Zoom to location moves the map there.
- R25 (prd FR-22): A user downloads a CSV template per kind that, filled correctly, imports with no errors.
- R26 (prd FR-23): A map editor imports CSV, KML or GeoJSON as a preview that lists unreadable rows with reasons and can be cancelled; adding it saves it as one undoable edit.
- R27 (prd FR-24): After an import, map items are linked to same-name assets and the rest matched by hand, with counts of linked and unlinked.
- R28 (prd FR-25): A map editor selects several map items (click, add, rectangle) and changes shared properties at once, with N selected and mixed values marked; geometry is never bulk edited.
- R29 (prd FR-26): A map editor shows, hides and removes a KML or GeoJSON reference layer that is never edited or saved as map items.
- R30 (prd FR-27): On a 390 px phone, touch only, a user with phone editing moves a point by long-press and drag, drawn above the finger, with an Undo bar after the drop and 44 px targets.
- R31 (prd FR-28): On a phone, a user with phone editing edits a map item's properties in a bottom sheet; below 768 px no drawing tools are offered.
- R32 (prd FR-29): Every finished edit saves to the map store with no save button, survives closing the browser, shows on other open components within a few seconds, and a failed save stays visible and kept until saved or discarded; an unreachable map store on load disables the tools and shows nothing stale as current.
- R33 (prd FR-30): The project names a database connection and Map Studio creates and upgrades its own tables there with no hand-written SQL, recording who made each edit and when.
- R34 (prd FR-31): Two map editors never overwrite each other silently: the second save of the same map item is refused with a message showing the other's change.
- R35 (prd FR-35): A map editor exports the map or a selection as GeoJSON or CSV with kinds, properties and links, and an export imported into an empty map store gives the same map items.
- R36 (prd FR-32): The project offers none, OpenStreetMap, satellite and Mapbox basemaps; with none, map items draw on a blank background; tokens come from the secret store and must be public, restricted tokens.
- R37 (prd NFR-1): On the template's 30-pad scale set, pan, zoom and drag run at 60 frames per second in a laptop browser and an edit shows within 100 ms, before it is saved.
- R38 (prd NFR-3): The map and tools meet WCAG 2.2 for dragging (2.5.7), target size (24 px, 44 px on touch; 2.5.8), non-text contrast 3:1 in both themes (1.4.11) and keyboard use.
- R39 (prd FR-37): A kind setup may name a custom popup view that opens instead of the default popup and receives the documented map item object; an example view embeds the built-in alarm table, where acknowledging follows Ignition's permissions; a missing view falls back to the default popup.
- R40 (prd FR-38, FR-39): A kind setup may bind a map item's look to one value (a tag relative to its base path, or one of its KPIs) by States or Bands, or an expression returning a preset name, each state or band mapped to a preset from a fixed reviewed list (normal neutral; attention, warning and fault each a theme token plus its glyph or word; dimmed or out of service; for lines solid, dashed, dotted and weight by pipe size), with a live preview of every state before saving and a per-item override; areas may take a category tint from a fixed low-saturation token palette, never points or lines; no colour code is accepted anywhere, and alarm state wins over a value style; a stale value shows only as stale, with no value style, until a fresh value arrives.
- R41 (prd FR-40): Pipeline instruments (taps, meters, line valves) are their own map items snapped onto a line, each with its own kind setup like any point; the map store keeps which line each sits on and its distance along the line in metres from the line's start, and keeps it on the line when the line is moved, reshaped or split; a line's popup lists its instruments in order along the line with their live values, plus the line's own KPIs and alarms; a click on a line opens the popup at that line segment with the instruments at its ends highlighted; a line's style rule may use its instruments, each line segment drawing the worst of the instruments at the segment's ends; deleting a line deletes its instruments in the same save, one undo restoring both; and an instrument's alarm shows at its place on the line.

## Constraints

- (prd NFR-2, NFR-9) Drawing and editing run in the browser and call the Gateway only when an edit is finished. Icon live values arrive per page in one batch on a refresh interval the project sets (default 10 s), never as a tag subscription per map item per session; popups are live while open; switched-off values are never read.
- (prd NFR-4, NFR-11) Colours come only from the host project's theme tokens in light and dark themes; the look is modern, minimal and clean, one minimalist icon style, neutral normal states.
- (prd NFR-5, section 5) Editing rights are checked on the Gateway on every save; tokens and credentials come from the secret store; Map Studio writes only to its map store, never to tags, devices, assets or UDT instances.
- (prd NFR-6) Ignition 8.3 full Gateways only, never Edge; Java 17 on the Gateway and the host's Jython untouched; a signed `.modl` from a GitHub release, pinned by SHA-256 and certificate fingerprint in the host's module lock and baked into its private image, never a `.modl` in git; Perspective client packages pinned to the Gateway version and every 8.3.x upgrade checked on the test stack.
- (prd NFR-7, section 10) Every Perspective client API or module SDK claim stays unverified until checked on a live 8.3 Gateway and recorded in claude-ignition-skills (open: FR-5, FR-6, FR-7, FR-27, FR-30, FR-32, NFR-4).
- (prd NFR-8) The component's parameters and events, the asset contract, the kind list and the CSV formats are documented and versioned with semantic versioning; a breaking change is a new major version.
- (prd NFR-10) No dependency that charges per deployment (template UX-36); permissive licences only for libraries, icons and place-check data, attributions shipped; no icon derived from the template's AGPL-window OpenBridge set.
- (prd section 4.1, section 8) State on icons, lines and popups is alarm presentation and passes the template's engineering review (ER-27) before release.
- (prd section 6.4) A one to two day spike gates all feature work; a no-go means a better page on the built-in Map instead.
- (prd sections 1 and 5) No approval workflow, draft and release split or map version history: undo, the edit record and export are the safety net.

## Done when

- The spike's go is recorded with its measures (build hours, bundle size, frame rate, batch size, phone breakage) (prd 6.4).
- The template's map and map editing run on Map Studio, the Leaflet map, `/map/edit` and `prov`'s map steps are retired, and the map lives in the map store (prd SM-1).
- A map editor new to the Mesa demo field lays it out, every map item linked, with the tools alone in under 30 minutes (prd SM-2).
- At 390 px, touch only, a point is moved and a property edited and both reach the map store; closing the browser mid-layout loses no finished edit (prd SM-3, SM-4).
- From an icon with an alarm, a viewer reaches the map item's own page in two clicks, and a normal field shows no hue (prd SM-5, SM-C2).
- A signed release is installed through the template's module lock and passes the template's engineering review of alarm presentation (prd NFR-6, ER-27).

## Boundaries

- Not a GIS, not an alarm system, no approval workflow or map version history; does not create assets or tags or write to devices; no Edge Gateways (prd section 5).
- Out for the first version: flow animation (first to revisit), the full icon library and other industries' kinds, a time slider, clustering, offline tiles, a second renderer, the open-source release, scale beyond the 30-pad set (prd 6.3).
- Touch point: `ign-scada-template` - `/map`, `/map/edit`, `ops.mapedit`, the `map_draft` tables and queries, `prov`'s map steps, the `_Model/Map` consumers, the view generators and byte gates, the Edge example and the PV-29 harness change or retire; owner: epic-template-cutover.
- Tracer path: a project names its kinds, asset list and map store; a map editor draws a pad and links it; its kind setup binds comms, a KPI and alarms; a viewer sees the icon, opens the popup and follows its link.

## References

- prd - _bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md, sections 2.2 (journeys), 3 (glossary), 4 (features and NFRs), 6 (scope, build order, spike), 7 (success metrics), 8 (risks), 10 (assumptions)
- addendum - _bmad-output/initiative-flowmap/prd-map-studio/addendum.md, module references, technical leanings, template follow-up, signing key
- brief - _bmad-output/initiative-flowmap/brief-flowmap/brief-flowmap.md
- research - _bmad-output/initiative-flowmap/brief-flowmap/addendum.md, current state, icons, editing libraries, map UI practices
- glossary - _bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md, section 3
- architecture - _bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md, AD-1 to AD-22 (adopted companion; epics cite its AD ids; AD-11 and AD-16 carry the style rule and area tints; AD-19 and AD-20 carry the instrument attachment, AD-7 the line popup)
- contributor guide - docs/architecture.md

## Notes

- Decision: 2026-10-26 Repository `perspective-map-studio`, module id `com.aoindustrial.perspective.mapstudio`, npm `@aoindustrial/perspective-map-studio`, component `ao.mapstudio`; the owner renames the GitHub repository.
- Decision: 2026-10-26 Licence Apache-2.0 for the open-source release; MIT stays possible until the first outside contribution, after which a switch needs every contributor's consent.
- Decision: 2026-10-26 Sliced into seven epics by source capability, in build order: module foundation and spike, map store and data, viewing, editing, import and export, phone, template cut-over. The map store comes before viewing (the PRD's build order had viewing first) because viewing reads map items and kind setups from it; kind setups can be seeded for viewing before the editing epic writes them.
- Decision: 2026-10-26 R9 belongs to epic-map-store-and-data (the Gateway-side role check); epic-editing consumes it to show or hide the tools.
- Decision: 2026-10-26 The template cut-over is its own epic and owns the touch point on `ign-scada-template`; its work lands as template pull requests.
- Decision: 2026-10-26 Alarm aggregation is answered from the IA 8.3 docs (an Alarm Metrics folder on tag folders and UDT instances since 8.3.0); it does not gate the spike.
- Decision: 2026-10-26 Alarm Metrics are subscribed by one shared Gateway subscription per project (architecture AD-6); the spike checks that Java subscriptions reach them.
- Decision: 2026-10-26 Satellite basemap: Mapbox Satellite on the template's existing Mapbox token and secret; architecture checks the terms (MapTiler or Esri World Imagery if they fail).
- Open question: Where the Map Studio tools sit on the page; a UX workshop decides.
- Decision: 2026-10-26 Kinds and assets come from project script functions in published shapes (architecture AD-4, AD-16).
- Decision: 2026-10-26 The owner approved value-driven styles and area category tints as written (R40; prd FR-38, FR-39; architecture AD-11, AD-16), the colour approach Sofia recommended. It extends AD-11 and does not relax "normal is neutral, hue only for abnormal state, always with a word or glyph": every possible look is a preset from a short reviewed list, the presets and tints get the same engineering review as the alarm glyphs (ER-27), and alarm state still wins. Epic-map-store-and-data entry 9 stores and validates the style rule; epic-viewing (entry 1) draws it and the preview; epic-editing writes rules and overrides in the kind setup screen. R40 is covered by epic-viewing and epic-editing.
- Decision: 2026-10-26 A stale value shows only as stale: the map item drops its last value style until a fresh value arrives (owner; prd section 9, question 8).
- Open question: Where a style rule's expression is evaluated and in which expression language (unverified; architecture Deferred, settled when epic-viewing is refined).
- Decision: 2026-10-27 The owner approved instruments on lines (R41; prd FR-40; architecture AD-7, AD-11, AD-16, AD-19, AD-20): taps (pressure transmitters such as the template's Rangers), meters (flow) and line valves are their own map items snapped onto a line, stored with the line they sit on and their distance along it and kept on it when the line changes; a line's popup lists them in order with their live values; a click opens it at the clicked line segment; a line's style rule may use its instruments, each line segment drawing the worst of the instruments at the segment's ends (owner's answer below); an instrument's alarm shows at its place on the line. Reason: real lines carry several instruments, each with its own comms and alarms, and the template's registry already lists the Rangers as taps of L-SWD (PT-1 at 1,143 m and PT-2 at 2,841 m of 2,922 m) and of L-GL21 (template docs/map.md section 6). Only how the plan delivers changes for stories already built; nothing built is rewritten. epic-map-store-and-data entry 14 stores, validates and recomputes the attachment (no rendering), before the sweep; its stories 2 to 7, being built now, are not disturbed. epic-viewing entry 2 draws instruments, the ordered line popup, segment click and the aggregate style; epic-editing places instruments with an "add instrument on this line" tool. R41 is covered by epic-viewing and epic-editing, as R40 is. The core icon set gains an instrument `meter` glyph (prd FR-9), seventeen icons in epic-map-store-and-data entry 10.
- Decision: 2026-10-27 Owner: each line segment draws from the instruments at its two ends (the worst of the instruments at the segment's ends), as the template's map does, not the whole line from all its instruments (prd section 9, question 9; architecture AD-11, AD-16).
- Decision: 2026-10-27 Owner: deleting a line deletes its instruments in the same save, and one undo restores both (prd section 9, question 10; architecture AD-19; epic-map-store-and-data entry 14).
