import * as React from 'react';
import { SegmentRef } from './features';
import { PopupNode, distanceText, instrumentsComms, instrumentsHeading, lineSubline, nodeValue, rowName, segmentWords } from './linePopup';
import { ItemValues, KindDisplay, alarmGlyphId, alarmsText, commsText, itemState } from './live';
import { CloseButton, Glyph, KpiRows } from './popupParts';

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
    onClose: () => void;
}

/**
 * A line's default popup (AD-7, DESIGN.md line-popup; epic 3 entry 2), built to the UX review's
 * padding rules (decisions D1 to D3): the header (pipeline glyph in a disc, name, subline, the page
 * link slot, the close button the point card has), the segment box when a segment is open, Comms over the instruments,
 * the instruments in order between the items the ends snap to (the two at the open segment's ends
 * highlighted), the line's own KPIs, and its alarms where its setup turns them on. Every state is
 * said in words; token colours only.
 */
export class LinePopup extends React.Component<LinePopupProps> {
    render(): React.ReactNode {
        const { line, display, values, nodes, segment, now } = this.props;
        const state = itemState(values, display);
        const words = segmentWords(nodes, segment);
        const comms = instrumentsComms(nodes, now);
        const ownComms = display && display.comms ? commsText(values ? values.comms : undefined, now) : null;
        const anyStale = nodes.some((n) => n.role === 'instrument' && nodeValue(n).stale) || state.stale;
        return (
            <div className="mapstudio-popup mapstudio-popup--card mapstudio-popup--line" data-line-id={line.id}
                 data-state={state.badge} data-stale={anyStale ? 'true' : 'false'}
                 data-segment={segment ? segment.fromId + '|' + segment.toId : ''}>
                <div className="mapstudio-popup-header mapstudio-popup-card-header" data-part="header">
                    <span className="mapstudio-popup-glyph-disc"><Glyph id={line.icon || 'pipeline'} className="mapstudio-popup-glyph" /></span>
                    <div className="mapstudio-popup-title">
                        <div className="mapstudio-popup-name">{line.name}</div>
                        <div className="mapstudio-popup-subline">{lineSubline(line.kindName, line.diameter, line.lengthM)}</div>
                    </div>
                    <span className="mapstudio-popup-link" data-link={display ? display.link : ''} aria-hidden="true" />
                    <CloseButton onClose={this.props.onClose} />
                </div>
                <div className="mapstudio-popup-body">
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
                    {comms ? (
                        <div className={'mapstudio-popup-row mapstudio-popup-comms' + (comms.lost ? ' mapstudio-popup-comms--lost' : '')}
                             data-part="comms" data-comms={comms.lost ? 'lost' : 'ok'}>
                            <span className="mapstudio-popup-label">Comms</span>
                            <span className="mapstudio-popup-value">
                                {comms.lost ? <Glyph id={comms.word.endsWith('comms lost') ? 'comms-lost' : 'stale'} className="mapstudio-popup-state-glyph" /> : null}
                                {comms.word}{comms.detail ? ' - ' + comms.detail : ''}
                            </span>
                        </div>
                    ) : ownComms ? (
                        <div className={'mapstudio-popup-row mapstudio-popup-comms' + (ownComms.lost ? ' mapstudio-popup-comms--lost' : '')}
                             data-part="comms" data-comms={ownComms.lost ? 'lost' : 'ok'}>
                            <span className="mapstudio-popup-label">Comms</span>
                            <span className="mapstudio-popup-value">{ownComms.word}{ownComms.detail ? ' - ' + ownComms.detail : ''}</span>
                        </div>
                    ) : null}
                    {nodes.some((n) => n.role === 'instrument') ? (
                        <div className="mapstudio-popup-instruments" data-part="instruments" data-rows={String(nodes.length)}>
                            <div className="mapstudio-popup-section-label">{instrumentsHeading(nodes)}</div>
                            {nodes.map((node) => {
                                const v = nodeValue(node);
                                return (
                                    <div key={node.id + ':' + node.role}
                                         className={'mapstudio-popup-row mapstudio-popup-instrument' + (node.highlighted ? ' mapstudio-popup-instrument--highlighted' : '')}
                                         data-row-id={node.id} data-role={node.role} data-highlighted={node.highlighted ? 'true' : 'false'}
                                         data-stale={v.stale ? 'true' : 'false'}
                                         data-alarm={v.alarm ? v.alarm.priority + ':' + (v.alarm.unacked ? 'unacked' : 'acked') : 'none'}>
                                        {node.role === 'instrument'
                                            ? <Glyph id={node.icon || 'point'} className="mapstudio-popup-row-glyph" />
                                            : (
                                                <svg className="mapstudio-popup-row-glyph" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                                                    <rect x="7" y="7" width="10" height="10" fill="currentColor" />
                                                </svg>
                                            )}
                                        <span className="mapstudio-popup-row-name">{rowName(node)}</span>
                                        <span className="mapstudio-popup-row-distance">{distanceText(node.distanceM)}</span>
                                        <span className={'mapstudio-popup-value' + (v.hasValue && !v.stale ? ' mapstudio-popup-value--key' : '')}>
                                            {v.alarm ? <Glyph id={alarmGlyphId(v.alarm.priority, v.alarm.unacked)} className={'mapstudio-popup-alarm-glyph mapstudio-popup-alarm-glyph--p' + v.alarm.priority} /> : null}
                                            {v.alarm ? <span className={'mapstudio-popup-alarm-digit mapstudio-popup-alarm-glyph--p' + v.alarm.priority}>{v.alarm.priority}</span> : null}
                                            {v.stale ? <Glyph id={v.commsLost ? 'comms-lost' : 'stale'} className="mapstudio-popup-state-glyph" /> : null}
                                            {v.text}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}
                    {display ? <KpiRows display={display} values={values} /> : null}
                    {display && display.alarms.on ? (
                        <div className={'mapstudio-popup-alarms' + (state.alarm ? ' mapstudio-popup-alarms--active mapstudio-popup-alarms--p' + state.alarm.priority : '')}
                             data-part="alarms" data-alarm={state.alarm ? state.alarm.priority + ':' + (state.alarm.unacked ? 'unacked' : 'acked') : 'none'}
                             data-stale={values && values.alarms && values.alarms.stale ? 'true' : 'false'}>
                            {state.alarm ? <Glyph id={alarmGlyphId(state.alarm.priority, state.alarm.unacked)} className="mapstudio-popup-alarm-glyph" /> : null}
                            <span className="mapstudio-popup-value">
                                {values && values.alarms && values.alarms.stale ? 'Stale - ' : ''}{alarmsText(values ? values.alarms : undefined)}
                            </span>
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }
}
