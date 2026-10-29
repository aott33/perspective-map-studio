# Dev test equipment for the live values (epic 3 entry 5; the L-SWD set, entry 2). Jython 2.7 (the
# Gateway's). The /live page's buttons call these to toggle a dev tag, raise and acknowledge the dev
# alarm and break comms on the dev tag provider's pads and taps (ops/config/core, the UDTs Pad and Tap
# with the dev-only alarm "High pressure" above 900 on Pressure, manual acknowledgement; Valve with a
# Position), so the e2e suite can see an icon, a line's segments and their popups follow. Only paths
# under PREFIX are ever written: nothing here touches a real Gateway, and Map Studio itself never
# writes a tag (AD-1).
#
# Engineering review flag (CLAUDE.md, alarm changes): the alarm is dev-only test equipment on the
# disposable dev Gateway; never copy it to a real Gateway or into the template.

import java.lang

PREFIX = '[default]Mesa/'
PADS = ('P12', 'P14', 'P15')
# The L-SWD set's devices (entry 2): the pads at the line's ends, its two taps and its line valve.
SWD_DEVICES = ('CTB1', 'SWD1', 'PT1', 'PT2', 'LV1')

logger = system.util.getLogger('MapStudio.devlive')


def _path(pad, member):
    if pad not in PADS and pad not in SWD_DEVICES:
        raise ValueError('Unknown dev device %s; the dev devices are %s' % (pad, ', '.join(PADS + SWD_DEVICES)))
    return '%s%s/%s' % (PREFIX, pad, member)


def write(path, value):
    """Write one dev tag below PREFIX and return the quality as text; refuses any other path."""
    if not path.startswith(PREFIX):
        raise ValueError('Only tags below %s are dev test equipment; refusing %s' % (PREFIX, path))
    try:
        quality = system.tag.writeBlocking([path], [value], 5000)[0]
        return str(quality)
    except java.lang.Throwable as ex:
        logger.warn('Dev tag write failed: %s' % ex.getClass().getSimpleName())
        raise
    except Exception as ex:
        logger.warn('Dev tag write failed: %s' % type(ex).__name__)
        raise


def set_pressure(pad, value):
    """Pressure of a dev pad or tap: above 900 raises its High pressure alarm."""
    return {'path': _path(pad, 'Pressure'), 'value': value, 'quality': write(_path(pad, 'Pressure'), float(value))}


def set_comms(pad, on):
    """Comms of a dev pad, tap or valve: false is comms lost on the map."""
    return {'path': _path(pad, 'Comms'), 'value': bool(on), 'quality': write(_path(pad, 'Comms'), bool(on))}


def set_quality(pad, member, good):
    """The quality of a dev pad's tag (epic 3 entry 3): Bad draws the slot stale on the map (its item stale while
    comms are fine); Good restores it. The value written is the one the tag holds now."""
    from com.inductiveautomation.ignition.common.model.values import BasicQualifiedValue, QualityCode
    if member not in ('Pressure', 'Flow', 'Status'):
        raise ValueError('Unknown dev pad member %s' % member)
    path = _path(pad, member)
    try:
        current = system.tag.readBlocking([path])[0].value
    except java.lang.Throwable as ex:
        logger.warn('Dev tag read failed: %s' % ex.getClass().getSimpleName())
        raise
    except Exception as ex:
        logger.warn('Dev tag read failed: %s' % type(ex).__name__)
        raise
    quality = QualityCode.Good if good else QualityCode.Bad
    return {'path': path, 'value': current, 'quality': write(path, BasicQualifiedValue(current, quality))}


def set_status(pad, value):
    """Status of a dev pad (epic 3 entry 1): the pad kind's States rule reads it (1 attention, 2 warning, 3 fault, 4 dimmed)."""
    return {'path': _path(pad, 'Status'), 'value': int(value), 'quality': write(_path(pad, 'Status'), int(value))}


LINE_FLOW = PREFIX + 'Lines/L3/Flow'


def set_line_flow(value):
    """Flow of the dev line L3 (epic 3 entry 1): the line kind's Bands rule reads it (below 50 normal, 50 to 200 attention, 200 and above fault)."""
    return {'path': LINE_FLOW, 'value': float(value), 'quality': write(LINE_FLOW, float(value))}


def set_position(valve, value):
    """Position of the dev line valve LV1 (entry 2), the valve kind's KPI."""
    return {'path': _path(valve, 'Position'), 'value': float(value), 'quality': write(_path(valve, 'Position'), float(value))}


