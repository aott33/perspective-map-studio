// Web Mercator projection, the formula MapLibre uses (512 px tiles), so a test
// can click a map feature without a handle on the map object.

export function project([lng, lat], zoom) {
    const scale = 512 * Math.pow(2, zoom);
    const x = ((lng + 180) / 360) * scale;
    const rad = (lat * Math.PI) / 180;
    const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale;
    return [x, y];
}

/** Page pixel of lngLat on a map whose bounding box is `box`, centred on `center` at `zoom`. */
export function pagePixel(box, lngLat, center, zoom) {
    const [cx, cy] = project(center, zoom);
    const [px, py] = project(lngLat, zoom);
    return [box.x + box.width / 2 + (px - cx), box.y + box.height / 2 + (py - cy)];
}

// The tracer's fixed view and points (web/typescript/testData.ts).
export const TRACER = {
    center: [-104.9725, 39.7445],
    zoom: 12.5,
    points: {
        p1: { lngLat: [-104.9903, 39.7392], name: 'Point 1' },
        p2: { lngLat: [-104.9750, 39.7500], name: 'Point 2' },
        p3: { lngLat: [-104.9550, 39.7430], name: 'Point 3' }
    },
    // Offsets from the map centre for a drawn line's two vertices, chosen to
    // miss the three test points at this zoom on both viewports.
    drawOffsets: [[-60, 120], [110, 40]]
};
