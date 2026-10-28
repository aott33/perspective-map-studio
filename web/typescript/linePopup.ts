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
import { ItemState, ItemValues, KindDisplay, LiveState, LiveValue, ageText, iconKpiOf, itemState, valueText } from './live';

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

/** What a node's value cell says: its icon KPI with the unit, "No value", or the stale form "Stale - 371 psi (last)". */
export interface NodeValue {
    text: string;
    stale: boolean;
    hasValue: boolean;
    /** The number and its unit, for the segment's drop line; null when the value is not a number. */
    number: number | null;
    unit: string;
    /** The value's time, for the comms line's ages. */
    t: string | null;
    alarm: ItemState['alarm'];
    commsLost: boolean;
}

export function nodeValue(node: PopupNode): NodeValue {
    const kpi = iconKpiOf(node.display);
    const value: LiveValue | undefined = kpi && node.values ? node.values.kpis[kpi.key] : undefined;
    const state = itemState(node.values, node.display);
    const unit = kpi ? kpi.unit : '';
    if (!kpi || !value) {
        return { text: 'No value', stale: false, hasValue: false, number: null, unit, t: null, alarm: state.alarm, commsLost: state.commsLost };
    }
    const hasValue = value.value !== null && value.value !== undefined;
    const number = typeof value.value === 'number' && isFinite(value.value) ? value.value : null;
    const plain = hasValue ? valueText(value, unit) : 'No value';
    return {
        text: value.stale ? 'Stale - ' + plain + (hasValue ? ' (last)' : '') : plain,
        stale: value.stale, hasValue, number: value.stale ? null : number, unit, t: value.t, alarm: state.alarm, commsLost: state.commsLost
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
    if (!segment) {
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

/**
 * The comms line over the line's instruments: "OK - 4 instruments, oldest 9 s ago", or the first
 * stale or comms-lost instrument, "PT-2 stale - last 18 min ago"; null with no instrument on the line.
 */
export function instrumentsComms(nodes: PopupNode[], now: number): { word: string; detail: string; lost: boolean } | null {
    const instruments = nodes.filter((n) => n.role === 'instrument');
    if (instruments.length === 0) {
        return null;
    }
    for (const n of instruments) {
        const v = nodeValue(n);
        if (v.commsLost) {
            const age = ageText(n.values && n.values.comms ? n.values.comms.t : null, now);
            return { word: n.name + ' comms lost', detail: age ? 'last ' + age : '', lost: true };
        }
        if (v.stale) {
            const age = ageText(v.t, now);
            return { word: n.name + ' stale', detail: age ? 'last ' + age : '', lost: true };
        }
    }
    let oldest = Infinity;
    for (const n of instruments) {
        const t = nodeValue(n).t;
        const at = t ? Date.parse(t) : NaN;
        if (isFinite(at) && at < oldest) {
            oldest = at;
        }
    }
    const count = instruments.length === 1 ? '1 instrument' : instruments.length + ' instruments';
    const age = isFinite(oldest) ? ageText(new Date(oldest).toISOString(), now) : '';
    return { word: 'OK', detail: count + (age ? ', oldest ' + age : ''), lost: false };
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
