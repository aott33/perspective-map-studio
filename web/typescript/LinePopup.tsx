import * as React from 'react';
import { SegmentRef } from './features';
import { DistanceUnits, distanceText } from './geometry';
import {
    PopupNode, instrumentsComms, instrumentsHeading, lineAlarms, lineSubline, nodeValue, rowName, segmentWords
} from './linePopup';
import { ItemValues, KindDisplay, alarmGlyphId, alarmStaleNote, alarmsText, commsText, itemState } from './live';
import { Chrome, CloseButton, Glyph, KpiRows, NoteRow } from './popupParts';

/** The line the popup is opened for. */
export interface LinePopupLine {
    id: string;
    name: string;
    kind: string;
    kindName: string;
    icon: string;
    diameter: unknown;
    lengthM: number;
}

export interface LinePopupProps {
    line: LinePopupLine;
    /** The line kind's display from the last full batch, or undefined without a setup. */
    display: KindDisplay | undefined;
    /** The line's own values from the last batch, or undefined before the first. */
    values: ItemValues | undefined;
    /** The nodes in order: the snapped start, each instrument, the snapped end (linePopup.ts, `popupNodes`). */
    nodes: PopupNode[];
    /** The segment the popup opened at, or null. */
    segment: SegmentRef | null;
    now: number;
    /** The units in force (entry 20a): the subline's length, each row's distance and the segment's span follow them. */
    units: DistanceUnits;
    onClose: () => void;
}

/**
 * A line's default popup (AD-7, DESIGN.md line-popup; epic 3 entry 2; the owner's review notes items 17
 * and 19), built to the UX review's padding rules (decisions D1 to D3): the header (pipeline glyph in a
 * disc, name, subline, the page link slot, the close button the point card has) and, pinned under it,
 * the segment box when a segment is open (none on a line with no measuring instrument), Comms over the
 * instruments, the line's own KPIs and an alarm summary naming the instrument in alarm; then only the
 * instrument list scrolls (about four rows), the two at the open segment's ends highlighted and
 * scrolled into view. Rows in option A's style: a stale value is the hourglass alone before the value,
 * the reason in the tooltip. Every state is said in words; token colours only.
 */
export class LinePopup extends React.Component<LinePopupProps> {
    private list = React.createRef<HTMLDivElement>();
    private scrolledTo = '';

    componentDidMount(): void {
        this.scrollHighlightedIntoView();
    }

    componentDidUpdate(): void {
        this.scrollHighlightedIntoView();
    }

    /** The first highlighted row into view, once per segment (a batch redraw must not fight the user's scrolling). */
    private scrollHighlightedIntoView(): void {
        const key = this.props.segment ? this.props.segment.fromId + '|' + this.props.segment.toId : '';
        const list = this.list.current;
        if (!list || key === this.scrolledTo) {
            return;
        }
        this.scrolledTo = key;
        const row = list.querySelector('.mapstudio-popup-instrument--highlighted') as HTMLElement | null;
        if (row && typeof row.scrollIntoView === 'function') {
            row.scrollIntoView({ block: 'nearest' });
        }
    }

