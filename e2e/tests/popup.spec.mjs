// The point popup (epic 3 entry 8, AD-7): the default popup card with its own close in the header
// and the page link filled from the kind setup's link (hidden when a placeholder has no value, R8);
// a kind setup's popupView opening the project view with mapItem and its filled params instead of
// the default popup, and a wrong path falling back to the default popup with one warning naming
// it. The spike's popupView prop is retired (every dev page draws from the kind setup). The pad
// kind setup is changed through the component's real session path (window.__mapStudioTest, as
// kindsetup.spec.mjs does) and the seed puts it back afterwards.

import { TRACER, centerFor, pagePixel } from '../lib/geo.mjs';
import {
    DRAW_MS, EDITOR_USER, WARNING_SETTLE_MS, editorTest, ensureSeeded, expect, loadedCounts, mapLoaded, openMap, runSeed, send, shot,
    signedInContext, test, view
} from './fixtures.mjs';

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
    await shot(page, 'mapstudio-popup-view-1440.png');
    await viewClose.click();
    await expect(page.locator('.mapstudio-popup--view')).toHaveCount(0);
    await expect(map).toHaveAttribute('data-popup-mode', '');
    await page.waitForTimeout(WARNING_SETTLE_MS);
    expect(watched.warnings, 'Map Studio warnings').toEqual([]);

    // The same view on a phone: the bottom sheet with its handle and Map Studio's own 44 px close
    // row above the view (decision 7; EXPERIENCE.md: every sheet has a visible 44 px close).
    await page.setViewportSize({ width: 390, height: 844 });
    const phone = await openMap(page, '/edit');
    await mapLoaded(phone);
    await expect(phone).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
    await clickAt(page, phone, TRACER.points.p1.lngLat);
    const sheetView = page.locator('.mapstudio-sheet .mapstudio-popup--view');
    await expect(sheetView).toBeVisible({ timeout: 30_000 });
    await expect(phone).toHaveAttribute('data-popup-mode', 'sheet');
    await expect(page.locator('#mapstudio-padalarms-title')).toHaveText('Alarms of Point 1', { timeout: 30_000 });
    const sheetClose = sheetView.locator('.mapstudio-popup-close');
    await expect(sheetClose).toBeVisible();
    const sheetCloseBox = await sheetClose.boundingBox();
    expect(Math.min(sheetCloseBox.width, sheetCloseBox.height)).toBeGreaterThanOrEqual(44);
    await shot(page, 'mapstudio-popup-view-390.png');
    await sheetClose.click();
    await expect(page.locator('.mapstudio-sheet')).toHaveCount(0);
    await page.waitForTimeout(WARNING_SETTLE_MS);
    expect(watched.warnings, 'Map Studio warnings').toEqual([]);
    await page.setViewportSize({ width: 1440, height: 900 });

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
    // The default popup back for the tests after this one (no popupView: the key drops out of the message).
    await page.locator('.maplibregl-popup .mapstudio-popup-close').first().click();
    await changePadSetup(page, again, { popupView: undefined });
});

// The owner's review notes on the 0.3.0 map, group a (_bmad-output/backlog/story-owner-review-notes-on-the-0-3-0-map.md):
// item 14 (Esc closes the card or the sheet and returns the focus), item 15 (plain words for a quality
// code), item 18 (the card placed inside the map less the top bar and the zoom card) and item 27 (Return
// centres in the visible area). As a viewer on the View page, which has no test buttons.

/** The rectangle of the first element a selector finds, in page pixels, or null. */
const rectOf = (page, selector) => page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
}, selector);

const overlaps = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const card = (page) => page.locator('.maplibregl-popup .mapstudio-popup--default');

