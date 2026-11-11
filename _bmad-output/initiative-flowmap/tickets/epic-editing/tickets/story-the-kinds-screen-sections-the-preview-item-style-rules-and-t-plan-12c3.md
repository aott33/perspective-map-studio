---
title: "12c3: the Style tab reordered, its words made plain and its flow mended"
type: 'feature'
ticket: ''
part_of: '12'
created: '2026-11-11'
status: 'built'
baseline_revision: '29dc516f7775709f127c0d724a49c0c8920e4f47'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Three reviews of 12c2's Style tab (clarity, minimalism, flow; owner's request, 2026-11-11) agree it is upside down: it opens on three read-only rows repeating one sentence while the rule and what the item shows now sit below the fold, what Override and "Edit the kind's rule" do is said only in hover text, and six faults lose a half-built rule or the keyboard's place.

**Approach:** Reorder the tab around the rule, say in view what each action does, and mend the six faults. The rule editor is shared, so its row look and preset words change in Kinds too.

Decisions (owner, 2026-11-11, "go with recommended, approve and continue"): the layout below; (1) the read-only rows become one compact "From kind" line of icon and size at the foot, the Label row dropped until backlog 38; (2) preset selects use the tiles' words ("Out of service", "Attention"), in Kinds too, what is stored unchanged; (3) case and band rows lose their card border and are parted by a divider, in Kinds too; built first, its screenshots sent after; 12c2's ruling on an unlinked item's Override is built here (it starts empty only when the kind's rule reads a path under `{asset.path}`).

## Boundaries & Constraints

**Always:** Browser only; nothing stored or sent changes shape. **Order, top to bottom:** (1) the Style rule heading with its tag: "From kind", or Override with Reset; (2) "Live now", one line: "<name> is <state word>, by the <kind> rule." or "by its own rule."; the alarm, Stale and Comms lost words only when they are true; (3) the rule: from the kind, its sentence with a path under `{asset.path}` filled for this item and one line per case (the tile and its words, no code name), or the editor; (4) the actions: Override as the one bordered button and "Edit the kind's rule" as a text link, with one visible line: "Override gives <name> its own copy, saved at once. Edit the kind's rule changes every <kind>."; while overridden, "For <name> only. Changes save as you make them." and a link to the kind's rule; (5) a divider, then "From kind": the icon and the size in one line with one hint. **Not saved yet:** one note box in the warning tint with its 3 px warning edge, the reason first, then "The map keeps the saved rule until then."; "complete", never "whole"; no second box. **Kinds:** opened from an item's link it shows "Back to <name>", which returns to the item with the Style tab chosen. **Flow:** a half-built own rule is kept per item for the session, so selecting another item, opening Kinds or changing tab and coming back finds it as left, still "Not saved yet"; Esc inside the rule never closes the panel while a rule is not saved; Enter in a rule field commits and keeps the focus there; removing a row moves the focus to the row before it, or to Add; after Override the focus is on the rule's chosen type, never on Reset; an Undo that changes the stored rule shows in the editor wherever the focus is, unless a save is on its way; each status note is one node that stays mounted, only its words changing, and the rule's section is described by its tag. **Shared editor:** preset selects show the tiles' words; rows are parted by a divider with "When the value is" once above the States rows; the type choice keeps only its active underline; spacing and type sizes from DESIGN.md's tokens. Every 12b1, 12b2, 12c1 and 12c2 behaviour not named here stays; specs change only where they assert a word or a place changed here. Keyboard, 24 px targets, tokens only, no em dashes.

