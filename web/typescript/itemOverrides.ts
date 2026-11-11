/**
 * One item's Live now block and its per-item path overrides (epic 4 entry 12c1, R5; DESIGN.md Properties panel and Override tag,
 * EXPERIENCE.md Override mark; docs/kind-setup.md, "Item checks" and "Overridden from Details"). Pure functions only, unit tested
 * in node; the delegate sends what they build and the panel draws what they say.
 *
 * The block's rows come from the kind's setup in its order: Comms, one per key value, Alarms. Each has its live value in the
 * popup's words and its tag path: the kind's path filled for this item ("From kind"), or the item's own full path ("Override").
 *
 * An item update replaces `overrides` whole, so every edit starts from the newest overrides this page knows (those in flight
 * included) and changes one row (`applyRowEdit`): a key value's override is its entry `{key, path}` in `kpis`, Comms' and
 * Alarms' their part with the kind's switches kept, Reset removes the entry or the part, and every other stored value passes
 * through as the same object.
 *
 * What counts as an override is what the Gateway applies (`gateway/.../live/ValuePlan.java`: a comms or alarms part with a full
 * path, a `kpis` entry with a full path whose key the kind has, a style rule whose path, when it has one, is full). A link, a
 * popup view or area tints the Gateway stores but never applies, and a key the kind no longer has, are kept as stored, never
 * marked and never counted.
 *
 * This module imports nothing of kindSetup.ts, history.ts or unsaved.ts at run time: each of them reads its words from here.
 */

import { isRecord } from './json';
import type { SetupView } from './kindSetup';
import { ItemValues, NO_DATA, alarmsText, commsText, staleWords, valueText } from './live';
import { ItemView, fill } from './placeholders';

/** The row ids of the two fixed rows; a key value's is `kpiRow(key)`. */
export const COMMS_ROW = 'comms';
export const ALARMS_ROW = 'alarms';
const KPI_PREFIX = 'kpi:';

/** A key value's row id. */
export function kpiRow(key: string): string {
    return KPI_PREFIX + key;
}

/** The key value a row id names, or null (Comms, Alarms). */
export function rowKey(row: string): string | null {
    return row.indexOf(KPI_PREFIX) === 0 ? row.slice(KPI_PREFIX.length) : null;
}

/** The tags beside a path: the neutral one, and DESIGN.md's `override-tag`. */
export const FROM_KIND = 'From kind';
export const OVERRIDE = 'Override';

/** What a row says in place of a value while its part is switched off in the popup. */
export const OFF_IN_POPUP = 'Off in the popup';

/** The note under the rows of an item with no asset: its paths show as the kind wrote them. */
export const UNLINKED_NOTE = 'Not linked, so the paths show as the kind has them. Linking an asset fills them.';

/** The note under the rows of a linked item whose asset the asset list does not hold (still loading, not ok, removed). */
export const ASSET_MISSING_NOTE = 'The paths show as the kind has them, since its asset is not in the asset list.';

/** The longest value a Gateway reason repeats (`Rows.MAX_ID`). */
const MAX_ECHO = 64;

/** A value as a Gateway reason repeats it (`Rows.echo`): 64 characters then "...", a control character as "?". */
function echo(value: string): string {
    const cut = value.length > MAX_ECHO;
    const s = cut ? value.slice(0, MAX_ECHO) : value;
    let out = '';
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        out += c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029 ? '?' : s.charAt(i);
    }
    return cut ? out + '...' : out;
}

/** A path the Gateway applies as an override (`ValuePlan.isFull`): `[provider]...` with no brace. */
export function isApplied(path: unknown): path is string {
    return typeof path === 'string' && path.charAt(0) === '[' && path.indexOf(']') > 1 && path.indexOf('{') < 0;
}

/** `{asset.path}/` then a non-empty suffix with no braces (`Placeholders.isAssetSuffix`). */
function isAssetSuffix(path: string): boolean {
    const prefix = '{asset.path}/';
    if (path.indexOf(prefix) !== 0 || path.length === prefix.length) {
        return false;
    }
    const suffix = path.slice(prefix.length);
    return suffix.indexOf('{') < 0 && suffix.indexOf('}') < 0 && suffix.trim() !== '';
}

/** `[provider]path`: a non-empty provider, then a non-empty path, no braces and no second `[` (`Placeholders.isFullPath`). */
export function isFullTagPath(path: string): boolean {
    const close = path.indexOf(']');
    return path.charAt(0) === '[' && close > 1 && close < path.length - 1 && path.indexOf('{') < 0 && path.indexOf('}') < 0
        && path.indexOf('[', 1) < 0;
}

