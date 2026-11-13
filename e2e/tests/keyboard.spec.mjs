// The keyboard and contrast pass of Edit mode (epic 4 entry 17b, R14; WCAG 2.2: 2.1.1 keyboard, 2.1.2 no trap, 2.4.7 focus
// visible, 2.5.7 a non-drag way for every drag, 2.5.8 targets of 24 px, 1.4.11 non-text contrast of 3:1). One pass of every
// Edit mode surface with the keyboard alone, at 1366 and 1440 px: this file makes no mouse call. Every move of the focus is a
// Tab or an arrow key pressed until the control holds the focus (`tabTo`), every action a key, and what a step leaves
// behind is read from the page (the map's attributes, the focused element, computed styles, bounding boxes) or, for a
// stored record, through the test hook, which is also how the other editor of the conflict card saves.
//
// The pass records, it does not judge by bending: every check is written down as held or failed, with what was seen.
// A check that fails is a failure in the record (docs/platform-checks.md, "Epic 4 entry 17") and is named in
// KNOWN_FAILURES below, so the spec asserts what holds and that the failures are exactly the recorded ones: a new
// failure fails the spec, and so does a recorded one that no longer fails (the list and the record are then brought up
// to date). Nothing is skipped and no check is loosened to pass.
//
// Per surface (the plan's decision 2) the record says: reached by Tab, operated by keys, focus ring seen, Esc returns to
// Select or closes, the mode named in words, the smallest target in px, and for each drag its non-drag way. The contrast
// readings of the studio's own parts (e2e/lib/contrast.mjs STUDIO_PARTS) are taken in the light and the dark theme; the
// dark theme is the session's, switched by the dev /styles page's button from a second tab, by keys.
//
// Each part writes its rows to e2e/out/keyboard/; the last test of the file puts the tables together, in
// e2e/out/keyboard/record.md and, with E2E_DOCS=1, between the markers of docs/platform-checks.md.
//
// What it changes it puts back: the items it makes are deleted again, a moved point is undone, the units override is
// cleared, the session's theme is set back to light, and the dev setup is not touched.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { MINIMUM, checkParts, partMisses, partsTable } from '../lib/contrast.mjs';
import { docsMode, outDir, repoRoot } from '../lib/env.mjs';
import { openGate, routeSockets } from '../lib/sockets.mjs';
import {
    EDITOR2_USER, EDITOR_USER, OSM_TILES, REPLY_MS, TILE_PNG, clearUnits, editorTest, ensureSeeded, expect, mapLoaded, openEditor, openMap, removeStrays, send, signedInContext,
    stored, storedAll
} from './fixtures.mjs';

const KEYBOARD_OUT = path.join(outDir, 'keyboard');
/**
 * This run: the test runner's process, the parent of every worker of it (a worker started again after a failed test has the
 * same parent). Every file a part writes carries it, and the record is built only from files of this run.
 */
const RUN = String(process.ppid);
const RUN_FILE = path.join(KEYBOARD_OUT, 'run.json');
const WIDTHS = [[1366, 768], [1440, 900]];
const THEMES = ['light', 'dark'];
/** The smallest target (WCAG 2.2, 2.5.8). */
const TARGET_PX = 24;
/** How long a key's effect may take to show (a save's reply included). */
const SEEN_MS = 8_000;
/** How long the pass waits before it says a key did nothing: there is nothing to observe when nothing happens. */
const NOTHING_MS = 700;

/** The columns of the record, in the plan's order (decision 3). */
const COLUMNS = [['reach', 'Reached by Tab'], ['operate', 'Operated by keys'], ['ring', 'Focus ring seen'], ['esc', 'Esc returns to Select or closes'],
    ['mode', 'Mode named in words'], ['target', 'Smallest target'], ['drag', 'Each drag\'s non-drag way']];

/** The surfaces of the record, in the plan's order (decision 2), and the part of this file that walks each. */
const SURFACES = [
    ['Rail', 'chrome'], ['Toolbar', 'tools'], ['Select', 'tools'], ['Kind buttons (Well pad, Gathering line, Geofence)', 'tools'],
    ['Instrument tools (Tap, Line valve, Meter)', 'tools'], ['Point tool', 'tools'], ['Line tool', 'tools'], ['Area tool', 'tools'], ['Snap', 'tools'],
    ['Undo, Redo and the undo list', 'tools'], ['Item list and its search', 'items'], ['Details', 'items'], ['Style', 'items'], ['Tag browser', 'kinds'],
    ['Kinds list', 'kinds'], ['Kind setup', 'kinds'], ['Rule editor', 'kinds'], ['Layers', 'layers'], ['Legend', 'layers'], ['Units', 'layers'],
    ['Recent changes', 'layers'], ['Save card', 'cards'], ['Conflict card', 'cards'], ['Editing switch', 'chrome'], ['The map itself', 'chrome']
];

/**
 * The studio parts under 3:1 today, by theme: `part | mark colour on surface | ratio`, as the record's tables list them.
 * A pressed or hovered button is read by its fill or its edge against the panel, as the plan's decision 4 asks; where the
 * fill is faint the state is also said by the glyph's hue, the weight of the words and `aria-pressed`, which the record notes.
 */
const KNOWN_MISSES = {
    light: [
        'hover | fill #D8D8D8 on #FAFAFA | 1.37',
        'hover | no fill and no edge #FAFAFA on #FAFAFA | 1.00',
        'hover | top edge #BDBDBD on #FAFAFA | 1.80',
        'pressed | fill #D8D8D8 on #FAFAFA | 1.37',
        'pressed | fill #DDEBF1 on #FAFAFA | 1.17'
    ],
    dark: [
        'hover | fill #515151 on #161616 | 2.28',
        'hover | no fill and no edge #161616 on #161616 | 1.00',
        'hover | top edge #5E5E5E on #161616 | 2.79',
        'hover-glyph | glyph #229AD6 on #515151 | 2.52',
        'hover-glyph | words #229AD6 on #515151 | 2.52',
        'pressed | fill #17262D on #161616 | 1.16',
        'pressed | fill #515151 on #161616 | 2.28'
    ]
};

/**
 * The checks that fail today, by part: `surface | column | what`, exactly as the record lists them. Nothing here is fixed
 * by this entry (the plan: a fix is a new entry); each is in docs/platform-checks.md, "Epic 4 entry 17", for the owner.
 */
const KINDS_ROW = 'Kind buttons (Well pad, Gathering line, Geofence)';
const ESC_ON_BUTTON = (surface, name) => surface + ' | esc | Esc returns to Select with the focus on the ' + name + ' button (where arming leaves it)';
const KNOWN_FAILURES = {
    chrome: [
        // K2 names the arrow keys: the rail's items are Tab stops only.
        'Rail | operate | the arrow keys move between the rail\'s items (K2)',
        // The canvas takes the focus with no outline of its own or of its container.
        'The map itself | ring | the map shows a focus ring when Tab reaches it'
    ],
    tools: [
        // K2 names the arrow keys: a role of toolbar or menu leads its user to them, and each button is a Tab stop only.
        'Toolbar | operate | the arrow keys move along the toolbar, which has role "toolbar" (K2)',
        'Instrument tools (Tap, Line valve, Meter) | operate | the arrow keys move in the list of kinds, which has role "menu" (K2)',
        // Esc puts a tool down only while the focus is on the map: the tool's own listener is the map container's.
        ESC_ON_BUTTON(KINDS_ROW, 'Well pad'), ESC_ON_BUTTON(KINDS_ROW, 'Gathering line'), ESC_ON_BUTTON(KINDS_ROW, 'Geofence'),
        ESC_ON_BUTTON('Point tool', 'Point'), ESC_ON_BUTTON('Line tool', 'Line'), ESC_ON_BUTTON('Area tool', 'Area'),
        // K4: placing and reshaping need the pointer (a click, never a drag).
        'Point tool | operate | a point is made by keys alone (K4)',
        'Point tool | operate | the new place of Move is given by keys alone',
        'Line tool | operate | a point of a line is placed by keys alone (K4)',
        'Line tool | operate | a line is reshaped by keys alone (K4)',
        'Area tool | operate | a point of an area is placed by keys alone (K4)',
        'Area tool | operate | an area is reshaped by keys alone (K4)',
        // Undo turns off under the focus when its last step is undone.
        'Undo, Redo and the undo list | operate | the focus is kept after the last step is undone (Undo is then off)'
    ],
    items: [
        'Item list and its search | esc | Esc returns to Select with the focus on Add item (where arming leaves it)',
        'Item list and its search | target | at least 24 px both ways: mapstudio-list-check is 16x16',
        'Item list and its search | target | at least 24 px both ways: mapstudio-list-select-all is 18 px high',
        'Item list and its search | target | at least 24 px both ways: mapstudio-list-select-all is 19 px high',
        'Item list and its search | target | at least 24 px both ways: mapstudio-panel-save-button is 21 px high',
        // Close unmounts under the focus.
        'Details | operate | the focus is kept when Details closes'
    ],
    kinds: [
        // The tick boxes and switches of a kind's setup, their labels counted: rows 18 px high.
        'Kind setup | target | at least 24 px both ways: mapstudio-field-check is 18 px high',
        'Kind setup | target | at least 24 px both ways: mapstudio-switch is 18 px high'
    ],
    layers: [
        // PanelTabs.tsx: the Details and Style tabs rove by the arrow keys, these two do not.
        'Layers | operate | the arrow keys move between the Layers and Legend tabs, as they do between Details and Style'
    ],
    cards: []
};

// ---- What runs in the page ----

/**
 * The page's own readers, installed before the page's scripts (addInitScript): the focused element in words, its focus
 * ring, the colours a viewer sees under an element, a surface's focusable controls and its targets' sizes. They only read.
 */
