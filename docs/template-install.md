# Install through the template's module lock

Story 6 (epic-module-foundation R5): a signed Map Studio module installs on the `ign-scada-template` test stack through its `modules/modules.lock.json`, pinned by SHA-256 and certificate fingerprint. This record is a **rehearsal** with a locally signed, throwaway build. The real SHA-256 and certificate fingerprint come with the first signed release (v0.1.0), which is not published yet; no throwaway value is written in this repository or in any pushed branch of the template. Date: 2026-10-26.

Labels: **[live 8.3.9]** seen on the template's test stack (`inductiveautomation/ignition:8.3.9`, the image the template pins); **[build]** seen in this repository's scripts; **[template code]** read from `ign-scada-template` source; **[not verified]** not checked here.

## What was run

1. A throwaway PKCS#12 keystore (30 days, in a temporary folder outside both repositories) signed a v0.1.0 build with `scripts/ci/build-signed.sh`, the script the release workflow uses **[build]**. `modl-verify.sh` and the template's `modl.py inspect` both passed on it (6 signatures checked, none bad).
2. In a throwaway clone of the template, on a branch that is never pushed, a lock entry (shape in [RELEASING.md](../RELEASING.md), "Installing through a host's module lock") was committed with the throwaway SHA-256 and fingerprint, and the `.modl` was placed in the git-ignored `services/ignition/modules/`. `modl.py fetch` accepted it beside the four existing modules (it reuses a cached file whose hash matches) **[template code]**.
3. `scripts/test/stack.sh --keep` built the template's Gateway image with the module, started the stack and ran bootstrap, smoke and the end-to-end checks; the render passes were limited as the template's CI limits them (`RENDER_PASSES=native-day,phone-native-night`, `RENDER_ROLES=engineer`).
4. A scratch Perspective project `MapStudioScratch` (this repository's `ops/project` view, page config and popup view, plus a `project.json`) was copied into the kept stack's git-ignored `build/test-stack/projects/`, and a project scan (`POST /data/api/v1/scan/projects`, HTTP 200) loaded it **[live 8.3.9]**. It is never committed: the template's generators own `projects/Upstream` and fail CI on a view they did not write. `node ops/screenshot.mjs` (copied with the project name and output folder changed) then drove it at 1440 px and 390 px.

## Results

**[live 8.3.9]**

| Check | Result |
| --- | --- |
| Module on the 8.3.9 image | Installed by the template's sync, state ACTIVE (`/data/api/v1/modules/healthy`: `com.aoindustrial.perspective.mapstudio 0.1.0`); `smoke.sh` reported `ok module com.aoindustrial.perspective.mapstudio`. The Gateway log shows the module starting and the component registering, with no Map Studio warning or error. The self-signed certificate was accepted unattended through the `ACCEPT_MODULE_CERTS` line that `modl.py fetch` generates from the lock. |
| Does it load on 8.3.9? | **Yes.** The module was built against the 8.3.0 SDK and the platform checks ran on 8.3.10; on 8.3.9 it loads, registers the `ao.mapstudio` component and answers a delegate message. The template's image does not need a bump for this module. |
| Scratch view, 1440 px and 390 px | The map draws the three test points (no basemap yet) and the test line; clicking point p1 shows `Gateway received click on p1` (Gateway log: `point.click ... for point p1`), opens the `Popups/PointDetails` project view (`Id: p1`, `Name: Point 1 (dev)`), and drawing one line gives `Line drawn with 2 points`. No browser console error or page error in either viewport (the script fails on one). |
| `scripts/test/stack.sh` | Passed on the second run (exit 0); see "Test stack run" below. |

Evidence: `docs/screenshots/template-scratch-1440.png` and `docs/screenshots/template-scratch-390.png`.

## Finding: the certificate bundle must be PKCS#7

The first throwaway build failed the template's `modl.py inspect` with a traceback from `openssl pkcs7`: the Gradle plugin copies the configured certificate file into the module as `certificates.p7b` without converting it, and `build-signed.sh` gave it the PEM certificate that `keytool -exportcert -rfc` writes, a bare certificate rather than a PKCS#7 bundle. `build-signed.sh` now wraps the certificate in a PKCS#7 DER bundle (`openssl crl2pkcs7`), as the other vendors' modules ship it, and `modl-verify.sh` refuses a `certificates.p7b` that `openssl pkcs7` cannot read. Whether a Gateway would also accept the bare certificate was not tested **[not verified]**. `scripts/ci/test-signing.sh` passes with the change **[build]**; the new refusal was checked by hand against a module with its bundle swapped for a bare certificate, and has no case in `test-signing.sh` yet.

## Test stack run

Two runs of `scripts/test/stack.sh --keep` on the committed rehearsal branch, with `RENDER_PASSES=native-day,phone-native-night` and `RENDER_ROLES=engineer` (the limits the template's CI uses for its fieldsim job; a local run without them covers every pass and all five roles, which was not done here) **[live 8.3.9]**:

- **Run 1: exit 1 at the render suite.** Everything before it passed (modules verified, image built, bootstrap and smoke with the module ACTIVE, field simulator connection, alarm end-to-end, plunger cycles, feedback end-to-end). One render check failed: `phone-native-night /well/Mesa/P12/P12-3H/trends`, `Cannot subscribe to "ProjectDefinition" state. "Parts/Asset/Trends/" does not exist` (an embed path whose type segment was still empty), and the script stopped there, so the signed-in passes did not run. The same page passed in `native-day`; a re-run of the whole `phone-native-night` pass on the same stack had no failure. No Map Studio view or code is on that page, so this looks like an existing race in the template **[not verified]**: it was not reproduced on a stack without the module.
- **Run 2 (fresh stack): `test stack: PASS`, exit 0, no FAIL line.** Render suite, the signed-in render pass as the engineer role, the signed-in feedback form and the signed-in map editor all passed. The Gateway log holds 13 Map Studio lines, none at warning or error level.

The scratch project was then added to the Run 2 stack and the screenshots above were taken from it (a first set from the Run 1 stack looked the same).

## What waits for v0.1.0

- The owner's signing setup (certificate, two secrets, README fingerprint) and green CI on `main`; the tag; publishing the draft release; the repository going public.
- The real lock entry from the published asset (the release's `.sha256` file and the README fingerprint; `modl.py inspect` and `modl-verify.sh` on the download), then the template pull request: lock entry, `docs/modules.md`, `THIRD_PARTY_NOTICES.md`, opened as a draft, with `modl.py` and the workflows unchanged. Its weekly `modules.yml` then checks Map Studio releases like the other modules **[template code]**.
- The rehearsal is repeated once against the real release (fetch from the public URL with no credential, `stack.sh`, scratch project, screenshots). The fetch from the release URL itself was not exercised here **[not verified]**.
