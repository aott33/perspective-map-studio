# Releasing Map Studio

Releases are signed `.modl` files on GitHub. Signing happens only in the release workflow (`.github/workflows/release.yml`), from two repository secrets. No key, password or certificate is ever committed (`.gitignore` blocks `*.p12`, `*.jks`, `*.pem`, `*.modl`), and CI on every push and pull request signs only with a throwaway certificate that it generates and discards.

## One-time setup (the owner)

Do this on a trusted machine with a JDK 17 `keytool`.

1. Generate the certificate. `keytool` asks for the password; choose a long one and do not type it on the command line.

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

3. The workflow checks the tag is on `main`, builds and signs, verifies the signature structure and that the certificate fingerprint equals the README line, and creates a DRAFT release with `Map-Studio-X.Y.Z.modl` and `Map-Studio-X.Y.Z.modl.sha256`.
4. Review the draft. Download the `.modl`, run `scripts/ci/modl-verify.sh <file> "<README fingerprint>"`, then publish the draft. Publishing is the release approval; the workflow never publishes by itself.

The workflow checks the structure of the signature. The Gateway checks the cryptography when it installs the module, so install the signed build once on a dev Gateway before you rely on a new certificate.

Limit of this setup: the secrets are repository secrets, so anyone who can push a tag to the repository can start the release workflow (it still only creates a draft, and only for a tag on `main`).

## When the repo goes public or the plan allows

Move the secrets behind an environment with a required reviewer:

1. Settings, Environments: create `release`; set yourself as required reviewer; under deployment branches and tags choose "Selected" and add the tag rule `v*`.
2. Move `MODULE_SIGNING_KEYSTORE_B64` and `MODULE_SIGNING_KEYSTORE_PASSWORD` into the `release` environment and delete the repository copies.
3. In `release.yml` uncomment the one line `# environment: release` on the `release` job.
4. Settings, Rules, Rulesets: add a tag ruleset that restricts creation of `v*` tags to the owner.

## Rotation or lost key

A rotation is a release: generate a new certificate (setup steps 1 to 4), change the README fingerprint in the same pull request that announces it, tag a release, and state the old and new fingerprints in the release notes. Every host that locks on the fingerprint (for example the template's `modules/modules.lock.json`) must be updated to the new one before it installs the new release. Revoke nothing silently: the old fingerprint stays in the notes of the releases it signed.

## Testing the signing path

`scripts/ci/test-signing.sh` (also the `signing-check` CI job) generates a throwaway certificate in a temporary directory, signs with the same script the release uses, and checks that a wrong fingerprint, the unsigned build and a module with an unsigned file are all refused. It needs JDK 17 on `PATH`.
