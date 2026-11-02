import * as React from 'react';
import {
    ItemValues, KindDisplay, PopupDetail, alarmCountsText, alarmGlyphId, alarmLineText, alarmStaleNote, alarmsText, alarmsUnknown,
    capitalised, commsText, itemState, qualityWords
} from './live';
import { Chrome, CloseButton, Glyph, KpiRows, NoteRow } from './popupParts';

/** What the default popup is opened for: the map item and its kind's icon. */
export interface DefaultPopupItem {
    id: string;
    name: string;
    kind: string;
    kindName: string;
    icon: string;
}

export interface DefaultPopupProps {
    item: DefaultPopupItem;
    /** The kind's display from the last full batch. */
    display: KindDisplay;
    /** The item's values from the last batch, or undefined before the first. */
    values: ItemValues | undefined;
    /** The popup detail pushed for this item (the alarm summary), or null before it arrived. */
    detail: PopupDetail | null;
    /** The clock, for data ages (tests pass a fixed one). */
    now: number;
    /** The kind setup's link filled for this item, or null (no link, or a placeholder with no value: the icon hides, R8). */
    link: string | null;
    /** The setup's alarm page filled for this item, or null (the View alarms button then hides). */
    alarmPage: string | null;
    /** The card over the map with its pointer, or the phone's bottom sheet (DESIGN.md bottom-sheet). */
    mode: 'card' | 'sheet';
    /** Whether the sheet offers Edit (phone-editing roles, once epic-editing builds the edit sheet). */
    canEdit: boolean;
    onClose: () => void;
    /** Open a Perspective page of the project (the pop-out link, View alarms). */
    onNavigate: (path: string) => void;
}

/**
 * Map Studio's default popup (AD-7, EXPERIENCE.md "Popup card" and "Bottom sheet"; epic 3 entries 5
 * and 8; the owner's option A, review notes items 13, 15 and 21): in order the header (the kind glyph
 * in a disc, the name, the kind as subline, the pop-out page link when it has a value, close), comms
 * with its status and age right-aligned, two to three KPIs (a stale value as the hourglass alone before
 * the value, the reason in the tooltip; "No data yet" before a value), then the alarm block (the counts
 * and the most important alarms in words with their age, from the Gateway's alarm status, and View
 * alarms to the project's alarm page; Map Studio acknowledges nothing; no check mark before "No active
 * alarms", the hourglass before it while comms are lost or the alarms are stale, since no alarm may
 * only mean no fresh data; "Alarm state unknown" with no data). The comms-lost word takes the
 * `comms-lost` token through its class; the alarm hue sits on the glyph and the heading only. The
 * parts follow the kind's display: a part turned off is not drawn. Below 768 px the same body is a
 * bottom sheet with a handle, 44 px header buttons and a footer with View alarms (and Edit for
 * phone-editing roles).
 */
export class DefaultPopup extends React.Component<DefaultPopupProps> {
    private onLink = (): void => {
        if (this.props.link) {
            this.props.onNavigate(this.props.link);
        }
    };

    private onViewAlarms = (): void => {
        if (this.props.alarmPage) {
            this.props.onNavigate(this.props.alarmPage);
        }
    };

    private renderAlarms(sheet: boolean): React.ReactNode {
        const { display, values, detail, now, alarmPage } = this.props;
        if (!display.alarms.on) {
            return null;
        }
        const state = itemState(values, display);
        const slot = values ? values.alarms : undefined;
        const unknown = alarmsUnknown(slot);
        const summary = detail && detail.alarms ? detail.alarms : null;
        const alarm = state.alarm;
        const heading = alarmsText(slot);
        // The hourglass before the words while the alarm state may be out of date (item 13), its reason in the tooltip.
        const note = unknown ? (slot ? capitalised(qualityWords(slot.reason !== '' ? slot.reason : slot.quality)) : '') : alarmStaleNote(values, display, now);
        const stale = !unknown && note !== '';
        const first = summary && summary.list.length > 0 ? summary.list[0] : null;
        const more = alarm ? alarm.active - 1 : 0;
        const counts = summary ? alarmCountsText(summary) : '';
        const viewAlarms = alarm !== null && alarmPage !== null;
        return (
            <div className={'mapstudio-popup-alarms' + (alarm ? ' mapstudio-popup-alarms--active mapstudio-popup-alarms--p' + alarm.priority : '')
                     + (unknown ? ' mapstudio-popup-alarms--unknown' : '')}
                 data-part="alarms"
                 data-alarm={alarm ? alarm.priority + ':' + (alarm.unacked ? 'unacked' : 'acked') : unknown ? 'unknown' : 'none'}
                 data-alarm-counts={summary ? summary.counts[1] + ',' + summary.counts[2] + ',' + summary.counts[3] : ''}
                 data-alarm-listed={summary ? String(summary.list.length) : ''}
                 data-stale={stale ? 'true' : 'false'}>
                <NoteRow className="mapstudio-popup-alarm-heading" note={note}>
                    {alarm ? <Glyph id={alarmGlyphId(alarm.priority, alarm.unacked)} className="mapstudio-popup-alarm-glyph" size={16} /> : null}
                    {stale ? <Glyph id="stale" className="mapstudio-popup-state-glyph mapstudio-popup-alarm-stale" size={16} /> : null}
                    <span className="mapstudio-popup-alarm-words">{heading}</span>
                </NoteRow>
                {alarm && counts !== '' ? <div className="mapstudio-popup-alarm-counts">{counts}</div> : null}
                {alarm && first ? <div className="mapstudio-popup-alarm-line">{alarmLineText(first, now)}</div> : null}
                {alarm && !first && summary && summary.reason !== '' ? (
                    <div className="mapstudio-popup-alarm-line mapstudio-popup-alarm-line--reason">
                        {'The alarms could not be listed: ' + summary.reason + '.'}
                    </div>
                ) : null}
                {alarm && more > 0 ? <div className="mapstudio-popup-alarm-more">{'+ ' + more + ' more'}</div> : null}
                {viewAlarms && !sheet ? (
                    <button type="button" className="mapstudio-popup-button mapstudio-popup-button--primary mapstudio-popup-view-alarms"
                            onClick={this.onViewAlarms}>View alarms</button>
                ) : null}
            </div>
        );
    }