**Never:** Marking the case the live value falls in (it needs the rule worked out in the browser, dropped in 12b2); a save button, a confirmation dialog or a toast; a "Saved" word in the tab (the header says it); editing icon, size or label; any Gateway change.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| U1 Order | Style on a pad at 1366 by 768 | The heading, Live now, the rule's sentence and the actions show without scrolling; From kind is last | No error expected |
| U2 Words | From kind; overridden | The action line; the own-rule line and the link to the kind's rule | No error expected |
| U3 Live now | Normal; an active alarm; Comms lost | One line; the alarm clause or the Comms lost words only then | No error expected |
| U4 Draft kept | A half-built own rule, then another item, Kinds, back | The draft as left, "Not saved yet" | Nothing sent meanwhile |
| U5 Esc | Esc on a rule button while not saved | The panel stays, the draft stays | No error expected |
| U6 Enter, remove | Enter in a band's field; the last band removed | Focus stays in the field; focus on the row before or on Add | No error expected |
| U7 After Override | Override by keyboard, Enter again | Focus on the chosen type; the override stands | No error expected |
| U8 Undo | Ctrl+Z with the focus on a rule button | The editor shows the rule as it now is stored | No error expected |
| U9 Back | "Edit the kind's rule", then "Back to Point 1" | Kinds at the kind; then the item with Style chosen | No error expected |
| U10 Unlinked | Override on an unlinked line whose kind's rule is From its instruments; on an unlinked pad whose kind reads `{asset.path}/Status` | Saved at once; starts empty | No error expected |
| U11 Kinds | A kind's section 6 | Rows parted by dividers, selects in the tiles' words, saves as before | No error expected |

</frozen-after-approval>

## Code Map

