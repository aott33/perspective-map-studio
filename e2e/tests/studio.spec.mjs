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
// selection kept, and a filtered row picked is a row click; at 390 px the editor keeps View mode's top bar.
// Screenshots at 1366 and 1440 px for the docs (AD-15).

import { TRACER, pagePixel } from '../lib/geo.mjs';
import { randomUUID } from 'node:crypto';
import {
    EDITOR_USER, editorTest, ensureSeeded, expect, loadedCounts, mapLoaded, openMap, removeStrays, send, shot, signedInContext, test, view, watch
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
        await expect(page.locator('.mapstudio-pill')).toHaveText('Select');
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

            // The Point tool: the pill names the kind; one click on the ground places a pad and saves it at once.
            await page.locator('.mapstudio-tool--point').click();
            await expect(map).toHaveAttribute('data-tool', 'point');
            await expect(page.locator('.mapstudio-pill')).toHaveText('Add a well pad - click the map, then drag to fine-tune');
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
            const undo = page.locator('.mapstudio-undo');
            const redo = page.locator('.mapstudio-redo');
            await expect(undo).toHaveAttribute('data-step', 'Undo: add Well pad');
            await expect(redo).toBeDisabled();
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
            await expect(page.locator('.mapstudio-pill')).toHaveText('Select');
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
            await expect(page.locator('.mapstudio-pill')).toHaveText('Select');
            await expect(page.locator('.mapstudio-tool--select')).toHaveAttribute('aria-pressed', 'true');
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

        lossTest('no search field or Needs you bar over the map; the toolbar on the top row level with the Editing switch and clear of it and the zoom card with properties docked; the pill, then the connection chip, under it',
            async ({ page }) => {
                const map = await openEditor(page);
                await expect(map).toHaveAttribute('data-studio', 'on');
                // The View-mode top bar is hidden in Edit mode: the search is the Items list's, Needs you stays View mode's.
                await expect(page.locator('.mapstudio-topbar')).toBeHidden();
                await expect(page.locator('.mapstudio-search-field')).toBeHidden();
                await expect(page.locator('.mapstudio-needs')).toBeHidden();
                await expect(page.locator('.mapstudio-list-search-input')).toBeVisible();
                // The Legend button stays where it was (owner: it stays until decided).
                await expect(page.locator('.mapstudio-legend-button')).toBeVisible();

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
                const pill = await page.locator('.mapstudio-pill').boundingBox();
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
                // The pill under the toolbar, clear of the zoom card.
                expect(pill.y, 'the pill under the toolbar').toBeGreaterThanOrEqual(toolbar.y + toolbar.height);
                expect(overlaps(pill, zoom), 'the pill clear of the zoom card').toBe(false);
                expect(overlaps(pill, sw), 'the pill clear of the switch').toBe(false);
                await shot(page, 'mapstudio-studio-top-row-' + width + '.png');

                // The connection chip under the pill: the client's connection closed for a few seconds.
                const chip = page.locator('.mapstudio-connection');
                await expect(chip).toHaveCount(0);
                await page.evaluate((s) => window.__client.simulateLostConnection(s), LOST_S);
                await expect(map).toHaveAttribute('data-connection', 'lost', { timeout: 10_000 });
                await expect(chip).toBeVisible();
                await expect(map).toHaveAttribute('data-studio', 'on');
                const chipBox = await chip.boundingBox();
                const pillNow = await page.locator('.mapstudio-pill').boundingBox();
                expect(chipBox.y, 'the chip under the pill').toBeGreaterThanOrEqual(pillNow.y + pillNow.height);
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
                await clear.click();
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

test.describe('390 px, the top row', () => {
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

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
