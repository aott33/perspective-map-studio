---
title: "Release 0.2.0 on the template's test stack"
type: 'chore'
ticket: '13'
created: '2026-10-27'
status: 'in-progress'
baseline_revision: '3907248520a02e277c515715e8f82b754a8f8509'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'invocation'
lenses_ran: ['quick']
review_loop_iteration: 1
context:
  - '{project-root}/RELEASING.md'
  - '{project-root}/docs/template-install.md'
  - '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-install-through-the-template-s-module-lock-plan.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Epic 2 changed the public contract (map store, setup, kinds and assets, kind setups, scripting API, new message types), but every artifact still says "0.2.0 draft", the template's lock pins 0.1.0, and nothing proves the epic's last Done when line: a signed 0.2.0, installed through the template's module lock, passes the template's test stack with a scratch project whose setup names a PostgreSQL connection, and an edit from one browser shows in a second and survives a Gateway restart.

**Approach:** One Map Studio pull request finalises 0.2.0 (contract out of draft, version points, CHANGELOG, a doc check that every contract names its version); after the owner's gates (story 16 merged, ER-27 engineering review, Designer checks) the owner tags v0.2.0 and approves the `release` environment. Then, in a scratch clone of `ign-scada-template` (the shared checkout is never touched), `modl.py check --write` moves the lock to 0.2.0, the template's local CI equivalent and `scripts/test/stack.sh` run, and on the kept stack a never-committed scratch project with a `MapStudio` connection is driven by two browsers and a Gateway restart. Evidence goes to `docs/template-install.md`; the template change becomes one draft pull request the owner merges.

## Boundaries & Constraints

**Always:** Template rules (its CLAUDE.md): modules only through `modules/modules.lock.json` and `scripts/modules/modl.py`; never commit a `.modl`; lock fields come from the downloaded module (`check --write`, `inspect`), `sha256` equals the release `.sha256`, `certSha256` equals this README's line; run what CI runs (`scripts/ci/local.sh`) because the template's Actions budget may be exhausted; `scripts/test/stack.sh` on the committed branch. Plain `x.y.z` tag on `main`; the signing job waits for the owner in the `release` environment and only drafts; the owner publishes. Every Ignition claim seen only on the template stack is labelled **[live 8.3.9]**, everything else stays **[unverified]**. Gateway config on the test stack (connection resource, config scan, restart) is written only on the throwaway test Gateway this plan creates, under this approved plan. No password, token or secret value in git, a log, a screenshot or a command line (passwords stay inside the container or in git-ignored files). No em dashes.

**Never:** Edit, commit or push in `/home/user/ign-scada-template`; change the template's map pages, `map_draft` tables, `projects/Upstream`, generators, compose files, image version (8.3.9) or `.claude/skills`; commit the scratch project or the `MapStudio` connection to the template (epic-template-cutover owns that); tag, publish or merge on the owner's behalf; release with ER-27 not approved; change module behaviour in the version pull request (a defect found here stops the release and becomes its own fix, then a new tag).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Release | `v0.2.0` on `main`, owner approves `release` | draft with `Map-Studio-0.2.0.modl` and `.sha256`; owner publishes | bad tag, off `main`, fingerprint or version mismatch: no release |
| Lock update | `modl.py check --write` in scratch clone | entry 0.2.0, new `sha256`, same `certSha256`, `upstream.tag` v0.2.0; `fetch` prints `ok ... 0.2.0` | changed certificate or Ignition > 8.3.9: rejected, stop |
| Two browsers | both signed in as `render-engineer` on `/edit` | a line drawn in A shows in B within a few seconds, no reload | not shown: fail, logs kept |
| Restart | `restart` of the test Gateway | after RUNNING, B reloads and draws the line; `mapstudio_items` row and edit record (actor `render-engineer`) present | missing: release check fails |
| No editing role | `render-pumper` (role not in setup) | `map.load` level `none`, save refused `role`, nothing written | as contract |
| Module on 8.3.9 | 0.2.0 on the template image | ACTIVE, migrations to schema 2 on the empty `mapstudio` database, no Map Studio error | fails: stop, report, no image bump |

## Decisions

