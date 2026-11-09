---
id: 37
type: story
title: "The edit record's retention: how long Recent changes and Revert reach back"
parent: none
covers: []
after: []
refined: false
hitl: false
risk: low
---

# The edit record's retention: how long Recent changes and Revert reach back

## Description

Raised at the round table on entry 11a's plan (2026-11-09; the owner agreed): from map store schema 3 every edit row keeps its op's values before and after, a create or a delete its whole record. Nothing ever prunes `mapstudio_edit`, so an import that lands 1,000 full records, or a field re-imported weekly to sync from an asset system (Mary's case), makes the edit record a second copy of the map every time.

Decide how long an editor needs Revert (a count of changes, an age, or a size per project), whether pruning drops only the values (keeping who, what and when) or whole rows, and who runs it (the Gateway on a schedule, or an administrator). Entry 18's performance run measures the store's size after ten imports of the dev field first, so the rule rests on a number.
