// Delete, undone in one step, and every shortcut named on its control (epic 4 entry 25; EXPERIENCE.md Delete and Keyboard, DESIGN.md
// Properties panel "Footer: a delete icon"): at 1366 px as the map editor, on the seed's L-SWD set (CTB1 to SWD1, PT-1, LV-1 and PT-2
// on the line): CTB1 deleted from the footer's delete icon with no question asked, in one batch with L-SWD's end that names it
// cleared, Details closing; L-SWD deleted with the Delete key, its three instruments in the same batch; each one Undo step that
// restores everything with its link and properties, and Redo deleting again; with a point of L-SWD chosen the Delete key is that
// point's Delete point (off at the floor and while Move waits), the footer then naming no key; in the Name field Delete is the
// field's; with a tool in hand no delete, the footer off saying why (the review's patch); a delete refused (another save of CTB1
// landed first) said on the save status row; Undo, Redo, Select, the footer's delete, the panel's close, the popup's close, Clear
// the search, Hide and the bars' buttons each name their key on hover and as their accessible description. At 390 px, for a
// phone editor at 1366 px and for a viewer no delete. A render of the footer for the docs under E2E_DOCS=1 (AD-15). The spec leaves the seed as it found it (each delete
// undone, then the seed run again and the strays removed), since later specs read L-SWD.

import { pagePixel } from '../lib/geo.mjs';
import { randomUUID } from 'node:crypto';
import {
    EDITOR_USER, OPERATOR_USER, VERTEX_PAUSE_MS, editorTest, ensureSeeded, expect, mapLoaded, openMap, removeStrays, runSeed, send,
    shot as shotNow, signedInContext, test, view
} from './fixtures.mjs';

/** The Gateway's answer to a save. */
const REPLY_MS = 20_000;
/** There is nothing to observe when nothing is sent: the time a stray batch would have to show in the map's seq. */
const NOTHING_MS = 800;

// The L-SWD set (ops/project seed): its three points, the first on CTB1 and the last on SWD1.
const CTB1 = [-105.012, 39.7262];
const BEND = [-105.009441, 39.720791];
const SWD1 = [-104.983671, 39.715476];
// The line in view with Details docked (718 px of map at 1366 px), large enough that every handle is apart from the next.
const SWD_VIEW = { center: [(CTB1[0] + SWD1[0]) / 2, (CTB1[1] + SWD1[1]) / 2 + 0.001], zoom: 13.5 };

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

/** The seed's own L-SWD set again (a delete a failed test left is restored by the seed), and no item but the seed's. */
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

/** A render for the docs once the markers have taken the view's zoom. */
async function shot(page, name) {
    await page.waitForTimeout(800);
    await shotNow(page, name);
}

/** The stored map items through the test hook, by id (map.load leaves a deleted item out). */
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

/** One press (a toolbar button or a key) saved as one batch, after which `check` (a stored state) holds. */
async function oneBatch(page, map, press, check) {
    const before = await seqOf(map);
    await press();
    await expect(map).toHaveAttribute('data-store-seq', String(before + 1), { timeout: REPLY_MS });
    await expect.poll(async () => check(await storedAll(page)), { timeout: REPLY_MS }).toBe(true);
}

/** Nothing was sent: the map's seq stays where it was. */
async function expectNothingSent(page, map, seqBefore) {
    await page.waitForTimeout(NOTHING_MS);
    await expect(map).toHaveAttribute('data-store-seq', String(seqBefore));
}

/** The fields a restore brings back as they were (its link, properties, kind and shape; the version moves on). */
function same(a, b) {
    const pick = (r) => JSON.stringify([r.kind, r.name, r.geometry, r.properties, r.assetId, r.overrides, r.attachment]);
    return !!a && !!b && pick(a) === pick(b);
}

/** Whether a stored `ends` names these items (the store returns its keys in its own order). */
const endsAre = (ends, start, end) => (ends && ends.start ? ends.start.itemId : null) === start && (ends && ends.end ? ends.end.itemId : null) === end;

/** An item selected from the Items list, its Details open. */
async function selectRow(page, id) {
    await page.locator('.mapstudio-list-row[data-item-id="' + id + '"]').click();
    await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', id);
}

