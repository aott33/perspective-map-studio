// The kind list and asset list from the project (epic-map-store-and-data, entry 3):
// the dev adapter (project library mapstudio_dev) is switched through each mode on
// the /adapters page, and map.load after a reload reports the matching status,
// count and message for both lists. A viewer gets the kinds and both statuses but
// no asset rows. Two refreshes while a slow call is in flight call it once. With the
// kind list empty a save is refused (epic 2 story 12: was unit tested only).

import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { screenshotDir } from '../lib/env.mjs';
import { EDITOR_USER, editorTest, expect, mapLoaded, nextFrames, openMap, test } from './fixtures.mjs';

const PAGE = '/adapters';
const KINDS_FN = 'mapstudio_dev.kinds';
const ASSETS_FN = 'mapstudio_dev.assets';

/** Send one message through the page's component (window.__mapStudioTest) and return the reply envelope. */
async function send(page, type, body) {
    await page.waitForFunction(() => Boolean(window.__mapStudioTest));
    return page.evaluate(([t, b]) => window.__mapStudioTest.send(t, b), [type, body]);
}

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
            expect(s.kinds).toEqual({ status: 'ok', count: '5', message: `5 kinds from ${KINDS_FN}.` });
            expect(s.assets).toEqual({ status: 'ok', count: '10', message: `10 assets from ${ASSETS_FN}.` });
            expect(s.kindsRows).toBe('5');
            expect(s.assetsRows).toBe('10');
            await shot(page, 'mapstudio-adapters-ok-1440.png');

            // Bad rows: the good ones are kept, the first reasons named.
            await press(page, 'incomplete', 'incomplete');
            s = await statusAfterReload(page);
            expect(s.kinds.status).toBe('incomplete');
            expect(s.kinds.count).toBe('5');
            expect(s.kinds.message).toBe(`2 of 7 kinds from ${KINDS_FN} left out: row 6 (id tank): geometry must be point`
                + ' or line; row 7 (id pad): the id appears twice.');
            expect(s.assets.status).toBe('incomplete');
            expect(s.assets.count).toBe('10');
            expect(s.assets.message).toBe(`2 of 12 assets from ${ASSETS_FN} left out: row 11 (id P99): basePath does not`
                + ' start with a [provider]; row 12 (id T1): kind tank is not in the kind list.');
            expect(s.assetsRows).toBe('10');

            // Raises: failing, naming the function and the error; the last good list is kept and said so.
            await press(page, 'broken', 'broken');
            s = await statusAfterReload(page);
            expect(s.kinds.status).toBe('failing');
            expect(s.kinds.count).toBe('5');
            expect(s.kinds.message).toMatch(new RegExp(`^The kind function ${KINDS_FN} failed: .*The dev adapter is in mode`
                + ' broken \\(kinds\\).* Showing the list from \\d\\d:\\d\\d UTC\\.$'));
            expect(s.assets.status).toBe('failing');
            expect(s.kindsRows).toBe('5');
            await shot(page, 'mapstudio-adapters-failing-1440.png');

            // Empty: a real answer, so the lists are replaced.
            await press(page, 'empty', 'empty');
            s = await statusAfterReload(page);
            expect(s.kinds).toEqual({ status: 'empty', count: '0', message: `The kind function ${KINDS_FN} returned no kinds.` });
            expect(s.assets).toEqual({ status: 'empty', count: '0',
                message: `The asset function ${ASSETS_FN} returned no assets.` });
            expect(s.kindsRows).toBe('0');
            // With no kind list a save other than a delete is refused, and nothing is saved.
            const before = await send(page, 'map.load', {});
            expect(before.type, JSON.stringify(before.body)).toBe('map.load.reply');
            const refused = await send(page, 'edits.apply', { batchId: randomUUID(), ops: [{
                op: 'create', entity: 'item', id: randomUUID(), baseVersion: 0,
                data: { kind: 'pad', name: 'Kind list empty', properties: { status: 'producing' },
                    geometry: { type: 'Point', coordinates: [-104.97, 39.74] } }
            }] });
            expect(refused.type, JSON.stringify(refused.body)).toBe('error');
            expect(refused.body.code).toBe('invalid');
            expect(refused.body.message).toBe(`The kind list is not available (empty): The kind function ${KINDS_FN}`
                + ' returned no kinds. Nothing was saved.');
            const after = await send(page, 'map.load', {});
            expect(after.type, JSON.stringify(after.body)).toBe('map.load.reply');
            expect(after.body.seq).toBe(before.body.seq);
            expect(after.body.items.length).toBe(before.body.items.length);

            // Slow: no answer within 5 s.
            r = await press(page, 'slow', 'slow');
            expect(r.kinds.status).toBe('slow');
            s = await statusAfterReload(page);
            expect(s.kinds).toEqual({ status: 'slow', count: '0',
                message: `The kind function ${KINDS_FN} did not answer within 5 s.` });
            expect(s.assets.status).toBe('slow');

            // Recovers: back to ok without a Gateway restart. The dev setup's refresh interval is 10 s
            // (epic 3 entry 5), so a periodic refresh begun in mode slow is usually still in flight
            // when ok is pressed, and that press joins it (one call per function at a time) and
            // reports slow once more; the next press is the recovery.
            r = await press(page, 'ok', 'ok');
            for (let again = 0; again < 3 && (r.kinds.status !== 'ok' || r.assets.status !== 'ok'); again++) {
                // The result already says mode ok, so wait for a new result, not for the mode.
                const result = page.locator('#mapstudio-dev-adapter-result');
                const before = await result.textContent();
                await page.locator('#mapstudio-dev-adapter-ok').click();
                await expect.poll(() => result.textContent(), { timeout: 60_000 }).not.toBe(before);
                r = JSON.parse(await result.textContent());
            }
            expect(r.kinds.status).toBe('ok');
            expect(r.assets.status).toBe('ok');
            s = await statusAfterReload(page);
            expect(s.kinds.status).toBe('ok');
            expect(s.assets.status).toBe('ok');
            expect(s.assetsRows).toBe('10');
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
            // The 1 s wait is a stated margin, not a synchronisation: nothing observable shows the first
            // call in flight before its reply at 5 s, so the second press lands 1 s into a 5 s window (4 s spare).
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
        await expect(el).toHaveAttribute('data-kinds-rows', '5');
        await expect(el).toHaveAttribute('data-assets-status', 'ok');
        await expect(el).toHaveAttribute('data-assets-count', '10');
        await expect(el).toHaveAttribute('data-assets-rows', '');

        await page.locator('#mapstudio-dev-adapter-broken').click();
        await expect(page.locator('#mapstudio-dev-adapter-result')).toContainText('needs the MapEditor role');
        const s = await statusAfterReload(page);
        expect(s.kinds.status).toBe('ok');
    });
});
