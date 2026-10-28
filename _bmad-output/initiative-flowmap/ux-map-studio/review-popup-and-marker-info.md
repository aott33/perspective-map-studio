# Review: popup card and marker info (owner feedback, 2026-10-28)

Reviewer: Sally (UX). Read only; no DESIGN.md edit. Sources: `DefaultPopup.tsx`, `mapstudio.css`, `popupParams.ts`, `MapStudio.tsx` (openPopup), `markers.ts`; DESIGN.md `popup-card`, `bottom-sheet`, `map-marker`, `state-word-chip`; EXPERIENCE.md "Popup card", "Bottom sheet"; screenshots `mapstudio-live-1440/390/comms-lost-1440.png`; mock `key-screen-1-view-desktop-popup.png`. Tickets: `epic-viewing` entry 7 (marker labels) and entry 8 (popup, sheet).

## 1. Popup card

The card is the right idea (order, words, alarm edge) but it is built as a content-sized box with a few uneven paddings and none of the mock's polish. Spacing tokens: 1=4, 2=8, 3=12, 4=16, 5=24.

| # | What is wrong (cause) | Fix (exact values) | Entry |
|---|---|---|---|
| P1 | No right room. Header is `padding: 10px 28px 8px 12px` to dodge MapLibre's absolutely placed close button (`.maplibregl-popup-close-button`, `right:2px; top:2px`, 16 px font, `padding: 0 6px`, about 20 px wide, below the 24 px mouse target and far below 44 px). Body rows are `padding: 4px 12px`, so header and body edges differ and values sit 12 px from the edge, hard against the border. In the 1440 shot the close box also overlaps the card's top-right corner. | Set `closeButton: false` in `openPopup` and draw the close button in the header (flex item, last). Every region uses the same side padding: `spacing.4` = 16 px left and right (header, rows, alarm block, footer). Header `padding: 12px 12px 8px 16px`, so the right icons sit 12 px in; icons are 32 px boxes (24 px hit minimum on desktop). | 8 |
| P2 | Width is content-driven: `.mapstudio-popup--default` has `min-width 220`, `max-width 320`, no `width`; `popupMaxWidth()` clamps 220 to 320. The token `popup-width` is 290 and is never applied, so card width jumps with the longest value. | Set `width: 320px` (proposed decision D1; keep 290 if the owner declines) with `max-width: calc(100vw - 32px)`. Make `POPUP_MAX_PX` = width token and `popupMaxWidth()` return it when it fits. Keep the 16 px edge margin. | 8 |
| P3 | Height: the card has no height rule. `.mapstudio-popup` is `overflow: auto` inside `.maplibregl-popup-content` `overflow: hidden`, so the alarm block, a future button or a 3rd KPI can be clipped or give a scrollbar that eats the right padding. | Card: `max-height: min(480px, mapHeight - 64px)`, set from `MapStudio.tsx` as an inline style next to `setMaxWidth`. Header stays fixed; the body (`overflow-y: auto; overflow-x: hidden`, `scrollbar-gutter: stable`) scrolls. No min-height. Content for 3 KPIs + alarm block + button is about 330 px, so scrolling is the exception. | 8 |
| P4 | Rows: `padding: 4px 12px`, 13 px text, 6 px gap, `overflow-wrap: anywhere` on values, label `flex: 1`. Rows are tight (about 26 px) and a long value breaks mid-word. | Row = 2 columns: label (`text-secondary`, `typography.body`, no wrap, ellipsis) left; value (`text-primary`, right-aligned, tabular figures, key value 600) right. `min-height: 32px`, `padding: 4px 16px`, `column-gap: 12px`. A value that does not fit wraps at spaces, never `anywhere`. Stale: glyph 16 px before the value, words "Stale - 371 psi (last)", `text-secondary`. | 8 |
| P5 | Alarm block lacks the tint (`alarm-block-background` = `alarm-1-tint` is not applied; only `border-left: 3px`). The whole block is coloured text (`color: var(--mapstudio-alarm-N)`) and uses `.mapstudio-popup-value` (right-aligned), which leaves the empty gap beside the glyph seen at 390 px. The "View alarms" button and the page link icon are not there yet. | Block: `margin: 8px 16px 16px`, `padding: 8px 12px`, `background: alarm-1-tint` (tint of the item's priority), `border-left: 3px solid alarm-N`, `border-radius: rounded.DEFAULT` (6). Layout top to bottom, left aligned: (a) glyph 16 + digit + heading "1 alarm - Priority 1, unacknowledged" in 600, alarm hue on glyph and heading only; (b) "Casing pressure high - P14-2H, 4 min ago" in `typography.tiny`, `text-primary`; for 2 or more alarms a line "+ 1 more" in `tiny`; (c) primary "View alarms", 28 px high, `padding: 0 12px`, `margin-top: 8px`. No alarms: check glyph + "No active alarms", `text-secondary`, no tint, no button. The glyph and heading never rely on colour (shape + digit kept). Alarm text changes go to ER-27 review. | 8 |
| P6 | Page link: an empty `<span class="mapstudio-popup-link">` 24 px with no icon, to the left of nothing. | Header order: kind glyph (in a 28 px `rounded.full` disc, `surface-hover`), title (`typography.title`) with subline (`typography.small`, `text-secondary`), pop-out icon 32 px, close icon 32 px; gap 4 px between icons. Pop-out is hidden (not disabled) when the link has no value. Both icons need an accessible name. | 8 |
| P7 | Pointer: `.maplibregl-popup-tip` takes `var(--border)` for its coloured side, so a grey wedge sits against a card of another colour, and `offset: 12` puts the tip on the marker's 34 px disc and badge (see 390 shot). Card shadow is `none`; DESIGN says floating cards take one soft shadow. | Tip: fill with the card surface (`--container` today, `surface-panel` in the token list), 1 px `divider` edge on the two outer sides, 10 px. Offset per anchor: 22 px (disc radius 17 + 5), so the tip touches the disc ring, not the badge. Prefer the above-the-marker anchor so the name label stays visible. Shadow: host `--shadow` if any, else `0 2px 8px` and `0 1px 2px` in `attention` at about 10 %. Radius `rounded.lg` (10) not `--borderRadius`. | 8 |
| P8 | Marker text and DOM neighbours show through the card at 390 px ("950 psilue": a neighbour's "Stale - No value" over the Pressure row). Entry 8's text already names this. Cause to confirm: card surface resolves transparent (host sets no `--container`) or the card is under a layer. | Opaque `background` on `.maplibregl-popup-content`, `z-index` above markers and controls; do not rely on one host variable only (use the DESIGN `surface-panel` token with a fallback token, never a colour literal). Add a render check with a neighbour label under the card. | 8 |

### Phone at 390 px (bottom sheet, entry 8)
`popupMaxWidth()` and the pointer are for desktop only. Below 768 px render the same body in `{components.bottom-sheet}`:

| Part | Value |
|---|---|
| Position | `left/right: 8px` (`phone-float-inset`), bottom 8 px plus App Bar clearance (toggle is about 44 px high at bottom-right: use `bottom: 56px`); never covers the bottom-right corner |
| Size | width `100% - 16px` (374 at 390), `max-height: 60%` of the map; body scrolls, header and button footer fixed |
| Shape | `rounded.sheet` 14 px top corners, drag handle 36 x 4 px, 8 px from top, `divider`; soft shadow upward |
| Padding | 16 px sides (`page-gutter-phone`), header `12px 8px 8px 16px`, body rows `min-height 40px` |
| Header | pop-out and close are 44 x 44 px each (the spike failed at 21 px); title 16/600 may wrap to 2 lines |
| Footer | buttons side by side, 44 px high, 8 px gap: primary "View alarms" (flex 1), "Edit" for phone-editing roles; alarm block loses its own button here |
| Map | no pointer; selected marker keeps its ring and the map pads its bottom by the sheet height so the item stays above the sheet |

## 2. Marker info

Today `markerSvg()` bakes the KPI and the state word into a 160 x 74 px image (`IMAGE_WIDTH`, `DISC_AREA 44`, two 15 px lines), and `markerImageId()` includes the KPI text and the word. Consequences: the text is bitmap, takes space (160 px wide label area) even for neighbours, can never collide or give way, and every distinct KPI text ("950 psi", "949 psi") makes a new image. The disc is `r=14` (28 px) but `map-marker.disc-size` is 34.

| # | Finding | Fix | Entry |
|---|---|---|---|
| M1 | Text in the image cannot give way; "950 psi", "Stale - No value", "Comms lost" stack on neighbours (1440 and 390 shots). | Move to symbol layer text (needs the glyph source, entry 7 text). Stays in the image: disc 34 px (`r=17`, 1.5 px `line-lateral` ring, `surface-panel` fill, 2 px halo), kind glyph, ring look (dashed for comms lost and stale), state glyph top-right (badge, 16 px), priority digit. Image becomes about 48 x 48 and one per icon + look + badge (no KPI or word in the id). | 7 |
| M2 | Name is not drawn at all; map-marker specifies "name below in map-label type". | Name label: `map-label` 12/600, `text-primary`, halo 2 px `basemap-blank`, anchored below the disc, from zoom 14 (below 14 the 11 px dot and no text). | 7 |
| M3 | State word is plain text under the KPI; DESIGN: "state word chip beside the name". | Chip: `state-word` 11/500, `surface-panel` fill, 1 px `divider` edge, `rounded.sm` 3 px, padding 2 x 5; text "Comms lost" or "Stale" (not "Stale - No value" on the map; the popup says the rest). Draw via a 9-slice chip image with `icon-text-fit`, placed right of the name, allowed to drop when crowded; abnormal items rank first. Comms-lost keeps its hue token for the glyph, the chip text stays `text-primary`. | 7 |
| M4 | Icon KPI is a bottom line of the image. | One line under the name, `map-label` at 90 % size (11 px) 600, same halo, only from zoom 15, shown for an item with a live value; the stale form is "Stale" chip, not "Stale - " before the number, and the last value is dimmed. | 7 |
| M5 | Collisions: all text is `allow-overlap`-like (image). | Labels `text-allow-overlap: false`, `text-optional: true`, `symbol-sort-key` = rank (alarm 1 to 3, comms lost, stale, normal, then the kind list order); the disc and badge never drop. At 390 px the selected item always keeps its name; with the popup open labels under the card are hidden. Kept: at the starting zoom nothing overlaps. | 7 |

Popup versus marker split: the marker shows state in glyph plus one word; the popup owns the long form ("Stale - No value", data age, reasons). Do not repeat both on the map.

## 3. Proposed decisions for the owner (DESIGN.md not edited)

| Id | Proposal | Why |
|---|---|---|
| D1 | `popup-width` 290 to **320 px**; add `popup-max-height` **480 px** (and "min(480, map - 64)"). Line popup stays 350. | 3 KPIs, 2-line alarm text and a button need about 30 px more width at 13 px text; 290 stays valid if the owner prefers the mock. |
| D2 | Popup side padding **16 px** (`spacing.4`) in the card and the sheet; icon boxes 32 px desktop, 44 px phone. | Fixes "no padding on the right"; one value for all regions. |
| D3 | Add `popup-offset: 22px` and `popup-tip: 10px` to the popup-card component. | Tip must clear the 34 px disc and the badge. |
| D4 | `map-marker`: KPI line is shown from zoom 15, name from 14 (EXPERIENCE says 14 for glyph and name; the KPI zoom is new). | Text density at 390 px. |
| D5 | State chip on the map says "Stale" or "Comms lost" only; the full words live in the popup. | Shorter, collides less. |

## 4. Order of work

1. Entry 8, small first: P1, P2, P3, P8 (padding, width, scroll rule, opaque surface); then P4 to P7 with the alarm summary and button; then the sheet.
2. Entry 7 first step: M1 to M5 (needs the glyph source before the text layers).
3. Render checks (390 and 1440): value column does not touch the right border; no horizontal scrollbar; close and pop-out 44 px at 390; no neighbour text under the card; two markers 40 px apart keep one name each.
