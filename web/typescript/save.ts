/**
 * Saving the dev line tool's finished line through the write path (AD-2, AD-10)
 * and drawing the map store's items. Pure functions only, unit tested in node;
 * the component and its delegate hold the state.
 */

import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { EditBatch, MapItemRecord } from './contract';
import { ErrorBody, newMessageId } from './messages';

/**
 * The kind the dev line tool saves its lines as. Fixed until epic-editing's tools
 * pick a kind from the kind list (entry 9 validates kinds).
 */
export const DEV_LINE_KIND = 'line';

/** A UUID v4 for a new map item or batch (AD-10: ids are created in the browser). */
export function newId(): string {
    return newMessageId();
}

/** The name the dev line tool gives a new line: "Line HH:mm:ss" (UTC). */
export function lineName(now: Date): string {
    return 'Line ' + now.toISOString().slice(11, 19);
}

/** One `edits.apply` batch creating one line map item at baseVersion 0. */
export function lineCreateBatch(itemId: string, batchId: string, coordinates: Array<[number, number]>,
                                now: Date): EditBatch {
    return {
        batchId,
        ops: [{
            op: 'create',
            entity: 'item',
            id: itemId,
            baseVersion: 0,
            data: {
                kind: DEV_LINE_KIND,
                name: lineName(now),
                geometry: { type: 'LineString', coordinates: coordinates.map(([x, y]) => [x, y] as [number, number]) }
            }
        }]
    };
}

/** The save state the component shows next to the drawing status. */
export type SaveState =
    | { state: 'idle' }
    | { state: 'saving'; itemId: string }
    | { state: 'saved'; itemId: string; version: number }
    | { state: 'refused'; itemId: string; code: string; message: string }
    /** No answer within the reply timeout, or the client is disconnected: kept and replayed (unsaved.ts). */
    | { state: 'unsent'; itemId: string; code: string };

export const SAVE_IDLE: SaveState = { state: 'idle' };

/** The words for a save state; '' when idle. */
export function saveStatusText(save: SaveState): string {
    switch (save.state) {
        case 'saving':
            return 'Saving the line ...';
        case 'saved':
            return 'Saved as version ' + save.version;
        case 'refused':
            return 'Not saved: ' + save.message;
        case 'unsent':
            return 'Not saved: the store is unreachable. The line is kept here and saves when it is back.';
        default:
            return '';
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
