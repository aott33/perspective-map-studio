---
status: draft
created: 2026-10-26
updated: 2026-10-27
name: Map Studio
description: The look of Map Studio, a map viewer and editor component for Ignition 8.3 Perspective. It ships no colour of its own; every colour is a reference to the host project's Perspective theme, light and dark.
colors:
  # Every value is a reference to a host Perspective theme variable, never a colour code
  # (PRD NFR-4, architecture AD-11). The names below are the Perspective theme variables
  # the workshop mock used as stand-ins (.working/editor-directions.html). Light and dark
  # come from the host theme: there are no -dark pairs because the module holds no values.
  surface-panel: 'var(--neutral-10)'       # docked panels, popup card, floating controls, markers' disc
  surface-container: 'var(--container)'    # component background behind the panels
  surface-hover: 'var(--neutral-20)'       # row hover, active rail item, note boxes
  basemap-blank: 'var(--neutral-20)'       # the map with basemap None; marker halo
  divider: 'var(--neutral-30)'             # panel edges, section rules, toolbar dividers
  border: 'var(--neutral-40)'              # inputs, buttons, chips, off switch track
  line-lateral: 'var(--neutral-50)'        # laterals, geofence outline, normal marker ring
  line-pipeline: 'var(--neutral-60)'       # pipelines, neutral dots below zoom 14
  text-secondary: 'var(--neutral-70)'      # labels, hints, counts, state words in rows
  glyph-normal: 'var(--neutral-80)'        # kind glyphs, comms lost and stale glyphs
  attention: 'var(--neutral-90)'           # attention preset outline (no hue), selected chip fill, on switch
  text-primary: 'var(--label)'             # body text, item names
  selection: 'var(--callToAction)'         # selection ring, primary button, snap indicator, box select edge
  selection-tint: 'color-mix(in srgb, var(--callToAction) 12%, transparent)'  # selected row, active tool, override tag
  warning: 'var(--warning)'                # save conflict only, always with glyph and words
  warning-tint: 'color-mix(in srgb, var(--warning) 10%, var(--container))'
  alarm-1: 'var(--error)'                  # [ASSUMPTION] priority 1 hue; final alarm tokens are epic-viewing's call
  alarm-1-tint: 'color-mix(in srgb, var(--error) 8%, var(--container))'  # popup alarm block, alarm badge in rows
  alarm-2: 'host theme priority 2 alarm token'   # Open Question: no Perspective variable named yet
  alarm-3: 'host theme priority 3 alarm token'   # Open Question: no Perspective variable named yet
  area-tint: 'closed palette of low-saturation host theme tokens'  # FR-39; palette not chosen yet
typography:
  # Font family is the host theme's; Map Studio sets sizes and weights only.
  body:
    fontFamily: 'inherit (host Perspective theme)'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
  small:
    fontFamily: 'inherit (host Perspective theme)'
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
  tiny:
    fontFamily: 'inherit (host Perspective theme)'
    fontSize: 11px
    fontWeight: '400'
    lineHeight: '1.3'
  title:
    fontFamily: 'inherit (host Perspective theme)'
    fontSize: 16px
    fontWeight: '600'
    lineHeight: '1.3'
  section-label:
    fontFamily: 'inherit (host Perspective theme)'
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: 0.04em
  map-label:
    fontFamily: 'inherit (host Perspective theme)'
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
  state-word:
    fontFamily: 'inherit (host Perspective theme)'
    fontSize: 11px
    fontWeight: '500'
    lineHeight: '1.2'
rounded:
  sm: 3px      # state word chip on the map
  DEFAULT: 6px # buttons, inputs, list rows, note boxes
  md: 8px      # zoom control, toast
  lg: 10px     # popup card, floating toolbar, search, Needs you bar, rail items
  sheet: 16px  # [ASSUMPTION] top corners of the phone bottom sheet
  full: 9999px # chips, switches, markers' disc, dots
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  map-inset: 12px          # floating controls from the map edge
  page-gutter-phone: 16px
  rail-width: 72px
  list-panel-1366: 256px
  list-panel-1440: 280px
  properties-panel-1366: 320px
  properties-panel-1440: 340px
  popup-width: 290px
  target-mouse: 32px       # buttons and tool buttons with a mouse
  target-marker-mouse: 24px
  target-touch: 44px       # every touch target on a phone (FR-27, template TUX 1.8)
  app-bar-clearance: 76px  # bottom-right corner kept clear for the Perspective App Bar toggle
