// The performance check before 0.2.0 (epic 2 story 17), run by ops/perf.sh, never by `npm test`.
// PERF_PHASE picks the phase:
//   nomodule  the Gateway without Map Studio: idle 3 min, then 20 sessions on /plain for 3 min
//   main      bundle; idle 3 min; 30 items: map.load x10, frame rate; seed to 1,000: map.load x10,
//             map.changed with 10 then 50 viewer sessions (5 saves each), 20 sessions open 3 min;
//             seed to 5,000: map.load x10, edits.apply with 1 and 10 editors (and the 10 editors' streams
//             from one page, recorded), frame rate; list refresh x10
// Each phase writes e2e/out/perf/phase-<phase>.json after every test; perf/result.mjs merges them.
//
// Every number carries its method and n; a measure that cannot run is {status: 'unavailable', reason}
// ('crashed: ...' when it threw). Items are made through edits.apply in the project mapstudio-perf
// (window.__mapStudioTest, web/typescript/testHook.ts), never with SQL. Before every measure on a map
// the item count is checked against the target; a wrong count makes the measure unavailable.

import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { gatewayUrl, perfOutDir, perfPhaseFile, sessionUrl } from '../lib/env.mjs';
import { measureView, webglRenderer, PAN_MOVES_PER_SECOND, ZOOM_EVENTS_PER_SECOND } from '../lib/frameRate.mjs';
import { EDITOR_USER, mapLoaded, signedInContext } from '../tests/fixtures.mjs';
import { CHANGED_PAD, PROJECT, createBatches, editorPads, itemId } from './items.mjs';
import { LIMITS, PERCENTILE_METHOD, PLANNED, bundleVerdict, classifyReply, countOutcomes, hostBusyPct, inWindow,
    latencyVerdict, procStatCpu, resourceStats, summarize } from './result.mjs';

const require = createRequire(import.meta.url);
const PHASE = process.env.PERF_PHASE || 'main';
const SAMPLES_FILE = process.env.PERF_SAMPLES || path.join(perfOutDir, `samples-${PHASE}.jsonl`);
const TOKEN_FILE = process.env.PERF_TOKEN_FILE || '';
const IDLE_MS = Number(process.env.PERF_IDLE_S || 180) * 1000;
const SESSIONS_MS = Number(process.env.PERF_SESSIONS_S || 180) * 1000;
const SESSIONS_SETTLE_MS = 30_000;
const LOAD_ALL_MS = 5 * 60_000; // decision 6: every viewer loaded within 5 min, else unavailable
const CHANGED_WAIT_MS = 10_000; // a session that has not seen a save's seq after 10 s did not get it
const EDITORS = Number(process.env.PERF_EDITORS || 10);
const VIEWER = { width: 320, height: 240 };

test.describe.configure({ mode: 'serial' });

