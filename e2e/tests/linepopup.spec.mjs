// Instruments drawn on lines, the ordered line popup, segment click and the aggregate line style
// (epic 3 entry 2, R13; AD-7, AD-11, AD-16, AD-19). On the dev Gateway with the seeded L-SWD set
// (ops/project seed: the pads CTB1 and SWD1 the line's ends snap to, PT-1 at 1,143 m, LV-1 at 2,000 m
// and PT-2 at 2,841 m of 2,922 m, the tap and valve kind setups, the line's instruments style
// override): the instruments draw at their places on the line, the line is split at its measuring
// instruments and each segment graded on the Gateway (the `segments` slot of values.batch), a click
// between PT-1 and PT-2 opens the line popup at that segment with CTB1 outlet, PT-1, LV-1, PT-2 and
// SWD1 inlet in order, PT-1 and PT-2 highlighted on the map and in the list, the rows following their
// tags while open; PT-1 comms lost dashes CTB1 to PT-1 and PT-1 to PT-2 only, PT-2 at 500 shows
// attention on PT-1 to PT-2 and PT-2 to SWD1 only, PT-2 at 950 draws the alarm over both and in PT-2's
// marker; the same at 390 px. Screenshots for the docs (AD-15).

import { pagePixel } from '../lib/geo.mjs';
import {
    EDITOR_USER, editorTest, expect, mapLoaded, openMap, runSeed, send, shot, signedInContext, test, view
} from './fixtures.mjs';

/** The bound for a change to reach the map: one refresh interval (the dev setup's 10 s) plus margin. */
const INTERVAL_MS = 25_000;
/** The bound for an open popup's push (250 ms on the Gateway, plus the round trip). */
const PUSH_MS = 5_000;
/** How long a redraw after a view change may take on the dev stack. */

/**
 * The seed's L-SWD (mapstudio_seed, SWD_LINE): its midpoint, the point 1,500 m along it (between PT-1
 * and LV-1), and the view centres that put that point in the upper part of the map (about 300 px above
 * the centre at zoom 14 on the desktop, 115 px at zoom 15 on the phone; MapLibre's 512 px tiles, so
 * one degree of latitude is about 30,300 px at zoom 14 here), so the popup opens below it with room
 * for its whole card.
 */
const SWD = {
    mid: [-105.00017, 39.71888],
    between: [-104.999729, 39.718789],
    desktopCenter: [-105.00017, 39.708889],
    phoneCenter: [-104.999729, 39.716889],
    keys: { ctb1: 'swd/ctb1', swd1: 'swd/swd1', line: 'swd/line', pt1: 'swd/pt1', lv1: 'swd/lv1', pt2: 'swd/pt2' }
};

let ids;

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

/** The hidden live-state row of one map item. */
const liveItem = (page, id) => page.locator('.mapstudio-live-item[data-item-id="' + id + '"]');

/** The line's graded segments from its live row, keyed "from|to" by the seed keys of their nodes. */
async function segments(page) {
    const text = await liveItem(page, ids.line).getAttribute('data-segments');
    if (!text) return null;
    const byId = Object.fromEntries(Object.entries(ids).map(([k, v]) => [v, k]));
    return Object.fromEntries(JSON.parse(text).map((s) => [byId[s.from] + '|' + byId[s.to], s]));
}

/** Wait until the line's segments read as `expected` ({key: {preset, stale, alarm}} subsets), within `timeout`. */
async function expectSegments(page, expected, timeout) {
    await expect.poll(async () => {
        const got = await segments(page);
        if (!got) return 'no segments';
        const out = {};
        for (const [k, v] of Object.entries(expected)) {
            const s = got[k];
            out[k] = s ? Object.fromEntries(Object.keys(v).map((f) => [f, s[f]])) : 'missing';
        }
        return out;
    }, { timeout }).toEqual(expected);
}

