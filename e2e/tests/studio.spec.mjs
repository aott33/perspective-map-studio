// The tracer through the studio (epic 4 entry 2, contract 0.4.0): at 1366 px as the map editor, the Edit
// switch opens the docked studio and writes editMode back (the /edit page's label follows it), a viewer on
// the same page stays in View mode with the prop as written, one pad is added with the Point tool, fine-tuned
// by a drag, named and linked (each a batch that a viewer's open map gets within seconds), undone step by
// step and redone, and the page's selectedItem label and onItemSelected script follow every selection.
// Edit mode's top row (entry 21, the owner's option B; DESIGN.md Edit mode, Direction A, key screen 4): at 1366
// and 1440 px with the properties panel docked, no search field or Needs you bar over the map, the toolbar on
// the top row level with the Editing switch and clear of it and the zoom card, the pill and then the connection
// chip under it; leaving Edit mode brings the View-mode top bar back with its lists closed, and a list open on
// entry closes; the Items list's Search items field filters the rows, Esc and Clear bring them back with the
// selection kept, and a filtered row picked is a row click; at 1200 px, below the list's collapse width, the toolbar
// stays on the row under the Editing switch; at 390 px the editor keeps View mode's top bar.
// The legend in the rail's Layers surface (entry 22, the owner's render C of the legend review): in Edit mode no Legend
// button over the map and the scale bar bottom-left alone; Layers holds the panel's own content in the dock under two tabs,
// Layers (Show, Basemap) open first and Legend (the key), the tab kept while Edit mode stays, and a map click leaves it; Lines turned off there hides the lines, stays off after a reload and shows off
// in View mode's panel; a basemap picked there switches the map, is remembered and says its tile status there as the panel
// does; a panel open as Edit mode comes on closes, and leaving Edit mode brings the Legend button back; at 390 px the
// Legend sheet is as before.
// Edit mode talks in one place (entry 23, the owner's option 2 of the messages review, the toast dropped, and the undo
// history): no mode pill, no toast and no status box in Edit mode; Undo and Redo on the toolbar's end naming their step
// on hover, the chevron beside Undo opening the last ten steps newest first with how long ago, the second newest chosen
// undoing two, one batch each, and Redo redoing one; Ctrl+Z and Ctrl+Shift+Z one step each way; a refusal stopping the
// run with the reason on the save status row; the Point tool's bar naming the kind; the toolbar with its new group still
// clear of the Editing switch at 1366 and 1440 px with Details docked, the history list inside the map and clear of it.
// Screenshots at 1366 and 1440 px for the docs (AD-15).

import { TRACER, pagePixel } from '../lib/geo.mjs';
import { randomUUID } from 'node:crypto';
import {
    DRAW_MS, EDITOR_USER, VERTEX_PAUSE_MS, WARNING_SETTLE_MS, editorTest, ensureSeeded, expect, loadedCounts, mapLoaded, openMap, removeStrays, send,
    shot, signedInContext, test, view, watch
} from './fixtures.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** The story's bound: a saved edit is on another open map within 5 s (changes.spec.mjs). */
const PUSH_MS = 5_000;
/** The dev setup refreshes every 10 s; the next full batch after a link, with margin. */
const INTERVAL_MS = 40_000;
/** The Gateway's answer to a save, or the page's binding following a prop write. */
const REPLY_MS = 20_000;

/** The width the stage has at 1366 px with the rail, the list and the properties panel docked (DESIGN.md spacing). */
const STAGE_WITH_PANEL = 1366 - 72 - 256 - 320;

let seed;
test.beforeAll(async ({ browser }) => {
    seed = await ensureSeeded(browser);
    // Items left by other specs (or an earlier run of this one) would sit where the tracer's clear spots are.
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
        await removeStrays(page, seed.ids);
    } finally {
        await context.close();
    }
});

/** The map's page pixel of a place, from the box and the view the map reports now (the stage resizes as panels open). */
async function pixelNow(map, lngLat) {
    const box = await map.boundingBox();
    const center = (await map.getAttribute('data-center')).split(',').map(Number);
    const zoom = Number(await map.getAttribute('data-zoom'));
    return pagePixel(box, lngLat, center, zoom);
}

/**
 * A page pixel on the ground: at least 44 px from every seeded point and 24 px from every line segment at the
 * map's view now, and off an open popup card, searched on a grid inside the map box away from its controls.
 */
async function groundSpot(page, map) {
    const box = await map.boundingBox();
    const center = (await map.getAttribute('data-center')).split(',').map(Number);
    const zoom = Number(await map.getAttribute('data-zoom'));
    const items = (await send(page, 'map.load', {})).body.items.filter((i) => !i.deleted);
    const px = (lngLat) => pagePixel(box, lngLat, center, zoom);
    const points = items.filter((i) => i.geometry.type === 'Point').map((i) => px(i.geometry.coordinates));
    const segments = [];
    for (const line of items.filter((i) => i.geometry.type === 'LineString')) {
        const coords = line.geometry.coordinates.map(px);
        for (let i = 1; i < coords.length; i++) segments.push([coords[i - 1], coords[i]]);
    }
    // Read without waiting: with no card open there is no element (a locator's boundingBox would wait for one).
    const card = await page.evaluate(() => {
        const el = document.querySelector('.maplibregl-popup-content');
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: b.x, y: b.y, width: b.width, height: b.height };
    });
    const toSegment = ([x, y], [[ax, ay], [bx, by]]) => {
        const dx = bx - ax;
        const dy = by - ay;
        const len2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
        return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    };
    for (let y = box.y + 120; y < box.y + box.height - 100; y += 40) {
        for (let x = box.x + 80; x < box.x + box.width - 80; x += 40) {
            if (points.some(([px0, py0]) => Math.hypot(px0 - x, py0 - y) < 44)) continue;
            if (segments.some((seg) => toSegment([x, y], seg) < 24)) continue;
            if (card && x >= card.x - 8 && x <= card.x + card.width + 8 && y >= card.y - 8 && y <= card.y + card.height + 8) continue;
            return [x, y];
        }
    }
    throw new Error('No ground spot clear of the seeded items in this view.');
}

/** Wait until the stage has the width the docked panels leave it (the map resizes after a panel opens or closes). */
async function expectStageWidth(map, width) {
    await expect.poll(async () => Math.round((await map.boundingBox()).width), { timeout: 10_000 }).toBe(width);
}

async function openEditor(page) {
    const map = await openMap(page, '/edit');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', 'full');
    return map;
}

/** The page's window on the selection: the label bound to selectedItem and the onItemSelected script's label. */
async function expectPageSelection(page, id, name, kind) {
    const selected = page.locator('#mapstudio-dev-selected');
    const event = page.locator('#mapstudio-dev-event');
    if (id === null) {
        await expect(selected).toHaveText(/^selectedItem:\s*$/, { timeout: REPLY_MS });
        await expect(event).toHaveText('none', { timeout: REPLY_MS });
    } else {
        await expect(selected).toHaveText('selectedItem: ' + id, { timeout: REPLY_MS });
        await expect(event).toHaveText(id + '|' + name + '|' + kind, { timeout: REPLY_MS });
    }
}

