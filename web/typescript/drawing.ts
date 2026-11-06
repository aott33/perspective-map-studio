/**
 * The drawing in progress and the drawing bar's words (epic 4 entry 4; DESIGN.md Drawing bar, EXPERIENCE.md
 * Drawing bar, Draw and Snap): what the component holds while a line or an area is drawn vertex by vertex with
 * Terra Draw (editing.ts), and the words the bar bottom-centre shows for it ("2 points - 0.7 km - start floating",
 * "Snap to CTB1 - click to connect", "A line needs two points"). From entry 23 (owner, 2026-11-05) the bar is the one
 * place Edit mode talks, for every tool in hand: the Point tool's bar names the kind and "Click the map, then drag to
 * fine-tune" too, and there is no toast after an add and no Snap word (the toolbar's magnet says it on hover). Pure
 * functions only, unit tested in node; Terra Draw does the drawing, the validation and the snapping callback, the
 * component keeps this state and the delegate saves.
 */

import { Kind } from './adapters';
import { Position, SnapTarget, canDeleteVertex, canSplitAt, endsFrom, lengthM, minVertexCount } from './geometry';
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

/**
 * Terra Draw's reason for an area's ring whose edges cross (ValidationReasons.ValidationReasonFeatureSelfIntersects); the
 * check runs for the Area tool only (editing.ts): a line's rule is the two-vertex floor, and a line may cross itself.
 */
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

/**
 * The bar's title for the tool in hand (entry 23, FR-8: the tool named in words with its glyph): "New well pad" with the
 * kind it adds, else "New point", "New line" or "New area" when the kind list has none for the tool.
 */
export function barTitle(tool: StudioTool, kind: Kind | null): string {
    if (kind) {
        return newItemText(kind.name);
    }
    return tool === 'point' ? 'New point' : tool === 'area' ? 'New area' : 'New line';
}

/** What keeps a tool from adding anything: the kind list has no kind for it (the bar's problem, entry 23). */
export function noKindText(tool: StudioTool): string {
    return 'The kind list has no ' + (tool === 'point' ? 'point' : tool === 'area' ? 'area' : 'line') + ' kind';
}

/** The Point tool's hint on the bar (EXPERIENCE.md Drawing bar, UJ-1 step 2). */
export const PLACE_HINT = 'Click the map, then drag to fine-tune';

/** The snap indicator while a target is within reach (EXPERIENCE.md Snap): "Snap to CTB1 - click to connect". */
export function snapIndicatorText(targetName: string): string {
    return 'Snap to ' + targetName + ' - click to connect';
}

/**
 * The Snap toggle's hover title (DESIGN.md Floating draw toolbar: Snap as the magnet glyph alone, tinted when on and
 * named on hover; entry 23): whether it is on or off.
 */
export function snapTitle(on: boolean): string {
    return on ? 'Snap on: a vertex lands on the nearest item or vertex within reach' : 'Snap off';
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

/**
 * The geometry change in hand with Select (epic 4 entry 5; EXPERIENCE.md Change geometry, the owner's four mocks of
 * 2026-11-06): a point of the selected line or area chosen (its handle clicked), or Move pressed, for that point or from
 * Details for a point item, waiting for a click on the map. The bar bottom-centre says it; with nothing chosen nothing does.
 */
export interface GeometryPick {
    itemId: string;
    /** The chosen vertex of a line or an area, or null for a point item's Move. */
    index: number | null;
    /** Move pressed: the next click on the map is the new place; Esc or Cancel puts it down and nothing is sent. */
    moving: boolean;
    /** Why the last action was refused here, nothing sent ("The edges would cross" for an area), shown as the bar's hint; else absent. */
    problem?: string;
}

/** The chosen point's hint (the owner's mock): the drag and its non-drag way. */
export const CHOSEN_HINT = 'Drag it to move it, or use Move';

/** Move's hint (the owner's mock): where to click, and the way out. */
export const MOVE_HINT = 'Click the new place on the map - Esc to cancel';

/** The bar's title: "Point 2 of 3 on L-SWD" for a chosen point, "Moving point 2 of L-SWD" once Move is pressed, "Moving CTB1" for a point item. */
export function geometryTitle(pick: GeometryPick, name: string, vertexCount: number): string {
    if (pick.index === null) {
        return 'Moving ' + name;
    }
    const point = pick.index + 1;
    return pick.moving ? 'Moving point ' + point + ' of ' + name : 'Point ' + point + ' of ' + vertexCount + ' on ' + name;
}

/** The bar's hint: why the last action was refused, else Move's while it waits for the click, else the chosen point's. */
export function geometryHint(pick: GeometryPick): string {
    return pick.problem ? pick.problem : pick.moving ? MOVE_HINT : CHOSEN_HINT;
}

/** Why Split here is off for the chosen point, '' when it is on: an area has none, a line splits at an inner point only. */
export function splitOffText(vertexCount: number, index: number, area: boolean): string {
    if (area) {
        return 'An area has no split';
    }
    return canSplitAt(vertexCount, index, false) ? '' : 'A line splits at an inner point, not an end';
}

/** Why Delete point is off, '' when it is on: never below two points for a line or three for an area. */
export function deleteOffText(vertexCount: number, area: boolean): string {
    if (canDeleteVertex(vertexCount, area)) {
        return '';
    }
    return (area ? 'An area keeps at least ' : 'A line keeps at least ') + (minVertexCount(area) === 3 ? 'three' : 'two') + ' points';
}

/**
 * Whether a key's target takes typed text: an input, a textarea, a select or an editable element. The map
 * container's key handling (editing.ts `onKeyDown`, capture phase) leaves such a key to the field, a field inside
 * the container such as one in a custom popup view's content, so Backspace there removes a letter, not a vertex.
 */
export function inField(target: EventTarget | null): boolean {
    const el = target as { tagName?: unknown; isContentEditable?: unknown } | null;
    if (!el || typeof el.tagName !== 'string') {
        return false;
    }
    const tag = el.tagName.toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}
