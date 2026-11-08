// The Edit-mode item list as designed (epic 4 entry 7a; EXPERIENCE.md Item list, List row, State badge; DESIGN.md list-row,
// group-header, filter-chip): grouped by place from each item's linked asset (MESA FIELD with its sites and their children,
// Field-wide for lines and areas with no parent item, Not linked after every field), Needs attention first (the default sort),
// Sort by Place, Kind, Name and Last changed, the kind Filter, Search items within the grouping, Just added on top, the
// footer's Add item and "N unlinked"; and map.load.reply's `changed` at the phone and full levels only (contract 0.4.0).
// Run on the seeded dev map as mapeditor at 1440 and 1366 px.
import {
    EDITOR_USER, OPERATOR_USER, editorTest, ensureSeeded, expect, mapLoaded, openMap, removeStrays, send, shot, signedInContext, test, view
} from './fixtures.mjs';

/** One refresh interval of the dev setup (10 s) and the next full batch, with margin. */
const INTERVAL_MS = 40_000;
/** The Gateway's answer to a save. */
const REPLY_MS = 20_000;
/** A spot east of the scale set with nothing on it (as other specs use it). */
const AWAY = [-104.82, 39.66];

let seed;

test.beforeAll(async ({ browser }) => {
    seed = await ensureSeeded(browser);
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
        await removeStrays(page, seed.ids);
    } finally {
        await context.close();
    }
});

async function openEditor(page) {
    const map = await openMap(page, '/edit');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', 'full');
    await expect(map).toHaveAttribute('data-studio', 'on');
    return map;
}

/** Press a /live dev button and wait for its result (needsyou.spec.mjs's press). */
async function press(page, button) {
    const out = page.locator('#mapstudio-live-result');
    const before = await out.innerText();
    await page.locator('#mapstudio-live-' + button).click();
    await expect.poll(() => out.innerText(), { timeout: 30_000 }).not.toBe(before);
    const result = JSON.parse(await out.innerText());
    expect(result.error, 'the dev button ' + button).toBeUndefined();
}

/**
 * The list as laid out: one entry per list item, a header {type: 'group' | 'sub', label, right}, the divider {type: 'divider'},
 * or a row {type: 'row', id, name, kind, state, depth, note}.
 */
async function layout(page) {
    return page.locator('.mapstudio-list > li').evaluateAll((els) => els.map((el) => {
        if (el.classList.contains('mapstudio-list-divider')) return { type: 'divider', label: el.textContent };
        if (el.classList.contains('mapstudio-list-group')) {
            const right = el.querySelector('.mapstudio-list-group-right');
            return { type: el.classList.contains('mapstudio-list-group--sub') ? 'sub' : 'group',
                label: el.querySelector('.mapstudio-list-group-label').textContent, right: right ? right.textContent : '' };
        }
        const row = el.querySelector('.mapstudio-list-row');
        const note = row.querySelector('.mapstudio-list-note');
        return { type: 'row', id: row.getAttribute('data-item-id'), name: row.querySelector('.mapstudio-list-name').textContent,
            kind: row.getAttribute('data-kind'), state: row.getAttribute('data-state'), depth: Number(row.getAttribute('data-depth')),
            note: note ? note.textContent : '' };
    }));
}

/** The rows of the group whose header is `label` (up to the next top group header), its Field-wide sub-group included. */
function group(entries, label) {
    const start = entries.findIndex((e) => e.type === 'group' && e.label === label);
    if (start < 0) return null;
    const out = [];
    for (let i = start + 1; i < entries.length && entries[i].type !== 'group'; i++) out.push(entries[i]);
    return out;
}

/** The rows under a group's Field-wide sub-header. */
function fieldWide(rows) {
    const at = rows.findIndex((e) => e.type === 'sub' && e.label === 'Field-wide');
    return at < 0 ? [] : rows.slice(at + 1).filter((e) => e.type === 'row');
}

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id);
const ids = (entries) => entries.filter((e) => e.type === 'row').map((e) => e.id);

