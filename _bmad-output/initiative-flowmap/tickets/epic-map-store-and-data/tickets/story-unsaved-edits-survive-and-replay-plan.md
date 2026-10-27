---
title: 'Unsaved edits survive and replay'
type: 'feature'
ticket: '8'
created: '2026-10-27'
status: 'built'
baseline_revision: '0759b1b47326e2a5140eaacf8be441bc8ee22171'
route: 'full'
route_source: 'pinned'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/story-saved-edits-reach-every-open-map-at-once-plan.md'
  - '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/story-conflicts-retries-deletes-and-the-phone-role-plan.md'
  - '{project-root}/docs/contract.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Today a finished line is sent once (`MapStudioStoreDelegate.sendLineCreate`); if the Gateway does not answer, is busy, or refuses it, the edit lives only in Terra Draw's memory and is lost when the page closes, and a map whose store is unreachable at load still offers the draw tool (epic R7, R5; AD-10; prd FR-29, FR-31; SM-4).

**Approach:** A pure browser module keeps every batch in an ordered queue in `localStorage`, per project, written before the batch is sent; it replays unsent batches through the existing `edits.apply` with their original `batchId`s and `baseVersion`s until saved or discarded (story 2's retry rule makes a resend of a committed batch harmless), draws queued map items as unsaved, lists each with its reason (a conflict names the other editor's change) and a Discard; a `store-unreachable` answer to `map.load` turns editing off and draws no map item as current. No migration.

## Boundaries & Constraints

**Always:**
- The queue entry is written before the message is sent; the entry is removed only on an `edits.apply.reply` for its `batchId` (or a Discard). A replay sends the stored batch byte for byte: same `batchId`, same ops and `baseVersion`s, never rebased.
- Codes sort into two classes. Transient (kept unsent, replayed automatically): no reply within 15 s, the client disconnected, `store-unreachable` (busy included), `read-only`. Final (kept refused with the reason, not replayed automatically, Try again or Discard): `conflict`, `role`, `invalid`, `stale`, any other code.
- Replay runs one batch at a time, oldest first, only after a `map.load.reply` with level `phone` or `full`, and again on a `map.changed`, on Try again and on a 15 s timer while unsent entries remain; at level `none` entries stay unsent with "Sign in with a Map Studio editing role to save these edits."
- Every `localStorage` read and write is in try/catch; a failing storage (quota, private window) still sends the batch and says once "This browser cannot keep unsaved edits; an edit not saved now is lost when the page closes." Every queue change re-reads storage first, and a `storage` event from another tab refreshes the list.
- Words follow EXPERIENCE.md: "Not saved - conflict with <changedBy>'s change" plus the Gateway's message, "Store unreachable - N edits not saved", "Not saved - Map Studio is busy". Colours only from theme tokens (AD-11). No em dashes.
- Existing e2e attributes and texts keep working: `.mapstudio-save-status` with `data-save-state`, `data-code` and "Not saved: <message>", `data-items-loaded` (store items only), `.mapstudio-load-status`.
- Perspective client calls not seen live are marked [unverified] in comments and docs.

**Never:**
- A database migration, or any Gateway change other than the one Open Question 1 names.
- The conflict card's "Use Sam's version" or "Apply mine on top", the save banner, Recent changes, undo (epic-editing); reload on reconnect (epic-viewing); kind setup ops (entry 9).
- Resending with a new `batchId` or a new `baseVersion`; replaying a final refusal on its own.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Saved | editor draws a line, Gateway up | entry written, sent, reply removes it; line drawn from the store items | none |
| Gateway gone | client disconnected, or no reply in 15 s | entry unsent, line drawn dashed as unsaved, "Store unreachable - 1 edit not saved" | retried on timer, `map.changed`, Try again |
| Page closed and reopened | unsent entry in storage | drawn as unsaved at mount; after `map.load.reply` (full) replayed; saved and removed | a committed-but-unanswered batch replays its first reply (story 2) |
| Busy | `store-unreachable` reply to the save | unsent, "Not saved - Map Studio is busy" | timer retry |
| Conflict | `conflict` reply | refused, "Not saved - conflict with mapoperator's change" and the Gateway's sentence; Discard removes it and its unsaved drawing | not replayed automatically |
| Role | viewer's line | refused `role`, kept, Discard offered | not replayed |
| Store unreachable at load | `map.load` answered `store-unreachable` | message shown, `data-items-loaded` 0, draw button disabled, `data-editing="off"`; queued edits still drawn as unsaved | next successful load turns editing on |
| Storage fails | `setItem` throws | batch still sent; one plain-words warning | none |
| Two tabs | same project in two tabs | both may replay one entry; the second gets the first reply (same actor) and removes it | none |

