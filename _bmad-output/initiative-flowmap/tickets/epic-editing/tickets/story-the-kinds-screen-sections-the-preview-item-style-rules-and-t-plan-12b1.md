---
title: "12b1: the Style rule editor and area tints in a kind's setup"
type: 'feature'
ticket: ''
part_of: '12'
created: '2026-11-10'
status: 'ready-for-dev'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'high'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md', '{project-root}/docs/kind-setup.md', '{project-root}/docs/styles.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Section 6 of a kind's setup shows the stored style rule as one read-only line, and area tints not at all: a rule or a tint still needs a script (R15).

**Approach:** Make section 6 the Style rule editor of DESIGN.md's Kind setup and key screen 6 (kinds-style): the type (None, States, Bands, Expression and, for a line kind that is not an area, From its instruments), the value it reads (a key value or a typed tag path), and one row per case with its preset select and a 64 px preview tile; under it, for an area kind, the category tints. It saves through 12a's save path as the `styleRule` and `areaTints` parts.

Decisions (owner, 2026-11-10, "go with recommended", then "approve and continue" on the plan and its smaller picks): 12b is split: this plan is the editor, 12b2 is the preview on the map (the TypeScript port of the rule, the Preview word, the note box). (2) A rule is saved as soon as the whole rule is valid in shape; until then the section says "Not saved yet" and what is missing, and nothing is sent. (3) The panel remembers each type's cases until the kind is left, so switching the type back restores them. (4) An area kind's tint rows are the choices of a choice field; for a text field the categories are typed. (5) "Apply mine on top" stays hidden for a kind setup's conflict. Rider (owner, 2026-11-10): a refused Revert's conflict card also offers only "Use <name>'s version".

## Boundaries & Constraints

**Always:** Browser only: no Gateway, `common/` or contract version change. 12a's rules hold (one save per kind in flight, the whole setup sent with only the edited part changed, no Undo step, refusals beside their field without the "Op N (id): where:" prefix, placed by the order sent, a typed field never overwritten by another editor's change). **Type:** a segmented choice in the panel tabs' look; None removes the rule. **Value** (States, Bands; optional for Expression): a select of the kind's key values, switched-off ones too, and "A tag path" with a typed path and 12a's resolve note. **States:** rows "When <value> is" a value (text, a number, true or false as typed), a preset select, a tile; Add a case; a delete icon. **Bands:** rows from and to (empty for an open end, only the first open below and only the last open above), preset, tile, in order. **Expression:** one multi-line field saved on blur, the hint that `{value}` is the one reference and the result is a preset name, and the Gateway's reason beside it when refused. **From its instruments:** no value or cases, one line saying each segment takes the worst of the instruments at its ends. **Presets:** the closed list for the kind (line presets too for a line kind), by name, never a colour. **Tiles:** the kind's icon (or line or area sample) in that case's preset with the state word, from `StylePreview`'s exports. **Not saved yet:** a row without a preset, a duplicate States value, a band whose from is not below its to or that overlaps, a missing value, no cases: said in words under the rows. **Area tints** (area kinds only, under the rule): the property select (the kind's form fields), rows of category and a tint select with its swatch; emptying the property removes the part. The key value a saved rule reads carries "Used by style rule". Keyboard throughout; 24 px targets; tokens only; no em dashes.

**Never:** The map preview, the Preview word, the note box, a TypeScript port of the rule (12b2); the Style tab and overrides (12c); the tag button (13); a colour code or free colour anywhere; a save button; a new preset.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| S1 Bands | Well pad: Bands on Pressure, two bands with presets | Saved once valid; the pads draw by it within one refresh interval | No error expected |
| S2 States | States on a typed tag path, cases 1 to 4 | Saved; each row's tile shows its preset and word | A duplicate value: "Not saved yet" naming it, nothing sent |
| S3 Half-built | A band with no preset; from 900, to 600 | "Not saved yet" with the reason; the stored rule stands | Nothing sent |
| S4 Expression | `if({value} > 600, 'warning', 'normal')`; then `if(` | The first saved; the second refused | The Gateway's reason beside the field |
| S5 Instruments | Gathering line: From its instruments | Saved as the instruments source; the choice absent for a point or area kind | No error expected |
| S6 None | A kind with a rule, None chosen | The rule removed; "Used by style rule" gone | No error expected |
| S7 Type switch | Bands with two bands, to States, back to Bands | The two bands are back | Lost only when the kind is left |
| S8 Row refusal | A case the Gateway refuses | Its words beside that row | The stored rule stands |
| S9 Tints | Geofence: property operator, North tint-1, South tint-4 | Rows are the field's choices; saved; the areas draw | Absent for a kind that is not an area |
| S10 Kept parts | Each rule and tint edit on each seed setup | Every other part stored unchanged | No error expected |
| S11 Revert refused | A Revert refused as changed since, then a reload | The card offers only "Use <name>'s version", before and after the reload | Nothing saved |

</frozen-after-approval>

## Code Map

