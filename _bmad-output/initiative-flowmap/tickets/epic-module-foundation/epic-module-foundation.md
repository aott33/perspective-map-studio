---
type: epic
title: "The module builds, signs and runs on a live Gateway"
parent: initiative-flowmap
covers: []
sources: []
companions: []
after: []
refined: false
risk: high
---

# The module builds, signs and runs on a live Gateway

## Description

The platform baseline and the spike that gates the initiative: a Map Studio module scaffolded from an open-source Perspective module, built with Gradle and Node, signed, released on GitHub, installed through the template's module lock, drawing a MapLibre map on a Perspective view with one event round trip. A no-go here ends the initiative in favour of a better page on the built-in Map.

## Outcome

The owner knows within two days whether the toolchain and the Perspective client API carry Map Studio, recorded with the spike's measures (prd 6.4).

## Done when

- A signed `.modl` from a GitHub release installs on the template's test stack through `modules/modules.lock.json`, pinned by SHA-256 and certificate fingerprint.
- A Perspective view shows a MapLibre map with a few points and one line, and one event reaches the Gateway and back.
- CI builds and signs the module on every push.
- The spike's go or no-go is recorded with hours to a green build, bundle size, frame rate on the 30-pad scale set, the batch size and what broke on the phone.

## Boundaries

- No product features: the map items shown are fixed test data.
- Hands on: the module skeleton, build, signing and release path that every later epic builds on.
- Must not change: the template's existing map pages.

## References

- parent - _bmad-output/initiative-flowmap/initiative-flowmap.md, section Requirements
- prd - _bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md
- prd - section 6.4 (spike), NFR-6 (platform and supply chain), section 8 (risks)
- addendum - _bmad-output/initiative-flowmap/prd-map-studio/addendum.md, open-source module references, signing key

## Notes

- Decision: 2026-10-26 Names, licence (Apache-2.0) and the Alarm Metrics answer are recorded in the initiative's Notes and apply here.
