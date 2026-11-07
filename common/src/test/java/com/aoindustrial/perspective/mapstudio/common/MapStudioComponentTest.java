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
 * The component's contract with the page (epic 4 entries 2 and 14, contract 0.4.0): the descriptor declares the
 * four events {@code onItemSelected}, {@code onViewportChanged}, {@code onPopupOpen} and {@code onPopupClose}, each
 * with its schema (the Designer lists them), and the props schema is the closed list with {@code editMode}
 * (bidirectional), {@code selectedItem} (a string or null, both ways) and the read-only {@code viewport}.
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
        assertEquals(4, events.size());
        assertEquals(List.of("onItemSelected", "onViewportChanged", "onPopupOpen", "onPopupClose"),
            events.stream().map(ComponentEventDescriptor::getName).toList());
        assertEquals(MapStudioComponent.EVENT_ITEM_SELECTED, events.get(0).getName());
        assertEquals(MapStudioComponent.EVENT_VIEWPORT_CHANGED, events.get(1).getName());
        assertEquals(MapStudioComponent.EVENT_POPUP_OPEN, events.get(2).getName());
        assertEquals(MapStudioComponent.EVENT_POPUP_CLOSE, events.get(3).getName());
        ComponentEventDescriptor event = events.get(0);
        assertTrue(event.getDescription().contains("event.mapItem"), event.getDescription());
        assertTrue(events.get(1).getDescription().contains("event.bounds"), events.get(1).getDescription());
        assertTrue(events.get(2).getDescription().contains("event.segment"), events.get(2).getDescription());
        assertTrue(events.get(3).getDescription().contains("event.itemId"), events.get(3).getDescription());
        for (ComponentEventDescriptor e : events) {
            assertFalse(e.getDescription().contains("\u2014"), "no em dash");
            assertNotNull(e.getSchema(), e.getName());
        }
        assertNotNull(MapStudioComponent.DESCRIPTOR.schema());
        assertEquals("ao.mapstudio", MapStudioComponent.DESCRIPTOR.id());
    }

    @Test
    void theEventSchemaDescribesTheMapItemObjectOrNull() throws Exception {
        JsonObject schema = resource("/mapstudio.events.json");
        // The key is mapItem (R21, R48; entry 2 shipped item, unreleased): the one key of the event object.
        assertEquals(List.of("mapItem"), List.copyOf(schema.getAsJsonObject("properties").keySet()));
        JsonObject item = schema.getAsJsonObject("properties").getAsJsonObject("mapItem");
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
    void theViewportAndPopupEventSchemasNameTheirFields() throws Exception {
        JsonObject viewport = resource("/mapstudio.events.viewport.json");
        assertEquals(List.of("center", "zoom", "bounds"), List.copyOf(viewport.getAsJsonObject("properties").keySet()));
        JsonObject open = resource("/mapstudio.events.popup-open.json");
        assertEquals(List.of("itemId", "segment"), List.copyOf(open.getAsJsonObject("properties").keySet()));
        JsonArray segment = open.getAsJsonObject("properties").getAsJsonObject("segment").getAsJsonArray("type");
        assertEquals("object", segment.get(0).getAsString());
        assertEquals("null", segment.get(1).getAsString());
        JsonObject close = resource("/mapstudio.events.popup-close.json");
        assertEquals(List.of("itemId"), List.copyOf(close.getAsJsonObject("properties").keySet()));
        for (JsonObject schema : List.of(viewport, open, close)) {
            assertFalse(schema.get("additionalProperties").getAsBoolean(), "a closed event object");
            assertFalse(schema.toString().contains("\u2014"), "no em dash");
        }
    }

    @Test
    void thePropsSchemaIsTheClosedListWithEditModeAndSelectedItem() throws Exception {
        JsonObject schema = resource("/mapstudio.props.json");
        assertFalse(schema.get("additionalProperties").getAsBoolean(), "the list is closed");
        JsonObject props = schema.getAsJsonObject("properties");
        assertEquals(List.of("startingArea", "previewStyles", "editMode", "selectedItem", "viewport", "userLocation", "directions",
            "style"),
            List.copyOf(props.keySet()));
        JsonObject editMode = props.getAsJsonObject("editMode");
        assertEquals("boolean", editMode.get("type").getAsString());
        assertFalse(editMode.get("default").getAsBoolean());
        assertTrue(editMode.get("description").getAsString().contains("writes the value back"));
        JsonObject selected = props.getAsJsonObject("selectedItem");
        JsonArray types = selected.getAsJsonArray("type");
        assertEquals("string", types.get(0).getAsString());
        assertEquals("null", types.get(1).getAsString());
        assertTrue(selected.get("default").isJsonNull());
        assertTrue(selected.get("description").getAsString().contains("an id the page writes selects"));
        JsonObject viewport = props.getAsJsonObject("viewport");
        assertTrue(viewport.get("readOnly").getAsBoolean(), "the component writes it; the page does not");
        assertTrue(viewport.get("default").isJsonNull());
        assertEquals(List.of("center", "zoom", "bounds"), List.copyOf(viewport.getAsJsonObject("properties").keySet()));
        JsonObject location = props.getAsJsonObject("userLocation");
        JsonArray locationTypes = location.getAsJsonArray("type");
        assertEquals("object", locationTypes.get(0).getAsString());
        assertEquals("null", locationTypes.get(1).getAsString());
        assertTrue(location.get("default").isJsonNull(), "unbound by default");
        assertTrue(location.get("additionalProperties").getAsBoolean(), "extra keys tolerated");
        assertTrue(location.get("description").getAsString().contains("{session.props.geolocation}"));
        assertEquals(List.of("enabled", "permissionGranted", "options", "data"),
            List.copyOf(location.getAsJsonObject("properties").keySet()));
        for (String key : List.of("enabled", "permissionGranted")) {
            // A browser session binds permissionGranted null (8.3.10): both flags take a boolean or null.
            JsonArray flag = location.getAsJsonObject("properties").getAsJsonObject(key).getAsJsonArray("type");
            assertEquals(List.of("boolean", "null"), List.of(flag.get(0).getAsString(), flag.get(1).getAsString()), key);
        }
        assertEquals(List.of("latitude", "longitude", "accuracy", "altitude", "heading", "speed", "timestamp"),
            List.copyOf(location.getAsJsonObject("properties").getAsJsonObject("data").getAsJsonObject("properties").keySet()));
        JsonObject directions = props.getAsJsonObject("directions");
        JsonArray directionsTypes = directions.getAsJsonArray("type");
        assertEquals("object", directionsTypes.get(0).getAsString());
        assertEquals("null", directionsTypes.get(1).getAsString());
        assertTrue(directions.get("default").isJsonNull(), "off by default");
        assertTrue(directions.get("description").getAsString().contains("sends nothing to any service"));
        assertEquals(List.of("enabled", "urlTemplate"), List.copyOf(directions.getAsJsonObject("properties").keySet()));
        assertFalse(schema.toString().contains("\u2014"), "no em dash");
    }
}
