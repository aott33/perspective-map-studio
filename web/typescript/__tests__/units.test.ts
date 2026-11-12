import { UnitsSetting } from '../contract';
import {
    DistanceUnits, METRIC_UNITS, distanceInput, distanceRangeText, distanceSpan, distanceText, exactDistanceText, readDistance,
    sameUnits, unitsInForce, usesMiles
} from '../geometry';

const M: DistanceUnits = { system: 'metric', labels: 'short' };
const US: DistanceUnits = { system: 'us', labels: 'short' };
const M_LONG: DistanceUnits = { system: 'metric', labels: 'long' };
const US_LONG: DistanceUnits = { system: 'us', labels: 'long' };

function override(system: UnitsSetting['system'], labels: UnitsSetting['labels'] = 'short'): UnitsSetting {
    return { id: 'units', system, labels, version: 1, deleted: false };
}

describe('the one formatter (epic 4 entry 20a, geometry.ts distanceText)', () => {
    test('F1 metric, short: metres to 10 under a kilometre, tenths under 10 km, whole above', () => {
        expect(distanceText(2922, M)).toBe('2.9 km');
        expect(distanceText(1143, M)).toBe('1.1 km');
        expect(distanceText(700, M)).toBe('700 m');
        expect(distanceText(0, M)).toBe('0 m');
        expect(distanceText(12400, M)).toBe('12 km');
        expect(distanceText(423, M)).toBe('420 m');
        expect(distanceText(2000, M)).toBe('2 km');
        expect(distanceText(996, M)).toBe('1 km');
        expect(distanceText(9970, M)).toBe('10 km');
        expect(distanceText(2841, M)).toBe('2.8 km');
    });

    test('F2 US, short: feet to 10 under a mile, tenths under 10 mi, whole above', () => {
        expect(distanceText(2922, US)).toBe('1.8 mi');
        expect(distanceText(1143, US)).toBe('3,750 ft');
        expect(distanceText(30, US)).toBe('100 ft');
        expect(distanceText(0, US)).toBe('0 ft');
        expect(distanceText(480, US)).toBe('1,570 ft');
        expect(distanceText(3701, US)).toBe('2.3 mi');
        expect(distanceText(19312, US)).toBe('12 mi');
        expect(distanceText(16050, US)).toBe('10 mi');
    });

    test('F3 long labels, singular at exactly 1', () => {
        expect(distanceText(2922, M_LONG)).toBe('2.9 kilometres');
        expect(distanceText(1609.3, US_LONG)).toBe('1 mile');
        expect(distanceText(1143, US_LONG)).toBe('3,750 feet');
        expect(distanceText(1000, M_LONG)).toBe('1 kilometre');
        expect(distanceText(700, M_LONG)).toBe('700 metres');
        expect(distanceText(0, US_LONG)).toBe('0 feet');
    });

    test('what is not a distance reads as none', () => {
        expect(distanceText(-5, M)).toBe('0 m');
        expect(distanceText(NaN, M)).toBe('0 m');
        expect(distanceText(Infinity, US)).toBe('0 ft');
    });
});

describe('the units in force (F4)', () => {
    test('en-US counts in miles, everything else in kilometres', () => {
        expect(usesMiles('en-US')).toBe(true);
        expect(usesMiles('en-us')).toBe(true);
        expect(usesMiles('en-GB')).toBe(false);
        expect(usesMiles('fr-CA')).toBe(false);
        expect(usesMiles('')).toBe(false);
    });

    test('the live override, else the setup, else the locale', () => {
        expect(unitsInForce(override('us'), 'metric', 'en-GB')).toEqual(US);
        expect(unitsInForce(null, 'metric', 'en-US')).toEqual(M);
        expect(unitsInForce(null, 'auto', 'en-US')).toEqual(US);
        expect(unitsInForce(override('auto'), 'metric', 'en-GB')).toEqual(M);
        expect(unitsInForce(override('auto'), 'metric', 'en-US')).toEqual(US);
        expect(unitsInForce(null, 'us', 'de-DE')).toEqual(US);
        expect(unitsInForce(null, 'auto', 'de-DE')).toEqual(M);
    });

    test('the override carries its labels; the setup reads short', () => {
        expect(unitsInForce(override('us', 'long'), 'metric', '')).toEqual(US_LONG);
        expect(unitsInForce(override('metric', 'long'), 'us', '')).toEqual(M_LONG);
    });

    test('a cleared override and a missing setup fall back', () => {
        expect(unitsInForce({ ...override('us', 'long'), deleted: true }, 'metric', 'en-US')).toEqual(M);
        expect(unitsInForce(null, undefined, 'en-US')).toEqual(US);
        expect(unitsInForce(null, undefined, '')).toEqual(M);
        expect(METRIC_UNITS).toEqual(M);
    });

    test('sameUnits compares the two parts', () => {
        expect(sameUnits(M, { system: 'metric', labels: 'short' })).toBe(true);
        expect(sameUnits(M, M_LONG)).toBe(false);
        expect(sameUnits(M, US)).toBe(false);
    });
});

