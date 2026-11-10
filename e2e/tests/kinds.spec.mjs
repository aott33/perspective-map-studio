// The Kinds surface and a kind's setup (epic-editing entry 12a; DESIGN.md Kind setup and key screen 6, EXPERIENCE.md Kind setup): the
// plan's matrix K1 to K12 at 1366 px on the dev stack, as the map editor in Edit mode. K1: the rail's Kinds lists the six dev kinds
// with their geometry and counts, the first open in the properties panel's place, and the kind list's message while the dev adapter
// is incomplete. K2: the Well pad's Pressure path changed in the screen, every linked pad's icon value following within one refresh
// interval with no reload and the style rule stored as it was. K3: a row not sent says what is missing, Add gone at four, one star
// only, a value switched off dropped from the popup. K4: paths and the popup's parts. K5 and K6: a refused link and refused params,
// the Gateway's words beside the field, nothing saved and nowhere "Saved". K7: the placeholder picker. K8: the resolve notes, and the
// one note with no linked item. K9: a kind with no setup saved as a create (the first-run step is firstrun.spec's). K11: two editors,
// the second dev map editor saving through its own session. K12: a setup save is no undo step and has no Revert. K10 (each part
// edited in turn on each seed setup) is Jest's (web/typescript/__tests__/kindSetup.test.ts). The spec puts the dev adapter back to
// ok, runs the seed again (which restores the five seed setups) and deletes the Meter setup it makes, before and after.

import { randomUUID } from 'node:crypto';
import { TRACER, pagePixel } from '../lib/geo.mjs';
import {
    EDITOR2_USER, EDITOR_USER, editorTest, ensureSeeded, expect, loadedCounts, mapLoaded, openMap, removeStrays, runSeed, send, shot, signedInContext, test,
    view
} from './fixtures.mjs';

/** The Gateway's answer to a save. */
const REPLY_MS = 20_000;
/** One refresh interval of the dev setup (10 s) with its round trips, as live.spec.mjs bounds it. */
const INTERVAL_MS = 25_000;
/** There is nothing to observe when nothing is sent: the time a stray batch would have to show in the map's seq. */
const NOTHING_MS = 800;
const ADAPTERS = '/adapters';
/** The dev kind list (ops/project/ignition/script-python/mapstudio_dev): id and geometry word, in its order. */
const KINDS = [['pad', 'point'], ['line', 'line'], ['geofence', 'area'], ['tap', 'point'], ['valve', 'point'], ['meter', 'point']];

let seed;

test.beforeAll(async ({ browser }) => {
    seed = await ensureSeeded(browser);
    await restore(browser);
});

test.afterAll(async ({ browser }) => {
    await restore(browser);
});

/** Press a /adapters page button and wait for its result label to report `mode` (adapters.spec.mjs). */
async function pressAdapter(page, mode) {
    const result = page.locator('#mapstudio-dev-adapter-result');
    await page.locator('#mapstudio-dev-adapter-' + mode).click();
    await expect(result).toContainText(`"mode":"${mode}"`, { timeout: 60_000 });
}

/** The dev adapter in mode ok, the seed's own items and kind setups again, no stray item and no Meter setup. */
async function restore(browser) {
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, ADAPTERS));
        await pressAdapter(page, 'ok');
        await mapLoaded(await openMap(page, '/edit'));
        const result = await runSeed(page);
        expect(result.error, 'the seed saved').toBeUndefined();
        await removeStrays(page, seed.ids);
        const meter = await setupOf(page, 'meter');
        if (meter) {
            const reply = await send(page, 'edits.apply', { batchId: randomUUID(), ops: [{ op: 'delete', entity: 'kindSetup', id: 'meter', baseVersion: meter.version }] });
            expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
        }
    } finally {
        await context.close();
    }
}

/** The stored kind setup record of a kind through the test hook, or undefined. */
async function setupOf(page, kindId) {
    const reply = await send(page, 'map.load', {});
    expect(reply.type, JSON.stringify(reply.body)).toBe('map.load.reply');
    return (reply.body.kindSetups || []).find((k) => k.kindId === kindId && !k.deleted);
}

async function openEditor(page) {
    const map = await openMap(page, '/edit');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', 'full');
    await expect(map).toHaveAttribute('data-studio', 'on');
    return map;
}

/** Kinds opened from the rail: the list in the dock, the first (or last chosen) kind's setup in the properties panel's place. */
async function openKinds(page, map) {
    await page.locator('.mapstudio-rail-item[data-surface="kinds"]').click();
    await expect(map).toHaveAttribute('data-surface', 'kinds');
    await expect(page.locator('.mapstudio-kinds')).toBeVisible();
    const panel = page.locator('.mapstudio-kindsetup');
    await expect(panel).toBeVisible();
    return panel;
}

