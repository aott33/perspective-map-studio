// The perf result (epic 2 story 17): statistics, limits and verdicts, and the merge of the two phase
// files into e2e/out/perf.json. Pure functions (unit tested in perf.test.mjs) plus a small CLI:
//
//   node perf/result.mjs merge [--record <version> --target <dev|template>]
//
// merge reads e2e/out/perf/phase-nomodule.json and phase-main.json, writes e2e/out/perf.json and,
// with --record and no crashed measure, docs/perf/<version>-<target>.json without timestamps. Exit
// 0 when no limit is missed, 3 when one is, 1 when a phase file is missing or unreadable.
//
// Percentiles are nearest-rank: the value at rank ceil(p / 100 * n) of the n samples sorted
// ascending, so p95 of 10 samples is the largest and of 20 the 19th. Every statistic carries n.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA = 1;
export const PERCENTILE_METHOD = 'nearest-rank: the value at rank ceil(p/100 * n) of the n samples sorted ascending';

/** The owner's limits (plan Decision, 2026-10-27). */
export const LIMITS = {
    mapLoadP95Ms: 1000, // map.load at 5,000 items, p95 of 10
    editsApplyP95Ms: 300, // edits.apply, every combination
    mapChangedMaxMs: 1000, // every open session within 1 s of the editor's send
    listRefreshMaxMs: 1000, // every refresh under 1 s
    spikeOverIdlePct: 50, // no 1 s CPU sample during refreshes above the idle mean plus 50% of one core
    idleCpuDeltaPct: 2, // idle: Map Studio adds at most 2% of one core (mean)
    idleHeapDeltaMiB: 64,
    sessionsCpuDeltaPct: 10, // 20 sessions on the 1,000-item map against 20 on /plain without the module
    sessionsHeapDeltaMiB: 200,
    bundleGrowthPct: 10 // against 0.1.0
};

/** Planned sample counts (a verdict needs exactly these many good samples). */
export const PLANNED = {
    mapLoad: 10,
    editsApplyPerEditor: 20,
    mapChangedSaves: 5,
    listRefresh: 10
};

/** Nearest-rank percentile of finite numbers; null for none. */
export function percentile(values, p) {
    const v = values.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
    if (v.length === 0) return null;
    const rank = Math.max(1, Math.ceil((p / 100) * v.length));
    return v[Math.min(rank, v.length) - 1];
}

const round = (v, d = 1) => (v === null || v === undefined ? null : Math.round(v * 10 ** d) / 10 ** d);

/** {n, min, median, p95, max, mean} of samples (median and p95 nearest-rank). */
export function summarize(values) {
    const v = values.filter((x) => typeof x === 'number' && Number.isFinite(x));
    if (v.length === 0) return { n: 0, min: null, median: null, p95: null, max: null, mean: null };
    return {
        n: v.length,
        min: round(Math.min(...v)),
        median: round(percentile(v, 50)),
        p95: round(percentile(v, 95)),
        max: round(Math.max(...v)),
        mean: round(v.reduce((a, b) => a + b, 0) / v.length)
    };
}

/**
 * How a reply envelope (or a rejected send) counts: 'ok' when its type is `expectType`, 'busy' for
 * the work pool's refusal (store-unreachable whose message says busy), 'timeout' for a send that got
 * no reply, else 'error:<code>'.
 */
export function classifyReply(reply, expectType) {
    if (!reply) return 'error:none';
    if (reply.timeout) return 'timeout';
    if (reply.type === expectType) return 'ok';
    if (reply.type === 'error') {
        const code = reply.body && reply.body.code;
        if (code === 'store-unreachable' && /busy/i.test(String(reply.body.message || ''))) return 'busy';
        return 'error:' + (code || 'unknown');
    }
    return 'error:type ' + reply.type;
}

/** Count outcomes: {ok, busy, timeouts, errors: {code: n}}. */
export function countOutcomes(outcomes) {
    const c = { ok: 0, busy: 0, timeouts: 0, errors: {} };
    for (const o of outcomes) {
        if (o === 'ok') c.ok++;
        else if (o === 'busy') c.busy++;
        else if (o === 'timeout') c.timeouts++;
        else c.errors[o] = (c.errors[o] || 0) + 1;
    }
    return c;
}