/** Click the map's centre, where `view` put the point. */
async function clickCentre(page, map) {
    const box = await map.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** Open the View page as a viewer and wait for the first full batch. */
async function openView(page) {
    const map = await openMap(page, '/');
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
    return map;
}

test.describe('the owner\'s review notes: Esc, plain words, placement and the camera', () => {
    test('Esc closes the card and returns the focus to the map, or to the search field that opened it (item 14)', async ({ page, watched }) => {
        const map = await openView(page);
        await view(page, map, TRACER.points.p1.lngLat, 15);
        await clickCentre(page, map);
        await expect(card(page)).toBeVisible({ timeout: 30_000 });
        await expect(map).toHaveAttribute('data-popup-mode', 'card');
        await page.keyboard.press('Escape');
        await expect(card(page)).toHaveCount(0);
        await expect(map).toHaveAttribute('data-popup-mode', '');
        await expect(map).toHaveAttribute('data-selected', '');
        expect(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('maplibregl-canvas')),
            'the focus on the map').toBe(true);
        // Opened from the search: Esc closes it and the field has the focus again.
        await page.locator('.mapstudio-search-input').fill('Point 1');
        await page.locator('.mapstudio-search-option').first().click();
        await expect(card(page)).toHaveAttribute('data-point-id', ids.p1, { timeout: DRAW_MS });
        await page.keyboard.press('Escape');
        await expect(card(page)).toHaveCount(0);
        await expect(page.locator('.mapstudio-search-input')).toBeFocused();
        // Esc with nothing open is nobody's: the legend stays as it was, nothing throws.
        await page.keyboard.press('Escape');
        await expect(map).toHaveAttribute('data-popup-mode', '');
        expect(watched.warnings, 'Map Studio warnings').toEqual([]);
    });

    test('a comms tag that is not there reads in plain words, the code kept in the tooltip (item 15)', async ({ page }) => {
        const map = await openView(page);
        await view(page, map, TRACER.points.p3.lngLat, 15);
        await clickCentre(page, map);
        await expect(card(page)).toHaveAttribute('data-point-id', ids.p3, { timeout: 30_000 });
        const comms = card(page).locator('[data-part="comms"]');
        await expect(comms).toHaveAttribute('data-comms', 'lost');
        await expect(comms).toHaveAttribute('data-quality', 'Bad_NotFound');
        await expect(comms.locator('.mapstudio-popup-value')).toHaveText('No data yet - the tag was not found');
        await expect(comms).toHaveAttribute('title', /\(Bad_NotFound\)$/);
        // Its values have never arrived: no "Stale - ... (comms lost)" words, the reason in the tooltip.
        const kpi = card(page).locator('.mapstudio-popup-kpi').first();
        await expect(kpi.locator('.mapstudio-popup-value')).not.toContainText('Stale');
        await expect(kpi.locator('.mapstudio-popup-value')).not.toContainText('Bad_');
    });

    test('the card stays inside the map, off the top bar and the zoom card, for a point near every edge (item 18)', async ({ page }) => {
        const map = await openView(page);
        const box = await map.boundingBox();
        const topLeft = await rectOf(page, '.maplibregl-ctrl-top-left');
        const topRight = await rectOf(page, '.maplibregl-ctrl-top-right');
        expect(topLeft).not.toBeNull();
        expect(topRight).not.toBeNull();
        const spots = {
            'under the top bar': [260, 48],
            'under the zoom card': [box.width - 34, 130],
            'the top-left corner': [40, 40],
            'the left edge': [28, box.height / 2],
            'the right edge': [box.width - 28, box.height / 2],
            'the bottom edge': [box.width / 2, box.height - 28],
            'the bottom-right corner': [box.width - 40, box.height - 40]
        };
        for (const [where, at] of Object.entries(spots)) {
            const center = centerFor(box, TRACER.points.p1.lngLat, at, 15);
            await view(page, map, center, 15);
            await page.mouse.click(box.x + at[0], box.y + at[1]);
            await expect(card(page)).toHaveAttribute('data-point-id', ids.p1, { timeout: 30_000 });
            // The card may have panned the map by what was missing; its rectangle settles within the pan's 200 ms.
            await expect.poll(async () => {
                const r = await rectOf(page, '.maplibregl-popup-content');
                const inside = r && r.x >= box.x - 1 && r.y >= box.y - 1 && r.x + r.w <= box.x + box.width + 1 && r.y + r.h <= box.y + box.height + 1;
                return inside && !overlaps(r, topLeft) && !overlaps(r, topRight) ? 'placed' : JSON.stringify(r);
            }, { message: 'the card for a point ' + where, timeout: 5_000 }).toBe('placed');
            await page.keyboard.press('Escape');
            await expect(card(page)).toHaveCount(0);
        }
    });
});

test.describe('390 px: Esc on the sheet, Return under the sheet', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('Esc closes the bottom sheet (item 14); Return centres the item in the map above the sheet and below the top bar (item 27)',
        async ({ page, watched }) => {
            const map = await openView(page);
            await view(page, map, TRACER.points.p2.lngLat, 15);
            const box = await map.boundingBox();
            const [x, y] = pagePixel(box, TRACER.points.p2.lngLat, TRACER.points.p2.lngLat, 15);
            await page.mouse.click(x, y);
            const sheet = page.locator('.mapstudio-sheet .mapstudio-popup--default');
            await expect(sheet).toHaveAttribute('data-point-id', ids.p2, { timeout: 30_000 });
            await expect(map).toHaveAttribute('data-popup-mode', 'sheet');
            await page.keyboard.press('Escape');
            await expect(page.locator('.mapstudio-sheet')).toHaveCount(0);
            await expect(map).toHaveAttribute('data-popup-mode', '');

            // Open again, move away at zoom 17, Return: the marker sits in the visible area, between the top bar
            // and the sheet, not under either (the name label's box, published with the labels).
            await page.mouse.click(x, y);
            await expect(sheet).toHaveAttribute('data-point-id', ids.p2, { timeout: 30_000 });
            await view(page, map, [TRACER.points.p2.lngLat[0] + 0.004, TRACER.points.p2.lngLat[1] + 0.001], 17);
            await page.locator('.mapstudio-return-button').click();
            await expect(map).toHaveAttribute('data-center', TRACER.points.p2.lngLat[0].toFixed(5) + ',' + TRACER.points.p2.lngLat[1].toFixed(5), { timeout: DRAW_MS });
            const sheetRect = await rectOf(page, '.mapstudio-sheet');
            const topBar = await rectOf(page, '.maplibregl-ctrl-top-left');
            await expect.poll(async () => {
                const labels = JSON.parse(await map.getAttribute('data-labels') || '[]');
                const name = labels.find((b) => b.layer === 'mapstudio-items-name' && b.text === 'Point 2');
                if (!name) return 'no label yet';
                const top = box.y + name.y;
                const bottom = box.y + name.y + name.h;
                return top > topBar.y + topBar.h && bottom < sheetRect.y ? 'in view' : JSON.stringify({ top, bottom, bar: topBar.y + topBar.h, sheet: sheetRect.y });
            }, { message: 'Point 2 between the top bar and the sheet', timeout: DRAW_MS }).toBe('in view');
            expect(watched.warnings, 'Map Studio warnings').toEqual([]);
        });
});