## Decisions

Owner, 2026-10-27: "agree with all recommendations, start building" - every Open Question takes its recommended option.

1. **Whose queue: per project and user.** The Gateway adds `user` (the session user name, levels `phone` and `full` only) to `map.load.reply`, an additive contract 0.2.0 field, no migration; the key is `mapstudio.unsaved.v1:<project>:<user>`. Other users' entries stay untouched and hidden. Before a `map.load.reply` names the user, nothing is drawn or replayed from storage.
2. **A refused batch in the middle of the queue: replay continues past it.** Each batch is judged alone; `baseVersion`s refuse any later batch that depended on it.
3. **Drawing while the Gateway is gone: editing goes off only when `map.load` says the store is unreachable.** A lost connection after load keeps editing on and queues; epic-editing revisits with the save banner.

</frozen-after-approval>

## Code Map

- `web/typescript/MapStudio.tsx` -- `MapStudioStoreDelegate`: `sendLineCreate` (builds the batch with `lineCreateBatch`, keeps `pendingSaves` by message id), `handleEvent` routing, `onMapLoad`, `onSave`, `mapStateToProps`. Component: `onDrawFinish`, `savingFeatures`/`dropSavedFeature` (Terra Draw copy kept until saved), `drawItems` with sources `mapstudio-items-line`/`-point`, `render` (save status, load status, data attributes). Project for the key: `store.view.page.parent.projectName` (`ClientStore.projectName` in perspective-client 2.3.10 typings) [unverified live]; connection: `ClientStore.connection.connected` [unverified live]; reach the client store from the delegate's `componentStore` [unverified], else the component passes it in at mount.
- `web/typescript/save.ts` -- `SaveState`, `saveStatusText`, `refusedSave`, `itemsToGeoJson` (reuse for the unsaved overlay).
- `web/typescript/changes.ts` -- `MapChanges.saved(record)` applies an own save; keep `seq` rules untouched.
- `web/typescript/contract.ts` -- `EditBatch`, `ErrorCodes`, `Conflict` (`changedBy`), `readMapLoadReply`. `messages.ts` -- `editsApply`, `ErrorBody` (`batchId`, `conflicts`). `storeState.ts` -- unchanged rules.
- `web/typescript/DrawControl.tsx` -- `setPressed`; add `setDisabled`.
- `gateway/.../load/MapLoader.java` `mapLoadReply`, `gateway/.../MapStudioDelegate.java` (`SessionView` has the user name, line ~203) -- only if Open Question 1 is answered B.
- `e2e/tests/fixtures.mjs` (`openMap`, `mapLoaded`, `editorTest`), `store.spec.mjs` `drawLine`, `store-ops.spec.mjs` and `ops/store-checks.sh` (the `unavailable` scenario) -- patterns; `window.__mapStudioTest` sends bypass the queue (keep it so).
- Jest runs in node: the queue module takes a `{getItem, setItem, removeItem}` store, never `window`.

## Tasks & Acceptance

