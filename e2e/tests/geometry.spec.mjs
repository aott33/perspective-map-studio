// Changing geometry (epic 4 entry 5; EXPERIENCE.md Change geometry, the owner's four mocks of 2026-11-06): at 1366 px as the map
// editor, on the seed's L-SWD (CTB1 to SWD1, three points, PT-1, LV-1 and PT-2 on it): a selected line shows a handle at each
// point and a dashed one at each midpoint; a point dragged, a midpoint dragged in, a point chosen with the bar's Move, Split here
// and Delete point, Move then a click, a pad dragged and moved from Details with the snapped end following, a line's end dragged
// with Snap off (it floats) and on (it lands on SWD1 and names it), an area's chosen point; each change one batch (one seq) and
// one Undo step, Undo putting it back; a reshape refused (another save of L-SWD landed first) said on the save status row, the
// handles back on the stored shape. Every non-drag way by clicks and keys. At 390 px, for a phone editor at 1366 px and for a
// viewer no handles, no bar and no Move. Renders of the four mocked states for the docs under E2E_DOCS=1 (AD-15). The spec leaves the seed as it found it
// (each change undone, then the seed run again and the strays removed), since later specs read L-SWD.

import { pagePixel } from '../lib/geo.mjs';
import { randomUUID } from 'node:crypto';
import {
    EDITOR_USER, OPERATOR_USER, editorTest, ensureSeeded, expect, mapLoaded, openMap, removeStrays, runSeed, send, shot as shotNow, signedInContext,
    test, view
} from './fixtures.mjs';

/** The Gateway's answer to a save. */
const REPLY_MS = 20_000;

// The L-SWD set (ops/project seed): its three points, the first on CTB1 and the last on SWD1, and its instruments.
const CTB1 = [-105.012, 39.7262];
const BEND = [-105.009441, 39.720791];
const SWD1 = [-104.983671, 39.715476];
const SWD_LINE = [CTB1, BEND, SWD1];
// The line in view with Details docked (718 px of map at 1366 px), large enough that every handle is apart from the next.
const SWD_VIEW = { center: [(CTB1[0] + SWD1[0]) / 2, (CTB1[1] + SWD1[1]) / 2 + 0.001], zoom: 13.5 };
// The North fence (four points, epic 3 entry 1) and a view of it.
const FENCE_VIEW = { center: [-104.992, 39.732], zoom: 15 };

let seed;
let ids;

