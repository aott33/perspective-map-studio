---
id: 33
type: story
title: "Scale to tens of thousands of map items"
parent: none
covers: []
after: []
refined: false
hitl: true
risk: high
---

# Scale to tens of thousands of map items

## Description

From the feature review of 2026-11-07 (item 7). Map Studio's first version targets the 30-pad field and its performance run seeds 1,000 items (initiative Boundaries: scale beyond the 30-pad set is out of the first version). A large operator or a utility may have tens of thousands of assets. This story measures where the map, the batch of live values, the item list and the map store stop holding their limits, then lifts them: drawing items from a GPU layer above a count, clustering or a heatmap at low zoom (backlog story on clustering), live values only for what is in view, the item list virtualised.

## Requirements

- Verify: when it is scheduled, a seed of 20,000 items keeps the performance run's limits for frame rate, map load and edits, recorded beside the 0.4.0 run.

## References

- gap review - _bmad-output/initiative-flowmap/gap-review-2026-11-07.md
- performance - docs/perf/README.md, e2e/perf/perf.spec.mjs (the 1,000-item seed)

## Notes

- Note: 2026-11-07 Owner: backlog, after 0.4.0's performance run (epic 4 entry 18) shows where the limits are today.
