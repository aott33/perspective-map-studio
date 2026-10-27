package com.aoindustrial.perspective.mapstudio.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.StringReader;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.aoindustrial.perspective.mapstudio.common.IconCatalogue;

/** Story 2.10: the shipped icon catalogue, as the kind list check will read it. */
class IconCatalogueTest {

    /** The sixteen FR-9 kinds and the owner's two additions. */
    private static final List<String> KIND_ICONS = List.of(
        "well-pad", "wellhead", "tank-battery", "compressor-station", "booster-station", "meter-station",
        "pig-trap", "line-valve", "tap", "rtu", "pipeline", "lateral", "lease-road", "geofence", "region",
        "site-footprint", "swd", "separator");

    @Test
    void shippedCatalogueHasEveryKindIconAndTheFallback() {
        IconCatalogue c = IconCatalogue.shipped();
        for (String id : KIND_ICONS) {
            assertTrue(c.contains(id), id);
            assertEquals("kind", c.get(id).group, id);
        }
        assertTrue(c.contains(IconCatalogue.FALLBACK));
        assertEquals(28, c.ids().size());
        assertEquals(19, c.kindIcons().size());
        assertEquals("0.2.0", c.version());
    }

    @Test
    void stateGlyphsAreNotKindIcons() {
        IconCatalogue c = IconCatalogue.shipped();
        for (String id : List.of("comms-lost", "stale", "alarm-1-unacknowledged", "alarm-1-acknowledged",
            "alarm-1-rectified", "alarm-2-unacknowledged", "alarm-2-acknowledged", "alarm-2-rectified", "alarm-3")) {
            assertEquals("state", c.get(id).group, id);
            assertNull(c.get(id).geometry, id);
            assertFalse(c.kindIcons().contains(id), id);
        }
    }

    @Test
    void knownIconResolvesToItself() {
        assertEquals("well-pad", IconCatalogue.shipped().resolve("well-pad"));
    }

    @Test
    void unknownOrMissingIconResolvesToTheFallback() {
        IconCatalogue c = IconCatalogue.shipped();
        assertFalse(c.contains("wel-pad"));
        assertEquals("point", c.resolve("wel-pad"));
        assertFalse(c.contains(null));
        assertEquals("point", c.resolve(null));
    }

    @Test
    void geometriesMatchTheKinds() {
        IconCatalogue c = IconCatalogue.shipped();
        assertEquals("point", c.get("well-pad").geometry);
        assertEquals("line", c.get("pipeline").geometry);
        assertEquals("area", c.get("geofence").geometry);
    }

    @Test
    void aCatalogueWithoutTheFallbackIsRefused() {
        String json = "{\"version\":\"0.2.0\",\"fallback\":\"point\",\"icons\":["
            + "{\"id\":\"well-pad\",\"label\":\"Well pad\",\"group\":\"kind\",\"geometry\":\"point\"}]}";
        assertThrows(IllegalStateException.class, () -> IconCatalogue.parse(new StringReader(json)));
    }
}
