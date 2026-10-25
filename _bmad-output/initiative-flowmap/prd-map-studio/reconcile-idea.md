# Input reconciliation: docs/idea.md against the Map Studio PRD

Input: `docs/idea.md` ("Flow map module for Ignition Perspective: idea", Oct 25 2026, Andy Ott).
Compared with: `prd-map-studio.md`, PRD `addendum.md`, brief `addendum.md` (section "Parked for the PRD and architecture"), and both `.memlog.md` files.

Not gaps (changed on purpose, per the logs): editing in scope; flow animation deferred (PRD 6.2); module stores the map in a project-named database and is the source of truth (reverses "No new database" and "module stores nothing"); product renamed Map Studio / `ao.mapstudio`; phones may move a point and edit properties; scale of 300 sites and 2,000 segments is a later target (brief success criterion 4); MapWeave is a possible later second renderer; Edge Gateways out; open-source release deferred.

Severity: H = fix before architecture starts, M = carry into PRD or architecture explicitly, L = note only.

## Gaps

### G1 (H). Live-data load: one binding per page, no per-item tag subscription

- **Idea says** (Data contract): "One call per page every 10 s replaces thousands of per-row tag subscriptions per session, which is why the pilot forbids the latter for lists." (Principles): "**One binding per page.** The arrays arrive as one props update; never a tag subscription per node or edge." Also "Perspective-native. Props in, events out, nothing else: no direct tag reads, no database calls, no `system.*` from the browser."
- **PRD has:** FR-2 and FR-4 say icons and popups show comms, up to 4 KPIs and an alarm count from relative tag paths, "with live values", and FR-4 "values update live". NFR-2 limits Gateway calls for editing only. The brief addendum keeps the rule only inside the old nodes/edges data contract ("to be reworked for editing"). Nothing in the PRD says how live values reach the browser or bounds their cost.
- **Why it still holds:** the template's list rule (`ops.attention`, `ops.tanks`) is a hard template constraint, and the new design makes it worse: every icon can carry comms + KPI + alarm count from tag paths, so 300 sites could mean 1,000+ subscriptions per session and an alarm query per icon.
- **Suggested fix:** add an NFR (and an architecture decision) "Live values arrive as one batched update per component per refresh interval from the Gateway, resolved from kind setups server-side; no per-item tag subscription or alarm query per item; refresh interval stated (idea used 10 s; FR-29 says a few seconds)". Keep the boundary sentence "the browser makes no direct tag, database or `system.*` call; everything goes through the module's Gateway hook with the role check of FR-7".

### G2 (H). The spike has no go/no-go or measures in the PRD

- **Idea says** (The first spike): "Measures to record: hours to a green build; bundle size; frame rate with the 30-pad scale registry; the 10 s props payload in KB (the load driver counts frames); what broke on the phone." Go: "skeleton builds in under two days, the live view renders ... at 390 px, and the payload and frame rate leave room for 300 pads." No-go: toolchain or client API "fights back for most of the time", answer is the built-in Map with styled lines.
- **PRD has:** only open question 6 (alarm aggregates, "to check in the spike"). The brief keeps a shorter go/no-go (builds in two days, props in / event out round trip) and the alarm-aggregate check; the measures (build hours, bundle size, frame rate, payload KB, phone breakage) appear in no document. The brief addendum open item "Built-in Map editing, clustering and animation confirmed absent" is the only other spike hook.
- **Suggested fix:** add a short "Spike (first story)" to the PRD or hand it to the architecture as acceptance: go/no-go from the brief plus the measures, recorded numbers for bundle size and frame rate on the Mesa field, and the added checks the PRD itself created (alarm aggregates on folders and UDT instances; round trip of one save through the Gateway hook to a database; role check on the Gateway). Say where the numbers are recorded.

### G3 (H). No dependency licence / no per-deployment fee rule