/**
 * Why a typed path is not taken as an override, in the Gateway's words, or '' for a full path: the same rule and the same
 * sentence per case as `Placeholders.checkTagPath` for an override, so nothing the Gateway would refuse for its form is sent.
 */
export function pathProblem(path: string): string {
    if (path.trim() === '') {
        return 'a tag path is needed.';
    }
    if (path === '{asset.path}' || isAssetSuffix(path)) {
        return "an override's tag path is a full path such as [default]Mesa/P12/Pressure, not " + echo(path) + '.';
    }
    if (isFullTagPath(path)) {
        return '';
    }
    return echo(path) + ' is not a tag path; use a full path such as [default]Shared/GasPrice.';
}

/** "Op 0 (id): " (or "Op 0: "), then "overrides: ", then the part's name and a colon. */
const OP_PREFIX = /^Op \d+(?: \(.*?\))?: /;
const PART_PREFIX = /^(?:comms\.path|alarms\.path|kpis\[\d+\]\.path): /;

/**
 * A Gateway refusal of an override without "Op N (id): overrides: ", or "overrides." as the Gateway writes an own rule's
 * expression it cannot read ("overrides.styleRule.expression: ..."): its part's name, when it names one, still leads.
 */
export function refusalRest(message: string): string {
    return message.replace(OP_PREFIX, '').replace(/^overrides(?:: |\.)/, '');
}

/** A Gateway refusal of an override as it stands beside the field: without "Op N (id): overrides: " and the part's name. */
export function refusalWords(message: string): string {
    return refusalRest(message).replace(PART_PREFIX, '');
}

/** One row of the Live now block. */
export interface LiveNowRow {
    /** `comms`, `kpi:<key>` or `alarms` (`data-row`). */
    id: string;
    /** "Comms", the key value's label, "Alarms". */
    name: string;
    /** The icon value: bold and starred. */
    icon: boolean;
    /** Switched off in the popup: `value` says so and no live value shows. */
    off: boolean;
    /** The live value in the popup's words. */
    value: string;
    /** The value is stale: the hourglass before it, `note` its reason. */
    stale: boolean;
    /** Comms are lost: the comms-lost glyph before the words. */
    lost: boolean;
    /** The row's tooltip ("Stale - comms lost", a No data reason), '' for none. */
    note: string;
    /** The kind's path as written, `{asset.path}/Pressure`. */
    kindPath: string;
    /** The item's own path when the Gateway applies one, else null. */
    override: string | null;
    /** The path shown: the override, else the kind's path filled for this item, else as written. */
    path: string;
    /** What an override starts from: the kind's path filled for this item (as written for an unlinked item). */
    start: string;
}

/** The Live now block of one item. */
export interface LiveNowBlock {
    rows: LiveNowRow[];
    /** The item is linked to no asset (`assetId` null). */
    unlinked: boolean;
    /** The item is linked, but its asset is not in the asset list, so the kind's paths cannot be filled. */
    assetMissing: boolean;
    /** The note under the rows for either, '' when the paths are filled. */
    note: string;
    /** With no rows, the one line saying why; '' otherwise. */
    empty: string;
}

/** What the block is read from. */
export interface LiveNowFacts {
    /** The kind's name, for the line of a kind with no setup. */
    kindName: string;
    /** The kind's stored setup read with its defaults, or null with none stored. */
    setup: SetupView | null;
    /** The item's newest overrides. */
    overrides: Record<string, unknown> | null | undefined;
    /** What the kind's placeholders fill from; `assetPath` null for an item with no asset in the asset list. */
    view: ItemView;
    /** The item's live values, or undefined before the first batch. */
    values: ItemValues | undefined;
    now: number;
}

function partPath(overrides: Record<string, unknown>, part: string): string | null {
    const held = overrides[part];
    return isRecord(held) && isApplied(held.path) ? held.path : null;
}

function kpiPath(overrides: Record<string, unknown>, key: string): string | null {
    const rows = Array.isArray(overrides.kpis) ? overrides.kpis : [];
    // The Gateway keeps the last entry of a key (a map by key).
    let path: string | null = null;
    for (const row of rows) {
        if (isRecord(row) && row.key === key && isApplied(row.path)) {
            path = row.path;
        }
    }
    return path;
}

/** The item's own path of one row when the Gateway applies it, else null. */
export function overridePath(overrides: Record<string, unknown> | null | undefined, row: string): string | null {
    const o = overrides || {};
    const key = rowKey(row);
    return key !== null ? kpiPath(o, key) : partPath(o, row);
}

