// The edit record read by edits.history (epic-editing entry 11a), live: the plan's I/O matrix H1 to H6 and H8
// through the component's real session path (window.__mapStudioTest, web/typescript/testHook.ts). The map editor and
// the phone editor each move a pad (two editors, two actors); a viewer is refused. Every item a test makes is deleted
// at its end, so the map other specs count is unchanged (their edit rows stay: the record keeps every change).

import { randomUUID } from 'node:crypto';
import { e2eProject } from '../lib/env.mjs';
import {
    EDITOR_USER, OPERATOR_USER, editorTest, expect, mapLoaded, openMap, send, signedInContext, test, saved, del, update, batch, point, sql, create,
    refused
} from './fixtures.mjs';

/** L-SWD of instruments.spec: PT-1 at 1,143 m and PT-2 at 2,841 m, the points Turf puts there. */
const SWD = [[-103.52, 31.92], [-103.505, 31.9205], [-103.490423, 31.926]];
const PT1_AT = [-103.507899, 31.920404];
const PT2_AT = [-103.491211, 31.925703];
const ISO_SECOND = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;

/** One page of the record as `page`'s session reads it. */
async function history(page, body = {}) {
    const reply = await send(page, 'edits.history', body);
    expect(reply.type, JSON.stringify(reply.body)).toBe('edits.history.reply');
    return reply.body;
}

async function openEditor(page) {
    const map = await openMap(page, '/edit');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', 'full');
}

