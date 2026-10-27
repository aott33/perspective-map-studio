package com.aoindustrial.perspective.mapstudio.gateway.redundancy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.aoindustrial.perspective.mapstudio.gateway.LogCapture;

import ch.qos.logback.classic.Level;

/** The redundancy gate over a fake node (the SDK manager is unverified live, epic 2 story 5). */
class RedundancyGateTest {

    static final class Node implements RedundancyGate.ActiveNode {
        boolean enabled;
        boolean active;
        boolean broken;

        public boolean redundancyEnabled() {
            if (broken) {
                throw new IllegalStateException("no state");
            }
            return enabled;
        }

        public boolean active() {
            return active;
        }
    }

    @Test
    void anIndependentGatewayWrites() {
        Node node = new Node();
        RedundancyGate gate = new RedundancyGate(node, () -> { });
        assertTrue(gate.mayWrite());
        assertEquals(Optional.empty(), gate.standbyReason());
        assertTrue(new RedundancyGate(RedundancyGate.of(null), () -> { }).mayWrite(), "no manager: independent");
    }

    @Test
    void aStandbyRefusesAndTheActiveNodeWrites() {
        Node node = new Node();
        node.enabled = true;
        RedundancyGate gate = new RedundancyGate(node, () -> { });
        assertFalse(gate.mayWrite());
        assertEquals(Optional.of(RedundancyGate.STANDBY_REASON), gate.standbyReason());
        node.active = true;
        assertTrue(gate.mayWrite(), "read on every call, not cached");
    }

    @Test
    void becomingActiveRunsTheMigratorOnce() {
        Node node = new Node();
        node.enabled = true;
        int[] runs = {0};
        RedundancyGate gate = new RedundancyGate(node, () -> runs[0]++);
        gate.stateChanged();
        assertEquals(0, runs[0], "starting as a standby runs nothing");
        node.active = true;
        gate.stateChanged();
        gate.stateChanged();
        assertEquals(1, runs[0], "once per change");
        node.active = false;
        gate.stateChanged();
        node.active = true;
        gate.stateChanged();
        assertEquals(2, runs[0]);
    }

    @Test
    void anUnreadableStateRefusesWrites() {
        Node node = new Node();
        node.broken = true;
        assertFalse(new RedundancyGate(node, () -> { }).mayWrite());
    }

    @Test
    void anUnreadableStateWarnsOncePerChange() {
        Node node = new Node();
        node.broken = true;
        RedundancyGate gate = new RedundancyGate(node, () -> { });
        try (LogCapture log = new LogCapture("MapStudio.store")) {
            for (int i = 0; i < 5; i++) {
                assertFalse(gate.mayWrite());
                gate.standbyReason();
            }
            assertEquals(1, log.exactly(Level.WARN).size(), "every save and load asks; one line");
            node.broken = false;
            assertTrue(gate.mayWrite());
            node.broken = true;
            assertFalse(gate.mayWrite());
            assertEquals(2, log.exactly(Level.WARN).size(), "logged again after a good read");
        }
    }
}