**Execution:**
- [x] `web/typescript/unsaved.ts` (new, pure) -- key `mapstudio.unsaved.v1:<project>`; entry `{batchId, batch, queuedAt, state: 'unsent'|'refused', reason?: {code, message, changedBy?}}`; read (drop malformed entries, keep the rest), `enqueue`, `onReply`, `onError` (class rule), `discard`, `nextToReplay`, `unsavedItems` (create ops as records), status texts.
- [x] `web/typescript/__tests__/unsaved.test.ts` (new) -- every matrix row with a fake store and clock; malformed storage; quota throw; order.
- [x] `web/typescript/MapStudio.tsx` -- delegate holds the queue, sends through it, 15 s reply timer, replay rule, `storage` listener, state `unsaved` and `editing`; component draws `mapstudio-unsaved-line`/`-point` (dashed, theme token), removes the Terra Draw copy once queued, renders `.mapstudio-unsaved` rows (`data-batch-id`, `data-unsaved-state`, `data-code`, Discard) and Try again, sets `data-unsaved-count` and `data-editing`; disables the draw tool on a failed load.
- [x] `web/typescript/save.ts`, `DrawControl.tsx`, `mapstudio.css` -- `unsent` save state and words; `setDisabled`; styles from tokens.
- [x] `e2e/tests/unsaved.spec.mjs` (new) -- editor: `context.setOffline(true)` [unverified that Perspective sees it as a disconnect], draw, unsaved shown; close the page, open a new one in the same context online, saved and `data-items-loaded` +1. Conflict: seed storage with a stale update (two hook saves first), reload, conflict text names `mapeditor`, Discard empties the list. Screenshots at 1440 and 390 px.
- [x] `e2e/tests/store-ops.spec.mjs` -- `unavailable` scenario also asserts `data-items-loaded` 0 and the draw button disabled.
- [x] `docs/contract.md` (new section "Unsaved edits in the browser"), `docs/architecture.md` ("How a save works"), `docs/platform-checks.md` ("Epic 2 story 8": projectName, connection state, and a manual run with the dev Gateway stopped).

**Acceptance Criteria:**
- Given the dev Gateway stopped with the editor's map open, when a line is drawn, then it shows as unsaved, survives closing the browser, and saves on reopen once the Gateway is back (verify line; manual live run recorded).
- Given a queued batch refused `conflict`, when the map shows it, then its reason names the other editor's change and Discard removes it from storage and the map.
- Given the store unreachable at load, then the message shows, no store item is drawn and the draw tool is off.
- Given `npm test` and `./gradlew build`, then all suites pass.

## Implementation Notes

- Built 2026-10-27 directly in this session (no implementation subagent available). Verification: Jest 92 passed (`unsaved.test.ts` 18 of them), `tsc --noEmit` clean; `./gradlew clean build` green (gateway 165 tests; the known timing-sensitive `AdapterServiceTest.aKindCallSettlingWhileAnAssetCallAnswersDoesNotDeadlock` failed once and passed on the rerun, unchanged); e2e on `ms-e2s8`: 29 passed, 5 skipped (store-ops, run by `ops/store-checks.sh`, and the gated stopped-Gateway test); `unsaved.spec.mjs` 4 passed; the stopped-Gateway test passed with `MAPSTUDIO_GATEWAY_STOP=1`; `ops/store-checks.sh` all four scenarios passed with the new `unavailable` assertions.
- Matrix audit: Saved, Gateway gone, Page reopened, Conflict: unit and e2e; Busy, Role, Storage fails, Two tabs: unit (`unsaved.test.ts`); Role also by story 1's viewer e2e; Store unreachable at load: `store-ops.spec.mjs` under `ops/store-checks.sh`.
- Quick review: no subagents in this session, so the Quick lens prompt was written beside this plan (`story-unsaved-edits-survive-and-replay-plan-quick.md`, not committed) for a separate session; its findings are triaged below and the prompt file is deleted.
- After the review (2026-10-27): the send, reply timer and replay rules moved from the delegate into `web/typescript/unsavedSender.ts` (`UnsavedSender`, Jest with fake timers in `unsavedSender.test.ts`); `MapChanges.retryFailedLoad` re-sends a failed `map.load` every 15 s. Verification: Jest 109 passed (13 suites); `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build` green (234 JVM tests); e2e on `ms-e2s8` after `ops/up.sh --fresh`: 30 passed, 6 skipped (store-ops, run by `ops/store-checks.sh`, and the gated stopped-Gateway test), `unsaved.spec.mjs` 5 passed with the new load-failure test; `ops/store-checks.sh` all four scenarios passed.