test.describe('1366 px', () => {
    test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });

    editorTest('the Edit switch opens the docked studio and writes editMode back; View mode returns', async ({ page }) => {
        const map = await openEditor(page);
        // /edit opens in Edit mode (the prop): the rail, the list and the map show; the switch reads Editing.
        await expect(map).toHaveAttribute('data-mode', 'edit');
        await expect(map).toHaveAttribute('data-studio', 'on');
        await expect(map).toHaveAttribute('data-editing', 'on');
        await expect(page.locator('.mapstudio-rail')).toBeVisible();
        await expect(page.locator('.mapstudio-dock--items')).toBeVisible();
        await expect(page.locator('.mapstudio-toolbar')).toBeVisible();
        // Select in hand and nothing talks (entry 23): the Select tool tinted and named, no mode pill, no drawing bar, and the
        // status line quiet (no click echo, no success; it stays in the DOM for the suite).
        await expect(page.locator('.mapstudio-tool--select')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('.mapstudio-tool--select')).toHaveAttribute('title', 'Select');
        await expect(page.locator('.mapstudio-pill')).toHaveCount(0);
        await expect(page.locator('.mapstudio-drawing-bar')).toHaveCount(0);
        await expect(page.locator('.mapstudio-reply')).toBeAttached();
        await expect(page.locator('.mapstudio-reply')).toBeHidden();
        const sw = page.locator('.mapstudio-edit-switch-button');
        await expect(sw).toHaveAttribute('aria-checked', 'true');
        await expect(sw).toContainText('Editing');
        await expect(page.locator('#mapstudio-dev-editmode')).toHaveText('editMode: true', { timeout: REPLY_MS });
        // The third SDK check (docs/platform-checks.md, "Epic 4 entry 2"): what of the client store a component reaches.
        const location = await map.getAttribute('data-client-location');
        console.log('client location from the component: ' + location);
        expect(location).toMatch(/^(reachable|absent|no client)/);
        // The layout (DESIGN.md Layout & Spacing at 1366): the rail 72 px, the list 256 px, the map the rest of the component.
        const root = await page.locator('.mapstudio').boundingBox();
        expect(Math.abs(root.width - 1366)).toBeLessThanOrEqual(1);
        expect(Math.round((await page.locator('.mapstudio-rail').boundingBox()).width)).toBe(72);
        expect(Math.round((await page.locator('.mapstudio-dock--items').boundingBox()).width)).toBe(256);
        const box = await map.boundingBox();
        expect(Math.round(box.width)).toBe(1366 - 72 - 256);
        // The switch sits above the zoom card, top-right; nothing in the bottom-right corner.
        const swBox = await sw.boundingBox();
        const zoom = await page.locator('.mapstudio-zoom').boundingBox();
        expect(swBox.y + swBox.height).toBeLessThanOrEqual(zoom.y + 1);
        expect(swBox.x + swBox.width).toBeGreaterThan(box.x + box.width - 100);
        // The list has the seeded items with their badges; the empty surfaces open from the rail.
        const rows = page.locator('.mapstudio-list-row');
        expect(await rows.count()).toBeGreaterThanOrEqual(33);
        await expect(page.locator('.mapstudio-list-row[data-item-id="' + seed.ids[TRACER.points.p1.key] + '"]')).toContainText('Point 1');
        await page.locator('.mapstudio-rail-item[data-surface="kinds"]').click();
        await expect(page.locator('.mapstudio-dock--empty')).toHaveAttribute('data-surface', 'kinds');
        await expect(map).toHaveAttribute('data-surface', 'kinds');
        await page.locator('.mapstudio-rail-item[data-surface="items"]').click();
        await expect(page.locator('.mapstudio-dock--items')).toBeVisible();
        await shot(page, 'mapstudio-studio-1366.png');

        // Off: View mode, the studio gone, the prop written back so the page's label follows; the tools go with the studio.
        await sw.click();
        await expect(map).toHaveAttribute('data-mode', 'view');
        await expect(page.locator('.mapstudio-rail')).toHaveCount(0);
        await expect(page.locator('.mapstudio-dock')).toHaveCount(0);
        await expect(page.locator('.mapstudio-toolbar')).toHaveCount(0);
        await expect(sw).toHaveAttribute('aria-checked', 'false');
        await expect(sw).toContainText('Edit map');
        await expect(page.locator('#mapstudio-dev-editmode')).toHaveText('editMode: false', { timeout: REPLY_MS });
        await expect(page.locator('.mapstudio-tool--line')).toHaveCount(0);
        const full = await map.boundingBox();
        expect(Math.abs(full.width - 1366)).toBeLessThanOrEqual(1);
        await shot(page, 'mapstudio-studio-view-1366.png');

        // On again from the switch, then off from the rail's View: the prop follows each time, and the prop coming back
        // (the component's own write) re-enters nothing (the mode is read once per change).
        await sw.click();
        await expect(map).toHaveAttribute('data-mode', 'edit');
        await expect(page.locator('#mapstudio-dev-editmode')).toHaveText('editMode: true', { timeout: REPLY_MS });
        await expect(page.locator('.mapstudio-tool--line')).toBeVisible();
        await page.locator('.mapstudio-rail-item[data-surface="view"]').click();
        await expect(map).toHaveAttribute('data-mode', 'view');
        await expect(page.locator('#mapstudio-dev-editmode')).toHaveText('editMode: false', { timeout: REPLY_MS });
        await page.waitForTimeout(1_000);
        await expect(map).toHaveAttribute('data-mode', 'view');
    });

    test('a viewer with editMode true: View mode, no switch, no studio, the prop left as written; the page still sees the selection',
        async ({ page }) => {
            const map = await openMap(page, '/edit');
            await expect(page.locator('#mapstudio-dev-user')).toContainText('Not signed in');
            await mapLoaded(map);
            await expect(map).toHaveAttribute('data-edit-level', 'none');
            await expect(map).toHaveAttribute('data-mode', 'view');
            await expect(map).toHaveAttribute('data-studio', 'off');
            await expect(page.locator('.mapstudio-edit-switch')).toHaveCount(0);
            await expect(page.locator('.mapstudio-rail')).toHaveCount(0);
            await expect(page.locator('.mapstudio-dock')).toHaveCount(0);
            await expect(page.locator('.mapstudio-toolbar')).toHaveCount(0);
            await expect(page.locator('#mapstudio-dev-editmode')).toHaveText('editMode: true');
            await loadedCounts(map);
            const box = await map.boundingBox();
            expect(Math.abs(box.width - 1366)).toBeLessThanOrEqual(1);
            // The selection reaches the page at every level: a marker click, then the ground.
            const p1 = seed.ids[TRACER.points.p1.key];
            const [x, y] = pagePixel(box, TRACER.points.p1.lngLat, TRACER.center, TRACER.zoom);
            await page.mouse.click(x, y);
            await expect(map).toHaveAttribute('data-selected', p1);
            await expectPageSelection(page, p1, 'Point 1', 'pad');
            const ground = await groundSpot(page, map);
            await page.mouse.click(ground[0], ground[1]);
            await expect(map).toHaveAttribute('data-selected', '');
            await expectPageSelection(page, null);
        });

    editorTest('one pad placed, fine-tuned, named and linked, seen by a viewer, undone last first and redone', async ({ page, browser }) => {
        test.setTimeout(300_000);
        const map = await openEditor(page);
        await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
        const before = Number(await map.getAttribute('data-items-loaded'));
        // A viewer in a second browser: every saved batch reaches its open map through map.changed.
        const viewerContext = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1,
            storageState: { cookies: [], origins: [] } });
        const viewer = await viewerContext.newPage();
        const viewerWatch = watch(viewer);
        try {
            const viewerMap = await openMap(viewer, '/');
            const viewerBefore = await mapLoaded(viewerMap);

            // The Point tool: tinted and named on the toolbar, and the bar bottom-centre names the kind (entry 23: the bar, not a
            // pill); one click on the ground places a pad and saves it at once.
            await page.locator('.mapstudio-tool--point').click();
            await expect(map).toHaveAttribute('data-tool', 'point');
            await expect(page.locator('.mapstudio-tool--point')).toHaveAttribute('aria-pressed', 'true');
            await expect(page.locator('.mapstudio-pill')).toHaveCount(0);
            const pointBar = page.locator('.mapstudio-drawing-bar');
            await expect(pointBar).toHaveAttribute('data-tool', 'point');
            await expect(pointBar.locator('.mapstudio-drawing-title')).toHaveText('New well pad');
            await expect(pointBar.locator('.mapstudio-drawing-hint')).toHaveText('Click the map, then drag to fine-tune');
            await expect(pointBar.locator('.mapstudio-drawing-done')).toBeVisible();
            const box = await map.boundingBox();
            // A spot clear of the seeded items at this view (the tracer's first draw offset is), under the toolbar.
            const at = [box.x + box.width / 2 + TRACER.drawOffsets[0][0], box.y + box.height / 2 + TRACER.drawOffsets[0][1]];
            await page.mouse.click(at[0], at[1]);
            const panel = page.locator('.mapstudio-panel');
            await expect(panel).toBeVisible({ timeout: 15_000 });
            const padId = await panel.getAttribute('data-item-id');
            expect(padId).toMatch(UUID);
            // Details opens with the cursor in Name, the kind's name as the placeholder.
            const name = page.locator('.mapstudio-field-name');
            await expect(name).toBeFocused();
            await expect(name).toHaveValue('Well pad');
            // The Kind row is a select of the point kinds (entry 4), the pad kind chosen.
            await expect(page.locator('.mapstudio-field-kind')).toHaveValue('pad');
            await expect(page.locator('.mapstudio-field-kind option:checked')).toHaveText('Well pad');
            const status = page.locator('.mapstudio-panel-save');
            await expect(status).toHaveAttribute('data-save-state', 'saved', { timeout: 30_000 });
            await expect(status).toHaveText('Saved');
            await expect(panel).toHaveAttribute('data-pending', 'false');
            await expect(map).toHaveAttribute('data-items-loaded', String(before + 1), { timeout: 15_000 });
            // Undo and Redo are the toolbar's (entry 23): the list header keeps the map's name and the save status. No toast
            // follows the add, and the status line shows no success.
            const undo = page.locator('.mapstudio-toolbar .mapstudio-undo');
            const redo = page.locator('.mapstudio-toolbar .mapstudio-redo');
            await expect(page.locator('.mapstudio-dock-header .mapstudio-undo, .mapstudio-dock-header .mapstudio-redo')).toHaveCount(0);
            await expect(undo).toHaveAttribute('data-step', 'Undo: add Well pad');
            await expect(undo).toHaveAttribute('title', 'Undo: add Well pad');
            await expect(redo).toBeDisabled();
            await expect(redo).toHaveAttribute('title', 'Nothing to redo');
            await expect(page.locator('.mapstudio-toast')).toHaveCount(0);
            await expect(page.locator('.mapstudio-save-status')).toHaveAttribute('data-save-state', 'saved');
            await expect(page.locator('.mapstudio-save-status')).toBeHidden();
            await expect(page.locator('.mapstudio-reply')).toBeHidden();
            await expect(page.locator('.mapstudio-list-row[data-item-id="' + padId + '"]')).toHaveAttribute('data-state', 'unlinked');
            await expectPageSelection(page, padId, 'Well pad', 'pad');
            await expect(viewerMap).toHaveAttribute('data-items-loaded', String(viewerBefore + 1), { timeout: PUSH_MS });
            // The tool stays in hand; the map's own click does not open a popup or clear the selection meanwhile.
            await expect(map).toHaveAttribute('data-tool', 'point');
            await expect(map).toHaveAttribute('data-popup-mode', '');

            // Fine-tune: the pin dragged 40 px to the right saves one update of the geometry. The Details panel docked
            // beside the map when the pad was placed, so the stage shrank and the pin's page pixel is read anew.
            await expectStageWidth(map, STAGE_WITH_PANEL);
            const created = (await send(page, 'map.load', {})).body.items.find((i) => i.id === padId);
            expect(created).toMatchObject({ kind: 'pad', name: 'Well pad', assetId: null, version: 1 });
            const pin = await pixelNow(map, created.geometry.coordinates);
            await page.mouse.move(pin[0], pin[1]);
            await page.mouse.down();
            await page.mouse.move(pin[0] + 15, pin[1] + 2, { steps: 4 });
            await page.mouse.move(pin[0] + 40, pin[1] + 4, { steps: 6 });
            await page.mouse.up();
            await expect(undo).toHaveAttribute('data-step', 'Undo: move Well pad', { timeout: REPLY_MS });
            await expect(status).toHaveAttribute('data-save-state', 'saved', { timeout: 30_000 });
            const placed = (await send(page, 'map.load', {})).body.items.find((i) => i.id === padId);
            expect(placed.version).toBe(2);
            const movedLng = placed.geometry.coordinates[0];
            expect(movedLng).toBeGreaterThan(created.geometry.coordinates[0]);

            // The name, finished with Enter; then the asset, picked from the kind's assets.
            await name.fill('P31');
            await name.press('Enter');
            await expect(undo).toHaveAttribute('data-step', 'Undo: rename P31', { timeout: REPLY_MS });
            await expect(page.locator('.mapstudio-panel-name')).toHaveText('P31');
            await expect(page.locator('.mapstudio-list-row[data-item-id="' + padId + '"]')).toContainText('P31');
            await page.locator('.mapstudio-field-asset').selectOption('P14');
            await expect(undo).toHaveAttribute('data-step', 'Undo: link P31', { timeout: REPLY_MS });
            await expect(page.locator('.mapstudio-panel-subline')).toContainText('linked to Pad 14');
            await expect(page.locator('.mapstudio-list-row[data-item-id="' + padId + '"]')).not.toHaveAttribute('data-state', 'unlinked');
            const stored = (await send(page, 'map.load', {})).body.items.find((i) => i.id === padId);
            expect(stored).toMatchObject({ kind: 'pad', name: 'P31', assetId: 'P14', version: 4 });
            expect(stored.geometry.coordinates[0]).toBe(movedLng);
            // The icon shows the kind setup's live values after the next batch (the plan is rebuilt on the link).
            await expect(page.locator('.mapstudio-live-item[data-item-id="' + padId + '"]')).toHaveAttribute('data-comms', /^(ok|lost|stale)$/,
                { timeout: INTERVAL_MS });
            await shot(page, 'mapstudio-studio-pad-1366.png');

            // Undo, last first: the link, the name, the move, the pad; each a reverse batch saved, the button naming each step.
            await page.locator('.mapstudio-tool--select').click();
            await expect(map).toHaveAttribute('data-tool', '');
            // The tool put down: the bar goes and nothing talks.
            await expect(page.locator('.mapstudio-drawing-bar')).toHaveCount(0);
            await expect(page.locator('.mapstudio-pill')).toHaveCount(0);
            const steps = ['Undo: link P31', 'Undo: rename P31', 'Undo: move Well pad', 'Undo: add Well pad'];
            for (let i = 0; i < steps.length; i++) {
                await expect(undo).toHaveAttribute('data-step', steps[i], { timeout: REPLY_MS });
                await undo.click();
                await expect(undo).toHaveAttribute('data-step', i + 1 < steps.length ? steps[i + 1] : '', { timeout: REPLY_MS });
            }
            await expect(redo).toHaveAttribute('data-step', 'Redo: add Well pad');
            await expect(status).toHaveAttribute('data-save-state', 'saved');
            await expect(map).toHaveAttribute('data-items-loaded', String(before), { timeout: 15_000 });
            await expect(viewerMap).toHaveAttribute('data-items-loaded', String(viewerBefore), { timeout: PUSH_MS });
            // The pad's selection went with it: no panel, the page told.
            await expect(panel).toHaveCount(0);
            await expectPageSelection(page, null);
            const gone = (await send(page, 'map.load', {})).body.items.find((i) => i.id === padId);
            expect(gone).toBeUndefined();

            // Redo replays in order: the pad comes back (a restore), then its move, name and link.
            for (const step of ['Redo: add Well pad', 'Redo: move Well pad', 'Redo: rename P31', 'Redo: link P31']) {
                await expect(redo).toHaveAttribute('data-step', step, { timeout: REPLY_MS });
                await redo.click();
                await expect(redo).not.toHaveAttribute('data-step', step, { timeout: REPLY_MS });
            }
            await expect(redo).toHaveAttribute('data-step', '');
            await expect(undo).toHaveAttribute('data-step', 'Undo: link P31');
            await expect(map).toHaveAttribute('data-items-loaded', String(before + 1), { timeout: 15_000 });
            const back = (await send(page, 'map.load', {})).body.items.find((i) => i.id === padId);
            expect(back).toMatchObject({ kind: 'pad', name: 'P31', assetId: 'P14', deleted: false });
            expect(back.geometry.coordinates[0]).toBe(movedLng);
            expect(viewerWatch.errors).toEqual([]);
            // The pad leaves the map for the specs after this one (through the test hook, as removeStrays does).
            const removed = await send(page, 'edits.apply', { batchId: randomUUID(),
                ops: [{ op: 'delete', entity: 'item', id: padId, baseVersion: back.version }] });
            expect(removed.type, JSON.stringify(removed.body)).toBe('edits.apply.reply');
        } finally {
            await viewerContext.close();
        }
    });

    editorTest('the page follows the selection: a list row, a marker click, a tap on the ground; Esc puts the Point tool down',
        async ({ page }) => {
            const map = await openEditor(page);
            const p1 = seed.ids[TRACER.points.p1.key];
            const p2 = seed.ids[TRACER.points.p2.key];
            // A row: selected, Details open, the map panned to it, no popup.
            await page.locator('.mapstudio-list-row[data-item-id="' + p2 + '"]').click();
            await expect(map).toHaveAttribute('data-selected', p2);
            await expect(page.locator('.mapstudio-list-row[data-item-id="' + p2 + '"]')).toHaveAttribute('aria-current', 'true');
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', p2);
            await expect(page.locator('.mapstudio-panel-name')).toHaveText('Point 2');
            await expect(map).toHaveAttribute('data-popup-mode', '');
            await expectPageSelection(page, p2, 'Point 2', 'pad');
            expect(Math.round((await page.locator('.mapstudio-panel').boundingBox()).width)).toBe(320);
            await shot(page, 'mapstudio-studio-details-1366.png');
            // A marker click (the popup opens as in View mode): p1 at the map's centre at zoom 15, where it is a full disc
            // (at zoom 12 it is a dot the Tracer line's name chip can displace, so a click there can land on the line).
            await expectStageWidth(map, STAGE_WITH_PANEL);
            await view(page, map, TRACER.points.p1.lngLat, 15);
            const [x, y] = await pixelNow(map, TRACER.points.p1.lngLat);
            await page.mouse.click(x, y);
            await expect(map).toHaveAttribute('data-selected', p1);
            // The click round trip echoes nowhere in Edit mode (entry 23): only the map's `data-last-reply` holds it.
            await expect(map).toHaveAttribute('data-last-reply', new RegExp('Gateway received click on ' + p1), { timeout: REPLY_MS });
            await expect(page.locator('.mapstudio-reply')).not.toContainText('Gateway received click');
            await expect(page.locator('.mapstudio-reply')).toBeHidden();
            // A marker click selects and opens the popup as in View mode; Details stays the list's and the Point tool's
            // (opening properties from the map and keeping the selection in view is entry 7's), so the panel for Point 2 goes.
            await expect(page.locator('.mapstudio-panel')).toHaveCount(0);
            await expect(map).toHaveAttribute('data-popup-mode', 'card');
            await expect(page.locator('.maplibregl-popup .mapstudio-popup--default')).toHaveAttribute('data-point-id', p1, { timeout: 30_000 });
            await expectPageSelection(page, p1, 'Point 1', 'pad');
            // The card sits inside the map, which grew back to the list's width when the panel went.
            await expectStageWidth(map, 1366 - 72 - 256);
            const cardBox = await page.locator('.maplibregl-popup-content').boundingBox();
            const mapBox = await map.boundingBox();
            expect(cardBox.x).toBeGreaterThanOrEqual(mapBox.x - 1);
            expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(mapBox.x + mapBox.width + 1);
            // The ground (clear of every item and the open card): the selection, the popup and the page's labels clear.
            const ground = await groundSpot(page, map);
            await page.mouse.click(ground[0], ground[1]);
            await expect(map).toHaveAttribute('data-selected', '');
            await expect(map).toHaveAttribute('data-popup-mode', '');
            await expectPageSelection(page, null);
            // The Point tool in hand, Esc on the map puts it down; the Select tool does too.
            await page.locator('.mapstudio-tool--point').click();
            await expect(map).toHaveAttribute('data-tool', 'point');
            await page.locator('.maplibregl-canvas').focus();
            await page.keyboard.press('Escape');
            await expect(map).toHaveAttribute('data-tool', '');
            await expect(page.locator('.mapstudio-drawing-bar')).toHaveCount(0);
            await expect(page.locator('.mapstudio-pill')).toHaveCount(0);
            await expect(page.locator('.mapstudio-tool--select')).toHaveAttribute('aria-pressed', 'true');
            // The Point tool's Done puts it down as Esc does.
            await page.locator('.mapstudio-tool--point').click();
            await expect(map).toHaveAttribute('data-tool', 'point');
            await page.locator('.mapstudio-drawing-done').click();
            await expect(map).toHaveAttribute('data-tool', '');
            await expect(page.locator('.mapstudio-drawing-bar')).toHaveCount(0);
        });
});

