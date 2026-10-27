import { isRecord } from '../json';

describe('isRecord', () => {
    it('accepts a plain object and refuses null, arrays and primitives', () => {
        expect(isRecord({})).toBe(true);
        expect(isRecord({ a: 1 })).toBe(true);
        expect(isRecord(null)).toBe(false);
        expect(isRecord([])).toBe(false);
        expect(isRecord('x')).toBe(false);
        expect(isRecord(1)).toBe(false);
        expect(isRecord(undefined)).toBe(false);
    });
});
