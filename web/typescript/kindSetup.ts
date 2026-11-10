/**
 * A kind's setup as the Kinds screen reads and saves it (epic 4 entry 12a; docs/kind-setup.md, DESIGN.md Kind setup, EXPERIENCE.md
 * Kind setup). Pure functions only, unit tested in node; the delegate sends what they build and the panel draws what they say.
 *
 * The Gateway stores a kind setup whole and an update replaces it whole, so the one hazard is a save that carries a stale copy
 * of a part nobody touched. Every save is therefore an **edit of one part** (`SetupEdit`) applied to the newest stored setup when
 * it is sent (`applyEdit`): the edited part changes and every other value, `styleRule`, `areaTints` and any key this screen does
 * not draw included, passes through as the same object. The batch is a create at version 0 when the kind has no setup, else an
 * update at the version the caller gives (`setupBatch`).
 *
 * Also here: the setup read with its defaults (`readSetup`: `on`, `count` and `summary` true, `icon` false), a key value's `key`
 * made from its label when the row is first saved (`keyFromLabel`), a refusal's Gateway words placed beside the field they name
 * (`refusalPlace`, by the order the rows were sent in), the header's override count and words, the resolve note's words, the
 * stored style rule in one line, and the preview item (the kind's first linked item by name, remembered per kind for
 * the browser session, never stored).
 *
 * From entry 12b1, section 6's editor: the style rule and an area kind's tints as they are typed (`RuleDraft`, `TintsDraft`),
 * read from the stored parts (`ruleDraft`, `tintsDraft`) and checked in shape before anything is sent (`checkRule`, `checkTints`:
 * the part as it is saved, or what is missing in words, "Not saved yet"). A rule and the tints are each one part, sent whole
 * (`SetupEdit` `styleRule`, `areaTints`).
 */

import { Asset, Kind } from './adapters';
import { EditBatch, EditOp, ErrorCodes, KindSetupRecord, MapItemRecord } from './contract';
import { isRecord } from './json';
import { PRESETS, TINTS } from './live';
import { ASSET_ID, ASSET_PATH, ITEM_ID, ITEM_NAME, PROPERTY_PREFIX } from './placeholders';
import { plural } from './history';
import { UnsavedEntry, isBusy, isTransient } from './unsaved';

/** The most key values a kind shows (`KindSetup.MAX_KPIS`). */
export const MAX_KEY_VALUES = 4;

/** The longest `key` the Gateway takes (`Rows.MAX_ID`). */
export const MAX_KEY = 64;

/** One key value as the screen shows it, the defaults applied. */
export interface KeyValue {
    key: string;
    label: string;
    path: string;
    unit: string;
    /** Shown in the popup. */
    on: boolean;
    /** The value shown on the map icon; one at most. */
    icon: boolean;
}

/** What is typed in a key value row not yet stored. */
export interface NewRowTexts {
    label: string;
    path: string;
    unit: string;
}

/** One popup view param: a literal, one placeholder, or `{asset.path}/` and a tag path. */
export interface Param {
    name: string;
    value: string;
}

/** A stored setup as the screen shows it: every part read with its defaults, a part the setup lacks null (or empty). */
export interface SetupView {
    comms: { path: string; on: boolean } | null;
    kpis: KeyValue[];
    alarms: { path: string; count: boolean; summary: boolean } | null;
    /** The popup link, '' for none. */
    link: string;
    popupView: { path: string; params: Param[] } | null;
    /** The stored style rule as it is, or null (`ruleDraft` reads it for the editor). */
    styleRule: Record<string, unknown> | null;
    /** An area kind's stored category tints, or null. */
    areaTints: { property: string; tints: TintRow[] } | null;
}

/** One category's tint as it is typed: '' while none is picked. */
export interface TintRow {
    category: string;
    tint: string;
}