// ---- Undo and its history on the toolbar (entry 23) ----

/** A page pixel `dx` from the map's centre and `fromTop` below its top edge now: at the tracer's view, the clear ground north of its points. */
async function spotFromTop(map, dx, fromTop) {
    const box = await map.boundingBox();
    return [box.x + box.width / 2 + dx, box.y + fromTop];
}

/** The stored record of a live map item through the test hook, or undefined once it is deleted. */
async function storedItem(page, id) {
    return (await send(page, 'map.load', {})).body.items.find((i) => i.id === id && !i.deleted);
}

/** A pad placed with the Point tool at `at` and saved: its id (Details opens on it with Name focused). */
async function placePad(page, map, at) {
    if ((await map.getAttribute('data-tool')) !== 'point') {
        await page.locator('.mapstudio-tool--point').click();
        await expect(map).toHaveAttribute('data-tool', 'point');
    }
    const panel = page.locator('.mapstudio-panel');
    const before = (await panel.count()) > 0 ? await panel.getAttribute('data-item-id') : null;
    await page.mouse.click(at[0], at[1]);
    await expect(panel).toBeVisible({ timeout: 15_000 });
    if (before !== null) {
        await expect(panel).not.toHaveAttribute('data-item-id', before, { timeout: 15_000 });
    }
    const id = await panel.getAttribute('data-item-id');
    expect(id).toMatch(UUID);
    await expect(panel).toHaveAttribute('data-pending', 'false', { timeout: REPLY_MS });
    return id;
}

/** The focused Name field renamed and finished with Enter; the step is saved once Undo names it. */
async function rename(page, name) {
    const field = page.locator('.mapstudio-field-name');
    await expect(field).toBeFocused();
    await field.fill(name);
    await field.press('Enter');
    await expect(page.locator('.mapstudio-toolbar .mapstudio-undo')).toHaveAttribute('data-step', 'Undo: rename ' + name, { timeout: REPLY_MS });
}

