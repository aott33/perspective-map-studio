---
title: 'Setup editor in the Designer'
type: 'feature'
ticket: '7'
created: '2026-10-26'
status: 'draft'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'medium'
review: ''
review_source: ''
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

</frozen-after-approval>

## Code Map

- Story 1 (planned, not built; read its plan in `context`): `common/.../common/MapStudioModule.java` gains the setup `ResourceType`; `common/.../common/contract/Setup.java` parses and validates setup v1; `ops/project/com.aoindustrial.perspective.mapstudio/setup/{resource.json,setup.json}` is the dev setup; `designer/.../designer/MapStudioDesignerHook.java` gains `DesignerScriptModule` registration; `gateway/.../setup/SetupLifecycle.java` reads the setup at project start only. Story 7 reads all of these and edits only the Designer hook (one registration line).
- `designer/.../designer/MapStudioDesignerHook.java` -- `startup(DesignerContext, LicenseState)` registers the component; add the workspace registration after it, nothing in `shutdown` unless the proof shows the Designer keeps the workspace across a project switch.
- `designer/build.gradle.kts` -- compileOnly SDK deps only, no tests yet; copy the test block of `gateway/build.gradle.kts` (JUnit BOM 5.11.4, `ignition-common`, `project(":common")`).
- SDK, [SDK 8.3.0 javap] read from `designer-8.3.0.jar` and `common-8.3.0.jar`, not run: `TabbedResourceWorkspace(DesignerContext, ResourceDescriptor)` with abstract `newResourceEditor(ResourcePath)` and `addNewResourceActions(ResourceFolderNode, JPopupMenu)`, overridable `createRootNavTreeNode()`, `createWorkspaceHomeTab()`, `open(ResourcePath)`; `ResourceEditor<T>` with `init(T)`, `getObjectForSave()`, `deserialize(Resource)`, `serializeResource(ResourceBuilder, T)`, `onCommitFailed(Exception)`; `ResourceDescriptor.builder().resourceType().nounKey().rootFolderText().icon().navTreeLocation().build()`; `NewResourceAction` with `configureResource(ResourceBuilder)`, `createPrototypeBytes()`; `DesignerContext.registerResourceWorkspace(ResourceWorkspace)`, `getProject(): DesignableProject` with `getLocalResource(ResourcePath)`, `createOrModify(ResourcePath, Consumer<ResourceBuilder>)`, `isInherited`, `isOverridable`, `getDefiningProject`; `ResourcePath(ResourceType, String)` and `isResourceTypeFolder()`; `ResourceBuilder.putData(String, byte[])`, `setApplicationScope(String)`.
- IA's project-resource example (`PythonResourceWorkspace`, `PythonResourceEditor`, about 306 lines) is the shape to follow; it is not in this repository and its handling of a resource at the type folder (a singleton, like Perspective's `page-config`) is unverified.
- `ops/docker-compose.yml` -- `ops/project` is bind-mounted as `mapstudio-dev`, so a Designer save writes `setup.json` back into git; revert or commit it deliberately after a check.

## Tasks & Acceptance

**Execution:**
- [ ] `designer/src/main/java/.../designer/setup/SetupForm.java` (new, pure, no Swing) -- holds the field values; `fromJson(String)` (states: ok, newer schema, unreadable with reason), `defaults()`, `toJson()` (order and unknown keys as Always), `reasons()` = input checks plus `Setup` parse and validate messages mapped to fields -- one testable unit for every matrix row.
- [ ] `designer/src/main/java/.../designer/setup/SetupEditor.java` (new, `ResourceEditor<SetupForm>`) -- Swing form: text fields `connection`, `kindsFunction`, `assetsFunction`, `alarmPage`, `tokenSecret` (label "Secret provider name of the map token, never the token"), one-per-line lists `roles.full`, `roles.phone`, `basemaps`, a spinner `refreshIntervalSeconds`, read-only `schemaVersion`; reasons under each field, updated as the user types; banners for newer schema, unreadable file and inherited setup; `getObjectForSave` throws with the reasons when any remain.
- [ ] `designer/src/main/java/.../designer/setup/SetupWorkspace.java` (new, `TabbedResourceWorkspace`) -- descriptor on story 1's setup type, root node "Map Studio Setup" that opens `ResourcePath(setupType, "")` or offers "Create setup" (writes `resource.json` scope `G`, `files: ["setup.json"]`, and the defaults); `newResourceEditor` returns `SetupEditor`.
- [ ] `designer/src/main/resources/.../designer/MapStudioDesigner.properties` (new) and `MapStudioDesignerHook.java` -- noun key, labels and reasons in one bundle (`BundleUtil`), `context.registerResourceWorkspace(new SetupWorkspace(context))` in `startup`.
- [ ] `designer/build.gradle.kts`, `designer/src/test/java/.../designer/setup/SetupFormTest.java` (new) -- test block; tests for every matrix row except the inherited one, plus byte-exact output for story 1's dev `setup.json` read and written unchanged.
- [ ] Owner Designer session (hitl), recorded in `docs/platform-checks.md` as a new last section "Epic 2 story 7 - setup editor in the Designer", each line labelled **[owner, seen in the Designer, <date>]** or [not verified]: the node appears; the type-folder setup opens; Create setup on a scratch project writes both files (seen in `data/projects/<scratch>/com.aoindustrial.perspective.mapstudio/setup/`); an invalid save is refused and what the Designer does with the rest of the project save; the dev project edit reaches `map.load` as in Acceptance. If the tabbed workspace cannot hold a type-folder resource, apply the fallback in Design Notes and repeat.
- [ ] `docs/setup-editor.md` (new) -- what each field means, the reasons the form gives, how a save reaches the Gateway (restart until story 6 is merged), a Designer screenshot the owner takes (`docs/screenshots/setup-editor.png`), and unverified marks for anything not seen.

