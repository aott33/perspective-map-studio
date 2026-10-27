package com.aoindustrial.perspective.mapstudio.designer.setup;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.aoindustrial.perspective.mapstudio.common.contract.Setup;

/** The setup editor's form, one test (or more) per row of the plan's I/O matrix (the inherited row is the owner's Designer check). */
class SetupFormTest {

    /** Story 1's dev setup, as committed. */
    private static String devSetup() throws IOException {
        Path p = Path.of(System.getProperty("user.dir")).getParent()
            .resolve("ops/project/com.aoindustrial.perspective.mapstudio/setup/setup.json");
        return Files.readString(p, StandardCharsets.UTF_8);
    }

    // Row: project with no setup.

    @Test
    void defaultsAreTheSchemaDefaultsWithNoConnection() {
        SetupForm form = SetupForm.defaults();
        assertTrue(form.isEditable());
        assertEquals(List.of("MapEditor"), form.list(SetupForm.FULL_ROLES));
        assertEquals(List.of("MapOperator"), form.list(SetupForm.PHONE_ROLES));
        assertEquals("10", form.text(SetupForm.REFRESH));
        assertEquals(List.of("none", "osm"), form.list(SetupForm.BASEMAPS));
        for (String f : List.of(SetupForm.CONNECTION, SetupForm.KINDS_FUNCTION, SetupForm.ASSETS_FUNCTION,
            SetupForm.ALARM_PAGE, SetupForm.TOKEN_SECRET)) {
            assertEquals("", form.text(f), f);
        }
        assertEquals("1", form.schemaVersion());
    }

    @Test
    void defaultsAskForTheConnectionInPlainWords() {
        Map<String, List<String>> reasons = SetupForm.defaults().reasons();
        assertEquals(Map.of(SetupForm.CONNECTION,
            List.of("Name the database connection Map Studio stores the map in.")), reasons);
    }

    @Test
    void createWithConnectionMapStudioWritesTheFullExampleByteForByte() {
        // Acceptance 2: the defaults plus connection MapStudio are docs/setup.md's full example
        // (story 1's dev setup; story 3 gave the dev project its own functions and interval).
        SetupForm form = SetupForm.defaults().setText(SetupForm.CONNECTION, "MapStudio");
        assertTrue(form.canSave());
        assertEquals("{\n"
            + "  \"schemaVersion\": 1,\n"
            + "  \"connection\": \"MapStudio\",\n"
            + "  \"roles\": {\n"
            + "    \"full\": [\"MapEditor\"],\n"
            + "    \"phone\": [\"MapOperator\"]\n"
            + "  },\n"
            + "  \"kindsFunction\": \"\",\n"
            + "  \"assetsFunction\": \"\",\n"
            + "  \"refreshIntervalSeconds\": 10,\n"
            + "  \"alarmPage\": \"\",\n"
            + "  \"basemaps\": [\"none\", \"osm\"],\n"
            + "  \"tokenSecret\": \"\"\n"
            + "}\n", form.toJson());
    }

    // Row: edit and save.

    @Test
    void devSetupReadAndWrittenUnchangedIsByteExact() throws IOException {
        String dev = devSetup();
        SetupForm form = SetupForm.fromJson(dev);
        assertEquals(SetupForm.State.OK, form.state());
        assertTrue(form.reasons().isEmpty());
        assertEquals(dev, form.toJson());
        assertEquals(form, form.copy());
    }

    @Test
    void anEditChangesOnlyItsOwnLineAndTheGatewayReadsIt() throws IOException, Setup.SetupException {
        // Acceptance 1 and 3: remove MapEditor from full editing; only that line differs.
        String dev = devSetup();
        SetupForm form = SetupForm.fromJson(dev).copy();
        form.setList(SetupForm.FULL_ROLES, List.of());
        String out = form.toJson();
        List<String> before = List.of(dev.split("\n"));
        List<String> after = List.of(out.split("\n"));
        assertEquals(before.size(), after.size());
        int changed = 0;
        for (int i = 0; i < before.size(); i++) {
            if (!before.get(i).equals(after.get(i))) {
                changed++;
                assertEquals("    \"full\": [],", after.get(i));
            }
        }
        assertEquals(1, changed);
        Setup parsed = Setup.parse(out);
        assertEquals(List.of(), parsed.fullRoles());
        assertEquals("MapStudio", parsed.connection());
        assertNotEquals(SetupForm.fromJson(dev), form);
    }

