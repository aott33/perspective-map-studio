---
title: "13b: the tag browser's card and tree, with picks into a kind's Key values, Comms and Alarms"
type: 'feature'
ticket: ''
part_of: '13'
created: '2026-11-11'
status: 'draft'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'medium'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md', '{project-root}/docs/contract.md', '{project-root}/docs/kind-setup.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Every tag path of a kind's setup is typed by hand: the component never sends `tags.browse`, so an editor must know a tag's path by heart and learns of a slip only from the resolve note (R4).

**Approach:** Build Map Studio's own tag browser as DESIGN.md draws it (`components.tag-browser`): a floating card beside the panel with the For line, the Provider select and one provider's tree loaded a level at a time, driven by mouse or keyboard, with its loading, empty, unavailable and refused states. A tag button on each path of a kind's Key values, Comms and Alarms opens it at the preview item's asset folder; "Use this tag" saves the pick as a typed path is saved today.

Decisions (owner, 2026-11-11, "go with recommended"): entry 13 is split three ways; this is the card, the tree and the kind setup's three sections. A folder may be picked for Alarms only. The type column shows what the Gateway sends, with no value-source column.

Planner's picks, for the owner's approval: (1) a tag row's type reads "Tag", the others "Folder", "UDT instance", "UDT type", "Other"; the data type as sent. (2) The Path field shows the picked row's full path and is read-only until 13c makes it typed. (3) A pick is converted by the Gateway (`tags.resolve` with the full path and the preview item's asset): inside the asset folder the note shows `{asset.path}/...` and "Resolves for N of M <kinds>" with the failing names; outside it the shared-tag note; "Use this tag" waits for that answer. (4) The shared-tag warning on the row stays the resolve note it is today; no second tag. (5) For Alarms a folder or a UDT instance is a pick and the button reads "Use this folder". (6) A small spinner is added for the Loading row, still under reduced motion. (7) The dev tags gain one empty folder, `Site2/Yard/Spare`. (8) An asset folder that does not exist (the dev asset P14L) opens the provider's root with the Gateway's words in the note. (9) A truncated folder ends in the row "Showing the first 1,000." (10) A preview item with no asset opens the default provider's root, and every pick is a full path. (11) Backlog 39's "each failing name opens its item" is not built here.

## Boundaries & Constraints

**Always:** **The button:** a tag icon button ("Pick a tag") at the end of each path input of Key values (the new row too), Comms and Alarms; the row the card is open for takes `selection-tint` with the 3 px `selection` edge. **The card:** one at a time, 380 px, at the stage's left edge beside the panel, DESIGN.md's tokens; header "Pick a tag" with a close; "For: Key value 2 of the Well pad kind", "For: Comms of the Well pad kind", "For: Alarms of the Well pad kind"; Cancel, the close, Esc, another kind, another surface or leaving Edit mode close it and change nothing; focus goes into the tree on opening and back to the tag button on closing. **Provider:** the reply's `providers`, the default first with a "Default" tag; a change shows that provider's root; outside the asset folder a ghost "<name> folder" button returns to it. **Tree:** one `tags.browse` per folder opened, answers kept while the card is open; rows as DESIGN.md (24 px, 16 px indent, chevron on what has children, type glyph, name, type, data type); the asset folder opened and marked "Asset folder", its rows guided; `role="tree"` with roving focus: Up and Down move, Right opens or steps in, Left closes or goes to the parent, Home and End, Enter or Space picks, a click picks and a chevron click opens. **States:** "Loading..." with the spinner under the folder being opened, the rest usable; "No tags in this folder"; a folder picked where only a tag will do shows "Pick a tag, not a folder." with the button inert; `tags-unavailable` or no answer in 15 s on the first load replaces the tree with "Can't browse <provider>", the sentence and "Try again", on a folder shows the words under it with "Try again"; `role` or `invalid` shows the Gateway's words in place, no retry for `role`. **The pick:** saved as one `SetupEdit` built on the newest stored setup, carrying the version seen when the card opened, so another editor's save meets the conflict; then the card closes and the row shows the path and its resolve note. Words brief and plain; no em dashes. Docs (`contract.md`, `kind-setup.md`, `CHANGELOG.md`), DESIGN.md and EXPERIENCE.md where the build departs, and playbook section 8q.

**Never:** The style rule's path, popup params, an item's overrides, a typed Path field or its conversion (13c); a TypeScript copy of `TagPaths.resolve`; a new message type or field; reading a tag's value; a tag button for anyone but the full editing role; a contract version bump.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| B1 Open | Well pad, preview P14, the tag button of a key value | Card at `[default]Mesa/P14`, opened, marked, Pressure listed as Tag, Float8 | No error expected |
| B2 Pick inside | Pressure, Use this tag | `{asset.path}/Pressure` saved; "Resolves for 4 of 5 well pads. Not for Point 3." | No error expected |
| B3 Pick outside | `Plant/AmbientTemp` | The shared-tag note; the full path saved; the row's note says the same | No error expected |
| B4 Folder | A folder picked for a key value or Comms | "Pick a tag, not a folder."; button inert | Nothing saved |
| B5 Alarms | The folder `Mesa/P14` picked for Alarms | "Use this folder" saves it; a tag saves too | No error expected |
| B6 Provider | Site2 chosen | Its root; `Yard/WindSpeed` picks as a full path; the folder button returns to P14 | No error expected |
| B7 Keyboard | Keys only, from the tag button | The tree is walked and Enter then the button saves a pick; Esc closes, focus on the tag button | No error expected |
| B8 Loading, empty | A slow folder; `Site2/Yard/Spare` | The Loading row, then rows; "No tags in this folder" | No error expected |
| B9 Stopped provider | Site2 stopped, then chosen | "Can't browse Site2", Try again; started again, Try again lists it | The select still offers the others |
| B10 Refused | A reply `role`; a folder that is gone | The Gateway's words in the card or under the folder | Nothing saved; no button for a viewer |
| B11 Conflict | Another editor saves the setup while the card is open | The pick meets the existing conflict card | Nothing overwritten |
| B12 No asset | The preview item unlinked | The default provider's root; picks are full paths | No error expected |

</frozen-after-approval>

## Code Map

- `web/typescript/messages.ts` -- `TAGS_BROWSE`, `TAGS_BROWSE_REPLY` constants :34 exist; no sender, no `Reply` variant (`readReply` answers "Unknown reply type" :266). Copy `tagsResolve` :160 and the resolve reader :224-242.
- `web/typescript/MapStudioStoreDelegate.ts` -- `askResolve` :650, `resolveAsks` :387, `RESOLVE_TIMEOUT_MS`, `onResolveReply` :676, routing in `handleEvent` :2068 (match errors by id before the `map.load` and `edits.apply` branches; test-hook replies are taken first, `takeTestReply` :2039). The browse asks follow this pattern.
- `web/typescript/studio/KindSetupPanel.tsx` (1337 lines; add little) -- key value path input :743-749, `renderNewRow` :671, `field()` :1165 with `.mapstudio-kindsetup-with-picker` :1176 (the button's slot), Comms :1230, Alarms :1237; saving `text()` :471, `commit()` :349, `send(field, SetupEdit, seen)` :315, `this.seen` :340; `note()` :450.
- `web/typescript/kindSetup.ts` -- `SetupEdit` :129, `applyEdit` :198, `previewOptions`, `previewOf` :559-583 (`folder` is the asset's base path), `isFullPath` :809, `resolveNote` :823 (reuse its words in the card's note).
- `web/typescript/MapStudio.tsx` -- `MapStudioState` :146, `studioOn()` :1283 (full role), the stage :2573-2575 (the card is absolute at its left edge), `onRootKeyDown` :1223 (Esc while Kinds is open).
- Models: `studio/SaveCard.tsx` (floating card, Esc, `returnTo`; CSS `mapstudio.css` :4931), `studio/UndoGroup.tsx` `focusRow` :241 (roving focus). No tree and no spinner exist. Tokens: `--mapstudio-selection-tint`, `--mapstudio-divider`, `--mapstudio-surface`, `--mapstudio-hover`, `--mapstudio-warning`; warning tint is the `color-mix` at :2959.
- `web/typescript/controls.ts` `GLYPH_PATHS` -- no tag, folder, UDT, cloud glyphs; `controls.test.ts` checks every entry.
- Gateway (do not change): `TagLookups.browseReply` :74-121, `TagChild.toJson`, types `folder`, `tag`, `udt-instance`, `udt-type`, `other`, 1000 children, `truncated`.
- Tests: Jest in `web/typescript/__tests__` (node; components by `renderToStaticMarkup`; `kindSetupDelegate.test.ts` :378, `messages.test.ts`); `e2e/tests/kinds.spec.mjs` helpers :76-86, `tags.spec.mjs` with `setTagProviderEnabled` (`e2e/lib/gateway.mjs` :53), `shot()` (`lib/env.mjs` :34).
- Dev tags: `ops/config/core/ignition/tag-definition` (`default`: Mesa P12, P14, CTB1, SWD1 as UDT instances, P15 a folder, Plant; `Site2`: Yard). Asset P14L's base path `[default]Mesa/P14/Lease` does not exist.
- Docs: `docs/kind-setup.md` :25, `docs/contract.md` :80 and :263, `CHANGELOG.md` :40, playbook `## 8p` :414 (its line on the stopped provider points here).

## Tasks & Acceptance

**Execution:**
- [ ] `web/typescript/messages.ts`, `messages.test.ts` -- the `tags.browse` sender and reply reader -- nothing reads it today.
- [ ] `web/typescript/MapStudioStoreDelegate.ts`, a delegate test -- browse asks by id with the 15 s limit, answers and errors per provider and folder, cleared when the card closes; the pick's `tags.resolve` -- B1, B8 to B10.
- [ ] `web/typescript/tagBrowser.ts` (new, pure), `tagBrowser.test.ts` -- the tree's state: rows in view, open folders, focus moves per key, what is a pick per target, the note's words, the For line -- B4, B5, B7, B12, tests first.
- [ ] `web/typescript/studio/TagBrowser.tsx` (new), `controls.ts`, `mapstudio.css`, a markup test -- the card, the tree, the states, the glyphs, the spinner -- B1 to B10.
- [ ] `web/typescript/studio/KindSetupPanel.tsx`, `MapStudio.tsx` -- the tag buttons, the open row's tint, the card's place and closing, the pick saved through `send` with the seen version -- B2, B3, B5, B11.
- [ ] `ops/config` (`Site2/Yard/Spare`), `e2e/tests/tagbrowser.spec.mjs` (new), `tags.spec.mjs` if its Site2 listing changes -- B1 to B12 live, with screenshots of each state.
- [ ] `docs/contract.md`, `docs/kind-setup.md`, `CHANGELOG.md`, DESIGN.md and EXPERIENCE.md (the type words, the read-only Path field, "Use this folder"), `docs/test-playbook-0.4.0.md` section 8q.

**Acceptance Criteria:**
- Given a full editor on the dev Gateway, when they open the browser from a key value and pick Pressure by keyboard alone, then the row holds `{asset.path}/Pressure` with its resolve note and one Undo-free setup save is recorded as a typed path would be.
- Given a viewer or a phone editor, when the map is open, then no tag button is drawn and no `tags.browse` is sent.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

The tree's logic lives in a pure module because Jest here renders markup only; the keyboard and focus are proved by the e2e spec. The Gateway stays the one place a full path becomes `{asset.path}/...`, as the owner ruled for the style rule (no TypeScript port).

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK
- `ops/up.sh --fresh`, then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: 0 failed
