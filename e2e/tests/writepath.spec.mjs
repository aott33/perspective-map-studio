// The write path's conflicts, retries, deletes and the phone role (epic-map-store-and-data,
// entry 2), live: a map editor and a phone editor, each signed in in their own browser
// context, send edits.apply through the component's real session path with the test hook
// window.__mapStudioTest (web/typescript/testHook.ts). The Gateway decides every save from
// the session user's roles, so the hook adds no right.

import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { screenshotDir } from '../lib/env.mjs';
import {
    EDITOR_USER, OPERATOR_USER, drawLine, editorTest, expect, mapLoaded, nextFrames, openMap, send, signedInContext, watch
} from './fixtures.mjs';

/** Send the same edits.apply body twice at once from the page. */
async function sendTwiceAtOnce(page, body) {
    return page.evaluate((b) => Promise.all([
        window.__mapStudioTest.send('edits.apply', b),
        window.__mapStudioTest.send('edits.apply', b)
    ]), body);
}

/** The project's seq as map.load reports it. */
async function seq(page) {
    const reply = await send(page, 'map.load', {});
    expect(reply.type).toBe('map.load.reply');
    return reply.body.seq;
}

function batch(...ops) {
    return { batchId: randomUUID(), ops };
}

const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });
const line = { type: 'LineString', coordinates: [[-104.99, 39.74], [-104.98, 39.75]] };

function create(id, data) {
    return { op: 'create', entity: 'item', id, baseVersion: 0, data };
}

function update(id, baseVersion, data) {
    return { op: 'update', entity: 'item', id, baseVersion, data };
}

function expectSaved(reply, version) {
    expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
    if (version !== undefined) expect(reply.body.results[0].version).toBe(version);
    return reply.body;
}

function expectRefused(reply, code) {
    expect(reply.type, JSON.stringify(reply.body)).toBe('error');
    expect(reply.body.code).toBe(code);
    return reply.body;
}

