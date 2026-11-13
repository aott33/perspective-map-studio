// The tag browser's card and tree, with picks into a kind's Key values, Comms and Alarms (epic-editing entry 13b; DESIGN.md Tag
// browser, EXPERIENCE.md Tag browser and its states): the plan's matrix B1 to B12 at 1366 px on the dev stack, as the map editor
// in Edit mode with Kinds open. B1: the card opens from a key value's tag button at the preview item's asset folder, opened and
// marked. B2: Pressure picked inside it is saved as {asset.path}/Pressure with what it resolves for. B3: a tag outside it is
// saved as the full path with the shared-tag note. B4: a folder is no pick for a key value. B5: for Alarms a folder is, and a tag
// too. B6: another provider, and the button back to the asset folder. B7: the keyboard alone, Esc and the focus. B8: a slow folder
// (its reply held on the page's websocket) and an empty one. B9: a provider stopped on the Gateway and started again. B10: a
// refused role and a folder that is gone (replies turned on the websocket, in the Gateway's own words) and an asset folder the
// Gateway does not have (the dev asset P14L, live). B11: another editor's save while the card is open. B12: a kind with no linked
// item. The tree's logic is Jest's (web/typescript/__tests__/tagBrowser.test.ts). The spec runs the seed again (which restores
// the five seed setups) and deletes the Meter setup it makes, before and after; it leaves the second tag provider started.

import { randomUUID } from 'node:crypto';
import { setTagProviderEnabled } from '../lib/gateway.mjs';
import { TRACER } from '../lib/geo.mjs';
import { EVENT_FIRED, firedEvent } from '../lib/sockets.mjs';
import {
    EDITOR2_USER, EDITOR_USER, OPERATOR_USER, editorTest, ensureSeeded, expect, mapLoaded, openMap, removeStrays, runSeed, send, shot,
    signedInContext, test, REPLY_MS, openEditor, setupOf, settled, field, input
} from './fixtures.mjs';

const ROLE_WORDS = 'Browsing tags needs a full editing role. Ask for a Map Studio editing role.';
const STOPPED_WORDS = 'The tag provider Site2 is on this Gateway but does not answer; it is stopped or faulted. '
    + "Start it on the Gateway's tag provider page.";

let seed;

test.beforeAll(async ({ browser }) => {
    seed = await ensureSeeded(browser);
    await restore(browser);
});