/** The Live now block's rows: Comms, the kind's key values in its order, Alarms, each with its value and its path. */
export function liveNowBlock(facts: LiveNowFacts): LiveNowBlock {
    const setup = facts.setup;
    const overrides = facts.overrides || {};
    const values = facts.values;
    const rows: LiveNowRow[] = [];
    const paths = (id: string, kindPath: string): Pick<LiveNowRow, 'kindPath' | 'override' | 'path' | 'start'> => {
        const filled = fill(kindPath, facts.view);
        const start = filled !== null ? filled : kindPath;
        const override = overridePath(overrides, id);
        return { kindPath, override, path: override !== null ? override : start, start };
    };
    if (setup && setup.comms) {
        const problem = values ? values.problems.find((p) => p.slot === 'comms') : undefined;
        const words = commsText(values ? values.comms : undefined, facts.now, problem ? problem.reason : '');
        const noData = words.word === NO_DATA;
        const on = setup.comms.on;
        rows.push({
            id: COMMS_ROW, name: 'Comms', icon: false, off: !on,
            value: !on ? OFF_IN_POPUP : words.word + (!noData && words.detail !== '' ? ' - ' + words.detail : ''),
            stale: false, lost: on && words.lost && !noData,
            note: on && noData && words.detail !== '' ? words.word + ' - ' + words.detail : '',
            ...paths(COMMS_ROW, setup.comms.path)
        });
    }
    for (const kpi of setup ? setup.kpis : []) {
        const value = values ? values.kpis[kpi.key] : undefined;
        const hasValue = !!value && value.value !== null && value.value !== undefined;
        const stale = kpi.on && !!value && value.stale && hasValue;
        rows.push({
            id: kpiRow(kpi.key), name: kpi.label !== '' ? kpi.label : kpi.key, icon: kpi.icon, off: !kpi.on,
            value: !kpi.on ? OFF_IN_POPUP : hasValue ? valueText(value!, kpi.unit) : NO_DATA,
            stale, lost: false, note: stale ? staleWords(value!) : '',
            ...paths(kpiRow(kpi.key), kpi.path)
        });
    }
    if (setup && setup.alarms) {
        const on = setup.alarms.count || setup.alarms.summary;
        const slot = values ? values.alarms : undefined;
        const stale = on && !!slot && slot.stale;
        rows.push({
            id: ALARMS_ROW, name: 'Alarms', icon: false, off: !on,
            value: !on ? OFF_IN_POPUP : alarmsText(slot),
            stale, lost: false, note: stale ? staleWords(slot!) : '',
            ...paths(ALARMS_ROW, setup.alarms.path)
        });
    }
    const empty = rows.length > 0 ? ''
        : setup === null ? facts.kindName + ' has no setup yet, so its items show no live values.'
            : facts.kindName + "'s setup has no comms, key values or alarms, so its items show no live values.";
    const unlinked = facts.view.assetId === null;
    const assetMissing = !unlinked && facts.view.assetPath === null;
    return { rows, unlinked, assetMissing, note: unlinked ? UNLINKED_NOTE : assetMissing ? ASSET_MISSING_NOTE : '', empty };
}

/** The button of a kind with nothing to show: it opens Kinds at that kind. */
export function openSetupText(kindName: string): string {
    return 'Open ' + kindName + "'s setup";
}

function withoutKey(o: Record<string, unknown>, key: string): Record<string, unknown> {
    if (!(key in o)) {
        return o;
    }
    const out = { ...o };
    delete out[key];
    return out;
}

/**
 * The newest overrides with one row changed: `path` a full path sets the row's override, null resets it. A key value's is its
 * entry in `kpis`, its path alone changed (`{key, path}` when new; an entry's other values kept), an emptied `kpis` left out;
 * a new Comms or Alarms override is the kind's stored part with the path replaced, so the kind's switches are kept, and an
 * existing one keeps its own values and takes the new path. Every other value is
 * the stored object itself, and an edit that changes nothing returns `newest` itself.
 */
