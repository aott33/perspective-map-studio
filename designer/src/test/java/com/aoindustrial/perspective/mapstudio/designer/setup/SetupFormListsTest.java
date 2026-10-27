package com.aoindustrial.perspective.mapstudio.designer.setup;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.aoindustrial.perspective.mapstudio.common.contract.SetupLists;
import com.aoindustrial.perspective.mapstudio.common.contract.SetupLists.Part;

/** Epic 2 story 16: the warnings from the lists, and tokenSecret as provider and name. */
class SetupFormListsTest {

    private static final String VALID = "{\"schemaVersion\": 1, \"connection\": \"MapStudio\","
        + " \"roles\": {\"full\": [\"MapEditor\"], \"phone\": [\"MapOperator\"]},"
        + " \"kindsFunction\": \"mapstudio_dev.kinds\", \"alarmPage\": \"/alarms/{item.name}\"}";

    private final FakeListSource source = new FakeListSource();

    private FormLists loaded() throws Exception {
        return FormLists.none().withProject(source.project())
            .withGateway(SetupLists.fromJson(source.gatewayLists("default")), true)
            .withSecretNames("Internal", Part.fromJson(source.secretNames("Internal")));
    }

    @Test
    void valuesFoundInTheirListsGiveNoWarning() throws Exception {
        SetupForm form = SetupForm.fromJson(VALID);
        assertEquals(Map.of(), form.warnings(loaded()));
    }

    // Matrix: typed, not in list - kept and saved as typed; warning beside it; never blocks.
    @Test
    void aTypedNameNotInItsListIsKeptWithAWarningAndStillSaves() throws Exception {
        SetupForm form = SetupForm.fromJson(VALID).setText(SetupForm.CONNECTION, "MapStore")
            .setList(SetupForm.FULL_ROLES, List.of("MapEditor", "MapEdtor"));
        Map<String, List<String>> w = form.warnings(loaded());
        assertEquals(List.of("MapStore is not a database connection of this Gateway yet. Map Studio waits for it;"
            + " add it on the Gateway under Connections > Databases."), w.get(SetupForm.CONNECTION));
        assertEquals(List.of("MapEdtor is not a role of the identity provider default. It is saved as typed;"
            + " nobody holds it until the provider has it."), w.get(SetupForm.FULL_ROLES));
        assertEquals(List.of("MapEdtor"), form.unknownRoles(SetupForm.FULL_ROLES, loaded()));
        assertTrue(form.canSave());
        assertTrue(form.toJson().contains("\"full\": [\"MapEditor\", \"MapEdtor\"]"));
        assertTrue(form.toJson().contains("\"connection\": \"MapStore\""));
    }

    // Matrix: non-PostgreSQL connection - warning naming the type; never blocks.
    @Test
    void aConnectionThatIsNotPostgreSqlIsNamed() throws Exception {
        SetupForm form = SetupForm.fromJson(VALID).setText(SetupForm.CONNECTION, "MES");
        assertEquals(List.of("MES is a Microsoft SQL Server connection; Map Studio stores maps in PostgreSQL."),
            form.warnings(loaded()).get(SetupForm.CONNECTION));
        assertTrue(form.canSave());
    }

    // Matrix: Gateway unreachable - no warnings from Gateway lists; functions and pages still checked.
    @Test
    void anUnreachableGatewayGivesNoGatewayWarnings() {
        FormLists lists = FormLists.none().withProject(source.project())
            .withGateway(SetupLists.unavailable(""), false);
        SetupForm form = SetupForm.fromJson(VALID).setText(SetupForm.CONNECTION, "MapStore")
            .setList(SetupForm.FULL_ROLES, List.of("MapEdtor")).setText(SetupForm.KINDS_FUNCTION, "mapstudio_dev.kind")
            .setText(SetupForm.TOKEN_SECRET, "Vault/x");
        Map<String, List<String>> w = form.warnings(lists);
        assertEquals(List.of(SetupForm.KINDS_FUNCTION), List.copyOf(w.keySet()));
        assertEquals("mapstudio_dev.kind is not a function in this project's library. It is saved as typed.",
            w.get(SetupForm.KINDS_FUNCTION).get(0));
    }

    // Matrix: IdP cannot list roles - no unknown-role warnings.
    @Test
    void anIdentityProviderThatDoesNotListRolesGivesNoRoleWarnings() throws Exception {
        source.gateway = new SetupLists(source.gateway.connections(), Part.notListed("x"),
            source.gateway.secretProviders());
        SetupForm form = SetupForm.fromJson(VALID).setList(SetupForm.FULL_ROLES, List.of("Anyone"));
        assertEquals(Map.of(), form.warnings(loaded()));
        assertEquals(List.of(), form.unknownRoles(SetupForm.FULL_ROLES, loaded()));
    }

    // Matrix: secret provider cannot list - names unavailable, provider kept, no name warning.
    @Test
    void aProviderThatCannotListGivesNoNameWarning() throws Exception {
        FormLists lists = loaded().withSecretNames("MapStudioFiles", Part.unavailable("cannot list"));
        SetupForm form = SetupForm.fromJson(VALID).setText(SetupForm.TOKEN_SECRET, "MapStudioFiles/anything");
        assertEquals(Map.of(), form.warnings(lists));
        assertTrue(form.toJson().contains("\"tokenSecret\": \"MapStudioFiles/anything\""));
    }

