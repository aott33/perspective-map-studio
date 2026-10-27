package com.aoindustrial.perspective.mapstudio.gateway.tags;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.TagChild;

/**
 * A tag system in memory: providers, the project's default, and full paths of folders and tags
 * (a path ending in {@code /} is a folder; parents are made folders). Records the calls it gets.
 */
public final class FakeTagSource implements TagSource {

    public final List<String> providers = new ArrayList<>(List.of("default", "System"));
    public String projectDefault = "";
    /** Lower-case full path to the node: its stored path and its type word. */
    final Map<String, String[]> nodes = new LinkedHashMap<>();
    public final List<String> browseCalls = new ArrayList<>();
    public final List<Collection<String>> existingCalls = new ArrayList<>();
    public final List<Collection<String>> rolesSeen = new ArrayList<>();
    /** When set, every call that asks the tag system fails as {@code tags-unavailable} (a timeout). */
    public boolean slow;

    public FakeTagSource folder(String full) {
        add(full, TagChild.FOLDER, null);
        return this;
    }

    public FakeTagSource tag(String full, String dataType) {
        add(full, TagChild.TAG, dataType);
        return this;
    }

    public FakeTagSource instance(String full) {
        add(full, TagChild.UDT_INSTANCE, null);
        return this;
    }

    private void add(String full, String type, String dataType) {
        int slash = full.lastIndexOf('/');
        int close = full.indexOf(']');
        if (slash > close) {
            String parent = full.substring(0, slash);
            if (!nodes.containsKey(parent.toLowerCase(Locale.ROOT))) {
                folder(parent);
            }
        }
        nodes.put(full.toLowerCase(Locale.ROOT), new String[] {full, type, dataType});
    }

    @Override
    public List<String> providers() {
        return providers;
    }

    @Override
    public String projectDefault(String project) {
        return projectDefault;
    }

    @Override
    public Browse browse(String provider, String folder, Collection<String> roles, int max) {
        browseCalls.add("[" + provider + "]" + folder);
        rolesSeen.add(roles);
        timeout();
        String parent = ("[" + provider + "]" + folder).toLowerCase(Locale.ROOT);
        if (!folder.isEmpty() && !nodes.containsKey(parent)) {
            return new Browse(false, List.of(), false);
        }
        String prefix = folder.isEmpty() ? parent : parent + "/";
        List<TagChild> children = new ArrayList<>();
        int seen = 0;
        for (String[] n : nodes.values()) {
            String lower = n[0].toLowerCase(Locale.ROOT);
            if (lower.startsWith(prefix) && lower.indexOf('/', prefix.length()) < 0 && lower.length() > prefix.length()) {
                seen++;
                if (seen > max) {
                    break;
                }
                String name = n[0].substring(prefix.length());
                children.add(new TagChild(name, n[0], n[1], n[2], !TagChild.TAG.equals(n[1])));
            }
        }
        return new Browse(true, children, seen > max);
    }

    @Override
    public Set<String> existing(Collection<String> fullPaths, Collection<String> roles) {
        existingCalls.add(new ArrayList<>(fullPaths));
        rolesSeen.add(roles);
        timeout();
        Set<String> found = new HashSet<>();
        for (String p : fullPaths) {
            if (nodes.containsKey(p.toLowerCase(Locale.ROOT))) {
                found.add(p);
            }
        }
        return found;
    }

    private void timeout() {
        if (slow) {
            throw new MapStudioException(Messages.CODE_TAGS_UNAVAILABLE, "The tag system did not answer within 5 s.");
        }
    }
}
