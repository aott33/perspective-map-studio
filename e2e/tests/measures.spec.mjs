// The spike's measures (epic-module-foundation R6): bundle size, frame rate on
// the 30-pad scale set, the size of one value batch, and what breaks on a
// phone. Writes measures.json (and docs/spike-measures.json with E2E_DOCS=1).
//
// Every number is labelled 'measured' or 'stand-in' with its method; a measure
// that cannot run is {status: 'unavailable', reason}. Nothing here asserts a
// performance limit: the story records, story 9 judges. Only a browser console
// or page error fails a test.

import { createRequire } from 'node:module';
import { existsSync, readdirSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { measuresFiles, repoRoot } from '../lib/env.mjs';
import { TRACER, pagePixel } from '../lib/geo.mjs';
import { unavailable, writeMeasures } from '../lib/measures.mjs';
import { frameStats, median } from '../lib/stats.mjs';
import { batchSize, buildValuesBatch } from '../lib/valueBatch.mjs';
import { expect, openMap, test, watch } from './fixtures.mjs';

const require = createRequire(import.meta.url);

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

// Story 2's recorded production bundle (docs/platform-checks.md), for the delta.
const STORY_2_BUNDLE_BYTES = { 'MapStudio.js': 1167572, 'MapStudio.css': 70976, 'maplibre-gl-worker.js': 517065 };

const m = {};

function playwrightVersion() {
    try {
        return require('@playwright/test/package.json').version;
    } catch {
        return 'unknown';
    }
}

async function webglRenderer(page) {
    return page.evaluate(() => {
        const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
        if (!gl) return null;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    });
}

test.beforeAll(async ({ browser }) => {
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
        headed: process.env.E2E_HEADED === '1'
    };
});

test.afterAll(() => {
    for (const name of ['bundle', 'frameRate', 'valueBatch', 'phone']) {
        if (!m[name]) m[name] = unavailable('the measure did not run to completion; see the test output');
    }
    writeMeasures(m, measuresFiles);
});

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
    const modlDirs = [path.join(repoRoot, 'ops', 'modules'), path.join(repoRoot, 'build')];
    let modl = null;
    for (const d of modlDirs) {
        if (!existsSync(d)) continue;
        const f = readdirSync(d).find((n) => n.endsWith('.modl'));
        if (f) {
            modl = { file: f, bytes: statSync(path.join(d, f)).size };
            break;
        }
    }
    m.bundle = {
        label: 'measured',
        method: 'Bytes of each /res/mapstudio/* file as the dev Gateway served it during a page load of the tracer view (response body decoded, gzip of that body, and the body bytes actually transferred), plus the staged .modl. Production webpack build, unsigned.',
        files,
        modl,
        note: 'transferredBodyBytes 0 on maplibre-gl-worker.js: Playwright reported no body transfer for the worker request (Chromium fetches a worker script outside the page; why is unverified). Use bytes and gzipBytes for that file.',
        budget: 'none defined; recorded only'
    };
});

// --- frame rate -----------------------------------------------------------

async function startSampler(page) {
    await page.evaluate(() => {
        const s = { t: [], long: [], stop: false };
        window.__fr = s;
        try {
            new PerformanceObserver((list) => { for (const e of list.getEntries()) s.long.push(e.duration); }).observe({ entryTypes: ['longtask'] });
        } catch (err) { /* long tasks unsupported: the list stays empty */ }
        const tick = (ts) => { s.t.push(ts); if (!s.stop) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
    });
}

async function stopSampler(page) {
    const r = await page.evaluate(() => { window.__fr.stop = true; return { t: window.__fr.t, long: window.__fr.long }; });
    return frameStats(r.t, r.long);
}

/** Drag the map round a circle for `ms`, as fast as input can be sent. */
async function panGesture(page, box, ms) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const r = Math.min(box.width, box.height) * 0.2;
    await page.mouse.move(cx + r, cy);
    await page.mouse.down();
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
        const a = ((Date.now() - t0) / ms) * 4 * Math.PI;
        await page.mouse.move(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    await page.mouse.up();
}

/** Wheel zoom in for half of `ms`, then out for the other half. */
async function zoomGesture(page, box, ms) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
        const inward = Date.now() - t0 < ms / 2;
        await page.mouse.wheel(0, inward ? -60 : 60);
        await page.waitForTimeout(40);
    }
}

