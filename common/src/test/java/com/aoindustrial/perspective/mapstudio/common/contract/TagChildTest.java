package com.aoindustrial.perspective.mapstudio.common.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonObject;

class TagChildTest {

    @Test
    void typeWordsAreTheContractsOnes() {
        assertEquals("folder", TagChild.typeWord("Folder"));
        assertEquals("tag", TagChild.typeWord("AtomicTag"));
        assertEquals("udt-instance", TagChild.typeWord("UdtInstance"));
        assertEquals("udt-type", TagChild.typeWord("UdtType"));
        assertEquals("other", TagChild.typeWord("Provider"));
        assertEquals("other", TagChild.typeWord(null));
    }

    @Test
    void onlyATagKeepsItsDataType() {
        assertEquals("Float8", TagChild.of("Pressure", "[default]Mesa/P12/Pressure", "AtomicTag", "Float8", false).dataType());
        // Ignition reports String for a folder and an instance (live 8.3.10); the contract sends null.
        assertEquals(null, TagChild.of("Mesa", "[default]Mesa", "Folder", "String", true).dataType());
        assertEquals(null, TagChild.of("P12", "[default]Mesa/P12", "UdtInstance", "String", true).dataType());
    }

    @Test
    void propertiesAndNodesWithoutAPathAreLeftOut() {
        assertFalse(TagChild.listed("Property", null));
        assertFalse(TagChild.listed("Property", "[default]x"));
        assertFalse(TagChild.listed("Node", null));
        assertTrue(TagChild.listed("AtomicTag", "[default]Mesa/P12/Flow"));
    }

    @Test
    void theJsonCarriesEveryField() {
        JsonObject o = TagChild.of("P12", "[default]Mesa/P12", "UdtInstance", "String", true).toJson();
        assertEquals("P12", o.get("name").getAsString());
        assertEquals("[default]Mesa/P12", o.get("path").getAsString());
        assertEquals("udt-instance", o.get("type").getAsString());
        assertTrue(o.get("dataType").isJsonNull());
        assertTrue(o.get("hasChildren").getAsBoolean());
    }

    @Test
    void childrenSortByNameIgnoringCaseFirst() {
        List<TagChild> list = new ArrayList<>(List.of(
            TagChild.of("b", "[d]b", "Folder", null, true),
            TagChild.of("_types_", "[d]_types_", "Folder", null, true),
            TagChild.of("A", "[d]A", "Folder", null, true),
            TagChild.of("a", "[d]a", "Folder", null, true)));
        list.sort(TagChild.BY_NAME);
        assertEquals(List.of("_types_", "A", "a", "b"), list.stream().map(TagChild::name).toList());
    }
}
