# Example Map Studio kind and asset adapters wrapping named queries.
# Jython 2.7. Put it in a project library module (for example
# my_map_adapters/code.py) and name it in the Map Studio setup:
#   "kindsFunction": "my_map_adapters.kinds",
#   "assetsFunction": "my_map_adapters.assets"
#
# Unverified on a live Gateway: written against the documented 8.3
# system.db.execQuery; the named queries MapAdapters/kinds and
# MapAdapters/assets are yours to write, returning the columns named below.
#
# Rules Map Studio's contracts set (docs/kinds-and-assets.md):
# - return a list of dicts, not a Dataset;
# - raise on failure, never return [] for an error: [] reads as "no rows".

import java.lang

logger = system.util.getLogger('MyProject.mapAdapters')


def _rows(query):
    """The named query's rows as a list of dicts keyed by column name."""
    try:
        data = system.db.execQuery(query, {})
    except java.lang.Throwable as ex:
        logger.error('Named query %s failed: %s' % (query, ex.getClass().getSimpleName()))
        raise
    except Exception as ex:
        logger.error('Named query %s failed: %s' % (query, type(ex).__name__))
        raise
    ds = system.dataset.toPyDataSet(data)
    columns = list(ds.getColumnNames())
    return [dict(zip(columns, list(row))) for row in ds]


def kinds():
    """Columns id, name, geometry ('point' or 'line'), icon, label_rank."""
    out = []
    for row in _rows('MapAdapters/kinds'):
        out.append({
            'id': str(row['id']),
            'name': str(row['name']),
            'geometry': str(row['geometry']),
            'icon': str(row['icon'] or ''),
            'labelRank': int(row['label_rank'] or 0),
            'fields': [],
        })
    return out


def assets():
    """Columns id, name, kind, base_path (fully qualified, provider included)."""
    out = []
    for row in _rows('MapAdapters/assets'):
        out.append({
            'id': str(row['id']),
            'name': str(row['name']),
            'kind': str(row['kind']),
            'basePath': str(row['base_path']),
        })
    return out
