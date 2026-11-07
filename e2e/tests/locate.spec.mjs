// You are here and Locate me (epic 4 entry 15; the plan's I/O matrix), on the dev page /locate as the map editor at 1366 and
// 390 px: the map's userLocation is bound in one binding to {session.props.geolocation}, the view's startup script turns
// the session's location on, a "Location off" checkbox turns it off and on, and a label shows the bound value. Chromium is
// given the position (Playwright's geolocation permission and position, a CDP override for a heading), and Perspective's
// client writes it into the session; nothing in Map Studio asks the browser for it.
//
// On 8.3.10 a browser session's `geolocation.permissionGranted` stays null after a position arrives: the client writes it
// only on a watch error (false, for any error) and from the Perspective mobile app's "native/gpsPermission" message
// (docs/platform-checks.md, "Epic 4 entry 15"). By the plan's rule a position counts only with permissionGranted true, so the
// suite stands in for the mobile app's grant through the client's own bridge (`window.__webInterface.submitData`), and its
// "not granted" the same way; the plain browser's own path (a position with permissionGranted null; a denial, which turns
// the session's location off) is checked as it is.
//
// Matrix: Fix (the dot, its ring and a 40 m circle near CTB1, the legend row, Locate me active), Locate me (the map panned
// away, centred on the position at zoom 15 or more), Heading (the wedge for heading 90), Moves (the marker follows a new
// position, the camera stays), Denied, Off and No fix (no marker, no row, Locate me off with its reason), Not an item (no
// list row, search result or selection), Phone (the same at 390 px, a 44 px Locate me, the legend sheet's row). The spec
// saves nothing.

import { EDITOR_USER, ensureSeeded, expect, mapLoaded, openMap, shot, signedInContext, test, view, watch } from './fixtures.mjs';

/** Near CTB1 (-105.012, 39.7262), about 430 m north-east of it, clear of every seeded item. */
const YOU = { latitude: 39.729, longitude: -105.0085, accuracy: 40 };
/** The same, moved about 110 m north. */
const MOVED = { latitude: 39.73, longitude: -105.0085, accuracy: 25 };
/** Far from the position: the dev field's south-west at zoom 12. */
const AWAY = { center: [-105.08, 39.68], zoom: 12 };
/** The position in the middle at zoom 16: the dot and the 40 m circle large enough to click and see. */
const NEAR = { center: [YOU.longitude, YOU.latitude], zoom: 16 };
/** How long the client's position and the page's writes take to reach the map's binding on the dev stack. */
const BIND_MS = 20_000;

const WORDS = {
    fix: 'Locate me',
    off: 'Locate me - location is off for this session',
    denied: 'Locate me - location permission not granted',
    nofix: 'Locate me - no location fix yet'
};

const locate = (page) => page.locator('.mapstudio-locate-button');
const value = (page) => page.locator('#mapstudio-locate-value');

test.beforeAll(async ({ browser }) => {
    await ensureSeeded(browser);
});

/**
 * /locate as the map editor in its own context: Chromium granted the position (`position`, or none with `browserGrant`
 * false), a heading set through CDP, or with `noFix` a browser that never answers the watch (a device still waiting for a
 * fix). With `grant` the mobile app's grant is stood in for once the position has reached the binding. The caller closes
 * the context.
 */
async function openLocate(browser, { position = YOU, heading, browserGrant = true, noFix = false, grant = true, viewport } = {}) {
    const options = viewport ? { viewport, deviceScaleFactor: 1 } : { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 };
    if (browserGrant) {
        options.permissions = ['geolocation'];
        if (!noFix && heading === undefined) {
            options.geolocation = position;
        }
    }
    const context = await signedInContext(browser, EDITOR_USER, options);
    if (noFix) {
        // A device still waiting for its first fix: the watch is started and never answered.
        await context.addInitScript(() => {
            navigator.geolocation.watchPosition = () => 1;
            navigator.geolocation.clearWatch = () => undefined;
        });
    }
    const page = await context.newPage();
    const watched = watch(page);
    if (heading !== undefined) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setGeolocationOverride', { ...position, heading, speed: 1 });
    }
    const map = await openMap(page, '/locate');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    if (browserGrant && !noFix) {
        // The browser's position in the session, through the one binding.
        await expect(value(page)).toContainText('"latitude":' + position.latitude, { timeout: BIND_MS });
        await expect(value(page)).toContainText('"enabled":true');
    }
    if (grant) {
        await mobileGrant(page, true);
    }
    return { context, page, map, watched };
}

