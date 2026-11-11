import {
    MESSAGE_VERSION,
    MessageTypes,
    editsHistory,
    tagsResolve,
    envelope,
    newMessageId,
    pointClick,
    popupClose,
    popupOpen,
    readReply,
    replyText
} from '../messages';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('envelope builder', () => {
    test('point.click carries the version, type, a uuid id and the point id', () => {
        const msg = pointClick('p1');
        expect(msg.v).toBe(MESSAGE_VERSION);
        expect(msg.type).toBe(MessageTypes.POINT_CLICK);
        expect(msg.id).toMatch(UUID);
        expect(msg.body).toEqual({ pointId: 'p1' });
    });

    test('an explicit id is kept', () => {
        expect(pointClick('p2', 'fixed-id').id).toBe('fixed-id');
    });

    test('ids are unique', () => {
        const ids = new Set(Array.from({ length: 50 }, () => newMessageId()));
        expect(ids.size).toBe(50);
    });

    test('envelope keeps the body as given', () => {
        expect(envelope('nope', { a: 1 }, 'x')).toEqual({ v: 1, type: 'nope', id: 'x', body: { a: 1 } });
    });

    test('popup.open and popup.close carry the item id (epic 3 entry 5)', () => {
        expect(popupOpen('p1', null, 'o')).toEqual({ v: 1, type: 'popup.open', id: 'o', body: { itemId: 'p1' } });
        // Epic 3 entry 2: a line's popup names the segment it opened at.
        expect(popupOpen('l1', { fromId: 'a', toId: 'b' }, 'o2'))
            .toEqual({ v: 1, type: 'popup.open', id: 'o2', body: { itemId: 'l1', segment: { fromId: 'a', toId: 'b' } } });
        expect(popupClose('p1', 'c')).toEqual({ v: 1, type: 'popup.close', id: 'c', body: { itemId: 'p1' } });
        const batch = readReply({ v: 1, type: 'values.batch', id: 'b', body: { seq: 2, full: false, items: [] } });
        expect(replyText(batch)).toBe('Live values: 0 map item(s) at seq 2');
    });
});

describe('reply handling', () => {
    test('a point.click.reply is read with its id and body', () => {
        const reply = readReply({
            v: 1, type: 'point.click.reply', id: 'abc',
            body: { pointId: 'p1', receivedAt: '2026-10-26T12:00:00Z' }
        });
        expect(reply).toEqual({
            kind: 'point.click.reply', id: 'abc',
            body: { pointId: 'p1', receivedAt: '2026-10-26T12:00:00Z' }
        });
        expect(replyText(reply)).toBe('Gateway received click on p1 at 2026-10-26T12:00:00Z');
    });

    test('an error reply is read with code and message', () => {
        const reply = readReply({
            v: 1, type: 'error', id: 'x', body: { code: 'invalid', message: 'Unknown message type: nope' }
        });
        expect(reply).toEqual({
            kind: 'error', id: 'x', body: { code: 'invalid', message: 'Unknown message type: nope' }
        });
        expect(replyText(reply)).toBe('Error (invalid): Unknown message type: nope');
    });

    test('a malformed reply is invalid, never a throw', () => {
        expect(readReply(null).kind).toBe('invalid');
        expect(readReply('text').kind).toBe('invalid');
        expect(readReply({ v: 2, type: 'error', id: 'x', body: {} }).kind).toBe('invalid');
        expect(readReply({ v: 1, type: 'error' }).kind).toBe('invalid');
        expect(readReply({ v: 1, type: 'point.click.reply', id: 'x', body: {} }).kind).toBe('invalid');
        expect(readReply({ v: 1, type: 'mystery', id: 'x', body: {} }).kind).toBe('invalid');
    });

    test('an error reply with a bare body still reads', () => {
        const reply = readReply({ v: 1, type: 'error', id: 'x' });
        expect(reply.kind).toBe('error');
        expect(replyText(reply)).toBe('Error (unknown): Unknown error.');
    });
});

