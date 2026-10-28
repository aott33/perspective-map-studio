/**
 * The pick list a shared marker opens (epic 3 entry 7, R5; the template's docs/map.md section 5
 * item 8): one row per map item the marker stands for, each row doing what a click on that item's
 * own marker does. Rendered into the MapLibre popup through a portal; token colours only.
 */

import * as React from 'react';

export interface PickRow {
    id: string;
    name: string;
    kindName: string;
    /** 'alarm', 'comms-lost', 'stale' or 'normal', said in words beside the name. */
    state: string;
}

const STATE_WORDS: Record<string, string> = { 'alarm': 'Alarm', 'comms-lost': 'Comms lost', 'stale': 'Stale', 'normal': '' };

export function PickList(props: { rows: PickRow[]; onPick: (id: string) => void }): JSX.Element {
    return (
        <div className="mapstudio-popup mapstudio-popup--pick" data-part="pick" data-rows={String(props.rows.length)}>
            <div className="mapstudio-pick-title">{props.rows.length} items here</div>
            {props.rows.map((row) => (
                <button key={row.id} type="button" className="mapstudio-pick-row" data-item-id={row.id} data-state={row.state}
                        onClick={() => props.onPick(row.id)}>
                    <span className="mapstudio-pick-name">{row.name}</span>
                    <span className="mapstudio-pick-kind">{row.kindName}</span>
                    {STATE_WORDS[row.state] ? <span className="mapstudio-pick-state">{STATE_WORDS[row.state]}</span> : null}
                </button>
            ))}
        </div>
    );
}
