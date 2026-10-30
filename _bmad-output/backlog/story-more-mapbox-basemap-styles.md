---
id: 11
type: story
title: "More Mapbox basemap styles (light, dark, streets, outdoors, satellite streets, a project's own style)"
parent: none
covers: []
after: []
refined: false
hitl: true
risk: medium
---

# More Mapbox basemap styles

## Description

The owner asked (2026-10-30, after Satellite worked locally) whether the map can offer Mapbox's other styles. Today the setup offers None, OpenStreetMap and Satellite (`mapbox.satellite` raster tiles), and the Mapbox vector style option (`mapbox`) is accepted but not drawn (initiative R36: deferred, not dropped). Mapbox's own styles (Streets, Outdoors, Light, Dark, Satellite Streets, Navigation) and a project's own Studio style (`mapbox://styles/<user>/<id>`) could be added in one of two ways:

- Raster tiles of a style (Mapbox's Static Tiles API, `styles/v1/<owner>/<style>/tiles/512/{z}/{x}/{y}@2x`): the same path Satellite takes today (the Gateway hands the browser a tile URL template carrying the project's public token), so Map Studio's own layers, labels and glyphs stay as they are. Least work; the style's labels are part of the image (they cannot give way to Map Studio's labels).
- The vector style itself (R36's deferred option): MapLibre loads the style and Map Studio's layers are added on top. Crisper and the style's labels collide properly, but the style's sprites, glyphs and layer order must be merged with Map Studio's (its own glyph source, its halo and casing layers), and Mapbox's vector styles in MapLibre need care with `mapbox://` URLs.

Light and Dark matter most for an operator map: a quiet grey base like the mockups, and one that matches Perspective's dark theme.

## Requirements

- Verify: when it is scheduled, the setup offers each chosen style with its attribution, the project's default basemap opens (owner decision 2026-10-29: the basemap is a project setting by default), every state mark still passes the 3:1 contrast check over each new style in both themes (entry 12's check), and the token stays public, restricted and never logged.

## References

- initiative - R36 (Mapbox vector style deferred, not dropped)
- docs - docs/basemaps.md (today's basemaps, the token path)
- review - docs/review-er27.md and e2e/lib/contrast.mjs (the contrast check to rerun per style)

## Notes

- Open question: which styles to offer first (recommended: Light and Dark, then Satellite Streets), and whether a project may name its own Studio style.
- Open question: raster tiles of a style (simple, labels baked in) or the vector style (R36; better labels, more work).
- Constraint: Mapbox's terms for client sites are still the owner's to confirm (epic-viewing Notes, release 0.3.0); every new style rides on the same answer.