- **Idea says** (Principles): "**Open source, licence-free on the Gateway.** MIT for the module, BSD and MIT for the renderer; no dependency that charges per deployment (the pilot's UX-36)." Why: "a client Gateway carries no licence fee."
- **PRD has:** open question 1 asks only which licence the module uses when open-sourced. The brief addendum notes UX-36 against MapWeave, an open item "Licence and 2026 maintenance of every library before it becomes a dependency", and that icons must not derive from the AGPL-window OpenBridge set. The PRD addendum notes GeoNames needs attribution. No PRD requirement states the rule, and the new features add dependencies (Terra Draw, boundary and city data, icon seeds, satellite imagery terms).
- **Suggested fix:** add NFR "Licensing": every runtime dependency, dataset and icon is permissively licensed with no per-deployment or per-developer fee (UX-36); no AGPL-derived assets; attribution obligations (GeoNames, Natural Earth is public domain, basemap provider terms) listed in the repo. Link open question 3 (satellite provider "on what terms") to it. Keep open question 1 (module licence) separate.

### G4 (M). Existing map data and its consumers: migration, export and coexistence

- **Idea says:** the pilot's `_Model/Map` document and `_Summary` rollups feed the map, the attention board and the "pad page paths"; "GeoJSON is the interchange format at the edges: the pilot already imports and exports it for its map editor (PV-3 phase 2)"; PM question "Does the module replace the pilot's map page or sit beside it as a second page until it is proven?"; the pilot's generators "would emit it the way they emit the built-in Map, inside the same byte gates"; Edge profile keeps the built-in Map.
- **PRD has:** import of CSV, KML, GeoJSON (FR-23); SM-1 replacement; addendum "Template follow-up" lists retiring `prov` map steps, `map_draft` tables, `ops.mapedit` and moving `/map`. There is no export (GeoJSON or CSV) anywhere, and no version history (non-goal), so the map store has no backup or round-trip path. The follow-up does not say what happens to the other consumers of `_Model/Map` (and the line segments split at taps with chainage that `_Summary` and the attention/map pages use), to the generators and byte gates (`scripts/gen`, `check.py`, `ui/specs`), to the PV-29 load harness, or to the Edge example, which still needs the built-in Map fed from somewhere once the git registry no longer owns map data. No statement of coexistence during the cut-over or of the one-time load of the Mesa field.
- **Suggested fix:** add an export requirement (GeoJSON, CSV template format round trip) as a safety net given no history; add to the addendum's template follow-up the consumers listed above and a decision on how `_Model/Map` is produced from the map store (or retired) for Edge and the rest of the template; state the one-time Mesa load and whether the old map page stays until SM-1.

### G5 (M). Client-package pinning, upgrade gate, platform versions

- **Idea says** (Risks): "Pin the package versions to the Gateway in the lock; a stack run on every upgrade, as for every module." Architect question: "Which Perspective client package versions, and how is an 8.3.x upgrade gated?" Principles: "Ignition 8.3.x, Java 17, Jython untouched. The module adds no Gateway scripting."
- **PRD has:** NFR-6 "Ignition 8.3 full Gateways only ... signed .modl through the host's module lock". The risk "Perspective client package coupling" is listed in the brief addendum without its mitigation or any gate. No Java version, minimum 8.3.x, or "no Gateway scripting by the module" line.
- **Suggested fix:** add to NFR-6 the supported 8.3.x range, Java 17 for the build, client package versions pinned to the Gateway version, and a stack run on every Gateway upgrade as the release gate. Add "Jython untouched" as a constraint on the storage mechanism (open per PRD addendum: Gateway hook, named queries or scripts), so the choice is checked against it.

### G6 (M). Performance has no measurable target and no design-size constraint