components:
  mode-rail:
    background: '{colors.surface-panel}'
    width: '{spacing.rail-width}'
    item-foreground: '{colors.text-secondary}'
    item-active-background: '{colors.surface-hover}'
    item-active-foreground: '{colors.text-primary}'
    item-radius: '{rounded.lg}'
    label: '{typography.tiny}'
  list-row:
    height: 30px
    radius: '{rounded.DEFAULT}'
    foreground: '{colors.text-primary}'
    kind-glyph: '{colors.text-secondary}'
    hover-background: '{colors.surface-hover}'
    selected-background: '{colors.selection-tint}'
    selected-edge: '3px inset {colors.selection}'
    child-indent: 26px
  state-badge:
    typography: '{typography.tiny}'
    foreground: '{colors.text-secondary}'
    alarm-foreground: '{colors.alarm-1}'
    unlinked-background: '{colors.surface-hover}'
    radius: '{rounded.full}'
  group-header:
    typography: '{typography.section-label}'
    foreground: '{colors.text-secondary}'
  filter-chip:
    height: 26px
    radius: '{rounded.full}'
    border: '{colors.border}'
    on-background: '{colors.attention}'
    on-foreground: '{colors.surface-panel}'
  properties-panel:
    background: '{colors.surface-panel}'
    width: '{spacing.properties-panel-1366}'
    edge: '1px {colors.divider}'
    title: '{typography.title}'
    section-label: '{typography.section-label}'
  panel-tabs:
    foreground: '{colors.text-secondary}'
    active-foreground: '{colors.text-primary}'
    active-underline: '2px {colors.attention}'
  override-tag:
    background: '{colors.selection-tint}'
    foreground: '{colors.selection}'
    radius: '{rounded.full}'
  mixed-field:
    foreground: '{colors.text-secondary}'
    style: italic
  draw-toolbar:
    background: '{colors.surface-panel}'
    radius: '{rounded.lg}'
    tool-size: '{spacing.target-mouse}'
    tool-active-background: '{colors.selection-tint}'
    tool-active-foreground: '{colors.selection}'
    divider: '{colors.divider}'
  mode-pill:
    background: '{colors.surface-panel}'
    typography: '{typography.small}'
    foreground: '{colors.glyph-normal}'
  editing-switch:
    height: 36px
    background: '{colors.surface-panel}'
    track-off: '{colors.border}'
    track-on: '{colors.attention}'
    radius: '{rounded.lg}'
  save-status:
    typography: '{typography.small}'
    foreground: '{colors.text-secondary}'
    conflict-foreground: '{colors.warning}'
    conflict-background: '{colors.warning-tint}'
  conflict-card:
    background: '{colors.surface-panel}'
    edge: '3px {colors.warning}'
    width: 330px
  recent-changes-panel:
    background: '{colors.surface-panel}'
    radius: '{rounded.lg}'
  toast-undo-bar:
    background: '{colors.attention}'
    foreground: '{colors.surface-panel}'
    radius: '{rounded.md}'
  popup-card:
    background: '{colors.surface-panel}'
    width: '{spacing.popup-width}'
    radius: '{rounded.lg}'
    title: '{typography.title}'
    alarm-block-background: '{colors.alarm-1-tint}'
    alarm-block-edge: '3px {colors.alarm-1}'
  bottom-sheet:
    background: '{colors.surface-panel}'
    radius: '{rounded.sheet}'
    close-target: '{spacing.target-touch}'
  needs-you-bar:
    background: '{colors.surface-panel}'
    radius: '{rounded.lg}'
    height: 40px
  search-field:
    background: '{colors.surface-panel}'
    radius: '{rounded.lg}'
    height: 40px
    width: 300px
  legend:
    background: '{colors.surface-panel}'
    radius: '{rounded.lg}'
    width: 208px
  zoom-control:
    background: '{colors.surface-panel}'
    radius: '{rounded.md}'
  kind-setup-row:
    divider: '{colors.divider}'
    preview-tile-width: 64px
  import-step:
    active-foreground: '{colors.text-primary}'
    pending-foreground: '{colors.text-secondary}'
  first-run-checklist:
    background: '{colors.surface-panel}'
    radius: '{rounded.lg}'
  map-marker:
    disc-size: 34px
    disc-background: '{colors.surface-panel}'
    disc-border: '1.5px {colors.line-lateral}'
    glyph: '{colors.glyph-normal}'
    halo: '2px {colors.basemap-blank}'
    selected-ring: '2px gap, 2px {colors.selection}'
    comms-lost-border: '1.5px dashed {colors.text-secondary}'
    attention-border: '3px {colors.attention}'
    dot-size: 11px
    dot: '{colors.line-pipeline}'
    label: '{typography.map-label}'
  state-word-chip:
    typography: '{typography.state-word}'
    background: '{colors.surface-panel}'
    border: '1px {colors.line-lateral}'
    radius: '{rounded.sm}'
  alarm-glyph:
    size-map: 18px
    size-row: 14px
    priority-1: 'triangle, {colors.alarm-1}'
    priority-2: 'circle, {colors.alarm-2}'
    priority-3: 'outlined square, {colors.alarm-3}'
  map-line:
    weight-by-size: '3px, 4px, 6px'
    untapped: 2px
    dashed: '8 6'
    pipeline: '{colors.line-pipeline}'
    lateral: '{colors.line-lateral}'
  instrument-marker:
    glyph: '{colors.glyph-normal}'
    note: '[ASSUMPTION] tap, meter and line valve glyphs from the core icon set, drawn on the line'
  phone-crosshair:
    foreground: '{colors.attention}'
    halo: '2px {colors.surface-panel}'
