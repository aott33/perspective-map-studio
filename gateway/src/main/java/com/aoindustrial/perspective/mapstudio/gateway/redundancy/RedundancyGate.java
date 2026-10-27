package com.aoindustrial.perspective.mapstudio.gateway.redundancy;

import java.util.Optional;

import com.inductiveautomation.ignition.common.util.LoggerEx;
import com.inductiveautomation.ignition.gateway.redundancy.RedundancyManager;

/**
 * Whether this Gateway may write the map store (AD-21, epic 2 story 5): an
 * independent Gateway always may; of a redundant pair only the active node may,
 * and a standby refuses saves {@code read-only} and does not migrate (owner
 * decision, 2026-10-26).
 *
 * <p>Redundancy SDK use, [SDK 8.3.0 javap], **unverified** live (only the
 * independent case is seen, docs/platform-checks.md): {@code
 * GatewayContext.getRedundancyManager()}, {@code RedundancyManager.isRedundancyEnabled()},
 * {@code isActive()}, {@code addRedundancyStateListener} and {@code
 * removeRedundancyStateListener} with a {@code RedundancyStateAdapter}. The state is
 * read on every call, so a missed listener event cannot leave a stale answer;
 * the listener only logs the change and starts the migrator on becoming active.
 */
public final class RedundancyGate {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.store");

    /** The standby's read-only reason a person sees. */
    public static final String STANDBY_REASON = "This Gateway is the standby of a redundant pair; saving is off here. "
        + "Open the map on the active Gateway to save.";

    /** What the gate reads of the Gateway's redundancy. */
    public interface ActiveNode {
        boolean redundancyEnabled();

        boolean active();
    }

    /** An independent Gateway (no redundancy manager): always writable. */
    public static final ActiveNode INDEPENDENT = new ActiveNode() {
        public boolean redundancyEnabled() {
            return false;
        }

        public boolean active() {
            return true;
        }
    };

    /** The gate's view of an SDK redundancy manager; a null manager is an independent Gateway. */
    public static ActiveNode of(RedundancyManager manager) {
        if (manager == null) {
            return INDEPENDENT;
        }
        return new ActiveNode() {
            public boolean redundancyEnabled() {
                return manager.isRedundancyEnabled();
            }

            public boolean active() {
                return manager.isActive();
            }
        };
    }

    private final ActiveNode node;
    private final Runnable onActive;
    private Boolean last;

    /** {@code onActive} runs when this node changes from standby to writable ({@code StoreRegistry::retryNow}). */
    public RedundancyGate(ActiveNode node, Runnable onActive) {
        this.node = node;
        this.onActive = onActive;
    }

    /** Whether this node may write and migrate: redundancy off, or this node active. */
    public boolean mayWrite() {
        try {
            return !node.redundancyEnabled() || node.active();
        } catch (RuntimeException ex) {
            // Unknown redundancy state: refuse writes rather than risk two writers.
            log.warn("Map Studio could not read this Gateway's redundancy state: " + ex.getClass().getSimpleName());
            return false;
        }
    }

    /** The read-only reason while this node is a standby, else empty. */
    public Optional<String> standbyReason() {
        return mayWrite() ? Optional.empty() : Optional.of(STANDBY_REASON);
    }

    /**
     * Called by the redundancy state listener (and once at start): logs one info
     * line when the answer changes and runs {@code onActive} on becoming writable.
     */
    public synchronized void stateChanged() {
        boolean now = mayWrite();
        if (last != null && last == now) {
            return;
        }
        Boolean before = last;
        last = now;
        if (now) {
            if (before != null) {
                log.info("This Gateway became the active node of its redundant pair: Map Studio saves and migrates here.");
                onActive.run();
            } else if (node.redundancyEnabled()) {
                log.info("This Gateway is the active node of its redundant pair: Map Studio saves and migrates here.");
            }
        } else {
            log.info("This Gateway is the standby of its redundant pair: Map Studio reads maps here and refuses saves"
                + " (read-only) until it becomes active.");
        }
    }
}
