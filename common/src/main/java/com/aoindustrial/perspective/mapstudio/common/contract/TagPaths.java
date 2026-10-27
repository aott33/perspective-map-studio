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

    /**
     * The placeholder for the asset's base path. Story 9 owns the closed placeholder list
     * in {@code common/}; this one literal is the only one the tag lookups need.
     */
    public static final String ASSET_PATH = "{asset.path}";

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
            throw invalid("The folder " + echo(raw) + " has an empty part between two /.");
        }
        return trimmed;
    }

    /**
     * Read a full path {@code [provider]a/b}; a trailing {@code /} is trimmed.
     *
     * @throws MapStudioException {@code invalid} without a provider, with {@code [~]} or {@code [.]}
     *                            (relative to the project or the tag), with an empty path or an
     *                            empty segment, with a brace (a placeholder), or over {@link #MAX_LENGTH}
     */
    public static Full parseFull(String raw) {
        if (raw == null || raw.isEmpty()) {
            throw invalid("The tag path is empty.");
        }
        if (raw.length() > MAX_LENGTH) {
            throw invalid("The tag path is longer than " + MAX_LENGTH + " characters.");
        }
        int close = raw.indexOf(']');
        if (!raw.startsWith("[") || close < 2) {
            throw invalid("The tag path " + echo(raw) + " does not start with a [provider].");
        }
        String provider = raw.substring(1, close);
        if (provider.equals("~") || provider.equals(".") || provider.indexOf('[') >= 0 || provider.isBlank()) {
            throw invalid("The tag path " + echo(raw) + " must name its provider, not a relative one.");
        }
        String path = raw.substring(close + 1);
        while (path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        if (path.isEmpty()) {
            throw invalid("The tag path " + echo(raw) + " names a provider but no tag or folder.");
        }
        if (path.indexOf('[') >= 0 || path.indexOf(']') >= 0 || path.indexOf('{') >= 0 || path.indexOf('}') >= 0) {
            throw invalid("The tag path " + echo(raw) + " holds a bracket or a brace after its provider.");
        }
        if (!segmentsOk(path)) {
            throw invalid("The tag path " + echo(raw) + " has an empty part between two /.");
        }
        return new Full(provider, path);
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
        return new Resolved(suffix.isEmpty() ? ASSET_PATH : ASSET_PATH + "/" + suffix, true, suffix);
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
        if (raw.length() > MAX_LENGTH) {
            throw invalid("The tag path is longer than " + MAX_LENGTH + " characters.");
        }
        if (raw.equals(ASSET_PATH)) {
            return new Resolved(ASSET_PATH, true, "");
        }
        String prefix = ASSET_PATH + "/";
        if (!raw.startsWith(prefix)) {
            throw invalid("The tag path " + echo(raw) + " uses a placeholder other than " + ASSET_PATH + ".");
        }
        String suffix = raw.substring(prefix.length());
        while (suffix.endsWith("/")) {
            suffix = suffix.substring(0, suffix.length() - 1);
        }
        if (suffix.isEmpty() || suffix.indexOf('[') >= 0 || suffix.indexOf(']') >= 0 || suffix.indexOf('{') >= 0
                || suffix.indexOf('}') >= 0 || !segmentsOk(suffix)) {
            throw invalid("The tag path " + echo(raw) + " needs a plain path after " + prefix + ".");
        }
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

    /** At most 80 characters of a path for a message (the person's own input). */
    private static String echo(String s) {
        return s.length() <= 80 ? s : s.substring(0, 77) + "...";
    }

    private static MapStudioException invalid(String message) {
        return new MapStudioException(Messages.CODE_INVALID, message);
    }
}