function text(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

/** A switch read with its default: only a stored true or false changes it. */
function flag(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

/** The setup read for the screen, the reader's defaults applied (docs/kind-setup.md: `on`, `count`, `summary` true; `icon` false). */
export function readSetup(setup: Record<string, unknown> | null | undefined): SetupView {
    const s = setup || {};
    const comms = isRecord(s.comms) ? { path: text(s.comms.path), on: flag(s.comms.on, true) } : null;
    const kpis: KeyValue[] = [];
    if (Array.isArray(s.kpis)) {
        for (const raw of s.kpis) {
            if (isRecord(raw) && typeof raw.key === 'string') {
                kpis.push({ key: raw.key, label: text(raw.label), path: text(raw.path), unit: text(raw.unit), on: flag(raw.on, true), icon: flag(raw.icon, false) });
            }
        }
    }
    const alarms = isRecord(s.alarms) ? { path: text(s.alarms.path), count: flag(s.alarms.count, true), summary: flag(s.alarms.summary, true) } : null;
    let popupView: SetupView['popupView'] = null;
    if (isRecord(s.popupView)) {
        const params: Param[] = [];
        const raw = s.popupView.params;
        if (isRecord(raw)) {
            for (const name of Object.keys(raw)) {
                params.push({ name, value: text(raw[name]) });
            }
        }
        popupView = { path: text(s.popupView.path), params };
    }
    let areaTints: SetupView['areaTints'] = null;
    if (isRecord(s.areaTints)) {
        const rows = Array.isArray(s.areaTints.tints) ? s.areaTints.tints.filter(isRecord) : [];
        areaTints = { property: text(s.areaTints.property), tints: rows.map((t) => ({ category: text(t.category), tint: text(t.tint) })) };
    }
    return { comms, kpis, alarms, link: text(s.link), popupView, styleRule: isRecord(s.styleRule) ? s.styleRule : null, areaTints };
}

/**
 * One edit of one part of a setup. A comms or alarms path or the link typed empty takes its part away (the Gateway takes no
 * part without its path), and so does the popup view path while the view has no params (with params it changes nothing); a
 * switch of a part that is not there changes nothing.
 */
export type SetupEdit =
    | { part: 'comms.path'; path: string }
    | { part: 'comms.on'; on: boolean }
    | { part: 'kpi'; key: string; patch: Partial<Pick<KeyValue, 'label' | 'path' | 'unit' | 'on'>> }
    | { part: 'kpi.add'; row: Pick<KeyValue, 'key' | 'label' | 'path' | 'unit'> }
    | { part: 'kpi.remove'; key: string }
    /** The icon value: on, this key value alone is shown on the icon (one star only); off, none is. */
    | { part: 'kpi.icon'; key: string; icon: boolean }
    | { part: 'alarms.path'; path: string }
    | { part: 'alarms.count'; on: boolean }
    | { part: 'alarms.summary'; on: boolean }
    | { part: 'link'; link: string }
    | { part: 'popupView.path'; path: string }
    | { part: 'param.add'; name: string; value: string }
    | { part: 'param.value'; name: string; value: string }
    | { part: 'param.name'; name: string; to: string }
    | { part: 'param.remove'; name: string }
    /** The whole style rule (entry 12b1): replaced, or removed with null (None). */
    | { part: 'styleRule'; rule: Record<string, unknown> | null }
    /** An area kind's whole tints part: replaced, or removed with null (the property emptied). */
    | { part: 'areaTints'; tints: Record<string, unknown> | null };

function without(setup: Record<string, unknown>, key: string): Record<string, unknown> {
    if (!(key in setup)) {
        return setup;
    }
    const out = { ...setup };
    delete out[key];
    return out;
}

/** A part's object with one value set, its other values (those this screen does not draw included) kept; the part made when absent. */
function withIn(setup: Record<string, unknown>, part: string, key: string, value: unknown): Record<string, unknown> {
    const held = isRecord(setup[part]) ? setup[part] as Record<string, unknown> : {};
    return { ...setup, [part]: { ...held, [key]: value } };
}

function kpiRows(setup: Record<string, unknown>): unknown[] {
    return Array.isArray(setup.kpis) ? setup.kpis : [];
}

function hasKey(row: unknown, key: string): boolean {
    return isRecord(row) && row.key === key;
}

function paramsOf(setup: Record<string, unknown>): Record<string, unknown> {
    const view = setup.popupView;
    return isRecord(view) && isRecord(view.params) ? view.params : {};
}

/** The popup view with its params replaced (the key left out when none remain); nothing without a popup view. */
function withParams(setup: Record<string, unknown>, params: Record<string, unknown>): Record<string, unknown> {
    if (!isRecord(setup.popupView)) {
        return setup;
    }
    const view: Record<string, unknown> = { ...setup.popupView };
    if (Object.keys(params).length === 0) {
        delete view.params;
    } else {
        view.params = params;
    }
    return { ...setup, popupView: view };
}

/**
 * The stored setup with one edit applied: a new object whose edited part alone is new. Every other top-level value is the
 * stored object itself (the same reference), so nothing this screen does not draw is ever rebuilt, and an edit that changes
 * nothing returns the stored setup itself (`sameSetup`).
 */
export function applyEdit(stored: Record<string, unknown> | null | undefined, edit: SetupEdit): Record<string, unknown> {
    const setup = stored || {};
    switch (edit.part) {
        case 'comms.path':
            return edit.path === '' ? without(setup, 'comms') : withIn(setup, 'comms', 'path', edit.path);
        case 'comms.on':
            return isRecord(setup.comms) ? withIn(setup, 'comms', 'on', edit.on) : setup;
        case 'alarms.path':
            return edit.path === '' ? without(setup, 'alarms') : withIn(setup, 'alarms', 'path', edit.path);
        case 'alarms.count':
            return isRecord(setup.alarms) ? withIn(setup, 'alarms', 'count', edit.on) : setup;
        case 'alarms.summary':
            return isRecord(setup.alarms) ? withIn(setup, 'alarms', 'summary', edit.on) : setup;
        case 'link':
            return edit.link === '' ? without(setup, 'link') : { ...setup, link: edit.link };
        case 'popupView.path':
            if (edit.path === '') {
                // Only a view with no params goes (owner, 2026-11-10): its params are removed first, each its own save.
                return Object.keys(paramsOf(setup)).length > 0 ? setup : without(setup, 'popupView');
            }
            return withIn(setup, 'popupView', 'path', edit.path);
        case 'kpi': {
            const rows = kpiRows(setup);
            if (!rows.some((r) => hasKey(r, edit.key))) {
                return setup;
            }
            return { ...setup, kpis: rows.map((r) => (hasKey(r, edit.key) ? { ...(r as Record<string, unknown>), ...edit.patch } : r)) };
        }
        case 'kpi.add': {
            const rows = kpiRows(setup);
            if (rows.some((r) => hasKey(r, edit.row.key))) {
                // The row is stored already (its add saved): its values are set on it.
                const { key, ...patch } = edit.row;
                return applyEdit(setup, { part: 'kpi', key, patch });
            }
            return { ...setup, kpis: rows.concat([{ key: edit.row.key, label: edit.row.label, path: edit.row.path, unit: edit.row.unit, on: true, icon: false }]) };
        }
        case 'kpi.remove': {
            const rows = kpiRows(setup);
            if (!rows.some((r) => hasKey(r, edit.key))) {
                return setup;
            }
            const left = rows.filter((r) => !hasKey(r, edit.key));
            return left.length === 0 ? without(setup, 'kpis') : { ...setup, kpis: left };
        }
        case 'kpi.icon': {
            const rows = kpiRows(setup);
            if (!rows.some((r) => hasKey(r, edit.key))) {
                return setup;
            }
            return {
                ...setup,
                kpis: rows.map((r) => {
                    if (hasKey(r, edit.key)) {
                        return { ...(r as Record<string, unknown>), icon: edit.icon };
                    }
                    // One star only: another row's star goes when this one takes it; a row with none is left as stored.
                    return edit.icon && isRecord(r) && r.icon === true ? { ...r, icon: false } : r;
                })
            };
        }
        case 'param.add':
        case 'param.value': {
            if (!isRecord(setup.popupView) || (edit.part === 'param.value' && !(edit.name in paramsOf(setup)))) {
                return setup;
            }
            return withParams(setup, { ...paramsOf(setup), [edit.name]: edit.value });
        }
        case 'param.name': {
            const params = paramsOf(setup);
            if (!(edit.name in params) || edit.to === edit.name) {
                return setup;
            }
            // Renamed in place, so the rows keep their order.
            const out: Record<string, unknown> = {};
            for (const name of Object.keys(params)) {
                if (name === edit.name) {
                    out[edit.to] = params[name];
                } else if (name !== edit.to) {
                    out[name] = params[name];
                }
            }
            return withParams(setup, out);
        }
        case 'param.remove': {
            const params = paramsOf(setup);
            if (!(edit.name in params)) {
                return setup;
            }
            const out = { ...params };
            delete out[edit.name];
            return withParams(setup, out);
        }
        case 'styleRule':
            return edit.rule === null ? without(setup, 'styleRule') : { ...setup, styleRule: edit.rule };
        case 'areaTints':
            return edit.tints === null ? without(setup, 'areaTints') : { ...setup, areaTints: edit.tints };
        default:
            return setup;
    }
}

/** Whether two setups hold the same values (an edit that changed nothing sends nothing). */
export function sameSetup(a: Record<string, unknown> | null | undefined, b: Record<string, unknown> | null | undefined): boolean {
    return a === b || JSON.stringify(a || {}) === JSON.stringify(b || {});
}

/**
 * One `edits.apply` batch saving a kind's whole setup: a create at version 0 when the kind has no stored setup, else an update at
 * `baseVersion` (the stored version, or the version the edited field was typed on when another editor has saved since, so the
 * Gateway answers the conflict; `restoreAt` is a tombstone's version, for the create that restores a deleted setup).
 */
export function setupBatch(kindId: string, batchId: string, stored: KindSetupRecord | undefined, setup: Record<string, unknown>,
    baseVersion?: number, restoreAt?: number): EditBatch {
    const op = stored
        ? { op: 'update', entity: 'kindSetup', id: kindId, baseVersion: baseVersion !== undefined ? baseVersion : stored.version, data: { setup } }
        : { op: 'create', entity: 'kindSetup', id: kindId, baseVersion: restoreAt !== undefined ? restoreAt : 0, data: { setup } };
    return { batchId, ops: [op as unknown as EditOp] };
}

/** The setup a kind setup batch carries for a kind, or null (not a kind setup batch, or a delete). */
export function batchSetup(batch: EditBatch, kindId?: string): Record<string, unknown> | null {
    const op = batch.ops.find((o) => o.entity === 'kindSetup' && (kindId === undefined || o.id === kindId));
    const data = op ? (op.data as unknown as { setup?: unknown } | undefined) : undefined;
    return data && isRecord(data.setup) ? data.setup : null;
}

/** The kind a batch of one kind setup op is for, or null (owner decision 6: such a batch's conflict card has one choice). */
export function setupKind(batch: EditBatch): string | null {
    const op = batch.ops.find((o) => o.entity === 'kindSetup');
    return op ? op.id : null;
}

/**
 * A key value's `key`, made from its label when the row is first saved and never changed after (owner decision 1): the label's
 * letters and digits in lower case, "value" when it has none, at most 64 characters, and a number added on a clash with a key
 * already taken ("pressure", "pressure2").
 */
export function keyFromLabel(label: string, taken: readonly string[]): string {
    let base = '';
    for (const ch of label.toLowerCase()) {
        if (/[\p{L}\p{N}]/u.test(ch)) {
            base += ch;
        }
    }
    base = (base === '' ? 'value' : base).slice(0, MAX_KEY);
    if (taken.indexOf(base) < 0) {
        return base;
    }
    for (let n = 2; ; n++) {
        const suffix = String(n);
        const key = base.slice(0, MAX_KEY - suffix.length) + suffix;
        if (taken.indexOf(key) < 0) {
            return key;
        }
    }
}

// ---- A kind's saves as the panel reads them ----

/**
 * A kind setup save that was refused (entry 12a): the field whose edit it was (it keeps what was typed), the field the Gateway's
 * words stand beside ('' for the panel's top), the words, the code, and the batch. A `conflict` stays in the queue with its card
 * and has no words here; anything else left the queue, and its words stand until the field is saved again or cleared.
 */
export interface KindRefusal {
    field: string;
    at: string;
    words: string;
    code: string;
    batchId: string;
}

/** One kind's saves as the Kinds panel reads them (entry 12a). */
export interface KindSaveState {
    /** The fields whose save is in flight or waiting its turn, in order. */
    saving: string[];
    refusals: KindRefusal[];
    /** How many saves of this kind have settled (saved, refused or dropped): a panel's sent field is settled once this moved on. */
    done: number;
}

export const NO_KIND_SAVES: KindSaveState = { saving: [], refusals: [], done: 0 };

// ---- The fields: what a refusal is placed beside ----

/** The panel's field ids (`data-field`): where a value is typed and where a refusal's words stand. */
export const Fields = {
    commsPath: 'comms.path',
    commsOn: 'comms.on',
    alarmsPath: 'alarms.path',
    alarmsCount: 'alarms.count',
    alarmsSummary: 'alarms.summary',
    link: 'link',
    popupPath: 'popupView.path',
    styleRule: 'styleRule',
    /** The value a rule reads, its expression, and one of its cases by its place as sent. */
    ruleSource: 'styleRule.source',
    ruleExpression: 'styleRule.expression',
    ruleCase: (index: number): string => 'styleRule.cases.' + index,
    /** An area kind's tints, their property, and one category's row. */
    areaTints: 'areaTints',
    tintsProperty: 'areaTints.property',
    tint: (category: string): string => 'areaTints.tints.' + category,
    /** A key value row, and one value of it. */
    kpi: (key: string, value?: 'label' | 'path' | 'unit' | 'on' | 'icon'): string => 'kpis.' + key + (value ? '.' + value : ''),
    /** A popup view param's row. */
    param: (name: string): string => 'popupView.params.' + name
};

/** Where a refusal stands and what it says. */
export interface RefusalPlace {
    /** The field the words stand beside (`Fields`), or '' for the panel's top. */
    at: string;
    /** The Gateway's words, without "Op N (id):" and without the part's name when a colon follows it. */
    words: string;
}

/** "Op 0 (pad): " and, for the messages the Gateway writes with no id, "Op 0: ". */
const OP_PREFIX = /^Op \d+(?: \(.*?\))?: /;

/**
 * An `invalid` reply's message placed (owner decision c): the Gateway's "Op 0 (pad): kpis[1].path: ..." loses its "Op N (id):"
 * and, where the message names a part and a colon, that too, and stands beside the field the part is (`kpis[1]` is the second
 * row **as sent**, found by its key in `sent`; a param by its name in `sent`). A message that names no field of the panel stands
 * at the panel's top with all its words.
 */
export function refusalPlace(message: string, sent: Record<string, unknown> | null): RefusalPlace {
    const rest = message.replace(OP_PREFIX, '');
    const after = (where: string): string => (rest.indexOf(where + ': ') === 0 ? rest.slice(where.length + 2) : rest);
    const kpi = /^kpis\[(\d+)\](?:\.(key|label|path|unit|on|icon))?/.exec(rest);
    if (kpi) {
        const rows = sent ? kpiRows(sent) : [];
        const row = rows[Number(kpi[1])];
        if (isRecord(row) && typeof row.key === 'string') {
            const value = kpi[2] === 'key' ? undefined : kpi[2] as 'label' | 'path' | 'unit' | 'on' | 'icon' | undefined;
            return { at: Fields.kpi(row.key, value), words: after(kpi[0]) };
        }
        return { at: '', words: rest };
    }
    const prefix = 'popupView.params.';
    if (rest.indexOf(prefix) === 0) {
        // A param is named by its name as sent (which may hold any character): the longest sent name the message goes on from.
        const names = sent ? Object.keys(paramsOf(sent)) : [];
        const named = names.filter((n) => rest.indexOf(prefix + n + ': ') === 0).sort((a, b) => b.length - a.length)[0];
        if (named !== undefined) {
            return { at: Fields.param(named), words: after(prefix + named) };
        }
        return { at: '', words: rest };
    }
    for (const where of [Fields.commsPath, Fields.commsOn, Fields.alarmsPath, Fields.alarmsCount, Fields.alarmsSummary, Fields.popupPath]) {
        if (rest.indexOf(where + ': ') === 0 || rest.indexOf(where + ' ') === 0) {
            return { at: where, words: after(where) };
        }
    }
    if (rest.indexOf('link: ') === 0 || rest.indexOf('link ') === 0) {
        return { at: Fields.link, words: after('link') };
    }
    // A case is the row at that place as sent (entry 12b1): a rule is sent whole, one case per row, in the rows' order.
    const ruleCase = /^styleRule\.cases\[(\d+)\](?:\.(?:value|min|max|preset))?/.exec(rest);
    if (ruleCase) {
        return { at: Fields.ruleCase(Number(ruleCase[1])), words: after(ruleCase[0]) };
    }
    for (const where of [Fields.ruleExpression, 'styleRule.source.path', 'styleRule.source.kpi', Fields.ruleSource]) {
        if (rest.indexOf(where + ': ') === 0 || rest.indexOf(where + ' ') === 0) {
            return { at: where === Fields.ruleExpression ? where : Fields.ruleSource, words: after(where) };
        }
    }
    if (rest.indexOf('styleRule') === 0) {
        return { at: Fields.styleRule, words: after(/^styleRule(?:\.[A-Za-z]+)*/.exec(rest)![0]) };
    }
    // A tint is named by its category as sent: only the rows with a tint are sent, so the place alone would not find the row.
    const tint = /^areaTints\.tints\[(\d+)\](?:\.(?:category|tint))?/.exec(rest);
    if (tint) {
        const held = sent && isRecord(sent.areaTints) && Array.isArray(sent.areaTints.tints) ? sent.areaTints.tints[Number(tint[1])] : null;
        return isRecord(held) && typeof held.category === 'string' ? { at: Fields.tint(held.category), words: after(tint[0]) }
            : { at: Fields.areaTints, words: rest };
    }
    if (rest.indexOf(Fields.tintsProperty + ': ') === 0) {
        return { at: Fields.tintsProperty, words: after(Fields.tintsProperty) };
    }
    if (rest.indexOf('areaTints') === 0) {
        return { at: Fields.areaTints, words: after(/^areaTints(?:\.[A-Za-z]+)*/.exec(rest)![0]) };
    }
    return { at: '', words: rest };
}

// ---- The header ----

/** A kind's geometry in a word: "Point", "Line" or "Area". */
export function geometryWord(kind: Kind): string {
    return kind.geometry === 'point' ? 'Point' : kind.area ? 'Area' : 'Line';
}

/** The live map items of a kind. */
export function itemsOfKind(items: readonly MapItemRecord[], kindId: string): MapItemRecord[] {
    return items.filter((i) => !i.deleted && i.kind === kindId);
}

/** "5 items", "1 item". */
export function itemsText(count: number): string {
    return count + (count === 1 ? ' item' : ' items');
}

/** An override's part in words, as the header names it. */
const PART_WORDS: Record<string, string> = {
    comms: 'comms', kpis: 'key values', alarms: 'alarms', link: 'link', popupView: 'popup view', styleRule: 'style rule', areaTints: 'area tints'
};

/** How many overrides the header names before "and N more". */
const OVERRIDES_NAMED = 2;

/**
 * The kind's overrides, counted and named (EXPERIENCE.md Override mark: "1 override (P14 label)"): one per item and overridden
 * part, the items by name; "No overrides", "1 override (P2 style rule)", "3 overrides (P2 style rule, P4 comms and 1 more)".
 */
export function overridesText(items: readonly MapItemRecord[]): string {
    const named: string[] = [];
    const sorted = items.filter((i) => !i.deleted).slice().sort((a, b) => compareNames(a.name, b.name));
    for (const item of sorted) {
        for (const part of Object.keys(item.overrides || {})) {
            named.push(item.name + ' ' + (PART_WORDS[part] || part));
        }
    }
    if (named.length === 0) {
        return 'No overrides';
    }
    const shown = named.slice(0, OVERRIDES_NAMED).join(', ');
    const more = named.length > OVERRIDES_NAMED ? ' and ' + (named.length - OVERRIDES_NAMED) + ' more' : '';
    return named.length + (named.length === 1 ? ' override (' : ' overrides (') + shown + more + ')';
}

/** The header's subline: "Point - applies to 5 items - 1 override (P2 style rule)". */
export function headerSubline(kind: Kind, items: readonly MapItemRecord[]): string {
    const own = itemsOfKind(items, kind.id);
    return geometryWord(kind) + ' - applies to ' + itemsText(own.length) + ' - ' + overridesText(own).replace(/^No overrides$/, 'no overrides');
}

/** Names in order, digits by value ("P2" before "P12"), letter case aside. */
export function compareNames(a: string, b: string): number {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) || (a < b ? -1 : a > b ? 1 : 0);
}

// ---- The preview item ----

/** A linked item of the kind the Preview item select offers: the item, its asset and the asset's folder. */
export interface PreviewOption {
    itemId: string;
    name: string;
    assetId: string;
    /** The asset's base path with its provider, `[default]Mesa/P14`. */
    folder: string;
}

/** The kind's items linked to an asset of the asset list, by name: what the Preview item select offers. */
export function previewOptions(items: readonly MapItemRecord[], kindId: string, assets: readonly Asset[]): PreviewOption[] {
    const out: PreviewOption[] = [];
    for (const item of itemsOfKind(items, kindId)) {
        const asset = item.assetId !== null ? assets.find((a) => a.id === item.assetId) : undefined;
        if (asset && asset.kind === kindId) {
            out.push({ itemId: item.id, name: item.name, assetId: asset.id, folder: asset.basePath });
        }
    }
    return out.sort((a, b) => compareNames(a.name, b.name) || (a.itemId < b.itemId ? -1 : 1));
}

/** The preview item (owner decision 5): the remembered one while it is still offered, else the first by name; null with none. */
export function previewOf(options: readonly PreviewOption[], remembered: string | null | undefined): PreviewOption | null {
    return options.find((o) => o.itemId === remembered) || options[0] || null;
}

/** The note under the Preview item select when no item of the kind is linked (owner decision b): the one note, none under the paths. */
export function noPreviewText(kind: Kind): string {
    return 'No ' + lowerKind(kind) + ' is linked to an asset yet, so its tag paths cannot be checked.';
}

const PREVIEW_PREFIX = 'mapstudio.kindpreview.v1:';

/** The session key of one project's and kind's preview item. */
export function previewKey(project: string, kindId: string): string {
    return PREVIEW_PREFIX + project + ':' + kindId;
}

/** The part of `sessionStorage` the preview item uses. */
export interface SessionStore {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

/** The preview item remembered for the browser session, or null (none, or a store that refuses). */
export function readPreview(store: SessionStore | null, key: string | null): string | null {
    if (!store || key === null) {
        return null;
    }
    try {
        return store.getItem(key);
    } catch (err) {
        return null;
    }
}

/** Remember the preview item for the browser session; a refusing store is ignored (the choice then holds for this page only). */
export function writePreview(store: SessionStore | null, key: string | null, itemId: string): void {
    if (!store || key === null) {
        return;
    }
    try {
        store.setItem(key, itemId);
    } catch (err) {
        // A convenience: nothing is lost with it.
    }
}

/** The kind the Kinds surface shows: the chosen one while the kind list has it, else the list's first; null for an empty list. */
export function shownKind(kinds: readonly Kind[], chosen: string | null): Kind | null {
    return kinds.find((k) => k.id === chosen) || kinds[0] || null;
}

// ---- Resolve notes ----

/** A kind's name inside a sentence: "well pad" (an all-capitals word is kept). */
export function lowerKind(kind: Kind): string {
    return kind.name.split(' ').map((w) => (w.length > 1 && w === w.toUpperCase() ? w : w.toLowerCase())).join(' ');
}

/** What `tags.resolve` said of one path for the preview item's asset, or that it is still being asked. */
export type ResolveState =
    | { state: 'asking' }
    | { state: 'resolved'; n: number; m: number }
    /** The reply had no count (the Gateway read the path as a full path). */
    | { state: 'shared' }
    | { state: 'failed'; message: string };

/** The note under a tag path: its words and whether it takes the warning token. */
export interface ResolveNote {
    text: string;
    warning: boolean;
    state: 'asking' | 'resolved' | 'shared' | 'failed';
}

/** A full path with its provider (`[default]Shared/GasPrice`): one tag, the same for every item of the kind. */
export function isFullPath(path: string): boolean {
    return path.charAt(0) === '[';
}

/** The key one path's resolve state is kept under: the kind, the preview item's asset and the path. */
export function resolveKey(kindId: string, assetId: string, path: string): string {
    return kindId + '\n' + assetId + '\n' + path;
}

/**
 * The note under a tag path (EXPERIENCE.md Voice and Tone): a full path "Same tag for every well pad", in the warning token;
 * else what `tags.resolve` said for the preview item's asset, "Resolves for 3 of 5 well pads" (the warning token when fewer than
 * all), "Checking..." while it is asked, a failed check in words. Null for no path, or a path not asked yet.
 */
export function resolveNote(path: string, kind: Kind, state: ResolveState | undefined): ResolveNote | null {
    if (path === '') {
        return null;
    }
    if (isFullPath(path) || (state && state.state === 'shared')) {
        return { text: 'Same tag for every ' + lowerKind(kind), warning: true, state: 'shared' };
    }
    if (!state) {
        return null;
    }
    if (state.state === 'asking') {
        return { text: 'Checking...', warning: false, state: 'asking' };
    }
    if (state.state === 'failed') {
        return { text: 'Could not check this path: ' + state.message, warning: true, state: 'failed' };
    }
    return { text: 'Resolves for ' + state.n + ' of ' + state.m + ' ' + plural(lowerKind(kind)), warning: state.n < state.m, state: 'resolved' };
}

/**
 * The setup's tag paths that are asked of `tags.resolve`: those below the asset, each once (a full path is said without asking);
 * the tag path a style rule reads last (entry 12b1).
 */
export function pathsToResolve(view: SetupView): string[] {
    const source = view.styleRule && isRecord(view.styleRule.source) ? text(view.styleRule.source.path) : '';
    const paths = [view.comms ? view.comms.path : '', view.alarms ? view.alarms.path : ''].concat(view.kpis.map((k) => k.path)).concat([source]);
    return paths.filter((p, i) => p !== '' && !isFullPath(p) && paths.indexOf(p) === i);
}

// ---- Section 6: what is stored, in words ----

/** The key value a style rule is built on, or null (a path, the instruments, or none). */
export function ruleKpi(setup: SetupView): string | null {
    const source = setup.styleRule ? setup.styleRule.source : null;
    return isRecord(source) && typeof source.kpi === 'string' ? source.kpi : null;
}

/** Why a key value's Remove is off (owner decision 2), or '' when it is on. */
export function removeBlocked(setup: SetupView, key: string): string {
    return ruleKpi(setup) === key ? 'Used by the style rule' : '';
}

/**
 * The stored style rule in one line: "No style rule", "States on Status: 4 states", "Bands on Flow: 3 bands",
 * "Expression on Pressure", "From the instruments on the line: the worst of them".
 */
export function styleRuleLine(setup: SetupView): string {
    const rule = setup.styleRule;
    if (!rule) {
        return 'No style rule';
    }
    const source = isRecord(rule.source) ? rule.source : {};
    if ('instruments' in source) {
        return 'From the instruments on the line: the worst of them';
    }
    let on = '';
    if (typeof source.kpi === 'string') {
        const kpi = setup.kpis.find((k) => k.key === source.kpi);
        on = ' on ' + (kpi && kpi.label !== '' ? kpi.label : source.kpi);
    } else if (typeof source.path === 'string') {
        on = ' on ' + source.path;
    }
    const cases = Array.isArray(rule.cases) ? rule.cases.length : 0;
    if (rule.type === 'states') {
        return 'States' + on + ': ' + cases + (cases === 1 ? ' state' : ' states');
    }
    if (rule.type === 'bands') {
        return 'Bands' + on + ': ' + cases + (cases === 1 ? ' band' : ' bands');
    }
    if (rule.type === 'expression') {
        return 'Expression' + on;
    }
    return 'A style rule is stored';
}

// ---- The placeholder picker ----

/** The closed placeholder list with the kind's field keys (docs/kind-setup.md, Placeholders), as the picker lists it. */
export function placeholderList(kind: Kind): string[] {
    return [ITEM_ID, ITEM_NAME, ASSET_ID, ASSET_PATH].concat(kind.fields.map((f) => PROPERTY_PREFIX + f.key + '}'));
}

/** `text` with `inserted` in place of its selection (the caret when nothing is chosen; the end when the caret is unknown). */
export function insertAt(text: string, inserted: string, start: number | null, end: number | null): string {
    const from = start === null || start < 0 || start > text.length ? text.length : start;
    const to = end === null || end < from || end > text.length ? from : end;
    return text.slice(0, from) + inserted + text.slice(to);
}

// ---- A row that is not sent ----

/** Why an emptied Popup view path is not sent while the view has params (owner, 2026-11-10): one save would take them all, with no Undo. */
export const POPUP_VIEW_HAS_PARAMS = 'Remove its params first. The popup view is kept.';

/**
 * The Popup view path finished: a path sets it; emptied, the view is removed only when it has no params, else it is refused in
 * the browser with words beside the field, nothing sent and the stored view kept.
 */
export function popupPathEdit(text: string, paramCount: number): SetupEdit | { problem: string } {
    return text === '' && paramCount > 0 ? { problem: POPUP_VIEW_HAS_PARAMS } : { part: 'popupView.path', path: text };
}

/** What a key value row still needs before it is sent (matrix K3), or '' when it has a label and a path. */
export function rowMissing(label: string, path: string): string {
    const l = label.trim() === '';
    const p = path.trim() === '';
    return l && p ? 'Type a label and a tag path. This row is not saved yet.' : l ? 'Type a label. This row is not saved yet.'
        : p ? 'Type a tag path. This row is not saved yet.' : '';
}

/** What a param row still needs before it is sent, or '': a name, and one no other row has. */
export function paramMissing(name: string, others: readonly string[]): string {
    if (name.trim() === '') {
        return 'Type a name. This param is not saved yet.';
    }
    return others.indexOf(name.trim()) >= 0 ? 'Another param has this name. This param is not saved yet.' : '';
}

/**
 * The new rows (key values or params) whose save has settled, ready for their next edit: `seen`, the setup version a row's first
 * keystroke was typed on, is forgotten, so the next keystroke (or finish) takes the stored version then. Without it a row whose
 * save met a conflict would be sent at the stale version for good after "Use <name>'s version". The same array when none settled.
 */
export function forgetSeen<T extends { seen: number | null }>(rows: T[], fieldOf: (row: T) => string | null, settled: readonly string[]): T[] {
    const hit = (row: T): boolean => {
        const field = fieldOf(row);
        return row.seen !== null && field !== null && settled.indexOf(field) >= 0;
    };
    return rows.some(hit) ? rows.map((row) => (hit(row) ? { ...row, seen: null } : row)) : rows;
}

// ---- The fields paused ----

/** The queued save of a kind's setup that waits with a reason (refused, or unsent after a failure), oldest first, or null. */
export function waitingSave(unsaved: readonly UnsavedEntry[], kindId: string): UnsavedEntry | null {
    return unsaved.find((e) => e.reason !== undefined && e.batch.ops.some((o) => o.entity === 'kindSetup' && o.id === kindId)) || null;
}

/**
 * Why a kind's fields take no input, in entry 10's words, or '' when they do: the store unreachable, or a save of this kind's
 * setup that waits refused or unsent with a reason (a conflict, busy, a read-only store), until its card's choice or a replay
 * settles it.
 */
export function pausedText(storePaused: boolean, waiting: UnsavedEntry | null): string {
    if (storePaused) {
        return 'Paused - the map store is unreachable';
    }
    const reason = waiting ? waiting.reason : undefined;
    if (!reason) {
        return '';
    }
    if (reason.code === ErrorCodes.CONFLICT) {
        return 'Not saved - conflict with ' + (reason.changedBy ? reason.changedBy + "'s" : "another editor's") + ' change';
    }
    if (isBusy(reason)) {
        return 'Not saved - Map Studio is busy';
    }
    if (reason.code === ErrorCodes.READ_ONLY) {
        return 'Not saved - the map store is read only';
    }
    return isTransient(reason.code) ? 'Not saved - store unreachable' : 'Not saved - ' + reason.message;
}

// ---- Section 6: the Style rule editor (entry 12b1) ----

/** A rule's type as the editor's segmented choice has it; None is no rule. */
export type RuleType = 'none' | 'states' | 'bands' | 'expression' | 'instruments';

/** The value a rule reads: a key value by its key, a typed tag path, or none picked yet. */
export type RuleSource = { from: '' } | { from: 'kpi'; key: string } | { from: 'path'; path: string };

/** One States case as typed: the value's text and the preset, '' while none is picked. */
export interface StateRow {
    value: string;
    preset: string;
}

/** One band as typed: from and to as text, empty for an open end, and the preset. */
export interface BandRow {
    from: string;
    to: string;
    preset: string;
}

/** The types that read a value and have cases (or an expression) of their own. */
export type CaseType = 'states' | 'bands' | 'expression';

/**
 * A rule as the editor holds it (owner decision 3): the type chosen and each type's own value and cases side by side, so a type
 * switched away from and back is as it was left, and a value picked for one type never changes another's. Only the chosen
 * type's part is saved.
 */
export interface RuleDraft {
    type: RuleType;
    /** The value each type reads; a stored rule's value is offered to the other types until one is picked for them. */
    sources: Record<CaseType, RuleSource>;
    states: StateRow[];
    bands: BandRow[];
    expression: string;
}

const NO_SOURCE: RuleSource = { from: '' };

export const NO_RULE: RuleDraft = {
    type: 'none', sources: { states: NO_SOURCE, bands: NO_SOURCE, expression: NO_SOURCE }, states: [], bands: [], expression: ''
};

/** The value the chosen type reads; none for None and From its instruments. */
export function draftSource(draft: RuleDraft): RuleSource {
    return draft.type === 'none' || draft.type === 'instruments' ? NO_SOURCE : draft.sources[draft.type];
}

/** A draft with the chosen type's value set; the other types keep theirs. */
export function withSource(draft: RuleDraft, source: RuleSource): RuleDraft {
    return draft.type === 'none' || draft.type === 'instruments' ? draft : { ...draft, sources: { ...draft.sources, [draft.type]: source } };
}

/** The types a kind's rule may have: From its instruments only for a line kind that is not an area. */
export function ruleTypes(kind: Kind): RuleType[] {
    const types: RuleType[] = ['none', 'states', 'bands', 'expression'];
    return kind.geometry === 'line' && !kind.area ? types.concat(['instruments']) : types;
}

export const RULE_TYPE_WORDS: Record<RuleType, string> = {
    none: 'None', states: 'States', bands: 'Bands', expression: 'Expression', instruments: 'From its instruments'
};

/** The closed preset list of a kind, by name (`StylePresets.presetsFor`): the line presets too for a line kind. */
export function presetsFor(kind: Kind): string[] {
    return kind.geometry === 'line' ? PRESETS.slice() : PRESETS.slice(0, 5);
}

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

/** A typed number, or NaN: digits with an optional sign, point and exponent, nothing else. */
export function typedNumber(typed: string): number {
    const t = typed.trim();
    const n = NUMBER.test(t) ? Number(t) : NaN;
    return isFinite(n) ? n : NaN;
}

/**
 * A States value as typed (docs/kind-setup.md: text, a number, or true or false; 1 and "1" are distinct cases): a number as a
 * number, `true` and `false` as themselves, text in double quotes as that text ("1" is the text 1), anything else as text.
 * Undefined for nothing typed.
 */
export function typedValue(typed: string): string | number | boolean | undefined {
    const t = typed.trim();
    if (t === '') {
        return undefined;
    }
    if (t.length >= 2 && t.charAt(0) === '"' && t.charAt(t.length - 1) === '"') {
        return t.slice(1, -1);
    }
    if (t === 'true' || t === 'false') {
        return t === 'true';
    }
    const n = typedNumber(t);
    return isNaN(n) ? t : n;
}

/** A stored States value as it is typed: a text that would read as something else (a number, true, nothing) in double quotes. */
export function valueText(value: unknown): string {
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (typeof value !== 'string') {
        return '';
    }
    return typedValue(value) === value ? value : '"' + value + '"';
}

function numberText(value: unknown): string {
    return typeof value === 'number' ? String(value) : '';
}

/** A stored style rule read for the editor; a rule of no known shape reads as None. */
export function ruleDraft(rule: Record<string, unknown> | null | undefined): RuleDraft {
    if (!rule) {
        return NO_RULE;
    }
    const src = isRecord(rule.source) ? rule.source : {};
    if ('instruments' in src) {
        return { ...NO_RULE, type: 'instruments' };
    }
    const source: RuleSource = typeof src.kpi === 'string' ? { from: 'kpi', key: src.kpi }
        : typeof src.path === 'string' ? { from: 'path', path: src.path } : NO_SOURCE;
    const sources = { states: source, bands: source, expression: source };
    const cases = Array.isArray(rule.cases) ? rule.cases.filter(isRecord) : [];
    if (rule.type === 'states') {
        return { ...NO_RULE, type: 'states', sources, states: cases.map((c) => ({ value: valueText(c.value), preset: text(c.preset) })) };
    }
    if (rule.type === 'bands') {
        return { ...NO_RULE, type: 'bands', sources,
            bands: cases.map((c) => ({ from: numberText(c.min), to: numberText(c.max), preset: text(c.preset) })) };
    }
    if (rule.type === 'expression') {
        return { ...NO_RULE, type: 'expression', sources, expression: text(rule.expression) };
    }
    return NO_RULE;
}

/**
 * The stored rule taken into a draft (another editor saved it, or a save of this one was given up): the stored type with its
 * value and cases, the other types' values and cases kept as they were typed (owner decision 3).
 */
export function foldRule(draft: RuleDraft, stored: RuleDraft): RuleDraft {
    return {
        type: stored.type,
        sources: stored.type === 'none' || stored.type === 'instruments' ? draft.sources
            : { ...draft.sources, [stored.type]: stored.sources[stored.type] },
        states: stored.type === 'states' ? stored.states : draft.states,
        bands: stored.type === 'bands' ? stored.bands : draft.bands,
        expression: stored.type === 'expression' ? stored.expression : draft.expression
    };
}

/** A draft checked in shape (owner decision 2). */
export interface RuleCheck {
    /** The rule as it is saved, null for None (the rule removed); undefined while it is not whole. */
    rule?: Record<string, unknown> | null;
    /** What is missing, a sentence each; empty when the rule is whole. */
    missing: string[];
    /** The rows a sentence names, by their place: their inputs are marked. */
    rows: number[];
}

function sourceOf(source: RuleSource, missing: string[], needed: boolean): Record<string, unknown> | undefined {
    if (source.from === 'kpi') {
        return { kpi: source.key };
    }
    if (source.from === 'path') {
        if (source.path.trim() === '') {
            missing.push('Type the tag path the rule reads.');
            return undefined;
        }
        return { path: source.path.trim() };
    }
    if (needed) {
        missing.push('Pick the value the rule reads.');
    }
    return undefined;
}

/**
 * A draft checked as the Gateway will check it (`KindSetup.java`), in the browser first, so a half-built rule is never sent
 * (matrix S2, S3): a States or Bands rule needs its value, at least one case, a preset in every row; a States value is typed and
 * has one case; a band's from is below its to, bands are in order and do not overlap, only the first is open below and only the
 * last open above; an expression needs its text. What the Gateway alone can tell (a tag path's form, an expression that cannot
 * be read) it still refuses, with its words beside the field.
 */
export function checkRule(draft: RuleDraft, kind: Kind): RuleCheck {
    const missing: string[] = [];
    const rows: number[] = [];
    const mark = (i: number, words: string): void => {
        missing.push(words);
        if (rows.indexOf(i) < 0) {
            rows.push(i);
        }
    };
    if (draft.type === 'none') {
        return { rule: null, missing, rows };
    }
    if (draft.type === 'instruments') {
        return ruleTypes(kind).indexOf('instruments') >= 0 ? { rule: { source: { instruments: 'worst' } }, missing, rows }
            : { missing: ['Only a line kind that is not an area takes its look from its instruments.'], rows };
    }
    const presets = presetsFor(kind);
    const preset = (i: number, name: string, noun: string): void => {
        if (name === '') {
            mark(i, noun + ' ' + (i + 1) + ' has no preset.');
        } else if (presets.indexOf(name) < 0) {
            mark(i, noun + ' ' + (i + 1) + ': ' + name + ' is not a preset of this kind.');
        }
    };
    const source = sourceOf(draft.sources[draft.type], missing, draft.type !== 'expression');
    if (draft.type === 'expression') {
        const expression = draft.expression.trim();
        if (expression === '') {
            missing.push('Type the expression.');
        }
        return missing.length > 0 ? { missing, rows } : { rule: { ...(source ? { source } : {}), type: 'expression', expression }, missing, rows };
    }
    const cases: Array<Record<string, unknown>> = [];
    if (draft.type === 'states') {
        if (draft.states.length === 0) {
            missing.push('Add a case.');
        }
        const values: Array<string | number | boolean | undefined> = [];
        draft.states.forEach((row, i) => {
            const value = typedValue(row.value);
            if (value === undefined) {
                mark(i, 'Case ' + (i + 1) + ' has no value.');
            } else {
                const twin = values.indexOf(value);
                if (twin >= 0) {
                    mark(i, 'Case ' + (i + 1) + ' has the same value as case ' + (twin + 1) + ' (' + valueText(value) + '): each value has one case.');
                }
            }
            values.push(value);
            preset(i, row.preset, 'Case');
            cases.push({ value, preset: row.preset });
        });
    } else {
        if (draft.bands.length === 0) {
            missing.push('Add a band.');
        }
        let previous: number | null = null;
        const last = draft.bands.length - 1;
        draft.bands.forEach((row, i) => {
            const read = (typed: string, end: string): number | null => {
                if (typed.trim() === '') {
                    return null;
                }
                const n = typedNumber(typed);
                if (isNaN(n)) {
                    mark(i, 'Band ' + (i + 1) + ': its ' + end + ' "' + typed.trim() + '" is not a number.');
                }
                return n;
            };
            const min = read(row.from, 'from');
            const max = read(row.to, 'to');
            if (min === null && i > 0) {
                mark(i, 'Band ' + (i + 1) + ' needs a from: only the first band is open below.');
            }
            if (max === null && i < last) {
                mark(i, 'Band ' + (i + 1) + ' needs a to: only the last band is open above.');
            }
            if (min !== null && max !== null && min >= max) {
                mark(i, 'Band ' + (i + 1) + ': its from (' + min + ') is not below its to (' + max + ').');
            }
            if (i > 0 && min !== null && previous !== null && min < previous) {
                mark(i, 'Band ' + (i + 1) + ' starts at ' + min + ', below the end of the band before (' + previous + '): bands are in order and do not overlap.');
            }
            previous = max === null || isNaN(max) ? previous : max;
            preset(i, row.preset, 'Band');
            cases.push({ min, max, preset: row.preset });
        });
    }
    return missing.length > 0 ? { missing, rows } : { rule: { source, type: draft.type, cases }, missing, rows };
}

/** "Not saved yet. Band 2 has no preset." under the rows, or '' when nothing is missing (owner decision 2). */
export function unsavedText(missing: readonly string[]): string {
    return missing.length === 0 ? '' : 'Not saved yet. ' + missing.join(' ');
}

/** Whether a draft is what is stored: both whole and the same rule, whatever order the stored rule's keys are in. */
export function sameRule(draft: RuleDraft, stored: Record<string, unknown> | null | undefined, kind: Kind): boolean {
    const mine = checkRule(draft, kind).rule;
    const theirs = checkRule(ruleDraft(stored), kind).rule;
    return mine !== undefined && theirs !== undefined && JSON.stringify(mine) === JSON.stringify(theirs);
}

/** The name of the value a rule reads, for "When Pressure is": the key value's label, else "the value". */
export function sourceName(source: RuleSource, kpis: readonly KeyValue[]): string {
    if (source.from !== 'kpi') {
        return 'the value';
    }
    const kpi = kpis.find((k) => k.key === source.key);
    return kpi && kpi.label !== '' ? kpi.label : source.key;
}

/** The presets an expression's text names, in order, each once: its preview tiles (EXPERIENCE.md, Open Question 4). */
export function expressionPresets(expression: string, kind: Kind): string[] {
    const presets = presetsFor(kind);
    const out: string[] = [];
    const quoted = /'([^']*)'|"([^"]*)"/g;
    let m = quoted.exec(expression);
    while (m) {
        const name = m[1] !== undefined ? m[1] : m[2];
        if (presets.indexOf(name) >= 0 && out.indexOf(name) < 0) {
            out.push(name);
        }
        m = quoted.exec(expression);
    }
    return out;
}

