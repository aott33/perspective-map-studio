import * as React from 'react';
import { HistoryEntry } from '../contract';
import {
    ExpandOp, HistoryRowData, HistoryState, REVERT_FOOTER, canShowOlder, nextUndoText, unreadText
} from '../history';
import { PAUSED_TEXT } from './UndoGroup';

/**
 * Recent changes, the rail's History surface in the left dock (epic-editing entry 11b, R18; DESIGN.md Recent changes panel,
 * EXPERIENCE.md Recent changes, owner 2026-11-05): under the dock's header (its title and the save status row, as the other
 * surfaces) a note box naming the next undo step ("Next undo is one step: Undo: edit 3 pads") with an Undo button that is the
 * toolbar's Undo (disabled with the same reason), "Nothing to undo yet" with none; then one row per saved batch, newest first:
 * who as an initial avatar, what in a sentence, who and when in tiny text, and a ghost Revert (or why there is none, in words).
 * A row expands with a click, Enter or Space (`aria-expanded`) to the values before and after of each op. "Show older" asks the
 * next page; a failed read says so in words with Try again. A footer says what Revert does.
 *
 * For tests: the dock `.mapstudio-history` (`data-rows`, `data-loading`, `data-error`, `data-more`), the note box
 * `.mapstudio-history-next` with `.mapstudio-history-undo`, each row `.mapstudio-history-row` (`data-seq`, `data-actor`,
 * `data-expanded`, `data-revert` `offered` or `blocked`) with `.mapstudio-history-summary`, `.mapstudio-history-sentence`,
 * `.mapstudio-history-meta`, `.mapstudio-history-revert` or `.mapstudio-history-norevert`, and `.mapstudio-history-detail` while
 * expanded; `.mapstudio-history-older`, `.mapstudio-history-error` with `.mapstudio-history-retry`, `.mapstudio-history-footer`.
 */
export interface HistoryPanelProps {
    /** The dock's header (title and save status row), drawn by the component as for the other surfaces. */
    header: React.ReactNode;
    history: HistoryState;
    rows: HistoryRowData[];
    /** What a row expands to, by its entry (history.ts `expandOps` with the component's names). */
    expand: (entry: HistoryEntry) => ExpandOp[];
    /** The last done step's words ("edit 3 pads"), '' with nothing to undo. */
    lastStep: string;
    /** The toolbar's Undo label ("Undo: edit 3 pads"), '' when it cannot undo now. */
    undoLabel: string;
    /** What is in flight ("Undoing...", "Saving..."), '' for nothing (undoStack.ts `busyText`). */
    busy: string;
    paused: boolean;
    onUndo: () => void;
    onRevert: (seq: number) => void;
    onOlder: () => void;
    onRetry: () => void;
}

interface HistoryPanelState {
    /** The rows expanded, by seq. */
    open: number[];
}