test.afterAll(async ({ browser }) => {
    await setTagProviderEnabled('Site2', true);
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

/** Kinds opened from the rail on a kind, with the preview item chosen when one is named (a seed key). */
async function openKind(page, map, kindId, previewKey) {
    await page.locator('.mapstudio-rail-item[data-surface="kinds"]').click();
    await expect(map).toHaveAttribute('data-surface', 'kinds');
    await page.locator('.mapstudio-kind-row[data-kind="' + kindId + '"]').click();
    const panel = page.locator('.mapstudio-kindsetup');
    await expect(panel).toHaveAttribute('data-kind', kindId);
    if (previewKey) {
        await field(page, 'preview').locator('select').selectOption(seed.ids[previewKey]);
        await expect(panel).toHaveAttribute('data-preview', seed.ids[previewKey]);
    }
    return panel;
}

const tagButton = (page, tagFor) => page.locator('.mapstudio-kindsetup .mapstudio-tag-button[data-tag-for="' + tagFor + '"]');
const card = (page) => page.locator('.mapstudio-tagbrowser');
const row = (page, path) => card(page).locator('.mapstudio-tag-row[data-path="' + path + '"]');
const note = (page) => card(page).locator('.mapstudio-tagbrowser-note');
const use = (page) => card(page).locator('.mapstudio-tagbrowser-use');
const focusedPath = (page) => page.evaluate(() => (document.activeElement ? document.activeElement.getAttribute('data-path') : null));

/** The card opened from a tag button, its tree loaded at the asset folder (or the top level). */
async function openCard(page, tagFor) {
    await tagButton(page, tagFor).click();
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toHaveAttribute('data-for', tagFor);
    await expect(card(page).locator('.mapstudio-tag-row[data-kind="node"]').first()).toBeVisible({ timeout: REPLY_MS });
    await expect(card(page).locator('.mapstudio-tag-row[data-kind="loading"]')).toHaveCount(0, { timeout: REPLY_MS });
}

/** A folder's chevron pressed: it opens (or closes) without being picked. */
async function toggle(page, path) {
    await row(page, path).locator('.mapstudio-tag-chevron').click();
}

/**
 * The page's websocket routed through the test: while `gate.hold` is set, each tags.browse.reply is kept back until `release()`
 * (a slow folder); while `gate.refuse` is `{code, message}`, each tags.browse.reply reaches the page as that error instead.
 */
async function routeBrowse(page) {
    const gate = { hold: false, refuse: null, held: [], toPage: null, release() {
        this.hold = false;
        this.held.splice(0).forEach((m) => this.toPage.send(m));
    } };
    await page.routeWebSocket(/.*/, (ws) => {
        const server = ws.connectToServer();
        gate.toPage = ws;
        ws.onMessage((message) => server.send(message));
        server.onMessage((message) => {
            const frame = firedEvent(message);
            if (frame && frame.event.type === 'tags.browse.reply' && gate.refuse) {
                frame.event = { v: frame.event.v, type: 'error', id: frame.event.id, body: gate.refuse };
                ws.send(EVENT_FIRED + JSON.stringify(frame));
                return;
            }
            if (frame && frame.event.type === 'tags.browse.reply' && gate.hold) {
                gate.held.push(message);
                return;
            }
            ws.send(message);
        });
    });
    return gate;
}

editorTest.describe('the tag browser at 1366 px', () => {
    editorTest.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
    editorTest.describe.configure({ mode: 'serial' });

    editorTest('B1, B2, B7: opened from a key value at the asset folder; Pressure picked by the keyboard alone and saved as {asset.path}/Pressure',
        async ({ page }) => {
            editorTest.setTimeout(300_000);
            const map = await openEditor(page);
            const before = await setupOf(page, 'pad');
            expect(before.setup.kpis[1].path).toBe('{asset.path}/Flow');
            const undo = page.locator('.mapstudio-tool.mapstudio-undo');
            const undoBefore = await undo.getAttribute('title');
            await openKind(page, map, 'pad', TRACER.points.p2.key);
            await expect(field(page, 'preview').locator('.mapstudio-kindsetup-folder')).toHaveText('[default]Mesa/P14');

            // The buttons: one at the end of each path of Key values, Comms and Alarms and, from entry 13c, of the style rule's tag
            // path (the pad's States rule reads {asset.path}/Status), and nowhere else.
            expect(await page.locator('.mapstudio-kindsetup .mapstudio-tag-button').evaluateAll((els) => els.map((e) => e.dataset.tagFor)))
                .toEqual(['kpis.pressure.path', 'kpis.flow.path', 'comms.path', 'alarms.path', 'styleRule.path']);
            const button = tagButton(page, 'kpis.flow.path');
            await expect(button).toHaveAttribute('title', 'Pick a tag');
            await expect(button).toHaveAttribute('aria-expanded', 'false');

            // B7: from the tag button, by keys alone. Enter opens the card and the focus goes into the tree, on the asset folder.
            await button.focus();
            await page.keyboard.press('Enter');
            await expect(card(page)).toBeVisible();
            await expect(button).toHaveAttribute('aria-expanded', 'true');
            await expect(row(page, '[default]Mesa/P14')).toBeFocused({ timeout: REPLY_MS });

            // B1: the card, 380 px at the stage's left edge beside the panel; the For line; the default provider; the asset folder
            // opened and marked, its rows guided; Pressure a Tag, Float8.
            await expect(card(page).locator('.mapstudio-tagbrowser-title')).toHaveText('Pick a tag');
            await expect(card(page).locator('.mapstudio-tagbrowser-for')).toHaveText('For: Key value 2 of the Well pad kind');
            await expect(card(page)).toHaveAttribute('data-provider', 'default');
            await expect(card(page).locator('.mapstudio-tagbrowser-select')).toHaveValue('default');
            expect(await card(page).locator('.mapstudio-tagbrowser-select option').allInnerTexts()).toEqual(['default (Default)', 'Site2', 'System']);
            await expect(card(page).locator('.mapstudio-tagbrowser-default')).toHaveText('Default');
            await expect(card(page).locator('.mapstudio-tagbrowser-home')).toHaveCount(0);
            const box = await card(page).boundingBox();
            const stage = await page.locator('.mapstudio-stage').boundingBox();
            const panelBox = await page.locator('.mapstudio-kindsetup').boundingBox();
            expect(box.width).toBe(380);
            expect(box.x - stage.x).toBe(12);
            expect(Math.round(stage.x)).toBe(Math.round(panelBox.x + panelBox.width));
            expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height);
            const asset = row(page, '[default]Mesa/P14');
            await expect(asset).toHaveAttribute('data-asset', 'true');
            await expect(asset).toHaveAttribute('aria-expanded', 'true');
            await expect(asset.locator('.mapstudio-tag-asset')).toHaveText('Asset folder');
            await expect(asset.locator('.mapstudio-tag-type')).toHaveText('UDT instance');
            const pressure = row(page, '[default]Mesa/P14/Pressure');
            await expect(pressure).toHaveAttribute('data-guided', 'true');
            await expect(pressure).toHaveAttribute('aria-level', '3');
            await expect(pressure.locator('.mapstudio-tag-type')).toHaveText('Tag');
            await expect(pressure.locator('.mapstudio-tag-datatype')).toHaveText('Float8');
            await expect(row(page, '[default]Mesa')).toHaveAttribute('aria-expanded', 'true');
            await expect(row(page, '[default]Mesa').locator('.mapstudio-tag-type')).toHaveText('Folder');
            await expect(row(page, '[default]Mesa/P15')).toHaveAttribute('data-guided', 'false');
            expect((await pressure.boundingBox()).height).toBe(24);
            expect((await pressure.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft)))
                - (await asset.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft)))).toBe(16);
            // One row in the tab order; the row the card is open for takes the selection tint.
            await expect(card(page).locator('.mapstudio-tag-row[tabindex="0"]')).toHaveCount(1);
            await expect(page.locator('.mapstudio-kv-row[data-key="flow"]')).toHaveClass(/mapstudio-kv-row--browsing/);
            await expect(note(page)).toContainText("Opened at Point 2's asset folder, the preview item.");
            await expect(use(page)).toBeDisabled();
            await expect(card(page).locator('.mapstudio-tagbrowser-path input')).toHaveValue('');
            await shot(page, 'mapstudio-tagbrowser-open-1366.png');

            // Esc closes it and changes nothing; the focus is on the tag button again.
            await page.keyboard.press('Escape');
            await expect(card(page)).toHaveCount(0);
            await expect(button).toBeFocused();
            await expect(page.locator('.mapstudio-kv-row--browsing')).toHaveCount(0);
            await expect(input(page, 'kpis.flow.path')).toHaveValue('{asset.path}/Flow');

            // Again, and the tree walked: Left closes the asset folder, Right opens it, Left on a closed row goes to its parent,
            // Home and End go to the ends, Down steps into the asset folder.
            await page.keyboard.press('Enter');
            await expect(asset).toBeFocused({ timeout: REPLY_MS });
            await page.keyboard.press('ArrowLeft');
            await expect(asset).toHaveAttribute('aria-expanded', 'false');
            await expect(pressure).toHaveCount(0);
            await expect(card(page).locator('.mapstudio-tagbrowser-home')).toHaveText('Point 2 folder');
            await page.keyboard.press('ArrowLeft');
            await expect(row(page, '[default]Mesa')).toBeFocused();
            const inView = await card(page).locator('.mapstudio-tag-row[data-kind="node"]').evaluateAll((els) => els.map((e) => e.dataset.path));
            await page.keyboard.press('End');
            expect(await focusedPath(page)).toBe(inView[inView.length - 1]);
            await page.keyboard.press('Home');
            // The provider's first row: the folder of its UDT types.
            expect(await focusedPath(page)).toBe('[default]_types_');
            await page.keyboard.press('ArrowDown');
            await expect(row(page, '[default]Mesa')).toBeFocused();
            await page.keyboard.press('ArrowRight');
            expect(await focusedPath(page)).toMatch(/^\[default\]Mesa\/.+/);
            for (let i = 0; i < 12 && (await focusedPath(page)) !== '[default]Mesa/P14'; i++) {
                await page.keyboard.press('ArrowDown');
            }
            await expect(asset).toBeFocused();
            await page.keyboard.press('ArrowRight');
            await expect(asset).toHaveAttribute('aria-expanded', 'true');
            await expect(card(page).locator('.mapstudio-tagbrowser-home')).toHaveCount(0);
            for (let i = 0; i < 12 && (await focusedPath(page)) !== '[default]Mesa/P14/Pressure'; i++) {
                await page.keyboard.press('ArrowDown');
            }
            await expect(pressure).toBeFocused();

            // B2: Enter picks it. The Gateway converts the path and says what it resolves for; the button waits for that.
            await page.keyboard.press('Enter');
            await expect(pressure).toHaveAttribute('data-picked', 'true');
            await expect(pressure).toHaveAttribute('aria-selected', 'true');
            await expect(card(page).locator('.mapstudio-tagbrowser-path input')).toHaveValue('[default]Mesa/P14/Pressure');
            // From entry 13c the field can be typed in (tagpicks.spec.mjs); a pick fills it.
            await expect(card(page).locator('.mapstudio-tagbrowser-path input')).toBeEditable();
            await expect(note(page)).toHaveAttribute('data-save', '{asset.path}/Pressure', { timeout: REPLY_MS });
            await expect(note(page)).toHaveAttribute('data-tone', 'plain');
            await expect(note(page)).toContainText("Inside Point 2's asset folder - saved for every well pad as");
            await expect(note(page).locator('.mapstudio-tagbrowser-note-path')).toHaveText('{asset.path}/Pressure');
            await expect(note(page).locator('.mapstudio-tagbrowser-note-resolve')).toHaveText('Resolves for 4 of 5 well pads. Not for Point 3.');
            await expect(use(page)).toBeEnabled();
            await expect(use(page)).toHaveText('Use this tag');
            await shot(page, 'mapstudio-tagbrowser-inside-1366.png');

            // Tab to the button and Enter: saved, the card gone, the focus on the tag button, the row with its path and note.
            for (let i = 0; i < 6 && !(await use(page).evaluate((el) => el === document.activeElement)); i++) {
                await page.keyboard.press('Tab');
            }
            await expect(use(page)).toBeFocused();
            await page.keyboard.press('Enter');
            await expect(card(page)).toHaveCount(0);
            await expect(button).toBeFocused();
            await settled(page);
            await expect(input(page, 'kpis.flow.path')).toHaveValue('{asset.path}/Pressure');
            await expect(field(page, 'kpis.flow.path').locator('.mapstudio-resolve-note'))
                .toHaveText('Resolves for 4 of 5 well pads. Not for Point 3.', { timeout: REPLY_MS });
            const after = await setupOf(page, 'pad');
            expect(after.version).toBe(before.version + 1);
            expect(after.setup).toEqual({ ...before.setup, kpis: [before.setup.kpis[0], { ...before.setup.kpis[1], path: '{asset.path}/Pressure' }] });
            await shot(page, 'mapstudio-tagbrowser-saved-1366.png');

            // One setup save, as a typed path is: no Undo step, and Recent changes lists it with no Revert.
            expect(await undo.getAttribute('title')).toBe(undoBefore);
            await page.locator('.mapstudio-rail-item[data-surface="history"]').click();
            const first = page.locator('.mapstudio-history-row').first();
            await expect(first.locator('.mapstudio-history-sentence')).toHaveText(/Changed the well pad kind setup/, { timeout: REPLY_MS });
            await expect(first).toHaveAttribute('data-actor', EDITOR_USER);
            await expect(first.locator('.mapstudio-history-revert')).toHaveCount(0);
        });

    editorTest('B3, B4: a folder is no pick for a key value; a tag outside the asset folder is saved as the full path with the shared-tag note',
        async ({ page, browser }) => {
            editorTest.setTimeout(300_000);
            await restore(browser);
            const map = await openEditor(page);
            const before = await setupOf(page, 'pad');
            await openKind(page, map, 'pad', TRACER.points.p2.key);
            await openCard(page, 'kpis.pressure.path');
            await expect(card(page).locator('.mapstudio-tagbrowser-for')).toHaveText('For: Key value 1 of the Well pad kind');

            // B4: a click picks a row; a folder is shown in the Path field but cannot be used.
            await row(page, '[default]Mesa/P15').click();
            await expect(row(page, '[default]Mesa/P15')).toHaveAttribute('data-picked', 'true');
            await expect(row(page, '[default]Mesa/P15')).toHaveAttribute('aria-expanded', 'false');
            await expect(card(page).locator('.mapstudio-tagbrowser-path input')).toHaveValue('[default]Mesa/P15');
            await expect(note(page)).toHaveText('Pick a tag, not a folder.');
            await expect(use(page)).toBeDisabled();
            await expect(use(page)).toHaveText('Use this tag');
            await shot(page, 'mapstudio-tagbrowser-folder-1366.png');
            await use(page).click({ force: true });
            await expect(card(page)).toBeVisible();

            // B3: the chevron opens Plant without picking it; AmbientTemp is outside the asset folder.
            await toggle(page, '[default]Plant');
            await expect(row(page, '[default]Plant')).toHaveAttribute('aria-expanded', 'true');
            await expect(row(page, '[default]Mesa/P15')).toHaveAttribute('data-picked', 'true');
            const ambient = row(page, '[default]Plant/AmbientTemp');
            await expect(ambient).toBeVisible({ timeout: REPLY_MS });
            await expect(ambient).toHaveAttribute('data-guided', 'false');
            await ambient.click();
            await expect(note(page)).toHaveAttribute('data-save', '[default]Plant/AmbientTemp', { timeout: REPLY_MS });
            await expect(note(page)).toHaveAttribute('data-tone', 'shared');
            await expect(note(page).locator('.mapstudio-tagbrowser-note-title')).toHaveText('Same tag for every well pad');
            await expect(note(page)).toContainText("AmbientTemp is outside Point 2's asset folder, so it is saved as the full path and every well pad shows this one tag.");
            await expect(note(page).locator('.mapstudio-tagbrowser-note-path')).toHaveText('[default]Plant/AmbientTemp');
            // The warning token, on its tint with the 3 px edge.
            const tone = await note(page).evaluate((el) => {
                const probe = document.createElement('span');
                probe.style.color = 'var(--mapstudio-warning)';
                el.appendChild(probe);
                const warning = getComputedStyle(probe).color;
                probe.remove();
                const style = getComputedStyle(el);
                return { warning, edge: style.borderLeftColor, width: style.borderLeftWidth,
                    title: getComputedStyle(el.querySelector('.mapstudio-tagbrowser-note-title')).color };
            });
            expect(tone.edge).toBe(tone.warning);
            expect(tone.title).toBe(tone.warning);
            expect(tone.width).toBe('3px');
            await shot(page, 'mapstudio-tagbrowser-outside-1366.png');

            await use(page).click();
            await expect(card(page)).toHaveCount(0);
            await expect(tagButton(page, 'kpis.pressure.path')).toBeFocused();
            await settled(page);
            await expect(input(page, 'kpis.pressure.path')).toHaveValue('[default]Plant/AmbientTemp');
            const shared = field(page, 'kpis.pressure.path').locator('.mapstudio-resolve-note');
            await expect(shared).toHaveText('Same tag for every well pad');
            await expect(shared).toHaveAttribute('data-state', 'shared');
            const after = await setupOf(page, 'pad');
            expect(after.setup).toEqual({ ...before.setup, kpis: [{ ...before.setup.kpis[0], path: '[default]Plant/AmbientTemp' }, before.setup.kpis[1]] });

            // Cancel and the close change nothing.
            await openCard(page, 'kpis.pressure.path');
            await row(page, '[default]Mesa/P14/Pressure').click();
            await expect(use(page)).toBeEnabled({ timeout: REPLY_MS });
            await card(page).locator('.mapstudio-tagbrowser-cancel').click();
            await expect(card(page)).toHaveCount(0);
            await expect(tagButton(page, 'kpis.pressure.path')).toBeFocused();
            await openCard(page, 'kpis.pressure.path');
            await card(page).locator('.mapstudio-tagbrowser-close').click();
            await expect(card(page)).toHaveCount(0);
            expect((await setupOf(page, 'pad')).version).toBe(after.version);
        });

    editorTest('B5: for Alarms a folder or a UDT instance is a pick, saved with Use this folder; a tag saves too', async ({ page, browser }) => {
        editorTest.setTimeout(300_000);
        await restore(browser);
        const map = await openEditor(page);
        const before = await setupOf(page, 'pad');
        expect(before.setup.alarms.path).toBe('{asset.path}');
        await openKind(page, map, 'pad', TRACER.points.p2.key);

        // A folder outside the asset folder: the full path.
        await openCard(page, 'alarms.path');
        await expect(card(page).locator('.mapstudio-tagbrowser-for')).toHaveText('For: Alarms of the Well pad kind');
        await expect(field(page, 'alarms.path')).toHaveClass(/mapstudio-kindsetup-field--browsing/);
        await row(page, '[default]Mesa/P15').click();
        await expect(use(page)).toHaveText('Use this folder');
        await expect(note(page)).toHaveAttribute('data-save', '[default]Mesa/P15', { timeout: REPLY_MS });
        await expect(note(page)).toContainText("P15 is outside Point 2's asset folder, so it is saved as the full path and every well pad shows the alarms below it.");
        await use(page).click();
        await expect(card(page)).toHaveCount(0);
        await settled(page);
        await expect(input(page, 'alarms.path')).toHaveValue('[default]Mesa/P15');
        expect((await setupOf(page, 'pad')).setup.alarms).toEqual({ ...before.setup.alarms, path: '[default]Mesa/P15' });

        // A tag saves too.
        await openCard(page, 'alarms.path');
        await row(page, '[default]Mesa/P14/Pressure').click();
        await expect(use(page)).toHaveText('Use this tag');
        await expect(note(page)).toHaveAttribute('data-save', '{asset.path}/Pressure', { timeout: REPLY_MS });
        await use(page).click();
        await settled(page);
        await expect(input(page, 'alarms.path')).toHaveValue('{asset.path}/Pressure');

        // The asset folder itself (a UDT instance): {asset.path}, as the seed has it.
        await openCard(page, 'alarms.path');
        await row(page, '[default]Mesa/P14').click();
        await expect(use(page)).toHaveText('Use this folder');
        await expect(note(page)).toHaveAttribute('data-save', '{asset.path}', { timeout: REPLY_MS });
        await expect(note(page).locator('.mapstudio-tagbrowser-note-resolve')).toHaveText(/^Resolves for [0-5] of 5 well pads/);
        await shot(page, 'mapstudio-tagbrowser-alarms-1366.png');
        await use(page).click();
        await expect(card(page)).toHaveCount(0);
        await expect(tagButton(page, 'alarms.path')).toBeFocused();
        await settled(page);
        await expect(input(page, 'alarms.path')).toHaveValue('{asset.path}');
        const after = await setupOf(page, 'pad');
        expect(after.setup).toEqual(before.setup);
        expect(after.version).toBe(before.version + 3);

        // For Comms, as for a key value, a folder is no pick.
        await openCard(page, 'comms.path');
        await expect(card(page).locator('.mapstudio-tagbrowser-for')).toHaveText('For: Comms of the Well pad kind');
        await row(page, '[default]Mesa/P14').click();
        await expect(note(page)).toHaveText('Pick a tag, not a folder.');
        await expect(use(page)).toBeDisabled();
        await expect(use(page)).toHaveText('Use this tag');
    });

    editorTest('B6, B8, B9: a stopped provider and Try again; another provider, an empty folder, a full-path pick and the way back to the asset folder',
        async ({ page, browser }) => {
            editorTest.setTimeout(420_000);
            await restore(browser);
            const map = await openEditor(page);
            const before = await setupOf(page, 'pad');
            await openKind(page, map, 'pad', TRACER.points.p2.key);
            await openCard(page, 'comms.path');
            const select = card(page).locator('.mapstudio-tagbrowser-select');
            expect(await select.locator('option').allInnerTexts()).toEqual(['default (Default)', 'Site2', 'System']);

            // B9: Site2 is stopped on the Gateway while the card is open, then chosen.
            await setTagProviderEnabled('Site2', false);
            try {
                await expect.poll(async () => (await send(page, 'tags.browse', { provider: 'Site2' })).type, { timeout: 30_000 }).toBe('error');
                await select.selectOption('Site2');
                const problem = card(page).locator('.mapstudio-tagbrowser-problem');
                await expect(problem).toBeVisible({ timeout: REPLY_MS });
                await expect(problem).toHaveAttribute('data-code', 'tags-unavailable');
                await expect(problem.locator('.mapstudio-tagbrowser-problem-title')).toHaveText("Can't browse Site2");
                await expect(problem.locator('.mapstudio-tagbrowser-problem-words')).toHaveText(STOPPED_WORDS);
                await expect(card(page).locator('.mapstudio-tagbrowser-tree')).toHaveCount(0);
                await expect(use(page)).toBeDisabled();
                // The select still offers the others, and shows the one it cannot browse.
                await expect(select).toHaveValue('Site2');
                expect(await select.locator('option').allInnerTexts()).toEqual(expect.arrayContaining(['default (Default)', 'System', 'Site2']));
                await shot(page, 'mapstudio-tagbrowser-unreachable-1366.png');
                // Still stopped: Try again says the same.
                await problem.locator('.mapstudio-tagbrowser-retry').click();
                await expect(problem.locator('.mapstudio-tagbrowser-problem-title')).toHaveText("Can't browse Site2", { timeout: REPLY_MS });
                // The other providers are browsed meanwhile.
                await select.selectOption('default');
                await expect(row(page, '[default]Mesa')).toBeVisible();
                await expect(row(page, '[default]Mesa')).toHaveAttribute('aria-expanded', 'false');
                await expect(card(page).locator('.mapstudio-tagbrowser-home')).toHaveText('Point 2 folder');
                await select.selectOption('Site2');
                await expect(problem).toBeVisible();
            } finally {
                await setTagProviderEnabled('Site2', true);
            }
            await expect.poll(async () => (await send(page, 'tags.browse', { provider: 'Site2' })).type, { timeout: 60_000 }).toBe('tags.browse.reply');
            await card(page).locator('.mapstudio-tagbrowser-retry').click();
            const yard = row(page, '[Site2]Yard');
            await expect(yard).toBeVisible({ timeout: REPLY_MS });
            await expect(card(page).locator('.mapstudio-tagbrowser-problem')).toHaveCount(0);

            // B6: Site2's top level, nothing of the asset folder; the folder button offers the way back.
            await expect(card(page)).toHaveAttribute('data-provider', 'Site2');
            await expect(card(page).locator('.mapstudio-tagbrowser-default')).toHaveCount(0);
            await expect(card(page).locator('.mapstudio-tag-row[data-asset="true"]')).toHaveCount(0);
            const home = card(page).locator('.mapstudio-tagbrowser-home');
            await expect(home).toHaveText('Point 2 folder');
            await toggle(page, '[Site2]Yard');
            await expect(row(page, '[Site2]Yard/WindSpeed')).toBeVisible({ timeout: REPLY_MS });
            expect(await card(page).locator('.mapstudio-tag-row[data-kind="node"]').evaluateAll((els) => els.map((e) => e.dataset.path)))
                .toEqual(['[Site2]_types_', '[Site2]Yard', '[Site2]Yard/Spare', '[Site2]Yard/Tank1', '[Site2]Yard/WindSpeed']);

            // B8: the empty folder says so under it.
            await toggle(page, '[Site2]Yard/Spare');
            const empty = card(page).locator('.mapstudio-tag-row[data-kind="empty"]');
            await expect(empty).toHaveText('No tags in this folder', { timeout: REPLY_MS });
            await expect(empty).toHaveAttribute('data-under', 'Yard/Spare');
            expect(await empty.evaluate((el) => getComputedStyle(el).fontStyle)).toBe('italic');
            await shot(page, 'mapstudio-tagbrowser-empty-1366.png');

            // A tag of another provider is a full path, the same tag for every well pad.
            await row(page, '[Site2]Yard/WindSpeed').click();
            await expect(note(page)).toHaveAttribute('data-save', '[Site2]Yard/WindSpeed', { timeout: REPLY_MS });
            await expect(note(page)).toHaveAttribute('data-tone', 'shared');
            await shot(page, 'mapstudio-tagbrowser-provider-1366.png');

            // The folder button returns to the asset folder, the pick kept until another is made.
            await home.click();
            await expect(card(page)).toHaveAttribute('data-provider', 'default');
            await expect(row(page, '[default]Mesa/P14')).toBeFocused();
            await expect(row(page, '[default]Mesa/P14')).toHaveAttribute('data-asset', 'true');
            await expect(home).toHaveCount(0);
            await expect(card(page).locator('.mapstudio-tagbrowser-default')).toHaveText('Default');
            await expect(note(page)).toHaveAttribute('data-save', '[Site2]Yard/WindSpeed');
            await use(page).click();
            await settled(page);
            await expect(input(page, 'comms.path')).toHaveValue('[Site2]Yard/WindSpeed');
            expect((await setupOf(page, 'pad')).setup.comms).toEqual({ ...before.setup.comms, path: '[Site2]Yard/WindSpeed' });
        });

    editorTest('B8, B10: a slow folder shows Loading under it with the rest usable; a refused role and a folder that is gone show the Gateway\'s words',
        async ({ page, browser }) => {
            editorTest.setTimeout(300_000);
            await restore(browser);
            const gate = await routeBrowse(page);
            const map = await openEditor(page);
            const before = await setupOf(page, 'pad');
            await openKind(page, map, 'pad', TRACER.points.p2.key);
            await openCard(page, 'kpis.pressure.path');

            // B8: Plant's answer is slow. Its Loading row shows with the spinner; the rest of the tree is used meanwhile.
            gate.hold = true;
            await toggle(page, '[default]Plant');
            const loading = card(page).locator('.mapstudio-tag-row[data-kind="loading"]');
            await expect(loading).toHaveText('Loading...');
            await expect(loading).toHaveAttribute('data-under', 'Plant');
            await expect(loading.locator('.mapstudio-spinner')).toBeVisible();
            expect(await loading.locator('.mapstudio-spinner').evaluate((el) => getComputedStyle(el).animationName)).toBe('mapstudio-spin');
            await row(page, '[default]Mesa/P14/Flow').click();
            await expect(note(page)).toHaveAttribute('data-save', '{asset.path}/Flow', { timeout: REPLY_MS });
            await expect(loading).toHaveCount(1);
            await shot(page, 'mapstudio-tagbrowser-loading-1366.png');
            gate.release();
            await expect(row(page, '[default]Plant/AmbientTemp')).toBeVisible({ timeout: REPLY_MS });
            await expect(loading).toHaveCount(0);
            // Under reduced motion the spinner stands still.
            await page.emulateMedia({ reducedMotion: 'reduce' });
            gate.hold = true;
            await toggle(page, '[default]Plant/Header');
            await expect(loading.locator('.mapstudio-spinner')).toBeVisible();
            expect(await loading.locator('.mapstudio-spinner').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
            gate.release();
            await expect(loading).toHaveCount(0, { timeout: REPLY_MS });
            await page.emulateMedia({ reducedMotion: 'no-preference' });

            // B10: a folder that is gone when it is opened: the Gateway's words under it, with Try again.
            const gone = 'The folder Plant/Secret was not found in tag provider default.';
            gate.refuse = { code: 'invalid', message: gone };
            await toggle(page, '[default]Plant/Secret');
            const failed = card(page).locator('.mapstudio-tag-row[data-kind="failed"]');
            await expect(failed).toContainText(gone, { timeout: REPLY_MS });
            await expect(failed).toHaveAttribute('data-under', 'Plant/Secret');
            await expect(failed.locator('.mapstudio-tag-retry')).toHaveText('Try again');
            await expect(row(page, '[default]Plant/AmbientTemp')).toBeVisible();
            await shot(page, 'mapstudio-tagbrowser-refused-folder-1366.png');
            gate.refuse = null;
            await failed.locator('.mapstudio-tag-retry').click();
            await expect(failed).toHaveCount(0, { timeout: REPLY_MS });
            // The pressed button went with its row: the focus is kept in the tree, on the folder.
            await expect(row(page, '[default]Plant/Secret')).toBeFocused();
            await expect(card(page).locator('.mapstudio-tag-row[data-path^="[default]Plant/Secret/"]').first()).toBeVisible();

            // B10: a reply `role` on a provider's first load: the Gateway's words in the tree's place, no Try again, nothing saved.
            gate.refuse = { code: 'role', message: ROLE_WORDS };
            await card(page).locator('.mapstudio-tagbrowser-select').selectOption('System');
            const problem = card(page).locator('.mapstudio-tagbrowser-problem');
            await expect(problem).toHaveAttribute('data-code', 'role', { timeout: REPLY_MS });
            await expect(problem.locator('.mapstudio-tagbrowser-problem-words')).toHaveText(ROLE_WORDS);
            await expect(problem.locator('.mapstudio-tagbrowser-problem-title')).toHaveCount(0);
            await expect(problem.locator('.mapstudio-tagbrowser-retry')).toHaveCount(0);
            await shot(page, 'mapstudio-tagbrowser-refused-role-1366.png');
            gate.refuse = null;
            await page.keyboard.press('Escape');
            await expect(card(page)).toHaveCount(0);
            expect((await setupOf(page, 'pad')).version).toBe(before.version);
        });

    editorTest('B10, B12: an asset folder the Gateway does not have opens the provider\'s top with its words; a kind with no linked item picks full paths',
        async ({ page, browser }) => {
            editorTest.setTimeout(300_000);
            await restore(browser);
            const map = await openEditor(page);

            // Decision 8: the Geofence kind's preview item is P14 lease, whose asset folder [default]Mesa/P14/Lease does not exist.
            const fence = await openKind(page, map, 'geofence', 'areas/p14-lease');
            const fenceBefore = await setupOf(page, 'geofence');
            await expect(field(page, 'preview').locator('.mapstudio-kindsetup-folder')).toHaveText('[default]Mesa/P14/Lease');
            await openCard(page, 'comms.path');
            await expect(card(page).locator('.mapstudio-tagbrowser-for')).toHaveText('For: Comms of the Geofence kind');
            await expect(note(page)).toHaveText("The folder Mesa/P14/Lease was not found in tag provider default. P14 lease's asset folder could not be opened, "
                + 'so the tree starts at the top.', { timeout: REPLY_MS });
            await expect(card(page).locator('.mapstudio-tag-row[data-asset="true"]')).toHaveCount(0);
            await expect(card(page).locator('.mapstudio-tagbrowser-home')).toHaveCount(0);
            await expect(row(page, '[default]Mesa')).toHaveAttribute('aria-expanded', 'false');
            // The keyboard is on the provider's first row.
            await expect(card(page).locator('.mapstudio-tag-row[data-kind="node"]').first()).toBeFocused();
            await expect(card(page).locator('.mapstudio-tag-row[data-kind="failed"]')).toHaveCount(0);
            await shot(page, 'mapstudio-tagbrowser-nofolder-1366.png');
            await page.keyboard.press('Escape');
            await expect(card(page)).toHaveCount(0);
            await expect(tagButton(page, 'comms.path')).toBeFocused();
            expect(await setupOf(page, 'geofence')).toEqual(fenceBefore);
            await expect(fence).toHaveAttribute('data-kind', 'geofence');

            // B12: no meter is linked to an asset: the default provider's top level, and a pick is its full path.
            expect(await setupOf(page, 'meter')).toBeUndefined();
            await page.locator('.mapstudio-kind-row[data-kind="meter"]').click();
            await expect(page.locator('.mapstudio-kindsetup')).toHaveAttribute('data-kind', 'meter');
            await expect(field(page, 'preview').locator('select')).toBeDisabled();
            await openCard(page, 'comms.path');
            await expect(card(page)).toHaveAttribute('data-provider', 'default');
            await expect(card(page).locator('.mapstudio-tagbrowser-default')).toHaveText('Default');
            await expect(note(page)).toHaveText('No meter is linked to an asset, so there is no asset folder to open. A pick is saved as the full path, '
                + 'the same tag for every meter.');
            await expect(row(page, '[default]Mesa')).toHaveAttribute('aria-expanded', 'false');
            await expect(card(page).locator('.mapstudio-tag-row[data-asset="true"]')).toHaveCount(0);
            await toggle(page, '[default]Plant');
            await row(page, '[default]Plant/AmbientTemp').click();
            await expect(note(page)).toHaveAttribute('data-save', '[default]Plant/AmbientTemp');
            await expect(note(page)).toHaveAttribute('data-tone', 'shared');
            await expect(note(page)).toContainText('No meter is linked to an asset, so it is saved as the full path.');
            await shot(page, 'mapstudio-tagbrowser-noasset-1366.png');
            await use(page).click();
            await expect(card(page)).toHaveCount(0);
            await settled(page);
            await expect(input(page, 'comms.path')).toHaveValue('[default]Plant/AmbientTemp');
            expect((await setupOf(page, 'meter')).setup).toEqual({ comms: { path: '[default]Plant/AmbientTemp' } });

            // A complete new row whose card is closed without a pick, the focus gone elsewhere, is saved as when the row is left.
            await page.locator('.mapstudio-kv-add').click();
            const typed = page.locator('.mapstudio-kv-row[data-new="true"]');
            await typed.locator('input[aria-label="Label"]').fill('Typed');
            await typed.locator('input[aria-label="Tag path"]').fill('[default]Plant/Header/Pressure');
            await typed.locator('.mapstudio-tag-button').click();
            await expect(card(page)).toBeVisible();
            await tagButton(page, 'comms.path').click();
            await expect(card(page)).toHaveAttribute('data-for', 'comms.path');
            await settled(page);
            await expect(input(page, 'kpis.typed.path')).toHaveValue('[default]Plant/Header/Pressure', { timeout: REPLY_MS });
            await page.keyboard.press('Escape');
            await expect(card(page)).toHaveCount(0);
            await page.locator('.mapstudio-kv-row[data-key="typed"] .mapstudio-kv-remove').click();
            await settled(page);
            await expect(page.locator('.mapstudio-kv-row[data-key="typed"]')).toHaveCount(0);

            // A new key value row has its tag button too: the pick fills its path, and the row is saved once it has its label.
            await page.locator('.mapstudio-kv-add').click();
            const fresh = page.locator('.mapstudio-kv-row[data-new="true"]');
            await fresh.locator('input[aria-label="Label"]').fill('Ambient');
            await fresh.locator('.mapstudio-tag-button').click();
            await expect(card(page).locator('.mapstudio-tagbrowser-for')).toHaveText('For: Key value 1 of the Meter kind');
            await expect(fresh).toHaveClass(/mapstudio-kv-row--browsing/);
            await expect(page.locator('.mapstudio-field-problem')).toHaveCount(0);
            await toggle(page, '[default]Plant');
            await row(page, '[default]Plant/AmbientTemp').click();
            await use(page).click();
            await expect(card(page)).toHaveCount(0);
            await settled(page);
            await expect(input(page, 'kpis.ambient.path')).toHaveValue('[default]Plant/AmbientTemp');
            // The new row became a stored one under the focus: the focus is on the stored row's tag button, not lost to the page.
            await expect(page.locator('.mapstudio-kv-row[data-new="true"]')).toHaveCount(0);
            await expect(tagButton(page, 'kpis.ambient.path')).toBeFocused();
            expect((await setupOf(page, 'meter')).setup.kpis).toEqual([{ key: 'ambient', label: 'Ambient', path: '[default]Plant/AmbientTemp', unit: '', on: true, icon: false }]);
        });

    editorTest('B11: another editor saves the setup while the card is open; the pick meets the conflict card and nothing is overwritten',
        async ({ page, browser }) => {
            editorTest.setTimeout(300_000);
            await restore(browser);
            const map = await openEditor(page);
            const other = await signedInContext(browser, EDITOR2_USER, { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
            try {
                const theirs = await other.newPage();
                await mapLoaded(await openMap(theirs, '/edit'));
                const panel = await openKind(page, map, 'pad', TRACER.points.p2.key);
                const before = await setupOf(page, 'pad');
                await openCard(page, 'kpis.flow.path');
                await row(page, '[default]Mesa/P14/Pressure').click();
                await expect(use(page)).toBeEnabled({ timeout: REPLY_MS });

                // B saves the link while A's card is open.
                const reply = await send(theirs, 'edits.apply', { batchId: randomUUID(), ops: [{ op: 'update', entity: 'kindSetup', id: 'pad',
                    baseVersion: before.version, data: { setup: { ...before.setup, link: '/theirs/{item.name}' } } }] });
                expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
                await expect(panel).toHaveAttribute('data-version', String(before.version + 1), { timeout: REPLY_MS });
                await expect(card(page)).toBeVisible();

                // A uses the pick: it goes at the version seen when the card opened, and the Gateway answers the conflict.
                await use(page).click();
                await expect(card(page)).toHaveCount(0);
                const conflict = page.locator('.mapstudio-save-card[data-card="conflict"]');
                await expect(conflict).toBeVisible({ timeout: REPLY_MS });
                await expect(conflict.locator('.mapstudio-save-card-title')).toHaveText('Not saved - conflict with ' + EDITOR2_USER + "'s change");
                await expect(conflict.locator('.mapstudio-save-card-ontop')).toHaveCount(0);
                const stored = await setupOf(page, 'pad');
                expect(stored.version).toBe(before.version + 1);
                expect(stored.setup).toEqual({ ...before.setup, link: '/theirs/{item.name}' });
                // While it waits the tag buttons take no press.
                await expect(tagButton(page, 'kpis.flow.path')).toBeDisabled();
                await shot(page, 'mapstudio-tagbrowser-conflict-1366.png');
                await conflict.locator('.mapstudio-save-card-theirs').click();
                await expect(conflict).toHaveCount(0);
                await expect(input(page, 'kpis.flow.path')).toHaveValue('{asset.path}/Flow');
                await expect(input(page, 'link')).toHaveValue('/theirs/{item.name}');
                await expect(tagButton(page, 'kpis.flow.path')).toBeEnabled();
            } finally {
                await other.close();
            }
        });

    editorTest('the card closes with its kind, its surface and Edit mode, and changes nothing', async ({ page, browser }) => {
        editorTest.setTimeout(240_000);
        await restore(browser);
        const map = await openEditor(page);
        await openKind(page, map, 'pad', TRACER.points.p2.key);
        const before = await setupOf(page, 'pad');

        // One at a time: another tag button moves the card to its row.
        await openCard(page, 'kpis.pressure.path');
        await tagButton(page, 'comms.path').click();
        await expect(card(page)).toHaveCount(1);
        await expect(card(page)).toHaveAttribute('data-for', 'comms.path');
        await expect(card(page).locator('.mapstudio-tagbrowser-for')).toHaveText('For: Comms of the Well pad kind');
        await expect(page.locator('.mapstudio-kv-row--browsing')).toHaveCount(0);
        await expect(tagButton(page, 'comms.path')).toHaveAttribute('aria-expanded', 'true');
        // Its own button again closes it.
        await tagButton(page, 'comms.path').click();
        await expect(card(page)).toHaveCount(0);

        // Another kind.
        await openCard(page, 'comms.path');
        await page.locator('.mapstudio-kind-row[data-kind="line"]').click();
        await expect(page.locator('.mapstudio-kindsetup')).toHaveAttribute('data-kind', 'line');
        await expect(card(page)).toHaveCount(0);
        await page.locator('.mapstudio-kind-row[data-kind="pad"]').click();
        await expect(page.locator('.mapstudio-kindsetup')).toHaveAttribute('data-kind', 'pad');
        await expect(card(page)).toHaveCount(0);

        // Another surface.
        await openCard(page, 'comms.path');
        await page.locator('.mapstudio-rail-item[data-surface="items"]').click();
        await expect(map).toHaveAttribute('data-surface', 'items');
        await expect(card(page)).toHaveCount(0);
        await page.locator('.mapstudio-rail-item[data-surface="kinds"]').click();
        await expect(card(page)).toHaveCount(0);

        // Leaving Edit mode.
        await openCard(page, 'comms.path');
        await row(page, '[default]Mesa/P14/Pressure').click();
        await expect(use(page)).toBeEnabled({ timeout: REPLY_MS });
        await page.locator('.mapstudio-rail-item[data-surface="view"]').click();
        await expect(map).toHaveAttribute('data-mode', 'view');
        await expect(card(page)).toHaveCount(0);
        expect(await setupOf(page, 'pad')).toEqual(before);
    });
});

test.describe('nobody but a full editor', () => {
    test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });

    test('a viewer has no tag button, and its open map sends no tags.browse', async ({ page }) => {
        const sent = [];
        page.on('websocket', (ws) => ws.on('framesent', (f) => sent.push(typeof f.payload === 'string' ? f.payload : '')));
        const map = await openMap(page, '/edit');
        await mapLoaded(map);
        await expect(map).toHaveAttribute('data-edit-level', 'none');
        await expect(map).toHaveAttribute('data-studio', 'off');
        await expect(page.locator('.mapstudio-tag-button')).toHaveCount(0);
        await expect(page.locator('.mapstudio-tagbrowser')).toHaveCount(0);
        expect(sent.some((f) => f.includes('map.load'))).toBe(true);
        expect(sent.filter((f) => f.includes('tags.browse'))).toEqual([]);
    });

    test('a phone editor at phone width has no tag button, and its open map sends no tags.browse', async ({ browser }) => {
        const context = await signedInContext(browser, OPERATOR_USER, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
        try {
            const page = await context.newPage();
            const sent = [];
            page.on('websocket', (ws) => ws.on('framesent', (f) => sent.push(typeof f.payload === 'string' ? f.payload : '')));
            const map = await openMap(page, '/edit');
            await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + OPERATOR_USER);
            await mapLoaded(map);
            await expect(map).toHaveAttribute('data-edit-level', 'phone');
            await expect(map).toHaveAttribute('data-studio', 'off');
            await expect(page.locator('.mapstudio-tag-button')).toHaveCount(0);
            await expect(page.locator('.mapstudio-tagbrowser')).toHaveCount(0);
            expect(sent.some((f) => f.includes('map.load'))).toBe(true);
            expect(sent.filter((f) => f.includes('tags.browse'))).toEqual([]);
        } finally {
            await context.close();
        }
    });
});
