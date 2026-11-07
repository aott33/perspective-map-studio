# The dev page /events (epic 4 entry 14, docs/contract.md "The component's props" and "The
# component's events"): the table of the map's items beside the map, and the words its labels
# show for the viewport. Jython 2.7 (the Gateway's). Test equipment for the dev Gateway only.

import java.lang

PROJECT = 'mapstudio-dev'

logger = system.util.getLogger('MapStudio.devevents')


def itemRows(project=PROJECT):
    """The map's live items as table rows {name, kind, id}, by name then id; [] when the map cannot be read."""
    try:
        items = system.mapstudio.getMap(project)
    except java.lang.Throwable as ex:
        logger.warn('The /events table could not read the map: %s' % ex.getMessage())
        return []
    except Exception as ex:
        logger.warn('The /events table could not read the map: %s' % ex)
        return []
    rows = [{'name': item['name'], 'kind': item['kind'], 'id': item['id']} for item in items]
    rows.sort(key=lambda row: (row['name'], row['id']))
    return rows


def rowOf(rows, item_id):
    """The index of the row whose id is item_id in the table's data, or None (no row, or no id)."""
    if item_id is None:
        return None
    index = 0
    for row in rows or []:
        if row['id'] == item_id:
            return index
        index += 1
    return None


def viewportText(center, zoom, bounds):
    """The viewport {center, zoom, bounds} as one line for the labels: lng,lat|zoom|west,south,east,north."""
    if center is None or zoom is None or bounds is None:
        return ''
    return '%.6f,%.6f|%.2f|%.6f,%.6f,%.6f,%.6f' % (
        center[0], center[1], zoom, bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1])
