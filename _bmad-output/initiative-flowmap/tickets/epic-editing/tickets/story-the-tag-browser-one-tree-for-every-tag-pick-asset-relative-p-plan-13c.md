---
title: "13c: the tag browser for the style rule, popup params and an item's overrides, and the typed Path field"
type: 'feature'
ticket: ''
part_of: '13'
created: '2026-11-12'
status: 'built'
baseline_revision: '6ca752cf86f937443399d86d8dd148b2c79d4bb1'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md', '{project-root}/docs/contract.md', '{project-root}/docs/kind-setup.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The tag browser of entry 13b serves only a kind's Key values, Comms and Alarms, and its Path field is read only. The style rule's tag path, popup params, an item's override rows and an item's own rule are still typed by heart, and a path cannot be typed in the card when a provider cannot be browsed (R4).

**Approach:** Give the same card four more targets, each with its own "For:" line, opening folder and saving rule, and make the Path field typed: a typed path is answered by the Gateway (`tags.resolve`) exactly as a tree pick is, and saved the same way.

Decisions (owner, 2026-11-12, "approve and continue" on the plan and its thirteen picks; kept as one part): (1) the card sends a typed path to the Gateway and saves what comes back; a full path and `{asset.path}/...` both work. (2) A typed path is asked after a short pause or on Enter; the button waits for the answer. (3) Typing drops the tree's pick and the tree does not move; a click on a row replaces the typed text. (4) A bad typed path shows the Gateway's words, button inert. (5) An override's tag button sits beside the input, once Override or Change is pressed. (6) An override and an item's own rule always save the full path, "Saved for P14 only, as the full path", button "Use for P14"; the override is one Undo step as today. (7) `{asset.path}/...` typed for an item is refused with the override check's words. (8) An item with no asset opens the default provider's top; full-path picks. (9) A pick into a style rule goes into the draft, saved when the rule is complete, else "Not saved yet". (10) Popup params: inside the folder `{asset.path}/suffix`, outside the full path; no resolve note on param rows. (11) The For lines as Boundaries has them. (12) On Items the card sits in the same place and also closes when the selected item changes. (13) Backlog 39's link is not built here.

## Boundaries & Constraints

