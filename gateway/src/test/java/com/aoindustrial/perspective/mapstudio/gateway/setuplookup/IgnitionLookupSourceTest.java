package com.aoindustrial.perspective.mapstudio.gateway.setuplookup;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.gateway.config.DecodedResource;
import com.inductiveautomation.ignition.gateway.datasource.DatasourceManager;
import com.inductiveautomation.ignition.gateway.secrets.ManagedSecretProvider;
import com.inductiveautomation.ignition.gateway.secrets.SecretProviderManager;
import com.inductiveautomation.ignition.gateway.user.UserSourceManager;

/**
 * The secret guard (epic 2 story 16): the lookups list names and never read a secret's value.
 * The Ignition source is driven with proxies whose {@code read} fails the test, and the
 * package's source is checked for any value-reading call.
 */
class IgnitionLookupSourceTest {

    private final List<String> calls = new ArrayList<>();

    @SuppressWarnings("unchecked")
    private <T> T proxy(Class<T> type, java.util.function.BiFunction<String, Object[], Object> answer) {
        return (T) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[] {type}, (p, m, args) -> {
            calls.add(type.getSimpleName() + "." + m.getName());
            if (m.getName().equals("read")) {
                throw new AssertionError("a secret value was read");
            }
            return answer.apply(m.getName(), args);
        });
    }

    private ManagedSecretProvider provider(String name, List<String> names) {
        DecodedResource<?> resource = proxy(DecodedResource.class, (m, a) -> m.equals("name") ? name : null);
        return proxy(ManagedSecretProvider.class, (m, a) -> {
            switch (m) {
                case "list": return names;
                case "getResource": return resource;
                default: return null;
            }
        });
    }

    private IgnitionLookupSource source() {
        ManagedSecretProvider internal = provider("Internal", List.of("mapbox-token"));
        SecretProviderManager secrets = proxy(SecretProviderManager.class, (m, a) -> {
            switch (m) {
                case "getProviders": return List.of(internal);
                case "getProvider": return "Internal".equals(a[0]) ? Optional.of(internal) : Optional.empty();
                default: return null;
            }
        });
        UserSourceManager users = proxy(UserSourceManager.class, (m, a) -> {
            if (m.equals("getProfile")) {
                throw new IllegalArgumentException("No user source named " + a[0]);
            }
            return null;
        });
        DatasourceManager datasources = proxy(DatasourceManager.class, (m, a) -> m.equals("getDatasources") ? List.of() : null);
        return new IgnitionLookupSource(datasources, users, secrets);
    }

    @Test
    void secretProvidersAndNamesAreListedWithoutReadingAValue() throws Exception {
        IgnitionLookupSource s = source();
        assertEquals(List.of("Internal"), s.secretProviders());
        assertEquals(Optional.of(List.of("mapbox-token")), s.secretNames("Internal"));
        assertEquals(Optional.empty(), s.secretNames("Vault"));
        assertTrue(calls.contains("ManagedSecretProvider.list"));
        assertFalse(calls.stream().anyMatch(c -> c.endsWith(".read")), calls.toString());
    }

    @Test
    void anIdentityProviderWithNoUserSourceOfItsNameIsNotListed() throws Exception {
        assertEquals(Optional.empty(), source().roles("okta"));
    }

    @Test
    void noCodeOfTheLookupsCanReadASecretValue() throws IOException {
        Path dir = Path.of("src/main/java/com/aoindustrial/perspective/mapstudio/gateway/setuplookup");
        assertTrue(Files.isDirectory(dir), dir.toAbsolutePath().toString());
        List<String> found = new ArrayList<>();
        try (Stream<Path> files = Files.list(dir)) {
            for (Path f : (Iterable<Path>) files::iterator) {
                String code = stripComments(Files.readString(f, StandardCharsets.UTF_8));
                for (String banned : List.of(".read(", "Plaintext", "getSecret", "readSecret", "decrypt")) {
                    if (code.contains(banned)) {
                        found.add(f.getFileName() + ": " + banned);
                    }
                }
            }
        }
        assertEquals(List.of(), found);
    }

    private static String stripComments(String code) {
        return code.replaceAll("(?s)/\\*.*?\\*/", "").replaceAll("//[^\\n]*", "");
    }
}