function Detail(props: { ops: ExpandOp[]; id: string }): React.ReactElement {
    return (
        <div className="mapstudio-history-detail" id={props.id}>
            {props.ops.map((op, i) => (
                <div key={i} className="mapstudio-history-op">
                    <div className="mapstudio-history-op-title">{op.title}</div>
                    {op.fields.length > 0 ? (
                        <table className="mapstudio-history-fields">
                            <thead>
                                <tr><th scope="col">Field</th><th scope="col">Before</th><th scope="col">After</th></tr>
                            </thead>
                            <tbody>
                                {op.fields.map((f, j) => (
                                    <tr key={j} className="mapstudio-history-field" data-label={f.label}>
                                        <th scope="row">{f.label}</th>
                                        <td className="mapstudio-history-before">{f.before}</td>
                                        <td className="mapstudio-history-after">{f.after}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : null}
                    {op.note !== '' ? <div className="mapstudio-history-op-note">{op.note}</div> : null}
                </div>
            ))}
        </div>
    );
}

export class HistoryPanel extends React.Component<HistoryPanelProps, HistoryPanelState> {
    state: HistoryPanelState = { open: [] };

    private readonly idBase = 'mapstudio-history-' + Math.random().toString(36).slice(2, 8);

    private toggle(seq: number): void {
        this.setState((prev) => ({ open: prev.open.indexOf(seq) >= 0 ? prev.open.filter((s) => s !== seq) : prev.open.concat([seq]) }));
    }

    render(): React.ReactElement {
        const p = this.props;
        const h = p.history;
        const undoOff = p.paused || p.busy !== '' || p.undoLabel === '';
        const undoTitle = p.paused ? PAUSED_TEXT : p.busy || (p.undoLabel !== '' ? p.undoLabel : 'Nothing to undo');
        const entries = new Map(h.entries.map((e) => [e.seq, e]));
        const unread = unreadText(h);
        const firstFailed = h.errorOn === 'first' && h.error !== '';
        const olderFailed = h.errorOn === 'older' && h.error !== '';
        return (
            <section className="mapstudio-dock mapstudio-dock--history mapstudio-history" aria-label="Recent changes" data-surface="history"
                     data-rows={String(p.rows.length)} data-loading={h.loading || ''} data-error={h.error !== '' ? h.errorOn || '' : ''}
                     data-more={canShowOlder(h) ? 'true' : 'false'}>
                {p.header}
                <div className="mapstudio-history-body">
                    <div className="mapstudio-history-next" data-step={p.lastStep}>
                        <span className="mapstudio-history-next-text">{nextUndoText(p.lastStep)}</span>
                        <button type="button" className="mapstudio-button mapstudio-history-undo" disabled={undoOff} title={undoTitle}
                                aria-label={p.undoLabel || 'Undo'} onClick={p.onUndo}>Undo</button>
                    </div>
                    {firstFailed ? (
                        <div className="mapstudio-history-error" role="alert">
                            <span>{h.error}</span>
                            <button type="button" className="mapstudio-button mapstudio-history-retry" onClick={p.onRetry}>Try again</button>
                        </div>
                    ) : null}
                    {!h.loaded && !firstFailed ? (
                        <div className="mapstudio-history-status" role="status">Loading recent changes...</div>
                    ) : null}
                    {h.loaded && p.rows.length === 0 ? (
                        <div className="mapstudio-history-status">No changes saved yet.</div>
                    ) : null}
                    {p.rows.length > 0 ? (
                        <ol className="mapstudio-history-list" aria-label="Changes, newest first">
                            {p.rows.map((row) => {
                                const expanded = this.state.open.indexOf(row.seq) >= 0;
                                const entry = entries.get(row.seq);
                                const detailId = this.idBase + '-' + row.seq;
                                return (
                                    <li key={row.seq} className={'mapstudio-history-row' + (expanded ? ' mapstudio-history-row--open' : '')}
                                        data-seq={String(row.seq)} data-actor={row.actor} data-expanded={expanded ? 'true' : 'false'}
                                        data-revert={row.blocked === '' ? 'offered' : 'blocked'}>
                                        <div className="mapstudio-history-line">
                                            <button type="button" className="mapstudio-history-summary" aria-expanded={expanded}
                                                    aria-controls={expanded ? detailId : undefined} onClick={() => this.toggle(row.seq)}>
                                                <span className="mapstudio-history-avatar" aria-hidden="true">{row.initial}</span>
                                                <span className="mapstudio-history-text">
                                                    <span className="mapstudio-history-sentence">{row.sentence}</span>
                                                    <span className="mapstudio-history-meta">
                                                        {row.actor !== '' ? row.actor : 'Unknown'}{row.when !== '' ? ' - ' + row.when : ''}
                                                    </span>
                                                </span>
                                            </button>
                                            {row.blocked === '' ? (
                                                <button type="button" className="mapstudio-button mapstudio-button--ghost mapstudio-history-revert"
                                                        disabled={p.paused} title={p.paused ? PAUSED_TEXT : 'Revert: ' + row.sentence}
                                                        aria-label={'Revert: ' + row.sentence} onClick={() => p.onRevert(row.seq)}>Revert</button>
                                            ) : null}
                                        </div>
                                        {row.blocked !== '' ? <div className="mapstudio-history-norevert">{row.blocked}</div> : null}
                                        {expanded && entry ? <Detail ops={p.expand(entry)} id={detailId} /> : null}
                                    </li>
                                );
                            })}
                        </ol>
                    ) : null}
                    {unread !== '' ? <div className="mapstudio-history-status mapstudio-history-unread">{unread}</div> : null}
                    {olderFailed ? (
                        <div className="mapstudio-history-error" role="alert">
                            <span>{h.error}</span>
                            <button type="button" className="mapstudio-button mapstudio-history-retry" onClick={p.onRetry}>Try again</button>
                        </div>
                    ) : null}
                    {canShowOlder(h) && !olderFailed ? (
                        <button type="button" className="mapstudio-button mapstudio-history-older" disabled={h.loading === 'older'}
                                onClick={p.onOlder}>{h.loading === 'older' ? 'Loading...' : 'Show older'}</button>
                    ) : null}
                </div>
                <div className="mapstudio-history-footer">{REVERT_FOOTER}</div>
            </section>
        );
    }
}

