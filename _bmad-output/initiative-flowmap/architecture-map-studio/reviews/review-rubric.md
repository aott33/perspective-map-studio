# Review - Map Studio architecture spine (good-spine checklist)

Reviewed: architecture-map-studio.md, against initiative-flowmap.md, the seven epics (tickets.toml) and .memlog.md. Context: solo owner, Ignition 8.3 Perspective component module, greenfield module in a brownfield host (ign-scada-template).

Verdict: a strong, mostly enforceable spine for the editing, viewing and contract seams, but it is silent on the whole operational envelope (backup/restore of the map store, monitoring, runtime upgrade/migration, Gateway redundancy) and leaves three divergence points between epics unfixed (data cut-over path, store-down and cache lifecycle, setup access mechanism). Not ready to hand to the epics until the criticals/highs are decided or listed as open questions.

## Critical

### C1 - Operational envelope is silent: backup, restore and monitoring of the map store
The map store is the only copy of the map (initiative: "no drafts or history", undo plus edit record plus export are the safety net). The spine decides nothing on: database backup/restore and who owns it (host DB vs module), restore-tested procedure, an automatic or scheduled export as a backup, a health/status surface (store reachable, schema version, adapter last refresh and failure, subscription count, batch lag), or alerting. Logging is covered only as naming (`MapStudio.<area>`). Not in Deferred, not an open question. Checklist: "a whole dimension left silent, especially operations". Fix: add an AD (or explicit Deferred with owner) for: a documented backup requirement on the `mapstudio_` tables, a `status` message/API and a Gateway diagnostics page or tags for store/adapter/subscription health, and a restore procedure verified in e2e (export to empty store round trip, R35, already exists and can be the base).

### C2 - Upgrade and migration operation is undecided (module upgrade, schema migration, multi-Gateway)
AD-3 says the module "creates and migrates its tables itself" but nothing fixes: when migration runs (module start, first use), that it is transactional/idempotent, what happens on a downgrade or a newer schema than the module knows, behaviour when two Gateways (redundant pair, or dev and prod sharing a DB) start at once, or the DB user privileges needed (DDL rights in production, which many OT sites refuse). AD-13 gates module releases but not data upgrades. Redundancy is not mentioned at all: in a redundant Gateway pair, the live-value cache (AD-6), adapter cache (AD-4) and the "one subscription per project" run on whichever node is active; failover behaviour of open sessions and of the cache is unspecified. This is a real divergence point for epic-map-store-and-data vs epic-viewing. Decide: single-writer migration with a schema-version lock, DDL-privilege model (separate migration credential or documented manual script), redundancy supported or explicitly unsupported in v1.

## High

### H1 - Template cut-over data path is not a spine decision
Done-when requires the Mesa field to move from `map_draft`/`_Model/Map`/`prov` into the map store, and `prov` is the template's source of truth (registry CSV and byte gates). The spine only says "Template cut-over | AD-2, AD-4, AD-5, AD-11". Undecided and divergence-prone between epic-import-export, epic-template-cutover and epic-map-store-and-data: is the cut-over done by CSV/GeoJSON import (R26) or a one-off migration; does `prov` still produce anything (kinds, assets, setup) and how does it call the module API without SQL (AD-2); where do kind setups for Mesa get seeded (the initiative says "can be seeded for viewing before editing writes them" but no seeding mechanism is in the spine; it contradicts "never by SQL"). Add an AD for the seeding/provisioning API (host-side, same write path) and for the registry-to-map-store direction.

### H2 - AD-2 write path and AD-10 undo create gaps a Rule cannot enforce
(a) "Undoing a saved edit sends the reverse edit through AD-2" with a version check: R20 says refuse when another editor changed the item since; the Rule states no concrete behaviour for deletes (a deleted item has no row/version - a tombstone? undo of delete re-creating with the old id and version?), and no idempotency key: a retried `item.save` after a timeout can double-apply, and batches ("one undo step") have no stated atomicity or size cap. (b) Browser-created UUIDs let any editor create an id collision across projects; the unique key should be (project, id) - the spine says rows are keyed by project but not the primary key. (c) "Shows on other open components within a few seconds" (R32): AD-6 only describes live values; there is no change-feed message for map edits (`map.changed`?). Epics viewing and editing would each invent it. Add to AD-8/AD-2: delete semantics, idempotency/client op id, batch atomicity, and the map-change broadcast.