test.describe('1366 px, Undo and its history on the toolbar', () => {
    test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });

    editorTest('three saved edits: Undo names the last on hover; the history lists them newest first with how long ago; the second newest chosen undoes two, one batch each, the oldest stays; Redo redoes one; Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y one step each; the history by keyboard',
        async ({ page }) => {
            test.setTimeout(180_000);
            const map = await openEditor(page);
            await view(page, map, TRACER.center, TRACER.zoom);
            const undo = page.locator('.mapstudio-toolbar .mapstudio-undo');
            const redo = page.locator('.mapstudio-toolbar .mapstudio-redo');
            const chevron = page.locator('.mapstudio-toolbar .mapstudio-undo-history-button');
            const list = page.locator('.mapstudio-undo-history');
            const rows = list.locator('.mapstudio-undo-history-row');
            const footer = list.locator('.mapstudio-undo-history-footer');
            const panel = page.locator('.mapstudio-panel');

            // Nothing to undo yet: Undo is disabled and says so on hover, the history says so too.
            await expect(undo).toBeDisabled();
            await expect(undo).toHaveAttribute('title', 'Nothing to undo');
            await expect(chevron).toHaveAttribute('aria-haspopup', 'menu');
            await chevron.click();
            await expect(chevron).toHaveAttribute('aria-expanded', 'true');
            await expect(list.locator('.mapstudio-undo-history-empty')).toHaveText('Nothing to undo');
            await expect(rows).toHaveCount(0);
            await chevron.click();
            await expect(list).toHaveCount(0);

            // Three saved edits: a pad added with the Point tool, renamed, and a gathering line by its kind button.
            const padId = await placePad(page, map, await spotFromTop(map, -120, 220));
            await expect(undo).toHaveAttribute('data-step', 'Undo: add Well pad', { timeout: REPLY_MS });
            await rename(page, 'P41');
            await page.locator('.mapstudio-tool--kind[data-kind="line"]').click();
            await expect(map).toHaveAttribute('data-tool', 'line');
            const bar = page.locator('.mapstudio-drawing-bar');
            for (const [i, [dx, fromTop]] of [[-40, 160], [140, 160]].entries()) {
                const p = await spotFromTop(map, dx, fromTop);
                await page.mouse.click(p[0], p[1]);
                await expect(bar).toHaveAttribute('data-points', String(i + 1));
                await page.waitForTimeout(VERTEX_PAUSE_MS);
            }
            await page.keyboard.press('Enter');
            await expect(bar).toHaveAttribute('data-points', '0');
            await expect(panel).not.toHaveAttribute('data-item-id', padId, { timeout: 15_000 });
            const lineId = await panel.getAttribute('data-item-id');
            await page.locator('.mapstudio-tool--select').click();
            await expect(map).toHaveAttribute('data-tool', '');
            // No toast after the adds and nothing in the status line; the header says Saved.
            await expect(page.locator('.mapstudio-toast')).toHaveCount(0);
            await expect(page.locator('.mapstudio-reply')).toBeHidden();
            await expect(page.locator('.mapstudio-panel-save')).toHaveText('Saved', { timeout: REPLY_MS });

            // Hover Undo: the last step, to the pointer and to assistive technology.
            await undo.hover();
            await expect(undo).toHaveAttribute('title', 'Undo: add Gathering line', { timeout: REPLY_MS });
            await expect(undo).toHaveAttribute('aria-label', 'Undo: add Gathering line');
            await expect(redo).toHaveAttribute('title', 'Nothing to redo');

            // The history: the three steps newest first, each with how long ago. Opened by the pointer, the focus stays on the
            // chevron and nothing is marked until a row is hovered.
            await chevron.click();
            await expect(list).toBeVisible();
            await expect(chevron).toBeFocused();
            await expect(list).toHaveAttribute('data-marked', '0');
            await expect(footer).toHaveText('Click a step to undo back to it');
            await expect(list.locator('.mapstudio-undo-history-title')).toHaveText('Undo history');
            await expect(list.locator('.mapstudio-undo-history-label')).toHaveText(['add Gathering line', 'rename P41', 'add Well pad']);
            await expect(list.locator('.mapstudio-undo-history-ago')).toHaveText(['just now', 'just now', 'just now']);
            // Hovering the second newest marks it and every newer row; the footer counts them.
            await rows.nth(1).hover();
            await expect(list).toHaveAttribute('data-marked', '2');
            await expect(list.locator('.mapstudio-undo-history-row--marked')).toHaveCount(2);
            await expect(footer).toHaveText('Click to undo back to here: undoes 2 changes');
            await shot(page, 'mapstudio-studio-undo-history-1366.png');

            // Chosen: the line's add and the rename undone, newest first, one batch each (two seqs); the pad stays.
            const seqBefore = Number(await map.getAttribute('data-store-seq'));
            await rows.nth(1).click();
            await expect(list).toHaveCount(0);
            await expect(undo).toHaveAttribute('data-step', 'Undo: add Well pad', { timeout: REPLY_MS * 2 });
            await expect(map).toHaveAttribute('data-store-seq', String(seqBefore + 2), { timeout: REPLY_MS });
            expect(await storedItem(page, lineId)).toBeUndefined();
            expect(await storedItem(page, padId)).toMatchObject({ name: 'Well pad' });
            // Redo redoes one step: the name comes back, the line does not.
            await expect(redo).toHaveAttribute('data-step', 'Redo: rename P41');
            await redo.click();
            await expect(redo).toHaveAttribute('data-step', 'Redo: add Gathering line', { timeout: REPLY_MS });
            await expect(undo).toHaveAttribute('data-step', 'Undo: rename P41');
            expect(await storedItem(page, padId)).toMatchObject({ name: 'P41' });
            expect(await storedItem(page, lineId)).toBeUndefined();

            // The shortcuts outside a field, one step each way: Ctrl+Z, Ctrl+Shift+Z, and Ctrl+Y as Redo.
            await page.locator('.maplibregl-canvas').focus();
            await page.keyboard.press('Control+z');
            await expect(undo).toHaveAttribute('data-step', 'Undo: add Well pad', { timeout: REPLY_MS });
            await page.keyboard.press('Control+Shift+Z');
            await expect(undo).toHaveAttribute('data-step', 'Undo: rename P41', { timeout: REPLY_MS });
            await page.keyboard.press('Control+z');
            await expect(undo).toHaveAttribute('data-step', 'Undo: add Well pad', { timeout: REPLY_MS });
            await page.keyboard.press('Control+y');
            await expect(undo).toHaveAttribute('data-step', 'Undo: rename P41', { timeout: REPLY_MS });
            expect(await storedItem(page, padId)).toMatchObject({ name: 'P41' });

            // By keyboard: Down opens on the newest, Down moves, Esc closes with nothing undone and the focus on the chevron;
            // Enter opens again, End goes to the oldest and Enter undoes back to it.
            await chevron.focus();
            await page.keyboard.press('ArrowDown');
            await expect(list).toBeVisible();
            await expect(rows.first()).toBeFocused();
            await expect(list).toHaveAttribute('data-marked', '1');
            await expect(footer).toHaveText('Click to undo back to here: undoes 1 change');
            await page.keyboard.press('ArrowDown');
            await expect(rows.nth(1)).toBeFocused();
            await expect(list).toHaveAttribute('data-marked', '2');
            await page.keyboard.press('Escape');
            await expect(list).toHaveCount(0);
            await expect(chevron).toBeFocused();
            await expect(undo).toHaveAttribute('data-step', 'Undo: rename P41');
            await page.keyboard.press('Enter');
            await expect(rows.first()).toBeFocused();
            await page.keyboard.press('End');
            await expect(rows.last()).toBeFocused();
            await expect(footer).toHaveText('Click to undo back to here: undoes 2 changes');
            await page.keyboard.press('Enter');
            await expect(list).toHaveCount(0);
            // While a run's reverse is in flight Undo and Redo wait (no step named); Redo names its step once the last one saved.
            await expect(redo).toHaveAttribute('data-step', 'Redo: add Well pad', { timeout: REPLY_MS * 2 });
            await expect(undo).toHaveAttribute('data-step', '');
            await expect(undo).toBeDisabled();
            await expect(undo).toHaveAttribute('title', 'Nothing to undo');
            expect(await storedItem(page, padId)).toBeUndefined();
        });

    editorTest('a refusal stops the run: the newest undone, the next refused with who changed the item on the save status row, the oldest never sent',
        async ({ page }) => {
            test.setTimeout(180_000);
            const map = await openEditor(page);
            await view(page, map, TRACER.center, TRACER.zoom);
            const undo = page.locator('.mapstudio-toolbar .mapstudio-undo');
            const list = page.locator('.mapstudio-undo-history');
            const rows = list.locator('.mapstudio-undo-history-row');

            // Three saved edits: pad A added and renamed, then pad B added.
            const padA = await placePad(page, map, await spotFromTop(map, -120, 220));
            await rename(page, 'P42');
            const padB = await placePad(page, map, await spotFromTop(map, 140, 235));
            await expect(undo).toHaveAttribute('data-step', 'Undo: add Well pad', { timeout: REPLY_MS });
            await page.locator('.mapstudio-tool--select').click();
            await expect(map).toHaveAttribute('data-tool', '');

            // Another save moves pad A on behind this session's undo stack (through the test hook, as another editor's would).
            const storedA = await storedItem(page, padA);
            const other = await send(page, 'edits.apply', { batchId: randomUUID(),
                ops: [{ op: 'update', entity: 'item', id: padA, baseVersion: storedA.version, data: { name: 'P42 moved on' } }] });
            expect(other.type, JSON.stringify(other.body)).toBe('edits.apply.reply');
            await expect(page.locator('.mapstudio-list-row[data-item-id="' + padA + '"]')).toContainText('P42 moved on', { timeout: PUSH_MS });
            const seqBefore = Number(await map.getAttribute('data-store-seq'));

            // The oldest chosen: three undos to go. Pad B's add is undone; the rename's undo is refused and the run stops there.
            await page.locator('.mapstudio-toolbar .mapstudio-undo-history-button').click();
            await expect(rows).toHaveCount(3);
            await rows.nth(2).hover();
            await expect(list.locator('.mapstudio-undo-history-footer')).toHaveText('Click to undo back to here: undoes 3 changes');
            await rows.nth(2).click();
            const row = page.locator('.mapstudio-panel-save--row');
            await expect(row).toHaveAttribute('data-code', 'conflict', { timeout: REPLY_MS * 2 });
            await expect(row).toContainText('P42 moved on was changed by ' + EDITOR_USER);
            await expect(row).toBeVisible();
            expect(await storedItem(page, padB)).toBeUndefined();
            expect(await storedItem(page, padA)).toMatchObject({ name: 'P42 moved on', deleted: false });
            await expect(undo).toHaveAttribute('data-step', 'Undo: rename P42');
            // One batch was saved (B's undo); the refused one wrote nothing and pad A's add was never sent.
            await expect(map).toHaveAttribute('data-store-seq', String(seqBefore + 1), { timeout: REPLY_MS });
            await page.waitForTimeout(WARNING_SETTLE_MS);
            await expect(map).toHaveAttribute('data-store-seq', String(seqBefore + 1));
            expect(await storedItem(page, padA)).toBeDefined();
            // In Edit mode the status line shows the problem, never a success (entry 23: until entry 10 takes it).
            await expect(page.locator('.mapstudio-reply')).toBeVisible();
            await expect(page.locator('.mapstudio-save-status')).toHaveAttribute('data-save-state', 'refused');
            await expect(page.locator('.mapstudio-save-status')).toBeVisible();
            await shot(page, 'mapstudio-studio-undo-refused-1366.png');

            // Pad A leaves the map for the specs after this one (through the test hook, as removeStrays does).
            const latest = await storedItem(page, padA);
            const removed = await send(page, 'edits.apply', { batchId: randomUUID(),
                ops: [{ op: 'delete', entity: 'item', id: padA, baseVersion: latest.version }] });
            expect(removed.type, JSON.stringify(removed.body)).toBe('edits.apply.reply');
        });
});

// ---- Edit mode's top row (entry 21) ----

/**
 * The client logs its own failed reconnect attempts while a lost connection is simulated ("Hello API call failed ...
 * Simulated disconnect", as connection.spec.mjs filters them): those are the loss itself; any other console or page
 * error still fails the test.
 */
