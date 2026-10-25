# Reconcile: brief-flowmap (brief + addendum) against the Map Studio PRD (+ addendum)

Inputs: `brief-flowmap/brief-flowmap.md` (Brief) and `brief-flowmap/addendum.md` (BA). PRD: `prd-map-studio.md` (PRD) and its `addendum.md` (PA). Differences explained in `.memlog.md` are not listed as gaps (scope widened to viewing, popups, alarms; module-owned map store; phones edit properties; satellite basemap required; search added; no draft/release).

Priority: H = fix before finalizing, M = should carry, L = optional.

## A. Qualitative ideas the FR structure dropped

### A1 (H). Tone: "modern, minimal" UI, and the "cobbled-together" complaint
- Input: Brief, Executive summary: "shows comms, a key value and details in a popup, in a modern, minimal UI". The problem section: the template's editor "works, and it looks cobbled together". Brief, Scope, Supporting: "a small core icon set in one minimalist style".
- PRD: grey-is-normal and theme tokens appear (FR-2, NFR-4, SM-C2), but "modern", "minimal", "clean" and the aesthetic goal (not cobbled together) appear nowhere. FR-9 asks for a "core icon set" with no style constraint. Vision (section 1) has no tone statement.
- Fix: add a short "Design principles" block to PRD section 1 or 4.11 (modern, minimal, clean; one icon style; calm map where only problems carry colour). Put the icon style rules (one style, 24 px grid, 1.5 to 2 px stroke, SVG sprite keyed by kind, seeded from CC0/MIT, must not derive from the template's AGPL OpenBridge icons) in an FR-9 consequence and in PA "Icons".

### A2 (H). First-run path: empty state and skippable tour
- Input: Brief, Design principles: "A first-run path. An empty state offers 'Draw your first site' and 'Import CSV', with a short, skippable tour." BA Ranked item 8: "A skippable three-step tour and an empty state with 'Draw your first site' and 'Import CSV'." BA Onboarding: iD-style walkthrough on a throwaway layer, three chapters.
- PRD: no FR or NFR. UJ-1 and UJ-3 start on an "empty or nearly empty" map but nothing says what the user sees there. FR-1 only says an empty map opens on a default view.
- Fix: add an FR in 4.5 or 4.6 (empty state with two actions for editors; skippable three-step tour on a throwaway layer, nothing saved). Link it to SM-2 (30 minutes without help).

### A3 (M). Design principles not stated as principles
- Input: Brief, Design principles (five): one clear mode; local and fast with undo-instead-of-confirm; no drag-only actions; grey is normal; first-run path. Also "follows map editing practice, ISA-101 and WCAG 2.2".
- PRD: four of five exist as FRs or NFRs (FR-8, NFR-2, FR-17, NFR-3, FR-2, SM-C2). ISA-101 is not named anywhere in the PRD (WCAG is). The principle "undo covers deletes, so deleting needs no confirmation" is in FR-17 but its rationale is not.
- Fix: one sentence in section 1 or 4.11 naming ISA-101, WCAG 2.2 and map-editing practice as the design basis, pointing to BA "Map UI practices" and to the UX spec.

### A4 (M). "Advantages of execution, not a moat", differentiators and the problem
- Input: Brief, Solution: "Open source and free" vs about 25,000 USD packaged project; "Editing on the map itself"; "These are advantages of execution, not a moat". Problem section: built-in Map has no snapping, no vertex drag, no areas; Leaflet resists styling. BA Comparable: Nader Chinichian's Map Administration Tool.
- PRD: section 0 says it "does not repeat" the brief. No problem statement, no competitor, no differentiator, no open-source/free intent in section 1 (open-source release is only in 6.2 out of scope).
- Fix: add 3 to 5 lines to section 1 (why: built-in Map cannot be edited; alternatives: packaged project at about 25,000 USD, or in-house) so the PRD stands alone for Sofia and the architect. Optional.

### A5 (M). Vision horizon and the owner's reputation goal
- Input: Brief, Vision: "integrators reach for it before the built-in Map, and the owner is known for it" within two to three years; flow on the map first among "Later".
- PRD: 6.2 keeps flow with a "[NOTE FOR PM]" and the memlog records the reputation stake, but PRD section 1 has no longer-term vision sentence.
- Fix: one sentence at the end of section 1 (open-source component for Ignition Perspective, flow first after MVP).

## B. Success criteria and risks not carried over

### B1 (H). Brief "Key risks" has no home in the PRD
- Input: Brief, Key risks: (1) toolchain weight (Java 17, Gradle with IA module plugin, Node, module signing; one person maintains it; spike tests it first); (2) Perspective client coupling (client bundle compiles against IA client packages, an 8.3.x upgrade can break it); (3) alarm presentation needs engineering review; (4) basemap privacy (tiles requested from outside the network; Mapbox token readable by every viewer's browser). BA Parked adds: Designer props editor for arrays of objects, maintenance of a second product.
- PRD: no risks section. Only (3) is carried (FR-6 Notes, PA Template follow-up). NFR-7 touches unverified SDK claims. Risks 1, 2, 4 and the two BA extras are absent from PRD and PA.
- Fix: add a "Risks" section (after 8 Open questions) with the six items and a mitigation each, or at minimum a PA "Risks carried to architecture" list.

### B2 (H). Spike and its go/no-go decision are missing
- Input: Brief, First step: 1 to 2 days building a blank module and a MapLibre canvas on a Perspective view on a live 8.3 Gateway, one edit returned as an event, plus a check that alarm counts aggregate on tag folders and UDT instances. "Go when the module builds and runs within two days and the round trip (props in, event out) works. No-go when the toolchain or the Perspective client API takes most of the two days. Then the answer is a better editor page on the built-in Map, and this brief records why."
- PRD: only Open question 6 (alarm aggregation, "to check in the spike") and PA "read before the spike". No go/no-go criteria, no fallback, no statement that the whole PRD is conditional on the spike.
- Fix: add a "Gate: the spike" paragraph to section 6 (MVP scope) or section 8, with the go and no-go criteria and the fallback; mark section 4 as conditional on go.

### B3 (M). Basemap privacy contradicts or is hidden by the token wording
- Input: Brief, Key risks: "Mapbox needs a token that every viewer's browser can read" and tiles leave the customer's network.
- PRD: FR-32 and NFR-5 say tokens come from the project's secret store "never from a view or a file in git". This is true of storage but silently omits that the token still reaches every viewer's browser, so a reader may think it is protected.
- Fix: add a FR-32 consequence or a note: the token is exposed to the browser by design; use a restricted/URL-scoped token; no-basemap mode and (later) offline tiles are the answer for closed networks. Add as a risk (B1).

### B4 (M). Success criterion 3 wording and target date
- Input: Brief, Success criteria 3: "a pin is moved and a property edited, and both edits reach the page". Criterion 1: "map lives in Map Studio's database instead of the git registry". Target "end of January 2027" - "a target, not a deadline".
- PRD: SM-3 says "reach the map store" (explained by the storage change, not a gap). Date and "not a deadline" carried. Brief criterion 4 (responsive on demo field) is NFR-1, not an SM. No gap except the page-event interface (see C2).
- Fix: none needed; optionally add a one-line SM for NFR-1 so criterion 4 is measurable.

### B5 (L). Open-source readiness criterion
- Input: Brief, Success criteria: "a stranger can install it from the README, comes after the owner has validated it in the template."
- PRD: 6.2 lists open-source release as out of scope but drops the "stranger installs from the README" test.
- Fix: add the test wording to 6.2.

## C. Research items in BA "Ranked for the first version" not covered

| # | Ranked item | PRD coverage |
|---|---|---|
| 1 | Mode in words + glyph, Esc to Select | FR-8 |
| 2 | Browser-local editing, one event per finished edit, editing features in a separate source, optimistic UI that rolls back with a message | NFR-2 covers local + per finished edit. Separate source and rollback-on-failure are not stated; FR-29 instead keeps the edit unsaved in the browser (different behaviour, consistent with the memlog "unsaved edits kept"). Put the separate source in PA technical leanings. |
| 3 | Non-drag alternative for every drag | FR-14, FR-15, NFR-3 |
| 4 | Vertex and midpoint handles, snap indicator, snap toggle | FR-15, FR-16 |
| 5 | Finish by double-click/Enter/button, Esc cancels, Backspace removes last vertex | FR-14, FR-8 |
| 6 | Full undo/redo (moves, inserts, deletes, property edits) | FR-17 |
| 7 | Validation while drawing in plain words | FR-19 (self-intersect, <2 vertices only; see C1) |
| 8 | Skippable tour and empty state | NOT COVERED (A2) |
| 9 | Neutral grey, glyph+word state, ring+label selection, 3:1 contrast, label halos | FR-2, 4.1 NFRs; label halos NOT COVERED (C3) |
| 10 | Phone: 44 px, long-press, offset drag, Undo bar, bottom sheet | FR-27, FR-28, FR-4; leader line, ~48 px offset and sheet handle not stated (L) |

### C1 (M). Validation scope narrower than the research
- Input: BA Map editing, Validation: min/max area, not self-intersecting; "check orphan nodes and duplicate ids before an edit is sent". Properties: stable id "never reused".
- PRD: FR-19 covers self-intersection and fewer than two vertices. Orphan nodes and duplicate ids not mentioned; duplicate names are handled (FR-11), ids are not.
- Fix: extend FR-19 consequences (orphan line ends, duplicate id) or note in PA that ids are system-generated and never reused.

### C2 (M). Keyboard and accessibility details
- Input: BA Accessibility: "arrow keys nudge a selected point, Tab cycles items, Enter finishes (unconfirmed)"; 24 px minimum for toolbar buttons and handles (WCAG 2.5.8) with 44 px touch.
- PRD: NFR-3 says "the tools usable by keyboard" and 24/44 px. Nudge and Tab cycling are not testable consequences.
- Fix: add a consequence to FR-15 (arrow keys nudge a selected point; Tab moves between items).

### C3 (L). Label halos, collapsible legend, muted basemap
- Input: BA Operational cartography: halos in the theme background colour; "a muted, low-saturation basemap under the data"; "a collapsible legend in words and glyphs".
- PRD: FR-3 covers collision and minzoom only. Halos, muted basemap and legend are not mentioned.
- Fix: add to FR-3 (halo) and FR-2/FR-32 notes (muted basemap); legend as a candidate FR or UX-spec item.

### C4 (L). Split semantics and computed values
- Input: BA Splitting: split inherits attributes "keeping the parent id and a sequence". BA Properties: computed length and area, direction, from/to node ids, parent line id and split sequence.
- PRD: FR-15 splits into two lines that keep kind and properties; no parent id or sequence, no computed length/area.
- Fix: add parent id and sequence to the FR-15 split consequence; leave other properties to the kind registry in the architecture.

### C5 (L). Import order and multi-select details
- Input: BA: "GeoJSON first, then CSV, KML and shapefile (unconfirmed)"; lasso selection; bulk edit capped at 500 features.
- PRD: FR-23 to FR-25 cover CSV, KML, GeoJSON; no lasso (rectangle only), no cap, no priority order. Shapefile not wanted. Acceptable; note the 500 cap in PA if wanted.

### C6 (M). Kind registry and the CORE kind list
- Input: BA Object catalogue: CORE kinds listed (site, well pad, RTU/comms tower, wellhead, tank battery, compressor station, booster, meter station, pig launcher/receiver, block valve, tap/tie-in as the pipeline split point, pipeline segment, lateral, lease road, geofence, region, site footprint). Properties: "Keep kind-specific fields in a kind registry" with common fields (stable id, state enum, quality, alarm summary, link target, parent id, layer/group, visible zoom range, z-order, label template, created/modified/author).
- PRD: FR-9 says "core icon set for the oil and gas kinds" without naming them; FR-30 keeps who/when; zoom range in FR-3. The CORE list is not in PRD or PA, so "core icon set" is untestable. Layer/group, z-order, label template, notes are absent.
- Fix: add the CORE kind list to PA (or an FR-9 consequence listing them), and list which common fields the first version stores.

## D. Parked items the PRD and its addendum do not mention

### D1 (H). Supply chain
- Input: BA Parked, Supply chain: "a signed .modl from a GitHub release, pinned by SHA-256 and certificate fingerprint in the host's modules/modules.lock.json, baked into the private Gateway image; never a .modl in git." Open items: "Signing key custody and rotation".
- PRD: NFR-6 has "a signed .modl, installed through the host's module lock" only. Missing: GitHub release as the source, SHA-256 + certificate fingerprint pinning, baked into the private image, never a .modl in git, key custody and rotation. PA lists module-signer but not custody.
- Fix: expand NFR-6 or add PA "Supply chain" with these points and the open item "signing key custody and rotation" (owner: architect).

### D2 (H). Data contract and events to the page
- Input: BA Parked, Data contract: `nodes`, `edges`, two-way `selected`, `basemap`, `options`, and events (`onSelect`, `onOpen`, `onViewport` growing edit events); "GeoJSON is the interchange format"; "One runScript binding per page, never a tag subscription per item"; "The module emits edits as events and leaves storage and approval to the host".
- PRD: the storage half is deliberately reversed (map store). But the rest vanished: no mention of component props, events (select, open, viewport, edit) or of selection exposed to the page; GeoJSON as interchange; the one-binding-per-page performance rule. NFR-8 versions "parameters, the asset contract, the kind list and the CSV template" but not events. The memlog "Concerns confirmed" explicitly names a public props and events contract.
- Fix: extend NFR-8 to include events and the published selection/viewport state; add a note in PA (events survive for page integration, GeoJSON interchange, one scripted binding per page for live values with no per-item subscriptions, which also bounds NFR-1 at scale). Decide whether edit events still fire alongside the store write.

### D3 (M). Module shape and swappable renderer
- Input: BA Parked, Module shape: Gateway hook (Java 17) registering component and props schema; client bundle (TypeScript, React, MapLibre GL JS, deck.gl); optional Designer part; "The renderer is a swappable layer inside the bundle". Risk: Designer props editor for arrays of objects.
- PRD: PA technical leanings name MapLibre/deck.gl/Terra Draw; the swappable renderer (basis for "a second renderer" in 6.2) and Designer part are absent.
- Fix: one line in PA technical leanings.

### D4 (M). What the built-in Map got wrong [live 8.3.9]
- Input: BA Parked, Risks: array items get no schema defaults (marker without `popup` crashes); `props.style` never reaches the Leaflet container; no `zIndexOffset`; custom control views mount at default size; marker click also fires `onMapClick`; `onVectorClick` has no lat/lng. "To avoid repeating."
- PRD/PA: absent. FR-1 and FR-4 behaviours (click handling, defaults) are where these would bite.
- Fix: add as an PA list "Built-in Map defects to avoid" and a consequence in FR-4 (a click on an item does not also fire a map click; missing optional parts never crash).

### D5 (M). Open items from the brief addendum
- Input: BA Open items: Nader's feature list (video not fetched); built-in Map editing/clustering/animation confirmed absent on a live Gateway (architect); signing key custody; "Licence and 2026 maintenance of every library before it becomes a dependency" (architect); module id and npm package renamed.
- PRD: only rename (Open question 2) and licence of the module itself (Open question 1). Library licence/maintenance check (Terra Draw, MapLibre, deck.gl, icon seeds, GeoNames attribution) and the live confirmation of built-in Map absence are not tracked. PA says GeoNames needs attribution but no check task.
- Fix: add two open questions or a PA "Open items" table.

### D6 (L). Naming, MapWeave, Edge reasons
- Input: BA Parked: module id `com.aoindustrial.perspective.flowmap`, npm `@aoindustrial/perspective-flowmap` (rename); MapWeave ruled out by the template's no-licence-fee rule (UX-36); Edge "out; the template's Edge profile keeps the built-in Map."
- PRD: rename in Open question 2; MapWeave named in 6.2 without the UX-36 reason; Edge out in non-goals without "template keeps the built-in Map" (this affects the template follow-up, which should say Edge pages stay on the built-in Map).
- Fix: add the reasons as short parentheticals in 6.2 and 5, and the Edge note in PA "Template follow-up".

## E. Possible contradictions

- E1 (M): Basemap token wording (B3) can read as a security guarantee the brief says does not exist.
- E2 (L): Brief scope says features are "matched to existing assets" and imports CSV/KML/GeoJSON; PRD FR-24 matches only by name. Brief says nothing more, so no conflict; the BA's "Import order" and the memlog "auto-match by name" agree.
- E3 (L): SM-1 "Validates FR-1 to FR-32" omits FR-33 (search) which the memlog added later; update the range. Section numbering also jumps from 2.1 to 2.3 (no 2.2).
- E4 (L): Brief "Out: replacing the alarm table" matches PRD non-goal and FR-5 (embeds the built-in table). Consistent.

## Suggested order of fixes
1. Add Risks section (B1) and spike gate (B2).
2. Add design-principles / tone paragraph and the first-run FR (A1, A2, A3).
3. Expand NFR-6 (supply chain, D1) and NFR-8 (events, D2); fix the token wording (B3).
4. Add the CORE kind list (C6) and library licence open items (D5).
5. The rest into PA.
