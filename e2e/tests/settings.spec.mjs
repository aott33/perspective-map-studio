// Edit mode's units override in the map store (epic-editing entry 19b, R27; map store schema 4), live on the dev stack: the
// settings entity through edits.apply (the component's real session path, window.__mapStudioTest), since no browser control
// sends one until entry 20. The plan's S1 to S10 with the map editor, a second map editor, the phone editor and an anonymous
// viewer, and S12 and S13 in Recent changes. The browser keeps the value and draws nothing with it: the map carries it for
// tests as data-units-override ("system,labels,version", '' with no override). Each test leaves the store without an override.

import { randomUUID } from 'node:crypto';
import {
    EDITOR2_USER, EDITOR_USER, OPERATOR_USER, editorTest, ensureSeeded, expect, mapLoaded, openMap, send, shot, signedInContext
} from './fixtures.mjs';

const REPLY_MS = 20_000;

const batch = (...ops) => ({ batchId: randomUUID(), ops });
const unitsOp = (op, baseVersion, data) => (data === undefined
    ? { op, entity: 'settings', id: 'units', baseVersion }
    : { op, entity: 'settings', id: 'units', baseVersion, data });

async function load(page) {
    const reply = await send(page, 'map.load', {});
    expect(reply.type, JSON.stringify(reply.body)).toBe('map.load.reply');
    return reply.body;
}

function saved(reply) {
    expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
    return reply.body;
}

function refused(reply, code) {
    expect(reply.type, JSON.stringify(reply.body)).toBe('error');
    expect(reply.body.code, JSON.stringify(reply.body)).toBe(code);
    return reply.body;
}

/** Clear the override when one is live, so the store is as a fresh one reads: settings {}. */
async function clearUnits(page) {
    const units = (await load(page)).settings.units;
    if (units) {
        saved(await send(page, 'edits.apply', batch(unitsOp('delete', units.version))));
    }
}

/**
 * Set the override on a store with none: a create at 0 on a fresh store, else at the cleared setting's version, which the
 * create's conflict reports (a cleared one is not in map.load.reply). Returns the reply's body.
 */
async function firstSet(page, data) {
    const reply = await send(page, 'edits.apply', batch(unitsOp('create', 0, data)));
    if (reply.type === 'edits.apply.reply') {
        return reply.body;
    }
    const conflict = refused(reply, 'conflict');
    expect(conflict.conflicts[0].current).toMatchObject({ id: 'units', deleted: true });
    return saved(await send(page, 'edits.apply', batch(unitsOp('create', conflict.conflicts[0].current.version, data))));
}

async function openEditor(page) {
    const map = await openMap(page, '/edit');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', 'full');
    return map;
}