const SIMULATED = /Simulated disconnect/;
const lossTest = editorTest.extend({
    watched: [
        async ({ page }, use) => {
            const w = watch(page);
            await use(w);
            expect(w.errors.filter((e) => !SIMULATED.test(e)), 'browser console and page errors').toEqual([]);
        },
        { auto: true }
    ]
});
/** How long the simulated loss lasts (the client's `__client.simulateLostConnection`). */
const LOST_S = 6;
/** The floating controls' distance from the map's edge (DESIGN.md spacing map-inset). */
const INSET = 12;

/** The rows the list shows, by item id, in its order. */
async function listIds(page) {
    return page.locator('.mapstudio-list-row').evaluateAll((els) => els.map((el) => el.getAttribute('data-item-id')));
}

/** Whether two page rectangles overlap. */
function overlaps(a, b) {
    return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Wait until a map move that changes `data-center` from `before` has ended, and return the centre then. */
async function centreAfter(map, before) {
    await expect.poll(() => map.getAttribute('data-center'), { timeout: 10_000 }).not.toBe(before);
    return map.getAttribute('data-center');
}

for (const [width, height, listWidth, panelWidth] of [[1366, 768, 256, 320], [1440, 900, 280, 340]]) {
    test.describe(width + ' px, the top row', () => {
        test.use({ viewport: { width, height }, deviceScaleFactor: 1 });

        lossTest('no search field or Needs you bar over the map; the toolbar on the top row level with the Editing switch and clear of it and the zoom card with properties docked, Undo, its history and Redo at its end, the history list inside the map and clear of them; no pill; the connection chip under the toolbar',
            async ({ page }) => {
                const map = await openEditor(page);
                await expect(map).toHaveAttribute('data-studio', 'on');
                // The View-mode top bar is hidden in Edit mode: the search is the Items list's, Needs you stays View mode's.
                await expect(page.locator('.mapstudio-topbar')).toBeHidden();
                await expect(page.locator('.mapstudio-search-field')).toBeHidden();
                await expect(page.locator('.mapstudio-needs')).toBeHidden();
                await expect(page.locator('.mapstudio-list-search-input')).toBeVisible();
                // The Legend button leaves the map in Edit mode (entry 22, the owner's render C): the legend is the rail's
                // Layers there, and the scale bar stays bottom-left.
                await expect(page.locator('.mapstudio-legend-button')).toBeHidden();
                await expect(page.locator('.mapstudio-legend-row .maplibregl-ctrl-scale')).toBeVisible();

                // The properties panel docked: a row's Details, the map the rest of the component.
                const p2 = seed.ids[TRACER.points.p2.key];
                await page.locator('.mapstudio-list-row[data-item-id="' + p2 + '"]').click();
                await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', p2);
                await expectStageWidth(map, width - 72 - listWidth - panelWidth);
                expect(Math.round((await page.locator('.mapstudio-dock--items').boundingBox()).width)).toBe(listWidth);
                expect(Math.round((await page.locator('.mapstudio-panel').boundingBox()).width)).toBe(panelWidth);

                const box = await map.boundingBox();
                const toolbar = await page.locator('.mapstudio-toolbar').boundingBox();
                const sw = await page.locator('.mapstudio-edit-switch').boundingBox();
                const zoom = await page.locator('.mapstudio-zoom').boundingBox();
                console.log(width + ' px: map ' + Math.round(box.width) + ' wide; toolbar ' + Math.round(toolbar.x - box.x) + ' to '
                    + Math.round(toolbar.x + toolbar.width - box.x) + ', switch from ' + Math.round(sw.x - box.x) + ', zoom card from '
                    + Math.round(zoom.x - box.x));
                // The top row: the toolbar at the map inset, centred over the map, level with the switch (both 36 px tall).
                expect(Math.abs(toolbar.y - (box.y + INSET)), 'the toolbar at the map inset').toBeLessThanOrEqual(1);
                expect(Math.abs(toolbar.x + toolbar.width / 2 - (box.x + box.width / 2)), 'the toolbar centred over the map').toBeLessThanOrEqual(1);
                expect(Math.abs((toolbar.y + toolbar.height / 2) - (sw.y + sw.height / 2)), 'level with the Editing switch').toBeLessThanOrEqual(2);
                // Apart from the switch and the zoom card under it: at least the map inset between them, nothing overlapping.
                expect(sw.x - (toolbar.x + toolbar.width), 'clear of the Editing switch').toBeGreaterThanOrEqual(INSET);
                expect(zoom.x - (toolbar.x + toolbar.width), 'clear of the zoom card').toBeGreaterThanOrEqual(INSET);
                expect(toolbar.x - box.x, 'clear of the map\'s left edge').toBeGreaterThanOrEqual(INSET);
                // No mode pill under the toolbar (entry 23); Undo, the history's chevron and Redo are its last group.
                await expect(page.locator('.mapstudio-pill')).toHaveCount(0);
                const undoBox = await page.locator('.mapstudio-toolbar .mapstudio-undo').boundingBox();
                const redoBox = await page.locator('.mapstudio-toolbar .mapstudio-redo').boundingBox();
                expect(redoBox.x + redoBox.width, 'Redo at the toolbar\'s end').toBeGreaterThan(toolbar.x + toolbar.width - 40);
                expect(undoBox.x, 'Undo before Redo').toBeLessThan(redoBox.x);
                await shot(page, 'mapstudio-studio-top-row-' + width + '.png');

                // The history opened under the toolbar: inside the map and clear of the Editing switch and the zoom card.
                const chevron = page.locator('.mapstudio-undo-history-button');
                await chevron.click();
                await expect(chevron).toHaveAttribute('aria-expanded', 'true');
                const list = page.locator('.mapstudio-undo-history');
                await expect(list).toBeVisible();
                await expect(list.locator('.mapstudio-undo-history-title')).toHaveText('Undo history');
                await expect(list.locator('.mapstudio-undo-history-empty')).toHaveText('Nothing to undo');
                const listBox = await list.boundingBox();
                console.log(width + ' px: the history list ' + Math.round(listBox.x - box.x) + ' to ' + Math.round(listBox.x + listBox.width - box.x));
                expect(listBox.y, 'the history under the toolbar').toBeGreaterThanOrEqual(toolbar.y + toolbar.height);
                expect(listBox.x, 'inside the map').toBeGreaterThanOrEqual(box.x + INSET - 1);
                expect(overlaps(listBox, zoom), 'the history clear of the zoom card').toBe(false);
                expect(overlaps(listBox, sw), 'the history clear of the Editing switch').toBe(false);
                expect(listBox.x + listBox.width, 'left of the zoom card').toBeLessThanOrEqual(zoom.x - INSET + 1);
                await page.keyboard.press('Escape');
                await expect(list).toHaveCount(0);
                await expect(chevron).toBeFocused();
                // Esc went no further: Details stays open.
                await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', p2);

                // The connection chip under the toolbar: the client's connection closed for a few seconds.
                const chip = page.locator('.mapstudio-connection');
                await expect(chip).toHaveCount(0);
                await page.evaluate((s) => window.__client.simulateLostConnection(s), LOST_S);
                await expect(map).toHaveAttribute('data-connection', 'lost', { timeout: 10_000 });
                await expect(chip).toBeVisible();
                await expect(map).toHaveAttribute('data-studio', 'on');
                const chipBox = await chip.boundingBox();
                const toolbarNow = await page.locator('.mapstudio-toolbar').boundingBox();
                expect(chipBox.y, 'the chip under the toolbar').toBeGreaterThanOrEqual(toolbarNow.y + toolbarNow.height);
                expect(Math.abs(chipBox.x + chipBox.width / 2 - (box.x + box.width / 2)), 'the chip centred over the map').toBeLessThanOrEqual(1);
                expect(overlaps(chipBox, await page.locator('.mapstudio-toolbar').boundingBox()), 'the chip clear of the toolbar').toBe(false);
                await shot(page, 'mapstudio-studio-top-row-chip-' + width + '.png');
                // Back: the map reloads and the chip goes.
                await expect(map).toHaveAttribute('data-connection', 'ok', { timeout: (LOST_S + 30) * 1000 });
                await expect(chip).toHaveCount(0);
            });

        editorTest('leaving Edit mode brings the search field and the Needs you bar back with their lists closed; a list open on entry closes and nothing comes back open',
            async ({ page }) => {
                const map = await openEditor(page);
                await expect(map).toHaveAttribute('data-studio', 'on');
                const sw = page.locator('.mapstudio-edit-switch-button');
                const topbar = page.locator('.mapstudio-topbar');
                const searchField = page.locator('.mapstudio-search-field');
                const needs = page.locator('.mapstudio-needs');
                const panels = page.locator('.mapstudio-topbar-panel');
                await expect(topbar).toBeHidden();

                // Off: View mode, the top bar back where View mode draws it (top-left at the map inset), both lists closed.
                await sw.click();
                await expect(map).toHaveAttribute('data-mode', 'view');
                await expect(map).toHaveAttribute('data-studio', 'off');
                await expect(searchField).toBeVisible();
                await expect(needs).toBeVisible();
                await expect(map).toHaveAttribute('data-search-open', 'false');
                await expect(map).toHaveAttribute('data-needs-open', 'false');
                await expect(panels).toHaveCount(0);
                const box = await map.boundingBox();
                const fieldBox = await searchField.boundingBox();
                expect(Math.round(fieldBox.x - box.x)).toBe(INSET);
                expect(Math.round(fieldBox.y - box.y)).toBe(INSET);

                // The Needs you list open, then the switch on: the list closes with the bar.
                await needs.click();
                await expect(page.locator('.mapstudio-needs-panel')).toBeVisible();
                await expect(map).toHaveAttribute('data-needs-open', 'true');
                await sw.click();
                await expect(map).toHaveAttribute('data-studio', 'on');
                await expect(topbar).toBeHidden();
                await expect(map).toHaveAttribute('data-needs-open', 'false');
                await expect(page.locator('.mapstudio-needs-panel')).toHaveCount(0);
                // Off again: nothing comes back open.
                await sw.click();
                await expect(map).toHaveAttribute('data-studio', 'off');
                await expect(needs).toBeVisible();
                await expect(needs).toHaveAttribute('aria-expanded', 'false');
                await expect(map).toHaveAttribute('data-needs-open', 'false');
                await expect(panels).toHaveCount(0);

                // The search's list open (its chevron: every item), then the switch on. The switch is pressed from a script so
                // the focus stays in the field, as when the page's editMode prop turns Edit mode on: the list closes all the same.
                await page.locator('.mapstudio-search-chevron').click();
                await expect(page.locator('.mapstudio-search-panel')).toBeVisible();
                await expect(map).toHaveAttribute('data-search-open', 'true');
                await page.evaluate(() => document.querySelector('.mapstudio-edit-switch-button').click());
                await expect(map).toHaveAttribute('data-studio', 'on');
                await expect(topbar).toBeHidden();
                await expect(map).toHaveAttribute('data-search-open', 'false');
                await expect(page.locator('.mapstudio-search-panel')).toHaveCount(0);
                // The hidden field gave the focus up: a key typed now opens nothing behind the hidden bar.
                await expect(page.locator('.mapstudio-search-input')).not.toBeFocused();
                await page.keyboard.type('p');
                await expect(map).toHaveAttribute('data-search-open', 'false');
                await sw.click();
                await expect(map).toHaveAttribute('data-studio', 'off');
                await expect(searchField).toBeVisible();
                await expect(map).toHaveAttribute('data-search-open', 'false');
                await expect(page.locator('.mapstudio-search-input')).toHaveAttribute('aria-expanded', 'false');
                await expect(panels).toHaveCount(0);
            });

        editorTest('Search items: "swd" keeps the rows whose name, kind or linked asset holds it, in list order, "No matches" with none; Esc and Clear bring every row back, the selection kept; a filtered row picked is a row click',
            async ({ page }) => {
                const map = await openEditor(page);
                await expect(map).toHaveAttribute('data-studio', 'on');
                const field = page.locator('.mapstudio-list-search-input');
                const clear = page.locator('.mapstudio-list-search-clear');
                const list = page.locator('.mapstudio-list');
                const panel = page.locator('.mapstudio-panel');
                // The field under the header's title row (DESIGN.md key screen 4): a search glyph, "Search items", its own name.
                await expect(field).toHaveAttribute('placeholder', 'Search items');
                await expect(field).toHaveAttribute('aria-label', 'Search items by name, kind or asset');
                await expect(page.locator('.mapstudio-list-search-glyph')).toBeVisible();
                await expect(clear).toHaveCount(0);
                await expect(page.locator('.mapstudio-list-status')).toHaveText('');
                const title = await page.locator('.mapstudio-dock-title').boundingBox();
                const fieldBox = await field.boundingBox();
                const dock = await page.locator('.mapstudio-dock--items').boundingBox();
                expect(fieldBox.y).toBeGreaterThanOrEqual(title.y + title.height);
                expect(fieldBox.x).toBeGreaterThanOrEqual(dock.x);
                expect(fieldBox.x + fieldBox.width).toBeLessThanOrEqual(dock.x + dock.width);
                const all = await listIds(page);
                expect(all.length).toBeGreaterThanOrEqual(33);
                await expect(list).toHaveAttribute('data-rows', String(all.length));

                // What "swd" keeps, from map.load: the rows whose name, kind name or linked asset name holds it, in the list's order.
                const load = (await send(page, 'map.load', {})).body;
                const kindName = Object.fromEntries(load.kinds.map((k) => [k.id, k.name]));
                const assetName = Object.fromEntries((load.assetNames || []).map((a) => [a.id, a.name]));
                const holds = (text) => typeof text === 'string' && text.toLowerCase().includes('swd');
                const byId = Object.fromEntries(load.items.filter((i) => !i.deleted).map((i) => [i.id, i]));
                const matching = new Set(Object.values(byId)
                    .filter((i) => holds(i.name) || holds(kindName[i.kind]) || (i.assetId !== null && holds(assetName[i.assetId])))
                    .map((i) => i.id));
                const swd = all.filter((id) => matching.has(id));
                const swd1 = seed.ids['swd/swd1'];
                expect(swd).toContain(swd1);
                expect(swd.length).toBeLessThan(all.length);

                // A row selected first (Details docked), so Esc and Clear can show the selection stays; then a plain row click on
                // SWD1 from the tracer's view, the reference for what a row click does.
                const p2 = seed.ids[TRACER.points.p2.key];
                await page.locator('.mapstudio-list-row[data-item-id="' + p2 + '"]').click();
                await expect(panel).toHaveAttribute('data-item-id', p2);
                await expectStageWidth(map, width - 72 - listWidth - panelWidth);
                await view(page, map, TRACER.center, TRACER.zoom);
                let before = await map.getAttribute('data-center');
                await page.locator('.mapstudio-list-row[data-item-id="' + swd1 + '"]').click();
                await expect(map).toHaveAttribute('data-selected', swd1);
                const rowClickCentre = await centreAfter(map, before);

                // Typed: only the rows holding it, in the list's order; Clear shows while there is text.
                await view(page, map, TRACER.center, TRACER.zoom);
                await page.locator('.mapstudio-list-row[data-item-id="' + p2 + '"]').click();
                await expect(panel).toHaveAttribute('data-item-id', p2);
                await field.click();
                await field.pressSequentially('swd');
                await expect(field).toHaveValue('swd');
                await expect(list).toHaveAttribute('data-rows', String(swd.length));
                expect(await listIds(page)).toEqual(swd);
                await expect(clear).toBeVisible();
                const clearBox = await clear.boundingBox();
                expect(Math.min(clearBox.width, clearBox.height), 'Clear a 32 px target').toBeGreaterThanOrEqual(32);
                expect(clearBox.y + clearBox.height).toBeLessThanOrEqual(fieldBox.y + fieldBox.height);
                await expect(page.locator('.mapstudio-list-empty')).toHaveCount(0);
                // The selected row (Point 2) is filtered out of sight; the selection and Details stay.
                await expect(map).toHaveAttribute('data-selected', p2);
                await expect(panel).toHaveAttribute('data-item-id', p2);
                await shot(page, 'mapstudio-studio-search-' + width + '.png');

                // A filtered row picked: selected, Details open on it, the map panned exactly as the plain row click panned it, no popup.
                await view(page, map, TRACER.center, TRACER.zoom);
                before = await map.getAttribute('data-center');
                const row = page.locator('.mapstudio-list-row[data-item-id="' + swd1 + '"]');
                await row.click();
                await expect(map).toHaveAttribute('data-selected', swd1);
                await expect(row).toHaveAttribute('aria-current', 'true');
                await expect(panel).toHaveAttribute('data-item-id', swd1);
                await expect(page.locator('.mapstudio-panel-name')).toHaveText(byId[swd1].name);
                await expect(map).toHaveAttribute('data-popup-mode', '');
                expect(await centreAfter(map, before)).toBe(rowClickCentre);
                await expectPageSelection(page, swd1, byId[swd1].name, byId[swd1].kind);
                // The text stays after the pick.
                await expect(field).toHaveValue('swd');

                // Esc in the field: the text empties and every row is back; the selection and Details stay (Esc goes no further).
                await field.focus();
                await page.keyboard.press('Escape');
                await expect(field).toHaveValue('');
                await expect(clear).toHaveCount(0);
                await expect(list).toHaveAttribute('data-rows', String(all.length));
                expect(await listIds(page)).toEqual(all);
                await expect(map).toHaveAttribute('data-selected', swd1);
                await expect(panel).toHaveAttribute('data-item-id', swd1);
                await expect(field).toBeFocused();

                // None matching: "No matches", no row; Clear brings every row back, the focus in the field, the selection kept.
                await field.pressSequentially('zz no such item');
                await expect(list).toHaveAttribute('data-rows', '0');
                await expect(page.locator('.mapstudio-list-row')).toHaveCount(0);
                await expect(page.locator('.mapstudio-list-empty--search')).toHaveText('No matches');
                // The words reach a screen reader through the list's one live region, mounted before they came.
                const status = page.locator('.mapstudio-list-status');
                await expect(status).toHaveAttribute('role', 'status');
                await expect(status).toHaveText('No matches');
                await clear.click();
                await expect(status).toHaveText('');
                await expect(field).toHaveValue('');
                await expect(field).toBeFocused();
                await expect(page.locator('.mapstudio-list-empty--search')).toHaveCount(0);
                await expect(list).toHaveAttribute('data-rows', String(all.length));
                expect(await listIds(page)).toEqual(all);
                await expect(map).toHaveAttribute('data-selected', swd1);
                await expect(panel).toHaveAttribute('data-item-id', swd1);
                // Case and accents aside, as the View-mode search compares.
                await field.pressSequentially('SWD');
                await expect(list).toHaveAttribute('data-rows', String(swd.length));
                await page.keyboard.press('Escape');
                await expect(field).toHaveValue('');
            });
    });
}

test.describe('1200 px, below the list\'s collapse width', () => {
    test.use({ viewport: { width: 1200, height: 768 }, deviceScaleFactor: 1 });

    editorTest('with Details docked the toolbar keeps the row under the Editing switch and never covers it (entry 7\'s list collapse returns the top row)',
        async ({ page }) => {
            const map = await openEditor(page);
            await expect(map).toHaveAttribute('data-studio', 'on');
            const p2 = seed.ids[TRACER.points.p2.key];
            await page.locator('.mapstudio-list-row[data-item-id="' + p2 + '"]').click();
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', p2);
            await expectStageWidth(map, 1200 - 72 - 256 - 320);
            const toolbar = await page.locator('.mapstudio-toolbar').boundingBox();
            const sw = await page.locator('.mapstudio-edit-switch').boundingBox();
            expect(overlaps(toolbar, sw), 'the toolbar clear of the Editing switch').toBe(false);
            expect(toolbar.y, 'the toolbar under the switch').toBeGreaterThanOrEqual(sw.y + sw.height);
        });
});

// ---- The legend in the rail's Layers surface (entry 22) ----

const legendButton = (page) => page.locator('.mapstudio-legend-button');
const legendPanel = (page) => page.locator('.mapstudio-legend-panel');
/** The legend docked in the rail's Layers surface (the control's wrapper inside the dock). */
const docked = (page) => page.locator('.mapstudio-dock--layers .mapstudio-legend-dock');
/** How long a basemap change (a Gateway round trip, the tiles' first idle) may take on the dev stack (basemaps.spec.mjs). */
const CHANGE_MS = 30_000;
/** A 1 by 1 PNG, served for every OpenStreetMap tile as basemaps.spec.mjs serves them (the box may not reach the provider). */
const TILE_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const OSM_TILES = /^https:\/\/tile\.openstreetmap\.org\//;
const TILES_FAILED = 'OpenStreetMap tiles are not loading; check the network.';

/**
 * Serve the stub tile for OpenStreetMap; with `broken` set on the returned object the tiles come back as bytes that are not
 * an image, so a tile fails inside MapLibre (its error event) with no network error of the browser's own (basemaps.spec.mjs).
 */
async function stubOsmTiles(page) {
    const tiles = { broken: false };
    await page.route(OSM_TILES, (route) => route.fulfill({ status: 200, contentType: 'image/png',
        body: tiles.broken ? Buffer.from('not a png') : TILE_PNG }));
    return tiles;
}

/** One of the Layers surface's two tabs, `layers` or `legend` (the owner's "2, the tabs"). */
const layersTab = (page, tab) => page.locator('.mapstudio-dock--layers [role="tab"][data-tab="' + tab + '"]');

/** The rail's Layers: the surface switched, the docked legend drawn. */
async function openLayers(page, map) {
    await page.locator('.mapstudio-rail-item[data-surface="layers"]').click();
    await expect(map).toHaveAttribute('data-surface', 'layers');
    await expect(page.locator('.mapstudio-rail-item[data-surface="layers"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(docked(page)).toBeVisible();
}

/** What a place of the legend shows: its headings, its key's words, its toggles and its basemap buttons with their state. */
async function legendContent(root) {
    return {
        headings: await root.locator('.mapstudio-legend-heading').allTextContents(),
        words: await root.locator('.mapstudio-legend-key-words').allTextContents(),
        toggles: await root.locator('.mapstudio-legend-toggle').evaluateAll((els) => els.map((el) => el.getAttribute('data-toggle') + ':' + el.checked)),
        basemaps: await root.locator('.mapstudio-basemap-button').evaluateAll((els) => els.map((el) => el.getAttribute('data-basemap') + ':'
            + el.getAttribute('aria-pressed'))),
        note: await root.locator('.mapstudio-legend-note').allTextContents()
    };
}

for (const [width, height, listWidth] of [[1366, 768, 256], [1440, 900, 280]]) {
    test.describe(width + ' px, the legend in Layers', () => {
        test.use({ viewport: { width, height }, deviceScaleFactor: 1 });

        editorTest('in Edit mode no Legend button over the map and the scale bar bottom-left alone; the rail\'s Layers has two tabs, Layers (Show, Basemap) open first and Legend (the key), docked; a map click leaves it and the tab stays while Edit mode stays',
            async ({ page }) => {
                const map = await openEditor(page);
                await expect(map).toHaveAttribute('data-studio', 'on');
                // The key's Styles and Areas come with the first full batch's kind display.
                await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
                // No Legend button and no panel over the map; the scale bar alone at the map inset, bottom-left.
                await expect(legendButton(page)).toBeHidden();
                await expect(legendPanel(page)).toHaveCount(0);
                await expect(map).toHaveAttribute('data-legend-open', 'false');
                const box = await map.boundingBox();
                const scale = page.locator('.mapstudio-legend-row .maplibregl-ctrl-scale');
                await expect(scale).toBeVisible();
                const scaleBox = await scale.boundingBox();
                expect(Math.abs(scaleBox.x - (box.x + INSET)), 'the scale bar at the map inset from the left edge').toBeLessThanOrEqual(1);
                expect(Math.abs((box.y + box.height) - (scaleBox.y + scaleBox.height) - INSET), 'and from the bottom edge').toBeLessThanOrEqual(1);

                // Layers: the dock titled Layers, as wide as the list, with two tabs under its header as the properties panel's,
                // Layers first and open: Show, then Basemap (the dev setup lists three), and nothing else.
                await openLayers(page, map);
                const dock = page.locator('.mapstudio-dock--layers');
                await expect(dock.locator('.mapstudio-dock-title')).toHaveText('Layers');
                await expect(dock.locator('.mapstudio-dock-note')).toHaveCount(0);
                await expect(page.locator('.mapstudio-dock--empty')).toHaveCount(0);
                const dockBox = await dock.boundingBox();
                expect(Math.round(dockBox.width)).toBe(listWidth);
                await expect(dock.locator('.mapstudio-panel-tabs')).toHaveAttribute('role', 'tablist');
                await expect(dock.locator('[role="tab"]')).toHaveText(['Layers', 'Legend']);
                await expect(layersTab(page, 'layers')).toHaveAttribute('aria-selected', 'true');
                await expect(layersTab(page, 'layers')).toHaveClass(/mapstudio-panel-tab--active/);
                await expect(layersTab(page, 'legend')).toHaveAttribute('aria-selected', 'false');
                await expect(dock.locator('[role="tabpanel"]')).toHaveAttribute('aria-labelledby', await layersTab(page, 'layers').getAttribute('id'));
                const legend = docked(page);
                await expect(legend).toHaveAttribute('data-part', 'controls');
                expect(await legend.locator('.mapstudio-legend-heading').allTextContents(), 'Show, then Basemap').toEqual(['Show', 'Basemap']);
                await expect(legend.locator('.mapstudio-legend-key-row')).toHaveCount(0);
                await expect(legend.locator('.mapstudio-legend-toggle[data-toggle="lines"]')).toBeChecked();
                await expect(legend.locator('.mapstudio-legend-toggle[data-toggle="names"]')).toBeChecked();
                await expect(legend.locator('.mapstudio-legend-note')).toHaveText('Below zoom 14 sites show as dots');
                await expect(legend.locator('.mapstudio-basemap-button')).toHaveCount(3);
                await expect(legend.locator('.mapstudio-basemap-button[data-basemap="none"]')).toHaveAttribute('aria-pressed', 'true');
                // The desktop layout (no sheet handle or Close), and never "open": the attribute stays the panel's.
                await expect(legend.locator('.mapstudio-legend-handle, .mapstudio-legend-close')).toHaveCount(0);
                await expect(map).toHaveAttribute('data-legend-open', 'false');
                const controls = await legendContent(legend);
                await view(page, map, TRACER.center, TRACER.zoom);
                await shot(page, 'mapstudio-studio-layers-' + width + '.png');

                // The Legend tab: the key alone (States, Kinds, Lines, Styles, Areas).
                await layersTab(page, 'legend').click();
                await expect(layersTab(page, 'legend')).toHaveAttribute('aria-selected', 'true');
                await expect(layersTab(page, 'layers')).toHaveAttribute('aria-selected', 'false');
                await expect(legend).toHaveAttribute('data-part', 'key');
                const headings = await legend.locator('.mapstudio-legend-heading').allTextContents();
                console.log(width + ' px: the Legend tab holds ' + headings.join(', '));
                expect(headings[0], 'States first').toBe('States');
                expect(headings, 'the line looks').toContain('Lines');
                expect(headings, 'the key alone').not.toContain('Show');
                expect(headings).not.toContain('Basemap');
                await expect(legend.locator('.mapstudio-legend-state')).toHaveCount(6);
                await expect(legend.locator('.mapstudio-legend-toggle, .mapstudio-basemap-button')).toHaveCount(0);
                // Docked, not a card: no shadow or corner, the dock's width less its edge, under the tabs, its body scrolling
                // inside the dock.
                const look = await legend.evaluate((el) => ({
                    shadow: getComputedStyle(el).boxShadow,
                    radius: getComputedStyle(el).borderTopLeftRadius,
                    scrolls: getComputedStyle(el.querySelector('.mapstudio-legend-body')).overflowY
                }));
                expect(look).toEqual({ shadow: 'none', radius: '0px', scrolls: 'auto' });
                const legendBox = await legend.boundingBox();
                const tabs = await dock.locator('.mapstudio-panel-tabs').boundingBox();
                expect(legendBox.y, 'under the tabs').toBeGreaterThanOrEqual(tabs.y + tabs.height - 1);
                expect(Math.abs(legendBox.x - dockBox.x), 'from the dock\'s left edge').toBeLessThanOrEqual(1);
                expect(Math.abs(legendBox.width - (dockBox.width - 1)), 'as wide as the dock less its edge').toBeLessThanOrEqual(1);
                expect(legendBox.y + legendBox.height, 'inside the dock').toBeLessThanOrEqual(dockBox.y + dockBox.height + 1);
                await shot(page, 'mapstudio-studio-layers-legend-' + width + '.png');

                // Clicks on the map with the Legend tab showing (a marker, then the ground): the popup opens and closes, the dock's
                // legend stays as it was.
                const key = await legendContent(legend);
                await view(page, map, TRACER.points.p1.lngLat, 15);
                const [x, y] = await pixelNow(map, TRACER.points.p1.lngLat);
                await page.mouse.click(x, y);
                await expect(map).toHaveAttribute('data-popup-mode', 'card');
                await expect(legend).toBeVisible();
                const ground = await groundSpot(page, map);
                await page.mouse.click(ground[0], ground[1]);
                await expect(map).toHaveAttribute('data-popup-mode', '');
                await expect(map).toHaveAttribute('data-selected', '');
                await expect(legend).toBeVisible();
                expect(await legendContent(legend)).toEqual(key);
                await expect(map).toHaveAttribute('data-legend-open', 'false');

                // The chosen tab stays while Edit mode stays: Items and back to Layers, the Legend tab still open.
                await page.locator('.mapstudio-rail-item[data-surface="items"]').click();
                await expect(page.locator('.mapstudio-dock--items')).toBeVisible();
                await expect(page.locator('.mapstudio-legend-dock')).toHaveCount(0);
                await openLayers(page, map);
                await expect(layersTab(page, 'legend')).toHaveAttribute('aria-selected', 'true');
                expect(await legendContent(legend)).toEqual(key);

                // One legend: View mode's panel draws the key, then Show and Basemap, from the same state.
                await page.locator('.mapstudio-edit-switch-button').click();
                await expect(map).toHaveAttribute('data-studio', 'off');
                await expect(page.locator('.mapstudio-legend-dock')).toHaveCount(0);
                await expect(legendButton(page)).toBeVisible();
                await legendButton(page).click();
                await expect(legendPanel(page)).toBeVisible();
                expect(await legendContent(legendPanel(page))).toEqual({
                    headings: [...key.headings, ...controls.headings], words: [...key.words, ...controls.words],
                    toggles: controls.toggles, basemaps: controls.basemaps, note: controls.note
                });
                // A fresh entry to Edit mode opens Layers on its Layers tab.
                await page.locator('.mapstudio-edit-switch-button').click();
                await expect(map).toHaveAttribute('data-studio', 'on');
                await openLayers(page, map);
                await expect(layersTab(page, 'layers')).toHaveAttribute('aria-selected', 'true');
                await expect(legend).toHaveAttribute('data-part', 'controls');
            });
    });
}

test.describe('1366 px, the legend in Layers acts as the panel does', () => {
    test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });

    editorTest('Lines turned off in Layers hide the lines, stay off after a reload and show off in View mode\'s panel; turned on there, on in Layers',
        async ({ page }) => {
            let map = await openEditor(page);
            await view(page, map, TRACER.center, TRACER.zoom);
            await openLayers(page, map);
            const lines = docked(page).locator('.mapstudio-legend-toggle[data-toggle="lines"]');
            const names = docked(page).locator('.mapstudio-legend-toggle[data-toggle="names"]');
            await expect(map).toHaveAttribute('data-lines', 'on');
            await expect(map).toHaveAttribute('data-lines-drawn', /^[1-9][0-9]*$/, { timeout: DRAW_MS });
            await lines.click();
            await expect(lines).not.toBeChecked();
            await expect(map).toHaveAttribute('data-lines', 'off');
            await expect.poll(() => map.getAttribute('data-lines-drawn'), { timeout: DRAW_MS }).toBe('0');
            await expect(names).toBeChecked();
            await expect(map).toHaveAttribute('data-names', 'on');

            // Remembered for the session as the panel's toggles are: after a reload the lines are still off.
            await page.reload();
            map = await openEditor(page);
            await expect(map).toHaveAttribute('data-lines', 'off');
            await expect(map).toHaveAttribute('data-names', 'on');
            await openLayers(page, map);
            await expect(lines).not.toBeChecked();
            await expect(names).toBeChecked();

            // View mode's panel shows them as Layers left them; Lines on from the panel is on in Layers again.
            await page.locator('.mapstudio-edit-switch-button').click();
            await expect(map).toHaveAttribute('data-studio', 'off');
            await legendButton(page).click();
            const panelLines = legendPanel(page).locator('.mapstudio-legend-toggle[data-toggle="lines"]');
            await expect(panelLines).not.toBeChecked();
            await expect(legendPanel(page).locator('.mapstudio-legend-toggle[data-toggle="names"]')).toBeChecked();
            await panelLines.click();
            await expect(map).toHaveAttribute('data-lines', 'on');
            await page.locator('.mapstudio-edit-switch-button').click();
            await expect(map).toHaveAttribute('data-studio', 'on');
            await openLayers(page, map);
            await expect(lines).toBeChecked();
            await expect.poll(() => map.getAttribute('data-lines-drawn'), { timeout: DRAW_MS }).not.toBe('0');
        });

    editorTest('a basemap picked in Layers switches the map and is remembered as from the panel; a tile status is said there in words, as in the panel',
        async ({ page }) => {
            const tiles = await stubOsmTiles(page);
            let map = await openEditor(page);
            await openLayers(page, map);
            const pick = (id) => docked(page).locator('.mapstudio-basemap-button[data-basemap="' + id + '"]');
            const status = docked(page).locator('.mapstudio-basemap-status');
            await expect(map).toHaveAttribute('data-basemap-offered', 'none,osm,satellite');
            await expect(map).toHaveAttribute('data-basemap', 'none');
            await expect(pick('none')).toHaveAttribute('aria-pressed', 'true');
            await pick('osm').click();
            await expect(map).toHaveAttribute('data-basemap', 'osm');
            await expect(pick('osm')).toHaveAttribute('aria-pressed', 'true');
            await expect(pick('none')).toHaveAttribute('aria-pressed', 'false');
            await expect(map).toHaveAttribute('data-basemap-tiles', 'loaded', { timeout: CHANGE_MS });
            await expect(map).toHaveAttribute('data-basemap-status', '');
            await expect(status).toBeHidden();
            await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('OpenStreetMap contributors');

            // Remembered as a choice in the panel is: after a reload OpenStreetMap is drawn and pressed in Layers.
            await page.reload();
            map = await openEditor(page);
            await expect(map).toHaveAttribute('data-basemap', 'osm', { timeout: CHANGE_MS });
            await openLayers(page, map);
            await expect(pick('osm')).toHaveAttribute('aria-pressed', 'true');

            // Tiles that do not load: the status in words under Layers' buttons, as under the panel's.
            tiles.broken = true;
            await pick('none').click();
            await expect(map).toHaveAttribute('data-basemap', 'none');
            await pick('osm').click();
            await expect(map).toHaveAttribute('data-basemap', 'osm');
            await expect(map).toHaveAttribute('data-basemap-tiles', 'failed', { timeout: CHANGE_MS });
            await expect(map).toHaveAttribute('data-basemap-status', TILES_FAILED);
            await expect(status).toBeVisible();
            await expect(status).toHaveText(TILES_FAILED);

            // View mode's panel shows the same choice and the same status; None there clears it, as Layers then shows.
            await page.locator('.mapstudio-edit-switch-button').click();
            await expect(map).toHaveAttribute('data-studio', 'off');
            await legendButton(page).click();
            await expect(legendPanel(page).locator('.mapstudio-basemap-button[data-basemap="osm"]')).toHaveAttribute('aria-pressed', 'true');
            await expect(legendPanel(page).locator('.mapstudio-basemap-status')).toHaveText(TILES_FAILED);
            await legendPanel(page).locator('.mapstudio-basemap-button[data-basemap="none"]').click();
            await expect(map).toHaveAttribute('data-basemap', 'none');
            await expect(map).toHaveAttribute('data-basemap-status', '');
            await page.locator('.mapstudio-edit-switch-button').click();
            await expect(map).toHaveAttribute('data-studio', 'on');
            await openLayers(page, map);
            await expect(pick('none')).toHaveAttribute('aria-pressed', 'true');
            await expect(status).toBeHidden();
        });

    editorTest('a Legend panel open as Edit mode comes on closes and gives the focus up; leaving Edit mode brings the Legend button back with its panel closed; a focused Legend button gives the focus up as Edit mode comes on',
        async ({ page }) => {
            const map = await openEditor(page);
            const sw = page.locator('.mapstudio-edit-switch-button');
            await sw.click();
            await expect(map).toHaveAttribute('data-studio', 'off');
            await expect(legendButton(page)).toBeVisible();
            // Opened by keyboard, so the focus is in the panel; the switch is pressed from a script so the focus stays there, as
            // when the page's editMode prop turns Edit mode on.
            await legendButton(page).focus();
            await page.keyboard.press('Enter');
            await expect(legendPanel(page)).toBeVisible();
            await expect(map).toHaveAttribute('data-legend-open', 'true');
            await page.evaluate(() => document.querySelector('.mapstudio-edit-switch-button').click());
            await expect(map).toHaveAttribute('data-studio', 'on');
            await expect(legendPanel(page)).toHaveCount(0);
            await expect(map).toHaveAttribute('data-legend-open', 'false');
            await expect(legendButton(page)).toBeHidden();
            await expect(legendButton(page)).toHaveAttribute('aria-expanded', 'false');
            expect(await page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest('.mapstudio-legend'))),
                'the focus left the legend').toBe(false);
            // Layers shows the content.
            await openLayers(page, map);
            await expect(docked(page).locator('.mapstudio-legend-section--show')).toBeVisible();

            // Off: the docked copy goes with the studio, the Legend button is back bottom-left with the scale bar on its bottom
            // edge, its panel closed until asked for.
            await sw.click();
            await expect(map).toHaveAttribute('data-studio', 'off');
            await expect(page.locator('.mapstudio-legend-dock')).toHaveCount(0);
            await expect(legendButton(page)).toBeVisible();
            await expect(legendButton(page)).toHaveAttribute('aria-expanded', 'false');
            await expect(legendPanel(page)).toHaveCount(0);
            await expect(map).toHaveAttribute('data-legend-open', 'false');
            const box = await map.boundingBox();
            const button = await legendButton(page).boundingBox();
            const scale = await page.locator('.mapstudio-legend-row .maplibregl-ctrl-scale').boundingBox();
            expect(Math.abs(button.x - (box.x + INSET)), 'the Legend button at the map inset').toBeLessThanOrEqual(1);
            expect(scale.x, 'the scale bar beside it').toBeGreaterThan(button.x + button.width);
            expect(Math.abs((scale.y + scale.height) - (button.y + button.height)), 'on its bottom edge').toBeLessThanOrEqual(1);
            await legendButton(page).click();
            await expect(legendPanel(page)).toBeVisible();
            await expect(map).toHaveAttribute('data-legend-open', 'true');

            // The Legend button itself focused, its panel closed (Esc returns the focus to it), then Edit mode turned on by a
            // script, as the page's editMode prop does: the hidden button gives the focus up. Read as the studio's render commits
            // (a mutation observer's microtask, after the commit's componentDidUpdate): the browser blurs a hidden element by
            // itself only at its next rendering update, so a later read could not tell the component's blur from the browser's.
            await page.keyboard.press('Escape');
            await expect(legendPanel(page)).toHaveCount(0);
            await expect(legendButton(page)).toBeFocused();
            const onButton = await page.evaluate(() => new Promise((resolve) => {
                const el = document.querySelector('.mapstudio-map');
                const button = document.querySelector('.mapstudio-legend-button');
                const watch = new MutationObserver(() => {
                    if (el.getAttribute('data-studio') === 'on') {
                        watch.disconnect();
                        resolve(document.activeElement === button);
                    }
                });
                watch.observe(el, { attributes: true, attributeFilter: ['data-studio'] });
                document.querySelector('.mapstudio-edit-switch-button').click();
            }));
            expect(onButton, 'the focus is no longer on the hidden Legend button').toBe(false);
            await expect(map).toHaveAttribute('data-studio', 'on');
            await expect(legendButton(page)).toBeHidden();
        });
});

