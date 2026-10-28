// The frame-rate drive and sampler, shared by the spike's measures (tests/measures.spec.mjs) and the
// performance check (perf/perf.spec.mjs, epic 2 story 17). Moved here from measures.spec.mjs in story 17
// without a change of behaviour.

import { frameStats, median } from './stats.mjs';
import { loadedCounts, mapLoaded, nextFrames, openMap } from '../tests/fixtures.mjs';

// The frame rate drive: input rate caps, so the driver's own load is bounded and the same in every run.
export const PAN_MOVES_PER_SECOND = 60;
export const ZOOM_EVENTS_PER_SECOND = 25;

/** The WebGL renderer string a fresh canvas reports, or null without WebGL. */
export async function webglRenderer(page) {
    return page.evaluate(() => {
        const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
        if (!gl) return null;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    });
}

export async function startSampler(page) {
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

export async function stopSampler(page) {
    const r = await page.evaluate(() => { window.__fr.stop = true; return { t: window.__fr.t, long: window.__fr.long }; });
    return frameStats(r.t, r.long);
}

/**
 * Call `fn(k, elapsedMs)` for `ms` at no more than `perSecond` calls per second: each call is due one
 * step after the previous due time, and a call that is late runs at once but never makes up the missed
 * slots (no burst of input after a slow frame). `minGapMs` is a pause after every call, however late.
 */
export async function paced(page, ms, perSecond, fn, minGapMs = 0) {
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
export async function panGesture(page, box, ms) {
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
export async function zoomGesture(page, box, ms) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await paced(page, ms, ZOOM_EVENTS_PER_SECOND, async (_k, elapsed) => {
        await page.mouse.wheel(0, elapsed < ms / 2 ? -60 : 60);
    }, 1000 / ZOOM_EVENTS_PER_SECOND);
}

export async function measureView(page, pagePath) {
    const map = await openMap(page, pagePath);
    await mapLoaded(map);
    // What the map drew: read back from MapLibre's item sources after the items' first idle.
    const drawn = await loadedCounts(map);
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
        drawn,
        runs,
        medianFps: { pan: median(fps('pan')), zoom: median(fps('zoom')) },
        fpsRange: {
            pan: [Math.min(...fps('pan')), Math.max(...fps('pan'))],
            zoom: [Math.min(...fps('zoom')), Math.max(...fps('zoom'))]
        }
    };
}