Decision 2026-10-27 (owner: "agree with all recommendations, start"; all eight recommended answers):
1. Rehearse before the tag: a throwaway-signed build of the version branch goes through a scratch template copy, `local.sh`, `stack.sh` and the scratch checks; repeated on the published release.
2. The test stack's `MapStudio` connection uses its own role and database created inside the stack's PostgreSQL, its password the stack's generated `db_password` value, read and set inside the container (passed by environment, never on a command line or in a file), so the connection references the existing `UpstreamFiles/db_password` secret; connection file only in the stack's worktree, never committed.
3. Scratch setup roles: full `engineer`, phone `operator`; `render-pumper` is the user without an editing role.
4. Also close the extra live checks: a phone editor's line refused, a signed-in user without an editing role, a `storage` event between two tabs, a browser closed and reopened, a second project getting no `map.changed`.
5. `CHANGELOG.md` plus `web`/`e2e` packages at 0.2.0 in the version pull request; Gradle default `0.3.0-SNAPSHOT` after the tag.
6. ER-27: the owner reviews the alarm glyphs and state examples before the tag; the release waits for it.
7. The template pull request is opened as a draft by Claude only on the owner's go; the owner merges.
8. The owner's Designer session happens before the tag, on the dev Gateway of `main`.

Decision 2026-10-27 (owner, after the rehearsal's `module_version` finding):
9. The `module_version` `dev` defect is fixed before the tag, in this branch: every module jar carries `Implementation-Version` = the build's version (the tag in a release, `x.y.z-SNAPSHOT` locally), the gateway reads it through `ModuleVersion`, `GatewayJarManifestTest` fails when the gateway jar's manifest lacks it and `MigratorTest` checks the migrator records the version it is given. Gate G4 is cleared by this fix.
10. Decision 2's wording: handing the test database password to `psql` on standard input (the shell's `printf` builtin, the value read inside the container) is accepted as meeting the decision: off the command line, out of logs and files.

</frozen-after-approval>

## Code Map

