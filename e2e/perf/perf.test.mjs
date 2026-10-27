// Unit tests of the perf run's pure parts (epic 2 story 17): items, percentiles, verdicts, busy
// counting, the merge and the comparison. Run by `npm run test:unit`; no Gateway needed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { CHANGED_PAD, createBatches, editorPads, itemData, itemId, uuid5 } from './items.mjs';
import { LIMITS, anyCrashed, bundleVerdict, classifyReply, countOutcomes, deltaVerdict, exitCode, latencyVerdict,
    merge, percentile, resourceStats, spikeVerdict, summarize, verdicts, withoutTimestamps } from './result.mjs';
import { compare, headlines } from './compare.mjs';
import { isRepeat, parseSize, parseStatsLine } from './sampler.mjs';

test('uuid5 matches Python uuid.uuid5(NAMESPACE_URL, name)', () => {
    // python3 -c "import uuid; print(uuid.uuid5(uuid.NAMESPACE_URL, 'python.org'))"
    assert.equal(uuid5('python.org'), '7af94e2b-4dd9-50f0-9c9a-8a48519bdef0');
    assert.equal(itemId(0), uuid5('mapstudio-perf/0'));
    assert.notEqual(itemId(0), itemId(1));
});

test('items are deterministic: pads on even n, lines on odd n, inside the start view', () => {
    assert.deepEqual(itemData(0), itemData(0));
    assert.equal(itemData(0).kind, 'pad');
    assert.equal(itemData(0).properties.status, 'producing');
    assert.equal(itemData(1).kind, 'line');
    assert.equal(itemData(1).geometry.type, 'LineString');
    for (const n of [0, 1, 999, 4998, 4999]) {
        const [lon, lat] = itemData(n).geometry.type === 'Point' ? itemData(n).geometry.coordinates : itemData(n).geometry.coordinates[0];
        assert.ok(lon > -105.06 && lon < -104.89, `lon of ${n}`);
        assert.ok(lat > 39.70 && lat < 39.79, `lat of ${n}`);
    }
    const ids = new Set(Array.from({ length: 5000 }, (_, n) => itemId(n)));
    assert.equal(ids.size, 5000);
});

test('create batches split at 500 ops and cover the range once', () => {
    const b = createBatches(30, 1000);
    assert.deepEqual(b.map((x) => x.ops.length), [500, 470]);
    assert.equal(b[0].ops[0].id, itemId(30));
    assert.equal(b[1].ops[469].id, itemId(999));
    assert.ok(b.every((x) => x.ops.every((o) => o.op === 'create' && o.baseVersion === 0)));
    assert.equal(createBatches(5, 5).length, 0);
    assert.throws(() => createBatches(0, 5001));
    assert.throws(() => createBatches(10, 5));
});

test('editor pads are disjoint pads inside the first 1,000 items', () => {
    const all = Array.from({ length: 10 }, (_, e) => editorPads(e)).flat();
    assert.equal(new Set(all).size, 500);
    assert.ok(all.every((n) => n % 2 === 0 && n < 1000));
    assert.equal(CHANGED_PAD % 2, 0);
});

test('nearest-rank percentile: p95 of 10 is the maximum, of 20 the 19th', () => {
    const ten = [5, 1, 9, 3, 7, 2, 8, 4, 10, 6];
    assert.equal(percentile(ten, 95), 10);
    assert.equal(percentile(ten, 50), 5);
    const twenty = Array.from({ length: 20 }, (_, i) => i + 1);
    assert.equal(percentile(twenty, 95), 19);
    assert.equal(percentile(twenty, 50), 10);
    assert.equal(percentile([], 95), null);
    assert.equal(percentile([NaN, 4], 95), 4);
    assert.deepEqual(summarize([2, 4]), { n: 2, min: 2, median: 2, p95: 4, max: 4, mean: 3 });
});