- **Idea says:** "One Gateway, 300 sites and 2,000 segments is the size to design for (the pilot's PV-29 load harness measures it); six sites is the demo." Risk: "2,000 segments and 300 sites animated at 60 fps on a laptop browser and a phone; a 10 s props update that re-sends every array"; mitigation "diff props in the bundle so only changed ids redraw".
- **PRD has:** NFR-1 "stay smooth ... 300 sites and 2,000 segments are a later target, not a first-version requirement" - a deliberate deferral, but "smooth" is untestable and the design-for intent is lost. Brief: "The demo field sets the scale."
- **Suggested fix:** keep the deferral for acceptance, but state in NFR-1 a measurable demo-field target (a frame rate on a named laptop and phone class, and an edit visible before save) and a design constraint "architecture must not preclude 300 sites / 2,000 segments (updates delta-based, only changed items redraw)". Use the spike measures of G2 as the numbers.

### G7 (M). Component surface in the Designer: props, events, palette

- **Idea says:** Designer part (palette entry and props editor) is a v1 item; props `basemap`, `options` (animate, speed, units, label density, theme tokens), two-way `selected`, events `onSelect(id)`, `onOpen(page)`, `onViewport(bounds)`. Risk: "Arrays of objects edit poorly in the Designer; a schema the Designer rejects blocks the component" with mitigation "Use the schema shapes Embr Charts uses ... the pages bind the arrays, nobody types them". Idea also: "Phone layout (no zoom buttons, pinch and drag)".
- **PRD has:** the glossary mentions "starting area ... passed as a parameter"; NFR-8 says parameters and formats are documented and versioned. The PRD does not list the component's parameters, selection state, or events a host page can use (for example to react to a selected item, or to open a page), and says nothing about the Designer experience (palette entry, a props editor that does not need arrays since the map is stored). The Designer-editor risk is in the brief addendum but its resolution (props are small now) is not recorded.
- **Suggested fix:** add a small FR for "Place and configure the component": palette entry, starting area, basemap choice, theme/density options, a selected-item output and an item-selected / popup-link event for the host page; state that no array props are typed by hand. Record the Designer risk as largely retired by the storage change, with the residual check in the spike.

### G8 (M). Basemap token reaches the browser; privacy statement

- **Idea says:** "Mapbox needs the token on the client"; "Reuse the pilot's basemap decisions as they stand (none, OSM, Mapbox with the public token)"; basemap switch is "per-Gateway" in `gateways.csv` with the `map_token` secret. Risk: "Tiles leave the site".
- **PRD has:** FR-32 "A basemap that needs a token reads it from the project's secret store, never from a view or a file in git"; the brief names basemap privacy as a risk; open question 3 for the satellite provider. Missing: that a tile token necessarily lands in each viewer's browser, so it must be a public/restricted-scope token (URL-restricted), and that using the secret store is about the repo, not about hiding it from viewers. Also missing: a stated disclosure that tiles and the satellite provider are external requests (an IT/OT boundary point for the template), and whether geocoding stays strictly offline (FR-21 does).
- **Suggested fix:** amend FR-32 / NFR-5: token is public-scope and restricted to the Gateway's origin where the provider allows; served to the browser by the Gateway from the secret store, not stored in the map store; document that basemap requests leave the site and that "none" is the no-egress mode.

### G9 (L). Signing and certificate trust

