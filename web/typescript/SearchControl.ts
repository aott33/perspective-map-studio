/**
 * The search field (epic 3 entry 9, R4; DESIGN.md search-field, Phone top bar; EXPERIENCE.md Search):
 * one MapLibre control top-left that is the View-mode top bar. Its row holds the search field first
 * (a glyph, the input and a Clear button while there is text) and leaves a slot after it, where entry 3
 * puts the Needs you summary (NeedsYouControl, whose list opens under the row too); below the row a panel opens with the results while the field has text
 * and focus, or says "No matches". On a desktop the field and the panel are two floating cards; at
 * phone width the control is the one top bar, 8 px from the edges, and the panel expands inside it.
 *
 * The input is an ARIA combobox over a listbox: `aria-expanded`, `aria-controls`, `aria-autocomplete`
 * and `aria-activedescendant` on the input; `role="option"` and `aria-selected` on the rows. Arrow
 * keys move the active row (wrapping), Home and End jump, Enter chooses the active row (the first
 * when none is active), Esc clears the text and closes the list, Tab or a click elsewhere closes it
 * (a press on a row keeps the focus in the input, so the click reaches the row). After a choice the
 * text is cleared, a polite live region says "<name> selected", the focus goes where the choice
 * leads (into a chosen point's popup, as MapLibre opens it; it stays here for a line), and at phone
 * width the input gives the focus up so the keyboard goes away. The component owns the choice; this
 * control reports it through `onChoose` and takes the entries through `setEntries`. Token colours
 * only, in mapstudio.css; 44 px targets at phone width.
 */

import { IControl, Map as MapLibreMap } from 'maplibre-gl';
import { glyphSvg } from './controls';
import { NO_MATCHES, SEARCH_PLACEHOLDER, SearchEntry, SearchResult, chosenText, searchEntries } from './search';

/** The width below which the control is the phone top bar (the stylesheet's phone breakpoint). */
const PHONE_QUERY = '(max-width: 767px)';

/** The sprite the kind glyphs come from, as the default popup draws them (DefaultPopup.tsx). */
const SPRITE_URL = '/res/mapstudio/icons/mapstudio-icons.svg';

export class SearchControl implements IControl {
    private container: HTMLDivElement | null = null;
    private row: HTMLDivElement | null = null;
    private field: HTMLDivElement | null = null;
    private input: HTMLInputElement | null = null;
    private clearButton: HTMLButtonElement | null = null;
    private panel: HTMLDivElement | null = null;
    private status: HTMLDivElement | null = null;
    private entries: SearchEntry[] = [];
    private results: SearchResult[] = [];
    private active = -1;
    private readonly listId = 'mapstudio-search-list-' + Math.random().toString(36).slice(2, 8);

    constructor(private readonly onChoose: (result: SearchResult) => void, private readonly onToggle: (open: boolean) => void) {}

    onAdd(_map: MapLibreMap): HTMLElement {
        const container = document.createElement('div');
        container.className = 'maplibregl-ctrl mapstudio-topbar';
        container.setAttribute('data-search-open', 'false');
        const row = document.createElement('div');
        row.className = 'mapstudio-topbar-row';
        const field = document.createElement('div');
        field.className = 'mapstudio-search-field';
        field.setAttribute('role', 'search');
        field.setAttribute('aria-label', 'Search the map');
        field.innerHTML = glyphSvg('search', 'mapstudio-ctrl-glyph mapstudio-search-glyph');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'mapstudio-search-input';
        input.placeholder = SEARCH_PLACEHOLDER;
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-label', SEARCH_PLACEHOLDER);
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-haspopup', 'listbox');
        input.setAttribute('aria-expanded', 'false');
        input.setAttribute('aria-controls', this.listId);
        input.setAttribute('enterkeyhint', 'search');
        input.addEventListener('input', this.handleInput);
        input.addEventListener('keydown', this.handleKeyDown);
        input.addEventListener('focus', this.handleFocus);
        input.addEventListener('blur', this.handleBlur);
        field.appendChild(input);
        row.appendChild(field);
        container.appendChild(row);
        const status = document.createElement('div');
        status.className = 'mapstudio-visually-hidden mapstudio-search-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        container.appendChild(status);
        this.container = container;
        this.row = row;
        this.field = field;
        this.input = input;
        this.status = status;
        return container;
    }

