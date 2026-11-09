// Add an instrument from a line's Details, placed by a click or a typed distance, moved only along the line (epic 4 entry 9;
// EXPERIENCE.md Instruments and Properties panel; owner 2026-11-06 and 2026-11-09): at 1366 px as the map editor, on the seed's L-SWD
// (CTB1 to SWD1, 2,922 m, PT-1 at 1,143 m, LV-1 at 2,000 m, PT-2 at 2,841 m). L-SWD's Details list its instruments in order with
// their distances; Add an instrument opens the short list of the three instrument kinds; the drawing bar names the kind and the line;
// a click off the line is refused in words and nothing is saved; a click on the line places a tap at the click's projection, its
// Details open with Name focused, one undo step "add Tap"; a typed 99999 is refused in words, a typed 2841 places a meter there,
// listed in L-SWD's Details and its line popup; PT-1 dragged along the line and off it stays on the line and lands at the projection,
// one step "move PT-1", and its typed distance moves it back, each one Undo step; an added tap stays on L-SWD reshaped, goes with it
// deleted, and one Undo restores all; no tap, meter or valve among the toolbar's kind buttons or the Point tool's kinds. The spec
// leaves the seed as it found it (each change undone, then the seed run again and the strays removed), since later specs read L-SWD.

import { pagePixel } from '../lib/geo.mjs';
import {
    EDITOR_USER, editorTest, ensureSeeded, expect, mapLoaded, openMap, removeStrays, runSeed, send, shot as shotNow, signedInContext, test, view
} from './fixtures.mjs';

/** The Gateway's answer to a save. */
const REPLY_MS = 20_000;
/** There is nothing to observe when nothing is sent: the time a stray batch would have to show in the map's seq. */
const NOTHING_MS = 800;

// The L-SWD set (ops/project seed): its three points, the first on CTB1 and the last on SWD1, 2,922 m long.
const CTB1 = [-105.012, 39.7262];
const BEND = [-105.009441, 39.720791];
const SWD1 = [-104.983671, 39.715476];
// Places along L-SWD (Turf's `along`, the geometry module's): PT-1 at 1,143 m, and 1,300 m and 1,500 m further on.
const AT_1143 = [-105.003761, 39.71962];
const AT_1300 = [-105.001988, 39.719254];
const AT_1500 = [-104.999729, 39.718789];
// The line in view with Details docked (718 px of map at 1366 px).
const SWD_VIEW = { center: [(CTB1[0] + SWD1[0]) / 2, (CTB1[1] + SWD1[1]) / 2 + 0.001], zoom: 13.5 };
// Close in on PT-1's stretch, where a pixel is under 2 m: the click's place is the place a test means.
const NEAR_VIEW = { center: [AT_1300[0], AT_1300[1] + 0.0004], zoom: 16 };

let seed;
let ids;

test.beforeAll(async ({ browser }) => {
    seed = await ensureSeeded(browser);
    ids = { line: seed.ids['swd/line'], ctb1: seed.ids['swd/ctb1'], swd1: seed.ids['swd/swd1'], pt1: seed.ids['swd/pt1'], lv1: seed.ids['swd/lv1'],
        pt2: seed.ids['swd/pt2'] };
    await restoreSeed(browser);
});

test.afterAll(async ({ browser }) => {
    await restoreSeed(browser);
});

/** The seed's own L-SWD set again (a change a failed test left), and no item but the seed's. */
async function restoreSeed(browser) {
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
        await removeStrays(page, seed.ids);
        const result = await runSeed(page);
        expect(result.error, 'the seed saved').toBeUndefined();
        await removeStrays(page, seed.ids);
    } finally {
        await context.close();
    }
}

async function openEditor(page) {
    const map = await openMap(page, '/edit');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', 'full');
    await expect(map).toHaveAttribute('data-studio', 'on');
    return map;
}