async function openOperator(browser) {
    const context = await signedInContext(browser, OPERATOR_USER, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const map = await openMap(page, '/edit');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + OPERATOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', 'phone');
    return { context, page };
}

editorTest.describe('recent changes: the edit record', () => {
    editorTest.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    editorTest('two editors move P14 and P31: newest first, each with its actor, time and coordinates (H1, H3)',
        async ({ page, browser }) => {
            await openEditor(page);
            const operator = await openOperator(browser);
            const p14 = randomUUID();
            const p31 = randomUUID();
            const at14 = [-104.9712, 39.7431];
            const at31 = [-104.9688, 39.7442];
            try {
                saved(await send(page, 'edits.apply', batch(
                    create(p14, { kind: 'pad', name: 'History P14', geometry: point(at14) }),
                    create(p31, { kind: 'pad', name: 'History P31', geometry: point(at31) }))));
                const moved14 = [-104.9713, 39.7432];
                const moved31 = [-104.9689, 39.7443];
                saved(await send(page, 'edits.apply', batch(update(p14, 1, { geometry: point(moved14) }))));
                const last = saved(await send(operator.page, 'edits.apply', batch(update(p31, 1, { geometry: point(moved31) }))));

                for (const reader of [page, operator.page]) {
                    const { entries } = await history(reader, { limit: 3 });
                    const [b, a, made] = entries;
                    expect(b.seq).toBe(last.seq);
                    expect(b).toMatchObject({ actor: OPERATOR_USER, source: 'session' });
                    expect(b.at).toMatch(ISO_SECOND);
                    expect(b.ops).toEqual([{ op: 'update', entity: 'item', id: p31, name: 'History P31', kind: 'pad',
                        version: 2, before: { geometry: point(at31) }, after: { geometry: point(moved31) } }]);
                    expect(a).toMatchObject({ seq: last.seq - 1, actor: EDITOR_USER, source: 'session' });
                    expect(a.ops).toEqual([{ op: 'update', entity: 'item', id: p14, name: 'History P14', kind: 'pad',
                        version: 2, before: { geometry: point(at14) }, after: { geometry: point(moved14) } }]);
                    // H2's create: after only, the written record.
                    expect(made.ops.map((o) => o.id)).toEqual([p14, p31]);
                    expect(made.ops[0].before).toBeNull();
                    expect(made.ops[0].after).toMatchObject({ id: p14, name: 'History P14', version: 1, deleted: false });
                }
            } finally {
                const items = (await send(page, 'map.load', {})).body.items.filter((i) => i.id === p14 || i.id === p31);
                if (items.length) {
                    saved(await send(page, 'edits.apply', batch(...items.map((i) => del(i.id, i.version)))));
                }
                await operator.context.close();
            }
        });

    editorTest('a line deleted with its two instruments is one entry of three deletes, each with before (H2)',
        async ({ page }) => {
            await openEditor(page);
            const ids = { line: randomUUID(), pt1: randomUUID(), pt2: randomUUID() };
            saved(await send(page, 'edits.apply', batch(
                create(ids.pt1, { kind: 'tap', name: 'PT-1', geometry: point(PT1_AT), attachment: { lineId: ids.line, distanceM: 1143 } }),
                create(ids.pt2, { kind: 'tap', name: 'PT-2', geometry: point(PT2_AT), attachment: { lineId: ids.line, distanceM: 2841 } }),
                create(ids.line, { kind: 'line', name: 'L-SWD history', geometry: { type: 'LineString', coordinates: SWD } }))));
            const gone = saved(await send(page, 'edits.apply', batch(del(ids.pt1, 1), del(ids.pt2, 1), del(ids.line, 1))));
            const { entries } = await history(page, { limit: 1 });
            expect(entries).toHaveLength(1);
            expect(entries[0].seq).toBe(gone.seq);
            expect(entries[0].ops.map((o) => [o.op, o.id, o.name, o.kind, o.version])).toEqual([
                ['delete', ids.pt1, 'PT-1', 'tap', 2], ['delete', ids.pt2, 'PT-2', 'tap', 2],
                ['delete', ids.line, 'L-SWD history', 'line', 2]]);
            for (const o of entries[0].ops) {
                expect(o.after).toBeNull();
                expect(o.before).toMatchObject({ id: o.id, version: 1, deleted: false });
            }
            expect(entries[0].ops[0].before.attachment).toEqual({ lineId: ids.line, distanceM: 1143 });
        });

    editorTest('pages of 50 then the rest before the last seq; a bad limit or before is invalid; a refused batch leaves no entry (H4, H8)',
        async ({ page }) => {
            await openEditor(page);
            const pad = randomUUID();
            let version = 1;
            const first = saved(await send(page, 'edits.apply', batch(
                create(pad, { kind: 'pad', name: 'History pages 0', geometry: point([-104.9701, 39.7425]) }))));
            for (let i = 1; i < 60; i++) {
                saved(await send(page, 'edits.apply', batch(update(pad, version, { name: 'History pages ' + i }))));
                version++;
            }
            const one = await history(page, { limit: 50 });
            expect(one.entries).toHaveLength(50);
            expect(one.more).toBe(true);
            expect(one.entries[0].seq).toBe(first.seq + 59);
            const fiftieth = one.entries[49].seq;
            expect(fiftieth).toBe(first.seq + 10);
            const two = await history(page, { before: fiftieth, limit: 10 });
            expect(two.entries.map((e) => e.seq)).toEqual(Array.from({ length: 10 }, (_, i) => first.seq + 9 - i));
            expect(two.entries[9].ops[0]).toMatchObject({ op: 'create', id: pad, name: 'History pages 0' });
            expect(two.entries[0].ops[0]).toMatchObject({ before: { name: 'History pages 8' }, after: { name: 'History pages 9' } });

            for (const body of [{ limit: 0 }, { limit: 51 }, { before: 'x' }, { before: 1.5 }]) {
                refused(await send(page, 'edits.history', body), 'invalid');
            }

            // H8: a stale save is refused and leaves the record as it was.
            const top = (await history(page, { limit: 1 })).entries[0];
            refused(await send(page, 'edits.apply', batch(update(pad, 1, { name: 'History stale' }))), 'conflict');
            expect((await history(page, { limit: 1 })).entries[0]).toEqual(top);

            saved(await send(page, 'edits.apply', batch(del(pad, version))));
        });

    editorTest('a row from before schema 3 reads null values and the stored record\'s name and kind (H7, the SQL path)',
        async ({ page }) => {
            await openEditor(page);
            const pad = randomUUID();
            const oldBatch = randomUUID();
            const made = saved(await send(page, 'edits.apply', batch(
                create(pad, { kind: 'pad', name: 'History old row', geometry: point([-104.9703, 39.7427]) }))));
            saved(await send(page, 'edits.apply', batch(update(pad, 1, { name: 'History old row, renamed' }))));
            // A row as schema 2 wrote it (no before, after, name or kind), at the project's next seq, so no batch shares it.
            const project = e2eProject();
            const seq = Number(sql("WITH s AS (UPDATE mapstudio_project SET seq = seq + 1 WHERE project = '" + project
                + "' RETURNING seq) INSERT INTO mapstudio_edit (project, batch_id, seq, entity, entity_id, op, version, actor,"
                + " source) SELECT '" + project + "', '" + oldBatch + "', s.seq, 'item', '" + pad + "', 'update', 2,"
                + " 'schema2-actor', 'script' FROM s RETURNING seq"));
            try {
                expect(seq).toBe(made.seq + 2);
                const { entries } = await history(page, { limit: 3 });
                expect(entries[0]).toMatchObject({ seq, batchId: oldBatch, actor: 'schema2-actor', source: 'script' });
                expect(entries[0].at).toMatch(ISO_SECOND);
                expect(entries[0].ops).toEqual([{ op: 'update', entity: 'item', id: pad, name: 'History old row, renamed',
                    kind: 'pad', version: 2, before: null, after: null }]);
                // The rows written by this build keep the name as written, beside the old one.
                expect(entries[1].ops[0]).toMatchObject({ id: pad, name: 'History old row, renamed',
                    before: { name: 'History old row' }, after: { name: 'History old row, renamed' } });
            } finally {
                sql("DELETE FROM mapstudio_edit WHERE batch_id = '" + oldBatch + "'");
                saved(await send(page, 'edits.apply', batch(del(pad, 2))));
            }
        });

    editorTest('a page stops before the batch that would take it past 1,000 ops, and holds it whole and alone next (H5)',
        async ({ page }) => {
            await openEditor(page);
            const many = Array.from({ length: 1000 }, () => randomUUID());
            const big = saved(await send(page, 'edits.apply', batch(...many.map((id, i) => create(id, {
                kind: 'pad', name: 'History bulk ' + i, geometry: point([-104.90 - (i % 40) * 0.0005, 39.70 - Math.floor(i / 40) * 0.0005])
            })))));
            const pad = randomUUID();
            saved(await send(page, 'edits.apply', batch(create(pad, { kind: 'pad', name: 'History small 0', geometry: point([-104.9702, 39.7426]) }))));
            for (let v = 1; v < 40; v++) {
                saved(await send(page, 'edits.apply', batch(update(pad, v, { name: 'History small ' + v }))));
            }
            try {
                const one = await history(page, {});
                expect(one.entries).toHaveLength(40);
                expect(one.more).toBe(true);
                expect(one.entries[39].seq).toBe(big.seq + 1);
                const two = await history(page, { before: one.entries[39].seq });
                expect(two.entries[0].seq).toBe(big.seq);
                expect(two.entries[0].ops).toHaveLength(1000);
                expect(two.entries).toHaveLength(1);
            } finally {
                saved(await send(page, 'edits.apply', batch(...many.map((id) => del(id, 1)))));
                saved(await send(page, 'edits.apply', batch(del(pad, 40))));
            }
        });
});

test.describe('recent changes: a viewer', () => {
    test('a viewer is refused role and learns no names (H6)', async ({ page }) => {
        const map = await openMap(page, '/');
        await mapLoaded(map);
        await expect(map).toHaveAttribute('data-edit-level', 'none');
        const reply = await send(page, 'edits.history', {});
        expect(reply.type).toBe('error');
        expect(reply.body.code).toBe('role');
        expect(JSON.stringify(reply)).not.toContain(EDITOR_USER);
        expect(reply.body).not.toHaveProperty('entries');
    });
});