### H3 - Store-down, offline and failed-save behaviour has no architectural rule
R32 requires: failed save stays visible and kept; unreachable store disables tools and shows "nothing stale as current". No AD says where unsaved edits are held (memory only? lost on tab close, contradicting "survives closing the browser" only for finished edits), how the browser reconnects to the Gateway (websocket drop), what the Gateway serves if the DB is down but the cache is warm, or the error code behaviour (`store-unreachable` exists only as a name). Epics viewing, editing and phone will each decide. Also: the Gateway-side map cache lifecycle (is the map loaded per session via `map.load` each time, cached per project, invalidated on write) is not fixed and is the main lever for the 300-site/60 fps target (R37, NFR).

### H4 - AD-5 setup mechanism is left as "spike decides", but nine requirements and four epics bind to it
Setup holds the DB connection, roles, adapters, token secret - everything. Whether it is a project resource type or a script function changes the Designer UI, how roles/secret names are validated, and how the setup is edited and versioned in git (config-as-code in the host). The Deferred list allows two shapes with no interface fixed between them (a loader port in `common/` returning one setup object schema). Rule must at least fix the setup object schema (versioned, part of AD-9) so epics code to the schema, not to the storage. Also unaddressed: who may edit the setup and how a bad setup is surfaced.

### H5 - Security gaps in the Rule set
- AD-12 sends the Mapbox token to the browser. "Only public, URL-restricted tokens" is a policy the module cannot enforce; add a check (token prefix `pk.` rejected otherwise `sk.`) in the Gateway and a failure code. Billing exposure per tile (memlog: 750k free then 0.25 USD/1000) has no control: no rate or usage limit decision, no kill switch, and a Product Terms question still open that gates epic-viewing (R36).
- AD-4 host adapter scripts run with Gateway scope: no timeout, no resource limit, no isolation stated. A hung or slow `mapstudio.assets()` can block the delegate thread. Add timeout, thread model and size cap.
- Read authorization: AD-2 gates writes by role; the Rule does not say who may read the map or popups per project/security zone, nor whether live values honour tag permissions. IEC 62443 context (the host's ignition-security skill) suggests this must be stated.
- Audit: edit record exists; retention and who can read it is undecided.

## Medium

### M1 - Several ADs have a Rule that does not fully prevent the stated divergence
- AD-8 (message contract): fixes the envelope but not the message catalogue owner, idempotency, ordering, size limits, or version negotiation (`v` mismatch between an old browser bundle cached after a module upgrade and a new Gateway). A cached client after upgrade is a real hazard: say what happens on `v` mismatch.
- AD-9 (semver): no enforcement mechanism (schema files in `common/`, a compatibility test in CI). "Documented and follow semver" is aspirational; make it "contract schemas are generated from `common/` and a CI check diffs them against the last release".
- AD-11 (look and colour): not marked ADOPTED (the only one without the tag) and its enforcement ("module ships no colour") conflicts with the need for fallback colours when a host has no tokens; and the ER-27 gate is a process, not a Rule. Also map libraries draw on a canvas: theme tokens must be read through a defined API (CSS variables read at runtime, theme-change event), not fixed at load. Specify.
- AD-14: signing key held as a GitHub secret with owner backup is fine for solo; add key expiry date handling (certificate validity) and who signs if the owner is unavailable (bus factor is the project's chief operational risk; one line suffices).
- AD-15: the "unverified" marking is good; but nothing ties it to the memlog constraint that every SDK claim is unverified until recorded in claude-ignition-skills.

### M2 - Spike-dependent decisions leave the shape of two seams open
Open questions (Alarm Metrics via Java subscription, custom popup view in 8.3, MapLibre 6 builds with React 16/TS 4.9) each have a fallback written, which is good. But the Alarm Metrics fallback ("reference or expression tag per asset") changes the kind setup schema and the host's tag tree; the custom-popup fallback is absent (R39 falls back to the default popup but the example view is a done-when item). Record the fallback consequences on the contract (AD-9), or the spike go/no-go will reopen the spine. The initiative lists a no-go outcome ("better page on the built-in Map instead"); the spine does not name which ADs survive it.

### M3 - Stack table is partly unverified or inconsistent
- "Ignition 8.3.x, set in the spike; 8.3.10 current" and "Playwright: set in the spike", "perspective-client 2.x exact set in the spike": acceptable as spike outputs, but the checklist asks for named tech verified-current; the memlog confirms most versions on 2026-10-26, except `terra-draw-maplibre-gl-adapter` against maplibre-gl 6 (memlog: "v6 testing unconfirmed"). The spine lists maplibre 6.16.0 as the pick while marking this unconfirmed; mark the row as conditional on the spike.
- React 16.14 / TS 4.9 / webpack 5 are the Perspective toolchain constraints (derived from Mustry), flagged as confirmed in a third-party module's package.json, not an IA statement.
- Mapbox "satellite-v9 legacy style" and the Product Terms are unread; the spine asserts `mapbox.satellite` through the Raster Tiles API as ADOPTED while the terms question is open. Mark AD-12 conditional.
- PostgreSQL "as supported by the host's Ignition version" gives no minimum version or driver note; a minimum (for example `timestamptz`, `jsonb` not used) should be stated.

### M4 - Environments and deployment are drawn, not decided
The deployment diagram shows dev/test/prod from the host's image, but the Rule text says nothing about: a separate map store per environment and how a map is promoted dev to test to prod (export/import R35 is the natural mechanism, but it is not stated); how project inheritance in Ignition (parent/child projects) interacts with "one map per project keyed by project name" (child projects inheriting a component vs the setup); and Gateway-network/multi-Gateway (hub and spoke, the template's central/edge model) behaviour. Edge is excluded; a central Gateway serving many field sites is the template's model and should be stated as the supported topology.

## Low

- L1 - Performance budget (R37, 60 fps, 100 ms) has no architecture-level mechanism beyond "whole-map batches"; viewport batches deferred "until 300-site target" contradicts the module's stated v1 scale (30-pad set); say which scale the spine commits to and what is measured in the spike.
- L2 - Deferred "Internal structure of gateway/ and web/" is fine, but "Parsers for CSV/KML/GeoJSON and the place-check data package" could let epic-import-export and epic-editing choose different parsers or coordinate libraries; the shared geometry validation (R22) and the place-check are used by both. Make the shared validation a `common/` or `web/` single module.
- L3 - Capability map row "Releases, upgrades, signing, docs" maps to AD-13 to AD-15 but no epic owns operations/docs deliverables beyond foundation; docs/ proof (AD-15) lands across epics with no owner.
- L4 - Accessibility (R38, WCAG 2.2) is mapped only to AD-10/11; no rule covers keyboard focus management inside a canvas map or the Perspective component lifecycle. Acceptable to defer to epic-editing, but say so.
- L5 - Naming: Java package and module id use `com.aoindustrial`, the user email domain is `aoautomation.io`; confirm the intended namespace before it is baked into the signed module id (cannot change after release without breaking host locks).
- L6 - Em dashes: none found in the spine text.

## Checklist summary

| Check | Result |
| --- | --- |
| Fixes real divergence points for seven epics | Partial: H1, H2, H3, H4 |
| Every AD Rule enforceable | Partial: M1 (AD-8, AD-9, AD-11), H5 (AD-12, AD-4) |
| Deferred cannot cause divergence | Mostly; L2, and "setup mechanism" (H4) |
| Named tech verified-current | Mostly; M3 |
| Covers all ticket requirements | R1 to R39 bound; R37 and R38 weakly (L1, L4); R35 and R33 lack ops (C1, C2) |
| Every owned dimension decided/deferred/open | No: operations (C1, C2), environments (M4), security reads (H5) |
