/**
 * The drawing tool's state and the words it shows (R10: the mode is named in
 * words). Pure functions only, so this module is unit tested in node; the
 * component holds the state and Terra Draw does the drawing.
 */

/** Terra Draw mode names the component uses. */
export const DRAW_MODE_OFF = 'static';
export const DRAW_MODE_LINE = 'linestring';

export interface DrawState {
    /** Whether the line tool is on. */
    drawing: boolean;
    /** Vertex count of the last line finished, or null when none or after a cancel. */
    linePoints: number | null;
}

export const DRAW_IDLE: DrawState = { drawing: false, linePoints: null };

/** The tool switched on. */
export function startDrawing(): DrawState {
    return { drawing: true, linePoints: null };
}

/** A line finished with `points` vertices: the tool switches off. */
export function finishLine(points: number): DrawState {
    return { drawing: false, linePoints: points };
}

/** Escape, or the tool switched off before a line was finished. */
export function cancelDrawing(): DrawState {
    return DRAW_IDLE;
}

/**
 * The status text for a draw state, or '' when the tool is idle and nothing
 * was drawn (the component then shows the Gateway reply text).
 */
export function drawStatusText(state: DrawState): string {
    if (state.drawing) {
        return 'Drawing a line: click to add points, Enter to finish';
    }
    if (state.linePoints !== null) {
        return 'Line drawn with ' + state.linePoints + ' points';
    }
    return '';
}
