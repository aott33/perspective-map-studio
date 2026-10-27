package com.aoindustrial.perspective.mapstudio.common.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.Test;

/** Every rule of setup v1 (docs/setup.md) and every input of story 6's matrix that is about the file. */
class SetupValidationTest {

    private static final String BASE = "\"schemaVersion\":1,\"connection\":\"MapStudio\"";

    private static Setup.Reading read(String extra) {
        return Setup.read("{" + BASE + (extra.isEmpty() ? "" : "," + extra) + "}");
    }

    private static SetupProblem only(Setup.Reading r) {
        assertFalse(r.ok(), "expected a problem");
        assertEquals(1, r.problems().size(), r.problems().toString());
        return r.problems().get(0);
    }

    @Test
    void theDevSetupAndTheShortestSetupAreValid() throws Exception {
        Path dev = Path.of("..", "ops", "project", "com.aoindustrial.perspective.mapstudio", "setup", "setup.json");
        Setup.Reading devReading = Setup.read(Files.readString(dev));
        assertTrue(devReading.ok(), devReading.problems().toString());
        Setup s = Setup.parse("{" + BASE + "}");
        assertEquals(List.of(), s.fullRoles());
        assertEquals(List.of(), s.phoneRoles());
        assertEquals("", s.kindsFunction());
        assertEquals("", s.assetsFunction());
        assertEquals(10, s.refreshIntervalSeconds());
        assertEquals("", s.alarmPage());
        assertEquals(List.of("none", "osm"), s.basemaps());
        assertEquals("", s.tokenSecret());
    }

    @Test
    void aFullValidSetupKeepsEveryField() throws Exception {
        Setup s = Setup.parse("{" + BASE + ",\"roles\":{\"full\":[\"A\",\"B\"],\"phone\":[\"C\"]},"
            + "\"kindsFunction\":\"mapstudio.kinds.get\",\"assetsFunction\":\"site.assets.find\","
            + "\"refreshIntervalSeconds\":3600,\"alarmPage\":\"/alarms\","
            + "\"basemaps\":[\"satellite\",\"none\",\"osm\",\"mapbox\"],\"tokenSecret\":\"MapboxToken\"}");
        assertEquals(List.of("A", "B"), s.fullRoles());
        assertEquals(List.of("C"), s.phoneRoles());
        assertEquals("mapstudio.kinds.get", s.kindsFunction());
        assertEquals("site.assets.find", s.assetsFunction());
        assertEquals(3600, s.refreshIntervalSeconds());
        assertEquals("/alarms", s.alarmPage());
        assertEquals(List.of("satellite", "none", "osm", "mapbox"), s.basemaps());
        assertEquals("MapboxToken", s.tokenSecret());
        assertTrue(read("\"refreshIntervalSeconds\":1").ok());
        assertTrue(read("\"refreshIntervalSeconds\":10.0").ok(), "10.0 is a whole number");
        assertTrue(read("\"roles\":null,\"basemaps\":null").ok(), "null means the default");
    }

    @Test
    void aBadFieldNamesTheFieldAndTheValue() {
        SetupProblem p = only(read("\"refreshIntervalSeconds\":\"ten\""));
        assertEquals("refreshIntervalSeconds", p.field());
        assertEquals("refreshIntervalSeconds must be a whole number from 1 to 3600, not \"ten\"", p.message());
        assertEquals("refreshIntervalSeconds must be a whole number from 1 to 3600, not \"ten\".",
            read("\"refreshIntervalSeconds\":\"ten\"").reason());
        for (String v : List.of("0", "3601", "2.5", "-1", "true", "[10]")) {
            assertEquals("refreshIntervalSeconds", only(read("\"refreshIntervalSeconds\":" + v)).field(), v);
        }
    }

    @Test
    void severalBadFieldsAreAllReportedInOneReason() {
        Setup.Reading r = read("\"basemaps\":\"osm\",\"roles\":{\"full\":\"MapEditor\"}");
        assertEquals(2, r.problems().size());
        String reason = r.reason();
        assertTrue(reason.startsWith("2 problems: "), reason);
        assertTrue(reason.contains("roles.full must be a list of role names, not \"MapEditor\""), reason);
        assertTrue(reason.contains("basemaps must be a list from none, osm, satellite, mapbox, not \"osm\""), reason);
        assertTrue(reason.endsWith("."), reason);
        Setup.SetupException ex = assertThrows(Setup.SetupException.class,
            () -> Setup.parse("{" + BASE + ",\"basemaps\":\"osm\",\"roles\":{\"full\":\"MapEditor\"}}"));
        assertEquals(reason, ex.getMessage());
    }

    @Test
    void notJsonSaysWhere() {
        SetupProblem p = only(Setup.read("{\"schemaVersion\": 1,\n  \"connection\": \"MapStudio\""));
        assertEquals(SetupProblem.FILE, p.field());
        assertTrue(p.message().matches("setup\\.json is not valid JSON \\(line 2, column \\d+\\)"), p.message());
        assertTrue(only(Setup.read("not json")).message().startsWith("setup.json is not valid JSON"));
        assertTrue(only(Setup.read("{" + BASE + "} {}")).message().startsWith("setup.json is not valid JSON"),
            "nothing may follow the object");
        assertTrue(only(Setup.read("{'schemaVersion':1}")).message().startsWith("setup.json is not valid JSON"),
            "strict JSON, no single quotes");
        assertEquals("setup.json must be a JSON object {\"schemaVersion\": 1, ...}", only(Setup.read("")).message());
        assertEquals("setup.json must be a JSON object {\"schemaVersion\": 1, ...}", only(Setup.read("[1]")).message());
    }