test.describe('1366 px', () => {
    test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });

    editorTest('CTB1 deleted from the footer, no question asked: one batch with L-SWD\'s end cleared, Details closed; Undo restores both with CTB1\'s link; Redo deletes again',
        async ({ page }) => {
            const dialogs = [];
            page.on('dialog', (d) => {
                dialogs.push(d.message());
                d.dismiss();
            });
            const map = await openEditor(page);
            const before = await storedAll(page);
            expect(before[ids.ctb1].assetId).toBe('CTB1');
            expect(endsAre(before[ids.line].ends, ids.ctb1, ids.swd1)).toBe(true);
            await selectRow(page, ids.ctb1);
            await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
            // The footer: the delete icon at its right end, its words on hover and to assistive technology.
            const footer = page.locator('.mapstudio-panel .mapstudio-panel-footer');
            const del = footer.locator('.mapstudio-panel-delete');
            await expect(del).toBeVisible();
            await expect(del).toHaveAttribute('title', 'Delete (Del)');
            await expect(del).toHaveAttribute('aria-keyshortcuts', 'Delete');
            await expect(del).toHaveAccessibleName('Delete CTB1');
            await expect(del).toHaveAccessibleDescription('Delete (Del)');
            const panelBox = await page.locator('.mapstudio-panel').boundingBox();
            const delBox = await del.boundingBox();
            expect(delBox.x + delBox.width).toBeGreaterThan(panelBox.x + panelBox.width - 48);
            expect(delBox.y + delBox.height).toBeGreaterThan(panelBox.y + panelBox.height - 48);
            await del.hover();
            await shot(page, 'mapstudio-delete-footer-1366.png');

            const seqBefore = await seqOf(map);
            await del.click();
            // At once: Details closed and the selection gone; nothing asked, nothing said but the header's save state.
            await expect(page.locator('.mapstudio-panel')).toHaveCount(0);
            await expect(map).toHaveAttribute('data-selected', '');
            await expectOneBatch(page, map, seqBefore, 'delete CTB1');
            expect(dialogs).toEqual([]);
            await expect(page.locator('.mapstudio-toast')).toHaveCount(0);
            await expect(page.locator('.mapstudio-panel-save--row')).toHaveCount(0);
            await expect(map).toHaveAttribute('data-save-state', 'saved');
            let items = await storedAll(page);
            expect(items[ids.ctb1]).toBeUndefined();
            // No live line names a deleted item: L-SWD's start floats, its end still names SWD1.
            expect(items[ids.line].ends).toEqual({ end: { itemId: ids.swd1 } });
            expect(Object.values(items).some((i) => i.ends && ((i.ends.start && i.ends.start.itemId === ids.ctb1)
                || (i.ends.end && i.ends.end.itemId === ids.ctb1)))).toBe(false);
            await expect(page.locator('.mapstudio-list-row[data-item-id="' + ids.ctb1 + '"]')).toHaveCount(0);
            // The step names its key on hover (Ctrl+Z), and the focus is on the map, where Ctrl+Z undoes it.
            const undo = page.locator('.mapstudio-toolbar .mapstudio-undo');
            const redo = page.locator('.mapstudio-toolbar .mapstudio-redo');
            await expect(undo).toHaveAttribute('title', 'Undo: delete CTB1 (Ctrl+Z)');
            await expect(undo).toHaveAccessibleName('Undo: delete CTB1');
            await expect(undo).toHaveAccessibleDescription('Undo: delete CTB1 (Ctrl+Z)');
            await expect(page.locator('.maplibregl-canvas')).toBeFocused();

            // One Undo: CTB1 back with its link, properties, kind and place, and L-SWD's end names it again.
            await oneBatch(page, map, () => undo.click(), (now) => same(now[ids.ctb1], before[ids.ctb1])
                && endsAre(now[ids.line].ends, ids.ctb1, ids.swd1));
            items = await storedAll(page);
            expect(items[ids.ctb1].assetId).toBe('CTB1');
            await expect(page.locator('.mapstudio-list-row[data-item-id="' + ids.ctb1 + '"]')).toHaveCount(1);
            await expect(redo).toHaveAttribute('title', 'Redo: delete CTB1 (Ctrl+Shift+Z)');
            await expect(redo).toHaveAttribute('aria-keyshortcuts', 'Control+Shift+Z Control+Y');
            // Redo deletes it again, the end cleared again; Undo once more leaves the seed as it was.
            await oneBatch(page, map, () => redo.click(), (now) => !now[ids.ctb1] && endsAre(now[ids.line].ends, null, ids.swd1));
            await oneBatch(page, map, () => undo.click(), (now) => same(now[ids.ctb1], before[ids.ctb1])
                && endsAre(now[ids.line].ends, ids.ctb1, ids.swd1));
        });

    editorTest('L-SWD deleted with the Delete key: PT-1, LV-1 and PT-2 in the same batch; Ctrl+Z restores all four; Redo deletes again',
        async ({ page }) => {
            const map = await openEditor(page);
            const before = await storedAll(page);
            const four = [ids.line, ids.pt1, ids.lv1, ids.pt2];
            expect(four.every((id) => before[id])).toBe(true);
            await selectRow(page, ids.line);
            await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
            await expect(map).toHaveAttribute('data-handles', ids.line);
            // The Delete key outside a field: here on the map.
            await page.locator('.maplibregl-canvas').focus();
            const seqBefore = await seqOf(map);
            await page.keyboard.press('Delete');
            await expect(page.locator('.mapstudio-panel')).toHaveCount(0);
            await expect(map).toHaveAttribute('data-selected', '');
            await expect(map).toHaveAttribute('data-handles', '');
            await expectOneBatch(page, map, seqBefore, 'delete L-SWD');
            let items = await storedAll(page);
            expect(four.filter((id) => items[id])).toEqual([]);
            // The pads stay.
            expect(items[ids.ctb1] && items[ids.swd1]).toBeTruthy();
            // Ctrl+Z on the map: all four back in one step, the instruments on L-SWD where they were, L-SWD's ends and link kept.
            await oneBatch(page, map, () => page.keyboard.press('Control+z'), (now) => four.every((id) => same(now[id], before[id])));
            items = await storedAll(page);
            expect(endsAre(items[ids.line].ends, ids.ctb1, ids.swd1)).toBe(true);
            expect(items[ids.line].assetId).toBe(before[ids.line].assetId);
            expect([ids.pt1, ids.lv1, ids.pt2].every((id) => items[id].attachment.lineId === ids.line)).toBe(true);
            // Redo (Ctrl+Shift+Z) deletes all four again; Undo restores them.
            await oneBatch(page, map, () => page.keyboard.press('Control+Shift+z'), (now) => four.every((id) => !now[id]));
            await oneBatch(page, map, () => page.locator('.mapstudio-toolbar .mapstudio-undo').click(),
                (now) => four.every((id) => same(now[id], before[id])));
        });

    editorTest('a point of L-SWD chosen: the Delete key removes that point as Delete point does; off at the floor and while Move waits',
        async ({ page }) => {
            const map = await openEditor(page);
            await selectRow(page, ids.line);
            await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
            await expect(map).toHaveAttribute('data-handle-points', '3');
            const bar = page.locator('.mapstudio-geometry-bar');
            const bend = await pixelNow(map, BEND);
            await page.mouse.click(bend[0], bend[1]);
            await expect(bar.locator('.mapstudio-geometry-title')).toHaveText('Point 2 of 3 on L-SWD');
            // Del is the point's now: the footer's delete stays on but names no key.
            const footerDelete = page.locator('.mapstudio-panel .mapstudio-panel-delete');
            await expect(footerDelete).toBeEnabled();
            await expect(footerDelete).toHaveAttribute('title', 'Delete');
            await expect(footerDelete).not.toHaveAttribute('aria-keyshortcuts', /./);
            // While Move waits for its click, Delete does nothing.
            await bar.locator('.mapstudio-geometry-move').click();
            await expect(map).toHaveAttribute('data-moving', 'point');
            await expect(footerDelete).toHaveAttribute('title', 'Delete');
            let seqBefore = await seqOf(map);
            await page.keyboard.press('Delete');
            await expectNothingSent(page, map, seqBefore);
            await expect(map).toHaveAttribute('data-moving', 'point');
            await page.keyboard.press('Escape');
            await expect(map).toHaveAttribute('data-moving', '');

            // The point chosen: Delete removes it, one batch, as the bar's Delete point; the line and its Details stay.
            await page.locator('.maplibregl-canvas').focus();
            seqBefore = await seqOf(map);
            await page.keyboard.press('Delete');
            await expectOneBatch(page, map, seqBefore, 'reshape L-SWD');
            await expect(bar).toHaveCount(0);
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', ids.line);
            let items = await storedAll(page);
            expect(items[ids.line].geometry.coordinates).toEqual([CTB1, SWD1]);
            expect(items[ids.pt1].attachment.lineId).toBe(ids.line);
            await expect(map).toHaveAttribute('data-handle-points', '2');

            // Two points left, one chosen: Delete point is off and so is the key; nothing is sent and nothing is deleted.
            const start = await pixelNow(map, CTB1);
            await page.mouse.click(start[0], start[1]);
            await expect(bar.locator('.mapstudio-geometry-title')).toHaveText('Point 1 of 2 on L-SWD');
            await expect(bar.locator('.mapstudio-geometry-delete')).toBeDisabled();
            await page.locator('.maplibregl-canvas').focus();
            seqBefore = await seqOf(map);
            await page.keyboard.press('Delete');
            await expectNothingSent(page, map, seqBefore);
            await expect(map).toHaveAttribute('data-selected', ids.line);
            items = await storedAll(page);
            expect(items[ids.line].geometry.coordinates).toHaveLength(2);
            await page.keyboard.press('Escape');
            await oneBatch(page, map, () => page.locator('.mapstudio-toolbar .mapstudio-undo').click(),
                (now) => now[ids.line].geometry.coordinates.length === 3);
        });

    editorTest('in the Name field Delete is the field\'s: a letter goes, nothing is sent, the item stays selected', async ({ page }) => {
        const map = await openEditor(page);
        await selectRow(page, ids.ctb1);
        const name = page.locator('.mapstudio-field-name');
        await name.click();
        await page.keyboard.press('Home');
        const seqBefore = await seqOf(map);
        await page.keyboard.press('Delete');
        await expect(name).toHaveValue('TB1');
        await expectNothingSent(page, map, seqBefore);
        await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', ids.ctb1);
        await expect(map).toHaveAttribute('data-selected', ids.ctb1);
        expect((await storedAll(page))[ids.ctb1].name).toBe('CTB1');
        // The letter typed back, the field finished: the name is the stored one, so nothing is saved.
        await page.keyboard.type('C');
        await expect(name).toHaveValue('CTB1');
        await page.keyboard.press('Enter');
        await expectNothingSent(page, map, seqBefore);
    });

    editorTest('a delete refused because another save of CTB1 landed first: the save status row says so and CTB1 stays',
        async ({ page }) => {
            // The page's websocket is routed so the test can hold the Gateway's map.changed frames: another save of CTB1 commits
            // while this page does not know of it yet, so the delete carries the version before it.
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
            await selectRow(page, ids.ctb1);
            const pad = (await storedAll(page))[ids.ctb1];
            holding = true;
            const other = await send(page, 'edits.apply', { batchId: randomUUID(), ops: [{ op: 'update', entity: 'item', id: ids.ctb1,
                baseVersion: pad.version, data: { properties: pad.properties } }] });
            expect(other.type, JSON.stringify(other.body)).toBe('edits.apply.reply');
            await page.locator('.mapstudio-panel .mapstudio-panel-delete').click();
            await expect(page.locator('.mapstudio-panel')).toHaveCount(0);
            const row = page.locator('.mapstudio-panel-save--row');
            await expect(row).toHaveAttribute('data-code', 'conflict', { timeout: REPLY_MS });
            await expect(row).toContainText('CTB1');
            await expect(map).toHaveAttribute('data-save-state', 'refused');
            holding = false;
            for (const message of held.splice(0)) {
                toPage.send(message);
            }
            // Nothing of the delete was written: CTB1 and L-SWD's end are as the other save left them.
            const items = await storedAll(page);
            expect(items[ids.ctb1].version).toBe(pad.version + 1);
            expect(endsAre(items[ids.line].ends, ids.ctb1, ids.swd1)).toBe(true);
            await expect(page.locator('.mapstudio-list-row[data-item-id="' + ids.ctb1 + '"]')).toHaveCount(1);
            // The refused edit waits under the row with Discard, as any refused edit does; discarded, nothing is left. Hide names Esc.
            await page.locator('.mapstudio-panel-problem--edits').click();
            const hide = page.locator('.mapstudio-unsaved-hide');
            await expect(hide).toHaveAttribute('title', 'Hide (Esc)');
            await expect(hide).toHaveAttribute('aria-keyshortcuts', 'Escape');
            await page.locator('.mapstudio-unsaved-discard').first().click();
            await expect(map).toHaveAttribute('data-unsaved-count', '0', { timeout: REPLY_MS });
        });

    editorTest('every control with a key names it on hover and as its description: Select, Clear the search, the panel\'s close, the drawing bar, the Point tool\'s Done, the geometry bar; with a tool in hand no delete',
        async ({ page }) => {
            const map = await openEditor(page);
            const select = page.locator('.mapstudio-tool--select');
            await expect(select).toHaveAttribute('title', 'Select (Esc)');
            await expect(select).toHaveAccessibleDescription('Select (Esc)');
            await expect(select).toHaveAttribute('aria-keyshortcuts', 'Escape');
            // The Items list's Clear, shown while the search holds text: Esc in the field empties it too.
            await page.locator('.mapstudio-list-search-input').fill('L-SWD');
            const clear = page.locator('.mapstudio-list-search-clear');
            await expect(clear).toHaveAttribute('title', 'Clear the search (Esc)');
            await expect(clear).toHaveAttribute('aria-keyshortcuts', 'Escape');
            await clear.click();
            await selectRow(page, ids.line);
            await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
            const footerDelete = page.locator('.mapstudio-panel .mapstudio-panel-delete');
            await expect(footerDelete).toHaveAttribute('title', 'Delete (Del)');
            const close = page.locator('.mapstudio-panel .mapstudio-panel-close');
            await expect(close).toHaveAttribute('title', 'Close (Esc)');
            await expect(close).toHaveAccessibleDescription('Close (Esc)');
            await expect(close).toHaveAttribute('aria-keyshortcuts', 'Escape');

            // The geometry bar: Delete point (Del), and while Move waits Cancel (Esc).
            const bar = page.locator('.mapstudio-geometry-bar');
            const bend = await pixelNow(map, BEND);
            await page.mouse.click(bend[0], bend[1]);
            const deletePoint = bar.locator('.mapstudio-geometry-delete');
            await expect(deletePoint).toHaveAttribute('title', 'Delete point (Del)');
            await expect(deletePoint).toHaveAccessibleDescription('Delete point (Del)');
            await expect(deletePoint).toHaveAttribute('aria-keyshortcuts', 'Delete');
            await bar.locator('.mapstudio-geometry-move').click();
            const cancelMove = bar.locator('.mapstudio-geometry-cancel');
            await expect(cancelMove).toHaveAttribute('title', 'Cancel (Esc)');
            await expect(cancelMove).toHaveAccessibleDescription('Cancel (Esc)');
            await expect(cancelMove).toHaveAttribute('aria-keyshortcuts', 'Escape');
            await page.keyboard.press('Escape');
            await page.keyboard.press('Escape');
            await expect(bar).toHaveCount(0);

            // The Line tool's bar: Cancel (Esc), and Finish (Enter) once two points are placed; Cancel then puts it down, nothing saved.
            const seqBefore = await seqOf(map);
            await page.locator('.mapstudio-tool--line').click();
            await expect(map).toHaveAttribute('data-tool', 'line');
            // With a tool in hand, before its first point too, no delete: the footer is off saying why, and Del deletes nothing.
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', ids.line);
            await expect(footerDelete).toBeDisabled();
            await expect(footerDelete).toHaveAttribute('title', 'Off while a tool is in hand - Esc puts it down');
            await expect(footerDelete).not.toHaveAttribute('aria-keyshortcuts', /./);
            await page.locator('.maplibregl-canvas').focus();
            await page.keyboard.press('Delete');
            await expectNothingSent(page, map, seqBefore);
            expect((await storedAll(page))[ids.line]).toBeDefined();
            const drawing = page.locator('.mapstudio-drawing-bar');
            const cancel = drawing.locator('.mapstudio-drawing-cancel');
            const finish = drawing.locator('.mapstudio-drawing-finish');
            await expect(cancel).toHaveAttribute('title', 'Cancel (Esc)');
            await expect(cancel).toHaveAccessibleDescription('Cancel (Esc)');
            await expect(cancel).toHaveAttribute('aria-keyshortcuts', 'Escape');
            await expect(finish).toHaveAttribute('aria-keyshortcuts', 'Enter');
            const box = await map.boundingBox();
            await page.mouse.click(box.x + box.width / 2 - 80, box.y + box.height / 2 + 120);
            await expect(drawing).toHaveAttribute('data-points', '1');
            await page.waitForTimeout(VERTEX_PAUSE_MS);
            await page.mouse.click(box.x + box.width / 2 + 60, box.y + box.height / 2 + 140);
            await expect(drawing).toHaveAttribute('data-points', '2');
            await expect(finish).toBeEnabled();
            await expect(finish).toHaveAttribute('title', 'Finish (Enter)');
            await expect(finish).toHaveAccessibleDescription('Finish (Enter)');
            // Cancel puts the tool down, nothing saved (its Esc is drawing.spec.mjs's; it closes Details as well).
            await cancel.click();
            await expect(drawing).toHaveCount(0);
            await expect(map).toHaveAttribute('data-tool', '');
            // The tool down: the footer deletes again and names Del.
            await expect(footerDelete).toBeEnabled();
            await expect(footerDelete).toHaveAttribute('title', 'Delete (Del)');

            // The Point tool's bar: Done (Esc); the footer off while it is in hand.
            await page.locator('.mapstudio-tool--point').click();
            await expect(footerDelete).toBeDisabled();
            const done = page.locator('.mapstudio-drawing-bar--point .mapstudio-drawing-done');
            await expect(done).toHaveAttribute('title', 'Done (Esc)');
            await expect(done).toHaveAccessibleDescription('Done (Esc)');
            await expect(done).toHaveAttribute('aria-keyshortcuts', 'Escape');
            await done.click();
            await expect(map).toHaveAttribute('data-tool', '');
            await expectNothingSent(page, map, seqBefore);
        });
});

