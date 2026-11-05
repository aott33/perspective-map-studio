// The page's websockets routed through the test (Playwright routeWebSocket), so a spec can make "the Gateway gone" and
// "the map store gone" deterministic without stopping the dev stack: unsaved.spec.mjs (epic-map-store-and-data entry 8)
// and problems.spec.mjs (epic 4 entry 24). Every edits.apply the browser sends can be taken out (the Gateway never sees
// the save, so the 15 s reply timer runs out), a map.changed dropped (a gap, so the map sends map.load), and a
// map.load.reply turned into a store-unreachable error or given a read-only reason.

const EVENT_FIRED = 'event-fired:';
const SYNC = 'sync:';

/** The Gateway's busy answer (MapStudioDelegate.busyReply). */
export const BUSY_MESSAGE = 'Map Studio is busy with other map requests; nothing was saved. Try again in a moment.';
/** The words a routed map.load.reply carries for `failLoad: 'down'`. */
export const DOWN_MESSAGE = 'The map store is unavailable (test).';

/**
 * The Gateway's reply as Perspective delivers it ([observed in the 8.3.10 client]: a text
 * frame `event-fired:` and JSON whose `event` is the Map Studio envelope), or null.
 */
function firedEvent(message) {
    if (typeof message !== 'string' || !message.startsWith(EVENT_FIRED)) return null;
    try {
        const frame = JSON.parse(message.slice(EVENT_FIRED.length));
        return frame && frame.event && typeof frame.event.type === 'string' ? frame : null;
    } catch (err) {
        return null;
    }
}

/**
 * A browser frame without the edits.apply events the gate drops. Perspective sends component
 * events inside numbered `sync:` frames and waits for each one to be answered
 * ([observed in the 8.3.10 client]: a dropped frame stalls every later one), so the frame is
 * passed on with those events taken out rather than dropped.
 */
function withoutDroppedSaves(message, gate) {
    if (typeof message !== 'string' || !message.startsWith(SYNC) || !message.includes('edits.apply')) return message;
    let frame;
    try {
        frame = JSON.parse(message.slice(SYNC.length));
    } catch (err) {
        return message;
    }
    if (!frame || !Array.isArray(frame.events)) return message;
    const kept = frame.events.filter((e) => {
        const ev = e && e.event;
        const save = ev && ev.type === 'edits.apply';
        const drop = save && (gate.drop || (gate.dropBatch && ev.body && ev.body.batchId === gate.dropBatch));
        if (drop) gate.dropped++;
        return !drop;
    });
    if (kept.length === frame.events.length) return message;
    frame.events = kept;
    return SYNC + JSON.stringify(frame);
}

/** A gate with nothing in force; a spec sets its fields as it goes. */
export function openGate() {
    return { drop: false, dropBatch: null, dropped: 0, dropChanged: 0, failLoad: null, failedLoads: 0, readOnly: null, loads: 0 };
}

/**
 * Route every websocket of the context through the test. While `gate.drop` is true, every
 * edits.apply the browser sends is taken out (the Gateway never sees it), and while
 * `gate.dropBatch` is set, every edits.apply of that batch. While `gate.dropChanged` is above 0,
 * that many map.changed frames are dropped (a gap). While `gate.failLoad` is set, a map.load.reply
 * becomes a store-unreachable error: 'busy' the busy answer, 'down' DOWN_MESSAGE, any other string
 * those words (`gate.failedLoads` counts them); else while `gate.readOnly` is a string, a
 * map.load.reply says the store is read only with that reason. `gate.loads` counts every
 * map.load.reply that came.
 */
export async function routeSockets(context, gate) {
    await context.routeWebSocket(/.*/, (ws) => {
        const server = ws.connectToServer();
        ws.onMessage((message) => {
            server.send(withoutDroppedSaves(message, gate));
        });
        server.onMessage((message) => {
            const frame = firedEvent(message);
            if (frame && frame.event.type === 'map.changed' && gate.dropChanged > 0) {
                gate.dropChanged--;
                return;
            }
            if (frame && frame.event.type === 'map.load.reply') {
                gate.loads = (gate.loads || 0) + 1;
            }
            if (frame && frame.event.type === 'map.load.reply' && gate.failLoad) {
                gate.failedLoads++;
                frame.event = {
                    v: frame.event.v, type: 'error', id: frame.event.id,
                    body: {
                        code: 'store-unreachable',
                        message: gate.failLoad === 'busy' ? BUSY_MESSAGE : gate.failLoad === 'down' ? DOWN_MESSAGE : gate.failLoad
                    }
                };
                ws.send(EVENT_FIRED + JSON.stringify(frame));
                return;
            }
            if (frame && frame.event.type === 'map.load.reply' && typeof gate.readOnly === 'string' && frame.event.body) {
                frame.event.body.readOnly = gate.readOnly;
                ws.send(EVENT_FIRED + JSON.stringify(frame));
                return;
            }
            ws.send(message);
        });
    });
}
