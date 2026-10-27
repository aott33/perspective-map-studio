---
status: final
created: 2026-10-26
updated: 2026-10-27
name: Map Studio
description: The look of Map Studio, a map viewer and editor component for Ignition 8.3 Perspective. It ships no colour of its own; every colour is a reference to the host project's Perspective theme, light and dark.
colors:
  # Every value is a reference to a host Perspective theme variable, never a colour code
  # (PRD NFR-4, architecture AD-11). The names below are the Perspective theme variables
  # the workshop mocks used as stand-ins (mockups/editor-directions.html, mockups/key-screens.html).
  # Light and dark come from the host theme: there are no -dark pairs because the module holds no values.
  surface-panel: 'var(--neutral-10)'       # docked panels, popup card, floating controls, markers' disc
  surface-container: 'var(--container)'    # component background behind the panels
  surface-hover: 'var(--neutral-20)'       # row hover, active rail item, note boxes
  basemap-blank: 'var(--neutral-20)'       # the map with basemap None; marker halo
  divider: 'var(--neutral-30)'             # panel edges, section rules, toolbar dividers
  border: 'var(--neutral-40)'              # inputs, buttons, chips, off switch track
  line-lateral: 'var(--neutral-50)'        # laterals, geofence outline, normal marker ring
  line-pipeline: 'var(--neutral-60)'       # pipelines, neutral dots below zoom 14, instrument ring
  text-secondary: 'var(--neutral-70)'      # labels, hints, counts, state words in rows, All OK
  glyph-normal: 'var(--neutral-80)'        # kind glyphs, comms lost and stale glyphs
  attention: 'var(--neutral-90)'           # attention preset outline (no hue), selected chip fill, on switch
  text-primary: 'var(--label)'             # body text, item names
  selection: 'var(--callToAction)'         # selection ring, primary button, snap indicator, box select edge
  selection-tint: 'color-mix(in srgb, var(--callToAction) 12%, transparent)'  # selected row, active tool, override tag
  warning: 'var(--warning)'                # save problems, import flags and the tag browser's shared-tag and browse-failure notes only, always with glyph and words
  warning-tint: 'color-mix(in srgb, var(--warning) 10%, var(--container))'
  alarm-1: 'var(--error)'                  # [ASSUMPTION] priority 1 hue; final alarm tokens are epic-viewing's call
  alarm-1-tint: 'color-mix(in srgb, var(--error) 8%, var(--container))'  # popup alarm block, alarm badge in rows
  alarm-2: 'host theme priority 2 alarm token'   # Open Question: no Perspective variable named yet
  alarm-3: 'host theme priority 3 alarm token'   # Open Question: no Perspective variable named yet
  area-tint: 'closed palette of low-saturation host theme tokens'  # FR-39; palette not chosen yet
  # Designer setup form (Swing, owner 2026-10-27): not a Perspective surface, so these are
  # UIManager keys of the Designer's look and feel, read at runtime so the form follows the
  # Designer's light or dark theme. Hex values in mockups/designer-setup-form.html are stand-ins.
  designer-panel: 'UIManager Panel.background'
  designer-surface: 'UIManager TextField.background'        # inputs, chip field, tab body
  designer-border: 'UIManager Component.borderColor'
  designer-divider: 'UIManager Separator.foreground'        # section heading rule, list edge, footer edge
  designer-text: 'UIManager Label.foreground'
  designer-text-secondary: 'UIManager Label.disabledForeground'  # schema version, placeholders, the Map token note
  designer-accent: 'UIManager Component.accentColor'        # focus ring, ticked checkbox, highlighted list row
  designer-error: 'UIManager Component.error.focusedBorderColor'   # reasons (block the save), with the error glyph
  designer-warning: 'UIManager Component.warning.focusedBorderColor' # warnings (never block), with the warning glyph
  designer-tooltip-background: 'UIManager ToolTip.background'  # label tooltips (the help, owner 2026-10-27)
  designer-tooltip-foreground: 'UIManager ToolTip.foreground'
  designer-tooltip-border: 'UIManager ToolTip.border (its line colour)'
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
  count:
    fontFamily: 'inherit (host Perspective theme)'
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1'
  designer-body:
    fontFamily: 'UIManager defaultFont (the Designer font; the mock uses Noto Sans)'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.35'
  designer-heading:
    fontFamily: 'UIManager defaultFont'
    fontSize: 13px
    fontWeight: '700'
    lineHeight: '1.3'
  designer-title:
    fontFamily: 'UIManager defaultFont'
    fontSize: 15px
    fontWeight: '700'
    lineHeight: '1.3'
  designer-note:   # the one visible line under Map token, the empty state's line, the header link, the schema version
    fontFamily: 'UIManager defaultFont'
    fontSize: 11.5px
    fontWeight: '400'
    lineHeight: '1.35'
rounded:
  sm: 3px      # state word chip on the map
  DEFAULT: 6px # buttons, inputs, list rows, note boxes
  md: 8px      # zoom control, toast, import summary cards
  lg: 10px     # popup card, floating toolbar, search, Needs you bar, rail items, phone top bar
  sheet: 14px  # [ASSUMPTION] corners of the phone bottom sheet (the key-screens mock uses 14 px)
  full: 9999px # chips, switches, markers' disc, dots
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  map-inset: 12px          # floating controls from the map edge
  page-gutter-phone: 16px
  phone-float-inset: 8px   # phone top bar and bottom sheet from the screen edge
  rail-width: 72px
  list-panel-1366: 256px
  list-panel-1440: 280px
  properties-panel-1366: 320px
  properties-panel-1440: 340px
  popup-width: 290px
  line-popup-width: 350px
  target-mouse: 32px       # buttons and tool buttons with a mouse
  target-marker-mouse: 24px
  target-touch: 44px       # every touch target on a phone (FR-27, template TUX 1.8)
  app-bar-clearance: 76px  # bottom-right corner kept clear for the Perspective App Bar toggle
  designer-control-height: 28px  # the row height labels line up with; combo boxes and the spinner take the Designer look and feel's own height (fix 16)
  designer-label-column: 184px   # labels left, as in Project Properties
  designer-field: 340px          # combo boxes and text fields (never the tab's width)
  designer-chip-field: 420px     # role pickers
  designer-message-width: 560px  # reasons, warnings and the Map token note wrap here
  designer-row-gap: 10px
  designer-section-gap: 14px
  designer-form-max: 760px       # the whole form, left aligned; the rest of a wide tab stays empty
