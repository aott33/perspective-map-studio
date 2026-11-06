// A failed map.load's words held across the 15 s retries (epic 4 entry 24, the review's no-blink rule): the delegate keeps
// the failed load's code and sentence while each retry loads, so the problem it says (the busy answer included, which leaves
// the store state alone) never blinks, and drops them once a load succeeds. Perspective's base class is stood in for, as in
// undoRun.test.ts.

jest.mock('@inductiveautomation/perspective-client', () => ({
    ComponentStoreDelegate: class {
        component: unknown;
        fired: unknown[] = [];

        constructor(component: unknown) {
            this.component = component;
        }

        notify(): void {
            // The component's redraw; nothing to draw here.
        }

        fireEvent(_name: string, message: unknown): void {
            this.fired.push(message);
        }
    }
}), { virtual: true });

import { AbstractUIElementStore } from '@inductiveautomation/perspective-client';
import { MESSAGE_EVENT, MessageTypes } from '../messages';
import { MapStudioStoreDelegate } from '../MapStudioStoreDelegate';
import { storeProblem } from '../problems';
import { REPLAY_INTERVAL_MS } from '../unsaved';

const BUSY = 'Map Studio is busy with other map requests; nothing was saved. Try again in a moment.';

let delegate: MapStudioStoreDelegate;

/** The last map.load the delegate fired. */
function lastLoad(): { id: string } {
    const loads = ((delegate as unknown as { fired: Array<{ id: string; type: string }> }).fired).filter((m) => m.type === MessageTypes.MAP_LOAD);
    return loads[loads.length - 1];
}

function problemNow(): string {
    const state = delegate.mapStateToProps();
    const p = storeProblem({ ...state, level: state.level, unsaved: [], sending: [], storageWarning: '' });
    return p ? p.text : '';
}

beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    delegate = new MapStudioStoreDelegate({} as unknown as AbstractUIElementStore);
});

afterEach(() => {
    delegate.stopReplay();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

test('the busy answer to a load: its words stay while each 15 s retry loads, and go once a load succeeds', () => {
    delegate.sendMapLoad();
    expect(delegate.mapStateToProps().load).toEqual({ state: 'loading', message: '' });
    expect(problemNow()).toBe('');
    delegate.handleEvent(MESSAGE_EVENT, { v: 1, type: MessageTypes.ERROR, id: lastLoad().id, body: { code: 'store-unreachable', message: BUSY } });
    expect(delegate.mapStateToProps().load).toEqual({ state: 'failed', message: 'store-unreachable: ' + BUSY });
    expect(delegate.mapStateToProps().store.status).toBe('unknown');
    expect(problemNow()).toBe('Map store: ' + BUSY);

    // The retry loads: the same words, no gap.
    const first = lastLoad().id;
    jest.advanceTimersByTime(REPLAY_INTERVAL_MS);
    expect(lastLoad().id).not.toBe(first);
    expect(delegate.mapStateToProps().load).toEqual({ state: 'loading', message: 'store-unreachable: ' + BUSY });
    expect(problemNow()).toBe('Map store: ' + BUSY);

    // It loads: nothing to say.
    delegate.handleEvent(MESSAGE_EVENT, { v: 1, type: MessageTypes.MAP_LOAD_REPLY, id: lastLoad().id, body: { level: 'full', seq: 0, items: [] } });
    expect(delegate.mapStateToProps().load).toEqual({ state: 'loaded', message: '' });
    expect(problemNow()).toBe('');
});