test.describe('the phone and a viewer: no delete', () => {
    /** CTB1 clicked on the map, then the Delete key: it stays selected and stored, nothing sent, no footer anywhere. */
    async function noDelete(page, map, center = SWD_VIEW.center, zoom = SWD_VIEW.zoom) {
        await view(page, map, center, zoom);
        const pad = await pixelNow(map, CTB1);
        await page.mouse.click(pad[0], pad[1]);
        await expect(map).toHaveAttribute('data-selected', ids.ctb1);
        await expect(page.locator('.mapstudio-panel-delete')).toHaveCount(0);
        // The popup's close (a card, or the sheet at 390 px) names Esc, which closes it.
        const close = page.locator('.mapstudio-popup-close').first();
        await expect(close).toHaveAttribute('title', 'Close (Esc)');
        await expect(close).toHaveAttribute('aria-keyshortcuts', 'Escape');
        await page.locator('.maplibregl-canvas').focus();
        const seqBefore = await seqOf(map);
        await page.keyboard.press('Delete');
        await expectNothingSent(page, map, seqBefore);
        await expect(map).toHaveAttribute('data-selected', ids.ctb1);
        expect((await storedAll(page))[ids.ctb1]).toBeDefined();
    }

    test.describe('390 px', () => {
        test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

        editorTest('the map editor at 390 px: no footer, and the Delete key deletes nothing', async ({ page }) => {
            const map = await openMap(page, '/edit');
            await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
            await mapLoaded(map);
            await expect(map).toHaveAttribute('data-edit-level', 'full');
            await expect(map).toHaveAttribute('data-studio', 'off');
            await noDelete(page, map, CTB1, 14);
        });
    });

    test.describe('1366 px', () => {
        test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });

        test('a phone editor (level phone) at 1366 px: no footer, and the Delete key deletes nothing', async ({ browser }) => {
            const context = await signedInContext(browser, OPERATOR_USER, { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
            try {
                const page = await context.newPage();
                const map = await openMap(page, '/edit');
                await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + OPERATOR_USER);
                await mapLoaded(map);
                await expect(map).toHaveAttribute('data-edit-level', 'phone');
                await expect(map).toHaveAttribute('data-studio', 'off');
                await noDelete(page, map);
            } finally {
                await context.close();
            }
        });

        test('a viewer: no footer, and the Delete key deletes nothing', async ({ page }) => {
            const map = await openMap(page, '/edit');
            await expect(page.locator('#mapstudio-dev-user')).toContainText('Not signed in');
            await mapLoaded(map);
            await expect(map).toHaveAttribute('data-edit-level', 'none');
            await noDelete(page, map);
        });
    });
});
