package com.aoindustrial.perspective.mapstudio.common.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

class AssetListTest {

    @Test
    void goodAssetsAreKept() {
        Parsed<Asset> p = Asset.parseList(KindListTest.rows("[{\"id\":\"P12\",\"name\":\"Pad 12\",\"kind\":\"pad\","
            + "\"basePath\":\"[default]Mesa/P12\",\"extra\":true}]"), Set.of("pad"));
        assertEquals(List.of(new Asset("P12", "Pad 12", "pad", "[default]Mesa/P12")), p.kept());
        assertEquals(0, p.left());
        assertEquals("[default]Mesa/P12", p.kept().get(0).toJson().get("basePath").getAsString());
    }

    @Test
    void everyBadRowIsLeftOutWithAReason() {
        Parsed<Asset> p = Asset.parseList(KindListTest.rows("["
            + "{\"id\":\"P1\",\"name\":\"P1\",\"kind\":\"pad\",\"basePath\":\"[default]Mesa/P1\"},"
            + "{\"id\":\"P2\",\"kind\":\"pad\",\"basePath\":\"[default]Mesa/P2\"},"              // missing name
            + "{\"id\":\"P3\",\"name\":\"P3\",\"kind\":\"tank\",\"basePath\":\"[default]Mesa/P3\"}," // unknown kind
            + "{\"id\":\"P4\",\"name\":\"P4\",\"kind\":\"pad\",\"basePath\":\"Mesa/P4\"},"         // no provider
            + "{\"id\":\"P5\",\"name\":\"P5\",\"kind\":\"pad\",\"basePath\":\"[]Mesa/P5\"},"       // empty provider
            + "{\"id\":\"P6\",\"name\":\"P6\",\"kind\":\"pad\",\"basePath\":\"[default]\"},"       // provider only
            + "{\"id\":\"P1\",\"name\":\"Again\",\"kind\":\"pad\",\"basePath\":\"[default]Mesa/P1\"}," // duplicate
            + "{\"id\":\"P8\",\"name\":\"P8\",\"kind\":\"pad\",\"basePath\":42},"                  // wrong type
            + "[1,2]"
            + "]"), Set.of("pad"));
        assertEquals(1, p.kept().size());
        assertEquals(8, p.left());
        List<String> r = p.reasons();
        assertEquals("row 2 (id P2): no name", r.get(0));
        assertEquals("row 3 (id P3): kind tank is not in the kind list", r.get(1));
        assertEquals("row 4 (id P4): basePath does not start with a [provider]", r.get(2));
        assertEquals("row 5 (id P5): basePath does not start with a [provider]", r.get(3));
        assertEquals("row 6 (id P6): basePath does not start with a [provider]", r.get(4));
        assertEquals("row 7 (id P1): the id appears twice", r.get(5));
        assertEquals("row 8 (id P8): basePath must be text", r.get(6));
        assertEquals("row 9 is not a dict", r.get(7));
        assertTrue(r.stream().noneMatch(s -> s.contains("Mesa")), "no tag path in a reason");
    }

    @Test
    void reasonsEchoIdsAndKindsAsOneShortLine() {
        String longKind = "k".repeat(5000);
        Parsed<Asset> p = Asset.parseList(KindListTest.rows("["
            + "{\"id\":\"P1\\nWARN fake line\",\"name\":\"P1\",\"kind\":\"pad\",\"basePath\":\"Mesa/P1\"},"
            + "{\"id\":\"P2\",\"name\":\"P2\",\"kind\":\"" + longKind + "\",\"basePath\":\"[default]Mesa/P2\"},"
            + "{\"id\":\"P3\",\"name\":\"P3\",\"kind\":\"t\\u001b[31m\\u2028x\",\"basePath\":\"[default]Mesa/P3\"}"
            + "]"), Set.of("pad"));
        List<String> r = p.reasons();
        assertEquals("row 1 (id P1?WARN fake line): basePath does not start with a [provider]", r.get(0));
        assertEquals("row 2 (id P2): kind " + "k".repeat(64) + "... is not in the kind list", r.get(1));
        assertEquals("row 3 (id P3): kind t?[31m?x is not in the kind list", r.get(2));
    }

    @Test
    void withNoKindListEveryAssetIsLeftOut() {
        Parsed<Asset> p = Asset.parseList(KindListTest.rows(
            "[{\"id\":\"P1\",\"name\":\"P1\",\"kind\":\"pad\",\"basePath\":\"[default]Mesa/P1\"}]"), Set.of());
        assertEquals(0, p.kept().size());
        assertEquals("row 1 (id P1): kind pad is not in the kind list", p.reasons().get(0));
    }
}