/**
 * The verdict of a timed measure against a limit on one statistic. A busy refusal, a timeout or an
 * error envelope makes it a miss (counted, never retried); fewer good samples than planned is a miss
 * too, so a dropped sample cannot pass for a fast one. `limitMs` null judges only the counts.
 */
export function latencyVerdict({ samples, outcomes, planned, limitMs, stat = 'p95' }) {
    const s = summarize(samples);
    const counts = countOutcomes(outcomes);
    const reasons = [];
    if (counts.busy) reasons.push(`${counts.busy} busy refusal(s)`);
    if (counts.timeouts) reasons.push(`${counts.timeouts} send(s) without a reply in 30 s`);
    for (const [code, n] of Object.entries(counts.errors)) reasons.push(`${n} reply(ies) ${code}`);
    if (s.n !== planned) reasons.push(`${s.n} good samples, ${planned} planned`);
    if (limitMs !== null && s[stat] !== null && s[stat] >= limitMs) reasons.push(`${stat} ${s[stat]} ms is not under ${limitMs} ms`);
    return { stats: s, counts, verdict: reasons.length ? 'miss' : 'pass', reasons, limit: limitMs === null ? 'none' : `${stat} under ${limitMs} ms` };
}

/** The idle and total jiffies of the first (all CPUs) line of /proc/stat's text; null when unreadable. */
export function procStatCpu(text) {
    const line = String(text || '').split('\n')[0].trim();
    if (!/^cpu\s/.test(line)) return null;
    const f = line.split(/\s+/).slice(1).map(Number);
    if (f.length < 4 || f.some((x) => !Number.isFinite(x))) return null;
    return { idle: f[3] + (f[4] || 0), total: f.reduce((a, b) => a + b, 0) };
}

/** The whole box's CPU busy share between two procStatCpu readings, in percent of all CPUs (1 decimal). */
export function hostBusyPct(a, b) {
    if (!a || !b || b.total <= a.total) return null;
    return round((1 - (b.idle - a.idle) / (b.total - a.total)) * 100, 1);
}

/** Samples of a sampler file (JSON lines) between t0 and t1 (ms since the epoch). */
export function inWindow(samples, t0, t1) {
    return samples.filter((s) => s.t >= t0 && s.t <= t1);
}

/** CPU and heap of a window: docker stats CPU (percent of one core) mean and 1 s max, heap min/mean. */
export function resourceStats(samples) {
    const cpu = samples.filter((s) => s.kind === 'stats' && typeof s.cpuPct === 'number').map((s) => s.cpuPct);
    const mem = samples.filter((s) => s.kind === 'stats' && typeof s.memMiB === 'number').map((s) => s.memMiB);
    const heap = samples.filter((s) => s.kind === 'gauges' && typeof s.heapMiB === 'number').map((s) => s.heapMiB);
    const statsT = samples.filter((s) => s.kind === 'stats').map((s) => s.t);
    const gaps = statsT.slice(1).map((t, i) => t - statsT[i]);
    return {
        cpuSamples: cpu.length,
        cpuIntervalMs: gaps.length ? round(percentile(gaps, 50), 0) : null,
        cpuMeanPct: cpu.length ? round(cpu.reduce((a, b) => a + b, 0) / cpu.length, 2) : null,
        cpuMaxPct: cpu.length ? round(Math.max(...cpu), 2) : null,
        containerMemMeanMiB: mem.length ? round(mem.reduce((a, b) => a + b, 0) / mem.length) : null,
        heapSamples: heap.length,
        heapMinMiB: heap.length ? round(Math.min(...heap)) : null,
        heapMeanMiB: heap.length ? round(heap.reduce((a, b) => a + b, 0) / heap.length) : null
    };
}

