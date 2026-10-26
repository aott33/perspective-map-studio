import { IControl, Map as MapLibreMap } from 'maplibre-gl';

/**
 * One MapLibre control: a toggle button for the line tool, named in words and
 * a glyph (R10). The component owns the state; the control only reports
 * clicks and reflects `setPressed`. Colours come from mapstudio.css tokens.
 */
export class DrawControl implements IControl {
    private container: HTMLDivElement | null = null;
    private button: HTMLButtonElement | null = null;

    constructor(private readonly onToggle: () => void) {
    }

    onAdd(_map: MapLibreMap): HTMLElement {
        const container = document.createElement('div');
        container.className = 'maplibregl-ctrl maplibregl-ctrl-group mapstudio-draw';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mapstudio-draw-button';
        button.setAttribute('aria-label', 'Draw a line');
        button.setAttribute('aria-pressed', 'false');
        button.title = 'Draw a line';
        button.innerHTML =
            '<svg class="mapstudio-draw-glyph" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">' +
            '<polyline points="2,13 6,5 10,10 14,3" fill="none" stroke="currentColor" stroke-width="2" ' +
            'stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '<span class="mapstudio-draw-word">Draw a line</span>';
        button.addEventListener('click', this.handleClick);
        container.appendChild(button);
        this.container = container;
        this.button = button;
        return container;
    }

    onRemove(): void {
        if (this.button) {
            this.button.removeEventListener('click', this.handleClick);
        }
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.button = null;
    }

    /** Reflect the tool's state on the button. */
    setPressed(pressed: boolean): void {
        if (this.button) {
            this.button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
            this.button.classList.toggle('mapstudio-draw-button--on', pressed);
        }
    }

    private handleClick = (ev: MouseEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        this.onToggle();
    };
}