**Always:** **The button:** the 13b tag button beside the style rule's tag path (kind and item), each popup param's value (the new row too) and an override row's input in Live now; full editing role only. **Kind targets** (style rule, popup param) open at the preview item's asset folder and convert as 13b does: inside it `{asset.path}/...`, outside it the full path with the shared-tag note. **Item targets** (an override row, the item's own rule) open at that item's own asset folder (the default provider's top when it has no asset); every pick is the full path; the note reads "Saved for P14 only, as the full path"; the button reads "Use for P14". **For lines:** "For: Style rule of the Well pad kind", "For: Popup param wellId of the Well pad kind", "For: Casing pressure on P14 only - an override", "For: Style rule of P14 only". **Saving:** each pick goes through the path its typed twin takes today: the rule editor's draft (saved when the rule is complete, else "Not saved yet"), the param's value edit or new-row commit, the override's edit (one Undo step). **The Path field:** typed or filled by a tree pick; a typed path drops the tree's pick, is asked of the Gateway after a short pause or Enter, and the note and the primary button follow that answer as for a pick; the Gateway's refusal shows its words and saves nothing; where no asset can be asked (no linked item, an item target) the browser's own full-path check answers. It works while the tree is loading, empty, unreachable or refused. **Closing:** as 13b, and also when the selected item changes. Words brief and plain; no em dashes. Docs, DESIGN.md and EXPERIENCE.md "as built", playbook section 8r.

**Never:** A TypeScript copy of `TagPaths.resolve`; a new message type or field; a contract version bump; a resolve note on popup param rows; a folder as a pick outside Alarms; backlog 39's link from a failing name to its item; a change to who may browse.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| C1 Kind rule | Well pad, States from a tag path, pick `P14/Status` | The draft holds `{asset.path}/Status`; saved if the rule is complete | "Not saved yet" otherwise |
| C2 Param inside | A stored param, pick `P14/Pressure` | `{asset.path}/Pressure` saved as its value | No error expected |
| C3 Param outside, new row | A new param row, pick `Plant/AmbientTemp` | The full path fills the value; the row commits as when typed | A row with no name stays a draft |
| C4 Override | P14, Live now, Override on a row, pick in P14's folder | The full path saved, marked Override with Reset; one Undo step | No error expected |
| C5 Own rule | P14's Style tab, a rule from a tag path, pick | The full path in the draft; saved when complete | "Not saved yet" otherwise |
| C6 Item, no asset | An unlinked item's override | The default provider's top; full-path picks | No error expected |
| C7 Typed full path | Key value card, type `[default]Mesa/P14/Pressure` | The note shows `{asset.path}/Pressure` with "Resolves for 4 of 5 well pads. Not for Point 3."; the button saves it | No error expected |
| C8 Typed relative | Type `{asset.path}/Pressure` | The same note and save | On an item target: the override check's words, button inert |
| C9 Typed bad path | Type `[default]Mesa//P14` | The Gateway's words in the note; button inert | Nothing saved |
| C10 Unreachable | Site2 stopped and chosen, then a path typed | "Can't browse Site2" stays; the typed path is answered and saved | No error expected |
| C11 Typed then picked | Type a path, then click a tree row | The field shows the row's path; the note follows the row | No error expected |
| C12 Selection moves | The card open for P14's override, another item selected | The card closes; nothing saved | No error expected |

</frozen-after-approval>

## Code Map

- `web/typescript/tagBrowser.ts` (536) -- `PickTarget` :17 (`part: 'kpi'|'comms'|'alarms'`), `canPick` :335, `pickProblem` :340, `useText` :351, `forLine` :367, `cardNote` :461 (needs a `TagChild` today; must take a typed path), `TagFor` :516, `readTagFor` :524, `assetFolderOf` :85. Add the parts here, pure, tests first.
- `web/typescript/studio/TagBrowser.tsx` (458) -- the Path input :413-417 `readOnly`, fed by `state.tree.picked`; `pick()` :216-224 calls `onAskPick` only with an asset; `onCardKey` :284 (Esc). `answers.picks` is keyed by full path :347.
- `web/typescript/MapStudioStoreDelegate.ts` -- `askPick(kindId, assetId, path)` :815, `onPickReply` :837 (`PickAnswer`: `path, relative, n, m, failing, failingMore`); an error reply for a pick must reach the card with its words. `mayBrowse` :729.
- `web/typescript/MapStudio.tsx` (2842) -- `tagPick {kindId, tagFor, target, seen}` :188, `tagPickShown` :2203 (Kinds surface only: widen to Items with an item id), `dropTagPick` :2214, `onTagBrowse` :2221, `onTagUse` :2253 (only `kindPanel.usePick`), `focusTagButton` :2239, `renderTagBrowser` :2286, `onOverride` :1974, `onStyleRule` :2040.
- `web/typescript/studio/KindSetupPanel.tsx` (1489) -- `tagButton` :667, `usePick` :688-741, `leftBrowsing` :249 (the new-row guard: new params need it, `renderNewParam` :975, row blur :996, `commitParam` :935), `renderParam` :1017 (`param.value` through `text`/`commit` :400), the `ruleEditor` ref :225, `send(Fields.styleRule, ...)` :1264.
- `web/typescript/studio/RuleEditor.tsx` (713), shared by kind and item (`own`) -- the one tag path input `renderSource` :494, `.mapstudio-rule-path` :526-534; `editRule` :363, `commitRule` :398, `ruleBase` :171; needs an `onBrowse` prop and a public way to put a path into the draft. Its version is `ruleBase`, not the card's `seen`.
- `web/typescript/studio/PropertiesPanel.tsx` (1499) -- `renderLiveRow` :897, `.mapstudio-override-input` :932 (shown after Override or Change, `startOverride` :815), `commitOverride` :826 with `itemOverrides.pathProblem` :137 (full path only); `renderStyle` :1129, `<RuleEditor own>` :1168.
- Gateway (do not change): `TagLookups.resolveReply` :124 needs `kindId`, `assetId`, `path` (no asset, no resolve); `TagPaths.resolve` :193 answers a full path under the base path and a typed `{asset.path}/...` alike, `relative: true` with counts.
- Tests: Jest `tagBrowser.test.ts`, `tagBrowserCard.test.ts`, `tagBrowserDelegate.test.ts`, `kindSetupPanel.test.ts`, `itemStyle.test.ts`, `itemPanel.test.ts`; e2e `tagbrowser.spec.mjs` (helpers `openCard`, `routeBrowse`, `settled`), `kindstyle.spec.mjs`, `overrides.spec.mjs` (`selectRow`, `typePath`, `expectOneBatch`), `itemstyle.spec.mjs`.
- Docs that say "until 13c" or "read only": `docs/kind-setup.md` :38, :47; `docs/contract.md` :275; `CHANGELOG.md` :41; playbook 8n :367, 8o :386, 8q :433; DESIGN.md :520; EXPERIENCE.md :132, :181; `TagBrowser.tsx` :27.

## Tasks & Acceptance

**Execution:**
- [x] `web/typescript/tagBrowser.ts`, `tagBrowser.test.ts` -- the new targets (kind rule, param, new param, override, own rule), their For lines, button words and notes; the note from a typed path; the item target's full-path rule -- C4 to C9, tests first.
- [x] `web/typescript/studio/TagBrowser.tsx`, `MapStudioStoreDelegate.ts`, their tests -- the typed Path field, its ask with a pause, a refused ask's words, the field usable in every tree state -- C7 to C11.
- [x] `web/typescript/studio/RuleEditor.tsx`, `KindSetupPanel.tsx`, tests -- the tag button on the rule's path and on param values, picks into the draft and the param edits, the new-param guard -- C1 to C3, C5.
- [x] `web/typescript/studio/PropertiesPanel.tsx`, `MapStudio.tsx`, `mapstudio.css`, tests -- the tag button on an override row and the own rule, the card on the Items surface for one item, its closing and focus -- C4 to C6, C12.
- [x] `e2e/tests/tagbrowser.spec.mjs` (or a second spec beside it) -- C1 to C12 live on the dev Gateway, with a screenshot of each new state.
- [x] `docs/contract.md`, `docs/kind-setup.md`, `CHANGELOG.md`, DESIGN.md, EXPERIENCE.md, `docs/test-playbook-0.4.0.md` section 8r (and the 13c pointers in 8n, 8o, 8q) -- the "until 13c" lines made true.

**Acceptance Criteria:**
- Given a full editor on the dev Gateway, when they open the browser from P14's override row and pick a tag, then Live now shows the full path marked Override with Reset, and Undo takes it back.
- Given Site2 stopped, when a path is typed in the card, then it is answered and saved without the tree.
- Given a viewer or a phone editor, then none of the new tag buttons is drawn.

## Implementation Notes

- Planner, 2026-11-12: the environment and identity rules are 13b's plan's first Implementation Note; they hold here unchanged. Leave the work uncommitted; run the specs you touch, not the whole suite. The Code Map's line numbers are a guide.
- Implementer, 2026-11-12: built as planned, left uncommitted. Where the build chose within the plan: (1) `PickTarget` gained the parts `rule`, `param`, `override` and `ownRule` with `name`, `item` and `folders`; the tag buttons' ids are `styleRule.path`, `param:<name>`, `param.new:<row>`, `override:<row>` and `own.styleRule.path`. (2) A typed path is asked 400 ms after the last key (`TYPED_PAUSE_MS`) or on Enter, as the trimmed text, through the delegate's `askPick` unchanged; a failed pick now keeps the Gateway's code, so an `invalid` reply shows its words alone and any other failure keeps "Could not check this path: ...". (3) The rule's pick goes through `RuleEditor.usePath`, at the editor's own `ruleBase`. (4) An override's field and its tag button stand in one wrapper whose blur finishes the field, not while that row's card is open; a pick is the field finished with that path (`PropertiesPanel.usePick`), the focus back on the row's button. (5) An item's card also closes when the other tab is chosen, when the override's field closes (Esc in it) and when the own rule is reset, since its tag button is gone then. (6) A folder is a pick for an override of the Alarms row, as for a kind's Alarms, and nowhere else. (7) A kind with no linked item cannot ask the Gateway: a typed full path is taken by `itemOverrides.pathProblem`, and a typed `{asset.path}/...` is told "No meter is linked to an asset, so {asset.path}/X cannot be checked here. Type a full path such as [default]Shared/GasPrice." rather than in the override check's words, which name an override. (8) A new param row not named yet reads "For: A new popup param of the Well pad kind". (9) The shared-tag sentence ends by the value: "... every well pad's rule reads this one tag.", "... every well pad's popup view gets this one path." (10) The e2e matrix is a second spec, `e2e/tests/tagpicks.spec.mjs` (the dev map's Point 2 is the plan's P14); `tagbrowser.spec.mjs` B1 now lists the style rule's button and no longer expects a read-only Path field. The eleven renders were copied from `e2e/out/screenshots` to `docs/screenshots` (the same files `E2E_DOCS=1` writes). The whole e2e suite was not run here (the orchestrator's).

## Plan Change Log

## Review Triage Log

Quick review, 2026-11-12 (one reviewer, by inspection). The rules hold (no em dash, no new message type or field, no version bump, no TypeScript copy of the resolve rule); C1 to C12 each have a test in `tagpicks.spec.mjs`. Three findings: 0 high, 3 medium, 0 low, 0 false, 0 maybe-false. All routed patch, to the implementer.

- medium, patch: the rule's card outlives its tag button. With the card open, moving the rule's Value to a key value or changing the rule's type leaves the card, and "Use this tag" then turns the source back to a tag path and may save the rule (`RuleEditor.usePath` refuses only `none` and `instruments`; nothing closes the card). The card closes when its rule no longer shows a tag path field, for the kind and the item alike, and `usePath` refuses when the source is not a tag path.
- medium, patch: an override pick can close the card with nothing saved. `PropertiesPanel.usePick` calls `commitOverride`, which sends nothing when the path is the one the row reads now (`text === row.path`) or the one the Gateway just refused, and still answers taken. `usePick` says so in words and the card stays open.
- medium, patch: text typed in an override's field is dropped when, with its card open, Override or Change is pressed on another row (the wrapper's blur is skipped while browsing, and `startOverride` overwrites the field). The open field is finished as on a blur before another row's field opens.

Outcome (2026-11-12): three patches applied, none deferred or dismissed. The orchestrator's Verification on the patched code: tsc clean, Jest 1116 passed, Gradle BUILD SUCCESSFUL, the contract check OK, and on a fresh stack the whole suite 331 passed, 9 skipped (the store-check and Gateway-stop scenarios, run by hand), 0 failed in 1.3 h.

## Design Notes

The Gateway answers a typed `{asset.path}/...` and a full path under the asset folder with the same reply, so the typed field needs no conversion code in the browser: it sends what was typed and saves what comes back. An item target never asks, since an override is a full path by rule and the browser's check already says so.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK
- `ops/up.sh --fresh`, then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: 0 failed
