#!/usr/bin/env node
// Map Studio glyph source (epic 3 entry 7): the signed distance field glyphs MapLibre's text
// layers need, built from the fonts in web/fonts (Noto Sans, OFL 1.1; web/fonts/sources.json)
// into build/generated-resources/mounted/glyphs/<stack>/<start>-<end>.pbf, which the Gateway
// serves beside the bundle at /res/mapstudio/glyphs/{fontstack}/{range}.pbf. No font CDN.
//
//   node scripts/glyphs.mjs                  build every range of every font stack
//   node scripts/glyphs.mjs --check          build one range into a temporary folder and read it back, and
//                                            compare web/fonts/advances.json with the fonts
//   node scripts/glyphs.mjs --write-advances rewrite web/fonts/advances.json (the ASCII advances at 24 px
//                                            per stack, which markers.ts estimates label widths from)
//
// Options for tests: --fonts <dir> --out <dir>.
//
// The glyphs follow fontnik's conventions, which MapLibre's own TinySDF path mirrors: 24 px,
// a 3 px border, distance radius 8 px, cutoff 0.25; `top` is the ink's top above the baseline
// minus the font's ascender, so every glyph of a stack shares one baseline. Every one of the
// 256 ranges of the Basic Multilingual Plane is written (an empty stack where the font has no
// glyph), so a range request never fails. Build time only: opentype.js reads the font, pbf
// writes the protobuf; neither is in the browser bundle.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import Pbf from 'pbf';

const here = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(here, '..');

export const DEFAULTS = {
    fonts: path.join(webDir, 'fonts'),
    out: path.join(webDir, 'build', 'generated-resources', 'mounted', 'glyphs')
};

/** fontnik's parameters (and MapLibre's TinySDF defaults). */
export const FONT_SIZE = 24;
export const BORDER = 3;
export const RADIUS = 8;
export const CUTOFF = 0.25;
/** Sub-scanlines per pixel row in the rasteriser (exact coverage across, sampled down). */
const SUBSAMPLES = 4;
const INF = 1e20;

/** The 256 ranges of the Basic Multilingual Plane, as MapLibre asks for them. */
export function ranges() {
    const out = [];
    for (let start = 0; start < 65536; start += 256) {
        out.push([start, start + 255]);
    }
    return out;
}

/** Flatten a glyph path (opentype.js commands, y down) into closed polygons of [x, y] points. */
function flatten(commands) {
    const polygons = [];
    let current = null;
    let last = [0, 0];
    const push = (p) => { current.push(p); last = p; };
    for (const c of commands) {
        if (c.type === 'M') {
            current = [];
            polygons.push(current);
            push([c.x, c.y]);
        } else if (c.type === 'L') {
            push([c.x, c.y]);
        } else if (c.type === 'Q') {
            const [x0, y0] = last;
            for (let i = 1; i <= 8; i++) {
                const t = i / 8;
                const u = 1 - t;
                push([u * u * x0 + 2 * u * t * c.x1 + t * t * c.x, u * u * y0 + 2 * u * t * c.y1 + t * t * c.y]);
            }
        } else if (c.type === 'C') {
            const [x0, y0] = last;
            for (let i = 1; i <= 12; i++) {
                const t = i / 12;
                const u = 1 - t;
                push([u * u * u * x0 + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
                    u * u * u * y0 + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y]);
            }
        } else if (c.type === 'Z') {
            current = null;
        }
    }
    return polygons.filter((p) => p.length >= 3);
}

/**
 * Coverage of closed polygons (nonzero winding) over a width by height pixel grid: a Float32
 * array of 0 to 1 per pixel. Exact along a scanline, SUBSAMPLES scanlines per pixel row.
 */
export function rasterise(polygons, width, height) {
    const coverage = new Float32Array(width * height);
    const edges = [];
    for (const poly of polygons) {
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % poly.length];
            if (a[1] !== b[1]) {
                edges.push(a[1] < b[1] ? { x0: a[0], y0: a[1], x1: b[0], y1: b[1], dir: 1 } : { x0: b[0], y0: b[1], x1: a[0], y1: a[1], dir: -1 });
            }
        }
    }
    const weight = 1 / SUBSAMPLES;
    const crossings = [];
    for (let row = 0; row < height; row++) {
        for (let s = 0; s < SUBSAMPLES; s++) {
            const y = row + (s + 0.5) / SUBSAMPLES;
            crossings.length = 0;
            for (const e of edges) {
                if (y >= e.y0 && y < e.y1) {
                    crossings.push({ x: e.x0 + (y - e.y0) * (e.x1 - e.x0) / (e.y1 - e.y0), dir: e.dir });
                }
            }
            if (crossings.length < 2) {
                continue;
            }
            crossings.sort((p, q) => p.x - q.x);
            let winding = 0;
            for (let i = 0; i < crossings.length - 1; i++) {
                winding += crossings[i].dir;
                if (winding === 0) {
                    continue;
                }
                const xa = Math.max(0, crossings[i].x);
                const xb = Math.min(width, crossings[i + 1].x);
                if (xb <= xa) {
                    continue;
                }
                const base = row * width;
                const ca = Math.floor(xa);
                const cb = Math.ceil(xb) - 1;
                if (ca === cb) {
                    coverage[base + ca] += (xb - xa) * weight;
                    continue;
                }
                coverage[base + ca] += (ca + 1 - xa) * weight;
                for (let c = ca + 1; c < cb; c++) {
                    coverage[base + c] += weight;
                }
                coverage[base + cb] += (xb - cb) * weight;
            }
        }
    }
    return coverage;
}

