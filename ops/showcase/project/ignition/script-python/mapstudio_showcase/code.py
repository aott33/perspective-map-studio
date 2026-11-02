# The showcase project's kind and asset adapter (epic 3 entry 15). Jython 2.7 (the Gateway's).
# The mapstudio-showcase project (ops/showcase/project) shows the Map Studio component alone on a
# Mesa-like demo field with the UX mockups' names, kinds and states; its map items and kind setups
# are seeded by the dev project's /edit page ("Seed the dev map" seeds both maps; project library
# mapstudio_showcase_seed in ops/project), which names the kind ids and asset ids below. The tags
# are the dev tag provider's Showcase folder (ops/config/core, memory tags; the one alarm is dev-only
# test equipment on the disposable dev Gateway, never for a real Gateway or the template).

KINDS = [
    {'id': 'well-pad', 'name': 'Well pad', 'geometry': 'point', 'icon': 'well-pad', 'labelRank': 10,
     'fields': [
         {'key': 'wells', 'label': 'Wells', 'type': 'text', 'required': False},
         {'key': 'status', 'label': 'Status', 'type': 'choice', 'required': True,
          'choices': ['producing', 'shut in', 'abandoned']}]},
    {'id': 'tank-battery', 'name': 'Tank battery', 'geometry': 'point', 'icon': 'tank-battery', 'labelRank': 9,
     'fields': [{'key': 'tanks', 'label': 'Tanks', 'type': 'integer', 'required': False}]},
    {'id': 'compressor-station', 'name': 'Compressor station', 'geometry': 'point', 'icon': 'compressor-station',
     'labelRank': 9, 'fields': []},
    {'id': 'swd', 'name': 'SWD', 'geometry': 'point', 'icon': 'swd', 'labelRank': 8, 'fields': []},
    {'id': 'pipeline', 'name': 'Pipeline', 'geometry': 'line', 'icon': 'pipeline', 'labelRank': 5,
     'fields': [
         {'key': 'product', 'label': 'Product', 'type': 'text', 'required': False},
         {'key': 'diameter', 'label': 'Diameter (in)', 'type': 'number', 'required': False}]},
    {'id': 'lateral', 'name': 'Lateral', 'geometry': 'line', 'icon': 'lateral', 'labelRank': 3, 'fields': []},
    {'id': 'geofence', 'name': 'Geofence', 'geometry': 'line', 'icon': 'geofence', 'labelRank': 0, 'area': True,
     'fields': []},
    {'id': 'tap', 'name': 'Tap', 'geometry': 'point', 'icon': 'tap', 'labelRank': 2, 'instrument': True, 'fields': []},
    {'id': 'valve', 'name': 'Line valve', 'geometry': 'point', 'icon': 'line-valve', 'labelRank': 1, 'instrument': True,
     'fields': []},
]

PREFIX = '[default]Showcase/'

ASSETS = [
    {'id': 'P14', 'name': 'P14', 'kind': 'well-pad', 'basePath': PREFIX + 'P14'},
    {'id': 'P12', 'name': 'P12', 'kind': 'well-pad', 'basePath': PREFIX + 'P12'},
    {'id': 'P21', 'name': 'P21', 'kind': 'well-pad', 'basePath': PREFIX + 'P21'},
    {'id': 'CTB1', 'name': 'CTB1', 'kind': 'tank-battery', 'basePath': PREFIX + 'CTB1'},
    {'id': 'CS01', 'name': 'CS01', 'kind': 'compressor-station', 'basePath': PREFIX + 'CS01'},
    {'id': 'SWD1', 'name': 'SWD1', 'kind': 'swd', 'basePath': PREFIX + 'SWD1'},
    {'id': 'PT1', 'name': 'PT-1', 'kind': 'tap', 'basePath': PREFIX + 'PT1'},
    {'id': 'PT2', 'name': 'PT-2', 'kind': 'tap', 'basePath': PREFIX + 'PT2'},
    {'id': 'LV1', 'name': 'LV-1', 'kind': 'valve', 'basePath': PREFIX + 'LV1'},
    {'id': 'LSWD', 'name': 'L-SWD', 'kind': 'pipeline', 'basePath': PREFIX + 'Lines/LSWD'},
]


def kinds():
    """The showcase kinds (docs/kinds-and-assets.md)."""
    return [dict(k) for k in KINDS]


def assets():
    """The showcase assets, one per demo site and instrument."""
    return [dict(a) for a in ASSETS]


# The one showcase state a Gateway restart loses (owner review notes item 10): memory tags keep their
# values, but not the Bad quality the seed gives SWD1's injection rate so it reads stale. The
# Showcase and ShowcaseDark views' startup scripts call restore_states(), so the showcase is right
# after any restart with no re-seed; the full seed stays the dev project's "Seed the dev map"
# (mapstudio_showcase_seed, which sets this tag the same way).
STALE_TAG = PREFIX + 'SWD1/InjectionRate'
STALE_VALUE = 4200.0


def restore_states():
    """
    Put back the showcase states a Gateway restart loses, when they are gone: SWD1's injection rate
    at Bad quality (so SWD1 reads stale). Returns {restored: bool, quality: text} or {error}. Showcase
    demo tags only; safe to call on every page open.
    """
    import java.lang
    from com.inductiveautomation.ignition.common.model.values import BasicQualifiedValue, QualityCode
    logger = system.util.getLogger('MapStudio.showcase')
    result = {'restored': False}
    try:
        current = system.tag.readBlocking([STALE_TAG])[0]
        result['quality'] = str(current.quality)
        if current.quality.isGood():
            quality = system.tag.writeBlocking([STALE_TAG], [BasicQualifiedValue(STALE_VALUE, QualityCode.Bad)], 5000)[0]
            result['restored'] = True
            result['quality'] = str(quality)
            logger.info('Showcase states restored after a restart: SWD1 stale again (%s)' % quality)
    except java.lang.Throwable as ex:
        result['error'] = ex.getMessage()
        logger.warn('Showcase states not restored: %s' % ex.getClass().getSimpleName())
    except Exception as ex:
        result['error'] = str(ex)
        logger.warn('Showcase states not restored: %s' % type(ex).__name__)
    return result
