// The status box retired (epic 4 entry 24; owner, 2026-11-05: "yes to both", then "a" after the mocks): the box over the
// map's bottom edge is gone at every width, its click echo and success words with it, and every problem it showed is said in
// words where the mode says it: in Edit mode on the list header's save status row, the edits waiting opening under it with
// Try again, Discard and Hide; in View mode on the top-centre chip that says "No connection - values from 14:02", one problem
// at a time, the worst first (no connection, the store or the setup, the edits, a read-only store, the storage warning), a
// viewer seeing only what concerns the map. The plan's matrix at 1366 and 390 px; the map store's problems are made
// deterministic by routing the page's websockets through the test (lib/sockets.mjs), as unsaved.spec.mjs does. A save, a
// click and No connection on its own are the tracer's, studio's, drawing's and connection's specs. Renders under E2E_DOCS=1.

import { randomUUID } from 'node:crypto';
import { TRACER } from '../lib/geo.mjs';
import { DOWN_MESSAGE, openGate, routeSockets } from '../lib/sockets.mjs';
import {
    EDITOR_USER, chipLines, drawLine, editorTest, expect, mapLoaded, nextFrames, openMap, send, shot, test, watch
} from './fixtures.mjs';

const PROJECT = 'mapstudio-dev';
const KEY = `mapstudio.unsaved.v1:${PROJECT}:${EDITOR_USER}`;
/** The component's reply timeout is 15 s, its load retry and replay every 15 s; an assertion waits a little longer. */
const RETRY_MS = 35_000;
/** The Gateway's sentence for a setup it cannot read (setup.spec.mjs makes the real one). */
const SETUP = 'The Map Studio setup of project mapstudio-dev cannot be read: refreshIntervalSeconds must be a whole number from 1 to 3600, not "ten".';
const READ_ONLY = 'The map store was upgraded by a newer Map Studio (schema 999, this module knows 2); saving is off until the module is upgraded.';
/** How long the simulated loss lasts (the client's `__client.simulateLostConnection`). */
const LOST_S = 6;

/**
 * The client logs its own failed reconnect attempts while a lost connection is simulated ("Hello API call failed ...
 * Simulated disconnect", as connection.spec.mjs and studio.spec.mjs filter them); any other console or page error fails.
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

const row = (page) => page.locator('.mapstudio-panel-save--row');
const chip = (page) => page.locator('.mapstudio-chip');

async function openEditor(page) {
    const map = await openMap(page, '/edit');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-studio', 'on');
    return map;
}

/** The queue as stored for the map editor. */
async function storedQueue(page) {
    return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '[]'), KEY);
}

/**
 * Make the open map send map.load (a gap): a stray line created and deleted through the test hook with the first of their two
 * map.changed dropped, so nothing is left on the map. The routed reply then says what the gate says.
 */
async function forceLoad(page, gate) {
    const id = randomUUID();
    gate.dropChanged = 1;
    const geometry = { type: 'LineString', coordinates: [TRACER.points.p1.lngLat, TRACER.points.p3.lngLat] };
    const created = await send(page, 'edits.apply', {
        batchId: randomUUID(), ops: [{ op: 'create', entity: 'item', id, baseVersion: 0, data: { kind: 'line', name: 'Gap line', geometry } }]
    });
    expect(created.type, JSON.stringify(created.body)).toBe('edits.apply.reply');
    const removed = await send(page, 'edits.apply', {
        batchId: randomUUID(), ops: [{ op: 'delete', entity: 'item', id, baseVersion: created.body.results[0].version }]
    });
    expect(removed.type, JSON.stringify(removed.body)).toBe('edits.apply.reply');
}

/**
 * Watch `selector` on every frame across one 15 s load retry (the gate counts the failed loads): how many frames it was
 * missing, and the words it showed. "No blink across the 15 s retries" (the plan's matrix): no gap, one set of words.
 */
