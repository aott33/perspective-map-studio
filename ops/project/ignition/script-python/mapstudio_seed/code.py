# Dev seed for the mapstudio-dev map (epic 2 story 11). Jython 2.7 (the Gateway's).
# Test equipment for the dev Gateway only: the /edit page's "Seed the dev map" button
# calls run(), and the e2e suite presses it before the specs that need map items.
#
# It writes two sets into the map store through system.mapstudio.applyEdits, the
# documented scripting API (docs/contract.md, "The scripting API"), never SQL:
#   scale   30 pads (Pad 1 .. Pad 30) and 30 lines (Line to Pad N), the frame rate set
#           that the spike's seeded stand-in drew (story 7), frozen here as literals;
#   tracer  three pads (Point 1 .. Point 3) and the line between the first two
#           (Tracer line), at the tracer's old coordinates; the points are linked to the dev
#           assets P12, P14 and P15 (epic 3 entry 5), so their live values resolve (P15 has no
#           Comms or Pressure tag, so those report unresolved).
#   setup   the pad kind setup (epic 3 entry 5): comms {asset.path}/Comms, the KPIs Pressure
#           (the icon value) and Flow, alarms {asset.path}, the link /pad/{item.name}.
# Every id is a UUIDv5 of a stable name (mapstudio-dev/seed/<set>/<key>), so a re-run
# finds its items: unchanged ones are left alone, edited ones are put back on the seed
# fields, kind, name, geometry and properties, plus assetId where the seed sets one (an
# update at the stored version; an assetId the seed does not set, overrides, ends or
# attachment an editor added stays), and deleted ones are restored (a create at the tombstone's
# version, read from the conflict the first save returns). One batch, all or none,
# under the actor seed-script; the only second batch is that restore. The kind setup is
# one more op of the same batch when it is absent or differs.
#
# The scripting API trusts its caller, so the view that calls run() checks the role.

import java.lang

PROJECT = 'mapstudio-dev'
ACTOR = 'seed-script'
ID_PREFIX = 'mapstudio-dev/seed/'
PAD_PROPERTIES = {'status': 'producing'}

# (n, longitude, latitude), 6 decimals, from web/typescript/scaleData.ts before it was removed.
SCALE_PADS = (
    (1, -105.056215, 39.708958),
    (2, -105.029050, 39.700681),
    (3, -104.998342, 39.703710),
    (4, -104.946030, 39.703813),
    (5, -104.908198, 39.702932),
    (6, -104.873678, 39.703692),
    (7, -105.056096, 39.727281),
    (8, -105.021054, 39.727688),
    (9, -104.987196, 39.724346),
    (10, -104.951991, 39.720947),
    (11, -104.921635, 39.729718),
    (12, -104.891717, 39.729116),
    (13, -105.067100, 39.742158),
    (14, -105.025398, 39.749061),
    (15, -104.991274, 39.740699),
    (16, -104.944712, 39.746189),
    (17, -104.907948, 39.750252),
    (18, -104.877210, 39.741011),
    (19, -105.065458, 39.768900),
    (20, -105.026478, 39.760318),
    (21, -104.982945, 39.759317),
    (22, -104.964764, 39.761804),
    (23, -104.916178, 39.761235),
    (24, -104.876735, 39.758636),
    (25, -105.064963, 39.778576),
    (26, -105.018288, 39.787366),
    (27, -104.983269, 39.790178),
    (28, -104.953768, 39.782550),
    (29, -104.919769, 39.779617),
    (30, -104.874308, 39.781299),
)