const R = { schema: 1, phase: PHASE, project: PROJECT, percentileMethod: PERCENTILE_METHOD, env: {}, measures: {} };
const save = () => {
    mkdirSync(perfOutDir, { recursive: true });
    writeFileSync(perfPhaseFile(PHASE), JSON.stringify(R, null, 2) + '\n');
};
const unavailable = (reason) => ({ status: 'unavailable', reason });
const crashed = (err) => unavailable('crashed: ' + String(err && err.message ? err.message : err).split('\n')[0]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readSamples() {
    if (!existsSync(SAMPLES_FILE)) return [];
    return readFileSync(SAMPLES_FILE, 'utf8').split('\n').filter(Boolean).map((l) => {
        try {
            return JSON.parse(l);
        } catch {
            return null;
        }
    }).filter(Boolean);
}

function windowResources(t0, t1) {
    return { window: { t0, t1, seconds: Math.round((t1 - t0) / 1000) }, resources: resourceStats(inWindow(readSamples(), t0, t1)) };
}

async function api(route) {
    if (!TOKEN_FILE) return null;
    try {
        const token = readFileSync(TOKEN_FILE, 'utf8').trim();
        const r = await fetch(gatewayUrl() + route, { headers: { 'X-Ignition-API-Token': token, Accept: 'application/json' },
            signal: AbortSignal.timeout(10_000) });
        return r.ok ? await r.json() : null;
    } catch {
        return null;
    }
}

async function sessionsOfProject() {
    const d = await api('/data/perspective/api/v1/sessions/');
    if (!d || !Array.isArray(d.items)) return null;
    return { total: d.items.length, ofProject: d.items.filter((s) => JSON.stringify(s).includes(PROJECT)).length };
}

// --- page helpers -------------------------------------------------------------------------------

/** One timed test-hook send in the page; the reply is cut down to what the measures read. */
async function sendTimed(page, type, body, { versionsOf = null } = {}) {
    return page.evaluate(async ({ type, body, versionsOf }) => {
        const t0 = performance.now();
        try {
            const r = await window.__mapStudioTest.send(type, body);
            const ms = performance.now() - t0;
            const b = r.body || {};
            const out = { type: r.type, body: {} };
            if (r.type === 'error') out.body = { code: b.code, message: b.message };
            else if (r.type === 'map.load.reply') {
                out.body = { seq: b.seq, items: Array.isArray(b.items) ? b.items.length : null,
                    bodyBytes: new TextEncoder().encode(JSON.stringify(r)).length };
                if (versionsOf) {
                    const want = new Set(versionsOf);
                    out.body.versions = Object.fromEntries((b.items || []).filter((i) => want.has(i.id)).map((i) => [i.id, i.version]));
                }
            } else if (r.type === 'edits.apply.reply') out.body = { seq: b.seq, results: b.results };
            return { ms, reply: out };
        } catch (err) {
            return { ms: performance.now() - t0, reply: { timeout: /No reply/.test(String(err && err.message)), type: 'reject',
                body: { message: String(err && err.message) } } };
        }
    }, { type, body, versionsOf });
}

/** Send create batches through the editor page; throws when one is not saved. */
async function seed(page, from, to) {
    const batches = createBatches(from, to);
    for (const b of batches) {
        const { reply } = await sendTimed(page, 'edits.apply', b);
        const outcome = classifyReply(reply, 'edits.apply.reply');
        if (outcome !== 'ok') throw new Error(`seeding items ${from}..${to - 1}: a batch answered ${outcome} ${JSON.stringify(reply.body).slice(0, 200)}`);
    }
}

/** The editor's map.load reply: {items, seq, versions?}. */
async function loadReply(page, versionsOf = null) {
    const { reply } = await sendTimed(page, 'map.load', {}, { versionsOf });
    if (reply.type !== 'map.load.reply') throw new Error('map.load answered ' + classifyReply(reply, 'map.load.reply'));
    return reply.body;
}

/** Open a signed-in editor page on /edit and wait for its map to load. */
async function openEditor(browser) {
    const context = await signedInContext(browser, EDITOR_USER, { viewport: { width: 640, height: 480 } });
    const page = await context.newPage();
    // Before the page opens, so the Perspective websocket and every map.load.reply frame are seen.
    const frames = watchLoadFrames(page);
    await page.goto(sessionUrl('/edit'), { waitUntil: 'load' });
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER, { timeout: 90_000 });
    const map = page.locator('.mapstudio-map');
    await map.waitFor({ state: 'visible', timeout: 90_000 });
    await mapLoaded(map);
    await page.waitForFunction(() => !!window.__mapStudioTest, null, { timeout: 30_000 });
    return { context, page, frames };
}

/** Record received websocket frames that carry a map.load.reply (their byte length and time). */
function watchLoadFrames(page) {
    const frames = [];
    page.on('websocket', (ws) => ws.on('framereceived', (f) => {
        const p = f.payload;
        const text = Buffer.isBuffer(p) ? p : Buffer.from(String(p), 'utf8');
        if (text.includes('map.load.reply')) frames.push({ t: Date.now(), bytes: text.length });
    }));
    return frames;
}

/**
 * map.load timed 10 times after one warm-up; every reply must hold `target` items. `judged` false
 * (30 and 1,000 items) records the numbers: the owner's limit is on 5,000, so only a refusal, a
 * timeout, an error or a missing sample makes those a miss.
 */
async function measureMapLoad(page, frames, target, judged) {
    const warm = await sendTimed(page, 'map.load', {});
    if (warm.reply.type !== 'map.load.reply') return unavailable('the warm-up map.load answered ' + classifyReply(warm.reply, 'map.load.reply'));
    if (warm.reply.body.items !== target) return unavailable(`the map holds ${warm.reply.body.items} items, not ${target}`);
    const since = Date.now();
    const samples = [];
    const outcomes = [];
    const bodyBytes = [];
    for (let i = 0; i < PLANNED.mapLoad; i++) {
        const { ms, reply } = await sendTimed(page, 'map.load', {});
        let o = classifyReply(reply, 'map.load.reply');
        if (o === 'ok' && reply.body.items !== target) o = `error:item count ${reply.body.items}`;
        outcomes.push(o);
        if (o === 'ok') {
            samples.push(ms);
            bodyBytes.push(reply.body.bodyBytes);
        }
    }
    await sleep(500);
    const frameBytes = frames.filter((f) => f.t >= since).map((f) => f.bytes);
    return {
        label: 'measured',
        items: target,
        method: 'In the signed-in editor page, performance.now() around window.__mapStudioTest.send("map.load") (round trip plus JSON parse; the component ignores replies the hook takes); one warm-up then 10 timed, each reply checked to hold the target item count.',
        ...recordedUnlessFailed(latencyVerdict({ samples, outcomes, planned: PLANNED.mapLoad, limitMs: judged ? LIMITS.mapLoadP95Ms : null }), judged),
        payload: {
            replyJsonBytes: summarize(bodyBytes),
            websocketFrameBytes: summarize(frameBytes),
            method: 'replyJsonBytes: UTF-8 bytes of the reply envelope as JSON in the page; websocketFrameBytes: Playwright framereceived payload bytes of the frames that carry "map.load.reply" (the Perspective frame around it)'
        }
    };
}