describe('the exact form, where a distance is typed (F5)', () => {
    test('whole metres or whole feet, never the large unit', () => {
        expect(exactDistanceText(2922.35, M)).toBe('2,922 m');
        expect(exactDistanceText(2922.35, US)).toBe('9,588 ft');
        expect(exactDistanceText(2922.35, US_LONG)).toBe('9,588 feet');
        expect(exactDistanceText(2922.35, M_LONG)).toBe('2,922 metres');
        expect(exactDistanceText(1, M_LONG)).toBe('1 metre');
        expect(exactDistanceText(0.3048, US_LONG)).toBe('1 foot');
        expect(exactDistanceText(0, US)).toBe('0 ft');
        expect(exactDistanceText(NaN, M)).toBe('0 m');
    });

    test('the range words in the shown unit', () => {
        expect(distanceRangeText(2922.35, M)).toBe('Type a distance from 0 to 2,922 m');
        expect(distanceRangeText(2922.35, US)).toBe('Type a distance from 0 to 9,588 ft');
    });

    test('the field shows the stored metres converted', () => {
        expect(distanceInput(1143, US)).toBe('3,750');
        expect(distanceInput(1143, M)).toBe('1143');
        expect(distanceInput(1143.5, M)).toBe('1143.5');
        expect(distanceInput(2000, M)).toBe('2000');
        expect(distanceInput(2841, US)).toBe('9,320.9');
        expect(distanceInput(0, US)).toBe('0');
    });
});

describe('a typed distance (F6, F7)', () => {
    const LENGTH = 2922.35;

    test('F6 a bare number is in the shown unit; a typed m or ft is honoured whichever is shown', () => {
        expect(readDistance('3750', LENGTH, US)).toEqual({ distanceM: 1143 });
        expect(readDistance('3750 ft', LENGTH, US)).toEqual({ distanceM: 1143 });
        expect(readDistance('1143 m', LENGTH, US)).toEqual({ distanceM: 1143 });
        expect(readDistance('3,750', LENGTH, US)).toEqual({ distanceM: 1143 });
        expect(readDistance('3750 ft', LENGTH, M)).toEqual({ distanceM: 1143 });
        expect(readDistance('3750 feet', LENGTH, M)).toEqual({ distanceM: 1143 });
        expect(readDistance('1143', LENGTH, M)).toEqual({ distanceM: 1143 });
        expect(readDistance('1,143.5', LENGTH, M)).toEqual({ distanceM: 1143.5 });
        expect(readDistance('2841m', LENGTH, M)).toEqual({ distanceM: 2841 });
        expect(readDistance('1143 metres', LENGTH, US)).toEqual({ distanceM: 1143 });
        expect(readDistance('0', LENGTH, US)).toEqual({ distanceM: 0 });
    });

    test('the shown value typed back stores what was stored', () => {
        expect(readDistance(distanceInput(1143, US), LENGTH, US)).toEqual({ distanceM: 1143 });
        expect(readDistance(distanceInput(2841, US), LENGTH, US)).toEqual({ distanceM: 2841 });
        expect(readDistance(distanceInput(2000, US), LENGTH, US)).toEqual({ distanceM: 2000 });
    });

    test('the end as the bar shows it is the end', () => {
        expect(readDistance('2922', LENGTH, M)).toEqual({ distanceM: 2922 });
        expect(readDistance('2922.6', LENGTH, M)).toEqual({ distanceM: 2922.35 });
        expect(readDistance('9588', LENGTH, US)).toEqual({ distanceM: 2922.35 });
    });

    test('F7 what is not a distance on the line is refused, the range in the shown unit', () => {
        const metric = { problem: 'Type a distance from 0 to 2,922 m' };
        const us = { problem: 'Type a distance from 0 to 9,588 ft' };
        expect(readDistance('abc', LENGTH, M)).toEqual(metric);
        expect(readDistance('', LENGTH, M)).toEqual(metric);
        expect(readDistance('   ', LENGTH, US)).toEqual(us);
        expect(readDistance('-5', LENGTH, M)).toEqual(metric);
        expect(readDistance('3000', LENGTH, M)).toEqual(metric);
        expect(readDistance('9600', LENGTH, US)).toEqual(us);
        expect(readDistance('3000 m', LENGTH, US)).toEqual(us);
        expect(readDistance('12 km', LENGTH, M)).toEqual(metric);
        expect(readDistance('1e3', LENGTH, M)).toEqual(metric);
        expect(readDistance('Infinity', LENGTH, M)).toEqual(metric);
    });
});

describe('a span between two distances (F10)', () => {
    test('the unit named once when both read in it', () => {
        expect(distanceSpan(1143, 2000, M)).toBe('1.1 to 2 km');
        expect(distanceSpan(700, 1143, M)).toBe('700 m to 1.1 km');
        expect(distanceSpan(0, 1143, M)).toBe('0 to 1.1 km');
        expect(distanceSpan(0, 1143, US)).toBe('0 to 3,750 ft');
        expect(distanceSpan(100, 700, M)).toBe('100 to 700 m');
        expect(distanceSpan(1143, 2000, US)).toBe('3,750 ft to 1.2 mi');
        expect(distanceSpan(2000, 2841, US)).toBe('1.2 to 1.8 mi');
    });

    test('long labels: the unit of the second, once', () => {
        expect(distanceSpan(1143, 2000, M_LONG)).toBe('1.1 to 2 kilometres');
        expect(distanceSpan(1609.344, 3218.688, US_LONG)).toBe('1 to 2 miles');
        expect(distanceSpan(700, 1000, M_LONG)).toBe('700 metres to 1 kilometre');
    });
});
