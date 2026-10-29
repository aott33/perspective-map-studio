/**
 * The Needs you summary's pure part (epic 3 entry 3, R15; prd FR-42; EXPERIENCE.md Needs you bar;
 * DESIGN.md needs-you-bar): the counts of map items in alarm, comms lost and stale and the ranked
 * rows, worked out from the same live state the markers draw from (`itemState`, AD-6: no message
 * and no subscription of its own). An item counts once, in its worst state (alarm over comms lost
 * over stale, as its badge does). Alarms rank by priority, unacknowledged before acknowledged within
 * a priority, then by name; comms lost and stale by name. The words are the map's own, with no tag
 * path: "Priority 1 alarm, unacknowledged", "Comms lost", "Stale value". Unit tested in node.
 */

import { Kind } from './adapters';
import { MapItemRecord } from './contract';
import { ItemState, ItemValues, KindDisplay, LiveState, ageText, itemState } from './live';

export type NeedsYouState = 'alarm' | 'comms-lost' | 'stale';

/** One row of the ranked list. */
export interface NeedsYouRow {
    id: string;
    name: string;
    /** The kind's display name, or its id when the kind list does not have it. */
    kindName: string;
    /** The kind's icon id ('' when none). */
    icon: string;
    geometry: 'point' | 'line';
    state: NeedsYouState;
    /** The alarm priority 1 to 3, 0 for comms lost and stale. */
    priority: number;
    /** The badge glyph the row draws: `alarm-1-unacknowledged`, `alarm-2-acknowledged`, `alarm-3`, `comms-lost` or `stale`. */
    glyph: string;
    /** The state in words: "Priority 1 alarm, unacknowledged", "Comms lost", "Stale value". */
    words: string;
    /** The detail and age: "1 alarm - 4 min ago", "Last heard 14 min ago", "Pressure - last 22 min ago". */
    detail: string;
}

export interface NeedsYouCounts {
    alarm: number;
    commsLost: number;
    stale: number;
}

export interface NeedsYouSummary {
    counts: NeedsYouCounts;
    /** The items that need attention, alarms by priority, then comms lost, then stale. */
    rows: NeedsYouRow[];
    /** The highest alarm priority among the rows (1 to 3), 0 with no alarm: the bar's alarm glyph. */
    highestPriority: number;
}

/** What the bar reads with nothing to attend to (EXPERIENCE.md: neutral, and the bar stays). */
export const ALL_OK = 'All OK';

/** What the list says with nothing to attend to. */
export const NOTHING_NEEDS_YOU = 'Nothing needs you';

/** The list's one line of explanation (the mockups' "Ranked: alarms by priority, then comms lost, then stale"). */
export const RANKED_NOTE = 'Ranked: alarms by priority, then comms lost, then stale';

export const EMPTY_SUMMARY: NeedsYouSummary = { counts: { alarm: 0, commsLost: 0, stale: 0 }, rows: [], highestPriority: 0 };

/** The badge glyph of a state as the marker draws it (markers.ts markerSpec). */
export function stateGlyph(state: ItemState): string {
    if (state.alarm) {
        const p = state.alarm.priority;
        return p === 3 ? 'alarm-3' : 'alarm-' + p + (state.alarm.unacked ? '-unacknowledged' : '-acknowledged');
    }
    return state.commsLost ? 'comms-lost' : 'stale';
}

/** The state in words. */
export function stateWords(state: ItemState): string {
    if (state.alarm) {
        return 'Priority ' + state.alarm.priority + ' alarm, ' + (state.alarm.unacked ? 'unacknowledged' : 'acknowledged');
    }
    return state.commsLost ? 'Comms lost' : 'Stale value';
}

/** "4 min ago" of a slot's time, or '' without one. */
function age(t: string | null | undefined, now: number): string {
    return t ? ageText(t, now) : '';
}

/** Join the parts that are not empty with " - ". */
function join(...parts: string[]): string {
    return parts.filter((p) => p !== '').join(' - ');
}

/** The reason of a slot in plain words, capitalised, or ''. */
function reasonWords(reason: string): string {
    if (reason === '') {
        return '';
    }
    return reason.charAt(0).toUpperCase() + reason.substring(1);
}

/**
 * The row's detail and age: an alarm's count and the alarms slot's age (and "comms lost" when the
 * item's comms are lost too); comms lost's last heard time, or the reason when there was never a
 * value; a stale item's first stale key value (its label and age), else the alarms or style slot's reason.
 */