/** A pass of an unjudged measure is 'recorded'; a miss (refusal, timeout, error, missing sample) stays a miss. */
function recordedUnlessFailed(v, judged) {
    return judged || v.verdict === 'miss' ? v : { ...v, verdict: 'recorded', limit: 'none (recorded)' };
}

/** Fresh anonymous page at 1440x900: ms from goto to data-load-state=loaded and the drawn counts, 3 runs. */
async function openToDrawn(browser, target) {
    const runs = [];
    for (let i = 0; i < 3; i++) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();
        const t0 = Date.now();
        await page.goto(sessionUrl('/'), { waitUntil: 'load' });
        const map = page.locator('.mapstudio-map');
        await expect(map).toHaveAttribute('data-load-state', 'loaded', { timeout: 120_000 });
        const loaded = Number(await map.getAttribute('data-items-loaded'));
        await expect(map).toHaveAttribute('data-points-loaded', /^[0-9]+$/, { timeout: 120_000 });
        runs.push({ ms: Date.now() - t0, itemsLoaded: loaded });
        await context.close();
    }
    if (runs.some((r) => r.itemsLoaded !== target)) return unavailable(`a page loaded ${runs.map((r) => r.itemsLoaded).join(', ')} items, not ${target}`);
    return { label: 'measured', verdict: 'recorded', method: 'Fresh anonymous context at 1440x900: Date.now() from page.goto("/") to data-load-state=loaded with data-points-loaded set (map.load drawn); 3 runs.', ms: summarize(runs.map((r) => r.ms)) };
}

/** The frame-rate measure of tests/measures.spec.mjs on / at `target` items. */
async function frameRate(browser, target) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
        const view = await measureView(page, '/');
        const loaded = Number(await page.locator('.mapstudio-map').getAttribute('data-items-loaded'));
        if (loaded !== target) return unavailable(`the page loaded ${loaded} items, not ${target}`);
        return {
            label: 'measured',
            verdict: 'recorded',
            items: target,
            method: `lib/frameRate.mjs measureView, as tests/measures.spec.mjs: requestAnimationFrame cadence while Playwright drives a 4 s circular drag (at most ${PAN_MOVES_PER_SECOND} moves a second) and a 4 s wheel zoom (at most ${ZOOM_EVENTS_PER_SECOND} events a second) after a 2 s warm-up, 3 runs, 1440x900.`,
            ...view
        };
    } finally {
        await context.close();
    }
}

/** Open `n` anonymous contexts at 320x240 on `pagePath`, 5 at a time; wait until each is loaded. */
async function openViewers(browser, n, pagePath, ready) {
    const viewers = [];
    const deadline = Date.now() + LOAD_ALL_MS;
    for (let i = 0; i < n; i += 5) {
        const wave = [];
        for (let k = i; k < Math.min(n, i + 5); k++) {
            wave.push((async () => {
                const context = await browser.newContext({ viewport: VIEWER });
                const page = await context.newPage();
                const v = { context, page, loaded: false };
                viewers.push(v);
                try {
                    await page.goto(sessionUrl(pagePath), { waitUntil: 'load', timeout: Math.max(1000, deadline - Date.now()) });
                    await ready(page, Math.max(1000, deadline - Date.now()));
                    v.loaded = true;
                } catch {
                    v.loaded = false;
                }
            })());
        }
        await Promise.all(wave);
        if (Date.now() > deadline) break;
    }
    return viewers;
}

const mapReady = (target) => async (page, timeout) => {
    const map = page.locator('.mapstudio-map');
    await expect(map).toHaveAttribute('data-load-state', 'loaded', { timeout });
    const loaded = Number(await map.getAttribute('data-items-loaded'));
    if (loaded !== target) throw new Error(`loaded ${loaded} items`);
};
const plainReady = async (page, timeout) => {
    await page.locator('#mapstudio-perf-plain').waitFor({ state: 'visible', timeout });
};

async function closeAll(list) {
    for (const v of list.splice(0)) await v.context.close().catch(() => {});
}

