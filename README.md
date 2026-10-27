# Map Studio for Ignition Perspective

An open-source Ignition 8.3 Perspective component module: the project's map, showing each site's live state, with tools to build and edit the map in the browser.

- Module id `com.aoindustrial.perspective.mapstudio`, component `ao.mapstudio`
- Architecture for contributors: [docs/architecture.md](docs/architecture.md)
- Planning (BMAD): `_bmad-output/initiative-flowmap/` (brief, PRD, initiative, epics, architecture spine)
- Licence: Apache-2.0 ([LICENSE](LICENSE), third-party notices in [NOTICE](NOTICE))

## Status

The tracer: a MapLibre map on a blank style with three fixed points and one line, and one round trip to the Gateway through the component model delegate. Clicking a point sends `{v, type: "point.click", id, body: {pointId}}`; the Gateway answers `point.click.reply` with the time it received the click, shown on the map. A "Draw a line" toggle (top right) starts Terra Draw's line tool: click to add points, Enter to finish, Escape to cancel; the status line reports the finished line. Nothing drawn is saved yet.

The platform checks the spike answered, with their evidence, are in [docs/platform-checks.md](docs/platform-checks.md) (toolchain pins: MapLibre GL JS 6.16.0, Terra Draw 1.38.0, adapter 1.5.0).

Story 4 (spike): a point click also opens a popup that renders a project view by path, the way the built-in Perspective Map renders a view from a `path`. The spike-only prop `popupView` (`path`, `params`) names the view; it receives the point as its `mapItem` parameter (`{id, name}`) beside `params`, and an empty or failing path falls back to a text popup. Its evidence is in the same file. Story 7 (spike): the spike-only prop `testSet` (`tracer` or `scale30`) picks the fixed data the map draws; `scale30` is the seeded 30-pad stand-in the frame-rate measure uses. Both props stay until the map store and the kind setup replace them.

![mapstudio-dev at 1440 px](docs/screenshots/mapstudio-dev-1440.png)

## Build

