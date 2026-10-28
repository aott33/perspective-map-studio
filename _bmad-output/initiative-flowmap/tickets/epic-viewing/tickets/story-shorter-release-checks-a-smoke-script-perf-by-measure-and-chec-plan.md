---
title: 'Shorter release checks: a smoke script, perf by measure and checks matched to the release type'
type: 'chore'
ticket: '4'
created: '2026-10-28'
status: 'built'
baseline_revision: '2cdef3f7e13b6fff30613356da333d06d6edd226'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'coordinator'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/handoff-epic-3.md'
  - '{project-root}/docs/template-install.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The 0.2.0 release was proven twice by hand (a throwaway-signed rehearsal before the tag, the published asset after it), each time repeating the template's whole `local.sh` and full test stack, with scratch Playwright scripts rewritten per release. The next releases need the same assurance in a fraction of the time, from committed scripts.

**Approach:** Match the checks to the release type in `RELEASING.md`; add `ops/release-smoke.sh <version>` (lock entry, download, fingerprint, a Gateway with a database only, module ACTIVE, one save seen in a second browser, `module_version` in the store) driven by committed browser checks in `e2e/rehearsal/`; add `ops/perf.sh --only <measures>` with a comparison against the last record in `docs/perf/`.

## Decisions (owner, 2026-10-28)

- Entry 4 is first in epic 3's build order so this epic's release uses it.
- The template stays on 0.1.0 until the cutover (epic-template-cutover), so the smoke must not depend on the template's committed lock holding the version: it takes the lock entry from a file or a template checkout when given, and by default builds the expected entry from `RELEASING.md`'s lock-entry shape plus the published release's values (the `.sha256` asset and the README fingerprint).
- Never: edit `ign-scada-template`, commit a `.modl`, password, token or scratch project, or weaken a check CI runs. Map Studio CI stays unchanged.

## Boundaries & Constraints