function installReaders() {
    const rgba = (value) => {
        const v = String(value || '').trim();
        let m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(v);
        if (m) {
            return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4])];
        }
        m = /^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(v);
        if (m) {
            return [Number(m[1]) * 255, Number(m[2]) * 255, Number(m[3]) * 255, m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4])];
        }
        throw new Error('Not a computed colour: ' + JSON.stringify(value));
    };
    /** The fills under an element, the top one first, down to the first opaque one (the page's ground is white when none is). */
    const fills = (el) => {
        const out = [];
        for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
            const c = rgba(getComputedStyle(n).backgroundColor);
            if (c[3] > 0) {
                out.push(c);
            }
            if (c[3] >= 0.999) {
                return out;
            }
        }
        out.push([255, 255, 255, 1]);
        return out;
    };
    const shown = (el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const words = (el) => {
        const by = el.getAttribute('aria-labelledby');
        const labelled = by ? by.split(/\s+/).map((id) => (document.getElementById(id) || { textContent: '' }).textContent.trim()).join(' ') : '';
        // The words as read: each piece of text apart, a select's options left out.
        const textOf = (node) => {
            const parts = [];
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (t.parentElement && t.parentElement.closest('select')
                ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
            while (walker.nextNode()) {
                if (walker.currentNode.nodeValue.trim() !== '') parts.push(walker.currentNode.nodeValue.trim());
            }
            return parts.join(' ');
        };
        const label = el.labels && el.labels[0] ? textOf(el.labels[0]) : '';
        const text = el.tagName === 'SELECT' ? '' : textOf(el);
        const name = el.getAttribute('aria-label') || labelled || label || text || el.getAttribute('title') || el.getAttribute('placeholder')
            || (typeof el.className === 'string' ? el.className.split(/\s+/).pop() : el.tagName.toLowerCase());
        return name.replace(/\s+/g, ' ').slice(0, 60);
    };
    const nearOf = (el) => [[el, 'itself'], [el.nextElementSibling, 'the mark after it'], [el.parentElement, 'its label'],
        [el.parentElement ? el.parentElement.parentElement : null, 'its row']].filter(([n]) => !!n);
    const outlineOf = (n) => {
        const cs = getComputedStyle(n);
        return cs.outlineStyle + '|' + cs.outlineWidth + '|' + cs.outlineColor + '|' + cs.outlineOffset;
    };
    /**
     * The outline of every control and of the marks beside it while it does not hold the focus, kept before each key (the
     * spec calls it): a ring is an outline that is there with the focus and was not there without it.
     */
    const idle = new WeakMap();
    const snapshot = () => {
        const held = new Set(document.activeElement ? nearOf(document.activeElement).map(([n]) => n) : []);
        for (const el of document.querySelectorAll('.mapstudio button, .mapstudio input, .mapstudio select, .mapstudio textarea, .mapstudio a[href], .mapstudio [tabindex]')) {
            for (const [n] of nearOf(el)) {
                if (!held.has(n)) {
                    idle.set(n, outlineOf(n));
                }
            }
        }
    };
    /**
     * The ring a focused element shows, on itself or on the mark beside it (a hidden radio rings its label): an outline
     * that the focus brought. An outline the element or the mark has without the focus is not one. A control made after
     * the last key (a menu's first row) is compared with a like control that does not hold the focus. Where the ring is
     * the browser's own (`outline-style: auto`) it is said so and its colour is not read: the browser paints it, not the page.
     */
    const ringOf = (el) => {
        for (const [n, on] of nearOf(el)) {
            const cs = getComputedStyle(n);
            const width = parseFloat(cs.outlineWidth) || 0;
            if (cs.outlineStyle === 'none' || width <= 0) continue;
            let without = idle.get(n);
            if (without === undefined && typeof n.className === 'string' && n.className !== '') {
                const peer = Array.from(document.getElementsByClassName(n.className.split(/\s+/)[0])).find((o) => o !== n && !o.contains(document.activeElement));
                without = peer ? outlineOf(peer) : undefined;
            }
            if (without === outlineOf(n)) continue;
            if (cs.outlineStyle === 'auto') {
                return { on, browser: true };
            }
            if (rgba(cs.outlineColor)[3] <= 0) continue;
            const offset = parseFloat(cs.outlineOffset) || 0;
            // Inside the element the ring is seen on the element's own fill, outside it on what is around.
            const ground = fills(offset < 0 ? n : (n.parentElement || n));
            return { on, width, offset, layers: [rgba(cs.outlineColor), ...ground], surface: ground };
        }
        return null;
    };
    const SURFACE_OF = [['.mapstudio-tagbrowser', 'Tag browser'], ['.mapstudio-save-card', 'Card'], ['.mapstudio-rail', 'Rail'], ['.mapstudio-toolbar', 'Toolbar'],
        ['.mapstudio-drawing-bar', 'Drawing bar'], ['.mapstudio-geometry-bar', 'Geometry bar'], ['.mapstudio-rule', 'Rule editor'], ['.mapstudio-kindsetup', 'Kind setup'],
        ['.mapstudio-dock--kinds', 'Kinds list'], ['.mapstudio-dock--layers', 'Layers'], ['.mapstudio-dock--history', 'Recent changes'],
        ['.mapstudio-dock--items', 'Item list'], ['.mapstudio-panel', 'Details'], ['.mapstudio-edit-switch', 'Editing switch'],
        ['.maplibregl-canvas', 'Map'], ['.maplibregl-ctrl', 'Map controls'], ['.mapstudio', 'Studio']];
    const info = (el) => {
        if (!el || el === document.body) {
            return null;
        }
        const r = el.getBoundingClientRect();
        const within = SURFACE_OF.find(([s]) => el.closest(s));
        return { tag: el.tagName.toLowerCase(), cls: typeof el.className === 'string' ? el.className : '', name: words(el), within: within ? within[1] : 'the page',
            w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, ring: ringOf(el), tabindex: el.getAttribute('tabindex') };
    };
    /** The controls of a container that Tab must reach: enabled, shown, not taken out of the order; of a radio group, its one stop. */
    const stops = (container) => {
        const all = Array.from(container.querySelectorAll('button, input, select, textarea, a[href], [tabindex]'));
        return all.filter((el) => {
            if (el.disabled || !shown(el) && !(el.type === 'radio' || el.type === 'checkbox') || el.getAttribute('tabindex') === '-1' || el.type === 'hidden') {
                return false;
            }
            if ((el.type === 'radio' || el.type === 'checkbox') && !shown(el) && !(el.labels && el.labels[0] && shown(el.labels[0]))) {
                return false;
            }
            if (el.type === 'radio' && el.name) {
                const group = all.filter((o) => o.type === 'radio' && o.name === el.name && !o.disabled);
                const checked = group.find((o) => o.checked);
                return el === (checked || group[0]);
            }
            return true;
        });
    };
    /** A target's box: the control's own, or with its label when a click on the label works it (a checkbox or radio in a label). */
    const targetBox = (el) => {
        let r = el.getBoundingClientRect();
        if ((el.type === 'checkbox' || el.type === 'radio') && el.labels && el.labels[0]) {
            const l = el.labels[0].getBoundingClientRect();
            const x = Math.min(r.left, l.left);
            const y = Math.min(r.top, l.top);
            r = { width: Math.max(r.right, l.right) - x, height: Math.max(r.bottom, l.bottom) - y };
        }
        return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
    };
    const TARGETS = 'button, [role="tab"], [role="switch"], [role="menuitem"], [role="treeitem"], input[type="checkbox"], input[type="radio"], a[href]';
    const targets = (container, not = null) => [container, ...Array.from(container.querySelectorAll(TARGETS))].filter((el) => el.matches(TARGETS) && !(not && el.closest(not)))
        .filter((el) => shown(el) || ((el.type === 'checkbox' || el.type === 'radio') && el.labels && el.labels[0] && shown(el.labels[0])))
        .map((el) => ({ name: words(el), cls: typeof el.className === 'string' ? el.className.split(/\s+/)[0] : '', ...targetBox(el) }));
    /** The marks of a control's state: its fill, each edge drawn in another colour, and its glyph or words, with the surface around it. */
    const marks = (el) => {
        const cs = getComputedStyle(el);
        const around = fills(el.parentElement || el);
        const own = rgba(cs.backgroundColor);
        const state = [];
        if (own[3] > 0) {
            state.push({ what: 'fill', layers: fills(el) });
        }
        const seen = new Set();
        for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
            const c = rgba(cs['border' + side + 'Color']);
            const key = c.join(',');
            if (parseFloat(cs['border' + side + 'Width']) > 0 && cs['border' + side + 'Style'] !== 'none' && c[3] > 0 && !seen.has(key)) {
                seen.add(key);
                state.push({ what: side.toLowerCase() + ' edge', layers: [c, ...around] });
            }
        }
        // An edge drawn as an inset shadow with no blur (the pressed Units and Basemap buttons, the row a card is open for).
        for (const shadow of cs.boxShadow === 'none' ? [] : cs.boxShadow.split(/,(?![^(]*\))/)) {
            const m = /^\s*((?:rgba?|color)\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/.exec(shadow);
            if (m && /inset/.test(shadow) && Number(m[4]) === 0 && rgba(m[1])[3] > 0 && !seen.has(rgba(m[1]).join(','))) {
                seen.add(rgba(m[1]).join(','));
                state.push({ what: 'edge', layers: [rgba(m[1]), ...around] });
            }
        }
        if (state.length === 0) {
            state.push({ what: 'no fill and no edge', layers: around });
        }
        const glyph = el.querySelector('svg') || el;
        // A glyph drawn faint by its button's opacity (a button that is off) is read as faint.
        const ink = rgba(getComputedStyle(glyph).color);
        ink[3] *= (parseFloat(cs.opacity) || 1) * (glyph === el ? 1 : parseFloat(getComputedStyle(glyph).opacity) || 1);
        return { state, surface: around, glyph: [{ what: el.querySelector('svg') ? 'glyph' : 'words', layers: [ink, ...fills(el)] }], own: fills(el),
            name: words(el), off: !!el.disabled };
    };
    window.__keyboardPass = {
        info, stops, targets, marks, words, snapshot,
        seen: new Set(),
        active: () => info(document.activeElement)
    };
}

// ---- The keys ----

/** The focused element in words, or null when the page's body holds the focus. */
async function active(page) {
    return page.evaluate(() => window.__keyboardPass.active());
}

async function focusIs(page, selector) {
    return page.evaluate((s) => !!document.activeElement && document.activeElement !== document.body && document.activeElement.matches(s), selector);
}

/**
 * Tab (or Shift+Tab with `back`) until the focus is on a control matching `selector`. True when it got there, false when
 * `max` presses did not reach it: the page's whole ring is under 300 stops with the seed's items listed.
 */
async function tabTo(page, selector, { back = false, max = 320 } = {}) {
    for (let i = 0; i <= max; i++) {
        if (await focusIs(page, selector)) {
            return true;
        }
        await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
    }
    return false;
}

/** Whether `check` (expectations with their own waits) comes to hold. */
async function holds(check) {
    try {
        await check();
        return true;
    } catch (err) {
        return false;
    }
}

/** Whether the map's attribute takes the value within the time a key's effect may take. */
async function attr(map, name, value) {
    return holds(() => expect(map).toHaveAttribute(name, value, { timeout: SEEN_MS }));
}

/** A field's text replaced by keys: all of it selected, the new text typed over it. */
async function retype(page, text) {
    await page.keyboard.press('Control+a');
    if (text === '') {
        await page.keyboard.press('Backspace');
    } else {
        await page.keyboard.type(text);
    }
}

// ---- The record ----

/** The rows of one part at one width: checks held or failed, with what was seen. */
function recorder(part, width) {
    const checks = [];
    const texts = [];
    return {
        part, width, checks, texts,
        /** One check: `ok` true (held), false (failed, a failure of the record). `seen` is what the page showed. */
        add(surface, column, what, ok, seen = '') {
            checks.push({ surface, column, what, ok: !!ok, seen: String(seen) });
            return !!ok;
        },
        /** Words for a cell that is not a check: a drag's non-drag way. */
        text(surface, column, words) {
            texts.push({ surface, column, words });
        },
        failures() {
            return checks.filter((c) => !c.ok).map((c) => c.surface + ' | ' + c.column + ' | ' + c.what);
        }
    };
}

/** The part's rows written to the results folder, then: the failures are exactly the recorded ones. */
function close(rec) {
    mkdirSync(KEYBOARD_OUT, { recursive: true });
    writeFileSync(path.join(KEYBOARD_OUT, rec.width + '-' + rec.part + '.json'), JSON.stringify({ run: RUN, part: rec.part, width: rec.width, checks: rec.checks, texts: rec.texts }, null, 1));
    const seen = rec.checks.filter((c) => !c.ok).map((c) => c.surface + ' | ' + c.column + ' | ' + c.what + (c.seen ? ' [' + c.seen + ']' : ''));
    expect(rec.failures().sort(), 'the failed checks are the recorded ones (KNOWN_FAILURES.' + rec.part + '); seen:\n' + seen.join('\n')).toEqual([...KNOWN_FAILURES[rec.part]].sort());
}

/**
 * Walk a surface by Tab: from the first of its controls to take the focus until the focus leaves it. Records that every
 * control Tab must reach was reached (in the order of the page, none left out, the focus not held), that each showed a
 * focus ring, and the surface's smallest target. `container` is the surface's selector; `as` renames a control's surface.
 */
async function walk(page, rec, surface, container, { from = null, max = 400, except = null } = {}) {
    if (from) {
        await tabTo(page, from);
    }
    const inside = container + ', ' + container + ' *';
    if (!await tabTo(page, inside)) {
        rec.add(surface, 'reach', 'a control of the surface takes the focus', false, 'Tab never came to ' + container);
        return [];
    }
    await page.evaluate(() => window.__keyboardPass.seen.clear());
    const stops = [];
    let left = false;
    for (let i = 0; i < max; i++) {
        if (!await focusIs(page, inside)) {
            left = true;
            break;
        }
        stops.push(await page.evaluate(() => {
            window.__keyboardPass.seen.add(document.activeElement);
            return window.__keyboardPass.active();
        }));
        await page.keyboard.press('Tab');
    }
    const report = await page.evaluate(([sel, not]) => {
        const kp = window.__keyboardPass;
        const boxes = Array.from(document.querySelectorAll(sel));
        const want = boxes.flatMap((b) => kp.stops(b));
        const missed = want.filter((el) => !kp.seen.has(el)).map((el) => kp.words(el));
        const order = Array.from(kp.seen).map((el) => want.indexOf(el)).filter((i) => i >= 0);
        const positive = want.filter((el) => Number(el.getAttribute('tabindex')) > 0).map((el) => kp.words(el));
        return { want: want.length, missed, inOrder: order.every((v, i) => i === 0 || v > order[i - 1]), positive, targets: boxes.flatMap((b) => kp.targets(b, not)) };
    }, [container, except]);
    rec.add(surface, 'reach', 'every control takes the focus by Tab (' + stops.length + ' stops)', report.missed.length === 0, 'not reached: ' + report.missed.join('; '));
    rec.add(surface, 'reach', 'the order is the page\'s own, no control moved out of it', report.inOrder && report.positive.length === 0,
        report.positive.length ? 'a tabindex above 0 on: ' + report.positive.join('; ') : 'the focus moved against the order of the page');
    rec.add(surface, 'reach', 'Tab leaves the surface (no trap)', left, 'the focus was still inside after ' + max + ' presses');
    const bare = [...new Set(stops.filter((s) => !s.ring).map((s) => s.name + ' (' + s.tag + '.' + s.cls.split(/\s+/)[0] + ')'))];
    rec.add(surface, 'ring', 'every stop shows a focus ring', bare.length === 0, 'no outline brought by the focus on: ' + bare.join('; '));
    const own = [...new Set(stops.filter((s) => s.ring && s.ring.browser).map((s) => s.tag + '.' + s.cls.split(/\s+/)[0]))];
    if (own.length) {
        rec.text(surface, 'ring', 'The ring is the browser\'s own (outline auto), its colour not read, on: ' + own.join(', ') + '.');
    }
    targetsOf(rec, surface, report.targets);
    return stops;
}

/** The surface's smallest target, and each one under 24 px either way as a failure with its size. */
function targetsOf(rec, surface, targets) {
    if (targets.length === 0) {
        return;
    }
    const small = new Map();
    let least = targets[0];
    for (const t of targets) {
        if (Math.min(t.w, t.h) < Math.min(least.w, least.h)) {
            least = t;
        }
        if (t.w < TARGET_PX || t.h < TARGET_PX) {
            // One line per kind of control and size: forty list rows' tick boxes are one finding; a wide control is named by its height alone.
            small.set(t.cls + ' ' + (t.w < TARGET_PX ? Math.round(t.w) + 'x' + Math.round(t.h) : Math.round(t.h) + ' px high'), t);
        }
    }
    rec.text(surface, 'target', least.w + ' x ' + least.h + ' px (' + least.name + ')');
    if (small.size === 0) {
        rec.add(surface, 'target', 'every button, tab and tick box is at least 24 px both ways (' + targets.length + ' read)', true);
    }
    for (const [key, t] of small) {
        rec.add(surface, 'target', 'at least 24 px both ways: ' + key.split(' ')[0] + ' is ' + key.split(' ').slice(1).join(' '), false, t.w + ' x ' + t.h + ' px, for example "' + t.name + '"');
    }
}

/** The targets of a container read without a walk (a card, a menu). */
async function readTargets(page, rec, surface, container) {
    targetsOf(rec, surface, await page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).flatMap((b) => window.__keyboardPass.targets(b)), container));
}

/** One control reached by Tab and showing its ring: two checks of `surface`. Returns whether it holds the focus. */
async function reach(page, rec, surface, what, selector, options = {}) {
    const there = rec.add(surface, 'reach', what + ' takes the focus by Tab', await tabTo(page, selector, options), 'Tab never came to ' + selector);
    if (there) {
        const now = await active(page);
        rec.add(surface, 'ring', what + ' shows a focus ring', !!(now && now.ring), 'no outline on the focused ' + (now ? now.tag + '.' + now.cls : 'element'));
    }
    return there;
}

// ---- The pass ----

let seedIds;

/** The page with the readers installed, on /edit as the map editor. */
async function openStudio(page) {
    await page.addInitScript(installReaders);
    // Before every key the page notes each control's outline without the focus, so a ring is told from an outline that is always there.
    const press = page.keyboard.press.bind(page.keyboard);
    page.keyboard.press = async (key, options) => {
        await page.evaluate(() => window.__keyboardPass && window.__keyboardPass.snapshot()).catch(() => {});
        return press(key, options);
    };
    return openEditor(page);
}

/** The list narrowed to `text` by the search field, by keys: the focus is left in the field. */
async function searchFor(page, text) {
    const there = await tabTo(page, '.mapstudio-list-search-input');
    expect(there, 'the search field takes the focus by Tab').toBe(true);
    await retype(page, text);
    return there;
}

/** The list row named `name` chosen by keys (the list narrowed to it first): Details opens on it. */
async function chooseRow(page, map, name, id) {
    await searchFor(page, name);
    const there = await tabTo(page, '.mapstudio-list-row[data-item-id="' + id + '"]');
    await page.keyboard.press('Enter');
    return there && await attr(map, 'data-selected', id);
}

editorTest.beforeAll(async ({ browser }) => {
    editorTest.setTimeout(240_000);
    // A new run starts with an empty results folder, so no reading of an earlier run can reach the record.
    if (!existsSync(RUN_FILE) || JSON.parse(readFileSync(RUN_FILE, 'utf8')).run !== RUN) {
        rmSync(KEYBOARD_OUT, { recursive: true, force: true });
        mkdirSync(KEYBOARD_OUT, { recursive: true });
        writeFileSync(RUN_FILE, JSON.stringify({ run: RUN }));
    }
    const seed = await ensureSeeded(browser);
    seedIds = seed.ids;
    // The pass walks the seed's items alone: what earlier specs left is deleted first, as the specs that count the seed do.
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
        await removeStrays(page, seedIds);
        await clearUnits(page);
    } finally {
        await context.close();
    }
});

