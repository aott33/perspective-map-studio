#!/usr/bin/env node
// Map Studio icon set (story 2.10): checks the artwork and its provenance, and
// builds what the module serves. No dependencies beyond Node.
//
//   node scripts/icons.mjs                    check, then write the sprite, the
//                                             catalogue copy and the contact sheet
//                                             into build/generated-resources/mounted/icons/
//   node scripts/icons.mjs --check            check only, and compare the committed
//                                             catalogue in common/ with the sources
//   node scripts/icons.mjs --write-catalogue  check, then rewrite the committed catalogue
//
// Options for tests: --src <dir> --sources <file> --catalogue <file> --out <dir>.
// Exit code 0 when everything holds; 1 with one line per problem otherwise.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(here, '..');
const repoRoot = path.resolve(webDir, '..');

export const DEFAULTS = {
    src: path.join(webDir, 'icons', 'src'),
    sources: path.join(webDir, 'icons', 'sources.json'),
    catalogue: path.join(repoRoot, 'common', 'src', 'main', 'resources', 'com', 'aoindustrial', 'perspective',
        'mapstudio', 'common', 'icons.json'),
    out: path.join(webDir, 'build', 'generated-resources', 'mounted', 'icons')
};

/** Licences an icon may carry: permissive, no share-alike. */
export const ALLOWED_LICENCES = ['Apache-2.0', 'MIT', 'ISC', 'CC0-1.0'];
/** Sets an adapted icon may come from, with the licence that set carries. */
export const SEED_SETS = { tabler: 'MIT' };
const FORBIDDEN_WORDS = /openbridge|font-?awesome/i;

const ROOT_ATTRS = {
    'xmlns': ['http://www.w3.org/2000/svg'],
    'viewBox': ['0 0 24 24'],
    'fill': ['none', 'currentColor'],
    'stroke': ['none', 'currentColor'],
    'stroke-width': ['2'],
    'stroke-linecap': ['round'],
    'stroke-linejoin': ['round']
};
const SHAPES = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse']);
const SHAPE_ATTRS = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2',
    'points', 'fill-rule', 'fill', 'stroke']);
const PAINT = new Set(['none', 'currentColor']);
const ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function attrs(text) {
    const out = {};
    const re = /([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(text)) !== null) out[m[1]] = m[2];
    return out;
}

/**
 * Problems with one icon's SVG text, as plain sentences. `group` is 'kind'
 * (stroke only) or 'state' (stroke, or a solid currentColor fill).
 */
