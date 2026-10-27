// After every run: delete the signed-in browser state, then make sure nothing the
// run wrote under e2e/out (screenshots, report, traces unzipped, measures) holds
// a dev user's password (the map editor's or the phone editor's). A file that does is deleted and the run fails, so
// CI's upload of e2e/out can never carry it.

import { rmSync } from 'node:fs';
import { outDir } from './lib/env.mjs';
import { EDITOR_USER, OPERATOR_USER, allPasswords, stateFile } from './lib/editorAuth.mjs';
import { filesHolding } from './lib/secretScan.mjs';

export default async function globalTeardown() {
    for (const user of [EDITOR_USER, OPERATOR_USER]) {
        rmSync(stateFile(user), { force: true });
    }
    const found = allPasswords().flatMap((password) => filesHolding(outDir, password));
    if (found.length > 0) {
        for (const hit of found) {
            rmSync(hit.split('!')[0], { force: true });
        }
        throw new Error(`A dev user's password was found in ${found.length} file(s) under e2e/out; they were deleted: `
            + found.join(', '));
    }
    console.log('e2e/out checked: no file holds a dev user\'s password (traces unzipped).');
}
