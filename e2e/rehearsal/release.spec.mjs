// The release smoke's browser check (epic 3 entry 4), run by ops/release-smoke.sh: what item 6 of
// docs/template-install.md "0.2.0 release" did with a scratch script, committed. Two Chromium
// instances (two browsers, not two contexts of one), each signed in as the dev map editor on /edit:
// a line drawn in browser A (1440 px) is on browser B's map (390 px) within 5 s, without a reload
// (data-map-reloads stays 0, a page marker is kept), both at edit level full, no console or page
// error in either. The result (the time until B showed it) goes to e2e/out/rehearsal/result.json
// for the smoke's summary, with a screenshot of each browser beside it.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { outDir } from '../lib/env.mjs';
import { launchOptions } from '../lib/editorAuth.mjs';
import { EDITOR_USER, drawLine, expect, mapLoaded, nextFrames, openMap, signedInContext, test, watch } from '../tests/fixtures.mjs';

/** The bound the template rehearsal used: a saved edit is on the other browser's map within 5 s. */
const PUSH_MS = 5_000;
const resultDir = path.join(outDir, 'rehearsal');

test('a line saved in one browser is on a second browser\'s map without a reload', async ({ browser }) => {
    // Browser B: its own Chromium instance, signed in the same way, at phone width.
    const browserB = await chromium.launch({ ...launchOptions(), headless: process.env.E2E_HEADED !== '1' });
    const contextB = await signedInContext(browserB, EDITOR_USER, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const contextA = await signedInContext(browser, EDITOR_USER, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const pageB = await contextB.newPage();
    const pageA = await contextA.newPage();
    const watchB = watch(pageB);
    const watchA = watch(pageA);
    try {
        const mapB = await openMap(pageB, '/edit');
        await expect(pageB.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
        const beforeB = await mapLoaded(mapB);
        await expect(mapB).toHaveAttribute('data-edit-level', 'full');
        await expect(mapB).toHaveAttribute('data-map-reloads', '0');
        await pageB.evaluate(() => { window.__mapStudioRehearsalMarker = 'kept'; });

        const mapA = await openMap(pageA, '/edit');
        await expect(pageA.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
        const beforeA = await mapLoaded(mapA);
        await expect(mapA).toHaveAttribute('data-edit-level', 'full');
        expect(beforeA, 'both browsers loaded the same map').toBe(beforeB);

        await drawLine(pageA, mapA);
        const status = pageA.locator('.mapstudio-save-status');
        await expect(status).toHaveAttribute('data-save-state', 'saved', { timeout: 30_000 });
        const saved = Date.now();
        await expect(mapB).toHaveAttribute('data-items-loaded', String(beforeB + 1), { timeout: PUSH_MS });
        const seenAfterMs = Date.now() - saved;
        expect(seenAfterMs).toBeLessThan(PUSH_MS);
        await expect(mapB).toHaveAttribute('data-map-reloads', '0');
        expect(await pageB.evaluate(() => window.__mapStudioRehearsalMarker)).toBe('kept');
        await expect(mapA).toHaveAttribute('data-items-loaded', String(beforeA + 1));
        await expect(mapB).toHaveAttribute('data-store-seq', /^[0-9]+$/);
        await expect(mapA).toHaveAttribute('data-store-seq', await mapB.getAttribute('data-store-seq'));

        mkdirSync(resultDir, { recursive: true });
        await nextFrames(pageA);
        await nextFrames(pageB);
        await pageA.screenshot({ path: path.join(resultDir, 'two-browsers-A-1440.png'), fullPage: false });
        await pageB.screenshot({ path: path.join(resultDir, 'two-browsers-B-390.png'), fullPage: false });
        writeFileSync(path.join(resultDir, 'result.json'), JSON.stringify({
            check: 'two browsers, a line saved in A seen in B without a reload',
            itemsBefore: beforeB,
            itemsAfter: beforeB + 1,
            seenAfterMs,
            boundMs: PUSH_MS,
            storeSeq: Number(await mapB.getAttribute('data-store-seq')),
            chromium: browser.version()
        }, null, 2) + '\n');
        expect(watchB.errors, 'browser B console and page errors').toEqual([]);
        expect(watchA.errors, 'browser A console and page errors').toEqual([]);
    } finally {
        await contextA.close();
        await contextB.close();
        await browserB.close();
    }
});
