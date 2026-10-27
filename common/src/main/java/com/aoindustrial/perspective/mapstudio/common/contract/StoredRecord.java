package com.aoindustrial.perspective.mapstudio.common.contract;

import com.inductiveautomation.ignition.common.gson.JsonObject;

/**
 * A record the map store keeps versioned and tombstoned (epic 2 story 9): a map item
 * ({@link MapItemRecord}) or a kind setup ({@link KindSetupRecord}). A conflict lists it
 * as {@code current}, and {@code map.changed} sends it as an op's {@code record}.
 */
public interface StoredRecord {

    /** The record as the contract sends it. */
    JsonObject toJson();

    /** The stored version, 1 or more. */
    int version();

    /** True for a tombstone. */
    boolean deleted();

    /** What a message calls the record ("Pad P12", "The pad kind setup"); may be blank. */
    String name();
}
