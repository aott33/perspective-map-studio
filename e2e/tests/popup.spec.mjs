// The point popup (epic 3 entry 8, AD-7): the default popup card with its own close in the header
// and the page link filled from the kind setup's link (hidden when a placeholder has no value, R8);
// a kind setup's popupView opening the project view with mapItem and its filled params instead of
// the default popup, and a wrong path falling back to the default popup with one warning naming
// it. The spike's popupView prop is retired (every dev page draws from the kind setup). The pad
// kind setup is changed through the component's real session path (window.__mapStudioTest, as
// kindsetup.spec.mjs does) and the seed puts it back afterwards.

import { TRACER, pagePixel } from '../lib/geo.mjs';
import { EDITOR_USER, WARNING_SETTLE_MS, editorTest, ensureSeeded, expect, loadedCounts, mapLoaded, openMap, runSeed, signedInContext, test } from './fixtures.mjs';

test.use({ viewport: { width: 1440, height: 900 } });

/** A kind setup change reaches an open map with its next batch: one refresh interval (10 s) plus margin. */
const INTERVAL_MS = 25_000;
/** The seed's first scale pad, no asset linked (ops/project/ignition/script-python/mapstudio_seed SCALE_PADS). */
const PAD_1 = [-105.056215, 39.708958];

let ids;
test.beforeAll(async ({ browser }) => {
    const seed = await ensureSeeded(browser);
    ids = Object.fromEntries(Object.entries(TRACER.points).map(([k, p]) => [k, seed.ids[p.key]]));
});

test.afterAll(async ({ browser }) => {
    // The seed restores the pad kind setup this spec changed.
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
        const seed = await runSeed(page);
        expect(seed.error, 'the seed restored the setup').toBeUndefined();
    } finally {
        await context.close();
    }
});

async function send(page, type, body) {
    await page.waitForFunction(() => Boolean(window.__mapStudioTest));
    return page.evaluate(([t, b]) => window.__mapStudioTest.send(t, b), [type, body]);
}

/** Change parts of the stored pad kind setup and wait for the open map's next full batch to carry it. */
async function changePadSetup(page, map, parts) {
    const load = await send(page, 'map.load', {});
    expect(load.type, JSON.stringify(load.body)).toBe('map.load.reply');
    const stored = load.body.kindSetups.find((k) => k.kindId === 'pad');
    expect(stored, 'the seeded pad setup').toBeDefined();
    const fulls = Number(await map.getAttribute('data-live-full'));
    const reply = await send(page, 'edits.apply', { batchId: crypto.randomUUID(), ops: [
        { op: 'update', entity: 'kindSetup', id: 'pad', baseVersion: stored.version, data: { setup: { ...stored.setup, ...parts } } }] });
    expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
    await expect(map).toHaveAttribute('data-live-full', String(fulls + 1), { timeout: INTERVAL_MS });
}

async function clickAt(page, map, lngLat) {
    await mapLoaded(map);
    await loadedCounts(map);
    const box = await map.boundingBox();
    const [x, y] = pagePixel(box, lngLat, TRACER.center, TRACER.zoom);
    await page.mouse.click(x, y);
}

editorTest('the default popup card: its own close, the page link filled from the setup and hidden with no value', async ({ page, watched }) => {
    const map = await openMap(page, '/edit');
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
    await changePadSetup(page, map, { link: '/pad/{asset.id}' });

    await clickAt(page, map, TRACER.points.p1.lngLat);
    const popup = page.locator('.maplibregl-popup .mapstudio-popup--default');
    await expect(popup).toBeVisible({ timeout: 30_000 });
    await expect(map).toHaveAttribute('data-popup-mode', 'card');
    await expect(popup).toHaveAttribute('data-point-id', ids.p1);
    // The header: the disc, the name, the pop-out with the link filled, then the close; no MapLibre close button.
    await expect(popup.locator('.mapstudio-popup-name')).toHaveText('Point 1');
    const link = popup.locator('.mapstudio-popup-link');
    await expect(link).toHaveAttribute('data-link', '/pad/P12');
    await expect(page.locator('.maplibregl-popup-close-button')).toHaveCount(0);
    await expect(popup.locator('.mapstudio-popup-close')).toBeVisible();
    const boxes = await page.evaluate(() => {
        const r = (s) => document.querySelector(s).getBoundingClientRect();
        return { card: r('.maplibregl-popup-content'), link: r('.mapstudio-popup-link'), close: r('.mapstudio-popup-close') };
    });
    expect(Math.round(boxes.card.width), 'popup-width 320 (D1)').toBe(320);
    expect(boxes.card.height).toBeLessThanOrEqual(480);
    expect(boxes.link.right).toBeLessThan(boxes.close.left);
    expect(Math.min(boxes.link.width, boxes.link.height)).toBeGreaterThanOrEqual(32);
    expect(Math.min(boxes.close.width, boxes.close.height)).toBeGreaterThanOrEqual(32);
    // The card is opaque, above the map, with a 10 px radius and a pointer in its own surface.
    const look = await page.evaluate(() => {
        const content = document.querySelector('.maplibregl-popup-content');
        const tip = document.querySelector('.maplibregl-popup-tip');
        const cs = getComputedStyle(content);
        return { background: cs.backgroundColor, radius: cs.borderTopLeftRadius, shadow: cs.boxShadow,
            tipWidth: getComputedStyle(tip).borderTopWidth, z: getComputedStyle(content.closest('.maplibregl-popup')).zIndex };
    });
    expect(look.background).not.toMatch(/rgba\(.*, 0\)$|transparent/);
    expect(look.radius).toBe('10px');
    expect(look.shadow).not.toBe('none');
    expect(look.tipWidth).toBe('10px');
    expect(Number(look.z)).toBeGreaterThanOrEqual(5);

    // The pop-out opens the page the link names, in the session.
    await link.click();
    await expect(page).toHaveURL(/\/pad\/P12$/, { timeout: 30_000 });
    await expect(page.locator('#mapstudio-pad-title')).toHaveText('Pad P12', { timeout: 30_000 });

    // An item with no asset: {asset.id} has no value, so the icon is hidden, not disabled.
    const again = await openMap(page, '/edit');
    await clickAt(page, again, PAD_1);
    const unlinked = page.locator('.maplibregl-popup .mapstudio-popup--default');
    await expect(unlinked).toBeVisible({ timeout: 30_000 });
    await expect(unlinked.locator('.mapstudio-popup-name')).toHaveText('Pad 1');
    await expect(unlinked.locator('.mapstudio-popup-link')).toHaveCount(0);
    await expect(unlinked.locator('.mapstudio-popup-close')).toBeVisible();
    await unlinked.locator('.mapstudio-popup-close').click();
    await expect(page.locator('.mapstudio-popup--default')).toHaveCount(0);
    await expect(again).toHaveAttribute('data-popup-mode', '');
    await page.waitForTimeout(WARNING_SETTLE_MS);
    expect(watched.warnings, 'Map Studio warnings').toEqual([]);
});

