---
title: Input reconciliation - Map Studio architecture spine
step: finalize 2
spine: ../architecture-map-studio.md
inputs:
  - ../../initiative-flowmap.md
  - ../../prd-map-studio/prd-map-studio.md
  - ../../prd-map-studio/addendum.md
date: 2026-10-26
---

# Input reconciliation - Map Studio spine

Method: every requirement R1 to R39, every Constraint, every Done when, Boundary and Note of the initiative, the PRD's NFRs, section 8 risks and section 6.4 spike, and the addendum were read against the fifteen rules (AD-1 to AD-15), the Consistency Conventions, the Stack, the Capability map, the Deferred list and the open questions. A gap is listed when two builders working from the spine alone could reasonably build it two ways, when an input states something the spine never carries, or when a spine decision contradicts an input.

Severity: **blocking** (two epics would diverge on a shared seam), **should fix** (one epic could quietly miss a requirement), **note** (wording, status or a small convention).

## 1. Gaps

### G1 - Saved edits reaching other open components (R32, FR-29, addendum) - blocking

- **Input.** FR-29: "Other open components show a saved edit without a page reload, within a few seconds." Addendum: "Live updates across components (FR-29): mechanism open (polling, a Gateway push or a message handler)." PRD section 10 lists "a few seconds" as a chosen figure.
- **Spine.** AD-2 governs the write; AD-6 governs `values.batch` for live values on the project's refresh interval (default 10 s in NFR-9). The message list in the memlog (`map.load`, `item.save`, `values.batch`, `popup.open`, `popup.close`) has no message that carries another editor's change to an open component. No rule says who fans out a committed edit, or on what cadence.
- **Risk.** The viewing epic polls `map.load`, the editing epic piggybacks on `values.batch` (10 s violates "a few seconds"), the map-store epic sends nothing. The conflict message of R34 ("the user sees the other editor's change") also depends on this seam.
- **Fix.** Add to AD-2 (or a short AD-16): after the write service commits, the delegate sends `map.changed` with the changed map items (new version included) to every open component of that project, at once, independent of the live-value interval; a component applies it over its drawn map and keeps its own unsaved edits on top. Name the message in the contract list.

### G2 - Unsaved edits in the browser and the map store unreachable on load (R32, FR-29, SM-4) - blocking

- **Input.** FR-29: a failed save "is shown as unsaved, with the reason, and is kept in the browser until it saves or the user discards it"; when the store cannot be reached on load "the map says so, shows nothing stale as current, and the tools are disabled until it can". SM-4: closing the browser mid-layout loses no finished edit.
- **Spine.** AD-1 allows the browser to hold "unsaved edits" and the error code `store-unreachable` exists, but nothing says where unsaved edits live (memory, `sessionStorage`, Perspective session props), whether and how they retry, what discard means for a batch, how a retry that now meets a `conflict` is shown, or what the browser does with a previously drawn map when a later `map.load` fails.
- **Risk.** One builder keeps the queue in memory (a reload loses a finished edit, breaking the spirit of SM-4), another persists it per browser and replays it against a map that moved. The viewing epic may keep showing the last map when the store is down.
- **Fix.** Add a rule to AD-10 (browser adapter): unsaved edits sit in an ordered queue in the browser, listed to the user with the reason, retried on a short backoff and on reconnect, each retry going through AD-2 with the version it was made against (so a `conflict` surfaces as in R34); discard drops one queued edit and redraws from the Gateway's copy. State whether the queue survives a reload (recommendation: `sessionStorage` per project, replayed on load; the spike can confirm Perspective allows it). On `store-unreachable` at load the component shows the message, disables the tools and draws no map items.

### G3 - Phone-editing scope enforced on the Gateway, and how the browser learns roles (R9, R30, R31, FR-7) - blocking

- **Input.** FR-7: separate roles for full editing and phone editing; "every save checks the role on the Gateway"; "a save attempted without an editing role is refused on the Gateway and nothing is written, whatever the page shows." FR-27 and FR-28: phone editing covers moving a point and editing properties; nobody draws below 768 px.
- **Spine.** AD-2 checks "the editing role" in the singular. No rule says the write service tells edit types apart, so a phone-editing user who sends `item.save` creating a line (from a desktop browser, or a tampered client) is not defined as refused. Nothing says how the browser learns whether to show the tools (R9) - the role check result must come from the Gateway, not from the browser reading session roles.
- **Fix.** AD-2: the write service classifies each edit (create, delete, line or area geometry, point move, property change) and the phone-editing role permits only point move and property change; the full editing role permits all. `map.load` carries `edit: none | phone | full` computed on the Gateway, and the browser shows tools only from that field.

