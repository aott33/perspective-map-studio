---
title: "11b: Recent changes, the rail's History surface, and Revert"
type: 'feature'
ticket: ''
part_of: '11'
created: '2026-11-09'
status: 'in-progress'
baseline_revision: '6234a757c8645c2778af851710852fd9afaf7e42'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** 11a keeps what every saved change did and serves it as `edits.history`, but nothing in Edit mode shows it: an editor cannot see who changed what, nor undo another editor's change (R18).

**Approach:** Build Recent changes as DESIGN.md's Recent changes panel and EXPERIENCE.md's History surface (owner, 2026-11-05): a History item on the rail under Layers with a clock glyph opens it in the left dock, as does a click on "Saved"; at the top a note box names the next undo step with an Undo button; then one row per saved batch, newest first, of who (an initial avatar), what in a sentence and when, with Revert; a row expands to the values before and after; a footer says what Revert does. Revert sends the row's reverse as an ordinary edit.

Decisions (owner, 2026-11-09, "approve and continue" on the planner's seven picks): older changes from a Show older button, not on scroll; live updates only while History is open, each `map.changed` asking for the first page again; a kind setup row listed with its kind and no Revert, the reason in words; a row from before 11a with who, what and when and no Revert; the time "10:42" today, else "Nov 7, 10:42"; who as one neutral avatar with the initial; a revert can itself be reverted. Built to DESIGN.md's prose, the surface's screenshots sent to the owner after the build.

## Boundaries & Constraints

**Always:** Browser only: no Gateway, `common/`, message or contract version change. Edit mode only, at every width the rail shows. The delegate asks `edits.history` (pages of 50) when the surface opens, asks the first page again on each `map.changed` while it is open (merging by `seq`, keeping older pages loaded), and asks the next page from "Show older" with the reader's `nextBefore`. **Rows:** one per batch; the sentence from the batch's ops ("Moved P14 about 40 m north", "Renamed P14 to P14 North", "Added well pad P40", "Deleted line L-TEST and its 2 instruments in one change", "Changed 20 pads in one change"), the name each op carries; who as the actor's initial in a neutral avatar and the name; when as "10:42" today, else "Nov 7, 10:42". **Expand:** per op the changed fields with their labels (kind fields' labels), before and after in words, a point as latitude and longitude, a line or area as its points and length. **Revert:** the batch's reverse (a create deleted, a delete created again from `before`, an update sending `before`'s fields), each op at the row's `version`, sent through `sendBatch` as one undo step "revert <sentence>"; refused as any edit is (entry 10's conflict card names who changed it since). Revert is offered for any editor's row, and not for a row from before the record kept values (`before`/`after` null), nor a row with a kind setup op (said in words: kind setups change from the Kinds screen). The note box: "Next undo is one step: Undo: edit 3 pads" and Undo, as the toolbar's Undo is (disabled with the same reason); "Nothing to undo yet" when empty. Footer: "Revert undoes that one change, including someone else's, and saves like any edit." Keyboard: rows and buttons by Tab, a row expands with Enter or Space (`aria-expanded`). Tokens only; no em dashes; existing specs keep their expectations.

**Never:** A Revert message or a Gateway change; reverting a kind setup; grouping several batches into one row; a toast; History in View mode; changing the toolbar's Undo list.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| B1 Open | Rail History, or a click on Saved | The dock shows History, the rail item active, the first page newest first | A refused or failed read says so in words with Try again |
| B2 Two editors | A moves P14, B moves P31 | B's row first, then A's, each with who and when; live in both without reload | No error expected |
| B3 Expand | A move row, Enter | Latitude and longitude before and after | No error expected |
| B4 Revert theirs | A reverts B's move of P31 | P31 moves back, a new row "Reverted ..." on top in both browsers; A's Undo puts B's move back | No error expected |
| B5 Changed since | B moves P31 again, then A reverts the first move | Refused: the conflict card names B | Nothing saved |
| B6 Big batch | A 1,000-op batch row | One row "... in one change"; Revert sends one batch; one undo step | No error expected |
| B7 Old row | A row with null values | Who, what, when; no Revert; expand says the values were not kept | No error expected |
| B8 Kind setup | A row with a kind setup op | Worded with the kind; no Revert, the reason in words | No error expected |
| B9 Paging | 60 batches | 50 rows and Show older; then 60, Show older gone | A failed page keeps the rows and says so |
| B10 Next undo | After my edit | The box names it; its Undo undoes it like the toolbar's | Disabled with the toolbar's reason while paused or busy |

</frozen-after-approval>

## Code Map