/** Click the line between PT-1 and LV-1 on a map centred on `center` at `zoom`, and return the open line popup. */
async function clickBetween(page, map, center, zoom) {
    const box = await map.boundingBox();
    const [x, y] = pagePixel(box, SWD.between, center, zoom);
    await page.mouse.click(x, y);
    const popup = page.locator('.maplibregl-popup .mapstudio-popup--line');
    await expect(popup).toBeVisible({ timeout: 30_000 });
    return popup;
}

/** Each instrument row's name, distance and value, in order. */
async function rows(popup) {
    return popup.locator('.mapstudio-popup-instrument').evaluateAll((els) => els.map((e) => [
        e.querySelector('.mapstudio-popup-row-name').textContent,
        e.querySelector('.mapstudio-popup-row-distance').textContent,
        e.querySelector('.mapstudio-popup-value').textContent,
        e.getAttribute('data-highlighted')
    ]));
}

const row = (popup, id) => popup.locator('.mapstudio-popup-instrument[data-row-id="' + id + '"]');

test.beforeAll(async ({ browser }) => {
    // Seed again (not ensureSeeded's cached result): the L-SWD set, its kind setups and the line's
    // override come from the seed, and an earlier spec may have changed a kind setup.
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
        const seed = await runSeed(page);
        expect(seed.error, 'the seed saved').toBeUndefined();
        expect(seed.kindSetups, 'the tap and valve kind setups').toEqual(expect.objectContaining({ tap: expect.any(String), valve: expect.any(String) }));
        ids = Object.fromEntries(Object.entries(SWD.keys).map(([k, key]) => [k, seed.ids[key]]));
        ids.tracerLine = seed.ids['tracer/l1'];
        await mapLoaded(await openMap(page, '/live'));
        await press(page, 'swd-quiet');
    } finally {
        await context.close();
    }
});