    private renderComms(): React.ReactNode {
        const { display, values, nodes, now } = this.props;
        const comms = instrumentsComms(nodes, now);
        if (comms) {
            return (
                <NoteRow className={'mapstudio-popup-row mapstudio-popup-comms' + (comms.lost ? ' mapstudio-popup-comms--lost' : '')}
                         note={comms.note}
                         data={{ 'data-part': 'comms', 'data-comms': comms.lost ? 'lost' : 'ok' }}>
                    <span className="mapstudio-popup-label">Comms</span>
                    <span className="mapstudio-popup-value">
                        {comms.state !== 'ok' ? <Glyph id={comms.state} className="mapstudio-popup-state-glyph" />
                            : <Chrome name="check" className="mapstudio-popup-state-glyph mapstudio-popup-ok-glyph" />}
                        {comms.word}{comms.detail ? ' - ' + comms.detail : ''}
                    </span>
                </NoteRow>
            );
        }
        if (!display || !display.comms) {
            return null;
        }
        const problem = values ? values.problems.find((p) => p.slot === 'comms') : undefined;
        const own = commsText(values ? values.comms : undefined, now, problem ? problem.reason : '');
        return (
            <NoteRow className={'mapstudio-popup-row mapstudio-popup-comms' + (own.lost ? ' mapstudio-popup-comms--lost' : '')
                         + (own.unknown ? ' mapstudio-popup-comms--unknown' : '')}
                     note={own.code !== '' ? own.word + (own.detail ? ' - ' + own.detail : '') + ' (' + own.code + ')' : ''}
                     data={{ 'data-part': 'comms', 'data-comms': own.lost ? 'lost' : own.unknown ? 'unknown' : 'ok', 'data-quality': own.code }}>
                <span className="mapstudio-popup-label">Comms</span>
                <span className="mapstudio-popup-value">
                    {own.unknown ? null : own.lost ? <Glyph id="comms-lost" className="mapstudio-popup-state-glyph" />
                        : <Chrome name="check" className="mapstudio-popup-state-glyph mapstudio-popup-ok-glyph" />}
                    {own.word}{own.detail ? ' - ' + own.detail : ''}
                </span>
            </NoteRow>
        );
    }

    /**
     * The alarm summary (item 19): the instruments' and the line's active alarms in the worst priority's
     * tint, naming the instrument; with the line's alarms on and none active, "No active alarms" (the
     * hourglass before it while the line's comms are lost or its alarms stale, item 13).
     */
    private renderAlarms(): React.ReactNode {
        const { display, values, nodes, now } = this.props;
        const alarms = lineAlarms(nodes, values, display);
        if (alarms) {
            return (
                <div className={'mapstudio-popup-alarms mapstudio-popup-alarms--active mapstudio-popup-alarms--p' + alarms.priority}
                     data-part="alarms" data-alarm={alarms.priority + ':' + (alarms.unacked ? 'unacked' : 'acked')} data-alarm-count={String(alarms.count)}>
                    <div className="mapstudio-popup-alarm-heading">
                        <Glyph id={alarmGlyphId(alarms.priority, alarms.unacked)} className="mapstudio-popup-alarm-glyph" size={16} />
                        <span className="mapstudio-popup-alarm-words">{alarms.heading}</span>
                    </div>
                    {alarms.detail !== '' ? <div className="mapstudio-popup-alarm-line">{alarms.detail}</div> : null}
                </div>
            );
        }
        if (!display || !display.alarms.on) {
            return null;
        }
        const note = alarmStaleNote(values, display, now);
        const state = itemState(values, display);
        return (
            <div className="mapstudio-popup-alarms" data-part="alarms" data-alarm="none" data-stale={note !== '' ? 'true' : 'false'}>
                <NoteRow className="mapstudio-popup-alarm-heading" note={note}>
                    {note !== '' ? <Glyph id="stale" className="mapstudio-popup-state-glyph mapstudio-popup-alarm-stale" size={16} /> : null}
                    <span className="mapstudio-popup-alarm-words">{state.alarm ? '' : alarmsText(values ? values.alarms : undefined)}</span>
                </NoteRow>
            </div>
        );
    }

