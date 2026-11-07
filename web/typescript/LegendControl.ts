/**
 * The legend (epic 3 entries 14 and 3, DESIGN.md legend; R10, R14; owner review items 1, 2, 3, 23, 24):
 * one MapLibre control bottom-left, a row of the Legend button (a layers glyph and the word) and MapLibre's
 * scale bar sitting on the button's bottom edge, and a panel above the button that opens on a click or by
 * keyboard (Enter or Space), closes on Esc (focus back on the button), on a map click and on the button
 * again. The provider's attribution is not here: it is a control of its own, small muted text along the
 * bottom-right edge under the App Bar toggle (MapStudio.tsx, `.maplibregl-ctrl-attrib`), and so is the Mapbox
 * logo while Satellite is drawn (mapboxLogo.ts, MapboxLogoControl). The panel is
 * built from sections, in the map's own words (legend.ts): States first (the alarm glyphs by priority and
 * acknowledgement, comms lost, stale), then the kinds on the map with their glyphs (collapsed to "Kinds (9)"
 * with more than six, a button that opens them), the line looks, the value styles and the area tints a kind
 * setup turns on, then Show (the Lines and Names checkboxes with the zoom 14 note) and, only when the setup
 * lists more than one basemap, Basemap (one button per basemap in the setup's order, the chosen one pressed,
 * a refusal or tile status in words under them). The basemap is the project's setting: with one listed, a
 * viewer has no switch and the first listed is drawn. The panel stops below the top bar and scrolls inside.
 * At phone width it is a bottom sheet like the popups (handle, header with Close, 8 px from the sides above
 * the Legend row), with Show first, the key in two columns and no Basemap section. Every sample is inline
 * SVG in `currentColor` through a token class (AD-11). The panel's DOM exists only while it is open, so no
 * hidden control counts as a target. The component owns the state; the control reports clicks and toggles
 * and reflects `setKey`, `setToggles`, `setOffered`, `setSelected` and `setStatus`. Token colours only, in
 * mapstudio.css.
 *
 * One legend, two places (epic 4 entry 22, the owner's render C of the legend review): in Edit mode the Legend
 * button and its panel leave the map (the stylesheet hides the button from 768 px, the component closes an open
 * panel as the studio comes on) and the rail's Layers surface hands the control a host (`dock`), which the same
 * `fill` draws one part of the desktop content into from the same state: on the surface's Layers tab the controls
 * (Show, then Basemap), on its Legend tab the key (owner, "2, the tabs"), so every setter redraws both places, and
 * a toggle or a basemap picked there goes through the same callbacks. The docked copy is never "open":
 * it calls no `onToggle` (`data-legend-open`), `isOpen` is the panel's alone (a map click closes the panel only),
 * it takes no focus when it is drawn and it keeps its own focused control across a redraw.
 */

import { IControl, Map as MapLibreMap, ScaleControl } from 'maplibre-gl';
import { BASEMAP_LABELS, BasemapId, offersBasemapSwitch } from './basemaps';
import { glyphSvg } from './controls';
import { LegendKey, LegendToggle, ZOOM_NOTE, kindsHeading, kindsStartCollapsed, sameLegendKey, withYou } from './legend';
import { DIMMED_OPACITY } from './markers';
import { YOU_ARE_HERE_WORDS } from './userLocation';

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

/** The width below which the legend is the phone's bottom sheet (the stylesheet's phone breakpoint). */
const PHONE_QUERY = '(max-width: 767px)';

/** The scale bar's longest length, in px (DESIGN.md: the scale bar beside the Legend button). */
export const SCALE_MAX_WIDTH_PX = 80;

/**
 * One place the legend's content is drawn (entry 22): the floating panel over the map, or the docked copy in the
 * rail's Layers surface. Each holds its own controls and listeners; the state they show is the control's.
 */
interface LegendHost {
    /** The element the content is drawn into: the panel itself, or the docked wrapper inside the Layers surface. */
    root: HTMLDivElement;
    /** The Layers surface's copy: always the desktop layout (no sheet, no handle or Close), never "open". */
    docked: boolean;
    /** What it draws: the panel everything; the docked copy its tab's part. */
    part: 'all' | DockPart;
    body: HTMLDivElement | null;
    basemapGroup: HTMLDivElement | null;
    status: HTMLDivElement | null;
    buttons: Map<BasemapId, HTMLButtonElement>;
    checkboxes: Map<LegendToggle, HTMLInputElement>;
    kindsButton: HTMLButtonElement | null;
    closeButton: HTMLButtonElement | null;
}

