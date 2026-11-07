# Gap review, 2026-11-03

What Map Studio 0.3.0 lacks against comparable products, ranked, and where each item went in the plan. Approved by the owner on 2026-11-03 ("agree, write up the gap review as recommended"); the placement is recorded as a Decision of that date in `initiative-flowmap.md` and in each epic and story named below.

## What was reviewed

Three agents' findings, combined by the coordinator, from:

- The Kymera Map Panel Module User Guide (Vision, 94 pages) and the Kymera map-panel `.modl` (Vision, built for Ignition 8.1, id `com.kymerasystems.mappanel`, 8.1 internal-database Gateway config; it may not load on 8.3).
- A web survey of comparable products: IA's built-in Perspective Map, a MapLibre-based Perspective map component, VTScada, Geo SCADA, Esri Field Maps, Workforce, Velocity and Pipeline Referencing, AVEVA PI Integrator for Esri, CygNet, Wellsite Navigator, IFS Field Operator, DTN WeatherOps, Lygos, Honeywell and Blackline safety maps, KROHNE PipePatrol, Atmos Pig, DNV, WellDatabase and SLB OFM.

Against Map Studio 0.3.0 as released: the one project map with icons, lines with instruments, popups, search, the legend, Needs you, basemaps None, OpenStreetMap and Satellite, the scripting API and the versioned contract (docs/contract.md).

## The ranked gaps and where each went

| Rank | Gap | Source products | Weight | Where it went |
| --- | --- | --- | --- | --- |
| 1 | Map events and selection to the host view: a bidirectional `selectedItem` prop, a read-only `viewport`, events `onItemSelected` (with the AD-7 map item), `onViewportChanged`, `onPopupOpen`, `onPopupClose` | Kymera onPointClicked, onPointEntered, map bounds, setGpsLocation; IA Perspective Map events | Major, a small contract change | R48, R49; epic-editing (id 4) |
| 2 | Where am I and take me there: a "you are here" dot with heading from the session's geolocation props, Locate me, a Directions button in the popup and the sheet, Nearest to me | IA Map location.enabled; Wellsite Navigator; IFS Field Operator; Esri Field Maps | Major, phone-first | R50, R51, R52; epic-editing (id 4) |
| 3 | A Gateway tile proxy with a bounded disk cache, cached-only mode, `system.mapstudio.clearTileCache`, counts on the status page | Kymera ProxyServlet `/system/mpproxy`, Allow polling, clearGatewayDiskCache | Major for IT/OT | backlog story 14 (its open question answered: the Gateway proxies) |
| 4 | Transient items from live data: a `dynamicItems` prop and `system.mapstudio.setDynamicItems`, drawn above the map items, never stored, counted in Needs you when they carry a state | Kymera dataset-bound points and shapes; Esri Workforce; vehicle and pig tracking; ArcGIS Velocity geofences | Major | R53, R54, R55; epic-live-field (id 8) |
| 5 | Pipeline linear referencing: a station origin and unit per line, Go to station, a script-placed marker at a distance, a distance profile strip | Esri Pipeline Referencing; KROHNE PipePatrol; Atmos Pig; DNV | Major for midstream | R56, R57, R58, R59; epic-live-field (id 8) |
| 6 | Weather radar overlay and a lightning-within-range state | DTN WeatherOps; Lygos | Nice (major in storm season) | backlog story 16 |
| 7 | Trend sparklines in the popup, loaded on open | AVEVA PI Integrator; WellDatabase; SLB OFM | Nice | backlog story 17 |
| 8 | Overlay layers with a role and an opacity | Kymera addLayer(opacity); weather, PLSS, GIS right-of-way, regulators' ArcGIS REST and WMS | Nice | backlog story 14 (with item 3); live feature services wait for story 1 |
| 9 | Map lock and zoom range: `maxBounds`, `zoomRange` | Kymera pinned bounds, maxZoom | Nice, small | backlog story 18 |
| 10 | Spatial queries from script: `itemsWithin`, `locate` | Kymera containsPoint | Nice | backlog story 19 |
| 11 | A live view at a map location: a kind's `markerView` as a DOM marker from a zoom, capped | Kymera Data Templates | Nice | backlog story 20 |
| 12 | Smaller: upstream and downstream trace; project-supplied icons; field notes and photos; a measure tool; Esri World Imagery; size-by-KPI rings; hover tooltip | Repsol on ArcGIS; every surveyed product (icons); Wellsite Navigator and Field Maps (notes, photos); Field Maps and a Perspective map component (measure); Esri (imagery); WellDatabase, OFM and Esri (rings, tooltips) | Niche to nice | backlog stories 21 (trace), 22 (icons), 23 (notes and photos), 24 (measure), 25 (Esri imagery), 26 (rings and tooltip, grouped) |

Item 12 was split where the pieces are independent (each is its own store, loader or tool) and the two tiniest, the ring and the tooltip, were grouped as one icon-presentation story because they share one engineering review.

epic-live-field is built after epic-editing, beside epic-import-export (row after it in `tickets/tickets.toml`, no dependency between them): it needs epic-viewing's map and epic-editing for the one field that writes a line's station origin and unit; epic-import-export keeps the earlier row as first-version PRD scope. epic-phone and the template cut-over do not wait on it.

## Strengths

Where Map Studio is ahead of the products reviewed, to keep:

- Reviewed alarm presentation (ER-27): glyphs, hollow or solid by acknowledgement, no hue on a normal field, nothing blinks.
- One Gateway subscription per project with batched values (AD-6), never a tag subscription per map item per session.
- Instruments on lines with per-segment state and an ordered line popup (R41, AD-19).
- Browser editing with undo, Recent changes with Revert and an edit record (R20, R45, AD-2, AD-3).
- Kind setups relative to an asset base path, so one setup serves every item of a kind (R15, AD-16).
- Phone-first bottom sheets and WCAG 2.2 (R31, R38).

## Left out

Recorded as decisions in `initiative-flowmap.md` (2026-11-03):

- Google Maps tiles: Google's terms allow its map tiles only through Google's own SDK, never in another renderer such as MapLibre.
- Hard-coded provider keys: every key stays in a secret provider and is used by the Gateway (AD-12, the Credentials rule); story 25's Esri option follows the same path.
- Free colour strings: every look is a preset from the reviewed list (R40, ER-27); a project colours nothing itself.
- 3D terrain: cosmetic for an operator map, revisited only with a need.
