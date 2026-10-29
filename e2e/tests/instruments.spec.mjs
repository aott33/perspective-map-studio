// Instruments on lines (epic 2 story 14), live: the I/O matrix of the plan through the
// component's real session path (window.__mapStudioTest, web/typescript/testHook.ts) and
// system.mapstudio.applyEdits (the /edit page's "Run script checks"). The batches are fixed
// JSON: the points are where Turf 7.4.0 puts each distance on the line (web/typescript/geometry.ts,
// the same numbers as its unit tests), rounded to 6 decimals as the Gateway stores them.

import { randomUUID } from 'node:crypto';
import {
    EDITOR_USER, OPERATOR_USER, editorTest, expect, mapLoaded, openMap, send, signedInContext
} from './fixtures.mjs';

/** L-SWD of the plan: 2,922.35 m; PT-1 at 1,143 m and PT-2 at 2,841 m. */
const SWD = [[-103.52, 31.92], [-103.505, 31.9205], [-103.490423, 31.926]];
const PT1_AT = [-103.507899, 31.920404];
const PT2_AT = [-103.491211, 31.925703];
/** L-SWD with its middle vertex 200 m north; the instruments at their nearest places on it. */
const SWD_RESHAPED = [[-103.52, 31.92], [-103.505, 31.9223], [-103.490423, 31.926]];
const PT1_RESHAPED = { at: [-103.508198, 31.92181], distanceM: 1131.9 };
const PT2_RESHAPED = { at: [-103.491243, 31.925792], distanceM: 2793.8 };

async function load(page) {
    const reply = await send(page, 'map.load', {});
    expect(reply.type, JSON.stringify(reply.body)).toBe('map.load.reply');
    return reply.body;
}

const batch = (...ops) => ({ batchId: randomUUID(), ops });
const point = (c) => ({ type: 'Point', coordinates: c });
const lineGeometry = (c) => ({ type: 'LineString', coordinates: c });
const create = (id, data, baseVersion = 0) => ({ op: 'create', entity: 'item', id, baseVersion, data });
const update = (id, baseVersion, data) => ({ op: 'update', entity: 'item', id, baseVersion, data });
const del = (id, baseVersion) => ({ op: 'delete', entity: 'item', id, baseVersion });
const tap = (name, at, lineId, distanceM) => ({ kind: 'tap', name, geometry: point(at),
    attachment: { lineId, distanceM } });

function saved(reply) {
    expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
    return reply.body;
}

function refused(reply, code) {
    expect(reply.type, JSON.stringify(reply.body)).toBe('error');
    expect(reply.body.code, reply.body.message).toBe(code);
    return reply.body;
}

function version(body, id) {
    return body.results.find((r) => r.id === id).version;
}

async function openEditor(page) {
    const map = await openMap(page, '/edit');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', 'full');
}

/** A fresh L-SWD with PT-1 and PT-2 on it, saved instruments first in one batch; returns the ids and seq. */
async function saveLine(page) {
    const ids = { line: randomUUID(), pt1: randomUUID(), pt2: randomUUID() };
    const body = saved(await send(page, 'edits.apply', batch(
        create(ids.pt1, tap('PT-1', PT1_AT, ids.line, 1143)),
        create(ids.pt2, tap('PT-2', PT2_AT, ids.line, 2841)),
        create(ids.line, { kind: 'line', name: 'L-SWD', geometry: lineGeometry(SWD) }))));
    expect(body.results.map((r) => r.version)).toEqual([1, 1, 1]);
    return { ...ids, seq: body.seq };
}