/** Open /edit as the phone editor in its own signed-in context at phone width. */
async function openOperator(browser) {
    const context = await signedInContext(browser, OPERATOR_USER, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const watched = watch(page);
    const map = await openMap(page, '/edit');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + OPERATOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', 'phone');
    return { context, page, map, watched };
}

async function openEditor(page) {
    const map = await openMap(page, '/edit');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', 'full');
    return map;
}

editorTest.describe('write path', () => {
    editorTest.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    editorTest('conflicts carry the other editor\'s record; a resent batch saves once; delete then restore',
        async ({ page, browser }, testInfo) => {
            await openEditor(page);
            const operator = await openOperator(browser);
            try {
                // The phone editor changes a point the map editor loaded at version 1.
                const pad = randomUUID();
                expectSaved(await send(page, 'edits.apply', batch(create(pad, {
                    kind: 'pad', name: 'Conflict pad', geometry: point(-104.97, 39.745)
                }))), 1);
                expectSaved(await send(operator.page, 'edits.apply',
                    batch(update(pad, 1, { properties: { operator: 'checked on site' } }))), 2);

                let before = await seq(page);
                const conflict = expectRefused(await send(page, 'edits.apply',
                    batch(update(pad, 1, { geometry: point(-104.96, 39.746) }))), 'conflict');
                expect(conflict.message).toMatch(
                    /^Conflict pad was changed by mapoperator at \d\d:\d\d UTC since you loaded it\. Nothing in this save was written\.$/);
                expect(conflict.op).toEqual({ index: 0, id: pad });
                expect(conflict.conflicts).toHaveLength(1);
                expect(conflict.conflicts[0]).toMatchObject({
                    index: 0, entity: 'item', id: pad, baseVersion: 1, changedBy: OPERATOR_USER
                });
                expect(conflict.conflicts[0].changedAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
                expect(conflict.conflicts[0].current).toMatchObject({
                    id: pad, version: 2, deleted: false, properties: { operator: 'checked on site' }
                });
                expect(await seq(page)).toBe(before);

                // One batch sent twice in turn, then another sent twice at once: one save each.
                const again = batch(update(pad, 2, { name: 'Conflict pad, renamed' }));
                const first = expectSaved(await send(page, 'edits.apply', again), 3);
                expect(expectSaved(await send(page, 'edits.apply', again))).toEqual(first);
                const atOnce = batch(update(pad, 3, { name: 'Conflict pad, renamed twice' }));
                const [a, b] = await sendTwiceAtOnce(page, atOnce);
                expect(expectSaved(a, 4)).toEqual(expectSaved(b));
                expect(a.body.seq).toBe(first.seq + 1);
                expect(await seq(page)).toBe(a.body.seq);

                // The phone editor reusing the map editor's batch id is refused.
                before = await seq(page);
                const reused = expectRefused(await send(operator.page, 'edits.apply', again), 'invalid');
                expect(reused.message).toMatch(/already used/);
                expect(await seq(page)).toBe(before);

                // Delete, then restore at the tombstone's version.
                const restored = randomUUID();
                const name = 'Restore check ' + new Date().toISOString().slice(11, 19);
                testInfo.annotations.push({ type: 'restored item', description: restored });
                expectSaved(await send(page, 'edits.apply', batch(create(restored, { kind: 'line', name, geometry: line }))), 1);
                expectSaved(await send(page, 'edits.apply',
                    batch({ op: 'delete', entity: 'item', id: restored, baseVersion: 1 })), 2);
                let loaded = await send(page, 'map.load', {});
                expect(loaded.body.items.map((i) => i.id)).not.toContain(restored);
                before = loaded.body.seq;
                expectRefused(await send(page, 'edits.apply', batch(update(restored, 2, { name: 'x' }))), 'conflict');
                expectRefused(await send(page, 'edits.apply',
                    batch({ op: 'create', entity: 'item', id: restored, baseVersion: 1, data: { kind: 'line', name, geometry: line } })),
                    'conflict');
                expect(await seq(page)).toBe(before);
                expectSaved(await send(page, 'edits.apply',
                    batch({ op: 'create', entity: 'item', id: restored, baseVersion: 2, data: { kind: 'line', name, geometry: line } })), 3);
                loaded = await send(page, 'map.load', {});
                expect(loaded.body.items.find((i) => i.id === restored)).toMatchObject({ version: 3, deleted: false, name });
                expect(operator.watched.errors).toEqual([]);
            } finally {
                await operator.context.close();
            }
        });

    editorTest('a phone editor moves a point and changes properties, and nothing else',
        async ({ page, browser }) => {
            await openEditor(page);
            const pad = randomUUID();
            const pipe = randomUUID();
            expectSaved(await send(page, 'edits.apply', batch(
                create(pad, { kind: 'pad', name: 'Phone pad', geometry: point(-104.975, 39.744) }),
                create(pipe, { kind: 'line', name: 'Phone line', geometry: line }))), 1);

            const operator = await openOperator(browser);
            try {
                const op = operator.page;
                // A drawn line is a create: refused on the Gateway with the phone role's words.
                await drawLine(op, operator.map);
                const status = op.locator('.mapstudio-save-status');
                await expect(status).toHaveAttribute('data-save-state', 'refused', { timeout: 30_000 });
                await expect(status).toHaveAttribute('data-code', 'role');
                await expect(status).toContainText('Not saved: Phone editing may move a point');
                await nextFrames(op);
                mkdirSync(screenshotDir, { recursive: true });
                await op.screenshot({ path: path.join(screenshotDir, 'mapstudio-store-phone-390.png'), fullPage: false });

                expectSaved(await send(op, 'edits.apply', batch(update(pad, 1, { geometry: point(-104.9745, 39.7442) }))), 2);
                expectSaved(await send(op, 'edits.apply', batch(update(pipe, 1, { properties: { buried: true } }))), 2);

                const before = await seq(op);
                const refusedGeometry = expectRefused(await send(op, 'edits.apply',
                    batch(update(pipe, 2, { geometry: { type: 'LineString', coordinates: [[-104.99, 39.74], [-104.97, 39.76]] } }))),
                    'role');
                expect(refusedGeometry.message).toMatch(/^Phone editing may move a point and change a map item's properties/);
                expectRefused(await send(op, 'edits.apply', batch(update(pad, 2, { name: 'Renamed on a phone' }))), 'role');
                expectRefused(await send(op, 'edits.apply', batch({ op: 'delete', entity: 'item', id: pad, baseVersion: 2 })), 'role');
                expect(await seq(op)).toBe(before);

                const loaded = await send(page, 'map.load', {});
                expect(loaded.body.items.find((i) => i.id === pad)).toMatchObject({
                    version: 2, geometry: { coordinates: [-104.9745, 39.7442] }, name: 'Phone pad'
                });
                expect(loaded.body.items.find((i) => i.id === pipe)).toMatchObject({
                    version: 2, properties: { buried: true }, geometry: line
                });
                expect(operator.watched.errors).toEqual([]);
            } finally {
                await operator.context.close();
            }
        });
});
