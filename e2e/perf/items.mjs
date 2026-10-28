// The perf run's map items (epic 2 story 17): deterministic, so two runs build the same map.
// Item n has the id UUIDv5(URL namespace, 'mapstudio-perf/<n>'); even n is a pad (a point), odd n a
// short line beside it, on a 50 x 50 grid of cells inside the perf views' starting area (the startingArea prop in
// ops/perf/project views, centre -104.9725, 39.7445, zoom 12), so 5,000 items fill the grid.
// Every item is made through edits.apply (the real write path), in batches of BATCH_OPS ops.

import { createHash, randomUUID } from 'node:crypto';

export const PROJECT = 'mapstudio-perf';
export const BATCH_OPS = 500;
export const GRID = 50;
const URL_NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
const WEST = -105.05;
const SOUTH = 39.71;
const STEP_LON = 0.003;
const STEP_LAT = 0.0014;

/** RFC 4122 version 5 UUID of `name` in `namespace` (SHA-1), as Python's uuid.uuid5. */
export function uuid5(name, namespace = URL_NAMESPACE) {
    const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex');
    const hash = createHash('sha1').update(Buffer.concat([ns, Buffer.from(name, 'utf8')])).digest();
    const b = Buffer.from(hash.subarray(0, 16));
    b[6] = (b[6] & 0x0f) | 0x50;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = b.toString('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** The id of item n. */
export function itemId(n) {
    return uuid5(`${PROJECT}/${n}`);
}

const round6 = (v) => Math.round(v * 1e6) / 1e6;

/** The create data of item n: a pad (point) for even n, a line for odd n, in grid cell floor(n / 2). */
export function itemData(n) {
    const cell = Math.floor(n / 2);
    const lon = round6(WEST + (cell % GRID) * STEP_LON);
    const lat = round6(SOUTH + Math.floor(cell / GRID) * STEP_LAT);
    if (n % 2 === 0) {
        return { kind: 'pad', name: `Perf pad ${n}`, properties: { status: 'producing' },
            geometry: { type: 'Point', coordinates: [lon, lat] } };
    }
    return { kind: 'line', name: `Perf line ${n}`, properties: {},
        geometry: { type: 'LineString', coordinates: [[lon, lat], [round6(lon + 0.002), round6(lat + 0.0007)]] } };
}

/** Create batches for items from (inclusive) to `to` (exclusive), at most `size` ops each. */
export function createBatches(from, to, size = BATCH_OPS) {
    if (!(Number.isInteger(from) && Number.isInteger(to) && from >= 0 && to >= from)) {
        throw new Error(`bad item range ${from}..${to}`);
    }
    if (to > GRID * GRID * 2) throw new Error(`at most ${GRID * GRID * 2} items fit the grid`);
    const batches = [];
    for (let start = from; start < to; start += size) {
        const ops = [];
        for (let n = start; n < Math.min(to, start + size); n++) {
            ops.push({ op: 'create', entity: 'item', id: itemId(n), baseVersion: 0, data: itemData(n) });
        }
        batches.push({ batchId: randomUUID(), ops });
    }
    return batches;
}

/** The item numbers of editor e's own pads: `perEditor` pads, disjoint from every other editor's. */
export function editorPads(e, perEditor = 50) {
    return Array.from({ length: perEditor }, (_, k) => 2 * (e * perEditor + k));
}

/** The pad the map.changed measure saves (editor 9's last pad too: the edits.apply measure reads versions afresh). */
export const CHANGED_PAD = 998;

/** An update op of a pad's properties at its stored version; `k` varies the value. */
export function padUpdate(id, version, k) {
    return { op: 'update', entity: 'item', id, baseVersion: version,
        data: { properties: { status: k % 2 === 0 ? 'shut in' : 'producing', wells: k % 1000 } } };
}
