// Kind setups in the map store, and items checked against the kind list
// (epic-map-store-and-data, entry 9), live: the I/O matrix through edits.apply (the
// component's real session path, window.__mapStudioTest) and through
// system.mapstudio.applyEdits and getMap (the /edit page's "Run script checks"). The dev
// adapter must be in mode ok (adapters.spec.mjs leaves it so): with no kind list in use
// every save but a delete is refused.

import { randomUUID } from 'node:crypto';
import {
    OPERATOR_USER, editorTest, expect, mapLoaded, openMap, signedInContext, test
} from './fixtures.mjs';

async function send(page, type, body) {
    await page.waitForFunction(() => Boolean(window.__mapStudioTest));
    return page.evaluate(([t, b]) => window.__mapStudioTest.send(t, b), [type, body]);
}

async function load(page) {
    const reply = await send(page, 'map.load', {});
    expect(reply.type, JSON.stringify(reply.body)).toBe('map.load.reply');
    return reply.body;
}

const batch = (...ops) => ({ batchId: randomUUID(), ops });
const point = { type: 'Point', coordinates: [-104.968, 39.737] };
const line = { type: 'LineString', coordinates: [[-104.99, 39.74], [-104.98, 39.75]] };
const createItem = (data) => ({ op: 'create', entity: 'item', id: randomUUID(), baseVersion: 0, data });

/** The I/O matrix's "Save setup" row, a Bands rule on the icon KPI. */
const PAD_SETUP = {
    comms: { path: '{asset.path}/Comms', on: true },
    kpis: [
        { key: 'pressure', label: 'Pressure', path: '{asset.path}/Pressure', unit: 'psi', on: true, icon: true },
        { key: 'gas', label: 'Gas price', path: '[default]Shared/GasPrice', unit: '', on: false, icon: false }
    ],
    alarms: { path: '{asset.path}', count: true, summary: true },
    link: '/pad/{item.name}',
    popupView: {
        path: 'Popups/PadDetails',
        params: { padName: '{item.name}', tagPath: '{asset.path}', area: 'Mesa', pressure: '{asset.path}/Pressure' }
    },
    styleRule: {
        source: { kpi: 'pressure' }, type: 'bands',
        cases: [{ min: null, max: 900, preset: 'normal' }, { min: 900, max: null, preset: 'warning' }]
    }
};
const LINE_SETUP = {
    styleRule: {
        source: { path: '{asset.path}/State' }, type: 'states',
        cases: [{ value: 'flowing', preset: 'solid' }, { value: 'shut in', preset: 'dashed' }]
    }
};
const GEOFENCE_SETUP = {
    areaTints: { property: 'operator', tints: [{ category: 'North', tint: 'tint-1' }, { category: 'South', tint: 'tint-4' }] }
};

/** A create at 0, or an update or restore at the stored version: kind setups are one row per kind. */
async function setupOp(page, kindId, setup) {
    const stored = (await load(page)).kindSetups.find((k) => k.kindId === kindId);
    return stored
        ? { op: 'update', entity: 'kindSetup', id: kindId, baseVersion: stored.version, data: { setup } }
        : { op: 'create', entity: 'kindSetup', id: kindId, baseVersion: 0, data: { setup } };
}

function expectSaved(reply) {
    expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
    return reply.body;
}

async function expectInvalid(page, body, message) {
    const before = (await load(page)).seq;
    const reply = await send(page, 'edits.apply', body);
    expect(reply.type, JSON.stringify(reply.body)).toBe('error');
    expect(reply.body.code).toBe('invalid');
    expect(reply.body.op).toEqual({ index: 0, id: body.ops[0].id });
    expect(reply.body.message).toMatch(message);
    expect((await load(page)).seq).toBe(before);
}

