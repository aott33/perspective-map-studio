import { CONTRACT_VERSION, ErrorCodes, readEditsApplyReply, readMapItem, readMapLoadReply } from '../contract';
import { MessageTypes, editsApply, mapLoad, readReply } from '../messages';

const ITEM = {
    id: '6f1c2a8e-3b5d-4c7e-9f10-2a3b4c5d6e7f',
    kind: 'line',
    name: 'Line 12:00:00',
    geometry: { type: 'LineString', coordinates: [[-104.99, 39.74], [-104.98, 39.75]] },
    properties: {},
    assetId: null,
    overrides: {},
    ends: null,
    version: 1,
    deleted: false
};

describe('the 0.2.0 draft contract', () => {
    test('version, codes and types match common/', () => {
        expect(CONTRACT_VERSION).toBe('0.2.0-draft');
        expect(Object.values(ErrorCodes).sort()).toEqual(['conflict', 'invalid', 'role', 'stale', 'store-unreachable']);
        expect(MessageTypes.MAP_LOAD).toBe('map.load');
        expect(MessageTypes.EDITS_APPLY).toBe('edits.apply');
        expect(MessageTypes.MAP_CHANGED).toBe('map.changed');
    });

    test('map.load and edits.apply envelopes', () => {
        expect(mapLoad('m1')).toEqual({ v: 1, type: 'map.load', id: 'm1', body: {} });
        const batch = { batchId: 'b', ops: [] };
        expect(editsApply(batch, 'e1')).toEqual({ v: 1, type: 'edits.apply', id: 'e1', body: batch });
    });

    test('a map item record is read, and a malformed one is not', () => {
        expect(readMapItem(ITEM)).toEqual(ITEM);
        expect(readMapItem({ ...ITEM, geometry: { type: 'Polygon', coordinates: [] } })).toBeNull();
        expect(readMapItem({ ...ITEM, version: '1' })).toBeNull();
        expect(readMapItem(null)).toBeNull();
    });

    test('map.load.reply carries the level, seq and items', () => {
        const reply = readReply({ v: 1, type: 'map.load.reply', id: 'm1', body: { level: 'full', seq: 3, items: [ITEM, { bad: 1 }] } });
        expect(reply).toEqual({ kind: 'map.load.reply', id: 'm1', body: { level: 'full', seq: 3, items: [ITEM],
            lists: { kinds: [], assets: null, adapters: null } } });
        expect(readMapLoadReply({ level: 'admin', seq: 1, items: [] })).toBeNull();
        expect(readReply({ v: 1, type: 'map.load.reply', id: 'm1', body: {} }).kind).toBe('invalid');
    });

    test('edits.apply.reply carries the batch, seq and versions', () => {
        const body = { batchId: 'b1', seq: 4, results: [{ entity: 'item', id: ITEM.id, version: 1 }] };
        expect(readReply({ v: 1, type: 'edits.apply.reply', id: 'e1', body })).toEqual({ kind: 'edits.apply.reply', id: 'e1', body });
        expect(readEditsApplyReply({ batchId: 'b1', seq: 4, results: [{ id: 'x' }] })).toBeNull();
    });

    test('an error naming the batch and the op keeps them', () => {
        const reply = readReply({
            v: 1, type: 'error', id: 'e1',
            body: { code: 'conflict', message: 'changed', batchId: 'b1', op: { index: 1, id: ITEM.id } }
        });
        expect(reply).toEqual({
            kind: 'error', id: 'e1',
            body: { code: 'conflict', message: 'changed', batchId: 'b1', op: { index: 1, id: ITEM.id } }
        });
    });
});
