---
type: epic
title: "Everyone reads live state from the map"
parent: initiative-flowmap
covers: ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R36", "R37", "R39", "R40", "R41", "R42", "R43"]
sources: [_bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md]
companions: [_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md, _bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md, _bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md]
after: []
refined: true
risk: high
---

# Everyone reads live state from the map

## Description

The map everyone opens: the one project map on a basemap, opened on a starting area, icons with comms, the icon KPI and alarms from the Alarm Metrics folder, lines with state, labels that thin out, search, popups (a default popup with an alarm summary, or a project's custom popup view) with links, a legend and a Needs you summary, matching what the template's current map shows.

## Outcome

A viewer sees each site's state and reaches its page from an alarm in two clicks, and a normal field shows no hue (prd SM-5, SM-C2).

## Requirements

- R1 (parent R1; prd FR-1): Every Map Studio component in a project shows the one project map, opening on the starting area it is given; two components given different starting areas show the same map items.
- R2 (parent R2; prd FR-2, NFR-2, NFR-9; architecture AD-6, AD-16): The Gateway holds one subscription per project to every live value the kind setups turn on (comms, KPIs, Alarm Metrics, a style rule's source), resolving asset-relative `{asset.path}/...` paths from each map item's base path and full tag paths as the same tag for every map item (owner, 2026-10-27), and sends each open map one `values.batch` per refresh interval (default 10 s; changes only, the whole map on open, reconnect and after a link or kind setup change); point map items draw the kind's glyph, comms state, the icon KPI and alarm state (highest priority glyph, solid or hollow by acknowledgement, digit, optional count), each only where the kind setup turns it on; normal items are neutral grey; switched-off values are never subscribed.
- R3 (parent R3; template docs/map.md section 5 items 2 and 4): Labels give way to each other as the user zooms out, ranked by the kind list, and never overlap at the starting area's zoom; names show from zoom 14, normal items draw as small dots below zoom 12 while abnormal glyphs keep their size and hit area.
- R4 (parent R4; prd FR-33): Any user finds a map item by name or asset in a search field; choosing a result zooms to it and selects it, on a 390 px phone and by keyboard.
- R5 (parent R5; prd FR-34; template docs/map.md section 5): Every item of the template's docs/map.md section 5 (owner, 2026-10-21) is met or listed for engineering review (ER-27): line weight by pipe size, line hue only from alarms with the glyph at the midpoint, dashed for no data or comms lost, thin neutral with no instruments; the flow arrow on the selected line only; map items within 20 m drawn as one shared marker that opens a pick list; Fit and Return; Lines and Names toggles; a tap on the ground clears the selection; Fit keeps until the bounds change; the layout's chip row and top sheets are the listed departure (R6, R15).
- R6 (parent R6; prd FR-4; architecture AD-7): A click or tap on a map item opens Map Studio's default popup with the parts its kind setup turns on, in the order header (kind glyph, name, page link icon), comms with data age, 2 to 3 KPIs, alarms; its values are live while open (pushed between `popup.open` and `popup.close`) and stale values are marked; at 390 px it is a bottom sheet (an ER-27 item against the template's top sheets).
- R7 (parent R7; prd FR-5): Where enabled, the default popup shows an alarm summary for the map item's alarms path (counts by priority, the most important alarms in words) with a View alarms button to the project's alarm page; Map Studio acknowledges nothing.
- R8 (parent R8; prd FR-6; architecture AD-7): Where configured, the popup link shows as an open or pop-out icon in the popup header and goes to a project page or URL with placeholders from the closed list filled from the clicked map item in the browser; a placeholder with no value hides the icon.
- R9 (parent R39; prd FR-37; architecture AD-7): A kind setup's custom popup view `popupView {path, params}` opens instead of the default popup with the map item object as `mapItem`, kept live while open, and each param filled (a literal, one placeholder, or `{asset.path}/<suffix>` resolved against the map item's base path); a missing or failing view falls back to the default popup; the spike's `popupView` prop is retired.
- R10 (parent R36; prd FR-32; architecture AD-12): The setup's basemaps None, OpenStreetMap and Satellite are offered, with the provider's attribution always shown; with none, map items draw on a blank background; a token comes only from the secret the setup names and must be a public, restricted token; the Mapbox vector style option is deferred, not dropped.
- R11 (parent R37; prd NFR-1): On the 30-pad scale set with live values, pan and zoom run at 60 frames per second in a laptop browser, measured by the repeatable performance script and recorded release to release.
- R12 (parent R40; prd FR-38, FR-39; architecture AD-11, AD-16): A kind setup's style rule (States, Bands or an expression, from a tag or a KPI) picks a preset from the closed list in `common/`, worked out on the Gateway in the shared live-value cache and sent as the preset name in `values.batch`, so icons, lines, popups and the preview agree (owner, 2026-10-28); points, lines and areas draw it, alarm state over a value style over an area's category tint, a stale source drawing only as stale; per-item overrides apply; a preview component draws every state or band in its preset for the kind setup screen; an expression is an Ignition expression, checked live on 8.3 before it is built, and if module code cannot evaluate it the expression type goes to the backlog while States and Bands ship (owner, 2026-10-28).
- R13 (parent R41; prd FR-40; architecture AD-7, AD-11, AD-16, AD-19): Instruments draw at their place on their line; the line draws per segment from the worst of the instruments at the segment's two ends (dashed when either is stale, normal with none, alarm state winning), worked out where style rules are; a line's popup lists its instruments in order with live values and distance plus the line's KPIs and alarms; a click opens it at the clicked segment with the instruments at its ends highlighted; an instrument's alarm draws at its place on the line.
- R14 (parent R42; prd FR-41): View mode offers a legend of every glyph and line look the map draws, in the map's words, collapsed to a button bottom-left and opened on request by click or keyboard, holding the Lines and Names toggles, clear of the bottom-right App Bar corner.
- R15 (parent R43; prd FR-42; architecture AD-6): View mode shows a Needs you summary counting map items in alarm, comms lost and stale, each with glyph and word, from the same batch; it opens a list ranked alarms by priority, then comms lost, then stale, a row zooming to and selecting its item; with nothing to attend to it reads All OK in neutral; at 390 px it shares one expanding top bar with search.
- R16 (owner, 2026-10-28, ER-27 reviewer; architecture AD-11): Comms lost draws in its own theme token `comms-lost`, in the magenta or purple family that no alarm, preset or tint hue uses, never read as an alarm, always with the comms-lost glyph and the words; stale takes no colour (glyph, dashed ring or line, and the word); a docs page shows the alarm priority tokens, the presets, the tints and `comms-lost` in both themes for the engineering review (ER-27) before this epic's release.

