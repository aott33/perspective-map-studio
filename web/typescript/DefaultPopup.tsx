import * as React from 'react';
import { ItemValues, KindDisplay, alarmsText, commsText, itemState, staleText, valueText } from './live';

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
    /** The clock, for data ages (tests pass a fixed one). */
    now: number;
}

/** The sprite's symbol for a glyph, inline (`<use>`), in `currentColor`. */
function Glyph(props: { id: string; className: string }): React.ReactElement {
    return (
        <svg className={props.className} width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <use href={'/res/mapstudio/icons/mapstudio-icons.svg#ms-' + props.id} />
        </svg>
    );
}

/**
 * Map Studio's default popup (AD-7, EXPERIENCE.md "Popup card"; epic 3 entry 5): in order the
 * header (kind glyph, name, the page link icon slot, which entry 8 fills), comms with its data age,
 * two to three KPIs, then the alarms. Every state is said in words; a stale value is marked
 * "Stale - " with its reason; the comms-lost word takes the `comms-lost` token through its class.
 * The parts follow the kind's display: a part turned off is not drawn.
 */
export class DefaultPopup extends React.Component<DefaultPopupProps> {
    render(): React.ReactNode {
        const { item, display, values, now } = this.props;
        const state = itemState(values, display);
        const comms = commsText(values ? values.comms : undefined, now);
        const kpis = display.kpis.filter((k) => k.on).slice(0, 3);
        return (
            <div className="mapstudio-popup mapstudio-popup--default" data-point-id={item.id}
                 data-state={state.badge} data-stale={state.stale ? 'true' : 'false'}>
                <div className="mapstudio-popup-header" data-part="header">
                    <Glyph id={item.icon || 'point'} className="mapstudio-popup-glyph" />
                    <div className="mapstudio-popup-title">
                        <div className="mapstudio-popup-name">{item.name}</div>
                        <div className="mapstudio-popup-subline">{item.kindName}</div>
                    </div>
                    <span className="mapstudio-popup-link" data-link={display.link} aria-hidden="true" />
                </div>
                {display.comms ? (
                    <div className={'mapstudio-popup-comms' + (comms.lost ? ' mapstudio-popup-comms--lost' : '')}
                         data-part="comms" data-comms={comms.lost ? 'lost' : 'ok'}>
                        {comms.lost ? <Glyph id="comms-lost" className="mapstudio-popup-state-glyph" /> : null}
                        <span className="mapstudio-popup-label">Comms</span>
                        <span className="mapstudio-popup-value">{comms.word}{comms.detail ? ' - ' + comms.detail : ''}</span>
                    </div>
                ) : null}
                {kpis.length > 0 ? (
                    <div className="mapstudio-popup-kpis" data-part="kpis">
                        {kpis.map((kpi) => {
                            const value = values ? values.kpis[kpi.key] : undefined;
                            const text = value ? staleText(value, valueText(value, kpi.unit)) : 'No value yet';
                            return (
                                <div key={kpi.key} className={'mapstudio-popup-kpi' + (kpi.icon ? ' mapstudio-popup-kpi--icon' : '')}
                                     data-kpi={kpi.key} data-stale={value && value.stale ? 'true' : 'false'}>
                                    {value && value.stale ? <Glyph id="stale" className="mapstudio-popup-state-glyph" /> : null}
                                    <span className="mapstudio-popup-label">{kpi.label}</span>
                                    <span className="mapstudio-popup-value">{text}</span>
                                </div>
                            );
                        })}
                    </div>
                ) : null}
                {display.alarms.on ? (
                    <div className={'mapstudio-popup-alarms' + (state.alarm ? ' mapstudio-popup-alarms--active mapstudio-popup-alarms--p' + state.alarm.priority : '')}
                         data-part="alarms" data-alarm={state.alarm ? state.alarm.priority + ':' + (state.alarm.unacked ? 'unacked' : 'acked') : 'none'}
                         data-stale={values && values.alarms && values.alarms.stale ? 'true' : 'false'}>
                        {state.alarm ? <Glyph id={'alarm-' + state.alarm.priority + (state.alarm.priority === 3 ? '' : state.alarm.unacked ? '-unacknowledged' : '-acknowledged')} className="mapstudio-popup-alarm-glyph" /> : null}
                        <span className="mapstudio-popup-value">
                            {values && values.alarms && values.alarms.stale ? 'Stale - ' : ''}{alarmsText(values ? values.alarms : undefined)}
                        </span>
                    </div>
                ) : null}
            </div>
        );
    }
}
