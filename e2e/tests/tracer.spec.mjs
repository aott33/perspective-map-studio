// The tracer view at 1440 and 390 px: the seeded map items (epic 2 story 11), the round
// trip, the popup view and a drawn line; one screenshot per width for the docs (AD-15).
// On the dev editing page /edit as the map editor (epic 3 entry 14): the spike's Draw a line
// tool is Edit mode's (the editMode prop) and View mode never shows it.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { screenshotDir } from '../lib/env.mjs';
import { TRACER, pagePixel } from '../lib/geo.mjs';
import { EDITOR_USER, VERTEX_PAUSE_MS, editorTest, ensureSeeded, expect, loadedCounts, nextFrames, openMap, test } from './fixtures.mjs';

let seed;
test.beforeAll(async ({ browser }) => {
    seed = await ensureSeeded(browser);
});

for (const [width, height] of [[1440, 900], [390, 844]]) {
    test.describe(`${width} px`, () => {
        test.use({ viewport: { width, height }, deviceScaleFactor: 1 });

        editorTest('map, round trip, popup view and a drawn line', async ({ page }) => {
            const map = await openMap(page, '/edit');
            await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
            // Read back from MapLibre's own item sources by the component, not from its input: at least
            // the tracer's three points and its line (the phone's tiles hold only part of the 30-pad set).
            const counts = await loadedCounts(map);
            expect(counts.points).toBeGreaterThanOrEqual(width === 1440 ? 33 : 3);
            expect(counts.lines).toBeGreaterThanOrEqual(width === 1440 ? 31 : 1);
            const p1 = seed.ids[TRACER.points.p1.key];
            const box = await map.boundingBox();
            expect(box, 'map container has a bounding box').not.toBeNull();
            // The component fills the width of the viewport.
            expect(Math.abs(box.width - width)).toBeLessThanOrEqual(1);

            // One round trip: click p1, the Gateway answers in the envelope.
            const [x, y] = pagePixel(box, TRACER.points.p1.lngLat, TRACER.center, TRACER.zoom);
            await page.mouse.click(x, y);
            const reply = page.locator('.mapstudio-reply');
            await expect(reply).toContainText('Gateway received click on ' + p1, { timeout: 15_000 });

            // The click also opens the project view popup with the point id.
            const popup = page.locator('.maplibregl-popup .mapstudio-popup--view');
            await expect(popup).toContainText('Id: ' + p1, { timeout: 30_000 });

            // Escape cancels a drawing: one vertex, then nothing is drawn.
            const cx = box.x + box.width / 2;
            const cy = box.y + box.height / 2;
            const [a, b] = TRACER.drawOffsets.map(([dx, dy]) => [cx + dx, cy + dy]);
            // Edit mode's tool (the editMode prop on /edit); View mode's pages have none (basemaps.spec.mjs).
            const toggle = page.locator('.mapstudio-draw-button');
            await expect(toggle).toBeVisible();
            await toggle.click();
            await expect(reply).toHaveAttribute('data-drawing', 'true');
            await page.mouse.click(a[0], a[1]);
            await page.waitForTimeout(VERTEX_PAUSE_MS);
            await page.keyboard.press('Escape');
            await expect(reply).toHaveAttribute('data-drawing', 'false');
            await expect(reply).toHaveAttribute('data-line-points', '');
            await expect(page.locator('.mapstudio-draw-button[aria-pressed="true"]')).toHaveCount(0);

            // A two-vertex line finished with Enter.
            await toggle.click();
            await expect(reply).toHaveAttribute('data-drawing', 'true');
            await page.mouse.click(a[0], a[1]);
            await page.waitForTimeout(VERTEX_PAUSE_MS);
            await page.mouse.click(b[0], b[1]);
            await page.waitForTimeout(VERTEX_PAUSE_MS);
            await page.keyboard.press('Enter');
            await expect(reply).toHaveAttribute('data-line-points', '2');
            await expect(reply.locator('.mapstudio-draw-status')).toContainText('Line drawn with 2 points');
            // Let the map draw the finished line: two frame boundaries, not a time.
            await nextFrames(page);

            mkdirSync(screenshotDir, { recursive: true });
            await page.screenshot({ path: path.join(screenshotDir, `mapstudio-dev-${width}.png`), fullPage: false });
        });
    });
}