    // Matrix: tokenSecret - pick Internal + mapbox-token; a stored value is split at its first "/".
    @Test
    void theTokenIsProviderSlashName() throws Exception {
        assertEquals("Internal/mapbox-token", SetupForm.joinToken("Internal", "mapbox-token"));
        assertArrayEquals(new String[] {"Internal", "mapbox-token"}, SetupForm.splitToken("Internal/mapbox-token"));
        assertArrayEquals(new String[] {"Vault", "team/map/token"}, SetupForm.splitToken("Vault/team/map/token"));
        assertEquals("Vault/team/map/token", SetupForm.joinToken("Vault", "team/map/token"));
        assertArrayEquals(new String[] {"", ""}, SetupForm.splitToken(""));
        assertEquals("", SetupForm.joinToken("", ""));
        SetupForm form = SetupForm.fromJson(VALID).setText(SetupForm.TOKEN_SECRET, "Internal/mapbox-token");
        assertEquals(Map.of(), form.warnings(loaded()));
        SetupForm missing = SetupForm.fromJson(VALID).setText(SetupForm.TOKEN_SECRET, "Internal/mapbox");
        assertEquals(List.of("No secret named mapbox in Internal. It is saved as typed."),
            missing.warnings(loaded()).get(SetupForm.TOKEN_SECRET));
        SetupForm unknownProvider = SetupForm.fromJson(VALID).setText(SetupForm.TOKEN_SECRET, "Vault/x");
        assertEquals(List.of("Vault is not a secret provider of this Gateway. It is saved as typed."),
            unknownProvider.warnings(loaded()).get(SetupForm.TOKEN_SECRET));
    }

    // Owner decision 2026-10-27: a story 7 value with no "/" is the secret name, with a warning; never blocks.
    @Test
    void aStory7TokenWithNoSlashIsTheSecretNameWithAWarning() throws Exception {
        assertArrayEquals(new String[] {"", "mapbox-token"}, SetupForm.splitToken("mapbox-token"));
        SetupForm form = SetupForm.fromJson(VALID).setText(SetupForm.TOKEN_SECRET, "mapbox-token");
        assertEquals(List.of("Name the secret provider too."), form.warnings(loaded()).get(SetupForm.TOKEN_SECRET));
        assertEquals(List.of("Name the secret provider too."),
            form.warnings(FormLists.none()).get(SetupForm.TOKEN_SECRET));
        assertTrue(form.canSave());
    }

    @Test
    void aProviderWithNoSecretNameIsAWarningAndMapboxStillWantsAToken() throws Exception {
        assertEquals("Internal/", SetupForm.joinToken("Internal", ""));
        SetupForm form = SetupForm.fromJson(VALID).setText(SetupForm.TOKEN_SECRET, "Internal/")
            .setList(SetupForm.BASEMAPS, List.of("osm", "mapbox"));
        Map<String, List<String>> w = form.warnings(loaded());
        assertEquals(List.of("Name the secret too."), w.get(SetupForm.TOKEN_SECRET));
        assertEquals(List.of("Mapbox needs a map token. Name its secret below."), w.get(SetupForm.BASEMAPS));
        assertTrue(form.canSave());
    }

    @Test
    void aNameWithASlashAndNoProviderReadsBackAsThatName() throws Exception {
        assertEquals("/team/map", SetupForm.joinToken("", "team/map"));
        assertArrayEquals(new String[] {"", "team/map"}, SetupForm.splitToken(SetupForm.joinToken("", "team/map")));
        SetupForm form = SetupForm.fromJson(VALID).setText(SetupForm.TOKEN_SECRET, "/team/map");
        assertEquals(List.of("Name the secret provider too."), form.warnings(loaded()).get(SetupForm.TOKEN_SECRET));
        // A story 7 name holding a "/" is read as <provider>/<name> (docs/setup.md says so).
        assertArrayEquals(new String[] {"maps", "token"}, SetupForm.splitToken("maps/token"));
    }

    @Test
    void mapboxWithoutATokenIsAWarning() throws Exception {
        SetupForm form = SetupForm.fromJson(VALID).setList(SetupForm.BASEMAPS, List.of("osm", "mapbox"));
        assertEquals(List.of("Mapbox needs a map token. Name its secret below."),
            form.warnings(loaded()).get(SetupForm.BASEMAPS));
        assertTrue(form.canSave());
    }

    @Test
    void anAlarmPageIsComparedWithThePagesAndTheirParameters() throws Exception {
        SetupForm known = SetupForm.fromJson(VALID).setText(SetupForm.ALARM_PAGE, "/alarms/{item.name}?x=1");
        assertEquals(Map.of(), known.warnings(loaded()));
        SetupForm unknown = SetupForm.fromJson(VALID).setText(SetupForm.ALARM_PAGE, "/alarm");
        assertEquals(List.of("/alarm is not a page of this project. It is saved as typed."),
            unknown.warnings(loaded()).get(SetupForm.ALARM_PAGE));
    }

    @Test
    void aReadOnlySetupHasNoWarnings() throws Exception {
        assertEquals(Map.of(), SetupForm.fromJson("{\"schemaVersion\": 2}").warnings(loaded()));
    }

    @Test
    void nothingLoadedGivesNoListWarnings() {
        SetupForm form = SetupForm.fromJson(VALID).setText(SetupForm.CONNECTION, "Nope")
            .setText(SetupForm.ALARM_PAGE, "/nope");
        assertEquals(Map.of(), form.warnings(FormLists.none()));
    }
}
