package com.aoindustrial.perspective.mapstudio.gateway.basemap;

import java.util.Optional;

import com.inductiveautomation.ignition.gateway.secrets.ManagedSecretProvider;
import com.inductiveautomation.ignition.gateway.secrets.Plaintext;
import com.inductiveautomation.ignition.gateway.secrets.SecretNotFoundException;
import com.inductiveautomation.ignition.gateway.secrets.SecretProviderManager;

/**
 * {@link TokenSource} over the Gateway's secret providers: {@code SecretProviderManager.getProvider(name)},
 * then {@code SecretProvider.read(secret)}, which answers a {@code Plaintext} (closed after the text is
 * taken, so the bytes are cleared) [SDK 8.3.0 javap; live 8.3.10 in docs/platform-checks.md, "Epic 3
 * entry 6"]. {@code SecretNotFoundException} is a missing secret; any other failure is {@code FAILED}.
 * Nothing here logs: the value must never reach a log line, and the caller logs the problem.
 */
public final class IgnitionTokenSource implements TokenSource {

    private final SecretProviderManager secrets;

    public IgnitionTokenSource(SecretProviderManager secrets) {
        this.secrets = secrets;
    }

    @Override
    public String read(String provider, String name) throws TokenException {
        Optional<? extends ManagedSecretProvider> p;
        try {
            p = secrets.getProvider(provider);
        } catch (RuntimeException ex) {
            throw new TokenException(Problem.FAILED, ex);
        }
        if (p.isEmpty()) {
            throw new TokenException(Problem.NO_PROVIDER, null);
        }
        try (Plaintext text = p.get().read(name)) {
            if (text == null) {
                throw new TokenException(Problem.NOT_FOUND, null);
            }
            String value = text.getAsString();
            return value == null ? "" : value.trim();
        } catch (SecretNotFoundException ex) {
            throw new TokenException(Problem.NOT_FOUND, ex);
        } catch (TokenException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new TokenException(Problem.FAILED, ex);
        }
    }
}
