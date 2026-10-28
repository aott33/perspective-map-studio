// Labels, lines and the template's map parity (epic 3 entry 7, R3, R5). On the dev Gateway with the
// seeded 30-pad set, the tracer and the shared pair: names are symbol-layer text in the bundled glyphs
// (served at /res/mapstudio/glyphs/), drawn from zoom 14 with the state chip beside them and the icon
// KPI under them from zoom 15; MapLibre places them by rank and hides the ones that would collide, so
// no label box overlaps another at 1440 or 390 px; below 14 no name shows and a normal item is a dot.
// Two pads 15 m apart draw as one marker whose pick list opens either; Fit fits every item and keeps
// until the user moves the map; Return pans to the selected item and is disabled with none; a tap on
// the ground clears the selection; the flow arrow draws on the selected line alone. Screenshots at
// 1440 and 390 px for the docs (AD-15).

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { screenshotDir } from '../lib/env.mjs';
import { TRACER, pagePixel } from '../lib/geo.mjs';
import {
    EDITOR_USER, editorTest, expect, loadedCounts, mapLoaded, nextFrames, openMap, runSeed, signedInContext, test
} from './fixtures.mjs';

/** The seed's shared pair (ops/project/ignition/script-python/mapstudio_seed, SHARED_PADS). */
const SHARED = { a: [-104.965, 39.757], b: [-104.964825, 39.757], keys: ['shared/a', 'shared/b'] };
/** The tracer line's midpoint (p1 to p2). */
const TRACER_LINE_MID = [(-104.9903 + -104.975) / 2, (39.7392 + 39.75) / 2];
/** A place on the ground: on the tracer's view, well away from every seeded item and line. */
const GROUND = [-104.9725 + 0.004, 39.7445 - 0.0065];
/** How long a redraw after a view change may take on the dev stack. */
const DRAW_MS = 20_000;

let ids;

/** Move the map (the component's e2e view hook) and wait for the labels of that zoom to be published. */
async function view(page, map, center, zoom) {
    await page.waitForFunction(() => Boolean(window.__mapStudioTestView));
    await page.evaluate(([c, z]) => window.__mapStudioTestView({ center: c, zoom: z }), [center, zoom]);
    await expect(map).toHaveAttribute('data-zoom', zoom.toFixed(2), { timeout: DRAW_MS });
    await expect(map).toHaveAttribute('data-labels-zoom', zoom.toFixed(2), { timeout: DRAW_MS });
    await nextFrames(page);
}

/** The label boxes the component published for the view it is at. */
async function labels(map) {
    return JSON.parse(await map.getAttribute('data-labels'));
}

/** Every pair of boxes that overlaps (an inset of 1 px: the boxes are estimates of MapLibre's). */
function overlaps(boxes) {
    const out = [];
    for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i];
            const b = boxes[j];
            if (a.x + 1 < b.x + b.w - 1 && b.x + 1 < a.x + a.w - 1 && a.y + 1 < b.y + b.h - 1 && b.y + 1 < a.y + a.h - 1) {
                out.push([a.layer + ' ' + a.text, b.layer + ' ' + b.text]);
            }
        }
    }
    return out;
}

async function clickAt(page, map, lngLat, center, zoom) {
    const box = await map.boundingBox();
    const [x, y] = pagePixel(box, lngLat, center, zoom);
    await page.mouse.click(x, y);
}

async function shot(page, name) {
    await nextFrames(page);
    mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, name), fullPage: false });
}

async function checkLabels(page, map, center, zoom) {
    await view(page, map, center, zoom);
    const boxes = await labels(map);
    expect(overlaps(boxes), 'label boxes that overlap at zoom ' + zoom).toEqual([]);
    return boxes;
}

test.beforeAll(async ({ browser }) => {
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
        const seed = await runSeed(page);
        expect(seed.error, 'the seed saved').toBeUndefined();
        ids = { ...Object.fromEntries(Object.entries(TRACER.points).map(([k, p]) => [k, seed.ids[p.key]])),
            sharedA: seed.ids[SHARED.keys[0]], sharedB: seed.ids[SHARED.keys[1]], line: seed.ids['tracer/l1'] };
    } finally {
        await context.close();
    }
});

