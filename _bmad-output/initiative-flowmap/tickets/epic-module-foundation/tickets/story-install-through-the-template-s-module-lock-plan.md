---
title: "Install through the template's module lock"
type: 'feature'
ticket: '6'
created: '2026-10-26'
status: 'in-progress'
baseline_revision: '0c6a191c0550beaa9aff02c2610bc16b87ab6541'
route: 'full'
route_source: 'pinned'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md'
  - '{project-root}/RELEASING.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Nothing proves that a signed Map Studio release installs the way a real host installs third-party modules: through `ign-scada-template`'s `modules/modules.lock.json`, pinned by SHA-256 and certificate fingerprint (R5, AD-13). No release exists yet, the Map Studio repository is private, and the template's `modl.py fetch` downloads without any credential.

**Approach:** One template pull request adds a lock entry for the released `.modl`, makes the fetch work for the chosen release source, and documents the module; it is proven on the template's test stack with a scratch Perspective project (placed only on the kept test stack, never committed) that shows the map. Until v0.1.0 exists the same change is rehearsed on a locally signed throwaway build that is never committed or pushed with its throwaway values.

**Decisions (owner, 2026-10-26):** (1) The release source is a public repository: the owner makes `aott33/perspective-flowmap` public before the template pull request, so the lock entry's GitHub release URL is fetched without a credential and there is no token and no credential change in `modl.py`. (2) The template's weekly `modules.yml` opens update pull requests for Map Studio like the other modules (the certificate pin still stops a new key). (3) The throwaway-build rehearsal runs now. (4) v0.1.0 is tagged as is; the story 3 spike package is removed later by the refactor sweep (entry 8).

## Boundaries & Constraints

**Always:** The template's CLAUDE.md governs that repo: load `ignition-config` and `ignition-security` there first, never edit `.claude/skills`, never commit a `.modl` (`.gitignore` blocks it), no credential in git (a token only in a secret store or the shell environment), `url` is https, lock fields are read from the module's own `module.xml` via `modl.py inspect`, `sha256` equals the release's `.sha256` file, `certSha256` equals the README line of this repository. The template change is its own pull request, opened as a draft (the Gateway jobs run only when it is ready for review). No em dashes.

**Never:** Edit, commit or run anything in `/home/user/ign-scada-template` from this planning session. Commit a throwaway sha or fingerprint to a pushed branch. Hand-create a view in the template's `projects/Upstream` (the generators own `views`, `check.py` fails on an orphan) or add a page to `scripts/gen/hmi`, `render_all.mjs` or the registry (that is epic 7). Bump the template's Gateway image (`IGNITION_VERSION` 8.3.9) in this pull request; if the module does not load on 8.3.9, stop and report (the platform checks ran on 8.3.10, so 8.3.9 is untested). Change the template's existing map pages. Accept a certificate by hand: the fingerprint comes from the README only.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Real release | v0.1.0 published, lock holds its sha256 and the README fingerprint | `modl.py fetch` prints `ok com.aoindustrial.perspective.mapstudio 0.1.0`; image builds; `smoke.sh` sees the module ACTIVE | none |
| Wrong hash | `.modl` differs from `sha256` | `fetch` prints FAIL and removes the file; bootstrap stops | Lock not changed to fit the file |
| Other certificate | signed by a key whose fingerprint differs | `fetch` FAIL "signing certificate changed" | Rotation is a human step (RELEASING.md) |
| Private repo, no credential | fetch with no token and no cached file | clear error naming the variable to set, no traceback | Never prints the token |
| Weekly update check | `modules.yml` runs `check --write` | Map Studio entry is checked or skipped by design; the job does not crash | Per Q2 |

</frozen-after-approval>

## Code Map

