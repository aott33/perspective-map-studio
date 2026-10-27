package com.aoindustrial.perspective.mapstudio.gateway.setup;

import java.util.ArrayList;
import java.util.List;

/** A {@link SetupRegistry.Log} that keeps its lines, for tests that count warnings. */
public final class RecordingLog implements SetupRegistry.Log {

    public final List<String> infos = new ArrayList<>();
    public final List<String> warnings = new ArrayList<>();
    public final List<String> errors = new ArrayList<>();

    @Override
    public synchronized void info(String message) {
        infos.add(message);
    }

    @Override
    public synchronized void warn(String message) {
        warnings.add(message);
    }

    @Override
    public synchronized void error(String message, Throwable cause) {
        errors.add(message);
    }
}