/** A kind chosen in the list: its setup shows. */
async function chooseKind(page, kindId) {
    await page.locator('.mapstudio-kind-row[data-kind="' + kindId + '"]').click();
    const panel = page.locator('.mapstudio-kindsetup');
    await expect(panel).toHaveAttribute('data-kind', kindId);
    return panel;
}

/** A field's wrapper in the setup panel (kindSetup.ts `Fields`). */
const field = (page, id) => page.locator('.mapstudio-kindsetup [data-field="' + id + '"]');
const input = (page, id) => field(page, id).locator('input[type="text"]');
const section = (page, name) => page.locator('.mapstudio-kindsetup [data-section="' + name + '"]');
const liveItem = (page, id) => page.locator('.mapstudio-live-item[data-item-id="' + id + '"]');
const saveWords = (page) => page.locator('.mapstudio-kinds .mapstudio-panel-save');

/** Type a text field's whole value and finish it with Enter. */
async function type(page, id, text) {
    await input(page, id).fill(text);
    await input(page, id).press('Enter');
}

/** The panel has nothing on its way and the header says Saved. */
async function settled(page) {
    await expect(page.locator('.mapstudio-kindsetup')).toHaveAttribute('data-saving', '', { timeout: REPLY_MS });
    await expect(saveWords(page)).toHaveText('Saved', { timeout: REPLY_MS });
}

