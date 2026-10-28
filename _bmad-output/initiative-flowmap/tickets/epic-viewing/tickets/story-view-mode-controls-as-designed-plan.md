---
title: 'View-mode controls as designed'
type: 'feature'
ticket: '14'
created: '2026-10-28'
status: 'in-progress'
baseline_revision: '857102447d218abfbcb21ba1c2b1059fab059731'
route: 'full'
route_source: 'pinned'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/handoff-epic-3.md'
  - '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md'
  - '{project-root}/docs/contract.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Entries 5 to 7 each added a control on the right with its own look: MapLibre's zoom buttons, a Fit and Return pill in words, a row of basemap buttons and the spike's Draw a line, stacked top-right (owner, 2026-10-28, on entry 7's renders). DESIGN.md (View mode, Phone, zoom-control, legend) and the mockups show one zoom card top-right and a Legend button bottom-left with the scale bar beside it, and the spike's draw tool has no place in View mode (R5, R10).

**Approach:** One `ZoomControl` card top-right (plus, the zoom level as "z 15", minus, Fit and Return as icons, Return disabled with nothing selected) with the floating shadow and 44 px targets at phone width; one `LegendControl` bottom-left (a Legend button with the scale bar beside it) opening a panel that holds the basemap choice, built in sections so entry 3 adds the glyph key and the Lines and Names toggles; the draw tool shown only when the new `editMode` prop is true, which the dev editing page `/edit` sets; nothing in the bottom-right corner; theme tokens only.

## Decisions (recorded for the owner, 2026-10-28; the session is unattended)

1. **`editMode` prop** (boolean, default false; contract 0.3.0, unreleased): the spike's Draw a line is added only when it is true. EXPERIENCE.md already names a prop that opens the component straight into Edit mode; this is that prop, and today Edit mode holds the spike's line tool alone until epic-editing builds the studio. The dev `/edit` view, the store-checks view and the perf edit view set it; every other view is View mode. The e2e specs that draw lines open `/edit` (the tracer spec's drawing test becomes an editor test there; the phone measure's line-tool probe opens `/edit` in a second page).
2. **Zoom card.** Replaces MapLibre's `NavigationControl` and entry 7's `FitControl`: one `maplibregl-ctrl-group` card, `rounded.md` 8 px, the floating shadow, buttons plus, minus, Fit and Return as 24 px grid 2 px stroke inline glyphs in `currentColor`, the zoom level between plus and minus as "z 15" (`Math.round` of the zoom, `tiny` type, updated on `zoom`). Class names `mapstudio-fit-button` and `mapstudio-return-button` stay for the specs; the card is `.mapstudio-zoom`.
3. **Legend row.** The bottom-left holds one control: a row of the Legend button (layers glyph and the word, `rounded.lg`, the shadow), MapLibre's `ScaleControl` (metric, 80 px) and MapLibre's attribution (never compact), in that order; the row wraps upward (`wrap-reverse`) on a phone so the attribution sits above the button when it does not fit beside. The mockups draw basemap None and show no attribution; with a basemap it must stay visible (R10), and beside the scale bar is the one place that keeps the bottom-right corner clear and the map's left edge quiet.
4. **Legend panel.** Opens above the button (`legend` 208 px wide, `rounded.lg`, the shadow), `aria-expanded` on the button, `role="region"` with the label "Legend", built from sections (`section-label` type) so entry 3 adds the glyph key and the toggles before the basemap section. The first section is **Basemap**: one button per offered basemap in the setup's order, `aria-pressed` on the chosen one, the refusal or tile status in words under them. The section shows whenever the setup offers at least one basemap (a single pressed button says what is drawn; entry 6 hid its row with fewer than two). The panel's DOM exists only while it is open, so a hidden button never counts as a target. Esc closes it and returns focus to the button; a click on the map closes it; the button toggles it. Open or closed is `data-legend-open` on `.mapstudio-map`.
5. **Surfaces and shadow.** Controls keep `--container` as their surface (as every control and the popup do) until entry 12 reviews the surface tokens against DESIGN.md's `surface-panel`; the floating shadow is `--boxShadow1` where the host theme defines it (Perspective's themes do), else two layers of `--neutral-90` at 10 % through `color-mix`, in one token `--mapstudio-float-shadow` on `.mapstudio`. No colour literal.
6. **Insets and targets.** Floating controls sit 12 px from the map edge (`map-inset`), 8 px on a phone (`phone-float-inset`); buttons are 32 px with a mouse and 44 px below 768 px (`target-touch`), the Draw a line button on `/edit` included.
7. **No subagents.** The session has no subagent tool: this agent implements from the plan and runs the quick review lens itself over the staged diff.

## Boundaries & Constraints

