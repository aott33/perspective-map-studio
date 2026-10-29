# The showcase seed (epic 3 entry 15). Jython 2.7 (the Gateway's). Test equipment for the dev
# Gateway only: the dev project's /edit page ("Seed the showcase map") calls run(), and the e2e
# suite presses it before the showcase renders (e2e/tests/showcase.spec.mjs).
#
# It writes the mapstudio-showcase project's map (ops/showcase/project: the Map Studio component
# alone, no test controls) through mapstudio_seed.run, the same seed path as the dev map (one batch
# through system.mapstudio.applyEdits under the actor seed-script, unchanged items left alone, edited
# ones put back, deleted ones restored; safe to re-run), with the UX mockups' Mesa-like demo field
# (_bmad-output/initiative-flowmap/ux-map-studio/mockups, key-screen-1, -2, -3 and view-mode-*):
#   P14 well pad in a priority 1 unacknowledged alarm "Casing pressure high - P14-2H" (1,240 psi casing,
#   410 psi tubing, 1.8 MMcf/d), P21 well pad comms lost, P12 well pad normal, CTB1 tank battery, CS01
#   compressor station, SWD1 SWD stale (its injection rate at Bad quality, comms fine), the pipeline
#   L-SWD from CTB1 to SWD1 with the taps PT-1 (398 psi) and PT-2 (371 psi) and the line valve LV-1 on
#   it, the pipeline L-GL21 from P21 to CS01, the P14 and P12 laterals, and the Mesa lease geofence.
# The places are the mockups' pixel places at zoom 15 round the showcase page's starting area
# (-104.93, 39.70; web Mercator, 512 px tiles), so the showcase renders frame as the mockups do; the
# distances along L-SWD follow that geometry (about 0.45 km), not the mockups' words (2.9 km).
#
# The kind ids and asset ids are the showcase project's adapter's (ops/showcase/project,
# mapstudio_showcase); the tags are the dev tag provider's Showcase folder (ops/config/core). The seed
# also puts the demo tags back in the mockups' states (the alarm raised afresh, P21's comms off, SWD1's
# injection rate stale), the only tag writes, all below SHOWCASE_PREFIX; a Gateway restart keeps the
# memory tags' values but not the stale quality, so re-run the seed after one.

import java.lang

import mapstudio_seed

PROJECT = 'mapstudio-showcase'
ACTOR = 'seed-script'
ID_PREFIX = 'mapstudio-showcase/seed/'
SHOWCASE_PREFIX = '[default]Showcase/'

# (key, kind, name, asset, longitude, latitude, properties).
SITES = (
    ('p14', 'well-pad', 'P14', 'P14', -104.932682, 39.697524, {'status': 'producing', 'wells': 'P14-2H'}),
    ('p12', 'well-pad', 'P12', 'P12', -104.933862, 39.701568, {'status': 'producing', 'wells': 'P12-1H'}),
    ('p21', 'well-pad', 'P21', 'P21', -104.926030, 39.702146, {'status': 'producing', 'wells': 'P21-3H'}),
    ('ctb1', 'tank-battery', 'CTB1', 'CTB1', -104.929571, 39.699752, {'tanks': 4}),
    ('cs01', 'compressor-station', 'CS01', 'CS01', -104.924957, 39.698432, {}),
    ('swd1', 'swd', 'SWD1', 'SWD1', -104.927211, 39.696120, {}),
)

# L-SWD: CTB1, a bend, SWD1 (454.0 m by the contract's formulas), its ends snapped to both sites.
SWD_LINE = ((-104.929571, 39.699752), (-104.928670, 39.697887), (-104.927211, 39.696120))
# (key, name, kind, asset, distance along the line in metres, longitude, latitude), the point at each
# distance by the same formulas (within the write path's 1 m).
SWD_INSTRUMENTS = (
    ('pt1', 'PT-1', 'tap', 'PT1', 175.0, -104.928858, 39.698277),
    ('lv1', 'LV-1', 'valve', 'LV1', 313.0, -104.928095, 39.697190),
    ('pt2', 'PT-2', 'tap', 'PT2', 438.0, -104.927311, 39.696242),
)
# L-GL21: P21, a bend, CS01; no instrument, so it draws as the thin untapped line (DESIGN.md map-line).
GL21_LINE = ((-104.926030, 39.702146), (-104.924314, 39.700330), (-104.924957, 39.698432))
# The laterals: P14 straight to CTB1; P12 with a bend to CTB1.
LATERALS = (
    ('p14', 'P14 lateral', ((-104.932682, 39.697524), (-104.929571, 39.699752))),
    ('p12', 'P12 lateral', ((-104.933862, 39.701568), (-104.931287, 39.701156), (-104.929571, 39.699752))),
)
# The geofence: a closed ring round the field.
GEOFENCE = ((-104.934935, 39.702889), (-104.923348, 39.703137), (-104.922812, 39.698597), (-104.925065, 39.695212),
            (-104.934935, 39.695542))

