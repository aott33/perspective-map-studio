package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.util.concurrent.Callable;
import java.util.function.Consumer;

import javax.swing.SwingUtilities;
import javax.swing.SwingWorker;

/**
 * Where the setup form's lists come from (epic 2 story 16): the open project (read on the Swing
 * thread, it is in memory) and the Gateway (the module's {@code SetupLookupRpc}, called off the
 * Swing thread). {@link DesignerListSource} is the Designer's; tests use a fake.
 */
interface SetupListSource {

    /** The project's functions, pages and identity provider. */
    ProjectLists.Snapshot project();

    /** The Gateway's {@code SetupLookupRpc.lists} answer (JSON); throws when the Gateway cannot be asked. */
    String gatewayLists(String identityProvider) throws Exception;

    /** The Gateway's {@code SetupLookupRpc.secretNames} answer (JSON); throws when the Gateway cannot be asked. */
    String secretNames(String provider) throws Exception;

    /** No lists at all (a form with nothing to compare with). */
    SetupListSource NONE = new SetupListSource() {
        @Override
        public ProjectLists.Snapshot project() {
            return ProjectLists.Snapshot.unknown();
        }

        @Override
        public String gatewayLists(String identityProvider) throws Exception {
            throw new IllegalStateException("no Gateway");
        }

        @Override
        public String secretNames(String provider) throws Exception {
            throw new IllegalStateException("no Gateway");
        }
    };

    /** Runs Gateway work off the Swing thread and answers on it. */
    interface Async {
        <T> void run(Callable<T> work, Consumer<T> done, Consumer<Exception> failed);

        /** A {@code SwingWorker}: the work on a worker thread, the answer on the Swing thread. */
        Async SWING = new Async() {
            @Override
            public <T> void run(Callable<T> work, Consumer<T> done, Consumer<Exception> failed) {
                new SwingWorker<T, Void>() {
                    @Override
                    protected T doInBackground() throws Exception {
                        return work.call();
                    }

                    @Override
                    protected void done() {
                        try {
                            done.accept(get());
                        } catch (java.util.concurrent.ExecutionException ex) {
                            Throwable c = ex.getCause();
                            failed.accept(c instanceof Exception ? (Exception) c : ex);
                        } catch (InterruptedException ex) {
                            Thread.currentThread().interrupt();
                            failed.accept(ex);
                        }
                    }
                }.execute();
            }
        };

        /** Runs the work at once and answers on the Swing thread (tests, the screenshot renderer). */
        Async DIRECT = new Async() {
            @Override
            public <T> void run(Callable<T> work, Consumer<T> done, Consumer<Exception> failed) {
                T value;
                try {
                    value = work.call();
                } catch (Exception ex) {
                    onEdt(() -> failed.accept(ex));
                    return;
                }
                onEdt(() -> done.accept(value));
            }

            private void onEdt(Runnable r) {
                if (SwingUtilities.isEventDispatchThread()) {
                    r.run();
                } else {
                    try {
                        SwingUtilities.invokeAndWait(r);
                    } catch (Exception ex) {
                        throw new IllegalStateException(ex);
                    }
                }
            }
        };
    }
}
