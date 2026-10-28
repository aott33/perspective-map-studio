---
title: 'Value-driven styles and area category tints drawn from live values'
type: 'feature'
ticket: '1'
created: '2026-10-28'
status: 'in-progress'
baseline_revision: '769f3c7'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/handoff-epic-3.md'
  - '{project-root}/docs/contract.md'
  - '{project-root}/docs/kind-setup.md'
  - '{project-root}/_bmad-output/backlog/spike-style-rule-expression-language.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A kind setup's `styleRule` and `areaTints` are stored and checked (epic 2 story 9) but nothing reads them: the rule's source is never subscribed, no preset reaches the browser, points and lines draw state from comms and alarms alone, and an area draws as a plain line. The expression type's language and where it runs were open until the refinement (owner, 2026-10-28: Ignition's expressions, on the Gateway, checked live first).

**Approach:** Check live on 8.3 whether module code can evaluate an Ignition expression against a value (the SDK's `StringParser` with a parse context that binds `{value}`), record it, then work every map item's rule out on the Gateway in the shared live-value cache: the rule's source is one more slot of the shared subscription, States, Bands and the expression pick a preset, a stale source gives `normal` marked stale, and the preset name travels in `values.batch` as a `style` slot. The browser draws the preset on points (ring, word), lines (hue, dash, weight, word) and areas (the category tint from the kind display), alarm over value style over tint, from theme tokens that stand in until entry 12. A `StylePreview` component draws every case of a rule in its preset, exported for the kind setup screen, shown on the dev page `/styles` in both themes, and `docs/styles.md` lists every preset and tint for ER-27.

## Decisions (recorded for the owner, 2026-10-28; the session is unattended)

1. **Expression.** Parsed once per rule by `StringParser.newStandardParser_NonLocalized()` with an `ExpressionParseContext` whose function factory is `DefaultFunctionFactory.getSharedInstance()` and whose only bound reference is `{value}` (the source's value as a `ConstantExpression`); any other `{reference}` is a parse error. An expression that does not parse is refused by the write path (`invalid`, the parser's reason), so a stored rule always parses; an expression that throws at run time or gives anything but a preset name of the kind draws `normal` and the item reports a `style` problem in words. The result is read as text; `dimmed` and the line presets count. Evaluated per source delivery on the batch build (the live thread), never on the tag thread. The live measure (cost per evaluation, errors) goes to `docs/platform-checks.md`.
2. **Style slot.** Each planned item with a rule carries `style: {preset, stale, reason}` in the batch: the preset the rule gives, or `normal` with `stale: true` and the reason (the source's quality name, `no value yet`, `comms lost`) when the source is stale; a value in no band and a state with no case give `normal`, not stale. The source slot is `style` in the plan; a `{kpi}` source shares the KPI's path (one subscription) and is still subscribed when that KPI is off; an item's `overrides.styleRule` replaces the kind's whole rule. A `{instruments: "worst"}` source makes no slot (entry 2).
3. **KindDisplay** gains the path-free `styleRule {type, source, cases}` (source `kpi:<key>`, `tag` or `instruments`; a case is `{label, preset}`: a state's value, a band's "min to max", or for an expression each preset name quoted in its text) and `areaTints {property, tints}`, so viewers draw an area's tint from its property and the preview and the legend (entry 3) have the cases without a path.
4. **The look.** Points: `attention` a 3 px ring in `--mapstudio-attention` (fallback `--neutral-90`) and the chip word "Attention"; `warning` a 2.5 px ring in `--mapstudio-warning` (`--warning`) and "Warning"; `fault` the same in `--mapstudio-fault` (`--error`) and "Fault"; `dimmed` the disc and glyph at 45 % with a dashed neutral ring and "Out of service". The alarm badge draws over any of them; comms lost and stale replace the look (the Gateway already dropped the style) and keep their words. Lines: the three hues and words the same (an alarm's hue wins, the badge at the midpoint), `dimmed` at 45 %, `solid`, `dashed` (8 6) and `dotted` (1 3, round caps) patterns, weight by pipe size as entry 7; a stale source draws dashed. Areas (a line kind with `area: true`): a closed fill at 22 % in the tint token and a 1.5 px outline at 80 %; `--mapstudio-tint-1` to `-6` fall back to `--qual-3`, `--qual-7`, `--qual-2`, `--qual-9`, `--qual-10`, `--qual-8` (none the comms-lost purple `--qual-1` or the error red); a category with no tint, or no `areaTints`, draws the neutral area look. Every token is a stand-in for entry 12.
5. **Preview.** `web/typescript/StylePreview.tsx`, exported from the bundle (`MapStudio.StylePreview`), takes a kind display's `styleRule` with the kind's geometry and icon and draws one tile per case: the marker image's own SVG (`markerSvg`) or a line sample, the case label and the preset word; the tints the same for `areaTints`. The component draws it in a panel when the prop `previewStyles` is true (a closed-list prop, documented), which the dev page `/styles` sets; the page has a theme button (light and dark) so the e2e takes both screenshots for `docs/styles.md`.
6. **Dev stack.** The Pad UDT gains `Status` (Int4, memory, 0; a fresh volume once), the seed's pad setup a States rule on `{asset.path}/Status` (1 attention, 2 warning, 3 fault, 4 dimmed), the line kind setup a Flow KPI and a Bands rule on it (below 50 normal, 50 to 200 attention, 200 and above fault) with the tracer line linked to asset `L3`, Point 2 (P14) an override expression rule `if({value} > 600, 'warning', 'normal')` on `[default]Mesa/P14/Pressure`, and two geofences (North, South) with the geofence setup's `areaTints`. The `/live` buttons gain Status 0 to 4, L3 flow and P14 pressure.
7. **No subagents.** The session has no subagent tool: this agent implements from the plan and runs the quick review lens by reading the diff.

## Boundaries & Constraints

**Always:** the rule is worked out on the Gateway, once per item per batch build, never per session; one subscription per path (a `{kpi}` source adds none); a stale source draws only as stale; alarm over value style over tint; every colour a theme token read from the component root with a Perspective variable fallback, no literal in code, CSS or stored data; every preset said with a word or glyph, never colour alone; no tint on a point or a line; no tag path and no expression text in a batch; contract 0.3.0 with `docs/contract.md` and `docs/kind-setup.md` updated and `check-contract-versions.sh` green; Jython 2.7 rules in the seed and `mapstudio_live`; no em dash.

**Never:** the instruments source (entry 2), the legend (entry 3), the kind setup screen and rule editing (epic-editing), the hue review (entry 12), a change to `ign-scada-template`, a write to any Gateway but the local dev stack, a `.modl` or scratch file committed.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| States rule | pad rule on `{asset.path}/Status`, Status 2 delivered Good | `style {preset: warning, stale: false}`; the marker's warning ring and the chip "Warning" | a value with no case: `normal` |
| Bands rule on a KPI | line rule on KPI `flow`, Flow 120 | `style {preset: attention}`; one subscription for the KPI and the rule | a value in no band: `normal`; a non-number value: `normal` with a `style` problem |
| Expression rule | override `if({value} > 600, 'warning', 'normal')`, Pressure 700 | `style {preset: warning}` | an expression that errors or gives a non-preset: `normal` and a `style` problem; one that does not parse is refused at save |
| Stale source | Status quality Bad, or the item's comms false | `style {preset: normal, stale: true, reason}`; the map draws the stale or comms-lost look alone | none |
| Alarm over style | Pressure 950 (alarm) and Status 2 | the alarm badge and digit over the warning ring and word | none |
| Area tint | geofence with `operator: North`, tints North tint-1 | the fill in `--mapstudio-tint-1`; a point or line of any kind never takes one | an unknown category: the neutral area look |
| Override | an item's `overrides.styleRule` | that item's rule replaces the kind's; the kind's other items keep theirs | an override whose source path is not full: ignored, the kind's rule applies |
| Switched off | a kind setup with no rule | no `style` slot, no extra subscription | none |
| Preview | the pad's display rule | four tiles, one per case, each with its preset look and word | an expression rule: a tile per preset named in it |

</frozen-after-approval>

## Code Map

- `common/.../contract/StyleRule.java` (new) -- the parsed rule (states, bands, expression) and the pure `preset(value)` for states and bands; the display projection.
- `common/.../contract/KindDisplay.java`, `KindDisplayTest` -- `styleRule` and `areaTints` projections.
- `common/.../contract/StylePresets.java` -- unchanged lists; `isPreset`.
- `gateway/.../live/StyleExpressions.java` (new) -- the Ignition expression parse and run (`StringParser`, `ConstantExpression`), the parse check the write path calls.
- `gateway/.../live/ValuePlan.java`, `LiveValueCache.java` -- the `style` slot, the rule per item, the slot in `itemJson`.
- `gateway/.../write/WriteService.java` -- the expression parse check on a kind setup and an override.
- `web/typescript/live.ts` -- `StyleSlot`, `ItemState.preset`, the display's rule and tints; `markers.ts` -- the preset in the marker spec and image, the words, the line look; `features.ts` -- areas; `theme.ts`/`MapStudio.tsx` -- the tokens, the area layers, the dotted layer, the preview panel, the `previewStyles` prop; `StylePreview.tsx` (new); `mapstudio.css`; `index.ts` export; `mapstudio.props.json`.
- `ops/` -- the UDT, the seed (line and geofence setups, the override, the geofences, L3 link), `mapstudio_live`, the `/live` buttons, the `/styles` page.
- `e2e/tests/styles.spec.mjs` (new), `docs/styles.md` (new), `docs/contract.md`, `docs/kind-setup.md`, `docs/platform-checks.md`, `CHANGELOG.md`, architecture AD-16, the spike's Notes.

## Tasks & Acceptance

**Execution:**
- [ ] `common/` -- `StyleRule`, the display projections, tests.
- [ ] `gateway/` -- `StyleExpressions`, the plan's style slot, the cache's style evaluation, the write path's parse check, tests.
- [ ] `web/` -- the slot, the looks, the areas, the preview, the prop, tests.
- [ ] `ops/` -- the UDT, the seed, the buttons, the `/styles` page.
- [ ] `e2e/tests/styles.spec.mjs` -- the verify line, screenshots in both themes.
- [ ] docs, CHANGELOG, architecture, the spike, platform checks, this plan.

**Acceptance Criteria:**
- Given the dev Gateway with the seeded setups, when P12's Status and L3's Flow change, then Point 1's marker and the tracer line change their look within one refresh interval.
- Given Pressure of P12 above 900 with Status 2, then the alarm badge draws over the warning look.
- Given Comms of P12 false, then Point 1 shows comms lost alone, and the warning look returns when comms are back.
- Given the two geofences, then each draws its tint and no point or line does.
- Given `/styles`, then every case of every rule and every tint draws in its preset, in light and dark.
- Given the hand-off's checks, then every one passes.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

## Verification

**Commands:**
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` (with the scratch init script that keeps the node plugin from downloading Node) -- expected: BUILD SUCCESSFUL.
- `cd web && npx tsc --noEmit && npx jest` -- expected: no type error, all tests pass.
- `ops/up.sh --fresh --no-build` with the module staged by hand, then `cd e2e && npm ci && E2E_DOCS=1 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: every spec passes, `styles.spec.mjs` included.
- `bash scripts/ci/check-contract-versions.sh` and `bash scripts/ci/test-contract-versions.sh` -- expected: OK.
- `grep -rnP '\xE2\x80\x94'` on every changed file -- expected: no match.
