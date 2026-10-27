// After every run: delete the signed-in browser state, then make sure nothing the
// run wrote under e2e/out (screenshots, report, traces unzipped, measures) holds
// the map editor's password. A file that does is deleted and the run fails, so
// CI's upload of e2e/out can never carry it.

import { rmSync } from 'node:fs';
import { outDir } from './lib/env.mjs';
import { editorPassword, editorStateFile } from './lib/editorAuth.mjs';
import { filesHolding } from './lib/secretScan.mjs';

export default async function globalTeardown() {
    rmSync(editorStateFile, { force: true });
    const found = filesHolding(outDir, editorPassword());
    if (found.length > 0) {
        for (const hit of found) {
            rmSync(hit.split('!')[0], { force: true });
        }
        throw new Error(`The map editor's password was found in ${found.length} file(s) under e2e/out; they were deleted: `
            + found.join(', '));
    }
    console.log('e2e/out checked: no file holds the map editor\'s password (traces unzipped).');
}
