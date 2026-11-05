import * as React from 'react';
import { EditLevel } from '../contract';
import { Problem } from '../problems';
import { SaveState } from '../save';
import { UnsavedEntry, entryText } from '../unsaved';
import { ChromeGlyph } from './ChromeGlyph';

/**
 * The list header's save status row in Edit mode (epic 4 entry 24; owner, 2026-11-05, "a" after the mock of the waiting
 * edits; DESIGN.md Save status, Panel header): with a problem the status leaves the title row for its own full-width row
 * under it, on the warning tint, and says every problem in words, worst first, one per line (problems.ts editProblems: the
 * store unreachable or the setup's reason, the edits waiting or a refused save, a read-only store, the browser that cannot
 * keep unsaved edits). The edits waiting ("2 edits not saved" with the reason) are a button that opens them under the row
 * (`WaitingList`); it says whether they are open.
 */
export interface ProblemRowProps {
    save: SaveState;
    problems: Problem[];
    /** The waiting edits' list, which the edits line opens, and whether it is open. */
    listId: string;
    open: boolean;
    onToggle: () => void;
    toggleRef?: React.Ref<HTMLButtonElement>;
}

export function ProblemRow(props: ProblemRowProps): React.ReactElement {
    const save = props.save;
    const saveProblem = save.state === 'refused' || save.state === 'unsent';
    return (
        <div className={'mapstudio-panel-save mapstudio-panel-save--row mapstudio-panel-save--' + save.state} role="status"
             data-save-state={save.state} data-code={saveProblem ? save.code : ''} data-problems={props.problems.map((p) => p.code).join(' ')}>
            {props.problems.map((p) => p.code === 'edits' ? (
                <button key={p.code} ref={props.toggleRef} type="button"
                        className={'mapstudio-panel-problem mapstudio-panel-problem--edits' + (props.open ? ' mapstudio-panel-problem--open' : '')}
                        data-problem={p.code} aria-expanded={props.open} aria-controls={props.listId} onClick={props.onToggle}>
                    <span className="mapstudio-panel-problem-text">{p.text}</span>
                    <ChromeGlyph name="chevron" className="mapstudio-panel-problem-chevron" size={16} />
                </button>
            ) : (
                <div key={p.code} className={'mapstudio-panel-problem mapstudio-panel-problem--' + p.code} data-problem={p.code}>{p.text}</div>
            ))}
        </div>
    );
}

/**
 * The edits waiting, opened under the save status row (owner, 2026-11-05): each queued batch in words (unsaved.ts
 * entryText), Try again once it has a reason and Discard (off while the batch is being sent, since the Gateway may still
 * commit it), then Hide, which closes the list; Esc in it does too and goes no further (Details stays).
 */
export interface WaitingListProps {
    id: string;
    entries: UnsavedEntry[];
    level: EditLevel | null;
    sending: string[];
    onRetry: (batchId: string) => void;
    onDiscard: (batchId: string) => void;
    onHide: () => void;
}

export function WaitingList(props: WaitingListProps): React.ReactElement {
    const onKey = (ev: React.KeyboardEvent<HTMLDivElement>): void => {
        if (ev.key === 'Escape') {
            ev.preventDefault();
            ev.stopPropagation();
            props.onHide();
        }
    };
    return (
        <div id={props.id} className="mapstudio-unsaved" role="group" aria-label="Edits not saved"
             data-unsaved-count={String(props.entries.length)} onKeyDown={onKey}>
            <ul className="mapstudio-unsaved-list">
                {props.entries.map((entry) => {
                    const sending = props.sending.indexOf(entry.batchId) >= 0;
                    return (
                        <li key={entry.batchId} className={'mapstudio-unsaved-row mapstudio-unsaved-row--' + entry.state}
                            data-batch-id={entry.batchId} data-unsaved-state={entry.state} data-code={entry.reason ? entry.reason.code : ''}>
                            <span className="mapstudio-unsaved-text">{entryText(entry, props.level)}</span>
                            <span className="mapstudio-unsaved-actions">
                                {entry.reason ? (
                                    <button type="button" className="mapstudio-unsaved-button mapstudio-unsaved-retry"
                                            onClick={() => props.onRetry(entry.batchId)}>Try again</button>
                                ) : null}
                                <button type="button" className="mapstudio-unsaved-button mapstudio-unsaved-discard" disabled={sending}
                                        title={sending ? 'Being sent; wait for the answer.' : undefined}
                                        onClick={() => props.onDiscard(entry.batchId)}>Discard</button>
                            </span>
                        </li>
                    );
                })}
            </ul>
            <button type="button" className="mapstudio-unsaved-button mapstudio-unsaved-hide" onClick={props.onHide}>Hide</button>
        </div>
    );
}
