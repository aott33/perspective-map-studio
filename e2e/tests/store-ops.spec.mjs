// Map store states (epic-map-store-and-data, entry 5): the check project mapstudio-check
// on connection MapStudioCheck, driven by ops/store-checks.sh, which sets the check
// database for each scenario and passes MAPSTUDIO_STORE_SCENARIO:
//   unavailable  the migration failed (rights, or a table in the way): the map says so
//   ready        after the grant is fixed, the map heals without a Gateway restart
//   read-only    the schema is newer than the module: the map is read, a save is refused
//                read-only, nothing is written, getMap's list says readOnly
// Skipped in the plain suite (no scenario set). Screenshots at 1440 and 390 px (AD-15).

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { gatewayUrl, screenshotDir } from '../lib/env.mjs';
import { TRACER } from '../lib/geo.mjs';
import { expect, nextFrames, test } from './fixtures.mjs';

const SCENARIO = process.env.MAPSTUDIO_STORE_SCENARIO ?? '';
// ops/store-checks.sh sets 0 for a second run of a scenario, so the screenshots show the first.
const SHOTS = process.env.MAPSTUDIO_STORE_SHOTS !== '0';
const CHECK_PROJECT = 'mapstudio-check';
// As in store.spec.mjs: only keeps two clicks from reading as a double click.
const VERTEX_PAUSE_MS = 300;

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

async function drawLine(page, map) {
    const box = await map.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const [a, b] = TRACER.drawOffsets.map(([dx, dy]) => [cx + dx, cy + dy]);
    const reply = page.locator('.mapstudio-reply');
    await page.locator('.mapstudio-draw-button').click();
    await expect(reply).toHaveAttribute('data-drawing', 'true');
    await page.mouse.click(a[0], a[1]);
    await page.waitForTimeout(VERTEX_PAUSE_MS);
    await page.mouse.click(b[0], b[1]);
    await page.waitForTimeout(VERTEX_PAUSE_MS);
    await page.keyboard.press('Enter');
    await expect(reply).toHaveAttribute('data-line-points', '2');
}

async function shot(page, name) {
    if (!SHOTS) return;
    await nextFrames(page);
    mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, name), fullPage: false });
}

/** getMap through the check view's button: {count, readOnly} or {error}. */
async function getMapResult(page) {
    const out = page.locator('#mapstudio-check-getmap-result');
    await page.locator('#mapstudio-check-getmap').click();
    await expect(out).toContainText('{', { timeout: 60_000 });
    return JSON.parse(await out.innerText());
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
            // Epic 2 story 8: no map item drawn as current, and the draw tool is off.
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
            const reason = 'The map store was upgraded by a newer Map Studio (schema 999, this module knows 1); '
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
});
