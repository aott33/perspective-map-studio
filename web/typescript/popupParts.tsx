import * as React from 'react';
import { ItemValues, KindDisplay, staleText, valueText } from './live';

/**
 * The parts the point popup (DefaultPopup.tsx) and the line popup (LinePopup.tsx) share (epic 3
 * entry 11, the sweep after entries 2 and 8 each built their own): the sprite glyph, the chrome
 * glyphs of the header and the KPI rows. Token colours only, through the classes in mapstudio.css.
 */

/** The sprite's symbol for a glyph, inline (`<use>`), in `currentColor`. */
export function Glyph(props: { id: string; className: string; size?: number }): React.ReactElement {
    const size = props.size || 24;
    return (
        <svg className={props.className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <use href={'/res/mapstudio/icons/mapstudio-icons.svg#ms-' + props.id} />
        </svg>
    );
}

/** The chrome glyphs of the popup, on a 24 px grid with a 2 px stroke in `currentColor` (as the controls'). */
const CHROME = {
    /** Pop-out: an arrow leaving a box (the mockup's page link icon). */
    popout: 'M14 4h6v6M20 4l-9 9M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6',
    close: 'M6 6l12 12M18 6L6 18',
    /** A check mark: "No active alarms". */
    check: 'M5 12.5l4.5 4.5L19 7'
} as const;

export function Chrome(props: { name: keyof typeof CHROME; className: string }): React.ReactElement {
    return (
        <svg className={props.className} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
            <path d={CHROME[props.name]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

/** The popup's close button: Map Studio's own, in the header (UX review P1), 32 px on a card and 44 px on the sheet or a phone. */
export function CloseButton(props: { onClose: () => void }): React.ReactElement {
    return (
        <button type="button" className="mapstudio-popup-icon mapstudio-popup-close" aria-label="Close" title="Close" onClick={props.onClose}>
            <Chrome name="close" className="mapstudio-popup-chrome" />
        </button>
    );
}

/**
 * The KPI rows of a popup: the kind display's KPIs that are on, three at most, each with its label,
 * its value in its unit (the icon KPI as the key value), "No value yet" before the first batch, and a
 * stale value marked with the glyph and "Stale - " and its reason.
 */
export function KpiRows(props: { display: KindDisplay; values: ItemValues | undefined }): React.ReactElement | null {
    const kpis = props.display.kpis.filter((k) => k.on).slice(0, 3);
    if (kpis.length === 0) {
        return null;
    }
    return (
        <div className="mapstudio-popup-kpis" data-part="kpis">
            {kpis.map((kpi) => {
                const value = props.values ? props.values.kpis[kpi.key] : undefined;
                const text = value ? staleText(value, valueText(value, kpi.unit)) : 'No value yet';
                return (
                    <div key={kpi.key} className={'mapstudio-popup-row mapstudio-popup-kpi' + (kpi.icon ? ' mapstudio-popup-kpi--icon' : '')}
                         data-kpi={kpi.key} data-stale={value && value.stale ? 'true' : 'false'}>
                        <span className="mapstudio-popup-label">{kpi.label}</span>
                        <span className="mapstudio-popup-value">
                            {value && value.stale ? <Glyph id="stale" className="mapstudio-popup-state-glyph" size={16} /> : null}
                            {text}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
