# Kind setups and item checks, version 0.3.0

A **kind setup** says what the map items of one kind show: the comms tag, up to four KPI values, the alarms, the popup and its link, and a style rule (AD-16). Map Studio keeps one per project and kind id in the map store, saved through the same write path as map items (`edits.apply` and `system.mapstudio.applyEdits`), and returns them in `map.load` and `getMap`. It stores and checks them; from 0.3.0 the Gateway's live-value cache subscribes to the comms, KPI, alarms and style rule paths they turn on and the map draws them and the style rule's preset ([contract.md](contract.md), "values.batch"; "Style rules as the map evaluates them" below); the popup view and the link are drawn by later epic-viewing entries. Every map item saved is also checked against the project's kind list ([kinds-and-assets.md](kinds-and-assets.md)). Part of contract 0.3.0 ([contract.md](contract.md)). The code is the reference: `common/.../contract/KindSetup.java`, `Placeholders.java`, `StylePresets.java`, `ItemCheck.java` and, for what a viewer may see of a setup, `KindDisplay.java`.

Labels: **[live 8.3.10]** seen on the `ops/` dev Gateway by `e2e/tests/kindsetup.spec.mjs`; **[unverified]** written but not seen working.

## Saving a kind setup

An op with `entity` `kindSetup` whose `id` is the kind id (at most 64 characters) and whose `data` is `{"setup": {...}}`, the record's only field. Versions, conflicts, retries, deletes (tombstones) and restores (a create at the tombstone's version) work exactly as for map items ([contract.md](contract.md)); an update replaces the whole setup. Only full editing (and scripts) may save one; a phone editor or a viewer is refused `role`. The kind must be in the project's kind list.

```json
{"batchId": "<UUID>", "ops": [{"op": "create", "entity": "kindSetup", "id": "pad", "baseVersion": 0,
  "data": {"setup": {"link": "/pad/{item.name}"}}}]}
```

