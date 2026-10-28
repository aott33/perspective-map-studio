/**
 * Live values in the browser (AD-6, AD-7, epic 3 entry 5): the `values.batch` body, the merge of
 * batches into one state, and each map item's state for the icon and the default popup. Pure
 * functions only, unit tested in node; the store delegate holds the state and the component draws.
 *
 * The Gateway works stale out (quality, comms); the browser only reads it. Every reason is plain
 * words and holds no tag path (viewers get batches too).
 */

import { isRecord } from './json';

/** One slot: `{value, quality, t, stale, reason}` (docs/contract.md, LiveValue). */
export interface LiveValue {
    value: unknown;
    quality: string;
    /** ISO 8601 UTC, or null before the first delivery. */
    t: string | null;
    stale: boolean;
    reason: string;
}

/** The alarms slot's value: active alarms below the item's alarms path, how many unacknowledged, the map's priority (1 to 3, 0 none). */
export interface AlarmSummary {
    active: number;
    unacked: number;
    priority: number;
}

/** A slot the Gateway could not resolve for the item, with the reason in plain words. */
export interface SlotProblem {
    slot: string;
    reason: string;
}

/** The closed preset list (common/.../StylePresets.java): the first five for every kind, the last three for lines. */
export const PRESETS = ['normal', 'attention', 'warning', 'fault', 'dimmed', 'solid', 'dashed', 'dotted'] as const;
export type Preset = typeof PRESETS[number];
/** The presets a point takes (a line preset on a point is read as normal). */
export type PointPreset = 'normal' | 'attention' | 'warning' | 'fault' | 'dimmed';
/** The closed tint palette (common/.../StylePresets.java). */
export const TINTS = ['tint-1', 'tint-2', 'tint-3', 'tint-4', 'tint-5', 'tint-6'] as const;
export type Tint = typeof TINTS[number];

/**
 * The style slot (epic 3 entry 1, docs/contract.md): the preset the kind's (or the item's own)
 * style rule gives, worked out on the Gateway; `normal` marked stale with the reason while the
 * rule's source is stale, so the map draws the stale look alone.
 */
export interface StyleSlot {
    preset: Preset;
    stale: boolean;
    reason: string;
}

/** One map item's values as a batch carries them. */
export interface ItemValues {
    id: string;
    comms?: LiveValue;
    kpis: Record<string, LiveValue>;
    alarms?: LiveValue;
    /** Present only for an item with a style rule. */
    style?: StyleSlot;
    problems: SlotProblem[];
}

/** One case of a style rule as the display lists it: the words of the case and its preset. */
export interface RuleCase {
    label: string;
    preset: Preset;
}

/** The path-free projection of a style rule (common/.../StyleRule.java, `display`). */
export interface RuleDisplay {
    type: 'states' | 'bands' | 'expression' | 'instruments';
    /** `kpi:<key>`, `tag` or `instruments`; never a path. */
    source: string;
    cases: RuleCase[];
}

/** An area kind's category tints: the property read and the tint of each category. */
export interface AreaTints {
    property: string;
    tints: Array<{ category: string; tint: Tint }>;
}

/** The path-free projection of a kind setup (common/.../KindDisplay.java). */
export interface KindDisplay {
    kindId: string;
    comms: boolean;
    kpis: Array<{ key: string; label: string; unit: string; icon: boolean; on: boolean }>;
    alarms: { on: boolean; count: boolean; summary: boolean };
    link: string;
    /** The kind's style rule, when it has one (epic 3 entry 1). */
    styleRule?: RuleDisplay;
    /** An area kind's category tints, when it has them. */
    areaTints?: AreaTints;
}

export function isPreset(value: unknown): value is Preset {
    return typeof value === 'string' && (PRESETS as readonly string[]).indexOf(value) >= 0;
}

export function isTint(value: unknown): value is Tint {
    return typeof value === 'string' && (TINTS as readonly string[]).indexOf(value) >= 0;
}

/** The style slot of a batch item, or null when it is not one. */
export function readStyleSlot(value: unknown): StyleSlot | null {
    if (!isRecord(value) || !isPreset(value.preset) || typeof value.stale !== 'boolean') {
        return null;
    }
    return { preset: value.preset, stale: value.stale, reason: typeof value.reason === 'string' ? value.reason : '' };
}

