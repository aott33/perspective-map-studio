---
title: "12c2: the Style tab and an item's own style rule"
type: 'feature'
ticket: ''
part_of: '12'
created: '2026-11-10'
status: 'built'
baseline_revision: 'f0fa1307db66d3b054c2c34464f44df54eac0504'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md', '{project-root}/docs/kind-setup.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The properties panel has only Details: an editor cannot see how one item is styled, reach its kind's rule from it, or give one item a rule of its own without a script (R5, R15).

**Approach:** Add the Style tab beside Details (DESIGN.md, Properties panel and tabs): the item's icon, size and label read-only, then its style rule, shown "From kind" with "Edit the kind's rule", or as the item's own rule marked Override with Reset. The rule editor built for Kinds in 12b1 is shared by both. An item's rule saves as part of the item, like 12c1's path overrides: an Undo step, listed in Recent changes with Revert.

Decisions carried (owner, 2026-11-09 and 2026-11-10): icon, size and label are read-only (editable is backlog 38); an item's override replaces the whole rule; a rule is sent as soon as it is whole, "Not saved yet" until then; each type's cases are remembered until the item is left.

Decisions (owner, 2026-11-10, "go with recommended, approve and continue"): (1) pressing Override saves the copy of the kind's rule at once as the item's own, so it is marked Override straight away and Undo takes it back. (2) Size says what sets it (a point's marker is one size; a line's width follows its diameter) and Label shows the item's name, both read-only. (3) The value select of an item's rule lists only the kind's key values.

## Boundaries & Constraints

