---
type: epic
title: "Map editors build and keep the map in the browser"
parent: initiative-flowmap
covers: ["R10", "R11", "R14", "R15", "R16", "R17", "R18", "R19", "R20", "R21", "R22", "R23", "R24", "R38", "R40", "R41", "R44", "R45", "R46", "R47", "R48", "R49", "R50", "R51", "R52"]
sources: []
companions: [_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md, _bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md]
after: []
refined: false
risk: high
---

# Map editors build and keep the map in the browser

## Description

The Map Studio tools: Edit mode entered by an Edit switch or a prop, the docked studio (mode rail, item list grouped by place, properties panel, floating draw toolbar), one clear mode, a first-run checklist, drawing and changing points, lines and areas with snapping (off by default), validation, Undo and Recent changes, fast entry, item forms with the place check, linking map items to assets, and writing kind setups and overrides on the Kinds screen with a tag browser. Since the gap review of 2026-11-03 also the component's selection and viewport for the host view (a `selectedItem` prop and `onItemSelected`, `onViewportChanged`, `onPopupOpen` and `onPopupClose` events) and the phone user's own place (a "you are here" marker from the session's geolocation props, Locate me, Directions in the popup and the bottom sheet, Nearest to me in search).

## Outcome

A map editor new to the Mesa demo field lays it out with the tools alone in under 30 minutes (prd SM-2).

## Requirements

Written when this epic is refined, as every epic's are; until then the lines the gap review of 2026-11-03 added are carried as the parent writes them, so a builder reads one text:

- R48 (parent R48; gap review 2026-11-03, item 1; architecture AD-7, AD-9, AD-20): the bidirectional `selectedItem` prop and the `onItemSelected` event carrying the AD-7 map item object.
- R49 (parent R49; gap review 2026-11-03, item 1): the read-only `viewport` prop and the `onViewportChanged`, `onPopupOpen` and `onPopupClose` events, once per move end.
- R50 (parent R50; gap review 2026-11-03, item 2): the "you are here" marker from Perspective's session geolocation props and the Locate me button, never a map item.
- R51 (parent R51; gap review 2026-11-03, item 2): the Directions button in the popup and the bottom sheet, opening the device's maps app.
- R52 (parent R52; gap review 2026-11-03, item 2): Nearest to me in search and the distance on every Needs you row.

## Done when

- The tools show only for editing roles, with exactly one named mode.
- Points, lines and areas are added, changed, split, snapped, deleted and undone, each without dragging as well as with.
- A map item links to an asset, and its kind setup drives its icon and popup at once.
- The tools meet WCAG 2.2 for dragging, target size, contrast and keyboard use.
- The 30-minute test passes with an admin new to the Mesa field.
- Verified on the template's test stack.

## Boundaries

- Hands on: forms, linking and undo that epic-import-export and epic-phone reuse.
- Where the tools sit on the page was decided in the UX workshop (ux-map-studio, 2026-10-27): Edit mode in the docked layout, direction A (R44, R47; EXPERIENCE.md).
- Not here: imports, exports, bulk edit or phone editing.
- Not here: transient items and stationing (epic-live-field, R53 to R59); the `dynamicItems` prop lands there, beside the props and events this epic adds.

## References

- parent - _bmad-output/initiative-flowmap/initiative-flowmap.md, section Requirements
- prd - _bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md
- prd - section 4.3 to 4.6, NFR-2, NFR-3, NFR-8 (the versioned props and events)
- gap review - _bmad-output/initiative-flowmap/gap-review-2026-11-03.md, items 1 and 2
- contract - docs/contract.md, "The component's props" (the closed prop list R48 and R49 extend)
- research - _bmad-output/initiative-flowmap/brief-flowmap/addendum.md, ranked practices for the first version
- design - _bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md, the visual identity (adopted companion)
- experience - _bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md, the behaviour (adopted companion)

## Notes

- Decision: 2026-10-26 Names, licence (Apache-2.0) and the Alarm Metrics answer are recorded in the initiative's Notes and apply here.
- Waits on epic-map-store-and-data because: saving, roles and the asset list.
- Waits on epic-viewing because: the map view to draw on.
- Decision: 2026-10-26 The owner approved value-driven styles and area category tints (initiative R40; prd FR-38, FR-39; architecture AD-11, AD-16); this epic covers writing a kind's style rule, area tints and per-item overrides in the kind setup screen, which embeds epic-viewing's preview of every state before saving.
- Decision: 2026-10-27 The owner approved instruments on lines (initiative R41; prd FR-16, FR-40; architecture AD-16, AD-19). This epic owns the "add instrument on this line" tool: with a line selected, a map editor picks an instrument kind (tap, meter, line valve) and places it by clicking the line or typing its distance along the line, then moves it along the line, never off it, by dragging or by typing a new distance (WCAG 2.5.7); instruments snap onto a line, not to its vertices; moving, reshaping or splitting a line keeps its instruments on it through the shared geometry module and epic-map-store-and-data entry 14's checks; and the kind setup screen offers the instruments as a line's style source, each segment drawn from the worst of the instruments at the segment's ends; deleting a line deletes its instruments in the same save, one undo restoring both (owner, 2026-10-27). A story for it is planned when this epic is refined; it waits on epic-map-store-and-data entry 14 and on epic-viewing entry 2.
- Decision: 2026-10-27 UX workshop (ux-map-studio, 2026-10-27): DESIGN.md and EXPERIENCE.md are this epic's companions; Edit mode follows EXPERIENCE.md (Component Patterns, Interaction Primitives, Save and store states, UJ-1 to UJ-3). This epic gains R44 (Edit switch for full editing roles, edit-mode prop), R45 (Recent changes with Revert per change, read from the edit record epic-map-store-and-data writes), R46 (item list grouped by place, needs attention first, Sort by) and R47 (docked layout, list collapsing below about 1280 px, filter chips behind a Filter button, Details and Style tabs). Amended here: R11 first run is the checklist only, the tour is dropped; R15 the Kinds screen sets up only existing kinds, sections Icon, Key values, Comms, Alarms, Popup, Style rule, a tag browser over one example asset's tags producing asset-relative paths (Gateway tag browse unverified, an open question for refinement) and a chosen preview item; R17 kind buttons plus generic point, line and area tools; R19 snapping off by default; R20 Undo and Redo always visible, naming the step, a bulk change and an import each one step; R24 click then drag placement with typed coordinates as backup. No Publish step. Stories are planned when this epic is refined.
- Decision: 2026-10-27 Owner: the Kinds screen's tag browser is in scope, built here as Map Studio's own tree, not Perspective's Tag Browse Tree component, for one consistent look; it reads epic-map-store-and-data entry 15's `tags.browse` (names, types, data types, "resolves for N of M items"; architecture AD-8), and its stories are planned when this epic is refined. The Kinds screen also writes the custom popup view's params and the popup link with the closed placeholder list (initiative R8, R39; architecture AD-7).
- Decision: 2026-10-27 Owner: the tag browser, refined (initiative R15, R40; prd FR-12; architecture AD-8). It is a regular tag browser tree with a tag provider dropdown, the Gateway's default provider selected first, and opens wherever an editor picks a value: key values, comms path, alarms path, a style rule's value and popup params. In a kind's setup it opens at the preview item's asset folder (for example `[default]Mesa/P12`) and the editor can browse up and anywhere in any provider. A pick inside the preview asset's folder is converted to an asset-relative path `{asset.path}/...` automatically and shown with "resolves for N of M items" (M the kind's map items with a base path); a pick outside it is stored as the full path with the warning "Same tag for every <kind>". On a single map item's override a pick is stored as the full path. This epic draws the tree, the dropdown, the converted path, the count and the warning, from epic-map-store-and-data entry 15's `tags.browse {provider, folder}` and `tags.resolve {kindId, assetId, path}`, shown to the full editing role only; the popup link may mix text and placeholders, a param may not (owner, 2026-10-27, confirming Sofia's readings). How a popup param stores a pick inside the asset folder is open (initiative Notes). Its stories are planned when this epic is refined.
- Decision: 2026-11-03 Owner (gap review, "agree, write up the gap review as recommended"): this epic gains R48 and R49 (item 1: `selectedItem`, `viewport`, `onItemSelected`, `onViewportChanged`, `onPopupOpen`, `onPopupClose`; the Kymera module's onPointClicked, onPointEntered, map bounds and setGpsLocation, and the built-in Perspective Map's events, are what a page builder expects and today nothing exposes the selected item or the viewport) and R50 to R52 (item 2: "you are here" from the session's geolocation props with Locate me, Directions in the popup and the bottom sheet, Nearest to me in search and the distance on Needs you rows; the built-in Map's location.enabled, Wellsite Navigator, IFS Field Operator and Esri Field Maps). Reasons for this epic: the props and events are the same closed list (`mapstudio.props.json`, AD-1, AD-9) this epic already extends with the edit-mode prop and the studio, and one contract release carries them; the place features are popup and search work that the phone's bottom sheet (R31, epic-phone) and the Edit button sit beside, so they land before epic-phone builds on the sheet. Constraints carried: the "you are here" marker is never a map item and never saved; the geolocation comes only from `session.props.geolocation` (the project turns it on in the session props), Map Studio asks the browser for nothing; Directions opens the device's maps app by deep link and no coordinates go to any service from Map Studio; the viewport event fires once per move end (R37). The marker's look (a distinct dot and ring in a token no state uses, with a word in the legend) is an engineering review item (ER-27). Stories are planned when this epic is refined; the epic stays unrefined.
