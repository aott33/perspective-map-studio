package com.aoindustrial.perspective.mapstudio.gateway.tags;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.AdapterStatus;
import com.aoindustrial.perspective.mapstudio.common.contract.Asset;
import com.aoindustrial.perspective.mapstudio.common.contract.Kind;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.AdapterSnapshot;
import com.aoindustrial.perspective.mapstudio.gateway.setup.SetupRegistry;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreState;
import com.aoindustrial.perspective.mapstudio.gateway.write.Actor;
import com.aoindustrial.perspective.mapstudio.gateway.write.FakeMapStore;
import com.aoindustrial.perspective.mapstudio.gateway.write.NoChangeHook;
import com.aoindustrial.perspective.mapstudio.gateway.write.WriteService;

/** Epic 2 story 15: the tag browser's lookups, every row of the plan's matrix, over a fake tag system. */
class TagLookupsTest {

    static final String P = "mapstudio-dev";
    static final List<String> FULL = List.of("MapEditor");
    static final List<String> PHONE = List.of("MapOperator");
    static final AdapterStatus OK = new AdapterStatus(AdapterStatus.OK, "ok", "f", 1, 0, "2026-10-27T10:00:00Z");

    FakeMapStore store;
    SetupRegistry setups;
    StoreState state;
    FakeTagSource tags;
    WriteService writes;
    TagLookups lookups;
    AdapterSnapshot lists;

    @BeforeEach
    void setUp() throws Exception {
        store = new FakeMapStore();
        setups = new SetupRegistry(s -> { });
        setups.put(P, Setup.parse("{\"schemaVersion\":1,\"connection\":\"MapStudio\","
            + "\"roles\":{\"full\":[\"MapEditor\"],\"phone\":[\"MapOperator\"]}}"));
        state = StoreState.ready();
        StoreGate gate = new StoreGate(setups, c -> state);
        lists = new AdapterSnapshot(
            List.of(new Kind("pad", "Well pad", "point", "well-pad", 10, List.of()),
                new Kind("line", "Line", "line", "pipeline", 5, List.of())),
            List.of(new Asset("P12", "Pad 12", "pad", "[default]Mesa/P12"),
                new Asset("P14", "Pad 14", "pad", "[default]Mesa/P14"),
                new Asset("P15", "Pad 15", "pad", "[default]Mesa/P15"),
                new Asset("P1", "Pad 1", "pad", "[default]Mesa/P1"),
                new Asset("L3", "Line 3", "line", "[default]Mesa/Lines/L3"),
                new Asset("PX", "Pad X", "pad", "[default]/Mesa/P12"),
                new Asset("PR", "Pad R", "pad", "[~]Mesa/P12")),
            OK, OK);
        writes = new WriteService(gate, store, new NoChangeHook(), project -> lists);
        tags = new FakeTagSource();
        for (String pad : List.of("P12", "P14")) {
            tags.instance("[default]Mesa/" + pad);
            tags.tag("[default]Mesa/" + pad + "/Pressure", "Float8");
            tags.tag("[default]Mesa/" + pad + "/Flow", "Float8");
        }
        tags.tag("[default]Mesa/P15/Flow", "Float8");
        tags.tag("[default]Plant/Header/Pressure", "Float8");
        tags.folder("[System]Gateway");
        lookups = new TagLookups(setups, gate, store, p -> lists, tags);
    }

    static JsonObject json(String s) {
        return JsonParser.parseString(s).getAsJsonObject();
    }

    void pad(String assetId) {
        writes.apply(P, json("{\"batchId\":\"" + UUID.randomUUID() + "\",\"ops\":[{\"op\":\"create\",\"entity\":\"item\","
            + "\"id\":\"" + UUID.randomUUID() + "\",\"baseVersion\":0,\"data\":{\"kind\":\"pad\",\"assetId\":"
            + (assetId == null ? "null" : "\"" + assetId + "\"")
            + ",\"geometry\":{\"type\":\"Point\",\"coordinates\":[1,2]}}}]}"), Actor.script("t"), Messages.LEVEL_FULL);
    }

    MapStudioException refused(Runnable r) {
        return assertThrows(MapStudioException.class, r::run);
    }

    JsonObject resolve(String path) {
        return lookups.resolveReply(P, FULL, json("{\"kindId\":\"pad\",\"assetId\":\"P12\",\"path\":\"" + path + "\"}"));
    }

    // Browse

