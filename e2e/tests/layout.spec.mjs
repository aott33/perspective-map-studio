// The Edit-mode layout (epic 4 entry 7c; DESIGN.md Layout & Spacing, Direction A; EXPERIENCE.md Responsive) at 1440, 1366 and
// 1200 px as the map editor on the seed, and the one rule for every panel that docks or undocks beside the map: the ground stays
// where it is on the page ("keep place", selection.tsx dockChange). A pad placed with the Point tool stays at the page spot it was
// clicked at as Details docks (within 2 px), and a finished line's points keep theirs; Details on CTB1 closed by a ground click,
// by its close and by Esc leaves CTB1 and the line's bend where they were as the stage widens; a pad placed where the docked panel
// lands is eased into view. At 1440 px the rail is 72, the list 280 and Details 340, the map 748 with a selection. Below 1280 px
// (1200) the list is not docked: the rail's Items opens it over the map's left edge, whole, at the list's width, and Items again,
// Esc, a click on the map and a row choice close it (the row's Details docking); the toolbar is back on the top row, level with the
// Editing switch and clear of it; the list's Sort by outlives a close; a row chosen leaves the focus on the map (Esc closes
// Details); with Layers alone docked the toolbar stays on the top row. At 1024 px with Details the toolbar takes the row under
// the switch (its row follows the map's measured width). The window widened from 1200 to 1366 docks the list again and the items keep their page spots.
// With Details open, nothing but the attribution lies within the App Bar clearance (76 px) of the stage's bottom-right corner at
// 1440, 1366 and 1200 px. The spec leaves the seed as it found it (its pads and line undone, then the seed run again and the
// strays removed).

import { pagePixel } from '../lib/geo.mjs';
import {
    EDITOR_USER, VERTEX_PAUSE_MS, editorTest, ensureSeeded, expect, mapLoaded, openMap, removeStrays, runSeed, send, signedInContext, test, view,
    REPLY_MS, CTB1, BEND, CTB1_VIEW, INSET, openEditor, pixelNow, insideRing, expectStageWidth
} from './fixtures.mjs';

/** The App Bar clearance kept at the stage's bottom-right corner (DESIGN.md spacing app-bar-clearance). */
const APP_BAR_CLEARANCE = 76;
/** The margin an item the docked panel covered is brought to inside the stage (selection.tsx IN_VIEW_MARGIN_PX). */
const IN_VIEW_MARGIN = 48;
/** How far a kept place may be from where it was on the page (the plan's matrix: within 2 px). */
const KEPT_PX = 2;
const RAIL = 72;
/** A moment for MapLibre to place its symbols again after the stage changed size, before a marker is clicked. */
const SETTLE_MS = 1000;

/** Each width's panels (DESIGN.md spacing): the list and the properties panel; below 1280 px the list is not docked. */
const WIDTHS = { 1440: { height: 900, list: 280, panel: 340 }, 1366: { height: 768, list: 256, panel: 320 }, 1200: { height: 768, list: 0, panel: 320 } };

let seed;

test.beforeAll(async ({ browser }) => {
    seed = await ensureSeeded(browser);
    await restoreSeed(browser);
});

test.afterAll(async ({ browser }) => {
    await restoreSeed(browser);
});

/** The seed's own items again, and no item but the seed's. */
async function restoreSeed(browser) {
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
        const result = await runSeed(page);
        expect(result.error, 'the seed saved').toBeUndefined();
        await removeStrays(page, seed.ids);
    } finally {
        await context.close();
    }
}

/** A page pixel where it was, to `KEPT_PX`. */
function expectKept(actual, expected, what) {
    expect(Math.abs(actual[0] - expected[0]), what + ' x').toBeLessThanOrEqual(KEPT_PX);
    expect(Math.abs(actual[1] - expected[1]), what + ' y').toBeLessThanOrEqual(KEPT_PX);
}

/**
 * Page pixels on the ground: at least 44 px from every point and 24 px from every line segment at the map's view now and outside
 * every area, on a grid inside the map box away from its controls, between `minX` and `maxX` px into the map (as editclick.spec.mjs
 * finds one); `count` spots, each 120 px from the others.
 */