/** Map Studio's added cost: main minus nomodule, judged on CPU mean and heap minimum. */
export function deltaVerdict(main, base, cpuLimitPct, heapLimitMiB) {
    if (!main || !base || main.status === 'unavailable' || base.status === 'unavailable') {
        return { verdict: 'unavailable', reasons: ['a phase of this pair is unavailable'] };
    }
    const m = main.resources;
    const b = base.resources;
    if (!m || !b || m.cpuMeanPct === null || b.cpuMeanPct === null || m.heapMinMiB === null || b.heapMinMiB === null) {
        return { verdict: 'unavailable', reasons: ['no CPU or heap samples in a window'] };
    }
    const cpuDelta = round(m.cpuMeanPct - b.cpuMeanPct, 2);
    const heapDelta = round(m.heapMinMiB - b.heapMinMiB);
    const reasons = [];
    if (cpuDelta > cpuLimitPct) reasons.push(`CPU mean +${cpuDelta}% of one core is over ${cpuLimitPct}%`);
    if (heapDelta > heapLimitMiB) reasons.push(`heap minimum +${heapDelta} MiB is over ${heapLimitMiB} MiB`);
    return {
        cpuDeltaPct: cpuDelta,
        heapDeltaMiB: heapDelta,
        containerMemDeltaMiB: m.containerMemMeanMiB !== null && b.containerMemMeanMiB !== null
            ? round(m.containerMemMeanMiB - b.containerMemMeanMiB) : null,
        limit: `CPU mean at most +${cpuLimitPct}% of one core and heap minimum at most +${heapLimitMiB} MiB`,
        verdict: reasons.length ? 'miss' : 'pass',
        reasons
    };
}

/** The spike verdict: no 1 s CPU sample during the refreshes above the idle mean plus the margin. */
export function spikeVerdict(refreshResources, idleResources, marginPct = LIMITS.spikeOverIdlePct) {
    if (!refreshResources || !idleResources || refreshResources.cpuMaxPct === null || idleResources.cpuMeanPct === null) {
        return { verdict: 'unavailable', reasons: ['no CPU samples for the refreshes or the idle window'] };
    }
    const ceiling = round(idleResources.cpuMeanPct + marginPct, 2);
    const ok = refreshResources.cpuMaxPct <= ceiling;
    return {
        ceilingPct: ceiling,
        maxPct: refreshResources.cpuMaxPct,
        limit: `no 1 s CPU sample above the idle mean + ${marginPct}% of one core`,
        verdict: ok ? 'pass' : 'miss',
        reasons: ok ? [] : [`a 1 s sample of ${refreshResources.cpuMaxPct}% is above ${ceiling}%`]
    };
}

/** Bundle growth against 0.1.0. */
export function bundleVerdict(newBytes, oldBytes, limitPct = LIMITS.bundleGrowthPct) {
    if (!newBytes || !oldBytes) return { verdict: 'unavailable', reasons: ['a bundle size is missing'] };
    const growthPct = round(((newBytes - oldBytes) / oldBytes) * 100, 2);
    return {
        growthPct,
        limit: `grows less than ${limitPct}% against 0.1.0`,
        verdict: growthPct < limitPct ? 'pass' : 'miss',
        reasons: growthPct < limitPct ? [] : [`grew ${growthPct}%`]
    };
}

/** Every verdict in a result, as [{path, verdict, reasons}]. */
export function verdicts(result) {
    const out = [];
    const walk = (node, at) => {
        if (!node || typeof node !== 'object') return;
        if (typeof node.verdict === 'string') out.push({ path: at, verdict: node.verdict, reasons: node.reasons || [] });
        for (const [k, v] of Object.entries(node)) {
            if (k !== 'stats' && k !== 'counts' && v && typeof v === 'object') walk(v, at ? `${at}.${k}` : k);
        }
    };
    walk(result.measures, '');
    return out;
}

/** 3 when a limit is missed, else 0. */
export function exitCode(result) {
    return verdicts(result).some((v) => v.verdict === 'miss') ? 3 : 0;
}

/** True when a measure crashed (its reason starts with 'crashed'). */
export function anyCrashed(node) {
    if (!node || typeof node !== 'object') return false;
    if (node.status === 'unavailable' && /^crashed/.test(String(node.reason || ''))) return true;
    return Object.values(node).some((v) => typeof v === 'object' && anyCrashed(v));
}