/** The part the Layers surface's tab shows (entry 22): `controls` on the Layers tab (Show, Basemap), `key` on the Legend tab. */
export type DockPart = 'controls' | 'key';

function newHost(root: HTMLDivElement, docked: boolean, part: 'all' | DockPart): LegendHost {
    return { root, docked, part, body: null, basemapGroup: null, status: null, buttons: new Map(), checkboxes: new Map(), kindsButton: null, closeButton: null };
}

export class LegendControl implements IControl {
    private container: HTMLDivElement | null = null;
    private button: HTMLButtonElement | null = null;
    /** The floating panel while it is open, else null. */
    private panel: LegendHost | null = null;
    /** The docked copy while the Layers surface shows (entry 22), else null. */
    private docked: LegendHost | null = null;
    private scale: ScaleControl | null = null;
    private phoneQuery: MediaQueryList | null = null;
    /** The viewer's choice for the Kinds section (null: the default for the count of kinds). */
    private kindsOpen: boolean | null = null;
    private offered: BasemapId[] = [];
    private selected: BasemapId | null = null;
    private statusText = '';
    private panelId = 'mapstudio-legend-' + Math.random().toString(36).slice(2, 8);
    private key: LegendKey = EMPTY_KEY;
    private toggles: Record<LegendToggle, boolean> = { lines: true, names: true };

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
        // MapLibre's own scale bar, placed in this row rather than as a control of its own (a corner's controls
        // stack vertically); its map listeners come with onAdd. It sits on the button's bottom edge (item 1).
        this.scale = new ScaleControl({ maxWidth: SCALE_MAX_WIDTH_PX, unit: 'metric' });
        const scale = this.scale.onAdd(map);
        scale.classList.add('mapstudio-legend-scale');
        row.appendChild(scale);
        container.appendChild(row);
        container.addEventListener('keydown', this.handleKeyDown);
        this.container = container;
        this.button = button;
        return container;
    }

    onRemove(): void {
        this.close(false);
        this.dock(null);
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
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.button = null;
    }

    isOpen(): boolean {
        return this.panel !== null;
    }

    /** Whether the panel is the phone's bottom sheet right now. */
    private isPhone(): boolean {
        return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;
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
        this.container.insertBefore(panel, this.container.firstChild);
        this.panel = newHost(panel, false, 'all');
        this.button.setAttribute('aria-expanded', 'true');
        this.fill(this.panel);
        // The panel follows the phone breakpoint while it is open (a rotated phone, a resized window).
        if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
            this.phoneQuery = window.matchMedia(PHONE_QUERY);
            this.phoneQuery.addEventListener('change', this.handleBreakpoint);
        }
        // The first control takes the focus (the Lines checkbox on a phone, the first heading or checkbox on a desktop),
        // without scrolling the key away: the panel opens at its top.
        const first = panel.querySelector('.mapstudio-legend-body input, .mapstudio-legend-body button');
        if (first) {
            (first as HTMLElement).focus({ preventScroll: true });
        }
        this.onToggle(true);
    }

    /**
     * The docked copy in the rail's Layers surface (entry 22): with an element (the open tab's panel, as it mounts) one
     * part of the desktop content, the controls or the key, is drawn into a wrapper inside it, from the same state as the
     * panel, and every setter redraws it; with null (the surface unmounting, Edit mode left) it leaves, its listeners
     * taken off. It never takes the focus, calls no `onToggle` and does not count for `isOpen`.
     */
    dock(host: HTMLElement | null, part: DockPart = 'controls'): void {
        const docked = this.docked;
        if (docked && host && docked.root.parentNode === host && docked.part === part) {
            return;
        }
        if (docked) {
            this.clearHandlers(docked);
            if (docked.root.parentNode) {
                docked.root.parentNode.removeChild(docked.root);
            }
            this.docked = null;
        }
        if (!host) {
            return;
        }
        const root = document.createElement('div');
        root.className = 'mapstudio-legend-dock';
        root.setAttribute('data-part', part);
        host.appendChild(root);
        this.docked = newHost(root, true, part);
        this.fill(this.docked);
    }

    /** The places the content is drawn now: the open panel and the docked copy, each when it is there. */
    private hosts(): LegendHost[] {
        const hosts: LegendHost[] = [];
        if (this.panel) {
            hosts.push(this.panel);
        }
        if (this.docked) {
            hosts.push(this.docked);
        }
        return hosts;
    }

    /** Draw every place again (a new key, the Kinds section opened or closed, the Basemap section appearing or going). */
    private fillAll(): void {
        for (const host of this.hosts()) {
            this.fill(host);
        }
    }

    /**
     * Draw a place's contents (again): on a desktop and in the dock the key in order States, Kinds, Lines, Styles, Areas,
     * then Show and, with more than one basemap offered, Basemap; the panel on a phone a sheet with a handle and a header,
     * Show first, the key in two columns and no Basemap. The scroll position and the focused control survive a redraw,
     * each place keeping its own (its focus keys are looked up inside it alone).
     */
    private fill(host: LegendHost): void {
        const panel = host.root;
        const phone = !host.docked && this.isPhone();
        const scroll = host.body ? host.body.scrollTop : 0;
        const focused = document.activeElement instanceof HTMLElement && panel.contains(document.activeElement)
            ? document.activeElement.getAttribute('data-focus-key') : null;
        this.clearHandlers(host);
        while (panel.firstChild) {
            panel.removeChild(panel.firstChild);
        }
        if (!host.docked) {
            panel.classList.toggle('mapstudio-legend-panel--sheet', phone);
        }
        if (phone) {
            const handle = document.createElement('div');
            handle.className = 'mapstudio-legend-handle';
            panel.appendChild(handle);
            const header = document.createElement('div');
            header.className = 'mapstudio-legend-header';
            const title = document.createElement('span');
            title.className = 'mapstudio-legend-title';
            title.textContent = 'Legend';
            header.appendChild(title);
            const close = document.createElement('button');
            close.type = 'button';
            close.className = 'mapstudio-ctrl-button mapstudio-legend-close';
            close.title = 'Close the legend';
            close.setAttribute('aria-label', 'Close the legend');
            close.innerHTML = glyphSvg('close', 'mapstudio-ctrl-glyph');
            close.addEventListener('click', this.handleClose);
            host.closeButton = close;
            header.appendChild(close);
            panel.appendChild(header);
        }
        const body = document.createElement('div');
        body.className = 'mapstudio-legend-body';
        panel.appendChild(body);
        host.body = body;
        if (phone) {
            // The sheet leads with what a viewer changes: Show (the Lines and Names toggles); no basemap section.
            this.renderShow(host, body);
            const columns = document.createElement('div');
            columns.className = 'mapstudio-legend-columns';
            body.appendChild(columns);
            this.renderKey(host, columns);
        } else {
            // Sections in order: the key in the map's words (States first), Show, then Basemap when there is a choice; the
            // docked copy draws the key alone (the Legend tab) or Show and Basemap alone (the Layers tab).
            if (host.part !== 'controls') {
                this.renderKey(host, body);
            }
            if (host.part !== 'key') {
                this.renderShow(host, body);
            }
            if (host.part !== 'key' && offersBasemapSwitch(this.offered)) {
                const basemap = this.section(body, 'Basemap', 'mapstudio-legend-section--basemap');
                const group = document.createElement('div');
                group.className = 'mapstudio-basemap-group';
                group.setAttribute('role', 'group');
                group.setAttribute('aria-label', 'Basemap');
                basemap.appendChild(group);
                const status = document.createElement('div');
                status.className = 'mapstudio-basemap-status';
                status.setAttribute('role', 'status');
                host.basemapGroup = group;
                host.status = status;
                // The words go in before the live region is in the document, so a redraw never announces a standing status again.
                this.renderStatus(host);
                basemap.appendChild(status);
                this.renderBasemaps(host);
            }
        }
        body.scrollTop = scroll;
        if (focused) {
            const again = panel.querySelector('[data-focus-key="' + focused + '"]');
            if (again instanceof HTMLElement) {
                again.focus({ preventScroll: true });
            }
        }
    }

    /** Take the listeners off a place's controls before it is drawn again or removed. */
    private clearHandlers(host: LegendHost): void {
        host.buttons.forEach((button) => button.removeEventListener('click', this.handleChoose));
        host.buttons.clear();
        host.checkboxes.forEach((box) => box.removeEventListener('change', this.handleSwitch));
        host.checkboxes.clear();
        if (host.kindsButton) {
            host.kindsButton.removeEventListener('click', this.handleKinds);
            host.kindsButton = null;
        }
        if (host.closeButton) {
            host.closeButton.removeEventListener('click', this.handleClose);
            host.closeButton = null;
        }
        host.basemapGroup = null;
        host.status = null;
    }

    /** Close the panel; with `focusButton` the Legend button takes the focus back (Esc). */
    close(focusButton: boolean): void {
        const panel = this.panel;
        if (!panel) {
            return;
        }
        this.clearHandlers(panel);
        if (this.phoneQuery) {
            this.phoneQuery.removeEventListener('change', this.handleBreakpoint);
            this.phoneQuery = null;
        }
        if (panel.root.parentNode) {
            panel.root.parentNode.removeChild(panel.root);
        }
        this.panel = null;
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
        const before = offersBasemapSwitch(this.offered);
        this.offered = offered.slice();
        const sectionChanged = before !== offersBasemapSwitch(this.offered);
        for (const host of this.hosts()) {
            if (sectionChanged) {
                // The section appears or goes: the place is drawn again.
                this.fill(host);
            } else {
                this.renderBasemaps(host);
            }
        }
    }

    setSelected(id: BasemapId | null): void {
        this.selected = id;
        for (const host of this.hosts()) {
            this.markSelected(host);
        }
    }

    /** The plain-words status under the basemap buttons, or '' for none. */
    setStatus(text: string): void {
        this.statusText = text;
        for (const host of this.hosts()) {
            this.renderStatus(host);
        }
    }

    /**
     * The key of what the map draws (legend.ts); an open panel and the docked copy are drawn again only when it changed,
     * not for every saved edit or full batch that rebuilt an equal key (a redraw would move the focus and drop a click).
     */
    setKey(key: LegendKey): void {
        if (sameLegendKey(this.key, key)) {
            return;
        }
        this.key = key;
        this.fillAll();
    }

    /**
     * The you-are-here row (epic 4 entry 15): shown at the end of States while a position is known, in both places (the
     * panel and the rail's Legend tab); drawn again only when it changed.
     */
    setYouAreHere(on: boolean): void {
        const { you: _was, ...rest } = this.key;
        this.setKey({ ...rest, ...withYou(on) });
    }

    /** The Lines and Names toggles' state (the component remembers them). */
    setToggles(lines: boolean, names: boolean): void {
        this.toggles = { lines, names };
        this.syncCheckboxes();
    }

    /** Every place's checkboxes as the toggles are. */
    private syncCheckboxes(): void {
        for (const host of this.hosts()) {
            host.checkboxes.forEach((box, toggle) => { box.checked = this.toggles[toggle]; });
        }
    }

    /** The key's sections: States, Kinds, Lines, and Styles and Areas when a kind setup turns them on. */
    private renderKey(host: LegendHost, panel: HTMLElement): void {
        const key = this.key;
        if (key.states.length > 0 || key.you) {
            const states = this.section(panel, 'States', 'mapstudio-legend-section--states');
            for (const state of key.states) {
                // The glyph as the marker's badge draws it (markers.ts badgeAt, entry 15): the state glyph itself
                // in its token, solid or hollow by the glyph, 18 px; never a disc of its own.
                const box = sample('mapstudio-legend-sample mapstudio-legend-token--' + state.token);
                box.appendChild(use(state.glyph, 3, 3, 18));
                this.row(states, box, state.words, 'mapstudio-legend-state', { 'data-glyph': state.glyph });
            }
            if (key.you) {
                // The you-are-here marker as the map draws it (epic 4 entry 15, DESIGN.md you-are-here): the dot with its
                // white ring over a soft accuracy circle, in the marker's token (mapstudio.css), last in States.
                const box = sample('mapstudio-legend-sample mapstudio-legend-token--you');
                box.appendChild(svgEl('circle', { cx: '12', cy: '12', r: '11', class: 'mapstudio-legend-you-accuracy' }));
                box.appendChild(svgEl('circle', { cx: '12', cy: '12', r: '6', class: 'mapstudio-legend-you-dot', 'stroke-width': '2' }));
                this.row(states, box, YOU_ARE_HERE_WORDS, 'mapstudio-legend-state mapstudio-legend-you', { 'data-glyph': 'you-are-here' });
            }
        }
        if (key.kinds.length > 0) {
            const open = this.kindsOpen === null ? !kindsStartCollapsed(key.kinds.length) : this.kindsOpen;
            const kinds = this.section(panel, kindsHeading(key.kinds.length), 'mapstudio-legend-section--kinds');
            kinds.setAttribute('data-open', open ? 'true' : 'false');
            if (kindsStartCollapsed(key.kinds.length)) {
                // A long list of kinds is a disclosure: the heading is the button (chevron, "Kinds (9)").
                const heading = kinds.querySelector('.mapstudio-legend-heading') as HTMLElement;
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'mapstudio-legend-heading mapstudio-legend-heading-button';
                button.setAttribute('aria-expanded', open ? 'true' : 'false');
                button.setAttribute('data-focus-key', 'kinds');
                button.innerHTML = '<span>' + heading.textContent + '</span>' + glyphSvg('chevron', 'mapstudio-ctrl-glyph mapstudio-legend-chevron');
                button.addEventListener('click', this.handleKinds);
                kinds.replaceChild(button, heading);
                host.kindsButton = button;
            }
            if (open) {
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
                            class: 'mapstudio-legend-area-sample mapstudio-legend-token--lateral' }));
                    }
                    this.row(kinds, box, kind.name, 'mapstudio-legend-kind', { 'data-kind': kind.id });
                }
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
                if (line.arrow) {
                    // The flow arrows along the selected line, pointing the drawn direction (item 22).
                    for (const x of [8, 18]) {
                        box.appendChild(svgEl('path', { d: 'M' + (x - 3) + ' 7L' + (x + 3) + ' 12L' + (x - 3) + ' 17Z', class: 'mapstudio-legend-arrow-sample' }));
                    }
                }
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
    private renderShow(host: LegendHost, panel: HTMLElement): void {
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
            box.setAttribute('data-focus-key', 'toggle:' + toggle);
            box.checked = this.toggles[toggle];
            box.addEventListener('change', this.handleSwitch);
            label.appendChild(box);
            const words = document.createElement('span');
            words.textContent = toggle === 'lines' ? 'Lines' : 'Names';
            label.appendChild(words);
            group.appendChild(label);
            host.checkboxes.set(toggle, box);
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

    private renderBasemaps(host: LegendHost): void {
        const group = host.basemapGroup;
        if (!group) {
            return;
        }
        host.buttons.forEach((button) => button.removeEventListener('click', this.handleChoose));
        host.buttons.clear();
        while (group.firstChild) {
            group.removeChild(group.firstChild);
        }
        for (const id of this.offered) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'mapstudio-ctrl-button mapstudio-basemap-button';
            button.setAttribute('data-basemap', id);
            button.setAttribute('data-focus-key', 'basemap:' + id);
            button.setAttribute('aria-pressed', 'false');
            button.title = BASEMAP_LABELS[id];
            button.textContent = BASEMAP_LABELS[id];
            button.addEventListener('click', this.handleChoose);
            group.appendChild(button);
            host.buttons.set(id, button);
        }
        this.markSelected(host);
    }

    /** A place's basemap buttons pressed as the selection is. */
    private markSelected(host: LegendHost): void {
        host.buttons.forEach((button, key) => {
            const on = key === this.selected;
            button.setAttribute('aria-pressed', on ? 'true' : 'false');
            button.classList.toggle('mapstudio-basemap-button--on', on);
        });
    }

    private renderStatus(host: LegendHost): void {
        if (host.status) {
            host.status.textContent = this.statusText;
            host.status.hidden = this.statusText === '';
        }
    }

    /** The Kinds heading opens or closes the kinds (a long list starts closed, item 24), in every place alike. */
    private handleKinds = (ev: MouseEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        const button = ev.currentTarget as HTMLElement | null;
        this.kindsOpen = button ? button.getAttribute('aria-expanded') !== 'true' : true;
        this.fillAll();
    };

    /** The phone sheet's Close button. */
    private handleClose = (ev: MouseEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        this.close(true);
    };

    /** The window crossed the phone breakpoint with the panel open: sheet or card, drawn again. */
    private handleBreakpoint = (): void => {
        if (this.panel) {
            this.fill(this.panel);
        }
    };

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
            // One legend: the other place shows the same.
            this.syncCheckboxes();
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