## Constraints

- The initiative's Constraints bind here, above all NFR-2 and NFR-9 (one batch per page per refresh interval, never a subscription per map item per session; popups live while open), NFR-4 and NFR-11 (colours only from the host project's theme tokens, neutral normal states), NFR-7 (every SDK claim unverified until seen on a live 8.3 Gateway) and the ER-27 review of alarm presentation before release.
- Comms lost in a colour departs from the template's reviewed rule (template docs/ux.md: comms lost never a colour) and from DESIGN.md ("Comms lost and stale have no colour"); it ships only after ER-27 with this epic's hue tokens (owner, 2026-10-28).
- Alarm Metrics are read by Java subscription only (`TagManager.subscribeAsync`; `readAsync` answers `Bad_Unsupported`; docs/platform-checks.md, story 3, check 1).
- Releases follow RELEASING.md's checks by release type (entry 4): this epic's release is minor, so one rehearsal on the template's test stack before the tag and the release smoke after it.

## Done when

- Two components with different starting areas show the same map items.
- Icons and lines show comms, the icon KPI and alarm state from Ignition's alarms, refreshed in one batch per page on the project's interval.
- Every item in the template's `docs/map.md` section 5 is met or listed for engineering review.
- Search, the Needs you summary, the legend, the default popup with its alarm summary, a custom popup view and popup links work on desktop and at 390 px.
- Pan and zoom run at 60 frames per second on the 30-pad scale set.
- Comms lost draws in its own token, stale in none, and the owner's engineering review (ER-27) of the hue tokens, presets, tints, instrument alarms, Needs you counts, legend and bottom sheets is recorded.
- Verified on the template's test stack with the field simulator's live tags.

## Boundaries

