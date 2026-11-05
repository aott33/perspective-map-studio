// Drawing lines and areas (epic 4 entry 4): at 1366 px as the map editor, a gathering line by its kind button with
// Snap on from CTB1 to SWD1 (its ends stored, drawn snapped) and the toolbar's Undo; the same with Snap off (ends null,
// drawn floating); a geofence by three clicks and a double-click (a LineString of three vertices drawn as a closed
// fill); a one-vertex line that cannot finish, Backspace removing the last vertex and Esc cancelling to Select; a
// self-intersecting ring flagged until Backspace fixes it; the generic Line tool with the Kind select in Details;
// every step by keyboard and clicks with no drag; and at 390 px no toolbar. Entry 23 (owner, 2026-11-05): the bar is the
// one place that talks (no mode pill, no "Snap on" or "Snap off" words, the snap target only while one is in reach), Snap
// is its glyph saying on or off on hover, no toast follows an add (Details opening and the header's Saved confirm it) and
// Undo is the toolbar's. Screenshots at 1366 px for the docs (AD-15).

import { randomUUID } from 'node:crypto';
import { TRACER, pagePixel } from '../lib/geo.mjs';
import {
    EDITOR_USER, VERTEX_PAUSE_MS, editorTest, ensureSeeded, expect, mapLoaded, openMap, removeStrays, send, shot, signedInContext, test, view
} from './fixtures.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** The Gateway's answer to a save. */
const REPLY_MS = 20_000;

// The L-SWD set's pads (ops/project seed, epic 3 entry 2): CTB1 and SWD1, 2.9 km apart, both in view at zoom 13.
const CTB1 = [-105.012, 39.7262];
const SWD1 = [-104.983671, 39.715476];
const SWD_VIEW = { center: [(CTB1[0] + SWD1[0]) / 2, (CTB1[1] + SWD1[1]) / 2], zoom: 13 };
// The tracer's view, where the ground north of Point 2 is clear of every seeded item at zoom 12.
const TRACER_VIEW = { center: TRACER.center, zoom: TRACER.zoom };

let seed;
test.beforeAll(async ({ browser }) => {
    seed = await ensureSeeded(browser);
    // Items left by other specs would sit where this spec's clear spots are.
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
        await removeStrays(page, seed.ids);
    } finally {
        await context.close();
    }
});

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

/** A page pixel `dx` from the map's centre and `fromTop` below its top edge now (under the toolbar on the top row, clear of the controls). */
async function spot(map, dx, fromTop) {
    const box = await map.boundingBox();
    return [box.x + box.width / 2 + dx, box.y + fromTop];
}

/** The stored record of a map item through the test hook, or undefined. */
async function stored(page, id) {
    return (await send(page, 'map.load', {})).body.items.find((i) => i.id === id);
}

/** Delete a map item this spec added (through the test hook, as removeStrays does), so the next spec finds the seed alone. */
async function remove(page, id) {
    const record = await stored(page, id);
    if (!record) return;
    const reply = await send(page, 'edits.apply', { batchId: randomUUID(), ops: [{ op: 'delete', entity: 'item', id, baseVersion: record.version }] });
    expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
}

