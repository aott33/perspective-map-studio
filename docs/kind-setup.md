# Kind setups and item checks, version 0.4.0

A **kind setup** says what the map items of one kind show: the comms tag, up to four KPI values, the alarms, the popup and its link, and a style rule (AD-16). Map Studio keeps one per project and kind id in the map store, saved through the same write path as map items (`edits.apply` and `system.mapstudio.applyEdits`), and returns them in `map.load` and `getMap`. From epic 4 entry 12a a map editor saves one from the Kinds screen ("Saved from the Kinds screen" below). It stores and checks them; from 0.3.0 the Gateway's live-value cache subscribes to the comms, KPI, alarms and style rule paths they turn on and the map draws them and the style rule's preset ([contract.md](contract.md), "values.batch"; "Style rules as the map evaluates them" below); the popup view and the link are drawn since epic 3 entry 8 ([contract.md](contract.md), "The popup"). Every map item saved is also checked against the project's kind list ([kinds-and-assets.md](kinds-and-assets.md)). Part of contract 0.4.0 ([contract.md](contract.md)); unchanged since 0.3.0. The code is the reference: `common/.../contract/KindSetup.java`, `Placeholders.java`, `StylePresets.java`, `ItemCheck.java` and, for what a viewer may see of a setup, `KindDisplay.java`.

Labels: **[live 8.3.10]** seen on the `ops/` dev Gateway by `e2e/tests/kindsetup.spec.mjs` (and `e2e/tests/kinds.spec.mjs` for the Kinds screen); **[unverified]** written but not seen working.

## Saving a kind setup

An op with `entity` `kindSetup` whose `id` is the kind id (at most 64 characters) and whose `data` is `{"setup": {...}}`, the record's only field. Versions, conflicts, retries, deletes (tombstones) and restores (a create at the tombstone's version) work exactly as for map items ([contract.md](contract.md)); an update replaces the whole setup. Only full editing (and scripts) may save one; a phone editor or a viewer is refused `role`. The kind must be in the project's kind list.

```json
{"batchId": "<UUID>", "ops": [{"op": "create", "entity": "kindSetup", "id": "pad", "baseVersion": 0,
  "data": {"setup": {"link": "/pad/{item.name}"}}}]}
```

The stored record is `{kindId, setup, version, deleted}`. `map.load.reply` carries `kindSetups` (the live records) to sessions at level `phone` and `full` only, since they hold tag paths; a viewer gets none, and a viewer's `map.changed` carries a kind setup record without its `setup`. `system.mapstudio.getMap(project).kindSetups` is the list of live records (dicts) **[live 8.3.10]**.

## Saved from the Kinds screen