for (const [width, height] of WIDTHS) {
    editorTest.describe(width + ' px', () => {
        editorTest.use({ viewport: { width, height }, deviceScaleFactor: 1 });

        editorTest('the whole ring by Tab and back, the rail and the Editing switch', async ({ page }) => {
            editorTest.setTimeout(300_000);
            const rec = recorder('chrome', width);
            const map = await openStudio(page);

            // K1: Tab from the page's start, round the whole page once.
            const ring = [];
            for (let i = 0; i < 400; i++) {
                await page.keyboard.press('Tab');
                const now = await active(page);
                const key = now ? now.tag + '|' + now.cls + '|' + now.name : 'body';
                if (ring.length > 0 && key === ring[0].key) {
                    break;
                }
                ring.push({ key, ...(now || { within: 'the page', name: 'the page itself' }) });
            }
            const order = [...new Set(ring.map((s) => s.within))];
            rec.add('Rail', 'reach', 'Tab goes round the whole page and comes back to its first stop (' + ring.length + ' stops: ' + order.join(', ') + ')',
                ring.length < 400, 'no way round in 400 presses');
            // The studio's surfaces in the order a reader meets them: the rail, the list, the map, then what floats on it.
            const studio = order.filter((s) => ['Rail', 'Item list', 'Map', 'Editing switch', 'Toolbar'].includes(s));
            rec.add('Rail', 'reach', 'the order is the rail, the list, the map, the Editing switch, then the toolbar', studio.join(', ') === 'Rail, Item list, Map, Editing switch, Toolbar',
                studio.join(', '));
            // And back: Shift+Tab from the first stop walks the same ring the other way.
            await tabTo(page, '.mapstudio-rail-item[data-surface="view"]');
            const back = [];
            for (let i = 0; i < 3; i++) {
                await page.keyboard.press('Shift+Tab');
                const now = await active(page);
                back.push(now ? now.tag + '|' + now.cls + '|' + now.name : 'body');
            }
            const at = ring.findIndex((s) => s.cls === 'mapstudio-rail-item' && s.name === 'View');
            const before = [1, 2, 3].map((n) => ring[(at - n + ring.length) % ring.length].key);
            rec.add('Rail', 'reach', 'Shift+Tab walks the ring the other way', JSON.stringify(back) === JSON.stringify(before), back.join(' / ') + ' where ' + before.join(' / '));
            const canvas = ring.find((s) => s.within === 'Map');
            rec.add('The map itself', 'ring', 'the map shows a focus ring when Tab reaches it', !!(canvas && canvas.ring), 'no outline on the focused canvas.maplibregl-canvas');

            // The rail: every item by Tab, with its ring; Enter and Space switch the surface as a click does.
            await walk(page, rec, 'Rail', '.mapstudio-rail');
            for (const [surface, key] of [['kinds', 'Enter'], ['layers', 'Space'], ['history', 'Enter'], ['items', 'Space']]) {
                await tabTo(page, '.mapstudio-rail-item[data-surface="' + surface + '"]');
                await page.keyboard.press(key);
                rec.add('Rail', 'operate', key + ' on ' + surface[0].toUpperCase() + surface.slice(1) + ' opens it', await attr(map, 'data-surface', surface), await map.getAttribute('data-surface'));
                rec.add('Rail', 'mode', surface[0].toUpperCase() + surface.slice(1) + ' says it is the open one (aria-pressed and the label under its glyph)',
                    await page.evaluate((label) => {
                        const el = document.activeElement;
                        const under = el && el.querySelector('.mapstudio-rail-label');
                        return !!el && el.matches('.mapstudio-rail-item') && el.getAttribute('aria-pressed') === 'true' && !!under && under.textContent === label;
                    }, surface[0].toUpperCase() + surface.slice(1)), JSON.stringify(await active(page)));
            }
            const arrows = await active(page);
            await page.keyboard.press('ArrowDown');
            rec.add('Rail', 'operate', 'the arrow keys move between the rail\'s items (K2)', (await active(page)).name !== arrows.name,
                'ArrowDown left the focus on ' + arrows.name + ': each item is its own Tab stop and takes no arrow key');
            // Esc on the rail leaves the surface and the tool as they are: Select is in hand already.
            await page.keyboard.press('Escape');
            rec.add('Rail', 'esc', 'Esc on the rail keeps Select in hand and Edit mode on', await attr(map, 'data-tool', '') && await attr(map, 'data-mode', 'edit'),
                'tool ' + await map.getAttribute('data-tool') + ', mode ' + await map.getAttribute('data-mode'));
            rec.text('Rail', 'drag', 'No drag.');

            // View leaves Edit mode; the Editing switch brings it back, by Space and by Enter.
            await tabTo(page, '.mapstudio-rail-item[data-surface="view"]');
            await page.keyboard.press('Enter');
            rec.add('Rail', 'operate', 'Enter on View leaves Edit mode', await attr(map, 'data-mode', 'view'), await map.getAttribute('data-mode'));
            const sw = '.mapstudio-edit-switch-button';
            await reach(page, rec, 'Editing switch', 'the switch', sw);
            const off = await active(page);
            rec.add('Editing switch', 'mode', 'the switch says the mode in words while off (role switch, aria-checked false, a name)',
                await focusIs(page, sw + '[role="switch"][aria-checked="false"]') && off.name !== '', JSON.stringify(off));
            await page.keyboard.press('Space');
            rec.add('Editing switch', 'operate', 'Space switches Edit mode on', await attr(map, 'data-mode', 'edit') && await attr(map, 'data-studio', 'on'), await map.getAttribute('data-mode'));
            const on = await active(page);
            rec.add('Editing switch', 'mode', 'the switch says the mode in words while on (aria-checked true, "' + (on ? on.name : '') + '")',
                await focusIs(page, sw + '[role="switch"][aria-checked="true"]') && /Editing/.test(on ? on.name : ''), JSON.stringify(on));
            await page.keyboard.press('Enter');
            rec.add('Editing switch', 'operate', 'Enter switches Edit mode off', await attr(map, 'data-mode', 'view'), await map.getAttribute('data-mode'));
            await tabTo(page, sw);
            await page.keyboard.press('Enter');
            rec.add('Editing switch', 'operate', 'Enter switches it on again, the focus kept on the switch', await attr(map, 'data-mode', 'edit') && await focusIs(page, sw),
                JSON.stringify(await active(page)));
            await page.keyboard.press('Escape');
            rec.add('Editing switch', 'esc', 'Esc on the switch keeps Select in hand and Edit mode on', await attr(map, 'data-tool', '') && await attr(map, 'data-mode', 'edit'),
                'tool ' + await map.getAttribute('data-tool') + ', mode ' + await map.getAttribute('data-mode'));
            await readTargets(page, rec, 'Editing switch', '.mapstudio-edit-switch');
            rec.text('Editing switch', 'drag', 'No drag: the switch is pressed, never slid.');
            rec.add('The map itself', 'reach', 'the map takes the focus by Tab, between the list and the Editing switch', !!canvas, 'no stop on the map');
            rec.add('The map itself', 'mode', 'the map is named in words ("' + (canvas ? canvas.name : '') + '")', !!canvas && canvas.name === 'Map', JSON.stringify(canvas));
            if (canvas) {
                rec.text('The map itself', 'target', canvas.w + ' x ' + canvas.h + ' px (the map, one target)');
                await tabTo(page, '.maplibregl-canvas');
                const centre = await map.getAttribute('data-center');
                await page.keyboard.press('ArrowRight');
                rec.add('The map itself', 'operate', 'an arrow key pans the map', await holds(() => expect(map).not.toHaveAttribute('data-center', centre, { timeout: SEEN_MS })), 'the centre stayed ' + centre);
            }
            rec.text('The map itself', 'esc', 'Esc on the map puts a tool down (the tools\' rows) and closes Details (Details\' row); with neither, it changes nothing.');
            rec.text('The map itself', 'drag', 'Panning is a drag: the arrow keys pan and + and - zoom (MapLibre\'s own keys), and the zoom card\'s buttons take Enter.');
            close(rec);
        });

        editorTest('the toolbar and every tool: armed by keys, named in words, put down by Esc; a point, a line and an area by keys alone; Snap, Undo and Redo',
            async ({ page }) => {
                editorTest.setTimeout(480_000);
                const rec = recorder('tools', width);
                const map = await openStudio(page);
                const bar = page.locator('.mapstudio-drawing-bar');
                const tool = async () => (await map.getAttribute('data-tool')) || 'select';
                const moves = seedIds['shared/a'];
                const seededAt = (await stored(page, moves)).geometry.coordinates;
                try {
                /** Select in hand again whatever a failed step left: the toolbar's Select by Enter. */
                const putDown = async () => {
                    if ((await map.getAttribute('data-tool')) !== '') {
                        await tabTo(page, '.mapstudio-tool--select');
                        await page.keyboard.press('Enter');
                        await expect(map).toHaveAttribute('data-tool', '');
                    }
                };

                await walk(page, rec, 'Toolbar', '.mapstudio-toolbar');
                await tabTo(page, '.mapstudio-tool--select');
                await page.keyboard.press('ArrowRight');
                rec.add('Toolbar', 'operate', 'the arrow keys move along the toolbar, which has role "' + await page.locator('.mapstudio-toolbar').getAttribute('role') + '" (K2)',
                    !(await focusIs(page, '.mapstudio-tool--select')), 'ArrowRight left the focus on Select: each button is its own Tab stop and takes no arrow key');
                rec.text('Toolbar', 'drag', 'No drag on the toolbar itself.');
                rec.text('Toolbar', 'esc', 'Esc is each tool\'s own (the rows below): from the map it puts the tool down, from a toolbar button it does not.');
                rec.text('Toolbar', 'mode', 'The tool in hand is the pressed button (aria-pressed) and, for a drawing tool, the drawing bar\'s title.');

                // Select: in hand at the start, said by aria-pressed and its name.
                await reach(page, rec, 'Select', 'Select', '.mapstudio-tool--select');
                rec.add('Select', 'mode', 'Select says it is in hand (aria-pressed true, named "Select")', await focusIs(page, '.mapstudio-tool--select[aria-pressed="true"][aria-label="Select"]'),
                    JSON.stringify(await active(page)));
                await page.keyboard.press('Escape');
                rec.add('Select', 'esc', 'Esc with Select in hand changes nothing', await attr(map, 'data-tool', '') && await attr(map, 'data-mode', 'edit'), await tool());
                rec.text('Select', 'drag', 'Shift-drag draws a box and Shift+Alt-drag a lasso: the non-drag way is the list\'s tick boxes and its "Select all" buttons, by Space and Enter.');

                // Every drawing tool: armed by Enter or Space, named in words by the drawing bar, put down by Esc from the button, from the map and by the bar's own button.
                const tools = [
                    ['Kind buttons (Well pad, Gathering line, Geofence)', 'Well pad', '.mapstudio-tool--kind[data-kind="pad"]', 'point', 'Enter'],
                    ['Kind buttons (Well pad, Gathering line, Geofence)', 'Gathering line', '.mapstudio-tool--kind[data-tool="line"]', 'line', 'Space'],
                    ['Kind buttons (Well pad, Gathering line, Geofence)', 'Geofence', '.mapstudio-tool--kind[data-tool="area"]', 'area', 'Enter'],
                    ['Point tool', 'Point', '.mapstudio-tool--point', 'point', 'Space'],
                    ['Line tool', 'Line', '.mapstudio-tool--line', 'line', 'Enter'],
                    ['Area tool', 'Area', '.mapstudio-tool--area', 'area', 'Enter']
                ];
                for (const [surface, name, selector, kind, key] of tools) {
                    if (!await reach(page, rec, surface, name, selector)) {
                        continue;
                    }
                    await page.keyboard.press(key);
                    const armed = rec.add(surface, 'operate', key + ' on ' + name + ' takes the tool in hand', await attr(map, 'data-tool', kind), await tool());
                    if (!armed) {
                        continue;
                    }
                    const title = (await bar.locator('.mapstudio-drawing-title').textContent().catch(() => '')) || '';
                    rec.add(surface, 'mode', name + ' in hand is named in words: the button pressed (aria-pressed) and the drawing bar "' + title + '"',
                        await focusIs(page, selector + '[aria-pressed="true"]') && /^New /.test(title), 'bar title "' + title + '"');
                    // Esc where the focus is after arming: on the tool's own button.
                    await page.keyboard.press('Escape');
                    const fromButton = rec.add(surface, 'esc', 'Esc returns to Select with the focus on the ' + name + ' button (where arming leaves it)', await holds(() =>
                        expect(map).toHaveAttribute('data-tool', '', { timeout: NOTHING_MS * 3 })), 'the tool in hand stayed ' + await tool());
                    if (fromButton) {
                        await tabTo(page, selector);
                        await page.keyboard.press(key);
                        await expect(map).toHaveAttribute('data-tool', kind);
                    }
                    // Esc with the focus on the map.
                    await tabTo(page, '.maplibregl-canvas', { back: true });
                    await page.keyboard.press('Escape');
                    const fromMap = rec.add(surface, 'esc', 'Esc returns to Select with the focus on the map', await attr(map, 'data-tool', ''), 'the tool in hand stayed ' + await tool());
                    if (fromMap) {
                        await tabTo(page, selector);
                        await page.keyboard.press(key);
                        await expect(map).toHaveAttribute('data-tool', kind);
                    }
                    // The drawing bar's own button (Done for a point, Cancel for a line or an area), by Tab and Enter.
                    const barButton = kind === 'point' ? '.mapstudio-drawing-done' : '.mapstudio-drawing-cancel';
                    if (await reach(page, rec, surface, 'the drawing bar\'s ' + (kind === 'point' ? 'Done' : 'Cancel'), barButton)) {
                        await page.keyboard.press('Enter');
                        rec.add(surface, 'operate', 'Enter on the drawing bar\'s ' + (kind === 'point' ? 'Done' : 'Cancel') + ' puts the tool down', await attr(map, 'data-tool', ''), await tool());
                    }
                    await putDown();
                }
                await readTargets(page, rec, 'Kind buttons (Well pad, Gathering line, Geofence)', '.mapstudio-tool--kind');
                // Select by Enter puts a tool down.
                await tabTo(page, '.mapstudio-tool--line');
                await page.keyboard.press('Enter');
                await expect(map).toHaveAttribute('data-tool', 'line');
                await tabTo(page, '.mapstudio-tool--select', { back: true });
                await page.keyboard.press('Enter');
                rec.add('Select', 'operate', 'Enter on Select puts the tool in hand down', await attr(map, 'data-tool', ''), await tool());

                // K4, made by keys alone: with each generic tool in hand and the focus on the map, no key places a point.
                const before = Object.keys(await storedAll(page)).length;
                for (const [surface, name, selector, kind] of tools.slice(3)) {
                    await tabTo(page, selector);
                    await page.keyboard.press('Enter');
                    await expect(map).toHaveAttribute('data-tool', kind);
                    await tabTo(page, '.maplibregl-canvas', { back: true });
                    for (const key of ['Enter', 'Space']) {
                        await page.keyboard.press(key);
                    }
                    await page.waitForTimeout(NOTHING_MS);
                    const points = kind === 'point' ? Object.keys(await storedAll(page)).length - before : Number(await bar.getAttribute('data-points'));
                    rec.add(surface, 'operate', kind === 'point' ? 'a point is made by keys alone (K4)' : 'a point of ' + (kind === 'line' ? 'a line' : 'an area') + ' is placed by keys alone (K4)',
                        points > 0, 'Enter and Space on the map with the ' + name + ' tool in hand placed nothing: ' + (kind === 'point' ? 'no item was saved' : 'the bar still counts 0 points')
                        + '; a click on the map is the only way');
                    await page.keyboard.press('Escape');
                    await expect(map).toHaveAttribute('data-tool', '');
                }
                rec.text('Point tool', 'drag', 'Placing is a click, not a drag, and no key does it. Moving: the drag of the pin, or Latitude and Longitude typed in Details (by keys), or Move then a click.');
                rec.text('Line tool', 'drag', 'Drawing is a click per point, not a drag, and no key does it. Reshaping: the drag of a handle, or a click on the handle, then Move and a click on the new place.');
                rec.text('Area tool', 'drag', 'As the Line tool: clicks to draw; a handle dragged, or clicked and moved with Move and a click.');
                rec.text('Kind buttons (Well pad, Gathering line, Geofence)', 'drag', 'As the Point, Line and Area tools they arm.');

                // K4, moved by keys alone: a pad's Latitude typed in Details; then Move from Details, put down by Esc.
                const pad = seedIds['shared/a'];
                const was = (await stored(page, pad)).geometry.coordinates;
                rec.add('Point tool', 'operate', 'a pad is chosen in the list by keys and its Details open', await chooseRow(page, map, 'Shared A', pad), await map.getAttribute('data-selected'));
                await reach(page, rec, 'Point tool', 'Latitude in Details', '.mapstudio-panel .mapstudio-field-lat');
                const north = Number((was[1] + 0.0005).toFixed(6));
                await retype(page, String(north));
                await page.keyboard.press('Enter');
                const moved = rec.add('Point tool', 'operate', 'a point is moved by keys alone: Latitude typed, Enter (K4)', await holds(() => expect.poll(async () =>
                    (await stored(page, pad)).geometry.coordinates[1], { timeout: SEEN_MS }).toBe(north)), 'the stored latitude stayed ' + (await stored(page, pad)).geometry.coordinates[1]);
                if (await reach(page, rec, 'Point tool', 'Move in Details', '.mapstudio-panel .mapstudio-field-move', { back: true })) {
                    await page.keyboard.press('Enter');
                    const geometry = page.locator('.mapstudio-geometry-bar');
                    const moving = await attr(map, 'data-moving', 'item');
                    const words = moving ? await geometry.locator('.mapstudio-geometry-title').textContent() + ' - ' + await geometry.locator('.mapstudio-geometry-hint').textContent() : '';
                    rec.add('Point tool', 'mode', 'Move from Details is named in words by the bar: "' + words + '"', moving && /^Moving /.test(words), 'data-moving ' + await map.getAttribute('data-moving'));
                    // The keys tried while Move waits, the focus on the map: the arrows, Enter and Space. The pad's stored place says whether one gave it a new place.
                    const before = JSON.stringify((await stored(page, pad)).geometry.coordinates);
                    await tabTo(page, '.maplibregl-canvas');
                    for (const key of ['ArrowRight', 'ArrowUp', 'Enter', 'Space']) {
                        await page.keyboard.press(key);
                    }
                    await page.waitForTimeout(NOTHING_MS * 2);
                    const after = JSON.stringify((await stored(page, pad)).geometry.coordinates);
                    const still = await map.getAttribute('data-moving');
                    rec.add('Point tool', 'operate', 'the new place of Move is given by keys alone', after !== before, 'ArrowRight, ArrowUp, Enter and Space on the map left the pad at ' + after
                        + ' and Move ' + (still === 'item' ? 'still waiting ("' + words + '")' : 'put down (data-moving "' + still + '")') + '; the typed Latitude and Longitude are the way by keys');
                    if ((await map.getAttribute('data-moving')) !== 'item') {
                        await tabTo(page, '.mapstudio-panel .mapstudio-field-move');
                        await page.keyboard.press('Enter');
                        await expect(map).toHaveAttribute('data-moving', 'item');
                        await tabTo(page, '.maplibregl-canvas');
                    }
                    await page.keyboard.press('Escape');
                    rec.add('Point tool', 'esc', 'Esc puts Move down, Details kept open', await attr(map, 'data-moving', '') && await attr(map, 'data-selected', pad),
                        'data-moving ' + await map.getAttribute('data-moving') + ', selected ' + await map.getAttribute('data-selected'));
                }

                // Undo, Redo and the undo list, with the one step the typed latitude made.
                const lat = async () => (await stored(page, pad)).geometry.coordinates[1];
                const latIs = (value) => holds(() => expect.poll(lat, { timeout: SEEN_MS }).toBe(value));
                const U = 'Undo, Redo and the undo list';
                if (moved) {
                    if (await reach(page, rec, U, 'the undo list\'s button', '.mapstudio-undo-history-button')) {
                        await page.keyboard.press('Enter');
                        const group = page.locator('.mapstudio-undo-group');
                        rec.add(U, 'operate', 'Enter opens the undo list', await holds(() => expect(group).toHaveAttribute('data-history-open', 'true', { timeout: SEEN_MS })), 'the list stayed shut');
                        await page.keyboard.press('ArrowDown');
                        const row = await active(page);
                        rec.add(U, 'operate', 'ArrowDown moves into the list, onto its newest step ("' + (row ? row.name : '') + '")', await focusIs(page, '.mapstudio-undo-history-row'), JSON.stringify(row));
                        rec.add(U, 'ring', 'a row of the undo list shows a focus ring', !!(row && row.ring), 'no outline on the focused row');
                        await readTargets(page, rec, U, '.mapstudio-undo-group');
                        await page.keyboard.press('Escape');
                        rec.add(U, 'esc', 'Esc closes the undo list, the focus back on its button, Select kept in hand', await holds(() => expect(group).toHaveAttribute('data-history-open', 'false', { timeout: SEEN_MS }))
                            && await focusIs(page, '.mapstudio-undo-history-button') && await attr(map, 'data-tool', ''), JSON.stringify(await active(page)));
                    }
                    if (await reach(page, rec, U, 'Undo', '.mapstudio-undo', { back: true })) {
                        const named = await active(page);
                        rec.add(U, 'mode', 'Undo names its step in words ("' + named.name + '")', /^Undo: /.test(named.name), named.name);
                        await page.keyboard.press('Enter');
                        rec.add(U, 'operate', 'Enter on Undo puts the pad back', await latIs(was[1]), 'the stored latitude is ' + await lat());
                        const after = await active(page);
                        rec.add(U, 'operate', 'the focus is kept after the last step is undone (Undo is then off)', !!after, 'the focus fell to the page\'s body: the next Tab starts from the top of the page');
                    }
                    if (await reach(page, rec, U, 'Redo', '.mapstudio-redo')) {
                        await page.keyboard.press('Space');
                        rec.add(U, 'operate', 'Space on Redo moves the pad again', await latIs(north), 'the stored latitude is ' + await lat());
                    }
                    await tabTo(page, '.maplibregl-canvas');
                    await page.keyboard.press('Control+z');
                    rec.add(U, 'operate', 'Ctrl+Z on the map undoes', await latIs(was[1]), 'the stored latitude is ' + await lat());
                    await page.keyboard.press('Control+Shift+z');
                    rec.add(U, 'operate', 'Ctrl+Shift+Z on the map redoes', await latIs(north), 'the stored latitude is ' + await lat());
                    await tabTo(page, '.mapstudio-undo-history-button');
                    await page.keyboard.press('ArrowDown');
                    await page.keyboard.press('Enter');
                    rec.add(U, 'operate', 'ArrowDown on the list\'s button opens it on its newest step, and Enter on the step undoes it', await latIs(was[1]), 'the stored latitude is ' + await lat());
                }
                rec.text(U, 'drag', 'No drag.');
                // What the pass changed is put back: the pad where the seed has it.
                expect((await stored(page, pad)).geometry.coordinates, 'the pad is back where it was').toEqual(was);

                // K4, reshaped by keys alone: a line and an area chosen in the list show no point that a key can choose.
                for (const [surface, name, id] of [['Line tool', 'L-SWD', seedIds['swd/line']], ['Area tool', 'North', seedIds['areas/north']]]) {
                    const chosen = await chooseRow(page, map, name, id);
                    rec.add(surface, 'operate', (surface === 'Line tool' ? 'a line' : 'an area') + ' is chosen in the list by keys and its Details open', chosen, await map.getAttribute('data-selected'));
                    await tabTo(page, '.maplibregl-canvas');
                    for (const key of ['Enter', 'Space', 'Tab']) {
                        await page.keyboard.press(key);
                    }
                    await page.waitForTimeout(NOTHING_MS);
                    const picked = (await map.getAttribute('data-chosen-point')) !== '' || (await page.locator('.mapstudio-geometry-bar').count()) > 0;
                    rec.add(surface, 'operate', (surface === 'Line tool' ? 'a line' : 'an area') + ' is reshaped by keys alone (K4)', picked,
                        'no key chooses one of its points (Enter, Space and Tab on the map chose none), so Move, Split here and Delete point, which need a chosen point, are not reached;'
                        + ' Details says only "' + ((await page.locator('.mapstudio-panel .mapstudio-field--location .mapstudio-field-text').first().textContent().catch(() => '')) || '') + '"');
                }

                // The three instrument tools, from L-SWD's Details: the kind by keys, the place by a typed distance, moved by a typed distance.
                const I = 'Instrument tools (Tap, Line valve, Meter)';
                const line = seedIds['swd/line'];
                const onLine = async () => Object.values(await storedAll(page)).filter((i) => i.attachment && i.attachment.lineId === line);
                const seeded = (await onLine()).length;
                await chooseRow(page, map, 'L-SWD', line);
                const add = '.mapstudio-panel .mapstudio-field-add-instrument';
                const names = [];
                if (await reach(page, rec, I, 'Add an instrument in the line\'s Details', add)) {
                    await page.keyboard.press('Enter');
                    const menu = page.locator('.mapstudio-instrument-kinds');
                    rec.add(I, 'operate', 'Enter on Add an instrument opens the list of kinds with the focus on its first', await holds(() => expect(menu).toBeVisible({ timeout: SEEN_MS }))
                        && await focusIs(page, '.mapstudio-instrument-kind'), JSON.stringify(await active(page)));
                    const count = await menu.locator('.mapstudio-instrument-kind').count();
                    let rings = true;
                    for (let i = 0; i < count; i++) {
                        const now = await active(page);
                        names.push(now ? now.name : '');
                        rings = rings && !!(now && now.ring);
                        if (i < count - 1) await page.keyboard.press('Tab');
                    }
                    rec.add(I, 'reach', 'each kind of the list takes the focus by Tab (' + names.join(', ') + ')', names.join(', ') === 'Tap, Line valve, Meter', names.join(', '));
                    rec.add(I, 'ring', 'each kind of the list shows a focus ring', rings, 'no outline on a focused kind');
                    await readTargets(page, rec, I, '.mapstudio-field--instruments');
                    await page.keyboard.press('ArrowUp');
                    rec.add(I, 'operate', 'the arrow keys move in the list of kinds, which has role "' + await menu.getAttribute('role') + '" (K2)',
                        !(await focusIs(page, '.mapstudio-instrument-kind[data-kind]:last-child')), 'ArrowUp left the focus on ' + names[count - 1] + ': each kind is a Tab stop and takes no arrow key');
                    await page.keyboard.press('Escape');
                    rec.add(I, 'esc', 'Esc closes the list of kinds, the focus back on Add an instrument, Details kept open', await holds(() => expect(menu).toHaveCount(0, { timeout: SEEN_MS }))
                        && await focusIs(page, add) && await attr(map, 'data-selected', line), JSON.stringify(await active(page)));
                    // Each kind armed in turn; the first placed and moved by typed distances, the others put down by Esc.
                    for (let i = 0; i < count; i++) {
                        await tabTo(page, add);
                        await page.keyboard.press('Enter');
                        for (let n = 0; n < i; n++) await page.keyboard.press('Tab');
                        await page.keyboard.press(i === 1 ? 'Space' : 'Enter');
                        const place = page.locator('.mapstudio-drawing-bar--instrument');
                        const armed = await holds(() => expect(place).toBeVisible({ timeout: SEEN_MS }));
                        const words = armed ? await place.locator('.mapstudio-drawing-title').textContent() : '';
                        rec.add(I, 'operate', (i === 1 ? 'Space' : 'Enter') + ' on ' + names[i] + ' takes it in hand, the focus in the distance field', armed && await focusIs(page, '.mapstudio-instrument-distance'),
                            JSON.stringify(await active(page)));
                        rec.add(I, 'mode', names[i] + ' in hand is named in words: "' + words + '"', new RegExp('^New ' + names[i].toLowerCase() + ' on L-SWD').test(words), words);
                        if (i === 0) {
                            await page.keyboard.type('1500');
                            await page.keyboard.press('Enter');
                            const placed = rec.add(I, 'operate', 'a tap is placed by keys alone: its distance typed, Enter (K4)', await holds(() => expect.poll(async () => (await onLine()).length,
                                { timeout: SEEN_MS }).toBe(seeded + 1)), 'the line has ' + (await onLine()).length + ' instruments');
                            if (placed && await reach(page, rec, I, 'Distance along the line in the tap\'s Details', '.mapstudio-panel .mapstudio-field-distance')) {
                                await retype(page, '1600');
                                await page.keyboard.press('Enter');
                                rec.add(I, 'operate', 'the tap is moved by keys alone: its distance typed, Enter (K4)', await holds(() => expect.poll(async () =>
                                    (await onLine()).some((t) => Math.round(t.attachment.distanceM) === 1600), { timeout: SEEN_MS }).toBe(true)), JSON.stringify((await onLine()).map((t) => t.attachment.distanceM)));
                            }
                            // The tap is taken off again: Ctrl+Z twice (the move, then the placing).
                            await tabTo(page, '.maplibregl-canvas');
                            // The count is read before each press: once it is back at the seed's no further step is undone.
                            const state = async () => JSON.stringify((await onLine()).map((t) => [t.id, t.attachment.distanceM]).sort());
                            for (let n = 0; n < 2 && (await onLine()).length !== seeded; n++) {
                                const held = await state();
                                await page.keyboard.press('Control+z');
                                await expect.poll(state, { timeout: REPLY_MS }).not.toBe(held);
                            }
                            await expect.poll(async () => (await onLine()).length, { timeout: REPLY_MS }).toBe(seeded);
                            await chooseRow(page, map, 'L-SWD', line);
                        } else {
                            await page.keyboard.press('Escape');
                            rec.add(I, 'esc', 'Esc in the distance field puts ' + names[i] + ' down, Details kept open', await holds(() => expect(place).toHaveCount(0, { timeout: SEEN_MS }))
                                && await attr(map, 'data-selected', line), 'the bar stayed, or the line\'s Details closed');
                        }
                    }
                }
                rec.text(I, 'drag', 'An instrument is dragged along its line: the non-drag way is its distance typed, when placed (the drawing bar\'s field) and after (Details), both by keys.');

                // Snap: Enter and Space switch it, the button saying on or off.
                if (await reach(page, rec, 'Snap', 'Snap', '.mapstudio-tool--snap')) {
                    await page.keyboard.press('Enter');
                    rec.add('Snap', 'operate', 'Enter switches Snap on', await attr(map, 'data-snap', 'on'), await map.getAttribute('data-snap'));
                    const on = await page.locator('.mapstudio-tool--snap').getAttribute('title');
                    rec.add('Snap', 'mode', 'Snap says it is on in words (aria-pressed true, "' + on + '")', await focusIs(page, '.mapstudio-tool--snap[aria-pressed="true"]') && /on/i.test(on || ''), on);
                    await page.keyboard.press('Escape');
                    rec.add('Snap', 'esc', 'Esc on Snap keeps Select in hand and Snap as it is (it closes the open Details, the focus going to the map)',
                        await attr(map, 'data-tool', '') && await attr(map, 'data-snap', 'on') && await attr(map, 'data-selected', ''), await tool() + ', snap ' + await map.getAttribute('data-snap'));
                    await tabTo(page, '.mapstudio-tool--snap');
                    await page.keyboard.press('Space');
                    rec.add('Snap', 'operate', 'Space switches Snap off', await attr(map, 'data-snap', 'off'), await map.getAttribute('data-snap'));
                }
                rec.text('Snap', 'drag', 'No drag.');
                } finally {
                    // What the pass changed is put back, whatever stopped it: the pad where the seed has it, no instrument on L-SWD but the seed's.
                    const now = await storedAll(page);
                    const seeds = new Set(Object.values(seedIds));
                    const ops = Object.values(now).filter((i) => i.attachment && i.attachment.lineId === seedIds['swd/line'] && !seeds.has(i.id))
                        .map((i) => ({ op: 'delete', entity: 'item', id: i.id, baseVersion: i.version }));
                    if (now[moves] && JSON.stringify(now[moves].geometry.coordinates) !== JSON.stringify(seededAt)) {
                        ops.push({ op: 'update', entity: 'item', id: moves, baseVersion: now[moves].version, data: { geometry: { type: 'Point', coordinates: seededAt } } });
                    }
                    if (ops.length) {
                        const back = await send(page, 'edits.apply', { batchId: randomUUID(), ops });
                        expect(back.type, JSON.stringify(back.body)).toBe('edits.apply.reply');
                    }
                }
                for (const s of ['Select', 'Point tool', 'Line tool', 'Area tool', 'Snap']) {
                    await readTargets(page, rec, s, '.mapstudio-tool--' + (s === 'Select' ? 'select' : s === 'Snap' ? 'snap' : s.split(' ')[0].toLowerCase()));
                }
                close(rec);
            });

        editorTest('the item list and its search, Details and Style', async ({ page }) => {
            editorTest.setTimeout(480_000);
            const rec = recorder('items', width);
            const map = await openStudio(page);
            const L = 'Item list and its search';
            const rows = page.locator('.mapstudio-list-row');
            const ctb1 = seedIds['swd/ctb1'];
            const shape = (i) => ({ name: i.name, properties: i.properties, geometry: i.geometry, style: i.style, overrides: i.overrides });
            const seeded = await stored(page, ctb1);
            try {
            await walk(page, rec, L, '.mapstudio-dock--items');
            const all = await rows.count();
            // The search: typed text narrows the list, Esc empties the field and keeps the focus in it.
            await searchFor(page, 'CTB1');
            rec.add(L, 'operate', 'text typed in the search narrows the list (' + all + ' rows to ' + await rows.count() + ')', await holds(() => expect.poll(() => rows.count(), { timeout: SEEN_MS })
                .toBeLessThan(all)) && (await page.locator('.mapstudio-list-row[data-item-id="' + ctb1 + '"]').count()) === 1, await rows.count() + ' rows');
            await page.keyboard.press('Escape');
            rec.add(L, 'esc', 'Esc in the search empties it, the focus kept in the field, Select kept in hand', await holds(() => expect.poll(() => rows.count(), { timeout: SEEN_MS }).toBe(all))
                && await focusIs(page, '.mapstudio-list-search-input') && await attr(map, 'data-tool', ''), await rows.count() + ' rows, focus ' + JSON.stringify(await active(page)));
            // Sort by: the arrow keys choose.
            if (await reach(page, rec, L, 'Sort by', '.mapstudio-list-sort-select')) {
                const value = () => page.locator('.mapstudio-list-sort-select').inputValue();
                const first = await value();
                await page.keyboard.press('ArrowDown');
                rec.add(L, 'operate', 'ArrowDown in Sort by chooses the next order', await holds(() => expect.poll(value, { timeout: SEEN_MS }).not.toBe(first)), await value());
                await page.keyboard.press('ArrowUp');
                await expect.poll(value).toBe(first);
            }
            // Filter: Enter opens the kinds, Space ticks one, the same keys put it back.
            if (await reach(page, rec, L, 'Filter', '.mapstudio-list-filter')) {
                const chips = page.locator('.mapstudio-list-chips');
                await page.keyboard.press('Enter');
                const open = rec.add(L, 'operate', 'Enter on Filter opens the kinds to filter by', await holds(() => expect(chips).toBeVisible({ timeout: SEEN_MS })), 'no chips');
                if (open) {
                    if (await reach(page, rec, L, 'a kind of the filter', '.mapstudio-kind-chip:not([data-kind=""])')) {
                        await page.keyboard.press('Space');
                        rec.add(L, 'operate', 'Space on a kind filters the list by it', await holds(() => expect.poll(() => rows.count(), { timeout: SEEN_MS }).toBeLessThan(all)), await rows.count() + ' rows');
                        rec.add(L, 'mode', 'the kind filtered by says so (aria-pressed)', (await page.locator('.mapstudio-kind-chip[aria-pressed="true"]:not([data-kind=""])').count()) === 1, 'no chip pressed');
                        await readTargets(page, rec, L, '.mapstudio-list-chips');
                        await tabTo(page, '.mapstudio-kind-chip[data-kind=""]', { back: true });
                        await page.keyboard.press('Enter');
                        await expect.poll(() => rows.count()).toBe(all);
                    }
                    await page.keyboard.press('Escape');
                    await page.waitForTimeout(NOTHING_MS);
                    rec.text(L, 'esc', 'The filter\'s kinds are a disclosure, not a card: ' + (await chips.isVisible() ? 'Esc leaves them open and Filter pressed again closes them.' : 'Esc closes them.'));
                    if (await chips.isVisible()) {
                        await tabTo(page, '.mapstudio-list-filter', { back: true });
                        await page.keyboard.press('Enter');
                        await expect(chips).toBeHidden();
                    }
                }
            }
            // A row by Enter opens its Details; tick boxes by Space make a set; Esc empties it.
            rec.add(L, 'operate', 'Enter on a row selects the item and opens its Details', await chooseRow(page, map, 'CTB1', ctb1), await map.getAttribute('data-selected'));
            rec.add(L, 'mode', 'the selected row says so (aria-current or aria-pressed) and the panel is named after the item', await page.locator('.mapstudio-list-row[data-item-id="' + ctb1 + '"]')
                .evaluate((el) => el.getAttribute('aria-current') !== null || el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-selected') === 'true')
                && (await page.locator('.mapstudio-panel .mapstudio-panel-name').textContent()) === 'CTB1',
                'the row carries no aria-current, aria-pressed or aria-selected: its selection is the tint and the edge alone');
            await tabTo(page, '.maplibregl-canvas');
            await page.keyboard.press('Escape');
            await expect(map).toHaveAttribute('data-selected', '');
            await searchFor(page, 'Shared');
            const several = page.locator('.mapstudio-panel--several');
            if (await reach(page, rec, L, 'a row\'s tick box', '.mapstudio-list-check')) {
                await page.keyboard.press('Space');
                await tabTo(page, '.mapstudio-list-check:not(:checked)');
                await page.keyboard.press('Space');
                const count = (await several.locator('.mapstudio-several-count').textContent().catch(() => '')) || '';
                rec.add(L, 'operate', 'Space on two tick boxes selects both ("' + count + '")', await holds(() => expect(several).toHaveAttribute('data-selected-count', '2', { timeout: SEEN_MS })), count);
                rec.add(L, 'mode', 'the set is named in words: "' + count + '"', count === '2 selected', count);
                if (await reach(page, rec, L, 'Clear of the set', '.mapstudio-several-clear')) {
                    await page.keyboard.press('Escape');
                    rec.add(L, 'esc', 'Esc empties the set and closes its panel', await holds(() => expect(several).toHaveCount(0, { timeout: SEEN_MS })) && await attr(map, 'data-selected', ''),
                        'selected ' + await map.getAttribute('data-selected'));
                }
            }
            if (await reach(page, rec, L, 'Select all of a group', '.mapstudio-list-select-all')) {
                await page.keyboard.press('Enter');
                rec.add(L, 'operate', 'Enter on Select all selects the group', await holds(() => expect(several).toHaveCount(1, { timeout: SEEN_MS })), 'no set');
                await readTargets(page, rec, L, '.mapstudio-panel--several');
                await tabTo(page, '.mapstudio-several-clear');
                await page.keyboard.press('Enter');
                rec.add(L, 'operate', 'Enter on Clear empties the set', await holds(() => expect(several).toHaveCount(0, { timeout: SEEN_MS })), 'the set stayed');
            }
            await searchFor(page, '');
            await page.keyboard.press('Escape');
            if (await reach(page, rec, L, 'the unlinked filter', '.mapstudio-list-unlinked')) {
                await page.keyboard.press('Enter');
                rec.add(L, 'operate', 'Enter on the unlinked count lists the unlinked items only', await holds(() => expect.poll(() => rows.count(), { timeout: SEEN_MS }).toBeLessThan(all)), await rows.count() + ' rows');
                await page.keyboard.press('Space');
                await expect.poll(() => rows.count()).toBe(all);
            }
            if (await reach(page, rec, L, 'Add item', '.mapstudio-list-add', { back: true })) {
                await page.keyboard.press('Enter');
                rec.add(L, 'operate', 'Enter on Add item takes the Point tool in hand', await attr(map, 'data-tool', 'point'), await map.getAttribute('data-tool'));
                await page.keyboard.press('Escape');
                rec.add(L, 'esc', 'Esc returns to Select with the focus on Add item (where arming leaves it)', await holds(() => expect(map).toHaveAttribute('data-tool', '', { timeout: NOTHING_MS * 3 })),
                    'the tool in hand stayed ' + await map.getAttribute('data-tool'));
                if ((await map.getAttribute('data-tool')) !== '') {
                    await tabTo(page, '.maplibregl-canvas');
                    await page.keyboard.press('Escape');
                    await expect(map).toHaveAttribute('data-tool', '');
                }
            }
            if (await reach(page, rec, L, 'the save status', '.mapstudio-panel-save-button', { back: true })) {
                await page.keyboard.press('Enter');
                rec.add(L, 'operate', 'Enter on the save status opens Recent changes', await attr(map, 'data-surface', 'history'), await map.getAttribute('data-surface'));
                await tabTo(page, '.mapstudio-rail-item[data-surface="items"]', { back: true });
                await page.keyboard.press('Enter');
                await expect(map).toHaveAttribute('data-surface', 'items');
            }
            rec.text(L, 'drag', 'No drag in the list. The map\'s box and lasso (Shift-drag, Shift+Alt-drag) have the tick boxes and "Select all" as their way without a drag, by keys.');

            // Details, on CTB1 (linked, so the Live now block and its Override buttons show).
            const D = 'Details';
            await chooseRow(page, map, 'CTB1', ctb1);
            const record = await stored(page, ctb1);
            await walk(page, rec, D, '.mapstudio-panel');
            const tab = (name) => '.mapstudio-panel .mapstudio-panel-tab[data-tab="' + name + '"]';
            if (await reach(page, rec, D, 'the Details tab', tab('details'))) {
                await page.keyboard.press('ArrowRight');
                rec.add(D, 'operate', 'ArrowRight on the Details tab chooses Style, the focus with it', await focusIs(page, tab('style') + '[aria-selected="true"]'), JSON.stringify(await active(page)));
                await page.keyboard.press('ArrowLeft');
                rec.add(D, 'operate', 'ArrowLeft chooses Details again', await focusIs(page, tab('details') + '[aria-selected="true"]'), JSON.stringify(await active(page)));
                await page.keyboard.press('End');
                await page.keyboard.press('Home');
                rec.add(D, 'operate', 'End and Home go to the last and the first tab', await focusIs(page, tab('details') + '[aria-selected="true"]'), JSON.stringify(await active(page)));
                const header = (await page.locator('.mapstudio-panel .mapstudio-panel-header').innerText()).replace(/\s+/g, ' ');
                rec.add(D, 'mode', 'the open tab says so (aria-selected) and the panel is named after the item and its kind', (await page.locator(tab('details')).getAttribute('aria-selected')) === 'true'
                    && (await page.locator(tab('style')).getAttribute('aria-selected')) === 'false' && (await page.locator('.mapstudio-panel .mapstudio-panel-name').textContent()) === 'CTB1'
                    && /Well pad/.test(header), 'aria-selected ' + await page.locator(tab('details')).getAttribute('aria-selected') + ', the header reads "' + header + '"');
            }
            const name = async () => (await stored(page, ctb1)).name;
            if (await reach(page, rec, D, 'Name', '.mapstudio-panel .mapstudio-field-name')) {
                await retype(page, 'CTB1 by keys');
                await page.keyboard.press('Enter');
                rec.add(D, 'operate', 'a name typed and Enter saves it', await holds(() => expect.poll(name, { timeout: SEEN_MS }).toBe('CTB1 by keys')), await name());
                await tabTo(page, '.mapstudio-panel .mapstudio-field-name');
                await retype(page, 'CTB1');
                await page.keyboard.press('Enter');
                await expect.poll(name, { timeout: REPLY_MS }).toBe('CTB1');
                // K3: Esc with a field focused, after typing in it.
                await tabTo(page, '.mapstudio-panel .mapstudio-field-name');
                await page.keyboard.press('End');
                await page.keyboard.type('Z');
                await page.keyboard.press('Escape');
                await page.waitForTimeout(NOTHING_MS * 2);
                const after = await name();
                rec.add(D, 'esc', 'Esc in a field after typing puts the record\'s value back and saves nothing', after === 'CTB1' && (await page.locator('.mapstudio-panel .mapstudio-field-name').inputValue()) === 'CTB1',
                    'the store saved "' + after + '" and the field reads "' + await page.locator('.mapstudio-panel .mapstudio-field-name').inputValue() + '"');
                rec.add(D, 'esc', 'Esc in a field keeps Details open (the field\'s own Esc)', await attr(map, 'data-selected', ctb1), 'selected ' + await map.getAttribute('data-selected'));
                if (after !== 'CTB1') {
                    await tabTo(page, '.mapstudio-panel .mapstudio-field-name');
                    await retype(page, 'CTB1');
                    await page.keyboard.press('Enter');
                    await expect.poll(name, { timeout: REPLY_MS }).toBe('CTB1');
                }
            }
            if (await reach(page, rec, D, 'Zoom to location', '.mapstudio-panel .mapstudio-field-zoom')) {
                const zoom = await map.getAttribute('data-zoom');
                await page.keyboard.press('Enter');
                rec.add(D, 'operate', 'Enter on Zoom to location moves the map', await holds(() => expect(map).not.toHaveAttribute('data-zoom', zoom, { timeout: SEEN_MS })), 'zoom ' + await map.getAttribute('data-zoom'));
            }
            if (await reach(page, rec, D, 'a field\'s select (Status)', '.mapstudio-panel .mapstudio-field--choice select')) {
                const value = () => page.locator('.mapstudio-panel .mapstudio-field--choice select').first().inputValue();
                const first = await value();
                await page.keyboard.press('ArrowDown');
                rec.add(D, 'operate', 'ArrowDown in a field\'s select chooses and saves', await holds(() => expect.poll(async () => JSON.stringify((await stored(page, ctb1)).properties), { timeout: SEEN_MS })
                    .not.toBe(JSON.stringify(record.properties))), await value());
                await page.keyboard.press('ArrowUp');
                await expect.poll(value).toBe(first);
                await expect.poll(async () => JSON.stringify((await stored(page, ctb1)).properties), { timeout: REPLY_MS }).toBe(JSON.stringify(record.properties));
            }
            await reach(page, rec, D, 'Override of a Live now path', '.mapstudio-panel .mapstudio-override-edit');
            await reach(page, rec, D, 'Delete', '.mapstudio-panel .mapstudio-panel-delete');
            rec.text(D, 'operate', 'Delete (the footer\'s button and the Delete key) is delete.spec.mjs\'s; it was reached here and not pressed.');
            if (await reach(page, rec, D, 'Close', '.mapstudio-panel .mapstudio-panel-close', { back: true })) {
                await page.keyboard.press('Enter');
                rec.add(D, 'operate', 'Enter on Close closes Details', await attr(map, 'data-selected', ''), await map.getAttribute('data-selected'));
                const now = await active(page);
                rec.add(D, 'operate', 'the focus is kept when Details closes', !!now, 'the focus fell to the page\'s body: the next Tab starts from the top of the page');
            }
            await chooseRow(page, map, 'CTB1', ctb1);
            await tabTo(page, tab('details'));
            await page.keyboard.press('Escape');
            rec.add(D, 'esc', 'Esc outside a field closes Details, the focus going to the map', await attr(map, 'data-selected', '') && await focusIs(page, '.maplibregl-canvas'), JSON.stringify(await active(page)));
            rec.text(D, 'drag', 'The pin is dragged on the map: Latitude and Longitude typed here are the way by keys (the Point tool\'s row); Move then a click is the way without a drag.');

            // Style: the tab, Override by Enter, the rule's tag button opening the tag browser, Reset.
            const S = 'Style';
            await chooseRow(page, map, 'CTB1', ctb1);
            await tabTo(page, tab('details'));
            await page.keyboard.press('ArrowRight');
            await expect(page.locator(tab('style'))).toHaveAttribute('aria-selected', 'true');
            await walk(page, rec, S, '.mapstudio-panel', { from: '.mapstudio-list-add' });
            rec.add(S, 'mode', 'the Style tab says it is the open one (aria-selected true)', (await page.locator(tab('style')).getAttribute('aria-selected')) === 'true', 'aria-selected not true');
            if (await reach(page, rec, S, 'Override', '.mapstudio-panel .mapstudio-style-override', { back: true })) {
                await page.keyboard.press('Enter');
                const rule = page.locator('.mapstudio-panel .mapstudio-rule');
                const own = rec.add(S, 'operate', 'Enter on Override opens the item\'s own rule, the focus on its chosen type', await holds(() => expect(rule).toBeVisible({ timeout: SEEN_MS }))
                    && await focusIs(page, '.mapstudio-panel .mapstudio-rule-type'), JSON.stringify(await active(page)));
                if (own) {
                    await walk(page, rec, S, '.mapstudio-panel', { from: '.mapstudio-list-add' });
                    if (await reach(page, rec, S, 'the rule\'s tag button', '.mapstudio-panel .mapstudio-tag-button', { back: true })) {
                        await page.keyboard.press('Enter');
                        const card = page.locator('.mapstudio-tagbrowser');
                        rec.add(S, 'operate', 'Enter on the tag button opens the tag browser, the focus in its tree', await holds(() => expect(card).toBeVisible({ timeout: SEEN_MS }))
                            && await holds(() => expect.poll(() => focusIs(page, '.mapstudio-tagbrowser *'), { timeout: SEEN_MS }).toBe(true)), JSON.stringify(await active(page)));
                        await page.keyboard.press('Escape');
                        rec.add(S, 'esc', 'Esc closes the tag browser, the focus back on the tag button', await holds(() => expect(card).toHaveCount(0, { timeout: SEEN_MS }))
                            && await focusIs(page, '.mapstudio-panel .mapstudio-tag-button'), JSON.stringify(await active(page)));
                    }
                    if (await reach(page, rec, S, 'Reset', '.mapstudio-panel .mapstudio-style-reset')) {
                        await page.keyboard.press('Enter');
                        rec.add(S, 'operate', 'Enter on Reset puts the kind\'s rule back', await holds(() => expect(page.locator('.mapstudio-panel .mapstudio-style-override')).toBeVisible({ timeout: SEEN_MS })),
                            'Override did not come back');
                    }
                }
            }
            await tabTo(page, '.maplibregl-canvas');
            await page.keyboard.press('Escape');
            rec.add(S, 'esc', 'Esc on the map closes the panel', await attr(map, 'data-selected', ''), await map.getAttribute('data-selected'));
            rec.text(S, 'drag', 'No drag.');
            // What the pass changed is put back: CTB1 as the seed has it, once Reset's save has landed.
            await expect.poll(async () => shape(await stored(page, ctb1)), { timeout: REPLY_MS, message: 'CTB1 is as it was' }).toEqual(shape(seeded));
            } finally {
                // And whatever stopped the pass: CTB1's name, fields and overrides as they were.
                const now = await stored(page, ctb1);
                if (now && JSON.stringify(shape(now)) !== JSON.stringify(shape(seeded))) {
                    const back = await send(page, 'edits.apply', { batchId: randomUUID(), ops: [{ op: 'update', entity: 'item', id: ctb1, baseVersion: now.version,
                        data: { name: seeded.name, properties: seeded.properties, overrides: seeded.overrides } }] });
                    expect(back.type, JSON.stringify(back.body)).toBe('edits.apply.reply');
                }
            }
            close(rec);
        });

        editorTest('the Kinds list, a kind\'s setup with the rule editor, and the tag browser', async ({ page }) => {
            editorTest.setTimeout(480_000);
            const rec = recorder('kinds', width);
            const map = await openStudio(page);
            const strip = (o) => JSON.stringify(o, (k, v) => (/^(version|seq|changedAt|changedBy|updatedAt|at|by)$/.test(k) ? undefined : v));
            const setup = async () => {
                const reply = await send(page, 'map.load', {});
                return (reply.body.kindSetups || []).find((k) => k.kindId === 'pad' && !k.deleted);
            };
            const seeded = await setup();
            const was = strip(seeded);
            try {
            await tabTo(page, '.mapstudio-rail-item[data-surface="kinds"]');
            await page.keyboard.press('Enter');
            await expect(map).toHaveAttribute('data-surface', 'kinds');

            // The Kinds list.
            const K = 'Kinds list';
            await walk(page, rec, K, '.mapstudio-dock--kinds');
            const row = (kind) => '.mapstudio-kind-row[data-kind="' + kind + '"]';
            const panel = page.locator('.mapstudio-kindsetup');
            if (await reach(page, rec, K, 'a kind\'s row', row('line'))) {
                await page.keyboard.press('Enter');
                rec.add(K, 'operate', 'Enter on a kind opens its setup', await holds(() => expect(page.locator(row('line'))).toHaveAttribute('aria-current', 'true', { timeout: SEEN_MS })), 'not chosen');
                const title = (await panel.locator('h2, .mapstudio-panel-name').first().textContent().catch(() => '')) || '';
                rec.add(K, 'mode', 'the chosen kind says so (aria-current) and its setup is named after it ("' + title + '")', (await page.locator(row('line')).getAttribute('aria-current')) === 'true'
                    && (await page.locator('.mapstudio-kind-row[aria-current="true"]').count()) === 1 && /Gathering line/.test(title),
                    'aria-current ' + await page.locator(row('line')).getAttribute('aria-current') + ', the setup\'s title "' + title + '"');
                await tabTo(page, row('pad'), { back: true });
                await page.keyboard.press('Space');
                rec.add(K, 'operate', 'Space on a kind opens its setup', await holds(() => expect(page.locator(row('pad'))).toHaveAttribute('aria-current', 'true', { timeout: SEEN_MS })), 'not chosen');
            }
            await page.keyboard.press('Escape');
            rec.add(K, 'esc', 'Esc on the Kinds list keeps Select in hand and the kind\'s setup open', await attr(map, 'data-tool', '') && await attr(map, 'data-surface', 'kinds') && await panel.isVisible(),
                'surface ' + await map.getAttribute('data-surface'));
            rec.text(K, 'drag', 'No drag.');

            // The kind's setup: every control by Tab, a field saved by Enter and left by Esc, a switch by Space.
            const P = 'Kind setup';
            // The rule editor inside the setup has its own row: its targets are read there.
            await walk(page, rec, P, '.mapstudio-kindsetup', { except: '.mapstudio-rule' });
            const named = (await panel.getAttribute('aria-label')) || (await panel.locator('h2').first().textContent().catch(() => '')) || '';
            rec.add(P, 'mode', 'the setup panel is named after its kind in words (its heading or label: "' + named + '")', /Well pad/.test(named), 'the panel\'s name reads "' + named + '"');
            const unit = '.mapstudio-kindsetup input[aria-label="Unit of Flow"]';
            const unitOf = async () => strip(await setup());
            if (await reach(page, rec, P, 'a text field (Unit of Flow)', unit, { back: true })) {
                const first = await page.locator(unit).inputValue();
                await retype(page, first + 'x');
                await page.keyboard.press('Enter');
                rec.add(P, 'operate', 'text typed in a field and Enter saves it', await holds(() => expect.poll(unitOf, { timeout: SEEN_MS }).not.toBe(was)), 'the stored setup did not change');
                await tabTo(page, unit, { back: true });
                await retype(page, first);
                await page.keyboard.press('Enter');
                await expect.poll(unitOf, { timeout: REPLY_MS }).toBe(was);
                await tabTo(page, unit, { back: true });
                await page.keyboard.type('zz');
                await page.keyboard.press('Escape');
                await page.waitForTimeout(NOTHING_MS * 2);
                rec.add(P, 'esc', 'Esc in a field after typing puts the stored value back and saves nothing, the setup kept open', (await unitOf()) === was && (await page.locator(unit).inputValue()) === first
                    && await panel.isVisible(), 'the field reads "' + await page.locator(unit).inputValue() + '"');
            }
            if (await reach(page, rec, P, 'the preview item\'s select', '.mapstudio-kindsetup-preview-select', { back: true })) {
                const value = () => page.locator('.mapstudio-kindsetup-preview-select').inputValue();
                const first = await value();
                await page.keyboard.press('ArrowDown');
                rec.add(P, 'operate', 'ArrowDown in the preview item\'s select chooses another item', await holds(() => expect.poll(value, { timeout: SEEN_MS }).not.toBe(first)), await value());
                await page.keyboard.press('ArrowUp');
            }
            if (await reach(page, rec, P, 'a switch', '.mapstudio-kindsetup .mapstudio-switch')) {
                const checked = () => page.evaluate(() => document.activeElement.checked);
                const first = await checked();
                await page.keyboard.press('Space');
                rec.add(P, 'operate', 'Space on a switch turns it and saves', (await checked()) !== first && await holds(() => expect.poll(unitOf, { timeout: SEEN_MS }).not.toBe(was)), 'checked ' + await checked());
                await tabTo(page, '.mapstudio-kindsetup .mapstudio-switch', { back: true });
                await page.keyboard.press('Space');
                await expect.poll(unitOf, { timeout: REPLY_MS }).toBe(was);
            }
            if (await reach(page, rec, P, 'Insert a placeholder', '.mapstudio-kindsetup .mapstudio-placeholder-button')) {
                await page.keyboard.press('Enter');
                const menu = page.locator('.mapstudio-placeholder-menu');
                rec.add(P, 'operate', 'Enter on Insert a placeholder opens its list, the focus in it', await holds(() => expect(menu).toBeVisible({ timeout: SEEN_MS }))
                    && await holds(() => expect.poll(() => focusIs(page, '.mapstudio-placeholder-menu *'), { timeout: NOTHING_MS * 3 }).toBe(true)), JSON.stringify(await active(page)));
                await readTargets(page, rec, P, '.mapstudio-placeholder-menu');
                await page.keyboard.press('Escape');
                rec.add(P, 'esc', 'Esc closes the placeholder list, the focus back on its button', await holds(() => expect(menu).toHaveCount(0, { timeout: SEEN_MS }))
                    && await focusIs(page, '.mapstudio-placeholder-button'), JSON.stringify(await active(page)));
            }
            rec.text(P, 'drag', 'No drag.');

            // The rule editor: its controls by Tab, a case added and removed by Enter.
            const R = 'Rule editor';
            await walk(page, rec, R, '.mapstudio-kindsetup .mapstudio-rule', { from: '.mapstudio-kindsetup-preview-select' });
            const cases = page.locator('.mapstudio-kindsetup .mapstudio-rule-case');
            const count = await cases.count();
            const type = await page.locator('.mapstudio-kindsetup .mapstudio-rule-type.mapstudio-panel-tab--active').textContent();
            rec.add(R, 'mode', 'the rule\'s type in force says so to assistive technology (aria-pressed, aria-selected or aria-current on "' + type + '")',
                await page.locator('.mapstudio-kindsetup .mapstudio-rule-type.mapstudio-panel-tab--active').evaluate((el) => ['aria-pressed', 'aria-selected', 'aria-current', 'aria-checked']
                    .some((a) => el.getAttribute(a) === 'true')), 'the type in force is marked by its underline and weight alone');
            if (await reach(page, rec, R, 'Add a case', '.mapstudio-kindsetup .mapstudio-rule-add', { back: true })) {
                await page.keyboard.press('Enter');
                const added = rec.add(R, 'operate', 'Enter on Add a case adds a row, the focus kept in the rule', await holds(() => expect(cases).toHaveCount(count + 1, { timeout: SEEN_MS }))
                    && await focusIs(page, '.mapstudio-rule *'), JSON.stringify(await active(page)));
                if (added && await reach(page, rec, R, 'Remove of the new case', '.mapstudio-kindsetup .mapstudio-rule-remove[aria-label="Remove case ' + (count + 1) + '"]')) {
                    await page.keyboard.press('Enter');
                    rec.add(R, 'operate', 'Enter on Remove takes the row away, the focus kept in the rule', await holds(() => expect(cases).toHaveCount(count, { timeout: SEEN_MS }))
                        && await focusIs(page, '.mapstudio-rule *'), JSON.stringify(await active(page)));
                }
            }
            // From the setup's top forward, so the preset reached is the first case's.
            await tabTo(page, '.mapstudio-kindsetup-preview-select', { back: true });
            if (await reach(page, rec, R, 'a case\'s preset', '.mapstudio-kindsetup .mapstudio-rule-preset')) {
                const value = () => page.evaluate(() => document.activeElement.value);
                const first = await value();
                await page.keyboard.press('ArrowDown');
                rec.add(R, 'operate', 'ArrowDown in a case\'s preset chooses the next look and saves it', await holds(() => expect.poll(value, { timeout: SEEN_MS }).not.toBe(first))
                    && await holds(() => expect.poll(unitOf, { timeout: SEEN_MS }).not.toBe(was)), await value());
                rec.add(R, 'operate', 'the focus stays on the preset after its save', await focusIs(page, '.mapstudio-kindsetup .mapstudio-rule-preset'), JSON.stringify(await active(page)));
                await tabTo(page, '.mapstudio-kindsetup-preview-select', { back: true });
                await tabTo(page, '.mapstudio-kindsetup .mapstudio-rule-preset');
                await page.keyboard.press('ArrowUp');
                await expect.poll(unitOf, { timeout: REPLY_MS }).toBe(was);
            }
            await page.keyboard.press('Escape');
            rec.add(R, 'esc', 'Esc in the rule keeps Select in hand and the setup open', await attr(map, 'data-tool', '') && await panel.isVisible(), 'the setup closed');
            rec.text(R, 'drag', 'No drag.');
            await expect.poll(unitOf, { timeout: REPLY_MS }).toBe(was);

            // The tag browser, from a key value's tag button: the tree by the arrow keys, the rest by Tab, Esc closing it.
            const T = 'Tag browser';
            const button = '.mapstudio-kindsetup .mapstudio-tag-button[aria-label="Pick a tag for Pressure"]';
            const card = page.locator('.mapstudio-tagbrowser');
            const focusedRow = () => page.evaluate(() => (document.activeElement && document.activeElement.getAttribute('data-path')) || '');
            if (await reach(page, rec, T, 'the tag button of a key value', button, { back: true })) {
                await page.keyboard.press('Enter');
                const open = rec.add(T, 'operate', 'Enter on the tag button opens the card, the focus on a row of its tree', await holds(() => expect(card).toBeVisible({ timeout: SEEN_MS }))
                    && await holds(() => expect.poll(() => focusIs(page, '.mapstudio-tagbrowser [role="treeitem"]'), { timeout: SEEN_MS }).toBe(true)), JSON.stringify(await active(page)));
                if (open) {
                    await expect(card.locator('[role="treeitem"][data-path$="Pressure"]')).toBeVisible({ timeout: REPLY_MS });
                    const title = await card.locator('.mapstudio-tagbrowser-title').textContent();
                    const forLine = await card.locator('.mapstudio-tagbrowser-for').textContent();
                    rec.add(T, 'mode', 'the card says what it is for in words: "' + title + '", "' + forLine + '"', title === 'Pick a tag' && /^For: Key value 1 of the Well pad kind/.test(forLine), forLine);
                    const ring = await active(page);
                    rec.add(T, 'ring', 'the focused row of the tree shows a focus ring', !!(ring && ring.ring), 'no outline on the focused row');
                    const start = await focusedRow();
                    await page.keyboard.press('ArrowDown');
                    const down = await focusedRow();
                    rec.add(T, 'operate', 'ArrowDown moves to the next row', down !== start && down !== '', start + ' to ' + down);
                    await page.keyboard.press('ArrowUp');
                    rec.add(T, 'operate', 'ArrowUp moves back', (await focusedRow()) === start, await focusedRow());
                    await page.keyboard.press('End');
                    const end = await focusedRow();
                    await page.keyboard.press('Home');
                    const home = await focusedRow();
                    rec.add(T, 'operate', 'End and Home go to the last and the first row', end !== home && end !== '' && home !== '', home + ' / ' + end);
                    // The asset folder is open: ArrowLeft on it closes it, ArrowRight opens it again.
                    const folder = card.locator('[role="treeitem"][data-asset="true"]');
                    for (let i = 0; i < 40 && !await focusIs(page, '[role="treeitem"][data-asset="true"]'); i++) {
                        await page.keyboard.press('ArrowDown');
                    }
                    await page.keyboard.press('ArrowLeft');
                    const shut = await holds(() => expect(folder).toHaveAttribute('data-open', 'false', { timeout: SEEN_MS }));
                    await page.keyboard.press('ArrowRight');
                    rec.add(T, 'operate', 'ArrowLeft closes a folder and ArrowRight opens it', shut && await holds(() => expect(folder).toHaveAttribute('data-open', 'true', { timeout: SEEN_MS })),
                        'data-open ' + await folder.getAttribute('data-open'));
                    for (let i = 0; i < 40 && !/Pressure$/.test(await focusedRow()); i++) {
                        await page.keyboard.press('ArrowDown');
                    }
                    await page.keyboard.press('Enter');
                    rec.add(T, 'operate', 'Enter on a tag picks it, the Path field showing it', await holds(() => expect(card.locator('[role="treeitem"][data-picked="true"]')).toHaveAttribute('data-path', /Pressure$/,
                        { timeout: SEEN_MS })) && /Pressure$/.test(await card.locator('.mapstudio-tagbrowser-path input').inputValue().catch(() => '')), await focusedRow());
                    await walk(page, rec, T, '.mapstudio-tagbrowser', { from: button });
                    if (await reach(page, rec, T, 'the provider\'s select', '.mapstudio-tagbrowser select', { back: true })) {
                        const provider = () => card.getAttribute('data-provider');
                        const first = await provider();
                        await page.keyboard.press('ArrowDown');
                        rec.add(T, 'operate', 'ArrowDown in Provider shows another provider\'s tags', await holds(() => expect.poll(provider, { timeout: SEEN_MS }).not.toBe(first)), await provider());
                        await page.keyboard.press('ArrowUp');
                        await expect.poll(provider, { timeout: REPLY_MS }).toBe(first);
                    }
                    await page.keyboard.press('Escape');
                    rec.add(T, 'esc', 'Esc closes the card and changes nothing, the focus back on the tag button', await holds(() => expect(card).toHaveCount(0, { timeout: SEEN_MS }))
                        && await focusIs(page, button) && (await unitOf()) === was, JSON.stringify(await active(page)));
                    // Again, closed by Cancel with Enter.
                    await page.keyboard.press('Enter');
                    await expect(card).toBeVisible();
                    if (await reach(page, rec, T, 'Cancel', '.mapstudio-tagbrowser-cancel')) {
                        await page.keyboard.press('Enter');
                        rec.add(T, 'operate', 'Enter on Cancel closes the card, the focus back on the tag button', await holds(() => expect(card).toHaveCount(0, { timeout: SEEN_MS })) && await focusIs(page, button),
                            JSON.stringify(await active(page)));
                    }
                }
            }
            rec.text(T, 'operate', 'A pick saved by keys ("Use this tag" by Enter) is tagbrowser.spec.mjs\'s B7; here the card was closed without a save.');
            rec.text(T, 'drag', 'No drag.');
            } finally {
                // What the pass changed is put back, whatever stopped it: the Well pad setup as the seed has it.
                const now = await setup();
                if (strip(now) !== was) {
                    const back = await send(page, 'edits.apply', { batchId: randomUUID(), ops: [{ op: 'update', entity: 'kindSetup', id: 'pad', baseVersion: now.version, data: { setup: seeded.setup } }] });
                    expect(back.type, JSON.stringify(back.body)).toBe('edits.apply.reply');
                }
            }
            expect(strip(await setup()), 'the Well pad setup is as it was').toBe(was);
            close(rec);
        });

        editorTest('Layers with Legend and Units, and Recent changes', async ({ page }) => {
            editorTest.setTimeout(480_000);
            const rec = recorder('layers', width);
            // OpenStreetMap's tiles are answered by a stub, as in every spec that shows them.
            await page.route(OSM_TILES, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: TILE_PNG }));
            const map = await openStudio(page);
            try {
            await tabTo(page, '.mapstudio-rail-item[data-surface="layers"]');
            await page.keyboard.press('Enter');
            await expect(map).toHaveAttribute('data-surface', 'layers');
            const dock = '.mapstudio-dock--layers';
            const tab = (name) => dock + ' .mapstudio-panel-tab[data-tab="' + name + '"]';
            const pressed = (selector) => holds(() => expect(page.locator(dock + ' ' + selector)).toHaveAttribute('aria-pressed', 'true', { timeout: SEEN_MS }));

            // The Layers tab.
            const Y = 'Layers';
            await walk(page, rec, Y, dock);
            if (await reach(page, rec, Y, 'the Layers tab', tab('layers'), { back: true })) {
                rec.add(Y, 'mode', 'the Layers tab says it is the open one (aria-selected true)', await focusIs(page, tab('layers') + '[aria-selected="true"]'), JSON.stringify(await active(page)));
                await page.keyboard.press('ArrowRight');
                await page.waitForTimeout(NOTHING_MS);
                rec.add(Y, 'operate', 'the arrow keys move between the Layers and Legend tabs, as they do between Details and Style', await focusIs(page, tab('legend')),
                    'ArrowRight left the focus on Layers: each of the two tabs is a Tab stop with no arrow keys (PanelTabs.tsx, no roving here)');
            }
            if (await reach(page, rec, Y, 'a Show tick box', dock + ' .mapstudio-legend-toggle')) {
                const checked = () => page.evaluate(() => document.activeElement.checked);
                const first = await checked();
                await page.keyboard.press('Space');
                rec.add(Y, 'operate', 'Space on a Show tick box turns the layer off and on', (await checked()) !== first, 'checked ' + await checked());
                await page.keyboard.press('Space');
                expect(await checked()).toBe(first);
            }
            if (await reach(page, rec, Y, 'a basemap', dock + ' [data-basemap="osm"]')) {
                await page.keyboard.press('Enter');
                rec.add(Y, 'operate', 'Enter on OpenStreetMap chooses the basemap', await pressed('[data-basemap="osm"]'), 'not pressed');
                rec.add(Y, 'mode', 'the basemap in force says so (aria-pressed and its name)', await pressed('[data-basemap="osm"]') && (await active(page)).name === 'OpenStreetMap', JSON.stringify(await active(page)));
                await tabTo(page, dock + ' [data-basemap="none"]', { back: true });
                await page.keyboard.press('Space');
                rec.add(Y, 'operate', 'Space on None chooses it back', await pressed('[data-basemap="none"]'), 'not pressed');
            }
            await page.keyboard.press('Escape');
            rec.add(Y, 'esc', 'Esc on Layers keeps Select in hand and the surface open', await attr(map, 'data-tool', '') && await attr(map, 'data-surface', 'layers'), await map.getAttribute('data-surface'));
            rec.text(Y, 'drag', 'No drag.');

            // Units: the system and the labels by Enter and Space, saved for every map; then back to the setup's.
            const U = 'Units';
            const system = (await map.getAttribute('data-units')) || '';
            const other = system === 'us' ? 'metric' : 'us';
            if (await reach(page, rec, U, 'a units system', dock + ' [data-units-system="' + other + '"]')) {
                await page.keyboard.press('Enter');
                rec.add(U, 'operate', 'Enter on ' + other + ' saves the units for the map', await attr(map, 'data-units', other) && await holds(() =>
                    expect(map).toHaveAttribute('data-units-override', new RegExp('^' + other + ','), { timeout: SEEN_MS })), await map.getAttribute('data-units-override'));
                const inForce = await active(page);
                rec.add(U, 'mode', 'the system in force says so (aria-pressed and its name, "' + (inForce ? inForce.name : '') + '")', await pressed('[data-units-system="' + other + '"]')
                    && await focusIs(page, dock + ' [data-units-system="' + other + '"]') && !!inForce && inForce.name === (other === 'us' ? 'US' : 'Metric'), JSON.stringify(inForce));
                if (await reach(page, rec, U, 'the long labels', dock + ' [data-units-labels="long"]')) {
                    await page.keyboard.press('Space');
                    rec.add(U, 'operate', 'Space on Long saves the labels', await attr(map, 'data-unit-labels', 'long'), await map.getAttribute('data-unit-labels'));
                }
                const setup = await page.locator(dock + ' .mapstudio-units-group [data-units-system]').first().getAttribute('data-units-system');
                await tabTo(page, dock + ' [data-units-system="' + setup + '"]', { back: true });
                await page.keyboard.press('Enter');
                rec.add(U, 'operate', 'Enter on From setup clears the map\'s own units', await attr(map, 'data-units-override', '') && await attr(map, 'data-units', system),
                    'override ' + await map.getAttribute('data-units-override'));
            }
            await readTargets(page, rec, U, dock + ' .mapstudio-legend-section--units');
            await page.keyboard.press('Escape');
            rec.add(U, 'esc', 'Esc on Units keeps Select in hand and the surface open', await attr(map, 'data-tool', '') && await attr(map, 'data-surface', 'layers'), await map.getAttribute('data-surface'));
            rec.text(U, 'drag', 'No drag.');

            // The Legend tab.
            const G = 'Legend';
            if (await reach(page, rec, G, 'the Legend tab', tab('legend'), { back: true })) {
                await page.keyboard.press('Enter');
                rec.add(G, 'operate', 'Enter on the Legend tab opens it', await holds(() => expect(page.locator(tab('legend'))).toHaveAttribute('aria-selected', 'true', { timeout: SEEN_MS })), 'not selected');
                rec.add(G, 'mode', 'the Legend tab says it is the open one (aria-selected true)', await focusIs(page, tab('legend') + '[aria-selected="true"]'), JSON.stringify(await active(page)));
                await walk(page, rec, G, dock, { from: '.mapstudio-rail-item[data-surface="layers"]' });
                const heading = dock + ' .mapstudio-legend-heading-button';
                if ((await page.locator(heading).count()) > 0 && await reach(page, rec, G, 'the Kinds heading', heading, { back: true })) {
                    const expanded = await page.locator(heading).getAttribute('aria-expanded');
                    await page.keyboard.press('Enter');
                    rec.add(G, 'operate', 'Enter on the Kinds heading opens and closes its list', await holds(() => expect(page.locator(heading)).not.toHaveAttribute('aria-expanded', expanded, { timeout: SEEN_MS })),
                        'aria-expanded stayed ' + expanded);
                    await tabTo(page, heading, { back: true });
                    await page.keyboard.press('Space');
                } else {
                    rec.text(G, 'operate', 'The legend\'s key is read, not worked: beside the tab it holds no control at this width with the dev kinds.');
                }
                await page.keyboard.press('Escape');
                rec.add(G, 'esc', 'Esc on Legend keeps Select in hand and the surface open', await attr(map, 'data-tool', '') && await attr(map, 'data-surface', 'layers'), await map.getAttribute('data-surface'));
                await tabTo(page, tab('layers'), { back: true });
                await page.keyboard.press('Space');
                rec.add(G, 'operate', 'Space on the Layers tab opens it again', await holds(() => expect(page.locator(tab('layers'))).toHaveAttribute('aria-selected', 'true', { timeout: SEEN_MS })), 'not selected');
            }
            rec.text(G, 'drag', 'No drag.');

            // Recent changes: the units changes above are its newest rows.
            const H = 'Recent changes';
            await tabTo(page, '.mapstudio-rail-item[data-surface="history"]', { back: true });
            await page.keyboard.press('Enter');
            await expect(map).toHaveAttribute('data-surface', 'history');
            const history = '.mapstudio-dock--history';
            await expect(page.locator(history + ' .mapstudio-history-summary').first()).toBeVisible({ timeout: REPLY_MS });
            await walk(page, rec, H, history);
            const said = await page.locator(history + ' .mapstudio-history-row').evaluateAll((rows) => rows.map((r) => {
                const words = r.querySelector('.mapstudio-history-summary .mapstudio-history-text');
                const revert = r.querySelector('.mapstudio-history-revert');
                return { words: words ? words.textContent.trim() : '', revert: revert ? (revert.getAttribute('aria-label') || revert.getAttribute('title') || '') : null };
            }));
            // A row says its change when its words name it with who and when, and its Revert is named after the same change.
            const mute = said.filter((r) => !/\S.* - \d\d:\d\d$/.test(r.words) || (r.revert !== null && !(r.revert.startsWith('Revert: ') && r.words.startsWith(r.revert.slice(8)))));
            rec.add(H, 'mode', 'the surface is named in words ("' + await page.locator(history).getAttribute('aria-label') + '") and each of its ' + said.length
                + ' rows says its change, its Revert naming the same change', (await page.locator(history).getAttribute('aria-label')) === 'Recent changes' && said.length > 0 && mute.length === 0,
                mute.length + ' rows without their change in words, for example ' + JSON.stringify(mute[0]));
            // From the rail forward, so the row reached is the newest, the list's first.
            await tabTo(page, '.mapstudio-rail-item[data-surface="history"]', { back: true });
            if (await reach(page, rec, H, 'the newest change\'s row', history + ' .mapstudio-history-summary')) {
                await page.keyboard.press('Enter');
                rec.add(H, 'operate', 'Enter on a row opens its before and after', await focusIs(page, '.mapstudio-history-summary[aria-expanded="true"]'), JSON.stringify(await active(page)));
                await page.keyboard.press('Space');
                rec.add(H, 'operate', 'Space closes it', await focusIs(page, '.mapstudio-history-summary[aria-expanded="false"]'), JSON.stringify(await active(page)));
            }
            const first = page.locator(history + ' .mapstudio-history-row').first();
            const words = await first.locator('.mapstudio-history-text').textContent();
            if (await reach(page, rec, H, 'Revert of the newest change', history + ' .mapstudio-history-revert')) {
                await page.keyboard.press('Enter');
                rec.add(H, 'operate', 'Enter on Revert reverts the change ("' + words + '"): the map\'s own units are back', await holds(() =>
                    expect(map).not.toHaveAttribute('data-units-override', '', { timeout: SEEN_MS })), 'override ' + await map.getAttribute('data-units-override'));
                rec.add(H, 'operate', 'the focus is kept after Revert', !!(await active(page)), 'the focus fell to the page\'s body: the next Tab starts from the top of the page');
            }
            const older = history + ' .mapstudio-history-older';
            if ((await page.locator(older).count()) > 0 && await reach(page, rec, H, 'Show older', older)) {
                const count = await page.locator(history + ' .mapstudio-history-row').count();
                await page.keyboard.press('Enter');
                rec.add(H, 'operate', 'Enter on Show older lists more changes', await holds(() => expect.poll(() => page.locator(history + ' .mapstudio-history-row').count(), { timeout: SEEN_MS })
                    .toBeGreaterThan(count)), 'still ' + count + ' rows');
            }
            await tabTo(page, history + ' .mapstudio-history-summary', { back: true });
            await page.keyboard.press('Escape');
            rec.add(H, 'esc', 'Esc on Recent changes keeps Select in hand and the surface open', await attr(map, 'data-tool', '') && await attr(map, 'data-surface', 'history'), await map.getAttribute('data-surface'));
            rec.text(H, 'drag', 'No drag.');
            } finally {
                // What the pass changed is put back, whatever stopped it: no units of the map's own.
                await clearUnits(page);
            }
            await expect(map).toHaveAttribute('data-units-override', '', { timeout: REPLY_MS });
            close(rec);
        });

        editorTest('the save card and the conflict card', async ({ page, context, browser }) => {
            editorTest.setTimeout(480_000);
            const rec = recorder('cards', width);
            // The saves are answered busy by the socket gate, and one map.changed is dropped for the conflict, as savestates.spec.mjs does.
            const gate = openGate();
            await routeSockets(context, gate);
            const map = await openStudio(page);
            const id = randomUUID();
            const name = 'Keyboard pad ' + id.slice(0, 4);
            try {
            const made = await send(page, 'edits.apply', { batchId: randomUUID(), ops: [{ op: 'create', entity: 'item', id, baseVersion: 0,
                data: { kind: 'pad', name, geometry: { type: 'Point', coordinates: [-104.84, 39.64] }, properties: {} } }] });
            expect(made.type, JSON.stringify(made.body)).toBe('edits.apply.reply');
            await expect(page.locator('.mapstudio-list-row[data-item-id="' + id + '"]')).toHaveCount(1, { timeout: REPLY_MS });
            const card = page.locator('.mapstudio-save-card');
            const operator = '.mapstudio-panel .mapstudio-field--prop[data-field="operator"] .mapstudio-field-prop';
            /** The pad's Operator typed and finished with Enter, by keys: one update on its way. */
            const edit = async (value) => {
                expect(await chooseRow(page, map, name, id), 'the pad is chosen by keys').toBe(true);
                expect(await tabTo(page, operator), 'Operator takes the focus by Tab').toBe(true);
                await retype(page, value);
                await page.keyboard.press('Enter');
            };
            /** What waits unsaved is discarded by keys: the save status row's list, then its Discard. */
            const discard = async (surface) => {
                const row = '.mapstudio-panel-save--row [data-problem="edits"]';
                if (await reach(page, rec, surface, 'the save status row of the edit that waits', row, { back: true })) {
                    await page.keyboard.press('Enter');
                    const list = page.locator('.mapstudio-unsaved');
                    rec.add(surface, 'operate', 'Enter on the row opens the list of unsaved edits', await holds(() => expect(list).toBeVisible({ timeout: SEEN_MS })), 'no list');
                    if (await reach(page, rec, surface, 'Discard of the unsaved edit', '.mapstudio-unsaved-discard')) {
                        await readTargets(page, rec, surface, '.mapstudio-unsaved');
                        await page.keyboard.press('Enter');
                        rec.add(surface, 'operate', 'Enter on Discard drops the edit', await attr(map, 'data-unsaved-count', '0'), await map.getAttribute('data-unsaved-count'));
                    }
                }
                await expect(map).toHaveAttribute('data-unsaved-count', '0', { timeout: REPLY_MS });
            };
            /** One card walked: reached from where the edit left the focus, its words, its ring, its targets. */
            const read = async (surface, kind, title) => {
                const shown = rec.add(surface, 'operate', 'an edit made by keys and refused shows the card', await holds(() => expect(card).toHaveAttribute('data-card', kind, { timeout: REPLY_MS })),
                    'data-card ' + await card.getAttribute('data-card').catch(() => 'none'));
                if (!shown) {
                    return false;
                }
                const words = await card.locator('.mapstudio-save-card-title').textContent();
                rec.add(surface, 'mode', 'the card says what happened in words ("' + words + '", role ' + await card.getAttribute('role') + ')', title.test(words) && (await card.getAttribute('role')) === 'alert', words);
                rec.add(surface, 'reach', 'the card takes no focus of its own: the focus stays where the edit was made', !(await focusIs(page, '.mapstudio-save-card *')), JSON.stringify(await active(page)));
                await walk(page, rec, surface, '.mapstudio-save-card');
                return true;
            };

            // The save card: Map Studio busy.
            const B = 'Save card';
            gate.failSave = 'busy';
            await edit('Acme');
            if (await read(B, 'busy', /^Not saved - Map Studio is busy$/)) {
                await tabTo(page, '.mapstudio-save-card *', { back: true });
                await page.keyboard.press('Escape');
                rec.add(B, 'esc', 'Esc in the card closes it, the edit kept on the save status row, Select kept in hand', await holds(() => expect(card).toHaveCount(0, { timeout: SEEN_MS }))
                    && await attr(map, 'data-unsaved-count', '1') && await attr(map, 'data-tool', ''), 'card ' + await card.count() + ', unsaved ' + await map.getAttribute('data-unsaved-count'));
                rec.add(B, 'esc', 'the focus is kept when the card closes', !!(await active(page)), 'the focus fell to the page\'s body: the next Tab starts from the top of the page');
                await discard(B);
                // Again, for its buttons: Try again by Enter (still busy), then Discard my change by Enter.
                await edit('Beta');
                await expect(card).toHaveAttribute('data-card', 'busy', { timeout: REPLY_MS });
                if (await reach(page, rec, B, 'Try again', '.mapstudio-save-card-retry')) {
                    const tries = gate.failedSaves;
                    await page.keyboard.press('Enter');
                    rec.add(B, 'operate', 'Enter on Try again sends the edit again', await holds(() => expect.poll(() => gate.failedSaves, { timeout: SEEN_MS }).toBeGreaterThan(tries)), 'no new save');
                    await expect(card).toHaveAttribute('data-card', 'busy', { timeout: REPLY_MS });
                    await expect(card.locator('.mapstudio-save-card-discard')).toBeEnabled({ timeout: REPLY_MS });
                }
                if (await reach(page, rec, B, 'Discard my change', '.mapstudio-save-card-discard')) {
                    await page.keyboard.press('Space');
                    rec.add(B, 'operate', 'Space on Discard my change drops the edit and closes the card', await holds(() => expect(card).toHaveCount(0, { timeout: SEEN_MS }))
                        && await attr(map, 'data-unsaved-count', '0'), 'unsaved ' + await map.getAttribute('data-unsaved-count'));
                }
            }
            gate.failSave = null;
            await expect(map).toHaveAttribute('data-unsaved-count', '0', { timeout: REPLY_MS });
            rec.text(B, 'drag', 'No drag.');

            // The conflict card: the other map editor changes the pad while this page's news of it is dropped.
            const C = 'Conflict card';
            const other = await signedInContext(browser, EDITOR2_USER, { viewport: { width: 1366, height: 768 } });
            try {
                const otherPage = await other.newPage();
                await mapLoaded(await openMap(otherPage, '/edit'));
                const theirs = async (value) => {
                    const pad = await stored(page, id);
                    gate.dropChanged = 1;
                    const reply = await send(otherPage, 'edits.apply', { batchId: randomUUID(), ops: [{ op: 'update', entity: 'item', id, baseVersion: pad.version,
                        data: { properties: { ...pad.properties, status: value } } }] });
                    expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
                    await expect.poll(() => gate.dropChanged, { timeout: REPLY_MS }).toBe(0);
                };
                await theirs('producing');
                await edit('Acme');
                if (await read(C, 'conflict', new RegExp('^Not saved - conflict with ' + EDITOR2_USER + '\'s change$'))) {
                    await tabTo(page, '.mapstudio-save-card *', { back: true });
                    await page.keyboard.press('Escape');
                    rec.add(C, 'esc', 'Esc in the card closes it, the edit kept on the save status row, Select kept in hand', await holds(() => expect(card).toHaveCount(0, { timeout: SEEN_MS }))
                        && await attr(map, 'data-unsaved-count', '1') && await attr(map, 'data-tool', ''), 'card ' + await card.count() + ', unsaved ' + await map.getAttribute('data-unsaved-count'));
                    await discard(C);
                    // Again, for its choices: Apply mine on top by Enter saves mine on theirs.
                    await theirs('shut in');
                    await edit('Beta');
                    await expect(card).toHaveAttribute('data-card', 'conflict', { timeout: REPLY_MS });
                    if (await reach(page, rec, C, 'Apply mine on top', '.mapstudio-save-card-ontop')) {
                        await page.keyboard.press('Enter');
                        rec.add(C, 'operate', 'Enter on Apply mine on top saves my change on theirs', await holds(() => expect.poll(async () => (await stored(page, id)).properties.operator,
                            { timeout: REPLY_MS }).toBe('Beta')) && await attr(map, 'data-unsaved-count', '0'), JSON.stringify((await stored(page, id)).properties));
                    }
                    // And once more: Use their version by Space drops mine.
                    await theirs('producing');
                    await edit('Gamma');
                    await expect(card).toHaveAttribute('data-card', 'conflict', { timeout: REPLY_MS });
                    if (await reach(page, rec, C, 'Use their version', '.mapstudio-save-card-theirs')) {
                        await page.keyboard.press('Space');
                        rec.add(C, 'operate', 'Space on Use ' + EDITOR2_USER + '\'s version drops my change and closes the card', await holds(() => expect(card).toHaveCount(0, { timeout: SEEN_MS }))
                            && await attr(map, 'data-unsaved-count', '0') && (await stored(page, id)).properties.operator === 'Beta', JSON.stringify((await stored(page, id)).properties));
                    }
                }
                rec.text(C, 'drag', 'No drag.');
            } finally {
                await other.close();
            }
            } finally {
                // What the pass made is deleted again, whatever stopped it.
                gate.failSave = null;
                gate.dropChanged = 0;
                const pad = await stored(page, id);
                if (pad) {
                    const gone = await send(page, 'edits.apply', { batchId: randomUUID(), ops: [{ op: 'delete', entity: 'item', id, baseVersion: pad.version }] });
                    expect(gone.type, JSON.stringify(gone.body)).toBe('edits.apply.reply');
                }
            }
            close(rec);
        });
    });
}