/** A rule's display, or null when it is not one; a case with an unknown preset is left out. */
export function readRuleDisplay(value: unknown): RuleDisplay | null {
    if (!isRecord(value) || typeof value.type !== 'string' || !Array.isArray(value.cases)) {
        return null;
    }
    if (value.type !== 'states' && value.type !== 'bands' && value.type !== 'expression' && value.type !== 'instruments') {
        return null;
    }
    const cases: RuleCase[] = [];
    for (const c of value.cases) {
        if (isRecord(c) && typeof c.label === 'string' && isPreset(c.preset)) {
            cases.push({ label: c.label, preset: c.preset });
        }
    }
    return { type: value.type, source: typeof value.source === 'string' ? value.source : 'tag', cases };
}

/** An area kind's tints, or null; a category with an unknown tint is left out. */
export function readAreaTints(value: unknown): AreaTints | null {
    if (!isRecord(value) || typeof value.property !== 'string' || !Array.isArray(value.tints)) {
        return null;
    }
    const tints: AreaTints['tints'] = [];
    for (const t of value.tints) {
        if (isRecord(t) && typeof t.category === 'string' && isTint(t.tint)) {
            tints.push({ category: t.category, tint: t.tint });
        }
    }
    return { property: value.property, tints };
}

/**
 * The tint of an area from its properties and its kind's tints (AD-11: areas only; points and
 * lines never take one): the tint of the category the property holds, or null (no tints, the
 * property not set, or a category with no tint: the neutral area look).
 */
export function areaTint(display: KindDisplay | undefined, properties: Record<string, unknown> | undefined): Tint | null {
    if (!display || !display.areaTints || !properties) {
        return null;
    }
    const raw = properties[display.areaTints.property];
    if (raw === null || raw === undefined) {
        return null;
    }
    const category = String(raw);
    for (const t of display.areaTints.tints) {
        if (t.category === category) {
            return t.tint;
        }
    }
    return null;
}

export interface ValuesBatchBody {
    seq: number;
    full: boolean;
    items: ItemValues[];
    /** Every kind's display, on a full batch. */
    kindDisplay?: KindDisplay[];
}

/** What the browser holds: the last batch seq, every item's values and every kind's display. */
export interface LiveState {
    seq: number;
    /** How many batches were applied, full ones included. */
    batches: number;
    /** How many full batches were applied. */
    fulls: number;
    items: Record<string, ItemValues>;
    display: Record<string, KindDisplay>;
}

export const LIVE_INITIAL: LiveState = { seq: 0, batches: 0, fulls: 0, items: {}, display: {} };

export function readLiveValue(value: unknown): LiveValue | null {
    if (!isRecord(value) || typeof value.quality !== 'string' || typeof value.stale !== 'boolean') {
        return null;
    }
    return {
        value: value.value === undefined ? null : value.value,
        quality: value.quality,
        t: typeof value.t === 'string' ? value.t : null,
        stale: value.stale,
        reason: typeof value.reason === 'string' ? value.reason : ''
    };
}

function readItem(value: unknown): ItemValues | null {
    if (!isRecord(value) || typeof value.id !== 'string') {
        return null;
    }
    const item: ItemValues = { id: value.id, kpis: {}, problems: [] };
    const comms = readLiveValue(value.comms);
    if (comms) {
        item.comms = comms;
    }
    if (isRecord(value.kpis)) {
        for (const key of Object.keys(value.kpis)) {
            const kpi = readLiveValue(value.kpis[key]);
            if (kpi) {
                item.kpis[key] = kpi;
            }
        }
    }
    const alarms = readLiveValue(value.alarms);
    if (alarms) {
        item.alarms = alarms;
    }
    const style = readStyleSlot(value.style);
    if (style) {
        item.style = style;
    }
    if (Array.isArray(value.problems)) {
        for (const p of value.problems) {
            if (isRecord(p) && typeof p.slot === 'string' && typeof p.reason === 'string') {
                item.problems.push({ slot: p.slot, reason: p.reason });
            }
        }
    }
    return item;
}

