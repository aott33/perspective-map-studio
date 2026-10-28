package com.aoindustrial.perspective.mapstudio.gateway.basemap;

/**
 * Where the basemap token comes from (epic 3 entry 6, AD-12): a secret of the Gateway's secret
 * providers, named by the project setup's {@code tokenSecret} as {@code <provider>/<name>}. The
 * one place in the module that reads a secret's value; {@link IgnitionTokenSource} is the real one,
 * tests fake it. The value is returned to the caller only, never logged.
 */
public interface TokenSource {

    /** Why a secret could not be read. */
    enum Problem {
        /** No secret provider of that name on this Gateway. */
        NO_PROVIDER,
        /** The provider has no secret of that name. */
        NOT_FOUND,
        /** The provider failed to read it (the cause is logged by the caller, class name only). */
        FAILED
    }

    /** A secret that could not be read, with the problem and a cause for the log (never the value). */
    final class TokenException extends Exception {
        private final Problem problem;

        public TokenException(Problem problem, Throwable cause) {
            super(problem.name(), cause);
            this.problem = problem;
        }

        public Problem problem() {
            return problem;
        }
    }

    /** The secret's value as text, trimmed; never null. */
    String read(String provider, String name) throws TokenException;
}
