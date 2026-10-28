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

// The tracer's view and points: the dev views' startingArea prop (ops/project/.../views/*/view.json,
// centre -104.9725, 39.7445 at zoom 12; epic 3 entry 6 replaced the component's START_VIEW with the prop)
// and the seed's tracer set (ops/project/ignition/script-python/mapstudio_seed, epic 2 story 11),
// whose map item ids are in the seed result's ids under tracer/p1 .. tracer/p3.
export const TRACER = {
    center: [-104.9725, 39.7445],
    zoom: 12,
    points: {
        p1: { lngLat: [-104.9903, 39.7392], name: 'Point 1', key: 'tracer/p1' },
        p2: { lngLat: [-104.9750, 39.7500], name: 'Point 2', key: 'tracer/p2' },
        p3: { lngLat: [-104.9550, 39.7430], name: 'Point 3', key: 'tracer/p3' }
    },
    // Offsets from the map centre for a drawn line's two vertices, chosen to miss the seeded
    // points at this zoom (at least 34 px from any) and p1's open popup on both viewports (it
    // sits above p1 at 1440 px and to its right, about 100 px tall, at 390 px).
    drawOffsets: [[-50, 150], [100, 150]]
};
