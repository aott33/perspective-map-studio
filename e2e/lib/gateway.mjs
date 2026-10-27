// The dev Gateway's project scan and the dev project's Map Studio setup file, for
// specs that change the setup and put it back (tests/setup.spec.mjs). The scan
// authenticates with the dev API key in ops/secrets/api-token (ops/gen_secrets.py);
// the token is read here and sent as a header only, never logged or written.

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gatewayUrl, outDir, repoRoot } from './env.mjs';

/** The committed dev setup the Gateway reads (ops/project is bind-mounted as mapstudio-dev). */
export const setupFile = path.join(repoRoot, 'ops', 'project', 'com.aoindustrial.perspective.mapstudio', 'setup',
    'setup.json');
/** The copy a spec keeps while it changes the setup; the global setup restores it after a crashed run. */
export const setupBackup = path.join(outDir, 'setup.json.bak');

function apiToken() {
    const file = path.join(repoRoot, 'ops', 'secrets', 'api-token');
    if (!existsSync(file)) throw new Error('ops/secrets/api-token is missing; start the dev stack with ops/up.sh.');
    return readFileSync(file, 'utf8').trim();
}

/**
 * Ask the Gateway to scan its projects (POST /data/api/v1/scan/projects), so an
 * edited setup is read without a restart [live 8.3.10]. Throws on a refusal, with
 * the status only.
 */
export async function scanProject() {
    const res = await fetch(`${gatewayUrl()}/data/api/v1/scan/projects`, {
        method: 'POST',
        headers: { 'X-Ignition-API-Token': apiToken() },
        signal: AbortSignal.timeout(30_000)
    });
    if (!res.ok) throw new Error(`The project scan was refused (HTTP ${res.status}).`);
}

/** Keep the committed setup in e2e/out/setup.json.bak before a spec changes it. */
export function backUpSetup() {
    mkdirSync(outDir, { recursive: true });
    if (!existsSync(setupBackup)) copyFileSync(setupFile, setupBackup);
}

/** Write the dev setup: an object as formatted JSON, or a string as is (for a broken file). */
export function writeSetup(setup) {
    writeFileSync(setupFile, typeof setup === 'string' ? setup : JSON.stringify(setup, null, 2) + '\n');
}

/** The committed setup as an object (from the backup when a spec holds one). */
export function committedSetup() {
    return JSON.parse(readFileSync(existsSync(setupBackup) ? setupBackup : setupFile, 'utf8'));
}

/** Put the committed setup back from the backup, if there is one. Returns whether it did. */
export function restoreSetup() {
    if (!existsSync(setupBackup)) return false;
    writeFileSync(setupFile, readFileSync(setupBackup));
    rmSync(setupBackup, { force: true });
    return true;
}
