// The page's window on the map, both ways (epic 4 entry 14, contract 0.4.0; the plan's I/O matrix), on the dev page /events as
// the map editor at 1366 and 390 px: a Perspective table of the map's items beside the map, wired both ways (a row chosen writes
// the map's selectedItem; the map's onItemSelected selects the row), a field and buttons that write selectedItem, and a label per
// event with how many came and the last payload, and one for the viewport prop. The table's row P14 (the tracer's Point 2, linked
// to the dev asset P14, as editclick.spec.mjs names it) selects it, centred with its popup, with one onItemSelected carrying
// mapItem and the loop of table and map settling there; a click on CTB1 selects its row; L-SWD's id written fits it with its line
// popup and onPopupOpen names the segment; an id not on the map clears the selection with one warning naming it, and null closes
// the popup; P14's popup closed fires onPopupClose once; a pan fires one onViewportChanged at its end, none during it, the prop
// equal to it; in Edit mode CTB1's id selects it with Details, no popup and no onPopupOpen; with the Line tool holding two points
// the write waits, the drawing goes on, and CTB1 is selected with Details once the tool is put down; /events/<id> selects that
// item as the view starts, before the items load, and it wins over the place the map remembers; at 390 px the same writes open
// the bottom sheet as a tap does. The spec saves nothing.

import { pagePixel } from '../lib/geo.mjs';
import {
    EDITOR_USER, VERTEX_PAUSE_MS, WARNING_SETTLE_MS, editorTest, ensureSeeded, expect, mapLoaded, openMap, removeStrays, send,
    signedInContext, test, view
} from './fixtures.mjs';

/** The page's labels following an event script or a binding on the Gateway. */
const REPLY_MS = 20_000;
/** A popup's content (the default popup reads the item's live values) may take a moment on the dev stack. */
const POPUP_MS = 30_000;
/** There is nothing to observe when nothing more happens: the time a second event or a late move would have to show. */
const SETTLE_MS = 2_500;

// The seed's L-SWD set and the tracer's Point 2 (ops/project seed).
const CTB1 = [-105.012, 39.7262];
const SWD1 = [-104.983671, 39.715476];
const P14 = [-104.975, 39.75];
// CTB1 in the middle at zoom 15: a full disc to click.
const CTB1_VIEW = { center: CTB1, zoom: 15 };
// The line in view, its points apart (as editclick.spec.mjs views it): the ground south of it for the Line tool's points.
const SWD_VIEW = { center: [(CTB1[0] + SWD1[0]) / 2, (CTB1[1] + SWD1[1]) / 2 + 0.001], zoom: 13.5 };

let seed;
let ids;

test.beforeAll(async ({ browser }) => {
    seed = await ensureSeeded(browser);
    ids = { p14: seed.ids['tracer/p2'], ctb1: seed.ids['swd/ctb1'], line: seed.ids['swd/line'], pt1: seed.ids['swd/pt1'], pt2: seed.ids['swd/pt2'] };
    // Items other specs left would sit in the table and where the Line tool's points go.
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
        await removeStrays(page, seed.ids);
    } finally {
        await context.close();
    }
});

/** /events (or /events/<id>) as the map editor in View mode, its items and their first full batch in. */
async function openEvents(page, path = '/events') {
    const map = await openMap(page, path);
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', 'full');
    await expect(map).toHaveAttribute('data-mode', 'view');
    await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
    return map;
}

/** A label an event script writes as `count|payload`: how many came and the last one's words. */
async function counted(page, id) {
    const text = await page.locator('#' + id).innerText();
    const i = text.indexOf('|');
    return { count: Number(text.slice(0, i)), last: text.slice(i + 1) };
}

/** Wait until the label's count is `count`, and give back its last payload. */
async function countIs(page, id, count) {
    await expect.poll(async () => (await counted(page, id)).count, { timeout: REPLY_MS, message: id }).toBe(count);
    return (await counted(page, id)).last;
}

const LABELS = {
    item: 'mapstudio-events-item-selected', viewport: 'mapstudio-events-viewport-changed', open: 'mapstudio-events-popup-open',
    close: 'mapstudio-events-popup-close'
};

