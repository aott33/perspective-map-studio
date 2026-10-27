# Example Map Studio asset adapter: one asset per UDT instance in the tag tree.
# Jython 2.7. Put it in a project library module (for example
# my_map_adapters/code.py) and name it in the Map Studio setup:
#   "assetsFunction": "my_map_adapters.assets"
#
# Unverified on a live Gateway: written against the documented 8.3
# system.tag.browse; check the folder, the UDT type ids and the kind mapping
# against your own tags before use.
#
# Rules Map Studio's asset contract sets (docs/kinds-and-assets.md):
# - return a list of dicts {id, name, kind, basePath}; kind must be in the kind list;
# - basePath is fully qualified, provider included: "[default]Mesa/P12";
# - raise on failure, never return [] for an error: [] reads as "no assets".

import java.lang

logger = system.util.getLogger('MyProject.mapAdapters')

# Where the asset instances live, and which UDT type is which Map Studio kind.
ROOT = '[default]Mesa'
KIND_BY_TYPE = {
    'Upstream/WellPad': 'pad',
    'Upstream/GatheringLine': 'line',
}


def _browse(path):
    """Every UDT instance below path, recursively, as browse result rows."""
    results = system.tag.browse(path, {'tagType': 'UdtInstance', 'recursive': True})
    if not results.getResultQuality().isGood():
        raise RuntimeError('Browsing %s gave quality %s' % (path, results.getResultQuality()))
    return results.getResults()


def assets():
    """One asset per UDT instance of a known type below ROOT."""
    rows = []
    try:
        for tag in _browse(ROOT):
            type_id = str(tag['typeId'] or '')
            kind = KIND_BY_TYPE.get(type_id)
            if kind is None:
                continue
            full_path = str(tag['fullPath'])
            rows.append({
                'id': str(tag['name']),
                'name': str(tag['name']),
                'kind': kind,
                'basePath': full_path,
            })
    except java.lang.Throwable as ex:
        logger.error('Asset adapter failed: %s' % ex.getClass().getSimpleName())
        raise
    except Exception as ex:
        logger.error('Asset adapter failed: %s' % type(ex).__name__)
        raise
    return rows