Map Studio repo (this worktree, docs only):
- `RELEASING.md`, `README.md` ("Releases and signing") -- already say the lock pins SHA-256 and fingerprint and that a rotation updates host locks; add a short "Installing through a module lock" section with the lock entry and the fetch path chosen in Q1.
- `scripts/ci/modl-verify.sh <file> <fingerprint> [version]` -- run on the downloaded release before the lock is written (structure and fingerprint only, not cryptographic).
- `ops/project/com.inductiveautomation.perspective/{views/MapStudioDev,page-config}`, `ops/project/project.json` -- the tracer's view (`ao.mapstudio`, props `popupView`) and page config; the source for the scratch project (copy, do not move). Component id `ao.mapstudio`; module id `com.aoindustrial.perspective.mapstudio`; `build.gradle.kts` sets `requiredIgnitionVersion` 8.3.0, `freeModule` true, licence Apache-2.0; release file `Map-Studio-<version>.modl` plus `.sha256` (release.yml).
- `docs/platform-checks.md` -- the dated-record format; new `docs/template-install.md` records this story's evidence with screenshots in `docs/screenshots` (AD-15).
- `gateway/.../spike/*`, `MapStudioGatewayHook.java` -- the story 3 spike code ships in the module (inert without a project `setup` resource); see Q4.

Template repo (read for this plan, changed only in the later template pull request):
- `modules/modules.lock.json` -- `ignition` 8.3.9; entries carry `id,name,version,requiredIgnitionVersion,file,url,sha256,certSha256,licence,upstream`. `verify-lock` requires `id,name,version,file,url,sha256,licence,upstream`, https, and `upstream.type` in `github|redirect`.
- `scripts/modules/modl.py` -- `download()` calls `http_get(url)` with no token (private release asset: unauthenticated GET fails, unverified exact status). `fetch` skips the download when `services/ignition/modules/<file>` already matches `sha256` and then verifies every signature with `openssl` and the cert fingerprint, prunes unlocked `.modl`. `gh_releases` sends `GITHUB_TOKEN` only to the releases listing and re-raises any HTTP error except 403/429, so a private repo (404 to a token without access) would crash `check` (read from the code, not run).
- `.github/workflows/modules.yml` (weekly `check --write`, `GITHUB_TOKEN` of the template repo), `stack.yml` (`scripts/gw/bootstrap.sh` runs `fetch` with no token on pull requests; fork pull requests get no secrets), `ci.yml` (`verify-lock`, `check_repo.py`, `gen/check.py`).
- `services/ignition/Dockerfile` copies `modules/*.modl` and `SHA256SUMS`; `scripts/gw/install_image_modules.py` and `smoke.sh` keep the Gateway equal to the lock; `modules.env` carries `ACCEPT_MODULE_CERTS`/`ACCEPT_MODULE_LICENSES` generated from the lock ids, so no manual acceptance.
- `scripts/test/stack.sh` -- builds a worktree of the committed HEAD (uncommitted changes are not tested) under `build/test-stack` (ignored), copies `services/ignition/modules/*` from the main tree, mounts `./projects` into the Gateway; `--keep` leaves it on port 8089.
- `docs/modules.md` ("Modules in use", "Adding a module"), `THIRD_PARTY_NOTICES.md` -- say "four modules from two vendors"; update with the fifth.
- Do not change: `projects/Upstream/**`, `scripts/gen/**`, `tests/render/render_all.mjs`, `.claude/skills/**`, the Dockerfile, compose files.

## Tasks & Acceptance

**Prerequisites (owner, outside this plan; Claude cannot do them):**
- P1 Signing setup per `RELEASING.md`: certificate `CN=Map Studio, O=AO Industrial`, secrets `MODULE_SIGNING_KEYSTORE_B64` and `MODULE_SIGNING_KEYSTORE_PASSWORD`, README `Signing certificate SHA-256:` line replacing `PENDING`.
- P2 CI green on `main`: both jobs currently fail within 3 seconds with no logs (owner checking). Tagging needs it.
- P3 Tag `v0.1.0` on `main`, review the draft release, publish it (draft releases are not downloadable without write access and are skipped by `check`).
- P4 The repository is public (decision 1), so the release asset URL needs no credential.

**Before P1 to P3 (rehearsal, no commit of throwaway values):**
- [x] Locally sign a throwaway build (`scripts/ci/test-signing.sh` shows how; JDK 17, throwaway keystore under `mktemp`, deleted after) and run the template's `modl.py inspect` on it -- first check that the template's openssl signature check accepts this plugin's output (unverified).
- [x] In a template branch kept local (never pushed): lock entry with the throwaway sha256 and fingerprint, the `.modl` in `services/ignition/modules/`, commit, `scripts/test/stack.sh --keep`, scratch project, screenshots. Then delete the branch and `scripts/test/stack.sh --down`.

