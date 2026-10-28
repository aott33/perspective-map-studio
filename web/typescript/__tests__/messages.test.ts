import {
    MESSAGE_VERSION,
    MessageTypes,
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
        expect(popupOpen('p1', 'o')).toEqual({ v: 1, type: 'popup.open', id: 'o', body: { itemId: 'p1' } });
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
