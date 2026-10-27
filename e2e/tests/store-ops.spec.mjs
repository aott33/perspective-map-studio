// Map store states (epic-map-store-and-data, entry 5): the check project mapstudio-check
// on connection MapStudioCheck, driven by ops/store-checks.sh, which sets the check
// database for each scenario and passes MAPSTUDIO_STORE_SCENARIO:
//   unavailable  the migration failed (rights, or a table in the way): the map says so
//   ready        after the grant is fixed, the map heals without a Gateway restart
//   read-only    the schema is newer than the module: the map is read, a save is refused
//                read-only, nothing is written, getMap's list says readOnly
//   upgraded     (epic 2 story 14) a schema 1 store with an item, upgraded to 2: the item reads back
//                through getMap and map.load with attachment null and nothing else changed
// Skipped in the plain suite (no scenario set). Screenshots at 1440 and 390 px (AD-15).

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { gatewayUrl, screenshotDir } from '../lib/env.mjs';
import { drawLine, expect, nextFrames, test } from './fixtures.mjs';

const SCENARIO = process.env.MAPSTUDIO_STORE_SCENARIO ?? '';
// ops/store-checks.sh sets 0 for a second run of a scenario, so the screenshots show the first.
const SHOTS = process.env.MAPSTUDIO_STORE_SHOTS !== '0';
const CHECK_PROJECT = 'mapstudio-check';

test.skip(SCENARIO === '', 'run by ops/store-checks.sh (MAPSTUDIO_STORE_SCENARIO)');

/** Open the check project's map and wait until it is ready and map.load has answered. */
async function openCheckMap(page) {
    await page.goto(`${gatewayUrl()}/data/perspective/client/${CHECK_PROJECT}`, { waitUntil: 'load' });
    const map = page.locator('.mapstudio-map');
    await map.waitFor({ state: 'visible', timeout: 60_000 });
    await page.waitForSelector('.connection-banner.banner-active', { state: 'detached', timeout: 30_000 }).catch(() => {});
    await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 60_000 });
    await expect(map).not.toHaveAttribute('data-load-state', 'loading', { timeout: 60_000 });
    return map;
}

async function shot(page, name) {
    if (!SHOTS) return;
    await nextFrames(page);
    mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, name), fullPage: false });
}

/** getMap through the check view's button: {count, readOnly} or {error}. */
/** getMap's answer on the check view: {count, readOnly}, with the records it read under `items`. */
async function getMapAnswer(page) {
    const out = page.locator('#mapstudio-check-getmap-result');
    await page.locator('#mapstudio-check-getmap').click();
    await expect(out).toContainText('{', { timeout: 60_000 });
    return JSON.parse(await out.innerText());
}

async function getMapResult(page) {
    const { items, ...rest } = await getMapAnswer(page);
    return rest;
}

