/**
 * The Needs you bar and its ranked list (epic 3 entry 3, R15; DESIGN.md needs-you-bar, phone top
 * bar; EXPERIENCE.md Needs you bar; owner review item 12): the bar sits in the top bar's row after the
 * search field (`SearchControl.slot()`) and its list goes under the row in the top bar's container, so on a
 * desktop the list is a card under the bar and at phone width it expands inside the one top bar as
 * the search results do. The bar is a button with no words at any width, only glyphs and numbers: a bell
 * with the count of the items in alarm (acknowledged included, as the list counts them), solid in the hue of
 * the highest unacknowledged priority, hollow and neutral when every alarm is acknowledged; then the
 * comms-lost glyph and its count, then the hourglass and its count (the two only while they are not zero);
 * with nothing to attend to a grey hollow bell alone, no number. The words stay in the button's label and
 * hover title ("Needs you 3: 1 alarm, 1 comms lost, 1 stale") and in the opened list, a region named
 * "Needs you" with one row per item, ranked (needsyou.ts): the rank, the state glyph, the name and kind,
 * the state in words, detail and age.
 *
 * While the Gateway cannot be reached the component calls `setUnknown(true)`: the bar shows the hollow bell
 * with a question mark and no counts (`data-state="unknown"`), so a frozen count is never read as live
 * (owner review item 32, group c's hook).
 *
 * Keyboard: the bar toggles the list (Enter or Space, as a button); opening moves the focus to the
 * first row; ArrowDown and ArrowUp move between rows and wrap, Home and End jump; Enter or a click
 * chooses a row; Esc closes the list and returns the focus to the bar. The list's DOM exists only
 * while it is open. The component owns the choice (`onChoose`) and reports open or closed
 * (`onToggle`, for `data-needs-open`). Token colours only, in mapstudio.css; 44 px targets at
 * phone width.
 */

import { glyphSvg } from './controls';
import { EMPTY_SUMMARY, NOTHING_NEEDS_YOU, NeedsYouRow, NeedsYouSummary, RANKED_NOTE, barModel, total } from './needsyou';

/** The sprite the state and kind glyphs come from, as the default popup draws them (DefaultPopup.tsx). */
const SPRITE_URL = '/res/mapstudio/icons/mapstudio-icons.svg';
const SVG_NS = 'http://www.w3.org/2000/svg';

/** A sprite symbol inline through `<use>`, in `currentColor`, hidden from assistive technology. */
function spriteGlyph(id: string, className: string, size: number): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', className);
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', SPRITE_URL + '#ms-' + id);
    svg.appendChild(use);
    return svg;
}

export class NeedsYouControl {
    private bar: HTMLButtonElement | null = null;
    private host: HTMLElement | null = null;
    private panel: HTMLDivElement | null = null;
    private summary: NeedsYouSummary = EMPTY_SUMMARY;
    private unknown = false;
    private readonly panelId = 'mapstudio-needs-' + Math.random().toString(36).slice(2, 8);

    constructor(private readonly onChoose: (row: NeedsYouRow) => void, private readonly onToggle: (open: boolean) => void) {}

    /** Put the bar into `slot` (the top bar's row) and keep `host` (the top bar's container) for the list. */
    mount(slot: HTMLElement, host: HTMLElement): void {
        const bar = document.createElement('button');
        bar.type = 'button';
        bar.className = 'mapstudio-needs';
        bar.setAttribute('aria-expanded', 'false');
        bar.setAttribute('aria-controls', this.panelId);
        bar.addEventListener('click', this.handleToggle);
        bar.addEventListener('keydown', this.handleBarKeyDown);
        slot.appendChild(bar);
        this.bar = bar;
        this.host = host;
        this.renderBar();
    }

    unmount(): void {
        this.close(false);
        if (this.bar) {
            this.bar.removeEventListener('click', this.handleToggle);
            this.bar.removeEventListener('keydown', this.handleBarKeyDown);
            if (this.bar.parentNode) {
                this.bar.parentNode.removeChild(this.bar);
            }
        }
        this.bar = null;
        this.host = null;
    }

    /** The summary of the last batch: the bar follows, and an open list is drawn again. */
    setSummary(summary: NeedsYouSummary): void {
        this.summary = summary;
        this.renderBar();
        if (this.panel) {
            this.renderList();
        }
    }

