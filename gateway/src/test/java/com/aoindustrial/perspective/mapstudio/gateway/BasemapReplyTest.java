package com.aoindustrial.perspective.mapstudio.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.basemap.BasemapSources;
import com.aoindustrial.perspective.mapstudio.gateway.basemap.TokenSource;
import com.aoindustrial.perspective.mapstudio.gateway.setup.SetupRegistry;

/** Epic 3 entry 6: the delegate's reply to basemap.source, in the envelope, every refusal an error. */
class BasemapReplyTest {

    static final String P = "mapstudio-dev";

    static final TokenSource STORE = (provider, name) -> {
        if (!"Internal".equals(provider)) {
            throw new TokenSource.TokenException(TokenSource.Problem.NO_PROVIDER, null);
        }
        String value = Map.of("map-token", "pk.dev").get(name);
        if (value == null) {
            throw new TokenSource.TokenException(TokenSource.Problem.NOT_FOUND, null);
        }
        return value;
    };

    static JsonObject ask(String basemap) {
        return JsonParser.parseString("{\"basemap\":\"" + basemap + "\"}").getAsJsonObject();
    }

    @Test
    void theDelegateAnswersInTheEnvelopeAndWithoutASetupItIsStoreUnreachable() throws Exception {
        SetupRegistry setups = new SetupRegistry(s -> { });
        setups.put(P, Setup.parse("{\"schemaVersion\":1,\"connection\":\"MapStudio\",\"basemaps\":[\"none\",\"satellite\"],"
            + "\"tokenSecret\":\"Internal/map-token\"}"));
        BasemapSources basemaps = new BasemapSources(STORE);
        MapStudioDelegate.SessionView view = new MapStudioDelegate.SessionView(P, null, List.of());
        JsonObject ok = MapStudioDelegate.basemapReply(setups, basemaps, view, "m1", ask("satellite"));
        assertEquals("basemap.source.reply", ok.get("type").getAsString());
        assertEquals("m1", ok.get("id").getAsString());
        assertEquals("satellite", ok.getAsJsonObject("body").get("basemap").getAsString());
        assertEquals("https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=pk.dev",
            ok.getAsJsonObject("body").getAsJsonArray("tiles").get(0).getAsString());
        JsonObject refused = MapStudioDelegate.basemapReply(setups, basemaps, view, "m2", ask("osm"));
        assertEquals("error", refused.get("type").getAsString());
        assertEquals("m2", refused.get("id").getAsString());
        assertEquals("invalid", refused.getAsJsonObject("body").get("code").getAsString());
        JsonObject none = MapStudioDelegate.basemapReply(setups, basemaps,
            new MapStudioDelegate.SessionView("other", null, List.of()), "m3", ask("satellite"));
        assertEquals("store-unreachable", none.getAsJsonObject("body").get("code").getAsString());
        // The job router sends basemap.source to the basemap reply.
        JsonObject routed = MapStudioDelegate.job(null, null, null, setups, basemaps, view, "basemap.source", "m4",
            ask("satellite")).get();
        assertEquals("basemap.source.reply", routed.get("type").getAsString());
    }
}
