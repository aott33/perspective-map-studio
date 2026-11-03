/**
 * The theme watch (owner review notes item 29; AD-11): the map reads its colours from the theme's
 * tokens once, as MapLibre paint cannot take `var()`, so a theme that changes after the map mounted
 * (the `/dark` page's startup script, a session theme switch) left the map in the old colours until a
 * reload. The watch keeps a snapshot of the tokens' computed values and calls `onChange` when a reading
 * differs: it reads right after a change to the document head's stylesheets (Perspective swaps the
 * theme's stylesheet there) and a few more times while the new sheet loads, and on a slow poll in
 * case the theme comes some other way. The component then re-reads the colours and redraws. The
 * snapshot and the compare are pure; the observer and the timers are the browser's.
 */

import { themeColor } from './theme';

/** The readings after a head change (ms): at once, then while the new stylesheet loads. */
export const THEME_RECHECK_MS: readonly number[] = [0, 250, 1000, 3000];
/** The slow poll. */
export const THEME_POLL_MS = 4000;

/** The computed values of `tokens` on `root`, joined, so two readings compare as strings. */
export function tokenSnapshot(root: Element | null | undefined, tokens: readonly string[]): string {
    return tokens.map((t) => themeColor(root, t)).join('|');
}

export class ThemeWatch {
    private snapshot: string;
    private observer: MutationObserver | null = null;
    private poll: ReturnType<typeof setInterval> | null = null;
    private rechecks: Array<ReturnType<typeof setTimeout>> = [];

    constructor(private readonly root: Element | null | undefined, private readonly tokens: readonly string[],
                private readonly onChange: () => void) {
        this.snapshot = tokenSnapshot(root, tokens);
    }

    start(): void {
        if (typeof document === 'undefined') {
            return;
        }
        if (typeof MutationObserver !== 'undefined' && document.head && this.observer === null) {
            this.observer = new MutationObserver(() => this.scheduleRechecks());
            this.observer.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'disabled', 'media'] });
        }
        if (this.poll === null) {
            this.poll = setInterval(() => this.check(), THEME_POLL_MS);
        }
    }

    stop(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.poll !== null) {
            clearInterval(this.poll);
            this.poll = null;
        }
        this.rechecks.forEach((t) => clearTimeout(t));
        this.rechecks = [];
    }

    /** Readings at once and while a new stylesheet loads. */
    private scheduleRechecks(): void {
        this.rechecks.forEach((t) => clearTimeout(t));
        this.rechecks = THEME_RECHECK_MS.map((ms) => setTimeout(() => this.check(), ms));
    }

    /** One reading; `onChange` when it differs from the last. Exposed for the tests. */
    check(): boolean {
        const now = tokenSnapshot(this.root, this.tokens);
        if (now === this.snapshot) {
            return false;
        }
        this.snapshot = now;
        this.onChange();
        return true;
    }
}