- `web/typescript/studio/Rail.tsx` -- `item(key, label, glyph)` :25 (glyph union inline, add `'clock'`), items :45-47; `data-surface`.
- `web/typescript/controls.ts` -- `GLYPH_PATHS` :17 (24-unit stroke paths), `GlyphName` :70; `__tests__/controls.test.ts:12-15` checks every glyph.
- `web/typescript/studio.ts` -- `StudioSurface` :24 (add `'history'`), `showSurface` :119.
- `web/typescript/MapStudio.tsx` -- `onRailSurface` :1264, `renderDock` :1787 (Layers section :1790-1810 is the model, its header with `renderProblemStatus`), Rail :2083, toolbar Undo wiring :2148 and `onUndo` :1527 (reuse for the note box), `renderItemList` ~:1864 (pass `onHistory`).
- `web/typescript/MapStudioStoreDelegate.ts` -- request model `basemapSource` :386-390 with `basemapPendingId` :241 and `onBasemapSource` :430; `handleEvent` :1428 (`readReply` :1436, add `edits.history.reply` and the error id); `onMapChanged` :1517; state `MapStudioDelegateState` :77, `undo` :137, `mapStateToProps` :335; `sendBatch` :549.
- `web/typescript/messages.ts` (`editsHistory` :124, Reply :88, :192) and `contract.ts` (types :335, reader :391, `nextBefore`, `unread`) -- from 11a, used as they are.
- `web/typescript/undo.ts` -- `reverseBatch` :30 (item ops only, versions from `results`; `dataOf` :17, `DATA_FIELDS` :14): build the row's reverse from `before`/`after` and `version`, or a sibling for history rows.
- `web/typescript/undoStack.ts` -- `undoLabel` :80, `canUndo` :71, `busyText` :241, `agoText` :225; `studio/UndoGroup.tsx` `PAUSED_TEXT`.
- `web/typescript/unsaved.ts` -- exported `editLabel` :520, `clockText` :554, `moveWords` :578; private `fieldLabel` :591, `fieldWords` :622, `valueWords` :748, `joinWords` :605: export what the rows need (or move to a small `changeWords.ts`), without changing entry 10's words.
- `web/typescript/studio/ItemList.tsx` :354-356 -- "Saved" as a button (keeping `data-save-state` and the status role on its wrapper); `problems.ts` `headerSaveWords` :167.
- New `web/typescript/studio/HistoryPanel.tsx` and `web/typescript/history.ts` (rows, sentences, reverse batch; pure, Jest); CSS in `web/typescript/mapstudio.css`.
- Tests: Jest beside `undo.test.ts`, `studio.test.ts`, `editClick.test.ts:684` (`onRailSurface`); e2e new `e2e/tests/recentchanges.spec.mjs` using `fixtures.mjs` `signedInContext` :221 and 11a's `history.spec.mjs` builders :24-63; `layout.spec.mjs` :219 (rail width 72 px).
- Docs: `docs/contract.md` (History surface, test hooks), `CHANGELOG.md`, `docs/test-playbook-0.4.0.md` section 8j after 8i :274.

## Tasks & Acceptance

**Execution:**
- [x] `web/typescript/history.ts` -- rows from entries, sentences, expand lines, the reverse batch, who can Revert -- B2, B3, B6 to B8.
- [x] `MapStudioStoreDelegate.ts` -- history state (pages, loading, error), ask on open, on `map.changed` while open, Show older; `revert(seq)` through `sendBatch` -- B1, B2, B4, B5, B9.
- [x] `controls.ts`, `Rail.tsx`, `studio.ts` -- the clock glyph and History item -- B1.
- [x] `studio/HistoryPanel.tsx`, `MapStudio.tsx`, `ItemList.tsx`, `mapstudio.css` -- the surface, the note box, rows, expand, footer, Saved opens it; test hooks (`.mapstudio-history`, `.mapstudio-history-row` with `data-seq`, `.mapstudio-history-revert`, `.mapstudio-history-older`) -- B1, B3, B10.
- [x] Jest -- every matrix row's logic.
- [x] `e2e/tests/recentchanges.spec.mjs` -- B1 to B10 at 1366 px, two editor contexts, screenshots of the surface, a row expanded and a refused Revert.
- [x] Docs and playbook 8j.

**Acceptance Criteria:**
- Given the dev stack and two browsers, when both move items and one reverts the other's move, then both see the item back and the revert listed first, and a Revert after a later change is refused naming who.

## Implementation Notes

- Planner, 2026-11-09: the environment, commit and identity rules are entry 8's plan's (Docker by hand after a restart, JDK 17 by apt if gone, `ops/up.sh --fresh` before a whole-suite run, the session's trailers, `git commit --only`, no em dashes, never a bare `git stash`, never a push). A Gradle download refused 429 passes on a retry with backoff.

## Plan Change Log

## Review Triage Log

## Design Notes

A row's reverse uses its op's `version` as the base, so the Gateway's ordinary conflict check is the "changed since" rule: no client-side comparison with the current record is needed, and the refusal arrives with who and when as entry 10 already shows it.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK
- `ops/up.sh --fresh`, then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: 0 failed

**Manual checks (if no CLI):**
- The surface's screenshots against DESIGN.md's Recent changes panel.
