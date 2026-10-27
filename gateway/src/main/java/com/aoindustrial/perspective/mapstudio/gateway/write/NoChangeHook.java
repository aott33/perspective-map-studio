package com.aoindustrial.perspective.mapstudio.gateway.write;

/** The change hook of this version: does nothing (entry 4 delivers {@code map.changed}). */
public final class NoChangeHook implements ChangeHook {

    @Override
    public void onCommitted(CommittedBatch batch) {
        // Nothing yet: entry 4 sends map.changed {seq, ops} to every open map of the project.
    }
}
