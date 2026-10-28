package com.aoindustrial.perspective.mapstudio.gateway.live;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.io.IOException;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.QualifiedPath;

/** Epic 3 entry 8: an alarm's source matched to a map item's alarms path (the provider and the tag path, exactly). */
class IgnitionAlarmStatusTest {

    private static QualifiedPath source(String text) throws IOException {
        return QualifiedPath.parse(text);
    }

    @Test
    void anAlarmOnATagBelowThePathGivesTheTagBelowIt() throws IOException {
        assertEquals("Pressure",
            IgnitionAlarmStatus.sourceBelow(source("prov:default:/tag:Mesa/P12/Pressure:/alm:High pressure"), "default", "Mesa/P12"));
        assertEquals("Casing/Pressure",
            IgnitionAlarmStatus.sourceBelow(source("prov:default:/tag:Mesa/P12/Casing/Pressure:/alm:High"), "default", "Mesa/P12"));
    }

    @Test
    void anAlarmOnThePathItselfGivesAnEmptySource() throws IOException {
        assertEquals("", IgnitionAlarmStatus.sourceBelow(source("prov:default:/tag:Mesa/P12:/alm:Down"), "default", "Mesa/P12"));
    }

    @Test
    void anotherProviderAPrefixThatIsNotAFolderOrAnotherPadIsNotBelow() throws IOException {
        assertNull(IgnitionAlarmStatus.sourceBelow(source("prov:other:/tag:Mesa/P12/Pressure:/alm:High"), "default", "Mesa/P12"));
        assertNull(IgnitionAlarmStatus.sourceBelow(source("prov:default:/tag:Mesa/P120/Pressure:/alm:High"), "default", "Mesa/P12"));
        assertNull(IgnitionAlarmStatus.sourceBelow(source("prov:default:/tag:Mesa/P14/Pressure:/alm:High"), "default", "Mesa/P12"));
        assertNull(IgnitionAlarmStatus.sourceBelow(null, "default", "Mesa/P12"));
    }
}