    @Test
    void everyFieldRoundTripsThroughSetupParse() throws Setup.SetupException {
        SetupForm form = SetupForm.defaults()
            .setText(SetupForm.CONNECTION, " Plant DB ")
            .setText(SetupForm.KINDS_FUNCTION, "mapstudio_adapter.kinds")
            .setText(SetupForm.ASSETS_FUNCTION, "mapstudio_adapter.assets")
            .setText(SetupForm.REFRESH, "30")
            .setText(SetupForm.ALARM_PAGE, "/alarms")
            .setText(SetupForm.TOKEN_SECRET, "MapStudioFiles")
            .setList(SetupForm.FULL_ROLES, SetupForm.lines("MapEditor\n\n  Engineer \n"))
            .setList(SetupForm.BASEMAPS, SetupForm.lines("none\r\nosm\nsatellite"));
        assertTrue(form.reasons().isEmpty(), form.reasons().toString());
        Setup s = Setup.parse(form.toJson());
        assertEquals("Plant DB", s.connection());
        assertEquals(List.of("MapEditor", "Engineer"), s.fullRoles());
        assertEquals(List.of("MapOperator"), s.phoneRoles());
        assertEquals("mapstudio_adapter.kinds", s.kindsFunction());
        assertEquals("mapstudio_adapter.assets", s.assetsFunction());
        assertEquals(30, s.refreshIntervalSeconds());
        assertEquals("/alarms", s.alarmPage());
        assertEquals(List.of("none", "osm", "satellite"), s.basemaps());
        assertEquals("MapStudioFiles", s.tokenSecret());
        assertEquals(form.toJson(), SetupForm.fromJson(form.toJson()).toJson());
    }

    @Test
    void textIsEscapedAsJson() throws Setup.SetupException {
        SetupForm form = SetupForm.defaults().setText(SetupForm.CONNECTION, "a\"b<c>&d");
        assertTrue(form.toJson().contains("\"connection\": \"a\\\"b<c>&d\","));
        assertEquals("a\"b<c>&d", Setup.parse(form.toJson()).connection());
    }

    // Row: invalid field.

    @Test
    void invalidFieldsGiveAReasonBesideEachField() {
        SetupForm form = SetupForm.defaults()
            .setText(SetupForm.REFRESH, "0")
            .setText(SetupForm.KINDS_FUNCTION, "kinds");
        Map<String, List<String>> reasons = form.reasons();
        assertEquals(List.of(SetupForm.CONNECTION, SetupForm.KINDS_FUNCTION, SetupForm.REFRESH),
            List.copyOf(reasons.keySet()));
        assertEquals(List.of("Name the database connection Map Studio stores the map in."),
            reasons.get(SetupForm.CONNECTION));
        assertEquals(List.of("Name a project library function as package.function, for example mapstudio_adapter.kinds."),
            reasons.get(SetupForm.KINDS_FUNCTION));
        // The refresh rule is Setup's (the Gateway's), worded as the Gateway words it.
        assertEquals(List.of("refreshIntervalSeconds must be a whole number from 1 to 3600, not 0."),
            reasons.get(SetupForm.REFRESH));
        assertFalse(form.canSave());
    }

    @Test
    void aRefreshThatIsNotANumberIsAnInputCheck() {
        Map<String, List<String>> reasons = SetupForm.defaults().setText(SetupForm.CONNECTION, "MapStudio")
            .setText(SetupForm.REFRESH, "ten").reasons();
        assertEquals(Map.of(SetupForm.REFRESH,
            List.of("Refresh interval must be a whole number of seconds, for example 10.")), reasons);
    }

    @Test
    void aNameListedTwiceIsAReason() {
        Map<String, List<String>> reasons = SetupForm.defaults().setText(SetupForm.CONNECTION, "MapStudio")
            .setList(SetupForm.PHONE_ROLES, List.of("MapOperator", "MapOperator")).reasons();
        assertEquals(Map.of(SetupForm.PHONE_ROLES, List.of("MapOperator is listed twice.")), reasons);
    }

