---
title: "17b: the keyboard and contrast pass of Edit mode, and the contract docs' wording"
type: 'chore'
ticket: ''
part_of: '17'
created: '2026-11-13'
status: 'built'
baseline_revision: 'dd0784b72432c81508f510b6c359894dc60a7c3d'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['{project-root}/docs/platform-checks.md', '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-editing/tickets/story-the-tag-browser-one-tree-for-every-tag-pick-asset-relative-p-plan-13b.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** R14 asks that every tool and panel of Edit mode works by keyboard, that Esc returns to Select, that targets are at least 24 px and that non-text marks reach 3:1 in both themes. Each entry checked its own part; nothing records one pass of the whole, and the contrast check reads only View mode's state marks. Entry 18's release needs that record. The contract document also carries about a hundred "entry N" notes of how it was built, which a reader of the contract does not need.

**Approach:** One keyboard-only pass of every Edit mode surface at 1366 and 1440 px, run as a repeatable spec, with the contrast and target-size readings of the studio's own parts in both themes, recorded in `docs/platform-checks.md`. What fails is recorded as failing and brought to the owner; nothing is fixed here. The contract document's build history is taken out with its meaning unchanged, and the deferred-work list is brought up to date.

Decisions (owner, approved 2026-11-13): (1) The pass is a new e2e spec that uses the keyboard alone (no mouse call), so the record can be made again; the screen reader's reading stays the owner's hand check in the playbook. (2) Surfaces: the rail; the toolbar and each tool (Select, the three instrument tools, point, line, area, snap, undo and redo with its list); the item list and its search; Details and Style with the tag browser; the Kinds list and a kind's setup with the rule editor; Layers with Legend and Units; Recent changes; the save card and the conflict card; the Editing switch. (3) Per surface the record says: reached by Tab, operated by keys, focus ring seen, Esc returns to Select or closes, the mode named in words, smallest target in px, and for each drag the non-drag way. (4) Contrast: the focus ring, the pressed and hover states of buttons, the tab underline, the selection marks and the toolbar glyphs against their surfaces, at 3:1, light and dark. (5) A failure is written in the record as a failure and listed for the owner as a candidate entry; the spec asserts what holds and never skips or weakens a check to pass. (6) `docs/contract.md`: "entry N", "epic N" and dated-decision asides come out where they only tell history; every rule, field, value and example stays word for word; line 3's "unreleased" stays for entry 18. (7) `_bmad-output/deferred-work.md`: a `resolved:` line on the items later entries built; no item is deleted.

## Boundaries & Constraints

**Always:** The spec drives the real dev stack as the suite does and restores what it changes (the seed, the units, the dev setup). Readings are computed from the page (computed styles, bounding boxes), not from the stylesheet's text. The record in `docs/platform-checks.md` is a new section, "Epic 4 entry 17", with one table per width and the contrast tables per theme, and a plain list of what failed. The playbook gains the hand checks the spec cannot make.

**Never:** A change to the product's code, styles, strings or contract (a fix is a new entry); a skipped, `fixme` or loosened test; a change to what `docs/contract.md` requires of either side; a deleted deferred-work item.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| K1 Reach | Tab and Shift+Tab from the page's start, 1366 and 1440 px | Every surface of decision 2 takes focus in a sensible order; none traps it | A trap or an unreachable control is recorded as a failure |
| K2 Operate | Enter, Space, arrows on each control | Each does what its click does | Recorded as a failure |
| K3 Esc | Esc with a tool armed, a card open, a field focused | Returns to Select or closes the card; the mode is named in words | Recorded as a failure |
| K4 Draw | A point, a line and an area made, moved and reshaped by keys alone | Each saved, or the non-drag way named (typed coordinates, typed distance) | Recorded as a failure |
| K5 Targets | Every button and tab of the studio | At least 24 px both ways | Each smaller one listed with its size |
| K6 Contrast | The parts of decision 4, light and dark | At least 3:1 | Each lower one listed with its ratio |
| K7 Docs | `docs/contract.md` before and after | The same rules, fields, values and examples; `check-contract-versions.sh` OK | A changed rule is put back |

</frozen-after-approval>

## Code Map

- `e2e/lib/contrast.mjs` -- the WCAG ratio, `over`, the `TOKENS` list (:24-44, View mode's state marks only); `contrast.test.mjs` its unit tests.
- `e2e/tests/review.spec.mjs` -- :63-90 how a page is opened in a theme (`/dark` sets the session's theme as its view starts), :130-136 the table written with `E2E_DOCS=1`.
- `e2e/tests/tagbrowser.spec.mjs` -- the one keyboard-only walk there is (the tree by keys); `e2e/tests/fixtures.mjs` -- `openEditor` and the shared helpers after 17a.
- `web/typescript/studio/PanelTabs.tsx` -- the Details and Style tabs rove by arrow keys, the Layers and Legend tabs do not: the first known gap.
- `docs/platform-checks.md` -- :977-997 the View-mode contrast record; the epic 4 sections from :1019 hold no keyboard or contrast entry.
- `docs/contract.md` -- 556 lines, about 103 "entry N" notes (for example :19, :57, :74, :118, :184-193).
- `_bmad-output/deferred-work.md` -- :165, :196-206 items of entries 11b, 12b, 12c and 27, built, with no `resolved:` line.
- `_bmad-output/initiative-flowmap/tickets/epic-editing/epic-editing.md` :38 -- R14.

## Tasks & Acceptance

**Execution:**
- [x] `e2e/lib/contrast.mjs` and its test -- the studio's parts added beside the map's marks -- K6.
- [x] `e2e/tests/keyboard.spec.mjs` (new) -- K1 to K5 at both widths, the readings written to the results folder and, with `E2E_DOCS=1`, to the docs.
- [x] `docs/platform-checks.md` -- the section "Epic 4 entry 17" with the tables and the list of failures.
- [x] `docs/test-playbook-0.4.0.md` -- the hand checks: a screen reader's reading of each surface, a real keyboard on a real Gateway.
- [x] `docs/contract.md` -- decision 6 -- K7.
- [x] `_bmad-output/deferred-work.md` -- decision 7.
- [x] `CHANGELOG.md` -- one line under Development.

**Acceptance Criteria:**
- Given the record, when read, then every surface of decision 2 has a row at each width and every failure is listed with what was seen.
- Given `git diff` of the product's code and styles, then it is empty.
- Given the whole suite on a fresh stack, then it passes with the new spec in it.

## Implementation Notes

- Planner, 2026-11-13: the environment and identity rules are entry 13b's plan's first Implementation Note; they hold here. Leave the work uncommitted; run the specs you touch, not the whole suite. Check `docker ps` before any stack work and start Docker as the hand-off note says if it stopped. When a check fails, do not bend the spec to pass and do not fix the product: assert what holds, write the failure down here and in the record, and go on.
- Implementer, 2026-11-13: built as planned, left uncommitted; no product code, style, string or contract rule changed (`git diff` of `web/`, `common/`, `gateway/`, `designer/` and `ops/` is empty). Where the build chose within the plan: (1) `e2e/tests/keyboard.spec.mjs` is six parts per width (the ring, rail and switch; the tools; the list, Details and Style; Kinds, a kind's setup, the rule editor and the tag browser; Layers, Legend, Units and Recent changes; the two cards), one contrast part per theme at 1440 px, and a last test that puts the tables together. It makes no mouse call: the focus moves by Tab or arrow keys pressed until the control holds it. (2) Decision 5 is built as a pinned list: every check is recorded held or failed; the spec asserts that the failed ones are exactly `KNOWN_FAILURES` and `KNOWN_MISSES`, so a new failure fails it and so does a listed one that stops failing. (3) The record is generated: with `E2E_DOCS=1` the spec writes its tables between two markers in `docs/platform-checks.md`, "Epic 4 entry 17" (and always to `e2e/out/keyboard/record.md`); the prose around them, the candidate entries included, is written by hand. (4) Rows beyond decision 2's list: "The map itself" (its missing focus ring had no other home); the three kind buttons and the three instrument kinds each have a row, since "the three instrument tools" reads either way. (5) Hover is read with the state forced through the browser's inspector protocol (no mouse). Decision 4's "pressed and hover states against their surfaces" is read as the fill or the edge of the button against the panel around it, the strongest mark counting; the glyph or words on that fill are read apart. By that reading the faint fills miss, and the record says what else carries each state. (6) The dark theme is the session's, switched from a second tab on the dev `/styles` page by keys and put back to light after. (7) The conflict and busy cards are made as `savestates.spec.mjs` makes them (the socket gate; the other editor saves through the test hook). (8) The spec deletes what earlier specs left before it walks the list (`removeStrays`, as the specs that count the seed do), and puts back what it changes; a preset it changes in the Well pad setup is restored in a `finally`, after one early run left case 4 on "fault" (the dev seed put it back). (9) `docs/contract.md`: 113 "entry", "epic" and "story" notes and the dated owner asides came out (about 5,600 characters, 119 lines touched, eight headings lost a trailing "(epic N entry M)"); every fenced example is byte for byte the same, every code span but one is kept (`item`, the event key's old name, which was history), and no number but those of entries went. Kept on purpose: the quoted section titles of `platform-checks.md` ("Epic 4 entry 13a"), "backlog story N", "entry 18" and line 3's "unreleased". (10) `_bmad-output/deferred-work.md`: `resolved:` on the items of entries 27, 11b, 12b and 12c, and on the Esc-in-a-Details-field item, which entry 6 fixed and the pass saw fixed at both widths (the hand-off note after 17a still calls it open). The findings: 26 failed checks per width in 7 groups and 5 (light) and 7 (dark) contrast misses, all in the record with what was seen. Not done here: the whole e2e suite (the orchestrator's); the spec, the e2e unit tests, tsc, Jest, the Gradle build and the contract check were run.

## Plan Change Log

## Review Triage Log

Quick lens, 2026-11-13. Fourteen findings: twelve patched by the implementer, two false.

| # | Finding | Verdict | Route |
|---|---------|---------|-------|
| 1 | `docs/contract.md`: build history left under bare entry numbers; "decision N" references with no list | medium | patched |
| 2 | `docs/contract.md`: "four more targets" compares to nothing (the other four rewordings change no rule) | low | patched |
| 3 | `keyboard.spec.mjs`: the Move-by-keys check hard-coded `false`, nothing pressed | medium | patched: keys pressed, the result read from the store |
| 4 | `keyboard.spec.mjs`: the record could be built from an older run's files | medium | patched: a run id, the folder emptied, the record refused on a mix |
| 5 | `keyboard.spec.mjs`: restores not in `finally` (tools, layers, cards) | medium | patched |
| 6 | `keyboard.spec.mjs`: the tap's undo loop could press once too often | low | patched |
| 7 | `keyboard.spec.mjs`: the kind buttons' smallest target read from the whole toolbar | medium | patched |
| 8 | `keyboard.spec.mjs` `ringOf`: an outline counted whether or not focus brought it | medium | patched: counted only when focus brings it |
| 9 | Arrow keys on the toolbar, the rail and the instrument list written as notes, not failures | medium | patched: three more pinned failures (26 per width) |
| 10 | "Mode" checks asserting less than their words | medium | patched; all still hold |
| 11 | The map's Edit mode selection marks not read, and the record did not say so | medium | patched: said plainly, hand check in playbook 8w |
| 12 | A doc comment twice | low | patched |
| 13 | The frozen block's "pending" changed to "approved" | false | the orchestrator's record of the owner's approval |
| 14 | Acceptance criterion 3 not evidenced | false | the orchestrator's whole-suite run follows the review |

**Outcome (2026-11-13):** built. Review (quick): twelve findings patched, two false; nothing deferred. The pass found 26 failed keyboard checks per width and 5 (light) and 7 (dark) contrast misses, recorded in `docs/platform-checks.md` ("Epic 4 entry 17") and brought to the owner as seven candidate entries; none fixed. No product code changed. tsc clean; Jest 1176 passed; Gradle BUILD SUCCESSFUL; contract check OK; e2e unit tests 40 passed. Whole e2e suite on a fresh stack: 352 passed, 9 skipped, 0 failed.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean, all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK
- `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` on a fresh stack -- expected: 0 failed
