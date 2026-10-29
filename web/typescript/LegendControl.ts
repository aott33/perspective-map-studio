/**
 * The legend (epic 3 entries 14 and 3, DESIGN.md legend; R10, R14): one MapLibre control bottom-left,
 * a row of the Legend button (a layers glyph and the word), MapLibre's scale bar and the provider's
 * attribution (never collapsed, always shown with a basemap), and a panel above the button that opens
 * on a click or by keyboard (Enter or Space), closes on Esc (focus back on the button), on a map click
 * and on the button again. The panel is built from sections, in the map's own words (legend.ts):
 * the kinds on the map with their glyphs, the states (the alarm glyphs by priority and
 * acknowledgement, comms lost, stale), the line looks, the value styles and the area tints a kind
 * setup turns on, then Show (the Lines and Names checkboxes with the zoom 14 note) and Basemap (one
 * button per basemap the setup offers, in its order, the chosen one pressed, a refusal or tile status
 * in words under them). Every sample is inline SVG in `currentColor` through a token class (AD-11).
 * The panel's DOM exists only while it is open, so no hidden control counts as a target. The
 * component owns the state; the control reports clicks and toggles and reflects `setKey`,
 * `setToggles`, `setOffered`, `setSelected` and `setStatus`. Token colours only, in mapstudio.css.
 */

import { AttributionControl, IControl, Map as MapLibreMap, ScaleControl } from 'maplibre-gl';
import { BASEMAP_LABELS, BasemapId } from './basemaps';
import { glyphSvg } from './controls';
import { LegendKey, LegendToggle, ZOOM_NOTE } from './legend';
import { DIMMED_OPACITY } from './markers';

/** The sprite the kind and state glyphs come from, as the default popup draws them (DefaultPopup.tsx). */
const SPRITE_URL = '/res/mapstudio/icons/mapstudio-icons.svg';
const SVG_NS = 'http://www.w3.org/2000/svg';

const EMPTY_KEY: LegendKey = { kinds: [], states: [], lines: [], styles: [], tints: [] };

function svgEl(name: string, attrs: Record<string, string>): SVGElement {
    const el = document.createElementNS(SVG_NS, name);
    for (const key of Object.keys(attrs)) {
        el.setAttribute(key, attrs[key]);
    }
    return el;
}

/** A 24 px sample box, hidden from assistive technology (the row's words carry the meaning). */
function sample(className: string, width = 24): SVGSVGElement {
    return svgEl('svg', { class: className, width: String(width), height: '24', viewBox: '0 0 ' + width + ' 24', 'aria-hidden': 'true' }) as SVGSVGElement;
}

/** A sprite symbol through `<use>`, sized and placed inside a sample. */
function use(id: string, x: number, y: number, size: number, className = ''): SVGElement {
    const el = svgEl('use', { href: SPRITE_URL + '#ms-' + id, x: String(x), y: String(y), width: String(size), height: String(size) });
    if (className) {
        el.setAttribute('class', className);
    }
    return el;
}

/** The scale bar's longest length, in px (DESIGN.md: the scale bar beside the Legend button). */
export const SCALE_MAX_WIDTH_PX = 80;

export class LegendControl implements IControl {
    private container: HTMLDivElement | null = null;
    private button: HTMLButtonElement | null = null;
    private panel: HTMLDivElement | null = null;
    private basemapGroup: HTMLDivElement | null = null;
    private status: HTMLDivElement | null = null;
    private scale: ScaleControl | null = null;
    private attribution: AttributionControl | null = null;
    private buttons = new Map<BasemapId, HTMLButtonElement>();
    private offered: BasemapId[] = [];
    private selected: BasemapId | null = null;
    private statusText = '';
    private panelId = 'mapstudio-legend-' + Math.random().toString(36).slice(2, 8);
    private key: LegendKey = EMPTY_KEY;
    private toggles: Record<LegendToggle, boolean> = { lines: true, names: true };
    private checkboxes = new Map<LegendToggle, HTMLInputElement>();

    constructor(private readonly onChoose: (id: BasemapId) => void, private readonly onToggle: (open: boolean) => void,
                private readonly onSwitch: (toggle: LegendToggle, on: boolean) => void = () => undefined) {}

