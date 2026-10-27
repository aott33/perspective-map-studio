package com.aoindustrial.perspective.mapstudio.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.Collection;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonObject;

import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.NoAdapters;
import com.aoindustrial.perspective.mapstudio.gateway.setup.SetupRegistry;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreState;
import com.aoindustrial.perspective.mapstudio.gateway.tags.TagLookups;
import com.aoindustrial.perspective.mapstudio.gateway.tags.TagSource;
import com.aoindustrial.perspective.mapstudio.gateway.write.FakeMapStore;

/** Epic 2 story 15: the delegate's reply to the tag lookups, in the envelope, every refusal an error. */
class TagsReplyTest {

    static final String P = "mapstudio-dev";

    /** A tag system that lists providers and fails with a plain runtime error on any browse. */
    static final class Broken implements TagSource {
        @Override
        public List<String> providers() {
            return List.of("default");
        }

        @Override
        public String projectDefault(String project) {
            return null;
        }

        @Override
        public Browse browse(String provider, String folder, Collection<String> roles, int max) {
            throw new IllegalStateException("boom");
        }

        @Override
        public Set<String> existing(Collection<String> fullPaths, Collection<String> roles) {
            return Set.of();
        }
    }

    TagLookups tags;

    @BeforeEach
    void setUp() throws Exception {
        SetupRegistry setups = new SetupRegistry(s -> { });
        setups.put(P, Setup.parse("{\"schemaVersion\":1,\"connection\":\"MapStudio\",\"roles\":{\"full\":[\"MapEditor\"]}}"));
        tags = new TagLookups(setups, new StoreGate(setups, c -> StoreState.ready()), new FakeMapStore(),
            NoAdapters::snapshot, new Broken());
    }

    JsonObject reply(String type, Collection<String> roles) {
        return MapStudioDelegate.tagsReply(tags, new MapStudioDelegate.SessionView(P, "u", roles), type, "m1",
            new JsonObject());
    }

    @Test
    void aRefusalIsAnErrorWithTheSameId() {
        JsonObject r = reply("tags.browse", List.of());
        assertEquals("error", r.get("type").getAsString());
        assertEquals("m1", r.get("id").getAsString());
        assertEquals("role", r.getAsJsonObject("body").get("code").getAsString());
        assertFalse(r.getAsJsonObject("body").has("batchId"));
        assertEquals("role", reply("tags.resolve", List.of("MapOperator")).getAsJsonObject("body").get("code").getAsString());
    }

    @Test
    void anUnexpectedFailureIsTagsUnavailable() {
        JsonObject r = reply("tags.browse", List.of("MapEditor"));
        assertEquals("error", r.get("type").getAsString());
        assertEquals("tags-unavailable", r.getAsJsonObject("body").get("code").getAsString());
    }

    @Test
    void aResolveWithAMissingBodyIsInvalid() {
        assertEquals("invalid", reply("tags.resolve", List.of("MapEditor")).getAsJsonObject("body").get("code").getAsString());
    }
}