test.describe('1440 px', () => {
    test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    test('the glyphs are served by the Gateway beside the bundle', async ({ page }) => {
        for (const stack of ['NotoSans-SemiBold', 'NotoSans-Medium']) {
            const res = await page.request.get('/res/mapstudio/glyphs/' + stack + '/0-255.pbf');
            expect(res.status(), stack).toBe(200);
            const body = await res.body();
            expect(body.length, stack + ' 0-255 holds the Latin glyphs').toBeGreaterThan(20_000);
            const empty = await page.request.get('/res/mapstudio/glyphs/' + stack + '/65024-65279.pbf');
            expect(empty.status(), stack + ': a range with no glyph is still served').toBe(200);
        }
    });

    test('names from zoom 14, the KPI from 15, no overlap at either, dots and no names below 14', async ({ page, watched }) => {
        // MapLibre says so at console warning level when a glyph range cannot be read and it falls back to
        // the browser's own font; the bundled glyphs must load clean.
        // Likewise an image a symbol needed that was not there when it was laid out.
        const glyphWarnings = [];
        page.on('console', (msg) => {
            if (msg.type() === 'warning' && /glyph|could not be loaded/i.test(msg.text())) glyphWarnings.push(msg.text());
        });
        const map = await openMap(page, '/live');
        await mapLoaded(map);
        await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
        // The starting zoom (12): no name, the normal items as dots.
        await expect(map).toHaveAttribute('data-labels-zoom', '12.00', { timeout: DRAW_MS });
        await expect(map).toHaveAttribute('data-names-shown', '0');
        await expect(map).toHaveAttribute('data-shared-markers', /^[1-9][0-9]*$/);

        // At zoom 15 on the tracer's centre only Point 2 is in the 1440 px view (the others are 800 px out).
        const at15 = await checkLabels(page, map, TRACER.center, 15);
        const names15 = at15.filter((b) => b.layer === 'mapstudio-items-name').map((b) => b.text);
        expect(names15).toContain('Point 2');
        expect(at15.some((b) => b.layer === 'mapstudio-items-kpi' && /psi$/.test(b.text)), 'the icon KPI at 15').toBe(true);
        // The tracer line's name chip at its midpoint.
        expect(at15.some((b) => b.layer === 'mapstudio-line-chip' && b.text === 'Tracer line')).toBe(true);

        const at14 = await checkLabels(page, map, TRACER.center, 14);
        const names14 = at14.filter((b) => b.layer === 'mapstudio-items-name').map((b) => b.text);
        expect(names14).toEqual(expect.arrayContaining(['Point 1', 'Point 2', 'Point 3']));
        expect(at14.some((b) => b.layer === 'mapstudio-items-kpi'), 'no KPI below 15').toBe(false);
        // Point 3 (P15) has no comms tag: its chip says Comms lost, the short form, beside the name.
        const chip = at14.find((b) => b.layer === 'mapstudio-items-chip' && b.text === 'Comms lost');
        expect(chip, 'the Comms lost chip').toBeDefined();
        const p3 = at14.find((b) => b.layer === 'mapstudio-items-name' && b.text === 'Point 3');
        expect(chip.x).toBeGreaterThan(p3.x + p3.w - 1);
        expect(Math.abs(chip.y - p3.y)).toBeLessThan(3);
        expect(at14.some((b) => b.text === 'Stale - No value'), 'the long form is the popup\'s').toBe(false);
        // Zooming out thins the labels: the names go at 13 and the KPI went at 14.
        await view(page, map, TRACER.center, 13);
        await expect(map).toHaveAttribute('data-names-shown', '0');
        await expect(map).toHaveAttribute('data-labels-zoom', '13.00');
        expect(watched.warnings, 'Map Studio warnings').toEqual([]);
        expect(glyphWarnings, 'MapLibre glyph and image warnings').toEqual([]);
    });

    test('the whole scale set: at zoom 14 and 15 over the set\'s middle no label overlaps; Fit keeps until the map is moved', async ({ page }) => {
        const map = await openMap(page, '/');
        await mapLoaded(map);
        const fit = page.locator('.mapstudio-fit-button');
        const back = page.locator('.mapstudio-return-button');
        await expect(back).toBeDisabled();
        await expect(fit).toBeEnabled({ timeout: DRAW_MS });
        const before = await map.getAttribute('data-zoom');
        await fit.click();
        await expect(map).toHaveAttribute('data-fit', 'kept');
        await expect(map).not.toHaveAttribute('data-zoom', before, { timeout: DRAW_MS });
        const fitted = await map.getAttribute('data-zoom');
        // A redraw with the same bounds keeps the view; the user's drag ends the fit.
        await nextFrames(page);
        await expect(map).toHaveAttribute('data-zoom', fitted);
        const box = await map.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 40, { steps: 8 });
        await page.mouse.up();
        await expect(map).toHaveAttribute('data-fit', 'off', { timeout: DRAW_MS });

        // The dense middle of the set (Pads 9, 10, 15, 16, 21, 22 round the gathering station).
        const middle = [-104.9725, 39.7445];
        const boxes14 = await checkLabels(page, map, middle, 14);
        expect(boxes14.filter((b) => b.layer === 'mapstudio-items-name').length).toBeGreaterThan(3);
        const boxes15 = await checkLabels(page, map, middle, 15);
        expect(boxes15.filter((b) => b.layer === 'mapstudio-items-name').length).toBeGreaterThan(0);
    });

    test('two pads 15 m apart are one marker whose pick list opens either; a tap on the ground clears the selection',
        async ({ page }) => {
            const map = await openMap(page, '/live');
            await mapLoaded(map);
            await view(page, map, SHARED.a, 15);
            const names = (await labels(map)).filter((b) => b.layer === 'mapstudio-items-name').map((b) => b.text);
            expect(names).toContain('Shared A and Shared B');
            expect(names).not.toContain('Shared A');
            await clickAt(page, map, SHARED.a, SHARED.a, 15);
            const pick = page.locator('.maplibregl-popup .mapstudio-popup--pick');
            await expect(pick).toBeVisible({ timeout: 30_000 });
            await expect(pick).toHaveAttribute('data-rows', '2');
            await expect(map).toHaveAttribute('data-pick-open', 'true');
            const rows = pick.locator('.mapstudio-pick-row');
            await expect(rows.nth(0)).toHaveAttribute('data-item-id', ids.sharedA);
            await expect(rows.nth(1)).toHaveAttribute('data-item-id', ids.sharedB);
            await expect(rows.nth(0)).toContainText('Shared A');
            await expect(rows.nth(1)).toContainText('Well pad');
            await rows.nth(1).click();
            const popup = page.locator('.maplibregl-popup .mapstudio-popup--default');
            await expect(popup).toBeVisible({ timeout: 30_000 });
            await expect(popup.locator('.mapstudio-popup-name')).toHaveText('Shared B');
            await expect(map).toHaveAttribute('data-selected', ids.sharedB);
            await expect(map).toHaveAttribute('data-pick-open', 'false');
            await expect(page.locator('.mapstudio-return-button')).toBeEnabled();
            await shot(page, 'mapstudio-shared-1440.png');

            // The ground: the selection and the popup go, Return is disabled again.
            await clickAt(page, map, [SHARED.a[0] - 0.002, SHARED.a[1] - 0.0012], SHARED.a, 15);
            await expect(map).toHaveAttribute('data-selected', '');
            await expect(page.locator('.mapstudio-popup--default')).toHaveCount(0);
            await expect(page.locator('.mapstudio-return-button')).toBeDisabled();
        });

    test('Return pans back to the selected point; the flow arrow draws on the selected line alone', async ({ page }) => {
        const map = await openMap(page, '/live');
        await mapLoaded(map);
        await view(page, map, TRACER.center, 15);
        await clickAt(page, map, TRACER.points.p2.lngLat, TRACER.center, 15);
        await expect(page.locator('.maplibregl-popup .mapstudio-popup--default .mapstudio-popup-name')).toHaveText('Point 2', { timeout: 30_000 });
        await expect(map).toHaveAttribute('data-selected', ids.p2);
        await expect(map).toHaveAttribute('data-selected-kind', 'point');
        await expect(map).toHaveAttribute('data-arrow', '0');
        // Away, then Return: the centre is the point again, at the zoom the viewer had.
        await view(page, map, [TRACER.center[0] + 0.02, TRACER.center[1]], 15);
        await page.locator('.mapstudio-return-button').click();
        await expect(map).toHaveAttribute('data-center', TRACER.points.p2.lngLat[0].toFixed(5) + ',' + TRACER.points.p2.lngLat[1].toFixed(5), { timeout: DRAW_MS });
        await expect(map).toHaveAttribute('data-zoom', '15.00');

        // The line: selected on a click at its midpoint, the one arrow on it; the ground clears it.
        await view(page, map, TRACER.center, 15);
        await clickAt(page, map, TRACER_LINE_MID, TRACER.center, 15);
        await expect(map).toHaveAttribute('data-selected', ids.line, { timeout: DRAW_MS });
        await expect(map).toHaveAttribute('data-selected-kind', 'line');
        await expect(map).toHaveAttribute('data-arrow', '1');
        await expect(page.locator('.mapstudio-popup--default')).toHaveCount(0);
        await shot(page, 'mapstudio-line-selected-1440.png');
        await clickAt(page, map, GROUND, TRACER.center, 15);
        await expect(map).toHaveAttribute('data-selected', '');
        await expect(map).toHaveAttribute('data-arrow', '0');
    });

    editorTest('the alarmed marker with its name, chip and KPI as text (screenshot)', async ({ page }) => {
        const map = await openMap(page, '/live');
        await mapLoaded(map);
        await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
        const out = page.locator('#mapstudio-live-result');
        const before = await out.innerText();
        await page.locator('#mapstudio-live-pressure-high').click();
        await expect.poll(() => out.innerText(), { timeout: 30_000 }).not.toBe(before);
        const p1 = page.locator('.mapstudio-live-item[data-item-id="' + ids.p1 + '"]');
        await expect(p1).toHaveAttribute('data-alarm', '1:unacked:1', { timeout: 25_000 });
        await expect(p1).toHaveAttribute('data-rank', '0');
        await checkLabels(page, map, TRACER.points.p1.lngLat, 15);
        await shot(page, 'mapstudio-labels-1440.png');
        const quiet = await out.innerText();
        await page.locator('#mapstudio-live-pressure-low').click();
        await expect.poll(() => out.innerText(), { timeout: 30_000 }).not.toBe(quiet);
    });
});