for (const [width, height] of [[1440, 900], [390, 844]]) {
    test.describe(`${width} px`, () => {
        test.use({ viewport: { width, height }, deviceScaleFactor: 1 });

        test('an unavailable map store says so in plain words', async ({ page }) => {
            test.skip(SCENARIO !== 'unavailable');
            const map = await openCheckMap(page);
            await expect(map).toHaveAttribute('data-load-state', 'failed');
            await expect(map).toHaveAttribute('data-store-state', 'unavailable');
            const status = page.locator('.mapstudio-load-status');
            await expect(status).toContainText('store-unreachable: The map store is unavailable');
            await expect(status).toContainText('MapStudioCheck');
            await expect(status).toContainText('Ask an administrator (see the Gateway log).');
            // Epic 2 story 8: the draw tool is off. This map never loaded items, so items 0 only
            // checks the attribute; a store that fails after items were drawn, with a queued line
            // kept, is unsaved.spec.mjs ("a map.load that fails after the map loaded").
            await expect(map).toHaveAttribute('data-items-loaded', '0');
            await expect(map).toHaveAttribute('data-editing', 'off');
            await expect(page.locator('.mapstudio-draw-button')).toBeDisabled();
            await shot(page, `mapstudio-store-unavailable-${width}.png`);
        });

        test('a read-only map store shows the map and refuses a save', async ({ page }) => {
            test.skip(SCENARIO !== 'read-only');
            let map = await openCheckMap(page);
            await expect(map).toHaveAttribute('data-load-state', 'loaded');
            await expect(map).toHaveAttribute('data-store-state', 'read-only');
            const before = Number(await map.getAttribute('data-items-loaded'));
            const reason = 'The map store was upgraded by a newer Map Studio (schema 999, this module knows 2); '
                + 'saving is off until the module is upgraded.';
            await expect(page.locator('.mapstudio-store-status')).toHaveText('Map store: read only. ' + reason);

            // The store state is checked before the role (story 1's order), so this anonymous
            // viewer's save is refused read-only, not role.
            await drawLine(page, map);
            const save = page.locator('.mapstudio-save-status');
            await expect(save).toHaveAttribute('data-save-state', 'refused', { timeout: 30_000 });
            await expect(save).toHaveAttribute('data-code', 'read-only');
            await expect(save).toContainText('Not saved: ' + reason);
            await shot(page, `mapstudio-store-readonly-${width}.png`);

            expect(await getMapResult(page)).toEqual({ count: before, readOnly: reason });

            await page.reload({ waitUntil: 'load' });
            map = await openCheckMap(page);
            await expect(map).toHaveAttribute('data-items-loaded', String(before));
        });
    });
}

test.describe('healing', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('after the grant is fixed the map store heals without a restart', async ({ page }) => {
        test.skip(SCENARIO !== 'ready');
        // The first map.load after the retry interval starts the migrator and still answers
        // unavailable; a later load finds the store ready.
        let map = await openCheckMap(page);
        for (let attempt = 0; attempt < 12; attempt++) {
            if ((await map.getAttribute('data-store-state')) === 'ready') break;
            await page.waitForTimeout(5_000);
            await page.reload({ waitUntil: 'load' });
            map = await openCheckMap(page);
        }
        await expect(map).toHaveAttribute('data-store-state', 'ready');
        await expect(map).toHaveAttribute('data-load-state', 'loaded');
        await expect(page.locator('.mapstudio-load-status')).toHaveCount(0);
        expect(await getMapResult(page)).toEqual({ count: 0, readOnly: null });
    });

    test('a store left at schema 1 with a map item is upgraded once its owner role is used', async ({ page }) => {
        test.skip(SCENARIO !== 'upgraded');
        // Epic 2 story 14: migration 2 (ALTER TABLE) ran after the tables' owner was fixed; the item
        // saved at schema 1 is still there.
        let map = await openCheckMap(page);
        for (let attempt = 0; attempt < 12; attempt++) {
            if ((await map.getAttribute('data-store-state')) === 'ready') break;
            await page.waitForTimeout(5_000);
            await page.reload({ waitUntil: 'load' });
            map = await openCheckMap(page);
        }
        await expect(map).toHaveAttribute('data-store-state', 'ready');
        const answer = await getMapAnswer(page);
        expect({ count: answer.count, readOnly: answer.readOnly }).toEqual({ count: 1, readOnly: null });
        // The schema 1 pad reads back through the module with attachment null and nothing else changed,
        // from getMap and from map.load (the component's real session path, web/typescript/testHook.ts).
        const schema1 = { id: 'c0ffee00-0000-4000-8000-000000000001', kind: 'pad', name: 'Schema 1 pad',
            geometry: { type: 'Point', coordinates: [-104.97, 39.74] }, properties: {}, assetId: null, overrides: {},
            ends: null, attachment: null, version: 1, deleted: false };
        expect(answer.items).toEqual([schema1]);
        await page.waitForFunction(() => Boolean(window.__mapStudioTest));
        const reply = await page.evaluate(() => window.__mapStudioTest.send('map.load', {}));
        expect(reply.type, JSON.stringify(reply.body)).toBe('map.load.reply');
        expect(reply.body.items).toEqual([schema1]);
    });
});
