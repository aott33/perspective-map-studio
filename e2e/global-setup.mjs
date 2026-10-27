// Stop before any test when the Gateway is not there, with one line saying why.
// (The map editor signs in per editor test, in its own process: tests/fixtures.mjs.)
// A run that crashed while tests/setup.spec.mjs had changed the dev setup left
// e2e/out/setup.json.bak: the file is put back first (even when the Gateway is down,
// so ops/project is clean), then scanned once the Gateway answers; the backup goes
// only after that scan succeeds.

import { gatewayUrl } from './lib/env.mjs';
import { forgetSetupBackup, restoreSetup, scanProject } from './lib/gateway.mjs';

const BUNDLE_PATH = '/res/mapstudio/MapStudio.js';

async function get(url) {
    try {
        return await fetch(url, { signal: AbortSignal.timeout(10_000) });
    } catch (err) {
        return { ok: false, status: 0, error: String(err && err.message ? err.message : err) };
    }
}

export default async function globalSetup() {
    const base = gatewayUrl();
    const restored = restoreSetup();
    if (restored) console.log('Restored the dev setup.json from e2e/out/setup.json.bak (left by a crashed run).');
    const ping = await get(`${base}/StatusPing`);
    if (!ping.ok) {
        throw new Error(`No Gateway answers at ${base}/StatusPing (${ping.error ?? 'HTTP ' + ping.status}). Start it with ops/up.sh, or set GATEWAY_URL.`);
    }
    const bundle = await get(`${base}${BUNDLE_PATH}`);
    if (!bundle.ok) {
        throw new Error(`The Gateway at ${base} does not serve ${BUNDLE_PATH} (HTTP ${bundle.status}). Is the Map Studio module installed and running? Run ops/up.sh.`);
    }
    if (restored) {
        console.log('Scanning the project so the Gateway reads the restored setup.');
        await scanProject();
        forgetSetupBackup();
    }
}
