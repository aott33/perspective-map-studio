---
title: 'Hue tokens and the engineering review pack'
type: 'story'
ticket: '12'
created: '2026-10-29'
status: 'built'
baseline_revision: '40bbfeedd9acc5cab6a2566b2f7eb1988f4336da'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/handoff-epic-3.md'
  - '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md'
  - '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md'
  - '{project-root}/docs/styles.md'
  - '{project-root}/docs/icons.md'
  - '{project-root}/docs/map-parity.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Every hue the map draws (comms lost, the three alarm priorities, the presets, the six tints) was a stand-in from entries 5 and 1, and the alarm presentation changes of entries 1, 2, 3, 8 and 15 (the comms-lost colour, the bare-glyph badge, the kind glyph in the marker, instrument alarms, the per-segment look, the Needs you counts, the legend's key, the bottom sheets, the custom view's close row) each waited for one engineering review (ER-27) before release 0.3.0 (owner, 2026-10-28: all hue tokens to one review; R16). Nothing had checked the hues for contrast, and nothing showed the reviewer every state in both themes.

**Approach:** Choose the final tokens by a committed contrast check (every state mark 3:1 or better against the blank map, the panel and a light raster sample in both bundled themes, WCAG 1.4.11), fix every miss, and build the review pack: one docs page with every state rendered from the showcase project in the light and the dark theme side by side, what changed against the template's reviewed rules, and a verdict line per item, left empty for the owner's review (the hitl step).

## Decisions (recorded for the owner, 2026-10-29; the session is unattended)