- **Idea says:** spike signs with "a self-signed certificate"; "One signing key in the supply chain, documented like the Embr anchor in `docs/modules.md`"; lost key means "a new anchor everywhere"; architect question on custody and rotation reaching "every client lock".
- **PRD has:** NFR-6 (signed .modl through the host's lock); brief addendum open item "Signing key custody and rotation" and the supply-chain bullet (SHA-256, fingerprint, baked into private image, never a .modl in git). Largely covered; what is missing is the spike's self-signed first build and the rotation path to client locks.
- **Suggested fix:** none for the PRD; make sure the architecture's supply chain section carries the rotation question and the self-signed spike step.

### G10 (L). Phone first for viewing, not just editing

- **Idea says:** "**Phone first.** Everything must work at 390 px with touch gestures; nothing wider than a phone"; pumpers and operators on the field map on "390 px phones"; no zoom buttons, pinch and drag.
- **PRD has:** phone requirements only for editing (FR-27, FR-28) and the popup bottom sheet (FR-4); search "works on a 390 px phone" (FR-33). UJ-5 (viewer) is desktop. No statement that the whole viewer experience (icons, labels, basemap switcher, search, legend/controls) fits 390 px with no horizontal overflow and touch gestures for pan and zoom.
- **Suggested fix:** one NFR "Phone": every viewer feature works at 390 px, touch pan/pinch, nothing wider than the viewport, 44 px targets; add a phone viewer step to UJ-5 or a check in SM-5.

### G11 (L). Theme tokens: how the host passes them

- **Idea says:** "Colours come from CSS variables the host project passes in; the pilot passes its `--st-*` tokens, night and day"; `options` includes theme tokens; "defaults match the template's style tokens".
- **PRD has:** NFR-4 and the FR-1 feature NFR (colours only from the host's theme tokens, light and dark). Missing: the mechanism and the basemap side - a basemap style that follows the theme (muted, label halos in the theme background; the brief addendum has halos) and the token names the template uses (`--st-*` only, never raw palette variables).
- **Suggested fix:** note in the PRD addendum: tokens read from CSS variables on the page, template contract `--st-*`, basemap style and label halo follow the active theme.

### G12 (L). Naming rationale and ids

- **Idea says** (Naming): do not call it `perspective-map` because "Perspective Map" is the built-in component (`ia.display.map`) and would collide in "every search, palette and conversation"; module id `com.aoindustrial.perspective.flowmap` (reverse domain of aoindustrial.ca, as Embr and Mustry); component prefix `ao.`; npm `@aoindustrial/perspective-flowmap`.
- **PRD has:** Map Studio / `ao.mapstudio` decided; open question 2 on repo, module id and npm renames (also a brief open item). The collision rationale now applies to the name "Map Studio" too (generic against "Map" in Ignition and "Mapbox Studio"), and was not re-checked; the new module id and npm package are not proposed.
- **Suggested fix:** propose `com.aoindustrial.perspective.mapstudio` and `@aoindustrial/perspective-mapstudio`, keep the reverse-domain and `ao.` prefix conventions, and do a short collision check on "Map Studio" (Mapbox Studio, existing Exchange listings) before the repo rename.

### G13 (L). Smaller carried items

- **Hover and viewport:** idea v1 has "tap and hover selection"; `onViewport(bounds)` event and `label density` option. PRD has click/tap and hover text for comms lost only. Decide whether hover is in scope on desktop (FR-2, FR-4).
- **Process rules:** "Keep two rules from the pilot in the BMAD config: no em dashes in any artifact, and every claim about Perspective or the SDK verified on a live Gateway and recorded in claude-ignition-skills." The second is NFR-7; the first (and the repo checker) appears nowhere in the PRD. Add to project context or CI.
- **Open question not carried:** "Pilot feature, a product of its own on the Ignition Exchange, or both?" - the brief vision covers it (template first, then open source); no action.
- **Open question not carried:** "What does flow mean on each line: the meter's rate, the pressure band, or a modelled value when neither exists?" - flow is deferred (6.2), but the note for the PM should keep this question so the flow revisit starts with it, along with the alarm-presentation review of motion and width by rate (ER-27).
- **Basemap-free mode:** answered (FR-32), no action.

## Covered (checked, no gap)

| Idea item | Where it lives |
|---|---|
| State by words and glyphs, never colour alone; ER-27 review | FR-2, Notes under 4.2, SM-C2, brief addendum |
| Supply chain: GitHub release, SHA-256 and fingerprint pin, baked image, no .modl in git | NFR-6, brief addendum (Supply chain) |
| Verified live | NFR-7 |
| Edge Gateways out | NFR-6, non-goals |
| Toolchain weight, client coupling, maintenance, basemap privacy risks | brief addendum (Risks) |
| Scope creep boundary (no device writes, no alarm table replacement) | Non-goals |
| Offline sites: basemap-free mode | FR-32 |
| Labels thin out | FR-3 |
| Renderer swappable (MapLibre + deck.gl; second renderer later) | PRD addendum, 6.2 |
| Open-source licence of the module (MIT or other) | Open question 1 |
