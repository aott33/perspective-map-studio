/**
 * The zoom card (epic 3 entry 14, DESIGN.md zoom-control; R5): one MapLibre control group top-right
 * with plus, the zoom level ("z 15"), minus, Fit, Return and Locate me, each a glyph with its words in
 * `aria-label` and `title`. Fit fits every map item's bounds and stays pressed while it keeps; Return
 * re-centres on the selected map item and is disabled while nothing is selected; Locate me (epic 4
 * entry 15, a navigation arrow) centres the map on the page's `userLocation` and, without a position,
 * is faded and inert (`aria-disabled`, still focusable) with its reason in its `title` and accessible
 * description (userLocation.ts LOCATE_WORDS). It replaces
 * MapLibre's NavigationControl and entry 7's FitControl. Token colours only, in mapstudio.css;
 * 44 px targets at phone width.
 */

import { IControl, Map as MapLibreMap } from 'maplibre-gl';
import { glyphSvg, returnGlyphSvg, zoomLevelText } from './controls';
import { LOCATE_LABEL, LocationState, locateWords } from './userLocation';

export class ZoomControl implements IControl {
    private container: HTMLDivElement | null = null;
    private map: MapLibreMap | null = null;
    private level: HTMLDivElement | null = null;
    private fitButton: HTMLButtonElement | null = null;
    private returnButton: HTMLButtonElement | null = null;
    private locateButton: HTMLButtonElement | null = null;
    private locateState: LocationState = 'off';

    constructor(private readonly onFit: () => void, private readonly onReturn: () => void, private readonly onLocate: () => void = () => undefined) {}

    onAdd(map: MapLibreMap): HTMLElement {
        this.map = map;
        const container = document.createElement('div');
        container.className = 'maplibregl-ctrl maplibregl-ctrl-group mapstudio-zoom';
        container.setAttribute('role', 'group');
        container.setAttribute('aria-label', 'Zoom');
        this.button(container, 'mapstudio-zoom-in', 'Zoom in', glyphSvg('plus', 'mapstudio-ctrl-glyph'),
            () => { if (this.map) { this.map.zoomIn(); } });
        const level = document.createElement('div');
        level.className = 'mapstudio-zoom-level';
        level.setAttribute('aria-live', 'off');
        level.title = 'The zoom level';
        container.appendChild(level);
        this.level = level;
        this.button(container, 'mapstudio-zoom-out', 'Zoom out', glyphSvg('minus', 'mapstudio-ctrl-glyph'),
            () => { if (this.map) { this.map.zoomOut(); } });
        this.fitButton = this.button(container, 'mapstudio-fit-button', 'Fit the map to every item',
            glyphSvg('fit', 'mapstudio-ctrl-glyph'), this.onFit);
        this.returnButton = this.button(container, 'mapstudio-return-button', 'Return to the selected item',
            returnGlyphSvg('mapstudio-ctrl-glyph'), this.onReturn);
        this.returnButton.disabled = true;
        // Locate me, last (owner, 2026-11-06): inert while there is no position; a press then does nothing.
        this.locateButton = this.button(container, 'mapstudio-locate-button', LOCATE_LABEL, glyphSvg('navigate', 'mapstudio-ctrl-glyph'),
            () => { if (this.locateState === 'fix') { this.onLocate(); } });
        this.applyLocate();
        this.container = container;
        map.on('zoom', this.onZoom);
        this.onZoom();
        return container;
    }

    private button(parent: HTMLElement, className: string, label: string, glyph: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mapstudio-ctrl-button ' + className;
        button.innerHTML = glyph;
        button.title = label;
        button.setAttribute('aria-label', label);
        button.addEventListener('click', (ev) => {
            ev.preventDefault();
            onClick();
        });
        parent.appendChild(button);
        return button;
    }

    private onZoom = (): void => {
        if (this.level && this.map) {
            this.level.textContent = zoomLevelText(this.map.getZoom());
        }
    };

    onRemove(): void {
        if (this.map) {
            this.map.off('zoom', this.onZoom);
        }
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.map = null;
        this.level = null;
        this.fitButton = null;
        this.returnButton = null;
        this.locateButton = null;
    }

    /** Fit is disabled with nothing to fit; `kept` marks the button pressed while the fit keeps. */
    setFit(enabled: boolean, kept: boolean): void {
        if (this.fitButton) {
            this.fitButton.disabled = !enabled;
            this.fitButton.setAttribute('aria-pressed', kept ? 'true' : 'false');
            this.fitButton.classList.toggle('mapstudio-ctrl-button--on', kept);
        }
    }

    /** Return is enabled only while a map item is selected. */
    setReturn(enabled: boolean): void {
        if (this.returnButton) {
            this.returnButton.disabled = !enabled;
        }
    }

    /** Locate me's state from the read location: active with a fix, else faded and inert with its reason in words. */
    setLocate(state: LocationState): void {
        this.locateState = state;
        this.applyLocate();
    }

    private applyLocate(): void {
        const button = this.locateButton;
        if (!button) {
            return;
        }
        const on = this.locateState === 'fix';
        const words = locateWords(this.locateState);
        button.title = words;
        button.setAttribute('aria-label', LOCATE_LABEL);
        button.setAttribute('aria-description', words);
        button.setAttribute('aria-disabled', on ? 'false' : 'true');
        button.setAttribute('data-locate', this.locateState);
        button.classList.toggle('mapstudio-ctrl-button--inert', !on);
    }
}
