// The tag browser for the style rule, popup params and one item's overrides, and the typed Path field (epic-editing entry 13c;
// DESIGN.md Tag browser, EXPERIENCE.md Tag browser and its states): the plan's matrix C1 to C12 at 1366 px on the dev stack, as
// the map editor in Edit mode. The dev map's "Point 2" is the plan's P14 (the pad on the asset P14, [default]Mesa/P14).
// C1: a pick into the pad kind's style rule goes into the draft and is saved when the rule is complete, else "Not saved yet".
// C2, C3: a popup param's value, a new row's (a full path outside the asset folder; a row with no name stays a draft) and a
// stored one's (inside it, {asset.path}/...), with no resolve note on the rows. C4: an override row of Point 2's Live now, the
// full path, marked Override with Reset, one Undo step. C5: Point 2's own rule. C6: an item with no asset. C7 to C9, C11: a
// path typed in the card, a full one, {asset.path}/..., one the Gateway refuses, and a row clicked after. C8 on an item: the
// override check's words. C10: a provider stopped on the Gateway and a path typed all the same. C12: the card closes when the
// selected item changes. The words and the notes are Jest's (web/typescript/__tests__/tagBrowser.test.ts, tagBrowserCard.test.ts,
// kindSetupPanel.test.ts, itemPanel.test.ts, itemStyle.test.ts); that a viewer and a phone editor have no tag button at all is
// tagbrowser.spec.mjs's. The spec runs the seed again before and after and leaves the second tag provider started.

import { randomUUID } from 'node:crypto';
import { setTagProviderEnabled } from '../lib/gateway.mjs';
import { TRACER } from '../lib/geo.mjs';
import {
    EDITOR_USER, editorTest, ensureSeeded, expect, mapLoaded, openMap, removeStrays, runSeed, send, shot, signedInContext, test
} from './fixtures.mjs';

/** The Gateway's answer to a lookup or a save. */
const REPLY_MS = 20_000;
/** There is nothing to observe when nothing is sent: the time a stray batch would have to show in the map's seq. */
const NOTHING_MS = 800;
/** A spot for the item this spec makes through the test hook, out of the tracer's view. */
const AWAY = [-104.82, 39.66];
const P14 = '[default]Mesa/P14';
const AMBIENT = '[default]Plant/AmbientTemp';
const RESOLVES = 'Resolves for 4 of 5 well pads. Not for Point 3.';
const OVERRIDE_WORDS = "an override's tag path is a full path such as [default]Mesa/P12/Pressure, not {asset.path}/Pressure.";

let seed;

test.beforeAll(async ({ browser }) => {
    seed = await ensureSeeded(browser);
    await restore(browser);
});

test.afterAll(async ({ browser }) => {
    await setTagProviderEnabled('Site2', true);
    await restore(browser);
});

/** The stored kind setup record of a kind through the test hook, or undefined. */
async function setupOf(page, kindId) {
    const reply = await send(page, 'map.load', {});
    expect(reply.type, JSON.stringify(reply.body)).toBe('map.load.reply');
    return (reply.body.kindSetups || []).find((k) => k.kindId === kindId && !k.deleted);
}

/** The stored record of a live map item through the test hook, or undefined. */
async function stored(page, id) {
    return (await send(page, 'map.load', {})).body.items.find((i) => i.id === id && !i.deleted);
}

