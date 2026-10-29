// The spike's measures (epic-module-foundation R6): bundle size, frame rate on
// the 30-pad scale set (from epic 2 story 11 the seeded map store items on /), the
// size of one value batch, and what breaks on a phone. Writes e2e/out/measures.json always, and docs/spike-measures.json only
// with E2E_DOCS=1 and only when every measure test passed.
//
// Every number is labelled 'measured' or 'stand-in' with its method and the
// environment it ran in; a measure that cannot run is {status: 'unavailable',
// reason}. Nothing here asserts a performance limit: the story records, story 9
// judges. Only a browser console or page error fails a test.

import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { measuresDocsFile, measuresOutFile, repoRoot } from '../lib/env.mjs';
import { TRACER, pagePixel } from '../lib/geo.mjs';
import { unavailable, validateMeasures, without, writeJson } from '../lib/measures.mjs';
import { PAN_MOVES_PER_SECOND, ZOOM_EVENTS_PER_SECOND, measureView, webglRenderer } from '../lib/frameRate.mjs';
import { batchSize, frameText, parseBatchFrame } from '../lib/valueBatch.mjs';
import {
    EDITOR_USER, ensureSeeded, expect, loadedCounts, mapLoaded, nextFrames, openMap, signedInContext, test, watch
} from './fixtures.mjs';

const require = createRequire(import.meta.url);

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

// Story 2's recorded production bundle (docs/platform-checks.md), for the delta.
const STORY_2_BUNDLE_BYTES = { 'MapStudio.js': 1167572, 'MapStudio.css': 70976, 'maplibre-gl-worker.js': 517065 };

const m = {};
let allPassed = true;
/** The seed's result (epic 2 story 11): the tracer's ids and the scale set's counts. */
let seed;

function playwrightVersion() {
    try {
        return require('@playwright/test/package.json').version;
    } catch {
        return 'unknown';
    }
}

/** The environment for one section: the run's env plus the viewport it used. */
function envFor(viewport) {
    return { ...m.env, viewport, attempt: test.info().retry };
}

test.beforeAll(async ({ browser }, testInfo) => {
    seed = await ensureSeeded(browser);
    const page = await browser.newPage();
    const renderer = await webglRenderer(page);
    await page.close();
    m.schema = 1;
    m.generatedAt = new Date().toISOString();
    m.env = {
        chromium: browser.version(),
        renderer: renderer ?? 'no WebGL context',
        softwareWebGL: !renderer || /swiftshader|llvmpipe|software/i.test(renderer),
        playwright: playwrightVersion(),
        cpus: os.cpus().length,
        platform: `${os.platform()} ${os.arch()}`,
        ci: !!process.env.CI,
        headed: process.env.E2E_HEADED === '1',
        retriesConfigured: testInfo.project.retries
    };
});

// The last attempt of each measure test decides, so a retry that passes counts as a pass.
const lastAttemptOk = {};
test.afterEach(({}, testInfo) => {
    lastAttemptOk[testInfo.title] = testInfo.status === testInfo.expectedStatus;
    allPassed = Object.keys(lastAttemptOk).length === 4 && Object.values(lastAttemptOk).every(Boolean);
});

test.afterAll(() => {
    for (const name of ['bundle', 'frameRate', 'valueBatch', 'phone']) {
        if (!m[name]) m[name] = unavailable('the measure did not run to completion; see the test output');
    }
    // A failed beforeAll leaves no env; keep the real failure visible instead of throwing here.
    if (!m.env) m.env = { chromium: 'unknown', renderer: 'unknown' };
    const problems = validateMeasures(m);
    if (problems.length && allPassed) throw new Error('Invalid measures: ' + problems.join('; '));
    // The run-local file always; with a failed measure it says so and may be incomplete.
    writeJson(allPassed ? m : { ...m, incomplete: true, problems }, measuresOutFile);
    // The committed copy only after a fully passing run, and without the timestamp so a re-run only
    // changes it when a number changes.
    if (measuresDocsFile && allPassed) writeJson(without(m, ['generatedAt']), measuresDocsFile);
});

// --- bundle size ------------------------------------------------------------

