package com.aoindustrial.perspective.mapstudio.gateway.store;

/** What the map store on one connection can do right now. */
public record StoreState(Status status, String reason) {

    public enum Status {
        /** The connection wait or the migration is running. */
        STARTING,
        /** Schema current; reads and writes go ahead. */
        READY,
        /**
         * The schema is newer than the module (AD-21, epic 2 story 5): the map is read
         * as usual, every save is refused {@code read-only}, nothing is migrated.
         */
        READ_ONLY,
        /** The Gateway has no database connection of that name. */
        NO_CONNECTION,
        /** The connection never became usable or a migration failed. */
        UNAVAILABLE
    }

    public static StoreState starting(String connection) {
        return new StoreState(Status.STARTING, "The map store is starting: Map Studio is waiting for the database connection "
            + connection + " to be usable.");
    }

    public static StoreState ready() {
        return new StoreState(Status.READY, "");
    }

    public static StoreState readOnly(String reason) {
        return new StoreState(Status.READ_ONLY, reason);
    }

    public static StoreState noConnection(String connection) {
        return new StoreState(Status.NO_CONNECTION, "The Gateway has no database connection named " + connection + ".");
    }

    public static StoreState unavailable(String reason) {
        return new StoreState(Status.UNAVAILABLE, reason);
    }

    public boolean isReady() {
        return status == Status.READY;
    }

    /** Whether the map can be read: ready, or read only. */
    public boolean isReadable() {
        return status == Status.READY || status == Status.READ_ONLY;
    }
}