    @Test
    void aSetupProblemIsPlacedBesideTheFieldItNames() {
        assertEquals(SetupForm.REFRESH, SetupForm.fieldOf("refreshIntervalSeconds"));
        assertEquals(SetupForm.FULL_ROLES, SetupForm.fieldOf("roles.full"));
        assertEquals(SetupForm.PHONE_ROLES, SetupForm.fieldOf("roles.phone"));
        assertEquals(SetupForm.FULL_ROLES, SetupForm.fieldOf("roles"));
        assertEquals(SetupForm.GENERAL, SetupForm.fieldOf("setup.json"));
        assertEquals(SetupForm.GENERAL, SetupForm.fieldOf("schemaVersion"));
        assertEquals(SetupForm.GENERAL, SetupForm.fieldOf("refreshInterval"));
        assertEquals("basemaps lists osm twice.", SetupForm.display("basemaps lists osm twice"));
        assertEquals("Something.", SetupForm.display("Something."));
    }

    @Test
    void everyGatewayProblemOfAFieldIsShownBesideIt() {
        // Two bad entries are two reasons; an empty list is the Gateway's one reason, once.
        SetupForm form = SetupForm.defaults().setText(SetupForm.CONNECTION, "MapStudio")
            .setList(SetupForm.BASEMAPS, List.of("google", "bing"))
            .setText(SetupForm.ALARM_PAGE, "alarms");
        Map<String, List<String>> reasons = form.reasons();
        assertEquals(List.of(SetupForm.ALARM_PAGE, SetupForm.BASEMAPS), List.copyOf(reasons.keySet()));
        assertEquals(List.of("alarmPage must be empty or a page path starting with /, not \"alarms\"."),
            reasons.get(SetupForm.ALARM_PAGE));
        assertEquals(List.of("basemaps has \"google\"; each entry must be one of none, osm, satellite, mapbox.",
            "basemaps has \"bing\"; each entry must be one of none, osm, satellite, mapbox."),
            reasons.get(SetupForm.BASEMAPS));
        assertEquals(
            Map.of(SetupForm.BASEMAPS, List.of("basemaps must name at least one of none, osm, satellite, mapbox.")),
            form.setText(SetupForm.ALARM_PAGE, "").setList(SetupForm.BASEMAPS, List.of()).reasons());
    }

    // Row: unknown keys. The Gateway refuses a key it does not know (a misspelt field
    // is never silently ignored), so the form keeps them, writes them back unchanged
    // and reports each at the top of the form until the file is fixed.

    @Test
    void unknownKeysSurviveASaveAfterTheKnownKeysAndAreReported() {
        String in = "{\"note\": \"x\", \"schemaVersion\": 1, \"connection\": \"MapStudio\","
            + " \"roles\": {\"full\": [\"MapEditor\"], \"extra\": {\"a\": [1, {\"b\": null}]}},"
            + " \"later\": {\"deep\": []}}";
        SetupForm form = SetupForm.fromJson(in).copy().setText(SetupForm.ALARM_PAGE, "/alarms");
        assertTrue(form.isEditable());
        assertEquals(Map.of(SetupForm.GENERAL, List.of(
            "note is not a setup field of schema 1.",
            "later is not a setup field of schema 1.",
            "roles.extra is not a setup field of schema 1.")), form.reasons());
        String out = form.toJson();
        assertTrue(out.endsWith("  \"tokenSecret\": \"\",\n  \"note\": \"x\",\n  \"later\": {\n    \"deep\": []\n  }\n}\n"),
            out);
        assertTrue(out.contains("\"phone\": [],\n    \"extra\": {\n      \"a\": [\n        1,\n        {\n"
            + "          \"b\": null\n        }\n      ]\n    }\n  },"), out);
        assertEquals(out, SetupForm.fromJson(out).toJson());
    }

    // Row: newer schema.

    @Test
    void aNewerSchemaIsReadOnlyAndNeverRewritten() {
        String in = "{\"schemaVersion\": 2, \"connection\": 5, \"newThing\": true}";
        SetupForm form = SetupForm.fromJson(in);
        assertEquals(SetupForm.State.NEWER_SCHEMA, form.state());
        assertFalse(form.isEditable());
        assertEquals("This setup was written by a newer Map Studio (schema 2). This Designer edits schema 1.",
            form.stateReason());
        assertEquals("2", form.schemaVersion());
        assertEquals(in, form.toJson());
        assertFalse(form.canSave());
    }