test.beforeAll(async ({ browser }) => {
    seed = await ensureSeeded(browser);
    ids = { line: seed.ids['swd/line'], ctb1: seed.ids['swd/ctb1'], swd1: seed.ids['swd/swd1'], pt1: seed.ids['swd/pt1'], lv1: seed.ids['swd/lv1'],
        pt2: seed.ids['swd/pt2'], fence: seed.ids['areas/north'] };
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

/** The place under a page pixel, from the view the map reports now (Web Mercator, as MapLibre). */
async function placeAt(map, [x, y]) {
    const box = await map.boundingBox();
    const center = (await map.getAttribute('data-center')).split(',').map(Number);
    const zoom = Number(await map.getAttribute('data-zoom'));
    const scale = 512 * Math.pow(2, zoom);
    const cx = ((center[0] + 180) / 360) * scale;
    const rad = (center[1] * Math.PI) / 180;
    const cy = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale;
    const px = cx + (x - box.x - box.width / 2);
    const py = cy + (y - box.y - box.height / 2);
    const n = Math.PI - (2 * Math.PI * py) / scale;
    return [(px / scale) * 360 - 180, (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))];
}

/** A render for the docs once the markers have taken the view's zoom (their images redraw a moment after a jump). */
async function shot(page, name) {
    await page.waitForTimeout(800);
    await shotNow(page, name);
}

/** The stored map items through the test hook, by id. */
async function storedAll(page) {
    return Object.fromEntries((await send(page, 'map.load', {})).body.items.map((i) => [i.id, i]));
}

/** The map's change sequence number now. */
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

/** A drag by the pointer, in a few moves, so Terra Draw and MapLibre see a drag and not a click. */
async function drag(page, from, to) {
    await page.mouse.move(from[0], from[1]);
    await page.mouse.move(from[0] + 1, from[1] + 1);
    await page.mouse.down();
    await page.mouse.move(from[0] + (to[0] - from[0]) * 0.25, from[1] + (to[1] - from[1]) * 0.25, { steps: 4 });
    await page.mouse.move(to[0], to[1], { steps: 8 });
    await page.mouse.up();
}

/** L-SWD selected from the Items list, Details open, and the view where its handles are apart; returns the map. */
async function selectLine(page, map) {
    await page.locator('.mapstudio-list-row[data-item-id="' + ids.line + '"]').click();
    await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', ids.line);
    await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
    await expect(map).toHaveAttribute('data-handles', ids.line);
}

/** Whether every one of the line's instruments is on `lineId` within its length (the Gateway checks the place within 1 m). */
function onLine(items, lineId, names) {
    return names.every((id) => items[id].attachment && items[id].attachment.lineId === lineId);
}

const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
/** Whether a stored `ends` names these items (the store returns its keys in its own order). */
const endsAre = (ends, start, end) => (ends && ends.start ? ends.start.itemId : null) === start && (ends && ends.end ? ends.end.itemId : null) === end;
const sameLine = (coords, expected) => coords.length === expected.length && coords.every((c, i) => same(c, expected[i]));

test.describe('1366 px', () => {
    test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });

    editorTest('handles on the selected line, a point chosen with the bar, Split here off on an end, Esc putting it down; nothing sent',
        async ({ page }) => {
            const map = await openEditor(page);
            const seqBefore = await seqOf(map);
            await expect(map).toHaveAttribute('data-handles', '');
            await selectLine(page, map);
            // A handle at each of the three points and one at each of the two midpoints (drawn dashed by the map's own layer).
            await expect(map).toHaveAttribute('data-handle-points', '3');
            await expect(map).toHaveAttribute('data-handle-midpoints', '2');
            // Select stays the tool while handles show, and nothing talks until a point is chosen.
            await expect(map).toHaveAttribute('data-tool', '');
            await expect(page.locator('.mapstudio-tool--select')).toHaveAttribute('aria-pressed', 'true');
            await expect(page.locator('.mapstudio-geometry-bar')).toHaveCount(0);
            await expect(page.locator('.mapstudio-drawing-bar')).toHaveCount(0);

            // A click on the bend's handle chooses it: the bar names it and offers Move, Split here and Delete point.
            const bend = await pixelNow(map, BEND);
            await page.mouse.click(bend[0], bend[1]);
            const bar = page.locator('.mapstudio-geometry-bar');
            await expect(bar).toBeVisible();
            await expect(map).toHaveAttribute('data-chosen-point', '1');
            await expect(bar).toHaveAttribute('data-point', '1');
            await expect(bar.locator('.mapstudio-geometry-title')).toHaveText('Point 2 of 3 on L-SWD');
            await expect(bar.locator('.mapstudio-geometry-hint')).toHaveText('Drag it to move it, or use Move');
            await expect(bar.locator('.mapstudio-geometry-move')).toBeEnabled();
            await expect(bar.locator('.mapstudio-geometry-split')).toBeEnabled();
            await expect(bar.locator('.mapstudio-geometry-delete')).toBeEnabled();
            // The click chose the point: no line popup opened and the selection stayed.
            await expect(map).toHaveAttribute('data-popup-mode', '');
            await expect(map).toHaveAttribute('data-selected', ids.line);
            await shot(page, 'mapstudio-geometry-point-1366.png');

            // An end point: Split here is off and says why.
            const end = await pixelNow(map, SWD1);
            await page.mouse.click(end[0], end[1]);
            await expect(bar.locator('.mapstudio-geometry-title')).toHaveText('Point 3 of 3 on L-SWD');
            await expect(bar.locator('.mapstudio-geometry-split')).toBeDisabled();
            await expect(bar.locator('.mapstudio-geometry-split')).toHaveAttribute('title', 'A line splits at an inner point, not an end');
            await expect(bar.locator('.mapstudio-geometry-delete')).toBeEnabled();

            // Esc puts the chosen point down (the line stays selected with Details), and a second Esc closes Details.
            await page.locator('.maplibregl-canvas').focus();
            await page.keyboard.press('Escape');
            await expect(bar).toHaveCount(0);
            await expect(map).toHaveAttribute('data-chosen-point', '');
            await expect(map).toHaveAttribute('data-selected', ids.line);
            await expect(page.locator('.mapstudio-panel')).toBeVisible();
            await expect(map).toHaveAttribute('data-handle-points', '3');
            // The handles' render once the map has settled at the view's zoom (the markers' look follows the tiles' zoom).
            await shot(page, 'mapstudio-geometry-handles-1366.png');
            await page.keyboard.press('Escape');
            await expect(page.locator('.mapstudio-panel')).toHaveCount(0);
            await expect(map).toHaveAttribute('data-handles', '');
            await page.waitForTimeout(500);
            await expect(map).toHaveAttribute('data-store-seq', String(seqBefore));
        });

    editorTest('a point dragged: one batch with the new shape and the instruments re-placed, one Undo step; Move then a click by keys; Esc cancels Move',
        async ({ page }) => {
            const map = await openEditor(page);
            await selectLine(page, map);
            let seqBefore = await seqOf(map);
            const bend = await pixelNow(map, BEND);
            await drag(page, bend, [bend[0] + 40, bend[1] - 30]);
            await expectOneBatch(page, map, seqBefore, 'reshape L-SWD');
            let items = await storedAll(page);
            const dragged = items[ids.line].geometry.coordinates;
            expect(dragged).toHaveLength(3);
            expect(same(dragged[0], CTB1) && same(dragged[2], SWD1)).toBe(true);
            expect(same(dragged[1], BEND)).toBe(false);
            const target = await placeAt(map, [bend[0] + 40, bend[1] - 30]);
            expect(Math.abs(dragged[1][0] - target[0])).toBeLessThan(0.0005);
            expect(Math.abs(dragged[1][1] - target[1])).toBeLessThan(0.0005);
            // The ends did not move, so they still name the pads; the instruments are on the line at their nearest place.
            expect(items[ids.line].ends).toEqual({ start: { itemId: ids.ctb1 }, end: { itemId: ids.swd1 } });
            expect(onLine(items, ids.line, [ids.pt1, ids.lv1, ids.pt2])).toBe(true);
            // The map draws the saved shape and the handles follow it.
            await expect(map).toHaveAttribute('data-handle-points', '3');
            await undoOnce(page, map, (now) => sameLine(now[ids.line].geometry.coordinates, SWD_LINE));

            // The non-drag way: the bend chosen, Move pressed by keys, a click on the map is its new place (one batch); the point
            // stays chosen. Esc while Move waits puts Move down and sends nothing.
            await page.mouse.click(bend[0], bend[1]);
            const bar = page.locator('.mapstudio-geometry-bar');
            await expect(bar.locator('.mapstudio-geometry-title')).toHaveText('Point 2 of 3 on L-SWD');
            await bar.locator('.mapstudio-geometry-move').focus();
            await page.keyboard.press('Enter');
            await expect(map).toHaveAttribute('data-moving', 'point');
            await expect(bar.locator('.mapstudio-geometry-title')).toHaveText('Moving point 2 of L-SWD');
            await expect(bar.locator('.mapstudio-geometry-hint')).toHaveText('Click the new place on the map - Esc to cancel');
            await expect(bar.locator('.mapstudio-geometry-cancel')).toBeVisible();
            await shot(page, 'mapstudio-geometry-move-1366.png');
            seqBefore = await seqOf(map);
            await page.keyboard.press('Escape');
            await expect(map).toHaveAttribute('data-moving', '');
            await expect(bar.locator('.mapstudio-geometry-title')).toHaveText('Point 2 of 3 on L-SWD');
            await page.waitForTimeout(500);
            await expect(map).toHaveAttribute('data-store-seq', String(seqBefore));

            await bar.locator('.mapstudio-geometry-move').focus();
            await page.keyboard.press('Enter');
            await expect(map).toHaveAttribute('data-moving', 'point');
            const spot = [bend[0] - 50, bend[1] + 20];
            const place = await placeAt(map, spot);
            await page.mouse.click(spot[0], spot[1]);
            await expectOneBatch(page, map, seqBefore, 'reshape L-SWD');
            await expect(map).toHaveAttribute('data-moving', '');
            await expect(bar.locator('.mapstudio-geometry-title')).toHaveText('Point 2 of 3 on L-SWD');
            items = await storedAll(page);
            const moved = items[ids.line].geometry.coordinates;
            expect(Math.abs(moved[1][0] - place[0])).toBeLessThan(0.0001);
            expect(Math.abs(moved[1][1] - place[1])).toBeLessThan(0.0001);
            expect(onLine(items, ids.line, [ids.pt1, ids.lv1, ids.pt2])).toBe(true);
            await undoOnce(page, map, (now) => sameLine(now[ids.line].geometry.coordinates, SWD_LINE));
        });

    editorTest('a reshape refused because another save of L-SWD landed first: the save status row says so and the handles return to the stored shape',
        async ({ page }) => {
            // The page's websocket is routed so the test can hold the Gateway's map.changed frames for a moment: another save of
            // L-SWD commits while this page does not know of it yet, so the drag's batch carries the version before it.
            let holding = false;
            const held = [];
            let toPage = null;
            await page.routeWebSocket(/.*/, (ws) => {
                const server = ws.connectToServer();
                ws.onMessage((message) => server.send(message));
                server.onMessage((message) => {
                    if (holding && typeof message === 'string' && message.includes('"type": "map.changed"')) {
                        held.push(message);
                        return;
                    }
                    ws.send(message);
                });
                toPage = ws;
            });
            const map = await openEditor(page);
            await selectLine(page, map);
            const line = (await storedAll(page))[ids.line];
            const bend = await pixelNow(map, BEND);
            await page.mouse.move(bend[0], bend[1]);
            await page.mouse.move(bend[0] + 1, bend[1] + 1);
            await page.mouse.down();
            await page.mouse.move(bend[0] + 15, bend[1] - 10, { steps: 4 });
            await page.mouse.move(bend[0] + 40, bend[1] - 30, { steps: 8 });
            // Another save of L-SWD (through the test hook, as another editor's would) commits before the drag ends.
            holding = true;
            const other = await send(page, 'edits.apply', { batchId: randomUUID(), ops: [{ op: 'update', entity: 'item', id: ids.line,
                baseVersion: line.version, data: { properties: line.properties } }] });
            expect(other.type, JSON.stringify(other.body)).toBe('edits.apply.reply');
            await page.mouse.up();
            const row = page.locator('.mapstudio-panel-save--row');
            await expect(row).toHaveAttribute('data-code', 'conflict', { timeout: REPLY_MS });
            await expect(row).toContainText('L-SWD');
            await expect(map).toHaveAttribute('data-save-state', 'refused');
            // The other save reaches the page now, as it would have a moment later.
            holding = false;
            for (const message of held.splice(0)) {
                toPage.send(message);
            }
            // Nothing of the drag was written; the handles are made again from the stored shape.
            const items = await storedAll(page);
            expect(items[ids.line].version).toBe(line.version + 1);
            expect(sameLine(items[ids.line].geometry.coordinates, SWD_LINE)).toBe(true);
            await expect(map).toHaveAttribute('data-handles', ids.line);
            await expect(map).toHaveAttribute('data-handles-changed', 'false', { timeout: REPLY_MS });
            await expect(map).toHaveAttribute('data-handle-points', '3');
            // The refused edit waits under the row with Discard, as any refused edit does; discarded, nothing is left.
            await page.locator('.mapstudio-panel-problem--edits').click();
            await page.locator('.mapstudio-unsaved-discard').first().click();
            await expect(map).toHaveAttribute('data-unsaved-count', '0', { timeout: REPLY_MS });
        });

    editorTest('a midpoint dragged in, then L-SWD split there between PT-1 and PT-2: two lines, PT-1 on the first and PT-2 on the second measured from its start, the new part in Details on Name; one Undo step each',
        async ({ page }) => {
            const map = await openEditor(page);
            await selectLine(page, map);
            // The second segment's midpoint (about 1.8 km along, between PT-1 at 1.1 km and LV-1 at 2.0 km), dragged a little off the line.
            const a = await pixelNow(map, BEND);
            const b = await pixelNow(map, SWD1);
            const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            let seqBefore = await seqOf(map);
            await drag(page, mid, [mid[0], mid[1] - 12]);
            await expectOneBatch(page, map, seqBefore, 'reshape L-SWD');
            let items = await storedAll(page);
            const inserted = items[ids.line].geometry.coordinates;
            expect(inserted).toHaveLength(4);
            expect(same(inserted[0], CTB1) && same(inserted[1], BEND) && same(inserted[3], SWD1)).toBe(true);
            await expect(map).toHaveAttribute('data-handle-points', '4');
            await expect(map).toHaveAttribute('data-handle-midpoints', '3');
            expect(onLine(items, ids.line, [ids.pt1, ids.lv1, ids.pt2])).toBe(true);

            // The new point chosen: Point 3 of 4; Split here by keys.
            const at = await pixelNow(map, inserted[2]);
            await page.mouse.click(at[0], at[1]);
            const bar = page.locator('.mapstudio-geometry-bar');
            await expect(bar.locator('.mapstudio-geometry-title')).toHaveText('Point 3 of 4 on L-SWD');
            seqBefore = await seqOf(map);
            await bar.locator('.mapstudio-geometry-split').focus();
            await page.keyboard.press('Enter');
            // The new part is selected and opens in Details with the cursor in Name, named "L-SWD 2".
            const panel = page.locator('.mapstudio-panel');
            await expect(panel).not.toHaveAttribute('data-item-id', ids.line, { timeout: REPLY_MS });
            const partId = await panel.getAttribute('data-item-id');
            await expect(page.locator('.mapstudio-field-name')).toBeFocused();
            await expect(page.locator('.mapstudio-field-name')).toHaveValue('L-SWD 2');
            await expect(bar).toHaveCount(0);
            await expectOneBatch(page, map, seqBefore, 'split L-SWD');
            items = await storedAll(page);
            const line = items[ids.line];
            const part = items[partId];
            // The line keeps its name, link and start; the part takes the kind, the properties and the end, no link.
            expect(line).toMatchObject({ name: 'L-SWD', assetId: 'LSWD', ends: { start: { itemId: ids.ctb1 } } });
            expect(sameLine(line.geometry.coordinates, inserted.slice(0, 3))).toBe(true);
            expect(part).toMatchObject({ kind: line.kind, name: 'L-SWD 2', assetId: null, properties: line.properties, ends: { end: { itemId: ids.swd1 } } });
            expect(sameLine(part.geometry.coordinates, inserted.slice(2))).toBe(true);
            // PT-1 on the first part; LV-1 and PT-2 on the second, measured from its start.
            expect(items[ids.pt1].attachment.lineId).toBe(ids.line);
            expect(items[ids.pt2].attachment.lineId).toBe(partId);
            expect(items[ids.lv1].attachment.lineId).toBe(partId);
            expect(items[ids.pt2].attachment.distanceM).toBeLessThan(1200);
            expect(items[ids.pt2].attachment.distanceM).toBeGreaterThan(900);
            expect(items[ids.lv1].attachment.distanceM).toBeLessThan(items[ids.pt2].attachment.distanceM);
            await expect(map).toHaveAttribute('data-handles', partId);
            await shot(page, 'mapstudio-geometry-split-1366.png');

            // One Undo puts the split back (the part goes, the instruments return), the next the inserted point.
            await undoOnce(page, map, (now) => !now[partId] && sameLine(now[ids.line].geometry.coordinates, inserted)
                && onLine(now, ids.line, [ids.pt1, ids.lv1, ids.pt2]));
            await expect(page.locator('.mapstudio-panel')).toHaveCount(0);
            await undoOnce(page, map, (now) => sameLine(now[ids.line].geometry.coordinates, SWD_LINE));
        });

    editorTest('Delete point: an inner point, then the floor; an end point\'s ends entry goes; one Undo step each',
        async ({ page }) => {
            const map = await openEditor(page);
            await selectLine(page, map);
            const bar = page.locator('.mapstudio-geometry-bar');
            const bend = await pixelNow(map, BEND);
            await page.mouse.click(bend[0], bend[1]);
            await expect(bar.locator('.mapstudio-geometry-title')).toHaveText('Point 2 of 3 on L-SWD');
            let seqBefore = await seqOf(map);
            await bar.locator('.mapstudio-geometry-delete').click();
            await expectOneBatch(page, map, seqBefore, 'reshape L-SWD');
            await expect(bar).toHaveCount(0);
            let items = await storedAll(page);
            expect(sameLine(items[ids.line].geometry.coordinates, [CTB1, SWD1])).toBe(true);
            expect(items[ids.line].ends).toEqual({ start: { itemId: ids.ctb1 }, end: { itemId: ids.swd1 } });
            expect(onLine(items, ids.line, [ids.pt1, ids.lv1, ids.pt2])).toBe(true);
            // Two points left: Delete point is off at the floor and says why.
            await expect(map).toHaveAttribute('data-handle-points', '2');
            const start = await pixelNow(map, CTB1);
            await page.mouse.click(start[0], start[1]);
            await expect(bar.locator('.mapstudio-geometry-title')).toHaveText('Point 1 of 2 on L-SWD');
            await expect(bar.locator('.mapstudio-geometry-delete')).toBeDisabled();
            await expect(bar.locator('.mapstudio-geometry-delete')).toHaveAttribute('title', 'A line keeps at least two points');
            await page.keyboard.press('Escape');
            await undoOnce(page, map, (now) => sameLine(now[ids.line].geometry.coordinates, SWD_LINE));

            // The first point deleted: the second is the start now, and it floats.
            await expect(map).toHaveAttribute('data-handle-points', '3');
            await page.mouse.click(start[0], start[1]);
            await expect(bar.locator('.mapstudio-geometry-title')).toHaveText('Point 1 of 3 on L-SWD');
            seqBefore = await seqOf(map);
            await bar.locator('.mapstudio-geometry-delete').focus();
            await page.keyboard.press('Enter');
            await expectOneBatch(page, map, seqBefore, 'reshape L-SWD');
            items = await storedAll(page);
            expect(sameLine(items[ids.line].geometry.coordinates, [BEND, SWD1])).toBe(true);
            expect(items[ids.line].ends).toEqual({ end: { itemId: ids.swd1 } });
            await undoOnce(page, map, (now) => sameLine(now[ids.line].geometry.coordinates, SWD_LINE)
                && endsAre(now[ids.line].ends, ids.ctb1, ids.swd1));
        });

    editorTest('a line\'s end dragged: with Snap off it floats and its ends entry goes; with Snap on near SWD1 it lands on SWD1 and names it',
        async ({ page }) => {
            const map = await openEditor(page);
            await selectLine(page, map);
            await expect(map).toHaveAttribute('data-snap', 'off');
            const end = await pixelNow(map, SWD1);
            const away = [end[0] - 45, end[1] - 35];
            let seqBefore = await seqOf(map);
            await drag(page, end, away);
            await expectOneBatch(page, map, seqBefore, 'reshape L-SWD');
            let items = await storedAll(page);
            const floated = items[ids.line].geometry.coordinates[2];
            expect(same(floated, SWD1)).toBe(false);
            expect(items[ids.line].ends).toEqual({ start: { itemId: ids.ctb1 } });
            expect(onLine(items, ids.line, [ids.pt1, ids.lv1, ids.pt2])).toBe(true);

            // Snap on (the toolbar's magnet), the end dragged back to a few pixels off SWD1: it lands on the pad and names it.
            await page.locator('.mapstudio-tool--snap').click();
            await expect(map).toHaveAttribute('data-snap', 'on');
            await expect(map).toHaveAttribute('data-tool', '');
            const from = await pixelNow(map, floated);
            seqBefore = await seqOf(map);
            await drag(page, from, [end[0] + 7, end[1] - 5]);
            await expectOneBatch(page, map, seqBefore, 'reshape L-SWD');
            items = await storedAll(page);
            expect(items[ids.line].geometry.coordinates[2]).toEqual(SWD1);
            expect(items[ids.line].ends).toEqual({ start: { itemId: ids.ctb1 }, end: { itemId: ids.swd1 } });
            await undoOnce(page, map, (now) => same(now[ids.line].geometry.coordinates[2], floated));
            await undoOnce(page, map, (now) => sameLine(now[ids.line].geometry.coordinates, SWD_LINE)
                && endsAre(now[ids.line].ends, ids.ctb1, ids.swd1));
        });

    editorTest('CTB1 dragged, then moved from Details by Move and a click: L-SWD\'s snapped end moves with it in the same batch, one Undo step each',
        async ({ page }) => {
            const map = await openEditor(page);
            await page.locator('.mapstudio-list-row[data-item-id="' + ids.ctb1 + '"]').click();
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', ids.ctb1);
            await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
            // A point item's handle is its marker (no point handles); Move sits beside Location.
            await expect(map).toHaveAttribute('data-handles', ids.ctb1);
            await expect(map).toHaveAttribute('data-handle-points', '0');
            const move = page.locator('.mapstudio-field--location .mapstudio-field-move');
            await expect(move).toBeVisible();
            await expect(move).toHaveText('Move');
            await expect(move).toHaveAttribute('aria-pressed', 'false');
            await shot(page, 'mapstudio-geometry-details-move-1366.png');

            const pad = await pixelNow(map, CTB1);
            const to = [pad[0] + 40, pad[1] + 25];
            let seqBefore = await seqOf(map);
            await drag(page, pad, to);
            await expectOneBatch(page, map, seqBefore, 'move CTB1');
            let items = await storedAll(page);
            const dropped = items[ids.ctb1].geometry.coordinates;
            expect(same(dropped, CTB1)).toBe(false);
            expect(items[ids.line].geometry.coordinates[0]).toEqual(dropped);
            expect(same(items[ids.line].geometry.coordinates[1], BEND)).toBe(true);
            expect(items[ids.line].ends).toEqual({ start: { itemId: ids.ctb1 }, end: { itemId: ids.swd1 } });
            expect(onLine(items, ids.line, [ids.pt1, ids.lv1, ids.pt2])).toBe(true);
            await expect(page.locator('.mapstudio-field-lat')).toHaveValue(String(dropped[1]));
            await undoOnce(page, map, (now) => same(now[ids.ctb1].geometry.coordinates, CTB1) && same(now[ids.line].geometry.coordinates[0], CTB1));

            // Move then a click, by keys and a click: the bar names the item; Esc cancels and nothing is sent.
            await move.focus();
            await page.keyboard.press('Enter');
            await expect(map).toHaveAttribute('data-moving', 'item');
            await expect(move).toHaveAttribute('aria-pressed', 'true');
            const bar = page.locator('.mapstudio-geometry-bar');
            await expect(bar.locator('.mapstudio-geometry-title')).toHaveText('Moving CTB1');
            await expect(bar.locator('.mapstudio-geometry-hint')).toHaveText('Click the new place on the map - Esc to cancel');
            seqBefore = await seqOf(map);
            await page.keyboard.press('Escape');
            await expect(bar).toHaveCount(0);
            await expect(map).toHaveAttribute('data-moving', '');
            await expect(page.locator('.mapstudio-panel')).toBeVisible();
            await page.waitForTimeout(500);
            await expect(map).toHaveAttribute('data-store-seq', String(seqBefore));
            // Move pressed again while it waits puts it down, as Esc does.
            await move.click();
            await expect(map).toHaveAttribute('data-moving', 'item');
            await move.click();
            await expect(map).toHaveAttribute('data-moving', '');
            await expect(move).toHaveAttribute('aria-pressed', 'false');
            await expect(bar).toHaveCount(0);
            await move.click();
            await expect(map).toHaveAttribute('data-moving', 'item');
            const spot = [pad[0] - 60, pad[1] + 40];
            const place = await placeAt(map, spot);
            await page.mouse.click(spot[0], spot[1]);
            await expectOneBatch(page, map, seqBefore, 'move CTB1');
            await expect(bar).toHaveCount(0);
            items = await storedAll(page);
            const placed = items[ids.ctb1].geometry.coordinates;
            expect(Math.abs(placed[0] - place[0])).toBeLessThan(0.0001);
            expect(Math.abs(placed[1] - place[1])).toBeLessThan(0.0001);
            expect(items[ids.line].geometry.coordinates[0]).toEqual(placed);
            expect(onLine(items, ids.line, [ids.pt1, ids.lv1, ids.pt2])).toBe(true);
            await undoOnce(page, map, (now) => same(now[ids.ctb1].geometry.coordinates, CTB1) && same(now[ids.line].geometry.coordinates[0], CTB1));
        });

    editorTest('an area: handles at its four points and four midpoints, no Split, Delete point down to the floor of three',
        async ({ page }) => {
            const map = await openEditor(page);
            await page.locator('.mapstudio-list-row[data-item-id="' + ids.fence + '"]').click();
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', ids.fence);
            await view(page, map, FENCE_VIEW.center, FENCE_VIEW.zoom);
            await expect(map).toHaveAttribute('data-handles', ids.fence);
            await expect(map).toHaveAttribute('data-handle-points', '4');
            await expect(map).toHaveAttribute('data-handle-midpoints', '4');
            const fence = (await storedAll(page))[ids.fence];
            const ring = fence.geometry.coordinates;
            const corner = await pixelNow(map, ring[1]);
            await page.mouse.click(corner[0], corner[1]);
            const bar = page.locator('.mapstudio-geometry-bar');
            await expect(bar.locator('.mapstudio-geometry-title')).toHaveText('Point 2 of 4 on North fence');
            await expect(bar.locator('.mapstudio-geometry-split')).toBeDisabled();
            await expect(bar.locator('.mapstudio-geometry-split')).toHaveAttribute('title', 'An area has no split');
            const seqBefore = await seqOf(map);
            await bar.locator('.mapstudio-geometry-delete').click();
            await expectOneBatch(page, map, seqBefore, 'reshape North fence');
            const items = await storedAll(page);
            expect(sameLine(items[ids.fence].geometry.coordinates, [ring[0], ring[2], ring[3]])).toBe(true);
            expect(items[ids.fence].ends).toBeNull();
            await expect(map).toHaveAttribute('data-handle-points', '3');
            const first = await pixelNow(map, ring[0]);
            await page.mouse.click(first[0], first[1]);
            await expect(bar.locator('.mapstudio-geometry-title')).toHaveText('Point 1 of 3 on North fence');
            await expect(bar.locator('.mapstudio-geometry-delete')).toBeDisabled();
            await expect(bar.locator('.mapstudio-geometry-delete')).toHaveAttribute('title', 'An area keeps at least three points');
            await undoOnce(page, map, (now) => sameLine(now[ids.fence].geometry.coordinates, ring));
        });
});

