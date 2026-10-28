// The measures of the perf run by name (epic 3 entry 4: `ops/perf.sh --only <measures>`). Pure, unit
// tested in perf.test.mjs, plus a small CLI for ops/perf.sh:
//
//   node perf/only.mjs phases <list>   prints the phases the named measures need ("main" or
//                                      "nomodule main"); exit 2 with the valid names on an unknown one
//   node perf/only.mjs wants <list> <name>   exit 0 when the list (empty: everything) holds the measure
//
// A measure's block in perf.spec.mjs runs when it is wanted; a test with no wanted block is skipped.
// The tests seed incrementally (30, 1,000, 5,000 items), so `edits.apply` alone still seeds to 5,000.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Every measure: the record keys it writes, the phases it needs, and the headline rows of compare.mjs it owns. */
export const MEASURES = {
    bundle: { keys: ['bundle'], phases: ['main'], headline: /^bundle / },
    idle: { keys: ['idle', 'idleAdded'], phases: ['nomodule', 'main'], headline: /^idleAdded / },
    'map.load': { keys: ['mapLoad'], phases: ['main'], headline: /^map\.load / },
    'open-to-drawn': { keys: ['openToDrawn'], phases: ['main'], headline: /^open-to-drawn / },
    'frame-rate': { keys: ['frameRate'], phases: ['main'], headline: /^frame rate / },
    'map.changed': { keys: ['mapChanged'], phases: ['main'], headline: /^map\.changed / },
    sessions: { keys: ['sessions20', 'sessionsAdded'], phases: ['nomodule', 'main'], headline: /^sessionsAdded / },
    'edits.apply': { keys: ['editsApply'], phases: ['main'], headline: /^edits\.apply / },
    'list-refresh': { keys: ['listRefresh'], phases: ['main'], headline: /^list refresh / }
};

export const NAMES = Object.keys(MEASURES);

/**
 * The selection from a comma-separated list (PERF_ONLY, `--only`): null for everything (an empty or
 * missing list), else the array of names in MEASURES' order. Throws on an unknown name.
 */
export function parseOnly(text) {
    const names = String(text || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (names.length === 0) return null;
    const unknown = names.filter((n) => !MEASURES[n]);
    if (unknown.length) throw new Error(`unknown measure(s) ${unknown.join(', ')}; the measures are ${NAMES.join(', ')}`);
    return NAMES.filter((n) => names.includes(n));
}

/** Whether a measure runs under a selection (null: every measure does). */
export function wants(selection, name) {
    if (!MEASURES[name]) throw new Error(`unknown measure ${name}`);
    return selection === null || selection.includes(name);
}

/** Whether any of the measures runs under a selection (a test with none is skipped). */
export function wantsAny(selection, names) {
    return names.some((n) => wants(selection, n));
}

/** The phases a selection needs, in run order (both when a nomodule measure is in it). */
export function phasesFor(selection) {
    const wanted = selection === null ? NAMES : selection;
    const nomodule = wanted.some((n) => MEASURES[n].phases.includes('nomodule'));
    return nomodule ? ['nomodule', 'main'] : ['main'];
}

/** The measure a compare.mjs headline row belongs to, or null. */
export function measureOfHeadline(rowName) {
    for (const [name, m] of Object.entries(MEASURES)) {
        if (m.headline.test(rowName)) return name;
    }
    return null;
}

function cli(argv) {
    const [command, list, name] = argv;
    let selection;
    try {
        selection = parseOnly(list);
    } catch (err) {
        console.error('perf: ' + err.message);
        return 2;
    }
    if (command === 'phases') {
        console.log(phasesFor(selection).join(' '));
        return 0;
    }
    if (command === 'wants' && name) {
        return wants(selection, name) ? 0 : 1;
    }
    console.error('usage: node perf/only.mjs phases <list> | wants <list> <name>');
    return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(cli(process.argv.slice(2)));
}
