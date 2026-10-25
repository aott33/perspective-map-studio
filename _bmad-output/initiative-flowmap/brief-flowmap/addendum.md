# Addendum - Flow Map brief

Detail that belongs in the PRD or architecture, or that earned a place but does not fit the brief.

## Current state: the built-in Perspective Map (Ignition 8.3)

Source: IA docs, Perspective Map component page (read 2026-10-25). Labels: **[IA docs]**.

- Built on Leaflet. Props-only configuration: `init` (center, zoom), `zoom`, `location`, `maxBounds`, `customControls` (embedded views in a corner). [IA docs]
- Layers: raster `tile` (OSM template or WMS) and `image`; vector `polygon`, `polyline`, `rectangle`, `circle` with stroke and fill (`color`, `weight`, `opacity`, `dashArray`, `dashOffset`); UI `marker` (icon `path`, `color`, `size`, `rotate`, `tooltip`, `popup`), `popup`, embedded `view`; `geoJSON` FeatureCollection with `styleOptions`. [IA docs]
- The docs say the `geoJSON` prop is meant to be fed by a binding and transform, not edited by hand. [IA docs]
- No documented way for an end user to draw, move or delete shapes or markers on the map. No clustering. No animation beyond zoom and fade. [IA docs, by absence; verify on a live Gateway]
- Implication: today every add, move or remove of a map item means editing props arrays in the Designer or writing a binding over a table. This is the ease-of-use gap the user names.

## Comparable: Nader Chinichian's Map Administration Tool

Sources: LinkedIn post by Nader Chinichian (posted about 2024, "Ignition Perspective Map Administration Tool", promoted as a Perspective application to administer a GeoSCADA system; 152 reactions, 14 comments); YouTube video of the same title on his channel (title only; the page could not be fetched from this session); LinkedIn DM to the user, 2024-11-01.

- Pure Perspective project, not a module. [DM]
- Two parts: an admin project and an end-user project. [DM]
- Includes many icons, CSS classes, widgets and more. [DM]
- Sold as resources to system integrators worldwide. [DM]
- Price about 25,000 USD. [user, not seen in a source]
- Feature list from the video: not yet captured. Open item for the user.

## Current state: the template's map editor (ign-scada-template, PV-3 phase 2)

Source: `ign-scada-template` `docs/map-editor.md` and `docs/map.md` section 4 (read 2026-10-25, commit 26bd290). Status there: built, unverified on a Gateway.

- **Authority model.** The registry in git (`assets/`) is the source of truth; `prov` is the authority; the Gateway never writes the registry or git. A drawing is a draft in PostgreSQL (`map_draft`, `map_draft_event`), exported as a change set JSON (`upstream.mapdraft/1`) that a person imports with `prov map import`, reviews in a pull request and applies with `prov plan` and `prov apply`.
- **Steps it supports.** `add-pad`, `move-pad`, `add-pipeline`, `replace-points`, `retire-pipeline`. Nothing for areas (geofences, regions), no delete of a site, no vertex insert or drag.
- **Guards.** Roles (engineer, integrator) re-checked on the Gateway; hash-based conflict refusal; stale-draft refusal against the `_Model/Map` hash; audit row per write; one-year purge of discarded drafts. Bulk and as-built geometry go in through `prov map import-geojson`.
- **Interaction.** Built on the built-in Leaflet Map: three tool chips (Add pipeline, Add site, Move site), one tap per vertex, snap to a site within 20 px computed by a Gateway script call, popup forms for line and site attributes, a floating 376 px tool panel. Editor hidden below 768 px ("Open the editor on a laptop").
- **Where the built-in Map fought back** [live 8.3.9 per that doc]: array items get no schema defaults (a marker without `popup` crashes the component); `props.style` never reaches the Leaflet container, so a project stylesheet patches Leaflet's hard-coded colours; no `zIndexOffset`, so stacking needs CSS hacks; custom control views mount at default size and need `!important` height fixes; a marker click also fires `onMapClick`; `onVectorClick` has no lat or lng.
- **Implication for the module.** The module should emit edits as events and leave storage and approval to the host. In the template that means the module's edits feed the existing draft, change set and `prov` path; another project could write straight to its own database. This keeps the idea doc's "props in, events out" boundary while adding editing.

## Analysis: candidate map objects, icons and editing tools