test.describe('390 px, the top row', () => {
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

    editorTest('the map editor keeps the Legend button and its sheet at phone width, as before (entry 22): Show first, no Basemap, no Layers',
        async ({ page }) => {
            const map = await openEditor(page);
            await expect(map).toHaveAttribute('data-studio', 'off');
            await expect(legendButton(page)).toBeVisible();
            await expect(page.locator('.mapstudio-legend-dock')).toHaveCount(0);
            await legendButton(page).click();
            await expect(legendPanel(page)).toBeVisible();
            await expect(legendPanel(page)).toHaveClass(/mapstudio-legend-panel--sheet/);
            await expect(map).toHaveAttribute('data-legend-open', 'true');
            await expect(legendPanel(page).locator('.mapstudio-legend-handle')).toBeVisible();
            const headings = await legendPanel(page).locator('.mapstudio-legend-heading').allTextContents();
            expect(headings[0], 'Show first').toBe('Show');
            expect(headings, 'no basemap section on a phone').not.toContain('Basemap');
            await legendPanel(page).locator('.mapstudio-legend-close').click();
            await expect(legendPanel(page)).toHaveCount(0);
            await expect(map).toHaveAttribute('data-legend-open', 'false');
        });

    editorTest('the map editor keeps View mode\'s top bar at phone width: the search field and the Needs you bar in the one bar, no list panel',
        async ({ page }) => {
            const map = await openEditor(page);
            await expect(map).toHaveAttribute('data-studio', 'off');
            await expect(map).toHaveAttribute('data-mode', 'view');
            const bar = page.locator('.mapstudio-topbar');
            await expect(bar).toBeVisible();
            await expect(page.locator('.mapstudio-search-field')).toBeVisible();
            await expect(page.locator('.mapstudio-needs')).toBeVisible();
            await expect(page.locator('.mapstudio-dock')).toHaveCount(0);
            await expect(page.locator('.mapstudio-list-search')).toHaveCount(0);
            // The one top bar 8 px from the edges, 48 px tall (DESIGN.md Phone), as search.spec.mjs reads it.
            const box = await map.boundingBox();
            const barBox = await bar.boundingBox();
            expect(Math.round(barBox.x - box.x)).toBe(8);
            expect(Math.round(barBox.y - box.y)).toBe(8);
            expect(Math.round(barBox.width)).toBe(390 - 16);
            expect(Math.round(barBox.height)).toBe(48);
        });
});
