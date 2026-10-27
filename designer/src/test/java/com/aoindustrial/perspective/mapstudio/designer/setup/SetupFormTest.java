package com.aoindustrial.perspective.mapstudio.designer.setup;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
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
    void createWithConnectionMapStudioWritesStoryOnesDevSetupByteForByte() throws IOException {
        // Acceptance 2: the defaults plus connection MapStudio are the setup the dev Gateway reads in e2e.
        SetupForm form = SetupForm.defaults().setText(SetupForm.CONNECTION, "MapStudio");
        assertTrue(form.canSave());
        assertEquals(devSetup(), form.toJson());
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
        // The refresh rule is Setup's (the Gateway's), shown without the "setup.json " prefix.
        assertEquals(List.of("\"refreshIntervalSeconds\" must be a whole number of seconds, 1 or more."),
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
    void aSetupMessageIsMappedToTheFieldItNames() {
        assertEquals(SetupForm.REFRESH, SetupForm.fieldOf("setup.json \"refreshIntervalSeconds\" must be ..."));
        assertEquals(SetupForm.FULL_ROLES, SetupForm.fieldOf("setup.json \"roles.full\" must be a list of names."));
        assertEquals(SetupForm.FULL_ROLES, SetupForm.fieldOf("setup.json \"roles\" must be an object."));
        assertEquals(SetupForm.GENERAL, SetupForm.fieldOf("setup.json must be a JSON object."));
        assertEquals("Must be a JSON object.", SetupForm.display("setup.json must be a JSON object."));
    }

    // Row: unknown keys.

    @Test
    void unknownKeysSurviveASaveAfterTheKnownKeys() {
        String in = "{\"note\": \"x\", \"schemaVersion\": 1, \"connection\": \"MapStudio\","
            + " \"roles\": {\"full\": [\"MapEditor\"], \"extra\": {\"a\": [1, {\"b\": null}]}},"
            + " \"later\": {\"deep\": []}}";
        SetupForm form = SetupForm.fromJson(in).copy().setText(SetupForm.ALARM_PAGE, "/alarms");
        assertTrue(form.reasons().isEmpty(), form.reasons().toString());
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
        assertTrue(form.stateReason().startsWith("This setup cannot be read: setup.json is not valid JSON: "),
            form.stateReason());
        assertEquals("{\"schemaVersion\": 1,", form.toJson());
        assertFalse(form.canSave());
    }

    @Test
    void otherUnreadableShapesSayWhy() {
        assertEquals("This setup cannot be read: setup.json must be a JSON object.",
            SetupForm.fromJson("[1]").stateReason());
        assertEquals("This setup cannot be read: setup.json needs schemaVersion 1.",
            SetupForm.fromJson("{\"connection\": \"MapStudio\"}").stateReason());
        assertEquals("This setup cannot be read: setup.json has schemaVersion 0; this Designer edits schema 1.",
            SetupForm.fromJson("{\"schemaVersion\": 0}").stateReason());
        assertEquals("This setup cannot be read: setup.json \"roles.full\" is not what this Designer can show"
                + " (a list of names).",
            SetupForm.fromJson("{\"schemaVersion\": 1, \"roles\": {\"full\": \"MapEditor\"}}").stateReason());
        assertEquals("This setup cannot be read: the resource has no setup.json.",
            SetupForm.missingFile().stateReason());
    }

    @Test
    void startingFromDefaultsAfterAnUnreadableFileIsEditable() {
        // The panel's "Start from defaults" (after the user confirms) shows SetupForm.defaults().
        SetupForm fresh = SetupForm.defaults().setText(SetupForm.CONNECTION, "MapStudio");
        assertTrue(fresh.canSave());
        assertNotEquals(SetupForm.fromJson("not json"), fresh);
    }
}