/** The Perspective mobile app's permission message, through the client's own bridge (the browser alone never sends it). */
async function mobileGrant(page, granted) {
    await page.waitForFunction(() => Boolean(window.__webInterface));
    await page.evaluate((g) => window.__webInterface.submitData({ type: 'native/gpsPermission', data: { granted: g } }), granted);
    await expect(value(page)).toContainText('"permissionGranted":' + granted, { timeout: BIND_MS });
}

/** Locate me's state: its words in its title and accessible description, active or inert. */
async function expectLocate(page, state) {
    await expect(locate(page)).toHaveAttribute('data-locate', state, { timeout: BIND_MS });
    await expect(locate(page)).toHaveAttribute('title', WORDS[state]);
    await expect(locate(page)).toHaveAttribute('aria-description', WORDS[state]);
    await expect(locate(page)).toHaveAttribute('aria-label', 'Locate me');
    await expect(locate(page)).toHaveAttribute('aria-disabled', state === 'fix' ? 'false' : 'true');
}

/** The legend panel opened from its button (View mode), and the rows of its States. */
async function legendStates(page) {
    if (!(await page.locator('.mapstudio-legend-panel').isVisible())) {
        await page.locator('.mapstudio-legend-button').click();
    }
    await expect(page.locator('.mapstudio-legend-panel')).toBeVisible();
    return page.locator('.mapstudio-legend-panel .mapstudio-legend-section--states .mapstudio-legend-key-words').allTextContents();
}

/** The marker as MapLibre drew it: `dot,accuracy,wedge`, each 0 or 1 (`data-you-drawn`, published at idle). */
async function expectDrawn(map, drawn) {
    await expect(map).toHaveAttribute('data-you-drawn', drawn, { timeout: BIND_MS });
}

function centerOf(attr) {
    return attr.split(',').map(Number);
}

/** The Location off checkbox pressed: the session's location turned off, or on again. */
async function toggleLocation(page) {
    await page.locator('#mapstudio-locate-off').click();
}

