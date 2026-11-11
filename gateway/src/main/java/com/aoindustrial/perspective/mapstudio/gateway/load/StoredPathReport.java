package com.aoindustrial.perspective.mapstudio.gateway.load;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import com.aoindustrial.perspective.mapstudio.common.contract.KindSetup;
import com.aoindustrial.perspective.mapstudio.common.contract.KindSetupRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.Rows;

/**
 * The stored rows the tag path rule would refuse (entry 13a, owner decision 2 of 2026-11-11): a
 * project's live kind setups and its live map items' overrides, read as they are stored. One
 * warning per failing row names the project, the kind or the item, the part and the path, and one
 * info line says how many rows were checked. It reports only: nothing stored is rewritten or
 * refused on read, a failing row loads and draws as before and is refused when it is next saved
 * (docs/operations.md, "A stored tag path the rule refuses"). Pure; {@link MapLoader} logs it once
 * per project, at the first read of the project's store after the Gateway starts.
 */
public record StoredPathReport(List<String> warnings, String info) {

    /** The most refusals one warning lists; the rest are counted. */
    static final int MAX_PER_ROW = 5;

    public static StoredPathReport of(String project, List<KindSetupRecord> kindSetups, List<MapItemRecord> items) {
        String p = Rows.echo(project);
        List<String> warnings = new ArrayList<>();
        for (KindSetupRecord setup : kindSetups) {
            List<KindSetup.PathFault> faults = KindSetup.pathFaults(setup.setup(), false);
            if (!faults.isEmpty()) {
                warnings.add("Project " + p + ": the kind setup of " + Rows.echo(setup.kindId()) + " holds "
                    + count(faults.size()) + " a save refuses: " + refusals(faults, "")
                    + " It loads and draws as before and is refused when it is next saved: mend the path on the Kinds"
                    + " screen or with system.mapstudio.applyEdits.");
            }
        }
        for (MapItemRecord item : items) {
            List<KindSetup.PathFault> faults = KindSetup.pathFaults(item.overrides(), true);
            if (!faults.isEmpty()) {
                warnings.add("Project " + p + ": the overrides of map item " + Rows.echo(item.name()) + " ("
                    + Rows.echo(item.id()) + ", kind " + Rows.echo(item.kind()) + ") hold " + count(faults.size())
                    + " a save refuses: " + refusals(faults, "overrides: ")
                    + " It loads and draws as before and is refused when it is next saved: mend the path "
                    + (faults.stream().anyMatch(f -> f.where().startsWith("popupView.params."))
                        // No screen edits an item's own popup view params: the script is the only way.
                        ? "with system.mapstudio.applyEdits (no screen edits an item's popup view params)."
                        : "in the item's Details or with system.mapstudio.applyEdits."));
            }
        }
        int rows = kindSetups.size() + items.size();
        String info = "Project " + p + ": " + rows + " stored row" + (rows == 1 ? "" : "s") + " (" + kindSetups.size()
            + " kind setup" + (kindSetups.size() == 1 ? "" : "s") + ", " + items.size() + " map item"
            + (items.size() == 1 ? "" : "s") + ") checked against the tag path rule: " + (warnings.isEmpty()
            ? "every stored tag path passes."
            : warnings.size() + " would be refused at " + (warnings.size() == 1 ? "its" : "their")
                + " next save; nothing was changed.");
        return new StoredPathReport(List.copyOf(warnings), info);
    }

    private static String count(int n) {
        return n == 1 ? "a tag path" : n + " tag paths";
    }

    private static String refusals(List<KindSetup.PathFault> faults, String prefix) {
        String listed = faults.stream().limit(MAX_PER_ROW).map(f -> prefix + f.refusal()).collect(Collectors.joining(" "));
        return faults.size() > MAX_PER_ROW ? listed + " And " + (faults.size() - MAX_PER_ROW) + " more." : listed;
    }
}
