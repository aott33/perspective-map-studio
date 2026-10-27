---
id: 2
type: story
title: "Per-kind parameters for the custom popup view and the popup link"
parent: none
covers: []
after: []
refined: false
hitl: false
risk: medium
---

# Per-kind parameters for the custom popup view and the popup link

## Description

In a kind setup, a map editor maps map item values into extra parameters for the custom popup view and the popup link: for example view `Popups/PadDetails` with params `{site: "{item.name}", tagPath: "{asset.path}", area: "Mesa"}` and link `/pad/{item.name}`. The view already receives the whole map item object as `mapItem` (AD-7); named parameters let a project reuse existing views without reading `mapItem`. Raised by the owner, 2026-10-27; an idea to discuss, not decided or scheduled.

## Requirements

- Verify: when it is scheduled, a kind setup with view params and a link template opens the named view with each param filled from the clicked map item, and the link resolves the same placeholders.

## References

- architecture - _bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md, AD-7 (custom popup view, `mapItem`, link placeholders) and AD-16 (kind setup schema)
- story - _bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/tickets.toml, entry 9 (the stored kind setup shape, 2.9)
- epic - _bmad-output/initiative-flowmap/tickets/epic-viewing/epic-viewing.md (custom popup view and popup links)
- initiative - _bmad-output/initiative-flowmap/initiative-flowmap.md, R8, R15, R39

## Notes

- Open question: Placeholder names: AD-7 uses dotted paths into the map item object (`{asset.id}`, `{properties.route}`); the example's `{item.name}` and `{asset.path}` need one agreed vocabulary for view params and links.
- Open question: Whether the params are part of the kind setup schema in 2.9 now (a stored-shape change while it is cheap) or added later as a minor schema version (NFR-8).
- Open question: Whether a map item override may change the params, like any other part of the kind setup (R16).
- Open question: Literal values beside placeholders (`area: "Mesa"`), and what a placeholder with no value does to a view param (R8 hides the link icon).
