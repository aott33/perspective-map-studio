---
title: "Save states and the unsaved list: the conflict card, the store unreachable and busy banners, the second tab's replay"
type: 'feature'
ticket: '10'
created: '2026-11-09'
status: 'in-progress'
baseline_revision: '972e9effb4be73bd7079c926ac784a068b825a41'
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

**Problem:** Edit mode says a save failed only on the save status row: a conflict names the other editor but not what they changed and offers only Discard, a save answered store-unreachable leaves the tools on, busy looks like any other refusal, and a second tab that learns another tab's unsent batch from a `storage` event does not replay it until a reload (deferred from 0.2.0).

**Approach:** Build the approved key-screen-9 mocks (EXPERIENCE.md "Save and store states", R26): one card on the map under the toolbar for a conflict (who changed what and when, my change kept, "Use <name>'s version" and "Apply mine on top"), for store unreachable (edits kept on this computer, the toolbar faded and inert, live values still updating, Try again, Show my N edits) and for busy (nothing saved, the change kept here, Try again, Discard my change); the save status row keeps its words and its unsaved list; the `storage` event arms the 15 s replay. No toasts in Edit mode.

Decisions (owner, 2026-11-09, "Approve and continue" on the planner's seven picks): (1) Apply mine on top is a new batch at the stored version, undone like any edit; when they deleted the item or my add meets one that already exists, only "Use <name>'s version" is offered with the reason in words. (2) One card at a time on the map under the toolbar, unreachable then conflict then busy, "1 of 2" when two conflicts wait. (3) Each queued entry keeps the records my ops started from (`before`), so the card names the fields they changed and a moved point reads "about 40 m north"; an older entry without it reads "changed P14 at 10:42". (4) A lost connection is unchanged; only store unreachable pauses the tools. (5) Busy is read from its sentence, no new code. (6) The undo-in-flight race stays with entry 17. (7) The suite fakes the replies through the socket gate; a real PostgreSQL stop runs behind `MAPSTUDIO_STORE_STOP=1`, run once by the orchestrator.

## Boundaries & Constraints

**Always:** Browser only: no Gateway, `common/`, message, prop or contract version change (contract stays 0.4.0, its text updated). A replay still sends the stored batch unchanged. "Apply mine on top" is a new batch with a new `batchId`, my op's data at the conflict's `current.version`, saved and undone as an ordinary edit (one undo step). "Use <name>'s version" discards my entry and the item shows the stored version. Words from EXPERIENCE.md's table; colours from theme tokens; no em dashes; every card reachable and operable by keyboard, `role="alert"` on arrival. The entry 24 row, the `WaitingList` and their e2e hooks stay. Existing specs keep their expectations.

**Never:** A toast in Edit mode; a new error code (busy stays `store-unreachable` with the "Map Studio is busy" sentence); a card in View mode (the chip stays as entry 24 built it); changing what a lost connection does (editing stays on and queues, owner 2026-10-27); fixing the undo-in-flight race in `deferred-work.md` (stays with entry 17).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| R1 Conflict | Two editors change P14; the second saves | Second: row "Not saved - conflict with <name>'s change"; card "<name> moved P14 about 40 m north at 10:42" (or the changed fields named), "Your change, kept here and not saved: ..." | A delete by them or a create that already exists: only "Use <name>'s version", with the reason in words |
| R2 Use theirs | Card, Use <name>'s version | Entry discarded, the item drawn as stored, card gone, row Saved | No error expected |
| R3 Apply on top | Card, Apply mine on top | A new batch at the stored version saves; the item shows mine; Undo restores theirs | Conflict again: a fresh card for the newer change |
| R4 Store unreachable on a save | A save answered `store-unreachable` (not busy) | Card "Store unreachable" with N, toolbar faded, every tool and Undo off, live values update | Replay every 15 s; a save or load that succeeds turns editing on and the card goes |
| R5 Show my N edits | Unreachable card | Opens the row's unsaved list in the dock | No error expected |
| R6 Busy | A save answered busy | Card "Not saved - Map Studio is busy", the change in words, editing stays on | Try again resends; Discard my change discards and removes the dashed item |
| R7 Two problems | Unreachable and a conflict both | One card: unreachable, then conflict, then busy; "1 of 2" when two conflicts wait | No error expected |
| R8 Second tab | Tab A queues an unsent batch; tab B open | B replays it within 15 s, no reload; both lists empty after | The same batch sent by both gets the first reply, no duplicate |
| R9 Reopen | A tab closed with an unsent batch | The batch replays after `map.load` | No error expected |
| R10 Keyboard | A card shows | Focus stays where it was; Tab reaches its buttons; Esc closes a conflict or busy card (the entry stays on the row), not the unreachable one | No error expected |

</frozen-after-approval>

## Code Map

- `web/typescript/unsaved.ts` -- queue (`UnsavedEntry` L54, `reasonFromError` L159 keeps only `changedBy`, `isBusy` L83, word helpers L409-484). Add an optional `conflict` (the `Conflict`s of `contract.ts` L175: `current`, `changedBy`, `changedAt`) and optional `before` (records my ops started from, written at enqueue) to the entry; old entries without them stay valid.
- `web/typescript/unsavedSender.ts` -- `storage()` L94 only refreshes; arm `scheduleReplay()` when unsent entries remain and `canReplay`. `discard` L82, `retry` L70 reused.
- `web/typescript/MapStudioStoreDelegate.ts` -- state L90-163; `editing` L344 (off only from load); `onSave` L1422 (conflict final via `giveUp`); `retryUnsaved` L1244, `discardUnsaved` L1249, `onStorage` L1277. Add the save-unreachable pause, the card's state and `applyOnTop(batchId)` / `useTheirs(batchId)` going through `dispatch` L573 and `discard`.
- `web/typescript/problems.ts` -- `headerSaveWords` L167, `editProblems` L179: the row's words; reuse for the card's titles.
- `web/typescript/studio/SaveStatus.tsx` -- `ProblemRow`, `WaitingList` (open it from Show my N edits), `ProblemStatus`.
- `web/typescript/studio/DrawToolbar.tsx` (`paused` L31) and `studio/UndoGroup.tsx` (`PAUSED_TEXT` L6) -- the fade; wired at `MapStudio.tsx` L2068, L1781, L1813, L1853.
- `web/typescript/MapStudio.tsx` -- render the card in the map area under the toolbar (the chip's area ~L1988/L2050 is View mode's).
- Geometry words: reuse the distance helpers in `web/typescript/userLocation.ts` (entries 15 and 16) for "about 40 m north".
- `web/typescript/mapstudio.css` -- `.mapstudio-toolbar-float--paused` L3680; add the card, `{colors.warning}` accent per the mocks.
- Tests: `web/typescript/__tests__/unsavedSender.test.ts` (storage L241, two tabs L261), `unsaved.test.ts`, `problems.test.ts`, `saveStatus.test.ts`; `e2e/tests/unsaved.spec.mjs` (conflict L107, busy at load L201, Gateway stop L276), `e2e/lib/sockets.mjs` (`openGate` L57 fields; no edits.apply error reply yet).
- Docs: `docs/contract.md` L196 ("not built"), L221-234 (unsaved, L233 store unreachable), conflicts L267-279; `docs/test-playbook-0.4.0.md` (add 8h); `CHANGELOG.md`.
- Gateway (read only): conflict body `ConflictReport.java`, busy `MapStudioDelegate.busyReply` L480; a resend of a committed `batchId` gets the first reply.

## Tasks & Acceptance

**Execution:**
- [ ] `web/typescript/unsaved.ts` -- keep the conflict and the `before` records on the entry; words for "their change" (fields that differ between `before` and `current`, a point's move as distance and compass word, else "changed P14 at 10:42") and "your change"; the rebased batch builder -- the card's data and Apply mine on top.
- [ ] `web/typescript/unsavedSender.ts` -- `storage()` schedules the replay -- R8.
- [ ] `web/typescript/MapStudioStoreDelegate.ts` -- editing off on a save answered store-unreachable (not busy) until a save or load succeeds; the card state (unreachable, conflicts oldest first, busy); `useTheirs`, `applyOnTop` -- R2 to R4, R6, R7.
- [ ] `web/typescript/studio/SaveCard.tsx` (new) and `MapStudio.tsx`, `mapstudio.css` -- the card per the mocks, buttons, "1 of 2", Esc, focus, test hooks (`.mapstudio-save-card`, `data-card` `conflict|unreachable|busy`, `data-batch-id`) -- R1 to R7, R10.
- [ ] `web/typescript/__tests__/` -- unit tests of the words, the rebased batch, the card's order, the pause, storage arming the timer.
- [ ] `e2e/lib/sockets.mjs` -- a gate field answering `edits.apply` busy or unreachable; `e2e/tests/savestates.spec.mjs` (new) -- R1 to R10 at 1366 px, two contexts for R1 to R3, two pages of one context for R8, screenshots of each card; a store-stop row behind `MAPSTUDIO_STORE_STOP=1` that `docker stop`s and starts the PostgreSQL container.
- [ ] `docs/contract.md`, `CHANGELOG.md`, `docs/test-playbook-0.4.0.md` (8h Save problems) -- the cards, Apply mine on top as a new batch, the second tab's replay; the deferred entry resolved in `_bmad-output/deferred-work.md`.

**Acceptance Criteria:**
- Given the dev stack and two browsers, when both edit P14, then the second shows the card naming the first, Use theirs drops the change and Apply mine on top saves it at the new version.
- Given the PostgreSQL container stopped, when an editor makes two edits, then the banner shows, the toolbar fades, both edits are listed by Show my 2 edits, and they save once it starts again.
- Given the whole suite, then it passes on a fresh stack with no skipped or retried test.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

The card replaces nothing on the row: the row is the lasting record, the card the moment's choice. "Apply mine on top" does not break "replays never rebased": the stored entry is discarded and a new batch is written and sent, so a timed-out original that did commit still gets its first reply on its own `batchId`.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` -- expected: pass
- `ops/up.sh --fresh`, then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: 0 failed; then `MAPSTUDIO_STORE_STOP=1` on `savestates.spec.mjs` alone -- expected: pass

**Manual checks (if no CLI):**
- The three cards' screenshots against key-screen-9 conflict, unreachable and busy.