components:
  designer-setup-form:
    background: '{colors.designer-surface}'
    section-heading: '{typography.designer-heading}'
    section-rule: '1px {colors.designer-divider}'
    label: '{typography.designer-body}'
    note: '{typography.designer-note}'
    note-foreground: '{colors.designer-text-secondary}'
    reason: '{colors.designer-error}'
    warning: '{colors.designer-warning}'
    control-height: '{spacing.designer-control-height}'
    field-width: '{spacing.designer-field}'
    chip-field-width: '{spacing.designer-chip-field}'
    max-width: '{spacing.designer-form-max}'
  designer-chip:
    height: 22px
    radius: 3px
    background: 'UIManager Button.background'
    warning-edge: '1px {colors.designer-warning}'
    reason-edge: '1px {colors.designer-error}'
  designer-combo:   # owner 2026-10-27 (fix 16): every dropdown, and the role picker's input
    component: 'the Designer look and feel''s own editable JComboBox (no UI delegate, arrow button, border or background of ours)'
    placeholder: '{colors.designer-text-secondary}, painted over the empty editor (JLayer), never in the value'
    width: '{spacing.designer-field}'
  designer-spinner:  # owner 2026-10-27 (fix 16): the refresh interval, as Project Properties' Client Poll Rate
    component: 'the Designer look and feel''s own JSpinner, number pattern 0 (no grouping), any text can be typed'
    width: 96px
  designer-tooltip:
    background: '{colors.designer-tooltip-background}'
    foreground: '{colors.designer-tooltip-foreground}'
    border: '1px {colors.designer-tooltip-border}'
    typography: '{typography.designer-body} at 12px'
    max-width: '{spacing.designer-message-width}'
  designer-header-link:
    foreground: '{colors.designer-accent}'
    typography: '{typography.designer-note}'
    gap-to-schema: 16px
  designer-banner:
    radius: 4px
    info-background: '{colors.designer-accent} at about 10 % over {colors.designer-panel}'
    warning-background: '{colors.designer-warning} at about 12 % over {colors.designer-panel}'
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
    paused-opacity: '0.42'
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
    problem-foreground: '{colors.warning}'
    problem-background: '{colors.warning-tint}'
  conflict-card:
    background: '{colors.surface-panel}'
    edge: '3px {colors.warning}'
    width: 330px
  save-banner:
    background: '{colors.surface-panel}'
    edge: '3px {colors.warning}'
    width: 430px
  recent-changes-panel:
    background: '{colors.surface-panel}'
    radius: '{rounded.lg}'
    width: 340px
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
  line-popup:
    width: '{spacing.line-popup-width}'
    segment-box-background: '{colors.selection-tint}'
    segment-box-border: '1px {colors.selection}'
    highlighted-row-background: '{colors.selection-tint}'
    highlighted-row-edge: '3px inset {colors.selection}'
  bottom-sheet:
    background: '{colors.surface-panel}'
    radius: '{rounded.sheet}'
    inset: '{spacing.phone-float-inset}'
    close-target: '{spacing.target-touch}'
    button-height: '{spacing.target-touch}'
  phone-top-bar:
    background: '{colors.surface-panel}'
    radius: '{rounded.lg}'
    height: 48px
    inset: '{spacing.phone-float-inset}'
  needs-you-bar:
    background: '{colors.surface-panel}'
    radius: '{rounded.lg}'
    height: 40px
    all-ok-foreground: '{colors.text-secondary}'
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
  tag-browser:
    background: '{colors.surface-panel}'
    radius: '{rounded.lg}'
    width: 380px
    tree-border: '1px {colors.divider}'
    tree-row-height: 24px
    tree-indent: 16px
    tree-max-height: 268px
    asset-folder-guide: '2px inset {colors.border}'
    picked-background: '{colors.selection-tint}'
    picked-edge: '3px inset {colors.selection}'
    note-background: '{colors.surface-hover}'
    shared-tag-background: '{colors.warning-tint}'
    shared-tag-edge: '3px {colors.warning}'
    shared-tag-foreground: '{colors.warning}'
  import-step:
    active-foreground: '{colors.text-primary}'
    active-edge: '3px {colors.attention}'
    done-edge: '3px {colors.line-pipeline}'
    pending-foreground: '{colors.text-secondary}'
    pending-edge: '3px {colors.divider}'
    flagged-row-background: '{colors.warning-tint}'
    flag-foreground: '{colors.warning}'
    summary-count: '{typography.count}'
  first-run-checklist:
    background: '{colors.surface-panel}'
    radius: '{rounded.lg}'
    width: 400px
    step-ring: '1.5px {colors.line-pipeline}'
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
    disc-size: 24px
    disc-background: '{colors.surface-panel}'
    disc-border: '1.5px {colors.line-pipeline}'
    glyph: '{colors.glyph-normal}'
    halo: '2px {colors.basemap-blank}'
    note: '[ASSUMPTION] tap, meter and line valve glyphs from the core icon set in a small disc on the line'
  phone-crosshair:
    size: 64px
    ring: '2.5px {colors.selection}'
    ring-fill: '{colors.surface-panel}'
    ticks: '{colors.attention}'
    glyph: '{colors.glyph-normal}'
