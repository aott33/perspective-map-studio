// Search (epic 3 entry 9, R4; DESIGN.md search-field and phone top bar, EXPERIENCE.md Search). On the
// dev Gateway with the seeded 30-pad set and the tracer: the field top-left lists the map items whose
// name or linked asset name holds what is typed, without regard to letter case or accents, a name
// that starts with the text first, then an asset name that does, then the names and asset names that
// hold it, capped at eight rows each with the kind glyph, the name and the kind (or kind and asset);
// a click, a tap or the keyboard alone (arrows, Enter; Esc clears and closes) chooses one, which
// zooms to the item and selects it as a click on it does (a point with its popup open, a line fitted
// and selected); the whole flow works for a viewer (level none, who gets the asset names without tag
// paths) and at 390 px, where the field is the one top bar 8 px from the edges that expands with the
// results and every target is 44 px. Screenshots at 1440 and 390 px for the docs (AD-15).

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { screenshotDir } from '../lib/env.mjs';
import { TRACER } from '../lib/geo.mjs';
import { ensureSeeded, expect, mapLoaded, nextFrames, openMap, test } from './fixtures.mjs';

/** How long a redraw or a popup after a choice may take on the dev stack. */
const DRAW_MS = 20_000;
/** The field's placeholder (DESIGN.md search-field). */
const PLACEHOLDER = 'Search sites, wells or lines';

let ids;

const input = (page) => page.locator('.mapstudio-search-input');
const panel = (page) => page.locator('.mapstudio-search-panel');
const options = (page) => page.locator('.mapstudio-search-option');
// The point's default popup: the card at 1440 px, the bottom sheet below 768 px (entry 8).
const popup = (page) => page.locator('.maplibregl-popup .mapstudio-popup--default, .mapstudio-sheet .mapstudio-popup--default');

async function shot(page, name) {
    await nextFrames(page);
    mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, name), fullPage: false });
}

/** Open /live (the default popup, no popupView prop) and wait for the items and the first full batch. */
async function openLive(page) {
    const map = await openMap(page, '/live');
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', 'none');
    await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
    await expect(input(page)).toBeVisible();
    return map;
}

/** The rows as "name|detail|matched". */
async function rows(page) {
    return options(page).evaluateAll((els) => els.map((el) =>
        el.querySelector('.mapstudio-search-name').textContent + '|' + el.querySelector('.mapstudio-search-detail').textContent
        + '|' + el.getAttribute('data-matched')));
}

test.beforeAll(async ({ browser }) => {
    const seed = await ensureSeeded(browser);
    ids = { ...Object.fromEntries(Object.entries(TRACER.points).map(([k, p]) => [k, seed.ids[p.key]])), line: seed.ids['tracer/l1'] };
});