editorTest.describe('instruments on lines', () => {
    editorTest.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    editorTest('an instrument is saved with its attachment and map.load returns it unchanged', async ({ page }) => {
        await openEditor(page);
        const before = await load(page);
        expect(before.kinds.find((k) => k.id === 'tap')).toMatchObject({ geometry: 'point', instrument: true });
        const ids = await saveLine(page);
        const items = (await load(page)).items;
        const pt1 = items.find((i) => i.id === ids.pt1);
        expect(pt1.attachment).toEqual({ lineId: ids.line, distanceM: 1143 });
        expect(pt1.geometry).toEqual(point(PT1_AT));
        expect(items.find((i) => i.id === ids.line).attachment).toBeNull();
    });

    editorTest('a bad attachment is refused, naming the instrument and the line, and nothing is saved',
        async ({ page }) => {
            await openEditor(page);
            const ids = await saveLine(page);
            const seq = (await load(page)).seq;
            let e = refused(await send(page, 'edits.apply', batch(create(randomUUID(), { kind: 'pad', name: 'P-bad',
                geometry: point(PT1_AT), attachment: { lineId: ids.line, distanceM: 1143 } }))), 'invalid');
            expect(e.message).toMatch(/attachment: kind pad is not an instrument kind/);
            e = refused(await send(page, 'edits.apply', batch(update(ids.pt1, 1, { geometry: point(SWD[2]),
                attachment: { lineId: ids.line, distanceM: 2924 } }))), 'invalid');
            expect(e.message).toContain('instrument PT-1 is at 2,924.0 m along line L-SWD, past its end (the line is'
                + ' 2,922.4 m long).');
            expect(e.op).toEqual({ index: 0, id: ids.pt1 });
            e = refused(await send(page, 'edits.apply', batch(update(ids.pt1, 1,
                { geometry: point([PT1_AT[0], PT1_AT[1] + 0.000045]) }))), 'invalid');
            expect(e.message).toMatch(/instrument PT-1 is [45]\.\d m from its place on line L-SWD \(1,143\.0 m along it\)/);
            e = refused(await send(page, 'edits.apply', batch(update(ids.pt1, 1,
                { attachment: { lineId: ids.pt2, distanceM: 0 } }))), 'invalid');
            expect(e.message).toContain('instrument PT-1 is attached to PT-2, which is a point, not a line.');
            e = refused(await send(page, 'edits.apply', batch(update(ids.pt1, 1,
                { attachment: { lineId: ids.line, distanceM: -1 } }))), 'invalid');
            expect(e.message).toContain('attachment.distanceM must be 0 or more');
            expect((await load(page)).seq).toBe(seq);
        });

    editorTest('a line moved or deleted without its instruments is refused; with them it is one batch',
        async ({ page }) => {
            await openEditor(page);
            const ids = await saveLine(page);
            const seq = (await load(page)).seq;
            let e = refused(await send(page, 'edits.apply', batch(update(ids.line, 1,
                { geometry: lineGeometry(SWD_RESHAPED) }))), 'invalid');
            expect(e.message).toBe(`Op 0 (${ids.line}): line L-SWD has 2 instruments (PT-1, PT-2) this save does not`
                + ' move or delete. Send each instrument\'s new place in the same save. Nothing in this save was written.');
            e = refused(await send(page, 'edits.apply', batch(del(ids.line, 1))), 'invalid');
            expect(e.message).toContain('line L-SWD has 2 instruments (PT-1, PT-2) this save does not move or delete.'
                + ' Delete its instruments in the same save.');
            expect((await load(page)).seq).toBe(seq);
            // A rename needs no instruments.
            saved(await send(page, 'edits.apply', batch(update(ids.line, 1, { name: 'L-SWD' }))));
            // The reshape with both instruments at their nearest places: one seq for three ops.
            const body = saved(await send(page, 'edits.apply', batch(
                update(ids.pt2, 1, { geometry: point(PT2_RESHAPED.at),
                    attachment: { lineId: ids.line, distanceM: PT2_RESHAPED.distanceM } }),
                update(ids.line, 2, { geometry: lineGeometry(SWD_RESHAPED) }),
                update(ids.pt1, 1, { geometry: point(PT1_RESHAPED.at),
                    attachment: { lineId: ids.line, distanceM: PT1_RESHAPED.distanceM } }))));
            expect(body.seq).toBe(seq + 2);
            expect(body.results.map((r) => r.version)).toEqual([2, 3, 2]);
            const items = (await load(page)).items;
            expect(items.find((i) => i.id === ids.pt1).attachment.distanceM).toBe(1131.9);
        });

    editorTest('deleting a line deletes its instruments in one seq, and the reverse batch restores all three',
        async ({ page }) => {
            await openEditor(page);
            const ids = await saveLine(page);
            const before = (await load(page)).items.filter((i) => [ids.line, ids.pt1, ids.pt2].includes(i.id));
            const gone = saved(await send(page, 'edits.apply', batch(del(ids.line, 1), del(ids.pt1, 1), del(ids.pt2, 1))));
            expect(gone.results).toHaveLength(3);
            expect(gone.results.map((r) => r.version)).toEqual([2, 2, 2]);
            const live = (await load(page)).items.map((i) => i.id);
            expect(live).not.toContain(ids.line);
            expect(live).not.toContain(ids.pt1);
            expect(live).not.toContain(ids.pt2);
            // The shape web/typescript/undo.ts reverseBatch gives (a create at each tombstone's version with every
            // record field), built here by hand; reverseBatch's own output goes through the write path in
            // WriteServiceBatchReplayTest.java (fixture from web/typescript/__tests__/batch-replay.test.ts).
            const reverse = batch(...before.reverse().map((r) => create(r.id, {
                kind: r.kind, name: r.name, geometry: r.geometry, properties: r.properties, assetId: r.assetId,
                overrides: r.overrides, ends: r.ends, attachment: r.attachment }, version(gone, r.id))));
            const back = saved(await send(page, 'edits.apply', reverse));
            expect(back.seq).toBe(gone.seq + 1);
            expect(back.results.map((r) => r.version)).toEqual([3, 3, 3]);
            const items = (await load(page)).items;
            expect(items.find((i) => i.id === ids.pt2).attachment).toEqual({ lineId: ids.line, distanceM: 2841 });
            expect(items.find((i) => i.id === ids.line).geometry).toEqual(lineGeometry(SWD));
            // Recorded for docs/platform-checks.md: the psql query lists these seqs.
            console.log(`instruments.spec: delete seq ${gone.seq}, restore seq ${back.seq}, line ${ids.line}`);
        });

    editorTest('an instrument changed by another editor refuses the whole line batch as a conflict', async ({ page }) => {
        await openEditor(page);
        const ids = await saveLine(page);
        saved(await send(page, 'edits.apply', batch(update(ids.pt1, 1, { properties: { tag: '[default]SWD/PT1' } }))));
        const seq = (await load(page)).seq;
        const e = refused(await send(page, 'edits.apply', batch(
            update(ids.line, 1, { geometry: lineGeometry(SWD_RESHAPED) }),
            update(ids.pt1, 1, { geometry: point(PT1_RESHAPED.at),
                attachment: { lineId: ids.line, distanceM: PT1_RESHAPED.distanceM } }),
            update(ids.pt2, 1, { geometry: point(PT2_RESHAPED.at),
                attachment: { lineId: ids.line, distanceM: PT2_RESHAPED.distanceM } }))), 'conflict');
        expect(e.conflicts).toHaveLength(1);
        expect(e.conflicts[0].current).toMatchObject({ id: ids.pt1, version: 2 });
        expect((await load(page)).seq).toBe(seq);
    });

    editorTest('a line kind takes its look from its instruments; a pad may not', async ({ page }) => {
        await openEditor(page);
        const setups = (await load(page)).kindSetups;
        const op = (kindId, setup, tombstone) => {
            const current = setups.find((s) => s.kindId === kindId);
            if (current) {
                return { op: 'update', entity: 'kindSetup', id: kindId, baseVersion: current.version, data: { setup } };
            }
            // A create, or the restore of a deleted one at its tombstone's version.
            return { op: 'create', entity: 'kindSetup', id: kindId, baseVersion: tombstone ?? 0, data: { setup } };
        };
        const worst = { styleRule: { source: { instruments: 'worst' } } };
        const e = refused(await send(page, 'edits.apply', batch(op('pad', worst))), 'invalid');
        expect(e.message).toContain('styleRule.source: pad is a point kind');
        let reply = await send(page, 'edits.apply', batch(op('line', worst)));
        if (reply.type === 'error' && reply.body.code === 'conflict') {
            reply = await send(page, 'edits.apply', batch(op('line', worst, reply.body.conflicts[0].current.version)));
        }
        const body = saved(reply);
        const stored = (await load(page)).kindSetups.find((s) => s.kindId === 'line');
        expect(stored.setup).toEqual(worst);
        // Put back the line kind setup another spec saved (kindsetup.spec.mjs); otherwise leave this one
        // live, so a later create-or-update of the line kind setup finds it.
        const before = setups.find((s) => s.kindId === 'line');
        if (before) {
            saved(await send(page, 'edits.apply', batch({ op: 'update', entity: 'kindSetup', id: 'line',
                baseVersion: body.results[0].version, data: { setup: before.setup } })));
        }
    });

    editorTest('a phone editor may not move an instrument but may change its properties', async ({ page, browser }) => {
        await openEditor(page);
        const ids = await saveLine(page);
        const context = await signedInContext(browser, OPERATOR_USER, { viewport: { width: 390, height: 844 } });
        try {
            const phone = await context.newPage();
            const map = await openMap(phone, '/edit');
            await mapLoaded(map);
            await expect(map).toHaveAttribute('data-edit-level', 'phone');
            let e = refused(await send(phone, 'edits.apply', batch(update(ids.pt1, 1, { geometry: point(PT2_AT) }))),
                'role');
            expect(e.message).toBe('An instrument moves along its line; only full editing can move it. Nothing in this'
                + ' save was written.');
            e = refused(await send(phone, 'edits.apply', batch(update(ids.pt1, 1, { geometry: point(PT1_AT),
                attachment: { lineId: ids.line, distanceM: 1143 } }))), 'role');
            expect(e.message).toMatch(/^An instrument moves along its line/);
            saved(await send(phone, 'edits.apply', batch(update(ids.pt1, 1, { properties: { tag: 'PT-1 phone' } }))));
        } finally {
            await context.close();
        }
    });

    editorTest('system.mapstudio.applyEdits saves an instrument that getMap returns with its attachment',
        async ({ page }) => {
            await openEditor(page);
            await page.locator('#mapstudio-dev-script-checks').click();
            const out = page.locator('#mapstudio-dev-script-results');
            await expect(out).toContainText('"results"', { timeout: 60_000 });
            const result = JSON.parse(await out.innerText());
            const byName = Object.fromEntries(result.results.map((r) => [r.name, r]));
            expect(byName.instrumentSave.ok, JSON.stringify(byName.instrumentSave)).toBe(true);
            expect(byName.instrumentFromGetMap.value).toEqual({ tap: { lineId: result.lineId, distanceM: 1143 },
                line: null });
            expect(byName.instrumentLineDeleteAlone.ok).toBe(false);
            expect(byName.instrumentLineDeleteAlone.error)
                .toMatch(/^invalid: Op 0 \(.*\): line Script check L-SWD has 1 instrument \(Script check PT-1\)/);
        });
});
