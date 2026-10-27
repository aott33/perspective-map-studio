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

async function getJson(apiPath) {
    const res = await fetch(`${gatewayUrl()}${apiPath}`, {
        headers: { 'X-Ignition-API-Token': apiToken() },
        signal: AbortSignal.timeout(30_000)
    });
    if (!res.ok) throw new Error(`GET ${apiPath.split('?')[0]} was refused (HTTP ${res.status}).`);
    return res.json();
}

/** The Map Studio module's id on the Gateway. */
const MODULE_ID = 'com.aoindustrial.perspective.mapstudio';

/**
 * The Gateway's uptime (ms, GET /data/api/v1/overview) and when the Map Studio module
 * last started (GET /data/api/v1/modules/healthy) [live 8.3.10]: a restart of either
 * resets the uptime or changes the start time.
 */
export async function gatewayRun() {
    const overview = await getJson('/data/api/v1/overview');
    const modules = await getJson('/data/api/v1/modules/healthy');
    const mine = (modules.items ?? []).find((m) => m.id === MODULE_ID);
    if (!mine) throw new Error(`The Gateway does not list the module ${MODULE_ID} as healthy.`);
    return { uptimeMs: Number(overview.uptime), moduleStartupTime: mine.startupTime };
}

/**
 * The warn lines of logger MapStudio.setup logged at or after `sinceMs` (Gateway log,
 * GET /data/api/v1/logs?logger=..., [live 8.3.10]), oldest first, messages only.
 */
export async function setupWarnings(sinceMs) {
    const page = await getJson('/data/api/v1/logs?logger=MapStudio.setup&limit=1000');
    return (page.items ?? [])
        .filter((e) => e.level === 'WARN' && Number(e.timestamp) >= sinceMs)
        .sort((x, y) => Number(x.timestamp) - Number(y.timestamp))
        .map((e) => e.message);
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

/**
 * Put the committed setup file back from the backup, if there is one, and keep the
 * backup. Returns whether it did. The backup goes only once the Gateway has read the
 * file again (putBackSetup, forgetSetupBackup), so a failed scan leaves it for the
 * next run's global setup to restore and scan.
 */
export function restoreSetup() {
    if (!existsSync(setupBackup)) return false;
    writeFileSync(setupFile, readFileSync(setupBackup));
    return true;
}

/** Drop the backup: only after a successful scan of the restored file. */
export function forgetSetupBackup() {
    rmSync(setupBackup, { force: true });
}

/** Restore the committed setup, scan, and only then drop the backup. Returns whether there was one. */
export async function putBackSetup() {
    if (!restoreSetup()) return false;
    await scanProject();
    forgetSetupBackup();
    return true;
}
