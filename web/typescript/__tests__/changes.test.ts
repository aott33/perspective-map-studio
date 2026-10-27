import { CHANGES_INITIAL, ChangeState, MapChanges, MapChangedBody, applyRecord, onChanged, onLoad, readMapChanged } from '../changes';
import { NO_HOST_LISTS } from '../adapters';
import { MapItemRecord, MapLoadReplyBody } from '../contract';
import { readReply } from '../messages';

function item(id: string, version = 1, deleted = false, name = id): MapItemRecord {
    return {
        id, kind: 'line', name, version, deleted, properties: {}, assetId: null, overrides: {}, ends: null,
        geometry: { type: 'LineString', coordinates: [[-104.99, 39.74], [-104.98, 39.75]] }
    };
}

function changed(seq: number, ...records: MapItemRecord[]): MapChangedBody {
    return {
        seq, batchId: 'b' + seq, actor: 'mapeditor',
        ops: records.map((r) => ({ op: r.version === 1 ? 'create' : 'update', entity: 'item', id: r.id, version: r.version, record: r }))
    };
}

function loadReply(seq: number, items: MapItemRecord[] = []): MapLoadReplyBody {
    return { level: 'none', seq, items, lists: NO_HOST_LISTS };
}

function loadedAt(seq: number, items: MapItemRecord[] = []): ChangeState {
    return onLoad(CHANGES_INITIAL, loadReply(seq, items)).state;
}

describe('map.changed on a loaded map', () => {
    test('the next seq is applied: a saved line appears and seq advances', () => {
        const s = onChanged(loadedAt(4), changed(5, item('L1')));
        expect(s.action).toBe('apply');
        expect(s.state.seq).toBe(5);
        expect(s.state.items.map((i) => i.id)).toEqual(['L1']);
    });

    test('a seq at or below the current one is ignored', () => {
        const state = loadedAt(5, [item('L1')]);
        expect(onChanged(state, changed(5, item('L2'))).action).toBe('ignore');
        expect(onChanged(state, changed(3, item('L2'))).state).toBe(state);
    });

    test('a record whose version is not above the drawn one changes nothing (repeated or self-sent)', () => {
        const state = loadedAt(5, [item('L1', 2, false, 'drawn')]);
        const s = onChanged(state, changed(6, item('L1', 2, false, 'again')));
        expect(s.action).toBe('apply');
        expect(s.state.seq).toBe(6);
        expect(s.state.items).toEqual([item('L1', 2, false, 'drawn')]);
        expect(onChanged(state, changed(6, item('L1', 3, false, 'newer'))).state.items[0].name).toBe('newer');
    });

    test('a tombstone removes the item', () => {
        expect(applyRecord([item('L1'), item('L2')], item('L1', 2, true)).map((i) => i.id)).toEqual(['L2']);
    });

    test('a gap asks for a reload and buffers until the reply', () => {
        const s = onChanged(loadedAt(5), changed(7, item('L7')));
        expect(s.action).toBe('reload');
        expect(s.state.loaded).toBe(false);
        expect(s.state.buffer.map((b) => b.seq)).toEqual([7]);
        // Changes during the reload are buffered, not a second reload.
        const s2 = onChanged(s.state, changed(8, item('L8')));
        expect(s2.action).toBe('ignore');
        expect(s2.state.buffer.map((b) => b.seq)).toEqual([7, 8]);
    });

    test('an unreadable map.changed counts as a gap', () => {
        expect(onChanged(loadedAt(5), null).action).toBe('reload');
    });

    test('a kindSetup op advances seq and draws nothing', () => {
        const body: MapChangedBody = {
            seq: 6, batchId: 'k', actor: 'a',
            ops: [{ op: 'create', entity: 'kindSetup', id: 'pad', version: 1, record: { kindId: 'pad', setup: {}, version: 1, deleted: false } }]
        };
        const state = loadedAt(5, [item('L1')]);
        const s = onChanged(state, body);
        expect(s.state.seq).toBe(6);
        expect(s.state.items).toBe(state.items);
    });
});