for (const [width, height] of [[1440, 900], [1366, 768]]) {
    test.describe(width + ' px', () => {
        test.use({ viewport: { width, height }, deviceScaleFactor: 1 });

        editorTest('Place: MESA FIELD with the linked sites, a child under its site, L-SWD in Field-wide, the scale set under Not linked',
            async ({ page }) => {
                const map = await openEditor(page);
                const list = page.locator('.mapstudio-list');
                await expect(list).toHaveAttribute('data-sort', 'attention');
                await page.locator('.mapstudio-list-sort-select').selectOption('place');
                await expect(list).toHaveAttribute('data-sort', 'place');
                const entries = await layout(page);
                const mesa = group(entries, 'MESA FIELD');
                expect(mesa, 'a MESA FIELD group').not.toBeNull();
                const mesaIds = ids(mesa);
                const sites = mesa.filter((e) => e.type === 'row' && e.depth === 0);
                // The linked pads and instruments are sites (their asset paths do not nest).
                for (const key of ['swd/ctb1', 'swd/swd1', 'tracer/p1', 'tracer/p2', 'tracer/p3', 'swd/pt1', 'swd/pt2', 'swd/lv1']) {
                    expect(sites.map((e) => e.id), key + ' a site of MESA FIELD').toContain(seed.ids[key]);
                }
                // Place: the sites by name, no divider, no attention count.
                const siteRows = mesa.slice(0, mesa.findIndex((e) => e.type === 'sub') < 0 ? mesa.length : mesa.findIndex((e) => e.type === 'sub'))
                    .filter((e) => e.type === 'row' && e.depth === 0);
                expect(siteRows.map((e) => e.id)).toEqual(siteRows.slice().sort(byName).map((e) => e.id));
                expect(entries.some((e) => e.type === 'divider')).toBe(false);
                expect(entries.find((e) => e.type === 'group' && e.label === 'MESA FIELD').right).toBe('');
                // P14 lease (asset Mesa/P14/Lease) indented under Point 2 (asset Mesa/P14), "on Point 2".
                const p2 = mesa.findIndex((e) => e.id === seed.ids['tracer/p2']);
                expect(mesa[p2 + 1]).toMatchObject({ id: seed.ids['areas/p14-lease'], depth: 1, note: 'on Point 2' });
                const leaseRow = page.locator('.mapstudio-list-row[data-item-id="' + seed.ids['areas/p14-lease'] + '"]');
                const p2Row = page.locator('.mapstudio-list-row[data-item-id="' + seed.ids['tracer/p2'] + '"]');
                const indent = (await leaseRow.boundingBox()).x - (await p2Row.boundingBox()).x;
                expect(Math.round(indent), 'a child indents 26 px').toBe(26);
                // L-SWD and the tracer line (Mesa/Lines/...) in Field-wide.
                const wide = fieldWide(mesa).map((e) => e.id);
                expect(wide).toEqual(expect.arrayContaining([seed.ids['swd/line'], seed.ids['tracer/l1']]));
                // The scale set, the shared pair and the two fences: Not linked, after every field.
                const notLinked = group(entries, 'Not linked');
                expect(notLinked, 'a Not linked group').not.toBeNull();
                expect(entries.filter((e) => e.type === 'group').map((e) => e.label).slice(-1)).toEqual(['Not linked']);
                const unlinkedIds = ids(notLinked);
                for (let n = 1; n <= 30; n++) expect(unlinkedIds).toContain(seed.ids['scale/pad-' + n]);
                for (const key of ['areas/north', 'areas/south', 'shared/a', 'shared/b']) expect(unlinkedIds).toContain(seed.ids[key]);
                expect(mesaIds).not.toContain(seed.ids['scale/pad-1']);
                // The header's look: the section label, upper case.
                const header = page.locator('.mapstudio-list-group[data-group="h:field:Mesa"]');
                await expect(header).toHaveCSS('text-transform', 'uppercase');
                await expect(header).toHaveCSS('font-weight', '600');
                await shot(page, 'mapstudio-itemlist-place-' + width + '.png');
                await expect(map).toHaveAttribute('data-studio', 'on');
            });

        editorTest('Needs attention: Point 1 in alarm heads MESA FIELD, the count on the header, then All normal', async ({ page }) => {
            test.setTimeout(240_000);
            const live = await openMap(page, '/live');
            await mapLoaded(live);
            await press(page, 'pressure-high');
            try {
                await openEditor(page);
                const p1 = page.locator('.mapstudio-list-row[data-item-id="' + seed.ids['tracer/p1'] + '"]');
                await expect(p1).toHaveAttribute('data-state', 'alarm', { timeout: INTERVAL_MS });
                const entries = await layout(page);
                const mesa = group(entries, 'MESA FIELD');
                const firstRow = mesa.find((e) => e.type === 'row');
                expect(firstRow.id, 'Point 1 first in MESA FIELD').toBe(seed.ids['tracer/p1']);
                const divider = mesa.findIndex((e) => e.type === 'divider');
                expect(divider, 'an All normal divider').toBeGreaterThan(0);
                expect(mesa[divider].label).toBe('All normal');
                // The count: the sites before the divider and the Field-wide items needing attention.
                const attentionSites = mesa.slice(0, divider).filter((e) => e.type === 'row' && e.depth === 0).length;
                const attentionWide = fieldWide(mesa).filter((e) => e.depth === 0 && ['alarm', 'comms-lost', 'stale'].includes(e.state)).length;
                const header = entries.find((e) => e.type === 'group' && e.label === 'MESA FIELD');
                expect(header.right).toBe((attentionSites + attentionWide) + ' NEED ATTENTION');
                // Every site after the divider is normal itself (its children too: a child's state lifts its site above it).
                const after = mesa.slice(divider + 1, mesa.findIndex((e) => e.type === 'sub') < 0 ? mesa.length : mesa.findIndex((e) => e.type === 'sub'));
                expect(after.filter((e) => e.type === 'row').every((e) => !['alarm', 'comms-lost', 'stale'].includes(e.state))).toBe(true);
                await shot(page, 'mapstudio-itemlist-attention-' + width + '.png');
            } finally {
                await mapLoaded(await openMap(page, '/live'));
                await press(page, 'pressure-low');
                await press(page, 'ack');
            }
        });

        editorTest('Add item arms the Point tool; a placed pad heads Just added; Undo of the add removes it', async ({ page }) => {
            const map = await openEditor(page);
            const add = page.locator('.mapstudio-list-add');
            await expect(add).toHaveText('Add item');
            await add.click();
            await expect(map).toHaveAttribute('data-tool', 'point');
            await expect(page.locator('.mapstudio-tool[data-tool="point"]:not(.mapstudio-tool--kind)')).toHaveAttribute('aria-pressed', 'true');
            await view(page, map, AWAY, 15);
            const box = await map.boundingBox();
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            const panel = page.locator('.mapstudio-panel');
            await expect(panel).toHaveAttribute('data-item-id', /.+/, { timeout: REPLY_MS });
            const added = await panel.getAttribute('data-item-id');
            await expect(map).toHaveAttribute('data-save-state', 'saved', { timeout: REPLY_MS });
            let entries = await layout(page);
            expect(entries[0]).toMatchObject({ type: 'group', label: 'Just added' });
            expect(entries[1]).toMatchObject({ type: 'row', id: added });
            // Just added in every sort, and nowhere else.
            for (const sort of ['place', 'kind', 'name', 'changed', 'attention']) {
                await page.locator('.mapstudio-list-sort-select').selectOption(sort);
                entries = await layout(page);
                expect(entries[1].id, sort).toBe(added);
                expect(ids(entries).filter((id) => id === added), sort).toHaveLength(1);
            }
            await shot(page, 'mapstudio-itemlist-just-added-' + width + '.png');
            await page.keyboard.press('Escape');
            const undo = page.locator('.mapstudio-toolbar .mapstudio-undo');
            await expect(undo).toHaveAttribute('data-step', 'Undo: add Well pad');
            await undo.click();
            await expect(page.locator('.mapstudio-list-row[data-item-id="' + added + '"]')).toHaveCount(0, { timeout: REPLY_MS });
            await expect(page.locator('.mapstudio-list-group[data-group="h:just-added"]')).toHaveCount(0);
        });

        editorTest('Sort by Name, then Kind, then Last changed: A-Z flat, kind groups, newest first with who and when', async ({ page }) => {
            await openEditor(page);
            const select = page.locator('.mapstudio-list-sort-select');
            await expect(select.locator('option')).toHaveText(['Needs attention', 'Place', 'Kind', 'Name', 'Last changed']);
            await select.selectOption('name');
            let entries = await layout(page);
            expect(entries.every((e) => e.type === 'row' && e.depth === 0)).toBe(true);
            expect(ids(entries)).toEqual(entries.slice().sort(byName).map((e) => e.id));

            await select.selectOption('kind');
            entries = await layout(page);
            const load = (await send(page, 'map.load', {})).body;
            const kindName = Object.fromEntries(load.kinds.map((k) => [k.id, k.name]));
            let current = null;
            for (const e of entries) {
                if (e.type === 'group') {
                    current = e.label;
                } else {
                    expect(e.type).toBe('row');
                    expect(kindName[e.kind] || e.kind, e.name).toBe(current);
                }
            }
            expect(entries.filter((e) => e.type === 'group').map((e) => e.label)).toEqual(
                Array.from(new Set(entries.filter((e) => e.type === 'row').map((e) => kindName[e.kind] || e.kind)))
                    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })));

            // Last changed: newest first as map.load's changed says (to the second), then the rows with none by name.
            await select.selectOption('changed');
            entries = await layout(page);
            expect(load.changed, 'changed at the full level').toBeTruthy();
            const at = (id) => (load.changed[id] ? Date.parse(load.changed[id].at) : NaN);
            const rows = entries.filter((e) => e.type === 'row');
            const expected = rows.slice().sort((a, b) => {
                const ta = at(a.id);
                const tb = at(b.id);
                if (isFinite(ta) && isFinite(tb) && ta !== tb) return tb - ta;
                if (isFinite(ta) !== isFinite(tb)) return isFinite(ta) ? -1 : 1;
                return byName(a, b);
            });
            expect(rows.map((e) => e.id)).toEqual(expected.map((e) => e.id));
            const first = rows[0];
            expect(first.note.startsWith(load.changed[first.id].actor + ' - ')).toBe(true);
            expect(first.note).toMatch(/ - (Today|Yesterday) \d\d:\d\d$| - \S+$/);
            await shot(page, 'mapstudio-itemlist-last-changed-' + width + '.png');
        });

        editorTest('Filter, Well pad: only pads in every sort; the button names the kind', async ({ page }) => {
            await openEditor(page);
            const filter = page.locator('.mapstudio-list-filter');
            await expect(filter).toHaveText('Filter');
            await expect(filter).toHaveAttribute('aria-expanded', 'false');
            await filter.click();
            await expect(filter).toHaveAttribute('aria-expanded', 'true');
            const chips = page.locator('.mapstudio-list-chips .mapstudio-kind-chip');
            const rowsCount = Number(await page.locator('.mapstudio-list').getAttribute('data-rows'));
            await expect(chips.first()).toHaveText('All ' + rowsCount);
            const pad = page.locator('.mapstudio-kind-chip[data-kind="pad"]');
            await expect(pad).toHaveText(/^Well pad \d+$/);
            const padCount = Number((await pad.textContent()).replace('Well pad ', ''));
            const chipBox = await pad.boundingBox();
            expect(Math.round(chipBox.height), 'a 26 px chip').toBe(26);
            await pad.click();
            await expect(pad).toHaveAttribute('aria-pressed', 'true');
            await expect(filter).toHaveText('Well pad');
            await shot(page, 'mapstudio-itemlist-filter-' + width + '.png');
            for (const sort of ['attention', 'place', 'kind', 'name', 'changed']) {
                await page.locator('.mapstudio-list-sort-select').selectOption(sort);
                const entries = await layout(page);
                const rows = entries.filter((e) => e.type === 'row');
                expect(rows.length, sort).toBe(padCount);
                expect(rows.every((e) => e.kind === 'pad'), sort).toBe(true);
            }
            await page.locator('.mapstudio-list-chips .mapstudio-kind-chip').first().click();
            await expect(filter).toHaveText('Filter');
            await expect(page.locator('.mapstudio-list')).toHaveAttribute('data-rows', String(rowsCount));
        });

        editorTest('Search "swd": SWD1 and L-SWD in their groups', async ({ page }) => {
            await openEditor(page);
            await page.locator('.mapstudio-list-search-input').pressSequentially('swd');
            const entries = await layout(page);
            const mesa = group(entries, 'MESA FIELD');
            expect(mesa.filter((e) => e.type === 'row' && e.depth === 0).map((e) => e.id)).toContain(seed.ids['swd/swd1']);
            expect(fieldWide(mesa).map((e) => e.id)).toContain(seed.ids['swd/line']);
            expect(ids(entries).sort()).toEqual([seed.ids['swd/swd1'], seed.ids['swd/line']].sort());
            expect(entries.filter((e) => e.type !== 'row').map((e) => e.label)).toEqual(['MESA FIELD', 'Field-wide']);
        });

        editorTest('Footer: "N unlinked" keeps the Not linked rows alone, with a clear to return', async ({ page }) => {
            await openEditor(page);
            const list = page.locator('.mapstudio-list');
            const all = Number(await list.getAttribute('data-rows'));
            const unlinked = page.locator('.mapstudio-list-unlinked');
            await expect(unlinked).toHaveText(/^\d+ unlinked$/);
            const n = Number(await unlinked.getAttribute('data-count'));
            expect(n).toBeGreaterThanOrEqual(34);
            const before = group(await layout(page), 'Not linked');
            expect(before.filter((e) => e.type === 'row')).toHaveLength(n);
            // The footer sits under the list, inside the dock, clear of the bottom-right corner.
            const footer = await page.locator('.mapstudio-list-footer').boundingBox();
            const dock = await page.locator('.mapstudio-dock--items').boundingBox();
            expect(footer.y + footer.height).toBeLessThanOrEqual(dock.y + dock.height + 1);
            expect(footer.x + footer.width).toBeLessThanOrEqual(dock.x + dock.width + 1);
            await unlinked.click();
            await expect(unlinked).toHaveAttribute('aria-pressed', 'true');
            await expect(list).toHaveAttribute('data-rows', String(n));
            const entries = await layout(page);
            expect(entries.filter((e) => e.type === 'group').map((e) => e.label)).toEqual(['Not linked']);
            await shot(page, 'mapstudio-itemlist-unlinked-' + width + '.png');
            await page.locator('.mapstudio-list-unlinked-clear').click();
            await expect(unlinked).toHaveAttribute('aria-pressed', 'false');
            await expect(list).toHaveAttribute('data-rows', String(all));
        });
    });
}

