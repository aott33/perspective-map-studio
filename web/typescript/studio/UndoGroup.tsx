import * as React from 'react';
import { HistoryRow, agoText, historyFooterText } from '../undoStack';
import { ChromeGlyph } from './ChromeGlyph';

/** What a paused toolbar's Undo, history and Redo say on hover (the map store is unreachable; the toolbar fades). */
export const PAUSED_TEXT = 'Paused - the map store is unreachable';

/** The floating controls' distance from the map's edge (DESIGN.md spacing map-inset): the history list keeps it. */
const INSET_PX = 12;

/** How often an open history's times are read again ("just now" becomes "1 min ago"). */
const TICK_MS = 15_000;

/**
 * Undo, its history and Redo, the floating toolbar's last group (epic 4 entry 23, owner 2026-11-05; DESIGN.md Floating
 * draw toolbar, EXPERIENCE.md Undo and Redo, R28): Undo and Redo each name their step on hover and to assistive
 * technology ("Undo: add Gathering line"), disabled with "Nothing to undo" or "Nothing to redo", or while something is in
 * flight with what ("Undoing...", "Redoing...", "Saving..."); the chevron beside Undo
 * opens the history under it, the owner's mock: "Undo history", the last ten done steps of this session newest first,
 * each with how long ago it was saved, and a footer. Hovering a row (or the keyboard's focus on it) marks it and every
 * newer row, and the footer counts them ("Click to undo back to here: undoes 3 changes"); choosing one (a click, Enter
 * or Space) undoes it and every later step, which the delegate does as single undos one after another (`onUndoTo`).
 * With nothing to undo the list says "Nothing to undo"; while a reverse is being saved the rows take no choice. A menu
 * button: Enter, Space or Down opens it on the newest row, Up on the oldest (a pointer opens it with the focus left on
 * the chevron); Up and Down move (wrapping), Home and End jump; Esc anywhere in the group closes it and goes no further,
 * Tab on a row closes it, both returning the focus to the chevron; the focus leaving the group or a press outside closes it. The list opens
 * left-aligned with Undo, as the mock draws it, and moves left as far as it must to stay inside the map and clear of
 * the zoom card (with Details docked at 1366 px the map is 718 px wide). Paused (the store unreachable), every button
 * takes no input and says so on hover.
 */
export interface UndoGroupProps {
    /** "Undo: add Gathering line", or '' with nothing to undo or a reverse in flight (the button is then disabled). */
    undoLabel: string;
    /** "Redo: add Gathering line", or '' with nothing to redo or a reverse in flight. */
    redoLabel: string;
    /** The history's rows, newest first (undoStack.ts `undoHistory`). */
    history: HistoryRow[];
    /**
     * What is in flight, in words (undoStack.ts `busyText`: "Undoing...", "Redoing...", "Saving..."), or '': while it is not
     * '' Undo and Redo say it and wait, and the history's rows take no choice.
     */
    busy: string;
    paused: boolean;
    onUndo: () => void;
    onRedo: () => void;
    /** A history row chosen: undo that many steps, the newest first, one at a time. */
    onUndoTo: (count: number) => void;
    /** The clock the history's times are read against; Date.now unless a test fixes it. */
    now?: () => number;
}

/** The open history list's markup (exported for the unit tests; UndoGroup holds its state and handlers). */
export interface HistoryListProps {
    id: string;
    rows: HistoryRow[];
    /** The marked row, -1 for none: it and every newer row are marked, and the footer counts them. */
    marked: number;
    /** What is in flight, in words, or '' (UndoGroupProps `busy`). */
    busy: string;
    /** The time the rows' "how long ago" is read against (epoch ms). */
    now: number;
    /** How far the list moved left to stay clear of the zoom card, in px. */
    shift: number;
    panelRef?: React.Ref<HTMLDivElement>;
    onLeave?: () => void;
    onChoose: (index: number) => void;
    onHover: (index: number) => void;
    onFocusRow: (index: number) => void;
    onRowKey: (ev: React.KeyboardEvent<HTMLButtonElement>, index: number) => void;
}

