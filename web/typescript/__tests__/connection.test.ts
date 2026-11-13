import {
    CONNECTED, CONNECTION_POLL_MS, ConnectionWatch, NO_CONNECTION, RECONNECTING, clockTextAt as clockText, connectionChipText, connectionDetailText
} from '../connection';

const AT = new Date(2026, 10, 2, 14, 2, 30).getTime();

describe('the connection chip (owner review notes item 32)', () => {
    test('says nothing while live, the time the values are from while lost, and that none came before the first batch', () => {
        expect(connectionChipText(CONNECTED)).toBe('');
        expect(connectionDetailText(CONNECTED)).toBe('');
        expect(clockText(AT)).toBe('14:02');
        expect(clockText(new Date(2026, 0, 1, 9, 5).getTime())).toBe('09:05');
        expect(connectionChipText({ lost: true, frozen: true, valuesAt: AT })).toBe(NO_CONNECTION + ' - values from 14:02');
        expect(connectionChipText({ lost: true, frozen: true, valuesAt: null })).toBe(NO_CONNECTION + ' - no values yet');
        expect(connectionDetailText({ lost: true, frozen: true, valuesAt: AT })).toContain('the values shown are from 14:02');
        expect(connectionDetailText({ lost: true, frozen: true, valuesAt: AT })).toContain('shown as stale');
        // Back, with the reload's values still awaited: the chip stays and says so.
        expect(connectionChipText({ lost: false, frozen: true, valuesAt: AT })).toBe(RECONNECTING + ' - values from 14:02');
        expect(connectionDetailText({ lost: false, frozen: true, valuesAt: AT })).toContain('The Gateway is back');
        // Live again once a full batch replaced the frozen values.
        expect(connectionChipText({ lost: false, frozen: false, valuesAt: AT })).toBe('');
    });
});

describe('the connection watch', () => {
    test('calls onLost once when the client disconnects and onBack once when it is back; the first reading is at start', () => {
        let connected = true;
        const calls: string[] = [];
        const watch = new ConnectionWatch(() => connected, () => calls.push('lost'), () => calls.push('back'), 10);
        expect(CONNECTION_POLL_MS).toBe(1000);
        watch.check();
        expect(calls).toEqual([]);
        expect(watch.isLost()).toBe(false);
        connected = false;
        watch.check();
        watch.check();
        expect(calls).toEqual(['lost']);
        expect(watch.isLost()).toBe(true);
        connected = true;
        watch.check();
        watch.check();
        expect(calls).toEqual(['lost', 'back']);
        expect(watch.isLost()).toBe(false);
    });

    test('start reads at once and the timer keeps reading until stop', () => {
        jest.useFakeTimers();
        try {
            let connected = false;
            const calls: string[] = [];
            const watch = new ConnectionWatch(() => connected, () => calls.push('lost'), () => calls.push('back'), 10);
            watch.start();
            expect(calls).toEqual(['lost']);
            connected = true;
            jest.advanceTimersByTime(25);
            expect(calls).toEqual(['lost', 'back']);
            watch.stop();
            connected = false;
            jest.advanceTimersByTime(50);
            expect(calls).toEqual(['lost', 'back']);
            // A second start does not double the timer.
            watch.start();
            watch.start();
            expect(calls).toEqual(['lost', 'back', 'lost']);
            watch.stop();
        } finally {
            jest.useRealTimers();
        }
    });
});