# (n, coordinates): pad, bend, gathering station.
SCALE_LINES = (
    (1, ((-105.056215, 39.708958), (-105.063107, 39.712968), (-105.070000, 39.725000))),
    (2, ((-105.029050, 39.700681), (-105.049525, 39.706761), (-105.070000, 39.725000))),
    (3, ((-104.998342, 39.703710), (-104.985421, 39.713908), (-104.972500, 39.744500))),
    (4, ((-104.946030, 39.703813), (-104.959265, 39.713985), (-104.972500, 39.744500))),
    (5, ((-104.908198, 39.702932), (-104.894099, 39.718449), (-104.880000, 39.765000))),
    (6, ((-104.873678, 39.703692), (-104.876839, 39.719019), (-104.880000, 39.765000))),
    (7, ((-105.056096, 39.727281), (-105.063048, 39.726711), (-105.070000, 39.725000))),
    (8, ((-105.021054, 39.727688), (-105.045527, 39.727016), (-105.070000, 39.725000))),
    (9, ((-104.987196, 39.724346), (-104.979848, 39.729384), (-104.972500, 39.744500))),
    (10, ((-104.951991, 39.720947), (-104.962245, 39.726836), (-104.972500, 39.744500))),
    (11, ((-104.921635, 39.729718), (-104.947067, 39.733414), (-104.972500, 39.744500))),
    (12, ((-104.891717, 39.729116), (-104.885858, 39.738087), (-104.880000, 39.765000))),
    (13, ((-105.067100, 39.742158), (-105.068550, 39.737868), (-105.070000, 39.725000))),
    (14, ((-105.025398, 39.749061), (-105.047699, 39.743046), (-105.070000, 39.725000))),
    (15, ((-104.991274, 39.740699), (-104.981887, 39.741650), (-104.972500, 39.744500))),
    (16, ((-104.944712, 39.746189), (-104.958606, 39.745767), (-104.972500, 39.744500))),
    (17, ((-104.907948, 39.750252), (-104.893974, 39.753939), (-104.880000, 39.765000))),
    (18, ((-104.877210, 39.741011), (-104.878605, 39.747008), (-104.880000, 39.765000))),
    (19, ((-105.065458, 39.768900), (-105.067729, 39.757925), (-105.070000, 39.725000))),
    (20, ((-105.026478, 39.760318), (-105.048239, 39.751489), (-105.070000, 39.725000))),
    (21, ((-104.982945, 39.759317), (-104.977723, 39.755613), (-104.972500, 39.744500))),
    (22, ((-104.964764, 39.761804), (-104.968632, 39.757478), (-104.972500, 39.744500))),
    (23, ((-104.916178, 39.761235), (-104.898089, 39.762176), (-104.880000, 39.765000))),
    (24, ((-104.876735, 39.758636), (-104.878368, 39.760227), (-104.880000, 39.765000))),
    (25, ((-105.064963, 39.778576), (-105.067481, 39.765182), (-105.070000, 39.725000))),
    (26, ((-105.018288, 39.787366), (-104.995394, 39.776650), (-104.972500, 39.744500))),
    (27, ((-104.983269, 39.790178), (-104.977885, 39.778759), (-104.972500, 39.744500))),
    (28, ((-104.953768, 39.782550), (-104.963134, 39.773038), (-104.972500, 39.744500))),
    (29, ((-104.919769, 39.779617), (-104.899885, 39.775963), (-104.880000, 39.765000))),
    (30, ((-104.874308, 39.781299), (-104.877154, 39.777224), (-104.880000, 39.765000))),
)

# The tracer's three points and its line between the first two (web/typescript/testData.ts),
# each point linked to a dev asset (ops/project/ignition/script-python/mapstudio_dev ASSETS).
TRACER_POINTS = (
    (1, -104.990300, 39.739200, 'P12'),
    (2, -104.975000, 39.750000, 'P14'),
    (3, -104.955000, 39.743000, 'P15'),
)
TRACER_LINE = ((-104.990300, 39.739200), (-104.975000, 39.750000))

# The pad kind setup the dev map seeds (docs/kind-setup.md): the live values the tracer draws.
PAD_SETUP = {
    'comms': {'path': '{asset.path}/Comms', 'on': True},
    'kpis': [
        {'key': 'pressure', 'label': 'Pressure', 'path': '{asset.path}/Pressure', 'unit': 'psi', 'on': True, 'icon': True},
        {'key': 'flow', 'label': 'Flow', 'path': '{asset.path}/Flow', 'unit': 'bbl/d', 'on': True, 'icon': False}],
    'alarms': {'path': '{asset.path}', 'count': True, 'summary': True},
    'link': '/pad/{item.name}',
}


def _logger():
    return system.util.getLogger('MapStudio.seed')


def seed_id(set_name, key):
    """The UUIDv5 of mapstudio-dev/seed/<set>/<key> (uuid.NAMESPACE_URL)."""
    import uuid
    return str(uuid.uuid5(uuid.NAMESPACE_URL, ID_PREFIX + set_name + '/' + key))


def _point(lng, lat):
    return {'type': 'Point', 'coordinates': [lng, lat]}


def _line(coords):
    return {'type': 'LineString', 'coordinates': [[c[0], c[1]] for c in coords]}


def _item(make_id, set_name, key, kind, name, geometry, properties, asset_id=None):
    item = {'key': set_name + '/' + key, 'id': make_id(set_name, key), 'kind': kind, 'name': name,
            'geometry': geometry, 'properties': dict(properties)}
    if asset_id is not None:
        item['assetId'] = asset_id
    return item


def seed_items(make_id=seed_id):
    """The 64 seed items: {key, id, kind, name, geometry, properties}, scale set first."""
    items = []
    for n, lng, lat in SCALE_PADS:
        items.append(_item(make_id, 'scale', 'pad-%d' % n, 'pad', 'Pad %d' % n, _point(lng, lat), PAD_PROPERTIES))
    for n, coords in SCALE_LINES:
        items.append(_item(make_id, 'scale', 'line-%d' % n, 'line', 'Line to Pad %d' % n, _line(coords), {}))
    for n, lng, lat, asset_id in TRACER_POINTS:
        items.append(_item(make_id, 'tracer', 'p%d' % n, 'pad', 'Point %d' % n, _point(lng, lat), PAD_PROPERTIES,
                           asset_id))
    items.append(_item(make_id, 'tracer', 'l1', 'line', 'Tracer line', _line(TRACER_LINE), {}))
    return items


