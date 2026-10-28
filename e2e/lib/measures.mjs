// The measures file: shape, validation and writing. Every section is either
// {status: 'unavailable', reason} or carries a label ('measured' or 'stand-in'),
// the method that produced it and the environment it ran in, so nothing in the
// file can pass for more than it is.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const SECTIONS = ['bundle', 'frameRate', 'valueBatch', 'phone'];
export const LABELS = ['measured', 'stand-in'];

/** An empty section for a measure that did not run. */
export function unavailable(reason) {
    return { status: 'unavailable', reason };
}

const hasEnv = (e) => !!e && typeof e === 'object' && typeof e.chromium === 'string' && typeof e.renderer === 'string';

/** Problems with a measures object, as strings; an empty list means it is valid. */
export function validateMeasures(m) {
    const problems = [];
    if (!m || typeof m !== 'object') return ['measures is not an object'];
    if (!hasEnv(m.env)) problems.push('env needs chromium and renderer');
    for (const name of SECTIONS) {
        const s = m[name];
        if (!s || typeof s !== 'object') {
            problems.push(`${name}: missing`);
        } else if (s.status === 'unavailable') {
            if (typeof s.reason !== 'string' || s.reason === '') problems.push(`${name}: unavailable without a reason`);
        } else {
            if (!LABELS.includes(s.label)) problems.push(`${name}: label must be one of ${LABELS.join(', ')}`);
            if (typeof s.method !== 'string' || s.method === '') problems.push(`${name}: method missing`);
            if (!hasEnv(s.env)) problems.push(`${name}: env needs chromium and renderer`);
        }
    }
    return problems;
}

/** The measures without the named top-level fields (a copy). */
export function without(m, fields) {
    const copy = { ...m };
    for (const f of fields) delete copy[f];
    return copy;
}

/** Write the JSON to a file, creating its folder. */
export function writeJson(m, file) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(m, null, 2) + '\n');
}
