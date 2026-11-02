/**
 * The map's connection to the Gateway (owner review notes item 32; AD-6): while the Perspective client
 * is disconnected the map must never read as live. The delegate keeps a ConnectionState (lost or not,
 * and the time of the last values.batch), the component shows a status chip in words ("No connection -
 * values from 14:02"), every value is drawn stale (live.ts freezeLive) and the Needs you summary says
 * the state is unknown (needsyou.ts); on reconnect the map sends map.load again, and the Gateway's full
 * batch replaces the frozen values. The watch polls the client's connection flag (a Perspective client
 * store field, read by the delegate) once a second: a batch cadence cannot tell, since the Gateway
 * sends a batch only while something changed. Pure except the timer; unit tested in node.
 */

export interface ConnectionState {
    /** The Perspective client is not connected to the Gateway. */
    lost: boolean;
    /**
     * The values shown are the frozen ones: from the loss until the first full batch after the
     * reconnect replaces them (the chip stays meanwhile, and the Needs you state stays unknown).
     */
    frozen: boolean;
    /** When the last values.batch arrived (epoch ms), or null before the first. */
    valuesAt: number | null;
}

export const CONNECTED: ConnectionState = { lost: false, frozen: false, valuesAt: null };

/** How often the client's connection flag is read. */
export const CONNECTION_POLL_MS = 1000;

/** The chip's first words. */
export const NO_CONNECTION = 'No connection';

/** "14:02" in the browser's local time, two digits each. */
export function clockText(epochMs: number): string {
    const d = new Date(epochMs);
    const two = (n: number): string => (n < 10 ? '0' : '') + n;
    return two(d.getHours()) + ':' + two(d.getMinutes());
}

/** The chip's first words once the connection is back and the reload's values are awaited. */
export const RECONNECTING = 'Reconnected, reloading';

/** The status chip's words: the time the values are from, or that none came; '' while live. */
export function connectionChipText(state: ConnectionState): string {
    if (!state.lost && !state.frozen) {
        return '';
    }
    const head = state.lost ? NO_CONNECTION : RECONNECTING;
    return state.valuesAt === null ? head + ' - no values yet' : head + ' - values from ' + clockText(state.valuesAt);
}

/** The long form for the chip's tooltip. */
export function connectionDetailText(state: ConnectionState): string {
    if (!state.lost && !state.frozen) {
        return '';
    }
    const from = state.valuesAt === null ? 'no values have arrived' : 'the values shown are from ' + clockText(state.valuesAt);
    return state.lost
        ? 'The Gateway cannot be reached: ' + from + ', and every value is shown as stale until the connection is back, when the map reloads.'
        : 'The Gateway is back: ' + from + ', shown as stale until the reload\'s values arrive.';
}

/**
 * Polls `isConnected` and calls `onLost` once when it turns false and `onBack` once when it turns
 * true again. `start` reads it at once; the timer is the caller's to stop (the component unmounted).
 */
export class ConnectionWatch {
    private timer: ReturnType<typeof setInterval> | null = null;
    private lost = false;

    constructor(private readonly isConnected: () => boolean, private readonly onLost: () => void, private readonly onBack: () => void,
                private readonly intervalMs: number = CONNECTION_POLL_MS) {}

    start(): void {
        if (this.timer !== null) {
            return;
        }
        this.check();
        this.timer = setInterval(() => this.check(), this.intervalMs);
    }

    stop(): void {
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /** One reading; exposed for the tests. */
    check(): void {
        const connected = this.isConnected();
        if (!connected && !this.lost) {
            this.lost = true;
            this.onLost();
        } else if (connected && this.lost) {
            this.lost = false;
            this.onBack();
        }
    }

    isLost(): boolean {
        return this.lost;
    }
}
