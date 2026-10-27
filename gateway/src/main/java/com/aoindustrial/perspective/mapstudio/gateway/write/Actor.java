package com.aoindustrial.perspective.mapstudio.gateway.write;

/**
 * Who makes a change, as the edit record stores it: the Ignition user name of a
 * Perspective session ({@code session}), or the actor a script names
 * ({@code script}).
 */
public record Actor(String name, String source) {

    public static final String SESSION = "session";
    public static final String SCRIPT = "script";

    public static Actor session(String userName) {
        return new Actor(userName, SESSION);
    }

    public static Actor script(String actor) {
        return new Actor(actor, SCRIPT);
    }
}