// ---- The contrast of the studio's own parts, in both themes (K6) ----

/** Whether the studio is drawn dark: its ground's computed colour. */
async function isDark(page) {
    return page.evaluate(() => {
        const m = /(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(getComputedStyle(document.querySelector('.mapstudio')).getPropertyValue('--mapstudio-blank').trim()
            .replace(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i, (all, r, g, b) => [r, g, b].map((h) => parseInt(h, 16)).join(',')));
        return m ? Number(m[1]) + Number(m[2]) + Number(m[3]) < 384 : null;
    });
}

/** The dev /styles page's theme button pressed by keys in a second tab of the session: the session's theme switches for every tab. */
async function switchTheme(dev, to) {
    expect(await tabTo(dev, '#mapstudio-styles-theme, #mapstudio-styles-theme *'), 'the theme button takes the focus by Tab').toBe(true);
    await dev.keyboard.press('Enter');
    await expect(dev.locator('#mapstudio-styles-theme')).toHaveText(to === 'dark' ? 'Light theme' : 'Dark theme', { timeout: 30_000 });
}

/** The readings of what shows now: the rings of a walk of `container`, and the pressed, chosen and selected marks in the studio. */
async function readParts(page, readings, container, rings = true) {
    if (rings) {
        const inside = container + ', ' + container + ' *';
        if (await tabTo(page, inside)) {
            for (let i = 0; i < 400 && await focusIs(page, inside); i++) {
                const now = await active(page);
                if (now && now.ring && now.ring.browser) {
                    readings.browserRings.add(now.within + ': ' + now.tag + '.' + now.cls.split(/\s+/)[0]);
                } else if (now && now.ring) {
                    readings.push({ part: 'focus-ring', where: now.within + ': ' + now.name, surface: now.ring.surface, marks: [{ what: 'ring', layers: now.ring.layers }] });
                }
                await page.keyboard.press('Tab');
            }
        }
    }
    readings.push(...await page.evaluate((sel) => {
        const kp = window.__keyboardPass;
        const out = [];
        const where = (el) => (kp.info(el) || { within: '' }).within + ': ' + kp.words(el);
        const all = (q) => Array.from(document.querySelectorAll(sel)).flatMap((b) => Array.from(b.querySelectorAll(q))).filter((el) => el.getBoundingClientRect().width > 0);
        // A control that is off is inactive (outside 1.4.11) and is not read, but for the toolbar's glyphs below.
        for (const el of all('button[aria-pressed="true"], .mapstudio-rail-item--active, [role="switch"][aria-checked="true"], .mapstudio-switch:checked').filter((e) => !e.disabled)) {
            const m = kp.marks(el);
            // The Editing switch says on with its track, a part of the button.
            const track = el.querySelector('.mapstudio-edit-switch-track');
            out.push({ part: 'pressed', where: where(el), surface: track ? kp.marks(track).surface : m.surface, marks: track ? kp.marks(track).state : m.state });
            if (el.tagName === 'BUTTON') {
                out.push({ part: 'pressed-glyph', where: where(el), surface: m.own, marks: m.glyph });
            }
        }
        for (const el of all('[role="tab"][aria-selected="true"], .mapstudio-rule-type.mapstudio-panel-tab--active')) {
            const m = kp.marks(el);
            const under = m.state.filter((x) => x.what === 'bottom edge');
            out.push({ part: 'tab-underline', where: where(el), surface: m.surface, marks: under.length ? [{ what: 'underline', layers: under[0].layers }] : [{ what: 'no underline', layers: m.surface }] });
        }
        for (const el of all('.mapstudio-list-row--selected, .mapstudio-kv-row--browsing, [role="treeitem"][data-picked="true"], [role="treeitem"][aria-selected="true"]')) {
            const m = kp.marks(el);
            out.push({ part: 'selection', where: where(el), surface: m.surface, marks: m.state });
        }
        for (const el of all('.mapstudio-toolbar button')) {
            const m = kp.marks(el);
            out.push({ part: m.off ? 'toolbar-glyph-off' : 'toolbar-glyph', where: where(el), surface: m.own, marks: m.glyph });
        }
        return out;
    }, container));
}

/** A control read with the pointer over it, the state forced through the browser's own inspector protocol (no mouse call). */
async function readHover(page, cdp, readings, selector) {
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    if (!nodeId) {
        return false;
    }
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
    try {
        const m = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            const kp = window.__keyboardPass;
            return { ...kp.marks(el), where: (kp.info(el) || { within: '' }).within + ': ' + kp.words(el) };
        }, selector);
        readings.push({ part: 'hover', where: m.where, surface: m.surface, marks: m.state });
        readings.push({ part: 'hover-glyph', where: m.where, surface: m.own, marks: m.glyph });
    } finally {
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
    }
    return true;
}