test.describe('1366 px', () => {
    test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });

    editorTest('a gathering line by its kind button with Snap on: the ends snap to CTB1 and SWD1, one batch saves it, Details opens on Name, no toast, the toolbar's Undo undoes it',
        async ({ page }) => {
            const map = await openEditor(page);
            const before = Number(await map.getAttribute('data-items-loaded'));
            const seqBefore = await map.getAttribute('data-store-seq');
            await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);

            // The kind button of the dev list's line kind (the second of the list's first three kinds): tinted and named on the
            // toolbar, and the bar names the kind (entry 23: no pill).
            const bar = page.locator('.mapstudio-drawing-bar');
            await expect(bar).toHaveCount(0);
            const button = page.locator('.mapstudio-tool--kind[data-kind="line"]');
            await expect(button).toHaveAttribute('data-tool', 'line');
            await button.click();
            await expect(map).toHaveAttribute('data-tool', 'line');
            await expect(map).toHaveAttribute('data-tool-kind', 'line');
            await expect(button).toHaveAttribute('aria-pressed', 'true');
            await expect(button).toHaveAttribute('title', 'Gathering line');
            await expect(page.locator('.mapstudio-pill')).toHaveCount(0);
            await expect(bar).toHaveAttribute('data-points', '0');
            await expect(bar.locator('.mapstudio-drawing-title')).toHaveText('New gathering line');
            await expect(bar.locator('.mapstudio-drawing-finish')).toBeDisabled();

            // Snap, off by default, turned on for this line (UJ-1 step 5). It is the magnet glyph alone, saying on or off on hover
            // (entry 23); the bar says nothing of it until a target is within reach.
            const snap = page.locator('.mapstudio-tool--snap');
            await expect(snap).toHaveAttribute('data-snap', 'off');
            await expect(snap).toHaveAttribute('aria-pressed', 'false');
            await expect(snap).toHaveAttribute('title', 'Snap off');
            await expect(snap).toHaveText('');
            await expect(bar.locator('.mapstudio-drawing-snap')).toHaveCount(0);
            await snap.click();
            await expect(snap).toHaveAttribute('data-snap', 'on');
            await expect(snap).toHaveAttribute('aria-pressed', 'true');
            await expect(snap).toHaveAttribute('title', /^Snap on/);
            await expect(map).toHaveAttribute('data-snap', 'on');
            await expect(bar).toHaveAttribute('data-snap', 'on');
            await expect(bar.locator('.mapstudio-drawing-snap')).toHaveCount(0);

            // The pointer a few pixels off CTB1: the indicator names it; the click lands the vertex on it.
            let [x, y] = await pixelNow(map, CTB1);
            await page.mouse.move(x + 8, y + 6);
            await expect(bar).toHaveAttribute('data-snap-target', 'CTB1');
            await expect(bar.locator('.mapstudio-drawing-snap')).toHaveText('Snap to CTB1 - click to connect');
            await page.mouse.click(x + 8, y + 6);
            await expect(bar).toHaveAttribute('data-points', '1');
            await expect(bar).toHaveAttribute('data-snap-start', 'CTB1');
            await expect(bar.locator('.mapstudio-drawing-progress')).toHaveText('1 point - 0 km - start snapped to CTB1');
            await expect(bar).toHaveAttribute('data-valid', 'false');
            await expect(bar).toHaveAttribute('data-reason', 'A line needs two points');
            await page.waitForTimeout(VERTEX_PAUSE_MS);
            // Away from every item nothing is within reach, and the indicator goes.
            const clear = await spot(map, 0, 175);
            await page.mouse.move(clear[0], clear[1]);
            await expect(bar).toHaveAttribute('data-snap-target', '');
            await expect(bar.locator('.mapstudio-drawing-snap')).toHaveCount(0);
            [x, y] = await pixelNow(map, SWD1);
            await page.mouse.move(x - 7, y + 5);
            await expect(bar).toHaveAttribute('data-snap-target', 'SWD1');
            await page.mouse.click(x - 7, y + 5);
            await expect(bar).toHaveAttribute('data-points', '2');
            await expect(bar).toHaveAttribute('data-snap-end', 'SWD1');
            await expect(bar).toHaveAttribute('data-valid', 'true');
            await expect(bar.locator('.mapstudio-drawing-progress')).toHaveText('2 points - 2.7 km - start snapped to CTB1 - end snapped to SWD1');
            await expect(bar.locator('.mapstudio-drawing-hint')).toHaveText('Double-click or Enter to finish');
            await shot(page, 'mapstudio-drawing-bar-1366.png');
            await page.waitForTimeout(VERTEX_PAUSE_MS);
            await page.keyboard.press('Enter');

            // Finished: saved at once as one batch, selected, Details open with the cursor in Name and the kind's name as the
            // placeholder; the tool stays in hand with no vertex. No toast (entry 23): Details opening and the header's Saved
            // confirm it, and the toolbar's Undo names the step.
            await expect(bar).toHaveAttribute('data-points', '0');
            await expect(map).toHaveAttribute('data-tool', 'line');
            const panel = page.locator('.mapstudio-panel');
            await expect(panel).toBeVisible({ timeout: 15_000 });
            const lineId = await panel.getAttribute('data-item-id');
            expect(lineId).toMatch(UUID);
            const name = page.locator('.mapstudio-field-name');
            await expect(name).toBeFocused();
            await expect(name).toHaveValue('Gathering line');
            await expect(page.locator('.mapstudio-field-kind')).toHaveValue('line');
            await expect(page.locator('.mapstudio-panel-save')).toHaveAttribute('data-save-state', 'saved', { timeout: 30_000 });
            await expect(map).toHaveAttribute('data-items-loaded', String(before + 1), { timeout: 15_000 });
            await expect(page.locator('.mapstudio-panel-save')).toHaveText('Saved');
            await expect(page.locator('.mapstudio-toast')).toHaveCount(0);
            await expect(page.locator('.mapstudio-pill')).toHaveCount(0);
            await expect(page.locator('.mapstudio-reply')).toBeHidden();
            const undo = page.locator('.mapstudio-toolbar .mapstudio-undo');
            await expect(undo).toHaveAttribute('aria-label', 'Undo: add Gathering line');
            await expect(undo).toHaveAttribute('title', 'Undo: add Gathering line');
            await expect(undo).toBeEnabled();
            // One batch, one seq: the record carries the kind, the placeholder name, both ends and the pads' own places.
            expect(Number(await map.getAttribute('data-store-seq'))).toBe(Number(seqBefore) + 1);
            const saved = await stored(page, lineId);
            expect(saved).toMatchObject({
                kind: 'line', name: 'Gathering line', version: 1,
                ends: { start: { itemId: seed.ids['swd/ctb1'] }, end: { itemId: seed.ids['swd/swd1'] } }
            });
            expect(saved.geometry.coordinates).toEqual([CTB1, SWD1]);
            // Drawn snapped: the selected line has no floating end to mark.
            await expect(map).toHaveAttribute('data-selected', lineId);
            await expect(map).toHaveAttribute('data-floating-ends', '0');
            await shot(page, 'mapstudio-drawing-snapped-1366.png');

            // Undo from the toolbar: the add is reversed and the line goes, with its selection.
            await undo.click();
            await expect(map).toHaveAttribute('data-items-loaded', String(before), { timeout: REPLY_MS });
            await expect(panel).toHaveCount(0);
            expect(await stored(page, lineId)).toBeUndefined();
        });

    editorTest('the same line with Snap off: the vertices stay where the pointer was, ends is null and both ends draw floating',
        async ({ page }) => {
            const map = await openEditor(page);
            const before = Number(await map.getAttribute('data-items-loaded'));
            await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
            await page.locator('.mapstudio-tool--kind[data-kind="line"]').click();
            await expect(map).toHaveAttribute('data-tool', 'line');
            await expect(map).toHaveAttribute('data-snap', 'off');
            const bar = page.locator('.mapstudio-drawing-bar');
            let [x, y] = await pixelNow(map, CTB1);
            await page.mouse.move(x + 12, y + 10);
            await expect(bar).toHaveAttribute('data-snap-target', '');
            await page.mouse.click(x + 12, y + 10);
            await expect(bar).toHaveAttribute('data-points', '1');
            await expect(bar).toHaveAttribute('data-snap-start', '');
            await expect(bar.locator('.mapstudio-drawing-progress')).toHaveText('1 point - 0 km - start floating');
            await page.waitForTimeout(VERTEX_PAUSE_MS);
            [x, y] = await pixelNow(map, SWD1);
            await page.mouse.click(x - 12, y + 8);
            await expect(bar).toHaveAttribute('data-points', '2');
            await expect(bar.locator('.mapstudio-drawing-progress')).toHaveText(/^2 points - 2\.[5-8] km - start floating - end floating$/);
            await page.waitForTimeout(VERTEX_PAUSE_MS);
            // The bar's Finish finishes it as Enter does.
            await bar.locator('.mapstudio-drawing-finish').click();
            await expect(bar).toHaveAttribute('data-points', '0');
            const panel = page.locator('.mapstudio-panel');
            await expect(panel).toBeVisible({ timeout: 15_000 });
            const lineId = await panel.getAttribute('data-item-id');
            await expect(page.locator('.mapstudio-panel-save')).toHaveAttribute('data-save-state', 'saved', { timeout: 30_000 });
            await expect(map).toHaveAttribute('data-items-loaded', String(before + 1), { timeout: 15_000 });
            const saved = await stored(page, lineId);
            expect(saved).toMatchObject({ kind: 'line', ends: null });
            // Near the pads, not on them (12 px is about 90 m at zoom 13).
            expect(Math.abs(saved.geometry.coordinates[0][0] - CTB1[0])).toBeGreaterThan(0.0003);
            expect(Math.abs(saved.geometry.coordinates[1][0] - SWD1[0])).toBeGreaterThan(0.0003);
            await expect(map).toHaveAttribute('data-selected', lineId);
            await expect(map).toHaveAttribute('data-floating-ends', '2');
            await shot(page, 'mapstudio-drawing-floating-1366.png');
            await remove(page, lineId);
        });

    editorTest('a geofence by its kind button: three clicks and a double-click close it, saved as a LineString of three vertices drawn as a closed fill',
        async ({ page }) => {
            const map = await openEditor(page);
            const before = Number(await map.getAttribute('data-items-loaded'));
            await view(page, map, TRACER_VIEW.center, TRACER_VIEW.zoom);
            const fence = page.locator('.mapstudio-tool--kind[data-kind="geofence"]');
            await expect(fence).toHaveAttribute('data-tool', 'area');
            await fence.click();
            await expect(map).toHaveAttribute('data-tool', 'area');
            await expect(map).toHaveAttribute('data-tool-kind', 'geofence');
            await expect(fence).toHaveAttribute('aria-pressed', 'true');
            await expect(page.locator('.mapstudio-pill')).toHaveCount(0);
            const bar = page.locator('.mapstudio-drawing-bar');
            await expect(bar.locator('.mapstudio-drawing-title')).toHaveText('New geofence');
            await expect(bar.locator('.mapstudio-drawing-progress')).toHaveText('Click the map to add the first point');
            // A triangle on the clear ground north of the tracer's points (under the toolbar).
            const a = await spot(map, -150, 235);
            const b = await spot(map, 0, 155);
            const c = await spot(map, 150, 235);
            await page.mouse.click(a[0], a[1]);
            await expect(bar).toHaveAttribute('data-points', '1');
            await expect(bar).toHaveAttribute('data-reason', 'An area needs three points');
            await page.waitForTimeout(VERTEX_PAUSE_MS);
            await page.mouse.click(b[0], b[1]);
            await expect(bar).toHaveAttribute('data-points', '2');
            await expect(bar).toHaveAttribute('data-valid', 'false');
            await page.waitForTimeout(VERTEX_PAUSE_MS);
            // The double-click: its first click places the third vertex, its second closes the ring.
            await page.mouse.dblclick(c[0], c[1]);
            await expect(bar).toHaveAttribute('data-points', '0');
            const panel = page.locator('.mapstudio-panel');
            await expect(panel).toBeVisible({ timeout: 15_000 });
            const fenceId = await panel.getAttribute('data-item-id');
            await expect(page.locator('.mapstudio-field-name')).toHaveValue('Geofence');
            await expect(page.locator('.mapstudio-field-kind')).toHaveValue('geofence');
            await expect(page.locator('.mapstudio-panel-save')).toHaveAttribute('data-save-state', 'saved', { timeout: 30_000 });
            await expect(map).toHaveAttribute('data-items-loaded', String(before + 1), { timeout: 15_000 });
            const saved = await stored(page, fenceId);
            expect(saved).toMatchObject({ kind: 'geofence', name: 'Geofence', ends: null });
            expect(saved.geometry.type).toBe('LineString');
            expect(saved.geometry.coordinates).toHaveLength(3);
            // Drawn as a closed fill (features.ts closes the ring).
            await expect.poll(async () => JSON.parse(await map.getAttribute('data-areas')).some((area) => area.id === fenceId), { timeout: 15_000 }).toBe(true);
            // No toast (entry 23): the toolbar's Undo names the add.
            await expect(page.locator('.mapstudio-toast')).toHaveCount(0);
            await expect(page.locator('.mapstudio-toolbar .mapstudio-undo')).toHaveAttribute('data-step', 'Undo: add Geofence');
            await shot(page, 'mapstudio-drawing-geofence-1366.png');
            await remove(page, fenceId);
        });

    editorTest('one vertex cannot finish by Enter, Finish or a double-click; Backspace removes the last vertex; Esc cancels to Select; nothing is sent',
        async ({ page }) => {
            const map = await openEditor(page);
            const before = Number(await map.getAttribute('data-items-loaded'));
            const seqBefore = await map.getAttribute('data-store-seq');
            await view(page, map, TRACER_VIEW.center, TRACER_VIEW.zoom);
            await page.locator('.mapstudio-tool--line').click();
            await expect(map).toHaveAttribute('data-tool', 'line');
            await expect(map).toHaveAttribute('data-tool-kind', '');
            const bar = page.locator('.mapstudio-drawing-bar');
            const a = await spot(map, -100, 215);
            const b = await spot(map, 100, 215);
            await page.mouse.click(a[0], a[1]);
            await expect(bar).toHaveAttribute('data-points', '1');
            await expect(bar).toHaveAttribute('data-valid', 'false');
            await expect(bar.locator('.mapstudio-drawing-hint')).toHaveText('A line needs two points');
            const finish = bar.locator('.mapstudio-drawing-finish');
            await expect(finish).toBeDisabled();
            await page.waitForTimeout(VERTEX_PAUSE_MS);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(VERTEX_PAUSE_MS);
            await expect(bar).toHaveAttribute('data-points', '1');
            // A double-click on the one vertex adds nothing there and closes nothing.
            await page.mouse.dblclick(a[0], a[1]);
            await page.waitForTimeout(VERTEX_PAUSE_MS);
            await expect(bar).toHaveAttribute('data-points', '1');
            await expect(bar.locator('.mapstudio-drawing-hint')).toHaveText('A line needs two points');
            // A key typed in a field stays the field's: Backspace in the Items list's Search items field (entry 21: in
            // Edit mode the search is the list's, the View-mode top bar is hidden) removes the letter, not the vertex.
            const search = page.locator('.mapstudio-list-search-input');
            await search.click();
            await page.keyboard.type('x');
            await expect(search).toHaveValue('x');
            await page.keyboard.press('Backspace');
            await expect(search).toHaveValue('');
            await expect(bar).toHaveAttribute('data-points', '1');
            await expect(map).toHaveAttribute('data-tool', 'line');
            await page.locator('.maplibregl-canvas').focus();
            // Backspace removes the last vertex: the count follows down to none, the tool still in hand.
            await page.keyboard.press('Backspace');
            await expect(bar).toHaveAttribute('data-points', '0');
            await expect(map).toHaveAttribute('data-tool', 'line');
            await page.mouse.click(a[0], a[1]);
            await expect(bar).toHaveAttribute('data-points', '1');
            await page.waitForTimeout(VERTEX_PAUSE_MS);
            await page.mouse.click(b[0], b[1]);
            await expect(bar).toHaveAttribute('data-points', '2');
            await expect(bar).toHaveAttribute('data-valid', 'true');
            await page.keyboard.press('Backspace');
            await expect(bar).toHaveAttribute('data-points', '1');
            await expect(bar).toHaveAttribute('data-valid', 'false');
            // Esc cancels the drawing: Select is tinted again, the bar goes and nothing talks (no pill), nothing was sent.
            await page.keyboard.press('Escape');
            await expect(bar).toHaveCount(0);
            await expect(map).toHaveAttribute('data-tool', '');
            await expect(page.locator('.mapstudio-pill')).toHaveCount(0);
            await expect(page.locator('.mapstudio-tool--select')).toHaveAttribute('aria-pressed', 'true');
            await page.waitForTimeout(1_000);
            await expect(map).toHaveAttribute('data-items-loaded', String(before));
            await expect(map).toHaveAttribute('data-store-seq', seqBefore);
            await expect(map).toHaveAttribute('data-unsaved-count', '0');
            await expect(page.locator('.mapstudio-panel')).toHaveCount(0);
        });

    editorTest('a self-intersecting ring is said in words before Finish, Finish and Enter do nothing until Backspace fixes it, then it closes',
        async ({ page }) => {
            const map = await openEditor(page);
            const before = Number(await map.getAttribute('data-items-loaded'));
            await view(page, map, TRACER_VIEW.center, TRACER_VIEW.zoom);
            await page.locator('.mapstudio-tool--area').click();
            await expect(map).toHaveAttribute('data-tool', 'area');
            await expect(page.locator('.mapstudio-pill')).toHaveCount(0);
            const bar = page.locator('.mapstudio-drawing-bar');
            // The generic Area tool saves the first area kind, which the bar names.
            await expect(bar.locator('.mapstudio-drawing-title')).toHaveText('New geofence');
            // A bow tie: the edge a to b crosses the edge c to d.
            const a = await spot(map, -120, 155);
            const b = await spot(map, 120, 235);
            const c = await spot(map, 120, 155);
            const d = await spot(map, -120, 235);
            for (const [i, p] of [a, b, c].entries()) {
                await page.mouse.click(p[0], p[1]);
                await expect(bar).toHaveAttribute('data-points', String(i + 1));
                await page.waitForTimeout(VERTEX_PAUSE_MS);
            }
            await expect(bar).toHaveAttribute('data-valid', 'true');
            await page.mouse.click(d[0], d[1]);
            await expect(bar).toHaveAttribute('data-points', '4');
            await expect(bar).toHaveAttribute('data-valid', 'false');
            await expect(bar).toHaveAttribute('data-reason', 'The edges cross - Backspace removes the last point');
            await expect(bar.locator('.mapstudio-drawing-hint')).toHaveText('The edges cross - Backspace removes the last point');
            const finish = bar.locator('.mapstudio-drawing-finish');
            await expect(finish).toBeDisabled();
            await page.waitForTimeout(VERTEX_PAUSE_MS);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(VERTEX_PAUSE_MS);
            await expect(bar).toHaveAttribute('data-points', '4');
            await expect(map).toHaveAttribute('data-items-loaded', String(before));
            await shot(page, 'mapstudio-drawing-crossing-1366.png');
            // Backspace removes the crossing vertex: valid again, and Enter closes the triangle.
            await page.keyboard.press('Backspace');
            await expect(bar).toHaveAttribute('data-points', '3');
            await expect(bar).toHaveAttribute('data-valid', 'true');
            await expect(finish).toBeEnabled();
            await page.keyboard.press('Enter');
            await expect(bar).toHaveAttribute('data-points', '0');
            const panel = page.locator('.mapstudio-panel');
            await expect(panel).toBeVisible({ timeout: 15_000 });
            const fenceId = await panel.getAttribute('data-item-id');
            await expect(page.locator('.mapstudio-panel-save')).toHaveAttribute('data-save-state', 'saved', { timeout: 30_000 });
            const saved = await stored(page, fenceId);
            expect(saved.kind).toBe('geofence');
            expect(saved.geometry.coordinates).toHaveLength(3);
            await remove(page, fenceId);
        });

    editorTest('the generic Line tool saves the first line kind and the Kind select in Details changes it', async ({ page }) => {
        const map = await openEditor(page);
        await view(page, map, TRACER_VIEW.center, TRACER_VIEW.zoom);
        await page.locator('.mapstudio-tool--line').click();
        await expect(map).toHaveAttribute('data-tool', 'line');
        await expect(page.locator('.mapstudio-tool--line')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('.mapstudio-tool--kind[data-kind="line"]')).toHaveAttribute('aria-pressed', 'false');
        await expect(page.locator('.mapstudio-pill')).toHaveCount(0);
        const bar = page.locator('.mapstudio-drawing-bar');
        // The generic Line tool saves the first line kind, which the bar names.
        await expect(bar.locator('.mapstudio-drawing-title')).toHaveText('New gathering line');
        for (const [i, [dx, fromTop]] of [[-140, 235], [0, 155], [140, 235]].entries()) {
            const p = await spot(map, dx, fromTop);
            await page.mouse.click(p[0], p[1]);
            await expect(bar).toHaveAttribute('data-points', String(i + 1));
            await page.waitForTimeout(VERTEX_PAUSE_MS);
        }
        await page.keyboard.press('Enter');
        const panel = page.locator('.mapstudio-panel');
        await expect(panel).toBeVisible({ timeout: 15_000 });
        const lineId = await panel.getAttribute('data-item-id');
        await expect(page.locator('.mapstudio-panel-save')).toHaveAttribute('data-save-state', 'saved', { timeout: 30_000 });
        expect(await stored(page, lineId)).toMatchObject({ kind: 'line', name: 'Gathering line' });
        // The Kind select offers every line kind (areas included); a change saves one kind update, undone as one step.
        const kind = page.locator('.mapstudio-field-kind');
        await expect(kind).toHaveValue('line');
        await expect(kind.locator('option')).toHaveText(['Gathering line', 'Geofence']);
        await kind.selectOption('geofence');
        await expect(page.locator('.mapstudio-undo')).toHaveAttribute('data-step', 'Undo: edit Gathering line', { timeout: REPLY_MS });
        await expect(page.locator('.mapstudio-panel-save')).toHaveAttribute('data-save-state', 'saved', { timeout: 30_000 });
        expect(await stored(page, lineId)).toMatchObject({ kind: 'geofence', version: 2 });
        await expect(page.locator('.mapstudio-panel-subline')).toContainText('Geofence');
        await expect.poll(async () => JSON.parse(await map.getAttribute('data-areas')).some((area) => area.id === lineId), { timeout: 15_000 }).toBe(true);
        await remove(page, lineId);
    });
});

test.describe('390 px', () => {
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

    editorTest('no tool and no toolbar below 768 px', async ({ page }) => {
        const map = await openMap(page, '/edit');
        await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
        await mapLoaded(map);
        await expect(map).toHaveAttribute('data-edit-level', 'full');
        await expect(map).toHaveAttribute('data-studio', 'off');
        await expect(map).toHaveAttribute('data-tool', '');
        await expect(page.locator('.mapstudio-toolbar')).toHaveCount(0);
        await expect(page.locator('.mapstudio-drawing-bar')).toHaveCount(0);
        await expect(page.locator('.mapstudio-toast')).toHaveCount(0);
        await expect(page.locator('.mapstudio-pill')).toHaveCount(0);
    });
});
