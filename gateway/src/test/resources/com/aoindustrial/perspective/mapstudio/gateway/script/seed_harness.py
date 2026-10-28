# Test harness for ops/project/ignition/script-python/mapstudio_seed/code.py (DevSeedTest).
# Jython 2.7 without the standard library (the SDK's jar ships no Lib/), so the seed is run
# with stand-ins: a `system` with a quiet logger, ids made from the seed keys, numbered
# batch ids, and FakeApi, a map store that keeps tombstones and answers like the write
# service: a stale or tombstoned op is refused with MapStudioException('conflict', ...)
# carrying the conflicts as a Gson JsonArray, and nothing in the batch is written.

import java.lang
from com.aoindustrial.perspective.mapstudio.common.contract import MapStudioException
from com.inductiveautomation.ignition.common.gson import JsonArray, JsonObject


class _Log(object):
    def info(self, text):
        pass

    def warn(self, text):
        pass


class _Util(object):
    def getLogger(self, name):
        return _Log()


class _System(object):
    util = _Util()


system = _System()


def make_id(set_name, key):
    return set_name + '/' + key


class _Batches(object):
    def __init__(self):
        self.n = 0

    def __call__(self, ops):
        self.n += 1
        return {'batchId': 'batch-%d' % self.n, 'ops': ops}


class _MapList(list):
    """getMap's list with its kindSetups attribute (the live kind setup records), as MapList gives it."""

    def __init__(self, items, kind_setups):
        list.__init__(self, items)
        self.kindSetups = kind_setups


class FakeApi(object):
    def __init__(self):
        self.records = {}
        self.kind_setups = {}
        self.seq = 0
        self.batches = []
        self.kinds_down = False
        self.after_get = None

    def getMap(self, project):
        live = _MapList([dict(r) for r in self.records.values() if not r['deleted']],
                        [dict(r) for r in self.kind_setups.values() if not r['deleted']])
        if self.after_get is not None:
            hook = self.after_get
            self.after_get = None
            hook(self)
        return live

    def applyEdits(self, project, batch, actor):
        self.batches.append(batch)
        if self.kinds_down:
            raise MapStudioException('invalid', 'The kind list is not available (the kind function failed).')
        conflicts = JsonArray()
        for i, op in enumerate(batch['ops']):
            if op['entity'] != 'item':
                continue
            r = self.records.get(op['id'])
            if op['op'] == 'create':
                ok = (r is None and op['baseVersion'] == 0) or (
                    r is not None and r['deleted'] and op['baseVersion'] == r['version'])
            else:
                ok = r is not None and not r['deleted'] and op['baseVersion'] == r['version']
            if ok:
                continue
            if r is None:
                raise MapStudioException('invalid', 'never saved')
            c = JsonObject()
            c.addProperty('index', java.lang.Integer(i))
            c.addProperty('entity', 'item')
            c.addProperty('id', op['id'])
            c.addProperty('baseVersion', java.lang.Integer(op['baseVersion']))
            current = JsonObject()
            current.addProperty('version', java.lang.Integer(r['version']))
            current.addProperty('deleted', java.lang.Boolean(r['deleted']))
            c.add('current', current)
            conflicts.add(c)
        if conflicts.size() > 0:
            raise MapStudioException('conflict', '%d map items were changed by others.' % conflicts.size(),
                                     java.lang.Integer(0), batch['ops'][0]['id'], conflicts)
        results = []
        for op in batch['ops']:
            if op['entity'] == 'kindSetup':
                k = self.kind_setups.get(op['id'])
                if (k is None) != (op['op'] == 'create') or (k is not None and k['version'] != op['baseVersion']):
                    raise MapStudioException('conflict', 'The %s kind setup was changed.' % op['id'])
                record = {'kindId': op['id'], 'setup': op['data']['setup'], 'version': (k['version'] if k else 0) + 1,
                          'deleted': False}
                self.kind_setups[op['id']] = record
                results.append({'entity': 'kindSetup', 'id': op['id'], 'version': record['version']})
                continue
            r = self.records.get(op['id'])
            record = dict(r) if (r is not None and op['op'] == 'update') else {}
            record.update(op['data'])
            record.update({'id': op['id'], 'version': (r['version'] if r else 0) + 1, 'deleted': False})
            self.records[op['id']] = record
            results.append({'entity': 'item', 'id': op['id'], 'version': record['version']})
        self.seq += 1
        return {'batchId': batch['batchId'], 'seq': self.seq, 'results': results}


