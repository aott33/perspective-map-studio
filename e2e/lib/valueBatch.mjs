// The real `values.batch` on the wire (epic 3 entry 5 replaced story 7's stand-in): a
// websocket frame of the Perspective session socket that carries one is read for what it
// says and sized as it travelled. The frame wraps Map Studio's envelope in Perspective's own
// message (sometimes as an escaped JSON string), so the batch's fields are found by pattern,
// never by parsing the whole frame.

import { gzipSync } from 'node:zlib';

/** The frame text, whether the payload came as a string or bytes. */
export function frameText(payload) {
    return Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload);
}

/** True when a frame carries a values.batch envelope. */
export function isValuesBatchFrame(text) {
    return /\\*"type\\*"\s*:\s*\\*"values\.batch\\*"/.test(text);
}

/**
 * What a values.batch frame says: whether it is full, how many map items it carries (one
 * `problems` list per item), and the batch's seq; null for a frame that holds no batch.
 */
export function parseBatchFrame(text) {
    if (!isValuesBatchFrame(text)) return null;
    const full = /\\*"full\\*"\s*:\s*true/.test(text);
    const items = (text.match(/\\*"problems\\*"\s*:/g) || []).length;
    const seq = /\\*"seq\\*"\s*:\s*(\d+)/.exec(text);
    const kindDisplay = /\\*"kindDisplay\\*"\s*:/.test(text);
    return { full, items, seq: seq ? Number(seq[1]) : null, kindDisplay };
}

/** UTF-8 bytes of a frame's text, and gzip bytes of the same text (a best case, not the wire). */
export function batchSize(text) {
    return { bytes: Buffer.byteLength(text, 'utf8'), gzipBytes: gzipSync(text).length };
}
