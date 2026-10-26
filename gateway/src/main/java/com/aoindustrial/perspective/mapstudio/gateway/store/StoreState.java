package com.aoindustrial.perspective.mapstudio.gateway.store;

/** What the map store on one connection can do right now. */
public record StoreState(Status status, String reason) {

    public enum Status {
        /** The connection wait or the migration is running. */
        STARTING,
        /** Schema current; reads and writes go ahead. */
        READY,
        /** The Gateway has no database connection of that name. */
        NO_CONNECTION,
        /** The connection never became usable, a migration failed, or the schema is newer than the module. */
        UNAVAILABLE
    }

    public static StoreState starting(String connection) {
        return new StoreState(Status.STARTING, "The map store is starting: Map Studio is waiting for the database connection "
            + connection + " to be usable.");
    }

    public static StoreState ready() {
        return new StoreState(Status.READY, "");
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
}
