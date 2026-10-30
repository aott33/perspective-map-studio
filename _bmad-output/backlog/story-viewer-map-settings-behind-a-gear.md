---
id: 12
type: story
title: "Viewer map settings behind a gear (basemap, lines, names), within what the project allows"
parent: none
covers: []
after: [10, 11]
refined: false
hitl: true
risk: low
---

# Viewer map settings behind a gear

## Description

The owner asked (2026-10-30, while testing the showcase) for a settings gear on the map: the viewer chooses their own basemap (and later its theme, story 11's Light and Dark styles), only from what the project's developer configured in the Designer setup, and the gear holds all the viewer's map settings together (show lines, show names, and so on). Today the viewer's settings live in the Legend (entry 14: the Lines and Names toggles, remembered per browser, and the basemap choice), and the owner's 0.3.0 review decided the basemap is a project setting by default with no viewer switch unless the setup lists more than one (story 10, item 3).

The idea to think through: the Legend becomes the key only, and a gear button (beside the zoom card, or in the Legend's place on a phone) opens a small settings panel:

- Basemap: the setup's list, the setup's default first; hidden when the setup lists one.
- Display: Lines, Names (today's Legend toggles), and later ones (values under names, instruments, geofences) as they come.
- Remembered per browser as today (local storage, per project), with a "Reset to the project's defaults".

## Requirements

- Verify: when it is scheduled, a viewer changes the basemap only among the setup's basemaps and the change survives a reload; with one basemap in the setup the basemap section is absent; the Lines and Names toggles work from the gear as they do from the Legend today; keyboard and 44 px touch targets as for the Legend; nothing in the gear can hide an alarm, comms-lost or stale mark.

## References

- story 10 - _bmad-output/backlog/story-owner-review-notes-on-the-0-3-0-map.md, item 3 (basemap a project setting, the phone legend as a sheet)
- story 11 - _bmad-output/backlog/story-more-mapbox-basemap-styles.md (the styles a viewer would pick from)
- epic-viewing - entry 14 (View-mode controls: the Legend with its toggles and basemap choice)
- docs - docs/basemaps.md, docs/setup.md (the setup's basemaps list)

## Notes

- Decision: 2026-10-30 Owner: "add to backlog to think through": after release 0.3.0; 0.3.0 ships story 10 item 3 as decided (the setup's default basemap, a switch only when the setup lists more than one, the toggles in the Legend).
- Open question: Where the gear sits (beside the zoom card on desktop; on a phone in the top bar or beside the Legend button) and whether the Legend keeps its toggles as well.
- Open question: Whether the setup can lock a setting (for example force Names on for a control room) or only offer choices.
- Constraint: alarm presentation (ER-27): a viewer setting may hide context (lines, names, geofences), never a state mark or the Needs you count.
