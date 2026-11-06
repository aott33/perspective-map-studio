// In Edit mode a click selects and opens Details, no popup (epic 4 entry 26, the owner's choice A; EXPERIENCE.md Select), at 1366 px
// as the map editor on the seed: CTB1 clicked is selected with Details open and no popup, the point click round trip still sent and
// no popup.open, and it drags at once (one batch, undone); L-SWD clicked is selected with its handles and Details, no line popup; a
// shared marker still opens its pick list, whose row selects that pad and opens Details; P14's pad (Point 2) with its popup open
// in View mode, the Edit switch turned on closes the popup and tells the Gateway with popup.close; with L-SWD in Details and the
// Line tool holding two points, Esc puts the tool down (the drawing cancelled, Select in hand) and Details stays, a second Esc
// closing it (deferred from entry 25); in View mode the same clicks open the popups as before. The Gateway's messages are read
// from the frames the page sends on the Perspective session socket. A render of CTB1's Details for the docs under E2E_DOCS=1
// (AD-15). The spec leaves the seed as it found it (its one change undone, then the seed run again and the strays removed).

import { pagePixel } from '../lib/geo.mjs';
import { frameText } from '../lib/valueBatch.mjs';
import {
    EDITOR_USER, VERTEX_PAUSE_MS, editorTest, ensureSeeded, expect, mapLoaded, openMap, removeStrays, runSeed, send, shot as shotNow,
    signedInContext, test, view
} from './fixtures.mjs';

/** The Gateway's answer to a save, or a message reaching the socket. */
const REPLY_MS = 20_000;
/** A popup's content (the default popup reads the item's live values) may take a moment on the dev stack. */
const POPUP_MS = 30_000;
/** There is nothing to observe when nothing is sent: the time a stray message would have to show on the socket. */
const NOTHING_MS = 800;
/** The map's width at 1366 px with the rail and the list docked, and with the properties panel too (DESIGN.md spacing). */
const STAGE = 1366 - 72 - 256;
const STAGE_WITH_PANEL = STAGE - 320;

// The L-SWD set and the shared pads (ops/project seed): CTB1, L-SWD's bend and SWD1; Shared A of the two pads 15 m apart.
const CTB1 = [-105.012, 39.7262];
const BEND = [-105.009441, 39.720791];
const SWD1 = [-104.983671, 39.715476];
const SHARED_A = [-104.965, 39.757];
/** Point 2 of the tracer, linked to the dev asset P14. */
const P14 = [-104.975, 39.75];
// The line in view with Details docked, its handles apart (as delete.spec.mjs and geometry.spec.mjs view it).
const SWD_VIEW = { center: [(CTB1[0] + SWD1[0]) / 2, (CTB1[1] + SWD1[1]) / 2 + 0.001], zoom: 13.5 };

let seed;
let ids;

test.beforeAll(async ({ browser }) => {
    seed = await ensureSeeded(browser);
    ids = { line: seed.ids['swd/line'], ctb1: seed.ids['swd/ctb1'], sharedA: seed.ids['shared/a'], sharedB: seed.ids['shared/b'],
        p14: seed.ids['tracer/p2'] };
    await restoreSeed(browser);
});

test.afterAll(async ({ browser }) => {
    await restoreSeed(browser);
});

/** The seed's own items again (a move a failed test left is put back by the seed), and no item but the seed's. */
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

/**
 * The texts of the frames the page sends on its websockets (the Perspective session socket carries Map Studio's messages,
 * wrapped in Perspective's own, sometimes as an escaped JSON string). Watched from before the page opens.
 */
function watchSent(page) {
    const frames = [];
    page.on('websocket', (ws) => ws.on('framesent', (f) => frames.push(frameText(f.payload))));
    return frames;
}

/** The frames that carry a Map Studio message of this type about this item (`popup.open`, `popup.close`, `point.click`). */
function sentOf(frames, type, itemId) {
    const pattern = new RegExp('\\\\*"type\\\\*"\\s*:\\s*\\\\*"' + type.replace('.', '\\.') + '\\\\*"');
    return frames.filter((text) => pattern.test(text) && text.includes(itemId));
}

/** /edit as the map editor at level `full`: the studio shows. */
async function openEditor(page) {
    const map = await openMap(page, '/edit');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', 'full');
    await expect(map).toHaveAttribute('data-studio', 'on');
    await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
    return map;
}

/** The Edit switch turned off: View mode, the studio gone and the map the component's width. */
async function viewMode(page, map) {
    await page.locator('.mapstudio-edit-switch-button').click();
    await expect(map).toHaveAttribute('data-mode', 'view');
    await expect(map).toHaveAttribute('data-studio', 'off');
    await expectStageWidth(map, 1366);
}

