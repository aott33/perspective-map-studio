/**
 * The legend (epic 3 entry 14, DESIGN.md legend; R10, R14): one MapLibre control bottom-left, a row of
 * the Legend button (a layers glyph and the word), MapLibre's scale bar and the provider's attribution
 * (never collapsed, always shown with a basemap), and a panel above the button that opens on a click
 * or by keyboard (Enter or Space), closes on Esc (focus back on the button), on a map click and on the
 * button again. The panel is built from sections: the first holds the basemap choice (one button per
 * basemap the setup offers, in its order, the chosen one pressed, a refusal or tile status in words
 * under them); entry 3 adds the glyph key and the Lines and Names toggles before it. The panel's DOM
 * exists only while it is open, so no hidden button counts as a target. The component owns the state;
 * the control reports clicks and reflects `setOffered`, `setSelected` and `setStatus`. Token colours
 * only, in mapstudio.css.
 */

import { AttributionControl, IControl, Map as MapLibreMap, ScaleControl } from 'maplibre-gl';
import { BASEMAP_LABELS, BasemapId } from './basemaps';
import { glyphSvg } from './controls';

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

    constructor(private readonly onChoose: (id: BasemapId) => void, private readonly onToggle: (open: boolean) => void) {}

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
        // Sections in order; entry 3 adds the glyph key and the Lines and Names toggles before Basemap.
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
        const first = panel.querySelector('button');
        if (first) {
            (first as HTMLButtonElement).focus();
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

    private handleKeyDown = (ev: KeyboardEvent): void => {
        if (ev.key === 'Escape' && this.panel) {
            ev.preventDefault();
            ev.stopPropagation();
            this.close(true);
        }
    };
}
