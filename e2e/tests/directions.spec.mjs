// Directions, Nearest and distances (epic 4 entry 16; the plan's I/O matrix), on the dev page /locate as the map editor at
// 1366 and 390 px. The page sets the map's `directions` to {enabled: true} and offers a text field for its urlTemplate (empty
// by default); the map's userLocation is bound to {session.props.geolocation} (entry 15), and Chromium is given a position
// about 430 m north-east of CTB1. The popup of Point 1 (the dev pad P12, put in alarm with /live's "pressure high") ends in
// the footer: Directions (secondary, the route glyph) then View alarms (primary), the same height and equal widths, View
// alarms no longer in the alarm block. Directions opens the route to Point 1's own coordinates with window.open (captured
// here, so nothing leaves the browser): the Google link for a desktop or Android agent, the Apple link with the name for an
// iPhone agent (set on the context), the page's template filled when it starts https://, http://, geo: or maps:, any other
// ignored with one warning. A line has no Directions; a page with directions null (/live) shows View alarms alone. With the
// position, the search's open list starts with an A-Z | Nearest switch (A-Z first): Nearest lists the ten nearest items
// with their distance, a row chosen as any result; every Needs you row ends with its distance, the order by state
// unchanged; with the location off, no switch and no distances. From entry 20a distances follow the units in force, so this
// spec sets the dev setup's units to `auto` for itself: the words then follow the browser locale, en-US in miles and feet,
// else kilometres and metres, by the one rounding rule (feet up to a mile). An override set while Nearest is open redraws
// it with no reload. The spec leaves P12 quiet again, the template empty, the committed setup back and no override.

import { TRACER, pagePixel } from '../lib/geo.mjs';
import {
    EDITOR_USER, clearUnits, ensureSeeded, expect, mapLoaded, openMap, restoreSetupUnits, setUnits, shot, signedInContext, test, useSetupUnits, view,
    watch, INTERVAL_MS
} from './fixtures.mjs';

/** Near CTB1 (-105.012, 39.7262), about 432 m north-east of it (as locate.spec.mjs). */
const YOU = { latitude: 39.729, longitude: -105.0085, accuracy: 40 };
/** How long the client's position and the page's writes take to reach the map's binding on the dev stack. */
const BIND_MS = 20_000;

const AGENTS = {
    desktop: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
};

const P1 = TRACER.points.p1;
const GOOGLE_P1 = 'https://www.google.com/maps/dir/?api=1&destination=39.739200,-104.990300';
const APPLE_P1 = 'https://maps.apple.com/?daddr=39.739200,-104.990300&q=Point%201';

let ids;

const value = (page) => page.locator('#mapstudio-locate-value');
const template = (page) => page.locator('#mapstudio-locate-template input, input#mapstudio-locate-template').first();
const card = (page) => page.locator('.maplibregl-popup .mapstudio-popup--default');
const sheet = (page) => page.locator('.mapstudio-sheet .mapstudio-popup--default');

test.beforeAll(async ({ browser }) => {
    const seed = await ensureSeeded(browser);
    ids = { p1: seed.ids['tracer/p1'], ctb1: seed.ids['swd/ctb1'], line: seed.ids['tracer/l1'] };
    await livePress(browser, ['comms-on', 'pressure-high']);
    // The locale decides only while the setup says `auto` and no override is live (entry 20a, the owner's pick 8).
    await asEditor(browser, async (page) => {
        await clearUnits(page);
        await useSetupUnits(page, 'auto');
    });
});

test.afterAll(async ({ browser }) => {
    // P12 quiet again for the specs after this one.
    await livePress(browser, ['pressure-low', 'comms-on', 'ack']);
    await asEditor(browser, async (page) => {
        await clearUnits(page);
        await restoreSetupUnits(page);
    });
});

/** Run `step` on the map editor's /edit page in its own context (the units override and the setup's units). */
async function asEditor(browser, step) {
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
        await step(page);
    } finally {
        await context.close();
    }
}

