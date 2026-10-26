// The spike's measures (epic-module-foundation R6): bundle size, frame rate on
// the 30-pad scale set, the size of one value batch, and what breaks on a
// phone. Writes e2e/out/measures.json always, and docs/spike-measures.json only
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
import { frameStats, median } from '../lib/stats.mjs';
import { batchSize, buildValuesBatch } from '../lib/valueBatch.mjs';
import { expect, loadedCounts, nextFrames, openMap, test, watch } from './fixtures.mjs';

const require = createRequire(import.meta.url);

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

// Story 2's recorded production bundle (docs/platform-checks.md), for the delta.
const STORY_2_BUNDLE_BYTES = { 'MapStudio.js': 1167572, 'MapStudio.css': 70976, 'maplibre-gl-worker.js': 517065 };

// The frame rate drive: input rate caps, so the driver's own load is bounded and the same in every run.
const PAN_MOVES_PER_SECOND = 60;
const ZOOM_EVENTS_PER_SECOND = 25;

const m = {};
let allPassed = true;

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

/** The environment for one section: the run's env plus the viewport it used. */
function envFor(viewport) {
    return { ...m.env, viewport, attempt: test.info().retry };
}

test.beforeAll(async ({ browser }, testInfo) => {
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
        method: 'Bytes of each /res/mapstudio/* file as the dev Gateway served it during a page load of the tracer view (response body decoded, gzip of that body, and the body bytes actually transferred), plus the .modl in ops/modules, the file the Gateway was given (name and SHA-256 recorded). Production webpack build, unsigned. File sizes do not depend on the viewport.',
        env: envFor('1440x900'),
        files,
        modl: stagedModl(),
        note: 'transferredBodyBytes 0 on maplibre-gl-worker.js: Playwright reported no body transfer for the worker request (Chromium fetches a worker script outside the page; why is unverified). Use bytes and gzipBytes for that file.',
        budget: 'none defined; recorded only'
    };
});

// --- frame rate -------------------------------------------------------------

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

/**
 * Call `fn(k, elapsedMs)` for `ms` at no more than `perSecond` calls per second: each call is due one
 * step after the previous due time, and a call that is late runs at once but never makes up the missed
 * slots (no burst of input after a slow frame). `minGapMs` is a pause after every call, however late.
 */
async function paced(page, ms, perSecond, fn, minGapMs = 0) {
    const step = 1000 / perSecond;
    const t0 = Date.now();
    let due = t0;
    for (let k = 0; due - t0 < ms; k++) {
        const wait = due - Date.now();
        if (wait > 0) await page.waitForTimeout(wait);
        await fn(k, Date.now() - t0);
        due = Math.max(due + step, Date.now() + minGapMs);
    }
}

/** Drag the map round a circle for `ms`, at most PAN_MOVES_PER_SECOND mouse moves a second. */
async function panGesture(page, box, ms) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const r = Math.min(box.width, box.height) * 0.2;
    await page.mouse.move(cx + r, cy);
    await page.mouse.down();
    await paced(page, ms, PAN_MOVES_PER_SECOND, async (_k, elapsed) => {
        const a = (elapsed / ms) * 4 * Math.PI;
        await page.mouse.move(cx + r * Math.cos(a), cy + r * Math.sin(a));
    });
    await page.mouse.up();
}

/** Wheel zoom in for half of `ms`, then out for the other half, at a fixed nominal rate of wheel events. */
async function zoomGesture(page, box, ms) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await paced(page, ms, ZOOM_EVENTS_PER_SECOND, async (_k, elapsed) => {
        await page.mouse.wheel(0, elapsed < ms / 2 ? -60 : 60);
    }, 1000 / ZOOM_EVENTS_PER_SECOND);
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
        await nextFrames(page); // the next run starts on a frame boundary, with no gesture in flight
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
        method: `requestAnimationFrame timestamps and long tasks sampled in the page while Playwright drives a 4 s circular drag (at most ${PAN_MOVES_PER_SECOND} mouse moves per second) and a 4 s wheel zoom (at most ${ZOOM_EVENTS_PER_SECOND} wheel events per second, so about 25 when the page keeps up and fewer when it does not; in for 2 s then out for 2 s) on the map, after a 2 s warm-up; 3 runs per view. The driver's input events are handled on the page's main thread, so that load shares it with rendering and is the same in every run. Frames are the page's frame cadence during the gesture, not MapLibre's own render count (the map object is not reachable by design).`,
        env: envFor('1440x900'),
        deviceScaleFactor: 1,
        views: {
            scale30: { stage: 'stand-in data: 30 seeded pads and 30 lines, circle and line layers only', ...scale },
            tracer: { stage: '3 points and 1 line, for contrast', ...tracer }
        },
        limits: [
            m.env.softwareWebGL
                ? 'Software WebGL (CPU rendered): a laptop GPU is expected to do better, which is unverified here.'
                : 'Hardware WebGL renderer as named in env.renderer.',
            'Only circle and line layers: no icons, labels, KPI values or alarm styling.',
            'The pads are a seeded stand-in for the template\'s 30-pad set, which this repository cannot read.'
        ],
        note: 'The run-to-run spread on software WebGL is recorded in docs/platform-checks.md, section "Story 7". NFR-1 asks for 60 frames per second in a laptop browser; the renderer this ran on is in env.renderer.'
    };
});

// --- value batch ------------------------------------------------------------

