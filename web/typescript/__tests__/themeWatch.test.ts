import { THEME_POLL_MS, THEME_RECHECK_MS, ThemeWatch, tokenSnapshot } from '../themeWatch';

const TOKENS = ['--neutral-20', '--mapstudio-alarm-1'];

/** A stand-in element whose custom properties the stubbed getComputedStyle reads (the suite runs in node). */
interface FakeRoot {
    vars: Record<string, string>;
}

function rootWith(vars: Record<string, string>): FakeRoot {
    return { vars };
}

/** The observers the stubbed MutationObserver registered, so a test can fire a head change. */
const observers: Array<() => void> = [];
const g = globalThis as unknown as Record<string, unknown>;

beforeAll(() => {
    g.getComputedStyle = (el: FakeRoot) => ({ getPropertyValue: (token: string) => el.vars[token] || '' });
    g.document = { head: {} };
    g.MutationObserver = class {
        private readonly cb: () => void;
        constructor(cb: () => void) {
            this.cb = cb;
        }
        observe(): void {
            observers.push(this.cb);
        }
        disconnect(): void {
            observers.splice(observers.indexOf(this.cb), 1);
        }
    };
});

afterAll(() => {
    delete g.getComputedStyle;
    delete g.document;
    delete g.MutationObserver;
});

describe('the theme watch (owner review notes item 29)', () => {
    test('the snapshot joins the computed tokens; a missing token reads transparent', () => {
        const root = rootWith({ '--neutral-20': '#f4f4f4' });
        expect(tokenSnapshot(root as unknown as Element, TOKENS)).toBe('#f4f4f4|transparent');
        expect(tokenSnapshot(null, TOKENS)).toBe('transparent|transparent');
    });

    test('check reports a change once and calls onChange; the same reading is quiet', () => {
        const root = rootWith({ '--neutral-20': '#f4f4f4', '--mapstudio-alarm-1': 'red' });
        let changes = 0;
        const watch = new ThemeWatch(root as unknown as Element, TOKENS, () => changes++);
        expect(watch.check()).toBe(false);
        root.vars['--neutral-20'] = '#202020';
        expect(watch.check()).toBe(true);
        expect(watch.check()).toBe(false);
        expect(changes).toBe(1);
    });

    test('a stylesheet change in the head makes the watch read again while the sheet loads; the slow poll reads anyway; stop ends both', () => {
        jest.useFakeTimers();
        try {
            const root = rootWith({ '--neutral-20': '#f4f4f4' });
            let changes = 0;
            const watch = new ThemeWatch(root as unknown as Element, TOKENS, () => changes++);
            watch.start();
            expect(observers).toHaveLength(1);
            // The theme stylesheet is swapped (a head mutation); its values arrive a moment later.
            observers[0]();
            jest.advanceTimersByTime(THEME_RECHECK_MS[1] + 1);
            expect(changes).toBe(0);
            root.vars['--neutral-20'] = '#202020';
            jest.advanceTimersByTime(THEME_RECHECK_MS[THEME_RECHECK_MS.length - 1]);
            expect(changes).toBe(1);
            // A change with no head mutation: the poll finds it.
            root.vars['--neutral-20'] = '#303030';
            jest.advanceTimersByTime(THEME_POLL_MS + 1);
            expect(changes).toBe(2);
            watch.stop();
            expect(observers).toHaveLength(0);
            root.vars['--neutral-20'] = '#404040';
            jest.advanceTimersByTime(THEME_POLL_MS * 2);
            expect(changes).toBe(2);
        } finally {
            jest.useRealTimers();
        }
    });
});