describe('map.changed before the map.load reply', () => {
    test('held, then the events above the loaded seq are applied in order', () => {
        let state = CHANGES_INITIAL;
        state = onChanged(state, changed(7, item('L7'))).state;
        state = onChanged(state, changed(5, item('L5'))).state;
        state = onChanged(state, changed(6, item('L6'))).state;
        expect(state.loaded).toBe(false);
        const s = onLoad(state, loadReply(5, [item('L5')]));
        expect(s.action).toBe('apply');
        expect(s.state.seq).toBe(7);
        expect(s.state.items.map((i) => i.id)).toEqual(['L5', 'L6', 'L7']);
    });

    test('a gap among the held events asks for one more reload', () => {
        let state = onChanged(CHANGES_INITIAL, changed(9, item('L9'))).state;
        const s = onLoad(state, loadReply(5));
        expect(s.action).toBe('reload');
        expect(s.state.buffer.map((b) => b.seq)).toEqual([9]);
        state = s.state;
        expect(onLoad(state, loadReply(9, [item('L9')])).state.seq).toBe(9);
    });

    test('an unreadable event while loading reloads once after the reply', () => {
        const state = onChanged(CHANGES_INITIAL, null).state;
        expect(onLoad(state, loadReply(5)).action).toBe('reload');
    });
});

describe('reading map.changed', () => {
    const record = item('00000000-0000-4000-8000-000000000001');

    test('readReply gives the body with its records', () => {
        const reply = readReply({ v: 1, type: 'map.changed', id: 'm1', body: changed(5, record) });
        expect(reply.kind).toBe('map.changed');
        if (reply.kind === 'map.changed') {
            expect(reply.body).toEqual(changed(5, record));
        }
    });

    test('missing seq or ops, or a bad item record, is unreadable', () => {
        expect(readMapChanged({ ops: [] })).toBeNull();
        expect(readMapChanged({ seq: 5 })).toBeNull();
        expect(readMapChanged({ seq: 5, ops: [{ op: 'create', entity: 'item', id: 'x', version: 1, record: { id: 'x' } }] })).toBeNull();
        const reply = readReply({ v: 1, type: 'map.changed', id: 'm2', body: {} });
        expect(reply).toEqual({ kind: 'map.changed', id: 'm2', body: null });
    });
});

describe('the store delegate\'s change handling (MapChanges)', () => {
    test('a skipped seq sends map.load once and counts one reload', () => {
        const sent: string[] = [];
        const changes = new MapChanges(() => sent.push('map.load'));
        changes.load();
        expect(changes.seq).toBeNull();
        changes.loaded(loadReply(5));
        expect(sent).toEqual(['map.load']);
        expect(changes.changed(changed(6, item('L6')))).toBe(true);
        expect(changes.seq).toBe(6);
        expect(changes.changed(changed(8, item('L8')))).toBe(false);
        expect(sent).toEqual(['map.load', 'map.load']);
        expect(changes.reloads).toBe(1);
        // No second map.load while one is pending, even on another gap.
        changes.changed(null);
        changes.changed(changed(11, item('L11')));
        expect(sent.length).toBe(2);
        changes.loaded(loadReply(8, [item('L6'), item('L8')]));
        expect(changes.reloads).toBe(2);
        expect(sent.length).toBe(3);
        changes.loaded(loadReply(11, [item('L6'), item('L8'), item('L11')]));
        expect(changes.reloads).toBe(2);
        expect(changes.seq).toBe(11);
        expect(changes.state.items.length).toBe(3);
    });

    test('an own save adds its record without touching seq; its own map.changed then changes nothing', () => {
        const changes = new MapChanges(() => {});
        changes.load();
        changes.loaded(loadReply(4));
        expect(changes.saved(item('L5'))).toBe(true);
        expect(changes.seq).toBe(4);
        changes.changed(changed(5, item('L5')));
        expect(changes.seq).toBe(5);
        expect(changes.state.items.length).toBe(1);
    });

    test('a failed map.load leaves the map not loaded; the next change retries the load once', () => {
        const sent: number[] = [];
        const changes = new MapChanges(() => sent.push(1));
        changes.load();
        changes.loadFailed();
        changes.changed(changed(3, item('L3')));
        expect(changes.state.buffer.length).toBe(1);
        expect(sent.length).toBe(2);
        changes.changed(changed(4, item('L4')));
        expect(sent.length).toBe(2);
        changes.loaded(loadReply(2));
        expect(changes.seq).toBe(4);
        expect(changes.state.items.length).toBe(2);
    });

    test('a gap reload refused as busy is retried at the next change, not left stale', () => {
        const sent: number[] = [];
        const changes = new MapChanges(() => sent.push(1));
        changes.load();
        changes.loaded(loadReply(5));
        changes.changed(changed(7, item('L7')));
        expect(sent.length).toBe(2);
        changes.loadFailed();
        changes.changed(changed(8, item('L8')));
        expect(sent.length).toBe(3);
        expect(changes.reloads).toBe(2);
        changes.loaded(loadReply(6));
        expect(changes.seq).toBe(8);
        expect(changes.state.loaded).toBe(true);
    });
});