/** map.changed from the editor's send to every viewer's data-store-seq, 5 saves. */
async function measureChanged(editor, viewers, n) {
    const loaded = viewers.filter((v) => v.loaded);
    if (loaded.length < n) return unavailable(`only ${loaded.length} of ${n} viewer sessions loaded within 5 min`);
    // Observers first (finding 7): every viewer logs each data-store-seq change with Date.now().
    for (const v of loaded) {
        await v.page.evaluate(() => {
            const el = document.querySelector('.mapstudio-map');
            window.__seqLog = [];
            new MutationObserver(() => window.__seqLog.push({ seq: Number(el.getAttribute('data-store-seq')), t: Date.now() }))
                .observe(el, { attributes: true, attributeFilter: ['data-store-seq'] });
        });
    }
    const sessions = await sessionsOfProject();
    const padId = itemId(CHANGED_PAD);
    let version = (await loadReply(editor, [padId])).versions[padId];
    const saves = [];
    const outcomes = [];
    for (let k = 0; k < PLANNED.mapChangedSaves; k++) {
        const t0 = await editor.evaluate(() => Date.now());
        const { reply } = await sendTimed(editor, 'edits.apply', { batchId: crypto.randomUUID(),
            ops: [{ op: 'update', entity: 'item', id: padId, baseVersion: version, data: { properties: { status: k % 2 ? 'producing' : 'shut in', wells: k } } }] });
        const o = classifyReply(reply, 'edits.apply.reply');
        outcomes.push(o);
        if (o !== 'ok') {
            saves.push({ outcome: o });
            continue;
        }
        version = reply.body.results[0].version;
        const seq = reply.body.seq;
        const until = Date.now() + CHANGED_WAIT_MS;
        let seen = [];
        while (Date.now() < until) {
            seen = await Promise.all(loaded.map((v) => v.page.evaluate((s) => {
                const hit = (window.__seqLog || []).find((e) => e.seq >= s);
                return hit ? hit.t : null;
            }, seq).catch(() => null)));
            if (seen.every((t) => t !== null)) break;
            await sleep(100);
        }
        const lat = seen.filter((t) => t !== null).map((t) => t - t0);
        saves.push({ seq, sessionsSeen: lat.length, sessions: loaded.length, maxMs: lat.length ? Math.max(...lat) : null, latencies: summarize(lat) });
        await sleep(1000);
    }
    const reasons = [];
    const c = countOutcomes(outcomes);
    if (c.busy) reasons.push(`${c.busy} busy refusal(s)`);
    if (c.timeouts) reasons.push(`${c.timeouts} save(s) without a reply`);
    for (const [code, m] of Object.entries(c.errors)) reasons.push(`${m} save(s) ${code}`);
    const good = saves.filter((s) => s.seq !== undefined);
    if (good.length !== PLANNED.mapChangedSaves) reasons.push(`${good.length} of ${PLANNED.mapChangedSaves} saves measured`);
    for (const s of good) {
        if (s.sessionsSeen < s.sessions) reasons.push(`seq ${s.seq}: ${s.sessionsSeen} of ${s.sessions} sessions saw it within ${CHANGED_WAIT_MS / 1000} s`);
    }
    const maxMs = good.length ? Math.max(...good.map((s) => s.maxMs ?? Infinity)) : null;
    if (maxMs !== null && maxMs >= LIMITS.mapChangedMaxMs) reasons.push(`slowest session ${Math.round(maxMs)} ms is not under ${LIMITS.mapChangedMaxMs} ms`);
    return {
        label: 'measured',
        sessions: n,
        method: `${n} anonymous contexts at 320x240 on / (1,000 items), a MutationObserver per page attached before the first save stamps Date.now() when data-store-seq changes; the editor page sends a 1-op edits.apply (Date.now() just before the send, the save included) 5 times, 1 s apart; latency = the first stamp at or above the save's seq minus the send time, the verdict on the slowest session over all saves; a session that did not see a seq within 10 s is a miss.`,
        sessionsRoute: sessions,
        saves,
        maxMs: maxMs === null ? null : Math.round(maxMs),
        counts: c,
        limit: `every session under ${LIMITS.mapChangedMaxMs} ms`,
        verdict: reasons.length ? 'miss' : 'pass',
        reasons
    };
}