The stored record is `{kindId, setup, version, deleted}`. `map.load.reply` carries `kindSetups` (the live records) to sessions at level `phone` and `full` only, since they hold tag paths; a viewer gets none, and a viewer's `map.changed` carries a kind setup record without its `setup`. `system.mapstudio.getMap(project).kindSetups` is the list of live records (dicts) **[live 8.3.10]**.

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
| `link` | The popup link: a Perspective page path, text starting with one `/` (never `//`, `/\`, a scheme such as `javascript:` or `https:`, or another host), with any number of placeholders (`/pad/{item.name}`). A filled link can still hold what a property holds, so epic-viewing checks the filled path again before it opens it. |
| `popupView` | `{path, params}`: a project view shown in the popup. Each param is text: a literal (no braces), exactly one placeholder, or `{asset.path}/` and a tag path (owner, 2026-10-27). The view always receives the map item as `mapItem`, so no param may be named `mapItem`. |
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
| Tints | `tint-1` to `tint-6`, mapped to theme tokens by epic-viewing; no hue is promised before ER-27 |

Line weight by pipe size is not a preset: a line takes it from its `diameter` property ([contract.md](contract.md), "What the map draws"). What each preset and tint looks like, in both themes: [styles.md](styles.md).

## Style rules as the map evaluates them

Epic 3 entry 1 (AD-11, AD-16). The rule is worked out on the Gateway, in the shared live-value cache, once per map item per batch, and the result reaches every open map as the preset name in the item's `style` slot ([contract.md](contract.md), "values.batch"). The code is `common/.../contract/StyleRule.java` (States and Bands, pure), `gateway/.../live/StyleExpressions.java` (the expression) and `gateway/.../live/ValuePlan.java` (the source slot).

- **The source** is one more slot of the plan, subscribed only while a rule names it: `{"path": ...}` resolves like a comms or KPI path (`{asset.path}/...` from the item's own asset, a full path as one tag for every item); `{"kpi": key}` shares that KPI's path, so it costs no second subscription, and the KPI may be switched off (`on: false`) and still feed the rule. A key the setup has no KPI for reports the problem `the style rule names a KPI the setup does not have`.
- **States** match the source's value against each case's `value`: a number against a number by value (a text holding a number counts), text against text exactly, `true` or `false` against a boolean; no case gives `normal`.
- **Bands** hold a number when `min <= value < max` (an open end when null); a value in no band gives `normal`; a value that is not a number gives `normal` and the problem `the value is not a number, so no band holds it`.
- **Expression**: Ignition's expression language, parsed by the SDK's own parser once per rule and run per delivery of the source (about a third of a microsecond per run on the dev stack, [platform-checks.md](platform-checks.md), "Epic 3 entry 1"). `{value}` is the one reference (any other `{reference}` is refused at save); the functions are Ignition's standard ones (`if`, `case`, `switch`, `coalesce`, the maths, strings, dates and type casts) except `tag()`, `runScript()` and `hasChanged()`, which reach outside the value and are refused at save. The result must be one preset name of the kind, as text: `if({value} > 600, 'warning', 'normal')`, `case({value}, 1, 'attention', 2, 'warning', 'normal')`. Anything else (another text, a number, null, a bad quality, a run-time failure) draws `normal` with a `style` problem in words ("the expression gave \"4\", not a preset (normal, attention, warning, fault, dimmed)"). A rule's text never reaches a browser; the kind display lists the presets it names instead.
- **A stale source** (no value yet, a bad quality, or the item's comms lost) gives `normal` marked stale with the reason: the item draws only as stale until a fresh value arrives, and the map says so with the stale or comms-lost glyph and word.
- **An item's override** `overrides.styleRule` replaces the kind's whole rule for that item (its `{path}` a full path; its `{kpi}` one of the kind setup's keys as that item sees them). An override whose path is not full is ignored and the kind's rule applies.
- **The instruments source** (`{"instruments": "worst"}`) subscribes nothing here; entry 2 draws it per segment from the instruments' own presets.

A viewer gets the result only: the preset name per item, and per kind the rule's display (`{type, source: "kpi:<key>" | "tag" | "instruments", cases: [{label, preset}]}`) and the area tints, never a path or an expression.

## Item checks

Every map item op but a delete is checked, after the version check and inside the save's transaction, against the kind list in use, read once per batch (the cached list: `ok`, `incomplete`, or the last good one of a `failing` or `slow` list). A batch of deletes needs no list; any other batch, when no list is in use, is refused: "The kind list is not available (empty): The kind function mapstudio_dev.kinds returned no kinds. Nothing was saved." The whole record after the op is checked, so an update of an item whose kind left the list is refused unless it sets a known kind.

- `kind` names a kind of the list.
- The geometry matches the kind: a `point` kind takes a `Point`, a `line` kind a `LineString`.
- Every key of `properties` is a form field of the kind and its value has the field's type: `text` text, `choice` one of the choices, `number` a number, `integer` a whole number, `boolean` true or false; null means not set. A `number` is a finite double (at most 309 digits before the point, at most 400 after it or as an exponent) and an `integer` fits a 64-bit whole number (-9223372036854775808 to 9223372036854775807); a value out of that range is refused before it is converted ("properties.wells is a whole number field; "1e999999999" is out of range."). Required fields are not enforced at save in 0.2.0 (owner, 2026-10-27): the draw tool, scripts and imports create items before their form is filled, and epic-editing flags them.
- **CSV-style values** are normalised once, on the Gateway: a text holding a number in a `number` or `integer` field becomes the number (`"12"` to 12, `" 4.5 "` to 4.5), `"true"` or `"false"` in a `boolean` field becomes true or false, and a blank text there becomes null. Anything else is stored as sent.
- `overrides` is a partial kind setup with the same parts and rules, except that its tag paths are full paths only ("an override's tag path is a full path such as [default]Mesa/P12/Pressure") and a `{kpi}` source is not checked against a setup. Any other key is refused (icon, size and label overrides come with epic-editing). Like kind setups, overrides reach editors only: a map at level `none` gets each map item with `overrides` `{}` in `map.load` and `map.changed` ([contract.md](contract.md)).

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
