// The first-run checklist and the viewer's note (epic 4 entry 7b; DESIGN.md first-run-checklist, key screen 8; EXPERIENCE.md
// First-run checklist, Surface states) on the dev Gateway's empty project, mapstudio-empty (ops/project mounted a second time,
// ops/docker-compose.yml), at 1366 px as the map editor and as a viewer, and the card at 1200 px. The plan's matrix: on the
// empty map in Edit mode the card is centred on the stage with the project's name and "0 of 3 done"; Open Kinds opens the
// rail's Kinds surface and a kind setup saved by script (the /empty page's button, system.mapstudio.applyEdits) ticks step 1
// live, its delete unticks it, and one saved from the Kinds screen itself ticks it again (entry 12a); Open view mode leaves Edit mode with the note shown, and back in Edit mode step 3 is ticked;
// Add an item arms the Point tool and hides the card while it is in hand, a click places a pad and the card is gone for good;
// Hide checklist holds over a reload, and Esc does not hide the card while its buttons are in the tab order; a viewer sees the
// empty map and "Nothing on this map yet."; the seeded dev map shows neither. The spec keeps the empty map empty: every item
// and kind setup of mapstudio-empty is deleted through the test hook before each editor test and after the spec.

import { randomUUID } from 'node:crypto';
import { EMPTY_PROJECT } from '../lib/editorAuth.mjs';
import { EDITOR_USER, ensureSeeded, expect, mapLoaded, openMap, send, shot, signedInContext, test, watch, REPLY_MS, INSET } from './fixtures.mjs';

/** The App Bar clearance kept at the stage's bottom-right corner (DESIGN.md spacing app-bar-clearance). */
const APP_BAR_CLEARANCE = 76;
const NOTE = 'Nothing on this map yet.';

/** Delete every item and kind setup of the empty map, as the editor through the test hook (one batch). Returns how many went. */
async function clearEmpty(page) {
    const load = await send(page, 'map.load', {});
    expect(load.type).toBe('map.load.reply');
    const ops = [
        ...load.body.items.filter((i) => !i.deleted).map((i) => ({ op: 'delete', entity: 'item', id: i.id, baseVersion: i.version })),
        ...(load.body.kindSetups || []).filter((k) => !k.deleted)
            .map((k) => ({ op: 'delete', entity: 'kindSetup', id: k.kindId, baseVersion: k.version }))
    ];
    if (ops.length === 0) {
        return 0;
    }
    const reply = await send(page, 'edits.apply', { batchId: randomUUID(), ops });
    expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
    return ops.length;
}

