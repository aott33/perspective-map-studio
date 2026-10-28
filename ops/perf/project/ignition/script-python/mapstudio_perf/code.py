# Kind and asset adapter of the mapstudio-perf project (epic 2 story 17). Jython 2.7 (the
# Gateway's). Test equipment for the performance check only: ops/perf.sh adds this project to a
# Gateway for one run and removes it after.
#
# kinds() answers the dev project's kinds (pad, line, geofence, tap), so the perf items are checked
# against the same list; assets() answers 300 deterministic pad assets (Perf 001 .. Perf 300), the
# list size of a 300-pad field. timeRefresh(session) times one system.mapstudio.refreshAdapters
# call for the /edit page's "Time a list refresh" button.

import java.lang

PROJECT = 'mapstudio-perf'
ASSET_COUNT = 300

logger = system.util.getLogger('MapStudio.perf')

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
    {'id': 'tap', 'name': 'Tap', 'geometry': 'point', 'icon': 'tap', 'labelRank': 2, 'instrument': True,
     'fields': [{'key': 'tag', 'label': 'Tag', 'type': 'text', 'required': False}]},
]

ASSETS = [{'id': 'PERF%03d' % n, 'name': 'Perf %03d' % n, 'kind': 'pad', 'basePath': '[default]Perf/P%03d' % n}
          for n in range(1, ASSET_COUNT + 1)]


def kinds():
    """The perf kind list: the dev project's kinds (docs/kinds-and-assets.md)."""
    return [dict(row) for row in KINDS]


def assets():
    """The perf asset list: 300 pads."""
    return [dict(row) for row in ASSETS]


def holdsMapEditor(session):
    """True when the Perspective session is signed in and its user holds MapEditor (as mapstudio_dev)."""
    try:
        if not session.props.auth.authenticated:
            return False
        roles = [str(r) for r in (session.props.auth.user.roles or [])]
    except java.lang.Throwable as ex:
        logger.debug('Perf role check could not read the session roles: %s' % ex.getClass().getSimpleName())
        return False
    except Exception as ex:
        logger.debug('Perf role check could not read the session roles: %s' % type(ex).__name__)
        return False
    return 'MapEditor' in roles


def timeRefresh(session):
    """{ms, kinds, assets} for one refreshAdapters call on this project, or {refused} without MapEditor.

    ms is the Gateway's own wall time around the call (System.nanoTime), so the browser's round trip
    is not in it. A refusal raised by the call is left to the caller, which records its class name.
    """
    if not holdsMapEditor(session):
        return {'refused': 'Timing a list refresh needs the MapEditor role. Sign in as a map editor first.'}
    t0 = java.lang.System.nanoTime()
    result = system.mapstudio.refreshAdapters(PROJECT)
    ms = (java.lang.System.nanoTime() - t0) / 1000000.0
    return {'ms': ms, 'kinds': result['kinds'], 'assets': result['assets']}