test.describe('1440 px', () => {
    test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    test('typing lists the matches ranked, capped and with the kind; a click zooms to the item and selects it with its popup',
        async ({ page, watched }) => {
            const map = await openLive(page);
            const field = page.locator('.mapstudio-search-field');
            const mapBox = await map.boundingBox();
            const fieldBox = await field.boundingBox();
            // The field as designed: 300 by 40 px, 12 px from the map's top-left corner, the placeholder, a combobox.
            expect(Math.round(fieldBox.width)).toBe(300);
            expect(Math.round(fieldBox.height)).toBe(40);
            expect(Math.round(fieldBox.x - mapBox.x)).toBe(12);
            expect(Math.round(fieldBox.y - mapBox.y)).toBe(12);
            await expect(input(page)).toHaveAttribute('placeholder', PLACEHOLDER);
            await expect(input(page)).toHaveAttribute('role', 'combobox');
            await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
            await expect(panel(page)).toHaveCount(0);
            await expect(page.locator('.mapstudio-search-clear'), 'no Clear button with no text').toHaveCount(0);

            // "oint" is held by the three tracer points (no name starts with it): matched by name, with the kind.
            await input(page).fill('oint');
            await expect(map).toHaveAttribute('data-search-open', 'true');
            await expect(input(page)).toHaveAttribute('aria-expanded', 'true');
            await expect(options(page)).toHaveCount(3);
            expect(await rows(page)).toEqual(['Point 1|Well pad|name', 'Point 2|Well pad|name', 'Point 3|Well pad|name']);
            await expect(page.locator('.mapstudio-search-clear')).toBeVisible();
            // Each row carries the kind's glyph from the sprite.
            await expect(options(page).first().locator('svg use')).toHaveAttribute('href', /#ms-well-pad$/);
            // The listbox is the one the combobox controls.
            const listId = await input(page).getAttribute('aria-controls');
            await expect(page.locator('#' + listId)).toHaveAttribute('role', 'listbox');

            // Prefix matches first (Pad 1, Pad 10, ... by name), then the rest; the list is capped at eight.
            await input(page).fill('Pad 1');
            await expect(options(page)).toHaveCount(8);
            const padRows = await rows(page);
            expect(padRows[0]).toBe('Pad 1|Well pad|name');
            expect(padRows.every((r) => r.startsWith('Pad 1'))).toBe(true);
            await shot(page, 'mapstudio-search-1440.png');

            // Nothing starts with "d 3": the names that hold it, by name, lines and pads alike.
            await input(page).fill('d 3');
            expect(await rows(page)).toEqual([
                'Line to Pad 3|Gathering line|name', 'Line to Pad 30|Gathering line|name', 'Pad 3|Well pad|name', 'Pad 30|Well pad|name'
            ]);

            // A click on a row: the map zooms to the point (15 at least), its popup opens and it is selected.
            await input(page).fill('Point 2');
            await expect(options(page).first()).toContainText('Point 2');
            await options(page).first().click();
            await expect(map).toHaveAttribute('data-selected', ids.p2, { timeout: DRAW_MS });
            await expect(map).toHaveAttribute('data-selected-kind', 'point');
            await expect(map).toHaveAttribute('data-zoom', '15.00', { timeout: DRAW_MS });
            await expect(map).toHaveAttribute('data-center', '-104.97500,39.75000');
            await expect(popup(page)).toBeVisible({ timeout: DRAW_MS });
            await expect(popup(page)).toHaveAttribute('data-point-id', ids.p2);
            await expect(popup(page).locator('.mapstudio-popup-name')).toHaveText('Point 2');
            await expect(page.locator('.mapstudio-reply')).toContainText('Gateway received click on ' + ids.p2, { timeout: DRAW_MS });
            await expect(page.locator('.mapstudio-return-button')).toBeEnabled();
            // The field is cleared and closed; the live region says what was chosen.
            await expect(input(page)).toHaveValue('');
            await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
            await expect(panel(page)).toHaveCount(0);
            await expect(map).toHaveAttribute('data-search-open', 'false');
            await expect(page.locator('.mapstudio-search-status')).toHaveText('Point 2 selected');
            await shot(page, 'mapstudio-search-chosen-1440.png');
            expect(watched.warnings, 'Map Studio warnings').toEqual([]);
        });

    test('the whole flow by keyboard alone: arrows, Enter, Esc; a line is fitted and selected; no matches is said', async ({ page }) => {
        const map = await openLive(page);
        await input(page).focus();
        await page.keyboard.type('Point');
        await expect(options(page)).toHaveCount(3);
        await expect(input(page)).not.toHaveAttribute('aria-activedescendant', /./);
        // ArrowDown moves the active row; the input names it.
        await page.keyboard.press('ArrowDown');
        await expect(options(page).nth(0)).toHaveAttribute('aria-selected', 'true');
        await expect(input(page)).toHaveAttribute('aria-activedescendant', await options(page).nth(0).getAttribute('id'));
        await page.keyboard.press('ArrowDown');
        await expect(options(page).nth(1)).toHaveAttribute('aria-selected', 'true');
        await expect(options(page).nth(0)).toHaveAttribute('aria-selected', 'false');
        await page.keyboard.press('ArrowUp');
        await expect(options(page).nth(0)).toHaveAttribute('aria-selected', 'true');
        await page.keyboard.press('End');
        await expect(options(page).nth(2)).toHaveAttribute('aria-selected', 'true');
        await expect(input(page)).toHaveAttribute('aria-activedescendant', await options(page).nth(2).getAttribute('id'));
        // Enter chooses the active row: Point 3, zoomed to, selected, its popup open; the focus stays in the field.
        await page.keyboard.press('Enter');
        await expect(map).toHaveAttribute('data-selected', ids.p3, { timeout: DRAW_MS });
        await expect(map).toHaveAttribute('data-zoom', '15.00', { timeout: DRAW_MS });
        await expect(map).toHaveAttribute('data-center', '-104.95500,39.74300');
        await expect(popup(page)).toHaveAttribute('data-point-id', ids.p3, { timeout: DRAW_MS });
        await expect(input(page)).toHaveValue('');
        await expect(page.locator('.mapstudio-search-status')).toHaveText('Point 3 selected');
        // The focus moved into the popup, as MapLibre opens it (focusAfterOpen): Esc there is the popup's.
        await expect.poll(() => page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest('.maplibregl-popup'))),
            'the focus in the popup').toBe(true);

        // No matches is said in words; Esc clears the text and closes the list, the focus staying in the field.
        await input(page).focus();
        await page.keyboard.type('zzz');
        await expect(panel(page)).toBeVisible();
        await expect(page.locator('.mapstudio-search-empty')).toHaveText('No matches');
        await expect(options(page)).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect(input(page)).toHaveValue('');
        await expect(panel(page)).toHaveCount(0);
        await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
        await expect(input(page)).toBeFocused();
        // Esc in the field never reached the legend or the map: the popup is still open.
        await expect(popup(page)).toBeVisible();

        // Enter with no active row takes the first: the tracer line is fitted and selected, with no popup.
        await page.keyboard.type('Tracer');
        await expect(options(page).first()).toContainText('Tracer line');
        await expect(options(page).first()).toContainText('Gathering line');
        await page.keyboard.press('Enter');
        await expect(map).toHaveAttribute('data-selected', ids.line, { timeout: DRAW_MS });
        await expect(map).toHaveAttribute('data-selected-kind', 'line');
        await expect(map).toHaveAttribute('data-arrow', '1', { timeout: DRAW_MS });
        await expect(map).not.toHaveAttribute('data-center', '-104.95500,39.74300', { timeout: DRAW_MS });
        await expect(map).toHaveAttribute('data-fit', 'off');
        await expect(popup(page)).toHaveCount(0);
        await expect(page.locator('.mapstudio-search-status')).toHaveText('Tracer line selected');
        // No popup took the focus: it stays in the field.
        await expect(input(page)).toBeFocused();
    });

    test('a viewer finds a map item by its linked asset\'s name, whatever the letter case or accents', async ({ page }) => {
        const map = await openLive(page);
        // The viewer got the asset names (ids and names only) and no asset rows.
        await expect(page.locator('.mapstudio-adapter-status')).toHaveAttribute('data-assets-rows', '');
        // "Pad 14" is a pad's name and the name of the asset Point 2 is linked to: the name prefix first, then the
        // asset prefix, then the line whose name holds it.
        const expected = ['Pad 14|Well pad|name', 'Point 2|Well pad - Pad 14|asset', 'Line to Pad 14|Gathering line|name'];
        await input(page).fill('Pad 14');
        expect(await rows(page)).toEqual(expected);
        await input(page).fill('pÁd 14');
        expect(await rows(page)).toEqual(expected);
        await options(page).nth(1).click();
        await expect(map).toHaveAttribute('data-selected', ids.p2, { timeout: DRAW_MS });
        await expect(popup(page)).toHaveAttribute('data-point-id', ids.p2, { timeout: DRAW_MS });
        // The Clear button clears the text and keeps the focus in the field.
        await input(page).fill('Pad');
        await expect(options(page)).toHaveCount(8);
        await page.locator('.mapstudio-search-clear').click();
        await expect(input(page)).toHaveValue('');
        await expect(panel(page)).toHaveCount(0);
        await expect(input(page)).toBeFocused();
        await expect(page.locator('.mapstudio-search-clear')).toHaveCount(0);
    });
});