export function stateDetail(state: ItemState, values: ItemValues | undefined, display: KindDisplay | undefined, now: number): string {
    if (!values || !display) {
        return '';
    }
    if (state.alarm) {
        const n = state.alarm.active === 1 ? '1 alarm' : state.alarm.active + ' alarms';
        return join(n, age(values.alarms ? values.alarms.t : null, now), state.commsLost ? 'Comms lost' : '');
    }
    if (state.commsLost) {
        const comms = values.comms;
        if (comms && comms.value !== null && comms.value !== undefined) {
            const when = age(comms.t, now);
            return when ? 'Last heard ' + when : 'No time';
        }
        return join('No value yet', reasonWords(comms ? comms.reason : ''));
    }
    for (const kpi of display.kpis) {
        const value = values.kpis[kpi.key];
        if (kpi.on && value && value.stale) {
            const when = age(value.t, now);
            return join(kpi.label, when ? 'last ' + when : reasonWords(value.reason));
        }
    }
    if (values.alarms && values.alarms.stale) {
        return join('Alarms', reasonWords(values.alarms.reason));
    }
    if (values.style && values.style.stale) {
        return join('Style', reasonWords(values.style.reason));
    }
    return '';
}

/** The rank key of a row: alarms by priority (unacknowledged first), then comms lost, then stale; by name within each. */
function rankOf(state: ItemState): number {
    if (state.alarm) {
        return (state.alarm.priority - 1) * 2 + (state.alarm.unacked ? 0 : 1);
    }
    return state.commsLost ? 10 : 11;
}

/** The summary from the loaded items, the kind list and the live state. Pure. */
export function needsYou(items: readonly MapItemRecord[], kinds: readonly Kind[], live: LiveState, now: number): NeedsYouSummary {
    const kindById = new Map<string, Kind>();
    for (const kind of kinds) {
        kindById.set(kind.id, kind);
    }
    const counts: NeedsYouCounts = { alarm: 0, commsLost: 0, stale: 0 };
    const ranked: Array<{ row: NeedsYouRow; rank: number; key: string }> = [];
    let highest = 0;
    for (const item of items) {
        if (item.deleted) {
            continue;
        }
        const values = live.items[item.id];
        const display = live.display[item.kind];
        const state = itemState(values, display);
        if (state.badge === 'normal') {
            continue;
        }
        const kind = kindById.get(item.kind);
        const rowState: NeedsYouState = state.badge;
        if (rowState === 'alarm') {
            counts.alarm++;
            if (state.alarm && (highest === 0 || state.alarm.priority < highest)) {
                highest = state.alarm.priority;
            }
        } else if (rowState === 'comms-lost') {
            counts.commsLost++;
        } else {
            counts.stale++;
        }
        ranked.push({
            row: {
                id: item.id,
                name: item.name,
                kindName: kind ? kind.name : item.kind,
                icon: kind ? kind.icon : '',
                geometry: item.geometry.type === 'Point' ? 'point' : 'line',
                state: rowState,
                priority: state.alarm ? state.alarm.priority : 0,
                glyph: stateGlyph(state),
                words: stateWords(state),
                detail: stateDetail(state, values, display, now)
            },
            rank: rankOf(state),
            key: item.name.toLowerCase()
        });
    }
    ranked.sort((a, b) => {
        if (a.rank !== b.rank) {
            return a.rank - b.rank;
        }
        if (a.key !== b.key) {
            return a.key < b.key ? -1 : 1;
        }
        return a.row.id < b.row.id ? -1 : a.row.id > b.row.id ? 1 : 0;
    });
    return { counts, rows: ranked.map((r) => r.row), highestPriority: highest };
}

export function total(counts: NeedsYouCounts): number {
    return counts.alarm + counts.commsLost + counts.stale;
}

/** The words of one count: "1 alarm", "2 alarms", "1 comms lost", "3 stale". */
export function countText(kind: NeedsYouState, n: number): string {
    if (kind === 'alarm') {
        return n === 1 ? '1 alarm' : n + ' alarms';
    }
    return n + (kind === 'comms-lost' ? ' comms lost' : ' stale');
}

/** The counts that are not zero, in order, as the bar lists them after "Needs you N:". */
export function countParts(counts: NeedsYouCounts): Array<{ kind: NeedsYouState; text: string }> {
    const out: Array<{ kind: NeedsYouState; text: string }> = [];
    if (counts.alarm > 0) {
        out.push({ kind: 'alarm', text: countText('alarm', counts.alarm) });
    }
    if (counts.commsLost > 0) {
        out.push({ kind: 'comms-lost', text: countText('comms-lost', counts.commsLost) });
    }
    if (counts.stale > 0) {
        out.push({ kind: 'stale', text: countText('stale', counts.stale) });
    }
    return out;
}

/** The whole bar as one line: "Needs you 3: 1 alarm, 1 comms lost, 1 stale", or "All OK". */
export function summaryText(counts: NeedsYouCounts): string {
    const n = total(counts);
    if (n === 0) {
        return ALL_OK;
    }
    return 'Needs you ' + n + ': ' + countParts(counts).map((p) => p.text).join(', ');
}