/** One editor's edits.apply run inside its page: `count` timed batches after `warm` discarded ones. */
async function editsRun(page, ids, versions, size, count, warm = 1) {
    return page.evaluate(async ({ ids, versions, size, count, warm }) => {
        const v = { ...versions };
        const samples = [];
        const outcomes = [];
        for (let k = 0; k < count + warm; k++) {
            const pick = size === 1 ? [ids[k % ids.length]] : ids;
            const batch = { batchId: crypto.randomUUID(), ops: pick.map((id) => ({ op: 'update', entity: 'item', id, baseVersion: v[id],
                data: { properties: { status: k % 2 === 0 ? 'shut in' : 'producing', wells: k % 1000 } } })) };
            const t0 = performance.now();
            let r;
            try {
                r = await window.__mapStudioTest.send('edits.apply', batch);
            } catch (err) {
                r = { timeout: /No reply/.test(String(err && err.message)), type: 'reject', body: {} };
            }
            const ms = performance.now() - t0;
            if (r.type === 'edits.apply.reply') for (const res of r.body.results) v[res.id] = res.version;
            if (k >= warm) {
                samples.push(ms);
                outcomes.push(r.timeout ? { timeout: true } : { type: r.type, body: r.type === 'error' ? { code: r.body.code, message: r.body.message } : {} });
            }
        }
        return { samples, outcomes, versions: v };
    }, { ids, versions, size, count, warm });
}

/** Host CPU counters from /proc/stat (Linux), for the busy share of the whole box over a measure; null elsewhere. */
function hostCpu() {
    try {
        return procStatCpu(readFileSync('/proc/stat', 'utf8'));
    } catch {
        return null;
    }
}

function editsVerdict(runs, editors, size) {
    const samples = [];
    const outcomes = [];
    for (const r of runs) {
        r.outcomes.forEach((o, i) => {
            const c = classifyReply(o, 'edits.apply.reply');
            outcomes.push(c);
            if (c === 'ok') samples.push(r.samples[i]);
        });
    }
    return {
        label: 'measured',
        editors,
        opsPerBatch: size,
        method: `${editors} signed-in editor page(s) at once, each updating the properties of its own 50 pads (disjoint), versions from map.load and then from each reply; per editor one discarded warm-up then ${PLANNED.editsApplyPerEditor} timed batches of ${size} op(s), performance.now() around the test-hook send; median and p95 pooled over every editor's samples.`,
        ...latencyVerdict({ samples, outcomes, planned: PLANNED.editsApplyPerEditor * editors, limitMs: LIMITS.editsApplyP95Ms })
    };
}

// --- environment ---------------------------------------------------------------------------------

function playwrightVersion() {
    try {
        return require('@playwright/test/package.json').version;
    } catch {
        return 'unknown';
    }
}

function otherContainers() {
    try {
        return execFileSync('docker', ['ps', '--format', '{{.Names}}'], { encoding: 'utf8', timeout: 10_000 }).split('\n').filter(Boolean);
    } catch {
        return null;
    }
}

test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const renderer = await webglRenderer(page);
    await page.close();
    const info = await api('/data/api/v1/gateway-info');
    const modules = await api('/data/api/v1/modules/healthy');
    R.env = {
        target: process.env.PERF_TARGET || 'dev',
        phase: PHASE,
        startedAt: new Date().toISOString(),
        gateway: info ? { version: info.ignitionVersion, edition: info.edition, jvm: info.jvmVersion, allowUnsignedModules: info.allowUnsignedModules } : null,
        modules: modules && Array.isArray(modules.items)
            ? modules.items.map((m) => ({ id: m.id, version: m.version, state: m.state })).sort((a, b) => a.id.localeCompare(b.id)) : null,
        chromium: browser.version(),
        renderer: renderer ?? 'no WebGL context',
        softwareWebGL: !renderer || /swiftshader|llvmpipe|software/i.test(renderer),
        playwright: playwrightVersion(),
        cpus: os.cpus().length,
        memGiB: Math.round(os.totalmem() / 2 ** 30),
        loadAvgAtStart: os.loadavg().map((v) => Math.round(v * 100) / 100),
        containersRunning: otherContainers(),
        sampler: 'docker stats stream (CPU percent of one core, memory) and every 5 s currentGauges and the sessions route (perf/sampler.mjs)'
    };
    save();
});

test.afterAll(() => {
    R.env.loadAvgAtEnd = os.loadavg().map((v) => Math.round(v * 100) / 100);
    save();
});

// --- nomodule phase ------------------------------------------------------------------------------

test('nomodule: idle and 20 sessions on /plain', async ({ browser }) => {
    test.skip(PHASE !== 'nomodule', 'nomodule phase only');
    test.setTimeout(IDLE_MS + SESSIONS_MS + LOAD_ALL_MS + 180_000);
    try {
        const t0 = Date.now();
        await sleep(IDLE_MS);
        R.measures.idle = { label: 'measured', method: 'No browser session open; the Gateway without Map Studio.', ...windowResources(t0, Date.now()) };
    } catch (err) {
        R.measures.idle = crashed(err);
    }
    save();
    const viewers = [];
    try {
        viewers.push(...(await openViewers(browser, 20, '/plain', plainReady)));
        const loaded = viewers.filter((v) => v.loaded).length;
        if (loaded < 20) {
            R.measures.sessions20 = unavailable(`only ${loaded} of 20 sessions on /plain loaded`);
        } else {
            await sleep(SESSIONS_SETTLE_MS);
            const sessions = await sessionsOfProject();
            const t0 = Date.now();
            await sleep(SESSIONS_MS);
            R.measures.sessions20 = { label: 'measured', method: '20 anonymous contexts at 320x240 on /plain (a label, no Map Studio), 30 s settle, then the window.', sessionsRoute: sessions, ...windowResources(t0, Date.now()) };
        }
    } catch (err) {
        R.measures.sessions20 = crashed(err);
    } finally {
        await closeAll(viewers);
    }
    save();
});