test.describe('the phone and a viewer', () => {
    test.describe('390 px', () => {
        test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

        editorTest('the map editor at 390 px: no handles, no bar, no Move', async ({ page }) => {
            const map = await openMap(page, '/edit');
            await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
            await mapLoaded(map);
            await expect(map).toHaveAttribute('data-edit-level', 'full');
            await expect(map).toHaveAttribute('data-studio', 'off');
            await view(page, map, CTB1, 14);
            const pad = await pixelNow(map, CTB1);
            await page.mouse.click(pad[0], pad[1]);
            await expect(map).toHaveAttribute('data-selected', ids.ctb1);
            await expect(map).toHaveAttribute('data-handles', '');
            await expect(page.locator('.mapstudio-geometry-bar')).toHaveCount(0);
            await expect(page.locator('.mapstudio-field-move')).toHaveCount(0);
        });
    });

    test.describe('1366 px', () => {
        test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });

        test('a phone editor (level phone) at 1366 px: View mode, no handles, no bar, no Move', async ({ browser }) => {
            const context = await signedInContext(browser, OPERATOR_USER, { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
            try {
                const page = await context.newPage();
                const map = await openMap(page, '/edit');
                await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + OPERATOR_USER);
                await mapLoaded(map);
                await expect(map).toHaveAttribute('data-edit-level', 'phone');
                await expect(map).toHaveAttribute('data-studio', 'off');
                await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
                const pad = await pixelNow(map, CTB1);
                await page.mouse.click(pad[0], pad[1]);
                await expect(map).toHaveAttribute('data-selected', ids.ctb1);
                await expect(map).toHaveAttribute('data-handles', '');
                await expect(page.locator('.mapstudio-panel')).toHaveCount(0);
                await expect(page.locator('.mapstudio-field-move')).toHaveCount(0);
                const bend = await pixelNow(map, BEND);
                await page.mouse.click(bend[0], bend[1]);
                await expect(map).toHaveAttribute('data-chosen-point', '');
                await expect(page.locator('.mapstudio-geometry-bar')).toHaveCount(0);
            } finally {
                await context.close();
            }
        });

        test('a viewer: a line selected shows no handles; a click on its point chooses nothing', async ({ page }) => {
            const map = await openMap(page, '/edit');
            await expect(page.locator('#mapstudio-dev-user')).toContainText('Not signed in');
            await mapLoaded(map);
            await expect(map).toHaveAttribute('data-edit-level', 'none');
            await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
            const a = await pixelNow(map, BEND);
            const b = await pixelNow(map, SWD1);
            const on = [a[0] + (b[0] - a[0]) * 0.1, a[1] + (b[1] - a[1]) * 0.1];
            await page.mouse.click(on[0], on[1]);
            await expect(map).toHaveAttribute('data-selected', ids.line);
            await expect(map).toHaveAttribute('data-handles', '');
            await page.mouse.click(a[0], a[1]);
            await expect(map).toHaveAttribute('data-chosen-point', '');
            await expect(page.locator('.mapstudio-geometry-bar')).toHaveCount(0);
        });
    });
});
