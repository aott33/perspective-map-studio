---
title: 'Saved edits reach every open map at once'
type: 'feature'
ticket: '4'
created: '2026-10-26'
status: 'draft'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'medium'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/story-tracer-one-edit-saved-through-the-write-path-and-read-back-plan.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** After entry 1 a save reaches the map store, but the change hook is a no-op: a second open map shows the edit only after a page reload, so two editors work on stale maps and run into conflicts they could have seen (epic R6, prd FR-29, AD-17).

**Approach:** Replace entry 1's `NoChangeHook` with an in-process change bus: each committed batch, from the browser or `applyEdits`, becomes one change event that the bus delivers, in `seq` order, to every open Map Studio delegate of that project, which sends `map.changed {seq, ops}` (body in Design Notes) to its browser. The browser applies the records in order and reloads the map with `map.load` when it sees a gap in `seq`. No schema change.

## Boundaries & Constraints

**Always:**
- Build on entry 1 as built: its `ChangeHook` interface, `WriteService` (hook called once per commit, after commit), `MapLoader`, envelope, `MapItemRecord`, and the project from `getSession().getProjectName()`. Each project keyed by its own name.
- Every open map of the project gets every committed batch, whatever its level (`none`, `phone`, `full`), including the session that saved it; another project's maps get nothing.
- Delivery never runs inside the write transaction, never blocks the saver's reply, and one failing delegate never stops delivery to the others.
- `seq` in the browser advances only through `map.load` and `map.changed`, never from `edits.apply.reply`. A record is applied only when its version is above the drawn one, so a repeated or self-sent event changes nothing.
- `map.changed` never touches `lastReply`, `pendingId` or the point-click reply text, and logs to the browser console at info or debug only (the popup specs count `[MapStudio]` warnings).
- Logs through `MapStudio.changes`; never a map item's properties in a log line. SDK behaviour not seen live is marked unverified in comments and docs.

**Never:**
- A database migration, polling the database, or a channel between Gateways (one active Gateway per AD-21; entry 5 owns redundancy).
- Conflicts, retries, deletes, the phone matrix (entry 2), kind or asset lists (entry 3), live setup change (entry 6), `values.batch` or the live-value resubscribe (epic-viewing), the unsaved-edit queue (entry 8).
- Change entry 1's message shapes other than adding `map.changed`'s body, or change the existing e2e specs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Save with two maps open | A and B on project P at seq 4; A saves a line | A and B get `map.changed {seq:5, ops}`; B draws the line, no page reload | none |
| Script save | `applyEdits("mapstudio-dev", batch, "seed-script")` | every open map of the project gets it | none |
| Other project | a map of project Q is open | Q's map gets nothing | none |
| Event before load reply | `map.changed` arrives before `map.load.reply` | held; after the reply, events with seq above the loaded seq are applied in order | none |
| Duplicate or old | seq <= current, or record version <= drawn | ignored | none |
| Gap | current seq 5, event seq 7 | browser sends `map.load`, replaces its items, `data-map-reloads` + 1 | reload |
| Unreadable `map.changed` | missing seq or ops | treated as a gap | reload |
| Out-of-order commit | hook for seq 7 runs before seq 6 | bus holds 7 up to 2 s and sends 6 then 7 | after 2 s sends 7; browsers reload |
| Map closed | delegate shut down | unsubscribed; no further delivery | a failed send is logged at debug, others still served |
| `kindSetup` op | an op with entity `kindSetup` | seq advances; nothing drawn (epic-viewing draws kind setups) | none |

</frozen-after-approval>

## Code Map