    onRemove(): void {
        this.close();
        if (this.input) {
            this.input.removeEventListener('input', this.handleInput);
            this.input.removeEventListener('keydown', this.handleKeyDown);
            this.input.removeEventListener('focus', this.handleFocus);
            this.input.removeEventListener('blur', this.handleBlur);
        }
        this.showClear(false);
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.row = null;
        this.field = null;
        this.input = null;
        this.status = null;
    }

    /** The top bar's row: the search field is its first child; entry 3 appends the Needs you summary after it. */
    slot(): HTMLElement | null {
        return this.row;
    }

    /** The top bar's container, under whose row the Needs you list opens (entry 3), as the results panel does. */
    panelHost(): HTMLElement | null {
        return this.container;
    }

    /** Say something in the top bar's polite live region (a Needs you choice uses it too, entry 3). */
    announce(text: string): void {
        if (this.status) {
            this.status.textContent = text;
        }
    }

    /** The map's entries (every live item); an open list is searched again. */
    setEntries(entries: SearchEntry[]): void {
        this.entries = entries;
        if (this.panel) {
            this.search();
        }
    }

    isOpen(): boolean {
        return this.panel !== null;
    }

    /** Close the list (the text stays). */
    close(): void {
        if (!this.panel || !this.container || !this.input) {
            return;
        }
        this.container.removeChild(this.panel);
        this.panel = null;
        this.results = [];
        this.active = -1;
        this.input.setAttribute('aria-expanded', 'false');
        this.input.removeAttribute('aria-activedescendant');
        this.container.setAttribute('data-search-open', 'false');
        this.onToggle(false);
    }

    /** Clear the text and close the list; the focus stays in the input. */
    clear(): void {
        if (this.input) {
            this.input.value = '';
        }
        this.showClear(false);
        this.close();
    }

