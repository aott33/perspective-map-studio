# Sources digest - Map Studio UX workshop

Read-only extraction, 2026-10-26. Citation keys: INIT = `initiative-flowmap.md`; PRD = `prd-map-studio/prd-map-studio.md`; BR = `brief-flowmap/brief-flowmap.md`; BRA = `brief-flowmap/addendum.md`; ARCH = `architecture-map-studio/architecture-map-studio.md`; EV, EE, EIE, EP = `tickets/epic-viewing|epic-editing|epic-import-export|epic-phone`; ICONS = `docs/icons.md` (not on the main tree: only in worktree `.claude/worktrees/agent-a872638476f3cfa65/docs/icons.md`, draft catalogue 0.2.0); SPIKE = `docs/spike-measures.json` phone, `docs/spike-report.md`; TM = `ign-scada-template/docs/map.md`; TUX = `ign-scada-template/docs/ux.md`; TME = `ign-scada-template/docs/map-editor.md`.

## 1. Users and roles

- **Map editor** (admin or integrator): builds a new field's map, maps a running field with no map, keeps a map right; laptop (PRD 2.1). Admins "might never touch a CSV or a script, so the editor alone has to be enough" (BR, Who this serves).
- **Integrator**: a map editor who mostly provisions by import; same rights, a job name not a permission (PRD 2.1).
- **Operator**: phone in the field, moves a point and edits properties, draws nothing (PRD 2.1). Template's primary user is the lease operator (pumper), 25 to 35 wells, phone in a gloved hand, patchy cellular (TUX 1.1).
- **Viewer**: no editing role; sees map, icons, popups, follows links (PRD 2.1); desktop watcher in UJ-5.
- Roles named by the project: full editing and phone editing separately; save refused on the Gateway without role (PRD FR-7; INIT R9).
- Admin-unfamiliar-with-Mesa test: an admin who has not seen the Mesa demo field lays it out (sites, pipelines split at taps, one geofence, every item linked) with the tools alone, no help, under 30 min (PRD SM-2; BR Success criteria 2; EE Outcome). SM-C1: a feature that slows this is a regression (PRD 7).

## 2. Journeys (PRD 2.2)

- **UJ-1. Sam lays out a field that has no map.** Sam, map editor, laptop, empty map. Picks what to add in any order; form asks name, properties, asset link; location typed (place check: country, province/state, city; "Zoom to location") or picked "the way you set a stop in map directions"; checks against satellite or reference layer; repeats or imports. Climax: field on the map, every item linked; others check it while Sam works. Edges: floating pipeline end, duplicate name flagged, leave halfway nothing lost.
- **UJ-2. Sam keeps a running field's map right.** Opens the tools on the live map; drags two vertices and inserts a third on a lateral; adds P31 with "Add another like the last", links it; draws a lease geofence, double-click to finish. Climax: P31 icon shows comms and pressure as soon as linked; viewers see changes with no release step. Edge: wrong vertex, one undo.
- **UJ-3. Jordan provisions a field from files.** Integrator, 120-pad field, laptop, tools open on empty map. Downloads meter CSV template; imports KML/GeoJSON and CSV (appear unlinked); matches by name in one pass then one by one; writes pad kind setup (comms, pressure KPI, alarms path, popup, link `/pad/{asset.id}`); selects twenty pads on a route and bulk edits. Climax: every pad shows comms, pressure, alarm count from one kind setup. Edge: unmatched items stay, unlinked count shows.
- **UJ-4. Alex fixes a pin from the field.** Operator at P12, 390 px phone, pin 200 m off. Taps P12, long-press drag, pin drawn above finger; Undo bar after drop; edits access road note in a bottom sheet. Climax: pin sits on the pad in satellite view. Edge: wrong drop, Undo.
- **UJ-5. Riley follows an alarm from the map.** Viewer, desktop, no tools. CTB1 icon: normal comms glyph, alarm glyph, count 2; click opens popup (details, comms, KPIs, alarm summary); "View alarms" to alarm page filtered to CTB1, acknowledges there, then CTB1 page `/ctb/CTB1`. Climax: alarms or own page within two clicks. Edge: comms lost, icon and popup say "Comms lost", values stale.

## 3. Viewing requirements