// --- main phase ----------------------------------------------------------------------------------

const S = { editor: null, viewers: [] };

test('main: bundle and idle', async ({ browser }) => {
    test.skip(PHASE !== 'main', 'main phase only');
    test.setTimeout(IDLE_MS + 180_000);
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();
        const wire = new Map();
        page.on('response', (r) => {
            const p = new URL(r.url()).pathname;
            if (p.startsWith('/res/mapstudio/')) wire.set(p, r);
        });
        await page.goto(sessionUrl('/'), { waitUntil: 'load' });
        await expect(page.locator('.mapstudio-map')).toHaveAttribute('data-map-ready', 'true', { timeout: 90_000 });
        await sleep(2000);
        const files = [];
        for (const [p, r] of [...wire].sort()) {
            const body = await r.body().catch(() => null);
            if (body) files.push({ file: p.replace('/res/mapstudio/', ''), bytes: body.length });
        }
        await context.close();
        const dir = process.env.PERF_BASELINE_DIR || '';
        const old = [];
        const walk = (d, rel = '') => {
            for (const n of readdirSync(d)) {
                const full = path.join(d, n);
                if (statSync(full).isDirectory()) walk(full, rel + n + '/');
                else if (!/LICENSE/.test(n)) old.push({ file: rel + n, bytes: statSync(full).size });
            }
        };
        if (dir && existsSync(dir)) walk(dir);
        const newBytes = files.reduce((a, f) => a + f.bytes, 0);
        const oldBytes = old.reduce((a, f) => a + f.bytes, 0);
        R.measures.bundle = old.length
            ? { label: 'measured', method: 'Decoded bytes of every /res/mapstudio/* file the Gateway served while / loaded (1440x900, 2 s after the map was ready), against every file of the v0.1.0 release .modl\'s web jar (mounted/, its licence text left out), downloaded from the public release and checked against the SHA-256 in ign-scada-template\'s module lock.',
                files, v010: old, bytes: newBytes, v010Bytes: oldBytes, ...bundleVerdict(newBytes, oldBytes) }
            : unavailable('the v0.1.0 web files were not extracted (PERF_BASELINE_DIR)');
    } catch (err) {
        R.measures.bundle = crashed(err);
    }
    save();
    try {
        const t0 = Date.now();
        await sleep(IDLE_MS);
        R.measures.idle = { label: 'measured', method: 'No browser session open; the Gateway with Map Studio and the empty mapstudio-perf map.', ...windowResources(t0, Date.now()) };
    } catch (err) {
        R.measures.idle = crashed(err);
    }
    save();
});

test('main: 30 items', async ({ browser }) => {
    test.skip(PHASE !== 'main', 'main phase only');
    test.setTimeout(600_000);
    R.measures.mapLoad = R.measures.mapLoad || {};
    R.measures.frameRate = R.measures.frameRate || {};
    R.measures.openToDrawn = R.measures.openToDrawn || {};
    try {
        S.editor = await openEditor(browser);
        const before = await loadReply(S.editor.page);
        if (before.items !== 0) throw new Error(`the perf map is not empty before the run (${before.items} items); ops/perf.sh wipes it`);
        await seed(S.editor.page, 0, 30);
        R.measures.mapLoad['30'] = await measureMapLoad(S.editor.page, S.editor.frames, 30, false);
    } catch (err) {
        R.measures.mapLoad['30'] = crashed(err);
    }
    save();
    try {
        R.measures.openToDrawn['30'] = await openToDrawn(browser, 30);
        R.measures.frameRate['30'] = await frameRate(browser, 30);
    } catch (err) {
        R.measures.frameRate['30'] = crashed(err);
    }
    save();
});

