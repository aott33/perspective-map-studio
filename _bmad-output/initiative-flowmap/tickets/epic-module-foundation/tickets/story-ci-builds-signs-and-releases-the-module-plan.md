---
title: 'CI builds, signs and releases the module'
type: 'feature'
ticket: '5'
created: '2026-10-26'
status: done
baseline_revision: '0fba47cdb46cd4c75b7c24055d7b1489d41f834c'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['self-review']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The module builds only on a developer machine and only unsigned. A Gateway that requires signed modules, and the template's module lock (story 6), need a signed `.modl` on GitHub whose certificate fingerprint is published.

**Approach:** Two GitHub Actions workflows. CI builds, tests and signing-checks every push and pull request, using a throwaway certificate generated per run. A release workflow, run only for a `vX.Y.Z` tag on `main`, signs with the owner's self-signed certificate held in repository secrets, verifies the signature and the README fingerprint, and attaches the `.modl` with its SHA-256 to a DRAFT release: the owner publishing the draft is the release approval (the repository is private on a plan without environment protection). Moving to a `release` environment later is a one-line workflow change. The owner creates the certificate and the secrets (see Owner steps); no key, password or certificate is ever committed.

## Boundaries & Constraints

**Always:** AD-13 and AD-14. Java 17 and the existing Gradle wrapper; `-PreleaseVersion` drives the version (already in `build.gradle.kts`); plain `x.y.z` tags only (Ignition's module version parser is numeric); every action pinned to a full commit SHA with its version in a comment; workflow `permissions: contents: read` by default, `contents: write` only in the release job; secrets are referenced only by the release job (an `environment: release` line is prepared as a comment for when the plan allows it); no `.modl` committed; no em dashes.

**Never:** a key, password, keystore or certificate in any committed file or log (use `::add-mask::` and files under `$RUNNER_TEMP`, never `-P` passwords on a command line the log echoes); signing on push, pull request or fork runs; a Gateway boot or Playwright in CI (story 7); any change to `ign-scada-template` (story 6); a prerelease or `-SNAPSHOT` version released; the owner's real key used in tests.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Push or PR | any branch, fork or not | Build and tests pass, unsigned `.modl` uploaded as a run artifact (7 days); signing check passes with a throwaway cert | Build, test or signing-check failure fails the run |
| Release tag | `v0.2.0` on `main`, secrets set, README fingerprint matches | Signed `Map-Studio.modl` plus `.sha256` published as release `v0.2.0` (draft, then public after upload) | none |
| Bad tag | `v0.2.0-rc.1`, or a tag not on `main` | Job stops before secrets are read | Error names the rule |
| Missing secret | a repository secret is missing | Job stops with the secret names | Error lists both names, never values |
| Fingerprint mismatch | cert in keystore differs from README line | No release created | Error prints both fingerprints (public values) |
| Unsigned artifact | `.modl` lacks `certificates.p7b` or `signatures.properties`, or a file is missing from `signatures.properties` | `modl-verify.sh` exits non-zero | Names the missing item |

</frozen-after-approval>

## Code Map

- `build.gradle.kts` -- already stamps version from `-PreleaseVersion` (strips `v`) and signs only when `-Pignition.signing.keystoreFile` is set; expects `keystoreFile`, `keystorePassword`, `certFile`, `certAlias`, `certPassword`. Reuse unchanged unless env-var passing fails (then use `-P` with masked values).
- Verified in this investigation (JDK 17, 1m57s): `./gradlew clean build -PreleaseVersion=v0.1.0 -Pignition.signing.*` with a throwaway PKCS12 keystore plus `keytool -exportcert -rfc` PEM produced `build/Map-Studio.modl` (signed) and `Map-Studio.unsigned.modl`. The signed file holds `certificates.p7b` and `signatures.properties` (one entry per file); `keytool -printcert -file <extracted certificates.p7b>` prints the SHA-256 fingerprint, equal to the keystore's. Release picks the file not ending `.unsigned.modl`.
- `gradle/wrapper/gradle-wrapper.properties` -- Gradle 9.8.0; add `distributionSha256Sum` (value from gradle.org's published checksum) to pin it.
- `web/package.json`, `web/.npmrc` -- exact pins already; IA scoped packages come from `nexus.inductiveautomation.com`; CI uses `npm ci` through Gradle's `npmInstall`.
- `.gitignore` -- already ignores `*.p12`, `*.jks`, `*.keystore`, `ops/signing/`, `signing/`; add `*.pem`, `*.p7b`, `*.modl` there.
- Mustry `.github/workflows/{ci,release}.yml`, `RELEASING.md` (read-only clone in scratchpad `refs/mustry`) -- model for tag trigger, plain x.y.z guard, draft-then-publish release, `.modl` signature check by file names, Gradle cache. Do not copy: five separate secrets (here two), prerelease dry-run artifact of a real-key build, branded manual PDF, e2e job, floating action tags.
- `ops/lib.sh`, `ops/up.sh` -- dev Gateway scripts; unchanged (they keep using the unsigned build).
- `README.md` -- add "Releases and signing" with the certificate SHA-256 fingerprint line and verification commands.

## Tasks & Acceptance

**Execution:**
- [x] `.github/workflows/ci.yml` -- on push and pull_request: JDK 17 (Temurin), Gradle cache, `./gradlew build`, upload unsigned `.modl`; second job `signing-check` runs `scripts/ci/test-signing.sh`. Timeout caps, `contents: read`.
- [x] `.github/workflows/release.yml` -- trigger `push: tags: v*` only; job `release` (commented `# environment: release` line ready); guards (plain `x.y.z`, tag commit is an ancestor of `origin/main`, both secrets present); decode keystore to `$RUNNER_TEMP`, export PEM with `keytool`, mask values; signed build with `-PreleaseVersion`; `modl-verify.sh` with the README fingerprint; write `Map-Studio-<version>.modl.sha256`; `gh release create --draft` with both files; it stays a draft for the owner to publish.
- [x] `scripts/ci/modl-verify.sh` -- args: `.modl`, optional expected SHA-256; checks signed markers, every archive entry listed in `signatures.properties`, module id and version from `module.xml`, certificate fingerprint; prints the fingerprint.
- [x] `scripts/ci/test-signing.sh` -- creates a throwaway keystore in `mktemp -d` (trap removes it), signed build, verify passes with its fingerprint; fails with a wrong fingerprint; fails on `Map-Studio.unsigned.modl`.
- [x] `RELEASING.md` -- owner one-time setup, cutting a release, rotation (new fingerprint in README and release notes, host locks updated), recovery if the key is lost.
- [x] `README.md`, `.gitignore`, `gradle/wrapper/gradle-wrapper.properties` -- as in the Code Map. README fingerprint line is `PENDING - the owner sets this before the first tag`; release fails while it is pending.

**Acceptance Criteria:**
- Given a push to a branch, when CI runs, then build, tests and the throwaway-cert signing check pass and no secret is read.
- Given a tag `v0.2.0` on `main` with the owner's secrets and README fingerprint in place, when the release workflow runs, then a release `v0.2.0` carries a signed `.modl` and its `.sha256`, and `modl-verify.sh` on the downloaded file prints the README fingerprint.
- Given a prerelease tag, a tag off `main`, a missing secret or a README mismatch, when the release workflow runs, then no release is created and the error names the cause without printing a secret.
- Given the repository after the story, when searched for private keys, passwords or certificates, then none is found (`git grep -I -E 'BEGIN (RSA |EC )?PRIVATE KEY'` is empty; `*.pem`, `*.p12` untracked).

## Implementation Notes

- Gradle did not honour dotted `ORG_GRADLE_PROJECT_ignition.signing.*` environment names (tested: unsigned output), so `scripts/ci/build-signed.sh` writes a temporary mode-600 `gradle.properties` in the project root (refuses to overwrite an existing one, removed by a trap) and exports the PEM from the keystore with `keytool -storepass:env`. The password never appears in an argument list.
- Actions pinned to SHAs resolved with `git ls-remote`: checkout v4.2.2, setup-java v4.7.1, cache v4.2.3, upload-artifact v4.6.2. Gradle wrapper `distributionSha256Sum` confirmed by downloading the zip.
- Owner decision (2026-10-26): repository secrets and a draft release instead of an environment; `# environment: release` is a commented line in the job; RELEASING.md has the move.
- Verified locally (JDK 17): `scripts/ci/test-signing.sh` passes (signed build 1m24s; wrong fingerprint, unsigned file, and a signed archive with an extra unsigned file are all refused); `gradle.properties` removed afterwards. Not run: the workflows themselves (no push), `actionlint` and `shellcheck` (not installed; YAML parses).
- Self-review (no reviewer subagent available): tightened `modl-verify.sh` to match signature keys at line start instead of as a substring, then re-ran the positive and tamper cases.

## Plan Change Log

## Review Triage Log

## Design Notes

Two secrets, not five: the PKCS12 keystore (base64) and its password. The alias is the fixed `mapstudio`, and the job exports the certificate PEM itself, so it cannot disagree with the key. Repository secrets are used for now (private repository, no environment protection): only the release workflow references them, it runs only for a plain `vX.Y.Z` tag on `main`, and it never publishes, so the owner publishing the draft is the approval. Anyone with write access can still push a tag; RELEASING.md names the limit and the later move to a `release` environment with a required reviewer. Gradle may not accept dotted env names (`ORG_GRADLE_PROJECT_ignition.signing.*`); the implementer tests it and otherwise passes `-P` values from files/masked env.

The fingerprint check ties the AC to the README: the job compares the certificate in the signed `.modl` against the README's `Signing certificate SHA-256:` line, so a release can never publish a fingerprint the README does not state.

## Verification

**Commands:**
- `bash scripts/ci/test-signing.sh` -- expected: signed build verified with the throwaway cert; both negative cases fail as intended; temp dir removed
- `./gradlew build` -- expected: unsigned `.modl`, tests pass
- `git grep -I -n -E 'BEGIN [A-Z ]*PRIVATE KEY|storepass|SIGNING_.*=' -- . ':!RELEASING.md' ':!scripts/ci'` -- expected: no output
- `actionlint` (or `python -c yaml.safe_load`) on both workflows -- expected: valid
- `gh workflow run`/push of a branch (after the owner allows a push) -- expected: CI green

**Manual checks (the owner's, hitl):**
- Owner steps below done; owner pushes tag `v0.1.0`; the release page shows the `.modl` and `.sha256`; `modl-verify.sh` on the download prints the README fingerprint.
- Optional: install the signed build on the dev Gateway (`MAPSTUDIO_CONTAINER=ms-s5`, `GATEWAY_HTTP_PORT=9105` in `.env`, certificate accepted) and see Map Studio running as a signed module.

## Owner steps (hitl; Claude cannot do these)

1. Generate the certificate offline, on a trusted machine, JDK 17 `keytool`. It prompts for the password; choose a long one and do not put it on the command line:
   `keytool -genkeypair -alias mapstudio -keyalg RSA -keysize 3072 -sigalg SHA256withRSA -validity 3650 -dname "CN=Map Studio, O=AO Industrial" -keystore mapstudio-signing.p12 -storetype PKCS12`
2. Read the fingerprint: `keytool -list -v -keystore mapstudio-signing.p12 -alias mapstudio | grep SHA256`.
3. Back up `mapstudio-signing.p12` and its password in your password manager and an offline copy (AD-14).
4. Create two repository secrets:
   `base64 -w0 mapstudio-signing.p12 | gh secret set MODULE_SIGNING_KEYSTORE_B64 --repo aott33/perspective-flowmap`
   `gh secret set MODULE_SIGNING_KEYSTORE_PASSWORD --repo aott33/perspective-flowmap` (paste at the prompt)
5. Put the SHA-256 fingerprint from step 2 in the README line (public).
6. Tag from `main`: `git tag -a v0.1.0 -m v0.1.0 && git push origin v0.1.0`; review the draft release and publish it.

## Open Questions

None. Resolved by the owner (2026-10-26): certificate `CN=Map Studio, O=AO Industrial`; the owner approves releases by publishing the draft; the repository is private without environment protection, so repository secrets and a draft release are used now, with a documented move to a `release` environment.
