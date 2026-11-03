/**
 * The words of a line's default popup (AD-7, DESIGN.md line-popup, epic 3 entry 2), pure and unit
 * tested in node: the subline, the segment box, the comms line over the instruments, the row of each
 * node (the item a line end snaps to, each instrument in order) with its distance and live value.
 * LinePopup.tsx draws them; MapStudio.tsx builds the nodes from the map store's items and the live
 * state (`popupNodes`).
 */

import { Kind } from './adapters';
import { MapItemRecord } from './contract';
import { LineNode, SegmentRef, lineNodes } from './features';
import { instrumentsOn, lengthM } from './geometry';
import {
    ItemState, ItemValues, KindDisplay, LiveState, LiveValue, ageText, alarmsText, iconKpiOf, itemState, qualityWords, valueText
} from './live';

/** One row of the instruments list: a node with its words and values. */
export interface PopupNode extends LineNode {
    /** The map item's name ('' for a floating end). */
    name: string;
    /** The kind's icon and name (an instrument); '' for a snapped end item without a kind. */
    icon: string;
    kindName: string;
    values?: ItemValues;
    display?: KindDisplay;
    /** One of the two instruments at the open segment's ends. */
    highlighted: boolean;
}

/** "0 km", "1.1 km", "2.9 km": one decimal, 0 as "0 km". */
export function distanceText(metres: number): string {
    if (!(metres > 0)) {
        return '0 km';
    }
    const km = metres / 1000;
    return (km >= 10 ? Math.round(km).toString() : (Math.round(km * 10) / 10).toString()) + ' km';
}

/** "Gathering line - 6 in, 2.9 km": the kind, then the pipe size where the line has one and the length. */
export function lineSubline(kindName: string, diameter: unknown, metres: number): string {
    const parts: string[] = [];
    const n = typeof diameter === 'number' ? diameter : typeof diameter === 'string' ? Number(diameter) : NaN;
    if (isFinite(n) && n > 0) {
        parts.push(n + ' in');
    }
    if (metres > 0) {
        parts.push(distanceText(metres));
    }
    return parts.length > 0 ? kindName + ' - ' + parts.join(', ') : kindName;
}

/** The row's name: a snapped start as "CTB1 outlet", a snapped end as "SWD1 inlet", a floating end as "Line start" or "Line end". */
export function rowName(node: PopupNode): string {
    if (node.role === 'start') {
        return node.name ? node.name + ' outlet' : 'Line start';
    }
    if (node.role === 'end') {
        return node.name ? node.name + ' inlet' : 'Line end';
    }
    return node.name;
}

/**
 * What a node's value cell says: its icon KPI with the unit or "No value"; a stale value keeps its text
 * and is marked by the hourglass alone, the reason in `note` for the tooltip (option A, owner review
 * notes items 13 and 19): "Stale - last value, comms lost".
 */
export interface NodeValue {
    text: string;
    stale: boolean;
    /** The stale tooltip ("Stale - last value, comms lost"), '' when not stale. */
    note: string;
    hasValue: boolean;
    /** The number and its unit, for the segment's drop line; null when the value is not a number. */
    number: number | null;
    unit: string;
    /** The value's time, for the comms line's ages. */
    t: string | null;
    alarm: ItemState['alarm'];
    commsLost: boolean;
}

/** "Stale - last value, comms lost", "Stale - last value (Bad_Stale)", "Stale - no value yet": the row's tooltip in plain words. */
function staleNote(value: LiveValue, hasValue: boolean): string {
    const words = qualityWords(value.reason);
    const code = words !== value.reason && value.reason !== '' ? ' (' + value.reason + ')' : '';
    const why = words === '' || words === 'stale' ? '' : words;
    if (!hasValue) {
        return 'Stale' + (why !== '' ? ' - ' + why : '') + code;
    }
    return 'Stale - last value' + (why !== '' ? ', ' + why : '') + code;
}

export function nodeValue(node: PopupNode): NodeValue {
    const kpi = iconKpiOf(node.display);
    const value: LiveValue | undefined = kpi && node.values ? node.values.kpis[kpi.key] : undefined;
    const state = itemState(node.values, node.display);
    const unit = kpi ? kpi.unit : '';
    if (!kpi || !value) {
        return { text: 'No value', stale: false, note: '', hasValue: false, number: null, unit, t: null, alarm: state.alarm, commsLost: state.commsLost };
    }
    const hasValue = value.value !== null && value.value !== undefined;
    const number = typeof value.value === 'number' && isFinite(value.value) ? value.value : null;
    const plain = hasValue ? valueText(value, unit) : 'No value';
    const note = value.stale ? staleNote(value, hasValue) : '';
    return {
        text: plain, stale: value.stale, note, hasValue, number: value.stale ? null : number, unit, t: value.t,
        alarm: state.alarm, commsLost: state.commsLost
    };
}

