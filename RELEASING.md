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

1. Merge to `main`; CI must be green.
2. Tag the merge commit with a plain `vX.Y.Z` (no `-rc` or other suffix: Ignition's module version is numeric) and push the tag:

   ```bash
   git switch main && git pull
   git tag -a v0.1.0 -m "v0.1.0"
   git push origin v0.1.0
   ```

3. The `build-sign` job (read-only token, the only job that sees the secrets) checks the tag is on `main`, builds and signs, and checks the signature structure, that the certificate fingerprint equals the README line and that `module.xml`'s version equals the tag. The `draft` job (can write releases, sees no secret, builds nothing) then creates a DRAFT release with `Map-Studio-X.Y.Z.modl` and `Map-Studio-X.Y.Z.modl.sha256`.
4. Review the draft. Download the `.modl`, run `scripts/ci/modl-verify.sh <file> "<README fingerprint>"`, then publish the draft. Publishing is the release approval; the workflow never publishes by itself.

`modl-verify.sh` is a structure and fingerprint check only: it does not verify the signatures cryptographically, so a forged module that carries the genuine certificate file would pass it. The cryptographic check happens when a Gateway installs the module, so install the signed build once on a dev Gateway before you rely on a new certificate. Real verification is a deferred item.

Anyone who can push a tag can start the release workflow, but the signing job waits for the owner's approval in the `release` environment, and it only ever creates a draft, for a tag on `main`.

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

Take `sha256` from the published release's `.sha256` file, `certSha256` from the README, and check both against the downloaded file with the host's own tool (`modl.py inspect`) and `scripts/ci/modl-verify.sh` before writing the entry. The run that proved this path with the v0.1.0 release (and the earlier throwaway rehearsal) is in [docs/template-install.md](docs/template-install.md).

## Release approval

The signing job runs in the `release` environment, set up by the owner on 2026-10-26: the owner is its required reviewer, it only runs for `v*` tags, and the two signing secrets live only there (the repository copies are deleted). A release therefore pauses at "Waiting for review" until the owner approves it under Review deployments, and the owner still publishes the draft release afterwards.

To change it: Settings, Environments, `release`. The one line `environment: release` on the `build-sign` job in `release.yml` ties the job to it; without that line the job cannot read the secrets.

Still optional: Settings, Rules, Rulesets, a tag ruleset that restricts creation of `v*` tags to the owner.

## Rotation or lost key

A rotation is a release: generate a new certificate (setup steps 1 to 4), change the README fingerprint in the same pull request that announces it, tag a release, and state the old and new fingerprints in the release notes. Every host that locks on the fingerprint (for example the template's `modules/modules.lock.json`) must be updated to the new one before it installs the new release. Revoke nothing silently: the old fingerprint stays in the notes of the releases it signed.

## Testing the signing path

`scripts/ci/test-signing.sh` (also the `signing-check` CI job) generates a throwaway certificate in a temporary directory, signs with the same script the release uses, and checks that a wrong fingerprint or version, empty arguments, the unsigned build, a module with an unsigned file, a bare certificate in place of the PKCS#7 bundle and unsafe passwords are all refused. It needs JDK 17 and openssl on `PATH`.
