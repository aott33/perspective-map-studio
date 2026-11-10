---
title: "12b2: the style rule's preview on the map"
type: 'feature'
ticket: ''
part_of: '12'
created: '2026-11-10'
status: 'draft'
baseline_revision: ''
route: ''
route_source: ''
risk: 'high'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: []
---

Not planned yet: a stub so the split is on the branch. Planned after 12b1 is built.

Decided so far (owner, 2026-11-09 and 2026-11-10): States and Bands preview live on the preview item on the map, with a "Preview" word, through a TypeScript port of `common/.../contract/StyleRule.java` with shared test vectors (the `line-measure-vectors.json` pattern); an Expression shows on the map only after it saves, with a note saying so; the note box says what the preview item shows now and when its alarm wins over the rule. The browser knows a rule's value only for a key value that is switched on: for a tag path or a switched-off key value the map shows the item as the Gateway draws it, with a note that this value previews on the map only once saved, the tiles still showing every case (owner's pick 1, 2026-11-10).

Found by 12b's survey: the one place a preset is read is `live.ts` `itemState` :573 (:611-618); the map's redraw guard `itemsLayer.ts` :95-97 needs a preview key; Java's `Double.parseDouble` and JavaScript's `Number()` disagree ("2f", "", "0x10"), so the port needs its own number reader.
