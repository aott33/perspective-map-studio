import * as React from 'react';
import { ItemValues, KindDisplay, LiveValue, NO_DATA, capitalised, qualityWords, staleWords, valueText } from './live';

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
 * A row whose state glyph carries a note (the stale reason, a no-data reason) in a tooltip, and shows
 * the same words under the row on a tap or a click (owner review notes item 13: on a phone a tap on
 * the icon shows the words the hover shows). The note line is in the DOM only while it is shown.
 */
export class NoteRow extends React.Component<{ className: string; note: string; data?: Record<string, string>; children?: React.ReactNode },
    { shown: boolean }> {
    state = { shown: false };

    private toggle = (): void => {
        if (this.props.note !== '') {
            this.setState((s) => ({ shown: !s.shown }));
        }
    };

    render(): React.ReactNode {
        const { className, note, data, children } = this.props;
        const shown = this.state.shown && note !== '';
        return (
            <div className={className + (note !== '' ? ' mapstudio-popup-row--noted' : '')} {...(data || {})}
                 title={note !== '' ? note : undefined} onClick={this.toggle} data-note-shown={shown ? 'true' : 'false'}>
                {children}
                {shown ? <span className="mapstudio-popup-note">{note}</span> : null}
            </div>
        );
    }
}

/** The no-data words of a KPI slot with no value: "No data", the quality in plain words as the note. */
function noDataNote(value: LiveValue | undefined): string {
    if (!value) {
        return '';
    }
    const words = qualityWords(value.reason !== '' ? value.reason : value.quality);
    return words === '' || words === 'no value yet' ? '' : capitalised(words) + (words !== value.quality ? ' (' + value.quality + ')' : '');
}

/**
 * The KPI rows of a popup (option A, owner review notes items 13, 15 and 21): the kind display's KPIs
 * that are on, three at most, each with its full label and its value in its unit right-aligned (the
 * icon KPI as the key value); "No data" before the first value, the reason in its tooltip; a stale value shows the hourglass
 * alone before the value, the reason in plain words in the row's tooltip ("Stale - comms lost", "Stale -
 * bad quality") and under the row on a tap. The quality name stays in `data-quality` for tests.
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
                const hasValue = !!value && value.value !== null && value.value !== undefined;
                const text = hasValue ? valueText(value!, kpi.unit) : NO_DATA;
                const stale = !!value && value.stale && hasValue;
                const note = stale ? staleWords(value!) : noDataNote(value);
                return (
                    <NoteRow key={kpi.key} note={note}
                             className={'mapstudio-popup-row mapstudio-popup-kpi' + (kpi.icon ? ' mapstudio-popup-kpi--icon' : '')
                                 + (hasValue ? '' : ' mapstudio-popup-kpi--none')}
                             data={{ 'data-kpi': kpi.key, 'data-stale': stale ? 'true' : 'false', 'data-quality': value ? value.quality : '' }}>
                        <span className="mapstudio-popup-label">{kpi.label}</span>
                        <span className="mapstudio-popup-value">
                            {stale ? <Glyph id="stale" className="mapstudio-popup-state-glyph" size={16} /> : null}
                            {text}
                        </span>
                    </NoteRow>
                );
            })}
        </div>
    );
}