---

## Brand & Style

Map Studio should look complete, professional and easy, like one product. The owner's complaint about the template's map and editor is that they look "cobbled together, not connected, hacky like a workaround". Every choice below answers that. The reference is Atlist's editor (`imports/atlist-1.webp` to `imports/atlist-4.webp`): calm white panels, a mode rail, docked list and properties, a light floating draw toolbar. Map Studio takes that posture but not Atlist's colour.

The style is **industrial minimal** under ISA-101: grey is normal, hue means something is wrong, and a state is always said twice (a word or glyph as well as any hue). There is no decoration that carries no information (PRD NFR-11). Map Studio ships no colour, no font and no theme of its own. It wears the host Perspective project's theme, light or dark, so it looks native in whatever project it lands in, including the ign-scada-template.

Chosen layout: Direction A, **Docked studio** ([editor-direction-a-1366.png](mockups/editor-direction-a-1366.png), [editor-direction-a-1440.png](mockups/editor-direction-a-1440.png), interactive [editor-directions.html](mockups/editor-directions.html)). The owner found it busy, so it ships simplified: the list's filter chips sit behind a Filter button, and the properties panel has two tabs, Details and Style. Directions B (Map first) and C (Inspector) were not chosen; their renders stay in `.working/` as rejected options.

The final key screens are in [key-screens.html](mockups/key-screens.html) (nine screens, one picker) with a PNG per state in `mockups/`, linked at the sections below.

**The Designer is the one exception to the host theme.** The Map Studio Setup tab in the Ignition 8.3 Designer (owner, 2026-10-27) is a Swing form, not Perspective, so it wears the Designer's own look: the light theme, font, spacing and controls of Ignition's Project Properties dialog (bold section headings, labels left, dropdowns, "Select one..." placeholders). It is quiet (owner, 2026-10-27): labels, fields and section headings, with text only when it means something; help lives in label tooltips and a mark shows only when something is wrong. It takes nothing from the web component's tokens. See [designer-setup-form-normal.png](mockups/designer-setup-form-normal.png) and the interactive [designer-setup-form.html](mockups/designer-setup-form.html) (`?v=normal|reasons|inherited|newer|picker|empty|new`). The mock predates fix 16 (owner, 2026-10-27): its combo boxes, chevrons and footer link are superseded by the Designer's own dropdowns and spinner and a plain-text reason count, and it has no Gateway-not-reachable state (the Designer already shows when it has no Gateway; EXPERIENCE.md, Designer Setup Form).

## Colors

Every colour token is a reference to a host Perspective theme variable. No colour code is stored, typed or offered anywhere (PRD NFR-4, architecture AD-11). The names in the frontmatter are the Perspective theme variables the workshop mocks used; light and dark values come from the host theme. In the ign-scada-template host, the state tokens map to its `--st-*` set (`--st-alarm-1/2/3` with `-tint` and `-edge`, `--st-focus` for selection, `--st-backdrop` for halos); Map Studio itself only names the reference.

