// The reverse of a saved batch (epic 2 story 14): one batch, one undo step.
import { MapItemRecord } from '../contract';
import { itemDeleteBatch, lineDeleteBatch, lineGeometryBatch } from '../geometry';
import { reverseBatch } from '../undo';

const LINE_ID = '11111111-1111-4111-8111-111111111111';
const PT1 = '22222222-2222-4222-8222-222222222222';

const LINE: MapItemRecord = { id: LINE_ID, kind: 'line', name: 'L-SWD', properties: { diameter: 8 }, assetId: null,
    geometry: { type: 'LineString', coordinates: [[-103.52, 31.92], [-103.505, 31.9205], [-103.490423, 31.926]] },
    overrides: {}, ends: null, attachment: null, version: 4, deleted: false };
const TAP: MapItemRecord = { id: PT1, kind: 'tap', name: 'PT-1', properties: {}, assetId: null,
    geometry: { type: 'Point', coordinates: [-103.507914, 31.920431] }, overrides: {}, ends: null,
    attachment: { lineId: LINE_ID, distanceM: 1143 }, version: 2, deleted: false };

describe('reverseBatch', () => {
    test('a line delete reverses to one batch restoring the line and its instruments at their tombstones', () => {
        const batch = lineDeleteBatch('del', LINE, [TAP]);
        const reverse = reverseBatch('undo', [LINE, TAP], batch, [{ entity: 'item', id: LINE_ID, version: 5 },
            { entity: 'item', id: PT1, version: 3 }]);
        expect(reverse).toEqual({ batchId: 'undo', ops: [
            { op: 'create', entity: 'item', id: LINE_ID, baseVersion: 5, data: { kind: 'line', name: 'L-SWD',
                geometry: LINE.geometry, properties: { diameter: 8 }, assetId: null, overrides: {}, ends: null,
                attachment: null } },
            { op: 'create', entity: 'item', id: PT1, baseVersion: 3, data: { kind: 'tap', name: 'PT-1',
                geometry: TAP.geometry, properties: {}, assetId: null, overrides: {}, ends: null,
                attachment: { lineId: LINE_ID, distanceM: 1143 } } }] });
    });

    test('a pad delete with the ends naming it cleared (entry 25) reverses to its restore, then the ends put back', () => {
        const PAD_ID = '66666666-6666-4666-8666-666666666666';
        const pad: MapItemRecord = { id: PAD_ID, kind: 'pad', name: 'CTB1', properties: { operator: 'Route 2' }, assetId: 'CTB1',
            geometry: { type: 'Point', coordinates: [-103.52, 31.92] }, overrides: {}, ends: null, attachment: null, version: 3, deleted: false };
        const snapped = { ...LINE, ends: { start: { itemId: PAD_ID } } };
        const batch = itemDeleteBatch('del', pad, [snapped, TAP, pad]);
        expect(batch.ops.map((op) => op.op + ' ' + op.id)).toEqual(['delete ' + PAD_ID, 'update ' + LINE_ID]);
        const reverse = reverseBatch('undo', [snapped, pad], batch, [{ entity: 'item', id: PAD_ID, version: 4 },
            { entity: 'item', id: LINE_ID, version: 5 }]);
        expect(reverse.ops).toEqual([
            { op: 'create', entity: 'item', id: PAD_ID, baseVersion: 4, data: { kind: 'pad', name: 'CTB1', geometry: pad.geometry,
                properties: { operator: 'Route 2' }, assetId: 'CTB1', overrides: {}, ends: null, attachment: null } },
            { op: 'update', entity: 'item', id: LINE_ID, baseVersion: 5, data: { ends: { start: { itemId: PAD_ID } } } }]);
    });

    test('an update reverses to the old values of the fields it changed, at the new version', () => {
        const reshaped = lineGeometryBatch('move', LINE, [[-103.52, 31.92], [-103.505, 31.9223], [-103.490423, 31.926]],
            [TAP]);
        const reverse = reverseBatch('undo', [LINE, TAP], reshaped, [{ entity: 'item', id: LINE_ID, version: 5 },
            { entity: 'item', id: PT1, version: 3 }]);
        expect(reverse.ops).toEqual([
            { op: 'update', entity: 'item', id: LINE_ID, baseVersion: 5, data: { geometry: LINE.geometry } },
            { op: 'update', entity: 'item', id: PT1, baseVersion: 3,
                data: { geometry: TAP.geometry, attachment: TAP.attachment } }]);
    });

    test('a create reverses to a delete at its saved version', () => {
        const batch = { batchId: 'c', ops: [{ op: 'create' as const, entity: 'item' as const, id: PT1, baseVersion: 0,
            data: { kind: 'tap', geometry: TAP.geometry } }] };
        expect(reverseBatch('undo', [], batch, [{ entity: 'item', id: PT1, version: 1 }]).ops)
            .toEqual([{ op: 'delete', entity: 'item', id: PT1, baseVersion: 1 }]);
    });

    test('what it cannot reverse is an error, never a wrong batch', () => {
        const del = lineDeleteBatch('d', LINE, []);
        expect(() => reverseBatch('u', [], del, [{ entity: 'item', id: LINE_ID, version: 5 }])).toThrow('before the delete');
        expect(() => reverseBatch('u', [LINE], del, [])).toThrow('no version');
        const setup = { batchId: 's', ops: [{ op: 'update' as const, entity: 'kindSetup' as const, id: 'pad',
            baseVersion: 1, data: {} }] };
        expect(() => reverseBatch('u', [], setup, [])).toThrow('map item ops only');
    });
});
