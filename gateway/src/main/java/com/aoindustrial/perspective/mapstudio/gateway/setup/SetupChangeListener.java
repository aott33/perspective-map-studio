package com.aoindustrial.perspective.mapstudio.gateway.setup;

/**
 * Told after a project's setup state was replaced (read at start, created,
 * changed, deleted, or the project stopped). For later entries: the kind and asset
 * caches (entry 3) and pushing a change to open maps (entry 4). Called on the
 * thread that read the setup, after the swap; an exception is logged and does not
 * stop the other listeners or undo the change.
 */
@FunctionalInterface
public interface SetupChangeListener {

    void onSetupChanged(String project, SetupState before, SetupState after);
}