**Execution (after P1 to P4; the template pull request waits for v0.1.0):**
- [ ] Template `modules/modules.lock.json` -- add the Map Studio entry from the downloaded asset (`modl.py inspect`, `modl-verify.sh`, equal to the `.sha256` file and the README fingerprint); `upstream`: `{"type":"github","repo":"aott33/perspective-flowmap","asset":"Map-Studio-.*\\.modl","tag":"v0.1.0"}`.
- [x] `scripts/ci/build-signed.sh` (this repo) -- found by the rehearsal: wrap the exported certificate in a PKCS#7 DER bundle before the plugin copies it as `certificates.p7b`; without it the template's `modl.py` (openssl pkcs7) failed on the bare PEM certificate. Template `modl.py` is unchanged (decisions 1 and 2: no credential change, check like the others).
- [ ] Template `docs/modules.md`, `THIRD_PARTY_NOTICES.md` -- fifth module, "three vendors" wording, Apache-2.0, history line. No workflow change.
- [x] Template scratch project -- on the kept stack only: copy `ops/project/...` view and page config into `build/test-stack/projects/MapStudioScratch/` with its own `project.json`; `POST /data/api/v1/scan/projects`; open `/data/perspective/client/MapStudioScratch` at 1440 px and 390 px; screenshots. Done as a rehearsal on the throwaway build; repeat once against v0.1.0.
- [x] This repo `docs/template-install.md`, `docs/screenshots/`, `RELEASING.md`, `README.md` -- the evidence (labels `[live 8.3.9]` only for what ran), the lock entry and the fetch path; feeds story 9. Written from the rehearsal; the real lock values are added after v0.1.0. `README.md` needed no change.

**Acceptance Criteria:**
- Given the published v0.1.0, when the template's `modl.py fetch` runs with the Q1 credential (or none if public), then it prints `ok` for Map Studio and the file's SHA-256 equals the release `.sha256`.
- Given the lock entry, when `scripts/test/stack.sh` runs, then it passes, `smoke.sh` reports the module ACTIVE, and the Gateway log shows no Map Studio error.
- Given the kept test stack with the scratch project, when the page is opened, then the map shows its three test points and one line, at 1440 px and 390 px, and a click logs the delegate reply.
- Given the template pull request, when searched, then it holds no `.modl`, token, throwaway sha or throwaway fingerprint.
- Given a wrong hash or other certificate, when `fetch` runs, then it fails as in the matrix.

## Implementation Notes

Rehearsal done 2026-10-26 (owner decisions 1 to 4 above); evidence in `docs/template-install.md`, screenshots in `docs/screenshots/template-scratch-*.png`. Everything template-side ran in a throwaway local clone of `ign-scada-template` (scratchpad, branch never pushed, origin is the local path) because the planning agent may not run git in the shared template checkout; the template checkout itself was not touched. The throwaway keystore, sha256 and fingerprint exist only in the scratchpad and that clone.

- Finding: the first throwaway build failed the template's `modl.py inspect` (`openssl pkcs7` on a bare PEM certificate in `certificates.p7b`). Fixed in this repository: `scripts/ci/build-signed.sh` wraps the certificate as PKCS#7 DER; `scripts/ci/modl-verify.sh` refuses a `certificates.p7b` that is not a PKCS#7 bundle (checked by hand with a module whose bundle was swapped for a bare certificate; no case in `test-signing.sh` yet). `test-signing.sh` passes. The template's `modl.py` needs no change.
- The module loads and runs on the template's 8.3.9 image (ACTIVE, component registered, delegate round trip, no Map Studio warning or error): the image does not need a bump.
- The scratch project is a copy of `ops/project` (view, page config, popup view, `project.json`) copied into the kept test stack's `build/test-stack/projects/MapStudioScratch`, loaded by a project scan; it is never committed. `ops/screenshot.mjs` was run against it with the project name and output folder changed in a scratchpad copy.
- One render failure in the first `stack.sh` run (`phone-native-night /well/Mesa/P12/P12-3H/trends`: `Cannot subscribe to "ProjectDefinition" state. "Parts/Asset/Trends/" does not exist`, an embed path whose type segment was still empty) looked like a template race, not Map Studio: the same page passed in `native-day`, and a re-run of the whole `phone-native-night` pass on the same stack had no failure. A full re-run on a fresh stack passed (`test stack: PASS`, exit 0). Not reproduced without the module: unverified whether the race predates Map Studio.