- `web/typescript/kindSetup.ts` -- `SetupEdit` :109-125 and `applyEdit` :174-270 (add `styleRule` and `areaTints` edits replacing or removing the whole key), `SetupView.styleRule` :65, :101 (untyped; `areaTints` unread), `refusalPlace` :389-424 (`styleRule...` lands on the section with its prefix kept, `areaTints...` unplaced: place `cases[i]` and `tints[i]` by sent index as `kpis[i]` :392), `ruleKpi`/`removeBlocked` :622-630, `styleRuleLine` :636.
- `web/typescript/studio/KindSetupPanel.tsx` -- section 6 :969-976 (the read-only line and hint to replace), drafts and `seen` :101, :276-283, `commit` :289, `choose` :341, `send` :255, `settle` :202, `messages` :359, the Used tag :666, Remove :702-708, the test hooks' list :43-48, the resolve note of a path field.
- `web/typescript/StylePreview.tsx` -- `PresetPalette`, `TintPalette`, `presetSampleSvg`, `caseWords`, `sourceWords`, props :23-31; used today by `MapStudio.tsx` :1791-1817 (needs `markerColors` and the sprite symbols passed to the panel).
- `web/typescript/live.ts` -- the preset and tint lists :36-42, `RuleDisplay`, `AreaTints` :138-159.
- Java, read only: `KindSetup.java` rule and tint checks (`styleRule.cases[i].value|min|max|preset`, `styleRule.source...`, `styleRule.expression`, `areaTints.property`, `areaTints.tints[i].category|tint`), `StylePresets.java` :34-55, `StyleRule.java` (States compare a number with a number, text exactly; 1 and "1" are distinct cases).
- Revert rider: `MapStudioStoreDelegate.ts` `revert` :1844-1868 (the label lives only in `pendingSteps` :858), `unsaved.ts` `UnsavedEntry` :57-74 (add a persisted marker), `isSetupSave` :883, `onTopBatch` :848, `saveCardFor` :966-974, `unsavedSender.ts` `enqueueAndSend` :51, `studio/SaveCard.tsx` :94-127 (`data-on-top`); e2e `recentchanges.spec.mjs` :174 (B5).
- Tests: `__tests__/kindSetup.test.ts` (the pass-through block; :417-430 asserts the read-only line and changes), `kindSetupPanel.test.ts` :112-120, :169, `stylePreview.test.ts`; e2e `kinds.spec.mjs` helpers (`restore` :49, `setupOf` :70, `openKinds`, `chooseKind`, `field`, `section`, `liveItem` :103-107, `settled`); the seed's rules in `mapstudio_seed/code.py` :154-215 (changing the line kind's rule alters what `styles.spec.mjs` and `instruments.spec.mjs` expect: restore the seed).

## Tasks & Acceptance

**Execution:**
- [ ] `web/typescript/kindSetup.ts`, with its Jest, before the panel -- typed rule and tints, the two edits, the shape check with its words ("Not saved yet"), bands and values from typed text, the refusal placement for cases and tints -- S1 to S10.
- [ ] `web/typescript/studio/KindSetupPanel.tsx`, `MapStudio.tsx`, `mapstudio.css` -- the editor, the tiles, the per-type memory, the tints; test hooks `[data-section="styleRule"]`, `.mapstudio-rule-type[data-type]`, `.mapstudio-rule-case[data-index]`, `.mapstudio-rule-tile[data-preset]`, `.mapstudio-rule-unsaved`, `.mapstudio-tint-row[data-category]` -- S1 to S9.
- [ ] `unsaved.ts`, `unsavedSender.ts`, `MapStudioStoreDelegate.ts`, `studio/SaveCard.tsx` -- the Revert marker kept with the entry, its card with one choice -- S11.
- [ ] Jest -- every matrix row's logic; the pass-through over the five seed setups extended to the two new edits.
- [ ] `e2e/tests/kindstyle.spec.mjs` (new) -- S1 to S9 at 1366 px, the seed restored after; screenshots of each type and the tints; `recentchanges.spec.mjs` B5 for S11.
- [ ] `docs/kind-setup.md`, `docs/styles.md`, `docs/contract.md` (test hooks), `CHANGELOG.md`, `docs/test-playbook-0.4.0.md` section 8l.

**Acceptance Criteria:**
- Given the dev stack, when a Bands rule on Pressure is built in Kinds, then nothing is sent until it is whole, and once saved every pad draws by it within one refresh interval with no reload.
- Given any rule or tint save, then the setup's other parts are stored as they were.

## Implementation Notes

- Planner, 2026-11-10: the environment, commit and identity rules are entry 8's plan's (Docker by hand after a restart, JDK 17 by apt if gone, `ops/up.sh --fresh` before a whole-suite run, the session's trailers, `git commit --only`, no em dashes, never a bare `git stash`, never a push). The departures from key screen 6 the owner accepted in 12a stay.

## Plan Change Log

## Review Triage Log

## Design Notes

A rule is one part and is sent whole, so the editor keeps one draft rule per kind and sends it only when the shape check passes; the per-row fields are views of that draft, not saves of their own.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK
- `ops/up.sh --fresh`, then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: 0 failed

**Manual checks (if no CLI):**
- The section's screenshots against DESIGN.md's Kind setup and key screen 6 (kinds-style); any departure goes to the owner before it is final.
