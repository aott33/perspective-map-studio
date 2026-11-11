// The Style tab and an item's own style rule (epic 4 entry 12c2, R5, R15; DESIGN.md Properties panel and tabs, Override tag;
// docs/kind-setup.md "An item's own style rule from the Style tab"): at 1366 px as the map editor, the plan's matrix. Point 1
// (the seed's pad on asset P12; the plan's "P12") has the two tabs, a real tab list; Style stays chosen while another item is
// selected and across a visit to Kinds (T1). Its Style tab shows Icon, Size and Label read only and the pad kind's rule in words
// with its case tiles under "From kind" (T2); "Edit the kind's rule" opens Kinds at Well pad with section 6 in view, the
// selection kept (T3). Override saves a copy of the kind's rule at once, its path filled for Point 1, marked Override with
// Reset; a case's preset changed draws Point 1 alone by its own rule at the next live update, in this map and in a second open
// one, and the kind's header counts it (T4); Undo names the style rule and Recent changes lists it with Revert (T10); a path
// under {asset.path} says so beside the field in 12c1's words and nothing is sent (T7); a case without a preset says "Not saved
// yet" and why, the stored rule standing, the draft kept across the tabs (T8); the path override the item had is stored
// unchanged throughout (T11); Reset returns it to the kind's rule (T5). Point 2's seeded expression shows in the editor marked
// Override (T6), L-SWD's instruments source too (T9); an unlinked pad starts empty and saves once its rule is built. Renders of
// the tab's read-only rows, its rule from the kind, overridden and not saved yet for the docs under E2E_DOCS=1. Kinds' section 6 through the shared editor
// (T12) is the 12b1 and 12b2 specs', unchanged. A rule half built while another editor stores a rule for the item is sent at the
// version it was built on: a conflict with the ordinary card, their rule standing. The spec leaves the seed and the dev tags as it found them.
//
// Entry 12c3 (the tab reordered after three reviews, its words made plain, its flow mended; the plan's matrix U1 to U11). U1: on
// a pad at 1366 by 768 the heading, Live now, the rule's sentence and the actions show without scrolling, From kind last. U2: the
// action line, and overridden the own-rule line and the link to the kind's rule. U3: Live now, one line; the alarm clause and
// the Comms lost words only when true. U4: a half-built own rule is as it was left after another item and after Kinds, nothing
// sent. U5: Esc on a rule button while not saved leaves the panel and the draft. U6: Enter in a rule field keeps the focus;
// a removed row gives the focus to the row before, or to Add. U7: after Override by keyboard the focus is on the chosen type,
// and Enter again changes nothing. U8: Ctrl+Z with the focus on a rule button shows the stored rule in the editor. U9: "Edit
// the kind's rule", then "Back to Point 1". U10: Override on an unlinked line saves at once; on an unlinked pad whose kind
// reads a path under {asset.path} it starts empty. U11 (Kinds' section 6) is kindstyle.spec.mjs's.

import { randomUUID } from 'node:crypto';
import {
    EDITOR2_USER, EDITOR_USER, editorTest, ensureSeeded, expect, mapLoaded, openMap, removeStrays, runSeed, send, shot as shotNow, signedInContext, test
} from './fixtures.mjs';

/** The Gateway's answer to a save, and the next live update. */
const REPLY_MS = 20_000;
const LIVE_MS = 30_000;
/** There is nothing to observe when nothing is sent: the time a stray batch would have to show in the map's seq. */
const NOTHING_MS = 800;
/** A spot for the item this spec makes through the test hook, out of the tracer's view. */
const AWAY = [-104.82, 39.66];
const P12 = '[default]Mesa/P12';
const P14 = '[default]Mesa/P14';
const PAD_CASES = [{ value: 1, preset: 'attention' }, { value: 2, preset: 'warning' }, { value: 3, preset: 'fault' }, { value: 4, preset: 'dimmed' }];

let seed;

/** Press a /live dev button and return its result (the label changes on every press, ranAt included). */
async function press(page, button) {
    const out = page.locator('#mapstudio-live-result');
    const before = await out.innerText();
    await page.locator('#mapstudio-live-' + button).click();
    await expect.poll(() => out.innerText(), { timeout: 30_000 }).not.toBe(before);
    const result = JSON.parse(await out.innerText());
    expect(result.error, 'the dev button ' + button).toBeUndefined();
    expect(result.refused, 'the dev button ' + button).toBeUndefined();
    return result;
}

/** The dev tags this spec drives in their quiet state: P12's status 0 at 400 psi with no alarm, comms on, nothing unacknowledged. */
async function quiet(page) {
    await press(page, 'status-0');
    await press(page, 'pressure-low');
    await press(page, 'comms-on');
    await press(page, 'ack');
}

/** The seed's own items again (Point 2's and L-SWD's overrides among them), no stray item, and the dev tags quiet. */
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

/** The second tab, on /live: its dev buttons, and another open map to agree with. */
async function openDev(context) {
    const dev = await context.newPage();
    await mapLoaded(await openMap(dev, '/live'));
    return dev;
}

async function seqOf(map) {
    return Number(await map.getAttribute('data-store-seq'));
}

/** The stored record of a live map item through the test hook, or undefined. */
async function stored(page, id) {
    return (await send(page, 'map.load', {})).body.items.find((i) => i.id === id && !i.deleted);
}

/** One batch through the test hook, saved. */
async function apply(page, ops) {
    const reply = await send(page, 'edits.apply', { batchId: randomUUID(), ops });
    expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
}

/** A list row clicked: the item selected with its panel open. */
async function selectRow(page, id) {
    await page.locator('.mapstudio-list-row[data-item-id="' + id + '"]').click();
    await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', id);
}

const tab = (page, name) => page.locator('.mapstudio-panel .mapstudio-panel-tabs .mapstudio-panel-tab[data-tab="' + name + '"]');
const style = (page) => page.locator('.mapstudio-panel .mapstudio-style');
const rule = (page) => style(page).locator('.mapstudio-style-rule');
const editor = (page) => rule(page).locator('.mapstudio-rule');
const ruleCase = (page, i) => editor(page).locator('.mapstudio-rule-case[data-index="' + i + '"]');
const unsaved = (page) => editor(page).locator('.mapstudio-rule-unsaved');
const shows = (page) => style(page).locator('.mapstudio-style-shows');
const kindLink = (page) => rule(page).locator('.mapstudio-style-kind');
const actionLine = (page) => rule(page).locator('.mapstudio-style-line');
const chosenType = (page) => editor(page).locator('.mapstudio-rule-type[aria-pressed="true"]');
const back = (page) => page.locator('.mapstudio-kindsetup .mapstudio-kindsetup-back');
/** What the "Not saved yet" note ends with in the Style tab, after the reason (entry 12c3). */
const KEEPS = ' The map keeps the saved rule until then.';

