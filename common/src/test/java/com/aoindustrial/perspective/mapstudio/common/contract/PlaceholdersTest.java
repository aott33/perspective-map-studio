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
    void numbersFillAsTheBrowserShowsThem() {
        // The same vectors as web/typescript/__tests__/placeholders.test.ts: JSON number text as String(n).
        Placeholders.ItemView numbers = new Placeholders.ItemView("4f6c", "P12", null, null,
            JsonParser.parseString("{\"n0\":12.0,\"n1\":4.50,\"n2\":1e3,\"n3\":1e21,\"n4\":1e-7,\"n5\":0.000001,"
                + "\"n6\":-0.5,\"n7\":0.1,\"n8\":123456789012345680000,\"n9\":1.5e300,\"n10\":0.30000000000000004,\"n11\":-0,\"n12\":1e999}").getAsJsonObject());
        assertEquals("12", Placeholders.fill("{item.properties.n0}", numbers));
        assertEquals("4.5", Placeholders.fill("{item.properties.n1}", numbers));
        assertEquals("1000", Placeholders.fill("{item.properties.n2}", numbers));
        assertEquals("1e+21", Placeholders.fill("{item.properties.n3}", numbers));
        assertEquals("1e-7", Placeholders.fill("{item.properties.n4}", numbers));
        assertEquals("0.000001", Placeholders.fill("{item.properties.n5}", numbers));
        assertEquals("-0.5", Placeholders.fill("{item.properties.n6}", numbers));
        assertEquals("0.1", Placeholders.fill("{item.properties.n7}", numbers));
        assertEquals("123456789012345680000", Placeholders.fill("{item.properties.n8}", numbers));
        assertEquals("1.5e+300", Placeholders.fill("{item.properties.n9}", numbers));
        assertEquals("0.30000000000000004", Placeholders.fill("{item.properties.n10}", numbers));
        assertEquals("0", Placeholders.fill("{item.properties.n11}", numbers));
        assertNull(Placeholders.fill("{item.properties.n12}", numbers));
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

    @Test
    void aStoredTagPathIsCheckedByTheRuleTheLookupsUse() {
        // Entry 13a: what tags.resolve refuses, a save refuses too, in words naming the path.
        assertEquals("{asset.path}/a//b has an empty part between two /; a tag path has a name between every two /.",
            refusedPath("{asset.path}/a//b", true));
        assertEquals("[default]a//b has an empty part between two /; a tag path has a name between every two /.",
            refusedPath("[default]a//b", true));
        assertEquals("[default]a//b has an empty part between two /; a tag path has a name between every two /.",
            refusedPath("[default]a//b", false));
        assertEquals("{asset.path}/a[0] has a [ or ] after its start; a tag path names its provider once, at its start.",
            refusedPath("{asset.path}/a[0]", true));
        assertTrue(refusedPath("[default]a/b]", true).contains("has a [ or ] after its start"));
        assertTrue(refusedPath("[default]a/[x]b", false).contains("has a [ or ] after its start"));
        assertTrue(refusedPath("{asset.path}/a/{item.name}", true).contains("has a { or } inside it"));
        assertTrue(refusedPath("[default]a/ /b", true).contains("has an empty part"));
        assertEquals("[~]Mesa/P12 does not name its provider; use a full path such as [default]Shared/GasPrice, not a"
            + " relative one.", refusedPath("[~]Mesa/P12", true));
        assertTrue(refusedPath("[.]X", false).contains("does not name its provider"));
        // An override below the asset is told the full-path rule, once, before any fault of its form.
        for (String below : new String[] {"{asset.path}/a//b", "{asset.path}/a[0]", "{asset.path}/a{b}", "{asset.path}/X"}) {
            assertEquals("an override's tag path is a full path such as [default]Mesa/P12/Pressure, not " + below + ".",
                refusedPath(below, false));
        }
        assertTrue(refusedPath("{asset.path}/", false).contains("is not a tag path; use a full path"));
        assertEquals("the tag path is longer than 1024 characters.",
            refusedPath("[default]" + "a".repeat(TagPaths.MAX_LENGTH), true));
        // The words kept from before the rule was shared.
        assertEquals("Mesa/P12 is not a tag path; use {asset.path}, {asset.path}/<path> or a full path such as"
            + " [default]Shared/GasPrice.", refusedPath("Mesa/P12", true));
        assertEquals("Mesa/P12 is not a tag path; use a full path such as [default]Shared/GasPrice.",
            refusedPath("Mesa/P12", false));
        assertEquals("a tag path is needed.", refusedPath(" ", true));
        // A trailing / is not a part, as for a lookup.
        for (String ok : new String[] {"{asset.path}/Meter/Flow/", "[default]Mesa/P12/", "[Site 2]Yard/Tank 1/Level"}) {
            assertDoesNotThrow(() -> Placeholders.checkTagPath(ok, true), ok);
        }
    }

    @Test
    void everyPathTheRuleRefusesIsRefusedAtSaveAndTheOtherWayRound() {
        // One rule: a full or asset-relative path passes checkTagPath exactly when TagPaths.resolve takes it.
        for (String path : new String[] {"{asset.path}", "{asset.path}/Comms", "{asset.path}/a//b", "{asset.path}/a[0]",
            "{asset.path}/", "{asset.path}X", "{asset.id}/X", "{asset.path}/{x}", "[default]a//b", "[default]a/b",
            "[default]", "[]Mesa", "[~]Mesa/P12", "[.]X", "Mesa/P12", "[default]Mesa/{asset.path}", "[default]a]b",
            "[default]/Mesa/P12", "[default]Mesa/P12/"}) {
            boolean lookup = true;
            try {
                TagPaths.resolve(path, "[default]Mesa/P12");
            } catch (MapStudioException ex) {
                lookup = false;
            }
            boolean save = true;
            try {
                Placeholders.checkTagPath(path, true);
            } catch (InvalidValue ex) {
                save = false;
            }
            assertEquals(lookup, save, path);
        }
    }

    @Test
    void aParamsSuffixIsATagPathByTheSameRule() {
        assertEquals("pressure: {asset.path}/a//b has an empty part between two /; a tag path has a name between every"
            + " two /.", refusedParam("pressure", "{asset.path}/a//b"));
        assertTrue(refusedParam("pressure", "{asset.path}/a[0]").contains("has a [ or ] after its start"));
        assertTrue(refusedParam("pressure", "{asset.path}/").contains("mixes text and placeholders"));
        // A literal is not a tag path: it is the view's own business.
        assertDoesNotThrow(() -> Placeholders.checkParam("p", "a//b", FIELDS));
        assertDoesNotThrow(() -> Placeholders.checkParam("p", "{asset.path}/Meter/Flow/", FIELDS));
    }

    private static String refusedPath(String value, boolean relative) {
        return assertThrows(InvalidValue.class, () -> Placeholders.checkTagPath(value, relative)).getMessage();
    }

    private static String refusedParam(String name, String value) {
        return assertThrows(InvalidValue.class, () -> Placeholders.checkParam(name, value, FIELDS)).getMessage();
    }
}