### G4 - Read-only toward the host, and the host-script seam (NFR-5, NFR-6, section 5, AD-4, AD-5) - should fix

- **Input.** Constraint: "Map Studio writes only to its map store, never to tags, devices, assets or UDT instances"; "the host's Jython untouched". Section 5 non-goals repeat it. Project rules (CLAUDE.md) bind any Jython in the host: Jython 2.7, `system` pre-scoped, Java and Python exceptions caught, named queries through `system.db.execQuery`, no em dashes.
- **Spine.** AD-1 speaks of tag subscriptions (reads) and AD-2 of writes to the map store, but no rule forbids a tag write, a device call or an asset change by module code. AD-4 and AD-5 make the host adapters and the setup fallback project script functions called from module Gateway code, yet the memlog's confirmed SDK facts do not include invoking a project script function from a module and reading its return; it is an unverified claim with no open question. The two example adapters and the setup script are Jython the docs ship, and the spine carries none of the host's Jython rules.
- **Fix.** (a) Add to AD-1: module code never writes a tag, calls a device or changes an asset or UDT instance; the kind-setup tag browser is read only; the only mutable state is the `mapstudio_` tables. (b) Add an open question for the spike: "Can module Gateway code call a named project script function (the project's ScriptManager) and read its return?" with the fallback named (a named query the setup names, or a Gateway message handler the host implements). (c) Add a convention row: Jython shipped in docs (example adapters, setup fallback) follows the host rules - Jython 2.7 syntax, no `import system`, both exception kinds caught, named queries through `system.db.execQuery`, no em dashes - and ships with the module's own Jython libraries never installed in the host (NFR-6).

### G5 - Place check offline, icon set and licences (R24, R12, NFR-10, NFR-11, addendum) - should fix