test.describe('1366 px', () => {
    test('Fix: the dot with its ring and a 40 m circle near CTB1, the legend row, Locate me active', async ({ browser }) => {
        const { context, page, map, watched } = await openLocate(browser);
        try {
            await expect(map).toHaveAttribute('data-you-are-here', 'fix', { timeout: BIND_MS });
            await expect(map).toHaveAttribute('data-you-at', JSON.stringify([YOU.longitude, YOU.latitude]));
            await expect(map).toHaveAttribute('data-you-accuracy', '40');
            await expect(map).toHaveAttribute('data-you-heading', '');
            await view(page, map, NEAR.center, NEAR.zoom);
            await expectDrawn(map, '1,1,0');
            await expectLocate(page, 'fix');
            // Locate me is the zoom card's last button, after Return, a 32 px target with a mouse.
            const last = await page.locator('.mapstudio-zoom .mapstudio-ctrl-button').last().getAttribute('class');
            expect(last).toContain('mapstudio-locate-button');
            const box = await locate(page).boundingBox();
            expect(Math.round(box.width)).toBe(32);
            expect(Math.round(box.height)).toBe(32);
            const states = await legendStates(page);
            expect(states[states.length - 1]).toBe('You are here');
            await shot(page, 'mapstudio-locate-fix-1366.png');
            expect(watched.errors).toEqual([]);
        } finally {
            await context.close();
        }
    });

    test('Locate me: with the map panned away, it centres the map on the position at zoom 15, or keeps a closer zoom', async ({ browser }) => {
        const { context, page, map, watched } = await openLocate(browser);
        try {
            await expectLocate(page, 'fix');
            await view(page, map, AWAY.center, AWAY.zoom);
            await locate(page).click();
            await expect(map).toHaveAttribute('data-zoom', '15.00', { timeout: BIND_MS });
            await expect.poll(async () => {
                const [lng, lat] = centerOf(await map.getAttribute('data-center'));
                return Math.abs(lng - YOU.longitude) < 0.0005 && Math.abs(lat - YOU.latitude) < 0.0005;
            }, { timeout: BIND_MS }).toBe(true);
            await expectDrawn(map, '1,1,0');
            // Closer already: the zoom stays.
            await view(page, map, [YOU.longitude + 0.003, YOU.latitude], 17);
            await locate(page).click();
            await expect.poll(async () => Math.abs(centerOf(await map.getAttribute('data-center'))[0] - YOU.longitude) < 0.0002,
                { timeout: BIND_MS }).toBe(true);
            await expect(map).toHaveAttribute('data-zoom', '17.00');
            await shot(page, 'mapstudio-locate-pressed-1366.png');
            expect(watched.errors).toEqual([]);
        } finally {
            await context.close();
        }
    });

    test('Heading: a heading of 90 draws the wedge from the dot, pointing east', async ({ browser }) => {
        const { context, page, map, watched } = await openLocate(browser, { heading: 90 });
        try {
            await expect(map).toHaveAttribute('data-you-are-here', 'fix', { timeout: BIND_MS });
            await expect(map).toHaveAttribute('data-you-heading', '90');
            await view(page, map, NEAR.center, NEAR.zoom);
            await expectDrawn(map, '1,1,1');
            await shot(page, 'mapstudio-locate-heading-1366.png');
            expect(watched.errors).toEqual([]);
        } finally {
            await context.close();
        }
    });

    test('Moves: a new position moves the marker and leaves the camera where it is', async ({ browser }) => {
        const { context, page, map, watched } = await openLocate(browser);
        try {
            await expect(map).toHaveAttribute('data-you-are-here', 'fix', { timeout: BIND_MS });
            await view(page, map, NEAR.center, NEAR.zoom);
            const center = await map.getAttribute('data-center');
            // Chromium fails a running watch when its position is changed under it (POSITION_UNAVAILABLE, and the client turns
            // the location off), so the location goes off and on around the move, as a device's next fix arrives.
            await toggleLocation(page);
            await expectLocate(page, 'off');
            await context.setGeolocation(MOVED);
            await toggleLocation(page);
            await expect(value(page)).toContainText('"latitude":' + MOVED.latitude, { timeout: BIND_MS });
            await expect(map).toHaveAttribute('data-you-at', JSON.stringify([MOVED.longitude, MOVED.latitude]), { timeout: BIND_MS });
            await expect(map).toHaveAttribute('data-you-accuracy', '25');
            await expectLocate(page, 'fix');
            await expect(map).toHaveAttribute('data-center', center);
            await expect(map).toHaveAttribute('data-zoom', NEAR.zoom.toFixed(2));
            expect(watched.errors).toEqual([]);
        } finally {
            await context.close();
        }
    });

    test('Denied: permission not granted draws no marker and no legend row; Locate me off, "location permission not granted"', async ({ browser }) => {
        const { context, page, map, watched } = await openLocate(browser);
        try {
            await expect(map).toHaveAttribute('data-you-are-here', 'fix', { timeout: BIND_MS });
            await mobileGrant(page, false);
            await expect(map).toHaveAttribute('data-you-are-here', 'denied', { timeout: BIND_MS });
            await expectLocate(page, 'denied');
            await view(page, map, NEAR.center, NEAR.zoom);
            await expectDrawn(map, '0,0,0');
            expect(await legendStates(page)).not.toContain('You are here');
            await shot(page, 'mapstudio-locate-denied-1366.png');
            expect(watched.errors).toEqual([]);
        } finally {
            await context.close();
        }
    });

    test('a plain browser: its position reaches the binding with permissionGranted null, and a denial turns the location off', async ({ browser }) => {
        // As 8.3.10 has it (docs/platform-checks.md): a granted browser alone gives a position but no grant, so by the rule Locate
        // me says "permission not granted"; a browser that refuses fails the watch and the client turns the location off.
        const granted = await openLocate(browser, { grant: false });
        try {
            await expect(value(granted.page)).toContainText('"permissionGranted":null');
            await expectLocate(granted.page, 'denied');
            await expectDrawn(granted.map, '0,0,0');
        } finally {
            await granted.context.close();
        }
        const refused = await openLocate(browser, { browserGrant: false, grant: false });
        try {
            await expect(value(refused.page)).toContainText('"enabled":false', { timeout: BIND_MS });
            await expect(value(refused.page)).toContainText('"permissionGranted":false');
            await expectLocate(refused.page, 'off');
            expect(refused.watched.errors).toEqual([]);
        } finally {
            await refused.context.close();
        }
    });

    test('Off: the session\'s location turned off removes the marker and the row; Locate me off, "location is off for this session"', async ({ browser }) => {
        const { context, page, map, watched } = await openLocate(browser);
        try {
            await expect(map).toHaveAttribute('data-you-are-here', 'fix', { timeout: BIND_MS });
            await view(page, map, NEAR.center, NEAR.zoom);
            await toggleLocation(page);
            await expect(value(page)).toContainText('"enabled":false', { timeout: BIND_MS });
            await expect(map).toHaveAttribute('data-you-are-here', 'off');
            await expectLocate(page, 'off');
            await expectDrawn(map, '0,0,0');
            expect(await legendStates(page)).not.toContain('You are here');
            // Inert: a press moves nothing (aria-disabled, so the click is forced past Playwright's enabled check).
            const center = await map.getAttribute('data-center');
            await locate(page).click({ force: true });
            await expect(map).toHaveAttribute('data-center', center);
            await expect(map).toHaveAttribute('data-zoom', NEAR.zoom.toFixed(2));
            expect(watched.errors).toEqual([]);
        } finally {
            await context.close();
        }
    });

    test('No fix: enabled and granted with no position yet draws no marker; "no location fix yet"', async ({ browser }) => {
        const { context, page, map, watched } = await openLocate(browser, { noFix: true });
        try {
            await expect(value(page)).toContainText('"latitude":null');
            await expect(value(page)).toContainText('"enabled":true');
            await expect(map).toHaveAttribute('data-you-are-here', 'nofix', { timeout: BIND_MS });
            await expectLocate(page, 'nofix');
            await expectDrawn(map, '0,0,0');
            expect(watched.errors).toEqual([]);
        } finally {
            await context.close();
        }
    });

    test('Not an item: a click on the marker selects nothing; it is in no list row, search result or Needs you count', async ({ browser }) => {
        const { context, page, map, watched } = await openLocate(browser);
        try {
            await expect(map).toHaveAttribute('data-you-are-here', 'fix', { timeout: BIND_MS });
            const items = await map.getAttribute('data-items-loaded');
            await view(page, map, NEAR.center, NEAR.zoom);
            await expectDrawn(map, '1,1,0');
            // The dot is at the map's centre.
            const box = await map.boundingBox();
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            await page.waitForTimeout(1000);
            await expect(map).toHaveAttribute('data-selected', '');
            await expect(page.locator('.maplibregl-popup')).toHaveCount(0);
            await expect(map).toHaveAttribute('data-items-loaded', items);
            // The search knows nothing of it.
            await page.locator('.mapstudio-search-input').fill('You are here');
            await expect(page.locator('.mapstudio-search-option')).toHaveCount(0);
            await page.locator('.mapstudio-search-input').fill('');
            await page.keyboard.press('Escape');
            // Edit mode: the item list has no row for it; the rail's Legend tab ends its States with the row.
            await page.locator('.mapstudio-edit-switch-button').click();
            await expect(map).toHaveAttribute('data-mode', 'edit');
            await expect(page.locator('.mapstudio-list-row').first()).toBeVisible();
            await expect(page.locator('.mapstudio-list-row', { hasText: 'You are here' })).toHaveCount(0);
            await page.locator('.mapstudio-rail-item[data-surface="layers"]').click();
            await page.locator('.mapstudio-dock--layers [role="tab"][data-tab="legend"]').click();
            const docked = page.locator('.mapstudio-dock--layers .mapstudio-legend-dock .mapstudio-legend-section--states .mapstudio-legend-key-words');
            await expect(docked.last()).toHaveText('You are here');
            // Edit mode draws the marker too, and Locate me is on the zoom card there.
            await expectDrawn(map, '1,1,0');
            await expectLocate(page, 'fix');
            await shot(page, 'mapstudio-locate-edit-1366.png');
            expect(watched.errors).toEqual([]);
        } finally {
            await context.close();
        }
    });
});