Map Studio (this repository):
- `common/.../common/Messages.java:26`, `web/typescript/contract.ts:11` -- `CONTRACT_VERSION = "0.2.0-draft"`; tests pin it: `common/src/test/.../contract/ContractTest.java:37`, `web/typescript/__tests__/contract.test.ts:24`.
- "draft" wording to finalise: `docs/contract.md` (title, "Since" column, 15 lines), `docs/kind-setup.md:1`, `docs/kinds-and-assets.md:1`, `docs/setup.md:102`, `README.md:12`, `NOTICE:26`, javadoc in `MapStudioScriptModule.java:13`, `MapLoader.java:135`, `web/typescript/adapters.ts:2`. Not the Designer's `draft` fields (`SetupWorkspace` "draft" is a new-setup tab).
- Version points: `build.gradle.kts:20` default `0.1.0-SNAPSHOT` (release uses `-PreleaseVersion` from the tag; `module.xml` is generated from it, nothing to edit); `web/package.json:3`, `e2e/package.json:3` and their lock roots `0.1.0`; `icons.json` and `web/icons/sources.json` already `0.2.0`. No CHANGELOG exists; `release.yml` uses `--generate-notes`.
- R14 docs, each must name its version: setup schema `docs/setup.md` (schema 1), kind list and asset contract `docs/kinds-and-assets.md`, kind setup schema `docs/kind-setup.md`, map item record, messages, map store schema 2 and scripting API `docs/contract.md`, adapters `docs/examples/adapters/`.
- `.github/workflows/release.yml` (job `build-sign` in `environment: release`, `draft` job), `RELEASING.md` (lock entry shape, cutting a release), `scripts/ci/modl-verify.sh`, `scripts/ci/build-signed.sh`, `scripts/ci/test-signing.sh` -- unchanged; README fingerprint line already set (`8F:93:...:38:3D`).
- `ops/project/**` -- source of the scratch project: views `MapStudioDev`, `MapStudioEdit` (draw a line, the epic's browser edit), `Popups/PointDetails`, `page-config` (`/`, `/edit`), `com.aoindustrial.perspective.mapstudio/setup/setup.json` (connection `MapStudio`, roles `MapEditor`/`MapOperator`, functions `mapstudio_dev.kinds`/`.assets`), `ignition/script-python/mapstudio_dev`. Do not copy `global-props/data.bin` (dev IdP); set the scratch project's IdP with `PUT /data/api/v1/projects/<name> {"identityProvider": ...}` as `docs/platform-checks.md` "Facts learned" did.
- `docs/template-install.md` -- 0.1.0 evidence format; add a 0.2.0 section. `docs/platform-checks.md` -- move items to **[live 8.3.9]** only where seen. `_bmad-output/deferred-work.md:79-81` -- the sweep's live-check entry routed here.
- Prerequisite: story 16 (`3907248`, status `in-review`) is not on `origin/main` (`1d5b4f9`); the tag needs it merged.

Template (read only here; changed only in the scratch clone):
- `modules/modules.lock.json:65-76` -- Map Studio 0.1.0 entry; `modl.py check --write` (`cmd_check`, line 311) downloads the latest github release, rejects a new certificate, updates `version,file,url,sha256,requiredIgnitionVersion,upstream.tag`.
- `docs/modules.md:76` (version 0.1.0 row), `:242` (history), `THIRD_PARTY_NOTICES.md:9` (bundles list; 0.2.0 also bundles Tabler Icons, MIT, per this `NOTICE`).
- `docker-compose.yml` `db` (postgres:16, db `upstream`, user `upstream`, secret `db_password`); `config/resources/core/ignition/database-connection/upstream/config.json` (shape to copy; password `Referenced` to provider `UpstreamFiles`, secret `db_password`); config is bind-mounted from the stack's worktree, projects from `./projects`.
- `scripts/test/stack.sh` (`--keep`, `--down`; worktree `build/test-stack`, compose project `ign-og-test`, Gateway port 8089; copies `services/ignition/modules/*` from the clone's tree); `scripts/gw/render_users.py` (users `render-<role>` for `pumper, operator, engineer, supervisor, integrator`, passwords in git-ignored `secrets/render_users.json`); `scripts/ci/local.sh` (PG parts need `PGHOST`).

## Tasks & Acceptance

**Gates before the tag (owner, hitl):**
- G1 Story 16 reviewed and merged to `main`; CI green on `main`.
- G2 ER-27 engineering review of the alarm presentation 0.2.0 ships: the alarm glyphs and state examples on `/res/mapstudio/icons/contact-sheet.html` and the differences listed in `docs/icons.md` "Differences from the template's reviewed set". Recorded with reviewer and date in `docs/icons.md`. Changes asked for are fixed before the tag.
- G3 Designer session on the dev Gateway of `main`: story 16 steps 1 to 8, story 7's open items, story 11's autocomplete text (`system.mapstudio.` shows `getMap`, `applyEdits`, `refreshAdapters`, `ping`). Results into `docs/platform-checks.md` as **[owner, seen in the Designer, date]**.
- G4 The rehearsal's `module_version` `dev` finding (`docs/template-install.md`, "0.2.0 rehearsal", Findings): under the Never rule above it stops the release; its fix lands before the tag. **Cleared 2026-10-27 (Decision 9):** the fix is in this branch (manifest `Implementation-Version` from the Gradle version, `ModuleVersion`, `GatewayJarManifestTest`, `MigratorTest`); a build with `-PreleaseVersion=0.2.0` (the way `build-signed.sh` passes the tag) puts `Implementation-Version: 0.2.0` in every jar of the `.modl`.

**Execution (me):**
- [x] `common/.../Messages.java`, `web/typescript/contract.ts`, `ContractTest.java`, `contract.test.ts` -- `CONTRACT_VERSION` `"0.2.0"`.
- [x] `docs/contract.md`, `docs/kind-setup.md`, `docs/kinds-and-assets.md`, `docs/setup.md`, `README.md`, `NOTICE`, javadoc and TS comments in the Code Map -- "0.2.0 draft" becomes "0.2.0"; contract title "version 0.2.0"; README status line says 0.2.0 is released through the template's lock.
- [x] `web/package.json`, `e2e/package.json` and lock roots -- `0.2.0` (`npm version 0.2.0 --no-git-tag-version`); `build.gradle.kts:20` stays until after the tag (Decision 5: `0.3.0-SNAPSHOT` then).
- [x] `CHANGELOG.md` (new, per Decision 5) -- 0.1.0 (spike) and 0.2.0 (contract, map store schema 2, setup schema 1, scripting API, icons, Designer setup form), with the "Since" versions from `docs/contract.md`.
- [x] `scripts/ci/check-contract-versions.sh` (new, run in CI `build` job) -- fails when a R14 doc lacks its version heading or any of the files above still says `0.2.0 draft`/`0.2.0-draft`.
- [x] Rehearsal (Decision 1): throwaway-signed build of the version branch in a scratch template copy, local.sh, stack.sh and the kept-stack checks, nothing committed in the template (2026-10-27, `docs/template-install.md` "0.2.0 rehearsal"; also `license.html` carries Tabler Icons' MIT notice, `test-contract-versions.sh` proves the check).
- [ ] After the release: scratch clone of the template (`git clone /home/user/ign-scada-template`, scratchpad, branch `map-studio-0.2.0`); `python3 -I scripts/modules/modl.py check --write` then `fetch`, `inspect`, `verify-lock`; `sha256` equals the release file, `certSha256` unchanged; `scripts/ci/modl-verify.sh` with the README fingerprint and `0.2.0`.
- [ ] Template `docs/modules.md` (row 0.2.0, history line), `THIRD_PARTY_NOTICES.md` (adds Tabler Icons, MIT) -- one commit.
- [ ] `scripts/ci/local.sh` in the clone, all steps (PG parts against a throwaway postgres:16), then `scripts/test/stack.sh --keep`: `test stack: PASS`.
- [ ] Kept stack: in the db container create role `mapstudio` (LOGIN) with the `db_password` secret's value read inside the container and database `mapstudio` owned by it; `build/test-stack/config/resources/core/ignition/database-connection/MapStudio/{config.json,resource.json}` (copy of `upstream`, URL `.../mapstudio`, user `mapstudio`); `POST /data/api/v1/scan/config`; project `MapStudioScratch` from `ops/project` (setup roles per Decision 3) in `build/test-stack/projects/`; `POST /data/api/v1/scan/projects`; set its IdP.
- [ ] Scratch Playwright script (scratchpad, model `ops/screenshot.mjs`): two browsers as `render-engineer` on `/edit`, line drawn in A shows in B without reload; close both; `docker compose -p ign-og-test restart ignition` [unverified service name]; B reopens and draws it; `psql` shows the item and its edit record actor; extra checks per Decision 4; screenshots at 1440 and 390 px. Then `stack.sh --down`.
- [ ] `docs/template-install.md` (0.2.0 section), `docs/platform-checks.md`, `docs/screenshots/template-0.2.0-*.png`, `_bmad-output/deferred-work.md` (`resolved:` line on the sweep entry for what closed) -- evidence.
- [ ] Template pull request (draft) from the clone's branch, per Decision 7.

**Acceptance Criteria:**
- Given the version pull request, when `./gradlew build`, `npm test` and `check-contract-versions.sh` run, then they pass and no file says `0.2.0 draft`.
- Given published v0.2.0, when the template branch runs `local.sh` and `stack.sh`, then both pass and `smoke.sh` shows Map Studio 0.2.0 ACTIVE.
- Given the scratch project, when an edit is made in one browser, then the other shows it within a few seconds, and after a Gateway restart it is drawn again and is in `mapstudio_` tables with its actor.
- Given both repositories, when searched, then no `.modl`, password, token or scratch project file is committed.

## Owner steps (hitl; Claude cannot do these)

1. G1, G2 (ER-27) and G3 above (G4 cleared and the Decision 2 wording accepted: Decisions 9 and 10, 2026-10-27).
2. Merge the version pull request; tag `v0.2.0` on `main` and push the tag.
3. Approve the `build-sign` job under Review deployments (`release` environment); review the draft (`modl-verify.sh`), publish it.
4. Review and merge the template pull request (after `local.sh` and `stack.sh` evidence in its body, since its Actions may not run).

## Design Notes

Release order: version PR, G1 to G3, tag, approval, publish, lock update, local CI, stack, scratch checks, evidence PR, template PR. The release check runs on the published asset, so a defect found after the tag costs a 0.2.1; the rehearsal moves that risk before the tag. The `MapStudio` connection uses its own role and database (owner decision 2026-10-26) but reuses the stack's `db_password` value so no new secret or compose change is needed; that is acceptable only on the throwaway stack.

What it proves: 0.2.0 installs by lock on 8.3.9, migrates an empty database, saves through the browser write path with role checks, pushes `map.changed` across browsers and persists over a restart. What stays: redundancy, slow tag system, `onShutdown`, the template's real Mesa field (epic-template-cutover), and anything the owner's Designer session does not cover.

## Verification

**Commands:**
- `./gradlew clean build && (cd web && npm test) && bash scripts/ci/check-contract-versions.sh` -- expected: pass
- `git grep -n -E '0\.2\.0[- ]draft|0\.2\.0 \(draft\)'` -- expected: no output outside `_bmad-output`
- template clone: `python3 -I scripts/modules/modl.py verify-lock && python3 -I scripts/modules/modl.py fetch` -- expected: `ok com.aoindustrial.perspective.mapstudio 0.2.0`
- template clone: `scripts/ci/local.sh` then `scripts/test/stack.sh --keep` -- expected: exit 0, `test stack: PASS`
- `git grep -I -n -E 'ghp_|github_pat_|BEGIN [A-Z ]*PRIVATE KEY'` in both -- expected: no output

**Manual checks:**
- Screenshots of both browsers before and after the restart, read by the owner.

## Review Triage Log

**2026-10-27, lens quick (context-free), review of `3907248..74428ee`, iteration 1.** Eight findings; seven patched, one partly rejected.

| # | Finding | Triage | What changed |
| --- | --- | --- | --- |
| 1 | `docs/icons.md:3` still said "(draft"; the CI draft search missed bold, comma, "in draft" and "Draft: ... 0.2.0" forms | patch | icons.md line fixed; `check-contract-versions.sh` searches version-then-draft and draft-then-version (case-insensitive); `test-contract-versions.sh` refuses the comma, "in draft", bold and "Draft:" forms |
| 2 | CHANGELOG check only compared with `CONTRACT_VERSION`, release.yml never ran it, RELEASING.md claimed more | patch | new `scripts/ci/check-release-version.sh X.Y.Z` (CHANGELOG `## X.Y.Z`, `web` and `e2e` package versions), run with `check-contract-versions.sh` in `release.yml` `build-sign` before signing; negative cases in `test-contract-versions.sh`; RELEASING.md says what each check does |
| 3 | git-mode draft search never tested; errors hidden by `2>/dev/null \|\| true` | patch | negative and positive case in a `git init` copy; the script fails when the file list is empty or misses `docs/contract.md`, and on a grep error (only "no match" passes) |
| 4 | CHANGELOG listed `invalid` as new (it is in v0.1.0) and left out `kindSetups` and `user` | patch | `invalid` dropped from "new"; `map.load.reply` names `kindSetups` (phone and full) and the optional `user` |
| 5 | Old **[unverified]** lines left beside the new rehearsal section | patch | `docs/contract.md` (another project's maps) and `docs/platform-checks.md` (user without an editing role, real browser reopened, `storage` between tabs) now carry **[live 8.3.9, rehearsal, throwaway-signed]** with a pointer to "Epic 2 story 13"; the 8.3.10 labels stay |
| 6 | Rehearsal evidence claimed more than was run | patch | template-install.md says "the same way as" CI's signing check (2 days and its own CN there); platform-checks row says the lock entry was hand-written from `inspect`, `fetch` downloaded nothing, `check --write` was not run |
| 7 | `module_version` `dev` written as optional to fix, against the Never rule | patch | template-install.md and deferred-work.md say it blocks the tag unless the owner waives it in Decisions; new gate G4. No waiver was given: the relayed "agree with all recommendations, start" answered the eight decisions above, before this finding existed |
| 8 | Plan record and stale version text | patch, part rejected | "Open Question N" now "Decision N"; RELEASING.md example uses `vX.Y.Z`; README says 0.2.0 is for a host to install through its lock once published and that the template still pins 0.1.0. Rejected: changing `build.gradle.kts:20` (`0.1.0-SNAPSHOT`), which follows owner Decision 5 (`0.3.0-SNAPSHOT` after the tag; the release takes its version from the tag). Not changed: Decision 2 says the password is "passed by environment"; the rehearsal handed it to `psql` on standard input with the shell's `printf` builtin, which keeps the decision's intent (never on a command line, in a log or a file). The owner accepted that wording on 2026-10-27 (Decision 10) |

Re-run after the patches (2026-10-27): `./gradlew clean build` (JDK 17) passed, 445 JUnit tests, 0 failures, 1 skipped; `web` `tsc --noEmit` clean and Jest 17 suites, 145 tests passed; `check-contract-versions.sh` OK (contract 0.2.0, setup schema 1, map store schema 2), `test-contract-versions.sh` OK (15 refusals plus the git work tree and five release-version cases), `check-release-version.sh 0.2.0` OK. The template rehearsal was not repeated: no finding showed its evidence wrong, only its wording (findings 5 and 6). Plan stays in-progress: gates G1 to G4, the tag and the published-release steps are ahead.

G4 fix (2026-10-27, Decision 9): `./gradlew clean build` (JDK 17) passed, 450 JUnit tests, 0 failures, 1 skipped (five new: `GatewayJarManifestTest` 3, `MigratorTest` 2); every jar's manifest says `Implementation-Version: 0.1.0-SNAPSHOT` locally and `0.2.0` with `-PreleaseVersion=0.2.0`, inside `Map-Studio.unsigned.modl` too; with the manifest block removed `GatewayJarManifestTest` fails (2 of 3), so the test guards the fix; `check-contract-versions.sh`, `test-contract-versions.sh` and `check-release-version.sh 0.2.0` OK.

