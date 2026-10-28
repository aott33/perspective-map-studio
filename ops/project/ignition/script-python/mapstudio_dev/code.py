# Dev kind and asset adapter for the mapstudio-dev project (epic 2 story 3; the L-SWD set, epic 3 entry 2).
# Jython 2.7 (the Gateway's). Test equipment for the dev Gateway only: the
# setup names mapstudio_dev.kinds and mapstudio_dev.assets, and the /adapters
# page switches the mode to show each status Map Studio reports.
#
# Modes: ok (good lists), empty (no rows), broken (raises), slow (sleeps 8 s,
# past Map Studio's 5 s timeout), incomplete (some bad rows), unknown-icon (the
# pad kind names an icon Map Studio does not have, story 2.10; assets as ok).
#
# The mode is kept in system.util.getGlobals(), shared by the Gateway's scripts,
# so a Perspective session script's set_mode reaches the calls Map Studio makes
# through the project's script manager. It starts as ok after a Gateway restart.

import java.lang
import time

MODES = ('ok', 'empty', 'broken', 'slow', 'incomplete', 'unknown-icon')
MODE_KEY = 'mapstudio_dev.adapter_mode'
CALLS_KEY = 'mapstudio_dev.adapter_calls'
SLOW_SECONDS = 8
# Not in Map Studio's icon set (docs/icons.md): mode unknown-icon gives it to the pad kind.
UNKNOWN_ICON = 'wel-pad'

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
    {'id': 'geofence', 'name': 'Geofence', 'geometry': 'line', 'icon': 'geofence', 'labelRank': 0, 'area': True,
     'fields': [{'key': 'operator', 'label': 'Operator', 'type': 'text', 'required': False}]},
    # An instrument kind (epic 2 story 14): its map items may be attached to a line.
    {'id': 'tap', 'name': 'Tap', 'geometry': 'point', 'icon': 'tap', 'labelRank': 2, 'instrument': True,
     'fields': [{'key': 'tag', 'label': 'Tag', 'type': 'text', 'required': False}]},
    # A second instrument kind (epic 3 entry 2): a line valve sits on a line but, with no icon KPI in
    # its setup, bounds no line segment.
    {'id': 'valve', 'name': 'Line valve', 'geometry': 'point', 'icon': 'line-valve', 'labelRank': 1, 'instrument': True,
     'fields': [{'key': 'tag', 'label': 'Tag', 'type': 'text', 'required': False}]},
]

ASSETS = [
    {'id': 'P12', 'name': 'Pad 12', 'kind': 'pad', 'basePath': '[default]Mesa/P12'},
    {'id': 'P14', 'name': 'Pad 14', 'kind': 'pad', 'basePath': '[default]Mesa/P14'},
    {'id': 'P15', 'name': 'Pad 15', 'kind': 'pad', 'basePath': '[default]Mesa/P15'},
    {'id': 'L3', 'name': 'Line 3', 'kind': 'line', 'basePath': '[default]Mesa/Lines/L3'},
    # The L-SWD set (epic 3 entry 2): the two pads its ends snap to, its taps and line valve, and the
    # line itself (ops/config/core: the Pad, Tap and Valve UDT instances and Lines/LSWD).
    {'id': 'CTB1', 'name': 'CTB 1', 'kind': 'pad', 'basePath': '[default]Mesa/CTB1'},
    {'id': 'SWD1', 'name': 'SWD 1', 'kind': 'pad', 'basePath': '[default]Mesa/SWD1'},
    {'id': 'PT1', 'name': 'PT-1', 'kind': 'tap', 'basePath': '[default]Mesa/PT1'},
    {'id': 'PT2', 'name': 'PT-2', 'kind': 'tap', 'basePath': '[default]Mesa/PT2'},
    {'id': 'LV1', 'name': 'LV-1', 'kind': 'valve', 'basePath': '[default]Mesa/LV1'},
    {'id': 'LSWD', 'name': 'L-SWD', 'kind': 'line', 'basePath': '[default]Mesa/Lines/LSWD'},
]


def _globals(action):
    """system.util.getGlobals(); a failure is logged by class name and re-raised."""
    try:
        return system.util.getGlobals()
    except java.lang.Throwable as ex:
        logger.warn('Could not %s: %s' % (action, ex.getClass().getSimpleName()))
        raise
    except Exception as ex:
        logger.warn('Could not %s: %s' % (action, type(ex).__name__))
        raise


def holdsMapEditor(session):
    """True when the Perspective session is signed in and its user holds MapEditor.

    The dev views' buttons write to the map store or change test equipment for every
    session, and the scripting API trusts its caller (docs/contract.md), so each view
    script checks the role itself through this one function (epic 2 story 12). The
    session's auth props are set by the Gateway from its identity provider. Any failure
    to read them counts as not holding the role.
    """
    try:
        if not session.props.auth.authenticated:
            return False
        roles = [str(r) for r in (session.props.auth.user.roles or [])]
    except java.lang.Throwable as ex:
        logger.debug('Dev role check could not read the session roles: %s' % ex.getClass().getSimpleName())
        return False
    except Exception as ex:
        logger.debug('Dev role check could not read the session roles: %s' % type(ex).__name__)
        return False
    return 'MapEditor' in roles


def mode():
    """The current mode; ok when none was set or the stored one is unknown. Re-raises a failed read."""
    value = _globals('read the dev adapter mode').get(MODE_KEY)
    if value in MODES:
        return str(value)
    return 'ok'


def set_mode(new_mode):
    """Switch the mode (one of MODES) and zero the call counts; returns the mode now in force."""
    if new_mode not in MODES:
        raise ValueError('Unknown dev adapter mode %s; expected one of %s' % (new_mode, ', '.join(MODES)))
    store = _globals('set the dev adapter mode')
    store[MODE_KEY] = new_mode
    store[CALLS_KEY + '.kinds'] = 0
    store[CALLS_KEY + '.assets'] = 0
    logger.info('Dev adapter mode set to %s' % new_mode)
    return new_mode


def calls():
    """How many times Map Studio called kinds() and assets() since the last set_mode."""
    store = _globals('read the dev adapter call counts')
    return {'kinds': store.get(CALLS_KEY + '.kinds', 0), 'assets': store.get(CALLS_KEY + '.assets', 0)}


def _count(what):
    # One key per function: Map Studio runs at most one call per function at a time.
    store = _globals('count a dev adapter call')
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
    if current == 'unknown-icon' and what == 'kinds':
        rows = [dict(row) for row in good]
        rows[0]['icon'] = UNKNOWN_ICON
        return rows
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
