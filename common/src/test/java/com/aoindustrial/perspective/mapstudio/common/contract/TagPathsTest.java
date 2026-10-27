package com.aoindustrial.perspective.mapstudio.common.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.aoindustrial.perspective.mapstudio.common.Messages;

class TagPathsTest {

    static final String P12 = "[default]Mesa/P12";

    static void assertInvalid(Runnable r) {
        MapStudioException ex = assertThrows(MapStudioException.class, r::run);
        assertEquals(Messages.CODE_INVALID, ex.code());
    }

    @Test
    void aPickInsideTheBasePathBecomesRelative() {
        TagPaths.Resolved r = TagPaths.resolve("[default]Mesa/P12/Pressure", P12);
        assertEquals("{asset.path}/Pressure", r.path());
        assertTrue(r.relative());
        assertEquals("Pressure", r.suffix());
    }

    @Test
    void aDeeperPickKeepsItsWholeSuffix() {
        TagPaths.Resolved r = TagPaths.resolve("[default]Mesa/P12/Meter/Flow", P12);
        assertEquals("{asset.path}/Meter/Flow", r.path());
        assertEquals("Meter/Flow", r.suffix());
    }

    @Test
    void theBasePathItselfIsTheAssetPath() {
        TagPaths.Resolved r = TagPaths.resolve("[default]Mesa/P12", P12);
        assertEquals("{asset.path}", r.path());
        assertTrue(r.relative());
        assertEquals("", r.suffix());
        assertEquals("{asset.path}", TagPaths.resolve("[default]Mesa/P12/", P12).path());
    }

    @Test
    void anAlreadyRelativePathStaysAsItIs() {
        TagPaths.Resolved r = TagPaths.resolve("{asset.path}/Pressure", P12);
        assertEquals("{asset.path}/Pressure", r.path());
        assertTrue(r.relative());
        assertEquals("Pressure", r.suffix());
        assertEquals("", TagPaths.resolve("{asset.path}", P12).suffix());
        assertEquals("{asset.path}/Pressure", TagPaths.resolve("{asset.path}/Pressure/", P12).path());
    }

    @Test
    void aPickOutsideIsReturnedUnchanged() {
        TagPaths.Resolved r = TagPaths.resolve("[default]Plant/Header/Pressure", P12);
        assertEquals("[default]Plant/Header/Pressure", r.path());
        assertFalse(r.relative());
        assertNull(r.suffix());
        assertFalse(TagPaths.resolve("[System]Mesa/P12/Pressure", P12).relative());
        assertFalse(TagPaths.resolve("[default]Mesa", P12).relative());
    }

    @Test
    void aPrefixThatIsNotASegmentIsNotRelative() {
        assertFalse(TagPaths.resolve("[default]Mesa/P12/X", "[default]Mesa/P1").relative());
        assertTrue(TagPaths.resolve("[default]Mesa/P1/X", "[default]Mesa/P1").relative());
    }

    @Test
    void providerAndSegmentsCompareWithoutCaseAndTheSuffixKeepsThePicksCase() {
        TagPaths.Resolved r = TagPaths.resolve("[DEFAULT]mesa/p12/Pressure", P12);
        assertTrue(r.relative());
        assertEquals("{asset.path}/Pressure", r.path());
        assertTrue(TagPaths.resolve("[default]Mesa/P12/X", "[Default]MESA/p12").relative());
    }

    @Test
    void aPathWithoutAProviderOrWithARelativeOneIsInvalid() {
        assertInvalid(() -> TagPaths.resolve("Mesa/P12/X", P12));
        assertInvalid(() -> TagPaths.resolve("[~]Mesa/P12/X", P12));
        assertInvalid(() -> TagPaths.resolve("[.]X", P12));
        assertInvalid(() -> TagPaths.resolve("[]Mesa", P12));
        assertInvalid(() -> TagPaths.resolve("[default]", P12));
        assertInvalid(() -> TagPaths.resolve("", P12));
        assertInvalid(() -> TagPaths.resolve(null, P12));
        assertInvalid(() -> TagPaths.resolve("[default]Mesa//X", P12));
    }

    @Test
    void anotherPlaceholderOrABraceIsInvalid() {
        assertInvalid(() -> TagPaths.resolve("{asset.id}/X", P12));
        assertInvalid(() -> TagPaths.resolve("{asset.path}X", P12));
        assertInvalid(() -> TagPaths.resolve("{asset.path}/", P12));
        assertInvalid(() -> TagPaths.resolve("{asset.path}/{x}", P12));
        assertInvalid(() -> TagPaths.resolve("[default]Mesa/{asset.path}", P12));
    }

    @Test
    void aPathOverTheLengthLimitIsInvalid() {
        String longPath = "[default]" + "a".repeat(TagPaths.MAX_LENGTH);
        assertInvalid(() -> TagPaths.resolve(longPath, P12));
        assertInvalid(() -> TagPaths.resolve("{asset.path}/" + "a".repeat(TagPaths.MAX_LENGTH), P12));
        String atLimit = "[default]" + "a".repeat(TagPaths.MAX_LENGTH - 9);
        assertFalse(TagPaths.resolve(atLimit, P12).relative());
    }

    @Test
    void foldersAreTrimmedAndChecked() {
        assertEquals("", TagPaths.folder(null));
        assertEquals("", TagPaths.folder(""));
        assertEquals("", TagPaths.folder("/"));
        assertEquals("Mesa/P12", TagPaths.folder("/Mesa/P12/"));
        assertInvalid(() -> TagPaths.folder("[default]Mesa"));
        assertInvalid(() -> TagPaths.folder("Mesa]"));
        assertInvalid(() -> TagPaths.folder("Mesa//P12"));
        assertInvalid(() -> TagPaths.folder("a".repeat(TagPaths.MAX_LENGTH + 1)));
        assertEquals(TagPaths.MAX_LENGTH, TagPaths.folder("a".repeat(TagPaths.MAX_LENGTH)).length());
    }

    @Test
    void underJoinsOnASlash() {
        assertEquals("[default]Mesa/P12/Pressure", TagPaths.under(P12, "Pressure"));
        assertEquals("[default]Mesa/P12", TagPaths.under(P12, ""));
        assertEquals("[default]Mesa/P12/Pressure", TagPaths.under(P12 + "/", "Pressure"));
    }

    @Test
    void parseFullSplitsProviderAndPath() {
        TagPaths.Full f = TagPaths.parseFull("[default]Mesa/P12/");
        assertEquals("default", f.provider());
        assertEquals("Mesa/P12", f.path());
        assertEquals(java.util.List.of("Mesa", "P12"), f.segments());
    }
}