- Hands on: the map view and popup that epics 4 to 7 build on.
- Kind setups are read here, written in epic-editing; for this epic they can be seeded in the map store.
- Not here: any editing; the kind setup screen and its tag browser (epic-editing); the Mapbox vector style basemap (deferred).
- Touch point: `ign-scada-template` - its cards and docs/ux.md take the comms lost colour so an operator sees one convention; owner: epic-template-cutover (owner, 2026-10-28).

## References

- parent - _bmad-output/initiative-flowmap/initiative-flowmap.md, section Requirements
- prd - _bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md
- prd - section 4.1, 4.2, 4.10, NFR-1, NFR-9
- architecture - _bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md, AD-6, AD-7, AD-11, AD-12, AD-16, AD-19 (adopted companion)
- template - ign-scada-template docs/map.md section 5 (the parity list for R5) and docs/ux.md section 11 (alarm presentation, ER-27)
- research - _bmad-output/initiative-flowmap/brief-flowmap/addendum.md, map UI practices
- design - _bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md, the visual identity (adopted companion)
- experience - _bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md, the behaviour (adopted companion)

## Notes

- Decision: 2026-10-26 Names, licence (Apache-2.0) and the Alarm Metrics answer are recorded in the initiative's Notes and apply here.
- Waits on epic-map-store-and-data because: map items, kinds and kind setups readable from the map store.
- Decision: 2026-10-26 The owner approved value-driven styles and area category tints (initiative R40; prd FR-38, FR-39; architecture AD-11, AD-16); they are drawn here, R40 is in this epic's covers, and a stale value shows only as stale with no value style. Entry 1 in tickets/tickets.toml holds that work ahead of this epic's refinement and cites initiative R40 until the epic has its own Requirements; refining the epic re-slices it with the rest, id kept.
- Decision: 2026-10-27 The owner approved instruments on lines (initiative R41; prd FR-40; architecture AD-7, AD-11, AD-16, AD-19). This epic draws them: instruments at their place on each line, the line split into line segments, the line popup listing its instruments in order with their live values plus the line's KPIs and alarms, a click on a line opening it at that segment with the instruments at its ends highlighted, an instrument's alarm at its place on the line, and the instruments style source, each segment drawing the worst of the instruments at the segment's ends. R41 is in this epic's covers; entry 2 in tickets/tickets.toml holds the work ahead of refinement, waiting on epic-map-store-and-data entry 14 (the stored attachment) and on entry 1 (the style rule drawing).
- Decision: 2026-10-27 Owner: each line segment draws from the instruments at its two ends, as the template's map does, not the whole line from all its instruments (entry 2).
- Decision: 2026-10-27 UX workshop (ux-map-studio, 2026-10-27): DESIGN.md and EXPERIENCE.md are this epic's companions; View mode follows EXPERIENCE.md (Information Architecture, Component Patterns, State Patterns, UJ-5). This epic gains R42 (legend, collapsed to a button) and R43 (Needs you summary, ranked list, All OK in neutral, one expanding top bar with search at 390 px); entry 3 in tickets/tickets.toml holds them ahead of refinement. R6 now fixes the default popup's order (header with the page link icon, comms with data age, 2 to 3 KPIs, alarms) and R8 makes the page link a header icon. R36: the first version offers None, OpenStreetMap and Satellite; the Mapbox vector style option is deferred, not dropped. Phone popups are bottom sheets, an engineering review item (ER-27) against the template's top sheets.
- Decision: 2026-10-27 Owner: a custom popup view is `popupView {path, params}` (initiative R8, R39; prd FR-6, FR-37; architecture AD-7): this epic renders it, passing `mapItem` and each param filled from the clicked map item, and fills the popup link's placeholders from the same closed list; epic-map-store-and-data entry 9 stores and validates them.
- Decision: 2026-10-27 Owner: a kind setup's tag paths come in two forms, asset-relative `{asset.path}/...`, resolved from each map item's own base path, and full tag paths, the same tag for every map item of the kind; an override's tag paths are full paths (initiative R15; architecture AD-16). This epic resolves both when it subscribes live values.
- Decision: 2026-10-28 Owner (ER-27 reviewer for 0.2.0): comms lost gets a colour on the map, because it is critical and must not get lost, replacing "comms lost and stale have no colour at all" (EXPERIENCE.md) and departing from the template's reviewed rule (template docs/ux.md: comms lost "never a colour"). Still to settle in this epic's refinement: the colour (its own theme token, distinct from every alarm hue so it is never read as an alarm, keeping the `comms-lost` badge and the words, since colour is never the only signal), whether stale follows, and whether the template's cards change to match so an operator sees one convention. It is an alarm presentation change: it goes to engineering review (ER-27) again with this epic's hue tokens before its release.
- Decision: 2026-10-28 Owner ("agree with all recommendations, add the story"): entry 4 "Shorter release checks" is added first in this epic's build order, so its release uses it: a release smoke script, perf runs by measure, and checks matched to the release type in RELEASING.md. Release tooling, so it cites no requirement.
- Decision: 2026-10-28 Owner ("agree with all"), refinement: style rules, the instruments aggregate and stale are worked out on the Gateway in the shared live-value cache and the batch carries the preset name (R12, R13); the expression language is Ignition's, checked live first, with States and Bands shipping and the expression type moving to the backlog if module code cannot evaluate it. Settles the open question of AD-16 and the backlog spike `spike-style-rule-expression-language.md`.
- Decision: 2026-10-28 Owner: comms lost takes its own token `comms-lost` in the magenta or purple family, distinct from every alarm, preset and tint hue; stale takes no colour; the template's cards change to match at the cutover (epic-template-cutover); the alarm priority tokens and the area tints are chosen by the stories that draw them, and all hue tokens go to one ER-27 review before this epic's release (R16).
- Decision: 2026-10-28 Owner: Satellite stays on Mapbox (initiative Decision 2026-10-26); the owner confirms Mapbox's terms before this epic's release, MapTiler being the switch if they fail. OpenStreetMap's public tile servers ask for attribution and light use; docs/setup.md says so for client sites.
- Open question: Mapbox's Product Terms for satellite raster tiles in MapLibre at client sites (architecture Deferred); the owner's to confirm before this epic's release.
- Decision: 2026-10-28 Planned (owner, "agree with all"): entry 5 is the tracer bullet, live values from the shared subscription to an icon and its default popup on the dev stack; build order 4, 5, 6, 7, 1, 2, 8, 9, 3, 10, then the refactor sweep (11), the hue tokens and the ER-27 review pack (12), and release 0.3.0 (13). The ER-27 steps of entries 1 to 3 move to entry 12, one review before the release. Thirteen entries, past the usual twelve: offered no split, since entry 4 is built and 11 to 13 close the epic.
- Decision: 2026-10-28 Owner ("agree with all"): before a minor release's tag the rehearsal stays the template's full test stack with a throwaway-signed build (RELEASING.md, Checks by release type) until the release smoke has run on the template's image; entry 4 goes to its own pull request.
- Decision: 2026-10-28 Owner ("agree with all"), the popup and marker info UX review (ux-map-studio/review-popup-and-marker-info.md): D1 `popup-width` 320 px (was 290) and a new `popup-max-height` 480 px, the line popup staying 350 px; D2 16 px side padding in every popup and sheet region, icon buttons 32 px on desktop and 44 px on the phone; D3 `popup-offset` 22 px and `popup-tip` 10 px on the popup card; D4 a marker's KPI line from zoom 15, its name from zoom 14; D5 the map's state chip says only "Stale" or "Comms lost", the popup carries the long form and data age. Entry 8 builds the popup items and updates DESIGN.md's tokens with them; entry 7 builds the marker items.
- Decision: 2026-10-28 Owner ("agree, add entry 14"): the View-mode controls are arranged as designed in a new entry 14 after entry 1: one zoom card top-right (plus, zoom level, minus, Fit, Return), the basemap choice in the Legend panel bottom-left (viewers never reach Edit mode's Layers rail, which keeps its own switch), the spike's Draw a line off View mode; entry 3 then fills the legend panel.
- Decision: 2026-10-28 Owner: entry 10 (frame rate and batch cost) is dropped to reach 0.3.0 sooner; R11 is shown by the owner's laptop reading taken in release 0.3.0 (entry 13), which now covers R11. Entry 3 (Needs you and legend) is kept and starts after entry 9.
- Decision: 2026-10-29 Owner: keep the close row entry 8 added above a custom popup view (Map Studio's own close, 32 px on the card, 44 px with the handle on the phone sheet), so every popup closes the same way; it goes to entry 12's ER-27 review with the sheet.
