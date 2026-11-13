// Selecting several (epic 4 entry 8; EXPERIENCE.md List row, Multi-select, Delete; DESIGN.md list-row, Properties panel, Floating
// draw toolbar), at 1366 px as the map editor on the seed, the plan's I/O matrix row by row: checkboxes (three ticked show "3 selected",
// Clear and Delete, three rings, no Details); a Shift-click range in the list in the order shown; "Select all in MESA FIELD", then
// the Well pad filter and "Select all in filter"; a Shift-drag box over CTB1 and SWD1 (L-SWD joins as it crosses it); a Shift+Alt-drag
// lasso round the Mesa pads; Shift-click on the map taking CTB1 out; a delete of three as one batch and one step "delete 3 items",
// Undo restoring all three; L-SWD and PT-1 deleted as one batch, PT-1 once; the set kept across the rail; the set emptied by a
// ground click, Clear and Esc; the page's selectedItems and onSelectionChanged on the dev /events page; and View mode's Shift-drag
// still MapLibre's box zoom. The spec leaves the seed as it found it (its deletes undone, then the seed run again and the strays
// removed).

import { pagePixel } from '../lib/geo.mjs';
import {
    EDITOR_USER, editorTest, ensureSeeded, expect, mapLoaded, openMap, removeStrays, runSeed, send, shot, signedInContext, test, view, REPLY_MS, CTB1,
    SWD1, pixelNow, SWD_VIEW
} from './fixtures.mjs';

/** The tracer's three pads (Point 1 to 3, linked to the Mesa assets P12, P14 and P15). */
const TRACER = [[-104.9903, 39.7392], [-104.975, 39.75], [-104.955, 39.743]];
const TRACER_VIEW = { center: [-104.973, 39.745], zoom: 13.5 };

let seed;
let ids;

test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });

test.beforeAll(async ({ browser }) => {
    seed = await ensureSeeded(browser);
    ids = {
        p1: seed.ids['tracer/p1'], p2: seed.ids['tracer/p2'], p3: seed.ids['tracer/p3'], ctb1: seed.ids['swd/ctb1'], swd1: seed.ids['swd/swd1'],
        line: seed.ids['swd/line'], pt1: seed.ids['swd/pt1'], pt2: seed.ids['swd/pt2'], lv1: seed.ids['swd/lv1'],
        pad1: seed.ids['scale/pad-1'], pad2: seed.ids['scale/pad-2'], pad3: seed.ids['scale/pad-3'], pad4: seed.ids['scale/pad-4']
    };
    await restoreSeed(browser);
});

test.afterAll(async ({ browser }) => {
    await restoreSeed(browser);
});

/** The seed's own items again (a delete a failed test left is put back by the seed), and no item but the seed's. */
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

/** /edit as the map editor at level `full`: the studio shows, the first full batch in. */
async function openEditor(page, path = '/edit') {
    const map = await openMap(page, path);
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', 'full');
    if (path === '/edit') {
        await expect(map).toHaveAttribute('data-studio', 'on');
    }
    await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
    return map;
}

/** The selected set as the map publishes it (`data-selected-ids`, joining order). */
async function selectedIds(map) {
    const text = await map.getAttribute('data-selected-ids');
    return text ? text.split(',') : [];
}

async function expectSet(map, expected) {
    await expect.poll(() => selectedIds(map), { timeout: 10_000 }).toEqual(expected);
}

/** A row's checkbox and its button in the docked list. */
function check(page, id) {
    return page.locator('.mapstudio-list-check[data-item-id="' + id + '"]');
}

function rowButton(page, id) {
    return page.locator('.mapstudio-list-row[data-item-id="' + id + '"]');
}

/** The rows shown in the list, in order, without the context rows. */
async function shownRows(page) {
    return page.locator('.mapstudio-list-row:not(.mapstudio-list-row--context)').evaluateAll((els) => els.map((el) => el.getAttribute('data-item-id')));
}

/** The count's panel with several selected. */
function countPanel(page) {
    return page.locator('.mapstudio-panel--several');
}

/** A drag with Shift (and Alt for a lasso) held, through the page pixels given, in small steps. */
async function shiftDrag(page, points, alt = false) {
    await page.keyboard.down('Shift');
    if (alt) await page.keyboard.down('Alt');
    await page.mouse.move(points[0][0], points[0][1]);
    await page.mouse.down();
    for (let i = 1; i < points.length; i++) {
        await page.mouse.move(points[i][0], points[i][1], { steps: 8 });
    }
    await page.mouse.up();
    if (alt) await page.keyboard.up('Alt');
    await page.keyboard.up('Shift');
}

