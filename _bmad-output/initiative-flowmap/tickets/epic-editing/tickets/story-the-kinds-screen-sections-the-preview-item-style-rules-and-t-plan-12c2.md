---
title: "12c2: the Style tab and an item's own style rule"
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

Not planned yet: a stub so the split is on the branch. Planned after 12c1 is built.

Decided so far (owner, 2026-11-09 and 2026-11-10): the properties panel gains the Style tab: icon, size and label read-only (editable is backlog 38); the style rule shown "From kind" with "Edit the kind's rule", which opens Kinds at that kind; a per-item override that replaces the whole rule, marked Override with Reset.

Found by 12c's survey: the panel has one static Details tab (`PropertiesPanel.tsx` :725-728); 12b1's rule editor is private to `KindSetupPanel.tsx` (`renderStyleRule` :1386 and its rows) and needs extracting to be shared; in an override a typed path must be full, a `{kpi}` source is allowed, a line may say From its instruments, and None means Reset; there is no Style tab mock.