**Always:** Browser only: no Gateway, `common/` or contract version change. Level full, one item selected. **Tabs:** Details and Style as a real tab list (arrow keys, one tab stop, `aria-controls`), underlined when active; the tab chosen is kept while another item is selected and across a visit to Kinds. **Read-only rows:** Icon (the kind's glyph and its name), Size and Label in words of what sets them, each saying it comes from the project's kind list and is not changed here. **Style rule, from the kind:** the "From kind" tag, the kind's rule in words with its case tiles (or that the kind has none), "Edit the kind's rule" opening Kinds at that kind with section 6 in view and the selection kept, and an Override button. **Override:** starts from a copy of the kind's rule (a path under `{asset.path}` filled for this item; an unlinked item or a kind with no rule starts empty) in the shared editor with no None type; marked with the Override tag and Reset, which removes it. Its typed path must be a full path, by 12c1's check and words; its value select lists the kind's key values only; From its instruments is offered for a line that is not an area; no resolve note. **Saving:** through 12c1's override save (the item's whole `overrides` from the newest, only `styleRule` changed, every other part untouched); a refusal's words beside the row or field they name. **Kinds unchanged:** section 6 looks and behaves as built, its hooks and classes the same, now through the shared editor. **Shows now:** one line under the rule saying what the item shows now and when its alarm wins, in the item's own words. The kind's header count and the preview note follow at once. Keyboard, 24 px targets, tokens only, no em dashes.

**Never:** Editing icon, size or label; a partial rule override (some cases from the kind); overriding tints, link or popup view; a rule worked out in the browser; the tag button (13); a save button; a toast.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| T1 Tabs | Style chosen, another item selected, Kinds visited | Style still chosen; arrow keys move between the tabs | No error expected |
| T2 From kind | A pad with no override | Icon, Size, Label read-only; the kind's rule in words with tiles, "From kind" | A kind with no rule says so |
| T3 Edit the kind's rule | The button | Kinds opens at Well pad with section 6 in view; the item still selected | No error expected |
| T4 Override | Override on P12, a band's preset changed | Saved; Override and Reset; P12 draws by its own rule at the next live update, other pads by the kind's; the kind's header counts it | No error expected |
| T5 Reset | Reset | "From kind" again; P12 draws by the kind's rule | No error expected |
| T6 Own rule stored | Point 2 (its seeded expression) | Its rule in the editor, marked Override | No error expected |
| T7 Not full | A source path under `{asset.path}` | 12c1's words beside the field | Nothing sent |
| T8 Half-built | A band without a preset | "Not saved yet" and why; the stored override or the kind's rule stands | Nothing sent |
| T9 Line | L-SWD (its instruments override) | From its instruments chosen, marked Override | No error expected |
| T10 Undo, History | After T4 | Undo names the style rule and undoes it; Recent changes lists it with Revert | No error expected |
| T11 Kept parts | A rule override on an item with path overrides | The path overrides stored unchanged | No error expected |
| T12 Kinds unchanged | The 12b1 and 12b2 specs | Pass with no change to what they expect | No error expected |

</frozen-after-approval>

## Code Map

- `web/typescript/studio/KindSetupPanel.tsx` -- the rule editor to share: state `rule` :141; fields `ruleBase` :198, `ruleKept` :201, `pathMemory` :204, `ruleSent` :206, `ruleBox` :209, `ruleCommitting` :212; `held` :920, `foldStored` :929-944, `ruleNow` :960, `editRule` :965-985, `commitRule` :991-1019, `onDraftKey` :1073, `tile` :1081, `presetSelect` :1097, `removeButton` :1110, `renderSource` :1120-1163 (the resolve note `note()` :450), `renderStates` :1165, `renderBands` :1204, `renderExpression` :1255, `renderStyleRule` :1386-1429; it leans on `send` :315, `version()` :231, `view()` :235, `off()` :308, `messages()` :419 with `drawn` and `topRefusals` :445. Tints :1291, :1025-1070 and Live now :1435 stay with the kind.
- `web/typescript/kindSetup.ts` -- pure already: `RuleDraft` :904-917, `ruleTypes` :930, `presetsFor` :940, `ruleDraft` :989, `foldRule` :1018, `checkRule` :1063 (`sourceOf` :1039: add the full-path option), `inStepVersion` :1160, `unsavedText` :1165, `sameRule` :1170, `refusalPlace` :425 (rule branches :457-468), `liveNowText` :619-653 (worded for a kind).
- `web/typescript/itemOverrides.ts` -- `isFullTagPath` :86, `pathProblem` :96, `refusalWords` :114 (`PART_PREFIX` :111 knows no rule), `applyRowEdit` :274 (comms, alarms, `kpi:` rows only), `ruleApplied` :319, `overrideLabel` :461 (appends " path"), `overrideChanges` (`OTHER_PARTS` :384 already says "style rule"), `openSetupText` :254.
- `web/typescript/MapStudioStoreDelegate.ts` -- `editOverride` :1196-1213 and `OverrideRefusal` :213-220 (a path string today), `overrideRefused` :1230-1238.
- `web/typescript/studio/PropertiesPanel.tsx` -- the one static tab :957-959; keyed by `item.id` (`MapStudio.tsx` :2244), so the tab lives in MapStudio's state as `layersTab` does (:172, :229, :1850); `componentDidUpdate` :366-371 reopens a refused row's path field (not for the rule); the header's `Glyph` :946; no `colors` or `symbols` props yet (`MapStudio.tsx` :2079-2080 has them).
- `web/typescript/MapStudio.tsx` -- `onOpenKindSetup` :1956-1963 (12c1's button `.mapstudio-livenow-setup`, `PropertiesPanel.tsx` :821); no scroll target into the Kinds panel exists; Layers' tabs :1870-1879 have no arrow keys.
- `mapstudio.css` `.mapstudio-panel-tabs` :3919; wording to reuse: `KindSetupPanel.tsx` :1509.
- Tests: `__tests__/kindSetupPanel.test.ts` asserts section 6's static markup (classes and `data-*` must not move); e2e `kindstyle.spec.mjs`, `kindpreview.spec.mjs` :288-293, :327-331, `kinds.spec.mjs` :160, `styles.spec.mjs` :139-145, `overrides.spec.mjs` (helpers `press` :36, `quiet` :47, `restore` :57-80, `openEditor`, `stored`, `apply`); seed `P2_OVERRIDES` and `SWD_LINE_OVERRIDES` (`mapstudio_seed/code.py` :183, :215), put back by `runSeed`.

## Tasks & Acceptance

**Execution:**
- [x] `web/typescript/studio/RuleEditor.tsx` (new) from `KindSetupPanel.tsx`, the kind panel using it -- no change of behaviour, markup or hooks; the 12b1 and 12b2 Jest and e2e pass untouched -- T12, before anything else.
- [x] `kindSetup.ts`, `itemOverrides.ts`, with Jest -- the full-path option, the `styleRule` row of an override, the copy of the kind's rule for an item, the labels and refusal placement for a rule, the item's "shows now" words -- T4 to T11.
- [x] `MapStudioStoreDelegate.ts` -- the rule through `editOverride`, its refusal with its place -- T4, T5, T7, T10, T11.
- [x] `studio/PropertiesPanel.tsx`, `MapStudio.tsx`, `mapstudio.css` -- the tab list, the Style tab, the scroll into section 6; hooks `.mapstudio-panel-tab[data-tab]`, `.mapstudio-style`, `.mapstudio-style-rule[data-own]`, `.mapstudio-style-override`, `.mapstudio-style-reset`, `.mapstudio-style-kind` -- T1 to T9.
- [x] `e2e/tests/itemstyle.spec.mjs` (new) -- T1 to T11 at 1366 px, the seed put back; screenshots of the tab from the kind, overridden and not saved yet.
- [x] Docs (`docs/kind-setup.md`, `docs/contract.md`, `CHANGELOG.md`) and playbook section 8o.

**Acceptance Criteria:**
- Given P12 on the dev stack, when its rule is overridden in the Style tab, then P12 alone draws by it at the next live update in every open map, and Reset returns it to the kind's rule.
- Given the shared editor, then Kinds' section 6 passes every 12b1 and 12b2 test unchanged.

## Implementation Notes

- Planner, 2026-11-10: the environment, commit and identity rules are entry 8's plan's (Docker by hand after a restart, JDK 17 by apt if gone, `ops/up.sh --fresh` before a whole-suite run, no em dashes, never a bare `git stash`, never a push). Leave the work uncommitted: the orchestrator commits after the whole suite.
- Builder, 2026-11-10: built as planned, uncommitted. Picks made where the plan left room, each for the owner's eye:
  - **The shared editor owns the draft and is handed how to save** (`studio/RuleEditor.tsx`): the kind panel gives it the one-part save at the version the draft is in step with, the item's panel the item's override save. Section 6's own element (its heading, the tints, the Live now note) stays the kind panel's, drawn around the editor, so its markup, classes and hooks are as built; the 12a, 12b1 and 12b2 Jest and e2e pass with no change to them.
  - **Both tab panels stay mounted while the item is selected**, the one not chosen hidden, so a rule being built is kept across the tabs "until the item is left". The Style panel is `.mapstudio-style`, not a second `.mapstudio-panel-body`, so every existing spec's Details selectors still match one element.
  - **An item just placed shows Details** until a tab is chosen: its panel opens with the cursor in Name (owner, 2026-11-04), which is Details'. The remembered tab is not changed by it.
  - **"An unlinked item starts empty" is read literally**: an item with no asset starts empty whatever the kind's rule reads (a key value too); a linked item whose asset is not in the asset list starts empty only when the kind's rule reads a path under `{asset.path}`, which cannot be filled then.
  - **An empty start** opens the editor on States with no value and no case ("Not saved yet. Pick the value the rule reads. Add a case."), no tag beside the label until it is stored, and **Keep the kind's rule** to give it up (not in the plan's hooks: `.mapstudio-style-keep`).
  - **The value select** lists the kind's key values and "A tag path" (decision 3 read with Boundaries' "its typed path must be a full path"); a path that is not full shows 12c1's words under the field and "Not saved yet. The tag path is not a full path." in the note.
  - **Esc in a typed field of the rule stays in the field** (the panel is not closed under a draft); Esc anywhere else in the tab closes the panel as ever.
  - **Edit the kind's rule** scrolls section 6 into view and puts the focus on its chosen rule type.
  - **The kind's rule in words**: "States on the tag {asset.path}/Status", then per case its tile, "When the value is 1" and the preset's name; Bands read "Below 50", "From 50 up to 200", "From 200 up"; an expression shows its text and the presets it names.
  - **Size and Label**: "One size: every point's marker is the same size.", "Its width follows its diameter; a line with no diameter draws thin.", "One outline: an area has no size of its own."; Label is the item's name. Each row says it comes from the project's kind list and is not changed here, as Boundaries ask.
  - **Shows now**: "Shows now: Point 1 is Fault by its own rule. An alarm wins over the rule; a stale value shows only as Stale." ("by the well pad rule" from the kind; "..., but its priority 1 alarm wins over the rule." with an alarm).
  - **A fourth render**, the read-only rows, beside the three the plan names (the panel is too short at 1366 by 768 to show the rows and the rule at once).
  - **Not done:** as 12c1, a replayed or applied-on-top override's Undo step reads "edit <name>".
