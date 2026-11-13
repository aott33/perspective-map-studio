// Save states and the unsaved list (epic 4 entry 10, R26; EXPERIENCE.md Save and store states; the key-screen-9 mocks): one card
// on the map under the toolbar for a conflict (who changed what and when, my change kept, "Use <name>'s version" and "Apply mine
// on top"), for the store unreachable (the edits kept, the toolbar faded and inert, Try again, Show my N edits) and for busy
// (Try again, Discard my change); the save status row keeps its words and its list; a second tab replays another tab's unsent
// batch within 15 s, no reload. At 1366 px.
//
// The replies are faked through the socket gate (lib/sockets.mjs `failSave`, the planner's pick 7): an edits.apply is answered
// store-unreachable (the busy sentence, or the store out of reach) by the test, never reaching the Gateway. A conflict is real:
// the phone editor's save in a second browser commits while this page's map.changed for it is dropped, so this page's next
// edit carries the version before it. A real PostgreSQL stop runs only when asked: MAPSTUDIO_STORE_STOP=1.

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { envFileValue } from '../lib/env.mjs';
import { BUSY_MESSAGE, openGate, routeSockets } from '../lib/sockets.mjs';
import {
    EDITOR_USER, OPERATOR_USER, drawLine, editorTest, expect, mapLoaded, openMap, send, shot, signedInContext, test, REPLY_MS, KEY, selectRow, stored,
    storedQueue
} from './fixtures.mjs';

const REPLAY_MS = 30_000;
/** A spot for the items this spec makes through the test hook, out of the tracer's view. */
const AWAY = [-104.84, 39.64];
/** About 40 m of latitude. */
const NORTH_40M = 40 / 111_195;

async function openEditor(page) {
    const map = await openMap(page, '/edit');
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', 'full');
    await expect(map).toHaveAttribute('data-studio', 'on');
    return map;
}

/** A create op of a pad at AWAY, a little apart per `n`. */
function padOp(id, name, n) {
    return { op: 'create', entity: 'item', id, baseVersion: 0, data: { kind: 'pad', name, geometry: { type: 'Point',
        coordinates: [Number((AWAY[0] + n * 0.002).toFixed(6)), AWAY[1]] }, properties: {} } };
}

/** Pads made through the test hook in one batch, then their rows in the list. */
async function createPads(page, pads) {
    const reply = await send(page, 'edits.apply', { batchId: randomUUID(), ops: pads.map(([id, name], n) => padOp(id, name, n)) });
    expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
    for (const [id] of pads) {
        await expect(page.locator('.mapstudio-list-row[data-item-id="' + id + '"]')).toHaveCount(1, { timeout: REPLY_MS });
    }
}

/** The pad's Operator field finished with Enter: one update through the queue. */
async function setOperator(page, id, value) {
    await selectRow(page, id);
    const input = page.locator('.mapstudio-panel .mapstudio-field--prop[data-field="operator"] .mapstudio-field-prop');
    await input.fill(value);
    await input.press('Enter');
}

/** The phone editor (a second browser) moves the pad about 40 m north; this page's map.changed for it is dropped by `gate`. */
async function operatorMoves(opPage, page, gate, id) {
    const pad = await stored(page, id);
    gate.dropChanged = 1;
    const [lng, lat] = pad.geometry.coordinates;
    const reply = await send(opPage, 'edits.apply', { batchId: randomUUID(), ops: [{ op: 'update', entity: 'item', id,
        baseVersion: pad.version, data: { geometry: { type: 'Point', coordinates: [lng, Number((lat + NORTH_40M).toFixed(6))] } } }] });
    expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
    await expect.poll(() => gate.dropChanged, { timeout: REPLY_MS }).toBe(0);
    return pad.version + 1;
}

/** Whether the focus is inside the save card. */
async function focusInCard(page) {
    return page.evaluate(() => !!(document.activeElement && document.activeElement.closest('.mapstudio-save-card')));
}

