---
type: epic
title: "The map, its kinds and assets live in the map store"
parent: initiative-flowmap
covers: ["R9", "R12", "R13", "R32", "R33", "R34"]
sources: [_bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md, docs/spike-report.md, _bmad-output/deferred-work.md]
companions: [_bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md, docs/platform-checks.md]
after: []
refined: true
risk: high
---

# The map, its kinds and assets live in the map store

## Description

The data foundation every later epic reads and writes through: a project names its database connection, kind list, asset list and editing roles in one setup; Map Studio creates and upgrades its `mapstudio_` tables, saves every finished edit through one write path from the browser or from `system.mapstudio.applyEdits`, refuses saves without an editing role or that would overwrite another editor, records who changed what, and tells every open map at once. It starts from the spike's go (docs/spike-report.md, 2026-10-26), whose platform answers are fixed facts here (docs/platform-checks.md, story 3).

## Outcome

Every later epic reads and writes one map through one contract, and nothing is lost when a map editor leaves halfway (prd SM-4).

## Requirements

- R1 (parent R33; prd FR-30; architecture AD-3, AD-21): On start, Map Studio creates or upgrades its `mapstudio_` tables on the PostgreSQL connection the project setup names, with no hand-written SQL, and records the schema version; it waits for the connection to become usable before it decides; every row is keyed by Ignition project name and geometry is GeoJSON text, with no spatial SQL.
- R2 (parent R33; architecture AD-21): When the database role lacks a right or a migration fails, Map Studio logs one error naming the connection, the statement and the SQLState, leaves no half-created schema, and the map store is unavailable with that reason until fixed; a schema newer than the module makes the map read only with the reason logged; in a redundant pair only the active Gateway accepts writes.
- R3 (parent R32, R33; architecture AD-2, AD-20): Every finished edit is one `edits.apply` batch through one write service, from the browser or the scripting API: all ops or none in one transaction, versions incremented, and who made each edit and when recorded; a retried `batchId` returns the first result; deletes are tombstones that a later batch restores.
- R4 (parent R9; architecture AD-2, AD-5): The project setup names its full-editing and phone-editing Ignition roles; every save is checked on the Gateway against the role matrix (full editing: every op; phone editing: a point's geometry and a map item's properties, and their undo) and refused with code `role` and nothing written otherwise; `map.load` tells the browser its level (`none`, `phone`, `full`).
- R5 (parent R34; architecture AD-2): A batch whose `baseVersion` for any map item or kind setup is not the stored version is refused whole with code `conflict`, a plain-words message and the other editor's current record, so the browser can show the other's change.
- R6 (parent R32; architecture AD-17): Each committed batch reaches every open map of the project as `map.changed {seq, ops}` within a few seconds, without a page reload; a gap in `seq` makes the browser reload the map.
- R7 (parent R32; architecture AD-10): Unsaved batches wait in the browser's local storage per project, in order, survive closing the browser, are replayed with their original versions until saved or discarded, and show as unsaved with the reason; when the map store is unreachable at load, the map says so, draws no map item as current, and editing is off.
- R8 (parent R12; prd FR-9; architecture AD-4, AD-16, AD-20): The kind list (id, name, geometry, icon, form fields, label rank) comes from a project script function the setup names; adding a kind needs no module change; every map item op is validated and normalised against it (known kind, matching geometry, properties typed by the form fields) and refused with code `invalid` and the reason otherwise.
- R9 (parent R12; prd FR-9; prd NFR-10): A core oil and gas icon set in one minimalist style, under a permissive licence with its attribution and nothing derived from OpenBridge, ships with the module for the sixteen kinds FR-9 names; a kind names its icon from it, and an unknown icon name is reported.
- R10 (parent R13; prd FR-10; architecture AD-4): The asset list (id, name, kind, fully qualified base path) comes from a project script function the setup names; adapter calls run on a bounded pool with a timeout; the Gateway caches kinds and assets, refreshes them on a timer and on demand, and reports an empty, failing or incomplete list in words, in the Gateway log and in `map.load`.
- R11 (architecture AD-16, AD-20; initiative Notes, Decision 2026-10-26 on build order): The map store holds one versioned kind setup per project and kind id, in a published kind setup schema carrying the parts initiative R15 names, written only through the write service and returned by `map.load` and `getMap`, so epic-viewing reads seeded kind setups before epic-editing writes them.
- R12 (parent R9, R12, R13, R33; architecture AD-5): One setup per project, a project resource with a versioned schema, names the database connection, the kind and asset functions, the full-editing and phone-editing roles, the refresh interval (default 10 s), the alarm page, the basemaps and the token secret name; a missing or invalid setup is reported in words and leaves the map store unavailable; a changed setup applies without a Gateway restart.
- R13 (parent R32; architecture AD-18, AD-22): Gateway-scope `system.mapstudio.getMap(project)` and `system.mapstudio.applyEdits(project, batch, actor)` run on the same write service as the browser; an actor is required; caller-supplied UUIDv5 ids make a re-run update instead of duplicate.
- R14 (prd NFR-8; architecture AD-9): The setup schema, kind list, asset contract, kind setup schema, map item record, message types and scripting API are documented in `docs/` with examples, including two example adapters (UDT instances from the tag tree, a named-query wrapper) that follow Jython 2.7 rules, and are versioned with semantic versioning.
- R15 (spike report, "If go: what epic 2 commits to", seed data; deferred-work, story 7 entry): The dev project's 30-pad scale set lives in the map store, written through `applyEdits`; the spike-only `testSet` prop, its stand-in data and the Scale view are removed, and the e2e suite keeps its coverage.

