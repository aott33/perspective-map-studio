---
id: 23
type: story
title: "Field notes and photos on a map item"
parent: none
covers: []
after: []
refined: false
hitl: true
risk: medium
---

# Field notes and photos on a map item

## Description

A user with phone editing adds a short note and a photo to a map item from the bottom sheet (the phone's camera or a file), and the popup shows the latest note and a photo strip; a note is a dated, signed line (who, when) kept in its own table in the map store, a photo a file the Gateway stores under its data folder (or a project-named path) with a size limit and a thumbnail, both deleted with the item. From the gap review of 2026-11-03 (item 12): Wellsite Navigator and Esri Field Maps let a field hand leave what they saw at the site. Notes and photos are not properties (they are never in the kind's fields, the export of R35 or the bulk form) and not edits of the map (no undo; a note is removed by its author or a full editor, recorded in the edit record).

## Requirements

- Verify: when it is scheduled, at 390 px a phone editor adds a note and a photo to P12 from the bottom sheet, both show in the popup on a laptop within the refresh interval with who and when, a 20 MB photo is refused in words, deleting P12 removes both, the export of R35 is unchanged, and the photo is served only to a signed-in Perspective session (never a public URL).

## References

- gap review - _bmad-output/initiative-flowmap/gap-review-2026-11-03.md, item 12 (field notes and photos; Wellsite Navigator, Esri Field Maps)
- initiative - R31 (phone editing from the bottom sheet), R33 (the map store's own tables), R45 (the edit record)
- architecture - AD-2 (one write path), AD-3 (the map store), AD-20 (the record is closed: a note is a separate table, not a property)
- epic-phone - _bmad-output/initiative-flowmap/tickets/epic-phone/epic-phone.md (the bottom sheet's Edit button this starts from)

## Notes

- Decision: 2026-11-03 Owner (gap review, "agree, write up the gap review as recommended"): in the backlog, after 0.3.0 and after epic-phone, one story of its own (its own table and file storage, independent of the other item 12 pieces).
- Constraint: no personal data beyond the Ignition user name and the time; the docs say photos may hold faces and plates and the retention is the project's.
- Open question: where photos are stored (the Gateway's data folder, a database blob, or a project-named path) and the retention or limit per item.
- Open question: whether a note can carry a state (a "needs attention" flag that counts in Needs you) or is text only; text only is the leaning (ER-27: a note is never a state mark).
