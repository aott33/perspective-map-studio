---
title: 'Setup form in the Designer: pickers and layout'
type: 'feature'
ticket: '16'
created: '2026-10-27'
status: 'in-progress'
baseline_revision: '2043e34c0bd1d20bf635db554c14f7f2f0ca5e75'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md'
  - '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/mockups/designer-setup-form.html'
  - '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/story-setup-editor-in-the-designer-plan.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Story 7's setup tab works but looks unfinished (owner, live, 2026-10-27): fields stretch across a 2000 px tab, every value is typed by hand, the schema version looks editable, and Create setup is a modal with scroll bars that enables Create with a reason on screen and then repeats the reason in a second dialog.

**Approach:** Rebuild `SetupPanel` to the approved mockup (`ux-map-studio/mockups/designer-setup-form.html`, EXPERIENCE.md "Designer Setup Form") with the owner's changes below, and give its fields lists to pick from: connections, identity provider roles and secret providers and names from the Gateway through one read-only module RPC, project library functions and Perspective page URLs from the open project. Typing stays allowed everywhere; validation stays `Setup.read` (story 6) plus the form's input checks.

## Decisions (owner, 2026-10-27, all approved)

- The mockup is approved, with these changes: no left-hand section list, only the form with its four section headings (Map store, Who can edit, Kinds and assets, Map); the footer's "N reasons left" is a link that scrolls to the first reason.
- No create dialog: a project with no setup shows the empty state in the tab with one **Create setup** button; it fills the same form with the defaults, marked "New setup - saves with the project", with **Discard new setup** in the footer. Nothing is written until File > Save.
- A reason is never repeated in a dialog; the Designer's own save failure is the only save error. Reasons block a save, warnings never do.
- No horizontal scroll bar: the form is at most 760 px wide, left aligned, and wraps.
- Double-click on the Map Studio Setup node is the only way in; no node right-click menu. The node reads "Map Studio Setup", "(none)" or "(new, unsaved)".
- `tokenSecret` stays one string in setup schema 1, written `<provider>/<name>`: names only, never a value; the Designer never reads a secret.
- A typed value is allowed in every field and kept as typed, even when it is not in its list.

## Decisions (owner, 2026-10-27, plan answers: "agree with all recommendations, start building")

