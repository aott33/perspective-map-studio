import { ItemState } from '../live';
import { SHARED_M, distanceM, groupShared, sharedName, sharedState } from '../shared';

const NORMAL: ItemState = { commsLost: false, stale: false, alarm: null, iconKpi: { key: 'p', text: '1 psi', stale: false }, badge: 'normal' };
const STALE: ItemState = { ...NORMAL, stale: true, badge: 'stale' };
const LOST: ItemState = { ...NORMAL, commsLost: true, stale: true, badge: 'comms-lost' };
const ALARM2: ItemState = { ...NORMAL, alarm: { priority: 2, unacked: false, active: 1, stale: false }, badge: 'alarm' };
const ALARM2U: ItemState = { ...NORMAL, alarm: { priority: 2, unacked: true, active: 1, stale: false }, badge: 'alarm' };
const ALARM1: ItemState = { ...NORMAL, alarm: { priority: 1, unacked: false, active: 1, stale: false }, badge: 'alarm' };

/** A position `metres` east of `from` at that latitude. */
function east(from: [number, number], metres: number): [number, number] {
    return [from[0] + metres / (111320 * Math.cos((from[1] * Math.PI) / 180)), from[1]];
}

describe('shared markers (epic 3 entry 7, the template\'s section 5 item 8)', () => {
    const base: [number, number] = [-104.9725, 39.7445];

    test('points within 20 m share one marker; one 25 m away does not; a chain joins', () => {
        expect(SHARED_M).toBe(20);
        expect(distanceM(base, east(base, 15))).toBeCloseTo(15, 0);
        const points = [
            { id: 'a', name: 'A', lngLat: base },
            { id: 'b', name: 'B', lngLat: east(base, 15) },
            { id: 'c', name: 'C', lngLat: east(base, 25) },
            { id: 'd', name: 'D', lngLat: east(base, 33) },
            { id: 'e', name: 'E', lngLat: [base[0], base[1] + 0.01] as [number, number] }
        ];
        const groups = groupShared(points).map((g) => g.map((p) => p.id));
        // c is 10 m from b, 8 m from d: the chain a, b, c, d is one marker.
        expect(groups).toEqual([['a', 'b', 'c', 'd'], ['e']]);
        expect(groupShared([points[0], points[2]]).map((g) => g.map((p) => p.id))).toEqual([['a'], ['c']]);
        expect(groupShared([])).toEqual([]);
    });

    test('the names as one', () => {
        expect(sharedName([])).toBe('');
        expect(sharedName(['A'])).toBe('A');
        expect(sharedName(['CTB1', 'SWD1'])).toBe('CTB1 and SWD1');
        expect(sharedName(['A', 'B', 'C'])).toBe('A, B and C');
    });

    test('the worst state: the highest alarm (unacknowledged first at one priority), comms lost, stale, normal; no KPI', () => {
        expect(sharedState([NORMAL, NORMAL])).toEqual({ commsLost: false, stale: false, alarm: null, iconKpi: null, badge: 'normal' });
        expect(sharedState([NORMAL, STALE])).toMatchObject({ stale: true, badge: 'stale' });
        expect(sharedState([STALE, LOST])).toMatchObject({ commsLost: true, stale: true, badge: 'comms-lost' });
        expect(sharedState([LOST, ALARM2])).toMatchObject({ alarm: ALARM2.alarm, commsLost: true, badge: 'alarm' });
        expect(sharedState([ALARM2, ALARM2U]).alarm).toBe(ALARM2U.alarm);
        expect(sharedState([ALARM2U, ALARM1]).alarm).toBe(ALARM1.alarm);
    });
});
