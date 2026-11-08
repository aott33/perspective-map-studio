---
title: "Fix the three flaky tests: the view helper waits for the map, the lookups' thread race, R4 (a) diagnostics"
type: 'bugfix'
ticket: ''
created: '2026-11-08'
status: 'in-progress'
baseline_revision: '478adb6dfb6e92e1177d079ea87138291ec7fe3f'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Three tests fail now and then, so whole-suite runs are rarely green and real failures risk being waved through. An investigation (2026-11-08) found: `review.spec.mjs:301` (390 px) fails because the e2e `view()` helper returns before the map has redrawn when the zoom does not change, so a click is hit-tested on the old frame; `SetupLookupsTest.aHungSecretProviderHoldsOneThreadAndNeverTheOtherLists` fails because of a real race in `SetupLookups.submit` (a worker completes the caller's future before it is back waiting for work, so the next call's task is rejected by the `SynchronousQueue` pool as UNAVAILABLE though nothing was slow); `retest.spec.mjs:204` R4 (a) did not reproduce in 30 runs and its cause is unproven. The "No Connection to Gateway" text in the snapshots is Perspective's always-present, off-screen banner, not a lost connection.

**Approach:** Owner, 2026-11-08 ("Yes, go ahead" on the recommendation): fix the first two at their cause, add diagnostics to the third, no skip, quarantine or weakened expectation.

## Boundaries & Constraints

**Always:** `window.__mapStudioTestView` (`web/typescript/testHook.ts:68-74`, wired in `MapStudio.tsx`) returns a promise resolved on the map's next `idle` after its `jumpTo` (resolved at once if nothing moves and the map is idle), and `e2e/tests/fixtures.mjs` `view()` (162-164) awaits it before its existing checks; every spec using `view()` keeps passing. `SetupLookups.submit` (`gateway/.../setuplookup/SetupLookups.java`): the concurrency limit is a `Semaphore` with permits equal to the pool size, taken before `execute` and released in the worker's `finally` before the future completes; the executor never rejects for a lack of an idle thread; UNAVAILABLE means only that every permit is held by a running call; `inFlight.remove(key, mine)` happens before `complete()`; the timeout warning prints the instance's `timeoutMs`; the same applies to both production pools in `MapStudioGatewayHook`. A new unit test reproduces the race deterministically (back-to-back calls at full capacity) and passes, and `SetupLookupsTest` passes 50 runs in a row. R4 (a): on failure the test attaches the reloaded page's `session-init` `selectedItem` and every `[MapStudio]` console line about a page selection, so the next failure names its cause; its expectations stay. `_bmad-output/deferred-work.md`: the 390 px and `SetupLookupsTest` entries resolved with the cause, a corrected note on the banner, R4 (a) added as unconfirmed. No em dashes.

**Never:** Skip, retry-wrap, quarantine or loosen a test; change Map Studio's map behaviour, the selection rules or any message; add the speculative mount-selection product change for R4 (a).

</frozen-after-approval>

## Code Map

- `web/typescript/testHook.ts` 68-74, `MapStudio.tsx` (where the hook is installed, about 434) -- the promise on `idle`.
- `e2e/tests/fixtures.mjs` 162-170 `view()` -- await the returned promise.
- `gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/setuplookup/SetupLookups.java` -- `TIMEOUT_MS` 44, `inFlight` 58, `submit`, the timeout warning; the pools in `MapStudioGatewayHook` (6 lists threads, 4 secret names, no queue); `gateway/src/test/.../SetupLookupsTest.java` 217.
- `e2e/tests/retest.spec.mjs` 204-250 -- the diagnostics (attach on failure via `test.info().attach`).
- Evidence: the investigator's logs in the session scratchpad (`review-dbg.log`, `pw-rev/`, `r4-*.log`, `gl/`).

## Tasks & Acceptance

**Execution:**
- [ ] The view hook and `view()`; `review.spec.mjs` 390 px passes 12 of 12 under CPU load (as the investigation's repro).
- [ ] `SetupLookups` race, the new unit test, 50 runs of `SetupLookupsTest`.
- [ ] R4 (a) diagnostics.
- [ ] `deferred-work.md` entries.

**Acceptance Criteria:**
- Given a fresh dev stack, when the whole e2e suite runs, then every spec passes.

## Implementation Notes

- Planner: the environment, commit and identity rules are 7b's plan's (Docker by hand after a restart, `ops/up.sh --fresh` before a whole-suite run, the session's trailers, `git commit --only`, no em dashes, no model identifier, never a bare `git stash`, never a push).

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: green.
