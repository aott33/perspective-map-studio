---
title: 'Unsaved edits survive and replay'
type: 'feature'
ticket: '8'
created: '2026-10-27'
status: 'draft'
baseline_revision: '0759b1b47326e2a5140eaacf8be441bc8ee22171'
route: 'full'
route_source: 'pinned'
risk: 'high'
review: ''
review_source: ''
lenses_ran: []
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
- [ ] `web/typescript/unsaved.ts` (new, pure) -- key `mapstudio.unsaved.v1:<project>`; entry `{batchId, batch, queuedAt, state: 'unsent'|'refused', reason?: {code, message, changedBy?}}`; read (drop malformed entries, keep the rest), `enqueue`, `onReply`, `onError` (class rule), `discard`, `nextToReplay`, `unsavedItems` (create ops as records), status texts.
- [ ] `web/typescript/__tests__/unsaved.test.ts` (new) -- every matrix row with a fake store and clock; malformed storage; quota throw; order.
- [ ] `web/typescript/MapStudio.tsx` -- delegate holds the queue, sends through it, 15 s reply timer, replay rule, `storage` listener, state `unsaved` and `editing`; component draws `mapstudio-unsaved-line`/`-point` (dashed, theme token), removes the Terra Draw copy once queued, renders `.mapstudio-unsaved` rows (`data-batch-id`, `data-unsaved-state`, `data-code`, Discard) and Try again, sets `data-unsaved-count` and `data-editing`; disables the draw tool on a failed load.
- [ ] `web/typescript/save.ts`, `DrawControl.tsx`, `mapstudio.css` -- `unsent` save state and words; `setDisabled`; styles from tokens.
- [ ] `e2e/tests/unsaved.spec.mjs` (new) -- editor: `context.setOffline(true)` [unverified that Perspective sees it as a disconnect], draw, unsaved shown; close the page, open a new one in the same context online, saved and `data-items-loaded` +1. Conflict: seed storage with a stale update (two hook saves first), reload, conflict text names `mapeditor`, Discard empties the list. Screenshots at 1440 and 390 px.
- [ ] `e2e/tests/store-ops.spec.mjs` -- `unavailable` scenario also asserts `data-items-loaded` 0 and the draw button disabled.
- [ ] `docs/contract.md` (new section "Unsaved edits in the browser"), `docs/architecture.md` ("How a save works"), `docs/platform-checks.md` ("Epic 2 story 8": projectName, connection state, and a manual run with the dev Gateway stopped).

**Acceptance Criteria:**
- Given the dev Gateway stopped with the editor's map open, when a line is drawn, then it shows as unsaved, survives closing the browser, and saves on reopen once the Gateway is back (verify line; manual live run recorded).
- Given a queued batch refused `conflict`, when the map shows it, then its reason names the other editor's change and Discard removes it from storage and the map.
- Given the store unreachable at load, then the message shows, no store item is drawn and the draw tool is off.
- Given `npm test` and `./gradlew build`, then all suites pass.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

Status line rule: one `.mapstudio-save-status` for the latest save stays (compat); the `.mapstudio-unsaved` list below it holds every queued entry. A transient entry is only ever replayed by the tab that holds its in-flight message id, so one tab never sends one batch twice at once.

## Open Questions

1. **Whose queue?** AD-10 says "per project". On a shared control-room PC, user B would replay user A's unsent edits under B's name. (A) Key per project only, as AD-10 reads. (B) Gateway adds `user` (the session user name, levels `phone` and `full` only) to `map.load.reply`, an additive 0.2.0 field, no migration; the key becomes `<project>:<user>` and other users' entries stay untouched and hidden. Recommended: B.
2. **A refused batch in the middle of the queue.** (A) Replay continues past it: each batch is judged alone, and `baseVersion`s refuse any later batch that depended on it. (B) Strict order: later batches wait behind it until it is discarded. Recommended: A.
3. **Drawing while the Gateway is gone.** EXPERIENCE.md pauses the tools while the store is unreachable; the verify line draws a line while the Gateway is stopped. (A) Editing goes off only when `map.load` says the store is unreachable; a lost connection after load keeps editing on and queues. (B) Editing also goes off on a lost connection (then the verify line cannot be met). Recommended: A; epic-editing revisits with the save banner.

## Verification

**Commands:**
- `cd web && npm test && npm run typecheck` -- expected: all pass, `unsaved.test.ts` included
- `./gradlew build` -- expected: success (gateway tests too if Question 1 is B)
- `cd e2e && npx playwright test tests/unsaved.spec.mjs` and `ops/store-checks.sh` -- expected: pass on the dev stack (`MAPSTUDIO_CONTAINER=ms-e2s8`, `GATEWAY_HTTP_PORT=9128`)

**Manual checks (if no CLI):**
- Stop the dev Gateway container with the editor's map open, draw a line, close the browser, start the Gateway, reopen: the line saves and psql shows its edit record.