- FR-1 one project map; starting area param; no area fits all items; empty map default view (PRD 4.1).
- FR-2 icon = kind glyph + comms + icon KPI + alarm (highest priority glyph, solid unacked, hollow acked, digit label, optional count); normal neutral grey; all live values off = plain icon, no tag reads; selected item ring and name; lines and areas use kind style (PRD 4.1).
- FR-3 labels give way on zoom-out, ranked by kind list; none overlap at starting zoom; per-kind min zoom for labels and icons.
- FR-33 search by name or asset, results with kind as you type, zoom and select (lines and areas fitted), works at 390 px and keyboard only.
- FR-34 parity with template map: line weight by pipe size, hue of highest alarm, dashed for no data or comms lost, alarm glyph and digit at midpoint; flow arrow on selected line only; shared marker within 20 m with pick list; Fit and Return; line and name toggles; TM section 5 is the checklist, each met or listed as a deliberate change.
- FR-38 value-driven styles (States, Bands, or expression returning a preset), live preview of every state, per-item override; alarm wins; stale shows only as stale.
- FR-39 area category tints, low-saturation tokens, areas only.
- FR-4 click or tap opens popup with enabled parts; no parts = no popup; live while open, stale marked; bottom sheet with visible close at 390 px (PRD 4.2).
- FR-37 custom popup view gets the map item object; example embeds alarm table; missing view falls back with a message.
- FR-5 alarm summary: counts by priority, most important in words, "View alarms" to configured page with placeholders, hidden if none; Map Studio acknowledges nothing.
- FR-6 popup link with placeholders; empty placeholder hides the button.
- FR-32 basemaps none, OpenStreetMap, satellite, Mapbox; user switches between offered; none draws on blank background (PRD 4.10). ARCH AD-12: satellite provider order Esri, Mapbox satellite, MapTiler; provider attribution always shown.
- FR-29 consequences visible to viewers: saved edits appear without reload within a few seconds; store unreachable on load says so, nothing stale shown as current (PRD 4.9).

## 4. Editing requirements

- FR-7 tools only for editing roles; viewer sees no affordance (PRD 4.3).
- FR-8 exactly one mode named in words and glyph; Esc cancels and returns to Select.
- FR-36 empty map: "Draw your first site", "Import CSV", skippable reopenable tour on a throwaway layer; viewer sees empty map with a short note.
- FR-9 kinds from project (geometry, icon, form fields, label rank); FR-10 tools show where the asset list comes from and when empty or incomplete (PRD 4.4).
- FR-11 link and unlink; unlinked count and list; duplicate name red underline plus tooltip; vanished asset shows unlinked with reason; "Unknown kind" marker.
- FR-12 kind setup screen: comms path, up to 4 KPIs (one icon KPI), alarms path, popup parts, link, custom view, style rule, area tints; on/off switch per live value; tag browser; unresolved path reported per item. FR-13 per-item override marked and resettable.
- FR-14 add point, line, area; finish by double-click, Enter or Finish; Backspace removes last vertex; all doable by taps or typed values (PRD 4.5).
- FR-15 move, drag vertex, midpoint handle insert, delete vertex; Move-then-tap or typed coords as non-drag; split line at a point.
- FR-16 snapping with visible indicator and toggle; snapped and floating ends look different (ARCH AD-19: snapping stored in `ends`, moving a snapped-to item moves attached ends).
- FR-17 delete without confirmation; undo/redo buttons and Ctrl+Z, Ctrl+Shift+Z; undo of a saved edit refused if another editor changed it.
- FR-18 duplicate, "Add another like the last" prefilled waiting for location and link; `?` shortcut panel.
- FR-19 validation while drawing in plain words beside the item.
- FR-20 item form: kind fields, asset picker, location, required marked, last values per kind remembered except name, location, link (PRD 4.6).
- FR-21 typed or picked location; offline place check; swapped or out-of-range flagged; "Zoom to location".
- FR-29 save as you work, no save button; failed save shown as unsaved with reason, kept until saved or discarded; FR-31 second save refused with message showing the other change (PRD 4.9).
- ARCH AD-10: undo stack per component session; unsaved queue in local storage; tools disabled when store unreachable.

## 5. Import, export and bulk

- FR-22 CSV template per kind that imports with no errors (PRD 4.7).
- FR-23 CSV, KML, GeoJSON import is a preview: count found, unreadable rows with reasons, cancel with nothing changed; adding saves as one undoable edit.
- FR-24 auto-link same-name assets, rest by hand, counts linked and unlinked.
- FR-25 select by click, add, rectangle; form shows "N selected", mixed values marked; no geometry bulk edit. BRA: ArcGIS caps attribute bulk edit at 500.
- FR-26 reference layer show, hide, remove; never edited or saved; lasts the session only (ARCH Deferred).
- FR-35 export map or selection as GeoJSON or CSV; round-trips into an empty store; a file the user saves (PRD 4.9).
- EIE Boundaries: no approval of imported data.

## 6. Phone