Source: research subagent, 2026-10-25. Most licence and maintenance claims are **unconfirmed** (from memory, or the fetch returned no dates); only those marked (fetched) were read from the source. Verify before any dependency decision.

### Object catalogue (CORE = oil and gas first release)

- **Point, generic:** site or facility (CORE), well pad (CORE), building, generic asset, alarm or event marker, note or label, inspection or photo point, sensor, RTU or comms tower (CORE), weather station.
- **Point, O&G upstream:** wellhead (CORE), tank battery (CORE), separator or test facility, flare or vent, SWD well, gathering header.
- **Point, O&G midstream:** compressor station (CORE), booster station (CORE), meter or custody transfer station (CORE), pig launcher or receiver (CORE), block or line valve (CORE), tap or tie-in (CORE, the split point for pipelines), regulator station, CP test point, pipeline marker, processing plant, terminal.
- **Point, other industries:** water (pump or lift station, plant, reservoir, hydrant, valve, manhole, meter, well, outfall); electric (substation, transformer, recloser, switch, capacitor bank, pole, meter, EV charger, DER site); gas distribution (district regulator, city gate, valve, service meter, odorant point, CP rectifier); fleet (vehicle with heading and fix age, trailer, crew, depot; needs a moving-point mode with trails and staleness).
- **Line:** pipeline segment split at taps (CORE), lateral or tap branch (CORE), lease road (CORE), power or fibre to site, ROW centreline; water mains and sewers; electric feeders; gas mains and services; routes, planned routes, tracks, measurement lines.
- **Area:** geofence (CORE), region or zone (CORE), site fence or footprint (CORE), lease or unit boundary, ROW or easement, HCA or class-location zone, exclusion zone; pressure zones, DMAs, service territories, outage polygons, depot yards.

### Properties

- **Common:** stable id (never reused), name, kind (registry key), GeoJSON geometry, state (enum with words and glyph, never colour alone), quality or staleness, alarm summary, tag path or path template, link target (page and params, or popup view), parent id, layer or group, labels, notes, visible zoom range, z-order, label template, created, modified, author.
- **Point:** icon key, rotation or heading, anchor, size class, badge slots.
- **Line:** from and to node ids, computed length, direction (including unknown and bidirectional), parent line id and split sequence, label along the path.
- **Pipeline:** diameter, product, material, MAOP, service status, install year, segment id.
- **Area:** computed area, category, fill pattern (not only colour), containment rule, time window.
- **Design note:** keep kind-specific fields in a kind registry so another industry adds kinds without code changes.

### Icons

- No single open set covers pump, valve, tank, compressor, separator, pig launcher or meter station. Plan a custom set in one style (24 px grid, 1.5 to 2 px stroke) seeded from CC0 or MIT sets, shipped as an SVG sprite keyed by kind.
- Candidate seeds: Maki (CC0, fetched; built for maps at 15 px, thin industrial coverage), Temaki (CC0, fetched; 557 icons, complements Maki, industrial glyphs unconfirmed), Tabler (MIT, fetched; 6,238 icons, consistent stroke style), Lucide (ISC, unconfirmed), Phosphor (MIT, unconfirmed), Material Symbols (Apache 2.0, unconfirmed). Font Awesome Free icons need CC BY attribution (unconfirmed).
- The template already generates its icons from OpenBridge 1.0.1 under an AGPL window (`docs/theme.md`); the module's set must not inherit that licence.
- Standards (unconfirmed): ISA-5.1 and ISO 14617 are P&ID symbols, not map symbology; PODS and APDM are data models with no icon set; ISA-101 gives the principles (grey base, colour for abnormal only, redundant shape or text). Suggestion: follow ISA-101 principles, offer P&ID-style valve and pump variants.

### Editing libraries

- **Terra Draw:** MIT, adapters for MapLibre GL JS and others (fetched). Best candidate for drawing on MapLibre; select, vertex edit and snapping modes unconfirmed.
- **nebula.gl:** treated as unmaintained (Snyk "Inactive", page date unknown); `editable-layers` in deck.gl-community (MIT) is the fork to evaluate. Unconfirmed for 2026.
- **Mapbox GL Draw:** ISC, built for mapbox-gl-js (fetched); MapLibre compatibility and snapping unconfirmed.
- **Leaflet-Geoman:** MIT core with a paid Pro tier, Leaflet only (fetched); snapping, split, cut, drag.
- **Patterns to copy (Esri editor, QGIS):** snapping to nodes and vertices; split a line at a point (two segments inheriting attributes, parent id plus sequence); bulk import GeoJSON, then CSV, KML, shapefile; multi-select with a shared attribute panel showing mixed values; undo and redo; validation before save (self-intersection, orphan nodes, duplicate ids).