- Gateway lists: one module RPC for all of them (connections, the IdP's roles, secret providers and names); no platform RPC.
- Who may call it: any user who can open the Designer; it answers names only. A caller that is not a Designer session (a Vision client, an unauthenticated caller) is refused.
- A story 7 `tokenSecret` with no `/` shows as the secret name, with the warning "Name the secret provider too." beside Map token; never blocks the save.
- One story (no split).

## Decisions (owner, 2026-10-27, the decluttered form; where the mockup or EXPERIENCE.md lag, these win)

- No help line under fields: each label has a tooltip with the help text. The one visible line is under Map token: "Names only - the Designer never reads the token."
- No green check marks: a status mark appears only for a warning, a reason, or a list that is unavailable.
- One "Refresh lists" link in the form header beside "Schema version 1"; no per-field refresh buttons. No subtitle under the title.
- The footer shows only when it has something to say: reasons left (a link that scrolls to and focuses the first reason), a new unsaved setup (with "Discard new setup"), Gateway not reachable.
- The alarm page placeholder insert is the last dropdown item "Insert placeholder..."; no "{ }" button.
- Section headings stay; no left section list; no create dialog (empty state in the tab with one Create setup button, then the same form marked "New setup - saves with the project").
- Double-click on the node is the only way in; no node right-click menu; the node shows "(none)" or "(new, unsaved)".
- A field's reason is never repeated in a dialog. No horizontal scroll bar; the form is at most 760 px wide.

## Boundaries & Constraints

**Always:**
- The form owns no setup rule: reasons are the input checks plus `Setup.read`'s problems beside their field (bbb47d6). Warnings are the form's only new words and come only from a loaded list.
- Lists are suggestions. A list that fails, times out or is not offered leaves the field typeable, shows the "Gateway not reachable - lists unavailable, typing still works." banner with Try again (Gateway lists) and no warnings for that list.
- The RPC is read only and returns names: connection name and vendor, the project identity provider's name and role names, secret provider names and secret names. It never calls `SecretProvider.read`, never returns or logs a value, and is not callable from a Vision client.
- Gateway lists load off the Swing thread (`SwingWorker`), each with a 5 s deadline on the Gateway, so a slow provider never freezes the Designer.
- Colours from UIManager keys (DESIGN.md `designer-*`) with one fallback place; widths from DESIGN.md spacing; labels bound with `setLabelFor`; keyboard reachable.
- Every SDK behaviour not seen live is marked [unverified] in code comments and docs; no em dashes; logs through `MapStudio.designer` and `MapStudio.setup-lookups`.

**Never:**
- A setup schema change, a migration, a `common/.../contract/Setup` rule change, a browser or message change.
- A Gateway page or Gateway-wide setting for the setup; a second setup per project.
- Reading, showing or logging a secret value; a secret name in a log line at info level or above.
- A Map Studio dialog for a reason; an OK, Apply, Create or Cancel button in the tab.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No setup | project without the resource | node "(none)"; tab empty state with Create setup | none |
| New setup | Create setup | defaults in the form, marker shown, node "(new, unsaved)", connection focused with its reason | File > Save with reasons: footer line and the Designer's save failure only; Discard returns to empty |
| Pick from lists | Gateway reachable | connection combo lists `MapStudio (PostgreSQL)`; role chips add `MapEditor`; functions `mapstudio_dev.kinds`; pages `/`, `/edit`; providers then names | none |
| Typed, not in list | role `MapEdtor`, connection `MapStore` | kept and saved as typed; warning beside it | never blocks the save |
| Non-PostgreSQL | connection of vendor MSSQL | warning naming the type | never blocks |
| Gateway unreachable | RPC throws or times out | banner with Try again; grey cloud in status slots; functions and pages still listed | typing works; no warnings from Gateway lists |
| IdP cannot list roles | no user source of the IdP's name, or an OIDC/SAML IdP | role list says "This identity provider does not list its roles. Type them." | no unknown-role warnings |
| Secret provider cannot list | `list()` throws | names list unavailable; provider kept | typing works |
| tokenSecret | pick `Internal` + `mapbox-token` | `"tokenSecret": "Internal/mapbox-token"`; a stored value is split at its first `/`; a value with no `/` shows as the secret name with the warning "Name the secret provider too." | never blocks |
| Narrow tab | tab 500 px wide | rows stack, no horizontal scroll bar | none |
| Newer schema, unreadable, inherited | as story 7 | header "Schema N - read only" and "setup.json as written" box; Start from defaults; inherited banners | as story 7 |

</frozen-after-approval>

## Code Map

- `designer/.../designer/setup/SetupPanel.java` -- story 7's GridBag form; rebuild it (header, banners, four sections, footer). `show(form, locked, note)`, `current()`, the test hooks and `BooleanSupplier` confirm stay.
- `SetupForm.java` -- values, `fromJson`, `toJson`, `reasons()` over `Setup.read` (bbb47d6); add the token split/join `<provider>/<name>` (split at the first `/`) and `warnings(Lists)`; keep byte-exact writing.
- `SetupWorkspace.java` -- remove `create()` dialog and `initPopupMenu`; `onDoubleClick` opens the tab in every state; node text by state. `SetupEditor.java` -- `onCommitFailed` stops showing the reasons dialog (log at warn, rethrow to the Designer's failure) [unverified how the Designer words it]; `deserialize` of a missing resource gives the empty state. `SetupCommit`, `SetupRefusedException` -- keep; `describe()` used only in the log.
- `MapStudioDesigner.properties` -- all new texts (labels, help, warnings, banners, footer) from EXPERIENCE.md "Fields" and "States".
- SDK [SDK 8.3.0 javap], read 2026-10-27, not run: Gateway `GatewayModuleHook.getRpcImplementation(): Optional<GatewayRpcImplementation>`, `GatewayRpcImplementation.of(GatewayRpcSerializer, Object...)`; `RpcDelegate` routes methods of the one interface annotated `@RpcInterface(packageId)` on each implementation; `RpcDelegate.RunsOnClient(clientPermissionId)` marks a class Vision clients may call; `RpcDelegate.projectName()` and `session()` give the caller. Designer: `GatewayConnection.getRpcInterface(ClientRpcSerializer, String, Class<T>)` [unverified: the String is the module id]; `ProtoRpcSerializer.DEFAULT_INSTANCE`. Gateway services: `GatewayContext.getDatasourceManager().getDatasources()`, `getUserSourceManager().getProfile(name).getRoles()`, `getSecretProviderManager().getProviders()` and `ManagedSecretProvider.list()` (a default method; may throw for a provider that cannot list). Platform RPCs the Designer itself uses: `PlatformRpcInstances.DATASOURCE_RPC.getDatasources()` (name, `DatabaseVendor`), `USERS_RPC.getIdentityProviders()` (the Project Properties IdP dropdown uses it), `USERS_RPC.getRoles(userSource)`; there is no platform RPC for secrets. Project side: `DesignableProject.getResourcesOfType(ResourceType)`, `ScriptLibrary.RESOURCE_TYPE` (`ignition/script-python/<path>/code.py`), page config `com.inductiveautomation.perspective/page-config/config.json` keys of `pages`, `PerspectiveProjectProps.RESOURCE_TYPE` with field `idp` (absent in the dev project: `default`).
- `gateway/.../tags/{TagLookups, TagSource, IgnitionTagSource}.java` (story 15) -- the shape to copy: pure lookup class over a small source interface, Ignition adapter, deadline, unit tests with a fake.
- `gateway/.../MapStudioGatewayHook.java` -- add `getRpcImplementation`. `common/.../MapStudioModule.java` -- `MODULE_ID`.
- `ops/project/...` -- dev setup (`mapstudio_dev.kinds`, refresh 30), page config, scripts; bind mounted, a Designer save writes into git.

## Tasks & Acceptance

**Execution:**
- [x] `docs/platform-checks.md` -- first, new section "Epic 2 story 16 - setup lists from the Gateway": the javap reading above, then a live probe on `ms-e2s16` (port 9138, `.env`): the Gateway half of each list (`getDatasources` names and vendors; the dev project's IdP and `getProfile(idp).getRoles()`; `getProviders()` names and `list()` of the built-in provider, names counted, never printed above debug; timings), the module RPC registered and its route; Designer lines [not verified] until the owner's session. Probe removed before commit.
- [x] `common/.../contract/SetupLookupRpc.java` (new) -- `@RpcInterface(packageId = "mapstudio-setup")`: `String lists(String identityProvider)` (the IdP name the Designer reads from the open project's Perspective general properties, `default` when unset) and `String secretNames(String provider)`, each a JSON reply (`SetupLists` record parsed in common, unit tested) so only `String` crosses the serializer.
- [x] `gateway/.../setuplookup/{SetupLookups, LookupSource, IgnitionLookupSource}.java` (new) and `MapStudioGatewayHook.getRpcImplementation` -- answers per list `ok`, `unavailable` with plain reason, or `not-listed` (roles); 5 s deadline each; no `@RunsOnClient`, and a caller whose `RpcDelegate.session()` is not a Designer is refused; never `read`.
- [x] `designer/.../setup/ProjectLists.java` (new, pure) -- functions from script resources (top-level `def name(` at column 0, path `a/b` to `a.b.name`, inherited included), page URLs, the project IdP name; tested on `ops/project` copies.
- [x] `designer/.../setup/GatewayLists.java` (new) -- the RPC client behind an interface; `SwingWorker` loading; states loading, ok, unavailable.
- [x] `designer/.../setup/{SetupPanel, ChipField, PickerCombo, StatusSlot}.java` -- layout and states per Decisions and EXPERIENCE.md; footer link scrolls to the first reason.
- [x] `SetupForm`, `SetupWorkspace`, `SetupEditor`, bundle -- as Code Map.
- [x] Tests: `SetupFormTest` (token split/join, warnings, every matrix row the form decides), `SetupPanelTest` headless (empty, new, discard, chips, unreachable banner, no dialog on refusal, width at most 760 at 2000 px and no horizontal scroll at 500 px), `ProjectListsTest`, `SetupLookupsTest` with a fake source (unavailable, timeout, not-listed, no value read), `SetupListsTest` in common.
- [x] `docs/setup.md` (`tokenSecret` as `<provider>/<name>`), `docs/setup-editor.md` (rewrite for the new form, screenshot `docs/screenshots/setup-editor.png` after the owner's check), `docs/contract.md` if it states the token form.
- [ ] (owner, hitl) Designer session below, recorded in `docs/platform-checks.md`.

**Acceptance Criteria:**
- Given the dev stack, when the owner opens Map Studio Setup in the Designer, then the four sections show at most 760 px wide with "Schema version 1" as text, and each Gateway list loads within a few seconds.
- Given that form, when the owner picks `MapStudio`, `MapEditor` and `MapOperator`, the dev functions, an alarm page, basemaps and a secret provider with a typed secret name, types a role not in the list, and saves, then `setup.json` holds them as typed (`tokenSecret` `<provider>/<name>`) and `map.load` reflects the change without a restart.
- Given any save or list load, when `setup.json`, the Designer log and the Gateway log are read, then no secret value appears.

## Design Notes

Why one module RPC for the Gateway lists: secrets have no platform RPC, so the module needs one anyway; putting connections and roles behind it too gives one security story, one round trip, and a Gateway half the implementer can check live with a probe, leaving the owner one Designer check. Fallback if the owner's check shows the RPC is not reachable from the Designer: platform RPCs for connections and IdPs (the Designer's own dropdowns use them), typing for secrets.

## Implementation Notes

- Names as built: the RPC client and loading are `SetupListSource` (interface, `Async.SWING` / `Async.DIRECT`) and `DesignerListSource`; the pickers are `PickerField` and `ChipField`; the status slot is the row's warning mark (`FormParts.Row`); colours and glyphs are `Theme`.
- `lists(identityProvider)` takes the IdP name the Designer reads, not the project name, so the Gateway reads no project properties.
- Live 8.3.10: `UserSourceManager.getProfile(name)` throws `IllegalArgumentException` for a missing name (not null); handled as not-listed.
- The empty and new states are a plain tab of the workspace (the SDK's `ResourceEditor` throws for a missing resource); the workspace replaces the SDK close action, which casts the tab to `ResourceEditor`. Owner check.
- Screenshots `docs/screenshots/setup-editor-{normal,reasons,empty,new,unreachable}.png` come from `SetupPanelRenderTest` (Swing's own look, DESIGN.md stand-in colours).

## Verification

**Commands:**
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build` -- expected: green with the new tests.
- `ops/up.sh` on `ms-e2s16`, then `cd e2e && npm test` -- expected: all pass; Gateway log has the RPC registered and no secret value.
- `git grep -nP '\x{2014}'` -- expected: no match. `git grep -n 'read(' -- gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/setuplookup` -- expected: no secret provider read.

**Manual checks (hitl, the owner, in a Designer on `mapstudio-dev`, port 9138):**
1. Project Browser: "Map Studio Setup" (no suffix); right-click shows no Map Studio menu; double-click opens the tab.
2. The tab: four section headings, no section list, fields not wider than 760 px on a wide window; narrow the window: rows wrap, no horizontal scroll bar; "Schema version 1" is text.
3. Open each list: connections with types, roles of `default`, functions `mapstudio_dev.kinds` and `.assets`, pages `/`, `/edit`, ... and last "Insert placeholder...", secret providers then names; no mark beside a found value; label tooltips hold the help.
4. Pick `MapStudio`, keep `MapEditor`/`MapOperator`, pick the functions, an alarm page, tick Satellite, pick a provider and type a secret name; type role `MapEdtor`: warning, kept. File > Save; `git diff ops/project` shows the lines; a Perspective session's `map.load` reflects it; remove `MapEdtor`, save again.
5. Set refresh `0`: reason beside it, footer "1 reason left" scrolls to it on click; File > Save: only the Designer's save failure, no Map Studio dialog; note what the rest of the save did.
6. Stop the Gateway briefly (or disconnect): banner, Try again, typing works, functions and pages still listed.
7. Scratch project with no setup: node "(none)", empty state, Create setup, "(new, unsaved)", Discard returns to empty; Create again, fill connection, save: both files in `data/projects/<scratch>/com.aoindustrial.perspective.mapstudio/setup/`.
8. Search the Designer log (Help > Diagnostics) and `setup.json` for the secret's value: absent. Take `docs/screenshots/setup-editor.png`.