- FR-27 390 px, touch only, phone-editing role: long-press and drag, point drawn above finger, Undo bar after drop, 44 px targets (PRD 4.8). BRA: draw about 48 px above finger with a leader line (unconfirmed).
- FR-28 properties in a bottom sheet; below 768 px no drawing tools.
- FR-4 popup is a bottom sheet with visible close at 390 px; FR-33 search at 390 px.
- SPIKE phone (390x844, CDP touch, not a real device): 7 of 9 probes pass (no overflow, map 390 x 804, tap gives popup, touch pan, pinch, line finished by touch, no errors). Fails: zoom buttons 29x29, "Draw a line" 105x29; popup close 21x22 and popup sits mid-screen (x 70..292, y 450..548). Routed to EP (targets) and EV (bottom sheet) (spike-report findings table).
- TUX 1.8: phone first, 390 px, no sideways scroll, 44 px targets; nothing on a phone sets a value except acknowledge, notes, downtime reasons.

## 7. Look rules already decided

- Theme tokens only, light and dark; module ships no colour; no colour code accepted anywhere (PRD NFR-4; ARCH AD-11).
- Modern, minimal, clean; one minimalist icon style; neutral normal; no decoration without information (PRD NFR-11, Vision). Template palette is `--st-*` tokens (TUX 8): `--st-alarm-1/2/3` (+ `-tint`, `-edge`, `on-`), `--st-stale`, `--st-comms-lost`, `--st-attention` (no hue), `--st-focus` for selection, `--st-backdrop` for halos.
- ISA-101: grey normal, colour only for abnormal, state coded twice (word plus shape); 3:1 non-text contrast both themes (BRA, Accessibility and ISA-101; PRD NFR-3). SM-C2: a normal field shows no hue except area tints.
- ER-27 glyphs: priority 1 triangle, 2 circle, 3 outlined square in every state; unacked, acked (filled with "!"), rectified (check mark); digit as a label beside, never in, the glyph; fade 55 % only when alarm is not live (ER-5); dim 35 % off-scope (dim beats fade); nothing blinks on the map; alarm glyphs stack above dots; line alarm glyph at midpoint; cleared-unacked draws no hue on a line; Diagnostic never shows (TUX 11 ER-27; TUX 5; ICONS State glyphs). Approved as built 2026-10-21 for the template.
- ICONS: 24 px grid, 2 px stroke, `currentColor`, no kind icon outline circle, square or triangle (alarm shapes); 19 kind icons plus `comms-lost`, `stale`, 7 alarm glyphs; nothing from OpenBridge; contact sheet at 16/24/44 px. Kind icons for lines and areas serve tools, legend, search, popups.
- Zoom 14 rule (owner 2026-10-26, ICONS "How the map uses them"): normal point is a neutral dot below zoom 14, kind glyph from 14 in; 44 px touch target (24 px mouse); 2 px halo in background token. Template: name joins label from zoom 14, dots 8 px below zoom 12 (TM 5.1, 5.2, 5.4).
- Controls placement (template, owner 2026-10-21): map is the page; panel top-right, legend bottom-left, zoom + Fit field + Return bottom-right at every width, each collapsing to a 44 px chip remembered per session; Mapbox logo bottom-left (TM 1, 5.11).
- Presets: normal, attention, warning, fault (token plus glyph or word), dimmed/out of service; lines solid, dashed, dotted, weight by pipe size; area tints low saturation distinct from alarm hues; alarm over value style over tint; all through ER-27 review (PRD FR-38, FR-39; ARCH AD-11, AD-16; INIT R40).
- Stale rule: stale shows only as stale, item drops its last value style until a fresh value arrives (INIT Notes; PRD 9 Q8). Template: stale and comms lost are words and shape, never colour; values dimmed "(last)" (TUX 1.4, 5).
- Line weights 3/4/6 px by size, dashed `8 6`, thin 2 px untapped (TM 5.3).

## 8. Template's current map and editor

