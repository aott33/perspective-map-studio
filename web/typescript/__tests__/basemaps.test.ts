import {
    BASEMAP_STORAGE_KEY, OSM_SOURCE, basemapSourceBody, fallbackBasemap, initialBasemap, offeredBasemaps, readBasemapSource,
    refusedText, rememberBasemap, rememberedBasemap, tilesFailedText
} from '../basemaps';
import { MessageTypes, basemapSource, readReply, replyText } from '../messages';

const TOKEN = 'pk.eyJ1IjoiZGV2In0.abc';
const REPLY = {
    basemap: 'satellite', provider: 'mapbox',
    tiles: ['https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=' + TOKEN],
    tileSize: 512, maxzoom: 22, attribution: '&copy; Mapbox &copy; Maxar'
};

describe('the basemaps the setup offers (epic 3 entry 6)', () => {
    test('none, osm and satellite are offered in the setup order; mapbox and unknown names are dropped', () => {
        expect(offeredBasemaps(['none', 'osm', 'satellite', 'mapbox'])).toEqual({ offered: ['none', 'osm', 'satellite'], dropped: ['mapbox'] });
        expect(offeredBasemaps(['satellite', 'none'])).toEqual({ offered: ['satellite', 'none'], dropped: [] });
        expect(offeredBasemaps(['mapbox', 'other', 'other'])).toEqual({ offered: [], dropped: ['mapbox', 'other'] });
        expect(offeredBasemaps(['osm', 'osm'])).toEqual({ offered: ['osm'], dropped: [] });
        expect(offeredBasemaps(undefined)).toEqual({ offered: [], dropped: [] });
    });

    test('the initial basemap is the remembered one when offered, else the first listed', () => {
        expect(initialBasemap(['none', 'osm', 'satellite'], 'satellite')).toBe('satellite');
        expect(initialBasemap(['none', 'osm'], 'satellite')).toBe('none');
        expect(initialBasemap(['osm', 'none'], null)).toBe('osm');
        expect(initialBasemap(['osm'], 'nonsense')).toBe('osm');
        expect(initialBasemap([], 'osm')).toBeNull();
    });

    test('a refused satellite falls back to the first offered basemap that needs no token', () => {
        expect(fallbackBasemap(['satellite', 'osm', 'none'], 'satellite')).toBe('osm');
        expect(fallbackBasemap(['satellite', 'none'], 'satellite')).toBe('none');
        expect(fallbackBasemap(['satellite'], 'satellite')).toBeNull();
    });

    test('the remembered choice is the id only, and a refusing storage is ignored', () => {
        const store: Record<string, string> = {};
        const storage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } };
        rememberBasemap(storage, 'osm');
        expect(store).toEqual({ [BASEMAP_STORAGE_KEY]: 'osm' });
        expect(rememberedBasemap(storage)).toBe('osm');
        const refusing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
        expect(() => rememberBasemap(refusing, 'satellite')).not.toThrow();
        expect(rememberedBasemap(refusing)).toBeNull();
        expect(rememberedBasemap(null)).toBeNull();
    });

    test('the OpenStreetMap source names its tiles and its attribution', () => {
        expect(OSM_SOURCE.tiles).toEqual(['https://tile.openstreetmap.org/{z}/{x}/{y}.png']);
        expect(OSM_SOURCE.attribution).toContain('openstreetmap.org/copyright');
        expect(OSM_SOURCE.attribution).toContain('OpenStreetMap</a> contributors');
    });

    test('the status words name the basemap', () => {
        expect(refusedText('satellite', 'The map token secret Internal/x was not found.'))
            .toBe('Satellite is unavailable: The map token secret Internal/x was not found.');
        expect(tilesFailedText('osm')).toBe('OpenStreetMap tiles are not loading; check the network.');
    });
});

describe('basemap.source and its reply', () => {
    test('the message carries the basemap', () => {
        expect(basemapSource('satellite', 'b1')).toEqual({ v: 1, type: 'basemap.source', id: 'b1', body: { basemap: 'satellite' } });
        expect(basemapSourceBody('satellite')).toEqual({ basemap: 'satellite' });
        expect(MessageTypes.BASEMAP_SOURCE_REPLY).toBe('basemap.source.reply');
    });

    test('a reply is read into a raster source, with defaults for a missing size or zoom', () => {
        expect(readBasemapSource(REPLY)).toEqual({
            basemap: 'satellite', provider: 'mapbox',
            source: { tiles: REPLY.tiles, tileSize: 512, maxzoom: 22, attribution: REPLY.attribution }
        });
        const bare = readBasemapSource({ basemap: 'satellite', tiles: ['https://x/{z}/{x}/{y}.png'] });
        expect(bare?.source).toEqual({ tiles: ['https://x/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 22, attribution: '' });
        expect(bare?.provider).toBe('');
    });

    test('a malformed reply reads as null', () => {
        expect(readBasemapSource({ basemap: 'satellite', tiles: [] })).toBeNull();
        expect(readBasemapSource({ basemap: 'mapbox', tiles: ['https://x'] })).toBeNull();
        expect(readBasemapSource({ basemap: 'satellite', tiles: [7] })).toBeNull();
        expect(readBasemapSource(null)).toBeNull();
    });

    test('readReply routes the reply, and its text never holds the tile URL', () => {
        const reply = readReply({ v: 1, type: 'basemap.source.reply', id: 'b1', body: REPLY });
        expect(reply.kind).toBe('basemap.source.reply');
        const text = replyText(reply);
        expect(text).toBe('Basemap source: satellite from mapbox');
        expect(text).not.toContain(TOKEN);
        expect(replyText(readReply({ v: 1, type: 'basemap.source.reply', id: 'b2', body: {} })))
            .toBe('Basemap source: unreadable reply');
    });
});
