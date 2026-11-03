---
id: 21
type: story
title: "Upstream and downstream trace on connected lines"
parent: none
covers: []
after: []
refined: false
hitl: true
risk: medium
---

# Upstream and downstream trace on connected lines

## Description

From a selected line, a map item or an instrument, Trace upstream and Trace downstream highlight every line reachable through snapped ends (AD-19 stores which map item each line end snaps to, so the network is already in the map store) and list the sites and instruments on the way; a click on a listed item selects it; Esc or a tap on the ground clears the trace. Direction comes from a line's drawn direction (start to end), which the kind setup may name as flow direction, with a per-line reverse. From the gap review of 2026-11-03 (item 12): Repsol's trace on ArcGIS. The trace is a highlight (the selected-line look of R5's flow arrow, on every traced line) and never a state, so it hides nothing and draws no colour an alarm uses; a trace through a closed line valve (an instrument whose state the kind setup marks as closed) stops there, in a later cut.

## Requirements

- Verify: when it is scheduled, on the dev map a downstream trace from a pad highlights the lines to the gathering point and lists the instruments in order, an upstream trace from the gathering point highlights the same lines back, a floating line end stops the trace, and clearing it leaves the map as before; the e2e suite covers it at 1440 px and the phone's bottom sheet at 390 px.

## References

- gap review - _bmad-output/initiative-flowmap/gap-review-2026-11-03.md, item 12 (trace; Repsol on ArcGIS)
- architecture - AD-19 (snapped ends are stored), AD-7 (the line popup and its instruments)
- initiative - R5 (the flow arrow on the selected line), R41 (instruments on lines)
- story 19 - _bmad-output/backlog/story-spatial-queries-from-script.md (a script-side trace would be a third function there)

## Notes

- Decision: 2026-11-03 Owner (gap review, "agree, write up the gap review as recommended"): in the backlog, after 0.3.0, one story of its own (it is a graph walk over stored snaps and a UI, independent of the other item 12 pieces).
- Constraint: alarm presentation (ER-27): the trace highlight is the selection look, never a hue of a state; a traced line in alarm keeps its alarm glyph.
- Open question: whether the trace needs a flow direction at all at first (both directions from the start point), and where the buttons sit (the line popup, or the legend's place on a phone).