editorTest('a kind setup\'s popupView opens the project view with mapItem and a padName param; a wrong path falls back', async ({ page, watched }) => {
    const map = await openMap(page, '/edit');
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
    await changePadSetup(page, map, { popupView: { path: 'Popups/PadAlarms', params: { padName: '{item.name}', alarmsPath: '{asset.path}' } } });

    await clickAt(page, map, TRACER.points.p1.lngLat);
    const view = page.locator('.maplibregl-popup .mapstudio-popup--view');
    await expect(view).toBeVisible({ timeout: 30_000 });
    await expect(view).toHaveAttribute('data-view-path', 'Popups/PadAlarms');
    await expect(page.locator('#mapstudio-padalarms-title')).toHaveText('Alarms of Point 1', { timeout: 30_000 });
    await expect(page.locator('#mapstudio-padalarms-id')).toHaveText('Id: ' + ids.p1);
    // {asset.path} resolved against the item's own base path, from the popup detail the open pushed.
    await expect(page.locator('#mapstudio-padalarms-path')).toHaveText('Alarms path: [default]Mesa/P12');
    await expect(page.locator('#mapstudio-padalarms-pressure')).toHaveText(/^Pressure: (\d+(\.\d+)?|none)$/);
    // The example view embeds the built-in alarm table.
    await expect(page.locator('#mapstudio-padalarms-table')).toBeVisible();
    await expect(page.locator('.mapstudio-popup--default')).toHaveCount(0);
    // Map Studio's own close above the view (32 px on the card) closes it.
    const viewClose = view.locator('.mapstudio-popup-close');
    await expect(viewClose).toBeVisible();
    const closeBox = await viewClose.boundingBox();
    expect(Math.min(closeBox.width, closeBox.height)).toBeGreaterThanOrEqual(32);
    await viewClose.click();
    await expect(page.locator('.mapstudio-popup--view')).toHaveCount(0);
    await expect(map).toHaveAttribute('data-popup-mode', '');
    await page.waitForTimeout(WARNING_SETTLE_MS);
    expect(watched.warnings, 'Map Studio warnings').toEqual([]);

    // A view that is not there: the default popup, with exactly one warning naming the path. The map
    // is reopened first: a setup change while Point 1's view popup is open redraws that popup with
    // the new path, which is one more fallback and one more warning.
    const again = await openMap(page, '/edit');
    await mapLoaded(again);
    await expect(again).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
    await changePadSetup(page, again, { popupView: { path: 'Popups/Nope', params: {} } });
    await clickAt(page, again, TRACER.points.p3.lngLat);
    const fallback = page.locator('.maplibregl-popup .mapstudio-popup--default');
    await expect(fallback).toBeVisible({ timeout: 30_000 });
    await expect(fallback).toHaveAttribute('data-point-id', ids.p3);
    await expect(fallback.locator('.mapstudio-popup-name')).toHaveText('Point 3');
    await expect(page.locator('.mapstudio-popup--view')).toHaveCount(0);
    await page.waitForTimeout(WARNING_SETTLE_MS);
    const nope = watched.warnings.filter((w) => w.includes('"Popups/Nope"'));
    expect(nope, watched.warnings.join('\n')).toHaveLength(1);
});
