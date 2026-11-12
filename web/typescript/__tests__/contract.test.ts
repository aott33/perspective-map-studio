import {
    CONTRACT_VERSION, ErrorCodes, readConflicts, readEditsApplyReply, readKindSetup, readMapItem, readMapLoadReply,
    readEditsHistoryReply, readMapSetup, readUnitsData, readUnitsSetting
} from '../contract';
import { NO_HOST_LISTS } from '../adapters';
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
    attachment: null,
    version: 1,
    deleted: false
};

describe('the 0.4.0 contract (0.3.0 plus epic 4 entry 2)', () => {
    test('version, codes and types match common/', () => {
        expect(CONTRACT_VERSION).toBe('0.4.0');
        expect(MessageTypes.VALUES_BATCH).toBe('values.batch');
        expect(MessageTypes.POPUP_OPEN).toBe('popup.open');
        expect(MessageTypes.POPUP_CLOSE).toBe('popup.close');
        expect(Object.values(ErrorCodes).sort()).toEqual(['conflict', 'invalid', 'read-only', 'role', 'stale', 'store-unreachable', 'tags-unavailable']);
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

    test('an instrument carries its attachment; a missing or malformed one reads as null (epic 2 story 14)', () => {
        const attachment = { lineId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', distanceM: 1143 };
        const tap = { ...ITEM, kind: 'tap', geometry: { type: 'Point', coordinates: [-103.508, 31.9204] }, attachment };
        expect(readMapItem(tap)).toEqual(tap);
        const { attachment: _gone, ...older } = ITEM;
        expect(readMapItem(older)?.attachment).toBeNull();
        expect(readMapItem({ ...tap, attachment: { lineId: 7, distanceM: 1 } })?.attachment).toBeNull();
        expect(readMapItem({ ...tap, attachment: { lineId: 'x', distanceM: -1 } })?.attachment).toBeNull();
        expect(readMapItem({ ...tap, attachment: { lineId: 'x', distanceM: Infinity } })?.attachment).toBeNull();
    });

    test('map.load.reply carries the level, seq and items', () => {
        const reply = readReply({ v: 1, type: 'map.load.reply', id: 'm1', body: { level: 'full', seq: 3, items: [ITEM, { bad: 1 }] } });
        expect(reply).toEqual({ kind: 'map.load.reply', id: 'm1', body: { level: 'full', seq: 3, items: [ITEM],
            lists: { kinds: [], assets: null, assetNames: [], adapters: null } } });
        // Epic 2 story 8: the session user, at phone and full; an empty or non-string one is left out.
        expect(readMapLoadReply({ level: 'full', seq: 1, items: [], user: 'mapeditor' })!.user).toBe('mapeditor');
        expect(readMapLoadReply({ level: 'full', seq: 1, items: [], user: '' })!.user).toBeUndefined();
        expect(readMapLoadReply({ level: 'full', seq: 1, items: [], user: 7 })!.user).toBeUndefined();
        expect(readMapLoadReply({ level: 'admin', seq: 1, items: [] })).toBeNull();
        expect(readReply({ v: 1, type: 'map.load.reply', id: 'm1', body: {} }).kind).toBe('invalid');
    });

    test('map.load.reply may carry the part of the setup the browser needs (epic 2 entry 6)', () => {
        const setup = { refreshIntervalSeconds: 30, basemaps: ['none', 'osm'], alarmPage: '/alarms' };
        expect(readMapLoadReply({ level: 'phone', seq: 2, items: [], setup }))
            .toEqual({ level: 'phone', seq: 2, items: [], lists: NO_HOST_LISTS, setup: { ...setup, units: 'auto' } });
        // Absent (an older Gateway) or malformed: the reply stays usable, without setup.
        expect(readMapLoadReply({ level: 'full', seq: 0, items: [] })).toEqual({ level: 'full', seq: 0, items: [], lists: NO_HOST_LISTS });
        expect(readMapLoadReply({ level: 'full', seq: 0, items: [], setup: { refreshIntervalSeconds: 'ten' } }))
            .toEqual({ level: 'full', seq: 0, items: [], lists: NO_HOST_LISTS });
        expect(readMapSetup({ ...setup, refreshIntervalSeconds: 0 })).toBeNull();
        expect(readMapSetup({ ...setup, refreshIntervalSeconds: 2.5 })).toBeNull();
        expect(readMapSetup({ ...setup, basemaps: [1] })).toBeNull();
        expect(readMapSetup({ ...setup, alarmPage: null })).toBeNull();
        expect(readMapSetup(null)).toBeNull();
    });

    test('the setup carries the project\'s units; absent or unknown reads as auto (epic 4 entry 19a)', () => {
        const setup = { refreshIntervalSeconds: 10, basemaps: ['osm'], alarmPage: '' };
        expect(readMapSetup({ ...setup, units: 'metric' })?.units).toBe('metric');
        expect(readMapSetup({ ...setup, units: 'us' })?.units).toBe('us');
        expect(readMapSetup({ ...setup, units: 'auto' })?.units).toBe('auto');
        // An older Gateway sends none; a value this browser does not know never breaks the setup.
        expect(readMapSetup(setup)?.units).toBe('auto');
        expect(readMapSetup({ ...setup, units: 'imperial' })?.units).toBe('auto');
        expect(readMapSetup({ ...setup, units: 2 })?.units).toBe('auto');
        expect(readMapLoadReply({ level: 'none', seq: 0, items: [], setup: { ...setup, units: 'us' } })?.setup?.units).toBe('us');
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

describe('kind setups (epic 2 story 9)', () => {
    const pad = { kindId: 'pad', setup: { link: '/pad/{item.name}' }, version: 2, deleted: false };

    test('map.load.reply carries them for editors and leaves malformed ones out', () => {
        const reply = readMapLoadReply({ level: 'full', seq: 3, items: [], kindSetups: [pad, { kindId: 'x' }] });
        expect(reply?.kindSetups).toEqual([pad]);
        expect(readMapLoadReply({ level: 'none', seq: 3, items: [] })?.kindSetups).toBeUndefined();
    });

    test('a conflict on a kind setup reads its stored record', () => {
        const [c] = readConflicts([{ index: 0, entity: 'kindSetup', id: 'pad', baseVersion: 1, current: pad,
            changedBy: 'mapeditor', changedAt: '2026-10-27T10:00:00Z' }]);
        expect(c.current).toEqual(pad);
        expect(readKindSetup({ kindId: 'pad', setup: [], version: 1, deleted: false })).toBeNull();
    });
});

describe('the units override (epic 4 entry 19b)', () => {
    const units = { id: 'units', system: 'us', labels: 'long', version: 2, deleted: false };

    test('map.load.reply carries the live override at every level; {} and an older Gateway read as none', () => {
        for (const level of ['none', 'phone', 'full']) {
            const reply = readMapLoadReply({ level, seq: 3, items: [], settings: { units: { id: 'units', system: 'us', labels: 'long', version: 2 } } });
            expect(reply?.units).toEqual(units);
        }
        expect(readMapLoadReply({ level: 'none', seq: 3, items: [], settings: {} })?.units).toBeUndefined();
        expect(readMapLoadReply({ level: 'none', seq: 3, items: [] })?.units).toBeUndefined();
        // A malformed one, or another id, leaves the reply usable.
        const odd = readMapLoadReply({ level: 'full', seq: 3, items: [], settings: { units: { ...units, system: 'imperial' }, theme: { id: 'theme' } } });
        expect(odd).not.toBeNull();
        expect(odd?.units).toBeUndefined();
        // A tombstone is no override.
        expect(readMapLoadReply({ level: 'full', seq: 3, items: [], settings: { units: { ...units, deleted: true } } })?.units).toBeUndefined();
    });

    test('the record and its data are read strictly', () => {
        expect(readUnitsSetting(units)).toEqual(units);
        expect(readUnitsSetting({ ...units, deleted: true })?.deleted).toBe(true);
        expect(readUnitsSetting({ ...units, id: 'theme' })).toBeNull();
        expect(readUnitsSetting({ ...units, labels: 'tiny' })).toBeNull();
        expect(readUnitsSetting({ ...units, version: '2' })).toBeNull();
        expect(readUnitsData({ system: 'auto', labels: 'short' })).toEqual({ system: 'auto', labels: 'short' });
        expect(readUnitsData({ system: 'auto' })).toBeNull();
        expect(readUnitsData(null)).toBeNull();
    });

    test('a conflict on the units setting reads its stored record', () => {
        const [c] = readConflicts([{ index: 0, entity: 'settings', id: 'units', baseVersion: 1, current: units,
            changedBy: 'mapeditor', changedAt: '2026-11-12T10:00:00Z' }]);
        expect(c.entity).toBe('settings');
        expect(c.current).toEqual(units);
    });

    test('edits.history reads a settings op, not as an unread entry', () => {
        const page = readEditsHistoryReply({ more: false, entries: [{ seq: 9, batchId: 'b9', actor: 'mapeditor', at: '2026-11-12T10:00:00Z',
            source: 'session', ops: [{ op: 'update', entity: 'settings', id: 'units', name: null, kind: 'units', version: 2,
                before: { system: 'us', labels: 'long' }, after: { system: 'metric', labels: 'short' } }] }] });
        expect(page?.unread).toBe(0);
        expect(page?.entries[0].ops[0]).toMatchObject({ entity: 'settings', id: 'units', kind: 'units', name: null, version: 2 });
    });
});