def _data(item):
    data = {'kind': item['kind'], 'name': item['name'], 'geometry': item['geometry'],
            'properties': dict(item['properties'])}
    if 'assetId' in item:
        data['assetId'] = item['assetId']
    return data


def _coords(geometry):
    """Coordinates rounded to 6 decimals (the store's rounding), as nested lists."""
    coords = geometry.get('coordinates') if geometry is not None else None
    if coords is None:
        return None
    if geometry.get('type') == 'Point':
        return [round(float(coords[0]), 6), round(float(coords[1]), 6)]
    return [[round(float(c[0]), 6), round(float(c[1]), 6)] for c in coords]


def _same(stored, item):
    """Whether a stored record equals the seed item on kind, name, geometry and properties."""
    geometry = stored.get('geometry')
    if stored.get('kind') != item['kind'] or stored.get('name') != item['name']:
        return False
    if geometry is None or geometry.get('type') != item['geometry']['type']:
        return False
    if _coords(geometry) != _coords(item['geometry']):
        return False
    if 'assetId' in item and stored.get('assetId') != item['assetId']:
        return False
    return dict(stored.get('properties') or {}) == item['properties']


def _plain(value):
    """A stored JSON value as plain Python (dicts, lists, numbers, text, bools), so setups compare."""
    if isinstance(value, dict):
        return dict([(str(k), _plain(v)) for k, v in value.items()])
    if isinstance(value, (list, tuple)):
        return [_plain(v) for v in value]
    if isinstance(value, bool) or value is None:
        return value
    if isinstance(value, (int, long, float)):
        return value
    if hasattr(value, 'items') and hasattr(value, 'keys'):
        return dict([(str(k), _plain(value[k])) for k in value.keys()])
    if hasattr(value, '__iter__') and not isinstance(value, basestring):
        return [_plain(v) for v in value]
    return unicode(value)


def plan_setup_ops(kind_setups, kind_id, setup):
    """
    Pure: the kind setup op that makes the store hold `setup` for `kind_id`, given the live kind
    setup records (getMap's kindSetups): absent gives a create at 0, present and equal nothing,
    present and different an update at its stored version. Returns a list of 0 or 1 ops.
    """
    for record in kind_setups or []:
        if str(record['kindId']) == kind_id:
            if _plain(record['setup']) == _plain(setup):
                return []
            return [{'op': 'update', 'entity': 'kindSetup', 'id': kind_id, 'baseVersion': int(record['version']),
                     'data': {'setup': setup}}]
    return [{'op': 'create', 'entity': 'kindSetup', 'id': kind_id, 'baseVersion': 0, 'data': {'setup': setup}}]


def plan_ops(current, seed):
    """
    Pure: the ops that make the store hold the seed, given the live records `current`
    (getMap's list, tombstones left out). Absent gives a create at 0, present and equal
    gives nothing, present and different gives an update at its stored version carrying
    the seed fields. Returns {'ops': [...], 'unchanged': n}.
    """
    stored = {}
    for record in current:
        stored[str(record['id']).lower()] = record
    ops = []
    unchanged = 0
    for item in seed:
        record = stored.get(item['id'].lower())
        if record is None:
            ops.append({'op': 'create', 'entity': 'item', 'id': item['id'], 'baseVersion': 0, 'data': _data(item)})
        elif _same(record, item):
            unchanged += 1
        else:
            ops.append({'op': 'update', 'entity': 'item', 'id': item['id'], 'baseVersion': int(record['version']),
                        'data': _data(item)})
    return {'ops': ops, 'unchanged': unchanged}


def _conflict_row(element):
    """
    One conflict as {index, id, deleted, version}. On the Gateway, Ignition hands the Gson
    array to Jython through its JSON adapters, so each element reads like a dict (seen on
    8.3.10); a plain Gson JsonElement (outside the Gateway, as in DevSeedTest) is read with
    its own methods.
    """
    if hasattr(element, 'getAsJsonObject'):
        row = element.getAsJsonObject()
        current = row.get('current')
        current = current.getAsJsonObject() if current is not None and current.isJsonObject() else None
        deleted = current is not None and current.has('deleted') and current.get('deleted').getAsBoolean()
        return {'index': row.get('index').getAsInt(), 'id': row.get('id').getAsString(), 'deleted': deleted,
                'version': current.get('version').getAsInt() if current is not None else None}
    current = element['current']
    return {'index': int(element['index']), 'id': str(element['id']),
            'deleted': current is not None and bool(current['deleted']),
            'version': int(current['version']) if current is not None else None}