## Parked for the PRD and architecture

From `docs/idea.md`, still valid but too detailed for the brief:

- **Module shape:** Gateway hook (Java 17) registering the component and its props schema; client bundle (TypeScript, React) with MapLibre GL JS and deck.gl; optional Designer part. Renderer as a swappable layer inside the bundle.
- **Data contract** (to be reworked for editing): `nodes`, `edges`, two-way `selected`, `basemap`, `options`, and events. The idea doc's events (`onSelect`, `onOpen`, `onViewport`) grow edit events. GeoJSON as the interchange format. One `runScript` binding per page, never a tag subscription per item.
- **Supply chain:** signed `.modl` from a GitHub release, pinned by SHA-256 and certificate fingerprint in the host's `modules/modules.lock.json`, baked into the private Gateway image; never a `.modl` in git. Signing key custody and rotation open.
- **Risks to carry into architecture:** toolchain weight (Java 17, Gradle with IA's module plugin, Node, signing); Perspective client package coupling across 8.3.x upgrades; Designer props editor for arrays of objects; basemap privacy (tiles leave the site, Mapbox token on the client); maintenance of a second product.
- **Naming from the idea doc, to update for Map Studio:** module id `com.aoindustrial.perspective.flowmap`, npm package `@aoindustrial/perspective-flowmap`.
- **Alarm presentation:** colour, glyphs and motion that mean state go through the template's engineering review (ER-27, `docs/ux.md` section 11). Matters most when flow arrives.
- **Edge Gateways:** out; the template's Edge profile keeps the built-in Map.
- **MapWeave:** commercial, ruled out by the template's no-licence-fee rule (UX-36); a possible second renderer only if its analytics ever earn the licence.

## Research: map UI best practices

Source: research subagent, 2026-10-25. Fetch coverage was partial; "confirmed" means the fetched source said it, everything else is unconfirmed background knowledge and is a recommendation, not a citation.

### Map editing

- **Modes:** Terra Draw has one `select` mode plus per-geometry draw modes; `editable: true` lets features be dragged without switching modes. (confirmed, https://raw.githubusercontent.com/JamesLMilner/terra-draw/main/guides/4.MODES.md)
- **Vertices:** Terra Draw select flags `coordinates.midpoints`, `coordinates.draggable`, `coordinates.deletable`; ArcGIS Map Viewer shows nodes on a selected line and new midpoint nodes as you drag. (confirmed, Terra Draw guide; https://doc.arcgis.com/en/arcgis-online/manage-data/edit-features-mv.htm)
- **Snapping:** Terra Draw `toCoordinate`, `toLine`, `toFeature` (with a filter), `toDegree`, and `showSnappingPoint`. ArcGIS has one "Enable snapping" toggle with per-layer snapping. Show the snap indicator always; offer a visible toggle. (confirmed)
- **Finish and undo:** ArcGIS: click to add nodes, double-click to finish; undo and redo step through vertices while drawing; unsaved features listed. (confirmed) Terra Draw finish keys not confirmed. Support double-click, Enter, a Finish button, Esc to cancel, Backspace to remove the last vertex.
- **Validation:** Terra Draw `validation(feature, {updateType: finish | commit | provisional})` with `ValidateMinAreaSquareMeters`, `ValidateMaxAreaSquareMeters`, `ValidateNotSelfIntersecting`. Validate on `provisional` to warn while drawing. (confirmed)
- **Delete and save:** ArcGIS deletes are permanent and bulk deletes need a second confirmation. (confirmed) Map Studio keeps its own undo stack instead, so deletes are undoable.
- **Multi-select:** ArcGIS selects by point, rectangle or lasso with replace, add and remove; attribute bulk edit capped at 500 features; one feature's geometry at a time. (confirmed) Bulk edit properties only, not geometry; show "N selected" and mixed-value placeholders (placeholders unconfirmed).
- **Forms:** ArcGIS outlines required fields and marks them with an asterisk. (confirmed)
- **Shortcuts:** iD opens its shortcut panel with `?`. (confirmed, https://raw.githubusercontent.com/openstreetmap/iD/develop/modules/ui/shortcuts.js) iD's key list (1, 2, 3 for point, line, area; Ctrl+Z; Delete) unconfirmed.
- **Onboarding:** iD's walkthrough runs seven chapters (welcome, navigation, point, area, line, building, start editing) on sandbox data with saving blocked, progress kept, and the user's map restored afterwards. (confirmed, https://github.com/openstreetmap/iD/blob/develop/modules/ui/intro/intro.js) For Map Studio: a skippable three-chapter tour on a throwaway layer; an empty state with "Draw your first site" and "Import CSV" (recommendation).
- Felt, Mapbox Studio, QGIS, Google My Maps, Placemark and Rapid were not fetched.

### Operational cartography

- **Collision and zoom:** MapLibre `symbol-sort-key` (lower places first), `icon-allow-overlap`, `icon-padding`, `text-variable-anchor`, layer `minzoom`. Sort by importance (stations before valves), let labels give way, set `minzoom` per class. (confirmed, https://maplibre.org/maplibre-style-spec/layers/#symbol)
- **Halos:** label halos in the theme background colour for light and dark basemaps (unconfirmed; the template already does this with a 2 px backdrop halo).
- **Basemap and hierarchy:** muted, low-saturation basemap under the data; cluster only past a count threshold; collapsible legend in words and glyphs (unconfirmed recommendations).
- **Selection:** a ring or thicker outline plus a label, not only a colour shift.

### Touch and mobile

- Terra Draw touch is fully supported for select, point, line and polygon; `pointerDistance` defaults to 40 px. (confirmed, Terra Draw guide)
- 44 px (Apple) and 48 px (Material) target sizes not fetched this session; the template already uses 44 px targets.
- Recommendations (unconfirmed): long-press to pick up a point; draw the dragged point about 48 px above the finger with a leader line; an Undo or Confirm bar after the drop; properties in a bottom sheet with a handle and a visible close button.

### Accessibility and ISA-101

- **WCAG 2.5.7 Dragging Movements (AA):** every drag needs a single-pointer non-drag alternative; keyboard alone does not satisfy it; a text input counts. (confirmed, https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)
- **WCAG 2.5.8 Target Size (Minimum):** 24 by 24 CSS px or spacing; dense map pins are named under the essential exception. (confirmed, https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) Use 24 px minimum for toolbar buttons and handles, 44 px as the product's touch target.
- **WCAG 1.4.11 Non-text Contrast:** 3:1 for components, their states and needed graphics, in both themes. (confirmed, https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- **Keyboard (2.1.1):** arrow keys nudge a selected point, Tab cycles items, Enter finishes (unconfirmed).
- **ISA-101 high-performance HMI:** grey normal state, colour, motion and blink reserved for abnormal, state coded twice (word plus shape). (vendor summaries via search snippets, not the standard: https://gojs.net/latest/samples/hmiOperatorScreen, https://www.emersonautomationexperts.com/?p=55403, https://docs.tatsoft.com/display/FX/ISA-101+HMI+Compliance+How-to)

### Performance perception

- Unconfirmed recommendations: keep drawing state in the browser; update the map source locally on pointer move (throttled to animation frames); one batched event on finish or drop; optimistic UI that rolls back with a message on failure; editing features in a separate source from the display layer.

### Ranked for the first version

1. Current mode shown in words and a glyph in a persistent toolbar; Esc returns to Select.
2. All editing in the browser with one event per finished edit; no Gateway call per click.
3. A non-drag alternative for every drag (WCAG 2.5.7).
4. Vertex and midpoint handles on the selected item, a visible snap indicator and a snap toggle.
5. Finish by double-click, Enter or a Finish button; Esc cancels; Backspace removes the last vertex.
6. Full undo and redo covering moves, inserts, deletes and property edits.
7. Validation while drawing, in plain words beside the item.
8. A skippable three-step tour and an empty state with "Draw your first site" and "Import CSV".
9. Neutral grey items, glyph-plus-word state, selection by ring and label, 3:1 contrast in both themes, label halos.
10. Phone: 44 px targets, long-press pick up, offset drag, an Undo bar after the drop, a bottom sheet for properties.