def seeded():
    api = FakeApi()
    first = run(api=api, make_id=make_id, new_batch=_Batches())
    return api, first


def check(condition, text):
    if not condition:
        raise AssertionError(text)


def row_first_run():
    api, r = seeded()
    check('error' not in r, 'error %s' % r.get('error'))
    check((r['created'], r['updated'], r['restored'], r['unchanged'], r['seq']) == (68, 0, 0, 0, 1), str(r))
    check(len(api.batches) == 1 and len(api.batches[0]['ops']) == 71, 'one batch of 68 item ops and the three kind setups')
    check(all([op['op'] == 'create' and op['baseVersion'] == 0 for op in api.batches[0]['ops']]), 'creates at 0')
    check(api.batches[0]['ops'][68] == {'op': 'create', 'entity': 'kindSetup', 'id': 'pad', 'baseVersion': 0,
                                        'data': {'setup': PAD_SETUP}}, 'the kind setup ops are last')
    check(api.batches[0]['ops'][69]['id'] == 'line' and api.batches[0]['ops'][70]['id'] == 'geofence', 'the line and geofence setups')
    check(r['kindSetup'] == 'created' and api.kind_setups['pad']['setup'] == PAD_SETUP, 'the pad kind setup is seeded')
    check(r['kindSetups'] == {'pad': 'created', 'line': 'created', 'geofence': 'created'}, str(r['kindSetups']))
    check(api.kind_setups['line']['setup'] == LINE_SETUP and api.kind_setups['geofence']['setup'] == GEOFENCE_SETUP,
          'the line and geofence setups are seeded')
    # Entry 1: the tracer line is linked to L3 for its Bands rule, Point 2 carries the override expression
    # rule, and the two geofences carry their operator category.
    check(api.records['tracer/l1']['assetId'] == 'L3', 'the tracer line is linked to L3')
    check(api.records['tracer/p2']['overrides'] == P2_OVERRIDES and 'overrides' not in api.records['tracer/p1'],
          'the override rule on Point 2 only')
    check(api.records['areas/north']['kind'] == 'geofence' and api.records['areas/north']['properties'] == {'operator': 'North'}
          and api.records['areas/south']['properties'] == {'operator': 'South'}, 'the geofences')
    check(len(api.records['areas/north']['geometry']['coordinates']) == 4, 'a closed ring of four corners')
    # The tracer's points are linked to the dev assets; the scale set's pads are not.
    check(api.records['tracer/p1']['assetId'] == 'P12' and api.records['tracer/p3']['assetId'] == 'P15', 'asset links')
    check('assetId' not in api.records['scale/pad-7'], 'the scale set stays unlinked')
    check(r['scale'] == {'pads': 30, 'lines': 30}, 'scale %s' % r['scale'])
    check(r['ids']['tracer/p1'] == 'tracer/p1' and len(r['ids']) == 68, 'ids')
    check(api.records['shared/a']['name'] == 'Shared A' and api.records['shared/b']['kind'] == 'pad', 'the shared pair')
    pad = api.records['scale/pad-7']
    check(pad['kind'] == 'pad' and pad['name'] == 'Pad 7' and pad['properties'] == {'status': 'producing'}, str(pad))
    check(api.records['tracer/l1']['geometry']['type'] == 'LineString', 'tracer line')
    return 'ok'


