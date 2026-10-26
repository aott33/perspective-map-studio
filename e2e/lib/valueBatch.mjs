// A STAND-IN for the size of one batch of icon values. `values.batch` does not
// exist yet (epic-viewing); this builds the envelope AD-6 describes so its size
// can be measured now: {v, type, id, body: {seq, full, items}}, each slot one
// LiveValue {value, quality, t, stale, reason}. AD-6 fixes only the LiveValue
// fields; the item layout here (pad id plus three slots: comms, icon KPI, alarm
// count) is an assumption of the story 7 plan, NOT a verified contract.

import { gzipSync } from 'node:zlib';

const padId = (n) => 'pad-' + String(n).padStart(2, '0');

/** Deterministic LiveValue for pad n and slot name, no randomness. */
function liveValue(n, slot) {
    const t = Date.UTC(2026, 0, 1, 0, 0, 0) + n * 1000;
    const iso = new Date(t).toISOString();
    if (slot === 'comms') return { value: n % 7 !== 0, quality: 'Good', t: iso, stale: false, reason: '' };
    if (slot === 'kpi') return { value: Math.round((100 + n * 3.7) * 10) / 10, quality: 'Good', t: iso, stale: false, reason: '' };
    return { value: n % 5 === 0 ? 2 : 0, quality: 'Good', t: iso, stale: false, reason: '' };
}

/**
 * The envelope for `pads` pads. `full` carries every pad; otherwise only the
 * pads whose number is a multiple of `every` (a deterministic changes-only batch).
 */
export function buildValuesBatch({ pads, full, every = 10, seq = 1 }) {
    const items = [];
    for (let n = 1; n <= pads; n++) {
        if (!full && n % every !== 0) continue;
        items.push({ id: padId(n), comms: liveValue(n, 'comms'), kpi: liveValue(n, 'kpi'), alarms: liveValue(n, 'alarms') });
    }
    return { v: 1, type: 'values.batch', id: '00000000-0000-4000-8000-000000000001', body: { seq, full, items } };
}

/** UTF-8 bytes of the JSON text, and gzip bytes of the same text. */
export function batchSize(envelope) {
    const text = JSON.stringify(envelope);
    return { items: envelope.body.items.length, jsonBytes: Buffer.byteLength(text, 'utf8'), gzipBytes: gzipSync(text).length };
}