/** The seed's own items and kind setups again (Point 2's own rule among them), no override left on another seed item, no stray item. */
async function restore(browser) {
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
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

/** Kinds opened from the rail on a kind, with the preview item chosen (a seed key). */
async function openKind(page, map, kindId, previewKey) {
    await page.locator('.mapstudio-rail-item[data-surface="kinds"]').click();
    await expect(map).toHaveAttribute('data-surface', 'kinds');
    await page.locator('.mapstudio-kind-row[data-kind="' + kindId + '"]').click();
    const panel = page.locator('.mapstudio-kindsetup');
    await expect(panel).toHaveAttribute('data-kind', kindId);
    await field(page, 'preview').locator('select').selectOption(seed.ids[previewKey]);
    await expect(panel).toHaveAttribute('data-preview', seed.ids[previewKey]);
    return panel;
}

const field = (page, id) => page.locator('.mapstudio-kindsetup [data-field="' + id + '"]');
const input = (page, id) => field(page, id).locator('input[type="text"]');
const kindTag = (page, tagFor) => page.locator('.mapstudio-kindsetup .mapstudio-tag-button[data-tag-for="' + tagFor + '"]');
const itemTag = (page, tagFor) => page.locator('.mapstudio-panel .mapstudio-tag-button[data-tag-for="' + tagFor + '"]');
const card = (page) => page.locator('.mapstudio-tagbrowser');
const forLine = (page) => card(page).locator('.mapstudio-tagbrowser-for');
const treeRow = (page, path) => card(page).locator('.mapstudio-tag-row[data-path="' + path + '"]');
const pathField = (page) => card(page).locator('.mapstudio-tagbrowser-path input');
const note = (page) => card(page).locator('.mapstudio-tagbrowser-note');
const use = (page) => card(page).locator('.mapstudio-tagbrowser-use');
const saveWords = (page) => page.locator('.mapstudio-kinds .mapstudio-panel-save');
const section = (page) => page.locator('.mapstudio-kindsetup [data-section="styleRule"]');
const undo = (page) => page.locator('.mapstudio-toolbar .mapstudio-undo');
const liveRow = (page, id) => page.locator('.mapstudio-panel .mapstudio-livenow .mapstudio-livenow-row[data-row="' + id + '"]');
const style = (page) => page.locator('.mapstudio-panel .mapstudio-style');

/** The kind's panel has nothing on its way and the header says Saved. */
async function settled(page) {
    await expect(page.locator('.mapstudio-kindsetup')).toHaveAttribute('data-saving', '', { timeout: REPLY_MS });
    await expect(saveWords(page)).toHaveText('Saved', { timeout: REPLY_MS });
}

/** The card opened from a tag button, its tree loaded. */
async function openCard(page, button, tagFor) {
    await button.click();
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toHaveAttribute('data-for', tagFor);
    await expect(card(page).locator('.mapstudio-tag-row[data-kind="node"]').first()).toBeVisible({ timeout: REPLY_MS });
    await expect(card(page).locator('.mapstudio-tag-row[data-kind="loading"]')).toHaveCount(0, { timeout: REPLY_MS });
}

/** A folder's chevron pressed: it opens without being picked. */
async function toggle(page, path) {
    await treeRow(page, path).locator('.mapstudio-tag-chevron').click();
}

async function seqOf(map) {
    return Number(await map.getAttribute('data-store-seq'));
}

/** One override saved as one batch: Undo names its step, and the map's seq moved on by exactly one. */
async function expectOneBatch(page, map, seqBefore, step) {
    await expect(undo(page)).toHaveAttribute('data-step', 'Undo: ' + step, { timeout: REPLY_MS });
    await expect(map).toHaveAttribute('data-store-seq', String(seqBefore + 1), { timeout: REPLY_MS });
    await page.waitForTimeout(500);
    await expect(map).toHaveAttribute('data-store-seq', String(seqBefore + 1));
}

async function expectNothingSent(page, map, seqBefore) {
    await page.waitForTimeout(NOTHING_MS);
    await expect(map).toHaveAttribute('data-store-seq', String(seqBefore));
}

/** A list row clicked: the item selected with its Details open. */
async function selectRow(page, id) {
    await page.locator('.mapstudio-list-row[data-item-id="' + id + '"]').click();
    await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', id);
}

editorTest.describe('the tag browser for the style rule, popup params and one item, and the typed Path field, at 1366 px', () => {
    editorTest.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, actionTimeout: REPLY_MS });
    editorTest.describe.configure({ mode: 'serial' });

    editorTest('C1: a pick into the kind\'s style rule is saved when the rule is complete, else it stays in the draft, Not saved yet', async ({ page }) => {
        editorTest.setTimeout(300_000);
        const map = await openEditor(page);
        const before = await setupOf(page, 'pad');
        expect(before.setup.styleRule.source).toEqual({ path: '{asset.path}/Status' });
        await openKind(page, map, 'pad', TRACER.points.p2.key);
        const button = kindTag(page, 'styleRule.path');
        await button.scrollIntoViewIfNeeded();
        await expect(button).toHaveAttribute('aria-label', 'Pick a tag for the style rule');
        await openCard(page, button, 'styleRule.path');
        await expect(forLine(page)).toHaveText('For: Style rule of the Well pad kind');
        await expect(card(page)).toHaveAttribute('data-part', 'rule');
        await expect(button).toHaveAttribute('aria-expanded', 'true');
        await expect(field(page, 'styleRule.source')).toHaveClass(/mapstudio-kindsetup-field--browsing/);
        await expect(treeRow(page, P14)).toHaveAttribute('data-asset', 'true');

        // A folder is no pick for a rule; a tag inside the asset folder converts as a key value's does.
        await treeRow(page, '[default]Mesa/P15').click();
        await expect(note(page)).toHaveText('Pick a tag, not a folder.');
        await expect(use(page)).toBeDisabled();
        await treeRow(page, P14 + '/Pressure').click();
        await expect(note(page)).toHaveAttribute('data-save', '{asset.path}/Pressure', { timeout: REPLY_MS });
        await expect(note(page).locator('.mapstudio-tagbrowser-note-resolve')).toHaveText(RESOLVES);
        await expect(use(page)).toHaveText('Use this tag');
        await shot(page, 'mapstudio-tagpick-rule-1366.png');
        await use(page).click();
        await expect(card(page)).toHaveCount(0);
        await expect(button).toBeFocused();
        // The rule was complete: the draft took the path and the rule was saved, one setup save.
        await expect(field(page, 'styleRule.source').locator('.mapstudio-rule-path')).toHaveValue('{asset.path}/Pressure');
        await settled(page);
        await expect(section(page)).toHaveAttribute('data-unsaved', 'false');
        const after = await setupOf(page, 'pad');
        expect(after.version).toBe(before.version + 1);
        expect(after.setup).toEqual({ ...before.setup, styleRule: { ...before.setup.styleRule, source: { path: '{asset.path}/Pressure' } } });

        // Bands with no band yet: the pick goes into the draft, the section says Not saved yet and nothing is sent.
        await section(page).locator('.mapstudio-rule-type[data-type="bands"]').click();
        await field(page, 'styleRule.source').locator('.mapstudio-rule-source-select').selectOption('path');
        await expect(section(page)).toHaveAttribute('data-unsaved', 'true');
        await openCard(page, button, 'styleRule.path');
        await toggle(page, '[default]Plant');
        await treeRow(page, AMBIENT).click();
        await expect(note(page)).toHaveAttribute('data-tone', 'shared', { timeout: REPLY_MS });
        await expect(note(page)).toHaveAttribute('data-save', AMBIENT);
        await expect(note(page)).toContainText("AmbientTemp is outside Point 2's asset folder, so it is saved as the full path and every well pad's rule reads this one tag.");
        await use(page).click();
        await expect(card(page)).toHaveCount(0);
        await expect(field(page, 'styleRule.source').locator('.mapstudio-rule-path')).toHaveValue(AMBIENT);
        await expect(section(page)).toHaveAttribute('data-unsaved', 'true');
        await expect(section(page).locator('.mapstudio-rule-unsaved')).toContainText('Not saved yet');
        await shot(page, 'mapstudio-tagpick-rule-unsaved-1366.png');
        await page.waitForTimeout(NOTHING_MS);
        expect(await setupOf(page, 'pad')).toEqual(after);
    });

    editorTest('C2, C3: a new param row takes a full path and commits as when typed, a row with no name stays a draft; a stored param takes {asset.path}/...',
        async ({ page, browser }) => {
            editorTest.setTimeout(300_000);
            await restore(browser);
            const map = await openEditor(page);
            await openKind(page, map, 'pad', TRACER.points.p2.key);
            await input(page, 'popupView.path').fill('Popups/PadDetails');
            await input(page, 'popupView.path').press('Enter');
            await settled(page);
            const before = await setupOf(page, 'pad');
            expect(before.setup.popupView).toEqual({ path: 'Popups/PadDetails' });

            // C3: a new row, named, its value picked outside the asset folder: the full path, and the row is saved.
            await page.locator('.mapstudio-param-add').click();
            const fresh = page.locator('.mapstudio-param-row[data-new="true"]');
            await fresh.getByLabel('Param name').fill('ambient');
            const freshFor = await fresh.locator('.mapstudio-tag-button').getAttribute('data-tag-for');
            expect(freshFor).toMatch(/^param\.new:/);
            await openCard(page, fresh.locator('.mapstudio-tag-button'), freshFor);
            await expect(forLine(page)).toHaveText('For: Popup param ambient of the Well pad kind');
            await expect(fresh).toHaveClass(/mapstudio-param-row--browsing/);
            // The row is not finished while its own card is open: nothing was sent with an empty value.
            expect((await setupOf(page, 'pad')).version).toBe(before.version);
            await toggle(page, '[default]Plant');
            await treeRow(page, AMBIENT).click();
            await expect(note(page)).toHaveAttribute('data-save', AMBIENT, { timeout: REPLY_MS });
            await expect(note(page)).toHaveAttribute('data-tone', 'shared');
            await shot(page, 'mapstudio-tagpick-param-1366.png');
            await use(page).click();
            await expect(card(page)).toHaveCount(0);
            await settled(page);
            const added = await setupOf(page, 'pad');
            expect(added.setup.popupView).toEqual({ path: 'Popups/PadDetails', params: { ambient: AMBIENT } });
            expect(added.version).toBe(before.version + 1);

            // A row with no name: the value is filled, the row says what is missing and nothing is saved.
            await page.locator('.mapstudio-param-add').click();
            const unnamed = page.locator('.mapstudio-param-row[data-new="true"]').last();
            await expect(unnamed.getByLabel('Param name')).toHaveValue('');
            const unnamedFor = await unnamed.locator('.mapstudio-tag-button').getAttribute('data-tag-for');
            await openCard(page, unnamed.locator('.mapstudio-tag-button'), unnamedFor);
            await expect(forLine(page)).toHaveText('For: A new popup param of the Well pad kind');
            await treeRow(page, P14 + '/Pressure').click();
            await expect(note(page)).toHaveAttribute('data-save', '{asset.path}/Pressure', { timeout: REPLY_MS });
            await use(page).click();
            await expect(card(page)).toHaveCount(0);
            await expect(unnamed.getByLabel('Param value')).toHaveValue('{asset.path}/Pressure');
            await expect(unnamed.locator('.mapstudio-field-problem')).toBeVisible();
            await page.waitForTimeout(NOTHING_MS);
            expect(await setupOf(page, 'pad')).toEqual(added);
            await unnamed.locator('.mapstudio-param-remove').click();

            // C2: the stored param, a tag inside the asset folder: {asset.path}/Pressure, and no resolve note on a param row.
            const storedButton = kindTag(page, 'param:ambient');
            await expect(storedButton).toHaveAttribute('aria-label', 'Pick a tag for param ambient');
            await openCard(page, storedButton, 'param:ambient');
            await expect(forLine(page)).toHaveText('For: Popup param ambient of the Well pad kind');
            await treeRow(page, P14 + '/Pressure').click();
            await expect(note(page)).toHaveAttribute('data-save', '{asset.path}/Pressure', { timeout: REPLY_MS });
            await expect(note(page).locator('.mapstudio-tagbrowser-note-resolve')).toHaveText(RESOLVES);
            await use(page).click();
            await expect(card(page)).toHaveCount(0);
            await expect(storedButton).toBeFocused();
            await settled(page);
            const after = await setupOf(page, 'pad');
            expect(after.setup.popupView).toEqual({ path: 'Popups/PadDetails', params: { ambient: '{asset.path}/Pressure' } });
            expect(after.version).toBe(added.version + 1);
            await expect(page.locator('.mapstudio-param-row .mapstudio-resolve-note')).toHaveCount(0);
        });

    editorTest('C4, C8, C12: an override row\'s tag button; a typed {asset.path}/... refused; the full path saved for Point 2 only, one Undo step; the card closes with the selection',
        async ({ page, browser }) => {
            editorTest.setTimeout(300_000);
            await restore(browser);
            const p1 = seed.ids['tracer/p1'];
            const p2 = seed.ids['tracer/p2'];
            const map = await openEditor(page);
            await selectRow(page, p2);
            const flow = liveRow(page, 'kpi:flow');
            await flow.scrollIntoViewIfNeeded();
            await expect(flow).toHaveAttribute('data-override', 'false');
            // The button sits beside the field, once Override is pressed.
            await expect(page.locator('.mapstudio-panel .mapstudio-livenow .mapstudio-tag-button')).toHaveCount(0);
            await flow.locator('.mapstudio-override-edit').click();
            await expect(flow.locator('.mapstudio-override-input')).toBeFocused();
            const button = itemTag(page, 'override:kpi:flow');
            await expect(button).toHaveAttribute('aria-label', 'Pick a tag for Flow on Point 2 only');
            let seq = await seqOf(map);
            await openCard(page, button, 'override:kpi:flow');
            // The field stays open while its card is; nothing was sent by the press.
            await expect(flow.locator('.mapstudio-override-input')).toBeVisible();
            await expect(forLine(page)).toHaveText('For: Flow on Point 2 only - an override');
            await expect(card(page)).toHaveAttribute('data-part', 'override');
            await expect(use(page)).toHaveText('Use for Point 2');
            await expect(use(page)).toBeDisabled();
            // On Items the card sits in the same place: 380 px at the stage's left edge.
            const box = await card(page).boundingBox();
            const stage = await page.locator('.mapstudio-stage').boundingBox();
            expect(box.width).toBe(380);
            expect(box.x - stage.x).toBe(12);
            // It opened at Point 2's own asset folder.
            await expect(treeRow(page, P14)).toHaveAttribute('data-asset', 'true');
            await expect(note(page)).toHaveText("Opened at Point 2's asset folder. A pick is saved for Point 2 only, as the full path.");

            // C8: {asset.path}/... typed for an item is refused with the override check's words.
            await pathField(page).fill('{asset.path}/Pressure');
            await expect(note(page)).toHaveAttribute('data-tone', 'warning');
            await expect(note(page)).toHaveText(OVERRIDE_WORDS);
            await expect(use(page)).toBeDisabled();
            await shot(page, 'mapstudio-tagpick-override-refused-1366.png');

            // C4: a row clicked replaces the typed text; the pick is the full path, at once.
            await treeRow(page, P14 + '/Pressure').click();
            await expect(pathField(page)).toHaveValue(P14 + '/Pressure');
            await expect(note(page)).toHaveAttribute('data-save', P14 + '/Pressure');
            await expect(note(page).locator('.mapstudio-tagbrowser-note-text')).toHaveText('Saved for Point 2 only, as the full path');
            await expect(note(page).locator('.mapstudio-tagbrowser-note-path')).toHaveText(P14 + '/Pressure');
            await expect(note(page).locator('.mapstudio-override-tag')).toHaveText('Override');
            await expect(use(page)).toBeEnabled();
            await shot(page, 'mapstudio-tagpick-override-1366.png');
            await expectNothingSent(page, map, seq);
            await use(page).click();
            await expect(card(page)).toHaveCount(0);
            await expectOneBatch(page, map, seq, "change Point 2's Flow path");
            await expect(flow).toHaveAttribute('data-override', 'true');
            await expect(flow.locator('.mapstudio-livenow-path')).toHaveText(P14 + '/Pressure');
            await expect(flow.locator('.mapstudio-override-tag')).toHaveText('Override');
            await expect(flow.locator('.mapstudio-override-reset')).toBeVisible();
            await expect(flow.locator('.mapstudio-override-input')).toHaveCount(0);
            await expect(flow.locator('.mapstudio-override-edit')).toBeFocused();
            expect((await stored(page, p2)).overrides.kpis).toEqual([{ key: 'flow', path: P14 + '/Pressure' }]);
            await shot(page, 'mapstudio-tagpick-override-saved-1366.png');

            // Undo takes it back, one step.
            seq = await seqOf(map);
            await undo(page).click();
            await expect(flow).toHaveAttribute('data-override', 'false', { timeout: REPLY_MS });
            await expect(map).toHaveAttribute('data-store-seq', String(seq + 1), { timeout: REPLY_MS });
            expect((await stored(page, p2)).overrides.kpis).toBeUndefined();

            // C12: the card open for Point 2's override; another item selected closes it and nothing is saved.
            seq = await seqOf(map);
            await flow.locator('.mapstudio-override-edit').click();
            await openCard(page, itemTag(page, 'override:kpi:flow'), 'override:kpi:flow');
            await treeRow(page, P14 + '/Comms').click();
            await expect(use(page)).toBeEnabled();
            await selectRow(page, p1);
            await expect(card(page)).toHaveCount(0);
            await expectNothingSent(page, map, seq);
            expect((await stored(page, p2)).overrides.kpis).toBeUndefined();
            // Esc closes it too, and the focus is on the tag button again.
            await selectRow(page, p2);
            await liveRow(page, 'kpi:flow').locator('.mapstudio-override-edit').click();
            await openCard(page, itemTag(page, 'override:kpi:flow'), 'override:kpi:flow');
            await page.keyboard.press('Escape');
            await expect(card(page)).toHaveCount(0);
            await expect(itemTag(page, 'override:kpi:flow')).toBeFocused();
            await expectNothingSent(page, map, seq);
        });

    editorTest('C5, C6: a pick into Point 2\'s own rule, saved when complete and else Not saved yet; an item with no asset opens the default provider\'s top',
        async ({ page, browser }) => {
            editorTest.setTimeout(300_000);
            await restore(browser);
            const p2 = seed.ids['tracer/p2'];
            const map = await openEditor(page);
            await selectRow(page, p2);
            await page.locator('.mapstudio-panel .mapstudio-panel-tabs .mapstudio-panel-tab[data-tab="style"]').click();
            await expect(style(page)).toBeVisible();
            const before = await stored(page, p2);
            expect(before.overrides.styleRule.source).toEqual({ path: P14 + '/Pressure' });
            const button = itemTag(page, 'own.styleRule.path');
            let seq = await seqOf(map);
            await openCard(page, button, 'own.styleRule.path');
            await expect(forLine(page)).toHaveText('For: Style rule of Point 2 only');
            await expect(use(page)).toHaveText('Use for Point 2');
            await expect(treeRow(page, P14)).toHaveAttribute('data-asset', 'true');
            await treeRow(page, P14 + '/Flow').click();
            await expect(note(page)).toHaveAttribute('data-save', P14 + '/Flow');
            await expect(note(page).locator('.mapstudio-tagbrowser-note-text')).toHaveText('Saved for Point 2 only, as the full path');
            await shot(page, 'mapstudio-tagpick-ownrule-1366.png');
            await use(page).click();
            await expect(card(page)).toHaveCount(0);
            await expect(button).toBeFocused();
            await expectOneBatch(page, map, seq, "change Point 2's style rule");
            await expect(style(page).locator('.mapstudio-rule-path')).toHaveValue(P14 + '/Flow');
            const after = await stored(page, p2);
            expect(after.overrides).toEqual({ ...before.overrides, styleRule: { ...before.overrides.styleRule, source: { path: P14 + '/Flow' } } });

            // States with no case yet: the pick stays in the draft, Not saved yet.
            seq = await seqOf(map);
            await style(page).locator('.mapstudio-rule-type[data-type="states"]').click();
            await style(page).locator('.mapstudio-rule-source-select').selectOption('path');
            await openCard(page, button, 'own.styleRule.path');
            await treeRow(page, P14 + '/Comms').click();
            await use(page).click();
            await expect(card(page)).toHaveCount(0);
            await expect(style(page).locator('.mapstudio-rule-path')).toHaveValue(P14 + '/Comms');
            await expect(style(page).locator('.mapstudio-rule-unsaved')).toContainText('Not saved yet');
            await expectNothingSent(page, map, seq);
            expect((await stored(page, p2)).overrides).toEqual(after.overrides);

            // C6: an unlinked pad's override opens the default provider's top; a pick is its full path.
            const pad = randomUUID();
            const made = await send(page, 'edits.apply', { batchId: randomUUID(), ops: [{ op: 'create', entity: 'item', id: pad, baseVersion: 0,
                data: { kind: 'pad', name: 'Loose pad', geometry: { type: 'Point', coordinates: AWAY }, properties: {} } }] });
            expect(made.type, JSON.stringify(made.body)).toBe('edits.apply.reply');
            await expect(page.locator('.mapstudio-list-row[data-item-id="' + pad + '"]')).toHaveCount(1, { timeout: REPLY_MS });
            await selectRow(page, pad);
            await page.locator('.mapstudio-panel .mapstudio-panel-tabs .mapstudio-panel-tab[data-tab="details"]').click();
            const pressure = liveRow(page, 'kpi:pressure');
            await pressure.scrollIntoViewIfNeeded();
            await pressure.locator('.mapstudio-override-edit').click();
            seq = await seqOf(map);
            await openCard(page, itemTag(page, 'override:kpi:pressure'), 'override:kpi:pressure');
            await expect(forLine(page)).toHaveText('For: Pressure on Loose pad only - an override');
            await expect(card(page)).toHaveAttribute('data-provider', 'default');
            await expect(card(page).locator('.mapstudio-tag-row[data-asset="true"]')).toHaveCount(0);
            await expect(card(page).locator('.mapstudio-tagbrowser-home')).toHaveCount(0);
            await expect(treeRow(page, '[default]Mesa')).toHaveAttribute('aria-expanded', 'false');
            await expect(note(page)).toHaveText('Loose pad is not linked to an asset with a tag folder, so the tree starts at the top. A pick is saved for Loose pad only, as the full path.');
            await shot(page, 'mapstudio-tagpick-noasset-1366.png');
            await toggle(page, '[default]Plant');
            await treeRow(page, AMBIENT).click();
            await expect(note(page)).toHaveAttribute('data-save', AMBIENT);
            await expect(use(page)).toHaveText('Use for Loose pad');
            await use(page).click();
            await expect(card(page)).toHaveCount(0);
            await expectOneBatch(page, map, seq, "change Loose pad's Pressure path");
            await expect(pressure).toHaveAttribute('data-override', 'true');
            expect((await stored(page, pad)).overrides).toEqual({ kpis: [{ key: 'pressure', path: AMBIENT }] });
        });

    editorTest('C7 to C9, C11: a path typed in the card is answered by the Gateway as a pick is; a bad one shows its words; a row clicked replaces it',
        async ({ page, browser }) => {
            editorTest.setTimeout(300_000);
            await restore(browser);
            const map = await openEditor(page);
            const before = await setupOf(page, 'pad');
            expect(before.setup.kpis[1].path).toBe('{asset.path}/Flow');
            await openKind(page, map, 'pad', TRACER.points.p2.key);
            await openCard(page, kindTag(page, 'kpis.flow.path'), 'kpis.flow.path');
            await expect(pathField(page)).toBeEditable();
            await expect(pathField(page)).toHaveAttribute('placeholder', 'Pick in the tree or type one');

            // C11 first half: a row picked, then typing drops the pick and the tree does not move.
            await treeRow(page, P14 + '/Comms').click();
            await expect(note(page)).toHaveAttribute('data-save', '{asset.path}/Comms', { timeout: REPLY_MS });
            const inView = await card(page).locator('.mapstudio-tag-row[data-kind="node"]').evaluateAll((els) => els.map((e) => e.dataset.path));

            // C7: a full path typed: after a short pause the Gateway answers it as it answers a pick.
            await pathField(page).fill(P14 + '/Pressure');
            await expect(card(page).locator('.mapstudio-tag-row[data-picked="true"]')).toHaveCount(0);
            expect(await card(page).locator('.mapstudio-tag-row[data-kind="node"]').evaluateAll((els) => els.map((e) => e.dataset.path))).toEqual(inView);
            await expect(note(page)).toHaveAttribute('data-save', '{asset.path}/Pressure', { timeout: REPLY_MS });
            await expect(note(page)).toContainText("Inside Point 2's asset folder - saved for every well pad as");
            await expect(note(page).locator('.mapstudio-tagbrowser-note-path')).toHaveText('{asset.path}/Pressure');
            await expect(note(page).locator('.mapstudio-tagbrowser-note-resolve')).toHaveText(RESOLVES);
            await expect(use(page)).toBeEnabled();
            await shot(page, 'mapstudio-tagpick-typed-1366.png');

            // C8: {asset.path}/... typed, asked on Enter: the same note and the same save.
            await pathField(page).fill('{asset.path}/Flow');
            await pathField(page).press('Enter');
            await expect(note(page)).toHaveAttribute('data-save', '{asset.path}/Flow', { timeout: REPLY_MS });
            await expect(note(page).locator('.mapstudio-tagbrowser-note-resolve')).toContainText('Resolves for');
            await expect(card(page)).toBeVisible();

            // A full path outside the asset folder: the shared-tag note.
            await pathField(page).fill(AMBIENT);
            await expect(note(page)).toHaveAttribute('data-tone', 'shared', { timeout: REPLY_MS });
            await expect(note(page)).toHaveAttribute('data-save', AMBIENT);
            await expect(note(page)).toContainText("AmbientTemp is outside Point 2's asset folder, so it is saved as the full path and every well pad shows this one tag.");

            // C9: a path the Gateway refuses: its words, the button inert, nothing saved.
            await pathField(page).fill('[default]Mesa//P14');
            await expect(note(page)).toHaveAttribute('data-tone', 'warning', { timeout: REPLY_MS });
            await expect(note(page)).toHaveAttribute('data-save', '');
            const answer = await send(page, 'tags.resolve', { kindId: 'pad', assetId: 'P14', path: '[default]Mesa//P14' });
            expect(answer.type).toBe('error');
            expect(answer.body.code).toBe('invalid');
            await expect(note(page).locator('.mapstudio-tagbrowser-note-text')).toHaveText(answer.body.message);
            await expect(use(page)).toBeDisabled();
            await shot(page, 'mapstudio-tagpick-typed-refused-1366.png');
            await use(page).click({ force: true });
            await expect(card(page)).toBeVisible();
            expect(await setupOf(page, 'pad')).toEqual(before);

            // C11: a click on a row replaces the typed text; the note follows the row.
            await treeRow(page, P14 + '/Comms').click();
            await expect(pathField(page)).toHaveValue(P14 + '/Comms');
            await expect(treeRow(page, P14 + '/Comms')).toHaveAttribute('data-picked', 'true');
            await expect(note(page)).toHaveAttribute('data-save', '{asset.path}/Comms', { timeout: REPLY_MS });

            // The typed path saved, as a pick is: one setup save of what the Gateway gave.
            await pathField(page).fill('  ' + P14 + '/Pressure ');
            await expect(note(page)).toHaveAttribute('data-save', '{asset.path}/Pressure', { timeout: REPLY_MS });
            await use(page).click();
            await expect(card(page)).toHaveCount(0);
            await settled(page);
            await expect(input(page, 'kpis.flow.path')).toHaveValue('{asset.path}/Pressure');
            const after = await setupOf(page, 'pad');
            expect(after.version).toBe(before.version + 1);
            expect(after.setup).toEqual({ ...before.setup, kpis: [before.setup.kpis[0], { ...before.setup.kpis[1], path: '{asset.path}/Pressure' }] });
        });

    editorTest('C10: with a provider it cannot browse, a typed path is answered and saved without the tree', async ({ page, browser }) => {
        editorTest.setTimeout(300_000);
        await restore(browser);
        const map = await openEditor(page);
        const before = await setupOf(page, 'pad');
        await openKind(page, map, 'pad', TRACER.points.p2.key);
        await openCard(page, kindTag(page, 'comms.path'), 'comms.path');
        await setTagProviderEnabled('Site2', false);
        try {
            await expect.poll(async () => (await send(page, 'tags.browse', { provider: 'Site2' })).type, { timeout: 30_000 }).toBe('error');
            await card(page).locator('.mapstudio-tagbrowser-select').selectOption('Site2');
            const problem = card(page).locator('.mapstudio-tagbrowser-problem');
            await expect(problem.locator('.mapstudio-tagbrowser-problem-title')).toHaveText("Can't browse Site2", { timeout: REPLY_MS });
            await expect(card(page).locator('.mapstudio-tagbrowser-tree')).toHaveCount(0);
            await pathField(page).fill(P14 + '/Pressure');
            await expect(note(page)).toHaveAttribute('data-save', '{asset.path}/Pressure', { timeout: REPLY_MS });
            await expect(note(page).locator('.mapstudio-tagbrowser-note-resolve')).toHaveText(RESOLVES);
            // "Can't browse Site2" stays while the path is answered.
            await expect(problem.locator('.mapstudio-tagbrowser-problem-title')).toHaveText("Can't browse Site2");
            await expect(use(page)).toBeEnabled();
            await shot(page, 'mapstudio-tagpick-typed-unreachable-1366.png');
            await use(page).click();
            await expect(card(page)).toHaveCount(0);
            await settled(page);
            await expect(input(page, 'comms.path')).toHaveValue('{asset.path}/Pressure');
            const after = await setupOf(page, 'pad');
            expect(after.setup).toEqual({ ...before.setup, comms: { ...before.setup.comms, path: '{asset.path}/Pressure' } });
        } finally {
            await setTagProviderEnabled('Site2', true);
            await expect.poll(async () => (await send(page, 'tags.browse', { provider: 'Site2' })).type, { timeout: 60_000 }).toBe('tags.browse.reply');
        }
    });
});
