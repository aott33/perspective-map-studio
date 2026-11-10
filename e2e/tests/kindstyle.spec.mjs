// The Style rule editor and the area tints in a kind's setup (epic-editing entry 12b1; DESIGN.md Kind setup and key screen 6,
// kinds-style): the plan's matrix S1 to S9 at 1366 px on the dev stack, as the map editor in Edit mode. S1: a Bands rule on
// Pressure built in the Well pad's section 6, nothing sent until it is whole, every pad drawing by it within one refresh interval
// with no reload. S2: States on a typed tag path, a tile per case; a duplicate value is "Not saved yet". S3: a half-built band. S4:
// an expression saved, then one the Gateway cannot read refused with its reason beside the field. S5: From its instruments on the
// Gathering line, absent for a point and an area kind. S6: None removes the rule and "Used by style rule". S7: a type switched
// away from and back has its cases again. S8: a refusal of the Gateway beside the control it names (the tag path; a refused case's
// place by its sent index is Jest's, since the browser's shape check lets no bad case through). S9: the Geofence's tints (the dev
// kind's operator is a text field, so its categories are typed; a choice field's rows are Jest's). S10 (every other part stored
// unchanged) is asserted after each save here and for each seed setup in Jest (web/typescript/__tests__/kindSetup.test.ts). S11 is
// recentchanges.spec.mjs B5. The spec runs the seed again (which restores the five seed setups) and deletes the Meter setup it
// makes, before and after: styles.spec.mjs and instruments.spec.mjs expect the seed's rules.

import { randomUUID } from 'node:crypto';
import {
    EDITOR2_USER, EDITOR_USER, editorTest, ensureSeeded, expect, mapLoaded, openMap, removeStrays, runSeed, send, shot, signedInContext, test
} from './fixtures.mjs';

/** The Gateway's answer to a save. */
const REPLY_MS = 20_000;
/** One refresh interval of the dev setup (10 s) with its round trips, as live.spec.mjs bounds it. */
const INTERVAL_MS = 25_000;
/** There is nothing to observe when nothing is sent: the time a stray batch would have to show in the map's seq. */
const NOTHING_MS = 800;

let seed;

test.beforeAll(async ({ browser }) => {
    seed = await ensureSeeded(browser);
    await restore(browser);
});

test.afterAll(async ({ browser }) => {
    await restore(browser);
});

