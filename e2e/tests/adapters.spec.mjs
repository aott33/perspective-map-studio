// The kind list and asset list from the project (epic-map-store-and-data, entry 3):
// the dev adapter (project library mapstudio_dev) is switched through each mode on
// the /adapters page, and map.load after a reload reports the matching status,
// count and message for both lists. A viewer gets the kinds and both statuses but
// no asset rows. Two refreshes while a slow call is in flight call it once.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { screenshotDir } from '../lib/env.mjs';
import { EDITOR_USER, editorTest, expect, mapLoaded, nextFrames, openMap, test } from './fixtures.mjs';

const PAGE = '/adapters';
const KINDS_FN = 'mapstudio_dev.kinds';
const ASSETS_FN = 'mapstudio_dev.assets';

async function shot(page, name) {
    await nextFrames(page);
    mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, name), fullPage: false });
}

/** Press a dev page button and wait for its result label to report `mode`; returns the parsed result. */
async function press(page, button, mode) {
    const result = page.locator('#mapstudio-dev-adapter-result');
    await page.locator('#mapstudio-dev-adapter-' + button).click();
    // refreshAdapters waits for both calls; a slow call takes up to two 5 s timeouts.
    await expect(result).toContainText(`"mode":"${mode}"`, { timeout: 60_000 });
    return JSON.parse(await result.textContent());
}

/** Reload the page and read the status element map.load filled in. */
async function statusAfterReload(page) {
    await page.reload({ waitUntil: 'load' });
    const map = await openMap(page, PAGE);
    await mapLoaded(map);
    const el = page.locator('.mapstudio-adapter-status');
    await expect(el).toHaveAttribute('data-kinds-status', /.+/);
    const read = async (name) => el.getAttribute('data-' + name);
    return {
        kinds: { status: await read('kinds-status'), count: await read('kinds-count'), message: await read('kinds-message') },
        assets: { status: await read('assets-status'), count: await read('assets-count'), message: await read('assets-message') },
        kindsRows: await read('kinds-rows'),
        assetsRows: await read('assets-rows')
    };
}

test.describe('1440 px', () => {
    test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    editorTest('each dev adapter mode shows its status, count and message in map.load', async ({ page }) => {
        const map = await openMap(page, PAGE);
        await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
        await mapLoaded(map);

        // The dev adapter mode is Gateway-wide: whatever fails below, put it back to ok.
        try {
            // Start from ok, whatever an earlier run left.
            let r = await press(page, 'ok', 'ok');
            expect(r.kinds.status).toBe('ok');
            let s = await statusAfterReload(page);
            expect(s.kinds).toEqual({ status: 'ok', count: '4', message: `4 kinds from ${KINDS_FN}.` });
            expect(s.assets).toEqual({ status: 'ok', count: '4', message: `4 assets from ${ASSETS_FN}.` });
            expect(s.kindsRows).toBe('4');
            expect(s.assetsRows).toBe('4');
            await shot(page, 'mapstudio-adapters-ok-1440.png');

            // Bad rows: the good ones are kept, the first reasons named.
            await press(page, 'incomplete', 'incomplete');
            s = await statusAfterReload(page);
            expect(s.kinds.status).toBe('incomplete');
            expect(s.kinds.count).toBe('4');
            expect(s.kinds.message).toBe(`2 of 6 kinds from ${KINDS_FN} left out: row 5 (id tank): geometry must be point`
                + ' or line; row 6 (id pad): the id appears twice.');
            expect(s.assets.status).toBe('incomplete');
            expect(s.assets.count).toBe('4');
            expect(s.assets.message).toBe(`2 of 6 assets from ${ASSETS_FN} left out: row 5 (id P99): basePath does not`
                + ' start with a [provider]; row 6 (id T1): kind tank is not in the kind list.');
            expect(s.assetsRows).toBe('4');

            // Raises: failing, naming the function and the error; the last good list is kept and said so.
            await press(page, 'broken', 'broken');
            s = await statusAfterReload(page);
            expect(s.kinds.status).toBe('failing');
            expect(s.kinds.count).toBe('4');
            expect(s.kinds.message).toMatch(new RegExp(`^The kind function ${KINDS_FN} failed: .*The dev adapter is in mode`
                + ' broken \\(kinds\\).* Showing the list from \\d\\d:\\d\\d UTC\\.$'));
            expect(s.assets.status).toBe('failing');
            expect(s.kindsRows).toBe('4');
            await shot(page, 'mapstudio-adapters-failing-1440.png');

            // Empty: a real answer, so the lists are replaced.
            await press(page, 'empty', 'empty');
            s = await statusAfterReload(page);
            expect(s.kinds).toEqual({ status: 'empty', count: '0', message: `The kind function ${KINDS_FN} returned no kinds.` });
            expect(s.assets).toEqual({ status: 'empty', count: '0',
                message: `The asset function ${ASSETS_FN} returned no assets.` });
            expect(s.kindsRows).toBe('0');

            // Slow: no answer within 5 s.
            r = await press(page, 'slow', 'slow');
            expect(r.kinds.status).toBe('slow');
            s = await statusAfterReload(page);
            expect(s.kinds).toEqual({ status: 'slow', count: '0',
                message: `The kind function ${KINDS_FN} did not answer within 5 s.` });
            expect(s.assets.status).toBe('slow');

            // Recovers: back to ok without a Gateway restart.
            r = await press(page, 'ok', 'ok');
            expect(r.kinds.status).toBe('ok');
            expect(r.assets.status).toBe('ok');
            s = await statusAfterReload(page);
            expect(s.kinds.status).toBe('ok');
            expect(s.assets.status).toBe('ok');
            expect(s.assetsRows).toBe('4');
        } finally {
            await press(page, 'ok', 'ok');
        }
    });

    editorTest('two refreshes while a slow call is in flight run the host functions once', async ({ page, context }) => {
        await mapLoaded(await openMap(page, PAGE));
        const other = await context.newPage();
        await mapLoaded(await openMap(other, PAGE));
        await expect(other.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);

        try {
            // The first press switches to slow (zeroing the dev adapter's call counts) and refreshes;
            // the second, from another session within the 5 s timeout, only refreshes and joins it.
            const first = press(page, 'slow', 'slow');
            await other.waitForTimeout(1000);
            const second = press(other, 'refresh', 'refresh');
            const [a, b] = await Promise.all([first, second]);
            expect(a.kinds.status).toBe('slow');
            expect(b.kinds.status).toBe('slow');
            expect(a.calls).toEqual({ kinds: 1, assets: 1 });
            expect(b.calls).toEqual({ kinds: 1, assets: 1 });
        } finally {
            await press(page, 'ok', 'ok');
            await other.close();
        }
    });

    test('a viewer gets the kinds and both statuses but no asset rows, and cannot switch the adapter', async ({ page }) => {
        const map = await openMap(page, PAGE);
        await mapLoaded(map);
        await expect(map).toHaveAttribute('data-edit-level', 'none');
        const el = page.locator('.mapstudio-adapter-status');
        await expect(el).toHaveAttribute('data-kinds-status', 'ok');
        await expect(el).toHaveAttribute('data-kinds-rows', '4');
        await expect(el).toHaveAttribute('data-assets-status', 'ok');
        await expect(el).toHaveAttribute('data-assets-count', '4');
        await expect(el).toHaveAttribute('data-assets-rows', '');

        await page.locator('#mapstudio-dev-adapter-broken').click();
        await expect(page.locator('#mapstudio-dev-adapter-result')).toContainText('needs the MapEditor role');
        const s = await statusAfterReload(page);
        expect(s.kinds.status).toBe('ok');
    });
});