/** Nothing is missing: the note is one node that stays mounted (entry 12c3), with no words and not shown. */
async function noUnsaved(page) {
    await expect(unsaved(page)).toHaveCount(1);
    await expect(unsaved(page)).toHaveText('');
    await expect(unsaved(page)).toBeHidden();
}
const undo = (page) => page.locator('.mapstudio-toolbar .mapstudio-undo');
const liveItem = (page, id) => page.locator('.mapstudio-live-item[data-item-id="' + id + '"]');

/** One rule edit saved as one batch: Undo names its step, and the map's seq moved on by exactly one. */
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

/** A render for the docs with `target` in view (the rule's heading when none is given). */
async function shot(page, name, target = rule(page).locator('.mapstudio-style-rule-head')) {
    await target.evaluate((el) => el.scrollIntoView({ block: 'nearest' }));
    await page.waitForTimeout(500);
    await shotNow(page, name);
}

async function openKinds(page, map) {
    await page.locator('.mapstudio-rail-item[data-surface="kinds"]').click();
    await expect(map).toHaveAttribute('data-surface', 'kinds');
}

async function openItems(page, map) {
    await page.locator('.mapstudio-rail-item[data-surface="items"]').click();
    await expect(map).toHaveAttribute('data-surface', 'items');
}

async function padCount(page) {
    return (await send(page, 'map.load', {})).body.items.filter((i) => !i.deleted && i.kind === 'pad').length;
}

