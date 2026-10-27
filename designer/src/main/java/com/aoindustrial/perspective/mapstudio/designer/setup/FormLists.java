package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.aoindustrial.perspective.mapstudio.common.contract.SetupLists;

/**
 * Every list the form compares with (epic 2 story 16): the Gateway's ({@code null} while loading
 * or before the first load), the chosen secret provider's secret names, and the project's. A list
 * that is not OK gives no warnings: there is nothing to compare with.
 *
 * @param gateway the Gateway lists, or null when not loaded (a failed call is unavailable lists)
 * @param secretNamesProvider the provider {@code secretNames} belongs to, or null
 * @param secretNames that provider's secret names, or null when not loaded
 * @param project the project's lists
 */
public record FormLists(SetupLists gateway, String secretNamesProvider,
                        SetupLists.Part secretNames, ProjectLists.Snapshot project) {

    public FormLists {
        project = project == null ? ProjectLists.Snapshot.unknown() : project;
    }

    /** Nothing loaded yet: no warnings. */
    public static FormLists none() {
        return new FormLists(null, null, null, ProjectLists.Snapshot.unknown());
    }

    public FormLists withGateway(SetupLists lists) {
        return new FormLists(lists, secretNamesProvider, secretNames, project);
    }

    public FormLists withSecretNames(String provider, SetupLists.Part names) {
        return new FormLists(gateway, provider, names, project);
    }

    public FormLists withProject(ProjectLists.Snapshot snapshot) {
        return new FormLists(gateway, secretNamesProvider, secretNames, snapshot);
    }

    /** The connections list when it loaded, else null. */
    SetupLists.Part connections() {
        return gateway != null && gateway.connections().isOk() ? gateway.connections() : null;
    }

    /** The roles list when it loaded, else null (not listed or unavailable). */
    SetupLists.Part roles() {
        return gateway != null && gateway.roles().isOk() ? gateway.roles() : null;
    }

    SetupLists.Part secretProviders() {
        return gateway != null && gateway.secretProviders().isOk() ? gateway.secretProviders() : null;
    }

    /** The secret names of {@code provider} when they loaded, else null. */
    SetupLists.Part secretNamesOf(String provider) {
        return secretNames != null && secretNames.isOk() && provider != null && provider.equals(secretNamesProvider)
            ? secretNames : null;
    }

    private static final Map<String, String> VENDORS = Map.of("POSTGRES", "PostgreSQL", "MSSQL",
        "Microsoft SQL Server", "MYSQL", "MySQL", "ORACLE", "Oracle", "DB2", "DB2", "FIREBIRD", "Firebird",
        "SQLITE", "SQLite", "GENERIC", "generic JDBC");

    /** A connection type in words ({@code POSTGRES}: PostgreSQL); unknown types as given. */
    static String vendorWords(String vendor) {
        if (vendor == null || vendor.isBlank()) {
            return "";
        }
        return VENDORS.getOrDefault(vendor.toUpperCase(Locale.ROOT), vendor);
    }

    /** True when {@code name} is in {@code names}, compared exactly. */
    static boolean contains(List<String> names, String name) {
        return names.contains(name);
    }
}
