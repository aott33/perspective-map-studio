# Dev test equipment for the live values (epic 3 entry 5). Jython 2.7 (the Gateway's).
# The /live page's buttons call these to toggle a dev tag, raise and acknowledge the dev alarm and
# break comms on the dev tag provider's pads (ops/config/core, the UDT Pad with the dev-only alarm
# "High pressure" above 900 on Pressure, manual acknowledgement), so the e2e suite can see an icon
# and its popup follow. Only paths under PREFIX are ever written: nothing here touches a real
# Gateway, and Map Studio itself never writes a tag (AD-1).
#
# Engineering review flag (CLAUDE.md, alarm changes): the alarm is dev-only test equipment on the
# disposable dev Gateway; never copy it to a real Gateway or into the template.

import java.lang

PREFIX = '[default]Mesa/'
PADS = ('P12', 'P14', 'P15')

logger = system.util.getLogger('MapStudio.devlive')


def _path(pad, member):
    if pad not in PADS:
        raise ValueError('Unknown dev pad %s; the dev pads are %s' % (pad, ', '.join(PADS)))
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
    """Pressure of a dev pad: above 900 raises its High pressure alarm."""
    return {'path': _path(pad, 'Pressure'), 'value': value, 'quality': write(_path(pad, 'Pressure'), float(value))}


def set_comms(pad, on):
    """Comms of a dev pad: false is comms lost on the map."""
    return {'path': _path(pad, 'Comms'), 'value': bool(on), 'quality': write(_path(pad, 'Comms'), bool(on))}


def acknowledge(pad):
    """Acknowledge every active unacknowledged alarm below a dev pad; returns how many."""
    if pad not in PADS:
        raise ValueError('Unknown dev pad %s; the dev pads are %s' % (pad, ', '.join(PADS)))
    try:
        results = system.alarm.queryStatus(source=['*Mesa/%s/*' % pad], state=['ActiveUnacked'])
        ids = [str(event.getId()) for event in results]
        if ids:
            system.alarm.acknowledge(ids, 'dev acknowledgement (epic 3 entry 5)')
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
    paths = [_path(pad, 'Pressure'), _path(pad, 'Comms')]
    try:
        values = system.tag.readBlocking(paths)
        active = system.alarm.queryStatus(source=['*Mesa/%s/*' % pad], state=['ActiveUnacked', 'ActiveAcked'])
        return {'pad': pad, 'pressure': values[0].value, 'comms': values[1].value,
                'alarms': [{'name': str(e.getName()), 'state': str(e.getState())} for e in active]}
    except java.lang.Throwable as ex:
        logger.warn('Dev status read failed: %s' % ex.getClass().getSimpleName())
        raise
    except Exception as ex:
        logger.warn('Dev status read failed: %s' % type(ex).__name__)
        raise
