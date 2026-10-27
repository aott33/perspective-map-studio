package com.aoindustrial.perspective.mapstudio.common.contract;

import static com.aoindustrial.perspective.mapstudio.common.contract.KindFixtures.LINE;
import static com.aoindustrial.perspective.mapstudio.common.contract.KindFixtures.PAD;
import static com.aoindustrial.perspective.mapstudio.common.contract.KindFixtures.json;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/** A map item checked and normalised against its kind (epic 2 story 9). */
class ItemCheckTest {

    static final String ID = "4f6c9a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b";
    static final String POINT = "{\"type\":\"Point\",\"coordinates\":[-104.97,39.74]}";
    static final String LINE_GEOMETRY = "{\"type\":\"LineString\",\"coordinates\":[[-104.99,39.74],[-104.98,39.75]]}";

    static MapItemRecord item(String kind, String geometry, String properties, String overrides) {
        return MapItemRecord.fromCreate(ID, json("{\"kind\":\"" + kind + "\",\"name\":\"P12\",\"geometry\":" + geometry
            + ",\"properties\":" + properties + ",\"overrides\":" + overrides + "}"), 0);
    }

    @Test
    void csvStringsBecomeTypedValuesAndTheRestIsUnchanged() {
        MapItemRecord pad = ItemCheck.check(item("pad", POINT, "{\"wells\":\"12\",\"operator\":\"Acme\","
            + "\"status\":\"producing\"}", "{}"), PAD);
        assertEquals(json("{\"wells\":12,\"operator\":\"Acme\",\"status\":\"producing\"}"), pad.properties());
        assertEquals("12", pad.properties().get("wells").toString());
        MapItemRecord line = ItemCheck.check(item("line", LINE_GEOMETRY, "{\"diameter\":\" 4.5 \",\"buried\":\"true\"}",
            "{}"), LINE);
        assertEquals("4.5", line.properties().get("diameter").toString());
        assertEquals(true, line.properties().get("buried").getAsBoolean());
        MapItemRecord numbers = ItemCheck.check(item("line", LINE_GEOMETRY, "{\"diameter\":6,\"buried\":false}", "{}"),
            LINE);
        assertEquals(json("{\"diameter\":6,\"buried\":false}"), numbers.properties());
        MapItemRecord blanks = ItemCheck.check(item("line", LINE_GEOMETRY, "{\"diameter\":\" \",\"buried\":null}", "{}"),
            LINE);
        assertTrue(blanks.properties().get("diameter").isJsonNull());
        assertEquals("1000", ItemCheck.check(item("line", LINE_GEOMETRY, "{\"diameter\":\"1e3\"}", "{}"), LINE)
            .properties().get("diameter").toString());
    }

    @Test
    void requiredFieldsAreNotEnforcedAtSave() {
        assertEquals(json("{}"), ItemCheck.check(item("pad", POINT, "{}", "{}"), PAD).properties());
    }

    @Test
    void theGeometryMustMatchTheKind() {
        assertEquals("kind line is a line kind, so its geometry is a LineString, not a Point.",
            refused(item("line", POINT, "{}", "{}"), LINE));
        assertEquals("kind pad is a point kind, so its geometry is a Point, not a LineString.",
            refused(item("pad", LINE_GEOMETRY, "{}", "{}"), PAD));
    }

    @Test
    void mistypedAndUnknownPropertiesAreRefused() {
        assertEquals("properties.wells is a whole number field, not \"abc\".",
            refused(item("pad", POINT, "{\"wells\":\"abc\"}", "{}"), PAD));
        assertEquals("properties.wells is a whole number field, not 4.5.",
            refused(item("pad", POINT, "{\"wells\":4.5}", "{}"), PAD));
        assertEquals("properties.colour is not a form field of kind pad; its fields are operator, wells, status.",
            refused(item("pad", POINT, "{\"colour\":\"red\"}", "{}"), PAD));
        assertTrue(refused(item("pad", POINT, "{\"status\":\"sold\"}", "{}"), PAD)
            .contains("its value is one of producing, shut in"));
        assertTrue(refused(item("pad", POINT, "{\"operator\":5}", "{}"), PAD).contains("is a text field"));
        assertTrue(refused(item("line", LINE_GEOMETRY, "{\"buried\":\"yes\"}", "{}"), LINE)
            .contains("is a true or false field"));
        assertTrue(refused(item("line", LINE_GEOMETRY, "{\"diameter\":[1]}", "{}"), LINE).contains("is a number field"));
    }

    @Test
    void hugeNumbersAreRefusedBeforeAnyConversion() {
        long start = System.nanoTime();
        for (String v : new String[] {"\"1e999999999\"", "1e999999999", "\"-1e999999999\"", "\"1e-999999999\""}) {
            assertTrue(refused(item("pad", POINT, "{\"wells\":" + v + "}", "{}"), PAD).contains("out of range"), v);
            assertTrue(refused(item("line", LINE_GEOMETRY, "{\"diameter\":" + v + "}", "{}"), LINE)
                .contains("out of range"), v);
        }
        assertTrue(System.nanoTime() - start < 2_000_000_000L, "refusing huge numbers is cheap");
        assertTrue(refused(item("pad", POINT, "{\"wells\":\"1e25\"}", "{}"), PAD).contains("out of range"));
        assertTrue(refused(item("line", LINE_GEOMETRY, "{\"diameter\":\"1e309\"}", "{}"), LINE).contains("out of range"));
        assertEquals("9223372036854775807", ItemCheck.check(item("pad", POINT, "{\"wells\":\"9223372036854775807\"}",
            "{}"), PAD).properties().get("wells").toString());
        assertEquals("1000", ItemCheck.check(item("pad", POINT, "{\"wells\":\"1e3\"}", "{}"), PAD).properties()
            .get("wells").toString());
    }

    @Test
    void overridesAreAPartialKindSetupWithFullPaths() {
        String rule = "{\"styleRule\":{\"source\":{\"path\":\"[default]Mesa/P12/State\"},\"type\":\"states\","
            + "\"cases\":[{\"value\":\"stopped\",\"preset\":\"fault\"}]}}";
        assertEquals(json(rule), ItemCheck.check(item("pad", POINT, "{}", rule), PAD).overrides());
        assertTrue(refused(item("pad", POINT, "{}", "{\"kpis\":[{\"key\":\"x\",\"path\":\"{asset.path}/X\"}]}"), PAD)
            .startsWith("overrides: kpis[0].path: an override's tag path is a full path"));
        assertTrue(refused(item("pad", POINT, "{}", "{\"size\":3}"), PAD).startsWith("overrides: size is not a part"));
    }

    private static String refused(MapItemRecord item, Kind kind) {
        return assertThrows(InvalidValue.class, () -> ItemCheck.check(item, kind)).getMessage();
    }
}
