// Recent changes, the rail's History surface (epic-editing entry 11b, R18; DESIGN.md Recent changes panel, EXPERIENCE.md Recent
// changes): the plan's matrix B1 to B10 at 1366 px on the dev stack. The map editor's page shows History; the other editor is the
// second dev map editor (mapeditor2) in its own 1366 px browser with History open too, saving through its own session
// (window.__mapStudioTest), so each sees the other's change, its own put back, and the revert listed first. Every item a test makes is gone at its end (its edit rows stay: the record keeps every change).

import { randomUUID } from 'node:crypto';
import { e2eProject } from '../lib/env.mjs';
import {
    EDITOR2_USER, EDITOR_USER, editorTest, ensureSeeded, expect, mapLoaded, openMap, send, shot, signedInContext, REPLY_MS, saved, del, update, batch,
    point, sql, create
} from './fixtures.mjs';

/** The stored record of a map item, or undefined (the map as `page`'s session loads it). */
async function stored(page, id) {
    const reply = await send(page, 'map.load', {});
    return reply.body.items.find((i) => i.id === id && !i.deleted);
}

/** Delete what is left of `ids` at their stored versions. */
async function cleanUp(page, ids) {
    const items = (await send(page, 'map.load', {})).body.items.filter((i) => ids.includes(i.id) && !i.deleted);
    if (items.length > 0) {
        saved(await send(page, 'edits.apply', batch(...items.map((i) => del(i.id, i.version)))));
    }
}

async function openEditor(page) {
    const map = await openMap(page, '/edit');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-studio', 'on');
    return map;
}

