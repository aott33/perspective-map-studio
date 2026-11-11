---
title: "13a: one tag path rule on the Gateway, the items a path fails for, and the dev tags the browser needs"
type: 'feature'
ticket: '13'
created: '2026-11-11'
status: 'draft'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'high'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/docs/contract.md', '{project-root}/docs/kind-setup.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A kind setup's save accepts tag paths that `tags.resolve` refuses (`//`, a bracket in a suffix), so the tag browser to come could show a path as broken that the Gateway stored without a word; `tags.resolve` says how many items a path fails for but not which; and the dev Gateway lacks the tags and the second provider the tag browser's checks need (R4).

**Approach:** Make the save rule the resolve rule (`TagPaths`), once, for every stored tag path; report the stored rows it would refuse without rewriting them; add the failing items to `tags.resolve.reply` (backlog 39) and show them in the resolve note; settle how a stopped provider answers; and add the dev tag fixtures.

Decisions (owner, 2026-11-11, "go with recommended"): entry 13 is split: this plan (the Gateway), 13b (the browser card and tree, with picks into a kind's key values, Comms and Alarms), 13c (the other pickers and the Path field's conversion). (1) The failing items are added now, while contract 0.4.0 is unreleased. (2) The Gateway logs, when it starts, each stored setup or override the rule would refuse, and a test proves both seeds pass. (3) Kind setups, popup params and item overrides are tightened together. (4) A provider that is listed but does not answer reads as unavailable, checked live. (5) and (6) are 13b's (a folder may be picked for Alarms only; the type column shows what the Gateway sends).

## Boundaries & Constraints