## Constraints

- The initiative's Constraints bind here, above all NFR-5 (rights checked on the Gateway on every save; Map Studio writes only to its map store; credentials from the secret store), NFR-6 (Ignition 8.3 full Gateways, Java 17, the signed module lock path), NFR-7 (every SDK claim unverified until seen on a live 8.3 Gateway) and NFR-8 (public contract versioned).
- PostgreSQL only, no spatial SQL, no Gateway-wide module settings: only the project setup and per-component settings (architecture AD-3, Consistency Conventions).
- The platform answers of docs/platform-checks.md, story 3, are the mechanisms: `getProjectScriptManager` for adapters, `initializeScriptManager` with `addScriptModule` for the scripting API, a `ResourceCollectionLifecycleFactory` for the setup resource, `DatasourceManager` for the connection; a `Valid` connection says nothing about rights (SQLState 42501), and the start-up CREATE is the only signal.
- Project functions are called on a bounded pool with a timeout, because `runCode` is synchronous (architecture AD-1).
- No password, token or secret in git or in a log line; the dev database's passwords are generated into git-ignored files and reach the Gateway through a secret provider (docs/platform-checks.md, story 3, facts learned).
- The first release of this epic that changes the public contract is version 0.2.0 (spike report, release path).

## Done when

- On the dev Gateway with an empty PostgreSQL database, Map Studio creates its tables with no hand-written SQL; a database role without CREATE gets one error line naming the connection, and the map store reports itself unavailable.
- An edit saved from one browser shows on a second open browser within a few seconds without a reload, survives closing both, and its edit record names who made it and when.
- A save by a viewer, a line drawn by a phone editor, and a second save of the same map item are each refused on the Gateway with a message, and nothing is written.
- The setup schema, kind list, asset contract, kind setup schema and scripting API are documented with examples, and an empty, failing or incomplete adapter is reported in words.
- The dev project's 30-pad set comes from the map store, and the e2e suite passes with `testSet` gone.
- Release 0.2.0, installed through the template's module lock, passes the template's test stack with a scratch project whose setup names a PostgreSQL connection.

## Boundaries

- Hands on: the map store schema and migrations, the write service and role matrix, the project setup, the kind and asset adapters, kind setup storage, the scripting API, change events and the browser's save client (consumed by epics 3 to 7).
- The spike's "Draw a line" tool saves its finished line through the write path, as this epic's browser-side edit; epic-editing replaces it with the Map Studio tools.
- Not here: the Map Studio tools and their role-based visibility, item forms, the asset picker, the kind setup editor and where the tools show the adapter status (epic-editing); icons drawn on the map, live values, `values.batch`, popups and the kind setup's effect on them (epic-viewing); the AD-19 check that a moved snapped-to item carries its ends (epic-editing, with snapping); chunked imports `edits.begin`, `edits.chunk`, `edits.commit` (epic-import-export); export (epic-import-export).
- Touch point: `ign-scada-template` - its module lock, test stack and a never-committed scratch project for the 0.2.0 check, as epic-module-foundation story 6 did; owner: epic-template-cutover.
- Must not change: the template's map pages and `map_draft` tables; the `popupView` prop, which stays until epic-viewing's kind setup replaces it.

## References