test.describe('390 px', () => {
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

    test('the field is the top bar 8 px from the edges, expands on tap with 44 px rows, a tap chooses, the zoom card sits under it',
        async ({ page }) => {
            const map = await openLive(page);
            const bar = page.locator('.mapstudio-topbar');
            const mapBox = await map.boundingBox();
            let barBox = await bar.boundingBox();
            expect(Math.round(barBox.x - mapBox.x), 'the bar 8 px from the left edge').toBe(8);
            expect(Math.round(barBox.width), 'the bar 8 px from the right edge').toBe(390 - 16);
            expect(Math.round(barBox.y - mapBox.y), 'the bar 8 px from the top').toBe(8);
            expect(Math.round(barBox.height), 'the bar 48 px tall').toBe(48);
            const inputBox = await input(page).boundingBox();
            expect(inputBox.height, 'a 44 px target').toBeGreaterThanOrEqual(44);
            // The zoom card sits under the bar.
            const zoomBox = await page.locator('.mapstudio-zoom').boundingBox();
            expect(zoomBox.y, 'the zoom card under the top bar').toBeGreaterThanOrEqual(barBox.y + barBox.height + 8 - 1);
            expect(zoomBox.x + zoomBox.width).toBeLessThanOrEqual(390);

            // A tap on the field and the text: the bar expands with the results inside it.
            await input(page).click();
            await input(page).fill('Point');
            await expect(options(page)).toHaveCount(3);
            barBox = await bar.boundingBox();
            const panelBox = await panel(page).boundingBox();
            expect(Math.round(panelBox.x)).toBe(Math.round(barBox.x));
            expect(Math.round(panelBox.width)).toBe(Math.round(barBox.width));
            expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(barBox.y + barBox.height + 1);
            for (const row of await options(page).all()) {
                expect((await row.boundingBox()).height, 'a 44 px row').toBeGreaterThanOrEqual(44);
            }
            // Every control button is a 44 px touch target, the Clear button included (the Needs you bar steps
            // aside while the results are open, entry 3, so only the visible ones count).
            for (const b of await page.locator('.mapstudio .maplibregl-ctrl button:visible').all()) {
                const r = await b.boundingBox();
                expect(Math.min(r.width, r.height), (await b.getAttribute('aria-label')) || (await b.textContent())).toBeGreaterThanOrEqual(44);
            }
            await shot(page, 'mapstudio-search-390.png');

            // A tap on a row chooses it: zoomed to, selected, the popup open; the field gives the focus up (no keyboard over the sheet).
            await options(page).first().click();
            await expect(map).toHaveAttribute('data-selected', ids.p1, { timeout: DRAW_MS });
            await expect(map).toHaveAttribute('data-zoom', '15.00', { timeout: DRAW_MS });
            await expect(popup(page)).toHaveAttribute('data-point-id', ids.p1, { timeout: DRAW_MS });
            await expect(map).toHaveAttribute('data-popup-mode', 'sheet');
            await expect(input(page)).toHaveValue('');
            await expect(input(page)).not.toBeFocused();
            await expect(panel(page)).toHaveCount(0);
            barBox = await bar.boundingBox();
            expect(Math.round(barBox.height)).toBe(48);
            // Nothing in the bottom-right corner (the App Bar toggle's), the bar included.
            const corner = { x: 390 - 64, y: 844 - 64 };
            for (const box of [barBox, await page.locator('.mapstudio-zoom').boundingBox(), await page.locator('.mapstudio-legend-button').boundingBox()]) {
                expect(box.x + box.width > corner.x && box.y + box.height > corner.y, 'nothing in the bottom-right corner').toBe(false);
            }
            await shot(page, 'mapstudio-search-chosen-390.png');
        });
});
