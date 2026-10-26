// Plain statistics for the frame rate measure. No dependencies.

export function median(values) {
    if (values.length === 0) return null;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Nearest-rank percentile, p in 0..100. */
export function percentile(values, p) {
    if (values.length === 0) return null;
    const s = [...values].sort((a, b) => a - b);
    const rank = Math.max(1, Math.ceil((p / 100) * s.length));
    return s[rank - 1];
}

const round = (n, d = 2) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);

/**
 * Frame statistics from requestAnimationFrame timestamps (ms) and long task
 * durations (ms). fps is frames per second over the window; the share is the
 * percentage of frame intervals longer than 20 ms (below 50 fps).
 */
export function frameStats(timestamps, longTasks = []) {
    if (timestamps.length < 2) return { status: 'unavailable', reason: 'fewer than two animation frames in the window' };
    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) intervals.push(timestamps[i] - timestamps[i - 1]);
    const spanMs = timestamps[timestamps.length - 1] - timestamps[0];
    return {
        frames: timestamps.length,
        spanMs: round(spanMs, 0),
        fps: round(((timestamps.length - 1) / spanMs) * 1000),
        intervalMs: {
            p50: round(percentile(intervals, 50)),
            p95: round(percentile(intervals, 95)),
            max: round(Math.max(...intervals))
        },
        shareOver20msPercent: round((intervals.filter((i) => i > 20).length / intervals.length) * 100, 1),
        longTasks: { count: longTasks.length, totalMs: round(longTasks.reduce((a, b) => a + b, 0), 0) }
    };
}