export function applyRowEdit(newest: Record<string, unknown> | null | undefined, kindSetup: Record<string, unknown> | null | undefined,
    row: string, path: string | null): Record<string, unknown> {
    const overrides = newest || {};
    const key = rowKey(row);
    if (key === null) {
        if (row !== COMMS_ROW && row !== ALARMS_ROW) {
            return overrides;
        }
        if (path === null) {
            return withoutKey(overrides, row);
        }
        const held = overrides[row];
        if (isRecord(held)) {
            // An override the item already has keeps its own values (its switches) and takes the new path.
            return held.path === path ? overrides : { ...overrides, [row]: { ...held, path } };
        }
        const kindPart = kindSetup && isRecord(kindSetup[row]) ? kindSetup[row] as Record<string, unknown> : {};
        return { ...overrides, [row]: { ...kindPart, path } };
    }
    const rows = Array.isArray(overrides.kpis) ? overrides.kpis as unknown[] : [];
    const has = rows.some((r) => isRecord(r) && r.key === key);
    if (path === null) {
        if (!has) {
            return overrides;
        }
        const left = rows.filter((r) => !(isRecord(r) && r.key === key));
        return left.length === 0 ? withoutKey(overrides, 'kpis') : { ...overrides, kpis: left };
    }
    if (!has) {
        return { ...overrides, kpis: rows.concat([{ key, path }]) };
    }
    if (rows.every((r) => !(isRecord(r) && r.key === key) || r.path === path)) {
        return overrides;
    }
    return { ...overrides, kpis: rows.map((r) => (isRecord(r) && r.key === key ? { ...r, path } : r)) };
}

/** The row id of an item's own style rule (entry 12c2): the Style tab's one override. */
export const RULE_ROW = 'styleRule';

/**
 * The newest overrides with the item's own style rule set (a whole rule, which replaces the kind's for this item) or taken away
 * (null, Reset). Every other value is the stored object itself, and an edit that changes nothing returns `newest` itself.
 */
export function applyRuleEdit(newest: Record<string, unknown> | null | undefined, rule: Record<string, unknown> | null): Record<string, unknown> {
    const overrides = newest || {};
    if (rule === null) {
        return withoutKey(overrides, RULE_ROW);
    }
    return same(overrides[RULE_ROW], rule) ? overrides : { ...overrides, [RULE_ROW]: rule };
}

/** The item's own style rule when the Gateway applies it (entry 12c2), else null: the kind's rule draws the item. */
export function ownRule(overrides: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
    const rule = (overrides || {})[RULE_ROW];
    return ruleApplied(rule) ? rule as Record<string, unknown> : null;
}

/** Whether two overrides hold the same values (an edit that changed nothing sends nothing). */
export function sameOverrides(a: Record<string, unknown> | null | undefined, b: Record<string, unknown> | null | undefined): boolean {
    return a === b || JSON.stringify(a || {}) === JSON.stringify(b || {});
}

// ---- What is applied and counted ----

/** A style rule of the item's own that the Gateway applies: an object whose source path, when it has one, is full. */
function ruleApplied(rule: unknown): boolean {
    if (!isRecord(rule)) {
        return false;
    }
    const source = rule.source;
    return !isRecord(source) || source.path === undefined || source.path === null || isApplied(source.path);
}

/**
 * The parts of an item's overrides the Gateway applies, in the header's order: `comms`, `kpis` (an entry with a full path whose
 * key is one of `kpiKeys`, the kind's), `alarms`, `styleRule`. Anything else stored is not an override anyone sees.
 */
export function appliedParts(overrides: Record<string, unknown> | null | undefined, kpiKeys: readonly string[]): string[] {
    const o = overrides || {};
    const out: string[] = [];
    if (partPath(o, 'comms') !== null) {
        out.push('comms');
    }
    if (kpiKeys.some((key) => kpiPath(o, key) !== null)) {
        out.push('kpis');
    }
    if (partPath(o, 'alarms') !== null) {
        out.push('alarms');
    }
    if (ruleApplied(o.styleRule)) {
        out.push('styleRule');
    }
    return out;
}

/** Whether the item has a style rule of its own that the Gateway applies. */
export function ownRuleApplied(overrides: Record<string, unknown> | null | undefined): boolean {
    return ruleApplied((overrides || {}).styleRule);
}

// ---- The words by part ----

/** A key value's label by its kind and key, or undefined when the page does not know it (the key is said then). */
export type KpiLabels = (kindId: string, key: string) => string | undefined;

/** No label known: every key value is said by its key. */
export const NO_LABELS: KpiLabels = () => undefined;

/** The key values' labels of the stored kind setups (`map.load`'s `kindSetups`, the records as stored). */
export function kpiLabelsOf(setups: ReadonlyArray<{ kindId: string; setup: Record<string, unknown> }>): KpiLabels {
    return (kindId, key) => {
        const record = setups.find((s) => s.kindId === kindId);
        const row = record ? entries(record.setup.kpis).find((r) => r.key === key) : undefined;
        return row && typeof row.label === 'string' && row.label !== '' ? row.label : undefined;
    };
}