def _conflicts(ex):
    """
    The conflicts a `conflict` refusal carries, as [{index, id, deleted, version}]: read
    from the exception's conflicts(), or from its cause's. [] when none.
    """
    found = None
    cause = ex
    for _ in range(4):
        if cause is None:
            break
        if hasattr(cause, 'conflicts'):
            found = cause.conflicts()
            break
        cause = cause.getCause() if hasattr(cause, 'getCause') else None
    if found is None:
        return []
    return [_conflict_row(element) for element in found]


def _message(ex):
    if isinstance(ex, java.lang.Throwable):
        return ex.getMessage()
    return str(ex)


def _new_batch(ops):
    import uuid
    return {'batchId': str(uuid.uuid4()), 'ops': ops}


def _count_scale(records, seed):
    """
    The live records whose ids are the scale set's seed ids, by kind ({pads, lines}): a
    same-named item an editor or a spec made does not count, and a missing seed item does.
    """
    kinds = {}
    for item in seed:
        if item['key'].startswith('scale/'):
            kinds[item['id'].lower()] = item['kind']
    pads = 0
    lines = 0
    for record in records:
        kind = kinds.get(str(record.get('id')).lower())
        if kind is not None and record.get('kind') == kind:
            if kind == 'pad':
                pads += 1
            else:
                lines += 1
    return {'pads': pads, 'lines': lines}


def run(project=PROJECT, actor=ACTOR, api=None, make_id=seed_id, new_batch=_new_batch):
    """
    Seed the project's map. Returns {created, updated, restored, unchanged, seq, ids, scale,
    kindSetup}, plus error (the refusal's text, code first) when nothing was written; scale
    counts the live map items whose ids are the scale set's seed ids, by kind ({pads, lines}),
    read back after the save; kindSetup says what happened to the pad kind setup (created,
    updated, unchanged). `api` is system.mapstudio unless a test passes a stand-in.
    """
    if api is None:
        api = system.mapstudio
    logger = _logger()
    seed = seed_items(make_id)
    result = {'created': 0, 'updated': 0, 'restored': 0, 'unchanged': 0, 'seq': None,
              'ids': dict([(item['key'], item['id']) for item in seed]), 'scale': None}
    try:
        current = api.getMap(project)
    except java.lang.Throwable as ex:
        result['error'] = _message(ex)
        logger.warn('Seed not run: the map could not be read (%s)' % result['error'])
        return result
    except Exception as ex:
        result['error'] = _message(ex)
        logger.warn('Seed not run: the map could not be read (%s)' % result['error'])
        return result

    plan = plan_ops(current, seed)
    ops = plan['ops']
    result['unchanged'] = plan['unchanged']
    # The pad kind setup (epic 3 entry 5), one more op of the same batch.
    setup_ops = plan_setup_ops(getattr(current, 'kindSetups', None), 'pad', PAD_SETUP)
    ops = ops + setup_ops
    result['kindSetup'] = 'created' if setup_ops and setup_ops[0]['op'] == 'create' else (
        'updated' if setup_ops else 'unchanged')
    restored = 0
    if ops:
        answer = None
        for attempt in (1, 2):
            try:
                answer = api.applyEdits(project, new_batch(ops), actor)
                break
            except java.lang.Throwable as ex:
                conflicts = _conflicts(ex)
                tombstones = [c for c in conflicts if c['deleted'] and ops[c['index']]['op'] == 'create']
                if attempt == 1 and conflicts and len(tombstones) == len(conflicts):
                    # Deleted seed items: send the batch again with each as a restore at its tombstone's version.
                    ops = list(ops)
                    for c in tombstones:
                        ops[c['index']] = dict(ops[c['index']], baseVersion=c['version'])
                    restored = len(tombstones)
                    continue
                result['error'] = _message(ex)
            except Exception as ex:
                result['error'] = _message(ex)
            logger.warn('Seed not saved, nothing written: %s' % result['error'])
            return result
        result['seq'] = answer['seq']
        item_ops = [op for op in ops if op['entity'] == 'item']
        creates = len([op for op in item_ops if op['op'] == 'create'])
        result['created'] = creates - restored
        result['restored'] = restored
        result['updated'] = len(item_ops) - creates
    try:
        result['scale'] = _count_scale(api.getMap(project), seed)
    except java.lang.Throwable as ex:
        logger.warn('Seed saved, but the map could not be read back: %s' % _message(ex))
    except Exception as ex:
        logger.warn('Seed saved, but the map could not be read back: %s' % _message(ex))
    logger.info('Seed of %s: %d created, %d updated, %d restored, %d unchanged, seq %s'
                % (project, result['created'], result['updated'], result['restored'], result['unchanged'],
                   result['seq']))
    return result
