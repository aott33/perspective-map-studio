package com.aoindustrial.perspective.mapstudio.common.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.IconCatalogue;

/** The icon check of a kind list (story 2.10) against the shipped catalogue. */
class KindIconsTest {

    static List<Kind> kinds(String json) {
        Parsed<Kind> p = Kind.parseList(JsonParser.parseString(json).getAsJsonArray());
        assertEquals(0, p.left(), "an unknown icon never leaves a kind out");
        return p.kept();
    }

    static String kind(String id, String icon) {
        return "{\"id\":\"" + id + "\",\"name\":\"N\",\"geometry\":\"point\"" + (icon == null ? "" : ",\"icon\":\"" + icon + "\"") + "}";
    }

    @Test
    void knownAndMissingIconsAreNotReported() {
        KindIcons k = KindIcons.check(kinds("[" + kind("pad", "well-pad") + "," + kind("x", null) + ","
            + kind("y", "") + "]"), IconCatalogue.shipped());
        assertSame(KindIcons.NONE, k);
        assertTrue(k.isEmpty());
        assertEquals("", k.note());
    }

    @Test
    void anUnknownIconNamesTheKindAndTheIconInWords() {
        KindIcons k = KindIcons.check(kinds("[" + kind("pad", "wel-pad") + "," + kind("line", "pipeline") + "]"),
            IconCatalogue.shipped());
        assertFalse(k.isEmpty());
        assertEquals("Kind pad names icon wel-pad, which Map Studio does not have; it shows as a plain point.", k.note());
        assertEquals("1 kind names an icon Map Studio does not have and shows as a plain point.", k.viewerNote());
        assertEquals("Kind pad names an icon Map Studio does not have.", k.logNote());
        assertFalse(k.logNote().contains("wel-pad"), "the log line names kind ids only");
        assertEquals(List.of("pad=wel-pad"), k.unknown());
    }

    @Test
    void moreThanThreeAreCountedAndTheKeyFollowsTheSet() {
        KindIcons k = KindIcons.check(kinds("[" + kind("a", "q1") + "," + kind("b", "q2") + "," + kind("c", "q3") + ","
            + kind("d", "q4") + "," + kind("e", "q5") + "]"), IconCatalogue.shipped());
        assertTrue(k.note().endsWith(" 2 more kinds name unknown icons."), k.note());
        assertEquals(3, k.note().split("Kind ").length - 1);
        assertEquals("5 kinds name icons Map Studio does not have and show as a plain point.", k.viewerNote());
        assertEquals("Kinds a, b, c and 2 more name icons Map Studio does not have.", k.logNote());
        KindIcons same = KindIcons.check(kinds("[" + kind("a", "q1") + "," + kind("b", "q2") + "," + kind("c", "q3") + ","
            + kind("d", "q4") + "," + kind("e", "q5") + "]"), IconCatalogue.shipped());
        assertEquals(k.key(), same.key());
        KindIcons other = KindIcons.check(kinds("[" + kind("a", "q9") + "]"), IconCatalogue.shipped());
        assertFalse(k.key().equals(other.key()));
        KindIcons renamed = KindIcons.check(kinds("[" + kind("e", "x5") + "," + kind("d", "x4") + "," + kind("c", "x3")
            + "," + kind("b", "x2") + "," + kind("a", "x1") + "]"), IconCatalogue.shipped());
        assertEquals(k.key(), renamed.key(), "the key is the sorted kind ids, not the icon names or row order");
        assertEquals(List.of("a", "b", "c", "d", "e"), k.key());
    }

    @Test
    void anEchoedIconIsOneShortLine() {
        KindIcons k = KindIcons.check(kinds("[" + kind("pad", "bad\\nicon" + "z".repeat(80)) + "]"),
            IconCatalogue.shipped());
        assertFalse(k.note().contains("\n"));
        assertTrue(k.note().contains("bad?icon"), k.note());
        assertTrue(k.note().contains("..."), k.note());
    }
}