/** Every event label's count now. */
async function counts(page) {
    const out = {};
    for (const [key, id] of Object.entries(LABELS)) out[key] = (await counted(page, id)).count;
    return out;
}

/** The field the page writes selectedItem from: Perspective's text field is the input itself, or holds it. */
async function writeField(page) {
    const field = page.locator('#mapstudio-events-write-id');
    return (await field.evaluate((el) => el.tagName)) === 'INPUT' ? field : field.locator('input');
}

/** The page writes the map's selectedItem: the id typed in the field and the button pressed. */
async function pageWrites(page, id) {
    const input = await writeField(page);
    await input.fill(id);
    await page.locator('#mapstudio-events-write').click();
}

/** The page writes null to the map's selectedItem. */
async function pageWritesNull(page) {
    await page.locator('#mapstudio-events-write-null').click();
}

/** The table's row of a map item, by its name cell. */
function row(page, name) {
    return page.locator('#mapstudio-events-table').getByText(name, { exact: true });
}

/** The page's labels of the selectedItem prop and the table's chosen row. */
async function expectPage(page, id, rowName) {
    await expect(page.locator('#mapstudio-events-selected')).toHaveText(id === null ? /^selectedItem:\s*$/ : 'selectedItem: ' + id, { timeout: REPLY_MS });
    await expect(page.locator('#mapstudio-events-table-selected')).toHaveText(rowName === null ? /^table:\s*$/ : 'table: ' + rowName,
        { timeout: REPLY_MS });
}

