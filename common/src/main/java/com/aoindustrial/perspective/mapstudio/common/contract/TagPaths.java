package com.aoindustrial.perspective.mapstudio.common.contract;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

import com.aoindustrial.perspective.mapstudio.common.Messages;

/**
 * Tag paths as the tag browser's lookups read them (entry 15, docs/contract.md): a full
 * path {@code [provider]a/b}, the asset's own path {@code {asset.path}}, or a path below
 * it {@code {asset.path}/<suffix>}. Pure; every refusal is {@code invalid} in plain words.
 *
 * <p>Ignition compares provider names and path segments without regard to letter case
 * (docs/platform-checks.md, epic 2 story 15, live 8.3.10), so a full path below an asset's
 * base path is recognised in any case, and the suffix keeps the case of the picked path.
 */
public final class TagPaths {

    private TagPaths() {
    }

    /** The longest folder or path a lookup accepts, in characters. */
    public static final int MAX_LENGTH = 1024;

    /** A full path split into its provider (without brackets) and the path after it. */
    public record Full(String provider, String path) {

        /** The path's segments ({@code a/b} gives {@code [a, b]}). */
        public List<String> segments() {
            return Arrays.asList(path.split("/", -1));
        }
    }

    /**
     * A resolved pick: {@code path} as stored ({@code {asset.path}...} when {@code relative},
     * else the input unchanged), and the suffix below the base path ({@code ""} for the base
     * path itself, null when not relative).
     */
    public record Resolved(String path, boolean relative, String suffix) {
    }

    /**
     * A browse folder: null or empty is the provider's root, leading and trailing {@code /} are
     * trimmed.
     *
     * @throws MapStudioException {@code invalid} when it holds {@code [} or {@code ]}, an empty
     *                            segment, or is longer than {@link #MAX_LENGTH}
     */
    public static String folder(String raw) {
        if (raw == null) {
            return "";
        }
        if (raw.length() > MAX_LENGTH) {
            throw invalid("The folder is longer than " + MAX_LENGTH + " characters.");
        }
        if (raw.indexOf('[') >= 0 || raw.indexOf(']') >= 0) {
            throw invalid("The folder must not name a provider; send the provider on its own.");
        }
        String trimmed = trimSlashes(raw);
        if (!trimmed.isEmpty() && !segmentsOk(trimmed)) {
            throw invalid("The folder " + Rows.echo(raw) + " has an empty part between two /.");
        }
        return trimmed;
    }

    /**
     * What is wrong with a tag path's form, one per refusal of the rule (entry 13a): the one rule every
     * lookup and every stored tag path (a kind setup's, an item override's, a popup param's suffix) is
     * checked by, here in {@link #fault}; each caller says it in its own words.
     */
    public enum Fault {
        /** Null or empty. */
        EMPTY,
        /** Over {@link #MAX_LENGTH} characters. */
        TOO_LONG,
        /** Neither a {@code [provider]} nor a placeholder at its start. */
        NO_PROVIDER,
        /** {@code [~]}, {@code [.]}, a blank provider or one holding a bracket. */
        RELATIVE_PROVIDER,
        /** A provider and nothing after it. */
        NO_PATH,
        /** A placeholder at its start that is not {@code {asset.path}}, or text straight after it. */
        OTHER_PLACEHOLDER,
        /** {@code {asset.path}/} and nothing after it. */
        NO_SUFFIX,
        /** A {@code [} or {@code ]} after the provider, or after {@code {asset.path}/}. */
        BRACKET,
        /** A brace after the provider, or after {@code {asset.path}/}. */
        BRACE,
        /** An empty or blank part between two {@code /}. */
        EMPTY_PART
    }

    /**
     * The rule: null for a full path {@code [provider]a/b}, {@code {asset.path}} or
     * {@code {asset.path}/<suffix>} (a trailing {@code /} is not counted), else what is wrong with it.
     * No empty part ({@code a//b}), no bracket after the provider, no brace in a suffix. Pure.
     */
    public static Fault fault(String raw) {
        if (raw == null || raw.isEmpty()) {
            return Fault.EMPTY;
        }
        if (raw.length() > MAX_LENGTH) {
            return Fault.TOO_LONG;
        }
        return raw.startsWith("{") ? relativeFault(raw) : fullFault(raw);
    }

    private static Fault fullFault(String raw) {
        int close = raw.indexOf(']');
        if (!raw.startsWith("[") || close < 2) {
            return Fault.NO_PROVIDER;
        }
        String provider = raw.substring(1, close);
        if (provider.equals("~") || provider.equals(".") || provider.indexOf('[') >= 0 || provider.isBlank()) {
            return Fault.RELATIVE_PROVIDER;
        }
        String path = trimTrailing(raw.substring(close + 1));
        if (path.isEmpty()) {
            return Fault.NO_PATH;
        }
        return partsFault(path);
    }

    private static Fault relativeFault(String raw) {
        if (raw.equals(Placeholders.ASSET_PATH)) {
            return null;
        }
        String prefix = Placeholders.ASSET_PATH + "/";
        if (!raw.startsWith(prefix)) {
            return Fault.OTHER_PLACEHOLDER;
        }
        String suffix = trimTrailing(raw.substring(prefix.length()));
        if (suffix.isEmpty()) {
            return Fault.NO_SUFFIX;
        }
        return partsFault(suffix);
    }

