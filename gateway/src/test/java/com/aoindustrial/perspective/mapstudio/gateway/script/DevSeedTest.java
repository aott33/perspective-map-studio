package com.aoindustrial.perspective.mapstudio.gateway.script;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.python.util.PythonInterpreter;

/**
 * The dev seed (ops/project/ignition/script-python/mapstudio_seed/code.py, epic 2 story 11)
 * run under the SDK's Jython against a stand-in map store (seed_harness.py), one test per
 * row of the story's I/O matrix that the seed itself handles. The last row, a user without
 * MapEditor, is the view's role check and is covered by e2e/tests/scale.spec.mjs.
 */
class DevSeedTest {

    static final Path SEED = Path.of("..").toAbsolutePath().normalize()
        .resolve("ops/project/ignition/script-python/mapstudio_seed/code.py");

    static PythonInterpreter python;

    @BeforeAll
    static void load() throws Exception {
        System.setProperty("python.import.site", "false");
        System.setProperty("python.cachedir.skip", "true");
        python = new PythonInterpreter();
        try (InputStream in = DevSeedTest.class.getResourceAsStream("seed_harness.py")) {
            assertNotNull(in, "seed_harness.py");
            python.exec(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
        python.exec(Files.readString(SEED, StandardCharsets.UTF_8));
    }

    private static void row(String function) {
        assertEquals("ok", python.eval(function + "()").toString(), function);
    }

    @Test
    void firstRunCreatesAll64InOneBatch() {
        row("row_first_run");
    }

    @Test
    void aRerunOfAnUnchangedSeedSendsNothing() {
        row("row_rerun_unchanged");
    }

    @Test
    void aRerunPutsAnEditedSeedItemBackAtItsStoredVersion() {
        row("row_rerun_edited");
    }

    @Test
    void aRerunRestoresADeletedSeedItemFromTheConflict() {
        row("row_rerun_deleted");
    }

    @Test
    void aConcurrentEditIsReportedNotRetried() {
        row("row_concurrent_edit");
    }

    @Test
    void aKindListThatIsDownWritesNothing() {
        row("row_kind_list_down");
    }

    @Test
    void conflictsAdaptedToDictsAreReadToo() {
        row("conflicts_read_as_dicts");
    }

    @Test
    void theScaleCountReadsTheSeedIdsNotTheNames() {
        row("scale_counts_seed_ids");
    }

    @Test
    void thePlannerIsPureAndComparesAtSixDecimals() {
        row("plan_is_pure");
    }
}
