---
title: "17b: the keyboard and contrast pass of Edit mode, and the contract docs' wording"
type: 'chore'
ticket: ''
part_of: '17'
created: '2026-11-13'
status: 'in-progress'
baseline_revision: 'dd0784b72432c81508f510b6c359894dc60a7c3d'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: ''
review_source: ''
lenses_ran: []
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
- [ ] `e2e/lib/contrast.mjs` and its test -- the studio's parts added beside the map's marks -- K6.
- [ ] `e2e/tests/keyboard.spec.mjs` (new) -- K1 to K5 at both widths, the readings written to the results folder and, with `E2E_DOCS=1`, to the docs.
- [ ] `docs/platform-checks.md` -- the section "Epic 4 entry 17" with the tables and the list of failures.
- [ ] `docs/test-playbook-0.4.0.md` -- the hand checks: a screen reader's reading of each surface, a real keyboard on a real Gateway.
- [ ] `docs/contract.md` -- decision 6 -- K7.
- [ ] `_bmad-output/deferred-work.md` -- decision 7.
- [ ] `CHANGELOG.md` -- one line under Development.

**Acceptance Criteria:**
- Given the record, when read, then every surface of decision 2 has a row at each width and every failure is listed with what was seen.
- Given `git diff` of the product's code and styles, then it is empty.
- Given the whole suite on a fresh stack, then it passes with the new spec in it.

## Implementation Notes

- Planner, 2026-11-13: the environment and identity rules are entry 13b's plan's first Implementation Note; they hold here. Leave the work uncommitted; run the specs you touch, not the whole suite. Check `docker ps` before any stack work and start Docker as the hand-off note says if it stopped. When a check fails, do not bend the spec to pass and do not fix the product: assert what holds, write the failure down here and in the record, and go on.

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean, all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK
- `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` on a fresh stack -- expected: 0 failed
