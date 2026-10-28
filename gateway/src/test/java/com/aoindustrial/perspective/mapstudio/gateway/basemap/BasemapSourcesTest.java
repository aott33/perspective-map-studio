package com.aoindustrial.perspective.mapstudio.gateway.basemap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import ch.qos.logback.classic.Level;

import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.LogCapture;

/** Epic 3 entry 6: the satellite tile source, every refusal in plain words, and no token in any log line. */
class BasemapSourcesTest {

    static final String P = "mapstudio-dev";
    static final String PUBLIC = "pk.eyJ1IjoiZGV2In0.abc-DEF_123";
    static final String SECRET = "sk.eyJ1IjoiZGV2In0.never-in-a-browser";

    /** A fake secret store: provider name to secret name to value; a value "boom" throws on read. */
    static TokenSource store(Map<String, Map<String, String>> secrets) {
        return (provider, name) -> {
            Map<String, String> names = secrets.get(provider);
            if (names == null) {
                throw new TokenSource.TokenException(TokenSource.Problem.NO_PROVIDER, null);
            }
            String value = names.get(name);
            if (value == null) {
                throw new TokenSource.TokenException(TokenSource.Problem.NOT_FOUND, null);
            }
            if (value.equals("boom")) {
                throw new TokenSource.TokenException(TokenSource.Problem.FAILED, new IllegalStateException("disk"));
            }
            return value.trim();
        };
    }

    static final TokenSource STORE = store(Map.of("Internal", Map.of("map-token", PUBLIC, "sk-token", SECRET,
        "pg", "Wq9xLm2P", "blank", "  ", "broken", "boom")));

    static Setup setup(String basemaps, String tokenSecret) throws Exception {
        return Setup.parse("{\"schemaVersion\":1,\"connection\":\"MapStudio\",\"basemaps\":" + basemaps
            + ",\"tokenSecret\":\"" + tokenSecret + "\"}");
    }

    static JsonObject ask(String basemap) {
        return JsonParser.parseString("{\"basemap\":\"" + basemap + "\"}").getAsJsonObject();
    }

    static MapStudioException refused(Setup setup, JsonObject body) {
        return assertThrows(MapStudioException.class, () -> new BasemapSources(STORE).reply(P, setup, body));
    }

    @Test
    void aPublicTokenAnswersTheMapboxSatelliteSourceAndTheLogNamesTheSecretOnly() throws Exception {
        try (LogCapture log = new LogCapture("MapStudio.basemap", Level.DEBUG)) {
            JsonObject r = new BasemapSources(STORE).reply(P, setup("[\"none\",\"osm\",\"satellite\"]", "Internal/map-token"),
                ask("satellite"));
            assertEquals("satellite", r.get("basemap").getAsString());
            assertEquals("mapbox", r.get("provider").getAsString());
            assertEquals(1, r.getAsJsonArray("tiles").size());
            assertEquals("https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=" + PUBLIC,
                r.getAsJsonArray("tiles").get(0).getAsString());
            assertEquals(512, r.get("tileSize").getAsInt());
            assertEquals(22, r.get("maxzoom").getAsInt());
            assertTrue(r.get("attribution").getAsString().contains("Mapbox"));
            assertTrue(r.get("attribution").getAsString().contains("Maxar"));
            assertTrue(r.get("attribution").getAsString().contains("Improve this map"));
            List<String> lines = log.lines(Level.DEBUG);
            assertEquals(1, lines.size(), lines.toString());
            assertTrue(lines.get(0).contains("Internal/map-token"), lines.get(0));
            assertFalse(lines.get(0).contains(PUBLIC), lines.get(0));
        }
    }

    @Test
    void aSecretTokenIsRefusedWithoutTheValueAnywhere() throws Exception {
        try (LogCapture log = new LogCapture("MapStudio.basemap", Level.DEBUG)) {
            MapStudioException ex = refused(setup("[\"satellite\"]", "Internal/sk-token"), ask("satellite"));
            assertEquals("token-unavailable", ex.code());
            assertEquals("The map token secret Internal/sk-token is not a public Mapbox token: it must start with pk. "
                + "(a secret sk. token is never sent to a browser).", ex.plainMessage());
            assertFalse(ex.plainMessage().contains("sk.ey"));
            List<String> lines = log.lines(Level.DEBUG);
            assertEquals(1, lines.size(), lines.toString());
            assertTrue(lines.get(0).contains("Internal/sk-token"));
            assertFalse(lines.get(0).contains(SECRET));
        }
    }

    @Test
    void aValueThatIsNotAMapboxTokenIsRefused() throws Exception {
        MapStudioException ex = refused(setup("[\"satellite\"]", "Internal/pg"), ask("satellite"));
        assertEquals("token-unavailable", ex.code());
        assertFalse(ex.plainMessage().contains("Wq9xLm2P"));
        assertTrue(ex.plainMessage().contains("not a public Mapbox token"));
    }

    @Test
    void noSecretNamedNoProviderMissingSecretEmptyAndFailedEachHaveTheirWords() throws Exception {
        assertEquals("The Map Studio setup names no map token secret (tokenSecret): name the secret that holds a "
            + "public Mapbox token as <provider>/<name>.", refused(setup("[\"satellite\"]", ""), ask("satellite")).plainMessage());
        assertEquals("The map token secret map-token must name the secret provider and the secret, as <provider>/<name>.",
            refused(setup("[\"satellite\"]", "map-token"), ask("satellite")).plainMessage());
        assertEquals("The map token secret Internal/ must name the secret provider and the secret, as <provider>/<name>.",
            refused(setup("[\"satellite\"]", "Internal/"), ask("satellite")).plainMessage());
        assertEquals("There is no secret provider named Vault on this Gateway, so the map token secret Vault/x "
            + "cannot be read.", refused(setup("[\"satellite\"]", "Vault/x"), ask("satellite")).plainMessage());
        assertEquals("The map token secret Internal/nope was not found.",
            refused(setup("[\"satellite\"]", "Internal/nope"), ask("satellite")).plainMessage());
        assertEquals("The map token secret Internal/blank is empty.",
            refused(setup("[\"satellite\"]", "Internal/blank"), ask("satellite")).plainMessage());
        try (LogCapture log = new LogCapture("MapStudio.basemap")) {
            MapStudioException failed = refused(setup("[\"satellite\"]", "Internal/broken"), ask("satellite"));
            assertEquals("token-unavailable", failed.code());
            assertEquals("The map token secret Internal/broken could not be read; see the Gateway log.", failed.plainMessage());
            List<String> warn = log.exactly(Level.WARN);
            assertEquals(1, warn.size());
            assertTrue(warn.get(0).contains("IllegalStateException"), warn.get(0));
        }
    }

    @Test
    void aBasemapTheSetupDoesNotOfferOrANonSatelliteAskIsInvalid() throws Exception {
        MapStudioException notOffered = refused(setup("[\"none\",\"osm\"]", "Internal/map-token"), ask("satellite"));
        assertEquals("invalid", notOffered.code());
        assertEquals("The Map Studio setup does not offer the satellite basemap; add satellite to its basemaps.",
            notOffered.plainMessage());
        assertEquals("invalid", refused(setup("[\"osm\"]", ""), ask("osm")).code());
        assertEquals("invalid", refused(setup("[\"osm\"]", ""), new JsonObject()).code());
        assertEquals("invalid", refused(setup("[\"osm\"]", ""), null).code());
    }
}