    /**
     * The state is unknown (the Gateway cannot be reached, item 32): the bar shows a hollow bell with a question mark
     * and no counts, `data-state="unknown"`, until `setUnknown(false)`. The summary is kept and shows again then.
     */
    setUnknown(unknown: boolean): void {
        if (this.unknown === unknown) {
            return;
        }
        this.unknown = unknown;
        this.renderBar();
    }

    isOpen(): boolean {
        return this.panel !== null;
    }

    /** Open the list under the bar and move the focus to its first row (or its one line). */
    open(): void {
        if (this.panel || !this.host || !this.bar) {
            return;
        }
        const panel = document.createElement('div');
        panel.id = this.panelId;
        panel.className = 'mapstudio-topbar-panel mapstudio-needs-panel';
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'Needs you');
        panel.addEventListener('keydown', this.handlePanelKeyDown);
        this.host.appendChild(panel);
        this.panel = panel;
        this.bar.setAttribute('aria-expanded', 'true');
        this.renderList();
        const first = panel.querySelector('.mapstudio-needs-row') as HTMLElement | null;
        if (first) {
            first.focus();
        } else {
            panel.tabIndex = -1;
            panel.focus();
        }
        this.onToggle(true);
    }

    /** Close the list; with `focusBar` the bar takes the focus back (Esc). */
    close(focusBar: boolean): void {
        if (!this.panel) {
            return;
        }
        this.panel.removeEventListener('keydown', this.handlePanelKeyDown);
        this.rowsOf().forEach((row) => row.removeEventListener('click', this.handleRowClick));
        if (this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }
        this.panel = null;
        if (this.bar) {
            this.bar.setAttribute('aria-expanded', 'false');
            if (focusBar) {
                this.bar.focus();
            }
        }
        this.onToggle(false);
    }

    /** One count of the bar: its glyph and its number (the number is left out of the quiet bell). */
    private count(kind: string, glyph: string, n: string): HTMLSpanElement {
        const count = document.createElement('span');
        count.className = 'mapstudio-needs-count mapstudio-needs-count--' + kind;
        count.setAttribute('data-kind', kind);
        count.appendChild(spriteGlyph(glyph, 'mapstudio-needs-glyph', 18));
        if (n !== '') {
            const number = document.createElement('span');
            number.className = 'mapstudio-needs-count-n';
            number.textContent = n;
            count.appendChild(number);
        }
        return count;
    }

    private renderBar(): void {
        const bar = this.bar;
        if (!bar) {
            return;
        }
        while (bar.firstChild) {
            bar.removeChild(bar.firstChild);
        }
        const model = barModel(this.summary, this.unknown);
        bar.setAttribute('data-count', String(total(this.summary.counts)));
        bar.setAttribute('data-state', model.state);
        bar.setAttribute('data-priority', String(this.summary.highestPriority));
        bar.setAttribute('data-bell', model.bell);
        bar.classList.toggle('mapstudio-needs--ok', model.state === 'ok');
        bar.classList.toggle('mapstudio-needs--unknown', model.state === 'unknown');
        // The words are the label and the hover title only; nothing in the bar is text but the numbers.
        bar.title = model.label;
        bar.setAttribute('aria-label', model.label);
        for (const count of model.counts) {
            bar.appendChild(this.count(count.kind, count.glyph, count.n));
        }
        bar.insertAdjacentHTML('beforeend', glyphSvg('chevron', 'mapstudio-ctrl-glyph mapstudio-needs-chevron'));
    }

    private renderList(): void {
        const panel = this.panel;
        if (!panel) {
            return;
        }
        // A batch redraws an open list: the row that had the focus keeps it (by its place).
        const focused = this.rowsOf().indexOf(document.activeElement as HTMLElement);
        this.rowsOf().forEach((row) => row.removeEventListener('click', this.handleRowClick));
        while (panel.firstChild) {
            panel.removeChild(panel.firstChild);
        }
        const rows = this.summary.rows;
        panel.setAttribute('data-rows', String(rows.length));
        const note = document.createElement('div');
        note.className = 'mapstudio-needs-note';
        note.textContent = rows.length === 0 ? NOTHING_NEEDS_YOU : RANKED_NOTE;
        panel.appendChild(note);
        if (rows.length === 0) {
            return;
        }
        const list = document.createElement('div');
        list.className = 'mapstudio-needs-list';
        list.setAttribute('role', 'list');
        rows.forEach((row, i) => {
            const item = document.createElement('div');
            item.setAttribute('role', 'listitem');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'mapstudio-needs-row';
            button.setAttribute('data-item-id', row.id);
            button.setAttribute('data-state', row.state);
            button.setAttribute('data-rank', String(i + 1));
            button.setAttribute('data-index', String(i));
            button.title = row.name + ': ' + row.words;
            const rank = document.createElement('span');
            rank.className = 'mapstudio-needs-rank';
            rank.textContent = String(i + 1);
            button.appendChild(rank);
            const glyph = spriteGlyph(row.glyph, 'mapstudio-needs-row-glyph mapstudio-needs-row-glyph--' + row.state
                + (row.priority > 0 ? ' mapstudio-needs-row-glyph--p' + row.priority : ''), 20);
            button.appendChild(glyph);
            const text = document.createElement('span');
            text.className = 'mapstudio-needs-text';
            const title = document.createElement('span');
            title.className = 'mapstudio-needs-title';
            const name = document.createElement('span');
            name.className = 'mapstudio-needs-name';
            name.textContent = row.name;
            title.appendChild(name);
            const kind = document.createElement('span');
            kind.className = 'mapstudio-needs-kind';
            kind.textContent = row.kindName;
            title.appendChild(kind);
            text.appendChild(title);
            const words = document.createElement('span');
            words.className = 'mapstudio-needs-state';
            words.textContent = row.words;
            text.appendChild(words);
            if (row.detail !== '') {
                const detail = document.createElement('span');
                detail.className = 'mapstudio-needs-detail';
                detail.textContent = row.detail;
                text.appendChild(detail);
            }
            button.appendChild(text);
            button.addEventListener('click', this.handleRowClick);
            item.appendChild(button);
            list.appendChild(item);
        });
        panel.appendChild(list);
        if (focused >= 0) {
            const again = this.rowsOf();
            again[Math.min(focused, again.length - 1)].focus();
        }
    }

    private rowsOf(): HTMLElement[] {
        return this.panel ? Array.from(this.panel.querySelectorAll('.mapstudio-needs-row')) as HTMLElement[] : [];
    }

    private choose(index: number): void {
        const row = this.summary.rows[index];
        if (!row) {
            return;
        }
        this.close(false);
        this.onChoose(row);
    }

    private handleToggle = (ev: MouseEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        if (this.panel) {
            this.close(false);
        } else {
            this.open();
        }
    };

    private handleRowClick = (ev: MouseEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        const index = Number((ev.currentTarget as HTMLElement).getAttribute('data-index'));
        if (Number.isFinite(index)) {
            this.choose(index);
        }
    };

    private handleBarKeyDown = (ev: KeyboardEvent): void => {
        if (ev.key === 'Escape' && this.panel) {
            ev.preventDefault();
            ev.stopPropagation();
            this.close(true);
        } else if (ev.key === 'ArrowDown' && !this.panel) {
            ev.preventDefault();
            this.open();
        }
    };

    private handlePanelKeyDown = (ev: KeyboardEvent): void => {
        const rows = this.rowsOf();
        const n = rows.length;
        const active = rows.indexOf(document.activeElement as HTMLElement);
        switch (ev.key) {
            case 'Escape':
                ev.preventDefault();
                ev.stopPropagation();
                this.close(true);
                break;
            case 'ArrowDown':
                if (n > 0) {
                    ev.preventDefault();
                    rows[active < 0 ? 0 : (active + 1) % n].focus();
                }
                break;
            case 'ArrowUp':
                if (n > 0) {
                    ev.preventDefault();
                    rows[active <= 0 ? n - 1 : active - 1].focus();
                }
                break;
            case 'Home':
                if (n > 0) {
                    ev.preventDefault();
                    rows[0].focus();
                }
                break;
            case 'End':
                if (n > 0) {
                    ev.preventDefault();
                    rows[n - 1].focus();
                }
                break;
            default:
                break;
        }
    };
}
