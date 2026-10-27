# Map Studio Setup in the Designer

Each Perspective project that uses Map Studio has one setup (architecture AD-5, setup schema version 1): the project resource `com.aoindustrial.perspective.mapstudio/setup/`, holding `setup.json` and `resource.json`. The schema is in [contract.md](contract.md), section "The project setup", and the fields' rules in [setup.md](setup.md). The Designer edits it in the **Map Studio Setup** tab (epic 2 story 7; laid out again, with lists to pick from, in epic 2 story 16).

Status: built and unit tested; the Gateway half of the lists is checked live; not yet seen in a Designer. Statements below about what the Designer shows are **[not verified]** until the owner's check in [platform-checks.md](platform-checks.md), sections "Epic 2 story 7 - setup editor in the Designer" and "Epic 2 story 16 - setup lists from the Gateway", marks them seen. The pictures are the form painted headless with Swing's own look and the DESIGN.md stand-in colours (`SetupPanelRenderTest`), not a Designer screenshot: [normal](screenshots/setup-editor-normal.png), [reasons](screenshots/setup-editor-reasons.png), [empty](screenshots/setup-editor-empty.png), [new](screenshots/setup-editor-new.png), [unreachable](screenshots/setup-editor-unreachable.png). A Designer screenshot (`docs/screenshots/setup-editor.png`) follows the owner's check.

## Opening and creating

- Double-click **Map Studio Setup** in the project browser. That is the only way in: the node has no Map Studio menu. The node reads "Map Studio Setup", "Map Studio Setup (none)" when the project has no setup, "Map Studio Setup (new, unsaved)" while a new one waits for File > Save, or "Map Studio Setup (inherited)".
- A project with no setup opens the tab in its empty state: "No Map Studio setup" and one **Create setup** button. There is no create dialog. Create setup fills the same form with the defaults (full-editing role `MapEditor`, phone-editing role `MapOperator`, refresh every 10 seconds, basemaps `none` and `osm`, everything else empty), marked "New setup - saves with the project", and puts the cursor in Database connection. Nothing is written until File > Save; **Discard new setup** in the footer returns to the empty state.
- A project that inherits its setup shows "Inherited from <project>"; saving makes this project's own copy. When the parent does not allow overriding it, the form is read only.

## The form

The tab holds one form, at most 760 px wide and left aligned, in four sections: Map store, Who can edit, Kinds and assets, Map. On a narrow tab each label moves above its control and the form wraps; there is never a horizontal scroll bar. The header shows "Map Studio Setup", a **Refresh lists** link and "Schema version 1" as text (never a field). Help is in each label's tooltip (and is the control's accessible description); the one line under a field is under Map token: "Names only - the Designer never reads the token."

| Field | `setup.json` key | Control | List |
| --- | --- | --- | --- |
| Database connection | `connection` | Editable picker | The Gateway's database connections, each with its type |
| Full-editing roles | `roles.full` | Chips: Enter adds what is typed, Backspace in the empty input removes the last, each chip's cross removes it | The roles of the project's identity provider |
| Phone-editing roles | `roles.phone` | As above | As above |
| Kinds function | `kindsFunction` | Editable picker, monospace | The project library's top-level functions as `package.function` (names starting with `_` are not offered) |
| Assets function | `assetsFunction` | As above | As above |
| Refresh interval | `refreshIntervalSeconds` | Number field with up and down, "seconds"; any text can be typed | none |
| Basemaps | `basemaps` | Checkboxes None, OpenStreetMap, Satellite, Mapbox (and a box for any other name in the file, so it can be unticked) | fixed |
| Alarm page | `alarmPage` | Editable picker, monospace | The page URLs of the project's page configuration, then **Insert placeholder...**, which inserts `{item.id}`, `{item.name}`, `{asset.id}`, `{asset.path}` or `{item.properties.<field key>}` at the cursor. A picked URL with a `:param` gets `{item.name}` there, selected |
| Map token | `tokenSecret` | Secret provider picker and secret name picker; saved as `<provider>/<name>` | The Gateway's secret providers, then the chosen provider's secret names |

Every list is a suggestion: anything can be typed, and it is saved as typed. Gateway lists load when the tab opens and with Refresh lists, off the Swing thread; project lists are read from the open project.

**Reasons** stop the save: the input checks (a connection is named, the interval is a whole number, a function is `package.function`, nothing is listed twice) and the Gateway's own setup reader's messages (`common/.../contract/Setup.java`), each beside its field, so a setup the form accepts is one the Gateway reads. **Warnings** never stop it and come only from a list that loaded: a connection the Gateway does not have yet, a connection that is not PostgreSQL, a role the identity provider does not have, a function not in the project library, a page not in the page configuration, a secret provider or secret name the Gateway does not have, Mapbox ticked with no token, a token with no provider. A field with a reason takes the red edge; a field with a warning takes the warning edge and a glyph beside it; nothing marks a field that is fine.

The **footer** shows only when it has something to say: "N reasons left - this setup is not saved until they are fixed." ("N reasons left" scrolls to the first reason and focuses it) with the warning count; for a new setup, "New setup - not saved yet." or its reasons, with Discard new setup; or "Gateway not reachable - lists unavailable, typing still works." with Try again. When the Gateway is not reachable, its lists say "List unavailable", their warnings are not shown, and functions and pages still list.

Reading a file follows the Gateway: a refresh interval written as text (`"10"`) makes the file unreadable here; `15.0` shows as `15`; `"basemaps": null` means no basemaps; a file the Gateway refuses is never shown as one it would read. The form is stricter in one place: `10.5`, which the Gateway cuts to `10`, is shown as written and asked to be a whole number.

## The Gateway lists, names only

The lists come from the module's own RPC, `SetupLookupRpc` (package `mapstudio-setup`), answered by the Gateway's `SetupLookups`: connection names and types, the role names of the user source named like the project's identity provider (an identity provider without one, such as OIDC or SAML, "does not list its roles"), secret provider names and one provider's secret names. Each list answers within 5 s or is unavailable on its own. It never reads, returns or logs a secret's value; only a Designer session may call it (it is not offered to a Vision client, and the module refuses any other caller). Owner decision 2026-10-27: any user who can open the Designer may see these names.

## Saving

- The setup is saved with the project (File > Save): at each project save the module commits the open setup tab (and a new setup), and the tab compares the form with the setup it read, so typing alone needs no change mark. Whether the Designer's Save is offered when the setup tab is the only change is part of the owner's check **[not verified]**.
- A setup with reasons left is not saved: the footer says so, and the project save fails with the Designer's own standard save failure. No Map Studio dialog repeats the reasons. What the Designer does with the rest of that project save is part of the owner's check **[not verified]**.
- `setup.json` is written as 2-space indented JSON, the known keys in the order of the schema, lists of names on one line, then any keys the form does not know unchanged, with a newline at the end. Saving an unchanged setup writes nothing, and an unchanged `tokenSecret` keeps its bytes; a change to one field changes only its line, so a save of the bind-mounted dev project (`ops/project`) gives a small git diff. Revert or commit such a diff on purpose.
- A setup written by a newer Map Studio (`schemaVersion` above 1) is shown as written, read only, under "Schema 2 - read only", and never rewritten.
- A `setup.json` that is not readable is shown as written with the reason and a **Start from defaults** button, which asks first; the file is replaced only at the next project save.

## How a save reaches the Gateway

The Gateway reads the setup when the project starts (story 1) and again when the project changes (story 6), so a saved change applies without a restart. A missing or unreadable setup leaves the project's map store unavailable, and `map.load` answers `store-unreachable` with the reason ([contract.md](contract.md)).
