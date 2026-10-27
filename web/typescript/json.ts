/**
 * Small JSON shape checks the message readers share (epic 2 story 12): one copy instead
 * of one per module.
 */

/** A plain JSON object: not null, not an array. */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