/**
 * The line popup's alarm summary (owner review notes item 19): the instruments' active alarms, from
 * `values.batch` (priority and acknowledgement; the alarm's own words are pushed for the line only),
 * and the line's own alarms where its setup turns them on. The heading names the instrument in the
 * worst alarm ("1 alarm on the line - PT-2, Priority 1, unacknowledged"); `detail` lists the others
 * ("PT-1 priority 2, acknowledged") and the line's own alarm words. Null with no alarm anywhere.
 */
export interface LineAlarms {
    /** The active alarms over the instruments and the line. */
    count: number;
    priority: 1 | 2 | 3;
    unacked: boolean;
    heading: string;
    detail: string;
}

export function lineAlarms(nodes: PopupNode[], values: ItemValues | undefined, display: KindDisplay | undefined): LineAlarms | null {
    const own = itemState(values, display).alarm;
    const inAlarm = nodes.filter((n) => n.role === 'instrument' && nodeValue(n).alarm !== null)
        .map((n) => ({ name: n.name, alarm: nodeValue(n).alarm! }))
        .sort((a, b) => a.alarm.priority - b.alarm.priority || Number(b.alarm.unacked) - Number(a.alarm.unacked));
    if (inAlarm.length === 0 && !own) {
        return null;
    }
    const count = inAlarm.reduce((n, i) => n + i.alarm.active, 0) + (own ? own.active : 0);
    const worst = inAlarm[0];
    const ack = (unacked: boolean): string => (unacked ? 'unacknowledged' : 'acknowledged');
    const n = count === 1 ? '1 alarm' : count + ' alarms';
    if (!worst || (own && (own.priority < worst.alarm.priority || (own.priority === worst.alarm.priority && own.unacked && !worst.alarm.unacked)))) {
        // The line's own alarm is the worst: the point card's words, the instruments in alarm after it.
        const rest = inAlarm.map((i) => i.name + ' priority ' + i.alarm.priority + ', ' + ack(i.alarm.unacked)).join('; ');
        return {
            count, priority: own!.priority, unacked: own!.unacked,
            heading: n + ' - Priority ' + own!.priority + ', ' + ack(own!.unacked),
            detail: rest !== '' ? 'Also on the line: ' + rest : ''
        };
    }
    const others = inAlarm.slice(1).map((i) => i.name + ' priority ' + i.alarm.priority + ', ' + ack(i.alarm.unacked));
    if (own) {
        others.push('the line itself: ' + alarmsText(values ? values.alarms : undefined));
    }
    return {
        count, priority: worst.alarm.priority, unacked: worst.alarm.unacked,
        heading: n + ' on the line - ' + worst.name + ', Priority ' + worst.alarm.priority + ', ' + ack(worst.alarm.unacked),
        detail: others.length > 0 ? 'Also: ' + others.join('; ') : ''
    };
}

/** The segment box's words, or null when no segment is open or its nodes are not on the line. */
export interface SegmentWords {
    title: string;
    span: string;
    line: string;
    stale: boolean;
}

export function segmentWords(nodes: PopupNode[], segment: SegmentRef | null): SegmentWords | null {
    if (!segment || !nodes.some((n) => n.role === 'instrument' && n.measures)) {
        // A line with no measuring instrument has no segment to show (owner review notes item 17).
        return null;
    }
    const from = nodes.find((n) => n.id === segment.fromId);
    const to = nodes.find((n) => n.id === segment.toId);
    if (!from || !to) {
        return null;
    }
    const name = (n: PopupNode): string => n.role === 'instrument' ? n.name : rowName(n);
    const title = 'Segment ' + name(from) + ' to ' + name(to);
    const span = distanceText(from.distanceM).replace(' km', '') + ' to ' + distanceText(to.distanceM);
    const a = nodeValue(from);
    const b = nodeValue(to);
    const staleOne = from.role === 'instrument' && a.stale ? from : to.role === 'instrument' && b.stale ? to : null;
    if (staleOne) {
        return { title, span, line: 'Stale - drawn dashed until ' + staleOne.name + ' updates', stale: true };
    }
    let line: string;
    if (a.number !== null && b.number !== null && a.unit === b.unit) {
        const drop = Math.round((a.number - b.number) * 10) / 10;
        const over = ' over ' + distanceText(Math.abs(to.distanceM - from.distanceM));
        const change = drop > 0 ? 'drop ' + drop : drop < 0 ? 'rise ' + Math.abs(drop) : 'no change';
        line = a.number + ' to ' + b.number + (a.unit ? ' ' + a.unit : '') + ' - ' + change
            + (drop !== 0 && a.unit ? ' ' + a.unit : '') + over;
    } else {
        line = a.text + ' to ' + b.text;
    }
    return { title, span, line, stale: false };
}

/** The comms row over a line's instruments: the short words on the row and the full sentence for its note. */
export interface InstrumentsComms {
    /** "OK", "Comms lost" or "Stale": the row's first words. */
    word: string;
    /** "3, oldest 39 min" or "1 of 3": short, so the row fits the card on one line. */
    detail: string;
    /** True when an instrument's comms are lost or its value stale. */
    lost: boolean;
    /** The glyph before the words. */
    state: 'ok' | 'comms-lost' | 'stale';
    /** The full sentence, in the row's tooltip and under the row on a tap. */
    note: string;
}