    @Test
    void aNewerSchemaIsReportedAloneAndAnOtherVersionIsInvalid() {
        SetupProblem p = only(Setup.read("{\"schemaVersion\":2,\"connection\":\"MapStudio\",\"newField\":true}"));
        assertEquals("setup.json is written for a newer Map Studio (schema 2; this module reads 1)", p.message());
        assertEquals("schemaVersion must be 1, not 0", only(Setup.read("{\"schemaVersion\":0,\"connection\":\"M\"}")).message());
        assertEquals("schemaVersion must be 1, not \"1\"",
            only(Setup.read("{\"schemaVersion\":\"1\",\"connection\":\"M\"}")).message());
        assertEquals("schemaVersion is missing; it must be 1", only(Setup.read("{\"connection\":\"M\"}")).message());
    }

    @Test
    void connectionIsRequiredAndNonEmpty() {
        assertEquals("connection is missing; it must name a database connection of the Gateway",
            only(Setup.read("{\"schemaVersion\":1}")).message());
        assertEquals("connection must be the name of a database connection, not \"  \"",
            only(Setup.read("{\"schemaVersion\":1,\"connection\":\"  \"}")).message());
        assertEquals("connection", only(Setup.read("{\"schemaVersion\":1,\"connection\":5}")).field());
    }

    @Test
    void rolesAreListsOfDistinctNames() {
        assertEquals("roles must be an object {\"full\": [...], \"phone\": [...]}, not [\"MapEditor\"]",
            only(read("\"roles\":[\"MapEditor\"]")).message());
        assertEquals("roles.phone must hold only role names (non-empty text), not \"\"",
            only(read("\"roles\":{\"phone\":[\"\"]}")).message());
        assertEquals("roles.full must hold only role names (non-empty text), not 3",
            only(read("\"roles\":{\"full\":[3]}")).message());
        assertEquals("roles.full lists MapEditor twice", only(read("\"roles\":{\"full\":[\"MapEditor\",\"MapEditor\"]}")).message());
        assertEquals("roles.fulll is not a setup field of schema 1 (did you mean roles.full?)",
            only(read("\"roles\":{\"fulll\":[\"MapEditor\"]}")).message());
    }

    @Test
    void functionsAreEmptyOrDottedNames() {
        assertTrue(read("\"kindsFunction\":\"\",\"assetsFunction\":\"\"").ok());
        assertEquals("kindsFunction must be empty or a project script function name such as mapstudio.kinds.get, not \"kinds\"",
            only(read("\"kindsFunction\":\"kinds\"")).message());
        assertEquals("assetsFunction", only(read("\"assetsFunction\":\"site.assets.find()\"")).field());
        assertEquals("assetsFunction", only(read("\"assetsFunction\":\"1site.find\"")).field());
        assertEquals("kindsFunction", only(read("\"kindsFunction\":false")).field());
    }

    @Test
    void alarmPageIsEmptyOrAPath() {
        assertTrue(read("\"alarmPage\":\"\"").ok());
        assertEquals("alarmPage must be empty or a page path starting with /, not \"alarms\"",
            only(read("\"alarmPage\":\"alarms\"")).message());
    }

    @Test
    void basemapsAreANonEmptyListOfKnownNames() {
        assertEquals("basemaps must name at least one of none, osm, satellite, mapbox", only(read("\"basemaps\":[]")).message());
        assertEquals("basemaps has \"google\"; each entry must be one of none, osm, satellite, mapbox",
            only(read("\"basemaps\":[\"osm\",\"google\"]")).message());
        assertEquals("basemaps lists osm twice", only(read("\"basemaps\":[\"osm\",\"osm\"]")).message());
    }

    @Test
    void tokenSecretIsANameAndItsValueIsNeverShown() {
        SetupProblem p = only(read("\"tokenSecret\":{\"value\":\"pk.SECRETVALUE\"}"));
        assertEquals("tokenSecret", p.field());
        assertFalse(p.message().contains("SECRETVALUE"), p.message());
    }

    @Test
    void anUnknownFieldIsInvalidWithAHintAndItsValueIsNotShown() {
        SetupProblem p = only(read("\"refreshInterval\":30"));
        assertEquals("refreshInterval", p.field());
        assertEquals("refreshInterval is not a setup field of schema 1 (did you mean refreshIntervalSeconds?)", p.message());
        assertEquals("Basemaps is not a setup field of schema 1 (did you mean basemaps?)",
            only(read("\"Basemaps\":[\"osm\"]")).message());
        assertEquals("conection is not a setup field of schema 1 (did you mean connection?)",
            only(read("\"conection\":\"x\"")).message());
        SetupProblem far = only(read("\"mapboxToken\":\"pk.SECRETVALUE\""));
        assertEquals("mapboxToken is not a setup field of schema 1", far.message());
        assertNull(Setup.closest("zzz", Setup.FIELDS));
    }
}
