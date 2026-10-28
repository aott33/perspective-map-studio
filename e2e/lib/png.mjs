// A small PNG reader for render checks (epic 3 entry 8): Playwright's screenshots are 8-bit RGB or
// RGBA, not interlaced, which is all this reads. Pure; unit tested in lib.test.mjs with a PNG
// encoded by hand.

import { inflateSync } from 'node:zlib';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The decoded image: its size and a pixel reader giving [r, g, b, a]. */
export function decodePng(buffer) {
    for (let i = 0; i < SIGNATURE.length; i++) {
        if (buffer[i] !== SIGNATURE[i]) throw new Error('Not a PNG.');
    }
    let pos = 8;
    let width = 0;
    let height = 0;
    let colorType = 0;
    let depth = 0;
    const data = [];
    while (pos < buffer.length) {
        const length = buffer.readUInt32BE(pos);
        const type = buffer.toString('latin1', pos + 4, pos + 8);
        const body = buffer.subarray(pos + 8, pos + 8 + length);
        if (type === 'IHDR') {
            width = body.readUInt32BE(0);
            height = body.readUInt32BE(4);
            depth = body[8];
            colorType = body[9];
            if (body[12] !== 0) throw new Error('An interlaced PNG is not read.');
        } else if (type === 'IDAT') {
            data.push(body);
        } else if (type === 'IEND') {
            break;
        }
        pos += 12 + length;
    }
    if (depth !== 8 || (colorType !== 2 && colorType !== 6)) {
        throw new Error('Only 8-bit RGB and RGBA PNGs are read (depth ' + depth + ', colour type ' + colorType + ').');
    }
    const channels = colorType === 6 ? 4 : 3;
    const raw = inflateSync(Buffer.concat(data));
    const stride = width * channels;
    const pixels = Buffer.alloc(height * stride);
    let prev = Buffer.alloc(stride);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        const out = pixels.subarray(y * stride, (y + 1) * stride);
        for (let i = 0; i < stride; i++) {
            const a = i >= channels ? out[i - channels] : 0;
            const b = prev[i];
            const c = i >= channels ? prev[i - channels] : 0;
            let v = line[i];
            if (filter === 1) v += a;
            else if (filter === 2) v += b;
            else if (filter === 3) v += Math.floor((a + b) / 2);
            else if (filter === 4) {
                const p = a + b - c;
                const pa = Math.abs(p - a);
                const pb = Math.abs(p - b);
                const pc = Math.abs(p - c);
                v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            } else if (filter !== 0) throw new Error('Unknown PNG filter ' + filter + '.');
            out[i] = v & 0xff;
        }
        prev = out;
    }
    return {
        width,
        height,
        pixel(x, y) {
            const i = y * stride + x * channels;
            return [pixels[i], pixels[i + 1], pixels[i + 2], channels === 4 ? pixels[i + 3] : 255];
        }
    };
}

/**
 * Whether every pixel of the rectangle is within `tolerance` of its top-left pixel on each channel:
 * a region of one flat colour (a popup's surface with nothing showing through). Returns the first
 * pixel that is not, or null.
 */
export function firstOddPixel(png, x0, y0, w, h, tolerance = 2) {
    const ref = png.pixel(x0, y0);
    for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
            const p = png.pixel(x, y);
            for (let c = 0; c < 3; c++) {
                if (Math.abs(p[c] - ref[c]) > tolerance) return { x, y, pixel: p, ref };
            }
        }
    }
    return null;
}