/** One-dimensional squared Euclidean distance transform (Felzenszwalb and Huttenlocher), as TinySDF runs it. */
function edt1d(grid, offset, stride, length, f, v, z) {
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    f[0] = grid[offset];
    for (let q = 1, k = 0, s = 0; q < length; q++) {
        f[q] = grid[offset + q * stride];
        const q2 = q * q;
        do {
            const r = v[k];
            s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
        } while (s <= z[k] && --k > -1);
        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = INF;
    }
    for (let q = 0, k = 0; q < length; q++) {
        while (z[k + 1] < q) {
            k++;
        }
        const r = v[k];
        const qr = q - r;
        grid[offset + q * stride] = f[r] + qr * qr;
    }
}

function edt(data, width, height) {
    const f = new Float64Array(Math.max(width, height));
    const v = new Uint16Array(Math.max(width, height));
    const z = new Float64Array(Math.max(width, height) + 1);
    for (let x = 0; x < width; x++) {
        edt1d(data, x, width, height, f, v, z);
    }
    for (let y = 0; y < height; y++) {
        edt1d(data, y * width, 1, width, f, v, z);
    }
}

/**
 * The signed distance field bytes of a coverage bitmap (width by height, the border included),
 * encoded as fontnik and TinySDF do: 255 * (1 - cutoff) at the outline, more inside, less outside,
 * one unit of distance being radius / 255.
 */
export function distanceField(coverage, width, height) {
    const len = width * height;
    const outer = new Float64Array(len);
    const inner = new Float64Array(len);
    for (let i = 0; i < len; i++) {
        const a = Math.min(1, Math.max(0, coverage[i]));
        outer[i] = a === 1 ? 0 : a === 0 ? INF : Math.pow(Math.max(0, 0.5 - a), 2);
        inner[i] = a === 1 ? INF : a === 0 ? 0 : Math.pow(Math.max(0, a - 0.5), 2);
    }
    edt(outer, width, height);
    edt(inner, width, height);
    const data = new Uint8ClampedArray(len);
    const scale = 255 / RADIUS;
    const base = 255 * (1 - CUTOFF);
    for (let i = 0; i < len; i++) {
        data[i] = base - scale * (Math.sqrt(outer[i]) - Math.sqrt(inner[i]));
    }
    return data;
}

/**
 * One glyph as the PBF carries it: {id, bitmap, width, height, left, top, advance}, or null when
 * the font has no glyph for the code point. `ascender` is the font's ascender in px at FONT_SIZE,
 * rounded once per font so every glyph keeps the same baseline.
 */
export function renderGlyph(font, codePoint, ascender) {
    const glyph = font.charToGlyph(String.fromCodePoint(codePoint));
    if (!glyph || glyph.index === 0 && codePoint !== 0) {
        return null;
    }
    const scale = FONT_SIZE / font.unitsPerEm;
    const advance = Math.round((glyph.advanceWidth || 0) * scale);
    const commands = glyph.getPath(0, 0, FONT_SIZE).commands;
    const polygons = flatten(commands);
    if (polygons.length === 0) {
        return { id: codePoint, bitmap: new Uint8Array(0), width: 0, height: 0, left: 0, top: 0, advance };
    }
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const poly of polygons) {
        for (const [x, y] of poly) {
            xMin = Math.min(xMin, x);
            xMax = Math.max(xMax, x);
            yMin = Math.min(yMin, y);
            yMax = Math.max(yMax, y);
        }
    }
    // opentype.js paths are y down: yMin is the ink's top. In font terms the top above the
    // baseline is -yMin.
    const left = Math.floor(xMin);
    const inkTop = Math.ceil(-yMin);
    const width = Math.ceil(xMax) - left;
    const height = inkTop - Math.floor(-yMax);
    const fullWidth = width + 2 * BORDER;
    const fullHeight = height + 2 * BORDER;
    const shifted = polygons.map((poly) => poly.map(([x, y]) => [x - left + BORDER, y + inkTop + BORDER]));
    const coverage = rasterise(shifted, fullWidth, fullHeight);
    const bitmap = distanceField(coverage, fullWidth, fullHeight);
    return { id: codePoint, bitmap: new Uint8Array(bitmap.buffer), width, height, left, top: inkTop - ascender, advance };
}

