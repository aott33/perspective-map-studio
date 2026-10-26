---
id: 1
type: story
title: "Tracer: a MapLibre map on a Perspective view, with one round trip"
parent: epic-module-foundation
covers: [R1, R2]
after: []
refined: true
hitl: true
risk: high
---

# Tracer: a MapLibre map on a Perspective view, with one round trip

## Description

The first end-to-end slice of Map Studio, which every later story builds on: the module skeleton builds, installs on a local dev Gateway in Docker, draws a map on a Perspective view and completes one message round trip with its Gateway side. It proves epic R1 and R2. The person's step: the owner reviews the screenshot of the running view and says whether it shows what the criteria say.

## Requirements

1. **The module builds** (R1)
   **Given** a fresh clone with JDK 17, Node 22 fetched by the build, and network access
   **When** the Gradle build runs
   **Then** it produces an unsigned `.modl` with module id `com.aoindustrial.perspective.mapstudio`, name "Map Studio", the Gateway, Designer and client scopes, and a declared minimum Ignition 8.3 version
   **And** a failing web bundle build fails the whole build

2. **It installs on the dev Gateway** (R1)
   **Given** the `ops/` Docker dev Gateway on Ignition 8.3.10, set to accept unsigned modules
   **When** the `.modl` is installed and the Gateway restarts
   **Then** the Gateway lists Map Studio as running
   **And** its start-up logs show no error or exception from Map Studio

3. **The component draws a map** (R2)
   **Given** a project with a view holding one `ao.mapstudio` component
   **When** the view opens in a browser at 1440 px and at 390 px
   **Then** a MapLibre map fills the component on a blank background, with three fixed test points and one line between two of them
   **And** the browser console shows no error from Map Studio

4. **One round trip in the envelope** (R2)
   **Given** the map from criterion 3
   **When** a user clicks a test point
   **Then** the browser sends `{v, type, id, body}` to the component delegate, and the delegate replies in the same envelope with the request's `id` and the point's id in its body
   **And** the reply is logged in the browser console and shown as a line of text on the map
   **And** a message with an unknown `type` gets an error reply `{code: "invalid", message}` instead of a crash

5. **Proof** (R2)
   **Given** the running view
   **When** a headless browser captures it at 1440 px and 390 px after a point is clicked
   **Then** both screenshots are committed under `docs/` and show the points, the line and the reply text
   **And** the owner confirms the screenshots match criteria 3 and 4

## Boundaries

- Not in this story: basemap tiles, signing and CI (story 5), the template's module lock (story 6), the Playwright suite and measures (story 7), Terra Draw (story 2).
- Must not change: anything in `ign-scada-template`.

## References

- parent - _bmad-output/initiative-flowmap/tickets/epic-module-foundation/epic-module-foundation.md, section Requirements (R1, R2)
- architecture - _bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md, AD-1, AD-8, structural seed, Stack
- addendum - _bmad-output/initiative-flowmap/prd-map-studio/addendum.md, open-source module references (Mustry's module, IA's perspective-component example)

## Notes

- Check beyond the criteria (high risk): rebuild from a fresh clone in a clean container, to prove nothing depends on this machine's state.
- Known steps: the Docker Gateway needs the Ignition EULA accepted and unsigned modules allowed by its start-up settings; Perspective client packages come from Inductive Automation's npm registry, which the build must reach.
- Open question: the minimum Ignition 8.3.x to declare; this story declares 8.3.0 unless the SDK requires later, and story 9 records the final value.
