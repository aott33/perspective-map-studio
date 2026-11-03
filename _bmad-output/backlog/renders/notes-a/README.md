# Owner review notes, group a (popups): before and after renders

Light theme, taken on the group a dev stack (port 9101) with the module built from the base commit
(`761c36a`, "before") and from this branch ("after"), by a scratch Playwright script over the dev map
(`/live`, seeded, with P14 pressure bad (Point 2 stale) and PT-2 pressure 950) and the showcase map.
Desktop renders are 1440 by 900, the phone render 390 by 844. Item 14 (Esc closes the popup) is behaviour
and has no render; it is covered by `e2e/tests/popup.spec.mjs`.

| Item | What | Before | After |
|---|---|---|---|
| 13 | Showcase P21, comms lost: option A rows (status right-aligned, the hourglass alone before a stale value, full labels, the hourglass and no check before "No active alarms") | [before](item13-showcase-p21-before.png) | [after](item13-showcase-p21-after.png) |
| 13 | Showcase P14, priority 1 alarm: option A rows, the alarm block unchanged | [before](item13-showcase-p14-before.png) | [after](item13-showcase-p14-after.png) |
| 13, 15 | Dev map Point 2, a value at Bad quality: "Stale - 0 psi (Bad)" becomes the hourglass and "0 psi", "Stale - bad quality (Bad)" in the tooltip | [before](item13-point2-stale-before.png) | [after](item13-point2-stale-after.png) |
| 15 | Dev map Point 3, a comms tag that is not there: "No value yet - Bad_NotFound" becomes plain words, the code kept in the tooltip and `data-quality` | [before](item15-point3-not-found-before.png) | [after](item15-point3-not-found-after.png) |
| 17 | The Tracer line (no instruments): no segment block | [before](item17-tracer-line-before.png) | [after](item17-tracer-line-after.png) |
| 18 | L-SWD clicked where its card used to grow up over the top bar: the card goes beside the click | [before](item18-lswd-under-top-bar-before.png) | [after](item18-lswd-under-top-bar-after.png) |
| 18 | Point 1 near the right edge just below the zoom card: the card used to drop below the point at a squeezed width (225 px), over the point's name; it now sits beside the point at its own width, clear of the zoom card | [before](item18-point-under-zoom-card-before.png) | [after](item18-point-under-zoom-card-after.png) |
| 19 | L-SWD with PT-2 in alarm: segment, comms, Flow and the alarm summary naming PT-2 pinned at the top; only the instrument list scrolls | [before](item19-lswd-alarm-before.png) | [after](item19-lswd-alarm-after.png) |
| 20 | Shared A chosen from search at zoom 18: the popup pointed at empty map beside the shared marker; at zoom 18 the group splits and the popup points at Shared A | [before](item20-shared-a-zoom18-before.png) | [after](item20-shared-a-zoom18-after.png) |
| 21 | Shared A, no data yet: no check marks, "No data yet" and "Alarm state unknown" in the secondary colour | [before](item21-shared-a-no-data-before.png) | [after](item21-shared-a-no-data-after.png) |
| 27 | Phone, showcase P14 at zoom 17 with its sheet open, after Return: the item was centred in the whole map, under the sheet; it is now centred in the map above the sheet and below the top bar | [before](item27-phone-return-under-sheet-before.png) | [after](item27-phone-return-under-sheet-after.png) |
