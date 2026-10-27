package com.aoindustrial.perspective.mapstudio.gateway.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.setup.SetupRegistry;

/** Readable and writable, for the store states and the standby (epic 2 story 5). */
class StoreGateTest {

    SetupRegistry setups;
    StoreState state;
    Optional<String> standby;
    StoreGate gate;

    @BeforeEach
    void setUp() throws Exception {
        setups = new SetupRegistry(s -> { });
        setups.put("p", Setup.parse("{\"schemaVersion\":1,\"connection\":\"C\"}"));
        state = StoreState.ready();
        standby = Optional.empty();
        gate = new StoreGate(setups, c -> state, () -> standby);
    }

    @Test
    void readyIsReadableAndWritable() {
        assertNull(gate.requireReadable("p").readOnly());
        assertEquals("C", gate.requireWritable("p").connection());
        assertEquals("C", gate.requireReady("p").connection());
    }

    @Test
    void aNewerSchemaIsReadableButRefusesWrites() {
        state = StoreState.readOnly("newer");
        assertEquals("newer", gate.requireReadable("p").readOnly());
        MapStudioException ex = assertThrows(MapStudioException.class, () -> gate.requireWritable("p"));
        assertEquals(Messages.CODE_READ_ONLY, ex.code());
        assertEquals("newer", ex.plainMessage());
        assertEquals(Messages.CODE_READ_ONLY, assertThrows(MapStudioException.class, () -> gate.requireReady("p")).code());
    }

    @Test
    void aStandbyIsReadableButRefusesWrites() {
        standby = Optional.of("standby");
        assertEquals("standby", gate.requireReadable("p").readOnly());
        MapStudioException ex = assertThrows(MapStudioException.class, () -> gate.requireWritable("p"));
        assertEquals(Messages.CODE_READ_ONLY, ex.code());
        assertEquals("standby", ex.plainMessage());
    }

    @Test
    void anUnavailableStoreIsUnreachableForReadsAndWrites() {
        state = StoreState.unavailable("no rights");
        standby = Optional.of("standby");
        assertEquals(Messages.CODE_STORE_UNREACHABLE,
            assertThrows(MapStudioException.class, () -> gate.requireReadable("p")).code());
        assertEquals(Messages.CODE_STORE_UNREACHABLE,
            assertThrows(MapStudioException.class, () -> gate.requireWritable("p")).code());
    }
}