    @Test
    void anEmptyBrowseIsTheDefaultProvidersRoot() {
        JsonObject r = lookups.browseReply(P, FULL, new JsonObject());
        assertEquals("default", r.get("provider").getAsString());
        assertEquals("", r.get("folder").getAsString());
        JsonArray providers = r.getAsJsonArray("providers");
        assertEquals(2, providers.size());
        int defaults = 0;
        for (int i = 0; i < providers.size(); i++) {
            JsonObject p = providers.get(i).getAsJsonObject();
            if (p.get("isDefault").getAsBoolean()) {
                defaults++;
                assertEquals("default", p.get("name").getAsString());
            }
        }
        assertEquals(1, defaults);
        List<String> names = names(r);
        assertEquals(List.of("Mesa", "Plant"), names);
        assertFalse(r.get("truncated").getAsBoolean());
    }

    @Test
    void anAssetFolderListsItsMembersWithFullPathsAndDataTypes() {
        JsonObject r = lookups.browseReply(P, FULL, json("{\"provider\":\"default\",\"folder\":\"/Mesa/P12/\"}"));
        assertEquals("Mesa/P12", r.get("folder").getAsString());
        JsonArray children = r.getAsJsonArray("children");
        assertEquals(List.of("Flow", "Pressure"), names(r));
        JsonObject pressure = children.get(1).getAsJsonObject();
        assertEquals("[default]Mesa/P12/Pressure", pressure.get("path").getAsString());
        assertEquals("tag", pressure.get("type").getAsString());
        assertEquals("Float8", pressure.get("dataType").getAsString());
        assertFalse(pressure.get("hasChildren").getAsBoolean());
        assertEquals(List.of("[default]Mesa/P12"), tags.browseCalls);
        assertEquals(FULL, tags.rolesSeen.get(0), "the browse runs under the session user's roles");
    }

    @Test
    void aSecondProviderIsBrowsedByName() {
        JsonObject r = lookups.browseReply(P, FULL, json("{\"provider\":\"system\"}"));
        assertEquals("System", r.get("provider").getAsString(), "provider names are matched without case");
        assertEquals(List.of("Gateway"), names(r));
    }

    @Test
    void anUnknownProviderOrFolderIsInvalidNamingIt() {
        MapStudioException p = refused(() -> lookups.browseReply(P, FULL, json("{\"provider\":\"nope\"}")));
        assertEquals("invalid", p.code());
        assertTrue(p.plainMessage().contains("nope"));
        MapStudioException f = refused(() -> lookups.browseReply(P, FULL, json("{\"provider\":\"default\",\"folder\":\"Mesa/Nope\"}")));
        assertEquals("invalid", f.code());
        assertTrue(f.plainMessage().contains("Mesa/Nope"));
    }

    @Test
    void aBadFolderOrAWrongTypeIsInvalid() {
        assertEquals("invalid", refused(() -> lookups.browseReply(P, FULL, json("{\"folder\":\"[default]Mesa\"}"))).code());
        assertEquals("invalid", refused(() -> lookups.browseReply(P, FULL, json("{\"folder\":3}"))).code());
        assertEquals("invalid", refused(() -> lookups.browseReply(P, FULL,
            json("{\"folder\":\"" + "a".repeat(1025) + "\"}"))).code());
        assertTrue(tags.browseCalls.isEmpty());
    }

    @Test
    void aViewerOrPhoneEditorIsRefusedRoleBeforeTheBodyIsRead() {
        for (Collection<String> roles : List.<Collection<String>>of(PHONE, List.of(), List.of("Other"))) {
            assertEquals("role", refused(() -> lookups.browseReply(P, roles, json("{\"provider\":\"nope\"}"))).code());
            assertEquals("role", refused(() -> lookups.resolveReply(P, roles, json("{\"kindId\":3}"))).code());
        }
        assertTrue(tags.browseCalls.isEmpty());
        assertTrue(tags.existingCalls.isEmpty());
    }

    @Test
    void noSetupIsStoreUnreachable() {
        assertEquals("store-unreachable", refused(() -> lookups.browseReply("other", FULL, new JsonObject())).code());
        assertEquals("store-unreachable", refused(() -> lookups.resolveReply("other", FULL, new JsonObject())).code());
    }

    @Test
    void aSlowTagSystemIsTagsUnavailable() {
        tags.slow = true;
        pad("P12");
        assertEquals("tags-unavailable", refused(() -> lookups.browseReply(P, FULL, new JsonObject())).code());
        assertEquals("tags-unavailable", refused(() -> resolve("[default]Mesa/P12/Pressure")).code());
    }

