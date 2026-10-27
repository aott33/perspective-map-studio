- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/spike-render-a-project-view-by-path-as-a-popup-plan.md`
  summary: Confirm on the Gateway that the popup view's view model stops when the popup closes (and that a p1 to p2 switch, which reuses one mount path, stops the old one).
  evidence: Review finding 2 (quick lens): only the browser side was seen; the Gateway logs nothing at info for a view stop. Settle it with the Perspective session page's view count or a debug logger on `perspective.ViewModel` during `e2e/tests/popup.spec.mjs`, and record it under "Story 4" in `docs/platform-checks.md`.
  folded: the story 7 entry for the same item (the popup check now lives in `e2e/tests/popup.spec.mjs`; the Gateway side still needs a view count on the Perspective session page or a debug logger on `perspective.ViewModel`) was merged into this one by story 8.
  goes_to: story 9 (a live Gateway check, no code change; an agent session with a dev Gateway can do it).

- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-playwright-smoke-suite-and-the-spike-s-measures-plan.md`
  summary: For the epic 1 refactor sweep (story 8) - remove the spike-only `testSet` prop (`common/.../mapstudio.props.json`, `web/typescript/{testSet,scaleData}.ts`) and the dev views `MapStudioScale`, `MapStudioFallbackEmpty` and `MapStudioFallbackMissing`, or keep them as e2e fixtures once the map store supplies test data.
  evidence: Owner's decision 2026-10-26 (story 7, question 4): the 30 pads reach the component through a spike-only prop that is removed in the sweep. The e2e specs `scale.spec.mjs` and `popup.spec.mjs` and the frame rate measure depend on them.
  resolved: 2026-10-26 story 8 - decided to keep, not remove. The owner's earlier decision (story 7, question 4) to remove `testSet` in the sweep is superseded by the owner's approval of the story 8 plan on 2026-10-26: `scale30` is the only source of the 30-pad frame-rate measure and the owner's headed run needs it before story 9, and the component has no other way to receive data until `map.load` exists. `popupView` stays for the same reason (it is the only way to name a popup view until the kind setup, AD-7).
  goes_to: epic-map-store-and-data (seed the 30 pads through `system.mapstudio.applyEdits`, then remove `testSet`, `scaleData.ts` and the Scale view) and epic-viewing (the kind setup replaces `popupView`).
  resolved_again: 2026-10-27 epic 2 story 11 - `testSet` (`tracer` and `scale30`), `web/typescript/{testSet,scaleData,testData}.ts`, their two tests, the `MapStudioScale` view and the `/scale` page are removed. The 30-pad set (30 pads, 30 lines) and the tracer's three points and line are map items seeded into `mapstudio-dev` through `system.mapstudio.applyEdits` by the dev library `mapstudio_seed` ("Seed the dev map" on `/edit`, MapEditor only, safe to re-run; `e2e/tests/fixtures.mjs` `ensureSeeded`), and the frame rate measure runs on `/` with them. `MapStudioFallbackEmpty` and `MapStudioFallbackMissing` stay as e2e fixtures and draw the seeded items. Still open: `popupView` stays until epic-viewing's kind setup replaces it (AD-7; the epic says it must not change).

- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-playwright-smoke-suite-and-the-spike-s-measures-plan.md`
  summary: Run `E2E_HEADED=1 npm test` in `e2e/` once on a laptop with a real GPU and add its renderer string and frame rates to the record, before story 9 judges NFR-1.
  evidence: The recorded frame rate is software WebGL on a shared 4-CPU box (5.8 to 15.8 fps for the same view across two runs); NFR-1 asks for 60 fps in a laptop browser and is not decided by it.
  goes_to: owner action, before story 9 judges NFR-1. Needs `testSet` and the Scale view, which story 8 kept. Update 2026-10-27 (epic 2 story 11): the Scale view and `testSet` are gone; a repeat of the GPU check uses `/` after "Seed the dev map" on `/edit` (the same 30 pads and 30 lines, now map store items, plus the tracer's 3 points and 1 line).

- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-playwright-smoke-suite-and-the-spike-s-measures-plan.md`
  summary: Replace the `values.batch` stand-in (`e2e/lib/valueBatch.mjs`) with a measurement of the real message when epic-viewing builds it.
  evidence: The item layout and the websocket compression are unverified guesses; only the LiveValue fields are fixed by AD-6.
  goes_to: epic-viewing.

- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-install-through-the-template-s-module-lock-plan.md`
  summary: Possible race in the ign-scada-template (its owner to look): the phone-native-night render of `/well/Mesa/P12/P12-3H/trends` failed once with `Cannot subscribe to "ProjectDefinition" state. "Parts/Asset/Trends/" does not exist`, an embed path whose type segment was still empty.
  evidence: Seen once in the first `scripts/test/stack.sh` run of the story 6 rehearsal; the same page passed in native-day, a re-run of the whole phone-native-night pass passed, and a fresh stack run passed (exit 0). Map Studio is not on that page. Not reproduced on a stack without the module, so unverified whether it predates Map Studio. Owner: `ign-scada-template` (generator `scripts/gen/hmi/pages/asset.py`, `Parts/Asset/Trends/<Type>` embed).
  goes_to: `ign-scada-template` (its owner; its backlog row is theirs to open). Out of scope for Map Studio.

- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-tracer-a-maplibre-map-on-a-perspective-view-with-one-round-t-plan.md`
  summary: Remove the 15,704 `web/node_modules` files from the branch history by squashing the story 1 work-in-progress commits before the branch becomes a pull request.
  evidence: An early WIP commit (13f7a34) swept `web/node_modules` in before it was ignored; `git ls-files` shows none now, but history carries them. Needs the owner's approval for a force-push on the session branch.
  resolved: 2026-10-26 owner approved; the eleven WIP commits were squashed into one and force-pushed; no commit on the branch contains web/node_modules.

- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-tracer-a-maplibre-map-on-a-perspective-view-with-one-round-t-plan.md`
  summary: For the epic 1 refactor sweep (story 8) - clear the Gradle 10 deprecations in the build scripts, bump webpack to 5.112 or later to end the npm peer warnings, and fix the build-tool npm audit findings.
  evidence: The owner's fresh-clone build on 2026-10-26 printed Gradle deprecation warnings (`by extra(...)`, `tasks.registering`, `moduleDependencies`) and npm peer warnings (webpack 5.101.3 pinned, plugins want ^5.112). `npm audit --omit=dev` findings (axios, lodash, moment, @babel/runtime) all come through `@inductiveautomation/perspective-client`, which webpack treats as an external the Gateway provides, so none of them ship in Map Studio's bundle; the rest are build tools only.
  resolved: 2026-10-26 story 8 - Gradle: `by extra` (1 place), `by registering` (2 places) and the `copy {}` and `layout` calls inside task actions are gone, and the empty `moduleDependencies` line (deprecated for `moduleDependencySpecs`) is dropped; webpack 5.112.2, copy-webpack-plugin 14.0.0 and css-minimizer-webpack-plugin 8.0.0 end the peer warnings and the `serialize-javascript` findings; `@inductiveautomation/perspective-client` moved to devDependencies so `npm audit --omit=dev` reports 0. Left, recorded in docs/platform-checks.md (Story 8): the `Project.getProperties` and `Task.project` (`:common:collectModlDependencies`) warnings from the `io.ia.sdk.modl` 0.5.0 plugin (origin read from the task name in the build log, plugin source not read), and 8 `npm audit` findings that come only through the Gateway-provided `perspective-client` (its offered fix is a downgrade to 2.3.9).

- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-ci-builds-signs-and-releases-the-module-plan.md`
  summary: Real signature verification in `scripts/ci/modl-verify.sh`.
  evidence: Review found the script only checks that `certificates.p7b` and `signatures.properties` exist, that every file has an entry, and the certificate fingerprint; a forged module carrying the genuine p7b would pass. Before implementing, confirm the plugin's signed-bytes format: `signatures.properties` values are base64 and look like RSA signatures per file (key = `/<archive path>`), probably SHA256withRSA over the file bytes, but this was not checked against the `io.ia.sdk.modl` 0.5.0 / module-signer source. Until then the Gateway's install-time check is the cryptographic one (stated in README and RELEASING.md).
  goes_to: not scheduled. Owner decision 2026-10-26 (story 8 plan): stays deferred; the Gateway verifies the signatures at install. A ticket entry that first reads the `io.ia.sdk.modl` signing source is the owner's call.

- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/spike-gateway-platform-checks-plan.md`
  summary: Verify in the Designer on the ms-s3 Gateway that `system.mapstudio.` autocompletes with its description and that saving the `setup` project resource logs `CHECK setup-modified` (the `onResourcesModified` path).
  evidence: Both are claims the spike could not exercise without a Designer or an API key; the record marks them [not verified]. One Designer session settles both.
  goes_to: owner action, then story 9. Run it on the released v0.1.0 module or on commit 51104c8: story 8 removes the code behind `CHECK setup-modified`; `system.mapstudio.ping` and `echo` stay, so the autocomplete check still works on a current build.

- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/spike-gateway-platform-checks-plan.md`
  summary: For the epic 1 refactor sweep (story 8) - remove the `gateway/.../spike` package, the `mapstudio_checks` project script and the `setup` resource of the dev project, or keep `ops/checks.sh` as a regression harness; decide once story 9 has compiled the record.
  evidence: The spike code runs on every runnable project that holds a setup resource and logs FAIL warnings on story 1's plain dev Gateway; the real setup (AD-5), scripting API (AD-18) and migrations (AD-21) replace it in epic-map-store-and-data.
  resolved: 2026-10-26 story 8 - removed: the `gateway/.../spike` package and its tests, the `mapstudio_checks` project script, the `setup` resource, `MapStudioModule.SETUP_RESOURCE_TYPE`, `ops/checks.sh`, `ops/checks/`, `ops/docker-compose.checks.yml` (the PostgreSQL dev stack) and their `lib.sh` hooks. No harness is kept: it only read the removed package's `CHECK` lines. Recoverable at commit 51104c8 and in the v0.1.0 tag (the tag is not in the clone this was done in, unverified); the evidence stays in docs/platform-checks.md.

- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/spike-gateway-platform-checks-plan.md`
  summary: Decide the Designer editor for the setup resource in epic-map-store-and-data (about 300 lines of Swing from IA's project-resource example, or the script-function fallback of AD-5).
  evidence: Owner's decision 2026-10-26 (Open Question 1, option a); the estimate is in `docs/platform-checks.md`, check 4.

- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-refactor-sweep-plan.md`
  summary: Triage leftovers of stories 1, 2 and 7 that need features: a late reply clears the pending state of a newer click, a theme switch does not repaint the map, two phone probes fail (44 px targets, the 21 x 22 px popup close button), Terra Draw dash arrays and the `access-denied` view state were never exercised.
  evidence: Review Triage Logs of stories 1 and 7 and `docs/platform-checks.md` (stories 2, 4, 7). All unverified or tracer-only.
  goes_to: epic-viewing (reply correlation via `map.changed`, theme following AD-11, dash arrays), epic-phone (touch targets), and a view-permission test in the story 9 list for `access-denied`.

- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-refactor-sweep-plan.md`
  summary: CI steps never executed in a runner when written (`download-artifact`, `setup-node`, the Playwright browser cache and `playwright install --with-deps`), and `shellcheck` and `actionlint` were never run on the scripts and workflows.
  evidence: Story 5 and 7 Implementation Notes marked them unverified. Story 8 could not read the GitHub run status (the repository is not attached to its session). Adding shellcheck or actionlint to CI is a new gate, not cleanup.
  goes_to: owner (check the Actions run on `main`; decide on the two linters).

- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/story-instruments-on-lines-attachment-stored-and-kept-on-the-line-plan.md`
  summary: Phone editing may move an instrument along its own line by sending `attachment` with the new point (Open Question 5, option b).
  evidence: Owner decision 2026-10-27 took option a for now: a phone editor's geometry or attachment change of an instrument is refused `role` ("An instrument moves along its line; only full editing can move it"); option b was recommended as a backlog entry.
  goes_to: epic-phone

- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/story-refactor-sweep-plan.md`
  summary: Two tag path rules disagree: a kind setup save checks tag paths with `Placeholders.checkTagPath` (`isAssetSuffix`), which accepts `{asset.path}/a//b` and a `[` in the suffix, while the tag browser's `tags.resolve` (`TagPaths.resolve`) refuses both.
  evidence: Owner decision 2026-10-27 (sweep Open Question 3, option a): the sweep must not tighten validation, so both rules stay. Today the tag browser stores only what `tags.resolve` returns, so the looser rule is reached only by a hand-written or scripted kind setup. Aligning the save rule to `TagPaths` refuses kind setups that save today, so it needs a decision on existing rows.
  goes_to: epic-editing (the kind setup editor and tag browser), with a check of stored kind setups before tightening.

- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/story-refactor-sweep-plan.md`
  summary: Live checks the sweep could not make with the dev stack and e2e harness: `onShutdown` on page or session close, a redundant pair (standby refusal, migration on becoming active), a `storage` event between two real tabs, a real browser closed and reopened with unsaved edits, a slow tag system (`tags-unavailable`), a kind setup saved by the least-privilege runtime role, the example adapters run live, another project's maps getting no `map.changed`, and a signed-in user without an editing role (no such dev user).
  evidence: Each is unit tested and marked **[unverified]** live in `docs/platform-checks.md` or `docs/contract.md`; each needs new harness, a second Gateway or new dev users, which is not cleanup.
  goes_to: the release check of epic-map-store-and-data (entry 13) or the owner; the redundant pair with the template test stack.

- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/story-refactor-sweep-plan.md`
  summary: The Designer setup form (epic 2 story 7) gets its own redesign story; the sweep leaves `designer/.../setup/` unchanged.
  evidence: Owner, 2026-10-27: "add the setup form story". The owner opened the Map Studio Setup tab on 8.3.10 and it showed the dev setup's values correctly; the save failed on a dev-stack file permission, fixed in a separate change. The form already reads `"basemaps": null` as the default list, as the Gateway does (`SetupForm.names`), so only the docs were wrong (fixed by the sweep).
  goes_to: a new story in epic-map-store-and-data for the setup form redesign (the coordinator adds the ticket; the sweep edits no ticket file), with the remaining story 7 Designer checks in `docs/platform-checks.md`.
  resolved: 2026-10-27 entry 16 "Setup form in the Designer: pickers and layout" added to epic-map-store-and-data (commit f28129e) and being built; the dev-stack save permission is fixed (PR #14).
