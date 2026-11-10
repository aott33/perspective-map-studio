---
title: "12a: the Kinds surface and a kind's setup (Icon, Key values, Comms, Alarms, Popup)"
type: 'feature'
ticket: '12'
created: '2026-11-09'
status: 'built'
baseline_revision: 'dec0579510c87604ac6c12c65726f7f920a9ee19'
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

**Problem:** A kind setup can be saved only by a script or the test hook: the rail's Kinds surface is a placeholder, so a map editor cannot say what a kind's items show (R4).

**Approach:** Build Kinds as DESIGN.md's Kind setup and key screen 6: the dock lists the project's kinds, and the chosen kind's setup opens in the properties panel's place with the header (preview item, override count) and the sections 1 Icon, 2 Key values, 3 Comms, 4 Alarms, 5 Popup. Each field saves when it is finished, as a `kindSetup` op through `edits.apply`. Entry 12 is split (owner, 2026-11-09): the Style rule section and tints are 12b, per-item overrides 12c; icon, size and label stay read-only (backlog 38); a kind setup save is not an Undo step.

Decisions (owner, 2026-11-09, "take all of a to e, pick 6 C, approve and continue", after the room): (1) a key value row edits label, path and unit; its `key` is made from the label when the row is first saved (letters and digits, a number added on a clash, never empty, at most 64 characters) and never changes after. (2) Remove is off for a key value the style rule uses, saying "Used by the style rule". (3) Alarms shows the project's View alarms link read-only, in one line saying it is set in the Designer. (4) The resolve note says N of M; listing the items a path fails for is backlog 39. (5) The preview item is the kind's first linked item by name, remembered per kind for the browser session, not stored. (6) A kind setup's conflict card offers only "Use <name>'s version"; "Apply mine on top" is hidden for setups, to be weighed again in 12b. (a) The save path and its tests are built before any panel; the pass-through test runs over all five seed setups, each part edited in turn. (b) With no linked item of the kind, one note under the Preview item select says so and no note stands under the paths. (c) A refusal shows the Gateway's words without the "Op N (id): where:" prefix, placed by the order the rows were sent in. (e) A field being typed in is never overwritten by another editor's live change: the other fields follow the store, the focused one keeps its text and meets the conflict on save. The plan stays whole (about 3,000 tokens).