editorTest.describe('1440 px', () => {
    editorTest.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    editorTest('the instruments at their places, the line popup at the clicked segment, live while open, and the per-segment look',
        async ({ page, watched }) => {
            const map = await openMap(page, '/live');
            await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
            await mapLoaded(map);
            await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });

            // The Gateway grades the line per segment: three segments between the nodes CTB1, PT-1, PT-2
            // and SWD1 (LV-1, with no icon KPI, bounds none), all normal in the quiet state; the line's own
            // style is their worst. A line with a Bands rule (the tracer line) carries no segments.
            await expectSegments(page, {
                'ctb1|pt1': { preset: 'normal', stale: false, alarm: '' },
                'pt1|pt2': { preset: 'normal', stale: false, alarm: '' },
                'pt2|swd1': { preset: 'normal', stale: false, alarm: '' }
            }, INTERVAL_MS);
            expect(Object.keys(await segments(page))).toHaveLength(3);
            await expect(liveItem(page, ids.line)).toHaveAttribute('data-preset', 'normal');
            await expect(liveItem(page, ids.tracerLine)).toHaveAttribute('data-segments', '');
            // The instruments draw as their kinds' markers (the eighth element of the image id says instrument).
            for (const [id, icon] of [[ids.pt1, 'tap'], [ids.lv1, 'line-valve'], [ids.pt2, 'tap']]) {
                const image = await liveItem(page, id).getAttribute('data-marker');
                const marker = JSON.parse(image.slice(image.indexOf('[')));
                expect(marker[0], 'the kind glyph').toBe(icon);
                expect(marker, 'an instrument marker').toHaveLength(8);
            }
            await expect(liveItem(page, ids.pt1)).toHaveAttribute('data-kpi', '398 psi', { timeout: INTERVAL_MS });
            await expect(liveItem(page, ids.pt2)).toHaveAttribute('data-kpi', '371 psi', { timeout: INTERVAL_MS });

            // At zoom 14 over the line the names sit at their places along it, in order from CTB1 to SWD1
            // (PT-2 and SWD1 are 81 m apart, 11 px here, so one of their names gives way to the other, entry 7).
            await view(page, map, SWD.mid, 14);
            const labels = JSON.parse(await map.getAttribute('data-labels'));
            const names = ['CTB1', 'PT-1', 'LV-1', 'PT-2', 'SWD1']
                .map((name) => labels.find((l) => l.layer === 'mapstudio-items-name' && l.text === name))
                .filter((b) => b !== undefined);
            expect(names.map((b) => b.text), 'the names drawn').toEqual(expect.arrayContaining(['CTB1', 'PT-1', 'LV-1']));
            expect(names.some((b) => b.text === 'PT-2' || b.text === 'SWD1'), 'the line end').toBe(true);
            const xs = names.map((b) => b.x);
            expect([...xs].sort((a, b) => a - b), 'the instruments in order along the line').toEqual(xs);

            // A click between PT-1 and LV-1 opens the line popup at the segment PT-1 to PT-2 (LV-1 lies inside
            // it): the header, the segment box, Comms over the instruments, the instruments in order between
            // the snapped ends with their distances and values, then the line's own KPI; PT-1 and PT-2
            // highlighted in the list and on the map.
            await view(page, map, SWD.desktopCenter, 14);
            const popup = await clickBetween(page, map, SWD.desktopCenter, 14);
            // The card fits below the segment (the view put the click high), whole, inside the map.
            const mapBox = await map.boundingBox();
            const cardBox = await page.locator('.maplibregl-popup-content').boundingBox();
            expect(cardBox.y, 'the card below the clicked segment').toBeGreaterThan(mapBox.y);
            expect(cardBox.y + cardBox.height, 'the card inside the map').toBeLessThanOrEqual(mapBox.y + mapBox.height);
            expect(await page.locator('.maplibregl-popup').getAttribute('class')).toContain('maplibregl-popup-anchor-top');
            expect(await popup.locator('[data-part]').evaluateAll((els) => els.map((e) => e.getAttribute('data-part'))))
                .toEqual(['header', 'segment', 'comms', 'instruments', 'kpis']);
            await expect(popup.locator('.mapstudio-popup-name')).toHaveText('L-SWD');
            await expect(popup.locator('.mapstudio-popup-subline')).toHaveText('Gathering line - 6 in, 2.9 km');
            await expect(popup).toHaveAttribute('data-segment', ids.pt1 + '|' + ids.pt2);
            await expect(popup.locator('.mapstudio-popup-segment-title')).toHaveText('Segment PT-1 to PT-2');
            await expect(popup.locator('.mapstudio-popup-segment-span')).toHaveText('1.1 to 2.8 km');
            await expect(popup.locator('.mapstudio-popup-segment-line')).toHaveText('398 to 371 psi - drop 27 psi over 1.7 km');
            await expect(popup.locator('[data-part="comms"]')).toHaveAttribute('data-comms', 'ok');
            await expect(popup.locator('[data-part="comms"] .mapstudio-popup-value')).toHaveText(/^OK - 3 instruments, oldest \d+ (s|min) ago$/);
            await expect(popup.locator('.mapstudio-popup-section-label')).toHaveText('Instruments, CTB1 to SWD1');
            expect(await rows(popup)).toEqual([
                ['CTB1 outlet', '0 km', '412 psi', 'false'],
                ['PT-1', '1.1 km', '398 psi', 'true'],
                ['LV-1', '2 km', 'No value', 'false'],
                ['PT-2', '2.8 km', '371 psi', 'true'],
                ['SWD1 inlet', '2.9 km', '365 psi', 'false']
            ]);
            await expect(popup.locator('.mapstudio-popup-kpi')).toHaveAttribute('data-kpi', 'flow');
            await expect(map).toHaveAttribute('data-segment', ids.pt1 + '|' + ids.pt2);
            await expect(map).toHaveAttribute('data-highlighted', ids.pt1 + ',' + ids.pt2);
            for (const id of [ids.pt1, ids.pt2]) {
                const image = await liveItem(page, id).getAttribute('data-marker');
                expect(JSON.parse(image.slice(image.indexOf('[')))[5], 'the selection ring on ' + id).toBe(true);
            }
            await shot(page, 'mapstudio-line-popup-1440.png');

            // Live while open: PT-2's pressure changes reach its row (the Gateway pushes every listed instrument
            // of an open line popup); 500 is the tap setup's attention band, so PT-1 to PT-2 and PT-2 to SWD1
            // show attention and CTB1 to PT-1 does not; the line's own style follows.
            const changed = Date.now();
            await press(page, 'pt2-pressure-500');
            await expect(row(popup, ids.pt2).locator('.mapstudio-popup-value')).toHaveText('500 psi', { timeout: PUSH_MS });
            expect(Date.now() - changed).toBeLessThan(PUSH_MS);
            await expect(popup.locator('.mapstudio-popup-segment-line')).toHaveText('398 to 500 psi - rise 102 psi over 1.7 km');
            await expectSegments(page, {
                'ctb1|pt1': { preset: 'normal', stale: false },
                'pt1|pt2': { preset: 'attention', stale: false },
                'pt2|swd1': { preset: 'attention', stale: false }
            }, INTERVAL_MS);
            await expect(liveItem(page, ids.line)).toHaveAttribute('data-preset', 'attention');
            await expect(liveItem(page, ids.pt2)).toHaveAttribute('data-preset', 'attention');

            // An alarm on PT-2 (950, the dev alarm): drawn at PT-2's place (its own marker's badge and digit)
            // and over both its segments; its row carries the alarm; the line's midpoint keeps no badge (the
            // line kind's setup has no alarms).
            await press(page, 'pt2-pressure-950');
            await expect(row(popup, ids.pt2)).toHaveAttribute('data-alarm', '1:unacked', { timeout: PUSH_MS });
            await expectSegments(page, {
                'ctb1|pt1': { preset: 'normal', alarm: '' },
                'pt1|pt2': { preset: 'fault', alarm: '1:unacked' },
                'pt2|swd1': { preset: 'fault', alarm: '1:unacked' }
            }, INTERVAL_MS);
            await expect(liveItem(page, ids.pt2)).toHaveAttribute('data-alarm', '1:unacked:1');
            expect(await liveItem(page, ids.pt2).getAttribute('data-marker')).toContain('"alarm-1-unacknowledged",1,true');
            expect(await liveItem(page, ids.pt1).getAttribute('data-marker')).not.toContain('alarm-1');
            await expect(liveItem(page, ids.line)).toHaveAttribute('data-alarm', '');
            await press(page, 'pt2-ack');
            await expect(row(popup, ids.pt2)).toHaveAttribute('data-alarm', '1:acked', { timeout: PUSH_MS });
            await press(page, 'pt2-pressure-371');
            await expectSegments(page, {
                'ctb1|pt1': { preset: 'normal', alarm: '' },
                'pt1|pt2': { preset: 'normal', alarm: '' },
                'pt2|swd1': { preset: 'normal', alarm: '' }
            }, INTERVAL_MS);

            // PT-1 comms lost: CTB1 to PT-1 and PT-1 to PT-2 dash (stale, PT-1 named) and PT-2 to SWD1 does not;
            // the segment box and the comms line say so; the line's own style is stale.
            await press(page, 'pt1-comms-off');
            await expect(row(popup, ids.pt1)).toHaveAttribute('data-stale', 'true', { timeout: PUSH_MS });
            await expect(row(popup, ids.pt1).locator('.mapstudio-popup-value')).toHaveText('Stale - 398 psi (last)');
            await expect(popup.locator('[data-part="segment"]')).toHaveAttribute('data-stale', 'true');
            await expect(popup.locator('.mapstudio-popup-segment-line')).toHaveText('Stale - drawn dashed until PT-1 updates');
            await expect(popup.locator('[data-part="comms"]')).toHaveAttribute('data-comms', 'lost');
            await expect(popup.locator('[data-part="comms"] .mapstudio-popup-value')).toHaveText(/^PT-1 comms lost( - last \d+ (s|min) ago)?$/);
            await expectSegments(page, {
                'ctb1|pt1': { stale: true, reason: 'PT-1: comms lost' },
                'pt1|pt2': { stale: true, reason: 'PT-1: comms lost' },
                'pt2|swd1': { stale: false, reason: '' }
            }, INTERVAL_MS);
            await expect(liveItem(page, ids.line)).toHaveAttribute('data-style', 'normal:stale:PT-1: comms lost');
            await expect(liveItem(page, ids.pt1)).toHaveAttribute('data-comms', 'lost');
            await shot(page, 'mapstudio-line-popup-stale-1440.png');
            await press(page, 'pt1-comms-on');
            await expect(row(popup, ids.pt1)).toHaveAttribute('data-stale', 'false', { timeout: PUSH_MS });
            await expectSegments(page, { 'ctb1|pt1': { stale: false }, 'pt1|pt2': { stale: false } }, INTERVAL_MS);

            // The header's close button closes the popup and clears the selection and the highlight.
            await popup.locator('.mapstudio-popup-close').click();
            await expect(page.locator('.maplibregl-popup')).toHaveCount(0);
            await expect(map).toHaveAttribute('data-segment', '');
            await expect(map).toHaveAttribute('data-highlighted', '');
            await expect(map).toHaveAttribute('data-selected', '');

            // popup.open's segment is checked: two non-empty strings, else invalid (a refused open leaves
            // nothing open, so there is nothing to close).
            const refused = await send(page, 'popup.open', { itemId: ids.line, segment: { fromId: ids.pt1, toId: 7 } });
            expect(refused.type, JSON.stringify(refused.body)).toBe('error');
            expect(refused.body.code).toBe('invalid');
            expect(refused.body.message).toBe("popup.open's segment needs fromId and toId.");
            expect(watched.warnings, 'Map Studio warnings').toEqual([]);
        });
});