    onAdd(map: MapLibreMap): HTMLElement {
        const container = document.createElement('div');
        container.className = 'maplibregl-ctrl mapstudio-legend';
        const row = document.createElement('div');
        row.className = 'mapstudio-legend-row';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mapstudio-ctrl-button mapstudio-legend-button';
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', this.panelId);
        button.title = 'Legend';
        button.innerHTML = glyphSvg('layers', 'mapstudio-ctrl-glyph') + '<span class="mapstudio-legend-word">Legend</span>';
        button.addEventListener('click', this.handleToggle);
        row.appendChild(button);
        // MapLibre's own scale bar and attribution, placed in this row rather than as controls of their
        // own (a corner's controls stack vertically); their map listeners come with onAdd.
        this.scale = new ScaleControl({ maxWidth: SCALE_MAX_WIDTH_PX, unit: 'metric' });
        const scale = this.scale.onAdd(map);
        scale.classList.add('mapstudio-legend-scale');
        row.appendChild(scale);
        this.attribution = new AttributionControl({ compact: false });
        const attribution = this.attribution.onAdd(map);
        attribution.classList.add('mapstudio-legend-attribution');
        row.appendChild(attribution);
        container.appendChild(row);
        container.addEventListener('keydown', this.handleKeyDown);
        this.container = container;
        this.button = button;
        return container;
    }

    onRemove(): void {
        this.close(false);
        if (this.button) {
            this.button.removeEventListener('click', this.handleToggle);
        }
        if (this.container) {
            this.container.removeEventListener('keydown', this.handleKeyDown);
        }
        if (this.scale) {
            this.scale.onRemove();
            this.scale = null;
        }
        if (this.attribution) {
            this.attribution.onRemove();
            this.attribution = null;
        }
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.button = null;
    }

    isOpen(): boolean {
        return this.panel !== null;
    }