test('main: 1,000 items, map.changed and 20 sessions', async ({ browser }) => {
    test.skip(PHASE !== 'main', 'main phase only');
    test.setTimeout(3 * LOAD_ALL_MS + SESSIONS_MS + 600_000);
    R.measures.mapChanged = {};
    R.measures.mapLoad = R.measures.mapLoad || {};
    R.measures.frameRate = R.measures.frameRate || {};
    R.measures.openToDrawn = R.measures.openToDrawn || {};
    try {
        if (!S.editor) S.editor = await openEditor(browser);
        await seed(S.editor.page, (await loadReply(S.editor.page)).items, 1000);
        R.measures.mapLoad['1000'] = await measureMapLoad(S.editor.page, S.editor.frames, 1000, false);
        R.measures.openToDrawn['1000'] = await openToDrawn(browser, 1000);
    } catch (err) {
        R.measures.mapLoad['1000'] = crashed(err);
    }
    try {
        R.measures.frameRate['1000'] = await frameRate(browser, 1000);
    } catch (err) {
        R.measures.frameRate['1000'] = crashed(err);
    }
    save();
    for (const n of [10, 50]) {
        try {
            const t0 = Date.now();
            S.viewers.push(...(await openViewers(browser, n - S.viewers.length, '/', mapReady(1000))));
            const openMs = Date.now() - t0;
            R.measures.mapChanged[String(n)] = { ...(await measureChanged(S.editor.page, S.viewers, n)), openSeconds: Math.round(openMs / 1000) };
        } catch (err) {
            R.measures.mapChanged[String(n)] = crashed(err);
        }
        save();
    }
    try {
        // Keep 20 loaded viewers, close the rest; fill up to 20 when fewer loaded.
        const keep = S.viewers.filter((v) => v.loaded).slice(0, 20);
        for (const v of S.viewers) if (!keep.includes(v)) await v.context.close().catch(() => {});
        S.viewers = keep;
        if (keep.length < 20) S.viewers.push(...(await openViewers(browser, 20 - keep.length, '/', mapReady(1000))));
        const loaded = S.viewers.filter((v) => v.loaded).length;
        if (loaded < 20) {
            R.measures.sessions20 = unavailable(`only ${loaded} of 20 sessions on / loaded`);
        } else {
            await S.editor.context.close();
            S.editor = null;
            await sleep(SESSIONS_SETTLE_MS);
            const sessions = await sessionsOfProject();
            const t0 = Date.now();
            await sleep(SESSIONS_MS);
            R.measures.sessions20 = { label: 'measured', method: '20 anonymous contexts at 320x240 on / with the 1,000-item map (kept from the map.changed measure), the editor closed, 30 s settle, then the window.', sessionsRoute: sessions, ...windowResources(t0, Date.now()) };
        }
    } catch (err) {
        R.measures.sessions20 = crashed(err);
    } finally {
        await closeAll(S.viewers);
    }
    save();
});

test('main: 5,000 items, edits.apply and frame rate', async ({ browser }) => {
    test.skip(PHASE !== 'main', 'main phase only');
    test.setTimeout(1_800_000);
    R.measures.editsApply = {};
    R.measures.mapLoad = R.measures.mapLoad || {};
    R.measures.frameRate = R.measures.frameRate || {};
    R.measures.openToDrawn = R.measures.openToDrawn || {};
    const editors = [];
    const state = [];
    try {
        if (!S.editor) S.editor = await openEditor(browser);
        await seed(S.editor.page, (await loadReply(S.editor.page)).items, 5000);
        R.measures.mapLoad['5000'] = await measureMapLoad(S.editor.page, S.editor.frames, 5000, true);
        R.measures.openToDrawn['5000'] = await openToDrawn(browser, 5000);
    } catch (err) {
        R.measures.mapLoad['5000'] = crashed(err);
    }
    save();
    try {
        editors.push(S.editor);
        // One sign-in at a time, each page opened at once so its session stays signed in.
        for (let e = 1; e < EDITORS; e++) editors.push(await openEditor(browser));
        for (let e = 0; e < editors.length; e++) {
            const ids = editorPads(e).map(itemId);
            const { versions, items } = await loadReply(editors[e].page, ids);
            if (items !== 5000) throw new Error(`editor ${e + 1} loaded ${items} items, not 5000`);
            if (Object.keys(versions).length !== ids.length) throw new Error(`editor ${e + 1} found ${Object.keys(versions).length} of its ${ids.length} pads`);
            state.push({ ids, versions });
        }
        for (const [n, size] of [[1, 1], [1, 50], [editors.length, 1], [editors.length, 50]]) {
            const h0 = hostCpu();
            const t0 = Date.now();
            const runs = await Promise.all(editors.slice(0, n).map(async (ed, e) => {
                const r = await editsRun(ed.page, state[e].ids, state[e].versions, size, PLANNED.editsApplyPerEditor);
                state[e].versions = r.versions;
                return r;
            }));
            R.measures.editsApply[`${size}op-${n}editor${n > 1 ? 's' : ''}`] = { ...editsVerdict(runs, n, size),
                openEditorPages: editors.length, hostCpuBusyPct: hostBusyPct(h0, hostCpu()), gateway: windowResources(t0, Date.now()) };
            save();
        }
        if (editors.length < 10) R.measures.editsApply.note = `${editors.length} editors (PERF_EDITORS), not 10`;
    } catch (err) {
        R.measures.editsApply.crash = crashed(err);
    } finally {
        for (const ed of editors.slice(1)) await ed.context.close().catch(() => {});
    }
    save();
    // Recorded, not judged (story 17 cause analysis): the 10 editors' 50-op streams sent at once from
    // the one editor page left open, so 9 fewer browser renderers share the box. Set beside
    // 50op-10editors it separates what the Gateway's write path costs (the project's batches are
    // serialised by design) from what 10 browsers redrawing the 5,000-item map cost the box.
    try {
        if (state.length === EDITORS && S.editor) {
            const h0 = hostCpu();
            const t0 = Date.now();
            const runs = await Promise.all(state.map(async (st) => {
                const r = await editsRun(S.editor.page, st.ids, st.versions, 50, PLANNED.editsApplyPerEditor);
                st.versions = r.versions;
                return r;
            }));
            const v = editsVerdict(runs, EDITORS, 50);
            // Not judged on p95; a busy refusal, a timeout, an error or a missing sample is still a miss.
            const countReasons = v.reasons.filter((r) => !/^p95 /.test(r));
            R.measures.editsApply[`50op-${EDITORS}streams-1page`] = { ...v, reasons: countReasons,
                verdict: countReasons.length ? 'miss' : 'recorded',
                method: `The ${EDITORS} editors' pads and batches of 50op-${EDITORS}editors, as ${EDITORS} concurrent streams from the one editor page left open (the other editor pages closed); per stream one discarded warm-up then ${PLANNED.editsApplyPerEditor} timed batches; recorded beside 50op-${EDITORS}editors to separate the box's browser load from the Gateway's write path, not judged.`,
                limit: 'none (recorded)', openEditorPages: 1, hostCpuBusyPct: hostBusyPct(h0, hostCpu()), gateway: windowResources(t0, Date.now()) };
        }
    } catch (err) {
        R.measures.editsApply[`50op-${EDITORS}streams-1page`] = crashed(err);
    }
    save();
    try {
        R.measures.frameRate['5000'] = await frameRate(browser, 5000);
    } catch (err) {
        R.measures.frameRate['5000'] = crashed(err);
    }
    save();
});

