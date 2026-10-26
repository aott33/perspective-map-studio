package com.aoindustrial.perspective.mapstudio.gateway.write;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;

class RoleMatrixTest {

    static Setup setup() throws Exception {
        return Setup.parse("{\"schemaVersion\":1,\"connection\":\"MapStudio\","
            + "\"roles\":{\"full\":[\"MapEditor\"],\"phone\":[\"MapOperator\"]}}");
    }

    @Test
    void levelsFollowTheSetupsRoleLists() throws Exception {
        Setup s = setup();
        assertEquals(Messages.LEVEL_FULL, RoleMatrix.level(s, List.of("MapEditor")));
        assertEquals(Messages.LEVEL_FULL, RoleMatrix.level(s, List.of("MapOperator", "MapEditor")));
        assertEquals(Messages.LEVEL_PHONE, RoleMatrix.level(s, List.of("MapOperator")));
        assertEquals(Messages.LEVEL_NONE, RoleMatrix.level(s, List.of("Administrator")));
        assertEquals(Messages.LEVEL_NONE, RoleMatrix.level(s, List.of()));
        assertEquals(Messages.LEVEL_NONE, RoleMatrix.level(null, List.of("MapEditor")));
    }

    @Test
    void roleNamesAreCaseSensitive() throws Exception {
        assertEquals(Messages.LEVEL_NONE, RoleMatrix.level(setup(), List.of("mapeditor")));
    }
}