/**
 * Tab from the map until the focus is in the card (R10: Tab reaches its buttons); false if it never gets there. It starts on the
 * map's canvas, which is always focusable and comes before the toolbar and the card in the page's order: the toolbar's buttons
 * are disabled while editing is paused (a disabled button takes no focus, so starting there left the focus on the page's body,
 * and Tab then had to walk the whole item list first, which grows as the suite adds items).
 */
async function tabIntoCard(page) {
    const canvas = page.locator('.mapstudio-map canvas').first();
    await canvas.focus();
    await expect(canvas).toBeFocused();
    for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Tab');
        if (await focusInCard(page)) {
            return true;
        }
    }
    return false;
}

editorTest.describe('save states at 1366 px', () => {
    // Every action is bounded: a field that is disabled (editing paused) fails the step in 20 s with its reason.
    editorTest.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, actionTimeout: REPLY_MS });

    editorTest('R1 to R3, R10: the conflict card names the other editor\'s change; Use theirs drops mine; Apply mine on top saves it, undone back to theirs',
        async ({ page, context, browser }) => {
            editorTest.setTimeout(300_000);
            const gate = openGate();
            await routeSockets(context, gate);
            const map = await openEditor(page);
            const id = randomUUID();
            const name = 'Conflict pad ' + id.slice(0, 4);
            await createPads(page, [[id, name]]);
            const operator = await signedInContext(browser, OPERATOR_USER, { viewport: { width: 390, height: 844 } });
            try {
                const opPage = await operator.newPage();
                await mapLoaded(await openMap(opPage, '/edit'));

                // R1: the phone editor moves it; this page's edit carries the version before, and is refused.
                let version = await operatorMoves(opPage, page, gate, id);
                await setOperator(page, id, 'Acme');
                const card = page.locator('.mapstudio-save-card');
                await expect(card).toHaveAttribute('data-card', 'conflict', { timeout: REPLY_MS });
                await expect(card).toHaveAttribute('role', 'alert');
                const [entry] = await storedQueue(page);
                await expect(card).toHaveAttribute('data-batch-id', entry.batchId);
                expect(entry.conflict[0]).toMatchObject({ id, changedBy: OPERATOR_USER, current: { version } });
                expect(entry.before[0]).toMatchObject({ id, version: version - 1 });
                await expect(card.locator('.mapstudio-save-card-title')).toHaveText(`Not saved - conflict with ${OPERATOR_USER}'s change`);
                await expect(card.locator('.mapstudio-save-card-text'))
                    .toHaveText(new RegExp(`^${OPERATOR_USER} moved ${name} about \\d+ (m|ft) north at \\d\\d:\\d\\d, while you were editing it\\.$`));
                await expect(card.locator('.mapstudio-save-card-kept')).toHaveText('Your change, kept here and not saved: Operator Acme.');
                await expect(card.locator('.mapstudio-save-card-theirs')).toHaveText(`Use ${OPERATOR_USER}'s version`);
                await expect(card.locator('.mapstudio-save-card-ontop')).toHaveText('Apply mine on top');
                // The row keeps its words.
                await expect(page.locator('.mapstudio-panel-save--row [data-problem="edits"]'))
                    .toContainText(`1 edit not saved - conflict with ${OPERATOR_USER}'s change.`);
                // R10: the card took no focus; Tab reaches its buttons.
                expect(await focusInCard(page)).toBe(false);
                await shot(page, 'mapstudio-savestates-conflict-1366.png');
                expect(await tabIntoCard(page)).toBe(true);

                // R2: Use theirs: my entry goes, the card and the row with it, the stored version stays.
                await card.locator('.mapstudio-save-card-theirs').click();
                await expect(card).toHaveCount(0);
                await expect(map).toHaveAttribute('data-unsaved-count', '0');
                await expect(page.locator('.mapstudio-panel-save--row')).toHaveCount(0);
                expect(await storedQueue(page)).toEqual([]);
                let now = await stored(page, id);
                expect(now.version).toBe(version);
                expect(now.properties.operator).toBeUndefined();

                // R3: again, and Apply mine on top: a new batch at the stored version saves; the item shows mine on theirs.
                version = await operatorMoves(opPage, page, gate, id);
                await setOperator(page, id, 'Acme');
                await expect(card).toHaveAttribute('data-card', 'conflict', { timeout: REPLY_MS });
                const refused = (await storedQueue(page))[0].batchId;
                // Every batch id the page writes to its queue from here, to tell the batch Apply mine on top sends.
                await page.evaluate((key) => {
                    const w = window;
                    w.__queuedIds = [];
                    const setItem = Storage.prototype.setItem;
                    Storage.prototype.setItem = function (k, v) {
                        if (k === key) {
                            try {
                                for (const e of JSON.parse(v)) w.__queuedIds.push(e.batchId);
                            } catch (err) { /* not a queue */ }
                        }
                        return setItem.call(this, k, v);
                    };
                }, KEY);
                await card.locator('.mapstudio-save-card-ontop').click();
                await expect(card).toHaveCount(0, { timeout: REPLY_MS });
                await expect(map).toHaveAttribute('data-unsaved-count', '0', { timeout: REPLY_MS });
                await expect.poll(async () => (await stored(page, id)).version, { timeout: REPLY_MS }).toBe(version + 1);
                now = await stored(page, id);
                expect(now.properties.operator).toBe('Acme');
                const theirs = now.geometry.coordinates;
                // A new batch, not the refused one resent, saved once: one new batch id queued, and the version rose by exactly one.
                const queued = [...new Set(await page.evaluate(() => window.__queuedIds))].filter((b) => b !== refused);
                expect(queued).toHaveLength(1);
                expect(queued[0]).not.toBe(refused);
                expect(now.version).toBe(version + 1);
                // One undo step puts theirs back.
                const undo = page.locator('.mapstudio-toolbar .mapstudio-undo');
                await expect(undo).toHaveAttribute('data-step', 'Undo: edit ' + name, { timeout: REPLY_MS });
                await undo.click();
                await expect.poll(async () => (await stored(page, id)).properties.operator, { timeout: REPLY_MS }).toBeUndefined();
                expect((await stored(page, id)).geometry.coordinates).toEqual(theirs);

                // R10: a third conflict, Esc in the card closes it; the entry stays on the row.
                await operatorMoves(opPage, page, gate, id);
                await setOperator(page, id, 'Esc Co');
                await expect(card).toHaveAttribute('data-card', 'conflict', { timeout: REPLY_MS });
                expect(await tabIntoCard(page)).toBe(true);
                await page.keyboard.press('Escape');
                await expect(card).toHaveCount(0);
                await expect(map).toHaveAttribute('data-unsaved-count', '1');
                const waiting = page.locator('.mapstudio-panel-save--row [data-problem="edits"]');
                await expect(waiting).toContainText('conflict with');
                await waiting.click();
                await page.locator('.mapstudio-unsaved-discard').first().click();
                await expect(map).toHaveAttribute('data-unsaved-count', '0', { timeout: REPLY_MS });
            } finally {
                await operator.close();
            }
        });

    editorTest('R4, R5: a save answered store-unreachable: the card, the toolbar faded and inert, the items kept, Show my 2 edits; Try again saves both',
        async ({ page, context }) => {
            editorTest.setTimeout(240_000);
            const gate = openGate();
            await routeSockets(context, gate);
            const map = await openEditor(page);
            const a = randomUUID();
            const b = randomUUID();
            await createPads(page, [[a, 'Kept pad A'], [b, 'Kept pad B']]);
            const items = await map.getAttribute('data-items-loaded');
            const liveSeq = Number(await map.getAttribute('data-live-seq'));

            gate.failSave = 'down';
            await setOperator(page, a, 'Kept A');
            const card = page.locator('.mapstudio-save-card');
            await expect(card).toHaveAttribute('data-card', 'unreachable', { timeout: REPLY_MS });
            await expect(map).toHaveAttribute('data-editing', 'off');
            await expect(map).toHaveAttribute('data-save-paused', 'true');
            // The tools and Undo are off and say why; the items stay drawn, the live values keep coming.
            await expect(page.locator('.mapstudio-toolbar-float')).toHaveClass(/mapstudio-toolbar-float--paused/);
            await expect(page.locator('.mapstudio-tool--line')).toBeDisabled();
            await expect(page.locator('.mapstudio-tool--line')).toHaveAttribute('title', 'Paused - the map store is unreachable');
            await expect(page.locator('.mapstudio-toolbar .mapstudio-undo')).toBeDisabled();
            await expect(map).toHaveAttribute('data-items-loaded', items);
            await expect.poll(async () => Number(await map.getAttribute('data-live-seq')), { timeout: REPLAY_MS }).toBeGreaterThan(liveSeq);
            await expect(page.locator('.mapstudio-panel-save--row [data-problem="edits"]')).toHaveText('Store unreachable - 1 edit not saved');

            // Editing is off now, so the second edit waiting is one an earlier page left in the queue, for pad B.
            await page.evaluate(([key, item]) => {
                const list = JSON.parse(window.localStorage.getItem(key) || '[]');
                const batchId = crypto.randomUUID();
                list.push({ batchId, queuedAt: new Date().toISOString(), state: 'unsent',
                    batch: { batchId, ops: [{ op: 'update', entity: 'item', id: item.id, baseVersion: item.version, data: { properties: { operator: 'Kept B' } } }] } });
                window.localStorage.setItem(key, JSON.stringify(list));
            }, [KEY, await stored(page, b)]);
            await page.reload({ waitUntil: 'load' });
            const again = await openEditor(page);
            await expect(card).toHaveAttribute('data-card', 'unreachable', { timeout: REPLAY_MS });
            await expect(again).toHaveAttribute('data-unsaved-count', '2');
            await expect(card.locator('.mapstudio-save-card-title')).toHaveText('Store unreachable');
            await expect(card.locator('.mapstudio-save-card-text')).toHaveText('Map Studio cannot reach the map store. Your 2 edits are kept on this '
                + 'computer, not saved yet, and save when the store is back. Drawing and editing are paused; live values still update.');
            const show = card.locator('.mapstudio-save-card-show');
            await expect(show).toHaveText('Show my 2 edits');
            await shot(page, 'mapstudio-savestates-unreachable-1366.png');
            // Esc does not close it.
            expect(await tabIntoCard(page)).toBe(true);
            await page.keyboard.press('Escape');
            await expect(card).toHaveCount(1);

            // R5: Show my 2 edits opens the row's list in the dock, the focus in it.
            await show.click();
            const list = page.locator('.mapstudio-unsaved');
            await expect(list).toBeVisible();
            await expect(list.locator('.mapstudio-unsaved-row')).toHaveCount(2);
            await expect.poll(() => page.evaluate(() => !!(document.activeElement && document.activeElement.closest('.mapstudio-unsaved')))).toBe(true);

            // The store is back: Try again replays them; a save that succeeds turns editing on and the card goes.
            gate.failSave = null;
            await card.locator('.mapstudio-save-card-retry').click();
            await expect(again).toHaveAttribute('data-unsaved-count', '0', { timeout: REPLAY_MS * 2 });
            await expect(card).toHaveCount(0);
            await expect(again).toHaveAttribute('data-editing', 'on');
            await expect(page.locator('.mapstudio-tool--line')).toBeEnabled();
            expect((await stored(page, a)).properties.operator).toBe('Kept A');
            expect((await stored(page, b)).properties.operator).toBe('Kept B');
        });

    editorTest('R6: busy: the card with the change in words, editing stays on; Try again resends; Discard my change removes the dashed line',
        async ({ page, context }) => {
            editorTest.setTimeout(180_000);
            const gate = openGate();
            await routeSockets(context, gate);
            const map = await openEditor(page);
            gate.failSave = 'busy';
            await drawLine(page, map, { dy: -200 });
            const card = page.locator('.mapstudio-save-card');
            await expect(card).toHaveAttribute('data-card', 'busy', { timeout: REPLY_MS });
            await expect(card.locator('.mapstudio-save-card-title')).toHaveText('Not saved - Map Studio is busy');
            await expect(card.locator('.mapstudio-save-card-text')).toHaveText(BUSY_MESSAGE);
            await expect(card.locator('.mapstudio-save-card-kept')).toHaveText(/^Your change, kept here: Add .+\.$/);
            await expect(map).toHaveAttribute('data-editing', 'on');
            await expect(map).toHaveAttribute('data-save-paused', 'false');
            await expect(map).toHaveAttribute('data-unsaved-drawn', '1');
            await expect(page.locator('.mapstudio-panel-save--row [data-problem="edits"]')).toHaveText('1 edit not saved - Map Studio is busy');
            await page.keyboard.press('Escape');
            await shot(page, 'mapstudio-savestates-busy-1366.png');

            const tries = gate.failedSaves;
            await card.locator('.mapstudio-save-card-retry').click();
            await expect.poll(() => gate.failedSaves, { timeout: REPLY_MS }).toBeGreaterThan(tries);
            await expect(card).toHaveAttribute('data-card', 'busy', { timeout: REPLY_MS });
            await expect(card.locator('.mapstudio-save-card-discard')).toBeEnabled({ timeout: REPLY_MS });
            await card.locator('.mapstudio-save-card-discard').click();
            await expect(card).toHaveCount(0);
            await expect(map).toHaveAttribute('data-unsaved-count', '0');
            await expect(map).toHaveAttribute('data-unsaved-drawn', '0');
            expect(await storedQueue(page)).toEqual([]);
        });

    editorTest('R7: two conflicts read "1 of 2", then "2 of 2"; the store unreachable comes first', async ({ page, context, browser }) => {
        editorTest.setTimeout(240_000);
        const gate = openGate();
        await routeSockets(context, gate);
        let map = await openEditor(page);
        const a = randomUUID();
        const b = randomUUID();
        await createPads(page, [[a, 'Two pad A'], [b, 'Two pad B']]);
        // The phone editor changes both; two batches left in the queue by an earlier page carry the versions before.
        const operator = await signedInContext(browser, OPERATOR_USER, { viewport: { width: 390, height: 844 } });
        const stale = [];
        try {
            const opPage = await operator.newPage();
            await mapLoaded(await openMap(opPage, '/edit'));
            for (const id of [a, b]) {
                const pad = await stored(page, id);
                const reply = await send(opPage, 'edits.apply', { batchId: randomUUID(), ops: [{ op: 'update', entity: 'item', id,
                    baseVersion: pad.version, data: { properties: { operator: 'Phone' } } }] });
                expect(reply.type).toBe('edits.apply.reply');
                const batchId = randomUUID();
                stale.push({ batchId, queuedAt: new Date(Date.now() + stale.length).toISOString(), state: 'unsent', before: [pad],
                    batch: { batchId, ops: [{ op: 'update', entity: 'item', id, baseVersion: pad.version, data: { properties: { operator: 'Desk' } } }] } });
            }
        } finally {
            await operator.close();
        }
        await page.evaluate(([key, list]) => window.localStorage.setItem(key, JSON.stringify(list)), [KEY, stale]);
        await page.reload({ waitUntil: 'load' });
        map = await openEditor(page);
        const card = page.locator('.mapstudio-save-card');
        await expect(card).toHaveAttribute('data-batch-id', stale[0].batchId, { timeout: REPLAY_MS });
        await expect(page.locator('.mapstudio-save-card')).toHaveCount(1);
        await expect.poll(async () => (await storedQueue(page)).filter((e) => e.state === 'refused').length, { timeout: REPLAY_MS }).toBe(2);
        await expect(card).toHaveAttribute('data-position', '1 of 2');
        await expect(card.locator('.mapstudio-save-card-position')).toHaveText('1 of 2');
        await expect(card.locator('.mapstudio-save-card-text')).toHaveText(new RegExp(`^${OPERATOR_USER} changed Two pad A's Operator at `));
        await shot(page, 'mapstudio-savestates-conflict-two-1366.png');
        expect(await tabIntoCard(page)).toBe(true);
        await page.keyboard.press('Escape');
        await expect(card).toHaveAttribute('data-batch-id', stale[1].batchId);
        await expect(card).toHaveAttribute('data-position', '2 of 2');

        // A save answered store-unreachable: the unreachable card is the one shown.
        const c = randomUUID();
        await createPads(page, [[c, 'Two pad C']]);
        gate.failSave = 'down';
        await setOperator(page, c, 'Down');
        await expect(card).toHaveAttribute('data-card', 'unreachable', { timeout: REPLY_MS });
        await expect(page.locator('.mapstudio-save-card')).toHaveCount(1);
        // The two conflicts wait for a choice, not for the store: one edit saves when it is back.
        await expect(card.locator('.mapstudio-save-card-show')).toHaveText('Show my edit');

        // Clean up: the store back, the conflicts discarded.
        gate.failSave = null;
        await card.locator('.mapstudio-save-card-retry').click();
        await expect(card).toHaveAttribute('data-card', 'conflict', { timeout: REPLAY_MS });
        await page.locator('.mapstudio-panel-save--row [data-problem="edits"]').click();
        for (const e of stale) {
            await page.locator(`.mapstudio-unsaved-row[data-batch-id="${e.batchId}"] .mapstudio-unsaved-discard`).click();
        }
        await expect(map).toHaveAttribute('data-unsaved-count', '0', { timeout: REPLY_MS });
        await expect(card).toHaveCount(0);
    });

    editorTest('R8, R9: a second tab replays another tab\'s unsent batch within 15 s, no reload; a page reopened replays after map.load',
        async ({ page, context }) => {
            editorTest.setTimeout(240_000);
            // Tab B (the fixture's page) is open first; tab A's websocket alone drops every save.
            const tabB = await openEditor(page);
            const before = Number(await tabB.getAttribute('data-items-loaded'));
            const pageA = await context.newPage();
            const gateA = openGate();
            gateA.drop = true;
            await routeSockets(pageA, gateA);
            const tabA = await openEditor(pageA);
            await drawLine(pageA, tabA, { dy: -200 });
            const [entry] = await storedQueue(pageA);
            expect(entry).toBeTruthy();
            await expect(tabB).toHaveAttribute('data-unsaved-count', '1', { timeout: REPLY_MS });
            // B replays it within 15 s (and some room), with no reload: A never reaches the Gateway.
            await expect(tabB).toHaveAttribute('data-unsaved-count', '0', { timeout: REPLAY_MS });
            await expect(tabA).toHaveAttribute('data-unsaved-count', '0', { timeout: REPLY_MS });
            await expect(tabB).toHaveAttribute('data-items-loaded', String(before + 1), { timeout: REPLY_MS });
            expect(gateA.dropped).toBeGreaterThan(0);
            expect(await storedQueue(page)).toEqual([]);
            // Saved once: the same batch sent again gets the first reply, and the item is there once.
            const resend = await send(page, 'edits.apply', entry.batch);
            expect(resend.type).toBe('edits.apply.reply');
            const id = entry.batch.ops[0].id;
            const load = await send(page, 'map.load', {});
            expect(load.body.items.filter((i) => i.id === id)).toHaveLength(1);

            // R9: a page closed with an unsent batch; the next page replays it after map.load.
            await drawLine(pageA, tabA, { dy: -160 });
            await expect.poll(async () => (await storedQueue(pageA)).length).toBe(1);
            const [kept] = await storedQueue(pageA);
            await page.close();
            await pageA.close();
            const reopened = await context.newPage();
            const map = await openEditor(reopened);
            await expect(map).toHaveAttribute('data-unsaved-count', '0', { timeout: REPLAY_MS });
            expect((await send(reopened, 'map.load', {})).body.items.some((i) => i.id === kept.batch.ops[0].id)).toBe(true);
        });
});

