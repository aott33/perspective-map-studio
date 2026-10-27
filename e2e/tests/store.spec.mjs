// The map store tracer (epic-map-store-and-data, entry 1): a map editor's line is
// saved through edits.apply and drawn from map.load after a reload; a viewer's
// save is refused on the Gateway; system.mapstudio saves through the same write
// service. Screenshots at 1440 and 390 px for the docs (AD-15).

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { screenshotDir } from '../lib/env.mjs';
import { TRACER } from '../lib/geo.mjs';
import { EDITOR_USER, editorTest, expect, mapLoaded, nextFrames, openMap, test } from './fixtures.mjs';

// Terra Draw shows no state between two vertex clicks; the pause only keeps two
// clicks from reading as a double click (as in tracer.spec.mjs).
const VERTEX_PAUSE_MS = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Draw a two-vertex line with the dev line tool and finish it with Enter. */
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
    await nextFrames(page);
    mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, name), fullPage: false });
}

for (const [width, height] of [[1440, 900], [390, 844]]) {
    test.describe(`${width} px`, () => {
        test.use({ viewport: { width, height }, deviceScaleFactor: 1 });

        editorTest('a map editor saves a line and it comes back from the map store after a reload', async ({ page }) => {
            // Signed in by the global setup (lib/editorAuth.mjs): the password never passes through this test.
            let map = await openMap(page, '/edit');
            await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
            const before = await mapLoaded(map);
            await expect(map).toHaveAttribute('data-edit-level', 'full');

            await drawLine(page, map);
            const status = page.locator('.mapstudio-save-status');
            await expect(status).toHaveAttribute('data-save-state', 'saved', { timeout: 30_000 });
            await expect(status).toHaveAttribute('data-version', '1');
            await expect(status).toContainText('Saved as version 1');
            expect(await status.getAttribute('data-item-id')).toMatch(UUID);
            await expect(map).toHaveAttribute('data-items-loaded', String(before + 1));
            await shot(page, `mapstudio-store-editor-${width}.png`);

            // Drawn from map.load after a reload, not from the browser's memory.
            await page.reload({ waitUntil: 'load' });
            map = await openMap(page, '/edit');
            expect(await mapLoaded(map)).toBe(before + 1);
            await expect(map).toHaveAttribute('data-edit-level', 'full');
            await expect(page.locator('.mapstudio-save-status')).toHaveCount(0);
            await shot(page, `mapstudio-store-editor-reload-${width}.png`);
        });

        test('a viewer\'s save is refused on the Gateway and nothing is written', async ({ page }) => {
            let map = await openMap(page, '/');
            const before = await mapLoaded(map);
            await expect(map).toHaveAttribute('data-edit-level', 'none');

            await drawLine(page, map);
            const status = page.locator('.mapstudio-save-status');
            await expect(status).toHaveAttribute('data-save-state', 'refused', { timeout: 30_000 });
            await expect(status).toHaveAttribute('data-code', 'role');
            await expect(status).toContainText('Not saved: You do not have a role that lets you change the map.');
            // The drawing status still says what was drawn; the line stays on the map as not saved.
            await expect(page.locator('.mapstudio-draw-status')).toContainText('Line drawn with 2 points');
            await expect(map).toHaveAttribute('data-items-loaded', String(before));
            await shot(page, `mapstudio-store-viewer-${width}.png`);

            await page.reload({ waitUntil: 'load' });
            map = await openMap(page, '/');
            expect(await mapLoaded(map)).toBe(before);
        });
    });
}

test.describe('scripting API', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('the dev page\'s script checks write nothing for a session without MapEditor', async ({ page }) => {
        let map = await openMap(page, '/edit');
        await expect(page.locator('#mapstudio-dev-user')).toContainText('Not signed in');
        const before = await mapLoaded(map);
        await page.locator('#mapstudio-dev-script-checks').click();
        const out = page.locator('#mapstudio-dev-script-results');
        await expect(out).toContainText('"refused"', { timeout: 60_000 });
        expect(JSON.parse(await out.innerText()).refused).toMatch(/need the MapEditor role/);
        await page.reload({ waitUntil: 'load' });
        map = await openMap(page, '/edit');
        expect(await mapLoaded(map)).toBe(before);
    });

    editorTest('system.mapstudio.applyEdits and getMap use the same write path', async ({ page }) => {
        let map = await openMap(page, '/edit');
        await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
        const before = await mapLoaded(map);
        await page.locator('#mapstudio-dev-script-checks').click();
        const out = page.locator('#mapstudio-dev-script-results');
        await expect(out).toContainText('"results"', { timeout: 60_000 });
        const { pointId, results } = JSON.parse(await out.innerText());
        const byName = Object.fromEntries(results.map((r) => [r.name, r]));
        expect(pointId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

        expect(byName.create.ok).toBe(true);
        expect(byName.create.value.results).toEqual([{ entity: 'item', id: pointId, version: 1 }]);
        expect(byName.getMapAfterCreate.value).toBe(1);
        expect(byName.updateAtStoredVersion.ok).toBe(true);
        expect(byName.updateAtStoredVersion.value.results[0].version).toBe(2);
        expect(byName.updateAtStoredVersion.value.seq).toBe(byName.create.value.seq + 1);
        expect(byName.updateAtOldVersion.ok).toBe(false);
        expect(byName.updateAtOldVersion.error).toMatch(/^conflict: /);
        // Deletes are supported from epic 2 story 2: the check sends a stale one, refused with conflict.
        expect(byName.staleDelete.ok).toBe(false);
        expect(byName.staleDelete.error).toMatch(/^conflict: /);
        expect(byName.noActor.ok).toBe(false);
        expect(byName.noActor.error).toMatch(/^invalid: applyEdits needs an actor/);
        expect(byName.unknownProject.ok).toBe(false);
        expect(byName.unknownProject.error).toMatch(/^store-unreachable: Project no-such-project has no Map Studio setup/);
        expect(byName.getMapAtEnd.value).toBe(2);
        expect(byName.ping.value).toMatch(/^Map Studio pong at /);

        // A reload draws the script's point from the map store.
        await page.reload({ waitUntil: 'load' });
        map = await openMap(page, '/edit');
        expect(await mapLoaded(map)).toBe(before + 1);
    });
});
