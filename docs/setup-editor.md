# Map Studio Setup in the Designer

Each Perspective project that uses Map Studio has one setup (architecture AD-5, setup schema version 1): the project resource `com.aoindustrial.perspective.mapstudio/setup/`, holding `setup.json` and `resource.json`. The schema is in [contract.md](contract.md), section "The project setup". Since epic 2 story 7 the Designer edits it: the project browser has a **Map Studio Setup** node.

Status: built and unit tested; not yet seen in a Designer. Statements below about what the Designer shows are **[not verified]** until the owner's check in [platform-checks.md](platform-checks.md), section "Epic 2 story 7 - setup editor in the Designer", marks them seen. A screenshot (`docs/screenshots/setup-editor.png`) follows that check.

## Opening and creating

- Double-click **Map Studio Setup** (or right-click, **Open setup**) to open the project's setup in a tab.
- A project with no setup offers **Create setup** instead. It opens the form with the defaults in a dialog: full-editing role `MapEditor`, phone-editing role `MapOperator`, refresh every 10 seconds, basemaps `none` and `osm`, every other field empty. **Create** is refused until the form has no reasons left (at least the database connection); then the resource is added to the project, and the next project save sends it to the Gateway.
- A project that inherits its setup shows "Inherited from <project>"; saving makes this project's own copy. When the parent does not allow overriding it, the form is read only.

## The fields

| Field | `setup.json` key | Meaning | What the form checks |
| --- | --- | --- | --- |
| Database connection | `connection` | The Gateway database connection (PostgreSQL) the map is stored in | Required: "Name the database connection Map Studio stores the map in." |
| Full-editing roles | `roles.full` | Ignition role names that may edit everything; one per line, compared exactly | A name listed twice |
| Phone-editing roles | `roles.phone` | Role names with phone editing | A name listed twice |
| Kinds function | `kindsFunction` | The project library function that returns the kind list | Empty, or shaped `package.function` (for example `mapstudio_adapter.kinds`) |
| Assets function | `assetsFunction` | The project library function that returns the asset list | Empty, or shaped `package.function` |
| Refresh interval (seconds) | `refreshIntervalSeconds` | How often kinds and assets are refreshed | A whole number; the Gateway's rule then says 1 or more |
| Alarm page | `alarmPage` | The Perspective page alarms link to | none |
| Basemaps | `basemaps` | The basemaps offered, one per line | A name listed twice |
| Secret provider name of the map token, never the token | `tokenSecret` | The name of the secret that holds the basemap token. The Designer never reads, shows or logs a secret's value | none |
| Schema version | `schemaVersion` | Shown, never edited | |

The form keeps no setup rule of its own. Apart from the input checks above, its reasons are the Gateway's own setup reader's messages (`common/.../contract/Setup.java`), shown beside the field they name, so a setup the form accepts is one the Gateway reads. A file is read the way the Gateway reads it: a refresh interval written as text (`"10"`), which the Gateway refuses, makes the file unreadable here; `15.0` is shown as `15`; `"basemaps": null` means no basemaps (only a missing key means `none` and `osm`); and a file the Gateway refuses is never shown as one it would read. The form is stricter in one place: a fractional interval such as `10.5`, which the Gateway cuts to `10`, is shown as written and asked to be a whole number. Reasons update as you type.

## Saving

- The setup is saved with the project (File, Save): at each project save the module commits the open setup tab (the Designer commits only its own workspaces for a module), and the tab compares the form with the setup it read, so typing alone needs no change mark. Whether the Designer's Save is offered when the setup tab is the only change is part of the owner's check **[not verified]**. A setup with reasons left is not saved: a dialog names the fields, and nothing is written. What the Designer then does with the rest of the project save is part of the owner's check **[not verified]**.
- `setup.json` is written as 2-space indented JSON, the known keys in the order of the schema, lists of names on one line, then any keys the form does not know (a later schema's or a hand-added one) unchanged, with a newline at the end. Saving an unchanged setup writes nothing; a change to one field changes only its line, so a save of the bind-mounted dev project (`ops/project`) gives a small git diff. Revert or commit such a diff on purpose.
- A setup written by a newer Map Studio (`schemaVersion` above 1) is shown read only, with "This setup was written by a newer Map Studio (schema N). This Designer edits schema 1.", and is never rewritten.
- A `setup.json` that is not readable (not JSON, no `schemaVersion`, a field of the wrong type) is shown read only with the reason and a **Start from defaults** button, which asks first; the file is replaced only at the next project save.

## How a save reaches the Gateway

The Gateway reads the setup when the project starts (story 1). Until epic 2 story 6 is merged, a saved change applies after a Gateway restart (dev stack: `ops/down.sh` then `ops/up.sh`); with story 6 it applies without one. A missing or unreadable setup leaves the project's map store unavailable, and `map.load` answers `store-unreachable` with the reason ([contract.md](contract.md)).