/** A context signed in as the map editor on the empty project, its /empty page open with the empty map loaded. */
async function openEmptyEditor(browser, viewport = { width: 1366, height: 768 }) {
    const context = await signedInContext(browser, EDITOR_USER, { viewport, deviceScaleFactor: 1 }, EMPTY_PROJECT);
    const page = await context.newPage();
    const watched = watch(page);
    let map = await openMap(page, '/empty', EMPTY_PROJECT);
    await expect(page.locator('#mapstudio-empty-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    if (await clearEmpty(page) > 0) {
        // A fresh page, so nothing of the cleared map (the undo stack, Just added) is left in this one.
        map = await openMap(page, '/empty', EMPTY_PROJECT);
        await mapLoaded(map);
    }
    await expect(map).toHaveAttribute('data-items-loaded', '0');
    await expect(map).toHaveAttribute('data-studio', 'on');
    return { context, page, map, watched };
}

/** Press one of the /empty page's kind setup buttons and return its result (ranAt tells this press from the last). */
async function pressKind(page, which) {
    const out = page.locator('#mapstudio-empty-kind-result');
    const before = await out.innerText();
    await page.locator('#mapstudio-empty-kind-' + which).click();
    await expect.poll(async () => {
        const text = await out.innerText();
        return text !== before && /"ranAt"/.test(text);
    }, { timeout: REPLY_MS }).toBe(true);
    return JSON.parse(await out.innerText());
}

async function finish(context, page, watched) {
    try {
        await clearEmpty(page);
    } finally {
        await context.close();
    }
    expect(watched.errors, 'browser console and page errors').toEqual([]);
}

/** The card's box inside the stage's, centred, clear of the stage's edges and of the App Bar corner. */
async function expectCentred(page) {
    const card = await page.locator('.mapstudio-firstrun').boundingBox();
    const stage = await page.locator('.mapstudio-stage').boundingBox();
    expect(card.width).toBeLessThanOrEqual(400);
    expect(card.x).toBeGreaterThanOrEqual(stage.x + INSET - 1);
    expect(card.x + card.width).toBeLessThanOrEqual(stage.x + stage.width - INSET + 1);
    expect(card.y).toBeGreaterThanOrEqual(stage.y);
    expect(card.y + card.height).toBeLessThanOrEqual(stage.y + stage.height);
    expect(Math.abs(card.x + card.width / 2 - (stage.x + stage.width / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(card.y + card.height / 2 - (stage.y + stage.height / 2))).toBeLessThanOrEqual(1);
    const corner = { x: stage.x + stage.width - APP_BAR_CLEARANCE, y: stage.y + stage.height - APP_BAR_CLEARANCE };
    expect(card.x + card.width <= corner.x || card.y + card.height <= corner.y, 'clear of the App Bar corner').toBe(true);
    return card;
}

test.describe('the first-run checklist on the empty map, 1366 px', () => {
    test.afterAll(async ({ browser }) => {
        const { context, page, watched } = await openEmptyEditor(browser);
        await finish(context, page, watched);
    });

    test('empty: the card centred with the project\'s name and 0 of 3 done; the list says No items yet', async ({ browser }) => {
        const { context, page, watched } = await openEmptyEditor(browser);
        try {
            const card = page.locator('.mapstudio-firstrun');
            await expect(card).toHaveCount(1);
            await expect(card.locator('.mapstudio-firstrun-title')).toHaveText('Get ' + EMPTY_PROJECT + ' on the map');
            await expect(card).toContainText('Three steps. Edits save as you go.');
            await expect(card.locator('.mapstudio-firstrun-label')).toHaveText(['Set up your kinds', 'Add or import items', 'Check the operator view']);
            await expect(card.locator('.mapstudio-firstrun-action')).toHaveText(['Open Kinds', 'Add an item', 'Open view mode']);
            await expect(card.locator('.mapstudio-firstrun-step').first()).toContainText(/for the \d+ kinds? this project defines\./);
            await expect(card.locator('.mapstudio-firstrun-count')).toHaveText('0 of 3 done');
            await expect(card.locator('.mapstudio-firstrun-hide')).toHaveText('Hide checklist');
            await expect(page.locator('.mapstudio-dialog, [role="dialog"]')).toHaveCount(0);
            await expect(page.locator('.mapstudio-empty-note')).toHaveCount(0);
            await expect(page.locator('.mapstudio-list-empty')).toContainText('No items yet');
            await expect(page.locator('.mapstudio-list-empty')).toContainText('Items you add or import are listed here, grouped by place.');
            await expectCentred(page);
            await shot(page, 'mapstudio-firstrun-1366.png');
        } finally {
            await finish(context, page, watched);
        }
    });

    test('kinds: Open Kinds opens the Kinds surface; a kind setup saved by script ticks step 1 live, its delete unticks it', async ({ browser }) => {
        const { context, page, map, watched } = await openEmptyEditor(browser);
        try {
            const card = page.locator('.mapstudio-firstrun');
            const step1 = card.locator('.mapstudio-firstrun-step[data-step="1"]');
            await expect(step1).toHaveAttribute('data-done', 'false');
            await card.getByRole('button', { name: 'Open Kinds' }).click();
            await expect(map).toHaveAttribute('data-surface', 'kinds');
            await expect(page.locator('.mapstudio-dock[data-surface="kinds"]')).toHaveCount(1);
            await expect(card).toHaveCount(1);
            const saved = await pressKind(page, 'save');
            expect(saved.error, JSON.stringify(saved)).toBeUndefined();
            expect(saved.saved).toBe('created');
            await expect(step1).toHaveAttribute('data-done', 'true', { timeout: REPLY_MS });
            await expect(step1.locator('.mapstudio-firstrun-check')).toHaveCount(1);
            await expect(card.locator('.mapstudio-firstrun-count')).toHaveText('1 of 3 done');
            await shot(page, 'mapstudio-firstrun-kinds-1366.png');
            const deleted = await pressKind(page, 'delete');
            expect(deleted.deleted, JSON.stringify(deleted)).toBe(true);
            await expect(step1).toHaveAttribute('data-done', 'false', { timeout: REPLY_MS });
            await expect(card.locator('.mapstudio-firstrun-count')).toHaveText('0 of 3 done');
            // Entry 12a (matrix K9): a kind with no setup, saved from the Kinds screen as a create, ticks step 1 too. The first kind
            // of the list is open in the properties panel's place; its Link typed and finished is its first setup.
            const kindSetup = page.locator('.mapstudio-kindsetup');
            await expect(page.locator('.mapstudio-kind-row').first()).toHaveAttribute('aria-current', 'true');
            await expect(kindSetup).toHaveAttribute('data-kind', 'pad');
            await expect(kindSetup).toHaveAttribute('data-version', '0');
            const link = kindSetup.locator('[data-field="link"] input[type="text"]');
            await link.fill('/pad/{item.name}');
            await link.press('Enter');
            await expect(step1).toHaveAttribute('data-done', 'true', { timeout: REPLY_MS });
            await expect(card.locator('.mapstudio-firstrun-count')).toHaveText('1 of 3 done');
            await expect(kindSetup).toHaveAttribute('data-saving', '');
            const stored = (await send(page, 'map.load', {})).body.kindSetups.find((k) => k.kindId === 'pad' && !k.deleted);
            expect(stored.setup).toEqual({ link: '/pad/{item.name}' });
            await expect(kindSetup).toHaveAttribute('data-version', String(stored.version));
        } finally {
            await finish(context, page, watched);
        }
    });

    test('view: Open view mode leaves Edit mode with the note; back in Edit mode step 3 is ticked', async ({ browser }) => {
        const { context, page, map, watched } = await openEmptyEditor(browser);
        try {
            await page.locator('.mapstudio-firstrun').getByRole('button', { name: 'Open view mode' }).click();
            await expect(map).toHaveAttribute('data-mode', 'view');
            await expect(page.locator('.mapstudio-firstrun')).toHaveCount(0);
            await expect(page.locator('.mapstudio-empty-note')).toHaveText(NOTE);
            await page.locator('.mapstudio-edit-switch-button').click();
            await expect(map).toHaveAttribute('data-mode', 'edit');
            await expect(page.locator('.mapstudio-empty-note')).toHaveCount(0);
            const card = page.locator('.mapstudio-firstrun');
            await expect(card.locator('.mapstudio-firstrun-step[data-step="3"]')).toHaveAttribute('data-done', 'true');
            await expect(card.locator('.mapstudio-firstrun-count')).toHaveText('1 of 3 done');
        } finally {
            await finish(context, page, watched);
        }
    });

    test('add: Add an item arms the Point tool and hides the card; a click places a pad and the card is gone', async ({ browser }) => {
        const { context, page, map, watched } = await openEmptyEditor(browser);
        try {
            await page.locator('.mapstudio-firstrun').getByRole('button', { name: 'Add an item' }).click();
            await expect(map).toHaveAttribute('data-tool', 'point');
            await expect(page.locator('.mapstudio-firstrun')).toHaveCount(0);
            // Put down (the drawing bar's Done) and picked up again: the card is back while nothing is in hand.
            await page.locator('.mapstudio-drawing-done').click();
            await expect(map).toHaveAttribute('data-tool', '');
            await expect(page.locator('.mapstudio-firstrun')).toHaveCount(1);
            await page.locator('.mapstudio-firstrun').getByRole('button', { name: 'Add an item' }).click();
            await expect(map).toHaveAttribute('data-tool', 'point');
            const box = await map.boundingBox();
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', /.+/, { timeout: REPLY_MS });
            await expect(map).toHaveAttribute('data-save-state', 'saved', { timeout: REPLY_MS });
            await page.locator('.mapstudio-drawing-done').click();
            await expect(map).toHaveAttribute('data-tool', '');
            await expect(page.locator('.mapstudio-firstrun')).toHaveCount(0);
            await expect(page.locator('.mapstudio-empty-note')).toHaveCount(0);
            await expect(page.locator('.mapstudio-list-row')).toHaveCount(1);
        } finally {
            await finish(context, page, watched);
        }
    });

    test('hide: Esc does not hide the card and its buttons are in the tab order; Hide checklist holds over a reload', async ({ browser }) => {
        const { context, page, watched } = await openEmptyEditor(browser);
        try {
            const card = page.locator('.mapstudio-firstrun');
            await card.getByRole('button', { name: 'Open Kinds' }).focus();
            await page.keyboard.press('Tab');
            await expect(card.getByRole('button', { name: 'Add an item' })).toBeFocused();
            await page.keyboard.press('Tab');
            await expect(card.getByRole('button', { name: 'Open view mode' })).toBeFocused();
            await page.keyboard.press('Tab');
            await expect(card.getByRole('button', { name: 'Hide checklist' })).toBeFocused();
            await page.keyboard.press('Escape');
            await expect(card).toHaveCount(1);
            await page.keyboard.press('Enter');
            await expect(card).toHaveCount(0);
            await page.reload({ waitUntil: 'load' });
            const map = page.locator('.mapstudio-map');
            await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 60_000 });
            await mapLoaded(map);
            await expect(map).toHaveAttribute('data-studio', 'on');
            await expect(page.locator('.mapstudio-list-empty')).toContainText('No items yet');
            await expect(page.locator('.mapstudio-firstrun')).toHaveCount(0);
        } finally {
            await finish(context, page, watched);
        }
    });

    test('viewer: the empty map and "Nothing on this map yet.", no card and no Edit switch', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
        const page = await context.newPage();
        const watched = watch(page);
        try {
            const map = await openMap(page, '/empty', EMPTY_PROJECT);
            await expect(page.locator('#mapstudio-empty-user')).toContainText('Not signed in');
            await mapLoaded(map);
            await expect(map).toHaveAttribute('data-items-loaded', '0');
            await expect(map).toHaveAttribute('data-mode', 'view');
            await expect(page.locator('.mapstudio-firstrun')).toHaveCount(0);
            await expect(page.locator('.mapstudio-edit-switch')).toHaveCount(0);
            const note = page.locator('.mapstudio-empty-note');
            await expect(note).toHaveText(NOTE);
            const box = await note.boundingBox();
            const stage = await page.locator('.mapstudio-stage').boundingBox();
            expect(Math.abs(box.x + box.width / 2 - (stage.x + stage.width / 2))).toBeLessThanOrEqual(1);
            expect(Math.abs(box.y + box.height / 2 - (stage.y + stage.height / 2))).toBeLessThanOrEqual(1);
            await shot(page, 'mapstudio-firstrun-viewer-1366.png');
        } finally {
            await context.close();
        }
        expect(watched.errors, 'browser console and page errors').toEqual([]);
    });

    test('seeded: the dev map in Edit mode shows no card and in View mode no note', async ({ browser }) => {
        await ensureSeeded(browser);
        const context = await signedInContext(browser, EDITOR_USER, { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
        const page = await context.newPage();
        const watched = watch(page);
        try {
            const map = await openMap(page, '/edit');
            await mapLoaded(map);
            await expect(map).toHaveAttribute('data-studio', 'on');
            await expect(page.locator('.mapstudio-list-row').first()).toBeVisible();
            await expect(page.locator('.mapstudio-firstrun')).toHaveCount(0);
            await expect(page.locator('.mapstudio-empty-note')).toHaveCount(0);
            await page.locator('.mapstudio-edit-switch-button').click();
            await expect(map).toHaveAttribute('data-mode', 'view');
            await expect(page.locator('.mapstudio-empty-note')).toHaveCount(0);
            await expect(page.locator('.mapstudio-firstrun')).toHaveCount(0);
        } finally {
            await context.close();
        }
        expect(watched.errors, 'browser console and page errors').toEqual([]);
    });
});

test.describe('the first-run checklist at 1200 px', () => {
    test('the card fits the narrower map, centred', async ({ browser }) => {
        const { context, page, map, watched } = await openEmptyEditor(browser, { width: 1200, height: 768 });
        try {
            await expect(map).toHaveAttribute('data-list', 'collapsed');
            await expect(page.locator('.mapstudio-firstrun')).toHaveCount(1);
            await expectCentred(page);
            await shot(page, 'mapstudio-firstrun-1200.png');
        } finally {
            await finish(context, page, watched);
        }
    });
});