/** The seed's own items and kind setups again, no stray item and no Meter setup. */
async function restore(browser) {
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
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

/** A setup without the part an edit is allowed to change: what S10 says is stored unchanged. */
function others(setup, part) {
    const out = { ...setup };
    delete out[part];
    return out;
}

async function openEditor(page) {
    const map = await openMap(page, '/edit');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', 'full');
    await expect(map).toHaveAttribute('data-studio', 'on');
    return map;
}

/** Kinds opened from the rail and a kind chosen: its setup in the properties panel's place, section 6 in view. */
async function openKind(page, map, kindId) {
    await page.locator('.mapstudio-rail-item[data-surface="kinds"]').click();
    await expect(map).toHaveAttribute('data-surface', 'kinds');
    await page.locator('.mapstudio-kind-row[data-kind="' + kindId + '"]').click();
    const panel = page.locator('.mapstudio-kindsetup');
    await expect(panel).toHaveAttribute('data-kind', kindId);
    await rule(page).scrollIntoViewIfNeeded();
    return panel;
}

const rule = (page) => page.locator('.mapstudio-kindsetup [data-section="styleRule"]');
const typeButton = (page, type) => rule(page).locator('.mapstudio-rule-type[data-type="' + type + '"]');
const source = (page) => rule(page).locator('[data-field="styleRule.source"]');
const cases = (page) => rule(page).locator('.mapstudio-rule-case');
const caseRow = (page, index) => rule(page).locator('.mapstudio-rule-case[data-index="' + index + '"]');
const unsaved = (page) => rule(page).locator('.mapstudio-rule-unsaved');
const tints = (page) => rule(page).locator('[data-field="areaTints"]');
const tintRow = (page, category) => tints(page).locator('.mapstudio-tint-row[data-category="' + category + '"]');
const liveItem = (page, id) => page.locator('.mapstudio-live-item[data-item-id="' + id + '"]');
const saveWords = (page) => page.locator('.mapstudio-kinds .mapstudio-panel-save');

/** Type a text input's whole value and finish it with Enter. */
async function type(locator, text) {
    await locator.fill(text);
    await locator.press('Enter');
}

/** The panel has nothing on its way and the header says Saved. */
async function settled(page) {
    await expect(page.locator('.mapstudio-kindsetup')).toHaveAttribute('data-saving', '', { timeout: REPLY_MS });
    await expect(saveWords(page)).toHaveText('Saved', { timeout: REPLY_MS });
}

/** Nothing was sent: the store's seq and the kind's stored version stand. */
async function nothingSent(page, map, seq, kindId, version) {
    await page.waitForTimeout(NOTHING_MS);
    await expect(map).toHaveAttribute('data-store-seq', seq);
    await expect(page.locator('.mapstudio-kindsetup')).toHaveAttribute('data-version', String(version));
    const stored = await setupOf(page, kindId);
    expect(stored ? stored.version : 0).toBe(version);
}

/** The section's screenshot beside the page's: the panel's part that holds section 6. */
async function ruleShot(page, name) {
    await rule(page).scrollIntoViewIfNeeded();
    await shot(page, name);
}

editorTest.describe('the Style rule editor at 1366 px', () => {
    editorTest.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
    editorTest.describe.configure({ mode: 'serial' });

    editorTest('S1, S3, S7: a Bands rule on Pressure is sent only once it is whole, and every pad draws by it within one refresh interval',
        async ({ page }) => {
            editorTest.setTimeout(300_000);
            const map = await openEditor(page);
            await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
            const before = await setupOf(page, 'pad');
            const ctb1 = liveItem(page, seed.ids['swd/ctb1']);
            const swd1 = liveItem(page, seed.ids['swd/swd1']);
            await expect(ctb1).toHaveAttribute('data-kpi', /psi$/, { timeout: INTERVAL_MS });
            await expect(swd1).toHaveAttribute('data-kpi', /psi$/, { timeout: INTERVAL_MS });
            const reloads = await map.getAttribute('data-map-reloads');
            const panel = await openKind(page, map, 'pad');
            const seq = await map.getAttribute('data-store-seq');

            // The stored States rule on a tag path: its type pressed, its four cases, no From its instruments for a point kind.
            await expect(rule(page)).toHaveAttribute('data-rule', 'states');
            await expect(typeButton(page, 'states')).toHaveAttribute('aria-pressed', 'true');
            await expect(rule(page).locator('.mapstudio-rule-type')).toHaveText(['None', 'States', 'Bands', 'Expression']);
            await expect(cases(page)).toHaveCount(4);
            await expect(unsaved(page)).toHaveCount(0);

            // Bands chosen: not whole, so "Not saved yet" says what is missing and nothing is sent.
            await typeButton(page, 'bands').click();
            await expect(rule(page)).toHaveAttribute('data-rule', 'bands');
            await expect(unsaved(page)).toHaveText('Not saved yet. Add a band.');
            await source(page).locator('select').selectOption('kpi:pressure');
            await rule(page).locator('.mapstudio-rule-add').click();
            await expect(cases(page)).toHaveCount(1);
            // S3: a band with its from above its to and no preset.
            await type(caseRow(page, 0).locator('.mapstudio-rule-from'), '900');
            await type(caseRow(page, 0).locator('.mapstudio-rule-to'), '600');
            await expect(unsaved(page)).toHaveText('Not saved yet. Band 1: its from (900) is not below its to (600). Band 1 has no preset.');
            await expect(caseRow(page, 0).locator('.mapstudio-rule-from')).toHaveAttribute('aria-invalid', 'true');
            await expect(caseRow(page, 0).locator('.mapstudio-rule-from')).toHaveAttribute('aria-describedby', await unsaved(page).getAttribute('id'));
            await expect(rule(page)).toHaveAttribute('data-unsaved', 'true');
            await expect(caseRow(page, 0).locator('.mapstudio-rule-tile')).toHaveAttribute('data-preset', '');
            await nothingSent(page, map, seq, 'pad', before.version);
            expect((await setupOf(page, 'pad')).setup).toEqual(before.setup);
            await ruleShot(page, 'mapstudio-kindstyle-unsaved-1366.png');

            // S7: States again has the four stored cases; Bands again has the band as typed. Still nothing sent.
            await typeButton(page, 'states').click();
            await expect(cases(page)).toHaveCount(4);
            await expect(unsaved(page)).toHaveCount(0);
            await typeButton(page, 'bands').click();
            await expect(cases(page)).toHaveCount(1);
            await expect(caseRow(page, 0).locator('.mapstudio-rule-from')).toHaveValue('900');
            await expect(caseRow(page, 0).locator('.mapstudio-rule-to')).toHaveValue('600');
            await nothingSent(page, map, seq, 'pad', before.version);

            // The first band, below 0 normal, is a whole rule by itself: it is saved as soon as its preset is picked.
            await type(caseRow(page, 0).locator('.mapstudio-rule-from'), '');
            await type(caseRow(page, 0).locator('.mapstudio-rule-to'), '0');
            await expect(unsaved(page)).toHaveText('Not saved yet. Band 1 has no preset.');
            await nothingSent(page, map, seq, 'pad', before.version);
            await caseRow(page, 0).locator('.mapstudio-rule-preset').selectOption('normal');
            await settled(page);
            const one = await setupOf(page, 'pad');
            expect(one.version).toBe(before.version + 1);
            expect(one.setup.styleRule).toEqual({ source: { kpi: 'pressure' }, type: 'bands', cases: [{ min: null, max: 0, preset: 'normal' }] });
            // A second band, 0 and above: until it has its preset nothing is sent and the one-band rule stands.
            const seqOne = await map.getAttribute('data-store-seq');
            await rule(page).locator('.mapstudio-rule-add').click();
            await type(caseRow(page, 1).locator('.mapstudio-rule-from'), '0');
            await expect(unsaved(page)).toHaveText('Not saved yet. Band 2 has no preset.');
            await nothingSent(page, map, seqOne, 'pad', one.version);
            const changed = Date.now();
            await caseRow(page, 1).locator('.mapstudio-rule-preset').selectOption('fault');
            await settled(page);
            await expect(unsaved(page)).toHaveCount(0);
            const after = await setupOf(page, 'pad');
            expect(after.version).toBe(before.version + 2);
            expect(after.setup.styleRule).toEqual({ source: { kpi: 'pressure' }, type: 'bands',
                cases: [{ min: null, max: 0, preset: 'normal' }, { min: 0, max: null, preset: 'fault' }] });
            // S10: every other part as it was.
            expect(others(after.setup, 'styleRule')).toEqual(others(before.setup, 'styleRule'));
            await expect(panel).toHaveAttribute('data-version', String(after.version));
            // The tiles: the kind's icon in each band's preset, the state word with it.
            await expect(caseRow(page, 0).locator('.mapstudio-rule-tile')).toHaveAttribute('data-preset', 'normal');
            await expect(caseRow(page, 1).locator('.mapstudio-rule-tile')).toHaveAttribute('data-preset', 'fault');
            await expect(caseRow(page, 1).locator('.mapstudio-rule-tile .mapstudio-rule-sample > svg')).toHaveCount(1);
            await expect(caseRow(page, 1).locator('.mapstudio-rule-word')).toHaveText('Fault');
            const tile = await caseRow(page, 1).locator('.mapstudio-rule-tile').boundingBox();
            expect(Math.round(tile.width)).toBe(64);
            // The key value the saved rule reads says so, and its Remove is off.
            await expect(page.locator('.mapstudio-kv-row[data-key="pressure"] .mapstudio-kv-used')).toHaveText('Used by style rule');
            await ruleShot(page, 'mapstudio-kindstyle-bands-1366.png');

            // Every pad with a pressure draws by the rule within one refresh interval, with no reload.
            await expect(ctb1).toHaveAttribute('data-style', 'fault', { timeout: INTERVAL_MS });
            await expect(swd1).toHaveAttribute('data-style', 'fault', { timeout: INTERVAL_MS });
            expect(Date.now() - changed).toBeLessThan(INTERVAL_MS);
            await expect(ctb1).toHaveAttribute('data-word', 'Fault');
            await expect(map).toHaveAttribute('data-map-reloads', reloads);
        });

    editorTest('S2: States on a typed tag path, a tile per case; a second case of a value is not sent', async ({ page, browser }) => {
        editorTest.setTimeout(240_000);
        await restore(browser);
        const map = await openEditor(page);
        const panel = await openKind(page, map, 'meter');
        await expect(panel).toHaveAttribute('data-version', '0');
        await expect(rule(page)).toHaveAttribute('data-rule', 'none');
        await expect(rule(page).locator('.mapstudio-rule-none')).toHaveText('No style rule');
        const seq = await map.getAttribute('data-store-seq');

        await typeButton(page, 'states').click();
        await expect(unsaved(page)).toHaveText('Not saved yet. Pick the value the rule reads. Add a case.');
        await source(page).locator('select').selectOption('path');
        await type(source(page).locator('.mapstudio-rule-path'), '{asset.path}/Status');
        const presets = ['attention', 'warning', 'fault', 'dimmed'];
        for (let i = 0; i < 4; i++) {
            await rule(page).locator('.mapstudio-rule-add').click();
            await expect(caseRow(page, i).locator('.mapstudio-field-label')).toHaveText('When the value is');
            await type(caseRow(page, i).locator('.mapstudio-rule-value'), String(i + 1));
            if (i < 3) {
                // Whole after each preset: the rule is saved as it grows, one save at a time.
                await caseRow(page, i).locator('.mapstudio-rule-preset').selectOption(presets[i]);
                await settled(page);
            }
        }
        await expect(unsaved(page)).toHaveText('Not saved yet. Case 4 has no preset.');
        await caseRow(page, 3).locator('.mapstudio-rule-preset').selectOption('dimmed');
        await settled(page);
        const stored = await setupOf(page, 'meter');
        expect(stored.setup).toEqual({ styleRule: { source: { path: '{asset.path}/Status' }, type: 'states',
            cases: presets.map((preset, i) => ({ value: i + 1, preset })) } });
        // Each row's tile shows its preset and the preset's word.
        const words = ['Attention', 'Warning', 'Fault', 'Out of service'];
        for (let i = 0; i < 4; i++) {
            await expect(caseRow(page, i).locator('.mapstudio-rule-tile')).toHaveAttribute('data-preset', presets[i]);
            await expect(caseRow(page, i).locator('.mapstudio-rule-word')).toHaveText(words[i]);
        }
        // A point kind is offered no line preset, and never a colour.
        await expect(caseRow(page, 0).locator('.mapstudio-rule-preset option')).toHaveText(['Pick a preset', 'normal', 'attention', 'warning', 'fault', 'dimmed']);
        await expect(rule(page).locator('input[type="color"]')).toHaveCount(0);
        await ruleShot(page, 'mapstudio-kindstyle-states-1366.png');

        // A second case for the value 2: "Not saved yet" names it, nothing is sent and the stored rule stands.
        const sent = await map.getAttribute('data-store-seq');
        expect(Number(sent)).toBeGreaterThan(Number(seq));
        await rule(page).locator('.mapstudio-rule-add').click();
        await type(caseRow(page, 4).locator('.mapstudio-rule-value'), '2');
        await caseRow(page, 4).locator('.mapstudio-rule-preset').selectOption('normal');
        await expect(unsaved(page)).toHaveText('Not saved yet. Case 5 has the same value as case 2 (2): each value has one case.');
        await nothingSent(page, map, sent, 'meter', stored.version);
        // 2 as text is another case (docs/kind-setup.md): saved.
        await type(caseRow(page, 4).locator('.mapstudio-rule-value'), '"2"');
        await settled(page);
        expect((await setupOf(page, 'meter')).setup.styleRule.cases[4]).toEqual({ value: '2', preset: 'normal' });
        // Keyboard: the delete icon is reached and pressed with the keyboard, and the rule is saved without the case.
        await caseRow(page, 4).locator('.mapstudio-rule-remove').focus();
        await page.keyboard.press('Enter');
        await expect(cases(page)).toHaveCount(4);
        await settled(page);
        expect((await setupOf(page, 'meter')).setup.styleRule.cases).toHaveLength(4);
    });

    editorTest('S4, S8: an expression is saved when the field is left; one the Gateway cannot read, and a bad tag path, are refused beside their field',
        async ({ page, browser }) => {
            editorTest.setTimeout(240_000);
            await restore(browser);
            const map = await openEditor(page);
            await openKind(page, map, 'pad');
            const before = await setupOf(page, 'pad');
            await typeButton(page, 'expression').click();
            await expect(unsaved(page)).toHaveText('Not saved yet. Type the expression.');
            const expression = rule(page).locator('[data-field="styleRule.expression"]');
            const text = "if({value} > 600, 'warning', 'normal')";
            await expect(expression.locator('.mapstudio-field-hint')).toContainText('{value} is the one reference');
            await expect(expression.locator('.mapstudio-field-hint')).toContainText('The result is a preset name, as text: normal, attention, warning, fault, dimmed.');
            await expression.locator('textarea').fill(text);
            // The stored value the rule read stays picked; an expression may also have none.
            await expect(source(page)).toHaveAttribute('data-source', 'path');
            await expression.locator('textarea').blur();
            await settled(page);
            const first = await setupOf(page, 'pad');
            expect(first.setup.styleRule).toEqual({ source: { path: '{asset.path}/Status' }, type: 'expression', expression: text });
            expect(others(first.setup, 'styleRule')).toEqual(others(before.setup, 'styleRule'));
            // The tiles of an expression are the presets its text names.
            await expect(expression.locator('.mapstudio-rule-tile')).toHaveCount(2);
            await ruleShot(page, 'mapstudio-kindstyle-expression-1366.png');

            // "if(" cannot be read: the Gateway's reason beside the field, the text kept, the first expression still stored.
            await expression.locator('textarea').fill('if(');
            await expression.locator('textarea').blur();
            const refusal = expression.locator('.mapstudio-field-refusal-text');
            await expect(refusal).toContainText('the expression could not be read', { timeout: REPLY_MS });
            await expect(refusal).not.toContainText('Op 0');
            await expect(refusal).not.toContainText('styleRule.expression');
            await expect(expression.locator('textarea')).toHaveValue('if(');
            await expect(expression.locator('textarea')).toHaveAttribute('aria-invalid', 'true');
            await expect(page.locator('.mapstudio-kindsetup')).toHaveAttribute('data-saving', '');
            await expect(saveWords(page)).not.toHaveText('Saved');
            expect((await setupOf(page, 'pad')).setup.styleRule.expression).toBe(text);
            await ruleShot(page, 'mapstudio-kindstyle-expression-refused-1366.png');
            // Put right, it is saved and the reason goes.
            await expression.locator('textarea').fill("if({value} > 700, 'fault', 'normal')");
            await expression.locator('textarea').blur();
            await settled(page);
            await expect(expression.locator('.mapstudio-field-refusal')).toHaveCount(0);

            // S8: a tag path the Gateway refuses: its words beside the value, the stored rule as it was.
            const stored = await setupOf(page, 'pad');
            // The typed path comes back when the value leaves "A tag path" and returns; nothing is saved by the round trip's end.
            await source(page).locator('select').selectOption('kpi:pressure');
            await settled(page);
            await source(page).locator('select').selectOption('path');
            await expect(source(page).locator('.mapstudio-rule-path')).toHaveValue('{asset.path}/Status');
            await settled(page);
            expect((await setupOf(page, 'pad')).setup).toEqual(stored.setup);
            // The type already chosen, pressed again, changes nothing.
            const version = (await setupOf(page, 'pad')).version;
            await typeButton(page, 'expression').click();
            await type(source(page).locator('.mapstudio-rule-path'), 'nope');
            const words = source(page).locator('.mapstudio-field-refusal-text');
            await expect(words).toContainText('nope is not a tag path', { timeout: REPLY_MS });
            await expect(words).not.toContainText('Op 0');
            await expect(rule(page).locator('.mapstudio-field-refusal')).toHaveCount(1);
            await expect(page.locator('.mapstudio-kindsetup-top-refusal')).toHaveCount(0);
            expect((await setupOf(page, 'pad')).setup).toEqual(stored.setup);
            expect((await setupOf(page, 'pad')).version).toBe(version);
            // The refusal stands when the chosen type is pressed again.
            await typeButton(page, 'expression').click();
            await expect(words).toContainText('nope is not a tag path');
        });

    editorTest('S5, S6: From its instruments on a line kind only; None removes the rule and "Used by style rule"', async ({ page, browser }) => {
        editorTest.setTimeout(240_000);
        await restore(browser);
        const map = await openEditor(page);
        await openKind(page, map, 'line');
        const before = await setupOf(page, 'line');
        const flow = page.locator('.mapstudio-kv-row[data-key="flow"]');
        await expect(rule(page)).toHaveAttribute('data-rule', 'bands');
        await expect(cases(page)).toHaveCount(3);
        await expect(flow.locator('.mapstudio-kv-used')).toHaveText('Used by style rule');
        await expect(flow.locator('.mapstudio-kv-remove')).toBeDisabled();
        // A line kind is offered the line presets too.
        await expect(caseRow(page, 0).locator('.mapstudio-rule-preset option')).toHaveText(
            ['Pick a preset', 'normal', 'attention', 'warning', 'fault', 'dimmed', 'solid', 'dashed', 'dotted']);
        await expect(caseRow(page, 1).locator('.mapstudio-rule-tile .mapstudio-rule-sample > svg')).toHaveCount(1);

        // S5: From its instruments: no value, no cases, one line; saved as the instruments source.
        await expect(rule(page).locator('.mapstudio-rule-type')).toHaveText(['None', 'States', 'Bands', 'Expression', 'From its instruments']);
        await typeButton(page, 'instruments').click();
        await settled(page);
        await expect(rule(page).locator('.mapstudio-rule-instruments')).toHaveText('Each segment takes the worst of the instruments at its ends.');
        await expect(source(page)).toHaveCount(0);
        await expect(cases(page)).toHaveCount(0);
        const instruments = await setupOf(page, 'line');
        expect(instruments.setup).toEqual({ ...before.setup, styleRule: { source: { instruments: 'worst' } } });
        // The rule no longer reads Flow.
        await expect(flow.locator('.mapstudio-kv-used')).toHaveCount(0);
        await ruleShot(page, 'mapstudio-kindstyle-instruments-1366.png');

        // S7: Bands again has the three bands, and is saved as it was.
        await typeButton(page, 'bands').click();
        await expect(cases(page)).toHaveCount(3);
        await settled(page);
        expect((await setupOf(page, 'line')).setup).toEqual(before.setup);
        await expect(flow.locator('.mapstudio-kv-used')).toHaveText('Used by style rule');

        // S6: None removes the rule; the tag goes and Remove is on again.
        await typeButton(page, 'none').click();
        await settled(page);
        const none = await setupOf(page, 'line');
        expect(none.setup).toEqual(others(before.setup, 'styleRule'));
        await expect(rule(page).locator('.mapstudio-rule-none')).toHaveText('No style rule');
        await expect(flow.locator('.mapstudio-kv-used')).toHaveCount(0);
        await expect(flow.locator('.mapstudio-kv-remove')).toBeEnabled();
        await ruleShot(page, 'mapstudio-kindstyle-none-1366.png');

        // The choice is absent for a point kind and for an area kind.
        for (const kindId of ['pad', 'geofence']) {
            await page.locator('.mapstudio-kind-row[data-kind="' + kindId + '"]').click();
            await expect(page.locator('.mapstudio-kindsetup')).toHaveAttribute('data-kind', kindId);
            await expect(rule(page).locator('.mapstudio-rule-type')).toHaveCount(4);
            await expect(typeButton(page, 'instruments')).toHaveCount(0);
        }
    });

    editorTest('S9: an area kind\'s tints: the property, a row per category with its tint and swatch; the areas draw by them; absent for other kinds',
        async ({ page, browser }) => {
            editorTest.setTimeout(240_000);
            await restore(browser);
            const map = await openEditor(page);
            const reloads = await map.getAttribute('data-map-reloads');
            const north = seed.ids['areas/north'];
            const south = seed.ids['areas/south'];
            const drawn = async () => {
                const areas = JSON.parse(await map.getAttribute('data-areas'));
                const byId = Object.fromEntries(areas.map((a) => [a.id, a.tint]));
                return [byId[north], byId[south]];
            };
            await expect.poll(drawn, { timeout: INTERVAL_MS }).toEqual(['tint-1', 'tint-4']);
            await openKind(page, map, 'geofence');
            const before = await setupOf(page, 'geofence');
            await tints(page).scrollIntoViewIfNeeded();
            const property = tints(page).locator('.mapstudio-tints-property');
            await expect(property).toHaveValue('operator');
            await expect(property.locator('option')).toHaveText(['No tints', 'Operator']);
            await expect(tints(page).locator('.mapstudio-tint-row')).toHaveCount(2);
            await expect(tintRow(page, 'North').locator('.mapstudio-tint-select')).toHaveValue('tint-1');
            await expect(tintRow(page, 'South').locator('.mapstudio-tint-select')).toHaveValue('tint-4');
            await expect(tintRow(page, 'South').locator('.mapstudio-tint-select option')).toHaveText(
                ['No tint', 'tint-1', 'tint-2', 'tint-3', 'tint-4', 'tint-5', 'tint-6']);
            await expect(tintRow(page, 'South').locator('.mapstudio-tint-swatch .mapstudio-rule-sample > svg')).toHaveCount(1);
            await ruleShot(page, 'mapstudio-kindstyle-tints-1366.png');

            // South's tint changed: saved, and the area draws in it with no reload.
            await tintRow(page, 'South').locator('.mapstudio-tint-select').selectOption('tint-2');
            await settled(page);
            const changed = await setupOf(page, 'geofence');
            expect(changed.setup).toEqual({ areaTints: { property: 'operator', tints: [{ category: 'North', tint: 'tint-1' }, { category: 'South', tint: 'tint-2' }] } });
            expect(changed.version).toBe(before.version + 1);
            await expect.poll(drawn, { timeout: INTERVAL_MS }).toEqual(['tint-1', 'tint-2']);
            await expect(map).toHaveAttribute('data-map-reloads', reloads);

            // A category typed without a tint is not sent; with its tint it is saved.
            const seq = await map.getAttribute('data-store-seq');
            await tints(page).locator('.mapstudio-tint-add').click();
            const fresh = tints(page).locator('.mapstudio-tint-row').nth(2);
            await type(fresh.locator('input.mapstudio-tint-category'), 'West');
            await expect(tints(page).locator('.mapstudio-tints-unsaved')).toHaveText('Not saved yet. West has no tint.');
            // One hook each: the tints' note is not the rule's, and the row it names is tied to its words.
            await expect(unsaved(page)).toHaveCount(0);
            await expect(fresh.locator('.mapstudio-tint-select')).toHaveAttribute('aria-describedby',
                await tints(page).locator('.mapstudio-tints-unsaved').getAttribute('id'));
            await page.waitForTimeout(NOTHING_MS);
            await expect(map).toHaveAttribute('data-store-seq', seq);
            await tintRow(page, 'West').locator('.mapstudio-tint-select').selectOption('tint-6');
            await settled(page);
            expect((await setupOf(page, 'geofence')).setup.areaTints.tints).toHaveLength(3);
            await expect(tints(page).locator('.mapstudio-tints-unsaved')).toHaveCount(0);

            // The property emptied removes the part: the areas draw untinted. Picked again, the rows come back as typed.
            await property.selectOption('');
            await settled(page);
            expect((await setupOf(page, 'geofence')).setup).toEqual({});
            await expect(tints(page).locator('.mapstudio-tint-row')).toHaveCount(0);
            await expect.poll(drawn, { timeout: INTERVAL_MS }).toEqual(['', '']);
            await property.selectOption('operator');
            await expect(tints(page).locator('.mapstudio-tint-row')).toHaveCount(3);
            await settled(page);
            expect((await setupOf(page, 'geofence')).setup.areaTints.tints.map((t) => t.category)).toEqual(['North', 'South', 'West']);

            // Not an area: no tints.
            for (const kindId of ['pad', 'line']) {
                await page.locator('.mapstudio-kind-row[data-kind="' + kindId + '"]').click();
                await expect(page.locator('.mapstudio-kindsetup')).toHaveAttribute('data-kind', kindId);
                await expect(rule(page)).toBeVisible();
                await expect(tints(page)).toHaveCount(0);
            }
        });

    editorTest('two editors: another editor\'s rule saved while the cursor rests in section 6 is not overwritten; the next change is a conflict',
        async ({ page, browser }) => {
            editorTest.setTimeout(300_000);
            await restore(browser);
            const map = await openEditor(page);
            const other = await signedInContext(browser, EDITOR2_USER, { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
            try {
                const theirs = await other.newPage();
                await mapLoaded(await openMap(theirs, '/edit'));
                const panel = await openKind(page, map, 'pad');
                // A changes a case's preset: saved. The cursor stays in the section.
                await caseRow(page, 0).locator('.mapstudio-rule-preset').selectOption('normal');
                await settled(page);
                const mine = await setupOf(page, 'pad');
                await caseRow(page, 1).locator('.mapstudio-rule-preset').focus();
                // B saves another rule for the kind.
                const rule9 = { source: { path: '{asset.path}/Status' }, type: 'states', cases: [{ value: 9, preset: 'fault' }] };
                const reply = await send(theirs, 'edits.apply', { batchId: randomUUID(), ops: [{ op: 'update', entity: 'kindSetup', id: 'pad',
                    baseVersion: mine.version, data: { setup: { ...mine.setup, styleRule: rule9 } } }] });
                expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
                await expect(panel).toHaveAttribute('data-version', String(mine.version + 1), { timeout: REPLY_MS });
                // A's rows stay as typed while the cursor rests there.
                await expect(caseRow(page, 1).locator('.mapstudio-rule-preset')).toBeFocused();
                await expect(cases(page)).toHaveCount(4);
                // A's next change goes at the version its draft was in step with: a conflict, B's rule still stored.
                await caseRow(page, 1).locator('.mapstudio-rule-preset').selectOption('fault');
                const card = page.locator('.mapstudio-save-card[data-card="conflict"]');
                await expect(card).toBeVisible({ timeout: REPLY_MS });
                await expect(card.locator('.mapstudio-save-card-title')).toHaveText('Not saved - conflict with ' + EDITOR2_USER + "'s change");
                await expect(card).toHaveAttribute('data-on-top', 'false');
                expect((await setupOf(page, 'pad')).setup.styleRule).toEqual(rule9);
                await card.locator('.mapstudio-save-card-theirs').click();
                await expect(card).toHaveCount(0);
                // B's rule shows, and a change typed on it saves.
                await expect(cases(page)).toHaveCount(1);
                await expect(caseRow(page, 0).locator('.mapstudio-rule-value')).toHaveValue('9');
                await caseRow(page, 0).locator('.mapstudio-rule-preset').selectOption('warning');
                await settled(page);
                const after = await setupOf(page, 'pad');
                expect(after.setup.styleRule).toEqual({ ...rule9, cases: [{ value: 9, preset: 'warning' }] });
                expect(after.version).toBe(mine.version + 2);
            } finally {
                await other.close();
            }
        });

    editorTest('targets and words: every control of section 6 is at least 24 px, reached with Tab, and no em dash is in its words',
        async ({ page, browser }) => {
            editorTest.setTimeout(240_000);
            await restore(browser);
            const map = await openEditor(page);
            await openKind(page, map, 'line');
            const controls = rule(page).locator('button, select, input, textarea');
            const count = await controls.count();
            expect(count).toBeGreaterThan(10);
            for (let i = 0; i < count; i++) {
                const box = await controls.nth(i).boundingBox();
                expect(Math.min(box.width, box.height), await controls.nth(i).evaluate((el) => el.outerHTML.slice(0, 120))).toBeGreaterThanOrEqual(24);
            }
            // Tab walks the type buttons in order, then the value.
            await typeButton(page, 'none').focus();
            for (const next of ['states', 'bands', 'expression', 'instruments']) {
                await page.keyboard.press('Tab');
                await expect(typeButton(page, next)).toBeFocused();
            }
            await page.keyboard.press('Tab');
            await expect(source(page).locator('select')).toBeFocused();
            expect(await rule(page).innerText()).not.toContain(String.fromCharCode(0x2014));
            // The section stays inside the panel: nothing is cut off at 1366 px.
            const panel = await page.locator('.mapstudio-kindsetup').boundingBox();
            for (const row of await cases(page).all()) {
                const box = await row.boundingBox();
                expect(box.x).toBeGreaterThanOrEqual(panel.x);
                expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width);
            }
        });
});
