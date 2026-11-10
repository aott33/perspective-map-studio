---
title: "12c1: Details' Live now block and per-item path overrides"
type: 'feature'
ticket: ''
part_of: '12'
created: '2026-11-10'
status: 'draft'
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

**Problem:** In Edit mode an item's Details say nothing of what its kind setup makes it read, and one item whose tags sit elsewhere cannot be pointed at them without a script (R5).

**Approach:** Add DESIGN.md's Live now block at the foot of the Details tab: Comms, the key values (the icon value starred) and Alarms, each with its live value and its tag path, under a "From kind" tag. Each path can be overridden for this one item as a full path, marked Override with Reset. An override is part of the item, so it saves as an ordinary item edit: an Undo step, listed in Recent changes with Revert.

Decisions (owner, 2026-11-10, "go with recommended"): 12c is split: this plan, then 12c2 (the Style tab and the whole-rule override). (1) A key value's override changes its path only. (2) Changing an item's kind drops its overrides in the same save; Undo brings both back. (3) Undo and Recent changes name an override by its part ("Changed Point 2's Pressure path", "Reset Point 2's comms path"), no longer "style" for all. (4) "From kind" shows the path filled in for this item, which is also the starting text of an override. (5) Overrides the Gateway stores but does not apply (a link, popup view or tints override, a key the kind no longer has) stay stored and untouched, and are neither counted in the kind's header nor marked Override.

## Boundaries & Constraints

**Always:** Browser only: no Gateway, `common/` or contract version change. Level full, one item selected, Edit mode. **The block:** the section label "LIVE NOW" with the "From kind" tag; rows Comms, one per key value of the kind's setup in its order, Alarms; each row its name, the live value right-aligned (a key value with its unit, the icon value bold and starred; Comms and Alarms in the words the popup uses; Stale and Comms lost as the map says them), and the path in monospace under it. A key value switched off in the popup says so and shows no value. A kind with no setup: one line saying so with "Open <kind>'s setup", which opens Kinds at that kind (the selection kept). An unlinked item: the kind's paths as written, with a note that linking an asset fills them. **Override:** an Override button on a path row makes the path a text field starting from the filled path; saved on blur or Enter, Esc puts it back; the row then carries the Override tag (DESIGN.md's `override-tag`) and a Reset link, the others "From kind". Only a full path is taken: anything else says so beside the field in the Gateway's words and sends nothing. **Saving:** the item's whole `overrides` is sent, built from the newest (the ones in flight included) with only this row changed: a key value's override is its entry `{key, path}` in `kpis`, Comms' and Alarms' their part with the kind's switches kept; Reset removes the entry or part, and an emptied `kpis` goes. Every other stored part passes through untouched. A Gateway refusal's words stand beside the field without the "Op N (id): overrides:" prefix. Paused or busy as the other Details fields. **Count:** the kind's header and the preview note count what the Gateway applies (decision 5). Keyboard, 24 px targets, tokens only, no em dashes.

**Never:** The Style tab, the rule's override, "Edit the kind's rule" (12c2); the tag button (13); an override of a label, unit, switch or icon; overriding with a path under `{asset.path}`; a save button; a toast.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| L1 Block | P12 selected | Comms, Pressure (starred), Flow, Alarms with values and filled paths, "From kind"; values follow live updates | No error expected |
| L2 Override | Pressure's path set to P14's | Saved; Override and Reset on the row; P12 shows P14's pressure at the next live update; other pads unchanged; the kind's header counts it | No error expected |
| L3 Second key | Flow overridden too | Both stored | No error expected |
| L4 Reset | Reset on Pressure | "From kind" again, Flow's override kept; the last Reset leaves no `kpis` | No error expected |
| L5 Comms, Alarms | Each overridden, then reset | As L2 and L4, the kind's switches kept | No error expected |
| L6 Not full | `{asset.path}/X`, `Mesa/X` | The words beside the field | Nothing sent |
| L7 Refused | A path the Gateway refuses | Its words beside the field | The stored overrides stand |
| L8 Undo, History | After an override | Undo names it by its part and undoes it; Recent changes lists it so, with Revert | No error expected |
| L9 Kind change | An item with overrides changes kind | Saved with no overrides; one Undo restores kind and overrides | No error expected |
| L10 Unlinked | An unlinked pad | Paths as written, the note; an override still saves | No error expected |
| L11 Ignored parts | An item with a stored link override | Not marked or counted; still stored after another override is saved | No error expected |
| L12 No setup | An item of a kind with no setup | The line and the button to its setup | No error expected |

</frozen-after-approval>

## Code Map