## Plan Change Log

- 2026-10-27, owner approval ("agree with all recommendations, start building"): Open Questions 1 B, 2 A, 3 A recorded under Decisions in the frozen block; the Gateway change is `MapStudioDelegate.withUser` (one pure helper called from `storeReply`, unit tested in `StoreReplyPerCallTest`), not `MapLoader`, to keep the shared loader untouched.
- Per-user key, consequence: a stored queue is shown and replayed only once a `map.load.reply` names the key, not at mount; entries made before that (or with no project name) stay in memory and move into storage then. "Store unreachable at load" draws this page's queued items only.
- A new batch is always sent at once, at any level (keeps story 1's viewer refusal test); only replays of stored entries wait for level `phone` or `full`. Error replies keep the compat save status `refused` with `data-code` (store-unreachable and read-only included); the new save state `unsent` is for no reply and a disconnected client only.
- DOM names: the list is `.mapstudio-unsaved`, one `.mapstudio-unsaved-row` per entry (with `data-batch-id`, `data-unsaved-state`, `data-code`); Try again shows once an entry has a reason.
- Review pass 1 (2026-10-27): `UnsavedQueue` keeps memory as the truth after a storage failure and clears the key (Boundaries "every queue change re-reads storage first" holds while storage works); the busy answer to `map.load` keeps the items, level and editing; a failed `map.load` is re-sent every 15 s; Discard is off while the batch is in flight; replay runs from memory when no project name is known; a stored `delete` op may carry no `data`; `.mapstudio-map` gains `data-unsaved-drawn`. The e2e routing takes edits.apply events out of Perspective's numbered `sync:` frames instead of dropping the frame (a dropped frame stalls the client's later frames, observed live).
- e2e "Gateway gone": instead of `context.setOffline(true)` (whether it closes an open websocket is [unverified]), the spec routes the page's websockets (`routeWebSocket`) and drops frames carrying `edits.apply`, so the reply timer runs out deterministically; the stopped-Gateway run is a gated test in the same spec (`MAPSTUDIO_GATEWAY_STOP=1`), recorded in `docs/platform-checks.md`.

## Review Triage Log