test('main: list refresh', async ({ browser }) => {
    test.skip(PHASE !== 'main', 'main phase only');
    test.setTimeout(600_000);
    try {
        if (!S.editor) S.editor = await openEditor(browser);
        const page = S.editor.page;
        const out = page.locator('#mapstudio-perf-refresh-result');
        const press = async () => {
            const before = await out.innerText();
            await page.locator('#mapstudio-perf-refresh').click();
            await expect.poll(async () => {
                const text = await out.innerText();
                return text !== before && /"(ms|error|refused)"/.test(text);
            }, { timeout: 60_000 }).toBe(true);
            return JSON.parse(await out.innerText());
        };
        await press(); // warm-up, not counted
        // The same settle as the other windows, then a control window of the open editor page with no
        // refresh, so a 1 s CPU reading during the refreshes can be told from the page's own cost.
        await sleep(SESSIONS_SETTLE_MS);
        const c0 = Date.now();
        await sleep(15_000);
        const control = windowResources(c0, Date.now());
        const t0 = Date.now();
        const results = [];
        for (let i = 0; i < PLANNED.listRefresh; i++) results.push(await press());
        const t1 = Date.now();
        const outcomes = results.map((r) => (typeof r.ms === 'number' ? 'ok' : 'error:' + (r.refused ? 'refused' : r.error)));
        R.measures.listRefresh = {
            label: 'measured',
            assets: 300,
            method: 'The /edit page\'s "Time a list refresh" button (signed-in map editor) runs mapstudio_perf.timeRefresh: System.nanoTime() around system.mapstudio.refreshAdapters("mapstudio-perf"), which waits for the kind and the asset list (300 assets) to answer; one warm-up, 30 s settle and a 15 s control window, then 10 presses one after the other, each waiting for its result; CPU from the docker stats samples between the first press and the last result.',
            statuses: results.map((r) => ({ kinds: r.kinds && r.kinds.status, assets: r.assets && r.assets.status })),
            ...latencyVerdict({ samples: results.map((r) => r.ms), outcomes, planned: PLANNED.listRefresh, limitMs: LIMITS.listRefreshMaxMs, stat: 'max' }),
            ...windowResources(t0, t1),
            control: { method: '15 s just before the refreshes: the signed-in editor page open on the 5,000-item map, no refresh pressed.', ...control }
        };
    } catch (err) {
        R.measures.listRefresh = crashed(err);
    } finally {
        if (S.editor) await S.editor.context.close().catch(() => {});
        S.editor = null;
    }
    save();
});