**Always:** **One rule:** every stored tag path (comms, key values, alarms, a rule's path, a popup param's `{asset.path}/` suffix, in a kind setup and in an item's overrides) is checked as `TagPaths` checks it: no empty part (`//`), no bracket after the provider, no brace in a suffix; the refusal in plain words naming the part, in the existing "Op N (id): where: words" form. The browser's own check of an override's path (12c1) follows the same rule and words. **Stored rows:** nothing stored is rewritten or refused on read; when a project's store is first read after the Gateway starts, one warning per failing row names the project, the kind or item, the part and the path, and one info line says how many rows were checked; a failing row still loads and draws as before, and is refused only when next saved. **The failing items:** `tags.resolve.reply` gains, for a relative path with `n` below `m`, `failing` (at most 20 `{id, name}`, by name) and `failingMore` (the count beyond them); absent otherwise; the same role check as the rest of the reply. The resolve note then reads "Resolves for 4 of 5 well pads. Not for P15." (up to three names, then "and N more"). **Providers:** a provider the Gateway lists but that does not answer is `tags-unavailable` with words naming it; one that is not listed stays `invalid`; what a stopped provider does on 8.3.10 is recorded in `docs/platform-checks.md`. **Dev fixtures:** a second tag provider with a few tags, and `Plant/AmbientTemp` in `default`; existing specs keep their expectations except the resolve note's words. Contract 0.4.0's docs, `CHANGELOG.md` and `docs/operations.md` (the log lines and how to mend a row) say all of it. No em dashes.

**Never:** Rewriting or deleting a stored row; a migration; the tag browser's card, tree or pickers (13b, 13c); a new message type; a value-source column in `tags.browse` (pick 6); bumping the contract version (0.4.0 is unreleased).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| G1 Save refused | A kind setup with `{asset.path}/a//b`, with `{asset.path}/a[0]`, with `[default]a//b` | Refused `invalid`, the part and the reason in words | Nothing saved |
| G2 Param | A popup param `{asset.path}/a//b` | Refused the same way | Nothing saved |
| G3 Override | An item's override path `[default]a//b` | Refused; the browser's check says the same words first | Nothing sent from the screen |
| G4 Good paths | Every path of the dev and showcase seeds, and the template's documented ones | Accepted as before | No error expected |
| G5 Stored bad row | A setup stored with `//` (put there directly) | One warning naming it at the first read; the map loads and draws; its next save is refused | Never rewritten |
| G6 Failing items | `{asset.path}/Pressure` on the dev pads | `n` 4, `m` 5, `failing` naming P15; the note names it | No error expected |
| G7 Many failing | 25 items failing | 20 in `failing`, `failingMore` 5 | No error expected |
| G8 All resolve, or a full path | `n` equals `m`; `relative` false | No `failing` | No error expected |
| G9 Viewer | A viewer asks `tags.resolve` | Refused `role` before any tag is read, as today | Nothing of the items sent |
| G10 Provider | The second provider browsed; then stopped | Its tags listed; then `tags-unavailable` naming it | An unlisted name stays `invalid` |

</frozen-after-approval>

## Code Map

- `common/src/main/java/.../common/contract/TagPaths.java` -- `parseFull` :74 (refuses `//`, brackets, braces), `resolve` :113, `relative` :146-166; the rule to keep.
- `common/.../contract/Placeholders.java` -- `checkTagPath` :145, `isAssetSuffix` :165 (braces only), `isFullPath` :175 (accepts `[default]a//b`), `checkParam` :119-137 (suffix at :129); `KindSetup.java` `tagPath` :415-428, called for comms :83, alarms :89, kpis :137, a rule's path :249, params :171.
- `gateway/.../write/WriteService.java` :352 (kind setups) and `ItemCheck.java` :60 (overrides, on every item write, :376); refusal form :436-438.
- `gateway/.../tags/TagLookups.java` -- `browseReply` :71, `resolveReply` :116 (`n`, `m` :154-182), role message :53, provider lookup :87-99 (a null provider reads as not found), bad quality :226, words :243, :256; `IgnitionTagSource.java` `TIMEOUT_MS` :51.
- The store's first read per project: where `map.load` and the live cache read kind setups and items (`MapLoader.java`); log conventions as `M.adapters` (`docs/kinds-and-assets.md` :112).
- Tests: `PlaceholdersTest` :70-109, `TagPathsTest`, `KindSetupTest`, `WriteServiceKindCheckTest`, `gateway/src/test/.../script/DevSeedTest.java` with `seed_harness.py` (both seeds), `ops/store-checks.sh` (its `upgrade` scenario as the model for a stored bad row).
- Browser: `web/typescript/messages.ts` resolve reader :218-230, `kindSetup.ts` `ResolveState` :780, `resolveNote` :809; `itemOverrides.ts` `isAssetSuffix` :76, `isFullTagPath` :86, `pathProblem` :96; `MapStudioStoreDelegate.ts` `onResolveReply` :676.
- Dev fixtures: `ops/config/core/ignition/tag-provider/default` (the one provider), the dev tags (UDT Pad: Pressure, Flow, Comms, Status; Mesa/P12, P14, CTB1, SWD1, Mesa/P15 with Flow only; Plant/Header/Pressure); `e2e/lib/gateway.mjs` (the API token for REST, to stop a provider); `e2e/tests/tags.spec.mjs`; `kinds.spec.mjs` :186 ("of 5 well pads").
- Docs: `docs/contract.md` :19-22, :78-112, `docs/kind-setup.md` :25, `docs/template-install.md` :15 (the template's paths), `docs/operations.md`, `docs/platform-checks.md`; deferred-work :75-77 (the two rules) and backlog story 39 are closed by this.

## Tasks & Acceptance

**Execution:**
- [ ] `Placeholders.java`, `KindSetup.java`, with `PlaceholdersTest`, `KindSetupTest`, `WriteServiceKindCheckTest` -- the one rule for every stored path, tests first -- G1 to G4.
- [ ] A seeds test (the `DevSeedTest` harness) -- every path of both seeds and the template's documented ones passes -- G4.
- [ ] The stored-row report on the Gateway, with a unit test and an `ops/store-checks.sh` scenario -- G5.
- [ ] `TagLookups.java`, `common/` reply, tests -- `failing`, `failingMore`; the provider answers -- G6 to G10.
- [ ] `web/typescript/messages.ts`, `kindSetup.ts`, `itemOverrides.ts`, Jest -- the note's names; the override check aligned -- G3, G6, G7.
- [ ] `ops/config` (the second provider, `Plant/AmbientTemp`), `e2e/tests/tags.spec.mjs`, `kinds.spec.mjs` -- G1, G6, G9, G10 live; ignition-lint on the changed Ignition files.
- [ ] Docs, `CHANGELOG.md`, playbook section 8p.

**Acceptance Criteria:**
- Given the dev Gateway, when a kind setup with a double slash in a path is saved, then it is refused in words, and every setup the seeds store still saves.
- Given a store holding a row the rule refuses, when the Gateway starts and the map is opened, then the row is named in the log, nothing is rewritten and the map draws as before.

## Implementation Notes

- Planner, 2026-11-11: the environment and identity rules are entry 8's plan's (Docker by hand after a restart, JDK 17, `ops/up.sh --fresh` before a whole-suite run and after any `ops/config` change, no em dashes, never a bare `git stash`, never a push). Leave the work uncommitted: the orchestrator commits after the whole suite. Two findings of the survey to settle while building: a stopped provider probably answers `invalid` today (`provider()` null, :99); and the dev pads are five, so the ticket's "2 of 3" reads "4 of 5".

## Plan Change Log

## Review Triage Log

## Design Notes

A row that fails the rule is refused only at its next save, and a kind setup is saved whole: an editor who opens that kind meets the refusal beside the path on the first field they finish, which is where it can be mended. The log line at start is how an administrator learns of it before then.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK
- `ops/store-checks.sh` with the new scenario -- expected: passed
- `ops/up.sh --fresh`, then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: 0 failed