    render(): React.ReactNode {
        const { item, display, values, now, link, alarmPage, mode, canEdit } = this.props;
        const sheet = mode === 'sheet';
        const state = itemState(values, display);
        const problem = values ? values.problems.find((p) => p.slot === 'comms') : undefined;
        const comms = commsText(values ? values.comms : undefined, now, problem ? problem.reason : '');
        const viewAlarms = state.alarm !== null && alarmPage !== null;
        return (
            <div className={'mapstudio-popup mapstudio-popup--default' + (sheet ? ' mapstudio-popup--sheet' : ' mapstudio-popup--card')}
                 data-point-id={item.id} data-popup-mode={mode}
                 data-state={state.badge} data-stale={state.stale ? 'true' : 'false'}>
                {sheet ? <div className="mapstudio-popup-handle" aria-hidden="true" /> : null}
                <div className="mapstudio-popup-header" data-part="header">
                    <span className="mapstudio-popup-disc"><Glyph id={item.icon || 'point'} className="mapstudio-popup-glyph" size={18} /></span>
                    <div className="mapstudio-popup-title">
                        <div className="mapstudio-popup-name">{item.name}</div>
                        <div className="mapstudio-popup-subline">{item.kindName}</div>
                    </div>
                    {link !== null ? (
                        <button type="button" className="mapstudio-popup-icon mapstudio-popup-link" data-link={link}
                                aria-label={'Open the page of ' + item.name} title="Open page" onClick={this.onLink}>
                            <Chrome name="popout" className="mapstudio-popup-chrome" />
                        </button>
                    ) : null}
                    <CloseButton onClose={this.props.onClose} />
                </div>
                <div className="mapstudio-popup-body">
                    {display.comms ? (
                        <NoteRow className={'mapstudio-popup-row mapstudio-popup-comms' + (comms.lost ? ' mapstudio-popup-comms--lost' : '')
                                     + (comms.unknown ? ' mapstudio-popup-comms--unknown' : '')}
                                 note={comms.code !== '' ? comms.word + (comms.detail ? ' - ' + comms.detail : '') + ' (' + comms.code + ')' : ''}
                                 data={{ 'data-part': 'comms', 'data-comms': comms.lost ? 'lost' : comms.unknown ? 'unknown' : 'ok', 'data-quality': comms.code }}>
                            <span className="mapstudio-popup-label">Comms</span>
                            <span className="mapstudio-popup-value">
                                {comms.unknown ? null : comms.lost ? <Glyph id="comms-lost" className="mapstudio-popup-state-glyph" size={16} />
                                    : <Chrome name="check" className="mapstudio-popup-state-glyph mapstudio-popup-ok-glyph" />}
                                {comms.word}{comms.detail ? ' - ' + comms.detail : ''}
                            </span>
                        </NoteRow>
                    ) : null}
                    <KpiRows display={display} values={values} />
                    {this.renderAlarms(sheet)}
                </div>
                {sheet && (viewAlarms || canEdit) ? (
                    <div className="mapstudio-popup-footer" data-part="footer">
                        {viewAlarms ? (
                            <button type="button" className="mapstudio-popup-button mapstudio-popup-button--primary mapstudio-popup-view-alarms"
                                    onClick={this.onViewAlarms}>View alarms</button>
                        ) : null}
                        {canEdit ? <button type="button" className="mapstudio-popup-button mapstudio-popup-edit">Edit</button> : null}
                    </div>
                ) : null}
            </div>
        );
    }
}
