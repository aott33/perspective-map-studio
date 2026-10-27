package com.aoindustrial.perspective.mapstudio.gateway.setuplookup;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import com.inductiveautomation.ignition.common.role.Role;
import com.inductiveautomation.ignition.gateway.datasource.Datasource;
import com.inductiveautomation.ignition.gateway.datasource.DatasourceManager;
import com.inductiveautomation.ignition.gateway.secrets.ManagedSecretProvider;
import com.inductiveautomation.ignition.gateway.secrets.SecretProviderManager;
import com.inductiveautomation.ignition.gateway.user.UserSourceManager;
import com.inductiveautomation.ignition.gateway.user.UserSourceProfile;

import com.aoindustrial.perspective.mapstudio.common.contract.SetupLists;

/**
 * {@link LookupSource} over the Gateway's managers (epic 2 story 16, docs/platform-checks.md):
 * {@code DatasourceManager.getDatasources()} (name and vendor), the user source of the identity
 * provider's name ({@code UserSourceManager.getProfile(name).getRoles()}; live 8.3.10 the dev
 * Gateway's internal identity provider {@code default} names the user source {@code default}, and
 * {@code getProfile} throws {@code IllegalArgumentException} for a name it does not have, compared
 * with case; an identity provider with no user source of its name, such as an OIDC or SAML one,
 * is not listed [unverified: an internal provider whose user source has another name]), and
 * {@code SecretProviderManager.getProviders()} with {@code SecretProvider.list()} for names.
 *
 * <p>Never calls {@code SecretProvider.read}: this class handles names only, and the guard test
 * ({@code IgnitionLookupSourceTest}) fails if it reads a value or references the value type.
 */
public final class IgnitionLookupSource implements LookupSource {

    private final DatasourceManager datasources;
    private final UserSourceManager userSources;
    private final SecretProviderManager secrets;

    public IgnitionLookupSource(DatasourceManager datasources, UserSourceManager userSources,
            SecretProviderManager secrets) {
        this.datasources = datasources;
        this.userSources = userSources;
        this.secrets = secrets;
    }

    @Override
    public List<SetupLists.Entry> connections() {
        List<SetupLists.Entry> out = new ArrayList<>();
        for (Datasource d : datasources.getDatasources()) {
            out.add(new SetupLists.Entry(d.getName(), d.getVendor() == null ? "" : d.getVendor().name()));
        }
        return out;
    }

    @Override
    public Optional<List<String>> roles(String identityProvider) throws Exception {
        UserSourceProfile profile;
        try {
            profile = userSources.getProfile(identityProvider);
        } catch (IllegalArgumentException ex) {
            // No user source of that name (live 8.3.10: getProfile throws, names compared with case).
            return Optional.empty();
        }
        if (profile == null) {
            return Optional.empty();
        }
        Collection<Role> roles = profile.getRoles();
        List<String> out = new ArrayList<>();
        if (roles != null) {
            for (Role r : roles) {
                out.add(r.getName());
            }
        }
        return Optional.of(out);
    }

    @Override
    public List<String> secretProviders() {
        List<String> out = new ArrayList<>();
        for (ManagedSecretProvider p : secrets.getProviders()) {
            out.add(p.getResource().name());
        }
        return out;
    }

    @Override
    public Optional<List<String>> secretNames(String provider) throws Exception {
        Optional<? extends ManagedSecretProvider> p = secrets.getProvider(provider);
        if (p.isEmpty()) {
            return Optional.empty();
        }
        List<String> names = p.get().list();
        return Optional.of(names == null ? List.of() : List.copyOf(names));
    }
}