Decision (owner, 2026-11-10, "go with recommendation", after the review's finding 3): an emptied Comms or Alarms path removes that part; an emptied Popup view path removes the part only when it has no params, and is refused in the browser while it has any, with words beside the field saying to remove its params first, nothing sent and the stored view kept. The departures from key screen 6 the owner was shown stay as built.

## Boundaries & Constraints

**Always:** Browser only: no Gateway, `common/` or contract version change. Edit mode, level full, 768 px and wider. **List:** the note "Setup applies to every item of a kind. Items can override."; one row per kind of the kind list with its glyph, name, geometry and item count; the kind list's and the asset list's status message above the rows while either is not ok (the item form's words). **Setup panel:** shown while Kinds is open, in place of an item's properties (the selection is kept and returns with Items). Header: glyph, name, "Point - applies to 5 items - 1 override (P2 comms)", the Preview item select (name and asset folder in monospace). Sections numbered as DESIGN.md. Icon: the kind's icon, read-only, saying it comes from the kind list. Key values: up to 4 rows; Add absent at 4. Comms: the heartbeat path and its popup switch. Alarms: the alarm source path. Popup: checkboxes Comms, Alarm count, Alarm summary and "Order is fixed: comms, values, alarms"; the link; the popup view path and its params (name and value rows); a placeholder picker on the link and each param value listing the closed list with the kind's field keys. 6 Style rule: one read-only line of what is stored, until 12b. **Saving:** a field saves on blur or Enter, a switch at once; no save button. The op carries the whole setup: the stored one with only the edited part changed, `styleRule`, `areaTints` and unknown-to-this-screen values passed through untouched; a create at version 0 when the kind has none. One save per kind in flight, later edits sent after it at the version its reply gave. **Refusals:** an `invalid` reply's words ("Op N (id): where: words") show beside the field `where` names (else at the panel's top), the field keeps what was typed and the stored setup stands. A conflict, store-unreachable and busy behave as entry 10 (fields paused with its words). **Resolve notes:** under each tag path, from `tags.resolve` with the preview item's asset, asked when the path is saved or the preview item changes: "Resolves for 3 of 5 well pads" (the warning token when fewer than all), a full path "Same tag for every well pad" in the warning token, a failed check in words. Keyboard throughout; 24 px targets; tokens only; no em dashes.

**Never:** The Style rule editor, area tints, the Preview word on the map (12b); the Style tab, Override and Reset (12c); the tag button and browser, or tightening the save's tag path rule (13); editing icon, size, label; adding or removing kinds; Undo or Revert of a setup save; a toast.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| K1 List | Rail Kinds on the dev field | Six kinds with geometry and counts; the first opens | Adapter set to incomplete: its message shows |
| K2 Key value path | Well pad, Pressure's path changed | Saved; every pad's icon value follows within one refresh interval | No error expected |
| K3 Rows | Add a fourth, star it, switch one off | Add gone at 4; one star only; the popup drops the switched-off value | A row without a label or path is not sent and says what is missing |
| K4 Comms, Alarms, parts | Paths and checkboxes changed | Saved; a pad's popup follows | No error expected |
| K5 Link refused | Link `//x` | Gateway's words beside Link | Stored link unchanged |
| K6 Param refused | A param named `mapItem`; a value `a {item.name}` | Gateway's words beside that param | Nothing saved |
| K7 Picker | Insert `{item.name}` into a param | Value holds it; saved | No error expected |
| K8 Resolve | `{asset.path}/Pressure`; `[default]Shared/GasPrice` | "Resolves for N of M well pads"; "Same tag for every well pad" | No linked item of the kind: one note under the Preview item select, none under the paths |
| K9 First setup | A kind with no setup | Saved as a create; first-run step 1 ticks | No error expected |
| K10 Kept parts | Each part edited in turn on each of the five seed setups | Every other part stored unchanged | No error expected |
| K11 Two editors | B saves the kind while A types in a field, then A finishes it | A's typed text stays while B's other fields appear; A's save is refused, the conflict card names B and offers only "Use B's version" | Nothing lost silently |
| K12 Not an undo step | After a setup save | Undo names the same step as before; History lists the save with no Revert | No error expected |

</frozen-after-approval>

## Code Map

- `web/typescript/MapStudio.tsx` -- `renderDock` :1833 (Kinds placeholder :1861-1870), `renderHistory` :1883 (the header-prop model), `renderPanel` :1974 (no surface check today), mount :2177-2178, `onRailSurface` :1310, `onFirstRunKinds` :2095, first-run tick :2131 (`firstRun.ts:55`).
- `web/typescript/MapStudioStoreDelegate.ts` -- `kindSetups` :172, :391 (from `changes.ts` :50, :133-143; a kind setup's version moves only on `map.changed`: take it from the reply's `results` too); `lists.kinds`, `lists.adapters` (`adapters.ts` :24-44); `sendBatch` :574 (`label === null` adds no undo step; the send key may be the kind id), replies :1721-1798, `refusedSave`, `savePaused` :379, `pausedFor` :1175; the history read :1631 as the model for a `tags.resolve` request, reply and timeout.
- `web/typescript/messages.ts` -- type constants :34-37 (no production sender for `tags.resolve`), `editsHistory` :125 as the builder model, error body :200-216 (`op {index, id}`, `message`).
- `web/typescript/contract.ts` -- `KindSetupRecord` :74 (`setup` untyped), `KindSetupOp` :86-103; add the typed parts.
- `web/typescript/itemForm.ts` -- `assetListNote` :193, `kindListNote` :234; `studio/PropertiesPanel.tsx` :844 (the status row's look), its field and switch styles.
- `web/typescript/placeholders.ts` -- the closed list and `isAssetRelative`; `unsaved.ts` -- `editLabel` :515, kind setup conflict words :678, `onTopBatch` ~:846 and `onTopBlockedText` (items only; hide the choice for a setup).
- `web/typescript/studio/HistoryPanel.tsx` -- the panel pattern (props, test classes in the doc comment); `mapstudio.css` `.mapstudio-dock` :2460, panel widths :2384-2394.
- Java, read only: `KindSetup.java` (`PARTS` :38, `parse` :64-117, messages via `InvalidValue.at`), `Placeholders.checkParam` :119, `WriteService.writeKindSetup` :328 (refusal format :437), `TagLookups.java` :116-183.
- Tests: Jest in `web/typescript/__tests__/` (`history.test.ts`, `historyDelegate.test.ts` as models); e2e `fixtures.mjs` (`editorTest`, `openMap`, `send`, `runSeed`), `kindsetup.spec.mjs` :51 `setupOp`, `details.spec.mjs` :64 `press(page, 'incomplete', ...)`; `studio.spec.mjs` :194-196 and `firstrun.spec.mjs` :133 assert the placeholder and change. Dev kinds: pad, line, geofence, tap, valve, meter (`ops/project/ignition/script-python/mapstudio_dev/code.py`; seed setups in `mapstudio_seed` :211).

## Tasks & Acceptance

**Execution:**
- [ ] `web/typescript/kindSetup.ts` (new, pure), with its Jest, before any panel -- typed setup parts; read with defaults; the edit of one part onto the stored setup; the create or update batch; key from label; refusal `where` to field; override count and words; resolve note words -- K2 to K10.
- [ ] `web/typescript/messages.ts`, `MapStudioStoreDelegate.ts` -- `saveKindSetup` (one in flight per kind, version from the reply, no undo step, refusals kept per kind), `tags.resolve` sender and notes state -- K2, K5, K6, K8, K11, K12.
- [ ] `web/typescript/studio/KindList.tsx`, `studio/KindSetupPanel.tsx` (new), `MapStudio.tsx`, `studio.ts`, `mapstudio.css` -- the list in the dock, the panel in the properties slot, the chosen kind and preview item in studio state; test hooks `.mapstudio-kinds`, `.mapstudio-kind-row[data-kind]`, `.mapstudio-kindsetup`, `[data-section]`, `[data-field]`, `.mapstudio-field-refusal`, `.mapstudio-resolve-note` -- K1 to K9.
- [ ] `web/typescript/unsaved.ts` -- a setup's conflict card without "Apply mine on top" -- K11.
- [ ] Jest -- every matrix row's logic, the whole-setup pass-through first.
- [ ] `e2e/tests/kinds.spec.mjs` (new) -- K1 to K12 at 1366 px, the seed restored after; screenshots of the list, the panel's sections and a refusal; `studio.spec.mjs`, `firstrun.spec.mjs` updated.
- [ ] `docs/contract.md` (the Kinds surface, test hooks), `docs/kind-setup.md` (saved from the screen), `CHANGELOG.md`, `docs/test-playbook-0.4.0.md` section 8k; `_bmad-output/backlog/` story 39 (the items a path does not resolve for; a contract change).

**Acceptance Criteria:**
- Given the dev stack and a map editor, when the Well pad setup's icon key value is changed in Kinds, then every pad's icon value changes within one refresh interval with no reload, and the kind's style rule is stored as it was.
- Given a refused value, when the Gateway answers, then its words stand beside that field and nowhere says Saved.

## Implementation Notes

- Planner, 2026-11-09: the environment, commit and identity rules are entry 8's plan's (Docker by hand after a restart, JDK 17 by apt if gone, `ops/up.sh --fresh` before a whole-suite run, the session's trailers, `git commit --only`, no em dashes, never a bare `git stash`, never a push). A Gradle download refused 429 passes on a retry with backoff. The orchestrator is bringing Docker, the JDK and the Gradle cache up while the code is written; run the new and changed e2e specs once the stack answers.

## Plan Change Log

- 2026-11-09 (implementer): a kind setup save answered `invalid` leaves the unsaved queue once its words stand beside the field (the delegate's `kindSaves`), so no "1 edit not saved" row or Try again shows for it; the dock header says "Not saved" while such a refusal stands (`problems.ts` `kindRefused`) and the words go when the field is saved again, put back with Esc, or the panel is left. A conflict, the store unreachable and busy stay in the queue as entry 10's.
- 2026-11-09 (implementer): decision (e) is carried by a version, not by the panel's copy: a draft remembers the setup version of its first keystroke, the delegate knows its own kind setup batches by id (their `map.changed` is not another editor's; a setup that moved across a reload is counted as another editor's), and a field typed before another editor's save is sent at the version it was typed on, with the setup still built from the newest stored one. The Gateway then answers the conflict.
- 2026-11-09 (implementer): a create at version 0 that meets a setup deleted before anyone here typed (the conflict's `current.deleted`) is sent again once at the tombstone's version, which restores it. Without it the first setup of a kind whose setup was once deleted (the empty project after firstrun.spec, any kind a script cleared) could never be saved from the screen. Not in the matrix.
- 2026-11-09 (implementer): a full path's "Same tag for every well pad" is said without asking `tags.resolve`: the path is stored as typed (the conversion is entry 13's), so it is one tag for every item whatever the reply says. Paths below the asset are asked as the plan has it.
- 2026-11-09 (implementer): a `comms`, `alarms` or `popupView` path typed empty removes that part, and an empty link removes `link` (the schema takes no part without its path); the popup's Comms, Alarm count and Alarm summary and Add a param are off, saying why, until their path is set. The Comms section's switch and the Popup's Comms checkbox are one value (`comms.on`).
- 2026-11-10 (implementer): by the owner's decision of 2026-11-10 an emptied Popup view path removes the part only when it has no params; with params it is refused in the browser ("Remove its params first. The popup view is kept."), nothing sent. This replaces the popup view half of the entry above; an emptied Comms or Alarms path stays as built.
- 2026-11-09 (implementer): a new key value row and a new param row are saved when the cursor leaves the row or on Enter, not per field, so a row is first sent whole (its key made then) and never loses the cursor to its own save. A stored row saves per field. Params are saved as single edits (add, value, name, remove) on the stored params.
- 2026-11-09 (implementer): while Kinds is open the Delete key and Esc outside a field leave the selected item and the selection be, since its Details is not shown ("the selection is kept and returns with Items").
- 2026-11-09 (implementer): departures from DESIGN.md's Kind setup and key screen 6, for the owner: the line under Preview item says what it does today ("each tag path is checked for this item's asset.") in place of "Tag browser opens at its asset folder; the style rule previews on it, on the map too." (entries 13 and 12b); the Preview item label sits above its select, not beside it (the option holds the name and the folder at 320 px); a list row reads "Point - 37 items" where the mock reads "Point - 3"; the dock's title is "Kinds" with the save status beside it, as the Layers and History docks name themselves; key value rows have no tag button and no "Pick a tag" (entry 13), and Remove is the delete icon; the Popup section has no "Custom view" checkbox: the popup view's path and params are fields.
- 2026-11-09 (implementer): backlog story 39 was already written with the plan's approval (`_bmad-output/backlog/story-the-items-a-tag-path-does-not-resolve-for.md`); nothing was added to it.

## Review Triage Log

### Pass 1 (quick lens, 2026-11-10): 7 findings - 2 medium, 4 low, 1 false; 4 patches, 1 to the owner, 1 rejected

| # | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|
| 1 | A setup deleted (by a script) while the page is open cannot be saved from the screen again until a reload: every create at 0 meets the tombstone and the restore is refused because `kindForeign` holds the delete's version | medium | patch | Confirmed: `onMapChanged` records every kind setup op's version, `kindRefused` restores only when `kindForeign <= flight.seen`, and the panel's version is 0 with no stored setup. Fix: a delete seen in `map.changed` is the tombstone to restore at, not a foreign version. |
| 2 | A new key value row or param that met a conflict stays with its first `seen`, so every later finish conflicts again | medium | patch | Confirmed: `setRow` and `setParam` keep `seen` once set (`KindSetupPanel.tsx:561`, `:719`) and nothing resets it after "Use their version". Fix: the row's `seen` is taken again once its conflict is settled. |
| 3 | Clearing the Popup view path removes the part with every stored param in one save, with no Undo; an empty comms or alarms path drops the part's switches | low | intent gap, to the owner | Real, and the implementer's own choice (Plan Change Log): the Gateway needs a path for each of these parts, so an empty one must remove the part or be refused, and the frozen text does not say which. Asked of the owner without reverting the build, since either answer is a few lines. Answered 2026-11-10 (option B): patched. |
| 4 | This page's own setup save replayed after a reload (or lost in a gap) counts as another editor's, so a field typed before its `map.changed` conflicts with the editor's own change | low | rejected | Real but narrow: it needs a queued setup save replaying and a field of the same kind typed in the moment before its `map.changed`; the card's one choice recovers it. The fix (persisting the batch ids) is more than a direct correction. |
| 5 | `kindSaved` moves on to the next edit at a stale version when `results` holds no entry for the kind | false | rejected | `WriteService` answers one result per op of a saved batch, so a saved setup batch always carries its result; the branch is not reachable. |
| 6 | `refusalPlace` leaves "Op 0:" on the Gateway's messages that carry no "(id)" | low | patch | Confirmed: `WriteService.java:278`, `:287`, `:322` write "Op N: ..."; `OP_PREFIX` needs the parenthesis. Fix: the id optional in the pattern. |
| 7 | The Kinds header can read "Saved" while its class and `data-save-state` say refused | low | patch | Confirmed: `renderKinds` takes the words from `headerSaveWords` and the state from `delegate.save.state`. Fix: one source for both. |

Outcome (2026-11-10): four patches applied (findings 1, 2, 6, 7) and the owner's option B for finding 3 (an emptied Popup view path refused while it has params); findings 4 and 5 rejected. The orchestrator's Verification on the final code: tsc clean, Jest 868 passed, Gradle clean build offline passed, contract check OK, `ops/up.sh --fresh` and the whole e2e suite 300 passed, 0 failed, 8 skipped (the env-gated scenarios). No Gateway, `common/` or Ignition file changed. Status built; entry 12 continues with 12b and 12c.

## Design Notes

The whole-setup replace is the main hazard: every save starts from the newest stored setup for the kind (after the in-flight save's reply), never from the panel's copy of other parts.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK
- `ops/up.sh --fresh`, then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: 0 failed

**Manual checks (if no CLI):**
- The surface's screenshots against DESIGN.md's Kind setup and key screen 6; any departure goes to the owner before it is final.