**Always:** the smoke fails clearly and early on a wrong SHA-256, a wrong certificate fingerprint and a `module_version` that does not match, and each failure path can be provoked without editing the script (env overrides, a lock file); secrets (the admin password, the dev users' passwords, the API token, the PostgreSQL password) are read from files or the environment inside the scripts and never printed or written under `e2e/out` (the run greps for them); the smoke's stack is its own compose project with fresh volumes, removed on exit; every fact in the docs carries a label as `docs/template-install.md` does (**[live 8.3.9]**, **[not verified]**, and this story's **[live 8.3.9, plain image]** for what ran here on `inductiveautomation/ignition:8.3.9` with the published module, not the template's image); no em dashes.

**Never:** a change to Gateway or component production code; a scratch script outside the repository for a release check; `ops/perf.sh --only` writing a `docs/perf/` record (a partial record must not replace a full one); a dependency of the smoke on the `ign-scada-template` checkout or image being present (both are optional inputs with a fallback).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Published release | `ops/release-smoke.sh 0.2.0`, Docker up, the plain 8.3.9 image or the template's | every check `ok`, a summary with the duration, exit 0, no container or volume of the smoke left | a failing check prints `x` with the values and exits 1 |
| Wrong SHA-256 | `SMOKE_SHA256=<other>` or a lock file whose `sha256` differs | fails after the download, before any container starts, naming both values | exit 1 |
| Wrong certificate | `SMOKE_CERT_SHA256=<other>` or a lock file whose `certSha256` differs | `modl-verify.sh` refuses the file, before any container starts | exit 1 |
| `module_version` mismatch | `SMOKE_MODULE_VERSION=<other>` | the Gateway starts, the module is ACTIVE, the save is seen, then the store check names every `mapstudio_schema_version` row that differs | exit 1, the stack still removed |
| Lock from the template | `--template <dir>` or `--lock <file>` | the entry with the module id and the version is compared field by field with the expected entry; a lock without that version says so and names the owner decision | exit 1 |
| Template image missing | no `ign-og/ignition:8.3.9-modules` locally, no `--image` | the plain `inductiveautomation/ignition:8.3.9` is used and the summary says which image ran | none |
| `perf --only` | `ops/perf.sh --only edits.apply` | only the 5,000-item test's `edits.apply` block runs (seeding as needed), then the comparison with the last `docs/perf/*-dev.json` record, rows of `edits.apply` only | an unknown measure name is refused with the list of names, exit 2; `PERF_RECORD` with `--only` is refused |

</frozen-after-approval>

## Code Map

- `ops/lib.sh` -- `COMPOSE`, `GATEWAY_URL`, `MAPSTUDIO_CONTAINER`, `wait_for_commissioned`, `wait_for_bundle`, `ensure_secrets`, `ensure_dev_security`, `ensure_dev_users`: the smoke sources it and re-points those at its own compose project and port.
- `ops/docker-compose.yml` -- the dev stack: the smoke reuses it with an overlay (`ops/docker-compose.smoke.yml`) that swaps the image, mounts the downloaded module and drops `-Dignition.allowunsignedmodules=true`, so the Gateway's own signature check runs.
- `ops/perf.sh`, `e2e/perf/perf.spec.mjs`, `e2e/perf/compare.mjs`, `e2e/perf/result.mjs` -- the perf run: phases, the measure blocks per test, the headline rows of a comparison.
- `scripts/ci/modl-verify.sh` -- structure, fingerprint and version check of a signed `.modl`; the smoke calls it.
- `e2e/tests/fixtures.mjs`, `e2e/lib/editorAuth.mjs`, `e2e/lib/env.mjs` -- `signedInContext`, `openMap`, `mapLoaded`, `drawLine`, `watch`, `launchOptions`, `gatewayUrl`: reused by the rehearsal spec.
- `e2e/tests/changes.spec.mjs` -- the model for "a save seen on another open map without a reload" (`data-items-loaded`, `data-map-reloads`, a page marker).
- `README.md` line "Signing certificate SHA-256:" -- the expected `certSha256`; `RELEASING.md` "Installing through a host's module lock" -- the lock-entry shape the default expected entry follows.
- `docs/template-install.md` "0.2.0 release" items 3, 4 and 6 -- what the smoke automates (module ACTIVE, `module_version`, the two-browser save).

## Tasks & Acceptance

**Execution:**
- [x] `ops/release-smoke.sh` -- the smoke: arguments, the expected entry, the optional lock, download and checks, the stack, the module check, the browser checks, the store check, the EXIT trap and the summary.
- [x] `ops/docker-compose.smoke.yml` -- the overlay: image from `SMOKE_IMAGE`, the module folder from `SMOKE_MODULES_DIR`, a command without `allowunsignedmodules`.
- [x] `e2e/rehearsal/release.spec.mjs`, `e2e/rehearsal/playwright.rehearsal.config.mjs` -- two Chromium instances signed in as the map editor; a line drawn in A is on B's map within 5 s with no reload; result written to `e2e/out/rehearsal/result.json`.
- [x] `e2e/perf/only.mjs`, `e2e/perf/perf.spec.mjs`, `e2e/perf/compare.mjs`, `e2e/perf/perf.test.mjs` -- the measure names, `PERF_ONLY`, `compare.mjs --only`, unit tests.
- [x] `ops/perf.sh` -- `--only <measures>`: phases from the measures, `PERF_RECORD` refused, the comparison with the last record after the merge.
- [x] `RELEASING.md`, `docs/perf/README.md`, `docs/platform-checks.md` -- the table of checks by release type, the smoke's usage and the owner decision, `--only`, the evidence of this story's runs.

**Acceptance Criteria:**
- Given Docker and the published v0.2.0, when `ops/release-smoke.sh 0.2.0` runs, then it exits 0 in well under 15 minutes, prints each check and the duration, and leaves no smoke container or volume.
- Given `SMOKE_SHA256`, `SMOKE_CERT_SHA256` or `SMOKE_MODULE_VERSION` set to another value, when the smoke runs, then it exits 1 naming that check, the first two before any container starts.
- Given the dev stack, when `ops/perf.sh --only edits.apply` runs, then only the `edits.apply` measures are taken and the comparison with `docs/perf/0.2.0-dev.json` prints their rows.
- Given `RELEASING.md`, then a table names the checks for every pull request, before a minor release's tag, after every tag and a patch, and the template pull request.

## Design Notes

**The smoke's stack is the dev stack under another name.** Compose project `<MAPSTUDIO_CONTAINER>-smoke`, port `SMOKE_HTTP_PORT` (default 9089), fresh volumes (`down -v` before and after), the dev project `ops/project` bind-mounted as `mapstudio-dev` (its `/edit` page is what the rehearsal signs in on, as the e2e suite does), PostgreSQL only: no field simulator, broker or feedback stub. The image is `--image` or `SMOKE_IMAGE`, else `ign-og/ignition:8.3.9-modules` when Docker has it, else `inductiveautomation/ignition:8.3.9` (the version the template pins). Without `allowunsignedmodules` the Gateway verifies the module's signatures itself, which `modl-verify.sh` cannot; `ACCEPT_MODULE_CERTS` accepts the certificate unattended.

**The expected entry.** `sha256` from the release's `.sha256` asset, `certSha256` from the README line, the rest from the version as `RELEASING.md` shows; `SMOKE_SHA256`, `SMOKE_CERT_SHA256` and `SMOKE_MODULE_VERSION` replace one value each, for the failure tests. A lock given with `--lock` or `--template` is compared with that entry (`id`, `version`, `file`, `url`, `sha256`, `certSha256`, `requiredIgnitionVersion`, `upstream.tag`), so a template whose lock already holds the version is checked the way `docs/template-install.md` did by hand, and one that does not (the owner decision) is not needed.

**`--only` runs blocks, not tests.** The perf spec's tests are per item count and seed incrementally, so a measure's block is skipped inside its test and a test with no wanted block is skipped; `edits.apply` alone still seeds to 5,000 items, which is its state. Names: `bundle`, `idle`, `map.load`, `open-to-drawn`, `frame-rate`, `map.changed`, `sessions`, `edits.apply`, `list-refresh`; `idle` and `sessions` need the `nomodule` phase too. The comparison is `compare.mjs` against the newest `docs/perf/<version>-<target>.json` by version, filtered to the wanted measures.

## Open Questions

None at planning: the owner's decisions of 2026-10-28 (handoff) settle the template question.

## Implementation Notes

- Built as planned. The `bmad-build` workflow's rendered steps were read for the plan format and the ticket resolution, but its human checkpoints could not be waited on in this unattended worktree session; the plan was written, the code built and verified, and the review is the coordinator's (`review_source: coordinator`).
- The smoke is the dev compose file under its own project: `ops/release-smoke.sh` sources `ops/lib.sh`, then re-points `MAPSTUDIO_CONTAINER` (`<name>-smoke`), `GATEWAY_HTTP_PORT` (`SMOKE_HTTP_PORT`, 9089), `GATEWAY_URL` and `COMPOSE` (the dev file plus `ops/docker-compose.smoke.yml`), so `ensure_secrets`, `ensure_dev_security`, `ensure_dev_users` and the waits work unchanged. `ensure_secrets` checks the smoke's own PostgreSQL volume name, so the dev stack's kept volume is never touched, and the two stacks run side by side.
- `GET /data/api/v1/modules/healthy` reports `version` as `0.2.0 (b0)` on 8.3.9 (the first run failed the ACTIVE check on the suffix); the check compares the first word.
- The downloaded `.modl` lives under the ignored `e2e/out/smoke/` (the compose overlay mounts `e2e/out/smoke/modules` as `/external-modules`); the EXIT trap deletes it from the mount folder, and `*.modl` is ignored by the repository anyway.
- `PW_CHROMIUM_PATH` defaults to `/opt/pw-browsers/chromium` when that file exists (the cloud box), as the hand-off's e2e command sets by hand.
- `shellcheck` for `ops/` runs from `ops/` (`cd ops && shellcheck -x release-smoke.sh perf.sh`), as story 17 noted, so `lib.sh` is followed; the installed shellcheck 0.11 adds SC2329 (a function only the trap calls), added to the two scripts' existing `disable=SC2317` line.
- The rehearsal's checks that the smoke does not repeat (a Gateway restart with the line kept, a user without a role, a phone editor's line, two tabs, a closed browser, a second project) are the template rehearsal's, before a minor tag; the smoke is the entry's short list.
- The template's image and checkout were not available in this session: `--image`, `--template` and `--lock` are built and the lock path is tested with files in the hand-off's entry shape; the template rows in `RELEASING.md` and `docs/platform-checks.md` are labelled **[not verified]**.
- `ops/perf.sh --only edits.apply`: PERF_RUN_NOTE