- parent - _bmad-output/initiative-flowmap/initiative-flowmap.md, section Requirements (R9, R12, R13, R32, R33, R34) and Notes
- prd - _bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md, FR-7, FR-9, FR-10, FR-29 to FR-31, NFR-5, NFR-8, section 2.1 (roles)
- architecture - _bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md, AD-1 to AD-5, AD-8, AD-9, AD-10, AD-16 to AD-18, AD-20 to AD-22, Consistency Conventions
- platform checks - docs/platform-checks.md, story 3 (the SDK calls that worked, the Driver$1 start-up error, the dev Gateway facts) and story 8 (what the sweep removed)
- spike report - docs/spike-report.md, sections "If go: what epic 2 commits to" and "Risks carried forward"
- deferred work - _bmad-output/deferred-work.md, entries whose goes_to names epic-map-store-and-data
- contributor guide - docs/architecture.md

## Notes

- Decision: 2026-10-26 Names, licence (Apache-2.0) and the Alarm Metrics answer are recorded in the initiative's Notes and apply here.
- Waits on epic-module-foundation because: the module skeleton, build and signing (entries pin 1.1, 1.5, 1.6 and 1.7 where they need them).
- Decision: 2026-10-26 Entry 1 is the tracer bullet: one edit from the browser and one from a script go through setup, migrations, role check, write service and edit record, and come back on `map.load`. It also fixes every contract the parallel entries share: the whole first schema, the message and op shapes, the error codes, the setup schema and the per-batch `seq` with a no-op change hook.
- Decision: 2026-10-26 Parallel groups, each entry in a group independent of the others in it: group A after entry 1 (entries 2 to 7), group B (entry 8 after 2 and 4, entry 9 after 2 and 3, entry 10 after 3), group C (entry 11 after 8 and 9), then the sweep (12) and the closing release check (13).
- Decision: 2026-10-26 Entry 2 (conflicts, retries, deletes and the phone role) goes first in group A as the least certain part of the write path.
- Decision: 2026-10-26 Entry 1 writes the whole first schema; a later entry that needs a schema change adds the next migration number after rebasing on main, and only one open entry at a time adds a migration.
- Decision: 2026-10-26 Each parallel worktree runs its own dev Gateway and PostgreSQL, by its own `MAPSTUDIO_CONTAINER` and `GATEWAY_HTTP_PORT` in its `.env` (README, "Run the development Gateway").
- Decision: 2026-10-26 The icon set (R9) stays in this epic because the epic covers initiative R12; epic-viewing draws it.
- Decision: 2026-10-26 A refactor sweep (entry 12) closes the build work; entry 13, release 0.2.0 on the template's test stack, is the closing integrated check and the epic's production delivery.
- Decision: 2026-10-26 Only entry 1 is refined before it starts; entries 2 to 13 build from their descriptions and verify lines.
- Assumption: The setup is the custom project resource of AD-5 (proven on the Gateway in the spike), with a Designer editor as its own entry (7); the script-function fallback stays available if the owner drops entry 7.
- Assumption: The scripting API trusts its caller: a Gateway or Perspective session script that calls `applyEdits` runs as full editing under the actor it names, recorded in the edit record. Perspective session scripts run on the Gateway and can reach `system.mapstudio`, so a view author could expose saving to a viewer; the docs say so.
- Assumption: The map is keyed by the name of the project the session or script runs in; a child project that inherits the setup resource has its own map.
- Assumption: Migrations are versioned SQL statements shipped in the module and applied in order, each in its own transaction, under a PostgreSQL advisory lock so two Gateways never migrate at once; no Flyway or Liquibase.
- Assumption: The start-up migration retries every 5 s for up to 2 minutes while the connection is not usable (the transient `Driver$1` error of docs/platform-checks.md, check 5), logging one warning, then one error, before it marks the store unavailable.
- Assumption: The 30-pad seed is the spike's seeded stand-in geometry, written by a dev-project script through `applyEdits` with UUIDv5 ids, so frame rates stay comparable with epic 1's; the template's Mesa field reaches the store in epic-template-cutover (AD-22).
- Open question: The Ignition role names for full and phone editing, and how the template's roles map to them; the dev Gateway uses `MapEditor` and `MapOperator` until the owner says otherwise.
- Open question: The database connection the template's setup names (its existing PostgreSQL connection or a dedicated `MapStudio` connection and role); entry 13 needs the answer.
- Open question: Whether the module's existing `system.mapstudio.ping` and `echo` scaffold functions go in entry 1 or stay as a health check.
- Open question: How the delegate reads the Perspective session user's roles on the Gateway is unverified; entry 1 answers it live before the role check is built on it.