    // Row: unreadable file.

    @Test
    void anUnreadableFileIsReadOnlyWithTheParseReason() {
        SetupForm form = SetupForm.fromJson("{\"schemaVersion\": 1,");
        assertEquals(SetupForm.State.UNREADABLE, form.state());
        assertTrue(
            form.stateReason().startsWith("This setup cannot be read: setup.json is not valid JSON (line 1, column "),
            form.stateReason());
        assertEquals("{\"schemaVersion\": 1,", form.toJson());
        assertFalse(form.canSave());
    }

    @Test
    void otherUnreadableShapesSayWhy() {
        // Each reason is the Gateway's own message (docs/setup.md).
        assertEquals("This setup cannot be read: setup.json must be a JSON object {\"schemaVersion\": 1, ...}.",
            SetupForm.fromJson("[1]").stateReason());
        assertEquals("This setup cannot be read: schemaVersion is missing; it must be 1.",
            SetupForm.fromJson("{\"connection\": \"MapStudio\"}").stateReason());
        assertEquals("This setup cannot be read: schemaVersion must be 1, not 0.",
            SetupForm.fromJson("{\"schemaVersion\": 0}").stateReason());
        assertEquals("This setup cannot be read: schemaVersion must be 1, not \"1\".",
            SetupForm.fromJson("{\"schemaVersion\": \"1\"}").stateReason());
        assertEquals("This setup cannot be read: roles.full must be a list of role names, not \"MapEditor\".",
            SetupForm.fromJson("{\"schemaVersion\": 1, \"roles\": {\"full\": \"MapEditor\"}}").stateReason());
        assertEquals("This setup cannot be read: tokenSecret must be the name of a secret as text"
                + " (its value is not shown).",
            SetupForm.fromJson("{\"schemaVersion\": 1, \"tokenSecret\": {\"v\": \"pk.SECRET\"}}").stateReason());
        assertEquals("This setup cannot be read: setup.json is missing from the setup resource.",
            SetupForm.missingFile().stateReason());
    }

    @Test
    void startingFromDefaultsAfterAnUnreadableFileIsEditable() {
        // The panel's "Start from defaults" (after the user confirms) shows SetupForm.defaults().
        SetupForm fresh = SetupForm.defaults().setText(SetupForm.CONNECTION, "MapStudio");
        assertTrue(fresh.canSave());
        assertNotEquals(SetupForm.fromJson("not json"), fresh);
    }

    // Review (quick lens): the form never calls valid a file the Gateway refuses.

    @Test
    void aQuotedRefreshIsUnreadableAsTheGatewayRefusesIt() {
        String in = "{\"schemaVersion\": 1, \"connection\": \"MapStudio\", \"refreshIntervalSeconds\": \"10\"}";
        assertThrowsSetup(in);
        SetupForm form = SetupForm.fromJson(in);
        assertEquals(SetupForm.State.UNREADABLE, form.state());
        assertEquals("This setup cannot be read: refreshIntervalSeconds must be a whole number from 1 to 3600,"
            + " not \"10\".", form.stateReason());
        assertFalse(form.canSave());
        assertEquals(in, form.toJson());
    }

    @Test
    void aWholeRefreshWrittenAsADecimalIsTheGatewaysWholeNumber() throws Setup.SetupException {
        String in = "{\"schemaVersion\": 1, \"connection\": \"MapStudio\", \"refreshIntervalSeconds\": 15.0}";
        assertEquals(15, Setup.parse(in).refreshIntervalSeconds());
        SetupForm form = SetupForm.fromJson(in);
        assertEquals("15", form.text(SetupForm.REFRESH));
        assertTrue(form.canSave(), form.reasons().toString());
        assertTrue(form.toJson().contains("\"refreshIntervalSeconds\": 15,"));
    }