- `web/typescript/studio/PropertiesPanel.tsx` -- `renderStyle` and `styleRow` (the three rows, :1104-1113 before this work), the From-kind and own branches, `onStyleKey` (stops Esc for fields only), `componentDidUpdate` (focus to `.mapstudio-style-reset, .mapstudio-style-keep` after Override), `state.ruleStart`, the `placed` flag, the tab list (correct: leave).
- `web/typescript/studio/RuleEditor.tsx` -- `state.rule` (the draft, lost on unmount), `onDraftKey` (blurs on Enter), `removeButton`, `foldStored` (skips while `focusIn()`), the conditional `.mapstudio-rule-unsaved` status, `presetSelect`, the case rows (`.mapstudio-rule-case`), the type buttons (`.mapstudio-rule-types`); used by `KindSetupPanel.tsx` `renderStyleRule` and its Live now note.
- `web/typescript/MapStudio.tsx` -- `renderPanel` (keyed by `item.id`; Kinds replaces it, :2488 before this work), `onOpenKindSetup`, `kindSectionWanted` (the scroll into section 6), `panelTab` state, `onStyleRule`; `selection.tsx` `onRootKeyDown` (Esc clears the selection unless `defaultPrevented`).
- `web/typescript/kindSetup.ts` -- `ruleWords`, `showsNowText`, `ownRuleStart` (the unlinked test before the rule's type is read), `unsavedText`, `liveNowText` (Kinds' note says "whole" too); `markers.ts` `PRESET_WORDS` :65-68 (the tiles' words).
- `web/typescript/mapstudio.css` -- `.mapstudio-style*`, `.mapstudio-rule-case`, `.mapstudio-rule-types`, `.mapstudio-rule-word` (10 px), the note box and the warning tint tokens, `.mapstudio-override-reset` (the link look), `.mapstudio-field` border-bottom beside `.mapstudio-style-rule` border-top (two dividers).
- 12c1's `refocusRow` in `PropertiesPanel.tsx` is the model for Enter keeping the focus.
- Tests that assert what changes: `__tests__/itemStyle.test.ts`, `kindSetupPanel.test.ts`, `kindSetup.test.ts` (the words), e2e `itemstyle.spec.mjs`, `kindstyle.spec.mjs` (preset selects by value stay; any by visible word change), `kindpreview.spec.mjs` (the note's "whole").
- Docs: `docs/contract.md` (the Style tab, hooks), `docs/kind-setup.md`, `CHANGELOG.md`, playbook 8l, 8m, 8o where the words changed.

## Tasks & Acceptance

**Execution:**
- [x] `kindSetup.ts`, with Jest -- the Live now line, the action and own-rule lines, "complete", `ownRuleStart` by what the kind's rule needs -- U2, U3, U10.
- [x] `studio/RuleEditor.tsx`, `mapstudio.css`, `KindSetupPanel.tsx` -- rows by dividers, the tiles' words in selects, the one mounted status node, Enter and remove focus, the fold on a stored change -- U6, U8, U11.
- [x] `studio/PropertiesPanel.tsx`, `MapStudio.tsx` -- the order, the draft kept per item, Esc, the focus after Override, the link to the kind's rule and "Back to <name>" -- U1, U2, U4, U5, U7, U9.
- [x] Jest and e2e -- every matrix row; `itemstyle.spec.mjs` extended, the changed words in the other specs; screenshots of each state again (`docs/screenshots/mapstudio-itemstyle-*`, `mapstudio-kindstyle-*` where the rows changed).
- [x] Docs and the playbook sections.

**Acceptance Criteria:**
- Given the Style tab at 1366 by 768, when it opens on a pad, then what the pad shows now and how to change its rule are in view without scrolling.
- Given a half-built own rule, when the editor goes to another item or to Kinds and comes back, then the rule is as it was left and nothing was sent.

## Implementation Notes

- Planner, 2026-11-11: the environment and identity rules are entry 8's plan's (Docker by hand after a restart, JDK 17, `ops/up.sh --fresh` before a whole-suite run, no em dashes, never a bare `git stash`, never a push). Leave the work uncommitted: the orchestrator commits after the whole suite. The reviewers' full reports are summarised in this session; the six faults are the Flow rules above.

- Implementer, 2026-11-11, choices made where the frozen text left room (each is the owner's to overrule):
  - The link to the kind's rule reads "Open the kind's rule" while overridden ("Edit the kind's rule" from the kind). When Override would start empty (a kind with no rule, or a path under `{asset.path}` that cannot be filled) the action line reads "Override gives <name> its own rule, saved once it is complete. ..." since "saved at once" would not be true.
  - "Not saved yet" keeps its opening words, then the reason, then "The map keeps the saved rule until then." (the Style tab only; Kinds keeps its own Live now note, "whole" there now "complete"). The warning-tint box is the rule editor's, so it shows in Kinds too; the tints' own note box is left as it was.
  - From kind's size is said short ("One size", "Width by diameter", "One outline") to fit one line. A case line is the tile, the case's words and the preset's word beside it (the tile's own word left out there, so it is said once).
  - "Back to <name>" shows for Details' "Open <kind>'s setup" too, returning to the tab it was left from; from the rule's links it returns to Style. The focus goes back to the link.
  - The draft is kept in the component's memory (the page's session), only while it says "Not saved yet"; "Keep the kind's rule" and Reset forget it.
  - Undo: only an Undo or Redo of this item (known by its batch), and a save of the draft that was given up (the conflict card's "Use <name>'s version", never while the card still stands), show the stored rule with the cursor in the rule. Another editor's save still waits for the cursor to leave: 12b1's two-editors spec asserts exactly that. Keystrokes not yet finished in a field are never replaced.
  - "Not saved" also covers a complete rule that is not stored with no save on its way (refused, its conflict waiting, not taken): Esc stays, and it is kept per item, saying "Change the rule to try again." on return.
  - After review: DESIGN.md and EXPERIENCE.md now say the approved layout, each change dated "(owner, 2026-11-11)". The whole-suite failure was the delegate dropping the Undo step when another tab of the same browser replayed the batch first (`MapStudioStoreDelegate.ts` `onSave`): the step is now made from the batch this page sent.

## Plan Change Log

## Review Triage Log

### Pass 1 (quick lens, 2026-11-11): 10 findings - 3 medium, 5 low, 2 rejected; 8 patches

| # | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|
| 1 | The whole-suite failure (Override saved, Undo read "Nothing to undo"): a second tab of the same browser replays the batch it learned from storage while the first tab's send is in flight; its reply removes the queue entry, so the first tab's `onSaved` finds no entry and `settleUndo` drops the pending step | medium | patch | The path reads true in `unsavedSender.ts` `onSaved` (:138-148) and `settleUndo` (the `if (batch)` skip); the spec opens `/live` in the same context. It predates this entry (entry 10's second tab), but it loses a user's Undo step and fails the suite, and the fix is a correction: the step is pushed from the batch this page sent, kept in memory, when the queue no longer holds it. |
| 2 | A conflict's reply folds the other editor's rule into the editor under the cursor while the card still offers "Apply mine on top"; pressing it then leaves the editor showing their rule over mine | medium | patch | Confirmed in `foldStored`: `dropped` is true once the flight is released, `refused` covers only a refusal. Fix: no fold while the item's conflict stands; the fold comes with the card's choice. |
| 3 | "By Undo" is any item's Undo plus a 1.5 s window, so another editor's save arriving then is folded under the cursor | medium | patch | Confirmed (`undoing={delegate.undo.pending !== null}`, `UNDO_MS`). Fix: only an Undo or Redo of this item, known by its own batch, no clock. |
| 4 | Esc closes the panel over a complete rule that is not saved (refused, or not taken) and the draft is gone | low | patch | Confirmed: `keep()` answers only for an incomplete draft. Fix: not saved covers the refused and the not-taken rule, for Esc and for the kept draft. |
| 5 | `styleLinkWanted` never expires, so a later update can move the focus to a Style link of any item | low | patch | Confirmed in `onKindsBack` and `showStyleLink`. Fix: the same 3 s limit `styleFocus` has. |
| 6 | "Back to <name>" after Details' link returns no focus | low | patch | Confirmed (`back.tab === 'style'` only). Fix: the focus goes back to the link it came from. |
| 7 | The "When <value> is" label's id is referenced by nothing | low | patch | Confirmed in `renderStates`. Fix: each row's value is labelled by it. |
| 8 | An expression's named-preset tiles still print the code name beside the tile's word | low | rejected | The code name is what the expression must return, so it is the one place the name has to be shown; decision 2 names the selects. |
| 9 | `settledNow` can be judged a render late against a newer send | low | rejected | The reviewer found no visible fault: `held` covers the next flight and the next settle recomputes it. |
| 10 | DESIGN.md and EXPERIENCE.md still describe 12c2's tab and the bordered rows | low | patch | They are the context the next entries read. Fix: both say the layout the owner approved on 2026-11-11, dated. |

Outcome (2026-11-11): eight patches applied (findings 1 to 7 and 10), findings 8 and 9 rejected. Finding 1 was the cause of the builder's one whole-suite failure: a second tab replaying a batch still in flight cleared the queue entry and the first tab dropped its Undo step, a fault from entry 10 now mended. The orchestrator's Verification on the patched code: tsc clean, Jest 1010 passed, Gradle clean build offline passed, contract check OK, `ops/up.sh --fresh` and the whole e2e suite 314 passed, 0 failed, 8 skipped (the env-gated scenarios), the Style tab spec passing under the full suite's load. After that run the owner asked for the not-taken note to be shorter ("Not saved yet. Change the rule to try again."): a words-only change, with tsc, Jest 1010, the Gradle build and the `itemstyle` and `kindstyle` specs (10 passed) run again on the rebuilt stack; the whole suite was not run again for it. DESIGN.md and EXPERIENCE.md say the approved layout. No Gateway, `common/` or Ignition file changed. Status built; entry 13a is next.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK
- `ops/up.sh --fresh`, then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: 0 failed

**Manual checks (if no CLI):**
- The tab's new screenshots go to the owner (there is no mock).
