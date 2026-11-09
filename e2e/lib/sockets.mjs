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
/** The words a routed edits.apply is answered with for `failSave: 'down'` (epic 4 entry 10). */
export const SAVE_DOWN_MESSAGE = 'The map store could not be reached to save this batch (test).';

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
 * A browser frame without the edits.apply events the gate drops or answers itself. Perspective sends component
 * events inside numbered `sync:` frames and waits for each one to be answered
 * ([observed in the 8.3.10 client]: a dropped frame stalls every later one), so the frame is
 * passed on with those events taken out rather than dropped. `answered` collects the edits.apply envelopes the gate
 * answers with an error itself (`failSave`, epic 4 entry 10).
 */
function withoutDroppedSaves(message, gate, answered) {
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
        const fail = save && !drop && !!gate.failSave && !!gate.template;
        if (fail) answered.push(ev);
        return !drop && !fail;
    });
    if (kept.length === frame.events.length) return message;
    frame.events = kept;
    return SYNC + JSON.stringify(frame);
}

/**
 * The gate's own answer to an edits.apply (`failSave`): a store-unreachable error, the busy answer for 'busy' (the Gateway's
 * MapStudioDelegate.busyReply, which names no batch) or SAVE_DOWN_MESSAGE for 'down', in a frame shaped as the last one the
 * Gateway fired to this page (`gate.template`), so the client delivers it as the Gateway's own.
 */
function failedSaveFrame(gate, envelope) {
    const body = gate.failSave === 'busy'
        ? { code: 'store-unreachable', message: BUSY_MESSAGE }
        : { code: 'store-unreachable', message: SAVE_DOWN_MESSAGE, batchId: envelope.body ? envelope.body.batchId : undefined };
    return EVENT_FIRED + JSON.stringify({ ...gate.template, event: { v: envelope.v, type: 'error', id: envelope.id, body } });
}

/** A gate with nothing in force; a spec sets its fields as it goes. */
export function openGate() {
    return {
        drop: false, dropBatch: null, dropped: 0, dropChanged: 0, failLoad: null, failedLoads: 0, readOnly: null, loads: 0,
        failSave: null, failedSaves: 0, template: null
    };
}

/**
 * Route every websocket of the context through the test. While `gate.drop` is true, every
 * edits.apply the browser sends is taken out (the Gateway never sees it), and while
 * `gate.dropBatch` is set, every edits.apply of that batch. While `gate.dropChanged` is above 0,
 * that many map.changed frames are dropped (a gap). While `gate.failLoad` is set, a map.load.reply
 * becomes a store-unreachable error: 'busy' the busy answer, 'down' DOWN_MESSAGE, any other string
 * those words (`gate.failedLoads` counts them); else while `gate.readOnly` is a string, a
 * map.load.reply says the store is read only with that reason. `gate.loads` counts every
 * map.load.reply that came. While `gate.failSave` is 'busy' or 'down' (epic 4 entry 10), every edits.apply the browser
 * sends is answered by the gate, never reaching the Gateway: store-unreachable with the busy sentence, or with
 * SAVE_DOWN_MESSAGE (`gate.failedSaves` counts them); the answer copies the frame of the last event the Gateway fired, so
 * it needs one first (map.load's reply at the page's open is one). `target` is a browser context, or one page of it
 * (Playwright's routeWebSocket on either), so two pages of one context can be routed apart.
 */
export async function routeSockets(target, gate) {
    await target.routeWebSocket(/.*/, (ws) => {
        const server = ws.connectToServer();
        ws.onMessage((message) => {
            const answered = [];
            server.send(withoutDroppedSaves(message, gate, answered));
            for (const envelope of answered) {
                gate.failedSaves = (gate.failedSaves || 0) + 1;
                ws.send(failedSaveFrame(gate, envelope));
            }
        });
        server.onMessage((message) => {
            const frame = firedEvent(message);
            if (frame) {
                const { event, ...rest } = frame;
                gate.template = rest;
            }
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