WELL_PAD_SETUP = {
    'comms': {'path': '{asset.path}/Comms', 'on': True},
    'kpis': [
        {'key': 'casing', 'label': 'Casing pressure', 'path': '{asset.path}/CasingPressure', 'unit': 'psi', 'on': True, 'icon': True},
        {'key': 'tubing', 'label': 'Tubing pressure', 'path': '{asset.path}/TubingPressure', 'unit': 'psi', 'on': True, 'icon': False},
        {'key': 'gas', 'label': 'Gas rate', 'path': '{asset.path}/GasRate', 'unit': 'MMcf/d', 'on': True, 'icon': False}],
    'alarms': {'path': '{asset.path}', 'count': True, 'summary': True},
    'link': '/site/{item.name}',
}
TANK_BATTERY_SETUP = {
    'comms': {'path': '{asset.path}/Comms', 'on': True},
    'kpis': [
        {'key': 'pressure', 'label': 'Pressure', 'path': '{asset.path}/Pressure', 'unit': 'psi', 'on': True, 'icon': True},
        {'key': 'level', 'label': 'Tank level', 'path': '{asset.path}/TankLevel', 'unit': '%', 'on': True, 'icon': False}],
    'alarms': {'path': '{asset.path}', 'count': True, 'summary': True},
    'link': '/site/{item.name}',
}
COMPRESSOR_SETUP = {
    'comms': {'path': '{asset.path}/Comms', 'on': True},
    'kpis': [
        {'key': 'discharge', 'label': 'Discharge pressure', 'path': '{asset.path}/DischargePressure', 'unit': 'psi', 'on': True, 'icon': True},
        {'key': 'suction', 'label': 'Suction pressure', 'path': '{asset.path}/SuctionPressure', 'unit': 'psi', 'on': True, 'icon': False}],
    'alarms': {'path': '{asset.path}', 'count': True, 'summary': True},
    'link': '/site/{item.name}',
}
SWD_SETUP = {
    'comms': {'path': '{asset.path}/Comms', 'on': True},
    'kpis': [
        {'key': 'pressure', 'label': 'Pressure', 'path': '{asset.path}/Pressure', 'unit': 'psi', 'on': True, 'icon': True},
        {'key': 'injection', 'label': 'Injection rate', 'path': '{asset.path}/InjectionRate', 'unit': 'bbl/d', 'on': True, 'icon': False}],
    'alarms': {'path': '{asset.path}', 'count': True, 'summary': True},
    'link': '/site/{item.name}',
}
# A pipeline takes its look per segment from the worst of the instruments at the segment's ends.
PIPELINE_SETUP = {'styleRule': {'source': {'instruments': 'worst'}}}
TAP_SETUP = {
    'comms': {'path': '{asset.path}/Comms', 'on': True},
    'kpis': [{'key': 'pressure', 'label': 'Pressure', 'path': '{asset.path}/Pressure', 'unit': 'psi', 'on': True, 'icon': True}],
    'alarms': {'path': '{asset.path}', 'count': True, 'summary': True},
}
VALVE_SETUP = {
    'comms': {'path': '{asset.path}/Comms', 'on': True},
    'kpis': [{'key': 'position', 'label': 'Position', 'path': '{asset.path}/Position', 'unit': '%', 'on': True, 'icon': False}],
}

KIND_SETUPS = (('well-pad', WELL_PAD_SETUP), ('tank-battery', TANK_BATTERY_SETUP), ('compressor-station', COMPRESSOR_SETUP),
               ('swd', SWD_SETUP), ('pipeline', PIPELINE_SETUP), ('tap', TAP_SETUP), ('valve', VALVE_SETUP))

# The demo tags' values (SHOWCASE_PREFIX + path): the mockups' numbers. The alarm tag P14-2H is written
# below its setpoint first, so a re-run raises "Casing pressure high" afresh, unacknowledged.
TAG_VALUES = (
    ('P14/Comms', True), ('P14/CasingPressure', 1240.0), ('P14/TubingPressure', 410.0), ('P14/GasRate', 1.8),
    ('P12/Comms', True), ('P12/CasingPressure', 960.0), ('P12/TubingPressure', 350.0), ('P12/GasRate', 1.4),
    ('P21/Comms', False), ('P21/CasingPressure', 880.0), ('P21/TubingPressure', 300.0), ('P21/GasRate', 1.1),
    ('CTB1/Comms', True), ('CTB1/Pressure', 412.0), ('CTB1/TankLevel', 62.0),
    ('CS01/Comms', True), ('CS01/DischargePressure', 1180.0), ('CS01/SuctionPressure', 95.0),
    ('SWD1/Comms', True), ('SWD1/Pressure', 365.0), ('SWD1/InjectionRate', 4200.0),
    ('PT1/Comms', True), ('PT1/Pressure', 398.0), ('PT2/Comms', True), ('PT2/Pressure', 371.0),
    ('LV1/Comms', True), ('LV1/Position', 100.0),
)
ALARM_TAG = 'P14/P14-2H'
ALARM_BELOW = 900.0
ALARM_VALUE = 1240.0
STALE_TAG = 'SWD1/InjectionRate'


