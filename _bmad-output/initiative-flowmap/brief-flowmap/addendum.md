# Addendum - Map Studio brief

Detail for the PRD and architecture authors, and research that earned a place but does not fit the brief. Map Studio is the product the brief describes: an Ignition 8.3 Perspective component module for drawing and editing maps, named "Flow Map" in its source idea. That source is `docs/idea.md` in this repository, written by someone else and treated as proposals, not settled requirements.

**Labels.** [IA docs]: the Inductive Automation documentation. [live 8.3.9]: observed on a live Gateway, as recorded in the template's docs. [DM]: Nader Chinichian's LinkedIn message to the owner. [owner]: the owner's account, not seen in a source. (confirmed) or (fetched): read from the cited source this session. (unconfirmed): background knowledge or a recommendation; verify before relying on it, above all for licences.

**Where to look.** PRD: Open items, Parked, Current state, and the Ranked list under Map UI practices. Architecture: Parked (module shape, data contract, supply chain, risks), Editing libraries, Icons.

## Open items

| Item | Owner |
|---|---|
| Feature list of Nader's tool from his video (not fetched this session) | Owner |
| Built-in Map editing, clustering and animation confirmed absent on a live Gateway | Architect |
| Signing key custody and rotation | Architect |
| Licence and 2026 maintenance of every library before it becomes a dependency | Architect |
| Module id and npm package renamed from `flowmap` to Map Studio | Owner |

## Parked for the PRD and architecture

From `docs/idea.md` and the brief, still valid but too detailed for the brief:

- **Fast entry detail:** duplicate an item, add another like the last (same kind and properties, a new spot), keyboard shortcuts on a laptop, forms that remember the last entry.
- **Module shape:** Gateway hook (Java 17) registering the component and its props schema; client bundle (TypeScript, React) with MapLibre GL JS and deck.gl; optional Designer part. The renderer is a swappable layer inside the bundle.
- **Data contract** (to be reworked for editing): `nodes`, `edges`, two-way `selected`, `basemap`, `options`, and events. The idea doc's events (`onSelect`, `onOpen`, `onViewport`) grow edit events. GeoJSON is the interchange format. One `runScript` binding per page, never a tag subscription per item. The module emits edits as events and leaves storage and approval to the host: in the template they feed the existing draft, change set and `prov` path; another project could write straight to its own database.
- **Supply chain:** a signed `.modl` from a GitHub release, pinned by SHA-256 and certificate fingerprint in the host's `modules/modules.lock.json`, baked into the private Gateway image; never a `.modl` in git.
- **Risks to carry into architecture:**
  - Toolchain weight (Java 17, Gradle with Inductive Automation's module plugin, Node, signing).
  - Perspective client package coupling across 8.3.x upgrades.
  - Designer props editor for arrays of objects.
  - Basemap privacy (tiles leave the site, Mapbox token on the client).
  - Maintenance of a second product.
  - What the built-in Map got wrong, to avoid repeating [live 8.3.9]: array items get no schema defaults (a marker without `popup` crashes the component); `props.style` never reaches the Leaflet container; no `zIndexOffset`, so stacking needs CSS; custom control views mount at default size and need `!important` height fixes; a marker click also fires `onMapClick`; `onVectorClick` has no lat or lng.
- **Naming from the idea doc:** module id `com.aoindustrial.perspective.flowmap`, npm package `@aoindustrial/perspective-flowmap` (to rename; see Open items).
- **Alarm presentation:** colour, glyphs and motion that mean state go through the template's engineering review (ER-27, `docs/ux.md` section 11). This matters most when flow arrives.
- **Edge Gateways:** out; the template's Edge profile keeps the built-in Map.
- **MapWeave:** commercial, ruled out by the template's no-licence-fee rule (UX-36); a possible second renderer only if its analytics ever earn the licence.

## Current state

### The built-in Perspective Map (Ignition 8.3)

Source: the Perspective Map component page, read 2026-10-25.

- Built on Leaflet. Props-only configuration: `init` (center, zoom), `zoom`, `location`, `maxBounds`, `customControls` (embedded views in a corner). [IA docs]
- Layers: raster `tile` (OSM template or WMS) and `image`; vector `polygon`, `polyline`, `rectangle` and `circle` with stroke and fill (`color`, `weight`, `opacity`, `dashArray`, `dashOffset`); UI `marker` (icon `path`, `color`, `size`, `rotate`, `tooltip`, `popup`), `popup` and embedded `view`; a `geoJSON` FeatureCollection with `styleOptions`. [IA docs]
- The `geoJSON` prop is meant to be fed by a binding and transform, not edited by hand. [IA docs]
- No documented way for an end user to draw, move or delete shapes or markers; no clustering; no animation beyond zoom and fade. [IA docs, by absence; see Open items]
- Implication: every add, move or removal of a map item means editing props arrays in the Designer or writing a binding over a table.

### The template's map editor (ign-scada-template, PV-3 phase 2)

Source: `ign-scada-template` `docs/map-editor.md` and `docs/map.md` section 4, read 2026-10-25 at commit 26bd290. Status there: built, unverified on a Gateway.

- **Authority model.** The registry in git (`assets/`) is the source of truth and `prov` is the authority; the Gateway never writes the registry or git. A drawing is a draft in PostgreSQL (`map_draft`, `map_draft_event`), exported as a change set (`upstream.mapdraft/1`) that a person imports with `prov map import`, reviews in a pull request and applies with `prov plan` and `prov apply`.
- **Steps.** `add-pad`, `move-pad`, `add-pipeline`, `replace-points`, `retire-pipeline`. Nothing for areas, no deleting a site, no inserting or dragging a vertex.
- **Guards.** Roles (engineer, integrator) re-checked on the Gateway; a hash-based conflict refusal; a stale-draft refusal against the `_Model/Map` hash; an audit row per write; a one-year purge of discarded drafts. Bulk and as-built geometry go in through `prov map import-geojson`.
- **Interaction.** Three tool chips (Add pipeline, Add site, Move site), one tap per vertex, snapping by a Gateway script call, popup forms for attributes. The editor is hidden below 768 px.

### Comparable: Nader Chinichian's Map Administration Tool

Sources: his LinkedIn post and video, both titled "Ignition Perspective Map Administration Tool" (video not fetched), and his DM to the owner, 2024-11-01.

- A pure Perspective project, not a module, in two parts: an admin project and an end-user project. [DM]
- Includes many icons, CSS classes and widgets. [DM]
- Sold as resources to system integrators worldwide. [DM]
- Price about 25,000 USD. [owner]

## Research: map objects, icons and editing libraries

Source: research subagent, 2026-10-25. Most licence and maintenance claims are unconfirmed; only those marked (fetched) were read from the source.

### Object catalogue (CORE = oil and gas first release)

- **Point, generic:** site or facility (CORE), well pad (CORE), building, generic asset, alarm or event marker, note or label, inspection or photo point, sensor, RTU or comms tower (CORE), weather station.
- **Point, oil and gas upstream:** wellhead (CORE), tank battery (CORE), separator or test facility, flare or vent, SWD well, gathering header.
- **Point, oil and gas midstream:** compressor station (CORE), booster station (CORE), meter or custody transfer station (CORE), pig launcher or receiver (CORE), block or line valve (CORE), tap or tie-in (CORE, the split point for pipelines), regulator station, CP test point, pipeline marker, processing plant, terminal.
- **Point, later industries:** water (pump or lift station, plant, reservoir, hydrant, valve, manhole, meter, well, outfall); electric (substation, transformer, recloser, switch, capacitor bank, pole, meter, EV charger, DER site); gas distribution (district regulator, city gate, valve, service meter, odorant point, CP rectifier); fleet (vehicle, trailer, crew, depot; needs a moving-point mode with trails and staleness). Kept as evidence for the kind registry.
- **Line:** pipeline segment split at taps (CORE), lateral or tap branch (CORE), lease road (CORE), power or fibre to site, ROW centreline; water mains and sewers; electric feeders; gas mains and services; routes, planned routes, tracks, measurement lines.
- **Area:** geofence (CORE), region or zone (CORE), site fence or footprint (CORE), lease or unit boundary, ROW or easement, HCA or class-location zone, exclusion zone; pressure zones, DMAs, service territories, outage polygons, depot yards.

### Properties

Keep kind-specific fields in a kind registry, so another industry adds kinds without code changes.

- **Common:** stable id (never reused), name, kind (registry key), GeoJSON geometry, state (an enum with words and a glyph, never colour alone), quality or staleness, alarm summary, tag path or path template, link target (page and params, or popup view), parent id, layer or group, labels, notes, visible zoom range, z-order, label template, created, modified, author.
- **Point:** icon key, rotation or heading, anchor, size class, badge slots.
- **Line:** from and to node ids, computed length, direction (including unknown and bidirectional), parent line id and split sequence, label along the path.
- **Pipeline:** diameter, product, material, MAOP, service status, install year, segment id.
- **Area:** computed area, category, fill pattern (not only colour), containment rule, time window.

### Icons

- No single open set covers pump, valve, tank, compressor, separator, pig launcher or meter station. Plan a custom set in one style (24 px grid, 1.5 to 2 px stroke) seeded from CC0 or MIT sets, shipped as an SVG sprite keyed by kind.
- Candidate seeds: Maki (CC0, fetched; built for maps at 15 px, thin industrial coverage), Temaki (CC0, fetched; 557 icons, complements Maki, industrial glyphs unconfirmed), Tabler (MIT, fetched; 6,238 icons, consistent stroke style), Lucide (ISC, unconfirmed), Phosphor (MIT, unconfirmed), Material Symbols (Apache 2.0, unconfirmed). Font Awesome Free icons need CC BY attribution (unconfirmed).
- The template generates its icons from OpenBridge 1.0.1 under an AGPL window (`docs/theme.md`); the module's set must not derive from them.
- Standards (unconfirmed): ISA-5.1 and ISO 14617 are P&ID symbols, not map symbology; PODS and APDM are data models with no icon set; ISA-101 gives the principles (grey base, colour for abnormal only, redundant shape or text). Follow ISA-101 principles and offer P&ID-style valve and pump variants.

### Editing libraries

- **Terra Draw:** MIT, with adapters for MapLibre GL JS and others (fetched). The best candidate for drawing on MapLibre; its modes are under Map UI practices.
- **nebula.gl:** treated as unmaintained (Snyk "Inactive", page date unknown); `editable-layers` in deck.gl-community (MIT) is the fork to evaluate (unconfirmed for 2026).
- **Mapbox GL Draw:** ISC, built for mapbox-gl-js (fetched); MapLibre compatibility and snapping unconfirmed.
- **Leaflet-Geoman:** MIT core with a paid Pro tier, Leaflet only (fetched); snapping, split, cut, drag.

## Research: map UI practices

Source: research subagent, 2026-10-25. Fetch coverage was partial.

### Ranked for the first version

1. Current mode shown in words and a glyph in a persistent toolbar; Esc returns to Select.
2. All editing in the browser with one event per finished edit; no Gateway call per click. Update the map source locally on pointer move, throttled to animation frames, with editing features in a separate source from the display layer and an optimistic UI that rolls back with a message on failure (unconfirmed).
3. A non-drag alternative for every drag (WCAG 2.5.7).
4. Vertex and midpoint handles on the selected item, a visible snap indicator and a snap toggle.
5. Finish by double-click, Enter or a Finish button; Esc cancels; Backspace removes the last vertex.
6. Full undo and redo covering moves, inserts, deletes and property edits.
7. Validation while drawing, in plain words beside the item.
8. A skippable three-step tour and an empty state with "Draw your first site" and "Import CSV".
9. Neutral grey items, glyph-plus-word state, selection by ring and label, 3:1 contrast in both themes, label halos.
10. Phone: 44 px targets, long-press to pick up, offset drag, an Undo bar after the drop, a bottom sheet for properties.

### Map editing

- **Modes:** Terra Draw has one `select` mode plus per-geometry draw modes; `editable: true` lets features be dragged without switching modes. (confirmed, https://raw.githubusercontent.com/JamesLMilner/terra-draw/main/guides/4.MODES.md)
- **Vertices:** Terra Draw select flags `coordinates.midpoints`, `coordinates.draggable` and `coordinates.deletable`; ArcGIS Map Viewer shows nodes on a selected line and new midpoint nodes as you drag. (confirmed, Terra Draw guide; https://doc.arcgis.com/en/arcgis-online/manage-data/edit-features-mv.htm)
- **Snapping:** Terra Draw `toCoordinate`, `toLine`, `toFeature` (with a filter), `toDegree` and `showSnappingPoint`; ArcGIS has one "Enable snapping" toggle with per-layer snapping. (confirmed)
- **Finish and undo:** in ArcGIS you click to add nodes and double-click to finish; undo and redo step through vertices while drawing; unsaved features are listed. (confirmed) Terra Draw finish keys are unconfirmed.
- **Validation:** Terra Draw `validation(feature, {updateType: finish | commit | provisional})` with `ValidateMinAreaSquareMeters`, `ValidateMaxAreaSquareMeters` and `ValidateNotSelfIntersecting`; validate on `provisional` to warn while drawing. (confirmed) Also check orphan nodes and duplicate ids before an edit is sent (unconfirmed).
- **Splitting:** split a line at a point into two segments that inherit attributes, keeping the parent id and a sequence (pattern from the Esri editor and QGIS, unconfirmed).
- **Delete:** ArcGIS deletes are permanent and bulk deletes need a second confirmation. (confirmed) Map Studio keeps its own undo stack instead, so deletes are undoable.
- **Multi-select:** ArcGIS selects by point, rectangle or lasso with replace, add and remove; attribute bulk edit is capped at 500 features; one feature's geometry changes at a time. (confirmed) Bulk edit properties only, not geometry; show "N selected" and mixed-value placeholders (placeholders unconfirmed).
- **Import order:** GeoJSON first, then CSV, KML and shapefile (unconfirmed).
- **Forms:** ArcGIS outlines required fields and marks them with an asterisk. (confirmed)
- **Shortcuts:** iD opens its shortcut panel with `?`. (confirmed, https://raw.githubusercontent.com/openstreetmap/iD/develop/modules/ui/shortcuts.js) iD's key list (1, 2, 3 for point, line, area; Ctrl+Z; Delete) is unconfirmed.
- **Onboarding:** iD's walkthrough runs seven chapters (welcome, navigation, point, area, line, building, start editing) on sandbox data with saving blocked, progress kept and the user's map restored afterwards. (confirmed, https://github.com/openstreetmap/iD/blob/develop/modules/ui/intro/intro.js) For Map Studio: a skippable three-chapter tour on a throwaway layer.
- Felt, Mapbox Studio, QGIS, Google My Maps, Placemark and Rapid were not fetched.

### Operational cartography

- **Collision and zoom:** MapLibre `symbol-sort-key` (lower places first), `icon-allow-overlap`, `icon-padding`, `text-variable-anchor` and layer `minzoom`. Sort by importance (stations before valves), let labels give way, and set `minzoom` per class. (confirmed, https://maplibre.org/maplibre-style-spec/layers/#symbol)
- **Halos:** label halos in the theme background colour for light and dark basemaps (unconfirmed; the template already uses a 2 px backdrop halo).
- **Basemap and hierarchy:** a muted, low-saturation basemap under the data; cluster only past a count threshold; a collapsible legend in words and glyphs (unconfirmed).

### Touch and mobile

- Terra Draw touch is fully supported for select, point, line and polygon; `pointerDistance` defaults to 40 px. (confirmed, Terra Draw guide)
- 44 px (Apple) and 48 px (Material) target sizes were not fetched; the template already uses 44 px targets.
- Draw the dragged point about 48 px above the finger with a leader line; give the property bottom sheet a handle and a visible close button (unconfirmed).

### Accessibility and ISA-101

- **WCAG 2.5.7 Dragging Movements (AA):** every drag needs a single-pointer, non-drag alternative; keyboard alone does not satisfy it; a text input counts. (confirmed, https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)
- **WCAG 2.5.8 Target Size (Minimum):** 24 by 24 CSS px or equivalent spacing; dense map pins fall under the essential exception. (confirmed, https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) Use 24 px as the minimum for toolbar buttons and handles, and 44 px as the product's touch target.
- **WCAG 1.4.11 Non-text Contrast:** 3:1 for components, their states and needed graphics, in both themes. (confirmed, https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- **Keyboard (2.1.1):** arrow keys nudge a selected point, Tab cycles items, Enter finishes (unconfirmed).
- **ISA-101 high-performance HMI:** a grey normal state; colour, motion and blinking reserved for abnormal conditions; state coded twice (a word plus a shape). (vendor summaries via search snippets, not the standard: https://gojs.net/latest/samples/hmiOperatorScreen, https://www.emersonautomationexperts.com/?p=55403, https://docs.tatsoft.com/display/FX/ISA-101+HMI+Compliance+How-to)
