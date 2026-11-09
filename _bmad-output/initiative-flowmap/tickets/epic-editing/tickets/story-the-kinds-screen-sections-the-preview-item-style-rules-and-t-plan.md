---
title: "12a: the Kinds surface and a kind's setup (Icon, Key values, Comms, Alarms, Popup)"
type: 'feature'
ticket: '12'
created: '2026-11-09'
status: 'ready-for-dev'
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

**Problem:** A kind setup can be saved only by a script or the test hook: the rail's Kinds surface is a placeholder, so a map editor cannot say what a kind's items show (R4).

**Approach:** Build Kinds as DESIGN.md's Kind setup and key screen 6: the dock lists the project's kinds, and the chosen kind's setup opens in the properties panel's place with the header (preview item, override count) and the sections 1 Icon, 2 Key values, 3 Comms, 4 Alarms, 5 Popup. Each field saves when it is finished, as a `kindSetup` op through `edits.apply`. Entry 12 is split (owner, 2026-11-09): the Style rule section and tints are 12b, per-item overrides 12c; icon, size and label stay read-only (backlog 38); a kind setup save is not an Undo step.

Decisions (owner, 2026-11-09, "take all of a to e, pick 6 C, approve and continue", after the room): (1) a key value row edits label, path and unit; its `key` is made from the label when the row is first saved (letters and digits, a number added on a clash, never empty, at most 64 characters) and never changes after. (2) Remove is off for a key value the style rule uses, saying "Used by the style rule". (3) Alarms shows the project's View alarms link read-only, in one line saying it is set in the Designer. (4) The resolve note says N of M; listing the items a path fails for is backlog 39. (5) The preview item is the kind's first linked item by name, remembered per kind for the browser session, not stored. (6) A kind setup's conflict card offers only "Use <name>'s version"; "Apply mine on top" is hidden for setups, to be weighed again in 12b. (a) The save path and its tests are built before any panel; the pass-through test runs over all five seed setups, each part edited in turn. (b) With no linked item of the kind, one note under the Preview item select says so and no note stands under the paths. (c) A refusal shows the Gateway's words without the "Op N (id): where:" prefix, placed by the order the rows were sent in. (e) A field being typed in is never overwritten by another editor's live change: the other fields follow the store, the focused one keeps its text and meets the conflict on save. The plan stays whole (about 3,000 tokens).

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

## Plan Change Log

## Review Triage Log

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
