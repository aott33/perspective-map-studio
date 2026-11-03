---
id: 14
type: story
title: "Custom tile source: a project's own tile server as a basemap"
parent: none
covers: []
after: [11]
refined: false
hitl: true
risk: medium
---

# Custom tile source

## Description

The owner asked (2026-11-03) whether a project can add its own tiles. Today the basemaps are a closed list (None, OpenStreetMap, Satellite from Mapbox; R36), story 11 adds more Mapbox styles and reference layers (R29) are overlays, not basemaps, and offline tiles are out for the first version. This story lets a project name its own tile source in the Designer setup and offer it as a basemap: its own GIS server (ArcGIS, GeoServer, WMS), another provider (MapTiler, Esri), or a tile server inside the plant network, which matters most for SCADA networks with no internet access, where today only None works.

Sketch, settled when refined: the setup gains named custom sources, each a raster tile URL template (`{z}/{x}/{y}`, or WMS with `{bbox-epsg-3857}`), its tile size, zoom range and attribution text with links; an API key, when the source needs one, lives in a secret of a Gateway secret provider and is filled in by the Gateway as the Mapbox token is (never in the setup, a view, the log or the browser's storage); the source then appears in the basemap list beside the built-in ones, the setup's default and the viewer's choice rules unchanged (story 12's gear when it lands).

## Requirements

- Verify: when it is scheduled, a project with a custom XYZ source and a WMS source offers both as basemaps with their attribution; a keyed source's key never appears outside the Gateway's answer to the browser; a source inside the dev stack (a local tile server container) draws with no internet; every state mark still passes the 3:1 contrast check over a sample of the source in both themes, or the docs say the project must check its own tiles.

## References

- initiative - R36 (basemaps), the first version's "Out: offline tiles"
- story 11 - _bmad-output/backlog/story-more-mapbox-basemap-styles.md (shares the setup and attribution work; plan the two together)
- story 12 - _bmad-output/backlog/story-viewer-map-settings-behind-a-gear.md (the viewer's basemap choice)
- docs - docs/basemaps.md (the token path), docs/setup.md (the setup's basemaps)

## Notes

- Decision: 2026-11-03 Owner ("yes, add"): in the backlog, after 0.3.0, planned together with story 11.
- Constraint: IT/OT boundary: a browser on the control network reaching an outside tile server crosses network zones, which the project's rules allow only with explicit authorization; the docs say so and the setup form shows the source's host.
- Constraint: each source's licence and attribution are the project's responsibility; Map Studio shows the attribution the setup gives and never strips it.
- Open question: Whether the Gateway proxies custom tiles (one host for the browser, the key never leaves the Gateway, the plant browser needs no route out) or the browser fetches them directly (simpler, the Mapbox path today).
- Open question: Vector tile sources (a style URL) as well as raster, or raster only at first.
