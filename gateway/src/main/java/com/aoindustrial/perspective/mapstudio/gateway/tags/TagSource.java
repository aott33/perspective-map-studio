package com.aoindustrial.perspective.mapstudio.gateway.tags;

import java.util.Collection;
import java.util.List;
import java.util.Set;

import com.aoindustrial.perspective.mapstudio.common.contract.TagChild;

/**
 * The tag system as the tag browser's lookups need it (entry 15): structure only, never a
 * value, a subscription, a write or an edit (AD-1). On the Gateway it is
 * {@link IgnitionTagSource}; tests use a fake. Every method that asks the tag system answers
 * within 5 s or throws {@code MapStudioException} {@code tags-unavailable}.
 */
public interface TagSource {

    /** One level of a folder: whether the folder exists, its listed children (unsorted) and whether more were left out. */
    record Browse(boolean found, List<TagChild> children, boolean truncated) {
    }

    /** The Gateway's tag provider names, as the Gateway spells them. */
    List<String> providers();

    /** The project's default tag provider from its properties, or null or blank when it names none. */
    String projectDefault(String project);

    /**
     * One level of {@code folder} ({@code ""} for the root) of {@code provider} (a name from
     * {@link #providers()}), under the session user's roles; at most {@code max} children.
     */
    Browse browse(String provider, String folder, Collection<String> roles, int max);

    /** Those of {@code fullPaths} that exist, under the session user's roles; one browse per distinct parent folder. */
    Set<String> existing(Collection<String> fullPaths, Collection<String> roles);
}