/** The glyphs proto: glyphs { stacks: [fontstack { name, range, glyphs: [glyph] }] }. */
function writeGlyph(glyph, pbf) {
    pbf.writeVarintField(1, glyph.id);
    if (glyph.bitmap.length > 0) {
        // A glyph with no ink (a space) carries no bitmap: MapLibre makes the empty image itself, and
        // refuses an empty bytes field as a size mismatch.
        pbf.writeBytesField(2, glyph.bitmap);
    }
    pbf.writeVarintField(3, glyph.width);
    pbf.writeVarintField(4, glyph.height);
    pbf.writeSVarintField(5, glyph.left);
    pbf.writeSVarintField(6, glyph.top);
    pbf.writeVarintField(7, glyph.advance);
}

function writeFontstack(stack, pbf) {
    pbf.writeStringField(1, stack.name);
    pbf.writeStringField(2, stack.range);
    for (const glyph of stack.glyphs) {
        pbf.writeMessage(3, writeGlyph, glyph);
    }
}

export function encodeRange(name, start, end, glyphs) {
    const pbf = new Pbf();
    pbf.writeMessage(1, writeFontstack, { name, range: start + '-' + end, glyphs });
    return pbf.finish();
}

/** Read a range back (for --check and the tests): {name, range, glyphs: [{id, width, height, left, top, advance, bitmapLength}]}. */
export function decodeRange(bytes) {
    const stacks = new Pbf(bytes).readFields((tag, out, pbf) => {
        if (tag === 1) {
            out.push(pbf.readMessage((t, stack, p) => {
                if (t === 1) {
                    stack.name = p.readString();
                } else if (t === 2) {
                    stack.range = p.readString();
                } else if (t === 3) {
                    stack.glyphs.push(p.readMessage((gt, g, gp) => {
                        if (gt === 1) {
                            g.id = gp.readVarint();
                        } else if (gt === 2) {
                            g.bitmapLength = gp.readBytes().length;
                        } else if (gt === 3) {
                            g.width = gp.readVarint();
                        } else if (gt === 4) {
                            g.height = gp.readVarint();
                        } else if (gt === 5) {
                            g.left = gp.readSVarint();
                        } else if (gt === 6) {
                            g.top = gp.readSVarint();
                        } else if (gt === 7) {
                            g.advance = gp.readVarint();
                        }
                    }, {}));
                }
            }, { name: '', range: '', glyphs: [] }));
        }
    }, []);
    return stacks[0];
}

/** The font stacks of web/fonts/sources.json, each with its parsed font. */
export function loadFonts(fontsDir) {
    const sources = JSON.parse(readFileSync(path.join(fontsDir, 'sources.json'), 'utf8'));
    if (!existsSync(path.join(fontsDir, sources.licenceFile))) {
        throw new Error('The font licence file ' + sources.licenceFile + ' is missing from ' + fontsDir);
    }
    return sources.fonts.map((entry) => {
        const bytes = readFileSync(path.join(fontsDir, entry.file));
        const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
        return { stack: entry.stack, file: entry.file, font, ascender: Math.round(font.ascender * FONT_SIZE / font.unitsPerEm) };
    });
}

/** The ASCII advances (code points 32 to 126) of a font at FONT_SIZE, rounded as the glyphs carry them, by character. */
export function asciiAdvances(font) {
    const out = {};
    for (let cp = 32; cp < 127; cp++) {
        const ch = String.fromCharCode(cp);
        const glyph = font.charToGlyph(ch);
        out[ch] = Math.round((glyph && glyph.advanceWidth ? glyph.advanceWidth : 0) * FONT_SIZE / font.unitsPerEm);
    }
    return out;
}

/** The advances file's content: {size, stacks: {<stack>: {<char>: advance}}}. */
export function advancesFile(fonts) {
    const stacks = {};
    for (const entry of fonts) {
        stacks[entry.stack] = asciiAdvances(entry.font);
    }
    return { size: FONT_SIZE, stacks };
}

/** The code points a font maps, as a Set. */
function codePoints(font) {
    const out = new Set();
    const glyphs = font.glyphs.glyphs;
    for (const index of Object.keys(glyphs)) {
        const g = glyphs[index];
        if (typeof g.unicode === 'number' && g.unicode >= 32 && g.unicode < 65536) {
            out.add(g.unicode);
        }
        if (Array.isArray(g.unicodes)) {
            for (const u of g.unicodes) {
                if (u >= 32 && u < 65536) {
                    out.add(u);
                }
            }
        }
    }
    return out;
}