editorTest.describe('the Kinds surface at 1366 px', () => {
    editorTest.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
    editorTest.describe.configure({ mode: 'serial' });

    editorTest('K1, K8: the list of kinds, the first one\'s setup in the panel\'s place, the preview item and the resolve notes',
        async ({ page }) => {
            editorTest.setTimeout(240_000);
            const map = await openEditor(page);
            const selected = seed.ids[TRACER.points.p1.key];
            await page.locator('.mapstudio-list-row[data-item-id="' + selected + '"]').click();
            await expect(page.locator('.mapstudio-panel[data-item-id="' + selected + '"]')).toBeVisible();
            const panel = await openKinds(page, map);

            // The list: the note, then the six dev kinds with their geometry and counts; the first opens.
            await expect(page.locator('.mapstudio-kinds-note')).toHaveText('Setup applies to every item of a kind. Items can override.');
            const rows = page.locator('.mapstudio-kind-row');
            await expect(rows).toHaveCount(6);
            expect(await rows.evaluateAll((els) => els.map((e) => [e.dataset.kind, e.dataset.geometry]))).toEqual(KINDS);
            const items = (await send(page, 'map.load', {})).body.items.filter((i) => !i.deleted);
            for (const [kind] of KINDS) {
                const count = items.filter((i) => i.kind === kind).length;
                await expect(page.locator('.mapstudio-kind-row[data-kind="' + kind + '"]')).toHaveAttribute('data-count', String(count));
            }
            const pads = items.filter((i) => i.kind === 'pad').length;
            await expect(rows.first()).toHaveAttribute('aria-current', 'true');
            await expect(rows.first()).toContainText('Well pad');
            await expect(rows.first().locator('.mapstudio-kind-meta')).toHaveText('Point - ' + pads + ' items');
            await expect(panel).toHaveAttribute('data-kind', 'pad');
            await expect(page.locator('.mapstudio-kinds-status')).toHaveCount(0);

            // The setup takes the properties panel's place; the item's Details is not shown and the selection is kept.
            await expect(page.locator('.mapstudio-panel[data-item-id]')).toHaveCount(0);
            expect(Math.round((await page.locator('.mapstudio-kinds').boundingBox()).width)).toBe(256);
            expect(Math.round((await panel.boundingBox()).width)).toBe(320);
            await expect.poll(async () => Math.round((await map.boundingBox()).width), { timeout: 10_000 }).toBe(1366 - 72 - 256 - 320);

            // The header: the name, the subline with the overrides, the preview item (the first linked pad by name) and its folder.
            await expect(panel.locator('.mapstudio-kindsetup-name')).toHaveText('Well pad');
            await expect(panel.locator('.mapstudio-kindsetup-subline')).toHaveText('Point - applies to ' + pads + ' items - 1 override (Point 2 style rule)');
            const preview = field(page, 'preview').locator('select');
            await expect(field(page, 'preview')).toHaveAttribute('data-options', '5');
            await expect(preview).toHaveValue(seed.ids['swd/ctb1']);
            await expect(field(page, 'preview').locator('.mapstudio-kindsetup-folder')).toHaveText('[default]Mesa/CTB1');
            expect(await field(page, 'preview').locator('.mapstudio-kindsetup-folder').evaluate((el) => getComputedStyle(el).fontFamily)).toContain('monospace');

            // The sections, numbered as DESIGN.md has them.
            expect(await panel.locator('[data-section]').evaluateAll((els) => els.map((e) => e.dataset.section)))
                .toEqual(['icon', 'keyValues', 'comms', 'alarms', 'popup', 'styleRule']);
            expect(await panel.locator('.mapstudio-kindsetup-heading').evaluateAll((els) => els.map((e) => e.textContent.trim().replace(/\s+/g, ' '))))
                .toEqual(['1 Icon', '2 Key values', '3 Comms', '4 Alarms', '5 Popup', '6 Style ruleBuilds on key values']);
            await expect(section(page, 'icon')).toContainText('well-pad');
            // Section 6 is the Style rule editor since entry 12b1 (kindstyle.spec.mjs): the stored States rule's four cases.
            await expect(section(page, 'styleRule')).toHaveAttribute('data-rule', 'states');
            await expect(section(page, 'styleRule').locator('.mapstudio-rule-case')).toHaveCount(4);
            await expect(section(page, 'popup')).toContainText('Order is fixed: comms, values, alarms');
            await expect(field(page, 'alarmPage')).toContainText('set in the Designer');
            await expect(input(page, 'kpis.pressure.path')).toHaveValue('{asset.path}/Pressure');
            await expect(input(page, 'link')).toHaveValue('/pad/{item.name}');

            // K8: each stored path says how many of the five linked pads it resolves for (P15 has no Pressure tag: fewer than all, in the
            // warning token).
            const note = field(page, 'kpis.pressure.path').locator('.mapstudio-resolve-note');
            await expect(note).toHaveAttribute('data-state', 'resolved', { timeout: REPLY_MS });
            const words = (await note.innerText()).trim();
            expect(words).toMatch(/^Resolves for [0-5] of 5 well pads$/);
            const n = Number(words.match(/for (\d)/)[1]);
            await expect(note).toHaveAttribute('data-warning', n < 5 ? 'true' : 'false');
            expect(n).toBeLessThan(5);
            const warning = await page.evaluate(() => {
                const probe = document.createElement('span');
                probe.style.color = 'var(--mapstudio-warning)';
                document.querySelector('.mapstudio').appendChild(probe);
                const color = getComputedStyle(probe).color;
                probe.remove();
                return color;
            });
            expect(await note.evaluate((el) => getComputedStyle(el).color)).toBe(warning);
            await expect(field(page, 'comms.path').locator('.mapstudio-resolve-note')).toHaveText(/^Resolves for [0-5] of 5 well pads$/, { timeout: REPLY_MS });
            await expect(field(page, 'alarms.path').locator('.mapstudio-resolve-note')).toHaveText(/^Resolves for [0-5] of 5 well pads$/, { timeout: REPLY_MS });
            await shot(page, 'mapstudio-kinds-1366.png');

            // The preview item chosen is remembered for the browser session: after a reload Kinds opens on it.
            await preview.selectOption(seed.ids[TRACER.points.p2.key]);
            await expect(panel).toHaveAttribute('data-preview', seed.ids[TRACER.points.p2.key]);
            await expect(field(page, 'preview').locator('.mapstudio-kindsetup-folder')).toHaveText('[default]Mesa/P14');
            await expect(note).toHaveText(words, { timeout: REPLY_MS });

            // A line's Flow is what its style rule is built on: Remove is off, saying so (owner decision 2).
            await chooseKind(page, 'line');
            await expect(page.locator('.mapstudio-kind-row[data-kind="line"]')).toHaveAttribute('aria-current', 'true');
            const remove = page.locator('.mapstudio-kv-row[data-key="flow"] .mapstudio-kv-remove');
            await expect(remove).toBeDisabled();
            await expect(remove).toHaveAttribute('title', 'Used by the style rule');
            await expect(page.locator('.mapstudio-kv-row[data-key="flow"] .mapstudio-kv-used')).toHaveText('Used by style rule');
            await expect(section(page, 'styleRule')).toHaveAttribute('data-rule', 'bands');
            await expect(section(page, 'styleRule').locator('.mapstudio-rule-case')).toHaveCount(3);

            // Items again: the selected item's Details is back; Kinds again: the kind last chosen.
            await page.locator('.mapstudio-rail-item[data-surface="items"]').click();
            await expect(page.locator('.mapstudio-panel[data-item-id="' + selected + '"]')).toBeVisible();
            await expect(page.locator('.mapstudio-kindsetup')).toHaveCount(0);
            await openKinds(page, map);
            await expect(page.locator('.mapstudio-kindsetup')).toHaveAttribute('data-kind', 'line');

            const reloaded = await openEditor(page);
            await openKinds(page, reloaded);
            await expect(page.locator('.mapstudio-kindsetup')).toHaveAttribute('data-kind', 'pad');
            await expect(page.locator('.mapstudio-kindsetup')).toHaveAttribute('data-preview', seed.ids[TRACER.points.p2.key]);

            // Every control is reachable by keyboard and at least 24 px tall or wide where it is pressed.
            const small = await page.locator('.mapstudio-kindsetup').evaluate((root) => Array.from(root.querySelectorAll('button, select, input[type="text"]'))
                .filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && (b.height < 24 || b.width < 24); })
                .map((el) => el.className));
            expect(small).toEqual([]);
            const rowsOf = await page.locator('.mapstudio-kindsetup .mapstudio-field-check-row').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
            expect(Math.min(...rowsOf)).toBeGreaterThanOrEqual(24);
        });

    editorTest('K1: while the dev adapter is incomplete the kind list\'s message stands above the rows', async ({ page }) => {
        editorTest.setTimeout(240_000);
        try {
            await mapLoaded(await openMap(page, ADAPTERS));
            await pressAdapter(page, 'incomplete');
            const map = await openEditor(page);
            await openKinds(page, map);
            const status = page.locator('.mapstudio-kinds-status[data-list="kinds"]');
            await expect(status).toHaveAttribute('data-status', 'incomplete');
            const message = await page.locator('.mapstudio-adapter-status').getAttribute('data-kinds-message');
            expect(message.length).toBeGreaterThan(10);
            await expect(status).toHaveText(message);
            await expect(page.locator('.mapstudio-kinds-status[data-list="assets"]')).toHaveAttribute('data-status', 'incomplete');
            // Above the rows, which still list the kinds in use.
            const above = await status.evaluate((el) => el.getBoundingClientRect().bottom <= document.querySelector('.mapstudio-kind-row').getBoundingClientRect().top);
            expect(above).toBe(true);
            await expect(page.locator('.mapstudio-kind-row')).toHaveCount(6);
            await shot(page, 'mapstudio-kinds-incomplete-1366.png');
        } finally {
            await mapLoaded(await openMap(page, ADAPTERS));
            await pressAdapter(page, 'ok');
        }
    });

    editorTest('K2, K12: a key value\'s path saved from the screen reaches every pad\'s icon; the style rule is stored as it was; no undo step, no Revert',
        async ({ page }) => {
            editorTest.setTimeout(300_000);
            const map = await openEditor(page);
            await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
            const before = await setupOf(page, 'pad');
            const ctb1 = liveItem(page, seed.ids['swd/ctb1']);
            const swd1 = liveItem(page, seed.ids['swd/swd1']);
            const p3 = liveItem(page, seed.ids[TRACER.points.p3.key]);
            await expect(ctb1).toHaveAttribute('data-kpi', /psi$/, { timeout: INTERVAL_MS });
            await expect(swd1).toHaveAttribute('data-kpi', /psi$/, { timeout: INTERVAL_MS });
            // P15 has no Pressure tag: its icon has no value until the path names a tag it has.
            await expect(p3).toHaveAttribute('data-problems', /kpi:pressure: the tag was not found/, { timeout: INTERVAL_MS });
            const pressures = [await ctb1.getAttribute('data-kpi'), await swd1.getAttribute('data-kpi')];
            const undo = page.locator('.mapstudio-tool.mapstudio-undo');
            const undoBefore = await undo.getAttribute('title');
            const reloads = await map.getAttribute('data-map-reloads');

            await openKinds(page, map);
            const changed = Date.now();
            await type(page, 'kpis.pressure.path', '{asset.path}/Flow');
            await settled(page);
            const after = await setupOf(page, 'pad');
            expect(after.version).toBe(before.version + 1);
            // The whole setup as it was, the one path apart: the style rule, the link, comms, alarms and the other key value.
            expect(after.setup).toEqual({ ...before.setup, kpis: [{ ...before.setup.kpis[0], path: '{asset.path}/Flow' }, before.setup.kpis[1]] });
            expect(after.setup.styleRule).toEqual(before.setup.styleRule);
            await expect(page.locator('.mapstudio-kindsetup')).toHaveAttribute('data-version', String(after.version));

            // Every linked pad's icon value follows within one refresh interval, with no reload.
            await expect(p3).toHaveAttribute('data-kpi', /psi$/, { timeout: INTERVAL_MS });
            await expect(p3).not.toHaveAttribute('data-problems', /kpi:pressure/);
            await expect(ctb1).not.toHaveAttribute('data-kpi', pressures[0], { timeout: INTERVAL_MS });
            await expect(swd1).not.toHaveAttribute('data-kpi', pressures[1], { timeout: INTERVAL_MS });
            expect(Date.now() - changed).toBeLessThan(INTERVAL_MS);
            await expect(ctb1).toHaveAttribute('data-kpi', /psi$/);
            await expect(map).toHaveAttribute('data-map-reloads', reloads);

            // K12: Undo names the step it named before; History lists the save, with no Revert.
            expect(await undo.getAttribute('title')).toBe(undoBefore);
            await page.locator('.mapstudio-rail-item[data-surface="history"]').click();
            const first = page.locator('.mapstudio-history-row').first();
            // (On a map where the path was changed and put back before, the row reads as the reverse of that change, in the same words.)
            await expect(first.locator('.mapstudio-history-sentence')).toHaveText(/Changed the well pad kind setup/, { timeout: REPLY_MS });
            await expect(first).toHaveAttribute('data-actor', EDITOR_USER);
            await expect(first).toHaveAttribute('data-revert', 'blocked');
            await expect(first.locator('.mapstudio-history-revert')).toHaveCount(0);

            // Back as it was, from the screen too.
            await openKinds(page, map);
            await type(page, 'kpis.pressure.path', '{asset.path}/Pressure');
            await settled(page);
            expect((await setupOf(page, 'pad')).setup).toEqual(before.setup);
            await expect(ctb1).toHaveAttribute('data-kpi', pressures[0], { timeout: INTERVAL_MS });
        });

    editorTest('K3, K4: key value rows (a row not sent, Add gone at four, one star, a switch) and the popup\'s parts; a pad\'s popup follows',
        async ({ page }) => {
            editorTest.setTimeout(300_000);
            const map = await openEditor(page);
            const before = await setupOf(page, 'pad');
            await openKinds(page, map);
            const keyValues = section(page, 'keyValues');
            await expect(keyValues).toHaveAttribute('data-rows', '2');

            // A row without a path is not sent and says what is missing.
            const seq = await map.getAttribute('data-store-seq');
            await page.locator('.mapstudio-kv-add').click();
            const fresh = page.locator('.mapstudio-kv-row[data-new="true"]');
            await expect(fresh).toHaveCount(1);
            await expect(fresh.getByLabel('Label')).toBeFocused();
            await fresh.getByLabel('Label').fill('Gas price');
            await fresh.getByLabel('Label').press('Enter');
            await expect(fresh.locator('.mapstudio-field-problem')).toHaveText('Type a tag path. This row is not saved yet.');
            await page.waitForTimeout(NOTHING_MS);
            await expect(map).toHaveAttribute('data-store-seq', seq);
            // With its path it is saved, its key made from its label; a full path is the same tag for every pad.
            await fresh.getByLabel('Tag path').fill('[default]Shared/GasPrice');
            await fresh.getByLabel('Tag path').press('Enter');
            const gas = page.locator('.mapstudio-kv-row[data-key="gasprice"][data-new="false"]');
            await expect(gas).toHaveCount(1, { timeout: REPLY_MS });
            await expect(fresh).toHaveCount(0);
            const shared = field(page, 'kpis.gasprice.path').locator('.mapstudio-resolve-note');
            await expect(shared).toHaveText('Same tag for every well pad');
            await expect(shared).toHaveAttribute('data-warning', 'true');

            // A fourth: Add is gone.
            await page.locator('.mapstudio-kv-add').click();
            await fresh.getByLabel('Label').fill('Tank level');
            await fresh.getByLabel('Unit').fill('ft');
            await fresh.getByLabel('Tag path').fill('{asset.path}/Level');
            await fresh.getByLabel('Tag path').press('Enter');
            await expect(page.locator('.mapstudio-kv-row[data-key="tanklevel"][data-new="false"]')).toHaveCount(1, { timeout: REPLY_MS });
            await expect(keyValues).toHaveAttribute('data-rows', '4');
            await expect(page.locator('.mapstudio-kv-add')).toHaveCount(0);
            await settled(page);

            // Star it: one star only. Switch Flow off.
            await field(page, 'kpis.tanklevel.icon').locator('button').click();
            await expect(field(page, 'kpis.tanklevel.icon').locator('button')).toHaveAttribute('aria-pressed', 'true');
            await settled(page);
            await expect(field(page, 'kpis.pressure.icon').locator('button')).toHaveAttribute('aria-pressed', 'false');
            await field(page, 'kpis.flow.on').locator('input').uncheck();
            await settled(page);
            let stored = (await setupOf(page, 'pad')).setup;
            expect(stored.kpis.map((k) => [k.key, k.icon, k.on])).toEqual([['pressure', false, true], ['flow', false, false], ['gasprice', false, true],
                ['tanklevel', true, true]]);
            expect(stored.kpis[2]).toEqual({ key: 'gasprice', label: 'Gas price', path: '[default]Shared/GasPrice', unit: '', on: true, icon: false });
            expect(stored.kpis[3]).toMatchObject({ label: 'Tank level', unit: 'ft', path: '{asset.path}/Level' });

            // K4: the alarm source, and the popup's Comms and Alarm summary off; everything else as it was.
            await type(page, 'alarms.path', '{asset.path}/Alarms');
            await settled(page);
            await field(page, 'popup.comms').locator('input').uncheck();
            await settled(page);
            await expect(field(page, 'comms.on').locator('input')).not.toBeChecked();
            await field(page, 'popup.alarmSummary').locator('input').uncheck();
            await settled(page);
            stored = (await setupOf(page, 'pad')).setup;
            expect(stored.comms).toEqual({ path: '{asset.path}/Comms', on: false });
            expect(stored.alarms).toEqual({ path: '{asset.path}/Alarms', count: true, summary: false });
            expect(stored.styleRule).toEqual(before.setup.styleRule);
            expect(stored.link).toBe(before.setup.link);
            await section(page, 'keyValues').scrollIntoViewIfNeeded();
            await shot(page, 'mapstudio-kinds-keyvalues-1366.png');

            // A pad's popup follows: Flow, switched off, is not in it, and neither is Comms.
            await page.locator('.mapstudio-rail-item[data-surface="view"]').click();
            await expect(map).toHaveAttribute('data-mode', 'view');
            await view(page, map, TRACER.center, TRACER.zoom);
            await loadedCounts(map);
            const box = await map.boundingBox();
            const [x, y] = pagePixel(box, TRACER.points.p1.lngLat, TRACER.center, TRACER.zoom);
            await page.mouse.click(x, y);
            const popup = page.locator('.mapstudio-popup--default');
            await expect(popup).toBeVisible({ timeout: REPLY_MS });
            await expect.poll(() => popup.locator('.mapstudio-popup-kpi').evaluateAll((els) => els.map((e) => e.dataset.kpi)), { timeout: INTERVAL_MS })
                .toEqual(['pressure', 'gasprice', 'tanklevel']);
            await expect(popup.locator('.mapstudio-popup-comms')).toHaveCount(0);
        });

    editorTest('K5, K6, K7: a refused link and refused params say the Gateway\'s words beside the field and save nothing; the placeholder picker',
        async ({ page, browser }) => {
            editorTest.setTimeout(300_000);
            // The seed's setup again (the test before changed it).
            await restore(browser);
            const map = await openEditor(page);
            const before = await setupOf(page, 'pad');
            await openKinds(page, map);

            // K5: the Gateway's words beside Link, without "Op 0 (pad):"; the field keeps what was typed and the stored link stands.
            await type(page, 'link', '//x');
            const refusal = field(page, 'link').locator('.mapstudio-field-refusal');
            await expect(refusal).toHaveText('link is a Perspective page path starting with one / (/pad/{item.name}), not //x.', { timeout: REPLY_MS });
            await expect(input(page, 'link')).toHaveValue('//x');
            await expect(input(page, 'link')).toHaveAttribute('aria-invalid', 'true');
            await expect(page.locator('.mapstudio-kindsetup')).toHaveAttribute('data-saving', '');
            expect((await setupOf(page, 'pad'))).toEqual(before);
            // Nowhere says Saved: the header says Not saved, the map's save state is refused, and no edit waits in the queue.
            await expect(saveWords(page)).toHaveText('Not saved');
            await expect(page.getByText('Saved', { exact: true })).toHaveCount(0);
            await expect(map).toHaveAttribute('data-save-state', 'refused');
            await expect(map).toHaveAttribute('data-save-code', 'invalid');
            await expect(map).toHaveAttribute('data-unsaved-count', '0');
            await expect(page.locator('.mapstudio-save-card')).toHaveCount(0);
            // The words in view under their field, for the render.
            await field(page, 'link').evaluate((el) => el.scrollIntoView({ block: 'center' }));
            await shot(page, 'mapstudio-kinds-refusal-1366.png');
            // Esc puts the stored link back and the words go.
            await input(page, 'link').focus();
            await input(page, 'link').press('Escape');
            await expect(input(page, 'link')).toHaveValue('/pad/{item.name}');
            await expect(refusal).toHaveCount(0);
            await expect(saveWords(page)).toHaveText('Saved');

            // K6: a param named mapItem, then a value that mixes text and a placeholder: each refused beside its row, nothing saved.
            await type(page, 'popupView.path', 'Popups/PadDetails');
            await settled(page);
            await page.locator('.mapstudio-param-add').click();
            const fresh = page.locator('.mapstudio-param-row[data-new="true"]');
            await fresh.getByLabel('Param name').fill('mapItem');
            await fresh.getByLabel('Param value').fill('{item.id}');
            await fresh.getByLabel('Param value').press('Enter');
            await expect(fresh.locator('.mapstudio-field-refusal'))
                .toHaveText('the popup view always receives the map item as mapItem, so no param may be named mapItem.', { timeout: REPLY_MS });
            await expect(fresh).toHaveAttribute('data-field', 'popupView.params.mapItem');
            expect((await setupOf(page, 'pad')).setup.popupView).toEqual({ path: 'Popups/PadDetails' });
            await fresh.getByLabel('Param name').fill('padName');
            await fresh.getByLabel('Param value').fill('a {item.name}');
            await fresh.getByLabel('Param value').press('Enter');
            await expect(fresh.locator('.mapstudio-field-refusal')).toHaveText(/^a \{item\.name\} mixes text and placeholders; a param is a literal/, { timeout: REPLY_MS });
            await expect(fresh.locator('.mapstudio-field-refusal')).toHaveCount(1);
            await expect(page.locator('.mapstudio-kindsetup-top-refusal')).toHaveCount(0);
            await expect(fresh.getByLabel('Param value')).toHaveValue('a {item.name}');
            expect((await setupOf(page, 'pad')).setup.popupView).toEqual({ path: 'Popups/PadDetails' });
            await expect(saveWords(page)).toHaveText('Not saved');

            // K7: the picker lists the closed list with the pad's field keys; the one chosen is the value, saved when finished.
            await fresh.locator('.mapstudio-placeholder-button').click();
            const menu = page.locator('.mapstudio-placeholder-menu');
            expect(await menu.locator('[role="menuitem"]').evaluateAll((els) => els.map((e) => e.textContent))).toEqual([
                '{item.id}', '{item.name}', '{asset.id}', '{asset.path}', '{item.properties.operator}', '{item.properties.wells}', '{item.properties.status}']);
            await menu.locator('[data-placeholder="{item.name}"]').click();
            await expect(menu).toHaveCount(0);
            await expect(fresh.getByLabel('Param value')).toHaveValue('{item.name}');
            await expect(fresh.getByLabel('Param value')).toBeFocused();
            await page.keyboard.press('Enter');
            const saved = page.locator('.mapstudio-param-row[data-name="padName"][data-new="false"]');
            await expect(saved).toHaveCount(1, { timeout: REPLY_MS });
            await expect(fresh).toHaveCount(0);
            await settled(page);
            expect((await setupOf(page, 'pad')).setup.popupView).toEqual({ path: 'Popups/PadDetails', params: { padName: '{item.name}' } });
            // The Popup view emptied while it has a param is not sent: the words beside the field, the stored view and its param kept.
            await type(page, 'popupView.path', '');
            await expect(field(page, 'popupView.path').locator('.mapstudio-field-problem')).toHaveText('Remove its params first. The popup view is kept.');
            await expect(input(page, 'popupView.path')).toHaveValue('');
            await page.waitForTimeout(NOTHING_MS);
            expect((await setupOf(page, 'pad')).setup.popupView).toEqual({ path: 'Popups/PadDetails', params: { padName: '{item.name}' } });
            await input(page, 'popupView.path').focus();
            await input(page, 'popupView.path').press('Escape');
            await expect(input(page, 'popupView.path')).toHaveValue('Popups/PadDetails');
            await expect(field(page, 'popupView.path').locator('.mapstudio-field-problem')).toHaveCount(0);
            // The link's picker inserts at the cursor; Esc closes the menu with the focus back on its button.
            await input(page, 'link').focus();
            await page.keyboard.press('End');
            await page.keyboard.type('/');
            await field(page, 'link').locator('.mapstudio-placeholder-button').click();
            await page.keyboard.press('Escape');
            await expect(menu).toHaveCount(0);
            await expect(field(page, 'link').locator('.mapstudio-placeholder-button')).toBeFocused();
            await page.keyboard.press('Enter');
            await menu.locator('[data-placeholder="{asset.id}"]').click();
            await expect(input(page, 'link')).toHaveValue('/pad/{item.name}/{asset.id}');
            await page.keyboard.press('Enter');
            await settled(page);
            const stored = (await setupOf(page, 'pad')).setup;
            expect(stored.link).toBe('/pad/{item.name}/{asset.id}');
            expect(stored.styleRule).toEqual(before.setup.styleRule);
            expect(stored.kpis).toEqual(before.setup.kpis);
            await section(page, 'popup').scrollIntoViewIfNeeded();
            await shot(page, 'mapstudio-kinds-popup-1366.png');
        });

    editorTest('K8, K9: a kind with no setup is saved as a create; with no linked item one note says so and none stands under the paths',
        async ({ page }) => {
            editorTest.setTimeout(240_000);
            const map = await openEditor(page);
            expect(await setupOf(page, 'meter')).toBeUndefined();
            await openKinds(page, map);
            const panel = await chooseKind(page, 'meter');
            await expect(panel).toHaveAttribute('data-version', '0');
            await expect(panel.locator('.mapstudio-kindsetup-subline')).toHaveText('Point - applies to 0 items - no overrides');
            await expect(field(page, 'preview').locator('select')).toBeDisabled();
            await expect(field(page, 'preview').locator('.mapstudio-kindsetup-preview-none'))
                .toHaveText('No meter is linked to an asset yet, so its tag paths cannot be checked.');
            await expect(section(page, 'keyValues')).toContainText('No key values yet');
            await expect(field(page, 'popup.comms').locator('input')).toBeDisabled();

            await type(page, 'comms.path', '{asset.path}/Comms');
            await settled(page);
            const stored = await setupOf(page, 'meter');
            expect(stored.setup).toEqual({ comms: { path: '{asset.path}/Comms' } });
            await expect(panel).toHaveAttribute('data-version', String(stored.version));
            await expect(field(page, 'popup.comms').locator('input')).toBeEnabled();
            await expect(field(page, 'popup.comms').locator('input')).toBeChecked();
            // No note under the path: there is no item to check it for.
            await expect(panel.locator('.mapstudio-resolve-note')).toHaveCount(0);
        });

    editorTest('K11: another editor saves the kind while a field is typed in; the typed text stays, its save is a conflict with one choice',
        async ({ page, browser }) => {
            editorTest.setTimeout(300_000);
            await restore(browser);
            const map = await openEditor(page);
            const other = await signedInContext(browser, EDITOR2_USER, { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
            try {
                const theirs = await other.newPage();
                await mapLoaded(await openMap(theirs, '/edit'));
                await expect(theirs.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR2_USER);
                const panel = await openKinds(page, map);
                const before = await setupOf(page, 'pad');

                // A types in Link and has not finished.
                await input(page, 'link').fill('/mine');
                await expect(input(page, 'link')).toBeFocused();
                // B saves the comms path.
                const reply = await send(theirs, 'edits.apply', { batchId: randomUUID(), ops: [{ op: 'update', entity: 'kindSetup', id: 'pad',
                    baseVersion: before.version, data: { setup: { ...before.setup, comms: { path: '{asset.path}/Heartbeat', on: true } } } }] });
                expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
                // B's other fields appear with no reload; A's typed text stays.
                await expect(input(page, 'comms.path')).toHaveValue('{asset.path}/Heartbeat', { timeout: REPLY_MS });
                await expect(panel).toHaveAttribute('data-version', String(before.version + 1));
                await expect(input(page, 'link')).toHaveValue('/mine');
                await expect(input(page, 'link')).toBeFocused();

                // A finishes the field: refused, the conflict card names B and offers only B's version.
                await page.keyboard.press('Enter');
                const card = page.locator('.mapstudio-save-card[data-card="conflict"]');
                await expect(card).toBeVisible({ timeout: REPLY_MS });
                await expect(card.locator('.mapstudio-save-card-title')).toHaveText('Not saved - conflict with ' + EDITOR2_USER + "'s change");
                await expect(card.locator('.mapstudio-save-card-text')).toHaveText(
                    new RegExp('^' + EDITOR2_USER + ' changed the Well pad kind setup at \\d\\d:\\d\\d, while you were editing it\\.$'));
                await expect(card.locator('.mapstudio-save-card-kept')).toHaveText('Your change, kept here and not saved: a change to the Well pad kind setup.');
                await expect(card.locator('.mapstudio-save-card-theirs')).toHaveText('Use ' + EDITOR2_USER + "'s version");
                await expect(card.locator('.mapstudio-save-card-ontop')).toHaveCount(0);
                await expect(card).toHaveAttribute('data-on-top', 'false');
                // Nothing lost silently: the typed text is still in the field, the fields paused with the card's words, the store B's.
                await expect(panel).toHaveAttribute('data-paused', 'Not saved - conflict with ' + EDITOR2_USER + "'s change");
                await expect(panel.locator('.mapstudio-kindsetup-paused')).toHaveText('Not saved - conflict with ' + EDITOR2_USER + "'s change");
                await expect(input(page, 'link')).toHaveValue('/mine');
                await expect(input(page, 'link')).toBeDisabled();
                await expect(saveWords(page)).toHaveText('Not saved');
                expect((await setupOf(page, 'pad')).setup.link).toBe('/pad/{item.name}');
                await shot(page, 'mapstudio-kinds-conflict-1366.png');

                await card.locator('.mapstudio-save-card-theirs').click();
                await expect(card).toHaveCount(0);
                await expect(panel).toHaveAttribute('data-paused', '');
                await expect(input(page, 'link')).toHaveValue('/pad/{item.name}');
                await expect(input(page, 'link')).toBeEnabled();
                await expect(input(page, 'comms.path')).toHaveValue('{asset.path}/Heartbeat');
                await expect(map).toHaveAttribute('data-unsaved-count', '0');

                // Typed again on B's version, it saves.
                await type(page, 'link', '/mine');
                await settled(page);
                const stored = await setupOf(page, 'pad');
                expect(stored.setup).toEqual({ ...before.setup, comms: { path: '{asset.path}/Heartbeat', on: true }, link: '/mine' });
                expect(stored.version).toBe(before.version + 2);
            } finally {
                await other.close();
            }
        });
});
