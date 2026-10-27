---
title: 'Setup editor in the Designer'
type: 'feature'
ticket: '7'
created: '2026-10-26'
status: 'in-review'
baseline_revision: '2ece12f0055252198e65a7f466582c9dc18671b2'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/story-tracer-one-edit-saved-through-the-write-path-and-read-back-plan.md'
  - '{project-root}/docs/platform-checks.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** After story 1 a project's setup (AD-5, setup v1) is a hand-edited `setup.json` in the project folder; an integrator has no way to create or change it in the Designer, and a typo only shows up as an unavailable map store on the Gateway.

**Approach:** A Designer-scope workspace for story 1's setup resource type, built on the SDK's `TabbedResourceWorkspace` and `ResourceEditor` as in IA's project-resource example (docs/platform-checks.md, check 4): a "Map Studio Setup" node in the project browser that creates or opens the project's one setup in a Swing form with a field for every setup v1 key, plain-words reasons beside each field, and a save that writes the same `setup.json` the Gateway's setup loader reads. Designer scope only: no Gateway, common contract, schema or browser change.

## Boundaries & Constraints

**Always:**
- Build on story 1 as merged: its setup `ResourceType` constant in `MapStudioModule`, its `common/.../contract/Setup` (parse and validate) and its resource layout (`com.aoindustrial.perspective.mapstudio/setup/` holding `resource.json` with scope `G`, `files: ["setup.json"]`, and `setup.json`). The editor writes exactly that layout, one setup per project at the type folder.
- The editor's rules come from `Setup` (the Gateway's rules); the form adds only input checks (a number is a number, a required field is filled). Its reasons are plain words naming the field.
- An invalid setup is never written: save is refused with the reasons.
- Keys the form does not know (a later schema's or a hand-added one) survive a save unchanged; `schemaVersion` is shown, never edited.
- `setup.json` is written as 2-space indented JSON, setup v1 keys in story 1's order, then unknown keys, newline at the end, so a Designer save of the bind-mounted dev project gives a minimal git diff.
- `tokenSecret` holds a secret provider name only; the label says so and no value of any secret is read, shown or logged.
- Logs through `MapStudio.designer`; no em dashes; every SDK behaviour not seen in a Designer is marked unverified in comments and docs until the owner sees it.

**Never:**
- Change Gateway code, `common/` contract classes, the setup schema, migrations, messages, the browser, `testSet` or `popupView`.
- Live setup change on the Gateway (`onResourcesModified`) or the Gateway-side setup validation and its log and `map.load` reasons (story 6).
- An RPC from the Designer to the Gateway, or pickers that list the Gateway's connections, roles, project functions or secrets.
- A second setup per project, a Gateway-wide setting, or the kind setup editor (epic-editing).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Project with no setup | browser node "Map Studio Setup" | a "Create setup" action; the form opens with defaults: `roles.full` `MapEditor`, `roles.phone` `MapOperator`, refresh 10, basemaps `none`, `osm`, other fields empty | `connection` empty is shown as "Name the database connection Map Studio stores the map in." |
| Edit and save | valid change in the form, Designer save | `setup.json` rewritten in place; `resource.json` unchanged | none |
| Invalid field | refresh `0`, empty `connection`, `kindsFunction` `kinds` | reason beside the field; the save of the setup is refused with the reasons | dialog naming the fields; nothing written |
| Unknown keys | `setup.json` with `"note": "x"` | after save `"note": "x"` still there, after the known keys | none |
| Newer schema | `schemaVersion` 2 | form read only, "This setup was written by a newer Map Studio (schema 2). This Designer edits schema 1." | nothing written |
| Unreadable file | `setup.json` not JSON | form read only with the parse reason and a "Start from defaults" button that asks first | nothing written until confirmed |
| Inherited setup | setup defined in a parent project | banner "Inherited from <project>"; save makes this project's own copy | read only when the resource is not overridable |

## Decisions (owner, "approve 2 to 7, recommendations", 2026-10-26)

- **Reaching the Gateway before story 6:** the owner's check restarts the dev Gateway while story 6 is not merged, and repeats without a restart once it is. Story 7 adds no `onResourcesModified`.
- **One source of setup rules:** the form shows only `Setup`'s messages plus input checks; story 6 is asked to put its plain-words rules in `common/.../contract/Setup.java`, not only in the Gateway loader.
- **Connection and role fields:** typed names checked for shape only; pickers are a later story.
- **Saving an invalid setup:** refused with the reasons, nothing written; the Designer's handling of a refused editor commit within a project save is part of the owner's check.

</frozen-after-approval>

## Code Map

- Story 1 as merged (`ccr-3c8b84b9-f1vbsm`, its plan's Change Log and `docs/contract.md`): `common/.../common/MapStudioModule.java` has `SETUP_RESOURCE_TYPE = new ResourceType(MODULE_ID, "setup")` and `SETUP_FILE = "setup.json"`; `common/.../common/contract/Setup.java` is a record with `static Setup parse(String) throws Setup.SetupException` (parse and validate in one, first fault only; messages name the key in quotes, for example `setup.json "refreshIntervalSeconds" must be ...`), `SCHEMA_VERSION`, `DEFAULT_REFRESH_SECONDS`, `DEFAULT_BASEMAPS`; `ops/project/com.aoindustrial.perspective.mapstudio/setup/{resource.json,setup.json}` is the dev setup (string arrays written inline, `["MapEditor"]`); the Designer hook registers `DesignerScriptModule` in `initializeScriptManager`; the Gateway reads the setup through `gateway/.../setup/{SetupRegistry, SetupLifecycle, SetupLifecycleFactory}` at project start only. Story 1's contract names (`MapStudioException`, `map.load.reply`, the error body, `ChangeHook.onCommitted(CommittedBatch)`, `StoreGate`, the work pool, `editorTest`) are not touched by this story. Story 7 reads these and edits only the Designer hook.
- `designer/.../designer/MapStudioDesignerHook.java` -- `startup(DesignerContext, LicenseState)` registers the component; add the workspace registration after it, nothing in `shutdown` unless the proof shows the Designer keeps the workspace across a project switch.
- `designer/build.gradle.kts` -- compileOnly SDK deps only, no tests yet; copy the test block of `common/build.gradle.kts` (JUnit BOM 5.11.4, `ignition-common`, plus `project(":common")`).
- SDK, [SDK 8.3.0 javap] read from `designer-8.3.0.jar` and `common-8.3.0.jar`, not run: `TabbedResourceWorkspace(DesignerContext, ResourceDescriptor)` with abstract `newResourceEditor(ResourcePath)` and `addNewResourceActions(ResourceFolderNode, JPopupMenu)`, overridable `createRootNavTreeNode()`, `createWorkspaceHomeTab()`, `open(ResourcePath)`; `ResourceEditor<T>` with `init(T)`, `getObjectForSave()`, `deserialize(Resource)`, `serializeResource(ResourceBuilder, T)`, `onCommitFailed(Exception)`; `ResourceDescriptor.builder().resourceType().nounKey().rootFolderText().icon().navTreeLocation().build()`; `NewResourceAction` with `configureResource(ResourceBuilder)`, `createPrototypeBytes()`; `DesignerContext.registerResourceWorkspace(ResourceWorkspace)`, `getProject(): DesignableProject` with `getLocalResource(ResourcePath)`, `createOrModify(ResourcePath, Consumer<ResourceBuilder>)`, `isInherited`, `isOverridable`, `getDefiningProject`; `ResourcePath(ResourceType, String)` and `isResourceTypeFolder()`; `ResourceBuilder.putData(String, byte[])`, `setApplicationScope(String)`.
- IA's project-resource example (`PythonResourceWorkspace`, `PythonResourceEditor`, about 306 lines) is the shape to follow; it is not in this repository and its handling of a resource at the type folder (a singleton, like Perspective's `page-config`) is unverified.
- `ops/docker-compose.yml` -- `ops/project` is bind-mounted as `mapstudio-dev`, so a Designer save writes `setup.json` back into git; revert or commit it deliberately after a check.

## Tasks & Acceptance

**Execution:**
- [x] `designer/src/main/java/.../designer/setup/SetupForm.java` (new, pure, no Swing) -- holds the field values; `fromJson(String)` (states: ok, newer schema, unreadable with reason), `defaults()`, `toJson()` (order and unknown keys as Always), `reasons()` = input checks plus the `Setup.parse` message mapped to its field by the quoted key -- one testable unit for every matrix row.
- [x] `designer/src/main/java/.../designer/setup/SetupEditor.java` (new, `ResourceEditor<SetupForm>`) -- Swing form: text fields `connection`, `kindsFunction`, `assetsFunction`, `alarmPage`, `tokenSecret` (label "Secret provider name of the map token, never the token"), one-per-line lists `roles.full`, `roles.phone`, `basemaps`, a spinner `refreshIntervalSeconds`, read-only `schemaVersion`; reasons under each field, updated as the user types; banners for newer schema, unreadable file and inherited setup; `getObjectForSave` throws with the reasons when any remain.
- [x] `designer/src/main/java/.../designer/setup/SetupWorkspace.java` (new, `TabbedResourceWorkspace`) -- descriptor on story 1's setup type, root node "Map Studio Setup" that opens `ResourcePath(setupType, "")` or offers "Create setup" (writes `resource.json` scope `G`, `files: ["setup.json"]`, and the defaults); `newResourceEditor` returns `SetupEditor`.
- [x] `designer/src/main/resources/.../designer/MapStudioDesigner.properties` (new) and `MapStudioDesignerHook.java` -- noun key, labels and reasons in one bundle (`BundleUtil`), `context.registerResourceWorkspace(new SetupWorkspace(context))` in `startup`.
- [x] `designer/build.gradle.kts`, `designer/src/test/java/.../designer/setup/SetupFormTest.java` (new) -- test block; tests for every matrix row except the inherited one, plus byte-exact output for story 1's dev `setup.json` read and written unchanged.
- [ ] (pending, the owner) Owner Designer session (hitl), recorded in `docs/platform-checks.md` as a new last section "Epic 2 story 7 - setup editor in the Designer", each line labelled **[owner, seen in the Designer, <date>]** or [not verified]: the node appears; the type-folder setup opens; Create setup on a scratch project writes both files (seen in `data/projects/<scratch>/com.aoindustrial.perspective.mapstudio/setup/`); an invalid save is refused and what the Designer does with the rest of the project save; the dev project edit reaches `map.load` as in Acceptance. If the tabbed workspace cannot hold a type-folder resource, apply the fallback in Design Notes and repeat.
- [x] `docs/setup-editor.md` (new) -- what each field means, the reasons the form gives, how a save reaches the Gateway (restart until story 6 is merged), a Designer screenshot the owner takes (`docs/screenshots/setup-editor.png`), and unverified marks for anything not seen.

**Acceptance Criteria:**
- Given the dev stack with story 1's setup, when the owner removes `MapEditor` from full-editing roles in the form, saves and the Gateway picks up the change (a restart, or no restart once story 6 is merged), then `map.load` for `mapeditor` reports level `none`, and restoring the role brings back `full`.
- Given a scratch project with no setup, when the owner creates one in the form, fills `connection` with `MapStudio` and saves, then the project folder holds `resource.json` and `setup.json` in story 1's layout and the Gateway log shows no setup error for that project at its first `map.load` (or, with no view, at a restart).
- Given the save above, when `git diff ops/project` is read, then only the changed values differ.

## Implementation Notes

Implemented directly in the planning session (no implementation subagent was available), 2026-10-27, on the `ms-e2s7` dev stack (port 9127). Baseline `2ece12f0055252198e65a7f466582c9dc18671b2` (story 1 merged).

- **Files:** `designer/.../designer/setup/{SetupForm, SetupPanel, SetupEditor, SetupWorkspace}.java`, `designer/src/main/resources/.../designer/MapStudioDesigner.properties`, tests `SetupFormTest` (16) and `SetupPanelTest` (5, Swing built headless), the test block in `designer/build.gradle.kts` (with `java.awt.headless`), the workspace and bundle registration in `MapStudioDesignerHook` (wrapped so a workspace failure leaves the component registered), `docs/setup-editor.md`, and the new last section of `docs/platform-checks.md` with every Designer line [not verified]. No Gateway, common, web, migration or compose change.
- **SDK, read with `javap -c` [SDK 8.3.0 javap], not run:** `ResourceEditor`'s constructor sets `context`, `workspace`, `resourcePath`, then calls `loadResource` (so `init` runs before subclass fields: the panel is made in `init`, the field has no initialiser); `commit()` skips the write when `isOptimizeCommits()` and the object equals the one read (so `SetupForm.equals` compares the written text and a read-only setup is handed back unchanged), modifies a local resource, and creates this project's own copy of a non-local (inherited) one; an exception goes to `onCommitFailed`. `TabbedResourceWorkspace.getKey()` is abstract; `ResourceType.rootPath()` gives the type-folder path.
- **Runs and results:** `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build` green: Java 72 tests (common 8, gateway 43, designer 21), Jest 42 (7 suites). The `.modl` holds the five setup classes and the bundle in the `D` jar. `ops/up.sh` on `ms-e2s7` (kept volume): Gateway running, bundle served, `mapeditor` created; log has the setup read for `mapstudio-dev`, one schema creation and no Map Studio error (the JDBC `NoClassDefFoundError` during the start-up classloader reload is story 3's known one; the `no-such-project` warning is the e2e test's). `cd e2e && npm test`: 16 of 16, teardown "no file holds the map editor's password". No generated password in the Gateway log or in tracked files.
- **Matrix audit:** no setup (`defaultsAreTheSchemaDefaultsWithNoConnection`, `defaultsAskForTheConnectionInPlainWords`); edit and save (`devSetupReadAndWrittenUnchangedIsByteExact`, `anEditChangesOnlyItsOwnLineAndTheGatewayReadsIt`, `everyFieldRoundTripsThroughSetupParse`, `SetupPanelTest.showsTheSetupAndGivesItBackUnchanged`); invalid field (`invalidFieldsGiveAReasonBesideEachField`, `SetupPanelTest.reasonsFollowTheTyping`); unknown keys (`unknownKeysSurviveASaveAfterTheKnownKeys`); newer schema (`aNewerSchemaIsReadOnlyAndNeverRewritten`, `SetupPanelTest.aNewerSchemaIsShownReadOnly`); unreadable (`anUnreadableFileIsReadOnlyWithTheParseReason`, `otherUnreadableShapesSayWhy`, `SetupPanelTest.anUnreadableFileOffersStartFromDefaults`); inherited: banner and lock in `SetupPanelTest.anInheritedSetupShowsWhereItComesFrom`, the SDK side is the owner's check. All ran and passed.
- **Acceptance:** AC 3 (minimal diff) is unit tested (one changed line); AC 2's file layout is unit tested in part: the defaults plus connection `MapStudio` are byte for byte story 1's dev `setup.json`, which the dev Gateway reads in every e2e run. AC 1 and 2 in the Designer wait for the owner's session.
- **No new e2e test:** the editor is Swing in the Designer; the Playwright suite drives Perspective sessions only, and no Designer runs here.
- **Not run:** a Designer (the owner's check and the screenshot `docs/screenshots/setup-editor.png`).

## Plan Change Log

- 2026-10-27, before implementation: story 1 merged; Code Map updated to its real names (`Setup.parse` throws `Setup.SetupException` and is the one validation entry point; no separate `validate`). Open Questions resolved to the owner's recommended answers (Decisions). No change to the intent.
- 2026-10-27, implementation deviations (not a review loopback): **Create setup** opens the form with the defaults in a dialog and writes the resource only when the form has no reasons, instead of writing the defaults first (the defaults have no connection, and Always says an invalid setup is never written); the Swing form is its own class `SetupPanel`, shared by the editor tab and that dialog (and by the Design Notes fallback); the type-folder path is `SETUP_RESOURCE_TYPE.rootPath()`; the refresh interval is a text field rather than a spinner, so the input check can say "a whole number" for any typed text; input checks are the ones Always names plus the shape `package.function` for the two functions (Decision 3) and a name listed twice; `Setup.parse` stops at its first fault, so `reasons()` asks it once per field in an otherwise valid setup and so shows every field's reason at once.

## Review Triage Log

## Design Notes

**Why the form calls `Setup` and owns no rule.** Story 6 owns the plain-words setup rules on the Gateway; if both stories kept rules, a setup the Designer accepts could be refused by the Gateway. `SetupForm.reasons()` therefore asks `Setup` and maps each message to its field by the key it names; a message naming no known key shows at the top of the form. When story 6 improves the messages in `Setup`, the form shows them with no change here. A signature difference from story 1's plan touches only `SetupForm`.

**Fallback for the type-folder resource.** If the proof shows `TabbedResourceWorkspace` cannot open a resource at the type folder (it is built around named resources in folders), replace `SetupWorkspace` with a plain project-browser node (`AbstractNavTreeNode` under `getProjectBrowserRoot()`) that opens the same `SetupEditor` panel in a modal dialog and saves through `DesignableProject.createOrModify(path, builder -> builder.putData("setup.json", bytes))`. `SetupForm` and the bundle stay as they are. Moving the setup to a named folder is not a fallback: it changes story 1's loader contract.

**Parallel safety.** New files only, under `designer/.../setup/` and `docs/setup-editor.md`, plus one line in the Designer hook, the test block in `designer/build.gradle.kts` and an appended section in `docs/platform-checks.md`. No migration: story 7 changes no schema.

## Verification

**Commands:**
- `./gradlew build` -- expected: green, including `SetupFormTest`.
- `git grep -nP '\x{2014}'` -- expected: no match.
- `git diff --stat <story 1 merge>..HEAD -- gateway common web ops/docker-compose.yml` -- expected: empty.

**Manual checks (hitl, the owner):**
- The Designer session in Tasks, recorded in `docs/platform-checks.md`, and the screenshot in `docs/setup-editor.md`.
- `git diff ops/project` after the edit check, then reverted or committed on purpose.