    /** The Clear button exists only while there is text, so a hidden button never counts as a target. */
    private showClear(show: boolean): void {
        if (show && !this.clearButton && this.field) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'mapstudio-ctrl-button mapstudio-search-clear';
            button.title = 'Clear the search';
            button.setAttribute('aria-label', 'Clear the search');
            button.innerHTML = glyphSvg('close', 'mapstudio-ctrl-glyph');
            // A press keeps the focus in the input; the click clears.
            button.addEventListener('mousedown', this.keepFocus);
            button.addEventListener('click', this.handleClear);
            this.field.appendChild(button);
            this.clearButton = button;
        } else if (!show && this.clearButton) {
            this.clearButton.removeEventListener('mousedown', this.keepFocus);
            this.clearButton.removeEventListener('click', this.handleClear);
            if (this.clearButton.parentNode) {
                this.clearButton.parentNode.removeChild(this.clearButton);
            }
            this.clearButton = null;
        }
    }

    /** Search the text and show the list (or "No matches"); nothing opens with no text. */
    private search(): void {
        const input = this.input;
        const container = this.container;
        if (!input || !container) {
            return;
        }
        const text = input.value;
        this.showClear(text !== '');
        if (text.trim() === '') {
            this.close();
            return;
        }
        this.results = searchEntries(this.entries, text);
        if (!this.panel) {
            const panel = document.createElement('div');
            panel.className = 'mapstudio-topbar-panel mapstudio-search-panel';
            // A press inside the panel keeps the focus in the input, so a row's click (or tap) reaches it.
            panel.addEventListener('mousedown', this.keepFocus);
            container.appendChild(panel);
            this.panel = panel;
            input.setAttribute('aria-expanded', 'true');
            container.setAttribute('data-search-open', 'true');
            this.onToggle(true);
        }
        this.active = this.results.length > 0 && this.active >= 0 ? Math.min(this.active, this.results.length - 1) : -1;
        this.renderList();
    }

    private renderList(): void {
        const panel = this.panel;
        if (!panel) {
            return;
        }
        while (panel.firstChild) {
            panel.removeChild(panel.firstChild);
        }
        if (this.results.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'mapstudio-search-empty';
            empty.id = this.listId;
            empty.setAttribute('role', 'listbox');
            empty.setAttribute('aria-label', 'Search results');
            const row = document.createElement('div');
            row.setAttribute('role', 'option');
            row.setAttribute('aria-disabled', 'true');
            row.setAttribute('aria-selected', 'false');
            row.textContent = NO_MATCHES;
            empty.appendChild(row);
            panel.appendChild(empty);
            panel.setAttribute('data-results', '0');
            this.setActive(-1);
            return;
        }
        const list = document.createElement('ul');
        list.className = 'mapstudio-search-list';
        list.id = this.listId;
        list.setAttribute('role', 'listbox');
        list.setAttribute('aria-label', 'Search results');
        this.results.forEach((result, i) => {
            const li = document.createElement('li');
            li.className = 'mapstudio-search-option';
            li.id = this.listId + '-' + i;
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', 'false');
            li.setAttribute('data-item-id', result.id);
            li.setAttribute('data-matched', result.matched);
            li.setAttribute('data-index', String(i));
            const glyph = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            glyph.setAttribute('class', 'mapstudio-search-kind-glyph');
            glyph.setAttribute('width', '20');
            glyph.setAttribute('height', '20');
            glyph.setAttribute('viewBox', '0 0 24 24');
            glyph.setAttribute('aria-hidden', 'true');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', SPRITE_URL + '#ms-' + (result.icon || (result.geometry === 'line' ? 'pipeline' : 'point')));
            glyph.appendChild(use);
            li.appendChild(glyph);
            const name = document.createElement('span');
            name.className = 'mapstudio-search-name';
            name.textContent = result.name;
            li.appendChild(name);
            const detail = document.createElement('span');
            detail.className = 'mapstudio-search-detail';
            detail.textContent = result.detail;
            li.appendChild(detail);
            li.addEventListener('click', this.handleRowClick);
            list.appendChild(li);
        });
        panel.appendChild(list);
        panel.setAttribute('data-results', String(this.results.length));
        this.setActive(this.active);
    }

    /** Mark one row active (`aria-selected`, `aria-activedescendant`); -1 for none. */
    private setActive(index: number): void {
        this.active = index;
        const panel = this.panel;
        const input = this.input;
        if (!panel || !input) {
            return;
        }
        const rows = panel.querySelectorAll('.mapstudio-search-option');
        rows.forEach((row, i) => {
            row.setAttribute('aria-selected', i === index ? 'true' : 'false');
            if (i === index) {
                (row as HTMLElement).scrollIntoView({ block: 'nearest' });
            }
        });
        if (index >= 0 && index < rows.length) {
            input.setAttribute('aria-activedescendant', rows[index].id);
        } else {
            input.removeAttribute('aria-activedescendant');
        }
    }

    private choose(index: number): void {
        const result = this.results[index];
        if (!result) {
            return;
        }
        this.clear();
        if (this.status) {
            this.status.textContent = chosenText(result);
        }
        if (this.input && typeof window !== 'undefined' && typeof window.matchMedia === 'function'
            && window.matchMedia(PHONE_QUERY).matches) {
            // On a phone the keyboard would cover the item and its sheet.
            this.input.blur();
        }
        this.onChoose(result);
    }

    private handleInput = (): void => {
        this.active = -1;
        this.search();
    };

    private handleFocus = (): void => {
        this.search();
    };

    private handleBlur = (): void => {
        this.close();
    };

    private handleClear = (ev: MouseEvent): void => {
        ev.preventDefault();
        this.clear();
        if (this.input) {
            this.input.focus();
        }
    };

    private keepFocus = (ev: MouseEvent): void => {
        ev.preventDefault();
    };

    private handleRowClick = (ev: MouseEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        const index = Number((ev.currentTarget as HTMLElement).getAttribute('data-index'));
        if (Number.isFinite(index)) {
            this.choose(index);
        }
    };

    private handleKeyDown = (ev: KeyboardEvent): void => {
        const n = this.results.length;
        switch (ev.key) {
            case 'ArrowDown':
                ev.preventDefault();
                if (!this.panel) {
                    this.search();
                }
                if (this.results.length > 0) {
                    this.setActive(this.active < 0 ? 0 : (this.active + 1) % this.results.length);
                }
                break;
            case 'ArrowUp':
                ev.preventDefault();
                if (n > 0) {
                    this.setActive(this.active <= 0 ? n - 1 : this.active - 1);
                }
                break;
            case 'Home':
                if (this.panel && n > 0) {
                    ev.preventDefault();
                    this.setActive(0);
                }
                break;
            case 'End':
                if (this.panel && n > 0) {
                    ev.preventDefault();
                    this.setActive(n - 1);
                }
                break;
            case 'Enter':
                if (this.panel && n > 0) {
                    ev.preventDefault();
                    this.choose(this.active >= 0 ? this.active : 0);
                }
                break;
            case 'Escape':
                if (this.panel || (this.input && this.input.value !== '')) {
                    // Esc clears and closes; the map and the legend never see it.
                    ev.preventDefault();
                    ev.stopPropagation();
                    this.clear();
                }
                break;
            default:
                break;
        }
    };
}