/** The map's page pixel of a place, from the box and the view the map reports now (the stage resizes as panels open). */
async function pixelNow(map, lngLat) {
    const box = await map.boundingBox();
    const center = (await map.getAttribute('data-center')).split(',').map(Number);
    const zoom = Number(await map.getAttribute('data-zoom'));
    return pagePixel(box, lngLat, center, zoom);
}

/** A page pixel on L-SWD's body, a tenth of the way from its bend to SWD1: clear of its handles and of its instruments. */
async function onLine(map) {
    const a = await pixelNow(map, BEND);
    const b = await pixelNow(map, SWD1);
    return [a[0] + (b[0] - a[0]) * 0.1, a[1] + (b[1] - a[1]) * 0.1];
}

/**
 * A page pixel on the ground: at least 44 px from every point and 24 px from every line segment at the map's view now, searched on
 * a grid inside the map box away from its controls (as studio.spec.mjs finds one).
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
        // An area's ring is stored unclosed: its closing edge counts too.
        for (let i = 1; i <= coords.length; i++) segments.push([coords[i - 1], coords[i % coords.length]]);
    }
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
            return [x, y];
        }
    }
    throw new Error('No ground spot clear of the seeded items in this view.');
}

/** Wait until the stage has the width the docked panels leave it (the map resizes after a panel opens or closes). */
async function expectStageWidth(map, width) {
    await expect.poll(async () => Math.round((await map.boundingBox()).width), { timeout: 10_000 }).toBe(width);
}

/** No popup of any kind: no card, no line popup, no sheet, no pick list. */
async function expectNoPopup(page, map) {
    await expect(map).toHaveAttribute('data-popup-mode', '');
    await expect(map).toHaveAttribute('data-pick-open', 'false');
    await expect(page.locator('.maplibregl-popup')).toHaveCount(0);
    await expect(page.locator('.mapstudio-sheet')).toHaveCount(0);
}