async function measureView(page, pagePath) {
    const map = await openMap(page, pagePath);
    const box = await map.boundingBox();
    await panGesture(page, box, 2000); // warm-up, not sampled
    const runs = [];
    for (let i = 0; i < 3; i++) {
        await startSampler(page);
        await panGesture(page, box, 4000);
        const pan = await stopSampler(page);
        await startSampler(page);
        await zoomGesture(page, box, 4000);
        const zoom = await stopSampler(page);
        runs.push({ pan, zoom });
        await page.waitForTimeout(1000);
    }
    const fps = (key) => runs.map((r) => r[key].fps).filter((v) => typeof v === 'number');
    return {
        runs,
        medianFps: { pan: median(fps('pan')), zoom: median(fps('zoom')) },
        fpsRange: {
            pan: [Math.min(...fps('pan')), Math.max(...fps('pan'))],
            zoom: [Math.min(...fps('zoom')), Math.max(...fps('zoom'))]
        }
    };
}

test('frame rate on the 30-pad scale set', async ({ page }) => {
    test.setTimeout(300_000);
    if (m.env.renderer === 'no WebGL context') {
        m.frameRate = unavailable('Chromium gave no WebGL context, so MapLibre cannot draw');
        return;
    }
    const scale = await measureView(page, '/scale');
    const tracer = await measureView(page, '/');
    m.frameRate = {
        label: 'measured',
        method: 'requestAnimationFrame timestamps and long tasks sampled in the page while Playwright drives a 4 s circular drag and a 4 s wheel zoom (in, then out) on the map, after a 2 s warm-up; 3 runs per view. Frames are the page\'s frame cadence during the gesture, not MapLibre\'s own render count (the map object is not reachable by design).',
        views: {
            scale30: { stage: 'stand-in data: 30 seeded pads and 30 lines, circle and line layers only', ...scale },
            tracer: { stage: '3 points and 1 line, for contrast', ...tracer }
        },
        env: { ...m.env, viewport: '1440x900', deviceScaleFactor: 1 },
        limits: [
            m.env.softwareWebGL
                ? 'Software WebGL (CPU rendered): a laptop GPU is expected to do better, which is unverified here.'
                : 'Hardware WebGL renderer as named in env.renderer.',
            'Only circle and line layers: no icons, labels, KPI values or alarm styling, so this is a floor on rendering cost, not a measure of the finished map.',
            'The pads are a seeded stand-in for the template\'s 30-pad set, which this repository cannot read.'
        ],
        comparison: 'Compare scale30 with tracer only through fpsRange: on software WebGL the run-to-run spread is as large as the difference between the views, so no cost per pad can be read from these numbers.',
        nfr1: 'NFR-1 (60 frames per second in a laptop browser) is NOT decided by this measure; story 9 records it as unverified unless the suite is run headed on a laptop (E2E_HEADED=1).'
    };
});

// --- value batch ----------------------------------------------------------

test('size of one value batch', async ({ page }) => {
    // Real wire sizes of the one round trip that exists: point.click and its reply.
    const frames = [];
    page.on('websocket', (ws) => {
        ws.on('framesent', (f) => frames.push({ dir: 'sent', payload: f.payload }));
        ws.on('framereceived', (f) => frames.push({ dir: 'received', payload: f.payload }));
    });
    const map = await openMap(page, '/scale');
    const count = Number(await map.getAttribute('data-feature-count'));
    expect(count, 'the scale view reports its feature count').toBeGreaterThan(0);
    const pads = count / 2; // one pad point and one line per pad

    const full = batchSize(buildValuesBatch({ pads, full: true }));
    const changes = batchSize(buildValuesBatch({ pads, full: false, every: 10 }));

    // The round trip on the tracer view, with frames counted from just before the click.
    const tracerMap = await openMap(page, '/');
    const box = await tracerMap.boundingBox();
    frames.length = 0;
    const [x, y] = pagePixel(box, TRACER.points.p1.lngLat, TRACER.center, TRACER.zoom);
    await page.mouse.click(x, y);
    await expect(page.locator('.mapstudio-reply')).toContainText('Gateway received click on p1', { timeout: 15_000 });
    await page.waitForTimeout(500);
    const matching = frames
        .map((f) => ({ dir: f.dir, buf: Buffer.isBuffer(f.payload) ? f.payload : Buffer.from(String(f.payload), 'utf8') }))
        .filter((f) => f.buf.includes('point.click'))
        .map((f) => ({ direction: f.dir, bytes: f.buf.length, type: f.buf.includes('point.click.reply') ? 'point.click.reply' : 'point.click' }));
    const wire = matching.length
        ? { label: 'measured', method: 'Playwright websocket frame sizes of the Perspective session socket, frames whose bytes contain "point.click", from the click to the reply', frames: matching }
        : unavailable(`no websocket frame carried point.click in a readable form (${frames.length} frames seen since the click)`);

    m.valueBatch = {
        label: 'stand-in',
        method: 'values.batch does not exist yet. The AD-6 envelope {v, type, id, body: {seq, full, items}} is built for the scale view\'s pads with three LiveValue slots per pad (comms, icon KPI, alarm count) and its JSON size is measured (UTF-8 bytes, and gzip of the same text).',
        assumption: 'AD-6 fixes only the LiveValue fields {value, quality, t, stale, reason}; the item layout (pad id plus three named slots) is this story\'s guess, unverified. Whether Perspective compresses websocket frames is unverified, so gzip is an upper bound on the saving, not the wire size.',
        pads,
        slotsPerPad: 3,
        full,
        changesOnly: { ...changes, rule: 'every 10th pad changed' },
        wireRoundTrip: wire
    };
});

