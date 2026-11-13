// Details' Live now block and per-item path overrides (epic 4 entry 12c1, R5; DESIGN.md Properties panel and Override tag,
// EXPERIENCE.md Override mark; docs/kind-setup.md "Overridden from Details"): at 1366 px as the map editor, the plan's matrix.
// Point 1 (the seed's pad on asset P12; the plan's "P12") shows Comms, Pressure (the icon value, starred), Flow and Alarms with
// their live values and the pad kind's paths filled for it, under "From kind", and follows the Gateway with no reload (L1). Its
// Pressure path overridden to Point 2's asset's ([default]Mesa/P14/Pressure; the plan's "P14") saves at once, carries Override
// and Reset, shows P14's pressure in this map and in a second open one, leaves the other pads alone and is counted in the kind's
// header (L2); Flow is overridden too (L3); a path that is not full (below {asset.path}, with no provider, a provider alone)
// says so in the Gateway's words and sends nothing (L6; a Gateway refusal's words beside the field, L7, are Jest's,
// itemOverridesDelegate.test.ts, since the browser sends nothing the Gateway refuses for its form); Undo names the override by its part and
// Recent changes lists it so, with Revert (L8); Comms and Alarms keep the kind's switches (L5); Reset returns each row to the
// kind, the last one leaving no `kpis` (L4). An unlinked pad shows the paths as written and still saves an override (L10); an
// item with overrides that changes kind is saved with none and one Undo restores both (L9); a stored link override is neither
// marked nor counted and stays stored when another override is saved (L11); an item of a kind with no setup shows one line and
// the button to its setup (L12). Renders of the block, an override and a path not taken for the docs under E2E_DOCS=1. The spec leaves
// the seed and the dev tags as it found them.

import { randomUUID } from 'node:crypto';
import {
    EDITOR_USER, editorTest, ensureSeeded, expect, mapLoaded, openMap, removeStrays, runSeed, send, shot as shotNow, signedInContext, test, REPLY_MS,
    liveItem, seqOf, selectRow, expectNothingSent, press, stored, apply, openDev, undo, openItems, padCount
} from './fixtures.mjs';

const LIVE_MS = 30_000;
/** A spot for the items this spec makes through the test hook, out of the tracer's view. */
const AWAY = [-104.82, 39.66];
const P12 = '[default]Mesa/P12';
const P14 = '[default]Mesa/P14';
const NOT_FULL = ' is not a tag path; use a full path such as [default]Shared/GasPrice.';

let seed;

/** The dev tags this spec drives in their quiet state: P12 at 400 psi with no alarm, P14 at 400 psi, comms on, nothing unacknowledged. */
async function quiet(page) {
    await press(page, 'status-0');
    await press(page, 'pressure-low');
    await press(page, 'p14-pressure-low');
    await press(page, 'comms-on');
    await press(page, 'ack');
}

/** The seed's own items again (Point 2's overrides among them), no stray item, and the dev tags quiet. */
async function restore(browser) {
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
        // The seed puts back what it sets; an override this spec left on an item the seed gives none goes here.
        const load = await send(page, 'map.load', {});
        const keep = new Set([seed.ids['tracer/p2'], seed.ids['swd/line']]);
        const ops = load.body.items.filter((i) => !i.deleted && !keep.has(i.id) && Object.values(seed.ids).includes(i.id) && Object.keys(i.overrides || {}).length > 0)
            .map((i) => ({ op: 'update', entity: 'item', id: i.id, baseVersion: i.version, data: { overrides: {} } }));
        if (ops.length > 0) {
            const reply = await send(page, 'edits.apply', { batchId: randomUUID(), ops });
            expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
        }
        const result = await runSeed(page);
        expect(result.error, 'the seed saved').toBeUndefined();
        await removeStrays(page, seed.ids);
        await mapLoaded(await openMap(page, '/live'));
        await quiet(page);
    } finally {
        await context.close();
    }
}

