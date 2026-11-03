---
id: 25
type: story
title: "Esri World Imagery as a satellite option, terms checked"
parent: none
covers: []
after: [14]
refined: false
hitl: true
risk: medium
---

# Esri World Imagery as a satellite option

## Description

A second satellite basemap, `esri-imagery`, drawing Esri's World Imagery tiles (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`) with "Powered by Esri" and the imagery's data attribution, for a project that holds ArcGIS or does not want a Mapbox token. From the gap review of 2026-11-03 (item 12) and the architecture's provider order (AD-12: Esri first where the client already holds ArcGIS). The terms decide the story: Esri's basemap use without an ArcGIS subscription (an API key, the Location Platform's free tier, or none for the legacy tile endpoint) and the attribution it asks for are read and recorded before a line of code; where a key is needed it comes from a secret provider through story 14's proxy, never hard-coded (the gap review's leave-out). The basemap then joins the setup's list like the others (story 11's styles, story 12's gear), and the contrast check runs over an imagery sample.

## Requirements

- Verify: when it is scheduled, the docs name the Esri terms read with the date and the attribution required, the setup offers `esri-imagery` with that attribution shown and never stripped, a keyed endpoint takes its key only from the Gateway, every state mark passes the 3:1 contrast check over an Esri imagery sample in both themes, and the Mapbox logo is absent while Esri is drawn.

## References

- gap review - _bmad-output/initiative-flowmap/gap-review-2026-11-03.md, item 12 (Esri World Imagery; terms to check) and the leave-outs (no hard-coded keys)
- architecture - AD-12 (providers in order: Esri, Mapbox, MapTiler; the provider is a setting)
- story 14 - _bmad-output/backlog/story-custom-tile-source.md (the proxy and the keyed source)
- story 11 - _bmad-output/backlog/story-more-mapbox-basemap-styles.md (the basemap list and attribution work)
- docs - docs/basemaps.md (attribution rules, the Mapbox logo only with Mapbox tiles)

## Notes

- Decision: 2026-11-03 Owner (gap review, "agree, write up the gap review as recommended"): in the backlog, after 0.3.0, after story 14; one story of its own because its gate is a terms reading, not code.
- Constraint: the owner reads and confirms the terms (hitl), as for Mapbox (initiative Notes, 2026-10-26); the story stops at a no.
- Open question: whether the legacy tile endpoint without a key is still allowed for a commercial product, or an API key is required.
