# Releasing Map Studio

Releases are signed `.modl` files on GitHub. Signing happens only in the release workflow (`.github/workflows/release.yml`), from two repository secrets. No key, password or certificate is ever committed (`.gitignore` blocks `*.p12`, `*.jks`, `*.pem`, `*.modl`), and CI on every push and pull request signs only with a throwaway certificate that it generates and discards.

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
4. Create the two repository secrets:

   ```bash
   base64 -w0 mapstudio-signing.p12 | gh secret set MODULE_SIGNING_KEYSTORE_B64 --repo aott33/perspective-flowmap
   gh secret set MODULE_SIGNING_KEYSTORE_PASSWORD --repo aott33/perspective-flowmap   # paste at the prompt
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

Limit of this setup: the secrets are repository secrets, so anyone who can push a tag to the repository can start the release workflow (it still only creates a draft, and only for a tag on `main`).

## Installing through a host's module lock

A host such as `ign-scada-template` pins the release in its lock file by SHA-256 and certificate fingerprint and downloads it from the public release URL with no credential (the repository is public, so a host's `fetch` and its weekly update check work as for any public module). The lock entry for release `X.Y.Z`:

```json
{
  "id": "com.aoindustrial.perspective.mapstudio",
  "name": "Map Studio",
  "version": "X.Y.Z",
  "requiredIgnitionVersion": "8.3.0",
  "file": "Map-Studio-X.Y.Z.modl",
  "url": "https://github.com/aott33/perspective-flowmap/releases/download/vX.Y.Z/Map-Studio-X.Y.Z.modl",
  "sha256": "<the release's .sha256 file>",
  "certSha256": "<the README's Signing certificate SHA-256 line>",
  "licence": {"name": "Apache-2.0", "commercial": false},
  "upstream": {"type": "github", "repo": "aott33/perspective-flowmap", "asset": "Map-Studio-.*\\.modl", "tag": "vX.Y.Z"}
}
```

Take `sha256` from the published release's `.sha256` file, `certSha256` from the README, and check both against the downloaded file with the host's own tool (`modl.py inspect`) and `scripts/ci/modl-verify.sh` before writing the entry. The rehearsal that proved this path is in [docs/template-install.md](docs/template-install.md).

## Release approval (optional)

The repository is public. The release workflow already never publishes by itself: the owner publishing the draft is the approval. To also gate the signing job itself, the owner may add a required reviewer:

1. Settings, Environments: create `release`; set yourself as required reviewer; under deployment branches and tags choose "Selected" and add the tag rule `v*`.
2. Move `MODULE_SIGNING_KEYSTORE_B64` and `MODULE_SIGNING_KEYSTORE_PASSWORD` into the `release` environment and delete the repository copies.
3. In `release.yml` uncomment the one line `# environment: release` on the `build-sign` job.
4. Settings, Rules, Rulesets: add a tag ruleset that restricts creation of `v*` tags to the owner.

Until then the secrets are repository secrets, and anyone who can push a tag can start the release workflow (see "Cutting a release").

## Rotation or lost key

A rotation is a release: generate a new certificate (setup steps 1 to 4), change the README fingerprint in the same pull request that announces it, tag a release, and state the old and new fingerprints in the release notes. Every host that locks on the fingerprint (for example the template's `modules/modules.lock.json`) must be updated to the new one before it installs the new release. Revoke nothing silently: the old fingerprint stays in the notes of the releases it signed.

## Testing the signing path

`scripts/ci/test-signing.sh` (also the `signing-check` CI job) generates a throwaway certificate in a temporary directory, signs with the same script the release uses, and checks that a wrong fingerprint or version, empty arguments, the unsigned build, a module with an unsigned file, a bare certificate in place of the PKCS#7 bundle and unsafe passwords are all refused. It needs JDK 17 and openssl on `PATH`.
