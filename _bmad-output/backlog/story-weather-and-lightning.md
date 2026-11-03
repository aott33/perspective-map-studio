---
id: 16
type: story
title: "Weather radar overlay and a lightning-within-range state on sites"
parent: none
covers: []
after: [14]
refined: false
hitl: true
risk: medium
---

# Weather radar overlay and a lightning-within-range state on sites

## Description

Storm season on a field map: a raster weather radar drawn over the basemap, and a site that lightning is near shown as such, so a dispatcher holds crews back from a pad. From the gap review of 2026-11-03 (item 6): DTN WeatherOps draws lightning range rings per asset and Lygos puts radar on a SCADA map. Two parts, each small on top of what exists:

- **Radar overlay.** A raster tile source of a weather provider (the project's own subscription: DTN, RainViewer, a national service's WMS) added as an `overlay` source with an opacity through story 14's sources and proxy, toggled in the Legend or the gear; its timestamp shown beside the attribution so an old frame is never read as now; refreshed on the provider's interval through the Gateway cache. No animation loop in the first cut.
- **Lightning within X km.** Not computed by Map Studio: the project feeds it as a value. A site's kind setup names a tag (for example `{asset.path}/Weather/LightningKm`, written by the project's own weather integration) and a style rule's band maps "within 15 km" to the `attention` preset with the word "Lightning" (R40, no new colour); with the gear's Show by state (story 12) a dispatcher narrows the map to the sites under the storm. A later cut may draw a range ring of the band's radius around such a site, an engineering review item (ER-27), since a ring is a new shape.

## Requirements

- Verify: when it is scheduled, a radar WMS or XYZ source from the dev stack draws over the basemap at its opacity with its timestamp beside the attribution and toggles off from the Legend or the gear; a site whose lightning tag falls inside the band draws the `attention` preset with the word and counts in Needs you's attention count where the setup offers it; with the overlay on, every state mark still passes the 3:1 contrast check over a radar sample in both themes.

## References

- gap review - _bmad-output/initiative-flowmap/gap-review-2026-11-03.md, item 6 (DTN WeatherOps, Lygos)
- story 14 - _bmad-output/backlog/story-custom-tile-source.md (the overlay role, opacity and the Gateway proxy this rides on)
- story 12 - _bmad-output/backlog/story-viewer-map-settings-behind-a-gear.md (overlay toggles, Show by state)
- initiative - R40 (style rules and presets: the band is an ordinary style rule), R43 (Needs you)
- architecture - AD-11 (look and colour), AD-12 (providers are settings)

## Notes

- Decision: 2026-11-03 Owner (gap review, "agree, write up the gap review as recommended"): in the backlog, after 0.3.0, after story 14.
- Constraint: alarm presentation (ER-27): lightning is a style state, never an alarm glyph; the radar is context that a viewer may hide, never a state mark; a range ring, if added, goes to engineering review first.
- Constraint: the weather provider is the project's subscription and terms; Map Studio ships no provider key and no default provider.
- Open question: whether a radar frame timestamp older than the provider's interval should fade the overlay or only say so in words.
