package com.aoindustrial.perspective.mapstudio.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonObject;

/** The delegates' work pool is bounded, and a full pool is answered as busy. */
class WorkPoolTest {

    @Test
    void aFullPoolRefusesInsteadOfQueueingWithoutBound() throws Exception {
        ThreadPoolExecutor pool = MapStudioServices.newWorkPool(1, 2, Thread::new);
        CountDownLatch release = new CountDownLatch(1);
        CountDownLatch started = new CountDownLatch(1);
        try {
            pool.execute(() -> {
                started.countDown();
                try {
                    release.await();
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                }
            });
            assertTrue(started.await(5, TimeUnit.SECONDS));
            pool.execute(() -> { });
            pool.execute(() -> { });
            assertThrows(RejectedExecutionException.class, () -> pool.execute(() -> { }),
                "one busy thread and a full queue of two: the fourth is refused");
        } finally {
            release.countDown();
            pool.shutdownNow();
        }
        assertEquals(64, MapStudioServices.WORK_QUEUE);
        assertEquals(4, MapStudioServices.WORK_THREADS);
    }

    @Test
    void theBusyAnswerIsStoreUnreachableWithTheReason() {
        JsonObject reply = MapStudioDelegate.busyReply("m1");
        assertEquals("error", reply.get("type").getAsString());
        assertEquals("m1", reply.get("id").getAsString());
        assertEquals("store-unreachable", reply.getAsJsonObject("body").get("code").getAsString());
        assertTrue(reply.getAsJsonObject("body").get("message").getAsString().contains("busy"));
    }
}
