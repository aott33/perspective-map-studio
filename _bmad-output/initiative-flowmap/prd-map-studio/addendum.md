# Addendum - Map Studio PRD

Technical choices, references and detail for the UX specification and the architecture, kept out of the PRD itself. The brief's addendum (`../brief-flowmap/addendum.md`) holds the earlier research (built-in Map, the template's editor, Nader's tool, map objects, icons, editing libraries, map UI practices) and is not repeated here.

## Open-source module references (from the owner, 2026-10-25)

Repositories to read before the spike. Descriptions are the repositories' own; nothing here is verified on a Gateway yet.

| Repository | What it is |
|---|---|
| `inductiveautomation/ignition-module-starter` | A Claude Code skill and resources to help new module authors get started with module development |
| `inductiveautomation/ignition-module-tools` | Tools for creating and developing Ignition modules (Kotlin; the Gradle module plugin) |
| `inductiveautomation/module-signer` | A utility that signs modules for use in Ignition (Java) |
| `inductiveautomation/ignition-maven-plugin` | A Maven plugin for building and packaging Ignition modules (Java) |
| `mussonindustrial/embr` | Open-source Perspective modules (Periscope, Charts), already in the template's module lock |

Also from the idea doc: Mustry's open-source Perspective component module, and Inductive Automation's `ignition-sdk-examples` (its `perspective-component` example).

## Technical leanings carried from the brief

- Renderer: MapLibre GL JS, deck.gl for display; editing through Terra Draw's MapLibre adapter (to evaluate in the spike).
- Place check offline: bundled country and province or state boundaries (Natural Earth, public domain) and a city list (GeoNames, attribution required), looked up in the browser. Size is an estimate of a few MB, unverified.
- Map store: tables Map Studio creates in a database connection the project names; the mechanism (Gateway hook, named queries or scripts) is an architecture decision.
- Live updates across components (FR-29): mechanism open (polling, a Gateway push, or a message handler).
- Satellite basemap provider: open (Mapbox satellite on the existing token, or another provider with acceptable terms).

## Template follow-up (ign-scada-template)

Moving the map's source of truth to the map store means a later pull request in the template that retires `prov`'s map steps (`add-pipeline`, `map import`, `map import-geojson`), the `map_draft` and `map_draft_event` tables and their named queries, `ops.mapedit` and `/map/edit`, and moves `/map` onto Map Studio. Alarm presentation on the new map goes through the template's engineering review (ER-27).