    @Test
    void aFullFolderIsTruncatedAtTheCap() {
        for (int i = 0; i < TagLookups.MAX_CHILDREN + 5; i++) {
            tags.tag("[default]Big/T" + String.format("%04d", i), "Int4");
        }
        JsonObject r = lookups.browseReply(P, FULL, json("{\"folder\":\"Big\"}"));
        assertEquals(TagLookups.MAX_CHILDREN, r.getAsJsonArray("children").size());
        assertTrue(r.get("truncated").getAsBoolean());
    }

    @Test
    void theDefaultProviderFollowsTheOwnersRule() {
        assertEquals("Tags", TagLookups.defaultProvider(List.of("default", "System", "Tags"), "tags"));
        assertEquals("default", TagLookups.defaultProvider(List.of("default", "System"), ""));
        assertEquals("default", TagLookups.defaultProvider(List.of("default", "System"), "gone"));
        assertEquals("Alpha", TagLookups.defaultProvider(List.of("System", "Zed", "Alpha"), null));
        assertEquals("System", TagLookups.defaultProvider(List.of("System"), null));
        assertNull(TagLookups.defaultProvider(List.of(), null));
        tags.projectDefault = "System";
        assertEquals("System", lookups.browseReply(P, FULL, new JsonObject()).get("provider").getAsString());
    }

    // Resolve

    @Test
    void aPickInsideCountsTheLinkedPadsTheTagExistsFor() {
        pad("P12");
        pad("P14");
        pad("P15");
        JsonObject r = resolve("[default]Mesa/P12/Pressure");
        assertEquals("{asset.path}/Pressure", r.get("path").getAsString());
        assertTrue(r.get("relative").getAsBoolean());
        assertEquals(2, r.get("n").getAsInt(), "P15 has no Pressure");
        assertEquals(3, r.get("m").getAsInt());
        assertEquals(1, tags.existingCalls.size(), "one existence check for all items");
        assertEquals(3, tags.existingCalls.get(0).size());
    }

    @Test
    void anAlreadyRelativePathGivesTheSameAnswer() {
        pad("P12");
        pad("P14");
        pad("P15");
        JsonObject r = resolve("{asset.path}/Pressure");
        assertEquals("{asset.path}/Pressure", r.get("path").getAsString());
        assertEquals(2, r.get("n").getAsInt());
        assertEquals(3, r.get("m").getAsInt());
    }

    @Test
    void aPickOutsideIsUnchangedWithNoCounts() {
        pad("P12");
        JsonObject r = resolve("[default]Plant/Header/Pressure");
        assertEquals("[default]Plant/Header/Pressure", r.get("path").getAsString());
        assertFalse(r.get("relative").getAsBoolean());
        assertFalse(r.has("n"));
        assertFalse(r.has("m"));
        assertTrue(tags.existingCalls.isEmpty());
    }

    @Test
    void aPrefixThatIsNotASegmentIsNotRelative() {
        JsonObject r = lookups.resolveReply(P, FULL, json("{\"kindId\":\"pad\",\"assetId\":\"P1\",\"path\":\"[default]Mesa/P12/X\"}"));
        assertFalse(r.get("relative").getAsBoolean());
    }

    @Test
    void badNamesAreInvalid() {
        assertEquals("invalid", refused(() -> lookups.resolveReply(P, FULL,
            json("{\"kindId\":\"tank\",\"assetId\":\"P12\",\"path\":\"{asset.path}\"}"))).code());
        assertEquals("invalid", refused(() -> lookups.resolveReply(P, FULL,
            json("{\"kindId\":\"pad\",\"assetId\":\"P99\",\"path\":\"{asset.path}\"}"))).code());
        assertEquals("invalid", refused(() -> lookups.resolveReply(P, FULL,
            json("{\"kindId\":\"pad\",\"assetId\":\"L3\",\"path\":\"{asset.path}\"}"))).code(), "an asset of another kind");
        assertEquals("invalid", refused(() -> resolve("Mesa/P12/X")).code());
        assertEquals("invalid", refused(() -> resolve("[~]Mesa/P12/X")).code());
        assertEquals("invalid", refused(() -> resolve("{asset.name}")).code());
        assertEquals("invalid", refused(() -> lookups.resolveReply(P, FULL, json("{\"kindId\":\"pad\",\"assetId\":\"P12\"}"))).code());
        assertEquals("invalid", refused(() -> lookups.resolveReply(P, FULL,
            json("{\"kindId\":\"pad\",\"assetId\":true,\"path\":\"{asset.path}\"}"))).code());
    }

    @Test
    void noLinkedItemsIsZeroOfZeroWithNoTagCall() {
        pad(null);
        JsonObject r = resolve("[default]Mesa/P12/Pressure");
        assertTrue(r.get("relative").getAsBoolean());
        assertEquals(0, r.get("n").getAsInt());
        assertEquals(0, r.get("m").getAsInt());
        assertTrue(tags.existingCalls.isEmpty());
    }