def row_rerun_unchanged():
    api, first = seeded()
    r = run(api=api, make_id=make_id, new_batch=_Batches())
    check((r['unchanged'], r['seq'], r['created'], r['updated']) == (68, None, 0, 0), str(r))
    check(len(api.batches) == 1, 'no batch sent')
    check(r['kindSetup'] == 'unchanged', 'the kind setup compares equal: %s' % r['kindSetup'])
    check(r['kindSetups'] == {'pad': 'unchanged', 'line': 'unchanged', 'geofence': 'unchanged'}, str(r['kindSetups']))
    # An editor's change to the pad kind setup is put back at its stored version; a tracer point
    # linked elsewhere is relinked.
    api.kind_setups['pad'] = {'kindId': 'pad', 'setup': {'link': '/x'}, 'version': 5, 'deleted': False}
    api.records['tracer/p2'].update({'assetId': 'P99', 'version': 3})
    again = run(api=api, make_id=make_id, new_batch=_Batches())
    ops = api.batches[-1]['ops']
    check(len(ops) == 2 and ops[0]['id'] == 'tracer/p2' and ops[0]['data']['assetId'] == 'P14', str(ops))
    check(ops[1] == {'op': 'update', 'entity': 'kindSetup', 'id': 'pad', 'baseVersion': 5, 'data': {'setup': PAD_SETUP}},
          str(ops[1]))
    check(again['kindSetup'] == 'updated' and again['updated'] == 1 and again['unchanged'] == 67, str(again))
    # An editor's change to an override is put back too.
    api.records['tracer/p2'].update({'overrides': {}, 'version': 5})
    third = run(api=api, make_id=make_id, new_batch=_Batches())
    check(third['updated'] == 1 and api.records['tracer/p2']['overrides'] == P2_OVERRIDES, str(third))
    check(r['scale'] == {'pads': 30, 'lines': 30}, 'scale %s' % r['scale'])
    return 'ok'


def row_rerun_edited():
    api, first = seeded()
    pad = api.records['scale/pad-7']
    pad.update({'name': 'Renamed by an editor', 'version': 3, 'properties': {'status': 'shut in', 'wells': 4}})
    r = run(api=api, make_id=make_id, new_batch=_Batches())
    ops = api.batches[-1]['ops']
    check(len(ops) == 1 and ops[0]['op'] == 'update' and ops[0]['baseVersion'] == 3, str(ops))
    check(sorted(ops[0]['data'].keys()) == ['geometry', 'kind', 'name', 'properties'], str(ops[0]['data']))
    check((r['updated'], r['unchanged'], r['created'], r['seq']) == (1, 67, 0, 2), str(r))
    pad = api.records['scale/pad-7']
    check(pad['name'] == 'Pad 7' and pad['properties'] == {'status': 'producing'} and pad['version'] == 4, str(pad))
    return 'ok'


def row_rerun_deleted():
    api, first = seeded()
    api.records['scale/pad-7'].update({'deleted': True, 'version': 4})
    r = run(api=api, make_id=make_id, new_batch=_Batches())
    check(len(api.batches) == 3, 'refused create, then the restore: %d batches' % len(api.batches))
    refused = api.batches[1]['ops'][0]
    restore = api.batches[2]['ops'][0]
    check(refused['op'] == 'create' and refused['baseVersion'] == 0, str(refused))
    check(restore['op'] == 'create' and restore['baseVersion'] == 4 and restore['id'] == 'scale/pad-7', str(restore))
    check(api.batches[1]['batchId'] != api.batches[2]['batchId'], 'a new batchId for the restore')
    check((r['restored'], r['created'], r['updated'], r['unchanged'], r['seq']) == (1, 0, 0, 67, 2), str(r))
    pad = api.records['scale/pad-7']
    check(not pad['deleted'] and pad['version'] == 5 and pad['name'] == 'Pad 7', str(pad))
    check(r['scale'] == {'pads': 30, 'lines': 30}, 'scale %s' % r['scale'])
    return 'ok'


