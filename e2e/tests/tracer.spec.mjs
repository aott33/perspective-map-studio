// The tracer view at 1440 and 390 px: points, line, the round trip, the popup
// view and a drawn line; one screenshot per width for the docs (AD-15).

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { screenshotDir } from '../lib/env.mjs';
import { TRACER, pagePixel } from '../lib/geo.mjs';
import { expect, openMap, test } from './fixtures.mjs';

for (const [width, height] of [[1440, 900], [390, 844]]) {
    test.describe(`${width} px`, () => {
        test.use({ viewport: { width, height }, deviceScaleFactor: 1 });

        test('map, round trip, popup view and a drawn line', async ({ page }) => {
            const map = await openMap(page, '/');
            await expect(map).toHaveAttribute('data-test-set', 'tracer');
            await expect(map).toHaveAttribute('data-feature-count', '4');
            const box = await map.boundingBox();
            expect(box, 'map container has a bounding box').not.toBeNull();
            // The component fills the width of the viewport.
            expect(Math.abs(box.width - width)).toBeLessThanOrEqual(1);

            // One round trip: click p1, the Gateway answers in the envelope.
            const [x, y] = pagePixel(box, TRACER.points.p1.lngLat, TRACER.center, TRACER.zoom);
            await page.mouse.click(x, y);
            const reply = page.locator('.mapstudio-reply');
            await expect(reply).toContainText('Gateway received click on p1', { timeout: 15_000 });

            // The click also opens the project view popup with the point id.
            const popup = page.locator('.maplibregl-popup .mapstudio-popup--view');
            await expect(popup).toContainText('Id: p1', { timeout: 30_000 });

            // Escape cancels a drawing: one vertex, then nothing is drawn.
            const cx = box.x + box.width / 2;
            const cy = box.y + box.height / 2;
            const [a, b] = TRACER.drawOffsets.map(([dx, dy]) => [cx + dx, cy + dy]);
            const toggle = page.locator('.mapstudio-draw-button');
            await toggle.click();
            await expect(reply).toHaveAttribute('data-drawing', 'true');
            await page.mouse.click(a[0], a[1]);
            await page.waitForTimeout(300);
            await page.keyboard.press('Escape');
            await expect(reply).toHaveAttribute('data-drawing', 'false');
            await expect(reply).toHaveAttribute('data-line-points', '');
            await expect(page.locator('.mapstudio-draw-button[aria-pressed="true"]')).toHaveCount(0);

            // A two-vertex line finished with Enter.
            await toggle.click();
            await expect(reply).toHaveAttribute('data-drawing', 'true');
            await page.mouse.click(a[0], a[1]);
            await page.waitForTimeout(300);
            await page.mouse.click(b[0], b[1]);
            await page.waitForTimeout(300);
            await page.keyboard.press('Enter');
            await expect(reply).toHaveAttribute('data-line-points', '2');
            await expect(reply.locator('.mapstudio-draw-status')).toContainText('Line drawn with 2 points');
            // Let Terra Draw's layers render the finished line.
            await page.waitForTimeout(500);

            mkdirSync(screenshotDir, { recursive: true });
            await page.screenshot({ path: path.join(screenshotDir, `mapstudio-dev-${width}.png`), fullPage: false });
        });
    });
}