export function readKindDisplay(value: unknown): KindDisplay | null {
    if (!isRecord(value) || typeof value.kindId !== 'string') {
        return null;
    }
    const kpis: KindDisplay['kpis'] = [];
    if (Array.isArray(value.kpis)) {
        for (const k of value.kpis) {
            if (isRecord(k) && typeof k.key === 'string') {
                kpis.push({
                    key: k.key,
                    label: typeof k.label === 'string' && k.label !== '' ? k.label : k.key,
                    unit: typeof k.unit === 'string' ? k.unit : '',
                    icon: k.icon === true,
                    on: k.on !== false
                });
            }
        }
    }
    const alarms = isRecord(value.alarms) ? value.alarms : {};
    const display: KindDisplay = {
        kindId: value.kindId,
        comms: value.comms === true,
        kpis,
        alarms: { on: alarms.on === true, count: alarms.count !== false, summary: alarms.summary !== false },
        link: typeof value.link === 'string' ? value.link : ''
    };
    const rule = readRuleDisplay(value.styleRule);
    if (rule) {
        display.styleRule = rule;
    }
    const tints = readAreaTints(value.areaTints);
    if (tints) {
        display.areaTints = tints;
    }
    return display;
}

/** The body of a values.batch, or null when it is malformed (no seq, full or items). Bad items are left out. */
export function readValuesBatch(body: unknown): ValuesBatchBody | null {
    if (!isRecord(body) || typeof body.seq !== 'number' || typeof body.full !== 'boolean' || !Array.isArray(body.items)) {
        return null;
    }
    const items: ItemValues[] = [];
    for (const raw of body.items) {
        const item = readItem(raw);
        if (item) {
            items.push(item);
        }
    }
    const out: ValuesBatchBody = { seq: body.seq, full: body.full, items };
    if (Array.isArray(body.kindDisplay)) {
        out.kindDisplay = body.kindDisplay.map(readKindDisplay).filter((d): d is KindDisplay => d !== null);
    }
    return out;
}

/**
 * The state after a batch: a full batch replaces every item (and the display when it carries one),
 * a changes-only batch replaces the items it carries. Pure.
 */
export function applyBatch(state: LiveState, batch: ValuesBatchBody): LiveState {
    const items: Record<string, ItemValues> = batch.full ? {} : { ...state.items };
    for (const item of batch.items) {
        items[item.id] = item;
    }
    let display = state.display;
    if (batch.kindDisplay) {
        display = {};
        for (const d of batch.kindDisplay) {
            display[d.kindId] = d;
        }
    }
    return { seq: batch.seq, batches: state.batches + 1, fulls: state.fulls + (batch.full ? 1 : 0), items, display };
}

/** The state of one map item for the icon: what the badge, the word and the KPI text say. */
export interface ItemState {
    /** The comms slot says false, or is stale (no value, bad quality). */
    commsLost: boolean;
    /** Something the item shows is stale (comms lost included). */
    stale: boolean;
    /** The highest active alarm, or null with none active or no alarms slot. */
    alarm: { priority: 1 | 2 | 3; unacked: boolean; active: number; stale: boolean } | null;
    /** The icon KPI's text with its unit, or null when the kind has none or it is off; `hasValue` is false before the first value. */
    iconKpi: { key: string; text: string; stale: boolean; hasValue: boolean } | null;
    /** `comms-lost`, `alarm` or `normal`: what the badge draws (an alarm draws over comms lost). */
    badge: 'alarm' | 'comms-lost' | 'stale' | 'normal';
    /**
     * The value style (epic 3 entry 1): the style rule's preset, `normal` without a rule, while the
     * rule's source is stale (the item then draws only as stale), or when the slot is absent.
     */
    preset?: Preset;
}

/** The preset an item draws: `normal` unless its style slot carries a fresh one. */
export function itemPreset(state: ItemState): Preset {
    return state.preset || 'normal';
}

export function alarmSummary(value: unknown): AlarmSummary | null {
    if (!isRecord(value) || typeof value.active !== 'number' || typeof value.unacked !== 'number'
        || typeof value.priority !== 'number') {
        return null;
    }
    return { active: value.active, unacked: value.unacked, priority: value.priority };
}

