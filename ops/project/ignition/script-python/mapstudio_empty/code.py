# Dev only (epic 4 entry 7b): the empty project's kind setup, for the first-run checklist's step 1.
# Jython 2.7 (the Gateway's). The dev Gateway mounts ops/project a second time as the project
# mapstudio-empty (ops/docker-compose.yml): the same views, setup and kind list, and its own map,
# which the e2e suite keeps empty (e2e/tests/firstrun.spec.mjs). Its /empty page's buttons call
# save_kind_setup and delete_kind_setup, which write one kind setup of mapstudio-empty (whichever
# project's page pressed them) through system.mapstudio.applyEdits, so the map.changed of a
# script's save reaches the open map and ticks step 1 live. Never the dev map's own kind setups.

import java.lang
import uuid

PROJECT = 'mapstudio-empty'
ACTOR = 'firstrun-script'
KIND_ID = 'geofence'
# The geofence kind's setup as the dev seed has it (mapstudio_seed.GEOFENCE_SETUP): tints by operator.
SETUP = {
    'areaTints': {'property': 'operator', 'tints': [
        {'category': 'North', 'tint': 'tint-1'}, {'category': 'South', 'tint': 'tint-4'}]},
}

logger = system.util.getLogger('MapStudio.empty')


def _held(api):
    """The live kind setup record of KIND_ID on the empty map (a dict), or None."""
    for record in (getattr(api.getMap(PROJECT), 'kindSetups', None) or []):
        if record.get('kindId') == KIND_ID and not record.get('deleted'):
            return record
    return None


def _message(ex):
    if isinstance(ex, java.lang.Throwable):
        return ex.getMessage()
    return str(ex)


def _apply(api, ops):
    batch = {'batchId': str(uuid.uuid4()), 'ops': ops}
    answer = api.applyEdits(PROJECT, batch, ACTOR)
    return {'seq': answer['seq']}


def save_kind_setup(api=None):
    """Save the geofence kind setup on the empty map: a create, or an update when one is held.

    Returns {saved: 'created' | 'updated', seq} or {error}."""
    if api is None:
        api = system.mapstudio
    try:
        held = _held(api)
        if held is None:
            op = {'op': 'create', 'entity': 'kindSetup', 'id': KIND_ID, 'baseVersion': 0, 'data': {'setup': SETUP}}
        else:
            op = {'op': 'update', 'entity': 'kindSetup', 'id': KIND_ID, 'baseVersion': int(held['version']),
                  'data': {'setup': SETUP}}
        try:
            result = _apply(api, [op])
        except java.lang.Throwable as ex:
            # A kind setup deleted before (a tombstone): the create again at the tombstone's version, as the dev
            # seed restores (mapstudio_seed._conflicts).
            tombstones = [c for c in mapstudio_seed._conflicts(ex) if c['deleted']]
            if op['op'] != 'create' or not tombstones:
                raise
            op = dict(op, baseVersion=tombstones[0]['version'])
            result = _apply(api, [op])
        result['saved'] = op['op'] + 'd'
        logger.info('Empty map: the %s kind setup %s as seq %s' % (KIND_ID, result['saved'], result['seq']))
        return result
    except java.lang.Throwable as ex:
        logger.warn('Empty map: the kind setup was not saved: %s' % _message(ex))
        return {'error': _message(ex)}
    except Exception as ex:
        logger.warn('Empty map: the kind setup was not saved: %s' % _message(ex))
        return {'error': _message(ex)}


def delete_kind_setup(api=None):
    """Delete the geofence kind setup of the empty map. Returns {deleted: true, seq}, {deleted: false} or {error}."""
    if api is None:
        api = system.mapstudio
    try:
        held = _held(api)
        if held is None:
            return {'deleted': False}
        result = _apply(api, [{'op': 'delete', 'entity': 'kindSetup', 'id': KIND_ID, 'baseVersion': int(held['version'])}])
        result['deleted'] = True
        logger.info('Empty map: the %s kind setup deleted as seq %s' % (KIND_ID, result['seq']))
        return result
    except java.lang.Throwable as ex:
        logger.warn('Empty map: the kind setup was not deleted: %s' % _message(ex))
        return {'error': _message(ex)}
    except Exception as ex:
        logger.warn('Empty map: the kind setup was not deleted: %s' % _message(ex))
        return {'error': _message(ex)}