for (const theme of THEMES) {
    editorTest.describe('contrast, ' + theme + ' theme', () => {
        editorTest.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

        editorTest('the focus ring, the pressed and hover states, the tab underline, the selection marks and the toolbar glyphs at 3:1', async ({ page, context }) => {
            editorTest.setTimeout(480_000);
            let dev = null;
            let map = await openStudio(page);
            try {
                if (theme === 'dark') {
                    dev = await context.newPage();
                    await mapLoaded(await openMap(dev, '/styles'));
                    await switchTheme(dev, 'dark');
                    await page.bringToFront();
                    await expect.poll(() => isDark(page), { timeout: 30_000 }).toBe(true);
                    // The page drawn again from the dark tokens, as review.spec.mjs does.
                    await page.reload({ waitUntil: 'load' });
                    map = await openEditor(page);
                }
                expect(await isDark(page), 'the ' + theme + ' theme is on').toBe(theme === 'dark');
                const readings = [];
                readings.browserRings = new Set();
                const cdp = await context.newCDPSession(page);
                await cdp.send('DOM.enable');
                await cdp.send('CSS.enable');
                const hover = async (selector) => expect(await readHover(page, cdp, readings, selector), 'a control to read under the pointer: ' + selector).toBe(true);

                // Items with CTB1's Details, Snap on: the rail, the list, the panel, the Editing switch and the toolbar.
                const ctb1 = seedIds['swd/ctb1'];
                await tabTo(page, '.mapstudio-tool--snap');
                await page.keyboard.press('Enter');
                await expect(map).toHaveAttribute('data-snap', 'on');
                expect(await chooseRow(page, map, 'CTB', ctb1)).toBe(true);
                await searchFor(page, '');
                await readParts(page, readings, '.mapstudio');
                for (const selector of ['.mapstudio-rail-item:not(.mapstudio-rail-item--active)', '.mapstudio-tool--point', '.mapstudio-tool--select', '.mapstudio-list-row:not(.mapstudio-list-row--selected)',
                    '.mapstudio-list-add', '.mapstudio-list-filter', '.mapstudio-panel .mapstudio-panel-tab:not(.mapstudio-panel-tab--active)', '.mapstudio-panel .mapstudio-panel-close',
                    '.mapstudio-panel .mapstudio-panel-delete', '.mapstudio-panel .mapstudio-override-edit', '.mapstudio-edit-switch-button', '.mapstudio-panel-save-button', '.mapstudio-list-select-all']) {
                    await hover(selector);
                }
                await tabTo(page, '.mapstudio-tool--snap');
                await page.keyboard.press('Enter');
                await expect(map).toHaveAttribute('data-snap', 'off');

                // Kinds: the list, the setup with the rule editor, and the tag browser open on a picked tag.
                await tabTo(page, '.mapstudio-rail-item[data-surface="kinds"]', { back: true });
                await page.keyboard.press('Enter');
                await expect(map).toHaveAttribute('data-surface', 'kinds');
                await readParts(page, readings, '.mapstudio-dock--kinds, .mapstudio-kindsetup');
                for (const selector of ['.mapstudio-kind-row:not(.mapstudio-list-row--selected)', '.mapstudio-kindsetup .mapstudio-tag-button', '.mapstudio-kindsetup .mapstudio-kv-remove',
                    '.mapstudio-kindsetup .mapstudio-kv-add', '.mapstudio-kindsetup .mapstudio-rule-type:not(.mapstudio-panel-tab--active)']) {
                    await hover(selector);
                }
                await tabTo(page, '.mapstudio-kindsetup .mapstudio-tag-button[aria-label="Pick a tag for Pressure"]', { back: true });
                await page.keyboard.press('Enter');
                const card = page.locator('.mapstudio-tagbrowser');
                await expect(card.locator('[role="treeitem"][data-path$="Pressure"]')).toBeVisible({ timeout: REPLY_MS });
                await expect.poll(() => focusIs(page, '.mapstudio-tagbrowser [role="treeitem"]'), { timeout: REPLY_MS }).toBe(true);
                for (let i = 0; i < 40 && !/Pressure$/.test(await page.evaluate(() => document.activeElement.getAttribute('data-path') || '')); i++) {
                    await page.keyboard.press('ArrowDown');
                }
                await page.keyboard.press('Enter');
                await expect(card.locator('[role="treeitem"][data-picked="true"]')).toHaveCount(1);
                // Once the Gateway has answered for the pick, its button is on: read then.
                await expect(card.locator('.mapstudio-tagbrowser-use')).toBeEnabled({ timeout: REPLY_MS });
                await readParts(page, readings, '.mapstudio-tagbrowser, .mapstudio-kindsetup', false);
                const row = await active(page);
                if (row && row.ring && !row.ring.browser) {
                    readings.push({ part: 'focus-ring', where: 'Tag browser: a row of the tree', surface: row.ring.surface, marks: [{ what: 'ring', layers: row.ring.layers }] });
                }
                await readParts(page, readings, '.mapstudio-tagbrowser');
                await hover('.mapstudio-tagbrowser [role="treeitem"][data-picked="false"]');
                await hover('.mapstudio-tagbrowser-cancel');
                await hover('.mapstudio-tagbrowser-use');
                await tabTo(page, '.mapstudio-tagbrowser-cancel');
                await page.keyboard.press('Enter');
                await expect(card).toHaveCount(0);

                // Layers, then Recent changes.
                await tabTo(page, '.mapstudio-rail-item[data-surface="layers"]', { back: true });
                await page.keyboard.press('Enter');
                await expect(map).toHaveAttribute('data-surface', 'layers');
                await readParts(page, readings, '.mapstudio-dock--layers');
                await hover('.mapstudio-dock--layers .mapstudio-panel-tab:not(.mapstudio-panel-tab--active)');
                await hover('.mapstudio-dock--layers [data-basemap][aria-pressed="false"]');
                await tabTo(page, '.mapstudio-rail-item[data-surface="history"]', { back: true });
                await page.keyboard.press('Enter');
                await expect(map).toHaveAttribute('data-surface', 'history');
                await expect(page.locator('.mapstudio-dock--history .mapstudio-history-summary').first()).toBeVisible({ timeout: REPLY_MS });
                await readParts(page, readings, '.mapstudio-dock--history');
                await hover('.mapstudio-history-summary');
                await hover('.mapstudio-history-revert');

                const rows = checkParts(readings);
                mkdirSync(KEYBOARD_OUT, { recursive: true });
                writeFileSync(path.join(KEYBOARD_OUT, 'contrast-' + theme + '.json'), JSON.stringify({ run: RUN, rows, browserRings: [...readings.browserRings].sort() }, null, 1));
                const parts = new Set(rows.map((r) => r.part));
                for (const part of ['focus-ring', 'pressed', 'pressed-glyph', 'hover', 'hover-glyph', 'tab-underline', 'selection', 'toolbar-glyph']) {
                    expect(parts.has(part), 'a reading of ' + part).toBe(true);
                }
                const missed = [...new Set(partMisses(rows).map(missKey))].sort();
                expect(missed, theme + ' theme: the parts under ' + MINIMUM + ':1 are the recorded ones (KNOWN_MISSES.' + theme + ')').toEqual([...KNOWN_MISSES[theme]].sort());
            } finally {
                if (dev) {
                    // The session's theme is put back to light.
                    await dev.bringToFront();
                    await switchTheme(dev, 'light');
                }
            }
        });
    });
}

