// Unit tests for the suite's pure helpers: node --test lib/

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { project, pagePixel } from './geo.mjs';
import { unavailable, validateMeasures, without } from './measures.mjs';
import { frameStats, median, percentile } from './stats.mjs';
import { batchSize, isValuesBatchFrame, parseBatchFrame } from './valueBatch.mjs';
import { decodePng, firstOddPixel } from './png.mjs';
import { deflateSync } from 'node:zlib';

test('median and percentile', () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 2, 3]), 2.5);
    assert.equal(median([]), null);
    assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95), 10);
    assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50), 5);
});

test('frameStats on a steady 60 fps and on a slow window', () => {
    const steady = Array.from({ length: 61 }, (_, i) => i * (1000 / 60));
    const s = frameStats(steady);
    assert.equal(s.frames, 61);
    assert.ok(Math.abs(s.fps - 60) < 0.1);
    assert.equal(s.shareOver20msPercent, 0);
    const slow = frameStats([0, 50, 100, 150, 200], [60, 80]);
    assert.equal(slow.fps, 20);
    assert.equal(slow.shareOver20msPercent, 100);
    assert.deepEqual(slow.longTasks, { count: 2, totalMs: 140 });
});

test('frameStats with too few frames is unavailable, not a number', () => {
    assert.equal(frameStats([5]).status, 'unavailable');
    assert.equal(frameStats([]).status, 'unavailable');
});

test('values.batch frames: read for full, items and seq, sized as they travelled', () => {
    const batch = '{"v":1,"type":"values.batch","id":"x","body":{"seq":7,"full":true,"items":[{"id":"a","kpis":{},"problems":[]},'
        + '{"id":"b","kpis":{},"problems":[]}],"kindDisplay":[]}}';
    const plain = '{"event":' + batch + '}';
    const escaped = '{"event":"' + batch.replace(/"/g, '\\"') + '"}';
    assert.ok(isValuesBatchFrame(plain) && isValuesBatchFrame(escaped));
    assert.ok(!isValuesBatchFrame('{"type":"map.changed"}'));
    assert.deepEqual(parseBatchFrame(plain), { full: true, items: 2, seq: 7, kindDisplay: true });
    assert.deepEqual(parseBatchFrame(escaped), { full: true, items: 2, seq: 7, kindDisplay: true });
    assert.deepEqual(parseBatchFrame(plain.replace('"full":true', '"full":false').replace(',"kindDisplay":[]', '')),
        { full: false, items: 2, seq: 7, kindDisplay: false });
    assert.equal(parseBatchFrame('{"type":"map.changed"}'), null);
    const size = batchSize(plain);
    assert.equal(size.bytes, Buffer.byteLength(plain, 'utf8'));
    assert.ok(size.gzipBytes > 0);
});

test('project: the map centre lands on the middle of the map', () => {
    const c = [-104.9725, 39.7445];
    const [x, y] = pagePixel({ x: 10, y: 20, width: 100, height: 60 }, c, c, 12.5);
    assert.equal(x, 60);
    assert.equal(y, 50);
    const [px] = project([0, 0], 0);
    assert.equal(px, 256);
});

const goodEnv = { chromium: '153', renderer: 'SwiftShader' };
const section = { label: 'measured', method: 'm', env: goodEnv };

test('validateMeasures accepts a complete file and an unavailable section', () => {
    const ok = {
        env: goodEnv,
        bundle: section,
        frameRate: unavailable('no WebGL'),
        valueBatch: section,
        phone: section
    };
    assert.deepEqual(validateMeasures(ok), []);
});

test('validateMeasures requires label, method and env on every section', () => {
    const base = { env: goodEnv, bundle: section, frameRate: section, valueBatch: section, phone: section };
    for (const name of ['bundle', 'frameRate', 'valueBatch', 'phone']) {
        for (const field of ['label', 'method', 'env']) {
            const broken = { ...base, [name]: { ...base[name] } };
            delete broken[name][field];
            const problems = validateMeasures(broken).join('|');
            assert.match(problems, new RegExp(`${name}: ${field === 'env' ? 'env needs' : field}`), `${name} without ${field}`);
        }
    }
    const noRenderer = { ...base, phone: { ...section, env: { chromium: '153' } } };
    assert.match(validateMeasures(noRenderer).join('|'), /phone: env needs/);
});

test('without drops the named fields and leaves the original alone', () => {
    const m = { a: 1, generatedAt: 'x', b: 2 };
    assert.deepEqual(without(m, ['generatedAt']), { a: 1, b: 2 });
    assert.equal(m.generatedAt, 'x');
});

test('validateMeasures refuses an unlabelled number, a missing section and a section without its env', () => {
    const bad = {
        env: goodEnv,
        bundle: { method: 'm' },
        frameRate: { status: 'unavailable' },
        valueBatch: { label: 'measured', method: 'm' }
    };
    const problems = validateMeasures(bad).join('|');
    assert.match(problems, /bundle: label/);
    assert.match(problems, /frameRate: unavailable without a reason/);
    assert.match(problems, /valueBatch: env needs/);
    assert.match(problems, /phone: missing/);
    assert.match(validateMeasures({}).join('|'), /env needs/);
});

/** A PNG encoded by hand: 8-bit RGB, no interlace, filter 0 on every row, from rows of [r, g, b] pixels. */
function encodePng(rows) {
    const crcTable = [];
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c >>> 0;
    }
    const crc = (buf) => {
        let c = 0xffffffff;
        for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
    };
    const chunk = (type, body) => {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(body.length);
        const tb = Buffer.concat([Buffer.from(type, 'latin1'), body]);
        const c = Buffer.alloc(4);
        c.writeUInt32BE(crc(tb));
        return Buffer.concat([len, tb, c]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(rows[0].length, 0);
    ihdr.writeUInt32BE(rows.length, 4);
    ihdr[8] = 8; ihdr[9] = 2;
    const raw = Buffer.concat(rows.map((r) => Buffer.from([0, ...r.flat()])));
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

test('a PNG decoded and its flat region checked, the surface divider allowed', () => {
    const s = [244, 244, 244];
    const d = [216, 216, 216];
    const png = decodePng(encodePng([[s, s, s], [d, d, d], [s, s, [12, 200, 30]]]));
    assert.equal(png.width, 3);
    assert.equal(png.height, 3);
    assert.deepEqual(png.pixel(2, 2), [12, 200, 30, 255]);
    assert.deepEqual(firstOddPixel(png, 0, 0, 3, 1, 2), null);
    assert.deepEqual(firstOddPixel(png, 0, 0, 3, 2, 2), { x: 0, y: 1, pixel: [216, 216, 216, 255], ref: [244, 244, 244, 255] });
    assert.deepEqual(firstOddPixel(png, 0, 0, 3, 2, 2, [d]), null);
    assert.deepEqual(firstOddPixel(png, 0, 0, 3, 3, 2, [d]), { x: 2, y: 2, pixel: [12, 200, 30, 255], ref: [244, 244, 244, 255] });
});
