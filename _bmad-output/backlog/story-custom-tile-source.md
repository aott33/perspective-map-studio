---
id: 14
type: story
title: "Custom tile sources through a Gateway tile proxy with a disk cache, as a basemap or an overlay"
parent: none
covers: []
after: [11]
refined: false
hitl: true
risk: medium
---

# Custom tile sources through a Gateway tile proxy

## Description

The owner asked (2026-11-03) whether a project can add its own tiles. Today the basemaps are a closed list (None, OpenStreetMap, Satellite from Mapbox; R36), story 11 adds more Mapbox styles and reference layers (R29) are overlays, not basemaps, and offline tiles are out for the first version. This story lets a project name its own tile sources in the Designer setup: its own GIS server (ArcGIS, GeoServer, WMS), another provider (MapTiler, Esri), or a tile server inside the plant network, which matters most for SCADA networks with no internet access, where today only None works.

The gap review of 2026-11-03 (item 3, the Kymera Map Panel module's `ProxyServlet` at `/system/mpproxy`, its per-provider config page with an Endpoint `{z}/{x}/{y}` and an "Allow polling" switch, tiles on disk, `clearGatewayDiskCache()` and the cached-tile count on the Gateway status page) answers the open question of how the tiles reach the browser: **the Gateway proxies them.** A browser on the control network then reaches one host, its own Gateway; a source's key never leaves the Gateway; OpenStreetMap's light-use policy is met by one cache for every session instead of a fetch per browser; and a site that loses its route out keeps the tiles it has seen.

Sketch, settled when refined:

- **Sources.** The setup gains named sources, each a raster tile URL template (`{z}/{x}/{y}`, or WMS with `{bbox-epsg-3857}`), its tile size, zoom range and attribution text with links; an API key, when the source needs one, lives in a secret of a Gateway secret provider and is added by the Gateway when it fetches, never by the browser (so the key never appears in a tile URL the browser sees, unlike the Mapbox path today).
- **Role (gap review item 8).** Each source has a role: `basemap` (it appears in the basemap list beside the built-in ones, the setup's default and the viewer's choice rules unchanged, story 12's gear when it lands) or `overlay` (drawn above the basemap and under the map items at an `opacity` the setup gives, 0 to 1, toggled in the Legend or the gear like Lines and Names): a weather radar, a PLSS land grid, a GIS server's right-of-way layer, a regulator's ArcGIS REST or WMS service. Live feature-service URLs (vector features rather than tiles) wait for reference layers (story 1).
- **The proxy.** The Gateway serves `/res/mapstudio/tiles/<source>/{z}/{x}/{y}` (the module's servlet mount) and fetches from the source on a miss; the browser only ever asks the Gateway. The built-in OpenStreetMap and Satellite sources may go through the same proxy by a setup switch, so one allow-listed host serves everything (the Mapbox token then also stays on the Gateway).
- **The disk cache.** Tiles are kept on the Gateway's disk under its data folder, bounded by a size the setup gives (default 2 GB) and evicted oldest-first; a tile's age is kept for the provider's cache rules. Nothing is pre-fetched in bulk (OpenStreetMap's policy forbids it; the cache holds what sessions asked for).
- **Cached-only mode.** A source's "fetch from the source" switch, on by default; off, the Gateway serves cached tiles only and answers a miss with a blank tile, and the basemap panel says so in words ("Showing cached tiles only"), so a control network with no route out, or a provider the site must not poll, still shows what it has.
- **Script and status.** `system.mapstudio.clearTileCache(project, source=None)` empties the cache; the Gateway status page (the module's section) shows per source the cached tile count, the cache size and the cached-only state; both in the versioned contract.

## Requirements

- Verify: when it is scheduled, a project with a custom XYZ source and a WMS source offers both as basemaps with their attribution, and an overlay source draws above the basemap at its opacity and toggles in the Legend; every tile request from the browser goes to the Gateway's own host (checked in the e2e suite's request log) and a keyed source's key never appears in any URL, the log, the browser's storage or the Gateway's reply; a source inside the dev stack (a local tile server container) draws with no internet; with fetching switched off the map shows cached tiles, blank elsewhere, and says so in words; `clearTileCache` empties the folder and the status page's count goes to zero; the cache never grows past its bound; every state mark still passes the 3:1 contrast check over a sample of each basemap source in both themes, or the docs say the project must check its own tiles.

## References

- initiative - R36 (basemaps), the first version's "Out: offline tiles"; the Decision of 2026-11-03 (gap review)
- gap review - _bmad-output/initiative-flowmap/gap-review-2026-11-03.md, items 3 and 8 (the Kymera Map Panel module's proxy and cache, its `addLayer(opacity)`; weather, PLSS and GIS server overlays)
- architecture - _bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md, AD-12 (basemaps and tokens: the provider is a setting, tokens from the secret store)
- story 11 - _bmad-output/backlog/story-more-mapbox-basemap-styles.md (shares the setup and attribution work; plan the two together)
- story 12 - _bmad-output/backlog/story-viewer-map-settings-behind-a-gear.md (the viewer's basemap choice and overlay toggles)
- story 1 - _bmad-output/backlog/story-reference-layers.md (vector reference layers and live feature services, not tiles)
- story 16 - _bmad-output/backlog/story-weather-and-lightning.md (the radar overlay rides on the overlay role)
- docs - docs/basemaps.md (the token path, OpenStreetMap's tile usage policy), docs/setup.md (the setup's basemaps)

## Notes

- Decision: 2026-11-03 Owner ("yes, add"): in the backlog, after 0.3.0, planned together with story 11.
- Decision: 2026-11-03 Owner (gap review, "agree, write up the gap review as recommended"): the Gateway proxies custom tiles through a bounded disk cache with a cached-only mode, `system.mapstudio.clearTileCache` and the counts on the status page (item 3), and sources have a role, basemap or overlay, and an opacity (item 8). This answers the earlier open question in favour of the proxy; the direct-fetch path stays only for the built-in sources until the setup switch moves them through the proxy. The cache is not the first version's "offline tiles" (no bulk pre-fetch; it holds what was seen), so the initiative's Boundaries stand.
- Constraint: IT/OT boundary: the Gateway reaching an outside tile server crosses network zones, which the project's rules allow only with explicit authorization; the docs say so, the setup form shows each source's host, and a proxy that reaches out is an outbound allow-list entry for the Gateway, never for every browser.
- Constraint: each source's licence and attribution are the project's responsibility; Map Studio shows the attribution the setup gives and never strips it; a provider's terms on caching (Mapbox's Product Terms, OpenStreetMap's policy) are checked before its tiles go through the cache, and the docs name the ones read.
- Constraint: credentials (initiative Constraints, prd NFR-5): a source's key comes only from a secret provider and is used only on the Gateway; the browser's tile URL carries no key and no session token beyond Perspective's own session.
- Open question: Vector tile sources (a style URL) as well as raster, or raster only at first; a vector source through the proxy needs its style, sprites and glyphs proxied too.
- Open question: Who may clear the cache (the scripting API trusts its caller as `applyEdits` does; the status page is the Gateway's own permissions) and whether an editor sees the cache from the Layers rail.