- `/map` (PV-3 phase 1, read only): built-in Leaflet Map filling the page under the context row; markers show state only (kind never an icon, kind in tooltip, list, pane); hover tip "P14, Pad: P14-3: Well down, 3 h 12 min"; tap selects, second tap opens page; shared spot list; tap line selects and shows arrow; tap ground clears (TM 1, 5).
- Panel top-right from 1024 px (376 px): "Needs you 3 of 12 sites", sites without coordinates, selected `Cards/Site` or rows, "Tap a site or a line on the map.", ranked "Sites (12)" list; collapses to "Sites 12" chip (TM 1).
- Legend bottom-left: IEC shapes with digits solid and acked, comms icon, normal dot, line states, flow arrow, "Show lines" and "Show names" checkboxes; collapses to icon chip (TM 1, 5.6).
- Phone below 1024 px: chip row over the top ("Needs you 3 of 12", "List", "Legend") opening top sheets; selection opens a top sheet; controls stay bottom-right; fingers zoom (TM 1, 5.5, 5.11).
- Data: one `runScript` per list every 10 s from the attention board; basemap switch per Gateway none/osm/mapbox (TM 2, 3). Route scope dims off-route sites 35 %.
- Users rely on: the "Needs you" count and ranked list, Fit field, Return, toggles, two taps to a site page, words in tips, the legend.
- `/map/edit` (PV-3 phase 2b): engineer and integrator roles from 768 px; tool panel top-right with chips Add pipeline, Add site, Move site, then Undo, Finish, Save draft, Export, Reopen, Discard, Map; message line, Steps, Problems, Drafts; draft drawn neutral and dashed; popup forms (PipelineForm, SiteForm); snapping to a site within 20 px by Gateway call; others see a read-only note, "Open the editor on a laptop" below 768 px (TUX 7 `/map/edit`; TME The page). Unverified on a Gateway.
- "Cobbled together and limited" (owner, `brief-flowmap/.memlog.md`; BR The problem): five actions, one Gateway call per vertex, no areas, no deleting a site, no vertex insert or drag, no editing below 768 px, workarounds against the component (array items crash without defaults, `props.style` ignored, no `zIndexOffset`, custom control views need `!important` heights, marker click also fires map click) (BRA Current state; TM 4). Draft, change set, `prov` review path called "sound" (BR).

## 9. Open UX questions the documents name

- Where the Map Studio tools sit on the page: toolbar on the map, side panel, or separate page; the UX workshop decides before EE is refined (PRD 9 Q4; INIT Notes; EE Boundaries).
- Style rule expression: where evaluated and which language (PRD FR-38 [UNVERIFIED]; ARCH AD-16, Deferred; EV Notes).
- Satellite provider terms (PRD 9 Q3; ARCH AD-12, Deferred).
- Hue tokens for alarm glyphs are epic-viewing's call; contact sheet uses stand-ins (ICONS Differences).
- Reviewer to confirm the unacknowledged speaker mark reads at 16 px; triangle-like kind outlines (`line-valve`, `compressor-station`) are review items (ICONS Differences).
- Blink of unacknowledged Critical: ICONS says epic-viewing applies it at draw time, but the template map "never blinks" (ICONS; TM 1; ER-27).
- Spike images (`ux-inputs/`): `google-maps-controls-bottom-right.png` shows Google Maps' bottom-right stack: a white rounded locate (crosshair) button, a grouped zoom +/- pill, and below a wide pill with Street View pegman, three basemap thumbnails and an expand chevron, plus a 500 m scale bar along the bottom edge. `perspective-app-bar-toggle-bottom-right.png` shows the 390 px tracer view: MapLibre's own small zoom +/- top-right (the 29 px buttons that failed), three dots and a line, a status box along the bottom, and Perspective's dark app bar toggle (stopwatch icon and caret-up) pinned bottom-right, overlapping the status box. The implied question: bottom-right is where both Google and the template put controls, and where Perspective's own toggle already sits.

## 10. Gaps: needs with no screen yet

- Tools placement and the mode indicator (FR-8) layout; shortcut panel (FR-18).
- Kind setup screen with tag browser, per-value switches, style rule editor and live preview, area tints, override marks (FR-12, FR-13, FR-38, FR-39; EE Notes).
- Item form and asset picker, place check, duplicate-name flag, unlinked count and list, "Unknown kind" (FR-11, FR-20, FR-21).
- First-run empty state and tour (FR-36); viewer empty-map note.
- Import preview, match-to-assets screen, CSV template download, export dialog, reference layer manager (FR-22 to FR-26, FR-35).
- Bulk edit form with "N selected" and mixed values (FR-25).
- Save state: unsaved edit with reason, conflict message showing the other change, store unreachable, tools disabled (FR-29, FR-31).
- Search field placement (FR-33); basemap switcher (FR-32) and attribution placement.
- Legend: FR-34 parity needs the template's legend and toggles, and ICONS mentions a legend, but no PRD FR names one.
- Template panel parity: "Needs you" count, ranked site list, sites without coordinates, route-scope dimming have no FR beyond the FR-34 checklist (TM 1, 5).
- Phone: Undo bar, long-press feedback, properties bottom sheet; template phone uses top sheets and a chip row, PRD says bottom sheets (FR-4, FR-28 vs TM 5.11): needs a deliberate-change entry for ER-27.
- Kind glyph from zoom 14 versus the template's "markers show state only, never kind" (ICONS vs TM 5.1, ER-27): listed as deliberate change for review.
- Alarm summary inside the popup and "View alarms" button layout (FR-5); custom popup fallback message (FR-37).
