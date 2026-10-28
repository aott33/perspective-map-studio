# Releasing Map Studio

Releases are signed `.modl` files on GitHub. Signing happens only in the release workflow (`.github/workflows/release.yml`), from two secrets of the `release` environment, which needs the owner's approval. No key, password or certificate is ever committed (`.gitignore` blocks `*.p12`, `*.jks`, `*.pem`, `*.modl`), and CI on every push and pull request signs only with a throwaway certificate that it generates and discards.

## One-time setup (the owner)

Do this on a trusted machine with a JDK 17 `keytool`.

1. Generate the certificate. Use a password without a backslash, a newline, or leading or trailing whitespace: the build writes it to a temporary Gradle properties file and refuses such passwords with a clear message. `keytool` asks for the password; choose a long one and do not type it on the command line.

   ```bash
   keytool -genkeypair -alias mapstudio -keyalg RSA -keysize 3072 -sigalg SHA256withRSA \
     -validity 3650 -dname "CN=Map Studio, O=AO Industrial" \
     -keystore mapstudio-signing.p12 -storetype PKCS12
   ```

2. Read its fingerprint:

   ```bash
   keytool -list -v -keystore mapstudio-signing.p12 -alias mapstudio | grep SHA256
   ```

3. Back up `mapstudio-signing.p12` and its password in your password manager, plus an offline copy. A lost key means a rotation (below).
4. Create the two secrets in the `release` environment (see Release approval):

   ```bash
   base64 -w0 mapstudio-signing.p12 | gh secret set MODULE_SIGNING_KEYSTORE_B64 --env release --repo aott33/perspective-map-studio
   gh secret set MODULE_SIGNING_KEYSTORE_PASSWORD --env release --repo aott33/perspective-map-studio   # paste at the prompt
   ```

5. Replace the `PENDING` line in `README.md` with `Signing certificate SHA-256: <the fingerprint from step 2>` (uppercase, colon separated) in a normal pull request. The release workflow refuses to run while the line is missing, and refuses a signed module whose certificate differs from it.

## Cutting a release