- `web/typescript/studio/PropertiesPanel.tsx` -- one static Details tab :725-728; sections in order :729-848 (the block goes after Asset :822-846, before the footer :848); field save pattern `onKey` :492, `escaped`/`wasEscaped` :230, :334, in-flight tracking `newest`, `saving`, `sent`, `componentDidUpdate` :264-319; hooks `data-field`, `data-problem` :605; props wired in `MapStudio.tsx` :2202-2245; several selected never render it (`MapStudio.tsx` :2165-2176).
- `web/typescript/MapStudioStoreDelegate.ts` -- `editProperty` :1081, `propertiesFor`/`sentProperties` :1102-1125 (the model for overrides in flight), `sendUpdate` :1407, `sendBatch` :1421, `setKind` :1397 (keeps `overrides` today).
- `web/typescript/save.ts` `updateBatch` :75; `undo.ts` `DATA_FIELDS` :14-15 (overrides reversed whole); `undoStack.ts` `stepLabel` :189.
- `web/typescript/kindSetup.ts` -- `overridesText` :513-527, `PART_WORDS` :501, `headerSubline` :530, `hasOwnRule` :597, `isFullPath` :727, `refusalPlace` :424 (strips "Op N (id): " but not "overrides: "), the setup view readers; `placeholders.ts` `fill`.
- `web/typescript/history.ts` :228, :623 and `unsaved.ts` :804 -- every overrides change is "style" today.
- `web/typescript/live.ts` -- `ItemValues` :105 (`comms`, `kpis` by key, `alarms`), `KindDisplay` :144, `itemState`; the popup's words for comms and alarms (`DefaultPopup.tsx`).
- `web/typescript/studio.ts` `chooseKind` :137, `showSurface`; `MapStudio.tsx` `onRailSurface` :1325, `onChooseKind` :1937.
- Gateway rules, read only: `KindSetup.parse(overrides, kind, true)` (`ItemCheck.java` :59-63), the full-path words (`Placeholders.java` :151), the merge (`ValuePlan.java` :399-438: comms and alarms replaced whole when the path is full; `kpis` per key the kind has, `path` and `on` only).
- Tests: `e2e/tests/details.spec.mjs` helpers :48-87, `fixtures.mjs` (`editorTest`, `send`, `runSeed`), the `/live` buttons (`p14-pressure-high|low`, `pressure-low|high` for P12); `kinds.spec.mjs` :160 and `kindpreview.spec.mjs` :274-293 assert the count and the own-rule note; the seed re-seeds Point 2's overrides (`mapstudio_seed/code.py` :319).
- Docs: `docs/kind-setup.md` (item overrides), `docs/contract.md` (Details, test hooks), `CHANGELOG.md`, `docs/test-playbook-0.4.0.md` section 8n.

## Tasks & Acceptance

**Execution:**
- [ ] `web/typescript/itemOverrides.ts` (new, pure), with Jest, before the panel -- the block's rows from a setup, an item and its live values; one row's override or Reset onto the newest overrides; the full-path check; what is applied and counted; the words by part -- L1 to L7, L10 to L12.
- [ ] `MapStudioStoreDelegate.ts`, `history.ts`, `unsaved.ts`, `kindSetup.ts` -- `editOverride` with the overrides in flight, the kind change dropping them, the labels and sentences by part, the count -- L2 to L5, L8, L9, L11.
- [ ] `studio/PropertiesPanel.tsx`, `MapStudio.tsx`, `mapstudio.css` -- the block, the Override tag and Reset, the field; hooks `.mapstudio-livenow`, `.mapstudio-livenow-row[data-row]`, `[data-override]`, `.mapstudio-override-tag`, `.mapstudio-override-reset` -- L1 to L12.
- [ ] `e2e/tests/overrides.spec.mjs` (new) -- L1 to L12 at 1366 px, the seed and dev tags put back; screenshots of the block, an override and a refusal.
- [ ] Docs and playbook 8n.

**Acceptance Criteria:**
- Given P12 and P14 on the dev stack, when P12's Pressure path is overridden to P14's, then P12 shows P14's pressure at the next live update in every open map, and Reset returns it to its own.
- Given any override edit, then the item's other stored overrides are unchanged.

## Implementation Notes

- Planner, 2026-11-10: the environment, commit and identity rules are entry 8's plan's (Docker by hand after a restart, JDK 17 by apt if gone, `ops/up.sh --fresh` before a whole-suite run, no em dashes, never a bare `git stash`, never a push). Leave the work uncommitted: the orchestrator commits after the whole suite.

## Plan Change Log

## Review Triage Log

## Design Notes

An item update replaces `overrides` whole, so, as with a kind's setup, every edit starts from the newest overrides and changes one row; the conflict card's "Apply mine on top" already merges overrides part by part (`unsaved.ts` `mergeOnto`).

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK
- `ops/up.sh --fresh`, then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: 0 failed

**Manual checks (if no CLI):**
- The block's screenshots against DESIGN.md's Properties panel and the mock `key-screen-6-kinds-tags-override.png`; any departure goes to the owner before it is final.