// ---- Section 6: an area kind's tints (entry 12b1) ----

/** An area kind's tints as the editor holds them: the property read ('' for none) and a row per category. */
export interface TintsDraft {
    property: string;
    rows: TintRow[];
}

/** The tint names, the closed palette. */
export const TINT_NAMES: readonly string[] = TINTS;

/** Whether a property's categories are a choice field's choices (owner decision 4): then the rows are fixed, else typed. */
export function fixedCategories(kind: Kind, property: string): boolean {
    const field = kind.fields.find((f) => f.key === property);
    return !!field && field.type === 'choice';
}

/**
 * The rows of a property: for a choice field one per choice, with its stored tint, then any stored category that is no choice
 * (kept, so nothing stored is dropped unseen); for any other field the stored rows, typed.
 */
export function tintRows(kind: Kind, property: string, stored: readonly TintRow[]): TintRow[] {
    const field = kind.fields.find((f) => f.key === property);
    if (!field || field.type !== 'choice') {
        return stored.map((r) => ({ ...r }));
    }
    const rows = field.choices.map((c) => ({ category: c, tint: (stored.find((r) => r.category === c) || { tint: '' }).tint }));
    return rows.concat(stored.filter((r) => field.choices.indexOf(r.category) < 0).map((r) => ({ ...r })));
}

