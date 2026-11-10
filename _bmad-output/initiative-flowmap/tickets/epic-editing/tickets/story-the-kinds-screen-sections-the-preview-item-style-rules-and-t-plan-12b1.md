---
title: "12b1: the Style rule editor and area tints in a kind's setup"
type: 'feature'
ticket: ''
part_of: '12'
created: '2026-11-10'
status: 'built'
baseline_revision: 'd4623b5c79c314b63ac8a2cc3241de911f63a1ef'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
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

### Pass 1 (quick lens, 2026-11-10): 9 findings - 1 high, 8 low; 7 patches, 1 rejected, 1 deferred

| # | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|
| 1 | A rule (or tints) draft that outlives the version it was built on overwrites another editor's rule with no conflict: after a send `ruleSeen` is null, `foldStored` is held off while the cursor rests in the section, and the next change or blur sends at the newest version | high | patch | Confirmed in `KindSetupPanel.tsx` `foldStored`, `editRule`, `commitRule` (and the tints' twins): `ruleSeen` is taken from `version()` at the next edit, after their save. Fix: the draft carries the setup version it was last in step with the store (made, folded, or its own save settled), and every send goes at that. |
| 2 | `commitRule` and `commitTints` ignore `send`'s answer: a save not taken leaves `ruleSent` set, and the draft is then replaced by the stored rule with no word | low | patch | Confirmed; `off()` stops most cases, a kind that left the list is the rest. Fix: as 12a's `commit`, the sent marker undone when the save is not taken. |
| 3 | Pressing the type already chosen, Add a case and Add a band clear a standing refusal though no row moved | low | patch | Confirmed: `structure = true` on all three. Fix: the same type is no change; adding a row does not clear. |
| 4 | `checkTints` refuses an empty category the Gateway accepts, and trims a choice field's fixed categories | low | patch | Confirmed against `KindSetup.java` (`text(..., false)`). Fix: an empty category is one category; a choice's rows are sent as the field has them. |
| 5 | An area kind's tile is a line sample | low | rejected | `presetSampleSvg` draws a line sample for every line geometry, as the styles preview has since epic 3: a preset changes an area's outline, which is a line. A new area sample is more than a correction; told to the owner as a departure. |
| 6 | S8's refused case row and S9's rows from a choice field are Jest only, not e2e | low | deferred | Real: the browser's check stops a bad case before the Gateway can refuse it, and the dev geofence's `operator` is a text field. Both rows have passing Jest tests; an e2e of the choice rows needs a choice field on a dev area kind (deferred-work). |
| 7 | The tints' note carries `.mapstudio-rule-unsaved` too, so the hook matches two elements; the marked inputs are not tied to the words by `aria-describedby` | low | patch | Confirmed in `renderTints`. Fix: one class each, and the inputs described by their note. |
| 8 | A typed tag path is lost when the value select leaves "A tag path" and comes back | low | patch | Confirmed: `pick('path')` gives an empty path. Fix: the typed path remembered per type until the kind is left (owner decision 3). |
| 9 | `styleRuleLine` and `.mapstudio-kindsetup-rule` have no user left | low | patch | Confirmed: only a test calls it. Fix: both removed with the test. |

Outcome (2026-11-10): seven patches applied (findings 1 to 4, 7 to 9), finding 5 rejected, finding 6 deferred (deferred-work). A flaky `events.spec.mjs` test fixed at its cause (it read the camera move's count at once; it now waits for it). The orchestrator's Verification on the final code: tsc clean, Jest 898 passed, Gradle clean build offline passed, contract check OK, `ops/up.sh --fresh` and the whole e2e suite 307 passed, 0 failed, 8 skipped (the env-gated scenarios). No Gateway, `common/` or Ignition file changed. Status built; 12b2 (the preview on the map) is next.

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