1. **Comms lost on `--qual-4` (magenta), not `--qual-1` (purple).** The owner's decision allows the magenta or purple family. Purple-60, the dark theme's `--qual-1`, is 2.81:1 on the dark map (the badge's halo disc); the one purple both themes share (`--div-4`, purple-50) is 2.96:1 on the light map; magenta (`--qual-4`: magenta-70 light, magenta-40 dark) is 6.22 and 5.70. A host theme that wants purple defines the token itself (purple-70 light and purple-50 dark pass); the review page says so and the reviewer may still prefer it.
2. **`warning` and `fault` keep the alarm hues of priorities 2 and 1.** A Perspective theme has one warning and one error hue, and the bundled palette has no free family for two more (magenta and purple are comms lost's, blue is priority 3's). A preset is a ring and a word; an alarm is the IEC glyph with its digit; both draw when both apply. The review page states it and asks the verdict.
3. **The tints move off magenta.** `tint-4` was `--qual-9` (magenta-50, the comms-lost family) and becomes navy (`--qual-8`); `tint-6` becomes a light teal (`--div-12`, the same in both themes) because the bundled palette has only five hue families no state uses (teal, green, sky, navy, sand); `tint-5` stays sand (bronze-50, priority 2's family, a wash against a glyph with a digit: flagged for the review).
4. **A halo under every line.** The dark theme's alarm hues and the dashed stale look were under 3:1 on a light OpenStreetMap tile (2.25 to 2.93). Every line now draws over a halo in the blank-map token, one pixel each side, as every marker, badge and text label has since entry 7: invisible on the blank map, under the selection casing (which covers it on the selected line, so the accepted showcase renders are unchanged), its dash scaled per weight under a dashed or dotted line. The line's counted surface is its halo; the raster figure stays in the table as the look the halo was added for.
5. **The showcase draws the review states; the dev `/styles` page draws the palettes.** The showcase gains five dev-only review alarm tags (CS01 Medium, CTB1 Low, P12 High, PT-1 Medium, PT-2 Low; quiet after the seed), a page `/dark` whose view sets the session's theme at startup, and a custom popup view `Popups/SiteCard` on the SWD kind; the dev `/styles` page gains three buttons that raise the review states (`alarms`, `stale` with PT-2 comms lost, `off`), so the accepted showcase renders of entry 15 keep their three states (the seed clears and acknowledges the review alarms). The presets and tints come from the `/styles` page's existing light and dark renders, because showing them on the showcase would add items or rules to the accepted field.
6. **The light raster sample is a constant.** The e2e suite's tile stub is a flat test colour, so the sample is the standard OpenStreetMap style's land colour (#F2EFE9, openstreetmap-carto `@land-color`), the lightest ground a tile shows.
7. **DESIGN.md is not edited.** Its `colors` frontmatter marks the alarm tokens as epic-viewing's call and the tints as not chosen; the choice is recorded in the review page, docs/styles.md and this plan, and the owner's verdict updates the spine.

## Boundaries & Constraints

**Always:** theme tokens only, no colour literal in the module's styles or code (the unit test pins the fallbacks); every state said with a glyph or a word, never colour alone; comms lost distinct from every alarm, preset and tint hue; the accepted showcase renders of entry 15 unchanged in their three states; Jython 2.7 in every project script (no `import system`, `java.lang.Throwable` and `Exception` both caught); the review alarm tags dev-only test equipment on the disposable dev Gateway; no em dashes; no model ids outside the commit trailers; contract 0.3.0 unchanged.

**Never:** the ER-27 verdict written by this agent (the verdict lines stay empty, the owner's record goes to platform-checks.md and the epic's Notes); `ign-scada-template` touched; a write to any Gateway but the local dev stack; a committed timeout raised; a `.modl`, token or password in git; a push, tag or release.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| The contrast check, light theme | the showcase page `/`, the computed tokens | every state mark 3:1 or better on its counted surfaces; the table written | a computed value that is not a colour fails the test |
| The contrast check, dark theme | `/dark`, reloaded once the session is dark | the same; comms lost 5.70 on the dark map | a miss names the mark and its ratios |
| The review states | the `/styles` button "Showcase review alarms" | Needs you 8: 6 alarms, 1 comms lost, 1 stale; P12 and PT-2 acknowledged; L-SWD's segments 2, 2, 3 | an alarm that does not go active in 10 s is an error in the result |
| PT-2 comms lost | "Showcase review stale" | PT-2's two segments dashed, its marker comms lost with its alarm badge, the line stale in Needs you (9) | none |
| The mockups' states back | "Showcase review off", or the seed | the review alarms cleared and acknowledged, comms on; showcase.spec's three states | none |
| The dark page | `/dark` | the session theme dark from the view's startup; a new session starts light | a token read while the theme stylesheet swaps is empty: the draw tool warns once (seen once in three runs); the pack renders the reload |
| A line on a light tile, dark theme | OpenStreetMap under the dark theme | the line over a one-pixel halo in the blank-map token | none |
| The selected line | a click on L-SWD | the selection casing over the halo, the look of entry 2 | none |

</frozen-after-approval>

## Code Map

Paths: `W` = `web/typescript`, `E` = `e2e`, `O` = `ops`, `D` = `docs`.

- `W/mapstudio.css` -- the token block: `--mapstudio-comms-lost: var(--qual-4)`, the alarm tokens, the presets, the six tints (`--qual-3`, `--qual-7`, `--qual-2`, `--qual-8`, `--qual-10`, `--div-12`), with the reasons.
- `W/markers.ts` -- `MARKER_TOKENS` fallbacks; `LINE_HALO_WIDTH`, `lineHaloDash(pattern)`; `W/MapStudio.tsx` -- the three halo layers under the selection casing; `W/__tests__/markers.test.ts` -- the fallbacks and the halo dash.
- `E/lib/contrast.mjs` -- luminance, ratio, compositing, `TOKENS`, `MARKS`, `checkTheme`, `misses`, `markdownTable`; `E/lib/contrast.test.mjs` (in `npm run test:unit`).
- `E/tests/review.spec.mjs` -- the pack: both themes, 1440, 1366 and 390 px, the contrast check, eighteen renders `review-<theme>-*.png`, the tables `D/review-er27-contrast-<theme>.md`.
- `O/config/core/.../Showcase/{CS01,CTB1,P12,PT1,PT2}/tags.json` -- the review alarm tags; `O/project/ignition/script-python/mapstudio_showcase_seed/code.py` -- `REVIEW_ALARMS`, `review_states(mode)`, `set_states` clears them, the SWD setup's `popupView`; `O/project/.../views/MapStudioStyles/view.json` -- the three buttons and the result label.
- `O/showcase/project/.../views/ShowcaseDark`, `Popups/SiteCard`, `page-config/config.json` (`/dark`).
- `E/tests/showcase.spec.mjs` -- 33 tags written.
- `D/review-er27.md` (the pack), `D/styles.md`, `D/icons.md`, `D/contract.md`, `D/map-parity.md`, `D/kind-setup.md`, `D/development.md`, `D/platform-checks.md`, `CHANGELOG.md`.

## Tasks & Acceptance

**Execution:**
- [x] The tokens chosen by the contrast numbers; the stylesheet, the marker tokens and the unit test.
- [x] The contrast library and its unit test; the two misses fixed (comms lost to magenta, the line halo).
- [x] The showcase review states (tags, seed, buttons), the dark page, the site card view.
- [x] `review.spec.mjs`: both themes, the check, the renders; the showcase, line popup and styles specs green beside it.
- [x] The review pack page and the docs; the plan.
- [x] The whole chain green in one final run on a fresh stack; the referenced screenshots committed; this plan's Results.

**Acceptance Criteria:**
- Given the showcase page in each theme, when the check reads every token, then every state mark is 3:1 or better against the blank map, the panel and (for the marks that meet it) the light raster sample, and `docs/review-er27-contrast-<theme>.md` holds the table.
- Given `docs/review-er27.md`, then every item the ticket names is rendered in light and dark side by side from the dev stack with what changed against the template's rules and an empty verdict line.
- Given `grep -rn "#[0-9a-fA-F]\{6\}" web/typescript/mapstudio.css web/typescript/*.ts`, then no colour literal is in the module's styles or drawing code.
- Given the full suite on a fresh stack, then every test passes; `./gradlew clean build`, tsc, Jest, the e2e unit tests and the contract checks pass.
- Given `git diff 40bbfee -- common/src/main/resources docs/contract.md`'s version lines, then the contract is still 0.3.0 with no message type, field, error code, prop or schema added or removed.

## Implementation Notes

- **Commits on the worktree branch** (`worktree-agent-a230fcddd835c9659`, baseline `40bbfee`): 353bbf9 (the tokens, the line halo, the contrast library and test, the review tags), 6022fc7 (the review states, the dark page, the site card, the review spec, the pack draft), ac58ede (the halo under the selection casing, the docs), then the closing commit (the renders, the contrast tables, the platform checks, this plan).
- **The numbers that chose the tokens** (Perspective 8.3.10's bundled themes, read live): see docs/review-er27.md section 2. Purple-60 on the dark map 2.81 (the one miss among the stand-ins on the blank map and the panel); the dark theme's lines on the raster sample 2.25 to 2.93 (fixed by the halo).
- **A first render round** showed the halo as a light ring between the selected line's casing and the line (the halo sat over the casing); the halo moved under the casing, so the selected look of entry 2 is unchanged.
- **Theme switch race:** on the first load of `/dark` the view's startup script switches the session theme while the map is being built; once in three runs the draw tool read `--label` and `--neutral-20` empty during the stylesheet swap and warned that it keeps its library default. The pack renders the reload (which starts dark), and the spec drops the switching load's warnings. A Perspective component that reads tokens at creation sees the same race on any runtime theme switch; the production pages never switch at startup.
- **Results:** see docs/platform-checks.md, "Epic 3 entry 12", for the final chain's numbers.

## Plan Change Log

## Review Triage Log

Review pass 1 (quick lens, read by this agent from the diff against the baseline before the final chain; no subagent tool in this session): 0 high, 1 medium, 2 low, 0 false.

| Finding | Verdict | Route | Evidence |
| --- | --- | --- | --- |
| The dashed halo's dash phase is the line's only where MapLibre starts both patterns at the same vertex; a dashed halo could show as a solid light line under dashes if the phases drifted | medium | accepted, checked | the rendered stale segments (review-light-line-stale-1366.png, dark) show dashes with their halo under them and no solid light line; both layers draw the same geometry from the same source |
| `review_states` acknowledges with the fixed user name `mapstudio-dev`, as the dev `/live` acknowledgement does | low | accepted | dev test equipment on the disposable stack; the audit of a real Gateway is never touched |
| The magenta comms-lost token is nearer red than purple for a protanope | low | recorded for the review | docs/review-er27.md section 1 names purple as the host-theme alternative that passes (purple-70 light, purple-50 dark) |

## Design Notes

The pack page is `docs/review-er27.md`: sections 1 (the tokens, with the host-theme mapping), 2 (the contrast check, its method, the two fixes, the generated tables), 3 (eight items rendered light and dark side by side, each with what changed against the template's `docs/ux.md` ER-27 and `docs/map.md` section 5 and a verdict line) and 4 (how the owner records the review).

**What the owner must review (hitl), and where:**

1. `docs/review-er27.md` section 1: the tokens, above all `--mapstudio-comms-lost` on magenta (decision 1) and the presets sharing the alarm hues (decision 2), the tints 4 and 5 in the blue and bronze families (decision 3).
2. Section 3.1: the alarm badge as the bare glyph on a halo (entry 15), the hollow glyph for acknowledged, comms lost in colour, stale with none, no blink and no fade.
3. Sections 3.2 to 3.7: the Needs you counts and ranking, the legend's key, the presets and tints, instrument alarms and the per-segment look with the new line halo, the point card's alarm block, the bottom sheets and the one top bar, the custom view's close row.
4. Section 3.8: the five listed items of the template's checklist (the kind glyph in the marker, the instrument alarm at its place, Fit and Return top-right, the Needs you bar and legend for the chip row, bottom sheets for top sheets).
5. The record: a row in `docs/platform-checks.md` under "Epic 3 entry 12" and a dated Decision in the epic's Notes; a change asked for is built before the 0.3.0 tag (entry 13).