/** "39 min ago" to "39 min" for the short row; the note keeps "ago". */
function shortAge(age: string): string {
    return age.replace(/ ago$/, '');
}

/**
 * The comms row over the line's instruments (owner, 0.3.0 re-test: the long form wrapped at the
 * card's width): "OK - 3, oldest 39 min" with the note "OK - 3 instruments, oldest 39 min ago";
 * with any instrument's comms lost "Comms lost - 1 of 3" with the note "Comms lost on 1 of 3
 * instruments: PT-1, last 18 min ago" (comms lost before stale); else with any stale "Stale - 1 of 3"
 * with the note "Stale on 1 of 3 instruments: PT-2, last 9 s ago". Null with no instrument on the line.
 */
export function instrumentsComms(nodes: PopupNode[], now: number): InstrumentsComms | null {
    const instruments = nodes.filter((n) => n.role === 'instrument');
    if (instruments.length === 0) {
        return null;
    }
    const total = instruments.length;
    const lostOnes = instruments.filter((n) => nodeValue(n).commsLost);
    const staleOnes = instruments.filter((n) => !nodeValue(n).commsLost && nodeValue(n).stale);
    const named = (list: PopupNode[], at: (n: PopupNode) => string | null): string => list.map((n) => {
        const age = ageText(at(n), now);
        return n.name + (age ? ', last ' + age : '');
    }).join('; ');
    const of = (k: number): string => k + ' of ' + total;
    const instrumentWord = total === 1 ? ' instrument' : ' instruments';
    if (lostOnes.length > 0) {
        return {
            word: 'Comms lost', detail: of(lostOnes.length), lost: true, state: 'comms-lost',
            note: 'Comms lost on ' + of(lostOnes.length) + instrumentWord + ': '
                + named(lostOnes, (n) => (n.values && n.values.comms ? n.values.comms.t : null))
        };
    }
    if (staleOnes.length > 0) {
        return {
            word: 'Stale', detail: of(staleOnes.length), lost: true, state: 'stale',
            note: 'Stale on ' + of(staleOnes.length) + instrumentWord + ': ' + named(staleOnes, (n) => nodeValue(n).t)
        };
    }
    let oldest = Infinity;
    for (const n of instruments) {
        const t = nodeValue(n).t;
        const at = t ? Date.parse(t) : NaN;
        if (isFinite(at) && at < oldest) {
            oldest = at;
        }
    }
    const age = isFinite(oldest) ? ageText(new Date(oldest).toISOString(), now) : '';
    return {
        word: 'OK', detail: total + (age ? ', oldest ' + shortAge(age) : ''), lost: false, state: 'ok',
        note: 'OK - ' + total + instrumentWord + (age ? ', oldest ' + age : '')
    };
}

/** "Instruments, CTB1 to SWD1" (the snapped ends' names), or "Instruments" when an end floats. */
export function instrumentsHeading(nodes: PopupNode[]): string {
    const start = nodes[0];
    const end = nodes[nodes.length - 1];
    return start && end && start.name && end.name ? 'Instruments, ' + start.name + ' to ' + end.name : 'Instruments';
}

/**
 * The popup's nodes for a line from the map store's items and the live state: the snapped end items,
 * each attached instrument in order with its kind and values, and the open segment's ends highlighted.
 */
export function popupNodes(line: MapItemRecord, items: MapItemRecord[], kinds: Kind[], live: LiveState,
                           segment: SegmentRef | null): PopupNode[] {
    const liveItems = items.filter((i) => !i.deleted);
    const coords = line.geometry.type === 'LineString' ? line.geometry.coordinates : [];
    const nodes = lineNodes(line, instrumentsOn(liveItems, line.id), live, coords.length >= 2 ? lengthM(coords) : 0);
    return nodes.map((n) => {
        const item = liveItems.find((i) => i.id === n.id);
        const kind = item ? kinds.find((k) => k.id === item.kind) : undefined;
        return {
            ...n,
            name: item ? item.name : '',
            icon: kind ? kind.icon : '',
            kindName: kind ? kind.name : item ? item.kind : '',
            values: item ? live.items[item.id] : undefined,
            display: item ? live.display[item.kind] : undefined,
            highlighted: segment !== null && (n.id === segment.fromId || n.id === segment.toId)
        };
    });
}

/** The map item object's instruments (AD-7): id, name, kind, distance and live values, in order. */
export function popupInstruments(nodes: PopupNode[]): Array<{ id: string; name: string; kind: string; distanceM: number; liveValues: unknown }> {
    return nodes.filter((n) => n.role === 'instrument').map((n) => ({
        id: n.id, name: n.name, kind: n.display ? n.display.kindId : n.kindName, distanceM: n.distanceM, liveValues: n.values || null
    }));
}