export function checkSvg(id, text, group) {
    const problems = [];
    const say = (msg) => problems.push(`${id}.svg: ${msg}`);
    if (FORBIDDEN_WORDS.test(text)) say('names a forbidden source');
    if (/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(text)) say('has a colour literal; use currentColor');
    if (/<!--|<\?|<!DOCTYPE/i.test(text)) say('has a comment, processing instruction or doctype');
    const root = /^<svg\b([^>]*)>/.exec(text.trim());
    if (!root) {
        say('does not start with an <svg> element');
        return problems;
    }
    const ra = attrs(root[1]);
    for (const [name, value] of Object.entries(ra)) {
        if (!ROOT_ATTRS[name]) say(`root attribute ${name} is not allowed`);
        else if (!ROOT_ATTRS[name].includes(value)) say(`root ${name}="${value}" is not allowed`);
    }
    for (const name of ['xmlns', 'viewBox', 'fill', 'stroke']) if (!(name in ra)) say(`root ${name} is missing`);
    const stroked = ra.stroke === 'currentColor';
    if (stroked) {
        for (const name of ['stroke-width', 'stroke-linecap', 'stroke-linejoin']) {
            if (!(name in ra)) say(`root ${name} is missing on a stroked icon`);
        }
    }
    if (group === 'kind' && !(ra.fill === 'none' && stroked)) say('a kind icon is stroke only (fill="none" stroke="currentColor")');
    if (!stroked && ra.fill !== 'currentColor') say('draws nothing: neither stroke nor fill is currentColor');
    if (!/<\/svg>\s*$/.test(text)) say('does not end with </svg>');
    const body = text.trim().replace(/^<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const tags = body.match(/<[^>]+>/g) || [];
    let shapes = 0;
    for (const tag of tags) {
        const m = /^<\/?\s*([A-Za-z][\w:-]*)/.exec(tag);
        const name = m ? m[1] : '?';
        if (!SHAPES.has(name)) {
            say(`element <${name}> is not allowed`);
            continue;
        }
        if (tag.startsWith('</')) continue;
        shapes++;
        for (const [a, v] of Object.entries(attrs(tag))) {
            if (!SHAPE_ATTRS.has(a)) say(`attribute ${a} on <${name}> is not allowed`);
            else if ((a === 'fill' || a === 'stroke') && !PAINT.has(v)) say(`${a}="${v}" on <${name}> is not allowed`);
        }
    }
    if (body.replace(/<[^>]+>/g, '').trim() !== '') say('has text content');
    if (shapes === 0) say('has no shapes');
    return problems;
}

/** Problems with the sources list itself, and its match with the files in src. */
export function checkSources(sources, files) {
    const problems = [];
    const say = (msg) => problems.push(`sources.json: ${msg}`);
    if (!sources || !Array.isArray(sources.icons)) return ['sources.json: no icons list'];
    if (typeof sources.catalogueVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(sources.catalogueVersion)) {
        say('catalogueVersion is not a semantic version');
    }
    const seen = new Set();
    for (const e of sources.icons) {
        const id = e && e.id;
        if (typeof id !== 'string' || !ID.test(id)) {
            say(`entry ${JSON.stringify(id)} has no kebab-case id`);
            continue;
        }
        if (seen.has(id)) say(`${id} is listed twice`);
        seen.add(id);
        if (typeof e.label !== 'string' || e.label.trim() === '') say(`${id} has no label`);
        if (e.group !== 'kind' && e.group !== 'state') say(`${id} group must be kind or state`);
        if (e.group === 'kind' && !['point', 'line', 'area'].includes(e.geometry)) say(`${id} geometry must be point, line or area`);
        if (e.group === 'state' && e.geometry !== null) say(`${id} is a state glyph and has no geometry (null)`);
        if (FORBIDDEN_WORDS.test(JSON.stringify(e))) say(`${id} names a forbidden source`);
        if (!ALLOWED_LICENCES.includes(e.licence)) {
            say(`${id} licence ${JSON.stringify(e.licence)} is not on the allow list (${ALLOWED_LICENCES.join(', ')})`);
        }
        if (e.origin === 'drawn') {
            if (e.licence !== 'Apache-2.0') say(`${id} is drawn for this module and carries Apache-2.0`);
        } else {
            const m = /^([a-z]+):([a-z0-9-]+)@(\d+\.\d+\.\d+)$/.exec(e.origin || '');
            if (!m) say(`${id} origin must be "drawn" or "<set>:<name>@<version>"`);
            else if (!SEED_SETS[m[1]]) say(`${id} comes from ${m[1]}, which is not an approved seed set`);
            else if (SEED_SETS[m[1]] !== e.licence) say(`${id} comes from ${m[1]}, whose licence is ${SEED_SETS[m[1]]}`);
            if (typeof e.modified !== 'string' || e.modified.trim() === '') say(`${id} is adapted and must say how it was modified`);
        }
    }
    const fallback = sources.icons.find((e) => e && e.id === sources.fallback);
    if (!fallback || fallback.group !== 'kind') say('fallback must name a kind icon');
    for (const f of files) if (!seen.has(f)) say(`src/${f}.svg has no entry`);
    for (const id of seen) if (!files.includes(id)) say(`${id} has no src/${id}.svg`);
    return problems;
}

/** The catalogue common/ ships: what the Gateway and the browser read. */
export function catalogueOf(sources) {
    return {
        version: sources.catalogueVersion,
        fallback: sources.fallback,
        icons: sources.icons.map((e) => ({ id: e.id, label: e.label, group: e.group, geometry: e.geometry }))
    };
}

export function catalogueText(sources) {
    return JSON.stringify(catalogueOf(sources), null, 4) + '\n';
}

function inner(text) {
    return text.trim().replace(/^<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
}

function rootAttrText(text) {
    const ra = attrs(/^<svg\b([^>]*)>/.exec(text.trim())[1]);
    delete ra.xmlns;
    return Object.entries(ra).map(([k, v]) => `${k}="${v}"`).join(' ');
}

/** One SVG with a <symbol id="ms-<id>"> per icon, in sources order. */
export function spriteText(sources, svgs) {
    const adapted = sources.icons.filter((e) => e.origin !== 'drawn').map((e) => `${e.id} (${e.origin})`);
    const lines = [
        '<svg xmlns="http://www.w3.org/2000/svg">',
        '<!-- Map Studio icons, built by web/scripts/icons.mjs from web/icons/src; do not edit.',
        '     Drawn for Map Studio: Apache-2.0. Adapted from Tabler Icons (MIT, Copyright (c) 2020-2026',
        `     Paweł Kuna), modified: ${adapted.join(', ')}. See NOTICE. -->`
    ];
    for (const e of sources.icons) {
        lines.push(`<symbol id="ms-${e.id}" ${rootAttrText(svgs[e.id])}>`);
        for (const l of inner(svgs[e.id]).split('\n')) lines.push('  ' + l.trim());
        lines.push('</symbol>');
    }
    lines.push('</svg>');
    return lines.join('\n') + '\n';
}

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * The owner's contact sheet: every icon at 16, 24 and 44 px in a light and a
 * dark panel, and the state examples epic-viewing builds on. Colours are the
 * Perspective theme tokens the map reads (theme.ts); outside a Perspective
 * session they are undefined, so each panel declares stand-in values once.
 */
export function contactSheetText(sources, svgs) {
    const sym = (id) => `<svg class="g" aria-hidden="true"><use href="#ms-${id}"/></svg>`;
    const cell = (e) => `
      <figure class="icon" data-icon="${esc(e.id)}">
        <div class="sizes">
          <span class="s16">${sym(e.id)}</span>
          <span class="s24">${sym(e.id)}</span>
          <span class="s44 target">${sym(e.id)}</span>
        </div>
        <figcaption><code>${esc(e.id)}</code><span>${esc(e.label)}${e.geometry ? ' - ' + e.geometry : ''}</span>${e.review ? '<em>Engineering review before release</em>' : ''}</figcaption>
      </figure>`;
    const kinds = sources.icons.filter((e) => e.group === 'kind');
    const states = sources.icons.filter((e) => e.group === 'state');
    const examples = `
      <div class="examples">
        <div class="ex"><span class="marker">${sym('point')}</span><p><b>Normal, below zoom 14</b> - a neutral dot (option B)</p></div>
        <div class="ex"><span class="marker halo">${sym('well-pad')}</span><p><b>Normal, zoom 14 and in</b> - the kind glyph, neutral, with a 2 px backdrop halo; label "P12"</p></div>
        <div class="ex"><span class="marker halo dim">${sym('well-pad')}<span class="badge">${sym('comms-lost')}</span></span><p><b>Comms lost</b> - glyph dimmed, comms-lost badge, label "P12 Comms lost"; its KPI shows as stale</p></div>
        <div class="ex"><span class="kpi">412 psi <span class="inline">${sym('stale')}</span></span><p><b>Stale value</b> - the stale glyph beside the value and the word "stale" in the tip, never shown as current</p></div>
        <div class="ex"><span class="marker halo a1">${sym('alarm-1-solid')}</span><span class="digit">1</span><p><b>Priority 1, unacknowledged</b> - solid triangle, digit "1" as a label, count "2" where enabled</p></div>
        <div class="ex"><span class="marker halo a1">${sym('alarm-1-hollow')}</span><span class="digit">1</span><p><b>Priority 1, acknowledged</b> - hollow triangle</p></div>
        <div class="ex"><span class="marker halo a2">${sym('alarm-2-solid')}</span><span class="digit">2</span><p><b>Priority 2</b> - solid circle; hollow once acknowledged</p></div>
        <div class="ex"><span class="marker halo a3">${sym('alarm-3-hollow')}</span><span class="digit">3</span><p><b>Priority 3</b> - square; the template's map outlines it in every state (docs/ux.md 5)</p></div>
      </div>`;
    const panel = (theme) => `
  <section class="panel ${theme}" aria-label="${theme} theme">
    <h2>${theme === 'light' ? 'Light' : 'Dark'} theme (stand-in token values)</h2>
    <h3>Kind icons (${kinds.length})</h3>
    <div class="grid">${kinds.map(cell).join('')}
    </div>
    <h3>State glyphs (${states.length})</h3>
    <p class="review">The alarm glyphs are alarm presentation: they need the template's engineering review (ER-27) before release.</p>
    <div class="grid">${states.map(cell).join('')}
    </div>
    <h3>State examples for epic-viewing (colour never alone)</h3>${examples}
  </section>`;
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Map Studio icons</title>
<!-- Built by web/scripts/icons.mjs; do not edit. Owner review page for story 2.10. -->
<style>
  /* Stand-in values for the Perspective theme tokens the map reads (web/typescript/theme.ts).
     The alarm token names are placeholders until epic-viewing settles them [UNVERIFIED]. */
  .light { --containerRoot: #ffffff; --container: #f4f4f4; --label: #2e2e2e; --neutral-70: #6b6b6b;
           --ms-alarm-1: #c62828; --ms-alarm-2: #b26a00; --ms-alarm-3: #1f5fa8; }
  .dark  { --containerRoot: #1b1b1b; --container: #262626; --label: #e6e6e6; --neutral-70: #a3a3a3;
           --ms-alarm-1: #ff6b6b; --ms-alarm-2: #f2b84b; --ms-alarm-3: #7fb2f0; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.4 system-ui, sans-serif; background: var(--containerRoot, Canvas); }
  header, .panel { padding: 16px; }
  .panel { background: var(--containerRoot); color: var(--label); }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 17px; margin: 0 0 8px; }
  h3 { font-size: 15px; margin: 20px 0 8px; }
  .review { margin: 0 0 8px; font-weight: 600; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: 8px; }
  .icon { margin: 0; padding: 8px; background: var(--container); border-radius: 6px; min-width: 0; }
  .sizes { display: flex; align-items: center; gap: 12px; color: var(--label); }
  .sizes > span { display: inline-flex; align-items: center; justify-content: center; }
  .g { width: 100%; height: 100%; }
  .s16 { width: 16px; height: 16px; }
  .s24 { width: 24px; height: 24px; }
  .s44 { width: 44px; height: 44px; }
  .target { outline: 1px dashed var(--neutral-70); }
  figcaption { margin-top: 6px; display: flex; flex-direction: column; overflow-wrap: anywhere; }
  figcaption code { font-size: 12px; }
  figcaption span { color: var(--neutral-70); font-size: 12px; }
  figcaption em { font-size: 12px; font-style: normal; font-weight: 600; }
  .examples { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }
  .ex { display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--container); border-radius: 6px; }
  .ex p { margin: 0; font-size: 13px; }
  .marker { position: relative; flex: none; width: 44px; height: 44px; padding: 10px; color: var(--neutral-70);
            outline: 1px dashed var(--neutral-70); }
  .halo .g { filter: drop-shadow(2px 0 0 var(--containerRoot)) drop-shadow(-2px 0 0 var(--containerRoot))
                     drop-shadow(0 2px 0 var(--containerRoot)) drop-shadow(0 -2px 0 var(--containerRoot)); }
  .dim > .g { opacity: 0.5; }
  .badge { position: absolute; top: 0; right: 0; width: 16px; height: 16px; color: var(--label);
           background: var(--containerRoot); border-radius: 50%; padding: 1px; }
  .a1 { color: var(--ms-alarm-1); } .a2 { color: var(--ms-alarm-2); } .a3 { color: var(--ms-alarm-3); }
  .digit { flex: none; font-weight: 700; color: var(--label); }
  .kpi { flex: none; display: inline-flex; align-items: center; gap: 4px; color: var(--neutral-70); }
  .inline { display: inline-flex; width: 16px; height: 16px; }
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
${inner(spriteText(sources, svgs)).replace(/^<!--[\s\S]*?-->\n/, '')}
</svg>
<header class="panel light">
  <h1>Map Studio icons - contact sheet</h1>
  <p>${sources.icons.length} icons: ${kinds.length} kind icons and ${states.length} state glyphs, each at 16, 24 and 44 px (the dashed box is the 44 px touch target). Drawn for Map Studio (Apache-2.0) or adapted from Tabler Icons (MIT); see NOTICE. Colours are stand-ins for the theme tokens.</p>
</header>${panel('light')}${panel('dark')}
</body>
</html>
`;
}

/** Reads the sources and SVGs, runs every check, and returns {problems, sources, svgs}. */
export function load(opts) {
    const problems = [];
    let sources = null;
    try {
        sources = JSON.parse(readFileSync(opts.sources, 'utf8'));
    } catch (err) {
        return { problems: [`sources.json: cannot be read (${err.message})`], sources: null, svgs: {} };
    }
    const files = existsSync(opts.src)
        ? readdirSync(opts.src).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)).sort()
        : [];
    problems.push(...checkSources(sources, files));
    const svgs = {};
    const groups = Object.fromEntries((sources.icons || []).map((e) => [e && e.id, e && e.group]));
    for (const id of files) {
        const text = readFileSync(path.join(opts.src, id + '.svg'), 'utf8');
        svgs[id] = text;
        problems.push(...checkSvg(id, text, groups[id] === 'state' ? 'state' : 'kind'));
    }
    return { problems, sources, svgs };
}

export function parseArgs(argv) {
    const opts = { ...DEFAULTS, mode: 'build' };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--check') opts.mode = 'check';
        else if (a === '--write-catalogue') opts.mode = 'catalogue';
        else if (['--src', '--sources', '--catalogue', '--out'].includes(a)) opts[a.slice(2)] = path.resolve(argv[++i]);
        else throw new Error(`unknown argument ${a}`);
    }
    return opts;
}

export function run(opts) {
    const { problems, sources, svgs } = load(opts);
    if (problems.length === 0) {
        const expected = catalogueText(sources);
        if (opts.mode === 'catalogue') {
            writeFileSync(opts.catalogue, expected);
        } else {
            const committed = existsSync(opts.catalogue) ? readFileSync(opts.catalogue, 'utf8') : '';
            if (committed !== expected) {
                problems.push(`${path.relative(repoRoot, opts.catalogue)}: does not match sources.json; run node scripts/icons.mjs --write-catalogue`);
            }
        }
    }
    if (problems.length === 0 && opts.mode === 'build') {
        mkdirSync(opts.out, { recursive: true });
        writeFileSync(path.join(opts.out, 'mapstudio-icons.svg'), spriteText(sources, svgs));
        writeFileSync(path.join(opts.out, 'icons.json'), catalogueText(sources));
        writeFileSync(path.join(opts.out, 'contact-sheet.html'), contactSheetText(sources, svgs));
    }
    return { problems, count: sources && sources.icons ? sources.icons.length : 0 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    let opts;
    try {
        opts = parseArgs(process.argv.slice(2));
    } catch (err) {
        console.error(`icons: ${err.message}`);
        process.exit(2);
    }
    const { problems, count } = run(opts);
    if (problems.length > 0) {
        for (const p of problems) console.error(`icons: ${p}`);
        process.exit(1);
    }
    const did = opts.mode === 'build' ? `built into ${path.relative(webDir, opts.out)}` : opts.mode === 'catalogue' ? 'catalogue written' : 'checked';
    console.log(`icons: ${count} icons ${did}; licences allowed.`);
}