/** The map's page pixel of a place, from the box and the view the map reports now. */
async function pixelNow(map, lngLat) {
    const box = await map.boundingBox();
    const center = (await map.getAttribute('data-center')).split(',').map(Number);
    const zoom = Number(await map.getAttribute('data-zoom'));
    return pagePixel(box, lngLat, center, zoom);
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

/** The viewport the component last gave the page (`data-viewport`) in the dev labels' words (mapstudio_events.viewportText). */
function viewportWords(json) {
    const v = JSON.parse(json);
    const f6 = (n) => n.toFixed(6);
    return f6(v.center[0]) + ',' + f6(v.center[1]) + '|' + v.zoom.toFixed(2) + '|'
        + [v.bounds[0][0], v.bounds[0][1], v.bounds[1][0], v.bounds[1][1]].map(f6).join(',');
}

/**
 * A page pixel on the ground: at least 44 px from every point and 24 px from every line segment at the map's view now, and
 * outside every area, searched on a grid inside the map box away from its controls (as editclick.spec.mjs finds one).
 */
async function groundSpot(page, map, after = null) {
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
    const toSegment = ([x, y], [[ax, ay], [bx, by]]) => {
        const dx = bx - ax;
        const dy = by - ay;
        const len2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
        return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    };
    for (let y = box.y + 140; y < box.y + box.height - 100; y += 40) {
        for (let x = box.x + 80; x < box.x + box.width - 140; x += 40) {
            if (after && Math.hypot(x - after[0], y - after[1]) < 80) continue;
            if (points.some(([px0, py0]) => Math.hypot(px0 - x, py0 - y) < 44)) continue;
            if (segments.some((seg) => toSegment([x, y], seg) < 24)) continue;
            return [x, y];
        }
    }
    throw new Error('No ground spot clear of the seeded items in this view.');
}

test.describe('1366 px', () => {
    test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });

    editorTest('table selects: P14\'s row selects it, centred with its popup, one onItemSelected with mapItem, the loop settles; its popup closed fires onPopupClose once',
        async ({ page, watched }) => {
            const map = await openEvents(page);
            // The first settle gave the page its first viewport.
            await expect(map).toHaveAttribute('data-viewport', /"center"/, { timeout: REPLY_MS });
            await expect.poll(async () => (await counted(page, LABELS.viewport)).count, { timeout: REPLY_MS }).toBeGreaterThanOrEqual(1);
            const before = await counts(page);
            expect(before.item, 'no selection yet').toBe(0);

            await row(page, 'Point 2').click();
            // The map: P14 selected with its card open, the Gateway and the page told.
            const card = page.locator('.maplibregl-popup .mapstudio-popup--default');
            await expect(card).toHaveAttribute('data-point-id', ids.p14, { timeout: POPUP_MS });
            await expect(map).toHaveAttribute('data-selected', ids.p14);
            await expect(map).toHaveAttribute('data-popup-mode', 'card');
            // Zoom 15 at least, as a search choice shows a point.
            expect(Number(await map.getAttribute('data-zoom'))).toBeGreaterThanOrEqual(15);
            expect(await countIs(page, LABELS.item, 1)).toBe(ids.p14 + '|Point 2|pad');
            expect(await countIs(page, LABELS.open, before.open + 1)).toBe(ids.p14 + '|none');
            await expectPage(page, ids.p14, 'Point 2');

            // The table and the map answered each other (the map's event selected the row, the row wrote the same id): it settles
            // with one onItemSelected and the camera where the one move left it.
            const center = await map.getAttribute('data-center');
            const moved = (await counted(page, LABELS.viewport)).count;
            expect(moved, 'the camera moved to P14').toBeGreaterThan(before.viewport);
            await page.waitForTimeout(SETTLE_MS);
            expect((await counted(page, LABELS.item)).count, 'one onItemSelected').toBe(1);
            expect((await counted(page, LABELS.viewport)).count, 'no second camera move').toBe(moved);
            await expect(map).toHaveAttribute('data-center', center);
            await expect(map).toHaveAttribute('data-selected', ids.p14);
            expect((await counted(page, LABELS.open)).count, 'one popup opened').toBe(before.open + 1);

            // P14's popup closed: onPopupClose once, the selection cleared and the row with it.
            await card.locator('.mapstudio-popup-close').click();
            await expect(map).toHaveAttribute('data-popup-mode', '');
            expect(await countIs(page, LABELS.close, before.close + 1)).toBe(ids.p14);
            expect(await countIs(page, LABELS.item, 2)).toBe('none');
            await expectPage(page, null, null);
            await page.waitForTimeout(SETTLE_MS);
            expect((await counted(page, LABELS.close)).count, 'one onPopupClose').toBe(before.close + 1);
            expect((await counted(page, LABELS.item)).count).toBe(2);
            expect(watched.warnings, 'Map Studio warnings').toEqual([]);
        });

    editorTest('map selects: a click on CTB1 selects its row in the table through onItemSelected', async ({ page, watched }) => {
        const map = await openEvents(page);
        await view(page, map, CTB1_VIEW.center, CTB1_VIEW.zoom);
        const pad = await pixelNow(map, CTB1);
        await page.mouse.click(pad[0], pad[1]);
        await expect(page.locator('.maplibregl-popup .mapstudio-popup--default')).toHaveAttribute('data-point-id', ids.ctb1, { timeout: POPUP_MS });
        await expect(map).toHaveAttribute('data-selected', ids.ctb1);
        expect(await countIs(page, LABELS.item, 1)).toBe(ids.ctb1 + '|CTB1|pad');
        await expectPage(page, ids.ctb1, 'CTB1');
        const center = await map.getAttribute('data-center');
        await page.waitForTimeout(SETTLE_MS);
        // The row chosen by the map's event wrote the id the map holds: nothing more happens.
        expect((await counted(page, LABELS.item)).count).toBe(1);
        await expect(map).toHaveAttribute('data-center', center);
        await expect(map).toHaveAttribute('data-selected', ids.ctb1);
        expect(watched.warnings, 'Map Studio warnings').toEqual([]);
    });

    editorTest('line: L-SWD\'s id written fits it with its line popup; onPopupOpen names the segment', async ({ page, watched }) => {
        const map = await openEvents(page);
        const before = await counts(page);
        await pageWrites(page, ids.line);
        const popup = page.locator('.maplibregl-popup .mapstudio-popup--line');
        await expect(popup).toBeVisible({ timeout: POPUP_MS });
        await expect(map).toHaveAttribute('data-selected', ids.line);
        await expect(map).toHaveAttribute('data-selected-kind', 'line');
        // Opened at the line's middle, between PT-1 (1,143 m) and PT-2 (2,841 m) on the 2,922 m line: their segment.
        await expect(map).toHaveAttribute('data-segment', ids.pt1 + '|' + ids.pt2);
        expect(await countIs(page, LABELS.open, before.open + 1)).toBe(ids.line + '|' + ids.pt1 + ',' + ids.pt2);
        expect(await countIs(page, LABELS.item, before.item + 1)).toBe(ids.line + '|L-SWD|line');
        await expectPage(page, ids.line, 'L-SWD');
        // Fitted: both ends inside the map.
        const box = await map.boundingBox();
        for (const end of [CTB1, SWD1]) {
            const [x, y] = await pixelNow(map, end);
            expect(x).toBeGreaterThan(box.x);
            expect(x).toBeLessThan(box.x + box.width);
            expect(y).toBeGreaterThan(box.y);
            expect(y).toBeLessThan(box.y + box.height);
        }
        expect(watched.warnings, 'Map Studio warnings').toEqual([]);
    });

    editorTest('unknown or null: "nope" clears the selection with one warning naming it; null closes the popup', async ({ page, watched }) => {
        const map = await openEvents(page);
        await pageWrites(page, ids.p14);
        await expect(page.locator('.maplibregl-popup .mapstudio-popup--default')).toHaveAttribute('data-point-id', ids.p14, { timeout: POPUP_MS });
        expect(await countIs(page, LABELS.item, 1)).toBe(ids.p14 + '|Point 2|pad');
        await expectPage(page, ids.p14, 'Point 2');
        const before = await counts(page);

        await pageWrites(page, 'nope');
        await expect(map).toHaveAttribute('data-selected', '');
        await expectNoPopup(page, map);
        expect(await countIs(page, LABELS.close, before.close + 1)).toBe(ids.p14);
        expect(await countIs(page, LABELS.item, before.item + 1)).toBe('none');
        await page.waitForTimeout(WARNING_SETTLE_MS);
        expect(watched.warnings.length, watched.warnings.join('\n')).toBe(1);
        expect(watched.warnings[0]).toContain('The page selected nope, which is not on the map');

        // P14 again, then null: the popup closes and the selection goes.
        await pageWrites(page, ids.p14);
        await expect(page.locator('.maplibregl-popup .mapstudio-popup--default')).toHaveAttribute('data-point-id', ids.p14, { timeout: POPUP_MS });
        await expectPage(page, ids.p14, 'Point 2');
        await pageWritesNull(page);
        await expect(map).toHaveAttribute('data-selected', '');
        await expectNoPopup(page, map);
        expect(await countIs(page, LABELS.close, before.close + 2)).toBe(ids.p14);
        await expectPage(page, null, null);
        await page.waitForTimeout(WARNING_SETTLE_MS);
        expect(watched.warnings.length, 'still the one warning').toBe(1);
    });

    editorTest('viewport: a pan fires one onViewportChanged at its end, none during it, and the viewport prop is equal to it',
        async ({ page, watched }) => {
            const map = await openEvents(page);
            await expect(map).toHaveAttribute('data-viewport', /"center"/, { timeout: REPLY_MS });
            // At the first settle the prop and the event carry the map's viewport.
            await expect.poll(async () => (await counted(page, LABELS.viewport)).last, { timeout: REPLY_MS })
                .toBe(viewportWords(await map.getAttribute('data-viewport')));
            await expect(page.locator('#mapstudio-events-viewport')).toHaveText('viewport: ' + viewportWords(await map.getAttribute('data-viewport')),
                { timeout: REPLY_MS });
            await page.waitForTimeout(SETTLE_MS);
            const before = await counted(page, LABELS.viewport);
            const start = await map.getAttribute('data-viewport');

            // A drag pan held still before the release: nothing during it. Pressed in the map's lower middle, clear of its controls.
            const box = await map.boundingBox();
            const from = [box.x + box.width / 2 + 100, box.y + box.height / 2 + 150];
            await page.mouse.move(from[0], from[1]);
            await page.mouse.down();
            await page.mouse.move(from[0] - 60, from[1] - 30, { steps: 6 });
            await page.mouse.move(from[0] - 180, from[1] - 90, { steps: 12 });
            await page.waitForTimeout(SETTLE_MS);
            expect((await counted(page, LABELS.viewport)).count, 'no onViewportChanged during the move').toBe(before.count);
            await expect(map).toHaveAttribute('data-viewport', start);
            await page.mouse.up();

            // One at its end, with the bounds; the prop equal to it.
            const last = await countIs(page, LABELS.viewport, before.count + 1);
            const now = await map.getAttribute('data-viewport');
            expect(now).not.toBe(start);
            expect(last).toBe(viewportWords(now));
            await expect(page.locator('#mapstudio-events-viewport')).toHaveText('viewport: ' + last, { timeout: REPLY_MS });
            const v = JSON.parse(now);
            expect(v.bounds[0][0]).toBeLessThan(v.center[0]);
            expect(v.bounds[1][0]).toBeGreaterThan(v.center[0]);
            expect(v.bounds[0][1]).toBeLessThan(v.center[1]);
            expect(v.bounds[1][1]).toBeGreaterThan(v.center[1]);
            // Dragged up and left: the map looks further east and south.
            expect(v.center[0]).toBeGreaterThan(JSON.parse(start).center[0]);
            expect(v.center[1]).toBeLessThan(JSON.parse(start).center[1]);
            await page.waitForTimeout(SETTLE_MS);
            expect((await counted(page, LABELS.viewport)).count, 'one onViewportChanged').toBe(before.count + 1);
            expect(watched.warnings, 'Map Studio warnings').toEqual([]);
        });

    editorTest('Edit mode: CTB1\'s id written selects it with Details, no popup and no onPopupOpen', async ({ page, watched }) => {
        const map = await openEvents(page);
        await page.locator('.mapstudio-edit-switch-button').click();
        await expect(map).toHaveAttribute('data-studio', 'on');
        const before = await counts(page);
        await pageWrites(page, ids.ctb1);
        await expectDetails(page, map, ids.ctb1, 'CTB1');
        await expectNoPopup(page, map);
        expect(await countIs(page, LABELS.item, before.item + 1)).toBe(ids.ctb1 + '|CTB1|pad');
        await expectPage(page, ids.ctb1, 'CTB1');
        await page.waitForTimeout(SETTLE_MS);
        await expectNoPopup(page, map);
        expect((await counted(page, LABELS.open)).count, 'no onPopupOpen in Edit mode').toBe(before.open);
        expect(watched.warnings, 'Map Studio warnings').toEqual([]);
    });

    editorTest('tool in hand: with the Line tool holding two points the write waits and the drawing goes on; CTB1 with Details once the tool is down',
        async ({ page, watched }) => {
            const map = await openEvents(page);
            await page.locator('.mapstudio-edit-switch-button').click();
            await expect(map).toHaveAttribute('data-studio', 'on');
            await view(page, map, SWD_VIEW.center, SWD_VIEW.zoom);
            const seqBefore = await map.getAttribute('data-store-seq');
            await page.locator('.mapstudio-tool--line').click();
            await expect(map).toHaveAttribute('data-tool', 'line');
            const bar = page.locator('.mapstudio-drawing-bar');
            await expect(bar).toHaveAttribute('data-points', '0');
            const a = await groundSpot(page, map);
            await page.mouse.click(a[0], a[1]);
            await expect(bar).toHaveAttribute('data-points', '1');
            await page.waitForTimeout(VERTEX_PAUSE_MS);
            const b = await groundSpot(page, map, a);
            await page.mouse.click(b[0], b[1]);
            await expect(bar).toHaveAttribute('data-points', '2');
            const before = await counts(page);

            // The page writes CTB1: it waits; the drawing is untouched and the Line tool stays in hand.
            await pageWrites(page, ids.ctb1);
            await expect(page.locator('#mapstudio-events-selected')).toHaveText('selectedItem: ' + ids.ctb1, { timeout: REPLY_MS });
            await page.waitForTimeout(SETTLE_MS);
            await expect(bar).toHaveAttribute('data-points', '2');
            await expect(map).toHaveAttribute('data-tool', 'line');
            await expect(map).toHaveAttribute('data-selected', '');
            await expect(page.locator('.mapstudio-panel')).toHaveCount(0);
            expect((await counted(page, LABELS.item)).count, 'no selection while the tool is in hand').toBe(before.item);
            // The drawing goes on: a third point.
            const c = await groundSpot(page, map, b);
            await page.mouse.click(c[0], c[1]);
            await expect(bar).toHaveAttribute('data-points', '3');

            // The tool put down (Select): the page's choice is applied, CTB1 with Details, no popup; nothing was saved.
            await page.locator('.mapstudio-tool--select').click();
            await expect(map).toHaveAttribute('data-tool', '');
            await expectDetails(page, map, ids.ctb1, 'CTB1');
            await expectNoPopup(page, map);
            expect(await countIs(page, LABELS.item, before.item + 1)).toBe(ids.ctb1 + '|CTB1|pad');
            await expect(map).toHaveAttribute('data-store-seq', seqBefore);
            expect(watched.warnings, 'Map Studio warnings').toEqual([]);
        });

    editorTest('before the items load: /events/<id> selects P14 as the view starts, and it wins over the place the map remembers',
        async ({ page, watched }) => {
            const map = await openEvents(page, '/events/' + ids.p14);
            const card = page.locator('.maplibregl-popup .mapstudio-popup--default');
            await expect(card).toHaveAttribute('data-point-id', ids.p14, { timeout: POPUP_MS });
            await expect(map).toHaveAttribute('data-selected', ids.p14);
            expect(await countIs(page, LABELS.item, 1)).toBe(ids.p14 + '|Point 2|pad');

            // Then CTB1 with its popup, from its row: the place the map remembers for this page.
            await row(page, 'CTB1').click();
            await expect(card).toHaveAttribute('data-point-id', ids.ctb1, { timeout: POPUP_MS });
            await expect(map).toHaveAttribute('data-selected', ids.ctb1);
            await page.waitForTimeout(600);

            // Away and back with the browser's back: the view starts again and the page chooses P14 before the items load.
            await page.locator('#mapstudio-events-open-edit').click();
            await expect(page).toHaveURL(/\/edit$/, { timeout: 30_000 });
            await page.goBack();
            await expect(page).toHaveURL(new RegExp('/events/' + ids.p14 + '$'));
            const back = page.locator('.mapstudio-map');
            await expect(back).toHaveAttribute('data-map-ready', 'true', { timeout: 60_000 });
            await expect(page.locator('.maplibregl-popup .mapstudio-popup--default')).toHaveAttribute('data-point-id', ids.p14, { timeout: POPUP_MS });
            await expect(back).toHaveAttribute('data-selected', ids.p14);
            await page.waitForTimeout(SETTLE_MS);
            await expect(back).toHaveAttribute('data-selected', ids.p14);
            expect(watched.warnings, 'Map Studio warnings').toEqual([]);
        });
});

test.describe('390 px', () => {
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

    editorTest('phone: the same writes open the bottom sheet as a tap does, and null closes it', async ({ page, watched }) => {
        const map = await openEvents(page);
        // The table and the labels make room for the map at phone width.
        await expect(page.locator('#mapstudio-events-table')).toBeHidden();
        await pageWrites(page, ids.p14);
        const sheet = page.locator('.mapstudio-sheet');
        await expect(sheet).toHaveAttribute('data-point-id', ids.p14, { timeout: POPUP_MS });
        await expect(map).toHaveAttribute('data-popup-mode', 'sheet');
        await expect(map).toHaveAttribute('data-selected', ids.p14);
        await expect(page.locator('.maplibregl-popup')).toHaveCount(0);
        await pageWritesNull(page);
        await expect(map).toHaveAttribute('data-selected', '');
        await expect(sheet).toHaveCount(0);
        // A line's popup is a card at every width, as a tap opens it.
        await pageWrites(page, ids.line);
        await expect(page.locator('.maplibregl-popup .mapstudio-popup--line')).toBeVisible({ timeout: POPUP_MS });
        await expect(map).toHaveAttribute('data-popup-mode', 'card');
        expect(watched.warnings, 'Map Studio warnings').toEqual([]);
    });
});