test('a busy refusal, a timeout or an error is counted and makes the measure a miss', () => {
    const busy = { type: 'error', body: { code: 'store-unreachable', message: 'Map Studio is busy with other map requests; nothing was saved.' } };
    assert.equal(classifyReply(busy, 'edits.apply.reply'), 'busy');
    assert.equal(classifyReply({ type: 'error', body: { code: 'store-unreachable', message: 'The map store is starting.' } }, 'x'), 'error:store-unreachable');
    assert.equal(classifyReply({ timeout: true }, 'x'), 'timeout');
    assert.equal(classifyReply({ type: 'edits.apply.reply' }, 'edits.apply.reply'), 'ok');
    assert.deepEqual(countOutcomes(['ok', 'busy', 'timeout', 'error:conflict', 'error:conflict']),
        { ok: 1, busy: 1, timeouts: 1, errors: { 'error:conflict': 2 } });
    const fast = Array.from({ length: 19 }, () => 10);
    const v = latencyVerdict({ samples: fast, outcomes: [...fast.map(() => 'ok'), 'busy'], planned: 20, limitMs: 300 });
    assert.equal(v.verdict, 'miss');
    assert.match(v.reasons.join(' '), /1 busy/);
    assert.match(v.reasons.join(' '), /19 good samples, 20 planned/);
});

test('a measure with every sample timed out cannot pass', () => {
    const v = latencyVerdict({ samples: [], outcomes: Array(10).fill('timeout'), planned: 10, limitMs: 1000 });
    assert.equal(v.verdict, 'miss');
    assert.equal(v.stats.n, 0);
});

test('latency verdicts: pass under the limit, miss at or over it, counts only without a limit', () => {
    const ok = Array(10).fill('ok');
    assert.equal(latencyVerdict({ samples: [1, 2, 3, 4, 5, 6, 7, 8, 9, 999], outcomes: ok, planned: 10, limitMs: 1000 }).verdict, 'pass');
    assert.equal(latencyVerdict({ samples: [1, 2, 3, 4, 5, 6, 7, 8, 9, 1000], outcomes: ok, planned: 10, limitMs: 1000 }).verdict, 'miss');
    assert.equal(latencyVerdict({ samples: Array(10).fill(5000), outcomes: ok, planned: 10, limitMs: null }).verdict, 'pass');
    assert.equal(latencyVerdict({ samples: [1, 2], outcomes: ok, planned: 10, limitMs: 900, stat: 'max' }).limit, 'max under 900 ms');
});

test('resource stats, deltas, the spike and the bundle', () => {
    const samples = [
        { kind: 'stats', t: 0, cpuPct: 1, memMiB: 900 }, { kind: 'stats', t: 1000, cpuPct: 3, memMiB: 910 },
        { kind: 'gauges', t: 500, heapMiB: 300 }, { kind: 'gauges', t: 5500, heapMiB: 280 }];
    const r = resourceStats(samples);
    assert.equal(r.cpuMeanPct, 2);
    assert.equal(r.cpuMaxPct, 3);
    assert.equal(r.heapMinMiB, 280);
    assert.equal(r.cpuIntervalMs, 1000);
    const base = { resources: { cpuMeanPct: 1, heapMinMiB: 250, containerMemMeanMiB: 800 } };
    const main = { resources: { cpuMeanPct: 2.5, heapMinMiB: 300, containerMemMeanMiB: 900 } };
    const d = deltaVerdict(main, base, LIMITS.idleCpuDeltaPct, LIMITS.idleHeapDeltaMiB);
    assert.equal(d.verdict, 'pass');
    assert.equal(d.cpuDeltaPct, 1.5);
    assert.equal(d.heapDeltaMiB, 50);
    assert.equal(deltaVerdict({ resources: { ...main.resources, heapMinMiB: 400 } }, base, 2, 64).verdict, 'miss');
    assert.equal(deltaVerdict({ status: 'unavailable' }, base, 2, 64).verdict, 'unavailable');
    assert.equal(spikeVerdict({ cpuMaxPct: 40 }, { cpuMeanPct: 2 }).verdict, 'pass');
    assert.equal(spikeVerdict({ cpuMaxPct: 60 }, { cpuMeanPct: 2 }).verdict, 'miss');
    assert.equal(bundleVerdict(109, 100).verdict, 'pass');
    assert.equal(bundleVerdict(110, 100).verdict, 'miss');
    assert.equal(bundleVerdict(0, 100).verdict, 'unavailable');
});