/** The map's page pixel of a place, from the box and the view the map reports now (the stage resizes as panels open). */
async function pixelNow(map, lngLat) {
    const box = await map.boundingBox();
    const center = (await map.getAttribute('data-center')).split(',').map(Number);
    const zoom = Number(await map.getAttribute('data-zoom'));
    return pagePixel(box, lngLat, center, zoom);
}

/** A render for the docs once the markers have taken the view's zoom. */
async function shot(page, name) {
    await page.waitForTimeout(800);
    await shotNow(page, name);
}

/** The stored map items through the test hook, by id. */
async function storedAll(page) {
    return Object.fromEntries((await send(page, 'map.load', {})).body.items.map((i) => [i.id, i]));
}

async function seqOf(map) {
    return Number(await map.getAttribute('data-store-seq'));
}

/** One change saved as one batch: the toolbar's Undo names its step, and the map's seq moved on by exactly one. */
async function expectOneBatch(page, map, seqBefore, step) {
    await expect(page.locator('.mapstudio-toolbar .mapstudio-undo')).toHaveAttribute('data-step', 'Undo: ' + step, { timeout: REPLY_MS });
    await expect(map).toHaveAttribute('data-store-seq', String(seqBefore + 1), { timeout: REPLY_MS });
    await page.waitForTimeout(500);
    await expect(map).toHaveAttribute('data-store-seq', String(seqBefore + 1));
}

/** The toolbar's Undo, as one batch: the seq moves on by one and `check` (a stored state) holds again. */
async function undoOnce(page, map, check) {
    const before = await seqOf(map);
    await page.locator('.mapstudio-toolbar .mapstudio-undo').click();
    await expect(map).toHaveAttribute('data-store-seq', String(before + 1), { timeout: REPLY_MS });
    await expect.poll(async () => check(await storedAll(page)), { timeout: REPLY_MS }).toBe(true);
}

/** Haversine metres between two places. */
function metres(a, b) {
    const r = (d) => (d * Math.PI) / 180;
    const h = Math.sin(r(b[1] - a[1]) / 2) ** 2 + Math.sin(r(b[0] - a[0]) / 2) ** 2 * Math.cos(r(a[1])) * Math.cos(r(b[1]));
    return 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 6371008.8;
}

async function selectRow(page, id) {
    await page.locator('.mapstudio-list-row[data-item-id="' + id + '"]').click();
    await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', id);
}

/** The Instruments row of the open Details: each instrument's name and distance, in order. */
async function instrumentRows(page) {
    return page.locator('.mapstudio-panel .mapstudio-instrument-row').evaluateAll((els) => els.map((e) =>
        e.querySelector('.mapstudio-instrument-name').textContent + ' ' + e.querySelector('.mapstudio-instrument-at').textContent));
}

/** Add an instrument in L-SWD's Details with `kindId` picked from the short list; returns the drawing bar. */
async function arm(page, map, kindId) {
    const add = page.locator('.mapstudio-panel .mapstudio-field-add-instrument');
    await expect(add).toBeEnabled();
    await add.click();
    const menu = page.locator('.mapstudio-instrument-kinds');
    await expect(menu.locator('.mapstudio-instrument-kind')).toHaveText(['Tap', 'Line valve', 'Meter']);
    await menu.locator('.mapstudio-instrument-kind[data-kind="' + kindId + '"]').click();
    const bar = page.locator('.mapstudio-drawing-bar--instrument');
    await expect(bar).toBeVisible();
    await expect(map).toHaveAttribute('data-armed-line', ids.line);
    await expect(map).toHaveAttribute('data-armed-kind', kindId);
    return bar;
}

