package com.aoindustrial.perspective.mapstudio.common.contract;

/**
 * One thing wrong with a project's setup: the field it is about (a dotted path
 * such as {@code roles.full}, or {@code setup.json} for the file as a whole) and
 * what is wrong, in plain words that already name the field
 * ({@code refreshIntervalSeconds must be a whole number from 1 to 3600, not "ten"}).
 */
public record SetupProblem(String field, String message) {

    /** The file as a whole (not JSON, not an object, missing from the resource). */
    public static final String FILE = "setup.json";
}