/** The item selected with its Details open beside the map. */
async function expectDetails(page, map, id, name) {
    await expect(map).toHaveAttribute('data-selected', id);
    const panel = page.locator('.mapstudio-panel');
    await expect(panel).toHaveAttribute('data-item-id', id);
    await expect(panel.locator('.mapstudio-panel-name')).toHaveText(name);
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

/** The stored map items through the test hook, by id. */
async function storedAll(page) {
    return Object.fromEntries((await send(page, 'map.load', {})).body.items.map((i) => [i.id, i]));
}

async function seqOf(map) {
    return Number(await map.getAttribute('data-store-seq'));
}

const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;

/** A render for the docs once the markers have taken the view's zoom. */
async function shot(page, name) {
    await page.waitForTimeout(800);
    await shotNow(page, name);
}

test.describe('1366 px', () => {
    test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });

    editorTest('a point: CTB1 clicked in Edit mode is selected with Details open and no popup, the click sent, and it drags at once',
        async ({ page }) => {
            const frames = watchSent(page);
            const map = await openEditor(page);
            await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
            await expectStageWidth(map, STAGE);
            const pad = await pixelNow(map, CTB1);
            await page.mouse.click(pad[0], pad[1]);
            await expectDetails(page, map, ids.ctb1, 'CTB1');
            await expectNoPopup(page, map);
            // The point click round trip still goes (its reply is kept on the map, shown nowhere); no popup.open is sent.
            await expect(map).toHaveAttribute('data-last-reply', new RegExp('Gateway received click on ' + ids.ctb1), { timeout: REPLY_MS });
            expect(sentOf(frames, 'point.click', ids.ctb1).length, 'point.click sent').toBeGreaterThanOrEqual(1);
            await page.waitForTimeout(NOTHING_MS);
            expect(sentOf(frames, 'popup.open', ids.ctb1), 'no popup.open in Edit mode').toEqual([]);
            // Its handle is its marker (entry 5): Details docked, the stage shrank, and the pad's page pixel is read anew.
            await expectStageWidth(map, STAGE_WITH_PANEL);
            await expect(map).toHaveAttribute('data-handles', ids.ctb1);
            await shot(page, 'mapstudio-editclick-point-1366.png');

            // It drags at once: one batch moving CTB1 (and L-SWD's snapped start with it), then Undo puts it back.
            const from = await pixelNow(map, CTB1);
            const seqBefore = await seqOf(map);
            await drag(page, from, [from[0] + 40, from[1] + 25]);
            const undo = page.locator('.mapstudio-toolbar .mapstudio-undo');
            await expect(undo).toHaveAttribute('data-step', 'Undo: move CTB1', { timeout: REPLY_MS });
            await expect(map).toHaveAttribute('data-store-seq', String(seqBefore + 1), { timeout: REPLY_MS });
            const moved = (await storedAll(page))[ids.ctb1].geometry.coordinates;
            expect(same(moved, CTB1), 'CTB1 moved').toBe(false);
            await expectDetails(page, map, ids.ctb1, 'CTB1');
            await expectNoPopup(page, map);
            await undo.click();
            await expect(map).toHaveAttribute('data-store-seq', String(seqBefore + 2), { timeout: REPLY_MS });
            await expect.poll(async () => same((await storedAll(page))[ids.ctb1].geometry.coordinates, CTB1), { timeout: REPLY_MS }).toBe(true);
        });

    editorTest('a line: L-SWD clicked in Edit mode is selected with its handles and Details, no line popup', async ({ page }) => {
        const frames = watchSent(page);
        const map = await openEditor(page);
        await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
        await expectStageWidth(map, STAGE);
        const on = await onLine(map);
        await page.mouse.click(on[0], on[1]);
        await expectDetails(page, map, ids.line, 'L-SWD');
        await expect(map).toHaveAttribute('data-selected-kind', 'line');
        await expect(map).toHaveAttribute('data-handles', ids.line);
        await expect(map).toHaveAttribute('data-handle-points', '3');
        await expectNoPopup(page, map);
        await expect(page.locator('.mapstudio-popup--line')).toHaveCount(0);
        // No segment is opened (the segment is the line popup's): no instrument highlighted.
        await expect(map).toHaveAttribute('data-segment', '');
        await page.waitForTimeout(NOTHING_MS);
        expect(sentOf(frames, 'popup.open', ids.line), 'no popup.open in Edit mode').toEqual([]);
        // The ground clears the selection and closes Details, as today.
        await expectStageWidth(map, STAGE_WITH_PANEL);
        const ground = await groundSpot(page, map);
        await page.mouse.click(ground[0], ground[1]);
        await expect(map).toHaveAttribute('data-selected', '');
        await expect(page.locator('.mapstudio-panel')).toHaveCount(0);
        await expect(map).toHaveAttribute('data-handles', '');
    });

    editorTest('a shared spot in Edit mode: its pick list; a row selects that pad and opens Details, no popup', async ({ page }) => {
        const frames = watchSent(page);
        const map = await openEditor(page);
        await view(page, map, SHARED_A, 15);
        const at = await pixelNow(map, SHARED_A);
        await page.mouse.click(at[0], at[1]);
        const pick = page.locator('.maplibregl-popup .mapstudio-popup--pick');
        await expect(pick).toBeVisible({ timeout: POPUP_MS });
        await expect(pick).toHaveAttribute('data-rows', '2');
        await expect(map).toHaveAttribute('data-pick-open', 'true');
        const rows = pick.locator('.mapstudio-pick-row');
        await expect(rows.nth(1)).toHaveAttribute('data-item-id', ids.sharedB);
        await rows.nth(1).click();
        await expectDetails(page, map, ids.sharedB, 'Shared B');
        await expectNoPopup(page, map);
        await expect(map).toHaveAttribute('data-last-reply', new RegExp('Gateway received click on ' + ids.sharedB), { timeout: REPLY_MS });
        await page.waitForTimeout(NOTHING_MS);
        expect(sentOf(frames, 'popup.open', ids.sharedB), 'no popup.open in Edit mode').toEqual([]);
    });

    editorTest('P14\'s popup open in View mode: the Edit switch on closes it and tells the Gateway with popup.close', async ({ page }) => {
        const frames = watchSent(page);
        const map = await openEditor(page);
        await viewMode(page, map);
        await view(page, map, P14, 15);
        const at = await pixelNow(map, P14);
        await page.mouse.click(at[0], at[1]);
        const card = page.locator('.maplibregl-popup .mapstudio-popup--default');
        await expect(card).toBeVisible({ timeout: POPUP_MS });
        await expect(card).toHaveAttribute('data-point-id', ids.p14);
        await expect(map).toHaveAttribute('data-popup-mode', 'card');
        await expect.poll(() => sentOf(frames, 'popup.open', ids.p14).length, { timeout: REPLY_MS }).toBeGreaterThanOrEqual(1);
        expect(sentOf(frames, 'popup.close', ids.p14)).toEqual([]);

        await page.locator('.mapstudio-edit-switch-button').click();
        await expect(map).toHaveAttribute('data-studio', 'on');
        await expectNoPopup(page, map);
        await expect.poll(() => sentOf(frames, 'popup.close', ids.p14).length, { timeout: REPLY_MS }).toBe(1);
        await expect(page.locator('#mapstudio-dev-editmode')).toHaveText('editMode: true', { timeout: REPLY_MS });
    });

    editorTest('Esc with the Line tool holding two points puts it down and Details stays open; a second Esc closes Details',
        async ({ page }) => {
            const map = await openEditor(page);
            const before = Number(await map.getAttribute('data-items-loaded'));
            const seqBefore = await seqOf(map);
            await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
            const on = await onLine(map);
            await page.mouse.click(on[0], on[1]);
            await expectDetails(page, map, ids.line, 'L-SWD');
            await expectStageWidth(map, STAGE_WITH_PANEL);

            await page.locator('.mapstudio-tool--line').click();
            await expect(map).toHaveAttribute('data-tool', 'line');
            const bar = page.locator('.mapstudio-drawing-bar');
            await expect(bar).toHaveAttribute('data-points', '0');
            // Two points on the ground south of the line, clear of its points and its instruments.
            const box = await map.boundingBox();
            await page.mouse.click(box.x + box.width / 2 - 80, box.y + box.height / 2 + 120);
            await expect(bar).toHaveAttribute('data-points', '1');
            await page.waitForTimeout(VERTEX_PAUSE_MS);
            await page.mouse.click(box.x + box.width / 2 + 60, box.y + box.height / 2 + 140);
            await expect(bar).toHaveAttribute('data-points', '2');
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', ids.line);

            // One Esc, one step: the drawing cancelled, Select in hand, nothing talks, and L-SWD still in Details.
            await page.keyboard.press('Escape');
            await expect(bar).toHaveCount(0);
            await expect(map).toHaveAttribute('data-tool', '');
            await expect(page.locator('.mapstudio-tool--select')).toHaveAttribute('aria-pressed', 'true');
            await expect(page.locator('.mapstudio-tool--line')).toHaveAttribute('aria-pressed', 'false');
            await page.waitForTimeout(NOTHING_MS);
            await expectDetails(page, map, ids.line, 'L-SWD');
            await expect(map).toHaveAttribute('data-handles', ids.line);
            await expect(map).toHaveAttribute('data-items-loaded', String(before));
            await expect(map).toHaveAttribute('data-store-seq', String(seqBefore));

            // The second Esc closes Details and the selection goes.
            await page.keyboard.press('Escape');
            await expect(page.locator('.mapstudio-panel')).toHaveCount(0);
            await expect(map).toHaveAttribute('data-selected', '');
            await expect(map).toHaveAttribute('data-store-seq', String(seqBefore));
        });

    editorTest('View mode: the same clicks open the popups as before, CTB1\'s card, L-SWD\'s line popup and a shared row\'s card',
        async ({ page }) => {
            const frames = watchSent(page);
            const map = await openEditor(page);
            await viewMode(page, map);
            await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
            const pad = await pixelNow(map, CTB1);
            await page.mouse.click(pad[0], pad[1]);
            const card = page.locator('.maplibregl-popup .mapstudio-popup--default');
            await expect(card).toHaveAttribute('data-point-id', ids.ctb1, { timeout: POPUP_MS });
            await expect(map).toHaveAttribute('data-popup-mode', 'card');
            await expect(map).toHaveAttribute('data-selected', ids.ctb1);
            await expect(page.locator('.mapstudio-panel')).toHaveCount(0);
            await expect.poll(() => sentOf(frames, 'popup.open', ids.ctb1).length, { timeout: REPLY_MS }).toBeGreaterThanOrEqual(1);
            await card.locator('.mapstudio-popup-close').click();
            await expect(map).toHaveAttribute('data-popup-mode', '');

            const on = await onLine(map);
            await page.mouse.click(on[0], on[1]);
            const line = page.locator('.maplibregl-popup .mapstudio-popup--line');
            await expect(line).toBeVisible({ timeout: POPUP_MS });
            await expect(map).toHaveAttribute('data-selected', ids.line);
            await expect(page.locator('.mapstudio-panel')).toHaveCount(0);
            await line.locator('.mapstudio-popup-close').click();
            await expect(map).toHaveAttribute('data-popup-mode', '');

            await view(page, map, SHARED_A, 15);
            const at = await pixelNow(map, SHARED_A);
            await page.mouse.click(at[0], at[1]);
            const pick = page.locator('.maplibregl-popup .mapstudio-popup--pick');
            await expect(pick).toBeVisible({ timeout: POPUP_MS });
            await pick.locator('.mapstudio-pick-row').nth(1).click();
            await expect(card.locator('.mapstudio-popup-name')).toHaveText('Shared B', { timeout: POPUP_MS });
            await expect(map).toHaveAttribute('data-selected', ids.sharedB);
            await expect(page.locator('.mapstudio-panel')).toHaveCount(0);
        });
});