async function groundSpots(page, map, { minX = 80, maxX = Infinity, count = 1 } = {}) {
    const box = await map.boundingBox();
    const center = (await map.getAttribute('data-center')).split(',').map(Number);
    const zoom = Number(await map.getAttribute('data-zoom'));
    const items = (await send(page, 'map.load', {})).body.items.filter((i) => !i.deleted);
    const px = (lngLat) => pagePixel(box, lngLat, center, zoom);
    const points = items.filter((i) => i.geometry.type === 'Point').map((i) => px(i.geometry.coordinates));
    const segments = [];
    for (const line of items.filter((i) => i.geometry.type === 'LineString')) {
        const coords = line.geometry.coordinates.map(px);
        for (let i = 1; i <= coords.length; i++) segments.push([coords[i - 1], coords[i % coords.length]]);
    }
    const areaIds = new Set(JSON.parse((await map.getAttribute('data-areas')) || '[]').map((a) => a.id));
    const rings = items.filter((i) => areaIds.has(i.id)).map((i) => i.geometry.coordinates.map(px));
    const toSegment = ([x, y], [[ax, ay], [bx, by]]) => {
        const dx = bx - ax;
        const dy = by - ay;
        const len2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
        return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    };
    const found = [];
    for (let y = box.y + 120; y < box.y + box.height - 100; y += 40) {
        for (let x = box.x + Math.max(80, minX); x < box.x + Math.min(box.width - 80, maxX); x += 40) {
            if (points.some(([px0, py0]) => Math.hypot(px0 - x, py0 - y) < 44)) continue;
            if (segments.some((seg) => toSegment([x, y], seg) < 24)) continue;
            if (rings.some((ring) => insideRing([x, y], ring))) continue;
            if (found.some(([fx, fy]) => Math.hypot(fx - x, fy - y) < 120)) continue;
            found.push([x, y]);
            if (found.length === count) return found;
        }
    }
    throw new Error('No ground spot clear of the seeded items in this view.');
}

/** The stored item, by id, once its create has saved. */
async function stored(page, id) {
    let item;
    await expect.poll(async () => {
        item = (await send(page, 'map.load', {})).body.items.find((i) => i.id === id && !i.deleted);
        return Boolean(item);
    }, { timeout: REPLY_MS }).toBe(true);
    return item;
}

/** The Point tool's placement at a page spot: the new pad selected with Details, saved; its id. */
async function placePad(page, map, at) {
    await page.locator('.mapstudio-toolbar .mapstudio-tool--point').click();
    await expect(map).toHaveAttribute('data-tool', 'point');
    await page.mouse.click(at[0], at[1]);
    await expect(page.locator('.mapstudio-panel')).toHaveCount(1);
    const id = await page.locator('.mapstudio-panel').getAttribute('data-item-id');
    await expect(map).toHaveAttribute('data-selected', id);
    await expect(map).toHaveAttribute('data-save-state', 'saved', { timeout: REPLY_MS });
    return id;
}

/** Undo the last step (the pad or line this test added), the tool put down first. */
async function undoLast(page, map) {
    if ((await map.getAttribute('data-tool')) !== '') {
        await page.locator('.mapstudio-toolbar .mapstudio-tool--select').click();
        await expect(map).toHaveAttribute('data-tool', '');
    }
    const seqBefore = Number(await map.getAttribute('data-store-seq'));
    await page.locator('.mapstudio-toolbar .mapstudio-undo').click();
    await expect.poll(async () => Number(await map.getAttribute('data-store-seq')), { timeout: REPLY_MS }).toBeGreaterThan(seqBefore);
}

/**
 * What lies within the App Bar clearance of the stage's bottom-right corner, visible: every element of the component there, but
 * the attribution (its control, its text and the bottom-right corner's own container holding it), the map and its canvas, and
 * the containers as large as the stage.
 */
