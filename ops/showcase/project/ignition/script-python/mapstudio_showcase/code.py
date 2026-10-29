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