Requirements: JDK 17 and Docker. Node 22 is downloaded by the build; nothing else needs installing. Running `npm` in `web/` outside Gradle needs Node 20.9 or later (the webpack plugins' floor).

```bash
./gradlew build                      # produces build/Map-Studio.unsigned.modl
cd web && npx tsc --noEmit && npm test   # type check and the Jest unit tests alone
```

The build fails when the web bundle does not compile or a unit test fails. The bundle is `MapStudio.js` and `MapStudio.css`, served at `/res/mapstudio/`, with MapLibre's worker beside them as `maplibre-gl-worker.js` (MapLibre 6 runs its worker from a separate file; the component points it there). Signing happens only when `-Pignition.signing.*` properties are passed (release jobs); a plain build stays unsigned.

Layout:

| Folder | What lives there |
| --- | --- |
| `common/` | component descriptor, props schema (`mapstudio.props.json`), the message contract (`Messages.java`) |
| `gateway/` | gateway hook and the component model delegate (`MapStudioDelegate`); `system.mapstudio` script functions are in `common/` (`MapStudioScriptModule`: `ping`, `echo`) |
| `designer/` | the Designer palette entry |
| `web/` | the TypeScript and React component, MapLibre map, Terra Draw line tool (`DrawControl.tsx`, `draw.ts`), message client (`messages.ts`), the point popup (`PointPopup.tsx`, `popupParams.ts`) and their tests |
| `e2e/` | the Playwright suite (pinned `@playwright/test`): smoke tests at 1440 and 390 px, the popup checks and the spike's measures |
| `ops/` | the local development Gateway (Docker) and its `mapstudio-dev` project (`MapStudioDev`, `MapStudioScale`, two popup fallback pages, `Popups/PointDetails`) |
| `docs/` | contributor architecture, the platform checks and screenshots |

## Run the development Gateway

```bash
ops/up.sh              # build, stage the .modl, start Ignition 8.3.10 in Docker, accept the module unattended
ops/logs.sh -n 200     # Gateway log
ops/down.sh [--purge]  # stop; --purge also wipes the Gateway and PostgreSQL data
ops/psql.sh            # psql on the dev map store (for example: ops/psql.sh -c "select * from mapstudio_edit")
ops/store-checks.sh    # map store checks: missing rights, a failed migration, the retry, a newer schema (docs/operations.md)
```

The dev stack also runs **PostgreSQL 16**, the map store: no host port, reached by the Gateway as `postgres`. Its password is generated into the git-ignored `ops/secrets/` (by `ops/gen_secrets.py`) and reaches the Gateway's `MapStudio` database connection only through the `MapStudioFiles` File secret provider (`ops/config/core`, copied into the Gateway's `core` collection on a fresh volume). `ops/up.sh` also makes a dev API key (git-ignored, allowed in the Gateway's security properties by `ops/dev_security.py`) and uses it to make sure the identity provider `default` the dev project signs in with exists, then to create the **map editor** user `mapeditor` with the role `MapEditor` and the role `MapOperator` (`ops/users.py`); the editor's password is `MAPSTUDIO_EDITOR_PASSWORD` in `.env`. The dev project's `/edit` page has a Log in button and a "Run script checks" button that calls `system.mapstudio` only for a signed-in user holding `MapEditor`; the anonymous session is a viewer. The e2e suite signs the editor in before each editor test in a separate process, outside the test runner, so no trace or report holds the password, and its teardown checks `e2e/out` for it. If you delete `ops/secrets/` while the PostgreSQL volume still exists, `ops/up.sh` refuses and asks for `--fresh` (the volume keeps the old password). The contract the map store follows is in [docs/contract.md](docs/contract.md).

Each checkout has its own compose project, containers and volumes, named by `MAPSTUDIO_CONTAINER` in its `.env`; when you do not set one, the first `ops/` script derives `ms-<8 hex digits of the checkout path's SHA-256>` and records it there, so `--fresh` or `--purge` in one checkout never removes another checkout's Gateway or PostgreSQL. (Before this, an unset `MAPSTUDIO_CONTAINER` meant the shared compose project `ops`; remove its leftovers yourself with `docker compose -p ops -f ops/docker-compose.yml down -v` once nothing uses them.) To run several dev Gateways side by side, also give each its own `GATEWAY_HTTP_PORT`. The Gateway is at http://localhost:9088 (user `admin`, with a random password generated into the git-ignored `.env` on first start; development only, bound to localhost) and the session at http://localhost:9088/data/perspective/client/mapstudio-dev. The `mapstudio-dev` project is bind-mounted from `ops/project`, so Designer saves write back into the repository. The Gateway reads project files at start-up: restart it after editing them by hand.

The dev Gateway loads the unsigned build (`-Dignition.allowunsignedmodules=true`), which is never acceptable outside development. Releases are signed `.modl` files on GitHub.

### Platform checks

The spike's Gateway questions (Alarm Metrics subscription, a project script called from module code, `system.mapstudio` functions, a custom project resource, PostgreSQL rights) were answered by a spike package and `ops/checks.sh`, which the refactor sweep removed. Results and evidence are in [docs/platform-checks.md](docs/platform-checks.md); the harness itself is in the history at commit `51104c8`. If you ran it on your machine, its leftovers are yours to remove: the PostgreSQL volume (`docker volume ls`, then `docker volume rm <project>_postgres-data`) and the git-ignored `ops/checks/secrets/` folder. The checks also seeded config into the dev Gateway's own data volume (the Checks tag provider and UDT, with the dev-only test alarm `Checks/Pump Toggled` that toggles every 30 s, two database connections and a File secret provider); that config outlives the deleted files, so wipe it with `ops/down.sh --purge` or start once with `ops/up.sh --fresh`.

## Tests and proof

The Playwright suite in `e2e/` runs against a dev Gateway that is already up (`ops/up.sh`); CI starts one in Docker for every push to `main` and every pull request.

```bash
cd e2e && npm ci
npm test               # smoke tests, popup checks and measures; output in e2e/out (screenshots, measures.json, HTML report)
npm run docs           # the same, rewriting docs/screenshots/*.png and docs/spike-measures.json
npm run test:unit      # the suite's own helper tests (no Gateway needed)
```

The Gateway URL is `GATEWAY_URL`, else `http://localhost:` and `GATEWAY_HTTP_PORT` from `.env`, else 9088. The suite fails on any browser console or page error. It uses Playwright's own Chromium: on a laptop run `npx playwright install chromium` once in `e2e/` before the first run (on Ubuntu possibly `sudo npx playwright install-deps chromium` as well; CI does both). Set `PW_CHROMIUM_PATH` to use a browser already on the machine, and `E2E_HEADED=1` to run with a visible browser. A headed run is not by itself a GPU run: Playwright's Chromium under WSL (WSLg) reported SwiftShader (software WebGL) with every frame at 33.3 ms (a 30 Hz-like cadence). A frame-rate reading needs a browser whose `chrome://gpu` shows hardware-accelerated WebGL; under WSL use the Windows browser (with graphics acceleration turned on) against the Gateway at `localhost` (`docs/spike-report.md`). The measures it records, with their labels and limits, are in [docs/platform-checks.md](docs/platform-checks.md), section "Story 7".

## Releases and signing

Releases are signed `.modl` files attached to GitHub releases, built by CI from a `vX.Y.Z` tag on `main` ([RELEASING.md](RELEASING.md)). Every release is signed with one self-signed certificate held by the project owner. Check a download against this fingerprint before you install it (the script checks structure and fingerprint only; the Gateway verifies the signatures cryptographically when you install the module):

Signing certificate SHA-256: 8F:93:FD:5C:B8:D9:C7:9B:E4:14:FD:EC:84:CF:21:26:A2:AC:39:F3:DA:3F:C9:0D:F8:08:0E:EA:5C:4D:38:3D

```bash
scripts/ci/modl-verify.sh Map-Studio-<version>.modl "<fingerprint above>"   # structure and fingerprint check; needs unzip and a JDK's keytool
sha256sum -c Map-Studio-<version>.modl.sha256                               # the file's own SHA-256
```

Install through a host's module lock by the file's SHA-256 and this certificate fingerprint. A certificate rotation is a documented release that carries the new fingerprint.

## Message contract

Every message between the browser and the Gateway is `{v, type, id, body}` under the model event `mapstudio.message`; errors are `{code, message}`. The types this version knows are listed in `common/.../Messages.java` and `web/typescript/messages.ts`: `point.click`, `point.click.reply`, `error`.

## Attribution

Map rendering by [MapLibre GL JS](https://maplibre.org/) (BSD-3-Clause); drawing by [Terra Draw](https://terradraw.io/) and its MapLibre adapter (MIT). See [NOTICE](NOTICE).
