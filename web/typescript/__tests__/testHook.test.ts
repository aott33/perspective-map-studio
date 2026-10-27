import { TEST_REPLY_TIMEOUT_MS, makeTestHook, registerTestHook, takeTestReply } from '../testHook';
import { Envelope } from '../messages';

describe('the e2e test hook', () => {
    test('a send fires one envelope and resolves with the reply of the same id', async () => {
        const sent: Envelope<Record<string, unknown>>[] = [];
        const hook = makeTestHook((m) => sent.push(m));
        const reply = hook.send('edits.apply', { batchId: 'b', ops: [] });
        expect(sent).toHaveLength(1);
        expect(sent[0]).toMatchObject({ v: 1, type: 'edits.apply', body: { batchId: 'b', ops: [] } });
        expect(takeTestReply({ v: 1, type: 'edits.apply.reply', id: 'someone-else', body: {} })).toBe(false);
        const answer = { v: 1, type: 'edits.apply.reply', id: sent[0].id, body: { batchId: 'b', seq: 3, results: [] } };
        expect(takeTestReply(answer)).toBe(true);
        await expect(reply).resolves.toEqual(answer);
        expect(takeTestReply(answer)).toBe(false);
    });

    test('only map.load and edits.apply can be sent', async () => {
        const hook = makeTestHook(() => undefined);
        await expect(hook.send('point.click', {})).rejects.toThrow('sends only');
    });

    test('a send without a reply fails after the timeout', async () => {
        jest.useFakeTimers();
        try {
            const reply = makeTestHook(() => undefined).send('map.load', {});
            jest.advanceTimersByTime(TEST_REPLY_TIMEOUT_MS + 1);
            await expect(reply).rejects.toThrow('No reply');
        } finally {
            jest.useRealTimers();
        }
    });

    test('registering outside a browser does nothing, and non-envelopes are not taken', () => {
        expect(() => registerTestHook(() => undefined)).not.toThrow();
        expect(takeTestReply(null)).toBe(false);
        expect(takeTestReply({ id: 5 })).toBe(false);
    });
});