// The acceptance check with a real store stop, run once by the orchestrator: stops and starts this checkout's PostgreSQL
// container (`<MAPSTUDIO_CONTAINER>-pg`, ops/docker-compose.yml), so it runs only when asked: MAPSTUDIO_STORE_STOP=1.
test.describe('with the PostgreSQL container stopped', () => {
    test.skip(process.env.MAPSTUDIO_STORE_STOP !== '1', 'stops the dev PostgreSQL: run with MAPSTUDIO_STORE_STOP=1');
    test.use({ viewport: { width: 1366, height: 768 }, actionTimeout: REPLY_MS });

    function docker(...args) {
        const run = spawnSync('docker', args, { encoding: 'utf8', timeout: 180_000 });
        if (run.status !== 0) throw new Error('docker ' + args[0] + ' failed: ' + (run.stderr || '').trim());
    }

    function pgRunning(container) {
        const run = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', container], { encoding: 'utf8' });
        return run.status === 0 && run.stdout.trim() === 'true';
    }

    test('two edits while the store is down: the banner, the faded toolbar, Show my 2 edits; both save once it is back', async ({ browser }) => {
        test.setTimeout(300_000);
        const base = process.env.MAPSTUDIO_CONTAINER ?? envFileValue('MAPSTUDIO_CONTAINER');
        expect(base, 'MAPSTUDIO_CONTAINER').toBeTruthy();
        const pg = base + '-pg';
        if (!pgRunning(pg)) docker('start', pg);
        const context = await signedInContext(browser, EDITOR_USER, { viewport: { width: 1366, height: 768 } });
        try {
            // Two tabs of one browser: the first answer to a save comes within a second with the store stopped (measured: about
            // 250 ms) and pauses that tab's editing (R4), so its second edit cannot be made there. The second edit is made in
            // the other tab, still editing until its own save is answered; both wait in the one queue of this browser, and the
            // first tab's card counts both (the storage event).
            const page = await context.newPage();
            const map = await openEditor(page);
            const other = await context.newPage();
            const otherMap = await openEditor(other);
            const a = randomUUID();
            const b = randomUUID();
            await createPads(page, [[a, 'Store pad A'], [b, 'Store pad B']]);
            await expect(other.locator('.mapstudio-list-row[data-item-id="' + b + '"]')).toHaveCount(1, { timeout: REPLY_MS });
            docker('stop', pg);
            try {
                await setOperator(page, a, 'Down A');
                const card = page.locator('.mapstudio-save-card');
                await expect(card).toHaveAttribute('data-card', 'unreachable', { timeout: 60_000 });
                await expect(map).toHaveAttribute('data-save-paused', 'true');
                await expect(page.locator('.mapstudio-toolbar-float')).toHaveClass(/mapstudio-toolbar-float--paused/);
                await setOperator(other, b, 'Down B');
                await expect(other.locator('.mapstudio-save-card')).toHaveAttribute('data-card', 'unreachable', { timeout: 60_000 });
                await expect(otherMap).toHaveAttribute('data-save-paused', 'true');
                await expect(map).toHaveAttribute('data-unsaved-count', '2', { timeout: REPLY_MS });
                const show = card.locator('.mapstudio-save-card-show');
                await expect(show).toHaveText('Show my 2 edits');
                await show.click();
                await expect(page.locator('.mapstudio-unsaved .mapstudio-unsaved-row')).toHaveCount(2);
                console.log('Store stopped: the card says "' + (await card.locator('.mapstudio-save-card-text').textContent()) + '"');
                await shot(page, 'mapstudio-savestates-store-stopped-1366.png');
                await other.close();
            } finally {
                if (!pgRunning(pg)) docker('start', pg);
            }
            // The paused page replays every 15 s; the first replay after the store is back saves both, one after the other.
            await expect(map).toHaveAttribute('data-unsaved-count', '0', { timeout: 120_000 });
            await expect(map).toHaveAttribute('data-editing', 'on');
            await expect(map).toHaveAttribute('data-save-paused', 'false');
            await expect(page.locator('.mapstudio-save-card')).toHaveCount(0);
            expect((await stored(page, a)).properties.operator).toBe('Down A');
            expect((await stored(page, b)).properties.operator).toBe('Down B');
        } finally {
            if (!pgRunning(pg)) docker('start', pg);
            await context.close().catch(() => {});
        }
    });
});
