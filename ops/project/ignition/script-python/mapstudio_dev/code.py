# Dev kind and asset adapter for the mapstudio-dev project (epic 2 story 3).
# Jython 2.7 (the Gateway's). Test equipment for the dev Gateway only: the
# setup names mapstudio_dev.kinds and mapstudio_dev.assets, and the /adapters
# page switches the mode to show each status Map Studio reports.
#
# Modes: ok (good lists), empty (no rows), broken (raises), slow (sleeps 8 s,
# past Map Studio's 5 s timeout), incomplete (some bad rows).
#
# The mode is kept in system.util.getGlobals(), shared by the Gateway's scripts,
# so a Perspective session script's set_mode reaches the calls Map Studio makes
# through the project's script manager. It starts as ok after a Gateway restart.

import java.lang
import time

MODES = ('ok', 'empty', 'broken', 'slow', 'incomplete')
MODE_KEY = 'mapstudio_dev.adapter_mode'
CALLS_KEY = 'mapstudio_dev.adapter_calls'
SLOW_SECONDS = 8

logger = system.util.getLogger('MapStudio.devadapter')

KINDS = [
    {'id': 'pad', 'name': 'Well pad', 'geometry': 'point', 'icon': 'well-pad', 'labelRank': 10,
     'fields': [
         {'key': 'operator', 'label': 'Operator', 'type': 'text', 'required': False},
         {'key': 'wells', 'label': 'Wells', 'type': 'integer', 'required': False},
         {'key': 'status', 'label': 'Status', 'type': 'choice', 'required': True,
          'choices': ['producing', 'shut in', 'abandoned']}]},
    {'id': 'line', 'name': 'Gathering line', 'geometry': 'line', 'icon': 'pipeline', 'labelRank': 5,
     'fields': [
         {'key': 'diameter', 'label': 'Diameter (in)', 'type': 'number', 'required': False},
         {'key': 'buried', 'label': 'Buried', 'type': 'boolean', 'required': False}]},
    {'id': 'geofence', 'name': 'Geofence', 'geometry': 'line', 'icon': 'fence', 'labelRank': 0, 'fields': []},
]

ASSETS = [
    {'id': 'P12', 'name': 'Pad 12', 'kind': 'pad', 'basePath': '[default]Mesa/P12'},
    {'id': 'P14', 'name': 'Pad 14', 'kind': 'pad', 'basePath': '[default]Mesa/P14'},
    {'id': 'P15', 'name': 'Pad 15', 'kind': 'pad', 'basePath': '[default]Mesa/P15'},
    {'id': 'L3', 'name': 'Line 3', 'kind': 'line', 'basePath': '[default]Mesa/Lines/L3'},
]


def mode():
    """The current mode; ok when none was set or the stored one is unknown."""
    try:
        value = system.util.getGlobals().get(MODE_KEY)
    except java.lang.Throwable as ex:
        logger.warn('Could not read the dev adapter mode: %s' % ex.getClass().getSimpleName())
        return 'ok'
    except Exception as ex:
        logger.warn('Could not read the dev adapter mode: %s' % type(ex).__name__)
        return 'ok'
    if value in MODES:
        return str(value)
    return 'ok'


def set_mode(new_mode):
    """Switch the mode (one of MODES) and zero the call counts; returns the mode now in force."""
    if new_mode not in MODES:
        raise ValueError('Unknown dev adapter mode %s; expected one of %s' % (new_mode, ', '.join(MODES)))
    store = system.util.getGlobals()
    store[MODE_KEY] = new_mode
    store[CALLS_KEY + '.kinds'] = 0
    store[CALLS_KEY + '.assets'] = 0
    logger.info('Dev adapter mode set to %s' % new_mode)
    return new_mode


def calls():
    """How many times Map Studio called kinds() and assets() since the last set_mode."""
    store = system.util.getGlobals()
    return {'kinds': store.get(CALLS_KEY + '.kinds', 0), 'assets': store.get(CALLS_KEY + '.assets', 0)}


def _count(what):
    # One key per function: Map Studio runs at most one call per function at a time.
    store = system.util.getGlobals()
    key = CALLS_KEY + '.' + what
    store[key] = store.get(key, 0) + 1


def _rows(what, good, incomplete):
    _count(what)
    current = mode()
    if current == 'empty':
        return []
    if current == 'broken':
        raise RuntimeError('The dev adapter is in mode broken (%s)' % what)
    if current == 'slow':
        logger.info('Dev adapter %s() called in mode slow; answering in %d s' % (what, SLOW_SECONDS))
        time.sleep(SLOW_SECONDS)
        return [dict(row) for row in good]
    if current == 'incomplete':
        return [dict(row) for row in good] + incomplete
    return [dict(row) for row in good]


def kinds():
    """The dev kind list (docs/kinds-and-assets.md)."""
    return _rows('kinds', KINDS, [
        {'id': 'tank', 'name': 'Tank', 'geometry': 'polygon'},
        {'id': 'pad', 'name': 'Second pad', 'geometry': 'point'},
    ])


def assets():
    """The dev asset list (docs/kinds-and-assets.md)."""
    return _rows('assets', ASSETS, [
        {'id': 'P99', 'name': 'Pad 99', 'kind': 'pad', 'basePath': 'Mesa/P99'},
        {'id': 'T1', 'name': 'Tank 1', 'kind': 'tank', 'basePath': '[default]Mesa/T1'},
    ])
