package com.aoindustrial.perspective.mapstudio.gateway.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonObject;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;

/** Retried batches (epic 2 story 2): a committed batchId replays its stored reply. */
class WriteServiceRetryTest extends WriteFixture {

    @Test
    void aBatchSentAgainAfterItsCommitGetsTheFirstReplyAndIsWrittenOnce() {
        String batchId = uuid();
        String id = uuid();
        save(batch(uuid(), create(uuid())));
        EditResult first = save(batch(batchId, create(id)));
        EditResult again = save(batch(batchId, create(id)));
        assertEquals(first, again);
        assertEquals(2, again.seq());
        assertEquals(2, store.committed.edits.size(), "one set of edit rows");
        assertEquals(2, store.committed.seqs.get(PROJECT), "no seq taken by the retry");
        assertEquals(2, hooked.size(), "the hook is called once for the batch");
    }

    @Test
    void theSameBatchSentTwiceAtOnceIsWrittenOnceAndBothGetTheSameReply() throws Exception {
        String batchId = uuid();
        JsonObject b = batch(batchId, create(uuid()));
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch go = new CountDownLatch(1);
        Callable<EditResult> send = () -> {
            go.await();
            return save(b.deepCopy());
        };
        try {
            List<Future<EditResult>> futures = new ArrayList<>();
            futures.add(pool.submit(send));
            futures.add(pool.submit(send));
            go.countDown();
            EditResult a = futures.get(0).get(10, TimeUnit.SECONDS);
            EditResult c = futures.get(1).get(10, TimeUnit.SECONDS);
            assertEquals(a, c);
            assertEquals(1, a.seq());
        } finally {
            pool.shutdownNow();
        }
        assertNothingWritten(1, 1);
        assertEquals(1, store.committed.batches.size());
        assertEquals(1, hooked.size());
    }

    @Test
    void aBatchCommittedConcurrentlyAtTheInsertReplaysTheStoredReply() {
        String batchId = uuid();
        EditResult stored = new EditResult(batchId, 7, List.of(new EditResult.OpResult("item", uuid(), 1)));
        store.racingBatch = new FakeMapStore.BatchRow(PROJECT, batchId, 7, "mapeditor", stored.toJson());
        assertEquals(stored, save(batch(batchId, create(uuid()))));
        assertNothingWritten(0, 0);
        assertTrue(hooked.isEmpty());
    }

    @Test
    void aBatchIdUsedByAnotherActorIsInvalidAndNothingIsWritten() {
        String batchId = uuid();
        save(batch(batchId, create(uuid())));
        MapStudioException ex = assertThrows(MapStudioException.class,
            () -> writes.apply(PROJECT, batch(batchId, create(uuid())), Actor.session("someone-else"),
                Messages.LEVEL_FULL));
        assertEquals(Messages.CODE_INVALID, ex.code());
        assertTrue(ex.plainMessage().contains("already used"));
        assertNothingWritten(1, 1);
    }

    @Test
    void aRefusedBatchSentAgainIsEvaluatedAfresh() {
        String id = uuid();
        save(batch(uuid(), create(id)));
        String batchId = uuid();
        assertEquals(Messages.CODE_CONFLICT,
            refused(batch(batchId, update(id, 2, "{\"name\":\"x\"}")), Messages.LEVEL_FULL).code());
        assertEquals(Messages.CODE_CONFLICT,
            refused(batch(batchId, update(id, 2, "{\"name\":\"x\"}")), Messages.LEVEL_FULL).code());
        EditResult saved = save(batch(batchId, update(id, 1, "{\"name\":\"x\"}")));
        assertEquals(2, saved.seq());
    }
}
