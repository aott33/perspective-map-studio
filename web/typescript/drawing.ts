/**
 * The drawing in progress and the drawing bar's words (epic 4 entry 4; DESIGN.md Drawing bar, EXPERIENCE.md
 * Drawing bar, Draw and Snap, Toast): what the component holds while a line or an area is drawn vertex by
 * vertex with Terra Draw (editing.ts), the words the bar bottom-centre shows for it ("2 points - 0.7 km -
 * start floating", "Snap to CTB1 - click to connect", "A line needs two points"), and the toast's after the
 * add. Pure functions only, unit tested in node; Terra Draw does the drawing, the validation and the snapping
 * callback, the component keeps this state and the delegate saves.
 */

import { Position, SnapTarget, endsFrom, lengthM } from './geometry';
import { MapItemRecord } from './contract';
import { distanceText } from './linePopup';
import { StudioTool } from './studio';

/** The tools that draw vertex by vertex: a line, or an area (a ring saved as an unclosed LineString, AD-20). */
export type DrawingTool = 'line' | 'area';

export interface Drawing {
    tool: DrawingTool;
    /** Terra Draw's id of the feature being drawn. */
    featureId: string | number;
    /** The committed vertices (the provisional one under the pointer left out). */
    vertices: Position[];
    /** Per committed vertex, the target it snapped to, or null for a vertex placed where the pointer was. */
    snaps: Array<SnapTarget | null>;
    /** Why the drawing cannot finish yet in Terra Draw's words (the validation hook's reason), or ''. */
    reason: string;
}

/** Terra Draw's reason for a ring or a line whose edges cross (ValidationReasons.ValidationReasonFeatureSelfIntersects). */
export const REASON_SELF_INTERSECTS = 'Feature intersects itself';

/** Whether a studio tool draws vertex by vertex. */
export function isDrawingTool(tool: StudioTool | null): tool is DrawingTool {
    return tool === 'line' || tool === 'area';
}

/** The first vertex placed: the drawing starts with it and the target it snapped to. */
export function startDrawing(tool: DrawingTool, featureId: string | number, vertices: Position[], snap: SnapTarget | null): Drawing {
    return { tool, featureId, vertices, snaps: vertices.map((_v, i) => (i === vertices.length - 1 ? snap : null)), reason: '' };
}

/**
 * The committed vertices changed (a click added one with the target it snapped to, Backspace removed the last):
 * the snaps follow the count, one per vertex, and the reason is the validation's latest. The same drawing comes
 * back when nothing changed, so a pointer move redraws nothing.
 */
export function withVertices(drawing: Drawing, vertices: Position[], snap: SnapTarget | null, reason: string): Drawing {
    const same = vertices.length === drawing.vertices.length
        && vertices.every((v, i) => v[0] === drawing.vertices[i][0] && v[1] === drawing.vertices[i][1]);
    if (same && reason === drawing.reason) {
        return drawing;
    }
    let snaps = drawing.snaps.slice(0, vertices.length);
    while (snaps.length < vertices.length) {
        snaps.push(snaps.length === vertices.length - 1 ? snap : null);
    }
    if (same) {
        snaps = drawing.snaps;
    }
    return { ...drawing, vertices, snaps, reason };
}

/** How many vertices a tool needs before it can finish: two for a line, three for an area's ring. */
export function minVertices(tool: DrawingTool): number {
    return tool === 'area' ? 3 : 2;
}

/** The committed path's length in metres (an area's ring open, as drawn so far). */
export function drawnLengthM(drawing: Drawing): number {
    return drawing.vertices.length >= 2 ? lengthM(drawing.vertices) : 0;
}

/** Whether Finish, Enter or a double-click may finish it: enough vertices and nothing the validation refused. */
export function canFinish(drawing: Drawing): boolean {
    return drawing.vertices.length >= minVertices(drawing.tool) && drawing.reason === '';
}

/** The words for a drawing that cannot finish yet: the count it needs, else the validation's reason in plain words; '' when it can. */
export function problemText(drawing: Drawing): string {
    if (drawing.vertices.length < minVertices(drawing.tool)) {
        return drawing.tool === 'area' ? 'An area needs three points' : 'A line needs two points';
    }
    return reasonText(drawing.reason);
}

/** Terra Draw's validation reason in plain words (EXPERIENCE.md Voice and Tone); '' for none. */
export function reasonText(reason: string): string {
    if (reason === '') {
        return '';
    }
    if (reason === REASON_SELF_INTERSECTS) {
        return 'The edges cross - Backspace removes the last point';
    }
    return reason;
}

/** The target the start snapped to, or null for a floating start. */
export function startSnap(drawing: Drawing): SnapTarget | null {
    return drawing.snaps.length > 0 ? drawing.snaps[0] : null;
}

/** The target the last vertex snapped to, or null (a floating end, or a line of one vertex). */
export function endSnap(drawing: Drawing): SnapTarget | null {
    return drawing.snaps.length > 1 ? drawing.snaps[drawing.snaps.length - 1] : null;
}

/**
 * The bar's progress: "2 points - 0.7 km - start floating", "1 point - 0 km - start snapped to CTB1", and once the
 * line has an end "end snapped to SWD1" or "end floating" after it; an area names no ends.
 */
export function progressText(drawing: Drawing): string {
    const n = drawing.vertices.length;
    const parts = [n + (n === 1 ? ' point' : ' points'), distanceText(drawnLengthM(drawing))];
    if (drawing.tool === 'line') {
        const start = startSnap(drawing);
        parts.push(start ? 'start snapped to ' + start.name : 'start floating');
        if (n >= 2) {
            const end = endSnap(drawing);
            parts.push(end ? 'end snapped to ' + end.name : 'end floating');
        }
    }
    return parts.join(' - ');
}

/** The bar's title: "New gathering line". */
export function newItemText(kindName: string): string {
    return 'New ' + (kindName.length > 0 ? kindName.charAt(0).toLowerCase() + kindName.slice(1) : kindName);
}

/** The snap indicator while a target is within reach (EXPERIENCE.md Snap): "Snap to CTB1 - click to connect". */
export function snapIndicatorText(targetName: string): string {
    return 'Snap to ' + targetName + ' - click to connect';
}

/** The Snap toggle's words (DESIGN.md Floating draw toolbar). */
export function snapToggleText(on: boolean): string {
    return on ? 'Snap on' : 'Snap off';
}

/** How the drawing finishes, as the bar says it (DESIGN.md Drawing bar). */
export function finishHint(tool: DrawingTool): string {
    return tool === 'area' ? 'Double-click or Enter to close' : 'Double-click or Enter to finish';
}

/** The saved line's `ends` from the drawing's first and last snaps; an area carries none. */
export function drawingEnds(drawing: Drawing): MapItemRecord['ends'] {
    if (drawing.tool !== 'line') {
        return null;
    }
    return endsFrom(startSnap(drawing), endSnap(drawing));
}

/** The toast after an add (EXPERIENCE.md Toast / Undo bar): "Pipeline added and saved". */
export function addedText(kindName: string): string {
    return kindName + ' added and saved';
}

/** How long the toast stays, unless the pointer rests on it (EXPERIENCE.md Toast: timing open; entry 10 may refine). */
export const TOAST_MS = 6000;