**Acceptance Criteria:**
- Given the dev stack with story 1's setup, when the owner removes `MapEditor` from full-editing roles in the form, saves and the Gateway picks up the change (a restart, or no restart once story 6 is merged), then `map.load` for `mapeditor` reports level `none`, and restoring the role brings back `full`.
- Given a scratch project with no setup, when the owner creates one in the form, fills `connection` with `MapStudio` and saves, then the project folder holds `resource.json` and `setup.json` in story 1's layout and the Gateway log shows no setup error for that project at its first `map.load` (or, with no view, at a restart).
- Given the save above, when `git diff ops/project` is read, then only the changed values differ.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

**Why the form calls `Setup` and owns no rule.** Story 6 owns the plain-words setup rules on the Gateway; if both stories kept rules, a setup the Designer accepts could be refused by the Gateway. `SetupForm.reasons()` therefore asks `Setup` and maps each message to its field by the key it names; a message naming no known key shows at the top of the form. When story 6 improves the messages in `Setup`, the form shows them with no change here. A signature difference from story 1's plan touches only `SetupForm`.

**Fallback for the type-folder resource.** If the proof shows `TabbedResourceWorkspace` cannot open a resource at the type folder (it is built around named resources in folders), replace `SetupWorkspace` with a plain project-browser node (`AbstractNavTreeNode` under `getProjectBrowserRoot()`) that opens the same `SetupEditor` panel in a modal dialog and saves through `DesignableProject.createOrModify(path, builder -> builder.putData("setup.json", bytes))`. `SetupForm` and the bundle stay as they are. Moving the setup to a named folder is not a fallback: it changes story 1's loader contract.

**Parallel safety.** New files only, under `designer/.../setup/` and `docs/setup-editor.md`, plus one line in the Designer hook, the test block in `designer/build.gradle.kts` and an appended section in `docs/platform-checks.md`. No migration: story 7 changes no schema.

## Open Questions

1. **How the owner's check reaches the Gateway before story 6.** Story 1 reads the setup only at project start; picking up a Designer save without a restart is story 6. (a) Recommended: story 7's check restarts the dev Gateway when story 6 is not merged yet, and repeats without a restart once it is; (b) story 7's owner check waits until story 6 is merged; (c) story 7 adds a minimal `onResourcesModified` re-read in story 1's `SetupLifecycle` (collides with story 6).
2. **One source of setup rules.** (a) Recommended: the form shows only `Setup`'s messages plus input checks, and story 6 is asked to put its plain-words rules in `common/.../contract/Setup.java` rather than only in the Gateway loader; (b) the form keeps its own copy of the rules (two places to keep in step); (c) the form checks input only and the Gateway alone judges the setup.
3. **Connection and role fields.** (a) Recommended: typed names checked for shape only, as Never says; (b) pickers listing the Gateway's database connections and the user source's roles, which needs Designer APIs or an RPC not checked yet and a Gateway change, so a later story.
4. **Saving an invalid setup.** (a) Recommended: refused with the reasons, nothing written (the Designer's handling of a refused editor commit within a project save is unverified and is part of the owner's check); (b) written with a warning, and the Gateway reports it unavailable (story 6's reasons).

## Verification

**Commands:**
- `./gradlew build` -- expected: green, including `SetupFormTest`.
- `git grep -nP '\x{2014}'` -- expected: no match.
- `git diff --stat <story 1 merge>..HEAD -- gateway common web ops/docker-compose.yml` -- expected: empty.

**Manual checks (hitl, the owner):**
- The Designer session in Tasks, recorded in `docs/platform-checks.md`, and the screenshot in `docs/setup-editor.md`.
- `git diff ops/project` after the edit check, then reverted or committed on purpose.
