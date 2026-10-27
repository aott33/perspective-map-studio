---
title: 'Tag browse and asset-relative paths for the tag browser'
type: 'feature'
ticket: '15'
created: '2026-10-27'
status: 'built'
baseline_revision: '8f042cd2c8088a8bfdd857975751975377dc5cd6'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/story-kind-list-and-asset-list-from-the-project-plan.md'
  - '{project-root}/docs/contract.md'
  - '{project-root}/docs/platform-checks.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** epic-editing's tag browser (Map Studio's own tree with a provider dropdown, initiative R15, prd FR-12) has no Gateway side: nothing lists tag providers or a folder's children, and nothing turns a picked tag path into the asset-relative `{asset.path}/...` form that story 9 stores in kind setups, with the "resolves for N of M items" count the browser shows.

**Approach:** First a short live check of Ignition 8.3's tag browse API from the module's Gateway scope on the dev Gateway, recorded in `docs/platform-checks.md`. Then two request types in `common/` and the delegate (AD-8): `tags.browse {provider, folder}` lists the providers (default marked) and one folder's children; `tags.resolve {kindId, assetId, path}` converts a full or `{asset.path}/...` path against the asset's base path from story 3's cached asset list and counts, among the kind's live map items with a base path (M), those the path exists for (N). Full editing role only, checked on the Gateway; reads tag structure, writes nothing; no migration. Docs for both (R14).

## Boundaries & Constraints

**Always:**
- Build on stories 1 to 7 unchanged: envelope `v` 1, `CONTRACT_VERSION` "0.2.0-draft", `MapStudioException(code, message)` as the one refusal, replies `<type>.reply`, `MapStudio.<area>` loggers (new area `MapStudio.tags`), store work on `MapStudioServices.work`, busy pool answered with `busyReply`.
- Order of checks per message: setup (`store-unreachable` when none or invalid) -> level from `RoleMatrix.level` (anything but `full` gets `role`, phone included, before any body check, so a viewer learns nothing about tags) -> body and names (`invalid`) -> tag calls. `tags.resolve` also needs the map store readable (`StoreGate.requireReadable`), since M and N come from `liveItems`; a read-only store still answers.
- Tags are read as structure only (browse or tag configuration), never as values and never subscribed, written or edited (AD-1). Every tag call has a 5 s timeout and runs on the work pool, never on Perspective's thread.
- `tags.browse` children: one level per call; `name`, `path` (full path with `[provider]`), `type` (`folder`, `tag`, `udt-instance`, `udt-type`, `other`), `dataType` (Ignition's data type name, null for a folder or instance), `hasChildren`; property nodes are left out. `folder` omitted, null or empty is the provider's root; leading and trailing `/` trimmed; a folder holding `[`, `]` or longer than 1024 characters is `invalid`; an unknown provider or a folder the browse reports not found is `invalid` naming it.
- `tags.resolve`: `kindId` must be in the kind list snapshot and `assetId` in the asset list snapshot, the asset's kind equal to `kindId`, else `invalid`. `path` is a full path `[provider]a/b`, `{asset.path}` or `{asset.path}/<suffix>`; anything else (no provider, `[~]`, `[.]`, another placeholder, over 1024 characters) is `invalid`. A full path equal to the base path or below it on a `/` boundary gives `{asset.path}` or `{asset.path}/<suffix>`, `relative: true`, `n`, `m`; any other full path is returned unchanged with `relative: false` and no counts. Provider names compare case-insensitively, path segments exactly **[unverified]** (the live check records how Ignition compares them).
- M = live map items with `kind == kindId` whose `assetId` names an asset in the snapshot; N = those for which `basePath + "/" + suffix` exists. Existence of all distinct candidate paths is checked in as few tag calls as the live check allows (one per provider or one per parent folder), not one per item.
- Pure parts (path parsing and conversion, child type words) live in `common/` and are unit tested; the Ignition calls sit behind one Gateway interface so the lookups are tested with a fake.
- No tag path, user name or item property in a log line above debug; refusals log at debug as the delegate does today.

**Decisions (owner, 2026-10-27, "agree with all recommendations, start building"):**
- The default provider is the session project's default tag provider; when it is blank or names a missing provider, `default` if it exists, else the first provider by name other than `System`; that one is marked `isDefault` and is what `tags.browse {}` browses.
- Browse and existence checks run under the session user's roles (and security zones where the session exposes them **[unverified]**) through `SecurityContext.fromRolesAndZones`, so a tag the editor may not read is neither listed nor counted. If the live check shows that context cannot be built, the system context is used only with the owner's word (hitl).
- A tag call that fails or passes 5 s answers the new code `tags-unavailable` ("The tag system did not answer within 5 s"), added to `Messages.CODES` and `docs/contract.md` as a draft contract addition.
- One browse returns at most 1000 children, ordered by name, and `tags.browse.reply` carries `truncated: true|false`; paging can come later without breaking it.

**Never:**
- A database migration, a `mapstudio_` table or a setup schema change; any write-path, role-matrix, `map.load` or `map.changed` change; a scripting API function for tags.
- The tree, the provider dropdown, the "Same tag for every <kind>" warning, the Kinds screen or any visible UI (epic-editing); storing or validating kind setup tag paths (story 9) or filling placeholders (story 9's fill function in `common/`).
- Perspective's Tag Browse Tree component; `system.tag.*` from Jython; touching `ign-scada-template`.

## I/O & Edge-Case Matrix

| Scenario | Input (full editor unless stated) | Reply | Error |
|----------|----------------------------------|-------|-------|
| Default root | `tags.browse {}` | `provider` the default, `folder ""`, `providers` all with one `isDefault: true`, root children | none |
| Asset folder | `{provider: "default", folder: "Mesa/P12"}` | P12's members, each `path` `[default]Mesa/P12/<name>`, data type set | none |
| Second provider | `{provider: "System"}` | System's root children | none |
| Unknown | provider `nope`, or folder `Mesa/Nope` | - | `invalid`, names it |
| Not full | viewer or phone editor, either type | - | `role` |
| Pick inside | resolve `[default]Mesa/P12/Pressure`, asset P12 | `{path: "{asset.path}/Pressure", relative: true, n: 2, m: 3}` (P15 lacks it) | none |
| Already relative | path `{asset.path}/Pressure` | same as above | none |
| Pick outside | `[default]Plant/Header/Pressure` | `{path: "[default]Plant/Header/Pressure", relative: false}` | none |
| Prefix not a segment | base `[default]Mesa/P1`, path `[default]Mesa/P12/X` | `relative: false` | none |
| Bad names | unknown kind or asset, asset of another kind, `Mesa/P12/X` without provider | - | `invalid` |
| No linked items | kind has no item with a known asset | `relative: true, n: 0, m: 0` | none |
| Tag system slow | a tag call past 5 s | - | `tags-unavailable` |

</frozen-after-approval>

## Code Map

- `common/.../common/Messages.java` -- add `TAGS_BROWSE`, `TAGS_BROWSE_REPLY`, `TAGS_RESOLVE`, `TAGS_RESOLVE_REPLY` with body javadoc, to `INBOUND_TYPES` and `OUTBOUND_TYPES`; and the new code `tags-unavailable` in `CODES`. Story 9 may edit this file too (merge, not conflict in meaning).
- `gateway/.../MapStudioDelegate.java` -- `isStoreType` gains the two types; `submitStoreWork` already reads `SessionView` (project, user, roles) on the event thread and runs on `services.work`; route the tag types to a new static `tagsReply(TagLookups, SessionView, type, id, body)` beside `storeReply` (same `MapStudioException` to `error` mapping, `RuntimeException` to a logged failure). `services.tags` is the instance.
- `gateway/.../MapStudioServices.java` -- create `TagLookups` after `adapters` from `setups`, `gate`, `store`, `adapters::snapshot` and `new IgnitionTagSource(context.getTagManager(), context.getProjectManager())`; nothing to start or stop.
- `gateway/.../setup/SetupRegistry.require(project)` -- `store-unreachable` for no or invalid setup; `write/RoleMatrix.level(setup, roles)` -- the level; `store/StoreGate.requireReadable` and `store/MapStore.inTransaction(connection, tx -> tx.liveItems(project))` -- the items for M (map `SQLException` as `MapLoader.load` does); `adapter/AdapterSnapshot` `kinds()`, `assets()` and `common/.../contract/Asset.basePath()` (already checked to start with `[provider]`).
- SDK, all **[SDK 8.3.0 javap]**, unverified live until the check: `GatewayContext.getTagManager()` -> `GatewayTagManager` (`getTagProviderNames()`, `getTagProvider(name)`, `browseAsync(TagPath, BrowseFilter, SecurityContext)` -> `Results<NodeDescription>` with `getResultQuality()` and `getTotalAvailableSize()`); `NodeDescription` `getName()`, `getFullPath()`, `getObjectType()` (`TagObjectType` Folder, AtomicTag, UdtInstance, UdtType, Property, Provider, ...), `getDataType()`, `hasChildren()`; `TagProvider.getTagConfigsAsync(List<TagPath>, ...)` for existence; `BrowseFilter.setMaxResults(int)`; `SecurityContext.fromRolesAndZones(roles, zones)` and `systemContext()`; `ProjectManager.getProjectProps(project).getDefaultSQLTagsProviderName()` (the project's default tag provider; no Gateway-wide default seen in the SDK).
- `web/typescript/messages.ts` (`MessageTypes`) and `web/typescript/testHook.ts` (`TEST_HOOK_TYPES`) -- add the four and two names, so the e2e suite can send them; test replies are taken before `readReply`, so no reader is needed. Story 8 edits the browser side too; these are one-line additions.
- `e2e/tests/fixtures.mjs` -- `editorTest`, `signedInContext(browser, OPERATOR_USER)`, `openMap`, `mapLoaded`; `window.__mapStudioTest.send(type, body)`.
- `ops/config/core/ignition/` -- seeded only on a fresh volume (`ops/docker-compose.yml` init); a fresh 8.3.10 Gateway has only `System` (docs/platform-checks.md, story 3). Layout `tag-provider/default/{config,resource}.json`, `tag-type-definition/default/udts.json`, `tag-definition/default/...` per claude-ignition-skills `docs/verification.md` **[live 8.3.9]**; named resources need `attributes.uuid` (platform-checks story 3).
- Story 9 adds the closed placeholder list and the fill function in `common/`; `TagPaths` uses only the literal `{asset.path}` and the sweep (entry 12) points it at story 9's constant.

## Tasks & Acceptance

**Execution:**
- [x] `docs/platform-checks.md` -- new section "Epic 2 story 15 - tag browse from the Gateway", done first on `ms-e2s15` (port 9131) with a throwaway check in the module or a Gateway script console call: provider names and how the default is found, a root and a folder browse of two providers, which `SecurityContext` sees what (a tag with read permissions), what an unknown folder returns, depth (one level), time for a UDT instance's members and for an existence check of 3 and of 300 paths, case comparison. Each fact labelled **[live 8.3.10]**; the code follows what it finds.
- [x] `common/.../common/contract/TagPaths.java` (new) -- pure: `folder(String)` check and trim, `parseFull(String)` provider and path, `resolve(path, basePath)` -> `{path, relative, suffix}`, `under(basePath, suffix)`; `invalid` reasons in plain words.
- [x] `common/.../common/contract/TagChild.java` (new) -- record `{name, path, type, dataType, hasChildren}`, `toJson`, `typeWord(String objectType)`.
- [x] `common/.../common/Messages.java` -- the four types and `tags-unavailable`.
- [x] `gateway/.../tags/TagSource.java` (new) -- interface: `providers()`, `defaultProvider(project)`, `browse(provider, folder, roles)` -> found, children, truncated; `existing(List<String> fullPaths, roles)` -> set.
- [x] `gateway/.../tags/IgnitionTagSource.java` (new) -- `TagSource` over `GatewayTagManager` and `ProjectManager`, 5 s timeouts, child cap 1000 with `truncated`, security context from the session's roles (Decisions).
- [x] `gateway/.../tags/TagLookups.java` (new) -- `browseReply(project, roles, body)`, `resolveReply(project, roles, body)` per the Always rules and the matrix.
- [x] `gateway/.../MapStudioServices.java`, `gateway/.../MapStudioDelegate.java` -- wiring and routing as in the Code Map.
- [x] `web/typescript/messages.ts`, `web/typescript/testHook.ts` -- the names.
- [x] `ops/config/core/ignition/tag-provider/default/*`, `tag-type-definition/default/udts.json` (UDT `Pad`: memory tags `Pressure` Float8, `Flow` Float8, `Comms` Boolean), `tag-definition/default/Mesa/...` (P12 and P14 instances of `Pad`, P15 a folder with `Flow` only, `Lines/L3` with `Flow`, `Plant/Header/Pressure`) -- dev test equipment; no value is ever written by Map Studio.
- [x] `docs/contract.md` -- both types in the Messages table, a section "tags.browse and tags.resolve: the tag browser's lookups" (shapes, rules, examples, refusals, role), the error-code table; `docs/kinds-and-assets.md` -- one paragraph on asset-relative tag paths and a link.
- [x] Tests: `common/src/test/.../contract/{TagPathsTest,TagChildTest}.java` (every matrix path case, segment boundary, trailing slash, provider case, length, placeholders); `gateway/src/test/.../tags/{FakeTagSource,TagLookupsTest}.java` (each matrix row, role before invalid, phone refused, M and N with a missing tag and an unlinked item, store unreadable, timeout); `MapStudioDelegateTest` (routing, busy pool); `e2e/tests/tags.spec.mjs` (new: editor creates three `pad` items linked to P12, P14, P15 through `edits.apply` with `status: "producing"`, then browse and resolve as in Verify; phone editor and anonymous viewer refused with `role`).

**Acceptance Criteria:**
- Given the dev stack on a fresh volume, when the e2e suite runs, then every existing spec passes unchanged and `tags.spec.mjs` passes.
- Given `docs/platform-checks.md`, when the story is done, then the browse check section exists and every Ignition claim in `docs/contract.md`'s new section is labelled **[live 8.3.10]** or **[unverified]**.
- Given a full editor's `tags.resolve` of `[default]Mesa/P12/Pressure` on the dev stack, when M counts the run's three linked pads plus any older linked pads from `map.load`, then N is M minus the items linked to P15.

## Implementation Notes

- The live check ran first, with a throwaway `TagCheck` class in the module (logged `TAGCHECK` lines 40 s after start, removed before the commit); its findings are in `docs/platform-checks.md`, "Epic 2 story 15".
- Existence (N) is one browse per distinct parent folder, at most 50 running at once (batches), joined within one 5 s deadline (every browse still running is cancelled on a timeout or failure), under the session user's roles; `getTagConfigsAsync` was as fast but takes no `SecurityContext`, so it would not follow the owner's permission decision.
- `tags.resolve` checks the map store readable after the body and names, for every resolve (also a `relative: false` one), so the order is one order; the level is checked again on the setup that read returns, so the role and the items come from one setup.
- `tags.browse` asks Ignition for 1001 + 64 nodes (it reports no total, live; the 64 leave room for property and `Parameters` nodes), counts only listed children toward the 1000, and sorts the page it got; a truncated page is not the first 1000 by name.
- The anonymous viewer e2e test runs at `/` without a sign-in; the phone editor in its own context at 390 px.
- Shared files touched, all additive: `Messages.java` (four types, one code), `MapStudioDelegate.java` (`isStoreType`, `tagsReply`, routing line), `MapStudioServices.java` (one field), `contract.ts` (`TAGS_UNAVAILABLE`), `messages.ts` (four names), `testHook.ts` (two names), `docs/contract.md` (rows and one section).

## Plan Change Log

- 2026-10-27, approval (not a review loopback): the owner approved the plan with every recommended Open Question answer ("agree with all recommendations, start building"); the answers are the Decisions in the frozen block. Branch `ccr-3c8b84b9-f1vbsm` merged first (only the deterministic adapter deadlock test was new).
- 2026-10-27, live check (the code follows what it finds, per the Tasks): Ignition compares path segments without letter case, so `tags.resolve` compares the provider and the base path's segments without case, the suffix keeping the pick's case (the frozen rule left this to the check). A UDT instance's browse holds a `Parameters` node with no full path: left out with the property nodes. Folders and instances report data type `String`: sent as null. A tag's read permissions do not hide it from a browse under any context, so the session-roles browse filters nothing more than the system context today; kept per the decision and documented, no owner fallback needed.
- 2026-10-27, Decision (owner, "agree with all recommendations"): browsing lists tags whatever their read permissions (accepted; the list is not a permission check, and no value is read).


## Review Triage Log

- 2026-10-27, lens quick (context-free), 7 findings, 7 patched, 0 rejected:
  - **1 (medium) patched:** `IgnitionTagSource.existing` fired one browse per distinct parent all at once, unbounded, and a timeout cancelled only the one future. Now at most `MAX_IN_FLIGHT` (50) browses run at once (batches under the one 5 s deadline), and on a timeout or any failure every started browse of the batch is cancelled (`theFanOutIsBounded`, `aTimeoutCancelsEveryBrowseStillRunning`). One `getTagConfigsAsync` per provider was not taken: it takes no `SecurityContext` (Implementation Notes).
  - **2 (low) patched:** `browse` counted property and `Parameters` nodes toward the cap. Only listed children count now; Ignition is asked for 1001 + 64 nodes, and an answer of exactly that many is still `truncated` (more may exist). contract.md states a truncated page is sorted but is not the first 1000 names (`aFullUdtInstanceWithItsParametersNodeIsNotTruncated`, `oneListedChildOverTheCapIsTruncated`, `anAnswerAsLargeAsAskedMayHaveLeftOutChildrenSoItIsTruncated`).
  - **3 (low) patched:** a base path the adapter check lets through (`[~]Mesa/P12`, `[default]/Mesa/P12`) made a full-path resolve blame the editor's path. The picked path is parsed first, then the base path, refused `invalid` "The asset P12's basePath ... cannot be used for tag paths; ..."; a linked item on such an asset counts in `m`, never in `n`, and no candidate is built from it. No normalising of a leading `/`: whether Ignition reads `[default]/Mesa/P12` as `[default]Mesa/P12` is not checked live (`anAssetWhoseBasePathIsNotAFullPathIsBlamedNotThePickedPath`, `anItemOnAnUnusableBasePathCountsInMButNeverInN`).
  - **4 (low) patched:** `existing` now treats a bad quality other than `Bad_NotFound` as `tags-unavailable`, as `browse` does, so a low `n` never hides a tag-system error (`aParentWithABadQualityIsTagsUnavailableNotMissing`).
  - **5 (medium) patched:** new `IgnitionTagSourceTest` over a stub `GatewayTagManager` and `TagProvider` (Proxy): a never-completing future with a 50 ms deadline (package-private constructor) is `tags-unavailable` and cancelled, the cap and `truncated` with property and `Parameters` nodes, `Bad_NotFound`, `Bad_AccessDenied` and `Bad_Stale`, a failed future, case-insensitive grouping by parent, an unknown provider, the bounded fan-out. The delegate's routing and pool hand-off are now the static `job` and `submitWork`; `MapStudioDelegateTest` checks that `tags.*` goes to the tag lookups and `map.load` to the store, and that a `tags.browse` on a saturated pool is answered busy at once and never runs.
  - **6 (low) patched:** contract.md's `tags-unavailable` row lists the three messages; the `store-unreachable` row names `tags.browse` and `tags.resolve` among the busy replies.
  - **7 (low) patched:** `resolveReply` decides the level again on the setup `gate.requireReadable` returns, the one the items are read under; the first check stays before the body is read, so the documented order holds (`theLevelIsDecidedOnTheSetupTheItemsAreReadUnder`).

## Design Notes

```json
{"type": "tags.browse.reply", "body": {"provider": "default", "folder": "Mesa/P12",
  "providers": [{"name": "default", "isDefault": true}, {"name": "System", "isDefault": false}],
  "children": [{"name": "Pressure", "path": "[default]Mesa/P12/Pressure", "type": "tag",
                "dataType": "Float8", "hasChildren": false}]}}
{"type": "tags.resolve.reply", "body": {"path": "{asset.path}/Pressure", "relative": true, "n": 2, "m": 3}}
```

N is checked by structure (tag configuration or a parent browse), not by reading values: AD-1 allows tag reads only by subscription, and a structure lookup answers "does this tag exist" without one. The live check picks between one `getTagConfigsAsync` per provider and one browse per distinct parent folder by the 300-path timing.

## Verification

**Commands:**
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build` -- expected: green, new common and gateway tests included, Jest unchanged.
- `ops/up.sh --fresh`, then `cd e2e && npm test` -- expected: all pass.
- `ops/logs.sh -n 400 | grep -i "M.tags"` -- expected: no warning or error from the run.
- `git grep -nP '\x{2014}'` -- expected: no match.

**Manual checks:**
- On the dev Gateway's Tag Browser, the seeded `default` provider shows Mesa/P12, P14, P15 and Plant as planned, and no tag value changed during the e2e run.
