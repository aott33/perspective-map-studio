// The item form in Details (epic 4 entry 6, R3, R12; EXPERIENCE.md Properties panel, Unlinked, No asset list or incomplete; DESIGN.md
// Properties panel): at 1366 px as the map editor, the kind's fields after Location as the dev kind list types them (a pad's Operator
// text, Wells a whole number, Status a required choice; a line's Diameter a number, Buried a checkbox). A pad with Status not set
// shows "Required" by Status and "Missing: Status" at the top; Operator typed and finished with Enter saves; Wells "abc" is refused in
// words beside the field and not saved, then 3 saves as a number; Esc puts the record's value back; Status "shut in" and a line's
// Buried each save at once, one batch and one undo step each. A refused save shows on the save status row. Operator Acme finished on a
// pad, the next pad placed with the Point tool starts with Operator Acme, named "Well pad" and unlinked. A tap with Tag set changed to
// a line valve keeps Tag; a pad changed to a tap drops its values, and Undo puts them back. A second item named P14 on another asset:
// Name underlined with the tooltip and description naming its folder, the save gone through. An item made in the dev adapter's mode tank,
// once the mode is ok again, shows "Unknown kind" with its values read only and Kind alone taking input; one linked to P99 says it is
// no longer in the asset list and counts as unlinked. The asset list's status message under Asset with the dev adapter empty, then
// incomplete. Renders of Details for the docs under E2E_DOCS=1 (AD-15). The spec puts the dev adapter back to ok and leaves the seed
// as it found it (the seed run again and the strays removed).

import { TRACER, pagePixel } from '../lib/geo.mjs';
import { randomUUID } from 'node:crypto';
import {
    DRAW_MS, EDITOR_USER, editorTest, ensureSeeded, expect, mapLoaded, openMap, removeStrays, runSeed, send, shot as shotNow, signedInContext, test,
    view
} from './fixtures.mjs';

/** The Gateway's answer to a save. */
const REPLY_MS = 20_000;
/** There is nothing to observe when nothing is sent: the time a stray batch would have to show in the map's seq. */
const NOTHING_MS = 800;
/** A spot for the items this spec makes through the test hook, out of the tracer's view (the Point tool's clicks go there). */
const AWAY = [-104.82, 39.66];
const ADAPTERS = '/adapters';
const ASSETS_FN = 'mapstudio_dev.assets';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let seed;

test.beforeAll(async ({ browser }) => {
    seed = await ensureSeeded(browser);
    await restore(browser);
});

test.afterAll(async ({ browser }) => {
    await restore(browser);
});

/** The dev adapter in mode ok, the seed's own items again and no item but the seed's. */
async function restore(browser) {
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, ADAPTERS));
        await press(page, 'ok', 'ok');
        await mapLoaded(await openMap(page, '/edit'));
        const result = await runSeed(page);
        expect(result.error, 'the seed saved').toBeUndefined();
        await removeStrays(page, seed.ids);
    } finally {
        await context.close();
    }
}

/** Press a /adapters page button and wait for its result label to report `mode` (adapters.spec.mjs). */
async function press(page, button, mode) {
    const result = page.locator('#mapstudio-dev-adapter-result');
    await page.locator('#mapstudio-dev-adapter-' + button).click();
    // refreshAdapters waits for both calls; a slow call takes up to two 5 s timeouts.
    await expect(result).toContainText(`"mode":"${mode}"`, { timeout: 60_000 });
    return JSON.parse(await result.textContent());
}

async function openEditor(page) {
    const map = await openMap(page, '/edit');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', 'full');
    await expect(map).toHaveAttribute('data-studio', 'on');
    return map;
}

/** A render for the docs once the panel has settled. */
async function shot(page, name) {
    await page.waitForTimeout(500);
    await shotNow(page, name);
}

async function seqOf(map) {
    return Number(await map.getAttribute('data-store-seq'));
}

/** The stored record of a live map item through the test hook, or undefined. */
async function stored(page, id) {
    return (await send(page, 'map.load', {})).body.items.find((i) => i.id === id && !i.deleted);
}

/** A create op of a point map item at AWAY (a little apart per `n`), unlinked unless `extra` links it. */
function pointOp(id, kind, name, n, extra = {}) {
    return { op: 'create', entity: 'item', id, baseVersion: 0, data: { kind, name, geometry: { type: 'Point',
        coordinates: [Number((AWAY[0] + n * 0.002).toFixed(6)), AWAY[1]] }, properties: {}, ...extra } };
}

/** One batch through the test hook, saved. */
async function apply(page, ops) {
    const reply = await send(page, 'edits.apply', { batchId: randomUUID(), ops });
    expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
}

/** Items made through the test hook in one batch, then their rows in the list (map.changed brings them). */
async function create(page, ops) {
    await apply(page, ops);
    for (const op of ops) {
        await expect(page.locator('.mapstudio-list-row[data-item-id="' + op.id + '"]')).toHaveCount(1, { timeout: REPLY_MS });
    }
}

/** A list row clicked: the item selected with its Details open. */
async function selectRow(page, id) {
    await page.locator('.mapstudio-list-row[data-item-id="' + id + '"]').click();
    await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', id);
}