editorTest.describe('the Style tab and an item\'s own style rule at 1366 px', () => {
    editorTest.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, actionTimeout: REPLY_MS });
    editorTest.describe.configure({ mode: 'serial' });

    editorTest('T1 to T5, T7, T8, T10, T11, U1 to U9: the tabs, the order, the rule from the kind, Edit the kind\'s rule and Back, Override, a path not full, a half-built rule kept, Undo and Recent changes, Reset',
        async ({ page, context }) => {
            editorTest.setTimeout(480_000);
            const p1 = seed.ids['tracer/p1'];
            const p3 = seed.ids['tracer/p3'];
            const dev = await openDev(context);
            await quiet(dev);
            const map = await openEditor(page);
            // T11: Point 1 has a path override before its rule is touched; it is stored unchanged to the end.
            const kpis = [{ key: 'flow', path: P14 + '/Flow' }];
            const before = await stored(page, p1);
            await apply(page, [{ op: 'update', entity: 'item', id: p1, baseVersion: before.version, data: { overrides: { kpis } } }]);
            await selectRow(page, p1);
            await expect(page.locator('.mapstudio-livenow-row[data-row="kpi:flow"]')).toHaveAttribute('data-override', 'true', { timeout: REPLY_MS });

            // T1: Details and Style, a real tab list: one tab stop, each names its panel, the chosen one underlined.
            const tabs = page.locator('.mapstudio-panel .mapstudio-panel-tabs');
            await expect(tabs).toHaveAttribute('role', 'tablist');
            await expect(tabs.locator('[role="tab"]')).toHaveText(['Details', 'Style']);
            await expect(tab(page, 'details')).toHaveAttribute('aria-selected', 'true');
            await expect(tab(page, 'details')).toHaveClass(/mapstudio-panel-tab--active/);
            await expect(tab(page, 'details')).toHaveAttribute('tabindex', '0');
            await expect(tab(page, 'style')).toHaveAttribute('tabindex', '-1');
            await expect(style(page)).toBeHidden();
            expect(await tab(page, 'details').evaluate((el) => getComputedStyle(el).borderBottomWidth)).toBe('2px');
            await tab(page, 'style').click();
            await expect(tab(page, 'style')).toHaveAttribute('aria-selected', 'true');
            await expect(tab(page, 'style')).toHaveClass(/mapstudio-panel-tab--active/);
            await expect(tab(page, 'details')).toHaveAttribute('aria-selected', 'false');
            await expect(style(page)).toBeVisible();
            await expect(page.locator('.mapstudio-panel .mapstudio-panel-body')).toBeHidden();
            expect(await style(page).getAttribute('id')).toBe(await tab(page, 'style').getAttribute('aria-controls'));
            expect(await style(page).getAttribute('aria-labelledby')).toBe(await tab(page, 'style').getAttribute('id'));
            await expect(style(page)).toHaveAttribute('role', 'tabpanel');
            // The arrow keys move between the tabs and choose; the focus follows.
            await tab(page, 'style').focus();
            await page.keyboard.press('ArrowLeft');
            await expect(tab(page, 'details')).toHaveAttribute('aria-selected', 'true');
            await expect(tab(page, 'details')).toBeFocused();
            await expect(page.locator('.mapstudio-panel .mapstudio-panel-body')).toBeVisible();
            await page.keyboard.press('ArrowRight');
            await expect(tab(page, 'style')).toHaveAttribute('aria-selected', 'true');
            await expect(tab(page, 'style')).toBeFocused();
            await page.keyboard.press('Home');
            await expect(tab(page, 'details')).toBeFocused();
            await page.keyboard.press('End');
            await expect(tab(page, 'style')).toBeFocused();
            await expect(style(page)).toBeVisible();
            // Style stays chosen while another item is selected, and across a visit to Kinds.
            await selectRow(page, p3);
            await expect(tab(page, 'style')).toHaveAttribute('aria-selected', 'true');
            await expect(style(page)).toBeVisible();
            await openKinds(page, map);
            await openItems(page, map);
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', p3);
            await expect(tab(page, 'style')).toHaveAttribute('aria-selected', 'true');
            await expect(style(page)).toBeVisible();
            await selectRow(page, p1);
            await expect(style(page)).toBeVisible();

            // T2, U1: the order of entry 12c3. The Style rule heading with its "From kind" tag, Live now, the kind's rule in words,
            // the actions with their one line, and From kind (icon and size) last; no read-only rows above the rule.
            await expect(style(page).locator('.mapstudio-style-row')).toHaveCount(0);
            await expect(rule(page)).toHaveAttribute('data-own', 'false');
            const heading = rule(page).locator('.mapstudio-livenow-heading');
            await expect(heading).toHaveText(/^Style rule$/i);
            expect(await rule(page).getAttribute('aria-labelledby')).toBe(await heading.getAttribute('id'));
            const ruleTag = rule(page).locator('.mapstudio-style-rule-head > .mapstudio-style-tag');
            await expect(ruleTag).toHaveText('From kind');
            await expect(ruleTag).toHaveClass(/mapstudio-fromkind-tag/);
            // The rule's section is described by its tag.
            expect(await rule(page).getAttribute('aria-describedby')).toBe(await ruleTag.getAttribute('id'));
            await expect(rule(page).locator('.mapstudio-override-tag')).toHaveCount(0);
            // U3: Live now, one line; no alarm, Stale or Comms lost words while none is true.
            await expect(rule(page).locator('.mapstudio-style-live-label')).toHaveText('Live now');
            await expect(shows(page)).toHaveText('Point 1 is Normal, by the well pad rule.', { timeout: LIVE_MS });
            await expect(shows(page)).toHaveAttribute('role', 'status');
            // The kind's rule: its sentence, the path filled for Point 1, and one line per case, the tile and its words.
            const kindRule = rule(page).locator('.mapstudio-style-kindrule');
            await expect(kindRule).toHaveAttribute('data-rule', 'states');
            await expect(kindRule.locator('.mapstudio-style-summary')).toHaveText('States on the tag ' + P12 + '/Status');
            expect(await kindRule.locator('.mapstudio-style-kindcase').evaluateAll((els) => els.map((e) => e.dataset.preset)))
                .toEqual(['attention', 'warning', 'fault', 'dimmed']);
            await expect(kindRule.locator('.mapstudio-style-kindcase-text')).toHaveText(
                ['When the value is 1Attention', 'When the value is 2Warning', 'When the value is 3Fault', 'When the value is 4Out of service']);
            // No code name: the preset is said in the tiles' words, once.
            await expect(kindRule.locator('.mapstudio-mono')).toHaveCount(0);
            await expect(kindRule.locator('.mapstudio-rule-word')).toHaveCount(0);
            // Each case has its tile, drawn by the map's own code.
            await expect(kindRule.locator('.mapstudio-rule-tile .mapstudio-rule-sample > svg')).toHaveCount(4, { timeout: REPLY_MS });
            await expect(editor(page)).toHaveCount(0);
            // U2: Override is the one bordered button, the kind's rule a text link, and one line in view says what each does.
            const override = rule(page).locator('.mapstudio-style-override');
            await expect(override).toHaveText('Override');
            await expect(kindLink(page)).toHaveText("Edit the kind's rule");
            expect(await override.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('1px');
            expect(await kindLink(page).evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('0px');
            expect(await kindLink(page).evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe('underline');
            await expect(rule(page).locator('.mapstudio-button')).toHaveCount(1);
            await expect(actionLine(page)).toHaveText("Override gives Point 1 its own copy, saved at once. Edit the kind's rule changes every well pad.");
            expect(await override.getAttribute('aria-describedby')).toBe(await actionLine(page).getAttribute('id'));
            expect(await kindLink(page).getAttribute('aria-describedby')).toBe(await actionLine(page).getAttribute('id'));
            expect(await override.getAttribute('title')).toBeNull();
            // U1: all of it shows at 1366 by 768 without scrolling, in this order, with From kind last.
            expect(await style(page).evaluate((el) => el.scrollTop)).toBe(0);
            const parts = [rule(page).locator('.mapstudio-style-rule-head'), rule(page).locator('.mapstudio-style-live'), kindRule,
                rule(page).locator('.mapstudio-style-actions'), actionLine(page)];
            for (const part of parts) {
                await expect(part).toBeInViewport({ ratio: 1 });
            }
            const foot = style(page).locator('.mapstudio-style-fromkind');
            const tops = [];
            for (const part of [...parts, foot]) {
                tops.push((await part.boundingBox()).y);
            }
            expect(tops.slice().sort((a, b) => a - b)).toEqual(tops);
            expect(await foot.evaluate((el) => el === el.parentElement.lastElementChild)).toBe(true);
            // From kind: the icon and the size in one line with one hint, read only; no Label row.
            await expect(foot.locator('.mapstudio-style-fromkind-head')).toHaveText(/^From kind$/i);
            await expect(foot.locator('[data-row]')).toHaveCount(2);
            await expect(foot.locator('[data-row="icon"] .mapstudio-style-value')).toHaveText('well-pad');
            await expect(foot.locator('[data-row="icon"] .mapstudio-popup-glyph')).toHaveCount(1);
            await expect(foot.locator('[data-row="size"] .mapstudio-style-value')).toHaveText('One size');
            const rowTops = await foot.locator('[data-row]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2)));
            expect(Math.abs(rowTops[0] - rowTops[1])).toBeLessThanOrEqual(2);
            await expect(foot.locator('.mapstudio-field-hint')).toHaveText(["The icon and the size come from the project's kind list and are not changed here."]);
            await expect(foot.locator('input, select, button, textarea')).toHaveCount(0);
            await expect(style(page).locator('[data-row="label"]')).toHaveCount(0);
            // One divider in the tab: the foot's.
            expect(await foot.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('1px');
            expect(await rule(page).evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('0px');
            // Every control is a 24 px target at least, and the panel has no em dash.
            for (const box of await page.locator('.mapstudio-panel .mapstudio-panel-tab, .mapstudio-panel .mapstudio-style button')
                .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
                expect(box.width).toBeGreaterThanOrEqual(24);
                expect(box.height).toBeGreaterThanOrEqual(24);
            }
            expect(await page.locator('.mapstudio-panel').innerText()).not.toContain(String.fromCharCode(0x2014));
            await shot(page, 'mapstudio-itemstyle-fromkind-1366.png');

            // U3: an active alarm adds its clause; Comms lost is said alone; neither stays once it is no longer true.
            await press(dev, 'pressure-high');
            await expect(shows(page)).toHaveText('Point 1 is Normal, by the well pad rule. Its priority 1 alarm shows over it.', { timeout: LIVE_MS });
            await press(dev, 'pressure-low');
            await press(dev, 'ack');
            await press(dev, 'comms-off');
            await expect(shows(page)).toHaveText('Point 1 shows only as Comms lost until a fresh value comes.', { timeout: LIVE_MS });
            await press(dev, 'comms-on');
            await expect(shows(page)).toHaveText('Point 1 is Normal, by the well pad rule.', { timeout: LIVE_MS });

            // T3, U9: Edit the kind's rule opens Kinds at Well pad with section 6 in view; the item is still selected, and
            // "Back to Point 1" returns to it with the Style tab chosen.
            await kindLink(page).click();
            await expect(map).toHaveAttribute('data-surface', 'kinds');
            await expect(page.locator('.mapstudio-kindsetup')).toHaveAttribute('data-kind', 'pad');
            const section = page.locator('.mapstudio-kindsetup [data-section="styleRule"]');
            await expect(section.locator('.mapstudio-kindsetup-heading')).toBeInViewport();
            await expect(section.locator('.mapstudio-rule-type[data-type="states"]')).toBeFocused();
            await expect(back(page)).toHaveText('Back to Point 1');
            const backBox = await back(page).boundingBox();
            expect(backBox.height).toBeGreaterThanOrEqual(24);
            await back(page).click();
            await expect(map).toHaveAttribute('data-surface', 'items');
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', p1);
            await expect(tab(page, 'style')).toHaveAttribute('aria-selected', 'true');
            await expect(style(page)).toBeVisible();
            // The keyboard is back on the link it left from.
            await expect(kindLink(page)).toBeFocused();
            // Left by the rail instead of Back, the item's panel is there as ever, on the same tab.
            await kindLink(page).click();
            await expect(back(page)).toHaveText('Back to Point 1');
            await openItems(page, map);
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', p1);
            await expect(style(page)).toBeVisible();
            // Kinds opened from the rail has no item to go back to.
            await openKinds(page, map);
            await expect(page.locator('.mapstudio-kindsetup')).toBeVisible();
            await expect(back(page)).toHaveCount(0);
            await openItems(page, map);
            await expect(style(page)).toBeVisible();

            // T4: Override saves the copy of the kind's rule at once, its path filled for Point 1: marked Override, with Reset.
            // U7: by keyboard. The focus goes to the rule's chosen type, never to Reset, so Enter again changes nothing.
            let seq = await seqOf(map);
            await rule(page).locator('.mapstudio-style-override').focus();
            await page.keyboard.press('Enter');
            await expect(rule(page)).toHaveAttribute('data-own', 'true');
            await expect(chosenType(page)).toBeFocused();
            await expect(chosenType(page)).toHaveAttribute('data-type', 'states');
            await page.keyboard.press('Enter');
            await expectOneBatch(page, map, seq, "change Point 1's style rule");
            await expect(rule(page)).toHaveAttribute('data-own', 'true');
            await expect(chosenType(page)).toBeFocused();
            const copy = { source: { path: P12 + '/Status' }, type: 'states', cases: PAD_CASES };
            expect((await stored(page, p1)).overrides).toEqual({ kpis, styleRule: copy });
            await expect(ruleTag).toHaveText('Override');
            await expect(ruleTag).toHaveClass(/mapstudio-override-tag/);
            expect(await rule(page).getAttribute('aria-describedby')).toBe(await ruleTag.getAttribute('id'));
            await expect(rule(page).locator('.mapstudio-style-reset')).toHaveText('Reset');
            await expect(rule(page).locator('.mapstudio-fromkind-tag')).toHaveCount(0);
            await expect(rule(page).locator('.mapstudio-style-override')).toHaveCount(0);
            // U2 overridden: whose the rule is and how it saves, and a link to the kind's rule.
            await expect(actionLine(page)).toHaveText('For Point 1 only. Changes save as you make them.');
            await expect(kindLink(page)).toHaveText("Open the kind's rule");
            await expect(shows(page)).toHaveText('Point 1 is Normal, by its own rule.', { timeout: LIVE_MS });
            // The selects say the tiles' words; their values are the stored names.
            await expect(ruleCase(page, 3).locator('.mapstudio-rule-preset option')).toHaveText(
                ['Pick a preset', 'Normal', 'Attention', 'Warning', 'Fault', 'Out of service']);
            await expect(ruleCase(page, 3).locator('.mapstudio-rule-preset')).toHaveValue('dimmed');
            // The shared editor: no None type, the value a typed full path, the kind's four cases, no resolve note.
            expect(await editor(page).locator('.mapstudio-rule-type').evaluateAll((els) => els.map((e) => e.dataset.type))).toEqual(['states', 'bands', 'expression']);
            await expect(editor(page).locator('.mapstudio-rule-type[data-type="states"]')).toHaveAttribute('aria-pressed', 'true');
            await expect(editor(page).locator('.mapstudio-rule-source')).toHaveAttribute('data-source', 'path');
            await expect(editor(page).locator('.mapstudio-rule-path')).toHaveValue(P12 + '/Status');
            expect(await editor(page).locator('.mapstudio-rule-source-select option').evaluateAll((els) => els.map((e) => e.value)))
                .toEqual(['', 'kpi:pressure', 'kpi:flow', 'path']);
            await expect(editor(page).locator('.mapstudio-rule-case')).toHaveCount(4);
            await expect(style(page).locator('.mapstudio-resolve-note')).toHaveCount(0);
            await noUnsaved(page);
            // The override tag wears the selection token on its tint, never a colour of its own.
            expect(await rule(page).locator('.mapstudio-override-tag').evaluate((el) => {
                const probe = document.createElement('span');
                probe.style.color = 'var(--callToAction)';
                el.parentElement.appendChild(probe);
                const token = getComputedStyle(probe).color;
                probe.remove();
                return getComputedStyle(el).color === token;
            })).toBe(true);
            // A case's preset changed: one save, the whole rule, the path override untouched.
            seq = await seqOf(map);
            await ruleCase(page, 0).locator('.mapstudio-rule-preset').selectOption('fault');
            await expectOneBatch(page, map, seq, "change Point 1's style rule");
            const own = { ...copy, cases: [{ value: 1, preset: 'fault' }, ...PAD_CASES.slice(1)] };
            expect((await stored(page, p1)).overrides).toEqual({ kpis, styleRule: own });
            await expect(ruleCase(page, 0).locator('.mapstudio-rule-tile')).toHaveAttribute('data-preset', 'fault');
            // Point 1 draws by its own rule at the next live update, in this map and in the other open one; Point 3 by the kind's.
            const p3Before = await liveItem(page, p3).getAttribute('data-preset');
            await press(dev, 'status-1');
            await expect(liveItem(page, p1)).toHaveAttribute('data-preset', 'fault', { timeout: LIVE_MS });
            await expect(liveItem(dev, p1)).toHaveAttribute('data-preset', 'fault', { timeout: LIVE_MS });
            await expect(liveItem(page, p3)).toHaveAttribute('data-preset', p3Before);
            await expect(shows(page)).toHaveText('Point 1 is Fault, by its own rule.', { timeout: LIVE_MS });
            for (const box of await style(page).locator('button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
                expect(box.width).toBeGreaterThanOrEqual(24);
                expect(box.height).toBeGreaterThanOrEqual(24);
            }
            await shot(page, 'mapstudio-itemstyle-override-1366.png');
            // The kind's header counts it; the selection and the tab are kept.
            const pads = await padCount(page);
            await openKinds(page, map);
            await page.locator('.mapstudio-kind-row[data-kind="pad"]').click();
            await expect(page.locator('.mapstudio-kindsetup-subline'))
                .toHaveText('Point - applies to ' + pads + ' items - 3 overrides (Point 1 key values, Point 1 style rule and 1 more)');
            await openItems(page, map);
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', p1);
            await expect(rule(page)).toHaveAttribute('data-own', 'true');

            // T10: Undo names the style rule and undoes it; Redo puts it back; Recent changes lists it with Revert.
            await expect(undo(page)).toHaveAttribute('data-step', "Undo: change Point 1's style rule");
            await undo(page).click();
            await expect.poll(async () => (await stored(page, p1)).overrides, { timeout: REPLY_MS }).toEqual({ kpis, styleRule: copy });
            await expect(ruleCase(page, 0).locator('.mapstudio-rule-preset')).toHaveValue('attention', { timeout: REPLY_MS });
            await page.locator('.mapstudio-toolbar .mapstudio-redo').click();
            await expect.poll(async () => (await stored(page, p1)).overrides, { timeout: REPLY_MS }).toEqual({ kpis, styleRule: own });
            await expect(ruleCase(page, 0).locator('.mapstudio-rule-preset')).toHaveValue('fault', { timeout: REPLY_MS });
            // U8: Ctrl+Z with the focus on a rule button: the editor shows the rule as it now is stored, the focus where it was.
            await chosenType(page).focus();
            await page.keyboard.press('Control+z');
            await expect.poll(async () => (await stored(page, p1)).overrides, { timeout: REPLY_MS }).toEqual({ kpis, styleRule: copy });
            await expect(ruleCase(page, 0).locator('.mapstudio-rule-preset')).toHaveValue('attention', { timeout: REPLY_MS });
            await expect(ruleCase(page, 0).locator('.mapstudio-rule-tile')).toHaveAttribute('data-preset', 'attention');
            await expect(chosenType(page)).toBeFocused();
            await noUnsaved(page);
            await page.keyboard.press('Control+Shift+z');
            await expect.poll(async () => (await stored(page, p1)).overrides, { timeout: REPLY_MS }).toEqual({ kpis, styleRule: own });
            await expect(ruleCase(page, 0).locator('.mapstudio-rule-preset')).toHaveValue('fault', { timeout: REPLY_MS });
            await expect(chosenType(page)).toBeFocused();
            // The same with the focus on a row's Remove.
            await ruleCase(page, 1).locator('.mapstudio-rule-remove').focus();
            await page.keyboard.press('Control+z');
            await expect(ruleCase(page, 0).locator('.mapstudio-rule-preset')).toHaveValue('attention', { timeout: REPLY_MS });
            await expect(ruleCase(page, 1).locator('.mapstudio-rule-remove')).toBeFocused();
            await expect(page.locator('.mapstudio-toolbar .mapstudio-redo')).toBeEnabled({ timeout: REPLY_MS });
            await expect.poll(async () => (await stored(page, p1)).overrides, { timeout: REPLY_MS }).toEqual({ kpis, styleRule: copy });
            await page.keyboard.press('Control+Shift+z');
            await expect(ruleCase(page, 0).locator('.mapstudio-rule-preset')).toHaveValue('fault', { timeout: REPLY_MS });
            await expect.poll(async () => (await stored(page, p1)).overrides, { timeout: REPLY_MS }).toEqual({ kpis, styleRule: own });
            await page.locator('.mapstudio-rail-item[data-surface="history"]').click();
            const history = page.locator('.mapstudio-history');
            await expect(history).toBeVisible();
            // An Undo and a Redo are rows of their own ("Reverted ..."); the change itself is the row with the sentence alone.
            const ruleRow = history.locator('.mapstudio-history-row')
                .filter({ has: page.locator('.mapstudio-history-sentence', { hasText: /^Changed Point 1's style rule$/ }) }).first();
            await expect(ruleRow.locator('.mapstudio-history-sentence')).toHaveText("Changed Point 1's style rule", { timeout: REPLY_MS });
            await expect(ruleRow).toHaveAttribute('data-revert', 'offered');
            await expect(ruleRow.locator('.mapstudio-history-revert')).toBeVisible();
            await openItems(page, map);
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', p1);

            // T7: a path under {asset.path} is not a full path: 12c1's words beside the field, and nothing is sent.
            seq = await seqOf(map);
            const path = editor(page).locator('.mapstudio-rule-path');
            await path.fill('{asset.path}/Status');
            await page.keyboard.press('Enter');
            const source = editor(page).locator('[data-field="styleRule.source"]');
            await expect(source.locator('.mapstudio-field-problem'))
                .toHaveText("an override's tag path is a full path such as [default]Mesa/P12/Pressure, not {asset.path}/Status.");
            await expect(path).toHaveAttribute('aria-invalid', 'true');
            // U6: Enter in a rule field commits and keeps the focus there.
            await expect(path).toBeFocused();
            // One note box: the reason first, then what the map keeps; on the warning tint with its 3 px warning edge.
            await expect(unsaved(page)).toHaveText('Not saved yet. The tag path is not a full path.' + KEEPS);
            expect(await unsaved(page).evaluate((el) => getComputedStyle(el).borderLeftWidth)).toBe('3px');
            expect(await unsaved(page).evaluate((el) => {
                const probe = document.createElement('span');
                probe.style.borderLeft = '3px solid var(--warning)';
                el.parentElement.appendChild(probe);
                const token = getComputedStyle(probe).borderLeftColor;
                probe.remove();
                return getComputedStyle(el).borderLeftColor === token;
            })).toBe(true);
            await path.fill('Mesa/Status');
            await page.keyboard.press('Enter');
            await expect(source.locator('.mapstudio-field-problem')).toHaveText('Mesa/Status is not a tag path; use a full path such as [default]Shared/GasPrice.');
            await expectNothingSent(page, map, seq);
            expect((await stored(page, p1)).overrides).toEqual({ kpis, styleRule: own });
            // Esc in the field stays in the field: the panel is not closed under the draft.
            await path.focus();
            await page.keyboard.press('Escape');
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', p1);
            await expect(path).toHaveValue('Mesa/Status');
            // The stored path typed back is what is stored: nothing to send, nothing missing.
            await path.fill(P12 + '/Status');
            await page.keyboard.press('Enter');
            await expect(source.locator('.mapstudio-field-problem')).toHaveCount(0);
            await noUnsaved(page);
            await expectNothingSent(page, map, seq);

            // T8: a case without a value and a preset: "Not saved yet" and why; the stored override stands.
            await editor(page).locator('.mapstudio-rule-add').click();
            await expect(editor(page).locator('.mapstudio-rule-case')).toHaveCount(5);
            await ruleCase(page, 4).locator('.mapstudio-rule-value').fill('5');
            await page.keyboard.press('Enter');
            const missing = 'Not saved yet. Case 5 has no preset.' + KEEPS;
            await expect(unsaved(page)).toHaveText(missing);
            await expect(ruleCase(page, 4).locator('.mapstudio-rule-value')).toBeFocused();
            // No second box, and no "whole": the Live now line says only what the item shows.
            await expect(shows(page)).toHaveText('Point 1 is Fault, by its own rule.');
            expect(await style(page).innerText()).not.toMatch(/\bwhole\b/);
            expect((await style(page).innerText()).match(/Not saved yet/g)).toHaveLength(1);
            await expectNothingSent(page, map, seq);
            expect((await stored(page, p1)).overrides).toEqual({ kpis, styleRule: own });
            await expect(liveItem(page, p1)).toHaveAttribute('data-preset', 'fault');
            await shot(page, 'mapstudio-itemstyle-unsaved-1366.png', unsaved(page));
            // U5: Esc on a rule button while the rule is not saved: the panel stays, and so does the draft.
            await chosenType(page).focus();
            await page.keyboard.press('Escape');
            await ruleCase(page, 4).locator('.mapstudio-rule-remove').focus();
            await page.keyboard.press('Escape');
            await rule(page).locator('.mapstudio-style-reset').focus();
            await page.keyboard.press('Escape');
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', p1);
            await expect(editor(page).locator('.mapstudio-rule-case')).toHaveCount(5);
            await expect(unsaved(page)).toHaveText(missing);
            // The half-built rule is kept while the item stays selected: across the tabs.
            await tab(page, 'details').click();
            await expect(style(page)).toBeHidden();
            await tab(page, 'style').click();
            await expect(editor(page).locator('.mapstudio-rule-case')).toHaveCount(5);
            await expect(ruleCase(page, 4).locator('.mapstudio-rule-value')).toHaveValue('5');
            await expect(unsaved(page)).toHaveText(missing);
            // U4: and per item for the session: another item selected, Kinds opened, and back; nothing is sent meanwhile.
            await selectRow(page, p3);
            await expect(rule(page)).toHaveAttribute('data-own', 'false');
            await expect(editor(page)).toHaveCount(0);
            await selectRow(page, p1);
            await expect(editor(page).locator('.mapstudio-rule-case')).toHaveCount(5);
            await expect(ruleCase(page, 4).locator('.mapstudio-rule-value')).toHaveValue('5');
            await expect(ruleCase(page, 4).locator('.mapstudio-rule-preset')).toHaveValue('');
            await expect(unsaved(page)).toHaveText(missing);
            await kindLink(page).click();
            await expect(map).toHaveAttribute('data-surface', 'kinds');
            await back(page).click();
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', p1);
            await expect(editor(page).locator('.mapstudio-rule-case')).toHaveCount(5);
            await expect(unsaved(page)).toHaveText(missing);
            await openKinds(page, map);
            await openItems(page, map);
            await expect(editor(page).locator('.mapstudio-rule-case')).toHaveCount(5);
            await expect(ruleCase(page, 4).locator('.mapstudio-rule-value')).toHaveValue('5');
            await expect(unsaved(page)).toHaveText(missing);
            await expectNothingSent(page, map, seq);
            expect((await stored(page, p1)).overrides).toEqual({ kpis, styleRule: own });
            // U6: a removed row gives the focus to the row before it.
            await editor(page).locator('.mapstudio-rule-add').click();
            await expect(editor(page).locator('.mapstudio-rule-case')).toHaveCount(6);
            await ruleCase(page, 5).locator('.mapstudio-rule-remove').focus();
            await page.keyboard.press('Enter');
            await expect(editor(page).locator('.mapstudio-rule-case')).toHaveCount(5);
            await expect(ruleCase(page, 4).locator('.mapstudio-rule-remove')).toBeFocused();
            // Each type keeps its own cases: Bands has none yet, and States comes back as it was typed.
            await editor(page).locator('.mapstudio-rule-type[data-type="bands"]').click();
            await expect(unsaved(page)).toHaveText('Not saved yet. Add a band.' + KEEPS);
            // U6: Enter in a band's field keeps the focus in it; the last band removed gives the focus to Add.
            await editor(page).locator('.mapstudio-rule-add').click();
            const from = ruleCase(page, 0).locator('.mapstudio-rule-from');
            await from.fill('1');
            await page.keyboard.press('Enter');
            await expect(from).toBeFocused();
            await expect(from).toHaveValue('1');
            await ruleCase(page, 0).locator('.mapstudio-rule-remove').focus();
            await page.keyboard.press('Enter');
            await expect(editor(page).locator('.mapstudio-rule-case')).toHaveCount(0);
            await expect(editor(page).locator('.mapstudio-rule-add')).toBeFocused();
            await editor(page).locator('.mapstudio-rule-type[data-type="states"]').click();
            await expect(editor(page).locator('.mapstudio-rule-case')).toHaveCount(5);
            await expectNothingSent(page, map, seq);
            // Its preset picked, the rule is whole and is saved at once.
            await ruleCase(page, 4).locator('.mapstudio-rule-preset').selectOption('warning');
            await expectOneBatch(page, map, seq, "change Point 1's style rule");
            await noUnsaved(page);
            expect((await stored(page, p1)).overrides).toEqual({ kpis, styleRule: { ...own, cases: [...own.cases, { value: 5, preset: 'warning' }] } });

            // T5: Reset removes the rule: "From kind" again, and Point 1 draws by the kind's rule; T11: the path override stands.
            seq = await seqOf(map);
            await rule(page).locator('.mapstudio-style-reset').click();
            await expectOneBatch(page, map, seq, "reset Point 1's style rule");
            expect((await stored(page, p1)).overrides).toEqual({ kpis });
            await expect(rule(page)).toHaveAttribute('data-own', 'false');
            await expect(rule(page).locator('.mapstudio-style-rule-head > .mapstudio-fromkind-tag')).toHaveText('From kind');
            await expect(rule(page).locator('.mapstudio-override-tag')).toHaveCount(0);
            await expect(rule(page).locator('.mapstudio-style-reset')).toHaveCount(0);
            await expect(editor(page)).toHaveCount(0);
            await expect(rule(page).locator('.mapstudio-style-override')).toBeFocused();
            await expect(liveItem(page, p1)).toHaveAttribute('data-preset', 'attention', { timeout: LIVE_MS });
            await expect(liveItem(dev, p1)).toHaveAttribute('data-preset', 'attention', { timeout: LIVE_MS });
            await expect(shows(page)).toHaveText('Point 1 is Attention, by the well pad rule.', { timeout: LIVE_MS });
            await page.locator('.mapstudio-rail-item[data-surface="history"]').click();
            await expect(page.locator('.mapstudio-history .mapstudio-history-sentence', { hasText: /^Reset Point 1's style rule$/ }).first())
                .toBeVisible({ timeout: REPLY_MS });
            await expect(page.locator('.mapstudio-unsaved-row')).toHaveCount(0);
            await quiet(dev);
        });

    editorTest('T6, T9: Point 2\'s own expression and L-SWD\'s instruments source in the editor, marked Override; an unlinked pad starts empty',
        async ({ page }) => {
            editorTest.setTimeout(300_000);
            const p2 = seed.ids['tracer/p2'];
            const line = seed.ids['swd/line'];
            const map = await openEditor(page);

            // T6: Point 2's seeded expression is its own rule: in the editor, marked Override, with Reset.
            await selectRow(page, p2);
            await tab(page, 'style').click();
            await expect(rule(page)).toHaveAttribute('data-own', 'true');
            await expect(rule(page).locator('.mapstudio-override-tag')).toHaveText('Override');
            await expect(rule(page).locator('.mapstudio-style-reset')).toBeVisible();
            await expect(actionLine(page)).toHaveText('For Point 2 only. Changes save as you make them.');
            await expect(editor(page).locator('.mapstudio-rule-type[data-type="expression"]')).toHaveAttribute('aria-pressed', 'true');
            await expect(editor(page).locator('.mapstudio-rule-type[data-type="none"]')).toHaveCount(0);
            await expect(editor(page).locator('.mapstudio-rule-expression')).toHaveValue("if({value} > 600, 'warning', 'normal')");
            await expect(editor(page).locator('.mapstudio-rule-path')).toHaveValue(P14 + '/Pressure');
            expect(await editor(page).locator('.mapstudio-rule-named .mapstudio-rule-tile').evaluateAll((els) => els.map((e) => e.dataset.preset)))
                .toEqual(['warning', 'normal']);
            await noUnsaved(page);
            await expect(shows(page)).toContainText('by its own rule');

            // T9: L-SWD's own rule is From its instruments, offered for a line that is not an area.
            await selectRow(page, line);
            await expect(style(page)).toBeVisible();
            await expect(rule(page)).toHaveAttribute('data-own', 'true');
            await expect(rule(page).locator('.mapstudio-override-tag')).toHaveText('Override');
            expect(await editor(page).locator('.mapstudio-rule-type').evaluateAll((els) => els.map((e) => e.dataset.type)))
                .toEqual(['states', 'bands', 'expression', 'instruments']);
            await expect(editor(page).locator('.mapstudio-rule-type[data-type="instruments"]')).toHaveAttribute('aria-pressed', 'true');
            await expect(editor(page).locator('.mapstudio-rule-instruments')).toHaveText('Each segment takes the worst of the instruments at its ends.');
            await expect(style(page).locator('.mapstudio-style-fromkind [data-row="size"] .mapstudio-style-value')).toHaveText('Width by diameter');
            await expect(shows(page)).toContainText('by its own rule.');

            // An unlinked pad has no path to fill, so Override starts empty: nothing is sent until the rule is built.
            const pad = randomUUID();
            await apply(page, [{ op: 'create', entity: 'item', id: pad, baseVersion: 0, data: { kind: 'pad', name: 'Style pad',
                geometry: { type: 'Point', coordinates: AWAY }, properties: {} } }]);
            await expect(page.locator('.mapstudio-list-row[data-item-id="' + pad + '"]')).toHaveCount(1, { timeout: REPLY_MS });
            await selectRow(page, pad);
            await expect(rule(page)).toHaveAttribute('data-own', 'false');
            let seq = await seqOf(map);
            // U10: the kind's rule reads a path under {asset.path}, which an unlinked pad cannot fill; the line says so.
            await expect(actionLine(page)).toHaveText("Override gives Style pad its own rule, saved once it is complete. Edit the kind's rule changes every well pad.");
            await expect(rule(page).locator('.mapstudio-style-kindrule .mapstudio-style-summary')).toHaveText('States on the tag {asset.path}/Status');
            await rule(page).locator('.mapstudio-style-override').click();
            await expect(rule(page)).toHaveAttribute('data-editing', 'true');
            await expect(rule(page).locator('.mapstudio-override-tag')).toHaveCount(0);
            // Until it is stored the pad still draws from its kind, and the tag says so.
            await expect(rule(page).locator('.mapstudio-style-rule-head > .mapstudio-style-tag')).toHaveText('From kind');
            await expect(unsaved(page)).toHaveText('Not saved yet. Pick the value the rule reads. Add a case.' + KEEPS);
            // The focus is on the rule's chosen type, not on a button that would give the rule up.
            await expect(chosenType(page)).toBeFocused();
            await expect(chosenType(page)).toHaveAttribute('data-type', 'states');
            await expect(rule(page).locator('.mapstudio-style-keep')).toBeVisible();
            // U5: Esc here leaves the panel and the editor.
            await page.keyboard.press('Escape');
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', pad);
            await expect(rule(page)).toHaveAttribute('data-editing', 'true');
            // U4: a rule never stored is kept too: another item and back, still being built and not saved.
            await selectRow(page, p2);
            await selectRow(page, pad);
            await expect(rule(page)).toHaveAttribute('data-editing', 'true');
            await expect(unsaved(page)).toHaveText('Not saved yet. Pick the value the rule reads. Add a case.' + KEEPS);
            // U6: with no row before it, a removed row gives the focus to Add.
            await editor(page).locator('.mapstudio-rule-add').click();
            await ruleCase(page, 0).locator('.mapstudio-rule-remove').focus();
            await page.keyboard.press('Enter');
            await expect(editor(page).locator('.mapstudio-rule-case')).toHaveCount(0);
            await expect(editor(page).locator('.mapstudio-rule-add')).toBeFocused();
            await expectNothingSent(page, map, seq);
            // Keep the kind's rule gives it up; nothing was sent.
            await rule(page).locator('.mapstudio-style-keep').click();
            await expect(rule(page)).toHaveAttribute('data-editing', 'false');
            await expect(rule(page).locator('.mapstudio-style-rule-head > .mapstudio-fromkind-tag')).toHaveText('From kind');
            await expect(rule(page).locator('.mapstudio-style-override')).toBeFocused();
            await expectNothingSent(page, map, seq);
            // Given up, it is not kept: another item and back shows the kind's rule.
            await selectRow(page, p2);
            await selectRow(page, pad);
            await expect(rule(page)).toHaveAttribute('data-editing', 'false');
            await expect(editor(page)).toHaveCount(0);
            // Built on a key value of the kind, it is saved as soon as it is whole, and marked Override.
            await rule(page).locator('.mapstudio-style-override').click();
            await editor(page).locator('.mapstudio-rule-source-select').selectOption('kpi:pressure');
            await editor(page).locator('.mapstudio-rule-add').click();
            await ruleCase(page, 0).locator('.mapstudio-rule-value').fill('1');
            await expectNothingSent(page, map, seq);
            await ruleCase(page, 0).locator('.mapstudio-rule-preset').selectOption('fault');
            await expectOneBatch(page, map, seq, "change Style pad's style rule");
            expect((await stored(page, pad)).overrides).toEqual({ styleRule: { source: { kpi: 'pressure' }, type: 'states', cases: [{ value: 1, preset: 'fault' }] } });
            await expect(rule(page)).toHaveAttribute('data-own', 'true');
            await expect(rule(page).locator('.mapstudio-override-tag')).toHaveText('Override');
            await expect(rule(page).locator('.mapstudio-style-keep')).toHaveCount(0);
            await expect(editor(page).locator('.mapstudio-rule-case')).toHaveCount(1);
            await noUnsaved(page);
            // Undo takes the rule back, and the editor goes with it.
            await undo(page).click();
            await expect.poll(async () => (await stored(page, pad)).overrides, { timeout: REPLY_MS }).toEqual({});
            await expect(rule(page)).toHaveAttribute('data-own', 'false', { timeout: REPLY_MS });
            await expect(editor(page)).toHaveCount(0);
            await expect(page.locator('.mapstudio-unsaved-row')).toHaveCount(0);

            // U10: an unlinked line. Its kind's rule needs nothing of an asset's folder, so Override saves the copy at once:
            // the seed's Bands on a key value first, then From its instruments.
            const lineSetup = (await send(page, 'map.load', {})).body.kindSetups.find((k) => k.kindId === 'line' && !k.deleted);
            const stray = randomUUID();
            await apply(page, [{ op: 'create', entity: 'item', id: stray, baseVersion: 0, data: { kind: 'line', name: 'Style line',
                geometry: { type: 'LineString', coordinates: [AWAY, [AWAY[0] + 0.01, AWAY[1]]] }, properties: {} } }]);
            await expect(page.locator('.mapstudio-list-row[data-item-id="' + stray + '"]')).toHaveCount(1, { timeout: REPLY_MS });
            await selectRow(page, stray);
            await expect(rule(page)).toHaveAttribute('data-own', 'false');
            await expect(actionLine(page)).toHaveText("Override gives Style line its own copy, saved at once. Edit the kind's rule changes every gathering line.");
            seq = await seqOf(map);
            await rule(page).locator('.mapstudio-style-override').click();
            await expectOneBatch(page, map, seq, "change Style line's style rule");
            expect((await stored(page, stray)).overrides).toEqual({ styleRule: lineSetup.setup.styleRule });
            await expect(rule(page)).toHaveAttribute('data-own', 'true');
            await noUnsaved(page);
            seq = await seqOf(map);
            await rule(page).locator('.mapstudio-style-reset').click();
            await expectOneBatch(page, map, seq, "reset Style line's style rule");
            await expect(rule(page)).toHaveAttribute('data-own', 'false');
            // The kind's rule made From its instruments (through the test hook; the seed's rule is put back below).
            const instruments = { source: { instruments: 'worst' } };
            await apply(page, [{ op: 'update', entity: 'kindSetup', id: 'line', baseVersion: lineSetup.version,
                data: { setup: { ...lineSetup.setup, styleRule: instruments } } }]);
            try {
                await expect(rule(page).locator('.mapstudio-style-kindrule')).toHaveAttribute('data-rule', 'instruments', { timeout: REPLY_MS });
                await expect(actionLine(page)).toHaveText("Override gives Style line its own copy, saved at once. Edit the kind's rule changes every gathering line.");
                seq = await seqOf(map);
                await rule(page).locator('.mapstudio-style-override').click();
                await expectOneBatch(page, map, seq, "change Style line's style rule");
                expect((await stored(page, stray)).overrides).toEqual({ styleRule: instruments });
                await expect(rule(page)).toHaveAttribute('data-own', 'true');
                await expect(rule(page)).toHaveAttribute('data-editing', 'false');
                await expect(chosenType(page)).toHaveAttribute('data-type', 'instruments');
                await noUnsaved(page);
            } finally {
                const now = (await send(page, 'map.load', {})).body.kindSetups.find((k) => k.kindId === 'line' && !k.deleted);
                await apply(page, [{ op: 'update', entity: 'kindSetup', id: 'line', baseVersion: now.version, data: { setup: lineSetup.setup } }]);
            }
            await expect(page.locator('.mapstudio-unsaved-row')).toHaveCount(0);
        });

    editorTest('two editors: a rule another editor stores while this one is half built is not overwritten; finishing it is a conflict',
        async ({ page, browser }) => {
            editorTest.setTimeout(300_000);
            const p3 = seed.ids['tracer/p3'];
            const map = await openEditor(page);
            const mine = { source: { kpi: 'pressure' }, type: 'states', cases: [{ value: 1, preset: 'fault' }] };
            const before = await stored(page, p3);
            await apply(page, [{ op: 'update', entity: 'item', id: p3, baseVersion: before.version, data: { overrides: { styleRule: mine } } }]);
            await selectRow(page, p3);
            await tab(page, 'style').click();
            await expect(rule(page)).toHaveAttribute('data-own', 'true', { timeout: REPLY_MS });
            // A starts a second case and leaves it without a preset: not saved yet.
            await editor(page).locator('.mapstudio-rule-add').click();
            await ruleCase(page, 1).locator('.mapstudio-rule-value').fill('2');
            await page.keyboard.press('Enter');
            await expect(unsaved(page)).toHaveText('Not saved yet. Case 2 has no preset.' + KEEPS);
            const other = await signedInContext(browser, EDITOR2_USER, { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
            try {
                const theirs = await other.newPage();
                await mapLoaded(await openMap(theirs, '/edit'));
                // B stores another rule for the item.
                const rule9 = { ...mine, cases: [{ value: 9, preset: 'warning' }] };
                const seq = await seqOf(map);
                const now = await stored(page, p3);
                const reply = await send(theirs, 'edits.apply', { batchId: randomUUID(), ops: [{ op: 'update', entity: 'item', id: p3,
                    baseVersion: now.version, data: { overrides: { styleRule: rule9 } } }] });
                expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
                await expect(map).toHaveAttribute('data-store-seq', String(seq + 1), { timeout: REPLY_MS });
                // A's half-built rows stay as typed.
                await expect(editor(page).locator('.mapstudio-rule-case')).toHaveCount(2);
                await expect(ruleCase(page, 1).locator('.mapstudio-rule-value')).toHaveValue('2');
                // Finished, A's rule goes at the version it was built on: a conflict, B's rule still stored.
                await ruleCase(page, 1).locator('.mapstudio-rule-preset').selectOption('warning');
                const card = page.locator('.mapstudio-save-card[data-card="conflict"]');
                await expect(card).toBeVisible({ timeout: REPLY_MS });
                await expect(card.locator('.mapstudio-save-card-title')).toHaveText('Not saved - conflict with ' + EDITOR2_USER + "'s change");
                expect((await stored(page, p3)).overrides).toEqual({ styleRule: rule9 });
                await card.locator('.mapstudio-save-card-theirs').click();
                await expect(card).toHaveCount(0);
                // B's rule shows in the editor.
                await expect(editor(page).locator('.mapstudio-rule-case')).toHaveCount(1, { timeout: REPLY_MS });
                await expect(ruleCase(page, 0).locator('.mapstudio-rule-value')).toHaveValue('9');
                expect((await stored(page, p3)).overrides).toEqual({ styleRule: rule9 });
            } finally {
                await other.close();
            }
        });
});