test.describe('390 px', () => {
    test('Phone: the marker drawn, Locate me a 44 px target that centres on the position, the legend sheet\'s row', async ({ browser }) => {
        const { context, page, map, watched } = await openLocate(browser, { viewport: { width: 390, height: 844 } });
        try {
            await expect(map).toHaveAttribute('data-you-are-here', 'fix', { timeout: BIND_MS });
            await expectLocate(page, 'fix');
            const box = await locate(page).boundingBox();
            expect(Math.round(box.width)).toBe(44);
            expect(Math.round(box.height)).toBe(44);
            await view(page, map, AWAY.center, AWAY.zoom);
            await locate(page).click();
            await expect(map).toHaveAttribute('data-zoom', '15.00', { timeout: BIND_MS });
            await expectDrawn(map, '1,1,0');
            const states = await legendStates(page);
            await expect(page.locator('.mapstudio-legend-panel')).toHaveClass(/mapstudio-legend-panel--sheet/);
            expect(states[states.length - 1]).toBe('You are here');
            await shot(page, 'mapstudio-locate-phone-390.png');
            await page.locator('.mapstudio-legend-panel .mapstudio-legend-close, .mapstudio-legend-panel [aria-label="Close"]').first().click();
            // Off at phone width: inert, its reason in words.
            await toggleLocation(page);
            await expectLocate(page, 'off');
            expect(watched.errors).toEqual([]);
        } finally {
            await context.close();
        }
    });
});