    render(): React.ReactNode {
        const { line, display, values, nodes, segment } = this.props;
        const state = itemState(values, display);
        const words = segmentWords(nodes, segment, this.props.units);
        const anyStale = nodes.some((n) => n.role === 'instrument' && nodeValue(n).stale) || state.stale;
        const instruments = nodes.some((n) => n.role === 'instrument');
        return (
            <div className="mapstudio-popup mapstudio-popup--card mapstudio-popup--line" data-line-id={line.id}
                 data-state={state.badge} data-stale={anyStale ? 'true' : 'false'}
                 data-segment={words && segment ? segment.fromId + '|' + segment.toId : ''}>
                <div className="mapstudio-popup-header mapstudio-popup-card-header" data-part="header">
                    <span className="mapstudio-popup-glyph-disc"><Glyph id={line.icon || 'pipeline'} className="mapstudio-popup-glyph" /></span>
                    <div className="mapstudio-popup-title">
                        <div className="mapstudio-popup-name">{line.name}</div>
                        <div className="mapstudio-popup-subline">{lineSubline(line.kindName, line.diameter, line.lengthM, this.props.units)}</div>
                    </div>
                    <span className="mapstudio-popup-link" data-link={display ? display.link : ''} aria-hidden="true" />
                    <CloseButton onClose={this.props.onClose} />
                </div>
                <div className="mapstudio-popup-body">
                    <div className="mapstudio-popup-pinned" data-part-group="pinned">
                        {words ? (
                            <div className="mapstudio-popup-segment" data-part="segment" data-stale={words.stale ? 'true' : 'false'}>
                                <div className="mapstudio-popup-segment-head">
                                    <span className="mapstudio-popup-segment-title">{words.title}</span>
                                    <span className="mapstudio-popup-segment-span">{words.span}</span>
                                </div>
                                <div className="mapstudio-popup-segment-line">
                                    {words.stale ? <Glyph id="stale" className="mapstudio-popup-state-glyph" /> : null}
                                    <span>{words.line}</span>
                                </div>
                            </div>
                        ) : null}
                        {this.renderComms()}
                        {display ? <KpiRows display={display} values={values} /> : null}
                        {this.renderAlarms()}
                    </div>
                    {instruments ? (
                        <div className="mapstudio-popup-instruments" data-part="instruments" data-rows={String(nodes.length)}>
                            <div className="mapstudio-popup-section-label">{instrumentsHeading(nodes)}</div>
                            <div className="mapstudio-popup-instrument-list" ref={this.list}>
                                {nodes.map((node) => {
                                    const v = nodeValue(node);
                                    return (
                                        <NoteRow key={node.id + ':' + node.role} note={v.note}
                                                 className={'mapstudio-popup-row mapstudio-popup-instrument' + (node.highlighted ? ' mapstudio-popup-instrument--highlighted' : '')}
                                                 data={{ 'data-row-id': node.id, 'data-role': node.role, 'data-highlighted': node.highlighted ? 'true' : 'false',
                                                     'data-stale': v.stale ? 'true' : 'false',
                                                     'data-alarm': v.alarm ? v.alarm.priority + ':' + (v.alarm.unacked ? 'unacked' : 'acked') : 'none' }}>
                                            {node.role === 'instrument'
                                                ? <Glyph id={node.icon || 'point'} className="mapstudio-popup-row-glyph" />
                                                : (
                                                    <svg className="mapstudio-popup-row-glyph" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                                                        <rect x="7" y="7" width="10" height="10" fill="currentColor" />
                                                    </svg>
                                                )}
                                            <span className="mapstudio-popup-row-name">{rowName(node)}</span>
                                            <span className="mapstudio-popup-row-distance">{distanceText(node.distanceM, this.props.units)}</span>
                                            <span className={'mapstudio-popup-value' + (v.hasValue && !v.stale ? ' mapstudio-popup-value--key' : '')}>
                                                {v.alarm ? <Glyph id={alarmGlyphId(v.alarm.priority, v.alarm.unacked)} className={'mapstudio-popup-alarm-glyph mapstudio-popup-alarm-glyph--p' + v.alarm.priority} /> : null}
                                                {v.alarm ? <span className={'mapstudio-popup-alarm-digit mapstudio-popup-alarm-glyph--p' + v.alarm.priority}>{v.alarm.priority}</span> : null}
                                                {v.stale ? <Glyph id={v.commsLost ? 'comms-lost' : 'stale'} className="mapstudio-popup-state-glyph" /> : null}
                                                {v.text}
                                            </span>
                                        </NoteRow>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }
}