test.beforeAll(async ({ browser }) => {
    seed = await ensureSeeded(browser);
    await restore(browser);
});

test.afterAll(async ({ browser }) => {
    await restore(browser);
});

async function openEditor(page) {
    const map = await openMap(page, '/edit');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', 'full');
    await expect(map).toHaveAttribute('data-studio', 'on');
    await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: LIVE_MS });
    return map;
}

/** A point map item made through the test hook at AWAY (a little apart per `n`), then its row in the list. */
async function createPoint(page, id, kind, name, n, extra = {}) {
    await apply(page, [{ op: 'create', entity: 'item', id, baseVersion: 0, data: { kind, name, geometry: { type: 'Point',
        coordinates: [Number((AWAY[0] + n * 0.002).toFixed(6)), AWAY[1]] }, properties: {}, ...extra } }]);
    await expect(page.locator('.mapstudio-list-row[data-item-id="' + id + '"]')).toHaveCount(1, { timeout: REPLY_MS });
}

const block = (page) => page.locator('.mapstudio-panel .mapstudio-livenow');
const row = (page, id) => block(page).locator('.mapstudio-livenow-row[data-row="' + id + '"]');
const value = (page, id) => row(page, id).locator('.mapstudio-livenow-value');
const pathOf = (page, id) => row(page, id).locator('.mapstudio-livenow-path');
const input = (page, id) => row(page, id).locator('.mapstudio-override-input');
const problem = (page, id) => row(page, id).locator('.mapstudio-override-problem');

/** Override (or Change) pressed on a row and a path typed, not yet finished. */
async function typePath(page, id, path) {
    await row(page, id).locator('.mapstudio-override-edit').click();
    await expect(input(page, id)).toBeFocused();
    await input(page, id).fill(path);
}

/** One override or Reset saved as one batch: Undo names its step, and the map's seq moved on by exactly one. */
async function expectOneBatch(page, map, seqBefore, step) {
    await expect(undo(page)).toHaveAttribute('data-step', 'Undo: ' + step, { timeout: REPLY_MS });
    await expect(map).toHaveAttribute('data-store-seq', String(seqBefore + 1), { timeout: REPLY_MS });
    await page.waitForTimeout(500);
    await expect(map).toHaveAttribute('data-store-seq', String(seqBefore + 1));
}

/** A render for the docs with the block in view. */
async function shot(page, name) {
    await block(page).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await shotNow(page, name);
}

async function openKinds(page, map, kindId) {
    await page.locator('.mapstudio-rail-item[data-surface="kinds"]').click();
    await expect(map).toHaveAttribute('data-surface', 'kinds');
    await page.locator('.mapstudio-kind-row[data-kind="' + kindId + '"]').click();
    await expect(page.locator('.mapstudio-kindsetup')).toHaveAttribute('data-kind', kindId);
}