/** The stored tints read for the editor. */
export function tintsDraft(stored: SetupView['areaTints'], kind: Kind): TintsDraft {
    return stored ? { property: stored.property, rows: tintRows(kind, stored.property, stored.tints) } : { property: '', rows: [] };
}

/** The tints checked in shape. */
export interface TintsCheck {
    /** The part as it is saved, null for no property (the part removed); undefined while it is not whole. */
    tints?: Record<string, unknown> | null;
    missing: string[];
    rows: number[];
}

/**
 * The tints checked as the Gateway will (`KindSetup.java` `areaTints`): no property removes the part; a choice field's rows
 * without a tint are left out and one at least has a tint; a typed row has a category of its own and a tint.
 */
export function checkTints(draft: TintsDraft, kind: Kind): TintsCheck {
    const missing: string[] = [];
    const rows: number[] = [];
    if (draft.property === '') {
        return { tints: null, missing, rows };
    }
    const fixed = fixedCategories(kind, draft.property);
    const tints: TintRow[] = [];
    draft.rows.forEach((row, i) => {
        const category = row.category.trim();
        let ok = true;
        if (!fixed && category === '') {
            missing.push('Category ' + (i + 1) + ' has no name.');
            ok = false;
        } else if (tints.some((t) => t.category === category)) {
            missing.push('Category ' + (i + 1) + ' repeats ' + category + ': each category has one tint.');
            ok = false;
        }
        if (row.tint === '') {
            if (!fixed) {
                missing.push((category === '' ? 'Category ' + (i + 1) : category) + ' has no tint.');
                ok = false;
            }
        } else if (ok) {
            tints.push({ category, tint: row.tint });
        }
        if (!ok) {
            rows.push(i);
        }
    });
    if (missing.length === 0 && tints.length === 0) {
        missing.push(fixed ? 'Pick a tint for a category.' : 'Add a category.');
    }
    return missing.length > 0 ? { missing, rows } : { tints: { property: draft.property, tints }, missing, rows };
}

/** Whether the tints typed are what is stored. */
export function sameTints(draft: TintsDraft, stored: SetupView['areaTints'], kind: Kind): boolean {
    const mine = checkTints(draft, kind).tints;
    const theirs = checkTints(tintsDraft(stored, kind), kind).tints;
    return mine !== undefined && theirs !== undefined && JSON.stringify(mine) === JSON.stringify(theirs);
}