---

## Brand & Style

Map Studio should look complete, professional and easy, like one product. The owner's complaint about the template's map and editor is that they look "cobbled together, not connected, hacky like a workaround". Every choice below answers that. The reference is Atlist's editor (`imports/atlist-1.webp` to `imports/atlist-4.webp`): calm white panels, a mode rail, docked list and properties, a light floating toolbar. Map Studio takes that posture but not Atlist's colour.

The style is **industrial minimal** under ISA-101: grey is normal, hue means something is wrong, and a state is always said twice (a word or glyph as well as any hue). There is no decoration that carries no information (PRD NFR-11). Map Studio ships no colour, no font and no theme of its own. It wears the host Perspective project's theme, light or dark, so it looks native in whatever project it lands in, including the ign-scada-template.

Chosen layout: Direction A, **Docked studio** (`.working/editor-direction-a-1366.png`, `.working/editor-direction-a-1440.png`). Directions B (Map first) and C (Inspector) were not chosen; their renders stay in `.working/` as rejected options. The owner notes that A is busy and may be simplified later.

This DESIGN.md and EXPERIENCE.md win on any conflict with a mock, screenshot or import.

## Colors

Every colour token is a reference to a host Perspective theme variable. No colour code is stored, typed or offered anywhere (PRD NFR-4, architecture AD-11). The names in the frontmatter are the Perspective theme variables the workshop mock used; light and dark values come from the host theme. In the ign-scada-template host, the state tokens map to its `--st-*` set (`--st-alarm-1/2/3` with `-tint` and `-edge`, `--st-focus` for selection, `--st-backdrop` for halos); Map Studio itself only names the reference.