editorTest.describe('the Live now block and path overrides at 1366 px', () => {
    editorTest.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, actionTimeout: REPLY_MS });
    editorTest.describe.configure({ mode: 'serial' });

    editorTest('L1 to L6, L8: the block follows the Gateway; a path overridden, a second, three not full, Undo and Recent changes by part, Comms and Alarms, Reset',
        async ({ page, context }) => {
            editorTest.setTimeout(420_000);
            const p1 = seed.ids['tracer/p1'];
            const p2 = seed.ids['tracer/p2'];
            const p3 = seed.ids['tracer/p3'];
            const dev = await openDev(context);
            await quiet(dev);
            await press(dev, 'p14-pressure-high');
            const map = await openEditor(page);
            await selectRow(page, p1);

            // L1: at the foot of Details, after Asset: the label with "From kind", then Comms, the key values in the setup's
            // order and Alarms, each with its live value and the kind's path filled for Point 1.
            await expect(block(page)).toHaveAttribute('data-rows', '4');
            await expect(block(page)).toHaveAttribute('data-unlinked', 'false');
            expect(await page.locator('.mapstudio-panel-body > *').last().evaluate((el) => el.className)).toContain('mapstudio-livenow');
            const heading = block(page).locator('.mapstudio-livenow-heading');
            await expect(heading).toHaveText(/^Live now$/i);
            expect(await heading.evaluate((el) => getComputedStyle(el).textTransform)).toBe('uppercase');
            // The tag stands beside the label, outside the heading that names the block.
            await expect(block(page).locator('.mapstudio-livenow-head > .mapstudio-fromkind-tag')).toHaveText('From kind');
            expect(await block(page).getAttribute('aria-labelledby')).toBe(await heading.getAttribute('id'));
            expect(await block(page).locator('.mapstudio-livenow-row').evaluateAll((els) => els.map((e) => e.dataset.row)))
                .toEqual(['comms', 'kpi:pressure', 'kpi:flow', 'alarms']);
            await expect(block(page).locator('.mapstudio-livenow-name')).toHaveText(['Comms', 'Pressure', 'Flow', 'Alarms']);
            await expect(block(page).locator('.mapstudio-livenow-path'))
                .toHaveText([P12 + '/Comms', P12 + '/Pressure', P12 + '/Flow', P12]);
            expect(await pathOf(page, 'kpi:pressure').evaluate((el) => getComputedStyle(el).fontFamily)).toContain('monospace');
            await expect(block(page).locator('.mapstudio-livenow-row[data-override="true"]')).toHaveCount(0);
            await expect(block(page).locator('.mapstudio-livenow-row .mapstudio-fromkind-tag')).toHaveCount(4);
            await expect(block(page).locator('.mapstudio-override-tag')).toHaveCount(0);
            // The icon value alone is starred and bold, the values right-aligned.
            await expect(block(page).locator('.mapstudio-livenow-star')).toHaveCount(1);
            await expect(row(page, 'kpi:pressure').locator('.mapstudio-livenow-star')).toHaveCount(1);
            expect(Number(await value(page, 'kpi:pressure').evaluate((el) => getComputedStyle(el).fontWeight))).toBeGreaterThanOrEqual(700);
            expect(Number(await value(page, 'kpi:flow').evaluate((el) => getComputedStyle(el).fontWeight))).toBeLessThan(600);
            expect(await value(page, 'kpi:flow').evaluate((el) => getComputedStyle(el).justifyContent)).toBe('flex-end');
            await expect(value(page, 'kpi:pressure')).toHaveText('400 psi', { timeout: LIVE_MS });
            await expect(value(page, 'comms')).toHaveText(/^OK( - .+)?$/);
            await expect(value(page, 'kpi:flow')).toHaveText(/ bbl\/d$/);
            await expect(value(page, 'alarms')).toHaveText('No active alarms');
            // Every button is a 24 px target at least.
            for (const box of await block(page).locator('button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
                expect(box.width).toBeGreaterThanOrEqual(24);
                expect(box.height).toBeGreaterThanOrEqual(24);
            }
            // No em dash in the panel.
            expect(await page.locator('.mapstudio-panel').innerText()).not.toContain(String.fromCharCode(0x2014));
            await shot(page, 'mapstudio-overrides-block-1366.png');

            // The values follow the Gateway with no reload: the pressure and its alarm, then quiet again.
            await press(dev, 'pressure-high');
            await expect(value(page, 'kpi:pressure')).toHaveText('950 psi', { timeout: LIVE_MS });
            await expect(value(page, 'alarms')).toHaveText('1 alarm - Priority 1, unacknowledged', { timeout: LIVE_MS });
            await press(dev, 'pressure-low');
            await press(dev, 'ack');
            await expect(value(page, 'kpi:pressure')).toHaveText('400 psi', { timeout: LIVE_MS });
            await expect(value(page, 'alarms')).toHaveText('No active alarms', { timeout: LIVE_MS });
            const p3Before = await liveItem(page, p3).getAttribute('data-kpi');

            // L2: Override makes the path a text field starting from the filled path; Enter saves it.
            let seq = await seqOf(map);
            await row(page, 'kpi:pressure').locator('.mapstudio-override-edit').click();
            await expect(input(page, 'kpi:pressure')).toBeFocused();
            await expect(input(page, 'kpi:pressure')).toHaveValue(P12 + '/Pressure');
            await input(page, 'kpi:pressure').fill(P14 + '/Pressure');
            await page.keyboard.press('Enter');
            await expectOneBatch(page, map, seq, "change Point 1's Pressure path");
            expect((await stored(page, p1)).overrides).toEqual({ kpis: [{ key: 'pressure', path: P14 + '/Pressure' }] });
            await expect(row(page, 'kpi:pressure')).toHaveAttribute('data-override', 'true');
            await expect(row(page, 'kpi:pressure').locator('.mapstudio-override-tag')).toHaveText('Override');
            await expect(row(page, 'kpi:pressure').locator('.mapstudio-override-reset')).toHaveText('Reset');
            await expect(pathOf(page, 'kpi:pressure')).toHaveText(P14 + '/Pressure');
            await expect(block(page).locator('.mapstudio-override-tag')).toHaveCount(1);
            await expect(block(page).locator('.mapstudio-livenow-row .mapstudio-fromkind-tag')).toHaveCount(3);
            // The keyboard's focus is back on the row's button.
            await expect(row(page, 'kpi:pressure').locator('.mapstudio-override-edit')).toBeFocused();
            // The override tag wears the selection token on its tint, never a colour of its own.
            expect(await row(page, 'kpi:pressure').locator('.mapstudio-override-tag').evaluate((el) => {
                const probe = document.createElement('span');
                probe.style.color = 'var(--callToAction)';
                el.parentElement.appendChild(probe);
                const token = getComputedStyle(probe).color;
                probe.remove();
                return getComputedStyle(el).color === token;
            })).toBe(true);
            // Point 1 shows P14's pressure at the next live update, in this map and in the other open one; Point 3 is as it was.
            await expect(value(page, 'kpi:pressure')).toHaveText('700 psi', { timeout: LIVE_MS });
            await expect(liveItem(page, p1)).toHaveAttribute('data-kpi', '700 psi', { timeout: LIVE_MS });
            await expect(liveItem(dev, p1)).toHaveAttribute('data-kpi', '700 psi', { timeout: LIVE_MS });
            await expect(liveItem(page, p3)).toHaveAttribute('data-kpi', p3Before);
            await shot(page, 'mapstudio-overrides-override-1366.png');
            // The kind's header counts it; the selection is kept and Details returns with Items.
            const pads = await padCount(page);
            await openKinds(page, map, 'pad');
            await expect(page.locator('.mapstudio-kindsetup-subline'))
                .toHaveText('Point - applies to ' + pads + ' items - 2 overrides (Point 1 key values, Point 2 style rule)');
            await openItems(page, map);
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', p1);

            // L3: Flow overridden too, finished by leaving the field: both are stored.
            seq = await seqOf(map);
            await typePath(page, 'kpi:flow', P14 + '/Flow');
            await page.locator('.mapstudio-panel .mapstudio-field-name').focus();
            await expectOneBatch(page, map, seq, "change Point 1's Flow path");
            const both = { kpis: [{ key: 'pressure', path: P14 + '/Pressure' }, { key: 'flow', path: P14 + '/Flow' }] };
            expect((await stored(page, p1)).overrides).toEqual(both);
            await expect(block(page).locator('.mapstudio-override-tag')).toHaveCount(2);

            // L6: a path below {asset.path}, then one with no provider: the Gateway's words beside the field, nothing sent;
            // Esc puts the path back.
            seq = await seqOf(map);
            await typePath(page, 'comms', '{asset.path}/X');
            await page.keyboard.press('Enter');
            await expect(problem(page, 'comms')).toHaveText("an override's tag path is a full path such as [default]Mesa/P12/Pressure, not {asset.path}/X.");
            await expect(input(page, 'comms')).toHaveAttribute('aria-invalid', 'true');
            await input(page, 'comms').fill('Mesa/X');
            await page.keyboard.press('Enter');
            await expect(problem(page, 'comms')).toHaveText('Mesa/X' + NOT_FULL);
            await expectNothingSent(page, map, seq);
            await page.keyboard.press('Escape');
            await expect(input(page, 'comms')).toHaveCount(0);
            await expect(problem(page, 'comms')).toHaveCount(0);
            await expect(pathOf(page, 'comms')).toHaveText(P12 + '/Comms');
            await expect(row(page, 'comms')).toHaveAttribute('data-override', 'false');
            // Esc went no further: Details is still open, the focus on the row's button.
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', p1);
            await expect(row(page, 'comms').locator('.mapstudio-override-edit')).toBeFocused();
            await expectNothingSent(page, map, seq);

            // L6 again: a provider with no path, which the Gateway would refuse: the same words, and nothing sent.
            await typePath(page, 'comms', '[default]');
            await page.keyboard.press('Enter');
            await expect(problem(page, 'comms')).toHaveText('[default]' + NOT_FULL);
            await expect(input(page, 'comms')).toHaveValue('[default]');
            await expectNothingSent(page, map, seq);
            expect((await stored(page, p1)).overrides).toEqual(both);
            await shot(page, 'mapstudio-overrides-refused-1366.png');
            await page.keyboard.press('Escape');
            await expect(problem(page, 'comms')).toHaveCount(0);
            await expect(row(page, 'comms')).toHaveAttribute('data-override', 'false');
            await expect(page.locator('.mapstudio-unsaved-row')).toHaveCount(0);

            // L8: Undo names the override by its part and undoes it; Redo puts it back.
            await expect(undo(page)).toHaveAttribute('data-step', "Undo: change Point 1's Flow path");
            await undo(page).click();
            await expect.poll(async () => (await stored(page, p1)).overrides, { timeout: REPLY_MS })
                .toEqual({ kpis: [{ key: 'pressure', path: P14 + '/Pressure' }] });
            await expect(row(page, 'kpi:flow')).toHaveAttribute('data-override', 'false', { timeout: REPLY_MS });
            await expect(pathOf(page, 'kpi:flow')).toHaveText(P12 + '/Flow');
            await page.locator('.mapstudio-toolbar .mapstudio-redo').click();
            await expect.poll(async () => (await stored(page, p1)).overrides, { timeout: REPLY_MS }).toEqual(both);
            await expect(row(page, 'kpi:flow')).toHaveAttribute('data-override', 'true', { timeout: REPLY_MS });
            // Recent changes lists each by its part, with Revert.
            await page.locator('.mapstudio-rail-item[data-surface="history"]').click();
            const history = page.locator('.mapstudio-history');
            await expect(history).toBeVisible();
            const pressureRow = history.locator('.mapstudio-history-row', { hasText: "Changed Point 1's Pressure path" }).first();
            await expect(pressureRow.locator('.mapstudio-history-sentence')).toHaveText("Changed Point 1's Pressure path", { timeout: REPLY_MS });
            await expect(pressureRow).toHaveAttribute('data-revert', 'offered');
            await expect(pressureRow.locator('.mapstudio-history-revert')).toBeVisible();
            await expect(history.locator('.mapstudio-history-sentence', { hasText: "Changed Point 1's Flow path" }).first()).toBeVisible();
            await openItems(page, map);
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', p1);

            // L5: Comms and Alarms overridden, each its part with the kind's switches kept.
            seq = await seqOf(map);
            await typePath(page, 'comms', P14 + '/Comms');
            await page.keyboard.press('Enter');
            await expectOneBatch(page, map, seq, "change Point 1's comms path");
            seq = await seqOf(map);
            await typePath(page, 'alarms', P14);
            await page.keyboard.press('Enter');
            await expectOneBatch(page, map, seq, "change Point 1's alarms path");
            expect((await stored(page, p1)).overrides).toEqual({ ...both, comms: { path: P14 + '/Comms', on: true },
                alarms: { path: P14, count: true, summary: true } });
            await expect(block(page).locator('.mapstudio-override-tag')).toHaveCount(4);
            // Then reset, each one batch.
            seq = await seqOf(map);
            await row(page, 'comms').locator('.mapstudio-override-reset').click();
            await expectOneBatch(page, map, seq, "reset Point 1's comms path");
            seq = await seqOf(map);
            await row(page, 'alarms').locator('.mapstudio-override-reset').click();
            await expectOneBatch(page, map, seq, "reset Point 1's alarms path");
            expect((await stored(page, p1)).overrides).toEqual(both);
            await expect(pathOf(page, 'comms')).toHaveText(P12 + '/Comms');
            await expect(pathOf(page, 'alarms')).toHaveText(P12);

            // L4: Reset on Pressure: "From kind" again, Flow's override kept, Point 1 its own pressure again; the last Reset
            // leaves no kpis.
            seq = await seqOf(map);
            await row(page, 'kpi:pressure').locator('.mapstudio-override-reset').click();
            await expectOneBatch(page, map, seq, "reset Point 1's Pressure path");
            expect((await stored(page, p1)).overrides).toEqual({ kpis: [{ key: 'flow', path: P14 + '/Flow' }] });
            await expect(row(page, 'kpi:pressure')).toHaveAttribute('data-override', 'false');
            await expect(row(page, 'kpi:pressure').locator('.mapstudio-fromkind-tag')).toHaveText('From kind');
            await expect(row(page, 'kpi:pressure').locator('.mapstudio-override-reset')).toHaveCount(0);
            await expect(pathOf(page, 'kpi:pressure')).toHaveText(P12 + '/Pressure');
            await expect(row(page, 'kpi:flow')).toHaveAttribute('data-override', 'true');
            await expect(value(page, 'kpi:pressure')).toHaveText('400 psi', { timeout: LIVE_MS });
            await expect(liveItem(dev, p1)).toHaveAttribute('data-kpi', '400 psi', { timeout: LIVE_MS });
            seq = await seqOf(map);
            await row(page, 'kpi:flow').locator('.mapstudio-override-reset').click();
            await expectOneBatch(page, map, seq, "reset Point 1's Flow path");
            expect((await stored(page, p1)).overrides).toEqual({});
            await expect(block(page).locator('.mapstudio-override-tag')).toHaveCount(0);
            expect(p2).toBeTruthy();
            await quiet(dev);
        });

    editorTest('L9 to L12: an unlinked pad, a kind change dropping the overrides with one Undo, a stored link override, and a kind with no setup',
        async ({ page }) => {
            editorTest.setTimeout(300_000);
            const p2 = seed.ids['tracer/p2'];
            const map = await openEditor(page);

            // L10: an unlinked pad shows the kind's paths as written and the note; an override still saves.
            const pad = randomUUID();
            await createPoint(page, pad, 'pad', 'Override pad', 0);
            await selectRow(page, pad);
            await expect(block(page)).toHaveAttribute('data-unlinked', 'true');
            await expect(block(page).locator('.mapstudio-livenow-path'))
                .toHaveText(['{asset.path}/Comms', '{asset.path}/Pressure', '{asset.path}/Flow', '{asset.path}']);
            await expect(block(page).locator('.mapstudio-livenow-unlinked'))
                .toHaveText('Not linked, so the paths show as the kind has them. Linking an asset fills them.');
            let seq = await seqOf(map);
            await row(page, 'comms').locator('.mapstudio-override-edit').click();
            await expect(input(page, 'comms')).toHaveValue('{asset.path}/Comms');
            await input(page, 'comms').fill(P14 + '/Comms');
            await page.keyboard.press('Enter');
            await expectOneBatch(page, map, seq, "change Override pad's comms path");
            expect((await stored(page, pad)).overrides).toEqual({ comms: { path: P14 + '/Comms', on: true } });
            await expect(row(page, 'comms')).toHaveAttribute('data-override', 'true');
            await expect(pathOf(page, 'comms')).toHaveText(P14 + '/Comms');

            // L9: a tap with an override changes kind: saved with no overrides, and one Undo restores the kind and the overrides.
            const tap = randomUUID();
            const tapOverrides = { comms: { path: '[default]Mesa/PT1/Comms', on: true } };
            await createPoint(page, tap, 'tap', 'Override tap', 1, { overrides: tapOverrides });
            await selectRow(page, tap);
            await expect(row(page, 'comms')).toHaveAttribute('data-override', 'true');
            seq = await seqOf(map);
            await page.locator('.mapstudio-panel .mapstudio-field-kind').selectOption('valve');
            await expectOneBatch(page, map, seq, 'edit Override tap');
            expect(await stored(page, tap)).toMatchObject({ kind: 'valve', overrides: {} });
            await expect(row(page, 'comms')).toHaveAttribute('data-override', 'false');
            await undo(page).click();
            await expect.poll(async () => {
                const now = await stored(page, tap);
                return { kind: now.kind, overrides: now.overrides };
            }, { timeout: REPLY_MS }).toEqual({ kind: 'tap', overrides: tapOverrides });
            await expect(row(page, 'comms')).toHaveAttribute('data-override', 'true', { timeout: REPLY_MS });

            // L11: a link override the Gateway stores and does not apply: not marked, not counted, and still stored after
            // another override is saved.
            const before = await stored(page, p2);
            const rule = before.overrides.styleRule;
            expect(rule).toBeTruthy();
            await apply(page, [{ op: 'update', entity: 'item', id: p2, baseVersion: before.version, data: { overrides: { styleRule: rule, link: '/other' } } }]);
            await selectRow(page, p2);
            await expect(block(page)).toHaveAttribute('data-rows', '4');
            await expect(block(page).locator('.mapstudio-livenow-row[data-override="true"]')).toHaveCount(0);
            await expect(block(page).locator('.mapstudio-override-tag')).toHaveCount(0);
            const pads = await padCount(page);
            await openKinds(page, map, 'pad');
            await expect(page.locator('.mapstudio-kindsetup-subline'))
                .toHaveText('Point - applies to ' + pads + ' items - 2 overrides (Override pad comms, Point 2 style rule)');
            await openItems(page, map);
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', p2);
            seq = await seqOf(map);
            await typePath(page, 'kpi:pressure', P12 + '/Pressure');
            await page.keyboard.press('Enter');
            await expectOneBatch(page, map, seq, "change Point 2's Pressure path");
            expect((await stored(page, p2)).overrides).toEqual({ styleRule: rule, link: '/other', kpis: [{ key: 'pressure', path: P12 + '/Pressure' }] });
            seq = await seqOf(map);
            await row(page, 'kpi:pressure').locator('.mapstudio-override-reset').click();
            await expectOneBatch(page, map, seq, "reset Point 2's Pressure path");
            expect((await stored(page, p2)).overrides).toEqual({ styleRule: rule, link: '/other' });

            // L12: an item of a kind with no setup: one line, and the button opens Kinds at that kind, the selection kept.
            const meter = randomUUID();
            await createPoint(page, meter, 'meter', 'Override meter', 2);
            await selectRow(page, meter);
            await expect(block(page)).toHaveAttribute('data-rows', '0');
            await expect(block(page).locator('.mapstudio-livenow-row')).toHaveCount(0);
            await expect(block(page).locator('.mapstudio-livenow-empty .mapstudio-field-hint'))
                .toHaveText('Meter has no setup yet, so its items show no live values.');
            const open = block(page).locator('.mapstudio-livenow-setup');
            await expect(open).toHaveText("Open Meter's setup");
            await open.click();
            await expect(map).toHaveAttribute('data-surface', 'kinds');
            await expect(page.locator('.mapstudio-kindsetup')).toHaveAttribute('data-kind', 'meter');
            await openItems(page, map);
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', meter);
        });
});
