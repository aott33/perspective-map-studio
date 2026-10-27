package com.aoindustrial.perspective.mapstudio.common.contract;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonParser;

/**
 * The closed placeholder list and the fill (epic 2 story 9). The same vectors are in
 * web/typescript/__tests__/placeholders.test.ts.
 */
class PlaceholdersTest {

    static final Set<String> FIELDS = Set.of("operator", "wells");
    static final Placeholders.ItemView P12 = new Placeholders.ItemView("4f6c", "P12", "P12", "[default]Mesa/P12",
        JsonParser.parseString("{\"operator\":\"Acme\",\"wells\":12,\"note\":null}").getAsJsonObject());
    static final Placeholders.ItemView NO_ASSET = new Placeholders.ItemView("9a1b", "Line 3", null, null,
        JsonParser.parseString("{}").getAsJsonObject());

    @Test
    void fillResolvesTheAssetPathAndEveryPlaceholder() {
        assertEquals("[default]Mesa/P12/Pressure", Placeholders.fill("{asset.path}/Pressure", P12));
        assertEquals("[default]Mesa/P12", Placeholders.fill("{asset.path}", P12));
        assertEquals("/pad/P12", Placeholders.fill("/pad/{item.name}", P12));
        assertEquals("4f6c P12 P12 Acme 12", Placeholders.fill("{item.id} {item.name} {asset.id} "
            + "{item.properties.operator} {item.properties.wells}", P12));
        assertEquals("Mesa", Placeholders.fill("Mesa", P12));
    }

    @Test
    void aPlaceholderWithNoValueGivesNull() {
        assertNull(Placeholders.fill("{asset.path}/Pressure", NO_ASSET));
        assertNull(Placeholders.fill("{asset.id}", NO_ASSET));
        assertNull(Placeholders.fill("{item.properties.note}", P12));
        assertNull(Placeholders.fill("{item.properties.missing}", P12));
        assertNull(Placeholders.fill("{item.foo}", P12));
        assertNull(Placeholders.fill("{item.name", P12));
        assertNull(Placeholders.fill(null, P12));
    }

    @Test
    void aParamIsALiteralOnePlaceholderOrTheAssetPathAndASuffix() {
        for (String ok : new String[] {"Mesa", "{item.name}", "{asset.path}", "{asset.path}/Pressure",
            "{item.properties.operator}", ""}) {
            assertDoesNotThrow(() -> Placeholders.checkParam("p", ok, FIELDS), ok);
        }
        assertTrue(refusedParam("pressure", "P-{item.name}").contains("mixes text and placeholders"));
        assertTrue(refusedParam("pressure", "{item.name}/Pressure").contains("mixes text and placeholders"));
        assertTrue(refusedParam("x", "{asset.path}/{item.name}").contains("mixes text and placeholders"));
        assertEquals("padName: {item.foo} is not a placeholder Map Studio knows; use {item.id}, {item.name},"
            + " {asset.id}, {asset.path} or {item.properties.<field key>}.", refusedParam("padName", "{item.foo}"));
        assertTrue(refusedParam("op", "{item.properties.status}").contains("not a form field"));
        assertTrue(refusedParam("mapItem", "{item.id}").startsWith("mapItem: the popup view always receives"));
        assertTrue(refusedParam("x", "{item.name").contains("a { has no }"));
    }

    @Test
    void aTemplateMixesTextWithAnyPlaceholders() {
        assertDoesNotThrow(() -> Placeholders.checkTemplate("/pad/{item.name}?op={item.properties.operator}", FIELDS));
        assertDoesNotThrow(() -> Placeholders.checkTemplate("/alarms/{item.properties.any}", null));
        InvalidValue ex = assertThrows(InvalidValue.class, () -> Placeholders.checkTemplate("/pad/{item.foo}", FIELDS));
        assertTrue(ex.getMessage().startsWith("{item.foo} is not a placeholder"));
        assertThrows(InvalidValue.class, () -> Placeholders.checkTemplate("/pad/}", FIELDS));
    }

    @Test
    void aTagPathIsAssetRelativeOrFullAndAnOverrideTakesFullOnly() {
        for (String ok : new String[] {"{asset.path}", "{asset.path}/Comms", "[default]Shared/GasPrice"}) {
            assertDoesNotThrow(() -> Placeholders.checkTagPath(ok, true), ok);
        }
        assertDoesNotThrow(() -> Placeholders.checkTagPath("[default]Mesa/P12/Pressure", false));
        InvalidValue ex = assertThrows(InvalidValue.class, () -> Placeholders.checkTagPath("{asset.path}/X", false));
        assertTrue(ex.getMessage().startsWith("an override's tag path is a full path"));
        for (String bad : new String[] {"Mesa/P12", "[]Mesa", "[default]", "{asset.path}/", "{item.name}/X",
            "[default]{item.name}", ""}) {
            assertThrows(InvalidValue.class, () -> Placeholders.checkTagPath(bad, true), bad);
        }
    }

    private static String refusedParam(String name, String value) {
        return assertThrows(InvalidValue.class, () -> Placeholders.checkParam(name, value, FIELDS)).getMessage();
    }
}