def swd_quiet():
    """
    The L-SWD set in its quiet state (entry 2): PT1 398 and PT2 371 psi (inside the tap setup's normal
    band, below the alarm), CTB1 412 and SWD1 365, LV1 at 100 %, comms on everywhere, nothing
    unacknowledged. Returns the qualities by path.
    """
    writes = [('PT1', 'Pressure', 398.0), ('PT2', 'Pressure', 371.0), ('CTB1', 'Pressure', 412.0), ('SWD1', 'Pressure', 365.0),
              ('LV1', 'Position', 100.0)]
    writes += [(device, 'Comms', True) for device in SWD_DEVICES]
    qualities = {}
    for device, member, value in writes:
        qualities[_path(device, member)] = write(_path(device, member), value)
    acknowledged = 0
    for device in ('PT1', 'PT2'):
        acknowledged += acknowledge(device)['acknowledged']
    return {'qualities': qualities, 'acknowledged': acknowledged}


def swd_status():
    """What the L-SWD set's tags and alarms read now (for the result label)."""
    paths = [_path('PT1', 'Pressure'), _path('PT1', 'Comms'), _path('PT2', 'Pressure'), _path('PT2', 'Comms'),
             _path('LV1', 'Position'), _path('CTB1', 'Pressure'), _path('SWD1', 'Pressure')]
    try:
        values = [v.value for v in system.tag.readBlocking(paths)]
        active = system.alarm.queryStatus(source=['*Mesa/PT1/*', '*Mesa/PT2/*'], state=['ActiveUnacked', 'ActiveAcked'])
        return {'pt1': {'pressure': values[0], 'comms': values[1]}, 'pt2': {'pressure': values[2], 'comms': values[3]},
                'lv1': {'position': values[4]}, 'ctb1': {'pressure': values[5]}, 'swd1': {'pressure': values[6]},
                'alarms': [{'name': str(e.getName()), 'source': str(e.getSource()), 'state': str(e.getState())} for e in active]}
    except java.lang.Throwable as ex:
        logger.warn('Dev status read failed: %s' % ex.getClass().getSimpleName())
        raise
    except Exception as ex:
        logger.warn('Dev status read failed: %s' % type(ex).__name__)
        raise


def acknowledge(pad):
    """Acknowledge every active unacknowledged alarm below a dev pad or tap; returns how many."""
    if pad not in PADS and pad not in SWD_DEVICES:
        raise ValueError('Unknown dev device %s; the dev devices are %s' % (pad, ', '.join(PADS + SWD_DEVICES)))
    try:
        results = system.alarm.queryStatus(source=['*Mesa/%s/*' % pad], state=['ActiveUnacked'])
        ids = [str(event.getId()) for event in results]
        if ids:
            # 8.3.10 takes all three arguments (alarm ids, notes, username): two raise
            # "acknowledge(): expected 3 args; got 2" (docs/platform-checks.md).
            system.alarm.acknowledge(ids, 'dev acknowledgement (epic 3 entry 5)', 'mapstudio-dev')
        logger.info('Dev acknowledgement of %s: %d alarm(s)' % (pad, len(ids)))
        return {'pad': pad, 'acknowledged': len(ids)}
    except java.lang.Throwable as ex:
        logger.warn('Dev acknowledgement failed: %s' % ex.getClass().getSimpleName())
        raise
    except Exception as ex:
        logger.warn('Dev acknowledgement failed: %s' % type(ex).__name__)
        raise


def status(pad):
    """What the dev pad's tags and alarms read now (for the result label)."""
    paths = [_path(pad, 'Pressure'), _path(pad, 'Comms'), _path(pad, 'Status'), LINE_FLOW]
    try:
        values = system.tag.readBlocking(paths)
        active = system.alarm.queryStatus(source=['*Mesa/%s/*' % pad], state=['ActiveUnacked', 'ActiveAcked'])
        return {'pad': pad, 'pressure': values[0].value, 'comms': values[1].value, 'status': values[2].value,
                'lineFlow': values[3].value,
                'alarms': [{'name': str(e.getName()), 'state': str(e.getState())} for e in active]}
    except java.lang.Throwable as ex:
        logger.warn('Dev status read failed: %s' % ex.getClass().getSimpleName())
        raise
    except Exception as ex:
        logger.warn('Dev status read failed: %s' % type(ex).__name__)
        raise
