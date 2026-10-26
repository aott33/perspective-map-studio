# Map Studio editor - layout direction notes

Working notes for the UX workshop, 2026-10-26. Companion to `editor-directions.html` (one file, switcher for Direction A / B / C, 1440 / 1366, view or edit mode, save status demo, bulk example). The visual identity is fixed by the theme tokens; the directions vary layout and density only.

Shared by all three (owner decisions applied in every direction):

- View mode is the same clean operator map: search top-left, "Needs you 3: 1 alarm, 1 comms lost, 1 stale" beside it (opens a ranked list), Legend as a button bottom-left that opens on request, Edit switch (editors only) and zoom top-right, popup with comms and data age, 2 to 3 key values, then alarms with "View alarms", page link as a pop-out icon in the popup header. Bottom-right stays clear for the Perspective App Bar toggle.
- Edit mode: draw toolbar with Select, Box select (Alt for lasso), kind buttons (Well pad, Tank battery, Pipeline), generic Point, Line, Area (kind picked in the form after) and a Snap toggle, off by default. Points: click the map, then drag to fine-tune; typed latitude and longitude in Details is the backup, no address search.
- Undo and Redo sit next to the save status (Saved, Saving..., "Not saved - conflict with Sam's change" with the other change shown). The save status opens Recent changes (who, what, when, Revert per change). A bulk change is one undo step.
- Item list groups by place (Mesa field, then site, then what is on it: wells, laterals, lines), items needing attention first, with Sort by (Needs attention, Place, Kind, Name, Last changed), kind filter chips, checkboxes with Shift-click range and "Select all in Mesa field / in filter / in group".
- Several items selected: the properties panel becomes a bulk form with shared fields only, "Mixed" where values differ, a change applies to all. Example: 20 well pads, Operator "Mixed", toast "Undo: edit 20 pads".
- Kinds: Well pad setup with icon, Style rule (States on Status: Running = Normal, Shut in = Dimmed dashed, Testing = Attention, live preview of each), key values with on/off and the icon value, popup parts.

Map width figures are the component minus docked panels, inside the Perspective page (the host header is not counted).

## Direction A - Docked studio

Rail of modes (View, Items, Kinds, Layers, Import), a docked list panel, a docked properties panel that appears on select, the map on the right, draw toolbar floating top-centre.

**Does well**
- Most complete and "finished" look. List, selection and map are all on screen together, the closest answer to "cobbled together, not connected".
- Kinds mode reads naturally: kinds list in the list panel, kind setup in the properties panel, map still visible as the preview context.
- Bulk work is comfortable: checkboxes in the list and the bulk form side by side.
- Familiar to the owner (Atlist), who found this layout fine on a laptop.

**Costs**
- Screen space at 1366: map is about 718 px of 1366 (53 %) with an item selected, 1038 px with nothing selected. At 1440: 748 px. The top-centre toolbar and the top-right Edit switch fit with about 30 px to spare at 1366; nothing more can go on that row.
- Clicks to edit an item: 1 once in edit mode (click on map or in list opens properties); +1 for the Edit switch unless the integrator opens the component straight into edit mode. A tab is one more click.
- Opening and closing the properties panel shifts the map area by 320 to 340 px (the mock pans the map to compensate); that movement can feel jumpy.
- Phone (390 px, view mode): view mode is unaffected (shared). Edit mode has no phone form: three columns cannot collapse; the phone editing role would need a separate bottom-sheet layout anyway.

## Direction B - Map first

Map fills the component; slim rail; one panel slides in from the left for the list, then item details with a back arrow; save status, Undo and Redo ride in the top-centre toolbar.

**Does well**
- Edit mode looks like the operator map with tools switched on, so view and edit feel like one product.
- Most map at 1366: 1310 px with the panel closed, about 950 px with it open (the toolbar and draw bar re-centre on the visible part).
- One place to look for everything that is not the map.
- Best phone path: the slide panel is the same idea as the phone bottom sheet (FR-28), so the phone editing layout is a re-flow, not a new design.

**Costs**
- List and details are never visible together. Going to the next item from the list costs a back click (map clicks go straight to details, 1 click).
- Clicks to edit: 1 from the map; 2 from the list when the panel is closed (rail Items, then the row); +1 back to return to the list.
- Bulk needs an extra step: tick items, then "Edit together" opens the bulk form in the same panel, so ticking and the form are not side by side.
- The panel overlays the map, so items under it are hidden until it pans (the mock pans 180 px).
- The top toolbar carries the most (tools, Snap, Undo, Redo, save status): at 1366 with the panel open it nearly fills the visible map width when the conflict text shows.
- Phone (390 px, view mode): unaffected (shared); see above, the strongest editing story.

## Direction C - Inspector

List docked left (tabs Items, Kinds, Layers, Import instead of a rail), map centre, inspector docked right and always present (field summary when nothing is selected), draw tools in a vertical strip on the map's left edge.

**Does well**
- Fixed homes: what exists (left), where (centre), what it is (right). Nothing appears, slides or covers the map, and the map never shifts.
- Empty inspector earns its place: a field summary (11 items, 1 unlinked, 1 in alarm, 1 comms lost, 1 stale).
- Vertical tool strip leaves the top of the map free; the mode pill sits beside the strip.
- Box select and the bulk form work best here: drag on the map, the form is already open on the right.

**Costs**
- Screen space at 1366: map about 810 px of 1366 (59 %) at all times, even with nothing selected. At 1440: about 838 px. Better than A with a selection, worse than A or B with none.
- Clicks to edit an item: 1 (map or list), same as A, no panel to open or close.
- Least Atlist-like; reads more like a design tool, which may feel technical to admins who "might never touch a CSV".
- The inspector footer had to be padded so Delete stays clear of the App Bar toggle in the bottom-right corner; anything docked right has that constraint.
- Phone (390 px, view mode): unaffected (shared). Edit mode has to drop both docked panels at 390 px, so it ends up as Direction B on a phone.

## Phone, view mode, all directions (described, not mocked)

At 390 px the view map is the same in all three: search full width at the top, the "Needs you" summary as a chip row under it, zoom top-right at 44 px targets, the Legend button bottom-left, popups as a bottom sheet with a visible close (FR-4) that stops above the App Bar toggle. The Edit switch only shows to the phone-editing role and, below 768 px, offers moving points and editing properties only (FR-27, FR-28).

## Points to settle in the workshop

- The bulk example says "20 well pads" (owner wording); the Mesa demo field has 3, so the mock labels it "Example at scale". Recent changes uses the real Mesa count ("Edited 3 well pads in one change").
- "Operator" and "Route" are illustrative well pad form fields for the bulk example, not decided fields.
- UI chrome glyphs (eye, list, layers, undo, box select, pop-out, magnet) are stand-ins drawn on the icon grid; the approved sprite has no UI icons yet.
- Attention (Testing) is shown with no hue: a heavier outline plus the word, following the template's `--st-attention`.
