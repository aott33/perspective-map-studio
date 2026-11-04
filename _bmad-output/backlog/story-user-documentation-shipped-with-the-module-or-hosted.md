---
id: 27
type: story
title: "User documentation for Map Studio, shipped with the module or hosted on aoindustrial"
parent: none
covers: []
after: []
refined: false
hitl: true
risk: low
---

# User documentation for Map Studio, shipped with the module or hosted on aoindustrial

## Description

Documentation written for the people who use Map Studio, not for contributors: an integrator setting a project up (the Designer's Map Studio Setup, the kinds and assets functions, the map store, basemaps and the token), a map editor laying a field out and writing kind setups, an operator reading the map and fixing a pin from a phone, and a page builder using the props, events and the scripting API. Today `docs/` is contributor-grade (the contract, the architecture, platform checks, the review packs); the README's showcase is the only user-facing page. The owner's ask, 2026-11-04: include the documentation with the tool, or host it on aoindustrial. Either way one source: pages written in Markdown in this repository, with the e2e suite's screenshots (AD-15, docs carry proof), versioned with the module so a release's docs match its contract.

## Requirements

- Verify: when it is scheduled, a reader who has never seen Map Studio installs it on a test Gateway, sets a project up, lays out the dev field and reads a popup from the docs alone, and each page carries the module version it describes; where the docs are served is the owner's decision (below) and the chosen place shows the pages of the current release.

## References

- readme - README.md, the showcase (the only user-facing page today)
- docs - docs/setup.md, docs/setup-editor.md, docs/kinds-and-assets.md, docs/kind-setup.md, docs/contract.md, docs/basemaps.md (the contributor pages the user pages distil)
- architecture - _bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md, AD-9 (the versioned contract), AD-15 (docs carry proof)
- initiative - _bmad-output/initiative-flowmap/initiative-flowmap.md, Boundaries (the open-source release is out of the first version)

## Notes

- Open question (owner): where the docs live. Options: (a) a docs site on aoindustrial built from this repository's pages per release (a static site generator over Markdown, one build per tag); (b) served by the module itself at a Gateway path such as `/res/mapstudio/docs/` so a site with no internet reads them in place; (c) both, the module's copy a snapshot of the site at its release. Sofia's pick: (c), since IT/OT sites are often offline and the site is the discoverable front door.
- Open question: the audience split (integrator, map editor, operator, page builder) as separate guides or one book with parts; and whether the Designer's setup form links to its page.
- Note: 2026-11-04 Owner: added to the backlog as an idea to discuss, not scheduled; it waits at least until epic 4's studio exists, since the editor guide describes it, and fits before or with the open-source release.
