package com.aoindustrial.perspective.mapstudio.common.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonParser;

class KindListTest {

    static JsonArray rows(String json) {
        return JsonParser.parseString(json).getAsJsonArray();
    }

    @Test
    void aGoodKindListIsKeptWithDefaults() {
        Parsed<Kind> p = Kind.parseList(rows("[{\"id\":\"pad\",\"name\":\"Well pad\",\"geometry\":\"point\","
            + "\"icon\":\"well-pad\",\"labelRank\":10,\"extra\":1,\"fields\":[{\"key\":\"operator\",\"type\":\"text\"},"
            + "{\"key\":\"status\",\"label\":\"Status\",\"type\":\"choice\",\"required\":true,\"choices\":[\"a\",\"b\"]}]},"
            + "{\"id\":\"line\",\"name\":\"Line\",\"geometry\":\"line\"}]"));
        assertEquals(0, p.left());
        assertEquals(2, p.kept().size());
        Kind pad = p.kept().get(0);
        assertEquals(10, pad.labelRank());
        assertEquals("operator", pad.fields().get(0).label(), "label defaults to the key");
        assertEquals(List.of("a", "b"), pad.fields().get(1).choices());
        assertTrue(pad.fields().get(1).required());
        Kind line = p.kept().get(1);
        assertEquals("", line.icon());
        assertEquals(0, line.labelRank());
        assertEquals(List.of(), line.fields());
        assertEquals("point", pad.toJson().get("geometry").getAsString());
        assertEquals(2, pad.toJson().getAsJsonArray("fields").get(1).getAsJsonObject().getAsJsonArray("choices").size());
    }

    @Test
    void everyBadRowIsLeftOutWithAReasonAndTheGoodOnesKept() {
        Parsed<Kind> p = Kind.parseList(rows("["
            + "{\"id\":\"pad\",\"name\":\"Pad\",\"geometry\":\"point\"},"      // good
            + "\"pad\","                                                         // not a dict
            + "{\"name\":\"No id\",\"geometry\":\"point\"},"                     // missing id
            + "{\"id\":7,\"name\":\"Number id\",\"geometry\":\"point\"},"        // wrong type
            + "{\"id\":\"pad\",\"name\":\"Again\",\"geometry\":\"point\"},"      // duplicate id
            + "{\"id\":\"tank\",\"name\":\"Tank\",\"geometry\":\"polygon\"},"    // bad geometry
            + "{\"id\":\"n\",\"geometry\":\"point\"},"                           // no name
            + "{\"id\":\"r\",\"name\":\"R\",\"geometry\":\"point\",\"labelRank\":1.5}," // rank not whole
            + "{\"id\":\"f1\",\"name\":\"F\",\"geometry\":\"point\",\"fields\":[{\"key\":\"x\",\"type\":\"date\"}]},"
            + "{\"id\":\"f2\",\"name\":\"F\",\"geometry\":\"point\",\"fields\":[{\"key\":\"x\",\"type\":\"choice\"}]},"
            + "{\"id\":\"f3\",\"name\":\"F\",\"geometry\":\"point\",\"fields\":[{\"type\":\"text\"}]},"
            + "{\"id\":\"f4\",\"name\":\"F\",\"geometry\":\"point\",\"fields\":[{\"key\":\"x\",\"type\":\"text\"},"
            + "{\"key\":\"x\",\"type\":\"text\"}]},"
            + "{\"id\":\"f5\",\"name\":\"F\",\"geometry\":\"point\",\"fields\":{}},"
            + "{\"id\":\"" + "k".repeat(65) + "\",\"name\":\"Long\",\"geometry\":\"point\"}"
            + "]"));
        assertEquals(1, p.kept().size());
        assertEquals(14, p.total());
        assertEquals(13, p.left());
        List<String> r = p.reasons();
        assertEquals("row 2 is not a dict", r.get(0));
        assertEquals("row 3: no id", r.get(1));
        assertEquals("row 4: id must be text", r.get(2));
        assertEquals("row 5 (id pad): the id appears twice", r.get(3));
        assertEquals("row 6 (id tank): geometry must be point or line", r.get(4));
        assertEquals("row 7 (id n): no name", r.get(5));
        assertEquals("row 8 (id r): labelRank must be a whole number", r.get(6));
        assertEquals("row 9 (id f1): field x: type must be text, number, integer, boolean or choice", r.get(7));
        assertEquals("row 10 (id f2): field x: a choice field needs choices", r.get(8));
        assertEquals("row 11 (id f3): field 1: no key", r.get(9));
        assertEquals("row 12 (id f4): field x appears twice", r.get(10));
        assertEquals("row 13 (id f5): fields must be a list", r.get(11));
        assertTrue(r.get(12).endsWith("id is longer than 64 characters"), r.get(12));
        assertEquals("row 2 is not a dict; row 3: no id; row 4: id must be text", p.firstReasons(3));
    }

    @Test
    void reasonsCarryIdsButNoOtherRowContent() {
        Parsed<Kind> p = Kind.parseList(rows("[{\"id\":\"tank\",\"name\":\"Secret name\",\"geometry\":\"hexagon\"}]"));
        assertTrue(!p.reasons().get(0).contains("hexagon") && !p.reasons().get(0).contains("Secret"),
            p.reasons().get(0));
    }

    @Test
    void areaIsALineKindFlagSentOnlyWhenTrue() {
        Parsed<Kind> p = Kind.parseList(rows("[{\"id\":\"geofence\",\"name\":\"Geofence\",\"geometry\":\"line\","
            + "\"area\":true},{\"id\":\"pad\",\"name\":\"Pad\",\"geometry\":\"point\",\"area\":true},"
            + "{\"id\":\"line\",\"name\":\"Line\",\"geometry\":\"line\",\"area\":false}]"));
        assertEquals(2, p.kept().size());
        assertTrue(p.kept().get(0).area());
        assertEquals(true, p.kept().get(0).toJson().get("area").getAsBoolean());
        assertEquals(false, p.kept().get(1).area());
        assertEquals(false, p.kept().get(1).toJson().has("area"));
        assertEquals("row 2 (id pad): area applies to line kinds only", p.reasons().get(0));
    }

    @Test
    void instrumentMarksAPointKindAndALineKindWithItIsLeftOut() {
        Parsed<Kind> p = Kind.parseList(rows("[{\"id\":\"tap\",\"name\":\"Tap\",\"geometry\":\"point\",\"icon\":\"tap\","
            + "\"instrument\":true},"
            + "{\"id\":\"meter\",\"name\":\"Meter\",\"geometry\":\"point\",\"instrument\":false},"
            + "{\"id\":\"swd\",\"name\":\"SWD line\",\"geometry\":\"line\",\"instrument\":true},"
            + "{\"id\":\"valve\",\"name\":\"Valve\",\"geometry\":\"point\",\"instrument\":\"yes\"}]"));
        assertEquals(2, p.kept().size());
        Kind tap = p.kept().get(0);
        assertTrue(tap.instrument());
        assertTrue(tap.toJson().get("instrument").getAsBoolean());
        Kind meter = p.kept().get(1);
        assertEquals(false, meter.instrument());
        assertEquals(false, meter.toJson().has("instrument"), "written only when true");
        assertEquals(List.of("row 3 (id swd): instrument applies to point kinds only",
            "row 4 (id valve): instrument must be true or false"), p.reasons());
    }
}