Pass 1 (lens: quick, context-free, on commit 0d32b00, 2026-10-27; the reviewer read the code and ran only `unsaved.test.ts` and `contract.test.ts`, the findings were checked again here against the code): high 0, medium 2, low 7, false 0, maybe-false 0. All nine patched (finding 6 by correcting the Design Note, as the reviewer offered); no loopback (each fix is local; the frozen intent, the Decisions and the contract's shape stand).

| # | Finding | Verdict | Route | Evidence and action |
|---|---|---|---|---|
| 1 | After one storage throw `storageFailed` stuck: later discards, saves and refusals never reached storage, so a discarded entry came back and was replayed on the next page open | medium | patch | Real: `change()` returned before writing once `storageFailed` was set. Patched in `UnsavedQueue`: every change still tries to write; on a throw the key is removed at once (so nothing stored before the failure can come back), memory decides while a write has failed, and every change and each 15 s `refresh` tries again; the warning is still given once. Unit tests: discard after a quota error then reopen (nothing comes back), storage recovering writes memory, a failing `getItem` with later save and refusal reaching storage. `docs/contract.md` (Storage failure) says so. |
| 2 | A busy answer to `map.load` blanked the map and turned editing off; nothing re-sent `map.load` on a quiet project | medium | patch | Real: `storeStateFromError` made any `store-unreachable` `unavailable`, and only a `map.changed` retried. Patched: the busy answer (`isBusy`) keeps the level, store state, items drawn and editing; after any failed `map.load` the delegate re-sends it every 15 s (`MapChanges.retryFailedLoad`, unit tested). e2e `unsaved.spec.mjs` "a map.load that fails after the map loaded" covers busy, then unreachable, then the retry turning editing back on. |
| 3 | `store-ops.spec.mjs`'s `data-items-loaded` 0 proved nothing (that map never had items) | low | patch | Real. The new e2e above loads the editor's map with items, forces a gap reload (one `map.changed` dropped in the websocket route), rewrites its reply to `store-unreachable`, and asserts items 0, the draw tool disabled and the queued line still drawn (`data-unsaved-drawn` 1). The store-ops line stays with a comment saying what it checks. |
| 4 | The conflict e2e used one user, did not assert the Gateway's sentence, and had nothing drawn to discard | low | patch | Real. The second save is now `mapoperator`'s (phone editor, a properties update); the row is asserted to name `mapoperator` and to contain the Gateway's own message (asked once through the hook, a refused batch writes nothing); the stale batch also creates a line, drawn as unsaved (`data-unsaved-drawn` 1) and gone after Discard (0). |
| 5 | Discard worked while a batch was in flight, so the Gateway could still commit it, and a late error marked a discarded line refused | low | patch | Real. `UnsavedSender.discard` refuses while the batch is in flight and the button is disabled then (`sending` in the delegate state); a discard forgets every message id of the batch, and an error for a batch no longer queued is ignored. Unit tested. |
| 6 | The Design Note said only the tab holding the in-flight id replays a transient entry; the code (and the contract) let two tabs replay one entry | low | patch (doc) | Real mismatch. The matrix and `docs/contract.md` already allow it and the Gateway's retry rule makes it harmless, so the Design Note is corrected; no stored in-flight marker. |
| 7 | With no project name (no storage key) nothing was ever replayed in that page | low | patch | Real: `canReplay` required the key. Replay now needs only level `phone` or `full`; with no key it replays the entries this page holds in memory. Unit tested. |
| 8 | A stored delete op (no `data`, as the contract says) was dropped as malformed | low | patch | Real trap for epic-editing. `readBatch` accepts a `delete` with no `data`, `EditOp.data` is optional in `contract.ts`, and the malformed-storage test covers a kept delete and a dropped update without data. |
| 9 | The delegate's timer, late-reply, replay-chain, level-gate, storage-event and storage-failure rules had no unit test | low | patch | Real. Those rules moved into `UnsavedSender` (pure, like `MapChanges`) with 14 Jest tests on fake timers; the delegate keeps the save status, store state and items. |

## Design Notes

Status line rule: one `.mapstudio-save-status` for the latest save stays (compat); the `.mapstudio-unsaved` list below it holds every queued entry. One tab never sends one batch twice at once (its own in-flight set), but nothing in storage marks an entry in flight, so two tabs may both replay one entry at the same time; the Gateway's retry rule makes the second send return the first reply (matrix row "Two tabs", `docs/contract.md`).

## Verification

**Commands:**
- `cd web && npm test && npm run typecheck` -- expected: all pass, `unsaved.test.ts` included
- `./gradlew build` -- expected: success (gateway tests too if Question 1 is B)
- `cd e2e && npx playwright test tests/unsaved.spec.mjs` and `ops/store-checks.sh` -- expected: pass on the dev stack (`MAPSTUDIO_CONTAINER=ms-e2s8`, `GATEWAY_HTTP_PORT=9128`)

**Manual checks (if no CLI):**
- Stop the dev Gateway container with the editor's map open, draw a line, close the browser, start the Gateway, reopen: the line saves and psql shows its edit record.
