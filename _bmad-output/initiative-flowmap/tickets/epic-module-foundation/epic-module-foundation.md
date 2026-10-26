---
type: epic
title: "The module builds, signs and runs on a live Gateway"
parent: initiative-flowmap
covers: []
sources: [_bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md]
companions: [_bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md]
after: []
refined: true
risk: high
---

# The module builds, signs and runs on a live Gateway

## Description

The platform baseline and the spike that gates the initiative: a Map Studio module scaffolded from an open-source Perspective module, built with Gradle and Node, signed, released on GitHub, installed through the template's module lock, drawing a MapLibre map on a Perspective view with one event round trip. A no-go here ends the initiative in favour of a better page on the built-in Map.

## Outcome

The owner knows within two days whether the toolchain and the Perspective client API carry Map Studio, recorded with the spike's measures (prd 6.4).

## Requirements

- R1 (prd 6.4; architecture structural seed, AD-13): A Map Studio module skeleton (common, gateway, designer, web, e2e, ops, docs) builds unsigned and signed with `io.ia.sdk.modl` 0.5.0, Java 17 and Node 22, and installs on a local dev Gateway.
- R2 (prd 6.4; architecture AD-1, AD-8): An `ao.mapstudio` component on a Perspective view draws a MapLibre map with fixed test points and one line, and one message in the `{v, type, id, body}` envelope goes to the component delegate and back.
- R3 (architecture open questions; prd NFR-7): Each platform question is answered with evidence on a live 8.3 Gateway and recorded in claude-ignition-skills: a Java subscription to Alarm Metrics on a folder and a UDT instance; calling a project script function from module code; registering a `system.mapstudio` function; a custom project resource type; rendering a project view by path; MapLibre 6 with the Terra Draw adapter on the Perspective toolchain; PostgreSQL connect, create a `mapstudio_` table, and log an error on missing rights.
- R4 (architecture AD-13, AD-14): CI builds every push; a release job signs with the owner's certificate from a GitHub Actions secret and publishes the `.modl` as a GitHub release; the certificate fingerprint is in the README.
- R5 (prd NFR-6; architecture AD-13): The released module installs on the template's test stack through `modules/modules.lock.json`, pinned by SHA-256 and fingerprint, and the stack run passes.
- R6 (prd NFR-1, 6.4; architecture AD-15): A Playwright smoke suite renders the test view at 1440 px and 390 px, records screenshots, and records bundle size, frame rate on the 30-pad scale set, the size of a value batch and what broke on the phone.
- R7 (prd 6.4): The spike's go or no-go is recorded with its measures and the platform answers; a no-go names the fallback (a better page on the built-in Map).

## Constraints

- The initiative's Constraints bind here, above all the spike gate, the signed module lock path (NFR-6) and the rule that SDK claims stay unverified until checked live (NFR-7).
- About two days for the go or no-go; a check that needs longer is recorded as open with its fallback, not allowed to hold the decision.

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
- architecture - _bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md, AD-1, AD-8, AD-13, AD-14, AD-15, structural seed, open questions

## Notes

- Decision: 2026-10-26 Names, licence (Apache-2.0) and the Alarm Metrics answer are recorded in the initiative's Notes and apply here.