/** The one .modl in ops/modules, the folder the dev Gateway reads (up.sh stages it; CI downloads it there). */
function stagedModl() {
    const dir = path.join(repoRoot, 'ops', 'modules');
    const found = existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.modl')) : [];
    if (found.length !== 1) {
        return unavailable(`expected exactly one .modl in ops/modules, found ${found.length}${found.length ? ': ' + found.join(', ') : ''}`);
    }
    const bytes = readFileSync(path.join(dir, found[0]));
    return { file: found[0], bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

test('bundle size', async ({ page }) => {
    const wire = new Map();
    page.on('response', (r) => {
        const p = new URL(r.url()).pathname;
        if (p.startsWith('/res/mapstudio/')) wire.set(p, r);
    });
    await openMap(page, '/');
    const files = [];
    for (const [p, r] of [...wire].sort()) {
        const body = await r.body();
        const sizes = await r.request().sizes();
        const name = p.split('/').pop();
        const baseline = STORY_2_BUNDLE_BYTES[name];
        files.push({
            file: name,
            bytes: body.length,
            gzipBytes: gzipSync(body).length,
            transferredBodyBytes: sizes.responseBodySize,
            contentEncoding: r.headers()['content-encoding'] ?? 'none',
            ...(baseline ? { story2Bytes: baseline, deltaBytes: body.length - baseline } : {})
        });
    }
    if (!files.some((f) => f.file === 'MapStudio.js')) {
        m.bundle = unavailable('the Gateway served no /res/mapstudio/MapStudio.js during the page load');
        return;
    }
    m.bundle = {
        label: 'measured',
        method: 'Bytes of each /res/mapstudio/* file as the dev Gateway served it during a page load of the dev map at / (response body decoded, gzip of that body, and the body bytes actually transferred), plus the .modl in ops/modules, the file the Gateway was given (name and SHA-256 recorded). Production webpack build, unsigned. File sizes do not depend on the viewport.',
        env: envFor('1440x900'),
        files,
        modl: stagedModl(),
        note: 'transferredBodyBytes 0 on maplibre-gl-worker.js: Playwright reported no body transfer for the worker request (Chromium fetches a worker script outside the page; why is unverified). Use bytes and gzipBytes for that file.',
        budget: 'none defined; recorded only'
    };
});

// --- frame rate -------------------------------------------------------------

test('frame rate on the 30-pad scale set', async ({ page }) => {
    test.setTimeout(300_000);
    if (m.env.renderer === 'no WebGL context') {
        m.frameRate = unavailable('Chromium gave no WebGL context, so MapLibre cannot draw');
        return;
    }
    const seeded = await measureView(page, '/');
    m.frameRate = {
        label: 'measured',
        method: `requestAnimationFrame timestamps and long tasks sampled in the page while Playwright drives a 4 s circular drag (at most ${PAN_MOVES_PER_SECOND} mouse moves per second) and a 4 s wheel zoom (at most ${ZOOM_EVENTS_PER_SECOND} wheel events per second, so about 25 when the page keeps up and fewer when it does not; in for 2 s then out for 2 s) on the map, after a 2 s warm-up; 3 runs on / with the seeded map store items (one view since epic 2 story 11; drawn counts the points and lines MapLibre held). The driver's input events are handled on the page's main thread, so that load shares it with rendering and is the same in every run. Frames are the page's frame cadence during the gesture, not MapLibre's own render count (the map object is not reachable by design).`,
        env: envFor('1440x900'),
        deviceScaleFactor: 1,
        views: {
            seeded: {
                stage: 'map store items from the dev seed (epic 2 story 11): the 30-pad set (30 pads, 30 lines) and the tracer\'s 3 points and 1 line, plus any items earlier specs saved inside the view; circle and line layers only',
                scale: seed.scale,
                ...seeded
            }
        },
        limits: [
            m.env.softwareWebGL
                ? 'Software WebGL (CPU rendered): a laptop GPU is expected to do better, which is unverified here.'
                : 'Hardware WebGL renderer as named in env.renderer.',
            'Only circle and line layers: no icons, labels, KPI values or alarm styling.',
            'The pads are the dev seed\'s 30-pad set at the spike stand-in\'s coordinates, not the template\'s own set, which this repository cannot read.'
        ],
        note: 'The run-to-run spread on software WebGL is recorded in docs/platform-checks.md, section "Story 7". NFR-1 asks for 60 frames per second in a laptop browser; the renderer this ran on is in env.renderer.'
    };
});

// --- value batch ------------------------------------------------------------

test('size of one value batch', async ({ page, browser }) => {
    // The real values.batch (epic 3 entry 5), read off the Perspective session socket of a viewer on /live:
    // the full batch a map gets on open, and the changes-only batch after one dev tag changes.
    const frames = [];
    page.on('websocket', (ws) => {
        ws.on('framereceived', (f) => frames.push(frameText(f.payload)));
    });
    const pads = seed.scale.pads;
    expect(pads, 'pads of the seeded scale set').toBe(30);

    const liveMap = await openMap(page, '/live');
    await mapLoaded(liveMap);
    await expect(liveMap).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
    const batches = () => frames.map(parseBatchFrame).map((b, i) => (b ? { ...b, text: frames[i] } : null)).filter(Boolean);
    await expect.poll(() => batches().filter((b) => b.full).length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    const fullBatch = batches().find((b) => b.full);
    const full = { ...batchSize(fullBatch.text), items: fullBatch.items, kindDisplay: fullBatch.kindDisplay, seq: fullBatch.seq };

    // One change from a map editor: Pressure of P12 toggled on the /live page's dev button.
    const interval = Number(await liveMap.getAttribute('data-refresh-interval')) || 10;
    const seen = batches().length;
    let changes = unavailable('no changes-only batch arrived within two refresh intervals of the dev tag change');
    const editorContext = await signedInContext(browser, EDITOR_USER, { viewport: { width: 1440, height: 900 } });
    try {
        const editor = await editorContext.newPage();
        await mapLoaded(await openMap(editor, '/live'));
        const out = editor.locator('#mapstudio-live-result');
        // High then low: whatever the pressure was, one of the two changes it (and it ends quiet).
        for (const level of ['high', 'low']) {
            const before = await out.innerText();
            await editor.locator('#mapstudio-live-pressure-' + level).click();
            await expect.poll(() => out.innerText(), { timeout: 30_000 }).not.toBe(before);
        }
        await expect.poll(() => batches().slice(seen).filter((b) => !b.full).length, { timeout: (2 * interval + 5) * 1000 })
            .toBeGreaterThanOrEqual(1);
        const delta = batches().slice(seen).find((b) => !b.full);
        changes = { ...batchSize(delta.text), items: delta.items, seq: delta.seq, rule: 'the map items whose values changed since the last batch' };
    } catch (err) {
        changes = unavailable('the changes-only batch could not be measured: ' + String(err && err.message ? err.message : err).split('\n')[0]);
    } finally {
        await editorContext.close();
    }
    const items = Number(await liveMap.getAttribute('data-items-loaded'));

    m.valueBatch = {
        label: 'measured',
        method: 'Playwright websocket frame sizes of the Perspective session socket on /live (an anonymous viewer): the frame that carries the full values.batch sent after map.load (every planned map item and the kind display), and the first changes-only values.batch after a map editor toggled one dev tag. Bytes are the frame\'s UTF-8 text as received (Perspective wraps the envelope in its own message); gzip of the same text is the best case, not the wire.',
        env: envFor('1440x900'),
        refreshIntervalSeconds: interval,
        mapItems: items,
        full,
        changesOnly: changes
    };
});

// --- phone ------------------------------------------------------------------

test('what breaks on a 390 px phone', async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
    });
    const page = await context.newPage();
    const w = watch(page);
    const findings = [];
    const probe = async (check, fn) => {
        try {
            const r = await fn();
            findings.push({ check, ok: !!r.ok, detail: r.detail });
        } catch (err) {
            findings.push({ check, ok: false, detail: 'probe threw: ' + String(err && err.message ? err.message : err).split('\n')[0] });
        }
    };
    /** Re-read `read` on each frame until `done(value)` or the time is up; returns the last value. */
    const until = async (read, done, ms = 5000) => {
        const t0 = Date.now();
        let v = await read();
        while (!done(v) && Date.now() - t0 < ms) {
            await nextFrames(page);
            v = await read();
        }
        return v;
    };

    const map = await openMap(page, '/');
    await mapLoaded(map);
    await loadedCounts(map);
    const box = await map.boundingBox();
    const reply = page.locator('.mapstudio-reply');
    const p1 = seed.ids[TRACER.points.p1.key];

    await probe('page-has-no-horizontal-overflow', async () => {
        const d = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
        return { ok: d.scroll <= d.inner, detail: `scrollWidth ${d.scroll}, innerWidth ${d.inner}` };
    });

    await probe('map-fills-the-viewport-width', async () => ({
        ok: Math.abs(box.width - 390) <= 1,
        detail: `map ${Math.round(box.width)} x ${Math.round(box.height)} px`
    }));

    await probe('touch-targets-at-least-44-px', async () => {
        const rects = await page.evaluate(() => [...document.querySelectorAll('.mapstudio .maplibregl-ctrl button')].map((b) => {
            const r = b.getBoundingClientRect();
            return { name: b.getAttribute('aria-label') || b.title || b.className, w: Math.round(r.width), h: Math.round(r.height) };
        }));
        const small = rects.filter((r) => Math.min(r.w, r.h) < 44);
        return { ok: rects.length > 0 && small.length === 0, detail: rects.map((r) => `${r.name} ${r.w}x${r.h}`).join('; ') || 'no controls found' };
    });

    await probe('tap-a-point-gives-reply-and-popup', async () => {
        const [x, y] = pagePixel(box, TRACER.points.p1.lngLat, TRACER.center, TRACER.zoom);
        await page.touchscreen.tap(x, y);
        await expect(reply).toContainText('Gateway received click on ' + p1, { timeout: 10_000 });
        await expect(page.locator('.mapstudio-sheet .mapstudio-popup--default .mapstudio-popup-name')).toHaveText('Point 1', { timeout: 20_000 });
        return { ok: true, detail: 'reply text and the popup sheet shown after a touch tap' };
    });

    await probe('popup-inside-the-viewport-with-a-44-px-close', async () => {
        const d = await page.evaluate(() => {
            const pop = document.querySelector('.mapstudio-sheet');
            const close = document.querySelector('.mapstudio-popup-close');
            if (!pop || !close) return null;
            const a = pop.getBoundingClientRect();
            const c = close.getBoundingClientRect();
            return { left: a.left, right: a.right, top: a.top, bottom: a.bottom, vw: window.innerWidth, vh: window.innerHeight, closeW: c.width, closeH: c.height };
        });
        if (!d) return { ok: false, detail: 'no popup open' };
        const inside = d.left >= 0 && d.right <= d.vw && d.top >= 0 && d.bottom <= d.vh;
        const closeOk = Math.min(d.closeW, d.closeH) >= 44;
        return {
            ok: inside && closeOk,
            detail: `popup x ${Math.round(d.left)}..${Math.round(d.right)} of ${d.vw}, y ${Math.round(d.top)}..${Math.round(d.bottom)} of ${d.vh}; close ${Math.round(d.closeW)}x${Math.round(d.closeH)}`
        };
    });

    // Pan and pinch are judged on where p1 moves on the page: its position is worked out from the
    // map's own data-center and data-zoom (the view the component reports; entry 8 made the phone's
    // popup a bottom sheet with no tip to track). The thresholds are generous.
    const tip = () => page.evaluate(() => {
        const el = document.querySelector('.mapstudio-map');
        const c = el && el.getAttribute('data-center');
        const z = el && el.getAttribute('data-zoom');
        if (!c || !z) return null;
        const [lng, lat] = c.split(',').map(Number);
        return { center: [lng, lat], zoom: Number(z) };
    }).then((v) => (v ? pagePixel(box, TRACER.points.p1.lngLat, v.center, v.zoom) : null));
    const cdp = await context.newCDPSession(page);
    // Gestures start above the popup (the popup spans y 450..548 on this view).
    const gx = box.x + box.width / 2;
    const gy = box.y + box.height * 0.2;

    await probe('touch-drag-pans-the-map', async () => {
        const before = await tip();
        if (!before) return { ok: false, detail: 'no open popup to track' };
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: gx + 100, y: gy }] });
        for (let i = 1; i <= 12; i++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: gx + 100 - i * 10, y: gy }] });
            await nextFrames(page);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        const after = await until(tip, (t) => !!t && t[0] - before[0] < -72);
        const dx = after ? Math.round(after[0] - before[0]) : null;
        return { ok: dx !== null && dx < -72, detail: `the point moved ${dx} px horizontally for a 120 px leftward touch drag (needs under -72); its page position comes from the map's data-center and data-zoom` };
    });

    await probe('pinch-zooms-the-map', async () => {
        const before = await tip();
        if (!before) return { ok: false, detail: 'no open popup to track' };
        const dist = (t) => Math.hypot(t[0] - gx, t[1] - gy);
        await cdp.send('Input.synthesizePinchGesture', {
            x: Math.round(gx),
            y: Math.round(gy),
            scaleFactor: 2,
            relativeSpeed: 300,
            gestureSourceType: 'touch'
        });
        const after = await until(tip, (t) => !!t && dist(t) > 1.5 * dist(before));
        const ratio = after ? Math.round((dist(after) / dist(before)) * 100) / 100 : null;
        return { ok: ratio !== null && ratio > 1.5, detail: `the point's distance from the pinch centre grew by a factor of ${ratio} for a CDP pinch of scale 2 (needs over 1.5)` };
    });

    await probe('line-tool-finishes-by-touch-alone', async () => {
        // The spike's line tool is Edit mode's (epic 3 entry 14): a second page on the dev editing page /edit.
        const edit = await context.newPage();
        const editMap = await openMap(edit, '/edit');
        await mapLoaded(editMap);
        const editBox = await editMap.boundingBox();
        const editReply = edit.locator('.mapstudio-reply');
        const cx = editBox.x + editBox.width / 2;
        const cy = editBox.y + editBox.height / 2;
        const [a, b] = TRACER.drawOffsets.map(([dx, dy]) => [cx + dx, cy + dy + 140]);
        await edit.touchscreen.tap(...(await edit.locator('.mapstudio-draw-button').evaluate((el) => {
            const r = el.getBoundingClientRect();
            return [r.x + r.width / 2, r.y + r.height / 2];
        })));
        await expect(editReply).toHaveAttribute('data-drawing', 'true', { timeout: 5_000 });
        // Terra Draw shows no state between vertex taps; the pause only keeps two taps from reading as a double tap.
        await edit.touchscreen.tap(a[0], a[1]);
        await edit.waitForTimeout(300);
        await edit.touchscreen.tap(b[0], b[1]);
        await edit.waitForTimeout(300);
        // No Enter key on a phone: tapping the last vertex again is the touch way to finish.
        await edit.touchscreen.tap(b[0], b[1]);
        const points = await until(() => editReply.getAttribute('data-line-points'), (p) => p === '2', 3000);
        await edit.close();
        return { ok: points === '2', detail: `data-line-points after two vertex taps and a repeat tap on the last, on /edit: '${points}' (whether Terra Draw finishes this way on touch is the thing probed)` };
    });

    await probe('no-console-or-page-errors', async () => ({
        ok: w.errors.length === 0,
        detail: w.errors.length ? w.errors.slice(0, 5).join(' | ') : 'none'
    }));

    await context.close();
    m.phone = {
        label: 'measured',
        method: 'Chromium with isMobile and hasTouch at 390x844 (device scale factor 2) on the dev map at / with the seeded items (the line-tool probe on /edit, where Edit mode holds the tool); each probe records ok and a detail, and a failed probe is a finding, not a test failure. Touch moves go through CDP Input.dispatchTouchEvent and Input.synthesizePinchGesture; whether they match a real device\'s touch handling is unverified. Pan and pinch are read from the point\'s page position worked out from the map\'s reported data-center and data-zoom (entry 8: the phone popup is a sheet with no tip).',
        env: envFor('390x844'),
        deviceScaleFactor: 2,
        findings,
        summary: { ok: findings.filter((f) => f.ok).length, failed: findings.filter((f) => !f.ok).length }
    };
    expect(w.errors, 'browser console and page errors on the phone').toEqual([]);
});