1. Merge to `main`; CI must be green. Every contract document names the contract version and `CHANGELOG.md` has a section for it (`scripts/ci/check-contract-versions.sh`, run by CI). `CHANGELOG.md` also needs a `## X.Y.Z` section for the release itself and `web/package.json` and `e2e/package.json` must say `X.Y.Z` (they can differ from the contract version on a module-only release): the release workflow runs `scripts/ci/check-release-version.sh X.Y.Z` for the tag and stops before signing when they do not.
2. Tag the merge commit with a plain `vX.Y.Z` (no `-rc` or other suffix: Ignition's module version is numeric) and push the tag:

   ```bash
   git switch main && git pull
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

3. The `build-sign` job (read-only token, the only job that sees the secrets) checks the tag is on `main`, builds and signs, and checks the signature structure, that the certificate fingerprint equals the README line and that `module.xml`'s version equals the tag. The `draft` job (can write releases, sees no secret, builds nothing) then creates a DRAFT release with `Map-Studio-X.Y.Z.modl` and `Map-Studio-X.Y.Z.modl.sha256`.
4. Review the draft. Download the `.modl`, run `scripts/ci/modl-verify.sh <file> "<README fingerprint>"`, write the release notes (step 5), then publish the draft. Publishing is the release approval; the workflow never publishes by itself.
5. Release notes. On the draft, replace the generated notes with user-facing notes (the v0.2.0 page is the model), in this order: what the release gives (one paragraph, then the list of what is new), requirements (Ignition version, database and its privileges), upgrade steps with the warnings first (backup, migrations and the role they need, removed props), install and verify (the SHA-256 of the `.modl` and the signing certificate fingerprint from the README), what is not in this release, and a link to `CHANGELOG.md` for developers. Every link into the repository points at the tag (`blob/vX.Y.Z/...`), never at `main`, so the notes stay true after later releases.

`modl-verify.sh` is a structure and fingerprint check only: it does not verify the signatures cryptographically, so a forged module that carries the genuine certificate file would pass it. The cryptographic check happens when a Gateway installs the module, so install the signed build once on a dev Gateway before you rely on a new certificate. Real verification is a deferred item.

Anyone who can push a tag can start the release workflow, but the signing job waits for the owner's approval in the `release` environment, and it only ever creates a draft, for a tag on `main`.

## Checks by release type

Epic 3 entry 4 (owner, 2026-10-28), after the 0.2.0 release repeated the template's whole `local.sh` and full test stack twice. Each release type runs the checks below and no more; the template's own CI covers what it already covers.

| When | Checks | How long |
| --- | --- | --- |
| Every pull request | Map Studio CI as now: build and unit tests, the web tests, the e2e suite on the dev stack, the signing check with a throwaway certificate, `check-contract-versions.sh` | CI |
| Before a minor release's tag (`X.Y.0`) | one rehearsal on the template's test stack with a throwaway-signed build (`scripts/ci/build-signed.sh` with a certificate made on the spot, the template a scratch clone that is never pushed: [docs/template-install.md](docs/template-install.md), "0.2.0 rehearsal"); the performance run (`ops/perf.sh`, [docs/perf](docs/perf/README.md)) only when the write path, the map store or the browser bundle changed, otherwise `ops/perf.sh --only <the measures those changes touch>` or nothing | rehearsal about 30 min; perf about 30 min, `--only` 10 to 15 min |
| After every tag, and for a patch release (`X.Y.Z`, Z > 0) | the short smoke: `ops/release-smoke.sh X.Y.Z` against the published release (below) | about 5 min on the 4-CPU agent box |
| The template pull request (the module lock update, at the cutover) | the template's own CI (`local.sh`, `stack.yml`); nothing repeated here | the template's CI |

A rehearsal or a smoke that fails stops the release: the defect becomes its own fix (plan rule of 0.2.0, kept).

### The release smoke

```sh
ops/release-smoke.sh 0.2.0                           # the published v0.2.0, the expected entry built here
ops/release-smoke.sh 0.2.0 --template ../ign-scada-template   # also check that checkout's modules/modules.lock.json entry
ops/release-smoke.sh 0.2.0 --lock entry.json         # a file holding the lock, or the entry alone
ops/release-smoke.sh 0.2.0 --image ign-og/ignition:8.3.9-modules --keep   # the template's image, stack kept
```

In order: the lock entry (when given) against the expected entry; the published `.modl` downloaded and its SHA-256 checked against the release's `.sha256` asset; `scripts/ci/modl-verify.sh` (signed, every file signed, the certificate fingerprint equals the README's line, `module.xml`'s version equals the version); a Gateway with that module as its only external module and a PostgreSQL database beside it (no field simulator, broker or feedback stub; no `allowunsignedmodules`, so the Gateway's own signature check runs); the module ACTIVE at the version (`GET /data/api/v1/modules/healthy`); `e2e/rehearsal/release.spec.mjs` (two Chromium instances signed in as the map editor, a line drawn in one on the other's map within 5 s with no reload); every `mapstudio_schema_version` row with `module_version` equal to the version. The stack is its own compose project (`<MAPSTUDIO_CONTAINER>-smoke`, port `SMOKE_HTTP_PORT`, default 9089) with fresh volumes, removed on exit, and `e2e/out` is searched for every secret of the run.

The expected entry is `RELEASING.md`'s shape (next section) with the release's values: `sha256` from the `.sha256` asset, `certSha256` from the README. **Owner decision 2026-10-28: the template stays on 0.1.0 until the cutover** (epic-template-cutover), so the smoke never needs the template's committed lock to hold the version; `--template` or `--lock` is for the cutover and for a lock entry written by hand (the 0.2.0 entry is in `_bmad-output/handoff-epic-3.md`).

The image is `--image` or `SMOKE_IMAGE`, else the template's `ign-og/ignition:8.3.9-modules` when Docker has it, else the plain `inductiveautomation/ignition:8.3.9` (the version the template pins) with the published module. What ran where:

- **[live 8.3.9, plain image]** `ops/release-smoke.sh 0.2.0` on `inductiveautomation/ignition:8.3.9` with the published v0.2.0 passed on the 4-CPU agent box (2026-10-28; the numbers are in [docs/platform-checks.md](docs/platform-checks.md), "Epic 3 entry 4"), and the three failure paths each fail with the check named: `SMOKE_SHA256`, `SMOKE_CERT_SHA256` and `SMOKE_MODULE_VERSION` replace one expected value each.
- **[not verified]** the template's image: it was not on the box and the template checkout was not available. The template image carries the six locked modules, so until the cutover it holds Map Studio 0.1.0 beside the mounted release; the smoke's ACTIVE check fails when the wrong one wins. The lock check against a real `modules/modules.lock.json` was run with a file written in the shape the hand-off records, not the template's file.

## Installing through a host's module lock

A host such as `ign-scada-template` pins the release in its lock file by SHA-256 and certificate fingerprint and downloads it from the public release URL with no credential (the repository is public, so a host's `fetch` and its weekly update check work as for any public module). The lock entry for release `X.Y.Z`:

```json
{
  "id": "com.aoindustrial.perspective.mapstudio",
  "name": "Map Studio",
  "version": "X.Y.Z",
  "requiredIgnitionVersion": "8.3.0",
  "file": "Map-Studio-X.Y.Z.modl",
  "url": "https://github.com/aott33/perspective-map-studio/releases/download/vX.Y.Z/Map-Studio-X.Y.Z.modl",
  "sha256": "<the release's .sha256 file>",
  "certSha256": "<the README's Signing certificate SHA-256 line>",
  "licence": {"name": "Apache-2.0", "commercial": false},
  "upstream": {"type": "github", "repo": "aott33/perspective-map-studio", "asset": "Map-Studio-.*\\.modl", "tag": "vX.Y.Z"}
}
```

Take `sha256` from the published release's `.sha256` file, `certSha256` from the README, and check both against the downloaded file with the host's own tool (`modl.py inspect`) and `scripts/ci/modl-verify.sh` before writing the entry; `ops/release-smoke.sh X.Y.Z` builds this entry from those values and prints it (`e2e/out/smoke/expected-entry.json`), and `--lock` or `--template` checks a written entry against it. The run that proved this path with the v0.1.0 release (and the earlier throwaway rehearsal) is in [docs/template-install.md](docs/template-install.md).

## Release approval

The signing job runs in the `release` environment, set up by the owner on 2026-10-26: the owner is its required reviewer, it only runs for `v*` tags, and the two signing secrets live only there (the repository copies are deleted). A release therefore pauses at "Waiting for review" until the owner approves it under Review deployments, and the owner still publishes the draft release afterwards.

To change it: Settings, Environments, `release`. The one line `environment: release` on the `build-sign` job in `release.yml` ties the job to it; without that line the job cannot read the secrets.

Still optional: Settings, Rules, Rulesets, a tag ruleset that restricts creation of `v*` tags to the owner.

## Rotation or lost key

A rotation is a release: generate a new certificate (setup steps 1 to 4), change the README fingerprint in the same pull request that announces it, tag a release, and state the old and new fingerprints in the release notes. Every host that locks on the fingerprint (for example the template's `modules/modules.lock.json`) must be updated to the new one before it installs the new release. Revoke nothing silently: the old fingerprint stays in the notes of the releases it signed.

## Testing the signing path

`scripts/ci/test-signing.sh` (also the `signing-check` CI job) generates a throwaway certificate in a temporary directory, signs with the same script the release uses, and checks that a wrong fingerprint or version, empty arguments, the unsigned build, a module with an unsigned file, a bare certificate in place of the PKCS#7 bundle and unsafe passwords are all refused. It needs JDK 17 and openssl on `PATH`.