    /** The path after the provider or after {@code {asset.path}/}: plain parts only. */
    private static Fault partsFault(String path) {
        if (path.indexOf('[') >= 0 || path.indexOf(']') >= 0) {
            return Fault.BRACKET;
        }
        if (path.indexOf('{') >= 0 || path.indexOf('}') >= 0) {
            return Fault.BRACE;
        }
        return segmentsOk(path) ? null : Fault.EMPTY_PART;
    }

    private static String trimTrailing(String path) {
        int end = path.length();
        while (end > 0 && path.charAt(end - 1) == '/') {
            end--;
        }
        return path.substring(0, end);
    }

    /**
     * Read a full path {@code [provider]a/b}; a trailing {@code /} is trimmed.
     *
     * @throws MapStudioException {@code invalid} without a provider, with {@code [~]} or {@code [.]}
     *                            (relative to the project or the tag), with an empty path or an
     *                            empty segment, with a brace (a placeholder), or over {@link #MAX_LENGTH}
     */
    public static Full parseFull(String raw) {
        Fault fault = raw == null || raw.isEmpty() ? Fault.EMPTY
            : raw.length() > MAX_LENGTH ? Fault.TOO_LONG : fullFault(raw);
        if (fault != null) {
            throw invalid(switch (fault) {
                case EMPTY -> "The tag path is empty.";
                case TOO_LONG -> "The tag path is longer than " + MAX_LENGTH + " characters.";
                case NO_PROVIDER -> "The tag path " + Rows.echo(raw) + " does not start with a [provider].";
                case RELATIVE_PROVIDER -> "The tag path " + Rows.echo(raw) + " must name its provider, not a relative one.";
                case NO_PATH -> "The tag path " + Rows.echo(raw) + " names a provider but no tag or folder.";
                case EMPTY_PART -> "The tag path " + Rows.echo(raw) + " has an empty part between two /.";
                default -> "The tag path " + Rows.echo(raw) + " holds a bracket or a brace after its provider.";
            });
        }
        int close = raw.indexOf(']');
        return new Full(raw.substring(1, close), trimTrailing(raw.substring(close + 1)));
    }

    /**
     * Resolve a picked or stored path against an asset's base path. {@code {asset.path}} and
     * {@code {asset.path}/<suffix>} are relative as they are; a full path equal to the base path,
     * or below it on a {@code /} boundary, becomes relative; any other full path is returned
     * unchanged, not relative.
     *
     * @throws MapStudioException {@code invalid} for anything else (see {@link #parseFull})
     */
    public static Resolved resolve(String raw, String basePath) {
        if (raw != null && raw.startsWith("{")) {
            return relative(raw);
        }
        Full picked = parseFull(raw);
        Full base = parseFull(basePath);
        if (!picked.provider().equalsIgnoreCase(base.provider())) {
            return new Resolved(raw, false, null);
        }
        List<String> p = picked.segments();
        List<String> b = base.segments();
        if (p.size() < b.size()) {
            return new Resolved(raw, false, null);
        }
        for (int i = 0; i < b.size(); i++) {
            if (!p.get(i).toLowerCase(Locale.ROOT).equals(b.get(i).toLowerCase(Locale.ROOT))) {
                return new Resolved(raw, false, null);
            }
        }
        String suffix = String.join("/", p.subList(b.size(), p.size()));
        String asset = Placeholders.ASSET_PATH;
        return new Resolved(suffix.isEmpty() ? asset : asset + "/" + suffix, true, suffix);
    }

    /** The full path {@code suffix} names below {@code basePath} (the base path itself for {@code ""}). Pure. */
    public static String under(String basePath, String suffix) {
        String base = basePath;
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return suffix == null || suffix.isEmpty() ? base : base + "/" + suffix;
    }

    private static Resolved relative(String raw) {
        Fault fault = raw.length() > MAX_LENGTH ? Fault.TOO_LONG : relativeFault(raw);
        String prefix = Placeholders.ASSET_PATH + "/";
        if (fault == Fault.TOO_LONG) {
            throw invalid("The tag path is longer than " + MAX_LENGTH + " characters.");
        }
        if (fault == Fault.OTHER_PLACEHOLDER) {
            throw invalid("The tag path " + Rows.echo(raw) + " uses a placeholder other than "
                    + Placeholders.ASSET_PATH + ".");
        }
        if (fault != null) {
            throw invalid("The tag path " + Rows.echo(raw) + " needs a plain path after " + prefix + ".");
        }
        if (raw.equals(Placeholders.ASSET_PATH)) {
            return new Resolved(Placeholders.ASSET_PATH, true, "");
        }
        String suffix = trimTrailing(raw.substring(prefix.length()));
        return new Resolved(prefix + suffix, true, suffix);
    }

    private static String trimSlashes(String s) {
        int start = 0;
        int end = s.length();
        while (start < end && s.charAt(start) == '/') {
            start++;
        }
        while (end > start && s.charAt(end - 1) == '/') {
            end--;
        }
        return s.substring(start, end);
    }

    private static boolean segmentsOk(String path) {
        for (String segment : path.split("/", -1)) {
            if (segment.isBlank()) {
                return false;
            }
        }
        return true;
    }

    private static MapStudioException invalid(String message) {
        return new MapStudioException(Messages.CODE_INVALID, message);
    }
}