Epic 4 entry 12a (R4; the owner's decisions of 2026-11-09). In Edit mode a map editor (level `full`, 768 px and wider) opens the rail's **Kinds**: the dock lists the project's kinds and the chosen kind's setup shows in the properties panel's place, with the sections 1 Icon, 2 Key values, 3 Comms, 4 Alarms, 5 Popup and 6 Style rule ([contract.md](contract.md), "The Kinds surface and a kind's setup", has the surface in full and its test hooks). What it saves and how:

- **One field, one save, the whole setup.** A field saves when it is finished (blur or Enter), a switch, a checkbox and the Icon value star at once; there is no save button. Each save is one `kindSetup` op as above, whose `setup` is the stored setup with only the edited part changed: the browser applies the one edit to the newest stored setup when it sends it (`web/typescript/kindSetup.ts` `applyEdit`), so `styleRule`, `areaTints` and any value the screen does not draw are stored as they were. A kind with no setup is saved as a create at version 0 (a create at the tombstone's version when its setup was deleted before). One save per kind is in flight at a time; later edits follow at the version its reply gave. A kind setup save is not an Undo step and has no Revert in Recent changes.
- **What the screen edits.** `kpis` (label, path, unit, `on`, `icon`; up to 4; add and remove), `comms` (`path`, `on`), `alarms` (`path`, `count`, `summary`), `link`, `popupView` (`path`, `params`) and, from entry 12b1, `styleRule` and `areaTints` ("The style rule and the area tints from the Kinds screen" below). A `comms` or `alarms` path typed empty removes that part, and an empty link removes `link`: the schema takes no part without its path. An emptied popup view path removes `popupView` only when it has no params; while it has any, nothing is sent, the field says "Remove its params first. The popup view is kept." and the stored view stands (owner, 2026-11-10: one save would take every param, with no Undo). An item's tag path overrides are edited from its Details (entry 12c1, "Overridden from Details" below; an item's own style rule from the Style tab is entry 12c2); the icon, size and label come from the kind list (backlog story 38).
- **A key value's `key`** is made from its label when the row is first saved: the label's letters and digits in lower case ("Gas price" gives `gasprice`), `value` when it has none, at most 64 characters, a number added on a clash (`pressure2`); it never changes after, so a style rule's `{"kpi": key}` and an item override keep naming it when the label is edited. Remove is off for the key value the style rule is built on ("Used by the style rule").
- **Tag paths are typed** (the tag browser is entry 13) and checked by the Gateway as below; under each stored path the screen says how many of the kind's linked items it resolves for, from `tags.resolve` with the preview item's asset ("Resolves for 3 of 5 well pads"), and for a full path "Same tag for every well pad".
- **A refusal** (`invalid`) shows the Gateway's words beside the field they name, without "Op N (id):"; the field keeps what was typed and the stored setup stands. A `conflict` (another editor saved the kind after the field was typed in) keeps the typed text and offers "Use <name>'s version" on the conflict card.

A script and the screen write the same record, so a setup saved by `system.mapstudio.applyEdits` shows in the open screen at once, and one saved from the screen is in `getMap(project).kindSetups` **[live 8.3.10]** (`e2e/tests/kinds.spec.mjs`).

### The style rule and the area tints from the Kinds screen

Epic 4 entry 12b1 (R15; the owner's decisions of 2026-11-10). Section 6 is the Style rule editor of DESIGN.md's Kind setup and key screen 6 (kinds-style); the preview item's "Preview" word on the map, Show on map and the Live now note at the section's foot are entry 12b2 ([contract.md](contract.md), "The preview item on the map and the Live now note"). Browser only: the parts are the schema's below, saved through the same one-part save (`web/typescript/kindSetup.ts`, `checkRule`, `checkTints`; the `styleRule` and `areaTints` edits of `applyEdit`).

- **The type** is a segmented choice in the panel tabs' look: None, States, Bands, Expression and, for a line kind that is not an area, From its instruments. None removes `styleRule`; From its instruments saves `{"source": {"instruments": "worst"}}` and shows one line, "Each segment takes the worst of the instruments at its ends."
- **The value** (States and Bands; optional for Expression) is a select of the kind's key values, those switched off in the popup too (`{"kpi": key}`), and "A tag path" with a typed path (`{"path": ...}`) and the resolve note of any stored path. The key value a saved rule reads carries "Used by style rule" and its Remove is off.
- **States** are rows of "When <value> is" a value, a preset and a tile. A value is read as typed: a number as a number, `true` and `false` as themselves, anything else as text, and text in double quotes stays text, so `1` and `"1"` are the two distinct cases the Gateway compares. **Bands** are rows of from and to (empty for an open end, only the first open below and only the last open above), a preset and a tile, in order. **Expression** is one multi-line field saved when it is left; `{value}` is its one reference and its result a preset name, and its tiles are the presets its text names.
- **Presets and tiles.** A preset is picked by name from the closed list for the kind (the line presets too for a line kind), never a colour. Each row's 64 px tile draws the kind's icon (a line sample for a line or area kind) in that preset with the preset's state word, with the map's own drawing code and the theme's tokens ([styles.md](styles.md), "The preview").
- **One part, sent whole, once it is whole.** The section holds one draft of the rule and sends it as soon as its shape is valid: a select or a button at once, a typed field when it is finished. Until then it says "Not saved yet" and what is missing under the rows ("Not saved yet. Band 2 has no preset.", "Case 5 has the same value as case 2 (2): each value has one case.", "Band 1: its from (900) is not below its to (600).") and nothing is sent, so the stored rule stands. The browser checks what the write path checks of a rule's shape; what only the Gateway can tell (a tag path's form, an expression it cannot read) it refuses, and its words stand beside the value, the expression or the row they name, the row found by the order the cases were sent in.
- **Each type keeps its own value and cases** until the kind is left, so a type switched away from and back is as it was typed. A draft that is not whole is never overwritten by another editor's save; a whole one that is not what is stored (their rule arrived, or a save was given up) takes the stored rule, the other types' rows kept.
- **Area tints**, under the rule for an area kind only: the property (one of the kind's form fields; "No tints" removes `areaTints`) and a row per category with its tint (`tint-1` to `tint-6`, by name) and a swatch. For a choice field the rows are its choices, a row with "No tint" left out of what is saved; for any other field the categories are typed and removed. "Not saved yet" says what is missing here too.

**[live 8.3.10]** (`e2e/tests/kindstyle.spec.mjs`; a choice field's rows, a refused case's place and the pass-through of every other part over the five seed setups are Jest's, `web/typescript/__tests__/kindSetup.test.ts`).

### Overridden from Details

Epic 4 entry 12c1 (R5; the owner's decisions of 2026-11-10). In Edit mode a map editor (level `full`, one item selected) finds the **Live now** block at the foot of the item's Details ([contract.md](contract.md), "Details' Live now block and path overrides", has the surface in full and its test hooks): Comms, one row per key value of the kind's setup in its order (the icon value bold and starred) and Alarms, each with its live value in the popup's words and its tag path. Browser only: the parts are the schema's below and the checks are "Item checks", saved as an ordinary item update (`web/typescript/itemOverrides.ts`).

- **From kind or Override.** A row's path is the kind's, filled for this item (`{asset.path}/Pressure` reads `[default]Mesa/P12/Pressure`; as written, with a note, for an item with no asset) and tagged "From kind", or the item's own and tagged **Override** with **Reset**. Override on a row makes its path a text field starting from the path shown, saved when it is finished (blur or Enter; Esc puts it back); there is no save button.
- **Only a full path.** An override's tag path is a full path with its provider. Anything else (`{asset.path}/X`, `Mesa/X`, `[default]`) says so under the field in the Gateway's words and nothing is sent: the browser applies the Gateway's own rule (`Placeholders.checkTagPath` for an override). A save the Gateway still refuses (a role, a kind that left the list) shows its words under the field without "Op N (id): overrides:" and the part's name, the stored overrides standing.
- **One row, one save, the whole `overrides`.** An item update replaces `overrides` whole, so each save carries the item's newest overrides (those of a save still in flight included) with only that row changed, and every other stored part passes through as it was. A key value's override is its entry `{key, path}` in `overrides.kpis`: its path only (owner decision 1), an entry's other stored values kept. A new Comms or Alarms override is the kind's stored part with the path replaced, so the kind's switches are kept (the Gateway replaces the kind's part whole); one the item already has keeps its own values and takes the new path. Reset removes the entry or the part, and an emptied `kpis` is left out.
- **An ordinary item edit.** Each override or Reset is one Undo step and one row of Recent changes with Revert, named by its part: "Undo: change Point 2's Pressure path", "Changed Point 2's Pressure path", "Reset Point 2's comms path" (owner decision 3). A conflict, the store unreachable and busy are entry 10's.
- **An asset not in the asset list.** A linked item whose asset the asset list does not hold shows the paths as the kind has them with a note saying so; only an item with no asset is called not linked.
- **A kind change drops them.** Changing an item's kind sends `overrides: {}` in the same update when the item has any (owner decision 2): they were written for the kind it leaves. One Undo brings the kind and the overrides back.
- **What counts as an override** is what the Gateway applies ("Style rules as the map evaluates them" and `gateway/.../live/ValuePlan.java`): a `comms` or `alarms` part whose path is full, a `kpis` entry whose path is full and whose key the kind has, and a `styleRule` (whose path, when it has one, is full). A `link`, `popupView` or `areaTints` override and a `kpis` entry for a key the kind no longer has are stored and checked but never applied: they stay stored and untouched by every save here, and are neither marked Override nor counted in the kind's header ("1 override (Point 2 style rule)") or read as the item's own rule by the Live now note (owner decision 5).

**[live 8.3.10]** (`e2e/tests/overrides.spec.mjs`; the pass-through of every other stored part, the words by part and what is counted are Jest's, `web/typescript/__tests__/itemOverrides.test.ts`, `itemOverridesDelegate.test.ts`).

## The schema

Every part is optional, and a key Map Studio does not know is refused. The setup is stored as sent; a reader applies the defaults (`on` true, `count` and `summary` true, `icon` false).

```json
{"comms": {"path": "{asset.path}/Comms", "on": true},
 "kpis": [{"key": "pressure", "label": "Pressure", "path": "{asset.path}/Pressure", "unit": "psi", "on": true, "icon": true},
          {"key": "gas", "label": "Gas price", "path": "[default]Shared/GasPrice", "unit": "", "on": false, "icon": false}],
 "alarms": {"path": "{asset.path}", "count": true, "summary": true},
 "link": "/pad/{item.name}",
 "popupView": {"path": "Popups/PadDetails", "params": {"padName": "{item.name}", "pressure": "{asset.path}/Pressure"}},
 "styleRule": {"source": {"kpi": "pressure"}, "type": "bands",
               "cases": [{"min": null, "max": 900, "preset": "normal"}, {"min": 900, "max": null, "preset": "warning"}]},
 "areaTints": {"property": "operator", "tints": [{"category": "North", "tint": "tint-1"}]}}
```

| Part | Rule |
| --- | --- |
| `comms` | `{path, on}`: the comms tag; `on` shows it in the popup. |
| `kpis` | At most 4 `{key, label, path, unit, on, icon}`; `key` text, at most 64 characters, unique; at most one `icon: true` (the value shown on the map icon). |
| `alarms` | `{path, count, summary}`: the alarms below `path`; `count` and `summary` are the popup parts. |
| `link` | The popup link: a Perspective page path, text starting with one `/` (never `//`, `/\`, a scheme such as `javascript:` or `https:`, or another host), with any number of placeholders (`/pad/{item.name}`). A filled link can still hold what a property holds, so the map checks the filled path again before it opens it (epic 3 entry 8): the popup's pop-out icon is hidden when a placeholder has no value (no asset, a property not set) or the filled text is not a page path. |
| `popupView` | `{path, params}`: a project view shown in the popup instead of the default popup (epic 3 entry 8). Each param is text: a literal (no braces), exactly one placeholder, or `{asset.path}/` and a tag path (owner, 2026-10-27), filled in the browser when the popup opens; a param whose placeholder has no value is left out, so the view sees its own default. The view always receives the map item as `mapItem` (`{id, name, kind, assetId, properties, basePath, alarmsPath, values}`, live while open), so no param may be named `mapItem`. A view that is missing or fails falls back to the default popup. The dev project's `Popups/PadAlarms` is an example that embeds the built-in Alarm Status Table for the item's folder (`ops/project/com.inductiveautomation.perspective/views/Popups/PadAlarms`). |
| `styleRule` | `{source, type, cases, expression}`. `source` is `{"path": tag path}` or `{"kpi": key}` (a KPI of this setup), needed by `states` and `bands`. `states`: `cases` `[{value, preset}]`, one case per value (text, number or true or false). `bands`: `cases` `[{min, max, preset}]` in order, `min` below `max`, only the first open below (`min` null) and only the last open above (`max` null), no overlap. `expression`: a non-empty `expression` text and no `cases`: an Ignition expression (epic 3 entry 1, below) whose one reference is `{value}`, the source's value; the write path parses it and refuses one that cannot be read ("styleRule.expression: the expression could not be read: ..."). |
| `styleRule` from the instruments | `{"source": {"instruments": "worst"}}` and nothing else (owner, 2026-10-27; epic 2 story 14): a line kind, not an area, takes its look per line segment from the worst of the instruments at the segment's ends, whose own style rules give their presets (epic-viewing draws it, AD-11). `type`, `cases` and `expression` beside it are refused ("a rule whose source is the instruments has no type ..."), and so is the source on a point or area kind ("styleRule.source: pad is a point kind; only a line kind that is not an area takes its look from its instruments."). An item override of a line may say the same. |
| `areaTints` | `{property, tints}` for area kinds only (a line kind with `area: true` in the kind list): `property` a form field of the kind, `tints` `[{category, tint}]`, one tint per category. |

The `on` switches are the per-value switches of the popup (FR-12); with every part off there is no popup.

**Tag paths** (comms, KPIs, alarms, a rule's `path`) are `{asset.path}`, `{asset.path}/<path>` (below the map item's asset, what the tag browser gives for a pick inside the asset folder), or a full path with its provider, `[default]Shared/GasPrice` (the same tag for every item).

### Placeholders

The closed list: `{item.id}`, `{item.name}`, `{asset.id}`, `{asset.path}` and `{item.properties.X}`, X a form field key of the kind. Braces only mark placeholders: an unknown placeholder, or a brace with no partner, is refused. The project setup's `alarmPage` takes the same placeholders (any field key there, since it serves every kind; [setup.md](setup.md)).

One fill function, published in `common/` (`Placeholders.fill`) and mirrored in the browser (`web/typescript/placeholders.ts`, the same test vectors), replaces each placeholder from the map item and its asset, and gives nothing (null) when one has no value (no asset, a property not set). For pad P12 linked to asset P12 with base path `[default]Mesa/P12`, `{asset.path}/Pressure` fills to `[default]Mesa/P12/Pressure`. A number property fills as the browser shows it (JavaScript `String(n)`): `12.0` gives `12`, `4.50` gives `4.5`, `1e21` gives `1e+21`. Empty values and URL encoding of links are epic-viewing's.

### Presets and tints

Closed lists in `common/.../StylePresets.java` (owner decisions, 2026-10-27); a colour code is never stored or accepted ("Pick a preset: normal, attention, warning, fault, dimmed; colour codes are not accepted.").

| List | Names |
| --- | --- |
| Presets, every kind | `normal`, `attention`, `warning`, `fault`, `dimmed` |
| Line presets, line kinds only | `solid`, `dashed`, `dotted` |
| Tints | `tint-1` to `tint-6`, mapped to the theme tokens `--mapstudio-tint-1` to `-6` ([styles.md](styles.md); the hues chosen in [review-er27.md](review-er27.md), the engineering review of 0.3.0) |

Line weight by pipe size is not a preset: a line takes it from its `diameter` property alone, instruments or not, and with no `diameter` draws as the thin 2 px line in the lateral tone ([contract.md](contract.md), "What the map draws"; owner review notes item 11). What each preset and tint looks like, in both themes: [styles.md](styles.md).

## Style rules as the map evaluates them

Epic 3 entry 1 (AD-11, AD-16). The rule is worked out on the Gateway, in the shared live-value cache, once per map item per batch, and the result reaches every open map as the preset name in the item's `style` slot ([contract.md](contract.md), "values.batch"). The code is `common/.../contract/StyleRule.java` (States and Bands, pure), `gateway/.../live/StyleExpressions.java` (the expression) and `gateway/.../live/ValuePlan.java` (the source slot).

- **The source** is one more slot of the plan, subscribed only while a rule names it: `{"path": ...}` resolves like a comms or KPI path (`{asset.path}/...` from the item's own asset, a full path as one tag for every item); `{"kpi": key}` shares that KPI's path, so it costs no second subscription, and the KPI may be switched off (`on: false`) and still feed the rule. A key the setup has no KPI for reports the problem `the style rule names a KPI the setup does not have`.
- **States** match the source's value against each case's `value`: a number against a number by value (a text holding a number counts), text against text exactly, `true` or `false` against a boolean; no case gives `normal`.
- **Bands** hold a number when `min <= value < max` (an open end when null); a value in no band gives `normal`; a value that is not a number gives `normal` and the problem `the value is not a number, so no band holds it`.
- **Expression**: Ignition's expression language, parsed by the SDK's own parser once per rule and run per delivery of the source (about a third of a microsecond per run on the dev stack, [platform-checks.md](platform-checks.md), "Epic 3 entry 1"). `{value}` is the one reference (any other `{reference}` is refused at save); the functions are Ignition's standard ones (`if`, `case`, `switch`, `coalesce`, the maths, strings, dates and type casts) except `tag()`, `runScript()` and `hasChanged()`, which reach outside the value and are refused at save. The result must be one preset name of the kind, as text: `if({value} > 600, 'warning', 'normal')`, `case({value}, 1, 'attention', 2, 'warning', 'normal')`. Anything else (another text, a number, null, a bad quality, a run-time failure) draws `normal` with a `style` problem in words ("the expression gave \"4\", not a preset (normal, attention, warning, fault, dimmed)"). A rule's text never reaches a browser; the kind display lists the presets it names instead.
- **A stale source** (no value yet, a bad quality, or the item's comms lost) gives `normal` marked stale with the reason: the item draws only as stale until a fresh value arrives, and the map says so with the stale or comms-lost glyph and word.
- **An item's override** `overrides.styleRule` replaces the kind's whole rule for that item (its `{path}` a full path; its `{kpi}` one of the kind setup's keys as that item sees them). An override whose path is not full is ignored and the kind's rule applies.
- **The instruments source** (`{"instruments": "worst"}`) subscribes nothing of its own: the line's look is worked out per segment from the batch items of the instruments at each segment's ends (their own style rules' presets, their comms and their icon KPI's freshness, their alarms) and sent as the line's `segments` slot (epic 3 entry 2; [contract.md](contract.md), "The segments slot"; [instruments.md](instruments.md)). An instrument's kind setup needs an icon KPI that is on for the instrument to bound a segment; one without (a line valve) is listed in the popup and drawn on the line but bounds none.

A viewer gets the result only: the preset name per item, and per kind the rule's display (`{type, source: "kpi:<key>" | "tag" | "instruments", cases: [{label, preset}]}`) and the area tints, never a path or an expression.

## Item checks

Every map item op but a delete is checked, after the version check and inside the save's transaction, against the kind list in use, read once per batch (the cached list: `ok`, `incomplete`, or the last good one of a `failing` or `slow` list). A batch of deletes needs no list; any other batch, when no list is in use, is refused: "The kind list is not available (empty): The kind function mapstudio_dev.kinds returned no kinds. Nothing was saved." The whole record after the op is checked, so an update of an item whose kind left the list is refused unless it sets a known kind.

- `kind` names a kind of the list.
- The geometry matches the kind: a `point` kind takes a `Point`, a `line` kind a `LineString`.
- Every key of `properties` is a form field of the kind and its value has the field's type: `text` text, `choice` one of the choices, `number` a number, `integer` a whole number, `boolean` true or false; null means not set. A `number` is a finite double (at most 309 digits before the point, at most 400 after it or as an exponent) and an `integer` fits a 64-bit whole number (-9223372036854775808 to 9223372036854775807); a value out of that range is refused before it is converted ("properties.wells is a whole number field; "1e999999999" is out of range."). Required fields are not enforced at save in 0.2.0 (owner, 2026-10-27): the draw tool, scripts and imports create items before their form is filled, and epic-editing flags them.
- **CSV-style values** are normalised once, on the Gateway: a text holding a number in a `number` or `integer` field becomes the number (`"12"` to 12, `" 4.5 "` to 4.5), `"true"` or `"false"` in a `boolean` field becomes true or false, and a blank text there becomes null. Anything else is stored as sent.
- `overrides` is a partial kind setup with the same parts and rules, except that its tag paths are full paths only ("an override's tag path is a full path such as [default]Mesa/P12/Pressure") and a `{kpi}` source is not checked against a setup. Any other key is refused (icon, size and label overrides come with epic-editing). From the studio an editor overrides a tag path in the item's Details ("Overridden from Details" above). Like kind setups, overrides reach editors only: a map at level `none` gets each map item with `overrides` `{}` in `map.load` and `map.changed` ([contract.md](contract.md)).

A refusal is code `invalid` naming the op (`{index, id}`) and the part, in plain words, and nothing is written: "Op 0 (<id>): properties.wells is a whole number field, not "abc"." **[live 8.3.10]**

## From a script

Jython 2.7, catching both kinds of exception:

```python
import java.lang
import uuid

logger = system.util.getLogger('MapStudio.kindsetup')
project = 'my-project'


def stored(kind_id):
    for setup in system.mapstudio.getMap(project).kindSetups:
        if setup['kindId'] == kind_id:
            return setup
    return None


setup = {'comms': {'path': '{asset.path}/Comms'}, 'link': '/pad/{item.name}'}
current = stored('pad')
if current is None:
    op = {'op': 'create', 'entity': 'kindSetup', 'id': 'pad', 'baseVersion': 0, 'data': {'setup': setup}}
else:
    op = {'op': 'update', 'entity': 'kindSetup', 'id': 'pad', 'baseVersion': current['version'],
          'data': {'setup': setup}}
try:
    result = system.mapstudio.applyEdits(project, {'batchId': str(uuid.uuid4()), 'ops': [op]}, 'setup-script')
    logger.info('Kind setup saved as seq %s' % result['seq'])
except java.lang.Throwable as ex:
    logger.warn('Not saved: %s' % ex.getMessage())
except Exception as ex:
    logger.warn('Not saved: %s' % ex)
```

A kind setup that was deleted is not in `kindSetups`; restore it with a create at its tombstone's version (the `conflict` reply to a create at 0 carries it as `current`).
