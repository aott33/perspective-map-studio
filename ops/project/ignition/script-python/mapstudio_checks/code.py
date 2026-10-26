# Spike (story 3): the project-side adapter the Map Studio module calls from
# Java through the project's ScriptManager. Jython 2.7 (the Gateway's).
#
# kinds() is the shape of a future kind adapter (AD-4): a list of dicts. It also
# calls system.mapstudio.ping(), so one call from the module proves both that
# module code can run a project function and that system.mapstudio is
# registered in the project's script scope.

import java.lang

logger = system.util.getLogger('MapStudio.check.adapter')


def kinds():
    """The kind list, plus the answer of system.mapstudio.ping()."""
    ping = None
    try:
        ping = system.mapstudio.ping()
    except java.lang.Throwable as ex:
        logger.error('system.mapstudio.ping failed: %s' % ex.getClass().getSimpleName())
    except Exception as ex:
        logger.error('system.mapstudio.ping failed: %s' % type(ex).__name__)
    rows = [
        {'id': 'pad', 'name': 'Pad', 'geometry': 'point'},
        {'id': 'line', 'name': 'Gathering line', 'geometry': 'line'},
    ]
    logger.info('kinds() called from the module; ping = %s' % ping)
    return {'kinds': rows, 'ping': ping}