/** Press /live's dev buttons in order as the map editor (P12's tags: pressure, comms, acknowledge). */
async function livePress(browser, buttons) {
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/live'));
        for (const button of buttons) {
            const out = page.locator('#mapstudio-live-result');
            const before = await out.innerText();
            await page.locator('#mapstudio-live-' + button).click();
            await expect.poll(() => out.innerText(), { timeout: 30_000 }).not.toBe(before);
            const result = JSON.parse(await out.innerText());
            expect(result.error, 'the dev button ' + button).toBeUndefined();
        }
    } finally {
        await context.close();
    }
}

/**
 * A page as the map editor in its own context, with Chromium given the position (none with `position` null), the user
 * agent and locale set, and window.open captured into `window.__opened`. The caller closes the context.
 */
async function openPage(browser, path, { position = YOU, userAgent = AGENTS.desktop, locale = 'en-US', viewport = { width: 1366, height: 768 } } = {}) {
    const options = { viewport, deviceScaleFactor: 1, userAgent, locale };
    if (position) {
        options.permissions = ['geolocation'];
        options.geolocation = position;
    }
    const context = await signedInContext(browser, EDITOR_USER, options);
    await context.addInitScript(() => {
        window.__opened = [];
        window.open = (url, target, features) => { window.__opened.push({ url: String(url), target, features }); return null; };
    });
    const page = await context.newPage();
    const watched = watch(page);
    const map = await openMap(page, path);
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    if (position) {
        await expect(value(page)).toContainText('"latitude":' + position.latitude, { timeout: BIND_MS });
        await expect(map).toHaveAttribute('data-you-are-here', 'fix', { timeout: BIND_MS });
    }
    return { context, page, map, watched };
}

/** Point 1 clicked at zoom 15 in the middle of the map: its card (or sheet below 768 px) with its alarm in. */
async function openPoint1(page, map, popup) {
    await view(page, map, P1.lngLat, 15);
    const box = await map.boundingBox();
    const [x, y] = pagePixel(box, P1.lngLat, P1.lngLat, 15);
    await page.mouse.click(x, y);
    await expect(popup).toBeVisible({ timeout: 30_000 });
    await expect(popup).toHaveAttribute('data-point-id', ids.p1);
    await expect(popup.locator('[data-part="alarms"]')).toHaveAttribute('data-alarm', /^1:/, { timeout: INTERVAL_MS });
    return popup;
}

/** The footer's buttons: class, box and the order they sit in. */
async function footerButtons(popup) {
    return popup.locator('[data-part="footer"] .mapstudio-popup-button').evaluateAll((els) => els.map((el) => {
        const b = el.getBoundingClientRect();
        return { cls: el.className, text: el.textContent.trim(), x: b.x, w: b.width, h: b.height, glyph: !!el.querySelector('svg') };
    }));
}

/** The links window.open was asked for, and with what. */
async function opened(page) {
    return page.evaluate(() => window.__opened.slice());
}

/** The page's link template typed into its field, through the binding to the map's directions.urlTemplate. */
async function setTemplate(page, text) {
    const field = template(page);
    await field.fill(text);
    await field.press('Tab');
    await page.waitForTimeout(1500);
}