test('size of one value batch', async ({ page }) => {
    // Real wire sizes of the one round trip that exists: point.click and its reply.
    const frames = [];
    page.on('websocket', (ws) => {
        ws.on('framesent', (f) => frames.push({ dir: 'sent', payload: f.payload }));
        ws.on('framereceived', (f) => frames.push({ dir: 'received', payload: f.payload }));
    });
    const map = await openMap(page, '/scale');
    const counts = await loadedCounts(map);
    expect(counts.points, 'pads the scale view loaded into MapLibre').toBeGreaterThan(0);
    const pads = counts.points;

    const full = batchSize(buildValuesBatch({ pads, full: true }));
    const changes = batchSize(buildValuesBatch({ pads, full: false, every: 10 }));

    // The round trip on the tracer view, with frames counted from just before the click.
    const tracerMap = await openMap(page, '/');
    const box = await tracerMap.boundingBox();
    frames.length = 0;
    const [x, y] = pagePixel(box, TRACER.points.p1.lngLat, TRACER.center, TRACER.zoom);
    await page.mouse.click(x, y);
    await expect(page.locator('.mapstudio-reply')).toContainText('Gateway received click on p1', { timeout: 15_000 });
    const readable = () => frames
        .map((f) => ({ dir: f.dir, buf: Buffer.isBuffer(f.payload) ? f.payload : Buffer.from(String(f.payload), 'utf8') }))
        .filter((f) => f.buf.includes('point.click'))
        .map((f) => ({ direction: f.dir, bytes: f.buf.length, type: f.buf.includes('point.click.reply') ? 'point.click.reply' : 'point.click' }));
    // Both frames are in once the reply text shows, but the socket event can trail the DOM: poll for them.
    await expect.poll(() => readable().length, { timeout: 5_000 }).toBeGreaterThanOrEqual(2).catch(() => {});
    const matching = readable();
    const wire = matching.length
        ? { label: 'measured', method: 'Playwright websocket frame sizes of the Perspective session socket, frames whose bytes contain "point.click", from the click to the reply', frames: matching }
        : unavailable(`no websocket frame carried point.click in a readable form (${frames.length} frames seen since the click)`);

    m.valueBatch = {
        label: 'stand-in',
        method: 'values.batch does not exist yet. The AD-6 envelope {v, type, id, body: {seq, full, items}} is built for the scale view\'s pads with three LiveValue slots per pad (comms, icon KPI, alarm count) and its JSON size is measured (UTF-8 bytes, and gzip of the same text). The pad count is the number MapLibre loaded on /scale.',
        env: envFor('1440x900'),
        assumption: 'AD-6 fixes only the LiveValue fields {value, quality, t, stale, reason}; the item layout (pad id plus three named slots) is this story\'s guess, unverified. Whether Perspective compresses websocket frames is unverified, so gzip is an upper bound on the saving, not the wire size.',
        pads,
        slotsPerPad: 3,
        full,
        changesOnly: { ...changes, rule: 'every 10th pad changed' },
        wireRoundTrip: wire
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
    const box = await map.boundingBox();
    const reply = page.locator('.mapstudio-reply');

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

    // Pan and pinch are judged on where the open popup's tip moves: the popup is anchored to p1's
    // map position, so its tip follows the map. The tip sits a fixed offset (about 12 px) from the point
    // and may flip side near an edge, which is why the thresholds are generous.
    const tip = () => page.evaluate(() => {
        const t = document.querySelector('.maplibregl-popup-tip');
        if (!t) return null;
        const r = t.getBoundingClientRect();
        return [r.x + r.width / 2, r.y + r.height / 2];
    });
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
        return { ok: dx !== null && dx < -72, detail: `popup tip moved ${dx} px horizontally for a 120 px leftward touch drag (needs under -72); the tip is the stand-in for the point's map position` };
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
        return { ok: ratio !== null && ratio > 1.5, detail: `popup tip distance from the pinch centre grew by a factor of ${ratio} for a CDP pinch of scale 2 (needs over 1.5)` };
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
        // Terra Draw shows no state between vertex taps; the pause only keeps two taps from reading as a double tap.
        await page.touchscreen.tap(a[0], a[1]);
        await page.waitForTimeout(300);
        await page.touchscreen.tap(b[0], b[1]);
        await page.waitForTimeout(300);
        // No Enter key on a phone: tapping the last vertex again is the touch way to finish.
        await page.touchscreen.tap(b[0], b[1]);
        const points = await until(() => reply.getAttribute('data-line-points'), (p) => p === '2', 3000);
        return { ok: points === '2', detail: `data-line-points after two vertex taps and a repeat tap on the last: '${points}' (whether Terra Draw finishes this way on touch is the thing probed)` };
    });

    await probe('no-console-or-page-errors', async () => ({
        ok: w.errors.length === 0,
        detail: w.errors.length ? w.errors.slice(0, 5).join(' | ') : 'none'
    }));

    await context.close();
    m.phone = {
        label: 'measured',
        method: 'Chromium with isMobile and hasTouch at 390x844 (device scale factor 2) on the tracer view; each probe records ok and a detail, and a failed probe is a finding, not a test failure. Touch moves go through CDP Input.dispatchTouchEvent and Input.synthesizePinchGesture; whether they match a real device\'s touch handling is unverified. Pan and pinch are read from the open popup\'s tip position (a DOM stand-in for the point\'s map position), not from the map\'s centre or zoom, which the suite cannot reach by design.',
        env: envFor('390x844'),
        deviceScaleFactor: 2,
        findings,
        summary: { ok: findings.filter((f) => f.ok).length, failed: findings.filter((f) => !f.ok).length }
    };
    expect(w.errors, 'browser console and page errors on the phone').toEqual([]);
});
