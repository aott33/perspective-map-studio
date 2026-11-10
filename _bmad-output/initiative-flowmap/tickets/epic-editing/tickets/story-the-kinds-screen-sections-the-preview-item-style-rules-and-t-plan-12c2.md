---
title: "12c2: the Style tab and an item's own style rule"
type: 'feature'
ticket: ''
part_of: '12'
created: '2026-11-10'
status: 'draft'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'high'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md', '{project-root}/docs/kind-setup.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The properties panel has only Details: an editor cannot see how one item is styled, reach its kind's rule from it, or give one item a rule of its own without a script (R5, R15).

**Approach:** Add the Style tab beside Details (DESIGN.md, Properties panel and tabs): the item's icon, size and label read-only, then its style rule, shown "From kind" with "Edit the kind's rule", or as the item's own rule marked Override with Reset. The rule editor built for Kinds in 12b1 is shared by both. An item's rule saves as part of the item, like 12c1's path overrides: an Undo step, listed in Recent changes with Revert.

Decisions carried (owner, 2026-11-09 and 2026-11-10): icon, size and label are read-only (editable is backlog 38); an item's override replaces the whole rule; a rule is sent as soon as it is whole, "Not saved yet" until then; each type's cases are remembered until the item is left.

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

## Open Questions

The planner's picks (first option) for the owner to confirm at the checkpoint:

1. **When Override is pressed.** (A) The copy of the kind's rule is saved at once as the item's own (it is whole), so the item is marked Override straight away and Undo takes it back. (B) Nothing is saved until the copy is changed.
2. **Size and Label rows.** Nothing stores a size or a label per item or kind. (A) Size says what sets it (a point's marker is one size; a line's width follows its diameter) and Label shows the item's name, both read-only. (B) Leave both rows out until backlog 38 makes them real.
3. **A key value the kind does not have.** The Gateway would give such an override no style at all. (A) The value select lists only the kind's key values. (B) Any key may be typed.

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
- [ ] `web/typescript/studio/RuleEditor.tsx` (new) from `KindSetupPanel.tsx`, the kind panel using it -- no change of behaviour, markup or hooks; the 12b1 and 12b2 Jest and e2e pass untouched -- T12, before anything else.
- [ ] `kindSetup.ts`, `itemOverrides.ts`, with Jest -- the full-path option, the `styleRule` row of an override, the copy of the kind's rule for an item, the labels and refusal placement for a rule, the item's "shows now" words -- T4 to T11.
- [ ] `MapStudioStoreDelegate.ts` -- the rule through `editOverride`, its refusal with its place -- T4, T5, T7, T10, T11.
- [ ] `studio/PropertiesPanel.tsx`, `MapStudio.tsx`, `mapstudio.css` -- the tab list, the Style tab, the scroll into section 6; hooks `.mapstudio-panel-tab[data-tab]`, `.mapstudio-style`, `.mapstudio-style-rule[data-own]`, `.mapstudio-style-override`, `.mapstudio-style-reset`, `.mapstudio-style-kind` -- T1 to T9.
- [ ] `e2e/tests/itemstyle.spec.mjs` (new) -- T1 to T11 at 1366 px, the seed put back; screenshots of the tab from the kind, overridden and not saved yet.
- [ ] Docs (`docs/kind-setup.md`, `docs/contract.md`, `CHANGELOG.md`) and playbook section 8o.

**Acceptance Criteria:**
- Given P12 on the dev stack, when its rule is overridden in the Style tab, then P12 alone draws by it at the next live update in every open map, and Reset returns it to the kind's rule.
- Given the shared editor, then Kinds' section 6 passes every 12b1 and 12b2 test unchanged.

## Implementation Notes

- Planner, 2026-11-10: the environment, commit and identity rules are entry 8's plan's (Docker by hand after a restart, JDK 17 by apt if gone, `ops/up.sh --fresh` before a whole-suite run, no em dashes, never a bare `git stash`, never a push). Leave the work uncommitted: the orchestrator commits after the whole suite.

## Plan Change Log

## Review Triage Log

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
