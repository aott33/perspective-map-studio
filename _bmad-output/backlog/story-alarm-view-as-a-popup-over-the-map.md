---
id: 13
type: story
title: "Alarm view as a popup over the map"
parent: none
covers: []
after: [10]
refined: false
hitl: true
risk: medium
---

# Alarm view as a popup over the map

## Description

View alarms opens the project's alarm page, so the operator leaves the map (owner, 2026-11-03, re-test R4: "annoying losing my spot and opening a new view"). Release 0.3.0 makes the map remember its place across a page round trip (R4 (a)). This story adds the project's choice to open the alarm view as a Perspective popup over the map instead of navigating: the setup names a view (with the same placeholders as `alarmPage`), and View alarms opens it as a popup with the item's alarm folder as a parameter, the map staying where it is. How alarms are handled stays the project's choice: a page, a popup, or none.

## Requirements

- Verify: when it is scheduled, with the setup's alarm view set to a popup view, View alarms opens that view over the map with the item's alarms (the built-in Alarm Status Table filtered to the item, as the dev project's `Popups/PadAlarms` shows), closing it returns to the map unchanged; with the page form the behaviour is as in 0.3.0; Map Studio still acknowledges nothing itself.

## References

- review notes - _bmad-output/backlog/story-owner-review-notes-on-the-0-3-0-map.md, R4
- docs - docs/setup.md (`alarmPage`), docs/kind-setup.md (`popupView`), the dev project's `Popups/PadAlarms`

## Notes

- Decision: 2026-11-03 Owner: after 0.3.0; 0.3.0 keeps the map's place across a page round trip instead.
- Open question: How the browser asks the Gateway to open a Perspective popup for the session (a component event the project handles, or Map Studio calling the session's popup itself), and what the popup is named so a second click replaces it.
