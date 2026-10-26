#!/usr/bin/env node
// Check the point popup against the running dev Gateway (story 4): clicking a
// point opens the project view named by popupView.path with the point as its
// mapItem parameter beside the author's params; clicking another point moves
// the popup; the close button removes the view. With --expect-fallback the
// dev view must point at an empty or missing path and the text fallback is
// checked instead (edit ops/project/.../MapStudioDev/view.json, restart with
// ops/up.sh --no-build, run this, then restore the path and restart again).
//
// Usage: node ops/popup-check.mjs [--url http://localhost:9088] [--expect-fallback]
//
// Needs Playwright with its Chromium, like ops/screenshot.mjs. Exits 1 on any
// console error or page error, and when a check fails.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const argUrl = process.argv.indexOf('--url');
const baseUrl = argUrl > -1 ? process.argv[argUrl + 1] : (process.env.GATEWAY_URL ?? 'http://localhost:9088');
const expectFallback = process.argv.includes('--expect-fallback');
const session = `${baseUrl}/data/perspective/client/mapstudio-dev`;

// The map's fixed view and test data (web/typescript/testData.ts), projected
// with the Web Mercator formula as in ops/screenshot.mjs.
const CENTER = [-104.9725, 39.7445];
const ZOOM = 12.5;
const POINTS = {
    p1: { lngLat: [-104.9903, 39.7392], name: 'Point 1' },
    p2: { lngLat: [-104.9750, 39.7500], name: 'Point 2' }
};

function project([lng, lat], zoom) {
    const scale = 512 * Math.pow(2, zoom);
    const x = ((lng + 180) / 360) * scale;
    const rad = (lat * Math.PI) / 180;
    const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale;
    return [x, y];
}

async function main() {
    const browser = await chromium.launch({
        headless: true,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    });
    const errors = [];
    const warnings = [];
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
        page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
            if (msg.type() === 'warning' && msg.text().includes('[MapStudio]')) warnings.push(msg.text());
        });

        await page.goto(session, { waitUntil: 'load' });
        const map = page.locator('.mapstudio-map');
        await map.waitFor({ state: 'visible', timeout: 60_000 });
        await page.locator('.mapstudio-map canvas').waitFor({ state: 'visible', timeout: 30_000 });
        await page.waitForSelector('.connection-banner.banner-active', { state: 'detached', timeout: 30_000 }).catch(() => {});
        await page.waitForTimeout(1500);

        const box = await map.boundingBox();
        if (!box) throw new Error('map container has no bounding box');
        const [cx, cy] = project(CENTER, ZOOM);
        const click = async (id) => {
            const [px, py] = project(POINTS[id].lngLat, ZOOM);
            await page.mouse.click(box.x + box.width / 2 + (px - cx), box.y + box.height / 2 + (py - cy));
        };
        const popup = page.locator('.maplibregl-popup .mapstudio-popup');
        const popupText = async () => (await popup.textContent()).replace(/\s+/g, ' ').trim();

        await click('p1');
        await popup.waitFor({ timeout: 15_000 });
        if (expectFallback) {
            await page.locator('.mapstudio-popup--text').waitFor({ timeout: 30_000 });
            console.log(`fallback popup: ${await popupText()}`);
            if (await page.locator('.mapstudio-popup--view').count() !== 0) throw new Error('a view is mounted in the fallback popup');
        } else {
            // The view's label shows the author param "dev" beside mapItem.
            await page.locator('.mapstudio-popup--view').filter({ hasText: 'Name: Point 1 (dev)' }).waitFor({ timeout: 30_000 });
            console.log(`p1 popup: ${await popupText()}`);
            await click('p2');
            await page.locator('.mapstudio-popup--view').filter({ hasText: 'Id: p2' }).waitFor({ timeout: 30_000 });
            console.log(`p2 popup: ${await popupText()}`);
            const open = await page.locator('.maplibregl-popup').count();
            if (open !== 1) throw new Error(`expected one popup, found ${open}`);
            if (warnings.length) throw new Error(`unexpected Map Studio warning: ${warnings.join('; ')}`);
        }

        await page.locator('.maplibregl-popup-close-button').click();
        await page.locator('.maplibregl-popup').waitFor({ state: 'detached', timeout: 10_000 });
        const left = await page.locator('.mapstudio-popup').count();
        if (left !== 0) throw new Error(`popup content still mounted after close: ${left}`);
        console.log('closed: popup and view removed');
        await page.waitForTimeout(1000);
        console.log(`Map Studio warnings: ${warnings.length ? warnings.join('; ') : 'none'}`);
    } finally {
        await browser.close();
    }
    if (errors.length) {
        console.error(`${errors.length} error(s) in the session:`);
        errors.forEach((e) => console.error(`  ${e}`));
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
