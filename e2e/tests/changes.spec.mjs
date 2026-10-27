// Saved edits reach every open map at once (epic-map-store-and-data, entry 4): a
// map editor's line and a script's point appear on an anonymous viewer's open map
// through map.changed, without a page reload and without a gap reload.
// Screenshots of the viewer at 1440 and 390 px for the docs (AD-15).

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { screenshotDir } from '../lib/env.mjs';
import { TRACER } from '../lib/geo.mjs';
import { EDITOR_USER, editorTest, expect, mapLoaded, nextFrames, openMap, watch } from './fixtures.mjs';

// As in store.spec.mjs: the pause only keeps two vertex clicks from reading as a double click.
const VERTEX_PAUSE_MS = 300;
/** The story's bound: a saved edit is on the other open map within 5 s. */
const PUSH_MS = 5_000;

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

for (const [width, height] of [[1440, 900], [390, 844]]) {
    editorTest.describe(`${width} px`, () => {
        editorTest.use({ viewport: { width, height }, deviceScaleFactor: 1 });

        editorTest('a saved line and a script\'s point reach an open viewer\'s map without a reload', async ({ page, browser }) => {
            // The viewer: a second, anonymous browser context on the view page.
            const viewerContext = await browser.newContext({
                viewport: { width, height }, deviceScaleFactor: 1, storageState: { cookies: [], origins: [] }
            });
            const viewer = await viewerContext.newPage();
            const viewerWatch = watch(viewer);
            try {
                const viewerMap = await openMap(viewer, '/');
                const viewerBefore = await mapLoaded(viewerMap);
                await expect(viewerMap).toHaveAttribute('data-edit-level', 'none');
                await expect(viewerMap).toHaveAttribute('data-map-reloads', '0');
                // A marker that a page navigation or reload would lose.
                await viewer.evaluate(() => { window.__mapStudioChangesMarker = 'kept'; });

                const editorMap = await openMap(page, '/edit');
                await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
                const editorBefore = await mapLoaded(editorMap);
                expect(editorBefore).toBe(viewerBefore);

                await drawLine(page, editorMap);
                const status = page.locator('.mapstudio-save-status');
                await expect(status).toHaveAttribute('data-save-state', 'saved', { timeout: 30_000 });
                const saved = Date.now();
                await expect(viewerMap).toHaveAttribute('data-items-loaded', String(viewerBefore + 1), { timeout: PUSH_MS });
                expect(Date.now() - saved).toBeLessThan(PUSH_MS);
                expect(await viewer.evaluate(() => window.__mapStudioChangesMarker)).toBe('kept');
                await expect(viewerMap).toHaveAttribute('data-map-reloads', '0');
                // The editor's own map.changed changes nothing it already drew.
                await expect(editorMap).toHaveAttribute('data-items-loaded', String(editorBefore + 1));
                await expect(viewerMap).toHaveAttribute('data-store-seq', /^[0-9]+$/);
                await expect(editorMap).toHaveAttribute('data-store-seq', await viewerMap.getAttribute('data-store-seq'));
                await nextFrames(viewer);
                mkdirSync(screenshotDir, { recursive: true });
                await viewer.screenshot({ path: path.join(screenshotDir, `mapstudio-changes-${width}.png`), fullPage: false });

                // A script save (system.mapstudio.applyEdits from the dev page) reaches the viewer too.
                await page.locator('#mapstudio-dev-script-checks').click();
                const out = page.locator('#mapstudio-dev-script-results');
                await expect(out).toContainText('"results"', { timeout: 60_000 });
                const { results } = JSON.parse(await out.innerText());
                const byName = Object.fromEntries(results.map((r) => [r.name, r]));
                expect(byName.updateAtStoredVersion.ok).toBe(true);
                // The script's last save is story 9's CSV pad, after its kind setup save: a viewer
                // applies the kind setup's map.changed (sent without its setup) with no reload.
                expect(byName.kindSetupSave.ok).toBe(true);
                expect(byName.itemCsvNumber.ok).toBe(true);
                const scriptSeq = byName.itemCsvNumber.value.seq;
                expect(scriptSeq).toBeGreaterThan(byName.kindSetupSave.value.seq);
                // Three items of stories 1 and 9, and story 14's line and tap.
                await expect(viewerMap).toHaveAttribute('data-items-loaded', String(viewerBefore + 5), { timeout: PUSH_MS });
                await expect(viewerMap).toHaveAttribute('data-store-seq', String(scriptSeq), { timeout: PUSH_MS });
                await expect(editorMap).toHaveAttribute('data-store-seq', String(scriptSeq), { timeout: PUSH_MS });
                await expect(editorMap).toHaveAttribute('data-items-loaded', String(editorBefore + 5));
                expect(await viewer.evaluate(() => window.__mapStudioChangesMarker)).toBe('kept');
                await expect(viewerMap).toHaveAttribute('data-map-reloads', '0');
                await expect(editorMap).toHaveAttribute('data-map-reloads', '0');
                expect(viewerWatch.errors, 'viewer console and page errors').toEqual([]);
                expect(viewerWatch.warnings, 'viewer Map Studio warnings').toEqual([]);
            } finally {
                await viewerContext.close();
            }
        });
    });
}