async function cornerTenants(page) {
    return page.evaluate((clearance) => {
        const stage = document.querySelector('.mapstudio-stage');
        const s = stage.getBoundingClientRect();
        const corner = { left: s.right - clearance, top: s.bottom - clearance, right: s.right, bottom: s.bottom };
        const attrib = stage.querySelector('.maplibregl-ctrl-attrib');
        const root = stage.closest('.mapstudio');
        const tenants = [];
        for (const el of root.querySelectorAll('*')) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            const style = getComputedStyle(el);
            if (style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
            if (r.right <= corner.left || r.left >= corner.right || r.bottom <= corner.top || r.top >= corner.bottom) continue;
            if (attrib && (el === attrib || attrib.contains(el) || el.contains(attrib))) continue;
            if (r.width >= s.width - 1 && r.height >= s.height - 1) continue;
            if (el.tagName === 'CANVAS' || el.closest('svg') && el.tagName !== 'svg') continue;
            tenants.push((el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : el.tagName)
                + ' at ' + Math.round(r.left - s.left) + ',' + Math.round(r.top - s.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
        }
        return tenants;
    }, APP_BAR_CLEARANCE);
}

for (const width of [1440, 1366, 1200]) {
    const { height, list, panel } = WIDTHS[width];
    const stage = width - RAIL - list;
    const stageWithPanel = stage - panel;

    test.describe(width + ' px', () => {
        test.use({ viewport: { width, height }, deviceScaleFactor: 1 });

        editorTest('the widths: the rail, the list ' + (list ? 'docked at ' + list : 'not docked') + ' and Details ' + panel + ' px; nothing but the attribution in the bottom-right corner',
            async ({ page }) => {
                const map = await openEditor(page);
                await expect(map).toHaveAttribute('data-list', list ? 'docked' : 'collapsed');
                await expectStageWidth(map, stage);
                expect(Math.round((await page.locator('.mapstudio-rail').boundingBox()).width)).toBe(RAIL);
                if (list) {
                    expect(Math.round((await page.locator('.mapstudio-dock--items').boundingBox()).width)).toBe(list);
                } else {
                    await expect(page.locator('.mapstudio-dock--items')).toHaveCount(0);
                }
                await view(page, map, CTB1_VIEW.center, CTB1_VIEW.zoom);
                const pad = await pixelNow(map, CTB1);
                await page.mouse.click(pad[0], pad[1]);
                await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', seed.ids['swd/ctb1']);
                await expectStageWidth(map, stageWithPanel);
                expect(Math.round((await page.locator('.mapstudio-panel').boundingBox()).width)).toBe(panel);
                if (width === 1440) {
                    // EXPERIENCE.md Responsive: the map about 748 px with a selection at 1440.
                    expect(stageWithPanel).toBe(748);
                }
                // The App Bar corner (DESIGN.md Reserved corner): the attribution text alone may sit there.
                expect(await cornerTenants(page), 'nothing but the attribution within 76 px of the stage\'s bottom-right').toEqual([]);
            });

        editorTest('a pad placed with the Point tool stays at its page spot as Details docks; one placed where the panel lands is eased into view',
            async ({ page }) => {
                const map = await openEditor(page);
                await view(page, map, CTB1_VIEW.center, CTB1_VIEW.zoom);
                await expectStageWidth(map, stage);
                // Clear of the panel's strip-to-be: the pad stays where it was clicked, and so does CTB1.
                const [spot] = await groundSpots(page, map, { minX: panel + 80 });
                const ctb1 = await pixelNow(map, CTB1);
                const id = await placePad(page, map, spot);
                await expectStageWidth(map, stageWithPanel);
                const pad = await stored(page, id);
                expectKept(await pixelNow(map, pad.geometry.coordinates), spot, 'the new pad kept its page spot');
                expectKept(await pixelNow(map, CTB1), ctb1, 'CTB1 kept its page spot');
                await undoLast(page, map);
                await expect(page.locator('.mapstudio-panel')).toHaveCount(0);
                await expectStageWidth(map, stage);

                // Under the panel's strip-to-be: once Details docks the pad is eased just into view, 48 px inside the stage's left edge.
                const [under] = await groundSpots(page, map, { maxX: panel - 40 });
                const covered = await placePad(page, map, under);
                await expectStageWidth(map, stageWithPanel);
                const placed = (await stored(page, covered)).geometry.coordinates;
                const docked = await map.boundingBox();
                await expect.poll(async () => Math.round((await pixelNow(map, placed))[0] - docked.x), { timeout: 10_000 }).toBe(IN_VIEW_MARGIN);
                expect(Math.abs((await pixelNow(map, placed))[1] - under[1]), 'at the height it was placed at').toBeLessThanOrEqual(KEPT_PX);
                await undoLast(page, map);
            });

        editorTest('a line finished: its points keep their page spots as Details docks', async ({ page }) => {
            const map = await openEditor(page);
            await view(page, map, CTB1_VIEW.center, CTB1_VIEW.zoom);
            await expectStageWidth(map, stage);
            const [a, b] = await groundSpots(page, map, { minX: panel + 80, count: 2 });
            await page.locator('.mapstudio-toolbar .mapstudio-tool--line').click();
            await expect(map).toHaveAttribute('data-tool', 'line');
            const bar = page.locator('.mapstudio-drawing-bar');
            await page.mouse.click(a[0], a[1]);
            await expect(bar).toHaveAttribute('data-points', '1');
            await page.waitForTimeout(VERTEX_PAUSE_MS);
            await page.mouse.click(b[0], b[1]);
            await expect(bar).toHaveAttribute('data-points', '2');
            await page.waitForTimeout(VERTEX_PAUSE_MS);
            await page.keyboard.press('Enter');
            await expect(page.locator('.mapstudio-panel')).toHaveCount(1);
            const id = await page.locator('.mapstudio-panel').getAttribute('data-item-id');
            await expectStageWidth(map, stageWithPanel);
            const line = await stored(page, id);
            expectKept(await pixelNow(map, line.geometry.coordinates[0]), a, 'the first point kept its page spot');
            expectKept(await pixelNow(map, line.geometry.coordinates[1]), b, 'the last point kept its page spot');
            await undoLast(page, map);
        });

        editorTest('Details on CTB1 closed by a ground click, by its close and by Esc: CTB1 and the bend keep their page spots', async ({ page }) => {
            const map = await openEditor(page);
            await view(page, map, CTB1_VIEW.center, CTB1_VIEW.zoom);
            await expectStageWidth(map, stage);
            for (const how of ['ground', 'close', 'Esc']) {
                const pad = await pixelNow(map, CTB1);
                if (how !== 'ground') {
                    // The stage has just widened: MapLibre places its symbols again over the next frames, and a click before then
                    // finds no marker at CTB1 and takes L-SWD under it (seen on the software-GL box), so give it a moment.
                    await page.waitForTimeout(SETTLE_MS);
                }
                await page.mouse.click(pad[0], pad[1]);
                await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', seed.ids['swd/ctb1']);
                await expectStageWidth(map, stageWithPanel);
                const ctb1 = await pixelNow(map, CTB1);
                const bend = await pixelNow(map, BEND);
                if (how === 'ground') {
                    const [ground] = await groundSpots(page, map);
                    await page.mouse.click(ground[0], ground[1]);
                } else if (how === 'close') {
                    await page.locator('.mapstudio-panel .mapstudio-panel-close').click();
                } else {
                    await page.keyboard.press('Escape');
                }
                await expect(page.locator('.mapstudio-panel')).toHaveCount(0);
                await expectStageWidth(map, stage);
                expectKept(await pixelNow(map, CTB1), ctb1, how + ': CTB1 kept its page spot');
                expectKept(await pixelNow(map, BEND), bend, how + ': the bend kept its page spot');
            }
        });
    });
}

test.describe('1200 px, below the list\'s collapse width', () => {
    test.use({ viewport: { width: 1200, height: 768 }, deviceScaleFactor: 1 });

    editorTest('no docked list: the rail\'s Items opens it over the map whole and closes it; Esc and a map click close it; a row closes it and opens Details; the toolbar on the top row',
        async ({ page }) => {
            const map = await openEditor(page);
            const stage = 1200 - RAIL;
            await expect(map).toHaveAttribute('data-list', 'collapsed');
            await expect(page.locator('.mapstudio-dock--items')).toHaveCount(0);
            await expectStageWidth(map, stage);
            const items = page.locator('.mapstudio-rail-item[data-surface="items"]');
            await expect(items).toHaveAttribute('aria-expanded', 'false');
            const overlay = page.locator('.mapstudio-list-overlay');

            // Items opens it over the map's left edge, at the list's width, the 7a list whole; the map's box does not move.
            await items.click();
            await expect(map).toHaveAttribute('data-list', 'open');
            await expect(items).toHaveAttribute('aria-expanded', 'true');
            await expect(overlay).toBeVisible();
            const box = await map.boundingBox();
            const over = await overlay.boundingBox();
            expect(Math.round(over.x - box.x), 'at the map\'s left edge').toBe(0);
            expect(Math.round(over.width), 'at the list\'s width').toBe(256);
            expect(Math.round(over.height), 'the stage\'s height').toBe(Math.round(box.height));
            await expect(overlay.locator('.mapstudio-dock-header .mapstudio-dock-title')).toBeVisible();
            await expect(overlay.locator('.mapstudio-list-group').first()).toBeVisible();
            await expect(overlay.locator('.mapstudio-list-footer .mapstudio-list-add')).toBeVisible();
            await expectStageWidth(map, stage);
            // Items again closes it.
            await items.click();
            await expect(overlay).toHaveCount(0);
            await expect(map).toHaveAttribute('data-list', 'collapsed');
            // Esc closes it, the focus back on Items.
            await items.click();
            await expect(overlay).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(overlay).toHaveCount(0);
            await expect(items).toBeFocused();
            // A click on the map closes it (on the ground: nothing else happens).
            await items.click();
            await expect(overlay).toBeVisible();
            const [ground] = await groundSpots(page, map, { minX: 340 });
            await page.mouse.click(ground[0], ground[1]);
            await expect(overlay).toHaveCount(0);
            await expect(page.locator('.mapstudio-panel')).toHaveCount(0);

            // A row chosen closes it and opens that item's Details, docked: the map 1200 - 72 - 320 px. Sort by Name first: the
            // list's view outlives the close (entry 7c's review).
            const p2 = seed.ids['tracer/p2'];
            await items.click();
            await overlay.locator('.mapstudio-list-sort-select').selectOption('name');
            await overlay.locator('.mapstudio-list-row[data-item-id="' + p2 + '"]').click();
            await expect(overlay).toHaveCount(0);
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', p2);
            await expect(map).toHaveAttribute('data-selected', p2);
            await expectStageWidth(map, stage - 320);
            // Reopened: still sorted by Name.
            await items.click();
            await expect(overlay.locator('.mapstudio-list-sort-select')).toHaveValue('name');
            await expect(overlay.locator('.mapstudio-list')).toHaveAttribute('data-sort', 'name');
            await overlay.locator('.mapstudio-list-row[data-item-id="' + p2 + '"]').click();
            await expect(overlay).toHaveCount(0);
            // The focus went to the map with the row: Esc closes Details at once, no click needed.
            await page.keyboard.press('Escape');
            await expect(page.locator('.mapstudio-panel')).toHaveCount(0);
            await expect(map).toHaveAttribute('data-selected', '');
            await expectStageWidth(map, stage);
            await items.click();
            await overlay.locator('.mapstudio-list-row[data-item-id="' + p2 + '"]').click();
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', p2);
            await expectStageWidth(map, stage - 320);

            // The toolbar back on the top row: at the map inset, level with the Editing switch and clear of it and of the zoom card.
            const docked = await map.boundingBox();
            const toolbar = await page.locator('.mapstudio-toolbar').boundingBox();
            const sw = await page.locator('.mapstudio-edit-switch').boundingBox();
            const zoom = await page.locator('.mapstudio-zoom').boundingBox();
            expect(Math.abs(toolbar.y - (docked.y + INSET)), 'the toolbar at the map inset').toBeLessThanOrEqual(1);
            expect(Math.abs((toolbar.y + toolbar.height / 2) - (sw.y + sw.height / 2)), 'level with the Editing switch').toBeLessThanOrEqual(2);
            expect(sw.x - (toolbar.x + toolbar.width), 'clear of the Editing switch').toBeGreaterThanOrEqual(INSET);
            expect(zoom.x - (toolbar.x + toolbar.width), 'clear of the zoom card').toBeGreaterThanOrEqual(INSET);
            expect(toolbar.x - docked.x, 'clear of the map\'s left edge').toBeGreaterThanOrEqual(INSET);
        });

    editorTest('Layers alone docked in the list\'s place (the map 872 px): the toolbar stays on the top row, clear of the Editing switch',
        async ({ page }) => {
            const map = await openEditor(page);
            await page.locator('.mapstudio-rail-item[data-surface="layers"]').click();
            await expect(page.locator('.mapstudio-dock--layers')).toBeVisible();
            await expectStageWidth(map, 1200 - RAIL - 256);
            await expect(page.locator('.mapstudio-stage')).toHaveAttribute('data-toolbar-row', 'top');
            const box = await map.boundingBox();
            const toolbar = await page.locator('.mapstudio-toolbar').boundingBox();
            const sw = await page.locator('.mapstudio-edit-switch').boundingBox();
            expect(Math.abs(toolbar.y - (box.y + INSET)), 'the toolbar on the top row').toBeLessThanOrEqual(1);
            expect(sw.x - (toolbar.x + toolbar.width), 'clear of the Editing switch').toBeGreaterThanOrEqual(INSET);
        });

    editorTest('the window widened from 1200 to 1366 px: the list docks again and the items keep their page spots, and back', async ({ page }) => {
        const map = await openEditor(page);
        await view(page, map, CTB1_VIEW.center, CTB1_VIEW.zoom);
        await expect(map).toHaveAttribute('data-list', 'collapsed');
        await expectStageWidth(map, 1200 - RAIL);
        const ctb1 = await pixelNow(map, CTB1);
        const bend = await pixelNow(map, BEND);
        await page.setViewportSize({ width: 1366, height: 768 });
        await expect(map).toHaveAttribute('data-list', 'docked');
        await expect(page.locator('.mapstudio-dock--items')).toHaveCount(1);
        await expectStageWidth(map, 1366 - RAIL - 256);
        expectKept(await pixelNow(map, CTB1), ctb1, 'CTB1 kept its page spot');
        expectKept(await pixelNow(map, BEND), bend, 'the bend kept its page spot');
        // And narrowed again: the list leaves the dock, the items stay.
        await page.setViewportSize({ width: 1200, height: 768 });
        await expect(map).toHaveAttribute('data-list', 'collapsed');
        await expectStageWidth(map, 1200 - RAIL);
        expectKept(await pixelNow(map, CTB1), ctb1, 'CTB1 kept its page spot, narrowed');
        expectKept(await pixelNow(map, BEND), bend, 'the bend kept its page spot, narrowed');
    });
});

test.describe('1024 px, the toolbar\'s row from the map\'s width', () => {
    test.use({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });

    editorTest('Items with Details docked (the map 632 px): the toolbar takes the row under the Editing switch and never covers it', async ({ page }) => {
        const map = await openEditor(page);
        await expect(map).toHaveAttribute('data-list', 'collapsed');
        await expect(page.locator('.mapstudio-stage')).toHaveAttribute('data-toolbar-row', 'top');
        const p2 = seed.ids['tracer/p2'];
        await page.locator('.mapstudio-rail-item[data-surface="items"]').click();
        await page.locator('.mapstudio-list-overlay .mapstudio-list-row[data-item-id="' + p2 + '"]').click();
        await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', p2);
        await expectStageWidth(map, 1024 - RAIL - 320);
        await expect(page.locator('.mapstudio-stage')).toHaveAttribute('data-toolbar-row', 'under');
        const toolbar = await page.locator('.mapstudio-toolbar').boundingBox();
        const sw = await page.locator('.mapstudio-edit-switch').boundingBox();
        const apart = toolbar.x >= sw.x + sw.width || sw.x >= toolbar.x + toolbar.width || toolbar.y >= sw.y + sw.height || sw.y >= toolbar.y + toolbar.height;
        expect(apart, 'the toolbar clear of the Editing switch').toBe(true);
        expect(toolbar.y, 'the toolbar under the switch').toBeGreaterThanOrEqual(sw.y + sw.height);
        // Details closed: the map 952 px, the toolbar back on the top row.
        await page.locator('.mapstudio-panel .mapstudio-panel-close').click();
        await expectStageWidth(map, 1024 - RAIL);
        await expect(page.locator('.mapstudio-stage')).toHaveAttribute('data-toolbar-row', 'top');
    });
});