/** Build one range of one stack: the encoded bytes and how many glyphs it holds. */
export function buildRange(entry, start, end, points) {
    const glyphs = [];
    for (let cp = start; cp <= end; cp++) {
        if (!points.has(cp)) {
            continue;
        }
        const glyph = renderGlyph(entry.font, cp, entry.ascender);
        if (glyph) {
            glyphs.push(glyph);
        }
    }
    return { bytes: encodeRange(entry.stack, start, end, glyphs), count: glyphs.length };
}

export function build(fontsDir, outDir, onlyRange = null) {
    const fonts = loadFonts(fontsDir);
    const summary = [];
    for (const entry of fonts) {
        const points = codePoints(entry.font);
        const dir = path.join(outDir, entry.stack);
        mkdirSync(dir, { recursive: true });
        let total = 0;
        let files = 0;
        for (const [start, end] of ranges()) {
            if (onlyRange && start !== onlyRange[0]) {
                continue;
            }
            const { bytes, count } = buildRange(entry, start, end, points);
            writeFileSync(path.join(dir, start + '-' + end + '.pbf'), bytes);
            total += count;
            files++;
        }
        summary.push({ stack: entry.stack, file: entry.file, glyphs: total, files, ascender: entry.ascender });
    }
    return summary;
}

function parseArgs(argv) {
    const args = { check: false, writeAdvances: false, fonts: DEFAULTS.fonts, out: DEFAULTS.out };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--check') {
            args.check = true;
        } else if (a === '--write-advances') {
            args.writeAdvances = true;
        } else if (a === '--fonts') {
            args.fonts = path.resolve(argv[++i]);
        } else if (a === '--out') {
            args.out = path.resolve(argv[++i]);
        } else {
            throw new Error('Unknown argument ' + a);
        }
    }
    return args;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const advancesPath = path.join(args.fonts, 'advances.json');
    if (args.writeAdvances) {
        writeFileSync(advancesPath, JSON.stringify(advancesFile(loadFonts(args.fonts)), null, 4) + '\n');
        console.log('glyphs: wrote ' + advancesPath);
        return;
    }
    if (args.check) {
        const expected = JSON.stringify(advancesFile(loadFonts(args.fonts)));
        const committed = existsSync(advancesPath) ? JSON.stringify(JSON.parse(readFileSync(advancesPath, 'utf8'))) : '';
        if (committed !== expected) {
            throw new Error(advancesPath + ' does not match the fonts; run node scripts/glyphs.mjs --write-advances');
        }
        const tmp = mkdtempSync(path.join(tmpdir(), 'mapstudio-glyphs-'));
        try {
            const summary = build(args.fonts, tmp, [0, 255]);
            for (const s of summary) {
                const stack = decodeRange(readFileSync(path.join(tmp, s.stack, '0-255.pbf')));
                if (stack.name !== s.stack || stack.range !== '0-255' || stack.glyphs.length < 90) {
                    throw new Error('The range 0-255 of ' + s.stack + ' read back wrong: ' + JSON.stringify({ name: stack.name, range: stack.range, glyphs: stack.glyphs.length }));
                }
                const p = stack.glyphs.find((g) => g.id === 80);
                if (!p || p.bitmapLength !== (p.width + 2 * BORDER) * (p.height + 2 * BORDER) || p.top >= 0 || p.advance <= 0) {
                    throw new Error('The glyph P of ' + s.stack + ' read back wrong: ' + JSON.stringify(p));
                }
                const space = stack.glyphs.find((g) => g.id === 32);
                if (!space || space.bitmapLength !== undefined || space.width !== 0 || space.advance <= 0) {
                    throw new Error('The space of ' + s.stack + ' read back wrong: ' + JSON.stringify(space));
                }
                console.log('glyphs: ' + s.stack + ' 0-255 holds ' + stack.glyphs.length + ' glyphs (ascender ' + s.ascender + ' px); P is '
                    + p.width + 'x' + p.height + ' at left ' + p.left + ', top ' + p.top + ', advance ' + p.advance);
            }
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
        return;
    }
    const started = Date.now();
    const summary = build(args.fonts, args.out);
    for (const s of summary) {
        console.log('glyphs: ' + s.stack + ' from ' + s.file + ': ' + s.glyphs + ' glyphs in ' + s.files + ' ranges');
    }
    console.log('glyphs: written to ' + args.out + ' in ' + ((Date.now() - started) / 1000).toFixed(1) + ' s');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        main();
    } catch (err) {
        console.error('glyphs: ' + (err && err.message ? err.message : err));
        process.exit(1);
    }
}