- Builder, 2026-11-10, verified: `cd web && npx tsc --noEmit && npx jest`: clean, 987 tests in 75 suites (954 in 74 before). `./gradlew clean build --offline --rerun-tasks` on JDK 17: BUILD SUCCESSFUL. `bash scripts/ci/check-contract-versions.sh`: OK at 0.4.0. `ops/up.sh --fresh`, then the whole e2e suite: 313 passed, 8 skipped (the opt-in ones), 0 failed in 1.1 h, `itemstyle.spec.mjs` 2 of 2 and `kinds`, `kindstyle`, `kindpreview` and `overrides` untouched and green. The four renders are in `docs/screenshots/mapstudio-itemstyle-*-1366.png` for the owner's look against DESIGN.md's Properties panel prose (the plan's manual check, still open).
- Builder, 2026-11-10, after review: an own rule's draft carries the item version it was last in step with the stored rule (the base follows the item's version while the stored rule is unchanged) and its save goes at that version, so a rule another editor stored meanwhile is a conflict with the ordinary card (`itemstyle.spec.mjs`, the two-editors case; the delegate's Jest); the Gateway's "overrides.styleRule.expression: ..." is placed beside the expression; a refusal is recorded before its batch is let go; a just-placed item no longer changes the remembered tab; "Shows now" for a kind with no rule says the map draws no rule meanwhile; the editor is told when a save was not taken. Covering Jest suites and `itemstyle.spec.mjs` (3 of 3) pass; the whole suite was not rerun by the builder.

## Plan Change Log

## Review Triage Log

### Pass 1 (quick lens and the builder's own report, 2026-11-10): 9 findings - 1 high, 2 medium, 6 low; 7 patches, 1 rejected, 1 to the owner

| # | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|
| 0 | (the builder's report) An own rule finished after another editor changed the item's rule is sent at the item's newest version and replaces theirs with no conflict | high | patch | The same loss 12b1's finding 1 closed for a kind's rule; the Design Notes did not mean a draft may outlive the version it was built on. Fix: the own rule's draft carries the item version it was last in step with, and its save goes at that version, so the ordinary conflict card answers. |
| 1 | An unreadable expression in an own rule is not placed beside the expression field: the Gateway words it "overrides.styleRule.expression: ...", and `refusalRest` strips only "overrides: " | medium | patch | Confirmed against `WriteService.checkExpression(..., "overrides.styleRule")` and `WriteServiceKindCheckTest.java:90`; the Jest case used a form the Gateway never sends. Fix: both forms placed, the test on the real words. |
| 2 | `overrideRefused` discards the batch (which notifies) before it records the refusal, so the panel can see the own rule gone with no refusal and close the editor | low | patch | The order is as described; whether a render falls between is not settled by reading, and recording first costs nothing. |
| 3 | Placing an item writes Details into the one remembered tab, so Style is lost for every later selection | low | patch | Confirmed in `focusName`. Fix: a just-placed item shows Details without changing the remembered tab. |
| 4 | "Shows now" contradicts itself for a kind with no rule while an own rule is half built | low | patch | Confirmed in `showsNowText`: the suffix is chosen from `own` alone. |
| 5 | The Style tab's `onSend` always answers true, so a save that was not taken leaves the editor waiting for good | medium | patch | Confirmed: `onStyleRule` drops `editOverride`'s answer. Fix: the real answer passed back. |
| 6 | Kinds' count of the rule fields drawn can lag the shared editor's draft by one render, so a case refusal may show at the top and beside its row, or in neither, until the next render | low | rejected | Real in principle, but it lasts one render in a case that needs a refusal and a change of the rule's shape together; closing it means the editor reporting what it drew, more than a correction. |
| 7 | A doc comment now sits on the wrong field in `MapStudio.tsx` | low | patch | Confirmed. |
| 8 | Override on an unlinked item starts empty even when the kind's rule needs no asset (its instruments, a key value, a full path) | low | to the owner | The frozen text says "an unlinked item ... starts empty"; decision 1 says the copy saves at once. Asked of the owner; as built until answered. |

Outcome (2026-11-11): seven patches applied (findings 0 to 5 and 7), finding 6 rejected, finding 8 with the owner and as built until answered (an unlinked item's Override starts empty). The orchestrator's Verification on the final code: tsc clean, Jest 989 passed, Gradle clean build offline passed, contract check OK, `ops/up.sh --fresh` and the whole e2e suite 314 passed, 0 failed, 8 skipped (the env-gated scenarios); no existing Jest or e2e file changed, so Kinds' section 6 passes every 12b1 and 12b2 test as it was (T12). No Gateway, `common/` or Ignition file changed. Status built; entry 12 (12a, 12b1, 12b2, 12c1, 12c2) is built.

## Design Notes

The kind's rule meets another editor's save through `ruleBase` and the kind's version; an item's rule meets it through the item's own version and the ordinary conflict card. The shared editor therefore owns the draft and the rows, and is handed how to save.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK
- `ops/up.sh --fresh`, then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: 0 failed

**Manual checks (if no CLI):**
- There is no Style tab mock: the tab's screenshots go to the owner against DESIGN.md's Properties panel prose before it is final.