## Plan Change Log

## Review Triage Log

## Verification

**Commands run (2026-10-28 UTC, the 4-CPU agent box, Docker with `inductiveautomation/ignition:8.3.9` and `postgres:16-alpine` pulled for it; the numbers are in `docs/platform-checks.md`, "Epic 3 entry 4"):**
- `ops/release-smoke.sh 0.2.0` -- exit 0 in 1 min 35 s (a second run 1 min 27 s with `--lock` holding the hand-off's entry, 7 checks): SHA-256, `modl-verify.sh`, the Gateway RUNNING with the signed module and no `allowunsignedmodules`, `0.2.0 (b0) ACTIVE`, the line saved in A on B's map after 21 ms (13 and 49 ms in the other runs), `module_version` 0.2.0 on both schema rows, the stack removed, no secret under `e2e/out`.
- `SMOKE_SHA256=000...` -- exit 1 before any container, naming the downloaded, the expected and the release's SHA-256. `SMOKE_CERT_SHA256=00:11:...` -- exit 1 before any container, `modl-verify` naming both fingerprints. `SMOKE_MODULE_VERSION=9.9.9` -- the stack ran, exit 1 at the store check naming every row (`1=0.2.0 2=0.2.0`), 1 min 26 s. `--lock` with a wrong `sha256` -- exit 1 before the download naming the field; `--lock` with 0.1.0 only -- exit 1 naming the versions found and the owner decision.
- `cd e2e && npm run test:unit` -- 27 passed (the `--only` names, phases, headline mapping and `compare --only` among them). `node perf/only.mjs phases edits.apply` -- `main`; with `idle` -- `nomodule main`; `typo` -- exit 2 with the list. `node perf/compare.mjs ../docs/perf/0.2.0-dev.json ../docs/perf/0.2.0-template.json --only edits.apply` -- the ten `edits.apply` rows and nothing else.
- PERF_VERIFY_NOTE
- `cd ops && shellcheck -x release-smoke.sh perf.sh` -- exit 0. `bash -n` and `node --check` on every changed script -- clean. `bash scripts/ci/check-contract-versions.sh` -- OK. `cd e2e && npm ci && npx playwright test --list -c rehearsal/playwright.rehearsal.config.mjs` -- 1 test listed (`npm test` still lists only `tests/`).
- `grep -rnP '\xE2\x80\x94'` over every file this story touched -- no match.
- Map Studio CI: no workflow file changed; `e2e/playwright.config.mjs` (testDir `./tests`) does not pick up `e2e/rehearsal/`.

**Acceptance criteria:**
- The smoke on the published v0.2.0: exit 0, well under 15 minutes (1 min 35 s), each check and the duration printed, no smoke container or volume left (`docker ps -a` empty after each run): met on the plain 8.3.9 image; the template's image **[not verified]**.
- The three overrides each exit 1 naming their check, the first two before any container: met.
- `ops/perf.sh --only edits.apply` takes only those measures and prints the comparison with `docs/perf/0.2.0-dev.json`: PERF_AC_NOTE
- `RELEASING.md` holds the table of checks by release type: met ("Checks by release type").