/** A missed part as the list of known misses names it. */
function missKey(r) {
    return r.part + ' | ' + r.mark + ' ' + r.color + ' on ' + r.surface + ' | ' + r.ratio.toFixed(2);
}

// ---- The record ----

const START = '<!-- keyboard-pass:start (generated by e2e/tests/keyboard.spec.mjs with E2E_DOCS=1; do not edit by hand) -->';
const END = '<!-- keyboard-pass:end -->';

/** The tables of the pass from the parts' files: one per width, the failures, the contrast per theme and its misses. */
function recordText() {
    const lines = [];
    const failures = new Map();
    for (const [width] of WIDTHS) {
        const parts = [...new Set(SURFACES.map(([, part]) => part))].map((part) => JSON.parse(readFileSync(path.join(KEYBOARD_OUT, width + '-' + part + '.json'), 'utf8')));
        const checks = parts.flatMap((p) => p.checks);
        const texts = parts.flatMap((p) => p.texts);
        lines.push('**' + width + ' px, keys alone**', '', '| Surface | ' + COLUMNS.map(([, title]) => title).join(' | ') + ' |', '| --- |' + COLUMNS.map(() => ' --- |').join(''));
        for (const [surface] of SURFACES) {
            const cells = COLUMNS.map(([column]) => {
                const mine = checks.filter((c) => c.surface === surface && c.column === column);
                const failed = mine.filter((c) => !c.ok);
                const said = texts.filter((t) => t.surface === surface && t.column === column).map((t) => t.words);
                if (column === 'target') {
                    const least = said.map((w) => ({ w, px: Math.min(...w.split(' px')[0].split(' x ').map(Number)) })).sort((a, b) => a.px - b.px)[0];
                    return (least ? least.w : 'none read') + (failed.length ? '; FAILED: ' + failed.length + ' under 24 px' : '');
                }
                const verdict = mine.length === 0 ? '' : failed.length === 0 ? 'yes (' + mine.length + (mine.length === 1 ? ' check)' : ' checks)') : 'FAILED ' + failed.length + ' of ' + mine.length;
                return [verdict, ...said].filter(Boolean).join('. ') || 'nothing to check';
            });
            lines.push('| ' + surface + ' | ' + cells.map((c) => c.replace(/\|/g, '/')).join(' | ') + ' |');
        }
        lines.push('');
        for (const c of checks.filter((x) => !x.ok)) {
            const key = c.surface + '|' + c.column + '|' + c.what;
            if (!failures.has(key)) {
                failures.set(key, { ...c, widths: [] });
            }
            failures.get(key).widths.push(width);
        }
    }
    lines.push('**What failed, keys alone** (' + failures.size + '; each is a candidate entry for the owner, none fixed here)', '');
    const titles = Object.fromEntries(COLUMNS);
    for (const f of failures.values()) {
        lines.push('- ' + f.surface + ' (' + titles[f.column].toLowerCase() + '). Did not hold: ' + f.what + '. Seen: ' + (f.seen || 'it did not hold') + ' (' + f.widths.join(' and ') + ' px).');
    }
    if (failures.size === 0) {
        lines.push('- None.');
    }
    lines.push('');
    for (const theme of THEMES) {
        const { rows, browserRings } = JSON.parse(readFileSync(path.join(KEYBOARD_OUT, 'contrast-' + theme + '.json'), 'utf8'));
        lines.push('**Contrast of the studio\'s parts, ' + theme + ' theme** (' + rows.length + ' readings at 1440 px; alike readings are one line)', '', partsTable(theme, rows), '');
        const missed = [...new Set(partMisses(rows).map(missKey))].sort();
        lines.push('**Under 3:1, ' + theme + ' theme** (' + missed.length + ')', '', ...(missed.length ? missed.map((m) => '- ' + m) : ['- None.']), '');
        lines.push('**The browser\'s own focus ring, ' + theme + ' theme** (outline auto: the browser paints it, so no colour is read and no ratio given): '
            + (browserRings.length ? browserRings.join('; ') + '.' : 'none; every ring read is the page\'s own.'), '');
    }
    return lines.join('\n');
}