/** A kind field's row in Details, and its input or select. */
function field(page, key) {
    const row = page.locator('.mapstudio-panel .mapstudio-field--prop[data-field="' + key + '"]');
    return { row, input: row.locator('.mapstudio-field-prop') };
}

/** One change saved as one batch: Undo names its step, and the map's seq moved on by exactly one. */
async function expectOneBatch(page, map, seqBefore, step) {
    await expect(page.locator('.mapstudio-toolbar .mapstudio-undo')).toHaveAttribute('data-step', 'Undo: ' + step, { timeout: REPLY_MS });
    await expect(map).toHaveAttribute('data-store-seq', String(seqBefore + 1), { timeout: REPLY_MS });
    await page.waitForTimeout(500);
    await expect(map).toHaveAttribute('data-store-seq', String(seqBefore + 1));
}

/** Nothing was sent: the map's seq stays where it was. */
async function expectNothingSent(page, map, seqBefore) {
    await page.waitForTimeout(NOTHING_MS);
    await expect(map).toHaveAttribute('data-store-seq', String(seqBefore));
}

/** The saves a typed pair made settled (a latitude finished as the cursor moves to Longitude saves too): nothing saving, the seq still. */
async function settled(page, map) {
    await expect(map).not.toHaveAttribute('data-save-state', 'saving', { timeout: REPLY_MS });
    await expect.poll(async () => {
        const seq = await seqOf(map);
        await page.waitForTimeout(NOTHING_MS);
        return (await seqOf(map)) === seq && (await map.getAttribute('data-save-state')) !== 'saving';
    }, { timeout: REPLY_MS }).toBe(true);
}

