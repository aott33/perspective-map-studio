// The perf run's Gateway sampler (epic 2 story 17), started by ops/perf.sh in the background beside
// the runner and stopped with SIGTERM. It appends one JSON line per sample to --out, so a kill loses
// nothing:
//   {kind: 'stats', t, cpuPct, memMiB}    from a `docker stats` stream of the Gateway container
//                                          (CPU in percent of one core, as docker reports it; about one a second)
//   {kind: 'gauges', t, heapMiB, maxHeapMiB, gatewayCpu, sessions}   every 5 s from the Gateway's REST API:
//                                          GET /data/api/v1/systemPerformance/currentGauges and
//                                          /data/perspective/api/v1/sessions/ (routes proven by the
//                                          template's tests/load/gateway_stats.py [live 8.3.9, template])
//
//   node perf/sampler.mjs --container NAME --gateway URL --token-file FILE --out FILE
//
// The API token is read from the file and goes into the X-Ignition-API-Token header only; it is
// never printed or written. A failed call records nulls and the sampler keeps sampling.

import { spawn } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

const GAUGES = '/data/api/v1/systemPerformance/currentGauges';
const SESSIONS = '/data/perspective/api/v1/sessions/';
const GAUGE_EVERY_MS = 5000;
const SIZE_MIB = { B: 1 / 1048576, KB: 1e3 / 1048576, KIB: 1 / 1024, MB: 1e6 / 1048576, MIB: 1, GB: 1e9 / 1048576, GIB: 1024 };

/** '2.512GiB' or '94MB' as MiB; null when it is not a size. */
export function parseSize(text) {
    const m = /^\s*([0-9.]+)\s*([A-Za-z]*)\s*$/.exec(text || '');
    if (!m) return null;
    const unit = (m[2] || 'B').toUpperCase();
    return unit in SIZE_MIB ? Number(m[1]) * SIZE_MIB[unit] : null;
}

/** One `docker stats --format '{{json .}}'` line (terminal control codes stripped); null when unreadable. */
export function parseStatsLine(line) {
    // eslint-disable-next-line no-control-regex
    const clean = String(line).replace(/\u001b\[[0-9;]*[A-Za-z]/g, '').trim();
    if (!clean.startsWith('{')) return null;
    try {
        const d = JSON.parse(clean);
        const cpu = Number(String(d.CPUPerc || '').replace('%', ''));
        const mem = String(d.MemUsage || '').split('/')[0];
        return { cpuPct: Number.isFinite(cpu) ? cpu : null, memMiB: parseSize(mem) };
    } catch {
        return null;
    }
}

/** True when a stats line repeats the last kept reading within 750 ms (a redraw, not a new sample). */
export function isRepeat(last, s, t) {
    return !!last && t - last.t < 750 && last.cpuPct === s.cpuPct && last.memMiB === s.memMiB;
}

function arg(argv, name) {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
}

async function getJson(base, route, token) {
    try {
        const r = await fetch(base + route, { headers: { 'X-Ignition-API-Token': token, Accept: 'application/json' },
            signal: AbortSignal.timeout(4000) });
        return r.ok ? await r.json() : null;
    } catch {
        return null;
    }
}

async function main(argv) {
    const container = arg(argv, '--container');
    const gateway = (arg(argv, '--gateway') || '').replace(/\/$/, '');
    const tokenFile = arg(argv, '--token-file');
    const out = arg(argv, '--out');
    if (!container || !gateway || !tokenFile || !out) {
        console.error('usage: node perf/sampler.mjs --container NAME --gateway URL --token-file FILE --out FILE');
        process.exit(2);
    }
    const token = readFileSync(tokenFile, 'utf8').trim();
    const write = (o) => appendFileSync(out, JSON.stringify(o) + '\n');
    const stats = spawn('docker', ['stats', '--format', '{{json .}}', container], { stdio: ['ignore', 'pipe', 'ignore'] });
    let buf = '';
    let last = null;
    stats.stdout.on('data', (chunk) => {
        buf += chunk.toString('utf8');
        const parts = buf.split('\n');
        buf = parts.pop();
        for (const p of parts) {
            const s = parseStatsLine(p);
            if (!s) continue;
            const t = Date.now();
            // The stream redraws every 0.5 s but docker reads the container's stats about once a second
            // [live, docker 2026-10-27]: a redraw that repeats the last reading is not a new sample.
            if (isRepeat(last, s, t)) continue;
            last = { ...s, t };
            write({ kind: 'stats', t, ...s });
        }
    });
    const gauges = async () => {
        const g = await getJson(gateway, GAUGES, token);
        const s = await getJson(gateway, SESSIONS, token);
        write({
            kind: 'gauges',
            t: Date.now(),
            heapMiB: g && typeof g.heapMemory === 'number' ? g.heapMemory / 1048576 : null,
            maxHeapMiB: g && typeof g.maxMemory === 'number' ? g.maxMemory / 1048576 : null,
            gatewayCpu: g && typeof g.cpu === 'number' ? g.cpu : null,
            sessions: s && s.metadata && typeof s.metadata.total === 'number' ? s.metadata.total
                : (s && Array.isArray(s.items) ? s.items.length : null)
        });
    };
    const timer = setInterval(gauges, GAUGE_EVERY_MS);
    await gauges();
    const stop = () => {
        clearInterval(timer);
        stats.kill('SIGTERM');
        process.exit(0);
    };
    process.on('SIGTERM', stop);
    process.on('SIGINT', stop);
}

if (process.argv[1] && process.argv[1].endsWith('sampler.mjs')) {
    await main(process.argv.slice(2));
}