- **Neutral ramp (`surface-panel` to `attention`)** carries the whole normal map: panels, the basemap stand-in, lines, dots, glyphs, text. A normal field shows no hue except area tints (PRD SM-C2).
- **`selection`** marks what the user picked or is doing: the selection ring on a marker, the selected list row edge, the active tool, the snap indicator, the box select outline, the primary button, the line popup's segment box and its highlighted instruments, the phone crosshair ring. It never marks state.
- **`attention`** is the attention preset: a heavier outline plus the word, no hue (the template's `--st-attention`). It also fills the selected filter chip, the on switch and the toast.
- **`warning`** appears only on save problems (conflict, store unreachable, busy), on flagged import rows, and in the tag browser on the shared-tag note ("Same tag for every well pad") and a provider it cannot browse ("Can't browse edge-p12"), always with the warning glyph and words ("Not saved - conflict with ...", "Store unreachable - 2 edits not saved", "Check").
- **`alarm-1`, `alarm-2`, `alarm-3`** are alarm priority hues, used only on alarm glyphs, the line hue of the highest alarm, the alarm count in a list row and the popup's alarm block. The mocks used `--error` for priority 1; the final alarm tokens are epic-viewing's call (Open Question in EXPERIENCE.md).
- **Comms lost and stale have no colour.** They are a glyph, a word and a shape (dashed ring, dashed line), drawn in `glyph-normal`.
- **"All OK"** in the Needs you bar is neutral `text-secondary`: no hue when nothing needs attention.
- **`area-tint`** is a closed palette of low-saturation theme tokens for area categories only (FR-39), distinct from every alarm and preset hue. Points and lines never take a tint.

- **Designer setup form colours (`designer-*`)** are UIManager keys of the Designer's look and feel, read when the form is built, so the form follows the Designer's light or dark theme. A fallback colour applies only when a key is missing, kept in one place in the code (`SetupPanel` already falls back for `Component.error.focusedBorderColor`). `designer-error` marks a **reason** (the setup is not saved until it is fixed); `designer-warning` marks a **warning** (saved as typed). Each always comes with its glyph and words. There is no success colour: a valid field shows no mark (owner, 2026-10-27). `designer-tooltip-*` are the Designer's own tooltip keys, so label tooltips look like every other Designer tooltip.

Draw order: alarm over value style over area tint (AD-11).

Contrast: every non-text mark that carries state (glyphs, rings, dashed lines, the attention outline) reaches 3:1 against the basemap and panel in both themes (PRD NFR-3). This is checked against the host theme, so it is part of the engineering review (ER-27), not a value fixed here.

## Typography

The font family is the host theme's. Map Studio sets size and weight only.

- `{typography.body}` (13 px) for form fields, list rows, popup values.
- `{typography.small}` (12 px) for field labels, hints, save status, mode pill, chips.
- `{typography.tiny}` (11 px) for rail labels, state badges in rows, counts, instrument distances.
- `{typography.title}` (16 px, 600) for panel titles ("Mesa map", "P14", "Well pad", "Import"), the popup and sheet title, the first-run card title.
- `{typography.section-label}` (12 px, 600, tracked 0.04em, upper case) for panel section headers ("LIVE NOW", "6 STYLE RULE", "MESA FIELD").
- `{typography.map-label}` (12 px, 600) for item names on the map, with a halo in `basemap-blank` so they read over imagery; instrument names use the same weight at 11 px.
- `{typography.state-word}` (11 px, 500) for the state word chip beside a name ("Comms lost", "Stale", "Preview", "Updated").
- `{typography.count}` (28 px, 700) only for the three counts on the import Summary step.

Values in popups and the Live now block are right-aligned; the key value marked as the icon value is bold. Paths (tag paths, page links) are monospace at 11 or 12 px.

## Layout & Spacing

A 4 px base: `{spacing.1}` 4, `{spacing.2}` 8, `{spacing.3}` 12, `{spacing.4}` 16, `{spacing.5}` 24. Floating controls sit `{spacing.map-inset}` from the map edge.

**Edit mode, Direction A** (left to right): mode rail `{spacing.rail-width}`, docked list panel (`{spacing.list-panel-1366}` at 1366, `{spacing.list-panel-1440}` at 1440), docked properties panel (`{spacing.properties-panel-1366}` / `{spacing.properties-panel-1440}`, shown only while something is selected or in Kinds), then the map. At 1366 the map is about 718 px wide with an item selected and 1038 px with nothing selected. The draw toolbar floats top-centre over the map, with the mode pill below it; the Editing switch and zoom sit top-right. That top row is full at 1366: nothing more goes on it. Below about 1280 px the list panel collapses to a button, leaving the rail, properties and map. In Import the list and properties panels merge into one import panel (576 px at 1366) and the map shows the preview. See [key-screen-4-edit-items.png](mockups/key-screen-4-edit-items.png).

**View mode**: the map fills the component. Search top-left (`{components.search-field.width}`), the Needs you bar beside it, Edit switch and zoom top-right, Legend button bottom-left with the scale bar beside it. See [key-screen-1-view-desktop-popup.png](mockups/key-screen-1-view-desktop-popup.png) and [view-mode-1440.png](mockups/view-mode-1440.png).

**Reserved corner**: the bottom-right corner is kept clear for the Perspective App Bar toggle at every width. Anything docked right pads its footer by `{spacing.app-bar-clearance}`.

**Phone (390 px)**: the map fills the page; one top bar (`{components.phone-top-bar}`, `{spacing.phone-float-inset}` from the edges) holds search and Needs you and expands on tap; zoom (plus, minus, Fit) top-right under the bar; Legend bottom-left; popups and the edit form are bottom sheets `{spacing.phone-float-inset}` from the sides that stop above the App Bar toggle. Side gutter `{spacing.page-gutter-phone}` for content, every target `{spacing.target-touch}`. See [key-screen-2-phone-sheet.png](mockups/key-screen-2-phone-sheet.png).

**Designer setup form** (`{components.designer-setup-form}`): the setup tab holds one scrolling form and nothing beside it (no section list, owner 2026-10-27): the section headings Map store, Who can edit, Kinds and assets and Map sit inside the form, which is left aligned in the tab with the tab's 24 px padding and at most `{spacing.designer-form-max}` wide, so a 2000 px tab shows the same form as a 1440 px one with empty space to the right. No horizontal scroll bar: a narrower tab wraps the form; only the form scrolls vertically, with the footer in view. Labels sit in a `{spacing.designer-label-column}` column; combo boxes are `{spacing.designer-field}`, role pickers `{spacing.designer-chip-field}`, the refresh interval 96 px, each as tall as the Designer's look and feel draws it; reasons, warnings and the Map token note wrap at `{spacing.designer-message-width}`. Rows are `{spacing.designer-row-gap}` apart, sections `{spacing.designer-section-gap}`. A footer line across the bottom of the tab shows only when it has something to say (reasons left, a new unsaved setup).

## Elevation & Depth

Two levels only.

- **Docked**: the rail and panels sit flat on the component, separated by a 1 px `divider` edge. No shadow.
- **Floating**: everything over the map (draw toolbar, mode pill, search, Needs you bar and its list, Edit switch, zoom, legend, popup card, toast, conflict card, save banner, Recent changes, tag browser, first-run card, phone top bar) takes one soft shadow, the host theme's shadow where it has one, else a two-layer shadow in `attention` at about 10 % opacity. Bottom sheets on the phone take the same shadow upward.

Markers and instruments lift off the basemap with a 2 px halo in `basemap-blank`, not a shadow.

## Shapes

Soft but not round: `{rounded.DEFAULT}` (6 px) for buttons, inputs and rows; `{rounded.lg}` (10 px) for floating cards and the popup; `{rounded.full}` for chips, switches, marker discs and dots. Shapes on the map are reserved: **triangle, circle and square are alarm shapes** (ER-27), so no kind glyph uses an outline circle, square or triangle as its frame (icon catalogue rule). Markers are a neutral disc with the kind glyph inside. The key-screens mock frames the line valve instrument in a rounded square; that frame is not adopted until the instrument marker look is settled (Open Question in EXPERIENCE.md).

Icons: one minimalist style on a 24 px grid with a 2 px stroke in `currentColor` (core icon set). UI chrome glyphs in the mocks (eye, list, layers, undo, box select, pop-out, magnet, cloud, tag) are stand-ins; the approved sprite has no UI icons yet.

## Components

Visual specs. Behaviour lives in EXPERIENCE.md, Component Patterns.

- **Mode rail** - `{components.mode-rail}`. Five items stacked: View, Items, Kinds, Layers, Import, each a glyph over a `{typography.tiny}` label. The active item takes `surface-hover` and bold text. Shown in edit mode only.
- **Panel header** - map name in `{typography.title}` ("Mesa map"), then Undo and Redo icon buttons and the save status on the same line. A save problem moves the status to its own full-width row under the title so the words fit.
- **List row** - `{components.list-row}`. Checkbox, kind glyph, name, then a state badge right-aligned. Children (wells on a pad, laterals) indent 26 px under their site; wells show as secondary rows ("P14-2H well, on P14"). Group headers (`MESA FIELD`, `4 NEED ATTENTION`, "All normal", "Field-wide", "Just added") use `{typography.section-label}`.
- **State badge** - `{components.state-badge}`. Alarm: the priority glyph plus digit in the alarm hue ("triangle 1"). Comms lost: comms-lost glyph plus "Comms lost". Stale: hourglass plus "Stale". Unlinked: the word on a `surface-hover` pill. Never a coloured dot alone.
- **Filter button and chips** - `{components.filter-chip}`. The kind chips ("All 11", "Well pad 3" and so on) sit behind a **Filter** button in the list header beside Sort by; the selected chip is filled `attention`. The key-screens mock still shows the chips open, from before this simplification.
- **Properties panel and tabs** - `{components.properties-panel}`, `{components.panel-tabs}`. Header: kind glyph, name, a subline ("Well pad - linked to Mesa/P14"), close. Two tabs, **Details** and **Style**, underlined when active. Details holds name, kind, location with the place line and "Zoom to location", kind fields, then the asset link, page link, View alarms link and popup parts that were the Link tab, then the Live now block (Comms, key values with the icon value starred, Alarms) under a "From kind" tag. Sections separated by `divider`. Footer: "Add another like this" and a delete icon.
- **Override tag** - `{components.override-tag}`: the word "Override" in `selection` on a tint, beside any field that differs from its kind, with a Reset link. Unchanged fields carry a neutral "From kind" tag.
- **Mixed field** - `{components.mixed-field}`: an input showing "Mixed" (or "Mixed - 3 values") in italic secondary text, with the hint "Pick a value to set it on all 20" under it. See [key-screen-5-bulk-edit.png](mockups/key-screen-5-bulk-edit.png) and [editor-direction-a-bulk-1440.png](mockups/editor-direction-a-bulk-1440.png).
- **Floating draw toolbar** - `{components.draw-toolbar}`. Groups divided by thin rules: Select, Box select; kind buttons (Well pad, Tank battery, Pipeline); generic Point, Line, Area; Snap with a magnet glyph and "Snap off" or "Snap on". The active tool is tinted `selection`. While the store is unreachable the whole toolbar fades to `{components.draw-toolbar.paused-opacity}` and takes no input.
- **Mode pill** - `{components.mode-pill}`: glyph plus the mode in words under the toolbar ("Select", "Add a well pad - click the map, then drag to fine-tune", "20 selected - Shift-click to add").
- **Drawing bar** - a floating bar bottom-centre while a line or area is drawn: kind glyph, "New pipeline", progress ("2 points - 0.7 km - start floating"), snapping state, "Double-click or Enter to finish", Cancel (Esc) and Finish.
- **Editing switch** - `{components.editing-switch}`: in view mode an eye glyph, "Edit map" and an off switch; in edit mode a kinds glyph, "Editing" and an on switch.
- **Save status** - `{components.save-status}`: check plus "Saved"; spinner plus "Saving..."; on a warning tint with a glyph: "Not saved - conflict with Sam's change", "Store unreachable - 2 edits not saved", "Not saved - Map Studio is busy". Clickable. See [key-screen-9-save-states-saved.png](mockups/key-screen-9-save-states-saved.png), [-saving](mockups/key-screen-9-save-states-saving.png), [-conflict](mockups/key-screen-9-save-states-conflict.png), [-unreachable](mockups/key-screen-9-save-states-unreachable.png), [-busy](mockups/key-screen-9-save-states-busy.png).
- **Conflict card** - `{components.conflict-card}`: warning edge, a warning title, the other editor's change in a sentence ("Sam moved P14 about 40 m north at 10:42, while you were editing it."), "Your change, kept here and not saved: ...", two buttons.
- **Save banner** - `{components.save-banner}`: a floating card top-centre over the map with a warning edge, for Store unreachable (cloud glyph) and Busy (warning glyph): a title, what happened in a sentence, what was kept, a primary "Try again" and a second button ("Show my 2 edits" or "Discard my change").
- **Recent changes panel** - `{components.recent-changes-panel}`: floating card; at the top a note box naming the next undo step ("Next undo is one step: Undo: edit 3 pads") with an Undo button; then rows of who (initial avatar), what in a sentence ("Deleted line L-TEST and its 2 instruments in one change"), who and when in tiny text, and a ghost Revert button; a footer line explains Revert.
- **Toast and Undo bar** - `{components.toast-undo-bar}`: dark bar bottom-centre with a check, the message and an Undo button ("Undo: edit 20 pads"), never in the bottom-right corner.
- **Popup card** - `{components.popup-card}`. Header: kind glyph in a disc, name in `{typography.title}`, subline (kind and wells), a pop-out icon (the page link) and close. Body in order: Comms with its data age ("OK - 12 s ago"), a rule, 2 or 3 key values, then the alarm block: `alarm-1-tint` background with a 3 px alarm edge, "1 alarm - Priority 1, unacknowledged", the alarm text and age, and a primary "View alarms" button. With no alarm, a check and "No active alarms". A pointer joins the card to its item.
- **Line popup** - `{components.line-popup}`, the popup card for a line. Header: pipeline glyph, name, subline ("Pipeline - Produced water, 6 in, 2.9 km"), pop-out and close. Under it the **segment box** in `selection-tint` with a `selection` border: "Segment PT-1 to PT-2", its span ("1.1 to 2.8 km") and one line on the segment ("398 to 371 psi - drop 27 psi over 1.7 km", or the stale glyph and "Stale - drawn dashed until PT-2 updates"). Then Comms for the line ("OK - 4 instruments, oldest 9 s ago"), the heading "Instruments, CTB1 to SWD1" and one row per instrument in order: glyph (the snapped end points as small filled squares), name, distance in `{typography.tiny}`, value right-aligned ("No value" when it has none, "Stale - 371 psi (last)" when stale). The two instruments at the clicked segment's ends are highlighted [ASSUMPTION on the highlight treatment: `selection-tint` with a 3 px `selection` edge, as in the mock]. Alarms close the card. See [key-screen-3-line-instruments-live.png](mockups/key-screen-3-line-instruments-live.png) and [key-screen-3-line-instruments-stale.png](mockups/key-screen-3-line-instruments-stale.png).
- **Bottom sheet** - `{components.bottom-sheet}`: a sheet inset from the sides with rounded corners and a grab handle, stopping above the App Bar toggle. Header: kind glyph in a disc, name, subline, the pop-out icon and a close, both 44 px. Popup sheet body as the popup card; footer buttons side by side at 44 px: primary "View alarms" and "Edit". Edit sheet: title "Edit P14", subline "Saves as you go - Saved", Location with a Move button beside it, Name, kind fields, a hint ("On a phone you can move points and edit properties. Drawing and kinds need a wider screen."), footer Undo and a primary Done. See [key-screen-2-phone-edit.png](mockups/key-screen-2-phone-edit.png).
- **Phone top bar** - `{components.phone-top-bar}`: search glyph and "Search sites, wells", a divider, then "Needs you 3" in bold with the state glyphs and a chevron. Expanded, the ranked list opens inside the bar with rows at least 52 px tall. See [key-screen-2-phone-needs.png](mockups/key-screen-2-phone-needs.png).
- **Needs you bar** - `{components.needs-you-bar}`: "Needs you 3" in bold, then each count with its glyph ("triangle 1 alarm", "1 comms lost", "1 stale"), and a chevron. Opens a ranked list card below: rank number, state glyph, name and kind, the state in words, detail and age. With nothing to attend to it reads **"All OK"** in `{components.needs-you-bar.all-ok-foreground}`, no hue. See [key-screen-1-view-desktop-needs.png](mockups/key-screen-1-view-desktop-needs.png).
- **Search field** - `{components.search-field}`: search glyph and the placeholder "Search sites, wells or lines".
- **Legend** - `{components.legend}`. Closed: a "Legend" button with a layers glyph. Open: kind glyphs with names, alarm glyphs ("Priority 1 alarm, digit beside", "Acknowledged"), Comms lost, Stale value, line styles (pipeline weight by size, lateral, dashed for no data or comms lost), geofence; then Lines and Names checkboxes and the note "Below zoom 14 sites show as dots".
- **Zoom control** - `{components.zoom-control}`: plus, the zoom level ("z 15"), minus, Fit. 44 px targets on the phone.
- **Kind setup** - `{components.kind-setup-row}`. The header holds the kind glyph, name and subline, then a **"Preview item"** select (item name plus its asset folder in monospace, `[default]Mesa/P14`) with the line "Tag browser opens at its asset folder; the style rule previews on it, on the map too." Sections numbered in order: "1 Icon", "2 Key values", "3 Comms", "4 Alarms", "5 Popup", "6 Style rule" (tagged "Builds on key values"). Key value rows: name, the path in monospace, a tag icon button that opens the tag browser, an on/off switch, an "Icon value" star tag, a "Used by style rule" tag where it applies; a full path picked outside the asset folder adds a warning tag "Same tag for every well pad"; an unset row reads "Pick a tag" in italics; under them a resolve note ("Each path resolves for 3 of 3 well pads"). The row the browser is open for takes `selection-tint` with a 3 px `selection` edge. Comms: the heartbeat path; Alarms: the alarm source and the View alarms link; each path input ends in the same tag icon button. Popup: checkboxes for its parts and the note "Order is fixed: comms, values, alarms". Style rule: States, Bands or Expression; the value (a key value); the line "Previews on P14, the preview item chosen in the header, on the map too."; rows of "When Status is" value, a chevron, a "Use preset" select and a 64 px preview tile of the preview item in that preset with the state word; a note box with the live state and the precedence rule. See [key-screen-6-kinds-tags-open.png](mockups/key-screen-6-kinds-tags-open.png), [key-screen-6-kinds-style.png](mockups/key-screen-6-kinds-style.png) and [editor-direction-a-kinds-1366.png](mockups/editor-direction-a-kinds-1366.png) (the older Direction A mock, before the preview item moved to the header).
- **Tag browser** - `{components.tag-browser}` (owner, 2026-10-27, refined): a floating card over the map's left edge, beside the panel it was opened from, 380 px wide. Header "Pick a tag" with a close, and a "For:" line naming the value being picked ("For: Key value 4 of the Well pad kind", "For: Casing pressure on P14 only - an override"). A **Provider** select: the provider name in monospace, the Gateway default marked with a neutral "Default" tag and listed first; outside the asset folder a ghost "P14 folder" button with an up arrow sits beside it and returns the tree to the asset folder. The **tree** of that one provider in a bordered box (`tree-border`, max 268 px, scrolls): rows 24 px, 16 px indent per level, a chevron on folders and UDT instances, then a glyph for the type (folder, UDT instance, tag), the name in monospace, and two right columns in `{typography.tiny}` `text-secondary`: the type ("Folder", "UDT instance", "Reference", "Memory", ...) and, for tags, the data type ("Float8", "Int4", "String"). The asset folder row carries a neutral "Asset folder" tag and every row inside it a 2 px `border` guide on the left (`asset-folder-guide`). The picked row takes `selection-tint` with a 3 px `selection` edge. Under the tree, a **Path** input in monospace ("Path - pick in the tree or type one"), then a note box (`note-background`): inside the asset folder "Inside P14's asset folder - saved for every well pad as" with `{asset.path}/GasRate` in bold monospace and a check with "Resolves for 3 of 3 well pads"; outside it the **shared-tag note** on `warning-tint` with a 3 px `warning` edge, a warning glyph and "Same tag for every well pad" in `warning`, a sentence ("AmbientTemp is outside P14's asset folder, so it is saved as the full path and all 3 well pads show this one tag.") and the full path in bold monospace; on an override "Saved for P14 only, as the full path", the full path, and a line with the Override tag. Footer: Cancel and a primary "Use this tag" ("Use for P14" on an override), faded and inert until a tag is picked. States: a "Loading..." row with the save-status spinner under a folder being opened; "No tags in this folder" in italic `text-secondary` under an empty folder; a provider it cannot browse replaces the tree with a cloud glyph, "Can't browse edge-p12" in `warning`, a sentence and a primary "Try again", while the Path input stays usable. See [key-screen-6-kinds-tags-open.png](mockups/key-screen-6-kinds-tags-open.png), [-inside](mockups/key-screen-6-kinds-tags-inside.png), [-outside](mockups/key-screen-6-kinds-tags-outside.png), [-override](mockups/key-screen-6-kinds-tags-override.png), [-empty](mockups/key-screen-6-kinds-tags-empty.png), [-loading](mockups/key-screen-6-kinds-tags-loading.png), [-unreachable](mockups/key-screen-6-kinds-tags-unreachable.png).
- **Import steps** - `{components.import-step}`. Panel header: "Import", a tag with the file name and row count, and a cancel close. A four-part step bar (1 Preview, 2 Map columns, 3 Match to assets, 4 Summary), each part a 3 px top edge: active `attention` and bold, done `line-pipeline`, pending `divider`. Tables in `{typography.small}`; flagged rows on `warning-tint` with a warning glyph and "Check" or the problem ("No location"). Step 3 has filter chips (All, Confident, Check, Existing, Skip). Step 4 shows three bordered count cards in `{typography.count}` (new, updated, skipped) with a line each, a "Before you import" list and an undo note. Footer: Back (or "Choose another file"), then a primary "Next: Map columns" and so on, ending "Import 123 items". The map shows the preview rows as small dashed rings, with a floating chip "Preview - not on the map yet" bottom-left and an "Updated" word chip on existing items. See [key-screen-7-import-1.png](mockups/key-screen-7-import-1.png), [-2](mockups/key-screen-7-import-2.png), [-3](mockups/key-screen-7-import-3.png), [-4](mockups/key-screen-7-import-4.png).
- **First-run checklist** - `{components.first-run-checklist}`: a floating card centred on the empty map. Title "Get Mesa on the map", subline "Three steps. Edits save as you go." Three rows, each a numbered ring, a bold label, a line of help and a button: "Set up your kinds" (primary "Open Kinds"), "Add or import items" ("Import a file"), "Check the operator view" ("Open view mode"). Footer: "0 of 3 done" and a ghost "Hide checklist". The empty list panel says "No items yet" with a line of help. See [key-screen-8-first-run.png](mockups/key-screen-8-first-run.png).
- **Map marker** - `{components.map-marker}`. From zoom 14: a neutral disc with the kind glyph, name below in `{typography.map-label}`, state glyph at the top-right, state word chip beside the name. Below zoom 14: an 11 px neutral dot. Comms lost: dashed ring and a faded glyph. Attention: 3 px `attention` ring plus the word. Dimmed preset: faded and dashed. Selected: a `selection` ring outside a gap.
- **Alarm and state glyph usage** - `{components.alarm-glyph}`. Priority 1 triangle, priority 2 circle, priority 3 outlined square, in every state; unacknowledged solid, acknowledged filled with "!", rectified a check mark. The priority digit is a label beside the glyph, never inside it. Fade to 55 % only when the alarm is not live; dim to 35 % when out of scope (dim wins). Alarm glyphs stack above dots. A line's alarm glyph sits at its midpoint; an instrument's alarm glyph sits at the instrument's place on the line. Comms lost (crossed antenna) and stale (hourglass) are glyphs with no hue. Nothing blinks.
- **Map line** - `{components.map-line}`: weight 3, 4 or 6 px by pipe size; drawn **per segment** between instruments. A segment with no instrument at either end draws normal, a thin neutral line (`{components.map-line.untapped}`, 2 px). A segment takes the worst of its two end instruments: dashed `8 6` when either is stale or has no data or comms lost, hue only from the highest alarm. The name sits in a small chip at the midpoint and adds the state word ("L-SWD Stale") when a segment is stale; flow arrow on the selected line only.
- **Instrument marker** - `{components.instrument-marker}`: a tap, meter or line valve sits on its line [ASSUMPTION: a 24 px neutral disc with its glyph and the marker halo, name below at 11 px; the stale treatment is the dashed ring and the "Stale" word chip as for markers]; highlighted instruments take the marker's selected ring. The `meter` instrument glyph is new and distinct from meter station.
- **Phone crosshair** - `{components.phone-crosshair}`: a fixed 64 px crosshair at the map centre: a `selection` ring on a panel fill with the kind glyph inside and four `attention` ticks. A floating card at the top names the move ("Moving P14 - Drag the map to put the crosshair on the pad. 38 m from where it was."), the old position stays as a faded dashed marker labelled "Was here", and a bottom bar holds the coordinates, Cancel and a primary Done, both 44 px. See [key-screen-2-phone-move.png](mockups/key-screen-2-phone-move.png).

- **Designer setup form** - `{components.designer-setup-form}`, a Swing tab in the Ignition 8.3 Designer (owner, 2026-10-27). Header: "Map Studio Setup" in `{typography.designer-title}` with no subline (the tab names the project), and on the right a "Refresh lists" link (`{components.designer-header-link}`, accent text, no button chrome) 16 px before the schema version, small read-only text ("Schema version 1"; "Schema 2 - read only"), never a field. The link is the only refresh control in the form; it is absent in the empty and newer states. Banners under the header (`{components.designer-banner}`): info for "Inherited from <project>", warning for the read-only states (lock glyph). There is no Gateway-not-reachable banner or footer: the Designer shows that itself (owner, 2026-10-27). Sections with a `{typography.designer-heading}` title and a rule to the right, as Project Properties' "Tag Settings". Rows: label left, carrying the field's help as a tooltip (`{components.designer-tooltip}`: the Designer's tooltip colours, a 1 px edge, 12 px text, one line up to `{spacing.designer-message-width}` then wrapping; the mock draws the Phone-editing roles tooltip open under the pointer); the control (`{components.designer-combo}`: the Designer's own editable combo box, exactly as Project Properties' Default Database, with no arrow button, edge or background of ours; owner, 2026-10-27), then the warning glyph only when the value is not in its list (nothing when found, empty or the list is unavailable); under the control the reasons in `designer-error` with the error glyph and the warnings in `designer-warning` with the warning glyph. No help line under any field. The one visible note is under Map token, "Names only - the Designer never reads the token.", in `{typography.designer-note}` `designer-text-secondary`. Function names, page paths and secret names in monospace. Role pickers are chips (`{components.designer-chip}`) above a `{components.designer-combo}` "Add a role...", whose list is the provider's roles (those already added read "added"); one chip per role with a remove cross; an unknown role's chip takes the warning edge and glyph, a role listed twice takes the reason edge and glyph. The refresh interval is `{components.designer-spinner}` with "seconds" after it. A reason or warning never recolours a combo box or the spinner: its glyph and words carry it. Basemaps are four checkboxes in a row (None, OpenStreetMap, Satellite, Mapbox). Alarm page has nothing beside it: its list ends with the item "Insert placeholder...". Map token is a secret provider combo ("Select one...") and a secret name combo side by side. The newer-schema state replaces the form with "setup.json as written" in a read-only monospace box. Footer (`designer-panel`, 34 px, only when it has something to say): with reasons, the error glyph and "2 reasons left - this setup is not saved until they are fixed." as plain `designer-error` text (no link: the form is short, owner 2026-10-27) plus "2 warnings do not stop a save." in secondary text; a new setup, see below. The normal, inherited, empty and read-only states have no footer. No OK, Apply, Create or Cancel in the tab, and no create dialog. Empty state (no setup): a map glyph on an info-tint tile, "No Map Studio setup" in `{typography.designer-heading}`, one line of explanation, one primary button "Create setup" in `designer-accent` with white text, one `{typography.designer-note}` line below. New setup: the same form with the defaults, and under the title a small marker "New setup - saves with the project" (accent dot, info-tint fill, accent-tint edge); the footer shows the reasons left (or "New setup - not saved yet.") and a "Discard new setup" link at its right in `designer-accent`. See [-empty](mockups/designer-setup-form-empty.png), [-new](mockups/designer-setup-form-new.png), [-normal](mockups/designer-setup-form-normal.png), [-reasons](mockups/designer-setup-form-reasons.png), [-inherited](mockups/designer-setup-form-inherited.png), [-newer](mockups/designer-setup-form-newer.png), [-picker](mockups/designer-setup-form-picker.png).

## Do's and Don'ts

| Do | Don't |
|---|---|
| Reference a host theme token for every colour | Ship, store or accept a colour code; offer a colour picker |
| Draw normal items in neutral grey | Use hue for anything but abnormal state, selection or area tints |
| Say every state with a glyph or word as well as any hue | Let colour carry a state alone; colour comms lost or stale |
| Use triangle, circle and square only for alarm priorities | Frame a kind glyph in a circle, square or triangle |
| Put the priority digit beside the glyph | Put it inside the glyph |
| Keep the bottom-right corner clear for the App Bar toggle | Put a control, toast, sheet edge or footer button there |
| Choose looks from the closed preset list (normal, attention, warning, fault, dimmed; solid, dashed, dotted) | Invent per-item styles outside the presets |
| Float only what sits over the map | Shadow the docked panels |
| Keep one minimalist icon style, 24 px grid, 2 px stroke | Mix icon styles or take icons from OpenBridge |
| Show "All OK" in neutral when nothing needs attention | Hide the Needs you bar or show a green "0" |
| Keep the map still | Blink or pulse anything, including an unacknowledged alarm (engineering review item) |
| Give the Designer setup form the Designer's own look (UIManager keys, Project Properties layout) | Use the web component's tokens, or stretch fields across the tab's width |
| Use the Designer's own JComboBox and JSpinner as its look and feel draws them, as in Project Properties (owner, 2026-10-27) | Draw our own arrow button, edge or background on a combo box or spinner, or set a UI delegate |
| Keep the Designer setup form quiet: help in label tooltips, a mark only on a problem, one Refresh lists link, a footer only when it has something to say | Put a help line under every field, a green check beside valid fields, a refresh button per field, or a footer that only says all is well |
| Show the schema version as small read-only text in the header | Show it as a field that looks editable |
