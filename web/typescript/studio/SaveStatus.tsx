import * as React from 'react';
import { EditLevel, MapItemRecord } from '../contract';
import { Problem } from '../problems';
import { SaveState } from '../save';
import { UnsavedEntry, editLabel, entryText } from '../unsaved';
import { ChromeGlyph } from './ChromeGlyph';

/**
 * The save status row in Edit mode (epic 4 entry 24; owner, 2026-11-05, "a" after the mock of the waiting edits; DESIGN.md
 * Save status, Panel header): with a problem a full-width row under the dock header's title row (the Items list's, and the
 * Kinds and Layers surfaces' too, so every surface says it), on the warning tint, says every problem in words, worst first,
 * one per line (problems.ts editProblems: the store unreachable or the setup's reason, the edits waiting, a read-only
 * store, the browser that cannot keep unsaved edits); the save state stays beside the Items list's title. The edits
 * waiting ("2 edits not saved" with the reason) are a button that opens them under the row (`WaitingList`); it says
 * whether they are open.
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
        <div className="mapstudio-panel-save--row" role="status"
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
 * The edits waiting, opened under the save status row (owner, 2026-11-05): each queued batch named as Undo names its step
 * ("Add Gathering line", "Rename P14"; unsaved.ts editLabel, the names from the batch or the records), its reason in words
 * under it (unsaved.ts entryText), Try again once it has a reason and Discard (off while the batch is being sent, since the
 * Gateway may still commit it), then Hide, which closes the list; Esc in it does too and goes no further (Details stays).
 */
export interface WaitingListProps {
    id: string;
    entries: UnsavedEntry[];
    /** The map's records, for the names a batch does not carry (a move, a link, a delete). */
    records: MapItemRecord[];
    level: EditLevel | null;
    sending: string[];
    onRetry: (batchId: string) => void;
    onDiscard: (batchId: string) => void;
    onHide: () => void;
    listRef?: React.Ref<HTMLDivElement>;
}

/** An edit's label as a row's first words: "add Gathering line" reads "Add Gathering line". */
function sentence(label: string): string {
    return label.charAt(0).toUpperCase() + label.slice(1);
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
        <div id={props.id} ref={props.listRef} className="mapstudio-unsaved" role="group" aria-label="Edits not saved"
             data-unsaved-count={String(props.entries.length)} onKeyDown={onKey}>
            <ul className="mapstudio-unsaved-list">
                {props.entries.map((entry) => {
                    const sending = props.sending.indexOf(entry.batchId) >= 0;
                    return (
                        <li key={entry.batchId} className={'mapstudio-unsaved-row mapstudio-unsaved-row--' + entry.state}
                            data-batch-id={entry.batchId} data-unsaved-state={entry.state} data-code={entry.reason ? entry.reason.code : ''}>
                            <span className="mapstudio-unsaved-edit">{sentence(editLabel(entry.batch, props.records))}</span>
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
            <button type="button" className="mapstudio-unsaved-button mapstudio-unsaved-hide" title="Hide (Esc)" aria-keyshortcuts="Escape"
                    onClick={props.onHide}>Hide</button>
        </div>
    );
}

/**
 * The save status row and the edits waiting under it, for a dock surface's header (entry 24): the row while there is a
 * problem, the list while it is open. The list starts closed (the owner is asked whether it should open by itself), opens
 * from the row's edits line, and closes with Hide, Esc or the edits' going, the focus back on the line; after a Discard
 * the focus goes to the next row's Discard, else to the line, so it never drops to the page.
 */
export interface ProblemStatusProps {
    save: SaveState;
    problems: Problem[];
    unsaved: UnsavedEntry[];
    records: MapItemRecord[];
    level: EditLevel | null;
    sending: string[];
    onRetry: (batchId: string) => void;
    onDiscard: (batchId: string) => void;
}

interface ProblemStatusState {
    open: boolean;
}

/** Whether the row holds the edits waiting (the line that opens them). */
function hasWaiting(problems: Problem[]): boolean {
    return problems.some((p) => p.code === 'edits');
}

export class ProblemStatus extends React.Component<ProblemStatusProps, ProblemStatusState> {
    state: ProblemStatusState = { open: false };

    private readonly toggle = React.createRef<HTMLButtonElement>();
    private readonly list = React.createRef<HTMLDivElement>();
    private readonly listId = 'mapstudio-unsaved-' + Math.random().toString(36).slice(2, 8);
    /** The batch a Discard was pressed for and its row's place, until the update that removes it moves the focus. */
    private discarded: { batchId: string; index: number } | null = null;

    componentDidUpdate(): void {
        const discarded = this.discarded;
        if (discarded) {
            this.discarded = null;
            if (!this.props.unsaved.some((e) => e.batchId === discarded.batchId)) {
                this.focusAfterDiscard(discarded.index);
            }
        }
        if (this.state.open && !hasWaiting(this.props.problems)) {
            // The edits waiting all went (saved, discarded): the list closes, so it opens closed when edits wait again.
            this.setState({ open: false });
        }
    }

    /** The next row's Discard (the one now in the discarded row's place), else the edits line, else nothing that is gone. */
    private focusAfterDiscard(index: number): void {
        const buttons = this.list.current ? this.list.current.querySelectorAll<HTMLButtonElement>('.mapstudio-unsaved-discard') : null;
        const next = buttons && index < buttons.length ? buttons[index] : null;
        if (next && !next.disabled) {
            next.focus();
        } else if (this.toggle.current) {
            this.toggle.current.focus();
        }
    }

    private onToggle = (): void => {
        this.setState((prev) => ({ open: !prev.open }));
    };

    /** Hide (or Esc in the list) closes it; the focus goes back to the line that opens it. */
    private onHide = (): void => {
        this.setState({ open: false });
        if (this.toggle.current) {
            this.toggle.current.focus();
        }
    };

    private onDiscard = (batchId: string): void => {
        // Noted before the delegate is told, since its change may render at once.
        this.discarded = { batchId, index: this.props.unsaved.findIndex((e) => e.batchId === batchId) };
        this.props.onDiscard(batchId);
    };

    render(): React.ReactNode {
        const props = this.props;
        if (props.problems.length === 0) {
            return null;
        }
        const open = this.state.open && hasWaiting(props.problems);
        return (
            <React.Fragment>
                <ProblemRow save={props.save} problems={props.problems} listId={this.listId} open={open} onToggle={this.onToggle}
                            toggleRef={this.toggle} />
                {open ? (
                    <WaitingList id={this.listId} entries={props.unsaved} records={props.records} level={props.level} sending={props.sending}
                                 onRetry={props.onRetry} onDiscard={this.onDiscard} onHide={this.onHide} listRef={this.list} />
                ) : null}
            </React.Fragment>
        );
    }
}