/** A second browser signed in as `user` on /edit. */
async function openSecond(browser, user, level, viewport) {
    const context = await signedInContext(browser, user, { viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const map = await openMap(page, '/edit');
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', level);
    return { context, page, map };
}

/** Collect the text of every websocket frame the page receives that holds a map.changed. */
function changedFrames(page) {
    const frames = [];
    page.on('websocket', (ws) => {
        ws.on('framereceived', (f) => {
            const text = typeof f.payload === 'string' ? f.payload : f.payload.toString('utf8');
            if (text.includes('map.changed')) {
                frames.push(text);
            }
        });
    });
    return frames;
}

async function openHistory(page) {
    await page.locator('.mapstudio-rail-item[data-surface="history"]').click();
    const panel = page.locator('.mapstudio-history');
    await expect(panel).toBeVisible();
    await expect(panel).not.toHaveAttribute('data-rows', '0', { timeout: REPLY_MS });
    return panel;
}

function row(page, seq) {
    return page.locator('.mapstudio-history-row[data-seq="' + seq + '"]');
}

editorTest.describe('the units override in the map store (entry 19b)', () => {
    editorTest.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, actionTimeout: REPLY_MS });

    editorTest('S1 to S10: set, changed, stale, refused by role and by value, loaded at every level, cleared and set again',
        async ({ page, browser }) => {
            editorTest.setTimeout(300_000);
            const map = await openEditor(page);
            const other = await openSecond(browser, EDITOR2_USER, 'full', { width: 1366, height: 768 });
            const phone = await openSecond(browser, OPERATOR_USER, 'phone', { width: 390, height: 844 });
            const viewerContext = await browser.newContext({
                viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, storageState: { cookies: [], origins: [] }
            });
            try {
                const viewer = await viewerContext.newPage();
                const viewerFrames = changedFrames(viewer);
                const viewerMap = await openMap(viewer, '/');
                await mapLoaded(viewerMap);
                await expect(viewerMap).toHaveAttribute('data-edit-level', 'none');
                const maps = [map, other.map, phone.map, viewerMap];

                // S10: with no override the reply's settings is {} at every level.
                await clearUnits(page);
                for (const p of [page, phone.page, viewer]) {
                    expect((await load(p)).settings).toEqual({});
                }
                for (const m of maps) {
                    await expect(m).toHaveAttribute('data-units-override', '', { timeout: REPLY_MS });
                }

                // S1: the first set; map.changed reaches both editors, the phone editor and the viewer with the record.
                const set = await firstSet(page, { system: 'us', labels: 'long' });
                expect(set.results).toHaveLength(1);
                expect(set.results[0]).toMatchObject({ entity: 'settings', id: 'units' });
                const v1 = set.results[0].version;
                for (const m of maps) {
                    await expect(m).toHaveAttribute('data-units-override', 'us,long,' + v1, { timeout: REPLY_MS });
                    await expect(m).toHaveAttribute('data-store-seq', String(set.seq), { timeout: REPLY_MS });
                }
                // The viewer's frame carries the record in full, and not who set it.
                const frame = viewerFrames.find((f) => f.includes(set.batchId));
                expect(frame, 'the viewer was sent the batch\'s map.changed').toBeTruthy();
                expect(frame).toMatch(/\\*"entity\\*"\s*:\s*\\*"settings\\*"/);
                expect(frame).toMatch(/\\*"system\\*"\s*:\s*\\*"us\\*"/);
                expect(frame).toMatch(/\\*"labels\\*"\s*:\s*\\*"long\\*"/);
                expect(frame).toMatch(/\\*"actor\\*"\s*:\s*\\*"\\*"/);
                expect(frame).not.toContain(EDITOR_USER);

                // S9: any level loads the same record; the setup's own units are untouched.
                for (const p of [page, phone.page, viewer]) {
                    const body = await load(p);
                    expect(body.settings).toEqual({ units: { id: 'units', system: 'us', labels: 'long', version: v1 } });
                    expect(body.setup.units, 'the dev setup\'s units').toBe('metric');
                }

                // S2: the other editor changes it.
                const changed = saved(await send(other.page, 'edits.apply', batch(unitsOp('update', v1, { system: 'metric', labels: 'short' }))));
                const v2 = changed.results[0].version;
                expect(v2).toBe(v1 + 1);
                for (const m of maps) {
                    await expect(m).toHaveAttribute('data-units-override', 'metric,short,' + v2, { timeout: REPLY_MS });
                }

                // S5: a stale version is a conflict naming who and the units setting; nothing is written.
                const seq = (await load(page)).seq;
                const conflict = refused(await send(page, 'edits.apply', batch(unitsOp('update', v1, { system: 'us', labels: 'short' }))), 'conflict');
                expect(conflict.message).toMatch(new RegExp('^The units setting was changed by ' + EDITOR2_USER
                    + ' at \\d\\d:\\d\\d UTC since you loaded it\\. Nothing in this save was written\\.$'));
                expect(conflict.op).toEqual({ index: 0, id: 'units' });
                expect(conflict.conflicts).toHaveLength(1);
                expect(conflict.conflicts[0]).toMatchObject({
                    index: 0, entity: 'settings', id: 'units', baseVersion: v1, changedBy: EDITOR2_USER,
                    current: { id: 'units', system: 'metric', labels: 'short', version: v2, deleted: false }
                });

                // S6: a phone editor and a viewer are refused role.
                for (const p of [phone.page, viewer]) {
                    refused(await send(p, 'edits.apply', batch(unitsOp('update', v2, { system: 'us', labels: 'long' }))), 'role');
                    refused(await send(p, 'edits.apply', batch(unitsOp('delete', v2))), 'role');
                }

                // S7 and S8: a bad value, a missing or extra field, another id, each in words.
                const bad = async (op) => refused(await send(page, 'edits.apply', batch(op)), 'invalid').message;
                expect(await bad(unitsOp('update', v2, { system: 'imperial', labels: 'short' }))).toBe('Op 0 (units): system must be one of auto, metric, us');
                expect(await bad(unitsOp('update', v2, { system: 'us', labels: 'tiny' }))).toBe('Op 0 (units): labels must be one of short, long');
                expect(await bad(unitsOp('update', v2, { system: 'us' }))).toBe('Op 0 (units): labels must be one of short, long');
                expect(await bad(unitsOp('update', v2, { system: 'us', labels: 'long', theme: 'dark' })))
                    .toBe('Op 0 (units): Unknown field theme in the units data; a units op carries system and labels and nothing else.');
                expect(await bad({ op: 'create', entity: 'settings', id: 'theme', baseVersion: 0, data: { system: 'us', labels: 'long' } }))
                    .toBe('Op 0: a settings id must be units.');
                const after = await load(page);
                expect(after.seq, 'no refusal took a seq').toBe(seq);
                expect(after.settings.units).toEqual({ id: 'units', system: 'metric', labels: 'short', version: v2 });

                // S3: cleared, the next load's settings is {} and every open map drops it.
                const cleared = saved(await send(page, 'edits.apply', batch(unitsOp('delete', v2))));
                expect(cleared.results[0].version).toBe(v2 + 1);
                for (const m of maps) {
                    await expect(m).toHaveAttribute('data-units-override', '', { timeout: REPLY_MS });
                }
                expect((await load(viewer)).settings).toEqual({});
                // A change or a create at 0 of a cleared setting is a conflict; S4: a create at its version sets it again.
                refused(await send(page, 'edits.apply', batch(unitsOp('update', v2 + 1, { system: 'us', labels: 'long' }))), 'conflict');
                refused(await send(page, 'edits.apply', batch(unitsOp('create', 0, { system: 'us', labels: 'long' }))), 'conflict');
                const again = saved(await send(page, 'edits.apply', batch(unitsOp('create', v2 + 1, { system: 'auto', labels: 'long' }))));
                expect(again.results[0].version).toBe(v2 + 2);
                for (const m of maps) {
                    await expect(m).toHaveAttribute('data-units-override', 'auto,long,' + (v2 + 2), { timeout: REPLY_MS });
                }
            } finally {
                await clearUnits(page);
                await viewerContext.close();
                await phone.context.close();
                await other.context.close();
            }
        });

    editorTest('S12, S13: Recent changes lists each units change in words with Revert; a Revert after a later change is refused with who',
        async ({ page, browser }) => {
            editorTest.setTimeout(300_000);
            // The seed's items and kind setups, so the first-run checklist is not over the map (a fresh store shows it).
            await ensureSeeded(browser);
            const map = await openEditor(page);
            await expect(map).toHaveAttribute('data-studio', 'on');
            const other = await openSecond(browser, EDITOR2_USER, 'full', { width: 1366, height: 768 });
            try {
                await clearUnits(page);
                const set = await firstSet(page, { system: 'us', labels: 'long' });
                const v1 = set.results[0].version;
                const changed = saved(await send(other.page, 'edits.apply', batch(unitsOp('update', v1, { system: 'metric', labels: 'short' }))));

                // S12: two rows in words, each with Revert, the newest first.
                await openHistory(page);
                await expect(row(page, changed.seq)).toHaveCount(1, { timeout: REPLY_MS });
                await expect(row(page, set.seq).locator('.mapstudio-history-sentence')).toHaveText('Set the units to US, words');
                await expect(row(page, set.seq)).toHaveAttribute('data-actor', EDITOR_USER);
                await expect(row(page, set.seq).locator('.mapstudio-history-revert')).toHaveCount(1);
                await expect(row(page, changed.seq).locator('.mapstudio-history-sentence')).toHaveText('Changed the units to Metric, symbols');
                await expect(row(page, changed.seq)).toHaveAttribute('data-actor', EDITOR2_USER);
                await expect(row(page, changed.seq).locator('.mapstudio-history-revert')).toHaveCount(1);
                await shot(page, 'mapstudio-recent-changes-units-1440.png');

                // S13: Revert of the change is an update at its version with the values before; both browsers take it.
                await row(page, changed.seq).locator('.mapstudio-history-revert').click();
                await expect(map).toHaveAttribute('data-units-override', 'us,long,' + (v1 + 2), { timeout: REPLY_MS });
                await expect(other.map).toHaveAttribute('data-units-override', 'us,long,' + (v1 + 2), { timeout: REPLY_MS });
                await expect(map).toHaveAttribute('data-save-state', 'saved', { timeout: REPLY_MS });
                await expect(map).toHaveAttribute('data-unsaved-count', '0');
                const top = page.locator('.mapstudio-history-row').first();
                await expect(top.locator('.mapstudio-history-sentence'))
                    .toHaveText('Reverted "Changed the units to Metric, symbols"', { timeout: REPLY_MS });
                await expect(top).toHaveAttribute('data-actor', EDITOR_USER);
                // No Undo step comes of it: the toolbar's stack reverses map items only.
                await expect(page.locator('.mapstudio-toolbar .mapstudio-undo')).not.toHaveAttribute('data-step', /units/);

                // Changed since: the same row's Revert is refused as a stale update is, the conflict on the save status row and its card.
                saved(await send(other.page, 'edits.apply', batch(unitsOp('update', v1 + 2, { system: 'auto', labels: 'long' }))));
                await expect(map).toHaveAttribute('data-units-override', 'auto,long,' + (v1 + 3), { timeout: REPLY_MS });
                const seq = (await load(page)).seq;
                await row(page, changed.seq).locator('.mapstudio-history-revert').click();
                const card = page.locator('.mapstudio-save-card');
                await expect(card).toHaveAttribute('data-card', 'conflict', { timeout: REPLY_MS });
                await expect(card.locator('.mapstudio-save-card-title')).toHaveText(`Not saved - conflict with ${EDITOR2_USER}'s change`);
                await expect(card).toContainText(EDITOR2_USER + ' changed the units setting');
                await expect(card).toContainText('Your change, kept here and not saved: the units set to US, words.');
                await expect(map).toHaveAttribute('data-save-code', 'conflict');
                await expect(card).toHaveAttribute('data-on-top', 'false');
                await shot(page, 'mapstudio-recent-changes-units-refused-1440.png');
                expect((await load(page)).seq, 'nothing was saved').toBe(seq);
                await card.locator('.mapstudio-save-card-theirs').click();
                await expect(card).toHaveCount(0, { timeout: REPLY_MS });
                await expect(map).toHaveAttribute('data-unsaved-count', '0');
                await expect(map).toHaveAttribute('data-units-override', 'auto,long,' + (v1 + 3));
            } finally {
                await clearUnits(page);
                await other.context.close();
            }
        });
});
