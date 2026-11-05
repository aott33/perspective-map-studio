import { MapItemRecord } from '../contract';
import {
    SAVE_IDLE,
    itemsToGeoJson,
    lineCreateBatch,
    newId,
    pointCreateBatch,
    refusedSave,
    roundCoordinate,
    saveStatusWords,
    updateBatch,
    withItem
} from '../save';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function item(id: string, geometry: MapItemRecord['geometry'], deleted = false): MapItemRecord {
    return { id, kind: 'line', name: id, geometry, properties: {}, assetId: null, overrides: {}, ends: null, attachment: null, version: 1, deleted };
}

describe('saving a drawn line (epic 4 entry 4)', () => {
    test('one create op at baseVersion 0 with a new UUID, the kind, its name as the placeholder, the vertices to 6 decimals and the ends', () => {
        const itemId = newId();
        const batchId = newId();
        expect(itemId).toMatch(UUID);
        const ends = { start: { itemId: 'ctb1' }, end: { itemId: 'swd1' } };
        const batch = lineCreateBatch(itemId, batchId, 'line', 'Gathering line', [[-104.9912345678, 39.74], [-104.98, 39.7500000049]], ends);
        expect(batch).toEqual({
            batchId,
            ops: [{
                op: 'create', entity: 'item', id: itemId, baseVersion: 0,
                data: {
                    kind: 'line',
                    name: 'Gathering line',
                    geometry: { type: 'LineString', coordinates: [[-104.991235, 39.74], [-104.98, 39.75]] },
                    ends
                }
            }]
        });
    });

    test('a line with both ends floating carries no ends field (null is never sent); an area is the ring unclosed', () => {
        const batch = lineCreateBatch('i', 'b', 'geofence', 'Geofence', [[-104.99, 39.74], [-104.98, 39.745], [-104.97, 39.74]], null);
        expect(batch.ops[0].data).toEqual({
            kind: 'geofence', name: 'Geofence', geometry: { type: 'LineString', coordinates: [[-104.99, 39.74], [-104.98, 39.745], [-104.97, 39.74]] }
        });
        expect('ends' in batch.ops[0].data!).toBe(false);
        const start = lineCreateBatch('i', 'b', 'line', 'Gathering line', [[0, 0], [1, 1]], { start: { itemId: 'a' } });
        expect(start.ops[0].data!.ends).toEqual({ start: { itemId: 'a' } });
    });

    test('a refused save keeps the code and the Gateway\'s words (the dev status line\'s words left with it, epic 4 entry 24)', () => {
        const refused = refusedSave('a', { code: 'role', message: 'You do not have a role that lets you change the map.' });
        expect(refused).toEqual({ state: 'refused', itemId: 'a', code: 'role', message: 'You do not have a role that lets you change the map.' });
        expect(saveStatusWords(refused)).toBe('Not saved - You do not have a role that lets you change the map.');
    });
});

describe('drawing the store items', () => {
    test('points and lines go to their own collections with their ids; deleted items are left out', () => {
        const data = itemsToGeoJson([
            item('l1', { type: 'LineString', coordinates: [[0, 0], [1, 1]] }),
            item('p1', { type: 'Point', coordinates: [2, 2] }),
            item('gone', { type: 'Point', coordinates: [3, 3] }, true)
        ]);
        expect(data.lines.features.map((f) => f.properties.id)).toEqual(['l1']);
        expect(data.points.features.map((f) => f.properties.id)).toEqual(['p1']);
        expect(data.points.features[0].geometry.coordinates).toEqual([2, 2]);
    });

    test('a saved item replaces the one with its id', () => {
        const a = item('a', { type: 'Point', coordinates: [0, 0] });
        const b = item('b', { type: 'Point', coordinates: [1, 1] });
        const a2 = { ...a, version: 2 };
        expect(withItem([a, b], a2)).toEqual([b, a2]);
    });
});

describe('the studio\'s saves (epic 4 entry 2)', () => {
    test('a placed point is one create at baseVersion 0 as the kind with the placeholder name, to 6 decimals', () => {
        expect(pointCreateBatch('i', 'b', 'pad', 'Well pad', [-104.97251234567, 39.7445987654])).toEqual({
            batchId: 'b',
            ops: [{ op: 'create', entity: 'item', id: 'i', baseVersion: 0,
                data: { kind: 'pad', name: 'Well pad', geometry: { type: 'Point', coordinates: [-104.972512, 39.744599] } } }]
        });
        expect(roundCoordinate(1.23456789)).toBe(1.234568);
    });

    test('a finished field is one update at the stored version carrying only that field', () => {
        expect(updateBatch('i', 'b', 3, { name: 'P31' })).toEqual({
            batchId: 'b', ops: [{ op: 'update', entity: 'item', id: 'i', baseVersion: 3, data: { name: 'P31' } }]
        });
        expect(updateBatch('i', 'b', 4, { assetId: null }).ops[0].data).toEqual({ assetId: null });
    });

    test('the panel header\'s words: Saved, Saving..., a problem on its own', () => {
        expect(saveStatusWords(SAVE_IDLE)).toBe('Saved');
        expect(saveStatusWords({ state: 'saved', itemId: 'a', version: 2 })).toBe('Saved');
        expect(saveStatusWords({ state: 'saving', itemId: 'a' })).toBe('Saving...');
        expect(saveStatusWords(refusedSave('a', { code: 'conflict', message: 'P31 was changed by mapoperator at 14:02 UTC since you loaded it. Nothing in this save was written.' })))
            .toBe('Not saved - P31 was changed by mapoperator at 14:02 UTC since you loaded it. Nothing in this save was written.');
        expect(saveStatusWords({ state: 'unsent', itemId: 'a', code: 'timeout' })).toMatch(/^Not saved - store unreachable/);
    });
});