test.describe('1366 px', () => {
    test('Card: Directions then View alarms in the footer, the same height and equal widths; no View alarms in the alarm block', async ({ browser }) => {
        const { context, page, map, watched } = await openPage(browser, '/locate');
        try {
            const popup = await openPoint1(page, map, card(page));
            await expect(popup.locator('[data-part="footer"]')).toHaveAttribute('data-buttons', '2', { timeout: INTERVAL_MS });
            const buttons = await footerButtons(popup);
            expect(buttons.map((b) => b.text)).toEqual(['Directions', 'View alarms']);
            expect(buttons[0].cls).not.toContain('--primary');
            expect(buttons[0].glyph, 'the route glyph before the word').toBe(true);
            expect(buttons[1].cls).toContain('mapstudio-popup-button--primary');
            expect(Math.abs(buttons[0].w - buttons[1].w), 'equal widths').toBeLessThanOrEqual(1);
            expect(Math.round(buttons[0].h)).toBe(32);
            expect(Math.round(buttons[1].h)).toBe(32);
            expect(Math.round(buttons[1].x - (buttons[0].x + buttons[0].w)), 'an 8 px gap').toBe(8);
            await expect(popup.locator('[data-part="alarms"] .mapstudio-popup-view-alarms')).toHaveCount(0);
            await shot(page, 'mapstudio-directions-card-1366.png');
            // Link: the Google route to Point 1's own coordinates, in a new tab with no opener; nothing else is opened.
            await popup.locator('.mapstudio-popup-directions').click();
            expect(await opened(page)).toEqual([{ url: GOOGLE_P1, target: '_blank', features: 'noopener' }]);
            expect(watched.errors).toEqual([]);
            expect(watched.warnings).toEqual([]);
        } finally {
            await context.close();
        }
    });

    test('Link on Android: the Google route too', async ({ browser }) => {
        const { context, page, map } = await openPage(browser, '/locate', { userAgent: AGENTS.android });
        try {
            const popup = await openPoint1(page, map, card(page));
            await popup.locator('.mapstudio-popup-directions').click();
            expect((await opened(page)).map((o) => o.url)).toEqual([GOOGLE_P1]);
        } finally {
            await context.close();
        }
    });

    test('Template: the page\'s template filled and encoded; a bad one ignored with one warning, the platform link used', async ({ browser }) => {
        const { context, page, map, watched } = await openPage(browser, '/locate');
        try {
            await setTemplate(page, 'https://x.example/r?to={lat},{lng}&n={name}');
            let popup = await openPoint1(page, map, card(page));
            await popup.locator('.mapstudio-popup-directions').click();
            expect((await opened(page)).map((o) => o.url)).toEqual(['https://x.example/r?to=39.739200,-104.990300&n=Point%201']);
            await popup.locator('.mapstudio-popup-close').click();
            await setTemplate(page, 'javascript:alert(1)');
            popup = await openPoint1(page, map, card(page));
            await popup.locator('.mapstudio-popup-directions').click();
            expect((await opened(page)).map((o) => o.url).slice(1)).toEqual([GOOGLE_P1]);
            const warned = watched.warnings.filter((w) => w.includes('directions.urlTemplate is ignored'));
            expect(warned).toHaveLength(1);
            expect(watched.errors).toEqual([]);
        } finally {
            await setTemplate(page, '').catch(() => undefined);
            await context.close();
        }
    });

    test('Line: L-SWD\'s line popup has no Directions (the tracer line\'s, here)', async ({ browser }) => {
        const { context, page, map } = await openPage(browser, '/locate');
        try {
            const mid = [(TRACER.points.p1.lngLat[0] + TRACER.points.p2.lngLat[0]) / 2, (TRACER.points.p1.lngLat[1] + TRACER.points.p2.lngLat[1]) / 2];
            await view(page, map, mid, 15);
            const box = await map.boundingBox();
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            const popup = page.locator('.maplibregl-popup .mapstudio-popup--line');
            await expect(popup).toBeVisible({ timeout: 30_000 });
            await expect(page.locator('.mapstudio-popup-directions')).toHaveCount(0);
        } finally {
            await context.close();
        }
    });

    test('Off: with directions null (/live) there is no Directions and View alarms alone fills the footer', async ({ browser }) => {
        const { context, page, map } = await openPage(browser, '/live', { position: null });
        try {
            const popup = await openPoint1(page, map, card(page));
            await expect(popup.locator('[data-part="footer"]')).toHaveAttribute('data-buttons', '1', { timeout: INTERVAL_MS });
            await expect(popup.locator('.mapstudio-popup-directions')).toHaveCount(0);
            const footer = await popup.locator('[data-part="footer"]').evaluate((el) => {
                const s = getComputedStyle(el);
                return el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
            });
            const buttons = await footerButtons(popup);
            expect(buttons.map((b) => b.text)).toEqual(['View alarms']);
            expect(Math.abs(buttons[0].w - footer), 'one alone fills the row').toBeLessThanOrEqual(1);
        } finally {
            await context.close();
        }
    });

    test('Nearest: the switch on the open list (A-Z first), ten rows by distance with words; a row chosen zooms and selects', async ({ browser }) => {
        const { context, page, map, watched } = await openPage(browser, '/locate');
        try {
            const input = page.locator('.mapstudio-search-input');
            await page.locator('.mapstudio-search-chevron').click();
            const panel = page.locator('.mapstudio-search-panel');
            await expect(panel).toHaveAttribute('data-order', 'az');
            const parts = panel.locator('.mapstudio-search-order-button');
            await expect(parts).toHaveText(['A-Z', 'Nearest']);
            await expect(parts.nth(0)).toHaveAttribute('aria-pressed', 'true');
            await expect(panel.locator('.mapstudio-search-distance')).toHaveCount(0);
            await parts.nth(1).click();
            await expect(panel).toHaveAttribute('data-order', 'nearest');
            // The chosen part filled attention (--neutral-90), under the pointer too (MapLibre's button hover wash beaten).
            const fill = await parts.nth(1).evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor,
                attention: getComputedStyle(el.closest('.mapstudio')).getPropertyValue('--neutral-90').trim() }));
            expect(fill.bg).toBe('rgb(50, 50, 50)');
            expect(fill.attention.toUpperCase()).toBe('#323232');
            const rows = panel.locator('.mapstudio-search-option');
            await expect(rows).toHaveCount(10);
            const metres = (await rows.evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-distance-m')))));
            for (let i = 1; i < metres.length; i++) {
                expect(metres[i]).toBeGreaterThanOrEqual(metres[i - 1]);
            }
            // CTB1 first (432 m; L-SWD's end at CTB1 ties, after it by name), in feet under a mile for en-US (entry 20a).
            await expect(map).toHaveAttribute('data-units', 'us');
            await expect(map).toHaveAttribute('data-unit-labels', 'short');
            await expect(rows.nth(0)).toHaveAttribute('data-item-id', ids.ctb1);
            await expect(rows.nth(0).locator('.mapstudio-search-distance')).toHaveText('1,420 ft');
            const words = await panel.locator('.mapstudio-search-distance').allTextContents();
            for (const w of words) {
                expect(w).toMatch(/^(\d{1,3}(,\d{3})? ft|\d+(\.\d)? mi)$/);
            }
            // The distance right-aligned at the row's end, in the secondary colour.
            const aligned = await rows.nth(0).evaluate((row) => {
                const d = row.querySelector('.mapstudio-search-distance').getBoundingClientRect();
                const r = row.getBoundingClientRect();
                return r.right - d.right;
            });
            expect(aligned).toBeLessThanOrEqual(16);
            await shot(page, 'mapstudio-nearest-1366.png');
            // Typing returns to the usual results, no switch; clearing brings the switch back with Nearest kept.
            await input.fill('Point');
            await expect(panel.locator('.mapstudio-search-order')).toHaveCount(0);
            await expect(panel.locator('.mapstudio-search-distance')).toHaveCount(0);
            await input.fill('');
            await expect(panel).toHaveAttribute('data-order', 'nearest');
            // Keyboard: ArrowLeft and ArrowRight in the empty field choose; Tab reaches the switch; Enter chooses a row.
            await input.press('ArrowLeft');
            await expect(panel).toHaveAttribute('data-order', 'az');
            await input.press('ArrowRight');
            await expect(panel).toHaveAttribute('data-order', 'nearest');
            await input.press('Tab');
            await expect(parts.nth(1)).toBeFocused();
            await page.keyboard.press('ArrowLeft');
            await expect(panel).toHaveAttribute('data-order', 'az');
            await page.keyboard.press('ArrowRight');
            await expect(panel).toHaveAttribute('data-order', 'nearest');
            await page.keyboard.press('ArrowDown');
            await expect(input).toBeFocused();
            await page.keyboard.press('Enter');
            await expect(map).toHaveAttribute('data-selected', ids.ctb1, { timeout: BIND_MS });
            await expect(card(page)).toHaveAttribute('data-point-id', ids.ctb1, { timeout: 30_000 });
            expect(watched.errors).toEqual([]);
        } finally {
            await context.close();
        }
    });

    test('Needs you: every row ends with its distance, the order by state the same as without a position', async ({ browser }) => {
        const { context, page, watched } = await openPage(browser, '/locate');
        try {
            const bar = page.locator('.mapstudio-needs');
            await expect(bar).toHaveAttribute('data-count', /^[1-9]/, { timeout: INTERVAL_MS });
            await bar.click();
            const rows = page.locator('.mapstudio-needs-row');
            await expect(rows.first()).toBeVisible();
            const withPosition = await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-item-id')));
            const distances = page.locator('.mapstudio-needs-row .mapstudio-needs-distance');
            await expect(distances).toHaveCount(withPosition.length);
            const p1Row = page.locator('.mapstudio-needs-row[data-item-id="' + ids.p1 + '"] .mapstudio-needs-distance');
            // Point 1 is 1.93 km from the position: 1.2 mi.
            await expect(p1Row).toHaveText('1.2 mi');
            const look = await distances.first().evaluate((el) => ({ size: getComputedStyle(el).fontSize, color: getComputedStyle(el).color,
                right: el.closest('.mapstudio-needs-row').getBoundingClientRect().right - el.getBoundingClientRect().right }));
            expect(look.size).toBe('12px');
            expect(look.right).toBeLessThanOrEqual(16);
            await shot(page, 'mapstudio-needs-distance-1366.png');
            await bar.click();
            // No position: no distances, no switch, and the same order.
            await page.locator('#mapstudio-locate-off').click();
            await expect(page.locator('.mapstudio-map')).toHaveAttribute('data-you-are-here', 'off', { timeout: BIND_MS });
            await bar.click();
            await expect(rows.first()).toBeVisible();
            await expect(page.locator('.mapstudio-needs-distance')).toHaveCount(0);
            expect(await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-item-id')))).toEqual(withPosition);
            await bar.click();
            await page.locator('.mapstudio-search-chevron').click();
            await expect(page.locator('.mapstudio-search-panel')).toBeVisible();
            await expect(page.locator('.mapstudio-search-order')).toHaveCount(0);
            await expect(page.locator('.mapstudio-search-distance')).toHaveCount(0);
            expect(watched.errors).toEqual([]);
        } finally {
            await context.close();
        }
    });

    test('Units: en-GB reads kilometres and metres where en-US reads miles and feet; an override redraws the open list', async ({ browser }) => {
        const { context, page, map } = await openPage(browser, '/locate', { locale: 'en-GB' });
        try {
            await expect(map).toHaveAttribute('data-units', 'metric');
            await page.locator('.mapstudio-search-chevron').click();
            await page.locator('.mapstudio-search-order-button[data-order="nearest"]').click();
            const first = page.locator('.mapstudio-search-option').first();
            await expect(first).toHaveAttribute('data-item-id', ids.ctb1);
            await expect(first.locator('.mapstudio-search-distance')).toHaveText('430 m');
            for (const w of await page.locator('.mapstudio-search-distance').allTextContents()) {
                expect(w).toMatch(/^(\d+ m|\d+(\.\d)? km)$/);
            }
            // An override set by another session while Nearest is open (entry 20a): the list is drawn again in it, no reload.
            const reloads = await map.getAttribute('data-map-reloads');
            await asEditor(browser, (editor) => setUnits(editor, { system: 'us', labels: 'long' }));
            await expect(first.locator('.mapstudio-search-distance')).toHaveText('1,420 feet', { timeout: BIND_MS });
            await expect(map).toHaveAttribute('data-units', 'us');
            await expect(map).toHaveAttribute('data-unit-labels', 'long');
            await expect(page.locator('.mapstudio-search-panel')).toHaveAttribute('data-order', 'nearest');
            await asEditor(browser, (editor) => clearUnits(editor));
            await expect(first.locator('.mapstudio-search-distance')).toHaveText('430 m', { timeout: BIND_MS });
            await expect(map).toHaveAttribute('data-units', 'metric');
            expect(await map.getAttribute('data-map-reloads')).toBe(reloads);
        } finally {
            await asEditor(browser, (editor) => clearUnits(editor));
            await context.close();
        }
    });
});

