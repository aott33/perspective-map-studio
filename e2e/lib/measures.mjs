// The measures file: shape, validation and writing. Every section is either
// {status: 'unavailable', reason} or carries a label ('measured' or 'stand-in')
// and the method that produced it, so nothing in the file can pass for more than
// it is.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const SECTIONS = ['bundle', 'frameRate', 'valueBatch', 'phone'];
export const LABELS = ['measured', 'stand-in'];

/** An empty section for a measure that did not run. */
export function unavailable(reason) {
    return { status: 'unavailable', reason };
}

/** Problems with a measures object, as strings; an empty list means it is valid. */
export function validateMeasures(m) {
    const problems = [];
    if (!m || typeof m !== 'object') return ['measures is not an object'];
    if (!m.env || typeof m.env.renderer !== 'string' || typeof m.env.chromium !== 'string') {
        problems.push('env needs chromium and renderer');
    }
    for (const name of SECTIONS) {
        const s = m[name];
        if (!s || typeof s !== 'object') {
            problems.push(`${name}: missing`);
        } else if (s.status === 'unavailable') {
            if (typeof s.reason !== 'string' || s.reason === '') problems.push(`${name}: unavailable without a reason`);
        } else {
            if (!LABELS.includes(s.label)) problems.push(`${name}: label must be one of ${LABELS.join(', ')}`);
            if (typeof s.method !== 'string' || s.method === '') problems.push(`${name}: method missing`);
        }
    }
    if (m.valueBatch && m.valueBatch.status !== 'unavailable' && m.valueBatch.label !== 'stand-in') {
        problems.push('valueBatch: must be labelled stand-in until values.batch exists');
    }
    return problems;
}

/** Validate, then write the same JSON to every file; throws on an invalid object. */
export function writeMeasures(m, files) {
    const problems = validateMeasures(m);
    if (problems.length) throw new Error('Invalid measures: ' + problems.join('; '));
    const text = JSON.stringify(m, null, 2) + '\n';
    for (const f of files) {
        mkdirSync(path.dirname(f), { recursive: true });
        writeFileSync(f, text);
    }
}
