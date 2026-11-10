// The preview item on the map and the Live now note (epic-editing entry 12b2; DESIGN.md Kind setup and key screen 6, kinds-style;
// EXPERIENCE.md Kind setup): the plan's matrix P1 to P11 at 1366 px on the dev stack, as the map editor in Edit mode with Kinds
// open, and a second tab on /live whose dev buttons drive P12's tags (Point 1 is the item linked to the asset P12). P1: the Well
// pad's preview item, CTB1, carries the word and the note says what it is now. P2: another item chosen, the word and the note
// move. P3: P12's Status driven to a case, the note names the state at the next live update, as the other open map draws it. P4:
// its alarm wins over the rule. P5: comms off, the chip reads "Comms lost". P6: Point 2 has its own rule. P7: an area kind has
// no word. P8: a line's label. P9: the word gone when the kind changes, Kinds closes and Editing goes off. P10: Show on map is the
// one thing that moves the map. P11: a half-built rule. Nothing is saved by this spec; the dev tags are put back to their quiet
// state and the seed is run again before and after, as styles.spec.mjs and live.spec.mjs expect.

import { TRACER } from '../lib/geo.mjs';
import { EDITOR_USER, editorTest, ensureSeeded, expect, mapLoaded, openMap, removeStrays, runSeed, send, shot, signedInContext, test } from './fixtures.mjs';

/** One refresh interval of the dev setup (10 s) with its round trips, as live.spec.mjs bounds it. */
const INTERVAL_MS = 25_000;
/** A move of the map (300 ms) drawn and published. */
const MOVE_MS = 20_000;
/** There is nothing to observe when the map does not move: the time a move would have taken to show. */
const STILL_MS = 800;

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

/** Every source this spec drives in its quiet state: Status 0, the pressure low (no alarm), comms on, nothing unacknowledged. */
async function quiet(page) {
    await press(page, 'status-0');
    await press(page, 'pressure-low');
    await press(page, 'comms-on');
    await press(page, 'ack');
    await press(page, 'line-flow-low');
}

/** The seed's own items and kind setups again, no stray item, and the dev tags quiet. */
async function restore(browser) {
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
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
    await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
    return map;
}

/** The second tab, on /live: its dev buttons, and another open map to agree with. */
async function openDev(context) {
    const dev = await context.newPage();
    await mapLoaded(await openMap(dev, '/live'));
    return dev;
}

const panel = (page) => page.locator('.mapstudio-kindsetup');
const rule = (page) => page.locator('.mapstudio-kindsetup [data-section="styleRule"]');
const note = (page) => rule(page).locator('.mapstudio-rule-live');
const previewField = (page) => panel(page).locator('[data-field="preview"]');
const previewSelect = (page) => previewField(page).locator('select');
const showButton = (page) => previewField(page).locator('.mapstudio-kindsetup-show');
const liveItem = (page, id) => page.locator('.mapstudio-live-item[data-item-id="' + id + '"]');

async function openKinds(page, map) {
    await page.locator('.mapstudio-rail-item[data-surface="kinds"]').click();
    await expect(map).toHaveAttribute('data-surface', 'kinds');
}

async function chooseKind(page, kindId) {
    await page.locator('.mapstudio-kind-row[data-kind="' + kindId + '"]').click();
    await expect(panel(page)).toHaveAttribute('data-kind', kindId);
}

/** The map's place as it publishes it. */
async function place(map) {
    return { center: await map.getAttribute('data-center'), zoom: await map.getAttribute('data-zoom') };
}

/** The map has not moved: its place stands after the time a move would have taken. */
async function still(page, map, at) {
    await page.waitForTimeout(STILL_MS);
    expect(await place(map)).toEqual(at);
}

async function noteShot(page, name) {
    await note(page).scrollIntoViewIfNeeded();
    await shot(page, name);
}

