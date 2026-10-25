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