**Always:** every colour a theme token (AD-11); the state of every control said in words or a glyph with `aria-label`; the attribution visible whenever a basemap is drawn; nothing in the bottom-right corner at any width; the panel and the zoom card operable by keyboard (Tab, Enter or Space, Esc); contract 0.3.0 (`check-contract-versions.sh` green); no em dashes; `README.md` untouched; existing e2e attributes (`data-basemap*`, `data-fit`, `data-selected`, `data-zoom`) kept.

**Never:** the legend's glyph key, the Lines and Names toggles (entry 3), search (9), the Needs you bar (3), the Edit switch or the rail (epic-editing), a change to the basemap messages or the token path, a change to `ign-scada-template`, a `.modl` or scratch project committed, a Gateway write outside the local dev stack.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Zoom level text | zoom 14.6 | "z 15"; 12 gives "z 12" | none |
| Zoom buttons | plus, minus clicked | the map zooms in or out by one level; the text follows on `zoom` | none |
| Return | nothing selected | the button is `disabled`; with a point selected it pans to it at the zoom the viewer has | none |
| Fit | items loaded | enabled, pressed while the fit keeps (`data-fit` kept) | disabled with no items |
| Legend closed | page load | the panel is absent; `data-legend-open` false; the button has `aria-expanded` false | none |
| Legend open | the button clicked or Enter on it | the panel above the button with the Basemap section (None, OpenStreetMap, Satellite from the setup) and focus inside; `data-legend-open` true | none |
| Basemap chosen | a panel button clicked | the map draws it, the attribution shows, the panel stays open | a refusal in words under the buttons |
| Esc | the panel open | the panel closes and the Legend button has focus | none |
| Map click | the panel open | the panel closes | none |
| View mode | `/`, `/live`, `/two` | no `.mapstudio-draw-button` | none |
| Edit mode | `editMode` true (`/edit`) | the draw button top-right under the zoom card; disabled while the store is unreachable as before | none |
| Phone | 390 px | every `.mapstudio .maplibregl-ctrl button` at least 44 px; the zoom card and the legend row inside the viewport; nothing in the bottom-right 64 px corner | none |

</frozen-after-approval>

## Code Map