- **Neutral ramp (`surface-panel` to `attention`)** carries the whole normal map: panels, the basemap stand-in, lines, dots, glyphs, text. A normal field shows no hue except area tints (PRD SM-C2).
- **`selection`** marks what the user picked or is doing: the selection ring on a marker, the selected list row edge, the active tool, the snap indicator, the box select outline, the primary button. It never marks state.
- **`attention`** is the attention preset: a heavier outline plus the word, no hue (the template's `--st-attention`). It also fills the selected filter chip, the on switch and the toast.
- **`warning`** appears only on a save conflict, always with the warning glyph and the words "Not saved - conflict with ...".
- **`alarm-1`, `alarm-2`, `alarm-3`** are alarm priority hues, used only on alarm glyphs, the line hue of the highest alarm, the alarm count in a list row and the popup's alarm block. The mock used `--error` for priority 1; the final alarm tokens are epic-viewing's call (Open Question in EXPERIENCE.md).
- **Comms lost and stale have no colour.** They are a glyph, a word and a shape (dashed ring, dashed line), drawn in `glyph-normal`.
- **`area-tint`** is a closed palette of low-saturation theme tokens for area categories only (FR-39), distinct from every alarm and preset hue. Points and lines never take a tint.

Draw order: alarm over value style over area tint (AD-11).

Contrast: every non-text mark that carries state (glyphs, rings, dashed lines, the attention outline) reaches 3:1 against the basemap and panel in both themes (PRD NFR-3). This is checked against the host theme, so it is part of the engineering review (ER-27), not a value fixed here.

## Typography

The font family is the host theme's. Map Studio sets size and weight only.

- `{typography.body}` (13 px) for form fields, list rows, popup values.
- `{typography.small}` (12 px) for field labels, hints, save status, mode pill, chips.
- `{typography.tiny}` (11 px) for rail labels, state badges in rows, counts.
- `{typography.title}` (16 px, 600) for panel titles ("Mesa map", "P14", "Well pad"), the popup title.
- `{typography.section-label}` (12 px, 600, tracked 0.04em, upper case) for panel section headers ("LIVE NOW", "STYLE RULE", "MESA FIELD").
- `{typography.map-label}` (12 px, 600) for item names on the map, with a halo in `basemap-blank` so they read over imagery.
- `{typography.state-word}` (11 px, 500) for the state word chip beside a name ("Comms lost", "Stale").

Values in popups and the Live now block are right-aligned; the key value marked as the icon value is bold.

## Layout & Spacing

A 4 px base: `{spacing.1}` 4, `{spacing.2}` 8, `{spacing.3}` 12, `{spacing.4}` 16, `{spacing.5}` 24. Floating controls sit `{spacing.map-inset}` from the map edge.

**Edit mode, Direction A** (left to right): mode rail `{spacing.rail-width}`, docked list panel (`{spacing.list-panel-1366}` at 1366, `{spacing.list-panel-1440}` at 1440), docked properties panel (`{spacing.properties-panel-1366}` / `{spacing.properties-panel-1440}`, shown only while something is selected or in Kinds), then the map. At 1366 the map is about 718 px wide with an item selected and 1038 px with nothing selected. The draw toolbar floats top-centre over the map, with the mode pill below it; the Editing switch and zoom sit top-right. That top row is full at 1366: nothing more goes on it.

**View mode**: the map fills the component. Search top-left (`{components.search-field.width}`), the Needs you bar beside it, Edit switch and zoom top-right, Legend button bottom-left with the scale bar beside it.

**Reserved corner**: the bottom-right corner is kept clear for the Perspective App Bar toggle at every width. Anything docked right pads its footer by `{spacing.app-bar-clearance}`.

**Phone (390 px)**: the map fills the page; one top bar holds search and Needs you and expands on tap; zoom top-right; Legend bottom-left; popups and properties are bottom sheets that stop above the App Bar toggle. Side gutter `{spacing.page-gutter-phone}`, every target `{spacing.target-touch}`.

## Elevation & Depth

Two levels only.

- **Docked**: the rail and panels sit flat on the component, separated by a 1 px `divider` edge. No shadow.
- **Floating**: everything over the map (draw toolbar, mode pill, search, Needs you bar and its list, Edit switch, zoom, legend, popup card, toast, conflict card, Recent changes) takes one soft shadow, the host theme's shadow where it has one, else a two-layer shadow in `attention` at about 10 % opacity. Bottom sheets on the phone take the same shadow upward.

Markers lift off the basemap with a 2 px halo in `basemap-blank`, not a shadow.

## Shapes

Soft but not round: `{rounded.DEFAULT}` (6 px) for buttons, inputs and rows; `{rounded.lg}` (10 px) for floating cards and the popup; `{rounded.full}` for chips, switches, marker discs and dots. Shapes on the map are reserved: **triangle, circle and square are alarm shapes** (ER-27), so no kind glyph uses an outline circle, square or triangle as its frame (icon catalogue rule). Markers are a neutral disc with the kind glyph inside.

Icons: one minimalist style on a 24 px grid with a 2 px stroke in `currentColor` (core icon set). UI chrome glyphs in the mock (eye, list, layers, undo, box select, pop-out, magnet) are stand-ins; the approved sprite has no UI icons yet.

## Components

Visual specs. Behaviour lives in EXPERIENCE.md, Component Patterns.

- **Mode rail** - `{components.mode-rail}`. Five items stacked: View, Items, Kinds, Layers, Import, each a glyph over a `{typography.tiny}` label. The active item takes `surface-hover` and bold text. Shown in edit mode only.
- **Panel header** - map name in `{typography.title}` ("Mesa map"), then Undo and Redo icon buttons and the save status on the same line.
- **List row** - `{components.list-row}`. Checkbox, kind glyph, name, then a state badge right-aligned. Children (wells on a pad, laterals) indent 26 px under their site. Group headers (`MESA FIELD`, `4 NEED ATTENTION`, "All normal", "Field-wide") use `{typography.section-label}`.
- **State badge** - `{components.state-badge}`. Alarm: the priority glyph plus digit in the alarm hue ("triangle 1"). Comms lost: comms-lost glyph plus "Comms lost". Stale: hourglass plus "Stale". Unlinked: the word on a `surface-hover` pill. Never a coloured dot alone.
- **Filter chips** - `{components.filter-chip}`. "All 11", "Well pad 3" and so on; the selected chip is filled `attention`.
- **Properties panel and tabs** - `{components.properties-panel}`, `{components.panel-tabs}`. Header: kind glyph, name, a subline ("Well pad - linked to Mesa/P14"), close. Tabs Details, Style, Link, underlined when active. Sections separated by `divider`. The Live now block lists Comms, key values and Alarms with a "From kind" tag. Footer: "Add another like this" and a delete icon.
- **Override tag** - `{components.override-tag}`: the word "Override" in `selection` on a tint, beside any field that differs from its kind, with a Reset link.
- **Mixed field** - `{components.mixed-field}`: an input showing "Mixed" (or "Mixed - 3 values") in italic secondary text.
- **Floating draw toolbar** - `{components.draw-toolbar}`. Groups divided by thin rules: Select, Box select; kind buttons (Well pad, Tank battery, Pipeline); generic Point, Line, Area; Snap with a magnet glyph and "Snap off" or "Snap on". The active tool is tinted `selection`.
- **Mode pill** - `{components.mode-pill}`: glyph plus the mode in words under the toolbar ("Select", "Add a well pad - click the map, then drag to fine-tune", "20 selected - Shift-click to add").
- **Drawing bar** - a floating bar bottom-centre while a line or area is drawn: kind glyph, "New pipeline", progress ("2 points - 0.7 km - start floating"), snapping state, "Double-click or Enter to finish", Cancel (Esc) and Finish.
- **Editing switch** - `{components.editing-switch}`: in view mode an eye glyph, "Edit map" and an off switch; in edit mode a kinds glyph, "Editing" and an on switch.
- **Save status** - `{components.save-status}`: check plus "Saved"; spinner plus "Saving..."; warning glyph plus "Not saved - conflict with Sam's change" on a warning tint. Clickable.
- **Conflict card** - `{components.conflict-card}`: warning edge, the other editor's change in a sentence, "Your change, kept here and not saved: ...", two buttons.
- **Recent changes panel** - floating card: who (initial avatar), what in a sentence, when, and a Revert button per row; the next undo step is named at the top ("Undo: edit 3 pads").
- **Toast and Undo bar** - `{components.toast-undo-bar}`: dark bar bottom-centre with a check, the message and an Undo button, never in the bottom-right corner.
- **Popup card** - `{components.popup-card}`. Header: kind glyph in a disc, name in `{typography.title}`, subline (kind and wells), a pop-out icon (the page link) and close. Body in order: Comms with its data age ("OK - 12 s ago"), a rule, 2 or 3 key values, then the alarm block: `alarm-1-tint` background with a 3 px alarm edge, "1 alarm - Priority 1, unacknowledged", the alarm text and age, and a primary "View alarms" button. With no alarm, a check and "No active alarms". A pointer joins the card to its item.
- **Line popup** - the popup card for a line, with an ordered instrument list between the line's two ends: one row per instrument with its glyph, name, distance ("PT-1 at 1.1 km"), live values and its alarm badge; the rows at the clicked line segment's ends are highlighted with `selection-tint` [ASSUMPTION on the highlight treatment].
- **Bottom sheet** - `{components.bottom-sheet}`: full-width sheet from the bottom with rounded top corners, a 44 px close in the header, content as the popup card or the properties form; it stops above the App Bar toggle.
- **Needs you bar** - `{components.needs-you-bar}`: "Needs you 3" in bold, then each count with its glyph ("triangle 1 alarm", "1 comms lost", "1 stale"), and a chevron. Opens a ranked list card below: rank number, state glyph, name and kind, the state in words, detail and age.
- **Search field** - `{components.search-field}`: search glyph and the placeholder "Search sites, wells or lines".
- **Legend** - `{components.legend}`. Closed: a "Legend" button with a layers glyph. Open: kind glyphs with names, alarm glyphs ("Priority 1 alarm, digit beside", "Acknowledged"), Comms lost, Stale value, line styles (pipeline weight by size, lateral, dashed for no data or comms lost), geofence; then Lines and Names checkboxes and the note "Below zoom 14 sites show as dots".
- **Zoom control** - `{components.zoom-control}`: plus, the zoom level ("z 15"), minus, Fit. 44 px targets on the phone.
- **Kind setup rows with live preview** - `{components.kind-setup-row}`. Each style rule row: "When Status is" value, a chevron, a "Use preset" select, and a 64 px preview tile showing the chosen preview item (for example P12) drawn in that preset, with the state word under it. Key value rows: name, the path in monospace, an on/off switch, an "Icon value" star, a "Browse tags" button, and a resolve note ("Resolves for 3 of 3 items"). A grey note box states the precedence rule.
- **Import steps** - `{components.import-step}`: a numbered step header (Preview, Map columns, Match to assets, Summary), the current step in primary text, the others secondary. Preview is a map plus a table. Match rows show a tick for confident matches and a flag for doubtful ones. Summary shows three counts: new, updated, skipped.
- **First-run checklist** - `{components.first-run-checklist}`: a floating card on the empty map with three rows, each a check circle and a label: "Set up your kinds", "Add or import items", "Check the operator view".
- **Map marker** - `{components.map-marker}`. From zoom 14: a neutral disc with the kind glyph, name below in `{typography.map-label}`, state glyph at the top-right, state word chip beside the name. Below zoom 14: an 11 px neutral dot. Comms lost: dashed ring and a faded glyph. Attention: 3 px `attention` ring plus the word. Dimmed preset: faded and dashed. Selected: a `selection` ring outside a gap.
- **Alarm and state glyph usage** - `{components.alarm-glyph}`. Priority 1 triangle, priority 2 circle, priority 3 outlined square, in every state; unacknowledged solid, acknowledged filled with "!", rectified a check mark. The priority digit is a label beside the glyph, never inside it. Fade to 55 % only when the alarm is not live; dim to 35 % when out of scope (dim wins). Alarm glyphs stack above dots. A line's alarm glyph sits at its midpoint; an instrument's alarm glyph sits at the instrument's place on the line. Comms lost (crossed antenna) and stale (hourglass) are glyphs with no hue. Nothing blinks.
- **Map line** - `{components.map-line}`: weight 3, 4 or 6 px by pipe size, 2 px when untapped; dashed `8 6` for no data or comms lost; hue only from the highest alarm; the name in a small chip at the midpoint; flow arrow on the selected line only.
- **Instrument marker** - `{components.instrument-marker}`: a tap, meter or line valve sits on its line [ASSUMPTION: a small disc with its glyph, same halo as a marker]; the `meter` instrument glyph is new and distinct from meter station.
- **Phone crosshair** - `{components.phone-crosshair}`: a fixed crosshair at the map centre with a halo, and Done and Cancel buttons at 44 px.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Reference a host theme token for every colour | Ship, store or accept a colour code; offer a colour picker |
| Draw normal items in neutral grey | Use hue for anything but abnormal state, selection or area tints |
| Say every state with a glyph or word as well as any hue | Let colour carry a state alone; colour comms lost or stale |
| Use triangle, circle and square only for alarm priorities | Frame a kind glyph in a circle, square or triangle |
| Put the priority digit beside the glyph | Put it inside the glyph |
| Keep the bottom-right corner clear for the App Bar toggle | Put a control, toast or footer button there |
| Choose looks from the closed preset list (normal, attention, warning, fault, dimmed; solid, dashed, dotted) | Invent per-item styles outside the presets |
| Float only what sits over the map | Shadow the docked panels |
| Keep one minimalist icon style, 24 px grid, 2 px stroke | Mix icon styles or take icons from OpenBridge |
| Keep the map still | Blink or pulse anything, including an unacknowledged alarm (engineering review item) |
