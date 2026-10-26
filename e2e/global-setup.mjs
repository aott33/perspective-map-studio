// Stop before any test when the Gateway is not there, with one line saying why.

import { gatewayUrl } from './lib/env.mjs';

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
    const ping = await get(`${base}/StatusPing`);
    if (!ping.ok) {
        throw new Error(`No Gateway answers at ${base}/StatusPing (${ping.error ?? 'HTTP ' + ping.status}). Start it with ops/up.sh, or set GATEWAY_URL.`);
    }
    const bundle = await get(`${base}${BUNDLE_PATH}`);
    if (!bundle.ok) {
        throw new Error(`The Gateway at ${base} does not serve ${BUNDLE_PATH} (HTTP ${bundle.status}). Is the Map Studio module installed and running? Run ops/up.sh.`);
    }
}