editorTest.describe('kind setups and item checks', () => {
    editorTest('kind setups save and return unchanged; bad placeholders, presets and tints are refused',
        async ({ page }) => {
            await mapLoaded(await openMap(page, '/edit'));
            const saved = expectSaved(await send(page, 'edits.apply', batch(
                await setupOp(page, 'pad', PAD_SETUP), await setupOp(page, 'line', LINE_SETUP),
                await setupOp(page, 'geofence', GEOFENCE_SETUP))));
            expect(saved.results.map((r) => r.entity)).toEqual(['kindSetup', 'kindSetup', 'kindSetup']);
            const body = await load(page);
            const byKind = Object.fromEntries(body.kindSetups.map((k) => [k.kindId, k]));
            expect(byKind.pad).toEqual({ kindId: 'pad', setup: PAD_SETUP, version: saved.results[0].version, deleted: false });
            expect(byKind.line.setup).toEqual(LINE_SETUP);
            expect(byKind.geofence.setup).toEqual(GEOFENCE_SETUP);

            const pad = (s) => ({ op: 'update', entity: 'kindSetup', id: 'pad', baseVersion: byKind.pad.version,
                data: { setup: { ...PAD_SETUP, ...s } } });
            await expectInvalid(page, batch(pad({ link: '/pad/{item.foo}' })), /^Op 0 \(pad\): link: \{item\.foo\} is not a placeholder/);
            for (const param of ['{item.foo}', 'P-{item.name}', '{item.name}/Pressure']) {
                await expectInvalid(page, batch(pad({ popupView: { path: 'Popups/PadDetails', params: { p: param } } })),
                    /^Op 0 \(pad\): popupView\.params\.p: /);
            }
            await expectInvalid(page, batch(pad({ popupView: { path: 'Popups/PadDetails', params: { mapItem: '{item.id}' } } })),
                /popupView\.params\.mapItem: the popup view always receives the map item/);
            for (const preset of ['red', '#ff0000']) {
                await expectInvalid(page, batch(pad({ styleRule: { source: { kpi: 'pressure' }, type: 'states',
                    cases: [{ value: 1, preset }] } })), /Pick a preset: normal, attention, warning, fault, dimmed; colour codes are not accepted\.$/);
            }
            await expectInvalid(page, batch(pad({ styleRule: { source: { kpi: 'pressure' }, type: 'bands', cases: [
                { min: 900, max: null, preset: 'warning' }, { min: null, max: 900, preset: 'normal' }] } })), /only the last band/);
            await expectInvalid(page, batch(pad({ styleRule: { type: 'expression', expression: 'x',
                cases: [{ value: 1, preset: 'normal' }] } })), /an expression rule has no cases/);
            await expectInvalid(page, batch(pad({ styleRule: { source: { kpi: 'pressure' }, type: 'states',
                cases: [{ value: 1, preset: 'dashed' }] } })), /dashed is a line preset and pad is a point kind/);
            const stored = (await load(page)).kindSetups;
            await expectInvalid(page, batch({ op: 'update', entity: 'kindSetup', id: 'geofence',
                baseVersion: stored.find((k) => k.kindId === 'geofence').version,
                data: { setup: { areaTints: { property: 'operator', tints: [{ category: 'N', tint: 'tint-9' }] } } } }),
                /tint-9 is not a tint\. Pick a tint: tint-1/);
            await expectInvalid(page, batch({ op: 'update', entity: 'kindSetup', id: 'line',
                baseVersion: stored.find((k) => k.kindId === 'line').version, data: { setup: GEOFENCE_SETUP } }),
                /areaTints: line is not an area kind/);

            // A stale update is a conflict carrying the stored kind setup record.
            const stale = await send(page, 'edits.apply', batch({ op: 'update', entity: 'kindSetup', id: 'pad',
                baseVersion: byKind.pad.version - 1 || 99, data: { setup: PAD_SETUP } }));
            expect(stale.body.code).toBe('conflict');
            expect(stale.body.conflicts[0]).toMatchObject({ entity: 'kindSetup', id: 'pad',
                current: { kindId: 'pad', setup: PAD_SETUP, version: byKind.pad.version, deleted: false } });
        });

    editorTest('items are checked against the kind list; CSV numbers and overrides are stored', async ({ page }) => {
        await mapLoaded(await openMap(page, '/edit'));
        const csvPad = createItem({ kind: 'pad', name: 'CSV pad', geometry: point, properties: { wells: '12', status: 'producing' } });
        const csvLine = createItem({ kind: 'line', name: 'CSV line', geometry: line, properties: { diameter: ' 4.5 ', buried: 'true' } });
        const override = {
            styleRule: { source: { path: '[default]Mesa/P12/State' }, type: 'states', cases: [{ value: 'stopped', preset: 'fault' }] },
            kpis: [{ key: 'gas', label: 'Gas price', path: '[default]Shared/GasPrice' }]
        };
        const overridden = createItem({ kind: 'pad', name: 'Override pad', geometry: point, overrides: override });
        expectSaved(await send(page, 'edits.apply', batch(csvPad, csvLine, overridden)));
        const items = Object.fromEntries((await load(page)).items.map((i) => [i.id, i]));
        expect(items[csvPad.id].properties).toEqual({ wells: 12, status: 'producing' });
        expect(items[csvLine.id].properties).toEqual({ diameter: 4.5, buried: true });
        expect(items[overridden.id].overrides).toEqual(override);

        await expectInvalid(page, batch(createItem({ kind: 'tank', geometry: point })), /kind tank is not in the project's kind list/);
        await expectInvalid(page, batch(createItem({ kind: 'line', geometry: point })),
            /kind line is a line kind, so its geometry is a LineString, not a Point\./);
        await expectInvalid(page, batch(createItem({ kind: 'pad', geometry: point, properties: { wells: 'abc' } })),
            /properties\.wells is a whole number field, not "abc"\./);
        await expectInvalid(page, batch(createItem({ kind: 'pad', geometry: point, properties: { colour: 'red' } })),
            /properties\.colour is not a form field of kind pad/);
        await expectInvalid(page, batch(createItem({ kind: 'pad', geometry: point,
            overrides: { kpis: [{ key: 'x', path: '{asset.path}/X' }] } })), /an override's tag path is a full path/);
    });

    editorTest('system.mapstudio.applyEdits saves a kind setup that getMap returns unchanged', async ({ page }) => {
        await mapLoaded(await openMap(page, '/edit'));
        await page.locator('#mapstudio-dev-script-checks').click();
        const out = page.locator('#mapstudio-dev-script-results');
        await expect(out).toContainText('"results"', { timeout: 60_000 });
        const byName = Object.fromEntries(JSON.parse(await out.innerText()).results.map((r) => [r.name, r]));
        expect(byName.kindSetupSave.ok, JSON.stringify(byName.kindSetupSave)).toBe(true);
        expect(byName.kindSetupSave.value.results[0]).toMatchObject({ entity: 'kindSetup', id: 'pad' });
        expect(byName.kindSetupFromGetMap.value).toEqual({ kindId: 'pad', setup: PAD_SETUP,
            version: byName.kindSetupSave.value.results[0].version, deleted: false });
        expect(byName.kindSetupBadPlaceholder.ok).toBe(false);
        expect(byName.kindSetupBadPlaceholder.error).toMatch(/^invalid: Op 0 \(pad\): link: \{item\.foo\} is not a placeholder/);
        expect(byName.itemCsvNumber.ok, JSON.stringify(byName.itemCsvNumber)).toBe(true);
        expect(byName.itemCsvNumberStored.value).toEqual([{ wells: 12 }]);
        expect(byName.itemUnknownKind.ok).toBe(false);
        expect(byName.itemUnknownKind.error).toMatch(/^invalid: Op 0 \(.*\): kind tank is not in the project's kind list/);
    });

    editorTest('a phone editor may not change a kind setup', async ({ browser }) => {
        const context = await signedInContext(browser, OPERATOR_USER, { viewport: { width: 390, height: 844 } });
        try {
            const page = await context.newPage();
            const map = await openMap(page, '/edit');
            await mapLoaded(map);
            await expect(map).toHaveAttribute('data-edit-level', 'phone');
            const body = await load(page);
            expect(Array.isArray(body.kindSetups)).toBe(true);
            const reply = await send(page, 'edits.apply', batch({ op: 'create', entity: 'kindSetup', id: 'pipe-test',
                baseVersion: 0, data: { setup: {} } }));
            expect(reply.body.code).toBe('role');
            expect((await load(page)).seq).toBe(body.seq);
        } finally {
            await context.close();
        }
    });
});

test('a viewer gets no kind setups', async ({ page }) => {
    await mapLoaded(await openMap(page, '/edit'));
    const body = await load(page);
    expect(body.level).toBe('none');
    expect(body.kindSetups).toBeUndefined();
    expect(body.kinds.find((k) => k.id === 'geofence')).toMatchObject({ area: true });
});