test.describe('390 px', () => {
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

    test('no label overlaps another on a phone at zoom 14 and 15; the scale set fitted', async ({ page }) => {
        const map = await openMap(page, '/live');
        await mapLoaded(map);
        await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
        const at15 = await checkLabels(page, map, TRACER.points.p1.lngLat, 15);
        expect(at15.filter((b) => b.layer === 'mapstudio-items-name').length).toBeGreaterThan(0);
        for (const b of at15) {
            expect(b.x, b.text + ' inside the phone').toBeGreaterThanOrEqual(-1);
            expect(b.x + b.w, b.text + ' inside the phone').toBeLessThanOrEqual(391);
        }
        await shot(page, 'mapstudio-labels-390.png');
        await checkLabels(page, map, [-104.9725, 39.7445], 14);
        await page.locator('.mapstudio-fit-button').click();
        await expect(map).toHaveAttribute('data-fit', 'kept');
        await expect(map).toHaveAttribute('data-labels-zoom', /^(9|10|11)\./, { timeout: DRAW_MS });
        await expect(map).toHaveAttribute('data-names-shown', '0');
        const counts = await loadedCounts(map);
        expect(counts.points).toBeGreaterThanOrEqual(1);
        // Nothing of Map Studio's sits in the bottom-right corner the App Bar toggle uses.
        const fit = await page.locator('.mapstudio-fit-group').boundingBox();
        expect(fit.y + fit.height).toBeLessThan(844 - 64);
        await shot(page, 'mapstudio-scale-390.png');
    });
});
