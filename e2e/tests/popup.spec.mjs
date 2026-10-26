// The point popup: a project view by path with its params, a second point
// moves it, close unmounts it; and the text fallback for an empty and for a
// missing view path (their own dev pages, so no Gateway restart is needed).

import { TRACER, pagePixel } from '../lib/geo.mjs';
import { expect, openMap, test } from './fixtures.mjs';

test.use({ viewport: { width: 1440, height: 900 } });

async function clickPoint(page, map, id) {
    const box = await map.boundingBox();
    const [x, y] = pagePixel(box, TRACER.points[id].lngLat, TRACER.center, TRACER.zoom);
    await page.mouse.click(x, y);
}

test('custom view with author params, a second point, close', async ({ page, watched }) => {
    const map = await openMap(page, '/');
    await clickPoint(page, map, 'p1');
    // The view's label shows the author param "dev" beside mapItem.
    await expect(page.locator('.mapstudio-popup--view')).toContainText('Name: Point 1 (dev)', { timeout: 30_000 });

    await clickPoint(page, map, 'p2');
    await expect(page.locator('.mapstudio-popup--view')).toContainText('Id: p2', { timeout: 30_000 });
    await expect(page.locator('.maplibregl-popup')).toHaveCount(1);
    expect(watched.warnings, 'Map Studio warnings').toEqual([]);

    await page.locator('.maplibregl-popup-close-button').click();
    await expect(page.locator('.maplibregl-popup')).toHaveCount(0);
    await expect(page.locator('.mapstudio-popup')).toHaveCount(0);
    await page.waitForTimeout(1000);
    expect(watched.warnings, 'Map Studio warnings after close').toEqual([]);
});

test('empty view path falls back to a text popup with no warning', async ({ page, watched }) => {
    const map = await openMap(page, '/fallback-empty');
    await clickPoint(page, map, 'p1');
    await expect(page.locator('.mapstudio-popup--text')).toContainText('p1', { timeout: 30_000 });
    await expect(page.locator('.mapstudio-popup--view')).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(watched.warnings, 'Map Studio warnings').toEqual([]);
});

test('missing view falls back to text with exactly one warning naming the path', async ({ page, watched }) => {
    const map = await openMap(page, '/fallback-missing');
    await clickPoint(page, map, 'p1');
    await expect(page.locator('.mapstudio-popup--text')).toContainText('p1', { timeout: 30_000 });
    await expect(page.locator('.mapstudio-popup--view')).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(watched.warnings).toHaveLength(1);
    expect(watched.warnings[0]).toContain('"Popups/Nope"');
});
