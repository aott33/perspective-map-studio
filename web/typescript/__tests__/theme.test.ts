import { drawColor, toHexColor } from '../theme';

describe('toHexColor', () => {
    test('six digit hex passes through, lower cased', () => {
        expect(toHexColor('#A1B2C3')).toBe('#a1b2c3');
    });

    test('three digit hex is expanded', () => {
        expect(toHexColor('#fff')).toBe('#ffffff');
        expect(toHexColor('#0aF')).toBe('#00aaff');
    });

    test('rgb() and rgba() convert, alpha dropped', () => {
        expect(toHexColor('rgb(255, 0, 16)')).toBe('#ff0010');
        expect(toHexColor('rgba(0, 128, 255, 0.5)')).toBe('#0080ff');
        expect(toHexColor('rgb(10 20 30 / 50%)')).toBe('#0a141e');
    });

    test('empty, transparent and nonsense give null', () => {
        expect(toHexColor('')).toBeNull();
        expect(toHexColor(undefined)).toBeNull();
        expect(toHexColor('transparent')).toBeNull();
        expect(toHexColor('var(--label)')).toBeNull();
        expect(toHexColor('blue')).toBeNull();
    });
});

describe('drawColor with no resolvable token (I/O matrix: token missing)', () => {
    test('returns null and warns once per token list', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            // No root (and no getComputedStyle in node): every token resolves to transparent.
            expect(drawColor(null, ['--missing-a', '--missing-b'])).toBeNull();
            expect(drawColor(null, ['--missing-a', '--missing-b'])).toBeNull();
            expect(warn).toHaveBeenCalledTimes(1);
            expect(warn.mock.calls[0][0]).toContain('--missing-a, --missing-b');
        } finally {
            warn.mockRestore();
        }
    });
});