    /** Open the panel above the button and move focus into it. */
    open(): void {
        if (this.panel || !this.container || !this.button) {
            return;
        }
        const panel = document.createElement('div');
        panel.id = this.panelId;
        panel.className = 'mapstudio-legend-panel';
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'Legend');
        // Sections in order (entry 3): the key in the map's words, Show, then Basemap.
        this.renderKey(panel);
        this.renderShow(panel);
        const basemap = this.section(panel, 'Basemap', 'mapstudio-legend-section--basemap');
        const group = document.createElement('div');
        group.className = 'mapstudio-basemap-group';
        group.setAttribute('role', 'group');
        group.setAttribute('aria-label', 'Basemap');
        basemap.appendChild(group);
        const status = document.createElement('div');
        status.className = 'mapstudio-basemap-status';
        status.setAttribute('role', 'status');
        basemap.appendChild(status);
        this.basemapGroup = group;
        this.status = status;
        this.container.insertBefore(panel, this.container.firstChild);
        this.panel = panel;
        this.button.setAttribute('aria-expanded', 'true');
        this.renderBasemaps();
        this.renderStatus();
        // The first control takes the focus (the Lines checkbox; the first basemap button without a key).
        const first = panel.querySelector('input, button');
        if (first) {
            (first as HTMLElement).focus();
        }
        this.onToggle(true);
    }

    /** Close the panel; with `focusButton` the Legend button takes the focus back (Esc). */
    close(focusButton: boolean): void {
        if (!this.panel) {
            return;
        }
        this.buttons.forEach((button) => button.removeEventListener('click', this.handleChoose));
        this.buttons.clear();
        this.checkboxes.forEach((box) => box.removeEventListener('change', this.handleSwitch));
        this.checkboxes.clear();
        if (this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }
        this.panel = null;
        this.basemapGroup = null;
        this.status = null;
        if (this.button) {
            this.button.setAttribute('aria-expanded', 'false');
            if (focusButton) {
                this.button.focus();
            }
        }
        this.onToggle(false);
    }

    /** The basemaps to offer, in order; the section is empty with none. */
    setOffered(offered: readonly BasemapId[]): void {
        if (offered.join(',') === this.offered.join(',')) {
            return;
        }
        this.offered = offered.slice();
        this.renderBasemaps();
    }

    setSelected(id: BasemapId | null): void {
        this.selected = id;
        this.buttons.forEach((button, key) => {
            const on = key === id;
            button.setAttribute('aria-pressed', on ? 'true' : 'false');
            button.classList.toggle('mapstudio-basemap-button--on', on);
        });
    }

    /** The plain-words status under the basemap buttons, or '' for none. */
    setStatus(text: string): void {
        this.statusText = text;
        this.renderStatus();
    }

    /** The key of what the map draws (legend.ts); an open panel is drawn again. */
    setKey(key: LegendKey): void {
        this.key = key;
        if (this.panel) {
            const focused = document.activeElement;
            const inside = focused instanceof HTMLElement && this.panel.contains(focused);
            this.close(false);
            this.open();
            if (!inside && this.button) {
                this.button.focus();
            }
        }
    }

    /** The Lines and Names toggles' state (the component remembers them). */
    setToggles(lines: boolean, names: boolean): void {
        this.toggles = { lines, names };
        this.checkboxes.forEach((box, toggle) => { box.checked = this.toggles[toggle]; });
    }

    /** The key's sections: Kinds, States, Lines, and Styles and Areas when a kind setup turns them on. */
    private renderKey(panel: HTMLElement): void {
        const key = this.key;
        if (key.kinds.length > 0) {
            const kinds = this.section(panel, 'Kinds', 'mapstudio-legend-section--kinds');
            for (const kind of key.kinds) {
                const box = sample('mapstudio-legend-sample mapstudio-legend-sample--kind');
                if (kind.draw === 'point') {
                    box.appendChild(svgEl('circle', { cx: '12', cy: '12', r: '10.5', class: 'mapstudio-legend-disc' }));
                    box.appendChild(use(kind.icon || 'point', 5, 5, 14));
                } else if (kind.draw === 'line') {
                    box.appendChild(svgEl('path', { d: 'M2 17L9 7L15 15L22 6', class: 'mapstudio-legend-line-sample mapstudio-legend-token--line',
                        'stroke-width': '3' }));
                } else {
                    box.appendChild(svgEl('rect', { x: '3', y: '5', width: '18', height: '14', rx: '2',
                        class: 'mapstudio-legend-area-sample mapstudio-legend-token--line' }));
                }
                this.row(kinds, box, kind.name, 'mapstudio-legend-kind', { 'data-kind': kind.id });
            }
        }
        if (key.states.length > 0) {
            const states = this.section(panel, 'States', 'mapstudio-legend-section--states');
            for (const state of key.states) {
                const box = sample('mapstudio-legend-sample mapstudio-legend-token--' + state.token);
                const alarm = state.token.indexOf('alarm-') === 0;
                if (state.solid) {
                    box.appendChild(svgEl('circle', { cx: '12', cy: '12', r: '9', class: 'mapstudio-legend-badge mapstudio-legend-badge--solid' }));
                    box.appendChild(use(state.glyph, 6, 6, 12, 'mapstudio-legend-badge-glyph--solid'));
                } else if (alarm) {
                    box.appendChild(svgEl('circle', { cx: '12', cy: '12', r: '8.5', class: 'mapstudio-legend-badge' }));
                    box.appendChild(use(state.glyph, 6, 6, 12));
                } else {
                    // Comms lost and stale: the glyph inside the dashed ring the marker takes, no disc.
                    box.appendChild(svgEl('circle', { cx: '12', cy: '12', r: '9.5', class: 'mapstudio-legend-ring', 'stroke-dasharray': '3 3' }));
                    box.appendChild(use(state.glyph, 5, 5, 14));
                }
                this.row(states, box, state.words, 'mapstudio-legend-state', { 'data-glyph': state.glyph });
            }
        }
        if (key.lines.length > 0) {
            const lines = this.section(panel, 'Lines', 'mapstudio-legend-section--lines');
            for (const line of key.lines) {
                const box = sample('mapstudio-legend-sample mapstudio-legend-token--' + line.token, 28);
                const path = svgEl('path', { d: 'M2 12H26', class: 'mapstudio-legend-line-sample', 'stroke-width': String(line.weight) });
                if (line.dashed) {
                    path.setAttribute('stroke-dasharray', (line.weight * 2) + ' ' + (line.weight * 1.5));
                }
                box.appendChild(path);
                this.row(lines, box, line.words, 'mapstudio-legend-line');
            }
        }
        if (key.styles.length > 0) {
            const styles = this.section(panel, 'Styles', 'mapstudio-legend-section--styles');
            for (const style of key.styles) {
                const box = sample('mapstudio-legend-sample mapstudio-legend-token--' + style.preset);
                const ring = svgEl('circle', { cx: '12', cy: '12', r: '9', class: 'mapstudio-legend-ring mapstudio-legend-ring--' + style.preset });
                if (style.preset === 'dimmed') {
                    ring.setAttribute('stroke-dasharray', '2 2');
                    box.setAttribute('opacity', String(DIMMED_OPACITY));
                }
                box.appendChild(ring);
                this.row(styles, box, style.words, 'mapstudio-legend-style', { 'data-preset': style.preset });
            }
        }
        if (key.tints.length > 0) {
            const areas = this.section(panel, 'Areas', 'mapstudio-legend-section--areas');
            for (const tint of key.tints) {
                const box = sample('mapstudio-legend-sample mapstudio-legend-token--' + (tint.tint || 'line'));
                box.appendChild(svgEl('rect', { x: '2', y: '5', width: '20', height: '14', rx: '2', class: 'mapstudio-legend-tint-sample' }));
                this.row(areas, box, tint.category, 'mapstudio-legend-tint', { 'data-tint': tint.tint || '', title: tint.kindName });
            }
        }
    }

    /** The Show section: the Lines and Names checkboxes and the zoom 14 note. */
    private renderShow(panel: HTMLElement): void {
        const show = this.section(panel, 'Show', 'mapstudio-legend-section--show');
        const group = document.createElement('div');
        group.className = 'mapstudio-legend-toggles';
        for (const toggle of ['lines', 'names'] as LegendToggle[]) {
            const label = document.createElement('label');
            label.className = 'mapstudio-legend-toggle-label';
            const box = document.createElement('input');
            box.type = 'checkbox';
            box.className = 'mapstudio-legend-toggle';
            box.setAttribute('data-toggle', toggle);
            box.checked = this.toggles[toggle];
            box.addEventListener('change', this.handleSwitch);
            label.appendChild(box);
            const words = document.createElement('span');
            words.textContent = toggle === 'lines' ? 'Lines' : 'Names';
            label.appendChild(words);
            group.appendChild(label);
            this.checkboxes.set(toggle, box);
        }
        show.appendChild(group);
        const note = document.createElement('div');
        note.className = 'mapstudio-legend-note';
        note.textContent = ZOOM_NOTE;
        show.appendChild(note);
    }

    private row(section: HTMLElement, box: SVGSVGElement, words: string, className: string, attrs: Record<string, string> = {}): void {
        const row = document.createElement('div');
        row.className = 'mapstudio-legend-key-row ' + className;
        for (const key of Object.keys(attrs)) {
            row.setAttribute(key, attrs[key]);
        }
        row.appendChild(box);
        const text = document.createElement('span');
        text.className = 'mapstudio-legend-key-words';
        text.textContent = words;
        row.appendChild(text);
        section.appendChild(row);
    }

    private section(panel: HTMLElement, title: string, className: string): HTMLElement {
        const section = document.createElement('div');
        section.className = 'mapstudio-legend-section ' + className;
        const heading = document.createElement('div');
        heading.className = 'mapstudio-legend-heading';
        heading.textContent = title;
        section.appendChild(heading);
        panel.appendChild(section);
        return section;
    }

    private renderBasemaps(): void {
        const group = this.basemapGroup;
        if (!group) {
            return;
        }
        this.buttons.forEach((button) => button.removeEventListener('click', this.handleChoose));
        this.buttons.clear();
        while (group.firstChild) {
            group.removeChild(group.firstChild);
        }
        for (const id of this.offered) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'mapstudio-ctrl-button mapstudio-basemap-button';
            button.setAttribute('data-basemap', id);
            button.setAttribute('aria-pressed', 'false');
            button.title = BASEMAP_LABELS[id];
            button.textContent = BASEMAP_LABELS[id];
            button.addEventListener('click', this.handleChoose);
            group.appendChild(button);
            this.buttons.set(id, button);
        }
        this.setSelected(this.selected);
    }

    private renderStatus(): void {
        if (this.status) {
            this.status.textContent = this.statusText;
            this.status.hidden = this.statusText === '';
        }
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

    private handleChoose = (ev: MouseEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        const id = (ev.currentTarget as HTMLElement).getAttribute('data-basemap') as BasemapId | null;
        if (id) {
            this.onChoose(id);
        }
    };

    private handleSwitch = (ev: Event): void => {
        const box = ev.currentTarget as HTMLInputElement;
        const toggle = box.getAttribute('data-toggle') as LegendToggle | null;
        if (toggle === 'lines' || toggle === 'names') {
            this.toggles[toggle] = box.checked;
            this.onSwitch(toggle, box.checked);
        }
    };

    private handleKeyDown = (ev: KeyboardEvent): void => {
        if (ev.key === 'Escape' && this.panel) {
            ev.preventDefault();
            ev.stopPropagation();
            this.close(true);
        }
    };
}