editorTest.describe('390 px', () => {
    editorTest.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

    editorTest('the line popup at the clicked segment stays inside the phone with 44 px header buttons', async ({ page, watched }) => {
        const map = await openMap(page, '/live');
        await mapLoaded(map);
        await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
        await expectSegments(page, { 'pt1|pt2': { preset: 'normal', stale: false } }, INTERVAL_MS);
        await view(page, map, SWD.phoneCenter, 15);
        const popup = await clickBetween(page, map, SWD.phoneCenter, 15);
        await expect(popup).toHaveAttribute('data-segment', ids.pt1 + '|' + ids.pt2);
        await expect(popup.locator('.mapstudio-popup-segment-title')).toHaveText('Segment PT-1 to PT-2');
        expect((await rows(popup)).map((r) => r[0])).toEqual(['CTB1 outlet', 'PT-1', 'LV-1', 'PT-2', 'SWD1 inlet']);
        await expect(map).toHaveAttribute('data-highlighted', ids.pt1 + ',' + ids.pt2);
        // The /live page's button toolbar wraps on a phone and leaves the map short: the card is clamped
        // to the room below the click (its body scrolls) and stays inside the map and the phone.
        const mapBox = await map.boundingBox();
        const card = await page.locator('.maplibregl-popup-content').boundingBox();
        expect(card.x, 'the card inside the phone').toBeGreaterThanOrEqual(0);
        expect(card.x + card.width, 'the card inside the phone').toBeLessThanOrEqual(390);
        expect(card.y, 'the card inside the map').toBeGreaterThanOrEqual(mapBox.y);
        expect(card.y + card.height, 'the card inside the map').toBeLessThanOrEqual(mapBox.y + mapBox.height);
        expect(card.width, 'the card at calc(100vw - 32px)').toBeLessThanOrEqual(358);
        expect(await popup.locator('.mapstudio-popup-body').evaluate((e) => getComputedStyle(e).overflowY)).toBe('auto');
        const close = await popup.locator('.mapstudio-popup-close').boundingBox();
        expect(close.width, 'the close button 44 px').toBeGreaterThanOrEqual(44);
        expect(close.height, 'the close button 44 px').toBeGreaterThanOrEqual(44);
        await shot(page, 'mapstudio-line-popup-390.png');
        await popup.locator('.mapstudio-popup-close').click();
        await expect(page.locator('.maplibregl-popup')).toHaveCount(0);
        expect(watched.warnings, 'Map Studio warnings').toEqual([]);
    });
});