- **Input.** FR-21: the place check is "looked up without any online service". Addendum: Natural Earth boundaries (public domain) and a GeoNames city list (attribution required), looked up in the browser, "a few MB, unverified". FR-9: a core oil and gas icon set in one minimalist style ships with the module. NFR-10: permissive licences for libraries, icons and place-check data, attributions shipped, no icon derived from the OpenBridge set, no dependency that charges per deployment. Spike measure: bundle size.
- **Spine.** Deferred: "Parsers for CSV, KML and GeoJSON and the place-check data package: chosen in epic-import-export and epic-editing, within the licence constraint." Nothing says where the place-check data lives (`web/` bundle, a lazily loaded asset served by the module's Gateway web resources, or the map store) or that it must stay out of the first bundle; nothing in the spine mentions the icon set at all, and no convention row carries the licence rules or attribution placement.
- **Risk.** A few MB lands in the main bundle and the spike's bundle-size measure is blown; the icon set is drawn from whichever set a builder finds first; attributions are scattered or missing.
- **Fix.** Add to AD-10 or the Structural Seed: place-check data is a static asset the module serves from its Gateway web resources and the browser loads on first use of the location field, never in the initial bundle. Add a convention row "Licences and attribution": dependencies, icon set and data are permissive (Apache-2.0, MIT, BSD, CC-BY, public domain); a `NOTICE` or `docs/attributions.md` lists them and the component shows the basemap and data attributions; icons are original or from a permissive set and never derived from OpenBridge; the module's own licence is Apache-2.0 (initiative Note 2026-10-26, absent from the spine).

### G6 - Small conventions and statuses the inputs fix and the spine leaves open - note

- **AD-11 has no `[ADOPTED]` tag** while every other rule does; its binding to the engineering review (ER-27) and SM-C2 (no hue in a normal field) make it a Done-when item, so it should not read as pending.
- **Default refresh interval 10 s** (NFR-9, PRD section 10) is not in AD-5 or AD-6; two epics could ship different defaults.
- **Breakpoint 768 px and 44 px touch targets** (FR-27, FR-28, NFR-3, PRD section 10): the spine binds R30 and R31 to AD-2 and AD-10 only. Add a convention row: one breakpoint, 768 px, below which the bottom sheet and 44 px targets apply and drawing tools are hidden; the Capability map should also point R30, R31, R38 at AD-11 (contrast) and the convention.
- **Satellite fallback**: the initiative Note names MapTiler or Esri World Imagery if Mapbox's terms fail; AD-12 and the open question name no fallback, so epic-viewing would stall on a no.
- **Custom popup view fallback** (R39, FR-37): "a missing view falls back to the default popup with a message" is not in AD-7.
- **Import and export ids** (R35, R26): ids are "created in the browser when the item is drawn"; nothing says whether an import keeps the ids in a GeoJSON export or makes new ones. Convention: an import keeps an exported id when the store has none with that id, otherwise makes a new one, so the R35 round trip into an empty store is exact and a re-import into the same store never collides.
- **Adapter refresh timer** (AD-4): "refreshes them on a timer" with no interval; AD-5 binds only "the refresh interval of AD-6". Name it (recommendation: the same project interval, or a separate `adapterRefresh` in the setup).
- **Per-Gateway wording**: PRD section 4.10 says the basemap is chosen "per Gateway", while FR-32, R36 and AD-5 say per project. The spine follows the initiative; record the wording difference as a PRD erratum, not a spine change.

## 2. Checked and consistent

| Input | Where the spine carries it |
| --- | --- |
| R1, R3, R4, R5 map, labels, search, parity | Capability map to `web/`, AD-11, AD-12; ER-27 in AD-11 |
| R2, R6, R7, R8, R39 icons, popups, alarm summary, links, custom view | AD-6, AD-7 (hybrid popup, acknowledging only in the alarm table) |
| R9 (Gateway role check), R34 conflicts, R20 undo of a saved edit | AD-2 version compare and conflict with current item (scope of roles: G3) |
| R12, R13, R14, R27 kinds, assets, linking | AD-4 adapters, cached, empty or failing adapter reported in words |
| R15, R16 kind setup and overrides | KIND_SETUP entity; internal structure deferred by design |
| R17 to R24, R37, R38 drawing in the browser, 100 ms, WCAG | AD-10, AD-11 |
| R25, R26, R28, R29, R35 CSV, import as one undo step, bulk edit, reference layer, export | AD-2 batch as one undo step, AD-9 CSV formats versioned |
| R32, R33 store, who and when, module-made tables | AD-3 (PostgreSQL only, `mapstudio_`, migrations, schema version) |
| R36 basemaps and public restricted tokens | AD-12 |
| Constraint NFR-2, NFR-9 (browser editing, batched values, popups live while open, off values never read) | AD-6, AD-7, AD-10 |
| Constraint NFR-4, NFR-11 (theme tokens, neutral normal) | AD-11 (status: G6) |
| Constraint NFR-6 (8.3 full Gateways, Java 17, signed `.modl`, lock by SHA-256 and fingerprint, pinned client packages, test stack per 8.3.x) | AD-13, AD-14, Stack |
| Constraint NFR-7 (unverified claims) | Open questions for Alarm Metrics, view embedding, toolchain, setup resource type (missing: project script call, G4) |
| Constraint NFR-8 (versioned public contract) | AD-8, AD-9 |
| Constraint ER-27 | AD-11 |
| Constraint 6.4 spike gate | AD-13 and the open questions name the spike; the no-go path is the initiative's, not the spine's |
| Constraint: no drafts, no history | Deferred list ("map version history out of scope") |
| Done when: spike go recorded, template cut-over, signed release through the lock, ER-27 | AD-13, AD-14, Capability map row "Template cut-over" |
| Boundaries: no Edge, not a GIS (no spatial SQL) | AD-3, AD-13 |
| Notes: names, seven epics, R9 in the store epic, Alarm Metrics by subscription | Conventions (names), AD-6, open question 1 |
| PRD risk: Designer props editing | AD-5 (components carry only per-page settings) |
| PRD risk: basemap privacy | AD-12 (public, URL-restricted token; attribution) |
| PRD risk: second product to maintain | AD-13, AD-15 |
| Addendum: signing key custody | AD-14 |
| Addendum: deck.gl | Deferred |

## 3. Suggested edits, in order

1. AD-2: add `map.changed` fan-out on commit and the edit classification per role (G1, G3).
2. AD-10: add the unsaved-edit queue, retry, discard and the store-unreachable behaviour; add the place-check asset rule (G2, G5).
3. AD-1: add "never writes a tag, device, asset or UDT instance" (G4).
4. Open questions: add the project-script call check with its fallback (G4); add the satellite fallback providers (G6).
5. Conventions: add rows for Licences and attribution, Jython in shipped docs, Breakpoints, Import ids, Defaults (10 s refresh, adapter refresh) (G4, G5, G6).
6. AD-7: add the missing-view fallback (G6). AD-11: mark `[ADOPTED]` (G6).
