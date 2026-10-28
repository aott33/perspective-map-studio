# Example Map Studio kind and asset adapters wrapping named queries.
# Map Studio contract 0.3.0 (docs/contract.md, docs/kinds-and-assets.md).
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
# - raise on failure, never return [] for an error: [] reads as "no rows";
# - text is unicode: str() of a non-ASCII value raises UnicodeEncodeError in
#   Jython 2.7, so this example uses unicode(); a NULL stays None, so Map Studio
#   leaves that row out with a reason ("no id") instead of an id 'None'.

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


def _text(value):
    """unicode text, or None for a NULL column."""
    if value is None:
        return None
    return unicode(value)


def kinds():
    """Columns id, name, geometry ('point' or 'line'), icon, label_rank."""
    out = []
    for row in _rows('MapAdapters/kinds'):
        out.append({
            'id': _text(row['id']),
            'name': _text(row['name']),
            'geometry': _text(row['geometry']),
            'icon': _text(row['icon']) or u'',
            'labelRank': int(row['label_rank'] or 0),
            'fields': [],
        })
    return out


def assets():
    """Columns id, name, kind, base_path (fully qualified, provider included)."""
    out = []
    for row in _rows('MapAdapters/assets'):
        out.append({
            'id': _text(row['id']),
            'name': _text(row['name']),
            'kind': _text(row['kind']),
            'basePath': _text(row['base_path']),
        })
    return out