/** A page pixel `dx` from the map's centre and `fromTop` below its top edge now: at the tracer's view, the clear ground north of its points. */
async function spotFromTop(map, dx, fromTop) {
    const box = await map.boundingBox();
    return [box.x + box.width / 2 + dx, box.y + fromTop];
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

test.describe('1366 px', () => {
    test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });

    editorTest('a pad with Status not set: Required by Status and Missing at the top; Operator saves on Enter; Wells "abc" refused in words and not saved, 3 saved as a number; Esc puts the value back; Status chosen saves at once, one undo step',
        async ({ page }) => {
            const map = await openEditor(page);
            const id = randomUUID();
            await create(page, [pointOp(id, 'pad', 'Form pad', 0)]);
            await selectRow(page, id);
            const panel = page.locator('.mapstudio-panel');
            const undo = page.locator('.mapstudio-toolbar .mapstudio-undo');

            // The pad's fields in the kind list's order, after Location and before Asset; Status alone required.
            await expect(panel.locator('.mapstudio-field--prop')).toHaveCount(3);
            await expect(panel.locator('.mapstudio-field--prop .mapstudio-field-label')).toHaveText(['Operator', 'Wells', 'Status']);
            const operator = field(page, 'operator');
            const wells = field(page, 'wells');
            const status = field(page, 'status');
            await expect(status.row.locator('.mapstudio-field-required')).toHaveText('Required');
            await expect(operator.row.locator('.mapstudio-field-required')).toHaveCount(0);
            await expect(wells.row.locator('.mapstudio-field-required')).toHaveCount(0);
            await expect(status.input).toHaveAttribute('aria-required', 'true');
            await expect(status.input.locator('option')).toHaveText(['Not set', 'producing', 'shut in', 'abandoned']);
            await expect(status.input).toHaveValue('');
            const missing = page.locator('.mapstudio-panel-missing');
            await expect(missing).toHaveText('Missing: Status');
            const order = await panel.evaluate((el) => {
                const top = (sel) => el.querySelector(sel).getBoundingClientRect().top;
                return [top('.mapstudio-panel-missing'), top('.mapstudio-field-name'), top('.mapstudio-field--location'),
                    top('.mapstudio-field--prop[data-field="operator"]'), top('.mapstudio-field--asset')];
            });
            expect([...order].sort((a, b) => a - b)).toEqual(order);

            // Operator typed and finished with Enter: one batch with the whole properties, "edit Form pad"; the item still misses Status.
            let seq = await seqOf(map);
            await operator.input.fill('Acme');
            await operator.input.press('Enter');
            await expectOneBatch(page, map, seq, 'edit Form pad');
            expect((await stored(page, id)).properties).toEqual({ operator: 'Acme' });
            await expect(missing).toHaveText('Missing: Status');

            // Wells "abc": refused in words beside the field, the field marked, nothing sent.
            seq = await seqOf(map);
            await wells.input.fill('abc');
            await wells.input.press('Enter');
            await expect(wells.row.locator('.mapstudio-field-problem')).toHaveText('Wells takes a whole number');
            await expect(wells.input).toHaveAttribute('aria-invalid', 'true');
            await expect(wells.input).toHaveAccessibleDescription('Wells takes a whole number');
            await expectNothingSent(page, map, seq);
            await shot(page, 'mapstudio-details-fields-1366.png');
            await status.row.scrollIntoViewIfNeeded();
            await shot(page, 'mapstudio-details-required-1366.png');
            // Then 3: saved as a number, the problem gone.
            await wells.input.fill('3');
            await wells.input.press('Enter');
            await expectOneBatch(page, map, seq, 'edit Form pad');
            const saved = await stored(page, id);
            expect(saved.properties).toEqual({ operator: 'Acme', wells: 3 });
            expect(typeof saved.properties.wells).toBe('number');
            await expect(wells.row.locator('.mapstudio-field-problem')).toHaveCount(0);
            await expect(wells.input).toHaveAttribute('aria-invalid', 'false');

            // Esc puts the record's value back and saves nothing; Details stays open.
            seq = await seqOf(map);
            await operator.input.fill('Zed');
            await operator.input.press('Escape');
            await expect(operator.input).toHaveValue('Acme');
            await expect(panel).toHaveAttribute('data-item-id', id);
            await expectNothingSent(page, map, seq);
            // The Name field's Esc too (entry 6 fixed its blur, which saved the typed name).
            await page.locator('.mapstudio-field-name').fill('Not this');
            await page.locator('.mapstudio-field-name').press('Escape');
            await expect(page.locator('.mapstudio-field-name')).toHaveValue('Form pad');
            // And a typed latitude's: the point stays.
            const lat = page.locator('.mapstudio-field-lat');
            const latBefore = await lat.inputValue();
            await lat.fill('39.7');
            await lat.press('Escape');
            await expect(lat).toHaveValue(latBefore);
            await expectNothingSent(page, map, seq);

            // Status chosen: saved at once, one batch and one undo step; Missing goes.
            await status.input.selectOption('shut in');
            await expectOneBatch(page, map, seq, 'edit Form pad');
            expect((await stored(page, id)).properties).toEqual({ operator: 'Acme', wells: 3, status: 'shut in' });
            await expect(missing).toHaveCount(0);
            await expect(panel).toHaveAttribute('data-missing', '');
            // One Undo puts Status back to not set, one batch.
            seq = await seqOf(map);
            await undo.click();
            await expect(map).toHaveAttribute('data-store-seq', String(seq + 1), { timeout: REPLY_MS });
            await expect.poll(async () => (await stored(page, id)).properties, { timeout: REPLY_MS }).toEqual({ operator: 'Acme', wells: 3 });
            await expect(status.input).toHaveValue('');
            await expect(missing).toHaveText('Missing: Status');
        });

    editorTest('a line\'s Buried ticked saves at once and Diameter takes a decimal, each one undo step', async ({ page }) => {
        const map = await openEditor(page);
        const id = randomUUID();
        await create(page, [{ op: 'create', entity: 'item', id, baseVersion: 0, data: { kind: 'line', name: 'Form line', properties: {},
            geometry: { type: 'LineString', coordinates: [AWAY, [AWAY[0] + 0.01, AWAY[1] + 0.004]] } } }]);
        await selectRow(page, id);
        const diameter = field(page, 'diameter');
        const buried = field(page, 'buried');
        await expect(page.locator('.mapstudio-panel .mapstudio-field--prop')).toHaveCount(2);
        await expect(buried.input).toHaveAttribute('type', 'checkbox');
        await expect(buried.input).not.toBeChecked();
        await expect(page.locator('.mapstudio-panel-missing')).toHaveCount(0);

        let seq = await seqOf(map);
        await buried.input.check();
        await expectOneBatch(page, map, seq, 'edit Form line');
        expect((await stored(page, id)).properties).toEqual({ buried: true });
        await expect(buried.input).toBeChecked();

        seq = await seqOf(map);
        await diameter.input.fill('six');
        await diameter.input.press('Enter');
        await expect(diameter.row.locator('.mapstudio-field-problem')).toHaveText('Diameter (in) takes a number');
        await expectNothingSent(page, map, seq);
        await diameter.input.fill('4.5');
        await diameter.input.press('Tab');
        await expectOneBatch(page, map, seq, 'edit Form line');
        expect((await stored(page, id)).properties).toEqual({ buried: true, diameter: 4.5 });

        // Undo, newest first, one batch each: Diameter goes, then Buried.
        const undo = page.locator('.mapstudio-toolbar .mapstudio-undo');
        seq = await seqOf(map);
        await undo.click();
        await expect.poll(async () => (await stored(page, id)).properties, { timeout: REPLY_MS }).toEqual({ buried: true });
        await expect(undo).toHaveAttribute('data-step', 'Undo: edit Form line', { timeout: REPLY_MS });
        await undo.click();
        await expect.poll(async () => (await stored(page, id)).properties, { timeout: REPLY_MS }).toEqual({});
        await expect(map).toHaveAttribute('data-store-seq', String(seq + 2), { timeout: REPLY_MS });
        await expect(buried.input).not.toBeChecked();
        await expect(diameter.input).toHaveValue('');
    });

    editorTest('a refused save shows on the save status row, and nothing of it is written', async ({ page }) => {
        // The page's websocket is routed so the test can hold the Gateway's map.changed frames (delete.spec.mjs): another save of
        // the pad commits while this page does not know of it yet, so the field's update carries the version before it.
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
        const id = randomUUID();
        await create(page, [pointOp(id, 'pad', 'Refused pad', 1)]);
        await selectRow(page, id);
        const pad = await stored(page, id);
        holding = true;
        const other = await send(page, 'edits.apply', { batchId: randomUUID(), ops: [{ op: 'update', entity: 'item', id,
            baseVersion: pad.version, data: { properties: { operator: 'Other' } } }] });
        expect(other.type, JSON.stringify(other.body)).toBe('edits.apply.reply');
        const operator = field(page, 'operator');
        await operator.input.fill('Acme');
        await operator.input.press('Enter');
        const row = page.locator('.mapstudio-panel-save--row');
        await expect(row).toHaveAttribute('data-code', 'conflict', { timeout: REPLY_MS });
        await expect(row).toContainText('Refused pad');
        await expect(map).toHaveAttribute('data-save-state', 'refused');
        holding = false;
        for (const message of held.splice(0)) {
            toPage.send(message);
        }
        expect((await stored(page, id)).properties).toEqual({ operator: 'Other' });
        // The refused edit waits under the row with Discard, as any refused edit does.
        await page.locator('.mapstudio-panel-problem--edits').click();
        await page.locator('.mapstudio-unsaved-discard').first().click();
        await expect(map).toHaveAttribute('data-unsaved-count', '0', { timeout: REPLY_MS });
    });

    editorTest('Operator Acme finished on a pad: the next pad placed starts with Operator Acme, named Well pad, unlinked; its other fields blank',
        async ({ page }) => {
            const map = await openEditor(page);
            await view(page, map, TRACER.center, TRACER.zoom);
            const first = await placePad(page, map, await spotFromTop(map, -120, 220));
            const operator = field(page, 'operator');
            await expect(operator.input).toHaveValue('');
            const seq = await seqOf(map);
            await operator.input.fill('Acme');
            await operator.input.press('Enter');
            await expectOneBatch(page, map, seq, 'edit Well pad');
            expect((await stored(page, first)).properties).toEqual({ operator: 'Acme' });

            // The next pad, by the same tool: created with Operator Acme in the same create, its name the kind's, no link.
            const second = await placePad(page, map, await spotFromTop(map, 80, 220));
            expect(second).not.toBe(first);
            const made = await stored(page, second);
            expect(made).toMatchObject({ kind: 'pad', name: 'Well pad', assetId: null, version: 1, properties: { operator: 'Acme' } });
            await expect(field(page, 'operator').input).toHaveValue('Acme');
            await expect(field(page, 'wells').input).toHaveValue('');
            await expect(field(page, 'status').input).toHaveValue('');
            await expect(page.locator('.mapstudio-field-name')).toHaveValue('Well pad');
            await expect(page.locator('.mapstudio-field-asset')).toHaveValue('');
            await expect(page.locator('.mapstudio-panel-missing')).toHaveText('Missing: Status');
            await page.locator('.mapstudio-tool--select').click();
            await expect(map).toHaveAttribute('data-tool', '');
        });

    editorTest('a tap with Tag set changed to a line valve keeps Tag; a pad changed to a tap drops its values in the same update, and Undo puts them back',
        async ({ page }) => {
            const map = await openEditor(page);
            const tap = randomUUID();
            const pad = randomUUID();
            await create(page, [pointOp(tap, 'tap', 'Form tap', 2, { properties: { tag: 'PT-9' } }),
                pointOp(pad, 'pad', 'Form pad 2', 3, { properties: { operator: 'Acme', wells: 2, status: 'producing' } })]);
            const kind = page.locator('.mapstudio-panel .mapstudio-field-kind');
            const undo = page.locator('.mapstudio-toolbar .mapstudio-undo');

            await selectRow(page, tap);
            await expect(field(page, 'tag').input).toHaveValue('PT-9');
            let seq = await seqOf(map);
            await kind.selectOption('valve');
            await expectOneBatch(page, map, seq, 'edit Form tap');
            expect(await stored(page, tap)).toMatchObject({ kind: 'valve', properties: { tag: 'PT-9' } });
            await expect(page.locator('.mapstudio-panel-subline')).toContainText('Line valve');
            await expect(field(page, 'tag').input).toHaveValue('PT-9');

            await selectRow(page, pad);
            seq = await seqOf(map);
            await kind.selectOption('tap');
            await expectOneBatch(page, map, seq, 'edit Form pad 2');
            const dropped = await stored(page, pad);
            expect(dropped.kind).toBe('tap');
            expect(dropped.properties).toEqual({});
            await expect(page.locator('.mapstudio-panel .mapstudio-field--prop')).toHaveCount(1);
            await expect(field(page, 'tag').input).toHaveValue('');
            // Undo: the kind and every value back, one batch.
            seq = await seqOf(map);
            await undo.click();
            await expect(map).toHaveAttribute('data-store-seq', String(seq + 1), { timeout: REPLY_MS });
            await expect.poll(async () => {
                const back = await stored(page, pad);
                return [back.kind, back.properties];
            }, { timeout: REPLY_MS }).toEqual(['pad', { operator: 'Acme', wells: 2, status: 'producing' }]);
            await expect(kind).toHaveValue('pad');
            await expect(field(page, 'operator').input).toHaveValue('Acme');
            await expect(field(page, 'wells').input).toHaveValue('2');
            await expect(field(page, 'status').input).toHaveValue('producing');
        });

    editorTest('a second item named P14 on another asset: Name underlined with a tooltip and description naming the other; the save goes through',
        async ({ page }) => {
            const map = await openEditor(page);
            const a = randomUUID();
            const b = randomUUID();
            await create(page, [pointOp(a, 'pad', 'P14', 4, { assetId: 'P14', properties: { status: 'producing' } }),
                pointOp(b, 'pad', 'Form B', 5, { assetId: 'P15', properties: { status: 'producing' } })]);
            await selectRow(page, b);
            const name = page.locator('.mapstudio-field-name');
            await expect(name).not.toHaveClass(/mapstudio-field-name--twin/);
            const seq = await seqOf(map);
            await name.fill(' p14 ');
            // Underlined as it is typed, before it is finished.
            await expect(name).toHaveClass(/mapstudio-field-name--twin/);
            await name.press('Enter');
            await expectOneBatch(page, map, seq, 'rename p14');
            expect((await stored(page, b)).name).toBe('p14');
            await expect(name).toHaveValue('p14');
            await expect(name).toHaveAttribute('title', 'Also the name of the item linked to Mesa/P14');
            await expect(name).toHaveAccessibleDescription('Also the name of the item linked to Mesa/P14');
            await expect(name).toHaveAccessibleName('Name');
            const underline = await name.evaluate((el) => {
                const s = getComputedStyle(el);
                return { line: s.textDecorationLine, color: s.textDecorationColor };
            });
            expect(underline.line).toBe('underline');
            const error = await page.locator('.mapstudio').evaluate((el) => {
                const probe = document.createElement('span');
                probe.style.color = 'var(--error)';
                el.appendChild(probe);
                const c = getComputedStyle(probe).color;
                probe.remove();
                return c;
            });
            expect(underline.color).toBe(error);
            await shot(page, 'mapstudio-details-duplicate-1366.png');

            // The other one says so too, naming this one's asset.
            await selectRow(page, a);
            await expect(name).toHaveAttribute('title', 'Also the name of the item linked to Mesa/P15');
            // On the same asset, nothing: B linked to P14 as well.
            await selectRow(page, b);
            await page.locator('.mapstudio-field-asset').selectOption('P14');
            await expect(page.locator('.mapstudio-toolbar .mapstudio-undo')).toHaveAttribute('data-step', 'Undo: link p14', { timeout: REPLY_MS });
            await expect(name).not.toHaveClass(/mapstudio-field-name--twin/);
            await expect(name).not.toHaveAttribute('title', /.*/);
        });

    editorTest('a kind no longer in the kind list shows Unknown kind with its values read only, Kind alone taking input; an asset no longer in the asset list says so and counts as unlinked',
        async ({ page }) => {
            test.setTimeout(240_000);
            const tank = randomUUID();
            const ghost = randomUUID();
            // Made while the dev adapter lists a tank kind (the Gateway checks a save against the list it has now); then the mode is
            // ok again and tank is gone from the kind list. The Gateway does not check an asset id, so P99 is linked as it is.
            await mapLoaded(await openMap(page, ADAPTERS));
            try {
                const r = await press(page, 'tank', 'tank');
                expect(r.kinds.count).toBe(6);
                await apply(page, [pointOp(tank, 'tank', 'Form tank', 6, { properties: { capacity: 400 } }),
                    pointOp(ghost, 'pad', 'Form P99', 7, { assetId: 'P99', properties: { status: 'producing' } })]);
                expect(await stored(page, tank)).toMatchObject({ kind: 'tank', properties: { capacity: 400 } });
            } finally {
                await press(page, 'ok', 'ok');
            }
            const map = await openEditor(page);

            // The tank: Unknown kind, the sentence, its value read only; Name, Location and Asset take no input, Kind does.
            await selectRow(page, tank);
            const panel = page.locator('.mapstudio-panel');
            await expect(panel).toHaveAttribute('data-kind-known', 'false');
            const kind = panel.locator('.mapstudio-field-kind');
            await expect(kind.locator('option:checked')).toHaveText('Unknown kind');
            await expect(panel.locator('.mapstudio-field-kind-hint')).toHaveText('tank is no longer in the kind list; its values are kept');
            await expect(kind).toHaveAccessibleDescription('tank is no longer in the kind list; its values are kept');
            await expect(panel.locator('.mapstudio-field--stored[data-field="capacity"] .mapstudio-field-stored')).toHaveText('400');
            await expect(panel.locator('.mapstudio-field-prop')).toHaveCount(0);
            await expect(panel.locator('.mapstudio-field-name')).toBeDisabled();
            await expect(panel.locator('.mapstudio-field-lat')).toBeDisabled();
            await expect(panel.locator('.mapstudio-field-asset')).toBeDisabled();
            await expect(kind).toBeEnabled();
            await expect(page.locator('.mapstudio-panel-subline')).toHaveText('Unknown kind - not linked');
            await shot(page, 'mapstudio-details-unknown-kind-1366.png');

            // The asset P99, not in the asset list: said under Asset, the stored link kept, counted unlinked in the list with the reason.
            await selectRow(page, ghost);
            await expect(panel.locator('.mapstudio-field--asset')).toHaveAttribute('data-vanished', 'true');
            await expect(panel.locator('.mapstudio-field-asset-hint')).toHaveText('Not linked: P99 is no longer in the asset list');
            await expect(panel.locator('.mapstudio-field-asset')).toHaveValue('P99');
            await expect(page.locator('.mapstudio-panel-subline')).toHaveText('Well pad - not linked');
            const row = page.locator('.mapstudio-list-row[data-item-id="' + ghost + '"]');
            await expect(row).toHaveAttribute('data-state', 'unlinked');
            await expect(row.locator('.mapstudio-badge--unlinked')).toHaveAttribute('title', 'P99 is no longer in the asset list');
            expect((await stored(page, ghost)).assetId).toBe('P99');

            // The tank's Kind changed to a pad: the value the pad does not define dropped in the same update; the pad's fields show.
            await selectRow(page, tank);
            const seq = await seqOf(map);
            await kind.selectOption('pad');
            await expectOneBatch(page, map, seq, 'edit Form tank');
            const now = await stored(page, tank);
            expect(now.kind).toBe('pad');
            expect(now.properties).toEqual({});
            await expect(panel).toHaveAttribute('data-kind-known', 'true');
            await expect(panel.locator('.mapstudio-panel-missing')).toHaveText('Missing: Status');
            await expect(panel.locator('.mapstudio-field-name')).toBeEnabled();
        });

    editorTest('the asset list\'s status under Asset: the dev adapter empty, then incomplete, says so; ok says nothing', async ({ page }) => {
        test.setTimeout(240_000);
        const point2 = seed.ids['tracer/p2'];
        const note = page.locator('.mapstudio-panel .mapstudio-field-asset-status');
        try {
            await mapLoaded(await openMap(page, ADAPTERS));
            await press(page, 'empty', 'empty');
            await openEditor(page);
            await selectRow(page, point2);
            await expect(note).toHaveText(`The asset function ${ASSETS_FN} returned no assets.`);
            await expect(note).toHaveAttribute('data-status', 'empty');
            // An empty list is a real answer: Point 2's asset P14 is not in it, and with no kind list its kind is unknown.
            await expect(page.locator('.mapstudio-panel .mapstudio-field-asset-hint')).toHaveText('Not linked: P14 is no longer in the asset list');
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-kind-known', 'false');
            await shot(page, 'mapstudio-details-asset-list-empty-1366.png');

            await mapLoaded(await openMap(page, ADAPTERS));
            await press(page, 'incomplete', 'incomplete');
            await openEditor(page);
            await selectRow(page, point2);
            await expect(note).toHaveText(`2 of 12 assets from ${ASSETS_FN} left out: row 11 (id P99): basePath does not start with a`
                + ' [provider]; row 12 (id T1): kind tank is not in the kind list.');
            await expect(note).toHaveAttribute('data-status', 'incomplete');
            await expect(page.locator('.mapstudio-panel .mapstudio-field-asset-hint')).toHaveText('Live values come from the linked asset\'s tags.');
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-kind-known', 'true');
        } finally {
            await mapLoaded(await openMap(page, ADAPTERS));
            await press(page, 'ok', 'ok');
        }
        await openEditor(page);
        await selectRow(page, point2);
        await expect(page.locator('.mapstudio-panel .mapstudio-field--asset')).toBeVisible();
        await expect(note).toHaveCount(0);
    });

    // The place check (epic 4 entry 27, R13; EXPERIENCE.md Place a point; docs/place-check.md): the plan's matrix.

    editorTest('the place line follows a typed pair and the saved point: a county, a town, a parish, a state line, the sea; swapped values flagged and nothing saved until they read',
        async ({ page }) => {
            const map = await openEditor(page);
            const id = randomUUID();
            await create(page, [pointOp(id, 'pad', 'Place pad', 8)]);
            await selectRow(page, id);
            const location = page.locator('.mapstudio-panel .mapstudio-field--location');
            const place = location.locator('.mapstudio-field-place');
            const lat = location.locator('.mapstudio-field-lat');
            const lng = location.locator('.mapstudio-field-lng');
            const pair = async (a, b) => {
                await lat.fill(String(a));
                await lng.fill(String(b));
            };

            // The saved point first (Aurora, Colorado), under the hint, in the secondary text colour, the sources in its tooltip.
            await expect(place).toHaveText('Arapahoe County, Colorado, US', { timeout: REPLY_MS });
            await expect(place).toHaveAttribute('data-place', 'found');
            await expect(place).toHaveAttribute('title', 'Places: Natural Earth, GeoNames (CC BY 4.0)');
            await expect(lat).toHaveAccessibleDescription('Arapahoe County, Colorado, US');
            const below = await location.evaluate((el) => el.querySelector('.mapstudio-field-place').getBoundingClientRect().top
                - el.querySelector('.mapstudio-field-hint').getBoundingClientRect().bottom);
            expect(below).toBeGreaterThanOrEqual(0);
            const colours = await place.evaluate((el) => {
                const probe = document.createElement('span');
                probe.style.color = 'var(--neutral-70)';
                el.parentElement.appendChild(probe);
                const secondary = getComputedStyle(probe).color;
                probe.remove();
                return { line: getComputedStyle(el).color, secondary };
            });
            expect(colours.line).toBe(colours.secondary);

            // A US county, as typed and before it is finished; then finished with Enter: saved, and the saved point reads the same.
            await pair(32.7, -103.1);
            await expect(place).toHaveText('Lea County, New Mexico, US');
            await shot(page, 'mapstudio-details-place-1366.png');
            await lng.press('Enter');
            await expect.poll(async () => (await stored(page, id)).geometry.coordinates, { timeout: REPLY_MS }).toEqual([-103.1, 32.7]);
            await expect(page.locator('.mapstudio-toolbar .mapstudio-undo')).toHaveAttribute('data-step', 'Undo: move Place pad', { timeout: REPLY_MS });
            await expect(place).toHaveText('Lea County, New Mexico, US');

            // Elsewhere, a parish, a point by the Texas line, offshore with a shore within 200 km, and offshore with none.
            await pair(55.17, -118.8);
            await expect(place).toHaveText('Near Grande Prairie, Alberta, CA');
            await pair(29.64, -90.54);
            await expect(place).toHaveText('Lafourche Parish, Louisiana, US');
            await pair(32.5, -103.07);
            await expect(place).toHaveText('Lea County (near the Texas line), New Mexico, US');
            await pair(28.5, -90.5);
            await expect(place).toHaveText('Gulf of Mexico, off Louisiana, US');
            await pair(30.0, -40.0);
            await expect(place).toHaveText('North Atlantic Ocean');
            // Esc puts the saved longitude back (the latitude, 30, was saved as the cursor left it), and the place line follows the saved
            // point again: 30, -90.5, in Louisiana.
            await settled(page, map);
            await lng.press('Escape');
            await expect(lng).toHaveValue('-90.5');
            await expect(place).toContainText('Louisiana, US');
            expect((await stored(page, id)).geometry.coordinates).toEqual([-90.5, 30]);

            // Swapped: flagged in words, the hint keeps its instruction, nothing is saved until the pair reads.
            const before = (await stored(page, id)).geometry.coordinates;
            const seq = await seqOf(map);
            await pair(-103.1, 32.7);
            await expect(place).toHaveText('Latitude and longitude look swapped');
            await expect(place).toHaveAttribute('data-place', 'swapped');
            await expect(location.locator('.mapstudio-field-hint')).toHaveText('Drag the pin to fine-tune, or type latitude and longitude.');
            await expect(lat).toHaveAttribute('aria-invalid', 'true');
            await lng.press('Enter');
            await expectNothingSent(page, map, seq);
            expect((await stored(page, id)).geometry.coordinates).toEqual(before);
            await shot(page, 'mapstudio-details-place-swapped-1366.png');
            // Out of range otherwise: the hint as before, no place line.
            await pair(95, 100);
            await expect(location.locator('.mapstudio-field-hint')).toHaveText('Latitude is -90 to 90 and longitude -180 to 180.');
            await expect(place).toHaveCount(0);
            await expect(location).toHaveAttribute('data-place', 'out-of-range');
            await lng.press('Enter');
            await expectNothingSent(page, map, seq);
            // Read: saved.
            await pair(32.7, -103.1);
            await lng.press('Enter');
            await expect.poll(async () => (await stored(page, id)).geometry.coordinates, { timeout: REPLY_MS }).toEqual([-103.1, 32.7]);
            await expect(place).toHaveText('Lea County, New Mexico, US');
        });

    editorTest('the place data: no request before Details, one when CTB1\'s Details first shows its location and none after, at most 5 MB as served; a line asks nothing',
        async ({ page }) => {
            const asked = [];
            page.on('request', (request) => {
                if (new URL(request.url()).pathname === '/res/mapstudio/places.json') {
                    asked.push(request);
                }
            });
            await openEditor(page);
            // The editor open with no Details yet, a line's Details opened: nothing asked.
            await selectRow(page, seed.ids['swd/line']);
            await expect(page.locator('.mapstudio-panel .mapstudio-field-place')).toHaveCount(0);
            await page.waitForTimeout(NOTHING_MS);
            expect(asked).toHaveLength(0);

            await selectRow(page, seed.ids['swd/ctb1']);
            const place = page.locator('.mapstudio-panel .mapstudio-field-place');
            await expect(place).toHaveText('Denver County, Colorado, US', { timeout: REPLY_MS });
            expect(asked).toHaveLength(1);
            const response = await asked[0].response();
            expect(response.status()).toBe(200);
            expect(response.headers()['content-type'] || '').toContain('json');
            const sizes = await asked[0].sizes();
            const encoding = response.headers()['content-encoding'] || 'none';
            test.info().annotations.push({ type: 'places.json as served', description: sizes.responseBodySize + ' bytes, content-encoding '
                + encoding + ', ' + (await response.body()).length + ' bytes decoded' });
            expect(sizes.responseBodySize).toBeGreaterThan(0);
            expect(sizes.responseBodySize).toBeLessThanOrEqual(5_000_000);

            // Another point's Details, and CTB1's again: the data kept, nothing asked.
            await selectRow(page, seed.ids['swd/swd1']);
            await expect(place).toHaveAttribute('data-place', 'found');
            await selectRow(page, seed.ids['swd/ctb1']);
            await expect(place).toHaveText('Denver County, Colorado, US');
            await page.waitForTimeout(NOTHING_MS);
            expect(asked).toHaveLength(1);
        });

    editorTest('Zoom to location on CTB1: the map at CTB1 at zoom 15 or more, the point in view, CTB1 still selected with Details open',
        async ({ page }) => {
            const map = await openEditor(page);
            const ctb1 = seed.ids['swd/ctb1'];
            await selectRow(page, ctb1);
            const at = (await stored(page, ctb1)).geometry.coordinates;
            // Away from CTB1 and zoomed out, with Details open.
            await view(page, map, [at[0] + 0.6, at[1] - 0.4], 9);
            const zoom = page.locator('.mapstudio-panel .mapstudio-field-zoom');
            await expect(zoom).toHaveText('Zoom to location');
            await expect(zoom).toHaveAttribute('title', 'Zoom to location: the map moves to the saved point');
            // Beside Move, before it.
            const [zoomBox, moveBox] = [await zoom.boundingBox(), await page.locator('.mapstudio-panel .mapstudio-field-move').boundingBox()];
            expect(Math.abs(zoomBox.y - moveBox.y)).toBeLessThan(2);
            expect(zoomBox.x + zoomBox.width).toBeLessThanOrEqual(moveBox.x);
            const seq = await seqOf(map);
            await zoom.click();
            await expect.poll(async () => Number(await map.getAttribute('data-zoom')), { timeout: DRAW_MS }).toBeGreaterThanOrEqual(15);
            // The point in the map's view, clear of the top row, once the move has settled.
            await expect.poll(async () => {
                const box = await map.boundingBox();
                const center = (await map.getAttribute('data-center')).split(',').map(Number);
                const [x, y] = pagePixel(box, at, center, Number(await map.getAttribute('data-zoom')));
                return x > box.x + 40 && x < box.x + box.width - 40 && y > box.y + 80 && y < box.y + box.height - 40;
            }, { timeout: DRAW_MS }).toBe(true);
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', ctb1);
            await expect(page.locator('.mapstudio-list-row--selected')).toHaveAttribute('data-item-id', ctb1);
            // A camera move only: nothing saved.
            await expectNothingSent(page, map, seq);
        });

    editorTest('the place data missing: "The place check is not available", swapped values still flagged, and the form still saves',
        async ({ page, watched }) => {
            // The file answered 404, as from a module built without it.
            await page.route('**/res/mapstudio/places.json', (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' }));
            await missingPlaces(page);
            // The browser's own line for the 404 is the case under test: exactly one, taken out; any other error still fails the test.
            const missing = watched.errors.filter((e) => /Failed to load resource: the server responded with a status of 404/.test(e));
            expect(missing, 'the browser\'s line for the missing place data').toHaveLength(1);
            watched.errors.splice(watched.errors.indexOf(missing[0]), 1);
            expect(watched.warnings.filter((w) => w.includes('The place check is not available: /res/mapstudio/places.json answered 404')))
                .toHaveLength(1);
        });
});

/** The missing-data case's steps (the test above routes the file to a 404 first). */
async function missingPlaces(page) {
    const map = await openEditor(page);
    const id = randomUUID();
    await create(page, [pointOp(id, 'pad', 'No place pad', 9)]);
    await selectRow(page, id);
    const place = page.locator('.mapstudio-panel .mapstudio-field-place');
    await expect(place).toHaveText('The place check is not available', { timeout: REPLY_MS });
    await expect(place).toHaveAttribute('data-place', 'unavailable');
    // A field saves as ever: one batch.
    let seq = await seqOf(map);
    const operator = field(page, 'operator');
    await operator.input.fill('Acme');
    await operator.input.press('Enter');
    await expectOneBatch(page, map, seq, 'edit No place pad');
    // So does a typed place; the swap rule needs no data.
    const lat = page.locator('.mapstudio-panel .mapstudio-field-lat');
    const lng = page.locator('.mapstudio-panel .mapstudio-field-lng');
    await lat.fill('-103.1');
    await lng.fill('32.7');
    await expect(place).toHaveText('Latitude and longitude look swapped');
    await lat.fill('32.7');
    await lng.fill('-103.1');
    await expect(place).toHaveText('The place check is not available');
    seq = await seqOf(map);
    await lng.press('Enter');
    await expect.poll(async () => (await stored(page, id)).geometry.coordinates, { timeout: REPLY_MS }).toEqual([-103.1, 32.7]);
    expect(await seqOf(map)).toBeGreaterThan(seq);
}