/** One changed part of an item's overrides, in words. */
export interface OverrideChange {
    /** The part of `overrides` that changed: `comms`, `kpis`, `alarms`, `styleRule`, `link`, `popupView`, `areaTints`. */
    part: string;
    /** "Pressure path", "comms path", "alarms path" ("Pressure override", "comms override" when only a switch changed), "style rule", "link", "popup view", "area tints". */
    words: string;
    /** The part or the entry was taken away. */
    reset: boolean;
    /** The path before and after, '' where there was none (a part that is not a path: ''). */
    before: string;
    after: string;
}

const OTHER_PARTS: Record<string, string> = { styleRule: 'style rule', link: 'link', popupView: 'popup view', areaTints: 'area tints' };

function same(a: unknown, b: unknown): boolean {
    return a === b || JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
}

function pathOf(part: unknown): string {
    return isRecord(part) && typeof part.path === 'string' ? part.path : '';
}

function entries(value: unknown): Array<Record<string, unknown>> {
    return Array.isArray(value) ? value.filter((r): r is Record<string, unknown> => isRecord(r) && typeof r.key === 'string') : [];
}

/**
 * What changed between two `overrides` of one item, part by part and, for the key values, key by key: "Pressure path" (the key
 * value's label from `label`, else its key), "comms path", "alarms path", and the other parts by name.
 */
export function overrideChanges(before: unknown, after: unknown, label: (key: string) => string | undefined = () => undefined): OverrideChange[] {
    const a = isRecord(before) ? before : {};
    const b = isRecord(after) ? after : {};
    const out: OverrideChange[] = [];
    const keys = Object.keys(a).concat(Object.keys(b).filter((k) => !(k in a)));
    const order = ['comms', 'kpis', 'alarms'];
    keys.sort((x, y) => (order.indexOf(x) < 0 ? order.length : order.indexOf(x)) - (order.indexOf(y) < 0 ? order.length : order.indexOf(y)));
    for (const part of keys) {
        if (same(a[part], b[part])) {
            continue;
        }
        if (part === 'kpis') {
            const was = entries(a.kpis);
            const now = entries(b.kpis);
            const names = was.map((r) => r.key as string).concat(now.map((r) => r.key as string));
            for (const key of names.filter((k, i) => names.indexOf(k) === i)) {
                const x = was.find((r) => r.key === key);
                const y = now.find((r) => r.key === key);
                if (!same(x, y)) {
                    const moved = pathOf(x) !== pathOf(y);
                    out.push({ part, words: (label(key) || key) + (moved ? ' path' : ' override'), reset: y === undefined,
                        before: moved ? pathOf(x) : '', after: moved ? pathOf(y) : '' });
                }
            }
            continue;
        }
        const gone = b[part] === undefined || b[part] === null;
        if (part === 'comms' || part === 'alarms') {
            // A switch changed alone (a script's doing) is the part's override, not its path.
            const moved = pathOf(a[part]) !== pathOf(b[part]);
            out.push({ part, words: part + (moved ? ' path' : ' override'), reset: gone, before: moved ? pathOf(a[part]) : '',
                after: moved ? pathOf(b[part]) : '' });
        } else {
            out.push({ part, words: OTHER_PARTS[part] || part, reset: gone, before: '', after: '' });
        }
    }
    return out;
}

/** The changed parts as one phrase: "Pressure path", "Pressure path and comms path". */
export function changeWords(changes: readonly OverrideChange[]): string {
    const words = changes.map((c) => c.words);
    return words.length <= 1 ? words.join('') : words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1];
}

/** The verb of a change of overrides alone: reset when every changed part was taken away, else changed. */
export function allReset(changes: readonly OverrideChange[]): boolean {
    return changes.length > 0 && changes.every((c) => c.reset);
}

/**
 * Recent changes' sentence for an update of `overrides` alone: "Changed Point 2's Pressure path", "Reset Point 2's comms path";
 * '' when nothing of them changed.
 */
export function overrideSentence(name: string, changes: readonly OverrideChange[]): string {
    return changes.length === 0 ? '' : (allReset(changes) ? 'Reset ' : 'Changed ') + name + "'s " + changeWords(changes);
}

/** Undo's words for one row's override: "change Point 2's Pressure path", "reset Point 2's comms path". */
export function overrideLabel(reset: boolean, name: string, rowName: string): string {
    return (reset ? 'reset ' : 'change ') + name + "'s " + rowName + ' path';
}

/** Undo's words for an item's own style rule (entry 12c2): "change Point 2's style rule", "reset Point 2's style rule". */
export function ruleLabel(reset: boolean, name: string): string {
    return (reset ? 'reset ' : 'change ') + name + "'s style rule";
}

/** A row's name inside a sentence: the key value's label as it is, "comms" and "alarms" in lower case. */
export function rowWords(row: string, name: string): string {
    return rowKey(row) === null ? name.toLowerCase() : name;
}