/** A click with Shift held (the mouse's click takes no modifiers of its own). */
async function shiftClick(page, [x, y]) {
    await page.keyboard.down('Shift');
    await page.mouse.click(x, y);
    await page.keyboard.up('Shift');
}

/** A page pixel on the ground of the view now: no item within 44 px (points) or 24 px (lines), outside every area. */
async function groundSpot(page, map) {
    const box = await map.boundingBox();
    const center = (await map.getAttribute('data-center')).split(',').map(Number);
    const zoom = Number(await map.getAttribute('data-zoom'));
    const items = (await send(page, 'map.load', {})).body.items.filter((i) => !i.deleted);
    const px = (lngLat) => pagePixel(box, lngLat, center, zoom);
    const points = items.filter((i) => i.geometry.type === 'Point').map((i) => px(i.geometry.coordinates));
    const segments = [];
    const rings = [];
    for (const line of items.filter((i) => i.geometry.type === 'LineString')) {
        const coords = line.geometry.coordinates.map(px);
        rings.push(coords);
        for (let i = 1; i <= coords.length; i++) segments.push([coords[i - 1], coords[i % coords.length]]);
    }
    const toSegment = ([x, y], [[ax, ay], [bx, by]]) => {
        const dx = bx - ax;
        const dy = by - ay;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
        return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    };
    const inside = ([x, y], ring) => {
        let c = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [xi, yi] = ring[i];
            const [xj, yj] = ring[j];
            if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
        }
        return c;
    };
    for (let y = box.y + 120; y < box.y + box.height - 100; y += 40) {
        for (let x = box.x + 80; x < box.x + box.width - 80; x += 40) {
            if (points.some(([a, b]) => Math.hypot(a - x, b - y) < 44)) continue;
            if (segments.some((seg) => toSegment([x, y], seg) < 24)) continue;
            if (rings.some((ring) => ring.length >= 3 && inside([x, y], ring))) continue;
            return [x, y];
        }
    }
    throw new Error('No ground spot clear of the seeded items in this view.');
}