describe('edits.history (epic-editing entry 11a)', () => {
    test('the request carries only what is given', () => {
        expect(editsHistory({}, 'h')).toEqual({ v: 1, type: 'edits.history', id: 'h', body: {} });
        expect(editsHistory({ before: 42, limit: 10 }, 'h2').body).toEqual({ before: 42, limit: 10 });
        expect(editsHistory(undefined, 'h3').body).toEqual({});
    });

    const page = {
        entries: [
            {
                seq: 9, batchId: 'b2', actor: 'sam', at: '2026-11-09T10:00:05Z', source: 'session',
                ops: [{ op: 'update', entity: 'item', id: 'p31', name: 'P31', kind: 'pad', version: 2,
                    before: { geometry: { type: 'Point', coordinates: [1, 2] } },
                    after: { geometry: { type: 'Point', coordinates: [1, 3] } } }]
            },
            {
                seq: 4, batchId: 'b1', actor: 'alex', at: '2026-11-09T09:00:00Z', source: 'script',
                ops: [{ op: 'delete', entity: 'item', id: 'l1', name: null, kind: null, version: 2, before: null, after: null }]
            },
            { seq: 3, batchId: 'b0', actor: 'alex', at: 'x', source: 'session', ops: [{ op: 'move', entity: 'item', id: 'q', version: 1 }] }
        ],
        more: true
    };

    test('a reply is read newest first, old rows with null values, an unreadable entry left out whole', () => {
        const reply = readReply({ v: 1, type: 'edits.history.reply', id: 'h', body: page });
        expect(reply.kind).toBe('edits.history.reply');
        if (reply.kind !== 'edits.history.reply') {
            return;
        }
        expect(reply.body.more).toBe(true);
        expect(reply.body.entries.map((e) => e.seq)).toEqual([9, 4]);
        expect(reply.body.entries[0].ops[0].after).toEqual({ geometry: { type: 'Point', coordinates: [1, 3] } });
        expect(reply.body.entries[1].source).toBe('script');
        expect(reply.body.entries[1].ops[0]).toEqual({ op: 'delete', entity: 'item', id: 'l1', name: null, kind: null,
            version: 2, before: null, after: null });
        expect(replyText(reply)).toBe('Recent changes: 2 change(s), more');
        expect(reply.body.nextBefore).toBe(3);
        expect(reply.body.unread).toBe(1);
    });

    test('a page whose only entry cannot be read still gives the next cursor and counts it', () => {
        const reply = readReply({ v: 1, type: 'edits.history.reply', id: 'h', body: { entries: [
            { seq: 12, batchId: 'b', actor: 'a', at: '2026-11-09T09:00:00Z', source: 'session',
                ops: [{ op: 'merge', entity: 'layer', id: 'x', version: 1 }] }], more: true } });
        expect(reply.kind).toBe('edits.history.reply');
        if (reply.kind !== 'edits.history.reply') {
            return;
        }
        expect(reply.body).toEqual({ entries: [], more: true, nextBefore: 12, unread: 1 });
    });

    test('a reply without entries or more is invalid', () => {
        expect(readReply({ v: 1, type: 'edits.history.reply', id: 'h', body: { entries: [] } }).kind).toBe('invalid');
        expect(readReply({ v: 1, type: 'edits.history.reply', id: 'h', body: { more: false } }).kind).toBe('invalid');
    });
});

describe('tags.resolve (epic 4 entry 12a, the Kinds screen\'s resolve notes)', () => {
    test('the message carries the kind, the asset and the path', () => {
        expect(tagsResolve({ kindId: 'pad', assetId: 'P14', path: '{asset.path}/Pressure' }, 'r1')).toEqual(
            { v: 1, type: 'tags.resolve', id: 'r1', body: { kindId: 'pad', assetId: 'P14', path: '{asset.path}/Pressure' } });
    });

    test('the reply is read with its counts, or without them for a full path; one without a path is invalid', () => {
        expect(readReply({ v: 1, type: 'tags.resolve.reply', id: 'r1', body: { path: '{asset.path}/Pressure', relative: true, n: 2, m: 3 } }))
            .toEqual({ kind: 'tags.resolve.reply', id: 'r1', body: { path: '{asset.path}/Pressure', relative: true, n: 2, m: 3 } });
        const full = readReply({ v: 1, type: 'tags.resolve.reply', id: 'r2', body: { path: '[default]Shared/GasPrice', relative: false } });
        expect(full).toEqual({ kind: 'tags.resolve.reply', id: 'r2', body: { path: '[default]Shared/GasPrice', relative: false } });
        expect(replyText(full)).toBe('Tag path [default]Shared/GasPrice: a full path');
        expect(readReply({ v: 1, type: 'tags.resolve.reply', id: 'r3', body: { relative: true } }).kind).toBe('invalid');
        // Entry 13a: the items a relative path fails for; a malformed entry is left out, a count that is not a number reads 0.
        expect(readReply({ v: 1, type: 'tags.resolve.reply', id: 'r4', body: { path: '{asset.path}/Pressure', relative: true, n: 4, m: 5,
            failing: [{ id: 'i15', name: 'P15' }], failingMore: 0 } }))
            .toEqual({ kind: 'tags.resolve.reply', id: 'r4', body: { path: '{asset.path}/Pressure', relative: true, n: 4, m: 5,
                failing: [{ id: 'i15', name: 'P15' }], failingMore: 0 } });
        const odd = readReply({ v: 1, type: 'tags.resolve.reply', id: 'r5', body: { path: '{asset.path}/X', relative: true, n: 0, m: 30,
            failing: [{ id: 'a', name: 'A' }, { id: 7, name: 'B' }, null, 'C'], failingMore: '10' } });
        expect(odd.kind === 'tags.resolve.reply' && odd.body.failing).toEqual([{ id: 'a', name: 'A' }]);
        expect(odd.kind === 'tags.resolve.reply' && odd.body.failingMore).toBe(0);
        const more = readReply({ v: 1, type: 'tags.resolve.reply', id: 'r6', body: { path: '{asset.path}/X', relative: true, n: 0, m: 30,
            failing: [{ id: 'a', name: 'A' }], failingMore: 29 } });
        expect(more.kind === 'tags.resolve.reply' && more.body.failingMore).toBe(29);
    });
});