/** A second browser signed in as `user` on /edit at 1366 px. */
async function openSecond(browser, user) {
    const context = await signedInContext(browser, user, { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const map = await openMap(page, '/edit');
    await mapLoaded(map);
    return { context, page, map };
}

/** History opened from the rail; the rail item reads active and the dock shows the first page. */
async function openHistory(page) {
    await page.locator('.mapstudio-rail-item[data-surface="history"]').click();
    const panel = page.locator('.mapstudio-history');
    await expect(panel).toBeVisible();
    await expect(page.locator('.mapstudio-rail-item[data-surface="history"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(panel).not.toHaveAttribute('data-rows', '0', { timeout: REPLY_MS });
    return panel;
}

/** The row of the change saved as `seq`. */
function row(page, seq) {
    return page.locator('.mapstudio-history-row[data-seq="' + seq + '"]');
}

const MOVED = (name, dir) => new RegExp('^Moved ' + name + ' about [0-9.,]+ (m|ft|km|mi) ' + dir + '$');

editorTest.describe('recent changes at 1366 px', () => {
    editorTest.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, actionTimeout: REPLY_MS });

    editorTest('B1 to B4, B10: two editors move pads; both browsers list them live; a row expands; Revert puts theirs back and Undo puts it again',
        async ({ page, browser }) => {
            editorTest.setTimeout(300_000);
            const map = await openEditor(page);
            const other = await openSecond(browser, EDITOR2_USER);
            const p14 = randomUUID();
            const p31 = randomUUID();
            const tag = p14.slice(0, 4);
            const n14 = 'Recent P14 ' + tag;
            const n31 = 'Recent P31 ' + tag;
            const at14 = [-104.9712, 39.7431];
            const at31 = [-104.9688, 39.7442];
            const moved14 = [-104.9712, 39.7435];
            const moved31 = [-104.9688, 39.7446];
            try {
                await expect(other.page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR2_USER);
                await expect(other.map).toHaveAttribute('data-edit-level', 'full');
                saved(await send(page, 'edits.apply', batch(
                    create(p14, { kind: 'pad', name: n14, geometry: point(at14) }),
                    create(p31, { kind: 'pad', name: n31, geometry: point(at31) }))));

                // B1: the rail's History opens the surface, docked at 340 px (the owner's option A); in the other browser a click on Saved.
                const panel = await openHistory(page);
                expect(Math.round((await panel.boundingBox()).width)).toBe(340);
                await expect.poll(async () => Math.round((await map.boundingBox()).width), { timeout: 10_000 }).toBe(1366 - 72 - 340);
                await expect(page.locator('.mapstudio-history-next')).toHaveText(/Nothing to undo yet/);
                await expect(page.locator('.mapstudio-history-undo')).toBeDisabled();
                await expect(page.locator('.mapstudio-history-footer'))
                    .toHaveText("Revert undoes that one change, including someone else's, and saves like any edit.");
                await other.page.locator('.mapstudio-panel-save-button').click();
                await expect(other.page.locator('.mapstudio-history')).toBeVisible();

                // B2: A moves P14, B moves P31: B's row first, then A's, each with who and when, live in both browsers.
                const a = saved(await send(page, 'edits.apply', batch(update(p14, 1, { geometry: point(moved14) }))));
                const b = saved(await send(other.page, 'edits.apply', batch(update(p31, 1, { geometry: point(moved31) }))));
                for (const p of [page, other.page]) {
                    await expect(row(p, b.seq)).toHaveCount(1, { timeout: REPLY_MS });
                    await expect(row(p, a.seq)).toHaveCount(1);
                    await expect(row(p, b.seq)).toHaveAttribute('data-actor', EDITOR2_USER);
                    await expect(row(p, a.seq)).toHaveAttribute('data-actor', EDITOR_USER);
                    await expect(row(p, b.seq).locator('.mapstudio-history-sentence')).toHaveText(MOVED(n31, 'north'));
                    await expect(row(p, b.seq).locator('.mapstudio-history-avatar')).toHaveText('M');
                    await expect(row(p, b.seq).locator('.mapstudio-history-meta')).toHaveText(new RegExp('^' + EDITOR2_USER + ' - \\d\\d:\\d\\d$'));
                    const order = await p.locator('.mapstudio-history-row').evaluateAll((rows) => rows.slice(0, 2).map((r) => Number(r.dataset.seq)));
                    expect(order).toEqual([b.seq, a.seq]);
                }
                await shot(page, 'mapstudio-recent-changes-1366.png');

                // B3: the move row expands with Enter to latitude and longitude before and after.
                const summary = row(page, b.seq).locator('.mapstudio-history-summary');
                await summary.focus();
                await page.keyboard.press('Enter');
                await expect(summary).toHaveAttribute('aria-expanded', 'true');
                const field = row(page, b.seq).locator('.mapstudio-history-field[data-label="Location"]');
                await expect(field.locator('.mapstudio-history-before')).toHaveText('39.744200, -104.968800');
                await expect(field.locator('.mapstudio-history-after')).toHaveText('39.744600, -104.968800');
                await shot(page, 'mapstudio-recent-changes-expanded-1366.png');
                await page.keyboard.press('Space');
                await expect(summary).toHaveAttribute('aria-expanded', 'false');

                // B4: A reverts B's move: in B's own browser P31 is put back and the revert is listed first, by A; in A's too.
                await row(page, b.seq).locator('.mapstudio-history-revert').click();
                await expect.poll(async () => {
                    const item = (await other.page.evaluate(() => window.__mapStudioTest.send('map.load', {}))).body.items.find((i) => i.id === p31);
                    return item.geometry.coordinates;
                }, { timeout: REPLY_MS }).toEqual(at31);
                for (const p of [other.page, page]) {
                    const top = p.locator('.mapstudio-history-row').first();
                    await expect(top.locator('.mapstudio-history-sentence')).toHaveText(/^Reverted "Moved Recent P31 /, { timeout: REPLY_MS });
                    await expect(top).toHaveAttribute('data-actor', EDITOR_USER);
                }
                // B10: the note box names the revert, one undo step, as the toolbar's Undo does; its Undo puts B's move back.
                await expect(page.locator('.mapstudio-toolbar .mapstudio-undo')).toHaveAttribute('data-step', /^Undo: revert "Moved Recent P31 /,
                    { timeout: REPLY_MS });
                await expect(page.locator('.mapstudio-history-next-text')).toHaveText(/^Next undo is one step: Undo: revert "Moved Recent P31 /);
                await page.locator('.mapstudio-history-undo').click();
                await expect.poll(async () => (await stored(other.page, p31)).geometry.coordinates, { timeout: REPLY_MS }).toEqual(moved31);
                await expect(map).toHaveAttribute('data-save-state', 'saved', { timeout: REPLY_MS });
                await expect(panel).toBeVisible();
            } finally {
                await cleanUp(page, [p14, p31]);
                await other.context.close();
            }
        });

    editorTest('B5: a Revert after a later change is refused, the conflict card naming who and offering only their version, after a reload too; nothing saved', async ({ page, browser }) => {
        editorTest.setTimeout(240_000);
        const map = await openEditor(page);
        const other = await openSecond(browser, EDITOR2_USER);
        const p31 = randomUUID();
        const name = 'Recent stale ' + p31.slice(0, 4);
        try {
            saved(await send(page, 'edits.apply', batch(create(p31, { kind: 'pad', name, geometry: point([-104.9690, 39.7440]) }))));
            await openHistory(other.page);
            const first = saved(await send(other.page, 'edits.apply', batch(update(p31, 1, { geometry: point([-104.9690, 39.7444]) }))));
            saved(await send(other.page, 'edits.apply', batch(update(p31, 2, { geometry: point([-104.9690, 39.7448]) }))));
            await openHistory(page);
            await expect(row(page, first.seq)).toHaveCount(1, { timeout: REPLY_MS });
            await row(page, first.seq).locator('.mapstudio-history-revert').click();
            const card = page.locator('.mapstudio-save-card');
            await expect(card).toHaveAttribute('data-card', 'conflict', { timeout: REPLY_MS });
            await expect(card.locator('.mapstudio-save-card-title')).toHaveText(`Not saved - conflict with ${EDITOR2_USER}'s change`);
            await expect(map).toHaveAttribute('data-save-code', 'conflict');
            await shot(page, 'mapstudio-recent-changes-refused-1366.png');
            // Nothing saved: the other editor's browser keeps its own last move, and no new row comes.
            expect((await stored(other.page, p31)).geometry.coordinates).toEqual([-104.9690, 39.7448]);
            await expect(other.page.locator('.mapstudio-history-row').first().locator('.mapstudio-history-sentence'))
                .toHaveText(new RegExp('^Moved ' + name + ' '));
            // Entry 12b1 (S11): a refused Revert's card offers only the other editor's version; the reverse put on top would take
            // their later change back unseen. The marker is kept with the queued entry, so it is the same after a reload.
            await expect(card).toHaveAttribute('data-on-top', 'false');
            await expect(card.locator('.mapstudio-save-card-theirs')).toHaveText(`Use ${EDITOR2_USER}'s version`);
            await expect(card.locator('.mapstudio-save-card-ontop')).toHaveCount(0);
            await expect(card.locator('.mapstudio-save-card-actions button')).toHaveCount(1);
            const batchId = await card.getAttribute('data-batch-id');
            await openEditor(page);
            await expect(card).toHaveAttribute('data-card', 'conflict', { timeout: REPLY_MS });
            await expect(card).toHaveAttribute('data-batch-id', batchId);
            await expect(card).toHaveAttribute('data-on-top', 'false');
            await expect(card.locator('.mapstudio-save-card-ontop')).toHaveCount(0);
            await expect(card.locator('.mapstudio-save-card-actions button')).toHaveText([`Use ${EDITOR2_USER}'s version`]);
            expect((await stored(page, p31)).geometry.coordinates).toEqual([-104.9690, 39.7448]);
            await card.locator('.mapstudio-save-card-theirs').click();
            await expect(card).toHaveCount(0, { timeout: REPLY_MS });
            await expect(map).toHaveAttribute('data-unsaved-count', '0');
        } finally {
            await cleanUp(page, [p31]);
            await other.context.close();
        }
    });

    editorTest('B6: a 1,000-op batch is one row "... in one change"; its Revert is one batch and one undo step', async ({ page }) => {
        editorTest.setTimeout(300_000);
        const map = await openEditor(page);
        const many = Array.from({ length: 1000 }, () => randomUUID());
        try {
            const big = saved(await send(page, 'edits.apply', batch(...many.map((id, i) => create(id, {
                kind: 'pad', name: 'Recent bulk ' + i, geometry: point([-104.90 - (i % 40) * 0.0005, 39.70 - Math.floor(i / 40) * 0.0005])
            })))));
            await openHistory(page);
            const bigRow = row(page, big.seq);
            await expect(bigRow).toHaveCount(1, { timeout: REPLY_MS });
            await expect(bigRow.locator('.mapstudio-history-sentence')).toHaveText(/^Added 1000 [a-z ]+ in one change$/);
            await bigRow.locator('.mapstudio-history-revert').click();
            await expect(page.locator('.mapstudio-toolbar .mapstudio-undo')).toHaveAttribute('data-step', /^Undo: revert "Added 1000 /,
                { timeout: 60_000 });
            await expect.poll(async () => (await send(page, 'map.load', {})).body.items.filter((i) => many.includes(i.id) && !i.deleted).length,
                { timeout: 60_000 }).toBe(0);
            await expect(map).toHaveAttribute('data-save-state', 'saved');
            await expect(page.locator('.mapstudio-history-row').first().locator('.mapstudio-history-sentence'))
                .toHaveText(/^Reverted "Added 1000 /, { timeout: REPLY_MS });
        } finally {
            await cleanUp(page, many);
        }
    });

    editorTest('B7, B8: a row from before the record kept values, and a kind setup row: who, what, when, no Revert, the reason in words',
        async ({ page, browser }) => {
            editorTest.setTimeout(240_000);
            // The seed saves the pad kind setup this test saves again unchanged.
            await ensureSeeded(browser);
            await openEditor(page);
            const pad = randomUUID();
            const oldBatch = randomUUID();
            const name = 'Recent old row ' + pad.slice(0, 4);
            const project = e2eProject();
            try {
                saved(await send(page, 'edits.apply', batch(create(pad, { kind: 'pad', name, geometry: point([-104.9703, 39.7427]) }))));
                const setup = (await send(page, 'map.load', {})).body.kindSetups.find((k) => k.kindId === 'pad');
                const setupSaved = saved(await send(page, 'edits.apply', batch({ op: 'update', entity: 'kindSetup', id: 'pad',
                    baseVersion: setup.version, data: { setup: setup.setup } })));
                const seq = Number(sql("WITH s AS (UPDATE mapstudio_project SET seq = seq + 1 WHERE project = '" + project
                    + "' RETURNING seq) INSERT INTO mapstudio_edit (project, batch_id, seq, entity, entity_id, op, version, actor,"
                    + " source) SELECT '" + project + "', '" + oldBatch + "', s.seq, 'item', '" + pad + "', 'update', 1,"
                    + " 'schema2-actor', 'script' FROM s RETURNING seq"));
                await openHistory(page);
                const old = row(page, seq);
                await expect(old).toHaveCount(1, { timeout: REPLY_MS });
                await expect(old).toHaveAttribute('data-revert', 'blocked');
                await expect(old.locator('.mapstudio-history-sentence')).toHaveText('Changed ' + name);
                await expect(old.locator('.mapstudio-history-avatar')).toHaveText('S');
                await expect(old.locator('.mapstudio-history-revert')).toHaveCount(0);
                await expect(old.locator('.mapstudio-history-norevert')).toHaveText('The values of this change were not kept, so it cannot be reverted.');
                await old.locator('.mapstudio-history-summary').click();
                await expect(old.locator('.mapstudio-history-detail')).toContainText('The values were not kept');

                const kind = row(page, setupSaved.seq);
                await expect(kind.locator('.mapstudio-history-sentence')).toHaveText(/^Changed the [a-z ]+ kind setup$/);
                await expect(kind.locator('.mapstudio-history-revert')).toHaveCount(0);
                await expect(kind.locator('.mapstudio-history-norevert')).toHaveText('Kind setups change from the Kinds screen, so this change has no Revert.');
            } finally {
                sql("DELETE FROM mapstudio_edit WHERE batch_id = '" + oldBatch + "'");
                await cleanUp(page, [pad]);
            }
        });

    editorTest('B9: 50 rows and Show older, the next page after them, until no older change remains and Show older goes', async ({ page }) => {
        editorTest.setTimeout(300_000);
        await openEditor(page);
        const pad = randomUUID();
        let version = 1;
        try {
            const made = saved(await send(page, 'edits.apply', batch(create(pad, { kind: 'pad', name: 'Recent pages 0', geometry: point([-104.9701, 39.7425]) }))));
            for (let i = 1; i < 60; i++) {
                saved(await send(page, 'edits.apply', batch(update(pad, version, { name: 'Recent pages ' + i }))));
                version++;
            }
            const panel = await openHistory(page);
            await expect(panel).toHaveAttribute('data-rows', '50', { timeout: REPLY_MS });
            await expect(panel).toHaveAttribute('data-more', 'true');
            await expect(row(page, made.seq)).toHaveCount(0);
            await page.locator('.mapstudio-history-older').click();
            // The next page after them (it closes early before a batch that would take it past 1,000 ops, B6's).
            await expect.poll(async () => Number(await panel.getAttribute('data-rows')), { timeout: REPLY_MS }).toBeGreaterThan(59);
            await expect(row(page, made.seq).locator('.mapstudio-history-sentence')).toHaveText('Added well pad Recent pages 0');
            // The rest of the suite's record, a page at a time, until Show older goes.
            for (let i = 0; i < 400 && (await panel.getAttribute('data-more')) === 'true'; i++) {
                const rows = Number(await panel.getAttribute('data-rows'));
                await page.locator('.mapstudio-history-older').click();
                await expect.poll(async () => Number(await panel.getAttribute('data-rows')), { timeout: REPLY_MS }).toBeGreaterThan(rows);
            }
            await expect(panel).toHaveAttribute('data-more', 'false');
            await expect(page.locator('.mapstudio-history-older')).toHaveCount(0);
        } finally {
            await cleanUp(page, [pad]);
        }
    });
});