// --- phone ----------------------------------------------------------------

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

    const map = await openMap(page, '/');
    const box = await map.boundingBox();
    const reply = page.locator('.mapstudio-reply');
    const mapShot = () => map.screenshot();
    const differs = (a, b) => Buffer.compare(a, b) !== 0;

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
        await expect(reply).toContainText('Gateway received click on p1', { timeout: 10_000 });
        await expect(page.locator('.maplibregl-popup .mapstudio-popup--view')).toContainText('Id: p1', { timeout: 20_000 });
        return { ok: true, detail: 'reply text and popup view shown after a touch tap' };
    });

    await probe('popup-inside-the-viewport-with-a-44-px-close', async () => {
        const d = await page.evaluate(() => {
            const pop = document.querySelector('.maplibregl-popup-content');
            const close = document.querySelector('.maplibregl-popup-close-button');
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

    const cdp = await context.newCDPSession(page);

    await probe('touch-drag-pans-the-map', async () => {
        const before = await mapShot();
        const sx = box.x + box.width * 0.7;
        const sy = box.y + box.height * 0.5;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
        for (let i = 1; i <= 12; i++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx - i * 12, y: sy }] });
            await page.waitForTimeout(16);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(1000);
        const after = await mapShot();
        return { ok: differs(before, after), detail: 'canvas pixels compared before and after a CDP touch drag of 144 px (a pixel comparison, not a read of the map centre)' };
    });

    await probe('pinch-zooms-the-map', async () => {
        const before = await mapShot();
        await cdp.send('Input.synthesizePinchGesture', {
            x: Math.round(box.x + box.width / 2),
            y: Math.round(box.y + box.height / 2),
            scaleFactor: 2,
            relativeSpeed: 300,
            gestureSourceType: 'touch'
        });
        await page.waitForTimeout(1000);
        const after = await mapShot();
        return { ok: differs(before, after), detail: 'canvas pixels compared before and after a CDP pinch of scale 2 (a pixel comparison)' };
    });

    await probe('line-tool-finishes-by-touch-alone', async () => {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const [a, b] = TRACER.drawOffsets.map(([dx, dy]) => [cx + dx, cy + dy + 140]);
        await page.touchscreen.tap(...(await page.locator('.mapstudio-draw-button').evaluate((el) => {
            const r = el.getBoundingClientRect();
            return [r.x + r.width / 2, r.y + r.height / 2];
        })));
        await expect(reply).toHaveAttribute('data-drawing', 'true', { timeout: 5_000 });
        await page.touchscreen.tap(a[0], a[1]);
        await page.waitForTimeout(300);
        await page.touchscreen.tap(b[0], b[1]);
        await page.waitForTimeout(300);
        // No Enter key on a phone: tapping the last vertex again is the touch way to finish.
        await page.touchscreen.tap(b[0], b[1]);
        await page.waitForTimeout(800);
        const points = await reply.getAttribute('data-line-points');
        return { ok: points === '2', detail: `data-line-points after two vertex taps and a repeat tap on the last: '${points}' (whether Terra Draw finishes this way on touch is the thing probed)` };
    });

    await probe('no-console-or-page-errors', async () => ({
        ok: w.errors.length === 0,
        detail: w.errors.length ? w.errors.slice(0, 5).join(' | ') : 'none'
    }));

    await context.close();
    m.phone = {
        label: 'measured',
        method: 'Chromium with isMobile and hasTouch at 390x844 (device scale factor 2) on the tracer view; each probe records ok and a detail, and a failed probe is a finding, not a test failure. Touch moves go through CDP Input.dispatchTouchEvent and Input.synthesizePinchGesture; whether they match a real device\'s touch handling is unverified.',
        viewport: '390x844',
        findings,
        summary: { ok: findings.filter((f) => f.ok).length, failed: findings.filter((f) => !f.ok).length }
    };
    expect(w.errors, 'browser console and page errors on the phone').toEqual([]);
});