def row_concurrent_edit():
    api, first = seeded()
    api.records['scale/pad-7'].update({'name': 'Renamed', 'version': 2})

    def edit_in_between(fake):
        fake.records['scale/pad-7'].update({'name': 'Renamed again', 'version': 3})

    api.after_get = edit_in_between
    r = run(api=api, make_id=make_id, new_batch=_Batches())
    check(r.get('error', '').startswith('conflict: '), 'error %s' % r.get('error'))
    check(len(api.batches) == 2, 'reported, not retried: %d batches' % len(api.batches))
    check(api.records['scale/pad-7']['name'] == 'Renamed again' and api.seq == 1, 'nothing written')
    check(r['seq'] is None and r['updated'] == 0, str(r))
    again = run(api=api, make_id=make_id, new_batch=_Batches())
    check('error' not in again and again['updated'] == 1, 'the next run succeeds: %s' % again)
    return 'ok'


def row_kind_list_down():
    api = FakeApi()
    api.kinds_down = True
    r = run(api=api, make_id=make_id, new_batch=_Batches())
    check(r.get('error', '').startswith('invalid: The kind list is not available'), 'error %s' % r.get('error'))
    check(api.records == {} and api.seq == 0, 'nothing written')
    return 'ok'


def plan_is_pure():
    seed = seed_items(make_id)
    plan = plan_ops([], seed)
    check(len(plan['ops']) == 68 and plan['unchanged'] == 0, 'all creates')
    stored = [dict(op['data'], id=op['id'].upper(), version=1, deleted=False) for op in plan['ops']]
    # Letter case of ids does not matter (the Gateway answers lower case), and coordinates compare at 6 decimals.
    stored[0]['geometry'] = {'type': 'Point', 'coordinates': [stored[0]['geometry']['coordinates'][0] + 0.0000001,
                                                             stored[0]['geometry']['coordinates'][1]]}
    again = plan_ops(stored, [dict(i, id=i['id'].upper()) for i in seed])
    check(again['ops'] == [] and again['unchanged'] == 68, str(again['ops'][:1]))
    names = [i['name'] for i in seed]
    check(names.count('Pad 1') == 1 and 'Line to Pad 30' in names and 'Tracer line' in names, 'names')
    check(len([i for i in seed if i['kind'] == 'pad']) == 35 and len([i for i in seed if i['kind'] == 'line']) == 31
          and len([i for i in seed if i['kind'] == 'geofence']) == 2, 'kinds')
    return 'ok'


class _AdaptedRefusal(object):
    """A refusal as the Gateway's Jython sees it: conflicts() iterates as dicts (Ignition's JSON adapters)."""

    def conflicts(self):
        return [{'index': 2, 'entity': 'item', 'id': 'scale/pad-3', 'baseVersion': 0,
                 'current': {'id': 'scale/pad-3', 'version': 6, 'deleted': True}, 'changedBy': 'x', 'changedAt': None}]


def conflicts_read_as_dicts():
    rows = _conflicts(_AdaptedRefusal())
    check(rows == [{'index': 2, 'id': 'scale/pad-3', 'deleted': True, 'version': 6}], str(rows))
    return 'ok'


def scale_counts_seed_ids():
    """scale counts the scale set's seed ids, not names: a same-named stray does not count, a renamed seed pad does."""
    api, first = seeded()
    api.records['stray'] = {'id': 'stray', 'kind': 'pad', 'name': 'Pad 7', 'geometry': None, 'properties': {},
                            'version': 1, 'deleted': False}
    api.records['scale/line-3']['name'] = 'Renamed by an editor'
    check(_count_scale(api.getMap('p'), seed_items(make_id)) == {'pads': 30, 'lines': 30}, 'by id')
    api.records['scale/pad-9']['deleted'] = True
    check(_count_scale(api.getMap('p'), seed_items(make_id)) == {'pads': 29, 'lines': 30}, 'a deleted one is missing')
    return 'ok'