test('merge judges the added cost from both phases and the exit code follows the verdicts', () => {
    const res = (cpu, heap) => ({ label: 'measured', resources: { cpuMeanPct: cpu, cpuMaxPct: cpu + 5, heapMinMiB: heap, containerMemMeanMiB: null } });
    const nomodule = { env: { phase: 'nomodule', startedAt: 'x' }, measures: { idle: res(1, 200), sessions20: res(5, 260) } };
    const main = { env: { phase: 'main', startedAt: 'y' }, measures: { idle: res(2, 230), sessions20: res(9, 400),
        listRefresh: { verdict: 'pass', reasons: [], resources: { cpuMaxPct: 30 } } } };
    const r = merge(nomodule, main);
    assert.equal(r.measures.idleAdded.verdict, 'pass');
    assert.equal(r.measures.sessionsAdded.verdict, 'pass');
    assert.equal(r.measures.listRefresh.spike.verdict, 'pass');
    assert.equal(exitCode(r), 0);
    main.measures.sessions20 = res(20, 400);
    const r2 = merge(nomodule, main);
    assert.equal(r2.measures.sessionsAdded.verdict, 'miss');
    assert.equal(exitCode(r2), 3);
    assert.ok(verdicts(r2).some((v) => v.path === 'sessionsAdded' && v.verdict === 'miss'));
    const plain = withoutTimestamps(r2);
    assert.equal(plain.generatedAt, undefined);
    assert.equal(plain.env.main.startedAt, undefined);
    assert.equal(anyCrashed(r2.measures), false);
    assert.equal(anyCrashed({ a: { b: { status: 'unavailable', reason: 'crashed: boom' } } }), true);
    assert.equal(merge(null, main).measures.idleAdded.verdict, 'unavailable');
});

test('compare prints value, delta and verdict per headline', () => {
    const a = { measures: { mapLoad: { 5000: { verdict: 'pass', stats: { p95: 400, median: 300 } } } } };
    const b = { measures: { mapLoad: { 5000: { verdict: 'miss', stats: { p95: 1100, median: 900 } } } } };
    assert.equal(headlines(a).length, 2);
    const rows = compare(a, b);
    const p95 = rows.find((r) => r.name === 'map.load 5000 items p95');
    assert.deepEqual(p95, { name: 'map.load 5000 items p95', a: 400, b: 1100, delta: 700, unit: 'ms', verdict: 'miss' });
});

test('sampler parses docker stats lines and skips redraws', () => {
    assert.equal(parseSize('2GiB'), 2048);
    assert.equal(parseSize('512MiB'), 512);
    assert.equal(parseSize('x'), null);
    const line = '\u001b[2J\u001b[H{"CPUPerc":"6.41%","MemUsage":"991.5MiB / 15.6GiB","Name":"ms-x"}';
    assert.deepEqual(parseStatsLine(line), { cpuPct: 6.41, memMiB: 991.5 });
    assert.equal(parseStatsLine('not json'), null);
    assert.equal(isRepeat({ t: 0, cpuPct: 1, memMiB: 2 }, { cpuPct: 1, memMiB: 2 }, 500), true);
    assert.equal(isRepeat({ t: 0, cpuPct: 1, memMiB: 2 }, { cpuPct: 1, memMiB: 2 }, 1000), false);
    assert.equal(isRepeat({ t: 0, cpuPct: 1, memMiB: 2 }, { cpuPct: 1.5, memMiB: 2 }, 500), false);
});