async function acrossRetry(page, gate, selector) {
    await page.evaluate((sel) => {
        const w = window;
        w.__problemWatch = { gaps: 0, frames: 0, texts: [], on: true };
        const tick = () => {
            const watchState = w.__problemWatch;
            if (!watchState.on) return;
            watchState.frames++;
            const el = document.querySelector(sel);
            if (!el) {
                watchState.gaps++;
            } else if (watchState.texts.indexOf(el.textContent) < 0) {
                watchState.texts.push(el.textContent);
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, selector);
    const before = gate.failedLoads;
    await expect.poll(() => gate.failedLoads, { timeout: RETRY_MS }).toBeGreaterThan(before);
    await nextFrames(page);
    await nextFrames(page);
    return page.evaluate(() => {
        const watchState = window.__problemWatch;
        watchState.on = false;
        return { gaps: watchState.gaps, frames: watchState.frames, texts: watchState.texts };
    });
}

/** The chip's box within the map and clear of the zoom card. */
async function expectChipClear(page, map) {
    const box = await chip(page).boundingBox();
    const mapBox = await map.boundingBox();
    const zoom = await page.locator('.mapstudio-zoom').boundingBox();
    expect(box.x, 'the chip inside the map').toBeGreaterThanOrEqual(mapBox.x);
    expect(box.x + box.width, 'the chip inside the map').toBeLessThanOrEqual(mapBox.x + mapBox.width);
    expect(Math.abs(box.x + box.width / 2 - (mapBox.x + mapBox.width / 2)), 'the chip centred over the map').toBeLessThanOrEqual(1);
    if (zoom) {
        const apart = box.x + box.width <= zoom.x || box.y >= zoom.y + zoom.height || box.y + box.height <= zoom.y;
        expect(apart, 'the chip clear of the zoom card').toBe(true);
    }
}

test.describe('1366 px', () => {
    test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });

    editorTest('the store unreachable and a setup that cannot be read: the save status row in Edit mode, the chip in View mode, no blink across the retries',
        async ({ page, context }) => {
            test.setTimeout(240_000);
            const gate = openGate();
            await routeSockets(context, gate);
            const map = await openEditor(page);
            // Nothing wrong: the header says Saved beside the name, no row, no chip, no box.
            await expect(page.locator('.mapstudio-panel-save')).toHaveText('Saved');
            await expect(row(page)).toHaveCount(0);
            await expect(chip(page)).toHaveCount(0);
            await expect(page.locator('.mapstudio-reply')).toHaveCount(0);

            // The store stops answering: the next load fails. Edit mode: the row says so in words, the toolbar paused.
            gate.failLoad = 'down';
            await forceLoad(page, gate);
            await expect(map).toHaveAttribute('data-store-state', 'unavailable', { timeout: RETRY_MS });
            await expect(map).toHaveAttribute('data-load-message', 'store-unreachable: ' + DOWN_MESSAGE);
            await expect(map).toHaveAttribute('data-editing', 'off');
            await expect(page.locator('.mapstudio-toolbar-float')).toHaveClass(/mapstudio-toolbar-float--paused/);
            const store = row(page).locator('[data-problem="store"]');
            await expect(store).toHaveText('Map store: ' + DOWN_MESSAGE);
            await expect(row(page)).toHaveAttribute('data-problems', 'store');
            await expect(page.locator('.mapstudio-dock-title-row .mapstudio-panel-save')).toHaveCount(0);
            // In Edit mode the chip is the connection's alone.
            await expect(chip(page)).toHaveCount(0);
            await shot(page, 'mapstudio-problem-edit-store-1366.png');
            // Each 15 s retry loads again: the row keeps its words through it, frame by frame, and the toolbar stays paused.
            const edit = await acrossRetry(page, gate, '.mapstudio-panel-save--row [data-problem="store"]');
            console.log('Edit mode across a retry: ' + edit.frames + ' frames, ' + edit.gaps + ' without the row');
            expect(edit.frames).toBeGreaterThan(10);
            expect(edit.gaps, 'the row never blinks').toBe(0);
            expect(edit.texts).toEqual(['Map store: ' + DOWN_MESSAGE]);
            await expect(map).toHaveAttribute('data-editing', 'off');

            // View mode: the chip says it, in its look and place, the same words its title.
            await page.locator('.mapstudio-edit-switch-button').click();
            await expect(map).toHaveAttribute('data-studio', 'off');
            const viewChip = page.locator('.mapstudio-chip[data-problem="store"]');
            await expect(viewChip).toHaveText('Map store: ' + DOWN_MESSAGE);
            await expect(viewChip).toHaveAttribute('title', 'Map store: ' + DOWN_MESSAGE);
            await expect(viewChip).toHaveAttribute('role', 'status');
            await expect(viewChip.locator('.mapstudio-chip-glyph')).toHaveCount(1);
            await expect(chip(page)).not.toHaveClass(/mapstudio-connection/);
            await expectChipClear(page, map);
            expect(await chipLines(viewChip)).toEqual({ lines: 1, cut: false });
            await shot(page, 'mapstudio-problem-view-store-1366.png');
            const view = await acrossRetry(page, gate, '.mapstudio-chip[data-problem="store"]');
            console.log('View mode across a retry: ' + view.frames + ' frames, ' + view.gaps + ' without the chip');
            expect(view.gaps, 'the chip never blinks').toBe(0);
            expect(view.texts).toEqual(['Map store: ' + DOWN_MESSAGE]);

            // A setup that cannot be read: its reason on the chip, on two lines at most, the full words its title.
            gate.failLoad = SETUP;
            await expect(viewChip).toHaveText('Map store: ' + SETUP, { timeout: RETRY_MS });
            await expect(viewChip).toHaveAttribute('title', 'Map store: ' + SETUP);
            expect((await chipLines(viewChip)).lines, 'two lines at most').toBeLessThanOrEqual(2);
            await expectChipClear(page, map);
            await shot(page, 'mapstudio-problem-view-setup-1366.png');
            // And on the row in Edit mode, in full.
            await page.locator('.mapstudio-edit-switch-button').click();
            await expect(map).toHaveAttribute('data-studio', 'on');
            await expect(row(page).locator('[data-problem="store"]')).toHaveText('Map store: ' + SETUP);
            await shot(page, 'mapstudio-problem-edit-setup-1366.png');

            // The store is back: the next retry loads, editing comes back on and the problem goes.
            gate.failLoad = null;
            await expect(map).toHaveAttribute('data-load-state', 'loaded', { timeout: RETRY_MS });
            await expect(map).toHaveAttribute('data-editing', 'on');
            await expect(row(page)).toHaveCount(0);
            await expect(page.locator('.mapstudio-panel-save')).toHaveText('Saved');
            await expect(chip(page)).toHaveCount(0);
        });

    lossTest('edits waiting and a read-only store: the row with the waiting edits under it, Try again, Discard and Hide; the chip for the editor in View mode, after No connection',
        async ({ page, context }) => {
            test.setTimeout(240_000);
            const gate = openGate();
            await routeSockets(context, gate);
            let map = await openEditor(page);

            // Two lines the Gateway never sees: unsent once the 15 s reply timer runs out.
            gate.drop = true;
            await drawLine(page, map, { dy: -200 });
            await drawLine(page, map, { dy: -140 });
            await expect.poll(async () => (await storedQueue(page)).length).toBe(2);
            // While they are being sent no problem shows: the header says Saving...
            const waiting = row(page).locator('[data-problem="edits"]');
            await expect(waiting).toHaveText('Store unreachable - 2 edits not saved', { timeout: RETRY_MS });
            await expect(map).toHaveAttribute('data-save-state', 'unsent');
            await expect(waiting).toHaveAttribute('aria-expanded', 'false');
            const list = page.locator('.mapstudio-unsaved');
            await expect(list).toHaveCount(0);

            // The row opens the waiting edits under it, each in words with Try again (it has a reason) and Discard, then Hide.
            await waiting.click();
            await expect(waiting).toHaveAttribute('aria-expanded', 'true');
            await expect(list).toBeVisible();
            const rows = list.locator('.mapstudio-unsaved-row');
            await expect(rows).toHaveCount(2);
            for (const r of await rows.all()) {
                await expect(r).toHaveAttribute('data-unsaved-state', 'unsent');
                await expect(r.locator('.mapstudio-unsaved-text')).toHaveText(/^Not saved - store unreachable/);
                await expect(r.locator('.mapstudio-unsaved-retry')).toHaveText('Try again');
                await expect(r.locator('.mapstudio-unsaved-discard')).toHaveText('Discard');
            }
            await expect(list.locator('.mapstudio-unsaved-hide')).toHaveText('Hide');
            // Inside the dock, under the row and above the search field.
            const dock = await page.locator('.mapstudio-dock--items').boundingBox();
            const listBox = await list.boundingBox();
            const rowBox = await row(page).boundingBox();
            expect(listBox.x).toBeGreaterThanOrEqual(dock.x);
            expect(listBox.x + listBox.width).toBeLessThanOrEqual(dock.x + dock.width);
            expect(listBox.y).toBeGreaterThanOrEqual(rowBox.y + rowBox.height);
            expect(listBox.y + listBox.height).toBeLessThanOrEqual((await page.locator('.mapstudio-list-search').boundingBox()).y);
            await shot(page, 'mapstudio-problem-edit-edits-1366.png');

            // Hide closes it, the focus back on the row's line; Enter opens it again and Esc closes it, going no further.
            await list.locator('.mapstudio-unsaved-hide').click();
            await expect(list).toHaveCount(0);
            await expect(waiting).toBeFocused();
            await page.keyboard.press('Enter');
            await expect(list).toBeVisible();
            await list.locator('.mapstudio-unsaved-hide').focus();
            await page.keyboard.press('Escape');
            await expect(list).toHaveCount(0);
            await expect(waiting).toBeFocused();
            await expect(page.locator('.mapstudio-panel')).toBeVisible();

            // Discard one (not the one a replay may be sending): one waits.
            await waiting.click();
            await list.locator('.mapstudio-unsaved-discard:enabled').first().click();
            await expect(rows).toHaveCount(1);
            await expect(waiting).toHaveText('Store unreachable - 1 edit not saved');
            const [kept] = await storedQueue(page);
            const keptId = kept.batch.ops[0].id;

            // View mode, the editor's: the chip names the edits, with no list.
            await page.locator('.mapstudio-edit-switch-button').click();
            await expect(map).toHaveAttribute('data-studio', 'off');
            await expect(page.locator('.mapstudio-chip[data-problem="edits"]')).toHaveText('Store unreachable - 1 edit not saved');
            await expect(list).toHaveCount(0);
            await expectChipClear(page, map);
            await shot(page, 'mapstudio-problem-view-edits-1366.png');

            // No connection comes first; when it is back the chip names the edits again.
            await page.evaluate((s) => window.__client.simulateLostConnection(s), LOST_S);
            await expect(map).toHaveAttribute('data-connection', 'lost', { timeout: 10_000 });
            await expect(page.locator('.mapstudio-chip[data-problem="connection"]')).toHaveText(/^No connection - /);
            await expect(chip(page)).toHaveClass(/mapstudio-connection/);
            await expect(map).toHaveAttribute('data-connection', 'ok', { timeout: (LOST_S + 30) * 1000 });
            await expect(page.locator('.mapstudio-chip[data-problem="edits"]')).toHaveText('Store unreachable - 1 edit not saved', { timeout: RETRY_MS });

            // The Gateway hears the saves again: the replay saves the kept line and the chip goes.
            gate.drop = false;
            await expect(map).toHaveAttribute('data-unsaved-count', '0', { timeout: RETRY_MS });
            await expect(chip(page)).toHaveCount(0);

            // A read-only store (the routed map.load.reply says so): the row in Edit mode, the chip for this editor in View mode.
            gate.readOnly = READ_ONLY;
            await page.reload({ waitUntil: 'load' });
            map = await openMap(page, '/edit');
            await mapLoaded(map);
            if ((await map.getAttribute('data-studio')) !== 'on') {
                // The switch wrote editMode false before the reload; on again for the row.
                await page.locator('.mapstudio-edit-switch-button').click();
            }
            await expect(map).toHaveAttribute('data-studio', 'on');
            await expect(map).toHaveAttribute('data-store-state', 'read-only');
            await expect(map).toHaveAttribute('data-store-reason', READ_ONLY);
            await expect(row(page).locator('[data-problem="read-only"]')).toHaveText('Map store: read only. ' + READ_ONLY);
            await shot(page, 'mapstudio-problem-edit-readonly-1366.png');
            await page.locator('.mapstudio-edit-switch-button').click();
            await expect(map).toHaveAttribute('data-studio', 'off');
            const readOnly = page.locator('.mapstudio-chip[data-problem="read-only"]');
            await expect(readOnly).toHaveText('Map store: read only. ' + READ_ONLY);
            expect((await chipLines(readOnly)).lines).toBeLessThanOrEqual(2);
            await expectChipClear(page, map);
            await shot(page, 'mapstudio-problem-view-readonly-1366.png');

            // The line saved by the replay leaves the map for the specs after this one.
            gate.readOnly = null;
            const stored = (await send(page, 'map.load', {})).body.items.find((i) => i.id === keptId);
            expect(stored, 'the kept line was saved by the replay').toBeDefined();
            const removed = await send(page, 'edits.apply', {
                batchId: randomUUID(), ops: [{ op: 'delete', entity: 'item', id: keptId, baseVersion: stored.version }]
            });
            expect(removed.type, JSON.stringify(removed.body)).toBe('edits.apply.reply');
        });
});

test.describe('390 px', () => {
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

    editorTest('the phone keeps View mode: the chip names the edits waiting, then the setup that cannot be read, worst first, on two lines',
        async ({ page, context }) => {
            test.setTimeout(240_000);
            const gate = openGate();
            await routeSockets(context, gate);
            // No drawing tool below 768 px (epic 4 entry 4): the line is drawn at a laptop width and the phone width comes back.
            await page.setViewportSize({ width: 1366, height: 768 });
            const map = await openEditor(page);
            gate.drop = true;
            await drawLine(page, map, { dy: -200 });
            await expect.poll(async () => (await storedQueue(page)).length).toBe(1);
            const [entry] = await storedQueue(page);
            await page.setViewportSize({ width: 390, height: 844 });
            const edits = page.locator('.mapstudio-chip[data-problem="edits"]');
            await expect(edits).toHaveText('Store unreachable - 1 edit not saved', { timeout: RETRY_MS });
            await expect(map).toHaveAttribute('data-studio', 'off');
            await expect(page.locator('.mapstudio-unsaved')).toHaveCount(0);
            await expect(page.locator('.mapstudio-reply')).toHaveCount(0);
            await expectChipClear(page, map);
            const box = await chip(page).boundingBox();
            expect(box.y, 'under the one top bar').toBeGreaterThanOrEqual((await map.boundingBox()).y + 56);
            await shot(page, 'mapstudio-problem-phone-edits-390.png');

            // Only that line's saves are taken out now, so the hook's reach the Gateway; the next load fails on the setup, which
            // comes before the edits: its long words wrap to two lines, the rest cut and in the title.
            gate.dropBatch = entry.batchId;
            gate.drop = false;
            gate.failLoad = SETUP;
            await forceLoad(page, gate);
            const setup = page.locator('.mapstudio-chip[data-problem="store"]');
            await expect(setup).toHaveAttribute('title', 'Map store: ' + SETUP, { timeout: RETRY_MS });
            await expect(setup).toHaveText('Map store: ' + SETUP);
            expect(await chipLines(setup)).toEqual({ lines: 2, cut: true });
            await expectChipClear(page, map);
            await shot(page, 'mapstudio-problem-phone-setup-390.png');

            // The setup fixed: the next retry loads and the edits are the worst again; then the replay saves the line.
            gate.failLoad = null;
            await expect(edits).toHaveText('Store unreachable - 1 edit not saved', { timeout: RETRY_MS });
            gate.dropBatch = null;
            await expect(map).toHaveAttribute('data-unsaved-count', '0', { timeout: RETRY_MS });
            await expect(chip(page)).toHaveCount(0);
            const lineId = entry.batch.ops[0].id;
            const stored = (await send(page, 'map.load', {})).body.items.find((i) => i.id === lineId);
            expect(stored, 'the kept line was saved by the replay').toBeDefined();
            const removed = await send(page, 'edits.apply', {
                batchId: randomUUID(), ops: [{ op: 'delete', entity: 'item', id: lineId, baseVersion: stored.version }]
            });
            expect(removed.type, JSON.stringify(removed.body)).toBe('edits.apply.reply');
        });
});

for (const [width, height] of [[1366, 768], [390, 844]]) {
    test.describe(`${width} px, a viewer`, () => {
        test.use({ viewport: { width, height }, deviceScaleFactor: 1 });

        test('a viewer sees only what concerns the map: the store unreachable on the chip, never a read-only store', async ({ page, context }) => {
            const gate = openGate();
            await routeSockets(context, gate);
            gate.readOnly = READ_ONLY;
            let map = await openMap(page, '/');
            await mapLoaded(map);
            await expect(map).toHaveAttribute('data-edit-level', 'none');
            await expect(map).toHaveAttribute('data-store-state', 'read-only');
            await expect(map).toHaveAttribute('data-store-reason', READ_ONLY);
            await expect(chip(page)).toHaveCount(0);
            await expect(page.locator('.mapstudio-reply')).toHaveCount(0);

            gate.readOnly = null;
            gate.failLoad = 'down';
            await page.reload({ waitUntil: 'load' });
            map = await openMap(page, '/');
            await expect(map).toHaveAttribute('data-store-state', 'unavailable', { timeout: 60_000 });
            const store = page.locator('.mapstudio-chip[data-problem="store"]');
            await expect(store).toHaveText('Map store: ' + DOWN_MESSAGE);
            await expectChipClear(page, map);
            await shot(page, `mapstudio-problem-viewer-store-${width}.png`);
        });
    });
}