test.describe('map.load.reply changed (contract 0.4.0)', () => {
    editorTest('sent at the full and phone levels as {itemId: {actor, at}}, absent for a viewer', async ({ page, browser }) => {
        await openEditor(page);
        const full = (await send(page, 'map.load', {})).body;
        expect(full.level).toBe('full');
        const entries = Object.entries(full.changed);
        expect(entries.length).toBeGreaterThan(0);
        for (const [id, c] of entries) {
            expect(full.items.some((i) => i.id === id), 'a live item').toBe(true);
            expect(typeof c.actor).toBe('string');
            expect(c.at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
        }
        expect(full.changed[seed.ids['scale/pad-1']].actor).toBe('seed-script');

        const phone = await signedInContext(browser, OPERATOR_USER, { viewport: { width: 390, height: 844 } });
        try {
            const p = await phone.newPage();
            await mapLoaded(await openMap(p, '/edit'));
            const body = (await send(p, 'map.load', {})).body;
            expect(body.level).toBe('phone');
            expect(body.changed[seed.ids['scale/pad-1']]).toEqual(full.changed[seed.ids['scale/pad-1']]);
        } finally {
            await phone.close();
        }
    });

    test('a viewer gets no changed', async ({ page }) => {
        const map = await openMap(page, '/');
        await mapLoaded(map);
        await expect(map).toHaveAttribute('data-edit-level', 'none');
        const body = (await send(page, 'map.load', {})).body;
        expect(body.level).toBe('none');
        expect(body.changed).toBeUndefined();
        expect(body.items.length).toBeGreaterThan(0);
    });
});
