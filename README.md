# Map Studio for Ignition Perspective

An open-source Ignition 8.3 Perspective component module: the project's map, showing each site's live state, with tools to build and edit the map in the browser.

- Module id `com.aoindustrial.perspective.mapstudio`, component `ao.mapstudio`
- Architecture for contributors: [docs/architecture.md](docs/architecture.md)
- Planning (BMAD): `_bmad-output/initiative-flowmap/` (brief, PRD, initiative, epics, architecture spine)
- Licence: Apache-2.0 ([LICENSE](LICENSE), third-party notices in [NOTICE](NOTICE))

## Status

The tracer: a MapLibre map on a blank style with three fixed points and one line, and one round trip to the Gateway through the component model delegate. Clicking a point sends `{v, type: "point.click", id, body: {pointId}}`; the Gateway answers `point.click.reply` with the time it received the click, shown on the map. A "Draw a line" toggle (top right) starts Terra Draw's line tool: click to add points, Enter to finish, Escape to cancel; the status line reports the finished line. Nothing drawn is saved yet.

The platform checks the spike answered, with their evidence, are in [docs/platform-checks.md](docs/platform-checks.md) (toolchain pins: MapLibre GL JS 6.16.0, Terra Draw 1.38.0, adapter 1.5.0).

Story 4 (spike): a point click also opens a popup that renders a project view by path, the way the built-in Perspective Map renders a view from a `path`. The spike-only prop `popupView` (`path`, `params`) names the view; it receives the point as its `mapItem` parameter (`{id, name}`) beside `params`, and an empty or failing path falls back to a text popup. Its evidence is in the same file.

![mapstudio-dev at 1440 px](docs/screenshots/mapstudio-dev-1440.png)

## Build

Requirements: JDK 17 and Docker. Node 22 is downloaded by the build; nothing else needs installing.

```bash
./gradlew build                      # produces build/Map-Studio.unsigned.modl
cd web && npx tsc --noEmit && npm test   # type check and the Jest unit tests alone
```

The build fails when the web bundle does not compile or a unit test fails. The bundle is `MapStudio.js` and `MapStudio.css`, served at `/res/mapstudio/`, with MapLibre's worker beside them as `maplibre-gl-worker.js` (MapLibre 6 runs its worker from a separate file; the component points it there). Signing happens only when `-Pignition.signing.*` properties are passed (release jobs); a plain build stays unsigned.

Layout:

| Folder | What lives there |
| --- | --- |
| `common/` | component descriptor, props schema (`mapstudio.props.json`), the message contract (`Messages.java`) |
| `gateway/` | gateway hook and the component model delegate (`MapStudioDelegate`) |
| `designer/` | the Designer palette entry |
| `web/` | the TypeScript and React component, MapLibre map, Terra Draw line tool (`DrawControl.tsx`, `draw.ts`), message client (`messages.ts`), the point popup (`PointPopup.tsx`, `popupParams.ts`) and their tests |
| `e2e/` | the Playwright suite (pinned `@playwright/test`): smoke tests at 1440 and 390 px, the popup checks and the spike's measures |
| `ops/` | the local development Gateway (Docker) and its `mapstudio-dev` project (`MapStudioDev`, `MapStudioScale`, two popup fallback pages, `Popups/PointDetails`) |
| `docs/` | contributor architecture, the platform checks and screenshots |

## Run the development Gateway

```bash
ops/up.sh              # build, stage the .modl, start Ignition 8.3.10 in Docker, accept the module unattended
ops/logs.sh -n 200     # Gateway log
ops/down.sh [--purge]  # stop; --purge also wipes the Gateway data (trial, acceptance)
```

To run several dev Gateways side by side, give each its own `MAPSTUDIO_CONTAINER` and `GATEWAY_HTTP_PORT` in its `.env`. The Gateway is at http://localhost:9088 (user `admin`, with a random password generated into the git-ignored `.env` on first start; development only, bound to localhost) and the session at http://localhost:9088/data/perspective/client/mapstudio-dev. The `mapstudio-dev` project is bind-mounted from `ops/project`, so Designer saves write back into the repository. The Gateway reads project files at start-up: restart it after editing them by hand.

The dev Gateway loads the unsigned build (`-Dignition.allowunsignedmodules=true`), which is never acceptable outside development. Releases are signed `.modl` files on GitHub.

### Platform checks

`ops/checks.sh` answers the spike's Gateway questions on a live 8.3.10 Gateway: it adds PostgreSQL 16 beside the dev Gateway (`ops/docker-compose.checks.yml`), seeds the Gateway's core config collection from `ops/checks/config/core/` (a tag provider, a UDT whose alarm toggles every 30 s, a File secret provider and two database connections), and the module's `gateway/.../spike` package then logs one `CHECK <name> PASS|FAIL <evidence>` line per check for any project that holds a `com.aoindustrial.perspective.mapstudio/setup` resource (`ops/project/.../setup/setup.json`). The PostgreSQL passwords are generated into the git-ignored `ops/checks/secrets/` and reach the Gateway only through its File secret provider. While the checks stack exists, `ops/up.sh`, `down.sh` and `logs.sh` include it automatically and `ops/down.sh --purge` removes it, PostgreSQL volume included. The UDT's alarm is a dev-only test alarm, flagged for engineering review and never for a real Gateway. Results and evidence: [docs/platform-checks.md](docs/platform-checks.md). The spike package is removed by the refactor sweep.

## Tests and proof

The Playwright suite in `e2e/` runs against a dev Gateway that is already up (`ops/up.sh`); CI starts one in Docker for every push to `main` and every pull request.

```bash
cd e2e && npm ci
npm test               # smoke tests, popup checks and measures; output in e2e/out (screenshots, measures.json, HTML report)
npm run docs           # the same, rewriting docs/screenshots/*.png and docs/spike-measures.json
npm run test:unit      # the suite's own helper tests (no Gateway needed)
```

The Gateway URL is `GATEWAY_URL`, else `http://localhost:` and `GATEWAY_HTTP_PORT` from `.env`, else 9088. The suite fails on any browser console or page error. It uses Playwright's own Chromium (`npx playwright install chromium`, run by CI); set `PW_CHROMIUM_PATH` to use a browser already on the machine, and `E2E_HEADED=1` to run with a visible browser (a real GPU gives a real frame rate). The measures it records, with their labels and limits, are in [docs/platform-checks.md](docs/platform-checks.md), section "Story 7".

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
