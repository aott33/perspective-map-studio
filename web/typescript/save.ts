/**
 * Saving through the write path (AD-2, AD-10): the studio's point placed by one click, a line or an
 * area finished vertex by vertex (epic 4 entry 4), a finished field's update (epic 4 entry 2), the save
 * state and its words, and drawing the map store's items. Pure functions only, unit tested in node;
 * the component and its delegate hold the state.
 */

import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { EditBatch, MapItemData, MapItemRecord } from './contract';
import { ErrorBody, newMessageId } from './messages';

/** A UUID v4 for a new map item or batch (AD-10: ids are created in the browser). */
export function newId(): string {
    return newMessageId();
}

/** A coordinate as the map store keeps it: 6 decimals (docs/contract.md, the map item record). */
export function roundCoordinate(n: number): number {
    return Math.round(n * 1e6) / 1e6;
}

/**
 * One `edits.apply` batch creating one line map item at baseVersion 0 (epic 4 entry 4): a finished line or
 * area saved at once as `kind` with the kind's name as the placeholder name, its vertices to 6 decimals
 * (an area's ring unclosed, AD-20), and the `ends` its first and last vertex snapped to (null when both
 * float, AD-19: stored, never inferred from the coordinates).
 */
export function lineCreateBatch(itemId: string, batchId: string, kind: string, name: string, coordinates: Array<[number, number]>,
                                ends: MapItemRecord['ends']): EditBatch {
    return {
        batchId,
        ops: [{
            op: 'create',
            entity: 'item',
            id: itemId,
            baseVersion: 0,
            data: {
                kind,
                name,
                geometry: { type: 'LineString', coordinates: coordinates.map(([x, y]) => [roundCoordinate(x), roundCoordinate(y)] as [number, number]) },
                ...(ends === null ? {} : { ends })
            }
        }]
    };
}

/**
 * One `edits.apply` batch creating one point map item at baseVersion 0 (epic 4 entry 2: the Point
 * tool's click saves at once as the kind list's first point kind, with the kind's name as the
 * placeholder name; the kind picker is entry 4's).
 */
export function pointCreateBatch(itemId: string, batchId: string, kind: string, name: string, lngLat: [number, number]): EditBatch {
    return {
        batchId,
        ops: [{
            op: 'create',
            entity: 'item',
            id: itemId,
            baseVersion: 0,
            data: { kind, name, geometry: { type: 'Point', coordinates: [roundCoordinate(lngLat[0]), roundCoordinate(lngLat[1])] } }
        }]
    };
}

/** One `edits.apply` batch updating the top-level fields `data` carries on one map item at its stored version. */
export function updateBatch(itemId: string, batchId: string, baseVersion: number, data: MapItemData): EditBatch {
    return { batchId, ops: [{ op: 'update', entity: 'item', id: itemId, baseVersion, data }] };
}

/** The save state of the last edit sent: the save status's, and `data-save-state` on the map for the e2e suite (epic 4 entry 24). */
export type SaveState =
    | { state: 'idle' }
    | { state: 'saving'; itemId: string }
    | { state: 'saved'; itemId: string; version: number }
    | { state: 'refused'; itemId: string; code: string; message: string }
    /** No answer within the reply timeout, or the client is disconnected: kept and replayed (unsaved.ts). */
    | { state: 'unsent'; itemId: string; code: string };

export const SAVE_IDLE: SaveState = { state: 'idle' };

/**
 * The studio's save status words (EXPERIENCE.md Save status, DESIGN.md save-status; epic 4 entry 2):
 * "Saved" with nothing pending, "Saving..." while a batch is out, and a problem in words on its own
 * (the save status row in Edit mode, the top-centre chip in View mode; problems.ts, entry 24).
 */
export function saveStatusWords(save: SaveState): string {
    switch (save.state) {
        case 'saving':
            return 'Saving...';
        case 'refused':
            return 'Not saved - ' + save.message;
        case 'unsent':
            return 'Not saved - store unreachable; the edit is kept here and saves when it is back';
        default:
            return 'Saved';
    }
}

/** The refused state for an error reply to a save. */
export function refusedSave(itemId: string, error: ErrorBody): SaveState {
    return { state: 'refused', itemId, code: error.code, message: error.message };
}

/** The store's items as two GeoJSON collections for MapLibre, the id in each feature's properties. */
export function itemsToGeoJson(items: MapItemRecord[]): {
    points: FeatureCollection<Point, { id: string; name: string; kind: string }>;
    lines: FeatureCollection<LineString, { id: string; name: string; kind: string }>;
} {
    const points: Array<Feature<Point, { id: string; name: string; kind: string }>> = [];
    const lines: Array<Feature<LineString, { id: string; name: string; kind: string }>> = [];
    for (const item of items) {
        if (item.deleted) {
            continue;
        }
        const properties = { id: item.id, name: item.name, kind: item.kind };
        if (item.geometry.type === 'Point') {
            points.push({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: item.geometry.coordinates } });
        } else {
            lines.push({
                type: 'Feature',
                properties,
                geometry: { type: 'LineString', coordinates: item.geometry.coordinates }
            });
        }
    }
    return {
        points: { type: 'FeatureCollection', features: points },
        lines: { type: 'FeatureCollection', features: lines }
    };
}

/** The items with one saved record added or replaced (by id). */
export function withItem(items: MapItemRecord[], item: MapItemRecord): MapItemRecord[] {
    const out = items.filter((i) => i.id !== item.id);
    out.push(item);
    return out;
}