/** The state of an item from its values and its kind's display (null display: nothing shows). */
export function itemState(values: ItemValues | undefined, display: KindDisplay | undefined): ItemState {
    const none: ItemState = { commsLost: false, stale: false, alarm: null, iconKpi: null, badge: 'normal', preset: 'normal' };
    if (!values || !display) {
        return none;
    }
    const commsLost = !!(display.comms && values.comms && (values.comms.stale || values.comms.value === false));
    let stale = commsLost;
    let alarm: ItemState['alarm'] = null;
    if (display.alarms.on && values.alarms) {
        const summary = alarmSummary(values.alarms.value);
        if (values.alarms.stale) {
            stale = true;
        }
        if (summary && summary.active > 0 && summary.priority >= 1 && summary.priority <= 3) {
            alarm = {
                priority: summary.priority as 1 | 2 | 3, unacked: summary.unacked > 0, active: summary.active,
                stale: values.alarms.stale
            };
        }
    }
    let iconKpi: ItemState['iconKpi'] = null;
    for (const kpi of display.kpis) {
        if (!kpi.on) {
            continue;
        }
        const value = values.kpis[kpi.key];
        if (value && value.stale) {
            stale = true;
        }
        if (kpi.icon && value) {
            iconKpi = {
                key: kpi.key, text: valueText(value, kpi.unit), stale: value.stale,
                hasValue: value.value !== null && value.value !== undefined
            };
        }
    }
    // The value style: the Gateway sends normal while the rule's source is stale (the style drops
    // until a fresh value arrives); a stale source makes the item stale like any other slot.
    let preset: Preset = 'normal';
    if (values.style) {
        if (values.style.stale) {
            stale = true;
        } else {
            preset = values.style.preset;
        }
    }
    const badge: ItemState['badge'] = alarm ? 'alarm' : commsLost ? 'comms-lost' : stale ? 'stale' : 'normal';
    return { commsLost, stale, alarm, iconKpi, badge, preset };
}

/** A value with its unit as the popup and the icon show it: numbers at most one decimal, booleans On and Off. */
export function valueText(value: LiveValue, unit: string): string {
    const v = value.value;
    let text: string;
    if (v === null || v === undefined) {
        text = 'No value';
        return text;
    }
    if (typeof v === 'number') {
        text = Number.isInteger(v) ? String(v) : (Math.round(v * 10) / 10).toString();
    } else if (typeof v === 'boolean') {
        text = v ? 'On' : 'Off';
    } else if (typeof v === 'string') {
        text = v;
    } else {
        text = JSON.stringify(v);
    }
    return unit ? text + ' ' + unit : text;
}

/** "12 s ago", "3 min ago", "2 h ago", "4 d ago", or '' without a time. */
export function ageText(t: string | null, now: number): string {
    if (!t) {
        return '';
    }
    const at = Date.parse(t);
    if (!isFinite(at)) {
        return '';
    }
    const s = Math.max(0, Math.round((now - at) / 1000));
    if (s < 60) {
        return s + ' s ago';
    }
    const m = Math.round(s / 60);
    if (m < 60) {
        return m + ' min ago';
    }
    const h = Math.round(m / 60);
    if (h < 48) {
        return h + ' h ago';
    }
    return Math.round(h / 24) + ' d ago';
}

/** The comms row of the popup: "OK - 12 s ago", "Comms lost - 3 min ago", "No value yet". */
export function commsText(comms: LiveValue | undefined, now: number): { word: string; detail: string; lost: boolean } {
    if (!comms || comms.value === null || comms.value === undefined) {
        return { word: 'No value yet', detail: comms && comms.reason ? comms.reason : '', lost: !!comms };
    }
    const lost = comms.stale || comms.value === false;
    const age = ageText(comms.t, now);
    return { word: lost ? 'Comms lost' : 'OK', detail: age, lost };
}

/** The alarm block's words: "No active alarms", "1 alarm - Priority 1, unacknowledged", "3 alarms - Priority 2, acknowledged". */
export function alarmsText(alarms: LiveValue | undefined): string {
    if (!alarms) {
        return 'No value yet';
    }
    const summary = alarmSummary(alarms.value);
    if (!summary) {
        return alarms.reason ? 'No value yet - ' + alarms.reason : 'No value yet';
    }
    if (summary.active === 0) {
        return 'No active alarms';
    }
    const n = summary.active === 1 ? '1 alarm' : summary.active + ' alarms';
    const priority = summary.priority >= 1 && summary.priority <= 3 ? 'Priority ' + summary.priority : 'Diagnostic';
    return n + ' - ' + priority + ', ' + (summary.unacked > 0 ? 'unacknowledged' : 'acknowledged');
}

/** "Stale - " before a stale value's text, and the reason after it, as the popup marks stale values. */
export function staleText(value: LiveValue, text: string): string {
    return value.stale ? 'Stale - ' + text + (value.reason ? ' (' + value.reason + ')' : '') : text;
}