export function HistoryList(props: HistoryListProps): React.ReactElement {
    const rows = props.rows;
    const marked = Math.min(props.marked, rows.length - 1);
    const titleId = props.id + '-title';
    return (
        <div ref={props.panelRef} id={props.id} className="mapstudio-undo-history" data-rows={String(rows.length)}
             data-marked={String(marked + 1)} data-busy={props.busy !== '' ? 'true' : 'false'} tabIndex={-1}
             style={props.shift > 0 ? { transform: 'translateX(-' + props.shift + 'px)' } : undefined}
             onMouseLeave={props.onLeave}>
            <div className="mapstudio-undo-history-title" id={titleId}>Undo history</div>
            {rows.length === 0 ? <div className="mapstudio-undo-history-empty">Nothing to undo</div> : (
                <ul className="mapstudio-undo-history-list" role="menu" aria-labelledby={titleId}>
                    {rows.map((row, i) => (
                        <li key={row.count} role="none">
                            <button type="button" role="menuitem" tabIndex={-1}
                                    className={'mapstudio-undo-history-row' + (i <= marked ? ' mapstudio-undo-history-row--marked' : '')}
                                    data-count={String(row.count)} aria-disabled={props.busy !== '' ? 'true' : undefined}
                                    onClick={() => props.onChoose(i)}
                                    onMouseEnter={() => props.onHover(i)}
                                    onFocus={() => props.onFocusRow(i)}
                                    onKeyDown={(ev) => props.onRowKey(ev, i)}>
                                <span className="mapstudio-undo-history-label">{row.label}</span>
                                <span className="mapstudio-undo-history-ago">{agoText(row.at, props.now)}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {rows.length > 0 ? (
                <div className="mapstudio-undo-history-footer" aria-live="polite">{historyFooterText(marked + 1, props.busy)}</div>
            ) : null}
        </div>
    );
}

interface UndoGroupState {
    open: boolean;
    /** The marked row (the pointer on it, or the focus): it and every newer row are marked; -1 for none. */
    marked: number;
    /** How far the list moved left to stay clear of the zoom card, in px. */
    shift: number;
    /** Bumped while the list is open, so its times move. */
    tick: number;
}

export class UndoGroup extends React.Component<UndoGroupProps, UndoGroupState> {
    state: UndoGroupState = { open: false, marked: -1, shift: 0, tick: 0 };

    private readonly root = React.createRef<HTMLDivElement>();
    private readonly chevron = React.createRef<HTMLButtonElement>();
    private readonly panel = React.createRef<HTMLDivElement>();
    private readonly listId = 'mapstudio-undo-history-' + Math.random().toString(36).slice(2, 8);
    /** The row the focus goes to once the list is open: the newest, the oldest, or none. */
    private focusOnOpen: 'first' | 'last' | null = null;
    private timer: ReturnType<typeof setInterval> | null = null;

    componentDidUpdate(_prevProps: Readonly<UndoGroupProps>, prevState: Readonly<UndoGroupState>): void {
        if (this.state.open && this.props.paused) {
            // The store went unreachable while the list was open: it closes with the toolbar's input.
            this.close(false);
            return;
        }
        if (this.state.open && !prevState.open) {
            document.addEventListener('pointerdown', this.onDocumentDown, true);
            this.timer = setInterval(() => this.setState((s) => ({ tick: s.tick + 1 })), TICK_MS);
            const focus = this.focusOnOpen;
            this.focusOnOpen = null;
            if (focus !== null && this.props.history.length > 0) {
                this.focusRow(focus === 'first' ? 0 : this.props.history.length - 1);
            }
        } else if (!this.state.open && prevState.open) {
            this.stopListening();
        }
        if (this.state.open) {
            this.placeList();
        }
    }

    componentWillUnmount(): void {
        this.stopListening();
    }

    private stopListening(): void {
        document.removeEventListener('pointerdown', this.onDocumentDown, true);
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /** A press outside the group closes the list (the focus stays where the press puts it). */
    private onDocumentDown = (ev: Event): void => {
        const root = this.root.current;
        if (root && ev.target instanceof Node && !root.contains(ev.target)) {
            this.close(false);
        }
    };

    private openList(focus: 'first' | 'last' | null): void {
        this.focusOnOpen = focus;
        this.setState({ open: true, marked: -1, shift: 0 });
    }

    private close(returnFocus: boolean): void {
        this.setState({ open: false, marked: -1 });
        if (returnFocus && this.chevron.current) {
            this.chevron.current.focus();
        }
    }

    /**
     * A press opens or closes the list. Enter or Space (a click with no pointer, `detail` 0) puts the focus on the newest
     * row, as a menu button does; a pointer leaves the focus on the chevron, and hovering marks the rows.
     */
    private onChevronClick = (ev: React.MouseEvent<HTMLButtonElement>): void => {
        if (this.state.open) {
            this.close(false);
        } else {
            this.openList(ev.detail === 0 ? 'first' : null);
        }
    };

    private onChevronKey = (ev: React.KeyboardEvent<HTMLButtonElement>): void => {
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
            ev.preventDefault();
            if (this.state.open) {
                this.focusRow(ev.key === 'ArrowDown' ? 0 : this.props.history.length - 1);
            } else {
                this.openList(ev.key === 'ArrowDown' ? 'first' : 'last');
            }
        }
    };

    /** Esc anywhere in the group (the chevron, Undo, Redo, a row) closes an open list and goes no further: the root's Esc would close Details. */
    private onGroupKey = (ev: React.KeyboardEvent<HTMLDivElement>): void => {
        if (ev.key === 'Escape' && this.state.open) {
            ev.preventDefault();
            ev.stopPropagation();
            this.close(true);
        }
    };

    /** The focus leaving the group (Tab from the chevron or Redo, a click elsewhere) closes the list. */
    private onGroupBlur = (ev: React.FocusEvent<HTMLDivElement>): void => {
        const root = this.root.current;
        const next = ev.relatedTarget as Node | null;
        if (this.state.open && root && (next === null || !root.contains(next))) {
            this.close(false);
        }
    };

    private rows(): HTMLElement[] {
        const panel = this.panel.current;
        return panel ? Array.from(panel.querySelectorAll<HTMLElement>('[role="menuitem"]')) : [];
    }

    private focusRow(index: number): void {
        const row = this.rows()[index];
        if (row) {
            row.focus({ preventScroll: true });
        }
    }

    private mark(index: number): void {
        if (this.state.marked !== index) {
            this.setState({ marked: index });
        }
    }

    /** The pointer left the list: the mark goes back to the focused row, if the focus is in the list. */
    private onListLeave = (): void => {
        const focused = this.rows().indexOf(document.activeElement as HTMLElement);
        this.mark(focused);
    };

    private choose(index: number): void {
        const row = this.props.history[index];
        if (!row || this.props.busy !== '') {
            return;
        }
        this.close(true);
        this.props.onUndoTo(row.count);
    }

    private onRowKey(ev: React.KeyboardEvent<HTMLButtonElement>, index: number): void {
        const n = this.props.history.length;
        const go = (i: number): void => {
            ev.preventDefault();
            this.focusRow(i);
        };
        switch (ev.key) {
            case 'ArrowDown':
                go((index + 1) % n);
                break;
            case 'ArrowUp':
                go((index - 1 + n) % n);
                break;
            case 'Home':
                go(0);
                break;
            case 'End':
                go(n - 1);
                break;
            case 'Enter':
            case ' ':
                ev.preventDefault();
                this.choose(index);
                break;
            case 'Tab':
                // Closes the list with the focus back on the chevron, never on a row that goes (Esc is the group's).
                ev.preventDefault();
                this.close(true);
                break;
            default:
                break;
        }
    }

    /**
     * Left-aligned with Undo as the mock draws it, unless that runs past the zoom card's left edge less the map inset
     * (or the map's right edge): then the list moves left as far as it must, never past the map's left inset.
     */
    private placeList(): void {
        const panel = this.panel.current;
        const root = this.root.current;
        const stage = root ? root.closest('.mapstudio-stage') as HTMLElement | null : null;
        if (!panel || !stage) {
            return;
        }
        const r = panel.getBoundingClientRect();
        const s = stage.getBoundingClientRect();
        const zoom = stage.querySelector('.mapstudio-zoom') as HTMLElement | null;
        const limit = (zoom && zoom.offsetWidth > 0 ? zoom.getBoundingClientRect().left : s.right) - INSET_PX;
        const left = r.left + this.state.shift;
        const right = r.right + this.state.shift;
        const shift = Math.round(Math.max(0, Math.min(right - limit, left - (s.left + INSET_PX))));
        if (Math.abs(shift - this.state.shift) >= 1) {
            this.setState({ shift });
        }
    }

    /** The pointer on a row marks it and every newer row; the focus stays where it is (the keyboard's own). */
    private onHover = (index: number): void => this.mark(index);

    private onFocusRow = (index: number): void => this.mark(index);

    private onChoose = (index: number): void => this.choose(index);

    private onRowKeyDown = (ev: React.KeyboardEvent<HTMLButtonElement>, index: number): void => this.onRowKey(ev, index);

    render(): React.ReactElement {
        const { undoLabel, redoLabel, paused, busy } = this.props;
        const open = this.state.open;
        return (
            <div ref={this.root} className="mapstudio-undo-group" data-history-open={open ? 'true' : 'false'} onKeyDown={this.onGroupKey}
                 onBlur={this.onGroupBlur}>
                <button type="button" className="mapstudio-tool mapstudio-undo" disabled={paused || busy !== '' || undoLabel === ''}
                        title={paused ? PAUSED_TEXT : busy || undoLabel || 'Nothing to undo'} aria-label={undoLabel || 'Undo'} data-step={undoLabel}
                        onClick={this.props.onUndo}>
                    <ChromeGlyph name="undo" />
                </button>
                <button type="button" ref={this.chevron}
                        className={'mapstudio-tool mapstudio-undo-history-button' + (open ? ' mapstudio-tool--active' : '')}
                        disabled={paused} title={paused ? PAUSED_TEXT : 'Undo history'} aria-label="Undo history" aria-haspopup="menu"
                        aria-expanded={open} aria-controls={open ? this.listId : undefined}
                        onClick={this.onChevronClick} onKeyDown={this.onChevronKey}>
                    <ChromeGlyph name="chevron" size={16} />
                </button>
                <button type="button" className="mapstudio-tool mapstudio-redo" disabled={paused || busy !== '' || redoLabel === ''}
                        title={paused ? PAUSED_TEXT : busy || redoLabel || 'Nothing to redo'} aria-label={redoLabel || 'Redo'} data-step={redoLabel}
                        onClick={this.props.onRedo}>
                    <ChromeGlyph name="redo" />
                </button>
                {open ? (
                    <HistoryList id={this.listId} rows={this.props.history} marked={this.state.marked} busy={this.props.busy}
                                 now={(this.props.now || Date.now)()} shift={this.state.shift} panelRef={this.panel} onLeave={this.onListLeave}
                                 onChoose={this.onChoose} onHover={this.onHover} onFocusRow={this.onFocusRow} onRowKey={this.onRowKeyDown} />
                ) : null}
            </div>
        );
    }
}