    @Test
    void anItemOfAnUnknownAssetIsNotCountedAndItemsOfAnotherKindAreNot() throws Exception {
        pad("P12");
        pad("P99");
        writes.apply(P, json("{\"batchId\":\"" + UUID.randomUUID() + "\",\"ops\":[{\"op\":\"create\",\"entity\":\"item\","
            + "\"id\":\"" + UUID.randomUUID() + "\",\"baseVersion\":0,\"data\":{\"kind\":\"line\",\"assetId\":\"L3\","
            + "\"geometry\":{\"type\":\"LineString\",\"coordinates\":[[1,2],[3,4]]}}}]}"), Actor.script("t"), Messages.LEVEL_FULL);
        JsonObject r = resolve("{asset.path}/Pressure");
        assertEquals(1, r.get("n").getAsInt());
        assertEquals(1, r.get("m").getAsInt());
    }

    @Test
    void twoItemsOnOneAssetCountTwiceButAreCheckedOnce() {
        pad("P12");
        pad("P12");
        JsonObject r = resolve("{asset.path}/Pressure");
        assertEquals(2, r.get("n").getAsInt());
        assertEquals(2, r.get("m").getAsInt());
        assertEquals(1, tags.existingCalls.get(0).size());
    }

    @Test
    void theAssetPathItselfCountsTheAssetsThatExist() {
        pad("P12");
        pad("P15");
        tags.nodes.remove("[default]mesa/p15");
        JsonObject r = resolve("{asset.path}");
        assertEquals("{asset.path}", r.get("path").getAsString());
        assertEquals(1, r.get("n").getAsInt());
        assertEquals(2, r.get("m").getAsInt());
    }

    @Test
    void anUnreadableStoreIsStoreUnreachableAndAReadOnlyOneStillAnswers() {
        pad("P12");
        state = StoreState.readOnly("The map store is newer.");
        assertEquals(1, resolve("{asset.path}/Pressure").get("m").getAsInt());
        state = StoreState.unavailable("The map store is unavailable.");
        assertEquals("store-unreachable", refused(() -> resolve("{asset.path}/Pressure")).code());
    }

    @Test
    void anAssetWhoseBasePathIsNotAFullPathIsBlamedNotThePickedPath() {
        // Story 3's adapter check lets [default]/Mesa/P12 and [~]Mesa/P12 through.
        for (String id : List.of("PX", "PR")) {
            MapStudioException ex = refused(() -> lookups.resolveReply(P, FULL,
                json("{\"kindId\":\"pad\",\"assetId\":\"" + id + "\",\"path\":\"[default]Mesa/P12/Pressure\"}")));
            assertEquals("invalid", ex.code());
            assertTrue(ex.plainMessage().startsWith("The asset " + id + "'s basePath "), ex.plainMessage());
        }
        assertTrue(tags.existingCalls.isEmpty());
    }

    @Test
    void anItemOnAnUnusableBasePathCountsInMButNeverInN() {
        pad("P12");
        pad("PX");
        JsonObject r = resolve("{asset.path}/Pressure");
        assertEquals(1, r.get("n").getAsInt());
        assertEquals(2, r.get("m").getAsInt());
        assertEquals(List.of("[default]Mesa/P12/Pressure"), tags.existingCalls.get(0));
    }

    @Test
    void theLevelIsDecidedOnTheSetupTheItemsAreReadUnder() throws Exception {
        pad("P12");
        // The setup changes between the role check and the store read (the adapter lists are read in between):
        // the session's role is now a phone editor's.
        StoreGate gate = new StoreGate(setups, c -> state);
        TagLookups l = new TagLookups(setups, gate, store, p -> {
            setups.put(P, phoneOnly());
            return lists;
        }, tags);
        assertEquals("role", refused(() -> l.resolveReply(P, FULL,
            json("{\"kindId\":\"pad\",\"assetId\":\"P12\",\"path\":\"{asset.path}/Pressure\"}"))).code());
        assertTrue(tags.existingCalls.isEmpty());
    }

    static Setup phoneOnly() {
        try {
            return Setup.parse("{\"schemaVersion\":1,\"connection\":\"MapStudio\",\"roles\":{\"phone\":[\"MapEditor\"]}}");
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    static List<String> names(JsonObject reply) {
        List<String> names = new ArrayList<>();
        reply.getAsJsonArray("children").forEach(c -> names.add(c.getAsJsonObject().get("name").getAsString()));
        return names;
    }
}