editorTest.describe('the preview item on the map and the Live now note at 1366 px', () => {
    editorTest.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
    editorTest.describe.configure({ mode: 'serial' });

    editorTest('P1 to P5, P9, P10: the word on the preview item, Show on map, and the note following the Gateway with no reload',
        async ({ page, context }) => {
            editorTest.setTimeout(420_000);
            const ctb1 = seed.ids['swd/ctb1'];
            const p1 = seed.ids['tracer/p1'];
            const dev = await openDev(context);
            await quiet(dev);
            const map = await openEditor(page);
            const reloads = await map.getAttribute('data-map-reloads');
            const before = await setupOf(page, 'pad');
            await expect(liveItem(page, p1)).toHaveAttribute('data-preset', 'normal', { timeout: INTERVAL_MS });
            await expect(liveItem(page, p1)).toHaveAttribute('data-state', 'normal', { timeout: INTERVAL_MS });
            // Outside Kinds no item carries the word.
            await expect(map).toHaveAttribute('data-preview-item', '');
            await expect(page.locator('.mapstudio-live-item[data-preview="true"]')).toHaveCount(0);

            // P1: Kinds, the Well pad: its preview item is its first linked item by name, CTB1, which carries the word.
            await openKinds(page, map);
            await chooseKind(page, 'pad');
            await expect(panel(page)).toHaveAttribute('data-preview', ctb1);
            await expect(map).toHaveAttribute('data-preview-item', ctb1);
            await expect(liveItem(page, ctb1)).toHaveAttribute('data-preview', 'true');
            await expect(page.locator('.mapstudio-live-item[data-preview="true"]')).toHaveCount(1);
            const ctbStale = (await liveItem(page, ctb1).getAttribute('data-stale')) === 'true';
            const ctbLost = (await liveItem(page, ctb1).getAttribute('data-comms')) === 'lost';
            const ctbWord = ctbLost ? 'Comms lost' : ctbStale ? 'Stale' : 'Preview';
            await expect(liveItem(page, ctb1)).toHaveAttribute('data-word', ctbWord);
            await expect(map).toHaveAttribute('data-preview-word', ctbWord);
            await expect(note(page)).toHaveText(ctbLost || ctbStale
                ? 'Live now: CTB1 shows only as ' + ctbWord + ' until a fresh value comes.' : /^Live now: CTB1 is [A-Z][a-z ]+\.$/);
            await expect(note(page)).toHaveAttribute('role', 'status');
            await expect(note(page)).toHaveAttribute('aria-live', 'polite');
            // The line under the select says both things the preview item does.
            await expect(previewField(page).locator('.mapstudio-kindsetup-preview-note')).toHaveText(
                "[default]Mesa/CTB1 - each tag path is checked for this item's asset, and it carries the word Preview on the map.");
            // The note is the last thing in section 6.
            expect(await rule(page).evaluate((el) => el.lastElementChild.className)).toBe('mapstudio-rule-live');

            // P2: another item chosen: the word moves to it and the note follows. The map has not moved (owner decision 2).
            const at = await place(map);
            await previewSelect(page).selectOption(p1);
            await expect(panel(page)).toHaveAttribute('data-preview', p1);
            await expect(map).toHaveAttribute('data-preview-item', p1);
            await expect(liveItem(page, p1)).toHaveAttribute('data-preview', 'true');
            await expect(liveItem(page, p1)).toHaveAttribute('data-word', 'Preview');
            await expect(map).toHaveAttribute('data-preview-word', 'Preview');
            await expect(liveItem(page, ctb1)).toHaveAttribute('data-preview', 'false');
            await expect(liveItem(page, ctb1)).toHaveAttribute('data-word', ctbLost ? 'Comms lost' : ctbStale ? 'Stale' : '');
            await expect(note(page)).toHaveText('Live now: Point 1 is Normal.');
            await still(page, map, at);

            // P10: Show on map goes to the item, as Zoom to location does: zoom 15, the point in view. Reached and pressed by keyboard.
            await expect(showButton(page)).toBeEnabled();
            await expect(showButton(page)).toHaveText('Show on map');
            const box = await showButton(page).boundingBox();
            expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(24);
            await previewSelect(page).focus();
            await page.keyboard.press('Tab');
            await expect(showButton(page)).toBeFocused();
            await page.keyboard.press('Enter');
            await expect(map).toHaveAttribute('data-zoom', '15.00', { timeout: MOVE_MS });
            await expect.poll(async () => {
                const [lng, lat] = (await map.getAttribute('data-center')).split(',').map(Number);
                return Math.max(Math.abs(lng - TRACER.points.p1.lngLat[0]), Math.abs(lat - TRACER.points.p1.lngLat[1]));
            }, { timeout: MOVE_MS }).toBeLessThan(0.01);
            // The selection is as it was: nothing is selected by the move.
            await expect(liveItem(page, p1)).toHaveAttribute('data-ringed', 'false');
            const shown = await place(map);
            await shot(page, 'mapstudio-kindpreview-map-1366.png');

            // P3: P12's Status driven to a case: the note names the new state at the next live update, with no reload, the map
            // still, and the other open map draws the same state.
            const changed = Date.now();
            await press(dev, 'status-2');
            await expect(note(page)).toHaveText('Live now: Point 1 is Warning.', { timeout: INTERVAL_MS });
            expect(Date.now() - changed).toBeLessThan(INTERVAL_MS);
            await expect(liveItem(page, p1)).toHaveAttribute('data-preset', 'warning');
            // The chip reads Preview in place of the state word; the preset is drawn as ever.
            await expect(liveItem(page, p1)).toHaveAttribute('data-word', 'Preview');
            expect(await liveItem(page, p1).getAttribute('data-marker')).toContain('"warning"]');
            await expect(liveItem(dev, p1)).toHaveAttribute('data-preset', 'warning', { timeout: INTERVAL_MS });
            await expect(liveItem(dev, p1)).toHaveAttribute('data-word', 'Warning');
            await expect(liveItem(dev, p1)).toHaveAttribute('data-preview', 'false');
            await expect(map).toHaveAttribute('data-map-reloads', reloads);
            expect(await place(map)).toEqual(shown);
            await press(dev, 'status-3');
            await expect(note(page)).toHaveText('Live now: Point 1 is Fault.', { timeout: INTERVAL_MS });
            await noteShot(page, 'mapstudio-kindpreview-note-1366.png');

            // P4: P12's alarm raised: the note adds that it wins over the rule.
            await press(dev, 'pressure-high');
            await expect(note(page)).toHaveText('Live now: Point 1 is Fault, but its priority 1 alarm wins over the rule.', { timeout: INTERVAL_MS });
            await expect(liveItem(page, p1)).toHaveAttribute('data-state', 'alarm');
            await expect(liveItem(page, p1)).toHaveAttribute('data-word', 'Preview');
            await expect(liveItem(dev, p1)).toHaveAttribute('data-state', 'alarm', { timeout: INTERVAL_MS });
            await shot(page, 'mapstudio-kindpreview-map-alarm-1366.png');

            // P5: P12's comms off: the chip reads "Comms lost" and the note says it shows only as that.
            await press(dev, 'pressure-low');
            await press(dev, 'ack');
            await press(dev, 'comms-off');
            await expect(liveItem(page, p1)).toHaveAttribute('data-comms', 'lost', { timeout: INTERVAL_MS });
            await expect(liveItem(page, p1)).toHaveAttribute('data-word', 'Comms lost');
            await expect(map).toHaveAttribute('data-preview-word', 'Comms lost');
            await expect(liveItem(page, p1)).toHaveAttribute('data-preview', 'true');
            await expect(note(page)).toHaveText('Live now: Point 1 shows only as Comms lost until a fresh value comes.');
            await expect(liveItem(dev, p1)).toHaveAttribute('data-word', 'Comms lost', { timeout: INTERVAL_MS });
            await shot(page, 'mapstudio-kindpreview-map-commslost-1366.png');
            await press(dev, 'comms-on');
            await press(dev, 'status-2');
            await expect(note(page)).toHaveText('Live now: Point 1 is Warning.', { timeout: INTERVAL_MS });
            await expect(liveItem(page, p1)).toHaveAttribute('data-word', 'Preview');
            // Nothing but the button moved the map, through every live update.
            expect(await place(map)).toEqual(shown);

            // P9: the word goes when the kind changes, when Kinds closes and when Editing goes off; each time the item reads
            // its own state word again.
            await chooseKind(page, 'geofence');
            await expect(map).toHaveAttribute('data-preview-item', '');
            await expect(liveItem(page, p1)).toHaveAttribute('data-preview', 'false');
            await expect(liveItem(page, p1)).toHaveAttribute('data-word', 'Warning');
            await chooseKind(page, 'pad');
            // The choice is remembered for the kind: Point 1 again.
            await expect(map).toHaveAttribute('data-preview-item', p1);
            await expect(liveItem(page, p1)).toHaveAttribute('data-word', 'Preview');
            await page.locator('.mapstudio-rail-item[data-surface="items"]').click();
            await expect(map).toHaveAttribute('data-surface', 'items');
            await expect(map).toHaveAttribute('data-preview-item', '');
            await expect(map).toHaveAttribute('data-preview-word', '');
            await expect(liveItem(page, p1)).toHaveAttribute('data-word', 'Warning');
            await openKinds(page, map);
            await expect(map).toHaveAttribute('data-preview-item', p1);
            await page.locator('.mapstudio-edit-switch-button').click();
            await expect(map).toHaveAttribute('data-studio', 'off');
            await expect(map).toHaveAttribute('data-preview-item', '');
            await expect(liveItem(page, p1)).toHaveAttribute('data-preview', 'false');
            await expect(liveItem(page, p1)).toHaveAttribute('data-word', 'Warning');
            await expect(page.locator('.mapstudio-live-item[data-preview="true"]')).toHaveCount(0);

            // Nothing was saved: the pad's setup is as it was.
            expect(await setupOf(page, 'pad')).toEqual(before);
            await quiet(dev);
        });

    editorTest('P6, P7, P8, P11: an item with its own rule, an area kind, a line kind, a half-built rule, and a kind with no item',
        async ({ page, context }) => {
            editorTest.setTimeout(300_000);
            const p1 = seed.ids['tracer/p1'];
            const p2 = seed.ids['tracer/p2'];
            const tracer = seed.ids['tracer/l1'];
            const swd = seed.ids['swd/line'];
            const dev = await openDev(context);
            await quiet(dev);
            const map = await openEditor(page);
            const before = await setupOf(page, 'pad');
            await openKinds(page, map);
            await chooseKind(page, 'pad');

            // P6: Point 2 has its own style rule: the note says the kind's rule does not draw on it and to choose another. It is
            // still the preview item, so it carries the word.
            await previewSelect(page).selectOption(p2);
            await expect(map).toHaveAttribute('data-preview-item', p2);
            await expect(liveItem(page, p2)).toHaveAttribute('data-preview', 'true');
            await expect(note(page)).toHaveText("Point 2 has its own style rule, so this kind's rule does not draw on it. Choose another preview item.");
            await noteShot(page, 'mapstudio-kindpreview-note-ownrule-1366.png');

            // P11: a half-built rule: "Not saved yet", and the note says the map shows the stored rule. Nothing is sent.
            await previewSelect(page).selectOption(p1);
            await expect(note(page)).toHaveText('Live now: Point 1 is Normal.', { timeout: INTERVAL_MS });
            const seq = await map.getAttribute('data-store-seq');
            await rule(page).locator('.mapstudio-rule-type[data-type="bands"]').click();
            await expect(rule(page)).toHaveAttribute('data-unsaved', 'true');
            await expect(note(page)).toHaveText('Live now: Point 1 is Normal. The map shows the stored rule until this one is whole.');
            await noteShot(page, 'mapstudio-kindpreview-note-unsaved-1366.png');
            // The stored type again: the rule is the stored one, and the note says only what the item is.
            await rule(page).locator('.mapstudio-rule-type[data-type="states"]').click();
            await expect(rule(page)).toHaveAttribute('data-unsaved', 'false');
            await expect(note(page)).toHaveText('Live now: Point 1 is Normal.');
            await page.waitForTimeout(STILL_MS);
            await expect(map).toHaveAttribute('data-store-seq', seq);
            expect(await setupOf(page, 'pad')).toEqual(before);

            // P7: an area kind: no word on the map, and the note says an area draws its tint, not a preset.
            await chooseKind(page, 'geofence');
            await expect(panel(page)).toHaveAttribute('data-preview', seed.ids['areas/p14-lease']);
            await expect(map).toHaveAttribute('data-preview-item', '');
            await expect(map).toHaveAttribute('data-preview-word', '');
            await expect(page.locator('.mapstudio-live-item[data-preview="true"]')).toHaveCount(0);
            await expect(note(page)).toHaveText('An area draws its category tint, not a preset, so the style rule has no preview on the map.');
            await expect(previewField(page).locator('.mapstudio-kindsetup-preview-note')).toHaveText(
                "[default]Mesa/P14/Lease - each tag path is checked for this item's asset.");
            // Show on map still goes to the area: fitted, as a list row's line or area is.
            const fence = await place(map);
            await showButton(page).click();
            await expect.poll(() => place(map), { timeout: MOVE_MS }).not.toEqual(fence);
            await noteShot(page, 'mapstudio-kindpreview-note-area-1366.png');

            // P8: a line kind: the line's label reads its name and "Preview". L-SWD, the first by name, has its own rule.
            await chooseKind(page, 'line');
            await expect(panel(page)).toHaveAttribute('data-preview', swd);
            await expect(map).toHaveAttribute('data-preview-item', swd);
            await expect(note(page)).toHaveText("L-SWD has its own style rule, so this kind's rule does not draw on it. Choose another preview item.");
            await previewSelect(page).selectOption(tracer);
            await expect(map).toHaveAttribute('data-preview-item', tracer);
            await expect(liveItem(page, tracer)).toHaveAttribute('data-preview', 'true');
            await expect(liveItem(page, tracer)).toHaveAttribute('data-stale', 'false', { timeout: INTERVAL_MS });
            await expect(map).toHaveAttribute('data-preview-word', 'Tracer line Preview');
            await expect(liveItem(page, tracer)).toHaveAttribute('data-word', 'Preview');
            await expect(note(page)).toHaveText('Live now: Tracer line is Normal.');
            // The line's flow driven into the attention band: the note follows, the label keeps the word.
            await press(dev, 'line-flow-mid');
            await expect(note(page)).toHaveText('Live now: Tracer line is Attention.', { timeout: INTERVAL_MS });
            await expect(map).toHaveAttribute('data-preview-word', 'Tracer line Preview');
            await showButton(page).click();
            await expect.poll(async () => Number(await map.getAttribute('data-zoom')), { timeout: MOVE_MS }).toBeGreaterThanOrEqual(14);
            await page.waitForTimeout(STILL_MS);
            await shot(page, 'mapstudio-kindpreview-line-1366.png');
            await press(dev, 'line-flow-low');

            // A kind with no linked item: Show on map is off with its reason, and the note says the kind has no item.
            await chooseKind(page, 'meter');
            await expect(panel(page)).toHaveAttribute('data-preview', '');
            await expect(map).toHaveAttribute('data-preview-item', '');
            await expect(showButton(page)).toBeDisabled();
            const reason = 'No meter is linked to an asset yet, so there is no preview item to show.';
            await expect(showButton(page)).toHaveAttribute('title', reason);
            await expect(previewField(page).locator('.mapstudio-kindsetup-show-holder')).toHaveAttribute('title', reason);
            // The reason reaches assistive technology as the button's description.
            await expect(showButton(page)).toHaveAccessibleDescription(reason);
            await expect(note(page)).toHaveText('No meter is linked to an asset yet, so this kind has no item to show the rule on.');

            // No em dash in the words, and the row stays inside the panel at 1366 px.
            await chooseKind(page, 'pad');
            expect(await previewField(page).innerText()).not.toContain(String.fromCharCode(0x2014));
            expect(await note(page).innerText()).not.toContain(String.fromCharCode(0x2014));
            const outer = await panel(page).boundingBox();
            for (const part of [previewSelect(page), showButton(page), note(page)]) {
                const box = await part.boundingBox();
                expect(box.x).toBeGreaterThanOrEqual(outer.x);
                expect(box.x + box.width).toBeLessThanOrEqual(outer.x + outer.width);
            }
            await quiet(dev);
        });
});
