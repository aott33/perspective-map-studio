import { CONTRACT_VERSION, ErrorCodes, readConflicts, readEditsApplyReply, readMapItem, readMapLoadReply } from '../contract';
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
        expect(Object.values(ErrorCodes).sort()).toEqual(['conflict', 'invalid', 'read-only', 'role', 'stale', 'store-unreachable']);
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

describe('conflicts (epic 2 story 2)', () => {
    test('a conflict error carries every stale op with the stored record and who changed it', () => {
        const reply = readReply({
            v: 1, type: 'error', id: 'e1', body: {
                code: 'conflict', message: 'P12 was changed by alex at 14:02 UTC since you loaded it. Nothing in this save was written.',
                batchId: 'b1', op: { index: 0, id: ITEM.id },
                conflicts: [
                    { index: 0, entity: 'item', id: ITEM.id, baseVersion: 1, current: { ...ITEM, version: 2 },
                        changedBy: 'alex', changedAt: '2026-10-26T14:02:00Z' },
                    { index: 2, entity: 'item', id: 'x', baseVersion: 3, current: { ...ITEM, id: 'x', deleted: true, version: 4 },
                        changedBy: null, changedAt: null },
                    { bad: true }
                ]
            }
        });
        expect(reply.kind).toBe('error');
        if (reply.kind !== 'error') return;
        const conflicts = reply.body.conflicts ?? [];
        expect(conflicts).toHaveLength(2);
        expect(conflicts[0]).toEqual({ index: 0, entity: 'item', id: ITEM.id, baseVersion: 1,
            current: { ...ITEM, version: 2 }, changedBy: 'alex', changedAt: '2026-10-26T14:02:00Z' });
        expect(conflicts[1].current?.deleted).toBe(true);
        expect(conflicts[1].changedBy).toBeNull();
    });

    test('an error without conflicts has none, and malformed conflicts read as empty', () => {
        const role = readReply({ v: 1, type: 'error', id: 'e', body: { code: 'role', message: 'no' } });
        expect(role.kind === 'error' && role.body.conflicts).toBe(undefined);
        expect(readConflicts('nope')).toEqual([]);
    });
});
