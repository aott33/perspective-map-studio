package com.aoindustrial.perspective.mapstudio.gateway.setuplookup;

import java.util.List;
import java.util.Optional;

import com.aoindustrial.perspective.mapstudio.common.contract.SetupLists;

/**
 * The Gateway as the setup form's lookups need it (epic 2 story 16): names only. There is no
 * method that reads a secret's value, and none may be added (the guard test in
 * {@code IgnitionLookupSourceTest} fails on one). On the Gateway it is {@link IgnitionLookupSource};
 * tests use a fake. Any method may throw; {@link SetupLookups} turns that into an unavailable list.
 */
public interface LookupSource {

    /** The Gateway's database connections: name, and the vendor's enum name as the detail ({@code POSTGRES}). */
    List<SetupLists.Entry> connections() throws Exception;

    /**
     * The role names of the user source behind {@code identityProvider}, or empty when the
     * identity provider has no user source of its name to list (an OIDC or SAML provider).
     */
    Optional<List<String>> roles(String identityProvider) throws Exception;

    /** The secret provider names. */
    List<String> secretProviders() throws Exception;

    /**
     * The secret names of {@code provider}, or empty when the Gateway has no provider of that name.
     * Throws when the provider cannot list its secrets.
     */
    Optional<List<String>> secretNames(String provider) throws Exception;
}
