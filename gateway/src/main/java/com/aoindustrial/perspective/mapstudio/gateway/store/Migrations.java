package com.aoindustrial.perspective.mapstudio.gateway.store;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * The map store's versioned SQL migrations, shipped in the module and applied in
 * order (owner decision, 2026-10-26: no Flyway or Liquibase). One file per
 * version under {@code store/migrations/}, named {@code NNNN_name.sql}; add the
 * next file to {@link #FILES}. Released files never change.
 */
public final class Migrations {

    private Migrations() {
    }

    /** In version order: index 0 is version 1. */
    static final List<String> FILES = List.of("0001_first_schema.sql");

    /** One migration: its version, file name and statements. */
    public record Migration(int version, String name, List<String> statements) {
    }

    /** Every migration of this module, in version order. */
    public static List<Migration> all() {
        List<Migration> out = new ArrayList<>();
        for (int i = 0; i < FILES.size(); i++) {
            String file = FILES.get(i);
            int version = Integer.parseInt(file.substring(0, 4));
            if (version != i + 1) {
                throw new IllegalStateException("Migration " + file + " is out of order; expected version " + (i + 1));
            }
            out.add(new Migration(version, file, statements(read(file))));
        }
        return List.copyOf(out);
    }

    /** The newest schema version this module knows. */
    public static int latest() {
        return FILES.size();
    }

    static String read(String file) {
        try (InputStream in = Migrations.class.getResourceAsStream("migrations/" + file)) {
            if (in == null) {
                throw new IllegalStateException("Migration resource missing: " + file);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    /**
     * Split a migration into statements: {@code --} comment lines dropped, statements
     * ended by a {@code ;} at the end of a line. Migrations hold no functions or
     * quoted semicolons, so this simple rule is enough (and is tested).
     */
    static List<String> statements(String sql) {
        List<String> out = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (String line : sql.split("\n")) {
            String trimmed = line.strip();
            if (trimmed.isEmpty() || trimmed.startsWith("--")) {
                continue;
            }
            current.append(line).append('\n');
            if (trimmed.endsWith(";")) {
                String statement = current.toString().strip();
                out.add(statement.substring(0, statement.length() - 1).strip());
                current.setLength(0);
            }
        }
        if (!current.toString().isBlank()) {
            throw new IllegalStateException("Migration ends without a ';': " + current.toString().strip());
        }
        return List.copyOf(out);
    }
}