    @Test
    void aFractionalRefreshIsShownAsWrittenAndAskedToBeWhole() {
        // The Gateway refuses 10.5; the form shows it as written and asks for a whole number.
        SetupForm form = SetupForm.fromJson(
            "{\"schemaVersion\": 1, \"connection\": \"MapStudio\", \"refreshIntervalSeconds\": 10.5}");
        assertTrue(form.isEditable());
        assertEquals("10.5", form.text(SetupForm.REFRESH));
        assertEquals(List.of(SetupForm.REFRESH), List.copyOf(form.reasons().keySet()));
    }

    @Test
    void nullBasemapsAreTheDefaultBasemapsAsTheGatewayReadsThem() throws Setup.SetupException {
        // A field set to JSON null takes its default (docs/setup.md).
        String in = "{\"schemaVersion\": 1, \"connection\": \"MapStudio\", \"basemaps\": null}";
        assertEquals(Setup.DEFAULT_BASEMAPS, Setup.parse(in).basemaps());
        SetupForm form = SetupForm.fromJson(in);
        assertEquals(Setup.DEFAULT_BASEMAPS, form.list(SetupForm.BASEMAPS));
        assertEquals(Setup.DEFAULT_BASEMAPS, Setup.parse(form.toJson()).basemaps());
        String absent = "{\"schemaVersion\": 1, \"connection\": \"MapStudio\"}";
        assertEquals(Setup.DEFAULT_BASEMAPS, SetupForm.fromJson(absent).list(SetupForm.BASEMAPS));
    }

    @Test
    void aKeySetTwiceIsUnreadableAsTheFormWouldKeepOnlyOne() {
        String in = "{\"schemaVersion\": 1, \"connection\": \"MapStudio\", \"connection\": \"Other\"}";
        SetupForm form = SetupForm.fromJson(in);
        assertEquals(SetupForm.State.UNREADABLE, form.state());
        assertEquals("This setup cannot be read: connection is set twice.", form.stateReason());
        assertEquals(in, form.toJson());
    }

    @Test
    void everyEditableFormReadsAsTheGatewayReadsTheFile() throws Setup.SetupException {
        for (String in : List.of(
            "{\"schemaVersion\": 1, \"connection\": \"MapStudio\", \"roles\": null, \"basemaps\": null}",
            "{\"schemaVersion\": 1, \"connection\": \"MapStudio\", \"roles\": {\"full\": null}}",
            "{\"schemaVersion\": 1, \"connection\": \"MapStudio\", \"refreshIntervalSeconds\": null}",
            "{\"schemaVersion\": 1.0, \"connection\": \"MapStudio\", \"refreshIntervalSeconds\": 3}")) {
            SetupForm form = SetupForm.fromJson(in);
            assertTrue(form.canSave(), in);
            assertEquals(Setup.parse(in), Setup.parse(form.toJson()), in);
        }
    }

    private static void assertThrowsSetup(String json) {
        try {
            Setup.parse(json);
        } catch (Setup.SetupException expected) {
            return;
        }
        throw new AssertionError("the Gateway reads " + json);
    }

    // Row: invalid field, the hold-back the save logs (never a dialog, owner 2026-10-27; fix 16).

    @Test
    void aHoldBackNamesEveryFieldForTheLog() {
        Map<String, List<String>> reasons = SetupForm.defaults()
            .setText(SetupForm.REFRESH, "0").setText(SetupForm.KINDS_FUNCTION, "kinds").reasons();
        SetupCommit.Decision d = new SetupCommit.Decision(null, reasons);
        assertTrue(d.isHeldBack());
        String log = d.summary();
        assertTrue(log.startsWith("connection: Name the database connection"), log);
        assertTrue(log.contains("; kindsFunction: ") && log.contains("; refreshIntervalSeconds: "), log);
        assertEquals("Map Studio setup of project mapstudio-dev held back from this save; the rest of the project"
            + " is saved. Reasons: " + log, SetupForm.msg("setup.heldBack.log", "mapstudio-dev", log));
    }

    @Test
    void aHoldBackNamingNoFieldSaysSetup() {
        Map<String, List<String>> reasons = Map.of(SetupForm.GENERAL, List.of("Something."));
        assertEquals("setup: Something.", new SetupCommit.Decision(null, reasons).summary());
        assertFalse(new SetupCommit.Decision(SetupForm.defaults(), Map.of()).isHeldBack());
    }
}
