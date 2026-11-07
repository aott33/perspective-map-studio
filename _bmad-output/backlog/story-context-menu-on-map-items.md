---
id: 34
type: story
title: "A right-click menu on map items"
parent: none
covers: []
after: []
refined: false
hitl: false
risk: low
---

# A right-click menu on map items

## Description

From the feature review of 2026-11-07 (item 8). A right-click (or a long press on touch) on an item opens a short menu of actions: open its page, view alarms, zoom to it, copy its coordinates, and in Edit mode Delete or Move; a page may add its own entries that fire an event with the item.

## Requirements

- Verify: when it is scheduled, a right-click on P14 opens the menu with its actions, each working by keyboard too; a page entry fires its event with the AD-7 item object; e2e passes.

## References

- gap review - _bmad-output/initiative-flowmap/gap-review-2026-11-07.md

## Notes

- Open question: Whether the menu earns its place beside the popup and Details, which already hold most of these actions.
- Note: 2026-11-07 Owner: backlog, low.
- Note: 2026-11-07 Owner (the feature review addendum, item C): the lighter option first: a right-click (or long press) event sent to the page with the item and its coordinates, so a page builds its own menu; the built-in menu only if pages ask for one.