test.describe('selecting several (entry 8)', () => {
    editorTest('checkboxes: Point 1, Point 2 and CTB1 ticked show "3 selected", Clear and Delete, three rings and no Details', async ({ page }) => {
        const map = await openEditor(page);
        await check(page, ids.p1).check();
        await check(page, ids.p2).check();
        await check(page, ids.ctb1).check();
        await expectSet(map, [ids.p1, ids.p2, ids.ctb1]);
        const panel = countPanel(page);
        await expect(panel.locator('.mapstudio-several-count')).toHaveText('3 selected');
        await expect(panel.locator('.mapstudio-several-clear')).toHaveText('Clear');
        await expect(panel.locator('.mapstudio-panel-delete')).toBeEnabled();
        await expect(panel.locator('.mapstudio-panel-delete')).toHaveAttribute('title', 'Delete (Del)');
        await expect(page.locator('.mapstudio-panel[data-item-id]')).toHaveCount(0);
        for (const id of [ids.p1, ids.p2, ids.ctb1]) {
            await expect(page.locator('.mapstudio-live-item[data-item-id="' + id + '"]')).toHaveAttribute('data-ringed', 'true');
            await expect(rowButton(page, id)).toHaveClass(/mapstudio-list-row--selected/);
        }
        await expect(page.locator('.mapstudio-live-item[data-item-id="' + ids.p3 + '"]')).toHaveAttribute('data-ringed', 'false');
        // No geometry handles with several.
        await expect(map).toHaveAttribute('data-handles', '');
        await shot(page, 'mapstudio-multiselect-count-1366.png');
    });

    editorTest('a Shift-click range: Point 1 clicked, SWD1 Shift-clicked in the list, every row between them in the order shown', async ({ page }) => {
        const map = await openEditor(page);
        await page.locator('.mapstudio-list-sort-select').selectOption('name');
        await rowButton(page, ids.p1).click();
        await expect(map).toHaveAttribute('data-selected', ids.p1);
        await rowButton(page, ids.swd1).click({ modifiers: ['Shift'] });
        const order = await shownRows(page);
        const a = order.indexOf(ids.p1);
        const b = order.indexOf(ids.swd1);
        const expected = a <= b ? order.slice(a, b + 1) : order.slice(b, a + 1).reverse();
        expect(expected.length, 'rows between Point 1 and SWD1').toBeGreaterThan(2);
        await expectSet(map, expected);
        await expect(countPanel(page).locator('.mapstudio-several-count')).toHaveText(expected.length + ' selected');
    });

    editorTest('"Select all in MESA FIELD", then the Well pad filter and "Select all in filter"', async ({ page }) => {
        const map = await openEditor(page);
        await page.locator('.mapstudio-list-select-all-row[data-group="h:field:Mesa"] .mapstudio-list-select-all').click();
        const field = await page.locator('.mapstudio-list > li').evaluateAll((els) => {
            const out = [];
            let inField = false;
            for (const el of els) {
                if (el.classList.contains('mapstudio-list-group') && !el.classList.contains('mapstudio-list-group--sub')) {
                    inField = el.getAttribute('data-group') === 'h:field:Mesa';
                    continue;
                }
                const row = el.querySelector('.mapstudio-list-row:not(.mapstudio-list-row--context)');
                if (inField && row) out.push(row.getAttribute('data-item-id'));
            }
            return out;
        });
        expect(field).toEqual(expect.arrayContaining([ids.p1, ids.p2, ids.p3, ids.ctb1, ids.swd1, ids.line]));
        await expectSet(map, field);
        await page.locator('.mapstudio-list-filter').click();
        await page.locator('.mapstudio-kind-chip[data-kind="pad"]').click();
        await expect(page.locator('.mapstudio-list-select-filter')).toHaveText('Select all in filter');
        await page.locator('.mapstudio-list-select-filter').click();
        const pads = await shownRows(page);
        expect(pads).toEqual(expect.arrayContaining([ids.pad1, ids.p1, ids.ctb1]));
        expect(pads).not.toContain(ids.line);
        await expectSet(map, pads);
    });

    editorTest('a Shift-drag box over CTB1 and SWD1: both join, and L-SWD as it crosses the box; a far pad does not', async ({ page }) => {
        const map = await openEditor(page);
        await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
        await expect(map).toHaveAttribute('data-box-zoom', 'off');
        const a = await pixelNow(map, CTB1);
        const b = await pixelNow(map, SWD1);
        const zoomBefore = await map.getAttribute('data-zoom');
        await shiftDrag(page, [[a[0] - 12, a[1] - 12], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], [b[0] + 12, b[1] + 12]]);
        await expect.poll(() => selectedIds(map)).toEqual(expect.arrayContaining([ids.ctb1, ids.swd1, ids.line]));
        expect(await selectedIds(map)).not.toContain(ids.p3);
        // Nothing zoomed, nothing panned: the drag was the box's.
        await expect(map).toHaveAttribute('data-zoom', zoomBefore);
        await expect(map).toHaveAttribute('data-box-select', '');
        await expect(page.locator('.mapstudio-box-select')).toHaveCount(0);
    });

    editorTest('the box draws a dashed edge over the tint while dragged; Esc during the drag cancels it with nothing selected', async ({ page }) => {
        const map = await openEditor(page);
        await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
        const a = await pixelNow(map, CTB1);
        const b = await pixelNow(map, SWD1);
        await page.keyboard.down('Shift');
        await page.mouse.move(a[0] - 12, a[1] - 12);
        await page.mouse.down();
        await page.mouse.move(b[0] + 12, b[1] + 12, { steps: 8 });
        await expect(map).toHaveAttribute('data-box-select', 'box');
        const shape = page.locator('.mapstudio-box-select-shape');
        await expect(shape).toHaveCount(1);
        await expect(shape).toHaveCSS('stroke-dasharray', /5(px)?,? 4(px)?/);
        await shot(page, 'mapstudio-multiselect-box-1366.png');
        await page.keyboard.press('Escape');
        await expect(page.locator('.mapstudio-box-select')).toHaveCount(0);
        await page.mouse.up();
        await page.keyboard.up('Shift');
        await expectSet(map, []);
    });

    editorTest('a Shift+Alt-drag lasso round the Mesa pads: every pad inside joins', async ({ page }) => {
        const map = await openEditor(page);
        await view(page, map, TRACER_VIEW.center, TRACER_VIEW.zoom);
        const px = [];
        for (const p of TRACER) px.push(await pixelNow(map, p));
        const cx = (px[0][0] + px[1][0] + px[2][0]) / 3;
        const cy = (px[0][1] + px[1][1] + px[2][1]) / 3;
        // A path round the three pads, each corner 40 px further out from their centre, closed back at its start.
        const out = px.map(([x, y]) => {
            const d = Math.hypot(x - cx, y - cy) || 1;
            return [x + ((x - cx) / d) * 40, y + ((y - cy) / d) * 40];
        });
        await shiftDrag(page, [out[0], out[1], out[2], out[0]], true);
        await expect.poll(() => selectedIds(map)).toEqual(expect.arrayContaining([ids.p1, ids.p2, ids.p3]));
        expect(await selectedIds(map)).not.toContain(ids.ctb1);
    });

    editorTest('Shift-click on the map: CTB1 in the set leaves it', async ({ page }) => {
        const map = await openEditor(page);
        await check(page, ids.ctb1).check();
        await check(page, ids.swd1).check();
        await expectSet(map, [ids.ctb1, ids.swd1]);
        // The count's panel docked: L-SWD in view in the narrower map.
        await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
        const px = await pixelNow(map, CTB1);
        await shiftClick(page, px);
        await expectSet(map, [ids.swd1]);
        await shiftClick(page, await pixelNow(map, CTB1));
        await expectSet(map, [ids.swd1, ids.ctb1]);
    });

    editorTest('Delete of three: one batch, one step "delete 3 items"; Undo restores all three', async ({ page }) => {
        const map = await openEditor(page);
        const before = Number(await map.getAttribute('data-items-loaded'));
        for (const id of [ids.pad1, ids.pad2, ids.pad3]) await check(page, id).check();
        await expect(countPanel(page).locator('.mapstudio-several-count')).toHaveText('3 selected');
        // The focus stays on the last ticked checkbox: Delete and Ctrl+Z act on the map from there.
        await expect(check(page, ids.pad3)).toBeFocused();
        await page.keyboard.press('Delete');
        await expectSet(map, []);
        const undo = page.locator('.mapstudio-toolbar .mapstudio-undo');
        await expect(undo).toHaveAttribute('title', 'Undo: delete 3 items (Ctrl+Z)', { timeout: REPLY_MS });
        await expect(map).toHaveAttribute('data-items-loaded', String(before - 3), { timeout: REPLY_MS });
        // Ctrl+Z with the focus on a ticked checkbox again (Pad 4's): the undo is the map's, not the checkbox's.
        await check(page, ids.pad4).check();
        await expect(check(page, ids.pad4)).toBeFocused();
        await page.keyboard.press('Control+z');
        await expect(map).toHaveAttribute('data-items-loaded', String(before), { timeout: REPLY_MS });
        const load = await send(page, 'map.load', {});
        for (const id of [ids.pad1, ids.pad2, ids.pad3]) {
            expect(load.body.items.some((i) => i.id === id && !i.deleted), id + ' restored').toBe(true);
        }
    });

    editorTest('L-SWD and PT-1 (on it) deleted from the footer: one batch, PT-1 once, the other instruments with the line; Undo restores', async ({ page }) => {
        const map = await openEditor(page);
        await check(page, ids.line).check();
        await check(page, ids.pt1).check();
        await countPanel(page).locator('.mapstudio-panel-delete').click();
        await expect(map).toHaveAttribute('data-save-state', 'saved', { timeout: REPLY_MS });
        const undo = page.locator('.mapstudio-toolbar .mapstudio-undo');
        await expect(undo).toHaveAttribute('title', 'Undo: delete 2 items (Ctrl+Z)', { timeout: REPLY_MS });
        let load = await send(page, 'map.load', {});
        const live = (id) => load.body.items.some((i) => i.id === id && !i.deleted);
        for (const id of [ids.line, ids.pt1, ids.pt2, ids.lv1]) expect(live(id), id + ' deleted').toBe(false);
        expect(live(ids.ctb1)).toBe(true);
        await undo.click();
        await expect.poll(async () => {
            load = await send(page, 'map.load', {});
            return [ids.line, ids.pt1, ids.pt2, ids.lv1].every(live);
        }, { timeout: REPLY_MS }).toBe(true);
    });

    editorTest('kept and cleared: three selected stay across the rail; a ground click, Clear and Esc each empty the set', async ({ page }) => {
        const map = await openEditor(page);
        const tick = async () => {
            for (const id of [ids.p1, ids.p2, ids.p3]) await check(page, id).check();
            await expectSet(map, [ids.p1, ids.p2, ids.p3]);
        };
        await tick();
        await page.locator('.mapstudio-rail-item[data-surface="kinds"]').click();
        await page.locator('.mapstudio-rail-item[data-surface="items"]').click();
        await expectSet(map, [ids.p1, ids.p2, ids.p3]);
        await expect(countPanel(page)).toBeVisible();
        const ground = await groundSpot(page, map);
        await page.mouse.click(ground[0], ground[1]);
        await expectSet(map, []);
        await expect(countPanel(page)).toHaveCount(0);
        await tick();
        await countPanel(page).locator('.mapstudio-several-clear').click();
        await expectSet(map, []);
        await tick();
        await page.locator('.mapstudio-map canvas').focus();
        await page.keyboard.press('Escape');
        await expectSet(map, []);
        await expect(countPanel(page)).toHaveCount(0);
    });

    editorTest('the page: three selected then cleared, selectedItems the three ids then [], onSelectionChanged twice more', async ({ page }) => {
        const map = await openEditor(page, '/events');
        await page.locator('.mapstudio-edit-switch-button').click();
        await expect(map).toHaveAttribute('data-studio', 'on');
        const changed = page.locator('#mapstudio-events-selection-changed');
        const countOf = async () => Number((await changed.textContent()).split('|')[0]);
        // A selection the page's session kept from an earlier visit is cleared first (the page writes null), and the events it
        // brings settle, so the count starts from a quiet page.
        await page.locator('#mapstudio-events-write-null').click();
        await expectSet(map, []);
        await expect(page.locator('#mapstudio-events-selected')).toHaveText(/^selectedItem:\s*$/, { timeout: REPLY_MS });
        let settled = -1;
        await expect.poll(async () => {
            const now = await countOf();
            const same = now === settled;
            settled = now;
            return same;
        }, { timeout: REPLY_MS, intervals: [1500] }).toBe(true);
        const start = await countOf();
        // Three at once with one Select all in filter (one change of the set), then Clear (another).
        await page.locator('.mapstudio-list-sort-select').selectOption('name');
        await page.locator('.mapstudio-list-search-input').fill('Point');
        await page.locator('.mapstudio-list-select-filter').click();
        await expectSet(map, [ids.p1, ids.p2, ids.p3]);
        await expect(page.locator('#mapstudio-events-selected-items')).toHaveText('selectedItems: ' + [ids.p1, ids.p2, ids.p3].join(','),
            { timeout: REPLY_MS });
        await expect.poll(countOf, { timeout: REPLY_MS }).toBe(start + 1);
        await expect(changed).toHaveText((start + 1) + '|' + [ids.p1, ids.p2, ids.p3].join(','));
        await expect(page.locator('#mapstudio-events-selected')).toHaveText('selectedItem: ' + ids.p3, { timeout: REPLY_MS });
        await countPanel(page).locator('.mapstudio-several-clear').click();
        await expect(page.locator('#mapstudio-events-selected-items')).toHaveText(/^selectedItems:\s*$/, { timeout: REPLY_MS });
        await expect.poll(countOf, { timeout: REPLY_MS }).toBe(start + 2);
        await expect(changed).toHaveText((start + 2) + '|');
        await expect(page.locator('#mapstudio-events-selected')).toHaveText(/^selectedItem:\s*$/, { timeout: REPLY_MS });
    });

    editorTest('View mode: Shift-drag is MapLibre\'s box zoom, as before; nothing is selected', async ({ page }) => {
        const map = await openEditor(page, '/events');
        await expect(map).toHaveAttribute('data-mode', 'view');
        await expect(map).toHaveAttribute('data-box-zoom', 'on');
        await view(page, map, TRACER_VIEW.center, 12);
        const box = await map.boundingBox();
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await shiftDrag(page, [[x - 60, y - 60], [x + 60, y + 60]]);
        await expect.poll(async () => Number(await map.getAttribute('data-zoom')), { timeout: 10_000 }).toBeGreaterThan(12.5);
        expect(await selectedIds(map)).toEqual([]);
        await expect(page.locator('.mapstudio-box-select')).toHaveCount(0);
    });
});
