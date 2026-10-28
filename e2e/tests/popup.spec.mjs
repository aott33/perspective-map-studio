// The point popup: a project view by path with its params, a second point
// moves it, close unmounts it; and the text fallback for an empty and for a
// missing view path (their own dev pages, so no Gateway restart is needed). The points are the
// seed's tracer set (epic 2 story 11), so the ids are the seed's UUIDv5s.

import { TRACER, pagePixel } from '../lib/geo.mjs';
import { WARNING_SETTLE_MS, ensureSeeded, expect, loadedCounts, mapLoaded, openMap, test } from './fixtures.mjs';

test.use({ viewport: { width: 1440, height: 900 } });

let ids;
test.beforeAll(async ({ browser }) => {
    const seed = await ensureSeeded(browser);
    ids = Object.fromEntries(Object.entries(TRACER.points).map(([k, p]) => [k, seed.ids[p.key]]));
});

async function clickPoint(page, map, id) {
    // The seeded items are drawn and the map has gone idle with them.
    await mapLoaded(map);
    await loadedCounts(map);
    const box = await map.boundingBox();
    const [x, y] = pagePixel(box, TRACER.points[id].lngLat, TRACER.center, TRACER.zoom);
    await page.mouse.click(x, y);
}

test('custom view with author params, a second point, close', async ({ page, watched }) => {
    const map = await openMap(page, '/');
    await clickPoint(page, map, 'p1');
    // The view's label shows the author param "dev" beside mapItem.
    await expect(page.locator('.mapstudio-popup--view')).toContainText('Name: Point 1 (dev)', { timeout: 30_000 });

    // p3, not p2: at zoom 12 p1's open popup covers p2 (89 px right of p1 and 82 px above it).
    await clickPoint(page, map, 'p3');
    await expect(page.locator('.mapstudio-popup--view')).toContainText('Id: ' + ids.p3, { timeout: 30_000 });
    await expect(page.locator('.maplibregl-popup')).toHaveCount(1);
    expect(watched.warnings, 'Map Studio warnings').toEqual([]);

    await page.locator('.maplibregl-popup-close-button').click();
    await expect(page.locator('.maplibregl-popup')).toHaveCount(0);
    await expect(page.locator('.mapstudio-popup')).toHaveCount(0);
    await page.waitForTimeout(WARNING_SETTLE_MS);
    expect(watched.warnings, 'Map Studio warnings after close').toEqual([]);
});

test('empty view path opens the default popup for a kind with a setup, with no warning', async ({ page, watched }) => {
    // Epic 3 entry 5: with no popup view path, a point whose kind has a kind setup (the seed's pad
    // setup) gets Map Studio's default popup; the text popup stays for a kind without one.
    const map = await openMap(page, '/fallback-empty');
    await clickPoint(page, map, 'p1');
    const popup = page.locator('.mapstudio-popup--default');
    await expect(popup).toBeVisible({ timeout: 30_000 });
    await expect(popup).toHaveAttribute('data-point-id', ids.p1);
    await expect(popup.locator('.mapstudio-popup-name')).toHaveText('Point 1');
    await expect(page.locator('.mapstudio-popup--view')).toHaveCount(0);
    await expect(page.locator('.mapstudio-popup--text')).toHaveCount(0);
    await page.waitForTimeout(WARNING_SETTLE_MS);
    expect(watched.warnings, 'Map Studio warnings').toEqual([]);
});

test('missing view falls back to text with exactly one warning naming the path', async ({ page, watched }) => {
    const map = await openMap(page, '/fallback-missing');
    await clickPoint(page, map, 'p1');
    await expect(page.locator('.mapstudio-popup--text')).toContainText(ids.p1, { timeout: 30_000 });
    await expect(page.locator('.mapstudio-popup--view')).toHaveCount(0);
    await page.waitForTimeout(WARNING_SETTLE_MS);
    expect(watched.warnings).toHaveLength(1);
    expect(watched.warnings[0]).toContain('"Popups/Nope"');
});
