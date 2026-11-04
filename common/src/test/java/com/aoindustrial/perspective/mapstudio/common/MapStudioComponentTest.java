package com.aoindustrial.perspective.mapstudio.common;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;
import com.inductiveautomation.perspective.common.api.ComponentEventDescriptor;

/**
 * The component's contract with the page (epic 4 entry 2, contract 0.4.0): the descriptor declares the
 * {@code onItemSelected} event with the event schema, and the props schema is the closed list with
 * {@code editMode} (bidirectional) and {@code selectedItem} (a string or null).
 */
class MapStudioComponentTest {

    private static JsonObject resource(String path) throws Exception {
        try (InputStream in = MapStudioComponentTest.class.getResourceAsStream(path)) {
            assertNotNull(in, path);
            return JsonParser.parseReader(new InputStreamReader(in, StandardCharsets.UTF_8)).getAsJsonObject();
        }
    }

    @Test
    void theDescriptorDeclaresTheItemSelectedEventWithItsSchema() {
        List<ComponentEventDescriptor> events = List.copyOf(MapStudioComponent.DESCRIPTOR.events());
        assertEquals(1, events.size());
        ComponentEventDescriptor event = events.get(0);
        assertEquals("onItemSelected", event.getName());
        assertEquals(MapStudioComponent.EVENT_ITEM_SELECTED, event.getName());
        assertTrue(event.getDescription().contains("event.item"), event.getDescription());
        assertFalse(event.getDescription().contains("\u2014"), "no em dash");
        assertNotNull(event.getSchema());
        assertNotNull(MapStudioComponent.DESCRIPTOR.schema());
        assertEquals("ao.mapstudio", MapStudioComponent.DESCRIPTOR.id());
    }

    @Test
    void theEventSchemaDescribesTheMapItemObjectOrNull() throws Exception {
        JsonObject schema = resource("/mapstudio.events.json");
        JsonObject item = schema.getAsJsonObject("properties").getAsJsonObject("item");
        JsonArray types = item.getAsJsonArray("type");
        assertEquals(2, types.size());
        assertEquals("object", types.get(0).getAsString());
        assertEquals("null", types.get(1).getAsString());
        JsonObject fields = item.getAsJsonObject("properties");
        for (String field : List.of("id", "name", "kind", "assetId", "properties", "basePath", "alarmsPath", "values")) {
            assertTrue(fields.has(field), field);
        }
        assertFalse(schema.toString().contains("\u2014"), "no em dash");
    }

    @Test
    void thePropsSchemaIsTheClosedListWithEditModeAndSelectedItem() throws Exception {
        JsonObject schema = resource("/mapstudio.props.json");
        assertFalse(schema.get("additionalProperties").getAsBoolean(), "the list is closed");
        JsonObject props = schema.getAsJsonObject("properties");
        assertEquals(List.of("startingArea", "previewStyles", "editMode", "selectedItem", "style"), List.copyOf(props.keySet()));
        JsonObject editMode = props.getAsJsonObject("editMode");
        assertEquals("boolean", editMode.get("type").getAsString());
        assertFalse(editMode.get("default").getAsBoolean());
        assertTrue(editMode.get("description").getAsString().contains("writes the value back"));
        JsonObject selected = props.getAsJsonObject("selectedItem");
        JsonArray types = selected.getAsJsonArray("type");
        assertEquals("string", types.get(0).getAsString());
        assertEquals("null", types.get(1).getAsString());
        assertTrue(selected.get("default").isJsonNull());
        assertFalse(schema.toString().contains("\u2014"), "no em dash");
    }
}