editorTest('the record: every surface has a row at each width, the tables written', async () => {
    const wanted = [...WIDTHS.flatMap(([width]) => [...new Set(SURFACES.map(([, part]) => part))].map((part) => width + '-' + part + '.json')), ...THEMES.map((t) => 'contrast-' + t + '.json')];
    // Every part's file must be there and written by this run: a part that threw before its rows were written, or a run
    // of some tests only, builds no record.
    const fromThisRun = (f) => existsSync(path.join(KEYBOARD_OUT, f)) && JSON.parse(readFileSync(path.join(KEYBOARD_OUT, f), 'utf8')).run === RUN;
    expect(wanted.filter((f) => !fromThisRun(f)), 'the parts of the pass with no rows from this run (run the whole file; a part that failed wrote none)').toEqual([]);
    const text = recordText();
    for (const [width] of WIDTHS) {
        const table = text.split('**' + width + ' px, keys alone**')[1].split('**')[0];
        for (const [surface] of SURFACES) {
            const row = table.split('\n').find((l) => l.startsWith('| ' + surface + ' |'));
            expect(row, surface + ' has a row at ' + width + ' px').toBeTruthy();
            expect(row.includes('nothing to check') || row.includes('none read'), surface + ' at ' + width + ' px has every cell filled: ' + row).toBe(false);
        }
    }
    writeFileSync(path.join(KEYBOARD_OUT, 'record.md'), text + '\n');
    if (docsMode) {
        const file = path.join(repoRoot, 'docs', 'platform-checks.md');
        const doc = readFileSync(file, 'utf8');
        expect(doc.includes(START) && doc.includes(END), 'docs/platform-checks.md holds the markers of the generated tables').toBe(true);
        writeFileSync(file, doc.slice(0, doc.indexOf(START) + START.length) + '\n\n' + text + '\n' + doc.slice(doc.indexOf(END)));
    }
});
