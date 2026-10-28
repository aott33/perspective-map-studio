/**
 * A test hook for the e2e suite (epic 2 story 2): `window.__mapStudioTest.send(type, body)`
 * sends one `map.load` or `edits.apply` through this component's real session path and
 * resolves with the Gateway's reply envelope. It adds no right: the Gateway decides
 * every save from the session user's roles, exactly as for the component's own messages,
 * so it is always registered (owner decision, 2026-10-26). Not part of the public contract.
 */

import { Envelope, MessageTypes, envelope } from './messages';

/** How long a test send waits for its reply. */
export const TEST_REPLY_TIMEOUT_MS = 30_000;

/** The message types the hook may send. */
export const TEST_HOOK_TYPES: readonly string[] = [
    MessageTypes.MAP_LOAD, MessageTypes.EDITS_APPLY, MessageTypes.TAGS_BROWSE, MessageTypes.TAGS_RESOLVE
];

export interface MapStudioTestHook {
    send(type: string, body: Record<string, unknown>): Promise<Envelope>;
}

type Fire = (message: Envelope<Record<string, unknown>>) => void;

interface Pending {
    resolve: (reply: Envelope) => void;
    timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, Pending>();

/** The hook that sends through `fire`; also what registerTestHook puts on the window. */
export function makeTestHook(fire: Fire): MapStudioTestHook {
    return {
        send(type: string, body: Record<string, unknown>): Promise<Envelope> {
            if (!TEST_HOOK_TYPES.includes(type)) {
                return Promise.reject(new Error('The test hook sends only ' + TEST_HOOK_TYPES.join(' and ') + '.'));
            }
            const message = envelope(type, body);
            return new Promise<Envelope>((resolve, reject) => {
                const timer = setTimeout(() => {
                    pending.delete(message.id);
                    reject(new Error('No reply to test message ' + message.id + ' within ' + TEST_REPLY_TIMEOUT_MS + ' ms.'));
                }, TEST_REPLY_TIMEOUT_MS);
                pending.set(message.id, { resolve, timer });
                fire(message);
            });
        }
    };
}

/** Put the hook on `window.__mapStudioTest` for the component that registers last. */
export function registerTestHook(fire: Fire): void {
    if (typeof window !== 'undefined') {
        (window as unknown as { __mapStudioTest?: MapStudioTestHook }).__mapStudioTest = makeTestHook(fire);
    }
}

/** A view the e2e suite may ask for: the map's centre and zoom (epic 3 entry 7, the label checks). */
export interface TestView {
    center: [number, number];
    zoom: number;
}

/**
 * Put `window.__mapStudioTestView(view)` up for the e2e suite (epic 3 entry 7): it moves the map
 * that registered last to a centre and zoom, as a user's pan and zoom would, so a spec can check the
 * labels at a zoom without a handle on the map. It changes no data and is not part of the contract.
 */
export function registerTestView(jump: (view: TestView) => void): void {
    if (typeof window !== 'undefined') {
        (window as unknown as { __mapStudioTestView?: (view: TestView) => void }).__mapStudioTestView = (view) => {
            if (view && Array.isArray(view.center) && view.center.length === 2 && typeof view.zoom === 'number') {
                jump({ center: [Number(view.center[0]), Number(view.center[1])], zoom: view.zoom });
            }
        };
    }
}

/**
 * Hand an inbound envelope to the test send waiting for it; true when one was waiting
 * (the component then ignores it), false otherwise.
 */
export function takeTestReply(raw: unknown): boolean {
    if (typeof raw !== 'object' || raw === null) {
        return false;
    }
    const id = (raw as { id?: unknown }).id;
    if (typeof id !== 'string') {
        return false;
    }
    const waiting = pending.get(id);
    if (!waiting) {
        return false;
    }
    pending.delete(id);
    clearTimeout(waiting.timer);
    waiting.resolve(raw as Envelope);
    return true;
}