/** Merge the phase files and judge the comparisons that need both phases. */
export function merge(nomodule, main) {
    const m = (main && main.measures) || {};
    const b = (nomodule && nomodule.measures) || {};
    const result = {
        schema: SCHEMA,
        generatedAt: new Date().toISOString(),
        percentileMethod: PERCENTILE_METHOD,
        limits: LIMITS,
        planned: PLANNED,
        env: { main: main ? main.env : null, nomodule: nomodule ? nomodule.env : null },
        measures: { ...m }
    };
    result.measures.idleAdded = deltaVerdict(m.idle, b.idle, LIMITS.idleCpuDeltaPct, LIMITS.idleHeapDeltaMiB);
    result.measures.idleAdded.method = 'Main phase idle window minus the nomodule phase idle window (same settle, no browser open): docker stats CPU mean, and the minimum of the Gateway heapMemory gauge (a live-set estimate [unverified]).';
    result.measures.sessionsAdded = deltaVerdict(m.sessions20, b.sessions20, LIMITS.sessionsCpuDeltaPct, LIMITS.sessionsHeapDeltaMiB);
    result.measures.sessionsAdded.method = '20 anonymous sessions on / of the 1,000-item map with Map Studio, against 20 on /plain without the module; window means as for idle.';
    result.measures.baseline = { idle: b.idle || null, sessions20Plain: b.sessions20 || null };
    if (m.listRefresh && m.listRefresh.resources && m.idle && m.idle.resources) {
        result.measures.listRefresh.spike = spikeVerdict(m.listRefresh.resources, m.idle.resources);
    }
    return result;
}

/** A copy without generatedAt, for the committed record. */
export function withoutTimestamps(result) {
    const copy = JSON.parse(JSON.stringify(result));
    delete copy.generatedAt;
    for (const env of Object.values(copy.env || {})) {
        if (env && typeof env === 'object') delete env.startedAt;
    }
    return copy;
}

function readJson(file) {
    return JSON.parse(readFileSync(file, 'utf8'));
}

function cli(argv) {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const e2e = path.resolve(here, '..');
    const repo = path.resolve(e2e, '..');
    const out = path.join(e2e, 'out');
    const arg = (name) => {
        const i = argv.indexOf(name);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    if (argv[0] !== 'merge') {
        console.error('usage: node perf/result.mjs merge [--record <version> --target <dev|template>]');
        return 1;
    }
    const files = { nomodule: path.join(out, 'perf', 'phase-nomodule.json'), main: path.join(out, 'perf', 'phase-main.json') };
    let nomodule = null;
    let main;
    try {
        main = readJson(files.main);
        if (existsSync(files.nomodule)) nomodule = readJson(files.nomodule);
    } catch (err) {
        console.error('perf: cannot read a phase file: ' + (err && err.message ? err.message : err));
        return 1;
    }
    const result = merge(nomodule, main);
    writeFileSync(path.join(out, 'perf.json'), JSON.stringify(result, null, 2) + '\n');
    for (const v of verdicts(result)) {
        console.log(`${v.verdict.padEnd(11)} ${v.path}${v.reasons.length ? ' (' + v.reasons.join('; ') + ')' : ''}`);
    }
    const version = arg('--record');
    if (version) {
        if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version)) {
            console.error('perf: --record takes a version such as 0.2.0');
            return 1;
        }
        if (anyCrashed(result.measures)) {
            console.error('perf: a measure crashed, so docs/perf is not written');
        } else {
            const target = arg('--target') || 'dev';
            const file = path.join(repo, 'docs', 'perf', `${version}-${target}.json`);
            mkdirSync(path.dirname(file), { recursive: true });
            writeFileSync(file, JSON.stringify(withoutTimestamps(result), null, 2) + '\n');
            console.log('perf: recorded ' + path.relative(repo, file));
        }
    }
    return exitCode(result);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(cli(process.argv.slice(2)));
}
