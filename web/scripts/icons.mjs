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
// Options for tests: --src <dir> --sources <file> --catalogue <file> --out <dir> --notice <file>.
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
    out: path.join(webDir, 'build', 'generated-resources', 'mounted', 'icons'),
    notice: path.join(repoRoot, 'NOTICE')
};

/** Licences an icon may carry: permissive, no share-alike. */
export const ALLOWED_LICENCES = ['Apache-2.0', 'MIT', 'ISC', 'CC0-1.0'];
/** Sets an adapted icon may come from: the licence and the one release NOTICE names. */
export const SEED_SETS = { tabler: { licence: 'MIT', version: '3.49.0' } };
/**
 * Excluded sources, by any name they go by: OpenBridge (and its npm scope
 * @oicl), the template's icon library generated from it (`upstream.svg`,
 * `upstream/<name>`), and Font Awesome.
 */
export const FORBIDDEN_WORDS = /openbridge|oicl|upstream\.svg|upstream\/|font-?awesome/i;

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
const ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * The attributes of one tag's attribute text: double-quoted, single-quoted,
 * unquoted and bare. Anything the tokenizer cannot read is returned in
 * `rest`, which the caller treats as a problem.
 */
export function attrs(text) {
    const out = {};
    const re = /\s*([^\s"'=<>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/y;
    let pos = 0;
    let rest = '';
    const body = text.replace(/\/\s*$/, '');
    while (pos < body.length) {
        re.lastIndex = pos;
        const m = re.exec(body);
        if (!m || m[0].length === 0) {
            rest = body.slice(pos).trim();
            break;
        }
        out[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
        pos = re.lastIndex;
    }
    if (rest) out['\u0000rest'] = rest;
    return out;
}

/** Paint values an icon may use: an allow list, so named colours, url() and the rest fail. */
const PAINT_VALUES = ['none', 'currentColor'];

/**
 * True when a kind icon's shape is a closed outline in the alarm shapes'
 * family: a circle of radius 6 or more (two or more arcs of radius 6 or more
 * in one path count as one), or a square rect of side 12 or more. The circle
 * is alarm priority 2 and the square priority 3 (template docs/ux.md 5,
 * ER-27). Triangles are not detected; docs/icons.md lists that as a review item.
 */
export function alarmLikeOutline(name, a) {
    if (name === 'circle' && Number(a.r) >= 6) return `a circle of radius ${a.r}`;
    if (name === 'ellipse' && Number(a.rx) >= 6 && a.rx === a.ry) return `a circle of radius ${a.rx}`;
    if (name === 'rect' && a.width === a.height && Number(a.width) >= 12) return `a square of side ${a.width}`;
    if (name === 'path' && a.d) {
        const arcs = [...a.d.matchAll(/[aA]\s*([\d.]+)[\s,]+([\d.]+)/g)].filter((m) => Number(m[1]) >= 6 && m[1] === m[2]);
        if (arcs.length >= 2) return `a circle drawn with arcs of radius ${arcs[0][1]}`;
    }
    return null;
}

/**
 * Problems with one icon's SVG text, as plain sentences. `group` is 'kind'
 * (stroke only, no alarm-like outline) or 'state' (stroke, or a solid
 * currentColor fill). Attributes and paint are allow lists.
 */
export function checkSvg(id, text, group) {
    const problems = [];
    const say = (msg) => problems.push(`${id}.svg: ${msg}`);
    if (FORBIDDEN_WORDS.test(text)) say('names a forbidden source');
    if (/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(text)) say('has a colour literal; use currentColor');
    if (/\bstyle\b/i.test(text)) say('has a style attribute or element');
    if (/url\s*\(/i.test(text)) say('has a url() reference');
    if (/href|@import|<\s*(script|foreignObject|image|use)\b/i.test(text)) say('has an external reference');
    if (/<!--|<\?|<!DOCTYPE|<!\[CDATA/i.test(text)) say('has a comment, processing instruction, CDATA or doctype');
    const root = /^<svg\b([^>]*)>/.exec(text.trim());
    if (!root) {
        say('does not start with an <svg> element');
        return problems;
    }
    const ra = attrs(root[1]);
    for (const [name, value] of Object.entries(ra)) {
        if (name === '\u0000rest') say(`root has unreadable attribute text: ${value}`);
        else if (!ROOT_ATTRS[name]) say(`root attribute ${name} is not allowed`);
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
        const a = attrs(tag.replace(/^<\s*[A-Za-z][\w:-]*/, '').replace(/>$/, ''));
        for (const [k, v] of Object.entries(a)) {
            if (k === '\u0000rest') say(`<${name}> has unreadable attribute text: ${v}`);
            else if (!SHAPE_ATTRS.has(k)) say(`attribute ${k} on <${name}> is not allowed`);
            else if ((k === 'fill' || k === 'stroke') && !PAINT_VALUES.includes(v)) say(`${k}="${v}" on <${name}> is not allowed`);
            else if (k === 'fill' && group === 'kind' && v !== 'none') say(`fill="${v}" on <${name}>: a kind icon is stroke only`);
        }
        if (group === 'kind') {
            const outline = alarmLikeOutline(name, a);
            if (outline) say(`<${name}> is ${outline}, an alarm shape outline (circle is priority 2, square priority 3)`);
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
            else {
                const seed = SEED_SETS[m[1]];
                if (seed.licence !== e.licence) say(`${id} comes from ${m[1]}, whose licence is ${seed.licence}`);
                if (seed.version !== m[3]) say(`${id} comes from ${m[1]} ${m[3]}; only ${seed.version} is approved and named in NOTICE`);
            }
            if (typeof e.modified !== 'string' || e.modified.trim() === '') say(`${id} is adapted and must say how it was modified`);
        }
    }
    const fallback = sources.icons.find((e) => e && e.id === sources.fallback);
    if (!fallback || fallback.group !== 'kind') say('fallback must name a kind icon');
    for (const f of files) if (!seen.has(f)) say(`src/${f}.svg has no entry`);
    for (const id of seen) if (!files.includes(id)) say(`${id} has no src/${id}.svg`);
    return problems;
}

/** The NOTICE line naming one adapted icon: four spaces, `<id> from <source name>`. */
const NOTICE_LINE = /^ {4}([a-z0-9-]+) from ([a-z0-9-]+)$/;

/**
 * Problems with NOTICE against the sources: the adapted icons it lists must be
 * exactly the adapted entries (same ids, same source names, so the count
 * matches too), and each seed set's release and licence text must be there.
 */
export function checkNotice(sources, noticeText) {
    const problems = [];
    const say = (msg) => problems.push(`NOTICE: ${msg}`);
    if (noticeText === null) return ['NOTICE: cannot be read'];
    const expected = new Set();
    const sets = new Set();
    for (const e of sources.icons || []) {
        const m = /^([a-z]+):([a-z0-9-]+)@/.exec((e && e.origin) || '');
        if (m) {
            expected.add(`${e.id} from ${m[2]}`);
            sets.add(m[1]);
        }
    }
    const listed = new Set();
    for (const line of noticeText.split(/\r?\n/)) {
        const m = NOTICE_LINE.exec(line);
        if (m) listed.add(`${m[1]} from ${m[2]}`);
    }
    for (const x of expected) if (!listed.has(x)) say(`does not list "${x}" (add the line "    ${x}")`);
    for (const x of listed) if (!expected.has(x)) say(`lists "${x}", which sources.json does not adapt`);
    if (sets.has('tabler')) {
        if (!noticeText.includes(`Tabler Icons ${SEED_SETS.tabler.version}`)) say(`does not name Tabler Icons ${SEED_SETS.tabler.version}`);
        if (!noticeText.includes('Copyright (c) 2020-2026 Paweł Kuna')) say('does not carry Tabler\'s copyright line');
        if (!noticeText.includes('MIT License')) say('does not carry the MIT licence text');
    }
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
        <div class="ex"><span class="marker halo a1">${sym('alarm-1-unacknowledged')}</span><span class="digit">1</span><p><b>Priority 1, unacknowledged</b> - filled triangle with the unacknowledged mark, digit "1" as a label, count "2" where enabled</p></div>
        <div class="ex"><span class="marker halo a1">${sym('alarm-1-acknowledged')}</span><span class="digit">1</span><p><b>Priority 1, acknowledged</b> - filled triangle with "!", full strength</p></div>
        <div class="ex"><span class="marker halo a1">${sym('alarm-1-rectified')}</span><span class="digit">1</span><p><b>Priority 1, cleared, not yet acknowledged</b> - filled triangle with a check mark, full strength</p></div>
        <div class="ex"><span class="marker halo a2">${sym('alarm-2-unacknowledged')}</span><span class="digit">2</span><p><b>Priority 2, unacknowledged</b> - filled circle; acknowledged and cleared as for priority 1</p></div>
        <div class="ex"><span class="marker halo a3">${sym('alarm-3')}</span><span class="digit">3</span><p><b>Priority 3, unacknowledged</b> - outlined square in every state</p></div>
        <div class="ex"><span class="marker halo a3 faded">${sym('alarm-3')}</span><span class="digit">3</span><p><b>Priority 3, acknowledged or cleared</b> - the same outlined square, faded</p></div>
        <div class="ex"><span class="marker halo a1 faded">${sym('alarm-1-acknowledged')}</span><span class="digit">1</span><p><b>Alarm not live</b> (its rows in comms lost) - the glyph faded to 55 %</p></div>
      </div>`;
    const panel = (theme) => `
  <section class="panel ${theme}" aria-label="${theme} theme">
    <h2>${theme === 'light' ? 'Light' : 'Dark'} theme (stand-in token values)</h2>
    <h3>Kind icons (${kinds.length})</h3>
    <div class="grid">${kinds.map(cell).join('')}
    </div>
    <h3>State glyphs (${states.length})</h3>
    <p class="review">The alarm glyphs are alarm presentation: they need the template's engineering review (ER-27) before release. They follow the template's reviewed set (unacknowledged, acknowledged and cleared per priority; priority 3 one outlined square, faded once acknowledged), drawn new; docs/icons.md lists the differences.</p>
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
  .faded > .g { opacity: 0.55; }
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
    problems.push(...checkNotice(sources, existsSync(opts.notice) ? readFileSync(opts.notice, 'utf8') : null));
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
        else if (['--src', '--sources', '--catalogue', '--out', '--notice'].includes(a)) opts[a.slice(2)] = path.resolve(argv[++i]);
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