test.describe('1366 px', () => {
    test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });

    editorTest('L-SWD lists its instruments in order; a click off the line is refused in words; a click on it places a tap at its projection, one step',
        async ({ page }) => {
            const map = await openEditor(page);
            await selectRow(page, ids.line);
            await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
            const instruments = page.locator('.mapstudio-panel .mapstudio-field--instruments');
            await expect(instruments.locator('.mapstudio-field-label')).toHaveText('Instruments');
            expect(await instrumentRows(page)).toEqual(['PT-1 1.1 km', 'LV-1 2 km', 'PT-2 2.8 km']);
            // Instruments sits after Location.
            expect(await page.locator('.mapstudio-panel-body > .mapstudio-field').evaluateAll((els) => els.map((e) => e.className)
                .findIndex((c) => c.includes('mapstudio-field--instruments')) - els.map((e) => e.className)
                .findIndex((c) => c.includes('mapstudio-field--location')))).toBe(1);

            const bar = await arm(page, map, 'tap');
            await expect(bar.locator('.mapstudio-drawing-title')).toHaveText('New tap on L-SWD - click the line or type its distance');
            await expect(bar.locator('.mapstudio-instrument-length')).toHaveText('of 2,922 m');
            await expect(bar.locator('.mapstudio-instrument-distance')).toBeFocused();
            await expect(bar.locator('.mapstudio-instrument-place-button')).toBeVisible();
            await expect(bar.locator('.mapstudio-drawing-cancel')).toBeVisible();
            // No handles while it waits for its click: the click is the instrument's.
            await expect(map).toHaveAttribute('data-handles', '');
            await shot(page, 'mapstudio-add-instrument-armed-1366.png');

            // A click on the empty map, and one on another item, are refused in words; nothing is saved.
            const seqBefore = await seqOf(map);
            const off = await pixelNow(map, [AT_1500[0], AT_1500[1] + 0.006]);
            await page.mouse.click(off[0], off[1]);
            await expect(bar).toHaveAttribute('data-reason', 'Click on L-SWD: an instrument sits on its line');
            await expect(bar.locator('.mapstudio-drawing-hint--problem')).toHaveText('Click on L-SWD: an instrument sits on its line');
            const ctb1 = await pixelNow(map, [CTB1[0] + 0.0045, CTB1[1] + 0.001]);
            await page.mouse.click(ctb1[0], ctb1[1]);
            await expect(bar).toHaveAttribute('data-reason', 'Click on L-SWD: an instrument sits on its line');
            await page.waitForTimeout(NOTHING_MS);
            await expect(map).toHaveAttribute('data-store-seq', String(seqBefore));
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', ids.line);

            // A click on the line near PT-1 places a tap there: within 1 m of the click's place on the line (a pixel is under 2 m).
            await view(page, map, NEAR_VIEW.center, NEAR_VIEW.zoom);
            const on = await pixelNow(map, AT_1300);
            await page.mouse.click(on[0], on[1]);
            await expectOneBatch(page, map, seqBefore, 'add Tap');
            const panel = page.locator('.mapstudio-panel');
            await expect(panel).not.toHaveAttribute('data-item-id', ids.line);
            const tap = await panel.getAttribute('data-item-id');
            await expect(page.locator('.mapstudio-field-name')).toBeFocused();
            await expect(page.locator('.mapstudio-field-name')).toHaveValue('Tap');
            await expect(bar).toHaveCount(0);
            await expect(map).toHaveAttribute('data-armed-line', '');
            const items = await storedAll(page);
            expect(items[tap].kind).toBe('tap');
            expect(items[tap].attachment.lineId).toBe(ids.line);
            expect(Math.abs(items[tap].attachment.distanceM - 1300)).toBeLessThan(4);
            expect(metres(items[tap].geometry.coordinates, AT_1300)).toBeLessThan(4);
            // Its Details: on its line at its distance, the distance field, latitude and longitude read only, no Move.
            await expect(panel.locator('.mapstudio-field-on-line')).toHaveText('On L-SWD at 1.3 km');
            await expect(panel.locator('.mapstudio-field-distance')).toHaveValue(String(items[tap].attachment.distanceM));
            await expect(panel.locator('.mapstudio-field-lat')).toHaveAttribute('readonly', '');
            await expect(panel.locator('.mapstudio-field-lng')).toHaveAttribute('readonly', '');
            await expect(panel.locator('.mapstudio-field-move')).toHaveCount(0);
            await expect(panel.locator('.mapstudio-field-kind option')).toHaveText(['Tap', 'Line valve', 'Meter']);
            await shot(page, 'mapstudio-add-instrument-placed-1366.png');

            // L-SWD lists it in order; one Undo takes it away.
            await selectRow(page, ids.line);
            expect(await instrumentRows(page)).toEqual(['PT-1 1.1 km', 'Tap 1.3 km', 'LV-1 2 km', 'PT-2 2.8 km']);
            await undoOnce(page, map, (now) => !now[tap]);
            await expect.poll(() => instrumentRows(page)).toEqual(['PT-1 1.1 km', 'LV-1 2 km', 'PT-2 2.8 km']);
        });

    editorTest('a typed 99999 is refused in words; a typed 2841 places a meter there, listed in the row and the line popup; Esc and Cancel put it down',
        async ({ page }) => {
            const map = await openEditor(page);
            await selectRow(page, ids.line);
            await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
            const seqBefore = await seqOf(map);

            // Cancel, and Esc in the field, put it down; nothing is saved and Details stays.
            let bar = await arm(page, map, 'meter');
            await bar.locator('.mapstudio-drawing-cancel').click();
            await expect(bar).toHaveCount(0);
            bar = await arm(page, map, 'meter');
            await page.keyboard.press('Escape');
            await expect(bar).toHaveCount(0);
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', ids.line);

            bar = await arm(page, map, 'meter');
            await expect(bar.locator('.mapstudio-drawing-title')).toHaveText('New meter on L-SWD - click the line or type its distance');
            const field = bar.locator('.mapstudio-instrument-distance');
            await field.fill('99999');
            await field.press('Enter');
            await expect(bar).toHaveAttribute('data-reason', 'Type a distance from 0 to 2,922 m');
            await expect(field).toHaveAttribute('aria-invalid', 'true');
            await page.waitForTimeout(NOTHING_MS);
            await expect(map).toHaveAttribute('data-store-seq', String(seqBefore));

            await field.fill('2841');
            await bar.locator('.mapstudio-instrument-place-button').click();
            await expectOneBatch(page, map, seqBefore, 'add Meter');
            const panel = page.locator('.mapstudio-panel');
            await expect(panel).not.toHaveAttribute('data-item-id', ids.line);
            const meter = await panel.getAttribute('data-item-id');
            await expect(page.locator('.mapstudio-field-name')).toBeFocused();
            const items = await storedAll(page);
            expect(items[meter]).toMatchObject({ kind: 'meter', name: 'Meter', attachment: { lineId: ids.line, distanceM: 2841 } });
            await expect(panel.locator('.mapstudio-field-on-line')).toHaveText('On L-SWD at 2.8 km');

            // In order in L-SWD's Details (with PT-2 at the same distance, the two in id order) and in its line popup.
            await selectRow(page, ids.line);
            const rows = await instrumentRows(page);
            expect(rows.slice(0, 2)).toEqual(['PT-1 1.1 km', 'LV-1 2 km']);
            expect(rows.slice(2).sort()).toEqual(['Meter 2.8 km', 'PT-2 2.8 km']);
            await page.locator('.mapstudio-rail-item[data-surface="view"]').click();
            await expect(map).toHaveAttribute('data-mode', 'view');
            await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
            const between = await pixelNow(map, AT_1500);
            await page.mouse.click(between[0], between[1]);
            const popup = page.locator('.maplibregl-popup .mapstudio-popup--line');
            await expect(popup).toBeVisible({ timeout: 30_000 });
            const names = await popup.locator('.mapstudio-popup-instrument .mapstudio-popup-row-name').allTextContents();
            expect(names.indexOf('Meter')).toBeGreaterThan(names.indexOf('LV-1'));
            expect(names).toContain('PT-2');
            await expect(popup.locator('.mapstudio-popup-instrument[data-row-id="' + meter + '"] .mapstudio-popup-row-distance')).toHaveText('2.8 km');
            await popup.locator('.mapstudio-popup-close').click();
        });

    editorTest('PT-1 dragged along the line and off it stays on the line, one step "move PT-1"; its typed distance moves it back; each one Undo step',
        async ({ page }) => {
            const map = await openEditor(page);
            await selectRow(page, ids.pt1);
            await view(page, map, NEAR_VIEW.center, NEAR_VIEW.zoom);
            await expect(map).toHaveAttribute('data-instrument-handle', ids.pt1);
            // No handles of Terra Draw's, and the snapping never applies: the drag is along the line.
            await expect(map).toHaveAttribute('data-handles', '');
            const panel = page.locator('.mapstudio-panel');
            await expect(panel.locator('.mapstudio-field-on-line')).toHaveText('On L-SWD at 1.1 km');
            let seqBefore = await seqOf(map);

            const from = await pixelNow(map, AT_1143);
            const along = await pixelNow(map, AT_1300);
            await page.mouse.move(from[0], from[1]);
            await page.mouse.down();
            await page.mouse.move(from[0] + (along[0] - from[0]) / 2, from[1] + (along[1] - from[1]) / 2, { steps: 4 });
            await page.mouse.move(along[0], along[1], { steps: 6 });
            await expect.poll(async () => Number(await map.getAttribute('data-instrument-drag'))).toBeGreaterThan(1250);
            // Off the line, 80 px to the side: where it would land stays on the line, the pointer projected back.
            await page.mouse.move(along[0] + 20, along[1] - 80, { steps: 6 });
            const projected = Number(await map.getAttribute('data-instrument-drag'));
            expect(projected).toBeGreaterThan(1250);
            expect(projected).toBeLessThan(1400);
            await page.mouse.up();
            await expectOneBatch(page, map, seqBefore, 'move PT-1');
            let items = await storedAll(page);
            expect(items[ids.pt1].attachment.lineId).toBe(ids.line);
            expect(Math.abs(items[ids.pt1].attachment.distanceM - projected)).toBeLessThan(0.2);
            const dragged = items[ids.pt1].attachment.distanceM;
            await expect(map).toHaveAttribute('data-instrument-drag', '');
            // The map did not pan with the drag.
            const after = await pixelNow(map, AT_1143);
            expect(Math.abs(after[0] - from[0]) + Math.abs(after[1] - from[1])).toBeLessThan(2);

            // Its distance typed (the non-drag way, WCAG 2.5.7): 1143, Enter.
            const distance = panel.locator('.mapstudio-field-distance');
            await expect(distance).toHaveValue(String(dragged));
            seqBefore = await seqOf(map);
            await distance.fill('99999');
            await distance.press('Enter');
            await expect(panel.locator('.mapstudio-field-distance-problem')).toHaveText('Type a distance from 0 to 2,922 m');
            await page.waitForTimeout(NOTHING_MS);
            await expect(map).toHaveAttribute('data-store-seq', String(seqBefore));
            await distance.fill('1143');
            await distance.press('Enter');
            await expectOneBatch(page, map, seqBefore, 'move PT-1');
            items = await storedAll(page);
            expect(items[ids.pt1].attachment).toEqual({ lineId: ids.line, distanceM: 1143 });
            expect(metres(items[ids.pt1].geometry.coordinates, AT_1143)).toBeLessThan(1);
            await expect(panel.locator('.mapstudio-field-on-line')).toHaveText('On L-SWD at 1.1 km');

            // Each change is one Undo step: back to the dragged place, then to 1,143 m where the seed has it.
            await undoOnce(page, map, (now) => now[ids.pt1].attachment.distanceM === dragged);
            await undoOnce(page, map, (now) => now[ids.pt1].attachment.distanceM === 1143);
        });

    editorTest('a tap added on L-SWD stays on it reshaped, is deleted with it, and one Undo restores the line and all its instruments',
        async ({ page }) => {
            const map = await openEditor(page);
            await selectRow(page, ids.line);
            await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
            let seqBefore = await seqOf(map);
            const bar = await arm(page, map, 'tap');
            await bar.locator('.mapstudio-instrument-distance').fill('1500');
            await bar.locator('.mapstudio-instrument-distance').press('Enter');
            await expectOneBatch(page, map, seqBefore, 'add Tap');
            const tap = await page.locator('.mapstudio-panel').getAttribute('data-item-id');
            const four = [ids.pt1, ids.lv1, ids.pt2, tap];

            // L-SWD reshaped (its bend dragged): every instrument, the new tap with them, at its nearest place on the new shape.
            await selectRow(page, ids.line);
            await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
            await expect(map).toHaveAttribute('data-handles', ids.line);
            seqBefore = await seqOf(map);
            const bend = await pixelNow(map, BEND);
            await page.mouse.move(bend[0], bend[1]);
            await page.mouse.move(bend[0] + 1, bend[1] + 1);
            await page.mouse.down();
            await page.mouse.move(bend[0] + 20, bend[1] - 10, { steps: 4 });
            await page.mouse.move(bend[0] + 40, bend[1] - 30, { steps: 8 });
            await page.mouse.up();
            await expectOneBatch(page, map, seqBefore, 'reshape L-SWD');
            let items = await storedAll(page);
            expect(four.every((id) => items[id].attachment && items[id].attachment.lineId === ids.line)).toBe(true);
            const before = Object.fromEntries(four.concat([ids.line]).map((id) => [id, items[id]]));

            // Deleted with the Delete key: the line and its four instruments in one batch; one Undo restores them all.
            seqBefore = await seqOf(map);
            await page.locator('.maplibregl-canvas').focus();
            await page.keyboard.press('Delete');
            await expectOneBatch(page, map, seqBefore, 'delete L-SWD');
            items = await storedAll(page);
            expect(four.concat([ids.line]).filter((id) => items[id])).toEqual([]);
            const same = (a, b) => JSON.stringify(a.geometry) === JSON.stringify(b.geometry) && JSON.stringify(a.attachment) === JSON.stringify(b.attachment);
            await undoOnce(page, map, (now) => four.concat([ids.line]).every((id) => now[id] && same(now[id], before[id])));
            // Then the reshape and the add, one step each.
            await undoOnce(page, map, (now) => JSON.stringify(now[ids.line].geometry.coordinates) === JSON.stringify([CTB1, BEND, SWD1]));
            await undoOnce(page, map, (now) => !now[tap]);
        });

    editorTest('no tap, meter or valve among the toolbar\'s kind buttons or the Point tool\'s kinds', async ({ page }) => {
        const map = await openEditor(page);
        const buttons = page.locator('.mapstudio-toolbar .mapstudio-tool--kind');
        expect(await buttons.evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')))).toEqual(['pad', 'line', 'geofence']);
        // The Point tool adds the first point kind that is not an instrument, and its Kind select offers no instrument kind.
        await page.locator('.mapstudio-tool--point').click();
        await expect(map).toHaveAttribute('data-tool', 'point');
        await expect(page.locator('.mapstudio-drawing-bar .mapstudio-drawing-title')).toHaveText('New well pad');
        await page.locator('.mapstudio-tool--select').click();
        await expect(map).toHaveAttribute('data-tool', '');
        await selectRow(page, ids.ctb1);
        await expect(page.locator('.mapstudio-panel .mapstudio-field-kind option')).toHaveText(['Well pad']);
    });
});