def _logger():
    return system.util.getLogger('MapStudio.seed')


def seed_id(set_name, key):
    """The UUIDv5 of mapstudio-showcase/seed/<set>/<key> (uuid.NAMESPACE_URL)."""
    import uuid
    return str(uuid.uuid5(uuid.NAMESPACE_URL, ID_PREFIX + set_name + '/' + key))


def seed_items(make_id=seed_id):
    """The showcase's map items in the shape mapstudio_seed.seed_items gives, the sites first."""
    item = mapstudio_seed._item
    point = mapstudio_seed._point
    line = mapstudio_seed._line
    items = []
    for key, kind, name, asset_id, lng, lat, properties in SITES:
        items.append(item(make_id, 'sites', key, kind, name, point(lng, lat), properties, asset_id))
    line_id = make_id('lines', 'swd')
    items.append(item(make_id, 'lines', 'swd', 'pipeline', 'L-SWD', line(SWD_LINE), {'diameter': 6, 'product': 'Produced water'},
                      None, None, {'start': {'itemId': make_id('sites', 'ctb1')}, 'end': {'itemId': make_id('sites', 'swd1')}}))
    for key, name, kind, asset_id, distance_m, lng, lat in SWD_INSTRUMENTS:
        items.append(item(make_id, 'instruments', key, kind, name, point(lng, lat), {}, asset_id, None, None,
                          {'lineId': line_id, 'distanceM': distance_m}))
    items.append(item(make_id, 'lines', 'gl21', 'pipeline', 'L-GL21', line(GL21_LINE), {'diameter': 4, 'product': 'Gas'}, None, None,
                      {'start': {'itemId': make_id('sites', 'p21')}, 'end': {'itemId': make_id('sites', 'cs01')}}))
    for key, name, coords in LATERALS:
        items.append(item(make_id, 'laterals', key, 'lateral', name, line(coords), {}))
    items.append(item(make_id, 'areas', 'lease', 'geofence', 'Mesa lease', line(GEOFENCE), {}))
    return items


def _write(path, value):
    """Write one demo tag below SHOWCASE_PREFIX; refuses any other path. Returns the quality as text."""
    if not path.startswith(SHOWCASE_PREFIX):
        raise ValueError('Only tags below %s are showcase test equipment; refusing %s' % (SHOWCASE_PREFIX, path))
    return str(system.tag.writeBlocking([path], [value], 5000)[0])


def set_states():
    """
    Put the demo tags in the mockups' states: every value, the alarm raised afresh (below the setpoint,
    then above it) and SWD1's injection rate at Bad quality so it reads stale. Returns
    {written, alarm, stale} (qualities as text) or {error}.
    """
    from com.inductiveautomation.ignition.common.model.values import BasicQualifiedValue, QualityCode
    logger = _logger()
    result = {'written': 0}
    try:
        for path, value in TAG_VALUES:
            _write(SHOWCASE_PREFIX + path, value)
            result['written'] += 1
        _write(SHOWCASE_PREFIX + ALARM_TAG, ALARM_BELOW)
        result['alarm'] = _write(SHOWCASE_PREFIX + ALARM_TAG, ALARM_VALUE)
        result['stale'] = _write(SHOWCASE_PREFIX + STALE_TAG, BasicQualifiedValue(4200.0, QualityCode.Bad))
    except java.lang.Throwable as ex:
        result['error'] = ex.getMessage()
        logger.warn('Showcase tags not set: %s' % ex.getClass().getSimpleName())
    except Exception as ex:
        result['error'] = str(ex)
        logger.warn('Showcase tags not set: %s' % type(ex).__name__)
    return result


def run(project=PROJECT, actor=ACTOR, api=None, make_id=seed_id):
    """
    Seed the showcase project's map and put the demo tags in the mockups' states. Returns
    mapstudio_seed.run's result with `tags` (set_states' result) added; safe to re-run.
    """
    result = mapstudio_seed.run(project, actor, api, make_id, seed=seed_items(make_id), kind_setups=KIND_SETUPS)
    result['tags'] = set_states()
    return result