test.describe('390 px', () => {
    test('Sheet and Apple: an iPhone agent, the sheet\'s footer at 44 px with no Edit, the Apple route with the name', async ({ browser }) => {
        const { context, page, map, watched } = await openPage(browser, '/locate', { userAgent: AGENTS.iphone, viewport: { width: 390, height: 844 } });
        try {
            const popup = await openPoint1(page, map, sheet(page));
            await expect(popup.locator('[data-part="footer"]')).toHaveAttribute('data-buttons', '2', { timeout: INTERVAL_MS });
            await expect(popup.locator('.mapstudio-popup-edit')).toHaveCount(0);
            const buttons = await footerButtons(popup);
            expect(buttons.map((b) => b.text)).toEqual(['Directions', 'View alarms']);
            expect(Math.round(buttons[0].h)).toBe(44);
            expect(Math.round(buttons[1].h)).toBe(44);
            expect(Math.abs(buttons[0].w - buttons[1].w)).toBeLessThanOrEqual(1);
            await popup.locator('[data-part="footer"]').scrollIntoViewIfNeeded();
            await shot(page, 'mapstudio-directions-sheet-390.png');
            await popup.locator('.mapstudio-popup-directions').click();
            expect(await opened(page)).toEqual([{ url: APPLE_P1, target: '_blank', features: 'noopener' }]);
            expect(watched.errors).toEqual([]);
        } finally {
            await context.close();
        }
    });

    test('Nearest and Needs you at 390 px: the switch a 44 px target, distances on the rows', async ({ browser }) => {
        const { context, page, watched } = await openPage(browser, '/locate', { viewport: { width: 390, height: 844 } });
        try {
            await page.locator('.mapstudio-search-chevron').click();
            const nearest = page.locator('.mapstudio-search-order-button[data-order="nearest"]');
            const box = await nearest.boundingBox();
            expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
            await nearest.click();
            await expect(page.locator('.mapstudio-search-option')).toHaveCount(10);
            await expect(page.locator('.mapstudio-search-option').first().locator('.mapstudio-search-distance')).toHaveText('1,420 ft');
            await shot(page, 'mapstudio-nearest-390.png');
            await page.keyboard.press('Escape');
            const bar = page.locator('.mapstudio-needs');
            await expect(bar).toHaveAttribute('data-count', /^[1-9]/, { timeout: INTERVAL_MS });
            await bar.click();
            const rows = page.locator('.mapstudio-needs-row');
            await expect(rows.first()).toBeVisible();
            await expect(page.locator('.mapstudio-needs-row .mapstudio-needs-distance')).toHaveCount(await rows.count());
            await shot(page, 'mapstudio-needs-distance-390.png');
            expect(watched.errors).toEqual([]);
        } finally {
            await context.close();
        }
    });
});