- `common/src/main/resources/mapstudio.props.json` -- add `editMode` (boolean, default false) beside `previewStyles`; the Java side reads the schema only.
- `web/typescript/ZoomControl.ts` (new, replaces `FitControl.ts`) -- an `IControl` with plus, level, minus, Fit, Return; `setFit(enabled, kept)`, `setReturn(enabled)`, `setZoom(z)`; glyph SVGs inline.
- `web/typescript/LegendControl.ts` (new, replaces `BasemapControl.ts`) -- the row (button, `ScaleControl`, `AttributionControl` elements appended to it), the panel with its sections, `setOffered`, `setSelected`, `setStatus`, `open()`, `close()`, `isOpen()`, `onToggle` callback for `data-legend-open`.
- `web/typescript/controls.ts` (new, pure) -- `zoomLevelText(zoom)`, the glyph path strings; Jest `controls.test.ts`.
- `web/typescript/MapStudio.tsx` -- `MapStudioProps.editMode`; `getPropsReducer` reads it; `componentDidMount` adds `ZoomControl` top-right, `LegendControl` bottom-left (no separate `AttributionControl`), the draw control only with `editMode`; `map.on('zoom')` feeds the level; `onMapClick` closes the legend; `publishFit`, `publishSelection`, `applyBasemap`, `publishBasemap` talk to the new controls; `applyEditing` tolerates a missing draw control.
- `web/typescript/mapstudio.css` -- the shadow token, the insets, the zoom card, the legend row, panel and section styles, the scale bar and attribution on tokens, the 44 px targets below 768 px; the old basemap and fit rules go.
- `ops/project/.../views/MapStudioEdit/view.json`, `ops/store-checks/.../MapStudioCheck/view.json`, `ops/perf/.../MapStudioPerfEdit/view.json` -- `editMode: true`.
- `e2e/tests/basemaps.spec.mjs` -- open the legend before the basemap buttons; the keyboard and Esc checks; the zoom card and the corner at 390; no draw button on `/`. `labels.spec.mjs` -- `.mapstudio-zoom` for the corner check. `tracer.spec.mjs` -- the drawing test as `editorTest` on `/edit`. `measures.spec.mjs` -- the line-tool probe on `/edit`.
- `docs/basemaps.md`, `docs/contract.md` (props table, the attribution line, "What the map draws"), `docs/map-parity.md` (rows 5, 7, 11), `docs/development.md` (the spike's tool on `/edit`), `CHANGELOG.md` (0.3.0), `docs/platform-checks.md` ("Epic 3 entry 14"), `docs/screenshots/` (the docs run refreshes them).

## Tasks & Acceptance

**Execution:**
- [x] `common/.../mapstudio.props.json` -- the `editMode` prop.
- [x] `web/typescript/{controls,ZoomControl,LegendControl}.ts`, `MapStudio.tsx`, `mapstudio.css`, the Jest test; `FitControl.ts` and `BasemapControl.ts` removed.
- [x] `ops/` -- `editMode` on the three editing views.
- [x] `e2e/` -- the four specs.
- [x] `docs/`, `CHANGELOG.md`, this plan.

**Acceptance Criteria:**
- Given the dev stack at 1440 and 390 px, when `/` loads, then the top-right holds one zoom card (plus, the level, minus, Fit, Return) and nothing else, Return disabled until a selection and recentring on one.
- Given the Legend button bottom-left, when it is clicked or opened by keyboard, then its panel's basemap choice switches None, OpenStreetMap and Satellite with the attribution still shown, and Esc closes it.
- Given View mode, then no Draw a line control exists; given `/edit`, then it does.
- Given 390 px, then the bottom-right corner is clear and every control button is 44 px.
- Given the hand-off's checks, then every one passes (build, tsc, jest, e2e on a fresh stack, the contract version checks).

## Implementation Notes

- **Commits on the worktree branch** (`worktree-agent-ae6f21a193005b8ce`, baseline `8571024`): 78b598f (the controls, the prop, the views, the specs, this plan), f0b1994 (the docs and the changelog), the row fix (what the first live run taught: a percentage `max-width` on the floated control bounded the row to nothing, so the attribution wrapped above the button at 1440 px; the corner's container is bounded instead, and the reply box clears the wrapped row on a phone), then the closing commit (evidence, screenshots, this plan).
- **Decision 4 refined:** the panel is inserted before the row inside the control's own element, so it sits above the button in the corner's flow and no absolute placement is needed; the first basemap button takes the focus on open.
- **The tracer spec** draws its line on `/edit` as the map editor (`editorTest`), so the `mapstudio-dev-1440.png` and `-390.png` screenshots now show the dev editing page with Edit mode's tool; the phone measure's line-tool probe opens `/edit` in a second page of its mobile context.
- **Not done, by scope:** the glyph key and the Lines and Names toggles (entry 3, the panel's sections take them), the Edit switch and the rail (epic-editing), the surface token review (entry 12: the controls keep `--container`), a live change of `editMode` (read once at mount; `docs/contract.md` says so).

## Plan Change Log

## Review Triage Log

Review pass 1 (quick lens, read by this agent from the diff against the baseline; no subagent tool in this session): 0 high, 1 medium, 2 low, 0 false, 0 maybe-false.

| Finding | Verdict | Route | Evidence |
| --- | --- | --- | --- |
| The legend row's `max-width` was a percentage of its own floated box, so the attribution wrapped above the Legend button even at 1440 px and the row's box spanned the viewport, which put it in the reserved corner | medium | patch | seen in the first live run's screenshots and the failing corner check; the corner's container is bounded instead (`calc(100% - 76px)`) and the checks read the row's parts; patched before the final verification |
| `editMode` is read once at mount: a prop changed while the session is open adds or removes nothing | low (by design; the dev views set it statically) | rejected | `componentDidMount` adds the draw control; `docs/contract.md` and the platform checks say so; epic-editing's Edit switch owns the live transition |
| A basemap click that makes the attribution appear can grow the row and move the open panel up under the pointer, so the hover tint lands on the next button | low | rejected | cosmetic; the choice and `aria-pressed` are right (seen at 390 px in the first run); the row stays one line at desktop widths |

## Design Notes

**Why one control holds the legend row.** MapLibre stacks the controls of a corner vertically (`insertBefore firstChild` for the bottom corners), so a button, a scale bar and an attribution added as three controls would stack; one control that appends the other two controls' elements (`ScaleControl.onAdd(map)`, `AttributionControl.onAdd(map)`) into its own flex row keeps MapLibre's own scale and attribution behaviour and the designed row.

## Verification

**Commands:**
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` (with the scratch init script that keeps the node plugin from downloading Node) -- expected: BUILD SUCCESSFUL.
- `cd web && npx tsc --noEmit && npx jest` -- expected: no type error, all tests pass.
- `ops/up.sh --fresh --no-build` with the module staged by hand, then `cd e2e && npm ci && E2E_DOCS=1 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: every spec passes.
- `bash scripts/ci/check-contract-versions.sh` and `bash scripts/ci/test-contract-versions.sh` -- expected: OK.
- `grep -rnP '\xE2\x80\x94'` on every changed file -- expected: no match.

**Manual checks:**
- The 1440 and 390 screenshots in `docs/screenshots/` compared with `ux-map-studio/mockups/view-mode-1440.png` and `key-screen-2-phone-sheet.png`: the zoom card top-right, the Legend button and scale bar bottom-left, nothing bottom-right.