- Entry 1 plan (context) -- the contracts. `write/ChangeHook.java` is the interface this story implements; `write/NoChangeHook.java` stays for unit tests; `WriteService` calls the hook once per commit, after commit; `MapStudioGatewayHook` builds the services and the delegate factory (`MapStudioDelegate::new` today); `Messages.java` declares `map.changed`.
- `gateway/.../gateway/MapStudioDelegate.java` -- `onStartup`/`onShutdown` exist (debug lines); `fireEvent(name, JsonObject)` calls `component.fireEvent("model", ...)`; `envelope(type, id, body)` is static and reusable; keep the "no exception escapes" rule.
- SDK [SDK 8.3.10 javap], behaviour unverified: `Component.getSession()`, `Session.getProjectName()`, `Session.queue(): ExecutionQueue` (`submit(Runnable)`, ordered per session), `ComponentModelDelegate.fireEvent(String, JsonObject)`.
- `web/typescript/MapStudio.tsx` -- `MapStudioStoreDelegate.handleEvent` (line ~108) writes every reply into `lastReply` and warns on an id mismatch: route `map.changed` before that code. Entry 1 adds `map.load` on mount, the items sources `mapstudio-items-point`/`-line` and `data-items-loaded`; reuse its item drawing, do not add a second one.
- `web/typescript/messages.ts` -- `readReply` returns `invalid` for unknown types; add a `map.changed` case. `web/typescript/contract.ts` (entry 1) -- `MapItemRecord` type.
- `e2e/tests/fixtures.mjs` (`openMap`, `watch`, entry 1's `signIn`), `e2e/tests/store.spec.mjs` (entry 1) -- patterns; not edited.

## Tasks & Acceptance

**Execution:**
- [ ] `gateway/.../change/ChangeEvent.java`, `ChangeBus.java` (new) -- `ChangeBus implements ChangeHook`: subscribers per project (`ConcurrentHashMap` of `CopyOnWriteArraySet`), `subscribe(project, Consumer<JsonObject>)` returning an unsubscribe handle; one single-thread executor; per project a next-expected `seq` (taken from the first event after start) with a 2 s hold for a missing one; builds the `map.changed` body once per event; catches per subscriber; `close()` stops the executor -- AD-17.
- [ ] `gateway/.../gateway/MapStudioDelegate.java` -- in `onStartup` subscribe with the session's project; in `onShutdown` unsubscribe; deliver through `component.getSession().queue().submit(...)` then `fireEvent(EVENT_NAME, envelope(MAP_CHANGED, <new UUID>, body))` (fallback if the queue path does not reach the browser live: `fireEvent` directly from the bus thread; record which worked).
- [ ] `gateway/.../gateway/MapStudioGatewayHook.java` -- build one `ChangeBus`, hand it to `WriteService` in place of `NoChangeHook` and to the delegate factory the same way the write service is handed in; close it in `shutdown`.
- [ ] `common/.../common/Messages.java` -- `MAP_CHANGED` in `OUTBOUND_TYPES` if entry 1 left it out.
- [ ] `web/typescript/changes.ts` (new, pure) -- `ChangeState {seq, loaded, buffer, items}`; `onLoad(state, reply)`, `onChanged(state, raw)` returning `{state, action: 'apply'|'ignore'|'reload'}`; version rule; tombstone (`deleted`) removes the item.
- [ ] `web/typescript/messages.ts`, `MapStudio.tsx` -- read `map.changed`; in the store delegate send it to `changes.ts`, redraw the items sources, set `data-store-seq` and `data-map-reloads`, on `reload` send `map.load` once (no second while one is pending).
- [ ] `gateway/src/test/.../change/ChangeBusTest.java`, `MapStudioDelegateTest.java` (extend), `web/typescript/__tests__/changes.test.ts` (new) -- every matrix row; the bus with a fake clock for the hold.
- [ ] `e2e/tests/changes.spec.mjs` (new) -- editor at `/edit` and anonymous viewer at `/` in two browser contexts; editor draws a line; viewer's `data-items-loaded` grows by 1 within 5 s, a `window` marker set before the save survives (no navigation), `data-map-reloads` stays 0; then "Run script checks" and the viewer sees the script's point; screenshots `mapstudio-changes-{1440,390}.png`.
- [ ] `docs/contract.md` (the `map.changed` section: body, ordering, gap rule, example), `docs/platform-checks.md` (section "Epic 2 story 4 - pushing from the Gateway": which delivery path reached the browser).

**Acceptance Criteria:**
- Given the dev stack with two browsers open on the dev view, when a line is saved in one, then it appears in the other within 5 s without a page reload (verify line; e2e).
- Given the Jest suite, when a `map.changed` with a skipped seq is applied, then the store delegate sends `map.load` and counts one reload (verify line).
- Given `./gradlew build`, then `ChangeBusTest` shows fan-out to the project's subscribers only, unsubscribe, a throwing subscriber not stopping the others, and in-order delivery of out-of-order commits.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

**Body.** `map.changed {seq, batchId, actor, ops: [{op, entity, id, version, record}]}`, `record` the stored record after commit (`MapItemRecord` for items, `{kindId, setup, version, deleted}` for kind setups). Full records, because an update carries only the fields it changes (entry 1 decision) and a browser cannot merge a field it never had. `batchId` and `actor` let a later story show "changed by" and match its own batch (deferred-work, reply correlation). Open Question 1.

**Order.** Commits of one project are serialised by the `mapstudio_project` row lock, but hooks run after commit on caller threads, so seq 7's hook can run before 6's. The bus restores order rather than letting browsers reload on every race; a seq that never arrives (a crash between commit and hook) is skipped after 2 s and browsers reload on the gap.

**Browser rule.**
```text
not loaded:          buffer
seq <= current:      ignore
seq == current + 1:  apply records with version > drawn; current = seq
seq >  current + 1:  reload (map.load), keep buffering until the reply
```

## Open Questions

1. **What `map.changed` carries.** (a) Each op's full stored record after commit, plus `batchId` and `actor` (recommended; self-contained; a 120-pad batch is about as large as its `edits.apply`). (b) Only `{entity, id, version}` per op; browsers fetch the records with a new message type: smaller pushes, one more round trip per change and a new type in the contract.
2. **Records in the change hook.** Entry 1 is being built and fixes the `ChangeHook` signature. (a) Ask entry 1 now to pass the committed records (project, seq, batchId, actor, records) to the hook, so this story never edits `WriteService` (recommended; entry 2 rewrites `WriteService`). (b) Take whatever entry 1 passes; if it lacks the records, this story adds them to `WriteService` and rebases after entry 2.
3. **Missed events while the browser is disconnected.** (a) Caught at the next `map.changed` (gap, reload) or at the next page open; reload on Perspective reconnect deferred to epic-viewing, which sends the full value batch on reconnect (AD-6) (recommended). (b) Also reload on reconnect now: the client-side reconnect signal is unverified.

## Verification

**Commands:**
- `./gradlew build` -- expected: green, new Java and Jest tests included.
- `cd e2e && npm test` -- expected: all pass, `changes.spec` included, existing specs unchanged.
- `ops/logs.sh -n 400 | grep MapStudio.changes` -- expected: no warn or error during the e2e run.
- `git grep -nP '\x{2014}'` -- expected: no match.

**Manual checks (hitl, the owner):**
- The two `mapstudio-changes-*` screenshots: the viewer shows the editor's line, readable at 390 px.
- The new platform-checks section names the delivery path that worked.
