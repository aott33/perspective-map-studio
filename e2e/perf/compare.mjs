// Compare two perf results (epic 2 story 17): every judged or recorded number with its value in each,
// the delta and the verdict of the second.
//
//   node perf/compare.mjs a.json b.json [--only <measures>]
//
// The numbers compared are the measures' headline statistics: p95 and median of each timed measure,
// the slowest map.changed session, the added CPU and heap, the bundle bytes, the median frame rates.
// --only (the names of perf/only.mjs, as ops/perf.sh --only) keeps the rows of those measures only.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { measureOfHeadline, parseOnly, wants } from './only.mjs';

/** [{name, value, unit, verdict}] of a result's headline numbers. */
export function headlines(result) {
    const m = (result && result.measures) || {};
    const out = [];
    const add = (name, value, unit, verdict) => {
        if (typeof value === 'number') out.push({ name, value, unit, verdict: verdict || 'recorded' });
    };
    for (const [items, v] of Object.entries(m.mapLoad || {})) {
        add(`map.load ${items} items p95`, v.stats && v.stats.p95, 'ms', v.verdict);
        add(`map.load ${items} items median`, v.stats && v.stats.median, 'ms', v.verdict);
        add(`map.load ${items} items reply`, v.payload && v.payload.replyJsonBytes && v.payload.replyJsonBytes.median, 'bytes', v.verdict);
    }
    for (const [key, v] of Object.entries(m.editsApply || {})) {
        add(`edits.apply ${key} p95`, v.stats && v.stats.p95, 'ms', v.verdict);
        add(`edits.apply ${key} median`, v.stats && v.stats.median, 'ms', v.verdict);
    }
    for (const [n, v] of Object.entries(m.mapChanged || {})) add(`map.changed ${n} sessions slowest`, v.maxMs, 'ms', v.verdict);
    if (m.listRefresh) {
        add('list refresh max', m.listRefresh.stats && m.listRefresh.stats.max, 'ms', m.listRefresh.verdict);
        add('list refresh CPU 1 s max', m.listRefresh.spike && m.listRefresh.spike.maxPct, '% of a core', m.listRefresh.spike && m.listRefresh.spike.verdict);
    }
    for (const key of ['idleAdded', 'sessionsAdded']) {
        const v = m[key];
        if (v) {
            add(`${key} CPU`, v.cpuDeltaPct, '% of a core', v.verdict);
            add(`${key} heap`, v.heapDeltaMiB, 'MiB', v.verdict);
        }
    }
    if (m.bundle) add('bundle bytes', m.bundle.bytes, 'bytes', m.bundle.verdict);
    for (const [items, v] of Object.entries(m.frameRate || {})) {
        add(`frame rate ${items} items pan`, v.medianFps && v.medianFps.pan, 'fps', 'recorded');
        add(`frame rate ${items} items zoom`, v.medianFps && v.medianFps.zoom, 'fps', 'recorded');
    }
    return out;
}

/**
 * Rows of the comparison: [{name, a, b, delta, unit, verdict}]. `only` (a selection of
 * perf/only.mjs, null for every measure) keeps the rows of the wanted measures.
 */
export function compare(a, b, only = null) {
    const ha = new Map(headlines(a).map((h) => [h.name, h]));
    const hb = new Map(headlines(b).map((h) => [h.name, h]));
    const names = [...new Set([...ha.keys(), ...hb.keys()])]
        .filter((name) => only === null || (measureOfHeadline(name) !== null && wants(only, measureOfHeadline(name))));
    return names.map((name) => {
        const x = ha.get(name);
        const y = hb.get(name);
        return {
            name,
            a: x ? x.value : null,
            b: y ? y.value : null,
            delta: x && y ? Math.round((y.value - x.value) * 100) / 100 : null,
            unit: (y || x).unit,
            verdict: y ? y.verdict : 'not in b'
        };
    });
}

function cli(argv) {
    const i = argv.indexOf('--only');
    let only = null;
    if (i >= 0) {
        try {
            only = parseOnly(argv[i + 1]);
        } catch (err) {
            console.error('perf: ' + err.message);
            return 2;
        }
        argv = argv.filter((_, j) => j !== i && j !== i + 1);
    }
    if (argv.length !== 2) {
        console.error('usage: node perf/compare.mjs a.json b.json [--only <measures>]');
        return 2;
    }
    const [a, b] = argv.map((f) => JSON.parse(readFileSync(f, 'utf8')));
    const rows = compare(a, b, only);
    if (rows.length === 0) console.log('(no headline row of the wanted measures in either record)');
    for (const r of rows) {
        const d = r.delta === null ? 'n/a' : (r.delta > 0 ? '+' : '') + r.delta;
        console.log(`${r.name}: ${r.a ?? 'n/a'} -> ${r.b ?? 'n/a'} ${r.unit} (delta ${d}) ${r.verdict}`);
    }
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(cli(process.argv.slice(2)));
}
