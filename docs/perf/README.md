# Performance records

One JSON file per release and target, written by `ops/perf.sh` (epic 2 story 17) and compared release to release. The method, the limits and the reading of each record are in [platform-checks.md](../platform-checks.md), section "Epic 2 story 17".

| File | Target | Run |
| --- | --- | --- |
| `0.2.0-dev.json` | the `ops/` dev stack, a 4-CPU agent box with software WebGL | 2026-10-28 UTC; every limit met except `edits.apply` with 50-op batches from 10 editors at once, a miss on that box (the cause and the owner's open decision are in platform-checks.md) |
| `0.2.0-template.json` | the template's 300-pad test stack, the owner's laptop | not yet: runs right after the 0.2.0 tag (story 13) |

## Running it

On a laptop with Docker, in this repository:

```sh
ops/up.sh                                  # the dev stack (ops/README in the top-level README)
(cd e2e && npm install && npx playwright install chromium)
PERF_RECORD=0.2.0 ops/perf.sh              # both phases, about 30 min; writes docs/perf/0.2.0-dev.json
PERF_RECORD=0.2.0 ops/perf.sh --phase main # only the phase with the module (the idle and 20-session deltas then have no baseline)
ops/perf.sh --target template              # the template's kept 300-pad test stack (settings in ops/perf.sh)
```

A run needs at least 45 minutes left on the Gateway's trial. Exit code 0 means every limit passed, 3 a limit missed (the record is still written), 2 refused before anything started, 1 a crash (no record). Every number in a record carries its method and label, and the record's `env` names the Gateway version, the module list of each phase, the renderer, the CPU count and the load averages, so two records from different machines are read side by side, never as one series.

## Comparing two records

```sh
cd e2e && node perf/compare.mjs ../docs/perf/0.2.0-dev.json ../docs/perf/0.3.0-dev.json
```

prints each headline number (p95 and median of the timed measures, the slowest `map.changed` session, the added CPU and heap, the bundle bytes, the median frame rates) with its value in each record, the delta and the second record's verdict. To compare a re-run on another machine with the committed record, save the committed one first: `git show HEAD:docs/perf/0.2.0-dev.json > /tmp/perf-box.json`.