- Status (bmad-build `in-progress`, because the story is not done): the rehearsal and the signing fix are built and reviewed (quick lens, four patches applied); the real template pull request, the real lock entry and the repeat against v0.1.0 wait for the signed release. This part merges first so v0.1.0 is built with the PKCS#7 fix. The repository is public now and CI on `main` is green (owner, 2026-10-26).

## Plan Change Log

## Review Triage Log

Pass 1, lens `quick` (context-free session, run by the coordinator on the rehearsal diff). The lens confirmed that the PKCS#7 DER wrapping is correct for `modl.py` and `keytool`, that `release.yml` and CI are unaffected, that temp files and secrets are handled, and that no throwaway value is committed. Four findings, all verified real and all routed `patch` (smallest fix, no public surface):

| Verdict | Route | Finding and action |
|---|---|---|
| medium | patch | `modl-verify.sh` skipped the PKCS#7 check silently without openssl. Fixed: it now fails with "openssl is required". |
| medium | patch | `test-signing.sh` had no negative case for the bare certificate. Added: swap `certificates.p7b` for a bare PEM certificate, expect refusal. |
| low | patch | `RELEASING.md` still described the repository as private. Fixed: public wording; the old section is now "Release approval (optional)". |
| low | patch | `modl-verify.sh` header did not mention the PKCS#7 requirement. Fixed, deferred-work pointer kept. |

Deferred: the possible ign-scada-template race (phone-native-night trends page) as an entry in `_bmad-output/deferred-work.md`.

## Design Notes

Why a scratch project and not a view in `Upstream`: the writer empties the owned view folders and `check.py` fails on any view the generators did not produce, so a hand-placed view would be wiped or break CI. `build/` is ignored and `./projects` is a bind mount, so a project folder added to the kept test stack's worktree reaches the Gateway through a project scan (project scan picks up a new project folder without restart: unverified). A permanent Map Studio page waits for epic 7.

Private release asset (not needed after decision 1; kept for the record, all unverified): the browser URL needs a session; the API route is the asset endpoint with `Accept: application/octet-stream`, which answers a redirect to storage that must not receive the Authorization header. `gh release download <tag> -R aott33/perspective-flowmap -p '*.modl'` does this and uses `GH_TOKEN`. Local fetch needs no code: a downloaded file already in `services/ignition/modules/` whose sha256 matches is used as is, and `stack.sh` copies that folder into its worktree.

Checks from the template's "Before a pull request" that apply: `modl.py verify-lock`; `check_repo.py --jython tools/jython.jar` (JSON, `.modl` not tracked, em dashes); `gen/check.py` (proves no generated file moved); the new modl test with `python3 -I` plus its `ci.yml` step if `modl.py` changes; `docker compose config -q` and `bash -n`/`shellcheck -x` only if compose or shell files change (not planned); `scripts/test/stack.sh` (includes bootstrap, smoke and `render_all.mjs`) and a look at the screenshots. Not affected: theme and icons, `prov` (registry untouched), `tests/prov`, `tests/ui`, `tests/ops`, `tests/fieldsim`, plunger, lint baseline, feedback and db tests, `test_checks.mjs`. CI runs them all anyway.

## Verification

**Commands:**
- `bash scripts/ci/modl-verify.sh Map-Studio-0.1.0.modl "<README fingerprint>" 0.1.0` -- expected: prints the fingerprint, exit 0
- `python3 -I scripts/modules/modl.py inspect Map-Studio-0.1.0.modl` -- expected: `signaturesBad` empty, `certSha256` equals the README
- `python3 -I scripts/modules/modl.py verify-lock && python3 -I scripts/modules/modl.py fetch` (template) -- expected: `lock ok`, `ok com.aoindustrial.perspective.mapstudio`
- `scripts/test/stack.sh --keep` (template, committed branch) -- expected: exit 0, module ACTIVE
- `git grep -I -n -E 'ghp_|github_pat_|BEGIN [A-Z ]*PRIVATE KEY' -- .` in both repos -- expected: no output

**Manual checks:**
- Screenshots of the scratch page at 1440 px and 390 px, and the Gateway log lines for the module, read by the owner.
